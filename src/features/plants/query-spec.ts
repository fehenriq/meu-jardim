import type { PlantListFilters } from "./types"

export function createPlantListSpec(gardenId: string, filters: PlantListFilters) {
  return {
    gardenId,
    search: filters.search.trim(),
    location: filters.location,
    status: filters.status,
    from: (filters.page - 1) * filters.pageSize,
    to: filters.page * filters.pageSize - 1,
  }
}

export function createPlantDetailSpec(gardenId: string, plantId: string) {
  return { gardenId, plantId }
}

export function resolvePlantDetailsState(loading: boolean, failed: boolean, hasPlant: boolean) {
  if (loading) return "loading" as const
  if (failed) return "error" as const
  return hasPlant ? "ready" as const : "not_found" as const
}

export function resolvePlantListState(loading: boolean, failed: boolean, itemCount: number) {
  if (loading) return "loading" as const
  if (failed) return "error" as const
  return itemCount ? "ready" as const : "empty" as const
}

export const plantKeys = {
  root: ["plants"] as const,
  list: (gardenId: string, filters: PlantListFilters) => ["plants", gardenId, "list", filters] as const,
  detail: (gardenId: string, plantId: string) => ["plants", gardenId, "detail", plantId] as const,
  count: (gardenId: string) => ["plants", gardenId, "active-count"] as const,
  locations: (gardenId: string) => ["plants", gardenId, "locations"] as const,
}
