# MCG Curriculum Knowledge Base

**Purpose**: Authoritative reference capturing curriculum rules, corrections, and design guidance derived from user training for the MCG 26A curriculum status app. This document is the MCG expert's primary reference when answering coding-agent questions.

**Source of training**: Training session with USAF TPS instructor/scheduler, 2026-04-20. Worked example: student "Root" (C-12 DG pilot) walking backward from Performance Practical (PF 8332F).

**Companion files**:
- `mcg-curriculum-expert-prompt.md` — original training scaffold (background).
- `../working/mcg-26a-graph-v2.json` — current graph data (has known gaps; see Corrections).
- `../../MCG-automated-extraction/MCG-26A/MCG 26A.pdf` — canonical source; consult when this doc is ambiguous.
- `../JSON-outputs/fetch_sheet.json` — Big Board operational data (what the scheduler tracks).

---

## 0. Source-of-truth ordering (read this first)

The app pulls from two sources: the **MCG** (curriculum JSON, derived from the 26A PDF) and the **Big Board / DBB** (live Google Sheet, fetched via GAS).

**The MCG is authoritative for *what* a student must complete.** The Big Board is authoritative for *whether* they have completed it (status, schedule, comments). Never the other way around.

| Question | Read from |
|---|---|
| Does this event apply to this student? | **MCG** applicability + `nameTag` + `condition` (datagroup, forDownstream) |
| Is the event a prereq of the goal? | **MCG** prereq graph |
| Has this student completed / scheduled this event? | **Big Board** cell color + value |
| Who is in the class roster? | **Big Board** name list (the only place names live) |

**Recurring failure mode**: the codebase has twice (v0.5.0 CF 6370F, v0.5.2 PF 8211F) drifted into using DBB cell color/presence to *infer applicability*. A miscolored cell or a stray flight on the Big Board is then read as ground truth, and the MCG is silently overridden. **Don't do this.** Derive applicability from MCG → roster, then look up status on DBB. When the two disagree on applicability, surface a warning rather than picking a side.

This rule is also captured in `AGENTIC.md` § System Evolution Log (2026-05-03).

---

## 1. Student Types (26A class composition)

| Board label | Count | MCG applicability code | Role |
|---|---|---|---|
| CSO | 1 | `CSO` | Combat Systems Officer |
| RPA | 2 | `RPA` | Remotely Piloted Aircraft pilot |
| FTE | 10 | `FTE` | Flight Test Engineer |
| Pilot-F | 7 | `P` | Pilot — F-16 data group |
| Pilot-M | 2 | `P` | Pilot — multi-engine (likely C-12) data group |
| Pilot-B | 2 | `P` | Pilot — bomber (TBD) data group |

**Open**: precise mapping of Pilot-M and Pilot-B board labels to specific data groups. The user deferred this; resolve before per-pilot rendering.

## 2. Aircraft / Data Groups (DG)

A student's DG determines which aircraft-specific events they take. DGs apply to both pilots and non-pilots, but with different implications:
- For pilots: DG = aircraft they're crew-solo in (affects Rule D/E crew-solo routing).
- For non-pilots (ABM/FTE): DG = aircraft they're assigned to for data-collection flights.

**Known DG values** (as strings in the `datagroup` condition type — see §7):

| DG value | Aircraft | Assigned to |
|---|---|---|
| `C-12` | C-12 King Air (multi-engine turboprop) | Pilots (C-12 crew solo), ABM/FTE assigned to C-12 |
| `F-16` | F-16 Fighting Falcon | Pilots (F-16 crew solo), ABM/FTE/RPA assigned to F-16 |
| `T-38` | T-38 Talon trainer | ABM/CSO/FTE assigned to T-38 |
| `Learjet` | LJ-25 (Learjet 25) | RPA (all RPAs), ABM/CSO |

