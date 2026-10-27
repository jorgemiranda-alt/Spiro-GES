import { useState } from "react"
import { CalendarDays, CalendarPlus, ChevronRight, Info, Users, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { VIEW_ICONS } from "@/components/app/common"
import { StatusPill, type Tone } from "@/components/app/status"
import { PERSONAS, PROJECTS, type ViewId } from "@/data/reference-data"
import { TO_SAMPLE } from "@/data/time-off"
import { locale, parseYmd, todayStr, ymd } from "@/lib/dates"
import { assigned, burn } from "@/lib/engine"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { useDemo } from "@/store/store"
import { useTimeOffIntent } from "@/features/time-off/time-off-intent"
import { fmtDateRange, personName, typeLabel } from "@/features/time-off/time-off-model"
import { StatusBadge } from "@/features/time-off/time-off-parts"
import { BalanceBar } from "./balance-details"

type BudgetState = "over" | "near" | "watch" | "within"
// Green 1–74% of estimate, yellow 75–90%, red 91% and up (same thresholds as the project dashboard).
const STATE_TONE: Record<BudgetState, Tone> = { over: "danger", near: "danger", watch: "warning", within: "success" }
const BAR: Record<BudgetState, string> = { over: "bg-destructive", near: "bg-destructive", watch: "bg-amber-400", within: "bg-success" }

function Track({ pct, state, label }: { pct: number; state: BudgetState; label: string }) {
  return (
    <div role="img" aria-label={label} className="relative h-2.5 overflow-hidden rounded-full bg-muted">
      <span className={cn("absolute inset-y-0 left-0 rounded-full transition-[width] duration-500", BAR[state])} style={{ width: `${Math.min(100, pct)}%` }} />
      <i className="absolute inset-y-0 left-3/4 w-px bg-card/90" aria-hidden />
      <i className="absolute inset-y-0 left-[91%] w-px bg-card/90" aria-hidden />
    </div>
  )
}

export default function HomeView() {
  const s = useDemo(st => st.s)
  const go = useDemo(st => st.go)
  const { lang, t, ht, tt } = useT()
  const [showAll, setShowAll] = useState(false)
  const emp = s.persona, P = PERSONAS[emp]
  const manager = emp === "oliver"
  const fmt = (v: number) => Number(v || 0).toLocaleString(locale(lang), { minimumFractionDigits: 0, maximumFractionDigits: 2 })

  const codes = manager ? Object.keys(PROJECTS).filter(c => PROJECTS[c].approver === "oliver") : assigned(s, emp)
  const rows = codes.map(code => {
    const project = PROJECTS[code], b = burn(s, code)
    return { code, project, actual: b.used, estimate: b.est, pct: b.pct, remaining: b.est - b.used }
  }).filter(r => r.project.active && !r.project.startIn && r.estimate > 0).sort((a, b) => b.pct - a.pct || b.actual - a.actual)
  const totalEst = rows.reduce((a, r) => a + r.estimate, 0), totalAct = rows.reduce((a, r) => a + r.actual, 0)
  const pct = totalEst ? Math.max(0, (totalAct / totalEst) * 100) : 0
  const visible = showAll ? rows : rows.slice(0, 4)
  const stateOf = (p: number): BudgetState => (p >= 100 ? "over" : p >= 91 ? "near" : p >= 75 ? "watch" : "within")
  const stateLabel = (st: BudgetState) => ht(st === "over" ? "overEstimate" : st === "near" ? "nearEstimate" : st === "watch" ? "watchEstimate" : "withinEstimate")

  const openTimeOff = (opts: { scope?: "mine" | "team"; startRequest?: boolean; filter?: string }) => {
    useTimeOffIntent.getState().set(opts)
    go("timeoff")
  }
  const teamQueue = s.timeOff.requests.filter(r => r.manager === emp && r.emp !== emp && r.status === "Submitted")

  const entry: ViewId = P.views.includes("punch") ? "punch" : P.views.includes("grid") ? "grid" : "kiosk"
  const actions: { key: string; icon: LucideIcon; label: string; detail?: string; primary?: boolean; onClick: () => void }[] = manager
    ? [{ key: "team", icon: Users, label: `${t("timeoff")} · ${tt("team")}`, detail: `${teamQueue.length} ${ht("requestsWaiting")}`, primary: true, onClick: () => openTimeOff({ scope: "team", filter: "Submitted" }) }]
    : [
        { key: entry, icon: VIEW_ICONS[entry], label: t(entry), primary: true, onClick: () => go(entry) },
        { key: "request", icon: CalendarPlus, label: tt("new"), onClick: () => openTimeOff({ startRequest: true }) },
        ...(P.views.includes("timecard") ? [{ key: "timecard", icon: VIEW_ICONS.timecard, label: t("viewTc"), onClick: () => go("timecard") }] : []),
      ]

  const eligible = new Set(TO_SAMPLE.employees[emp]?.types || [])
  const balances = Object.entries(TO_SAMPLE.balances).filter(([type]) => eligible.has(type))
  const now = parseYmd(todayStr())
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1), periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const fmtLong = (d: Date) => d.toLocaleDateString(locale(lang), { month: "short", day: "numeric", year: "numeric" })
  const upcoming = s.timeOff.requests.filter(r => r.emp === emp && r.end >= todayStr() && ["Submitted", "Approved"].includes(r.status)).sort((a, b) => a.start.localeCompare(b.start)).slice(0, 2)

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight md:text-[28px]">{ht("greeting")}, {P.short}</h1>
        <time dateTime={todayStr()} className="text-sm font-medium text-muted-foreground">
          {new Date().toLocaleDateString(locale(lang), { weekday: "long", month: "long", day: "numeric" })}
        </time>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section aria-labelledby="home-budget" className="rounded-3xl border bg-card p-5 shadow-soft sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 id="home-budget" className="text-lg font-semibold">{ht("budgetTitle")}</h2>
              <p className="text-sm text-muted-foreground">{manager ? ht("managedProjects") : ht("assignedProjects")} · {rows.length} {ht("projects")}</p>
            </div>
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">{ht("dataContext")}</span>
          </div>

          {rows.length ? (
            <>
              <div className="mt-5 flex flex-wrap items-end gap-x-8 gap-y-3">
                <div><div className="text-xs text-muted-foreground">{ht("actualTotal")}</div><div className="text-3xl font-semibold tabular-nums">{fmt(totalAct)}<span className="text-base text-muted-foreground"> h</span></div></div>
                <div><div className="text-xs text-muted-foreground">{ht("estimateTotal")}</div><div className="text-3xl font-semibold text-muted-foreground tabular-nums">{fmt(totalEst)}<span className="text-base"> h</span></div></div>
                <div className="ml-auto text-right"><div className="text-xs text-muted-foreground">{totalEst - totalAct >= 0 ? ht("remainingTotal") : ht("overTotal")}</div><div className="text-xl font-semibold tabular-nums">{fmt(Math.abs(totalEst - totalAct))} h</div></div>
              </div>
              <div className="mt-3"><Track pct={pct} state={stateOf(pct)} label={`${fmt(totalAct)} ${ht("hoursActualOf")} ${fmt(totalEst)} ${ht("hoursEstimate")}. ${Math.round(pct)}%.`} /></div>
              <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                <span>{ht("actualShare")} <b className="text-foreground tabular-nums">{Math.round(pct)}%</b></span>
                <span>{ht("thresholdGuide")}</span>
              </div>

              <h3 className="mt-6 mb-1 text-sm font-semibold">{ht("hoursByProject")}</h3>
              <ul className="divide-y">
                {visible.map(r => {
                  const st = stateOf(r.pct)
                  const remaining = r.remaining >= 0 ? `${fmt(r.remaining)} ${ht("hoursShort")}` : `${fmt(Math.abs(r.remaining))} ${ht("hoursOver")}`
                  return (
                    <li key={r.code} className="grid gap-x-6 gap-y-2 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{r.project.name} <span className="text-sm font-normal text-muted-foreground tabular-nums">{r.code}</span></div>
                        <div className="truncate text-sm text-muted-foreground">{r.project.client}{r.project.show && r.project.show !== "—" ? ` · ${r.project.show}` : ""}</div>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap justify-between gap-x-3 text-sm">
                          <span className="tabular-nums"><b>{fmt(r.actual)}</b> / {fmt(r.estimate)} h</span>
                          <span className="text-muted-foreground">{remaining}</span>
                        </div>
                        <Track pct={r.pct} state={st} label={`${fmt(r.actual)} ${ht("hoursActualOf")} ${fmt(r.estimate)} ${ht("hoursEstimate")}. ${Math.round(r.pct)}%. ${stateLabel(st)}.`} />
                        <div className="flex items-center justify-between">
                          <StatusPill tone={STATE_TONE[st]}>{stateLabel(st)}</StatusPill>
                          <span className="text-xs text-muted-foreground tabular-nums">{Math.round(r.pct)}% {ht("used")}</span>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
              {rows.length > 4 && (
                <Button variant="ghost" className="mt-1 w-full" onClick={() => setShowAll(v => !v)} aria-expanded={showAll}>
                  {ht(showAll ? "showLess" : "showAll")}
                </Button>
              )}
              <p className="mt-4 flex gap-2 border-t pt-4 text-xs text-muted-foreground"><Info className="size-4 shrink-0" aria-hidden />{ht("estimateNote")} {ht("sampleNote")}</p>
            </>
          ) : (
            <div className="mt-6 rounded-2xl bg-muted p-6 text-center">
              <h3 className="font-semibold">{ht("noProjects")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{ht("noProjectsNote")}</p>
              <Button className="mt-4" onClick={() => go(entry)}>{t(entry)} <ChevronRight /></Button>
            </div>
          )}
        </section>

        <aside className="space-y-6" aria-label={ht("supportingWork")}>
          <section className="rounded-3xl border bg-card p-5 shadow-soft">
            <h2 className="text-lg font-semibold">{ht("quickActions")}</h2>
            <p className="mb-3 text-sm text-muted-foreground">{ht("quickActionsNote")}</p>
            <ul className="space-y-2">
              {actions.map(a => (
                <li key={a.key}>
                  <button
                    type="button"
                    onClick={a.onClick}
                    className={cn(
                      "flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors",
                      a.primary ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-muted hover:bg-accent",
                    )}
                  >
                    <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", a.primary ? "bg-primary-foreground/15" : "bg-card")}><a.icon className="size-[18px]" aria-hidden /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{a.label}</span>
                      {a.detail && <span className={cn("block text-xs", a.primary ? "text-primary-foreground/80" : "text-muted-foreground")}>{a.detail}</span>}
                    </span>
                    <ChevronRight className="size-4 shrink-0 opacity-70" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {manager ? (
            <section className="rounded-3xl border bg-card p-5 shadow-soft">
              <div className="flex items-start justify-between gap-2">
                <div><h2 className="text-lg font-semibold">{ht("teamRequests")}</h2><p className="text-sm text-muted-foreground">{ht("teamRequestsNote")}</p></div>
                <span className="grid size-8 place-items-center rounded-full bg-warning-soft text-sm font-semibold text-warning tabular-nums">{teamQueue.length}</span>
              </div>
              {teamQueue.length ? (
                <ul className="mt-3 divide-y">
                  {[...teamQueue].sort((a, b) => a.start.localeCompare(b.start)).slice(0, 3).map(r => (
                    <li key={r.id} className="flex items-center gap-3 py-3">
                      <span className="grid size-9 place-items-center rounded-xl bg-muted"><CalendarDays className="size-4" aria-hidden /></span>
                      <span className="min-w-0 flex-1 text-sm"><b className="block font-medium">{personName(r.emp)}</b><span className="text-muted-foreground">{typeLabel(lang, r.type)} · {fmtDateRange(r, lang)}</span></span>
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-3 text-sm text-muted-foreground">{ht("noPendingLeave")}</p>}
              <Button variant="outline" className="mt-3 w-full" onClick={() => openTimeOff({ scope: "team", filter: "Submitted" })}>{t("timeoff")} · {tt("team")} <ChevronRight /></Button>
            </section>
          ) : (
            <section className="rounded-3xl border bg-card p-5 shadow-soft">
              <h2 className="text-lg font-semibold">{ht("timeOffBalances")}</h2>
              <p className="text-sm text-muted-foreground">{ht("availableHoursByType")}</p>
              <div className="mt-3 rounded-2xl bg-muted px-3 py-2.5 text-sm">
                <div className="text-xs text-muted-foreground">{ht("reportingPeriod")} · {ht("calendarMonth")}</div>
                <div className="font-medium tabular-nums"><time dateTime={ymd(periodStart)}>{fmtLong(periodStart)}</time> – <time dateTime={ymd(periodEnd)}>{fmtLong(periodEnd)}</time></div>
              </div>
              <ul className="mt-3 space-y-1">
                {balances.map(([type, b]) => (
                  <li key={type}>
                    <BalanceBar emp={emp} type={type} label={tt(type)} amount={b.amount} allowance={b.allowance} unit={tt(b.unit)} />
                  </li>
                ))}
              </ul>
              <h3 className="mt-5 text-sm font-semibold">{ht("upcomingRequests")}</h3>
              {upcoming.length ? (
                <ul className="mt-2 divide-y">
                  {upcoming.map(r => (
                    <li key={r.id}>
                      <button type="button" onClick={() => { useTimeOffIntent.getState().set({ requestId: r.id }); go("timeoff") }} className="flex w-full items-center gap-3 py-2.5 text-left">
                        <span className="min-w-0 flex-1 text-sm"><b className="block font-medium">{typeLabel(lang, r.type)}</b><span className="text-muted-foreground">{fmtDateRange(r, lang)}</span></span>
                        <StatusBadge status={r.status} />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-2 text-sm text-muted-foreground">{ht("noUpcomingLeave")}</p>}
              <Button variant="outline" className="mt-3 w-full" onClick={() => openTimeOff({ startRequest: true })}>{tt("new")} <ChevronRight /></Button>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}
