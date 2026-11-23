# Meu Jardim — Épico 06 / Entrega 06A

## Auditoria de segurança: RLS, RPCs, Storage e isolamento multi-tenant

**Data da análise:** 19/11/2026

**Commit analisado:** `2b46f56e56b68fe0c2b8617876c601b5c6fdb3a6`

**Modalidade:** análise estática e verificação estrutural local, sem acesso ao projeto Supabase/Vercel

**Resultado:** **NO-GO para abertura pública como SaaS**; uso familiar atual pode continuar somente com risco aceito, cadastro controlado e sem tratar esta auditoria como prova de isolamento real.

## 1. Resumo executivo

Foram analisadas as sete migrations, o cliente Supabase, rotas, serviços de dados, fluxos de Auth, convites, membros, caches, Storage, configuração Vercel, testes contratuais e documentação existente.

A implementação possui uma base defensiva consistente: todas as tabelas de negócio encontradas habilitam RLS; escritas sensíveis usam grants por coluna ou RPCs; `garden_id`, autoria e vínculos multi-tenant são derivados ou protegidos por triggers/FKs compostas; `pending_care_schedules` usa `security_invoker`; as RPCs sensíveis usam `SECURITY DEFINER`, `search_path = ''`, `auth.uid()` e revogação de `PUBLIC`; os buckets declarados são privados e limitados por tamanho/MIME; não há `service_role` no cliente.

Isso não equivale a uma aprovação de segurança. Não houve sessão autenticada contra PostgreSQL/Supabase real nesta entrega. O estado efetivamente aplicado, proprietários de funções, grants, políticas combinadas, comportamento de locks, revogação e Storage permanecem sem prova dinâmica.

Foram registrados **9 achados**:

| Severidade | Confirmado | Potencial | Não verificado | Total |
|---|---:|---:|---:|---:|
| Crítica | 0 | 0 | 0 | 0 |
| Alta | 1 | 0 | 1 | 2 |
| Média | 3 | 1 | 0 | 4 |
| Baixa | 1 | 1 | 0 | 2 |
| Informativa | 1 | 0 | 0 | 1 |

Principais riscos:

1. Convites são construídos com o token bearer na query string. A aplicação o remove com `replaceState` e usa `Referrer-Policy: no-referrer`, mas isso ocorre depois da primeira requisição e não impede que CDN/hosting/proxy recebam ou registrem a URL completa.
2. Não existe prova dinâmica do isolamento entre jardins nem confirmação atual do catálogo/grants do banco remoto.
3. `profiles.avatar_path` pode ser alterado diretamente pelo próprio usuário para um caminho arbitrário; não há trigger/constraint ligando o primeiro segmento ao `auth.uid()`.
4. Um convite apresentado por usuário que já pertence ao jardim retorna `already_member` sem ser consumido; o mesmo token permanece utilizável por outra conta.
5. A aplicação pode manter dados já carregados no cache/memória por até a revalidação do bootstrap após remoção de membership, embora novas consultas devam ser negadas pelo servidor se o RLS remoto corresponder às migrations.

## 2. Escopo efetivamente auditado

### Evidência examinada

- `README.md`, `.env.example`, `.gitignore`, `index.html`, `vercel.json`, `package.json`.
- Todas as migrations em `supabase/migrations/`.
- `src/lib/supabase.ts` e fluxos de Auth/rotas.
- APIs, hooks e componentes de jardins, perfil, plantas, cuidados, crescimento, convites e membros.
- Testes contratuais em `src/migrations/` e testes relacionados a cache/serviços.
- Estado Git local e busca por arquivos de ambiente/identificadores sensíveis.

### Fora do escopo ou indisponível

- Catálogo atual do PostgreSQL/Supabase, Dashboard, logs, Auth URL Configuration, allow-list de redirects e configuração real de cadastro/e-mail.
- Sessões JWT reais de `anon`/`authenticated`, contas A/B/C, dados descartáveis e duas conexões concorrentes.
- Conteúdo real de `storage.objects`, buckets, usuários, tokens, signed URLs e políticas efetivamente aplicadas.
- Configuração de headers na Vercel fora do `vercel.json`, WAF, logs, retenção, backups, PITR, rate limits e alertas.
- Testes ofensivos, mutações remotas, remoção de membros, corrida, deploy ou migration.

### Níveis de evidência usados

- **Análise estática:** o controle aparece no código/migration.
- **Verificação estrutural:** a migration declara RLS/policy/grant/constraint, sem provar que o remoto coincide.
- **Prova dinâmica:** exige sessão final `anon`/`authenticated` contra ambiente isolado; **não realizada**.

## 3. Inventário técnico

### 3.1 Tabelas, relações, constraints e índices

