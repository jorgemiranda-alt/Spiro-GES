import { useState } from "react"
import { ArrowRightLeft, Check, ChevronDown, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ResponsivePanel } from "@/components/app/responsive-panel"
import { Notice } from "@/components/app/status"
import { LABOR, PERSONAS, laborTaskName, type PersonaId } from "@/data/reference-data"
import { fmtClock, fmtDay, todayStr, tsDate, tsTime } from "@/lib/dates"
import { dayPunches, laborDefaults, laborKey, laborParts, type LiveState } from "@/lib/engine"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { useDemo } from "@/store/store"
import type { Labor, Punch } from "@/store/types"

/** Distinct, complete transfers from the employee's history, newest first. */
export function recentTransfers(punches: Punch[]) {
  const seen = new Set<string>(), out: Punch[] = []
  ;[...punches].sort((a, b) => b.t.localeCompare(a.t)).forEach(p => {
    if (p.type !== "XFER" || !p.labor) return
    const cat = LABOR.opts.proj.find(x => x.v === p.labor!.project)
    if (!cat || (cat.taskReq && !p.labor.task) || (p.labor.task && !cat.tasks.includes(p.labor.task))) return
    const k = laborKey(p.labor)
    if (!seen.has(k)) { seen.add(k); out.push(p) }
  })
  return out
}

/** Shows the transfer in effect (or staged for the next Punch In) and switches to home or a recent one. */
export function TransferPicker({ emp, L, busy }: { emp: string; L: LiveState; busy: boolean }) {
  const s = useDemo(st => st.s)
  const pick = useDemo(st => st.pickTransfer)
  const { lang, t } = useT()
  const home = laborDefaults(emp), homeKey = laborKey(home)
  const pending = s.pendingPunchTransfers[emp] || null
  const current = L.st === "out" ? pending || home : L.labor || home
  const curKey = laborKey(current), isHome = curKey === homeKey
  const onBreak = L.st === "brk"
  let status = "", tone: "next" | "live" | "" = ""
  if (!isHome && L.st === "out") { status = t("xferNextPunch"); tone = "next" }
  else if (!isHome) {
    const from = [...dayPunches(s, emp, todayStr())].reverse().find(p => (p.type === "XFER" || p.type === "IN") && laborKey(p.labor) === curKey)
    status = from ? t("xferSince").replace("{t}", fmtClock(tsTime(from.t), lang)) : t("xferCurrent")
    tone = "live"
  }
  const parts = laborParts(current)
  const recents = recentTransfers(s.punches[emp] || []).filter(p => laborKey(p.labor) !== homeKey)
  const option = (id: string, labor: Partial<Labor>, on: boolean, meta?: string) => {
    const p = laborParts(labor)
    return (
      <DropdownMenuItem key={id} onSelect={() => pick(id)} className="items-start gap-3 rounded-lg py-2.5">
        <span className="mt-0.5 grid size-4 place-items-center">{on && <Check className="size-4 text-primary" />}</span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{p.title}</span>
          {(meta || p.detail) && <span className="block text-xs text-muted-foreground">{[meta, p.detail].filter(Boolean).join(" · ")}</span>}
        </span>
      </DropdownMenuItem>
    )
  }
  return (
    <div className="space-y-1.5">
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={onBreak || busy}>
          <button
            type="button"
            className="group flex w-full items-center gap-3 rounded-2xl border bg-card px-4 py-3 text-left transition-colors hover:bg-muted/60 disabled:opacity-60 data-[state=open]:border-ring"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary"><ArrowRightLeft className="size-[18px]" aria-hidden /></span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
                {t("transfer")}
                {status && <span className={cn("rounded-full px-2 py-0.5", tone === "next" ? "bg-warning-soft text-warning" : "bg-success-soft text-success")}>{status}</span>}
              </span>
              <span className="block truncate text-[15px] font-semibold">{parts.title}</span>
              {parts.detail && <span className="block truncate text-xs text-muted-foreground">{parts.detail}</span>}
            </span>
            <ChevronDown className="size-5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[--radix-dropdown-menu-trigger-width] min-w-72 rounded-2xl p-1.5">
          {!isHome && !recents.some(p => laborKey(p.labor) === curKey) && (
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-muted-foreground">{t("xferCurrent")}</DropdownMenuLabel>
              {option("current", current, true)}
            </DropdownMenuGroup>
          )}
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-xs text-muted-foreground">{t("xferHomeGroup")}</DropdownMenuLabel>
            {option("home", home, isHome)}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-xs text-muted-foreground">{t("recentTransfers")}</DropdownMenuLabel>
            {recents.length ? recents.map(p => option(p.id, p.labor!, laborKey(p.labor) === curKey, fmtDay(tsDate(p.t), lang))) : <p className="px-3 py-2 text-sm text-muted-foreground">{t("noRecentTransfers")}</p>}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {onBreak && <p className="px-1 text-xs text-muted-foreground">{t("transferAfterBreak")}</p>}
    </div>
  )
}

