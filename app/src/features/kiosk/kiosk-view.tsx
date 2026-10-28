import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import {
  ArrowLeft, Check, Clock3, Globe, HelpCircle, History, LogIn, LogOut, Menu, ScanLine, TriangleAlert, X,
} from "lucide-react"
import { Highlightable } from "@/components/app/common"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { LOGO_SRC } from "@/data/assets"
import { PERSONAS, PROJECTS } from "@/data/reference-data"
import { fmtClock, fmtDay, hm, locale, tsDate, tsTime } from "@/lib/dates"
import { liveState } from "@/lib/engine"
import { LANGUAGES, languageIn, translate, useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { useDemo } from "@/store/store"
import type { PunchType } from "@/store/types"

/** The kiosk is a fixed demo persona: Lukas, a warehouse employee with a badge. */
const EMP = "lukas"
const BADGE = PERSONAS.lukas.badge || ""
const AUTH_IDLE = 60
const RESULT_IDLE = 6
const TOP = { position: "top-center" as const }

type Panel = "home" | "auth" | "recent" | "done"
type Intent = "in" | "out" | "recent"
interface Result { ok: boolean; text: string }

const PUNCH_KEY: Record<PunchType, string> = { IN: "punchIn", OUT: "punchOut", BRK_S: "startBreak", BRK_E: "endBreak", XFER: "transfer" }

/** Ticks once a second; the clock and the idle countdown share it. */
function useNow() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])
  return now
}

function punchIn(lang: string): Result {
  const { s, addPunch } = useDemo.getState()
  if (liveState(s, EMP).st !== "out") return { ok: false, text: "You’re already clocked in. No new punch was added." }
  addPunch(EMP, "IN", { src: "Scanner" })
  return { ok: true, text: `${translate(lang, "punchedIn")} · ${fmtClock(hm(new Date()), lang)}` }
}

function punchOut(lang: string): Result {
  const { s, addPunch } = useDemo.getState()
  const L = liveState(s, EMP)
  if (L.st === "out") return { ok: false, text: "You’re already clocked out. No new punch was added." }
  if (L.st === "brk") addPunch(EMP, "BRK_E", { src: "Scanner" })
  addPunch(EMP, "OUT", { src: "Scanner" })
  return { ok: true, text: `${translate(lang, "punchedOut")} · ${fmtClock(hm(new Date()), lang)}` }
}

