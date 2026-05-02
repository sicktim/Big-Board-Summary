# MCG 26A V2 Extraction Notes

Flagged items for human review. Organized by phase. Verbatim MCG text is preserved in JSON where the MCG itself is ambiguous; this document surfaces parser judgment calls, MCG source drift, and fixes applied during review.

Generated: 2026-04-20. Revised: 2026-04-21 (reflects review-pass fixes). Source: `MCG 26A.pdf` (text-extracts dump).

---

## Review-pass fixes applied (2026-04-21)

Changes made after mcg-curriculum-expert review passes, per user rulings:

1. **Schema normalization** across all 9 phases. Every event carries the same top-level keys; every prereq carries `{code, name, nameTag, nameTagRole, nameTagAircraft, condition, group}`. Previously some phases (SY especially) used string-form `nameTag` or nested `applicabilityDetail` inside prereqs.
2. **SY 79 string-form nameTags normalized to arrays** via canonical mapping (e.g., `"(FTC)"` → `["ABM","CSO","FTE","P","RPA"]`). SY 4 prereqs with nested `applicabilityDetail` migrated to `nameTagRole` / `nameTagAircraft`.
3. **SO phase scoped to STC only** (per MCG p.38 preamble). All 16 SO events now carry `applicability: ["STC"]` with description "STC only".
4. **TF 6430B → TF 6430A**: event renamed from type B (Async) to type A (Academic Lecture) to match the 6 downstream prereq citations that referenced TF 6430A. MCG source declared the event with the wrong suffix.
5. **TF 5320A prereq typo fix**: `TF 5310Y` → `TF 5311Y` (MCG typo; canonical event is TF 5311Y).
6. **TF 5301A dangling prereq preserved as-is**: no matching event exists in MCG 26A; remains a dangling reference per user ruling (the MCG citation is preserved verbatim).
7. **FQ 7221I `eventTypeName`** → "Ground Test" (matches MCG front-matter suffix-I label).
8. **DE clarification notes** added to FQ 6252C, FQ 9247C, SY 7213C. DE = Disciplined Engineer (control-room role per MCG p.87 prose), NOT Directed Energy.
9. **Invented `role` values dropped** (→ null): `non-pilot` (6 events), `execute-primary` (1), `mission-support` (1), `non-rated-aircrew` (1), `wso-msf` (1). Each event's applicability was verified correct; the `role` meta-label was redundant with the audience filter. Kept KB-legit values: `crew-solo` (12), `non-crew-solo` (4), `select P` (6), `select` (2), `optional` (2).
10. **"or" alternative prereqs structured** with new `group` field (`kind: "oneOf"`). Applied to 5 oneOf groups covering 16 hosting events:
    - `SY-7511F-flight`: SY 7212F / SY 7222F / SY 7304F (4 hosts: SY 7510M/7511F/7512C/7513Y)
    - `SY-7511F-cr`: SY 7213C / SY 7223C / SY 7305C (same 4 hosts)
    - `FQ-6230F-glider`: CF 6203F / CF 6215F (1 host)
    - `FQ-9211F-glider`: CF 6203F / CF 6215F (2 hosts: FQ 9210M/9211F)
    - `FQ-9245C-cr-intro`: FQ 6252C / TF 6231C (9 hosts: FQ 9240M–9248Y)

## Remaining dangling prereqs (1)

| Dangling code | Referenced in | Status |
|---|---|---|
| `TF 5301A Introduction to Space Systems Testing (STC)` | `TF 5320A` | Orphan citation in MCG 26A. Preserved as-is per user ruling — no matching event exists anywhere in the 26A source. Likely a 25A legacy event that was removed from 26A without updating TF 5320A's prereq list. Downstream graph-build may choose to drop the edge or flag as incomplete. |

---

## Cross-phase / source drift

### Dangling prereq codes — historical (post-fix state is in top-of-document summary)

