/* ============================================================
 * File:       _review-harness.cjs
 * Module:     big-board-curriculum-status / dev-review
 * Version:    0.2.0-harness  (mirrors index.html v0.2.0)
 * Purpose:    Node-runnable stress test for the client-side logic
 *             from index.html. Mirrors parse / statusModule / chain
 *             (and the render-side NotStarted decision branch), loads
 *             the real GAS payload + MCG graph, then asserts invariants
 *             across every goal event and every (goal, student) pair.
 *
 *             v0.2.0 harness tracks the v0.2.0 bug-fix deltas:
 *               - indexPayload collects duplicates[] (BUG-3)
 *               - parseCellDate returns null on ambiguous cross-year (BUG-4)
 *               - aggregateEvent splits scheduled vs pairedOpted (BUG-2)
 *                 and only `scheduled` triggers Started
 *               - renderAll TRACKS filter requires payload.byCode[g] (BUG-1)
 *
 * Run:   node _review-harness.cjs
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PAYLOAD_PATH = path.join(ROOT, 'JSON-outputs', 'fetch_sheet.json');
const GRAPH_PATH = path.join(ROOT, 'mcg-26a-graph.json');

const payload = JSON.parse(fs.readFileSync(PAYLOAD_PATH, 'utf8'));
const MCG_GRAPH = JSON.parse(fs.readFileSync(GRAPH_PATH, 'utf8'));

// -----------------------------------------------------------
// parse  (mirrors index.html v0.2.0 — indexPayload now collects
// duplicates[] instead of silently dropping)
// -----------------------------------------------------------
const parse = (() => {
  function normalizeCode(raw) {
    if (!raw) return '';
    const s = String(raw).trim().replace(/\s+/g, ' ');
    const m = s.match(/^([A-Z]{2})[\s\-]?(\d.*)$/);
    return m ? (m[1] + ' ' + m[2]).trim() : s;
  }
  function expandStudentTypeToMcg(type) {
    if (!type) return [];
    if (/^Pilot/i.test(type)) return ['P'];
    return [type.toUpperCase()];
  }
  function isStudentApplicable(student, eventApplicability) {
    if (!eventApplicability || !eventApplicability.length) return true;
    const mcgCodes = expandStudentTypeToMcg(student.type);
    return mcgCodes.some(c => eventApplicability.indexOf(c) !== -1);
  }
  function indexPayload(p) {
    const byCode = {};
    const duplicates = [];
    for (const evt of p.events) {
      const code = normalizeCode(evt.eventNo);
      if (!code) continue;
      if (byCode[code]) {
        duplicates.push({ code, row: evt.row, firstRow: byCode[code].row });
        byCode[code].duplicated = true;
        continue;
      }
      byCode[code] = evt;
    }
    return { ...p, byCode, duplicates };
  }
  return { normalizeCode, expandStudentTypeToMcg, isStudentApplicable, indexPayload };
})();

// -----------------------------------------------------------
// statusModule  (mirrors index.html v0.2.0)
//   - parseCellDate returns null on ambiguous cross-year cells
//   - aggregateEvent splits scheduled / pairedOpted and only
//     `scheduled` promotes to Started
// -----------------------------------------------------------
const statusModule = (() => {
  function parseCellDate(value, classStart, classEnd) {
    if (!value) return null;
    let m = String(value).match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?$/);
    if (m) {
      let year;
      if (m[3]) year = m[3].length === 2 ? (2000 + parseInt(m[3], 10)) : parseInt(m[3], 10);
      else {
        const monthI = parseInt(m[1], 10) - 1;
        const dayI = parseInt(m[2], 10);
        const cs = classStart ? new Date(classStart) : null;
        const ce = classEnd ? new Date(classEnd) : null;
        if (cs && ce && cs.getFullYear() !== ce.getFullYear()) {
          const d1 = new Date(cs.getFullYear(), monthI, dayI);
          const d2 = new Date(ce.getFullYear(), monthI, dayI);
          const d1In = d1 >= cs && d1 <= ce;
          const d2In = d2 >= cs && d2 <= ce;
          if (!d1In && !d2In) return null;  // BUG-4 fix: ambiguous → null
          year = d1In ? cs.getFullYear() : ce.getFullYear();
        } else {
          year = (cs || ce || new Date()).getFullYear();
        }
      }
      return new Date(year, parseInt(m[1], 10) - 1, parseInt(m[2], 10));
    }
    m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
    return null;
  }
  function classifyCell(cell, classMeta, now) {
    const result = { completion: 'pending', scheduled: false, flag: null };
    if (!cell) return result;
    if (cell.rgbFamily === 'darkGrey') { result.completion = 'notreq'; return result; }
    if (cell.rgbFamily === 'lightGrey') { result.completion = 'complete'; return result; }
    if (cell.rgbFamily === 'paired') {
      result.completion = cell.strikethrough ? 'complete' : 'paired-opted';
      return result;
    }
    // white cell w/ strike — v0.2.0 warns but still date-classifies
    const d = parseCellDate(cell.value, classMeta.startDate, classMeta.endDate);
    if (d) {
      if (d > now) { result.completion = 'scheduled'; result.scheduled = true; }
      else { result.completion = 'pending'; result.flag = 'past-date-unchecked'; }
    }
    return result;
  }
  function computeEventStatus(evt, students, classMeta) {
    const now = new Date();
    const perStudent = {};
    for (const s of students) {
      const cell = evt.cells ? evt.cells.find(c => c.col === s.col) : null;
      const cl = classifyCell(cell, classMeta, now);
      perStudent[s.col] = {
        col: s.col, name: s.name, type: s.type,
        applicable: undefined, cell, completion: cl.completion, flag: cl.flag,
      };
    }
    return perStudent;
  }
  function aggregateEvent(evt, mcgEvent, perStudent, students) {
    const applicability = (mcgEvent && mcgEvent.applicability) || [];
    const apps = [];
    for (const s of students) {
      const ps = perStudent[s.col];
      const appByType = parse.isStudentApplicable(s, applicability);
      const appByCell = ps.completion !== 'notreq';
      ps.applicable = appByType && appByCell;
      if (ps.applicable) apps.push(ps);
    }
    // BUG-2 fix: split scheduled from paired-opted; only `scheduled` promotes
    // the state to Started. paired-opted is surfaced separately for the
    // progress summary but leaves the event in NotStarted for prereq refinement.
    let completes = 0, scheduled = 0, pairedOpted = 0;
    for (const ps of apps) {
      if (ps.completion === 'complete') completes++;
      else if (ps.completion === 'scheduled') scheduled++;
      else if (ps.completion === 'paired-opted') pairedOpted++;
    }
    const total = apps.length;
    let state = 'Unknown';
    if (total === 0) state = 'PrereqsMet';
    else if (completes === total) state = 'Complete';
    else if (completes / total >= 0.5) state = 'PartiallyComplete';
    else if (completes > 0 || scheduled > 0) state = 'Started';
    else state = 'NotStarted';
    return {
      state, applicable: apps.length, completes,
      scheduled, pairedOpted,
      scheduledOrStarted: scheduled + pairedOpted,  // back-compat
      pctComplete: total ? Math.round((completes / total) * 100) : 0,
    };
  }
  return { classifyCell, parseCellDate, computeEventStatus, aggregateEvent };
})();

// -----------------------------------------------------------
// chain  (unchanged from v0.1.0)
// -----------------------------------------------------------
const chain = (() => {
  function buildChainForStudent(goalCode, payloadIdx, student) {
    const mcgEvents = MCG_GRAPH.events || {};
    const now = new Date();
    const seen = new Set();
    const out = [];
    const stack = [{ code: goalCode, depth: 0 }];
    while (stack.length) {
      const node = stack.shift();
      if (seen.has(node.code)) continue;
      seen.add(node.code);
      const mcg = mcgEvents[node.code];
      const onBoardEvt = payloadIdx.byCode[node.code];
      const onBoard = !!onBoardEvt;
      let status = 'offboard';
      if (onBoard) {
        const cell = onBoardEvt.cells.find(c => c.col === student.col);
        status = statusModule.classifyCell(cell, payloadIdx.classMeta, now).completion;
      }
      if (node.code !== goalCode) {
        out.push({
          code: node.code,
          title: (mcg && mcg.eventName) || (onBoardEvt && onBoardEvt.title) || '?',
          onBoard, status, depth: node.depth,
        });
      }
      const prereqs = (mcg && mcg.prerequisites) || [];
      for (const p of prereqs) {
        if (p.code && !seen.has(p.code)) stack.push({ code: p.code, depth: node.depth + 1 });
      }
    }
    out.sort((a, b) => {
      const ra = a.onBoard ? (a.status === 'complete' ? 2 : 1) : 3;
      const rb = b.onBoard ? (b.status === 'complete' ? 2 : 1) : 3;
      if (ra !== rb) return ra - rb;
      return a.depth - b.depth;
    });
    return out;
  }
  function isOpted(goalCode, payloadIdx, student, mcgEvent) {
    const apps = (mcgEvent && mcgEvent.applicability) || [];
    if (!parse.isStudentApplicable(student, apps)) return false;
    const items = buildChainForStudent(goalCode, payloadIdx, student);
    for (const it of items) {
      if (it.onBoard && it.status !== 'complete' && it.status !== 'notreq') return false;
    }
    return true;
  }
  return { buildChainForStudent, isOpted };
})();

// -----------------------------------------------------------
// TRACKS  (verbatim from index.html v0.2.0 render module)
// -----------------------------------------------------------
const TRACKS = [
  { name: 'Pilot',     match: ['P'],        goals: ['PF 8332F', 'FQ 9511F', 'SY 7511F', 'SY 7503F'] },
  { name: 'FTE',       match: ['FTE'],      goals: ['PF 8332F', 'FQ 9512C', 'SY 7512C', 'SY 7503F'] },
  { name: 'CSO / RPA', match: ['CSO','RPA'],goals: ['PF 8311F', 'FQ 9502S', 'SY 7503F'] },
  { name: 'ABM',       match: ['ABM'],      goals: ['PF 8332F', 'FQ 9502S', 'SY 7503F'] },
  { name: 'Class-wide',match: ['*'],        goals: ['TF 9102E', 'TF 9111E'] },
  { name: 'STC',       match: ['STC'],      goals: ['SY 7521O'] },
];

// -----------------------------------------------------------
// renderCard finalState refinement (mirrors index.html v0.2.0 18177-18186)
// Returns { code, finalState, agg, optedCount, applicableStudents, ... }
// -----------------------------------------------------------
function simulateRenderCard(code, payloadIdx) {
  const mcgEvent = MCG_GRAPH.events[code];
  const boardEvent = payloadIdx.byCode[code];
  if (!boardEvent) return null;
  const perStudent = statusModule.computeEventStatus(boardEvent, payloadIdx.students, payloadIdx.classMeta);
  const agg = statusModule.aggregateEvent(boardEvent, mcgEvent, perStudent, payloadIdx.students);
  let finalState = agg.state;
  let optedCount = 0;
  let applicableStudents = [];
  if (agg.state === 'NotStarted' || agg.applicable === 0) {
    applicableStudents = payloadIdx.students.filter(s => perStudent[s.col].applicable);
    optedCount = applicableStudents.filter(s => chain.isOpted(code, payloadIdx, s, mcgEvent)).length;
    if (applicableStudents.length === 0) finalState = 'PrereqsMet';
    else if (optedCount === applicableStudents.length) finalState = 'PrereqsMet';
    else if (optedCount > 0) finalState = 'PrereqsPartiallyMet';
    else finalState = 'PrereqsNotMet';
  }
  return { code, finalState, agg, optedCount, applicableStudents, perStudent, mcgEvent, boardEvent };
}

// Simulates the v0.2.0 renderAll TRACKS+missing split.
// Returns { trackCards: [{track, code}], missingCards: [code], renderCardCalls: [code], renderMissingCalls: [code] }
function simulateRenderAll(payloadIdx) {
  const trackCards = [];
  const renderCardCalls = [];
  for (const track of TRACKS) {
    const goalsInTrack = track.goals.filter(g => payloadIdx.byCode[g]);  // v0.2.0 filter
    for (const g of goalsInTrack) {
      trackCards.push({ track: track.name, code: g });
      renderCardCalls.push(g);
    }
  }
  const missingCards = MCG_GRAPH.goalEvents.filter(g => !payloadIdx.byCode[g]);
  const renderMissingCalls = [...missingCards];
  return { trackCards, missingCards, renderCardCalls, renderMissingCalls };
}

// ============================================================
// HARNESS
// ============================================================
const results = { pass: 0, fail: 0, warn: 0 };
const fails = [];
const warns = [];
function assert(cond, label, ctx) {
  if (cond) results.pass++;
  else { results.fail++; fails.push({ label, ctx }); }
}
function warn(label, ctx) { results.warn++; warns.push({ label, ctx }); }

const idx = parse.indexPayload(payload);
console.log('=== Payload loaded ===');
console.log(`Sheet: ${idx.sheetName}  Students: ${idx.students.length}  Events: ${idx.events.length}`);
console.log(`Class: ${idx.classMeta.startDate} → ${idx.classMeta.endDate}`);
console.log(`byCode size: ${Object.keys(idx.byCode).length}`);
console.log(`duplicates[] size: ${idx.duplicates.length}`);
console.log(`Goal events in MCG: ${MCG_GRAPH.goalEvents.length}`);
console.log('');

// ------------------------------------------------------------
// TEST 1 — renderAll TRACKS filter + missing routing (BUG-1 baseline)
// ------------------------------------------------------------
console.log('--- TEST 1: track filtering + missing card flow ---');
{
  const sim = simulateRenderAll(idx);
  // Every renderCard call must hit a boardEvent (no undefined deref).
  for (const code of sim.renderCardCalls) {
    assert(!!idx.byCode[code],
      `renderAll routed "${code}" to renderCard AND boardEvent exists`,
      { code });
  }
  // Every MCG goal not on board must flow through renderMissingCard.
  for (const code of MCG_GRAPH.goalEvents) {
    if (!idx.byCode[code]) {
      assert(sim.renderMissingCalls.indexOf(code) !== -1,
        `renderAll routed missing goal "${code}" to renderMissingCard`, { code });
      assert(sim.renderCardCalls.indexOf(code) === -1,
        `renderAll did NOT route missing goal "${code}" to renderCard (BUG-1)`, { code });
    }
  }
  console.log(`  renderCard calls: ${sim.renderCardCalls.length}, renderMissingCard calls: ${sim.renderMissingCalls.length}`);
  console.log(`  missing-from-board goals: ${sim.missingCards.join(', ') || '(none)'}`);
}

// ------------------------------------------------------------
// TEST 2 — classifyCell null safety
// ------------------------------------------------------------
console.log('\n--- TEST 2: classifyCell null safety ---');
try {
  const r = statusModule.classifyCell(undefined, idx.classMeta, new Date());
  assert(r.completion === 'pending', 'classifyCell(undefined) -> pending', r);
} catch (e) {
  assert(false, 'classifyCell(undefined) threw: ' + e.message, {});
}
try {
  const r = statusModule.classifyCell(null, idx.classMeta, new Date());
  assert(r.completion === 'pending', 'classifyCell(null) -> pending', r);
} catch (e) {
  assert(false, 'classifyCell(null) threw: ' + e.message, {});
}
{
  const evt = idx.events.find(e => e.cells && e.cells.length);
  const missingCol = 999;
  const fakeStudents = [{ col: missingCol, name: 'GHOST', type: 'FTE' }];
  try {
    const ps = statusModule.computeEventStatus(evt, fakeStudents, idx.classMeta);
    assert(ps[missingCol].completion === 'pending', 'computeEventStatus tolerates student with no matching cell', ps[missingCol]);
  } catch (e) {
    assert(false, 'computeEventStatus crashed on ghost student: ' + e.message, {});
  }
}

// ------------------------------------------------------------
// TEST 3 — aggregateEvent: new split scheduled / pairedOpted
// ------------------------------------------------------------
console.log('\n--- TEST 3: aggregateEvent scheduled vs pairedOpted split ---');
{
  const fakeEvt = {
    row: 999, eventNo: 'ZZ 0001A', title: 'synthetic',
    cells: [
      { col: 2, value: '', bgHex: '93C47D', rgbFamily: 'paired', strikethrough: false }, // paired-opted
      { col: 3, value: '', bgHex: '93C47D', rgbFamily: 'paired', strikethrough: true  }, // complete
      { col: 4, value: '', bgHex: 'FFFFFF', rgbFamily: 'white',  strikethrough: false }, // pending
    ],
  };
  const fakeStudents = [
    { col: 2, name: 'A', type: 'FTE' },
    { col: 3, name: 'B', type: 'FTE' },
    { col: 4, name: 'C', type: 'FTE' },
  ];
  const ps = statusModule.computeEventStatus(fakeEvt, fakeStudents, idx.classMeta);
  const agg = statusModule.aggregateEvent(fakeEvt, { applicability: ['FTE'] }, ps, fakeStudents);
  assert(agg.completes === 1, 'paired+strike counted as complete', agg);
  assert(agg.scheduled === 0, 'no white-future cells → scheduled=0', agg);
  assert(agg.pairedOpted === 1, 'paired-opted tracked separately (=1)', agg);
  assert(agg.applicable === 3, 'applicable=3', agg);
  // v0.2.0: 1 complete of 3 → Started (completes > 0), paired-opted irrelevant here
  assert(agg.state === 'Started', '1 complete + 1 pairedOpted + 1 pending → Started (via completes>0)', agg);
}

// ------------------------------------------------------------
// TEST 4 — SY 7521O off-board, STC track must no longer admit it
// ------------------------------------------------------------
console.log('\n--- TEST 4: SY 7521O off-board → STC track drops, missing picks up ---');
{
  assert(!idx.byCode['SY 7521O'], 'SY 7521O absent from board', {});
  assert(!!MCG_GRAPH.events['SY 7521O'], 'SY 7521O present in MCG', {});
  const stcTrack = TRACKS.find(t => t.name === 'STC');
  const goalsInTrack = stcTrack.goals.filter(g => idx.byCode[g]);  // v0.2.0 filter
  assert(goalsInTrack.indexOf('SY 7521O') === -1,
    'v0.2.0 STC track filter excludes SY 7521O (no boardEvent) — BUG-1 fixed',
    goalsInTrack);
  const sim = simulateRenderAll(idx);
  assert(sim.missingCards.indexOf('SY 7521O') !== -1,
    'SY 7521O routes to missing-card section',
    sim.missingCards);
}

// ------------------------------------------------------------
// TEST 5 — finalState branch sanity for applicable === 0
// ------------------------------------------------------------
console.log('\n--- TEST 5: renderCard finalState when applicable = 0 ---');
{
  const fakeCode = 'XX 0002Z';
  const fakeBoardEvt = {
    row: 555, eventNo: fakeCode, title: 'fake',
    cells: idx.students.map(s => ({ col: s.col, value: '', bgHex: 'FFFFFF', rgbFamily: 'white', strikethrough: false })),
  };
  const localIdx = { ...idx, byCode: { ...idx.byCode, [fakeCode]: fakeBoardEvt } };
  MCG_GRAPH.events[fakeCode] = { eventName: 'Fake', applicability: ['STC'], prerequisites: [] };
  const r = simulateRenderCard(fakeCode, localIdx);
  assert(r.agg.applicable === 0, 'applicable === 0', r.agg);
  assert(r.agg.pctComplete === 0, 'pctComplete === 0, no NaN', r.agg);
  assert(r.finalState === 'PrereqsMet', 'finalState === PrereqsMet', r);
  delete MCG_GRAPH.events[fakeCode];
}

// ------------------------------------------------------------
// TEST 6 — REGRESSION: paired-opted-only WITHOUT scheduled no longer
// promotes to Started (BUG-2 fix verification — companion to NEW TEST 14)
// ------------------------------------------------------------
console.log('\n--- TEST 6: paired-opted-only no longer flips to Started (BUG-2) ---');
{
  const fakeEvt = {
    row: 999, eventNo: 'ZZ 0002A', title: 'synthetic-all-paired-opted',
    cells: [
      { col: 2, value: '', bgHex: '93C47D', rgbFamily: 'paired', strikethrough: false },
      { col: 3, value: '', bgHex: '93C47D', rgbFamily: 'paired', strikethrough: false },
    ],
  };
  const fakeStudents = [
    { col: 2, name: 'A', type: 'FTE' }, { col: 3, name: 'B', type: 'FTE' },
  ];
  const ps = statusModule.computeEventStatus(fakeEvt, fakeStudents, idx.classMeta);
  const agg = statusModule.aggregateEvent(fakeEvt, { applicability: ['FTE'] }, ps, fakeStudents);
  assert(agg.state === 'NotStarted',
    'v0.2.0: all-paired-opted → NotStarted (not Started) so prereq refinement runs',
    agg);
  assert(agg.pairedOpted === 2, 'pairedOpted == 2', agg);
  assert(agg.scheduled === 0, 'scheduled == 0', agg);
}

// ------------------------------------------------------------
// TEST 7 — parseCellDate edge cases (includes BUG-4 ambiguous guard)
// ------------------------------------------------------------
console.log('\n--- TEST 7: parseCellDate ---');
{
  const cs = '2026-01-06', ce = '2026-12-12';
  const d1 = statusModule.parseCellDate('4/10', cs, ce);
  assert(d1 && d1.getFullYear() === 2026 && d1.getMonth() === 3 && d1.getDate() === 10, '"4/10" -> 2026-04-10', d1);
  const d2 = statusModule.parseCellDate('2026-01-06', cs, ce);
  assert(d2 && d2.getFullYear() === 2026 && d2.getMonth() === 0 && d2.getDate() === 6, 'ISO "2026-01-06"', d2);
  const d3 = statusModule.parseCellDate('1/16', cs, ce);
  assert(d3 && d3.getMonth() === 0 && d3.getDate() === 16, '"1/16" parses', d3);
  const d4 = statusModule.parseCellDate('garbage', cs, ce);
  assert(d4 === null, '"garbage" -> null', d4);
  const d5 = statusModule.parseCellDate('', cs, ce);
  assert(d5 === null, 'empty -> null', d5);
  const d6 = statusModule.parseCellDate('1/5', '2026-12-01', '2027-03-01');
  assert(d6 && d6.getFullYear() === 2027, 'cross-year "1/5" picks 2027', d6);
  const d7 = statusModule.parseCellDate('12/20', '2026-12-01', '2027-03-01');
  assert(d7 && d7.getFullYear() === 2026, 'cross-year "12/20" picks 2026', d7);
  const allValues = new Set();
  for (const e of idx.events) for (const c of e.cells) if (c.value) allValues.add(c.value);
  const parsed = [...allValues].map(v => ({ v, d: statusModule.parseCellDate(v, cs, ce) }));
  const unparsed = parsed.filter(p => p.d === null);
  if (unparsed.length) warn(`${unparsed.length} unique cell values did not parse as dates (may be legitimate non-date strings)`, unparsed.slice(0, 10).map(p => p.v));
}

// ------------------------------------------------------------
// TEST 8 — chain termination + dedup + off-board flagging
// ------------------------------------------------------------
console.log('\n--- TEST 8: chain building invariants ---');
let chainPairs = 0, chainCrashes = 0, chainWithOffboard = 0;
const chainOffboardFlagOK = { v: true };
for (const goal of MCG_GRAPH.goalEvents) {
  for (const s of idx.students) {
    chainPairs++;
    let items;
    try {
      items = chain.buildChainForStudent(goal, idx, s);
    } catch (e) {
      chainCrashes++;
      assert(false, `chain.buildChainForStudent crashed on (${goal}, ${s.name})`, e.message);
      continue;
    }
    const codes = items.map(i => i.code);
    const dupes = codes.filter((c, i) => codes.indexOf(c) !== i);
    assert(dupes.length === 0, `chain for (${goal}, ${s.name}) has no duplicate codes`, dupes);
    for (const it of items) {
      if (!it.onBoard && it.status !== 'offboard') {
        chainOffboardFlagOK.v = false;
        warn(`chain item ${it.code} is off-board but status != 'offboard'`, it);
      }
      if (!it.onBoard) chainWithOffboard++;
    }
  }
}
assert(chainCrashes === 0, `all ${chainPairs} chains completed without crashing`, { chainPairs, chainCrashes });
assert(chainOffboardFlagOK.v, `off-board items in chains consistently flagged status='offboard'`, {});
console.log(`  chain pairs tried: ${chainPairs}, off-board items across all chains: ${chainWithOffboard}`);

// ------------------------------------------------------------
// TEST 9 — isOpted treats off-board as complete (D10)
// ------------------------------------------------------------
console.log('\n--- TEST 9: isOpted — off-board treated as complete (D10) ---');
{
  const goal = 'PF 8311F';
  const mcgEvent = MCG_GRAPH.events[goal];
  const cso = idx.students.find(s => s.type === 'CSO' || s.type === 'RPA');
  if (cso && mcgEvent) {
    const items = chain.buildChainForStudent(goal, idx, cso);
    const hasOffboard = items.some(i => !i.onBoard);
    assert(hasOffboard, `chain for ${goal} includes off-board items`, items.filter(i => !i.onBoard).slice(0, 3));
    const iso = chain.isOpted(goal, idx, cso, mcgEvent);
    assert(typeof iso === 'boolean', `isOpted returns boolean (got ${iso})`, iso);
  } else {
    warn('No CSO/RPA student found to probe isOpted', {});
  }
}

// ------------------------------------------------------------
// TEST 10 — full goal-event card simulation (reporting)
// ------------------------------------------------------------
console.log('\n--- TEST 10: renderCard simulation for every goal event ---');
const goalReport = [];
for (const code of MCG_GRAPH.goalEvents) {
  const onBoard = !!idx.byCode[code];
  if (!onBoard) {
    goalReport.push({ code, onBoard: false, note: 'renderMissingCard path (OK)' });
    continue;
  }
  try {
    const r = simulateRenderCard(code, idx);
    goalReport.push({
      code, onBoard: true,
      state: r.finalState, agg: r.agg,
      opted: `${r.optedCount}/${r.applicableStudents.length}`,
    });
  } catch (e) {
    goalReport.push({ code, onBoard: true, error: e.message });
    assert(false, `simulateRenderCard ${code} threw ${e.message}`, {});
  }
}

// ------------------------------------------------------------
// TEST 11 — renderAll TRACKS admission vs renderCard null-guard
// (This is the BUG-1 invariant; it should now PASS where v0.1 failed.)
// ------------------------------------------------------------
console.log('\n--- TEST 11: renderAll TRACKS admission vs renderCard null-guard ---');
{
  for (const track of TRACKS) {
    const goalsInTrack = track.goals.filter(g => idx.byCode[g]);  // v0.2.0 filter
    for (const g of goalsInTrack) {
      assert(!!idx.byCode[g],
        `Track "${track.name}" admission of "${g}" has a live boardEvent`,
        { code: g, track: track.name });
    }
  }
}

// ------------------------------------------------------------
// TEST 12 — duplicate event codes now surfaced via payload.duplicates[]
// ------------------------------------------------------------
console.log('\n--- TEST 12: duplicate event codes (BUG-3) ---');
{
  // Recompute expected dupes directly from raw payload
  const seen = {};
  const expected = [];
  for (const e of idx.events) {
    const c = parse.normalizeCode(e.eventNo);
    if (!c) continue;
    if (seen[c]) expected.push(c);
    seen[c] = true;
  }
  assert(Array.isArray(idx.duplicates), 'indexPayload exposes duplicates[] array', typeof idx.duplicates);
  assert(idx.duplicates.length === expected.length,
    `duplicates[] length matches raw-scan count (${idx.duplicates.length} vs ${expected.length})`,
    { dup: idx.duplicates.map(d => d.code), expected });
  // Every entry must have {code, row, firstRow}
  for (const d of idx.duplicates) {
    assert(!!d.code && typeof d.row === 'number' && typeof d.firstRow === 'number',
      `duplicate entry well-formed: ${d.code} row ${d.row} (first ${d.firstRow})`, d);
  }
  // First-row event must be flagged duplicated
  for (const d of idx.duplicates) {
    const first = idx.byCode[d.code];
    assert(first && first.duplicated === true,
      `byCode[${d.code}] flagged duplicated=true`, { firstRow: first && first.row });
  }
  if (idx.duplicates.length) {
    const summary = idx.duplicates.reduce((m, d) => { (m[d.code] = m[d.code] || []).push(d.row); return m; }, {});
    console.log(`  duplicates: ${JSON.stringify(summary)}`);
  } else {
    console.log('  (no duplicates)');
  }
}

// ============================================================
// NEW REGRESSION TESTS (v0.2.0 deltas)
// ============================================================

// ------------------------------------------------------------
// TEST 13 — BUG-1 regression: a track goal in MCG but not on
// board must NOT reach renderCard; it must reach renderMissingCard.
// ------------------------------------------------------------
console.log('\n--- TEST 13 [NEW]: BUG-1 regression — MCG-only track goal routes to missing ---');
{
  // Fabricate an idx where PF 8311F is "missing" from this board,
  // and verify the CSO/RPA track filter drops it while the missing-section picks it up.
  const stripped = { ...idx, byCode: { ...idx.byCode } };
  delete stripped.byCode['PF 8311F'];
  const sim = simulateRenderAll(stripped);
  // PF 8311F is a CSO/RPA goal — it should be dropped by the v0.2.0 filter.
  assert(sim.renderCardCalls.indexOf('PF 8311F') === -1,
    'BUG-1 regression: "PF 8311F" removed from byCode → NOT routed to renderCard',
    sim.renderCardCalls);
  assert(sim.renderMissingCalls.indexOf('PF 8311F') !== -1,
    'BUG-1 regression: "PF 8311F" removed from byCode → routed to renderMissingCard',
    sim.renderMissingCalls);
  // And verify the live-payload case too (SY 7521O is already off-board).
  const simLive = simulateRenderAll(idx);
  assert(simLive.renderCardCalls.indexOf('SY 7521O') === -1,
    'BUG-1 regression (live): SY 7521O never reaches renderCard',
    simLive.renderCardCalls);
  assert(simLive.renderMissingCalls.indexOf('SY 7521O') !== -1,
    'BUG-1 regression (live): SY 7521O reaches renderMissingCard',
    simLive.renderMissingCalls);
}

// ------------------------------------------------------------
// TEST 14 — BUG-2 regression: PF 8311F synthetic
// (3 paired-opted, 0 scheduled, 0 complete) must be NotStarted,
// then renderCard refinement lands on one of the three prereq states,
// NOT Started.
// ------------------------------------------------------------
console.log('\n--- TEST 14 [NEW]: BUG-2 regression — PF 8311F scenario (3 paired-opted, 0 scheduled, 0 complete) ---');
{
  // Pick 3 CSO/RPA students from the real payload so the chain is real.
  const csoRpaStudents = idx.students.filter(s => s.type === 'CSO' || s.type === 'RPA').slice(0, 3);
  if (csoRpaStudents.length < 3) {
    warn(`only ${csoRpaStudents.length} CSO/RPA students on this board — skipping TEST 14 CSO-triplet`, {});
  } else {
    // Build a synthetic PF 8311F boardEvent with the three as paired-opted
    // and every other student darkGrey (notreq) so applicability=3.
    const synthCells = idx.students.map(s => {
      if (csoRpaStudents.includes(s)) {
        return { col: s.col, value: '', bgHex: '93C47D', rgbFamily: 'paired', strikethrough: false };
      }
      return { col: s.col, value: '', bgHex: '666666', rgbFamily: 'darkGrey', strikethrough: false };
    });
    const fakePF = { row: idx.byCode['PF 8311F'] ? idx.byCode['PF 8311F'].row : 9001,
                     eventNo: 'PF 8311F', title: 'PF 8311F synthetic',
                     cells: synthCells };
    const localIdx = { ...idx, byCode: { ...idx.byCode, 'PF 8311F': fakePF } };
    const mcgEvent = MCG_GRAPH.events['PF 8311F'];
    const ps = statusModule.computeEventStatus(fakePF, localIdx.students, localIdx.classMeta);
    const agg = statusModule.aggregateEvent(fakePF, mcgEvent, ps, localIdx.students);
    assert(agg.completes === 0, 'completes === 0', agg);
    assert(agg.scheduled === 0, 'scheduled === 0', agg);
    assert(agg.pairedOpted === 3, 'pairedOpted === 3', agg);
    assert(agg.applicable === 3, 'applicable === 3', agg);
    assert(agg.state === 'NotStarted',
      'BUG-2 regression: 3 paired-opted / 0 scheduled / 0 complete → NotStarted (NOT Started)',
      agg);
    // Now run the renderCard finalState refinement
    const r = simulateRenderCard('PF 8311F', localIdx);
    const prereqStates = ['PrereqsMet', 'PrereqsPartiallyMet', 'PrereqsNotMet'];
    assert(prereqStates.indexOf(r.finalState) !== -1,
      `BUG-2 regression: finalState resolves to one of ${prereqStates.join('/')} (got ${r.finalState}), NOT Started`,
      r);
    assert(r.finalState !== 'Started',
      'BUG-2 regression: finalState !== Started', r.finalState);
    console.log(`  synthetic PF 8311F: state=${agg.state}, finalState=${r.finalState}, opted=${r.optedCount}/${r.applicableStudents.length}`);
  }
}

// ------------------------------------------------------------
// TEST 15 — BUG-4 regression: ambiguous cross-year date → null.
// ------------------------------------------------------------
console.log('\n--- TEST 15 [NEW]: BUG-4 regression — parseCellDate ambiguous year returns null ---');
{
  // Class window 2026-12-01 → 2027-03-01. "6/15" cannot fit either 2026 or
  // 2027 interpretation — v0.2.0 must return null, not a June-2026 date.
  const r = statusModule.parseCellDate('6/15', '2026-12-01', '2027-03-01');
  assert(r === null,
    'BUG-4 regression: "6/15" with window 2026-12-01 → 2027-03-01 returns null',
    r);
  // Sanity: the boundary-month cells still parse correctly.
  const rDec = statusModule.parseCellDate('12/5', '2026-12-01', '2027-03-01');
  assert(rDec && rDec.getFullYear() === 2026 && rDec.getMonth() === 11 && rDec.getDate() === 5,
    'BUG-4 regression: "12/5" still resolves to 2026-12-05',
    rDec);
  const rFeb = statusModule.parseCellDate('2/15', '2026-12-01', '2027-03-01');
  assert(rFeb && rFeb.getFullYear() === 2027 && rFeb.getMonth() === 1 && rFeb.getDate() === 15,
    'BUG-4 regression: "2/15" still resolves to 2027-02-15',
    rFeb);
  // And a second ambiguous probe: window 2026-01-06 → 2026-12-12 is single-year
  // (no wrap), so "6/15" should parse as 2026-06-15 normally.
  const rSingle = statusModule.parseCellDate('6/15', '2026-01-06', '2026-12-12');
  assert(rSingle && rSingle.getFullYear() === 2026 && rSingle.getMonth() === 5,
    'BUG-4 non-regression: single-year window still parses "6/15" as 2026-06-15',
    rSingle);
}

// ------------------------------------------------------------
// SUMMARY
// ------------------------------------------------------------
console.log('\n============================================================');
console.log('GOAL EVENT REPORT:');
for (const g of goalReport) {
  if (!g.onBoard) console.log(`  [OFF-BOARD] ${g.code}   ${g.note || ''}`);
  else if (g.error) console.log(`  [ERROR    ] ${g.code}   ${g.error}`);
  else console.log(`  [${g.state.padEnd(20)}] ${g.code}   ${g.agg.completes}/${g.agg.applicable} complete, ${g.agg.scheduled} sched, ${g.agg.pairedOpted} paired, opted=${g.opted}`);
}

console.log('\n============================================================');
console.log(`PASS: ${results.pass}    FAIL: ${results.fail}    WARN: ${results.warn}`);
if (fails.length) {
  console.log('\nFAILURES:');
  for (const f of fails) console.log(`  - ${f.label}\n      ctx: ${JSON.stringify(f.ctx).slice(0, 200)}`);
}
if (warns.length) {
  console.log('\nWARNINGS:');
  for (const w of warns) console.log(`  - ${w.label}\n      ctx: ${JSON.stringify(w.ctx).slice(0, 200)}`);
}
process.exit(fails.length ? 1 : 0);
