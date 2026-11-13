import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Check } from "lucide-react"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Switch } from "@/components/ui/switch"
import { ResponsivePanel } from "@/components/app/responsive-panel"
import { Notice, StatusPill } from "@/components/app/status"
import { ACTIVITIES, APPROVERS, LABOR, OTHER_TIME, PAYCODES, PROJECTS } from "@/data/reference-data"
import { assigned, gridWeekOf, isHidden, laborDefaults, startNote } from "@/lib/engine"
import { cn } from "@/lib/utils"
import { useT } from "@/lib/i18n"
import { useDemo } from "@/store/store"

/** Choose which assigned projects appear on the weekly timecard (display preference only). */
export function ManageProjectsPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const s = useDemo(st => st.s)
  const setHidden = useDemo(st => st.setProjectHidden)
  const { at } = useT()
  const emp = s.persona
  const list = assigned(s, emp)
  const group = (title: string, codes: string[], empty: string) => (
    <section className="space-y-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold">{title} <StatusPill icon={false}>{codes.length}</StatusPill></h3>
      {codes.length ? (
        <ul className="divide-y rounded-2xl border bg-card">
          {codes.map(c => {
            const on = !isHidden(s, emp, c), note = startNote(c)
            return (
              <li key={c}>
                <label className="flex min-h-14 cursor-pointer items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="block font-medium">{c} · {PROJECTS[c].name}</span>
                    <span className="block truncate text-muted-foreground">{PROJECTS[c].client}{note ? ` · ${note}` : ""}</span>
                  </span>
                  <Switch checked={on} onCheckedChange={v => setHidden(c, !v)} aria-label={`${at("showOnTimecard")}: ${c}`} />
                </label>
              </li>
            )
          })}
        </ul>
      ) : <p className="text-sm text-muted-foreground">{empty}</p>}
    </section>
  )
  return (
    <ResponsivePanel
      open={open}
      onOpenChange={onOpenChange}
      title={at("manageProjects")}
      description="Choose which assigned projects appear on your timecard. Hidden projects stay assigned to you."
      footer={<Button size="lg" className="w-full sm:w-auto" onClick={() => onOpenChange(false)}>Done</Button>}
    >
      <div className="space-y-5">
        {group(at("shown"), list.filter(c => !isHidden(s, emp, c)), "No visible projects.")}
        {group(at("hidden"), list.filter(c => isHidden(s, emp, c)), "Nothing is hidden.")}
      </div>
    </ResponsivePanel>
  )
}

/** Every activity as one flat entry; the value is what the grid row stores ("Group › Activity"). */
const ACTIVITY_LIST = ACTIVITIES.flatMap(g => g.items.length
  ? g.items.map(i => ({ v: `${g.group} › ${i.name}`, group: g.group, name: i.name, def: i.def }))
  : [{ v: g.group, group: "", name: g.group, def: g.def || "" }])

/**
 * Searchable, always-open list: 30 activities are too many for a plain dropdown, and three
 * share the name "Travel", so each row carries its group and definition. Recently used first.
 */
function ActivityPicker({ value, onChange, recent, onWeek }: { value: string; onChange: (v: string) => void; recent: string[]; onWeek: Set<string> }) {
  const row = (a: (typeof ACTIVITY_LIST)[number], key: string) => {
    const taken = onWeek.has(a.v)
    return (
      <CommandItem
        key={key}
        value={`${key} ${a.group} ${a.name} ${a.def}`}
        disabled={taken}
        onSelect={() => onChange(a.v)}
        className={cn("min-h-12 items-start gap-2.5 rounded-lg py-2", value === a.v && "bg-accent")}
      >
        <Check className={cn("mt-0.5 size-4 shrink-0 text-primary", value === a.v ? "opacity-100" : "opacity-0")} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{a.name}</span>
          {a.def && <span className="block text-xs leading-snug text-muted-foreground">{a.def}</span>}
        </span>
        {taken && <span className="shrink-0 text-xs text-muted-foreground">On timecard</span>}
      </CommandItem>
    )
  }
  const recentItems = recent.map(v => ACTIVITY_LIST.find(a => a.v === v)).filter(a => !!a)
  return (
    <Command className="rounded-xl border bg-card" loop filter={(value, search) => (value.toLowerCase().includes(search.trim().toLowerCase()) ? 1 : 0)}>
      {/* Focus search on desktop only: on phones the keyboard would cover the list. */}
      <CommandInput placeholder="Search activities, e.g. training, travel" aria-label="Search activities" autoFocus={typeof window !== "undefined" && window.matchMedia("(min-width: 640px)").matches} />
      <CommandList className="max-h-[min(22rem,45dvh)] scroll-py-2 p-1">
        <CommandEmpty>No activity matches. Try a broader word, like meeting.</CommandEmpty>
        {recentItems.length > 0 && (
          <CommandGroup heading="Recently used">{recentItems.map(a => row(a, `recent:${a.v}`))}</CommandGroup>
        )}
        {ACTIVITIES.map(g => (
          <CommandGroup key={g.group} heading={g.items.length ? g.group : undefined}>
            {ACTIVITY_LIST.filter(a => a.v === g.group || a.group === g.group).map(a => row(a, a.v))}
          </CommandGroup>
        ))}
      </CommandList>
    </Command>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}{required && <span className="text-destructive"> *</span>}</span>
      {children}
    </label>
  )
}