| Recurso | Escopo/relacionamento | Proteções estruturais relevantes |
|---|---|---|
| `profiles` | PK/FK `auth.users(id)` | RLS; leitura/edição própria; colunas editáveis limitadas; `updated_at` trigger |
| `gardens` | `created_by -> auth.users` | RLS; leitura de membro; update de admin; timezone validado; `updated_at` |
| `garden_members` | PK `(garden_id,user_id)`; FKs para jardim/usuário | RLS; SELECT de membros do mesmo jardim; sem grant direto de INSERT/UPDATE/DELETE; proteção do último admin |
| `garden_invites` | FK jardim/criador/aceitante | hash único de token, papel fixo, validade e estados terminais; RLS SELECT admin; índices por jardim/pendência |
| `plants` | FK jardim/criador; `UNIQUE(id,garden_id)` | RLS; escopo e autoria; campos de ownership imutáveis; path de foto validado; índices por jardim/status/local/data |
| `care_schedules` | FK composta `(plant_id,garden_id)` | RLS; ownership derivado/imutável; validações de tipo/settings; índices por jardim/planta |
| `care_events` | FKs compostas para planta e agenda | histórico sem grant direto de escrita; unicidade `(garden_id,actor_id,request_id)`; índices de histórico |
| `growth_entries` | FK composta para planta; `UNIQUE(id,garden_id,plant_id)` | RLS; jardim/autoria derivados; ownership imutável; limites de medidas/texto; índices temporais |
| `plant_photos` | FKs compostas para planta e crescimento; path único | RLS; jardim/uploader derivados; path/ownership imutáveis; associação de crescimento não removível; índices |
| `storage.objects` | objetos dos buckets | policies específicas de `plant-photos` e `avatars`; ausência intencional de DELETE cliente |

Não foram encontradas outras tabelas ou views de negócio nas migrations. O inventário remoto deve confirmar extensões, objetos criados pelo Supabase e eventual drift.

### 3.2 Policies RLS e privilégios declarados

| Recurso | SELECT | INSERT | UPDATE | DELETE | Privilégio cliente declarado |
|---|---|---|---|---|---|
| `profiles` | próprio usuário | — | próprio usuário | — | `SELECT`; UPDATE apenas `display_name, avatar_path` |
| `gardens` | membro | via RPC | admin | — | `SELECT`; UPDATE apenas `name, timezone` |
| `garden_members` | membro do mesmo jardim | via RPCs | via RPC | via RPC | `SELECT` apenas |
| `garden_invites` | admin do jardim | via RPC | via RPC | — | SELECT sem `token_hash`; nenhuma escrita direta |
| `plants` | membro | membro + autor atual | membro | — | SELECT; INSERT/UPDATE por colunas |
| `care_schedules` | membro | membro + autor atual | membro | — | SELECT; INSERT/UPDATE por colunas |
| `care_events` | membro | via RPC | — | — | SELECT apenas |
| `growth_entries` | membro | membro + autor atual | membro | — | SELECT; INSERT/UPDATE por colunas |
| `plant_photos` | membro | membro + uploader atual | membro | — | SELECT; INSERT/UPDATE por colunas |
| Storage `plant-photos` | membro real da planta/jardim | mesmo controle | antigo e novo path autorizados | — | via policies de `storage.objects` |
| Storage `avatars` | dono ou colega de jardim do dono indicado no path | primeiro diretório = usuário atual | owner do objeto e novo path próprio | — | via policies de `storage.objects` |

Policies permissivas da mesma operação combinam-se por **OR**. A análise local encontrou uma policy por operação/tabela de negócio, exceto `storage.objects`, onde as policies de buckets diferentes coexistem, mas cada expressão exige o respectivo `bucket_id`. O catálogo remoto precisa confirmar que não existem policies adicionais ou antigas.

### 3.3 View

`public.pending_care_schedules` seleciona agendas ativas de plantas não arquivadas e foi criada com `security_invoker = true` (`202611190001_care_schedules_and_events.sql:255-264`). Assim, por definição estática, as policies das relações-base devem ser aplicadas ao invocador. O grant é somente SELECT para `authenticated` (`:271-273`). Versão do PostgreSQL, opção efetiva e owner devem ser confirmados no catálogo remoto.

### 3.4 Funções/RPCs

