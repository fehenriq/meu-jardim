import { createClient } from "@supabase/supabase-js"

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

export const isSupabaseConfigured = Boolean(url && anonKey)
export const supabase = createClient(url || "https://configuracao-ausente.invalid", anonKey || "configuracao-ausente", {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})
