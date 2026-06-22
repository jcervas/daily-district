// ============================================================
// seed-puzzles.mjs
// Generates Supabase `puzzles` upsert SQL for a window of dates.
//
// Replicates the client's daily schedule (seededIndex/dateSeed over the
// districts.topojson order) and the FACT_DEFS clue text EXACTLY, by extracting
// the real STATE_* maps and helpers from script.js so they never drift.
//
//   node seed-puzzles.mjs [startDate] [days]  > puzzles.sql
//   defaults: startDate = today (UTC), days = 63 (yesterday .. +61)
//
// Then run puzzles.sql against the daily-district Supabase project.
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = fs.readFileSync(path.join(DIR, 'script.js'), 'utf8');
const TOPO = JSON.parse(fs.readFileSync(path.join(DIR, 'districts-core.topojson'), 'utf8'));
const STATE_ACS = path.resolve(DIR, '../../../createMaps/acs_by_state.csv');

// ── Extract a `const NAME = { ... };` object literal from script.js and eval it ─
function extractObject(name) {
  const start = SCRIPT.indexOf(`const ${name} = {`);
  if (start < 0) throw new Error(`${name} not found in script.js`);
  let i = SCRIPT.indexOf('{', start), depth = 0, end = -1;
  for (let j = i; j < SCRIPT.length; j++) {
    if (SCRIPT[j] === '{') depth++;
    else if (SCRIPT[j] === '}') { depth--; if (depth === 0) { end = j; break; } }
  }
  return eval('(' + SCRIPT.slice(i, end + 1) + ')');
}

const STATE_TIMEZONES = extractObject('STATE_TIMEZONES');
const STATE_NAMES     = extractObject('STATE_NAMES');
const STATE_ADJACENCY = extractObject('STATE_ADJACENCY');

// ── Helpers copied verbatim from script.js (pure; uint32 hash matches in Node) ─
function seededIndex(seed, max) {
  let s = (seed ^ 0xdeadbeef) >>> 0;
  s = Math.imul(s ^ (s >>> 15), s | 1);
  s ^= s + Math.imul(s ^ (s >>> 7), s | 61);
  return Math.abs((s ^ (s >>> 14)) >>> 0) % max;
}
const formatNumber   = n => parseInt(n, 10).toLocaleString('en-US');
const formatCurrency = n => '$' + parseInt(n, 10).toLocaleString('en-US');

// ── Load district properties (topojson geometry order == client districts order) ─
const districts = TOPO.objects.districts.geometries.map(g => g.properties);

// stateDistrictMap: state -> list of district numbers (for delegation-size clue)
const stateDistrictMap = {};
for (const p of districts) {
  (stateDistrictMap[p.state] ||= []).push(p['state-district']);
}

// ── State ACS facts ────────────────────────────────────────────────────────────
const acs = {};
{
  const lines = fs.readFileSync(STATE_ACS, 'utf8').trim().split('\n');
  const hdr = lines[0].split(',');
  for (const line of lines.slice(1)) {
    const cells = line.split(',');
    const row = Object.fromEntries(hdr.map((h, i) => [h, cells[i]]));
    acs[row.state] = {
      landAreaSqMi: +row.landAreaSqMi, foreignBorn_pct: +row.foreignBorn_pct,
      medianRent: +row.medianRent, meanTravelTime: +row.meanTravelTime,
      bachPlus_pct: +row.bachPlus_pct,
    };
  }
}

