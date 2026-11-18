import { describe, expect, it, vi } from "vitest"
import { createGrowthSubmissionGate, saveGrowthEntry } from "./workflow"
import type { GrowthEntry, GrowthRecovery } from "./types"

const entry: GrowthEntry = { id: "entry-a", garden_id: "garden-a", plant_id: "plant-a", observed_at: "2026-11-19T13:30:00Z", height_cm: null, leaf_count: null, notes: "Nova folha", created_by: "user-a", created_at: "2026-11-19T13:31:00Z" }
const photoA = new File(["a"], "a.jpg", { type: "image/jpeg" })
const photoB = new File(["b"], "b.jpg", { type: "image/jpeg" })

function recovery(): GrowthRecovery {
  return { gardenId: "garden-a", plantId: "plant-a", userId: "user-a", payload: { plant_id: "plant-a", observed_at: entry.observed_at, height_cm: null, leaf_count: null, notes: "Nova folha" }, entry: null, photos: [{ file: photoA, path: "garden-a/plant-a/a.jpg", state: "pending" }, { file: photoB, path: "garden-a/plant-a/b.jpg", state: "pending" }] }
}

function dependencies() {
  return { createEntry: vi.fn().mockResolvedValue(entry), findEntries: vi.fn().mockResolvedValue([]), uploadPhoto: vi.fn().mockResolvedValue(undefined), objectExists: vi.fn().mockResolvedValue(false), registerPhoto: vi.fn().mockResolvedValue({}), findPhoto: vi.fn().mockResolvedValue(null) }
}

describe("recuperação do diário fotográfico", () => {
  it("cria um registro e confirma múltiplas fotografias", async () => {
    const deps = dependencies()
    const result = await saveGrowthEntry(recovery(), deps)
    expect(result.state).toBe("complete")
    expect(deps.createEntry).toHaveBeenCalledOnce()
    expect(deps.uploadPhoto).toHaveBeenCalledTimes(2)
    expect(deps.registerPhoto).toHaveBeenCalledTimes(2)
  })

  it("retoma o segundo upload sem duplicar registro ou primeira fotografia", async () => {
    const deps = dependencies()
    deps.uploadPhoto.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("storage"))
    const partial = await saveGrowthEntry(recovery(), deps)
    expect(partial.state).toBe("partial")
    if (partial.state !== "partial") return
    expect(partial.recovery.photos.map((photo) => photo.state)).toEqual(["registered", "pending"])
    deps.uploadPhoto.mockResolvedValue(undefined)
    const complete = await saveGrowthEntry(partial.recovery, deps)
    expect(complete.state).toBe("complete")
    expect(deps.createEntry).toHaveBeenCalledOnce()
    expect(deps.registerPhoto).toHaveBeenCalledTimes(2)
  })

  it("reconcilia objeto e linha confirmados após resposta incerta", async () => {
    const deps = dependencies()
    deps.uploadPhoto.mockRejectedValue(new Error("timeout"))
    deps.objectExists.mockResolvedValue(true)
    deps.registerPhoto.mockRejectedValue(new Error("timeout"))
    deps.findPhoto.mockResolvedValue({ growth_entry_id: entry.id })
    const result = await saveGrowthEntry(recovery(), deps)
    expect(result.state).toBe("complete")
  })

  it("reutiliza registro encontrado antes de repetir insert", async () => {
    const deps = dependencies()
    deps.findEntries.mockResolvedValue([entry])
    await saveGrowthEntry(recovery(), deps)
    expect(deps.createEntry).not.toHaveBeenCalled()
  })

  it("bloqueia múltiplas submissões simultâneas", async () => {
    const gate = createGrowthSubmissionGate()
    let release: () => void = () => {}
    const pending = new Promise<void>((resolve) => { release = resolve })
    const task = vi.fn(() => pending)
    const first = gate(task)
    expect(await gate(task)).toBeUndefined()
    expect(task).toHaveBeenCalledOnce()
    release()
    await first
  })
})
