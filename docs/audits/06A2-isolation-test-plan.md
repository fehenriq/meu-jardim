# Meu Jardim — 06A.2: plano de homologação de isolamento

## Estado e limites

Este documento prepara a homologação dinâmica dos controles descritos em `06A-security-audit.md`. Nenhum caso remoto foi executado nesta fase. O resultado da 06A.2 permanece **NÃO EXECUTADO** e a abertura pública permanece **NO-GO**.

A execução exige autorização posterior, projeto Supabase separado de homologação e três contas dedicadas. Não usar produção, dados familiares reais, `service_role`, secret key, SQL Editor privilegiado, sessão `postgres` ou credenciais de CI. A chave `anon` é pública por desenho; os controles devem ser exercitados com sessões reais de `anon` e `authenticated`.

Os testes de concorrência e idempotência ampliados pertencem à 06B. Esta entrega cobre somente os comportamentos explicitamente listados e não corrige achados.

## Evidência e classificação

| Nível | O que demonstra | Limite |
|---|---|---|
| Estrutural | Migration declara tabela, constraint, grant, policy, função ou bucket | Não demonstra que o remoto coincide |
| Contratual | Teste local verifica texto da migration ou comportamento mockado | Não executa PostgreSQL, RLS, Storage ou locks reais |
| Comportamental | Sessão real A, B, C ou anônima executa operação no projeto autorizado | Válido somente para o projeto, catálogo e instante registrados |

Cada caso deve receber exatamente um estado:

- **APROVADO:** controles positivo e negativo produziram o resultado esperado e a integridade final foi confirmada.
- **REPROVADO:** houve acesso, mutação ou exposição incompatível com o contrato.
- **BLOQUEADO:** pré-condição válida não pôde ser satisfeita ou infraestrutura impediu a prova.
- **NÃO EXECUTADO:** nenhuma tentativa remota foi feita.

Status HTTP isolado nunca comprova autorização. Um `200` com zero linhas pode ser a negativa correta; erro de sessão, ID inexistente ou filtro incorreto também pode produzir vazio. Todo negativo requer controle positivo e verificação final por ator autorizado.

## Portão obrigatório antes da execução remota

O responsável deve confirmar por escrito:

- nome e finalidade do ambiente: homologação descartável;
- URL do projeto e `project ref`, comparados entre si;
- autorização para criar e alterar somente as fixtures deste roteiro;
- ausência de dados reais no projeto ou separação inequívoca das fixtures;
- três contas dedicadas A, B e C, sem reutilizar contas familiares;
- escopo de limpeza manual posterior;
- janela de execução e responsável por interromper o teste.

Falhar fechado se qualquer item faltar. Antes da primeira escrita, registrar somente o host sanitizado, o `project ref`, a data, o commit testado e o prefixo da rodada. Nunca registrar chave, senha, JWT, refresh token, token de convite ou URL assinada.

## Preparação local

Use o commit a ser homologado e confirme worktree limpo ou alterações conhecidas:

```powershell
node --version
npm.cmd --version
git status --short --branch
git rev-parse HEAD
npm.cmd ci
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
git diff --check
```

Configure localmente apenas `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` em `.env.local`, que é ignorado pelo Git. Confirme que a URL pertence ao projeto autorizado. Não copie o arquivo para evidências.

Inicie a aplicação somente durante a janela aprovada:

```powershell
npm.cmd run dev
```

Abra três perfis independentes do navegador, sem compartilhar cookies, localStorage, sessionStorage ou cache:

- Perfil A: conta A, administradora do Jardim A.
- Perfil B: conta B, membro do Jardim A.
- Perfil C: conta C, administradora do Jardim B e sem membership no Jardim A.

Use uma quarta janela privada sem login para os casos anônimos. Em cada perfil autenticado, confirme o usuário pela interface. Não capture nem imprima `getSession()`.

## Prefixo, fixtures e allowlist

