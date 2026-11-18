import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)) }

export function firstName(displayName?: string | null) {
  return displayName?.trim().split(/\s+/)[0] || "jardineiro"
}

export function formatLocalDate(date = new Date(), timeZone = "America/Sao_Paulo") {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone }).format(date)
}
