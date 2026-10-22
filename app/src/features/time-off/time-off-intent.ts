import { create } from "zustand"

/** What another screen (Home) wants Time Off to show when it opens. */
export interface TimeOffIntent {
  /** "team" is honored only for a Manager persona. */
  scope?: "mine" | "team"
  /** Opens the new-request form (always in "mine" scope). */
  startRequest?: boolean
  /** Status filter: "all" | "Submitted" | "Approved" | "Refused" | "Cancelled". */
  filter?: string
  /** Selects and opens one request, e.g. "TO-1042". */
  requestId?: string
}

interface IntentStore {
  intent: TimeOffIntent | null
  /** Call before `go("timeoff")`. The Time Off view consumes and clears it. */
  set: (intent: TimeOffIntent) => void
  clear: () => void
}

export const useTimeOffIntent = create<IntentStore>(set => ({
  intent: null,
  set: intent => set({ intent }),
  clear: () => set({ intent: null }),
}))