**Student-type → DG mappings observed**:
- **Pilot-F (board label)** = P, F-16 DG (crew solo)
- **Pilot-M, Pilot-B** = P, DG mapping TBD (open question)
- **RPA** = LJ-25 / Learjet DG (confirmed)
- **FTE** = variable per student, assigned to T-38, C-12, or F-16 DG (NOT Learjet — no FTE tag on Learjet events)
- **ABM, CSO** = variable per student (similar to FTE)

**Universal rules about aircraft**:
- **Every pilot is crew solo in the T-38**, regardless of DG (Rule J). T-38 is the universal pilot trainer.
- **Every standard student flies the C-12 for ITC**, regardless of DG (Rule C).

**Open question**: how does the app determine a specific FTE/ABM/CSO's DG? Per-student field in Big Board, or class-wide assignment list?

## 3. Event Code Structure

Format: `XX ####X` — e.g., `PF 8332F`.

- `XX` = phase prefix
- `####` = hierarchical number: course (first digit × 1000), module (first two digits × 100), event (last two digits)
- `X` = type suffix

### Phase prefixes
AN Admin · AS Astronautics · CF Check Flight · FQ Flying Qualities · PF Performance · SO Space Ops · SY Systems · TF Test Fundamentals · TL Test Leadership

### Event type suffixes
| Code | Type |
|---|---|
| A | Academic Lecture |
| B | **Asynchronous content** (self-paced / CBT) |
| C | Control Room |
| E | Exam |
| F | Flight |
| G | Ground School |
| H | **Ground Training** |
| M | Mission Info Brief (MIB) |
| R | Written Report |
| S | Simulator |
| Y | Oral Report |
| Z | Debrief |

### Series notation in MCG PDF
Numbered series are written as a range: `CF 6540-2F` = events `CF 6540F`, `CF 6541F`, `CF 6542F`. The extractor must parse this and tag series members. See Rule G.

## 4. Applicability Codes

Applicability appears in two places:
- **Event-level**: `applicability` array on the event (who the event applies to).
- **Prereq-level**: parenthetical tag in the prereq's `name` field, e.g., `(ABM/CSO/FTE/RPA)` or `(P, crew solo)`.

| Code | Meaning |
|---|---|
| `P` | All pilots (narrowed further by crew-solo role + aircraft if present) |
| `ABM` | Air Battle Manager (confirm scope with user when it recurs) |
| `CSO` | Combat Systems Officer |
| `FTE` | Flight Test Engineer |
| `RPA` | RPA pilot |
| `FTC` | Fixed-wing Test Course — expands to `[ABM, CSO, FTE, P, RPA]` (all standard types) |
| `STC` | Space Test Course — separate track |
| *(empty)* | All students (no restriction) |
| `select P` | Pilots at instructor discretion |
| `US Only` | Security restriction, not a student-type filter |

The v2 JSON expands codes like `FTC` via `applicabilityDetail.standardMapping` — use that structured field in code rather than re-expanding strings.

## 5. The 11 Goal Events

| Code | Name | Applicability |
|---|---|---|
| PF 8311F | C-12 Performance Practical Flight | CSO, RPA |
| PF 8332F | Multi-Engine Performance Practical | ABM, FTE, P |
| FQ 9502S | Sim FQ Practical Exam | ABM, CSO, RPA |
| FQ 9511F | T-38 FQ Practical Exam | P |
| FQ 9512C | T-38 FQ Practical Control Room | FTE |
| SY 7503F | MQ-9 Systems Practical Exam | ABM, CSO, RPA, select FTE/P |
| SY 7511F | F-16 Systems Practical Exam Flight | P |
| SY 7512C | F-16 Systems Practical Exam Control Room | FTE |
| SY 7521O | Space Systems Practical | STC |
| TF 9102E | Comprehensive Written Exam | all |
| TF 9111E | Comprehensive Oral Exam | all |

---

## 6. Curriculum Rules

### Rule A — Prereq applicability filter
The main event's `applicability` defines the audience. A prereq's parenthetical name-tag `(X/Y/Z)` further filters *within* that audience. A prereq with no tag applies to everyone on the main event. If a prereq's tag lists an audience member not on the main event (e.g., `RPA` on a prereq under an ABM/FTE/P main event), ignore the extra — that prereq exists because it also feeds other main events where that audience matters.

