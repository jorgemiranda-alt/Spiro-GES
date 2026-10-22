import { AlertTriangle, CheckCircle2, CircleDashed, Clock3, XCircle, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export type Tone = "neutral" | "info" | "success" | "warning" | "danger"

const TONES: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  info: "bg-primary-soft text-primary",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-destructive-soft text-destructive",
}
const ICONS: Record<Tone, LucideIcon> = {
  neutral: CircleDashed, info: Clock3, success: CheckCircle2, warning: AlertTriangle, danger: XCircle,
}

/** Small status pill: always icon + text so state never relies on colour alone. */
export function StatusPill({ tone = "neutral", icon, children, className }: { tone?: Tone; icon?: LucideIcon | false; children: React.ReactNode; className?: string }) {
  const Icon = icon === false ? null : icon || ICONS[tone]
  return (
    <span className={cn("inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2.5 text-xs font-medium whitespace-nowrap", TONES[tone], className)}>
      {Icon && <Icon className="size-3.5" aria-hidden />}
      {children}
    </span>
  )
}

/** Quiet metadata tag, e.g. "Task: Welding". */
export function MetaTag({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex h-6 items-center rounded-md bg-secondary px-2 text-xs text-secondary-foreground", className)}>{children}</span>
}

export const rowTone = (status: string): Tone =>
  status === "Approved" || status === "Recorded" ? "success" : status === "Submitted" || status === "Pending" ? "info" : status === "Rejected" ? "danger" : "neutral"

/** Inline banner for reminders and errors. */
export function Notice({ tone = "info", children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  const Icon = ICONS[tone]
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex items-start gap-3 rounded-2xl px-4 py-3 text-sm", TONES[tone], className)}>
      <Icon className="mt-0.5 size-[18px] shrink-0" aria-hidden />
      <div className="min-w-0 text-foreground/90 [&_b]:text-foreground">{children}</div>
    </div>
  )
}
