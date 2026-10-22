/* Hash routes keep the demo deployable as static files: #/<view>?persona=<id>. */
import { useEffect } from "react"
import { PERSONAS, type PersonaId, type ViewId } from "@/data/reference-data"
import { useDemo } from "@/store/store"
import type { TimecardLayout } from "@/store/types"

export const ALL_VIEWS: ViewId[] = ["home", "punch", "timecard", "grid", "kiosk", "journeys", "timeoff"]
const DEFAULT_PERSONA: Partial<Record<ViewId, PersonaId>> = { punch: "ava", timecard: "ava", grid: "zofia", kiosk: "lukas" }

/** Views a persona can open: their own, plus Time Off and the journey register. */
export const personaViews = (p: PersonaId): ViewId[] => [...new Set<ViewId>([...PERSONAS[p].views, "timeoff", "journeys"])]

function parse(hash: string) {
  const fragment = hash.replace(/^#/, "").replace(/^\/+/, "")
  const [route, ...rest] = fragment.split("?")
  const query = new URLSearchParams(rest.join("?"))
  const layout = query.get("layout")
  return {
    route: (route || "").toLowerCase() as ViewId,
    persona: query.get("persona") as PersonaId | null,
    layout: layout === "classic" || layout === "modern" ? (layout as TimecardLayout) : null,
  }
}

const hashFor = (view: ViewId, persona: PersonaId) => `#/${view}?persona=${encodeURIComponent(persona)}`

function applyHash() {
  const { route, persona, layout } = parse(location.hash)
  if (!ALL_VIEWS.includes(route)) return false
  const st = useDemo.getState()
  const requested = persona && PERSONAS[persona] ? persona : st.s.persona
  const nextPersona = personaViews(requested).includes(route) ? requested : DEFAULT_PERSONA[route] || "ava"
  // A shared link can pin the timecard layout, e.g. #/timecard?persona=ava&layout=modern.
  st.mutate(s => { s.persona = nextPersona; s.view = route; if (layout) s.settings.layout = layout })
  return true
}

/** Apply the incoming link before the first render so it wins over saved state. */
export const initRouting = () => applyHash()

/** Keeps the URL and the demo state in step, including browser back and forward. */
export function useHashRouting() {
  const view = useDemo(st => st.s.view)
  const persona = useDemo(st => st.s.persona)

  useEffect(() => {
    const onChange = () => { applyHash(); window.scrollTo({ top: 0 }) }
    window.addEventListener("hashchange", onChange)
    return () => window.removeEventListener("hashchange", onChange)
  }, [])

  useEffect(() => {
    if (!personaViews(persona).includes(view)) {
      useDemo.getState().go(PERSONAS[persona].land)
      return
    }
    const next = hashFor(view, persona)
    if (location.hash !== next) history.pushState(null, "", next)
  }, [view, persona])
}
