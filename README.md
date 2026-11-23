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
   - `supabase/migrations/202611190002_growth_diary.sql`
3. Em **Authentication > URL Configuration**, configure **Site URL** com a URL local ou de produção.
4. Adicione em **Redirect URLs**: `http://localhost:5173/**` e `https://SEU-DOMINIO-VERCEL/**`.
5. Em **Authentication > Providers > Email**, decida se confirmação de e-mail será obrigatória. O frontend respeita ambos os modos.
6. Para um ambiente familiar fechado, desabilite novos cadastros nas configurações reais de Auth quando terminar os testes. Esconder o botão no frontend não bloqueia a API de cadastro. Convites seguros ficam para etapa futura.

A fundação cria `profiles`, `gardens`, `garden_members`, índices, triggers, RLS e a RPC transacional `create_garden`. A migration incremental cria `plants`, suas policies e o bucket privado `plant-photos`; ela não altera as tabelas ou funções da fundação.

### Estrutura e segurança do diário de crescimento — Entrega 04A

- `growth_entries` registra o instante real em `observed_at` como `timestamptz`; a futura interface deve exibi-lo no `gardens.timezone`. Altura é opcional, finita e não negativa; folhas são opcionais, inteiras e não negativas; observações são opcionais e limitadas a 4.000 caracteres.
- Um registro sem medição ou texto é permitido apenas para viabilizar um agrupamento composto somente por fotos, pois a associação ocorre em outra tabela. A futura interface não deve criar registros vazios sem ao menos uma foto associada e deve sinalizar associações parciais.
- `plant_photos` aceita várias fotos por registro e fotos independentes, sem limite arbitrário. Listagens extensas deverão usar paginação por `created_at` e `id` antes da implementação da interface.
- Jardim, autoria e responsável pelo upload são derivados pelo banco. Jardim, planta, autoria e caminho são imutáveis; uma foto independente pode ser associada uma única vez a um registro da mesma planta e jardim, sem posterior troca ou remoção dessa associação.
- Membros atuais podem ler o histórico e editar somente `observed_at`, `height_cm`, `leaf_count` e `notes` em registros, além de `taken_at` e da primeira associação de `growth_entry_id` em fotos independentes. Não há `DELETE` cliente. Novos registros e novas linhas de foto são bloqueados para plantas arquivadas, enquanto o histórico existente permanece legível.
- O bucket privado `plant-photos`, o limite de 5 MiB, os MIME types JPEG/PNG/WebP, o formato `<garden_id>/<plant_id>/<uuid>.<ext>` e as policies existentes são reutilizados sem alteração. `plants.main_photo_path` e objetos existentes não são migrados, sobrescritos ou apagados.
- URLs devem continuar assinadas somente no cliente autenticado. Não use `getPublicUrl`, `service_role` ou segredo no frontend.

Contrato recomendado para upload e associação futura:

1. Gere um UUID de arquivo e envie o objeto para o path da planta no bucket privado.
2. Insira `plant_photos` com `plant_id`, `storage_path`, `taken_at` opcional e `growth_entry_id` opcional. O banco deriva `garden_id` e `uploaded_by`; `storage_path` único torna retries detectáveis.
3. Para um registro composto somente por fotos, crie `growth_entries` e associe cada foto ainda independente com um único `UPDATE growth_entry_id`. A FK composta rejeita registros de outra planta ou jardim.
4. Se o upload concluir e o INSERT falhar, o objeto fica órfão; se a foto independente for registrada e a criação do diário falhar, ela permanece independente. O cliente não deve repetir upload quando já conhece o path e não pode apagar o objeto. Limpeza segura e reconciliação idempotente permanecem pendentes.

Aplicação manual da 04A:

```sql
select current_database(), current_user;
select to_regclass('public.plants'), to_regclass('public.growth_entries'), to_regclass('public.plant_photos');
select conname from pg_constraint where conname = 'plants_id_garden_unique';
select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'plant-photos';
```

Antes da primeira aplicação, `plants` e `plants_id_garden_unique` devem existir, `growth_entries` e `plant_photos` devem ser nulas, e o bucket deve permanecer privado com o contrato atual. Revise conscientemente o projeto, faça backup e execute `supabase/migrations/202611190002_growth_diary.sql` no SQL Editor.

