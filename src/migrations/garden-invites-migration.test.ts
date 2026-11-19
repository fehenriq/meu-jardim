import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/202611200002_garden_invites.sql"), "utf8")

describe("contrato da migration 05B", () => {
  it("persiste somente hash e fixa papel e expiração", () => {
    expect(sql).toMatch(/token_hash text not null unique/i)
    expect(sql).not.toMatch(/token_plain|plain_token text not null/i)
    expect(sql).toMatch(/check \(role = 'member'\)/i)
    expect(sql).toMatch(/interval '7 days'/i)
    expect(sql).toMatch(/gen_random_bytes\(32\)/i)
    expect(sql).toMatch(/digest\(plain_token, 'sha256'\)/i)
  })
  it("protege operações por admin e não concede escrita direta", () => {
    expect(sql).toMatch(/is_garden_admin\(target_garden_id\)/i)
    expect(sql).toMatch(/garden_invites_select_admin/i)
    expect(sql).not.toMatch(/grant (insert|update|delete)/i)
    expect(sql).toMatch(/security definer set search_path = ''/gi)
  })
  it("serializa aceite e deriva usuário jardim e papel", () => {
    expect(sql).toMatch(/where token_hash = [\s\S]*?for update/i)
    expect(sql).toMatch(/insert into public\.garden_members \(garden_id, user_id, role\) values \(target\.garden_id, uid, 'member'\)/i)
    expect(sql).toMatch(/target\.accepted_by = uid/i)
    expect(sql).toMatch(/target\.accepted_by = auth\.uid\(\)/i)
    expect(sql).toMatch(/already_member/i)
  })
  it("limita execução e metadados listáveis", () => {
    expect(sql).toMatch(/revoke all on function public\.accept_garden_invite\(text\) from public/i)
    expect(sql).toMatch(/grant select \(id, garden_id, role, expires_at, created_by, accepted_at, accepted_by, revoked_at, created_at\)/i)
  })
})
