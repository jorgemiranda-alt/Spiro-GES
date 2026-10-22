/* Punch, timecard and project-hours rules, ported from the original prototype as pure functions. */
import { LABOR, PERSONAS, PROJECTS, laborTaskName, type LaborDefaults, type PersonaId } from "@/data/reference-data"
import { hm, mins, parseYmd, periodDays, periodKey, todayStr, tsDate, tsTime } from "./dates"
import type { DemoState, GridWeek, Labor, ModernEntry, Punch } from "@/store/types"

export const HIDE_AHEAD_DAYS = 14

export const laborDefaults = (emp: string): Partial<LaborDefaults> => LABOR.byPersona[emp] || {}
export const laborKey = (l?: Partial<Labor> | null) => [l?.project || "", l?.task || "", l?.tc || "", l?.func || ""].join("|")
export function laborParts(l?: Partial<Labor> | null) {
  const cat = l && LABOR.opts.proj.find(x => x.v === l.project)
  return {
    title: [cat ? cat.l : l?.project || "", laborTaskName(l?.task)].filter(Boolean).join(" · ") || "—",
    detail: [l?.tc, l?.func].filter(Boolean).join(" · "),
  }
}
export const laborText = (l?: Labor | null) =>
  l ? [LABOR.opts.proj.find(x => x.v === l.project)?.l || l.project, laborTaskName(l.task), l.tc, l.func].filter(Boolean).join(" · ") : ""

/** Active projects assigned in Odoo, plus any the employee added from the catalog. */
export const assigned = (s: DemoState, emp: string) =>
  [...new Set([...(PERSONAS[emp as PersonaId]?.projects || []), ...(s.odooAssignments[emp] || [])])].filter(c => PROJECTS[c]?.active)

export function isHidden(s: DemoState, emp: string, code: string) {
  const ov = s.hidden[emp]?.[code]
  if (ov !== undefined) return ov
  const p = PROJECTS[code]
  return !p.active || (p.startIn || 0) > HIDE_AHEAD_DAYS
}
export const hiddenCount = (s: DemoState, emp: string) => assigned(s, emp).filter(c => isHidden(s, emp, c)).length
export function isPunchOdooHidden(s: DemoState, emp: string, code: string) {
  const ov = s.punchOdooHidden[emp]?.[code]
  if (ov !== undefined) return ov
  const p = PROJECTS[code]
  return !p || !p.active || (p.startIn || 0) > HIDE_AHEAD_DAYS
}
export function startNote(code: string) {
  const d = PROJECTS[code].startIn || 0
  return !PROJECTS[code].active ? "Completed" : d > 0 ? `Starts in ${d} days` : ""
}

export function validateProject(s: DemoState, emp: string, code: string) {
  const pr = PROJECTS[code]
  if (!pr) return `${code} is not a Spiro project code. Scan again or ask your supervisor.`
  if (!assigned(s, emp).includes(code)) return `${code} is not assigned to you. Select an active assigned project.`
  if (!pr.active) return `${code} is closed. Select an active assigned project.`
  return null
}

export const dayPunches = (s: DemoState, emp: string, date: string) =>
  (s.punches[emp] || []).filter(p => tsDate(p.t) === date).sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : 0))

export type LiveStatus = "out" | "in" | "brk"
export interface LiveState {
  st: LiveStatus
  proj: string | null
  task: string | null
  labor: Labor | null
  since: string | null
  last?: Punch
}

export function liveState(s: DemoState, emp: string): LiveState {
  const ps = dayPunches(s, emp, todayStr())
  let st: LiveStatus = "out", proj: string | null = null, task: string | null = null, labor: Labor | null = null, since: string | null = null
  for (const p of ps) {
    if (p.type === "IN" || p.type === "XFER") {
      st = "in"; proj = p.proj; task = p.task; labor = p.labor || labor
      if (p.type === "IN" || !since) since = tsTime(p.t)
    } else if (p.type === "BRK_S") st = "brk"
    else if (p.type === "BRK_E") st = "in"
    else if (p.type === "OUT") st = "out"
  }
  return { st, proj, task, labor, since, last: ps[ps.length - 1] }
}

export interface SegEnd { t: string; kind: string; p: Punch }
export interface Segment {
  in: SegEnd
  out?: SegEnd
  proj: string | null
  task: string | null
  labor: Labor | null
  hours: number
  live?: boolean
  missing?: boolean
}
export type ExceptionCode = "SHORT_BREAK" | "MISSED_OUT_PUNCH" | "LATE_IN" | "EARLY_OUT" | "UNSCHEDULED" | "UNEXCUSED_ABSENCE"
export interface DayException { code: ExceptionCode; label: string; sev: "warn" | "err"; pid?: string; msg: string }
export interface Day {
  date: string
  segs: Segment[]
  exc: DayException[]
  daily: number
  cum: number
  sched: { start: string; end: string; brk: number } | null
}