/** "Add new": a project row with its transfer and labor categories (UKG Project › Transfer › Labor categories). */
export function AddRowPanel({ open, onOpenChange, onAdded, initialKind = "project" }: { open: boolean; onOpenChange: (v: boolean) => void; onAdded: (id: string) => void; initialKind?: "project" | "other" }) {
  const s = useDemo(st => st.s)
  const addRow = useDemo(st => st.addGridRow)
  const { at, t } = useT()
  const emp = s.persona
  const d = laborDefaults(emp)
  // Project work is billed through Odoo; Other time is non-billable and goes to UKG only.
  const [kind, setKind] = useState(initialKind)
  const [proj, setProj] = useState("")
  const [task, setTask] = useState("")
  const [paycode, setPaycode] = useState(PAYCODES[0])
  const [tc, setTc] = useState(d.tc || "")
  const [func, setFunc] = useState(d.func || "")
  const [err, setErr] = useState("")
  const [busy, setBusy] = useState(false)
  const [opened, setOpened] = useState(open)
  if (open !== opened) { setOpened(open); if (open) { setKind(initialKind); setProj(""); setTask(""); setErr("") } }
  const other = kind === "other"
  const target = other ? OTHER_TIME : proj
  const pr = target ? PROJECTS[target] : null
  const activity = other ? ACTIVITY_LIST.find(a => a.v === task) : undefined
  // Recent = last week's activities not yet on this week; ones already on this week can't be added twice.
  const weekRows = (off: number) => gridWeekOf(s, emp, s.period + off).rows.filter(r => r.proj === OTHER_TIME && !r.archived && r.task)
  const onWeek = new Set(weekRows(0).map(r => r.task))
  const recent = [...new Set(weekRows(-1).map(r => r.task))].filter(v => !onWeek.has(v)).slice(0, 3)
  const codes = assigned(s, emp)

  const apply = () => {
    if (other && !task) { setErr("Choose an activity."); return }
    if (!other && !proj) { setErr("Choose a project."); return }
    if (!other && pr?.taskReq && !task) { setErr(`${proj} requires a task.`); return }
    setBusy(true)
    setErr("")
    // UKG validates the labor entry before the row appears.
    setTimeout(() => {
      const problem = addRow({ proj: target, task, paycode, tc, func })
      setBusy(false)
      if (problem) { setErr(problem); return }
      toast.success(other ? `${task} added as non-billable time.` : `${proj} added.`)
      onOpenChange(false)
      setProj(""); setTask("")
      const week = useDemo.getState().s.grid[emp]
      const rows = week ? Object.values(week).flatMap(w => w.rows) : []
      const added = rows.filter(r => r.proj === target).at(-1)
      if (added) onAdded(added.id)
    }, 500)
  }

  return (
    <ResponsivePanel
      open={open}
      onOpenChange={onOpenChange}
      title="Add time"
      description={other ? "Non-billable work that isn't part of a client project, like meetings, training or admin." : "Add a project row with its labor categories. You then enter hours on that row."}
      footer={
        <>
          <Button variant="outline" size="lg" onClick={() => onOpenChange(false)}>{t("cancel")}</Button>
          <Button size="lg" onClick={apply} disabled={busy}>{busy ? "Checking with UKG…" : other ? "Add activity" : at("addProject")}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <ToggleGroup type="single" variant="outline" value={kind} onValueChange={v => { if (v) { setKind(v as typeof kind); setTask(""); setErr("") } }} className="w-full" aria-label="Type of time">
          <ToggleGroupItem value="project" className="h-11 flex-1">Project work</ToggleGroupItem>
          <ToggleGroupItem value="other" className="h-11 flex-1">Other time (non-billable)</ToggleGroupItem>
        </ToggleGroup>
        {err && <Notice tone="danger">{err}</Notice>}
        {other ? (
          <>
            <div className="space-y-1.5">
              <span className="text-sm font-medium">Activity<span className="text-destructive"> *</span></span>
              <ActivityPicker value={task} onChange={v => { setTask(v); setErr("") }} recent={recent} onWeek={onWeek} />
            </div>
            <p className="text-sm text-muted-foreground">
              {activity ? <><b className="font-medium text-foreground">{activity.group ? `${activity.group} › ` : ""}{activity.name}</b> · </> : null}
              No project needed. Approved by {APPROVERS[PROJECTS[OTHER_TIME].approver]}, your manager, and sent to UKG only.
            </p>
          </>
        ) : (<>
        <Field label={t("project")} required>
          <Select value={proj} onValueChange={v => { setProj(v); setTask(PROJECTS[v].taskReq ? "" : PROJECTS[v].tasks[0]) }}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Choose a project" /></SelectTrigger>
            <SelectContent>
              {codes.map(c => (
                <SelectItem key={c} value={c}>
                  {c} · {PROJECTS[c].name}{isHidden(s, emp, c) ? ` (${at("hidden").toLowerCase()})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={t("task")} required={!!pr?.taskReq}>
          <Select value={task} onValueChange={setTask} disabled={!pr}>
            <SelectTrigger className="w-full"><SelectValue placeholder={pr ? "Choose a task" : "Choose a project first"} /></SelectTrigger>
            <SelectContent>{pr?.tasks.map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Paycode" required>
            <Select value={paycode} onValueChange={setPaycode}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{PAYCODES.map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Timecard Code">
            <Select value={tc} onValueChange={setTc}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{LABOR.opts.tc.map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
        </div>
        <Field label="Function">
          <Select value={func} onValueChange={setFunc}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{LABOR.opts.func.map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <p className="text-sm text-muted-foreground">Transfer charges these hours to a project and task. Only labor categories are required in this release.</p>
        </>)}
      </div>
    </ResponsivePanel>
  )
}
