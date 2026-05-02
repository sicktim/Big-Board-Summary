#!/usr/bin/env node
// Apply format normalization + approved fixes to all V2 phase JSON files.
//   1. SO phase → applicability = ["STC"] everywhere
//   2. SY nameTag strings → arrays
//   3. Remove nested applicabilityDetail from SY prereqs (migrate to nameTagRole / nameTagAircraft)
//   4. Drop invented event role values (non-pilot, execute-primary, mission-support, non-rated-aircrew, wso-msf)
//   5. TF 6430B → rename event to TF 6430A (type suffix A, Academic Lecture)
//   6. TF 5320A prereq "TF 5310Y" → "TF 5311Y" (MCG typo fix)
//   7. FQ 7221I eventTypeName → "Ground Test"
//   8. DE = Disciplined Engineer note on FQ 6252C / FQ 9247C / SY 7213C
//   9. Canonicalize every event's top-level keys
//  10. Canonicalize every prereq's keys (code, name, nameTag, nameTagRole, nameTagAircraft, condition, group)
//  11. Canonicalize applicabilityDetail and seriesInfo shapes

const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const PHASES = ['AN','AS','CF','FQ','PF','SO','SY','TF','TL'];

const DROP_ROLES = new Set(['non-pilot','execute-primary','mission-support','non-rated-aircrew','wso-msf']);

const SY_TAG_MAP = {
  '(ABM/CSO/FTE/RPA)': { nameTag: ['ABM','CSO','FTE','RPA'], nameTagRole: null },
  '(FTC)':             { nameTag: ['ABM','CSO','FTE','P','RPA'], nameTagRole: null },
  '(FTC, US Only)':    { nameTag: ['ABM','CSO','FTE','P','RPA'], nameTagRole: null },
  '(P, crew solo)':    { nameTag: ['P'], nameTagRole: 'crew-solo' },
  '(P, non-crew solo)':{ nameTag: ['P'], nameTagRole: 'non-crew-solo' },
  '(STC)':             { nameTag: ['STC'], nameTagRole: null },
};

function inferAircraft(prereqName) {
  if (/F-16/.test(prereqName)) return 'F-16';
  if (/C-12/.test(prereqName)) return 'C-12';
  if (/T-38/.test(prereqName)) return 'T-38';
  if (/Learjet|LJ-25/.test(prereqName)) return 'Learjet';
  return null;
}

function canonicalPrereq(pr, phaseHint) {
  let { code, name, nameTag, nameTagRole, nameTagAircraft, condition, group, applicabilityDetail, ...rest } = pr;
  // String-form nameTag (SY legacy) → array via table
  if (typeof nameTag === 'string') {
    const m = SY_TAG_MAP[nameTag];
    if (m) {
      nameTag = m.nameTag;
      if (!nameTagRole && m.nameTagRole) nameTagRole = m.nameTagRole;
    } else {
      // Unknown string pattern — keep as name text, clear nameTag
      console.warn('  [warn] unknown string nameTag:', JSON.stringify(nameTag), 'on prereq', code);
      nameTag = null;
    }
  }
  // Migrate nested applicabilityDetail (SY crew-solo prereqs) → nameTagRole/nameTagAircraft
  if (applicabilityDetail) {
    if (!nameTagRole) nameTagRole = applicabilityDetail.role || null;
    if (!nameTagAircraft) nameTagAircraft = applicabilityDetail.aircraft || null;
  }
  // Infer aircraft if role implies one and aircraft missing
  if ((nameTagRole === 'crew-solo' || nameTagRole === 'non-crew-solo') && !nameTagAircraft) {
    nameTagAircraft = inferAircraft(name || '') || null;
  }
  return {
    code: code || null,
    name: name || '',
    nameTag: nameTag !== undefined ? nameTag : null,
    nameTagRole: nameTagRole || null,
    nameTagAircraft: nameTagAircraft || null,
    condition: condition || null,
    group: group || null,
  };
}

function canonicalApplicabilityDetail(ad) {
  ad = ad || {};
  let role = ad.role || null;
  if (role && DROP_ROLES.has(role)) role = null;
  return {
    role,
    aircraft: ad.aircraft || null,
    standardMapping: Array.isArray(ad.standardMapping) ? ad.standardMapping : [],
    description: ad.description || '',
  };
}

function canonicalSeriesInfo(si) {
  si = si || { inSeries: false };
  return {
    inSeries: !!si.inSeries,
    seriesId: si.seriesId || null,
    seriesPosition: (si.seriesPosition !== undefined ? si.seriesPosition : null),
    seriesLength: (si.seriesLength !== undefined ? si.seriesLength : null),
  };
}

