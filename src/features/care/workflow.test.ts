import { describe, expect, it, vi } from "vitest"
import { availableCareActions, createCareActionIntent, createCareSubmissionGate } from "./workflow"

describe("intenções de ações de cuidado", () => {
  it("mapeia as quatro ações para os parâmetros reais da RPC", () => {
    for (const action of ["watered", "moisture_checked", "deferred", "care_completed"] as const) {
      const intent = createCareActionIntent({ plantId: "plant-a", scheduleId: "schedule-a", action, note: "  Nota  ", deferDays: 3 }, `request-${action}`, "2026-11-19T12:00:00.000Z")
      expect(intent.rpcPayload).toMatchObject({ p_plant_id: "plant-a", p_schedule_id: "schedule-a", p_action: action, p_request_id: `request-${action}`, p_event_at: "2026-11-19T12:00:00.000Z", p_note: "Nota" })
      expect(intent.rpcPayload.p_defer_days).toBe(action === "deferred" ? 3 : null)
    }
  })

  it("não confunde inspeção de umidade com rega", () => {
    const intent = createCareActionIntent({ plantId: "plant-a", scheduleId: "schedule-a", action: "moisture_checked" }, "request-a", "2026-11-19T12:00:00.000Z")
    expect(intent.action).toBe("moisture_checked")
    expect(intent.rpcPayload.p_action).not.toBe("watered")
  })

  it("reutiliza o request_id da mesma intenção e separa uma nova ação", () => {
    const retry = createCareActionIntent({ plantId: "plant-a", scheduleId: null, action: "watered" }, "request-a", "2026-11-19T12:00:00.000Z")
    expect(retry.rpcPayload.p_request_id).toBe("request-a")
    const next = createCareActionIntent({ plantId: "plant-a", scheduleId: null, action: "watered" }, "request-b", "2026-11-19T12:01:00.000Z")
    expect(next.rpcPayload.p_request_id).not.toBe(retry.rpcPayload.p_request_id)
  })

  it("oferece somente ações compatíveis com o tipo", () => {
    expect(availableCareActions("watering_check")).toEqual(["watered", "moisture_checked", "deferred"])
    expect(availableCareActions("pruning")).toEqual(["care_completed", "deferred"])
  })

  it("bloqueia submissões simultâneas", async () => {
    const gate = createCareSubmissionGate()
    let release: () => void = () => {}
    const pending = new Promise<void>((resolve) => { release = resolve })
    const task = vi.fn(() => pending)
    const first = gate(task)
    expect(await gate(task)).toBeUndefined()
    expect(task).toHaveBeenCalledOnce()
    release()
    await first
  })
})
