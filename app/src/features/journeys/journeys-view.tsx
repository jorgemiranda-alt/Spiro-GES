import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react"
import { toast } from "sonner"
import { ChevronDown, ChevronLeft, ChevronRight, ExternalLink, Play, Search, X } from "lucide-react"
import { JourneyTags, PageHeader } from "@/components/app/common"
import { useIsMobile } from "@/components/app/responsive-panel"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { PersonaId, ViewId } from "@/data/reference-data"
import { cn } from "@/lib/utils"
import { useDemo } from "@/store/store"
import { useUI } from "@/store/ui"
import { EPICS, J_FOCUS, J_PERIOD, JOURNEYS, JOURNEY_SYNC, type Journey, type JourneyShot } from "./journeys-data"

type Tone = "ok" | "info" | "warn" | "neutral"
type Group = "desktop" | "mobile"
interface Filters { epic: string; spec: string; ev: string; q: string }
interface Viewer { jid: string; group: Group; index: number }

const ALL = "all"
const EMPTY: Filters = { epic: "", spec: "", ev: "", q: "" }
const SPEC_ORDER = ["Confirmed", "Prototype", "Proposed", "Open decision", "Out of scope"]

const evTone = (e: string): Tone =>
  /^Confirmed - (Spiro|UI\/UX|picker)/.test(e) ? "ok"
    : /^(Confirmed - UKG|Confirmed - current demo|Not documented|Out of scope)/.test(e) ? "info" : "warn"
const specTone = (s: string): Tone =>
  s === "Confirmed" ? "ok" : s === "Prototype" || s === "Proposed" ? "info" : s === "Open decision" ? "warn" : "neutral"
const covTone = (c: string): Tone => (c === "Covered" ? "ok" : c === "Partial" ? "warn" : "neutral")
const evShort = (e: string) => e.replace("Confirmed - ", "").replace("Proposed - ", "")

const shotGroup = (x: JourneyShot): Group => (/Mobile/.test(x.caption) ? "mobile" : "desktop")
const shotLabel = (x: JourneyShot) => x.caption.replace(/\s*·\s*(Desktop|Mobile)$/, "").replace(/^(Desktop|Mobile)$/, "Screen")
const shotList = (jid: string, group: Group) => (JOURNEYS.find(j => j.id === jid)?.shots || []).filter(x => shotGroup(x) === group)

/** Journeys that can be launched in the demo, as in the original register. */
const runnable = (j: Journey) =>
  !!j.demo[0] && !!j.demo[1] && j.cov !== "Not prototyped" && !["Future", "Out of scope"].includes(j.scope)

