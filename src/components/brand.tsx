import { cn } from "@/lib/utils"

export function Brand({ compact = false, gardenName, className }: { compact?: boolean; gardenName?: string; className?: string }) {
  return <div className={cn("flex items-center gap-3", className)}>
    <img src="/icons/icon-192.png" alt="" className={cn("rounded-[1.25rem]", compact ? "size-12" : "size-20")} />
    {compact && <div><div className="font-serif text-xl font-bold leading-tight">Meu Jardim</div><div className="max-w-44 truncate text-xs text-muted-foreground">{gardenName || "Seu espaço de cuidado"}</div></div>}
  </div>
}
