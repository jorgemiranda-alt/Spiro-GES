import { useEffect, useState } from "react"
import { CalendarDays, Check, ChevronLeft, ChevronRight, Info, Plus, RefreshCw, X } from "lucide-react"
import { JourneyTags, PageHeader } from "@/components/app/common"
import { ResponsivePanel, useIsMobile } from "@/components/app/responsive-panel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { TO_DURATION, TO_STATUSES } from "@/data/time-off"
import { fmtClock } from "@/lib/dates"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { useDemo } from "@/store/store"
import type { TimeOffRequest } from "@/store/types"
import {
  clearFilters, closeDecision, closeDetail, commitDecision, dismissNotification, openDecision, refresh, selectRequest,
  setFilter, setScope, startRequest,
} from "./time-off-actions"
import {
  accessible, eligibleTypes, filtered, fmtDate, fmtDateRange, fmtWhen, isManager, managerName, personName, quantity,
  teamQueue, typeLabel, useTimeOffUI, validDate, visibleIn,
} from "./time-off-model"
import { StatusBadge } from "./time-off-parts"

/* ---------- header & scope ---------- */

function Header() {
  const { tt } = useT()
  const scope = useTimeOffUI(st => st.ui.scope)
  const persona = useDemo(st => st.s.persona)
  const team = scope === "team"
  const canRequest = eligibleTypes(persona).length > 0
  return (
    <PageHeader
      title={<span id="to-screen-title" tabIndex={-1} className="outline-none">{tt("title")}</span>}
      tags={team ? "TO-05" : "TO-04"}
      description={tt(team ? "teamIntro" : "subtitle")}
      actions={
        <>
          <RefreshButton className="max-sm:hidden" />
          {!team && canRequest && (
            <Button onClick={startRequest} className="max-sm:hidden"><Plus /> {tt("new")}</Button>
          )}
        </>
      }
    />
  )
}

function RefreshButton({ className }: { className?: string }) {
  const { tt } = useT()
  const refreshing = useTimeOffUI(st => st.ui.refreshing)
  return (
    <Button
      variant="outline"
      className={className}
      aria-label={tt(refreshing ? "refreshing" : "refresh")}
      aria-disabled={refreshing || undefined}
      onClick={() => void refresh()}
    >
      <RefreshCw className={cn(refreshing && "animate-spin")} aria-hidden />
      <span className="truncate">{tt(refreshing ? "refreshing" : "refresh")}</span>
    </Button>
  )
}