export default function KioskView() {
  const { lang, t } = useT()
  const now = useNow()
  const [panel, setPanel] = useState<Panel>("home")
  const [intent, setIntent] = useState<Intent | null>(null)
  const [idle, setIdle] = useState(AUTH_IDLE)
  const [result, setResult] = useState<Result | null>(null)
  const [showDemo, setShowDemo] = useState(false)
  const badgeRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef(panel)
  panelRef.current = panel

  const reset = useCallback(() => {
    setPanel("home"); setIntent(null); setResult(null); setShowDemo(false); setIdle(AUTH_IDLE)
  }, [])

  const focusBadge = () => window.setTimeout(() => badgeRef.current?.focus({ preventScroll: true }), 30)

  const select = (next: Intent) => {
    setIntent(next); setResult(null); setIdle(AUTH_IDLE); setShowDemo(true); setPanel("auth")
    focusBadge()
  }

  const showResult = (r: Result) => {
    setResult(r); setIdle(RESULT_IDLE); setPanel("done")
  }

  const scanBadge = (raw: string) => {
    const code = raw.trim()
    if (badgeRef.current) badgeRef.current.value = ""
    setIdle(AUTH_IDLE)
    if (!intent) return
    if (code !== BADGE) {
      showResult({ ok: false, text: `Badge ${code || "?"} not recognised. Try scanning again or ask your supervisor.` })
      return
    }
    if (intent === "recent") { setPanel("recent"); setIdle(AUTH_IDLE); return }
    showResult(intent === "in" ? punchIn(lang) : punchOut(lang))
  }

  const demoSuccess = () => {
    if (intent === "recent") { scanBadge(BADGE); return }
    const action = intent === "out" ? "punchOut" : "punchIn"
    reset()
    toast.success(`${t("verifiedBadge")} · ${t(action)} · ${t("previewOnly")}`, TOP)
  }

  const exit = () => { reset(); useDemo.getState().go("home") }

  /* Idle countdown: every screen except home returns home on its own. */
  useEffect(() => {
    if (panelRef.current === "home") return
    setIdle(v => Math.max(0, v - 1))
  }, [now])
  useEffect(() => {
    if (panel === "home" || idle > 0) return
    const wasResult = panel === "done"
    reset()
    if (!wasResult) toast("Session timed out. The kiosk is ready for the next person.", TOP)
  }, [idle, panel, reset])

  /* Any touch or key press on the scan screen restarts its timeout. */
  useEffect(() => {
    if (panel !== "auth") return
    const bump = () => setIdle(AUTH_IDLE)
    document.addEventListener("pointerdown", bump, true)
    document.addEventListener("keydown", bump, true)
    return () => {
      document.removeEventListener("pointerdown", bump, true)
      document.removeEventListener("keydown", bump, true)
    }
  }, [panel])

  /* Escape leaves a sub-screen, like the back button. */
  useEffect(() => {
    if (panel === "home") return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !e.defaultPrevented) reset() }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [panel, reset])

  const intentLabel = intent === "in" ? t("punchIn") : intent === "out" ? t("punchOut") : t("recent")

  return (
    <div
      className={cn(
        "flex min-h-dvh flex-col bg-nav text-nav-foreground",
        "pt-[max(1rem,env(safe-area-inset-top))] pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))]",
        "md:pt-[max(1.5rem,env(safe-area-inset-top))] md:pr-[max(2rem,env(safe-area-inset-right))] md:pl-[max(2rem,env(safe-area-inset-left))]",
      )}
    >
      {panel === "home" || panel === "done"
        ? <BrandHeader onExit={exit} />
        : (
          <SubHeader
            title={panel === "auth" ? t("scanBadge") : t("recentPunchesTitle")}
            backLabel={t("backClock")}
            onBack={reset}
            idle={idle}
            timerLabel={panel === "auth" ? t("scanTimeout") : t("returnClock")}
          />
        )}

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col">
        {panel === "home" && <HomePanel now={now} lang={lang} onSelect={select} />}
        {panel === "auth" && (
          <AuthPanel
            intentLabel={intentLabel}
            showDemo={showDemo}
            onToggleDemo={() => { setShowDemo(v => !v); focusBadge() }}
            onCancel={reset}
            onSuccess={demoSuccess}
            onFailure={() => scanBadge("99-0000")}
            badgeRef={badgeRef}
            onScan={scanBadge}
          />
        )}
        {panel === "recent" && <RecentPanel lang={lang} />}
        {panel === "done" && result && <DonePanel result={result} idle={idle} onDone={() => { reset(); toast("Kiosk ready for the next person.", TOP) }} />}
      </main>
    </div>
  )
}

/* ---------- Header ---------- */

function BrandHeader({ onExit }: { onExit: () => void }) {
  const { t } = useT()
  return (
    <header className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <span className="flex h-12 items-center rounded-xl bg-card px-2.5">
          <img src={LOGO_SRC} alt="Spiro" width={94} height={48} className="h-8 w-auto" />
        </span>
        <span className="text-xl font-semibold tracking-tight">TimeClock</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onExit}
          className="hidden h-[72px] items-center rounded-2xl border border-nav-foreground/25 px-5 text-base font-medium transition-colors hover:bg-nav-2 md:inline-flex"
        >
          {t("exitPreview")}
        </button>
        <KioskMenu onExit={onExit} />
      </div>
    </header>
  )
}

