import { useId, type ReactNode } from "react"
import { RotateCcw } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { useT } from "@/lib/i18n"
import { useDemo } from "@/store/store"
import { useUI } from "@/store/ui"
import { ResponsivePanel } from "./responsive-panel"
import { LayoutToggle } from "./layout-toggle"
import { TimeOffDemoSettings, useTimeOffScenarios } from "@/features/time-off/time-off-demo"
import { useTimeOffUI } from "@/features/time-off/time-off-model"

function ToggleRow({ checked, onChange, title, children }: { checked: boolean; onChange: (v: boolean) => void; title: string; children: ReactNode }) {
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

export function SettingsPanel() {
  const open = useUI(st => st.settingsOpen)
  const setOpen = useUI(st => st.setSettingsOpen)
  const settings = useDemo(st => st.s.settings)
  const setSetting = useDemo(st => st.setSetting)
  const reset = useDemo(st => st.reset)
  const { at } = useT()

  return (
    <ResponsivePanel
      open={open}
      onOpenChange={setOpen}
      title={at("demoSettings")}
      description="Data stays in this browser only. Nothing is sent to UKG or Odoo; calls are simulated."
      footer={
        <Button variant="destructive" size="lg" className="w-full sm:w-auto" onClick={() => {
          reset()
          useTimeOffScenarios.setState({ failSubmit: false, balanceUnavailable: false, failRefresh: false })
          useTimeOffUI.getState().reset(useDemo.getState().s.persona)
          setOpen(false)
          toast.success("Demo data reset.")
        }}>
          <RotateCcw /> Reset demo data
        </Button>
      }
    >
      <section className="space-y-2 pb-2">
        <h3 className="text-sm font-semibold">{at("layout")} · timecards</h3>
        <p className="text-sm text-muted-foreground">Compare the current UKG-style grid with the proposed project cards. The choice applies to My Timecard and Project hours.</p>
        <LayoutToggle className="mt-2" />
      </section>
      <div className="divide-y">
        <ToggleRow checked={settings.tags} onChange={v => setSetting("tags", v)} title="Show journey tags">
          Dashed IDs link each part of the screen to its journey.
        </ToggleRow>
        <ToggleRow checked={settings.hideViewAs} onChange={v => setSetting("hideViewAs", v)} title="Hide “Viewing as”">
          Hides the persona switcher for cleaner screenshots.
        </ToggleRow>
        <ToggleRow checked={settings.simDuplicatePunchError} onChange={v => setSetting("simDuplicatePunchError", v)} title="Simulate a duplicate-punch error">
          The next Punch In or Punch Out shows the error returned by UKG (PU-08).
        </ToggleRow>
      </div>
      <TimeOffDemoSettings />
      <section className="mt-3 rounded-xl bg-muted p-4 text-sm">
        <h3 className="mb-1.5 font-semibold">Try these paths</h3>
        <ol className="list-decimal space-y-1 pl-4 text-muted-foreground">
          <li>Ava › Punch: punch in, transfer, break, punch out.</li>
          <li>Ava › My Timecard: switch between Classic and Modern.</li>
          <li>Maya › Project hours: enter weekly hours per project.</li>
          <li>Oliver › Time Off: review team requests.</li>
          <li>Lukas › Kiosk: choose an action and scan a badge.</li>
        </ol>
      </section>
    </ResponsivePanel>
  )
}
