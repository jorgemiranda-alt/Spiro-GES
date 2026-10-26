/* Time Off actions, ported from toAction and its helpers in public/js/time-off.js. */
import { toast } from "sonner"
import { notifyPerson } from "@/lib/notifications"
import { TO_SAMPLE } from "@/data/time-off"
import { nowTs, todayStr } from "@/lib/dates"
import { toText } from "@/lib/i18n"
import { useDemo } from "@/store/store"
import type { TimeOffRequest } from "@/store/types"
import { useTimeOffScenarios } from "./time-off-demo"
import {
  accessible, applyRules, clearedFilters, eligibleTypes, filtered, isManager, isWorkday, newDraft, nextId, notify, stampNow,
  toType, useTimeOffUI, validDate, validate, type DecisionAction, type Scope, type TimeOffDraft,
} from "./time-off-model"

const demo = () => useDemo.getState().s
const ui = () => useTimeOffUI.getState().ui
const patch = (p: Parameters<ReturnType<typeof useTimeOffUI.getState>["patch"]>[0]) => useTimeOffUI.getState().patch(p)
const tx = (key: string, vars?: Record<string, string | number>) => toText(demo().lang, key, vars)

/** Moves focus once React has rendered the next state. */
export function focusSoon(id: string, fallback = "to-screen-title") {
  window.setTimeout(() => {
    const el = document.getElementById(id) as HTMLElement | null
    const target = el && el.getClientRects().length ? el : document.getElementById(fallback)
    target?.focus({ preventScroll: false })
  }, 40)
}
const scrollTop = () => window.scrollTo({ top: 0 })

/** Makes the UI state belong to the current persona (the prototype's toInit). */
export function ensureOwner() {
  const persona = demo().persona
  if (ui().owner !== persona) useTimeOffUI.getState().reset(persona)
  if (!isManager(persona) && ui().scope !== "mine") patch({ scope: "mine" })
}

export function startRequest() {
  ensureOwner()
  const persona = demo().persona
  if (!eligibleTypes(persona).length) return
  patch({ scope: "mine", screen: "form", errors: {}, draft: newDraft(persona), month: todayStr().slice(0, 7), rangePicking: false })
  focusSoon("to-type")
  scrollTop()
}

export function backToList() {
  patch({ screen: "list", detailOpen: false })
  focusSoon("to-screen-title")
}

export function editDraft() {
  if (ui().busy) return
  patch({ screen: "form", errors: {} })
  focusSoon("to-type")
}

export function setScope(scope: Scope) {
  const next: Scope = scope === "team" && isManager(demo().persona) ? "team" : "mine"
  patch({ scope: next, ...clearedFilters, filter: next === "team" ? "Submitted" : "all", detailOpen: false, selected: null, screen: "list" })
}

export function selectRequest(id: string) {
  const s = demo()
  const r = s.timeOff.requests.find(x => x.id === id)
  if (!accessible(r, s.persona)) return
  const u = ui()
  const scope: Scope = r.emp === s.persona ? "mine" : u.scope
  const visible = u.screen === "list" && filtered(s, { ...u, scope }).some(x => x.id === r.id)
  patch({ selected: r.id, screen: "list", detailOpen: true, scope, ...(visible ? {} : clearedFilters) })
  focusSoon("to-request-detail")
}

export function closeDetail() {
  const id = ui().selected
  patch({ detailOpen: false })
  focusSoon(`to-row-${id}`)
}

export function clearFilters() {
  patch({ ...clearedFilters })
}

export function setFilter(key: "filter" | "typeFilter" | "employeeFilter" | "from" | "until", value: string) {
  patch({ [key]: value, detailOpen: false, selected: null })
}

export function dismissNotification(id: string) {
  const persona = demo().persona
  useDemo.getState().mutate(s => { s.timeOff.notifications = s.timeOff.notifications.filter(n => !(n.emp === persona && n.id === id)) })
}

/* ---------- form ---------- */

export function setDraftField<K extends keyof TimeOffDraft>(key: K, value: string) {
  const u = ui()
  if (!u.draft) return
  const d: TimeOffDraft = { ...u.draft, [key]: value }
  const errors = { ...u.errors }
  let { month, rangePicking } = u
  if (key === "type" || key === "duration") {
    const type = toType(d.type)
    if (type && !type.durations.includes(d.duration)) d.duration = type.durations[0]
    if (d.duration !== "Full Day") d.end = d.start || ""
    rangePicking = false
    patch({ draft: d, errors: {}, rangePicking })
    return
  }
  delete errors[key as keyof typeof errors]
  if (key === "start") {
    if (d.duration !== "Full Day") d.end = value
    if (validDate(value)) {
      month = value.slice(0, 7)
      if (!d.end || d.end < value) d.end = value
    }
    rangePicking = false
  }
  if (key === "end") rangePicking = false
  // Say so as soon as a typed date lands on a weekend, rather than waiting for Review.
  if ((key === "start" || key === "end") && validDate(value) && !isWorkday(value)) errors[key as "start" | "end"] = "weekendError"
  patch({ draft: d, errors, month, rangePicking })
}

export function pickDate(date: string) {
  const u = ui()
  const d = u.draft
  if (!d) return
  if (!toType(d.type)?.allowPast && date < todayStr()) return
  if (!isWorkday(date)) return
  const next = { ...d }
  let rangePicking = u.rangePicking
  if (d.duration !== "Full Day") { next.start = date; next.end = date; rangePicking = false }
  else if (!rangePicking) { next.start = date; next.end = date; rangePicking = true }
  else {
    next.end = date
    if (next.end < next.start) [next.start, next.end] = [next.end, next.start]
    rangePicking = false
  }
  patch({ draft: next, rangePicking, errors: {} })
}

