import { lazy, Suspense, useEffect, useMemo, useState, type ChangeEvent } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { useQueryClient } from "@tanstack/react-query"
import { BarChart3, Camera, ChevronLeft, ChevronRight, Image, Plus, Ruler, Sprout, X } from "lucide-react"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createGrowthPhotoDrafts, growthWorkflowDependencies } from "./api"
import { invalidateGrowthTimeline, useClearForeignGrowthQueries, useGrowthTimeline } from "./hooks"
import { formatGrowthDate, growthFormSchema, hasGrowthContent, toDateTimeLocal, toGrowthPayload, validateGrowthPhotos } from "./schema"
import type { GrowthFormValues, GrowthPhoto, GrowthRecovery } from "./types"
import { createGrowthSubmissionGate, saveGrowthEntry } from "./workflow"

const textAreaClass = "min-h-28 w-full resize-y rounded-xl border border-border bg-card p-4 text-base outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/30"
const GrowthInsights = lazy(() => import("./growth-insights").then((module) => ({ default: module.GrowthInsights })))

type Props = { gardenId: string; plantId: string; archived: boolean; timeZone: string; currentUserId?: string; currentUserName?: string }

export function GrowthSection({ gardenId, plantId, archived, timeZone, currentUserId, currentUserName }: Props) {
  const queryClient = useQueryClient()
  const timeline = useGrowthTimeline(gardenId, plantId)
  useClearForeignGrowthQueries(gardenId, plantId)
  const [formOpen, setFormOpen] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [message, setMessage] = useState("")
  const [recovery, setRecovery] = useState<GrowthRecovery | null>(null)
  const [recovering, setRecovering] = useState(false)
  const [viewer, setViewer] = useState<{ photos: GrowthPhoto[]; index: number } | null>(null)
  const [showInsights, setShowInsights] = useState(false)
  const [submissionGate] = useState(() => createGrowthSubmissionGate())
  const defaultValues = useMemo<GrowthFormValues>(() => ({ observedAt: toDateTimeLocal(new Date(), timeZone), heightCm: "", leafCount: "", notes: "" }), [timeZone])
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<GrowthFormValues>({ resolver: zodResolver(growthFormSchema), defaultValues })
  const previews = useMemo(() => files.map((file) => ({ file, url: URL.createObjectURL(file) })), [files])
  useEffect(() => () => previews.forEach((preview) => URL.revokeObjectURL(preview.url)), [previews])
  const items = timeline.data?.pages.flatMap((page) => page.items) ?? []

  function choosePhotos(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? [])
    const validation = validateGrowthPhotos(selected)
    if (!validation.valid) { setMessage(validation.message); event.target.value = ""; return }
    setFiles(selected)
    setMessage("")
  }

  async function performSave(values: GrowthFormValues) {
    if (!currentUserId) { setMessage("Não foi possível identificar sua sessão."); return }
    if (!hasGrowthContent(values, files.length)) { setMessage("Informe uma medição, observação ou fotografia."); return }
    let payload
    try { payload = toGrowthPayload(plantId, values, timeZone) } catch (error) { setMessage(error instanceof Error ? error.message : "Revise a data e hora."); return }
    const draft: GrowthRecovery = { gardenId, plantId, userId: currentUserId, payload, entry: null, photos: createGrowthPhotoDrafts(gardenId, plantId, files) }
    const result = await saveGrowthEntry(draft, growthWorkflowDependencies)
    if (result.state === "partial") { setRecovery(result.recovery); setMessage(result.message); return }
    await finishSave()
  }

  async function finishSave() {
    await invalidateGrowthTimeline(queryClient, gardenId, plantId)
    setRecovery(null)
    setFiles([])
    setMessage("Registro adicionado ao diário.")
    reset({ observedAt: toDateTimeLocal(new Date(), timeZone), heightCm: "", leafCount: "", notes: "" })
    setFormOpen(false)
  }

  async function retry() {
    if (!recovery) return
    setRecovering(true)
    setMessage("")
    try {
      const result = await saveGrowthEntry(recovery, growthWorkflowDependencies)
      if (result.state === "partial") { setRecovery(result.recovery); setMessage(result.message) }
      else await finishSave()
    } finally { setRecovering(false) }
  }

  async function submit(values: GrowthFormValues) { await submissionGate(() => performSave(values)) }

  return <section className="mt-8 space-y-5" aria-labelledby="growth-title"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-semibold uppercase tracking-wide text-primary">Crescimento</p><h2 id="growth-title" className="mt-1 font-serif text-3xl font-bold">Diário fotográfico</h2><p className="mt-1 text-sm text-muted-foreground">Acompanhe medidas, observações e fotografias ao longo do tempo.</p></div>{!archived && !formOpen && <Button onClick={() => { setFormOpen(true); setMessage("") }}><Plus className="size-4" />Novo registro</Button>}</div>{archived && <Alert>O histórico permanece disponível, mas plantas arquivadas não recebem novos registros ou fotografias.</Alert>}{message && <Alert>{message}</Alert>}<div><Button variant="outline" aria-expanded={showInsights} onClick={() => setShowInsights((value) => !value)}><BarChart3 className="size-4" />{showInsights ? "Ocultar análises" : "Ver gráfico e comparar fotos"}</Button></div>{showInsights && <Suspense fallback={<p role="status" className="rounded-2xl border border-border p-6 text-muted-foreground">Carregando análises…</p>}><GrowthInsights gardenId={gardenId} plantId={plantId} timeZone={timeZone} archived={archived} /></Suspense>}{formOpen && !archived && <form onSubmit={handleSubmit(submit)} className="rounded-[2rem] border border-border bg-card p-5 sm:p-7" aria-labelledby="growth-form-title"><div className="flex items-start justify-between gap-3"><div><h3 id="growth-form-title" className="font-serif text-2xl font-bold">Registrar crescimento</h3><p className="mt-1 text-sm text-muted-foreground">Horário exibido no fuso do jardim.</p></div><Button type="button" variant="ghost" size="icon" aria-label="Fechar formulário" onClick={() => setFormOpen(false)} disabled={isSubmitting || recovering || Boolean(recovery)}><X className="size-5" /></Button></div>{recovery ? <div className="mt-5 space-y-4"><p className="text-sm text-muted-foreground">O registro foi preservado. Tente novamente para enviar ou associar apenas as fotografias pendentes, sem duplicar as etapas confirmadas.</p><Button type="button" onClick={retry} disabled={recovering}>{recovering ? "Recuperando…" : "Retomar fotografias pendentes"}</Button></div> : <><div className="mt-5 grid gap-4 sm:grid-cols-3"><Field label="Data e hora" id="growth-observed" error={errors.observedAt?.message}><Input id="growth-observed" type="datetime-local" {...register("observedAt")} /></Field><Field label="Altura (cm)" id="growth-height" error={errors.heightCm?.message}><Input id="growth-height" type="number" min="0" step="0.01" inputMode="decimal" {...register("heightCm")} /></Field><Field label="Quantidade de folhas" id="growth-leaves" error={errors.leafCount?.message}><Input id="growth-leaves" type="number" min="0" step="1" inputMode="numeric" {...register("leafCount")} /></Field></div><div className="mt-4"><Field label="Observações" id="growth-notes" error={errors.notes?.message}><textarea id="growth-notes" maxLength={4000} className={textAreaClass} {...register("notes")} /></Field></div><div className="mt-5"><Label htmlFor="growth-photos" className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-border px-5 hover:bg-secondary/40"><Camera className="size-5" />Selecionar fotografias</Label><input id="growth-photos" type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={choosePhotos} /><p className="mt-2 text-xs text-muted-foreground">JPEG, PNG ou WebP, até 5 MiB por arquivo.</p>{previews.length > 0 && <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{previews.map((preview) => <figure key={preview.url}><img src={preview.url} alt={`Prévia de ${preview.file.name}`} className="aspect-square w-full rounded-2xl object-cover" /><figcaption className="mt-1 truncate text-xs text-muted-foreground">{preview.file.name}</figcaption></figure>)}</div>}</div><div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={isSubmitting}>Cancelar</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Salvando…" : "Salvar registro"}</Button></div></>}</form>}{timeline.isLoading && <p role="status" className="py-8 text-center text-muted-foreground">Carregando diário…</p>}{timeline.isError && <Alert>Não foi possível carregar o diário.<Button size="sm" variant="outline" className="mt-3" onClick={() => timeline.refetch()}>Tentar novamente</Button></Alert>}{!timeline.isLoading && !timeline.isError && items.length === 0 && <div className="rounded-[2rem] border border-dashed border-border p-8 text-center"><Sprout className="mx-auto size-10 text-primary/50" /><p className="mt-3 font-serif text-xl font-bold">Nenhum registro ainda</p><p className="mt-1 text-sm text-muted-foreground">As mudanças desta planta aparecerão aqui.</p></div>}<ol className="space-y-4">{items.map((entry) => <li key={entry.id} className="rounded-[2rem] border border-border bg-card p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-serif text-xl font-bold">{formatGrowthDate(entry.observed_at, timeZone)}</p><p className="mt-1 text-sm text-muted-foreground">{entry.created_by === currentUserId ? currentUserName || "Você" : "Membro do jardim"}</p></div><div className="flex flex-wrap gap-2">{entry.height_cm !== null && <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-sm"><Ruler className="size-4" />{entry.height_cm} cm</span>}{entry.leaf_count !== null && <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-sm"><Sprout className="size-4" />{entry.leaf_count} folhas</span>}</div></div>{entry.notes && <p className="mt-4 whitespace-pre-wrap text-sm">{entry.notes}</p>}{entry.photos.length > 0 && <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{entry.photos.map((photo, index) => <button key={photo.id} type="button" className="group aspect-square overflow-hidden rounded-2xl bg-secondary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40" onClick={() => setViewer({ photos: entry.photos, index })}>{photo.signed_url ? <img src={photo.signed_url} alt={`Fotografia ${index + 1} do registro`} className="size-full object-cover transition-transform group-hover:scale-105" /> : <span className="flex size-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground"><Image className="size-6" />Indisponível</span>}</button>)}</div>}</li>)}</ol>{timeline.hasNextPage && <div className="text-center"><Button variant="outline" onClick={() => timeline.fetchNextPage()} disabled={timeline.isFetchingNextPage}>{timeline.isFetchingNextPage ? "Carregando…" : "Carregar registros anteriores"}</Button></div>}{viewer && <PhotoViewer photos={viewer.photos} index={viewer.index} onIndex={(index) => setViewer({ ...viewer, index })} onClose={() => setViewer(null)} />}</section>
}

