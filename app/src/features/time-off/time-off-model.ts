/* Time Off rules and session UI state, ported from public/js/time-off.js.
   Configuration, balances and requests are synthetic sample data. */
import { create } from "zustand"
import { TO_DURATION, TO_SAMPLE, type TimeOffType } from "@/data/time-off"
import { addDays, locale, nowTs, parseYmd, todayStr, ymd } from "@/lib/dates"
import { toText } from "@/lib/i18n"
import { useDemo } from "@/store/store"
import type { DemoState, TimeOffRequest } from "@/store/types"

export type Scope = "mine" | "team"
export type Screen = "list" | "form" | "review" | "confirmation"
export type DecisionAction = "cancel" | "approve" | "refuse"

export interface TimeOffDraft {
  type: string
  start: string
  end: string
  duration: string
  hours: string
  startTime: string
  note: string
}
/** Field key → TO_COPY error key. */
export type DraftErrors = Partial<Record<"type" | "start" | "end" | "hours" | "startTime", string>>

export interface TimeOffUI {
  owner: string
  scope: Scope
  screen: Screen
  selected: string | null
  /** Mobile only: the detail replaces the list. */
  detailOpen: boolean
  filter: string
  typeFilter: string
  employeeFilter: string
  from: string
  until: string
  draft: TimeOffDraft | null
  errors: DraftErrors
  busy: boolean
  refreshing: boolean
  balance: { amount: number; unit: string; at: string } | null
  confirmed: string | null
  /** "YYYY-MM" shown in the calendar. */
  month: string
  rangePicking: boolean
  lastDecision: string | null
  dialog: { id: string; action: DecisionAction; owner: string } | null
}

export const freshUI = (owner: string): TimeOffUI => ({
  owner, scope: "mine", screen: "list", selected: null, detailOpen: false, filter: "all", typeFilter: "all",
  employeeFilter: "all", from: "", until: "", draft: null, errors: {}, busy: false, refreshing: false, balance: null,
  confirmed: null, month: todayStr().slice(0, 7), rangePicking: false, lastDecision: null, dialog: null,
})

interface UIStore {
  ui: TimeOffUI
  patch: (p: Partial<TimeOffUI> | ((ui: TimeOffUI) => Partial<TimeOffUI>)) => void
  reset: (owner: string) => void
}

/** Session-only screen state; survives navigating away and back, like the prototype's UI.to. */
export const useTimeOffUI = create<UIStore>(set => ({
  ui: freshUI(useDemo.getState().s.persona),
  patch: p => set(st => ({ ui: { ...st.ui, ...(typeof p === "function" ? p(st.ui) : p) } })),
  reset: owner => set({ ui: freshUI(owner) }),
}))

export const clearedFilters = { filter: "all", typeFilter: "all", employeeFilter: "all", from: "", until: "" } as const

/* ---------- configuration ---------- */

export const toType = (id: string): TimeOffType | undefined => TO_SAMPLE.types.find(x => x.id === id)
export const eligibleTypes = (emp: string) => TO_SAMPLE.types.filter(t => TO_SAMPLE.employees[emp]?.types.includes(t.id))
export const personName = (id: string) => TO_SAMPLE.employees[id]?.name || TO_SAMPLE.managers[id] || id
export const managerName = (id: string) => TO_SAMPLE.managers[id] || id
/** In this sample only Oliver manages employees who are demo personas. */
export const isManager = (persona: string) => persona === "oliver"
export const typeLabel = (lang: string, id: string) => toText(lang, toType(id)?.label || id)

export const visibleIn = (r: TimeOffRequest, scope: Scope, persona: string) =>
  scope === "team" && isManager(persona) ? r.manager === persona && r.emp !== persona : r.emp === persona
export const accessible = (r: TimeOffRequest | undefined, persona: string): r is TimeOffRequest =>
  !!r && (r.emp === persona || (isManager(persona) && r.manager === persona && r.emp !== persona))
export const teamQueue = (s: DemoState) =>
  s.timeOff.requests.filter(r => r.manager === s.persona && r.emp !== s.persona && r.status === "Submitted").length

export function filtered(s: DemoState, ui: TimeOffUI) {
  return s.timeOff.requests.filter(r => visibleIn(r, ui.scope, s.persona)).filter(r =>
    (ui.filter === "all" || r.status === ui.filter) && (ui.typeFilter === "all" || r.type === ui.typeFilter) &&
    (ui.employeeFilter === "all" || r.emp === ui.employeeFilter) && (!ui.from || r.end >= ui.from) && (!ui.until || r.start <= ui.until),
  ).sort((a, b) => b.created.localeCompare(a.created) || b.id.localeCompare(a.id))
}