**Status da Entrega 04A:** a migration `202611190002_growth_diary.sql` foi aplicada manualmente no Supabase. As verificações estruturais confirmaram RLS ativo e policies `SELECT`, `INSERT` e `UPDATE` em `growth_entries` e `plant_photos`; policies `SELECT`, `INSERT` e `UPDATE` no Storage; e o bucket `plant-photos` privado, limitado a 5 MiB e aos formatos JPEG, PNG e WebP. Os testes reais de isolamento RLS e Storage entre jardins continuam pendentes.

Consultas de pós-verificação:

```sql
select to_regclass('public.growth_entries'), to_regclass('public.plant_photos');
select relname, relrowsecurity from pg_class where relnamespace = 'public'::regnamespace and relname in ('growth_entries', 'plant_photos');
select tablename, policyname, cmd, roles from pg_policies where schemaname = 'public' and tablename in ('growth_entries', 'plant_photos') order by tablename, cmd;
select conrelid::regclass, conname, pg_get_constraintdef(oid) from pg_constraint where conrelid in ('public.growth_entries'::regclass, 'public.plant_photos'::regclass) order by conrelid::regclass::text, conname;
select grantee, table_name, privilege_type from information_schema.role_table_grants where table_schema = 'public' and table_name in ('growth_entries', 'plant_photos') order by table_name, grantee, privilege_type;
select grantee, table_name, column_name, privilege_type from information_schema.column_privileges where table_schema = 'public' and table_name in ('growth_entries', 'plant_photos') order by table_name, grantee, privilege_type, column_name;
select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'plant-photos';
select policyname, cmd, roles from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'plant_photos_%' order by policyname;
```

Roteiro real com dois usuários em um projeto exclusivo de homologação:

1. Crie usuários A e B, jardins A e B e plantas ativas distintas; use apenas sessões `authenticated`, nunca `service_role` ou `postgres`, para validar RLS.
2. Como A, crie registro com altura, folhas e texto; confirme autoria derivada, timezone na apresentação e rejeição de altura não finita/negativa, folhas negativas e texto acima do limite.
3. Como A, crie registros apenas com texto, apenas com foto e com várias fotos; confirme que paths e vínculos pertencem à mesma planta e jardim.
4. Como B, tente ler, inserir e atualizar registros e fotos de A mesmo conhecendo seus UUIDs e paths; todas as operações devem retornar vazio ou ser negadas.
5. Tente forjar `garden_id`, `created_by` e `uploaded_by`, trocar planta/jardim/autoria, apontar path para outra planta e associar foto a registro de outra planta ou jardim; tudo deve ser negado.
6. Confirme que uma foto independente pode receber uma associação válida uma vez, mas não pode ser reassociada ou desassociada.
7. Arquive a planta após criar histórico; confirme leitura do histórico e bloqueio de novas entradas e linhas de foto. Confirme também que a foto principal antiga continua acessível por signed URL aos membros.
8. Confirme que `DELETE` é negado em `growth_entries`, `plant_photos` e `storage.objects` e que o bucket continua privado, limitado a 5 MiB e aos MIME types existentes.
9. Simule falha após upload e antes do INSERT, e falha após registrar foto independente e antes da associação; confirme o estado parcial documentado sem reupload automático nem exclusão cliente.

Os testes Vitest desta entrega são contratuais e não comprovam PostgreSQL, RLS ou Storage reais. Isolamento entre jardins, comportamento do Storage, falhas parciais e compatibilidade de fotos principais continuam pendentes até a execução desse roteiro.

### Diário fotográfico e linha do tempo — Entrega 04B

- A página de detalhes consulta `growth_entries` pelo jardim e planta atuais em páginas de 8, ordenadas no servidor por `observed_at desc, id desc`. Cada página carrega somente suas fotografias vinculadas; o cache inclui jardim e planta e é removido quando o escopo muda.
- Data e hora são preenchidas e exibidas no `gardens.timezone`, enquanto o payload persiste um instante ISO em `timestamptz`. Altura, folhas e observações são opcionais, mas o formulário exige ao menos uma medição, texto ou fotografia.
- Cada fotografia recebe um path UUID estável antes do envio, nunca sobrescreve objetos e é registrada em `plant_photos` somente no escopo atual. URLs são assinadas por 10 minutos e as consultas são renovadas antes da expiração; URLs assinadas não são persistidas nem registradas em logs.
- Falhas parciais preservam o registro, paths e etapas já confirmadas. A recuperação não repete uploads ou associações concluídos e reconcilia respostas incertas consultando o objeto e `storage_path` antes de continuar. Não há rollback fictício nem `DELETE` cliente; objetos enviados sem linha confirmada ainda podem ficar órfãos.
- Como 04A não possui chave idempotente de requisição para `growth_entries`, uma resposta incerta na criação é reconciliada por usuário, planta, `observed_at` e conteúdo. Resultado único é reutilizado, resultado ambíguo bloqueia nova criação, mas concorrência idêntica entre sessões não possui garantia transacional. Uma chave idempotente de banco permanece uma melhoria futura; nenhuma migration adicional foi criada nesta entrega.
- A linha do tempo identifica o perfil atual e usa “Membro do jardim” para outros autores enquanto a RLS de `profiles` não permitir nomes. Plantas arquivadas mantêm o histórico e bloqueiam o formulário de criação.
- Fotografias podem ser ampliadas em diálogo responsivo, com restauração e contenção de foco, ESC e setas do teclado, além de controles visíveis no mobile.

