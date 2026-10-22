import { ArrowRightLeft } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Highlightable, JourneyTags } from "@/components/app/common"
import { StatusPill } from "@/components/app/status"
import { LABOR, PROJECTS, laborTaskName } from "@/data/reference-data"
import { fmtClock, fmtDay, fmtH, parseYmd, todayStr, tsTime } from "@/lib/dates"
import { laborDefaults, type Day, type Segment } from "@/lib/engine"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import type { Labor, Punch } from "@/store/types"

interface DetailsProps {
  title: string
  rows: [string, string][]
  labor: Partial<Labor>
}

function Details({ title, rows, labor }: DetailsProps) {
  const fields = [labor.project && (LABOR.opts.proj.find(x => x.v === labor.project)?.l || labor.project), laborTaskName(labor.task), labor.tc, labor.func].filter(Boolean)
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="rounded-xl bg-muted px-3 py-2.5 text-sm">
        <div className="mb-0.5 text-xs font-medium text-muted-foreground">Labor category</div>
        {fields.length ? fields.join(", ") : <span className="text-muted-foreground">No labor category recorded.</span>}
      </div>
    </div>
  )
}

function Cell({ children, details, className, label }: { children: React.ReactNode; details: DetailsProps; className?: string; label: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className={cn("flex min-h-11 w-full items-center gap-1.5 rounded-lg px-2.5 text-left tabular-nums transition-colors hover:bg-primary-soft data-[state=open]:bg-primary-soft data-[state=open]:ring-2 data-[state=open]:ring-ring/40", className)}
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 rounded-2xl p-4 shadow-raised">
        <Details {...details} />
      </PopoverContent>
    </Popover>
  )
}