Escolha um identificador sem dados pessoais, por exemplo `MJ06A2-20261123-R1`. Todos os nomes e notas sintéticos devem começar por esse prefixo.

Criação manual pela interface:

1. A cria `MJ06A2-...-JARDIM-A`.
2. A gera convite e o entrega a B fora do relatório; o token não pode ser copiado para evidência.
3. B aceita e aparece como `member` no Jardim A.
4. C cria `MJ06A2-...-JARDIM-B`.
5. A cria planta A1; C cria planta B1.
6. A e C criam uma rotina, um evento de cuidado, uma entrada de crescimento, uma foto de planta e um avatar sintético.
7. A cria convites próprios separados para os estados pendente, revogado, usado e membro existente. Expirado exige fixture preparada manualmente de forma autorizada; não alterar relógio, migration ou dado real.

Preencha a tabela local de controle sem segredos. UUIDs podem aparecer de forma mascarada nas evidências, mas a allowlist operacional deve conter os valores completos somente durante a execução.

| Chave | Valor esperado |
|---|---|
| `RUN_PREFIX` | `MJ06A2-...` |
| `PROJECT_REF` | projeto autorizado |
| `A_USER_ID`, `B_USER_ID`, `C_USER_ID` | contas dedicadas |
| `A_GARDEN_ID`, `B_GARDEN_ID` | jardins exclusivos |
| `A_PLANT_ID`, `B_PLANT_ID` | plantas sintéticas |
| `A_SCHEDULE_ID`, `B_SCHEDULE_ID` | rotinas sintéticas |
| `A_GROWTH_ID`, `B_GROWTH_ID` | entradas sintéticas |
| `A_PHOTO_ID`, `B_PHOTO_ID` | metadados sintéticos |
| `A_PHOTO_PATH`, `B_PHOTO_PATH` | objetos sintéticos |
| `A_AVATAR_PATH`, `B_AVATAR_PATH`, `C_AVATAR_PATH` | avatares sintéticos |
| `A_INVITE_*_ID` | convites descartáveis por estado |

Antes de cada escrita, conferir que todos os IDs de destino estão na allowlist e que o nome/nota do recurso contém `RUN_PREFIX`. Se o alvo não puder ser confirmado por leitura autorizada, não escrever.

## Cliente direto e saída sanitizada

No ambiente local Vite, em cada perfil do navegador, importe o cliente que já carrega a sessão daquele perfil:

```js
const { supabase } = await import('/src/lib/supabase.ts')
const safe = (caseId, result) => ({
  case_id: caseId,
  http_status: result.status ?? null,
  row_count: Array.isArray(result.data) ? result.data.length : result.count ?? (result.data ? 1 : 0),
  has_data: Boolean(result.data),
  error_code: result.error?.code ?? null,
})
```

Não imprimir `result.data` quando contiver perfil, path, nome privado ou URL. Para signed URL, registrar apenas `Boolean(result.data?.signedUrl)`. Para convite, registrar apenas estado e presença/ausência de `garden_name`; nunca o token. Erros são registrados somente por `code` e status, sem mensagem bruta ou corpo.

## Inventário estrutural do checkout

### Tabelas e relacionamentos

| Tabela | Colunas relevantes | Escopo e integridade |
|---|---|---|
| `profiles` | `id`, `display_name`, `avatar_path`, timestamps | `id -> auth.users`; leitura/edição própria |
| `gardens` | `id`, `name`, `timezone`, `created_by`, timestamps | criador em `auth.users`; leitura de membro, configuração por admin |
| `garden_members` | `garden_id`, `user_id`, `role`, `joined_at` | PK composta; FKs para jardim/usuário; papel `admin/member` |
| `plants` | identificação, `garden_id`, atributos, `main_photo_path`, `status`, `created_by`, timestamps | `UNIQUE(id,garden_id)`; jardim/autoria imutáveis; sem DELETE cliente |
| `care_schedules` | `garden_id`, `plant_id`, tipo, intervalo, vencimento, settings, autoria | FK composta para planta; ownership derivado e imutável |
| `care_events` | `garden_id`, `plant_id`, `schedule_id`, evento, ator, `request_id`, metadata | FKs compostas; unicidade por jardim/ator/request; escrita via RPC |
| `growth_entries` | `garden_id`, `plant_id`, observação, medidas, notas, autoria | FK composta para planta; ownership derivado e imutável |
| `plant_photos` | `garden_id`, `plant_id`, `growth_entry_id`, `storage_path`, uploader | FKs compostas; path único; associação não pode ser removida/substituída |
| `garden_invites` | jardim, hash, papel, expiração, criador, aceite/revogação | somente hash SHA-256; papel fixo `member`; estados terminais |

