import { useState, type ReactNode } from "react"
import { Check, Download, Ellipsis, Globe, Settings2 } from "lucide-react"
import { toast } from "sonner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { LOGO_SRC } from "@/data/assets"
import { PERSONAS, type PersonaId, type ViewId } from "@/data/reference-data"
import { LANGUAGES, useT } from "@/lib/i18n"
import { useInstall } from "@/lib/pwa"
import { personaViews } from "@/lib/routing"
import { cn } from "@/lib/utils"
import { useDemo } from "@/store/store"
import { useUI } from "@/store/ui"
import { VIEW_ICONS } from "./common"
import { NotificationBell, NotificationsPanel, useNotificationAnnouncer } from "./notifications"
import { ResponsivePanel } from "./responsive-panel"

const PERSONA_IDS = Object.keys(PERSONAS) as PersonaId[]

function Avatar({ initials, className }: { initials: string; className?: string }) {
  return (
    <span aria-hidden className={cn("grid size-9 shrink-0 place-items-center rounded-full bg-citron text-[13px] font-semibold text-nav", className)}>
      {initials}
    </span>
  )
}

function useNavItems() {
  const persona = useDemo(st => st.s.persona)
  const views = personaViews(persona)
  const work: ViewId[] = views.filter(v => v !== "journeys")
  return { work, all: views }
}

function InstallButton({ dark }: { dark?: boolean }) {
  const install = useInstall()
  const [showHelp, setShowHelp] = useState(false)
  if (!install.available) return null
  return (
    <div>
      <button
        type="button"
        disabled={install.installing}
        onClick={async () => {
          if (install.canPrompt) {
            try { await install.prompt() } catch { toast.error(install.failed) }
          } else setShowHelp(v => !v)
        }}
        className={cn(
          "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium transition-colors",
          dark ? "text-nav-muted hover:bg-nav-2 hover:text-nav-foreground" : "hover:bg-muted",
        )}
      >
        <Download className="size-[18px]" aria-hidden />
        {install.label}
      </button>
      {showHelp && <p className={cn("px-3 pb-2 text-[13px]", dark ? "text-nav-muted" : "text-muted-foreground")}>{install.help}</p>}
    </div>
  )
}

