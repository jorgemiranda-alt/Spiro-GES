# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React + Vite + TypeScript + Tailwind CSS + shadcn/ui, built as a static installable PWA and published to GitHub Pages by GitHub Actions. Chosen by the user on 2026-10-22 to replace the plain-script prototype in `public/`.

## Users

- **Hourly employees** (for example Ava, US) punch in and out, take breaks, transfer between UKG labor categories, and review their timecard on a phone or desktop.
- **Salaried and grid-entry employees** (Maya, Zofia) enter weekly hours per project. Some work on one project at a time; others touch 5–10 projects in a week.
- **Warehouse workers** (Lukas, DE/PL) use a shared kiosk with a badge scanner.
- **Managers** (Oliver) review Time Off requests for their team.
- **Spiro leadership and business stakeholders** evaluate the demo and choose between layout options.

## Product Purpose

A CloudApper front end over UKG Pro WFM and Odoo project data. Employees record time and see assigned projects without using the UKG interface directly. The demo exists so Spiro can approve requirements and UI direction before the build.

## Positioning

It replaces the dense, "stale" UKG timecard grid with a simpler, project-first experience that works on mobile. Odoo project assignments come in automatically and are kept separate from UKG labor categories.

## Operating Context

- Stakeholder reviews compare the **Classic** timecard (UKG-style grid, shown to the client on 2026-10-21) with the **Modern** project-card layout that M. Trader proposed. Both must stay available behind a visible toggle on the timecard screens until the business decides.
- In the Modern layout, hourly entry is per project: Start, End, Break and Hours. Salaried entry is per project: Mon–Fri plus a weekly Total. Each project has a Show toggle to put it on the timecard or take it off. The hourly fields are editable in the demo as a proposal, even though the specified My Timecard is read-only (Q-05 is still open).
- The languages are English, French, German, Dutch and Polish.
- The source specification is `outputs/Spiro_Global_Time_Entry_UI_UX_Specification.md`.

## Capabilities and Constraints

- All data is simulated in the browser. Nothing is sent to UKG or Odoo.
- Journey IDs (PU-, TC-, GR-, TO-, KI-) link demo screens to the requirements register in `data/journeys.snapshot.json`.
- Punch editing, comments and correction requests are out of scope for the specified My Timecard.

## Brand Commitments

- The Spiro logo appears as delivered in `public/js/assets.js`.
- The spec names the Lufga typeface and the Spiro brand palette. Final theme colors are still subject to design review.
- Stakeholders asked for softer edges and a modern feel.

## Evidence on Hand

- Journey screenshots are in `public/journeys/prototype/`.
- The requirements register is in `data/`.
- All demo personas and projects are fictional.

## Product Principles

1. Make it obvious what to do next: punching, entering hours and requesting time off should take as few decisions as possible.
2. Organize work around projects, not raw grid cells.
3. Use the same patterns on desktop, mobile and kiosk.
4. Give layout options side by side, and let stakeholders choose.

## Accessibility & Inclusion

Target WCAG 2.2 Level AA, with visible focus and readable color pairings. Shared kiosks clear employee information after a timeout.
