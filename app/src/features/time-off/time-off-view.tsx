import { useEffect } from "react"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { useDemo } from "@/store/store"
import { ensureOwner, selectRequest, setFilter, setScope, startRequest } from "./time-off-actions"
import { Confirmation, RequestForm, ReviewStep } from "./time-off-flow"
import { useTimeOffIntent } from "./time-off-intent"
import { RequestList } from "./time-off-list"
import { applyRules, fmtWhen, freshUI, useTimeOffUI } from "./time-off-model"

export default function TimeOffView() {
  const { tt, lang } = useT()
  const persona = useDemo(st => st.s.persona)
  const lastUpdated = useDemo(st => st.s.timeOff.lastUpdated)
  const stored = useTimeOffUI(st => st.ui)
  const confirmedExists = useDemo(st => !!stored.confirmed && st.s.timeOff.requests.some(x => x.id === stored.confirmed && x.emp === persona))
  const intent = useTimeOffIntent(st => st.intent)
  // Until the effect below resets it, never show another persona's screen state.
  const ui = stored.owner === persona ? stored : freshUI(persona)

  // toInit: the UI state belongs to the current persona, and due automatic approvals are applied.
  useEffect(() => {
    ensureOwner()
    applyRules()
  }, [persona])

  // The prototype re-applied rules every minute.
  useEffect(() => {
    const id = window.setInterval(() => applyRules(), 60000)
    return () => window.clearInterval(id)
  }, [])

  // Honor an intent from another screen (Home), then clear it.
  useEffect(() => {
    if (!intent) return
    useTimeOffIntent.getState().clear()
    ensureOwner()
    if (intent.startRequest) { startRequest(); return }
    if (intent.scope) setScope(intent.scope)
    if (intent.filter) setFilter("filter", intent.filter)
    if (intent.requestId) selectRequest(intent.requestId)
  }, [intent])

  let content
  if (ui.screen === "form" && ui.draft) content = <RequestForm draft={ui.draft} />
  else if (ui.screen === "review" && ui.draft) content = <ReviewStep draft={ui.draft} />
  else if (ui.screen === "confirmation" && ui.confirmed && confirmedExists) content = <Confirmation id={ui.confirmed} />
  else content = <RequestList />

  const listShown = content.type === RequestList
  return (
    <div className="space-y-6">
      {content}
      {/* On phones the list's floating request button sits at the bottom right; keep this text clear of it. */}
      <footer className={cn("flex flex-wrap justify-between gap-x-6 gap-y-1 border-t pt-4 text-xs text-muted-foreground", listShown && "max-sm:pr-20")}>
        <span>{tt("sample")}</span>
        {listShown && <span>{tt("latest", { time: fmtWhen(lastUpdated, lang) })}</span>}
      </footer>
    </div>
  )
}

