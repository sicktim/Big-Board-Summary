// One-shot inspector for the sample digital big board.
// Purpose: learn the real shape of the "26A FTC Big Board" tab so the GAS
// parser has a solid ground truth (header rows, student columns, event rows,
// cell formatting we can or cannot read).
//
// Usage: node _inspect_xlsx.cjs
//
// This uses SheetJS (xlsx). It's already installed in ../big-board-validation.

const path = require('path');
const XLSX = require(path.join('..', 'big-board-validation', 'node_modules', 'xlsx'));

const FILE = path.join(__dirname, 'Digital Big Board_260414.xlsx');
const TAB = '26A FTC Big Board';

const wb = XLSX.readFile(FILE, { cellStyles: true, cellFormula: false, cellDates: true });

console.log('=== Sheets in workbook ===');
console.log(wb.SheetNames);

const ws = wb.Sheets[TAB];
if (!ws) {
  console.error(`Tab "${TAB}" not found.`);
  process.exit(1);
}

const range = XLSX.utils.decode_range(ws['!ref']);
console.log(`\n=== Range for "${TAB}" ===`);
console.log(`Rows: ${range.s.r + 1} .. ${range.e.r + 1}`);
console.log(`Cols: ${XLSX.utils.encode_col(range.s.c)} .. ${XLSX.utils.encode_col(range.e.c)}  (count=${range.e.c - range.s.c + 1})`);

// Dump header rows 1..8 with values + any fill info
function cellInfo(addr) {
  const c = ws[addr];
  if (!c) return null;
  const out = { v: c.v, w: c.w };
  if (c.s) {
    if (c.s.fgColor) out.fgRGB = c.s.fgColor.rgb;
    if (c.s.bgColor) out.bgRGB = c.s.bgColor.rgb;
    if (c.s.fill) out.fill = c.s.fill;
    if (c.s.font) {
      if (c.s.font.strike) out.strike = true;
      if (c.s.font.color) out.fontColor = c.s.font.color.rgb;
    }
    if (c.s.patternType) out.pattern = c.s.patternType;
  }
  if (c.r) out.richText = c.r;
  if (c.h) out.html = c.h;
  return out;
}

console.log('\n=== Header rows 1..8 (cols A..AE) ===');
for (let r = 0; r < 8; r++) {
  for (let c = range.s.c; c <= Math.min(range.s.c + 30, range.e.c); c++) {
    const addr = XLSX.utils.encode_cell({ r, c });
    const info = cellInfo(addr);
    if (info && (info.v !== undefined && info.v !== '' || info.fgRGB || info.bgRGB)) {
      console.log(`R${r + 1} ${addr}:`, JSON.stringify(info));
    }
  }
  console.log('  ---');
}

console.log('\n=== Event rows 9..40, cols A..F (should show event series/no/title) ===');
for (let r = 8; r < Math.min(40, range.e.r + 1); r++) {
  const rowVals = [];
  for (let c = 0; c < 8; c++) {
    const addr = XLSX.utils.encode_cell({ r, c });
    const info = cellInfo(addr);
    rowVals.push(info ? (info.v ?? '') : '');
  }
  console.log(`R${r + 1}:`, rowVals.join(' | '));
}

console.log('\n=== Sample formatted cells: first 5 non-empty data cells with styling (rows 9-80, cols G..Z) ===');
let shown = 0;
for (let r = 8; r < 80 && shown < 10; r++) {
  for (let c = 6; c < 26 && shown < 10; c++) {
    const addr = XLSX.utils.encode_cell({ r, c });
    const info = cellInfo(addr);
    if (info && (info.fgRGB || info.bgRGB || info.v)) {
      console.log(`${addr}:`, JSON.stringify(info));
      shown++;
    }
  }
}

console.log('\n=== Student header area (rows 5..8, cols A..AE), including blanks ===');
for (let r = 4; r < 8; r++) {
  for (let c = 0; c <= Math.min(range.s.c + 30, range.e.c); c++) {
    const addr = XLSX.utils.encode_cell({ r, c });
    const info = cellInfo(addr);
    if (!info) continue;
    console.log(`R${r + 1} ${addr}: v=${JSON.stringify(info.v)} bgRGB=${info.bgRGB || ''} fgRGB=${info.fgRGB || ''}`);
  }
  console.log('  ---');
}