function PhotoViewer({ photos, index, onIndex, onClose }: { photos: GrowthPhoto[]; index: number; onIndex: (index: number) => void; onClose: () => void }) {
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    document.getElementById("growth-photo-close")?.focus()
    const keys = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
      if (event.key === "ArrowLeft") onIndex((index - 1 + photos.length) % photos.length)
      if (event.key === "ArrowRight") onIndex((index + 1) % photos.length)
      if (event.key === "Tab") {
        const dialog = document.getElementById("growth-photo-viewer")
        const focusable = dialog ? Array.from(dialog.querySelectorAll<HTMLElement>("button:not([disabled])")) : []
        if (!focusable.length) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }
    document.addEventListener("keydown", keys)
    return () => { document.removeEventListener("keydown", keys); document.body.style.overflow = previousOverflow; previousFocus?.focus() }
  }, [index, onClose, onIndex, photos.length])
  const photo = photos[index]
  return <div id="growth-photo-viewer" className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/90 p-3 sm:p-8" role="dialog" aria-modal="true" aria-label={`Fotografia ampliada ${index + 1} de ${photos.length}`}><Button id="growth-photo-close" variant="outline" size="icon" className="absolute right-4 top-4" aria-label="Fechar fotografia" onClick={onClose}><X className="size-5" /></Button>{photos.length > 1 && <Button variant="outline" size="icon" className="absolute left-3 sm:left-6" aria-label="Fotografia anterior" onClick={() => onIndex((index - 1 + photos.length) % photos.length)}><ChevronLeft className="size-5" /></Button>}<div className="max-h-[85vh] max-w-[90vw]">{photo.signed_url ? <img src={photo.signed_url} alt={`Fotografia ampliada ${index + 1}`} className="max-h-[85vh] max-w-full rounded-2xl object-contain" /> : <div className="rounded-2xl bg-card p-10 text-center">A URL desta fotografia expirou. Feche e atualize o diário.</div>}</div>{photos.length > 1 && <Button variant="outline" size="icon" className="absolute right-3 sm:right-6" aria-label="Próxima fotografia" onClick={() => onIndex((index + 1) % photos.length)}><ChevronRight className="size-5" /></Button>}<p className="absolute bottom-4 rounded-full bg-card px-3 py-1 text-sm">{index + 1} de {photos.length}</p></div>
}

function Field({ label, id, error, children }: { label: string; id: string; error?: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label>{children}{error && <p className="text-sm text-accent">{error}</p>}</div>
}
