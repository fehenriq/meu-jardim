import { describe, expect, it } from "vitest"
import { resolveAuthorName } from "./authors"

const authors = [
  { user_id: "user-a", display_name: "Ana", avatar_path: null },
  { user_id: "user-b", display_name: "Bruno", avatar_path: "user-b/avatar.webp" },
]

describe("identificação segura de autores", () => {
  it("prioriza a identidade da sessão atual", () => {
    expect(resolveAuthorName(authors, "user-a", "user-a", "Ana Maria")).toBe("Ana Maria")
    expect(resolveAuthorName(authors, "user-a", "user-a", "")).toBe("Você")
  })

  it("resolve somente autores recebidos no escopo do jardim", () => {
    expect(resolveAuthorName(authors, "user-b", "user-a", "Ana")).toBe("Bruno")
  })

  it("usa fallback neutro para usuário removido ou não autorizado", () => {
    expect(resolveAuthorName(authors, "removed-user", "user-a", "Ana")).toBe("Membro do jardim")
  })
})
