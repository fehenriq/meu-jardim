import { describe, expect, it } from "vitest"
import { createPlantDetailSpec, createPlantListSpec, plantKeys, resolvePlantDetailsState, resolvePlantListState } from "./query-spec"

const filters = { search: "  samambaia ", location: "Varanda", status: "active" as const, page: 2, pageSize: 12 }

describe("isolamento das consultas de plantas", () => {
  it("exige jardim na lista e calcula paginação no servidor", () => {
    expect(createPlantListSpec("garden-a", filters)).toEqual({ gardenId: "garden-a", search: "samambaia", location: "Varanda", status: "active", from: 12, to: 23 })
  })

  it("combina jardim e planta nos detalhes", () => {
    expect(createPlantDetailSpec("garden-a", "plant-a")).toEqual({ gardenId: "garden-a", plantId: "plant-a" })
  })

  it("separa caches e URLs quando o jardim muda", () => {
    expect(plantKeys.list("garden-a", filters)).not.toEqual(plantKeys.list("garden-b", filters))
    expect(plantKeys.detail("garden-a", "plant-a")).not.toEqual(plantKeys.detail("garden-b", "plant-a"))
  })

  it("trata detalhes inacessíveis como não encontrados", () => {
    expect(resolvePlantDetailsState(false, false, false)).toBe("not_found")
    expect(resolvePlantDetailsState(false, true, false)).toBe("error")
  })

  it("distingue loading, erro, vazio e resultado da lista", () => {
    expect(resolvePlantListState(true, false, 0)).toBe("loading")
    expect(resolvePlantListState(false, true, 0)).toBe("error")
    expect(resolvePlantListState(false, false, 0)).toBe("empty")
    expect(resolvePlantListState(false, false, 2)).toBe("ready")
  })
})