/* ---------- formatting ---------- */

export const fmtDate = (date: string, lang: string, long = false) =>
  parseYmd(date).toLocaleDateString(locale(lang), { month: long ? "long" : "short", day: "numeric", year: "numeric" })
export const fmtDateRange = (r: { start: string; end: string }, lang: string) =>
  r.start === r.end ? fmtDate(r.start, lang) : `${fmtDate(r.start, lang)} – ${fmtDate(r.end, lang)}`
export function fmtWhen(stamp: string, lang: string) {
  const d = new Date(stamp.replace(" ", "T"))
  return Number.isNaN(d.getTime()) ? stamp : d.toLocaleString(locale(lang), { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
}
export function quantity(r: { duration: string; start: string; end: string; hours: number | string | null }, lang: string) {
  const l = locale(lang)
  if (r.duration === "Hours") return `${Number(r.hours || 0).toLocaleString(l)} ${toText(lang, "hours").toLowerCase()}`
  if (!r.start || !r.end || r.end < r.start) return toText(lang, TO_DURATION[r.duration])
  const start = parseYmd(r.start)
  const total = Math.max(0, Math.round((parseYmd(r.end).getTime() - start.getTime()) / 86400000) + 1)
  let days = Math.floor(total / 7) * TO_SAMPLE.workdays.length
  for (let i = 0; i < total % 7; i++) if (TO_SAMPLE.workdays.includes(addDays(start, i).getDay())) days++
  const amount = days * (r.duration === "Full Day" ? 1 : 0.5)
  if (!amount) return toText(lang, "amountUnavailable")
  return `${amount.toLocaleString(l)} ${toText(lang, amount === 1 ? "day" : "days")}`
}

/* ---------- validation ---------- */

export const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && ymd(parseYmd(value)) === value

export function validate(d: TimeOffDraft, persona: string): DraftErrors {
  const errors: DraftErrors = {}
  const type = toType(d.type)
  if (!type || !eligibleTypes(persona).some(x => x.id === type.id) || !type.durations.includes(d.duration)) {
    errors.type = "checkFields"
    return errors
  }
  const dates: ("start" | "end")[] = d.duration === "Full Day" ? ["start", "end"] : ["start"]
  dates.forEach(k => {
    if (!validDate(d[k])) errors[k] = "requiredDate"
    else if (!type.allowPast && d[k] < todayStr()) errors[k] = "pastError"
  })
  if (d.duration === "Full Day" && validDate(d.start) && validDate(d.end) && d.end < d.start) errors.end = "invalidRange"
  if (d.duration === "Hours") {
    if (!Number.isFinite(Number(d.hours)) || Number(d.hours) <= 0 || d.hours.trim() === "") errors.hours = "hoursError"
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(d.startTime)) errors.startTime = "timeError"
  }
  return errors
}

export const newDraft = (persona: string): TimeOffDraft => ({
  type: eligibleTypes(persona)[0]?.id || "", start: "", end: "", duration: "Full Day", hours: "", startTime: "09:00", note: "",
})

export const nextId = (s: DemoState) =>
  "TO-" + (Math.max(1046, ...s.timeOff.requests.map(r => Number(r.id.replace("TO-", "")) || 0)) + 1)

/** Local timestamp in the "YYYY-MM-DDTHH:MM:00" form the sample data uses. */
export const stampNow = () => nowTs().replace(" ", "T") + ":00"

/* ---------- state changes ---------- */

const notifyDraft = (s: { timeOff: DemoState["timeOff"] }, r: TimeOffRequest) => {
  s.timeOff.notifications.unshift({ id: r.id, emp: r.emp, status: r.status, reason: r.history[r.history.length - 1]?.reason || "", at: r.updated })
}
export { notifyDraft as notify }

/** Applies configured automatic approvals whose deadline has passed. Returns true when anything changed. */
export function applyRules(at = Date.now()) {
  const due = (r: TimeOffRequest) => r.status === "Submitted" && !!r.manager && !!r.autoApproval && new Date(r.autoApproval.at).getTime() <= at
  if (!useDemo.getState().s.timeOff.requests.some(due)) return false
  useDemo.getState().mutate(s => {
    s.timeOff.requests.forEach(r => {
      if (!due(r as TimeOffRequest) || !r.autoApproval) return
      r.status = "Approved"
      r.updated = r.autoApproval.at
      r.history.push({ action: "Approved", at: r.updated, actor: "rule", rule: r.autoApproval.rule })
      notifyDraft(s, r as TimeOffRequest)
    })
  })
  return true
}
