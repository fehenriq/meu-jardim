// @vitest-environment node
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it, vi } from "vitest"
import { securityCases } from "./cases.ts"
import { loadSecurityEnvironment, REMOTE_TRANSPORT_ENABLED, validatePublicKey, validateRedirect, validateRequestDestination } from "./environment.ts"
import { assertAllowedId, assertAllowedPath, assertIdentity, loadAuthorization, sanitizeEvidence, validateFixtureManifest, type FixtureManifest } from "./guards.ts"
import { executeCases, selectCases } from "./runner.ts"
import { restrictedFetch } from "./request.ts"
import type { CaseAdapter, Observation, SecurityCase } from "./types.ts"

const uuid = (suffix: string) => `00000000-0000-4000-8000-${suffix.padStart(12, "0")}`
const manifest: FixtureManifest = {
  projectRef: "gmbwavdzfljvfdvnroiz",
  runPrefix: "MJ06A2-TEST-R1",
  ids: { A_GARDEN_ID: uuid("1"), A_PLANT_ID: uuid("2") },
  paths: { A_PHOTO_PATH: `${uuid("1")}/${uuid("2")}/${uuid("3")}.jpg` },
  expectedActors: { A: { userId: uuid("4"), gardenIds: [uuid("1")] } },
}

function tempRoot() { return mkdtempSync(join(tmpdir(), "mj-security-")) }
function adapter(observation: Partial<Observation> = {}): CaseAdapter {
  return { execute: vi.fn(async () => ({ attempted: true, positiveControlPassed: true, negativeExpectationPassed: true, integrityPassed: true, ...observation })) }
}
function testCase(overrides: Partial<SecurityCase> = {}): SecurityCase {
  return { id: "T-01", group: "test", actor: "A", mode: "automated", mutation: false, operation: "test", preconditions: [], positiveControl: "positive", negativeExpectation: "negative", integrityCheck: "integrity", dependencies: [], ...overrides }
}

