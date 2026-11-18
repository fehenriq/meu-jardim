export const careTypes = ["watering_check", "fertilizing", "pruning", "repotting", "custom"] as const
export const careActions = ["watered", "moisture_checked", "deferred", "care_completed"] as const

export type CareType = (typeof careTypes)[number]
export type CareAction = (typeof careActions)[number]

export type CareSchedule = {
  id: string
  garden_id: string
  plant_id: string
  care_type: CareType
  custom_title: string | null
  interval_days: number
  next_due_date: string
  active: boolean
  settings: { moisture_recheck_days?: number }
  created_by: string
  created_at: string
  updated_at: string
}

export type CareEvent = {
  id: string
  garden_id: string
  plant_id: string
  schedule_id: string | null
  event_type: CareAction
  event_at: string
  actor_id: string
  request_id: string
  note: string | null
  metadata: { defer_days?: number }
  created_at: string
}

export type CareSchedulePayload = {
  care_type: CareType
  custom_title: string | null
  interval_days: number
  next_due_date: string
  active: boolean
  settings: { moisture_recheck_days?: number }
}

export const careTypeLabels: Record<CareType, string> = {
  watering_check: "Verificação de rega",
  fertilizing: "Adubação",
  pruning: "Poda",
  repotting: "Troca de vaso",
  custom: "Cuidado personalizado",
}

export const careEventLabels: Record<CareAction, string> = {
  watered: "Rega realizada",
  moisture_checked: "Solo ainda úmido",
  deferred: "Verificação adiada",
  care_completed: "Cuidado concluído",
}
