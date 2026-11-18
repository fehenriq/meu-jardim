import { z } from "zod"
import { lightExposures, plantOrigins, type PlantInsertPayload } from "./types"

const optionalText = (maximum: number, message: string) => z.string().trim().max(maximum, message).optional().or(z.literal(""))

export const plantFormSchema = z.object({
  nickname: z.string().trim().min(1, "Informe o nome ou apelido.").max(120, "Use no máximo 120 caracteres."),
  species: optionalText(160, "Use no máximo 160 caracteres."),
  location: optionalText(120, "Use no máximo 120 caracteres."),
  acquiredAt: z.string().refine((value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value), "Informe uma data válida."),
  origin: z.enum(plantOrigins).or(z.literal("")),
  lightExposure: z.enum(lightExposures).or(z.literal("")),
  potSoilNotes: optionalText(2000, "Use no máximo 2.000 caracteres."),
  notes: optionalText(5000, "Use no máximo 5.000 caracteres."),
})

export type PlantFormValues = z.infer<typeof plantFormSchema>

const nullable = (value: string | undefined) => value?.trim() || null

export function toPlantInsertPayload(values: PlantFormValues): PlantInsertPayload {
  return {
    nickname: values.nickname.trim(),
    species: nullable(values.species),
    location: nullable(values.location),
    acquired_at: values.acquiredAt || null,
    origin: values.origin || null,
    light_exposure: values.lightExposure || null,
    pot_soil_notes: nullable(values.potSoilNotes),
    notes: nullable(values.notes),
    status: "active",
  }
}

const photoExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}

export function validatePlantPhoto(file: File | null) {
  if (!file) return { valid: true as const, extension: null }
  const extension = photoExtensions[file.type]
  if (!extension) return { valid: false as const, message: "Escolha uma imagem JPEG, PNG ou WebP." }
  if (file.size > 5 * 1024 * 1024) return { valid: false as const, message: "A foto deve ter no máximo 5 MiB." }
  return { valid: true as const, extension }
}

export function formatDateOnly(value: string | null) {
  if (!value) return null
  const [year, month, day] = value.split("-")
  return `${day}/${month}/${year}`
}
