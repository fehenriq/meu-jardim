import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { GROWTH_PAGE_SIZE } from "./api"
import { growthKeys } from "./hooks"

const api = readFileSync(resolve(process.cwd(), "src/features/growth/api.ts"), "utf8")
const section = readFileSync(resolve(process.cwd(), "src/features/growth/growth-section.tsx"), "utf8")

describe("contratos da linha do tempo de crescimento", () => {
  it("pagina no servidor com ordenação estável por data e id", () => {
    expect(GROWTH_PAGE_SIZE).toBe(8)
    expect(api).toMatch(/order\("observed_at", \{ ascending: false \}\)\.order\("id", \{ ascending: false \}\)\.range/i)
    expect(api).toMatch(/rows\.slice\(0, GROWTH_PAGE_SIZE\)/i)
  })

  it("isola consultas por jardim e planta", () => {
    expect(growthKeys.timeline("garden-a", "plant-a")).not.toEqual(growthKeys.timeline("garden-b", "plant-a"))
    expect(growthKeys.timeline("garden-a", "plant-a")).not.toEqual(growthKeys.timeline("garden-a", "plant-b"))
    expect(api).toMatch(/\.eq\("garden_id", gardenId\)\.eq\("plant_id", plantId\)/i)
  })

  it("usa URLs assinadas renovadas sem URL pública", () => {
    expect(api).toMatch(/createSignedUrls\(paths, 10 \* 60\)/i)
    expect(section).toMatch(/refetchInterval: 9 \* 60 \* 1000|useGrowthTimeline/i)
    expect(api).not.toMatch(/getPublicUrl|service_role/i)
  })

  it("bloqueia criação arquivada e preserva histórico", () => {
    expect(section).toMatch(/archived && <Alert>/i)
    expect(section).toMatch(/!archived && !formOpen/i)
    expect(section).toMatch(/items\.map/i)
  })

  it("oferece ampliação acessível e recuperação parcial", () => {
    expect(section).toMatch(/role="dialog" aria-modal="true"/i)
    expect(section).toMatch(/event\.key === "Escape"/i)
    expect(section).toMatch(/ArrowLeft|ArrowRight/i)
    expect(section).toMatch(/Retomar fotografias pendentes/i)
  })
})