function KioskMenu({ onExit }: { onExit: () => void }) {
  const { lang, t } = useT()
  const setLang = useDemo(st => st.setLang)
  const [open, setOpen] = useState(false)
  const [help, setHelp] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={open ? t("closeMenu") : t("openMenu")}
          className="inline-flex size-[72px] items-center justify-center rounded-2xl border border-nav-foreground/25 transition-colors hover:bg-nav-2 aria-expanded:bg-nav-2"
        >
          {open ? <X className="size-6" aria-hidden /> : <Menu className="size-6" aria-hidden />}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-[min(22rem,calc(100vw-2rem))] gap-4 rounded-2xl p-4 shadow-raised">
        <h2 className="text-lg font-semibold">{t("menu")}</h2>
        <fieldset className="space-y-2">
          <legend className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Globe className="size-4" aria-hidden /> {t("language")}
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {LANGUAGES.map(l => (
              <button
                key={l.code}
                type="button"
                aria-pressed={lang === l.code}
                onClick={() => setLang(l.code)}
                className="min-h-12 rounded-xl border px-3 text-left text-base font-medium transition-colors hover:bg-muted aria-pressed:border-primary aria-pressed:bg-primary-soft aria-pressed:text-primary"
              >
                <span lang={l.code} className="block">{l.name}</span>
                {languageIn(l.code, lang) && <span className="block text-xs font-normal text-muted-foreground">{languageIn(l.code, lang)}</span>}
              </button>
            ))}
          </div>
        </fieldset>
        <div>
          <button
            type="button"
            aria-expanded={help}
            onClick={() => setHelp(v => !v)}
            className="flex min-h-12 w-full items-center gap-2 rounded-xl px-3 text-base font-medium transition-colors hover:bg-muted"
          >
            <HelpCircle className="size-5" aria-hidden /> {t("help")}
          </button>
          {help && <p className="px-3 pt-1 text-sm text-muted-foreground">{t("kioskHelp")}</p>}
        </div>
        <button
          type="button"
          onClick={() => { setOpen(false); onExit() }}
          className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/85"
        >
          <LogOut className="size-5" aria-hidden /> {t("exitPreview")}
        </button>
      </PopoverContent>
    </Popover>
  )
}

function SubHeader({ title, backLabel, onBack, idle, timerLabel }: {
  title: string; backLabel: string; onBack: () => void; idle: number; timerLabel: string
}) {
  return (
    <header className="mx-auto flex w-full max-w-5xl items-center gap-3">
      <button
        type="button"
        onClick={onBack}
        aria-label={backLabel}
        className="inline-flex size-[72px] shrink-0 items-center justify-center rounded-2xl bg-nav-2 transition-colors hover:bg-nav-foreground/15"
      >
        <ArrowLeft className="size-8" aria-hidden />
      </button>
      <h1 className="min-w-0 flex-1 text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
      <span
        role="timer"
        aria-label={`${timerLabel}: ${idle} seconds`}
        className="inline-flex h-[72px] min-w-[72px] items-baseline justify-center gap-0.5 rounded-2xl border border-nav-foreground/25 px-3 pt-5 tabular-nums"
      >
        <b className="text-2xl font-semibold">{idle}</b><span className="text-sm text-nav-muted">s</span>
      </span>
    </header>
  )
}

/* ---------- Panels ---------- */

