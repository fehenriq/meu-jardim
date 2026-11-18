import { describe, expect, it } from "vitest"
import { classifyCareDate, resolveTodayState, summarizeDueSchedules } from "./today-rules"

describe("regras da tela Hoje", () => {
  it("separa vencidos, hoje e futuros por data civil", () => {
    expect(classifyCareDate("2026-11-18", "2026-11-19")).toBe("overdue")
    expect(classifyCareDate("2026-11-19", "2026-11-19")).toBe("today")
    expect(classifyCareDate("2026-11-20", "2026-11-19")).toBe("upcoming")
  })

  it("conta somente agendas ativas e plantas não arquivadas", () => {
    const schedules = [
      { next_due_date: "2026-11-18", active: true, care_type: "watering_check" as const, plant_status: "active" },
      { next_due_date: "2026-11-19", active: true, care_type: "pruning" as const, plant_status: "active" },
      { next_due_date: "2026-11-19", active: false, care_type: "watering_check" as const, plant_status: "active" },
      { next_due_date: "2026-11-19", active: true, care_type: "fertilizing" as const, plant_status: "archived" },
      { next_due_date: "2026-11-20", active: true, care_type: "watering_check" as const, plant_status: "active" },
    ]
    expect(summarizeDueSchedules(schedules, "2026-11-19")).toEqual({ wateringChecks: 1, otherCare: 1, total: 2 })
  })

  it("distingue carregamento, erro, vazio e conteúdo", () => {
    expect(resolveTodayState(true, false, 0)).toBe("loading")
    expect(resolveTodayState(false, true, 0)).toBe("error")
    expect(resolveTodayState(false, false, 0)).toBe("empty")
    expect(resolveTodayState(false, false, 2)).toBe("ready")
  })
})