| Função | Modo | Chamadores declarados | Validação/risco principal |
|---|---|---|---|
| `ensure_profile()` | DEFINER | `authenticated` | usa somente `auth.uid()`; lê `auth.users` |
| `is_garden_member(uuid)` | DEFINER, stable | `authenticated` | identidade derivada de `auth.uid()` |
| `is_garden_admin(uuid)` | DEFINER, stable | `authenticated` | identidade derivada de `auth.uid()` |
| `create_garden(text,text)` | DEFINER | `authenticated` | cria jardim e admin na mesma transação; valida entrada |
| `can_access_plant_photo(text)` | DEFINER, stable | `authenticated` | valida formato, planta, jardim e membership real |
| `record_care_action(uuid,uuid,text,uuid,timestamptz,text,int)` | DEFINER | `authenticated` | membership, escopo planta/agenda, locks e idempotência por ator/jardim/request |
| `list_garden_authors(uuid)` | DEFINER, stable | `authenticated` | exige membership por join; retorna nome/avatar, sem e-mail |
| `create_garden_invite(uuid)` | DEFINER | `authenticated` | exige admin; token aleatório; persiste apenas hash |
| `inspect_garden_invite(text)` | DEFINER, stable | `anon`, `authenticated` | pública por desenho; resposta reduzida; nome só para token válido |
| `accept_garden_invite(text)` | DEFINER | `authenticated` | valida identidade/estado; `FOR UPDATE`; papel derivado/fixo |
| `revoke_garden_invite(uuid)` | DEFINER | `authenticated` | lock e checagem de admin |
| `list_garden_members(uuid)` | DEFINER, stable | `authenticated` | membership por join; sem e-mail |
| `manage_garden_member(uuid,uuid,text)` | DEFINER | `authenticated` | lock no jardim, admin derivado, alvo no mesmo jardim, último admin |
| `leave_garden(uuid)` | DEFINER | `authenticated` | lock no jardim, usuário atual, último admin |

Todas as RPCs DEFINER acima declaram `search_path = ''` e usam nomes qualificados. As funções expostas revogam `PUBLIC` e concedem somente aos papéis listados. O proprietário efetivo, `proconfig`, `proacl` e overloads remotos não foram verificados.

Funções auxiliares de trigger (`set_updated_at`, `handle_new_user`, `prevent_last_garden_admin`) não têm revogação explícita de `PUBLIC` na migration inicial. Funções `RETURNS trigger` não são diretamente invocáveis como funções normais, reduzindo a explorabilidade, mas o catálogo deve confirmar ACLs e a recomendação é aplicar privilégio mínimo de forma uniforme.

### 3.5 Storage

| Bucket | Público | Limite | MIME declarados | Path esperado | Signed URL |
|---|---:|---:|---|---|---|
| `plant-photos` | não | 5 MiB | JPEG/PNG/WebP | `<garden>/<plant>/<uuid>.<ext>` | 10 min no cliente |
| `avatars` | não | 5 MiB | JPEG/PNG/WebP | frontend usa `<user>/<uuid>.<ext>` | 10 min no cliente |

`plant-photos` valida associação real do path à planta e membership. `avatars` não possui validação equivalente do formato completo nem vínculo de `profiles.avatar_path` ao usuário, conforme SEC-06A-003. Nenhum bucket concede DELETE ao cliente. Objetos órfãos e fotos substituídas exigem rotina administrativa segura futura.

## 4. Matriz de autorização

Legenda: **P** = permitido pelo desenho estático; **N** = negado pelo desenho estático; **NV** = não verificado dinamicamente. Todo P/N desta matriz é conclusão sobre migrations/código, não prova do remoto.

### 4.1 Recursos de aplicação

| Ação | `anon` | autenticado sem jardim | membro A | admin A | membro B sem A | ex-membro A | membro A+B | Evidência/observação |
|---|---|---|---|---|---|---|---|---|
| Ler/editar próprio perfil | N / N | P / P | P / P | P / P | P / P | P / P | P / P | policy `id=auth.uid()`; não depende de jardim |
| Ler nomes/avatares de A via RPC | N | N | P | P | N | N | P | joins de membership nas RPCs |
| Criar jardim | N | P | P | P | P | P | P | `create_garden` usa `auth.uid()` |
| Listar jardim/membership A | N | N | P | P | N | N | P | policies baseadas em membership atual |
| Inserir/promover membership diretamente | N | N | N | N | N | N | N | sem grants diretos; mutação via RPC |
| Administrar membros de A | N | N | N | P | N | N | somente admin A; último admin protegido |
| Sair de A | N | N | P | P* | N | N | P | `*` admin não pode deixar A sem outro admin |
| Ler planta A por lista ou ID | N | N | P | P | N | N | P | RLS por `garden_id`; filtro UI não é controle |
| Criar/editar/arquivar planta A | N | N | P | P | N | N | P | membros podem editar; ownership imutável |
| DELETE de planta | N | N | N | N | N | N | N | sem policy/grant |
| Ler/alterar agendas A | N | N | P | P | N | N | P | RLS; ownership e FK compostas |
| Executar `record_care_action` A | N | N | P | P | N | N | P | valida membership e escopo internamente |
| Alterar/excluir histórico de cuidado | N | N | N | N | N | N | N | somente SELECT direto; insert pela RPC |
| Ler/criar/editar crescimento A | N | N | P | P | N | N | P | RLS; campos de ownership imutáveis |
| Vincular foto a entrada cross-plant/garden | N | N | N | N | N | N | N | FKs compostas + trigger |
| Criar/listar/revogar convite A | N | N | N | P | N | N | depende de papel em A | inspeção pública é ação separada |
| Inspecionar token válido | P | P | P | P | P | P | P | bearer token; revela status e nome somente quando válido |
| Aceitar token válido | N | P | P** | P** | P | P | P** | `**` SEC-06A-002: membro existente não consome token |

