/* ---------- Project plans (simulated Odoo Project → Task → Subtask, UKG actuals) ----------
   Budgets come from each project's Odoo estimate; actual hours are split across the team so
   the dashboard totals match the project figures used elsewhere in the demo. */
import { PERSONAS, PROJECTS } from "@/data/reference-data"

export interface TeamMember { id: string; name: string; initials: string; role: string }
export interface Assignment { member: string; scoped: number; actual: number }
export interface Subtask { id: string; name: string; budget: number; actual: number; people: Assignment[] }
export interface PlanTask { id: string; name: string; budget: number; actual: number; subtasks: Subtask[] }
export interface MemberTotals { member: TeamMember; scoped: number; actual: number }
export interface ProjectPlan { code: string; budget: number; actual: number; tasks: PlanTask[]; team: MemberTotals[] }

const PEOPLE: Record<string, [string, string]> = {
  priya: ["Priya Shah", "Booth Technician"], marcus: ["Marcus Lee", "Graphic Designer"], daniel: ["Daniel Ortiz", "Project Manager"],
  grace: ["Grace Kim", "Account Executive"], mia: ["Mia Hoffmann", "Stand Builder"], felix: ["Felix Braun", "Electrician"],
  jonas: ["Jonas Richter", "Warehouse Lead"], jan: ["Jan Nowak", "Install Technician"], ola: ["Ola Wiśniewska", "Detailer"],
  piotr: ["Piotr Zieliński", "Site Supervisor"], hannah: ["Hannah Price", "Strategist"], tom: ["Tom Ellis", "Designer"],
  sophie: ["Sophie Turner", "Account Director"],
}

/** Everyone who bills time to each project; employee personas are listed first. */
const TEAMS: Record<string, string[]> = {
  "PRJ-4821": ["ava", "priya", "marcus", "daniel", "grace"],
  "PRJ-4908": ["ava", "marcus", "grace"],
  "BER-1102": ["lukas", "mia", "felix", "jonas"],
  "MUC-2077": ["lukas", "jonas", "mia"],
  "PL-8804": ["zofia", "jan", "ola", "piotr"],
  "PL-8810": ["zofia", "jan"],
  "PRJ-5310": ["maya", "tom", "sophie", "hannah"],
  "PRJ-5266": ["maya", "hannah", "sophie"],
}

const SUBTASKS: Record<string, string[]> = {
  "Client delivery": ["Kickoff & briefing", "On-site delivery", "Wrap report"],
  "Booth install": ["Pre-build", "On-site install", "Dismantle"],
  "Project management": ["Planning", "Client reporting"],
  "Production support": ["Preparation", "Floor support"],
  Graphics: ["Design", "Print production"],
  Build: ["Structure", "Electrics", "Finishing"],
  "Load-out": ["Dismantle", "Transport"],
  Kitting: ["Picking", "Assembly"],
  Packing: ["Packing", "Dispatch"],
  Detailing: ["Drawings", "Revisions"],
  Install: ["Install", "Snagging"],
  Supervision: ["Site supervision", "Handover"],
  "Supplier calls": ["Sourcing", "Follow-up"],
  "Quality checks": ["Inspection", "Sign-off"],
  "Concept development": ["Research", "Concepts", "Presentation"],
  "Client workshop": ["Preparation", "Workshop", "Follow-up"],
  Strategy: ["Analysis", "Recommendations"],
}

/** Small deterministic hash so the sample data is stable between reloads. */
function hash(text: string) {
  let h = 2166136261
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return (h >>> 0) / 4294967295
}
/** Relative burn rate of each team member, in team order. */
const PACE = [1.18, 0.97, 0.8, 0.66, 1.06]
const half = (v: number) => Math.round(v * 2) / 2
const sum = <T,>(items: T[], pick: (x: T) => number) => items.reduce((a, x) => a + pick(x), 0)

function member(id: string): TeamMember {
  const persona = PERSONAS[id as keyof typeof PERSONAS]
  const [name, role] = persona ? [persona.name, persona.role] : PEOPLE[id]
  return { id, name, role, initials: name.split(" ").map(w => w[0]).join("").slice(0, 2) }
}

/** Splits a total into parts by weight, in half hours, with the last part absorbing rounding. */
function split(total: number, weights: number[]) {
  const w = sum(weights, x => x)
  const parts = weights.map(x => half((total * x) / w))
  parts[parts.length - 1] = half(total - sum(parts.slice(0, -1), x => x))
  return parts
}

function buildPlan(code: string): ProjectPlan {
  const p = PROJECTS[code], ids = TEAMS[code]
  let slot = 0
  const draft = p.tasks.map((taskName, ti) => {
    const names = SUBTASKS[taskName] || ["Planning", "Delivery"]
    const taskBudget = split(p.est, p.tasks.map((t, i) => 1 + hash(code + t + i)))[ti]
    const budgets = split(taskBudget, names.map(n => 1 + hash(code + taskName + n)))
    const subtasks = names.map((name, si) => {
      const lead = ids[slot % ids.length], second = ids[(slot + 1) % ids.length]
      slot++
      const crew = budgets[si] >= 24 && lead !== second ? [lead, second] : [lead]
      const scoped = crew.length > 1 ? split(budgets[si], [65, 35]) : [budgets[si]]
      const people = crew.map((m, i) => {
        // People burn faster or slower than the project's overall pace, so some run hot and some don't.
        const pace = PACE[ids.indexOf(m) % PACE.length] * (0.94 + hash(code + name + m) * 0.12)
        return { member: m, scoped: scoped[i], actual: scoped[i] * pace }
      })
      return { id: `${code}-${ti}-${si}`, name, budget: budgets[si], people }
    })
    return { id: `${code}-${ti}`, name: taskName, budget: taskBudget, subtasks }
  })
  // Scale so the project total matches the actual hours shown on Home.
  const raw = sum(draft.flatMap(t => t.subtasks.flatMap(s => s.people)), x => x.actual)
  const k = raw ? p.used / raw : 0
  const tasks: PlanTask[] = draft.map(t => {
    const subtasks = t.subtasks.map(st => {
      const people = st.people.map(x => ({ ...x, actual: half(x.actual * k) }))
      return { ...st, people, actual: sum(people, x => x.actual) }
    })
    return { ...t, subtasks, actual: sum(subtasks, x => x.actual) }
  })
  const team = ids.map(id => {
    const rows = tasks.flatMap(t => t.subtasks.flatMap(s => s.people.filter(x => x.member === id)))
    return { member: member(id), scoped: sum(rows, x => x.scoped), actual: sum(rows, x => x.actual) }
  })
  return { code, budget: p.est, actual: sum(tasks, x => x.actual), tasks, team }
}

export const PLAN_CODES = Object.keys(TEAMS)
const cache = new Map<string, ProjectPlan>()
export function projectPlan(code: string) {
  if (!cache.has(code)) cache.set(code, buildPlan(code))
  return cache.get(code)!
}

/** Projects a persona can open: those they bill to, or for a manager, those they approve. */
export function visibleProjects(persona: string) {
  return PLAN_CODES.filter(code => TEAMS[code].includes(persona) || PROJECTS[code].approver === persona)
}

/** Beth's thresholds: green 1–74 %, yellow 75–90 %, red 91 % and above of scoped hours. */
export type Level = "none" | "green" | "yellow" | "red"
export const pctOf = (actual: number, budget: number) => (budget ? Math.round((actual / budget) * 100) : 0)
export const levelOf = (pct: number): Level => (pct <= 0 ? "none" : pct < 75 ? "green" : pct <= 90 ? "yellow" : "red")