Three MCG source drifts were flagged in the initial extraction. Two were resolved at review time per user ruling; one remains.

| Dangling code | Referenced in | Ruling | Post-fix state |
|---|---|---|---|
| `TF 5301A Introduction to Space Systems Testing (STC)` | `TF 5320A` | Leave verbatim | **Still dangling.** No TF 5301A event declaration exists in MCG 26A. `CF 5301A Crew Resource Management` is unrelated. Graph-build layer owns handling. |
| `TF 5310Y Test Policy Oral Report (STC)` | `TF 5320A` | **Remap** | Fixed. Prereq citation updated to `TF 5311Y` (MCG typo; only hundreds-digit differs). |
| `TF 6430A Deficiency Reports Lecture` | `TF 5230M`, `TF 5231S`, `SY 5101A`, `SY 5102L`, `SY 5103R` + 1 | **Rename event** | Fixed. Event declaration (formerly `TF 6430B`, type B Async) renamed to `TF 6430A` (type A Academic Lecture). MCG source declared the event with the wrong suffix; the 6 downstream citations were correct. |

### Events in V1 but removed in V2

- `FQ 8203F` — not present in the MCG 26A text at all. Likely a 25A→26A removal. V1 had it; V2 correctly excludes it.

### Events newly captured in V2 (not in V1) — 13 total

12 from TF-phase series that V1 failed to expand from range notation:
- `TF 7210G` — `TF 7215G` (6 events, series `TF 7210-15G`)
- `TF 7220F` — `TF 7225F` (6 events, series `TF 7220-25F`)

Both series use **step-by-1** numbering within a range bounded 10 apart (TF 7210-15 spans 7210 through 7215). Same structure used in TL 8110-70A (see TL notes).

1 from the TF 6430B → TF 6430A rename:
- `TF 6430A Deficiency Reports Lecture` — event declaration suffix fixed per review ruling. V1 had TF 6430B; V2 has TF 6430A.

---

## AN — Ancillary Training (49 events)

- `AN 5241A`, `AN 5242A`, `AN 5250A`, `AN 5251A` carry `(US Only)` in the event name. Per knowledge base §4 this is a **security restriction**, not a student-type applicability filter. `applicability: []` (all students), with `eventNotes` recording the security restriction.
- No prereqs, descriptions, or applicability tags on any AN event — the MCG lists them as a bare roster on page 14.

## AS — Astro Sciences (84 events)

- **Phase-wide `(STC Only)` applicability** declared on MCG p.42. All 84 events carry `applicability: ["STC"]`. No individual-event tag found anywhere.
- **New event-type suffixes** not in knowledge base §3:
  - `W` — Working Group (AS 6202W, AS 7314W). Knowledge base §3 lists W in the front-matter table as "Working Group" but does not show it in the type-suffix list. Added to eventTypeName labels.
  - `L` — Lab (AS 6411L, AS 7103L, AS 7112L, AS 7130L, AS 7302L, AS 9210L). Same situation — present in MCG front-matter table but not in KB §3 type list.
  - `O` — Space Operation (AS 6221O, AS 7150O). Already seen in SO phase.
- **AS 7140S vs AS 7150O prereq boundary ambiguity** (MCG p.51–52): four lecture codes (`TF 6102A`, `TF 6201A`, `TF 6320A`, `TF 6401A`) appear between AS 7140S's explicit prereqs and AS 7150O's declaration, with no `Prerequisites:` header. Parser attached them to AS 7140S. They may belong to AS 7150O; needs user ruling.
- **Prereq name drift**: prereqs cite `AS 7101A Satellite Systems Review` but canonical event name is `AS 7101A Satellite Systems Review Lecture`. Preserved verbatim.
- **AS 8110A self-reference**: description refers to "the building blocks from AS 8110A" (itself). Preserved.
- **Bare event names**: `AS 7102E Assessments`, `AS 7103L Lab`, `AS 7104Z Debrief` (p.50). MCG provides only the suffix-word as the name; preserved as-is.

