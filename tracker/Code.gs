/* ============================================================
 * File:       Code.gs
 * Module:     big-board-curriculum-status / GAS backend
 * Version:    0.1.0
 * MCG Target: 26A
 * Updated:    2026-04-14
 * Changelog:
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

var APP_VERSION = '0.1.0';
var API_VERSION = '1.0';
var MCG_VERSION = '26A';

// Event meta columns (1-based to match SpreadsheetApp). AA=27, AB=28, etc.
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
  var lastCol = Math.max(sheet.getLastColumn(), COL_TITLE);

  // Header block: values for rows 1..8 across cols A..AE so the UI can
  // show class metadata and student roster without extra fetches.
  var headerValues = sheet.getRange(1, 1, 8, Math.min(lastCol, 32)).getValues();

  // Class start/end lives at AB7 / AC7. (1-based: row 7, cols 28 & 29.)
  var classStart = formatDateLoose_(headerValues[ROW_CLASS_META - 1][27]);
  var classEnd   = formatDateLoose_(headerValues[ROW_CLASS_META - 1][28]);

  // Build student roster
  var students = [];
  for (var c = STUDENT_COL_START; c <= STUDENT_COL_END; c++) {
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
  // parallel 2D arrays: values, backgrounds, rich-text. That's the most
  // efficient shape for SpreadsheetApp.
  var nEventRows = Math.max(lastRow - EVENT_ROW_START + 1, 0);
  var events = [];
  if (nEventRows > 0) {
    var metaRange = sheet.getRange(EVENT_ROW_START, COL_SERIES, nEventRows, 5); // cols AA..AE
    var metaValues = metaRange.getDisplayValues();

    var studentRange = sheet.getRange(EVENT_ROW_START, STUDENT_COL_START, nEventRows,
      STUDENT_COL_END - STUDENT_COL_START + 1);
    var cellValues = studentRange.getDisplayValues();
    var cellBgs = studentRange.getBackgrounds();
    var cellRichText = studentRange.getRichTextValues();

    for (var i = 0; i < nEventRows; i++) {
      var series = String(metaValues[i][0] || '').trim();
      var courseNo = String(metaValues[i][1] || '').trim();
      var eventNoRaw = String(metaValues[i][2] || '').trim();
      var title = String(metaValues[i][3] || '').trim();
      var pilotGate = String(metaValues[i][4] || '').trim();

      // Skip rows that carry no event metadata at all (truly blank lines)
      if (!series && !eventNoRaw && !title) continue;

      var cells = [];
      for (var j = 0; j < students.length; j++) {
        var studentCol = students[j].col;
        var jIdx = studentCol - STUDENT_COL_START;
        var bg = String(cellBgs[i][jIdx] || '#ffffff').toUpperCase().replace('#', '');
        var rgbFamily = classifyBg_(bg);
        var rt = cellRichText[i][jIdx];
        var strike = hasStrikethrough_(rt);
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
    students: students,
    events: events
  };
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
}