describe("security homologation executor protections", () => {
  it("covers the exact 71 unique case IDs from the plan", () => {
    const expectedIds = "PL-01 PL-02 PL-03 PL-04 PL-05 PL-06 PL-07 PL-08 CA-01 CA-02 CA-03 CA-04 CA-05 CA-06 CA-07 CA-08 GR-01 GR-02 GR-03 GR-04 GR-05 GR-06 GR-07 GR-08 ST-01 ST-02 ST-03 ST-04 ST-05 ST-06 ST-07 ST-08 ST-09 ST-10 PF-01 PF-02 PF-03 PF-04 PF-05 PF-06 IN-01 IN-02 IN-03 IN-04 IN-05 IN-06 IN-07 IN-08 IN-09 MB-01 MB-02 MB-03 MB-04 MB-05 MB-06 MB-07 MB-08 RV-01 RV-02 RV-03 RV-04 RV-05 RV-06 RV-07 AN-01 AN-02 AN-03 AN-04 IT-01 IT-02 IT-03".split(" ")
    expect(securityCases).toHaveLength(71)
    expect(new Set(securityCases.map((item) => item.id)).size).toBe(71)
    expect(securityCases.map((item) => item.id)).toEqual(expectedIds)
  })

  it("keeps remote transport deliberately disabled", () => {
    expect(REMOTE_TRANSPORT_ENABLED).toBe(false)
  })

  it("loads only the dedicated file and rejects a production fallback target", () => {
    const root = tempRoot()
    writeFileSync(join(root, ".env.local"), "VITE_SUPABASE_URL=https://gmbwavdzfljvfdvnroiz.supabase.co\nVITE_SUPABASE_ANON_KEY=sb_publishable_prod")
    expect(() => loadSecurityEnvironment(root)).toThrow("HOMOLOG_ENV_FILE_REQUIRED")
    writeFileSync(join(root, ".env.homolog.local"), "VITE_SUPABASE_URL=https://production.supabase.co\nVITE_SUPABASE_ANON_KEY=sb_publishable_test")
    expect(() => loadSecurityEnvironment(root)).toThrow("gmbwavdzfljvfdvnroiz")
  })

  it("ignores process environment overrides", () => {
    const root = tempRoot()
    writeFileSync(join(root, ".env.homolog.local"), "VITE_SUPABASE_URL=https://gmbwavdzfljvfdvnroiz.supabase.co\nVITE_SUPABASE_ANON_KEY=sb_publishable_homolog")
    vi.stubEnv("VITE_SUPABASE_URL", "https://production.supabase.co")
    expect(loadSecurityEnvironment(root).hostname).toBe("gmbwavdzfljvfdvnroiz.supabase.co")
    vi.unstubAllEnvs()
  })

  it("rejects privileged keys without printing their value", () => {
    expect(() => validatePublicKey("sb_secret_do-not-log")).toThrow("PRIVILEGED_KEY_FORBIDDEN")
    expect(() => validatePublicKey("not-a-public-key")).toThrow("PUBLIC_ANON_KEY_REQUIRED")
  })

  it("rejects wrong request targets and cross-host redirects", () => {
    expect(() => validateRequestDestination("https://production.supabase.co/rest/v1/plants")).toThrow("REQUEST_DESTINATION_FORBIDDEN")
    expect(() => validateRedirect("https://example.test/redirect")).toThrow("REQUEST_DESTINATION_FORBIDDEN")
  })

  it("uses manual redirects and never follows a redirect", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 302, headers: { location: "https://gmbwavdzfljvfdvnroiz.supabase.co/rest/v1/other" } }))
    await expect(restrictedFetch("https://gmbwavdzfljvfdvnroiz.supabase.co/rest/v1/plants", {}, fetchMock)).rejects.toThrow("REDIRECT_NOT_FOLLOWED")
    expect(fetchMock).toHaveBeenCalledWith(expect.any(URL), expect.objectContaining({ redirect: "manual" }))
  })

  it("fails closed when authorization is absent", () => {
    expect(() => loadAuthorization(tempRoot(), false)).toThrow("REQUIRED")
  })

  it("rejects incorrect identity or memberships", () => {
    expect(() => assertIdentity(manifest, "A", uuid("9"), [uuid("1")])).toThrow("ACTOR_IDENTITY_MISMATCH")
    expect(() => assertIdentity(manifest, "A", uuid("4"), [])).toThrow("ACTOR_MEMBERSHIP_MISMATCH")
  })

  it("rejects fixture IDs outside the allowlist and crossed paths", () => {
    const validated = validateFixtureManifest(manifest)
    expect(() => assertAllowedId(validated, uuid("9"))).toThrow("FIXTURE_OUTSIDE_ALLOWLIST")
    expect(() => assertAllowedPath(validated, validated.paths.A_PHOTO_PATH, uuid("9"), uuid("2"))).toThrow("CROSSED_GARDEN_PATH")
  })

  it("requires dependencies for isolated case selection", () => {
    expect(() => selectCases(securityCases, { caseId: "PL-02" })).toThrow("DEPENDENCIES_REQUIRED")
  })

  it("removes secrets and raw errors from evidence", () => {
    expect(sanitizeEvidence({ status: 403, token: "secret", message: "raw", detail: "Bearer abc", row_count: 0 })).toEqual({ status: 403, row_count: 0 })
  })

  it("does not approve zero rows without a positive control", async () => {
    const [result] = await executeCases([testCase()], adapter({ rowCount: 0, positiveControlPassed: false }))
    expect(result.state).toBe("BLOCKED")
  })

  it("fails when the final integrity check fails", async () => {
    const [result] = await executeCases([testCase()], adapter({ integrityPassed: false }))
    expect(result.state).toBe("FAILED")
  })

  it("stops the affected group after unauthorized access", async () => {
    const mock = adapter()
    vi.mocked(mock.execute).mockResolvedValueOnce({ attempted: true, positiveControlPassed: true, negativeExpectationPassed: false, integrityPassed: false, crossTenantAccess: true })
    const results = await executeCases([testCase(), testCase({ id: "T-02" })], mock)
    expect(results.map((item) => item.state)).toEqual(["FAILED", "BLOCKED"])
    expect(mock.execute).toHaveBeenCalledTimes(1)
  })

  it("does not retry a timed-out mutation", async () => {
    const mock = adapter({ timedOut: true })
    const [result] = await executeCases([testCase({ mutation: true })], mock)
    expect(result.state).toBe("BLOCKED")
    expect(mock.execute).toHaveBeenCalledTimes(1)
  })

  it("cannot mark an unattempted or manual case approved", async () => {
    const results = await executeCases([testCase(), testCase({ id: "T-02", mode: "manual" })], adapter({ attempted: false }))
    expect(results.map((item) => item.state)).toEqual(["NOT_EXECUTED", "NOT_EXECUTED"])
  })

  it("performs no network operation during local validation", () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal("fetch", fetchSpy)
    selectCases(securityCases, { group: "plants" })
    expect(fetchSpy).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
