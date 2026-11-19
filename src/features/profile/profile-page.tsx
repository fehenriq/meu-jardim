import { useEffect, useState, type FormEvent, type ChangeEvent, type ReactNode } from "react"
import { Camera, LogOut, Settings, UserRound } from "lucide-react"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/features/auth/auth-context"
import { useGarden } from "@/features/gardens/garden-context"
import { supabase } from "@/lib/supabase"
import { signAvatar, updateGarden, updateProfile, uploadAvatar } from "./api"
import { gardenSettingsSchema, profileSchema, validateAvatar } from "./schema"
import { InvitesSection } from "@/features/invites/invites-section"
import { MembersSection } from "@/features/members/members-section"

export function ProfilePage() {
  const { user } = useAuth()
  const { profile, activeGarden, activeRole, refresh } = useGarden()
  return <><ProfileEditor key={`${profile?.display_name}:${profile?.avatar_path}:${activeGarden?.id}:${activeGarden?.name}:${activeGarden?.timezone}`} user={user} profile={profile} activeGarden={activeGarden} activeRole={activeRole} refresh={refresh} /><MembersSection /><InvitesSection /></>
}

function ProfileEditor({ user, profile, activeGarden, activeRole, refresh }: { user: ReturnType<typeof useAuth>["user"]; profile: ReturnType<typeof useGarden>["profile"]; activeGarden: ReturnType<typeof useGarden>["activeGarden"]; activeRole: ReturnType<typeof useGarden>["activeRole"]; refresh: ReturnType<typeof useGarden>["refresh"] }) {
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "")
  const [gardenName, setGardenName] = useState(activeGarden?.name ?? "")
  const [timezone, setTimezone] = useState(activeGarden?.timezone ?? "")
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)
  const [confirmTimezone, setConfirmTimezone] = useState(false)

  useEffect(() => { void signAvatar(profile?.avatar_path ?? null).then(setAvatarUrl) }, [profile?.avatar_path])

  async function saveProfile(event: FormEvent) {
    event.preventDefault(); setMessage("")
    const parsed = profileSchema.safeParse({ displayName })
    if (!parsed.success) { setMessage(parsed.error.issues[0].message); return }
    setBusy(true)
    try { await updateProfile(parsed.data.displayName); await refresh(); setMessage("Perfil atualizado com sucesso.") }
    catch { setMessage("Não foi possível atualizar o perfil.") }
    finally { setBusy(false) }
  }

  async function chooseAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    const validation = validateAvatar(file)
    if (!validation.valid || !file || !user) { if (!validation.valid) setMessage(validation.message); event.target.value = ""; return }
    setBusy(true); setMessage("")
    try { const path = await uploadAvatar(user.id, file); setAvatarUrl(await signAvatar(path)); await refresh(); setMessage("Avatar atualizado com acesso privado.") }
    catch { setMessage("Não foi possível atualizar o avatar. A imagem enviada pode exigir reconciliação manual.") }
    finally { setBusy(false); event.target.value = "" }
  }

  async function saveGarden(event: FormEvent) {
    event.preventDefault(); setMessage("")
    if (!activeGarden || activeRole !== "admin") return
    const parsed = gardenSettingsSchema.safeParse({ name: gardenName, timezone })
    if (!parsed.success) { setMessage(parsed.error.issues[0].message); return }
    if (parsed.data.timezone !== activeGarden.timezone && !confirmTimezone) { setConfirmTimezone(true); return }
    setBusy(true)
    try { await updateGarden(activeGarden.id, parsed.data.name, parsed.data.timezone); await refresh(); setConfirmTimezone(false); setMessage("Configurações do jardim atualizadas.") }
    catch { setMessage("Não foi possível atualizar o jardim. Confirme sua permissão e o fuso informado.") }
    finally { setBusy(false) }
  }

  return <div><p className="text-sm text-muted-foreground">{activeGarden?.name}</p><h1 className="mt-1 font-serif text-4xl font-bold sm:text-5xl">Perfil</h1>{message && <Alert className="mt-5">{message}</Alert>}<div className="mt-8 grid gap-6 lg:grid-cols-2"><Card className="p-6 sm:p-8"><div className="flex items-center gap-4"><div className="size-20 overflow-hidden rounded-full bg-secondary">{avatarUrl ? <img src={avatarUrl} alt="Seu avatar" className="size-full object-cover" /> : <span className="flex size-full items-center justify-center"><UserRound className="size-9 text-primary" /></span>}</div><div><h2 className="font-serif text-2xl font-bold">Perfil pessoal</h2><p className="mt-1 text-sm text-muted-foreground">Visível para membros dos seus jardins.</p></div></div><Label htmlFor="avatar" className="mt-5 flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-medium"><Camera className="size-4" />Escolher avatar</Label><input id="avatar" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={chooseAvatar} disabled={busy} /><p className="mt-2 text-xs text-muted-foreground">JPEG, PNG ou WebP, até 5 MiB. O arquivo permanece privado.</p><form onSubmit={saveProfile} className="mt-6 space-y-4"><Field label="Nome público" id="display-name"><Input id="display-name" value={displayName} maxLength={120} onChange={(event) => setDisplayName(event.target.value)} /></Field><Field label="E-mail" id="email"><Input id="email" value={user?.email ?? ""} readOnly aria-readonly="true" /></Field><Button type="submit" disabled={busy}>{busy ? "Salvando…" : "Salvar perfil"}</Button></form></Card><Card className="p-6 sm:p-8"><div className="flex items-center gap-3"><Settings className="size-6 text-primary" /><div><h2 className="font-serif text-2xl font-bold">Jardim ativo</h2><p className="mt-1 text-sm text-muted-foreground">Seu papel: {activeRole === "admin" ? "Administrador" : "Membro"}</p></div></div><form onSubmit={saveGarden} className="mt-6 space-y-4"><Field label="Nome do jardim" id="garden-name"><Input id="garden-name" value={gardenName} maxLength={80} readOnly={activeRole !== "admin"} onChange={(event) => setGardenName(event.target.value)} /></Field><Field label="Fuso horário IANA" id="garden-timezone"><Input id="garden-timezone" value={timezone} maxLength={100} readOnly={activeRole !== "admin"} onChange={(event) => { setTimezone(event.target.value); setConfirmTimezone(false) }} /></Field><p className="text-sm text-muted-foreground">A reinspeção após solo úmido continua configurada em cada rotina; quando ausente, usa 2 dias.</p>{confirmTimezone && <Alert>A mudança de fuso altera como horários são exibidos e como a data civil das ações futuras é calculada. Datas civis e eventos já persistidos não serão recalculados silenciosamente.<div className="mt-3 flex gap-2"><Button type="submit" size="sm" disabled={busy}>Confirmar mudança</Button><Button type="button" size="sm" variant="outline" onClick={() => { setTimezone(activeGarden?.timezone ?? ""); setConfirmTimezone(false) }}>Cancelar</Button></div></Alert>}{activeRole === "admin" ? <Button type="submit" disabled={busy || confirmTimezone}>{busy ? "Salvando…" : "Salvar jardim"}</Button> : <Alert>Somente administradores podem alterar estas configurações.</Alert>}</form></Card></div><Button variant="outline" className="mt-6" onClick={() => supabase.auth.signOut()}><LogOut className="size-5" />Sair</Button></div>
}

function Field({ label, id, children }: { label: string; id: string; children: ReactNode }) { return <div className="space-y-2"><Label htmlFor={id}>{label}</Label>{children}</div> }
