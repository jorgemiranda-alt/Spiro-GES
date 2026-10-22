import { useEffect, useState } from "react"
import { Coffee, LogIn, LogOut, Play, Table2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Highlightable, JourneyTags, PageHeader } from "@/components/app/common"
import { Notice } from "@/components/app/status"
import { PROJECTS } from "@/data/reference-data"
import { fmtClock, fmtDay, fmtH, todayStr, tsDate, tsTime } from "@/lib/dates"
import { assigned, buildDay, isPunchOdooHidden, laborText, liveState, validateProject } from "@/lib/engine"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { useDemo } from "@/store/store"
import type { Punch } from "@/store/types"
import { ManageOdooPanel, OdooProjectPicker } from "./odoo"
import { AddTransferButton, TransferPicker, TransferSheet } from "./transfer"

/** Re-render every 30 s so live hours and "since" times stay current. */
function useTick(ms = 30000) {
  const [, set] = useState(0)
  useEffect(() => { const id = setInterval(() => set(n => n + 1), ms); return () => clearInterval(id) }, [ms])
}

export default function PunchView() {
  useTick()
  const s = useDemo(st => st.s)
  const busyList = useDemo(st => st.busy)
  const record = useDemo(st => st.recordEmployeePunch)
  const setSetting = useDemo(st => st.setSetting)
  const go = useDemo(st => st.go)
  const { lang, t } = useT()
  const emp = s.persona
  const L = liveState(s, emp)
  const busy = busyList.includes(emp)
  const codes = assigned(s, emp).filter(c => !isPunchOdooHidden(s, emp, c))
  const [proj, setProj] = useState("")
  const [task, setTask] = useState("")
  const [xferOpen, setXferOpen] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)
  const selProj = codes.includes(proj) ? proj : ""
  const tasks = selProj ? PROJECTS[selProj].tasks : []
  const today = buildDay(s, emp, todayStr())
  const history = [...(s.punches[emp] || [])].sort((a, b) => b.t.localeCompare(a.t))
  const recent = history.slice(0, 6)
  const last = recent[0]
  const typeLabel: Record<Punch["type"], string> = { IN: t("punchIn"), OUT: t("punchOut"), BRK_S: t("startBreak"), BRK_E: t("endBreak"), XFER: t("transfer") }

  const statusText = L.st === "out" ? t("punchedOut") : L.st === "brk" ? t("onBreak") : t("punchedIn")
  const statusDetail = L.st === "out"
    ? last ? `${t("lastPunch")}: ${fmtDay(tsDate(last.t), lang)} ${fmtClock(tsTime(last.t), lang)}` : "Ready to start your shift."
    : `${L.since ? `Since ${fmtClock(L.since, lang)}` : ""}${L.proj ? ` · ${L.proj}` : ""}`

  const punchIn = () => {
    const err = selProj ? validateProject(s, emp, selProj) : null
    if (err) { toast.error(err); return }
    record("IN", { proj: selProj || null, task: selProj && tasks.includes(task) ? task : null })
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("punch")} tags="PU-01,PU-02,PU-06" />
      {s.settings.simDuplicatePunchError && (
        <Notice tone="danger"><b>UKG duplicate-punch error simulation is armed.</b> The next Punch In or Punch Out will show the error returned by UKG.</Notice>
      )}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <Highlightable hl="punch-in" className="space-y-5 rounded-3xl border bg-card p-5 shadow-soft sm:p-6">
          <div className="flex items-center gap-4">
            <span className={cn(
              "relative grid size-14 shrink-0 place-items-center rounded-2xl",
              L.st === "in" ? "bg-success-soft text-success" : L.st === "brk" ? "bg-warning-soft text-warning" : "bg-muted text-muted-foreground",
            )}>
              {L.st === "brk" ? <Coffee className="size-6" aria-hidden /> : L.st === "in" ? <Play className="size-6" aria-hidden /> : <LogOut className="size-6" aria-hidden />}
              {L.st === "in" && <span className="absolute -top-0.5 -right-0.5 size-3 animate-pulse rounded-full border-2 border-card bg-success motion-reduce:animate-none" aria-hidden />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xl font-semibold" role="status">{statusText}</p>
              <p className="text-sm text-muted-foreground">{statusDetail}</p>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">{t("today")}</div>
              <div className="text-xl font-semibold tabular-nums">{fmtH(today.daily, lang)} h</div>
            </div>
          </div>

          <div className="space-y-1">
            <TransferPicker emp={emp} L={L} busy={busy} />
            <Highlightable hl="punch-transfer">
              <AddTransferButton onClick={() => setXferOpen(true)} disabled={L.st === "brk" || busy} />
            </Highlightable>
          </div>

          {L.st === "out" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <OdooProjectPicker codes={codes} value={selProj} onChange={c => { setProj(c); setTask("") }} onManage={() => setManageOpen(true)} />
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">{t("odooTask")} <span className="font-normal text-muted-foreground">{t("optional")}</span></span>
                <Select value={task} onValueChange={setTask} disabled={!selProj}>
                  <SelectTrigger className="h-11 w-full data-[size=default]:h-11"><SelectValue placeholder={t("noTask")} /></SelectTrigger>
                  <SelectContent>{tasks.map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
                </Select>
              </label>
              <p className="text-xs text-muted-foreground sm:col-span-2">Only active Odoo projects available to you are listed. <JourneyTags ids="PU-05" /></p>
            </div>
          )}

          <div className={cn("grid gap-3", L.st !== "out" && "grid-cols-2")}>
            {L.st === "out" ? (
              <Button size="lg" className="h-14 rounded-2xl text-lg" onClick={punchIn} disabled={busy} aria-busy={busy || undefined}>
                <LogIn className="size-5" /> {busy ? "Sending to UKG…" : t("punchIn")}
              </Button>
            ) : (
              <>
                <Highlightable hl="punch-break">
                  <Button
                    size="lg"
                    variant={L.st === "brk" ? "default" : "secondary"}
                    className="h-14 w-full rounded-2xl text-base"
                    disabled={busy}
                    onClick={() => record(L.st === "brk" ? "BRK_E" : "BRK_S")}
                  >
                    <Coffee className="size-5" /> {L.st === "brk" ? t("endBreak") : t("startBreak")}
                  </Button>
                </Highlightable>
                <Button
                  size="lg"
                  variant={L.st === "brk" ? "secondary" : "default"}
                  className="h-14 rounded-2xl text-base"
                  disabled={busy}
                  onClick={() => record("OUT")}
                >
                  <LogOut className="size-5" /> {busy ? "Sending…" : t("punchOut")}
                </Button>
              </>
            )}
          </div>
        </Highlightable>

        <Highlightable hl="recent-punches" className="rounded-3xl border bg-card p-5 shadow-soft sm:p-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold">{t("recent")} <JourneyTags ids="PU-07" /></h2>
            <Button variant="outline" size="sm" onClick={() => go("timecard")}><Table2 /> {t("viewTc")}</Button>
          </div>
          {recent.length ? (
            <ol className="relative space-y-0">
              {recent.map((p, i) => (
                <li key={p.id} className="relative flex gap-4 pb-4 last:pb-0">
                  {i < recent.length - 1 && <span className="absolute top-6 bottom-0 left-[5px] w-px bg-border" aria-hidden />}
                  <span className={cn("mt-1.5 size-[11px] shrink-0 rounded-full border-2 border-card ring-1", p.type === "OUT" ? "bg-muted-foreground ring-muted-foreground/30" : p.type.startsWith("BRK") ? "bg-warning ring-warning/30" : "bg-success ring-success/30")} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className="font-medium">{typeLabel[p.type]}</span>
                      <time dateTime={p.t.replace(" ", "T")} className="text-sm tabular-nums text-muted-foreground">{fmtDay(tsDate(p.t), lang)} · {fmtClock(tsTime(p.t), lang)}</time>
                    </div>
                    {p.proj && (p.type === "IN" || p.type === "XFER") && <p className="text-sm text-muted-foreground">{t("odooProject")}: {p.proj}{p.task ? ` · ${p.task}` : ""}</p>}
                    {p.labor && laborText(p.labor) && <p className="text-sm text-muted-foreground">{t("laborCategory")}: {laborText(p.labor)}</p>}
                  </div>
                </li>
              ))}
            </ol>
          ) : <p className="text-sm text-muted-foreground">No punches yet.</p>}
          <div className="mt-4 border-t pt-3 text-xs text-muted-foreground">
            Demo:{" "}
            <button type="button" className="font-medium text-primary underline underline-offset-2" onClick={() => { setSetting("simDuplicatePunchError", true); toast("Next Punch In or Punch Out will show a duplicate-punch error from UKG.") }}>
              simulate a duplicate-punch error
            </button>{" "}
            <JourneyTags ids="PU-08" />
          </div>
        </Highlightable>
      </div>

      <TransferSheet open={xferOpen} onOpenChange={setXferOpen} />
      <ManageOdooPanel open={manageOpen} onOpenChange={setManageOpen} onAdded={c => setProj(c)} />
    </div>
  )
}