**Status da Entrega 04B:** a homologação funcional foi concluída com 12/12 verificações aprovadas, incluindo registros de crescimento, medições, múltiplas fotografias, paginação, persistência após recarga, recuperação parcial, histórico de plantas arquivadas, troca de jardim/planta e responsividade mobile.

Roteiro de regressão funcional e homologação real de segurança da 04B:

1. Crie um registro somente com observação e confirme o horário no fuso do jardim.
2. Crie um registro somente com fotos e outro com altura e folhas; confirme persistência após recarregar.
3. Envie várias fotos JPEG, PNG e WebP válidas, abra as miniaturas e percorra a ampliação por controles, ESC, Tab, Shift+Tab e setas em desktop e mobile.
4. Simule falha no segundo upload; confirme que o registro e a primeira foto não são duplicados e retome somente a fotografia pendente.
5. Simule falha após upload e antes da associação; confirme reconciliação pelo mesmo path, ausência de reupload e sinalização do risco residual de objeto órfão.
6. Tente GIF, arquivo acima de 5 MiB, altura negativa ou não finita, folhas negativas ou fracionárias e formulário sem conteúdo; todos devem ser rejeitados.
7. Crie mais de 8 registros e confirme paginação, ordem estável do mais recente ao mais antigo e ausência de carregamento integral.
8. Arquive a planta; confirme histórico e fotografias legíveis, com criação e upload bloqueados. A foto principal deve permanecer inalterada.
9. Alterne jardim e planta durante consultas e após uploads; confirme ausência de mistura de dados ou cache.
10. Com dois usuários de jardins distintos e sem `service_role`, tente consultas, inserts, updates, uploads e URLs assinadas cruzadas; tudo deve ser vazio ou negado.

Os testes locais cobrem schemas, timezone, paginação contratual, chaves de cache, fluxo parcial e reconciliação. Eles não comprovam RLS, Storage, timeouts ou concorrência reais no Supabase; o item 10 e as falhas reais continuam pendentes até homologação com sessões autenticadas.

### Gráficos e comparação fotográfica — Entrega 04C

- A área “Ver gráfico e comparar fotos” é carregada por `React.lazy` somente quando aberta. O build da 04B tinha bundle inicial de 759,33 kB; com a 04C ele ficou em 760,12 kB, enquanto o novo chunk assíncrono `growth-insights` possui 10,54 kB. O aviso do bundle inicial acima de 500 kB permanece pendente.
- O gráfico busca todas as alturas válidas em lotes limitados de 200, sempre filtrados por jardim e planta e ordenados por `observed_at, id`. Registros sem altura não criam pontos. Com menos de duas medições, a interface explica que ainda não há evolução suficiente.
- O SVG usa espaçamento categórico na ordem cronológica, sem interpolar valores ausentes. Medições do mesmo dia permanecem pontos independentes e são distinguíveis pelo instante completo na tabela acessível em PT-BR e no fuso do jardim.
- O seletor de comparação consulta `plant_photos` independentemente das páginas de 8 registros do diário. Ele carrega 24 metadados por página, assina somente os paths carregados por 10 minutos e renova as consultas antes da expiração; fotografias antigas são obtidas sob demanda.
- Somente fotos retornadas pela consulta do jardim e planta atuais podem ser selecionadas. A comparação mostra duas imagens sem corte, lado a lado a partir de telas médias e empilhadas no mobile, com datas derivadas de `taken_at`, do registro ou da criação, nessa ordem.
- A área trata ausência de dados, seleção incompleta, carregamento, erro e URL indisponível. Não executa upload, alteração ou exclusão. Plantas arquivadas mantêm gráfico e comparação em modo somente leitura.
- Após um novo registro da 04B, a invalidação comum de `growth` atualiza timeline, gráfico e seletor do mesmo jardim e planta. Caches continuam isolados pelo escopo completo.

