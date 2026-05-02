# MCG 26A V2 Extraction Summary

Generated: 2026-04-20. Revised: 2026-04-21 (post-review cleanup).  
Source: `MCG-automated-extraction/MCG-26A/MCG 26A.pdf` (via pre-extracted text dumps in `text-extracts/`).  
Combined output: `MCG-automated-extraction/MCG-26A/26A MCG.json` (667 events, 1633 prereq entries).

## Event counts per phase

| Phase | Name | V2 events | V1 events | Δ |
|---|---|---:|---:|---:|
| AN | Ancillary Training | 49 | 49 | 0 |
| AS | Astro Sciences | 84 | 84 | 0 |
| CF | Check Flight | 97 | 97 | 0 |
| FQ | Flying Qualities | 95 | 96 | −1 |
| PF | Performance | 57 | 57 | 0 |
| SO | Space Operations | 16 | 16 | 0 |
| SY | Mission Systems | 96 | 96 | 0 |
| TF | Test Foundations | 142 | 130 | +12 |
| TL | Test Leadership | 31 | 31 | 0 |
| **Total** | | **667** | **656** | **+11** |

## V1 vs V2 deltas

**Added in V2 (12):** All from TF series ranges that V1 failed to expand:
- `TF 7210G` – `TF 7215G` (series `TF 7210-15G`, 6 events)
- `TF 7220F` – `TF 7225F` (series `TF 7220-25F`, 6 events)

**Removed in V2 (1):**
- `FQ 8203F` — not present in the MCG 26A source text (likely 25A→26A removal; V1 had stale data).

## Goal event presence

All 11 goal events from knowledge base §5 are present in the V2 output:
- PF 8311F, PF 8332F
- FQ 9502S, FQ 9511F, FQ 9512C
- SY 7503F, SY 7511F, SY 7512C, SY 7521O
- TF 9102E, TF 9111E

## Series range notations captured (16 series, 65 member events)

| Series | Length | Phase |
|---|---:|---|
| CF 6110-4F | 5 | CF |
| CF 6120-1F | 2 | CF |
| CF 6202-3F | 2 | CF |
| CF 6210-5F | 6 | CF |
| CF 6360-2F | 3 | CF |
| CF 6402-3F | 2 | CF |
| CF 6540-2F | 3 | CF |
| CF 6670-3F | 4 | CF |
| CF 6801-2F | 2 | CF |
| FQ 6310-1F | 2 | FQ |
| PF 8240-2F | 3 | PF |
| SO 6130-2S | 3 | SO |
| TF 7210-15G | 6 | TF |
| TF 7220-25F | 6 | TF |
| TL 8110-70A | 7 | TL |
| TL 8111-71Y | 7 | TL |

All series-length assertions match member counts and positions are 1..N exactly.

## Cross-check results (post-review)

- ✅ All 11 goal events present.
- ✅ All 16 range series have consistent length/position metadata.
- ✅ Schema consistent across all 9 phases (0 prereqs with non-canonical keys, 0 string-form nameTags).
- ✅ 667 events, 0 duplicate codes across phases.
- ⚠ 1 dangling prereq code remaining — `TF 5301A` (orphan citation; preserved verbatim per user ruling). Originally 3 dangling; 2 fixed at review time.
- ✅ FQ 8203F verified absent from 26A source — correctly excluded.

See `extraction-notes.md` for the full flagged-items breakdown per phase and the review-pass fix log.

## Metadata captured in V2 that V1 lacked

The V2 schema adds structured fields that V1 omitted. Every V2 event record now carries:

1. **`applicabilityDetail`** — structured audience + role + aircraft:
   - `role`: `crew-solo` / `non-crew-solo` / `select P` / `select STC` / `optional` / `execute-primary` / null
   - `aircraft`: `C-12` / `F-16` / `T-38` / `Learjet` / null
   - `standardMapping`: expanded list (e.g., FTC → `[ABM, CSO, FTE, P, RPA]`)
   - `description`: human-readable scope note

2. **`seriesInfo`** — per-event series metadata for range notation:
   - `inSeries: true/false`
   - `seriesId`, `seriesPosition`, `seriesLength` — populated on every series member.

3. **Structured `nameTag` on every prereq** — parsed from the parenthetical tag in the prereq name (e.g., `(ABM/CSO/FTE/RPA)` → `["ABM","CSO","FTE","RPA"]`).

4. **Structured `condition` on every prereq**:
   - `{ type: "forDownstream", target: "<event code>" }` — from `[req'd for XXXX]` annotations.
   - `{ type: "datagroup", values: ["T-38" | "C-12" | "F-16" | "Learjet"] }` — from `[req'd for X Data Group]` annotations.
   - `null` — unconditional edge.

