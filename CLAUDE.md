# MCG-Tracker

USAF TPS Master Curriculum Guide (MCG) curriculum status tracker. A single-page web app that renders a per-student / per-class DAG view of curriculum progress against the MCG, sourced from a live Google Sheet via a Google Apps Script (GAS) backend.

**Class version: 26A** (versioned data; class can roll to 26B/27A by re-running extraction).

---

## How to start a new session

Read in this order. Stop after each step if you have what you need.

1. **`docs/00-state.md`** — where the project actually is right now, what's next, blockers.
2. **`issues.md`** — live bug log, newest at top. v0.5.1 is the current target.
3. **`docs/01-architecture.md`** — component map, data flow.
4. **`docs/02-knowledge-base.md`** — MCG rules (Rules A–L), student types, DG mappings. **Read before writing any DAG logic.**
5. **`docs/03-derived-requirements.md`** — design decisions D1–D17, status states, sheet-parsing contract.
6. **`docs/04-handoff-2026-04-21.md`** — data contract for the curriculum JSON. Read before changing the loader or DAG builder.
7. **`docs/05-applicability-fixes.md`** — v0.3.0 builder applicability/role fix log.

Specialty docs (open as needed):
- `docs/practical-and-goal-events.md` — original spec for goal-event flowchart UI.
- `docs/working/` — in-progress audits, design references (mockups, screenshots), older training materials. Treat as historical / reference, not authoritative.
- `extraction/extraction-summary.md` — how the curriculum JSON was produced.
- `extraction/extraction-notes.md` — per-phase extraction quirks, MCG source drift, fix log.

---

## Subagent

`.claude/agents/mcg-curriculum-expert.md` — invoke for authoritative answers on event applicability, prereq chains, student types, crew-solo / data-group rules, series-collapse, Big Board display filtering. Use it to validate proposed corrections to `data/MCG-26A_2026-04-21.json` before applying them.

---

## Folder layout

```
MCG-Tracker/
├── CLAUDE.md                          ← this file
├── README.md                          ← human-friendly overview
├── issues.md                          ← live issue log (v0.5.1 active)
├── docs/                              ← canonical docs, read in numbered order
│   ├── 00-state.md
│   ├── 01-architecture.md
│   ├── 02-knowledge-base.md
│   ├── 03-derived-requirements.md
│   ├── 04-handoff-2026-04-21.md
│   ├── 05-applicability-fixes.md
│   ├── practical-and-goal-events.md
│   └── working/                       ← in-progress audits, design refs
├── data/
│   └── MCG-26A_2026-04-21.json        ← canonical curriculum data (667 events)
├── tracker/                           ← the display app
│   ├── index.html                     ← single-page app (v0.5.1)
│   ├── Code.gs                        ← GAS Web App backend
│   ├── serve.cjs                      ← local dev http server
│   ├── dagre.min.js                   ← vendored layout dep
│   ├── mcg-26a.json                   ← runtime copy of data/MCG-26A_2026-04-21.json
│   ├── images/
│   └── JSON-outputs/                  ← cached GAS responses for offline dev
├── extraction/                        ← MCG PDF → JSON pipeline
│   ├── extraction-summary.md
│   ├── extraction-notes.md
│   ├── prompts/
│   ├── schemas/
│   ├── scripts/
│   └── source/                        ← MCG 26A.pdf, raw text extracts, version-1/2/3 outputs
└── dev/                               ← test/inspection harnesses, off the production path
    ├── _dag-harness.cjs
    ├── _dagre-test.cjs
    ├── _inspect_xlsx*.cjs
    ├── _review-harness.cjs
    ├── smoke-test.cjs
    └── build-prereq-graph.cjs
```

---

## Key operational facts

- **Tracker runtime**: open `tracker/index.html` via `node tracker/serve.cjs` (or `python -m http.server` from `tracker/`). It refuses to load over `file://` — the JSON fetch needs same-origin HTTP.
- **Data source of truth**: `data/MCG-26A_2026-04-21.json` is canonical. `tracker/mcg-26a.json` is a runtime copy. If you change one, sync the other (or replace one with a copy step in `serve.cjs`).
- **Big Board source**: a fixed Google Sheet, fetched via the deployed GAS Web App. The Sheet ID and GAS deployment URL are set in `Code.gs` Script Properties, not in code. Foreign-national students are marked by a rich-text red asterisk on names — preserve, don't strip.
- **Versioning**: every source file carries the convention block in `docs/03-derived-requirements.md` §5. MAJOR = data contract break, MINOR = visible behavior, PATCH = fix.

---

## Current target

v0.5.1 — see top of `issues.md`. Highest-priority items:

- Display events that are S/C/F/I/L per MCG even if absent from Big Board (with a "not currently tracked on Big Board" message).
- Show what specific prereq is missing on hover/highlight.
- Click-to-focus on event + direct prerequisites only.
- "OR block" rendering for SY 7511F path (SY 7222F connection).
