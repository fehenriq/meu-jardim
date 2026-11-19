import { lazy, Suspense } from "react"
import { Navigate, Route, Routes } from "react-router-dom"
import { AuthShell } from "@/features/auth/auth-shell"
import { ForgotPasswordPage, LoginPage, RegisterPage, ResetPasswordPage } from "@/features/auth/auth-pages"
import { ProtectedRoute } from "@/features/auth/route-guards"
import { GardenGate } from "@/features/gardens/garden-gate"
import { NewGardenPage } from "@/features/gardens/new-garden-page"
import { AppLayout } from "@/features/layout/app-layout"
import { TodayPage } from "@/features/dashboard/pages"
import { ProfilePage } from "@/features/profile/profile-page"
import { PlantsPage } from "@/features/plants/plants-page"
import { PlantDetailsPage } from "@/features/plants/plant-details-page"
import { InvitePage } from "@/features/invites/invite-page"

const CalendarPage = lazy(() => import("@/features/care/calendar-page").then((module) => ({ default: module.CalendarPage })))

export function App() { return <Routes><Route path="/invite" element={<InvitePage />} /><Route element={<AuthShell />}><Route path="/login" element={<LoginPage />} /><Route path="/register" element={<RegisterPage />} /><Route path="/forgot-password" element={<ForgotPasswordPage />} /><Route path="/reset-password" element={<ResetPasswordPage />} /></Route><Route element={<ProtectedRoute />}><Route element={<GardenGate />}><Route path="/app/gardens/new" element={<NewGardenPage />} /><Route element={<AppLayout />}><Route path="/app/today" element={<TodayPage />} /><Route path="/app/plants" element={<PlantsPage />} /><Route path="/app/plants/:plantId" element={<PlantDetailsPage />} /><Route path="/app/calendar" element={<Suspense fallback={<div role="status" className="py-20 text-center text-muted-foreground">Carregando calendário…</div>}><CalendarPage /></Suspense>} /><Route path="/app/profile" element={<ProfilePage />} /></Route></Route></Route><Route path="*" element={<Navigate to="/app/today" replace />} /></Routes> }
