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
2. Aplique `supabase/migrations/202611170001_foundation.sql` com `supabase db push` em um projeto vinculado ou cole o conteúdo no SQL Editor.
3. Em **Authentication > URL Configuration**, configure **Site URL** com a URL local ou de produção.
4. Adicione em **Redirect URLs**: `http://localhost:5173/**` e `https://SEU-DOMINIO-VERCEL/**`.
5. Em **Authentication > Providers > Email**, decida se confirmação de e-mail será obrigatória. O frontend respeita ambos os modos.
6. Para um ambiente familiar fechado, desabilite novos cadastros nas configurações reais de Auth quando terminar os testes. Esconder o botão no frontend não bloqueia a API de cadastro. Convites seguros ficam para etapa futura.

A migration cria `profiles`, `gardens`, `garden_members`, índices, triggers, RLS e a RPC transacional `create_garden`. As funções de verificação usam `SECURITY DEFINER` com `search_path` vazio para evitar recursão nas policies. Clientes autenticados não recebem permissão de inserir ou alterar memberships.

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

## Escopo atual

Implementado: autenticação, perfil provisionado, jardins e memberships seguros, seletor de jardim, estados vazios de Hoje e Plantas, páginas honestas de Calendário, layout responsivo e infraestrutura Vercel.

Ainda não implementado: plantas, fotos, cuidados, calendário funcional, convites, gestão de membros, notificações, offline e pagamentos. Os indicadores são zero verdadeiro porque as tabelas futuras ainda não existem; nenhuma query é feita contra elas. O próximo incremento recomendado é CRUD real de plantas com fotos privadas.

O manifest usa diretamente o asset original disponível de 192×192. Para PWA completa, forneça posteriormente um ícone original de 512×512; esta entrega não inventa upscale ou redesenho.