/** "Add transfer": choose UKG labor categories for the current or next punch (PU-04). */
export function TransferSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const s = useDemo(st => st.s)
  const apply = useDemo(st => st.applyPunchTransfer)
  const { t } = useT()
  const emp = s.persona
  const d = laborDefaults(emp)
  const start = s.pendingPunchTransfers[emp] || { project: d.project || "", task: d.task || "", tc: d.tc || "", func: d.func || "" }
  const [lc, setLc] = useState<Labor>(start)
  const [err, setErr] = useState("")
  const cat = LABOR.opts.proj.find(x => x.v === lc.project)
  const P = PERSONAS[emp as PersonaId]
  const field = (label: string, required: boolean, value: string, onChange: (v: string) => void, options: { v: string; l: string }[], disabled = false) => (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}{required && <span className="text-destructive"> *</span>}</span>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="w-full"><SelectValue placeholder={disabled ? "Choose a project first" : `Choose ${label.toLowerCase()}`} /></SelectTrigger>
        <SelectContent>{options.map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
      </Select>
    </label>
  )
  return (
    <ResponsivePanel
      open={open}
      onOpenChange={v => { onOpenChange(v); if (v) { setLc(start); setErr("") } }}
      title={t("transfer")}
      description={`UKG labor categories for ${P.name}. Primary location: ${d.location || "—"}.`}
      footer={
        <>
          <Button variant="outline" size="lg" onClick={() => onOpenChange(false)}>{t("cancel")}</Button>
          <Button size="lg" onClick={() => { const e = apply(lc); if (e) setErr(e); else onOpenChange(false) }}>{t("confirmXfer")}</Button>
        </>
      }
    >
      <div className="space-y-4">
        {err && <Notice tone="danger">{err}</Notice>}
        {field("Labor Category Project", true, lc.project, v => { const c = LABOR.opts.proj.find(x => x.v === v); setLc({ ...lc, project: v, task: c?.tasks.includes(lc.task) ? lc.task : "" }) }, LABOR.opts.proj.map(x => ({ v: x.v, l: x.l })))}
        {field("Labor Category Task / LOB", !!cat?.taskReq, lc.task, v => setLc({ ...lc, task: v }), (cat?.tasks || []).map(x => ({ v: x, l: laborTaskName(x) })), !cat)}
        {field("Timecard Code", false, lc.tc, v => setLc({ ...lc, tc: v }), LABOR.opts.tc.map(x => ({ v: x, l: x })))}
        {field("Function", false, lc.func, v => setLc({ ...lc, func: v }), LABOR.opts.func.map(x => ({ v: x, l: x })))}
        <p className="text-sm text-muted-foreground">{t("xferNextPunch")}: punched out, the transfer is used when you punch in. Punched in, it applies from now.</p>
      </div>
    </ResponsivePanel>
  )
}

export function AddTransferButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  const { t } = useT()
  return (
    <Button variant="ghost" className="h-11 w-full justify-start rounded-xl text-primary hover:bg-primary-soft hover:text-primary" onClick={onClick} disabled={disabled}>
      <Plus /> {t("addTransfer")}
    </Button>
  )
}
