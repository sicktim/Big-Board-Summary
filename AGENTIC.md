# Agentic Engineering Framework — MCG-Tracker

Tracks how this project lines up with the 5-step framework defined in `~/.claude/AGENTIC_FRAMEWORK.md`.

**Deployed:** 2026-05-02
**Last audit:** 2026-05-03 (v0.5.2 cycle)

---

## 1. PRD-First Development
- **Source-of-truth doc:** `docs/00-state.md` + `docs/03-derived-requirements.md` + `docs/04-handoff-2026-04-21.md`
- **Status:** in place — multi-doc PRD already established. `docs/00-state.md` still names v0.5.1 as current; needs a refresh once the v0.5.2 fixes land.
- **Next action:** update `docs/00-state.md` "Open issues" + version banner when v0.5.2 ships.

## 2. Modular Rules Architecture
- **Rules entry point:** `CLAUDE.md`
- **Split across:** `docs/00-state.md`, `01-architecture.md`, `02-knowledge-base.md`, `03-derived-requirements.md`, `04-handoff-2026-04-21.md`, `05-applicability-fixes.md`, plus `.claude/agents/mcg-curriculum-expert.md`
- **Status:** in place — already follows modular-rules pattern
- **Next action:** none immediate.

## 3. Command-ify Everything
- **Project commands:** none — `.claude/commands/` does not exist.
- **Repeated workflows worth promoting:**
  - **Version bump + issue-resolution append** — every fix cycle does this by hand against `docs/03-derived-requirements.md` §5 conventions and `issues.md`. Strong candidate for `/release` or `/bump`.
  - **Tracker dev-server start** — `node tracker/serve.cjs` + open browser. Trivial; not worth a command yet.
- **Status:** not yet audited; no commands authored.
- **Next action:** if the version-bump workflow runs again unchanged in v0.5.3, promote it to `.claude/commands/release.md`.

## 4. Context Reset Discipline
- **Plan vs. Execute boundary:** undefined — sessions currently mix planning and execution. The numbered `docs/` series and `issues.md` give us a written hand-off surface that *could* anchor a clean reset, but no procedure exists for "plan in session A, write to disk, execute fresh in session B."
- **Status:** not started.
- **Next action:** for any v0.5.3+ work that touches DAG semantics or schema, write the plan to `docs/working/` first, then start a fresh session to execute. The new `session-history.log` makes resume trivial.

## 5. System Evolution Log
Captures recurring AI/system mistakes that warrant a permanent rule, command, or doc update — not just a one-time bug fix.

- **2026-05-03 — MCG is authoritative for event applicability; the Big Board is NOT.**
  Observed twice: v0.5.0 (CF 6370F flagged pilots because the Big Board had a stray flight) and v0.5.2 (PF 8211F showed "no applicable students" because one CSO's cell was miscolored dark grey on the Big Board). Same root cause: code is using DBB cell color/presence as the applicability source.
  **Systemic fix:** elevated to a standing rule in `docs/02-knowledge-base.md` §0 ("Source-of-truth ordering") and enforced by an MCG-vs-DBB applicability mismatch warning in the tracker. Future PRs touching applicability or roster logic must read MCG first, then reconcile against DBB — never the reverse.

---

## Sub-projects / branches
- `tracker/` — display app (HTML + GAS backend)
- `extraction/` — MCG PDF → JSON pipeline (independent enough it could warrant its own AGENTIC.md if it grows)