`pending_care_schedules` é view `security_invoker = true` e deve herdar RLS das relações-base. O catálogo remoto precisa confirmar essa opção.

### RLS, grants e operações declaradas

| Recurso | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `profiles` | próprio perfil | sem grant | `display_name, avatar_path` próprios | sem grant |
| `gardens` | membros | via `create_garden` | `name, timezone` por admin | sem grant |
| `garden_members` | membros do mesmo jardim | via RPC/convite | via RPC | via RPC |
| `plants` | membro do jardim | membro, colunas permitidas | membro, colunas permitidas | sem grant/policy |
| `care_schedules` | membro | membro, campos permitidos | membro, campos permitidos | sem grant/policy |
| `care_events` | membro | via `record_care_action` | sem grant | sem grant |
| `growth_entries` | membro | membro, campos permitidos | membro, campos permitidos | sem grant/policy |
| `plant_photos` | membro | membro, campos permitidos | associação/data permitidas | sem grant/policy |
| `garden_invites` | admin, sem hash | via RPC | via RPC | sem grant |

Todas as tabelas acima declaram RLS habilitado. Policies permissivas da mesma operação combinam-se por OR; o catálogo remoto deve provar ausência de policies antigas ou adicionais.

### Funções expostas e autoridade

| Assinatura | Modo | Chamador declarado |
|---|---|---|
| `ensure_profile()` | `SECURITY DEFINER`, `search_path=''` | `authenticated` |
| `is_garden_member(uuid)` | stable, definer, `search_path=''` | `authenticated` |
| `is_garden_admin(uuid)` | stable, definer, `search_path=''` | `authenticated` |
| `create_garden(text,text)` | definer, `search_path=''` | `authenticated` |
| `can_access_plant_photo(text)` | stable, definer, `search_path=''` | `authenticated` |
| `record_care_action(uuid,uuid,text,uuid,timestamptz,text,integer)` | definer, `search_path=''` | `authenticated` |
| `list_garden_authors(uuid)` | stable, definer, `search_path=''` | `authenticated` |
| `create_garden_invite(uuid)` | definer, `search_path=''` | `authenticated` |
| `inspect_garden_invite(text)` | stable, definer, `search_path=''` | `anon`, `authenticated` |
| `accept_garden_invite(text)` | definer, `search_path=''` | `authenticated` |
| `revoke_garden_invite(uuid)` | definer, `search_path=''` | `authenticated` |
| `list_garden_members(uuid)` | stable, definer, `search_path=''` | `authenticated` |
| `manage_garden_member(uuid,uuid,text)` | definer, `search_path=''` | `authenticated` |
| `leave_garden(uuid)` | definer, `search_path=''` | `authenticated` |

As funções expostas acima revogam `PUBLIC`. Funções auxiliares de trigger devem ser conferidas no catálogo, inclusive owner e ACL.

### Storage

| Bucket | Público | Limite/MIME | Policies declaradas |
|---|---:|---|---|
| `plant-photos` | não | 5 MiB; JPEG/PNG/WebP | SELECT/INSERT/UPDATE com `can_access_plant_photo`; sem DELETE |
| `avatars` | não | 5 MiB; JPEG/PNG/WebP | SELECT dono/colega de jardim; INSERT próprio; UPDATE owner/path próprio; sem DELETE |

