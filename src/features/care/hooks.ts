import { useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { listCareEvents, listCareSchedules } from "./api"

export const careKeys = {
  root: ["care"] as const,
  schedules: (gardenId: string, plantId: string) => ["care", gardenId, plantId, "schedules"] as const,
  events: (gardenId: string, plantId: string) => ["care", gardenId, plantId, "events"] as const,
}

export function useCareSchedules(gardenId: string, plantId: string) {
  return useQuery({ queryKey: careKeys.schedules(gardenId, plantId), queryFn: () => listCareSchedules(gardenId, plantId), enabled: Boolean(gardenId && plantId) })
}

export function useCareEvents(gardenId: string, plantId: string) {
  return useQuery({ queryKey: careKeys.events(gardenId, plantId), queryFn: () => listCareEvents(gardenId, plantId), enabled: Boolean(gardenId && plantId) })
}

export function useClearForeignCareQueries(gardenId: string) {
  const queryClient = useQueryClient()
  useEffect(() => {
    queryClient.removeQueries({ queryKey: careKeys.root, predicate: (query) => query.queryKey[0] === "care" && query.queryKey[1] !== gardenId })
  }, [gardenId, queryClient])
}

export async function invalidatePlantCare(queryClient: ReturnType<typeof useQueryClient>, gardenId: string, plantId: string) {
  await queryClient.invalidateQueries({ queryKey: ["care", gardenId, plantId] })
}
