/* ============================================================
 * File:       Code.gs
 * Module:     big-board-curriculum-status / GAS backend
 * Version:    0.3.0
 * MCG Target: 26A
 * Updated:    2026-10-01
 * Changelog:
 *   0.3.0 - Layout detection. The event-meta block (Course No / Event No /
 *           EVENT / Pilot / FTE / ...) was read from fixed columns AA..AE.
 *           That is right for 26A (students in B..Z) and wrong for any tab
 *           with a different number of student columns: on 26B the block
 *           sits one column left, so every field came back shifted (event
 *           code in courseNo, title in eventNo) and the tracker matched
 *           nothing. detectLayout_() now finds the columns from the header
 *           labels in row 8 and the class dates from their labels in row 6,
 *           falling back to the old fixed positions when a label is absent.
 *           Additive output (apiVersion 1.1): payload.layout (what was
 *           detected), and per event gates {pilot,fte,cso,rpa}, boardType,
 *           aircraft. Existing fields are unchanged.
 *   0.2.0 - Perf + correctness: getFontLines() replaces getRichTextValues()
 *           for strikethrough detection. Cuts response time roughly in half
 *           (rich-text reads were pushing ~20s responses into intermittent
 *           Google HTML timeout pages: "Unexpected token '<'"), and detects
 *           strikes on date-typed cells (rich-text runs are empty for dates,
 *           so those strikes were silently lost).
 *   0.1.0 - Initial: sheets_avail, fetch_sheet, health endpoints.
 *           Classifies cell backgrounds (white/lightGrey/darkGrey/
 *           paired) and surfaces strikethrough for paired events.
 * ============================================================
 *
 * Deployment:
 *   1. Create a new Apps Script project (standalone, not container-bound).
 *   2. Paste this file.
 *   3. In Project Settings → Script Properties, add:
 *        SHEET_ID = <the file-ID of the Digital Big Board Google Sheet>
 *   4. Deploy → New deployment → type "Web app":
 *        - Execute as:  Me (your account)
 *        - Who has access: Anyone
 *      Copy the resulting /exec URL into index.html (GAS_ENDPOINT).
 *
 * Endpoints (all GET):
 *   ?call=health
 *   ?call=sheets_avail
 *   ?call=fetch_sheet&sheet=<tabName>
 *
 * CORS note:
 *   GAS Web Apps served via ContentService with MimeType.JSON are
 *   fetchable from any origin via simple GET. No custom headers needed
 *   and none are allowed.
 */

// ------------------------------------------------------------
// Constants
// ------------------------------------------------------------

var APP_VERSION = '0.3.0';
var API_VERSION = '1.1';
var MCG_VERSION = '26A';

// Event meta columns (1-based to match SpreadsheetApp). AA=27, AB=28, etc.
// v0.3.0: these are the FALLBACK positions (the 26A layout). The real ones
// are read per tab from the row-8 header labels — see detectLayout_().
var COL_SERIES    = 27;
var COL_COURSE_NO = 28;
var COL_EVENT_NO  = 29;
var COL_TITLE     = 30;
var COL_PILOT     = 31;

// Student columns: B..Z = 2..26
var STUDENT_COL_START = 2;
var STUDENT_COL_END   = 26;

// Fixed rows for header block
var ROW_STUDENT_NAME  = 6;
var ROW_STUDENT_TYPE  = 7;
var ROW_DATA_GROUP    = 8;
var ROW_CLASS_META    = 7;  // class start = AB7, class end = AC7
var EVENT_ROW_START   = 9;

// Student-type typo / alias normalization
var TYPE_ALIASES = {
  'Pilo-B': 'Pilot-B',
  'Pilot-B  ': 'Pilot-B'
};

// ------------------------------------------------------------
// Router
// ------------------------------------------------------------

function doGet(e) {
  try {
    var call = (e && e.parameter && e.parameter.call) || 'health';
    var body;
    switch (call) {
      case 'health':       body = endpointHealth_(); break;
      case 'sheets_avail': body = endpointSheetsAvail_(); break;
      case 'fetch_sheet':  body = endpointFetchSheet_(e.parameter.sheet); break;
      default: throw new Error('Unknown call: ' + call);
    }
    return jsonOut_(body);
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err.message || err), stack: err.stack || null });
  }
}

function jsonOut_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ------------------------------------------------------------
// Endpoints
// ------------------------------------------------------------

