import type { GardenAuthor } from "./types"

export function resolveAuthorName(authors: GardenAuthor[], userId: string, currentUserId?: string, currentUserName?: string) {
  if (userId === currentUserId) return currentUserName?.trim() || "Você"
  return authors.find((author) => author.user_id === userId)?.display_name.trim() || "Membro do jardim"
}
