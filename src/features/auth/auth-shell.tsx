import { Outlet } from "react-router-dom"
import { Brand } from "@/components/brand"

export function AuthShell() {
  return <main className="flex min-h-screen items-center justify-center px-4 py-10 sm:py-14">
    <div className="w-full max-w-[480px]">
      <div className="mb-8 flex flex-col items-center text-center">
        <Brand />
        <h1 className="mt-5 font-serif text-4xl font-bold">Meu Jardim</h1>
        <p className="mt-2 text-muted-foreground">As plantas da família, cuidadas juntas.</p>
      </div>
      <Outlet />
    </div>
  </main>
}