function endpointHealth_() {
  return {
    ok: true,
    apiVersion: API_VERSION,
    appVersion: APP_VERSION,
    mcgVersion: MCG_VERSION,
    sheetId: getSheetId_(),
    serverTime: new Date().toISOString()
  };
}

function endpointSheetsAvail_() {
  var ss = openSpreadsheet_();
  var sheets = ss.getSheets().map(function (s) {
    return {
      name: s.getName(),
      rows: s.getLastRow(),
      cols: s.getLastColumn(),
      sheetId: s.getSheetId()
    };
  });
  return {
    ok: true,
    apiVersion: API_VERSION,
    spreadsheetName: ss.getName(),
    sheets: sheets
  };
}

function endpointFetchSheet_(sheetName) {
  if (!sheetName) throw new Error('Missing required param: sheet');
  var ss = openSpreadsheet_();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet not found: ' + sheetName);

  var lastRow = sheet.getLastRow();
  var lastCol = Math.max(sheet.getLastColumn(), COL_PILOT);

  // Header block: values for rows 1..8 so the UI can show class metadata
  // and student roster without extra fetches. Wide enough to cover the
  // event-meta labels wherever this tab puts them.
  var headerValues = sheet.getRange(1, 1, 8, Math.min(lastCol, 60)).getValues();
  var layout = detectLayout_(headerValues);

  // Class start/end: the cells under the "Class Start Date" / "Class End
  // Date" labels (AB7 / AC7 on the 26A layout).
  var classStart = formatDateLoose_(headerValues[ROW_CLASS_META - 1][layout.classStart - 1]);
  var classEnd   = formatDateLoose_(headerValues[ROW_CLASS_META - 1][layout.classEnd - 1]);

  // Build student roster
  var students = [];
  for (var c = STUDENT_COL_START; c <= layout.studentEnd; c++) {
    var name = String(headerValues[ROW_STUDENT_NAME - 1][c - 1] || '').trim();
    if (!name) continue; // inactive slot
    var rawType = String(headerValues[ROW_STUDENT_TYPE - 1][c - 1] || '').trim();
    var type = normalizeType_(rawType);
    var dataGroup = String(headerValues[ROW_DATA_GROUP - 1][c - 1] || '').trim();
    students.push({
      col: c,
      colLetter: colLetter_(c),
      name: name,
      type: type,
      rawType: rawType === type ? null : rawType,  // surface if we normalized
      dataGroup: dataGroup
    });
  }

  // Event rows: fetch meta + all student cells in one pass per section.
  // We pull the student-cell block (cols B..Z, all event rows) as three
  // parallel 2D arrays: values, backgrounds, font-lines.
  // v0.2.0: getFontLines() replaced getRichTextValues() — it is dramatically
  // faster (the rich-text call was ~half the request time, pushing responses
  // to ~20s and causing intermittent Google HTML timeout pages), AND it reads
  // strikethrough as a cell FORMAT, so strikes on date-typed cells register
  // (rich-text runs are empty for date values — those strikes were lost).
  // Caveat: a strike applied to only part of a cell's text no longer counts;
  // board convention strikes whole cells, so that's fine.
  var nEventRows = Math.max(lastRow - EVENT_ROW_START + 1, 0);
  var events = [];
  if (nEventRows > 0) {
    // Meta block: one read from the series column through the right-most
    // meta column this tab has; fields are picked out of it by offset.
    var metaRange = sheet.getRange(EVENT_ROW_START, layout.series, nEventRows,
      layout.metaEnd - layout.series + 1);
    var metaValues = metaRange.getDisplayValues();
    var metaAt = function (row, col) {   // col = 1-based sheet column; 0 = this tab has none
      return col ? String(row[col - layout.series] || '').trim() : '';
    };

    var studentRange = sheet.getRange(EVENT_ROW_START, STUDENT_COL_START, nEventRows,
      layout.studentEnd - STUDENT_COL_START + 1);
    var cellValues = studentRange.getDisplayValues();
    var cellBgs = studentRange.getBackgrounds();
    var cellFontLines = studentRange.getFontLines(); // 'line-through' | 'underline' | 'none'

    for (var i = 0; i < nEventRows; i++) {
      var series = metaAt(metaValues[i], layout.series);
      var courseNo = metaAt(metaValues[i], layout.courseNo);
      var eventNoRaw = metaAt(metaValues[i], layout.eventNo);
      var title = metaAt(metaValues[i], layout.title);
      var pilotGate = metaAt(metaValues[i], layout.pilot);

      // Skip rows that carry no event metadata at all (truly blank lines)
      if (!series && !eventNoRaw && !title) continue;

      var cells = [];
      for (var j = 0; j < students.length; j++) {
        var studentCol = students[j].col;
        var jIdx = studentCol - STUDENT_COL_START;
        var bg = String(cellBgs[i][jIdx] || '#ffffff').toUpperCase().replace('#', '');
        var rgbFamily = classifyBg_(bg);
        var strike = (cellFontLines[i][jIdx] === 'line-through');
        cells.push({
          col: studentCol,
          value: String(cellValues[i][jIdx] || '').trim(),
          bgHex: bg,
          rgbFamily: rgbFamily,
          strikethrough: strike
        });
      }

      events.push({
        row: EVENT_ROW_START + i,
        series: series,
        courseNo: courseNo,
        eventNo: normalizeCode_(eventNoRaw),
        eventNoRaw: eventNoRaw,
        title: title,
        pilotGate: pilotGate,
        // v0.3.0 (additive): who-does-it gates per role, plus the board's
        // own Event Type / Aircraft columns. Blank when the tab has no
        // such column.
        gates: {
          pilot: pilotGate,
          fte: metaAt(metaValues[i], layout.fte),
          cso: metaAt(metaValues[i], layout.cso),
          rpa: metaAt(metaValues[i], layout.rpa)
        },
        boardType: metaAt(metaValues[i], layout.eventType),
        aircraft: metaAt(metaValues[i], layout.aircraft),
        cells: cells
      });
    }
  }

  return {
    ok: true,
    apiVersion: API_VERSION,
    appVersion: APP_VERSION,
    mcgVersion: MCG_VERSION,
    sheetName: sheetName,
    fetchedAt: new Date().toISOString(),
    classMeta: { startDate: classStart, endDate: classEnd },
    layout: layout,
    students: students,
    events: events
  };
}

