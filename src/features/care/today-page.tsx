import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { CalendarClock, Check, Droplets, Leaf, Sprout, TimerReset } from "lucide-react"
import { Link, useNavigate } from "react-router-dom"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/empty-state"
import { useGarden } from "@/features/gardens/garden-context"
import { resolveAuthorName } from "@/features/gardens/authors"
import { useActivePlantCount, useClearForeignGardenPlantQueries } from "@/features/plants/hooks"
import { firstName, formatLocalDate } from "@/lib/utils"
import { recordCareAction } from "./api"
import { invalidatePlantCare } from "./hooks"
import { formatCivilDate, formatEventDateTime, todayInTimeZone } from "./schema"
import { careEventLabels, careTypeLabels, type CareAction } from "./types"
import { invalidateTodayCare, useClearForeignTodayCare, useTodayCare } from "./today-hooks"
import { classifyCareDate, resolveTodayState } from "./today-rules"
import type { TodaySchedule } from "./today-types"
import { availableCareActions, createCareActionIntent, createCareSubmissionGate, type CareActionIntent } from "./workflow"

type ActionDraft = { schedule: TodaySchedule; action: CareAction }

export function TodayCarePage() {
  const { activeGarden, profile, authors } = useGarden()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const gardenId = activeGarden?.id ?? ""
  const timeZone = activeGarden?.timezone ?? "America/Sao_Paulo"
  const today = todayInTimeZone(timeZone)
  useClearForeignGardenPlantQueries(gardenId)
  useClearForeignTodayCare(gardenId)
  const count = useActivePlantCount(gardenId)
  const dashboard = useTodayCare(gardenId, today)
  const [draft, setDraft] = useState<ActionDraft | null>(null)
  const [note, setNote] = useState("")
  const [deferDays, setDeferDays] = useState("2")
  const [retryIntent, setRetryIntent] = useState<CareActionIntent | null>(null)
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)
  const [submissionGate] = useState(() => createCareSubmissionGate())
  const plantCount = count.data ?? 0
  const dueState = resolveTodayState(dashboard.isLoading, dashboard.isError, dashboard.data?.due.length ?? 0)

  async function refresh(plantId?: string) {
    await invalidateTodayCare(queryClient, gardenId)
    if (plantId) await invalidatePlantCare(queryClient, gardenId, plantId)
  }

  function beginAction(schedule: TodaySchedule, action: CareAction) {
    setDraft({ schedule, action }); setNote(""); setDeferDays("2"); setRetryIntent(null); setMessage("")
  }

  async function executeIntent(intent: CareActionIntent) {
    await submissionGate(async () => {
      setBusy(true); setMessage("")
      try {
        await recordCareAction(intent)
        setDraft(null); setRetryIntent(null); setNote(""); setDeferDays("2")
        await refresh(intent.rpcPayload.p_plant_id)
        setMessage("Cuidado registrado e agenda atualizada.")
      } catch {
        setRetryIntent(intent)
        setMessage("Não foi possível confirmar a ação. Os dados foram atualizados; repita com a mesma intenção para evitar duplicidade.")
        await refresh(intent.rpcPayload.p_plant_id)
      } finally { setBusy(false) }
    })
  }

  async function confirmAction() {
    if (!draft) return
    const days = draft.action === "deferred" ? Number(deferDays) : null
    if (draft.action === "deferred" && (!Number.isInteger(days) || days! < 1 || days! > 365)) { setMessage("Informe um adiamento entre 1 e 365 dias."); return }
    await executeIntent(createCareActionIntent({ plantId: draft.schedule.plant_id, scheduleId: draft.schedule.id, action: draft.action, note, deferDays: days }))
  }

  const metrics = [
    [count.isLoading ? "…" : count.isError ? "—" : String(plantCount), "Plantas ativas"],
    [dashboard.isLoading ? "…" : dashboard.isError ? "—" : String(dashboard.data?.wateringCount ?? 0), "Verificações"],
    [dashboard.isLoading ? "…" : dashboard.isError ? "—" : String(dashboard.data?.otherCount ?? 0), "Outros cuidados"],
  ]

  return <div><p className="text-sm text-muted-foreground">{activeGarden?.name} · {formatLocalDate(new Date(), timeZone)}</p><h1 className="mt-1 font-serif text-4xl font-bold sm:text-5xl">Olá, {firstName(profile?.display_name)}</h1><div className="mt-5 flex items-center gap-3 border-b border-border pb-7 text-primary"><Sprout className="size-8" /><p className="font-serif text-xl font-bold sm:text-2xl">Um pouco de cuidado, todos os dias.</p></div><div className="grid grid-cols-3 gap-3 py-7">{metrics.map(([value, label]) => <div key={label} className="border-l-2 border-primary/55 pl-3 sm:pl-4"><strong className="font-serif text-3xl sm:text-4xl">{value}</strong><p className="mt-1 text-xs text-muted-foreground sm:text-sm">{label}</p></div>)}</div>{message && <Alert className="mb-5">{message}{retryIntent && <Button size="sm" className="mt-3" onClick={() => executeIntent(retryIntent)} disabled={busy}>Tentar novamente</Button>}</Alert>}{draft && !retryIntent && <QuickActionPanel draft={draft} note={note} deferDays={deferDays} busy={busy} onNote={setNote} onDeferDays={setDeferDays} onCancel={() => setDraft(null)} onConfirm={confirmAction} />}

  <section><h2 className="mb-4 font-serif text-2xl font-bold">Precisam de atenção <span className="font-sans text-base font-normal text-muted-foreground">({(dashboard.data?.wateringCount ?? 0) + (dashboard.data?.otherCount ?? 0)})</span></h2>{dueState === "loading" && <DueSkeleton />}{dueState === "error" && <Alert>Não foi possível carregar os cuidados pendentes.<Button size="sm" variant="outline" className="mt-3" onClick={() => dashboard.refetch()}>Tentar novamente</Button></Alert>}{dueState === "empty" && <EmptyState title={plantCount ? "Tudo em dia por aqui" : "Vamos cultivar juntos?"} description={plantCount ? "Nenhum cuidado está vencido ou previsto para hoje." : "Seu jardim ainda não tem plantas."} action={plantCount ? undefined : "Adicionar primeira planta"} onAction={plantCount ? undefined : () => navigate("/app/plants?new=1")} />}{dueState === "ready" && <div className="grid gap-4">{dashboard.data?.due.map((schedule) => <DueCard key={schedule.id} schedule={schedule} today={today} onAction={beginAction} />)}</div>}</section>

  <section className="mt-9"><h2 className="font-serif text-2xl font-bold">Próximos cuidados</h2>{dashboard.isLoading && <p role="status" className="mt-3 text-muted-foreground">Carregando próximos cuidados…</p>}{dashboard.data?.upcoming.length === 0 && <p className="mt-3 text-muted-foreground">Nenhum cuidado futuro programado.</p>}<div className="mt-3 grid gap-3 sm:grid-cols-2">{dashboard.data?.upcoming.map((schedule) => <Link key={schedule.id} to={`/app/plants/${schedule.plant_id}`} className="rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"><p className="font-semibold">{schedule.plant.nickname}</p><p className="mt-1 text-sm text-muted-foreground">{schedule.custom_title ?? careTypeLabels[schedule.care_type]} · {formatCivilDate(schedule.next_due_date)}</p></Link>)}</div></section>

  <section className="mt-9"><h2 className="font-serif text-2xl font-bold">Últimas atividades</h2>{dashboard.isLoading && <p role="status" className="mt-3 text-muted-foreground">Carregando atividades…</p>}{dashboard.data?.activities.length === 0 && <p className="mt-3 text-muted-foreground">A família ainda não registrou cuidados.</p>}<ol className="mt-3 space-y-3">{dashboard.data?.activities.map((activity) => <li key={activity.id} className="rounded-2xl border border-border bg-card p-4"><Link to={`/app/plants/${activity.plant_id}`} className="font-semibold text-primary hover:underline">{activity.plant.nickname}</Link><p className="mt-1 text-sm">{careEventLabels[activity.event_type]}</p><p className="mt-1 text-xs text-muted-foreground">{formatEventDateTime(activity.event_at, timeZone)} · {resolveAuthorName(authors, activity.actor_id, profile?.id, profile?.display_name)}</p></li>)}</ol></section></div>
}

