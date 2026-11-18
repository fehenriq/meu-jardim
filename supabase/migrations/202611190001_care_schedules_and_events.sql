alter table public.plants
add constraint plants_id_garden_unique unique (id, garden_id);

create table public.care_schedules (
  id uuid primary key default extensions.gen_random_uuid(),
  garden_id uuid not null,
  plant_id uuid not null,
  care_type text not null check (care_type in ('watering_check', 'fertilizing', 'pruning', 'repotting', 'custom')),
  custom_title text,
  interval_days integer not null check (interval_days between 1 and 3650),
  next_due_date date not null,
  active boolean not null default true,
  settings jsonb not null default '{}'::jsonb,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint care_schedules_plant_garden_fk foreign key (plant_id, garden_id) references public.plants(id, garden_id) on delete restrict,
  constraint care_schedules_custom_title_check check (
    (care_type = 'custom' and custom_title is not null and char_length(trim(custom_title)) between 1 and 120)
    or (care_type <> 'custom' and custom_title is null)
  ),
  constraint care_schedules_settings_check check (
    jsonb_typeof(settings) = 'object'
    and settings - 'moisture_recheck_days' = '{}'::jsonb
    and (
      not settings ? 'moisture_recheck_days'
      or (
        jsonb_typeof(settings -> 'moisture_recheck_days') = 'number'
        and (settings ->> 'moisture_recheck_days')::numeric = trunc((settings ->> 'moisture_recheck_days')::numeric)
        and (settings ->> 'moisture_recheck_days')::integer between 1 and 30
      )
    )
  ),
  constraint care_schedules_identity_unique unique (id, garden_id, plant_id)
);

create table public.care_events (
  id uuid primary key default extensions.gen_random_uuid(),
  garden_id uuid not null,
  plant_id uuid not null,
  schedule_id uuid,
  event_type text not null check (event_type in ('watered', 'moisture_checked', 'deferred', 'care_completed')),
  event_at timestamptz not null,
  actor_id uuid not null references auth.users(id) on delete restrict,
  request_id uuid not null,
  note text check (note is null or char_length(note) <= 2000),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  constraint care_events_plant_garden_fk foreign key (plant_id, garden_id) references public.plants(id, garden_id) on delete restrict,
  constraint care_events_schedule_scope_fk foreign key (schedule_id, garden_id, plant_id) references public.care_schedules(id, garden_id, plant_id) on delete restrict,
  constraint care_events_request_unique unique (garden_id, actor_id, request_id)
);

create index care_schedules_garden_due_idx on public.care_schedules(garden_id, active, next_due_date);
create index care_schedules_plant_idx on public.care_schedules(plant_id, active);
create index care_events_garden_recent_idx on public.care_events(garden_id, event_at desc);
create index care_events_plant_recent_idx on public.care_events(plant_id, event_at desc);
create index care_events_schedule_recent_idx on public.care_events(schedule_id, event_at desc) where schedule_id is not null;

create trigger care_schedules_set_updated_at
before update on public.care_schedules
for each row execute function public.set_updated_at();

create or replace function public.prepare_care_schedule_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  resolved_garden_id uuid;
  plant_status text;
begin
  select p.garden_id, p.status into resolved_garden_id, plant_status
  from public.plants p
  where p.id = new.plant_id;

  if resolved_garden_id is null then
    raise exception 'plant not found' using errcode = '23503';
  end if;

  if tg_op = 'INSERT' then
    if plant_status = 'archived' then
      raise exception 'archived plants cannot receive new schedules' using errcode = '23514';
    end if;
    new.garden_id := resolved_garden_id;
    new.created_by := auth.uid();
  elsif new.garden_id is distinct from old.garden_id
    or new.plant_id is distinct from old.plant_id
    or new.created_by is distinct from old.created_by then
    raise exception 'schedule ownership fields are immutable' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger care_schedules_prepare_write
before insert or update on public.care_schedules
for each row execute function public.prepare_care_schedule_write();

alter table public.care_schedules enable row level security;
alter table public.care_events enable row level security;

create policy "care_schedules_select_garden_member"
on public.care_schedules for select to authenticated
using (public.is_garden_member(garden_id));

create policy "care_schedules_insert_garden_member"
on public.care_schedules for insert to authenticated
with check (public.is_garden_member(garden_id) and created_by = auth.uid());

create policy "care_schedules_update_garden_member"
on public.care_schedules for update to authenticated
using (public.is_garden_member(garden_id))
with check (public.is_garden_member(garden_id));

create policy "care_events_select_garden_member"
on public.care_events for select to authenticated
using (public.is_garden_member(garden_id));

create or replace function public.record_care_action(
  p_plant_id uuid,
  p_schedule_id uuid,
  p_action text,
  p_request_id uuid,
  p_event_at timestamptz default now(),
  p_note text default null,
  p_defer_days integer default null
)
returns public.care_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  target_plant public.plants%rowtype;
  target_schedule public.care_schedules%rowtype;
  existing_event public.care_events%rowtype;
  created_event public.care_events%rowtype;
  garden_timezone text;
  local_event_date date;
  next_date date;
  event_kind text;
  event_metadata jsonb := '{}'::jsonb;
