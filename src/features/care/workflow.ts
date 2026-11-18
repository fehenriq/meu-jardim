import type { CareAction } from "./types"

export type CareActionIntent = {
  action: CareAction
  scheduleId: string | null
  rpcPayload: {
    p_plant_id: string
    p_schedule_id: string | null
    p_action: CareAction
    p_request_id: string
    p_event_at: string
    p_note: string | null
    p_defer_days: number | null
  }
}

export function createCareActionIntent(input: { plantId: string; scheduleId: string | null; action: CareAction; note?: string; deferDays?: number | null }, requestId: string = crypto.randomUUID(), eventAt: string = new Date().toISOString()): CareActionIntent {
  return {
    action: input.action,
    scheduleId: input.scheduleId,
    rpcPayload: {
      p_plant_id: input.plantId,
      p_schedule_id: input.scheduleId,
      p_action: input.action,
      p_request_id: requestId,
      p_event_at: eventAt,
      p_note: input.note?.trim() || null,
      p_defer_days: input.action === "deferred" ? input.deferDays ?? null : null,
    },
  }
}

export function availableCareActions(careType: string) {
  return careType === "watering_check"
    ? (["watered", "moisture_checked", "deferred"] as const)
    : (["care_completed", "deferred"] as const)
}

export function createCareSubmissionGate() {
  let pending = false
  return async <T>(task: () => Promise<T>) => {
    if (pending) return undefined
    pending = true
    try { return await task() } finally { pending = false }
  }
}
