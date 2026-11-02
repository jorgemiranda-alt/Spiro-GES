import { useId, useMemo, useRef, useState } from "react"
import { Eye, Search, X } from "lucide-react"
import { toast } from "sonner"
import { StatusPill } from "@/components/app/status"
import { Button } from "@/components/ui/button"
import { PROJECTS } from "@/data/reference-data"
import { assigned, isHidden } from "@/lib/engine"
import { useT } from "@/lib/i18n"
import { MAX_RESULTS, searchProjects } from "@/lib/project-search"
import { cn } from "@/lib/utils"
import { useDemo } from "@/store/store"

/** Screens mark each project's row or card with data-project so a search result can find it. */
const rowOf = (code: string) =>
  [...document.querySelectorAll<HTMLElement>(`[data-project="${CSS.escape(code)}"]`)].find(el => el.offsetParent)

/** Scrolls to the project's existing row or card, rings it briefly and moves focus there. False when it is not on screen. */
export function locateProject(code: string): boolean {
  const el = rowOf(code)
  if (!el) return false
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches
  el.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "center" })
  el.setAttribute("tabindex", "-1")
  el.focus({ preventScroll: true })
  if (!calm) {
    el.animate(
      [{ boxShadow: "0 0 0 0 color-mix(in oklab, var(--citron) 0%, transparent)" }, { boxShadow: "0 0 0 6px color-mix(in oklab, var(--citron) 70%, transparent)" }, { boxShadow: "0 0 0 0 color-mix(in oklab, var(--citron) 0%, transparent)" }],
      { duration: 1400, easing: "cubic-bezier(.16,1,.3,1)" },
    )
  }
  return true
}

/** Waits a frame or two for React to draw a restored row, then scrolls to it. */
function locateSoon(code: string, tries = 6): Promise<boolean> {
  return new Promise(resolve => {
    const go = (left: number) => {
      if (locateProject(code)) return resolve(true)
      if (left <= 0) return resolve(false)
      setTimeout(() => go(left - 1), 60)
    }
    requestAnimationFrame(() => go(tries))
  })
}

/**
 * "Search by project number" over the employee's own assigned projects, shown and hidden alike.
 * It never assigns anything: results come only from assigned(), and picking one either goes to its
 * existing row or restores it through the same visibility switch as the rest of the screen.
 */