export function reviewDraft() {
  const u = ui()
  if (!u.draft) return
  const persona = demo().persona
  const errors = validate(u.draft, persona)
  const keys = Object.keys(errors)
  if (keys.length) {
    patch({ errors })
    toast.error(tx("checkFields"))
    focusSoon("to-" + keys[0])
    return
  }
  const draft = u.draft.duration !== "Full Day" ? { ...u.draft, end: u.draft.start } : u.draft
  const balance = useTimeOffScenarios.getState().balanceUnavailable ? null : { ...TO_SAMPLE.balances[draft.type], at: nowTs() }
  patch({ draft, errors: {}, balance, screen: "review" })
  scrollTop()
  focusSoon("to-screen-title")
}

export async function submitDraft() {
  const u0 = ui()
  if (u0.busy || u0.screen !== "review" || !u0.draft) return
  const owner = demo().persona
  if (Object.keys(validate(u0.draft, owner)).length) { patch({ screen: "form" }); reviewDraft(); return }
  const d = u0.draft
  const draft = { ...d, hours: d.duration === "Hours" ? Number(d.hours) : null, startTime: d.duration === "Hours" ? d.startTime : "" }
  patch({ busy: true })
  await new Promise(resolve => setTimeout(resolve, 450))
  const stillHere = () => demo().persona === owner && ui().owner === owner
  if (useTimeOffScenarios.getState().failSubmit) {
    useTimeOffScenarios.getState().set("failSubmit", false)
    patch({ busy: false })
    if (stillHere() && demo().view === "timeoff" && ui().screen === "review") toast.error(tx("submitError"))
    return
  }
  const created = stampNow()
  const id = nextId(demo())
  const rule = TO_SAMPLE.rules[draft.type]
  const r: TimeOffRequest = {
    ...draft, id, emp: owner, manager: TO_SAMPLE.employees[owner].manager, status: "Submitted", created, updated: created,
    history: [{ action: "Submitted", at: created, actor: owner }],
  }
  if (rule) r.autoApproval = { at: new Date(new Date(created).getTime() + rule.delayMilliseconds).toISOString(), rule: rule.name }
  useDemo.getState().mutate(s => {
    s.timeOff.requests.unshift(r)
    s.timeOff.lastUpdated = nowTs()
    if (r.manager) notifyPerson(s, r.manager, "timeoff", "ntTimeOffSubmitted", { who: owner, type: r.type, start: r.start, end: r.end })
  })
  if (ui().owner !== owner) return
  patch({ busy: false, confirmed: id, balance: null, screen: "confirmation" })
  if (stillHere()) {
    scrollTop()
    focusSoon("to-screen-title")
    toast.success(tx("submittedTitle"))
  }
}

/* ---------- decisions ---------- */

export function openDecision(id: string, action: DecisionAction) {
  const s = demo()
  const r = s.timeOff.requests.find(x => x.id === id)
  if (!accessible(r, s.persona) || r.status !== "Submitted") return
  if (action === "cancel" && r.emp !== s.persona) return
  if (action !== "cancel" && (!isManager(s.persona) || r.manager !== s.persona || r.emp === s.persona)) return
  patch({ dialog: { id, action, owner: s.persona } })
}

export function closeDecision() {
  patch({ dialog: null })
}

export function commitDecision(reasonInput: string) {
  const context = ui().dialog
  if (!context || context.owner !== demo().persona) return
  applyRules()
  const s = demo()
  const r = s.timeOff.requests.find(x => x.id === context.id)
  const reason = reasonInput.trim()
  if (!accessible(r, s.persona) || r.status !== "Submitted") {
    closeDecision()
    toast.error(tx("changed"))
    return
  }
  const mine = r.emp === s.persona
  const manager = isManager(s.persona) && r.manager === s.persona && !mine
  if ((context.action === "cancel" && !mine) || (context.action !== "cancel" && !manager)) return
  if (context.action === "refuse" && !reason) return
  const status = ({ cancel: "Cancelled", approve: "Approved", refuse: "Refused" } as const)[context.action]
  useDemo.getState().mutate(st => {
    const x = st.timeOff.requests.find(y => y.id === context.id)
    if (!x) return
    x.status = status
    x.updated = stampNow()
    x.history.push({ action: status, at: x.updated, actor: st.persona, reason })
    if (context.action !== "cancel") notify(st, x as TimeOffRequest)
    st.timeOff.lastUpdated = nowTs()
  })
  patch({ dialog: null, lastDecision: r.id })
  focusSoon("to-request-detail")
  toast.success(tx("updated"))
}

/* ---------- refresh ---------- */

export async function refresh() {
  if (ui().refreshing) return
  const owner = ui().owner
  patch({ refreshing: true })
  await new Promise(resolve => setTimeout(resolve, 350))
  if (ui().owner !== owner) { useTimeOffUI.setState(st => ({ ui: { ...st.ui, refreshing: false } })); return }
  patch({ refreshing: false })
  const failed = useTimeOffScenarios.getState().failRefresh
  if (failed) useTimeOffScenarios.getState().set("failRefresh", false)
  else {
    applyRules()
    useDemo.getState().mutate(s => { s.timeOff.lastUpdated = nowTs() })
  }
  if (failed && demo().view === "timeoff") {
    toast.error(tx("refreshError"), { action: { label: tx("retry"), onClick: () => { void refresh() } } })
  }
}

