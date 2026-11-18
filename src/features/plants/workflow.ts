import type { Plant, PlantInsertPayload } from "./types"

type WorkflowDependencies = {
  createPlant: (gardenId: string, payload: PlantInsertPayload) => Promise<Plant>
  uploadPhoto: (gardenId: string, plantId: string, file: File) => Promise<string>
  associatePhoto: (gardenId: string, plantId: string, path: string) => Promise<Plant>
}

export function createSubmissionGate() {
  let pending = false
  return async <T>(task: () => Promise<T>) => {
    if (pending) return undefined
    pending = true
    try { return await task() } finally { pending = false }
  }
}

export type PhotoRecovery =
  | { kind: "upload"; gardenId: string; plant: Plant; file: File }
  | { kind: "association"; gardenId: string; plant: Plant; path: string }

export type CreatePlantResult =
  | { state: "complete"; plant: Plant }
  | { state: "saved_without_photo"; plant: Plant; recovery: PhotoRecovery; message: string }

export async function createPlantWithOptionalPhoto(
  gardenId: string,
  payload: PlantInsertPayload,
  photo: File | null,
  dependencies: WorkflowDependencies,
): Promise<CreatePlantResult> {
  const plant = await dependencies.createPlant(gardenId, payload)
  if (!photo) return { state: "complete", plant }

  let path: string
  try {
    path = await dependencies.uploadPhoto(gardenId, plant.id, photo)
  } catch {
    return {
      state: "saved_without_photo",
      plant,
      recovery: { kind: "upload", gardenId, plant, file: photo },
      message: "A planta foi salva, mas não foi possível enviar a foto.",
    }
  }

  try {
    const updated = await dependencies.associatePhoto(gardenId, plant.id, path)
    return { state: "complete", plant: updated }
  } catch {
    return {
      state: "saved_without_photo",
      plant,
      recovery: { kind: "association", gardenId, plant, path },
      message: "A planta e a foto foram salvas, mas a foto ainda não pôde ser associada.",
    }
  }
}

export async function recoverPlantPhoto(recovery: PhotoRecovery, dependencies: WorkflowDependencies): Promise<CreatePlantResult> {
  if (recovery.kind === "association") {
    try {
      return { state: "complete", plant: await dependencies.associatePhoto(recovery.gardenId, recovery.plant.id, recovery.path) }
    } catch {
      return { state: "saved_without_photo", plant: recovery.plant, recovery, message: "A planta continua salva sem foto. Não foi possível concluir a associação agora." }
    }
  }
  let path: string
  try {
    path = await dependencies.uploadPhoto(recovery.gardenId, recovery.plant.id, recovery.file)
  } catch {
    return { state: "saved_without_photo", plant: recovery.plant, recovery, message: "A planta continua salva sem foto. Não foi possível enviar o arquivo agora." }
  }
  try {
    return { state: "complete", plant: await dependencies.associatePhoto(recovery.gardenId, recovery.plant.id, path) }
  } catch {
    return { state: "saved_without_photo", plant: recovery.plant, recovery: { kind: "association", gardenId: recovery.gardenId, plant: recovery.plant, path }, message: "A foto foi enviada, mas ainda não pôde ser associada à planta." }
  }
}