**Implementation**: for each prereq edge, compute `viewer ∈ (main_event.applicability ∩ prereq.nameTag)`. Include if true, prune if false.

### Rule B — "Data Group Level" in an event name is NOT a DG filter
Events like `PF 8240F / 8241F / 8242F` "Data Group Level Accel/Turn Perf Data Flights 1/2/3" are flown by **every** data group at their respective DG level. The numbering is flight-number-in-series, not DG assignment. Do not treat "Data Group Level" naming as varying-by-DG.

### Rule C — C-12 ITC is universal
`TF 6251F` (C-12 Intermediate Airborne Test Conduct) is flown by all standard students regardless of DG, despite "C-12" in the name. Same for its related MIBs and intro flights.

### Rule D — "Crew solo" = DG-matched pilots only
A prereq tagged `(P, crew solo)` on an aircraft-specific event applies ONLY to pilots whose DG matches that aircraft.
- `CF 6542F (P, crew solo)` on a C-12 event → C-12 DG pilots only.
- `CF 6673F (P, crew solo)` on an F-16 event → F-16 DG pilots only.

The v2 JSON expresses this structurally:
```json
"applicabilityDetail": { "role": "crew-solo", "aircraft": "C-12", "standardMapping": ["P"] }
```
Use `applicabilityDetail.role` and `.aircraft` rather than parsing the name string.

### Rule E — Crew solo / non-crew solo are MUTUALLY EXCLUSIVE per aircraft
For a given aircraft's training pair:
- `(P, crew solo)` → pilots whose DG matches that aircraft
- `(P, non-crew solo)` → pilots whose DG does NOT match that aircraft

Each pilot flies **exactly one** of the pair. They're complementary, not cumulative.

Example: for C-12 flight training pair (`CF 6542F` crew-solo + `CF 6551F` non-crew-solo):
- Root (C-12 DG) → flies 6542F only
- Pilot-F (F-16 DG) → flies 6551F only
- Pilot-B (bomber DG) → flies 6551F only

### Rule F — RETRACTED
Initial hypothesis: "when a main event is single-audience, prereqs drop redundant tags." Falsified by `CF 6530E "C-12 Pilot Boldface (CSO/P/RPA)"` — the word "Pilot" in an event name does NOT imply pilot-only applicability. **Never infer applicability from event-name text; only from explicit parenthetical tags or `applicabilityDetail`.**

### Rule G — Numbered-series prereq collapse (soft rule — MCG defines actual structure)
**Not a hard rule.** The MCG itself defines predecessor relationships; don't infer from numbering alone.

**Tight-serial pattern** (when MCG uses range notation `XX ####-#X`, e.g., `CF 6540-2F`):
- **Position 1** retains the full foundational prereq list (admin/exams/sim/etc.).
- **Position N (N > 1)** has exactly one prereq: position N−1.

**Branching-numbered pattern** (e.g., RPA CF-1 through CF-6):
- Numbering is just a labeling sequence; predecessor relationships are explicit in MCG.
- Example RPA CF structure: CF-1→CF-2 (side branch), CF-1→CF-3→CF-4, CF-3→CF-5, CF-4→CF-6.
- The JSON captures this correctly via explicit single-predecessor links — no collapse needed.

**Rule of thumb**: trust the explicit predecessor links in the MCG. Only apply tight-serial collapse when range notation is used. For non-ranged numbered events, read the MCG structure literally.

**Extractor requirement**: when range notation is present, emit per-event series metadata:
```json
"seriesInfo": { "inSeries": true, "seriesId": "CF 6540-2F", "seriesPosition": 1, "seriesLength": 3 }
```

**Graph-build requirement**: apply the tight-serial collapse only when `seriesInfo` is present AND the MCG range notation confirms it.

