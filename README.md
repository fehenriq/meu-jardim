# Meu Jardim

Fundação mobile-first para um jardim familiar privado, preparada para múltiplos jardins. Usa React, TypeScript, Vite, Tailwind CSS 4, componentes no padrão shadcn/ui e Supabase.

## Rodar localmente

Pré-requisitos: Node 22.14+ e um projeto Supabase. No PowerShell desta máquina, use `npm.cmd` caso a política bloqueie `npm.ps1`.

```powershell
npm.cmd install
Copy-Item .env.example .env.local
npm.cmd run dev
```

Preencha `.env.local` somente com a URL e a chave pública/anon do projeto. Nunca coloque `service_role` no frontend.

## Configurar o Supabase

1. Crie ou escolha conscientemente um projeto Supabase. Não aplique a migration sem revisar o destino.
2. Aplique as migrations em ordem com `supabase db push` em um projeto vinculado ou pelo SQL Editor:
   - `supabase/migrations/202611170001_foundation.sql`
   - `supabase/migrations/202611180001_plants_and_private_photos.sql`
   - `supabase/migrations/202611190001_care_schedules_and_events.sql`
3. Em **Authentication > URL Configuration**, configure **Site URL** com a URL local ou de produção.
4. Adicione em **Redirect URLs**: `http://localhost:5173/**` e `https://SEU-DOMINIO-VERCEL/**`.
5. Em **Authentication > Providers > Email**, decida se confirmação de e-mail será obrigatória. O frontend respeita ambos os modos.
6. Para um ambiente familiar fechado, desabilite novos cadastros nas configurações reais de Auth quando terminar os testes. Esconder o botão no frontend não bloqueia a API de cadastro. Convites seguros ficam para etapa futura.

A fundação cria `profiles`, `gardens`, `garden_members`, índices, triggers, RLS e a RPC transacional `create_garden`. A migration incremental cria `plants`, suas policies e o bucket privado `plant-photos`; ela não altera as tabelas ou funções da fundação.

### Contrato de agendas e eventos de cuidados

- `care_schedules` aceita rotinas independentes dos tipos `watering_check`, `fertilizing`, `pruning`, `repotting` e `custom`. Rotinas personalizadas exigem título; não há unicidade artificial por planta ou tipo.
- `settings.moisture_recheck_days` é inteiro opcional entre 1 e 30, com padrão operacional de 2 dias. Outras chaves são rejeitadas nesta entrega.
- `care_events` é histórico imutável. O cliente recebe somente leitura; inserção ocorre pela RPC `record_care_action` e não há `DELETE` direto de eventos ou agendas.
- A view `pending_care_schedules`, com `security_invoker`, expõe somente agendas ativas de plantas não arquivadas. Agendas e eventos de plantas arquivadas permanecem preservados.
- Vínculos compostos garantem que planta, agenda e evento pertençam ao mesmo jardim. Autoria e jardim são derivados no banco.
- O `request_id` é idempotente por jardim e ator. Locks em planta e agenda serializam ações concorrentes sem perder eventos distintos.

Assinatura da RPC:

```sql
public.record_care_action(
  p_plant_id uuid,
  p_schedule_id uuid,
  p_action text,
  p_request_id uuid,
  p_event_at timestamptz default now(),
  p_note text default null,
  p_defer_days integer default null
) returns public.care_events
```

Semântica das ações:

- `watered`: em agenda `watering_check`, registra rega real e agenda nova verificação pela data civil do jardim mais `interval_days`.
- `moisture_checked`: registra somente inspeção de solo úmido e usa `moisture_recheck_days`, sem criar evento de rega.
- `deferred`: exige `p_defer_days` entre 1 e 365, registra adiamento e não conta como cuidado realizado.
- `care_completed`: registra a execução de cuidados que não sejam `watering_check` e aplica `interval_days`.
- Sem `p_schedule_id`, somente `watered` é permitido. A rega espontânea é registrada sem escolher ou recalcular qualquer agenda existente.
- `p_event_at` permanece `timestamptz`; `next_due_date` é calculada com `gardens.timezone` e armazenada como data civil.

### Aplicação manual e validação da Entrega 03A

Antes de aplicar, confirme conscientemente projeto e usuário, faça backup e execute:

```sql
select current_database(), current_user;
select to_regclass('public.plants'), to_regclass('public.care_schedules'), to_regclass('public.care_events');
select count(*) from public.plants;
select conname from pg_constraint where conname = 'plants_id_garden_unique';
```

O resultado esperado antes da primeira aplicação é `plants` existente, tabelas de cuidados ausentes e constraint composta ausente. Aplique manualmente `supabase/migrations/202611190001_care_schedules_and_events.sql` pelo SQL Editor ou, após vincular e revisar o destino, com `supabase db push`. Esta migration não foi executada automaticamente.