// ── Clue builders — mirror FACT_DEFS in script.js (order + text must match) ─────
function buildClues(p) {
  const state = p.state;
  const s = acs[state];
  const out = [];
  const add = (icon, label, value) => out.push({ icon, label, value });

  // State delegation size
  {
    const count = stateDistrictMap[state]?.length || 1;
    add('building', 'State delegation size', count === 1
      ? 'At-large: only congressional district in its state'
      : `One of ${count} congressional districts in its state`);
  }
  // Time zone
  add('clock', 'Time zone', STATE_TIMEZONES[state] ? `${STATE_TIMEZONES[state]} Time` : '—');

  // State land area
  if (s) {
    const mi = s.landAreaSqMi;
    const band = mi < 10000 ? 'Small state' : mi < 50000 ? 'Mid-size state'
               : mi < 100000 ? 'Large state' : 'Very large state';
    add('ruler', 'State land area', `${band} — ~${mi.toLocaleString('en-US')} sq mi`);
    add('people', 'Foreign-born residents (state)', `${s.foreignBorn_pct}% born outside the U.S.`);
    add('dollar', 'Median gross rent (state)', `${formatCurrency(s.medianRent)}/mo`);
    add('clock', 'Average commute (state)', `${s.meanTravelTime} min to work`);
    add('building', 'College-educated (state)', `${s.bachPlus_pct}% hold a bachelor's degree or higher`);
  }

  // District size
  {
    const a = Math.round(p.area_sqmi || 0);
    add('ruler', 'District size',
      a < 300 ? 'Very compact — under 300 sq mi'
      : a < 2000 ? `Small: ~${a.toLocaleString('en-US')} sq mi`
      : a < 15000 ? `Mid-size: ~${a.toLocaleString('en-US')} sq mi`
      : `Large: ~${a.toLocaleString('en-US')} sq mi`);
  }
  // 2024 Presidential vote
  {
    const margin = p.Margin2024Pres;
    if (margin == null || isNaN(+margin)) add('flag', '2024 Presidential vote', 'No data');
    else {
      const pctDem = Math.round((p.DemPct2024Pres || 0) * 100);
      const pctRep = Math.round((p.RepPct2024Pres || 0) * 100);
      const absMar = Math.abs(+margin * 100).toFixed(1);
      const m = +margin;
      const tag = m > 0.30 ? 'Strongly Democratic' : m > 0.10 ? 'Likely Democratic'
                : m > 0.05 ? 'Leans Democratic' : m < -0.30 ? 'Strongly Republican'
                : m < -0.10 ? 'Likely Republican' : m < -0.05 ? 'Leans Republican' : 'Competitive';
      const side = m > 0 ? `D+${absMar}%` : m < 0 ? `R+${absMar}%` : 'Even';
      add('flag', '2024 Presidential vote', `${tag} — ${side} (${pctDem}D / ${pctRep}R)`);
    }
  }
  // Median household income
  add('dollar', 'Median household income',
    parseInt(p.income, 10) > 0 ? formatCurrency(p.income) + '/yr' : 'N/A');

  // Largest racial/ethnic group (plurality)
  {
    const total = parseInt(p.pop, 10);
    const groups = [
      { name: 'White', val: parseInt(p.whiteNH, 10) },
      { name: 'Black', val: parseInt(p.black, 10) },
      { name: 'Hispanic', val: parseInt(p.hispanic, 10) },
      { name: 'Asian', val: parseInt(p.asian, 10) },
    ].filter(g => g.val > 0 && !isNaN(g.val)).sort((a, b) => b.val - a.val);
    add('people', 'Largest racial/ethnic group',
      (total && groups.length) ? `${Math.round(groups[0].val / total * 100)}% ${groups[0].name} plurality` : 'N/A');
  }
  // State (name) — most revealing, last
  add('mappin', 'State', STATE_NAMES[state] || state);

  return out;
}

// ── Schedule math ───────────────────────────────────────────────────────────────
const EPOCH_UTC = Date.UTC(2026, 5, 22);
function puzzleNumber(y, m, d) {
  return Math.floor((Date.UTC(y, m - 1, d) - EPOCH_UTC) / 86400000) + 1;
}
function dateSeed(y, m, d) { return y * 10000 + m * 100 + d; }

// ── Emit upsert SQL for the window ───────────────────────────────────────────────
const argStart = process.argv[2];
const days = parseInt(process.argv[3] || '63', 10);
const start = argStart ? new Date(argStart + 'T00:00:00Z') : new Date();
start.setUTCDate(start.getUTCDate() - 1); // include yesterday for tz spread

const sqlEsc = s => s.replace(/'/g, "''");
const rows = [];
for (let i = 0; i < days; i++) {
  const dt = new Date(start);
  dt.setUTCDate(start.getUTCDate() + i);
  const y = dt.getUTCFullYear(), m = dt.getUTCMonth() + 1, d = dt.getUTCDate();
  const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const idx = seededIndex(dateSeed(y, m, d), districts.length);
  const p = districts[idx];
  const clues = buildClues(p);
  const neighbors = (p.adj || '').split('|').filter(Boolean);
  const stateNeighbors = STATE_ADJACENCY[p.state] || [];
  rows.push(`(` +
    `'${dateStr}', ${puzzleNumber(y, m, d)}, '${sqlEsc(p['state-district'])}', '${sqlEsc(p.state)}', ` +
    `'${sqlEsc(JSON.stringify(neighbors))}'::jsonb, ` +
    `'${sqlEsc(JSON.stringify(stateNeighbors))}'::jsonb, ` +
    `'${sqlEsc(JSON.stringify(clues))}'::jsonb)`);
}

process.stdout.write(
  `insert into public.puzzles (date, puzzle_number, district_id, state, neighbors, state_neighbors, clues) values\n` +
  rows.join(',\n') +
  `\non conflict (date) do update set\n` +
  `  puzzle_number = excluded.puzzle_number, district_id = excluded.district_id, state = excluded.state,\n` +
  `  neighbors = excluded.neighbors, state_neighbors = excluded.state_neighbors, clues = excluded.clues;\n`
);
process.stderr.write(`Generated ${rows.length} puzzle rows (${rows[0] ? '' : 'none'})\n`);
