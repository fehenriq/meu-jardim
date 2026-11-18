import { Sprout } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { EmptyState } from "@/components/empty-state"
import { firstName, formatLocalDate } from "@/lib/utils"
import { useGarden } from "@/features/gardens/garden-context"
import { useActivePlantCount, useClearForeignGardenPlantQueries } from "@/features/plants/hooks"

export function TodayPage() {
  const { activeGarden, profile } = useGarden()
  const navigate = useNavigate()
  const gardenId = activeGarden?.id ?? ""
  useClearForeignGardenPlantQueries(gardenId)
  const count = useActivePlantCount(gardenId)
  const plantCount = count.data ?? 0
  return <div><p className="text-sm text-muted-foreground">{activeGarden?.name} · {formatLocalDate(new Date(), activeGarden?.timezone)}</p><h1 className="mt-1 font-serif text-4xl font-bold sm:text-5xl">Olá, {firstName(profile?.display_name)}</h1><div className="mt-5 flex items-center gap-3 border-b border-border pb-7 text-primary"><Sprout className="size-8" /><p className="font-serif text-xl font-bold sm:text-2xl">Um pouco de cuidado, todos os dias.</p></div><div className="grid grid-cols-3 gap-3 py-7">{[[count.isLoading ? "…" : count.isError ? "—" : String(plantCount), "Plantas"], ["0", "Verificações"], ["0", "Outros cuidados"]].map(([value, label]) => <div key={label} className="border-l-2 border-primary/55 pl-4"><strong className="font-serif text-3xl sm:text-4xl">{value}</strong><p className="mt-1 text-xs text-muted-foreground sm:text-sm">{label}</p>{label !== "Plantas" && <span className="text-[10px] text-muted-foreground">Em breve</span>}</div>)}</div><h2 className="mb-4 font-serif text-2xl font-bold">Precisam de atenção <span className="font-sans text-base font-normal text-muted-foreground">(0)</span></h2><EmptyState title={plantCount ? "Cuidados programados em breve" : "Vamos cultivar juntos?"} description={plantCount ? "As rotinas de cuidado serão adicionadas em uma próxima etapa." : "Seu jardim ainda não tem plantas."} action={plantCount ? undefined : "Adicionar primeira planta"} onAction={plantCount ? undefined : () => navigate("/app/plants?new=1")} /><section className="mt-8"><h2 className="font-serif text-2xl font-bold">Últimas atividades</h2><p className="mt-4 text-muted-foreground">A família ainda não registrou cuidados.</p></section></div>
}

export function ComingSoonPage({ title, description }: { title: string; description: string }) { const { activeGarden } = useGarden(); return <div><p className="text-sm text-muted-foreground">{activeGarden?.name}</p><h1 className="mt-1 font-serif text-4xl font-bold sm:text-5xl">{title}</h1><div className="mt-8 rounded-[2rem] border border-dashed border-border bg-card/50 p-8"><p className="font-serif text-2xl font-bold">Em breve</p><p className="mt-2 max-w-xl text-muted-foreground">{description}</p></div></div> }
