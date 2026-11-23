# Meu Jardim — executor de homologação de segurança 06A.2

## Estado e limite desta entrega

O executor foi implementado e validado somente de forma local com mocks. Nenhuma conexão com Supabase, conta, fixture, migration, policy, grant ou resultado de `06A2-isolation-results.md` foi criado ou alterado. Os 71 casos permanecem **NÃO EXECUTADOS**, SEC-06A-004 permanece não verificado e a abertura pública continua **NO-GO**.

O catálogo contém os 71 IDs na ordem do plano: 22 automatizados, 45 híbridos e 4 manuais. `Automatizado` descreve um contrato que pode ser executado por transporte futuro; `híbrido` exige confirmação de fixture/integridade ou intervenção controlada; `manual` depende de navegador, tempo ou revisão humana. Nenhuma dessas classificações significa aprovação.

## Uso offline

O comando padrão valida exclusivamente `.env.homolog.local`, recusa chave privilegiada e lista o catálogo sem realizar rede:

```powershell
npm.cmd run test:security:homolog
npm.cmd run test:security:homolog -- --group=plants
npm.cmd run test:security:homolog -- --case=PL-01
```

Uma seleção isolada com dependências pendentes falha fechada. A saída mostra apenas ID, grupo, ator, modo, natureza de leitura/mutação e operação. Ela termina com `MODE=OFFLINE NETWORK=DISABLED RESULTS=NOT_EXECUTED`.

## Arquivos locais e entrada segura

- `.env.homolog.local`: URL HTTPS exata e chave `anon` legada ou `sb_publishable_`; não aceita `.env.local`, variáveis de processo ou outro projeto.
- `.security/homolog-fixtures.local.json`: manifesto operacional com project ref, prefixo, UUIDs completos, paths exatos e memberships esperadas.
- `.security/homolog-authorization.local.json`: registro da autorização, confirmação do alvo, escopos separados de leitura/mutação e janela de execução.

Os dois JSON locais e todos os `.env.*.local` são ignorados pelo Git. Copie os exemplos, preencha localmente e nunca acrescente senhas, JWTs, refresh tokens, chaves, tokens/hashes/links de convite ou signed URLs. Credenciais de usuários não devem ser passadas por argumento nem registradas em evidência. Uma implementação futura do transporte deve receber sessões por mecanismo seguro separado e sem persistência compartilhada.

## Portões para execução remota futura

O modo remoto permanece deliberadamente indisponível nesta entrega. Mesmo assim, a preparação falha antes de qualquer transporte se faltar:

1. `.env.homolog.local` válido para `gmbwavdzfljvfdvnroiz`;
2. `--remote --confirm-target=gmbwavdzfljvfdvnroiz`;
3. autorização escrita, alvo confirmado e janela vigente;
4. autorização de leitura e, para qualquer caso mutável, autorização de mutação separada;
5. manifesto de fixtures válido e restrito ao mesmo project ref;
6. identidade e memberships A/B/C confirmadas antes da fase;
7. dependências anteriores aprovadas na mesma rodada.

Após esses portões, o executor ainda encerra com `REMOTE_TRANSPORT_NOT_ENABLED_IN_THIS_DELIVERY`. Habilitar transporte exige revisão e autorização separadas. O cliente futuro deverá usar instâncias independentes A/B/C/anon com `persistSession: false`, `autoRefreshToken: false` e sem tokens compartilhados, validar o destino efetivo de toda requisição, usar redirect manual e recusar `Location` fora do host autorizado.

## Fixtures, mutações e parada

Antes de cada mutação, o executor deve confirmar por leitura autorizada: existência, proprietário, prefixo, relações e presença de todos os IDs/paths na allowlist. Paths de plantas devem corresponder exatamente a jardim e planta. Não há criação ou limpeza automática de fixtures.

Uma resposta vazia só pode aprovar uma negativa depois do controle positivo e da releitura de integridade. Erro de autenticação, payload inválido ou ID inexistente não prova RLS. Timeout em mutação bloqueia o caso e nunca gera retry automático. Acesso indevido reprova o caso, interrompe o grupo e bloqueia dependências; dúvida sobre alvo ou integridade deve interromper toda a rodada.

Revogação é executada somente depois dos casos que dependem da membership. Convites exigem identidades externas elegíveis e fixtures independentes. `IN-05` permanece bloqueado para expirado sem fixture previamente autorizada. Se A/B/C não bastarem, a rodada deve parar para autorização de conta adicional ou sequência controlada.

## Evidência

O sanitizador permite somente campos simples como ID do caso, ator simbólico, status, código, contagem, booleanos e integridade. Ele remove campos ou valores que aparentem conter Authorization, JWT, refresh token, senha, chave, token, signed URL, corpo ou mensagem bruta. IDs apresentados fora do manifesto operacional devem ser mascarados.

Um caso com `attempted=false`, manual ou sem controle positivo nunca pode receber `APPROVED`. Achado conhecido reproduzido recebe registro de falha/desvio; não é aprovação de segurança.

## Catálogo remoto somente leitura

O procedimento está em `docs/audits/06A2-catalog-readonly.sql`. Ele compara relações/RLS, policies, grants de tabela e coluna, funções/ACL/search_path, constraints, triggers, índices, `security_invoker` e buckets com as sete migrations. Deve ser executado manualmente apenas em janela autorizada e exportado de forma sanitizada.

Histórico 7/7 de migrations não demonstra equivalência efetiva do catálogo. Catálogo equivalente também não demonstra isolamento comportamental A/B/C.

## Testes locais do executor

Os mocks cobrem alvo incorreto e fallback de produção, chave privilegiada, autorização ausente, identidade/membership incorretas, ID fora da allowlist, path cruzado, dependências ausentes, sanitização, zero linhas sem controle positivo, falha de integridade, parada após acesso indevido, timeout sem retry, os 71 IDs únicos, impossibilidade de aprovar caso não executado e ausência de rede.

Os débitos de bundle, concorrência, idempotência, Storage, signed URLs, cache/revogação, objetos órfãos, headers, Auth, rate limits e backups permanecem abertos.
