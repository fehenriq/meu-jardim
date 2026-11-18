import { Navigate, Outlet, useLocation } from "react-router-dom"
import { Alert } from "@/components/ui/alert"
import { LoadingScreen } from "@/components/loading-screen"
import { useGarden } from "./garden-context"

export function GardenGate() {
  const { loading, error, memberships } = useGarden(); const location = useLocation();
  if (loading) return <LoadingScreen />
  if (error) return <div className="mx-auto max-w-lg p-6"><Alert>{error} Verifique sua conexão e tente recarregar.</Alert></div>
  if (!memberships.length && location.pathname !== "/app/gardens/new") return <Navigate to="/app/gardens/new" replace />
  if (memberships.length && location.pathname === "/app/gardens/new") return <Navigate to="/app/today" replace />
  return <Outlet />
}