**Status da Entrega 04C:** a homologação funcional foi concluída com 12/12 cenários aprovados. O cabeçalho do relatório recebido indicava 11/12, mas a revisão dos resultados individuais confirmou os 12 testes como `APROVADO`, incluindo gráfico completo, medições repetidas, comparação de fotos antigas, fuso horário, isolamento visual, planta arquivada e responsividade.

Roteiro de regressão funcional e homologação real de segurança da 04C:

1. Crie duas medições de altura e confirme o gráfico, os valores em centímetros e a tabela acessível.
2. Adicione registros sem altura e confirme que nenhum ponto artificial é criado.
3. Crie medições suficientes para exceder uma página do diário e confirme que o gráfico usa todas, inclusive medições repetidas no mesmo dia.
4. Compare duas fotografias de registros diferentes e valide datas, seleção por teclado e touch e ausência de cortes inesperados.
5. Carregue páginas adicionais e compare fotografias antigas que não aparecem na página atual da timeline.
6. Confira datas próximas à virada do dia no timezone do jardim e a formatação PT-BR.
7. Valide gráfico, tabela e comparação em 375 px, 390 px e desktop.
8. Troque de jardim e de planta e confirme ausência de mistura de medições, fotografias ou seleções.
9. Arquive a planta e confirme gráfico e comparação disponíveis sem qualquer ação de escrita.
10. Valide zero e uma medição, menos de duas fotos, URL indisponível, loading, erro e recuperação por nova consulta.

Os testes locais validam regras, paginação contratual, cache, fuso e estados de interface, mas não comprovam RLS ou Storage reais. A homologação cross-garden continua pendente até testes com duas sessões autenticadas e sem `service_role`.

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

### Tela Hoje da Entrega 03C

**Status em 19/11/2026:** a homologação funcional foi concluída com 10/10 verificações aprovadas, incluindo indicadores, cuidados pendentes, ações rápidas, histórico, fotografias privadas, troca de jardim e responsividade mobile. Permanecem pendentes a homologação real RLS/Storage entre jardins, os testes reais de concorrência e idempotência da RPC, a identificação segura dos demais membros, a limpeza de fotografias órfãs e a otimização do bundle.

- **Plantas ativas** conta `plants.status = active` no jardim selecionado.
- **Verificações** conta agendas `watering_check` ativas, de plantas não arquivadas, com `next_due_date` anterior ou igual à data civil atual do jardim.
- **Outros cuidados** aplica a mesma regra às demais categorias. Agendas futuras, inativas e plantas arquivadas não entram nos contadores.
- “Precisam de atenção” mostra até 20 agendas vencidas ou previstas para hoje, ordenadas por data e ID. “Próximos cuidados” mostra até 5 agendas futuras e não constitui calendário.
- Atividades recentes mostram os 5 eventos reais mais novos do jardim. Outros atores continuam identificados como “Membro do jardim” por causa da RLS atual de `profiles`.
- Fotos são obtidas por signed URLs privadas. Consultas, caches e invalidações incluem o jardim ativo; ações rápidas reutilizam a RPC e a intenção idempotente da 03B.
- Uma falha incerta mantém UUID, horário e payload para retry. A lista só é atualizada depois da resposta do backend ou de uma refetch após erro.

Roteiro de homologação real de segurança e concorrência da 03C, ainda pendente:

1. Crie agendas vencidas, para hoje e futuras; confirme contadores, ordem crescente, destaque de atraso e separação das seções.
2. Registre rega e confirme evento, recálculo da agenda, indicadores, pendências, próximos cuidados e atividade recente.
3. Registre solo úmido e confirme `moisture_checked`, sem evento de rega.
4. Adie um cuidado e confirme sua movimentação para a seção correspondente; conclua também um cuidado não relacionado à rega.
5. Verifique foto privada, ausência de fotografia, timezone do jardim e virada da data civil.
6. Alterne jardins durante carregamentos e confirme ausência de dados cruzados ou respostas atrasadas visíveis.
7. Valide layout e uso por teclado em 375 px, 390 px e desktop.
8. Com duas sessões autenticadas e sem `service_role`, teste isolamento de leitura/escrita, acesso revogado, retry do mesmo `request_id`, ações simultâneas distintas e conflito por agenda desativada ou planta arquivada.

