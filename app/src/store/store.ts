import { create } from "zustand"
import { produce, type Draft } from "immer"
import { toast } from "sonner"
import { LABOR, PERSONAS, PROJECTS, type PersonaId, type ViewId } from "@/data/reference-data"
import { fmtClock, fmtRange, locale, nowTs, periodDays, periodKey, todayStr, tsTime } from "@/lib/dates"
import {
  assigned, gridValidate, gridWeekOf, laborDefaults, laborKey, liveState, num, buildPeriod, HIDE_AHEAD_DAYS,
} from "@/lib/engine"
import { appText, translate } from "@/lib/i18n"
import { load, persist, seed, STORE_KEY } from "./seed"
import type { DemoState, GridWeek, Labor, ModernEntry, Punch, PunchType, Settings, TimecardLayout } from "./types"

type Recipe = (s: Draft<DemoState>) => void

interface Store {
  s: DemoState
  /** Employees with a punch waiting for the simulated UKG response. */
  busy: string[]
  mutate: (fn: Recipe) => void
  setPersona: (p: PersonaId) => void
  setLang: (lang: string) => void
  go: (view: ViewId) => void
  setPeriod: (off: number) => void
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void
  setLayout: (layout: TimecardLayout) => void
  reset: () => void
  addPunch: (emp: string, type: PunchType, opts?: AddPunchOpts) => Punch
  recordEmployeePunch: (type: PunchType, opts?: { proj?: string | null; task?: string | null; labor?: Labor | null }) => void
  pickTransfer: (id: string) => void
  applyPunchTransfer: (lc: Labor) => string | null
  setPunchOdooHidden: (code: string, hide: boolean) => void
  addOdooProject: (code: string) => boolean
  setGridHours: (rowId: string, day: number, value: string) => void
  setGridTask: (rowId: string, task: string) => void
  /** Adds another task line to a project already on the week; returns the new line id. */
  addGridTask: (proj: string, task?: string) => string | null
  /** Keeps the week's entries as a draft without sending anything to UKG. */
  saveGridDraft: () => void
  setProjectHidden: (code: string, hide: boolean) => void
  addGridRow: (row: { proj: string; task: string; paycode: string; tc: string; func: string }) => string | null
  saveGrid: () => { ok: boolean; message: string }
  setModernEntry: (date: string, proj: string, patch: Partial<ModernEntry>, base: ModernEntry) => void
  submitModernWeek: () => void
}

interface AddPunchOpts {
  proj?: string | null
  task?: string | null
  src?: string
  at?: string | null
  labor?: Labor | null
  onAccepted?: (p: Punch) => void
}

const t = (s: DemoState, key: string) => translate(s.lang, key)

