/* _dag-harness.cjs — pure-logic validation of the v0.3.0 DAG in index.html
 *
 * Loads the real GAS payload + mcg-26a-graph.json and re-runs the DAG
 * primitives from index.html verbatim. Reports per-goal DAG stats,
 * two student-view layouts, and a handful of invariant checks.
 */
'use strict';

const path = require('path');
const fs = require('fs');

const PAYLOAD = JSON.parse(fs.readFileSync(
  path.join(__dirname, 'JSON-outputs', 'fetch_sheet.json'), 'utf8'));
const MCG_GRAPH = JSON.parse(fs.readFileSync(
  path.join(__dirname, 'mcg-26a-graph.json'), 'utf8'));

// ---------- copied verbatim from index.html ----------

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

function roleBucket(studentType) {
  if (!studentType) return null;
  if (/^Pilot/i.test(studentType)) return 'pilot';
  if (['ABM','FTE','CSO','RPA'].indexOf(studentType) !== -1) return 'crew';
  return 'crew';
}

function bandForPct(pct, applicable) {
  if (applicable === 0) return 's-none';
  if (pct >= 75) return 's-green';
  if (pct > 0)   return 's-yellow';
  return 's-none';
}

function parseCellDate(value, classStart, classEnd) {
  if (!value) return null;
  let m = String(value).match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?$/);
  if (m) {
    let year;
    if (m[3]) year = m[3].length === 2 ? (2000 + parseInt(m[3],10)) : parseInt(m[3],10);
    else {
      const monthI = parseInt(m[1],10) - 1;
      const dayI = parseInt(m[2],10);
      const cs = classStart ? new Date(classStart) : null;
      const ce = classEnd ? new Date(classEnd) : null;
      if (cs && ce && cs.getFullYear() !== ce.getFullYear()) {
        const d1 = new Date(cs.getFullYear(), monthI, dayI);
        const d2 = new Date(ce.getFullYear(), monthI, dayI);
        const d1In = d1 >= cs && d1 <= ce;
        const d2In = d2 >= cs && d2 <= ce;
        if (!d1In && !d2In) return null;
        year = d1In ? cs.getFullYear() : ce.getFullYear();
      } else {
        year = (cs || ce || new Date()).getFullYear();
      }
    }
    return new Date(year, parseInt(m[1],10) - 1, parseInt(m[2],10));
  }
  m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
  return null;
}

function classifyCell(cell, classMeta, now) {
  // v0.3.3: surfaces `dateText`; compares at day precision so a cell dated
  // today is SCHEDULED, not past-date-unchecked.
  const result = { completion: 'pending', scheduled: false, flag: null, dateText: null };
  if (!cell) return result;
  if (cell.rgbFamily === 'darkGrey') { result.completion = 'notreq'; return result; }
  if (cell.rgbFamily === 'lightGrey') {
    result.completion = 'complete';
    if (cell.value) result.dateText = String(cell.value);
    return result;
  }
  if (cell.rgbFamily === 'paired') {
    result.completion = cell.strikethrough ? 'complete' : 'paired-opted';
    if (cell.value) result.dateText = String(cell.value);
    return result;
  }
  const d = parseCellDate(cell.value, classMeta.startDate, classMeta.endDate);
  if (d) {
    result.dateText = String(cell.value);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (d >= today) { result.completion = 'scheduled'; result.scheduled = true; }
    else { result.completion = 'pending'; result.flag = 'past-date-unchecked'; }
  }
  return result;
}

function computeEventStatus(evt, students, classMeta) {
  const now = new Date();
  const perStudent = {};
  for (const s of students) {
    const cell = evt.cells ? evt.cells.find(c => c.col === s.col) : null;
    const classified = classifyCell(cell, classMeta, now);
    perStudent[s.col] = {
      col: s.col, name: s.name, type: s.type,
      applicable: undefined, cell,
      completion: classified.completion, flag: classified.flag,
      dateText: classified.dateText,
    };
  }
  return perStudent;
}

function aggregateEvent(evt, mcgEvent, perStudent, students) {
  const applicability = (mcgEvent && mcgEvent.applicability) || [];
  const apps = [];
  for (const s of students) {
    const ps = perStudent[s.col];
    const appByType = isStudentApplicable(s, applicability);
    const appByCell = ps.completion !== 'notreq';
    ps.applicable = appByType && appByCell;
    if (ps.applicable) apps.push(ps);
  }
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
    state, applicable: apps.length, completes, scheduled, pairedOpted,
    pctComplete: total ? Math.round((completes / total) * 100) : 0,
  };
}

function indexPayload(payload) {
  const byCode = {};
  const duplicates = [];
  for (const evt of payload.events) {
    const code = normalizeCode(evt.eventNo);
    if (!code) continue;
    if (byCode[code]) { duplicates.push({ code, row: evt.row, firstRow: byCode[code].row }); continue; }
    byCode[code] = evt;
  }
  return { ...payload, byCode, duplicates };
}

// Verbatim buildDag from index.html (semantics preserved; we use a pointer
// instead of Array.shift so iteration cost doesn't dominate the wall clock).
// This exposes the re-enqueue blow-up without making the harness O(n^2) on
// top of it.
function buildDag(goalCode, payload) {
  const nodesByCode = {};
  const edges = [];
  if (!payload.byCode[goalCode]) return { nodesByCode, edges, maxDepth: 0, iters: 0, capped: false };
  const queue = [{ code: goalCode, depth: 0 }];
  let qHead = 0;
  const seenEdges = new Set();
  let maxDepth = 0;
  let iters = 0, ITER_CAP = 50000;
  while (qHead < queue.length) {
    if (++iters > ITER_CAP) {
      return { nodesByCode, edges, maxDepth, iters, capped: true };
    }
    const { code, depth } = queue[qHead++];
    const prior = nodesByCode[code];
    if (prior) { if (depth > prior.depth) prior.depth = depth; }
    else { nodesByCode[code] = { code, depth }; }
    maxDepth = Math.max(maxDepth, nodesByCode[code].depth);
    const mcg = MCG_GRAPH.events[code];
    const prereqs = (mcg && mcg.prerequisites) || [];
    for (const p of prereqs) {
      if (!p.code) continue;
      if (!payload.byCode[p.code]) continue;
      const eKey = `${p.code}→${code}`;
      if (!seenEdges.has(eKey)) { seenEdges.add(eKey); edges.push({ from: p.code, to: code }); }
      queue.push({ code: p.code, depth: depth + 1 });
    }
  }
  return { nodesByCode, edges, maxDepth, iters, capped: false };
}

