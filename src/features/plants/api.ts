import { supabase } from "@/lib/supabase"
import { createPlantDetailSpec, createPlantListSpec } from "./query-spec"
import { validatePlantPhoto } from "./schema"
import type { Plant, PlantInsertPayload, PlantListFilters, PlantStatus, PlantUpdatePayload, PlantWithPhoto } from "./types"

const plantColumns = "id, garden_id, nickname, species, main_photo_path, location, acquired_at, origin, light_exposure, pot_soil_notes, notes, status, created_by, created_at, updated_at"

async function signPlantPhotos(plants: Plant[]) {
  const paths = plants.flatMap((plant) => plant.main_photo_path ? [plant.main_photo_path] : [])
  if (!paths.length) return plants.map((plant) => ({ ...plant, signedPhotoUrl: null }))
  const { data, error } = await supabase.storage.from("plant-photos").createSignedUrls(paths, 10 * 60)
  if (error) return plants.map((plant) => ({ ...plant, signedPhotoUrl: null }))
  const urls = new Map(data.map((item, index) => [paths[index], item.error ? null : item.signedUrl]))
  return plants.map((plant) => ({ ...plant, signedPhotoUrl: plant.main_photo_path ? urls.get(plant.main_photo_path) ?? null : null }))
}

export async function listPlants(gardenId: string, filters: PlantListFilters) {
  const spec = createPlantListSpec(gardenId, filters)
  let query = supabase.from("plants").select(plantColumns, { count: "exact" }).eq("garden_id", spec.gardenId)
  if (spec.search) query = query.ilike("nickname", `%${spec.search}%`)
  if (spec.location) query = query.eq("location", spec.location)
  if (spec.status !== "all") query = query.eq("status", spec.status)
  const { data, error, count } = await query.order("created_at", { ascending: false }).range(spec.from, spec.to)
  if (error) throw error
  return { plants: await signPlantPhotos((data || []) as Plant[]), count: count ?? 0 }
}

export async function listGardenLocations(gardenId: string) {
  const { data, error } = await supabase.from("plants").select("location").eq("garden_id", gardenId).not("location", "is", null).order("location").limit(200)
  if (error) throw error
  return Array.from(new Set((data || []).flatMap((item) => item.location ? [item.location as string] : [])))
}

export async function getPlant(gardenId: string, plantId: string): Promise<PlantWithPhoto | null> {
  const spec = createPlantDetailSpec(gardenId, plantId)
  const { data, error } = await supabase.from("plants").select(plantColumns).eq("garden_id", spec.gardenId).eq("id", spec.plantId).maybeSingle()
  if (error) throw error
  if (!data) return null
  return (await signPlantPhotos([data as Plant]))[0]
}

export async function countActivePlants(gardenId: string) {
  const { count, error } = await supabase.from("plants").select("id", { count: "exact", head: true }).eq("garden_id", gardenId).eq("status", "active")
  if (error) throw error
  return count ?? 0
}

export async function createPlant(gardenId: string, payload: PlantInsertPayload) {
  const { data, error } = await supabase.from("plants").insert({ garden_id: gardenId, ...payload }).select(plantColumns).single()
  if (error) throw error
  return data as Plant
}

export async function uploadPlantPhoto(gardenId: string, plantId: string, file: File) {
  const validation = validatePlantPhoto(file)
  if (!validation.valid || !validation.extension) throw new Error(validation.valid ? "Foto inválida." : validation.message)
  const path = `${gardenId}/${plantId}/${crypto.randomUUID()}.${validation.extension}`
  const { error } = await supabase.storage.from("plant-photos").upload(path, file, { cacheControl: "3600", contentType: file.type, upsert: false })
  if (error) throw error
  return path
}

export async function associatePlantPhoto(gardenId: string, plantId: string, path: string) {
  const { data, error } = await supabase.from("plants").update({ main_photo_path: path }).eq("garden_id", gardenId).eq("id", plantId).select(plantColumns).single()
  if (error) throw error
  return data as Plant
}

export class PlantMutationError extends Error {
  constructor(public kind: "conflict" | "unavailable") {
    super(kind)
  }
}

async function updatePlantWithVersion(gardenId: string, plantId: string, updatedAt: string, payload: PlantUpdatePayload | { main_photo_path: string } | { status: PlantStatus }) {
  const { data, error } = await supabase.from("plants").update(payload).eq("garden_id", gardenId).eq("id", plantId).eq("updated_at", updatedAt).select(plantColumns).maybeSingle()
  if (error) throw error
  if (data) return data as Plant
  const current = await getPlant(gardenId, plantId)
  throw new PlantMutationError(current ? "conflict" : "unavailable")
}

export function updatePlant(gardenId: string, plantId: string, updatedAt: string, payload: PlantUpdatePayload) {
  return updatePlantWithVersion(gardenId, plantId, updatedAt, payload)
}

export function associateReplacementPhoto(gardenId: string, plantId: string, updatedAt: string, path: string) {
  return updatePlantWithVersion(gardenId, plantId, updatedAt, { main_photo_path: path })
}

export function updatePlantStatus(gardenId: string, plantId: string, updatedAt: string, status: PlantStatus) {
  return updatePlantWithVersion(gardenId, plantId, updatedAt, { status })
}

export const plantWorkflowDependencies = { createPlant, uploadPhoto: uploadPlantPhoto, associatePhoto: associatePlantPhoto }
export const plantEditWorkflowDependencies = { updatePlant, uploadPhoto: uploadPlantPhoto, associatePhoto: associateReplacementPhoto }
