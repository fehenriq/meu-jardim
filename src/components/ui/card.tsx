import * as React from "react"
import { cn } from "@/lib/utils"
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) { return <div className={cn("rounded-[1.75rem] border border-border/60 bg-card shadow-[0_12px_35px_rgba(49,88,63,0.06)]", className)} {...props} /> }
