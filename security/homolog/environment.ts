import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { parseLocalEnv, validateHomologEnvironment } from "../../config/homolog-environment.ts"

export const AUTHORIZED_PROJECT_REF = "gmbwavdzfljvfdvnroiz"
export const AUTHORIZED_HOST = `${AUTHORIZED_PROJECT_REF}.supabase.co`
export const REMOTE_TRANSPORT_ENABLED = false

function decodeJwtPayload(key: string): Record<string, unknown> | null {
  const parts = key.split(".")
  if (parts.length !== 3) return null
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as Record<string, unknown>
  } catch {
    return null
  }
}

export function validatePublicKey(key: string) {
  const normalized = key.trim()
  if (!normalized) throw new Error("PUBLIC_KEY_MISSING")
  if (normalized.startsWith("sb_secret_") || normalized.startsWith("sb_service_")) throw new Error("PRIVILEGED_KEY_FORBIDDEN")
  if (normalized.startsWith("sb_publishable_")) return
  const claims = decodeJwtPayload(normalized)
  if (claims?.role !== "anon") throw new Error("PUBLIC_ANON_KEY_REQUIRED")
}

export function loadSecurityEnvironment(rootDirectory: string) {
  const path = resolve(rootDirectory, ".env.homolog.local")
  if (!existsSync(path)) throw new Error("HOMOLOG_ENV_FILE_REQUIRED")
  const parsed = parseLocalEnv(readFileSync(path, "utf8"))
  const environment = validateHomologEnvironment(parsed)
  validatePublicKey(environment.anonKey)
  return { ...environment, projectRef: AUTHORIZED_PROJECT_REF, hostname: AUTHORIZED_HOST }
}

export function validateRequestDestination(input: string) {
  let url: URL
  try { url = new URL(input) } catch { throw new Error("REQUEST_URL_INVALID") }
  if (url.protocol !== "https:" || url.hostname !== AUTHORIZED_HOST || url.username || url.password || url.port) {
    throw new Error("REQUEST_DESTINATION_FORBIDDEN")
  }
  return url
}

export function validateRedirect(location: string | null) {
  if (!location) return
  validateRequestDestination(location)
}
