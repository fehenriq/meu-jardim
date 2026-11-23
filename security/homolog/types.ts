export type Actor = "A" | "B" | "C" | "anon" | "external" | "reviewer" | "fixture-member" | "fixture-admin" | "multiple"
export type ExecutionMode = "automated" | "hybrid" | "manual"
export type CaseState = "NOT_EXECUTED" | "APPROVED" | "FAILED" | "BLOCKED"

export type SecurityCase = {
  id: string
  group: string
  actor: Actor
  mode: ExecutionMode
  mutation: boolean
  operation: string
  preconditions: string[]
  positiveControl: string
  negativeExpectation: string
  integrityCheck: string
  dependencies: string[]
}

export type Observation = {
  attempted: boolean
  positiveControlPassed: boolean
  negativeExpectationPassed: boolean
  integrityPassed: boolean
  crossTenantAccess?: boolean
  timedOut?: boolean
  status?: number
  code?: string
  rowCount?: number
}

export type CaseResult = {
  id: string
  state: CaseState
  evidence: Record<string, boolean | number | string | null>
  reason?: string
}

export interface CaseAdapter {
  execute(testCase: SecurityCase): Promise<Observation>
}
