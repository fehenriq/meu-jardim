import { describe, expect, it } from "vitest"
import { availableMemberActions } from "./rules"

const member = { user_id: "user-b", display_name: "Bia", avatar_path: null, avatar_url: null, role: "member" as const, joined_at: "2026-11-20T00:00:00Z" }
describe("controles de membros", () => {
  it("mostra ações administrativas somente a outro membro", () => {
    expect(availableMemberActions("user-a", "admin", member)).toEqual(["promote", "remove"])
    expect(availableMemberActions("user-a", "member", member)).toEqual([])
    expect(availableMemberActions("user-b", "admin", member)).toEqual([])
  })
  it("permite rebaixar ou remover outro administrador", () => {
    expect(availableMemberActions("user-a", "admin", { ...member, role: "admin" })).toEqual(["demote", "remove"])
  })
})