// "First-visit-wins" cycle-safe BFS. Each code gets its shortest-path depth
// from the goal and we stop. This is what users would expect from a
// visualization when cycles exist — the opposite of index.html's
// longest-path-wins rule (which diverges on cycles).
function buildDagShortest(goalCode, payload) {
  const nodesByCode = {};
  const edges = [];
  if (!payload.byCode[goalCode]) return { nodesByCode, edges, maxDepth: 0 };
  const queue = [{ code: goalCode, depth: 0 }];
  let qHead = 0;
  const seenEdges = new Set();
  let maxDepth = 0;
  while (qHead < queue.length) {
    const { code, depth } = queue[qHead++];
    if (nodesByCode[code]) continue; // first visit wins
    nodesByCode[code] = { code, depth };
    maxDepth = Math.max(maxDepth, depth);
    const mcg = MCG_GRAPH.events[code];
    const prereqs = (mcg && mcg.prerequisites) || [];
    for (const p of prereqs) {
      if (!p.code) continue;
      if (!payload.byCode[p.code]) continue;
      const eKey = `${p.code}→${code}`;
      if (!seenEdges.has(eKey)) { seenEdges.add(eKey); edges.push({ from: p.code, to: code }); }
      if (!nodesByCode[p.code]) queue.push({ code: p.code, depth: depth + 1 });
    }
  }
  return { nodesByCode, edges, maxDepth };
}

// Cycle-safe variant of index.html's "longest path wins" rule, capped at
// the on-board node count so cycles still converge. When no cycle exists,
// this matches the verbatim function exactly.
function buildDagSafe(goalCode, payload) {
  const nodesByCode = {};
  const edges = [];
  if (!payload.byCode[goalCode]) return { nodesByCode, edges, maxDepth: 0 };
  const DEPTH_CAP = Object.keys(payload.byCode).length + 1;
  const queue = [{ code: goalCode, depth: 0 }];
  let qHead = 0;
  const seenEdges = new Set();
  let maxDepth = 0;
  while (qHead < queue.length) {
    const { code, depth } = queue[qHead++];
    if (depth > DEPTH_CAP) continue;
    const prior = nodesByCode[code];
    if (prior && depth <= prior.depth) continue;
    if (prior) prior.depth = depth;
    else nodesByCode[code] = { code, depth };
    maxDepth = Math.max(maxDepth, nodesByCode[code].depth);
    const mcg = MCG_GRAPH.events[code];
    const prereqs = (mcg && mcg.prerequisites) || [];
    for (const p of prereqs) {
      if (!p.code) continue;
      if (!payload.byCode[p.code]) continue;
      const eKey = `${p.code}→${code}`;
      if (!seenEdges.has(eKey)) { seenEdges.add(eKey); edges.push({ from: p.code, to: code }); }
      queue.push({ code: p.code, depth: depth + 1 });
    }
  }
  return { nodesByCode, edges, maxDepth };
}

function computeNodeAggregate(code, payload) {
  const boardEvent = payload.byCode[code];
  const mcgEvent = MCG_GRAPH.events[code];
  const perStudent = computeEventStatus(boardEvent, payload.students, payload.classMeta);
  const agg = aggregateEvent(boardEvent, mcgEvent, perStudent, payload.students);
  return { boardEvent, mcgEvent, perStudent, agg };
}

// student-view chain walker (replicates chain.buildChainForStudent)
function buildChainForStudent(goalCode, payload, student) {
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
    const onBoardEvt = payload.byCode[node.code];
    const onBoard = !!onBoardEvt;
    let status = 'offboard';
    if (onBoard) {
      const cell = onBoardEvt.cells.find(c => c.col === student.col);
      status = classifyCell(cell, payload.classMeta, now).completion;
    }
    if (node.code !== goalCode) out.push({ code: node.code, onBoard, status, depth: node.depth });
    const prereqs = (mcg && mcg.prerequisites) || [];
    for (const p of prereqs) if (p.code && !seen.has(p.code)) stack.push({ code: p.code, depth: node.depth + 1 });
  }
  return out;
}

function isOpted(goalCode, payload, student, mcgEvent) {
  const apps = (mcgEvent && mcgEvent.applicability) || [];
  if (!isStudentApplicable(student, apps)) return false;
  const items = buildChainForStudent(goalCode, payload, student);
  for (const it of items) {
    if (it.onBoard && it.status !== 'complete' && it.status !== 'notreq') return false;
  }
  return true;
}

function computeNodeForStudent(code, payload, student) {
  const boardEvent = payload.byCode[code];
  const mcgEvent = MCG_GRAPH.events[code];
  if (!boardEvent) return { applicable: false };
  const apps = (mcgEvent && mcgEvent.applicability) || [];
  const applicable = isStudentApplicable(student, apps);
  if (!applicable) return { applicable: false };
  const cell = boardEvent.cells.find(c => c.col === student.col);
  const classified = classifyCell(cell, payload.classMeta, new Date());
  if (classified.completion === 'notreq') return { applicable: false };
  const isComplete = classified.completion === 'complete';
  const opted = isOpted(code, payload, student, mcgEvent);
  return {
    applicable: true,
    completion: classified.completion,
    isComplete,
    opted,
    dateText: classified.dateText,
  };
}

