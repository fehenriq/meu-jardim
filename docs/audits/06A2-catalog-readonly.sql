-- Meu Jardim 06A.2.6 — inventário somente leitura do catálogo remoto.
-- Projeto autorizado: meu-jardim-homolog (gmbwavdzfljvfdvnroiz).
-- Execute um bloco por vez no SQL Editor. Não execute em produção.
-- Estes SELECTs não provam isolamento RLS comportamental.

-- BLOCO 0 — compatibilidade do servidor (não identifica o Project ID).
select current_setting('server_version') as server_version;

-- BLOCO 1 — relações, RLS, owners e opção security_invoker da view.
select n.nspname as schema_name, c.relname, c.relkind,
       pg_get_userbyid(c.relowner) as owner,
       c.relrowsecurity, c.relforcerowsecurity, c.reloptions
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public', 'storage')
  and c.relname in (
    'profiles','gardens','garden_members','garden_invites','plants',
    'care_schedules','care_events','growth_entries','plant_photos',
    'pending_care_schedules','objects'
  )
order by n.nspname, c.relname;

-- BLOCO 2 — policies RLS efetivas, incluindo policies extras combináveis por OR.
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_catalog.pg_policies
where (schemaname = 'public' and tablename in (
         'profiles','gardens','garden_members','garden_invites','plants',
         'care_schedules','care_events','growth_entries','plant_photos'
       ))
   or (schemaname = 'storage' and tablename = 'objects')
order by schemaname, tablename, cmd, policyname;

-- BLOCO 3A — grants de tabela/view. Grants do owner são esperados e devem ser
-- separados dos grants concedidos a anon, authenticated ou PUBLIC.
select grantor, grantee, table_schema, table_name, privilege_type, is_grantable
from information_schema.table_privileges
where (table_schema = 'public' and table_name in (
         'profiles','gardens','garden_members','garden_invites','plants',
         'care_schedules','care_events','growth_entries','plant_photos',
         'pending_care_schedules'
       ))
   or (table_schema = 'storage' and table_name = 'objects')
order by table_schema, table_name, grantee, privilege_type;

-- BLOCO 3B — grants por coluna nas tabelas públicas do aplicativo.
select grantor, grantee, table_schema, table_name, column_name, privilege_type, is_grantable
from information_schema.column_privileges
where table_schema = 'public'
  and table_name in (
    'profiles','gardens','garden_members','garden_invites','plants',
    'care_schedules','care_events','growth_entries','plant_photos'
  )
order by table_name, grantee, privilege_type, column_name;

-- BLOCO 4 — funções, overloads, owners, SECURITY DEFINER, search_path e ACL.
select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args,
       pg_get_userbyid(p.proowner) as owner, p.prosecdef,
       p.provolatile, p.proconfig, p.proacl,
       has_function_privilege('public', p.oid, 'EXECUTE') as public_execute,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by p.proname, args;

-- BLOCO 5 — PKs, FKs, UNIQUEs e CHECKs das tabelas do aplicativo.
select n.nspname || '.' || r.relname as relation, c.conname, c.contype,
       pg_get_constraintdef(c.oid) as definition
from pg_catalog.pg_constraint c
join pg_catalog.pg_class r on r.oid = c.conrelid
join pg_catalog.pg_namespace n on n.oid = r.relnamespace
where n.nspname = 'public'
  and r.relname in (
    'profiles','gardens','garden_members','garden_invites','plants',
    'care_schedules','care_events','growth_entries','plant_photos'
  )
order by n.nspname, r.relname, c.conname;

-- BLOCO 6 — triggers não internos do aplicativo e de auth.users.
select event_object_schema, event_object_table, trigger_name,
       action_timing, event_manipulation, action_statement
from information_schema.triggers
where (event_object_schema = 'public' and event_object_table in (
         'profiles','gardens','garden_members','plants','care_schedules',
         'growth_entries','plant_photos'
       ))
   or (event_object_schema = 'auth' and event_object_table = 'users')
order by event_object_schema, event_object_table, trigger_name, event_manipulation;

-- BLOCO 7 — índices declarados e índices automáticos de PK/UNIQUE.
select schemaname, tablename, indexname, indexdef
from pg_catalog.pg_indexes
where schemaname = 'public'
  and tablename in (
    'profiles','gardens','garden_members','garden_invites','plants',
    'care_schedules','care_events','growth_entries','plant_photos'
  )
order by tablename, indexname;

-- BLOCO 8 — configuração dos buckets, sem consultar storage.objects.
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id in ('plant-photos', 'avatars')
order by id;

-- BLOCO 9 — fechamento compacto dos privilégios efetivos de tabela.
-- MAINTAIN existe desde PostgreSQL 17; o CASE evita consultá-lo no 15/16.
with roles(role_name) as (values ('anon'), ('authenticated')),
relations as (
  select c.oid, n.nspname, c.relname
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in ('profiles','gardens','garden_members','garden_invites','plants','care_schedules','care_events','growth_entries','plant_photos','pending_care_schedules')
)
select r.role_name, x.nspname as schema_name, x.relname,
       has_table_privilege(r.role_name, x.oid, 'SELECT') as can_select,
       has_table_privilege(r.role_name, x.oid, 'INSERT') as can_insert,
       has_table_privilege(r.role_name, x.oid, 'UPDATE') as can_update,
       has_table_privilege(r.role_name, x.oid, 'DELETE') as can_delete,
       has_table_privilege(r.role_name, x.oid, 'TRUNCATE') as can_truncate,
       has_table_privilege(r.role_name, x.oid, 'REFERENCES') as can_reference,
       has_table_privilege(r.role_name, x.oid, 'TRIGGER') as can_trigger,
       case when current_setting('server_version_num')::integer >= 170000
         then has_table_privilege(r.role_name, x.oid, 'MAINTAIN')
         else null end as can_maintain
