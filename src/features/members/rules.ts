import type { GardenMember, MemberAction } from "./types"

export function availableMemberActions(viewerId: string, viewerRole: GardenMember["role"], member: GardenMember): MemberAction[] {
  if (viewerRole !== "admin" || viewerId === member.user_id) return []
  return member.role === "admin" ? ["demote", "remove"] : ["promote", "remove"]
}

export function memberActionLabel(action: MemberAction) { return action === "promote" ? "Promover a administrador" : action === "demote" ? "Rebaixar para membro" : "Remover do jardim" }