## CF — Check Flight (97 events)

### Range notations expanded (9 series)

| Range | Expanded | Aircraft / role |
|---|---|---|
| `CF 6110-4F` (5) | CF 6110F – CF 6114F | C-172 Airmanship FA-1-5 (ABM/FTE) |
| `CF 6120-1F` (2) | CF 6120F, CF 6121F | C-172 Airmanship CA-1-2 (CSO) |
| `CF 6202-3F` (2) | CF 6202F, CF 6203F | Glider Familiarization (ABM/CSO/FTE/select P/RPA) |
| `CF 6210-5F` (6) | CF 6210F – CF 6215F | Glider Familiarization and Solo (select P) |
| `CF 6360-2F` (3) | CF 6360F – CF 6362F | T-38 CF-1-3 (P) |
| `CF 6402-3F` (2) | CF 6402F, CF 6403F | Learjet CF-1-2 (ABM/CSO/RPA) |
| `CF 6540-2F` (3) | CF 6540F – CF 6542F | C-12 CF-1-3 (P, crew solo) |
| `CF 6670-3F` (4) | CF 6670F – CF 6673F | F-16 CF-1-4 (P, crew solo) |
| `CF 6801-2F` (2) | CF 6801F, CF 6802F | C-172 CF-1-2 (RPA) |

### `(P, crew solo)` events captured

C-12: CF 6510E, CF 6520E, CF 6540F, CF 6541F, CF 6542F  
F-16: CF 6630E, CF 6640E, CF 6660S, CF 6670F, CF 6671F, CF 6672F, CF 6673F

### Non-crew-solo (mutually exclusive partner) events

CF 6521E, CF 6551F, CF 6641E, CF 6681F — `applicabilityDetail.role = "non-crew-solo"` per Rule E.

### Knowledge base §10 "missing tags" — status in MCG 26A text

All §10-predicted missing tags are actually **present** in the MCG 26A source text. §10 was describing gaps in the V1 JSON / 25A data, not in the 26A MCG source. The V2 extraction preserves them correctly:
- CF 5230A `(FTC)`, CF 5240E `(CSO/P/RPA)`, CF 6305S `(P)`, CF 6310B `(FTC)`, CF 6320A `(FTC)`, CF 6330E `(P)`, CF 6340E `(CSO/P/RPA)`, CF 6350E `(P)`, CF 6505S `(P)`, CF 6510E `(P, crew solo)`, CF 6520E `(P, crew solo)`, CF 6530E `(CSO/P/RPA)`.
- NRA pair: `CF 6304S` tagged `(ABM/CSO/FTE/RPA/STC)` in 26A text (not just `(ABM/FTE)` as §10 surmised).

### CF 6660S pseudo-cycle

`CF 6660S F-16 Emergency Procedures Checkout (P, crew solo)` lists `CF 6672F F-16 CF-3 (P)` as prereq, yet `CF 6660S` itself appears inside the `CF 6670-3F` series prereq list with `[req'd for CF 6673F]`. This creates a pseudo-cycle in the F-16 CF-1→CF-4 chain: CF 6672F → CF 6660S → CF 6673F. The `forDownstream: CF 6673F` condition keeps CF 6660S from being required before CF-1/2/3. Preserve verbatim; graph-build will need to handle this.

### Mixed-audience crew-solo narrowing

`CF 6521E` is tagged `(ABM/CSO/FTE/P, non-crew solo/RPA)` — the `non-crew solo` qualifier applies only to the `P` audience within an otherwise-open list. Parsed as `applicability: [ABM, CSO, FTE, P, RPA]` with `applicabilityDetail.role = "non-crew-solo"` documenting the P-specific narrowing. Same pattern on `CF 6641E`.

### `select P` as a role qualifier

CF 6202-3F and CF 6210-5F use `(select P)` per KB §4. Parsed as applicability containing `P` with `applicabilityDetail.role = "select P"`.