from roles r cross join relations x
order by x.relname, r.role_name;

-- BLOCO 10 — grants efetivos por coluna agrupados para evitar truncamento.
-- Uma linha por relação/papel/operação; arrays vazios não são emitidos.
with roles(role_name) as (values ('anon'), ('authenticated')),
privileges(privilege_type) as (values ('SELECT'), ('INSERT'), ('UPDATE'), ('REFERENCES'))
select r.role_name, c.relname, p.privilege_type,
       array_agg(a.attname order by a.attnum) filter (
         where has_column_privilege(r.role_name, c.oid, a.attnum, p.privilege_type)
       ) as effective_columns
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
join pg_catalog.pg_attribute a on a.attrelid = c.oid
cross join roles r cross join privileges p
where n.nspname = 'public'
  and c.relname in ('profiles','gardens','garden_members','garden_invites','plants','care_schedules','care_events','growth_entries','plant_photos')
  and a.attnum > 0 and not a.attisdropped
group by r.role_name, c.oid, c.relname, p.privilege_type
having count(*) filter (
  where has_column_privilege(r.role_name, c.oid, a.attnum, p.privilege_type)
) > 0
order by c.relname, r.role_name, p.privilege_type;

-- BLOCO 11 — ACLs de tabela agrupadas por relação e grantee.
select c.relname,
       case when a.grantee = 0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end as grantee,
       array_agg(a.privilege_type order by a.privilege_type) as privileges,
       bool_or(a.is_grantable) as any_grantable,
       array_agg(distinct pg_get_userbyid(a.grantor) order by pg_get_userbyid(a.grantor)) as grantors
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
where n.nspname = 'public'
  and c.relname in ('profiles','gardens','garden_members','garden_invites','plants','care_schedules','care_events','growth_entries','plant_photos','pending_care_schedules')
  and (a.grantee = 0 or pg_get_userbyid(a.grantee) in ('anon','authenticated'))
group by c.relname, a.grantee
order by c.relname, grantee;

-- BLOCO 12 — ACLs compactas das funções. ORDER BY usa o alias diretamente.
select p.oid::regprocedure as function_signature, p.prorettype::regtype as return_type,
       p.prosecdef,
       bool_or(a.grantee = 0 and a.privilege_type = 'EXECUTE') as public_execute,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
       array_agg(distinct case when a.grantee = 0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end
                 order by case when a.grantee = 0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end) as acl_grantees,
       bool_or(a.is_grantable) as any_grantable,
       array_agg(distinct pg_get_userbyid(a.grantor) order by pg_get_userbyid(a.grantor)) as grantors
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
where n.nspname = 'public'
  and p.proname in (
    'ensure_profile','is_garden_member','is_garden_admin','create_garden','can_access_plant_photo','record_care_action','list_garden_authors',
    'create_garden_invite','inspect_garden_invite','accept_garden_invite','revoke_garden_invite','list_garden_members','manage_garden_member','leave_garden',
    'set_updated_at','handle_new_user','prevent_last_garden_admin','prepare_plant_write','prepare_care_schedule_write','prepare_growth_entry_write','prepare_plant_photo_write','validate_garden_timezone'
  )
group by p.oid, p.prorettype, p.prosecdef
order by function_signature;

-- BLOCO 13 — default privileges agrupados por owner, escopo, tipo e grantee.
select pg_get_userbyid(d.defaclrole) as creator_role,
       coalesce(n.nspname, '<global>') as schema_scope,
       case d.defaclobjtype when 'r' then 'tables' when 'S' then 'sequences' when 'f' then 'functions' when 'T' then 'types' when 'n' then 'schemas' else d.defaclobjtype::text end as object_type,
       case when a.grantee = 0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end as grantee,
       array_agg(a.privilege_type order by a.privilege_type) as privileges,
       bool_or(a.is_grantable) as any_grantable
from pg_catalog.pg_default_acl d
left join pg_catalog.pg_namespace n on n.oid = d.defaclnamespace
cross join lateral aclexplode(d.defaclacl) a
where (d.defaclnamespace = 0 or n.nspname = 'public')
  and (a.grantee = 0 or pg_get_userbyid(a.grantee) in ('anon','authenticated'))
group by d.defaclrole, n.nspname, d.defaclnamespace, d.defaclobjtype, a.grantee
order by creator_role, schema_scope, object_type, grantee;

-- BLOCO 14 — atributos, schema e memberships efetivamente utilizáveis.
with clients as (
  select oid, rolname, rolinherit, rolcanlogin, rolcreaterole, rolcreatedb,
         rolreplication, rolbypassrls
  from pg_catalog.pg_roles
  where rolname in ('anon', 'authenticated')
), inherited as (
  select c.oid,
         coalesce(array_agg(r.rolname order by r.rolname) filter (
           where r.oid <> c.oid and pg_has_role(c.oid, r.oid, 'USAGE')
         ), array[]::name[]) as effective_memberships
  from clients c cross join pg_catalog.pg_roles r
  group by c.oid
)
select c.rolname, c.rolinherit, c.rolcanlogin, c.rolcreaterole,
       c.rolcreatedb, c.rolreplication, c.rolbypassrls,
       has_schema_privilege(c.oid, 'public', 'USAGE') as public_usage,
       has_schema_privilege(c.oid, 'public', 'CREATE') as public_create,
       i.effective_memberships
from clients c join inherited i using (oid)
order by c.rolname;
