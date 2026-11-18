import { CalendarDays, House, Leaf, LogOut, UserRound } from "lucide-react"
import { NavLink, Outlet } from "react-router-dom"
import { Brand } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase"
import { useGarden } from "@/features/gardens/garden-context"

const links = [{ to: "/app/today", label: "Hoje", icon: House }, { to: "/app/plants", label: "Plantas", icon: Leaf }, { to: "/app/calendar", label: "Calendário", icon: CalendarDays }, { to: "/app/profile", label: "Perfil", icon: UserRound }]
function Navigation({ mobile = false }: { mobile?: boolean }) { return <nav aria-label="Navegação principal" className={cn(mobile ? "grid grid-cols-4" : "space-y-2")}>{links.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} className={({ isActive }) => cn("flex items-center justify-center gap-3 rounded-2xl text-muted-foreground transition-colors hover:text-foreground", mobile ? "min-h-16 flex-col gap-1 px-1 text-[11px]" : "min-h-14 justify-start px-5 text-base", isActive && "bg-secondary text-foreground")}><Icon className={mobile ? "size-5" : "size-6"} aria-hidden="true" /><span>{label}</span></NavLink>)}</nav> }

export function AppLayout() {
  const { activeGarden, memberships, selectGarden } = useGarden()
  return <div className="min-h-screen lg:pl-[286px]"><aside className="fixed inset-y-0 left-0 z-20 hidden w-[286px] border-r border-border bg-muted p-5 lg:flex lg:flex-col"><Brand compact gardenName={activeGarden?.name} className="mb-9" />{memberships.length > 1 && <label className="mb-5 block text-xs text-muted-foreground">Jardim ativo<select className="mt-2 w-full rounded-xl border border-border bg-card p-3 text-sm text-foreground" value={activeGarden?.id} onChange={(event) => selectGarden(event.target.value)}>{memberships.map(({ garden }) => <option key={garden.id} value={garden.id}>{garden.name}</option>)}</select></label>}<Navigation /><Button variant="ghost" className="mt-auto justify-start text-muted-foreground" onClick={() => supabase.auth.signOut()}><LogOut className="size-5" />Sair</Button></aside><main className="mx-auto w-full max-w-[1040px] px-5 pb-28 pt-8 sm:px-8 lg:px-12 lg:pb-12 lg:pt-9"><Outlet /></main><div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"><Navigation mobile /></div></div>
}
