import { describe, expect, it } from "vitest"
import { calendarItemState, calendarRange, eventCareType, eventDateInTimeZone, filterCalendarItems, formatCalendarCivilDate, resolveCalendarState, shiftCalendarAnchor, startOfCivilWeek } from "./calendar-rules"

describe("regras do calendário de cuidados", () => {
  it("calcula semana e navega em viradas de mês e ano", () => {
    expect(startOfCivilWeek("2026-01-01")).toBe("2025-12-29")
    expect(calendarRange("2026-01-01", "week")).toMatchObject({ start: "2025-12-29", end: "2026-01-04" })
    expect(shiftCalendarAnchor("2026-01-01", "week", -1)).toBe("2025-12-25")
  })

  it("cria grade mensal estável com 42 dias", () => {
    const range = calendarRange("2026-11-19", "month")
    expect(range.days).toHaveLength(42)
    expect(range.start).toBe("2026-10-26")
    expect(range.end).toBe("2026-12-06")
    expect(shiftCalendarAnchor("2026-12-15", "month", 1)).toBe("2027-01-01")
  })

  it("posiciona evento pela data local do jardim perto da meia-noite UTC", () => {
    expect(eventDateInTimeZone("2026-11-20T01:30:00Z", "America/Sao_Paulo")).toBe("2026-11-19")
    expect(eventDateInTimeZone("2026-11-20T01:30:00Z", "Asia/Tokyo")).toBe("2026-11-20")
  })

  it("formata data civil sem deslocar em fusos extremos", () => {
    expect(formatCalendarCivilDate("2026-11-20", { day: "2-digit", month: "2-digit", year: "numeric" })).toBe("20/11/2026")
  })

  it("distingue previsto, vencido, realizado, verificado e adiado", () => {
    expect(calendarItemState("schedule", "2026-11-18", "2026-11-19")).toBe("overdue")
    expect(calendarItemState("schedule", "2026-11-19", "2026-11-19")).toBe("planned")
    expect(calendarItemState("event", "2026-11-19", "2026-11-19", "watered")).toBe("completed")
    expect(calendarItemState("event", "2026-11-19", "2026-11-19", "moisture_checked")).toBe("checked")
    expect(calendarItemState("event", "2026-11-19", "2026-11-19", "deferred")).toBe("deferred")
  })

  it("classifica rega espontânea sem agenda e aplica filtros", () => {
    expect(eventCareType("watered", null)).toBe("watering_check")
    const items = [{ plantId: "plant-a", careType: "watering_check" as const, date: "2026-11-19" }, { plantId: "plant-b", careType: "pruning" as const, date: "2026-11-19" }]
    expect(filterCalendarItems(items, { plantId: "plant-a", careType: "all" })).toHaveLength(1)
    expect(filterCalendarItems(items, { plantId: "all", careType: "pruning" })).toHaveLength(1)
  })

  it("distingue estados de consulta", () => {
    expect(resolveCalendarState(true, false, 0)).toBe("loading")
    expect(resolveCalendarState(false, true, 0)).toBe("error")
    expect(resolveCalendarState(false, false, 0)).toBe("empty")
    expect(resolveCalendarState(false, false, 1)).toBe("ready")
  })
})