export const useDemo = create<Store>((set, get) => {
  const mutate = (fn: Recipe) => {
    const next = produce(get().s, fn)
    persist(next)
    set({ s: next })
  }
  const uid = (p: string) => {
    let id = ""
    mutate(s => { s.seq = (s.seq || 1000) + 1; id = p + s.seq })
    return id
  }

  /** Simulated UKG request: Submitted now, Accepted after a short delay. */
  const ukg = (emp: string, action: string, endpoint: string, summary: string, onDone?: () => void) => {
    const id = uid("tx")
    mutate(s => { s.txns.unshift({ id, ts: nowTs(), emp, action, endpoint, summary, status: "Submitted", ref: "" }) })
    setTimeout(() => {
      mutate(s => {
        const tx = s.txns.find(x => x.id === id)
        if (tx) { tx.status = "Accepted"; tx.ref = `UKG-${480000 + s.seq}` }
      })
      onDone?.()
    }, 850)
    return id
  }

  const ensureGrid = (s: Draft<DemoState>, emp: string, off: number): Draft<GridWeek> => {
    const pk = periodKey(off)
    s.grid[emp] ||= {}
    if (!s.grid[emp][pk]) s.grid[emp][pk] = gridWeekOf(s as DemoState, emp, off)
    return s.grid[emp][pk]
  }

  const addPunch: Store["addPunch"] = (emp, type, opts = {}) => {
    const { proj = null, task = null, src = "Punch", at = null, labor = null, onAccepted } = opts
    const s0 = get().s
    const categories = labor ? { project: labor.project || "", task: labor.task || "", tc: labor.tc || "", func: labor.func || "" } : null
    const categorySummary = categories
      ? ([["Labor Category Project", categories.project], ["Labor Category Task / LOB", categories.task], ["Timecard Code", categories.tc], ["Function", categories.func]] as const)
        .filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(" · ")
      : ""
    const label = { IN: "Punch in", OUT: "Punch out", BRK_S: "Break start", BRK_E: "Break end", XFER: "Transfer" }[type]
    const p: Punch = { id: uid("p"), t: at || nowTs(), type, proj, task, labor: categories, src, sync: null }
    const seedWeek = s0.seedWeek
    const commit = () => mutate(s => {
      s.punches[emp] ||= []
      s.punches[emp].push(p)
      s.audit.unshift({
        ts: p.t, who: PERSONAS[emp as PersonaId].name, emp,
        what: `${label}${proj ? ` · ${proj}${task ? ` / ${task}` : ""}` : ""}`,
        detail: `Source: ${src}${categorySummary ? ` · Labor categories: ${categorySummary}` : ""}`, reason: "",
      })
    })
    if (!onAccepted) commit()
    p.sync = ukg(emp, label, "POST /v1/timekeeping/timecard",
      `punches.add ${proj && (type === "XFER" || type === "IN") ? `transfer.project=${proj}` : ""}${categorySummary ? ` labor.categories=${categorySummary}` : ""} @ ${tsTime(p.t)}`.trim(),
      onAccepted ? () => { if (get().s.seedWeek !== seedWeek) return; commit(); onAccepted(p) } : undefined)
    if (!onAccepted) mutate(s => { const x = s.punches[emp].find(y => y.id === p.id); if (x) x.sync = p.sync })
    return p
  }

  return {
    s: load(),
    busy: [],
    mutate,

    setPersona: p => mutate(s => {
      s.persona = p
      s.period = 0
      s.view = PERSONAS[p].land
    }),
    setLang: lang => mutate(s => { s.lang = lang }),
    go: view => mutate(s => { s.view = view }),
    setPeriod: off => mutate(s => { s.period = off }),
    setSetting: (key, value) => mutate(s => { s.settings[key] = value }),
    setLayout: layout => mutate(s => { s.settings.layout = layout }),
    reset: () => {
      try { localStorage.removeItem(STORE_KEY) } catch { /* ignore */ }
      const fresh = seed()
      const { persona, lang, view, settings } = get().s
      fresh.persona = persona; fresh.lang = lang; fresh.view = view; fresh.settings.layout = settings.layout; fresh.settings.scheme = settings.scheme
      persist(fresh)
      set({ s: fresh, busy: [] })
    },
    addPunch,

    /* Employee Punch: confirmation follows simulated UKG acceptance, guarded against double taps. */
    recordEmployeePunch: (type, opts = {}) => {
      const s = get().s, emp = s.persona
      if (get().busy.includes(emp)) return
      const L = liveState(s, emp)
      if (type === "IN" && L.st !== "out") { toast.error(t(s, "alreadyIn") || "You are already punched in."); return }
      if (type === "OUT" && L.st === "out") return
      if ((type === "IN" || type === "OUT") && s.settings.simDuplicatePunchError) {
        mutate(d => {
          d.settings.simDuplicatePunchError = false
          const message = "Duplicate punch. UKG did not record this punch."
          const ts = nowTs()
          d.txns.unshift({ id: `tx${d.seq + 1}`, ts, emp, action: type === "IN" ? "Punch In" : "Punch Out", endpoint: "POST /v1/timekeeping/timecard", summary: `punches.add action ${type === "IN" ? "PUNCH_IN" : "PUNCH_OUT"}`, status: "Failed", ref: "", error: message })
          d.seq += 1
          d.audit.unshift({ ts, who: "UKG", emp, what: `${type === "IN" ? "Punch In" : "Punch Out"} failed`, detail: message, reason: "" })
        })
        toast.error(appText(get().s.lang, "dupPunch"))
        return
      }
      const labelKey = { IN: "punchIn", OUT: "punchOut", BRK_S: "startBreak", BRK_E: "endBreak", XFER: "transfer" }[type]
      set({ busy: [...get().busy, emp] })
      const finish = (p: Punch) => {
        set({ busy: get().busy.filter(x => x !== emp) })
        const now = get().s
        toast.success(`${t(now, "recorded")}: ${t(now, labelKey)} · ${fmtClock(tsTime(p.t), now.lang)}${opts.proj ? ` · ${opts.proj}` : ""}`)
      }
      let labor = opts.labor ?? null
      if (type === "IN" && !labor) {
        const d = laborDefaults(emp), pending = s.pendingPunchTransfers[emp]
        labor = pending || { project: d.project || "", task: d.task || "", tc: d.tc || "", func: d.func || "" }
      }
      const send = (breakEnd?: Punch) => addPunch(emp, type, {
        proj: opts.proj ?? null, task: opts.task ?? null, at: type === "OUT" ? breakEnd?.t || null : null, labor,
        onAccepted: p => {
          if (type === "IN") mutate(d => { delete d.pendingPunchTransfers[emp] })
          finish(p)
        },
      })
      if (type === "OUT" && L.st === "brk") addPunch(emp, "BRK_E", { onAccepted: send })
      else send()
    },

    /* Transfer picker: "home", "current", or the id of a recent transfer punch. */
    pickTransfer: id => {
      const s = get().s, emp = s.persona, L = liveState(s, emp), d = laborDefaults(emp)
      const pending = s.pendingPunchTransfers[emp] || null
      if (L.st === "brk") { toast.error(t(s, "transferAfterBreak")); return }
      let transfer: Labor
      if (id === "home") transfer = { project: d.project || "", task: d.task || "", tc: d.tc || "", func: d.func || "" }
      else if (id === "current") return
      else {
        const source = s.punches[emp].find(p => p.id === id && p.type === "XFER")
        if (!source) return
        transfer = { project: source.labor?.project || "", task: source.labor?.task || "", tc: source.labor?.tc ?? d.tc ?? "", func: source.labor?.func ?? d.func ?? "" }
        const cat = LABOR.opts.proj.find(x => x.v === transfer.project)
        if (!cat || (cat.taskReq && !transfer.task) || (transfer.task && !cat.tasks.includes(transfer.task))) {
          toast.error(appText(get().s.lang, "badLabor"))
          return
        }
      }
      const current = L.st === "out" ? pending || d : L.labor || d
      if (laborKey(current) === laborKey(transfer)) return
      if (L.st === "out") {
        const toHome = laborKey(transfer) === laborKey(d)
        mutate(x => { if (toHome) delete x.pendingPunchTransfers[emp]; else x.pendingPunchTransfers[emp] = transfer })
        toast.success(t(s, toHome ? "xferNextHome" : "xferNextThis"))
        return
      }
      addPunch(emp, "XFER", { proj: L.proj, task: L.task, labor: transfer })
    },

    /** Applies labor categories from the transfer sheet. Returns an error message, or null. */
    applyPunchTransfer: lc => {
      const s = get().s, emp = s.persona, d = laborDefaults(emp), L = liveState(s, emp)
      if (L.st === "brk") return "End your break before transferring."
      const cat = LABOR.opts.proj.find(x => x.v === lc.project)
      if (!cat) return "Labor Category Project is required."
      if (cat.taskReq && !lc.task) return `Labor Category Task / LOB is required for ${cat.l}.`
      if (lc.task && !cat.tasks.includes(lc.task)) return "Choose a Task / LOB that belongs to this labor category project."
      if (L.st === "out") {
        mutate(x => { x.pendingPunchTransfers[emp] = { ...lc } })
        return null
      }
      if (laborKey(L.labor || d) === laborKey(lc)) return "Choose different labor category values for this transfer."
      addPunch(emp, "XFER", { proj: L.proj, task: L.task, labor: lc })
      return null
    },

    setPunchOdooHidden: (code, hide) => mutate(s => {
      s.punchOdooHidden[s.persona] ||= {}
      s.punchOdooHidden[s.persona][code] = hide
    }),
    addOdooProject: code => {
      const s = get().s, emp = s.persona, p = PROJECTS[code]
      if (!p || !p.active || (p.startIn || 0) > HIDE_AHEAD_DAYS || assigned(s, emp).includes(code)) return false
      mutate(x => {
        x.odooAssignments[emp] = [...new Set([...(x.odooAssignments[emp] || []), code])]
        x.punchOdooHidden[emp] ||= {}
        x.punchOdooHidden[emp][code] = false
      })
      return true
    },

    setGridHours: (rowId, day, value) => mutate(s => {
      const r = ensureGrid(s, s.persona, s.period).rows.find(x => x.id === rowId)
      if (r) { r.h[day] = value.trim(); r.unsent = true }
    }),
    setGridTask: (rowId, task) => mutate(s => {
      const r = ensureGrid(s, s.persona, s.period).rows.find(x => x.id === rowId)
      if (r) { r.task = task; r.unsent = true }
    }),
    addGridTask: (proj, chosen) => {
      const s = get().s, g = gridWeekOf(s, s.persona, s.period)
      const used = new Set(g.rows.filter(r => r.proj === proj && !r.archived).map(r => r.task))
      const task = chosen && !used.has(chosen) ? chosen : PROJECTS[proj].tasks.find(t => !used.has(t))
      if (task === undefined) return null
      const id = `r${s.seq + 1}`
      mutate(x => {
        ensureGrid(x, x.persona, x.period).rows.push({ id: `r${++x.seq}`, proj, task, h: Array(7).fill(""), status: "Draft", note: "", archived: false })
      })
      return id
    },
    saveGridDraft: () => mutate(s => {
      ensureGrid(s, s.persona, s.period).draftAt = new Date().toLocaleTimeString(locale(s.lang), { hour: "2-digit", minute: "2-digit" })
    }),
    /* Hiding drops empty rows from the current week; showing adds one back. */
    setProjectHidden: (code, hide) => mutate(s => {
      const emp = s.persona
      s.hidden[emp] ||= {}
      s.hidden[emp][code] = hide
      const g = ensureGrid(s, emp, 0), ex = g.rows.filter(r => r.proj === code && !r.archived)
      if (hide) ex.filter(r => !r.h.some(x => num(x)) && r.status !== "Approved").forEach(r => { r.archived = true })
      else if (!ex.length && PROJECTS[code].active) {
        const restored = g.rows.find(r => r.proj === code && r.archived)
        if (restored) restored.archived = false
        else g.rows.push({ id: `r${++s.seq}`, proj: code, task: PROJECTS[code].taskReq ? "" : PROJECTS[code].tasks[0], h: Array(7).fill(""), status: "Draft", note: "", archived: false })
      }
    }),
    addGridRow: ({ proj, task, paycode, tc, func }) => {
      const s = get().s, emp = s.persona, d = laborDefaults(emp)
      const g = gridWeekOf(s, emp, s.period)
      const same = g.rows.some(r => !r.archived && r.proj === proj && (r.task || "") === (task || "") && ((r.tc ?? d.tc) || "") === tc && ((r.func ?? d.func) || "") === func)
      if (same) return `${proj}${task ? ` / ${task}` : ""} with these labor categories is already on this timecard. Enter hours on the existing row.`
      mutate(x => {
        const week = ensureGrid(x, emp, x.period)
        week.rows.push({ id: `r${++x.seq}`, proj, task, h: Array(7).fill(""), status: "Draft", note: "", archived: false, paycode, tc, func })
        x.hidden[emp] ||= {}
        x.hidden[emp][proj] = false
        x.audit.unshift({ ts: nowTs(), who: PERSONAS[emp].name, emp, what: `Added transfer row ${proj}${task ? ` / ${task}` : ""}`, detail: `${paycode} · ${[tc, func].filter(Boolean).join(" · ")}`, reason: "" })
      })
      return null
    },

    /** Save sends the rows changed since the last save. */
    saveGrid: () => {
      const s = get().s, emp = s.persona, g = gridWeekOf(s, emp, s.period)
      const days = periodDays(s.period)
      const v = gridValidate(g, true, days, d => new Date(d).toLocaleDateString(locale(s.lang), { weekday: "short", day: "numeric" }))
      if (v.errs.length) return { ok: false, message: "Fix the highlighted cells before saving." }
      const isSal = PERSONAS[emp].type === "salary"
      let n = 0
      mutate(x => {
        const week = ensureGrid(x, emp, x.period)
        week.rows.forEach(r => {
          if (r.archived || r.status === "Approved" || !r.unsent) return
          const dayHours = r.h.map(h => num(h) || 0), hrs = dayHours.reduce((a, b) => a + b, 0)
          if (!hrs) { r.unsent = false; return }
          n++
          r.unsent = false
          r.status = isSal ? "Recorded" : "Submitted"
          r.note = ""
          if (!isSal) {
            const a = x.approvals.find(y => y.rowId === r.id)
            if (a) Object.assign(a, { days: dayHours, hours: hrs, task: r.task, status: "Pending", note: "" })
            else x.approvals.push({ id: `a${++x.seq}`, emp, empName: PERSONAS[emp].name, period: periodKey(x.period), proj: r.proj, task: r.task, days: dayHours, hours: hrs, src: "Grid", status: "Pending", note: "", edited: null, rowId: r.id })
          }
        })
        if (n) {
          week.savedAt = new Date().toLocaleTimeString(locale(x.lang), { hour: "2-digit", minute: "2-digit" })
          x.audit.unshift({ ts: nowTs(), who: PERSONAS[emp].name, emp, what: `${isSal ? "Recorded" : "Submitted"} ${n} project row(s)`, detail: fmtRange(x.period, x.lang), reason: "" })
        }
      })
      if (!n) return { ok: true, message: "Nothing to save. Enter hours first." }
      ukg(emp, isSal ? "Project hours recorded" : "Project hours submitted", "POST /v1/timekeeping/timecard", `${n} row(s) · activity hours ${fmtRange(s.period, s.lang)}`)
      return { ok: true, message: isSal ? `${n} row(s) saved. Salaried time needs no approval.` : `${n} row(s) saved and sent for project approval.` }
    },

    setModernEntry: (date, proj, patch, base) => mutate(s => {
      const emp = s.persona
      s.modern[emp] ||= {}
      s.modern[emp][date] ||= {}
      s.modern[emp][date][proj] = { ...base, ...s.modern[emp][date][proj], ...patch }
      const pk = periodKey(s.period)
      if (s.modernStatus[emp]?.[pk] === "Submitted") s.modernStatus[emp][pk] = "Draft"
    }),
    submitModernWeek: () => {
      const s = get().s, emp = s.persona
      const days = buildPeriod(s, emp, s.period)
      mutate(x => {
        x.modernStatus[emp] ||= {}
        x.modernStatus[emp][periodKey(x.period)] = "Submitted"
        x.audit.unshift({ ts: nowTs(), who: PERSONAS[emp].name, emp, what: "Submitted project timecard", detail: `${fmtRange(x.period, x.lang)} · ${days.filter(d => d.date <= todayStr()).length} day(s)`, reason: "" })
      })
      ukg(emp, "Project timecard submitted", "POST /v1/timekeeping/timecard", `project timecard ${fmtRange(s.period, s.lang)}`)
    },
  }
})

/** Convenience selector for the demo state. */
export const useS = () => useDemo(st => st.s)