### 4.2 Storage e revogação

| Ação | `anon` | autenticado sem jardim | membro A | admin A | membro B sem A | ex-membro A | membro A+B | Resultado estático |
|---|---|---|---|---|---|---|---|---|
| Ler/upload em `plant-photos` de A | N | N | P | P | N | N | P | policy revalida planta, jardim e membership |
| Path adulterado para planta/jardim A | N | N | N se escopo não corresponder | N se escopo não corresponder | N | N | depende da membership correta | formato + associação real |
| UPDATE objeto entre paths autorizados | N | N | P | P | N | N | P | USING e WITH CHECK chamam a validação |
| DELETE objeto | N | N | N | N | N | N | N | ausência de policy |
| Ler avatar próprio | N | P | P | P | P | P | P | dono por primeiro segmento |
| Ler avatar de colega de A | N | N | P | P | N | N | P | compartilhamento por jardim atual |
| Upload avatar sob path de outro usuário | N | N | N | N | N | N | N | primeiro segmento deve ser `auth.uid()` |
| Emitir nova signed URL após remoção de A | N | N | — | — | N | N | somente por outra membership válida | depende de RLS remoto coincidir |
| Usar signed URL já emitida após remoção | bearer URL | bearer URL | P até expirar | P até expirar | P se obtiver URL | P até expirar | P até expirar | URL assinada não é revogada pela membership |

### 4.3 REST/PostgREST/RPC direto

Os controles relevantes estão no banco, não apenas na UI: grants por coluna, policies, triggers, FKs e validações internas das RPCs. Alterar `localStorage`, chamar REST diretamente ou ocultar botões não deveria ampliar autoridade. O resultado permanece **NV** até execução real com JWTs de A/B/C. `service_role`, SQL Editor como owner e sessão `postgres` não servem como prova.

## 5. Achados

### SEC-06A-001 — Token bearer de convite trafega na query string

- **Severidade:** Alta
- **Status:** Confirmado
- **Evidência:** `src/features/invites/rules.ts:1-2`; `src/features/invites/invite-page.tsx:17-18`; `index.html:7`; `vercel.json:1`.
- **Cenário:** o link é criado como `/invite?token=...`. Antes de `replaceState` remover o parâmetro, navegador, Vercel/CDN, proxy, ferramentas de observabilidade ou logs de acesso podem receber a URL completa. `no-referrer` reduz vazamento para navegação subsequente, mas não elimina o recebimento/log da requisição inicial.
- **Impacto:** quem obtiver o token não expirado pode aceitar o convite como membro. A entropia/hash no banco não protege um token vazado no transporte/log.
- **Recomendação:** transportar o segredo no fragmento (`/invite#token=...`), que não é enviado ao servidor, ou implementar troca por código opaco de curta duração em endpoint controlado; reduzir TTL; revisar/redigir logs e retenção; nunca inserir token em analytics/erros. Invalidar convites possivelmente expostos após a mudança.
- **Correção exige migration:** provavelmente sim para rotação/TTL ou novo fluxo; a remoção da query string é também alteração frontend/deploy.

### SEC-06A-002 — Convite não é consumido quando o aceitante já é membro

- **Severidade:** Média
- **Status:** Confirmado
- **Evidência:** `supabase/migrations/202611200002_garden_invites.sql:85-94`, especialmente retorno em `:91` antes do update em `:93`; README declara convite de uso único em `README.md:342-347`.
- **Cenário:** um membro atual abre um convite pendente. A RPC retorna `already_member`, mas deixa `accepted_at/accepted_by` nulos. O mesmo token continua válido e pode ser usado por outra conta.
- **Impacto:** quebra da semântica de uso único e janela de ingresso inesperado caso o link seja encaminhado ou exposto.
- **Recomendação:** sob o mesmo `FOR UPDATE`, consumir/revogar o convite também no caso `already_member`, registrando estado terminal coerente; definir o resultado idempotente para o mesmo usuário e cobrir corrida com duas sessões.
- **Correção exige migration:** sim.

### SEC-06A-003 — `avatar_path` não é vinculado ao proprietário do perfil

- **Severidade:** Média
- **Status:** Confirmado
- **Evidência:** UPDATE de `avatar_path` concedido em `202611170001_foundation.sql:121-126`; policy de perfil valida apenas `id=auth.uid()` em `:108-111`; policies de avatar em `202611200001_profile_and_garden_settings.sql:32-54`; frontend usa path próprio em `src/features/profile/api.ts:9-16`, mas REST direto não é obrigado a fazê-lo.
- **Cenário:** usuário altera diretamente seu `profiles.avatar_path` para caminho arbitrário ou para o avatar conhecido de um colega. Se houver membership compartilhada, a signed URL pode ser emitida e a interface passa a exibir imagem que não pertence ao perfil.
- **Impacto:** impersonação visual/confusão de identidade no jardim e referências quebradas; não foi demonstrada leitura cross-garden porque a policy do objeto ainda se aplica.
- **Recomendação:** validar no banco formato exato `<auth.uid()>/<uuid>.<ext>` para mudanças iniciadas pelo cliente; preferir RPC transacional que associa somente objeto próprio existente; limitar/remover UPDATE direto da coluna; documentar reconciliação de upload órfão.
- **Correção exige migration:** sim.

