import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Shield, UserRound, Users } from "lucide-react"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useGarden } from "@/features/gardens/garden-context"
import { leaveGarden, listMembers, manageMember } from "./api"
import { availableMemberActions, memberActionLabel } from "./rules"
import type { GardenMember, MemberAction } from "./types"

export function MembersSection() {
  const { activeGarden, activeRole, profile, refresh } = useGarden()
  const queryClient = useQueryClient()
  const gardenId = activeGarden?.id ?? ""
  const query = useQuery({ queryKey: ["garden-members", gardenId], queryFn: () => listMembers(gardenId), enabled: Boolean(gardenId) })
  const [confirmation, setConfirmation] = useState<{ member: GardenMember; action: MemberAction } | null>(null)
  const [leaving, setLeaving] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")

  async function reload() { await Promise.all([queryClient.invalidateQueries({ queryKey: ["garden-members", gardenId] }), queryClient.invalidateQueries({ queryKey: ["garden-authors", gardenId] }), refresh()]) }
  async function confirmAction() { if (!confirmation) return; setBusy(true); setMessage(""); try { await manageMember(gardenId, confirmation.member.user_id, confirmation.action); setConfirmation(null); await reload(); setMessage("Membro atualizado com sucesso.") } catch { setMessage("Não foi possível concluir. O jardim deve manter pelo menos um administrador.") } finally { setBusy(false) } }
  async function leave() { setBusy(true); setMessage(""); try { await leaveGarden(gardenId); queryClient.removeQueries({ predicate: (item) => JSON.stringify(item.queryKey).includes(gardenId) }); setLeaving(false); await refresh(); setMessage("Você saiu do jardim. Seus registros históricos foram preservados.") } catch { setMessage("Não foi possível sair. O jardim deve manter pelo menos um administrador.") } finally { setBusy(false) } }

  return <Card className="mt-6 p-6 sm:p-8"><div className="flex items-center gap-3"><Users className="size-6 text-primary" /><div><h2 className="font-serif text-2xl font-bold">Membros do jardim</h2><p className="mt-1 text-sm text-muted-foreground">Familiares com acesso ao jardim ativo.</p></div></div>{message && <Alert className="mt-4">{message}</Alert>}{query.isLoading && <p role="status" className="mt-5 text-muted-foreground">Carregando membros…</p>}{query.isError && <Alert className="mt-5">Não foi possível carregar os membros.<Button size="sm" variant="outline" className="mt-3" onClick={() => query.refetch()}>Tentar novamente</Button></Alert>}{query.data?.length === 0 && <p className="mt-5 text-muted-foreground">Nenhum membro encontrado.</p>}<ul className="mt-5 space-y-3">{query.data?.map((member) => <li key={member.user_id} className="rounded-2xl border border-border p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><div className="size-12 shrink-0 overflow-hidden rounded-full bg-secondary">{member.avatar_url ? <img src={member.avatar_url} alt="" className="size-full object-cover" /> : <span className="flex size-full items-center justify-center"><UserRound className="size-5 text-primary" /></span>}</div><div className="min-w-0"><p className="truncate font-semibold">{member.display_name}{member.user_id === profile?.id ? " (você)" : ""}</p><p className="mt-1 text-xs text-muted-foreground">{member.role === "admin" ? "Administrador" : "Membro"} · desde {formatDate(member.joined_at)}</p></div></div>{activeRole === "admin" && availableMemberActions(profile?.id ?? "", activeRole, member).length > 0 && <div className="flex flex-wrap gap-2">{availableMemberActions(profile?.id ?? "", activeRole, member).map((action) => <Button key={action} size="sm" variant={action === "remove" ? "ghost" : "outline"} onClick={() => setConfirmation({ member, action })} disabled={busy}>{action === "promote" && <Shield className="size-4" />}{memberActionLabel(action)}</Button>)}</div>}</div></li>)}</ul>{confirmation && <div role="alertdialog" aria-labelledby="member-confirm-title" className="mt-5 rounded-2xl border border-border bg-secondary/30 p-4"><p id="member-confirm-title" className="font-semibold">Confirmar: {memberActionLabel(confirmation.action)}?</p><p className="mt-1 text-sm text-muted-foreground">A alteração afeta imediatamente o acesso de {confirmation.member.display_name}.</p><div className="mt-3 flex gap-2"><Button size="sm" onClick={confirmAction} disabled={busy}>{busy ? "Salvando…" : "Confirmar"}</Button><Button size="sm" variant="outline" onClick={() => setConfirmation(null)} disabled={busy}>Cancelar</Button></div></div>}<div className="mt-6 border-t border-border pt-5">{leaving ? <div role="alertdialog" aria-labelledby="leave-title"><p id="leave-title" className="font-semibold">Sair deste jardim?</p><p className="mt-1 text-sm text-muted-foreground">Você perderá o acesso, mas seus registros históricos serão preservados.</p><div className="mt-3 flex gap-2"><Button size="sm" onClick={leave} disabled={busy}>{busy ? "Saindo…" : "Confirmar saída"}</Button><Button size="sm" variant="outline" onClick={() => setLeaving(false)} disabled={busy}>Cancelar</Button></div></div> : <Button variant="outline" onClick={() => setLeaving(true)}>Sair deste jardim</Button>}</div></Card>
}

function formatDate(value: string) { return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(value)) }
