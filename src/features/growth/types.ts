export type GrowthEntry = {
  id: string
  garden_id: string
  plant_id: string
  observed_at: string
  height_cm: number | null
  leaf_count: number | null
  notes: string | null
  created_by: string
  created_at: string
}

export type GrowthPhoto = {
  id: string
  garden_id: string
  plant_id: string
  growth_entry_id: string | null
  storage_path: string
  taken_at: string | null
  uploaded_by: string
  created_at: string
  signed_url: string | null
}

export type GrowthTimelineItem = GrowthEntry & { photos: GrowthPhoto[] }

export type GrowthEntryPayload = {
  plant_id: string
  observed_at: string
  height_cm: number | null
  leaf_count: number | null
  notes: string | null
}

export type GrowthFormValues = {
  observedAt: string
  heightCm: string
  leafCount: string
  notes: string
}

export type GrowthPhotoDraft = {
  file: File
  path: string
  state: "pending" | "uploaded" | "registered"
}

export type GrowthRecovery = {
  gardenId: string
  plantId: string
  userId: string
  payload: GrowthEntryPayload
  entry: GrowthEntry | null
  photos: GrowthPhotoDraft[]
}
