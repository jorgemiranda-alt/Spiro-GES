import { useRef, useState } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { TO_SAMPLE } from "@/data/time-off"
import { addDays, locale, parseYmd, todayStr } from "@/lib/dates"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { useDemo } from "@/store/store"
import { requestHours } from "@/features/time-off/time-off-model"

/** What is already spoken for by requests, and when the balance grows next. */
function useBreakdown(emp: string, type: string, amount: number) {
  const requests = useDemo(st => st.s.timeOff.requests)
  const rule = TO_SAMPLE.accruals[type]
  const today = parseYmd(todayStr())
  const jan1 = new Date(today.getFullYear(), 0, 1)
  const periods = Math.floor((today.getTime() - jan1.getTime()) / (14 * 86400000))
  const mine = requests.filter(r => r.emp === emp && r.type === type)
  const pending = mine.filter(r => r.status === "Submitted").reduce((a, r) => a + requestHours(r), 0)
  const approved = mine.filter(r => r.status === "Approved" && r.end >= todayStr()).reduce((a, r) => a + requestHours(r), 0)
  const next = rule.yearly ? new Date(today.getFullYear() + 1, 0, 1) : addDays(jan1, (periods + 1) * 14)
  return { rule, pending, approved, left: amount - pending - approved, next }
}

/** A balance as time used toward the year's allowance (Beth, Oct 20 walkthrough):
    the bar fills with hours taken plus approved requests, starting empty; pending requests are named
    but neither fill the bar nor reduce the remaining hours, since they may still be refused. */
export function BalanceBar({ emp, type, label, amount, allowance, unit }: {
  emp: string; type: string; label: string; amount: number; allowance: number; unit: string
}) {
  const { lang, ht } = useT()
  const b = useBreakdown(emp, type, amount)
  const n = (v: number) => v.toLocaleString(locale(lang), { maximumFractionDigits: 1 })
  const used = Math.max(0, allowance - amount) + b.approved
  const remaining = Math.max(0, amount - b.approved)
  const empty = remaining <= 0
  const usedText = ht("balUsedOf").replace("{used}", n(used)).replace("{total}", n(allowance))
  return (
    <BalanceDetails emp={emp} type={type} label={label} amount={amount} unit={unit}>
      <span className="flex justify-between text-sm">
        <span>{label}</span>
        <b className={cn("font-semibold tabular-nums", empty && "text-destructive")}>{n(remaining)} {unit}</b>
      </span>
      <span role="img" aria-label={usedText} className="block h-2 overflow-hidden rounded-full bg-muted">
        {/* Turns red once nothing is left. */}
        <span className={cn("block h-full rounded-full", empty ? "bg-destructive" : "bg-cerulean")} style={{ width: `${Math.min(100, Math.round((used / allowance) * 100))}%` }} />
      </span>
      <span className="block text-xs text-muted-foreground tabular-nums">
        {usedText}
        {b.pending > 0 && <> · <span className="text-warning">{ht("balPendingNote").replace("{n}", n(b.pending))}</span></>}
      </span>
    </BalanceDetails>
  )
}

/** A balance row that shows its accrual breakdown on hover, tap or keyboard focus. */
export function BalanceDetails({ emp, type, label, amount, unit, children }: {
  emp: string; type: string; label: string; amount: number; unit: string; children: React.ReactNode
}) {
  const { lang, at } = useT()
  const [open, setOpen] = useState(false)
  const timer = useRef<number>(undefined)
  const b = useBreakdown(emp, type, amount)
  const fmt = (v: number) => v.toLocaleString(locale(lang), { maximumFractionDigits: 1 })
  const hover = (next: boolean) => (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setOpen(next), next ? 120 : 160)
  }
  const line = (key: string, value: number, sign = "") => (
    <div className="flex justify-between gap-6 py-1"><dt className="text-muted-foreground">{at(key)}</dt><dd className="tabular-nums">{sign}{fmt(value)} h</dd></div>
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onPointerEnter={hover(true)}
          onPointerLeave={hover(false)}
          aria-label={`${label}: ${fmt(amount)} ${unit}`}
          className="-mx-2 block w-[calc(100%+1rem)] space-y-1.5 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-muted/70 data-[state=open]:bg-muted/70"
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent side="left" align="start" className="w-64 rounded-2xl p-4 text-sm" onPointerEnter={hover(true)} onPointerLeave={hover(false)}>
        <h3 className="font-semibold">{label}</h3>
        <dl className="mt-2">
          {line("balAvailable", amount)}
          {b.pending > 0 && line("balPending", b.pending, "−")}
          {b.approved > 0 && line("balApproved", b.approved, "−")}
          <div className={cn("flex justify-between gap-6 border-t pt-2 font-semibold", b.left < 0 && "text-destructive")}>
            <dt>{at("balProjected")}</dt><dd className="tabular-nums">{fmt(b.left)} h</dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-muted-foreground">
          {at("balNext")}: {b.next.toLocaleDateString(locale(lang), { month: "short", day: "numeric" })} · +{(b.rule.yearly ?? b.rule.perPeriod ?? 0).toLocaleString(locale(lang))} h
        </p>
      </PopoverContent>
    </Popover>
  )
}
