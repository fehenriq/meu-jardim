import { describe, expect, it } from "vitest"
import { captureInviteToken, invitationLink, inviteStatus, INVITE_TOKEN_KEY } from "./rules"

describe("regras de convites", () => {
  it("gera o segredo no fragmento, fora da query string", () => {
    expect(invitationLink("a+b")).toBe(`${window.location.origin}/invite#token=a%2Bb`)
    expect(new URL(invitationLink("a+b")).search).toBe("")
  })
  it("captura o fragmento, preserva parâmetros legítimos e saneia a URL", () => {
    window.history.replaceState({}, "", "/invite?source=family#token=a%2Bb&step=join")
    expect(captureInviteToken()).toBe("a+b")
    expect(window.location.href).toBe(`${window.location.origin}/invite?source=family#step=join`)
    expect(sessionStorage.getItem(INVITE_TOKEN_KEY)).toBe("a+b")
  })
  it("aceita link legado sem reemitir o token", () => {
    window.history.replaceState({}, "", "/invite?token=legacy%2Btoken&source=old")
    expect(captureInviteToken()).toBe("legacy+token")
    expect(window.location.href).toBe(`${window.location.origin}/invite?source=old`)
    expect(sessionStorage.getItem(INVITE_TOKEN_KEY)).toBe("legacy+token")
  })
  it("recupera o convite somente da sessão da aba quando a URL já está limpa", () => {
    window.history.replaceState({}, "", "/invite")
    sessionStorage.setItem(INVITE_TOKEN_KEY, "same-tab")
    expect(captureInviteToken()).toBe("same-tab")
    expect(window.location.href).toBe(`${window.location.origin}/invite`)
  })
  it("prioriza estados terminais e expiração", () => {
    expect(inviteStatus({ accepted_at: "2026-01-01", revoked_at: null, expires_at: "2099-01-01" })).toBe("Utilizado")
    expect(inviteStatus({ accepted_at: null, revoked_at: "2026-01-01", expires_at: "2099-01-01" })).toBe("Revogado")
    expect(inviteStatus({ accepted_at: null, revoked_at: null, expires_at: "2020-01-01" }, Date.now())).toBe("Expirado")
  })
})
