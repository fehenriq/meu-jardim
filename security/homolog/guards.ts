import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { AUTHORIZED_PROJECT_REF } from "./environment.ts"

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const forbiddenEvidenceKeys = /(?:jwt|refresh|password|secret|key|token|signed.?url|authorization|raw|body|message)/i
const forbiddenEvidenceValues = /(?:Bearer\s+|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|sb_secret_|https:\/\/[^\s?]+\?token=)/i

export type AuthorizationRecord = {
  projectRef: string
  targetConfirmed: boolean
  readAuthorized: boolean
  mutationAuthorized: boolean
  authorizedBy: string
  windowStartsAt: string
  windowEndsAt: string
}

export type FixtureManifest = {
  projectRef: string
  runPrefix: string
  ids: Record<string, string>
  paths: Record<string, string>
  expectedActors: Record<string, { userId: string; gardenIds: string[] }>
}

function readJson<T>(root: string, filename: string): T {
  const path = resolve(root, filename)
  if (!existsSync(path)) throw new Error(`${filename.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_REQUIRED`)
  try { return JSON.parse(readFileSync(path, "utf8")) as T } catch { throw new Error(`${filename.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_INVALID`) }
}

export function loadAuthorization(root: string, mutation: boolean, now = new Date()) {
  const record = readJson<AuthorizationRecord>(root, ".security/homolog-authorization.local.json")
  if (record.projectRef !== AUTHORIZED_PROJECT_REF || !record.targetConfirmed || !record.readAuthorized || !record.authorizedBy.trim()) throw new Error("REMOTE_AUTHORIZATION_INCOMPLETE")
  if (mutation && !record.mutationAuthorized) throw new Error("MUTATION_AUTHORIZATION_REQUIRED")
  const start = Date.parse(record.windowStartsAt)
  const end = Date.parse(record.windowEndsAt)
  if (!Number.isFinite(start) || !Number.isFinite(end) || now.getTime() < start || now.getTime() > end) throw new Error("EXECUTION_WINDOW_CLOSED")
  return record
}

export function validateFixtureManifest(manifest: FixtureManifest) {
  if (manifest.projectRef !== AUTHORIZED_PROJECT_REF) throw new Error("FIXTURE_TARGET_MISMATCH")
  if (!/^MJ06A2-[A-Z0-9-]+$/.test(manifest.runPrefix)) throw new Error("FIXTURE_PREFIX_INVALID")
  for (const [name, id] of Object.entries(manifest.ids)) {
    if (!uuidPattern.test(id)) throw new Error(`FIXTURE_UUID_INVALID:${name}`)
  }
  for (const [name, path] of Object.entries(manifest.paths)) {
    if (path.startsWith("/") || path.includes("..") || !path.includes("/")) throw new Error(`FIXTURE_PATH_INVALID:${name}`)
  }
  for (const [actor, expected] of Object.entries(manifest.expectedActors)) {
    if (!uuidPattern.test(expected.userId) || expected.gardenIds.some((id) => !uuidPattern.test(id))) throw new Error(`FIXTURE_ACTOR_INVALID:${actor}`)
  }
  return manifest
}

export function loadFixtureManifest(root: string) {
  return validateFixtureManifest(readJson<FixtureManifest>(root, ".security/homolog-fixtures.local.json"))
}

export function assertIdentity(manifest: FixtureManifest, actor: string, actualUserId: string, memberships: string[]) {
  const expected = manifest.expectedActors[actor]
  if (!expected || expected.userId !== actualUserId) throw new Error("ACTOR_IDENTITY_MISMATCH")
  if (expected.gardenIds.length !== memberships.length || expected.gardenIds.some((id) => !memberships.includes(id))) throw new Error("ACTOR_MEMBERSHIP_MISMATCH")
}

export function assertAllowedId(manifest: FixtureManifest, id: string) {
  if (!Object.values(manifest.ids).includes(id)) throw new Error("FIXTURE_OUTSIDE_ALLOWLIST")
}

export function assertAllowedPath(manifest: FixtureManifest, path: string, gardenId?: string, plantId?: string) {
  if (!Object.values(manifest.paths).includes(path)) throw new Error("PATH_OUTSIDE_ALLOWLIST")
  const segments = path.split("/")
  if (gardenId && segments[0] !== gardenId) throw new Error("CROSSED_GARDEN_PATH")
  if (plantId && segments[1] !== plantId) throw new Error("CROSSED_PLANT_PATH")
}

export function sanitizeEvidence(input: Record<string, unknown>) {
  const safe: Record<string, boolean | number | string | null> = {}
  for (const [key, value] of Object.entries(input)) {
    if (forbiddenEvidenceKeys.test(key)) continue
    if (!["boolean", "number", "string"].includes(typeof value) && value !== null) continue
    if (typeof value === "string" && forbiddenEvidenceValues.test(value)) continue
    safe[key] = value as boolean | number | string | null
  }
  return safe
}