Paths esperados: `plant-photos` usa `<garden>/<plant>/<uuid>.<ext>`; frontend de avatar usa `<user>/<uuid>.<ext>`. A policy de avatar valida o primeiro segmento, mas `profiles.avatar_path` continua editável sem vínculo estrutural completo, conforme SEC-06A-003/007.

### Inspeção somente leitura do catálogo remoto

Executar manualmente no projeto autorizado para comparar o estado aplicado com as migrations. O SQL Editor/owner serve apenas para inventário; seu resultado não prova RLS de usuário final.

```sql
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

select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_catalog.pg_policies
where schemaname in ('public', 'storage')
order by schemaname, tablename, cmd, policyname;

select grantee, table_schema, table_name, privilege_type
from information_schema.role_table_grants
where table_schema in ('public', 'storage')
order by table_schema, table_name, grantee, privilege_type;

select grantee, table_schema, table_name, column_name, privilege_type
from information_schema.column_privileges
where table_schema = 'public'
order by table_name, grantee, privilege_type, column_name;

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

select conrelid::regclass as relation, conname, contype, pg_get_constraintdef(oid)
from pg_catalog.pg_constraint
where connamespace = 'public'::regnamespace
order by relation::text, conname;

select event_object_schema, event_object_table, trigger_name,
       action_timing, event_manipulation, action_statement
from information_schema.triggers
where event_object_schema in ('public', 'auth')
order by event_object_schema, event_object_table, trigger_name, event_manipulation;

select schemaname, tablename, indexname, indexdef
from pg_catalog.pg_indexes
where schemaname = 'public'
order by tablename, indexname;

select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id in ('plant-photos', 'avatars')
order by id;
```

Exportar apenas estrutura sanitizada. Não exportar linhas de negócio, `auth.users`, `storage.objects`, secrets ou conteúdo dos buckets.

## Matriz resumida

| Grupo | Controle positivo | Controle negativo | Achados |
|---|---|---|---|
| Plantas | A/B leem e editam A; C lê B | C não lê/escreve A; A não cruza B; ownership imutável | SEC-06A-004 |
| Cuidados | A/B leem A e registram ação A | C não lê A nem usa IDs A em RPC | SEC-06A-004 |
| Crescimento | A/B leem/criam em A | C não referencia planta/entrada A | SEC-06A-004/008 |
| Storage | membros acessam objetos próprios | externo/path cruzado/anon falham | SEC-06A-004/007/008/009 |
| Perfis | ator lê/edita próprio perfil | perfil alheio falha; testar `avatar_path` arbitrário | SEC-06A-003/007 |
| Convites | admin A administra A; inspeção reduzida | B/C não administram A; estados inválidos neutros | SEC-06A-001/002/004 |
| Membros | A/B listam A; admin A administra fixture | B/C não administram A; escrita direta falha | SEC-06A-004 |
| Revogação | B acessa A antes da remoção | B perde servidor/novas URLs depois | SEC-06A-005/009 |
| Anônimo | inspeção de convite é exceção | tabelas, demais RPCs e Storage falham | SEC-06A-004 |
| Integridade | ator autorizado relê estado | negativas não alteram linha/objeto | SEC-06A-004 |

## Casos de teste

Os IDs abaixo são espelhados em `06A2-isolation-results.md`.

### Plantas

| ID | Ator/operação | Esperado e prova de integridade |
|---|---|---|
| PL-01 | A lista e lê A1 | linha encontrada; controle positivo |
| PL-02 | B lê e atualiza campo mutável de A1 | uma linha alterada; A confirma |
| PL-03 | C lista/lê A1 por IDs conhecidos | zero linhas ou negativa; A confirma existência |
| PL-04 | C insere planta com `garden_id=A` | negado; A confirma ausência pelo prefixo |
| PL-05 | C atualiza A1 | zero linhas/negado; A confirma valor original |
| PL-06 | A tenta mudar `garden_id`/`created_by` de A1 | coluna sem grant ou trigger nega; A confirma ownership |
| PL-07 | A/C tentam DELETE de fixture própria e alheia | negado por ausência de grant/policy; recursos permanecem |
| PL-08 | repetir PL-01 a PL-07 no sentido Jardim B -> atores A/B | mesmo isolamento bidirecional |

