import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { fmtRange } from "@/lib/dates"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { useDemo } from "@/store/store"

/** Pay-period stepper. Timecards reach one week back; Project hours also one week ahead. */
export function WeekNav({ min = -1, max = 0, className, meta }: { min?: number; max?: number; className?: string; meta?: React.ReactNode }) {
  const period = useDemo(st => st.s.period)
  const setPeriod = useDemo(st => st.setPeriod)
  const { lang, at, t } = useT()
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-2", className)}>
      <div className="flex items-center gap-1 rounded-2xl border bg-card p-1 shadow-soft">
        <Button variant="ghost" size="icon" aria-label={at("previousWeek")} disabled={period <= min} onClick={() => setPeriod(period - 1)}>
          <ChevronLeft />
        </Button>
        <div className="flex min-w-0 items-center gap-2 px-1.5 text-[15px] font-medium tabular-nums">
          <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="whitespace-nowrap">{fmtRange(period, lang)}</span>
        </div>
        <Button variant="ghost" size="icon" aria-label={at("nextWeek")} disabled={period >= max} onClick={() => setPeriod(period + 1)}>
          <ChevronRight />
        </Button>
      </div>
      {period !== 0 && (
        <Button variant="outline" size="sm" onClick={() => setPeriod(0)}>{t("today")}</Button>
      )}
      {meta && <div className="text-sm text-muted-foreground max-sm:hidden">{meta}</div>}
    </div>
  )
}
