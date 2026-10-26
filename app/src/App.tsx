import { lazy, Suspense, useEffect } from "react"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AppShell } from "@/components/app/app-shell"
import { useIsMobile } from "@/components/app/responsive-panel"
import { SettingsPanel } from "@/components/app/settings-panel"
import type { ViewId } from "@/data/reference-data"
import { useHashRouting } from "@/lib/routing"
import { useDemo } from "@/store/store"

const views: Record<ViewId, React.LazyExoticComponent<() => React.ReactElement>> = {
  home: lazy(() => import("@/features/home/home-view")),
  punch: lazy(() => import("@/features/punch/punch-view")),
  timecard: lazy(() => import("@/features/timecard/timecard-view")),
  grid: lazy(() => import("@/features/project-hours/project-hours-view")),
  kiosk: lazy(() => import("@/features/kiosk/kiosk-view")),
  journeys: lazy(() => import("@/features/journeys/journeys-view")),
  timeoff: lazy(() => import("@/features/time-off/time-off-view")),
  projects: lazy(() => import("@/features/projects/projects-view")),
}

function ViewFallback() {
  return <div className="h-64 animate-pulse rounded-2xl bg-muted" aria-busy="true" aria-label="Loading" />
}

export default function App() {
  useHashRouting()
  const view = useDemo(st => st.s.view)
  const scheme = useDemo(st => st.s.settings.scheme) || "spiro"
  const mobile = useIsMobile()
  useEffect(() => { document.documentElement.dataset.scheme = scheme }, [scheme])
  const View = views[view]
  const content = (
    <Suspense fallback={<ViewFallback />}>
      <View key={view} />
    </Suspense>
  )
  return (
    <TooltipProvider delayDuration={300}>
      {view === "kiosk" ? content : <AppShell>{content}</AppShell>}
      <SettingsPanel />
      <Toaster position={mobile ? "top-center" : "bottom-right"} closeButton richColors={false} />
    </TooltipProvider>
  )
}