function layoutDag(dag, payload, { mode, student }) {
  const tiers = [];
  for (let d = 0; d <= dag.maxDepth; d++) tiers.push([]);
  const visible = new Set();
  for (const code of Object.keys(dag.nodesByCode)) {
    if (mode === 'student' && student) {
      const info = computeNodeForStudent(code, payload, student);
      if (!info.applicable && dag.nodesByCode[code].depth !== 0) continue;
    } else {
      const { agg } = computeNodeAggregate(code, payload);
      if (agg.applicable === 0 && dag.nodesByCode[code].depth !== 0) continue;
    }
    visible.add(code);
    tiers[dag.nodesByCode[code].depth].push(code);
  }
  const edges = dag.edges.filter(e => visible.has(e.from) && visible.has(e.to));
  for (const t of tiers) t.sort();
  return { tiers, edges, visible };
}

// ---------- run validation ----------

const payload = indexPayload(PAYLOAD);
const GOALS = MCG_GRAPH.goalEvents || [];
const onBoardGoals = GOALS.filter(g => payload.byCode[g]);
const offBoardGoals = GOALS.filter(g => !payload.byCode[g]);

const invariants = [];
function check(name, ok, extra) {
  if (!ok) invariants.push({ name, extra });
}

// Invariant: roleBucket never null for any student
for (const s of payload.students) {
  check(`roleBucket("${s.type}") non-null for ${s.name}`,
    roleBucket(s.type) !== null, { type: s.type });
}

// Invariant: isStudentApplicable returns true for unrestricted
for (const s of payload.students) {
  check(`isStudentApplicable unrestricted → true (${s.name})`,
    isStudentApplicable(s, []) === true);
  check(`isStudentApplicable null apps → true (${s.name})`,
    isStudentApplicable(s, null) === true);
}

console.log('='.repeat(78));
console.log('v0.3.0 DAG HARNESS');
console.log('='.repeat(78));
console.log(`Payload: ${payload.events.length} events, ${payload.students.length} students`);
console.log(`MCG:     ${Object.keys(MCG_GRAPH.events).length} events, ${GOALS.length} goalEvents`);
console.log(`On-board goals: ${onBoardGoals.length}   Off-board: ${offBoardGoals.join(', ') || 'none'}`);
console.log();

// ---- Cycle detection in MCG, restricted to on-board events ----
console.log('CYCLE CHECK (on-board subgraph)');
console.log('-'.repeat(78));
{
  const WHITE=0, GREY=1, BLACK=2;
  const color = {};
  const trail = [];
  const onBoardCycles = [];
  function dfs(code) {
    if (!payload.byCode[code]) return;
    if (color[code] === GREY) {
      const idx = trail.indexOf(code);
      onBoardCycles.push(trail.slice(idx).concat(code));
      return;
    }
    if (color[code] === BLACK) return;
    color[code] = GREY; trail.push(code);
    const mcg = MCG_GRAPH.events[code];
    const prs = (mcg && mcg.prerequisites) || [];
    for (const p of prs) if (p.code && payload.byCode[p.code]) dfs(p.code);
    trail.pop(); color[code] = BLACK;
  }
  for (const c of Object.keys(payload.byCode)) dfs(c);
  if (!onBoardCycles.length) console.log('  No cycles in on-board subgraph.');
  else {
    console.log(`  ${onBoardCycles.length} cycle(s) found in on-board subgraph:`);
    for (const c of onBoardCycles.slice(0, 10)) console.log('    ' + c.join(' → '));
  }
}
console.log();

// ---- Per-goal summary ----
console.log('PER-GOAL DAG SUMMARY (class view; using cycle-safe BFS)');
console.log('-'.repeat(78));
const header = ['goal','nodes','maxD','tiers (d=cnt)','visCls','g/y/r/goal','verbatim'];
console.log(header.map(h => h.padEnd(13)).join('| '));

for (const g of onBoardGoals) {
  // Run verbatim once to detect blow-up
  const dagVerbatim = buildDag(g, payload);
  const verbatimNote = dagVerbatim.capped
    ? `CAP@${dagVerbatim.iters}`
    : `ok(${dagVerbatim.iters})`;
  // Use shortest-path (first-visit-wins) version for the "expected" DAG
  // shape; this is what the UI should render.
  const dag = buildDagShortest(g, payload);
  const codes = Object.keys(dag.nodesByCode);

  // tier counts from raw dag
  const tierCounts = [];
  for (let d = 0; d <= dag.maxDepth; d++) tierCounts.push(0);
  for (const c of codes) tierCounts[dag.nodesByCode[c].depth]++;

  // invariant: each code appears at exactly one depth (trivially true by map)
  // stronger: no two tiers claim the same code — verify by summing
  const totalByTier = tierCounts.reduce((a,b)=>a+b,0);
  check(`[${g}] tier counts sum == node count`, totalByTier === codes.length,
    { totalByTier, nodeCount: codes.length });

  // class-view layout
  const layout = layoutDag(dag, payload, { mode: 'class' });
  const visCount = [...layout.visible].length;
  let green=0, yellow=0, red=0, goalCount=0;
  for (const c of layout.visible) {
    if (c === g) { goalCount++; continue; }
    const { agg } = computeNodeAggregate(c, payload);
    const band = bandForPct(agg.pctComplete, agg.applicable);
    if (band === 's-green') green++;
    else if (band === 's-yellow') yellow++;
    else red++; // includes s-none (0% / 0 applicable after filtering)
  }

  // edge-endpoint invariant
  for (const e of layout.edges) {
    check(`[${g}] edge endpoint visible: ${e.from}→${e.to}`,
      layout.visible.has(e.from) && layout.visible.has(e.to));
  }

  // For goals where verbatim didn't cap, node set should match safe BFS
  if (!dagVerbatim.capped) {
    const vCodes = new Set(Object.keys(dagVerbatim.nodesByCode));
    const sCodes = new Set(Object.keys(dag.nodesByCode));
    const sameSize = vCodes.size === sCodes.size;
    const allIn = [...vCodes].every(c => sCodes.has(c));
    check(`[${g}] verbatim buildDag matches safe (node set)`, sameSize && allIn,
      { verbatim: vCodes.size, safe: sCodes.size });
  }

  // Invariant: no code appears in more than one tier
  const tierOf = {};
  for (const c of codes) {
    if (tierOf[c] !== undefined && tierOf[c] !== dag.nodesByCode[c].depth) {
      check(`[${g}] node ${c} appears in multiple tiers`, false);
    }
    tierOf[c] = dag.nodesByCode[c].depth;
  }

  const tierStr = tierCounts.map((n,i)=>n?`${i}=${n}`:null).filter(Boolean).join(',');
  console.log([
    g.padEnd(13),
    String(codes.length).padEnd(13),
    String(dag.maxDepth).padEnd(13),
    tierStr.padEnd(13),
    String(visCount).padEnd(13),
    `${green}/${yellow}/${red}/${goalCount}`.padEnd(13),
    verbatimNote,
  ].join('| '));
}

