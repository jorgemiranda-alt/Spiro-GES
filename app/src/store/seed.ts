import { LABOR } from "@/data/reference-data"
import { timeOffSeed } from "@/data/time-off"
import { periodDays, periodKey, todayStr } from "@/lib/dates"
import type { Approval, DemoState, GridRow, InboxItem, Punch, PunchType } from "./types"

export const STORE_KEY = "spiro-demo-react-v1"

const rid = (p: string) => p + Math.random().toString(36).slice(2, 9)

type Step = [string, PunchType, string?, string?]

function seedDay(date: string, pattern: Step[]): Punch[] {
  return pattern.map(([time, type, proj, task]) => ({
    id: rid("p"), t: `${date} ${time}`, type, proj: proj || null, task: task || null, src: "Seed", sync: "seed",
  }))
}

export function seed(): DemoState {
  const st: DemoState = {
    v: 4, seedWeek: periodKey(0), persona: "ava", lang: "en", view: "punch", period: 0, seq: 1000,
    settings: { simDuplicatePunchError: false, tags: false, hideViewAs: false, layout: "classic" },
    punches: { ava: [], lukas: [] }, comments: { ava: {}, lukas: {} }, tcAppr: {}, hidden: {},
    grid: { zofia: {}, maya: {} }, approvals: [], txns: [], audit: [],
    pendingPunchTransfers: {}, odooAssignments: {}, punchOdooHidden: {},
    modern: {}, modernStatus: {}, timeOff: timeOffSeed(), inbox: seedInbox(), notifyPrefs: {},
  }
  const prev = periodDays(-1), cur = periodDays(0), today = todayStr()

  // Ava: the previous week tells the exception story.
  const A = st.punches.ava
  A.push(...seedDay(prev[0], [["07:58", "IN", "PRJ-4821", "Client delivery"], ["12:00", "BRK_S"], ["12:30", "BRK_E"], ["13:30", "XFER", "PRJ-4908", "Production support"], ["17:00", "OUT"]]))
  A.push(...seedDay(prev[1], [["08:12", "IN", "PRJ-4821", "Booth install"], ["12:00", "BRK_S"], ["12:30", "BRK_E"], ["17:15", "OUT"]]))
  A.push(...seedDay(prev[2], [["07:55", "IN", "PRJ-4908", "Graphics"], ["12:00", "BRK_S"], ["12:20", "BRK_E"], ["16:45", "OUT"]]))
  A.push(...seedDay(prev[3], [["08:00", "IN", "PRJ-4821", "Client delivery"], ["12:00", "BRK_S"], ["12:30", "BRK_E"], ["13:00", "XFER", "PRJ-5012", "Operations"]]))
  A.push(...seedDay(prev[4], [["08:00", "IN", "PRJ-4821", "Client delivery"], ["12:00", "BRK_S"], ["12:30", "BRK_E"], ["16:00", "OUT"]]))
  st.comments.ava[prev[1]] = "Client install ran late at the venue."
  cur.slice(0, 5).forEach(d => {
    if (d < today) A.push(...seedDay(d, [["07:57", "IN", "PRJ-4821", "Client delivery"], ["12:00", "BRK_S"], ["12:30", "BRK_E"], ["14:00", "XFER", "PRJ-4908", "Production support"], ["17:02", "OUT"]]))
  })

  // Lukas: warehouse transfers.
  const L = st.punches.lukas
  const lp: Step[] = [["06:58", "IN", "BER-1102", "Build"], ["09:40", "XFER", "MUC-2077", "Kitting"], ["11:30", "BRK_S"], ["12:00", "BRK_E"], ["13:15", "XFER", "BER-1102", "Load-out"], ["15:31", "OUT"]]
  prev.slice(0, 5).forEach(d => L.push(...seedDay(d, lp)))
  cur.slice(0, 5).forEach(d => { if (d < today) L.push(...seedDay(d, lp)) })

  // Seeded transfers carry the employee's labor-category defaults, never their Odoo project/task.
  Object.entries(st.punches).forEach(([emp, punches]) => punches.forEach(p => {
    if (p.type === "XFER") {
      const d = LABOR.byPersona[emp]
      p.labor = { project: d?.project || "", task: d?.task || "", tc: d?.tc || "", func: d?.func || "" }
    }
  }))

  // Project hours: Zofia (hourly, PL) and Maya (salaried, UK).
  const row = (proj: string, task: string, h: (number | string)[], status: GridRow["status"] = "Draft"): GridRow => ({
    id: rid("r"), proj, task,
    h: [...h, ...Array(7 - h.length).fill("")].map(v => (v === "" ? "" : String(v))),
    status, note: "", archived: false,
  })
  st.grid.zofia[periodKey(-1)] = { rows: [row("PL-8804", "Detailing", [6, 6, 6, 6, 6], "Approved"), row("PL-8650", "Install", [2, 2, 1.5, 2, ""], "Approved"), row("PL-8810", "Supplier calls", ["", "", 0.5, "", 2], "Approved")] }
  st.grid.zofia[periodKey(0)] = { rows: [row("PL-8804", "Detailing", [7.5, 8]), row("PL-OPS", "Admin", [0.5, ""])] }
  st.grid.maya[periodKey(-1)] = { rows: [row("PRJ-5310", "Concept development", [4, 5, 4, 3, 4], "Recorded"), row("PRJ-5266", "Client workshop", [2.5, 2, 3, 3, 2], "Recorded"), row("PRJ-5204", "Internal meeting", [1.5, 1, 1, 2, 2], "Recorded")] }
  st.grid.maya[periodKey(0)] = { rows: [row("PRJ-5310", "Concept development", [4, 5]), row("PRJ-5266", "Client workshop", [2.5, 1]), row("PRJ-5204", "Internal meeting", [1.5, 2])] }

  // Approval queue for other employees.
  const ap = (emp: string, empName: string, off: number, proj: string, task: string, days: number[], status: Approval["status"] = "Pending"): Approval => ({
    id: rid("a"), emp, empName, period: periodKey(off), proj, task, days, hours: days.reduce((a, b) => a + b, 0),
    src: "Timecard", status, note: "", edited: null, rowId: null,
  })
  st.approvals.push(ap("priya", "Priya Shah", 0, "PRJ-4821", "Booth install", [8, 8, 0, 0, 0, 0, 0]))
  st.approvals.push(ap("marcus", "Marcus Lee", 0, "PRJ-4908", "Graphics", [4, 4.5, 4, 0, 0, 0, 0]))
  st.approvals.push(ap("jan", "Jan Nowak", -1, "PL-8804", "Install", [8, 8, 7.5, 8, 6.5, 0, 0]))
  st.approvals.push(ap("jan", "Jan Nowak", -1, "PL-8810", "Supplier calls", [0, 2, 0, 2, 0, 0, 0], "Approved"))
  st.audit.push({ ts: `${prev[4]} 18:05`, who: "System", emp: "ava", what: "Nightly calculated totals pulled from UKG", detail: "POST /v1/timekeeping/timecard_metrics/multi_read", reason: "" })
  return st
}

