# MCG 26A Graph v1 Audit Report

## Summary Statistics

- **Total events:** 656
- **Events with empty applicability (`[]`):** 420 (64%)
- **Events with non-standard applicability codes:** 88
- **Events with conditional prerequisites (datagroup):** 4
- **Events with student-type-conditional prerequisites:** 19
- **Events with `requiredFor` patterns:** 81
- **Dangling prerequisite references:** 3 (TF 6430A, TF 5301A, TF 5310Y)

---

## 1. Non-Standard Applicability Codes

### FTC (Fixed-wing Test Course) -- 39 events

**Mapping:** FTC = all FTC students = ABM + CSO + FTE + P + RPA

FTC is used in the MCG to mean "all students on the fixed-wing test course" as opposed to STC (Space Test Course). Since the big board tracks FTC students by their individual types (ABM, CSO, FTE, P, RPA), FTC should resolve to all five.

**Action:** Add `applicabilityDetail.standardMapping = ["ABM","CSO","FTE","P","RPA"]` and `applicabilityDetail.tags = ["FTC"]`. Keep `applicability: ["FTC"]` for fidelity to the MCG source.

Events affected:
- CF 5230A Electronic Flight Bag Training
- CF 5231Z Electronic Flight Bag Turn-In
- CF 6201M Glider Familiarization and Solo MIB
- CF 6310B T-38 Ground School CBT
- CF 6320A T-38 Compressor Stall Prevention
- CF 6601G F-16 Ground School
- CF 6602A F-16 Egress Academics
- CF 6603S F-16 Egress
- CF 6610S F-16 Emergency Procedures Simulator
- And 30 more (see full list in v2 JSON)

### STC (Space Test Course) -- 41 events

**Mapping:** STC stays as-is. STC students are a distinct category on the board, not mapped to any FTC student type.

When STC appears alongside standard types (e.g. `["ABM", "FTE", "STC"]`), it means both the listed FTC types AND STC students.

Events affected: 41 events across CF, PF, SY, TF phases.

### US Only -- 33 events

**Mapping:** "US Only" is a nationality restriction, not a student type. It applies on top of whatever student types the event includes. Events marked `["US Only"]` with no other codes apply to all US students regardless of type.

Events affected: AN 5241A, AN 5242A, AN 5250A, AN 5251A, AS 9301A, SY 6121S, SY 6311A, TF 6270M, etc.

### non-US Only -- 1 event

- SY 6122S RADAR Simulator for Uncleared Students: `["non-US Only"]`

**Mapping:** Inverse of US Only. Applies to foreign national students of all types.

### select P, select FTE, select CSO -- 8 events

**Mapping:** "select X" means the event applies to some students of type X at instructor discretion, not all. For filtering purposes, treat as the base type but flag as `"select"`.

Events:
- SY 7503F MQ-9 Systems Practical Exam: `["ABM","CSO","RPA","select FTE","select P"]` -- goal event
- SY 7212F F-16 Weapons Delivery Flight: `["CSO","select P","RPA"]`
- SY 7222F F-16 Weapons Domain Integration Flight: `["select P"]`
- SY 7223C F-16 Weapons Domain Integration Control Room: `["select CSO","FTE"]`
- And 4 more MQ-9 practical events

### STC as DE -- 1 event

- SY 7213C F-16 Weapons Delivery Control Room: `["ABM","FTE","STC as DE"]`

**Mapping:** STC student participating as Designated Examiner. Keep as-is, add to tags.

---

## 2. Conditional Prerequisites (Datagroup-Dependent)

4 events have prerequisites conditioned on the student's data group (T-38, C-12, Learjet, or F-16). Each has 7 conditional prereqs.

### PF 6230F -- Data Group Aerodynamic Modeling Data