// ---- Student-view spot checks ----
console.log();
console.log('STUDENT-VIEW LAYOUTS');
console.log('-'.repeat(78));

const cRyan = payload.students.find(s => s.name === 'C RYAN');
const fRoot = payload.students.find(s => s.name === 'F ROOT');

function describeStudentView(studentName, student, goal) {
  if (!student) { console.log(`  ${studentName}: NOT FOUND in payload`); return; }
  const dag = buildDagShortest(goal, payload);
  const layout = layoutDag(dag, payload, { mode: 'student', student });
  const visible = [...layout.visible];
  console.log(`\n  ${studentName} (${student.type}, col ${student.col}) × goal ${goal}`);
  console.log(`    DAG total nodes: ${Object.keys(dag.nodesByCode).length}, maxDepth ${dag.maxDepth}`);
  console.log(`    Visible in student view: ${visible.length}`);
  let done=0, opted=0, blocked=0, goalPresent=false;
  const sample = [];
  for (const c of visible) {
    if (c === goal) { goalPresent = true; continue; }
    const info = computeNodeForStudent(c, payload, student);
    const status = info.isComplete ? 'DONE' : info.opted ? 'OPTED' : 'BLOCKED';
    if (status === 'DONE') done++;
    else if (status === 'OPTED') opted++;
    else blocked++;
    if (sample.length < 5) sample.push(`${c}=${status}`);
  }
  console.log(`    Goal kept: ${goalPresent}`);
  console.log(`    Status:    DONE=${done}, OPTED=${opted}, BLOCKED=${blocked}`);
  console.log(`    Sample:    ${sample.join('  ')}`);

  // Invariant: every non-goal visible node must be applicable
  for (const c of visible) {
    if (c === goal) continue;
    const info = computeNodeForStudent(c, payload, student);
    check(`[${studentName}/${goal}] visible non-goal ${c} applicable`, info.applicable);
  }
  // Invariant: goal always kept
  check(`[${studentName}/${goal}] goal kept`, goalPresent);
}

describeStudentView('C RYAN', cRyan, 'PF 8311F');
describeStudentView('F ROOT', fRoot, 'PF 8332F');

// ---- Chain-terminates sanity (verbatim index.html BFS) ----
for (const g of onBoardGoals) {
  const d = buildDag(g, payload);
  check(`[${g}] index.html buildDag terminates (no cycle / explosion)`, !d.capped,
    { iters: d.iters });
}

// ============================================================
// v0.3.2 additions
// ============================================================

// (1) goalScopeStudents — mirrors index.html verbatim
function goalScopeStudents(payload, goalCode) {
  const mcg = MCG_GRAPH.events[goalCode] || {};
  const apps = mcg.applicability || [];
  if (!apps.length) return payload.students.slice();
  return payload.students.filter(s => isStudentApplicable(s, apps));
}

// (2) layoutDag with scopeStudents — v0.3.2 signature. Class-view aggregates
// over scopeStudents (not the full roster) so off-scope students can't make a
// node visible. Student view is unchanged vs v0.3.1.
function layoutDagV032(dag, payload, { mode, student, scopeStudents }) {
  const tiers = [];
  for (let d = 0; d <= dag.maxDepth; d++) tiers.push([]);
  const visible = new Set();
  for (const code of Object.keys(dag.nodesByCode)) {
    if (mode === 'student' && student) {
      const info = computeNodeForStudent(code, payload, student);
      if (!info.applicable && dag.nodesByCode[code].depth !== 0) continue;
    } else {
      const boardEvent = payload.byCode[code];
      const mcgEvent = MCG_GRAPH.events[code];
      const perStudent = computeEventStatus(boardEvent, scopeStudents, payload.classMeta);
      const agg = aggregateEvent(boardEvent, mcgEvent, perStudent, scopeStudents);
      if (agg.applicable === 0 && dag.nodesByCode[code].depth !== 0) continue;
    }
    visible.add(code);
    tiers[dag.nodesByCode[code].depth].push(code);
  }
  const edges = dag.edges.filter(e => visible.has(e.from) && visible.has(e.to));
  for (const t of tiers) t.sort();
  return { tiers, edges, visible };
}

// (3) 4-state label, verbatim from renderNodeStudent
function labelForStudentNode(code, payload, student, isGoal) {
  if (isGoal) return 'TARGET';
  const info = computeNodeForStudent(code, payload, student);
  if (info.isComplete) return 'DONE';
  if (info.completion === 'scheduled') return 'SCHEDULED';
  if (info.opted) return 'OPTED';
  return 'NOT OPTED';
}

