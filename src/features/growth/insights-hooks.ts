import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { listAllHeightMeasurements, listComparisonPhotos } from "./insights-api"

export const insightKeys = {
  heights: (gardenId: string, plantId: string) => ["growth", gardenId, plantId, "heights"] as const,
  photos: (gardenId: string, plantId: string) => ["growth", gardenId, plantId, "comparison-photos"] as const,
}

export function useHeightMeasurements(gardenId: string, plantId: string) {
  return useQuery({ queryKey: insightKeys.heights(gardenId, plantId), queryFn: () => listAllHeightMeasurements(gardenId, plantId), enabled: Boolean(gardenId && plantId) })
}

export function useComparisonPhotos(gardenId: string, plantId: string) {
  return useInfiniteQuery({ queryKey: insightKeys.photos(gardenId, plantId), queryFn: ({ pageParam }) => listComparisonPhotos(gardenId, plantId, pageParam), initialPageParam: 0, getNextPageParam: (lastPage) => lastPage.nextPage, enabled: Boolean(gardenId && plantId), refetchInterval: 9 * 60 * 1000 })
}
