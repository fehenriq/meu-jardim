create or replace function public.validate_garden_timezone()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.name := btrim(new.name);
  new.timezone := btrim(new.timezone);
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'invalid IANA timezone' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger gardens_validate_settings
before insert or update of name, timezone on public.gardens
for each row execute function public.validate_garden_timezone();

create or replace function public.list_garden_authors(target_garden_id uuid)
returns table (user_id uuid, display_name text, avatar_path text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.display_name, p.avatar_path
  from public.garden_members viewer
  join public.garden_members member on member.garden_id = viewer.garden_id
  join public.profiles p on p.id = member.user_id
  where viewer.garden_id = target_garden_id
    and viewer.user_id = auth.uid();
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "avatars_select_owner_or_fellow_member"
on storage.objects for select to authenticated
using (
  bucket_id = 'avatars'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1 from public.garden_members viewer
      join public.garden_members owner on owner.garden_id = viewer.garden_id
      where viewer.user_id = auth.uid()
        and owner.user_id::text = (storage.foldername(name))[1]
    )
  )
);

create policy "avatars_insert_owner"
on storage.objects for insert to authenticated
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_update_owner"
on storage.objects for update to authenticated
using (bucket_id = 'avatars' and owner_id = auth.uid()::text)
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

revoke all on function public.list_garden_authors(uuid) from public;
grant execute on function public.list_garden_authors(uuid) to authenticated;
revoke all on function public.validate_garden_timezone() from public;
