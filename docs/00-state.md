# Project State

**Last updated:** 2026-05-02 (folder reorganization; no code changes)
**Current version:** v0.5.1 (per `issues.md` top entry)
**Active class:** 26A

---

## Where we are

The display app rewrite to v0.5 (2026-04-21) is **landed and working**. It replaced the embedded v1 MCG graph with a fetched, structured v2 JSON (`MCG-26A_2026-04-21.json`, 667 events, 1633 prereq entries). The DAG builder applies KB Rules A / D / E / G / I, both condition types (`forDownstream`, `datagroup`), and `oneOf` groups. The three KB worked examples (§13.1 / §13.2 / §13.3) all match.

**Front-end:** `tracker/index.html`, ~3,040 lines after the embedded MCG block was extracted to a separate fetched file.
**Backend:** `tracker/Code.gs` — GAS Web App, deployed "Anyone with the link / Execute as me," reads a fixed Google Sheet by ID.
**Data contract:** `docs/04-handoff-2026-04-21.md` is authoritative. `docs/02-knowledge-base.md` is the rule reference.

---

## Open issues (from `issues.md` v0.5.1, highest-priority first)

1. **MCG-as-truth display rule** (PRIORITY): events with suffix S/C/F/I/L must render even if absent from Big Board. If absent, show "XX ####X — (event name) — not currently tracked on Big Board."
2. **Hover tooltip on "prereqs not met"** must list which specific prereqs are missing, plus scheduled date if any. Format example in `issues.md`.
3. **Click-to-focus**: clicking an event (not expanding it) should highlight that event + only its direct prerequisites; defocus everything else.
4. **OR-block rendering for SY 7511F**: there should be two OR blocks (the second for control room events). SY 7222F is missing from the page.
5. **Hidden-node count tooltip**: "Nodes shown: 46 of 47 (1 hidden)" should be clickable to reveal what's hidden.
6. **CF 6681F missing entirely** — should show only non-F-16 datagroup pilots.
7. **DG LA/TP Data Flight 1**: hover tooltip not showing missing prereqs for not-opted students.

---

## Open questions awaiting user rulings

From `docs/03-derived-requirements.md` §1 (R8–R11) and `docs/02-knowledge-base.md` §12:

| ID | Question | Why it matters |
|---|---|---|
| R8 | `oneOf` audience-specific routing — for FQ 6230F glider, both CF 6203F and CF 6215F survive the per-pilot filter. KB hint splits this by `select-P`, but no `select-P` marker on individual students. Show both via virtual group node, or add per-student select-P tagging? | Affects glider chain rendering for all pilots |
| R9 | Dangling prereq `TF 5301A` (cited by TF 5320A, no matching event in 26A) — currently traversed-and-collapsed silently. Display as unresolved instead? | Cosmetic but visible if anyone routes through TF 5320A |
| R10 | 6 BB-only codes not in MCG (CF 6306H, CF 6380M, CF 6381F, CF 6690M, CF 6691F, FQ 8203F) render on the board but don't connect. Flag in issues.md? | Could confuse users seeing orphan cells |
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
2. Skim `issues.md` top-down to confirm v0.5.1 priorities haven't shifted.
3. Run the tracker locally (`cd tracker && node serve.cjs`) and reproduce one of the open issues (recommended: #2, hover tooltip on prereqs not met, since it's localized to the rendering layer).
4. Pick one issue, fix, bump version per `docs/03-derived-requirements.md` §5 conventions, append resolution to `issues.md`.

Don't try to reground on the MCG rules from the PDF — read `docs/02-knowledge-base.md` instead. The rules there are the user's authoritative interpretation, the PDF has known drift.
