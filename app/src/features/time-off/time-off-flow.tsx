import { useState, type ReactNode } from "react"
import { ArrowRight, CalendarDays, Check, ChevronDown, ChevronLeft, Loader2 } from "lucide-react"
import { JourneyTags } from "@/components/app/common"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { TO_DURATION, TO_SAMPLE } from "@/data/time-off"
import { locale, todayStr } from "@/lib/dates"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { useDemo } from "@/store/store"
import { backToList, editDraft, reviewDraft, selectRequest, setDraftField, submitDraft } from "./time-off-actions"
import { TimeOffCalendar } from "./time-off-calendar"
import { eligibleTypes, fmtDate, fmtWhen, toType, useTimeOffUI, validDate, type TimeOffDraft } from "./time-off-model"
import { DraftSummary, Fact, Facts, StatusBadge, Steps } from "./time-off-parts"

/** Bottom action bar: sticky above the mobile tab bar, inline on desktop. */
function StickyActions({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "sticky bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-10 -mx-4 flex gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6",
        "lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none",
        className,
      )}
    >
      {children}
    </div>
  )
}

function FlowHeader({ title, intro, back, step, tags }: { title: string; intro: string; back: { label: string; onClick: () => void; disabled?: boolean }; step: 0 | 1 | 2; tags?: string }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" className="-ml-3 h-10" onClick={back.onClick} disabled={back.disabled}>
          <ChevronLeft /> {back.label}
        </Button>
        <Steps current={step} />
      </div>
      <header className="space-y-1">
        <h1 id="to-screen-title" tabIndex={-1} className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight outline-none md:text-[28px]">
          {title}
          {tags && <JourneyTags ids={tags} />}
        </h1>
        <p className="max-w-[68ch] text-[15px] text-muted-foreground">{intro}</p>
      </header>
    </div>
  )
}

function Field({ id, label, error, hint, children, className }: { id: string; label: ReactNode; error?: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  const { tt } = useT()
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-medium">{label}</label>
      {children}
      {hint && <p id={`${id}-preview`} className="text-sm text-muted-foreground">{hint}</p>}
      <p id={`${id}-error`} className="text-sm font-medium text-destructive" aria-live="polite">{error ? tt(error) : ""}</p>
    </div>
  )
}

