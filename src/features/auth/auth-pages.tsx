import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { Link, Navigate, useNavigate } from "react-router-dom"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { forgotSchema, loginSchema, registerSchema, resetSchema, type LoginValues, type RegisterValues } from "./schemas"
import { supabase } from "@/lib/supabase"
import { useAuth } from "./auth-context"
import { INVITE_TOKEN_KEY } from "@/features/invites/rules"

function afterAuthPath() { return sessionStorage.getItem(INVITE_TOKEN_KEY) ? "/invite" : "/app/today" }

function Field({ id, label, error, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { id: string; label: string; error?: string }) {
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><Input id={id} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} {...props} />{error && <p id={`${id}-error`} className="text-sm text-accent">{error}</p>}</div>
}

function AuthCard({ title, children }: { title: string; children: React.ReactNode }) { return <Card className="p-7 sm:p-9"><h2 className="mb-7 font-serif text-2xl font-bold">{title}</h2>{children}</Card> }

export function LoginPage() {
  const { user } = useAuth(); const navigate = useNavigate(); const [message, setMessage] = useState("")
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) })
  if (user) return <Navigate to={afterAuthPath()} replace />
  async function submit(values: LoginValues) { setMessage(""); const { error } = await supabase.auth.signInWithPassword(values); if (error) setMessage("E-mail ou senha inválidos."); else navigate(afterAuthPath(), { replace: true }) }
  return <AuthCard title="Entrar"><form onSubmit={handleSubmit(submit)} className="space-y-5"><Field id="email" label="E-mail" type="email" autoComplete="email" error={errors.email?.message} {...register("email")} /><Field id="password" label="Senha" type="password" autoComplete="current-password" error={errors.password?.message} {...register("password")} />{message && <Alert>{message}</Alert>}<Button className="w-full" disabled={isSubmitting}>{isSubmitting ? "Entrando…" : "Entrar"}</Button><div className="flex flex-col items-center gap-4 pt-3 text-sm"><Link to="/register" className="text-primary hover:underline">Ainda não tenho conta</Link><Link to="/forgot-password" className="text-muted-foreground hover:text-primary">Esqueci minha senha</Link></div></form></AuthCard>
}

export function RegisterPage() {
  const [message, setMessage] = useState(""); const [success, setSuccess] = useState(false); const navigate = useNavigate()
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterValues>({ resolver: zodResolver(registerSchema) })
  async function submit(values: RegisterValues) { setMessage(""); const { data, error } = await supabase.auth.signUp({ email: values.email, password: values.password, options: { data: { display_name: values.name.trim() }, emailRedirectTo: `${window.location.origin}${afterAuthPath()}` } }); if (error) { setMessage(error.message.includes("already") ? "Não foi possível criar a conta. Tente entrar ou recuperar sua senha." : "Não foi possível criar a conta agora."); return } if (data.session) navigate(afterAuthPath(), { replace: true }); else setSuccess(true) }
  if (success) return <AuthCard title="Confira seu e-mail"><Alert>Enviamos um link de confirmação. Confirme o cadastro antes de entrar.</Alert><Button asChild className="mt-6 w-full"><Link to="/login">Voltar para entrar</Link></Button></AuthCard>
  return <AuthCard title="Criar conta"><form onSubmit={handleSubmit(submit)} className="space-y-5"><Field id="name" label="Seu nome" autoComplete="name" error={errors.name?.message} {...register("name")} /><Field id="email" label="E-mail" type="email" autoComplete="email" error={errors.email?.message} {...register("email")} /><Field id="password" label="Senha" type="password" autoComplete="new-password" error={errors.password?.message} {...register("password")} />{message && <Alert>{message}</Alert>}<Button className="w-full" disabled={isSubmitting}>{isSubmitting ? "Criando…" : "Criar conta"}</Button><div className="pt-3 text-center text-sm"><Link to="/login" className="text-primary hover:underline">Já tenho conta</Link></div></form></AuthCard>
}

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false); const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<{ email: string }>({ resolver: zodResolver(forgotSchema) })
  async function submit({ email }: { email: string }) { await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` }); setSent(true) }
  return <AuthCard title="Recuperar senha">{sent ? <><Alert>Se houver uma conta para esse e-mail, você receberá as instruções em instantes.</Alert><Button asChild variant="outline" className="mt-6 w-full"><Link to="/login">Voltar</Link></Button></> : <form onSubmit={handleSubmit(submit)} className="space-y-5"><p className="text-sm text-muted-foreground">Informe seu e-mail para receber um link seguro.</p><Field id="email" label="E-mail" type="email" autoComplete="email" error={errors.email?.message} {...register("email")} /><Button className="w-full" disabled={isSubmitting}>{isSubmitting ? "Enviando…" : "Enviar instruções"}</Button><div className="text-center text-sm"><Link to="/login" className="text-primary hover:underline">Voltar para entrar</Link></div></form>}</AuthCard>
}

export function ResetPasswordPage() {
  const [message, setMessage] = useState(""); const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<{ password: string }>({ resolver: zodResolver(resetSchema) })
  async function submit({ password }: { password: string }) { const { error } = await supabase.auth.updateUser({ password }); setMessage(error ? "Não foi possível atualizar. Solicite um novo link." : "Senha atualizada. Você já pode continuar.") }
  return <AuthCard title="Criar nova senha"><form onSubmit={handleSubmit(submit)} className="space-y-5"><Field id="password" label="Nova senha" type="password" autoComplete="new-password" error={errors.password?.message} {...register("password")} />{message && <Alert>{message}</Alert>}<Button className="w-full" disabled={isSubmitting}>Salvar nova senha</Button></form></AuthCard>
}
