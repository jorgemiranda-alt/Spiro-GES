import { useEffect, useRef, useState } from "react"
import { Bell, CalendarDays, Ellipsis, FolderKanban, Mail } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PERSONAS, type PersonaId } from "@/data/reference-data"
import { locale, todayStr } from "@/lib/dates"
import { useT } from "@/lib/i18n"
import { emailFor, inboxFor, NOTIFY_KINDS, prefsFor, unreadCount } from "@/lib/notifications"
import { cn } from "@/lib/utils"
import { useDemo } from "@/store/store"
import type { InboxItem, NotifyChannels } from "@/store/types"
import { useUI } from "@/store/ui"
import { fmtDateRange, personName, typeLabel } from "@/features/time-off/time-off-model"
import { ResponsivePanel, useIsMobile } from "./responsive-panel"

/** Notification text in the current language, built from the item's key and values. */
function useMessage() {
  const { lang, at } = useT()
  return (n: InboxItem) => {
    const v = { ...n.vars }
    if (n.kind === "timeoff") {
      v.type = typeLabel(lang, String(v.type))
      v.who = personName(String(v.who))
      v.dates = fmtDateRange({ start: String(v.start), end: String(v.end) }, lang)
    }
    return at(n.key, v)
  }
}

const toDate = (ts: string) => new Date(ts.replace(" ", "T"))

/** "5 minutes ago" for the last week, then a short date. */
function relative(ts: string, lang: string) {
  const mins = Math.round((toDate(ts).getTime() - Date.now()) / 60000)
  const rtf = new Intl.RelativeTimeFormat(locale(lang), { numeric: "auto" })
  if (Math.abs(mins) < 60) return rtf.format(mins, "minute")
  if (Math.abs(mins) < 1440) return rtf.format(Math.round(mins / 60), "hour")
  if (Math.abs(mins) < 10080) return rtf.format(Math.round(mins / 1440), "day")
  return toDate(ts).toLocaleDateString(locale(lang), { month: "short", day: "numeric" })
}

