import { useState, type ReactNode } from "react"
import { Check, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { TO_DURATION, TO_SAMPLE } from "@/data/time-off"
import { addDays, locale, parseYmd, todayStr, ymd } from "@/lib/dates"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { useDemo } from "@/store/store"
import type { TimeOffRequest } from "@/store/types"
import { openDecision, selectRequest } from "./time-off-actions"
import { fmtDate, fmtDateRange, isManager, managerName, personName, quantity, typeLabel, useTimeOffUI } from "./time-off-model"
import { StatusBadge } from "./time-off-parts"

const CHIP_TONE: Record<TimeOffRequest["status"], string> = {
  Approved: "bg-success-soft text-success hover:bg-success-soft/70",
  Submitted: "border border-dashed border-warning/60 bg-warning-soft text-warning hover:bg-warning-soft/70",
  Refused: "bg-muted text-muted-foreground line-through",
  Cancelled: "bg-muted text-muted-foreground line-through",
}

/** A request in a day cell: opens its summary in place, with the decision the viewer can take. */
function RequestChip({ r, label }: { r: TimeOffRequest; label: string }) {
  const { tt, lang } = useT()
  const persona = useDemo(st => st.s.persona)
  const [open, setOpen] = useState(false)
  const mine = r.emp === persona
  const decide = isManager(persona) && r.manager === persona && !mine && r.status === "Submitted"
  const act = (fn: () => void) => { setOpen(false); fn() }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${personName(r.emp)} · ${typeLabel(lang, r.type)} · ${tt(r.status)}`}
          className={cn(
            "w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] leading-tight font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/60",
            CHIP_TONE[r.status],
            open && "ring-2 ring-primary/40",
          )}
        >
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 space-y-4 p-4">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold">{mine ? typeLabel(lang, r.type) : personName(r.emp)}</p>
            <p className="truncate text-sm text-muted-foreground">{mine ? r.id : `${typeLabel(lang, r.type)} · ${r.id}`}</p>
          </div>
          <StatusBadge status={r.status} className="shrink-0" />
        </header>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          <dt className="text-muted-foreground">{tt("dates")}</dt>
          <dd className="text-right font-medium">{fmtDateRange(r, lang)}</dd>
          <dt className="text-muted-foreground">{tt(TO_DURATION[r.duration])}</dt>
          <dd className="text-right font-medium tabular-nums">{quantity(r, lang)}</dd>
          {!decide && (
            <>
              <dt className="text-muted-foreground">{tt("manager")}</dt>
              <dd className="text-right font-medium">{managerName(r.manager)}</dd>
            </>
          )}
        </dl>
        {r.note && <p className="line-clamp-3 rounded-lg bg-muted px-3 py-2 text-sm">{r.note}</p>}
        <footer className="flex flex-wrap items-center gap-2">
          {decide && (
            <>
              <Button size="sm" onClick={() => act(() => openDecision(r.id, "approve"))}><Check /> {tt("approve")}</Button>
              <Button size="sm" variant="outline" onClick={() => act(() => openDecision(r.id, "refuse"))}>{tt("refuse")}</Button>
            </>
          )}
          {mine && r.status === "Submitted" && (
            <Button size="sm" variant="outline" onClick={() => act(() => openDecision(r.id, "cancel"))}>{tt("cancelRequest")}</Button>
          )}
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => act(() => selectRequest(r.id))}>
            {tt("viewRequest")} <ChevronRight />
          </Button>
        </footer>
      </PopoverContent>
    </Popover>
  )
}

/** Days with this many people off are flagged so a manager can check coverage. */
const COVERAGE_ALERT = 3
const CHIPS = 2

const shiftMonth = (month: string, delta: number) => {
  const d = parseYmd(month + "-01")
  d.setMonth(d.getMonth() + delta)
  return ymd(d).slice(0, 7)
}

/** Requests that take a person away on a date: weekends only count when the request is for that single day. */
const offOn = (requests: TimeOffRequest[], date: string) => {
  const workday = TO_SAMPLE.workdays.includes(parseYmd(date).getDay())
  return requests.filter(r => r.start <= date && date <= r.end && (workday || r.start === r.end))
}

/** Month view of time off. Team scope shows who is off each day; the day list below opens a request. */
export function TimeOffMonth({ requests, team, renderRow }: {
  requests: TimeOffRequest[]
  team: boolean
  renderRow: (r: TimeOffRequest) => ReactNode
}) {
  const { tt, lang } = useT()
  const month = useTimeOffUI(st => st.ui.viewMonth)
  const day = useTimeOffUI(st => st.ui.viewDay)
  const patch = useTimeOffUI(st => st.patch)
  const today = todayStr()
  // A calendar of who is away shows approved and pending requests together, even when the list is filtered to
  // pending ones (the team default). Refused and cancelled requests only appear when that status is filtered for.
  const statusFilter = useTimeOffUI(st => st.ui.filter)
  const shown = statusFilter === "Refused" || statusFilter === "Cancelled"
    ? requests.filter(r => r.status === statusFilter)
    : requests.filter(r => r.status === "Approved" || r.status === "Submitted")

  const first = parseYmd(month + "-01")
  const offset = (first.getDay() + 6) % 7
  const total = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  const days = Array.from({ length: total }, (_, i) => ymd(new Date(first.getFullYear(), first.getMonth(), i + 1)))
  const weekdays = Array.from({ length: 7 }, (_, i) => addDays(new Date(2026, 0, 5), i).toLocaleDateString(locale(lang), { weekday: "short" }))
  const label = first.toLocaleDateString(locale(lang), { month: "long", year: "numeric" })
  const picked = day.slice(0, 7) === month ? day : ""
  const dayItems = picked ? offOn(shown, picked) : []
  const chip = (r: TimeOffRequest) => (team ? personName(r.emp).split(" ")[0] : typeLabel(lang, r.type))

  return (
    <div className="space-y-4 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold capitalize" aria-live="polite">{label}</h2>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => patch({ viewMonth: today.slice(0, 7), viewDay: today })}>{tt("thisMonth")}</Button>
          <Button variant="ghost" size="icon" aria-label={tt("previousMonth")} onClick={() => patch({ viewMonth: shiftMonth(month, -1) })}><ChevronLeft /></Button>
          <Button variant="ghost" size="icon" aria-label={tt("nextMonth")} onClick={() => patch({ viewMonth: shiftMonth(month, 1) })}><ChevronRight /></Button>
        </div>
      </div>

      <div role="grid" aria-label={label}>
        <div role="row" className="grid grid-cols-7 gap-1 pb-1 text-center text-xs font-medium text-muted-foreground">
          {weekdays.map((w, i) => <span key={i} role="columnheader">{w}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: offset }, (_, i) => <span key={"pad" + i} aria-hidden />)}
          {days.map((date, i) => {
            const off = offOn(shown, date)
            const weekend = !TO_SAMPLE.workdays.includes(parseYmd(date).getDay())
            const busy = team && off.length >= COVERAGE_ALERT
            const selected = date === picked
            const pick = () => patch({ viewDay: date })
            return (
              // The whole cell picks the day by pointer; the inner day button carries keyboard and screen-reader access,
              // so the request chips can be buttons of their own rather than nested inside one.
              <div
                key={date}
                role="gridcell"
                aria-selected={selected}
                onClick={pick}
                className={cn(
                  "relative flex min-h-14 min-w-0 cursor-pointer flex-col gap-1 rounded-lg border p-1 transition-colors sm:min-h-24 sm:p-1.5",
                  weekend ? "bg-muted/40" : "bg-card hover:bg-muted/60",
                  busy && "border-destructive/50 bg-destructive-soft/60",
                  selected && "border-primary ring-2 ring-primary/30",
                )}
              >
                <button
                  type="button"
                  aria-current={date === today ? "date" : undefined}
                  aria-pressed={selected}
                  aria-label={[fmtDate(date, lang, true), off.length ? tt("offCount", { n: off.length }) : ""].filter(Boolean).join(". ")}
                  onClick={e => { e.stopPropagation(); pick() }}
                  className="flex items-center justify-between gap-1 rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className={cn("grid size-6 place-items-center rounded-full text-xs tabular-nums sm:text-sm", date === today && "bg-primary font-semibold text-primary-foreground")}>{i + 1}</span>
                  {team && off.length > 0 && (
                    <span className={cn("rounded-full px-1.5 text-[11px] leading-5 font-semibold tabular-nums", busy ? "bg-destructive text-white" : "bg-muted-foreground/15")}>
                      <span className="sm:hidden">{off.length}</span>
                      <span className="max-sm:hidden">{tt("offCount", { n: off.length })}</span>
                    </span>
                  )}
                  {!team && off.length > 0 && <span className="size-2 rounded-full bg-primary sm:hidden" aria-hidden />}
                </button>
                <div className="hidden min-w-0 flex-col gap-0.5 sm:flex" onClick={e => e.stopPropagation()}>
                  {off.slice(0, CHIPS).map(r => <RequestChip key={r.id} r={r} label={chip(r)} />)}
                  {off.length > CHIPS && (
                    <button type="button" onClick={pick} className="self-start rounded px-1 text-[11px] text-muted-foreground outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/60">
                      {tt("moreCount", { n: off.length - CHIPS })}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><i className="size-3 rounded-sm bg-success-soft ring-1 ring-success/40" aria-hidden />{tt("Approved")}</span>
        <span className="flex items-center gap-1.5"><i className="size-3 rounded-sm border border-dashed border-warning/60 bg-warning-soft" aria-hidden />{tt("Submitted")}</span>
        {team && <span className="flex items-center gap-1.5"><i className="size-3 rounded-sm bg-destructive-soft ring-1 ring-destructive/50" aria-hidden />{tt("coverageHint", { n: COVERAGE_ALERT })}</span>}
        <span>{tt("calendarNote")}</span>
      </div>

      {picked && (
        <section aria-label={fmtDate(picked, lang, true)} className="overflow-hidden rounded-xl border">
          <h3 className="border-b bg-muted/50 px-4 py-2 text-sm font-semibold">
            {fmtDate(picked, lang, true)}{team && dayItems.length > 0 ? ` · ${tt("offCount", { n: dayItems.length })}` : ""}
          </h3>
          {dayItems.length
            ? <ul className="divide-y">{dayItems.map(renderRow)}</ul>
            : <p className="px-4 py-6 text-center text-sm text-muted-foreground">{tt(team ? "dayEmptyTeam" : "dayEmptyMine")}</p>}
        </section>
      )}
    </div>
  )
}