### SEC-06A-004 — Isolamento multi-tenant e estado remoto não foram provados

- **Severidade:** Alta
- **Status:** Não verificado
- **Evidência:** README registra pendências de RLS/Storage/RPC/concorrência em `README.md:321-338`, `:342-361`, `:363-387`, `:417-440`; esta auditoria não recebeu ambiente/contas autorizados.
- **Cenário:** drift de migration, policy antiga permissiva, grant/owner incorreto, overload esquecido ou configuração de Storage diferente pode tornar a conclusão estática falsa.
- **Impacto:** potencial leitura/escrita entre tenants, escalada administrativa ou revogação inefetiva. Não há evidência de que isso esteja ocorrendo; há ausência de prova adequada.
- **Recomendação:** executar o roteiro da seção 8 em Supabase isolado com JWTs reais e duas sessões; capturar catálogo e respostas sanitizadas; comparar schema remoto com as migrations.
- **Correção exige migration:** somente se a inspeção revelar drift/defeito.

### SEC-06A-005 — Cache cliente pode reter dados após logout ou remoção

- **Severidade:** Média
- **Status:** Confirmado
- **Evidência:** sessão persistida em `src/lib/supabase.ts:7-9`; bootstrap revalida a cada 60 s e remove caches após detectar perda em `src/features/gardens/garden-context.tsx:24-35`; botões chamam somente `supabase.auth.signOut()` em `src/features/layout/app-layout.tsx` e `src/features/profile/profile-page.tsx`; não foi encontrado `queryClient.clear()` global na troca de usuário.
- **Cenário:** membro removido mantém a SPA aberta ou um segundo usuário entra na mesma aba. Dados já obtidos podem permanecer em memória/DOM até remontagem/revalidação. Novas consultas devem ser negadas pelo servidor, mas isso não apaga informação já entregue nem signed URLs emitidas.
- **Impacto:** exposição residual no dispositivo e percepção de revogação tardia; não amplia, por si só, a autoridade no servidor.
- **Recomendação:** limpar todo o QueryClient e estado contextual em `SIGNED_OUT` e quando o `user.id` muda; reduzir janela ou reagir a evento seguro de membership; ocultar dados imediatamente quando refresh falhar/retornar membership ausente; testar aba aberta e troca de conta.
- **Correção exige migration:** não para cache; realtime/epoch de autorização pode exigir desenho adicional.

### SEC-06A-006 — Headers de defesa em profundidade não estão declarados no repositório

- **Severidade:** Média
- **Status:** Potencial
- **Evidência:** `vercel.json:1` contém somente rewrite; `index.html:7` declara apenas `Referrer-Policy` via meta. Não foram encontrados CSP, `X-Content-Type-Options`, `Permissions-Policy` ou `frame-ancestors`/equivalente no repositório.
- **Cenário:** eventual XSS, clickjacking ou conteúdo interpretado incorretamente teria menos barreiras no navegador. A configuração real da Vercel pode adicionar headers externamente e não foi consultada.
- **Impacto:** aumento do impacto de vulnerabilidade cliente futura, especialmente porque sessão e tokens ficam no navegador.
- **Recomendação:** confirmar headers efetivos e declarar política no deploy; começar CSP em report-only, restringir `connect-src` ao Supabase necessário e validar Auth/Storage; adicionar proteção contra framing, sniffing e permissões não usadas.
- **Correção exige migration:** não.

### SEC-06A-007 — Paths de avatar têm validação estrutural mais fraca que fotos de plantas

- **Severidade:** Baixa
- **Status:** Confirmado
- **Evidência:** `202611200001_profile_and_garden_settings.sql:32-54` verifica apenas o primeiro diretório nas operações de insert/update; em contraste, `202611180001_plants_and_private_photos.sql:131-164` valida três segmentos, UUIDs, extensão, planta e jardim.
- **Cenário:** usuário envia objeto próprio com subdiretórios/nomes arbitrários ou extensão incompatível com o formato esperado, ainda sujeito ao MIME e tamanho do bucket.
- **Impacto:** inconsistência, objetos não reconciliáveis e superfície de parsing/manutenção; nenhuma execução de conteúdo foi demonstrada.
- **Recomendação:** validar formato exato do nome, extensão coerente e associação ao perfil; manter MIME/limite no bucket.
- **Correção exige migration:** sim, nas policies/função de validação.

### SEC-06A-008 — Ausência de DELETE mantém objetos órfãos e substituídos

