import { describe, expect, it } from "vitest"
import { gardenSettingsSchema, profileSchema, validateAvatar } from "./schema"

describe("perfil e configurações", () => {
  it("valida nomes e timezone IANA", () => {
    expect(profileSchema.safeParse({ displayName: " " }).success).toBe(false)
    expect(gardenSettingsSchema.safeParse({ name: "Meu jardim", timezone: "America/Sao_Paulo" }).success).toBe(true)
    expect(gardenSettingsSchema.safeParse({ name: "Meu jardim", timezone: "Brasil/Inventado" }).success).toBe(false)
  })

  it("limita avatares privados aos formatos e tamanho aceitos", () => {
    expect(validateAvatar(new File(["x"], "avatar.webp", { type: "image/webp" })).valid).toBe(true)
    expect(validateAvatar(new File(["x"], "avatar.gif", { type: "image/gif" })).valid).toBe(false)
    expect(validateAvatar(new File([new Uint8Array(5 * 1024 * 1024 + 1)], "avatar.png", { type: "image/png" })).valid).toBe(false)
  })
})
