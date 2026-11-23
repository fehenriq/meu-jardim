export const INVITE_TOKEN_KEY = "meu-jardim:pending-invite"
export function invitationLink(token: string) { return `${window.location.origin}/invite#token=${encodeURIComponent(token)}` }
export function captureInviteToken() {
  const url = new URL(window.location.href)
  const fragment = new URLSearchParams(url.hash.slice(1))
  const fragmentToken = fragment.get("token")
  const legacyToken = url.searchParams.get("token")
  const incoming = fragmentToken || legacyToken
  url.searchParams.delete("token")
  if (fragmentToken !== null) {
    fragment.delete("token")
    const cleanFragment = fragment.toString()
    url.hash = cleanFragment ? `#${cleanFragment}` : ""
  }
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`)
  if (incoming) sessionStorage.setItem(INVITE_TOKEN_KEY, incoming)
  return incoming ?? sessionStorage.getItem(INVITE_TOKEN_KEY) ?? ""
}
export function inviteStatus(invite: { accepted_at: string | null; revoked_at: string | null; expires_at: string }, now = Date.now()) { if (invite.accepted_at) return "Utilizado"; if (invite.revoked_at) return "Revogado"; if (new Date(invite.expires_at).getTime() <= now) return "Expirado"; return "Pendente" }