### Rule H — Paired flight/control-room exercises
Some exercises have two halves: one flown by pilots, one worked in the control room / tower by non-pilots. Both appear as prereqs on downstream events because each student's audience does their own half.

Pattern:
- Flight side: `(P)` — pilots fly it
- Control/tower side: `(ABM/CSO/FTE/RPA)` — non-pilots work it

Examples:
- `PF 7111C` tower + `PF 7112F` flight (tower flyby)
- Likely: `SY 7511F` + `SY 7512C` (F-16 systems practical), `FQ 9511F` + `FQ 9512C` (T-38 FQ practical)

### Rule I — Two distinct filters with different traversal behavior
| Filter | Visible in UI? | Traverse through? |
|---|---|---|
| Applicability (viewer not in prereq's tag) | No | **No — prune subtree** |
| Big Board track (event not on sheet, e.g., lecture) | No | **Yes — keep walking** |

Rationale:
- Applicability prune: nothing under a non-applicable node matters to the viewer via this edge; shared ancestors will be reached through other applicable edges.
- Big Board hide: the event itself isn't tracked, but downstream flights/exams depend on its ancestors, so traversal must continue.

**Algorithm**:
```
DAG walk from goal event with edge filtering:
  for each prereq edge (event -> prereq):
    if viewer in (main_event.applicability ∩ prereq.nameTag):
      keep edge, visit prereq
    else:
      drop edge, do not visit
After traversal, apply Big Board filter to hide (not prune) events whose code isn't on the sheet.
```

### Rule J — T-38 is the universal pilot trainer
All pilots are crew solo in the T-38 regardless of DG. So `CF 6362F "T-38 CF-3 (P)"` applies to every pilot (including F-16 DG, C-12 DG, bomber DG). The `(P)` tag is not narrowed by DG.

### Rule K — Tower flyby aircraft-selection
Tower flyby flight (`PF 7112F`) is flown in the **F-16 if the pilot is F-16 DG, otherwise T-38**. No other aircraft options.

**Coding implication**: the choice between prereqs `CF 6673F (F-16 CF-4, P crew solo)` and `CF 6362F (T-38 CF-3, P)` is NOT a simple crew-solo filter — it's a pilot-level decision `if F-16 DG → F-16 path else T-38 path`. The JSON schema needs `aircraftChoice` metadata or a "choose-one-of" edge relationship. The same pattern likely recurs on any event where a pilot can fly different aircraft depending on DG.

### Rule L — Parallel aircraft-specific CF events per student role
For a given aircraft, multiple distinct CF events may exist — one per student-role family — each tagged with its applicable audience. Each student follows the CF event matching their role.

**T-38 CF examples**:
- `CF 6362F T-38 CF-3 (P)` — pilots
- `CF 6370F T-38 Flight Training (ABM/CSO/FTE)` — non-pilot non-RPA
- `CF 6804F T-38 CF-4 (RPA)` — RPA
- `CF 6680F F-16 Flight Training (ABM/CSO/FTE/RPA)` — non-crew-solo F-16 aggregate

**Related role-specific variants seen**:
- Closed-book exams: `CF 6340E T-38 Pilot Closed Book Exam (CSO/P/RPA)` vs `CF 6341E T-38 NRA Closed Book Exam (ABM/FTE)` — "NRA" = Non-Rated Aircrew.
- Cockpit sims: `CF 6305S T-38 Cockpit Procedures Training (P)` vs `CF 6304S T-38 Cockpit Familiarization (non-pilot)`.
- Boldface: `CF 6350E T-38 Pilot Boldface (P)` vs `CF 6351E T-38 Mission Support Boldface (non-pilot)`.

**Implication**: when the data shows multiple "flight training" / "cockpit" / "exam" / "boldface" events on the same aircraft, expect role-specific variants. The tag tells you which one applies to the viewer.

---

## 7. Prereq Condition Types

A prereq's `condition` field (when non-null) narrows when the edge applies. Two condition types exist in the current schema:

### 7.1 `forDownstream`

```json
"condition": { "type": "forDownstream", "target": "PF 7111C" }
```

**Definition** (from the coding agent that introduced it):
> This prerequisite isn't needed to start THIS event — it's needed to start a LATER event in the chain. You can do the intermediate events without it, but you can't do the target event until it's done.

**MCG source notation**: prereqs in the MCG PDF carry a bracket annotation `[Req'd for PF 7111C]`. That annotation maps verbatim to `condition.target`.

**Behavior**: acts as an additional pruning filter during DAG traversal.
- If the viewer's chain to the goal passes through `condition.target`, the prereq is required → keep the edge.
- If the viewer's chain does NOT pass through `condition.target` (because the target doesn't apply to the viewer), the prereq is NOT required for this viewer → prune the edge.