Os testes locais não comprovam RLS, locks, idempotência ou concorrência reais. Esses pontos permanecem pendentes até execução no Supabase de homologação.

### Calendário de cuidados da Entrega 03D

- A rota `/app/calendar` é carregada por `React.lazy`, com fallback próprio, e oferece visualização semanal ou mensal. No primeiro acesso da sessão, o padrão é semana no celular e mês no desktop; a escolha manual fica em `sessionStorage`.
- Agendas são consultadas no servidor pelo intervalo civil visível, limitadas a 200, ativas e sem plantas arquivadas. Somente `next_due_date` é exibida: o frontend não projeta recorrências futuras.
- Eventos são consultados em uma janela UTC ampliada, limitados a 200, e posicionados pela data local em `gardens.timezone`. Eventos de plantas arquivadas e regas espontâneas continuam no histórico.
- Previsto, vencido, realizado, solo verificado e adiamento são estados distintos. Agenda e evento no mesmo dia permanecem itens separados e rotulados.
- Filtros por planta e tipo são aplicados igualmente à grade, resumo do dia e detalhes. Trocar de jardim remonta o estado da tela e remove caches incompatíveis.
- Itens previstos elegíveis reutilizam a RPC e a intenção idempotente da 03B. Após sucesso ou falha incerta, Calendário, Hoje e detalhes da planta são invalidados.
- Itens históricos são somente leitura. Outros atores continuam identificados como “Membro do jardim” enquanto a RLS de `profiles` não autorizar seus nomes.

Homologação funcional da 03D aprovada com 12/12 verificações, cobrindo visualização semanal e mensal, navegação entre períodos, retorno para hoje, filtros, seleção e resumo de dias, detalhes, histórico, ações rápidas, isolamento visual entre jardins, fuso horário do jardim e responsividade mobile/desktop.

Roteiro real de segurança e concorrência da 03D, ainda pendente:

1. Abra Calendário em 375 px, 390 px e desktop; confirme padrão semana/mês, troca manual persistida na sessão, navegação anterior/próxima e botão Hoje.
2. Valide semanas e grades mensais que cruzam mês e ano, seleção de dias e timezone do jardim próximo à meia-noite UTC.
3. Crie agenda vencida, para hoje e futura; confirme somente a próxima ocorrência persistida, sem projeções inventadas.
4. Registre rega, inspeção, adiamento, conclusão e rega espontânea; confirme estados separados e histórico nas datas locais corretas.
5. Aplique filtros por planta e tipo, limpe-os e confirme estados vazios distintos.
6. Abra detalhes de agenda e evento; confirme ações somente para agendas ativas de plantas elegíveis e histórico somente leitura.
7. Execute ação rápida e confirme atualização do Calendário, Hoje, agenda e histórico. Simule falha incerta e repita a mesma intenção.
8. Arquive uma planta e confirme ausência de novos previstos e preservação de eventos históricos.
9. Alterne jardins durante carregamentos e confirme ausência de dados cruzados.
10. Com duas contas autenticadas e sem `service_role`, tente ler e agir sobre IDs do outro jardim; valide também retry idempotente e ações simultâneas distintas.

Testes locais e contratos não comprovam RLS, locks, concorrência ou idempotência reais. O limite de 200 itens é sinalizado na interface; paginação incremental pode ser adicionada se um único período atingir esse volume.

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

### Perfil e configurações da Entrega 05A

A Entrega 05A adiciona edição do nome público e avatar privado, leitura do e-mail, edição administrativa do nome e timezone IANA do jardim e a RPC `list_garden_authors`, que retorna somente `user_id`, nome público e caminho do avatar de membros do mesmo jardim. A migration incremental `202611200001_profile_and_garden_settings.sql` foi aplicada manualmente no Supabase e teve suas verificações estruturais aprovadas. A homologação funcional da Entrega 05A foi aprovada com 12/12 verificações; os testes reais de RLS/Storage permanecem pendentes.