// ------------------------------------------------------------
// Layout detection (v0.3.0)
// ------------------------------------------------------------

// Work out where this tab keeps its event-meta block.
//
// Every Big Board tab labels those columns in row 8, to the right of the
// student columns:   Course No | Event No | EVENT | Pilot | FTE | CSO | RPA
//                    | Event Type | Aircraft
// (the series column — CF / PF / ... — sits unlabeled just left of Course
// No), and labels the class dates in row 6 ("Class Start Date", "Class End
// Date") with the values directly beneath in row 7.
//
// headerValues = rows 1..8 as returned by getValues(). Returns 1-based
// column numbers; 0 means "this tab has no such column". source says
// whether the labels were found ("header") or the 26A positions were
// assumed ("default").
function detectLayout_(headerValues) {
  var layout = {
    source: 'default',
    series: COL_SERIES, courseNo: COL_COURSE_NO, eventNo: COL_EVENT_NO,
    title: COL_TITLE, pilot: COL_PILOT,
    fte: 0, cso: 0, rpa: 0, eventType: 0, aircraft: 0,
    metaEnd: COL_PILOT,
    studentEnd: STUDENT_COL_END,
    classStart: 28, classEnd: 29
  };
  var norm = function (v) {
    return String(v == null ? '' : v).toLowerCase().replace(/[\s.]+/g, ' ').trim();
  };

  // Row 8 holds each student's data group in the student columns and the
  // meta labels after them. "Event No" is the anchor: no student column
  // can read that.
  var labels = headerValues[ROW_DATA_GROUP - 1].map(norm);
  var eventNo = labels.indexOf('event no') + 1;
  if (eventNo > 2) {
    var after = function (name, fallback) {   // first match right of Event No
      for (var c = eventNo; c < labels.length; c++) if (labels[c] === name) return c + 1;
      return fallback;
    };
    layout.source = 'header';
    layout.eventNo = eventNo;
    layout.courseNo = eventNo - 1;
    layout.series = eventNo - 2;
    layout.title = after('event', eventNo + 1);
    layout.pilot = after('pilot', layout.title + 1);
    layout.fte = after('fte', 0);
    layout.cso = after('cso', 0);
    layout.rpa = after('rpa', 0);
    layout.eventType = after('event type', 0);
    layout.aircraft = after('aircraft', 0);
    layout.metaEnd = Math.max(layout.title, layout.pilot, layout.fte, layout.cso, layout.rpa,
      layout.eventType, layout.aircraft);
    // Student columns run from B up to the column before the series column.
    layout.studentEnd = Math.max(STUDENT_COL_START, layout.series - 1);
  }

  // Class dates: labels in row 6, values under them in row 7.
  var nameRow = headerValues[ROW_STUDENT_NAME - 1].map(norm);
  var cs = nameRow.indexOf('class start date') + 1;
  var ce = nameRow.indexOf('class end date') + 1;
  if (cs) layout.classStart = cs;
  if (ce) layout.classEnd = ce;
  return layout;
}

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

