# Meu Jardim — 06A.2.6: validação manual do catálogo remoto

## Escopo e estado

Este roteiro prepara uma inspeção exclusivamente estrutural do projeto `meu-jardim-homolog`, Project ID `gmbwavdzfljvfdvnroiz`. Nenhuma consulta remota foi executada durante a preparação. Confirme visualmente o nome e o Project ID no Dashboard antes de abrir o SQL Editor; o banco não oferece esse Project ID como uma propriedade confiável do catálogo consultado.

O arquivo executável é `docs/audits/06A2-catalog-readonly.sql`. Ele contém somente blocos compostos por `SELECT`; neste fechamento devem ser executados apenas os blocos complementares 9 a 14. Eles usam agregações para limitar linhas e inventariam privilégios efetivos, origem das ACLs, default privileges, schema, atributos e memberships. Não há DDL, DML, chamada de RPC de negócio, `EXPLAIN ANALYZE`, lock, transação de escrita ou leitura de linhas de negócio.

Esta etapa não executa os 71 cenários A/B/C, não comprova RLS comportamental, não encerra SEC-06A-004 e mantém **NO-GO** para abertura pública como SaaS.

## Compatibilidade PostgreSQL/Supabase

As consultas usam interfaces disponíveis no PostgreSQL distribuído pelo Supabase: `pg_catalog.pg_class`, `pg_namespace`, `pg_policies`, `pg_proc`, `pg_constraint`, `pg_indexes`, `information_schema.table_privileges`, `column_privileges` e `triggers`, além de `storage.buckets`. `pg_get_userbyid`, `pg_get_function_identity_arguments`, `pg_get_constraintdef` e `has_function_privilege` são funções estáveis de inspeção.

`pending_care_schedules` depende de `security_invoker=true`, recurso de PostgreSQL 15 ou superior. O bloco 0 registra a versão. Versão inferior a 15 ou ausência dessa opção é divergência crítica. A consulta de constraints foi escrita sem casts de nomes de tabela para `regclass`, portanto uma tabela ausente aparece como ausência na matriz em vez de abortar o bloco.

`information_schema` mostra objetos visíveis ao papel do SQL Editor. Execute como o papel administrativo normal do projeto e registre o papel apenas como classificação sanitizada, por exemplo “SQL Editor autorizado”; não exporte nome de usuário/conexão. Grants do owner são esperados e devem ser separados de grants para `anon`, `authenticated` e `PUBLIC`.

## Procedimento manual

1. No Dashboard, confirme `meu-jardim-homolog` e `gmbwavdzfljvfdvnroiz`. Interrompa se qualquer valor divergir.
2. Abra o SQL Editor desse projeto. Não use produção e não cole credenciais no editor.
3. Abra `06A2-catalog-readonly.sql` localmente e execute somente os blocos 9 a 14, um por vez. Os blocos 0 a 8 não precisam ser repetidos.
4. Exporte o resultado de cada bloco separadamente, usando nomes como `06A2.6-block-09-effective-table-privileges.csv`.
5. Não execute o próximo bloco se o resultado atual indicar projeto incorreto, versão incompatível ou objeto crítico ausente.
6. Compare cada saída com os resultados esperados abaixo e preencha somente a coluna “Observado” de `06A2-catalog-comparison.md`.
7. Qualquer drift deve ser registrado e revisado; não o corrija durante a inspeção.

## Fechamento complementar — blocos 9 a 14

- **Bloco 9:** confirma os oito privilégios de tabela em PostgreSQL 17, incluindo `MAINTAIN`. Em PostgreSQL 15/16, `can_maintain` retorna `NULL` sem consultar um privilégio inexistente.
- **Bloco 10:** retorna uma linha por relação, papel e operação, com as colunas efetivas em array. Deve confirmar `garden_invites` sem `token_hash` e delimitar todas as escritas legítimas após a correção futura.
- **Bloco 11:** agrupa ACLs de tabela por relação e grantee, incluindo grantors, sem gerar uma linha por privilégio.
- **Bloco 12:** corrige o erro 42703 usando `ORDER BY function_signature` e agrega grantees/grantors por assinatura.
- **Bloco 13:** resume defaults por papel criador, escopo, tipo de objeto e grantee. O resultado esperado confirma os defaults já observados de `postgres` e `supabase_admin`; não autoriza alterar `supabase_admin`.
- **Bloco 14:** registra `rolinherit`, login, criação de roles/bancos, replication, `rolbypassrls`, USAGE/CREATE no schema e memberships efetivamente herdados. `anon` e `authenticated` não devem ter `BYPASSRLS`, `CREATE`, `CREATEROLE`, `CREATEDB` ou `REPLICATION`.

Esses seis blocos encerraram o inventário estrutural de privilégios. Eles não substituem os 71 cenários comportamentais.

## Validação futura da remediação 06A.2.6A

