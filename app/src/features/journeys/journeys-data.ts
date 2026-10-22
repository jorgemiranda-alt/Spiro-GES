/* The register is generated into public/js/journeys-data.js by scripts/sync-journeys.mjs.
   It is read as text and evaluated here so the generated file stays the single source. */
import src from "../../../../public/js/journeys-data.js?raw"

export interface JourneyShot { src: string; alt: string; caption: string }

export interface Journey {
  id: string
  epic: string
  name: string
  actor: string
  population: string
  story: string
  trigger: string
  pre: string
  flow: string
  alt: string
  rules: string
  api: string
  /** Given / when / then triples. */
  ac: string[][]
  ev: string
  src: string
  q: string
  pri: string
  cov: string
  /** [persona, view, highlight key, demo path]. */
  demo: [string, string, string, string]
  specStatus: string
  specRef: string
  requirementIds: string[]
  scope: string
  contentRevision: string
  currentState: string
  reviewStatus: string
  deliveryStatus: string
  clientDecision: string
  shots?: JourneyShot[]
  gridFields?: [string, string][]
}

export interface JourneySync {
  revision: string
  importedAt: string
  contentRevision: string
  sheetUrl: string
  journeyCount: number
  questionCount: number
  requirementsCount: number
}

const data = new Function(`${src}\nreturn { JOURNEYS, EPICS, JOURNEY_SYNC }`)() as {
  JOURNEYS: Journey[]
  EPICS: Record<string, string>
  JOURNEY_SYNC: JourneySync
}

export const JOURNEYS = data.JOURNEYS
export const EPICS = data.EPICS
export const JOURNEY_SYNC = data.JOURNEY_SYNC

/** Journeys that open on a previous pay period. */
export const J_PERIOD: Record<string, number> = { "TC-03": -1, "TC-04": -1 }
/** Highlight overrides for journeys whose demo target differs from the register. */
export const J_FOCUS: Record<string, string> = {
  "TC-01": "timecard-grid", "TC-02": "timecard-grid", "TC-03": "timecard-grid", "TC-04": "timecard-grid", "TC-07": "totals",
}
