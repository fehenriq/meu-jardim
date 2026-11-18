import { describe, expect, it } from "vitest"
import { careScheduleSchema, formatCivilDate, formatEventDateTime, toCareSchedulePayload, toCareScheduleValues, todayInTimeZone } from "./schema"
import type { CareSchedule } from "./types"

const validValues = { careType: "watering_check" as const, customTitle: "", intervalDays: "7", nextDueDate: "2026-11-20", moistureRecheckDays: "2" }

describe("validação de rotinas de cuidado", () => {
  it("constrói payload válido para verificação de rega", () => {
    const values = careScheduleSchema.parse(validValues)
    expect(toCareSchedulePayload(values)).toEqual({ care_type: "watering_check", custom_title: null, interval_days: 7, next_due_date: "2026-11-20", active: true, settings: { moisture_recheck_days: 2 } })
  })

  it("exige título personalizado e respeita limites do banco", () => {
    expect(careScheduleSchema.safeParse({ ...validValues, careType: "custom", customTitle: "" }).success).toBe(false)
    expect(careScheduleSchema.safeParse({ ...validValues, intervalDays: "0" }).success).toBe(false)
    expect(careScheduleSchema.safeParse({ ...validValues, moistureRecheckDays: "31" }).success).toBe(false)
    expect(careScheduleSchema.safeParse({ ...validValues, nextDueDate: "2026-02-31" }).success).toBe(false)
  })

  it("preenche edição sem alterar o estado ativo", () => {
    const schedule: CareSchedule = { id: "schedule-a", garden_id: "garden-a", plant_id: "plant-a", care_type: "custom", custom_title: "Limpar folhas", interval_days: 10, next_due_date: "2026-11-25", active: false, settings: {}, created_by: "user-a", created_at: "2026-11-19T00:00:00Z", updated_at: "2026-11-19T00:00:00Z" }
    expect(toCareScheduleValues(schedule)).toEqual({ careType: "custom", customTitle: "Limpar folhas", intervalDays: "10", nextDueDate: "2026-11-25", moistureRecheckDays: "2" })
    expect(toCareSchedulePayload(toCareScheduleValues(schedule)).active).toBe(true)
  })

  it("mantém datas civis e formata evento no timezone informado", () => {
    expect(formatCivilDate("2026-11-20")).toBe("20/11/2026")
    expect(todayInTimeZone("America/Sao_Paulo", new Date("2026-11-20T01:00:00Z"))).toBe("2026-11-19")
    expect(formatEventDateTime("2026-11-20T01:00:00Z", "America/Sao_Paulo")).toContain("19/11/2026")
  })
})
