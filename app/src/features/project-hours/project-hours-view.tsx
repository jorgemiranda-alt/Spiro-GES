import { useEffect, useMemo, useState } from "react"
import { Copy, Eye, EyeOff, MoreHorizontal, Plus, Save, Send, SlidersHorizontal } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Highlightable, JourneyTags, PageHeader } from "@/components/app/common"
import { CutoffNote } from "@/components/app/cutoff-note"
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

function TaskSelect({ row, siblings = [], editable, invalid, quiet }: { row: GridRow; siblings?: GridRow[]; editable: boolean; invalid: boolean; quiet?: boolean }) {
  const setTask = useDemo(st => st.setGridTask)
  const { t } = useT()
  const p = PROJECTS[row.proj]
  // A task already on another line of this project is not offered twice.
  const options = p.tasks.filter(x => x === row.task || !siblings.some(r => r.id !== row.id && r.task === x))
  if (p.tasks.length < 2 && !p.taskReq) return row.task ? (quiet ? <span className="truncate text-sm text-muted-foreground">{row.task}</span> : <MetaTag>{t("task")}: {row.task}</MetaTag>) : null
  // Each line is one task, chosen when the line is added; only a line still missing its task needs a picker.
  if (row.task) return <span className={cn("truncate", quiet ? "text-sm font-medium" : "font-medium")}>{row.task}</span>
  return (
    <Select value={row.task} onValueChange={v => setTask(row.id, v)} disabled={!editable}>
      <SelectTrigger size="sm" aria-label={`${row.proj} ${t("task")}`} aria-invalid={invalid || undefined} className={cn(
        "max-w-full",
        quiet
          ? "-ml-2 h-8 w-auto min-w-0 gap-1 border-transparent *:data-[slot=select-value]:!block *:data-[slot=select-value]:min-w-0 *:data-[slot=select-value]:truncate bg-transparent px-2 text-sm text-muted-foreground shadow-none hover:bg-muted hover:text-foreground data-[size=sm]:h-8"
          : "h-8 rounded-md text-xs data-[size=sm]:h-8",
      )}>
        <SelectValue placeholder={`Choose a ${t("task").toLowerCase()}`} />
      </SelectTrigger>
      <SelectContent>{options.map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
    </Select>
  )
}

/** Lines grouped by project in first-seen order: each task is its own line, and the project gets a total. */
function byProject(rows: GridRow[]) {
  const groups = new Map<string, GridRow[]>()
  rows.forEach(r => groups.set(r.proj, [...(groups.get(r.proj) || []), r]))
  return [...groups.entries()].map(([proj, lines]) => ({ proj, lines, total: lines.reduce((a, r) => a + rowTotal(r.h), 0) }))
}

/** Adds a line for a task not yet on this project, picked from a short menu. */
function AddTaskButton({ proj, lines, disabled }: { proj: string; lines: GridRow[]; disabled: boolean }) {
  const addTask = useDemo(st => st.addGridTask)
  const { at } = useT()
  const free = PROJECTS[proj].tasks.filter(x => !lines.some(r => r.task === x))
  if (PROJECTS[proj].tasks.length < 2 || !free.length) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="-ml-2 text-primary" disabled={disabled}><Plus /> {at("addTask")}</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {free.map(x => <DropdownMenuItem key={x} onSelect={() => addTask(proj, x)}>{x}</DropdownMenuItem>)}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ClassicGrid({ rows, days, editable, v, onHours, locked }: { rows: GridRow[]; days: string[]; editable: (r: GridRow) => boolean; v: GridValidation; onHours: RowProps["onHours"]; locked: boolean }) {
  const { lang, t, at } = useT()
  const cols = days.map((d, i) => ({ d, i }))
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead className="bg-muted/60 text-xs font-medium text-muted-foreground">
            <tr>
              <th scope="col" className="sticky left-0 z-10 min-w-56 bg-muted px-4 py-3 text-left">{t("project")} / {t("task")}</th>
              {cols.map(({ d }) => (
                <th key={d} scope="col" className={cn("px-1.5 py-3 text-center", d === todayStr() && "text-primary")}>
                  {fmtWeekday(d, lang)} <span className="tabular-nums">{parseYmd(d).getDate()}</span>
                </th>
              ))}
              <th scope="col" className="px-4 py-3 text-right">{at("total")}</th>
            </tr>
          </thead>
          <tbody>
            {byProject(rows).flatMap(({ proj, lines, total }) => [
              // The project has its own line, so each task line below lines up with its own hours.
              <tr key={`${proj}-head`} className="border-t">
                <th scope="rowgroup" colSpan={cols.length + 2} className="sticky left-0 bg-card px-4 pt-3 pb-1 text-left font-semibold">
                  {proj} <span className="font-normal text-muted-foreground">{PROJECTS[proj].name}</span>
                </th>
              </tr>,
              ...lines.map(r => (
                <tr key={r.id} data-row={r.id} className={cn(r.status === "Rejected" && "bg-destructive-soft/40")}>
                  <th scope="row" className="sticky left-0 z-10 bg-card py-1.5 pr-4 pl-7 text-left align-middle font-normal">
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <TaskSelect row={r} siblings={lines} editable={editable(r)} invalid={v.badTask.has(r.id)} />
                      {r.status !== "Draft" && r.status !== "Recorded" && <StatusPill tone={rowTone(r.status)}>{r.status}</StatusPill>}
                    </div>
                    {r.note && <p className="mt-1.5 text-xs text-destructive"><b>Note from approver:</b> {r.note}</p>}
                  </th>
                  {cols.map(({ i }) => (
                    <td key={i} className="px-1 py-1.5 align-middle">
                      <HoursInput row={r} i={i} days={days} editable={editable(r)} v={v} onHours={onHours} />
                    </td>
                  ))}
                  <td className={cn("px-4 py-1.5 text-right align-middle tabular-nums", lines.length === 1 && "font-semibold")}>{fmtH(rowTotal(r.h), lang)}</td>
                </tr>
              )),
              <tr key={`${proj}-total`} className="text-sm">
                <th scope="row" className="sticky left-0 z-10 bg-card py-1 pr-4 pl-7 text-left align-middle font-normal">
                  <AddTaskButton proj={proj} lines={lines} disabled={locked} />
                </th>
                <td colSpan={cols.length} className="px-1 py-1 text-right align-middle text-muted-foreground">{lines.length > 1 ? at("projectTotal") : ""}</td>
                <td className="px-4 py-1 text-right align-middle font-semibold tabular-nums">{lines.length > 1 ? fmtH(total, lang) : ""}</td>
              </tr>,
            ])}
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

function ModernCards({ rows, days, editable, v, onHours, locked }: { rows: GridRow[]; days: string[]; editable: (r: GridRow) => boolean; v: GridValidation; onHours: RowProps["onHours"]; locked: boolean }) {
  const setHidden = useDemo(st => st.setProjectHidden)
  const { lang, at } = useT()
  return (
    <ul className="space-y-3">
      {byProject(rows).map(({ proj, lines, total }) => {
        const p = PROJECTS[proj]
        return (
          <li key={proj} className={cn("rounded-2xl border bg-card p-4 shadow-soft sm:p-5", lines.some(r => r.status === "Rejected") && "border-destructive/40")}>
            <div className="flex items-start gap-3">
              <span className={cn("mt-2 size-2 shrink-0 rounded-full", total ? "bg-success" : "bg-input")} aria-hidden />
              <div className="min-w-0 flex-1">
                <h3 className="text-[15px] leading-snug font-semibold"><span className="tabular-nums">{proj}</span> · {p.name}</h3>
                <p className="truncate text-sm text-muted-foreground">{[p.client, p.show !== "—" && p.show].filter(Boolean).join(" · ")}</p>
              </div>
              <label className="flex shrink-0 flex-col items-center gap-0.5 text-[11px] font-medium text-muted-foreground sm:flex-row-reverse sm:gap-2 sm:text-sm sm:text-foreground">
                <span>{at("show")}</span>
                <Switch
                  checked
                  aria-label={`${at("showOnTimecard")}: ${proj}`}
                  onCheckedChange={() => {
                    setHidden(proj, true)
                    toast(total ? `${proj} hidden from your list. Its hours stay on the timecard.` : `${proj} hidden from your timecard.`, { action: { label: "Undo", onClick: () => setHidden(proj, false) } })
                  }}
                />
              </label>
            </div>
            {/* One line per task, each with its own week strip; the project total sums the lines. */}
            {lines.map((r, li) => {
              const ed = editable(r)
              return (
                <div key={r.id} data-row={r.id} className={cn(li > 0 && "mt-3 border-t pt-3")}>
                  {r.note && <Notice tone="danger" className="mt-3"><b>Note from approver:</b> {r.note}</Notice>}
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-center gap-1.5">
                      <TaskSelect row={r} siblings={lines} editable={ed} invalid={v.badTask.has(r.id)} quiet />
                      {/* Draft and Recorded (salaried time needs no approval) say nothing new, so only a decision earns a pill. */}
                      {r.status !== "Draft" && r.status !== "Recorded" && <StatusPill tone={rowTone(r.status)}>{r.status}</StatusPill>}
                    </div>
                    <output className="shrink-0 text-sm font-medium tabular-nums">{fmtH(rowTotal(r.h), lang)} h</output>
                  </div>
                  {/* The whole week, Monday to Sunday, in one row — like a native week strip. */}
                  <div className="mt-2 grid grid-cols-7 gap-1 sm:gap-2">
                    {days.map((d, i) => (
                      <div key={i} className="min-w-0 space-y-1">
                        <div className={cn(
                          "flex flex-col items-center text-[11px] leading-tight font-medium sm:flex-row sm:justify-center sm:gap-1 sm:text-xs",
                          d === todayStr() ? "text-primary" : i > 4 ? "text-muted-foreground/70" : "text-muted-foreground",
                        )}>
                          <span>{fmtWeekday(d, lang)}</span>
                          <span className={cn("tabular-nums", d === todayStr() && "rounded-full bg-primary px-1.5 text-primary-foreground")}>{parseYmd(d).getDate()}</span>
                        </div>
                        <HoursInput row={r} i={i} days={days} editable={ed} v={v} onHours={onHours} className={cn("px-0", i > 4 && "bg-muted/40")} />
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
            <div className="mt-3 flex min-h-9 items-center justify-between gap-3 border-t pt-2">
              <AddTaskButton proj={proj} lines={lines} disabled={locked} />
              <p className="ml-auto shrink-0 text-sm text-muted-foreground">
                {at("projectTotal")} <output className="ml-1 text-base font-semibold text-foreground tabular-nums">{fmtH(total, lang)} h</output>
              </p>
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
  const saveDraft = useDemo(st => st.saveGridDraft)
  const [strict, setStrict] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [showHidden, setShowHidden] = useState(false)

  useEffect(() => { setStrict(false) }, [emp, off])

  const v = useMemo(() => gridValidate(g, strict, days, d => fmtDayShort(d, lang)), [g, strict, days, lang])
  const rows = g.rows.filter(r => !r.archived)
  const visible = rows.filter(r => !isHidden(s, emp, r.proj) || rowTotal(r.h) > 0)
  const hiddenCodes = assigned(s, emp).filter(c => isHidden(s, emp, c) && !visible.some(r => r.proj === c))
  const missing = days.slice(0, 5).filter((d, i) => d < todayStr() && g.rows.every(r => !num(r.h[i]))).length
  const weekTotal = v.dayTot.reduce((a, b) => a + b, 0)
  // Unsent changes live on the lines, so leaving the screen never loses them or marks them as sent.
  const unsent = rows.filter(r => r.unsent && r.status !== "Approved").length

  const onHours = (rowId: string, i: number, value: string) => setHours(rowId, i, value)
  const draft = () => {
    saveDraft()
    toast.success(at("draftSavedToast"))
  }
  const save = () => {
    setStrict(true)
    const result = saveGrid()
    if (!result.ok) { toast.error(result.message); return }
    setStrict(false)
    if (result.message.startsWith("Nothing")) toast(result.message)
    else toast.success(result.message)
  }
  const copyLastWeek = () => {
    const prev = s.grid[emp]?.[periodKey(off - 1)]
    if (!prev) { toast("No rows last week to copy."); return }
    let added = 0, skipped = 0

    mutate(x => {
      const pk = periodKey(off)
      x.grid[emp] ||= {}
      x.grid[emp][pk] ||= gridWeekOf(x as typeof s, emp, off)
      const week = x.grid[emp][pk]
      prev.rows.forEach(r => {
        if (r.archived) return
        if (!PROJECTS[r.proj].active || !assigned(x as typeof s, emp).includes(r.proj)) { skipped++; return }
        // Match the task line too, so each task copies onto its own line.
        const existing = week.rows.find(y => y.proj === r.proj && !y.archived && (y.task === r.task || !y.task))
        if (existing) {
          if (existing.h.some(h => h !== "") || existing.status !== "Draft") return
          existing.h = [...r.h]; existing.task = existing.task || r.task; existing.unsent = true
        } else {
          week.rows.push({ id: `r${++x.seq}`, proj: r.proj, task: r.task, h: [...r.h], status: "Draft", note: "", archived: false, unsent: true })
        }
        added++
      })
    })
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
        hideDescriptionOnMobile
      />
      <WeekNav min={-1} max={1} meta={g.savedAt ? `${at("saved")} ${g.savedAt}` : `Loaded ${fmtClock(hm(new Date()), lang)}`} />

      {off === 0 && <CutoffNote emp={emp} />}
      {off === 0 && missing > 0 && (
        <Highlightable hl="reminder">
          <Notice tone="warning"><b>Reminder:</b> {missing} weekday{missing > 1 ? "s" : ""} this week {missing > 1 ? "have" : "has"} no hours yet. Enter them before payroll closes.</Notice>
        </Highlightable>
      )}
      {g.rows.some(r => r.status === "Rejected") && (
        <Notice tone="danger"><b>An approver returned a line.</b> Read the note on the highlighted project, fix it, then save again.</Notice>
      )}
      {locked && <Notice tone="neutral">{off < 0 ? "This week is closed. Lines are read-only." : "Next week opens on Monday. You can review your projects now."}</Notice>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">{at("assignedProjects")} <JourneyTags ids="GR-03,GR-04" /></h2>
        {/* Phone: one primary button plus a "more" menu, so nothing runs off the screen. */}
        <div className="flex w-full gap-2 sm:hidden">
          <Button className="h-10 flex-1" onClick={() => setAddOpen(true)} disabled={locked}><Plus /> {at("addProject")}</Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="size-10" aria-label={at("moreActions")}><MoreHorizontal /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              {modern && hiddenCodes.length > 0 && (
                <DropdownMenuItem onSelect={() => setShowHidden(x => !x)}>
                  {showHidden ? <EyeOff /> : <Eye />} {showHidden ? at("hideHidden") : at("showHidden", { n: hiddenCodes.length })}
                </DropdownMenuItem>
              )}
              {!modern && (
                <DropdownMenuItem onSelect={() => setManageOpen(true)}>
                  <SlidersHorizontal /> {at("manageProjects")}
                  {hiddenCount(s, emp) > 0 && <span className="ml-auto text-xs text-muted-foreground tabular-nums">{hiddenCount(s, emp)} {at("hidden").toLowerCase()}</span>}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={copyLastWeek} disabled={locked}><Copy /> {at("copyLastWeek")}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex flex-wrap gap-2 max-sm:hidden">
          {modern && hiddenCodes.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setShowHidden(x => !x)} aria-expanded={showHidden}>
              {showHidden ? <EyeOff /> : <Eye />} {showHidden ? at("hideHidden") : at("showHidden", { n: hiddenCodes.length })}
            </Button>
          )}
          {!modern && (
            <Button variant="outline" size="sm" onClick={() => setManageOpen(true)}>
              <SlidersHorizontal /> {at("manageProjects")}
              {hiddenCount(s, emp) > 0 && (
                <span className="rounded-full bg-muted px-1.5 text-xs leading-5 tabular-nums" aria-label={`${hiddenCount(s, emp)} ${at("hidden").toLowerCase()}`}>{hiddenCount(s, emp)}</span>
              )}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={copyLastWeek} disabled={locked}><Copy /> {at("copyLastWeek")}</Button>
          <Button size="sm" onClick={() => setAddOpen(true)} disabled={locked}><Plus /> {at("addProject")}</Button>
        </div>
      </div>

      <Highlightable hl="grid">
        {modern ? (
          <ModernCards rows={visible} days={days} editable={editable} v={v} onHours={onHours} locked={locked} />
        ) : (
          <>
            {/* Phone: the wide grid can't fit, so Classic shows the same week cards as Modern. */}
            <div className="sm:hidden"><ModernCards rows={visible} days={days} editable={editable} v={v} onHours={onHours} locked={locked} /></div>
            <div className="max-sm:hidden"><ClassicGrid rows={visible} days={days} editable={editable} v={v} onHours={onHours} locked={locked} /></div>
          </>
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
        <Highlightable hl="grid-submit" className="flex items-center gap-x-3 gap-y-3 sm:flex-wrap sm:gap-x-6 rounded-2xl border bg-card/95 p-3 pl-4 shadow-raised backdrop-blur-md">
          <div>
            <div className="text-xs text-muted-foreground">{at("weekTotal")}</div>
            <div className="text-base font-semibold tabular-nums">{fmtH(weekTotal, lang)} h</div>
          </div>
          <p className="hidden flex-1 text-xs text-muted-foreground md:block">
            {unsent
              ? g.draftAt ? at("draftSavedAt", { time: g.draftAt }) : at("unsaved")
              : isSal ? "Submitted hours are recorded in UKG." : "Submitted hours go to the project approver."}
          </p>
          {/* Save draft keeps the work without sending it; Submit is the only step that reaches UKG. */}
          <div className="ml-auto flex gap-2">
            {/* Phone: icon only, so the bar stays one line above the tab bar. */}
            <Button size="lg" variant="outline" className="max-sm:px-3" onClick={draft} disabled={locked || !unsent} aria-label={at("saveDraft")} title={at("saveDraft")}>
              <Save /> <span className="max-sm:hidden">{at("saveDraft")}</span>
            </Button>
            <Button size="lg" onClick={save} disabled={locked || !unsent}>
              <Send /> {unsent ? at(isSal ? "submitToUkg" : "submitForApproval") : at("submitted")}
            </Button>
          </div>
        </Highlightable>
      </div>

      <ManageProjectsPanel open={manageOpen} onOpenChange={setManageOpen} />
      <AddRowPanel
        open={addOpen}
        onOpenChange={setAddOpen}
        onAdded={id => setTimeout(() => [...document.querySelectorAll<HTMLElement>(`[data-row="${id}"]`)].find(el => el.offsetParent)?.scrollIntoView({ behavior: "smooth", block: "center" }), 80)}
      />
    </div>
  )
}