// (5) computeOptedMap — dim iff !opted && completion !== 'complete'
function computeOptedMap(code, payload, students, mcgEvent) {
  const map = {};
  for (const s of students) {
    map[s.col] = isOpted(code, payload, s, mcgEvent);
  }
  return map;
}
function dimMapForNode(code, payload, applicableStudents, perStudent, mcgEvent) {
  const opted = computeOptedMap(code, payload, applicableStudents, mcgEvent);
  const dim = {};
  for (const s of applicableStudents) {
    const ps = perStudent[s.col];
    dim[s.col] = !opted[s.col] && ps.completion !== 'complete';
  }
  return { opted, dim };
}

console.log();
console.log('='.repeat(78));
console.log('v0.3.2 ADDITIONS');
console.log('='.repeat(78));

// --- (1) goalScopeStudents: spot-checks + per-goal table
console.log();
console.log('GOAL-SCOPE STUDENT SET');
console.log('-'.repeat(78));

const scopeByGoal = {};
for (const g of GOALS) {
  scopeByGoal[g] = goalScopeStudents(payload, g);
}

// Spot checks from the task prompt
const sPF8332F = scopeByGoal['PF 8332F'];
check('PF 8332F scope count === 21', sPF8332F.length === 21, { got: sPF8332F.length });
const sPF8311F = scopeByGoal['PF 8311F'];
check('PF 8311F scope count === 3', sPF8311F.length === 3, { got: sPF8311F.length });

// Empty-applicability goals should return ALL 24
for (const g of ['TF 9102E', 'TF 9111E']) {
  check(`${g} empty-apps → all students`,
    scopeByGoal[g].length === payload.students.length,
    { got: scopeByGoal[g].length, roster: payload.students.length });
}

// No on-board goal should have zero scope
for (const g of onBoardGoals) {
  const n = scopeByGoal[g].length;
  check(`${g} scope non-empty`, n > 0, { got: n });
}

// SY 7521O off-board skip (acknowledged in prompt)
console.log(`  SY 7521O (off-board): scope=${(scopeByGoal['SY 7521O']||[]).length} — skipped per prompt`);

const typeOf = arr => {
  const t = {};
  for (const s of arr) t[s.type] = (t[s.type] || 0) + 1;
  return t;
};
for (const g of GOALS) {
  const sc = scopeByGoal[g];
  const onB = payload.byCode[g] ? 'on-board' : 'OFF-BOARD';
  console.log(`  ${g.padEnd(10)} [${onB}] scope=${String(sc.length).padStart(2)}  types=${JSON.stringify(typeOf(sc))}`);
}

// --- (4) Not Applicable guard
console.log();
console.log('NOT-APPLICABLE GUARD');
console.log('-'.repeat(78));
const cso = payload.students.find(s => s.type === 'CSO');
const pilot = payload.students.find(s => /^Pilot/i.test(s.type));
const appsPF8332F = (MCG_GRAPH.events['PF 8332F'] || {}).applicability || [];
const appsPF8311F = (MCG_GRAPH.events['PF 8311F'] || {}).applicability || [];
const csoApp8332 = isStudentApplicable(cso, appsPF8332F);
const pilotApp8311 = isStudentApplicable(pilot, appsPF8311F);
check('CSO not applicable to PF 8332F (ABM/FTE/P)', csoApp8332 === false, { got: csoApp8332 });
check('Pilot not applicable to PF 8311F (CSO/RPA)', pilotApp8311 === false, { got: pilotApp8311 });
console.log(`  CSO (${cso.name}) × PF 8332F → applicable=${csoApp8332} (want false)`);
console.log(`  ${pilot.type} (${pilot.name}) × PF 8311F → applicable=${pilotApp8311} (want false)`);

// --- (5) Dim map spot-check on CF 6605S
console.log();
console.log('DIM MAP — CF 6605S (F-16 Cockpit Procedures, pilots should be 100% done)');
console.log('-'.repeat(78));
{
  const code = 'CF 6605S';
  const boardEvent = payload.byCode[code];
  if (!boardEvent) {
    console.log(`  ${code} NOT on board — skipping dim test.`);
  } else {
    const mcgEvent = MCG_GRAPH.events[code];
    // pilots only — mirror how the UI would scope this under a pilot-relevant goal
    const pilots = payload.students.filter(s => /^Pilot/i.test(s.type));
    const perStudent = computeEventStatus(boardEvent, pilots, payload.classMeta);
    const agg = aggregateEvent(boardEvent, mcgEvent, perStudent, pilots);
    const apps = pilots.filter(s => perStudent[s.col].applicable);
    const { opted, dim } = dimMapForNode(code, payload, apps, perStudent, mcgEvent);
    let dimmed = 0, done = 0;
    for (const s of apps) {
      if (dim[s.col]) dimmed++;
      if (perStudent[s.col].completion === 'complete') done++;
    }
    console.log(`  applicable pilots=${apps.length}  complete=${done}  dimmed=${dimmed}`);
    console.log(`  pct=${agg.pctComplete}%  state=${agg.state}`);
    check(`CF 6605S: nobody dimmed among applicable pilots`, dimmed === 0,
      { dimmed, apps: apps.length });
    check(`CF 6605S: all applicable pilots complete`, done === apps.length,
      { done, apps: apps.length });
  }
}

// --- (6) useSingleColumn threshold = 5 (source-level check on index.html)
console.log();
console.log('MULTI-COLUMN WRAP THRESHOLD');
console.log('-'.repeat(78));
{
  const idxSrc = fs.readFileSync(
    path.join(__dirname, 'index.html'), 'utf8');
  const m = idxSrc.match(/useSingleColumn\s*=\s*students\.length\s*<=\s*(\d+)/);
  const threshold = m ? parseInt(m[1], 10) : null;
  console.log(`  useSingleColumn threshold in index.html: ${threshold}`);
  check('useSingleColumn threshold === 5', threshold === 5, { got: threshold });
}

