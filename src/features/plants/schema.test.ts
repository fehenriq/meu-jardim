import { describe, expect, it } from "vitest"
import { formatDateOnly, plantFormSchema, toPlantFormValues, toPlantInsertPayload, toPlantUpdatePayload, validatePlantPhoto } from "./schema"
import type { Plant } from "./types"

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

  it("preenche a edição e não envia status ou campos imutáveis", () => {
    const plant: Plant = { id: "plant-a", garden_id: "garden-a", nickname: "Jiboia", species: null, main_photo_path: "garden-a/plant-a/photo.jpg", location: "Sala", acquired_at: null, origin: null, light_exposure: null, pot_soil_notes: null, notes: null, status: "archived", created_by: "user-a", created_at: "2026-11-18T00:00:00Z", updated_at: "2026-11-18T01:00:00Z" }
    const values = toPlantFormValues(plant)
    expect(values).toMatchObject({ nickname: "Jiboia", species: "", location: "Sala" })
    expect(toPlantUpdatePayload(values)).toEqual({ nickname: "Jiboia", species: null, location: "Sala", acquired_at: null, origin: null, light_exposure: null, pot_soil_notes: null, notes: null })
  })
})
