# Spiro-GEN

Interactive Spiro time and operations demo, published with GitHub Pages.

[Open the demo](https://jorgemiranda-alt.github.io/Spiro-GES/)

The deployable site is in `public/`. GitHub Actions publishes it whenever a commit is pushed to `main`.

## Journey maintenance

The [Google Sheet](https://docs.google.com/spreadsheets/d/1ZjEKU21p1VmP_A28lCFzTqQwOlINSt22Tutgm2t55J8/edit#gid=679994782) is the collaborative journey register. Edit journey content in **Journeys**, business requirements in **Requirements**, and client decisions in **OpenQuestions**. Preserve established IDs and the existing client review columns. Evidence, prototype coverage, client validation and approval are separate statuses.

The demo and the local specification use a reviewed snapshot of this sheet. Changes are synchronized on demand; client edits are not published automatically. Incorporate reviewed answers into the affected journey wording before refreshing. Manager project-time review is omitted from the current demo. Client questions remain in the sheet and specification; the demo journey page does not show them. Future and excluded journeys remain in the inventory for reference and cannot launch an employee action from the register.

From this repository, import a fresh, authenticated Google Sheets connector `get_spreadsheet_cells` export:

```powershell
node scripts/sync-journeys.mjs --import-sheet outputs/journey-sync/sheet-final.json
node scripts/sync-journeys.mjs --check
node --test scripts/sync-journeys.test.mjs scripts/punch-alignment.test.mjs
```

The filename is an example; use the fresh export from the current review, rather than reusing an older file. Export native CellData with `userEnteredValue,effectiveValue,formattedValue` for `Journeys!A1:AM500`, `OpenQuestions!A1:J500` and `Requirements!A1:H100`. Increase the bounded ranges when the register grows. The script verifies the spreadsheet ID, headers, identifiers, routes, acceptance criteria and requirement links before generating files. A plain CSV export is insufficient.

Alternatively, `node scripts/sync-journeys.mjs --pull` reads the same bounded ranges using an authorized access token already configured in `GOOGLE_ACCESS_TOKEN`. Do not store credentials in the repository. Ask Codex to refresh using the connected Google Drive plugin when using connector authentication. `--pull` does not use the plugin's login automatically.

The refresh updates `data/journeys.snapshot.json`, `public/js/journeys-data.js`, its cache version in `public/index.html`, `data/time-off-requirements.json`, and generated sections 5 and 9 in the local `outputs/Spiro_Global_Time_Entry_UI_UX_Specification.md`. Other specification sections remain manually maintained context and need review when related decisions change. The snapshot excludes private comments, answers, owners, reviewer identities, dates, and sprint planning fields. Raw exports and backups stay local in ignored `outputs/`.

Review the changes and prototype coverage before publication. `--check` verifies generated files against the local snapshot; it does not check for newer remote sheet edits or prove prototype acceptance. The Pages workflow runs `--check --demo-only` before deployment, without needing the local specification or Google credentials. Include the snapshot, asset manifest, requirement crosswalk, synchronization script and demo changes together in the eventual commit. A fresh checkout can run the demo check immediately; full document generation requires the local specification.

Screenshot paths and captions are maintained in `data/journey-assets.json`. Historical screenshots are identified as such and do not establish current acceptance or client approval. Do not edit `public/js/journeys-data.js` or generated specification blocks directly.
