# Meu Jardim — 06A.2.6: análise das divergências de privilégios

## Diagnóstico

As sete migrations explicam o resultado. A migration de fundação revoga as tabelas somente de `anon` e depois concede privilégios estreitos a `authenticated`; ela não remove antes os grants de tabela que o Supabase aplica aos objetos novos. Assim, os grants amplos preexistentes de `authenticated` em `profiles`, `gardens` e `garden_members` sobrevivem e tornam os grants por coluna cumulativos. Em PostgreSQL 17, `gardens` e `garden_members` também preservaram `MAINTAIN`. As migrations posteriores de tabelas fazem a sequência segura `REVOKE ... FROM anon, authenticated` antes dos grants mínimos.

Nas funções, as migrations usam `REVOKE ALL ... FROM PUBLIC`, seguido dos grants desejados. `PUBLIC` é o grupo implícito de todos os papéis; revogá-lo não remove grants registrados diretamente para `anon` ou `authenticated`, nem privilégios herdados. Isso explica `public_execute=false` e `anon_execute=true` simultaneamente.

O PostgreSQL soma privilégios de tabela, coluna, `PUBLIC`, grants diretos e memberships. Um grant de tabela `UPDATE` permite atualizar todas as colunas e não é reduzido por um grant posterior `UPDATE (name, timezone)`. Primeiro é necessário revogar o privilégio no nível da tabela; só então o grant por coluna delimita a operação.

## Impacto

- `SELECT`, `INSERT`, `UPDATE` e `DELETE` continuam sujeitos às policies RLS. Ausência de policy produz negação padrão. Isso reduz o impacto em `garden_members`, que não tem policies de escrita, mas não corrige a ACL excessiva.
- `gardens` possui policy de UPDATE para administradores. Com UPDATE no nível da tabela, um administrador pode alcançar colunas fora de `name` e `timezone`, inclusive `created_by`, se a API expuser a coluna. É um caminho explorável sustentado pela estrutura, ainda não comprovado por execução.
- `TRUNCATE` não passa por RLS. O grant é crítico caso o papel obtenha uma via SQL; a API REST comum não oferece a operação diretamente. Não há exploração comprovada.
- `REFERENCES` também não passa por RLS. Permite criar FKs e pode ampliar risco através de funções chamadas pela constraint, mas exige uma via DDL e privilégios adicionais.
- `TRIGGER` permite criar triggers no objeto e exige uma via DDL e privilégios adicionais. Triggers executam durante operações posteriores, logo o grant não deve permanecer em papéis clientes.
- `MAINTAIN` permite operações administrativas como `VACUUM`, `ANALYZE`, `CLUSTER`, `REFRESH MATERIALIZED VIEW`, `REINDEX` e locks relacionados. Não é necessário ao aplicativo e deve ser removido dos papéis clientes em PostgreSQL 17.

## Funções anônimas

As 14 RPCs anônimas constituem exposição estrutural confirmada. Funções que checam `auth.uid()` internamente podem negar o uso anônimo, mas isso transfere a segurança para cada corpo `SECURITY DEFINER`. Somente `inspect_garden_invite(text)` tem contrato anônimo. As oito auxiliares também devem perder EXECUTE de cliente; funções com retorno `trigger` não precisam desse grant para serem executadas pelos triggers.

Nenhuma vulnerabilidade foi comprovada dinamicamente porque não houve chamada anônima, DML, DDL ou teste A/B/C. Os achados são divergências estruturais confirmadas, com caminhos de exploração indicados onde a combinação de ACL e policy os sustenta.

## Default privileges e recorrência

O inventário confirmou defaults no schema `public` para `postgres` e `supabase_admin`. Ambos concedem automaticamente a `anon` e `authenticated` oito privilégios de tabela, EXECUTE em funções e SELECT/UPDATE/USAGE em sequences. CAT-06A2-004 passa, portanto, de hipótese causal para divergência estrutural confirmada. Default privileges só afetam objetos futuros e são definidos por papel criador; alterá-los não corrige objetos existentes.

Para `postgres`, o hardening precisa distinguir dois níveis. Grants por schema podem ser removidos no escopo `IN SCHEMA public`. Já o EXECUTE que o PostgreSQL concede globalmente a `PUBLIC` em funções novas deve ser revogado no escopo global do papel criador; um `REVOKE` apenas `IN SCHEMA public` não anula um grant global. A revisão deve inventariar e tratar separadamente `PUBLIC`, `anon` e `authenticated`.

Os defaults de `supabase_admin` são administrados pela plataforma e podem ser necessários a componentes internos. Eles ficam registrados como risco recorrente, mas não integram a migration proposta sem justificativa técnica, teste de impacto e aprovação específica. A defesa local continua sendo revogar ACLs explicitamente em cada migration do aplicativo.

Mesmo após hardening de defaults, cada migration deve revogar explicitamente `anon`, `authenticated` e `PUBLIC` no mesmo escopo transacional da criação, antes de regrantar o mínimo. Isso evita depender da configuração externa e cobre owners cujos defaults não possam ser alterados.

## Migration incremental e homologação

