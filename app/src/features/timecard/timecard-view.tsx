import { useMemo } from "react"
import { RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { PageHeader } from "@/components/app/common"
import { LayoutToggle } from "@/components/app/layout-toggle"
import { Notice } from "@/components/app/status"
import { WeekNav } from "@/components/app/week-nav"
import { fmtClock, hm, periodKey } from "@/lib/dates"
import { buildPeriod } from "@/lib/engine"
import { useT } from "@/lib/i18n"
import { useDemo } from "@/store/store"
import { ClassicTimecard, TimecardTotals } from "./classic-timecard"
import { ModernTimecard } from "./modern-timecard"

export default function TimecardView() {
  const s = useDemo(st => st.s)
  const { lang, t, at } = useT()
  const emp = s.persona
  const days = useMemo(() => buildPeriod(s, emp, s.period), [s, emp])
  const locked = !!s.tcAppr[emp]?.[periodKey(s.period)]
  const modern = s.settings.layout === "modern"

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title={t("timecard")}
        tags="TC-01,TC-02"
        hideDescriptionOnMobile
        description={modern ? "Your time by project. Pick a day, then check start, end and break for each project." : at("readOnlyNote")}
        actions={<LayoutToggle />}
      />
      <WeekNav
        min={-1}
        max={0}
        meta={
          <span className="inline-flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Refresh timecard"
              className="grid size-9 place-items-center rounded-lg hover:bg-muted"
              onClick={() => toast("Reading timecard from UKG…")}
            >
              <RefreshCw className="size-4" aria-hidden />
            </button>
            Loaded {fmtClock(hm(new Date()), lang)}
          </span>
        }
      />
      {modern ? (
        <ModernTimecard key={`${emp}-${s.period}`} emp={emp} days={days} locked={locked} />
      ) : (
        <>
          {locked && <Notice tone="success">This timecard is approved and read-only.</Notice>}
          <ClassicTimecard emp={emp} days={days} locked={locked} />
          <TimecardTotals days={days} />
          <p className="hidden text-sm text-muted-foreground sm:block lg:hidden">Swipe the table sideways to see every column.</p>
        </>
      )}
    </div>
  )
}
