# Project State

**Last updated:** 2026-10-01 (v0.6.0 — custom target events + live-board audit)
**Current version:** v0.6.0 (`tracker/index.html` APP_VERSION) · backend `tracker/Code.gs` 0.3.0 (**not yet deployed** — the live endpoint still reports 0.1.0)
**Active classes:** 26A (graduates Dec 2026), 26B (MCG 26B is a verbatim re-issue of 26A — same curriculum JSON)
**Published:** v0.6.0 pushed to `main` 2026-10-01 → GitHub Pages. User is testing it online.

---

## Where we are

The tracker draws, for a chosen **target event**, the board-visible prerequisite chain leading to it — class aggregate or one student — from the live Big Board (GAS Web App) laid over the MCG graph (`mcg-26a.json`, 667 events).

v0.6.0 (2026-10-01):

- **Any event can be the target.** The 11 practical / comprehensive goal events are presets in a searchable picker; everything else in the MCG or on the board is found by code fragment or name. Board-only rows (no MCG entry, or no event code at all) are targetable too. Pins, recents, `/` shortcut, `#target=` deep links.
- **The prerequisite walker and the drawing share one graph** (`render.buildDagForViewer`), so OPTED / NOT OPTED cannot disagree with the arrows.
- **Implied block sequence (KB Rule M, proposed)** — default on, dashed arrows, Settings toggle. Awaiting ruling.
- **26B works** (column-shift repair in the browser; proper fix in Code.gs 0.3.0).
- Full list of fixes: top of `issues.md`.

**Front-end:** `tracker/index.html` (~5,300 lines, single file).
**Backend:** `tracker/Code.gs` — GAS Web App, "Anyone with the link / Execute as me," reads a fixed Google Sheet by ID.
**Data contract:** `docs/04-handoff-2026-04-21.md` is authoritative. `docs/02-knowledge-base.md` is the rule reference.
**Regression check:** `node dev/app-harness.cjs` — runs the real app script against saved payloads and asserts four invariants (no throw for any target, no floating nodes, no uncollapsed off-board nodes, opted == drawing). Run it before publishing.

---

## Waiting on the user

1. **Test v0.6.0 online** (published 2026-10-01) and report anything off.
2. **Redeploy `Code.gs`** (Apps Script editor → paste → Deploy → Manage deployments → edit → New version). Gets the getFontLines speed-up (0.2.0) and layout detection (0.3.0). Until then the browser-side repair keeps 26B working.
3. **Rule on KB Rule M** (implied block sequence).
4. **Either-or mismatch banners** (SY 7304F / SY 7305C) — treat a grey half of a flight / control-room pair as "does the other half"?

## Open issues

**Carried over (re-checked 2026-10-01):**

- **OR-block rendering for SY 7511F** — both groups render: the flight alternatives (SY 7212F / SY 7222F / SY 7304F) under SY 7511F, the control-room alternatives (SY 7213C / SY 7223C / SY 7305C) under SY 7512C. The v0.5.1 note asked for both under SY 7511F; the MCG data hangs the control-room group on the control-room practical. Confirm that's what you want.
- **Duplicate mode "All of selected"** still merges like "Any" (sub-event splitting not built). 26A has 2 duplicate codes (PF 8222F, FQ 7241C); 26B has 3.
- **`MCG_VERSION` is a single constant** ("26A") — cosmetic while 26B shares the curriculum; real work when an MCG actually changes.

**Resolved since the last state update** (were listed as open; verified in v0.6.0):

- MCG-as-truth display rule — missing-from-BB nodes (v0.5.2a).
- Click-to-focus (v0.5.1).
- Hidden-node count — hidden nodes are named, and nodes that don't lead to the target are no longer in the graph at all.
- CF 6681F — present in the SY 7503F / SY 7511F chains for non-F-16 pilots.

---

## Feature suggestions (v0.6.0 hand-off, ranked for "understanding the flow")

None of these are started.

