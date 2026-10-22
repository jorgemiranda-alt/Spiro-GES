import { useId, type ReactNode } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { timeOffSeed } from "@/data/time-off"
import { nowTs } from "@/lib/dates"
import { useDemo } from "@/store/store"
import { create } from "zustand"
import { applyRules, useTimeOffUI } from "./time-off-model"

/** Preview scenarios from the prototype's demo settings. Session-only (the prototype kept them in S.settings). */
interface Scenarios {
  failSubmit: boolean
  balanceUnavailable: boolean
  failRefresh: boolean
  set: (key: "failSubmit" | "balanceUnavailable" | "failRefresh", value: boolean) => void
}
export const useTimeOffScenarios = create<Scenarios>(set => ({
  failSubmit: false,
  balanceUnavailable: false,
  failRefresh: false,
  set: (key, value) => set({ [key]: value } as Partial<Scenarios>),
}))

/** Advances the sample rule to its next configured deadline. */
export function runSampleRule() {
  const eligible = useDemo.getState().s.timeOff.requests
    .filter(r => r.status === "Submitted" && r.autoApproval)
    .sort((a, b) => a.autoApproval!.at.localeCompare(b.autoApproval!.at))
  if (eligible.length) applyRules(new Date(eligible[0].autoApproval!.at).getTime())
  useDemo.getState().mutate(s => { s.timeOff.lastUpdated = nowTs() })
  toast.success("Sample approval rule applied.")
}

export function resetTimeOffSample() {
  useDemo.getState().mutate(s => { s.timeOff = timeOffSeed() })
  useTimeOffScenarios.setState({ failSubmit: false, balanceUnavailable: false, failRefresh: false })
  useTimeOffUI.getState().reset(useDemo.getState().s.persona)
}

function Row({ checked, onChange, title, children }: { checked: boolean; onChange: (v: boolean) => void; title: string; children: ReactNode }) {
  const id = useId()
  return (
    <div className="flex items-start justify-between gap-4 py-3.5">
      <label htmlFor={id} className="min-w-0 cursor-pointer space-y-0.5">
        <span className="block text-[15px] font-medium">{title}</span>
        <span className="block text-sm text-muted-foreground">{children}</span>
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} className="mt-0.5" />
    </div>
  )
}

/** Drop-in section for the demo settings panel. */
export function TimeOffDemoSettings() {
  const sc = useTimeOffScenarios()
  return (
    <section className="space-y-1">
      <h3 className="text-sm font-semibold">Time Off preview scenarios</h3>
      <div className="divide-y">
        <Row checked={sc.failSubmit} onChange={v => sc.set("failSubmit", v)} title="Next request cannot be submitted">
          Shows the recovery message and preserves entered details.
        </Row>
        <Row checked={sc.balanceUnavailable} onChange={v => sc.set("balanceUnavailable", v)} title="Current balance is unavailable">
          Shows this state only on the review step.
        </Row>
        <Row checked={sc.failRefresh} onChange={v => sc.set("failRefresh", v)} title="Next request refresh cannot finish">
          Retains the last confirmed statuses.
        </Row>
      </div>
      <div className="flex flex-wrap gap-2 pt-2">
        <Button variant="outline" onClick={runSampleRule}>Run sample approval rule</Button>
        <Button variant="outline" onClick={resetTimeOffSample}>Reset Time Off sample data</Button>
      </div>
      <p className="pt-1 text-xs text-muted-foreground">Advances the sample rule to its next configured deadline. Sample data only.</p>
    </section>
  )
}