- **Severidade:** Baixa
- **Status:** Potencial
- **Evidência:** ausência intencional de policy DELETE em `202611180001_plants_and_private_photos.sql:182-184`; uploads e associação em etapas separadas em `src/features/profile/api.ts:9-16` e fluxos de plantas/crescimento; pendência documentada em `README.md:94-95`, `:336-338`.
- **Cenário:** upload conclui e a associação falha, ou uma foto/avatar é substituído. O objeto anterior permanece privado, mas retido.
- **Impacto:** retenção desnecessária de conteúdo privado, custo e dificuldade de atender exclusão. Não há acesso público demonstrado.
- **Recomendação:** job/RPC administrativa de reconciliação com grace period, referências verificadas e auditoria; não conceder DELETE amplo ao cliente.
- **Correção exige migration:** provável para RPC/metadata segura; job operacional também necessário.

### SEC-06A-009 — Signed URLs continuam válidas até expirar

- **Severidade:** Informativa
- **Status:** Confirmado
- **Evidência:** emissão por 10 minutos em `src/features/plants/api.ts:8-14`, `src/features/growth/api.ts:9-15`, `src/features/growth/insights-api.ts:37-40`, `src/features/profile/api.ts:20-23` e `src/features/members/api.ts:4`.
- **Cenário:** usuário obtém URL e perde membership logo depois. O bearer URL já emitido continua utilizável até o vencimento e pode existir em cache do navegador/rede.
- **Impacto:** janela residual limitada, inerente ao modelo de signed URL.
- **Recomendação:** manter TTL curto, não persistir/logar URLs, usar cache headers adequados, limpar UI/cache ao revogar e considerar proxy/autorização por requisição apenas se o requisito exigir revogação instantânea de mídia já emitida.
- **Correção exige migration:** não necessariamente.

## 6. Controles observados sem achado confirmado

- Não foi encontrada chave `service_role`, segredo privado ou arquivo `.env.local` rastreado. `.env.example` contém apenas nomes de variáveis vazias.
- `garden_members` não concede escrita direta a `authenticated`; administração ocorre em RPCs com identidade derivada.
- `manage_garden_member` e `leave_garden` bloqueiam a linha de `gardens`, serializando operações do último administrador no desenho estático.
- `record_care_action` bloqueia planta/agenda, verifica escopo e trata unicidade de request; concorrência real não foi testada.
- FKs compostas impedem relações cruzadas entre jardim/planta/agenda/evento/crescimento/foto.
- `plant-photos` não confia apenas no path: resolve planta, jardim e membership.
- Convites persistem hash SHA-256 de token aleatório de 32 bytes; listagem não expõe token/hash.
- Respostas de inspeção de convite inválido/revogado/expirado/usado são reduzidas; o nome é retornado apenas a quem apresenta token válido.
- Erros mostrados pela UI são, em geral, mensagens genéricas; não foram encontrados logs explícitos de token, signed URL ou payload sensível.

## 7. Testes e verificações desta auditoria

### Executados

| Verificação | Resultado |
|---|---|
| Leitura integral das migrations | 7 migrations inspecionadas |
| Inventário estático de tabelas/views/functions/policies/grants/triggers | concluído; refletido nas seções 3 e 4 |
| Revisão do cliente Supabase/Auth/rotas/caches/serviços | concluída |
| Busca por `service_role`, chaves privadas, URLs de banco e arquivos sensíveis rastreados | nenhuma credencial encontrada; ocorrências de `service_role` são documentação/testes negativos |
| Verificação de `.env` rastreado | somente `.env.example`; valores vazios |
| `git diff --check` antes do relatório | passou, sem saída |
| Estado inicial do Git | limpo em `main`, commit informado confirmado |

### Não executados

| Teste | Motivo |
|---|---|
| RLS/REST/RPC com usuários A/B/C | não foram fornecidos ambiente isolado e credenciais autorizadas |
| Upload/leitura cross-garden e signed URLs | mutação/acesso remoto proibidos nesta entrega |
| Convites reais, remoção, promoção e último admin | risco de alterar dados/autoridade; requer staging descartável |
| Concorrência e idempotência | requer duas sessões PostgreSQL/Supabase reais e dados autorizados |
| Inspeção do Dashboard/Vercel/Auth/logs | sem acesso/configuração fornecida |
| Build/Vitest/lint | entrega documental; não houve alteração de código e testes locais não provariam RLS remoto |

Resultados anteriores descritos no README (homologações funcionais e 121 testes informados para 05C) são **histórico informado**, não testes realizados nesta auditoria.

## 8. Roteiro de homologação real para 06B

Executar apenas após aprovação explícita, em projeto Supabase separado/staging, com dados descartáveis, sem `service_role` e sem copiar JWTs/tokens para evidências.

### 8.1 Preparação

- Conta A: admin do Jardim A.
- Conta B: membro do Jardim A.
- Conta C: membro do Jardim B, sem vínculo com A.
- Conta D opcional: membro simultâneo de A e B.
- Criar plantas, agenda, evento, crescimento e fotos não sensíveis em cada jardim.
- Capturar somente status HTTP, códigos Postgres sanitizados, IDs fictícios mascarados e contagens; nunca Authorization headers, tokens, signed URLs ou conteúdo privado.
- Limpeza apenas após aprovação específica; preferir destruir o projeto de staging ao fim.

