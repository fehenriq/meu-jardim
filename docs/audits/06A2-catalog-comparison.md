# Meu Jardim — 06A.2.6: matriz de comparação do catálogo

## Identificação

| Campo | Valor |
|---|---|
| Projeto autorizado | `meu-jardim-homolog` |
| Project ID | `gmbwavdzfljvfdvnroiz` |
| Commit preparado | `79812b300cb4de8a0d672f3c6a28a62ee1da4be0` |
| Fonte | resultados sanitizados informados pelo responsável |
| Resultado geral | **REMEDIAÇÃO 06A.2.6A CONFORME; riscos residuais preservados** |

Resultados incompletos permanecem `BLOQUEADO`; contagens isoladas não comprovam equivalência de definições.

## Comparação

| Bloco | Controle | Estrutura esperada | Observado | Estado | Divergência/risco |
|---:|---|---|---|---|---|
| 0 | Versão | PostgreSQL 15+ | PostgreSQL 17.12 | CONFORME | — |
| 1 | Tabelas públicas | 9 tabelas com RLS | 9 tabelas com RLS | CONFORME | — |
| 1 | View | `pending_care_schedules` com `security_invoker=true` | opção confirmada | CONFORME | — |
| 1 | `storage.objects` e owners | objeto/RLS/owners esperados | não informado integralmente | BLOQUEADO | evidência incompleta |
| 2 | Policies públicas | 19, com definições equivalentes | contagem 19 | BLOQUEADO | definições, roles e expressões incompletas |
| 2 | Policies Storage | 6, sem DELETE do app | contagem 6 | BLOQUEADO | definições e comandos incompletos |
| 3A | Grants de `anon` | nenhum nas 10 relações públicas | consulta pós-migration vazia para os oito privilégios, incluindo `MAINTAIN` | CONFORME | — |
| 3A | Grants de `authenticated` | ACL mínima; escrita restrita por coluna | consultas negativas pós-migration vazias | CONFORME | CAT-06A2-003 corrigido em homologação |
| 3B | Grants por coluna | escrita limitada às colunas das migrations | matriz efetiva conforme o esperado, incluindo `garden_invites` sem `token_hash` | CONFORME | CAT-06A2-003 corrigido em homologação |
| 4 | 14 RPCs de negócio | `anon_execute=true` somente em `inspect_garden_invite`; `public_execute=false` | consulta de divergências pós-migration vazia | CONFORME | CAT-06A2-001 corrigido em homologação |
| 4 | 8 funções auxiliares | sem EXECUTE cliente desnecessário | consulta de divergências pós-migration vazia | CONFORME | CAT-06A2-002 corrigido em homologação |
| 5 | Constraints | equivalentes às migrations | não informado | BLOQUEADO | evidência ausente |
| 6 | Triggers | 11 triggers e 17 eventos esperados | 11 triggers em 17 registros | BLOQUEADO | contagem coincide; definições incompletas |
| 7 | Índices | 17 explícitos + PK/UNIQUE | 32: 17 explícitos + 15 PK/UNIQUE | CONFORME | contagem e classificação coincidem |
| 8 | Buckets | 2 privados e configuração esperada | 2 privados; demais atributos não informados | BLOQUEADO | limites e MIME incompletos |
| 13 | Default privileges | reduzir recorrência sem afetar plataforma | defaults de `postgres` endurecidos; `supabase_admin` e EXECUTE global de `PUBLIC` preservados | DIVERGENTE | CAT-06A2-004 parcialmente mitigado; risco residual documentado |
| 14 | Papéis clientes | USAGE sem CREATE; sem BYPASSRLS ou memberships efetivas | `anon` e `authenticated`: USAGE=true, CREATE=false, BYPASSRLS=false e nenhuma membership efetiva | CONFORME | — |
| 06A.2.6A | Migration corretiva | hardening incremental sem alterar RLS ou negócio | aplicação confirmada; checks estruturais conformes; homologação funcional 8/8 | CONFORME | não substitui os 71 cenários comportamentais |

## Divergências e lacunas

| ID | Severidade preliminar | Estado da evidência | Evidência sanitizada | Impacto |
|---|---|---|---|---|
| CAT-06A2-001 | Alta | corrigido em homologação | consulta pós-migration sem divergências nas 14 RPCs | exposição anônima indevida removida; somente inspeção de convite permanece anônima |
| CAT-06A2-002 | Média | corrigido em homologação | consulta pós-migration sem divergências nas 8 auxiliares | EXECUTE cliente desnecessário removido |
| CAT-06A2-003 | Alta | corrigido em homologação | matriz por coluna conforme e consultas negativas vazias | grants administrativos e escrita ampla removidos |
| CAT-06A2-004 | Alta | parcialmente mitigado | defaults de `postgres` endurecidos; defaults de `supabase_admin` e EXECUTE global de `PUBLIC` inalterados | futuras migrations ainda precisam de revogação explícita por objeto |
| CAT-06A2-E01 | Informativa | encerrado | matriz efetiva por coluna recebida e conforme | lacuna de evidência removida para o escopo de grants da 06A.2.6A |

## Encerramento

- Grants e ACLs após 06A.2.6A: **CONFORME no escopo verificado**.
- Vulnerabilidade explorável comprovada por teste: **nenhuma nesta etapa**.
- 71 cenários de isolamento: **NÃO EXECUTADO**.
- SEC-06A-004: permanece sem prova comportamental.
- Abertura pública como SaaS: **NO-GO**.
- Remediação 06A.2.6A: **APLICADA E HOMOLOGADA 8/8**, conforme confirmação do responsável.
