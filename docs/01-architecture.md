# Architecture

## Component map

```
                   ┌──────────────────────────────────┐
                   │   MCG 26A.pdf (TPS curriculum)   │
                   └─────────────────┬────────────────┘
                                     │ (one-shot per class version)
                                     ▼
              ┌──────────────────────────────────────────┐
              │   extraction/  (PDF → structured JSON)   │
              │     prompts/   prompt scaffolds          │
              │     schemas/   JSON schema               │
              │     scripts/   parse, validate, merge    │
              │     source/    PDF + raw text + v1/v2/v3 │
              └──────────────────────────┬───────────────┘
                                         │ produces
                                         ▼
              ┌──────────────────────────────────────────┐
              │  data/MCG-26A_2026-04-21.json (canonical)│
              │  667 events · 1633 prereqs · 11 goals    │
              │  Schema: see docs/04-handoff-2026-04-21  │
              └────────────┬─────────────────────────────┘
                           │ runtime copy
                           ▼
   ┌────────────────────────────────────────────────────────┐
   │                     tracker/                           │
   │                                                        │
   │   index.html  (single-page app, ~3k lines)             │
   │     ├── viewer-aware DAG builder                       │
   │     │     applies KB Rules A, D, E, G, I               │
   │     │            + condition types (forDownstream,     │
   │     │              datagroup) + oneOf groups           │
   │     ├── status engine (7-state model)                  │
   │     ├── targets + targetPicker (any event as target)   │
   │     ├── chain (opted / missing — reads the DAG)        │
   │     ├── dagre layout (vendored: dagre.min.js)          │
   │     └── two views: per-student | class-union           │
   │                                                        │
   │   Code.gs   (GAS Web App: doGet router)                │
   │     ├── sheets_avail   list available tabs             │
   │     ├── fetch_sheet    pull one tab's payload          │
   │     └── health         smoke check                     │
   │                                                        │
   │   serve.cjs  (local dev HTTP server)                   │
   │   mcg-26a.json  (runtime copy of data/MCG-26A_*.json)  │
   └─────────┬────────────────────────────────┬─────────────┘
             │ fetch (same-origin)            │ HTTPS
             ▼                                ▼
   ┌──────────────────────┐     ┌───────────────────────────┐
   │  mcg-26a.json        │     │  Google Apps Script       │
   │  (curriculum data)   │     │  Web App                  │
   └──────────────────────┘     │   (Anyone w/ link,        │
                                │    Execute as me)         │
                                └────────────┬──────────────┘
                                             │ SpreadsheetApp
                                             ▼
                                ┌───────────────────────────┐
                                │  Digital Big Board        │
                                │  Google Sheet             │
                                │  (sheet ID in script      │
                                │   property SHEET_ID)      │
                                └───────────────────────────┘
```

## Two filters, two views

The DAG builder applies two distinct filters that must not be conflated (see `docs/02-knowledge-base.md` Rule I):

1. **MCG applicability filter** (Rule A): "should this student do this event per the curriculum?" — derived from `event.applicability` and per-prereq `nameTag` arrays.
2. **Big Board visibility filter**: "is this event being tracked for this student on the board right now?" — derived from cell color (`darkGrey` = not required for that student).

These are applied in order. An event filtered out by Rule A is **gone** for that viewer. An event that passes Rule A but is dark-grey on the board is **still rendered** but reflected as "not required."

**Class view** = union of per-student DAGs across all students applicable to the chosen goal event. **Single-student view** = per-viewer DAG filtered exactly to their chain.

## Data flow per session

1. App boot fetches `mcg-26a.json` (1.4 MB) once.
2. App fetches `sheets_avail` from GAS, populates the tab dropdown.
3. User picks a tab → app calls `fetch_sheet`, which returns a `SheetPayload` containing per-cell `{value, bgHex, strikethrough, rgbFamily}` for every event-row × student-column intersection.
4. Status engine maps `(rgbFamily, value, strikethrough)` to one of the 7 status states (see `docs/03-derived-requirements.md` §3-4).
5. DAG builder runs the viewer-aware traversal from the chosen goal event.
6. Dagre lays out the graph; renderer draws nodes and edges.

## Target events (v0.6.0)

The target is any entry in the catalog `targets.buildCatalog(payload)`: every MCG event plus every board row (rows without an event code are keyed by title). Presets are `MCG_GRAPH.goalEvents`. Three cases:

| Target | Chain | Target node |
|---|---|---|
| In MCG, on board | full | progress + roster |
| In MCG, not on board | full (board-visible part) | neutral "not tracked on this board" |
| Board-only (not in MCG) | none — no prerequisites are known | progress + roster |

State lives in `state.goalCode`, `localStorage` (`bbcs::lastTarget`, `bbcs::pinnedTargets`, `bbcs::recentTargets`) and the URL (`#target=<code>`).

## One prerequisite graph

`render.buildDagForViewer(code, payload, viewerType, viewerDG)` is the only place MCG prerequisites are interpreted (Rules A / D / E / G, conditions, oneOf, implied block sequence). The canvas collapses off-board nodes out of it; `chain` (opted / missing prereqs) walks it uncollapsed, cached per (event, type, DG). Do not add a second walker.

## Caching

- `SheetPayload` is cached in `localStorage` per tab (`bbcs::sheet::<tab>`); **Refresh** re-fetches. The header shows the payload's `fetchedAt` and flags it after 24 h. A first visit (nothing cached) fetches the tab list and the default board (`CONFIG.DEFAULT_SHEET`) on its own.
- The MCG JSON itself is fetched once per page load — it's static for the class version.

## Versioning

Per `docs/03-derived-requirements.md` §5:
- **MAJOR** = data contract break (e.g., the v1→v2 schema migration in v0.5.0)
- **MINOR** = visible behavior change
- **PATCH** = bug fix

Static MCG artifacts embed the class version in their filename (`MCG-26A_2026-04-21.json`), not semver.

## Known cross-cutting risks

See `docs/03-derived-requirements.md` §7 for full list. Highest-impact:

- **R6 — Class roll-over**: MCG version is a single global constant. Swap + re-extract.
- **R4 — Sheet payload size**: 1022 rows × ~27 cols × 3 attrs is heavy. `sessionStorage` cache is essential.
- **R7 — `select FTE` / `select P`** applicability tags: deliberately not matched by `isStudentApplicable()`; relies on dark-grey-on-board for filtering. Non-obvious but correct.
