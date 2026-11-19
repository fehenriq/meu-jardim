export type GardenMember = { user_id: string; display_name: string; avatar_path: string | null; avatar_url: string | null; role: "admin" | "member"; joined_at: string }
export type MemberAction = "promote" | "demote" | "remove"
