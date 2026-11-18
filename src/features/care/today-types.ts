import type { CareAction, CareType } from "./types"

export type TodayPlant = { id: string; nickname: string; main_photo_path: string | null; status?: string }

export type TodaySchedule = {
  id: string
  garden_id: string
  plant_id: string
  care_type: CareType
  custom_title: string | null
  next_due_date: string
  plant: TodayPlant
  signedPhotoUrl: string | null
}

export type TodayActivity = {
  id: string
  plant_id: string
  event_type: CareAction
  event_at: string
  actor_id: string
  plant: Pick<TodayPlant, "id" | "nickname">
}

export type TodayDashboardData = {
  wateringCount: number
  otherCount: number
  due: TodaySchedule[]
  upcoming: TodaySchedule[]
  activities: TodayActivity[]
}