export function ProjectSearch({ emp, isShown, className }: { emp: string; isShown: (code: string) => boolean; className?: string }) {
  const s = useDemo(st => st.s)
  const setHidden = useDemo(st => st.setProjectHidden)
  const { at } = useT()
  const id = useId()
  const box = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const [q, setQ] = useState("")
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  // The whole assigned list, not only the rows on screen.
  const odoo = s.odooAssignments
  const all = useMemo(() => assigned({ odooAssignments: odoo } as typeof s, emp).map(code => ({ code })), [odoo, emp]) // eslint-disable-line react-hooks/exhaustive-deps
  const found = useMemo(() => searchProjects(all, q), [all, q])
  const results = found.slice(0, MAX_RESULTS)
  const listOpen = open && q.trim() !== ""
  const current = Math.min(active, Math.max(results.length - 1, 0))

  const stateOf = (code: string): "shown" | "hidden" | "away" =>
    isShown(code) ? "shown" : isHidden(s, emp, code) ? "hidden" : "away"

  const reset = () => { setQ(""); setOpen(false); setActive(0) }

  const pick = async (code: string) => {
    if (busy) return
    setError(null)
    const st = stateOf(code)
    if (st === "away") {
      reset()
      toast(at("projNotThisWeek", { code }))
      return
    }
    if (st === "hidden") {
      setBusy(code)
      try {
        setHidden(code, false)
        // Only report success if the preference really changed.
        if (isHidden(useDemo.getState().s, emp, code)) throw new Error("not restored")
      } catch {
        setBusy(null)
        setError(at("projShowFail", { code }))
        return
      }
      setBusy(null)
      toast.success(at("projShownToast", { code }))
    }
    reset()
    if (!(await locateSoon(code))) toast(at("projNotThisWeek", { code }))
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!results.length) return
      e.preventDefault()
      setOpen(true)
      const step = e.key === "ArrowDown" ? 1 : -1
      setActive((current + step + results.length) % results.length)
    } else if (e.key === "Enter") {
      if (listOpen && results[current]) { e.preventDefault(); void pick(results[current].code) }
    } else if (e.key === "Escape") {
      if (listOpen) { e.preventDefault(); setOpen(false) }
      else if (q) { e.preventDefault(); reset() }
    }
  }

  const status = !q.trim() ? "" : results.length
    ? at("projFound", { n: found.length })
    : at("projNoMatch", { q: q.trim() })

  return (
    <div
      ref={box}
      className={cn("relative", className)}
      onBlur={e => { if (!box.current?.contains(e.relatedTarget as Node | null)) setOpen(false) }}
    >
      <label htmlFor={`${id}-input`} className="mb-1.5 block text-sm font-medium">{at("projSearch")}</label>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          ref={input}
          id={`${id}-input`}
          role="combobox"
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          aria-expanded={listOpen}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={listOpen && results.length ? `${id}-opt-${current}` : undefined}
          aria-describedby={`${id}-status`}
          placeholder={at("projSearchHint")}
          value={q}
          onChange={e => { setQ(e.target.value); setOpen(true); setActive(0); setError(null) }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          className="h-11 w-full rounded-lg border border-input bg-transparent pr-10 pl-9 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:h-10 sm:text-sm"
        />
        {q && (
          <button
            type="button"
            aria-label={at("projSearchClear")}
            className="absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted"
            onClick={() => { reset(); setError(null); input.current?.focus() }}
          >
            <X className="size-4" aria-hidden />
          </button>
        )}
      </div>

      {/* Announced politely as the list changes; also shown on screen when nothing matches. */}
      <p id={`${id}-status`} role="status" className={cn("mt-1.5 text-sm text-muted-foreground", (!listOpen || results.length > 0) && "sr-only")}>{status}</p>
      {error && (
        <p role="alert" className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-destructive">
          {error}
          <Button type="button" size="sm" variant="outline" onClick={() => { const c = results[current]?.code; if (c) void pick(c) }}>{at("projTryAgain")}</Button>
        </p>
      )}

      {listOpen && results.length > 0 && (
        <ul
          id={`${id}-list`}
          role="listbox"
          aria-label={at("projSearch")}
          className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto overscroll-contain rounded-xl border bg-popover p-1 shadow-raised"
        >
          {results.map(({ code }, i) => {
            const p = PROJECTS[code], st = stateOf(code), on = i === current
            return (
              <li
                key={code}
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={on}
                aria-disabled={busy === code || undefined}
                // Keep focus in the field so the keyboard keeps working after a tap.
                onMouseDown={e => e.preventDefault()}
                onMouseMove={() => setActive(i)}
                onClick={() => void pick(code)}
                className={cn("flex min-h-12 cursor-pointer items-center gap-3 rounded-lg px-3 py-2", on && "bg-muted")}
              >
                <div className="min-w-0 flex-1">
                  <div className="font-semibold tabular-nums">{code}</div>
                  <div className="truncate text-sm text-muted-foreground">{p.name}</div>
                </div>
                {st === "shown" && <StatusPill tone="success" icon={false}>{at("projVisible")}</StatusPill>}
                {st === "hidden" && (
                  <span className="inline-flex shrink-0 items-center gap-2">
                    <StatusPill tone="neutral" icon={false}>{at("hidden")}</StatusPill>
                    <span className="inline-flex items-center gap-1 rounded-md border bg-card px-2 py-1 text-xs font-medium text-primary"><Eye className="size-3.5" aria-hidden /> {at("projShow")}</span>
                  </span>
                )}
                {st === "away" && <StatusPill tone="neutral" icon={false}>{at("projAway")}</StatusPill>}
              </li>
            )
          })}
          {found.length > results.length && (
            <li role="presentation" className="px-3 py-2 text-xs text-muted-foreground">{at("projMore", { n: found.length - results.length })}</li>
          )}
        </ul>
      )}
    </div>
  )
}
