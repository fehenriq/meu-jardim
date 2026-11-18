import { TodayCarePage } from "@/features/care/today-page"
import { useGarden } from "@/features/gardens/garden-context"

export function TodayPage() {
  return <TodayCarePage />
}

export function ComingSoonPage({ title, description }: { title: string; description: string }) { const { activeGarden } = useGarden(); return <div><p className="text-sm text-muted-foreground">{activeGarden?.name}</p><h1 className="mt-1 font-serif text-4xl font-bold sm:text-5xl">{title}</h1><div className="mt-8 rounded-[2rem] border border-dashed border-border bg-card/50 p-8"><p className="font-serif text-2xl font-bold">Em breve</p><p className="mt-2 max-w-xl text-muted-foreground">{description}</p></div></div> }
