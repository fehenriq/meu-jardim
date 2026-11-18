import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/features/auth/auth-context"
import type { Garden, Membership, Profile } from "./types"

const STORAGE_KEY = "meu-jardim:preferred-garden-id"
type GardenValue = { memberships: Membership[]; activeGarden: Garden | null; activeRole: Membership["role"] | null; profile: Profile | null; loading: boolean; error: string | null; selectGarden: (id: string) => void; refresh: () => Promise<void> }
const GardenContext = createContext<GardenValue | null>(null)

async function loadBootstrap(userId: string) {
  const { error: profileProvisionError } = await supabase.rpc("ensure_profile")
  if (profileProvisionError) throw profileProvisionError
  const [profileResult, membershipsResult] = await Promise.all([
    supabase.from("profiles").select("id, display_name, avatar_path").eq("id", userId).maybeSingle(),
    supabase.from("garden_members").select("role, garden:gardens!inner(id, name, timezone, created_by, created_at)").eq("user_id", userId),
  ])
  if (profileResult.error) throw profileResult.error
  if (membershipsResult.error) throw membershipsResult.error
  return { profile: profileResult.data as Profile | null, memberships: (membershipsResult.data || []) as unknown as Membership[] }
}

export function GardenProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth(); const [preferredId, setPreferredId] = useState(() => localStorage.getItem(STORAGE_KEY))
  const query = useQuery({ queryKey: ["bootstrap", user?.id], queryFn: () => loadBootstrap(user!.id), enabled: Boolean(user), retry: 1 })
  const memberships = query.data?.memberships ?? []
  const selected = memberships.find((item) => item.garden.id === preferredId) ?? memberships[0] ?? null
  useEffect(() => { if (selected && selected.garden.id !== preferredId) { localStorage.setItem(STORAGE_KEY, selected.garden.id) } }, [selected, preferredId])
  function selectGarden(id: string) { if (memberships.some((item) => item.garden.id === id)) { localStorage.setItem(STORAGE_KEY, id); setPreferredId(id) } }
  const value: GardenValue = { memberships, activeGarden: selected?.garden ?? null, activeRole: selected?.role ?? null, profile: query.data?.profile ?? null, loading: query.isLoading, error: query.error ? "Não foi possível carregar seus jardins." : null, selectGarden, refresh: async () => { await query.refetch() } }
  return <GardenContext.Provider value={value}>{children}</GardenContext.Provider>
}

export function useGarden() { const value = useContext(GardenContext); if (!value) throw new Error("useGarden deve ser usado dentro de GardenProvider"); return value }
