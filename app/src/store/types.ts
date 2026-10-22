import type { PersonaId, ViewId } from "@/data/reference-data"

export type PunchType = "IN" | "OUT" | "BRK_S" | "BRK_E" | "XFER"

export interface Labor {
  project: string
  task: string
  tc: string
  func: string
}

export interface Punch {
  id: string
  /** "YYYY-MM-DD HH:MM" in local time. */
  t: string
  type: PunchType
  proj: string | null
  task: string | null
  labor?: Labor | null
  src: string
  /** Transaction id of the simulated UKG call, or "seed". */
  sync: string | null
  edited?: boolean
}

export type RowStatus = "Draft" | "Submitted" | "Recorded" | "Approved" | "Rejected"

export interface GridRow {
  id: string
  proj: string
  task: string
  /** Seven daily values, Monday first, kept as typed strings so partial input survives. */
  h: string[]
  status: RowStatus
  note: string
  archived: boolean
  paycode?: string
  tc?: string
  func?: string
}

export interface GridWeek {
  rows: GridRow[]
  auto?: boolean
  savedAt?: string
}

export interface Approval {
  id: string
  emp: string
  empName: string
  period: string
  proj: string
  task: string
  days: number[]
  hours: number
  src: string
  status: "Pending" | "Approved" | "Rejected"
  note: string
  edited: null
  rowId: string | null
}

export interface Txn {
  id: string
  ts: string
  emp: string
  action: string
  endpoint: string
  summary: string
  status: "Submitted" | "Accepted" | "Failed"
  ref: string
  error?: string
}

export interface AuditEntry {
  ts: string
  who: string
  emp: string
  what: string
  detail: string
  reason: string
}

/** One project's hourly entry in the Modern timecard. Times are "HH:MM"; break is minutes. */
export interface ModernEntry {
  start: string
  end: string
  brk: string
  show: boolean
}

export type TimecardLayout = "classic" | "modern"

export interface Settings {
  simDuplicatePunchError: boolean
  tags: boolean
  hideViewAs: boolean
  layout: TimecardLayout
}

export interface TimeOffHistory {
  action: string
  at: string
  actor: string
  reason?: string
  rule?: string | null
}

export interface TimeOffRequest {
  id: string
  emp: string
  manager: string
  type: string
  start: string
  end: string
  duration: string
  hours: number | null
  startTime: string
  status: "Submitted" | "Approved" | "Refused" | "Cancelled"
  note: string
  created: string
  updated: string
  history: TimeOffHistory[]
  autoApproval?: { at: string; rule: string }
}

export interface TimeOffNotification {
  id: string
  emp: string
  status: string
  reason: string
  at: string
}

export interface TimeOffState {
  v: 1
  lastUpdated: string
  notifications: TimeOffNotification[]
  requests: TimeOffRequest[]
}

export interface DemoState {
  v: 4
  seedWeek: string
  persona: PersonaId
  lang: string
  view: ViewId
  period: number
  seq: number
  settings: Settings
  punches: Record<string, Punch[]>
  comments: Record<string, Record<string, string>>
  tcAppr: Record<string, Record<string, string>>
  hidden: Record<string, Record<string, boolean>>
  grid: Record<string, Record<string, GridWeek>>
  approvals: Approval[]
  txns: Txn[]
  audit: AuditEntry[]
  pendingPunchTransfers: Record<string, Labor>
  odooAssignments: Record<string, string[]>
  punchOdooHidden: Record<string, Record<string, boolean>>
  /** Modern hourly timecard entries: emp → date → project → entry. */
  modern: Record<string, Record<string, Record<string, ModernEntry>>>
  /** Modern timecard week status: emp → period key → status. */
  modernStatus: Record<string, Record<string, "Draft" | "Submitted">>
  timeOff: TimeOffState
}