**Worked example**: `PF 7102E "Pitot-Statics Exam [Req'd for PF 7111C]"` is listed under `PF 7112F`'s prereqs. Root (P) doesn't do `PF 7111C` (tower side, not in his audience), so this prereq prunes for Root. An ABM student whose chain does pass through `PF 7111C` keeps this prereq.

**Sibling-target quirk**: `condition.target` may name a sibling event rather than a descendant. The target is "the event that actually requires this prereq," not necessarily downstream in the DAG sense.

### 7.2 `datagroup`

```json
"condition": { "type": "datagroup", "values": ["T-38"] }
```

**Definition**: filters the prereq edge by the viewing student's data group. Values seen: `"T-38"`, `"C-12"`, `"F-16"`, `"Learjet"`.

**Behavior**: keep the edge only if the student's DG is in `values`. Otherwise prune.

**Worked example** — `PF 8242F` (DG Accel/Turn Flight 3) lists multiple CF prereqs, each tagged with a DG condition:
- `CF 6370F` conditioned on T-38 DG
- `CF 6542F` conditioned on C-12 DG
- `CF 6673F` conditioned on F-16 DG
- `CF 6403F` conditioned on Learjet DG
- (etc.)

A specific student (e.g., F-16 DG FTE) follows only the F-16-conditioned branches that also match their applicability tag. For F-16 DG FTE: `CF 6680F` (F-16 conditioned + tag includes FTE) applies; all other DG-conditioned prereqs prune.

**Composition with applicability**: a DG-conditioned prereq STILL has its own name-tag applicability filter (Rule A). Both must pass:
1. Student's DG ∈ `condition.values`
2. Student's type ∈ (main-event applicability ∩ prereq name-tag)

### 7.3 (Placeholder) — other condition types may exist
Re-extraction of the MCG may surface additional condition types. Extend this section as they emerge.

**Definition** (from the coding agent that introduced it):
> This prerequisite isn't needed to start THIS event — it's needed to start a LATER event in the chain. You can do the intermediate events without it, but you can't do the target event until it's done.

**MCG source notation**: prereqs in the MCG PDF carry a bracket annotation `[Req'd for PF 7111C]`. That annotation maps verbatim to `condition.target`.

**Behavior**: acts as an additional pruning filter during DAG traversal.
- If the viewer's chain to the goal passes through `condition.target`, the prereq is required → keep the edge.
- If the viewer's chain does NOT pass through `condition.target` (because the target doesn't apply to the viewer), the prereq is NOT required for this viewer → prune the edge.

**Worked example**: `PF 7102E "Pitot-Statics Exam [Req'd for PF 7111C]"` is listed under `PF 7112F`'s prereqs. Root (P) doesn't do `PF 7111C` (tower side, not in his audience), so this prereq prunes for Root. An ABM student whose chain does pass through `PF 7111C` keeps this prereq.

**Sibling-target quirk**: `condition.target` may name a sibling event rather than a descendant. The target is "the event that actually requires this prereq," not necessarily downstream in the DAG sense.

---

## 8. Big Board Display Filter

The graph carries the **full MCG curriculum** (every event). The UI shows only what's operationally tracked.