1. **Readiness table for the target** — one row per student: events left before the target, what they are blocked on right now, next scheduled date. The graph answers "what leads here"; this answers "who is how far away."
2. **Reverse view — "what does this event unlock?"** Same picker, walk downstream instead of upstream. When a flight slips: what is now held up, and for whom.
3. **Full-chain focus** — click = direct prerequisites (today); shift-click = everything upstream, so one branch's whole path lights up.
4. **"Next up" filter** — dim everything complete; show only the frontier (events whose prerequisites are met but which aren't done), per student or for the class.
5. **Warn only when it matters** — the pulsing ⚠ fires for any pending student with an unplanned prerequisite, which on a new class (26B) is everyone on every late event. Reserve it for students who are actually scheduled; show the rest as plain "not yet."
6. **Date awareness** — put the scheduled date on the node and flag order violations (an event scheduled before its prerequisite's date).
7. **Target sets** — save a named group of targets ("graduation requirements") and show one summary row per target; the multi-target version of pins.
8. **Aircraft currency strip** — rows 1–5 of the board already hold last-flown dates per student for T-38 / F-16 / C-12. Surface them next to a student's chain (needs a small Code.gs addition).
9. **Cross-row pairing** — colors match between a flight row and its control-room row (SY 7212F / SY 7213C); show "flying with / controlling for."
10. **Board hygiene list** — one panel of things to fix on the sheet: past-dated cells not marked complete, MCG/DBB mismatches, duplicate codes, rows with no code, codes not in the MCG.

---

## Open questions awaiting user rulings

From `docs/03-derived-requirements.md` §1 (R8–R11) and `docs/02-knowledge-base.md` §12:

| ID | Question | Why it matters |
|---|---|---|
| Rule M | Is the order of events inside an MCG block a prerequisite sequence? (KB §6 Rule M, proposed 2026-10-01) | Decides whether SY 7503F and TF 7503F have a chain at all |
| R8 | `oneOf` audience-specific routing — for FQ 6230F glider, both CF 6203F and CF 6215F survive the per-pilot filter. KB hint splits this by `select-P`, but no `select-P` marker on individual students. Show both via virtual group node, or add per-student select-P tagging? | Affects glider chain rendering for all pilots |
| R9 | Dangling prereq `TF 5301A` (cited by TF 5320A, no matching event in 26A) — currently traversed-and-collapsed silently. Display as unresolved instead? | Cosmetic but visible if anyone routes through TF 5320A |
| R10 | BB-only codes not in MCG (on 26A today: CF 6306H, FQ 8203F, MD 0000M) render on the board but don't connect. They are now targetable and listed in Settings → Validation. Anything more? | Could confuse users seeing orphan cells |
| R11 | DG for **Pilot-M** (multi-engine, likely C-12) and **Pilot-B** (bomber, TBD) is unresolved in the KB | Affects which CF events those students see; current code treats `dataGroup` field on the board as ground truth |
| KB §12 | DG → board-type mapping for Pilot-M / Pilot-B (exact aircraft) | Same as R11 |
| KB §12 | Per-student DG determination for FTE/ABM/CSO — per-student Big Board field, or class roster? | Affects DG-conditioned prereq filtering |
| KB §12 | MIBs as implicit prereqs of paired practicals — currently NOT encoded | Could surface as missing prereqs on practicals |
| KB §12 | `forDownstream` sibling-target semantics (KB §7.1 worked example) | Edge cases in conditional pruning |

---

## What was preserved verbatim (per user ruling — flag back to TPS curriculum office if surfaced)

These are MCG authoring errors. Data matches the PDF; do **not** silently fix at the data layer:

- **FQ 6321R** — suffix R (Written Report) but name says "Oral Report"
- **PF 8330M** — TF 6251F prereq listed as `[req for PF 8332F]` (missing apostrophe/d)
- **PF 8230M / PF 8231F descriptions** — copy-pasted from PF 8222F / PF 8221C (wrong topic)
- **TF 6240M description** — ends mid-sentence: `"...FQ 6241F C-12 S"`
- **SY 7504Y** — tag in name missing comma vs sibling events

---

## Suggested first session after restart

If picking up cold:

1. Read `CLAUDE.md` then this file.
2. Skim the top entry of `issues.md` (v0.6.0) — what changed and what is waiting on a ruling.
3. Run `node dev/app-harness.cjs` (must end with "All invariants hold"), then the tracker locally (`cd tracker && node serve.cjs`).
4. Pick one issue, fix, bump version per `docs/03-derived-requirements.md` §5 conventions, append resolution to `issues.md`, re-run the harness, sync `site/`.

Don't try to reground on the MCG rules from the PDF — read `docs/02-knowledge-base.md` instead. The rules there are the user's authoritative interpretation, the PDF has known drift.
