create table public.growth_entries (
  id uuid primary key default extensions.gen_random_uuid(),
  garden_id uuid not null,
  plant_id uuid not null,
  observed_at timestamptz not null default now(),
  height_cm numeric,
  leaf_count integer,
  notes text,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint growth_entries_plant_garden_fk foreign key (plant_id, garden_id) references public.plants(id, garden_id) on delete restrict,
  constraint growth_entries_height_check check (
    height_cm is null
    or (height_cm >= 0 and height_cm::text not in ('NaN', 'Infinity', '-Infinity'))
  ),
  constraint growth_entries_leaf_count_check check (leaf_count is null or leaf_count >= 0),
  constraint growth_entries_notes_length check (notes is null or char_length(notes) <= 4000),
  constraint growth_entries_identity_unique unique (id, garden_id, plant_id)
);

create table public.plant_photos (
  id uuid primary key default extensions.gen_random_uuid(),
  garden_id uuid not null,
  plant_id uuid not null,
  growth_entry_id uuid,
  storage_path text not null unique,
  taken_at timestamptz,
  uploaded_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint plant_photos_plant_garden_fk foreign key (plant_id, garden_id) references public.plants(id, garden_id) on delete restrict,
  constraint plant_photos_growth_entry_scope_fk foreign key (growth_entry_id, garden_id, plant_id) references public.growth_entries(id, garden_id, plant_id) on delete restrict
);

create index growth_entries_garden_observed_idx on public.growth_entries(garden_id, observed_at desc);
create index growth_entries_plant_observed_idx on public.growth_entries(plant_id, observed_at desc);
create index plant_photos_garden_created_idx on public.plant_photos(garden_id, created_at desc, id desc);
create index plant_photos_plant_created_idx on public.plant_photos(plant_id, created_at desc, id desc);
create index plant_photos_growth_entry_idx on public.plant_photos(growth_entry_id, created_at) where growth_entry_id is not null;

create or replace function public.prepare_growth_entry_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  resolved_garden_id uuid;
  plant_status text;
begin
  if tg_op = 'INSERT' then
    select p.garden_id, p.status into resolved_garden_id, plant_status
    from public.plants p
    where p.id = new.plant_id;

    if resolved_garden_id is null then
      raise exception 'plant not found' using errcode = '23503';
    end if;
    if plant_status = 'archived' then
      raise exception 'archived plants cannot receive growth entries' using errcode = '23514';
    end if;

    new.garden_id := resolved_garden_id;
    new.created_by := auth.uid();
  elsif new.garden_id is distinct from old.garden_id
    or new.plant_id is distinct from old.plant_id
    or new.created_by is distinct from old.created_by then
    raise exception 'growth entry ownership fields are immutable' using errcode = '23514';
  end if;

  new.notes := nullif(btrim(new.notes), '');
  return new;
end;
$$;

create trigger growth_entries_prepare_write
before insert or update on public.growth_entries
for each row execute function public.prepare_growth_entry_write();

create or replace function public.prepare_plant_photo_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  resolved_garden_id uuid;
  plant_status text;
  path_parts text[];
begin
  if tg_op = 'INSERT' then
    select p.garden_id, p.status into resolved_garden_id, plant_status
    from public.plants p
    where p.id = new.plant_id;

    if resolved_garden_id is null then
      raise exception 'plant not found' using errcode = '23503';
    end if;
    if plant_status = 'archived' then
      raise exception 'archived plants cannot receive photos' using errcode = '23514';
    end if;

    new.garden_id := resolved_garden_id;
    new.uploaded_by := auth.uid();
  elsif new.garden_id is distinct from old.garden_id
    or new.plant_id is distinct from old.plant_id
    or new.storage_path is distinct from old.storage_path
    or new.uploaded_by is distinct from old.uploaded_by then
    raise exception 'plant photo ownership fields are immutable' using errcode = '23514';
  elsif old.growth_entry_id is not null and new.growth_entry_id is distinct from old.growth_entry_id then
    raise exception 'plant photo association cannot be replaced or removed' using errcode = '23514';
  end if;

  path_parts := string_to_array(new.storage_path, '/');
  if array_length(path_parts, 1) <> 3
    or path_parts[1] <> new.garden_id::text
    or path_parts[2] <> new.plant_id::text
    or path_parts[3] !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
  then
    raise exception 'invalid plant photo path' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger plant_photos_prepare_write
before insert or update on public.plant_photos
for each row execute function public.prepare_plant_photo_write();

alter table public.growth_entries enable row level security;
alter table public.plant_photos enable row level security;

create policy "growth_entries_select_garden_member"
on public.growth_entries for select to authenticated
using (public.is_garden_member(garden_id));

create policy "growth_entries_insert_garden_member"
on public.growth_entries for insert to authenticated
with check (public.is_garden_member(garden_id) and created_by = auth.uid());

create policy "growth_entries_update_garden_member"
on public.growth_entries for update to authenticated
using (public.is_garden_member(garden_id))
with check (public.is_garden_member(garden_id));

create policy "plant_photos_select_garden_member"
on public.plant_photos for select to authenticated
using (public.is_garden_member(garden_id));

create policy "plant_photos_insert_garden_member"
on public.plant_photos for insert to authenticated
with check (public.is_garden_member(garden_id) and uploaded_by = auth.uid());

create policy "plant_photos_update_garden_member"
on public.plant_photos for update to authenticated
using (public.is_garden_member(garden_id))
with check (public.is_garden_member(garden_id));

revoke all on table public.growth_entries, public.plant_photos from anon;
revoke all on table public.growth_entries, public.plant_photos from authenticated;
grant select on table public.growth_entries, public.plant_photos to authenticated;
grant insert (plant_id, observed_at, height_cm, leaf_count, notes) on table public.growth_entries to authenticated;
grant update (observed_at, height_cm, leaf_count, notes) on table public.growth_entries to authenticated;
grant insert (plant_id, growth_entry_id, storage_path, taken_at) on table public.plant_photos to authenticated;
grant update (growth_entry_id, taken_at) on table public.plant_photos to authenticated;
revoke all on function public.prepare_growth_entry_write() from public;
revoke all on function public.prepare_plant_photo_write() from public;
