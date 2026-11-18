import { useEffect, useState, type ChangeEvent } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { useQueryClient } from "@tanstack/react-query"
import { Camera, Leaf, X } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { invalidateGardenPlants } from "./hooks"
import { plantFormSchema, toPlantInsertPayload, validatePlantPhoto, type PlantFormValues } from "./schema"
import { plantWorkflowDependencies } from "./api"
import { createPlantWithOptionalPhoto, createSubmissionGate, recoverPlantPhoto, type PhotoRecovery } from "./workflow"

const fieldClass = "h-14 w-full rounded-xl border border-border bg-card px-4 text-base outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/30"
const textAreaClass = "min-h-28 w-full resize-y rounded-xl border border-border bg-card p-4 text-base outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/30"

export function PlantFormModal({ open, gardenId, gardenName, onClose }: { open: boolean; gardenId: string; gardenName: string; onClose: () => void }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [submissionGate] = useState(() => createSubmissionGate())
  const [photo, setPhoto] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [message, setMessage] = useState("")
  const [recovery, setRecovery] = useState<PhotoRecovery | null>(null)
  const [recovering, setRecovering] = useState(false)
  const [savedPlantId, setSavedPlantId] = useState<string | null>(null)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<PlantFormValues>({
    resolver: zodResolver(plantFormSchema),
    defaultValues: { nickname: "", species: "", location: "", acquiredAt: "", origin: "", lightExposure: "", potSoilNotes: "", notes: "" },
  })
  const busy = isSubmitting || recovering

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  useEffect(() => {
    if (!open) return
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    window.setTimeout(() => document.getElementById("nickname")?.focus(), 0)
    return () => { document.body.style.overflow = previousOverflow; previousFocus?.focus() }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleKeys = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose()
      const dialog = document.getElementById("plant-form-dialog")
      if (event.key !== "Tab" || !dialog) return
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href]"))
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener("keydown", handleKeys)
    return () => document.removeEventListener("keydown", handleKeys)
  }, [open, busy, onClose])

  function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0] ?? null
    const validation = validatePlantPhoto(next)
    if (!validation.valid) { setPreview(null); setMessage(validation.message); event.target.value = ""; setPhoto(null); return }
    setMessage("")
    setPhoto(next)
    setPreview(next ? URL.createObjectURL(next) : null)
  }

  async function performSubmit(values: PlantFormValues) {
    setMessage("")
    const validation = validatePlantPhoto(photo)
    if (!validation.valid) { setMessage(validation.message); return }
    try {
      const result = await createPlantWithOptionalPhoto(gardenId, toPlantInsertPayload(values), photo, plantWorkflowDependencies)
      await invalidateGardenPlants(queryClient, gardenId)
      if (result.state === "complete") { onClose(); navigate(`/app/plants/${result.plant.id}`); return }
      setSavedPlantId(result.plant.id)
      setRecovery(result.recovery)
      setMessage(result.message)
    } catch {
      setMessage("Não foi possível salvar a planta. Revise os dados e tente novamente.")
    }
  }

  async function submit(values: PlantFormValues) {
    await submissionGate(() => performSubmit(values))
  }

  async function retryPhoto() {
    if (!recovery) return
    setRecovering(true)
    setMessage("")
    try {
      const result = await recoverPlantPhoto(recovery, plantWorkflowDependencies)
      await invalidateGardenPlants(queryClient, gardenId)
      if (result.state === "complete") { onClose(); navigate(`/app/plants/${result.plant.id}`); return }
      setRecovery(result.recovery)
      setMessage(result.message)
    } catch {
      setMessage("A planta continua salva sem foto. Tente novamente mais tarde.")
    } finally {
      setRecovering(false)
    }
  }

  return <div className="fixed inset-0 z-50 flex items-end bg-foreground/70 sm:items-center sm:justify-center sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose() }}><section id="plant-form-dialog" role="dialog" aria-modal="true" aria-labelledby="plant-form-title" className="flex max-h-[100dvh] w-full flex-col overflow-hidden rounded-t-[2rem] bg-background shadow-2xl sm:max-h-[92vh] sm:max-w-3xl sm:rounded-[2rem]"><header className="flex items-start justify-between border-b border-border px-5 py-5 sm:px-8"><div><h2 id="plant-form-title" className="font-serif text-2xl font-bold">Adicionar planta</h2><p className="mt-1 text-sm text-muted-foreground">{gardenName}</p></div><Button type="button" variant="ghost" size="icon" aria-label="Fechar" onClick={onClose} disabled={busy}><X className="size-5" /></Button></header>{savedPlantId ? <div className="space-y-5 overflow-y-auto p-6 sm:p-8"><Alert>{message}</Alert><p className="text-sm text-muted-foreground">Você pode tentar a foto novamente sem cadastrar outra planta ou continuar com a planta sem foto.</p><div className="flex flex-col gap-3 sm:flex-row"><Button onClick={retryPhoto} disabled={busy}>{recovering ? "Tentando novamente…" : "Tentar foto novamente"}</Button><Button variant="outline" onClick={() => { onClose(); navigate(`/app/plants/${savedPlantId}`) }} disabled={busy}>Ver planta sem foto</Button></div></div> : <form onSubmit={handleSubmit(submit)} className="flex min-h-0 flex-1 flex-col"><div className="space-y-6 overflow-y-auto px-5 py-6 sm:px-8"><div className="grid gap-4 sm:grid-cols-[112px_1fr] sm:items-center"><div className="flex aspect-square items-center justify-center overflow-hidden rounded-3xl bg-secondary">{preview ? <img src={preview} alt="Prévia da foto escolhida" className="size-full object-cover" /> : <Leaf className="size-10 text-primary/60" />}</div><div><Label htmlFor="plant-photo" className="flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-border px-5 hover:bg-card"><Camera className="size-5" />{photo ? "Trocar foto" : "Escolher foto"}</Label><input id="plant-photo" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={choosePhoto} /><p className="mt-2 text-xs text-muted-foreground">JPEG, PNG ou WebP, até 5 MiB.</p></div></div><div className="space-y-2"><Label htmlFor="nickname">Nome / apelido *</Label><Input id="nickname" maxLength={120} aria-invalid={Boolean(errors.nickname)} {...register("nickname")} />{errors.nickname && <p className="text-sm text-accent">{errors.nickname.message}</p>}</div><div className="grid gap-5 sm:grid-cols-2"><Field label="Espécie" id="species" error={errors.species?.message}><Input id="species" maxLength={160} {...register("species")} /></Field><Field label="Localização" id="location" error={errors.location?.message}><Input id="location" maxLength={120} placeholder="Ex.: Sala" {...register("location")} /></Field><Field label="Aquisição / plantio" id="acquiredAt" error={errors.acquiredAt?.message}><Input id="acquiredAt" type="date" {...register("acquiredAt")} /></Field><Field label="Origem" id="origin"><select id="origin" className={fieldClass} {...register("origin")}><option value="">Não informada</option><option value="seed">Semente</option><option value="seedling">Muda</option><option value="purchased">Planta adquirida</option><option value="other">Outro</option></select></Field><Field label="Exposição à luz" id="lightExposure"><select id="lightExposure" className={fieldClass} {...register("lightExposure")}><option value="">Não informada</option><option value="low_light">Pouca luz</option><option value="indirect_light">Luz indireta</option><option value="partial_sun">Sol parcial</option><option value="full_sun">Sol pleno</option></select></Field><Field label="Status inicial" id="initial-status"><div id="initial-status" className="flex h-14 items-center rounded-xl border border-border bg-muted px-4 text-muted-foreground">Ativa</div></Field></div><Field label="Vaso e solo" id="potSoilNotes" error={errors.potSoilNotes?.message}><textarea id="potSoilNotes" maxLength={2000} className={textAreaClass} {...register("potSoilNotes")} /></Field><Field label="Observações" id="notes" error={errors.notes?.message}><textarea id="notes" maxLength={5000} className={textAreaClass} {...register("notes")} /></Field>{message && <Alert>{message}</Alert>}</div><footer className="flex flex-col-reverse gap-3 border-t border-border bg-card px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:px-8"><Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button><Button type="submit" disabled={busy}>{isSubmitting ? "Salvando…" : "Salvar planta"}</Button></footer></form>}</section></div>
}

function Field({ label, id, error, children }: { label: string; id: string; error?: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label>{children}{error && <p className="text-sm text-accent">{error}</p>}</div>
}
