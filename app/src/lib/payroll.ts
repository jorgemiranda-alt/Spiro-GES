/* Payroll cut-offs for changing hours, as sent by Spiro (Oct 2026):
   - United States and Canada: bi-weekly payroll, noon Tuesday of pay week (Pacific);
     weekly payroll, noon Monday (Pacific).
   - EMEA: the 15th of each month in the Netherlands and Germany; the 19th everywhere else.
   Which US/Canada employees are weekly and the real pay calendar are not known yet, so the
   bi-weekly pay weeks below are anchored on an illustrative date. */
import { addDays, parseYmd, todayStr } from "@/lib/dates"

export type PayFrequency = "weekly" | "biweekly" | "monthly"

export interface Cutoff {
  frequency: PayFrequency
  /** The next date changes close (local calendar date). */
  due: Date
  /** "12:00 PT" for North America; EMEA rules give a date only. */
  time?: string
  /** app-copy key describing the rule. */
  rule: "cutoffBiweekly" | "cutoffWeekly" | "cutoff15" | "cutoff19"
}

/** Illustrative: a bi-weekly pay week starting Monday Jan 5, 2026, then every second week. */
const BIWEEKLY_ANCHOR = parseYmd("2026-01-05")
/** Demo assumption until Spiro confirms who is paid weekly. */
const WEEKLY_EMPLOYEES = new Set<string>()

const NORTH_AMERICA = new Set(["US", "CA"])
const ON_THE_15TH = new Set(["NL", "DE"])

/** The next payroll cut-off for an employee, from today. */
export function nextCutoff(emp: string, country: string, from = parseYmd(todayStr())): Cutoff {
  if (NORTH_AMERICA.has(country)) {
    if (WEEKLY_EMPLOYEES.has(emp)) {
      // Next Monday (today counts until the cut-off passes).
      const due = addDays(from, (8 - from.getDay()) % 7)
      return { frequency: "weekly", due, time: "12:00 PT", rule: "cutoffWeekly" }
    }
    // Next Tuesday that falls in a pay week.
    let due = addDays(from, (9 - from.getDay()) % 7)
    const weeks = Math.round((due.getTime() - BIWEEKLY_ANCHOR.getTime()) / (7 * 86400000))
    if (weeks % 2 !== 0) due = addDays(due, 7)
    return { frequency: "biweekly", due, time: "12:00 PT", rule: "cutoffBiweekly" }
  }
  const day = ON_THE_15TH.has(country) ? 15 : 19
  let due = new Date(from.getFullYear(), from.getMonth(), day)
  if (due < from) due = new Date(from.getFullYear(), from.getMonth() + 1, day)
  return { frequency: "monthly", due, rule: day === 15 ? "cutoff15" : "cutoff19" }
}
