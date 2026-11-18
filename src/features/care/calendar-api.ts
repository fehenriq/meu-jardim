import { supabase } from "@/lib/supabase"
import { eventCareType, eventDateInTimeZone, shiftCivilDays } from "./calendar-rules"
import type { CalendarData, CalendarEvent, CalendarPlant, CalendarSchedule } from "./calendar-types"
import type { CareAction, CareType } from "./types"

const scheduleSelection = "id, plant_id, care_type, custom_title, next_due_date, active, plant:plants!care_schedules_plant_garden_fk!inner(id, nickname, status)"
const eventSelection = "id, plant_id, schedule_id, event_type, event_at, note, actor_id, plant:plants!care_events_plant_garden_fk!inner(id, nickname, status), schedule:care_schedules!care_events_schedule_scope_fk(care_type)"

type RawSchedule = { id: string; plant_id: string; care_type: CareType; custom_title: string | null; next_due_date: string; active: boolean; plant: CalendarPlant }
type RawEvent = { id: string; plant_id: string; schedule_id: string | null; event_type: CareAction; event_at: string; note: string | null; actor_id: string; plant: CalendarPlant; schedule: { care_type: CareType } | null }

function eventUtcBounds(start: string, end: string) {
  return { from: `${shiftCivilDays(start, -1)}T00:00:00.000Z`, to: `${shiftCivilDays(end, 2)}T00:00:00.000Z` }
}

export async function loadCalendarData(gardenId: string, start: string, end: string, timeZone: string): Promise<CalendarData> {
  const bounds = eventUtcBounds(start, end)
  const [schedulesResult, eventsResult] = await Promise.all([
    supabase.from("care_schedules").select(scheduleSelection).eq("garden_id", gardenId).eq("active", true).neq("plant.status", "archived").gte("next_due_date", start).lte("next_due_date", end).order("next_due_date").order("id").limit(200),
    supabase.from("care_events").select(eventSelection).eq("garden_id", gardenId).gte("event_at", bounds.from).lt("event_at", bounds.to).order("event_at").order("id").limit(200),
  ])
  const error = schedulesResult.error ?? eventsResult.error
  if (error) throw error
  const schedules = ((schedulesResult.data ?? []) as unknown as RawSchedule[]).map((row): CalendarSchedule => ({ kind: "schedule", id: row.id, plantId: row.plant_id, careType: row.care_type, customTitle: row.custom_title, date: row.next_due_date, active: row.active, plant: row.plant }))
  const events = ((eventsResult.data ?? []) as unknown as RawEvent[]).map((row): CalendarEvent => ({ kind: "event", id: row.id, plantId: row.plant_id, careType: eventCareType(row.event_type, row.schedule?.care_type ?? null), eventType: row.event_type, date: eventDateInTimeZone(row.event_at, timeZone), eventAt: row.event_at, note: row.note, actorId: row.actor_id, scheduleId: row.schedule_id, plant: row.plant })).filter((event) => event.date >= start && event.date <= end)
  return { schedules, events, truncated: schedules.length === 200 || events.length === 200 }
}