// --- (2 cont.) layoutDag w/ scopeStudents: per-goal class-view w/ scope filter
console.log();
console.log('PER-GOAL CLASS LAYOUT (v0.3.2 scope-filtered)');
console.log('-'.repeat(78));
console.log(['goal','scope','nodes','visCls','g/y/r/goal'].map(h => h.padEnd(11)).join('| '));
for (const g of onBoardGoals) {
  const dag = buildDagShortest(g, payload);
  const scope = scopeByGoal[g];
  const layoutV032 = layoutDagV032(dag, payload, { mode: 'class', scopeStudents: scope });
  let green=0, yellow=0, red=0, goalCount=0;
  for (const c of layoutV032.visible) {
    if (c === g) { goalCount++; continue; }
    const boardEvent = payload.byCode[c];
    const mcgEvent = MCG_GRAPH.events[c];
    const ps = computeEventStatus(boardEvent, scope, payload.classMeta);
    const agg = aggregateEvent(boardEvent, mcgEvent, ps, scope);
    const band = bandForPct(agg.pctComplete, agg.applicable);
    if (band === 's-green') green++;
    else if (band === 's-yellow') yellow++;
    else red++;
  }
  console.log([
    g.padEnd(11),
    String(scope.length).padEnd(11),
    String(Object.keys(dag.nodesByCode).length).padEnd(11),
    String(layoutV032.visible.size).padEnd(11),
    `${green}/${yellow}/${red}/${goalCount}`.padEnd(11),
  ].join('| '));
}

// --- (3) 4-state label spot-checks for C RYAN & F ROOT
console.log();
console.log('STUDENT-VIEW 4-STATE LABEL DISTRIBUTION');
console.log('-'.repeat(78));
function labelDistribution(studentName, student, goal) {
  if (!student) { console.log(`  ${studentName}: NOT FOUND`); return; }
  const dag = buildDagShortest(goal, payload);
  const scope = scopeByGoal[goal];
  const layout = layoutDagV032(dag, payload, { mode: 'student', student, scopeStudents: scope });
  const dist = { DONE: 0, SCHEDULED: 0, OPTED: 0, 'NOT OPTED': 0, TARGET: 0 };
  const sample = [];
  for (const c of layout.visible) {
    const lbl = labelForStudentNode(c, payload, student, c === goal);
    dist[lbl] = (dist[lbl] || 0) + 1;
    if (sample.length < 6 && c !== goal) sample.push(`${c}=${lbl}`);
  }
  console.log(`  ${studentName} (${student.type}) × ${goal}`);
  console.log(`    visible=${layout.visible.size}  ${JSON.stringify(dist)}`);
  console.log(`    sample: ${sample.join('  ')}`);
  // invariant: every visible non-goal node has a label from the 4 states
  for (const c of layout.visible) {
    if (c === goal) continue;
    const lbl = labelForStudentNode(c, payload, student, false);
    check(`[${studentName}/${goal}] ${c} has valid 4-state label`,
      ['DONE','SCHEDULED','OPTED','NOT OPTED'].indexOf(lbl) !== -1,
      { label: lbl });
  }
  return dist;
}
const distRyan = labelDistribution('C RYAN', cRyan, 'PF 8311F');
const distRoot = labelDistribution('F ROOT', fRoot, 'PF 8332F');

// --- Regression: chain.isOpted terminates for every (node, student) in DAG
console.log();
console.log('REGRESSION — isOpted terminates for every (node, student)');
console.log('-'.repeat(78));
{
  let totalPairs = 0, anyFailure = false;
  for (const g of onBoardGoals) {
    const dag = buildDagShortest(g, payload);
    for (const code of Object.keys(dag.nodesByCode)) {
      const mcgEvent = MCG_GRAPH.events[code];
      for (const s of payload.students) {
        try {
          // isOpted → buildChainForStudent, which itself uses a seen-set.
          // Here we just confirm it returns a boolean without throwing / looping.
          const r = isOpted(code, payload, s, mcgEvent);
          if (typeof r !== 'boolean') { anyFailure = true; break; }
          totalPairs++;
        } catch (err) {
          anyFailure = true;
          console.log(`    THROW: ${code} × ${s.name}: ${err.message}`);
          break;
        }
      }
      if (anyFailure) break;
    }
    if (anyFailure) break;
  }
  console.log(`  Evaluated ${totalPairs} (node,student) pairs across ${onBoardGoals.length} goals.`);
  check('isOpted terminates / returns bool for all pairs', !anyFailure);
}

// --- Representative-student table per applicability group
console.log();
console.log('REPRESENTATIVE-STUDENT LABEL TABLE (one per applicability group)');
console.log('-'.repeat(78));
const representativeFor = {
  'PF 8311F':  payload.students.find(s => s.type === 'CSO'),
  'PF 8332F':  payload.students.find(s => s.type === 'FTE'),
  'FQ 9502S':  payload.students.find(s => s.type === 'CSO'),
  'FQ 9511F':  payload.students.find(s => /^Pilot/i.test(s.type)),
  'FQ 9512C':  payload.students.find(s => s.type === 'FTE'),
  'SY 7503F':  payload.students.find(s => s.type === 'CSO'),
  'SY 7511F':  payload.students.find(s => /^Pilot/i.test(s.type)),
  'SY 7512C':  payload.students.find(s => s.type === 'FTE'),
  'TF 9102E':  payload.students.find(s => s.type === 'FTE'),
  'TF 9111E':  payload.students.find(s => s.type === 'FTE'),
};
console.log(['goal','scope','visCls','DONE','SCHED','OPTED','NOTOPT','rep'].map(h => h.padEnd(9)).join('| '));
for (const g of onBoardGoals) {
  const scope = scopeByGoal[g];
  const dag = buildDagShortest(g, payload);
  const layoutCls = layoutDagV032(dag, payload, { mode: 'class', scopeStudents: scope });
  const rep = representativeFor[g];
  let dist = { DONE: 0, SCHEDULED: 0, OPTED: 0, 'NOT OPTED': 0 };
  if (rep) {
    const layoutStu = layoutDagV032(dag, payload, { mode: 'student', student: rep, scopeStudents: scope });
    for (const c of layoutStu.visible) {
      if (c === g) continue;
      const lbl = labelForStudentNode(c, payload, rep, false);
      dist[lbl] = (dist[lbl] || 0) + 1;
    }
  }
  console.log([
    g.padEnd(9),
    String(scope.length).padEnd(9),
    String(layoutCls.visible.size).padEnd(9),
    String(dist.DONE).padEnd(9),
    String(dist.SCHEDULED).padEnd(9),
    String(dist.OPTED).padEnd(9),
    String(dist['NOT OPTED']).padEnd(9),
    rep ? `${rep.name}(${rep.type})` : '—',
  ].join('| '));
}

