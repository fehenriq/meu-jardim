import { describe, expect, it } from "vitest"
import { loginSchema, registerSchema } from "./schemas"

describe("validação de autenticação", () => {
  it("rejeita e-mail inválido e senha curta no cadastro", () => { expect(registerSchema.safeParse({ name: "A", email: "x", password: "123" }).success).toBe(false) })
  it("aceita dados válidos", () => { expect(registerSchema.safeParse({ name: "Ana", email: "ana@example.com", password: "segura123" }).success).toBe(true) })
  it("exige senha no login", () => { expect(loginSchema.safeParse({ email: "ana@example.com", password: "" }).success).toBe(false) })
})