**Status em 19/11/2026:** a migration foi aplicada manualmente no Supabase. As verificações estruturais confirmaram RLS ativo em `care_schedules` e `care_events`; políticas `SELECT`, `INSERT` e `UPDATE` em `care_schedules`; política `SELECT` em `care_events`; e `EXECUTE` da RPC `record_care_action` para `authenticated`. Permanecem pendentes os testes reais de isolamento RLS com duas sessões, concorrência e idempotência da 03A, além das pendências de RLS/Storage do Épico 02.

Após aplicar, valide:

```sql
select to_regclass('public.care_schedules'), to_regclass('public.care_events'), to_regclass('public.pending_care_schedules');
select relname, relrowsecurity from pg_class where relname in ('care_schedules', 'care_events');
select routine_name, security_type from information_schema.routines where routine_schema = 'public' and routine_name = 'record_care_action';
select grantee, privilege_type from information_schema.routine_privileges where routine_schema = 'public' and routine_name = 'record_care_action' order by grantee, privilege_type;
select grantee, table_name, privilege_type from information_schema.role_table_grants where table_schema = 'public' and table_name in ('care_schedules', 'care_events', 'pending_care_schedules') order by table_name, grantee, privilege_type;
```

Os testes automatizados desta entrega são contratuais e não provam RLS, locks ou execução transacional no PostgreSQL. A homologação real de RLS/RPC com duas sessões autenticadas continua pendente: deve cobrir isolamento entre jardins, vínculos incompatíveis, autoria forjada, agenda inativa, planta arquivada, timezone e virada do dia, retry com o mesmo `request_id` e duas ações simultâneas distintas.

Roteiro reproduzível para homologação, usando IDs reais de usuários, jardins, plantas e agendas de um projeto exclusivo de testes:

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'USER_A_UUID', true);

