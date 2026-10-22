import { useEffect, useMemo, useState } from "react"
import { Copy, Eye, EyeOff, Plus, Save, SlidersHorizontal } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Highlightable, JourneyTags, PageHeader } from "@/components/app/common"
import { LayoutToggle } from "@/components/app/layout-toggle"
import { MetaTag, Notice, StatusPill, rowTone } from "@/components/app/status"
import { WeekNav } from "@/components/app/week-nav"
import { PERSONAS, PROJECTS } from "@/data/reference-data"
import { fmtClock, fmtDay, fmtDayShort, fmtH, fmtWeekday, hm, parseYmd, periodDays, periodKey, todayStr } from "@/lib/dates"
import { assigned, gridValidate, gridWeekOf, hiddenCount, isHidden, num, rowTotal, type GridValidation } from "@/lib/engine"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { useDemo } from "@/store/store"
import type { GridRow } from "@/store/types"
import { AddRowPanel, ManageProjectsPanel } from "./panels"

interface RowProps {
  row: GridRow
  days: string[]
  editable: boolean
  v: GridValidation
  onHours: (rowId: string, i: number, value: string) => void
}

function HoursInput({ row, i, days, editable, v, onHours, className }: RowProps & { i: number; className?: string }) {
  const { lang, t } = useT()
  const bad = v.bad.has(`${row.id}:${i}`) || (v.dayBad.has(i) && row.h[i] !== "")
  return (
    <input
      inputMode="decimal"
      autoComplete="off"
      value={row.h[i]}
      disabled={!editable}
      aria-invalid={bad || undefined}
      aria-label={`${row.proj} ${fmtDay(days[i], lang)} ${t("hours")}`}
      placeholder="0"
      onChange={e => onHours(row.id, i, e.target.value)}
      onFocus={e => e.target.select()}
      className={cn(
        "h-11 w-full min-w-0 rounded-lg border border-input bg-card px-1 text-center text-base tabular-nums transition-colors outline-none placeholder:text-muted-foreground",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40",
        "disabled:border-transparent disabled:bg-muted/60 disabled:text-muted-foreground",
        days[i] === todayStr() && "border-primary/50",
        bad && "border-destructive bg-destructive-soft text-destructive",
        className,
      )}
    />
  )
}

