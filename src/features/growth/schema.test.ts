import { describe, expect, it } from "vitest"
import { formatGrowthDate, growthFormSchema, hasGrowthContent, toDateTimeLocal, toGrowthPayload, validateGrowthPhotos, zonedLocalToIso } from "./schema"

describe("schema do diário de crescimento", () => {
  it("aceita medidas opcionais e normaliza o payload", () => {
    const values = growthFormSchema.parse({ observedAt: "2026-11-19T10:30", heightCm: "12.5", leafCount: "8", notes: "  Broto novo  " })
    expect(toGrowthPayload("plant-a", values, "America/Sao_Paulo")).toEqual({ plant_id: "plant-a", observed_at: "2026-11-19T13:30:00.000Z", height_cm: 12.5, leaf_count: 8, notes: "Broto novo" })
  })

  it("rejeita altura inválida, folhas fracionárias e texto acima do limite", () => {
    expect(growthFormSchema.safeParse({ observedAt: "2026-11-19T10:30", heightCm: "-1", leafCount: "2", notes: "" }).success).toBe(false)
    expect(growthFormSchema.safeParse({ observedAt: "2026-11-19T10:30", heightCm: "1", leafCount: "2.5", notes: "" }).success).toBe(false)
    expect(growthFormSchema.safeParse({ observedAt: "2026-11-19T10:30", heightCm: "", leafCount: "", notes: "x".repeat(4001) }).success).toBe(false)
  })

  it("exige conteúdo significativo incluindo foto", () => {
    const empty = { observedAt: "2026-11-19T10:30", heightCm: "", leafCount: "", notes: " " }
    expect(hasGrowthContent(empty, 0)).toBe(false)
    expect(hasGrowthContent(empty, 1)).toBe(true)
  })

  it("converte e apresenta o instante no fuso do jardim sem deslocar a hora civil", () => {
    const iso = zonedLocalToIso("2026-11-19T00:15", "America/Sao_Paulo")
    expect(iso).toBe("2026-11-19T03:15:00.000Z")
    expect(toDateTimeLocal(new Date(iso), "America/Sao_Paulo")).toBe("2026-11-19T00:15")
    expect(formatGrowthDate(iso, "America/Sao_Paulo")).toContain("00:15")
  })

  it("valida todas as fotografias selecionadas", () => {
    expect(validateGrowthPhotos([new File(["x"], "a.webp", { type: "image/webp" })])).toEqual({ valid: true })
    expect(validateGrowthPhotos([new File(["x"], "a.gif", { type: "image/gif" })])).toMatchObject({ valid: false })
  })
})