function canonicalEvent(ev, phase) {
  return {
    code: ev.code,
    eventName: ev.eventName || '',
    eventType: ev.eventType || '',
    eventTypeName: ev.eventTypeName || '',
    phase: ev.phase || phase,
    moduleCode: ev.moduleCode || null,
    moduleName: ev.moduleName || null,
    parentCourse: ev.parentCourse || null,
    applicability: Array.isArray(ev.applicability) ? ev.applicability : [],
    applicabilityDetail: canonicalApplicabilityDetail(ev.applicabilityDetail),
    eventNotes: ev.eventNotes || '',
    seriesInfo: canonicalSeriesInfo(ev.seriesInfo),
    description: ev.description || '',
    prerequisites: (ev.prerequisites || []).map(p => canonicalPrereq(p, phase)),
  };
}

function appendNote(ev, extra) {
  const existing = ev.eventNotes || '';
  if (existing.includes(extra.trim())) return ev;
  ev.eventNotes = existing ? existing + ' ' + extra : extra;
  return ev;
}

// ============= per-phase transforms =============

function fixSO(data) {
  for (const code of Object.keys(data.events)) {
    const ev = data.events[code];
    ev.applicability = ['STC'];
    ev.applicabilityDetail.role = ev.applicabilityDetail.role || null;
    ev.applicabilityDetail.standardMapping = ['STC'];
    ev.applicabilityDetail.description = ev.applicabilityDetail.description
      ? ev.applicabilityDetail.description.replace(/^All students[^.]*\.?/i, '').trim() || 'STC only'
      : 'STC only';
    // Prefix STC scope note if not already there
    if (!/STC only/i.test(ev.applicabilityDetail.description)) {
      ev.applicabilityDetail.description = 'STC only — ' + ev.applicabilityDetail.description;
    }
  }
}

function fixTF(data) {
  // Rename TF 6430B → TF 6430A
  if (data.events['TF 6430B'] && !data.events['TF 6430A']) {
    const ev = data.events['TF 6430B'];
    ev.code = 'TF 6430A';
    ev.eventType = 'A';
    ev.eventTypeName = 'Academic Lecture';
    appendNote(ev, 'MCG source declared this event as TF 6430B (Async Content type B); corrected to TF 6430A (Academic Lecture type A) per user ruling to match the 6 downstream prereq citations.');
    data.events['TF 6430A'] = ev;
    delete data.events['TF 6430B'];
  }
  // Fix TF 5320A prereq typo: TF 5310Y → TF 5311Y
  const tf5320a = data.events['TF 5320A'];
  if (tf5320a) {
    for (const pr of tf5320a.prerequisites) {
      if (pr.code === 'TF 5310Y') {
        pr.code = 'TF 5311Y';
        pr.name = pr.name.replace(/^TF 5310Y\s*/,'').replace(/^Test Policy Oral Report/, 'Test Policy Oral Report');
        // Preserve the full original name without the 5310Y prefix
        appendNote(tf5320a, 'Prereq citation "TF 5310Y Test Policy Oral Report (STC)" corrected to "TF 5311Y" per user ruling (MCG source typo; 5310/5311 sequence confirmed by adjacent events).');
      }
    }
  }
}

function fixFQ(data) {
  // FQ 7221I — eventTypeName to "Ground Test"
  if (data.events['FQ 7221I']) {
    data.events['FQ 7221I'].eventTypeName = 'Ground Test';
  }
  // DE = Disciplined Engineer note on FQ 6252C, FQ 9247C
  for (const code of ['FQ 6252C','FQ 9247C']) {
    if (data.events[code]) {
      appendNote(data.events[code], 'DE = Disciplined Engineer (control-room role per MCG p.87 prose). CSO/P/RPA students may fill the DE role in the CR; primary applicability remains ABM/FTE.');
    }
  }
}

function fixSY(data) {
  // DE note on SY 7213C
  if (data.events['SY 7213C']) {
    appendNote(data.events['SY 7213C'], 'DE = Disciplined Engineer (control-room role). STC "as DE" means STC students serving in the Disciplined Engineer role; narrows STC applicability to those assigned to the DE role for this event.');
  }
  // Normalize SY 7504Y applicability tag formatting in name if needed — name already holds the raw text
  // No structural change needed; format is captured in nameTag array (handled by prereq canonicalization upstream).
}

// ============= main =============

let totalWarnings = 0;
for (const p of PHASES) {
  const fp = path.join(DIR, `phase-${p}.json`);
  const data = JSON.parse(fs.readFileSync(fp, 'utf8'));

  // Canonicalize every event
  const newEvents = {};
  for (const [code, ev] of Object.entries(data.events)) {
    newEvents[code] = canonicalEvent(ev, p);
  }
  data.events = newEvents;

  // Phase-specific fixes
  if (p === 'SO') fixSO(data);
  if (p === 'TF') fixTF(data);
  if (p === 'FQ') fixFQ(data);
  if (p === 'SY') fixSY(data);

  // Re-canonicalize (in case fixes added fields)
  const finalEvents = {};
  for (const [code, ev] of Object.entries(data.events)) {
    finalEvents[code] = canonicalEvent(ev, p);
  }
  data.events = finalEvents;

  fs.writeFileSync(fp, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`${p}: wrote ${Object.keys(data.events).length} events`);
}

console.log('\nNormalization complete.');
