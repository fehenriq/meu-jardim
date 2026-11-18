import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { useNavigate } from "react-router-dom"
import { z } from "zod"
import { Brand } from "@/components/brand"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { supabase } from "@/lib/supabase"
import { useGarden } from "./garden-context"

const schema = z.object({ name: z.string().trim().min(2, "Dê um nome ao seu jardim.").max(80, "Use no máximo 80 caracteres.") })
type Values = z.infer<typeof schema>
export function NewGardenPage() {
  const { refresh } = useGarden(); const navigate = useNavigate(); const [message, setMessage] = useState("")
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema) })
  async function submit({ name }: Values) { setMessage(""); const { data, error } = await supabase.rpc("create_garden", { garden_name: name.trim(), garden_timezone: "America/Sao_Paulo" }); if (error || !data) { setMessage("Não foi possível criar o jardim. Tente novamente."); return } localStorage.setItem("meu-jardim:preferred-garden-id", data); await refresh(); navigate("/app/today", { replace: true }) }
  return <main className="flex min-h-screen items-center justify-center px-4 py-10"><div className="w-full max-w-lg"><div className="mb-7 flex justify-center"><Brand /></div><Card className="p-7 sm:p-9"><p className="text-sm font-medium text-primary">Seu primeiro espaço</p><h1 className="mt-2 font-serif text-3xl font-bold">Vamos criar seu jardim?</h1><p className="mt-3 text-muted-foreground">Você poderá reunir plantas e cuidados da família aqui.</p><form onSubmit={handleSubmit(submit)} className="mt-7 space-y-5"><div className="space-y-2"><Label htmlFor="garden-name">Nome do jardim</Label><Input id="garden-name" autoFocus placeholder="Ex.: Jardim de casa" maxLength={80} aria-invalid={Boolean(errors.name)} {...register("name")} />{errors.name && <p className="text-sm text-accent">{errors.name.message}</p>}</div>{message && <Alert>{message}</Alert>}<Button className="w-full" disabled={isSubmitting}>{isSubmitting ? "Criando…" : "Criar meu jardim"}</Button></form></Card></div></main>
}