5. **`nameTagRole` / `nameTagAircraft`** — for `(P, crew solo)` / `(P, non-crew solo)` prereq tags, records which aircraft/role narrows the pilot audience.

6. **`eventNotes`** — verbatim MCG notes, shared-description flags, timing annotations, role clarifications, and per-event parser flags.

7. **`moduleCode`, `moduleName`, `parentCourse`** — course hierarchy recovered from module/course headers in the MCG.

8. **Verbatim `description`** — full prose description block preserved (not paraphrased).

## New conditions / schema gaps surfaced

Extraction uncovered source patterns not representable in the current 2-condition schema:
- `[req'd for all]` / `[req'd for P]` — audience-sentinel forDownstream targets (CF phase).
- `[req'd for "US Only Control Rooms with Special Access Programs"]` — descriptive-phrase target (TF 7401C).
- `[Hour 4]` — timing / sequence annotation (FQ 6201A, FQ 8101A).
- `+ 5 days` — delay-after constraint (PF 8202E → PF 8211F).
- Explicit `or` conjunctions between prereqs — need a "one-of" relationship type (FQ 9245C-series, SY 7510M/7511F/7512C/7513Y).
- Non-standard series step — `TL 8110-70A` and `TL 8111-71Y` step by 10, not by 1 (knowledge base §3 describes step-by-1 only).

## New event-type suffixes observed

Knowledge base §3 type-suffix list is incomplete. Observed in 26A text:
- `W` — Working Group (AS, FQ phases).
- `L` — Lab (AS phase).
- `I` — Ground Integration Test (FQ 7221I).
- `O` — Space Operation (SO, AS phases — listed in front-matter table but missing from KB §3).

## Role vocabulary observed

Beyond `crew-solo` / `non-crew-solo`: `select P`, `select STC`, `select FTE/P`, `optional`, `execute-primary` (with audience observers), compound security + student-type (`US Only STC`). Recommend standardizing role vocabulary in the schema.

## File outputs

Combined output:
- `MCG-automated-extraction/MCG-26A/26A MCG.json` — **single combined file, 667 events, 1633 prereq entries**. Includes top-level `eventSchema`, `prereqSchema`, `conditionSchema`, `prereqGroupSchema` metadata blocks for code-base consumption.

Per-phase source files (all in `MCG-automated-extraction/MCG-26A/Version-2-raw-data/`):
- `phase-AN.json` (49 events)
- `phase-AS.json` (84 events)
- `phase-CF.json` (97 events)
- `phase-FQ.json` (95 events)
- `phase-PF.json` (57 events)
- `phase-SO.json` (16 events)
- `phase-SY.json` (96 events)
- `phase-TF.json` (142 events)
- `phase-TL.json` (31 events)
- `extraction-notes.md` — flagged ambiguities / MCG source drift / review fixes log
- `extraction-summary.md` — this file
- `crosscheck.js` — validation script (`node crosscheck.js`)
- `normalize.js` — normalization script applied during review cleanup
- `combine.js` — combines per-phase files into `26A MCG.json`

## oneOf prereq groups (new schema feature)

Five oneOf groups captured, 16 hosting events total:

| Group ID | Members | Audience hint | Hosted on |
|---|---|---|---|
| `SY-7511F-flight` | SY 7212F / SY 7222F / SY 7304F | P | SY 7510M/7511F/7512C/7513Y |
| `SY-7511F-cr` | SY 7213C / SY 7223C / SY 7305C | FTE | SY 7510M/7511F/7512C/7513Y |
| `FQ-6230F-glider` | CF 6203F / CF 6215F | track-based | FQ 6230F |
| `FQ-9211F-glider` | CF 6203F / CF 6215F | track-based | FQ 9210M / FQ 9211F |
| `FQ-9245C-cr-intro` | FQ 6252C / TF 6231C | ABM/FTE | FQ 9240M–FQ 9248Y (9 events) |

Student completes **at least one** of the alternatives in a group (may complete more). Graph-build consumes `group.id` to render alternatives as a merged-branch display and to avoid forcing every alternative as required.

## Next step (out of scope for this pass)

A graph-build step should consume `26A MCG.json` and produce the final DAG for the UI. That step is responsible for:
- Applying Rule G tight-serial collapse where range notation is present.
- Rendering oneOf groups with appropriate "pick one" UI semantics.
- Extending condition type system to cover sentinels: `target: "all"`, `target: "P"`, `target: "US Only Control Rooms with Special Access Programs"`, `[Hour 4]`, `+ 5 days`.
- Deciding how to handle the single remaining dangling prereq (`TF 5301A` on TF 5320A) — drop edge or preserve as incomplete node.
