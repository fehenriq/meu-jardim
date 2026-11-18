import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva("inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-55", { variants: { variant: { default: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/92", secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80", outline: "border border-border bg-card hover:bg-secondary", ghost: "hover:bg-secondary", link: "min-h-0 px-0 text-primary underline-offset-4 hover:underline" }, size: { default: "h-12", sm: "min-h-10 px-4", lg: "min-h-14 px-7 text-base", icon: "size-12 p-0" } }, defaultVariants: { variant: "default", size: "default" } })

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants> & { asChild?: boolean }
export function Button({ className, variant, size, asChild, ...props }: Props) {
  const Comp = asChild ? Slot : "button"
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />
}
