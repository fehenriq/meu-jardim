import type { CaseAdapter, CaseResult, SecurityCase } from "./types.ts"
import { sanitizeEvidence } from "./guards.ts"

export function selectCases(cases: SecurityCase[], filters: { group?: string; caseId?: string }) {
  const selected = cases.filter((item) => (!filters.group || item.group === filters.group) && (!filters.caseId || item.id === filters.caseId))
  if (!selected.length) throw new Error("NO_CASES_SELECTED")
  const selectedIds = new Set(selected.map((item) => item.id))
  for (const item of selected) {
    const missing = item.dependencies.filter((dependency) => !selectedIds.has(dependency))
    if (filters.caseId && missing.length) throw new Error(`DEPENDENCIES_REQUIRED:${item.id}:${missing.join(",")}`)
  }
  return selected
}

export async function executeCases(cases: SecurityCase[], adapter: CaseAdapter): Promise<CaseResult[]> {
  const results: CaseResult[] = []
  const completed = new Set<string>()
  const stoppedGroups = new Set<string>()

  for (const item of cases) {
    if (item.mode === "manual") {
      results.push({ id: item.id, state: "NOT_EXECUTED", evidence: {}, reason: "MANUAL_CASE" })
      continue
    }
    if (stoppedGroups.has(item.group)) {
      results.push({ id: item.id, state: "BLOCKED", evidence: {}, reason: "GROUP_STOPPED_AFTER_UNAUTHORIZED_ACCESS" })
      continue
    }
    const missing = item.dependencies.filter((dependency) => !completed.has(dependency))
    if (missing.length) {
      results.push({ id: item.id, state: "BLOCKED", evidence: {}, reason: `DEPENDENCIES_NOT_SATISFIED:${missing.join(",")}` })
      continue
    }

    const observation = await adapter.execute(item)
    const evidence = sanitizeEvidence({ status: observation.status ?? null, code: observation.code ?? null, row_count: observation.rowCount ?? null, integrity: observation.integrityPassed })
    if (!observation.attempted) {
      results.push({ id: item.id, state: "NOT_EXECUTED", evidence, reason: "ADAPTER_DID_NOT_ATTEMPT" })
    } else if (observation.timedOut && item.mutation) {
      results.push({ id: item.id, state: "BLOCKED", evidence, reason: "MUTATION_TIMEOUT_NO_AUTOMATIC_RETRY" })
    } else if (observation.crossTenantAccess) {
      stoppedGroups.add(item.group)
      results.push({ id: item.id, state: "FAILED", evidence, reason: "UNAUTHORIZED_ACCESS_DETECTED" })
    } else if (!observation.positiveControlPassed) {
      results.push({ id: item.id, state: "BLOCKED", evidence, reason: "POSITIVE_CONTROL_REQUIRED" })
    } else if (!observation.integrityPassed) {
      results.push({ id: item.id, state: "FAILED", evidence, reason: "INTEGRITY_CHECK_FAILED" })
    } else if (!observation.negativeExpectationPassed) {
      results.push({ id: item.id, state: "FAILED", evidence, reason: "NEGATIVE_EXPECTATION_FAILED" })
    } else {
      completed.add(item.id)
      results.push({ id: item.id, state: "APPROVED", evidence })
    }
  }
  return results
}
