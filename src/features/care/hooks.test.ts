import { describe, expect, it } from "vitest"
import { careKeys } from "./hooks"

describe("isolamento do cache de cuidados", () => {
  it("separa jardim e planta nas consultas", () => {
    expect(careKeys.schedules("garden-a", "plant-a")).not.toEqual(careKeys.schedules("garden-b", "plant-a"))
    expect(careKeys.events("garden-a", "plant-a")).not.toEqual(careKeys.events("garden-a", "plant-b"))
  })

  it("separa rotinas do histórico", () => {
    expect(careKeys.schedules("garden-a", "plant-a")).not.toEqual(careKeys.events("garden-a", "plant-a"))
  })
})
