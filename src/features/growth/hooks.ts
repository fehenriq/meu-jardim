import { useEffect } from "react"
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query"
import { listGrowthTimeline } from "./api"

export const growthKeys = {
  root: ["growth"] as const,
  timeline: (gardenId: string, plantId: string) => ["growth", gardenId, plantId, "timeline"] as const,
}

export function useGrowthTimeline(gardenId: string, plantId: string) {
  return useInfiniteQuery({ queryKey: growthKeys.timeline(gardenId, plantId), queryFn: ({ pageParam }) => listGrowthTimeline(gardenId, plantId, pageParam), initialPageParam: 0, getNextPageParam: (lastPage) => lastPage.nextPage, enabled: Boolean(gardenId && plantId), refetchInterval: 9 * 60 * 1000 })
}

export function useClearForeignGrowthQueries(gardenId: string, plantId: string) {
  const queryClient = useQueryClient()
  useEffect(() => {
    queryClient.removeQueries({ queryKey: growthKeys.root, predicate: (query) => query.queryKey[0] === "growth" && (query.queryKey[1] !== gardenId || query.queryKey[2] !== plantId) })
  }, [gardenId, plantId, queryClient])
}

export async function invalidateGrowthTimeline(queryClient: ReturnType<typeof useQueryClient>, gardenId: string, plantId: string) {
  await queryClient.invalidateQueries({ queryKey: ["growth", gardenId, plantId] })
}
