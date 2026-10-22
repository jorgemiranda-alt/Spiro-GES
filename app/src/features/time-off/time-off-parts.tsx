import { Check, Clock3, X } from "lucide-react"
import { TO_DURATION } from "@/data/time-off"
import { fmtClock } from "@/lib/dates"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import type { TimeOffRequest } from "@/store/types"
import { fmtDateRange, quantity, typeLabel } from "./time-off-model"

const TONE: Record<TimeOffRequest["status"], string> = {
  Submitted: "bg-warning-soft text-warning",
  Approved: "bg-success-soft text-success",
  Refused: "bg-destructive-soft text-destructive",
  Cancelled: "bg-muted text-muted-foreground",
}

export function StatusBadge({ status, className }: { status: TimeOffRequest["status"]; className?: string }) {
  const { tt } = useT()
  const Icon = status === "Approved" ? Check : status === "Submitted" ? Clock3 : X
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap", TONE[status], className)}>
      <Icon className="size-3.5" strokeWidth={2.4} aria-hidden />
      {tt(status)}
    </span>
  )
}

/** Request → Review → Confirmation progress. */
export function Steps({ current }: { current: 0 | 1 | 2 }) {
  const { tt } = useT()
  return (
    <ol aria-label={tt("request")} className="flex items-center gap-2 text-sm">
      {(["request", "review", "confirmation"] as const).map((s, i) => (
        <li key={s} aria-current={i === current ? "step" : undefined} className="flex items-center gap-2">
          {i > 0 && <span aria-hidden className={cn("h-px w-4 sm:w-8", i <= current ? "bg-primary" : "bg-border")} />}
          <span
            className={cn(
              "grid size-6 place-items-center rounded-full text-xs font-semibold",
              i < current ? "bg-primary text-primary-foreground" : i === current ? "bg-primary-soft text-primary ring-1 ring-primary" : "bg-muted text-muted-foreground",
            )}
          >
            {i < current ? <Check className="size-3.5" strokeWidth={2.6} aria-hidden /> : i + 1}
          </span>
          <span className={cn(i === current ? "font-semibold text-foreground" : "text-muted-foreground", i !== current && "max-sm:sr-only")}>{tt(s)}</span>
        </li>
      ))}
    </ol>
  )
}

type SummaryInput = Pick<TimeOffRequest, "type" | "start" | "end" | "duration" | "startTime"> & { hours: number | string | null }

export function Facts({ children, className }: { children: React.ReactNode; className?: string }) {
  return <dl className={cn("divide-y rounded-xl border bg-card", className)}>{children}</dl>
}
export function Fact({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
      <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-[15px] font-medium sm:text-right">{children}</dd>
    </div>
  )
}

export function DraftSummary({ r, heading = true }: { r: SummaryInput; heading?: boolean }) {
  const { tt, lang } = useT()
  const hasDates = !!r.start && !!r.end && r.end >= r.start
  return (
    <div className="space-y-3">
      {heading && <h2 className="text-base font-semibold">{tt("summary")}</h2>}
      <Facts>
        <Fact label={tt("type")}>{typeLabel(lang, r.type)}</Fact>
        <Fact label={tt("dates")}>{hasDates ? fmtDateRange(r, lang) : <span className="text-muted-foreground">{tt("chooseDates")}</span>}</Fact>
        <Fact label={tt("duration")}>
          {tt(TO_DURATION[r.duration])}
          {hasDates && (
            <small className="block text-sm font-normal text-muted-foreground">
              {quantity(r, lang)}
              {r.startTime && r.duration === "Hours" ? ` · ${fmtClock(r.startTime, lang)}` : ""}
            </small>
          )}
        </Fact>
      </Facts>
    </div>
  )
}