select * from public.record_care_action(
  'PLANT_A_UUID', 'WATERING_SCHEDULE_A_UUID', 'watered',
  'REQUEST_UUID_1', '2026-11-19T02:30:00Z', 'Rega real', null
);
select * from public.record_care_action(
  'PLANT_A_UUID', 'WATERING_SCHEDULE_A_UUID', 'moisture_checked',
  'REQUEST_UUID_2', '2026-11-19T02:35:00Z', 'Solo ainda úmido', null
);
select * from public.record_care_action(
  'PLANT_A_UUID', 'WATERING_SCHEDULE_A_UUID', 'deferred',
  'REQUEST_UUID_3', '2026-11-19T02:40:00Z', 'Verificar depois', 3
);
select * from public.record_care_action(
  'PLANT_A_UUID', null, 'watered',
  'REQUEST_UUID_4', '2026-11-19T02:45:00Z', 'Rega espontânea', null
);
rollback;
```

Repita a primeira chamada com o mesmo `request_id` e confirme o mesmo `id` de evento sem nova linha. Em uma segunda sessão com `USER_B_UUID`, tente usar IDs do Jardim A e confirme negação. Teste também agenda de outro jardim, agenda inativa, planta arquivada, `defer_days` inválido e ações incompatíveis. Para concorrência, mantenha duas transações autenticadas como membros do mesmo jardim, execute ações com `request_id` distintos na mesma agenda e confirme dois eventos preservados e atualização serializada. Compare `event_at`, `next_due_date` e o timezone do jardim em casos imediatamente antes e depois da meia-noite local. Use `rollback` durante a preparação e não use `service_role` ou sessão `postgres` para afirmar que RLS foi validada.

### Interface de cuidados da Entrega 03B

**Status em 19/11/2026:** a homologação funcional foi concluída com 10/10 verificações aprovadas, incluindo rega programada, inspeção de umidade, adiamento, conclusão de cuidado, criação e edição de rotinas, ativação/desativação, rega espontânea e histórico. Permanecem pendentes a homologação RLS/Storage entre jardins, os testes reais de idempotência e concorrência da RPC, a identificação segura dos demais membros no histórico, a limpeza de fotografias órfãs e a otimização do bundle.

- A página de detalhes da planta lista, cria e edita rotinas usando somente os campos concedidos pela migration 03A. Ativação e desativação usam `active`; não há exclusão de agendas ou eventos.
- Verificação de rega oferece `watered`, `moisture_checked` e `deferred`. Outros tipos oferecem `care_completed` e `deferred`. Rega espontânea envia `schedule_id = null` e não escolhe uma agenda.
- Cada confirmação cria um `request_id`. Se a resposta for incerta, o botão de repetição reutiliza a mesma intenção, inclusive UUID e horário; uma ação nova recebe outro UUID.
- Próximas datas são lidas do retorno real do banco. O frontend não recalcula agendas e trata `next_due_date` como data civil.
- O histórico mostra até 30 eventos reais, sem operações de edição ou exclusão. O perfil atual pode ser nomeado; outros atores aparecem como “Membro do jardim” porque a RLS de `profiles` não permite consultar perfis de terceiros.
- Plantas arquivadas exibem rotinas e histórico em modo somente leitura. Os caches são separados por jardim e planta e removidos na troca de jardim.

Roteiro de homologação real de segurança e concorrência da 03B, ainda pendente:

1. Em duas sessões autenticadas, crie Jardim A/Planta A e Jardim B/Planta B sem `service_role`.
2. Como membro de A, crie rotinas de todos os tipos, incluindo duas independentes do mesmo tipo e uma personalizada; edite, desative e reative sem perder eventos.
3. Registre rega, solo úmido, adiamento e conclusão compatível. Confirme no banco os tipos de evento e as datas retornadas pela RPC.
4. Faça rega espontânea e confirme que nenhuma agenda foi escolhida ou recalculada.
5. Simule resposta incerta e repita a mesma intenção; confirme um único evento para o mesmo `request_id`. Inicie nova ação e confirme UUID distinto.
6. Execute ações simultâneas com UUIDs diferentes na mesma agenda e valide eventos preservados e atualização serializada.
7. Como usuário de B, tente listar e alterar agendas/eventos de A e invocar a RPC com IDs de A; todas as tentativas devem ser negadas ou vazias.
8. Arquive a planta e confirme histórico visível, ações bloqueadas e ausência nas pendências; restaure e confirme retomada segura.
9. Teste horários próximos à meia-noite no timezone do jardim e valide DD/MM/AAAA sem deslocamento da data civil.

Testes unitários e contratuais não comprovam RLS, locks, idempotência ou concorrência reais. Essas verificações permanecem pendentes junto da homologação da 03A.

### Contrato de plantas e fotos

- `status`: `active`, `recovering`, `archived`.
- `origin`: `seed`, `seedling`, `purchased`, `other`.
- `light_exposure`: `low_light`, `indirect_light`, `partial_sun`, `full_sun`.
- `acquired_at` usa `date`, sem conversão de fuso.
- O caminho privado de foto é `<garden_id>/<plant_id>/<uuid>.<jpg|jpeg|png|webp>`.
- O bucket aceita JPEG, PNG e WebP, até 5 MiB por objeto.
- Leitura, upload e substituição exigem que o path corresponda a uma planta real e que o usuário seja membro real do jardim.
- Exclusão física de plantas e objetos está bloqueada. Plantas usam arquivamento/restauração; remoção segura de fotos fica para um fluxo posterior que confira referências e histórico.
- Fotos devem ser consumidas por signed URLs temporárias na Entrega 02B; não existem URLs públicas permanentes.

## Deploy na Vercel

1. Importe este diretório como projeto Vite.
2. Use `npm run build` como Build Command e `dist` como Output Directory.
3. Cadastre `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` nos ambientes desejados.
4. Faça o deploy e depois inclua a URL final nas URLs permitidas do Supabase Auth.
5. `vercel.json` já configura fallback para rotas SPA.

## Validação

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build
```

### Roteiro manual de Auth e RLS

1. Crie usuário A, confirme o e-mail quando exigido e crie o Jardim A.
2. Em outra sessão, crie usuário B e Jardim B.
3. Com o token de B, tente selecionar o ID do Jardim A e suas memberships pelo cliente REST: o resultado deve ser vazio/negado.
4. Com B, tente `insert`/`update` em `garden_members`, inclusive enviando `role: "admin"`: deve ser negado.
5. Confirme que mudar no `localStorage` o ID preferido para o Jardim A não o torna selecionável para B.
6. Confirme que a RPC ignora qualquer identidade externa: ela só usa `auth.uid()` e cria jardim + administrador na mesma transação.
7. Tente remover ou rebaixar o único administrador por uma operação administrativa controlada: o trigger deve impedir.
8. Teste cadastro com confirmação ligada e desligada; login inválido; recuperação; link expirado; logout; recarga com sessão válida e expirada.

### Homologação real de plantas e Storage

Execute este roteiro após aplicar as duas migrations em Supabase local ou em um projeto de homologação. Os testes Vitest da migration são apenas contratuais e **não comprovam a execução de RLS no PostgreSQL**.

**Status em 18/11/2026:** a migration `202611180001_plants_and_private_photos.sql` foi aplicada manualmente no Supabase pelo desenvolvedor. Os testes reais de isolamento RLS e Storage descritos abaixo continuam pendentes.

