import { Navigate, Route, Routes } from "react-router-dom"
import { AuthShell } from "@/features/auth/auth-shell"
import { ForgotPasswordPage, LoginPage, RegisterPage, ResetPasswordPage } from "@/features/auth/auth-pages"
import { ProtectedRoute } from "@/features/auth/route-guards"
import { GardenGate } from "@/features/gardens/garden-gate"
import { NewGardenPage } from "@/features/gardens/new-garden-page"
import { AppLayout } from "@/features/layout/app-layout"
import { ComingSoonPage, TodayPage } from "@/features/dashboard/pages"
import { ProfilePage } from "@/features/profile/profile-page"
import { PlantsPage } from "@/features/plants/plants-page"
import { PlantDetailsPage } from "@/features/plants/plant-details-page"

export function App() { return <Routes><Route element={<AuthShell />}><Route path="/login" element={<LoginPage />} /><Route path="/register" element={<RegisterPage />} /><Route path="/forgot-password" element={<ForgotPasswordPage />} /><Route path="/reset-password" element={<ResetPasswordPage />} /></Route><Route element={<ProtectedRoute />}><Route element={<GardenGate />}><Route path="/app/gardens/new" element={<NewGardenPage />} /><Route element={<AppLayout />}><Route path="/app/today" element={<TodayPage />} /><Route path="/app/plants" element={<PlantsPage />} /><Route path="/app/plants/:plantId" element={<PlantDetailsPage />} /><Route path="/app/calendar" element={<ComingSoonPage title="Calendário" description="O calendário de cuidados será construído quando as rotinas reais de plantas forem implementadas." />} /><Route path="/app/profile" element={<ProfilePage />} /></Route></Route></Route><Route path="*" element={<Navigate to="/app/today" replace />} /></Routes> }