export function ClassicTimecard({ emp, days, locked }: { emp: string; days: Day[]; locked: boolean }) {
  const { lang, t } = useT()
  const today = todayStr()
  const punchLabel = (p: Punch) => ({ IN: t("punchIn"), OUT: t("punchOut"), XFER: t("transfer"), BRK_S: t("startBreak"), BRK_E: t("endBreak") }[p.type] || p.type)

  const rows = days.flatMap(d => {
    const segs: (Segment | null)[] = d.segs.length ? d.segs : [null]
    const codes = new Set(d.exc.map(e => e.code))
    const dow = parseYmd(d.date).getDay(), weekend = dow === 0 || dow === 6, isToday = d.date === today
    return segs.map((s, i) => {
      const first = i === 0, last = i === segs.length - 1
      const inP = s?.in.p, outP = s?.out?.p
      const labor = (s && (s.labor || laborDefaults(emp))) || {}
      const lob = labor.task ? laborTaskName(labor.task) : ""
      const exceptionsFor = (p: Punch) => d.exc.filter(x => x.pid === p.id || (!x.pid && x.code === "UNSCHEDULED")).map(x => t(x.label))
      const punchDetails = (p: Punch): DetailsProps => ({
        title: "Punch details",
        rows: [["Date", fmtDay(d.date, lang)], ["Time", fmtClock(tsTime(p.t), lang)], ["Punch", punchLabel(p)], ...(exceptionsFor(p).length ? [["Exceptions", exceptionsFor(p).join(", ")] as [string, string]] : [])],
        labor,
      })
      const warnIn = s && ((first && codes.has("LATE_IN")) || d.exc.some(e => e.code === "SHORT_BREAK" && e.pid === inP?.id))
      const warnOut = s && last && outP && d.exc.some(e => e.code === "EARLY_OUT" && e.pid === outP.id)
      const transferLabel = [s?.proj, s?.task, lob && lob !== s?.task ? lob : ""].filter(Boolean).join(" · ") || t("noProject")
      return (
        <tr
          key={`${d.date}-${i}`}
          className={cn(
            "border-b border-border/70 last:border-b-0",
            first && "border-t border-t-border",
            weekend && "bg-muted/40",
            isToday && "bg-primary-soft/50",
          )}
        >
          <th scope="row" className={cn("sticky left-0 z-10 w-36 px-3 py-1 text-left align-middle font-medium whitespace-nowrap", isToday ? "bg-[color-mix(in_oklab,var(--primary-soft)_50%,var(--card))]" : weekend ? "bg-[color-mix(in_oklab,var(--muted)_40%,var(--card))]" : "bg-card")}>
            {first && (
              <span className="flex items-center gap-2">
                {fmtDay(d.date, lang)}
                {isToday && <span className="size-1.5 rounded-full bg-primary" aria-label={t("today")} />}
              </span>
            )}
          </th>
          <td className="px-1 py-1">
            {s && inP && (
              <Cell label={`${punchLabel(inP)} ${fmtClock(s.in.t, lang)}. Open punch details`} details={punchDetails(inP)} className={cn(warnIn && "bg-warning-soft text-warning")}>
                {fmtClock(s.in.t, lang)}
                {s.in.kind === "Break end" && <span className="text-xs text-muted-foreground">(brk)</span>}
              </Cell>
            )}
          </td>
          <td className="px-1 py-1">
            {s && (
              <Cell
                label={`Transfer details: ${transferLabel}`}
                details={{
                  title: "Transfer details",
                  rows: [["Date", fmtDay(d.date, lang)], ["Time", `${fmtClock(s.in.t, lang)} – ${s.out ? fmtClock(s.out.t, lang) : s.live ? "In progress" : t("missed")}`], ["Project", [s.proj, s.proj && PROJECTS[s.proj]?.name].filter(Boolean).join(" · ") || t("noProject")], ...(s.task ? [["Task", s.task] as [string, string]] : [])],
                  labor,
                }}
              >
                {s.in.kind === "Transfer" && <ArrowRightLeft className="size-3.5 shrink-0 text-primary" aria-hidden />}
                <span className="truncate">{transferLabel}</span>
              </Cell>
            )}
          </td>
          <td className="px-1 py-1">
            {s && (s.live ? (
              <StatusPill tone="success" className="ml-2">In progress</StatusPill>
            ) : s.missing ? (
              <StatusPill tone="danger" className="ml-2">{t("missed")}</StatusPill>
            ) : s.out && outP ? (
              <Cell label={`${punchLabel(outP)} ${fmtClock(s.out.t, lang)}. Open punch details`} details={punchDetails(outP)} className={cn(warnOut && "bg-warning-soft text-warning")}>
                {fmtClock(s.out.t, lang)}
                {s.out.kind === "Break" && <span className="text-xs text-muted-foreground">(brk)</span>}
              </Cell>
            ) : null)}
          </td>
          <td className="px-3 py-1 text-right tabular-nums">{s && s.hours ? fmtH(s.hours, lang) : ""}</td>
          <td className="px-3 py-1 text-right font-medium tabular-nums">{last && d.daily ? fmtH(d.daily, lang) : ""}</td>
          <td className="px-3 py-1 text-right text-muted-foreground tabular-nums">{last && d.cum && d.date <= today ? fmtH(d.cum, lang) : ""}</td>
        </tr>
      )
    })
  })

  return (
    <Highlightable hl="timecard-grid">
      <ClassicDayList days={days} />
      <div className="hidden overflow-hidden rounded-2xl border bg-card shadow-soft sm:block">
      <div className="overflow-x-auto">
        <table className={cn("w-full min-w-[760px] border-collapse text-sm", locked && "[&_button]:cursor-default")}>
          <thead className="bg-muted/60 text-left text-xs font-medium text-muted-foreground">
            <tr>
              <th scope="col" className="sticky left-0 z-10 bg-muted px-3 py-3">{t("date")}</th>
              <th scope="col" className="px-3 py-3">{t("in")}</th>
              <th scope="col" className="px-3 py-3">{t("transfer")} ({t("project")} / {t("task")}) <JourneyTags ids="TC-03" /></th>
              <th scope="col" className="px-3 py-3">{t("out")}</th>
              <th scope="col" className="px-3 py-3 text-right">{t("hours")}</th>
              <th scope="col" className="px-3 py-3 text-right">{t("daily")}</th>
              <th scope="col" className="px-3 py-3 text-right">{t("cum")}</th>
            </tr>
          </thead>
          <tbody>{rows}</tbody>
        </table>
      </div>
      </div>
    </Highlightable>
  )
}