### Unusual `forDownstream` target sentinels

- `[req'd for all]` — appears on several prereqs feeding multi-audience events (e.g., AN 5130A on CF 5101H). Encoded as `condition: { type: "forDownstream", target: "all" }` — sentinel rather than a specific event code. **May warrant a distinct condition type** in the schema.
- `[req'd for P]` — on `CF 6610S`'s citation from `CF 6680F`. Encoded as `target: "P"` (audience sentinel).

### Source-text drift
- `CF 6120-1F` description references "CF 6110-14F" rather than the correct "CF 6110-4F". Preserved verbatim.

## FQ — Flying Qualities (95 events)

### Range notation
- `FQ 6310-1F T-38 Flying Qualities Test Plan Data Flight 1-2` → FQ 6310F + FQ 6311F. Only range in FQ.

### New event-type suffixes
- `W` — Working Group (FQ 6320W, 9241W, 9242W, 9243W).
- `I` — Ground Integration Test (FQ 7221I). Single occurrence.

### Applicability drifts
- **FQ 9221F**: event declared `(P/RPA)` on p.101, but downstream citations (FQ 8180M, FQ 9240M) reference it as `(P)`. Event applicability preserved as `[P, RPA]`; prereq citations kept `(P)` as written.
- **FQ 9231F name drift**: event declared "F-16 Departure Demo Flight", prereq FQ 9240M cites "F-16 Departure Flight" (no "Demo").
- **FQ 6321R**: suffix `R` (Written Report) but event name says "Oral Report". Preserved.
- **FQ 9501M**: no prereq line in MCG — emitted with empty prereqs.

### Unusual prereq annotations
- `[Hour 4]` annotation on FQ 6201A and FQ 8101A prereq citations — does NOT match `forDownstream` or `datagroup` schema. Kept inside the prereq `name` string as a descriptor; no `condition` emitted.
- `"Desired as DE"` supporting-role descriptors on FQ 6252C, FQ 9247C — treated as notes; applicability kept to primary `(ABM/FTE)`.
- **"or" alternative prereqs** — CF 6203F / CF 6215F on FQ 6230F and FQ 9210-1; FQ 6252C / TF 6231C on FQ 9245C-series. Captured all branches in `prerequisites` with `nameTag` filters; flagged in `eventNotes`. Downstream grapher needs a "one-of" relationship concept.

## PF — Performance (57 events)

### Range notation
- `PF 8240-2F` → PF 8240F, PF 8241F, PF 8242F (Data Group Level Accel/Turn Perf Data Flights 1-3).

### Goal events — both captured with full prereqs
- `PF 8311F` (C-12 Performance Practical — CSO/RPA)
- `PF 8332F` (Multi-Engine Performance Practical — ABM/FTE/P)

### Flags
- **Shared-description drift**: PF 8230M/PF 8231F description block is verbatim identical to PF 8222F/PF 8221C's block, even though event names differ (T-38 Level Accel/Sawtooth Climbs vs T-38 Turn Performance). Likely an MCG copy-paste artifact. Flagged in `eventNotes`.
- **`req` vs `req'd` inconsistency** on PF 8332F: TF 6251F cites `[req for PF 8332F]` (no apostrophe, no 'd') — unique in 26A. Parsed as `forDownstream`.
- **PF 8302F prereqs** on p.79 list `PF 8242F` without tag/bracket, despite that flight being datagroup-conditioned elsewhere. Preserved as listed.
- **PF 8340R vs PF 8341R** share identical event name (`Multi-Engine Performance Practical Written Report`) with tags `(P)` vs `(ABM/FTE)`. Role-specific variants per Rule L. Both emitted separately.
- **PF 6120M Low L/D MIB** has no prereqs and no description block — emitted empty per source.
- **`+ 5 days` timing constraint** on `PF 8202E Energy Exam` prereq line preserved verbatim in prereq name; no dedicated schema field.

