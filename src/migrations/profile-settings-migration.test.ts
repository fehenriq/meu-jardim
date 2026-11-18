import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/202611200001_profile_and_garden_settings.sql"), "utf8")

describe("contrato da migration 05A", () => {
  it("expõe somente autores do jardim do solicitante", () => {
    expect(sql).toMatch(/list_garden_authors\(target_garden_id uuid\)/i)
    expect(sql).toMatch(/viewer\.user_id = auth\.uid\(\)/i)
    expect(sql).toMatch(/returns table \(user_id uuid, display_name text, avatar_path text\)/i)
    expect(sql).not.toMatch(/returns table[^;]*email/is)
  })
  it("mantém avatares privados e sem delete", () => {
    expect(sql).toMatch(/'avatars', 'avatars', false, 5242880/i)
    expect(sql).toMatch(/avatars_insert_owner/i)
    expect(sql).not.toMatch(/avatars_delete|for delete/i)
  })
  it("valida timezone no banco e restringe execução", () => {
    expect(sql).toMatch(/pg_catalog\.pg_timezone_names/i)
    expect(sql).toMatch(/revoke all on function public\.list_garden_authors\(uuid\) from public/i)
  })
})
