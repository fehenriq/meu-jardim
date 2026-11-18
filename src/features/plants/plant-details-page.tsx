import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Archive, ArrowLeft, Leaf, Pencil, RotateCcw } from "lucide-react"
import { Link, useParams } from "react-router-dom"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { CareSection } from "@/features/care/care-section"
import { useGarden } from "@/features/gardens/garden-context"
import { GrowthSection } from "@/features/growth/growth-section"
import { PlantMutationError, updatePlantStatus } from "./api"
import { invalidateGardenPlants, useClearForeignGardenPlantQueries, usePlant } from "./hooks"
import { PlantFormModal } from "./plant-form-modal"
import { resolvePlantDetailsState } from "./query-spec"
import { formatDateOnly } from "./schema"
import { lightLabels, originLabels, statusLabels } from "./types"

export function PlantDetailsPage() {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [confirmingArchive, setConfirmingArchive] = useState(false)
  const [mutating, setMutating] = useState(false)
  const [message, setMessage] = useState("")
  const { plantId = "" } = useParams()
  const { activeGarden, profile } = useGarden()
  const gardenId = activeGarden?.id ?? ""
  useClearForeignGardenPlantQueries(gardenId)
  const query = usePlant(gardenId, plantId)
  const state = resolvePlantDetailsState(query.isLoading, query.isError, Boolean(query.data))
  if (state === "loading") return <div role="status" className="py-20 text-center text-muted-foreground">Carregando planta…</div>
  if (state === "error") return <Alert><p>Não foi possível carregar esta planta.</p><Button variant="outline" size="sm" className="mt-3" onClick={() => query.refetch()}>Tentar novamente</Button></Alert>
  if (state === "not_found" || !query.data) return <div className="rounded-[2rem] border border-dashed border-border bg-card/50 p-8 text-center"><Leaf className="mx-auto size-12 text-primary/45" /><h1 className="mt-4 font-serif text-3xl font-bold">Planta não encontrada</h1><p className="mt-2 text-muted-foreground">Ela pode não existir ou não pertencer ao jardim selecionado.</p><Button asChild className="mt-6"><Link to="/app/plants">Voltar para plantas</Link></Button></div>
  const plant = query.data

  async function changeStatus(status: "active" | "archived") {
    setMutating(true)
    setMessage("")
    try {
      await updatePlantStatus(gardenId, plant.id, plant.updated_at, status)
      await invalidateGardenPlants(queryClient, gardenId)
      setConfirmingArchive(false)
      setMessage(status === "archived" ? "Planta arquivada com sucesso." : "Planta restaurada com sucesso.")
    } catch (error) {
      if (error instanceof PlantMutationError) setMessage(error.kind === "conflict" ? "A planta foi alterada em outra sessão. Os dados serão recarregados." : "A planta não existe mais ou você não possui acesso.")
      else setMessage("Não foi possível atualizar o status da planta.")
      await query.refetch()
    } finally { setMutating(false) }
  }

  return <article><Link to="/app/plants" className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"><ArrowLeft className="size-4" />Voltar para plantas</Link><div className="mt-4 grid gap-7 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,.95fr)]"><div className="aspect-[4/3] overflow-hidden rounded-[2rem] bg-secondary/70">{plant.signedPhotoUrl ? <img src={plant.signedPhotoUrl} alt={`Foto de ${plant.nickname}`} className="size-full object-cover" /> : <div className="flex size-full flex-col items-center justify-center text-primary/50"><Leaf className="size-16" /><span className="mt-3 text-sm">Sem foto</span></div>}</div><div><p className="text-sm text-muted-foreground">{activeGarden?.name}</p><h1 className="mt-1 font-serif text-4xl font-bold sm:text-5xl">{plant.nickname}</h1>{plant.species && <p className="mt-2 text-lg italic text-muted-foreground">{plant.species}</p>}<span className="mt-5 inline-flex rounded-full bg-secondary px-4 py-2 text-sm font-medium text-primary">{statusLabels[plant.status]}</span><div className="mt-5 flex flex-wrap gap-3"><Button variant="outline" onClick={() => setEditing(true)}><Pencil className="size-4" />Editar</Button>{plant.status === "archived" ? <Button onClick={() => changeStatus("active")} disabled={mutating}><RotateCcw className="size-4" />Restaurar</Button> : <Button variant="outline" onClick={() => setConfirmingArchive(true)} disabled={mutating}><Archive className="size-4" />Arquivar</Button>}</div>{confirmingArchive && <div role="alertdialog" aria-labelledby="archive-title" className="mt-4 rounded-2xl border border-border bg-card p-4"><p id="archive-title" className="font-semibold">Arquivar esta planta?</p><p className="mt-1 text-sm text-muted-foreground">Ela sairá das listas de plantas ativas, mas seus dados serão preservados.</p><div className="mt-3 flex gap-2"><Button size="sm" onClick={() => changeStatus("archived")} disabled={mutating}>{mutating ? "Arquivando…" : "Confirmar"}</Button><Button size="sm" variant="ghost" onClick={() => setConfirmingArchive(false)} disabled={mutating}>Cancelar</Button></div></div>}{message && <Alert className="mt-4">{message}</Alert>}<dl className="mt-7 grid gap-5 sm:grid-cols-2"><Detail label="Localização" value={plant.location} /><Detail label="Aquisição / plantio" value={formatDateOnly(plant.acquired_at)} /><Detail label="Origem" value={plant.origin ? originLabels[plant.origin] : null} /><Detail label="Exposição à luz" value={plant.light_exposure ? lightLabels[plant.light_exposure] : null} /></dl></div></div><div className="mt-8 grid gap-6 lg:grid-cols-2"><TextDetail label="Vaso e solo" value={plant.pot_soil_notes} /><TextDetail label="Observações" value={plant.notes} /></div><GrowthSection key={`${gardenId}:${plant.id}`} gardenId={gardenId} plantId={plant.id} archived={plant.status === "archived"} timeZone={activeGarden?.timezone ?? "America/Sao_Paulo"} currentUserId={profile?.id} currentUserName={profile?.display_name} /><CareSection gardenId={gardenId} plantId={plant.id} archived={plant.status === "archived"} timeZone={activeGarden?.timezone ?? "America/Sao_Paulo"} currentUserId={profile?.id} currentUserName={profile?.display_name} />{editing && <PlantFormModal open gardenId={gardenId} gardenName={activeGarden?.name ?? "Seu jardim"} plant={plant} onClose={() => setEditing(false)} />}</article>
}

function Detail({ label, value }: { label: string; value: string | null }) { return <div><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt><dd className="mt-1">{value || <span className="text-muted-foreground">Não informado</span>}</dd></div> }
function TextDetail({ label, value }: { label: string; value: string | null }) { return <section className="rounded-3xl border border-border bg-card p-6"><h2 className="font-serif text-xl font-bold">{label}</h2><p className="mt-3 whitespace-pre-wrap text-muted-foreground">{value || "Não informado"}</p></section> }
