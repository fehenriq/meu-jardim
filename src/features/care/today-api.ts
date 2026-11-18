import { supabase } from "@/lib/supabase"
import { signPlantPhotos } from "@/features/plants/api"
import type { TodayActivity, TodayDashboardData, TodayPlant, TodaySchedule } from "./today-types"

const scheduleSelection = "id, garden_id, plant_id, care_type, custom_title, next_due_date, plant:plants!care_schedules_plant_garden_fk!inner(id, nickname, main_photo_path, status)"
const activitySelection = "id, plant_id, event_type, event_at, actor_id, plant:plants!care_events_plant_garden_fk!inner(id, nickname)"

type RawSchedule = Omit<TodaySchedule, "plant" | "signedPhotoUrl"> & { plant: TodayPlant }

async function signSchedules(rows: RawSchedule[]) {
  const signed = await signPlantPhotos(rows.map((row) => row.plant))
  return rows.map((row, index) => ({ ...row, plant: row.plant, signedPhotoUrl: signed[index].signedPhotoUrl }))
}

export async function loadTodayDashboard(gardenId: string, today: string): Promise<TodayDashboardData> {
  const dueBase = () => supabase.from("care_schedules").select(scheduleSelection, { count: "exact" }).eq("garden_id", gardenId).eq("active", true).neq("plant.status", "archived").lte("next_due_date", today)
  const [watering, other, dueResult, upcomingResult, activitiesResult] = await Promise.all([
    dueBase().eq("care_type", "watering_check").limit(1),
    dueBase().neq("care_type", "watering_check").limit(1),
    dueBase().order("next_due_date").order("id").limit(20),
    supabase.from("care_schedules").select(scheduleSelection).eq("garden_id", gardenId).eq("active", true).neq("plant.status", "archived").gt("next_due_date", today).order("next_due_date").order("id").limit(5),
    supabase.from("care_events").select(activitySelection).eq("garden_id", gardenId).order("event_at", { ascending: false }).order("id", { ascending: false }).limit(5),
  ])
  const error = watering.error ?? other.error ?? dueResult.error ?? upcomingResult.error ?? activitiesResult.error
  if (error) throw error
  return {
    wateringCount: watering.count ?? 0,
    otherCount: other.count ?? 0,
    due: await signSchedules((dueResult.data ?? []) as unknown as RawSchedule[]),
    upcoming: await signSchedules((upcomingResult.data ?? []) as unknown as RawSchedule[]),
    activities: (activitiesResult.data ?? []) as unknown as TodayActivity[],
  }
}
