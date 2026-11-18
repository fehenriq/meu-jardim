import { z } from "zod"
import { careTypes, type CareSchedule, type CareSchedulePayload } from "./types"

const civilDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida.").refine((value) => {
  const [year, month, day] = value.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}, "Informe uma data válida.")

export const careScheduleSchema = z.object({
  careType: z.enum(careTypes),
  customTitle: z.string().trim().max(120, "Use no máximo 120 caracteres."),
  intervalDays: z.string().regex(/^\d+$/, "Informe um número inteiro.").refine((value) => Number(value) >= 1 && Number(value) <= 3650, "Use um intervalo entre 1 e 3.650 dias."),
  nextDueDate: civilDate,
  moistureRecheckDays: z.string().regex(/^\d+$/, "Informe um número inteiro.").refine((value) => Number(value) >= 1 && Number(value) <= 30, "Use um intervalo entre 1 e 30 dias."),
}).superRefine((values, context) => {
  if (values.careType === "custom" && !values.customTitle) context.addIssue({ code: "custom", path: ["customTitle"], message: "Informe o título do cuidado." })
})

export type CareScheduleValues = z.infer<typeof careScheduleSchema>

export function toCareSchedulePayload(values: CareScheduleValues): CareSchedulePayload {
  return {
    care_type: values.careType,
    custom_title: values.careType === "custom" ? values.customTitle.trim() : null,
    interval_days: Number(values.intervalDays),
    next_due_date: values.nextDueDate,
    active: true,
    settings: values.careType === "watering_check" ? { moisture_recheck_days: Number(values.moistureRecheckDays) } : {},
  }
}

export function toCareScheduleValues(schedule: CareSchedule): CareScheduleValues {
  return {
    careType: schedule.care_type,
    customTitle: schedule.custom_title ?? "",
    intervalDays: String(schedule.interval_days),
    nextDueDate: schedule.next_due_date,
    moistureRecheckDays: String(schedule.settings.moisture_recheck_days ?? 2),
  }
}

export function formatCivilDate(value: string) {
  const [year, month, day] = value.split("-")
  return `${day}/${month}/${year}`
}

export function formatEventDateTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone }).format(new Date(value))
}

export function todayInTimeZone(timeZone: string, date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone }).formatToParts(date)
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${value.year}-${value.month}-${value.day}`
}
