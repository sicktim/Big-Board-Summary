/* ============================================================
 * File:       build-prereq-graph.cjs
 * Module:     big-board-curriculum-status / build-time
 * Version:    0.1.0
 * MCG Target: 26A
 * Updated:    2026-04-14
 * Changelog:
 *   0.1.0 - Initial builder: reads MCG-26A phase-*.json, emits
 *           mcg-26a-graph.json AND overwrites the fenced block in
 *           index.html with the latest prereq graph.
 * ============================================================
 *
 * Why this exists:
 *   The MCG prereq graph is the authoritative source of what each
 *   event depends on. We embed it directly in index.html (between
 *   `<!-- MCG-GRAPH:BEGIN -->` / `<!-- MCG-GRAPH:END -->` fences) so
 *   the front end ships self-contained. This script is the only way
 *   that fenced block should ever change.
 *
 * Run:
 *   node build-prereq-graph.cjs
 *
 * Outputs:
 *   1. mcg-26a-graph.json  (reference artifact, human-readable)
 *   2. index.html          (fenced block rewritten in-place if present)
 */

'use strict';

const fs = require('fs');
const path = require('path');

const BUILDER_VERSION = '0.1.0';
const MCG_VERSION = '26A';
const MCG_DIR = path.join(__dirname, '..', 'MCG-automated-extraction',
  `MCG-${MCG_VERSION}`, 'Version-1-raw-data');
const OUT_JSON = path.join(__dirname, `mcg-${MCG_VERSION.toLowerCase()}-graph.json`);
const HTML_PATH = path.join(__dirname, 'index.html');

// ------------------------------------------------------------
// The 11 critical goal events the big board tracks toward.
// Stored as normalized codes (with the single space the MCG uses).
// ------------------------------------------------------------
const GOAL_EVENTS = [
  'PF 8311F', // C-12 Performance Practical (CSO/RPA)
  'PF 8332F', // Multi-Engine Performance Practical (ABM/FTE/P)
  'FQ 9502S', // Sim Flying Qualities Practical Exam (ABM/CSO/RPA)
  'FQ 9511F', // T-38 Flying Qualities Practical Exam (P)
  'FQ 9512C', // T-38 Flying Qualities Practical Control Room (FTE)
  'SY 7503F', // MQ-9 Systems Practical Exam (ABM/CSO/RPA, select FTE/P)
  'SY 7511F', // F-16 Systems Practical Exam Flight (P)
  'SY 7512C', // F-16 Systems Practical Exam Control Room (FTE)
  'SY 7521O', // Space Systems Practical (STC)
  'TF 9102E', // Comprehensive Written Exam
  'TF 9111E', // Comprehensive Oral Exam
];

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

// Codes in MCG usually look like "PF 8311F". Normalize any common
// variants (no-space, hyphen, extra whitespace) to one canonical form.
function normalizeCode(raw) {
  if (!raw) return null;
  const s = String(raw).trim().replace(/\s+/g, ' ');
  // Ensure exactly one space after the two-letter phase prefix
  const m = s.match(/^([A-Z]{2})[\s\-]?(\d.*)$/);
  return m ? `${m[1]} ${m[2]}`.trim() : s;
}

function loadPhaseFiles() {
  const files = fs.readdirSync(MCG_DIR).filter(f => /^phase-[A-Z]{2}\.json$/.test(f));
  if (!files.length) {
    throw new Error(`No phase-*.json files found in ${MCG_DIR}`);
  }
  return files.map(f => ({
    file: f,
    data: JSON.parse(fs.readFileSync(path.join(MCG_DIR, f), 'utf8')),
  }));
}

// ------------------------------------------------------------
// Build step
// ------------------------------------------------------------

