import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/202611190002_growth_diary.sql"),
  "utf8",
)
const plantMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/202611180001_plants_and_private_photos.sql"),
  "utf8",
)

describe("contrato estático da migration do diário de crescimento", () => {
  it("cria registros e fotos com escopo composto e histórico preservado", () => {
    expect(migration).toMatch(/create table public\.growth_entries/i)
    expect(migration).toMatch(/create table public\.plant_photos/i)
    expect(migration).toMatch(/foreign key \(plant_id, garden_id\) references public\.plants\(id, garden_id\) on delete restrict/gi)
    expect(migration).toMatch(/foreign key \(growth_entry_id, garden_id, plant_id\) references public\.growth_entries\(id, garden_id, plant_id\) on delete restrict/i)
    expect(migration).not.toMatch(/on public\.(growth_entries|plant_photos) for delete/i)
  })

  it("valida medições e permite registro sem medição ou texto para fotos", () => {
    expect(migration).toMatch(/height_cm >= 0[\s\S]*?not in \('NaN', 'Infinity', '-Infinity'\)/i)
    expect(migration).toMatch(/leaf_count is null or leaf_count >= 0/i)
    expect(migration).toMatch(/notes is null or char_length\(notes\) <= 4000/i)
    expect(migration).not.toMatch(/height_cm is not null[\s\S]*?leaf_count is not null[\s\S]*?notes is not null/i)
  })

  it("deriva escopo e autoria e protege campos de vínculo", () => {
    expect(migration).toMatch(/new\.garden_id := resolved_garden_id/g)
    expect(migration).toMatch(/new\.created_by := auth\.uid\(\)/i)
    expect(migration).toMatch(/new\.uploaded_by := auth\.uid\(\)/i)
    expect(migration).toMatch(/new\.garden_id is distinct from old\.garden_id[\s\S]*?new\.plant_id is distinct from old\.plant_id/i)
    expect(migration).toMatch(/old\.growth_entry_id is not null and new\.growth_entry_id is distinct from old\.growth_entry_id/i)
  })

  it("bloqueia novos registros em plantas arquivadas sem ocultar o histórico", () => {
    expect(migration).toMatch(/plant_status = 'archived'[\s\S]*?cannot receive growth entries/i)
    expect(migration).toMatch(/plant_status = 'archived'[\s\S]*?cannot receive photos/i)
    expect(migration).toMatch(/for select to authenticated[\s\S]*?public\.is_garden_member\(garden_id\)/gi)
  })

  it("mantém RLS e grants mínimos sem delete", () => {
    expect(migration).toMatch(/alter table public\.growth_entries enable row level security/i)
    expect(migration).toMatch(/alter table public\.plant_photos enable row level security/i)
    expect(migration).toMatch(/grant insert \(plant_id, observed_at, height_cm, leaf_count, notes\)/i)
    expect(migration).toMatch(/grant update \(growth_entry_id, taken_at\)/i)
    expect(migration).not.toMatch(/grant delete/i)
  })

  it("reutiliza o bucket e o path privados sem alterar suas políticas", () => {
    expect(migration).toMatch(/path_parts\[1\] <> new\.garden_id::text/i)
    expect(migration).toMatch(/path_parts\[2\] <> new\.plant_id::text/i)
    expect(migration).not.toMatch(/storage\.buckets|on storage\.objects/i)
    expect(plantMigration).toMatch(/'plant-photos',[\s\S]*?false,[\s\S]*?5242880/i)
    expect(plantMigration).toContain("array['image/jpeg', 'image/png', 'image/webp']")
    expect(plantMigration).not.toMatch(/on storage\.objects for delete/i)
  })
})
