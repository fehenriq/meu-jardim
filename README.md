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
3. Em **Authentication > URL Configuration**, configure **Site URL** com a URL local ou de produção.
4. Adicione em **Redirect URLs**: `http://localhost:5173/**` e `https://SEU-DOMINIO-VERCEL/**`.
5. Em **Authentication > Providers > Email**, decida se confirmação de e-mail será obrigatória. O frontend respeita ambos os modos.
6. Para um ambiente familiar fechado, desabilite novos cadastros nas configurações reais de Auth quando terminar os testes. Esconder o botão no frontend não bloqueia a API de cadastro. Convites seguros ficam para etapa futura.

A fundação cria `profiles`, `gardens`, `garden_members`, índices, triggers, RLS e a RPC transacional `create_garden`. A migration incremental cria `plants`, suas policies e o bucket privado `plant-photos`; ela não altera as tabelas ou funções da fundação.

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

## Escopo atual

Implementado: autenticação, perfil provisionado, jardins e memberships seguros, persistência/RLS de plantas, Storage privado preparado, seletor de jardim, estados vazios de Hoje e Plantas, páginas honestas de Calendário, layout responsivo e infraestrutura Vercel.

Ainda não implementado: telas/hooks de CRUD de plantas, upload/compressão/signed URLs no cliente, cuidados, calendário funcional, convites, gestão de membros, notificações, offline e pagamentos. A camada de banco de plantas existe, mas o frontend ainda não a consulta nesta Entrega 02A.

O manifest usa diretamente o asset original disponível de 192×192. Para PWA completa, forneça posteriormente um ícone original de 512×512; esta entrega não inventa upscale ou redesenho.