## SO — Space Operations (16 events)

### Range notation
- `SO 6130-2S GROOT Supervised Exploration and Check-ride Prep SO-1-3` → SO 6130S, SO 6131S, SO 6132S.

### Flags
- `SO 6220H SOCR Display Familiarization` — MCG prereq citation says `SO 6220H Aerocube Display Familiarization` (name drift). Preserved verbatim.
- `SO 6241O Aerocube Crew Solo` — `Crew Solo` is part of the event name (descriptive label), NOT an applicability role tag. Per Rule F, never infer applicability from event name text.
- No parenthetical student-type tags anywhere in SO phase.

## SY — Mission Systems (96 events)

### Goal events captured
SY 7503F, SY 7511F, SY 7512C, SY 7521O — all present.

### No range notation in SY
All numeric clusters are grouped-declaration (shared description across consecutive codes), not range notation. No `seriesInfo` populated for any SY event.

### `select P` / unusual applicability tags

| Tag | Events |
|---|---|
| `(CSO/select P/RPA)` | SY 7212F |
| `(ABM/FTE/STC as DE)` | SY 7213C — "STC as Directed Energy role" |
| `(select P)` | SY 7222F |
| `(select CSO/FTE)` | SY 7223C |
| `(ABM/CSO/RPA, select FTE/P)` | SY 7501M, SY 7502S, SY 7503F (goal) |
| `(ABM/CSO/RPA select FTE/P)` | SY 7504Y — missing comma in source |
| `(FTE/P)` | SY 7510M, SY 7513Y |

### Flags
- Prereq name drifts in SY 5210S (`Data-Driven Analysis and Control` vs canonical `Decision Making`), SY 7401E (`Remotely Piloted Aircraft (RPA) and Autonomy` vs `Testing Unmanned Platforms`), SY 7501M (extra "and" before "Integration").
- Explicit "`or`" conjunctions in prereqs of SY 7510M/7511F/7512C/7513Y between three flight alternatives and three control-room alternatives. Captured as sibling prereq entries; **downstream graph needs a "one-of" relationship concept**.
- SY 8501E/8502Z have no narrative description block in MCG — description field empty.

## TF — Test Foundations (142 events)

### Range notations
- `TF 7210-15G` → TF 7210G–TF 7215G (6 Experience Broadening Qual Eval Ground School events).
- `TF 7220-25F` → TF 7220F–TF 7225F (6 matching flight events). Each flight prereqs its matching-numbered ground school.

### Universal / goal events captured
- `TF 9102E` (Comprehensive Written Exam — all)
- `TF 9111E` (Comprehensive Oral Exam — all)
- `TF 6251F` (C-12 ITC, FTC universal — Rule C)
- `TF 6241F` (C-12 Airborne Test Conduct Intro, FTC universal)
- `TF 6202B` (Performance Test Conduct Lecture)
- `TF 6231C` (F-16/Control Room Test Conduct Intro)

### Unusual applicability tags / roles

| Tag | Event | Interpretation |
|---|---|---|
| `(ABM/FTE execute, CSO/P/RPA observe)` | TF 6231C | `applicability: [ABM, FTE]`, `role: "execute-primary"`; observers noted in eventNotes. |
| `(optional for P/RPA)` | TF 5520F | `role: "optional"` |
| `(optional flight for CSO/P/RPA)` | TF 6232F | `role: "optional"` |
| `(select STC)` | TF 6271C, TF 6272F | `role: "select"` |
| `(ABM/FTE/STC)` | TF 6220M, TF 6221C | Mixed standard-subset + STC track. |
| `(US Only STC)` | TF 6502A | Security restriction + STC — compound tag. |
| `(ABM/CSO/RPA, select FTE/P)` | SY-prereq inside TF | `nameTagRole: "select-for-FTE-P"` |