### 8.2 Casos mínimos

| Caso | Pré-condição/ação | Resultado esperado | Evidência sanitizada |
|---|---|---|---|
| RLS leitura A x C | C consulta cada tabela de A por lista e UUID conhecido | vazio/negado, sem dados de A | status, tabela, contagem 0 |
| RLS escrita A x C | C tenta INSERT/UPDATE em planta/agenda/crescimento/foto A | negado | status/código sanitizado |
| Ownership forjado | B envia `garden_id`, `created_by`, `uploaded_by` e troca de IDs | ignorado/negado | linha final sem conteúdo privado |
| Perfil | B lê/edita perfil de A diretamente | negado; RPC de membros retorna apenas campos permitidos | campos retornados |
| Autopromoção | B chama REST em `garden_members` e RPC admin contra si | negado | status/código |
| Poder por tenant | admin A tenta administrar membro somente de B | negado | status/código |
| Último admin | duas sessões tentam remover/rebaixar/sair simultaneamente | ao menos um admin preservado | contagem final + transações |
| Convite inválido | `anon` inspeciona tokens malformado/aleatório/expirado/revogado/usado | resposta neutra; sem nome para inválidos | status e shape |
| Uso único | B (já membro) usa convite e C tenta reutilizar | após correção, C deve falhar | estados sanitizados |
| Corrida de convite | B e C aceitam o mesmo token simultaneamente | somente um aceitante/membership | duas respostas + linha terminal |
| Storage path | C tenta listar/baixar/assinar/upload em path de A | negado | operação/status |
| Avatar arbitrário | B tenta associar path de A ou malformado | após correção, negado | status/código |
| Revogação | remover B; B repete SELECT/RPC/upload/signed URL nova | novas operações negadas imediatamente | timestamps/status |
| URL anterior | usar signed URL emitida antes da remoção | funciona somente até TTL; falha depois | horários, sem registrar URL |
| Care idempotente | repetir mesmo `request_id` | mesmo evento, sem duplicação | IDs mascarados/contagem |
| Care concorrente | dois requests distintos na mesma agenda | eventos preservados e update serializado | contagem/next date |
| Cache | remover B com SPA aberta; trocar usuário na mesma aba | dados somem e cache é limpo conforme aceite | gravação sem dados reais |

Para cada caso, registrar: ambiente/commit/migrations, ator, pré-condição, chamada sem segredo, resultado esperado, resultado observado, evidência e limpeza aprovada.

## 9. Consultas SQL somente leitura

Executar manualmente como inspeção de catálogo. Resultado no SQL Editor/owner **não prova RLS do usuário final**.

```sql
-- Tabelas/views, owners, RLS e opções de view.
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

-- Policies completas; procurar policies extras que se combinem por OR.
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_catalog.pg_policies
where schemaname in ('public', 'storage')
order by schemaname, tablename, cmd, policyname;

-- Privilégios de tabela e coluna.
select grantee, table_schema, table_name, privilege_type
from information_schema.role_table_grants
where table_schema in ('public', 'storage')
order by table_schema, table_name, grantee, privilege_type;

select grantee, table_schema, table_name, column_name, privilege_type
from information_schema.column_privileges
where table_schema = 'public'
order by table_name, grantee, privilege_type, column_name;

-- Funções, owners, modo de segurança, configuração e ACL efetiva.
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

-- Constraints/FKs/uniques/checks e triggers não internos.
select conrelid::regclass as relation, conname, contype, pg_get_constraintdef(oid)
from pg_catalog.pg_constraint
where connamespace = 'public'::regnamespace
order by relation::text, conname;

select event_object_schema, event_object_table, trigger_name,
       action_timing, event_manipulation, action_statement
from information_schema.triggers
where event_object_schema in ('public', 'auth')
order by event_object_schema, event_object_table, trigger_name, event_manipulation;

-- Índices relevantes.
select schemaname, tablename, indexname, indexdef
from pg_catalog.pg_indexes
where schemaname = 'public'
order by tablename, indexname;

-- Buckets sem listar objetos ou URLs.
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id in ('plant-photos', 'avatars')
order by id;
```

## 10. Plano de correção incremental