| Prereq | Condition |
|--------|-----------|
| CF 6370F T-38 Flight Training | T-38 Data Group |
| CF 6403F Learjet CF-2 | Learjet Data Group |
| CF 6542F C-12 CF-3 | C-12 Data Group |
| CF 6550F C-12 Flight Training | C-12 Data Group |
| CF 6621C Control Room Familiarization | Learjet Data Group |
| CF 6673F F-16 CF-4 | F-16 Data Group |
| CF 6680F F-16 Flight Training | F-16 Data Group |

### PF 8240F -- Data Group Level Accel/Turn Perf Data Flight 1

Same 7 conditional prereqs as PF 6230F.

### PF 8241F -- Data Group Level Accel/Turn Perf Data Flight 2

Same 7 conditional prereqs.

### PF 8242F -- Data Group Level Accel/Turn Perf Data Flight 3

Same 7 conditional prereqs.

---

## 3. Student-Type-Conditional Prerequisites

19 events have prerequisites that apply only to certain student types. The condition is currently buried in the `notes` field.

### Pattern: P vs ABM/CSO/FTE/RPA (crew-solo distinction)

6 events use the "P, crew solo" / "ABM/CSO/FTE/RPA" / "P, non-crew solo" triple pattern for F-16 prerequisite flights:

- **FQ 7231C** F-16 Structures Envelope Expansion Control Room
- **FQ 9231F** F-16 Departure Demo Flight
- **SY 6130M** F-16 Sensors Flight MIB
- **SY 6131F** F-16 Sensors Flight
- **SY 6132R** F-16 Sensors Flight Written Report

For each, the prereqs are:
- CF 6673F (F-16 CF-4) for P crew-solo
- CF 6680F (F-16 Flight Training) for ABM/CSO/FTE/RPA
- CF 6681F (F-16 Flight Training) for P non-crew-solo

### Pattern: P vs ABM/CSO/FTE vs RPA (aircraft prereq by type)

- **FQ 6251F** T-38 Dynamics Flight: CF 6362F for P, CF 6370F for ABM/CSO/FTE, CF 6804F for RPA
- **FQ 9221F** T-38 Stall Flight: CF 6362F for P, CF 6804F for RPA
- **FQ 8141F** T-38 Handling Qualities Flight: CF 6701F for P, CF 6806F for RPA

### Pattern: P/RPA vs ABM/CSO/FTE

- **FQ 8181F** VISTA Handling Qualities Flight: FQ 8141F for P/RPA, FQ 8160F for ABM/CSO/FTE
- **FQ 8202F** T-38 HQ Test Plan Data Flight: FQ 8141F for P/RPA, FQ 8160F for ABM/CSO/FTE

### Pattern: CSO/P/RPA vs ABM/FTE

- **FQ 6310F** T-38 FQ Test Plan Data Flight 1: FQ 6251F for CSO/P/RPA, FQ 6252C for ABM/FTE
- **FQ 6311F** T-38 FQ Test Plan Data Flight 2: same

### Other

- **FQ 6241F** C-12 Static Stability Flight: TF 6251F conditional on FTC
- **CF 6680F** F-16 Flight Training: CF 6610S req'd for P only
- **FQ 9245C** F-16 High AOA Envelope Expansion Control Room: FQ 6252C and PF 8221C conditional on ABM/FTE

---

## 4. Alternative Prerequisites ("or" pattern)

2 events in the SY phase have "or" alternatives in prereq notes:

- **SY 7511F** F-16 Systems Practical Exam Flight:
  - SY 7212F "or SY 7222F or SY 7304F"
  - SY 7213C "or SY 7223C or SY 7305C"

These should be structured as `condition.type = "alternative"`.

---

## 5. `requiredFor` Patterns (Downstream Requirements)

81 events have prerequisites with `requiredFor` pointing to a different event code. This means "this prereq is needed not for the current event, but for a specific downstream event."

