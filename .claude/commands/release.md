---
description: Ship a tracker version — verify, bump, log, sync site/. Stops before commit/push.
---

Release the tracker changes currently in the working tree. `$ARGUMENTS` is the new version (e.g. `0.6.1`); if empty, propose one per `docs/03-derived-requirements.md` §5 (MAJOR = data-contract break, MINOR = visible behavior, PATCH = fix) and confirm it.

1. **Verify.** `node dev/app-harness.cjs` — must end with "All invariants hold". It needs at least one recent `fetch_sheet` payload in `tracker/JSON-outputs/` (gitignored). If the newest one is more than a few days old, save a fresh one from the GAS endpoint first (`?call=fetch_sheet&sheet=<tab>`), for both the senior and junior class tabs. A failing invariant stops the release.
2. **Look at it.** `node tracker/serve.cjs`, open `http://127.0.0.1:8080/`, press Refresh, and check: one preset target, one comprehensive exam (TF 9102E), one custom target, student view, and the junior-class tab. No console errors.
3. **Version.** In `tracker/index.html`: header block (`Version`, `Updated`, a changelog entry that says what was wrong and what changed) and `APP_VERSION`. If `tracker/Code.gs` changed: its header and `APP_VERSION` too, and say in the hand-off that it needs a redeploy.
4. **Log.** Top of `issues.md`: what was reported, what was found, what was fixed, what is still waiting on a ruling. Update `docs/00-state.md` (version banner, "Waiting on the user", open issues).
5. **Sync `site/`.** Copy `tracker/index.html`, `tracker/mcg-26a.json`, `tracker/dagre.min.js`, `issues.md` into `site/`. Confirm `tracker/index.html` and `site/index.html` are identical.
6. **Stop.** Report what changed and what was verified. Commit and push only when asked — a push to `main` that touches `site/` publishes to GitHub Pages.
