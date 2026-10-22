import { create } from "zustand"

/** Session-only UI state shared across screens (never persisted). */
interface UIStore {
  settingsOpen: boolean
  profileOpen: boolean
  notificationsOpen: boolean
  /** Journey to expand and scroll to when the register opens. */
  journeyFocus: string | null
  /** data-hl key to highlight after navigating from a journey. */
  highlight: string | null
  setSettingsOpen: (open: boolean) => void
  setProfileOpen: (open: boolean) => void
  setNotificationsOpen: (open: boolean) => void
  focusJourney: (id: string | null) => void
  flash: (key: string | null) => void
}

export const useUI = create<UIStore>(set => ({
  settingsOpen: false,
  profileOpen: false,
  notificationsOpen: false,
  journeyFocus: null,
  highlight: null,
  setSettingsOpen: settingsOpen => set({ settingsOpen }),
  setProfileOpen: profileOpen => set({ profileOpen }),
  setNotificationsOpen: notificationsOpen => set({ notificationsOpen }),
  focusJourney: journeyFocus => set({ journeyFocus }),
  flash: highlight => set({ highlight }),
}))