### Dangling prereq references (see top of document)
- `TF 5301A` (orphan) referenced by TF 5320A.
- `TF 5310Y` (typo for TF 5311Y) referenced by TF 5320A.
- `TF 6430A` (should be TF 6430B — type suffix drift) referenced 6× from SY and TF.

### Flags
- **`forDownstream` target phrase** (not an event code): `TF 7401C` has a prereq conditioned on `"US Only Control Rooms with Special Access Programs"`. Preserved as a descriptive sentinel; needs condition-type extension.
- **Missing "TF" prefix** on forDownstream target: `TF 8201F TMP Data Flights/Events [req'd for 8302W]` — target parsed as `TF 8302W` (prefix inferred).
- **TF 6240M description** ends mid-sentence: `"...FQ 6241F C-12 S"` — source truncation. Preserved.
- **TF 9111E's Prerequisites list** wraps across pages 161→162 under the same header. Parser combined all 15 into one list.
- **TF 6140A/6141A prereq** cites `"TF 5320A Test and Evaluation Master Plan (TEMP) Development (STC)"` — drift vs canonical `"TF 5320A TEMP Development and Strategic Planning"`.

## TL — Test Leadership (31 events)

### Range notations — non-standard step-by-10

Both TL series step by 10 within the numeric range rather than by 1:
- `TL 8110-70A Case Study Seminar 2-8` → TL 8110A, TL 8120A, TL 8130A, TL 8140A, TL 8150A, TL 8160A, TL 8170A (7 events).
- `TL 8111-71Y Case Study Report 2-8` → TL 8111Y, TL 8121Y, TL 8131Y, TL 8141Y, TL 8151Y, TL 8161Y, TL 8171Y (7 events).

**Needs knowledge base update.** KB §3 describes range notation as step-by-1. TL 8100 module uses step-by-10 instead. Verified expansion against the "2-8" counts from MCG prose.

### Flags
- **TL 7201B prereq is `TPS Enrollment`** — not an event code. Stored `prerequisites: []` with `eventNotes` explaining.
- **TL 7210A prereq citation drift**: MCG cites `TL 7201B Intro to Computer Science` (its actual name) but event itself is declared with eventType `B` (asynchronous content) — no conflict, just noting.
- **No applicability tags anywhere in TL** — whole-class curriculum. Default `applicability: []`.
- Every TL event has only `AN 5190A Test Leadership Phase Intro` as its gatekeeper prereq, plus internal sequencing (e.g., TL 7210A → TL 7220A).

---

## Schema / process recommendations surfaced by extraction

1. **Add condition type beyond `forDownstream`/`datagroup`** to handle:
   - `[req'd for all]` / `[req'd for P]` — audience sentinel targets (CF phase)
   - `[req'd for "US Only Control Rooms with Special Access Programs"]` — descriptive phrase target (TF phase)
   - `[Hour 4]` — timing/sequence constraint (FQ phase)
   - `+ 5 days` — delay-after constraint (PF phase)

2. **Add "one-of" prereq relationship** for explicit `or` alternatives in MCG prose (FQ, SY). Current schema forces sibling edges that all pass Rule A, but the actual semantics is "pick one".

3. **Event-type suffix table in KB §3 is incomplete.** Add: `W` (Working Group), `L` (Lab), `I` (Ground Integration Test), `O` (Space Operation — already in SO but should be in the list).

4. **Knowledge base §10 "missing tags" table is for 25A.** All those tags are present in 26A source text. V2 extraction captures them correctly.

5. **Range notation step size** is not always 1. TL 8110-70A uses step-by-10. Document this in KB §3.

6. **Role qualifiers** beyond `crew-solo`/`non-crew-solo`: `select P`, `select STC`, `select FTE/P`, `optional`, `execute-primary` with observer audience. Consider standardizing role vocabulary.

7. **MCG source drift** (typos, name drifts, type-suffix mismatches) is common enough that a dedicated validation pass cross-checking prereq citations against canonical event declarations would be valuable.