// ============================================================
// v0.3.3 additions — bridge-through-off-board resolver + day-precision classify
// ============================================================

// Verbatim resolveToOnBoardPrereqs from index.html v0.3.3.
function resolveToOnBoardPrereqs(code, payload) {
  const result = {};  // onBoardCode -> bridge[] (off-board codes traversed)
  const seenBridge = new Set();
  function walk(fromCode, bridgeSoFar) {
    const mcg = MCG_GRAPH.events[fromCode];
    if (!mcg || !mcg.prerequisites) return;
    for (const p of mcg.prerequisites) {
      if (!p.code) continue;
      if (payload.byCode[p.code]) {
        if (!(p.code in result) || result[p.code].length > bridgeSoFar.length) {
          result[p.code] = bridgeSoFar.slice();
        }
      } else {
        if (seenBridge.has(p.code)) continue; // cycle-safety on off-board codes
        seenBridge.add(p.code);
        walk(p.code, bridgeSoFar.concat(p.code));
      }
    }
  }
  walk(code, []);
  return result;
}

// Verbatim v0.3.3 buildDag with outer seen-set (first-visit-wins) and bridge
// edges. Returns edges with { from, to, bridge } and a maxDepth.
function buildDagV033(goalCode, payload) {
  const nodesByCode = {};
  const edges = [];
  if (!payload.byCode[goalCode]) return { nodesByCode, edges, maxDepth: 0 };
  const queue = [{ code: goalCode, depth: 0 }];
  const seen = new Set();
  const seenEdges = new Set();
  let maxDepth = 0;
  while (queue.length) {
    const { code, depth } = queue.shift();
    if (seen.has(code)) continue;
    seen.add(code);
    nodesByCode[code] = { code, depth };
    maxDepth = Math.max(maxDepth, depth);
    const resolved = resolveToOnBoardPrereqs(code, payload);
    for (const onBoardCode of Object.keys(resolved)) {
      const bridge = resolved[onBoardCode];
      const eKey = `${onBoardCode}→${code}`;
      if (!seenEdges.has(eKey)) {
        seenEdges.add(eKey);
        edges.push({ from: onBoardCode, to: code, bridge });
      }
      if (!seen.has(onBoardCode)) {
        queue.push({ code: onBoardCode, depth: depth + 1 });
      }
    }
  }
  return { nodesByCode, edges, maxDepth };
}

// Wall-clock timeout guard: run fn, fail fast if it takes more than limitMs.
function runWithTimeout(fn, limitMs, label) {
  const t0 = Date.now();
  const r = fn();
  const dt = Date.now() - t0;
  const timedOut = dt > limitMs;
  if (timedOut) {
    console.log(`  TIMEOUT: ${label} took ${dt}ms (> ${limitMs}ms)`);
  }
  return { result: r, ms: dt, timedOut };
}

console.log();
console.log('='.repeat(78));
console.log('v0.3.3 ADDITIONS');
console.log('='.repeat(78));

// --- Per-goal comparison: v0.3.2 (no bridging) vs v0.3.3 (bridge through) ---
console.log();
console.log('PER-GOAL: v0.3.2 vs v0.3.3 DAG (bridge resolver flattens off-board)');
console.log('-'.repeat(78));
console.log(
  ['goal','v032_nodes','v033_nodes','edges','maxD','ms'].map(h => h.padEnd(12)).join('| ')
);

const BRIDGE_GROWTH_GOALS = new Set(['FQ 9511F','FQ 9502S','FQ 9512C','TF 9102E']);
const NO_REGRESSION_GOALS = new Set([
  'PF 8311F','PF 8332F','SY 7503F','SY 7511F','SY 7512C','TF 9111E',
]);

const v033Results = {};
for (const g of onBoardGoals) {
  // v0.3.2 baseline uses the non-bridging buildDagShortest.
  const v032 = buildDagShortest(g, payload);
  const v032Nodes = Object.keys(v032.nodesByCode).length;

  const { result: v033, ms, timedOut } = runWithTimeout(
    () => buildDagV033(g, payload), 2000, `buildDagV033(${g})`);
  v033Results[g] = v033;
  const v033Nodes = Object.keys(v033.nodesByCode).length;

  // Cycle-safety: 2s timeout guard
  check(`[${g}] v0.3.3 buildDag completes under 2s`, !timedOut, { ms });

  // Tests 1-2: previously 1-node goals must grow
  if (BRIDGE_GROWTH_GOALS.has(g)) {
    check(`[${g}] v0.3.3 nodes > 1 (was 1 in v0.3.2)`,
      v033Nodes > 1, { v032: v032Nodes, v033: v033Nodes });
    check(`[${g}] v0.3.3 edges > 0 (was 0 in v0.3.2)`,
      v033.edges.length > 0, { edges: v033.edges.length });
  }
  // Test 3: no regression — node count may grow, must not shrink, must terminate
  if (NO_REGRESSION_GOALS.has(g)) {
    check(`[${g}] v0.3.3 nodes >= v0.3.2 nodes`,
      v033Nodes >= v032Nodes, { v032: v032Nodes, v033: v033Nodes });
  }

  console.log([
    g.padEnd(12),
    String(v032Nodes).padEnd(12),
    String(v033Nodes).padEnd(12),
    String(v033.edges.length).padEnd(12),
    String(v033.maxDepth).padEnd(12),
    String(ms).padEnd(12),
  ].join('| '));
}

