import { useMemo, useState } from "react"
import { Copy, Eye, EyeOff, Plus, RotateCcw, Search } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Highlightable, JourneyTags } from "@/components/app/common"
import { ResponsivePanel } from "@/components/app/responsive-panel"
import { MetaTag, Notice, StatusPill } from "@/components/app/status"
import { PERSONAS, PROJECTS, type PersonaId } from "@/data/reference-data"
import { fmtDay, fmtH, fmtWeekday, parseYmd, todayStr } from "@/lib/dates"
import {
  assigned, breakMinutes, derivedEntry, entryHours, HIDE_AHEAD_DAYS, isHidden, laborDefaults, laborParts, projectsOnDay, type Day,
} from "@/lib/engine"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { useDemo } from "@/store/store"
import type { DemoState, ModernEntry } from "@/store/types"
import { isPunchBased, PunchDay } from "./punch-day"

/** The entry shown for a project on a day: what the employee typed, else what the punches imply. */
function effectiveEntry(s: DemoState, emp: string, day: Day, code: string): { entry: ModernEntry; edited: boolean } {
  const typed = s.modern[emp]?.[day.date]?.[code]
  const derived = derivedEntry(day, code)
  return typed ? { entry: { ...derived, ...typed }, edited: true } : { entry: derived, edited: false }
}

function dayProjects(s: DemoState, emp: string, day: Day) {
  return [...new Set([...projectsOnDay(day), ...assigned(s, emp)])].filter(c => PROJECTS[c])
}

function dayHours(s: DemoState, emp: string, day: Day) {
  return dayProjects(s, emp, day)
    .filter(c => !isHidden(s, emp, c))
    .reduce((a, c) => a + (entryHours(effectiveEntry(s, emp, day, c).entry) || 0), 0)
}

function TimeField({ id, label, value, onChange, disabled, invalid }: { id: string; label: string; value: string; onChange: (v: string) => void; disabled?: boolean; invalid?: boolean }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">{label}</label>
      <Input
        id={id}
        type="time"
        value={value}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        onChange={e => onChange(e.target.value)}
        className="h-11 text-base tabular-nums"
      />
    </div>
  )
}

function ProjectCard({ emp, day, code, disabled }: { emp: string; day: Day; code: string; disabled: boolean }) {
  const s = useDemo(st => st.s)
  const setEntry = useDemo(st => st.setModernEntry)
  const setHidden = useDemo(st => st.setProjectHidden)
  const mutate = useDemo(st => st.mutate)
  const { lang, at, t } = useT()
  const p = PROJECTS[code]
  const { entry, edited } = effectiveEntry(s, emp, day, code)
  const derived = derivedEntry(day, code)
  const hours = entryHours(entry)
  const brk = breakMinutes(entry.brk)
  const filled = !!(entry.start || entry.end)
  const timeInvalid = filled && (!entry.start || !entry.end)
  const orderInvalid = !!entry.start && !!entry.end && hours === null && !Number.isNaN(brk)
  const seg = day.segs.find(x => x.proj === code)
  const lp = laborParts(seg?.labor || laborDefaults(emp))
  const idBase = `${day.date}-${code}`
  const update = (patch: Partial<ModernEntry>) => setEntry(day.date, code, patch, derived)

  return (
    <li className="rounded-2xl border bg-card p-4 shadow-soft transition-shadow sm:p-5">
      <div className="flex items-start gap-3">
        <span className={cn("mt-2 size-2 shrink-0 rounded-full", hours ? "bg-success" : "bg-input")} aria-hidden />
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] leading-snug font-semibold">
            <span className="tabular-nums">{code}</span> · {p.name}
          </h3>
          <p className="truncate text-sm text-muted-foreground">{[p.client, p.show !== "—" && p.show].filter(Boolean).join(" · ")}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <StatusPill tone={p.active ? "success" : "neutral"} icon={false}>{p.active ? "Active" : "Completed"}</StatusPill>
            {seg?.task && <MetaTag>{t("task")}: {seg.task}</MetaTag>}
            {lp.title !== "—" && <MetaTag>{lp.title}</MetaTag>}
          </div>
        </div>
        <label className="flex shrink-0 flex-col items-center gap-0.5 text-[11px] font-medium text-muted-foreground sm:flex-row-reverse sm:gap-2 sm:text-sm sm:text-foreground">
          <span>{at("show")}</span>
          <Switch checked aria-label={`${at("showOnTimecard")}: ${code}`} onCheckedChange={() => { setHidden(code, true); toast(`${code} hidden from your timecard.`, { action: { label: "Undo", onClick: () => setHidden(code, false) } }) }} />
        </label>
      </div>

      <fieldset disabled={disabled} className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <legend className="sr-only">{code} · {fmtDay(day.date, lang)}</legend>
        <TimeField id={`${idBase}-start`} label={at("start")} value={entry.start} onChange={v => update({ start: v })} invalid={timeInvalid && !entry.start} />
        <TimeField id={`${idBase}-end`} label={at("end")} value={entry.end} onChange={v => update({ end: v })} invalid={(timeInvalid && !entry.end) || orderInvalid} />
        <div className="col-span-2 space-y-1.5 sm:col-span-1">
          <span className="text-xs font-medium text-muted-foreground" id={`${idBase}-hours`}>{at("hours")}</span>
          <output aria-labelledby={`${idBase}-hours`} className="flex h-11 items-center rounded-lg bg-muted px-3 text-base font-semibold tabular-nums">
            {hours !== null ? fmtH(hours, lang) : "—"}
          </output>
        </div>
      </fieldset>

      <div className="mt-3 flex min-h-6 flex-wrap items-center justify-between gap-2 text-xs">
        {orderInvalid ? (
          <p className="font-medium text-destructive" role="alert">{at("endBeforeStart")}</p>
        ) : timeInvalid ? (
          <p className="font-medium text-warning">{at("invalidTime")}</p>
        ) : (
          <p className="text-muted-foreground">{edited ? "Edited" : derived.start ? "From your punches" : at("noEntry")}</p>
        )}
        {edited && !disabled && (
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 font-medium text-primary hover:bg-primary-soft"
            onClick={() => mutate(x => { delete x.modern[emp]?.[day.date]?.[code] })}
          >
            <RotateCcw className="size-3.5" aria-hidden /> {derived.start ? "Reset to punches" : "Clear"}
          </button>
        )}
      </div>
    </li>
  )
}

