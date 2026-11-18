import { useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { countActivePlants, getPlant, listGardenLocations, listPlants } from "./api"
import { plantKeys } from "./query-spec"
import type { PlantListFilters } from "./types"

export function useClearForeignGardenPlantQueries(gardenId: string) {
  const queryClient = useQueryClient()
  useEffect(() => {
    queryClient.removeQueries({
      queryKey: plantKeys.root,
      predicate: (query) => query.queryKey[0] === "plants" && query.queryKey[1] !== gardenId,
    })
  }, [gardenId, queryClient])
}

export function usePlants(gardenId: string, filters: PlantListFilters) {
  return useQuery({ queryKey: plantKeys.list(gardenId, filters), queryFn: () => listPlants(gardenId, filters), enabled: Boolean(gardenId), staleTime: 20_000, refetchInterval: 9 * 60 * 1000 })
}

export function usePlant(gardenId: string, plantId: string) {
  return useQuery({ queryKey: plantKeys.detail(gardenId, plantId), queryFn: () => getPlant(gardenId, plantId), enabled: Boolean(gardenId && plantId), retry: 1, refetchInterval: 9 * 60 * 1000 })
}

export function useActivePlantCount(gardenId: string) {
  return useQuery({ queryKey: plantKeys.count(gardenId), queryFn: () => countActivePlants(gardenId), enabled: Boolean(gardenId) })
}

export function useGardenLocations(gardenId: string) {
  return useQuery({ queryKey: plantKeys.locations(gardenId), queryFn: () => listGardenLocations(gardenId), enabled: Boolean(gardenId), staleTime: 60_000 })
}

export async function invalidateGardenPlants(queryClient: ReturnType<typeof useQueryClient>, gardenId: string) {
  await queryClient.invalidateQueries({ queryKey: ["plants", gardenId] })
}
