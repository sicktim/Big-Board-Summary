// Second-pass inspector: drill down on student meta rows (7-8), section
// header rows, and real event rows so we can lock the GAS parser contract.
const path = require('path');
const XLSX = require(path.join('..', 'big-board-validation', 'node_modules', 'xlsx'));

const wb = XLSX.readFile(path.join(__dirname, 'Digital Big Board_260414.xlsx'),
  { cellStyles: true, cellFormula: false, cellDates: true });
const ws = wb.Sheets['26A FTC Big Board'];
const range = XLSX.utils.decode_range(ws['!ref']);
const maxCol = 27; // A..AA

const cell = addr => ws[addr];
const info = addr => {
  const c = cell(addr);
  if (!c) return null;
  return {
    v: c.v,
    w: c.w,
    bg: c.s?.fgColor?.rgb || c.s?.bgColor?.rgb || null,
    pat: c.s?.patternType || null,
    strike: !!c.s?.font?.strike,
    rich: c.r || null,
  };
};

console.log('=== Rows 6..8 (students, type, data-group) col A..AA ===');
for (let r = 5; r <= 7; r++) {
  const row = [];
  for (let c = 0; c < maxCol; c++) {
    const addr = XLSX.utils.encode_cell({ r, c });
    const i = info(addr);
    const cell = i && (i.v ?? '');
    row.push(`${XLSX.utils.encode_col(c)}=${cell === '' || cell === null ? '∅' : cell}`);
  }
  console.log(`R${r + 1}: ${row.join(' | ')}`);
}

console.log('\n=== Rows 9..25 cols A..F + sample two data cols ===');
for (let r = 8; r < 25; r++) {
  const parts = [];
  for (let c = 0; c < 8; c++) {
    const i = info(XLSX.utils.encode_cell({ r, c }));
    parts.push(i && i.v !== undefined ? String(i.v) : '');
  }
  const dataB = info(XLSX.utils.encode_cell({ r, c: 1 }));   // col B
  const dataM = info(XLSX.utils.encode_cell({ r, c: 12 }));  // col M
  console.log(`R${r + 1}:`, parts.join(' | '), '|| B:', dataB ? `v=${dataB.w} bg=${dataB.bg} strike=${dataB.strike}` : '-', '|| M:', dataM ? `v=${dataM.w} bg=${dataM.bg} strike=${dataM.strike}` : '-');
}

console.log('\n=== Searching for section headers and goal events ===');
const goals = ['PF 8311F','PF 8332F','FQ 9502S','FQ 9511F','FQ 9512C','SY 7503F','SY 7511F','SY 7512C','SY 7521O','TF 9102E','TF 9111E'];
for (let r = range.s.r; r <= range.e.r; r++) {
  const colC = info(XLSX.utils.encode_cell({ r, c: 2 })); // col C
  const colD = info(XLSX.utils.encode_cell({ r, c: 3 })); // col D
  const rowText = `${colC?.v ?? ''} | ${colD?.v ?? ''}`;
  if (goals.some(g => rowText.includes(g) || rowText.includes(g.replace(' ', '')))) {
    console.log(`GOAL row ${r + 1}:`, rowText);
    // sample 3 students with format
    for (const cc of [1, 5, 15, 20]) {
      const i = info(XLSX.utils.encode_cell({ r, c: cc }));
      if (i) console.log(`    ${XLSX.utils.encode_col(cc)}${r+1}: v=${JSON.stringify(i.v)} w=${i.w} bg=${i.bg} strike=${i.strike} rich=${i.rich ? 'Y' : 'N'}`);
    }
  }
}

console.log('\n=== Rows where col A or col B has a header-like string (section labels) ===');
for (let r = range.s.r; r <= Math.min(200, range.e.r); r++) {
  const colA = info(XLSX.utils.encode_cell({ r, c: 0 }));
  const aVal = String(colA?.v ?? '');
  if (aVal && aVal.length > 3 && !/^\d+$/.test(aVal)) {
    console.log(`R${r + 1} A: ${aVal} (bg=${colA?.bg})`);
  }
}

console.log('\n=== Column counts (how many filled cells per col across the whole board) ===');
const colCounts = new Array(range.e.c + 1).fill(0);
for (let r = range.s.r; r <= range.e.r; r++) {
  for (let c = range.s.c; c <= range.e.c; c++) {
    if (ws[XLSX.utils.encode_cell({ r, c })]) colCounts[c]++;
  }
}
for (let c = 0; c <= Math.min(range.e.c, 35); c++) {
  console.log(`  ${XLSX.utils.encode_col(c)}: ${colCounts[c]}`);
}

console.log('\n=== Rich text examples: rows 9..60, col B with rich formatting ===');
let seen = 0;
for (let r = 8; r < 200 && seen < 6; r++) {
  for (let c = 1; c < 26 && seen < 6; c++) {
    const i = info(XLSX.utils.encode_cell({ r, c }));
    if (i && i.rich && typeof i.rich === 'string' && i.rich.includes('<r>')) {
      console.log(`R${r + 1} ${XLSX.utils.encode_col(c)}: w=${i.w}`);
      console.log(`  rich: ${i.rich.slice(0, 400)}`);
      seen++;
    }
  }
}

console.log('\n=== Dark grey scan (bg near 808080 / D9D9D9 / BFBFBF) in a few rows ===');
const GREY_SAMPLES = new Set();
for (let r = 8; r < 200; r++) {
  for (let c = 1; c < 26; c++) {
    const i = info(XLSX.utils.encode_cell({ r, c }));
    if (i && i.bg && i.bg !== 'FFFFFF') GREY_SAMPLES.add(i.bg);
  }
}
console.log('Unique non-white bg colors seen in rows 9..200, cols B..Z:', [...GREY_SAMPLES]);