/** Persona and language pickers, shared by the sidebar (dark) and the mobile profile sheet. */
function DemoControls({ dark }: { dark?: boolean }) {
  const s = useDemo(st => st.s)
  const setPersona = useDemo(st => st.setPersona)
  const setLang = useDemo(st => st.setLang)
  const { t } = useT()
  const trigger = cn("h-11 w-full rounded-xl", dark && "border-nav-2 bg-nav-2 text-nav-foreground [&_svg]:text-nav-muted")
  return (
    <div className="space-y-3">
      {!s.settings.hideViewAs && (
        <label className="block space-y-1.5">
          <span className={cn("text-xs font-medium tracking-wide uppercase", dark ? "text-nav-muted" : "text-muted-foreground")}>{t("viewingAs")}</span>
          <Select value={s.persona} onValueChange={v => setPersona(v as PersonaId)}>
            <SelectTrigger className={trigger} aria-label="Demo persona"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PERSONA_IDS.map(id => <SelectItem key={id} value={id}>{PERSONAS[id].label}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>
      )}
      <label className="block space-y-1.5">
        <span className={cn("text-xs font-medium tracking-wide uppercase", dark ? "text-nav-muted" : "text-muted-foreground")}>{t("language")}</span>
        <Select value={s.lang} onValueChange={setLang}>
          <SelectTrigger className={trigger} aria-label={t("language")}><Globe className="size-4" /><SelectValue /></SelectTrigger>
          <SelectContent>
            {LANGUAGES.map(l => <SelectItem key={l.code} value={l.code}>{l.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </label>
    </div>
  )
}

function Sidebar() {
  const view = useDemo(st => st.s.view)
  const persona = useDemo(st => st.s.persona)
  const go = useDemo(st => st.go)
  const openSettings = useUI(st => st.setSettingsOpen)
  const { t, at } = useT()
  const { work } = useNavItems()
  const P = PERSONAS[persona]
  const item = (v: ViewId) => {
    const Icon = VIEW_ICONS[v], on = view === v
    return (
      <button
        key={v}
        type="button"
        onClick={() => go(v)}
        aria-current={on ? "page" : undefined}
        className={cn(
          "group flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] font-medium transition-colors duration-150",
          on ? "bg-nav-2 text-nav-foreground" : "text-nav-muted hover:bg-nav-2/60 hover:text-nav-foreground",
        )}
      >
        <span className={cn("grid size-7 place-items-center rounded-lg transition-colors", on ? "bg-citron text-nav" : "text-current")}>
          <Icon className="size-[18px]" aria-hidden />
        </span>
        {t(v)}
      </button>
    )
  }
  return (
    <aside className="sticky top-0 hidden h-dvh w-[272px] shrink-0 flex-col gap-6 overflow-y-auto bg-nav px-4 py-5 text-nav-foreground lg:flex" aria-label={t("menu")}>
      <div className="flex items-center gap-3 px-1">
        <span className="rounded-xl bg-white px-3 py-2"><img src={LOGO_SRC} alt="Spiro" width={84} height={43} className="block h-auto" /></span>
        <span className="text-[13px] leading-tight text-nav-muted">Time &amp;<br />Operations</span>
        <NotificationBell dark className="ml-auto" />
      </div>
      <nav className="space-y-6" aria-label={t("menu")}>
        <div className="space-y-1">
          <div className="px-3 pb-1 text-xs font-medium tracking-wide text-nav-muted uppercase">{t("timekeeping")}</div>
          {work.map(item)}
        </div>
        <div className="space-y-1">
          <div className="px-3 pb-1 text-xs font-medium tracking-wide text-nav-muted uppercase">{t("delivery")}</div>
          {item("journeys")}
        </div>
      </nav>
      <div className="mt-auto space-y-4">
        <div className="flex items-center gap-3 rounded-2xl bg-nav-2 p-3">
          <Avatar initials={P.initials} />
          <div className="min-w-0 leading-tight">
            <div className="truncate font-medium">{P.name}</div>
            <div className="truncate text-[13px] text-nav-muted">{P.role}</div>
          </div>
        </div>
        <DemoControls dark />
        <div className="space-y-0.5">
          <button type="button" onClick={() => openSettings(true)} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-nav-muted transition-colors hover:bg-nav-2 hover:text-nav-foreground">
            <Settings2 className="size-[18px]" aria-hidden /> {at("demoSettings")}
          </button>
          <InstallButton dark />
        </div>
      </div>
    </aside>
  )
}

function MobileTopBar() {
  const view = useDemo(st => st.s.view)
  const persona = useDemo(st => st.s.persona)
  const openProfile = useUI(st => st.setProfileOpen)
  const { t } = useT()
  const P = PERSONAS[persona]
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 pt-safe backdrop-blur-md lg:hidden">
      <div className="flex h-14 items-center gap-3 px-4">
        <img src={LOGO_SRC} alt="Spiro" width={56} height={29} className="h-auto shrink-0 rounded-md bg-white px-1 py-0.5" />
        <div className="min-w-0 flex-1 leading-tight" aria-label={t(view)}>
          <p className="truncate text-[15px] font-semibold">{P.name}</p>
          <p className="truncate text-xs text-muted-foreground">{P.role}</p>
        </div>
        <NotificationBell />
        <button type="button" onClick={() => openProfile(true)} className="rounded-full p-0.5 outline-offset-2" aria-label={`${t("viewingAs")}: ${P.name}`}>
          <Avatar initials={P.initials} />
        </button>
      </div>
    </header>
  )
}

function BottomTabs() {
  const view = useDemo(st => st.s.view)
  const go = useDemo(st => st.go)
  const openProfile = useUI(st => st.setProfileOpen)
  const { t, at } = useT()
  const { work } = useNavItems()
  const tabs = work.slice(0, 4)
  const moreActive = !tabs.includes(view)
  const tab = (key: string, label: string, Icon: typeof Ellipsis, on: boolean, onClick: () => void) => (
    <button
      key={key}
      type="button"
      onClick={onClick}
      aria-current={on ? "page" : undefined}
      className="group flex min-h-14 flex-1 flex-col items-center justify-center gap-1 pt-1.5 text-[11px] font-medium"
    >
      <span className={cn("grid h-7 w-14 place-items-center rounded-full transition-colors duration-200", on ? "bg-primary-soft text-primary" : "text-muted-foreground group-active:bg-muted")}>
        <Icon className="size-[21px]" strokeWidth={on ? 2.2 : 1.8} aria-hidden />
      </span>
      <span className={cn("max-w-full truncate px-1", on ? "text-foreground" : "text-muted-foreground")}>{label}</span>
    </button>
  )
  return (
    <nav aria-label={t("menu")} className="fixed inset-x-0 bottom-0 z-30 border-t border-border/80 bg-card/95 pb-safe backdrop-blur-md lg:hidden">
      <div className="mx-auto flex max-w-xl">
        {tabs.map(v => tab(v, t(v), VIEW_ICONS[v], view === v, () => go(v)))}
        {tab("more", at("more"), Ellipsis, moreActive, () => openProfile(true))}
      </div>
    </nav>
  )
}

function ProfileSheet() {
  const open = useUI(st => st.profileOpen)
  const setOpen = useUI(st => st.setProfileOpen)
  const openSettings = useUI(st => st.setSettingsOpen)
  const view = useDemo(st => st.s.view)
  const go = useDemo(st => st.go)
  const { t, at } = useT()
  const { work, all } = useNavItems()
  const extra = all.filter(v => !work.slice(0, 4).includes(v))
  return (
    <ResponsivePanel open={open} onOpenChange={setOpen} title={at("more")}>
      <div className="space-y-5">
        <div className="overflow-hidden rounded-2xl border bg-card">
          {extra.map(v => {
            const Icon = VIEW_ICONS[v]
            return (
              <button key={v} type="button" onClick={() => { go(v); setOpen(false) }} className="flex min-h-13 w-full items-center gap-3 border-b px-4 py-3 text-left text-[15px] font-medium last:border-b-0 active:bg-muted">
                <span className="grid size-8 place-items-center rounded-lg bg-primary-soft text-primary"><Icon className="size-[18px]" aria-hidden /></span>
                <span className="flex-1">{t(v)}</span>
                {view === v && <Check className="size-4 text-primary" aria-label="Current" />}
              </button>
            )
          })}
        </div>
        <DemoControls />
        <div className="overflow-hidden rounded-2xl border bg-card">
          <button type="button" onClick={() => { setOpen(false); openSettings(true) }} className="flex min-h-13 w-full items-center gap-3 border-b px-4 py-3 text-left text-[15px] font-medium active:bg-muted">
            <Settings2 className="size-[18px] text-muted-foreground" aria-hidden /> {at("demoSettings")}
          </button>
          <div className="px-1 py-1"><InstallButton /></div>
        </div>
      </div>
    </ResponsivePanel>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  useNotificationAnnouncer()
  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopBar />
        <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 pt-5 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-10 lg:pt-9 lg:pb-12">
          {children}
        </main>
      </div>
      <BottomTabs />
      <ProfileSheet />
      <NotificationsPanel />
    </div>
  )
}

