#!/usr/bin/env node
// Combine all 9 per-phase V2 JSON files into a single "26A MCG.json".
const fs = require('fs');
const path = require('path');

const V2_DIR = __dirname;
const OUT_PATH = path.join(path.dirname(V2_DIR), '26A MCG.json');
const PHASES = ['AN','AS','CF','FQ','PF','SO','SY','TF','TL'];

const GOAL_EVENTS = [
  'PF 8311F','PF 8332F',
  'FQ 9502S','FQ 9511F','FQ 9512C',
  'SY 7503F','SY 7511F','SY 7512C','SY 7521O',
  'TF 9102E','TF 9111E',
];

const combined = {
  sourceDocument: 'MCG 26A',
  classVersion: '26A',
  generatedDate: new Date().toISOString().slice(0, 10),
  goalEvents: GOAL_EVENTS,
  eventSchema: {
    code: 'string',
    eventName: 'string',
    eventType: 'string (A|B|C|E|F|G|H|I|L|M|O|R|S|W|Y|Z)',
    eventTypeName: 'string',
    phase: 'string (AN|AS|CF|FQ|PF|SO|SY|TF|TL)',
    moduleCode: 'string | null',
    moduleName: 'string | null',
    parentCourse: 'string | null',
    applicability: 'string[]  // audience codes ABM/CSO/FTE/P/RPA/STC + qualifiers (select P, etc.)',
    applicabilityDetail: {
      role: 'string | null  // crew-solo | non-crew-solo | select P | select | optional',
      aircraft: 'string | null  // C-12 | F-16 | T-38 | Learjet',
      standardMapping: 'string[]  // expanded to underlying audience codes',
      description: 'string',
    },
    eventNotes: 'string',
    seriesInfo: {
      inSeries: 'boolean',
      seriesId: 'string | null  // e.g. "CF 6540-2F"',
      seriesPosition: 'number | null  // 1-based',
      seriesLength: 'number | null',
    },
    description: 'string  // verbatim from MCG',
    prerequisites: 'Prereq[]',
  },
  prereqSchema: {
    code: 'string  // event code',
    name: 'string  // verbatim from MCG including parenthetical tag and bracket annotation',
    nameTag: 'string[] | null  // parsed audience codes from the parenthetical',
    nameTagRole: 'string | null  // crew-solo | non-crew-solo | select P | etc.',
    nameTagAircraft: 'string | null  // inferred for crew-solo prereqs',
    condition: 'Condition | null',
    group: 'PrereqGroup | null',
  },
  conditionSchema: {
    forDownstream: { type: "'forDownstream'", target: 'string  // event code, or audience sentinel (all|P), or phrase' },
    datagroup: { type: "'datagroup'", values: "string[]  // subset of ['C-12','F-16','T-38','Learjet']" },
  },
  prereqGroupSchema: {
    id: 'string  // stable, shared across alternatives (e.g. SY-7511F-flight)',
    kind: "'oneOf'",
    audienceHint: 'string | null',
    description: 'string',
  },
  phases: [],
  events: {},
};

let totalEvents = 0;
let totalPrereqs = 0;
for (const p of PHASES) {
  const fp = path.join(V2_DIR, `phase-${p}.json`);
  const f = JSON.parse(fs.readFileSync(fp, 'utf8'));
  combined.phases.push({
    phase: f.phase,
    phaseName: f.phaseName,
    sourcePages: f.sourcePages || null,
    eventCount: Object.keys(f.events).length,
  });
  for (const [code, ev] of Object.entries(f.events)) {
    if (combined.events[code]) {
      console.error('DUPLICATE CODE:', code, 'in', p, 'and', combined.events[code].phase);
      process.exit(1);
    }
    combined.events[code] = ev;
    totalEvents++;
    totalPrereqs += (ev.prerequisites || []).length;
  }
}

combined.counts = {
  totalEvents,
  totalPrereqs,
  perPhase: Object.fromEntries(combined.phases.map(p => [p.phase, p.eventCount])),
};

fs.writeFileSync(OUT_PATH, JSON.stringify(combined, null, 2) + '\n', 'utf8');
console.log(`Wrote ${OUT_PATH}`);
console.log(`  ${totalEvents} events`);
console.log(`  ${totalPrereqs} prereq entries`);
console.log(`  ${combined.phases.length} phases`);