### Cuidados

| ID | Ator/operação | Esperado e prova de integridade |
|---|---|---|
| CA-01 | A/B listam rotina/evento de A1 | dados próprios encontrados |
| CA-02 | C lista `care_schedules`, `care_events` e view de A | zero linhas |
| CA-03 | C cria rotina usando `A_PLANT_ID` | RLS/FK/trigger nega; A confirma ausência |
| CA-04 | B atualiza campo permitido da rotina A | uma linha alterada; A confirma |
| CA-05 | B tenta trocar planta/jardim/autoria da rotina | grant/trigger nega; vínculo permanece |
| CA-06 | B chama `record_care_action` com IDs A válidos | evento criado; controle positivo |
| CA-07 | C chama RPC com jardim/planta/rotina A | `42501` ou negativa equivalente; A confirma nenhum evento |
| CA-08 | INSERT/UPDATE/DELETE direto em `care_events` | negado; histórico permanece |

### Crescimento

| ID | Ator/operação | Esperado e prova de integridade |
|---|---|---|
| GR-01 | A/B listam/criam entrada para A1 | permitido; autoria = ator real |
| GR-02 | C lista/cria entrada para A1 | vazio/negado; A confirma ausência |
| GR-03 | B tenta trocar `plant_id`, `garden_id` ou `created_by` | grant/trigger nega; vínculo permanece |
| GR-04 | A registra metadata de foto A em entrada A | permitido; controle positivo |
| GR-05 | C registra path/metadata para A1 | negado; A confirma ausência |
| GR-06 | A referencia entrada/planta/jardim cruzados | FK composta/trigger nega |
| GR-07 | A tenta substituir/remover associação de foto já vinculada | trigger nega; associação permanece |
| GR-08 | DELETE de entrada ou metadata por cliente | negado; histórico permanece |

### Storage

| ID | Ator/operação | Esperado e prova de integridade |
|---|---|---|
| ST-01 | A/B listam, baixam e assinam objeto A | permitido; registrar apenas booleanos/contagens |
| ST-02 | C lista, baixa ou assina `A_PHOTO_PATH` | zero/erro; não registrar URL |
| ST-03 | C faz upload em path de jardim/planta A | negado; A confirma objeto ausente |
| ST-04 | A usa path com jardim/planta divergente ou UUID inexistente | negado |
| ST-05 | A atualiza objeto descartável em path autorizado | permitido somente se previsto; confirmar conteúdo sintético |
| ST-06 | qualquer ator tenta DELETE em `plant-photos` | negado; objeto permanece |
| ST-07 | dono assina avatar próprio e colega do mesmo jardim assina | permitido conforme policy |
| ST-08 | C assina avatar de A sem jardim comum | negado |
| ST-09 | B faz upload em path cujo primeiro segmento é A | negado |
| ST-10 | UPDATE/DELETE de avatar fora do contrato | negado; objeto permanece |

### Perfis e configuração

| ID | Ator/operação | Esperado e prova de integridade |
|---|---|---|
| PF-01 | A lê e altera `display_name` próprio com prefixo | permitido |
| PF-02 | A lê/altera perfil B ou C | zero/negado; alvo confirma valor |
| PF-03 | B altera `avatar_path` próprio para path arbitrário conhecido | registrar comportamento observado; provável reprodução SEC-06A-003, sem corrigir |
| PF-04 | B aponta `avatar_path` para avatar A compartilhado | registrar se update passa e se signed URL é emitida; interromper após fixture sintética |
| PF-05 | B tenta alterar nome/timezone do Jardim A | negado; A confirma configuração |
| PF-06 | A altera configuração do Jardim A | permitido; restaurar valor da fixture |

