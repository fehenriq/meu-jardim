import type { CareType } from "./types"

export type DueScheduleSummary = { next_due_date: string; active: boolean; care_type: CareType; plant_status: string }

export function classifyCareDate(nextDueDate: string, today: string) {
  if (nextDueDate < today) return "overdue" as const
  if (nextDueDate === today) return "today" as const
  return "upcoming" as const
}

export function summarizeDueSchedules(schedules: DueScheduleSummary[], today: string) {
  const due = schedules.filter((schedule) => schedule.active && schedule.plant_status !== "archived" && schedule.next_due_date <= today)
  return {
    wateringChecks: due.filter((schedule) => schedule.care_type === "watering_check").length,
    otherCare: due.filter((schedule) => schedule.care_type !== "watering_check").length,
    total: due.length,
  }
}

export function resolveTodayState(loading: boolean, failed: boolean, count: number) {
  if (loading) return "loading" as const
  if (failed) return "error" as const
  return count ? "ready" as const : "empty" as const
}
