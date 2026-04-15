/* _dagre-test.cjs — validates v0.4.0 dagre-based layered layout against
 * the real DAG data.
 *
 * - Loads dagre UMD under CommonJS
 * - Loads fetched GAS payload + MCG graph
 * - Uses the verbatim v0.3.3 buildDag (with outer seen-set + bridge edges)
 * - For each on-board goal: builds DAG, feeds dagre, reports layout stats
 * - Verifies no NaN/undefined coords, all edges have valid points arrays
 * - Cycle-safety probe for CF 6660S ↔ CF 6672F
 * - Stress test: 10x layout of TF 9111E with avg wall time
 */
'use strict';

const path = require('path');
const fs = require('fs');
const dagre = require('./dagre.min.js');

const PAYLOAD_RAW = JSON.parse(fs.readFileSync(
  path.join(__dirname, 'JSON-outputs', 'fetch_sheet.json'), 'utf8'));
const MCG_GRAPH = JSON.parse(fs.readFileSync(
  path.join(__dirname, 'mcg-26a-graph.json'), 'utf8'));

// ---------- verbatim helpers copied from _dag-harness.cjs ----------

function normalizeCode(raw) {
  if (!raw) return '';
  const s = String(raw).trim().replace(/\s+/g, ' ');
  const m = s.match(/^([A-Z]{2})[\s\-]?(\d.*)$/);
  return m ? (m[1] + ' ' + m[2]).trim() : s;
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

// Resolves off-board prereq chains to the nearest on-board code(s)
function resolveToOnBoardPrereqs(code, payload) {
  const result = {};
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
        if (seenBridge.has(p.code)) continue;
        seenBridge.add(p.code);
        walk(p.code, bridgeSoFar.concat(p.code));
      }
    }
  }
  walk(code, []);
  return result;
}

