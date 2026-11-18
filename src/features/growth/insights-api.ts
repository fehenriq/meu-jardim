import { supabase } from "@/lib/supabase"
import { normalizeHeightMeasurements } from "./insights-rules"
import type { ComparisonPhoto } from "./insights-types"

export const HEIGHT_BATCH_SIZE = 200
export const PHOTO_PAGE_SIZE = 24
const photoColumns = "id, garden_id, plant_id, growth_entry_id, storage_path, taken_at, created_at"

export async function listAllHeightMeasurements(gardenId: string, plantId: string) {
  const rows: Array<{ id: string; observed_at: string; height_cm: number | string | null }> = []
  let page = 0
  while (true) {
    const from = page * HEIGHT_BATCH_SIZE
    const { data, error } = await supabase.from("growth_entries").select("id, observed_at, height_cm").eq("garden_id", gardenId).eq("plant_id", plantId).not("height_cm", "is", null).order("observed_at", { ascending: true }).order("id", { ascending: true }).range(from, from + HEIGHT_BATCH_SIZE - 1)
    if (error) throw error
    const batch = (data ?? []) as Array<{ id: string; observed_at: string; height_cm: number | string | null }>
    rows.push(...batch)
    if (batch.length < HEIGHT_BATCH_SIZE) break
    page += 1
  }
  return normalizeHeightMeasurements(rows)
}

export async function listComparisonPhotos(gardenId: string, plantId: string, page: number) {
  const from = page * PHOTO_PAGE_SIZE
  const { data, error } = await supabase.from("plant_photos").select(photoColumns).eq("garden_id", gardenId).eq("plant_id", plantId).order("created_at", { ascending: false }).order("id", { ascending: false }).range(from, from + PHOTO_PAGE_SIZE)
  if (error) throw error
  const rows = (data ?? []) as Array<Omit<ComparisonPhoto, "observed_at" | "signed_url">>
  const photos = rows.slice(0, PHOTO_PAGE_SIZE)
  const entryIds = Array.from(new Set(photos.flatMap((photo) => photo.growth_entry_id ? [photo.growth_entry_id] : [])))
  const observedByEntry = new Map<string, string>()
  if (entryIds.length) {
    const entries = await supabase.from("growth_entries").select("id, observed_at").eq("garden_id", gardenId).eq("plant_id", plantId).in("id", entryIds)
    if (entries.error) throw entries.error
    for (const entry of entries.data ?? []) observedByEntry.set(entry.id as string, entry.observed_at as string)
  }
  const paths = photos.map((photo) => photo.storage_path)
  const signed = paths.length ? await supabase.storage.from("plant-photos").createSignedUrls(paths, 10 * 60) : { data: [], error: null }
  const items: ComparisonPhoto[] = photos.map((photo, index) => ({ ...photo, observed_at: photo.growth_entry_id ? observedByEntry.get(photo.growth_entry_id) ?? null : null, signed_url: signed.error || signed.data[index]?.error ? null : signed.data[index]?.signedUrl ?? null }))
  return { items, nextPage: rows.length > PHOTO_PAGE_SIZE ? page + 1 : undefined }
}
