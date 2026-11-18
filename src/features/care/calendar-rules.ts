import type { CareAction, CareType } from "./types"

export type CalendarView = "week" | "month"
export type CalendarFilter = { plantId: string; careType: CareType | "all" }
export type FilterableCalendarItem = { plantId: string; careType: CareType; date: string }

function parseCivil(value: string) {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

function formatCivil(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`
}

export function shiftCivilDays(value: string, days: number) {
  const date = parseCivil(value)
  date.setUTCDate(date.getUTCDate() + days)
  return formatCivil(date)
}

export function startOfCivilWeek(value: string) {
  const date = parseCivil(value)
  const offset = (date.getUTCDay() + 6) % 7
  return shiftCivilDays(value, -offset)
}

export function calendarRange(anchor: string, view: CalendarView) {
  if (view === "week") {
    const start = startOfCivilWeek(anchor)
    return { start, end: shiftCivilDays(start, 6), days: Array.from({ length: 7 }, (_, index) => shiftCivilDays(start, index)) }
  }
  const date = parseCivil(anchor)
  const first = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01`
  const start = startOfCivilWeek(first)
  return { start, end: shiftCivilDays(start, 41), days: Array.from({ length: 42 }, (_, index) => shiftCivilDays(start, index)) }
}

export function shiftCalendarAnchor(anchor: string, view: CalendarView, direction: -1 | 1) {
  if (view === "week") return shiftCivilDays(anchor, direction * 7)
  const date = parseCivil(anchor)
  date.setUTCDate(1)
  date.setUTCMonth(date.getUTCMonth() + direction)
  return formatCivil(date)
}

export function eventDateInTimeZone(value: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone }).formatToParts(new Date(value))
  const result = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${result.year}-${result.month}-${result.day}`
}

export function formatCalendarCivilDate(value: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("pt-BR", { ...options, timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`))
}

export function eventCareType(eventType: CareAction, scheduleCareType: CareType | null): CareType {
  if (scheduleCareType) return scheduleCareType
  return eventType === "watered" || eventType === "moisture_checked" ? "watering_check" : "custom"
}

export function calendarItemState(kind: "schedule" | "event", date: string, today: string, eventType?: CareAction) {
  if (kind === "event") return eventType === "watered" ? "completed" : eventType === "moisture_checked" ? "checked" : eventType === "deferred" ? "deferred" : "completed"
  return date < today ? "overdue" : "planned"
}

export function filterCalendarItems<T extends FilterableCalendarItem>(items: T[], filter: CalendarFilter) {
  return items.filter((item) => (filter.plantId === "all" || item.plantId === filter.plantId) && (filter.careType === "all" || item.careType === filter.careType))
}

export function resolveCalendarState(loading: boolean, failed: boolean, count: number) {
  if (loading) return "loading" as const
  if (failed) return "error" as const
  return count ? "ready" as const : "empty" as const
}
