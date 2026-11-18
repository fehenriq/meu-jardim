import { supabase } from "@/lib/supabase"
import { validatePlantPhoto } from "@/features/plants/schema"
import type { GrowthEntry, GrowthEntryPayload, GrowthPhoto, GrowthTimelineItem } from "./types"

export const GROWTH_PAGE_SIZE = 8
const entryColumns = "id, garden_id, plant_id, observed_at, height_cm, leaf_count, notes, created_by, created_at"
const photoColumns = "id, garden_id, plant_id, growth_entry_id, storage_path, taken_at, uploaded_by, created_at"

async function signGrowthPhotos(photos: Omit<GrowthPhoto, "signed_url">[]) {
  if (!photos.length) return []
  const paths = photos.map((photo) => photo.storage_path)
  const { data, error } = await supabase.storage.from("plant-photos").createSignedUrls(paths, 10 * 60)
  if (error) return photos.map((photo) => ({ ...photo, signed_url: null }))
  return photos.map((photo, index) => ({ ...photo, signed_url: data[index]?.error ? null : data[index]?.signedUrl ?? null }))
}

export async function listGrowthTimeline(gardenId: string, plantId: string, page: number) {
  const from = page * GROWTH_PAGE_SIZE
  const { data, error } = await supabase.from("growth_entries").select(entryColumns).eq("garden_id", gardenId).eq("plant_id", plantId).order("observed_at", { ascending: false }).order("id", { ascending: false }).range(from, from + GROWTH_PAGE_SIZE)
  if (error) throw error
  const rows = (data ?? []) as GrowthEntry[]
  const entries = rows.slice(0, GROWTH_PAGE_SIZE)
  const ids = entries.map((entry) => entry.id)
  let photos: GrowthPhoto[] = []
  if (ids.length) {
    const result = await supabase.from("plant_photos").select(photoColumns).eq("garden_id", gardenId).eq("plant_id", plantId).in("growth_entry_id", ids).order("created_at", { ascending: true })
    if (result.error) throw result.error
    photos = await signGrowthPhotos((result.data ?? []) as Omit<GrowthPhoto, "signed_url">[])
  }
  const items: GrowthTimelineItem[] = entries.map((entry) => ({ ...entry, photos: photos.filter((photo) => photo.growth_entry_id === entry.id) }))
  return { items, nextPage: rows.length > GROWTH_PAGE_SIZE ? page + 1 : undefined }
}

export async function createGrowthEntry(payload: GrowthEntryPayload) {
  const { data, error } = await supabase.from("growth_entries").insert(payload).select(entryColumns).single()
  if (error) throw error
  return data as GrowthEntry
}

export async function findGrowthEntry(gardenId: string, userId: string, payload: GrowthEntryPayload) {
  let query = supabase.from("growth_entries").select(entryColumns).eq("garden_id", gardenId).eq("plant_id", payload.plant_id).eq("created_by", userId).eq("observed_at", payload.observed_at)
  query = payload.height_cm === null ? query.is("height_cm", null) : query.eq("height_cm", payload.height_cm)
  query = payload.leaf_count === null ? query.is("leaf_count", null) : query.eq("leaf_count", payload.leaf_count)
  query = payload.notes === null ? query.is("notes", null) : query.eq("notes", payload.notes)
  const { data, error } = await query.limit(2)
  if (error) throw error
  return (data ?? []) as GrowthEntry[]
}

export function createGrowthPhotoDrafts(gardenId: string, plantId: string, files: File[]) {
  return files.map((file) => {
    const validation = validatePlantPhoto(file)
    if (!validation.valid || !validation.extension) throw new Error(validation.valid ? "Foto inválida." : validation.message)
    return { file, path: `${gardenId}/${plantId}/${crypto.randomUUID()}.${validation.extension}`, state: "pending" as const }
  })
}

export async function uploadGrowthPhoto(path: string, file: File) {
  const { error } = await supabase.storage.from("plant-photos").upload(path, file, { cacheControl: "3600", contentType: file.type, upsert: false })
  if (error) throw error
}

export async function growthPhotoObjectExists(path: string) {
  const parts = path.split("/")
  const fileName = parts.pop()
  const { data, error } = await supabase.storage.from("plant-photos").list(parts.join("/"), { search: fileName, limit: 2 })
  if (error) return false
  return data.some((item) => item.name === fileName)
}

export async function registerGrowthPhoto(plantId: string, entryId: string, path: string, takenAt: string) {
  const { data, error } = await supabase.from("plant_photos").insert({ plant_id: plantId, growth_entry_id: entryId, storage_path: path, taken_at: takenAt }).select(photoColumns).single()
  if (error) throw error
  return data
}

export async function findGrowthPhoto(gardenId: string, plantId: string, path: string) {
  const { data, error } = await supabase.from("plant_photos").select(photoColumns).eq("garden_id", gardenId).eq("plant_id", plantId).eq("storage_path", path).maybeSingle()
  if (error) throw error
  return data as Omit<GrowthPhoto, "signed_url"> | null
}

export const growthWorkflowDependencies = { createEntry: createGrowthEntry, findEntries: findGrowthEntry, uploadPhoto: uploadGrowthPhoto, objectExists: growthPhotoObjectExists, registerPhoto: registerGrowthPhoto, findPhoto: findGrowthPhoto }
