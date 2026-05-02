#!/usr/bin/env node
// Cross-check Version-2 per-phase JSON files.
const fs = require('fs');
const path = require('path');

const V2_DIR = __dirname;
const V1_DIR = path.join(path.dirname(V2_DIR), 'Version-1-raw-data');
const PHASES = ['AN', 'AS', 'CF', 'FQ', 'PF', 'SO', 'SY', 'TF', 'TL'];
const GOAL_EVENTS = [
  'PF 8311F', 'PF 8332F',
  'FQ 9502S', 'FQ 9511F', 'FQ 9512C',
  'SY 7503F', 'SY 7511F', 'SY 7512C', 'SY 7521O',
  'TF 9102E', 'TF 9111E',
];

function loadV2() {
  const out = {};
  for (const p of PHASES) {
    const fp = path.join(V2_DIR, `phase-${p}.json`);
    out[p] = JSON.parse(fs.readFileSync(fp, 'utf8'));
  }
  return out;
}

function loadV1Codes() {
  const codes = new Set();
  for (const p of PHASES) {
    const fp = path.join(V1_DIR, `phase-${p}.json`);
    if (!fs.existsSync(fp)) continue;
    const d = JSON.parse(fs.readFileSync(fp, 'utf8'));
    for (const m of d.modules || []) {
      for (const e of m.events || []) {
        if (e.code) codes.add(e.code);
      }
    }
  }
  return codes;
}

const v2 = loadV2();
const v1 = loadV1Codes();
const allCodes = new Set();
const perPhaseCounts = {};
for (const p of PHASES) {
  const keys = Object.keys(v2[p].events || {});
  perPhaseCounts[p] = keys.length;
  for (const k of keys) allCodes.add(k);
}

console.log('='.repeat(70));
console.log('1. EVENT COUNTS PER PHASE');
console.log('='.repeat(70));
let total = 0;
for (const p of PHASES) {
  console.log(`  ${p}: ${perPhaseCounts[p]}`);
  total += perPhaseCounts[p];
}
console.log(`  TOTAL: ${total}\n`);

console.log('='.repeat(70));
console.log('2. GOAL EVENT PRESENCE CHECK');
console.log('='.repeat(70));
const missingGoals = [];
for (const g of GOAL_EVENTS) {
  if (allCodes.has(g)) console.log(`  OK      ${g}`);
  else { console.log(`  MISSING ${g}`); missingGoals.push(g); }
}
console.log('');

console.log('='.repeat(70));
console.log('3. DANGLING PREREQ REFERENCES');
console.log('='.repeat(70));
const dangling = {};
const sentinels = new Set(['all', 'P', 'TPS Enrollment']);
for (const p of PHASES) {
  const events = v2[p].events || {};
  for (const [code, ev] of Object.entries(events)) {
    for (const pr of ev.prerequisites || []) {
      const pc = (pr.code || '').trim();
      if (!pc) continue;
      if (sentinels.has(pc)) continue;
      if (!allCodes.has(pc)) {
        if (!dangling[pc]) dangling[pc] = new Set();
        dangling[pc].add(code);
      }
    }
  }
}
const sortedDangling = Object.keys(dangling).sort();
if (sortedDangling.length === 0) console.log('  (none)');
else {
  for (const m of sortedDangling) {
    const refs = [...dangling[m]].sort();
    const preview = refs.slice(0, 5).join(', ');
    const suffix = refs.length > 5 ? ' ...' : '';
    console.log(`  ${m}  <- ${preview}${suffix} (${refs.length} refs)`);
  }
}
console.log('');

console.log('='.repeat(70));
console.log('4. SERIES LENGTH CONSISTENCY');
console.log('='.repeat(70));
const seriesMembers = {};
const declaredLength = {};
for (const p of PHASES) {
  const events = v2[p].events || {};
  for (const [code, ev] of Object.entries(events)) {
    const si = ev.seriesInfo || {};
    if (si.inSeries) {
      const sid = si.seriesId;
      if (!seriesMembers[sid]) seriesMembers[sid] = [];
      seriesMembers[sid].push({ pos: si.seriesPosition, code });
      declaredLength[sid] = si.seriesLength;
    }
  }
}
const problems = [];
for (const sid of Object.keys(seriesMembers).sort()) {
  const members = seriesMembers[sid].sort((a, b) => a.pos - b.pos);
  const ln = declaredLength[sid];
  const found = members.length;
  const positions = members.map(m => m.pos);
  const expected = Array.from({ length: ln || 0 }, (_, i) => i + 1);
  const ok = found === ln && JSON.stringify(positions) === JSON.stringify(expected);
  const flag = ok ? 'OK     ' : 'PROBLEM';
  const cs = members.map(m => m.code).join(', ');
  console.log(`  ${flag} ${sid}: declared ${ln}, found ${found} [${cs}]`);
  if (!ok) problems.push(sid);
}
console.log('');

console.log('='.repeat(70));
console.log('5. V1 vs V2 EVENT DELTA');
console.log('='.repeat(70));
const added = [...allCodes].filter(c => !v1.has(c)).sort();
const removed = [...v1].filter(c => !allCodes.has(c)).sort();
console.log(`  Events in V2 but not V1: ${added.length}`);
added.slice(0, 60).forEach(c => console.log(`    + ${c}`));
if (added.length > 60) console.log(`    ... (${added.length - 60} more)`);
console.log('');
console.log(`  Events in V1 but not V2: ${removed.length}`);
removed.slice(0, 60).forEach(c => console.log(`    - ${c}`));
if (removed.length > 60) console.log(`    ... (${removed.length - 60} more)`);
console.log('');

console.log('='.repeat(70));
console.log('SUMMARY');
console.log('='.repeat(70));
console.log(`  Total V2 events: ${total}`);
console.log(`  Total V1 events: ${v1.size}`);
console.log(`  Missing goals: ${missingGoals.length}`);
console.log(`  Dangling prereq targets: ${sortedDangling.length}`);
console.log(`  Series with length issues: ${problems.length}`);
