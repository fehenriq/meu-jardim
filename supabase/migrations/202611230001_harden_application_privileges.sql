-- 06A.2.6A: hardening incremental de grants e ACLs do aplicativo.
-- Não altera RLS, corpos de funções, triggers, Storage, owners ou dados.

-- Remove grants automáticos e grants por coluna dos objetos do aplicativo.
revoke all privileges on table
  public.profiles,
  public.gardens,
  public.garden_members,
  public.plants,
  public.care_schedules,
  public.care_events,
  public.pending_care_schedules,
  public.growth_entries,
  public.plant_photos,
  public.garden_invites
from public, anon, authenticated;

-- Leitura legítima. garden_invites permanece exclusivamente por coluna.
grant select on table
  public.profiles,
  public.gardens,
  public.garden_members,
  public.plants,
  public.care_schedules,
  public.care_events,
  public.pending_care_schedules,
  public.growth_entries,
  public.plant_photos
to authenticated;

grant select (
  id, garden_id, role, expires_at, created_by,
  accepted_at, accepted_by, revoked_at, created_at
) on table public.garden_invites to authenticated;

-- Escrita legítima por coluna, recomposta das sete migrations anteriores.
grant update (display_name, avatar_path)
on table public.profiles to authenticated;

grant update (name, timezone)
on table public.gardens to authenticated;

grant insert (
  garden_id, nickname, species, main_photo_path, location, acquired_at,
  origin, light_exposure, pot_soil_notes, notes, status
) on table public.plants to authenticated;
grant update (
  nickname, species, main_photo_path, location, acquired_at,
  origin, light_exposure, pot_soil_notes, notes, status
) on table public.plants to authenticated;

grant insert (
  plant_id, care_type, custom_title, interval_days,
  next_due_date, active, settings
) on table public.care_schedules to authenticated;
grant update (
  care_type, custom_title, interval_days,
  next_due_date, active, settings
) on table public.care_schedules to authenticated;

grant insert (plant_id, observed_at, height_cm, leaf_count, notes)
on table public.growth_entries to authenticated;
grant update (observed_at, height_cm, leaf_count, notes)
on table public.growth_entries to authenticated;

grant insert (plant_id, growth_entry_id, storage_path, taken_at)
on table public.plant_photos to authenticated;
grant update (growth_entry_id, taken_at)
on table public.plant_photos to authenticated;

-- Fecha as ACLs das 14 RPCs e das oito funções auxiliares pelas assinaturas exatas.
revoke all privileges on function public.ensure_profile() from public, anon, authenticated;
revoke all privileges on function public.is_garden_member(uuid) from public, anon, authenticated;
revoke all privileges on function public.is_garden_admin(uuid) from public, anon, authenticated;
revoke all privileges on function public.create_garden(text, text) from public, anon, authenticated;
revoke all privileges on function public.can_access_plant_photo(text) from public, anon, authenticated;
revoke all privileges on function public.record_care_action(uuid, uuid, text, uuid, timestamptz, text, integer) from public, anon, authenticated;
revoke all privileges on function public.list_garden_authors(uuid) from public, anon, authenticated;
revoke all privileges on function public.create_garden_invite(uuid) from public, anon, authenticated;
revoke all privileges on function public.inspect_garden_invite(text) from public, anon, authenticated;
revoke all privileges on function public.accept_garden_invite(text) from public, anon, authenticated;
revoke all privileges on function public.revoke_garden_invite(uuid) from public, anon, authenticated;
revoke all privileges on function public.list_garden_members(uuid) from public, anon, authenticated;
revoke all privileges on function public.manage_garden_member(uuid, uuid, text) from public, anon, authenticated;
revoke all privileges on function public.leave_garden(uuid) from public, anon, authenticated;

revoke all privileges on function public.set_updated_at() from public, anon, authenticated;
revoke all privileges on function public.handle_new_user() from public, anon, authenticated;
revoke all privileges on function public.prevent_last_garden_admin() from public, anon, authenticated;
revoke all privileges on function public.prepare_plant_write() from public, anon, authenticated;
revoke all privileges on function public.prepare_care_schedule_write() from public, anon, authenticated;
revoke all privileges on function public.prepare_growth_entry_write() from public, anon, authenticated;
revoke all privileges on function public.prepare_plant_photo_write() from public, anon, authenticated;
revoke all privileges on function public.validate_garden_timezone() from public, anon, authenticated;

grant execute on function public.ensure_profile() to authenticated;
grant execute on function public.is_garden_member(uuid) to authenticated;
grant execute on function public.is_garden_admin(uuid) to authenticated;
grant execute on function public.create_garden(text, text) to authenticated;
grant execute on function public.can_access_plant_photo(text) to authenticated;
grant execute on function public.record_care_action(uuid, uuid, text, uuid, timestamptz, text, integer) to authenticated;
grant execute on function public.list_garden_authors(uuid) to authenticated;
grant execute on function public.create_garden_invite(uuid) to authenticated;
grant execute on function public.inspect_garden_invite(text) to anon, authenticated;
grant execute on function public.accept_garden_invite(text) to authenticated;
grant execute on function public.revoke_garden_invite(uuid) to authenticated;
grant execute on function public.list_garden_members(uuid) to authenticated;
grant execute on function public.manage_garden_member(uuid, uuid, text) to authenticated;
grant execute on function public.leave_garden(uuid) to authenticated;

-- Evita que objetos futuros criados por postgres no public repitam os grants.
-- O EXECUTE global padrão de PUBLIC não é alterado nesta entrega: o efeito
-- alcançaria funções de todos os schemas criadas por postgres. Migrations futuras
-- devem revogar PUBLIC, anon e authenticated pela assinatura na mesma transação.
alter default privileges for role postgres in schema public
  revoke all privileges on tables from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all privileges on sequences from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;

-- Defaults de supabase_admin são gerenciados pela plataforma e permanecem intactos.