- O bucket `avatars` permanece privado, aceita JPEG, PNG e WebP até 5 MiB e não concede `DELETE` ao cliente. O banco armazena somente o caminho; signed URLs de 10 minutos não são persistidas.
- O perfil só pode alterar suas próprias colunas já autorizadas. Jardins continuam protegidos por `gardens_update_admin`; a validação de timezone ocorre no cliente e no PostgreSQL.
- Membros podem visualizar as configurações, mas apenas administradores podem alterá-las. A troca de timezone exige confirmação e não recalcula datas civis ou eventos persistidos.
- A reinspeção após solo úmido permanece específica por rotina em `care_schedules.settings.moisture_recheck_days`, com padrão de 2 dias. Nenhuma preferência global redundante foi criada.
- A RPC de autores exige membership no jardim solicitado, não retorna e-mail e deixa usuários removidos com fallback neutro no histórico. Testes contratuais não substituem a validação real de RLS e Storage.

Roteiro de homologação funcional e de segurança real, ainda pendente:

1. Com dois usuários e dois jardins, altere nome e avatar de cada perfil e confirme que signed URLs expiram, paths não são públicos e o outro jardim não consegue ler o objeto.
2. Como administrador, altere nome e timezone para um identificador IANA válido; confirme o aviso, a preservação das datas persistidas e o novo cálculo civil apenas em ações futuras.
3. Como membro, leia as configurações e tente atualizá-las pelo formulário e pela API; ambas as escritas devem ser negadas.
4. Registre cuidados e crescimento pelos dois membros e confirme nomes públicos autorizados, sem e-mails. Revogue uma membership e confirme fallback neutro e ausência de acesso posterior ao avatar.
5. Alterne rapidamente entre jardins e valide que perfil contextual, autores, configurações e caches não se misturam.
6. Teste falha após upload e antes da associação do avatar; o objeto pode exigir reconciliação, pois não há `DELETE` amplo. Revogue também sessões e considere o risco residual de signed URLs emitidas antes da revogação.

Permanecem pendentes a homologação real de RLS/Storage entre jardins, concorrência e idempotência das RPCs, idempotência transacional do crescimento, reconciliação de fotografias e avatares órfãos, paginação, otimização do bundle, PWA, backups e a avaliação dos limites do plano gratuito.

### Convites familiares da Entrega 05B

A migration incremental `202611200002_garden_invites.sql` cria convites familiares de uso único e foi aplicada manualmente no Supabase. As verificações estruturais confirmaram RLS ativo em `garden_invites`, a política administrativa de `SELECT`, as RPCs de criação, aceitação e revogação disponíveis para `authenticated` e indisponíveis para `anon`, e a RPC de inspeção disponível para `anon` e `authenticated`. A homologação funcional e os testes reais de segurança, isolamento e concorrência continuam pendentes.

- Somente administradores criam, listam e revogam convites do jardim ativo. O papel do convidado é sempre `member` e não pode ser escolhido pelo cliente.
- O token possui 32 bytes aleatórios, expira em sete dias e é retornado em texto puro somente pela criação. O banco persiste apenas SHA-256; listagens nunca retornam token ou hash.
- O aceite autenticado bloqueia o convite com `FOR UPDATE`, valida expiração, revogação e uso, e cria a membership na mesma transação. Repetição pelo mesmo usuário é idempotente; outro usuário recebe falha neutra.
- O token é removido da URL imediatamente e mantido apenas em `sessionStorage` durante login ou cadastro. A aplicação usa `Referrer-Policy: no-referrer`, não registra o segredo e gera links a partir da origem efetiva. A remediação 06A.1 abaixo substitui a query string por fragmento nos novos links.
- Usuário que já pertence ao jardim recebe retorno seguro sem consumir o convite. Após aceite, o bootstrap e os autores são recarregados e o novo jardim é selecionado.

Roteiro manual pendente para Supabase de homologação:

1. Aplique a migration revisada e use três sessões: administrador do Jardim A, membro de A e usuário externo com Jardim B.
2. Confirme que apenas o administrador cria/lista/revoga, que a listagem não contém token/hash e que links usam a origem correta.
3. Aceite como usuário externo e confirme membership `member`, seleção imediata do Jardim A e ausência de acesso administrativo.
4. Teste convite expirado, revogado, inválido e já utilizado; nenhum deles deve criar membership ou revelar o nome do jardim.
5. Aceite simultaneamente o mesmo convite em duas sessões e confirme uma única membership e um único `accepted_by`.
6. Repita o aceite pelo mesmo usuário e teste usuário que já era membro; confirme comportamento idempotente sem elevação de papel.
7. Faça login e cadastro pelo link, incluindo confirmação de e-mail, recarga, falha de rede e reabertura quando a sessão do navegador for perdida.
8. Tente consultar e revogar convites do outro jardim pela API, sem `service_role`; todas as operações devem ser vazias ou negadas.