/** Bell with an unread count. Desktop opens an anchored popover; phones open a bottom sheet. */
export function NotificationBell({ dark, className }: { dark?: boolean; className?: string }) {
  const unread = useDemo(st => unreadCount(st.s, st.s.persona))
  const mobile = useIsMobile()
  const openSheet = useUI(st => st.setNotificationsOpen)
  const [open, setOpen] = useState(false)
  const { at } = useT()
  const button = (
    <button
      type="button"
      onClick={mobile ? () => openSheet(true) : undefined}
      aria-label={unread ? `${at("notifications")}, ${at("ntUnread", { n: unread })}` : at("notifications")}
      className={cn(
        "relative grid size-11 shrink-0 place-items-center rounded-full transition-colors",
        dark ? "text-nav-muted hover:bg-nav-2 hover:text-nav-foreground data-[state=open]:bg-nav-2 data-[state=open]:text-nav-foreground" : "text-muted-foreground hover:bg-muted",
        className,
      )}
    >
      <Bell className="size-[21px]" aria-hidden />
      {unread > 0 && (
        <span aria-hidden className="absolute top-1.5 right-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-destructive px-1 text-[10px] leading-none font-semibold text-white tabular-nums ring-2 ring-background">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </button>
  )
  if (mobile) return button
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{button}</PopoverTrigger>
      <PopoverContent side="right" align="start" sideOffset={12} className="flex max-h-[min(640px,calc(100dvh-2rem))] w-[400px] flex-col gap-0 overflow-hidden rounded-2xl p-0">
        <h2 className="px-4 pt-4 pb-3 text-base font-semibold">{at("notifications")}</h2>
        <NotificationCenter onNavigate={() => setOpen(false)} className="min-h-0 flex-1 px-4 pb-4" />
      </PopoverContent>
    </Popover>
  )
}

/** Bottom sheet for phones; desktop uses the popover on the bell instead. */
export function NotificationsPanel() {
  const open = useUI(st => st.notificationsOpen)
  const setOpen = useUI(st => st.setNotificationsOpen)
  const mobile = useIsMobile()
  const { at } = useT()
  if (!mobile) return null
  return (
    <ResponsivePanel open={open} onOpenChange={setOpen} title={at("notifications")} className="pt-0">
      <NotificationCenter onNavigate={() => setOpen(false)} />
    </ResponsivePanel>
  )
}

/** Shows a toast, which screen readers announce, when a new unread notification arrives for the current person. */
export function useNotificationAnnouncer() {
  const persona = useDemo(st => st.s.persona)
  const inbox = useDemo(st => st.s.inbox)
  const go = useDemo(st => st.go)
  const mutate = useDemo(st => st.mutate)
  const { at } = useT()
  const message = useMessage()
  // Ids already on screen; only items that appear after that are announced.
  const seen = useRef<{ persona: string; ids: Set<string> } | null>(null)
  useEffect(() => {
    const mine = (inbox || []).filter(n => n.emp === persona)
    const prev = seen.current
    seen.current = { persona, ids: new Set(mine.map(n => n.id)) }
    if (!prev || prev.persona !== persona) return
    const fresh = mine.find(n => !n.read && !prev.ids.has(n.id))
    if (!fresh) return
    toast(message(fresh), {
      description: at("ntNew"),
      icon: <Bell className="size-4" />,
      action: { label: at("ntOpen"), onClick: () => { mutate(x => { const n = x.inbox?.find(y => y.id === fresh.id); if (n) n.read = true }); go(fresh.kind === "timeoff" ? "timeoff" : "projects") } },
    })
  }, [persona, inbox, at, message, go, mutate])
}

function NotificationCenter({ onNavigate, className }: { onNavigate: () => void; className?: string }) {
  const s = useDemo(st => st.s)
  const mutate = useDemo(st => st.mutate)
  const go = useDemo(st => st.go)
  const { lang, at } = useT()
  const message = useMessage()
  const emp = s.persona
  const items = inboxFor(s, emp)
  const unread = items.filter(n => !n.read).length
  const today = items.filter(n => n.at.startsWith(todayStr()))
  const earlier = items.filter(n => !n.at.startsWith(todayStr()))

  const setRead = (ids: string[], read: boolean) => mutate(x => { x.inbox?.forEach(n => { if (ids.includes(n.id)) n.read = read }) })
  const dismiss = (id: string) => mutate(x => { x.inbox = x.inbox?.filter(n => n.id !== id) })
  const openItem = (n: InboxItem) => {
    setRead([n.id], true)
    onNavigate()
    go(n.kind === "timeoff" ? "timeoff" : "projects")
  }
  const setPref = (kind: InboxItem["kind"], channel: keyof NotifyChannels, on: boolean) => mutate(x => {
    x.notifyPrefs ||= {}
    x.notifyPrefs[emp] ||= {}
    x.notifyPrefs[emp][kind] = { ...prefsFor(x, emp, kind), [channel]: on }
  })

  const row = (n: InboxItem) => {
    const Icon = n.kind === "timeoff" ? CalendarDays : FolderKanban
    return (
      <li key={n.id} className={cn("group relative flex items-start", !n.read && "bg-primary-soft/40")}>
        <button type="button" onClick={() => openItem(n)} className="flex min-w-0 flex-1 items-start gap-3 py-3 pr-2 pl-4 text-left transition-colors hover:bg-muted/60">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted"><Icon className="size-4" aria-hidden /></span>
          <span className="min-w-0 flex-1">
            <span className={cn("block text-sm", !n.read && "font-medium")}>{message(n)}</span>
            <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
              <time dateTime={n.at.replace(" ", "T")} title={toDate(n.at).toLocaleString(locale(lang))}>{relative(n.at, lang)}</time>
              {n.emailed && <span className="inline-flex items-center gap-1"><Mail className="size-3" aria-hidden />{at("ntEmailed")}</span>}
            </span>
          </span>
          {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label={at("ntUnread", { n: 1 })} />}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label={at("ntActions")} className="mt-2 mr-2 grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition-opacity hover:bg-muted focus-visible:opacity-100 data-[state=open]:opacity-100 lg:opacity-0 lg:group-hover:opacity-100">
              <Ellipsis className="size-4" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setRead([n.id], !n.read)}>{at(n.read ? "ntMarkUnread" : "ntMarkRead")}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => dismiss(n.id)}>{at("ntDismiss")}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </li>
    )
  }
  const group = (label: string, list: InboxItem[]) => list.length > 0 && (
    <section>
      <h3 className="px-1 pb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</h3>
      <ul className="divide-y overflow-hidden rounded-2xl border bg-card">{list.map(row)}</ul>
    </section>
  )

  return (
    <Tabs defaultValue="inbox" className={cn("gap-3", className)}>
      <TabsList className="h-10 w-full shrink-0">
        <TabsTrigger value="inbox">{at("ntInbox")}{unread > 0 && <span className="text-muted-foreground tabular-nums">{unread}</span>}</TabsTrigger>
        <TabsTrigger value="prefs">{at("ntPrefs")}</TabsTrigger>
      </TabsList>

      <TabsContent value="inbox" className="min-h-0 space-y-3 overflow-y-auto">
        {items.length ? (
          <>
            {unread > 0 && (
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => setRead(items.map(n => n.id), true)}>{at("ntMarkAllRead")}</Button>
              </div>
            )}
            {group(at("today"), today)}
            {group(at("ntEarlier"), earlier)}
          </>
        ) : <p className="rounded-2xl bg-muted px-4 py-8 text-center text-sm text-muted-foreground">{at("ntEmpty")}</p>}
      </TabsContent>

      <TabsContent value="prefs" className="min-h-0 space-y-4 overflow-y-auto">
        <p className="text-sm text-muted-foreground">{at("ntPrefsHelp")}</p>
        <div className="overflow-hidden rounded-2xl border bg-card">
          <div className="grid grid-cols-[minmax(0,1fr)_64px_64px] items-center gap-2 border-b bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground">
            <span /><span className="text-center">{at("ntInApp")}</span><span className="text-center">{at("ntEmail")}</span>
          </div>
          {NOTIFY_KINDS.map(kind => {
            const pref = prefsFor(s, emp, kind)
            const label = at(kind === "timeoff" ? "ntKindTimeoff" : "ntKindProject")
            return (
              <div key={kind} className="grid min-h-13 grid-cols-[minmax(0,1fr)_64px_64px] items-center gap-2 border-b px-4 py-2 last:border-b-0">
                <span className="text-sm font-medium">{label}</span>
                <span className="flex justify-center"><Switch checked={pref.app} onCheckedChange={v => setPref(kind, "app", v)} aria-label={`${label}: ${at("ntInApp")}`} /></span>
                <span className="flex justify-center"><Switch checked={pref.email} onCheckedChange={v => setPref(kind, "email", v)} aria-label={`${label}: ${at("ntEmail")}`} /></span>
              </div>
            )
          })}
        </div>

        <p className="flex items-center gap-2 text-xs text-muted-foreground"><Mail className="size-3.5" aria-hidden />{at("ntEmailTo", { email: emailFor(PERSONAS[emp as PersonaId].name) })}</p>
      </TabsContent>
    </Tabs>
  )
}
