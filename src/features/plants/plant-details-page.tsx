import { ArrowLeft, Leaf } from "lucide-react"
import { Link, useParams } from "react-router-dom"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { useGarden } from "@/features/gardens/garden-context"
import { formatDateOnly } from "./schema"
import { useClearForeignGardenPlantQueries, usePlant } from "./hooks"
import { lightLabels, originLabels, statusLabels } from "./types"
import { resolvePlantDetailsState } from "./query-spec"

export function PlantDetailsPage() {
  const { plantId = "" } = useParams()
  const { activeGarden } = useGarden()
  const gardenId = activeGarden?.id ?? ""
  useClearForeignGardenPlantQueries(gardenId)
  const query = usePlant(gardenId, plantId)
  const state = resolvePlantDetailsState(query.isLoading, query.isError, Boolean(query.data))
  if (state === "loading") return <div role="status" className="py-20 text-center text-muted-foreground">Carregando planta…</div>
  if (state === "error") return <Alert><p>Não foi possível carregar esta planta.</p><Button variant="outline" size="sm" className="mt-3" onClick={() => query.refetch()}>Tentar novamente</Button></Alert>
  if (state === "not_found" || !query.data) return <div className="rounded-[2rem] border border-dashed border-border bg-card/50 p-8 text-center"><Leaf className="mx-auto size-12 text-primary/45" /><h1 className="mt-4 font-serif text-3xl font-bold">Planta não encontrada</h1><p className="mt-2 text-muted-foreground">Ela pode não existir ou não pertencer ao jardim selecionado.</p><Button asChild className="mt-6"><Link to="/app/plants">Voltar para plantas</Link></Button></div>
  const plant = query.data
  return <article><Link to="/app/plants" className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"><ArrowLeft className="size-4" />Voltar para plantas</Link><div className="mt-4 grid gap-7 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,.95fr)]"><div className="aspect-[4/3] overflow-hidden rounded-[2rem] bg-secondary/70">{plant.signedPhotoUrl ? <img src={plant.signedPhotoUrl} alt={`Foto de ${plant.nickname}`} className="size-full object-cover" /> : <div className="flex size-full flex-col items-center justify-center text-primary/50"><Leaf className="size-16" /><span className="mt-3 text-sm">Sem foto</span></div>}</div><div><p className="text-sm text-muted-foreground">{activeGarden?.name}</p><h1 className="mt-1 font-serif text-4xl font-bold sm:text-5xl">{plant.nickname}</h1>{plant.species && <p className="mt-2 text-lg italic text-muted-foreground">{plant.species}</p>}<span className="mt-5 inline-flex rounded-full bg-secondary px-4 py-2 text-sm font-medium text-primary">{statusLabels[plant.status]}</span><dl className="mt-7 grid gap-5 sm:grid-cols-2"><Detail label="Localização" value={plant.location} /><Detail label="Aquisição / plantio" value={formatDateOnly(plant.acquired_at)} /><Detail label="Origem" value={plant.origin ? originLabels[plant.origin] : null} /><Detail label="Exposição à luz" value={plant.light_exposure ? lightLabels[plant.light_exposure] : null} /></dl></div></div><div className="mt-8 grid gap-6 lg:grid-cols-2"><TextDetail label="Vaso e solo" value={plant.pot_soil_notes} /><TextDetail label="Observações" value={plant.notes} /></div><div className="mt-8 rounded-2xl border border-border bg-muted p-5 text-sm text-muted-foreground">Edição, cuidados e diário de crescimento estarão disponíveis em etapas futuras.</div></article>
}

function Detail({ label, value }: { label: string; value: string | null }) { return <div><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt><dd className="mt-1">{value || <span className="text-muted-foreground">Não informado</span>}</dd></div> }
function TextDetail({ label, value }: { label: string; value: string | null }) { return <section className="rounded-3xl border border-border bg-card p-6"><h2 className="font-serif text-xl font-bold">{label}</h2><p className="mt-3 whitespace-pre-wrap text-muted-foreground">{value || "Não informado"}</p></section> }