Após a aplicação da oitava migration em homologação, foi executado `06A2-grants-post-migration-check.sql`. Conforme confirmação do responsável, as consultas negativas retornaram zero linhas e a consulta agrupada de colunas coincidiu com a matriz do diagnóstico. Isso representa ausência das divergências enumeradas pelo SQL e preservação dos grants positivos esperados. O arquivo usa `grantee=0` e `aclexplode` para `PUBLIC`, sem passá-lo a `has_function_privilege` como se fosse um papel.

CAT-06A2-001, CAT-06A2-002 e CAT-06A2-003 estão corrigidos no ambiente de homologação. CAT-06A2-004 permanece parcialmente mitigado pelos riscos residuais de default privileges. Os 71 cenários comportamentais continuam **NÃO EXECUTADOS** e separados desta verificação estrutural.

## Bloco 0 — versão

**Esperado:** uma linha; PostgreSQL 15 ou superior, compatível com `security_invoker` em views.

**Divergência/risco:** versão inferior a 15; erro de permissão; saída incompatível com o projeto Supabase esperado. A versão não confirma o Project ID.

## Bloco 1 — relações, RLS e view

**Esperado:** 11 linhas: nove tabelas públicas (`profiles`, `gardens`, `garden_members`, `garden_invites`, `plants`, `care_schedules`, `care_events`, `growth_entries`, `plant_photos`), a view `pending_care_schedules` e `storage.objects`. As nove tabelas públicas devem ter `relkind='r'` e `relrowsecurity=true`. A view deve ter `relkind='v'` e `reloptions` contendo `security_invoker=true`. `storage.objects` deve existir e ter RLS ativo como baseline do Supabase.

**Divergência/risco:** objeto ausente ou tipo diferente; RLS desabilitado; view sem `security_invoker=true`; owner inesperado, especialmente `anon` ou `authenticated`; objeto homônimo em schema inesperado.

## Bloco 2 — policies

**Esperado nas tabelas públicas:** 19 policies, todas permissivas e destinadas a `authenticated`:

- `profiles_select_own`, `profiles_update_own`;
- `gardens_select_member`, `gardens_update_admin`;
- `garden_members_select_fellow_members`;
- `garden_invites_select_admin`;
- `plants_select_garden_member`, `plants_insert_garden_member`, `plants_update_garden_member`;
- `care_schedules_select_garden_member`, `care_schedules_insert_garden_member`, `care_schedules_update_garden_member`;
- `care_events_select_garden_member`;
- `growth_entries_select_garden_member`, `growth_entries_insert_garden_member`, `growth_entries_update_garden_member`;
- `plant_photos_select_garden_member`, `plant_photos_insert_garden_member`, `plant_photos_update_garden_member`.

**Esperado em `storage.objects`:** seis policies: `plant_photos_select_member`, `plant_photos_insert_member`, `plant_photos_update_member`, `avatars_select_owner_or_fellow_member`, `avatars_insert_owner`, `avatars_update_owner`. Não há policy DELETE do aplicativo.

**Divergência/risco:** policy ausente; policy extra/legada, pois policies permissivas se combinam por OR; papel incluindo `anon` ou `PUBLIC` fora da inspeção de convite; `USING`/`WITH CHECK` mais amplo; policy DELETE; policy de Storage sem restrição explícita do `bucket_id`.

## Blocos 3A e 3B — grants

**Esperado para `authenticated`:** SELECT nas tabelas públicas; `garden_members` e `care_events` somente SELECT direto; `pending_care_schedules` somente SELECT; `garden_invites` SELECT sem `token_hash`; escrita de `profiles`, `gardens`, `plants`, `care_schedules`, `growth_entries` e `plant_photos` limitada às colunas declaradas nas migrations. Não há INSERT/UPDATE/DELETE direto em `garden_members`, `care_events` ou `garden_invites`, nem DELETE cliente nas tabelas de negócio. `anon` não recebe grant nas tabelas públicas.

Grants do owner e grants de infraestrutura do Supabase em `storage.objects` podem existir; devem ser classificados separadamente. Eles não substituem a análise das policies.

**Divergência/risco:** grant de tabela que contorne limitação por coluna; `token_hash` legível por `authenticated`; escrita direta em memberships, eventos ou convites; qualquer DELETE cliente; grant a `anon`/`PUBLIC`; `WITH GRANT OPTION` para papéis clientes; papel desconhecido com acesso a objetos do aplicativo.

## Bloco 4 — funções e ACLs

**Esperado:** as RPCs expostas `ensure_profile`, `is_garden_member`, `is_garden_admin`, `create_garden`, `can_access_plant_photo`, `record_care_action`, `list_garden_authors`, `create_garden_invite`, `inspect_garden_invite`, `accept_garden_invite`, `revoke_garden_invite`, `list_garden_members`, `manage_garden_member` e `leave_garden`, sem overloads extras. Todas são `SECURITY DEFINER`; as funções de leitura declaradas nas migrations são stable; `proconfig` deve conter `search_path=""`.

