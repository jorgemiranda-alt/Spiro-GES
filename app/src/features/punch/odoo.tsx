import { useState } from "react"
import { Check, ChevronsUpDown, Plus, Search, Settings2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { ResponsivePanel } from "@/components/app/responsive-panel"
import { StatusPill } from "@/components/app/status"
import { PROJECTS } from "@/data/reference-data"
import { assigned, HIDE_AHEAD_DAYS, isPunchOdooHidden, startNote } from "@/lib/engine"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { useDemo } from "@/store/store"

/** Optional Odoo project for the next Punch In, searchable (PU-05). */
export function OdooProjectPicker({ codes, value, onChange, onManage }: { codes: string[]; value: string; onChange: (code: string) => void; onManage: () => void }) {
  const [open, setOpen] = useState(false)
  const { t } = useT()
  const p = value ? PROJECTS[value] : null
  return (
    <div className="space-y-1.5">
      <span className="text-sm font-medium" id="odoo-project-label">{t("odooProject")} <span className="font-normal text-muted-foreground">{t("optional")}</span></span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-labelledby="odoo-project-label"
            className="flex h-11 w-full items-center gap-2 rounded-lg border border-input bg-card px-3 text-left text-[15px] data-[state=open]:border-ring"
          >
            <span className={cn("min-w-0 flex-1 truncate", !p && "text-muted-foreground")}>{p ? `${value} · ${p.name}` : t("noProject")}</span>
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[--radix-popover-trigger-width] min-w-72 rounded-2xl p-0">
          <Command>
            <CommandInput placeholder="Search projects" />
            <CommandList>
              <CommandEmpty>No matching active projects.</CommandEmpty>
              <CommandGroup>
                <CommandItem value="__none" onSelect={() => { onChange(""); setOpen(false) }}>
                  <Check className={cn("size-4", value ? "opacity-0" : "opacity-100")} /> {t("noProject")}
                </CommandItem>
                {codes.map(c => (
                  <CommandItem key={c} value={`${c} ${PROJECTS[c].name} ${PROJECTS[c].client}`} onSelect={() => { onChange(c); setOpen(false) }} className="items-start">
                    <Check className={cn("mt-0.5 size-4", value === c ? "opacity-100" : "opacity-0")} />
                    <span className="min-w-0">
                      <span className="block font-medium">{c} · {PROJECTS[c].name}</span>
                      <span className="block text-xs text-muted-foreground">{PROJECTS[c].client}</span>
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup>
                <CommandItem value="__manage" onSelect={() => { setOpen(false); onManage() }}>
                  <Settings2 className="size-4" /> Manage Odoo projects
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}

/** Choose which Odoo projects appear in the Punch list, and add more from the catalog. */
export function ManageOdooPanel({ open, onOpenChange, onAdded }: { open: boolean; onOpenChange: (v: boolean) => void; onAdded: (code: string) => void }) {
  const s = useDemo(st => st.s)
  const setHidden = useDemo(st => st.setPunchOdooHidden)
  const addOdoo = useDemo(st => st.addOdooProject)
  const [catalog, setCatalog] = useState(false)
  const [q, setQ] = useState("")
  const emp = s.persona
  const list = assigned(s, emp)
  const inList = new Set(list)
  const query = q.trim().toLocaleLowerCase()
  const matches = Object.entries(PROJECTS).filter(([code, p]) =>
    p.active && (p.startIn || 0) <= HIDE_AHEAD_DAYS && !inList.has(code) &&
    (!query || [code, p.name, p.client, p.show, p.umbrella].join(" ").toLocaleLowerCase().includes(query)))
  const group = (title: string, codes: string[], empty: string) => (
    <section className="space-y-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold">{title} <StatusPill icon={false}>{codes.length}</StatusPill></h3>
      {codes.length ? (
        <ul className="divide-y rounded-2xl border bg-card">
          {codes.map(c => {
            const on = !isPunchOdooHidden(s, emp, c), note = startNote(c)
            return (
              <li key={c}>
                <label className="flex min-h-14 cursor-pointer items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="block font-medium">{c} · {PROJECTS[c].name}</span>
                    <span className="block truncate text-muted-foreground">{PROJECTS[c].client}{note ? ` · ${note}` : ""}</span>
                  </span>
                  <Switch checked={on} onCheckedChange={v => setHidden(c, !v)} aria-label={`Show ${c} in the Punch project list`} />
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
      onOpenChange={v => { onOpenChange(v); if (!v) { setCatalog(false); setQ("") } }}
      title={catalog ? "Add projects from Odoo" : "Manage Odoo projects"}
      description={catalog ? "Search the demo Odoo catalog for active projects." : "Choose which active Odoo projects appear in the Punch project list."}
      footer={
        <>
          {catalog && <Button variant="outline" size="lg" onClick={() => setCatalog(false)}>Back</Button>}
          <Button size="lg" onClick={() => onOpenChange(false)}>Done</Button>
        </>
      }
    >
      {catalog ? (
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input type="search" autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Project, name, client, or event" aria-label="Search Odoo projects" className="pl-9" />
          </div>
          <ul className="divide-y rounded-2xl border">
            {matches.map(([code, p]) => (
              <li key={code} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1 text-sm">
                  <div className="font-medium">{code} · {p.name}</div>
                  <div className="truncate text-muted-foreground">{p.client}{p.show !== "—" ? ` · ${p.show}` : ""}</div>
                </div>
                <Button size="sm" onClick={() => { if (addOdoo(code)) { onAdded(code); toast.success(`${code} added and selected for this punch.`) } }}><Plus /> Add</Button>
              </li>
            ))}
            {!matches.length && <li className="px-4 py-3 text-sm text-muted-foreground">{q ? "No active projects match your search." : "No additional active projects are available in the demo catalog."}</li>}
          </ul>
        </div>
      ) : (
        <div className="space-y-5">
          <Button variant="outline" className="w-full" onClick={() => setCatalog(true)}><Plus /> Add projects from Odoo</Button>
          {group("Visible", list.filter(c => !isPunchOdooHidden(s, emp, c)), "No visible projects.")}
          {group("Hidden", list.filter(c => isPunchOdooHidden(s, emp, c)), "Nothing is hidden.")}
        </div>
      )}
    </ResponsivePanel>
  )
}
