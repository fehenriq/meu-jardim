import { z } from "zod"
import { validatePlantPhoto } from "@/features/plants/schema"
import type { GrowthEntryPayload, GrowthFormValues } from "./types"

export const growthFormSchema = z.object({
  observedAt: z.string().min(1, "Informe a data e hora da observação."),
  heightCm: z.string().refine((value) => value === "" || (Number.isFinite(Number(value)) && Number(value) >= 0), "Informe uma altura válida e não negativa."),
  leafCount: z.string().refine((value) => value === "" || (Number.isInteger(Number(value)) && Number(value) >= 0), "Informe uma quantidade inteira e não negativa."),
  notes: z.string().trim().max(4000, "Use no máximo 4.000 caracteres."),
})

function zonedParts(date: Date, timeZone: string) {
  const values = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(date)
  return Object.fromEntries(values.map((part) => [part.type, part.value]))
}

export function toDateTimeLocal(date: Date, timeZone: string) {
  const parts = zonedParts(date, timeZone)
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}

export function zonedLocalToIso(value: string, timeZone: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
  if (!match) throw new Error("Data e hora inválidas.")
  const [, year, month, day, hour, minute] = match
  const target = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute))
  let candidate = target
  for (let index = 0; index < 3; index += 1) {
    const parts = zonedParts(new Date(candidate), timeZone)
    const represented = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute))
    candidate += target - represented
  }
  if (toDateTimeLocal(new Date(candidate), timeZone) !== value) throw new Error("Este horário não existe no fuso do jardim.")
  return new Date(candidate).toISOString()
}

export function formatGrowthDate(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone, dateStyle: "long", timeStyle: "short" }).format(new Date(value))
}

export function toGrowthPayload(plantId: string, values: GrowthFormValues, timeZone: string): GrowthEntryPayload {
  const parsed = growthFormSchema.parse(values)
  return {
    plant_id: plantId,
    observed_at: zonedLocalToIso(parsed.observedAt, timeZone),
    height_cm: parsed.heightCm === "" ? null : Number(parsed.heightCm),
    leaf_count: parsed.leafCount === "" ? null : Number(parsed.leafCount),
    notes: parsed.notes.trim() || null,
  }
}

export function validateGrowthPhotos(files: File[]) {
  for (const file of files) {
    const result = validatePlantPhoto(file)
    if (!result.valid) return result
  }
  return { valid: true as const }
}

export function hasGrowthContent(values: GrowthFormValues, photoCount: number) {
  return Boolean(values.heightCm.trim() || values.leafCount.trim() || values.notes.trim() || photoCount)
}
