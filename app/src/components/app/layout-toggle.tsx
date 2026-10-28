import { LayoutGrid, Table2 } from "lucide-react"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { useDemo } from "@/store/store"
import type { TimecardLayout } from "@/store/types"

/** Classic (UKG-style grid) or Modern (project cards). Stakeholders flip it during reviews. */
export function LayoutToggle({ className }: { className?: string }) {
  const layout = useDemo(st => st.s.settings.layout)
  const setLayout = useDemo(st => st.setLayout)
  const { at } = useT()
  const options: { value: TimecardLayout; icon: typeof Table2; hint: string }[] = [
    { value: "classic", icon: Table2, hint: at("classicHint") },
    { value: "modern", icon: LayoutGrid, hint: at("modernHint") },
  ]
  return (
    <div className={cn("space-y-1.5", className)}>
    <div role="radiogroup" aria-label={at("layout")} className="inline-flex rounded-xl bg-secondary p-1">
      {options.map(o => {
        const on = layout === o.value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            title={o.hint}
            onClick={() => setLayout(o.value)}
            className={cn(
              "flex min-h-9 items-center gap-2 rounded-[10px] px-3 text-sm font-medium transition-[background-color,color,box-shadow] duration-200",
              on ? "bg-card text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <o.icon className="size-4" aria-hidden />
            <span>{at(o.value)}</span>
          </button>
        )
      })}
    </div>
    </div>
  )
}
