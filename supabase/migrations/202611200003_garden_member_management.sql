create or replace function public.list_garden_members(target_garden_id uuid)
returns table (user_id uuid, display_name text, avatar_path text, role text, joined_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select gm.user_id, p.display_name, p.avatar_path, gm.role, gm.joined_at
  from public.garden_members viewer
  join public.garden_members gm on gm.garden_id = viewer.garden_id
  join public.profiles p on p.id = gm.user_id
  where viewer.garden_id = target_garden_id and viewer.user_id = auth.uid()
  order by case gm.role when 'admin' then 0 else 1 end, lower(p.display_name), gm.user_id;
$$;

create or replace function public.manage_garden_member(target_garden_id uuid, target_user_id uuid, requested_action text)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); target_role text; admin_count integer;
begin
  if uid is null then raise exception 'authentication required' using errcode = '42501'; end if;
  perform 1 from public.gardens where id = target_garden_id for update;
  if not found or not public.is_garden_admin(target_garden_id) then raise exception 'access denied' using errcode = '42501'; end if;
  if target_user_id = uid then raise exception 'use leave_garden for the current user' using errcode = '22023'; end if;
  select role into target_role from public.garden_members where garden_id = target_garden_id and user_id = target_user_id for update;
  if target_role is null then raise exception 'access denied' using errcode = '42501'; end if;
  if requested_action = 'promote' then
    if target_role = 'member' then update public.garden_members set role = 'admin' where garden_id = target_garden_id and user_id = target_user_id; end if;
  elsif requested_action in ('demote', 'remove') then
    if target_role = 'admin' then
      select count(*) into admin_count from public.garden_members where garden_id = target_garden_id and role = 'admin';
      if admin_count <= 1 then raise exception 'garden must keep an administrator' using errcode = '23514'; end if;
    end if;
    if requested_action = 'demote' then
      if target_role = 'admin' then update public.garden_members set role = 'member' where garden_id = target_garden_id and user_id = target_user_id; end if;
    else delete from public.garden_members where garden_id = target_garden_id and user_id = target_user_id;
    end if;
  else raise exception 'invalid action' using errcode = '22023';
  end if;
end;
$$;

create or replace function public.leave_garden(target_garden_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); own_role text; admin_count integer;
begin
  if uid is null then raise exception 'authentication required' using errcode = '42501'; end if;
  perform 1 from public.gardens where id = target_garden_id for update;
  select role into own_role from public.garden_members where garden_id = target_garden_id and user_id = uid for update;
  if own_role is null then raise exception 'access denied' using errcode = '42501'; end if;
  if own_role = 'admin' then
    select count(*) into admin_count from public.garden_members where garden_id = target_garden_id and role = 'admin';
    if admin_count <= 1 then raise exception 'garden must keep an administrator' using errcode = '23514'; end if;
  end if;
  delete from public.garden_members where garden_id = target_garden_id and user_id = uid;
end;
$$;

revoke all on function public.list_garden_members(uuid) from public;
revoke all on function public.manage_garden_member(uuid, uuid, text) from public;
revoke all on function public.leave_garden(uuid) from public;
grant execute on function public.list_garden_members(uuid) to authenticated;
grant execute on function public.manage_garden_member(uuid, uuid, text) to authenticated;
grant execute on function public.leave_garden(uuid) to authenticated;