function HomePanel({ now, lang, onSelect }: { now: Date; lang: string; onSelect: (i: Intent) => void }) {
  const { t } = useT()
  const loc = locale(lang)
  const fmt = new Intl.DateTimeFormat(loc, { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  const parts = fmt.formatToParts(now)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === type)?.value || ""
  const date = now.toLocaleDateString(loc, { weekday: "long", day: "numeric", month: "long" })
  const actions: { intent: Intent; label: string; icon: typeof LogIn; tone: string }[] = [
    { intent: "in", label: t("punchIn"), icon: LogIn, tone: "bg-citron text-nav hover:bg-citron/90" },
    { intent: "out", label: t("punchOut"), icon: LogOut, tone: "bg-card text-card-foreground hover:bg-card/90" },
    { intent: "recent", label: t("recent"), icon: History, tone: "border-2 border-nav-foreground/30 bg-nav-2 hover:bg-nav-foreground/10" },
  ]
  return (
    <div className="flex flex-1 flex-col justify-center gap-8 py-8 md:gap-12">
      <div role="group" aria-label="Current date and time" className="text-center">
        <time dateTime={now.toISOString().slice(0, 10)} className="block text-lg text-nav-muted capitalize md:text-2xl">{date}</time>
        <time dateTime={now.toISOString()} aria-label={fmt.format(now)} className="mt-1 flex items-baseline justify-center gap-2 font-semibold tabular-nums">
          <span className="text-[clamp(4.5rem,20vw,10rem)] leading-none tracking-tight">{part("hour")}:{part("minute")}</span>
          <span className="flex flex-col items-start text-[clamp(1.5rem,5vw,2.75rem)] leading-none text-nav-muted">
            <span>{part("second")}</span>
            {part("dayPeriod") && <span className="text-[0.6em] uppercase">{part("dayPeriod")}</span>}
          </span>
        </time>
      </div>

      <section aria-labelledby="kiosk-title" className="space-y-4">
        <h2 id="kiosk-title" className="text-center text-2xl font-semibold tracking-tight md:text-3xl">{t("kioskChoose")}</h2>
        <Highlightable hl="kiosk-badge" className="grid gap-3 md:grid-cols-3 md:gap-4">
          {actions.map(a => (
            <button
              key={a.intent}
              type="button"
              onClick={() => onSelect(a.intent)}
              className={cn(
                "flex min-h-24 items-center gap-4 rounded-2xl px-6 text-left text-2xl font-semibold shadow-soft transition-[background-color,transform] active:scale-[.98] md:min-h-44 md:flex-col md:items-start md:justify-between md:p-6 md:text-3xl",
                "focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-citron",
                a.tone,
              )}
            >
              <a.icon className="size-9 shrink-0 md:size-11" aria-hidden />
              <span>{a.label}</span>
            </button>
          ))}
        </Highlightable>
      </section>
    </div>
  )
}

function AuthPanel({ intentLabel, showDemo, onToggleDemo, onCancel, onSuccess, onFailure, badgeRef, onScan }: {
  intentLabel: string
  showDemo: boolean
  onToggleDemo: () => void
  onCancel: () => void
  onSuccess: () => void
  onFailure: () => void
  badgeRef: React.RefObject<HTMLInputElement | null>
  onScan: (code: string) => void
}) {
  const { t } = useT()
  useEffect(() => { badgeRef.current?.focus({ preventScroll: true }) }, [badgeRef])
  return (
    <div
      className="flex flex-1 flex-col items-center justify-center gap-6 py-8 text-center"
      onClick={e => { if (e.target === e.currentTarget) badgeRef.current?.focus({ preventScroll: true }) }}
    >
      <span className="inline-flex min-h-10 items-center rounded-full bg-nav-2 px-4 text-base font-medium">{intentLabel}</span>
      <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">{t("readyToScan")}</h2>
      <div aria-hidden className="relative flex size-44 items-center justify-center rounded-full border-4 border-citron/70 md:size-56">
        <span className="absolute inset-3 rounded-full border-2 border-dashed border-nav-foreground/25 motion-safe:animate-[spin_12s_linear_infinite]" />
        <ScanLine className="size-16 text-citron md:size-20" />
      </div>
      <p className="max-w-md text-lg text-nav-muted md:text-xl">{t("scanInstruction")}</p>
      <label className="sr-only" htmlFor="kiosk-badge-input">{t("badgeId")}</label>
      <input
        id="kiosk-badge-input"
        ref={badgeRef}
        className="sr-only"
        autoComplete="off"
        inputMode="none"
        tabIndex={-1}
        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); onScan(e.currentTarget.value) } }}
      />
      <button
        type="button"
        onClick={onCancel}
        className="inline-flex min-h-[72px] w-full max-w-sm items-center justify-center rounded-2xl border-2 border-nav-foreground/35 px-8 text-xl font-semibold transition-colors hover:bg-nav-2"
      >
        {t("cancel")}
      </button>
      <div className="flex w-full max-w-md flex-col items-center gap-3 pt-2">
        {showDemo && (
          <div className="grid w-full gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={onSuccess}
              className="inline-flex min-h-16 items-center justify-center gap-2 rounded-2xl bg-success-soft px-4 text-base font-semibold text-success"
            >
              <Check className="size-5" aria-hidden /> {t("previewSuccess")}
            </button>
            <button
              type="button"
              onClick={onFailure}
              className="inline-flex min-h-16 items-center justify-center gap-2 rounded-2xl bg-destructive-soft px-4 text-base font-semibold text-destructive"
            >
              <TriangleAlert className="size-5" aria-hidden /> {t("previewFailure")}
            </button>
          </div>
        )}
        <button
          type="button"
          aria-expanded={showDemo}
          onClick={onToggleDemo}
          className="min-h-12 rounded-xl px-4 text-sm font-medium text-nav-muted underline-offset-4 hover:text-nav-foreground hover:underline"
        >
          {showDemo ? t("hideDemoButtons") : t("showDemoButtons")}
        </button>
      </div>
    </div>
  )
}