`public_execute` deve ser falso para essas RPCs. `authenticated_execute` deve ser verdadeiro para todas. `anon_execute` deve ser verdadeiro somente para `inspect_garden_invite(text)` entre as RPCs expostas.

Também são esperadas funções auxiliares/triggers: `set_updated_at`, `handle_new_user`, `prevent_last_garden_admin`, `prepare_plant_write`, `prepare_care_schedule_write`, `prepare_growth_entry_write`, `prepare_plant_photo_write` e `validate_garden_timezone`. As migrations iniciais não revogam explicitamente `PUBLIC` de algumas funções trigger; se `public_execute=true`, registre o risco residual já descrito na auditoria, sem corrigi-lo nesta etapa.

**Divergência/risco:** overload inesperado; RPC exposta com `public_execute=true`; `anon_execute=true` fora de `inspect_garden_invite`; função DEFINER sem `search_path=""`; owner não confiável; função crítica como INVOKER; ACL ausente para `authenticated`; função desconhecida no schema `public`.

## Bloco 5 — constraints

**Esperado:** PK/FK/UNIQUE/CHECK coerentes com as migrations. Verificações críticas incluem PK composta de `garden_members`; `UNIQUE(id,garden_id)` de `plants`; FKs compostas de agendas/eventos/crescimento/fotos; unicidade `(garden_id,actor_id,request_id)` em `care_events`; `UNIQUE(id,garden_id,plant_id)` em `growth_entries`; `storage_path` e `token_hash` únicos; papel de convite fixo `member`; validade e estados terminais dos convites; checks de status, limites e conteúdo dos recursos.

**Divergência/risco:** FK composta ausente; constraint de ownership/escopo ausente; unique de idempotência ausente; check mais permissivo; `ON DELETE` diferente; constraint extra que indique drift não revisado.

## Bloco 6 — triggers

**Esperado:** `profiles_set_updated_at`, `gardens_set_updated_at`, `on_auth_user_created`, `garden_members_keep_admin`, `plants_prepare_write`, `plants_set_updated_at`, `care_schedules_set_updated_at`, `care_schedules_prepare_write`, `growth_entries_prepare_write`, `plant_photos_prepare_write` e `gardens_validate_settings`. Um trigger que cobre INSERT e UPDATE pode aparecer em duas linhas no `information_schema.triggers`.

**Divergência/risco:** trigger ausente, desviado para outra função, timing/evento diferente, trigger extra de origem desconhecida. Triggers gerenciados pelo Supabase em `auth.users` devem ser distinguidos de `on_auth_user_created` antes de classificar drift.

## Bloco 7 — índices

**Esperado:** índices automáticos de PK/UNIQUE e 17 índices explícitos: `garden_members_user_id_idx`, `gardens_created_by_idx`, três `plants_*`, cinco `care_*`, cinco `growth_entries_*`/`plant_photos_*` e dois `garden_invites_*`. Definições parciais devem preservar os predicados declarados.

**Divergência/risco:** índice de PK/UNIQUE ausente; índice explícito ausente; definição/ordem/predicado divergente; índice extra não explicado. Índice ausente é primariamente risco de desempenho, mas unique ausente também é risco de integridade/segurança.

## Bloco 8 — buckets

**Esperado:** duas linhas, `avatars` e `plant-photos`; `public=false`; `file_size_limit=5242880`; MIME types `image/jpeg`, `image/png`, `image/webp`.

**Divergência/risco:** bucket ausente ou público; tamanho maior/sem limite; MIME adicional; nome/ID divergente. O bloco não lista objetos nem prova policies de acesso.

## Exportação sanitizada

Exporte apenas as grades dos blocos em CSV ou copie-as para arquivos locais de evidência aprovados. Não use “download all data” do projeto. Antes de compartilhar:

- remova nomes de usuário/owner se a política da equipe os considerar identificadores internos, preservando apenas uma classificação como `trusted_migration_owner`;
- não inclua connection string, host com credenciais, headers, cookies, chaves, JWTs, tokens, senhas ou conteúdo do SQL Editor fora dos resultados;
- não consulte nem exporte linhas de `auth.users`, `storage.objects` ou tabelas de negócio;
- não inclua nomes, e-mails, UUIDs de usuários, paths de objetos, tokens/hashes de convite ou signed URLs;
- preserve nomes de objetos, policies, funções, constraints e índices, pois são a evidência estrutural necessária;
- registre data, commit `79812b300cb4de8a0d672f3c6a28a62ee1da4be0`, projeto mascarado se a evidência sair da equipe e o número do bloco.

Se uma mensagem de erro contiver detalhes de infraestrutura, registre somente bloco, código/classe do erro e uma descrição sanitizada. Não cole o erro bruto no relatório.
