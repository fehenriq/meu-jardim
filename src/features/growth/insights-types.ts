export type HeightMeasurement = {
  id: string
  observed_at: string
  height_cm: number
}

export type ComparisonPhoto = {
  id: string
  garden_id: string
  plant_id: string
  growth_entry_id: string | null
  storage_path: string
  taken_at: string | null
  created_at: string
  observed_at: string | null
  signed_url: string | null
}
