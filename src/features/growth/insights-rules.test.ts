import { describe, expect, it } from "vitest"
import { comparisonPhotoDate, createHeightChartPoints, normalizeHeightMeasurements, toggleComparisonPhoto } from "./insights-rules"
import type { ComparisonPhoto } from "./insights-types"

describe("regras das análises de crescimento", () => {
  it("distingue zero, uma, duas e várias medições", () => {
    expect(createHeightChartPoints([])).toEqual([])
    expect(createHeightChartPoints([{ id: "a", observed_at: "2026-11-18T10:00:00Z", height_cm: 10 }])).toEqual([])
    expect(createHeightChartPoints([{ id: "a", observed_at: "2026-11-18T10:00:00Z", height_cm: 10 }, { id: "b", observed_at: "2026-11-19T10:00:00Z", height_cm: 12 }])).toHaveLength(2)
    expect(createHeightChartPoints([{ id: "a", observed_at: "2026-11-18T10:00:00Z", height_cm: 10 }, { id: "b", observed_at: "2026-11-19T10:00:00Z", height_cm: 12 }, { id: "c", observed_at: "2026-11-20T10:00:00Z", height_cm: 13 }])).toHaveLength(3)
  })

  it("ignora ausências e valores inválidos sem inventar pontos", () => {
    expect(normalizeHeightMeasurements([{ id: "a", observed_at: "2026-11-18T10:00:00Z", height_cm: null }, { id: "b", observed_at: "2026-11-19T10:00:00Z", height_cm: "NaN" }, { id: "c", observed_at: "2026-11-20T10:00:00Z", height_cm: -1 }, { id: "d", observed_at: "2026-11-21T10:00:00Z", height_cm: "12.5" }])).toEqual([{ id: "d", observed_at: "2026-11-21T10:00:00Z", height_cm: 12.5 }])
  })

  it("preserva medições do mesmo dia e ordena por instante e id", () => {
    const result = normalizeHeightMeasurements([{ id: "b", observed_at: "2026-11-19T10:00:00Z", height_cm: 12 }, { id: "c", observed_at: "2026-11-19T11:00:00Z", height_cm: 13 }, { id: "a", observed_at: "2026-11-19T10:00:00Z", height_cm: 11 }])
    expect(result.map((item) => item.id)).toEqual(["a", "b", "c"])
  })

  it("seleciona duas fotos disponíveis e bloqueia id externo", () => {
    expect(toggleComparisonPhoto([], "photo-a", ["photo-a", "photo-b"])).toEqual(["photo-a"])
    expect(toggleComparisonPhoto(["photo-a"], "photo-b", ["photo-a", "photo-b"])).toEqual(["photo-a", "photo-b"])
    expect(toggleComparisonPhoto(["photo-a"], "foreign", ["photo-a", "photo-b"])).toEqual(["photo-a"])
    expect(toggleComparisonPhoto(["photo-a", "photo-b"], "photo-a", ["photo-a", "photo-b"])).toEqual(["photo-b"])
  })

  it("prioriza data da foto, depois registro e criação", () => {
    const photo = { taken_at: "2026-11-20T10:00:00Z", observed_at: "2026-11-19T10:00:00Z", created_at: "2026-11-21T10:00:00Z" } as ComparisonPhoto
    expect(comparisonPhotoDate(photo)).toBe(photo.taken_at)
    expect(comparisonPhotoDate({ ...photo, taken_at: null })).toBe(photo.observed_at)
    expect(comparisonPhotoDate({ ...photo, taken_at: null, observed_at: null })).toBe(photo.created_at)
  })
})
