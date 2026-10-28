import { Clock } from "lucide-react"
import { PERSONAS, type PersonaId } from "@/data/reference-data"
import { locale, parseYmd, todayStr } from "@/lib/dates"
import { useT } from "@/lib/i18n"
import { nextCutoff } from "@/lib/payroll"
import { cn } from "@/lib/utils"

/** When the employee's hours lock for payroll, from Spiro's cut-off rules (lib/payroll). */
export function CutoffNote({ emp, className }: { emp: string; className?: string }) {
  const { lang, at } = useT()
  const c = nextCutoff(emp, PERSONAS[emp as PersonaId].country)
  const days = Math.round((c.due.getTime() - parseYmd(todayStr()).getTime()) / 86400000)
  const when = c.due.toLocaleDateString(locale(lang), { weekday: "short", month: "short", day: "numeric" })
  const soon = days <= 1
  const relative = days === 0 ? at("cutoffToday") : days === 1 ? at("cutoffTomorrow") : at("cutoffInDays", { n: days })
  return (
    <p className={cn(
      "flex items-start gap-2.5 rounded-xl px-3.5 py-2.5 text-sm",
      soon ? "bg-warning-soft text-warning" : "bg-muted text-foreground",
      className,
    )}>
      <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span className="min-w-0">
        <b className="font-semibold">{at("cutoffTitle")}: {when}{c.time ? ` · ${c.time}` : ""}</b>
        <span className={cn("ml-1.5", !soon && "text-muted-foreground")}>({relative})</span>
        <span className={cn("block text-xs", soon ? "text-warning/90" : "text-muted-foreground")}>{at(c.rule)}</span>
      </span>
    </p>
  )
}