function getSheetId_() {
  var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!id) throw new Error('Script property SHEET_ID is not set.');
  return id;
}

function openSpreadsheet_() {
  return SpreadsheetApp.openById(getSheetId_());
}

function normalizeType_(raw) {
  if (!raw) return '';
  if (TYPE_ALIASES[raw]) return TYPE_ALIASES[raw];
  return raw;
}

function normalizeCode_(raw) {
  if (!raw) return '';
  var s = String(raw).trim().replace(/\s+/g, ' ');
  var m = s.match(/^([A-Z]{2})[\s\-]?(\d.*)$/);
  return m ? (m[1] + ' ' + m[2]).trim() : s;
}

function colLetter_(colNumber) {
  // 1 -> A, 27 -> AA, etc.
  var letters = '';
  var n = colNumber;
  while (n > 0) {
    var r = (n - 1) % 26;
    letters = String.fromCharCode(65 + r) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

function formatDateLoose_(value) {
  if (!value) return null;
  if (value instanceof Date) return Utilities.formatDate(value, 'UTC', 'yyyy-MM-dd');
  return String(value);
}

// Classify a background hex (RRGGBB, no '#') into one of:
//   "white"     R=G=B and R>=240   (also matches "no fill" which GAS reports as FFFFFF)
//   "lightGrey" R=G=B and 150<=R<240
//   "darkGrey"  R=G=B and R<150
//   "paired"    any non-greyscale color
function classifyBg_(hex) {
  if (!hex || hex.length !== 6) return 'white';
  var r = parseInt(hex.slice(0, 2), 16);
  var g = parseInt(hex.slice(2, 4), 16);
  var b = parseInt(hex.slice(4, 6), 16);
  if (r === g && g === b) {
    if (r >= 240) return 'white';
    if (r >= 150) return 'lightGrey';
    return 'darkGrey';
  }
  return 'paired';
}

// UNUSED as of v0.2.0 (getFontLines() supersedes it — faster, and works on
// date-typed cells). Kept for reference; safe to delete.
// True iff any run in the rich-text cell is struck through.
function hasStrikethrough_(rt) {
  if (!rt) return false;
  try {
    var runs = rt.getRuns();
    for (var i = 0; i < runs.length; i++) {
      var style = runs[i].getTextStyle();
      if (style && style.isStrikethrough()) return true;
    }
    // Fall back to whole-cell style for simple values
    var whole = rt.getTextStyle && rt.getTextStyle();
    if (whole && whole.isStrikethrough && whole.isStrikethrough()) return true;
  } catch (err) {
    // Some cells may not have rich text — treat as non-struck.
  }
  return false;
}

// ------------------------------------------------------------
// Dev / self-test (run manually from the Apps Script editor)
// ------------------------------------------------------------

function _selfTest() {
  var h = endpointHealth_();
  Logger.log('health: ' + JSON.stringify(h));
  var list = endpointSheetsAvail_();
  Logger.log('sheets: ' + list.sheets.map(function (s) { return s.name; }).join(', '));
  if (list.sheets.length) {
    var first = list.sheets.filter(function (s) {
      return /FTC Big Board/i.test(s.name);
    })[0] || list.sheets[0];
    var fetched = endpointFetchSheet_(first.name);
    Logger.log('fetched "' + first.name + '" — students=' + fetched.students.length
      + ' events=' + fetched.events.length);
  }
  // v0.3.0: show what detectLayout_ found on every FTC board tab. Expect
  // source=header on each, and eventNo one column lower on 26B than 26A.
  list.sheets.filter(function (s) { return /FTC Big Board/i.test(s.name); }).forEach(function (s) {
    var f = endpointFetchSheet_(s.name);
    var coded = f.events.filter(function (e) { return /^[A-Z]{2} \d{4}/.test(e.eventNo); }).length;
    Logger.log(s.name + ' — layout ' + JSON.stringify(f.layout) + ' — ' + f.students.length
      + ' students, ' + coded + ' of ' + f.events.length + ' rows carry an event code');
  });
}
