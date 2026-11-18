-- MJAR.1711.11-13: persistência multi-tenant de plantas e fotos privadas.
-- Migration incremental: não altera a fundação já aplicada.

create table public.plants (
  id uuid primary key default extensions.gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  nickname text not null,
  species text,
  main_photo_path text,
  location text,
  acquired_at date,
  origin text check (origin is null or origin in ('seed', 'seedling', 'purchased', 'other')),
  light_exposure text check (
    light_exposure is null
    or light_exposure in ('low_light', 'indirect_light', 'partial_sun', 'full_sun')
  ),
  pot_soil_notes text,
  notes text,
  status text not null default 'active' check (status in ('active', 'recovering', 'archived')),
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plants_nickname_not_blank check (char_length(nickname) between 1 and 120),
  constraint plants_species_length check (species is null or char_length(species) <= 160),
  constraint plants_location_length check (location is null or char_length(location) <= 120)
);

comment on table public.plants is 'Plantas isoladas por jardim; exclusão pelo cliente é substituída por status archived.';
comment on column public.plants.acquired_at is 'Data civil sem fuso horário.';
comment on column public.plants.origin is 'seed, seedling, purchased ou other.';
comment on column public.plants.light_exposure is 'low_light, indirect_light, partial_sun ou full_sun.';
comment on column public.plants.status is 'active, recovering ou archived.';
comment on column public.plants.main_photo_path is 'Caminho privado garden_id/plant_id/file_uuid.ext no bucket plant-photos.';

create index plants_garden_status_idx on public.plants(garden_id, status);
create index plants_garden_location_idx on public.plants(garden_id, location) where location is not null;
create index plants_garden_created_at_idx on public.plants(garden_id, created_at desc);

create or replace function public.prepare_plant_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  path_parts text[];
begin
  new.nickname := btrim(new.nickname);

  if new.nickname = '' then
    raise exception 'plant nickname cannot be blank' using errcode = '23514';
  end if;

  if tg_op = 'INSERT' and auth.uid() is not null then
    new.created_by := auth.uid();
  elsif tg_op = 'UPDATE' and (
    new.garden_id is distinct from old.garden_id
    or new.created_by is distinct from old.created_by
  ) then
    raise exception 'garden_id and created_by are immutable' using errcode = '23514';
  end if;

  if new.main_photo_path is not null then
    path_parts := string_to_array(new.main_photo_path, '/');
    if array_length(path_parts, 1) <> 3
      or path_parts[1] <> new.garden_id::text
      or path_parts[2] <> new.id::text
      or path_parts[3] !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
    then
      raise exception 'invalid main photo path' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger plants_prepare_write
before insert or update on public.plants
for each row execute function public.prepare_plant_write();

create trigger plants_set_updated_at
before update on public.plants
for each row execute function public.set_updated_at();

alter table public.plants enable row level security;

create policy "plants_select_garden_member"
on public.plants for select to authenticated
using (public.is_garden_member(garden_id));

create policy "plants_insert_garden_member"
on public.plants for insert to authenticated
with check (
  public.is_garden_member(garden_id)
  and created_by = auth.uid()
);

create policy "plants_update_garden_member"
on public.plants for update to authenticated
using (public.is_garden_member(garden_id))
with check (public.is_garden_member(garden_id));

revoke all on table public.plants from anon;
revoke all on table public.plants from authenticated;
grant select on table public.plants to authenticated;
grant insert (
  garden_id, nickname, species, main_photo_path, location, acquired_at,
  origin, light_exposure, pot_soil_notes, notes, status
) on table public.plants to authenticated;
grant update (
  nickname, species, main_photo_path, location, acquired_at,
  origin, light_exposure, pot_soil_notes, notes, status
) on table public.plants to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'plant-photos',
  'plant-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Valida formato, jardim, planta e membership real sem depender apenas do path.
-- SECURITY DEFINER é restrito a esta verificação para evitar RLS aninhada entre
-- storage.objects e plants/garden_members.
create or replace function public.can_access_plant_photo(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  path_parts text[] := string_to_array(object_name, '/');
  path_garden_id uuid;
  path_plant_id uuid;
begin
  if array_length(path_parts, 1) <> 3
    or path_parts[1] !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or path_parts[2] !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or path_parts[3] !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
  then
    return false;
  end if;

  path_garden_id := path_parts[1]::uuid;
  path_plant_id := path_parts[2]::uuid;

  return exists (
    select 1
    from public.plants p
    join public.garden_members gm
      on gm.garden_id = p.garden_id
     and gm.user_id = auth.uid()
    where p.id = path_plant_id
      and p.garden_id = path_garden_id
  );
end;
$$;

revoke all on function public.can_access_plant_photo(text) from public;
grant execute on function public.can_access_plant_photo(text) to authenticated;

create policy "plant_photos_select_member"
on storage.objects for select to authenticated
using (bucket_id = 'plant-photos' and public.can_access_plant_photo(name));

create policy "plant_photos_insert_member"
on storage.objects for insert to authenticated
with check (bucket_id = 'plant-photos' and public.can_access_plant_photo(name));

create policy "plant_photos_update_member"
on storage.objects for update to authenticated
using (bucket_id = 'plant-photos' and public.can_access_plant_photo(name))
with check (bucket_id = 'plant-photos' and public.can_access_plant_photo(name));

-- Intencionalmente não há policy DELETE em plants ou storage.objects.
-- Fotos podem ser substituídas no mesmo path autorizado; remoção segura fica
-- bloqueada até existir fluxo que verifique referências e histórico.
