# MCG-Tracker

A curriculum status tracker for USAF Test Pilot School (TPS). Renders a per-student or per-class DAG view of progress against the Master Curriculum Guide (MCG), driven by live data from the Big Board Google Sheet.

## What it does

For a given goal event (e.g., `PF 8332F` Multi-Engine Performance Practical), the tracker:

1. Walks the MCG prereq graph backwards from the goal.
2. Filters edges per the viewing audience (single student vs. class) using MCG Rules A, D, E, G, I + condition types (`forDownstream`, `datagroup`) + `oneOf` groups.
3. Renders a DAG with each event color-coded by status (Complete / Partially Complete / Started / Not Started / Prereqs Met / Prereqs Partially Met / Prereqs Not Met).
4. Folds the live Big Board sheet on top — paired-cell colors, dates, strikethrough — so each student's actual completion state drives the rendering.

## How it's structured

- **`tracker/`** — the front-end app (`index.html`) and its GAS Web App backend (`Code.gs`).
- **`data/`** — canonical MCG curriculum data as structured JSON.
- **`extraction/`** — pipeline that produces the curriculum data from the MCG PDF.
- **`docs/`** — the rules, requirements, knowledge base, and data contract.
- **`dev/`** — inspection and test harnesses.

See `CLAUDE.md` for session start order. See `docs/00-state.md` for current status.

## Running locally

```bash
cd tracker
node serve.cjs
# or: python -m http.server 8080
```

Open `http://localhost:8080/index.html`. The app fetches `mcg-26a.json` and the GAS endpoint at boot.

## Class version

This repo currently tracks **MCG 26A**. To roll to a new class:

1. Update the source PDF in `extraction/source/`.
2. Re-run the extraction pipeline (see `extraction/extraction-summary.md`).
3. Replace `data/MCG-26A_2026-04-21.json` with the new dated handoff JSON.
4. Update `tracker/mcg-26a.json` to point at the new data.
5. Bump the MCG version constant.
