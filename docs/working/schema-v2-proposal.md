# MCG Graph Schema v2 Proposal

## Overview

The v1 schema stores prerequisites as a flat list with free-text `notes` that encode conditional logic the front-end can't use. The v2 schema restructures these into machine-readable fields while remaining human-editable.

Key changes:
1. Prerequisites gain a structured `condition` field
2. Applicability codes are normalized and annotated
3. Non-standard codes (FTC, STC, US Only) are mapped to standard board types where possible

---

## Proposed JSON Structure

### Top-level (unchanged)

```json
{
  "_meta": { ... },
  "goalEvents": [ ... ],
  "events": { "XX 1234Y": { ... } }
}
```

### Event record

```json
{
  "eventName": "F-16 Sensors Flight",
  "eventType": "F",
  "eventTypeName": "Flight",
  "phase": "SY",
  "moduleCode": "SY 6100",
  "parentCourse": "SY 6000 Systems Fundamentals",
  "applicability": ["FTC"],
  "applicabilityDetail": {
    "standardMapping": ["ABM", "CSO", "FTE", "P", "RPA"],
    "tags": ["FTC"],
    "notes": null
  },
  "description": "...",
  "prerequisites": [
    {
      "code": "CF 6673F",
      "name": "F-16 CF-4",
      "condition": {
        "type": "studentType",
        "values": ["P"],
        "role": "crew-solo"
      }
    },
    {
      "code": "CF 6680F",
      "name": "F-16 Flight Training",
      "condition": {
        "type": "studentType",
        "values": ["ABM", "CSO", "FTE", "RPA"]
      }
    },
    {
      "code": "CF 6681F",
      "name": "F-16 Flight Training",
      "condition": {
        "type": "studentType",
        "values": ["P"],
        "role": "non-crew-solo"
      }
    },
    {
      "code": "SY 6121S",
      "name": "RADAR Lecture Exam",
      "condition": null
    }
  ]
}
```

---

## Field-by-field specification

### `applicability` (array of strings)

Unchanged from v1 in structure. Contains the codes exactly as they appear in the MCG. Can include both standard board types (ABM, CSO, FTE, P, RPA) and non-standard codes (FTC, STC, US Only).

An empty array `[]` means the event applies to all students (unrestricted).

### `applicabilityDetail` (object, new)

Only present when the raw applicability needs disambiguation. Omitted for events with `[]` (all students) or events where the codes are already all standard.

| Field | Type | Description |
|-------|------|-------------|
| `standardMapping` | `string[]` | The equivalent set of standard board types. FTC = `["ABM","CSO","FTE","P","RPA"]`. STC students are tracked separately. |
| `tags` | `string[]` | Non-standard qualifiers: `"FTC"`, `"STC"`, `"US Only"`, `"non-US Only"`, `"select"`. These are pass-through labels for display/filtering. |
| `notes` | `string \| null` | Human-readable clarification when automated mapping isn't sufficient. |

**Standard code mapping table:**

| MCG Code | Standard Mapping | Notes |
|----------|-----------------|-------|
| FTC | ABM, CSO, FTE, P, RPA | Fixed-wing Test Course = all standard board types |
| STC | (kept as-is) | Space Test Course students tracked separately on the board |
| US Only | (added as tag) | Restricts nationality, not student type. Applies to whatever student types the event would otherwise include |
| non-US Only | (added as tag) | Inverse of US Only |
| select P | P | "select" means not all P students, at instructor discretion |
| select FTE | FTE | Same, instructor discretion |
| select CSO | CSO | Same |
| STC as DE | (kept as-is) | STC student acting as designated examiner |

### `prerequisites[].condition` (object or null, new -- replaces `notes` and `requiredFor`)

The condition describes WHEN this prerequisite applies. `null` means it is unconditional (required for everyone who takes the event).

#### Condition types

**1. `studentType` -- prerequisite applies only to specific student types**

```json
{
  "type": "studentType",
  "values": ["P"],
  "role": "crew-solo"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"studentType"` | yes | |
| `values` | `string[]` | yes | Which student types need this prereq |
| `role` | `string \| null` | no | `"crew-solo"`, `"non-crew-solo"`, or null. Distinguishes crew-solo pilots from non-crew-solo pilots for the same event. |

**2. `datagroup` -- prerequisite applies only to a specific data group**

