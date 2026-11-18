import { z } from "zod"

export const profileSchema = z.object({ displayName: z.string().trim().min(1, "Informe seu nome.").max(120, "Use no máximo 120 caracteres.") })
export const gardenSettingsSchema = z.object({
  name: z.string().trim().min(2, "Use pelo menos 2 caracteres.").max(80, "Use no máximo 80 caracteres."),
  timezone: z.string().trim().min(1, "Informe um fuso IANA.").max(100, "Use no máximo 100 caracteres.").refine((value) => { try { new Intl.DateTimeFormat("pt-BR", { timeZone: value }); return true } catch { return false } }, "Informe um fuso IANA válido."),
})

export function validateAvatar(file: File | null) {
  if (!file) return { valid: true as const, extension: null }
  const extensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }
  const extension = extensions[file.type]
  if (!extension) return { valid: false as const, message: "Escolha uma imagem JPEG, PNG ou WebP." }
  if (file.size > 5 * 1024 * 1024) return { valid: false as const, message: "O avatar deve ter no máximo 5 MiB." }
  return { valid: true as const, extension }
}
