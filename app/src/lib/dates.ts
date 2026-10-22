import { LOCALE } from "@/data/i18n"

export const pad = (n: number) => String(n).padStart(2, "0")
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const hm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`
export const addDays = (d: Date, n: number) => {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}
export const parseYmd = (s: string) => {
  const [y, m, d] = s.split("-").map(Number)
  return new Date(y, m - 1, d)
}
export const mins = (s: string) => {
  const [h, m] = s.split(":").map(Number)
  return h * 60 + m
}
export const fromMins = (total: number) => `${pad(Math.floor(total / 60))}:${pad(total % 60)}`
export const tsDate = (ts: string) => ts.slice(0, 10)
export const tsTime = (ts: string) => ts.slice(11, 16)

/** Monday of the week `offset` weeks from the current one. */
export function weekStart(offset = 0) {
  const t = new Date()
  t.setHours(0, 0, 0, 0)
  const dow = (t.getDay() + 6) % 7
  return addDays(t, -dow + offset * 7)
}
export const todayStr = () => ymd(new Date())
export const nowTs = () => `${todayStr()} ${hm(new Date())}`
export const periodKey = (off: number) => ymd(weekStart(off))
export const periodDays = (off: number) => {
  const s = weekStart(off)
  return [...Array(7)].map((_, i) => ymd(addDays(s, i)))
}

export const locale = (lang: string) => LOCALE[lang] || "en-US"
export const fmtDay = (s: string, lang: string) =>
  parseYmd(s).toLocaleDateString(locale(lang), { weekday: "short", month: "short", day: "numeric" })
export const fmtDayShort = (s: string, lang: string) =>
  parseYmd(s).toLocaleDateString(locale(lang), { weekday: "short", day: "numeric" })
export const fmtWeekday = (s: string, lang: string) =>
  parseYmd(s).toLocaleDateString(locale(lang), { weekday: "short" })
export const fmtRange = (off: number, lang: string) => {
  const d = periodDays(off)
  const l = locale(lang)
  return `${parseYmd(d[0]).toLocaleDateString(l, { month: "short", day: "numeric" })} – ${parseYmd(d[6]).toLocaleDateString(l, { month: "short", day: "numeric", year: "numeric" })}`
}
export const fmtH = (h: number, lang: string) =>
  (Math.round(h * 100) / 100).toLocaleString(locale(lang), { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const fmtClock = (t: string, lang: string) => {
  const [h, m] = t.split(":").map(Number)
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d.toLocaleTimeString(locale(lang), { hour: "2-digit", minute: "2-digit" })
}
