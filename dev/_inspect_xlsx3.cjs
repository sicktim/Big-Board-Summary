// Third pass: event meta lives in cols AA..AD (Series, Course#, EventNo, Title)
// per validate.js. Confirm + dump goal-event rows with real format data.
const path = require('path');
const XLSX = require(path.join('..', 'big-board-validation', 'node_modules', 'xlsx'));
const wb = XLSX.readFile(path.join(__dirname, 'Digital Big Board_260414.xlsx'),
  { cellStyles: true, cellFormula: false, cellDates: true });
const ws = wb.Sheets['26A FTC Big Board'];
const range = XLSX.utils.decode_range(ws['!ref']);

function info(r, c) {
  const a = XLSX.utils.encode_cell({ r, c });
  const cc = ws[a];
  if (!cc) return null;
  return {
    addr: a, v: cc.v, w: cc.w,
    bg: cc.s?.fgColor?.rgb || cc.s?.bgColor?.rgb || null,
    strike: !!cc.s?.font?.strike,
    rich: cc.r || null,
  };
}

console.log('=== Cols AA..AE on rows 6..30 ===');
for (let r = 5; r < 30; r++) {
  const parts = [];
  for (let c = 26; c <= 30; c++) {
    const i = info(r, c);
    parts.push(`${XLSX.utils.encode_col(c)}=${i?.v ?? ''}`);
  }
  console.log(`R${r + 1}: ${parts.join(' | ')}`);
}

console.log('\n=== Goal-event rows ===');
const GOALS = ['PF 8311F','PF 8332F','FQ 9502S','FQ 9511F','FQ 9512C','SY 7503F','SY 7511F','SY 7512C','SY 7521O','TF 9102E','TF 9111E'];
const goalRows = [];
for (let r = 8; r <= range.e.r; r++) {
  const eventNoCell = info(r, 28); // col AC = idx 28
  const code = String(eventNoCell?.v ?? '').trim();
  if (code && GOALS.some(g => code === g || code.replace(/\s+/g, '') === g.replace(/\s+/g, ''))) {
    goalRows.push({ r, code });
  }
}
console.log('Goal rows found:', goalRows.map(g => `R${g.r + 1}=${g.code}`).join(', '));

// For each goal, show first 8 student cells with format
for (const { r, code } of goalRows) {
  console.log(`\n--- ${code} (row ${r + 1}) ---`);
  const series = info(r, 26)?.v;
  const courseNo = info(r, 27)?.v;
  const title = info(r, 29)?.v;
  console.log(`  meta: series=${series}  courseNo=${courseNo}  title=${title}`);
  for (let c = 1; c <= 26; c++) {  // B..AA
    const i = info(r, c);
    if (i && (i.v !== undefined || i.bg)) {
      console.log(`  ${i.addr}: v=${JSON.stringify(i.v)} w=${i.w} bg=${i.bg} strike=${i.strike}${i.rich ? ' RICH' : ''}`);
    }
  }
}

console.log('\n=== Section-header rows: scan col AA for blank series + something-else pattern ===');
// Any row where col AD has a value but col AC (event No) does not could be a group header
for (let r = 8; r < 200; r++) {
  const series = info(r, 26)?.v;
  const eventNo = info(r, 28)?.v;
  const title = info(r, 29)?.v;
  if (title && !eventNo) {
    console.log(`R${r + 1}: series=${series} title=${title}`);
  }
}

console.log('\n=== Colors + meaning sampler (rich text + strike examples from real goal rows) ===');
for (const { r, code } of goalRows.slice(0, 3)) {
  for (let c = 1; c < 27; c++) {
    const i = info(r, c);
    if (i && (i.strike || (i.rich && typeof i.rich === 'string' && i.rich.includes('<r>')))) {
      console.log(`${code} ${i.addr}: v=${JSON.stringify(i.v)} w=${i.w} bg=${i.bg} strike=${i.strike}`);
      if (i.rich) console.log('   rich=' + i.rich.slice(0, 300));
    }
  }
}
