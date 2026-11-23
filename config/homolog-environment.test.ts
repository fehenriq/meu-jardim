import { describe, expect, it } from "vitest"
import { parseLocalEnv, validateHomologEnvironment } from "./homolog-environment"

const authorizedUrl = "https://gmbwavdzfljvfdvnroiz.supabase.co"

describe("homolog environment", () => {
  it("reads the two explicit variables from the mode-specific file", () => {
    expect(parseLocalEnv(`VITE_SUPABASE_URL=${authorizedUrl}\nVITE_SUPABASE_ANON_KEY='public-anon-key'`)).toEqual({ VITE_SUPABASE_URL: authorizedUrl, VITE_SUPABASE_ANON_KEY: "public-anon-key" })
  })
  it("fails when a required variable is absent", () => {
    expect(() => validateHomologEnvironment({ VITE_SUPABASE_URL: authorizedUrl })).toThrow("VITE_SUPABASE_ANON_KEY")
  })
  it("rejects a different Supabase project", () => {
    expect(() => validateHomologEnvironment({ VITE_SUPABASE_URL: "https://production-project.supabase.co", VITE_SUPABASE_ANON_KEY: "public-anon-key" })).toThrow("gmbwavdzfljvfdvnroiz")
  })
  it("accepts the authorized HTTPS project URL", () => {
    expect(validateHomologEnvironment({ VITE_SUPABASE_URL: authorizedUrl, VITE_SUPABASE_ANON_KEY: "public-anon-key" })).toEqual({ url: authorizedUrl, anonKey: "public-anon-key" })
  })
})