function ScopeSwitch() {
  const { tt } = useT()
  const scope = useTimeOffUI(st => st.ui.scope)
  const queue = useDemo(st => teamQueue(st.s))
  const item = (value: "mine" | "team", label: string, count?: number) => (
    <button
      type="button"
      aria-pressed={scope === value}
      onClick={() => setScope(value)}
      className={cn(
        "flex h-10 flex-1 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 sm:flex-none",
        scope === value ? "bg-card text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
      {count !== undefined && (
        <span className={cn("min-w-5 rounded-full px-1.5 text-xs leading-5 tabular-nums", count ? "bg-primary text-primary-foreground" : "bg-muted-foreground/15")}>{count}</span>
      )}
    </button>
  )
  return (
    <div role="group" aria-label={tt("title")} className="flex w-full gap-1 rounded-xl bg-muted p-1 sm:w-fit">
      {item("mine", tt("my"))}
      {item("team", tt("team"), queue)}
    </div>
  )
}

/* ---------- notices ---------- */

function Notice({ icon, title, body, onView, onDismiss }: { icon: React.ReactNode; title: string; body?: string; onView: () => void; onDismiss?: () => void }) {
  const { tt } = useT()
  return (
    <div role="status" className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-3 pl-4 shadow-soft">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        {body && <p className="text-sm text-muted-foreground">{body}</p>}
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" onClick={onView}>{tt("viewRequest")}</Button>
        {onDismiss && (
          <Button variant="ghost" size="icon" aria-label={tt("dismiss")} onClick={onDismiss}><X /></Button>
        )}
      </div>
    </div>
  )
}

function Notices() {
  const { tt, lang } = useT()
  const s = useDemo(st => st.s)
  const ui = useTimeOffUI(st => st.ui)
  const decided = s.timeOff.requests.find(x => x.id === ui.lastDecision)
  const n = s.timeOff.notifications.find(x => x.emp === s.persona)
  const nr = n && ui.scope === "mine" ? s.timeOff.requests.find(x => x.id === n.id) : undefined
  return (
    <>
      {accessible(decided, s.persona) && (
        <Notice
          icon={<Check className="size-5" aria-hidden />}
          title={`${personName(decided.emp)} · ${tt(decided.status)}`}
          body={fmtWhen(decided.updated, lang)}
          onView={() => selectRequest(decided.id)}
        />
      )}
      {n && nr && (
        <Notice
          icon={<Info className="size-5" aria-hidden />}
          title={tt("notification", { type: typeLabel(lang, nr.type), status: tt(n.status) })}
          body={n.reason || undefined}
          onView={() => selectRequest(nr.id)}
          onDismiss={() => dismissNotification(nr.id)}
        />
      )}
    </>
  )
}

/* ---------- filters ---------- */

function FilterSelect({ id, label, ariaLabel, value, options, onChange }: {
  id: string; label: string; ariaLabel?: string; value: string; options: [string, string][]; onChange: (v: string) => void
}) {
  return (
    <div className="min-w-0 space-y-1">
      <label htmlFor={id} className="block text-xs font-medium text-muted-foreground">{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} aria-label={ariaLabel} className="w-full sm:w-48"><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  )
}

function Filters() {
  const { tt, lang } = useT()
  const s = useDemo(st => st.s)
  const ui = useTimeOffUI(st => st.ui)
  const team = ui.scope === "team"
  const employees = [...new Set(s.timeOff.requests.filter(r => visibleIn(r, ui.scope, s.persona)).map(r => r.emp))]
  const datesSet = ui.from || ui.until
  const preview = (v: string) => validDate(v) ? tt("selectedDate", { date: fmtDate(v, lang, true) }) : ""
  return (
    <div className="grid grid-cols-2 items-end gap-3 sm:flex sm:flex-wrap">
      <FilterSelect id="to-filter-status" label={tt("status")} ariaLabel={tt("filter")} value={ui.filter}
        options={[["all", tt("all")], ...TO_STATUSES.map(x => [x, tt(x)] as [string, string])]} onChange={v => setFilter("filter", v)} />
      <FilterSelect id="to-filter-type" label={tt("type")} ariaLabel={tt("typeFilter")} value={ui.typeFilter}
        options={[["all", tt("allTypes")], ...eligibleTypes(s.persona).map(x => [x.id, tt(x.label)] as [string, string])]} onChange={v => setFilter("typeFilter", v)} />
      {team && (
        <FilterSelect id="to-filter-employee" label={tt("employee")} value={ui.employeeFilter}
          options={[["all", tt("allEmployees")], ...employees.map(id => [id, personName(id)] as [string, string])]} onChange={v => setFilter("employeeFilter", v)} />
      )}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn("w-full justify-start sm:w-auto", datesSet && "border-primary text-primary")}>
            <CalendarDays aria-hidden /> {tt("dates")}{datesSet ? " · 1" : ""}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 space-y-3">
          {(["from", "until"] as const).map(key => (
            <div key={key} className="space-y-1">
              <label htmlFor={`to-filter-${key}`} className="block text-sm font-medium">{tt(key === "from" ? "start" : "end")}</label>
              <Input id={`to-filter-${key}`} type="date" className="h-10" value={ui[key]} aria-describedby={`to-filter-${key}-preview`}
                onChange={e => setFilter(key, e.target.value)} />
              <p id={`to-filter-${key}-preview`} className="min-h-5 text-xs text-muted-foreground">{preview(ui[key])}</p>
            </div>
          ))}
          {datesSet && (
            <Button variant="ghost" size="sm" onClick={() => { setFilter("from", ""); setFilter("until", "") }}>{tt("clearFilters")}</Button>
          )}
        </PopoverContent>
      </Popover>
      <RefreshButton className="w-full sm:hidden" />
    </div>
  )
}

/* ---------- list ---------- */

function RequestRow({ r, team, selected }: { r: TimeOffRequest; team: boolean; selected: boolean }) {
  const { tt, lang } = useT()
  const mobile = useIsMobile()
  const primary = team ? personName(r.emp) : typeLabel(lang, r.type)
  const secondary = team ? typeLabel(lang, r.type) : r.id
  return (
    <li>
      <button
        type="button"
        id={`to-row-${r.id}`}
        onClick={() => selectRequest(r.id)}
        aria-pressed={mobile ? undefined : selected}
        aria-controls="to-request-detail"
        aria-label={[primary, r.id, fmtDateRange(r, lang), tt(r.status)].join(", ")}
        className={cn(
          "grid min-h-16 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-3 text-left outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset",
          "md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto_auto]",
          selected && !mobile ? "bg-primary-soft" : "hover:bg-muted/60 active:bg-muted",
        )}
      >
        <span className="min-w-0">
          <b className="block truncate text-[15px] font-semibold">{primary}</b>
          <small className="block truncate text-sm text-muted-foreground">{secondary}</small>
        </span>
        <span className="col-start-1 row-start-2 min-w-0 md:col-start-2 md:row-start-1">
          <b className="block truncate text-sm font-medium">{fmtDateRange(r, lang)}</b>
          <small className="block truncate text-sm text-muted-foreground">{tt(TO_DURATION[r.duration])} · {quantity(r, lang)}</small>
        </span>
        <StatusBadge status={r.status} className="col-start-2 row-span-2 row-start-1 self-center md:col-start-3 md:row-span-1" />
        <ChevronRight className="hidden size-4 text-muted-foreground md:block" aria-hidden />
      </button>
    </li>
  )
}

function Empty({ hasRequests }: { hasRequests: boolean }) {
  const { tt } = useT()
  const team = useTimeOffUI(st => st.ui.scope) === "team"
  const key = hasRequests ? "noMatches" : team ? "caughtUp" : "empty"
  const Icon = team ? Check : CalendarDays
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-muted text-muted-foreground"><Icon className="size-7" aria-hidden /></span>
      <h2 className="text-lg font-semibold">{tt(key)}</h2>
      {!hasRequests && <p className="max-w-sm text-sm text-muted-foreground">{tt(team ? "caughtUpHelp" : "emptyHelp")}</p>}
      <Button
        variant={!team && !hasRequests ? "default" : "outline"}
        onClick={hasRequests || team ? clearFilters : startRequest}
      >
        {tt(hasRequests ? "clearFilters" : team ? "viewAll" : "new")}
      </Button>
    </div>
  )
}

