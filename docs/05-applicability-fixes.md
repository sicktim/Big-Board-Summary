# Applicability Fixes Summary - MCG 26A Graph v2

Builder: `build-prereq-graph-v2.cjs` v0.3.0
Date: 2026-04-17

## What changed

The v2 builder now generates `applicabilityDetail` for 24 events that have event-level `notes` qualifying their applicability. Previously, these events only had `eventNotes` (the raw text) but no structured detail the front-end could use.

The `applicability` array is UNCHANGED -- backwards compatibility is preserved. The new `applicabilityDetail` object sits alongside it.

## Events changed (24 total)

### Crew-solo events (12) -- `role: "crew-solo"`

These are for pilots assigned to that aircraft's crew-solo data group. Completing these events certifies the pilot as "crew solo" in the aircraft.

| Event Code | Event Name | Aircraft | Module |
|------------|------------|----------|--------|
| CF 6510E | C-12 Open Book Exam | C-12 | CF 6500 |
| CF 6520E | C-12 Pilot Closed Book Exam | C-12 | CF 6500 |
| CF 6540F | C-12 CF-1 | C-12 | CF 6500 |
| CF 6541F | C-12 CF-2 | C-12 | CF 6500 |
| CF 6542F | C-12 CF-3 | C-12 | CF 6500 |
| CF 6630E | F-16 Open Book Exam | F-16 | CF 6600 |
| CF 6640E | F-16 Pilot/WSO Closed Book Exam | F-16 | CF 6600 |
| CF 6660S | F-16 Emergency Procedures Checkout | F-16 | CF 6600 |
| CF 6670F | F-16 CF-1 | F-16 | CF 6600 |
| CF 6671F | F-16 CF-2 | F-16 | CF 6600 |
| CF 6672F | F-16 CF-3 | F-16 | CF 6600 |
| CF 6673F | F-16 CF-4 | F-16 | CF 6600 |

### Non-crew-solo events (4) -- `role: "non-crew-solo"`

#### Pilot-only non-crew-solo flights (2)
Pilots NOT in the crew-solo data group for that aircraft.

| Event Code | Event Name | Aircraft |
|------------|------------|----------|
| CF 6551F | C-12 Flight Training | C-12 |
| CF 6681F | F-16 Flight Training | F-16 |

#### Mixed-applicability events where P is non-crew-solo (2)
All student types do this event, but the pilot applicability is restricted to non-crew-solo pilots in that aircraft's data group.

| Event Code | Event Name | Aircraft | Full Applicability |
|------------|------------|----------|--------------------|
| CF 6521E | C-12 MA Closed Book Exam | C-12 | ABM, CSO, FTE, P, RPA |
| CF 6641E | F-16 MA Closed Book Exam | F-16 | ABM, CSO, FTE, P, RPA |

### Select-pilot events (8) -- `role: "select"`

Select pilots at instructor discretion. All other types in the applicability array are unconditional.

| Event Code | Event Name | Aircraft |
|------------|------------|----------|
| CF 6202F | Glider Familiarization | Glider |
| CF 6203F | Glider Familiarization | Glider |
| CF 6210F | Glider Familiarization and Solo | Glider |
| CF 6211F | Glider Familiarization and Solo | Glider |
| CF 6212F | Glider Familiarization and Solo | Glider |
| CF 6213F | Glider Familiarization and Solo | Glider |
| CF 6214F | Glider Familiarization and Solo | Glider |
| CF 6215F | Glider Familiarization and Solo | Glider |

## Crew-solo / Datagroup mapping logic

The builder derives the aircraft from the event's name using pattern matching:
- Event name contains "C-12" -> aircraft = "C-12"
- Event name contains "F-16" -> aircraft = "F-16"
- Event name contains "T-38" -> aircraft = "T-38"
- Event name contains "Glider" -> aircraft = "Glider"
- Falls back to `parentCourse` if no match in event name

This is deterministic and matches the MCG structure where events are organized into aircraft-specific modules (CF 6500 = C-12, CF 6600 = F-16, etc.).

## applicabilityDetail schema

```json
{
  "role": "crew-solo" | "non-crew-solo" | "select",
  "aircraft": "C-12" | "F-16" | "Glider" | null,
  "standardMapping": ["P"],
  "description": "human-readable explanation"
}
```

For `role: "non-crew-solo"` on mixed-applicability events (CF 6521E, CF 6641E), `standardMapping` includes ALL types since the non-crew-solo restriction only applies to the P component.

## Datagroup prerequisites (verified)

28 datagroup-conditional prerequisites across PF 6230F, PF 8240F, PF 8241F, PF 8242F. All correctly map to their respective data groups:
- T-38 Data Group: CF 6370F
- Learjet Data Group: CF 6403F, CF 6621C
- C-12 Data Group: CF 6542F, CF 6550F
- F-16 Data Group: CF 6673F, CF 6680F

## Board mismatch findings

### CF 6370F "T-38 Flight Training"
MCG applicability: `["ABM", "CSO", "FTE"]` -- NO pilots.
Board shows white cells for all pilots, which is CORRECT per the MCG. Pilots do T-38 check flights (CF 6360F series) instead, not this training flight. If ABM/CSO/FTE also show white, that may be a board data issue unrelated to the MCG.

### PF 8311F "C-12 Performance Practical Flight"
MCG applicability: `["CSO", "RPA"]` -- NO FTE, NO P.
The event description says: "FTEs are assigned as non-graded test conductors for this event and will attend the MIB in addition to conducting the flight."
If 3 FTE students show paired cells on the board, this is likely because they are assigned as test conductors (a scheduling/role assignment), not because they are graded on the event. The MCG applicability is correct as `["CSO", "RPA"]`.

**Recommendation:** The front-end should distinguish between "graded participant" (per MCG applicability) and "assigned support role" (per board pairing). FTE cells for PF 8311F should probably not show as required curriculum events.

## Remaining uncertainties for human verification

1. **CF 6660S prereqs**: This event (F-16 EP Checkout) has CF 6672F (F-16 CF-3) as its prereq, but it also appears as a prereq for CF 6670F-6673F with `requiredFor: CF 6673F`. Verify the circular-looking dependency is intentional (EP Checkout needed specifically for CF-4, not CF-1 through CF-3).

2. **"Hour 4" timing notes** on FQ 6210S, FQ 8110S, FQ 8111S: These indicate a prereq is for a specific simulator session hour. Not currently structured -- needs clarification on whether the front-end needs this.

3. **Glider "select P" scope**: CF 6202F/6203F have applicability `["ABM", "CSO", "FTE", "P", "RPA"]` with notes "select P". Does "select P" mean (a) only select pilots do it, and all other types always do it, or (b) only select pilots do it, period? The current interpretation is (a) based on the full applicability array.