/** I18N keys for each exception code. */
const EXC_LABEL: Record<ExceptionCode, string> = {
  SHORT_BREAK: "shortBrk", MISSED_OUT_PUNCH: "missed", LATE_IN: "late", EARLY_OUT: "early", UNSCHEDULED: "unsched", UNEXCUSED_ABSENCE: "absent",
}

/** UKG-style segments and exceptions for one day. */
export function buildDay(s: DemoState, emp: string, date: string): Day {
  const P = PERSONAS[emp as PersonaId], ps = dayPunches(s, emp, date), segs: Segment[] = [], exc: DayException[] = []
  let open: Segment | null = null, lastProj: string | null = null, lastTask: string | null = null, lastLabor: Labor | null = null
  let brkStart: string | null = null, firstIn: string | null = null, lastOut: string | null = null
  const add = (code: ExceptionCode, sev: "warn" | "err", msg: string, pid?: string) => exc.push({ code, label: EXC_LABEL[code], sev, msg, pid })
  const close = (p: Punch, kind: string) => {
    if (!open) return
    open.out = { t: tsTime(p.t), kind, p }
    open.hours = (mins(open.out.t) - mins(open.in.t)) / 60
    segs.push(open)
    open = null
  }
  for (const p of ps) {
    const t = tsTime(p.t)
    if (p.type === "IN") {
      if (open) close(p, "Out")
      open = { in: { t, kind: "In", p }, proj: p.proj, task: p.task, labor: p.labor || null, hours: 0 }
      lastProj = p.proj; lastTask = p.task; lastLabor = p.labor || null
      firstIn ||= t
    } else if (p.type === "XFER") {
      if (open) close(p, "Transfer")
      lastLabor = p.labor || lastLabor
      open = { in: { t, kind: "Transfer", p }, proj: p.proj, task: p.task, labor: lastLabor, hours: 0 }
      lastProj = p.proj; lastTask = p.task
      firstIn ||= t
    } else if (p.type === "BRK_S") {
      close(p, "Break")
      brkStart = t
    } else if (p.type === "BRK_E") {
      if (brkStart && P.sched && mins(t) - mins(brkStart) < P.sched.brk)
        add("SHORT_BREAK", "warn", `Break ${mins(t) - mins(brkStart)} min (minimum ${P.sched.brk})`, p.id)
      brkStart = null
      open = { in: { t, kind: "Break end", p }, proj: lastProj, task: lastTask, labor: lastLabor, hours: 0 }
    } else if (p.type === "OUT") {
      close(p, "Out")
      lastOut = t
    }
  }
  const isToday = date === todayStr(), past = date < todayStr()
  const pending = open as Segment | null
  if (pending) {
    if (isToday) {
      pending.live = true
      pending.hours = Math.max(0, (mins(hm(new Date())) - mins(pending.in.t)) / 60)
      segs.push(pending)
    } else {
      pending.missing = true
      pending.hours = 0
      segs.push(pending)
      add("MISSED_OUT_PUNCH", "err", "No out punch recorded")
    }
  }
  const dow = parseYmd(date).getDay(), sched = P.sched && P.sched.days.includes(dow) ? P.sched : null
  if (sched && firstIn && mins(firstIn) > mins(sched.start) + 5)
    add("LATE_IN", "warn", `In at ${firstIn}, scheduled ${sched.start}`, ps.find(p => p.type === "IN" || p.type === "XFER")?.id)
  if (sched && lastOut && !pending && mins(lastOut) < mins(sched.end) - 5)
    add("EARLY_OUT", "warn", `Out at ${lastOut}, scheduled ${sched.end}`, [...ps].reverse().find(p => p.type === "OUT")?.id)
  if (!sched && ps.length) add("UNSCHEDULED", "warn", "Worked on a day with no schedule")
  if (sched && !ps.length && past) add("UNEXCUSED_ABSENCE", "err", "Scheduled but no punches")
  const daily = segs.reduce((a, x) => a + (x.hours || 0), 0)
  return { date, segs, exc, daily, cum: 0, sched }
}

export function buildPeriod(s: DemoState, emp: string, off: number): Day[] {
  let cum = 0
  return periodDays(off).map(d => {
    const b = buildDay(s, emp, d)
    cum += b.daily
    b.cum = cum
    return b
  })
}

/* ---------- Project hours grid ---------- */

export const num = (v: string | number | null | undefined) => {
  if (v === "" || v == null) return 0
  const n = Number(String(v).trim().replace(",", "."))
  return Number.isNaN(n) ? NaN : n
}