function DueCard({ schedule, today, onAction }: { schedule: TodaySchedule; today: string; onAction: (schedule: TodaySchedule, action: CareAction) => void }) {
  const overdue = classifyCareDate(schedule.next_due_date, today) === "overdue"
  return <article className="overflow-hidden rounded-3xl border border-border bg-card sm:grid sm:grid-cols-[140px_1fr]"><Link to={`/app/plants/${schedule.plant_id}`} className="block aspect-[16/8] bg-secondary sm:aspect-auto">{schedule.signedPhotoUrl ? <img src={schedule.signedPhotoUrl} alt={`Foto de ${schedule.plant.nickname}`} className="size-full object-cover" /> : <span className="flex size-full items-center justify-center"><Leaf className="size-10 text-primary/45" /></span>}</Link><div className="p-5"><div className="flex flex-wrap items-start justify-between gap-2"><div><Link to={`/app/plants/${schedule.plant_id}`} className="font-serif text-2xl font-bold hover:text-primary">{schedule.plant.nickname}</Link><p className="mt-1 text-sm text-muted-foreground">{schedule.custom_title ?? careTypeLabels[schedule.care_type]}</p></div><span className={`rounded-full px-3 py-1 text-xs ${overdue ? "bg-accent/15 text-accent" : "bg-secondary text-primary"}`}>{overdue ? `Atrasado · ${formatCivilDate(schedule.next_due_date)}` : "Hoje"}</span></div><div className="mt-4 flex flex-wrap gap-2">{availableCareActions(schedule.care_type).map((action) => <Button key={action} size="sm" variant={action === "deferred" ? "ghost" : "secondary"} onClick={() => onAction(schedule, action)}>{actionIcon(action)}{actionLabel(action)}</Button>)}</div></div></article>
}

