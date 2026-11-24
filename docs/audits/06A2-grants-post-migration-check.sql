-- 06A.2.6A — verificação somente leitura após aplicação da migration.
-- As consultas negativas devem retornar zero linhas; a matriz por coluna é positiva.
-- Resultado informado da homologação: matriz por coluna conforme; demais
-- consultas vazias. Isso representa ausência das divergências enumeradas aqui.

-- 1. Nenhum privilégio efetivo de tabela para anon nos objetos do aplicativo.
with relations as (
  select c.oid, c.relname
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in ('profiles','gardens','garden_members','plants','care_schedules','care_events','pending_care_schedules','growth_entries','plant_photos','garden_invites')
), privileges(privilege_type) as (
  values ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER'),('MAINTAIN')
)
select relname, privilege_type
from relations cross join privileges
where has_table_privilege('anon', oid, privilege_type);

-- 2. Nenhum privilégio administrativo ou escrita em nível de tabela para authenticated.
with relations as (
  select c.oid, c.relname
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in ('profiles','gardens','garden_members','plants','care_schedules','care_events','pending_care_schedules','growth_entries','plant_photos','garden_invites')
), forbidden(privilege_type) as (
  values ('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER'),('MAINTAIN')
)
select relname, privilege_type
from relations cross join forbidden
where has_table_privilege('authenticated', oid, privilege_type);

-- 2B. SELECT de tabela deve existir nos nove objetos abaixo; garden_invites é
-- validado separadamente porque usa SELECT por coluna.
with expected_select(relation_name) as (
  values ('profiles'),('gardens'),('garden_members'),('plants'),
         ('care_schedules'),('care_events'),('pending_care_schedules'),
         ('growth_entries'),('plant_photos')
)
select relation_name
from expected_select
where not has_table_privilege(
  'authenticated', format('public.%I', relation_name), 'SELECT'
);

-- 3. Grants por coluna efetivos: comparar com a matriz documental.
with privileges(privilege_type) as (values ('SELECT'),('INSERT'),('UPDATE'),('REFERENCES'))
select c.relname, p.privilege_type,
       array_agg(a.attname order by a.attnum) filter (
         where has_column_privilege('authenticated', c.oid, a.attnum, p.privilege_type)
       ) as effective_columns
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
join pg_catalog.pg_attribute a on a.attrelid = c.oid
cross join privileges p
where n.nspname = 'public'
  and c.relname in ('profiles','gardens','garden_members','plants','care_schedules','care_events','growth_entries','plant_photos','garden_invites')
  and a.attnum > 0 and not a.attisdropped
group by c.oid, c.relname, p.privilege_type
having count(*) filter (
  where has_column_privilege('authenticated', c.oid, a.attnum, p.privilege_type)
) > 0
order by c.relname, p.privilege_type;

-- 4. anon executa somente inspect_garden_invite(text); authenticated executa as 14 RPCs.
with expected(signature, anon_execute, authenticated_execute) as (
  values
    ('public.ensure_profile()'::regprocedure, false, true),
    ('public.is_garden_member(uuid)'::regprocedure, false, true),
    ('public.is_garden_admin(uuid)'::regprocedure, false, true),
    ('public.create_garden(text,text)'::regprocedure, false, true),
    ('public.can_access_plant_photo(text)'::regprocedure, false, true),
    ('public.record_care_action(uuid,uuid,text,uuid,timestamptz,text,integer)'::regprocedure, false, true),
    ('public.list_garden_authors(uuid)'::regprocedure, false, true),
    ('public.create_garden_invite(uuid)'::regprocedure, false, true),
    ('public.inspect_garden_invite(text)'::regprocedure, true, true),
    ('public.accept_garden_invite(text)'::regprocedure, false, true),
    ('public.revoke_garden_invite(uuid)'::regprocedure, false, true),
    ('public.list_garden_members(uuid)'::regprocedure, false, true),
    ('public.manage_garden_member(uuid,uuid,text)'::regprocedure, false, true),
    ('public.leave_garden(uuid)'::regprocedure, false, true)
)
select signature, anon_execute, authenticated_execute
from expected
where has_function_privilege('anon', signature, 'EXECUTE') <> anon_execute
   or has_function_privilege('authenticated', signature, 'EXECUTE') <> authenticated_execute;

-- 5. Auxiliares sem EXECUTE cliente e nenhuma das 22 funções com ACL de PUBLIC.
with auxiliary(signature) as (
  values
    ('public.set_updated_at()'::regprocedure),
    ('public.handle_new_user()'::regprocedure),
    ('public.prevent_last_garden_admin()'::regprocedure),
    ('public.prepare_plant_write()'::regprocedure),
    ('public.prepare_care_schedule_write()'::regprocedure),
    ('public.prepare_growth_entry_write()'::regprocedure),
    ('public.prepare_plant_photo_write()'::regprocedure),
    ('public.validate_garden_timezone()'::regprocedure)
)
select signature
from auxiliary
where has_function_privilege('anon', signature, 'EXECUTE')
   or has_function_privilege('authenticated', signature, 'EXECUTE');

select p.oid::regprocedure as function_signature
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
where n.nspname = 'public'
  and p.proname in ('ensure_profile','is_garden_member','is_garden_admin','create_garden','can_access_plant_photo','record_care_action','list_garden_authors','create_garden_invite','inspect_garden_invite','accept_garden_invite','revoke_garden_invite','list_garden_members','manage_garden_member','leave_garden','set_updated_at','handle_new_user','prevent_last_garden_admin','prepare_plant_write','prepare_care_schedule_write','prepare_growth_entry_write','prepare_plant_photo_write','validate_garden_timezone')
  and a.grantee = 0
  and a.privilege_type = 'EXECUTE'
order by function_signature;