function RecentPanel({ lang }: { lang: string }) {
  const { t } = useT()
  const punches = useDemo(st => st.s.punches[EMP])
  const recent = [...(punches || [])].sort((a, b) => b.t.localeCompare(a.t)).slice(0, 6)
  if (!recent.length) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-12 text-center text-xl text-nav-muted">
        <History className="size-12" aria-hidden />
        <p>{t("emptyPunches")}</p>
      </div>
    )
  }
  return (
    <ol aria-label={t("recent")} className="mt-6 space-y-3">
      {recent.map(p => {
        const out = p.type === "OUT" || p.type === "BRK_S"
        return (
          <li key={p.id} className="flex items-center gap-4 rounded-2xl bg-nav-2 px-5 py-4">
            <span aria-hidden className={cn("size-3 shrink-0 rounded-full", out ? "bg-nav-muted" : "bg-citron")} />
            <time dateTime={p.t.replace(" ", "T")} className="w-24 shrink-0 text-2xl font-semibold tabular-nums md:w-28 md:text-3xl">
              {fmtClock(tsTime(p.t), lang)}
            </time>
            <div className="min-w-0 flex-1">
              <b className="block text-lg font-semibold md:text-xl">{t(PUNCH_KEY[p.type])}</b>
              {p.proj && (p.type === "IN" || p.type === "XFER") && (
                <span className="block truncate text-base text-nav-muted">{p.proj} · {PROJECTS[p.proj]?.name || ""}</span>
              )}
            </div>
            <small className="shrink-0 text-base text-nav-muted">{fmtDay(tsDate(p.t), lang)}</small>
          </li>
        )
      })}
    </ol>
  )
}

function DonePanel({ result, idle, onDone }: { result: Result; idle: number; onDone: () => void }) {
  const doneRef = useRef<HTMLButtonElement>(null)
  useEffect(() => { doneRef.current?.focus({ preventScroll: true }) }, [])
  return (
    <section aria-labelledby="kiosk-result" className="flex flex-1 flex-col items-center justify-center gap-6 py-10 text-center">
      <span
        aria-hidden
        className={cn("flex size-28 items-center justify-center rounded-full md:size-36", result.ok ? "bg-citron text-nav" : "bg-destructive-soft text-destructive")}
      >
        {result.ok ? <Check className="size-14 md:size-20" strokeWidth={2.5} /> : <TriangleAlert className="size-14 md:size-16" />}
      </span>
      <h2 id="kiosk-result" className="text-4xl font-semibold tracking-tight md:text-5xl">
        {result.ok ? "You’re all set" : "Punch not changed"}
      </h2>
      <p role="status" className="max-w-xl text-xl md:text-2xl">{result.text}</p>
      <p className="flex items-center gap-2 text-lg text-nav-muted">
        <Clock3 className="size-5" aria-hidden />
        Returning to the timeclock home screen in <b className="tabular-nums text-nav-foreground">{idle}</b> seconds.
      </p>
      <button
        ref={doneRef}
        type="button"
        onClick={onDone}
        className="inline-flex min-h-[72px] w-full max-w-sm items-center justify-center rounded-2xl bg-card px-8 text-xl font-semibold text-card-foreground transition-colors hover:bg-card/90"
      >
        Return now
      </button>
    </section>
  )
}