| Ordem | Ação | Dependência | Critério de aceite | Migration |
|---:|---|---|---|---|
| 1 | Remover token de convite da query string e revisar logs | decisão de fluxo/compatibilidade dos links | token nunca chega em URL HTTP/log; login/cadastro preservam fluxo | talvez |
| 2 | Consumir convite no caso `already_member` | semântica aprovada de estado terminal | reuso por outra conta falha; retry do mesmo ator é definido; corrida passa | sim |
| 3 | Vincular `avatar_path` ao próprio usuário e endurecer paths | formato canônico e estratégia de órfãos | REST direto não associa path alheio/malformado; uploads válidos continuam | sim |
| 4 | Limpar caches em logout/troca de usuário/revogação detectada | evento central de Auth e QueryClient | nenhum dado do usuário anterior permanece visível; servidor nega novas operações | não |
| 5 | Declarar/verificar headers de segurança | inventário dos domínios Supabase usados | CSP testada, sem quebrar Auth/Storage; framing/sniffing/permissões cobertos | não |
| 6 | Inventariar schema remoto e corrigir drift/ACLs | acesso read-only ao catálogo | owners, ACLs, policies, overloads e buckets coincidem com baseline | se houver drift |
| 7 | Executar matriz dinâmica 06B | staging, A/B/C e autorização | todos os testes críticos passam com evidência sanitizada | não por si só |
| 8 | Projetar reconciliação de objetos órfãos | retenção/privacidade/observabilidade | exclusão somente de objeto sem referência após grace period e com auditoria | provável |

Não implementar todas as correções em uma única migration. Separar convite, avatar/Storage e hardening operacional para permitir revisão e rollback controlados.

## 11. Riscos residuais

- Signed URLs são bearer URLs e permanecem válidas até o TTL, independentemente de remoção posterior de membership.
- Dados já entregues a um dispositivo não podem ser “deslidos”; revogação imediata significa bloquear novas operações no servidor e limpar a UI local quando possível.
- Locks e idempotência só estarão comprovados após execução concorrente real.
- Policies/grants presentes em arquivo não demonstram que o projeto remoto está atualizado ou sem policies extras.
- Tokens de convite podem ser copiados pelo destinatário; mesmo após retirar da query string, continuam sendo segredos compartilháveis até uso/expiração/revogação.
- Ausência de DELETE cliente evita deleção indevida, mas cria retenção/orfandade que requer processo administrativo.
- Configuração de Auth (Site URL, redirects, cadastro público, confirmação de e-mail), logs e rate limits continua não verificada.
- Persistência de sessão no navegador aumenta a importância de CSP, higiene do dispositivo e limpeza de cache/logout.

## 12. Checklist para retorno da homologação

- [ ] Informar ambiente de staging e commit/migrations, sem credenciais.
- [ ] Anexar saída sanitizada das consultas de catálogo da seção 9.
- [ ] Confirmar Auth Site URL, redirects exatos e estado do cadastro público.
- [ ] Confirmar headers HTTP efetivos e política de logs/redação de query strings.
- [ ] Executar A/B/C para SELECT/INSERT/UPDATE/DELETE em cada recurso.
- [ ] Executar chamadas REST/RPC diretas, não apenas botões da UI.
- [ ] Testar Storage por path conhecido/adulterado, MIME, tamanho, signed URL nova e anterior.
- [ ] Testar convite inválido/expirado/revogado/usado, `already_member` e corrida.
- [ ] Testar promoção/rebaixamento/remoção/saída e corrida do último admin.
- [ ] Testar `record_care_action` com retry e concorrência.
- [ ] Testar revogação com SPA aberta, logout e troca de conta na mesma aba.
- [ ] Registrar resultados sem JWT, token, signed URL, e-mail, conteúdo privado ou erro bruto sensível.
- [ ] Classificar falhas e abrir correções separadas antes de repetir a bateria.

## 13. Recomendação GO / NO-GO

### Abertura pública como SaaS: **NO-GO**

Fundamentos:

- há token bearer em query string, com risco de exposição em infraestrutura de acesso;
- há desvios confirmados na semântica de uso único de convite e na associação de avatar;
- isolamento RLS/Storage, grants remotos, revogação e concorrência não possuem prova dinâmica;
- Auth, logs, headers, rate limits, backup/recuperação e configuração real de produção não foram verificados.

### Uso familiar atual: **continuidade condicionada com risco aceito**

É razoável somente se o grupo for conhecido, o cadastro público estiver realmente controlado, convites forem tratados como segredo, não houver expectativa de revogação instantânea de signed URLs já emitidas e os responsáveis aceitarem que o isolamento real ainda não foi homologado. Essa continuidade não deve ser comunicada como aprovação de segurança.

O critério mínimo para reconsiderar GO é: corrigir SEC-06A-001/002/003, confirmar SEC-06A-004 no catálogo, executar toda a matriz crítica com A/B/C e duas sessões, validar revogação/cache/Storage, verificar Auth/headers/logs e não deixar achado Alta aberto.

## 14. Estado de encerramento

- Nenhum código, migration, configuração, dado, bucket ou usuário foi alterado.
- Nenhum SQL remoto, teste ofensivo, commit, push ou deploy foi executado.
- O único arquivo criado nesta entrega é este relatório.
- `git diff --check` terminou sem saída; a verificação adicional do arquivo novo não encontrou whitespace ao fim de linha.
- Estado final: somente `docs/audits/06A-security-audit.md` está novo; HEAD permanece em `2b46f56e56b68fe0c2b8617876c601b5c6fdb3a6`.
