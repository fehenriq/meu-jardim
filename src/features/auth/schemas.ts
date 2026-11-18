import { z } from "zod"

export const emailSchema = z.string().trim().email("Informe um e-mail válido.")
export const passwordSchema = z.string().min(8, "A senha deve ter pelo menos 8 caracteres.")
export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1, "Informe sua senha.") })
export const registerSchema = z.object({ name: z.string().trim().min(2, "Informe seu nome."), email: emailSchema, password: passwordSchema })
export const forgotSchema = z.object({ email: emailSchema })
export const resetSchema = z.object({ password: passwordSchema })
export type LoginValues = z.infer<typeof loginSchema>
export type RegisterValues = z.infer<typeof registerSchema>