**Status da Entrega 05B:** homologação funcional aprovada com 12/12 verificações. Testes contratuais não comprovam RLS, locks ou concorrência reais; os testes reais acima e todos os débitos anteriores de RLS/Storage cross-garden, concorrência e idempotência das RPCs, idempotência do diário, limpeza de fotos órfãs, paginação, bundle, PWA e backups permanecem pendentes.

### Remediação de segurança dos convites da Entrega 06A.1

Novos convites usam `/invite#token=...`. O fragmento não integra a requisição HTTP inicial ao hosting, CDN ou proxy. A página captura o segredo, remove-o imediatamente da URL com `history.replaceState` e o mantém somente no `sessionStorage` da aba enquanto login, cadastro e confirmação de e-mail ocorrem no mesmo contexto. O fragmento continua acessível ao JavaScript e não protege contra XSS; o token continua sendo um segredo compartilhável até uso, expiração ou revogação.

Links legados `/invite?token=...` continuam aceitos temporariamente. A página captura o valor e remove o parâmetro sem propagá-lo, preservando os demais parâmetros e fragmentos legítimos. A compatibilidade pode ser removida após a publicação desta versão, a revogação dos convites antigos pendentes e o término do prazo de sete dias do último convite emitido pela versão anterior. Novos links nunca usam query string.

O botão de WhatsApp que montava o convite na query de `wa.me` foi substituído pelo compartilhamento nativo do navegador. Quando essa API não está disponível, a aplicação copia o link. O destino escolhido pelo usuário recebe o convite porque precisa entregá-lo ao destinatário, mas a aplicação não cria uma URL HTTP intermediária com o segredo. A meta `Referrer-Policy: no-referrer` permanece ativa em `index.html` para todas as rotas da SPA.

Tokens válidos permanecem na sessão da aba para permitir inspeção e aceite depois do login. Tokens inválidos, expirados, revogados, usados ou aceitos são descartados. `sessionStorage` não atravessa outro navegador e não oferece recuperação confiável quando a confirmação de e-mail abre um contexto diferente; nessa situação, a interface orienta a reabrir o link original, sem persistir o segredo em `localStorage` ou cookie.

Homologação posterior em ambiente com Node 24 LTS:

1. Execute `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd test` e `npm.cmd run build`.
2. Confirme que um novo link contém o token apenas após `#`, que a primeira requisição observada não contém o segredo e que a URL fica limpa logo após a abertura.
3. Teste o link legado e confirme que `?token=` desaparece sem ser reemitido em navegação, redirect, erro, log ou telemetria.
4. Valide inspeção e aceite após login, cadastro sem confirmação e cadastro com confirmação de e-mail na mesma aba.
5. Abra a confirmação em outra aba e em outro navegador; confirme a orientação para reabrir o link e a ausência de alegação de recuperação automática.
6. Teste convite inválido, expirado, revogado, usado e falha de rede; nenhum estado deve revelar o token ou criar membership indevida.
7. Valide cópia, compartilhamento nativo, reload e layout em 375 px, 390 px e desktop.
8. Com contas distintas e evidências sanitizadas, revalide RLS, uso único e concorrência antes de commit, push ou deploy.

Esta alteração trata o SEC-06A-001. Permanecem abertos os demais achados do relatório `docs/audits/06A-security-audit.md`, inclusive SEC-06A-002 sobre consumo por membro existente, SEC-06A-003 sobre `avatar_path`, SEC-06A-004 sobre prova dinâmica de isolamento e as verificações operacionais de Auth, headers, logs e rate limits. Nenhuma RPC, grant, policy RLS ou migration foi alterada nesta entrega.

**Status da Entrega 06A.1:** homologação funcional aprovada com 12/12 verificações, conforme confirmação do responsável. Essa aprovação funcional não comprova o isolamento remoto, não encerra os demais achados da auditoria e não altera o status **NO-GO para abertura pública como SaaS**.

**Validação local da Entrega 06A.1:** NÃO EXECUTADA — o Node.js 21.5.0 deste PC é incompatível com Vite 8/Rolldown. Os testes foram escritos e revisados estaticamente; lint, typecheck, testes e build aguardam ambiente com Node 24 LTS.