// --- Bridge provenance: sample a bridged edge for FQ 9511F ---
console.log();
console.log('BRIDGE PROVENANCE — sample bridged edges into FQ 9511F');
console.log('-'.repeat(78));
{
  const g = 'FQ 9511F';
  const dag = v033Results[g];
  if (!dag) {
    console.log('  FQ 9511F not in v033 results');
  } else {
    const incoming = dag.edges.filter(e => e.to === g);
    console.log(`  FQ 9511F in-edges (${incoming.length}):`);
    for (const e of incoming) {
      const bridgeStr = e.bridge.length ? `  via [${e.bridge.join(' -> ')}]` : '  (direct on-board)';
      console.log(`    ${e.from} -> ${e.to}${bridgeStr}`);
    }
    const bridged = incoming.filter(e => e.bridge.length);
    check('FQ 9511F has at least one bridged edge', bridged.length > 0,
      { bridged: bridged.length, total: incoming.length });
    if (bridged.length) {
      const ex = bridged[0];
      console.log(`  sample: ${ex.from} -> ${ex.to}  bridge=${JSON.stringify(ex.bridge)}`);
    }
  }
}

// --- Cycle safety: run buildDagV033 over every on-board node as a pseudo-goal
// This hits the known on-board cycle (CF 6660S <-> CF 6672F) plus any
// off-board cycles the resolver touches.
console.log();
console.log('CYCLE SAFETY — buildDagV033 from every on-board event (2s guard)');
console.log('-'.repeat(78));
{
  let worst = { code: null, ms: 0 };
  let total = 0, slow = 0;
  for (const code of Object.keys(payload.byCode)) {
    const { ms, timedOut } = runWithTimeout(
      () => buildDagV033(code, payload), 2000, `buildDagV033(${code})`);
    total++;
    if (ms > worst.ms) worst = { code, ms };
    if (timedOut) slow++;
    check(`[cycle] buildDagV033(${code}) under 2s`, !timedOut, { ms });
  }
  console.log(`  ran ${total} goals; slowest = ${worst.code} @ ${worst.ms}ms; timeouts=${slow}`);
  // Explicit probe on the known on-board cycle endpoints
  for (const code of ['CF 6660S','CF 6672F']) {
    if (!payload.byCode[code]) continue;
    const { ms, timedOut } = runWithTimeout(
      () => buildDagV033(code, payload), 2000, `cycle-probe(${code})`);
    console.log(`  ${code}: ${ms}ms timedOut=${timedOut}`);
  }
}

// --- C RYAN × PF 6121F classifyCell + node-level ---
console.log();
console.log('C RYAN x PF 6121F — day-precision SCHEDULED (v0.3.3)');
console.log('-'.repeat(78));
{
  const today = new Date(2026, 3, 14); // 2026-04-14 (month is 0-indexed)
  const evt = payload.byCode['PF 6121F'];
  if (!evt) {
    console.log('  PF 6121F not on board — cannot probe');
    check('PF 6121F on-board', false);
  } else {
    const ryan = payload.students.find(s => s.name === 'C RYAN');
    const cell = evt.cells.find(c => c.col === ryan.col);
    console.log(`  cell: value="${cell.value}" rgb=${cell.rgbFamily} strike=${cell.strikethrough}`);
    const classified = classifyCell(cell, payload.classMeta, today);
    console.log(`  classifyCell: completion=${classified.completion}  dateText=${classified.dateText}`);
    check('C RYAN PF 6121F classifyCell completion === scheduled',
      classified.completion === 'scheduled', { got: classified.completion });
    check('C RYAN PF 6121F classifyCell dateText === "4/14"',
      classified.dateText === '4/14', { got: classified.dateText });

    // Node-level computeNodeForStudent — note this calls `new Date()` inside,
    // which on a run outside 2026-04-14 wouldn't fire the 'scheduled' branch.
    // We run the probe against a tiny shim that injects `today`.
    function computeNodeForStudentAt(code, payload, student, today) {
      const boardEvent = payload.byCode[code];
      const mcgEvent = MCG_GRAPH.events[code];
      if (!boardEvent) return { applicable: false };
      const apps = (mcgEvent && mcgEvent.applicability) || [];
      const applicable = isStudentApplicable(student, apps);
      if (!applicable) return { applicable: false };
      const cell = boardEvent.cells.find(c => c.col === student.col);
      const classified = classifyCell(cell, payload.classMeta, today);
      if (classified.completion === 'notreq') return { applicable: false };
      return {
        applicable: true,
        completion: classified.completion,
        isComplete: classified.completion === 'complete',
        opted: isOpted(code, payload, student, mcgEvent),
        dateText: classified.dateText,
      };
    }
    const info = computeNodeForStudentAt('PF 6121F', payload, ryan, today);
    console.log(`  computeNodeForStudent@2026-04-14: ${JSON.stringify(info)}`);
    check('C RYAN PF 6121F node info.completion === scheduled',
      info.completion === 'scheduled', { got: info.completion });
    check("C RYAN PF 6121F node info.dateText === '4/14'",
      info.dateText === '4/14', { got: info.dateText });
  }
}

// ---- Invariant report ----
console.log();
console.log('INVARIANTS');
console.log('-'.repeat(78));
if (!invariants.length) {
  console.log('  All invariants passed.');
} else {
  console.log(`  ${invariants.length} failures:`);
  // dedupe / summarize
  const grouped = {};
  for (const f of invariants) {
    grouped[f.name] = (grouped[f.name] || 0) + 1;
  }
  for (const k of Object.keys(grouped)) {
    console.log(`    FAIL: ${k}${grouped[k] > 1 ? ` (x${grouped[k]})` : ''}`);
  }
}
console.log();
