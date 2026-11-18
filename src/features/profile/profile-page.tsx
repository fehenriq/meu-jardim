import { LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useAuth } from "@/features/auth/auth-context"
import { useGarden } from "@/features/gardens/garden-context"
import { supabase } from "@/lib/supabase"

export function ProfilePage() { const { user } = useAuth(); const { profile, activeGarden, activeRole } = useGarden(); return <div><p className="text-sm text-muted-foreground">{activeGarden?.name}</p><h1 className="mt-1 font-serif text-4xl font-bold sm:text-5xl">Perfil</h1><Card className="mt-8 p-6 sm:p-8"><h2 className="font-serif text-2xl font-bold">{profile?.display_name || "Seu perfil"}</h2><p className="mt-2 text-muted-foreground">{user?.email}</p><p className="mt-4 text-sm"><span className="text-muted-foreground">Papel neste jardim:</span> {activeRole === "admin" ? "Administrador" : "Membro"}</p><p className="mt-6 text-sm text-muted-foreground">A edição do perfil e a gestão de membros serão disponibilizadas em uma próxima etapa.</p><Button variant="outline" className="mt-6" onClick={() => supabase.auth.signOut()}><LogOut className="size-5" />Sair</Button></Card></div> }