/** The week's grid, auto-populated from visible assignments the first time it is opened (GR-02). */
export function gridWeekOf(s: DemoState, emp: string, off: number): GridWeek {
  return s.grid[emp]?.[periodKey(off)] ?? {
    rows: assigned(s, emp).filter(c => !isHidden(s, emp, c)).map(c => ({
      id: `auto-${c}`, proj: c, task: PROJECTS[c].taskReq ? "" : PROJECTS[c].tasks[0], h: Array(7).fill(""),
      status: "Draft" as const, note: "", archived: false,
    })),
    auto: true,
  }
}

export interface GridValidation {
  errs: string[]
  bad: Set<string>
  badTask: Set<string>
  dayBad: Set<number>
  dayTot: number[]
}

export function gridValidate(g: GridWeek, strict: boolean, days: string[], dayLabel: (d: string) => string): GridValidation {
  const errs: string[] = [], bad = new Set<string>(), badTask = new Set<string>(), dayBad = new Set<number>()
  const dayTot = Array(7).fill(0) as number[]
  g.rows.filter(r => !r.archived).forEach(r => {
    r.h.forEach((v, i) => {
      const n = num(v)
      if (v !== "" && (Number.isNaN(n) || n < 0)) {
        bad.add(`${r.id}:${i}`)
        errs.push(`${r.proj}: "${v}" is not a valid number of hours.`)
      } else if (v !== "" && !/^\d+([.,]\d{1,2})?$/.test(String(v).trim())) {
        bad.add(`${r.id}:${i}`)
        errs.push(`${r.proj}: use at most 2 decimals.`)
      } else dayTot[i] += n || 0
    })
    const rt = r.h.reduce((a, v) => a + (num(v) || 0), 0)
    if (strict && rt > 0 && PROJECTS[r.proj].taskReq && !r.task && r.status !== "Approved") {
      badTask.add(r.id)
      errs.push(`${r.proj} needs a task. Choose one before submitting.`)
    }
  })
  dayTot.forEach((v, i) => {
    if (v > 24) {
      dayBad.add(i)
      errs.push(`${dayLabel(days[i])}: day total cannot exceed 24 hours.`)
    }
  })
  return { errs: [...new Set(errs)], bad, badTask, dayBad, dayTot }
}

export const rowTotal = (h: string[]) => h.reduce((a, x) => a + (num(x) || 0), 0)

/* ---------- Project estimates ---------- */

export function burn(s: DemoState, code: string) {
  const p = PROJECTS[code]
  const appr = s.approvals.filter(a => a.proj === code && a.status === "Approved").reduce((x, a) => x + a.hours, 0)
  const pend = s.approvals.filter(a => a.proj === code && a.status === "Pending").reduce((x, a) => x + a.hours, 0)
  const used = p.used + appr
  return { est: p.est, used, pend, pct: p.est ? (used / p.est) * 100 : 0 }
}

/* ---------- Modern hourly timecard ---------- */

/** Project codes worked on a day, in the order they first appear. */
export function projectsOnDay(day: Day) {
  return [...new Set(day.segs.map(x => x.proj).filter((p): p is string => !!p))]
}

/** Start, end and break for one project on one day, derived from punches when nothing was typed. */
export function derivedEntry(day: Day, code: string): ModernEntry {
  const segs = day.segs.filter(x => x.proj === code && !x.missing)
  if (!segs.length) return { start: "", end: "", brk: "", show: true }
  const start = segs[0].in.t
  const lastSeg = segs[segs.length - 1]
  const end = lastSeg.out?.t || (lastSeg.live ? hm(new Date()) : "")
  const worked = segs.reduce((a, x) => a + x.hours * 60, 0)
  const span = end ? mins(end) - mins(start) : 0
  const brk = end ? Math.max(0, Math.round(span - worked)) : 0
  return { start, end, brk: brk ? `${Math.floor(brk / 60)}:${String(brk % 60).padStart(2, "0")}` : "0:00", show: true }
}

/** Break is entered as "H:MM" (or plain minutes). Returns minutes, or NaN when unreadable. */
export function breakMinutes(v: string) {
  const s = v.trim()
  if (!s) return 0
  if (/^\d+$/.test(s)) return Number(s)
  const m = /^(\d+):([0-5]\d)$/.exec(s)
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN
}

/** Hours for a Start/End/Break entry, or null when the entry is incomplete or invalid. */
export function entryHours(e: Pick<ModernEntry, "start" | "end" | "brk">) {
  if (!/^\d{2}:\d{2}$/.test(e.start) || !/^\d{2}:\d{2}$/.test(e.end)) return null
  const b = breakMinutes(e.brk)
  if (Number.isNaN(b)) return null
  const worked = mins(e.end) - mins(e.start) - b
  return worked > 0 ? worked / 60 : null
}
