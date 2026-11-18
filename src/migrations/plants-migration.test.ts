import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/202611180001_plants_and_private_photos.sql"),
  "utf8",
)

describe("contrato estático da migration de plantas", () => {
  it("cria plants incrementalmente com RLS e sem policy de delete", () => {
    expect(migration).toMatch(/create table public\.plants/i)
    expect(migration).toMatch(/alter table public\.plants enable row level security/i)
    expect(migration).toMatch(/for select to authenticated/i)
    expect(migration).toMatch(/for insert to authenticated/i)
    expect(migration).toMatch(/for update to authenticated/i)
    expect(migration).not.toMatch(/on public\.plants for delete/i)
  })

  it("reutiliza membership real e protege os campos imutáveis", () => {
    expect(migration).toMatch(/public\.is_garden_member\(garden_id\)/i)
    expect(migration).toMatch(/new\.garden_id is distinct from old\.garden_id/i)
    expect(migration).toMatch(/new\.created_by is distinct from old\.created_by/i)
    expect(migration).toMatch(/new\.created_by := auth\.uid\(\)/i)
  })

  it("limita privilégios do cliente às colunas permitidas", () => {
    expect(migration).toMatch(/revoke all on table public\.plants from authenticated/i)
    expect(migration).toMatch(/grant insert \([\s\S]*?\) on table public\.plants to authenticated/i)
    expect(migration).toMatch(/grant update \([\s\S]*?\) on table public\.plants to authenticated/i)
    expect(migration).not.toMatch(/grant delete on table public\.plants/i)
  })

  it("cria bucket privado e valida path contra planta e membership reais", () => {
    expect(migration).toMatch(/'plant-photos',[\s\S]*?false,[\s\S]*?5242880/i)
    expect(migration).toMatch(/public\.can_access_plant_photo\(name\)/i)
    expect(migration).toMatch(/join public\.garden_members gm/i)
    expect(migration).toMatch(/p\.id = path_plant_id/i)
    expect(migration).toMatch(/p\.garden_id = path_garden_id/i)
    expect(migration).not.toMatch(/on storage\.objects for delete/i)
  })

  it("mantém acquired_at como date e controla enumerações", () => {
    expect(migration).toMatch(/acquired_at date/i)
    expect(migration).toContain("'active', 'recovering', 'archived'")
    expect(migration).toContain("'seed', 'seedling', 'purchased', 'other'")
    expect(migration).toContain("'low_light', 'indirect_light', 'partial_sun', 'full_sun'")
  })
})