export function RequestForm({ draft }: { draft: TimeOffDraft }) {
  const { tt, lang } = useT()
  const persona = useDemo(st => st.s.persona)
  const errors = useTimeOffUI(st => st.ui.errors)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const type = toType(draft.type) || TO_SAMPLE.types[0]
  const single = draft.duration !== "Full Day"
  const min = type.allowPast ? undefined : todayStr()
  const dateHelp = single ? (type.allowPast ? "sickSingleHelp" : "singleDateHelp") : (type.allowPast ? "sickHelp" : "dateHelp")
  const preview = (v: string) => validDate(v) ? tt("selectedDate", { date: fmtDate(v, lang, true) }) : ""
  const inputCls = "h-12 text-base"
  const dateField = (key: "start" | "end", label: string) => (
    <Field id={`to-${key}`} label={label} error={errors[key]} hint={preview(draft[key])}>
      <Input
        id={`to-${key}`}
        type="date"
        className={inputCls}
        value={draft[key]}
        min={min}
        required
        aria-invalid={errors[key] ? true : undefined}
        aria-describedby={`to-${key}-error to-${key}-preview to-date-help`}
        onChange={e => setDraftField(key, e.target.value)}
      />
    </Field>
  )

  return (
    <div className="space-y-6">
      <FlowHeader title={tt("new")} intro={tt("requestIntro")} back={{ label: tt("back"), onClick: backToList }} step={0} tags="TO-02" />
      <form
        id="to-request-form"
        noValidate
        onSubmit={e => { e.preventDefault(); reviewDraft() }}
        className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start"
      >
        <section className="space-y-6 rounded-2xl border bg-card p-4 shadow-soft sm:p-6">
          <Field id="to-type" label={tt("type")} error={errors.type}>
            <Select value={draft.type} onValueChange={v => setDraftField("type", v)}>
              <SelectTrigger id="to-type" className="!h-12 w-full text-base" aria-invalid={errors.type ? true : undefined} aria-describedby="to-type-error">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {eligibleTypes(persona).map(x => <SelectItem key={x.id} value={x.id}>{tt(x.label)}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>

          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">{tt("duration")}</legend>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              {type.durations.map(duration => {
                const on = duration === draft.duration
                return (
                  <label
                    key={duration}
                    className={cn(
                      "relative flex min-h-12 cursor-pointer items-center justify-center rounded-xl border px-4 text-center text-[15px] font-medium transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                      on ? "border-primary bg-primary-soft text-primary" : "bg-card hover:bg-muted",
                    )}
                  >
                    <input
                      type="radio"
                      name="to-duration"
                      value={duration}
                      checked={on}
                      onChange={() => setDraftField("duration", duration)}
                      className="sr-only"
                    />
                    {tt(TO_DURATION[duration])}
                  </label>
                )
              })}
            </div>
          </fieldset>

          <div className="space-y-2">
            <div className={cn("grid gap-4", !single && "sm:grid-cols-2")}>
              {dateField("start", tt(single ? "date" : "start"))}
              {!single && dateField("end", tt("end"))}
            </div>
            <p id="to-date-help" className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {tt(dateHelp)} <JourneyTags ids="TO-03" />
            </p>
          </div>

          {draft.duration === "Hours" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="to-startTime" label={tt("startTime")} error={errors.startTime}>
                <Input id="to-startTime" type="time" required className={inputCls} value={draft.startTime}
                  aria-invalid={errors.startTime ? true : undefined} aria-describedby="to-startTime-error"
                  onChange={e => setDraftField("startTime", e.target.value)} />
              </Field>
              <Field id="to-hours" label={tt("requestedHours")} error={errors.hours}>
                <Input id="to-hours" type="number" required min="0.01" step="any" inputMode="decimal" className={inputCls} value={draft.hours}
                  aria-invalid={errors.hours ? true : undefined} aria-describedby="to-hours-error"
                  onChange={e => setDraftField("hours", e.target.value)} />
              </Field>
            </div>
          )}

          <div className="rounded-xl border bg-background">
            <button
              type="button"
              aria-expanded={calendarOpen}
              aria-controls="to-calendar"
              onClick={() => setCalendarOpen(o => !o)}
              className="flex min-h-12 w-full items-center gap-2 rounded-xl px-4 text-left text-[15px] font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <CalendarDays className="size-[18px] text-primary" aria-hidden />
              <span className="flex-1">{tt("calendar")}</span>
              <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", calendarOpen && "rotate-180")} aria-hidden />
            </button>
            {calendarOpen && (
              <div id="to-calendar" className="border-t px-3 py-4 sm:px-4">
                <TimeOffCalendar draft={draft} />
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="to-note" className="block text-sm font-medium">
              {tt("note")} <span className="font-normal text-muted-foreground">({tt("optional")})</span>
            </label>
            <Textarea id="to-note" rows={3} className="text-base" value={draft.note} aria-describedby="to-note-help"
              onChange={e => setDraftField("note", e.target.value)} />
            <p id="to-note-help" className="text-sm text-muted-foreground">{tt("noteHelp")}</p>
          </div>
        </section>

        <aside className="space-y-4 lg:sticky lg:top-6">
          <div className="rounded-2xl border bg-card p-4 shadow-soft sm:p-5" aria-live="polite">
            <DraftSummary r={draft} />
          </div>
          <div className="hidden flex-col gap-2 lg:flex">
            <Button type="submit" size="lg">{tt("reviewAction")} <ArrowRight /></Button>
            <Button type="button" variant="ghost" size="lg" onClick={backToList}>{tt("discard")}</Button>
          </div>
        </aside>

        <StickyActions className="lg:hidden">
          <Button type="button" variant="outline" size="lg" className="flex-1" onClick={backToList}>{tt("discard")}</Button>
          <Button type="submit" size="lg" className="flex-[1.4]">{tt("reviewAction")} <ArrowRight /></Button>
        </StickyActions>
      </form>
    </div>
  )
}

