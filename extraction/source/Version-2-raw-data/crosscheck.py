#!/usr/bin/env python3
"""Cross-check Version-2 per-phase JSON files.

Reports:
1. Dangling prereq references (prereq code not defined anywhere in V2)
2. Series length inconsistencies
3. Goal event presence
4. Event counts per phase
5. Comparison against V1 (events added / removed)
"""
import json
import os
import sys
from collections import defaultdict

V2_DIR = os.path.dirname(os.path.abspath(__file__))
V1_DIR = os.path.join(os.path.dirname(V2_DIR), "Version-1-raw-data")

PHASES = ["AN", "AS", "CF", "FQ", "PF", "SO", "SY", "TF", "TL"]

GOAL_EVENTS = [
    "PF 8311F", "PF 8332F",
    "FQ 9502S", "FQ 9511F", "FQ 9512C",
    "SY 7503F", "SY 7511F", "SY 7512C", "SY 7521O",
    "TF 9102E", "TF 9111E",
]

def load_v2():
    data = {}
    for phase in PHASES:
        path = os.path.join(V2_DIR, f"phase-{phase}.json")
        with open(path, "r", encoding="utf-8") as f:
            data[phase] = json.load(f)
    return data

def load_v1_events():
    """Walk V1 phase files and collect all event codes."""
    events = set()
    for phase in PHASES:
        path = os.path.join(V1_DIR, f"phase-{phase}.json")
        if not os.path.exists(path):
            continue
        with open(path, "r", encoding="utf-8") as f:
            v1 = json.load(f)
        # V1 stores events inside modules
        for module in v1.get("modules", []):
            for ev in module.get("events", []):
                events.add(ev.get("code"))
    return events

def main():
    v2 = load_v2()
    v1_events = load_v1_events()

    all_v2_codes = set()
    per_phase_counts = {}
    for phase, pdata in v2.items():
        codes = set(pdata.get("events", {}).keys())
        per_phase_counts[phase] = len(codes)
        all_v2_codes |= codes

    print("=" * 70)
    print("1. EVENT COUNTS PER PHASE")
    print("=" * 70)
    total = 0
    for phase in PHASES:
        c = per_phase_counts.get(phase, 0)
        print(f"  {phase}: {c}")
        total += c
    print(f"  TOTAL: {total}")
    print()

    print("=" * 70)
    print("2. GOAL EVENT PRESENCE CHECK")
    print("=" * 70)
    missing_goals = []
    for goal in GOAL_EVENTS:
        if goal in all_v2_codes:
            print(f"  OK      {goal}")
        else:
            print(f"  MISSING {goal}")
            missing_goals.append(goal)
    print()

    print("=" * 70)
    print("3. DANGLING PREREQ REFERENCES")
    print("=" * 70)
    dangling = defaultdict(list)
    for phase, pdata in v2.items():
        for code, ev in pdata.get("events", {}).items():
            for preq in ev.get("prerequisites", []):
                pc = preq.get("code", "").strip()
                if not pc:
                    continue
                # Skip condition-target sentinels (non-event codes)
                if pc in ("all", "P", "TPS Enrollment"):
                    continue
                if pc not in all_v2_codes:
                    dangling[pc].append(code)
    if dangling:
        for missing, refs in sorted(dangling.items()):
            print(f"  {missing}  referenced by: {', '.join(sorted(set(refs))[:5])}"
                  f"{' ...' if len(set(refs))>5 else ''} ({len(set(refs))} refs)")
    else:
        print("  (none)")
    print()

    print("=" * 70)
    print("4. SERIES LENGTH CONSISTENCY")
    print("=" * 70)
    series_members = defaultdict(list)
    declared_length = {}
    for phase, pdata in v2.items():
        for code, ev in pdata.get("events", {}).items():
            si = ev.get("seriesInfo", {})
            if si.get("inSeries"):
                sid = si.get("seriesId")
                pos = si.get("seriesPosition")
                ln = si.get("seriesLength")
                series_members[sid].append((pos, code))
                declared_length[sid] = ln
    problems = []
    for sid, members in sorted(series_members.items()):
        ln = declared_length.get(sid)
        found = len(members)
        positions = sorted(p for p, _ in members)
        expected_positions = list(range(1, (ln or 0) + 1))
        ok = (found == ln) and (positions == expected_positions)
        flag = "OK     " if ok else "PROBLEM"
        codes_sorted = ", ".join(c for _, c in sorted(members))
        print(f"  {flag} {sid}: declared length {ln}, found {found} members [{codes_sorted}]")
        if not ok:
            problems.append(sid)
    print()

    print("=" * 70)
    print("5. V1 vs V2 EVENT DELTA")
    print("=" * 70)
    added = sorted(all_v2_codes - v1_events)
    removed = sorted(v1_events - all_v2_codes)
    print(f"  Events in V2 but not V1: {len(added)}")
    for c in added[:40]:
        print(f"    + {c}")
    if len(added) > 40:
        print(f"    ... ({len(added) - 40} more)")
    print()
    print(f"  Events in V1 but not V2: {len(removed)}")
    for c in removed[:40]:
        print(f"    - {c}")
    if len(removed) > 40:
        print(f"    ... ({len(removed) - 40} more)")
    print()

    print("=" * 70)
    print("SUMMARY")
    print("=" * 70)
    print(f"  Total V2 events: {total}")
    print(f"  Total V1 events: {len(v1_events)}")
    print(f"  Missing goals: {len(missing_goals)}")
    print(f"  Dangling prereq targets: {len(dangling)}")
    print(f"  Series with length issues: {len(problems)}")

if __name__ == "__main__":
    main()
