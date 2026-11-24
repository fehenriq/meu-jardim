import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/202611230001_harden_application_privileges.sql"),
  "utf8",
)
const verification = readFileSync(
  resolve(process.cwd(), "docs/audits/06A2-grants-post-migration-check.sql"),
  "utf8",
)

const businessFunctions = [
  "ensure_profile()",
  "is_garden_member(uuid)",
  "is_garden_admin(uuid)",
  "create_garden(text, text)",
  "can_access_plant_photo(text)",
  "record_care_action(uuid, uuid, text, uuid, timestamptz, text, integer)",
  "list_garden_authors(uuid)",
  "create_garden_invite(uuid)",
  "inspect_garden_invite(text)",
  "accept_garden_invite(text)",
  "revoke_garden_invite(uuid)",
  "list_garden_members(uuid)",
  "manage_garden_member(uuid, uuid, text)",
  "leave_garden(uuid)",
]

const auxiliaryFunctions = [
  "set_updated_at()",
  "handle_new_user()",
  "prevent_last_garden_admin()",
  "prepare_plant_write()",
  "prepare_care_schedule_write()",
  "prepare_growth_entry_write()",
  "prepare_plant_photo_write()",
  "validate_garden_timezone()",
]

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

describe("contrato estático da migration 06A.2.6A", () => {
  it("reconstrói grants de tabela e mantém token_hash inacessível", () => {
    expect(migration).toMatch(/revoke all privileges on table[\s\S]*?from public, anon, authenticated;/i)
    expect(migration).toMatch(/grant update \(display_name, avatar_path\)[\s\S]*?public\.profiles/i)
    expect(migration).toMatch(/grant update \(name, timezone\)[\s\S]*?public\.gardens/i)
    expect(migration).toMatch(/grant select \([\s\S]*?\) on table public\.garden_invites to authenticated;/i)
    const inviteGrant = migration.match(/grant select \(([\s\S]*?)\) on table public\.garden_invites/i)?.[1]
    expect(inviteGrant).toBeDefined()
    expect(inviteGrant).not.toMatch(/token_hash/i)
    expect(migration).not.toMatch(/grant (insert|update|delete)[^;]*public\.garden_members/i)
    expect(migration).not.toMatch(/grant (insert|update|delete)[^;]*public\.care_events/i)
  })

  it("fecha as 22 ACLs e reabre somente as 14 RPCs previstas", () => {
    for (const signature of [...businessFunctions, ...auxiliaryFunctions]) {
      expect(migration).toMatch(
        new RegExp(`revoke all privileges on function public\\.${escapeRegExp(signature)} from public, anon, authenticated`, "i"),
      )
    }
    for (const signature of businessFunctions) {
      expect(migration).toMatch(
        new RegExp(`grant execute on function public\\.${escapeRegExp(signature)} to`, "i"),
      )
    }
    for (const signature of auxiliaryFunctions) {
      expect(migration).not.toMatch(
        new RegExp(`grant execute on function public\\.${escapeRegExp(signature)}`, "i"),
      )
    }
    expect(migration).toMatch(/grant execute on function public\.inspect_garden_invite\(text\) to anon, authenticated/i)
    expect(migration).not.toMatch(/grant execute on function public\.(?!inspect_garden_invite)[^;]+ to anon/i)
  })

  it("endurece somente defaults de postgres no schema public", () => {
    expect(migration).toMatch(/alter default privileges for role postgres in schema public[\s\S]*?on tables/i)
    expect(migration).toMatch(/alter default privileges for role postgres in schema public[\s\S]*?on sequences/i)
    expect(migration).toMatch(/alter default privileges for role postgres in schema public[\s\S]*?on functions from anon, authenticated/i)
    expect(migration).not.toMatch(/alter default privileges for role supabase_admin/i)
    expect(migration).not.toMatch(/alter default privileges for role postgres\s+revoke execute on functions from public/i)
  })

  it("fornece verificações positivas e negativas sem tratar PUBLIC como role", () => {
    expect(verification).toMatch(/has_table_privilege\('anon'/i)
    expect(verification).toMatch(/not has_table_privilege\([\s\S]*?'authenticated'/i)
    expect(verification).toMatch(/has_column_privilege\('authenticated'/i)
    expect(verification).toMatch(/has_function_privilege\('anon'/i)
    expect(verification).toMatch(/has_function_privilege\('authenticated'/i)
    expect(verification).toMatch(/a\.grantee = 0/i)
    expect(verification).not.toMatch(/has_function_privilege\('PUBLIC'/i)
  })
})
