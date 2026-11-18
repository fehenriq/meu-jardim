import type { Plant, PlantInsertPayload, PlantUpdatePayload } from "./types"

type WorkflowDependencies = {
  createPlant: (gardenId: string, payload: PlantInsertPayload) => Promise<Plant>
  uploadPhoto: (gardenId: string, plantId: string, file: File) => Promise<string>
  associatePhoto: (gardenId: string, plantId: string, path: string) => Promise<Plant>
}

type EditWorkflowDependencies = {
  updatePlant: (gardenId: string, plantId: string, updatedAt: string, payload: PlantUpdatePayload) => Promise<Plant>
  uploadPhoto: (gardenId: string, plantId: string, file: File) => Promise<string>
  associatePhoto: (gardenId: string, plantId: string, updatedAt: string, path: string) => Promise<Plant>
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

export type EditPhotoRecovery =
  | { kind: "upload"; gardenId: string; plant: Plant; file: File }
  | { kind: "association"; gardenId: string; plant: Plant; path: string }

export type EditPlantResult =
  | { state: "complete"; plant: Plant }
  | { state: "orphaned_photo"; plant: Plant; recovery: EditPhotoRecovery; message: string }

export async function editPlantWithOptionalPhoto(
  gardenId: string,
  plant: Plant,
  payload: PlantUpdatePayload,
  photo: File | null,
  dependencies: EditWorkflowDependencies,
): Promise<EditPlantResult> {
  const updated = await dependencies.updatePlant(gardenId, plant.id, plant.updated_at, payload)
  if (!photo) return { state: "complete", plant: updated }
  let path: string
  try {
    path = await dependencies.uploadPhoto(gardenId, plant.id, photo)
  } catch {
    return { state: "orphaned_photo", plant: updated, recovery: { kind: "upload", gardenId, plant: updated, file: photo }, message: "As alterações foram salvas, mas não foi possível enviar a nova foto." }
  }
  try {
    return { state: "complete", plant: await dependencies.associatePhoto(gardenId, plant.id, updated.updated_at, path) }
  } catch {
    return {
      state: "orphaned_photo",
      plant: updated,
      recovery: { kind: "association", gardenId, plant: updated, path },
      message: "As alterações foram salvas, mas a nova foto ainda não pôde ser associada. O arquivo enviado pode permanecer órfão no Storage.",
    }
  }
}

export async function recoverEditedPlantPhoto(recovery: EditPhotoRecovery, dependencies: EditWorkflowDependencies): Promise<EditPlantResult> {
  if (recovery.kind === "upload") {
    let path: string
    try {
      path = await dependencies.uploadPhoto(recovery.gardenId, recovery.plant.id, recovery.file)
    } catch {
      return { state: "orphaned_photo", plant: recovery.plant, recovery, message: "Não foi possível enviar a nova foto. Os demais dados continuam salvos." }
    }
    return recoverEditedPlantPhoto({ kind: "association", gardenId: recovery.gardenId, plant: recovery.plant, path }, dependencies)
  }
  try {
    return { state: "complete", plant: await dependencies.associatePhoto(recovery.gardenId, recovery.plant.id, recovery.plant.updated_at, recovery.path) }
  } catch {
    return { state: "orphaned_photo", plant: recovery.plant, recovery, message: "A foto continua sem associação. O arquivo enviado pode permanecer órfão no Storage." }
  }
}