**Rule**: cross-reference each MCG event code against `fetch_sheet.json`; tag with `onBigBoard: true/false`.
- `onBigBoard: false` → hide the node but **continue traversal** (Rule I).
- `onBigBoard: true` → display.

**Known categories**:
- Academic Lectures (type `A`): not on Big Board → hide.
- MIBs (type `M`): currently on Big Board → show, but user plans future removal. Support a UI filter toggle.
- Flights (`F`), Exams (`E`), Sims (`S`), Control Room (`C`), Reports (`R`, `Y`), Ground Training (`H`), Ground School (`G`): on Big Board → show.
- Asynchronous content (`B`): likely hide (similar to lectures); confirm.

**Source of truth is the sheet, not the type letter.** Use the cross-reference. Type-letter heuristics break (MIBs, for example).

---

## 9. View Modes

The UI supports two view modes (per project spec — confirm with user before building):

- **Student view** — DAG rooted at one chosen goal event for one chosen student. Apply Rule I with viewer = that student's type and DG.
- **Class view** — union of all per-student walks. Node is shown if any student sees it. Each node annotated with which student types include it.

---

## 10. Known Corrections (to apply to data)

### Missing prereq name tags (applicability data loss)
Current JSON omits tags that exist in the MCG PDF. None of these affect a pure-P student like Root, but they break non-pilot chains:

| Code | JSON name | Should read |
|---|---|---|
| CF 5230A | Electronic Flight Bag Training | `(FTC)` |
| CF 5240E | Marshalling Exam | `(CSO/P/RPA)` |
| CF 6305S | T-38 Cockpit Procedures Training | `(P)` |
| CF 6310B | T-38 Ground School CBT | `(FTC)` |
| CF 6320A | T-38 Compressor Stall Prevention | `(FTC)` |
| CF 6330E | T-38 Pilot Open Book Test | `(P)` |
| CF 6340E | T-38 Pilot Closed Book Exam | `(CSO/P/RPA)` |
| CF 6350E | T-38 Pilot Boldface | `(P)` |
| CF 6505S | C-12 Cockpit Procedures Training | `(P)` |
| CF 6510E | C-12 Open Book Exam | `(P, crew solo)` |
| CF 6520E | C-12 Pilot Closed Book Exam | `(P, crew solo)` |
| CF 6530E | C-12 Pilot Boldface | `(CSO/P/RPA)` |

These are likely the tip of the iceberg. A structured MCG re-extraction pass is planned.

**Important pairing note**: CF 6340E `(CSO/P/RPA)` has a parallel **CF 6341E T-38 NRA Closed Book Exam** for ABM/FTE (non-rated aircrew). Similar parallel events exist for cockpit sims (CF 6304S / 6305S) and boldface (CF 6350E / 6351E). Confirm tags on those NRA variants during re-extraction.

### Missing serial links in numbered series
Confirmed gap: `CF 6540F / 6541F / 6542F` all list the same 12 foundational prereqs and none reference each other. Per Rule G, the correct shape is:
- `CF 6541F.prerequisites` → replace with `[CF 6540F]`
- `CF 6542F.prerequisites` → replace with `[CF 6541F]`
- `CF 6540F.prerequisites` → unchanged

Same pattern likely on:
- `PF 8240F / 8241F / 8242F` (DG Accel/Turn Data Flights 1/2/3)
- `CF 6670-6673F` (F-16 CF-1 through CF-4)
- `CF 6360-6362F` (T-38 CF-1 through CF-3) — inferred, not yet verified
- Any other `XX ####-#X` series in the MCG PDF

---

## 11. Upstream Work — MCG Re-extraction

The current extraction has gaps (missing tags, missing series metadata, repeated-prereq redundancy). Plan: re-extract from the MCG PDF in a **structured, section-by-section** pass. Requirements for the new extractor:

