import { useState } from "react"
import { BellRing, ChevronRight, FolderKanban, Info } from "lucide-react"
import { toast } from "sonner"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageHeader } from "@/components/app/common"
import { StatusPill, type Tone } from "@/components/app/status"
import { PROJECTS } from "@/data/reference-data"
import { levelOf, pctOf, projectPlan, visibleProjects, type Level, type MemberTotals, type PlanTask, type TeamMember } from "@/data/project-plans"
import { locale } from "@/lib/dates"
import { notifyPerson, prefsFor } from "@/lib/notifications"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { useDemo } from "@/store/store"

const BAR: Record<Level, string> = { none: "bg-muted-foreground/30", green: "bg-success", yellow: "bg-amber-400", red: "bg-destructive" }
const TONE: Record<Level, Tone> = { none: "neutral", green: "success", yellow: "warning", red: "danger" }
const LABEL: Record<Level, string> = { none: "pdNotStarted", green: "pdGreen", yellow: "pdYellow", red: "pdRed" }

/** A person on a subtask: compact hours on the chip, the full picture in a popover. */
function PersonChip({ member, actual, scoped, subtask, you, fmt }: {
  member: TeamMember; actual: number; scoped: number; subtask: string; you: boolean; fmt: (v: number) => string
}) {
  const { at } = useT()
  const pct = pctOf(actual, scoped)
  const level = levelOf(pct)
  const left = scoped - actual
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${member.name} · ${subtask} · ${fmt(actual)}/${fmt(scoped)} h`}
          className={cn(
            "inline-flex h-6 items-center gap-1.5 rounded-full bg-card px-2 text-xs ring-1 ring-border outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/60 data-[state=open]:ring-2 data-[state=open]:ring-primary/40",
            you && "ring-citron",
          )}
        >
          <span className={cn("size-1.5 rounded-full", BAR[level])} aria-hidden />
          <b className="font-semibold">{member.initials}</b>
          <span className="text-muted-foreground tabular-nums">{fmt(actual)}/{fmt(scoped)} h</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-3 p-4">
        <header className="flex items-start gap-3">
          <Initials text={member.initials} you={you} />
          <div className="min-w-0">
            <p className="truncate font-semibold">
              {member.name}{you && <span className="ml-2 rounded-full bg-citron/40 px-2 py-0.5 text-xs font-medium">{at("pdYou")}</span>}
            </p>
            <p className="truncate text-sm text-muted-foreground">{member.role}</p>
          </div>
        </header>
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate font-medium">{subtask}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">{Math.round(pct)}%</span>
          </div>
          <Meter actual={actual} budget={scoped} label={`${fmt(actual)} / ${fmt(scoped)} h`} />
        </div>
        <dl className="grid grid-cols-3 gap-2 text-center">
          {[
            [at("pdScoped"), `${fmt(scoped)} h`],
            [at("pdActual"), `${fmt(actual)} h`],
            [left >= 0 ? at("pdRemaining") : at("pdOver"), `${fmt(Math.abs(left))} h`],
          ].map(([k, v], i) => (
            <div key={k} className="rounded-lg bg-muted px-2 py-1.5">
              <dt className="text-[11px] text-muted-foreground">{k}</dt>
              <dd className={cn("text-sm font-semibold tabular-nums", i === 2 && left < 0 && "text-destructive")}>{v}</dd>
            </div>
          ))}
        </dl>
        <StatusPill tone={TONE[level]}>{at(LABEL[level])}</StatusPill>
      </PopoverContent>
    </Popover>
  )
}

/** Progress bar coloured by Beth's thresholds; ticks mark 75 % and 91 %. */
function Meter({ actual, budget, label, className }: { actual: number; budget: number; label: string; className?: string }) {
  const pct = pctOf(actual, budget)
  return (
    <div role="img" aria-label={label} className={cn("relative h-2 overflow-hidden rounded-full bg-muted", className)}>
      <span className={cn("absolute inset-y-0 left-0 rounded-full transition-[width] duration-500", BAR[levelOf(pct)])} style={{ width: `${Math.min(100, pct)}%` }} />
      <i className="absolute inset-y-0 left-3/4 w-px bg-card/90" aria-hidden />
      <i className="absolute inset-y-0 left-[91%] w-px bg-card/90" aria-hidden />
    </div>
  )
}

function Initials({ text, you }: { text: string; you?: boolean }) {
  return <span aria-hidden className={cn("grid size-9 shrink-0 place-items-center rounded-full text-[13px] font-semibold", you ? "bg-citron text-nav" : "bg-secondary text-secondary-foreground")}>{text}</span>
}

export default function ProjectsView() {
  const persona = useDemo(st => st.s.persona)
  const alerts = useDemo(st => st.s.settings.projectAlerts) || {}
  const mutate = useDemo(st => st.mutate)
  const { lang, t, at } = useT()
  const codes = visibleProjects(persona)
  const [picked, setPicked] = useState(codes[0])
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const fmt = (v: number) => v.toLocaleString(locale(lang), { maximumFractionDigits: 1 })
  const statusText = (actual: number, budget: number) => {
    const pct = pctOf(actual, budget)
    return `${fmt(actual)} / ${fmt(budget)} h, ${pct}%. ${at(LABEL[levelOf(pct)])}.`
  }

  if (!codes.length) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("projects")} />
        <div className="rounded-3xl border bg-card p-8 text-center shadow-soft">
          <FolderKanban className="mx-auto size-8 text-muted-foreground" aria-hidden />
          <h2 className="mt-3 font-semibold">{at("pdNoProjects")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{at("pdNoProjectsHelp")}</p>
        </div>
      </div>
    )
  }

  const code = codes.includes(picked) ? picked : codes[0]
  const project = PROJECTS[code], plan = projectPlan(code)
  const pct = pctOf(plan.actual, plan.budget), level = levelOf(pct)
  const remaining = plan.budget - plan.actual
  const team = [...plan.team].sort((a, b) => pctOf(b.actual, b.scoped) - pctOf(a.actual, a.scoped))
  const hot = team.filter(m => pctOf(m.actual, m.scoped) >= 75)
  const alertsOn = !!alerts[code]
  const isOpen = (t: PlanTask, i: number) => open[t.id] ?? i === 0

  const toggleAlerts = (on: boolean) => {
    mutate(s => {
      s.settings.projectAlerts = { ...(s.settings.projectAlerts || {}), [code]: on }
      // Turning alerts on sends one summary through the viewer's chosen channels.
      if (on) notifyPerson(s, persona, "project", "ntProjectAlertsOn", { project: project.name, n: hot.length })
    })
    // With in-app notifications on, the new inbox item announces itself; otherwise confirm here.
    if (on && !prefsFor(useDemo.getState().s, persona, "project").app) toast(at("pdAlertsOn", { p: project.name, n: hot.length }), { icon: <BellRing className="size-4" /> })
    else toast(at("pdAlertsOff", { p: project.name }))
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("projects")} description={at("pdIntro")} hideDescriptionOnMobile />

      <section aria-labelledby="pd-summary" className="rounded-3xl border bg-card p-5 shadow-soft sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <label className="block w-full space-y-1.5 sm:w-auto sm:min-w-80">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{at("pdProject")}</span>
            <Select value={code} onValueChange={setPicked}>
              <SelectTrigger className="h-11 w-full rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {codes.map(c => {
                  const pl = projectPlan(c)
                  return (
                    <SelectItem key={c} value={c}>
                      <span className={cn("size-2 rounded-full", BAR[levelOf(pctOf(pl.actual, pl.budget))])} aria-hidden />
                      {PROJECTS[c].name} <span className="text-muted-foreground tabular-nums">{c}</span>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </label>
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">{at("pdDataContext")}</span>
        </div>

        <h2 id="pd-summary" className="mt-5 text-lg font-semibold">{project.name}</h2>
        <p className="text-sm text-muted-foreground">{project.client}{project.show !== "—" ? ` · ${project.show}` : ""} · {at("pdPeople", { n: plan.team.length })}</p>

        <div className="mt-4 flex flex-wrap items-end gap-x-8 gap-y-3">
          <div><div className="text-xs text-muted-foreground">{at("pdActual")}</div><div className="text-3xl font-semibold tabular-nums">{fmt(plan.actual)}<span className="text-base text-muted-foreground"> h</span></div></div>
          <div><div className="text-xs text-muted-foreground">{at("pdBudget")}</div><div className="text-3xl font-semibold text-muted-foreground tabular-nums">{fmt(plan.budget)}<span className="text-base"> h</span></div></div>
          <div className="ml-auto text-right"><div className="text-xs text-muted-foreground">{remaining >= 0 ? at("pdRemaining") : at("pdOver")}</div><div className="text-xl font-semibold tabular-nums">{fmt(Math.abs(remaining))} h</div></div>
        </div>
        <Meter actual={plan.actual} budget={plan.budget} label={statusText(plan.actual, plan.budget)} className="mt-3 h-2.5" />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <StatusPill tone={TONE[level]}>{at(LABEL[level])} · {pct}%</StatusPill>
          <Legend at={at} />
        </div>

        <div className="mt-5 flex items-start gap-3 rounded-2xl bg-muted p-4">
          <BellRing className="mt-0.5 size-[18px] shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0 flex-1">
            <label htmlFor="pd-alerts" className="font-medium">{at("pdAlerts")}</label>
            <p className="text-sm text-muted-foreground">{at("pdAlertsHelp")}</p>
          </div>
          <Switch id="pd-alerts" checked={alertsOn} onCheckedChange={toggleAlerts} />
        </div>
      </section>

      <Tabs defaultValue="team" className="gap-4">
        <TabsList className="h-11 w-full sm:w-auto">
          <TabsTrigger value="team" className="px-4">{at("pdTeam")} <span className="text-muted-foreground tabular-nums">{plan.team.length}</span></TabsTrigger>
          <TabsTrigger value="tasks" className="px-4">{at("pdTasks")} <span className="text-muted-foreground tabular-nums">{plan.tasks.length}</span></TabsTrigger>
        </TabsList>

        <TabsContent value="team" className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <section className="rounded-3xl border bg-card p-2 shadow-soft sm:p-3" aria-label={at("pdTeam")}>
            <ul className="divide-y">
              {team.map(m => <MemberRow key={m.member.id} m={m} you={m.member.id === persona} fmt={fmt} at={at} label={statusText(m.actual, m.scoped)} />)}
            </ul>
          </section>
          <aside className="h-fit rounded-3xl border bg-card p-5 shadow-soft">
            <h3 className="font-semibold">{at("pdAttention")}</h3>
            <p className="text-sm text-muted-foreground">{at("pdAttentionHelp")}</p>
            {hot.length ? (
              <ul className="mt-3 space-y-2">
                {hot.map(m => {
                  const p = pctOf(m.actual, m.scoped)
                  return (
                    <li key={m.member.id} className="flex items-center gap-3 rounded-2xl bg-muted px-3 py-2.5">
                      <span className={cn("size-2.5 shrink-0 rounded-full", BAR[levelOf(p)])} aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{m.member.name}</span>
                      <span className="text-sm tabular-nums">{fmt(m.actual)} / {fmt(m.scoped)} h</span>
                      <b className="w-11 text-right text-sm tabular-nums">{p}%</b>
                    </li>
                  )
                })}
              </ul>
            ) : <p className="mt-3 text-sm text-muted-foreground">{at("pdNoneAtRisk")}</p>}
          </aside>
        </TabsContent>

        <TabsContent value="tasks">
          <section className="overflow-hidden rounded-3xl border bg-card shadow-soft" aria-label={at("pdTasks")}>
            <div className="hidden grid-cols-[minmax(0,1fr)_88px_88px_200px] gap-4 border-b bg-muted/60 px-5 py-2.5 text-xs font-medium tracking-wide text-muted-foreground uppercase md:grid">
              <span>{at("pdTaskSubtask")}</span><span className="text-right">{at("pdBudget")}</span><span className="text-right">{at("pdActual")}</span><span>{at("pdProgress")}</span>
            </div>
            <ul>
              {plan.tasks.map((task, i) => (
                <li key={task.id} className="border-b last:border-b-0">
                  <button
                    type="button"
                    onClick={() => setOpen(o => ({ ...o, [task.id]: !isOpen(task, i) }))}
                    aria-expanded={isOpen(task, i)}
                    className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-5 py-4 text-left transition-colors hover:bg-muted/50 md:grid-cols-[minmax(0,1fr)_88px_88px_200px]"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <ChevronRight className={cn("size-4 shrink-0 text-muted-foreground transition-transform", isOpen(task, i) && "rotate-90")} aria-hidden />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{task.name}</span>
                        <span className="block text-xs text-muted-foreground">{at("pdSubtasks", { n: task.subtasks.length })}</span>
                      </span>
                    </span>
                    <Hours actual={task.actual} budget={task.budget} fmt={fmt} />
                    <Progress actual={task.actual} budget={task.budget} label={statusText(task.actual, task.budget)} />
                  </button>
                  {isOpen(task, i) && (
                    <ul className="border-t bg-muted/30">
                      {task.subtasks.map(sub => (
                        <li key={sub.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 border-b py-3 pr-5 pl-11 last:border-b-0 md:grid-cols-[minmax(0,1fr)_88px_88px_200px]">
                          <span className="min-w-0">
                            <span className="block truncate text-[15px]">{sub.name}</span>
                            <span className="mt-1 flex flex-wrap gap-1.5">
                              {sub.people.map(a => (
                                <PersonChip
                                  key={a.member}
                                  member={plan.team.find(x => x.member.id === a.member)!.member}
                                  actual={a.actual}
                                  scoped={a.scoped}
                                  subtask={sub.name}
                                  you={a.member === persona}
                                  fmt={fmt}
                                />
                              ))}
                            </span>
                          </span>
                          <Hours actual={sub.actual} budget={sub.budget} fmt={fmt} />
                          <Progress actual={sub.actual} budget={sub.budget} label={statusText(sub.actual, sub.budget)} />
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </TabsContent>
      </Tabs>

      <p className="flex gap-2 text-xs text-muted-foreground"><Info className="size-4 shrink-0" aria-hidden />{at("pdNotPowerBi")}</p>
    </div>
  )
}

type At = (key: string, vars?: Record<string, string | number>) => string

function Legend({ at }: { at: At }) {
  const items: [Level, string][] = [["green", "1–74%"], ["yellow", "75–90%"], ["red", "91%+"]]
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {at("pdLegend")}:
      {items.map(([l, range]) => <span key={l} className="inline-flex items-center gap-1.5"><span className={cn("size-2 rounded-full", BAR[l])} aria-hidden />{range}</span>)}
    </span>
  )
}

/** Budget and actual columns on desktop; one "actual / budget" figure on phones. */
function Hours({ actual, budget, fmt }: { actual: number; budget: number; fmt: (v: number) => string }) {
  return (
    <>
      <span className="text-right text-sm tabular-nums md:hidden"><b>{fmt(actual)}</b> / {fmt(budget)} h</span>
      <span className="hidden text-right text-sm text-muted-foreground tabular-nums md:block">{fmt(budget)} h</span>
      <span className="hidden text-right text-sm font-semibold tabular-nums md:block">{fmt(actual)} h</span>
    </>
  )
}

function Progress({ actual, budget, label }: { actual: number; budget: number; label: string }) {
  return (
    <span className="col-span-2 flex items-center gap-3 md:col-span-1">
      <Meter actual={actual} budget={budget} label={label} className="flex-1" />
      <span className="w-10 text-right text-xs font-medium tabular-nums">{pctOf(actual, budget)}%</span>
    </span>
  )
}

function MemberRow({ m, you, fmt, at, label }: { m: MemberTotals; you: boolean; fmt: (v: number) => string; at: At; label: string }) {
  const pct = pctOf(m.actual, m.scoped), level = levelOf(pct)
  const left = m.scoped - m.actual
  return (
    <li className="grid gap-x-6 gap-y-2 px-3 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex min-w-0 items-center gap-3">
        <Initials text={m.member.initials} you={you} />
        <div className="min-w-0">
          <div className="truncate font-medium">{m.member.name}{you && <span className="ml-2 rounded-full bg-citron/40 px-2 py-0.5 text-xs font-medium">{at("pdYou")}</span>}</div>
          <div className="truncate text-sm text-muted-foreground">{m.member.role}</div>
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="flex flex-wrap justify-between gap-x-3 text-sm">
          <span className="tabular-nums"><b>{fmt(m.actual)}</b> / {fmt(m.scoped)} h {at("pdScoped").toLowerCase()}</span>
          <span className="text-muted-foreground tabular-nums">{left >= 0 ? `${fmt(left)} h ${at("pdRemaining").toLowerCase()}` : `${at("pdOver")} ${fmt(-left)} h`}</span>
        </div>
        <Meter actual={m.actual} budget={m.scoped} label={label} />
        <div className="flex items-center justify-between">
          <StatusPill tone={TONE[level]}>{at(LABEL[level])}</StatusPill>
          <span className="text-xs font-medium tabular-nums">{pct}%</span>
        </div>
      </div>
    </li>
  )
}
