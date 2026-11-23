import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Brand } from "@/components/brand"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useAuth } from "@/features/auth/auth-context"
import { preferGarden, useGarden } from "@/features/gardens/garden-context"
import { acceptInvite, inspectInvite } from "./api"
import { captureInviteToken, INVITE_TOKEN_KEY } from "./rules"
import type { InviteStatus } from "./types"

export function InvitePage() {
  const { user, loading } = useAuth()
  const garden = useGarden()
  const navigate = useNavigate()
  const [token] = useState(captureInviteToken)
  const [status, setStatus] = useState<InviteStatus | "loading" | "error" | "missing">(() => token ? "loading" : "missing")
  const [gardenName, setGardenName] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")

  useEffect(() => { if (!token) return; let active = true; inspectInvite(token).then((result) => { if (active) { setStatus(result.invite_status); setGardenName(result.garden_name); if (result.invite_status !== "valid") sessionStorage.removeItem(INVITE_TOKEN_KEY) } }).catch(() => { if (active) setStatus("error") }); return () => { active = false } }, [token])

  async function accept() { setBusy(true); setMessage(""); try { const result = await acceptInvite(token); if (result.accept_status === "invalid" || !result.garden_id) { sessionStorage.removeItem(INVITE_TOKEN_KEY); setStatus("invalid"); return } sessionStorage.removeItem(INVITE_TOKEN_KEY); preferGarden(result.garden_id); await garden.refresh(); garden.selectGarden(result.garden_id); setMessage(result.accept_status === "already_member" ? "Você já faz parte deste jardim." : "Convite aceito. Bem-vindo ao jardim!"); setTimeout(() => navigate("/app/today", { replace: true }), 600) } catch { setMessage("Não foi possível aceitar agora. Tente novamente sem recarregar o link.") } finally { setBusy(false) } }

  const neutral = status === "invalid" || status === "expired" || status === "revoked" || status === "used"
  return <main className="flex min-h-screen items-center justify-center px-4 py-10"><div className="w-full max-w-[520px]"><div className="mb-7 flex justify-center"><Brand /></div><Card className="p-7 sm:p-9"><h1 className="font-serif text-3xl font-bold">Convite para um jardim</h1>{status === "loading" && <p role="status" className="mt-5 text-muted-foreground">Verificando convite…</p>}{status === "error" && <Alert className="mt-5">Não foi possível verificar o convite. Tente novamente.</Alert>}{status === "missing" && <Alert className="mt-5">O convite não está disponível nesta aba. Abra novamente o link original do convite neste navegador para continuar.</Alert>}{neutral && <Alert className="mt-5">Este convite não está disponível. Ele pode ter expirado, sido revogado ou já utilizado.</Alert>}{status === "valid" && <><p className="mt-4 text-muted-foreground">Você foi convidado para cuidar de <strong className="text-foreground">{gardenName}</strong>.</p>{loading ? <p role="status" className="mt-5">Verificando sua sessão…</p> : user ? <Button className="mt-6 w-full" onClick={accept} disabled={busy}>{busy ? "Aceitando…" : "Aceitar convite"}</Button> : <div className="mt-6 grid gap-3 sm:grid-cols-2"><Button asChild><Link to="/login">Entrar para aceitar</Link></Button><Button asChild variant="outline"><Link to="/register">Criar conta</Link></Button></div>}</>}{message && <Alert className="mt-5">{message}</Alert>}</Card></div></main>
}