function QuickActionPanel({ draft, note, deferDays, busy, onNote, onDeferDays, onCancel, onConfirm }: { draft: ActionDraft; note: string; deferDays: string; busy: boolean; onNote: (value: string) => void; onDeferDays: (value: string) => void; onCancel: () => void; onConfirm: () => void }) {
  return <section role="dialog" aria-labelledby="quick-action-title" className="mb-6 rounded-3xl border border-border bg-secondary/40 p-5"><h2 id="quick-action-title" className="font-serif text-2xl font-bold">{actionLabel(draft.action)} · {draft.schedule.plant.nickname}</h2><p className="mt-1 text-sm text-muted-foreground">Confirme para registrar com data e hora atuais.</p><div className="mt-4 grid gap-4 sm:grid-cols-2">{draft.action === "deferred" && <label className="text-sm font-medium">Adiar por quantos dias?<input type="number" min={1} max={365} value={deferDays} onChange={(event) => onDeferDays(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-border bg-card px-4" /></label>}<label className="text-sm font-medium">Observação opcional<textarea maxLength={2000} value={note} onChange={(event) => onNote(event.target.value)} className="mt-2 min-h-20 w-full rounded-xl border border-border bg-card p-3" /></label></div><div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="outline" onClick={onCancel} disabled={busy}>Cancelar</Button><Button onClick={onConfirm} disabled={busy}>{busy ? "Registrando…" : "Confirmar"}</Button></div></section>
}

function DueSkeleton() { return <div role="status" aria-label="Carregando cuidados" className="grid gap-4">{[1, 2].map((item) => <div key={item} className="h-40 animate-pulse rounded-3xl bg-secondary" />)}</div> }
function actionLabel(action: CareAction) { return action === "watered" ? "Reguei agora" : action === "moisture_checked" ? "Solo ainda úmido" : action === "deferred" ? "Verificar depois" : "Registrar cuidado" }
function actionIcon(action: CareAction) { return action === "watered" ? <Droplets className="size-4" /> : action === "moisture_checked" ? <TimerReset className="size-4" /> : action === "deferred" ? <CalendarClock className="size-4" /> : <Check className="size-4" /> }