1. Crie dois jardins, A e B, com administradores distintos; adicione um segundo membro ao jardim A por operação administrativa controlada.
2. Como administrador de A, insira uma planta omitindo `created_by`; confirme que ele recebeu `auth.uid()` e que `nickname` foi normalizado com trim.
3. Como o segundo membro de A, leia e edite a planta, altere `status` para `archived` e depois para `active`.
4. Como usuário de B e como usuário autenticado sem membership, tente selecionar, inserir e atualizar usando os UUIDs de A; todas as operações devem retornar vazio ou negar acesso.
5. Como membro de A, tente atualizar `garden_id` e `created_by`; ambas devem ser negadas por privilégios de coluna e pelo trigger.
6. Confirme que `DELETE` em `plants` é negado ao papel `authenticated`.
7. Faça upload de JPEG, PNG ou WebP menor que 5 MiB em `A_GARDEN_ID/A_PLANT_ID/FILE_UUID.ext`; confirme leitura e substituição por ambos os membros de A.
8. Tente paths com jardim B, planta de outro jardim, UUID inexistente, extensão ou MIME não permitido e arquivo acima de 5 MiB; todos devem ser negados.
9. Como usuário de B, tente listar, baixar e atualizar o objeto de A mesmo conhecendo o path; nenhuma operação deve expor o objeto.
10. Confirme que `DELETE` em `storage.objects` está negado e que o bucket permanece `public = false`.
11. Defina `main_photo_path` com o path válido da própria planta e depois tente apontar para outro jardim ou planta; o segundo update deve falhar.
12. Valide que Auth, `create_garden`, `profiles`, `gardens` e `garden_members` continuam operando como antes.

### Fluxo frontend de plantas

**Status em 18/11/2026:** a homologação funcional da Entrega 02B foi concluída com 8/8 verificações aprovadas. Os testes reais de isolamento RLS e Storage entre usuários de jardins distintos permanecem pendentes.

**Status da Entrega 02C em 18/11/2026:** a homologação funcional foi concluída com 8/8 verificações aprovadas, incluindo o conflito de edição entre duas abas. Permanecem pendentes os testes reais de isolamento RLS/Storage, a limpeza segura de fotografias órfãs e a otimização do bundle de produção.

- A lista consulta somente o `garden_id` ativo, com busca por apelido, filtros de localização/status e páginas de 12 itens.
- O cadastro cria a planta primeiro e, quando houver foto, envia um objeto novo para `plant-photos` antes de associar `main_photo_path`.
- Uma falha de foto não desfaz nem repete o cadastro da planta. O diálogo permite retomar o upload ou somente a associação, conforme a etapa que falhou.
- Se o upload concluir e a associação falhar definitivamente, o objeto pode permanecer órfão porque a policy atual bloqueia `DELETE`. Ele não é exibido e não é reenviado durante a tentativa de associação.
- Fotos usam signed URLs com validade de 10 minutos, renovadas enquanto lista ou detalhes permanecem ativos. URLs assinadas não são persistidas.
- A imagem original não é comprimida pelo frontend nesta entrega; tipo e tamanho são validados antes do envio para evitar conversões inesperadas.
- A contagem da tela Hoje considera somente plantas com status `active`. Métricas de cuidados continuam identificadas como futuras.
- A edição envia somente campos mutáveis e compara o `updated_at` lido antes do `UPDATE`; zero linhas alteradas é tratado como conflito ou ausência de acesso após consulta autorizada.
- A troca de foto cria um novo objeto privado e preserva a foto anterior até a associação confirmar. Falhas de associação podem deixar um objeto órfão, que não é reenviado na recuperação nem excluído pelo cliente.
- Arquivamento e restauração alteram somente `status`, respectivamente para `archived` e `active`, e invalidam detalhes, listagens, locais e contagem ativa do jardim.

## Escopo atual

Implementado: autenticação, perfil provisionado, jardins e memberships seguros, persistência/RLS de plantas, cadastro/listagem/detalhes/edição de plantas, arquivamento/restauração, troca de foto principal privada por signed URL, estrutura/RLS/RPC de cuidados e interface de rotinas/eventos nos detalhes da planta, seletor de jardim, indicador real de plantas ativas, páginas honestas de Calendário, layout responsivo e infraestrutura Vercel.

Ainda não implementado: cuidados na tela Hoje, calendário funcional de cuidados, remoção/limpeza de fotos órfãs, compressão de imagens, diário fotográfico, convites, gestão de membros, notificações, offline e pagamentos. Permanecem pendentes as homologações reais de RLS/Storage do Épico 02 e de RLS/RPC/concorrência/idempotência das Entregas 03A e 03B, além da otimização do bundle.

O manifest usa diretamente o asset original disponível de 192×192. Para PWA completa, forneça posteriormente um ícone original de 512×512; esta entrega não inventa upscale ou redesenho.
