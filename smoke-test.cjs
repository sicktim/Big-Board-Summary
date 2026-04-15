/* ============================================================
 * File:       smoke-test.cjs
 * Module:     big-board-curriculum-status / dev-test
 * Version:    0.1.0
 * MCG Target: 26A
 * Updated:    2026-04-14
 * Changelog:
 *   0.1.0 - Initial smoke test. Parses sample xlsx into a GAS-shaped
 *           SheetPayload and runs the front-end's aggregation logic
 *           locally so we can sanity-check the 7-state decision tree
 *           before deploying Code.gs.
 * ============================================================
 *
 * Run:   node smoke-test.cjs
 *
 * Reads:
 *   Digital Big Board_260414.xlsx > 26A FTC Big Board
 *   mcg-26a-graph.json
 *
 * Prints per goal event:
 *   - final state
 *   - applicable student count
 *   - completes / scheduled
 *   - any flagged cells (past-dated + white)
 *   - sample prereq chain for the first applicable student
 */

'use strict';

const path = require('path');
const fs = require('fs');
const XLSX = require(path.join('..', 'big-board-validation', 'node_modules', 'xlsx'));

const FILE = path.join(__dirname, 'Digital Big Board_260414.xlsx');
const TAB = '26A FTC Big Board';
const GRAPH_PATH = path.join(__dirname, 'mcg-26a-graph.json');

const MCG_GRAPH = JSON.parse(fs.readFileSync(GRAPH_PATH, 'utf8'));

// --- Constants from Code.gs, mirrored here ---
const STUDENT_COL_START = 2;
const STUDENT_COL_END = 26;
const ROW_STUDENT_NAME = 6;
const ROW_STUDENT_TYPE = 7;
const ROW_DATA_GROUP = 8;
const EVENT_ROW_START = 9;
const COL_SERIES = 27, COL_COURSE_NO = 28, COL_EVENT_NO = 29, COL_TITLE = 30;
const TYPE_ALIASES = { 'Pilo-B': 'Pilot-B' };

// --- helpers (normalize + classify, same as Code.gs / index.html) ---
function normalizeCode(raw) {
  if (!raw) return '';
  const s = String(raw).trim().replace(/\s+/g, ' ');
  const m = s.match(/^([A-Z]{2})[\s\-]?(\d.*)$/);
  return m ? `${m[1]} ${m[2]}`.trim() : s;
}
function classifyBg(hex) {
  if (!hex || hex.length !== 6) return 'white';
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  if (r === g && g === b) {
    if (r >= 240) return 'white';
    if (r >= 150) return 'lightGrey';
    return 'darkGrey';
  }
  return 'paired';
}
function expandStudentTypeToMcg(type) {
  if (!type) return [];
  if (/^Pilot/i.test(type)) return ['P'];
  return [type.toUpperCase()];
}
function isStudentApplicable(student, eventApplicability) {
  if (!eventApplicability || !eventApplicability.length) return true;
  const codes = expandStudentTypeToMcg(student.type);
  return codes.some(c => eventApplicability.indexOf(c) !== -1);
}

// --- Parse the sample xlsx into a SheetPayload mirror ---
function parseSheet() {
  const wb = XLSX.readFile(FILE, { cellStyles: true, cellDates: true });
  const ws = wb.Sheets[TAB];
  const range = XLSX.utils.decode_range(ws['!ref']);

  function readCell(r, c) {
    const addr = XLSX.utils.encode_cell({ r, c });
    const cc = ws[addr];
    if (!cc) return { value: '', bg: 'FFFFFF', strike: false, rich: null };
    const bg = (cc.s?.fgColor?.rgb || cc.s?.bgColor?.rgb || 'FFFFFF').toUpperCase();
    return {
      value: cc.w || (cc.v != null ? String(cc.v) : ''),
      bg,
      strike: !!cc.s?.font?.strike,
    };
  }

  // students
  const students = [];
  for (let c = STUDENT_COL_START; c <= STUDENT_COL_END; c++) {
    const nameCell = readCell(ROW_STUDENT_NAME - 1, c - 1);
    if (!nameCell.value) continue;
    const rawType = readCell(ROW_STUDENT_TYPE - 1, c - 1).value.trim();
    const type = TYPE_ALIASES[rawType] || rawType;
    const dataGroup = readCell(ROW_DATA_GROUP - 1, c - 1).value.trim();
    students.push({ col: c, name: nameCell.value.trim(), type, rawType: rawType === type ? null : rawType, dataGroup });
  }

  // events
  const events = [];
  for (let r = EVENT_ROW_START - 1; r <= range.e.r; r++) {
    const series = readCell(r, COL_SERIES - 1).value.trim();
    const eventNoRaw = readCell(r, COL_EVENT_NO - 1).value.trim();
    const title = readCell(r, COL_TITLE - 1).value.trim();
    if (!series && !eventNoRaw && !title) continue;
    const cells = [];
    for (const s of students) {
      const raw = readCell(r, s.col - 1);
      const bg = raw.bg || 'FFFFFF';
      cells.push({
        col: s.col, value: raw.value.trim(), bgHex: bg,
        rgbFamily: classifyBg(bg), strikethrough: raw.strike,
      });
    }
    events.push({
      row: r + 1, series, eventNo: normalizeCode(eventNoRaw), eventNoRaw, title, cells,
    });
  }

  // class meta from AB7/AC7
  const cs = readCell(6, 27).value; const ce = readCell(6, 28).value;
  return {
    sheetName: TAB,
    fetchedAt: new Date().toISOString(),
    classMeta: { startDate: cs || null, endDate: ce || null },
    students,
    events,
  };
}