function AddProjectPanel({ open, onOpenChange, emp }: { open: boolean; onOpenChange: (v: boolean) => void; emp: string }) {
  const s = useDemo(st => st.s)
  const setHidden = useDemo(st => st.setProjectHidden)
  const addOdoo = useDemo(st => st.addOdooProject)
  const { at } = useT()
  const [q, setQ] = useState("")
  const hidden = assigned(s, emp).filter(c => isHidden(s, emp, c))
  const inList = new Set(assigned(s, emp))
  const query = q.trim().toLocaleLowerCase()
  const catalog = Object.entries(PROJECTS).filter(([code, p]) =>
    p.active && (p.startIn || 0) <= HIDE_AHEAD_DAYS && !inList.has(code) &&
    (!query || [code, p.name, p.client, p.show].join(" ").toLocaleLowerCase().includes(query)))
  return (
    <ResponsivePanel open={open} onOpenChange={onOpenChange} title={at("addProject")} description="Show one of your hidden projects, or add an active project from Odoo.">
      <div className="space-y-6">
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">{at("hidden")} ({hidden.length})</h3>
          {hidden.length ? (
            <ul className="divide-y rounded-2xl border">
              {hidden.map(code => (
                <li key={code} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1 text-sm">
                    <div className="font-medium">{code} · {PROJECTS[code].name}</div>
                    <div className="truncate text-muted-foreground">{PROJECTS[code].client}{PROJECTS[code].startIn ? ` · Starts in ${PROJECTS[code].startIn} days` : ""}</div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => { setHidden(code, false); toast.success(`${code} is on your timecard.`) }}><Eye /> Show</Button>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted-foreground">Nothing is hidden.</p>}
        </section>
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Odoo catalog</h3>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Project, client, or event" aria-label="Search Odoo projects" className="pl-9" />
          </div>
          <ul className="divide-y rounded-2xl border">
            {catalog.map(([code, p]) => (
              <li key={code} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1 text-sm">
                  <div className="font-medium">{code} · {p.name}</div>
                  <div className="truncate text-muted-foreground">{p.client}{p.show !== "—" ? ` · ${p.show}` : ""}</div>
                </div>
                <Button size="sm" onClick={() => { if (addOdoo(code)) { setHidden(code, false); toast.success(`${code} added to your projects.`) } }}><Plus /> Add</Button>
              </li>
            ))}
            {!catalog.length && <li className="px-4 py-3 text-sm text-muted-foreground">{q ? "No active projects match your search." : "No other active projects in the demo catalog."}</li>}
          </ul>
        </section>
      </div>
    </ResponsivePanel>
  )
}

export function ModernTimecard({ emp, days, locked }: { emp: string; days: Day[]; locked: boolean }) {
  const s = useDemo(st => st.s)
  const setHidden = useDemo(st => st.setProjectHidden)
  const mutate = useDemo(st => st.mutate)
  const { lang, at, t } = useT()
  const today = todayStr()
  // Open on today when it has time; otherwise on the latest day that does, so the first view is never blank.
  const initial = useMemo(() => {
    const withTime = days.filter(d => d.date <= today && dayHours(s, emp, d) > 0)
    if (withTime.some(d => d.date === today)) return today
    return withTime.at(-1)?.date || days.find(d => d.date === today)?.date || days[0].date
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [selected, setSelected] = useState(initial)
  const [showHidden, setShowHidden] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const day = days.find(d => d.date === selected) || days[0]
  // Punch-based staff see their punches as UKG records them: read-only, same totals as Classic.
  const punch = isPunchBased(emp)
  const future = day.date > today
  const disabled = locked || future

  const codes = dayProjects(s, emp, day)
  const shown = codes.filter(c => !isHidden(s, emp, c))
  const hidden = codes.filter(c => isHidden(s, emp, c))
  // Completed projects drop off the active list; "Show completed" brings them back for reference.
  const completed = (PERSONAS[emp as PersonaId].projects || []).filter(c => PROJECTS[c] && !PROJECTS[c].active && !codes.includes(c))
  const tucked = [...hidden, ...completed]
  const hoursByDay = useMemo(() => new Map(days.map(d => [d.date, punch ? d.daily : dayHours(s, emp, d)])), [days, s, emp, punch])
  const weekTotal = [...hoursByDay.values()].reduce((a, b) => a + b, 0)
  const selectedTotal = hoursByDay.get(day.date) || 0
  const prevDay = days[days.indexOf(day) - 1]

  const copyPrevious = () => {
    if (!prevDay) return
    let n = 0
    mutate(x => {
      shown.forEach(code => {
        const { entry } = effectiveEntry(x as DemoState, emp, prevDay, code)
        if (!entryHours(entry)) return
        x.modern[emp] ||= {}
        x.modern[emp][day.date] ||= {}
        x.modern[emp][day.date][code] = { ...entry }
        n++
      })
    })
    if (n) toast.success(at("copiedProjects", { n, day: fmtDay(prevDay.date, lang) }))
    else toast(at("copyNoneFrom", { day: fmtDay(prevDay.date, lang) }))
  }

  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="Day" className="flex gap-1 sm:gap-2">
        {days.map(d => {
          const on = d.date === day.date, h = hoursByDay.get(d.date) || 0, weekend = [0, 6].includes(parseYmd(d.date).getDay())
          return (
            <button
              key={d.date}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setSelected(d.date)}
              className={cn(
                "flex min-w-0 flex-1 snap-start flex-col items-center gap-0.5 rounded-2xl border px-0.5 py-2 transition-colors duration-150 sm:px-2 sm:py-2.5",
                on ? "border-primary bg-primary text-primary-foreground shadow-soft" : "bg-card hover:bg-muted",
                !on && weekend && "bg-muted/50",
              )}
            >
              <span className={cn("text-xs font-medium", on ? "text-primary-foreground/80" : "text-muted-foreground")}>{fmtWeekday(d.date, lang)}</span>
              <span className="text-lg leading-6 font-semibold tabular-nums">{parseYmd(d.date).getDate()}</span>
              <span className={cn("text-[11px] tabular-nums sm:text-xs", on ? "text-primary-foreground/90" : h ? "text-foreground" : "text-muted-foreground")}>{h ? fmtH(h, lang) : "—"}</span>
              {d.date === today && <span className={cn("mt-0.5 size-1 rounded-full", on ? "bg-citron" : "bg-primary")} aria-label={t("today")} />}
            </button>
          )
        })}
      </div>

      <Highlightable hl="timecard-grid" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-0.5">
            <h2 className="flex items-center gap-2 text-lg font-semibold">{at("assignedProjects")} <JourneyTags ids="TC-01,TC-03" /></h2>
            {!punch && <p className="text-sm text-muted-foreground">{at("assignedHelp")}</p>}
          </div>
          {!punch && <div className="no-scrollbar -mx-4 flex w-[calc(100%+2rem)] gap-2 overflow-x-auto px-4 sm:mx-0 sm:w-auto sm:flex-wrap sm:overflow-visible sm:px-0 [&>*]:shrink-0">
            {tucked.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => setShowHidden(v => !v)} aria-expanded={showHidden}>
                {showHidden ? <EyeOff /> : <Eye />} {showHidden ? at("hideHidden") : at("showHidden", { n: tucked.length })}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={copyPrevious} disabled={disabled || !prevDay}><Copy /> {at("copyYesterday")}</Button>
            <Button size="sm" onClick={() => setAddOpen(true)}><Plus /> {at("addProject")}</Button>
          </div>}
        </div>

        {!punch && future && <Notice tone="neutral">This day is in the future. Time can be entered once the day starts.</Notice>}
        {locked && <Notice tone="success">This timecard is approved and read-only.</Notice>}

        {punch ? <PunchDay day={day} emp={emp} /> : shown.length ? (
          <ul className="space-y-3">
            {shown.map(code => <ProjectCard key={code} emp={emp} day={day} code={code} disabled={disabled} />)}
          </ul>
        ) : (
          <div className="rounded-2xl border border-dashed bg-card px-6 py-10 text-center">
            <h3 className="font-semibold">{at("noProjectsShown")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{at("noProjectsShownHelp")}</p>
            <Button className="mt-4" onClick={() => setAddOpen(true)}><Plus /> {at("addProject")}</Button>
          </div>
        )}

        {!punch && showHidden && tucked.length > 0 && (
          <ul className="divide-y rounded-2xl border bg-card/60">
            {completed.map(code => (
              <li key={code} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1 text-sm">
                  <div className="font-medium text-muted-foreground">{code} · {PROJECTS[code].name}</div>
                  <div className="text-xs text-muted-foreground">{PROJECTS[code].client}</div>
                </div>
                <StatusPill tone="neutral" icon={false}>Completed</StatusPill>
              </li>
            ))}
            {hidden.map(code => {
              const h = entryHours(effectiveEntry(s, emp, day, code).entry)
              return (
                <li key={code} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1 text-sm">
                    <div className="font-medium text-muted-foreground">{code} · {PROJECTS[code].name}</div>
                    <div className="text-xs text-muted-foreground">{h ? `${fmtH(h, lang)} h recorded · not counted while hidden` : PROJECTS[code].startIn ? `Starts in ${PROJECTS[code].startIn} days` : at("hidden")}</div>
                  </div>
                  <Switch checked={false} aria-label={`${at("showOnTimecard")}: ${code}`} onCheckedChange={() => setHidden(code, false)} />
                </li>
              )
            })}
          </ul>
        )}
      </Highlightable>

      <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 lg:bottom-4">
        {/* The selected day and the week, compact enough to stay one line on phones. */}
        <div className="flex items-center gap-3 rounded-2xl border bg-card/95 px-4 py-2.5 shadow-raised backdrop-blur-md sm:gap-5 sm:py-3">
          <div className="shrink-0">
            <div className="text-xs text-muted-foreground">{fmtDay(day.date, lang)}</div>
            <div className="text-lg leading-tight font-semibold tabular-nums">{fmtH(selectedTotal, lang)} <span className="text-sm font-medium text-muted-foreground">h</span></div>
          </div>
          <span className="h-9 w-px shrink-0 bg-border" aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="text-xs text-muted-foreground">{at("weekTotal")}</div>
            <div className="text-lg leading-tight font-semibold tabular-nums">{fmtH(weekTotal, lang)} <span className="text-sm font-medium text-muted-foreground">h</span></div>
          </div>
          {!punch && <p className="hidden max-w-48 text-right text-xs text-muted-foreground md:block">{at("autosaveDraft")}</p>}
        </div>
      </div>

      <AddProjectPanel open={addOpen} onOpenChange={setAddOpen} emp={emp} />
    </div>
  )
}
