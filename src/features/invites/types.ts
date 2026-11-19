export type InviteStatus = "valid" | "invalid" | "expired" | "revoked" | "used"
export type GardenInvite = { id: string; garden_id: string; role: "member"; expires_at: string; created_at: string; accepted_at: string | null; revoked_at: string | null }
export type CreatedInvite = { invite_id: string; invite_token: string; expires_at: string }
