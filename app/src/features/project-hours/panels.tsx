import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { ResponsivePanel } from "@/components/app/responsive-panel"
import { Notice, StatusPill } from "@/components/app/status"
import { LABOR, PAYCODES, PROJECTS } from "@/data/reference-data"
import { assigned, isHidden, laborDefaults, startNote } from "@/lib/engine"
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

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}{required && <span className="text-destructive"> *</span>}</span>
      {children}
    </label>
  )
}

/** "Add new": a project row with its transfer and labor categories (UKG Project › Transfer › Labor categories). */
export function AddRowPanel({ open, onOpenChange, onAdded }: { open: boolean; onOpenChange: (v: boolean) => void; onAdded: (id: string) => void }) {
  const s = useDemo(st => st.s)
  const addRow = useDemo(st => st.addGridRow)
  const { at, t } = useT()
  const emp = s.persona
  const d = laborDefaults(emp)
  const [proj, setProj] = useState("")
  const [task, setTask] = useState("")
  const [paycode, setPaycode] = useState(PAYCODES[0])
  const [tc, setTc] = useState(d.tc || "")
  const [func, setFunc] = useState(d.func || "")
  const [err, setErr] = useState("")
  const [busy, setBusy] = useState(false)
  const pr = proj ? PROJECTS[proj] : null
  const codes = assigned(s, emp)

  const apply = () => {
    if (!proj) { setErr("Choose a project."); return }
    if (pr?.taskReq && !task) { setErr(`${proj} requires a task.`); return }
    setBusy(true)
    setErr("")
    // UKG validates the labor entry before the row appears.
    setTimeout(() => {
      const problem = addRow({ proj, task, paycode, tc, func })
      setBusy(false)
      if (problem) { setErr(problem); return }
      toast.success(`${proj} added.`)
      onOpenChange(false)
      setProj(""); setTask("")
      const week = useDemo.getState().s.grid[emp]
      const rows = week ? Object.values(week).flatMap(w => w.rows) : []
      const added = rows.filter(r => r.proj === proj).at(-1)
      if (added) onAdded(added.id)
    }, 500)
  }

  return (
    <ResponsivePanel
      open={open}
      onOpenChange={onOpenChange}
      title={at("addProject")}
      description="Add a project row with its labor categories. You then enter hours on that row."
      footer={
        <>
          <Button variant="outline" size="lg" onClick={() => onOpenChange(false)}>{t("cancel")}</Button>
          <Button size="lg" onClick={apply} disabled={busy}>{busy ? "Checking with UKG…" : at("addProject")}</Button>
        </>
      }
    >
      <div className="space-y-4">
        {err && <Notice tone="danger">{err}</Notice>}
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
      </div>
    </ResponsivePanel>
  )
}
