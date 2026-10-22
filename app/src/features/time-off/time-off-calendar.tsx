import { useEffect, useRef, useState, type KeyboardEvent } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { addDays, locale, parseYmd, todayStr, ymd } from "@/lib/dates"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { pickDate } from "./time-off-actions"
import { fmtDate, toType, useTimeOffUI, type TimeOffDraft } from "./time-off-model"

const shiftMonth = (month: string, delta: number) => {
  const d = parseYmd(month + "-01")
  d.setMonth(d.getMonth() + delta)
  return ymd(d).slice(0, 7)
}

/** Month grid with roving focus: arrows move by day/week, Home/End to week edges, PageUp/PageDown by month. */
export function TimeOffCalendar({ draft }: { draft: TimeOffDraft }) {
  const { tt, lang } = useT()
  const month = useTimeOffUI(st => st.ui.month)
  const patch = useTimeOffUI(st => st.patch)
  const today = todayStr()
  const single = draft.duration !== "Full Day"
  const allowPast = !!toType(draft.type)?.allowPast
  const first = parseYmd(month + "-01")
  const offset = (first.getDay() + 6) % 7
  const total = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  const days = Array.from({ length: total }, (_, i) => ymd(new Date(first.getFullYear(), first.getMonth(), i + 1)))
  const weekdays = Array.from({ length: 7 }, (_, i) => addDays(new Date(2026, 0, 5), i).toLocaleDateString(locale(lang), { weekday: "narrow" }))
  const longWeekdays = Array.from({ length: 7 }, (_, i) => addDays(new Date(2026, 0, 5), i).toLocaleDateString(locale(lang), { weekday: "long" }))

  const inMonth = (d: string | undefined) => !!d && d.slice(0, 7) === month
  const [focusDate, setFocusDate] = useState<string>("")
  const tabDate = inMonth(focusDate) ? focusDate : inMonth(draft.start) ? draft.start : inMonth(today) ? today : days[0]
  const grid = useRef<HTMLDivElement>(null)
  const wantFocus = useRef(false)

  useEffect(() => {
    if (!wantFocus.current) return
    wantFocus.current = false
    grid.current?.querySelector<HTMLButtonElement>(`[data-date="${tabDate}"]`)?.focus()
  }, [tabDate, month])

  const move = (date: string) => {
    wantFocus.current = true
    setFocusDate(date)
    if (!inMonth(date)) patch({ month: date.slice(0, 7) })
  }
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, date: string) => {
    const d = parseYmd(date)
    const dow = (d.getDay() + 6) % 7
    const map: Record<string, () => Date> = {
      ArrowLeft: () => addDays(d, -1),
      ArrowRight: () => addDays(d, 1),
      ArrowUp: () => addDays(d, -7),
      ArrowDown: () => addDays(d, 7),
      Home: () => addDays(d, -dow),
      End: () => addDays(d, 6 - dow),
      PageUp: () => { const x = new Date(d); x.setMonth(x.getMonth() - 1); return x },
      PageDown: () => { const x = new Date(d); x.setMonth(x.getMonth() + 1); return x },
    }
    const fn = map[e.key]
    if (!fn) return
    e.preventDefault()
    move(ymd(fn()))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold capitalize" aria-live="polite">
          {first.toLocaleDateString(locale(lang), { month: "long", year: "numeric" })}
        </h3>
        <div className="flex gap-1">
          <Button type="button" variant="ghost" size="icon" aria-label={tt("previousMonth")} onClick={() => patch({ month: shiftMonth(month, -1) })}>
            <ChevronLeft />
          </Button>
          <Button type="button" variant="ghost" size="icon" aria-label={tt("nextMonth")} onClick={() => patch({ month: shiftMonth(month, 1) })}>
            <ChevronRight />
          </Button>
        </div>
      </div>
      <div ref={grid} role="group" aria-label={first.toLocaleDateString(locale(lang), { month: "long", year: "numeric" })}>
        <div className="grid grid-cols-7 pb-1 text-center text-xs font-medium text-muted-foreground">
          {weekdays.map((w, i) => <abbr key={i} title={longWeekdays[i]} className="py-1 no-underline">{w}</abbr>)}
        </div>
        <div className="grid grid-cols-7 gap-y-1">
          {Array.from({ length: offset }, (_, i) => <span key={"pad" + i} aria-hidden />)}
          {days.map((date, i) => {
            const selected = date === draft.start || (!single && date === draft.end)
            const inRange = !single && !!draft.start && !!draft.end && date > draft.start && date < draft.end
            const disabled = !allowPast && date < today
            const isToday = date === today
            return (
              <div key={date} className={cn("flex justify-center", inRange && "bg-primary-soft", !single && draft.start !== draft.end && date === draft.start && "rounded-l-full bg-primary-soft", !single && draft.start !== draft.end && date === draft.end && "rounded-r-full bg-primary-soft")}>
                <button
                  type="button"
                  data-date={date}
                  tabIndex={date === tabDate ? 0 : -1}
                  aria-label={fmtDate(date, lang, true)}
                  aria-pressed={selected}
                  aria-disabled={disabled || undefined}
                  aria-current={isToday ? "date" : undefined}
                  onClick={() => { if (!disabled) { setFocusDate(date); pickDate(date) } }}
                  onKeyDown={e => onKey(e, date)}
                  className={cn(
                    "grid size-10 place-items-center sm:size-11 rounded-full text-[15px] tabular-nums outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                    selected ? "bg-primary font-semibold text-primary-foreground" : "hover:bg-muted",
                    isToday && !selected && "font-semibold text-primary ring-1 ring-primary/40",
                    disabled && "cursor-not-allowed text-muted-foreground/45 hover:bg-transparent",
                  )}
                >
                  {i + 1}
                </button>
              </div>
            )
          })}
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{tt(single ? "calendarSingleHelp" : "calendarHelp")}</p>
    </div>
  )
}
