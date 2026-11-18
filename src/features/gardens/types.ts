export type Garden = { id: string; name: string; timezone: string; created_by: string; created_at: string }
export type Membership = { role: "admin" | "member"; garden: Garden }
export type Profile = { id: string; display_name: string; avatar_path: string | null }
export type GardenAuthor = { user_id: string; display_name: string; avatar_path: string | null }