begin
  if uid is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_request_id is null or p_event_at is null then
    raise exception 'request_id and event_at are required' using errcode = '22023';
  end if;
  if p_note is not null and char_length(p_note) > 2000 then
    raise exception 'note is too long' using errcode = '22023';
  end if;

  select p.* into target_plant
  from public.plants p
  where p.id = p_plant_id
  for update;

  if target_plant.id is null or not public.is_garden_member(target_plant.garden_id) then
    raise exception 'plant not found or access denied' using errcode = '42501';
  end if;

  select e.* into existing_event
  from public.care_events e
  where e.garden_id = target_plant.garden_id
    and e.actor_id = uid
    and e.request_id = p_request_id;

  if existing_event.id is not null then
    return existing_event;
  end if;

  if target_plant.status = 'archived' then
    raise exception 'archived plants cannot receive care actions' using errcode = '23514';
  end if;

  select g.timezone into garden_timezone
  from public.gardens g
  where g.id = target_plant.garden_id;

  local_event_date := (p_event_at at time zone garden_timezone)::date;

  if p_schedule_id is null then
    if p_action <> 'watered' then
      raise exception 'only spontaneous watering is allowed without a schedule' using errcode = '22023';
    end if;
    event_kind := 'watered';
  else
    select s.* into target_schedule
    from public.care_schedules s
    where s.id = p_schedule_id
      and s.garden_id = target_plant.garden_id
      and s.plant_id = target_plant.id
    for update;

    if target_schedule.id is null then
      raise exception 'schedule not found in plant scope' using errcode = '23503';
    end if;
    if not target_schedule.active then
      raise exception 'inactive schedules cannot receive care actions' using errcode = '23514';
    end if;

    if p_action = 'watered' and target_schedule.care_type = 'watering_check' then
      event_kind := 'watered';
      next_date := local_event_date + target_schedule.interval_days;
    elsif p_action = 'moisture_checked' and target_schedule.care_type = 'watering_check' then
      event_kind := 'moisture_checked';
      next_date := local_event_date + coalesce((target_schedule.settings ->> 'moisture_recheck_days')::integer, 2);
    elsif p_action = 'deferred' then
      if p_defer_days is null or p_defer_days not between 1 and 365 then
        raise exception 'defer_days must be between 1 and 365' using errcode = '22023';
      end if;
      event_kind := 'deferred';
      next_date := local_event_date + p_defer_days;
      event_metadata := jsonb_build_object('defer_days', p_defer_days);
    elsif p_action = 'care_completed' and target_schedule.care_type <> 'watering_check' then
      event_kind := 'care_completed';
      next_date := local_event_date + target_schedule.interval_days;
    else
      raise exception 'action is incompatible with schedule type' using errcode = '22023';
    end if;

    update public.care_schedules
    set next_due_date = next_date
    where id = target_schedule.id;
  end if;

  insert into public.care_events (
    garden_id, plant_id, schedule_id, event_type, event_at,
    actor_id, request_id, note, metadata
  ) values (
    target_plant.garden_id, target_plant.id, p_schedule_id, event_kind, p_event_at,
    uid, p_request_id, nullif(trim(p_note), ''), event_metadata
  )
  returning * into created_event;

  return created_event;
exception
  when unique_violation then
    select e.* into existing_event
    from public.care_events e
    where e.garden_id = target_plant.garden_id
      and e.actor_id = uid
      and e.request_id = p_request_id;
    if existing_event.id is not null then
      return existing_event;
    end if;
    raise;
end;
$$;

create view public.pending_care_schedules
with (security_invoker = true)
as
select s.*
from public.care_schedules s
join public.plants p
  on p.id = s.plant_id
 and p.garden_id = s.garden_id
where s.active = true
  and p.status <> 'archived';

revoke all on table public.care_schedules, public.care_events from anon;
revoke all on table public.care_schedules, public.care_events from authenticated;
grant select on table public.care_schedules, public.care_events to authenticated;
grant insert (plant_id, care_type, custom_title, interval_days, next_due_date, active, settings) on table public.care_schedules to authenticated;
grant update (care_type, custom_title, interval_days, next_due_date, active, settings) on table public.care_schedules to authenticated;
revoke all on table public.pending_care_schedules from anon;
revoke all on table public.pending_care_schedules from authenticated;
grant select on table public.pending_care_schedules to authenticated;
revoke all on function public.prepare_care_schedule_write() from public;
revoke all on function public.record_care_action(uuid, uuid, text, uuid, timestamptz, text, integer) from public;
grant execute on function public.record_care_action(uuid, uuid, text, uuid, timestamptz, text, integer) to authenticated;
