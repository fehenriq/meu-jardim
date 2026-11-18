import { useDeferredValue, useState } from "react"
import { ChevronLeft, ChevronRight, Leaf, Plus, Search } from "lucide-react"
import { Link, useSearchParams } from "react-router-dom"
import { EmptyState } from "@/components/empty-state"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useGarden } from "@/features/gardens/garden-context"
import { useClearForeignGardenPlantQueries, useGardenLocations, usePlants } from "./hooks"
import { PlantFormModal } from "./plant-form-modal"
import { statusLabels, type PlantListFilters, type PlantStatus, type PlantWithPhoto } from "./types"
import { resolvePlantListState } from "./query-spec"

const pageSize = 12

export function PlantsPage() {
  const { activeGarden } = useGarden()
  const gardenId = activeGarden?.id ?? ""
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState("")
  const deferredSearch = useDeferredValue(search)
  const [location, setLocation] = useState("")
  const [status, setStatus] = useState<PlantStatus | "all">("active")
  const [page, setPage] = useState(1)
  const filters: PlantListFilters = { search: deferredSearch, location, status, page, pageSize }
  useClearForeignGardenPlantQueries(gardenId)
  const query = usePlants(gardenId, filters)
  const locations = useGardenLocations(gardenId)
  const modalOpen = searchParams.get("new") === "1"
  const totalPages = Math.max(1, Math.ceil((query.data?.count ?? 0) / pageSize))
  const listState = resolvePlantListState(query.isLoading, query.isError, query.data?.plants.length ?? 0)
  function openModal() { setSearchParams({ new: "1" }) }
  function closeModal() { setSearchParams({}) }
  function updateFilter(action: () => void) { action(); setPage(1) }

  return <div><div className="flex items-end justify-between gap-4"><div><p className="text-sm text-muted-foreground">{activeGarden?.name}</p><h1 className="mt-1 font-serif text-4xl font-bold sm:text-5xl">Minhas plantas</h1></div><Button className="hidden sm:inline-flex" onClick={openModal}><Plus className="size-5" />Adicionar planta</Button></div><div className="relative mt-6"><Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" /><Input className="pl-12" placeholder="Buscar por nome ou apelido…" value={search} onChange={(event) => updateFilter(() => setSearch(event.target.value))} aria-label="Buscar plantas" /></div><div className="mt-4 grid grid-cols-2 gap-3"><select className="h-14 rounded-xl border border-border bg-card px-4 text-sm" value={location} onChange={(event) => updateFilter(() => setLocation(event.target.value))} aria-label="Filtrar por localização"><option value="">Todos os locais</option>{locations.data?.map((item) => <option key={item} value={item}>{item}</option>)}</select><select className="h-14 rounded-xl border border-border bg-card px-4 text-sm" value={status} onChange={(event) => updateFilter(() => setStatus(event.target.value as PlantStatus | "all"))} aria-label="Filtrar por status"><option value="all">Todos os status</option><option value="active">Ativas</option><option value="recovering">Em recuperação</option><option value="archived">Arquivadas</option></select></div><Button className="mt-4 w-full sm:hidden" onClick={openModal}><Plus className="size-5" />Adicionar planta</Button>{listState === "loading" && <PlantListSkeleton />}{listState === "error" && <Alert className="mt-6"><p>Não foi possível carregar as plantas.</p><Button variant="outline" size="sm" className="mt-3" onClick={() => query.refetch()}>Tentar novamente</Button></Alert>}{listState === "empty" && <div className="mt-6"><EmptyState title={search || location || status !== "active" ? "Nenhuma planta encontrada" : "Seu jardim começa aqui"} description={search || location || status !== "active" ? "Ajuste a busca ou os filtros para tentar novamente." : "Uma nova folha, uma nova história."} action="Adicionar planta" onAction={openModal} /></div>}{listState === "ready" && query.data && <><div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{query.data.plants.map((plant) => <PlantCard key={plant.id} plant={plant} />)}</div><div className="mt-7 flex items-center justify-between"><p className="text-sm text-muted-foreground">{query.data.count} {query.data.count === 1 ? "planta" : "plantas"}</p><div className="flex items-center gap-2"><Button variant="outline" size="icon" aria-label="Página anterior" disabled={page === 1} onClick={() => setPage((current) => current - 1)}><ChevronLeft className="size-5" /></Button><span className="text-sm">{page} de {totalPages}</span><Button variant="outline" size="icon" aria-label="Próxima página" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}><ChevronRight className="size-5" /></Button></div></div></>}{modalOpen && <PlantFormModal open gardenId={gardenId} gardenName={activeGarden?.name ?? "Seu jardim"} onClose={closeModal} />}</div>
}

function PlantCard({ plant }: { plant: PlantWithPhoto }) {
  return <Link to={`/app/plants/${plant.id}`} className="group overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-[0_10px_28px_rgba(49,88,63,0.06)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"><div className="aspect-[4/3] overflow-hidden bg-secondary/70">{plant.signedPhotoUrl ? <img src={plant.signedPhotoUrl} alt={`Foto de ${plant.nickname}`} loading="lazy" className="size-full object-cover transition-transform group-hover:scale-[1.02]" /> : <div className="flex size-full items-center justify-center"><Leaf className="size-12 text-primary/45" /></div>}</div><div className="p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="font-serif text-2xl font-bold">{plant.nickname}</h2>{plant.species && <p className="mt-1 text-sm italic text-muted-foreground">{plant.species}</p>}</div><span className="rounded-full bg-secondary px-3 py-1 text-xs text-primary">{statusLabels[plant.status]}</span></div>{plant.location && <p className="mt-4 text-sm text-muted-foreground">{plant.location}</p>}</div></Link>
}

function PlantListSkeleton() { return <div role="status" aria-label="Carregando plantas" className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <div key={index} className="animate-pulse overflow-hidden rounded-[1.75rem] border border-border bg-card"><div className="aspect-[4/3] bg-secondary" /><div className="space-y-3 p-5"><div className="h-7 w-2/3 rounded bg-secondary" /><div className="h-4 w-1/2 rounded bg-muted" /></div></div>)}</div> }
