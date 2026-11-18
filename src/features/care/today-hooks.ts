import { useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { loadTodayDashboard } from "./today-api"

export const todayCareKeys = {
  root: ["today-care"] as const,
  dashboard: (gardenId: string, today: string) => ["today-care", gardenId, today] as const,
}

export function useTodayCare(gardenId: string, today: string) {
  return useQuery({ queryKey: todayCareKeys.dashboard(gardenId, today), queryFn: () => loadTodayDashboard(gardenId, today), enabled: Boolean(gardenId), refetchInterval: 5 * 60 * 1000 })
}

export function useClearForeignTodayCare(gardenId: string) {
  const queryClient = useQueryClient()
  useEffect(() => {
    queryClient.removeQueries({ queryKey: todayCareKeys.root, predicate: (query) => query.queryKey[0] === "today-care" && query.queryKey[1] !== gardenId })
  }, [gardenId, queryClient])
}

export async function invalidateTodayCare(queryClient: ReturnType<typeof useQueryClient>, gardenId: string) {
  await queryClient.invalidateQueries({ queryKey: ["today-care", gardenId] })
}
