import { describe, expect, it } from "vitest"
import { invitationLink, inviteStatus } from "./rules"

describe("regras de convites", () => {
  it("usa a origem efetiva e codifica o token", () => {
    expect(invitationLink("a+b")).toBe(`${window.location.origin}/invite?token=a%2Bb`)
  })
  it("prioriza estados terminais e expiração", () => {
    expect(inviteStatus({ accepted_at: "2026-01-01", revoked_at: null, expires_at: "2099-01-01" })).toBe("Utilizado")
    expect(inviteStatus({ accepted_at: null, revoked_at: "2026-01-01", expires_at: "2099-01-01" })).toBe("Revogado")
    expect(inviteStatus({ accepted_at: null, revoked_at: null, expires_at: "2020-01-01" }, Date.now())).toBe("Expirado")
  })
})
