import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { App } from "./app"
import { AuthProvider } from "@/features/auth/auth-context"
import { GardenProvider } from "@/features/gardens/garden-context"
import { isSupabaseConfigured } from "@/lib/supabase"
import "./index.css"

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } } })
const root = createRoot(document.getElementById("root")!)
root.render(<StrictMode><QueryClientProvider client={queryClient}><BrowserRouter><AuthProvider>{isSupabaseConfigured ? <GardenProvider><App /></GardenProvider> : <div className="flex min-h-screen items-center justify-center p-6"><div className="max-w-lg rounded-3xl border border-border bg-card p-8"><h1 className="font-serif text-3xl font-bold">Configure o Supabase</h1><p className="mt-3 text-muted-foreground">Copie <code>.env.example</code> para <code>.env.local</code> e preencha as duas variáveis públicas. Consulte o README para continuar.</p></div></div>}</AuthProvider></BrowserRouter></QueryClientProvider></StrictMode>)