### Gestão de membros da Entrega 05C

A migration incremental `202611200003_garden_member_management.sql` adiciona RPCs de escopo mínimo para listar membros, promover/rebaixar, remover e sair de um jardim. Ela foi aplicada manualmente no Supabase e passou nas verificações estruturais das RPCs, permissões `EXECUTE` para `authenticated`, revogação de acesso público e locks de proteção do último administrador.

- `list_garden_members` retorna somente ID, nome público, avatar, papel e data de entrada quando o solicitante ainda pertence ao jardim; nenhum e-mail é exposto.
- `manage_garden_member` aceita apenas `promote`, `demote` ou `remove`, exige administrador e não permite agir sobre o próprio usuário. A saída própria usa exclusivamente `leave_garden`.
- As mutações bloqueiam a linha de `gardens` antes de conferir e alterar memberships. Esse lock serializa remoções, rebaixamentos e saídas concorrentes; o jardim nunca pode ficar sem administrador.
- Nenhum `UPDATE` ou `DELETE` direto em `garden_members` foi concedido ao cliente. Perfis, cuidados, crescimento, fotografias e autoria histórica não são excluídos.
- Após remoção ou saída, caches do jardim são removidos e o bootstrap é recarregado. URLs assinadas emitidas anteriormente podem permanecer válidas até sua expiração.

Roteiro de homologação real pendente:

1. Aplique a migration revisada em homologação e abra sessões para dois administradores, um membro e um usuário de outro jardim.
2. Confirme listagem autorizada sem e-mail e ausência de controles administrativos para o membro comum.
3. Promova e rebaixe membros; valide o papel no banco e tente chamar a RPC administrativa como membro comum.
4. Remova um membro e confirme perda imediata de consultas, RPCs, autores e novas signed URLs, preservando todo o histórico.
5. Saia voluntariamente como membro e como administrador quando houver outro admin; confirme seleção segura de outro jardim ou fluxo sem jardim.
6. Tente remover, rebaixar e fazer sair o último administrador; todas as operações devem falhar.
7. Em duas sessões, tente simultaneamente remover/rebaixar/sair com os últimos administradores e confirme que o lock preserva ao menos um admin.
8. Use IDs de outro jardim em todas as RPCs e confirme respostas negadas e neutras, sem enumeração.
9. Valide confirmações, teclado e layout em 375 px, 390 px e desktop.

**Status da Entrega 05C:** homologação funcional aprovada com 12/12 verificações, incluindo promoção, rebaixamento, remoção, saída voluntária, proteção do último administrador, isolamento visual entre jardins, preservação do histórico e responsividade mobile. Com as Entregas 05A, 05B e 05C homologadas, o Épico 05 está funcionalmente aprovado.

Testes locais são contratuais e não comprovam RLS, revogação de acesso ou concorrência reais. Permanecem pendentes os testes reais de segurança e concorrência da 05C e todos os débitos técnicos e de segurança anteriores, incluindo a homologação PWA separada da aprovação funcional do épico.

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

Implementado: autenticação, perfil provisionado, jardins e memberships seguros, persistência/RLS de plantas, cadastro/listagem/detalhes/edição de plantas, arquivamento/restauração, troca de foto principal privada por signed URL, diário de crescimento com múltiplas fotografias privadas, linha do tempo paginada, recuperação parcial, gráfico completo de altura e comparação fotográfica paginada, estrutura/RLS/RPC de cuidados, interface de rotinas/eventos, tela Hoje e Calendário semanal/mensal com dados reais, filtros, detalhes e ações rápidas, seletor de jardim, layout responsivo e infraestrutura Vercel.

Ainda não implementado: idempotência transacional da criação do diário, projeção de recorrências futuras, paginação incremental do calendário acima de 200 itens, remoção/limpeza e reconciliação segura de fotos antigas ou órfãs, compressão de imagens, notificações, offline e pagamentos. Permanecem pendentes as homologações reais de RLS/Storage dos Épicos 02 e 04, os testes reais de RLS/RPC/concorrência/idempotência das Entregas 03A–03D, a identificação segura de outros membros no histórico, a otimização do bundle inicial e a homologação PWA do Épico 05.

O manifest usa diretamente o asset original disponível de 192×192. Para PWA completa, forneça posteriormente um ícone original de 512×512; esta entrega não inventa upscale ou redesenho.
