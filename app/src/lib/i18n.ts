import { useCallback } from "react"
import { APP_COPY } from "@/data/app-copy"
import { HOME_COPY, I18N } from "@/data/i18n"
import { TO_COPY, TO_LANGS } from "@/data/time-off-i18n"
import { useDemo } from "@/store/store"

export const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "fr", name: "Français" },
  { code: "de", name: "Deutsch" },
  { code: "nl", name: "Nederlands" },
  { code: "pl", name: "Polski" },
]

/** A language's name in the interface language ("German" while in English), or "" when it is that language.
    Uses the browser's own translations, so no extra copy to maintain. */
export function languageIn(code: string, uiLang: string) {
  if (code === uiLang) return ""
  try {
    const name = new Intl.DisplayNames([uiLang], { type: "language" }).of(code) || ""
    return name.charAt(0).toLocaleUpperCase(uiLang) + name.slice(1)
  } catch {
    return ""
  }
}

const fill = (value: string, vars: Record<string, string | number> = {}) =>
  value.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""))

/** Core prototype strings, with the Time Off title folded in as the original did. */
export function translate(lang: string, key: string) {
  if (key === "timeoff") return TO_COPY.title[TO_LANGS.indexOf(lang)] || TO_COPY.title[0]
  return I18N[lang]?.[key] || I18N.en[key] || key
}
export const homeText = (lang: string, key: string) => HOME_COPY[lang]?.[key] || HOME_COPY.en[key] || key
export function toText(lang: string, key: string, vars?: Record<string, string | number>) {
  const row = TO_COPY[key] || [key]
  return fill(row[TO_LANGS.indexOf(lang)] || row[0], vars)
}
export function appText(lang: string, key: string, vars?: Record<string, string | number>) {
  const row = APP_COPY[key]
  if (!row) return key
  return fill(row[TO_LANGS.indexOf(lang)] || row[0], vars)
}

/** Translators bound to the current demo language. */
export function useT() {
  const lang = useDemo(st => st.s.lang)
  return {
    lang,
    t: useCallback((key: string) => translate(lang, key), [lang]),
    ht: useCallback((key: string) => homeText(lang, key), [lang]),
    tt: useCallback((key: string, vars?: Record<string, string | number>) => toText(lang, key, vars), [lang]),
    at: useCallback((key: string, vars?: Record<string, string | number>) => appText(lang, key, vars), [lang]),
  }
}
