import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { todayCareKeys } from "./today-hooks"

const source = readFileSync(resolve(process.cwd(), "src/features/care/today-api.ts"), "utf8")

describe("contrato de consultas da tela Hoje", () => {
  it("filtra no servidor por jardim, atividade, status e data civil", () => {
    expect(source).toContain('.eq("garden_id", gardenId)')
    expect(source).toContain('.eq("active", true)')
    expect(source).toContain('.neq("plant.status", "archived")')
    expect(source).toContain('.lte("next_due_date", today)')
    expect(source).toContain('.gt("next_due_date", today)')
  })

  it("limita pendências, próximos cuidados e atividades", () => {
    expect(source).toContain('.limit(20)')
    expect(source.match(/\.limit\(5\)/g)).toHaveLength(2)
  })

  it("isola o cache por jardim e dia civil", () => {
    expect(todayCareKeys.dashboard("garden-a", "2026-11-19")).not.toEqual(todayCareKeys.dashboard("garden-b", "2026-11-19"))
    expect(todayCareKeys.dashboard("garden-a", "2026-11-19")).not.toEqual(todayCareKeys.dashboard("garden-a", "2026-11-20"))
  })

  it("usa signed URLs em vez de URLs públicas", () => {
    expect(source).toContain("signPlantPhotos")
    expect(source).not.toContain("getPublicUrl")
  })
})
