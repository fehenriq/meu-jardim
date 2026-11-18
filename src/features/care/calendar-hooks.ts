import { useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { loadCalendarData } from "./calendar-api"

export const calendarKeys = {
  root: ["care-calendar"] as const,
  range: (gardenId: string, start: string, end: string) => ["care-calendar", gardenId, start, end] as const,
}

export function useCareCalendar(gardenId: string, start: string, end: string, timeZone: string) {
  return useQuery({ queryKey: calendarKeys.range(gardenId, start, end), queryFn: () => loadCalendarData(gardenId, start, end, timeZone), enabled: Boolean(gardenId), staleTime: 30_000 })
}

export function useClearForeignCalendarQueries(gardenId: string) {
  const queryClient = useQueryClient()
  useEffect(() => {
    queryClient.removeQueries({ queryKey: calendarKeys.root, predicate: (query) => query.queryKey[0] === "care-calendar" && query.queryKey[1] !== gardenId })
  }, [gardenId, queryClient])
}

export async function invalidateCareCalendar(queryClient: ReturnType<typeof useQueryClient>, gardenId: string) {
  await queryClient.invalidateQueries({ queryKey: ["care-calendar", gardenId] })
}
