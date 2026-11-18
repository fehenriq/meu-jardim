import { useEffect, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import { useQueryClient } from "@tanstack/react-query"
import { CalendarClock, Check, Droplets, History, Pencil, Plus, Power, PowerOff, TimerReset, X } from "lucide-react"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CareScheduleMutationError, createCareSchedule, recordCareAction, updateCareSchedule } from "./api"
import { invalidatePlantCare, useCareEvents, useCareSchedules, useClearForeignCareQueries } from "./hooks"
import { careScheduleSchema, formatCivilDate, formatEventDateTime, toCareSchedulePayload, toCareScheduleValues, todayInTimeZone, type CareScheduleValues } from "./schema"
import { careEventLabels, careTypeLabels, type CareAction, type CareSchedule } from "./types"
import { availableCareActions, createCareActionIntent, createCareSubmissionGate, type CareActionIntent } from "./workflow"

type Props = { gardenId: string; plantId: string; archived: boolean; timeZone: string; currentUserId?: string; currentUserName?: string }
type ActionDraft = { action: CareAction; scheduleId: string | null; title: string }

export function CareSection({ gardenId, plantId, archived, timeZone, currentUserId, currentUserName }: Props) {
  const queryClient = useQueryClient()
  const schedules = useCareSchedules(gardenId, plantId)
  const events = useCareEvents(gardenId, plantId)
  useClearForeignCareQueries(gardenId)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CareSchedule | null>(null)
  const [actionDraft, setActionDraft] = useState<ActionDraft | null>(null)
  const [note, setNote] = useState("")
  const [deferDays, setDeferDays] = useState("2")
  const [retryIntent, setRetryIntent] = useState<CareActionIntent | null>(null)
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)
  const [submissionGate] = useState(() => createCareSubmissionGate())

  async function refresh() { await invalidatePlantCare(queryClient, gardenId, plantId) }

  async function toggleSchedule(schedule: CareSchedule) {
    setBusy(true); setMessage("")
    try {
      await updateCareSchedule(gardenId, plantId, schedule.id, schedule.updated_at, { active: !schedule.active })
      await refresh()
      setMessage(schedule.active ? "Rotina desativada. O histórico foi preservado." : "Rotina ativada com sucesso.")
    } catch (error) {
      setMessage(error instanceof CareScheduleMutationError ? error.message : "Não foi possível alterar a rotina.")
      await refresh()
    } finally { setBusy(false) }
  }

  async function executeIntent(intent: CareActionIntent) {
    await submissionGate(async () => {
      setBusy(true); setMessage("")
      try {
        await recordCareAction(intent)
        setRetryIntent(null); setActionDraft(null); setNote(""); setDeferDays("2")
        await refresh()
        setMessage("Cuidado registrado com sucesso.")
      } catch {
        setRetryIntent(intent)
        setMessage("Não foi possível confirmar o registro. Tente novamente com a mesma intenção para evitar duplicidade.")
      } finally { setBusy(false) }
    })
  }

  async function confirmAction() {
    if (!actionDraft) return
    const days = actionDraft.action === "deferred" ? Number(deferDays) : null
    if (actionDraft.action === "deferred" && (!Number.isInteger(days) || days! < 1 || days! > 365)) { setMessage("Informe um adiamento entre 1 e 365 dias."); return }
    const intent = createCareActionIntent({ plantId, scheduleId: actionDraft.scheduleId, action: actionDraft.action, note, deferDays: days })
    await executeIntent(intent)
  }

  function beginAction(action: CareAction, scheduleId: string | null, title: string) {
    setRetryIntent(null); setMessage(""); setNote(""); setDeferDays("2"); setActionDraft({ action, scheduleId, title })
  }

  return <section className="mt-8 space-y-6" aria-labelledby="care-title"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="care-title" className="font-serif text-3xl font-bold">Cuidados</h2><p className="mt-1 text-sm text-muted-foreground">Rotinas e histórico desta planta.</p></div>{!archived && <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => beginAction("watered", null, "Registrar rega espontânea")}><Droplets className="size-4" />Rega espontânea</Button><Button onClick={() => { setEditing(null); setFormOpen(true) }}><Plus className="size-4" />Nova rotina</Button></div>}</div>{archived && <Alert>Plantas arquivadas mantêm rotinas e histórico, mas não aceitam novas ações de cuidado.</Alert>}{message && <Alert>{message}{retryIntent && <Button size="sm" className="mt-3" onClick={() => executeIntent(retryIntent)} disabled={busy}>Tentar novamente</Button>}</Alert>}{formOpen && !archived && <ScheduleForm gardenId={gardenId} plantId={plantId} timeZone={timeZone} schedule={editing} onCancel={() => { setFormOpen(false); setEditing(null) }} onSaved={async () => { setFormOpen(false); setEditing(null); await refresh(); setMessage("Rotina salva com sucesso.") }} />}{actionDraft && !retryIntent && !archived && <ActionPanel draft={actionDraft} note={note} deferDays={deferDays} busy={busy} onNote={setNote} onDeferDays={setDeferDays} onCancel={() => { setActionDraft(null); setRetryIntent(null) }} onConfirm={confirmAction} />}

  <div><h3 className="font-serif text-2xl font-bold">Rotinas</h3>{schedules.isLoading && <p role="status" className="mt-3 text-muted-foreground">Carregando rotinas…</p>}{schedules.isError && <Alert className="mt-3">Não foi possível carregar as rotinas.<Button size="sm" variant="outline" className="mt-3" onClick={() => schedules.refetch()}>Tentar novamente</Button></Alert>}{schedules.data?.length === 0 && <div className="mt-3 rounded-3xl border border-dashed border-border p-6 text-center text-muted-foreground">Nenhuma rotina configurada.</div>}<div className="mt-3 grid gap-4 lg:grid-cols-2">{schedules.data?.map((schedule) => <article key={schedule.id} className="rounded-3xl border border-border bg-card p-5"><div className="flex items-start justify-between gap-3"><div><h4 className="font-serif text-xl font-bold">{schedule.custom_title ?? careTypeLabels[schedule.care_type]}</h4><p className="mt-1 text-sm text-muted-foreground">A cada {schedule.interval_days} {schedule.interval_days === 1 ? "dia" : "dias"} · próxima em {formatCivilDate(schedule.next_due_date)}</p></div><span className={`rounded-full px-3 py-1 text-xs ${schedule.active ? "bg-secondary text-primary" : "bg-muted text-muted-foreground"}`}>{schedule.active ? "Ativa" : "Inativa"}</span></div>{schedule.care_type === "watering_check" && <p className="mt-3 text-sm text-muted-foreground">Reinspeção de umidade: {schedule.settings.moisture_recheck_days ?? 2} dias.</p>}{!archived && <div className="mt-4 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => { setEditing(schedule); setFormOpen(true) }}><Pencil className="size-4" />Editar</Button><Button size="sm" variant="ghost" onClick={() => toggleSchedule(schedule)} disabled={busy}>{schedule.active ? <PowerOff className="size-4" /> : <Power className="size-4" />}{schedule.active ? "Desativar" : "Ativar"}</Button>{schedule.active && availableCareActions(schedule.care_type).map((action) => <Button key={action} size="sm" variant={action === "deferred" ? "ghost" : "secondary"} onClick={() => beginAction(action, schedule.id, actionTitle(action))}>{actionIcon(action)}{actionButtonLabel(action)}</Button>)}</div>}</article>)}</div></div>

  <div><h3 className="flex items-center gap-2 font-serif text-2xl font-bold"><History className="size-5" />Histórico</h3>{events.isLoading && <p role="status" className="mt-3 text-muted-foreground">Carregando histórico…</p>}{events.isError && <Alert className="mt-3">Não foi possível carregar o histórico.<Button size="sm" variant="outline" className="mt-3" onClick={() => events.refetch()}>Tentar novamente</Button></Alert>}{events.data?.length === 0 && <div className="mt-3 rounded-3xl border border-dashed border-border p-6 text-center text-muted-foreground">Nenhum cuidado registrado.</div>}<ol className="mt-3 space-y-3">{events.data?.map((event) => <li key={event.id} className="rounded-2xl border border-border bg-card p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-semibold">{careEventLabels[event.event_type]}</p><p className="mt-1 text-sm text-muted-foreground">{formatEventDateTime(event.event_at, timeZone)} · {event.actor_id === currentUserId ? currentUserName || "Você" : "Membro do jardim"}</p></div>{event.event_type === "deferred" && event.metadata.defer_days && <span className="rounded-full bg-muted px-3 py-1 text-xs">{event.metadata.defer_days} dias</span>}</div>{event.note && <p className="mt-3 whitespace-pre-wrap text-sm">{event.note}</p>}</li>)}</ol>{(events.data?.length ?? 0) === 30 && <p className="mt-3 text-sm text-muted-foreground">Exibindo os 30 eventos mais recentes.</p>}</div></section>
}

function ScheduleForm({ gardenId, plantId, timeZone, schedule, onCancel, onSaved }: { gardenId: string; plantId: string; timeZone: string; schedule: CareSchedule | null; onCancel: () => void; onSaved: () => Promise<void> }) {
  const [message, setMessage] = useState("")
  const { register, handleSubmit, control, reset, formState: { errors, isSubmitting } } = useForm<CareScheduleValues>({ resolver: zodResolver(careScheduleSchema), defaultValues: schedule ? toCareScheduleValues(schedule) : { careType: "watering_check", customTitle: "", intervalDays: "7", nextDueDate: todayInTimeZone(timeZone), moistureRecheckDays: "2" } })
  useEffect(() => { if (schedule) reset(toCareScheduleValues(schedule)) }, [schedule, reset])
  const careType = useWatch({ control, name: "careType" })
  async function submit(values: CareScheduleValues) {
    setMessage("")
    try {
      const payload = toCareSchedulePayload(values)
      if (schedule) await updateCareSchedule(gardenId, plantId, schedule.id, schedule.updated_at, { ...payload, active: schedule.active })
      else await createCareSchedule(plantId, payload)
      await onSaved()
    } catch (error) { setMessage(error instanceof CareScheduleMutationError ? error.message : "Não foi possível salvar a rotina.") }
  }
  return <form onSubmit={handleSubmit(submit)} className="rounded-3xl border border-border bg-card p-5" aria-labelledby="schedule-form-title"><div className="flex items-center justify-between"><h3 id="schedule-form-title" className="font-serif text-2xl font-bold">{schedule ? "Editar rotina" : "Nova rotina"}</h3><Button type="button" variant="ghost" size="icon" aria-label="Fechar formulário" onClick={onCancel} disabled={isSubmitting}><X className="size-5" /></Button></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Tipo de cuidado" id="careType" error={errors.careType?.message}><select id="careType" className="h-14 w-full rounded-xl border border-border bg-background px-4" {...register("careType")}>{Object.entries(careTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>{careType === "custom" && <Field label="Título personalizado" id="customTitle" error={errors.customTitle?.message}><Input id="customTitle" maxLength={120} {...register("customTitle")} /></Field>}<Field label="Intervalo em dias" id="intervalDays" error={errors.intervalDays?.message}><Input id="intervalDays" type="number" min={1} max={3650} {...register("intervalDays")} /></Field><Field label="Próxima data" id="nextDueDate" error={errors.nextDueDate?.message}><Input id="nextDueDate" type="date" {...register("nextDueDate")} /></Field>{careType === "watering_check" && <Field label="Reinspeção de umidade (dias)" id="moistureRecheckDays" error={errors.moistureRecheckDays?.message}><Input id="moistureRecheckDays" type="number" min={1} max={30} {...register("moistureRecheckDays")} /></Field>}</div>{message && <Alert className="mt-4">{message}</Alert>}<div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Cancelar</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Salvando…" : "Salvar rotina"}</Button></div></form>
}

function ActionPanel({ draft, note, deferDays, busy, onNote, onDeferDays, onCancel, onConfirm }: { draft: ActionDraft; note: string; deferDays: string; busy: boolean; onNote: (value: string) => void; onDeferDays: (value: string) => void; onCancel: () => void; onConfirm: () => void }) {
  return <div role="dialog" aria-labelledby="care-action-title" className="rounded-3xl border border-border bg-secondary/40 p-5"><h3 id="care-action-title" className="font-serif text-2xl font-bold">{draft.title}</h3><p className="mt-1 text-sm text-muted-foreground">Confirme para registrar o evento com data e hora atuais.</p><div className="mt-4 grid gap-4 sm:grid-cols-2">{draft.action === "deferred" && <Field label="Adiar por quantos dias?" id="defer-days"><Input id="defer-days" type="number" min={1} max={365} value={deferDays} onChange={(event) => onDeferDays(event.target.value)} /></Field>}<Field label="Observação opcional" id="care-note"><textarea id="care-note" maxLength={2000} value={note} onChange={(event) => onNote(event.target.value)} className="min-h-24 w-full rounded-xl border border-border bg-card p-3" /></Field></div><div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="outline" onClick={onCancel} disabled={busy}>Cancelar</Button><Button onClick={onConfirm} disabled={busy}>{busy ? "Registrando…" : "Confirmar registro"}</Button></div></div>
}

function Field({ label, id, error, children }: { label: string; id: string; error?: string; children: React.ReactNode }) { return <div className="space-y-2"><Label htmlFor={id}>{label}</Label>{children}{error && <p className="text-sm text-accent">{error}</p>}</div> }
function actionTitle(action: CareAction) { return action === "watered" ? "Registrar rega" : action === "moisture_checked" ? "Registrar solo ainda úmido" : action === "deferred" ? "Verificar depois" : "Concluir cuidado" }
function actionButtonLabel(action: CareAction) { return action === "watered" ? "Reguei agora" : action === "moisture_checked" ? "Solo ainda úmido" : action === "deferred" ? "Verificar depois" : "Concluir cuidado" }
function actionIcon(action: CareAction) { return action === "watered" ? <Droplets className="size-4" /> : action === "moisture_checked" ? <TimerReset className="size-4" /> : action === "deferred" ? <CalendarClock className="size-4" /> : <Check className="size-4" /> }
