# Prerequisite Notes Audit - MCG 26A

Builder version: 0.3.0
Audit date: 2026-04-17

## Summary

All prerequisite notes across all 9 raw phase JSON files have been audited. Every conditional pattern found is accounted for in the v2 builder's `parseCondition()` function.

## Condition Types in v2 JSON (post-build stats)

| Type | Count | Description |
|------|-------|-------------|
| unconditional | 1105 | No condition -- prereq applies to all students |
| forDownstream | 300 | Prereq feeds a specific downstream event |
| studentType | 40 | Prereq conditional on student type (P, RPA, etc.) |
| datagroup | 28 | Prereq conditional on data group assignment (T-38, C-12, F-16, Learjet) |
| alternative | 8 | Prereq is one of several alternatives ("or SY 7222F or SY 7304F") |

## Event-Level Notes (24 events total)

These notes qualify the event's applicability, not a specific prerequisite.

### "select P" (8 events)
CF 6202F, CF 6203F, CF 6210F-6215F -- Glider familiarization/solo flights.
Only select pilots at instructor discretion. All other types (ABM/CSO/FTE/RPA) are in the main applicability.

**v2 handling:** `applicabilityDetail.role = "select"`, `aircraft = "Glider"`

### "P, crew solo" (12 events)
- C-12: CF 6510E, CF 6520E, CF 6540F, CF 6541F, CF 6542F
- F-16: CF 6630E, CF 6640E, CF 6660S, CF 6670F, CF 6671F, CF 6672F, CF 6673F

Pilots assigned to the aircraft's crew-solo data group only.

**v2 handling:** `applicabilityDetail.role = "crew-solo"`, `aircraft` derived from event name

### "P applicability is non-crew solo" (2 events)
- CF 6521E (C-12 MA Closed Book Exam)
- CF 6641E (F-16 MA Closed Book Exam)

All types do this event, but pilot applicability is restricted to non-crew-solo pilots.

**v2 handling:** `applicabilityDetail.role = "non-crew-solo"`, full `standardMapping` array

### "P, non-crew solo" (2 events)
- CF 6551F (C-12 Flight Training)
- CF 6681F (F-16 Flight Training)

Pilots NOT in the crew-solo data group for that aircraft.

**v2 handling:** `applicabilityDetail.role = "non-crew-solo"`, `aircraft` derived from event name

## Prerequisite-Level Notes -- Conditional Patterns

### "req'd for [aircraft] Data Group" (28 occurrences)

Found on: PF 6230F, PF 8240F, PF 8241F, PF 8242F

Aircraft groups: T-38, Learjet, C-12, F-16

**v2 handling:** `condition.type = "datagroup"`, `values = ["T-38"]` etc. -- correctly structured.

Cross-reference with raw data confirms accuracy:
- `CF 6370F` -> T-38 Data Group (correct: event is T-38 Flight Training for ABM/CSO/FTE)
- `CF 6403F` -> Learjet Data Group (correct: Learjet CF-2)
- `CF 6542F` -> C-12 Data Group (correct: C-12 CF-3, crew solo)
- `CF 6550F` -> C-12 Data Group (correct: C-12 Flight Training)
- `CF 6621C` -> Learjet Data Group (correct: Control Room Familiarization for Learjet)
- `CF 6673F` -> F-16 Data Group (correct: F-16 CF-4, crew solo)
- `CF 6680F` -> F-16 Data Group (correct: F-16 Flight Training for ABM/CSO/FTE/RPA)

### Student type filters on prerequisites (40 occurrences)

Patterns: "P", "RPA", "ABM/CSO/FTE", "ABM/CSO/FTE/RPA", "CSO/P/RPA", "P/RPA", "ABM/FTE", "FTC", "P, crew solo", "P, non-crew solo", "ABM/CSO/FTE/select P/RPA"

**v2 handling:** `condition.type = "studentType"` with parsed `values` array. All patterns are matched by the regex in `parseCondition()`.

### Alternative prerequisites (8 occurrences)

Pattern: "or SY 7222F or SY 7304F" and "or SY 7223C or SY 7305C"
Found on: SY 7510M, SY 7511F, SY 7512C, SY 7521O

**v2 handling:** `condition.type = "alternative"`, `anyOf = ["SY 7222F", "SY 7304F"]` etc.

### Downstream requirements -- bracketed (many occurrences)

Pattern: `[req'd for TF 6264F]`, `[req'd for TF 5502F]`, etc.
Found across TF phase extensively.

**v2 handling:** `condition.type = "forDownstream"`, `target = "TF 6264F"` etc.

### "req'd for P" (2 occurrences)

On prereq CF 6610S (F-16 Emergency Procedures Simulator) for events CF 6680F and CF 6681F.

**v2 handling:** `condition.type = "studentType"`, `values = ["P"]`

### "+ 5 days" (2 occurrences)

Timing constraint on PF 8202E (Energy Exam) for PF 8210M and PF 8211F.

**v2 handling:** `condition.type = "forDownstream"` with `notes = "+ 5 days"` preserved.

### "req'd for all" (21 occurrences)

Informational only -- indicates the prereq applies universally. Correctly dropped from conditions (returns null).

### Metadata/extraction notes (not conditional)

- "External prerequisite from [phase]" -- informational, not a condition
- "Name in prerequisite listing differs..." -- extraction provenance
- "PDF lists as..." -- extraction provenance
- "Listed as..." -- extraction provenance
- "General enrollment prerequisite, not a specific event code" -- TL phase enrollment

**v2 handling:** Filtered out by the catch-all regex in `parseCondition()`.

## Remaining Uncertainties

1. **"Hour 4" notes** on FQ 6210S, FQ 8110S, FQ 8111S: These indicate the prereq is specifically for the 4th hour of the event. Currently treated as informational (`type: "info"`). May need structured handling if the front-end needs to distinguish simulator session hours.

2. **"req'd for 8302W"** (TF 8301Y and downstream): The note omits the phase prefix. The builder infers it as "TF 8302W" from the parent event's phase prefix. This is correct but worth verifying if any events share a number across phases.

3. **CF 6370F applicability**: MCG raw data says `["ABM", "CSO", "FTE"]` -- no pilots. The board shows white (empty) cells for all pilots, which is consistent with the MCG saying pilots DON'T do this event. If the board also shows white for ABM/CSO/FTE but they should have data, that's a board data issue, not an MCG issue.

4. **PF 8311F applicability**: MCG raw data says `["CSO", "RPA"]`. The description mentions FTEs as "non-graded test conductors" who "will attend the MIB in addition to conducting the flight." FTE participation is as support staff, not graded students. If the board shows FTE paired cells, it may be because FTEs are assigned as test conductors but are NOT graded on this event. This is a scheduling distinction, not an MCG applicability issue.