// Verbatim v0.3.3 buildDag: outer seen-set (first-visit-wins), bridge edges
function buildDag(goalCode, payload) {
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

// ---------- dagre layout runner ----------

function runDagreFor(goalCode, payload) {
  const dag = buildDag(goalCode, payload);

  // Class view = every visible node in the dag
  const visibleCodes = Object.keys(dag.nodesByCode);
  const edges = dag.edges.filter(e => dag.nodesByCode[e.from] && dag.nodesByCode[e.to]);

  const g = new dagre.graphlib.Graph({ compound: false });
  g.setGraph({
    rankdir: 'LR',
    ranksep: 80,
    nodesep: 16,
    edgesep: 8,
    marginx: 20,
    marginy: 20,
  });
  g.setDefaultEdgeLabel(() => ({}));

  // Fixed size — no DOM to measure here. Matches the collapsed-ish default.
  for (const code of visibleCodes) {
    g.setNode(code, { width: 240, height: 120 });
  }
  for (const e of edges) {
    g.setEdge(e.from, e.to, { bridge: e.bridge || [] });
  }

  let threw = null, ms = 0;
  const t0 = Date.now();
  try {
    dagre.layout(g);
  } catch (err) {
    threw = err;
  }
  ms = Date.now() - t0;

  const gi = g.graph();
  return { g, gi, dag, visibleCodes, edges, threw, ms };
}

// ---------- validation ----------

function validateLayout(goalCode, result) {
  const issues = [];
  if (result.threw) {
    issues.push(`threw: ${result.threw.message || result.threw}`);
    return issues;
  }
  // Node coords
  result.g.nodes().forEach(code => {
    const n = result.g.node(code);
    if (!n) { issues.push(`node ${code} missing after layout`); return; }
    if (typeof n.x !== 'number' || !isFinite(n.x) || Number.isNaN(n.x)) {
      issues.push(`node ${code} bad x=${n.x}`);
    }
    if (typeof n.y !== 'number' || !isFinite(n.y) || Number.isNaN(n.y)) {
      issues.push(`node ${code} bad y=${n.y}`);
    }
  });
  // Edge points
  result.g.edges().forEach(e => {
    const edge = result.g.edge(e);
    if (!edge) { issues.push(`edge ${e.v}->${e.w} missing`); return; }
    if (!Array.isArray(edge.points) || edge.points.length < 2) {
      issues.push(`edge ${e.v}->${e.w} points len=${edge.points ? edge.points.length : 'none'}`);
      return;
    }
    for (const pt of edge.points) {
      if (!pt || typeof pt.x !== 'number' || typeof pt.y !== 'number'
          || !isFinite(pt.x) || !isFinite(pt.y)) {
        issues.push(`edge ${e.v}->${e.w} has bad point ${JSON.stringify(pt)}`);
        break;
      }
    }
  });
  // Graph bounds
  const gi = result.gi;
  if (typeof gi.width !== 'number' || !isFinite(gi.width)) issues.push(`graph width bad: ${gi.width}`);
  if (typeof gi.height !== 'number' || !isFinite(gi.height)) issues.push(`graph height bad: ${gi.height}`);
  return issues;
}

// ---------- run ----------

const payload = indexPayload(PAYLOAD_RAW);
const onBoardGoals = MCG_GRAPH.goalEvents.filter(c => payload.byCode[c]);

console.log('=== v0.4.0 dagre layout validation ===');
console.log(`on-board goals: ${onBoardGoals.length}\n`);

const rows = [];
let anyIssues = false;
for (const goal of onBoardGoals) {
  const r = runDagreFor(goal, payload);
  const issues = validateLayout(goal, r);
  rows.push({
    goal, nodes: r.visibleCodes.length, edges: r.edges.length,
    width: Math.round(r.gi.width || 0), height: Math.round(r.gi.height || 0),
    ms: r.ms, issues,
  });
  if (issues.length) anyIssues = true;
}

// Summary table
const pad = (s, n) => String(s).padEnd(n);
console.log(pad('goal', 12) + pad('nodes', 8) + pad('edges', 8)
  + pad('width', 10) + pad('height', 10) + pad('layoutMs', 10) + 'issues');
console.log('-'.repeat(70));
for (const r of rows) {
  console.log(
    pad(r.goal, 12) + pad(r.nodes, 8) + pad(r.edges, 8)
    + pad(r.width, 10) + pad(r.height, 10) + pad(r.ms, 10)
    + (r.issues.length ? r.issues.join('; ') : 'ok')
  );
}

// Sample edge points: pick FQ 9511F
console.log('\n=== sample edge points (FQ 9511F) ===');
{
  const r = runDagreFor('FQ 9511F', payload);
  const firstE = r.g.edges()[0];
  if (firstE) {
    const edge = r.g.edge(firstE);
    console.log(`edge ${firstE.v} -> ${firstE.w}:`);
    console.log(JSON.stringify(edge.points, null, 2));
  } else {
    console.log('(no edges)');
  }
}

// Cycle safety: CF 6660S ↔ CF 6672F. Find a goal whose DAG includes them.
console.log('\n=== cycle safety (CF 6660S ↔ CF 6672F) ===');
let cycleGoal = null;
for (const g of onBoardGoals) {
  const d = buildDag(g, payload);
  if (d.nodesByCode['CF 6660S'] || d.nodesByCode['CF 6672F']) {
    cycleGoal = g;
    break;
  }
}
if (cycleGoal) {
  console.log(`cycle reachable from: ${cycleGoal}`);
  const r = runDagreFor(cycleGoal, payload);
  console.log(`  layout threw: ${r.threw ? (r.threw.message || r.threw) : 'no'}`);
  console.log(`  nodes=${r.visibleCodes.length} edges=${r.edges.length} ms=${r.ms}`);
  const issues = validateLayout(cycleGoal, r);
  console.log(`  validation: ${issues.length ? issues.join('; ') : 'clean'}`);
} else {
  // Direct probe — build a synthetic DAG from CF 6660S itself
  console.log('no on-board goal reaches the cycle; probing CF 6660S directly');
  const r = runDagreFor('CF 6660S', payload);
  console.log(`  layout threw: ${r.threw ? (r.threw.message || r.threw) : 'no'}`);
  console.log(`  nodes=${r.visibleCodes.length} edges=${r.edges.length}`);
}

// Stress test: 10x TF 9111E
console.log('\n=== stress test: 10x TF 9111E ===');
{
  const dag = buildDag('TF 9111E', payload);
  const visibleCodes = Object.keys(dag.nodesByCode);
  const edges = dag.edges.filter(e => dag.nodesByCode[e.from] && dag.nodesByCode[e.to]);
  console.log(`  graph: ${visibleCodes.length} nodes, ${edges.length} edges`);
  const samples = [];
  for (let i = 0; i < 10; i++) {
    const g = new dagre.graphlib.Graph({ compound: false });
    g.setGraph({ rankdir: 'LR', ranksep: 80, nodesep: 16, edgesep: 8, marginx: 20, marginy: 20 });
    g.setDefaultEdgeLabel(() => ({}));
    for (const code of visibleCodes) g.setNode(code, { width: 240, height: 120 });
    for (const e of edges) g.setEdge(e.from, e.to, { bridge: e.bridge || [] });
    const t0 = process.hrtime.bigint();
    dagre.layout(g);
    const t1 = process.hrtime.bigint();
    samples.push(Number(t1 - t0) / 1e6);
  }
  const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
  const min = Math.min(...samples);
  const max = Math.max(...samples);
  console.log(`  runs (ms): ${samples.map(s => s.toFixed(1)).join(', ')}`);
  console.log(`  avg=${avg.toFixed(1)}ms  min=${min.toFixed(1)}ms  max=${max.toFixed(1)}ms`);
  console.log(`  < 500ms budget: ${avg < 500 ? 'PASS' : 'FAIL'}`);
}

console.log('\n' + (anyIssues ? 'SOME GOALS REPORTED ISSUES' : 'all goals layouted cleanly'));
