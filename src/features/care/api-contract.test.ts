import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const source = readFileSync(resolve(process.cwd(), "src/features/care/api.ts"), "utf8")

describe("contrato de acesso a cuidados", () => {
  it("filtra rotinas e histórico por jardim e planta", () => {
    expect(source.match(/\.eq\("garden_id", gardenId\)\.eq\("plant_id", plantId\)/g)).toHaveLength(3)
  })

  it("mantém eventos imutáveis no cliente", () => {
    expect(source).not.toMatch(/from\("care_events"\)\.update/)
    expect(source).not.toMatch(/from\("care_events"\)\.delete/)
    expect(source).not.toMatch(/from\("care_events"\)\.insert/)
    expect(source).toContain('supabase.rpc("record_care_action"')
  })
})
