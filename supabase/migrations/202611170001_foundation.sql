-- Fundação multi-jardim. Execute com Supabase CLI ou pelo SQL Editor em projeto novo/revisado.
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 120),
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gardens (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 80),
  timezone text not null default 'America/Sao_Paulo' check (char_length(timezone) between 1 and 100),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.garden_members (
  garden_id uuid not null references public.gardens(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (garden_id, user_id)
);

create index if not exists garden_members_user_id_idx on public.garden_members(user_id);
create index if not exists gardens_created_by_idx on public.gardens(created_by);

alter table public.profiles enable row level security;
alter table public.gardens enable row level security;
alter table public.garden_members enable row level security;

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists gardens_set_updated_at on public.gardens;
create trigger gardens_set_updated_at before update on public.gardens for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare safe_name text;
begin
  safe_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), '');
  if safe_name is null then safe_name := split_part(coalesce(new.email, 'Jardineiro'), '@', 1); end if;
  insert into public.profiles (id, display_name) values (new.id, left(safe_name, 120)) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.ensure_profile()
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); safe_name text;
begin
  if uid is null then raise exception 'authentication required' using errcode = '42501'; end if;
  select nullif(trim(coalesce(raw_user_meta_data ->> 'display_name', '')), '') into safe_name from auth.users where id = uid;
  if safe_name is null then select split_part(coalesce(email, 'Jardineiro'), '@', 1) into safe_name from auth.users where id = uid; end if;
  insert into public.profiles (id, display_name) values (uid, left(safe_name, 120)) on conflict (id) do nothing;
end;
$$;

-- SECURITY DEFINER evita recursão de RLS ao verificar garden_members.
create or replace function public.is_garden_member(target_garden_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.garden_members gm where gm.garden_id = target_garden_id and gm.user_id = auth.uid());
$$;

create or replace function public.is_garden_admin(target_garden_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.garden_members gm where gm.garden_id = target_garden_id and gm.user_id = auth.uid() and gm.role = 'admin');
$$;

create or replace function public.create_garden(garden_name text, garden_timezone text default 'America/Sao_Paulo')
returns uuid language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); new_garden_id uuid; clean_name text := trim(garden_name); clean_timezone text := trim(garden_timezone);
begin
  if uid is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if clean_name is null or char_length(clean_name) not between 2 and 80 then raise exception 'invalid garden name' using errcode = '22023'; end if;
  if clean_timezone is null or char_length(clean_timezone) not between 1 and 100 then raise exception 'invalid timezone' using errcode = '22023'; end if;
  insert into public.gardens(name, timezone, created_by) values (clean_name, clean_timezone, uid) returning id into new_garden_id;
  insert into public.garden_members(garden_id, user_id, role) values (new_garden_id, uid, 'admin');
  return new_garden_id;
end;
$$;

create or replace function public.prevent_last_garden_admin()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.role = 'admin' and (tg_op = 'DELETE' or new.role <> 'admin') and not exists (
    select 1 from public.garden_members gm where gm.garden_id = old.garden_id and gm.user_id <> old.user_id and gm.role = 'admin'
  ) then raise exception 'a garden must keep at least one administrator' using errcode = '23514'; end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists garden_members_keep_admin on public.garden_members;
create trigger garden_members_keep_admin before delete or update of role on public.garden_members for each row execute function public.prevent_last_garden_admin();

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "gardens_select_member" on public.gardens;
create policy "gardens_select_member" on public.gardens for select to authenticated using (public.is_garden_member(id));
drop policy if exists "gardens_update_admin" on public.gardens;
create policy "gardens_update_admin" on public.gardens for update to authenticated using (public.is_garden_admin(id)) with check (public.is_garden_admin(id));

drop policy if exists "garden_members_select_fellow_members" on public.garden_members;
create policy "garden_members_select_fellow_members" on public.garden_members for select to authenticated using (public.is_garden_member(garden_id));

revoke all on table public.profiles, public.gardens, public.garden_members from anon;
grant select on public.profiles to authenticated;
grant update (display_name, avatar_path) on public.profiles to authenticated;
grant select on public.gardens to authenticated;
grant update (name, timezone) on public.gardens to authenticated;
grant select on public.garden_members to authenticated;
revoke all on function public.ensure_profile() from public;
revoke all on function public.is_garden_member(uuid) from public;
revoke all on function public.is_garden_admin(uuid) from public;
revoke all on function public.create_garden(text, text) from public;
grant execute on function public.ensure_profile() to authenticated;
grant execute on function public.is_garden_member(uuid) to authenticated;
grant execute on function public.is_garden_admin(uuid) to authenticated;
grant execute on function public.create_garden(text, text) to authenticated;
