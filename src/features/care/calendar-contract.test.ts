import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { calendarKeys } from "./calendar-hooks"

const api = readFileSync(resolve(process.cwd(), "src/features/care/calendar-api.ts"), "utf8")
const page = readFileSync(resolve(process.cwd(), "src/features/care/calendar-page.tsx"), "utf8")
const app = readFileSync(resolve(process.cwd(), "src/app.tsx"), "utf8")

describe("contrato do calendário", () => {
  it("consulta intervalos limitados e escopados pelo jardim", () => {
    expect(api.match(/\.eq\("garden_id", gardenId\)/g)).toHaveLength(2)
    expect(api).toContain('.gte("next_due_date", start)')
    expect(api).toContain('.lte("next_due_date", end)')
    expect(api).toContain('.gte("event_at", bounds.from)')
    expect(api.match(/\.limit\(200\)/g)).toHaveLength(2)
  })

  it("exclui plantas arquivadas somente dos previstos e preserva eventos", () => {
    expect(api.match(/neq\("plant.status", "archived"\)/g)).toHaveLength(1)
    expect(api).toContain('from("care_events")')
  })

  it("isola cache por jardim e intervalo", () => {
    expect(calendarKeys.range("garden-a", "2026-11-01", "2026-11-30")).not.toEqual(calendarKeys.range("garden-b", "2026-11-01", "2026-11-30"))
  })

  it("reutiliza RPC e invalida calendário, Hoje e planta", () => {
    expect(page).toContain("recordCareAction(intent)")
    expect(page).toContain("invalidateCareCalendar")
    expect(page).toContain("invalidateTodayCare")
    expect(page).toContain("invalidatePlantCare")
  })

  it("carrega a rota Calendário de forma assíncrona", () => {
    expect(app).toContain('lazy(() => import("@/features/care/calendar-page")')
    expect(app).toContain("<Suspense fallback=")
  })
})
