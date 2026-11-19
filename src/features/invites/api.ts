import { supabase } from "@/lib/supabase"
import type { CreatedInvite, GardenInvite, InviteStatus } from "./types"

export async function createInvite(gardenId: string) { const { data, error } = await supabase.rpc("create_garden_invite", { target_garden_id: gardenId }).single(); if (error) throw error; return data as CreatedInvite }
export async function listInvites(gardenId: string) { const { data, error } = await supabase.from("garden_invites").select("id, garden_id, role, expires_at, created_at, accepted_at, revoked_at").eq("garden_id", gardenId).order("created_at", { ascending: false }); if (error) throw error; return (data ?? []) as GardenInvite[] }
export async function revokeInvite(inviteId: string) { const { error } = await supabase.rpc("revoke_garden_invite", { target_invite_id: inviteId }); if (error) throw error }
export async function inspectInvite(token: string) { const { data, error } = await supabase.rpc("inspect_garden_invite", { invite_token: token }).single(); if (error) throw error; return data as { invite_status: InviteStatus; garden_name: string | null } }
export async function acceptInvite(token: string) { const { data, error } = await supabase.rpc("accept_garden_invite", { invite_token: token }).single(); if (error) throw error; return data as { accept_status: "accepted" | "already_member" | "invalid"; garden_id: string | null } }
