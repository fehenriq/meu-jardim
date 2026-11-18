import { supabase } from "@/lib/supabase"
import type { CareActionIntent } from "./workflow"
import type { CareEvent, CareSchedule, CareSchedulePayload } from "./types"

const scheduleColumns = "id, garden_id, plant_id, care_type, custom_title, interval_days, next_due_date, active, settings, created_by, created_at, updated_at"
const eventColumns = "id, garden_id, plant_id, schedule_id, event_type, event_at, actor_id, request_id, note, metadata, created_at"

export async function listCareSchedules(gardenId: string, plantId: string) {
  const { data, error } = await supabase.from("care_schedules").select(scheduleColumns).eq("garden_id", gardenId).eq("plant_id", plantId).order("next_due_date")
  if (error) throw error
  return (data ?? []) as CareSchedule[]
}

export async function listCareEvents(gardenId: string, plantId: string) {
  const { data, error } = await supabase.from("care_events").select(eventColumns).eq("garden_id", gardenId).eq("plant_id", plantId).order("event_at", { ascending: false }).limit(30)
  if (error) throw error
  return (data ?? []) as CareEvent[]
}

export async function createCareSchedule(plantId: string, payload: CareSchedulePayload) {
  const { data, error } = await supabase.from("care_schedules").insert({ plant_id: plantId, ...payload }).select(scheduleColumns).single()
  if (error) throw error
  return data as CareSchedule
}

export class CareScheduleMutationError extends Error {}

export async function updateCareSchedule(gardenId: string, plantId: string, scheduleId: string, updatedAt: string, payload: CareSchedulePayload | { active: boolean }) {
  const { data, error } = await supabase.from("care_schedules").update(payload).eq("garden_id", gardenId).eq("plant_id", plantId).eq("id", scheduleId).eq("updated_at", updatedAt).select(scheduleColumns).maybeSingle()
  if (error) throw error
  if (!data) throw new CareScheduleMutationError("A rotina foi alterada em outra sessão ou o acesso não está mais disponível.")
  return data as CareSchedule
}

export async function recordCareAction(intent: CareActionIntent) {
  const { data, error } = await supabase.rpc("record_care_action", intent.rpcPayload)
  if (error) throw error
  return data as CareEvent
}