Major patterns:
- Tower flyby events (PF 7110M/7111C/7112F): some prereqs target PF 7111C, others PF 7112F
- Performance practical chain: prereqs target PF 8211F, PF 8221C, PF 8222F, PF 8231F, PF 8302F, PF 8311F, PF 8332F
- Flying Qualities chain: prereqs target FQ 6221F, FQ 6241F, FQ 6251F, FQ 6321R, FQ 8121F, etc.
- Systems chain: prereqs target SY 6131F, SY 7211S, SY 7222F, SY 7502S, SY 7511F

**Action:** Convert to `condition.type = "forDownstream"` with `target` field.

---

## 6. Empty Applicability Assessment

Of the 420 events with `[]` applicability:

### Correctly empty (apply to all students) -- ~370 events

Most academic lectures, exams, debriefs, and MIBs in the AN, PF, FQ, TF, TL, AS phases genuinely apply to all students. These are theory courses, written exams, and lectures that everyone attends.

### Potentially incorrect -- ~50 events

Events where the name, description, or prereq structure suggests specific applicability:

**CF phase (18 empty):** Most are ground training that genuinely applies to all (Life Support, Safety, DAS, CRM). These are correct as empty. However:
- CF 6301G T-38 Systems Refresher/Ground School: all students attend, correct as empty
- CF 6501G C-12 Ground School: all students attend, correct as empty
- CF 6620B Control Room Ground School: all students attend, correct as empty
- CF 6621C Control Room Familiarization: all students attend, correct as empty

**PF phase (35 empty):** Theory lectures and exams apply to all. Correct as empty.

**FQ phase (69 empty):** Theory lectures apply to all. Correct as empty.

**TF phase (82 empty):** Most are lectures/exams for all students. Two goal events are correctly empty:
- TF 9102E Comprehensive Written Exam: all students take this
- TF 9111E Comprehensive Oral Exam: all students take this

**SO phase (16 empty):** Astronautics lectures apply to all. SO 6241O "Aerocube Crew Solo" -- name says "crew solo" but the event has `[]` applicability. Worth verifying if this is truly for all students.

**TL phase (31 empty):** Test leadership lectures for all students. Correct as empty.

### Recommendation

The vast majority of empty applicability events are correct. The extraction was good about marking specific applicability where the MCG specified it. No bulk corrections needed. The few questionable events (SO 6241O, some MIBs) should be verified against the MCG PDF if high fidelity is needed, but are low-risk for front-end filtering.

---

## 7. Other Structural Issues

### Dangling prerequisites (3 codes)

| Code | Referenced by | Issue |
|------|--------------|-------|
| TF 6430A | 6 events | Not in the MCG event list. Likely a renumbered or removed event. |
| TF 5301A | 1 event | Same |
| TF 5310Y | 1 event | Same |

**Action:** Keep in v2 but flag in `_meta.danglingPrereqRefs`.

### Duplicate event names

Several events share the same name but have different codes and applicability:
- "F-16 Flight Training" -- CF 6680F (ABM/CSO/FTE/RPA) and CF 6681F (P)
- "C-12 Flight Training" -- CF 6550F (ABM/CSO/FTE) and CF 6551F (P)
- "C-12 Cockpit Procedures Training" -- CF 6504S (CSO/RPA) and CF 6505S (P)

These are intentional -- different blocks for different student types. Not a data issue.

### Event-level `notes` field not carried to graph

The phase JSON files have event-level `notes` fields (e.g., `"select P"`, `"P, crew solo"`, `"P, non-crew solo"`) that the v1 builder drops. These contain useful role/selection information.

**Action:** v2 builder should carry these through, either into `applicabilityDetail.notes` or a new `eventNotes` field.

### `+ 5 days` timing constraint

PF 8210M and PF 8211F have a prereq note `"+ 5 days"` on PF 8202E, meaning the Energy Exam must be completed 5+ days before the Level Accel/Turn Perf event. This is a scheduling constraint, not a filtering issue.

**Action:** Preserve in `condition.notes` for human reference.
