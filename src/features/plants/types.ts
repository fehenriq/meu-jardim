export const plantStatuses = ["active", "recovering", "archived"] as const
export const plantOrigins = ["seed", "seedling", "purchased", "other"] as const
export const lightExposures = ["low_light", "indirect_light", "partial_sun", "full_sun"] as const

export type PlantStatus = (typeof plantStatuses)[number]
export type PlantOrigin = (typeof plantOrigins)[number]
export type LightExposure = (typeof lightExposures)[number]

export type Plant = {
  id: string
  garden_id: string
  nickname: string
  species: string | null
  main_photo_path: string | null
  location: string | null
  acquired_at: string | null
  origin: PlantOrigin | null
  light_exposure: LightExposure | null
  pot_soil_notes: string | null
  notes: string | null
  status: PlantStatus
  created_by: string
  created_at: string
  updated_at: string
}

export type PlantWithPhoto = Plant & { signedPhotoUrl: string | null }

export type PlantInsertPayload = {
  nickname: string
  species: string | null
  location: string | null
  acquired_at: string | null
  origin: PlantOrigin | null
  light_exposure: LightExposure | null
  pot_soil_notes: string | null
  notes: string | null
  status: "active"
}

export type PlantListFilters = {
  search: string
  location: string
  status: PlantStatus | "all"
  page: number
  pageSize: number
}

export const originLabels: Record<PlantOrigin, string> = {
  seed: "Semente",
  seedling: "Muda",
  purchased: "Planta adquirida",
  other: "Outro",
}

export const lightLabels: Record<LightExposure, string> = {
  low_light: "Pouca luz",
  indirect_light: "Luz indireta",
  partial_sun: "Sol parcial",
  full_sun: "Sol pleno",
}

export const statusLabels: Record<PlantStatus, string> = {
  active: "Ativa",
  recovering: "Em recuperação",
  archived: "Arquivada",
}