/** Phones: the same punch segments as a day-grouped list, so nothing scrolls sideways. */
function ClassicDayList({ days }: { days: Day[] }) {
  const { lang, t } = useT()
  const today = todayStr()
  return (
    <ol className="space-y-3 sm:hidden">
      {days.map(d => (
        <li key={d.date} className={cn("overflow-hidden rounded-2xl border bg-card shadow-soft", d.date === today && "border-primary/50")}>
          <div className="flex items-center justify-between gap-3 border-b bg-muted/50 px-4 py-2.5">
            <span className="flex items-center gap-2 font-semibold">
              {fmtDay(d.date, lang)}
              {d.date === today && <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground">{t("today")}</span>}
            </span>
            <span className="text-sm font-semibold tabular-nums">{d.daily ? `${fmtH(d.daily, lang)} h` : "—"}</span>
          </div>
          {d.segs.length ? (
            <ul className="divide-y">
              {d.segs.map((s, i) => (
                <li key={i} className="flex items-start gap-3 px-4 py-3">
                  <div className="flex w-[78px] shrink-0 flex-col text-sm font-medium tabular-nums">
                    <span>{fmtClock(s.in.t, lang)}</span>
                    {s.out ? <span className="text-muted-foreground">{fmtClock(s.out.t, lang)}</span> : <span className={s.live ? "text-success" : "text-destructive"}>{s.live ? "now" : t("missed")}</span>}
                  </div>
                  <div className="min-w-0 flex-1 text-sm">
                    <div className="flex items-center gap-1.5 font-medium">
                      {s.in.kind === "Transfer" && <ArrowRightLeft className="size-3.5 shrink-0 text-primary" aria-hidden />}
                      <span className="truncate">{s.proj ? `${s.proj} · ${PROJECTS[s.proj]?.name || ""}` : t("noProject")}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">{[s.task, s.in.kind === "Break end" ? "after break" : s.in.kind === "Transfer" ? t("transfer") : ""].filter(Boolean).join(" · ")}</div>
                  </div>
                  <div className="shrink-0 text-sm tabular-nums text-muted-foreground">{s.hours ? `${fmtH(s.hours, lang)} h` : ""}</div>
                </li>
              ))}
            </ul>
          ) : <p className="px-4 py-3 text-sm text-muted-foreground">{d.sched && d.date < today ? t("absent") : "No punches"}</p>}
          {d.exc.length > 0 && (
            <div className="flex flex-wrap gap-1.5 border-t px-4 py-2.5">
              {[...new Set(d.exc.map(e => e.label))].map(l => <StatusPill key={l} tone={d.exc.find(e => e.label === l)?.sev === "err" ? "danger" : "warning"}>{t(l)}</StatusPill>)}
            </div>
          )}
        </li>
      ))}
    </ol>
  )
}

/** Hours by project and task for the period (TC-07). */
export function TimecardTotals({ days }: { days: Day[] }) {
  const { lang, t } = useT()
  const by = new Map<string, number>()
  days.forEach(d => d.segs.forEach(s => {
    if (!s.hours) return
    const k = `${s.proj || ""}|${s.task || ""}`
    by.set(k, (by.get(k) || 0) + s.hours)
  }))
  const total = days[6]?.cum || 0
  return (
    <Highlightable hl="totals" className="rounded-2xl border bg-card p-5 shadow-soft">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold">{t("totals")} <JourneyTags ids="TC-07" /></h2>
        <span className="text-sm text-muted-foreground">Project hours by project and task</span>
      </div>
      <ul className="divide-y">
        {[...by.entries()].map(([k, v]) => {
          const [p, task] = k.split("|")
          return (
            <li key={k} className="flex items-center justify-between gap-4 py-2.5 text-sm">
              <span className="min-w-0">
                <span className="font-medium">{p || t("noProject")}</span>
                {PROJECTS[p] && <span className="text-muted-foreground"> · {PROJECTS[p].name}</span>}
                {task && <span className="block text-muted-foreground">{task}</span>}
              </span>
              <span className="tabular-nums">{fmtH(v, lang)}</span>
            </li>
          )
        })}
        {!by.size && <li className="py-3 text-sm text-muted-foreground">No hours in this period.</li>}
      </ul>
      <div className="mt-1 flex items-center justify-between border-t pt-3 text-[15px] font-semibold">
        <span>{t("total")}</span>
        <span className="tabular-nums">{fmtH(total, lang)}</span>
      </div>
    </Highlightable>
  )
}