export function ReviewStep({ draft }: { draft: TimeOffDraft }) {
  const { tt, lang } = useT()
  const persona = useDemo(st => st.s.persona)
  const busy = useTimeOffUI(st => st.ui.busy)
  const balance = useTimeOffUI(st => st.ui.balance)
  const manager = TO_SAMPLE.managers[TO_SAMPLE.employees[persona]?.manager] || ""
  return (
    <div className="space-y-6">
      <FlowHeader title={tt("reviewTitle")} intro={tt("reviewIntro")} back={{ label: tt("change"), onClick: editDraft, disabled: busy }} step={1} />
      <section aria-busy={busy} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="space-y-4 rounded-2xl border bg-card p-4 shadow-soft sm:p-6">
          <DraftSummary r={draft} />
          <Facts>
            <Fact label={tt("manager")}>{manager}</Fact>
            <Fact label={tt("note")}>
              <span className={cn("whitespace-pre-wrap", !draft.note && "font-normal text-muted-foreground")}>{draft.note || tt("noNote")}</span>
            </Fact>
          </Facts>
        </div>
        <aside className="space-y-4">
          <div className="rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold">{tt("balance")} <JourneyTags ids="TO-01" /></h2>
            {balance ? (
              <>
                <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">
                  {balance.amount.toLocaleString(locale(lang))} <span className="text-base font-medium text-muted-foreground">{tt(balance.unit)}</span>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{tt("asOf", { time: fmtWhen(balance.at, lang) })}</p>
              </>
            ) : (
              <div className="mt-2 rounded-xl bg-warning-soft p-3 text-warning">
                <p className="font-semibold">{tt("balanceUnavailable")}</p>
                <p className="text-sm">{tt("balanceHelp")}</p>
              </div>
            )}
          </div>
          {/* Desktop: actions sit under the balance, matching the request step. */}
          <div className="hidden flex-col gap-2 lg:flex">
            <Button size="lg" onClick={() => void submitDraft()} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Check />}
              {tt(busy ? "submitting" : "submit")}
            </Button>
            <Button variant="ghost" size="lg" onClick={editDraft} disabled={busy}>{tt("change")}</Button>
          </div>
        </aside>
        <StickyActions className="lg:hidden">
          <Button variant="outline" size="lg" className="flex-1" onClick={editDraft} disabled={busy}>{tt("change")}</Button>
          <Button size="lg" className="flex-[1.4]" onClick={() => void submitDraft()} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Check />}
            {tt(busy ? "submitting" : "submit")}
          </Button>
        </StickyActions>
      </section>
    </div>
  )
}

export function Confirmation({ id }: { id: string }) {
  const { tt } = useT()
  const persona = useDemo(st => st.s.persona)
  const r = useDemo(st => st.s.timeOff.requests.find(x => x.id === id && x.emp === persona))
  if (!r) return null
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex justify-center"><Steps current={2} /></div>
      <header className="space-y-3 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-success-soft text-success">
          <Check className="size-7" strokeWidth={2.4} aria-hidden />
        </span>
        <h1 id="to-screen-title" tabIndex={-1} className="text-2xl font-semibold tracking-tight outline-none md:text-[28px]">{tt("submittedTitle")}</h1>
        <p className="text-[15px] text-muted-foreground">{tt("submittedIntro")}</p>
      </header>
      <section className="space-y-4 rounded-2xl border bg-card p-4 shadow-soft sm:p-6">
        <header className="flex items-center justify-between gap-3">
          <b className="font-mono text-sm">{r.id}</b>
          <StatusBadge status={r.status} />
        </header>
        <DraftSummary r={r} heading={false} />
      </section>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" size="lg" onClick={backToList}>{tt("back")}</Button>
        <Button size="lg" onClick={() => selectRequest(r.id)}>{tt("viewRequest")} <ArrowRight /></Button>
      </div>
    </div>
  )
}
