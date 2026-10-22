/* Progressive enhancement: the demo also runs in browsers without PWA support. */
import { useEffect, useState } from "react"
import { useDemo } from "@/store/store"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

const COPY: Record<string, { install: string; installing: string; home: string; help: string; browserHelp: string; failed: string }> = {
  en: { install: "Install demo", installing: "Opening installer…", home: "Add to Home Screen", help: "In your browser, open Share, choose Add to Home Screen, then tap Add. If available, keep Open as Web App enabled.", browserHelp: "Open your browser menu and choose Install app or Add to Home Screen, if available.", failed: "Installation could not open. Try installing from your browser menu." },
  fr: { install: "Installer la démo", installing: "Ouverture de l’installation…", home: "Sur l’écran d’accueil", help: "Dans votre navigateur, ouvrez Partager, choisissez Sur l’écran d’accueil, puis Ajouter. Si disponible, activez Ouvrir comme app web.", browserHelp: "Ouvrez le menu du navigateur et choisissez Installer l’application ou Sur l’écran d’accueil, si disponible.", failed: "Impossible d’ouvrir l’installation. Essayez depuis le menu du navigateur." },
  de: { install: "Demo installieren", installing: "Installation wird geöffnet…", home: "Zum Home-Bildschirm", help: "Öffnen Sie im Browser Teilen, wählen Sie Zum Home-Bildschirm und dann Hinzufügen. Falls verfügbar, aktivieren Sie Als Web-App öffnen.", browserHelp: "Öffnen Sie das Browsermenü und wählen Sie App installieren oder Zum Home-Bildschirm, falls verfügbar.", failed: "Die Installation konnte nicht geöffnet werden. Versuchen Sie es über das Browsermenü." },
  nl: { install: "Demo installeren", installing: "Installatie openen…", home: "Zet op beginscherm", help: "Open in uw browser Deel, kies Zet op beginscherm en tik op Voeg toe. Schakel indien beschikbaar Open als webapp in.", browserHelp: "Open het browsermenu en kies App installeren of Zet op beginscherm, indien beschikbaar.", failed: "De installatie kon niet worden geopend. Probeer het via het browsermenu." },
  pl: { install: "Zainstaluj demo", installing: "Otwieranie instalacji…", home: "Dodaj do ekranu początkowego", help: "W przeglądarce otwórz Udostępnij, wybierz Dodaj do ekranu początkowego i stuknij Dodaj. Jeśli dostępne, włącz Otwórz jako aplikację internetową.", browserHelp: "Otwórz menu przeglądarki i wybierz Zainstaluj aplikację lub Dodaj do ekranu początkowego, jeśli dostępne.", failed: "Nie udało się otworzyć instalacji. Spróbuj z menu przeglądarki." },
}

let deferred: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()
const notify = () => listeners.forEach(l => l())
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferred = e as BeforeInstallPromptEvent; notify() })
  window.addEventListener("appinstalled", () => { deferred = null; notify() })
}

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
export const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

/** Install state for the demo: a native prompt where the browser offers one, otherwise instructions. */
export function useInstall() {
  const lang = useDemo(st => st.s.lang)
  const [, force] = useState(0)
  const [installing, setInstalling] = useState(false)
  useEffect(() => {
    const l = () => force(n => n + 1)
    listeners.add(l)
    return () => { listeners.delete(l) }
  }, [])
  const copy = COPY[lang] || COPY.en
  const supported = window.isSecureContext
  const installed = isStandalone()
  return {
    available: supported && !installed,
    canPrompt: !!deferred && !installed,
    installing,
    label: installing ? copy.installing : isIOS() && !deferred ? copy.home : copy.install,
    help: isIOS() ? copy.help : copy.browserHelp,
    failed: copy.failed,
    async prompt() {
      if (!deferred || installing) return false
      const p = deferred
      setInstalling(true)
      try {
        await p.prompt()
        await p.userChoice
        return true
      } finally {
        deferred = null
        setInstalling(false)
        notify()
      }
    },
  }
}