1. **Parse parenthetical applicability tags** on every prereq (`(P)`, `(ABM/CSO/FTE/RPA)`, `(P, crew solo)`, `(FTC)`, etc.) and preserve them in the prereq `name` or a structured `nameTag` field.
2. **Parse bracket downstream annotations** (`[Req'd for PF 7111C]`) and emit structured `condition: { type: "forDownstream", target: "..." }`.
3. **Parse range notation** (`CF 6540-2F`) and emit `seriesInfo` on each series member.
4. **Populate `applicabilityDetail`** with `role` (crew-solo, non-crew-solo, or null), `aircraft`, `standardMapping`, and description for aircraft/role-specific events.
5. **Cross-check for redundancy**: if series members share prereq lists, apply the Rule G collapse at graph-build time, not extraction time. Extraction should preserve MCG fidelity.

---

## 12. Open Questions

- **DG → board-type mapping** for Pilot-M, Pilot-B (exact aircraft).
- **Per-student DG determination for FTE/ABM/CSO** — how does the app know which DG a specific FTE is assigned to? Per-student Big Board field, or class-wide roster?
- Does an "ABM-specific" path diverge meaningfully from FTE? What's the difference in practice?
- `forDownstream` origin — is the sibling-target case (e.g., `target: PF 7111C` on a prereq hosted under `PF 7112F`) the intended design or a build-script artifact?
- Exhaustive list of numbered series in MCG 26A (requires PDF audit).
- Full cross-reference of which MCG event codes appear on the Big Board (`fetch_sheet.json`).
- Whether MIBs (e.g., `PF 8310M`, `PF 8330M`) should be implicit prereqs of their paired practicals (`PF 8311F`, `PF 8332F`) — currently NOT in the JSON for either side, consistent but possibly missing a day-of briefing edge.
- Additional condition types beyond `forDownstream` and `datagroup` that may surface during re-extraction.

---

## 13. Worked Examples

### 13.1 — Root's Chain to PF 8332F

Root = C-12 DG pilot. Goal = `PF 8332F` Multi-Engine Performance Practical.

### Direct prereqs of PF 8332F (applying Rule A, viewer = Root)

| Code | Tag | Root? | Why |
|---|---|---|---|
| PF 6121F | none | ✅ | (not yet chased) |
| PF 7111C | (ABM/CSO/FTE/RPA) | ❌ | P not in tag — tower side |
| PF 7112F | (P) | ✅ | flown in T-38 for C-12 DG (Rule K) |
| PF 8242F | none | ✅ | DG Accel/Turn Flight 3 — all DGs fly it (Rule B) |
| TF 6251F | FTC | ✅ | universal C-12 ITC (Rule C) |

### TF 6251F → TF 6241F → CF 6542F (Root's crew-solo C-12 branch)
TF 6251F prereqs for Root: TF 6202B (lecture, hide), TF 6240M (MIB, show-but-future-hide), TF 6241F, PF 8241F.
TF 6241F prereqs for Root: **just CF 6542F** (8 prereqs total; 7 prune via Rule A).
CF 6542F prereqs: the 12 foundational C-12 CF-1 admin/exam/sim events (Rule G implies these attach to CF 6540F, not 6542F directly; currently mis-attached in the JSON).