### Convites

| ID | Ator/operação | Esperado e prova de integridade |
|---|---|---|
| IN-01 | A cria/lista convite A | permitido; listagem sem token/hash |
| IN-02 | B ou C cria/lista/revoga convite A | negado ou vazio; A confirma pendência |
| IN-03 | anônimo inspeciona token válido | `valid` e nome do jardim; nenhum outro dado |
| IN-04 | anônimo inspeciona malformado/aleatório | `invalid`, `garden_name=null` |
| IN-05 | inspecionar revogado/expirado/usado | estado neutro esperado e sem nome; marcar expirado como BLOQUEADO se não existir fixture sintética previamente autorizada |
| IN-06 | usuário externo aceita fixture válida | membership `member`, uso único e estado terminal |
| IN-07 | segundo usuário tenta reutilizar IN-06 | `invalid`; nenhuma membership adicional |
| IN-08 | B já membro apresenta convite pendente A | registrar `already_member` e confirmar se convite permanece pendente; SEC-06A-002 esperado |
| IN-09 | confirmar link novo no fragmento e URL saneada | token ausente da requisição/URL visível; SEC-06A-001 remediado no frontend |

### Membros

| ID | Ator/operação | Esperado e prova de integridade |
|---|---|---|
| MB-01 | A e B chamam `list_garden_members(A)` | permitido, sem e-mail |
| MB-02 | C chama listagem A | zero linhas |
| MB-03 | B chama promote/demote/remove em A | `42501`; membership inalterada |
| MB-04 | C chama mutações A | `42501`; membership inalterada |
| MB-05 | INSERT/UPDATE/DELETE direto em `garden_members` | negado para todos os clientes |
| MB-06 | A tenta remover/rebaixar último admin da fixture | negado; admin permanece |
| MB-07 | membro descartável chama `leave_garden` | permitido; histórico permanece |
| MB-08 | admin único chama `leave_garden` | negado; jardim mantém admin |

### Revogação e cache

| ID | Ator/operação | Esperado e prova de integridade |
|---|---|---|
| RV-01 | B consulta plantas/cuidados/crescimento A antes da remoção | controles positivos passam |
| RV-02 | B obtém signed URL descartável antes da remoção | registrar somente emissão e horário, nunca URL |
| RV-03 | A remove B; B repete consultas com a mesma sessão | novas respostas vazias/negadas sem novo login |
| RV-04 | B repete RPCs e tenta nova signed URL | negado |
| RV-05 | URL emitida antes da remoção | pode funcionar até 10 min; registrar apenas booleano e expiração observada |
| RV-06 | interface B permanece aberta | dados já carregados podem persistir até bootstrap/revalidação; medir até 60 s, SEC-06A-005 |
| RV-07 | A confirma histórico anterior de B | autoria/eventos preservados |

### Anônimo e integridade global

| ID | Ator/operação | Esperado e prova de integridade |
|---|---|---|
| AN-01 | cliente sem sessão seleciona cada tabela de negócio | zero/negado |
| AN-02 | cliente sem sessão chama RPCs, exceto inspeção | `42501`/sem EXECUTE |
| AN-03 | cliente sem sessão lista/baixa/assina Storage | negado |
| AN-04 | inspeção de convite | única exceção, conforme IN-03/04 |
| IT-01 | A/C recontam fixtures após todos os negativos | contagens e vínculos iguais ao esperado |
| IT-02 | verificar que nenhum teste criou recurso fora do prefixo/allowlist | nenhuma ocorrência |
| IT-03 | confirmar ausência de segredo nas evidências | busca manual por JWT, token, senha, signed URL e chave secreta sem ocorrências |

## Operações diretas representativas

Use variáveis de IDs apenas na sessão do DevTools. Os exemplos abaixo não devem ser colados com valores em relatórios.

