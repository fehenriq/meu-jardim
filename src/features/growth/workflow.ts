import type { GrowthEntry, GrowthRecovery } from "./types"

type Dependencies = {
  createEntry: typeof import("./api").createGrowthEntry
  findEntries: typeof import("./api").findGrowthEntry
  uploadPhoto: typeof import("./api").uploadGrowthPhoto
  objectExists: typeof import("./api").growthPhotoObjectExists
  registerPhoto: typeof import("./api").registerGrowthPhoto
  findPhoto: typeof import("./api").findGrowthPhoto
}

export function createGrowthSubmissionGate() {
  let pending = false
  return async <T>(task: () => Promise<T>) => {
    if (pending) return undefined
    pending = true
    try { return await task() } finally { pending = false }
  }
}

async function resolveEntry(recovery: GrowthRecovery, dependencies: Dependencies) {
  if (recovery.entry) return recovery.entry
  const matches = await dependencies.findEntries(recovery.gardenId, recovery.userId, recovery.payload)
  if (matches.length > 1) throw new Error("Não foi possível identificar com segurança o registro salvo. Recarregue a linha do tempo.")
  if (matches.length === 1) return matches[0]
  return dependencies.createEntry(recovery.payload)
}

export type GrowthSaveResult =
  | { state: "complete"; entry: GrowthEntry }
  | { state: "partial"; recovery: GrowthRecovery; message: string }

export async function saveGrowthEntry(initial: GrowthRecovery, dependencies: Dependencies): Promise<GrowthSaveResult> {
  let entry: GrowthEntry
  try {
    entry = await resolveEntry(initial, dependencies)
  } catch (error) {
    return { state: "partial", recovery: initial, message: error instanceof Error ? error.message : "Não foi possível confirmar o registro. Tente recuperar sem criar outro." }
  }

  const recovery: GrowthRecovery = { ...initial, entry, photos: initial.photos.map((photo) => ({ ...photo })) }
  for (const photo of recovery.photos) {
    if (photo.state === "pending") {
      try {
        await dependencies.uploadPhoto(photo.path, photo.file)
        photo.state = "uploaded"
      } catch {
        if (await dependencies.objectExists(photo.path)) photo.state = "uploaded"
        else return { state: "partial", recovery, message: "O registro foi salvo, mas há fotografias pendentes de envio." }
      }
    }
    if (photo.state === "uploaded") {
      try {
        await dependencies.registerPhoto(recovery.plantId, entry.id, photo.path, recovery.payload.observed_at)
        photo.state = "registered"
      } catch {
        const existing = await dependencies.findPhoto(recovery.gardenId, recovery.plantId, photo.path).catch(() => null)
        if (existing?.growth_entry_id === entry.id) photo.state = "registered"
        else return { state: "partial", recovery, message: "A fotografia foi enviada, mas sua associação ainda está pendente." }
      }
    }
  }
  return { state: "complete", entry }
}
