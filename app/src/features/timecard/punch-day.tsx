import { ArrowRightLeft } from "lucide-react"
import { StatusPill } from "@/components/app/status"
import { PERSONAS, PROJECTS, type PersonaId } from "@/data/reference-data"
import { fmtClock, fmtH, todayStr } from "@/lib/dates"
import { laborDefaults, laborText, type Day, type Segment } from "@/lib/engine"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import type { Labor } from "@/store/types"

/** People whose time comes from punches (Punch screen or kiosk): their timecard mirrors UKG and is read-only. */
export const isPunchBased = (emp: string) => PERSONAS[emp as PersonaId].views.some(v => v === "punch" || v === "kiosk")

/** One colour dot per project/task line, from the brand palette. */
const SWATCH = ["bg-primary", "bg-cerulean", "bg-citron", "bg-success", "bg-muted-foreground"]

interface Line { key: string; proj: string | null; task: string | null; segs: Segment[]; total: number; swatch: string }

/** Segments grouped by project + task in the order they first happen (a transfer can change the task). */
function linesOf(day: Day): Line[] {
  const lines = new Map<string, Line>()
  day.segs.forEach(s => {
    const key = `${s.proj || ""}|${s.task || ""}`
    if (!lines.has(key)) lines.set(key, { key, proj: s.proj, task: s.task, segs: [], total: 0, swatch: SWATCH[lines.size % SWATCH.length] })
    const l = lines.get(key)!
    l.segs.push(s)
    l.total += s.hours || 0
  })
  return [...lines.values()]
}

/** Modern My Timecard for punch-based staff: every punch, grouped by project and task, read-only like Classic. */
export function PunchDay({ day, emp }: { day: Day; emp: string }) {
  const { lang, t, at } = useT()
  const lines = linesOf(day)
  const inLabel = (k: string) => (k === "Transfer" ? t("transfer") : k === "Break end" ? t("endBreak") : t("punchIn"))
  const outLabel = (k: string) => (k === "Transfer" ? t("transfer") : k === "Break" ? t("startBreak") : t("punchOut"))

  if (!day.segs.length) {
    return (
      <div className="rounded-2xl border border-dashed bg-card px-6 py-10 text-center text-sm text-muted-foreground">
        {day.date > todayStr() ? at("pnFuture") : day.sched ? t("absent") : at("pnNone")}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-3">
        {lines.map(l => {
          const p = l.proj ? PROJECTS[l.proj] : null
          const labor = laborText((l.segs.find(s => s.labor)?.labor ?? laborDefaults(emp)) as Labor)
          return (
            <li key={l.key} className="rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
              <div className="flex items-start gap-3">
                <span className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", l.swatch)} aria-hidden />
                <div className="min-w-0 flex-1">
                  <h3 className="text-[15px] leading-snug font-semibold">
                    {l.proj ? <><span className="tabular-nums">{l.proj}</span> · {p?.name}</> : t("noProject")}
                  </h3>
                  {/* The UKG labor category the time is paid under. */}
                  <dl className="mt-1.5 space-y-1 text-sm">
                    <div className="flex min-w-0 items-baseline gap-2">
                      <dt className="sr-only">{at("srcUkgLabor")}</dt>
                      <dd className="line-clamp-2 min-w-0 text-muted-foreground">
                        {labor || "—"}
                      </dd>
                    </div>
                  </dl>
                </div>
                <div className="shrink-0 text-right text-base font-semibold tabular-nums">{fmtH(l.total, lang)} h</div>
              </div>
              <ol className="mt-3 divide-y border-t">
                {l.segs.map((s, i) => (
                  <li key={i} className="flex items-center gap-3 py-2.5 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 tabular-nums">
                        <span className="font-medium">{fmtClock(s.in.t, lang)}</span>
                        <span className="text-muted-foreground">→</span>
                        {s.out ? <span className="font-medium">{fmtClock(s.out.t, lang)}</span> : s.live ? <StatusPill tone="success">{at("pnLive")}</StatusPill> : <StatusPill tone="danger">{t("missed")}</StatusPill>}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        {s.in.kind === "Transfer" && <ArrowRightLeft className="size-3 shrink-0 text-primary" aria-hidden />}
                        {inLabel(s.in.kind)}{s.out ? ` → ${outLabel(s.out.kind)}` : ""}
                      </div>
                    </div>
                    <span className="shrink-0 text-muted-foreground tabular-nums">{s.hours ? `${fmtH(s.hours, lang)} h` : "—"}</span>
                  </li>
                ))}
              </ol>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
