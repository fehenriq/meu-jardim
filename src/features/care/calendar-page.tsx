import { useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { CalendarDays, Check, ChevronLeft, ChevronRight, Droplets, TimerReset } from "lucide-react"
import { Link } from "react-router-dom"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { useGarden } from "@/features/gardens/garden-context"
import { resolveAuthorName } from "@/features/gardens/authors"
import type { Garden, GardenAuthor, Profile } from "@/features/gardens/types"
import { invalidatePlantCare } from "./hooks"
import { invalidateTodayCare } from "./today-hooks"
import { formatEventDateTime, todayInTimeZone } from "./schema"
import { careEventLabels, careTypeLabels, type CareAction, type CareType } from "./types"
import { availableCareActions, createCareActionIntent, createCareSubmissionGate, type CareActionIntent } from "./workflow"
import { recordCareAction } from "./api"
import { calendarRange, calendarItemState, filterCalendarItems, formatCalendarCivilDate, resolveCalendarState, shiftCalendarAnchor, type CalendarFilter, type CalendarView } from "./calendar-rules"
import { invalidateCareCalendar, useCareCalendar, useClearForeignCalendarQueries } from "./calendar-hooks"
import type { CalendarItem } from "./calendar-types"

const VIEW_KEY = "meu-jardim:calendar-view"

export function CalendarPage() {
  const { activeGarden, profile, authors } = useGarden()
  return <CalendarPageContent key={activeGarden?.id} activeGarden={activeGarden} profile={profile} authors={authors} />
}

function CalendarPageContent({ activeGarden, profile, authors }: { activeGarden: Garden | null; profile: Profile | null; authors: GardenAuthor[] }) {
  const queryClient = useQueryClient()
  const gardenId = activeGarden?.id ?? ""
  const timeZone = activeGarden?.timezone ?? "America/Sao_Paulo"
  const today = todayInTimeZone(timeZone)
  const [view, setViewState] = useState<CalendarView>(() => (sessionStorage.getItem(VIEW_KEY) as CalendarView | null) ?? (window.matchMedia("(max-width: 767px)").matches ? "week" : "month"))
  const [anchor, setAnchor] = useState(today)
  const [selectedDate, setSelectedDate] = useState(today)
  const [filter, setFilter] = useState<CalendarFilter>({ plantId: "all", careType: "all" })
  const [selectedItem, setSelectedItem] = useState<CalendarItem | null>(null)
  const [action, setAction] = useState<CareAction | null>(null)
  const [note, setNote] = useState("")
  const [deferDays, setDeferDays] = useState("2")
  const [retryIntent, setRetryIntent] = useState<CareActionIntent | null>(null)
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)
  const [submissionGate] = useState(() => createCareSubmissionGate())
  const range = calendarRange(anchor, view)
  const query = useCareCalendar(gardenId, range.start, range.end, timeZone)
  useClearForeignCalendarQueries(gardenId)

  function setView(next: CalendarView) { sessionStorage.setItem(VIEW_KEY, next); setViewState(next); setAnchor(selectedDate) }
  function goToday() { setAnchor(today); setSelectedDate(today) }
  const allItems = useMemo(() => [...(query.data?.schedules ?? []), ...(query.data?.events ?? [])], [query.data])
  const filtered = filterCalendarItems(allItems, filter)
  const selectedItems = filtered.filter((item) => item.date === selectedDate)
  const plants = Array.from(new Map(allItems.map((item) => [item.plant.id, item.plant])).values()).sort((a, b) => a.nickname.localeCompare(b.nickname, "pt-BR"))
  const state = resolveCalendarState(query.isLoading, query.isError, filtered.length)

  async function refresh(plantId: string) {
    await Promise.all([invalidateCareCalendar(queryClient, gardenId), invalidateTodayCare(queryClient, gardenId), invalidatePlantCare(queryClient, gardenId, plantId)])
  }

  async function executeIntent(intent: CareActionIntent) {
    await submissionGate(async () => {
      setBusy(true); setMessage("")
      try {
        await recordCareAction(intent)
        setAction(null); setRetryIntent(null); setSelectedItem(null); setNote(""); setDeferDays("2")
        await refresh(intent.rpcPayload.p_plant_id)
        setMessage("Cuidado registrado e calendário atualizado.")
      } catch {
        setRetryIntent(intent)
        setMessage("Não foi possível confirmar a ação. Os dados foram atualizados; repita com a mesma intenção para evitar duplicidade.")
        await refresh(intent.rpcPayload.p_plant_id)
      } finally { setBusy(false) }
    })
  }

  async function confirmAction() {
    if (!action || selectedItem?.kind !== "schedule") return
    const days = action === "deferred" ? Number(deferDays) : null
    if (action === "deferred" && (!Number.isInteger(days) || days! < 1 || days! > 365)) { setMessage("Informe um adiamento entre 1 e 365 dias."); return }
    await executeIntent(createCareActionIntent({ plantId: selectedItem.plantId, scheduleId: selectedItem.id, action, note, deferDays: days }))
  }

  return <div><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm text-muted-foreground">{activeGarden?.name}</p><h1 className="mt-1 font-serif text-4xl font-bold sm:text-5xl">Calendário</h1></div><div className="flex rounded-xl border border-border bg-card p-1" aria-label="Visualização do calendário"><Button size="sm" variant={view === "week" ? "secondary" : "ghost"} onClick={() => setView("week")}>Semana</Button><Button size="sm" variant={view === "month" ? "secondary" : "ghost"} onClick={() => setView("month")}>Mês</Button></div></div><div className="mt-6 flex items-center justify-between gap-2"><Button variant="outline" size="icon" aria-label="Período anterior" onClick={() => setAnchor(shiftCalendarAnchor(anchor, view, -1))}><ChevronLeft className="size-5" /></Button><div className="text-center"><p className="font-serif text-xl font-bold">{periodLabel(range.start, range.end)}</p><Button variant="link" size="sm" onClick={goToday}>Hoje</Button></div><Button variant="outline" size="icon" aria-label="Próximo período" onClick={() => setAnchor(shiftCalendarAnchor(anchor, view, 1))}><ChevronRight className="size-5" /></Button></div><div className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"><select aria-label="Filtrar por planta" value={filter.plantId} onChange={(event) => setFilter((current) => ({ ...current, plantId: event.target.value }))} className="h-12 rounded-xl border border-border bg-card px-4"><option value="all">Todas as plantas</option>{plants.map((plant) => <option key={plant.id} value={plant.id}>{plant.nickname}</option>)}</select><select aria-label="Filtrar por cuidado" value={filter.careType} onChange={(event) => setFilter((current) => ({ ...current, careType: event.target.value as CareType | "all" }))} className="h-12 rounded-xl border border-border bg-card px-4"><option value="all">Todos os cuidados</option>{Object.entries(careTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><Button variant="outline" onClick={() => setFilter({ plantId: "all", careType: "all" })}>Limpar filtros</Button></div>{message && <Alert className="mt-5">{message}{retryIntent && <Button size="sm" className="mt-3" onClick={() => executeIntent(retryIntent)} disabled={busy}>Tentar novamente</Button>}</Alert>}{query.data?.truncated && <Alert className="mt-5">O período atingiu o limite de 200 agendas ou eventos. Reduza o intervalo ou os filtros para uma leitura completa.</Alert>}{state === "loading" && <div role="status" className="mt-6 h-72 animate-pulse rounded-3xl bg-secondary" />}{state === "error" && <Alert className="mt-6">Não foi possível carregar o calendário.<Button size="sm" variant="outline" className="mt-3" onClick={() => query.refetch()}>Tentar novamente</Button></Alert>}{state !== "loading" && state !== "error" && <><CalendarGrid days={range.days} items={filtered} selectedDate={selectedDate} today={today} view={view} onSelect={setSelectedDate} /><section className="mt-7"><h2 className="font-serif text-2xl font-bold">{dayLabel(selectedDate)}</h2>{selectedItems.length === 0 && <div className="mt-3 rounded-3xl border border-dashed border-border p-6 text-center text-muted-foreground">{allItems.length && filtered.length === 0 ? "Nenhum item corresponde aos filtros." : "Nenhum cuidado previsto ou registrado neste dia."}</div>}<div className="mt-3 space-y-3">{selectedItems.map((item) => <button key={`${item.kind}-${item.id}`} type="button" onClick={() => { setSelectedItem(item); setAction(null); setRetryIntent(null); setMessage("") }} className="flex min-h-16 w-full items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 text-left hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"><span><strong>{item.plant.nickname}</strong><span className="mt-1 block text-sm text-muted-foreground">{itemLabel(item)}</span></span><StateBadge item={item} today={today} /></button>)}</div></section></>}{selectedItem && <ItemDetails item={selectedItem} today={today} timeZone={timeZone} currentUserId={profile?.id} currentUserName={profile?.display_name} authors={authors} action={action} note={note} deferDays={deferDays} retryPending={Boolean(retryIntent)} busy={busy} onAction={setAction} onNote={setNote} onDeferDays={setDeferDays} onConfirm={confirmAction} onClose={() => { setSelectedItem(null); setAction(null); setRetryIntent(null) }} />}</div>
}

function CalendarGrid({ days, items, selectedDate, today, view, onSelect }: { days: string[]; items: CalendarItem[]; selectedDate: string; today: string; view: CalendarView; onSelect: (date: string) => void }) {
  return <div className={`mt-6 grid grid-cols-7 overflow-hidden rounded-3xl border border-border bg-card ${view === "month" ? "min-h-96" : "min-h-32"}`}>{days.map((day) => { const dayItems = items.filter((item) => item.date === day); return <button key={day} type="button" onClick={() => onSelect(day)} aria-label={`${dayLabel(day)}, ${dayItems.length} itens`} className={`min-h-20 border-b border-r border-border p-2 text-left hover:bg-secondary/40 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40 ${selectedDate === day ? "bg-secondary/70" : ""}`}><span className={`inline-flex size-8 items-center justify-center rounded-full text-sm ${day === today ? "bg-primary text-primary-foreground" : ""}`}>{Number(day.slice(8))}</span><span className="mt-1 flex flex-wrap gap-1">{dayItems.slice(0, 3).map((item) => <i key={`${item.kind}-${item.id}`} className={`size-2 rounded-full ${item.kind === "event" ? "bg-primary" : item.date < today ? "bg-accent" : "bg-secondary-foreground/50"}`} />)}{dayItems.length > 3 && <small className="text-[10px] text-muted-foreground">+{dayItems.length - 3}</small>}</span></button> })}</div>
}

function ItemDetails({ item, today, timeZone, currentUserId, currentUserName, authors, action, note, deferDays, retryPending, busy, onAction, onNote, onDeferDays, onConfirm, onClose }: { item: CalendarItem; today: string; timeZone: string; currentUserId?: string; currentUserName?: string; authors: GardenAuthor[]; action: CareAction | null; note: string; deferDays: string; retryPending: boolean; busy: boolean; onAction: (action: CareAction | null) => void; onNote: (value: string) => void; onDeferDays: (value: string) => void; onConfirm: () => void; onClose: () => void }) {
  return <section role="dialog" aria-modal="true" aria-labelledby="calendar-item-title" className="fixed inset-x-0 bottom-0 z-40 max-h-[85vh] overflow-y-auto rounded-t-[2rem] border border-border bg-background p-6 shadow-2xl sm:inset-auto sm:right-8 sm:top-24 sm:w-[420px] sm:rounded-[2rem]"><div className="flex items-start justify-between gap-3"><div><p className="text-sm text-muted-foreground">{item.kind === "schedule" ? "Previsto" : "Histórico realizado"}</p><h2 id="calendar-item-title" className="font-serif text-2xl font-bold">{item.plant.nickname}</h2></div><Button variant="ghost" size="sm" onClick={onClose}>Fechar</Button></div><div className="mt-4 space-y-2 text-sm"><p><strong>Cuidado:</strong> {item.kind === "schedule" ? item.customTitle ?? careTypeLabels[item.careType] : careEventLabels[item.eventType]}</p><p><strong>Data:</strong> {item.kind === "event" ? formatEventDateTime(item.eventAt, timeZone) : dayLabel(item.date)}</p><p><strong>Estado:</strong> {stateLabel(calendarItemState(item.kind, item.date, today, item.kind === "event" ? item.eventType : undefined))}</p>{item.kind === "event" && <p><strong>Responsável:</strong> {resolveAuthorName(authors, item.actorId, currentUserId, currentUserName)}</p>}{item.kind === "event" && item.note && <p className="whitespace-pre-wrap"><strong>Observação:</strong> {item.note}</p>}</div><Button asChild variant="outline" className="mt-4"><Link to={`/app/plants/${item.plantId}`}>Abrir planta</Link></Button>{item.kind === "schedule" && item.active && item.plant.status !== "archived" && !retryPending && <div className="mt-5 border-t border-border pt-5"><p className="font-semibold">Ação rápida</p><div className="mt-3 flex flex-wrap gap-2">{availableCareActions(item.careType).map((value) => <Button key={value} size="sm" variant={action === value ? "secondary" : "outline"} onClick={() => onAction(value)}>{actionIcon(value)}{actionLabel(value)}</Button>)}</div>{action && <div className="mt-4 space-y-3">{action === "deferred" && <label className="block text-sm font-medium">Adiar por dias<input type="number" min={1} max={365} value={deferDays} onChange={(event) => onDeferDays(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-border bg-card px-4" /></label>}<label className="block text-sm font-medium">Observação opcional<textarea maxLength={2000} value={note} onChange={(event) => onNote(event.target.value)} className="mt-2 min-h-20 w-full rounded-xl border border-border bg-card p-3" /></label><Button onClick={onConfirm} disabled={busy}>{busy ? "Registrando…" : "Confirmar ação"}</Button></div>}</div>}</section>
}

function StateBadge({ item, today }: { item: CalendarItem; today: string }) { const state = calendarItemState(item.kind, item.date, today, item.kind === "event" ? item.eventType : undefined); return <span className="rounded-full bg-secondary px-3 py-1 text-xs text-primary">{stateLabel(state)}</span> }
function itemLabel(item: CalendarItem) { return item.kind === "schedule" ? `${item.customTitle ?? careTypeLabels[item.careType]} · previsto` : careEventLabels[item.eventType] }
function stateLabel(state: ReturnType<typeof calendarItemState>) { return state === "overdue" ? "Vencido" : state === "planned" ? "Previsto" : state === "checked" ? "Verificado" : state === "deferred" ? "Adiado" : "Realizado" }
function actionLabel(action: CareAction) { return action === "watered" ? "Reguei agora" : action === "moisture_checked" ? "Solo ainda úmido" : action === "deferred" ? "Verificar depois" : "Concluir cuidado" }
function actionIcon(action: CareAction) { return action === "watered" ? <Droplets className="size-4" /> : action === "moisture_checked" ? <TimerReset className="size-4" /> : action === "deferred" ? <CalendarDays className="size-4" /> : <Check className="size-4" /> }
function dayLabel(value: string) { return formatCalendarCivilDate(value, { weekday: "long", day: "2-digit", month: "long", year: "numeric" }) }
function periodLabel(start: string, end: string) { return `${formatCalendarCivilDate(start, { day: "2-digit", month: "short", year: "numeric" })} – ${formatCalendarCivilDate(end, { day: "2-digit", month: "short", year: "numeric" })}` }
