import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Copy, Plus, Share2, UserPlus } from "lucide-react"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useGarden } from "@/features/gardens/garden-context"
import { createInvite, listInvites, revokeInvite } from "./api"
import { invitationLink, inviteStatus } from "./rules"

export function InvitesSection() {
  const { activeGarden, activeRole } = useGarden()
  const queryClient = useQueryClient()
  const gardenId = activeGarden?.id ?? ""
  const query = useQuery({ queryKey: ["garden-invites", gardenId], queryFn: () => listInvites(gardenId), enabled: Boolean(gardenId && activeRole === "admin") })
  const [link, setLink] = useState("")
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)
  const [revoking, setRevoking] = useState<string | null>(null)
  if (activeRole !== "admin") return null

  async function create() { setBusy(true); setMessage(""); try { const result = await createInvite(gardenId); setLink(invitationLink(result.invite_token)); await queryClient.invalidateQueries({ queryKey: ["garden-invites", gardenId] }) } catch { setMessage("Não foi possível criar o convite.") } finally { setBusy(false) } }
  async function revoke(id: string) { setBusy(true); setMessage(""); try { await revokeInvite(id); setRevoking(null); await queryClient.invalidateQueries({ queryKey: ["garden-invites", gardenId] }); setMessage("Convite revogado.") } catch { setMessage("Não foi possível revogar o convite.") } finally { setBusy(false) } }
  async function copy() { try { await navigator.clipboard.writeText(link); setMessage("Link copiado.") } catch { setMessage("Não foi possível copiar automaticamente. Selecione o link abaixo.") } }
  async function share() { if (!navigator.share) { await copy(); return } try { await navigator.share({ text: `Venha cuidar do nosso jardim: ${link}` }) } catch (error) { if (error instanceof DOMException && error.name === "AbortError") return; setMessage("Não foi possível compartilhar agora. Copie o link para enviar.") } }

  return <Card className="mt-6 p-6 sm:p-8"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 font-serif text-2xl font-bold"><UserPlus className="size-6 text-primary" />Convites</h2><p className="mt-1 text-sm text-muted-foreground">Convide um familiar como membro deste jardim.</p></div><Button onClick={create} disabled={busy}><Plus className="size-4" />Gerar convite</Button></div>{message && <Alert className="mt-4">{message}</Alert>}{link && <div className="mt-5 rounded-2xl border border-border bg-secondary/30 p-4"><p className="text-sm font-semibold">Este link será exibido somente agora</p><input aria-label="Link do convite" readOnly value={link} className="mt-2 w-full rounded-xl border border-border bg-card p-3 text-sm" /><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={copy}><Copy className="size-4" />Copiar</Button><Button size="sm" onClick={share}><Share2 className="size-4" />Compartilhar</Button><Button size="sm" variant="ghost" onClick={() => setLink("")}>Ocultar link</Button></div></div>}<div className="mt-6"><h3 className="font-semibold">Convites recentes</h3>{query.isLoading && <p role="status" className="mt-3 text-sm text-muted-foreground">Carregando convites…</p>}{query.isError && <Alert className="mt-3">Não foi possível listar os convites.</Alert>}{query.data?.length === 0 && <p className="mt-3 text-sm text-muted-foreground">Nenhum convite criado.</p>}<ul className="mt-3 space-y-3">{query.data?.map((invite) => { const status = inviteStatus(invite); return <li key={invite.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border p-4"><div><p className="font-medium">{status}</p><p className="mt-1 text-xs text-muted-foreground">Criado em {formatDate(invite.created_at)} · expira em {formatDate(invite.expires_at)}</p></div>{status === "Pendente" && (revoking === invite.id ? <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setRevoking(null)} disabled={busy}>Cancelar</Button><Button size="sm" onClick={() => revoke(invite.id)} disabled={busy}>Confirmar revogação</Button></div> : <Button size="sm" variant="ghost" onClick={() => setRevoking(invite.id)}>Revogar</Button>)}</li> })}</ul></div></Card>
}

function formatDate(value: string) { return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) }