```json
{
  "type": "datagroup",
  "values": ["T-38"]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"datagroup"` | yes | |
| `values` | `string[]` | yes | Which data groups need this prereq. One of: `"T-38"`, `"C-12"`, `"F-16"`, `"Learjet"` |

**3. `forDownstream` -- prerequisite is needed not for this event directly, but for a later event**

```json
{
  "type": "forDownstream",
  "target": "PF 7121R"
}
```

This captures the v1 `requiredFor` concept. The prereq isn't needed to start this event but must be complete before the downstream target.

**4. `alternative` -- prerequisite is one of several acceptable alternatives**

```json
{
  "type": "alternative",
  "anyOf": ["SY 7222F", "SY 7304F"]
}
```

This captures the "or SY 7222F or SY 7304F" pattern from v1 notes.

#### Combined conditions

A prerequisite can have multiple condition aspects. When this happens, use a flat object with multiple keys:

```json
{
  "type": "studentType",
  "values": ["P"],
  "role": "crew-solo",
  "target": "SY 6131F"
}
```

This means: "required for P (crew-solo) students, and specifically needed for event SY 6131F."

---

## How the front-end consumes this

### Filtering prerequisites for a given student

```javascript
function getPrereqsForStudent(event, student) {
  return event.prerequisites.filter(p => {
    if (!p.condition) return true; // unconditional

    switch (p.condition.type) {
      case 'studentType':
        return p.condition.values.includes(student.type);

      case 'datagroup':
        return p.condition.values.includes(student.datagroup);

      case 'forDownstream':
        return true; // always include, but UI can render differently

      case 'alternative':
        // check if student has completed ANY of the alternatives
        // if so, this prereq is satisfied
        return true; // include, let completion logic handle it

      default:
        return true;
    }
  });
}
```

### Checking applicability

```javascript
function eventAppliesTo(event, student) {
  // Empty = applies to all
  if (event.applicability.length === 0) return true;

  const standardTypes = ['ABM', 'CSO', 'FTE', 'P', 'RPA'];

  // Check direct match
  if (event.applicability.includes(student.type)) return true;

  // Check FTC (= all standard types)
  if (event.applicability.includes('FTC') && standardTypes.includes(student.type))
    return true;

  // Check STC
  if (event.applicability.includes('STC') && student.type === 'STC') return true;

  // Check "select" prefix
  if (event.applicability.includes('select ' + student.type)) return true;

  // Check US Only / non-US Only
  if (event.applicability.includes('US Only') && !student.isUS) return false;
  if (event.applicability.includes('non-US Only') && student.isUS) return false;

  return false;
}
```

### DAG traversal

The front-end DAG builder should:
1. Start from a goal event
2. Walk prerequisites, filtering by student type/datagroup
3. For `forDownstream` conditions: include the prereq in the path but mark it as "needed later"
4. For `alternative` conditions: mark as satisfied if ANY of the listed codes are complete

---

## Migration notes from v1

### What changes

1. **`prerequisites[].notes`** -- removed. All semantic content parsed into `condition`.
2. **`prerequisites[].requiredFor`** -- removed. Folded into `condition.type = "forDownstream"` or combined with `studentType` conditions.
3. **`applicabilityDetail`** -- new field added only where non-standard codes exist.
4. **Goal events** -- completely unchanged. Same 11 codes, same applicability.

### What stays the same

- Top-level structure (`_meta`, `goalEvents`, `events`)
- Event codes as keys
- `eventName`, `eventType`, `eventTypeName`, `phase`, `moduleCode`, `parentCourse`, `description`
- `applicability` array (still present, values unchanged)
- `prerequisites[].code` and `prerequisites[].name`

### Notes preserved as human-readable

Some v1 notes contain information that isn't purely conditional (e.g., "+ 5 days", extraction discrepancy notes). These are preserved in `condition.notes` when they don't map to a structured type:

```json
{
  "code": "PF 8202E",
  "name": "Energy Exam",
  "condition": {
    "type": "forDownstream",
    "target": "PF 8211F",
    "notes": "+ 5 days"
  }
}
```

### Builder changes

The v2 builder (`build-prereq-graph-v2.cjs`) adds a `parseCondition()` function that converts v1 notes into structured conditions. The source phase JSONs remain unchanged -- the builder does the transformation.