### PF 7112F (Root flies in T-38 per Rule K)
Prereqs for Root: `CF 6362F` (T-38 CF-3, P) + `PF 8102M` (Takeoff Data MIB).
`CF 6673F` F-16 CF-4 prunes (Root is not F-16 DG).
`PF 7102E` and `PF 7120A` prune (`forDownstream: PF 7111C`, Root doesn't do 7111C).

### 13.2 — RPA Chain to PF 8311F (LJ-25 DG)

RPA's Performance Practical goal is **PF 8311F** (not PF 8332F). The chain is narrower by design — only 2 direct prereqs and no ground school.

```
PF 8311F (CSO/RPA, goal)
├── PF 8301M (Autopilot FCS MIB, CSO/RPA)
│     └── same 4 prereqs as PF 8302F but forDownstream-conditioned
└── PF 8302F (Autopilot FCS Flight, CSO/RPA)
    ├── PF 6121F (T-38 Low L/D Flight — RPA rides T-38 backseat)
    │     └── CF 6804F (T-38 CF-4, RPA) — Rule L, RPA-specific CF event
    │           └── ejection-seat admin + CF 6803F (C-12 CF-3, RPA predecessor)
    ├── PF 7111C (Tower Flyby Tower — RPA works the tower per Rule H)
    ├── PF 8242F (DG Accel/Turn Flight 3 — flown in LJ-25 for RPA, per `datagroup` condition)
    └── TF 6251F (C-12 ITC — universal per Rule C)
```

**Key observations**:
- RPA CF series (CF-1→CF-2, CF-1→CF-3→CF-4, CF-3→CF-5, CF-4→CF-6) is branching, not linear — the MCG defines the actual predecessor links.
- RPA does **CF 6804F**, not the pilot T-38 CF.
- RPA rides backseat in manned aircraft → needs ejection-seat admin chain (CF 5101H/5110H/5140A).
- RPA's DG flight for PF 8242F routes via the `datagroup: ["Learjet"]` conditional prereqs.

### 13.3 — F-16 DG FTE Chain to PF 8332F

FTE shares the pilot goal event (PF 8332F) but works the tower and follows F-16 DG-specific CF training.

```
PF 8332F (ABM/FTE/P, goal)
├── PF 6121F (T-38 Low L/D Flight)
│     └── CF 6370F (T-38 Flight Training, ABM/CSO/FTE) — Rule L
├── PF 7111C (Tower Flyby Tower — FTE works it; Rule H)
├── PF 7112F (pilot flight — PRUNED for FTE)
├── PF 8242F (DG Accel/Turn Flight 3)
│     └── CF 6680F (F-16 Flight Training, ABM/CSO/FTE/RPA) — via `datagroup: ["F-16"]`
│         plus PF 5101A, PF 8110A, PF 8211F (all shared)
└── TF 6251F (C-12 ITC — universal)
```

**Key observations**:
- FTE takes **CF 6370F** T-38 training (not the pilot's CF 6362F or the RPA's CF 6804F).
- F-16 DG FTE takes **CF 6680F** F-16 flight training — the non-crew-solo aggregate event, selected by the `datagroup: ["F-16"]` condition on PF 8242F.
- FTE does the tower half (PF 7111C), not the flight half (PF 7112F) — Rule H.
- FTE would take **CF 6341E (NRA Closed Book Exam)**, not CF 6340E (Pilot Closed Book) — role-specific variant per Rule L.

---

## 14. Agent Posture

When asked about an event or chain:
1. **State the answer based on the current graph + the rules in this document.**
2. **Flag any corrections that apply.** Don't silently compensate — name the gap.
3. **Be explicit about assumptions.** If a ruling depends on the viewer's DG, say so.
4. **Flag new patterns.** If you see a structural shape not captured here, surface it and propose a rule.
5. **Distinguish "what the JSON says" from "what's correct per MCG."** They differ.
6. **Escalate on open questions.** Don't invent DG mappings or crew-solo rules.

## 15. To-do List for Coordinating Agent

1. Fix missing applicability tags on identified prereqs (see §10), including NRA pair tags (CF 6341E, CF 6351E, CF 6304S).
2. Implement series metadata extraction (`seriesInfo`) and Rule G graph-build collapse — only when MCG range notation is present.
3. Implement Rule A + Rule I DAG walk with per-student edge filtering.
4. Implement **`datagroup` condition filter** (§7.2) — composed with applicability filter.
5. Implement **`forDownstream` condition filter** (§7.1).
6. Cross-reference all MCG event codes against `fetch_sheet.json` → add `onBigBoard` tag.
7. Resolve DG → board-type mapping for Pilot-M and Pilot-B. Also resolve per-student DG determination for FTE/ABM/CSO.
8. Re-extract MCG PDF with structured parser per §11 requirements.
9. Clarify `forDownstream` sibling-target semantics (parked).
10. Build view-mode logic (per-student + class union).
11. Audit for additional condition types beyond `forDownstream` and `datagroup` during re-extraction.
