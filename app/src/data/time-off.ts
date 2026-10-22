/* Time Off design prototype. Configuration, balances and requests are synthetic.
   Rule deadlines are returned by the sample configuration, not decided by the UI. */
import { addDays, nowTs, ymd } from "@/lib/dates"
import type { TimeOffRequest, TimeOffState } from "@/store/types"

export const TO_DURATION: Record<string, string> = { "Full Day": "full", Hours: "hours", "First Half Day": "first", "Second Half Day": "second" }
export const TO_STATUSES = ["Submitted", "Approved", "Refused", "Cancelled"] as const

export interface TimeOffType { id: string; label: string; durations: string[]; allowPast: boolean }

export const TO_SAMPLE = {
  employees: {
    ava: { name: "Ava Mitchell", manager: "oliver", types: ["pto", "sick", "personal"] },
    maya: { name: "Maya Chen", manager: "oliver", types: ["pto", "sick", "personal"] },
    priya: { name: "Priya Shah", manager: "oliver", types: ["pto", "personal"] },
    marcus: { name: "Marcus Lee", manager: "oliver", types: ["pto", "sick"] },
    lukas: { name: "Lukas Weber", manager: "jonas", types: ["pto", "sick"] },
    zofia: { name: "Zofia Kowalska", manager: "camille", types: ["pto", "sick"] },
    oliver: { name: "Oliver Grant", manager: "camille", types: ["pto", "sick", "personal"] },
  } as Record<string, { name: string; manager: string; types: string[] }>,
  managers: { oliver: "Oliver Grant", jonas: "Jonas Richter", camille: "Camille Dubois" } as Record<string, string>,
  types: [
    { id: "pto", label: "pto", durations: Object.keys(TO_DURATION), allowPast: false },
    { id: "sick", label: "sick", durations: Object.keys(TO_DURATION), allowPast: true },
    { id: "personal", label: "personal", durations: ["Full Day", "Hours"], allowPast: false },
  ] as TimeOffType[],
  // Illustrative work calendar and rule configuration; these are not Spiro policy.
  workdays: [1, 2, 3, 4, 5],
  rules: { pto: { name: "ruleThree", delayMilliseconds: 259200000 } } as Record<string, { name: string; delayMilliseconds: number }>,
  balances: {
    pto: { amount: 72, unit: "hours" },
    sick: { amount: 40, unit: "hours" },
    personal: { amount: 16, unit: "hours" },
  } as Record<string, { amount: number; unit: string }>,
  // Illustrative accrual rules behind the balances above: hours earned each two-week pay period,
  // or a yearly grant on January 1, plus carryover and the most a balance can hold.
  accruals: {
    pto: { perPeriod: 4.62, carryover: 16, cap: 120 },
    sick: { perPeriod: 3.08, carryover: 24, cap: 80 },
    personal: { yearly: 24, carryover: 0, cap: 24 },
  } as Record<string, { perPeriod?: number; yearly?: number; carryover: number; cap: number }>,
}

const toStamp = (date: string, hour = "10:00") => `${date}T${hour}:00`

export function timeOffSeed(): TimeOffState {
  const date = (delta: number) => ymd(addDays(new Date(), delta))
  const request = (
    id: string, emp: string, type: string, start: number, end: number, duration: string,
    status: TimeOffRequest["status"], note: string, age: number,
    extra: { automatic?: boolean; reason?: string } = {},
  ): TimeOffRequest => {
    const created = toStamp(date(-age))
    const r: TimeOffRequest = {
      id, emp, manager: TO_SAMPLE.employees[emp].manager, type, start: date(start), end: date(end), duration,
      hours: duration === "Hours" ? 3 : null, startTime: duration === "Hours" ? "09:00" : "", status, note, created,
      updated: created, history: [{ action: "Submitted", at: created, actor: emp }],
    }
    if (status !== "Submitted") {
      const at = toStamp(date(-age + 3), "10:05")
      r.history.push({
        action: status, at,
        actor: extra.automatic ? "rule" : status === "Cancelled" ? emp : r.manager,
        reason: extra.reason || "", rule: extra.automatic ? "ruleThree" : null,
      })
      r.updated = at
    } else if (TO_SAMPLE.rules[type]) {
      r.autoApproval = {
        at: new Date(new Date(created).getTime() + TO_SAMPLE.rules[type].delayMilliseconds).toISOString(),
        rule: TO_SAMPLE.rules[type].name,
      }
    }
    return r
  }
  return {
    v: 1, lastUpdated: nowTs(), notifications: [], requests: [
      request("TO-1042", "ava", "pto", 14, 16, "Full Day", "Submitted", "Family trip planned for these dates.", 1),
      request("TO-1031", "ava", "pto", -14, -13, "Full Day", "Approved", "", 20, { automatic: true }),
      request("TO-1026", "ava", "personal", 7, 7, "Hours", "Refused", "A personal appointment in the morning.", 23, { reason: "We need coverage for the client setup that morning. Please discuss another date with me." }),
      request("TO-1015", "ava", "pto", -28, -27, "Full Day", "Cancelled", "Plans changed.", 35),
      request("TO-1043", "maya", "pto", 8, 10, "Full Day", "Submitted", "Handover notes will be shared before I leave.", 1),
      request("TO-1044", "priya", "personal", 4, 4, "Full Day", "Submitted", "", 0),
      request("TO-1045", "marcus", "pto", 3, 3, "Second Half Day", "Submitted", "Leaving after the morning briefing.", 0),
      request("TO-1046", "lukas", "pto", 9, 9, "Full Day", "Submitted", "", 0),
      request("TO-1027", "zofia", "pto", 11, 12, "Full Day", "Approved", "", 8),
      request("TO-1041", "ava", "sick", -5, -4, "Full Day", "Submitted", "Unable to work on these dates.", 0),
    ],
  }
}
