create table public.garden_invites (
  id uuid primary key default extensions.gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  role text not null default 'member' check (role = 'member'),
  expires_at timestamptz not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete restrict,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint garden_invites_expiration_check check (expires_at > created_at),
  constraint garden_invites_acceptance_check check ((accepted_at is null) = (accepted_by is null)),
  constraint garden_invites_terminal_check check (accepted_at is null or revoked_at is null)
);

create index garden_invites_garden_created_idx on public.garden_invites(garden_id, created_at desc);
create index garden_invites_pending_idx on public.garden_invites(garden_id, expires_at) where accepted_at is null and revoked_at is null;
alter table public.garden_invites enable row level security;

create policy "garden_invites_select_admin"
on public.garden_invites for select to authenticated
using (public.is_garden_admin(garden_id));

revoke all on table public.garden_invites from anon, authenticated;
grant select (id, garden_id, role, expires_at, created_by, accepted_at, accepted_by, revoked_at, created_at) on public.garden_invites to authenticated;

create or replace function public.create_garden_invite(target_garden_id uuid)
returns table (invite_id uuid, invite_token text, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  plain_token text;
  created_invite public.garden_invites%rowtype;
begin
  if uid is null or not public.is_garden_admin(target_garden_id) then
    raise exception 'access denied' using errcode = '42501';
  end if;
  plain_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.garden_invites (garden_id, token_hash, role, expires_at, created_by)
  values (target_garden_id, encode(extensions.digest(plain_token, 'sha256'), 'hex'), 'member', now() + interval '7 days', uid)
  returning * into created_invite;
  return query select created_invite.id, plain_token, created_invite.expires_at;
end;
$$;

create or replace function public.inspect_garden_invite(invite_token text)
returns table (invite_status text, garden_name text)
language plpgsql stable security definer set search_path = '' as $$
declare target public.garden_invites%rowtype;
begin
  if invite_token is null or invite_token !~ '^[0-9a-f]{64}$' then
    return query select 'invalid'::text, null::text; return;
  end if;
  select * into target from public.garden_invites where token_hash = encode(extensions.digest(invite_token, 'sha256'), 'hex');
  if target.id is null then return query select 'invalid'::text, null::text;
  elsif target.revoked_at is not null then return query select 'revoked'::text, null::text;
  elsif target.accepted_at is not null then
    if target.accepted_by = auth.uid() then return query select 'valid'::text, (select g.name from public.gardens g where g.id = target.garden_id);
    else return query select 'used'::text, null::text;
    end if;
  elsif target.expires_at <= now() then return query select 'expired'::text, null::text;
  else return query select 'valid'::text, (select g.name from public.gardens g where g.id = target.garden_id);
  end if;
end;
$$;

create or replace function public.revoke_garden_invite(target_invite_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare target_garden_id uuid;
begin
  select garden_id into target_garden_id from public.garden_invites where id = target_invite_id for update;
  if target_garden_id is null or not public.is_garden_admin(target_garden_id) then raise exception 'access denied' using errcode = '42501'; end if;
  update public.garden_invites set revoked_at = now() where id = target_invite_id and accepted_at is null and revoked_at is null;
end;
$$;

create or replace function public.accept_garden_invite(invite_token text)
returns table (accept_status text, garden_id uuid)
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); target public.garden_invites%rowtype;
begin
  if uid is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if invite_token is null or invite_token !~ '^[0-9a-f]{64}$' then return query select 'invalid'::text, null::uuid; return; end if;
  select * into target from public.garden_invites where token_hash = encode(extensions.digest(invite_token, 'sha256'), 'hex') for update;
  if target.id is null or target.revoked_at is not null or target.expires_at <= now() then return query select 'invalid'::text, null::uuid; return; end if;
  if target.accepted_at is not null then
    if target.accepted_by = uid then return query select 'accepted'::text, target.garden_id; else return query select 'invalid'::text, null::uuid; end if;
    return;
  end if;
  if public.is_garden_member(target.garden_id) then return query select 'already_member'::text, target.garden_id; return; end if;
  insert into public.garden_members (garden_id, user_id, role) values (target.garden_id, uid, 'member');
  update public.garden_invites set accepted_at = now(), accepted_by = uid where id = target.id;
  return query select 'accepted'::text, target.garden_id;
end;
$$;

revoke all on function public.create_garden_invite(uuid) from public;
revoke all on function public.inspect_garden_invite(text) from public;
revoke all on function public.revoke_garden_invite(uuid) from public;
revoke all on function public.accept_garden_invite(text) from public;
grant execute on function public.create_garden_invite(uuid) to authenticated;
grant execute on function public.inspect_garden_invite(text) to anon, authenticated;
grant execute on function public.revoke_garden_invite(uuid) to authenticated;
grant execute on function public.accept_garden_invite(text) to authenticated;