A migration incremental `202611230001_harden_application_privileges.sql` foi aplicada em homologação conforme confirmação do responsável. A matriz efetiva por coluna correspondeu ao esperado, as consultas negativas retornaram zero linhas e a homologação funcional foi aprovada em 8/8 sem regressões identificadas. Sua matriz final é:

| Objeto | authenticated | anon |
|---|---|---|
| `profiles` | SELECT; UPDATE (`display_name`, `avatar_path`) | nenhum |
| `gardens` | SELECT; UPDATE (`name`, `timezone`) | nenhum |
| `garden_members` | SELECT | nenhum |
| `plants` | SELECT; INSERT/UPDATE nas colunas declaradas na migration de plantas | nenhum |
| `care_schedules` | SELECT; INSERT/UPDATE nas colunas declaradas na migration de cuidados | nenhum |
| `care_events` | SELECT | nenhum |
| `pending_care_schedules` | SELECT | nenhum |
| `growth_entries` | SELECT; INSERT/UPDATE nas colunas declaradas na migration de crescimento | nenhum |
| `plant_photos` | SELECT; INSERT/UPDATE nas colunas declaradas na migration de crescimento | nenhum |
| `garden_invites` | SELECT por coluna, excluindo `token_hash`; nenhuma escrita | nenhum |
| 14 RPCs | EXECUTE | somente `inspect_garden_invite(text)` |
| 8 auxiliares | nenhum EXECUTE cliente | nenhum EXECUTE cliente |

A implementação segue estas decisões:

1. Em todas as tabelas públicas do aplicativo, executar `REVOKE ALL PRIVILEGES` de `anon` e `authenticated`, removendo também grants de coluna associados, e então regrantar somente SELECT e as colunas de INSERT/UPDATE já declaradas nas sete migrations. Em PostgreSQL 17, confirmar explicitamente a remoção de `MAINTAIN`. Não alterar `storage.objects` globalmente.
2. Em todas as 22 funções, revogar EXECUTE de `PUBLIC`, `anon` e `authenticated` pelas assinaturas exatas.
3. Regrantar EXECUTE a `authenticated` nas 14 RPCs; regrantar a `anon` somente `inspect_garden_invite(text)`. Não conceder EXECUTE cliente às oito auxiliares.
4. Preservar `USAGE` e a ausência já confirmada de `CREATE` para `anon` e `authenticated` no schema `public`; preservar owners e papéis administrativos.
5. Para `postgres`, revogar no schema `public` os defaults de tabelas e sequences destinados a `PUBLIC`, `anon` e `authenticated`, e revogar EXECUTE direto de `anon` e `authenticated` em funções futuras.
6. Não modificar defaults de `supabase_admin` nesta migration. Qualquer mudança futura exige justificativa, aprovação específica e validação de compatibilidade com a plataforma.
7. Adicionar verificações pós-migration somente leitura com `has_table_privilege`, `has_column_privilege` e `has_function_privilege`, incluindo `MAINTAIN` condicional no PostgreSQL 17.

O EXECUTE global padrão de `PUBLIC` não foi alterado: `ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC` afetaria funções futuras de todos os schemas criadas por `postgres`, fora do escopo comprovado do aplicativo. O risco residual é controlado pela regra obrigatória de revogação explícita por assinatura em cada migration futura. A decisão deve ser reavaliada separadamente após inventário de todos os schemas e consumidores.

O conjunto exato de grants legítimos foi recomposto das migrations atuais. A correção não mudou RLS, regras de negócio, Storage, constraints ou conteúdo. Os 71 cenários continuam necessários para provar isolamento e concorrência.

## Interpretação das verificações pós-migration

As consultas negativas de `06A2-grants-post-migration-check.sql` enumeram qualquer privilégio de tabela de `anon`, escrita/administração em nível de tabela para `authenticated`, divergência nas permissões das 14 RPCs, EXECUTE cliente nas oito auxiliares e ACL EXECUTE de `PUBLIC`. Retorno vazio significa ausência dessas divergências no escopo enumerado. A consulta positiva de SELECT e a matriz agrupada por coluna confirmam que a revogação não removeu os acessos legítimos e que `token_hash` continua inacessível ao cliente.

Essa evidência permite classificar CAT-06A2-001, CAT-06A2-002 e CAT-06A2-003 como corrigidos em homologação. CAT-06A2-004 permanece parcialmente mitigado: os defaults de `postgres` foram endurecidos, mas os defaults administrados de `supabase_admin` e o EXECUTE global padrão de `PUBLIC` continuam como riscos residuais. A regra de revogação explícita em migrations futuras permanece obrigatória.

## Estado

- O histórico disponível confirma oito migrations: sete previamente verificadas em 7/7 mais a oitava informada como aplicada pelo responsável. Nenhuma nova listagem remota foi executada nesta atualização.
- Homologação estrutural e funcional da 06A.2.6A: **8/8 APROVADA**, sem regressões informadas.
- Testes locais: **153/153 APROVADOS** antes desta finalização; a bateria foi repetida para o commit.
- Os 71 cenários permanecem **NÃO EXECUTADO**.
- Débitos e achados anteriores permanecem abertos.
- Abertura pública como SaaS permanece **NO-GO**.
