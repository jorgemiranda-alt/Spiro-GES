import { useEffect, useRef, type ReactNode } from "react"
import {
  CalendarDays, Clock3, FolderKanban, House, LayoutGrid, Route, ScanLine, Table2, type LucideIcon,
} from "lucide-react"
import type { ViewId } from "@/data/reference-data"
import { cn } from "@/lib/utils"
import { useDemo } from "@/store/store"
import { useUI } from "@/store/ui"

export const VIEW_ICONS: Record<ViewId, LucideIcon> = {
  home: House, punch: Clock3, timecard: Table2, grid: LayoutGrid, kiosk: ScanLine, journeys: Route, timeoff: CalendarDays, projects: FolderKanban,
}

/** Dashed journey IDs link a part of the screen to its entry in the requirements register. */
export function JourneyTags({ ids, className }: { ids: string; className?: string }) {
  const show = useDemo(st => st.s.settings.tags)
  const go = useDemo(st => st.go)
  const focus = useUI(st => st.focusJourney)
  if (!show) return null
  return (
    <span className={cn("inline-flex gap-1 align-middle whitespace-nowrap", className)}>
      {ids.split(",").map(raw => {
        const id = raw.trim()
        return (
          <button
            key={id}
            type="button"
            onClick={e => { e.stopPropagation(); focus(id); go("journeys") }}
            title={`User journey ${id}`}
            className="rounded-md border border-dashed border-primary/45 px-1.5 py-px font-mono text-[10.5px] leading-4 font-medium text-primary transition-colors hover:bg-primary-soft"
          >
            {id}
          </button>
        )
      })}
    </span>
  )
}

export function PageHeader({ title, description, actions, tags, className, hideDescriptionOnMobile }: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  tags?: string
  className?: string
  /** Phones show the task first; the intro stays on larger screens. */
  hideDescriptionOnMobile?: boolean
}) {
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-3", className)}>
      <div className="min-w-0 space-y-1">
        <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight md:text-[28px]">
          {title}
          {tags && <JourneyTags ids={tags} />}
        </h1>
        {description && <p className={cn("max-w-[68ch] text-[15px] text-muted-foreground", hideDescriptionOnMobile && "max-sm:hidden")}>{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

/** Briefly rings the element marked data-hl={key} after a journey launches the demo. */
export function Highlightable({ hl, className, children, ...rest }: { hl: string; className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null)
  const highlight = useUI(st => st.highlight)
  const clear = useUI(st => st.flash)
  useEffect(() => {
    if (highlight !== hl || !ref.current) return
    const el = ref.current
    el.scrollIntoView({ behavior: "smooth", block: "center" })
    el.animate(
      [{ boxShadow: "0 0 0 0 color-mix(in oklab, var(--citron) 0%, transparent)" }, { boxShadow: "0 0 0 6px color-mix(in oklab, var(--citron) 70%, transparent)" }, { boxShadow: "0 0 0 0 color-mix(in oklab, var(--citron) 0%, transparent)" }],
      { duration: 1400, easing: "cubic-bezier(.16,1,.3,1)" },
    )
    clear(null)
  }, [highlight, hl, clear])
  return <div ref={ref} data-hl={hl} className={cn("rounded-2xl", className)} {...rest}>{children}</div>
}
