/* ============================================================
 * File:       app-harness.cjs
 * Module:     big-board-curriculum-status / dev-test
 * Version:    0.1.0
 * MCG Target: 26A
 * Updated:    2026-10-01
 * Changelog:
 *   0.1.0 - Initial. Runs the REAL app script out of tracker/index.html
 *           (not a copy of its functions) against saved GAS payloads and
 *           checks the invariants below. Written after v0.5.2e shipped a
 *           chain-walker regression and a 64-node collapse cap that the
 *           older copy-paste harnesses could not see.
 * ============================================================
 *
 * Run:   node dev/app-harness.cjs [payload.json ...]
 *        (default: every *.json in tracker/JSON-outputs/)
 *        BBCS_HTML=path/to/other/index.html to test a different build
 *        (mcg-26a.json is read from the same folder as the html).
 *
 * How it works: the last inline <script> of index.html is evaluated in a
 * node vm with a stub DOM. Nothing renders — the stubs only let the
 * module-level code load — so this exercises parsing, classification,
 * DAG building, the chain walker and target search, not layout or CSS.
 *
 * Invariants (exit code 1 if any fails):
 *   I1  buildDag never throws, for every MCG event and every board row
 *       as the target, class view and every student.
 *   I2  Every node in a DAG leads to the target (no floating sub-graphs).
 *   I3  No off-board event survives collapse as an ordinary node.
 *   I4  OPTED agrees with the drawing: a student is opted for a node iff
 *       every drawn direct prerequisite is complete / not required.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const htmlPath = process.env.BBCS_HTML || path.join(ROOT, 'tracker', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const configJson = html.match(/<script id="config" type="application\/json">([\s\S]*?)<\/script>/)[1];
const inlineScripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const appJs = inlineScripts[inlineScripts.length - 1];

// ---- stub DOM: just enough for the module-level code to evaluate ----
function stubEl() {
  return {
    style: {}, dataset: {}, children: [], textContent: '', innerHTML: '', value: '', hidden: true,
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    appendChild(c) { this.children.push(c); return c; }, insertBefore() {}, remove() {},
    addEventListener() {}, setAttribute() {}, getAttribute() { return null; }, contains() { return false; },
    querySelector() { return stubEl(); }, querySelectorAll() { return []; }, focus() {}, scrollIntoView() {},
    getBoundingClientRect() { return { left: 0, top: 0, right: 0, bottom: 0, width: 200, height: 60 }; },
  };
}
// Every event-type toggle on: with a type hidden the drawing bridges past
// events the chain walker still counts, and I4 compares the two.
const store = { "bbcs::settings": JSON.stringify({ showMIBs: true, showAsync: true, showExams: true, showGround: true }) };
const ctx = {
  console: { log() {}, warn() {}, error: console.error },
  document: {
    getElementById: id => (id === 'config' ? { textContent: configJson } : stubEl()),
    querySelector: () => stubEl(), querySelectorAll: () => [],
    createElement: () => stubEl(), createElementNS: () => stubEl(), createTextNode: t => ({ text: t }),
    addEventListener() {},
  },
  localStorage: {
    getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }, key: i => Object.keys(store)[i],
    get length() { return Object.keys(store).length; },
  },
  location: { hash: '', search: '', href: 'http://localhost/' }, history: { replaceState() {} },
  setTimeout, clearTimeout, setInterval: () => 0, requestAnimationFrame: () => 0, URLSearchParams,
  fetch: async () => { throw new Error('no network in the harness'); },
};
ctx.window = ctx; ctx.globalThis = ctx; ctx.addEventListener = () => {};
vm.createContext(ctx);
vm.runInContext(appJs + `
;globalThis.__app = {
  APP_VERSION, parse, statusModule, chain, render, state,
  targets: typeof targets !== 'undefined' ? targets : null,
  applyDupResolution,
  setMcg(g) { MCG_GRAPH = g; },
};`, ctx, { filename: 'index.html<script>' });
const app = ctx.__app;
const mcg = JSON.parse(fs.readFileSync(path.join(path.dirname(htmlPath), 'mcg-26a.json'), 'utf8'));
mcg._loaded = true;
app.setMcg(mcg);

// ---- payloads ----
const outDir = path.join(ROOT, 'tracker', 'JSON-outputs');
let files = process.argv.slice(2);
if (!files.length) files = fs.readdirSync(outDir).filter(f => f.endsWith('.json')).map(f => path.join(outDir, f));
if (!files.length) { console.error('No payloads. Save a fetch_sheet response into tracker/JSON-outputs/.'); process.exit(2); }

let failures = 0;
const fail = (msg) => { failures++; console.log('  FAIL ' + msg); };
const DONE = ['complete', 'notreq'];

function predecessors(dag) {
  const preds = {};
  for (const e of dag.edges) (preds[e.to] = preds[e.to] || []).push(e.from);
  return preds;
}
function leadsTo(dag, goal) {
  const preds = predecessors(dag);
  const seen = new Set([goal]); const todo = [goal];
  while (todo.length) for (const f of preds[todo.pop()] || []) if (!seen.has(f)) { seen.add(f); todo.push(f); }
  return seen;
}

console.log(`app ${app.APP_VERSION} · ${htmlPath}`);
for (const file of files) {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
  if (!raw.events || !raw.students) { console.log(`\n${path.basename(file)}: not a fetch_sheet payload — skipped`); continue; }
  const payload = app.parse.indexPayload(raw);
  app.state.payload = payload;
  app.applyDupResolution();
  if (app.chain.resetCache) app.chain.resetCache();   // absent before v0.6.0
  const now = new Date();
  const statusOf = (code, s) => {
    const evt = payload.byCode[code];
    return evt ? app.statusModule.classifyCell(evt.cells.find(c => c.col === s.col), payload.classMeta, now).completion : 'offboard';
  };
  const boardCodes = Object.keys(payload.byCode);
  console.log(`\n${path.basename(file)} — "${payload.sheetName}", ${payload.students.length} students, ` +
    `${payload.events.length} rows → ${boardCodes.length} indexed, ${payload.duplicates.length} duplicate codes` +
    (payload.layoutNote ? ' [shifted-layout repair applied]' : ''));

  // I1–I3: every possible target
  const targetsAll = new Set([...Object.keys(mcg.events), ...boardCodes]);
  let built = 0, floating = 0, leftover = 0;
  const t0 = Date.now();
  for (const g of targetsAll) {
    const views = [{ mode: 'class' }].concat(payload.students.map(s => ({ mode: 'student', student: s })));
    for (const v of views) {
      let dag;
      try { dag = app.render.buildDag(g, payload, v); built++; }
      catch (e) { fail(`I1 buildDag("${g}", ${v.mode}${v.student ? ' ' + v.student.name : ''}) threw: ${e.message}`); continue; }
      const reach = leadsTo(dag, g);
      for (const c of Object.keys(dag.nodesByCode)) {
        // a node with no edges at all is dropped by layoutDag; one WITH edges must reach the target
        const hasEdge = dag.edges.some(e => e.from === c || e.to === c);
        if (hasEdge && !reach.has(c)) { floating++; if (floating <= 5) fail(`I2 "${c}" is drawn but does not lead to target "${g}" (${v.mode})`); }
        const n = dag.nodesByCode[c];
        if (c !== g && !n.isGroup && !n.isMissing && !payload.byCode[c]) { leftover++; if (leftover <= 5) fail(`I3 off-board "${c}" not collapsed in the DAG for "${g}" (${v.mode})`); }
      }
    }
  }
  console.log(`  I1–I3: ${built} DAGs over ${targetsAll.size} targets in ${Date.now() - t0} ms — floating ${floating}, uncollapsed ${leftover}`);

  // I4: opted vs drawing, preset goals × applicable students
  let checked = 0, mismatched = 0;
  for (const g of mcg.goalEvents) {
    if (!payload.byCode[g]) continue;
    for (const s of payload.students) {
      if (!app.statusModule.isStudentApplicablePerMcg(mcg.events[g], s)) continue;
      const dag = app.render.buildDag(g, payload, { mode: 'student', student: s });
      const preds = predecessors(dag);
      // Is anything drawn directly upstream of `code` not done? A "missing
      // from BB" node has no cell to read, so look through it to whatever
      // feeds it; an "Any 1 of" group is met by any one finished member.
      const isBlocked = (code, seen) => (preds[code] || []).some(f => {
        if (seen.has(f)) return false;
        seen.add(f);
        if (f.startsWith('GROUP:')) return !(preds[f] || []).some(m => DONE.includes(statusOf(m, s)));
        if (!payload.byCode[f]) return isBlocked(f, seen);
        return !DONE.includes(statusOf(f, s));
      });
      for (const code of Object.keys(dag.nodesByCode)) {
        if (code.startsWith('GROUP:') || !payload.byCode[code] || DONE.includes(statusOf(code, s))) continue;
        const blocked = isBlocked(code, new Set());
        const opted = app.chain.isOpted(code, payload, s, mcg.events[code]);
        checked++;
        if (opted === blocked) { mismatched++; if (mismatched <= 5) fail(`I4 ${s.name} / ${code} (target ${g}): opted=${opted} but drawn prereqs ${blocked ? 'are NOT all done' : 'are all done'}`); }
      }
    }
  }
  console.log(`  I4: ${checked} incomplete student-nodes checked, ${mismatched} disagree with the drawing`);

  // Informational: preset goal sizes + cell tally
  for (const g of mcg.goalEvents) {
    const dag = app.render.buildDag(g, payload, { mode: 'class' });
    const codes = Object.keys(dag.nodesByCode);
    console.log(`  ${g}: ${payload.byCode[g] ? 'on board' : 'NOT on board'} · ${codes.length} nodes · ${dag.edges.length} edges` +
      ` · implied ${dag.edges.filter(e => e.implied).length} · missing-from-BB [${codes.filter(c => dag.nodesByCode[c].isMissing).join(', ')}]`);
  }
  const tally = {};
  for (const e of payload.events) for (const c of e.cells) {
    const r = app.statusModule.classifyCell(c, payload.classMeta, now);
    const k = r.completion + (r.flag ? ` [${r.flag}]` : '');
    tally[k] = (tally[k] || 0) + 1;
  }
  console.log('  cells:', JSON.stringify(tally));
  if (app.targets) {
    const cat = app.targets.buildCatalog(payload);
    const probe = q => `${JSON.stringify(q)}→${app.targets.search(cat, q).slice(0, 3).map(t => t.code).join(' / ') || '(none)'}`;
    console.log(`  target catalog: ${cat.length} entries · ` + ['tf7503f', 'capstone', '8332', 'sy 75'].map(probe).join(' · '));
  }
}

console.log(failures ? `\n${failures} invariant failure(s).` : '\nAll invariants hold.');
process.exit(failures ? 1 : 0);
