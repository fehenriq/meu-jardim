import { describe, expect, it, vi } from "vitest"
import { createPlantWithOptionalPhoto, createSubmissionGate, recoverPlantPhoto } from "./workflow"
import type { Plant, PlantInsertPayload } from "./types"

const payload: PlantInsertPayload = { nickname: "Jiboia", species: null, location: null, acquired_at: null, origin: null, light_exposure: null, pot_soil_notes: null, notes: null, status: "active" }
const plant: Plant = { id: "plant-a", garden_id: "garden-a", nickname: "Jiboia", species: null, main_photo_path: null, location: null, acquired_at: null, origin: null, light_exposure: null, pot_soil_notes: null, notes: null, status: "active", created_by: "user-a", created_at: "2026-11-18T00:00:00Z", updated_at: "2026-11-18T00:00:00Z" }
const photo = new File(["photo"], "plant.jpg", { type: "image/jpeg" })

function dependencies() {
  return {
    createPlant: vi.fn().mockResolvedValue(plant),
    uploadPhoto: vi.fn().mockResolvedValue("garden-a/plant-a/file.jpg"),
    associatePhoto: vi.fn().mockResolvedValue({ ...plant, main_photo_path: "garden-a/plant-a/file.jpg" }),
  }
}

describe("workflow de cadastro e foto", () => {
  it("cadastra sem foto em uma única inserção", async () => {
    const deps = dependencies()
    const result = await createPlantWithOptionalPhoto("garden-a", payload, null, deps)
    expect(result.state).toBe("complete")
    expect(deps.createPlant).toHaveBeenCalledOnce()
    expect(deps.uploadPhoto).not.toHaveBeenCalled()
  })

  it("mantém a planta quando o upload falha", async () => {
    const deps = dependencies()
    deps.uploadPhoto.mockRejectedValue(new Error("storage unavailable"))
    const result = await createPlantWithOptionalPhoto("garden-a", payload, photo, deps)
    expect(result.state).toBe("saved_without_photo")
    expect(deps.createPlant).toHaveBeenCalledOnce()
    expect(deps.associatePhoto).not.toHaveBeenCalled()
  })

  it("retoma upload sem duplicar a planta", async () => {
    const deps = dependencies()
    const recovery = { kind: "upload" as const, gardenId: "garden-a", plant, file: photo }
    const result = await recoverPlantPhoto(recovery, deps)
    expect(result.state).toBe("complete")
    expect(deps.createPlant).not.toHaveBeenCalled()
    expect(deps.uploadPhoto).toHaveBeenCalledOnce()
    expect(deps.associatePhoto).toHaveBeenCalledOnce()
  })

  it("retoma somente a associação quando o objeto já existe", async () => {
    const deps = dependencies()
    const recovery = { kind: "association" as const, gardenId: "garden-a", plant, path: "garden-a/plant-a/file.jpg" }
    const result = await recoverPlantPhoto(recovery, deps)
    expect(result.state).toBe("complete")
    expect(deps.createPlant).not.toHaveBeenCalled()
    expect(deps.uploadPhoto).not.toHaveBeenCalled()
    expect(deps.associatePhoto).toHaveBeenCalledOnce()
  })

  it("não reenvia o objeto quando somente a associação falha", async () => {
    const deps = dependencies()
    deps.associatePhoto.mockRejectedValue(new Error("update failed"))
    const result = await recoverPlantPhoto({ kind: "upload", gardenId: "garden-a", plant, file: photo }, deps)
    expect(result.state).toBe("saved_without_photo")
    if (result.state === "saved_without_photo") expect(result.recovery.kind).toBe("association")
    expect(deps.uploadPhoto).toHaveBeenCalledOnce()
  })

  it("bloqueia submissões simultâneas", async () => {
    const gate = createSubmissionGate()
    let release: () => void = () => {}
    const pending = new Promise<void>((resolve) => { release = () => resolve() })
    const task = vi.fn(() => pending)
    const first = gate(task)
    const second = await gate(task)
    expect(second).toBeUndefined()
    expect(task).toHaveBeenCalledOnce()
    release()
    await first
  })
})