// --- Status logic (mirrors statusModule in index.html) ---
function parseCellDate(value, classStart, classEnd) {
  if (!value) return null;
  let m = String(value).match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?$/);
  if (m) {
    let year;
    if (m[3]) year = m[3].length === 2 ? (2000 + parseInt(m[3], 10)) : parseInt(m[3], 10);
    else {
      const cs = classStart ? new Date(classStart) : null;
      const ce = classEnd ? new Date(classEnd) : null;
      year = (cs || ce || new Date()).getFullYear();
    }
    return new Date(year, parseInt(m[1], 10) - 1, parseInt(m[2], 10));
  }
  return null;
}
function classifyCell(cell, classMeta, now) {
  if (!cell) return { completion: 'pending' };
  if (cell.rgbFamily === 'darkGrey') return { completion: 'notreq' };
  if (cell.rgbFamily === 'lightGrey') return { completion: 'complete' };
  if (cell.rgbFamily === 'paired') return { completion: cell.strikethrough ? 'complete' : 'paired-opted' };
  const d = parseCellDate(cell.value, classMeta.startDate, classMeta.endDate);
  if (d) {
    return { completion: d > now ? 'scheduled' : 'pending', flag: d > now ? null : 'past-unchecked' };
  }
  return { completion: 'pending' };
}
function aggregate(evt, mcgEvent, students, classMeta) {
  const now = new Date();
  const perStudent = {};
  let completes = 0, scheduledOrStarted = 0, applicable = 0;
  for (const s of students) {
    const cell = evt.cells.find(c => c.col === s.col);
    const cl = classifyCell(cell, classMeta, now);
    const appByType = isStudentApplicable(s, (mcgEvent && mcgEvent.applicability) || []);
    const appByCell = cl.completion !== 'notreq';
    const applicableFlag = appByType && appByCell;
    perStudent[s.col] = { ...cl, applicable: applicableFlag, student: s };
    if (applicableFlag) {
      applicable++;
      if (cl.completion === 'complete') completes++;
      else if (cl.completion === 'scheduled' || cl.completion === 'paired-opted') scheduledOrStarted++;
    }
  }
  let state;
  if (applicable === 0) state = 'PrereqsMet';
  else if (completes === applicable) state = 'Complete';
  else if (completes / applicable >= 0.5) state = 'PartiallyComplete';
  else if (completes > 0 || scheduledOrStarted > 0) state = 'Started';
  else state = 'NotStarted';
  return { state, applicable, completes, scheduledOrStarted, perStudent };
}

// --- Simple prereq chain (board-filtered) for first applicable student ---
function buildChainForStudent(goalCode, byCode, student, classMeta) {
  const now = new Date();
  const out = [];
  const seen = new Set();
  const stack = [{ code: goalCode, depth: 0 }];
  while (stack.length) {
    const node = stack.shift();
    if (seen.has(node.code)) continue;
    seen.add(node.code);
    const mcg = MCG_GRAPH.events[node.code];
    const onBoard = !!byCode[node.code];
    let status = 'offboard';
    if (onBoard) {
      const evt = byCode[node.code];
      const cell = evt.cells.find(c => c.col === student.col);
      status = classifyCell(cell, classMeta, now).completion;
    }
    if (node.code !== goalCode) out.push({ code: node.code, depth: node.depth, onBoard, status });
    const prereqs = (mcg && mcg.prerequisites) || [];
    for (const p of prereqs) if (p.code && !seen.has(p.code)) stack.push({ code: p.code, depth: node.depth + 1 });
  }
  return out;
}

// --- Run ---
function main() {
  const payload = parseSheet();
  const byCode = {};
  payload.events.forEach(e => { if (e.eventNo) byCode[e.eventNo] = e; });

  console.log(`Sheet: ${payload.sheetName}`);
  console.log(`Students: ${payload.students.length}  Events: ${payload.events.length}`);
  console.log('Class:', payload.classMeta);
  console.log('');

  const goals = MCG_GRAPH.goalEvents;
  for (const code of goals) {
    const evt = byCode[code];
    const mcg = MCG_GRAPH.events[code];
    if (!evt) {
      console.log(`[MISS]  ${code}  — not on board  (${mcg ? mcg.eventName : '(no MCG)'})`);
      continue;
    }
    const agg = aggregate(evt, mcg, payload.students, payload.classMeta);
    const pct = agg.applicable ? Math.round(agg.completes / agg.applicable * 100) : 0;
    console.log(`[${String(agg.state).padEnd(18)}] ${code}  ${pct.toString().padStart(3)}%  ` +
                `complete=${agg.completes}/${agg.applicable}  sched=${agg.scheduledOrStarted}  ` +
                `mcg-applicability=${(mcg?.applicability || []).join(',')}  row=${evt.row}`);
    // Sample chain for first applicable student
    const firstApp = payload.students.find(s => agg.perStudent[s.col]?.applicable);
    if (firstApp) {
      const chainItems = buildChainForStudent(code, byCode, firstApp, payload.classMeta);
      const onBoardItems = chainItems.filter(c => c.onBoard);
      console.log(`        chain sample (student ${firstApp.name} ${firstApp.type}): ` +
                  `${onBoardItems.length} on-board prereqs, ${chainItems.length - onBoardItems.length} off-board`);
    }
  }

  // Extra diagnostics: any unknown student types (typos) we had to flag?
  const flagged = payload.students.filter(s => s.rawType);
  if (flagged.length) {
    console.log('\nNormalized student types:');
    flagged.forEach(s => console.log(`  ${s.name}: "${s.rawType}" → "${s.type}"`));
  }
}

main();
