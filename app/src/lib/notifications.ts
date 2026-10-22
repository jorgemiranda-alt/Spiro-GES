/* In-app inbox and email preferences. Email delivery is simulated: items are only marked as emailed. */
import type { Draft } from "immer"
import { nowTs } from "@/lib/dates"
import type { DemoState, InboxItem, NotifyChannels, NotifyKind } from "@/store/types"

export const NOTIFY_KINDS: NotifyKind[] = ["timeoff", "project"]
const DEFAULT: NotifyChannels = { app: true, email: false }
export const INBOX_LIMIT = 50

export const prefsFor = (s: DemoState, emp: string, kind: NotifyKind): NotifyChannels =>
  ({ ...DEFAULT, ...s.notifyPrefs?.[emp]?.[kind] })

/** Sends a notification through the channels the recipient turned on. */
export function notifyPerson(s: Draft<DemoState>, emp: string, kind: NotifyKind, key: string, vars: InboxItem["vars"] = {}) {
  const pref = prefsFor(s as DemoState, emp, kind)
  if (!pref.app && !pref.email) return
  s.inbox ||= []
  // With in-app off, an emailed item is kept as already read so it still shows in history.
  s.inbox.unshift({ id: "n" + Date.now().toString(36) + s.inbox.length, emp, kind, key, vars, at: nowTs(), read: !pref.app, emailed: pref.email })
  // Keep each person's inbox to the most recent items.
  let kept = 0
  s.inbox = s.inbox.filter(n => n.emp !== emp || ++kept <= INBOX_LIMIT)
}

export const inboxFor = (s: DemoState, emp: string) => (s.inbox || []).filter(n => n.emp === emp)
export const unreadCount = (s: DemoState, emp: string) => inboxFor(s, emp).filter(n => !n.read).length
export const emailFor = (name: string) => name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, ".") + "@spiro.example"