function build() {
  const warnings = [];
  const events = {};           // normalized code -> event record
  const phaseFiles = loadPhaseFiles();

  for (const { file, data } of phaseFiles) {
    const phase = data.phase;
    for (const mod of data.modules || []) {
      for (const evt of mod.events || []) {
        const code = normalizeCode(evt.code);
        if (!code) continue;
        if (events[code]) {
          warnings.push(`duplicate event code "${code}" (${file}); keeping first definition`);
          continue;
        }
        events[code] = {
          eventName: evt.eventName,
          eventType: evt.eventType,
          eventTypeName: evt.eventTypeName,
          phase,
          moduleCode: mod.moduleCode,
          parentCourse: mod.parentCourse,
          applicability: evt.applicability || [],
          description: evt.description || '',
          prerequisites: (evt.prerequisites || []).map(p => ({
            code: normalizeCode(p.code),
            name: p.name,
            requiredFor: p.requiredFor ? normalizeCode(p.requiredFor) : null,
            notes: p.notes || null,
          })),
        };
      }
    }
  }

  // Detect dangling prereq codes (prereq points at something not in the
  // MCG). These are usually fine (external curriculum, academic course),
  // but worth flagging for the user's awareness.
  const allCodes = new Set(Object.keys(events));
  const danglingRefs = new Map(); // code -> count
  for (const [, rec] of Object.entries(events)) {
    for (const p of rec.prerequisites) {
      if (p.code && !allCodes.has(p.code)) {
        danglingRefs.set(p.code, (danglingRefs.get(p.code) || 0) + 1);
      }
    }
  }

  // Sanity-check goal events exist
  const missingGoals = GOAL_EVENTS.filter(g => !allCodes.has(g));
  if (missingGoals.length) {
    warnings.push(`goal events missing from MCG: ${missingGoals.join(', ')}`);
  }

  const graph = {
    _meta: {
      builderVersion: BUILDER_VERSION,
      mcgVersion: MCG_VERSION,
      builtAt: new Date().toISOString(),
      sourceDir: path.relative(path.join(__dirname, '..'), MCG_DIR),
      eventCount: Object.keys(events).length,
      danglingPrereqRefs: [...danglingRefs.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([code, count]) => ({ code, count })),
      warnings,
    },
    goalEvents: GOAL_EVENTS,
    events,
  };

  return graph;
}

// ------------------------------------------------------------
// Embed the graph into index.html between the fenced markers.
// If the fences don't exist yet (fresh repo), we just write the JSON
// file and leave HTML alone — the UI scaffold will wire it up later.
// ------------------------------------------------------------
function embedInHtml(graph) {
  if (!fs.existsSync(HTML_PATH)) {
    return { embedded: false, reason: 'index.html does not exist yet' };
  }
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  const BEGIN = '<!-- MCG-GRAPH:BEGIN -->';
  const END = '<!-- MCG-GRAPH:END -->';
  const beginIdx = html.indexOf(BEGIN);
  const endIdx = html.indexOf(END);
  if (beginIdx === -1 || endIdx === -1) {
    return { embedded: false, reason: 'MCG-GRAPH fences not found in index.html' };
  }
  if (endIdx < beginIdx) {
    throw new Error('MCG-GRAPH:END appears before MCG-GRAPH:BEGIN in index.html');
  }
  const before = html.slice(0, beginIdx + BEGIN.length);
  const after = html.slice(endIdx);
  const newBlock = [
    '',
    '<script id="mcg-graph" type="application/json">',
    JSON.stringify(graph, null, 2),
    '</script>',
    '',
  ].join('\n');
  fs.writeFileSync(HTML_PATH, before + newBlock + after);
  return { embedded: true };
}

// ------------------------------------------------------------
// Main
// ------------------------------------------------------------

function main() {
  console.log(`build-prereq-graph.cjs v${BUILDER_VERSION}  (MCG ${MCG_VERSION})`);
  const graph = build();

  fs.writeFileSync(OUT_JSON, JSON.stringify(graph, null, 2));
  console.log(`  wrote ${path.relative(__dirname, OUT_JSON)}`);
  console.log(`  events: ${graph._meta.eventCount}`);
  console.log(`  goal events: ${graph.goalEvents.length}`);
  console.log(`  dangling prereq refs: ${graph._meta.danglingPrereqRefs.length}`);
  if (graph._meta.warnings.length) {
    console.log('  warnings:');
    graph._meta.warnings.forEach(w => console.log(`    - ${w}`));
  }

  const embed = embedInHtml(graph);
  if (embed.embedded) {
    console.log('  embedded graph into index.html between MCG-GRAPH fences');
  } else {
    console.log(`  did NOT embed into index.html (${embed.reason})`);
  }
}

if (require.main === module) {
  try { main(); }
  catch (e) { console.error('[build-prereq-graph] FAILED:', e.message); process.exit(1); }
}

module.exports = { build, normalizeCode, GOAL_EVENTS };