function Chip({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center rounded-lg px-2 py-0.5 text-xs leading-[1.125rem] font-medium",
        tone === "ok" && "bg-success-soft text-success",
        tone === "info" && "bg-primary-soft text-primary",
        tone === "warn" && "bg-warning-soft text-warning",
        tone === "neutral" && "bg-muted text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  )
}

export default function JourneysView() {
  const mobile = useIsMobile()
  const journeyFocus = useUI(st => st.journeyFocus)
  const focusJourney = useUI(st => st.focusJourney)
  const [f, setF] = useState<Filters>(EMPTY)
  const [open, setOpen] = useState<Set<string>>(() => new Set())
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const [viewer, setViewer] = useState<Viewer | null>(null)

  const evs = useMemo(() => [...new Set(JOURNEYS.map(j => j.ev))], [])
  const specs = useMemo(() => SPEC_ORDER.filter(s => JOURNEYS.some(j => j.specStatus === s)), [])
  const list = useMemo(() => {
    const q = f.q.trim().toLowerCase()
    return JOURNEYS.filter(j =>
      (!f.epic || j.epic === f.epic) && (!f.ev || j.ev === f.ev) && (!f.spec || j.specStatus === f.spec)
      && (!q || [j.id, j.name, j.actor, j.story, j.specStatus, j.specRef, j.ev, j.scope, ...j.requirementIds].join(" ").toLowerCase().includes(q)))
  }, [f])
  const groups = useMemo(() => {
    const out: { epic: string; items: Journey[] }[] = []
    list.forEach(j => {
      const last = out[out.length - 1]
      if (last && last.epic === j.epic) last.items.push(j)
      else out.push({ epic: j.epic, items: [j] })
    })
    return out
  }, [list])

  /* Arriving from a journey tag: expand that journey, scroll to it, then clear the request. */
  useEffect(() => {
    if (!journeyFocus) return
    const j = JOURNEYS.find(x => x.id === journeyFocus)
    focusJourney(null)
    if (!j) return
    setF(EMPTY)
    setCollapsed(prev => { const n = new Set(prev); n.delete(j.epic); return n })
    setOpen(prev => new Set(prev).add(j.id))
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const id = window.setTimeout(() => {
      document.getElementById(`j-${j.id}`)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" })
    }, 60)
    return () => window.clearTimeout(id)
  }, [journeyFocus, focusJourney])

  const toggle = (id: string) => setOpen(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const toggleEpic = (ep: string) => setCollapsed(prev => { const n = new Set(prev); if (n.has(ep)) n.delete(ep); else n.add(ep); return n })

  const run = (j: Journey) => {
    if (!runnable(j)) return
    const [p, v, hl] = j.demo
    useDemo.getState().mutate(s => {
      s.persona = p as PersonaId
      s.period = J_PERIOD[j.id] ?? 0
      s.view = v as ViewId
    })
    useUI.getState().flash(J_FOCUS[j.id] || hl || null)
    toast(`${j.id} · ${j.name}${j.scope === "Draft" ? " · Draft illustration" : ""}`)
  }

  const count = (status: string) => JOURNEYS.filter(j => j.specStatus === status).length
  const imported = new Date(JOURNEY_SYNC.importedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
  const filtered = !!(f.epic || f.spec || f.ev || f.q)

  return (
    <div className="space-y-6">
      <PageHeader
        title="User journeys"
        description="Specification references, stories, flows and acceptance criteria for every journey. Specification status and prototype coverage are tracked separately."
        actions={JOURNEY_SYNC.sheetUrl.startsWith("http") && (
          <Button asChild>
            <a href={JOURNEY_SYNC.sheetUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink aria-hidden /> Open tracker sheet
            </a>
          </Button>
        )}
      />

      <section aria-labelledby="j-summary" className="rounded-2xl border bg-card p-5 shadow-soft">
        <h2 id="j-summary" className="text-base font-semibold">Specification coverage</h2>
        <dl className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {([["Register entries", JOURNEYS.length], ["Confirmed", count("Confirmed")], ["Prototype", count("Prototype")], ["Proposed", count("Proposed")], ["Open decisions", count("Open decision")], ["Out of scope", count("Out of scope")]] as const).map(([k, v]) => (
            <div key={k} className="rounded-xl bg-muted px-3 py-2">
              <dt className="text-xs text-muted-foreground">{k}</dt>
              <dd className="text-xl font-semibold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-3 space-y-1 text-sm text-muted-foreground">
          <p>Scope: Punch and My Timecard (§5.1), salaried Project Hours (§5.2), Time Off (§5.3), Timeclock (§5.5), and shared access. Future and excluded journeys remain visible for reference.</p>
          <p>Prototype coverage, validation and client approval are tracked separately. Historical screenshots may differ from the current demo.</p>
          <p>
            Content revision {JOURNEY_SYNC.contentRevision} · Snapshot <span className="font-mono">{JOURNEY_SYNC.revision}</span> · Imported {imported}.{" "}
            <a className="font-medium text-primary underline-offset-4 hover:underline" href={JOURNEY_SYNC.sheetUrl} target="_blank" rel="noopener noreferrer">Review and collaborate in Google Sheets</a>.
          </p>
        </div>
      </section>

      <section aria-labelledby="j-list" className="rounded-2xl border bg-card shadow-soft">
        <div className="space-y-3 border-b p-4 md:p-5">
          <h2 id="j-list" className="text-base font-semibold">
            Journeys <span className="font-normal text-muted-foreground">· {list.length} of {JOURNEYS.length}</span>
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[repeat(3,minmax(0,1fr))_minmax(14rem,1.2fr)_auto]">
            <FilterSelect label="Epic" all="All epics" value={f.epic} onChange={epic => setF({ ...f, epic })}
              options={Object.entries(EPICS).map(([k, v]) => ({ value: k, label: `${k} · ${v}` }))} />
            <FilterSelect label="Specification status" all="All specification statuses" value={f.spec} onChange={spec => setF({ ...f, spec })}
              options={specs.map(s => ({ value: s, label: s }))} />
            <FilterSelect label="Evidence" all="All evidence" value={f.ev} onChange={ev => setF({ ...f, ev })}
              options={evs.map(e => ({ value: e, label: e }))} />
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                type="search"
                value={f.q}
                onChange={e => setF({ ...f, q: e.target.value })}
                placeholder="Search journeys"
                aria-label="Search journeys"
                className="h-10 pl-9"
              />
            </div>
            {filtered && (
              <Button variant="ghost" onClick={() => setF(EMPTY)}>
                <X aria-hidden /> Clear
              </Button>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Select a journey for its specification reference, story, flow and acceptance criteria. Priority remains as recorded in the register.
            {" "}Dashed tags such as <JourneyTags ids="PU-01" /> link each journey to its demo screen; turn them off in settings.
          </p>
        </div>

        {!groups.length && <p className="p-6 text-sm text-muted-foreground">No journeys match.</p>}

        {mobile
          ? (
            <div className="divide-y">
              {groups.map(g => (
                <div key={g.epic}>
                  <EpicHeader epic={g.epic} n={g.items.length} collapsed={collapsed.has(g.epic)} onToggle={() => toggleEpic(g.epic)} />
                  {!collapsed.has(g.epic) && (
                    <ul className="space-y-3 px-3 pb-4">
                      {g.items.map(j => (
                        <JourneyCard key={j.id} j={j} open={open.has(j.id)} onToggle={() => toggle(j.id)} onRun={() => run(j)} onShot={setViewer} />
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )
          : !!groups.length && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th scope="col" className="px-4 py-2.5 font-medium">ID</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Journey</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Specification</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Evidence</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Register priority</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Prototype</th>
                    <th scope="col" className="px-4 py-2.5"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map(g => (
                    <Fragment key={g.epic}>
                      <tr className="border-b bg-muted/60">
                        <td colSpan={7} className="p-0">
                          <EpicHeader epic={g.epic} n={g.items.length} collapsed={collapsed.has(g.epic)} onToggle={() => toggleEpic(g.epic)} />
                        </td>
                      </tr>
                      {!collapsed.has(g.epic) && g.items.map(j => {
                        const isOpen = open.has(j.id)
                        return (
                          <Fragment key={j.id}>
                            <tr
                              id={`j-${j.id}`}
                              onClick={e => { if (!(e.target as HTMLElement).closest("button,a")) toggle(j.id) }}
                              className={cn("scroll-mt-24 cursor-pointer border-b align-top transition-colors hover:bg-muted/50", isOpen && "bg-primary-soft/40")}
                            >
                              <td className="px-4 py-3 font-mono text-[13px] font-semibold whitespace-nowrap">{j.id}</td>
                              <td className="px-3 py-3">
                                <button
                                  type="button"
                                  aria-expanded={isOpen}
                                  aria-controls={`jd-${j.id}`}
                                  onClick={() => toggle(j.id)}
                                  className="flex items-start gap-1.5 rounded-md text-left font-semibold"
                                >
                                  <ChevronDown aria-hidden className={cn("mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform", !isOpen && "-rotate-90")} />
                                  {j.name}
                                </button>
                                <span className="mt-0.5 block pl-5.5 text-xs text-muted-foreground">{j.actor} · {j.scope}</span>
                              </td>
                              <td className="px-3 py-3">
                                <Chip tone={specTone(j.specStatus)}>{j.specStatus}</Chip>
                                <span className="mt-1 block text-xs text-muted-foreground">{j.specRef}</span>
                              </td>
                              <td className="max-w-48 px-3 py-3"><Chip tone={evTone(j.ev)}>{evShort(j.ev)}</Chip></td>
                              <td className="px-3 py-3">{j.pri}</td>
                              <td className="px-3 py-3"><Chip tone={covTone(j.cov)}>{j.cov}</Chip></td>
                              <td className="px-4 py-3 text-right"><RunButton j={j} onRun={() => run(j)} /></td>
                            </tr>
                            {isOpen && (
                              <tr className="border-b bg-background/60">
                                <td colSpan={7} id={`jd-${j.id}`} className="px-4 py-4">
                                  <JourneyDetail j={j} onShot={setViewer} />
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        )
                      })}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </section>

      <ShotViewer viewer={viewer} onChange={setViewer} />
    </div>
  )
}

function FilterSelect({ label, all, value, onChange, options }: {
  label: string; all: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]
}) {
  return (
    <Select value={value || ALL} onValueChange={v => onChange(v === ALL ? "" : v)}>
      <SelectTrigger aria-label={label} className="w-full min-w-0">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{all}</SelectItem>
        {options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}

function EpicHeader({ epic, n, collapsed, onToggle }: { epic: string; n: number; collapsed: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-expanded={!collapsed}
      onClick={onToggle}
      className="flex min-h-11 w-full items-center gap-2 px-4 py-2 text-left text-sm font-semibold"
    >
      <ChevronDown aria-hidden className={cn("size-4 shrink-0 text-muted-foreground transition-transform", collapsed && "-rotate-90")} />
      <span className="min-w-0 flex-1">{epic} · {EPICS[epic]}</span>
      <span className="shrink-0 text-xs font-normal text-muted-foreground">{n} journeys</span>
    </button>
  )
}

function RunButton({ j, onRun, className }: { j: Journey; onRun: () => void; className?: string }) {
  if (!runnable(j)) {
    return <span className={cn("text-xs text-muted-foreground", className)}>{j.scope === "Future" || j.scope === "Out of scope" ? j.scope : "Not prototyped"}</span>
  }
  return (
    <Button size="sm" variant="outline" onClick={onRun} className={className}>
      <Play aria-hidden /> {j.scope === "Draft" ? "Open draft illustration" : "Open in demo"}
    </Button>
  )
}

function JourneyCard({ j, open, onToggle, onRun, onShot }: {
  j: Journey; open: boolean; onToggle: () => void; onRun: () => void; onShot: (v: Viewer) => void
}) {
  return (
    <li id={`j-${j.id}`} className={cn("scroll-mt-20 rounded-2xl border bg-card p-4", open && "shadow-soft")}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[13px] font-semibold">{j.id}</span>
        <Chip tone={specTone(j.specStatus)}>{j.specStatus}</Chip>
      </div>
      <h3 className="mt-1.5 text-base font-semibold">{j.name}</h3>
      <p className="text-sm text-muted-foreground">{j.actor} · {j.scope} · {j.specRef}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Chip tone={evTone(j.ev)}>{evShort(j.ev)}</Chip>
        <Chip tone="neutral">{j.pri}</Chip>
        <Chip tone={covTone(j.cov)}>{j.cov}</Chip>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="ghost" aria-expanded={open} aria-controls={`jd-${j.id}`} onClick={onToggle} className="-ml-2">
          <ChevronDown aria-hidden className={cn("transition-transform", !open && "-rotate-90")} />
          {open ? "Hide details" : "Details"}
        </Button>
        <RunButton j={j} onRun={onRun} className="ml-auto" />
      </div>
      {open && <div id={`jd-${j.id}`} className="mt-3 border-t pt-3"><JourneyDetail j={j} onShot={onShot} /></div>}
    </li>
  )
}

function Field({ title, children, wide, className }: { title: string; children: ReactNode; wide?: boolean; className?: string }) {
  return (
    <div className={cn(wide && "md:col-span-2", className)}>
      <h4 className="text-xs font-semibold text-muted-foreground">{title}</h4>
      <div className="mt-1 text-sm whitespace-pre-line">{children}</div>
    </div>
  )
}

function JourneyDetail({ j, onShot }: { j: Journey; onShot: (v: Viewer) => void }) {
  const shots = j.shots || []
  return (
    <div className="grid gap-x-8 gap-y-4 md:grid-cols-2">
      {j.specStatus === "Out of scope" && (
        <p className="rounded-xl bg-muted px-3 py-2 text-sm md:col-span-2">This activity is explicitly outside the current specification scope.</p>
      )}
      <Field title="Specification coverage">{j.specStatus} · {j.specRef}</Field>
      <Field title="Scope and client review">{j.scope} · {j.reviewStatus || "Not reviewed"} · Decision: {j.clientDecision || "Pending"}</Field>
      <Field title="Requirement IDs">{j.requirementIds.join(", ") || "—"}</Field>
      <Field title="User story">{j.story}</Field>
      <Field title="Trigger · Preconditions">{j.trigger}. {j.pre}</Field>
      {j.currentState && <Field title="Current state">{j.currentState}</Field>}
      <Field title="Main flow">{j.flow.replace(/ (\d)\. /g, "\n$1. ")}</Field>
      {j.gridFields && (
        <Field title="Grid fields" wide>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-xs text-muted-foreground">
                <tr><th scope="col" className="px-3 py-2 font-medium">Column</th><th scope="col" className="px-3 py-2 font-medium">Display behavior</th></tr>
              </thead>
              <tbody className="divide-y">
                {j.gridFields.map(r => <tr key={r[0]}><td className="px-3 py-2 align-top font-medium">{r[0]}</td><td className="px-3 py-2">{r[1]}</td></tr>)}
              </tbody>
            </table>
          </div>
        </Field>
      )}
      <Field title="Alternate / exception">{j.alt || "—"}</Field>
      <Field title="Business rules">{j.rules || "—"}</Field>
      <Field title="Integration note"><span className="font-mono text-[13px] break-words">{j.api}</span></Field>
      <Field title="Acceptance criteria" wide>
        <ul className="list-disc space-y-1 pl-5 whitespace-normal">
          {j.ac.map((a, i) => <li key={i}>{a.join("; ")}</li>)}
        </ul>
      </Field>
      {!!shots.length && (
        <Field title="Screenshots" wide>
          <p className="text-muted-foreground">Select a screenshot to enlarge it. Use the arrows or the left and right keys to move through a flow.</p>
          {(["desktop", "mobile"] as const).map(g => {
            const list = shots.filter(x => shotGroup(x) === g)
            if (!list.length) return null
            return (
              <div key={g} className="mt-3">
                <div className="mb-1.5 text-xs text-muted-foreground">{g === "desktop" ? "Desktop" : "Mobile"} · {list.length}</div>
                <div className="flex flex-wrap items-end gap-3">
                  {list.map((x, i) => (
                    <figure key={x.src} className="m-0">
                      <button
                        type="button"
                        onClick={() => onShot({ jid: j.id, group: g, index: i })}
                        aria-label={`Enlarge ${x.caption} screenshot`}
                        className="block cursor-zoom-in overflow-hidden rounded-lg border bg-card leading-none transition-shadow hover:shadow-soft"
                      >
                        <img
                          src={x.src}
                          alt=""
                          loading="lazy"
                          className={cn("block h-[100px] object-cover object-left-top", g === "mobile" ? "w-16" : "w-40")}
                        />
                      </button>
                      <figcaption className="mt-1 text-xs text-muted-foreground">{shotLabel(x)}</figcaption>
                    </figure>
                  ))}
                </div>
              </div>
            )
          })}
        </Field>
      )}
      <Field title="Evidence">{j.ev} · {j.src}</Field>
      <Field title="Demo path">{j.demo[3]}</Field>
    </div>
  )
}

function ShotViewer({ viewer, onChange }: { viewer: Viewer | null; onChange: (v: Viewer | null) => void }) {
  const list = viewer ? shotList(viewer.jid, viewer.group) : []
  const i = viewer ? Math.max(0, Math.min(list.length - 1, viewer.index)) : 0
  const x = list[i]
  const go = (to: number) => { if (viewer && to >= 0 && to < list.length) onChange({ ...viewer, index: to }) }
  return (
    <Dialog open={!!viewer && !!x} onOpenChange={o => { if (!o) onChange(null) }}>
      <DialogContent
        showCloseButton={false}
        onKeyDown={e => {
          if (e.key === "ArrowLeft") { e.preventDefault(); go(i - 1) }
          else if (e.key === "ArrowRight") { e.preventDefault(); go(i + 1) }
        }}
        className="flex h-dvh w-screen max-w-none flex-col items-center justify-center gap-3 rounded-none bg-nav/95 p-4 pt-16 text-nav-foreground ring-0 sm:max-w-none md:px-20"
      >
        {x && (
          <>
            <DialogTitle className="sr-only">{x.caption} screenshot</DialogTitle>
            <DialogDescription className="sr-only">{x.alt}</DialogDescription>
            <Button
              variant="secondary"
              onClick={() => onChange(null)}
              className="absolute top-[max(1rem,env(safe-area-inset-top))] right-4"
            >
              <X aria-hidden /> Close
            </Button>
            {i > 0 && (
              <button
                type="button"
                onClick={() => go(i - 1)}
                aria-label="Previous screenshot"
                className="absolute top-1/2 left-2 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-nav-2 text-nav-foreground transition-colors hover:bg-nav-foreground/20 md:left-4"
              >
                <ChevronLeft className="size-6" aria-hidden />
              </button>
            )}
            {i < list.length - 1 && (
              <button
                type="button"
                onClick={() => go(i + 1)}
                aria-label="Next screenshot"
                className="absolute top-1/2 right-2 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-nav-2 text-nav-foreground transition-colors hover:bg-nav-foreground/20 md:right-4"
              >
                <ChevronRight className="size-6" aria-hidden />
              </button>
            )}
            <img
              src={x.src}
              alt={x.alt}
              className="block h-auto max-h-[calc(100dvh-8.5rem)] w-auto max-w-full rounded-lg bg-card object-contain"
            />
            <p className="text-center text-sm">{x.caption} · {i + 1} of {list.length} · prototype</p>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
