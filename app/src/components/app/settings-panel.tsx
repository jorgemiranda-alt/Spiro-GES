import { useId, type ReactNode } from "react"
import { Check, RotateCcw } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { useDemo } from "@/store/store"
import type { ColorScheme } from "@/store/types"
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

/** Swatches mirror the tokens in index.css: navigation, primary, background. */
const SCHEMES: { id: ColorScheme; name: string; note: string; nav: string; primary: string; bg: string }[] = [
  { id: "spiro", name: "Spiro", note: "Graphite and Marine on Cream", nav: "#282c25", primary: "#284e59", bg: "#f8f7ef" },
  { id: "marine", name: "Marine", note: "Marine navigation, Cerulean accents", nav: "#1a4f5a", primary: "#1a4f5a", bg: "#f6f8f4" },
  { id: "fern", name: "Fern", note: "Fern with Citron highlights", nav: "#4d554b", primary: "#4d554b", bg: "#f8f7ef" },
  { id: "cloud", name: "Cloud", note: "Cool Cloud surfaces, Graphite navigation", nav: "#20271e", primary: "#1a4f5a", bg: "#f4f7f9" },
]

function SchemePicker() {
  const current = useDemo(st => st.s.settings.scheme) || "spiro"
  const setSetting = useDemo(st => st.setSetting)
  return (
    <div role="radiogroup" aria-label="Color scheme" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {SCHEMES.map(x => {
        const on = x.id === current
        return (
          <button
            key={x.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => setSetting("scheme", x.id)}
            className={cn(
              "group relative flex flex-col gap-2 rounded-xl border bg-card p-2 text-left outline-none transition-[border-color,box-shadow] focus-visible:ring-3 focus-visible:ring-ring/50",
              on ? "border-primary ring-2 ring-primary/25" : "hover:border-input",
            )}
          >
            {/* A tiny app: sidebar, a card with a primary bar, on the scheme's background. */}
            <span className="flex h-14 overflow-hidden rounded-lg ring-1 ring-black/5" style={{ background: x.bg }} aria-hidden>
              <span className="flex w-1/3 flex-col gap-1 p-1.5" style={{ background: x.nav }}>
                <span className="h-1.5 w-3/4 rounded-full bg-citron" />
                <span className="h-1 w-1/2 rounded-full bg-white/40" />
                <span className="h-1 w-2/3 rounded-full bg-white/40" />
              </span>
              <span className="flex flex-1 flex-col justify-center gap-1 p-1.5">
                <span className="h-1.5 w-2/3 rounded-full bg-black/15" />
                <span className="h-3 w-full rounded" style={{ background: x.primary }} />
              </span>
            </span>
            <span className="min-w-0 px-0.5">
              <span className="flex items-center justify-between gap-1 text-sm font-semibold">
                {x.name}
                {on && <Check className="size-4 text-primary" aria-hidden />}
              </span>
              <span className="block text-xs leading-snug text-muted-foreground">{x.note}</span>
            </span>
          </button>
        )
      })}
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
      <section className="space-y-2 pb-5">
        <h3 className="text-sm font-semibold">Color scheme</h3>
        <p className="text-sm text-muted-foreground">Light themes built from the Spiro brand palette. Status colors stay the same in every theme.</p>
        <SchemePicker />
      </section>
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
