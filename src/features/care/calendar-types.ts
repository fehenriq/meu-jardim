import type { CareAction, CareType } from "./types"

export type CalendarPlant = { id: string; nickname: string; status: string }

export type CalendarSchedule = {
  kind: "schedule"
  id: string
  plantId: string
  careType: CareType
  customTitle: string | null
  date: string
  active: boolean
  plant: CalendarPlant
}

export type CalendarEvent = {
  kind: "event"
  id: string
  plantId: string
  careType: CareType
  eventType: CareAction
  date: string
  eventAt: string
  note: string | null
  actorId: string
  scheduleId: string | null
  plant: CalendarPlant
}

export type CalendarItem = CalendarSchedule | CalendarEvent
export type CalendarData = { schedules: CalendarSchedule[]; events: CalendarEvent[]; truncated: boolean }
