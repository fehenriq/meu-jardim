import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { HEIGHT_BATCH_SIZE, PHOTO_PAGE_SIZE } from "./insights-api"
import { insightKeys } from "./insights-hooks"

const api = readFileSync(resolve(process.cwd(), "src/features/growth/insights-api.ts"), "utf8")
const component = readFileSync(resolve(process.cwd(), "src/features/growth/growth-insights.tsx"), "utf8")
const section = readFileSync(resolve(process.cwd(), "src/features/growth/growth-section.tsx"), "utf8")
const hooks = readFileSync(resolve(process.cwd(), "src/features/growth/hooks.ts"), "utf8")

describe("contratos da Entrega 04C", () => {
  it("busca todas as alturas em lotes limitados e ordenação estável", () => {
    expect(HEIGHT_BATCH_SIZE).toBe(200)
    expect(api).toMatch(/while \(true\)[\s\S]*?range\(from, from \+ HEIGHT_BATCH_SIZE - 1\)/i)
    expect(api).toMatch(/\.eq\("garden_id", gardenId\)\.eq\("plant_id", plantId\)\.not\("height_cm", "is", null\)/i)
    expect(api).toMatch(/order\("observed_at", \{ ascending: true \}\)\.order\("id", \{ ascending: true \}\)/i)
  })

  it("pagina fotos independentemente da timeline e assina somente a página", () => {
    expect(PHOTO_PAGE_SIZE).toBe(24)
    expect(api).toMatch(/from\("plant_photos"\)[\s\S]*?\.range\(from, from \+ PHOTO_PAGE_SIZE\)/i)
    expect(api).toMatch(/createSignedUrls\(paths, 10 \* 60\)/i)
    expect(component).toMatch(/Carregar fotografias antigas/i)
    expect(api).not.toMatch(/getPublicUrl|service_role/i)
  })

  it("isola caches por jardim e planta e invalida todas as análises após criação", () => {
    expect(insightKeys.heights("garden-a", "plant-a")).not.toEqual(insightKeys.heights("garden-b", "plant-a"))
    expect(insightKeys.photos("garden-a", "plant-a")).not.toEqual(insightKeys.photos("garden-a", "plant-b"))
    expect(hooks).toMatch(/invalidateQueries\(\{ queryKey: \["growth", gardenId, plantId\] \}\)/i)
  })

  it("carrega análises sob demanda e mantém modo somente leitura arquivado", () => {
    expect(section).toMatch(/lazy\(\(\) => import\("\.\/growth-insights"\)/i)
    expect(section).toMatch(/showInsights && <Suspense/i)
    expect(component).toMatch(/archived && <p/i)
    expect(component).not.toMatch(/upload|insert|update|delete/i)
  })

  it("oferece gráfico acessível, tabela e estados de foto indisponível", () => {
    expect(component).toMatch(/role="img" aria-labelledby="height-chart-title height-chart-description"/i)
    expect(component).toMatch(/Lista acessível das medições de altura/i)
    expect(component).toMatch(/aria-pressed=/i)
    expect(component).toMatch(/Foto indisponível|Fotografia indisponível/i)
    expect(component).toMatch(/selected\.length < 2/i)
  })
})