/** A few recent notifications so each persona's inbox is not empty on first open. */
export function seedInbox(): InboxItem[] {
  const prev = periodDays(-1)
  const item = (emp: string, kind: InboxItem["kind"], key: string, vars: InboxItem["vars"], at: string, read = false): InboxItem =>
    ({ id: rid("n"), emp, kind, key, vars, at, read, emailed: false })
  return [
    item("ava", "project", "ntProjectHot", { name: "Grace Kim", pct: 102, project: "Global Brand Activation" }, `${todayStr()} 08:15`),
    item("ava", "timeoff", "ntTimeOffApproved", { type: "sick", start: prev[1], end: prev[1] }, `${prev[2]} 09:40`, true),
    item("maya", "project", "ntProjectHot", { name: "Maya Chen", pct: 74, project: "Retail Experience Refresh" }, `${todayStr()} 07:50`),
    item("zofia", "project", "ntProjectHot", { name: "Zofia Kowalska", pct: 87, project: "Warsaw Retail Event" }, `${prev[4]} 16:10`),
    item("oliver", "project", "ntProjectHot", { name: "Priya Shah", pct: 91, project: "Global Brand Activation" }, `${todayStr()} 08:15`),
    item("lukas", "project", "ntProjectHot", { name: "Lukas Weber", pct: 83, project: "Berlin Expo Build" }, `${prev[3]} 15:00`, true),
  ]
}

/** Saved state is kept only within the week it was seeded, so relative demo dates stay meaningful. */
export function load(): DemoState {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (raw) {
      const s = JSON.parse(raw) as DemoState
      if (s && s.v === 4 && s.seedWeek === periodKey(0)) { s.inbox ||= seedInbox(); return s }
    }
  } catch {
    /* Private mode or corrupt data: fall back to a fresh seed. */
  }
  return seed()
}

export function persist(s: DemoState) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(s))
  } catch {
    /* Storage may be unavailable; the demo still runs in memory. */
  }
}