/* ---------- detail ---------- */

function HistoryList({ r }: { r: TimeOffRequest }) {
  const { tt, lang } = useT()
  return (
    <ol className="space-y-0">
      {[...r.history].reverse().map((h, i, all) => {
        const Icon = h.action === "Approved" ? Check : h.action === "Submitted" ? Plus : X
        const tone = h.action === "Approved" ? "bg-success-soft text-success" : h.action === "Submitted" ? "bg-warning-soft text-warning" : h.action === "Refused" ? "bg-destructive-soft text-destructive" : "bg-muted text-muted-foreground"
        return (
          <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
            {i < all.length - 1 && <span aria-hidden className="absolute top-7 bottom-0 left-[13px] w-px bg-border" />}
            <span className={cn("grid size-7 shrink-0 place-items-center rounded-full", tone)}><Icon className="size-3.5" strokeWidth={2.6} aria-hidden /></span>
            <div className="min-w-0 pt-0.5">
              <b className="block text-sm font-semibold">{h.actor === "rule" ? tt("automatic") : tt(h.action)}</b>
              <small className="block text-sm text-muted-foreground">{h.actor === "rule" ? tt(h.rule || "") : personName(h.actor)} · {fmtWhen(h.at, lang)}</small>
              {h.reason && <p className="mt-2 rounded-xl bg-muted p-3 text-sm">{h.reason}</p>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function Detail({ r }: { r: TimeOffRequest | undefined }) {
  const { tt, lang } = useT()
  const persona = useDemo(st => st.s.persona)
  const scope = useTimeOffUI(st => st.ui.scope)
  if (!r) {
    return (
      <aside className="hidden place-items-center rounded-2xl border border-dashed p-10 text-center text-muted-foreground lg:grid">
        <p>{tt("selectRequest")}</p>
      </aside>
    )
  }
  const mine = r.emp === persona
  const manager = isManager(persona) && r.manager === persona && !mine
  return (
    <aside
      id="to-request-detail"
      tabIndex={-1}
      aria-label={tt("viewRequest")}
      className="space-y-5 rounded-2xl border bg-card p-4 shadow-soft outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:p-6 lg:sticky lg:top-6"
    >
      <Button variant="ghost" className="-mt-1 -ml-3 h-10 lg:hidden" onClick={closeDetail}>
        <ChevronLeft /> {tt(scope === "team" ? "backTeam" : "back")}
      </Button>
      <header className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-sm text-muted-foreground">{r.id}</span>
          <StatusBadge status={r.status} />
        </div>
        <h2 className="text-xl font-semibold tracking-tight">{typeLabel(lang, r.type)}</h2>
        <p className="text-[15px]">{fmtDateRange(r, lang)}</p>
        <p className="text-sm text-muted-foreground">
          {tt(TO_DURATION[r.duration])} · {quantity(r, lang)}{r.duration === "Hours" && r.startTime ? ` · ${fmtClock(r.startTime, lang)}` : ""}
        </p>
      </header>
      <dl className="divide-y rounded-xl border">
        {manager && <DetailFact label={tt("employee")}>{personName(r.emp)}</DetailFact>}
        <DetailFact label={tt("manager")}>{managerName(r.manager)}</DetailFact>
        {r.status === "Submitted" && r.autoApproval && (
          <DetailFact label={<>{tt("autoDate")} <JourneyTags ids="TO-06" /></>}>{fmtWhen(r.autoApproval.at, lang)}</DetailFact>
        )}
      </dl>
      {r.note && (
        <section className="space-y-1.5">
          <h3 className="text-sm font-semibold">{tt("employeeNote")}</h3>
          <p className="text-[15px] whitespace-pre-wrap">{r.note}</p>
        </section>
      )}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">{tt("history")}</h3>
        <HistoryList r={r} />
      </section>
      {r.status === "Submitted" && (mine || manager) && (
        <footer className="sticky bottom-[calc(4.25rem+env(safe-area-inset-bottom))] -mx-4 -mb-4 flex gap-2 rounded-b-2xl border-t bg-card/95 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:-mb-6 sm:px-6 lg:static lg:bg-card">
          {mine ? (
            <>
              <Button variant="outline" size="lg" className="flex-1" onClick={() => openDecision(r.id, "cancel")}>{tt("cancelRequest")}</Button>
              <JourneyTags ids="TO-07" className="self-center" />
            </>
          ) : (
            <>
              <Button variant="outline" size="lg" className="flex-1" onClick={() => openDecision(r.id, "refuse")}>{tt("refuse")}</Button>
              <Button size="lg" className="flex-1" onClick={() => openDecision(r.id, "approve")}><Check /> {tt("approve")}</Button>
            </>
          )}
        </footer>
      )}
    </aside>
  )
}

function DetailFact({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-3">
      <dt className="flex items-center gap-1.5 text-sm text-muted-foreground">{label}</dt>
      <dd className="text-right text-[15px] font-medium">{children}</dd>
    </div>
  )
}

/* ---------- decision dialog ---------- */

function DecisionDialog() {
  const { tt, lang } = useT()
  const dialog = useTimeOffUI(st => st.ui.dialog)
  const [reason, setReason] = useState("")
  // Keep the last content while the sheet animates closed.
  const [shown, setShown] = useState(dialog)
  if (dialog && dialog !== shown) { setShown(dialog); setReason("") }
  const r = useDemo(st => (shown ? st.s.timeOff.requests.find(x => x.id === shown.id) : undefined))
  const action = shown?.action ?? "approve"
  const question = action === "cancel" ? "cancelQuestion" : action === "approve" ? "approveQuestion" : "refuseQuestion"
  const close = () => {
    const id = dialog?.id
    closeDecision()
    if (id) window.setTimeout(() => document.getElementById("to-request-detail")?.focus(), 40)
  }
  const confirmDisabled = action === "refuse" && !reason.trim()
  return (
    <ResponsivePanel
      open={!!dialog && !!r}
      onOpenChange={o => { if (!o) close() }}
      title={tt(question)}
      description={tt(action === "cancel" ? "cancelHelp" : "decisionHelp")}
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" size="lg" onClick={close}>{tt(action === "cancel" ? "keep" : "close")}</Button>
          <Button
            size="lg"
            variant={action === "refuse" || action === "cancel" ? "destructive" : "default"}
            disabled={confirmDisabled}
            onClick={() => commitDecision(reason)}
          >
            {tt(action === "cancel" ? "cancelRequest" : action)}
          </Button>
        </div>
      }
    >
      {r && (
        <div className="space-y-4">
          <p className="rounded-xl bg-muted px-4 py-3 text-[15px]">
            {action !== "cancel" && <b className="block">{personName(r.emp)}</b>}
            <span className={cn(action === "cancel" && "font-semibold")}>{typeLabel(lang, r.type)}</span> · {fmtDateRange(r, lang)}
          </p>
          {action === "refuse" && (
            <div className="space-y-1.5">
              <label htmlFor="to-reason" className="block text-sm font-medium">{tt("reason")}</label>
              <Textarea
                id="to-reason"
                rows={4}
                required
                autoFocus
                className="text-base"
                value={reason}
                aria-describedby="to-reason-help"
                onChange={e => setReason(e.target.value)}
              />
              <p id="to-reason-help" className="text-sm text-muted-foreground">{tt("reasonHelp")}</p>
            </div>
          )}
        </div>
      )}
    </ResponsivePanel>
  )
}

/* ---------- screen ---------- */

export function RequestList() {
  const s = useDemo(st => st.s)
  const ui = useTimeOffUI(st => st.ui)
  const mobile = useIsMobile()
  const { tt } = useT()
  const team = ui.scope === "team"
  const requests = filtered(s, ui)
  const scopeRequests = s.timeOff.requests.filter(r => visibleIn(r, ui.scope, s.persona))
  const current = requests.find(x => x.id === ui.selected) || requests[0]
  const caughtUp = team && ui.filter === "Submitted" && !scopeRequests.some(x => x.status === "Submitted")
  const canRequest = !team && eligibleTypes(s.persona).length > 0
  const detailOnly = mobile && ui.detailOpen && !!current

  useEffect(() => {
    if (detailOnly) window.scrollTo({ top: 0 })
  }, [detailOnly])

  if (detailOnly) {
    return (
      <>
        <Detail r={current} />
        <DecisionDialog />
      </>
    )
  }

  return (
    <div className="space-y-5">
      <Header />
      {isManager(s.persona) && <ScopeSwitch />}
      <Notices />
      <Filters />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(340px,1fr)] lg:items-start">
        <section aria-label={tt(team ? "team" : "my")} className="overflow-hidden rounded-2xl border bg-card shadow-soft">
          {requests.length ? (
            <>
              <div aria-hidden className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto_auto] gap-x-3 border-b bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground md:grid">
                <span>{tt(team ? "employee" : "request")}</span>
                <span>{tt("dates")}</span>
                <span>{tt("status")}</span>
                <span className="w-4" />
              </div>
              <ul className="divide-y">
                {requests.map(x => <RequestRow key={x.id} r={x} team={team} selected={x.id === current?.id} />)}
              </ul>
            </>
          ) : (
            <Empty hasRequests={!caughtUp && scopeRequests.length > 0} />
          )}
        </section>
        <div className="hidden lg:block"><Detail r={current} /></div>
      </div>
      {canRequest && (
        <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-10 sm:hidden">
          <Button size="lg" className="w-full shadow-raised" onClick={startRequest}><Plus /> {tt("new")}</Button>
        </div>
      )}
      <DecisionDialog />
    </div>
  )
}