```js
let result = await supabase.from('plants').select('id', { count: 'exact' }).eq('garden_id', A_GARDEN_ID)
console.table([safe('PL-01', result)])

result = await supabase.from('plants').update({ notes: `${RUN_PREFIX}-PL-05` }).eq('id', A_PLANT_ID).select('id')
console.table([safe('PL-05', result)])

result = await supabase.rpc('list_garden_members', { target_garden_id: A_GARDEN_ID })
console.table([safe('MB-01', result)])

result = await supabase.rpc('manage_garden_member', { target_garden_id: A_GARDEN_ID, target_user_id: B_USER_ID, requested_action: 'promote' })
console.table([safe('MB-03', result)])

result = await supabase.storage.from('plant-photos').createSignedUrl(A_PHOTO_PATH, 600)
console.table([{ case_id: 'ST-02', signed_url_issued: Boolean(result.data?.signedUrl), error_code: result.error?.name ?? null }])
result = null
```

Para INSERT/UPDATE negativo, sempre consultar o alvo antes e depois pelo ator autorizado. Para zero linhas, registrar também `count` quando disponível. Não usar `.single()` em negativas que devem retornar zero, pois isso mistura isolamento com erro de cardinalidade.

## Ordem de execução e regras de parada

1. Confirmar alvo, commit, contas e allowlist.
2. Executar somente controles positivos de leitura.
3. Executar negativos somente leitura nos dois sentidos.
4. Executar mutações próprias positivas e restaurar valores.
5. Executar mutações negativas e verificar integridade.
6. Executar convites e membros com fixtures exclusivas.
7. Executar revogação por último, pois altera membership de B.
8. Executar anônimo e reconciliação final.

Se houver acesso cross-garden, interromper o grupo afetado, não enumerar outros recursos e registrar somente caso, ator, operação, IDs mascarados, status, contagem e impacto. Não corrigir policy durante a rodada. Classificar **REPROVADO**, manter NO-GO e preparar correção separada.

## Evidência permitida

Registrar:

- commit, data, ambiente sanitizado e caso;
- ator A/B/C/anon, sem e-mail;
- UUID mascarado, por exemplo `12345678-…-90ab`;
- operação, status HTTP, código Postgres/PostgREST e contagem;
- booleanos de emissão/acesso a URL assinada;
- estado final confirmado pelo ator autorizado.

Nunca registrar Authorization header, JWT, refresh token, senha, token/hash/link de convite, signed URL, conteúdo privado, corpo bruto de erro, `.env.local` ou chave com privilégio elevado.

## Limpeza manual, sujeita a aprovação separada

Não há limpeza automatizada. Após salvar as evidências e obter aprovação específica:

1. revogar convites pendentes da rodada pela interface de A/C;
2. remover memberships descartáveis apenas pelas RPCs existentes, preservando ao menos um admin;
3. arquivar plantas sintéticas se exclusão não estiver disponível;
4. manter histórico e metadados quando o contrato não oferece DELETE;
5. solicitar limpeza administrativa de objetos órfãos somente após conferir referências;
6. excluir contas de teste apenas pelo procedimento administrativo aprovado;
7. confirmar que nenhum dado fora de `RUN_PREFIX` foi tocado.

Objetos sem DELETE cliente e histórico preservado são limitações contratuais, não autorização para SQL privilegiado ou mudança de migration nesta entrega.

## Requisitos para considerar 06A.2 concluída

- todos os casos aplicáveis com resultado observado e evidência sanitizada;
- controles positivos e negativos válidos;
- integridade final confirmada;
- catálogo remoto comparado com migrations por procedimento somente leitura autorizado;
- SEC-06A-004 reclassificado com base em prova dinâmica;
- desvios SEC-06A-002/003/005/007/009 registrados sem correção misturada;
- nenhuma credencial ou dado real nas evidências;
- NO-GO mantido enquanto houver achado Alto aberto ou critério mínimo da auditoria não cumprido.
