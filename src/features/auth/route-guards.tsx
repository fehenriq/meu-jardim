import { Navigate, Outlet, useLocation } from "react-router-dom"
import { LoadingScreen } from "@/components/loading-screen"
import { useAuth } from "./auth-context"
import { protectedRouteState } from "./route-state"

export function ProtectedRoute() { const { user, loading } = useAuth(); const location = useLocation(); const state = protectedRouteState(loading, Boolean(user)); if (state === "loading") return <LoadingScreen />; if (state === "redirect") return <Navigate to="/login" state={{ from: location.pathname }} replace />; return <Outlet /> }
