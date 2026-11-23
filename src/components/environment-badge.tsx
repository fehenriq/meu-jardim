export function EnvironmentBadge() {
  if (import.meta.env.VITE_APP_ENVIRONMENT !== "homolog") return null
  return <div aria-label="Ambiente de homologacao" className="pointer-events-none fixed right-3 top-3 z-50 rounded-full border border-amber-300/70 bg-amber-50/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-800 shadow-sm backdrop-blur">Homologação</div>
}