function TaskSelect({ row, editable, invalid }: { row: GridRow; editable: boolean; invalid: boolean }) {
  const setTask = useDemo(st => st.setGridTask)
  const { t } = useT()
  const p = PROJECTS[row.proj]
  if (p.tasks.length < 2 && !p.taskReq) return row.task ? <MetaTag>{t("task")}: {row.task}</MetaTag> : null
  return (
    <Select value={row.task} onValueChange={v => setTask(row.id, v)} disabled={!editable}>
      <SelectTrigger size="sm" aria-label={`${row.proj} ${t("task")}`} aria-invalid={invalid || undefined} className="h-8 max-w-full rounded-md text-xs data-[size=sm]:h-8">
        <SelectValue placeholder={`Choose a ${t("task").toLowerCase()}`} />
      </SelectTrigger>
      <SelectContent>{p.tasks.map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
    </Select>
  )
}

function ClassicGrid({ rows, days, editable, v, onHours, showWeekend }: { rows: GridRow[]; days: string[]; editable: (r: GridRow) => boolean; v: GridValidation; onHours: RowProps["onHours"]; showWeekend: boolean }) {
  const { lang, t, at } = useT()
  const cols = days.map((d, i) => ({ d, i })).filter(({ i }) => showWeekend || i < 5)
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead className="bg-muted/60 text-xs font-medium text-muted-foreground">
            <tr>
              <th scope="col" className="sticky left-0 z-10 min-w-56 bg-muted px-4 py-3 text-left">{t("project")}</th>
              {cols.map(({ d }) => (
                <th key={d} scope="col" className={cn("px-1.5 py-3 text-center", d === todayStr() && "text-primary")}>
                  {fmtWeekday(d, lang)} <span className="tabular-nums">{parseYmd(d).getDate()}</span>
                </th>
              ))}
              <th scope="col" className="px-4 py-3 text-right">{at("total")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} data-row={r.id} className={cn("border-t", r.status === "Rejected" && "bg-destructive-soft/40")}>
                <th scope="row" className="sticky left-0 z-10 bg-card px-4 py-2.5 text-left align-top font-normal">
                  <div className="font-medium">{r.proj} <span className="font-normal text-muted-foreground">{PROJECTS[r.proj].name}</span></div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <TaskSelect row={r} editable={editable(r)} invalid={v.badTask.has(r.id)} />
                    {r.status !== "Draft" && <StatusPill tone={rowTone(r.status)}>{r.status}</StatusPill>}
                  </div>
                  {r.note && <p className="mt-1.5 text-xs text-destructive"><b>Note from approver:</b> {r.note}</p>}
                </th>
                {cols.map(({ i }) => (
                  <td key={i} className="px-1 py-2.5 align-top">
                    <HoursInput row={r} i={i} days={days} editable={editable(r)} v={v} onHours={onHours} />
                  </td>
                ))}
                <td className="px-4 py-2.5 text-right align-top font-semibold tabular-nums"><span className="inline-flex h-11 items-center">{fmtH(rowTotal(r.h), lang)}</span></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={cols.length + 2} className="px-4 py-6 text-center text-muted-foreground">No rows. Choose Add project to start.</td></tr>}
          </tbody>
          <tfoot className="border-t bg-muted/40 text-sm font-medium">
            <tr>
              <th scope="row" className="sticky left-0 z-10 bg-muted px-4 py-3 text-left">{at("dayTotal")}</th>
              {cols.map(({ i }) => (
                <td key={i} className={cn("px-1 py-3 text-center tabular-nums", v.dayBad.has(i) && "text-destructive")}>{fmtH(v.dayTot[i], lang)}</td>
              ))}
              <td className="px-4 py-3 text-right font-semibold tabular-nums">{fmtH(v.dayTot.reduce((a, b) => a + b, 0), lang)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

function ModernCards({ rows, days, editable, v, onHours, showWeekend }: { rows: GridRow[]; days: string[]; editable: (r: GridRow) => boolean; v: GridValidation; onHours: RowProps["onHours"]; showWeekend: boolean }) {
  const setHidden = useDemo(st => st.setProjectHidden)
  const { lang, at } = useT()
  const idx = days.map((_, i) => i).filter(i => showWeekend || i < 5)
  return (
    <ul className="space-y-3">
      {rows.map(r => {
        const p = PROJECTS[r.proj], total = rowTotal(r.h), ed = editable(r)
        return (
          <li key={r.id} data-row={r.id} className={cn("rounded-2xl border bg-card p-4 shadow-soft sm:p-5", r.status === "Rejected" && "border-destructive/40")}>
            <div className="flex items-start gap-3">
              <span className={cn("mt-2 size-2 shrink-0 rounded-full", total ? "bg-success" : "bg-input")} aria-hidden />
              <div className="min-w-0 flex-1">
                <h3 className="text-[15px] leading-snug font-semibold"><span className="tabular-nums">{r.proj}</span> · {p.name}</h3>
                <p className="truncate text-sm text-muted-foreground">{[p.client, p.show !== "—" && p.show].filter(Boolean).join(" · ")}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <StatusPill tone={rowTone(r.status)}>{r.status}</StatusPill>
                  <TaskSelect row={r} editable={ed} invalid={v.badTask.has(r.id)} />
                </div>
              </div>
              <label className="flex shrink-0 flex-col items-center gap-0.5 text-[11px] font-medium text-muted-foreground sm:flex-row-reverse sm:gap-2 sm:text-sm sm:text-foreground">
                <span>{at("show")}</span>
                <Switch
                  checked
                  aria-label={`${at("showOnTimecard")}: ${r.proj}`}
                  onCheckedChange={() => {
                    setHidden(r.proj, true)
                    toast(total ? `${r.proj} hidden from your list. Its hours stay on the timecard.` : `${r.proj} hidden from your timecard.`, { action: { label: "Undo", onClick: () => setHidden(r.proj, false) } })
                  }}
                />
              </label>
            </div>
            {r.note && <Notice tone="danger" className="mt-3"><b>Note from approver:</b> {r.note}</Notice>}
            <div className={cn("mt-4 grid gap-2", showWeekend ? "grid-cols-4 sm:grid-cols-8" : "grid-cols-6")}>
              {idx.map(i => (
                <div key={i} className="min-w-0 space-y-1">
                  <div className={cn("relative text-center text-xs font-medium", days[i] === todayStr() ? "text-primary" : "text-muted-foreground")}>
                    {fmtWeekday(days[i], lang)}<span className="hidden sm:inline"> {parseYmd(days[i]).getDate()}</span>
                    {days[i] === todayStr() && <span className="absolute -bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full bg-primary" aria-label="Today" />}
                  </div>
                  <HoursInput row={r} i={i} days={days} editable={ed} v={v} onHours={onHours} />
                </div>
              ))}
              <div className="min-w-0 space-y-1">
                <div className="text-center text-xs font-medium text-muted-foreground">{at("total")}</div>
                <output className="flex h-11 items-center justify-center rounded-lg bg-muted text-base font-semibold tabular-nums">{fmtH(total, lang)}</output>
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export default function ProjectHoursView() {
  const s = useDemo(st => st.s)
  const setHours = useDemo(st => st.setGridHours)
  const setHidden = useDemo(st => st.setProjectHidden)
  const mutate = useDemo(st => st.mutate)
  const saveGrid = useDemo(st => st.saveGrid)
  const { lang, t, at } = useT()
  const emp = s.persona, off = s.period, P = PERSONAS[emp]
  const modern = s.settings.layout === "modern"
  const days = periodDays(off)
  const g = gridWeekOf(s, emp, off)
  const locked = off !== 0 // only the current pay period is editable
  const editable = (r: GridRow) => !locked && r.status !== "Approved" && !r.archived
  const [dirty, setDirty] = useState<Set<string>>(new Set())
  const [strict, setStrict] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [showHidden, setShowHidden] = useState(false)
  const weekendHasHours = g.rows.some(r => num(r.h[5]) || num(r.h[6]))
  const [weekend, setWeekend] = useState(weekendHasHours)
  const showWeekend = weekend || weekendHasHours

  useEffect(() => { setDirty(new Set()); setStrict(false) }, [emp, off])

  const v = useMemo(() => gridValidate(g, strict, days, d => fmtDayShort(d, lang)), [g, strict, days, lang])
  const rows = g.rows.filter(r => !r.archived)
  const visible = rows.filter(r => !isHidden(s, emp, r.proj) || rowTotal(r.h) > 0)
  const hiddenCodes = assigned(s, emp).filter(c => isHidden(s, emp, c) && !visible.some(r => r.proj === c))
  const missing = days.slice(0, 5).filter((d, i) => d < todayStr() && g.rows.every(r => !num(r.h[i]))).length
  const weekTotal = v.dayTot.reduce((a, b) => a + b, 0)

  const onHours = (rowId: string, i: number, value: string) => {
    setHours(rowId, i, value)
    setDirty(prev => new Set(prev).add(rowId))
  }
  const save = () => {
    setStrict(true)
    const result = saveGrid(dirty)
    if (!result.ok) { toast.error(result.message); return }
    setDirty(new Set())
    setStrict(false)
    if (result.message.startsWith("Nothing")) toast(result.message)
    else toast.success(result.message)
  }
  const copyLastWeek = () => {
    const prev = s.grid[emp]?.[periodKey(off - 1)]
    if (!prev) { toast("No rows last week to copy."); return }
    let added = 0, skipped = 0
    const ids: string[] = []
    mutate(x => {
      const pk = periodKey(off)
      x.grid[emp] ||= {}
      x.grid[emp][pk] ||= gridWeekOf(x as typeof s, emp, off)
      const week = x.grid[emp][pk]
      prev.rows.forEach(r => {
        if (r.archived) return
        if (!PROJECTS[r.proj].active || !assigned(x as typeof s, emp).includes(r.proj)) { skipped++; return }
        const existing = week.rows.find(y => y.proj === r.proj && !y.archived)
        if (existing) {
          if (existing.h.some(h => h !== "") || existing.status !== "Draft") return
          existing.h = [...r.h]; existing.task = existing.task || r.task; ids.push(existing.id)
        } else {
          const id = `r${++x.seq}`
          week.rows.push({ id, proj: r.proj, task: r.task, h: [...r.h], status: "Draft", note: "", archived: false })
          ids.push(id)
        }
        added++
      })
    })
    setDirty(prevSet => new Set([...prevSet, ...ids]))
    toast.success(`Copied ${added} row${added === 1 ? "" : "s"}${skipped ? `, ${skipped} closed project${skipped > 1 ? "s" : ""} skipped` : ""}.`)
  }

  const isSal = P.type === "salary"

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("grid")}
        tags="GR-01,GR-02"
        description={isSal ? "Enter the hours you spent on each project this week. Salaried time is recorded without approval." : "Enter your hours per project and day. Saved rows go to the project approver."}
        actions={<LayoutToggle />}
      />
      <WeekNav min={-1} max={1} meta={g.savedAt ? `${at("saved")} ${g.savedAt}` : `Loaded ${fmtClock(hm(new Date()), lang)}`} />

      {off === 0 && missing > 0 && (
        <Highlightable hl="reminder">
          <Notice tone="warning"><b>Reminder:</b> {missing} weekday{missing > 1 ? "s" : ""} this week {missing > 1 ? "have" : "has"} no hours yet. Time is due Friday at 17:00.</Notice>
        </Highlightable>
      )}
      {g.rows.some(r => r.status === "Rejected") && (
        <Notice tone="danger"><b>An approver returned a line.</b> Read the note on the highlighted project, fix it, then save again.</Notice>
      )}
      {locked && <Notice tone="neutral">{off < 0 ? "This week is closed. Lines are read-only." : "Next week opens on Monday. You can review your projects now."}</Notice>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">{at("assignedProjects")} <JourneyTags ids="GR-03,GR-04" /></h2>
        <div className="no-scrollbar -mx-4 flex w-[calc(100%+2rem)] gap-2 overflow-x-auto px-4 sm:mx-0 sm:w-auto sm:flex-wrap sm:overflow-visible sm:px-0 [&>*]:shrink-0">
          {modern && hiddenCodes.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setShowHidden(x => !x)} aria-expanded={showHidden}>
              {showHidden ? <EyeOff /> : <Eye />} {showHidden ? at("hideHidden") : at("showHidden", { n: hiddenCodes.length })}
            </Button>
          )}
          {!modern && (
            <Button variant="outline" size="sm" onClick={() => setManageOpen(true)}>
              <SlidersHorizontal /> {at("manageProjects")}{hiddenCount(s, emp) ? ` · ${hiddenCount(s, emp)} ${at("hidden").toLowerCase()}` : ""}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setWeekend(x => !x)} disabled={weekendHasHours} aria-pressed={showWeekend}>
            {at("weekend")}
          </Button>
          <Button variant="outline" size="sm" onClick={copyLastWeek} disabled={locked}><Copy /> {at("copyLastWeek")}</Button>
          <Button size="sm" onClick={() => setAddOpen(true)} disabled={locked}><Plus /> {at("addProject")}</Button>
        </div>
      </div>

      <Highlightable hl="grid">
        {modern ? (
          <ModernCards rows={visible} days={days} editable={editable} v={v} onHours={onHours} showWeekend={showWeekend} />
        ) : (
          <ClassicGrid rows={visible} days={days} editable={editable} v={v} onHours={onHours} showWeekend={showWeekend} />
        )}
        {modern && !visible.length && (
          <div className="rounded-2xl border border-dashed bg-card px-6 py-10 text-center">
            <h3 className="font-semibold">{at("noProjectsShown")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{at("noProjectsShownHelp")}</p>
          </div>
        )}
      </Highlightable>

      {modern && showHidden && hiddenCodes.length > 0 && (
        <ul className="divide-y rounded-2xl border bg-card/60">
          {hiddenCodes.map(c => (
            <li key={c} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1 text-sm">
                <div className="font-medium text-muted-foreground">{c} · {PROJECTS[c].name}</div>
                <div className="text-xs text-muted-foreground">{PROJECTS[c].startIn ? `Starts in ${PROJECTS[c].startIn} days` : at("hidden")}</div>
              </div>
              <Switch checked={false} aria-label={`${at("showOnTimecard")}: ${c}`} onCheckedChange={() => setHidden(c, false)} />
            </li>
          ))}
        </ul>
      )}

      {v.errs.length > 0 && (
        <Notice tone="danger">
          <ul className="list-disc space-y-0.5 pl-4">{v.errs.map(e => <li key={e}>{e}</li>)}</ul>
        </Notice>
      )}

      <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 lg:bottom-4">
        <Highlightable hl="grid-submit" className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border bg-card/95 p-3 pl-4 shadow-raised backdrop-blur-md">
          <div>
            <div className="text-xs text-muted-foreground">{at("weekTotal")}</div>
            <div className="text-base font-semibold tabular-nums">{fmtH(weekTotal, lang)} h</div>
          </div>
          <p className="hidden flex-1 text-xs text-muted-foreground md:block">
            {dirty.size ? `${at("unsaved")} · ${dirty.size} project${dirty.size === 1 ? "" : "s"}` : isSal ? "Saved hours are recorded in UKG." : "Saved hours go to the project approver."}
          </p>
          <Button size="lg" className="ml-auto" onClick={save} disabled={locked || !dirty.size}>
            <Save /> {dirty.size ? (isSal ? t("save") : at("submitTimecard")) : at("saved")}
          </Button>
        </Highlightable>
      </div>

      <ManageProjectsPanel open={manageOpen} onOpenChange={setManageOpen} />
      <AddRowPanel
        open={addOpen}
        onOpenChange={setAddOpen}
        onAdded={id => setTimeout(() => document.querySelector(`[data-row="${id}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 80)}
      />
    </div>
  )
}
