export const INVITE_TOKEN_KEY = "meu-jardim:pending-invite"
export function invitationLink(token: string) { return `${window.location.origin}/invite?token=${encodeURIComponent(token)}` }
export function inviteStatus(invite: { accepted_at: string | null; revoked_at: string | null; expires_at: string }, now = Date.now()) { if (invite.accepted_at) return "Utilizado"; if (invite.revoked_at) return "Revogado"; if (new Date(invite.expires_at).getTime() <= now) return "Expirado"; return "Pendente" }
