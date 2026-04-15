# Derived Requirements — Big Board Curriculum Status Tracker

> Companion to `practical-and-goal-events.md`. This file captures decisions
> made during planning that weren't stated directly in the spec. Update it
> whenever a design call is reversed or refined.

**Project:** big-board-curriculum-status
**MCG target:** 26A
**First-drafted:** 2026-04-14

---

## 1. Confirmed high-level decisions

| # | Decision | Source |
|---|---|---|
| D1 | Drive all event metadata and prereqs from **MCG 26A** raw-data JSON | User answer |
| D2 | GAS opens a fixed Google Sheet by ID; tab name picked by the UI (`sheets_avail` → dropdown → `fetch_sheet`) | Spec + user answer |
| D3 | Front-end is a **single local HTML file** that fetches from the deployed GAS Web App | User answer |
| D4 | GAS deployment: **Anyone with the link / Execute as me** | User answer |
| D5 | v1 scope: no pan/zoom, no drag-to-rearrange | User answer |
| D6 | FTC and STC tabs are **separate views** — user picks one at a time; no auto-merge | User answer |
| D7 | **Applicability comes from the MCG JSON `applicability` array**, not parsed from title parens on the board | User answer |
| D8 | MCG prereq graph is **embedded inside index.html** between clearly-marked fences; also emitted as a standalone JSON for reference | User answer |
| D9 | "Opted" = *student type is in event.applicability* AND *all board-visible prereqs are marked complete for that student* | User answer |
| D10 | Off-board prereqs (MCG prereqs that don't appear on the big board) are **assumed complete**; shown greyed out with an "off-board" tag in drilldowns | User answer |

## 2. Sheet-parsing contract (derived from xlsx inspection)

Tab layout confirmed against `Digital Big Board_260414.xlsx` > "26A FTC Big Board":

| Row | Meaning |
|---|---|
| 1-3 | Currency dates per student by platform (T-38 / F-16 / C-12). Informational. |
| 4 | Event-counter date ruler + legend label cells in AC-AE. |
| 5 | Numeric event-counters. |
| 6 | **Student names** in B..Z. A cell with no value = inactive student (skip). |
| 7 | **Student type** (ABM, CSO, RPA, FTE, Pilot-F, Pilot-M, Pilot-B). Normalize known typos (e.g. "Pilo-B"). |
| 8 | **Data group** (LJ-25, F-16, T-38, C-12). |
| 8 AA-AE | Header labels for event meta columns. |
| 9+ | **Event rows.** Meta columns: AA=Series, AB=Course No, AC=Event No, AD=Title, AE=Pilot gate. |
| 9+ B..Z | Per-student completion cells (see cell-format contract below). |
| AB7 / AC7 | Class start / end dates. |

**Never hardcode row numbers for goal events.** Locate by matching the normalized Event No string.

## 3. Cell-format → status primitives

For each cell in a student column on an event row, GAS returns:

- `value` — the cell's displayed text (usually a date like "4/10", or blank)
- `bgHex` — 6-char uppercase hex (e.g. `"FFFFFF"`, `"666666"`, `"93C47D"`)
- `strikethrough` — boolean, derived from `RichTextValue.getRuns()` — true iff *any* run has strikethrough
- `rgbFamily` — classified server-side, one of:
  - `"white"` — cell's RGB has R=G=B and R ≥ 240
  - `"lightGrey"` — R=G=B and 150 ≤ R < 240
  - `"darkGrey"` — R=G=B and R < 150
  - `"paired"` — any other RGB (non-greyscale color)

Interpretation applied by `status.js`:

| family | value | strike | meaning |
|---|---|---|---|
| white | date in past | - | Past-dated, not validated → **flag on issue log**, treat as Not Complete |
| white | date in future | - | **Scheduled** (future event) |
| white | blank | - | Not scheduled |
| lightGrey | any | - | **Complete** |
| darkGrey | any | - | **Not required** for this student |
| paired | any | true | **Complete** (paired event) |
| paired | any | false | **Not Complete** (paired event, opted) |

## 4. Seven event status states (from spec, formalized)

Computed per event across the set of *applicable* students (type matches event.applicability).

| State | Condition |
|---|---|
| Complete | 100% of applicable students complete |
| PartiallyComplete | ≥ 50% complete, < 100% |
| Started | > 0 complete or ≥ 1 scheduled future cell, but < 50% complete |
| NotStarted | 0 complete, 0 scheduled future cells |
| PrereqsMet | No one complete AND every applicable student's board-visible prereqs are fully met |
| PrereqsPartiallyMet | No one complete AND at least one applicable student is opted (prereqs met) |
| PrereqsNotMet | No one complete AND no applicable student is opted |

If multiple states qualify, completion states (first 4) take precedence over prereq states.

## 5. Versioning convention

Every source file starts with this block (JSON uses a top-level `_meta` object instead):

```
/* ============================================================
 * File:       <filename>
 * Module:     big-board-curriculum-status / <layer>
 * Version:    <semver>
 * MCG Target: 26A
 * Updated:    YYYY-MM-DD
 * Changelog:
 *   X.Y.Z - summary
 * ============================================================ */
```

- **MAJOR** bump = data contract break
- **MINOR** bump = user-visible behavior change
- **PATCH** bump = bug fix
- Static MCG artifacts embed the MCG version in their filename (`mcg-26a-graph.json`), not semver

## 6. Component map

```
build-prereq-graph.cjs     [Node, build-time] reads MCG → emits JSON + fenced HTML block
Code.gs                    [GAS Web App] doGet router: sheets_avail, fetch_sheet, health
index.html                 [Local, runtime] single file containing CSS + JS + embedded MCG graph
issues.md                  [Local] user-maintained issue log the agent reads in future sessions
```

## 7. Known risks / to-revisit

- **R1** — "Pilo-B" typo in the sample tab; alias map needed in `parse.js` (`"Pilo-B" → "Pilot-B"`). Log unknown types to console as soft warnings.
- **R2** — Date strings lack year (e.g., "4/10"). Resolve with class-start / class-end window. Dates near Jan 1 need extra care.
- **R3** — Paired-cell strikethrough comes from rich-text runs; fallback if GAS returns a non-rich value should be "not complete."
- **R4** — A 1022-row × ~27-col fetch with three attributes per cell is heavy. Cache SheetPayload in `sessionStorage`, keyed by sheet name + server-side content hash. Provide `?force=1` escape hatch.
- **R5** — MCG events referenced as prereqs but *not in any phase JSON* should be logged as a build-time warning in `build-prereq-graph.cjs`.
- **R6** — Class can roll to 26B, 27A, etc. MCG version is a single global constant in build-prereq-graph.cjs; swap + rerun.
- **R7** — Some MCG applicability arrays contain values like `"select FTE"` or `"select P"` (e.g. SY 7503F). These mean "some but unknown which students of this type." `isStudentApplicable()` intentionally does not match `select *` entries — the scheduler picks who's in via dark-grey on the board for the rest, which our logic already handles correctly. Flagged here because it's a non-obvious interaction.

## 8. Issue-log loop (how the user will communicate problems)

1. User adds entries to `issues.md` in this folder, format:
   ```
   ## YYYY-MM-DD — short title
   **Severity:** [blocker | major | minor | cosmetic]
   **Component:** [backend | frontend | data | other]
   **What happened:** ...
   **Expected:** ...
   ```
2. Agent reads `issues.md` on invocation, triages, proposes fixes with version bumps.
3. Fixed entries get a `**Resolved:** YYYY-MM-DD vX.Y.Z` line and are left in place as a running record.
