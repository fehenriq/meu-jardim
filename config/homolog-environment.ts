import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

const HOMOLOG_PROJECT_ID = "gmbwavdzfljvfdvnroiz"
const REQUIRED_KEYS = ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"] as const
type HomologEnvironment = { url: string; anonKey: string }

function parseEnvValue(value: string) {
  const trimmed = value.trim()
  const quote = trimmed[0]
  if ((quote === '"' || quote === "'") && trimmed[trimmed.length - 1] === quote) return trimmed.slice(1, -1)
  return trimmed
}

export function parseLocalEnv(source: string) {
  const values: Record<string, string> = {}
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (match) values[match[1]] = parseEnvValue(match[2])
  }
  return values
}

export function validateHomologEnvironment(values: Record<string, string>): HomologEnvironment {
  const missing = REQUIRED_KEYS.filter((key) => !values[key]?.trim())
  if (missing.length > 0) throw new Error(`Modo homolog exige ${missing.join(" e ")} em .env.homolog.local.`)

  const url = values.VITE_SUPABASE_URL.trim()
  const anonKey = values.VITE_SUPABASE_ANON_KEY.trim()
  let parsedUrl: URL
  try { parsedUrl = new URL(url) } catch { throw new Error("VITE_SUPABASE_URL de homologacao nao e uma URL valida.") }

  const expectedHostname = `${HOMOLOG_PROJECT_ID}.supabase.co`
  if (parsedUrl.protocol !== "https:" || parsedUrl.hostname !== expectedHostname || parsedUrl.username || parsedUrl.password || parsedUrl.port) {
    throw new Error(`Modo homolog aceita somente a URL HTTPS do Project ID autorizado ${HOMOLOG_PROJECT_ID}.`)
  }
  return { url, anonKey }
}

export function readHomologEnvironment(rootDirectory: string): HomologEnvironment {
  const filePath = resolve(rootDirectory, ".env.homolog.local")
  if (!existsSync(filePath)) throw new Error("Modo homolog exige o arquivo .env.homolog.local.")
  return validateHomologEnvironment(parseLocalEnv(readFileSync(filePath, "utf8")))
}
