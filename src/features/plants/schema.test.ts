import { describe, expect, it } from "vitest"
import { formatDateOnly, plantFormSchema, toPlantInsertPayload, validatePlantPhoto } from "./schema"

describe("formulário de planta", () => {
  it("normaliza o payload sem inventar opcionais", () => {
    const values = plantFormSchema.parse({ nickname: "  Jiboia  ", species: " ", location: " Sala ", acquiredAt: "2026-11-18", origin: "seedling", lightExposure: "indirect_light", potSoilNotes: " ", notes: "Perto da janela" })
    expect(toPlantInsertPayload(values)).toEqual({ nickname: "Jiboia", species: null, location: "Sala", acquired_at: "2026-11-18", origin: "seedling", light_exposure: "indirect_light", pot_soil_notes: null, notes: "Perto da janela", status: "active" })
  })

  it("rejeita nome vazio e limites excedidos", () => {
    expect(plantFormSchema.safeParse({ nickname: " ", species: "", location: "", acquiredAt: "", origin: "", lightExposure: "", potSoilNotes: "", notes: "" }).success).toBe(false)
    expect(plantFormSchema.safeParse({ nickname: "a".repeat(121), species: "", location: "", acquiredAt: "", origin: "", lightExposure: "", potSoilNotes: "", notes: "" }).success).toBe(false)
  })

  it("valida tipo e tamanho da foto", () => {
    expect(validatePlantPhoto(new File(["x"], "plant.webp", { type: "image/webp" }))).toEqual({ valid: true, extension: "webp" })
    expect(validatePlantPhoto(new File(["x"], "plant.gif", { type: "image/gif" }))).toMatchObject({ valid: false })
    expect(validatePlantPhoto(new File([new Uint8Array(5 * 1024 * 1024 + 1)], "large.jpg", { type: "image/jpeg" }))).toMatchObject({ valid: false })
  })

  it("formata date sem deslocamento de fuso", () => {
    expect(formatDateOnly("2026-11-18")).toBe("18/11/2026")
  })
})
