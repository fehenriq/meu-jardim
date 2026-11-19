import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/202611200003_garden_member_management.sql"), "utf8")
describe("contrato da migration 05C", () => {
  it("lista somente membros do jardim autorizado sem e-mail", () => {
    expect(sql).toMatch(/list_garden_members\(target_garden_id uuid\)/i)
    expect(sql).toMatch(/viewer\.user_id = auth\.uid\(\)/i)
    expect(sql).not.toMatch(/returns table[^;]*email/is)
  })
  it("serializa alterações e protege o último administrador", () => {
    expect(sql).toMatch(/from public\.gardens where id = target_garden_id for update/gi)
    expect(sql).toMatch(/admin_count <= 1[\s\S]*?garden must keep an administrator/gi)
  })
  it("mantém ações fechadas e papel controlado", () => {
    expect(sql).toMatch(/requested_action in \('demote', 'remove'\)/i)
    expect(sql).toMatch(/requested_action = 'demote'/i)
    expect(sql).not.toMatch(/grant (update|delete).*garden_members/i)
  })
  it("limita execução às sessões autenticadas", () => {
    expect(sql).toMatch(/revoke all on function public\.manage_garden_member\(uuid, uuid, text\) from public/i)
    expect(sql).toMatch(/grant execute on function public\.leave_garden\(uuid\) to authenticated/i)
  })
})
