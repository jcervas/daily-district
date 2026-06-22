// ============================================================
// seed-puzzles.mjs
// Generates Supabase `puzzles` upsert SQL for a window of dates.
//
// Schedule: a fixed shuffled permutation of all 435 districts (puzzle-order.json,
// built by build-puzzle-order.mjs). Puzzle No. N = order[(N-1) % 435], so every
// district appears exactly once before any repeat. Clue text / census mirror the
// FACT_DEFS in script.js EXACTLY, by extracting the real STATE_* maps + props so
// they never drift.
//
//   node seed-puzzles.mjs [startDate] [days]  > puzzles.sql
//   defaults: startDate = today (UTC), days = 63 (yesterday .. +61)
//   For a full non-repeating cycle: node seed-puzzles.mjs 2026-06-22 436
//
// Then run puzzles.sql against the daily-district Supabase project.
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { baseIds, districtIdForPuzzle } from './puzzle-schedule.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = fs.readFileSync(path.join(DIR, 'script.js'), 'utf8');
const TOPO = JSON.parse(fs.readFileSync(path.join(DIR, 'districts-core.topojson'), 'utf8'));
const STATE_ACS = path.resolve(DIR, '../createMaps/acs_by_state.csv');

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

const formatNumber   = n => parseInt(n, 10).toLocaleString('en-US');
const formatCurrency = n => '$' + parseInt(n, 10).toLocaleString('en-US');

// ── Load district properties (topojson geometry order == client districts order) ─
const districts = TOPO.objects.districts.geometries.map(g => g.properties);

// stateDistrictMap: state -> list of district numbers (for delegation-size clue)
const stateDistrictMap = {};
for (const p of districts) {
  (stateDistrictMap[p.state] ||= []).push(p['state-district']);
}

// Puzzle schedule (puzzle-schedule.mjs): endless run of 435-day cycles, each its
// own shuffled permutation, so every district appears once per cycle and no two
// cycles share an order. district id for puzzle No. N = districtIdForPuzzle(N, ids).
const SCHED_IDS = baseIds(TOPO);
const byId = {};
for (const p of districts) byId[p['state-district']] = p;

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

// Per-district census snapshot (pre-aggregated to 2026 boundaries via BAF, read
// straight from the topojson props). Served by the today/guess functions at
// game-over to drive the result census panel without a (boundary-mismatched) API call.
function buildCensus(p) {
  const num = v => (v != null ? Number(v) : null);
  return {
    pop: num(p.pop), income: num(p.income), whiteNH: num(p.whiteNH),
    black: num(p.black), asian: num(p.asian), hispanic: num(p.hispanic),
    medianHome: num(p.medianHome), bach: num(p.bach), master: num(p.master),
  };
}

// ── Schedule math ───────────────────────────────────────────────────────────────
const EPOCH_UTC = Date.UTC(2026, 5, 22);
function puzzleNumber(y, m, d) {
  return Math.floor((Date.UTC(y, m - 1, d) - EPOCH_UTC) / 86400000) + 1;
}

// ── Emit upsert SQL for the window ───────────────────────────────────────────────
const argStart = process.argv[2];
const days = parseInt(process.argv[3] || '63', 10);
const start = argStart ? new Date(argStart + 'T00:00:00Z') : new Date();
start.setUTCDate(start.getUTCDate() - 1); // include yesterday for tz spread

const records = [];
for (let i = 0; i < days; i++) {
  const dt = new Date(start);
  dt.setUTCDate(start.getUTCDate() + i);
  const y = dt.getUTCFullYear(), m = dt.getUTCMonth() + 1, d = dt.getUTCDate();
  const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const num = puzzleNumber(y, m, d);
  const p = byId[districtIdForPuzzle(num, SCHED_IDS)];
  records.push({
    date: dateStr,
    puzzle_number: num,
    district_id: p['state-district'],
    state: p.state,
    neighbors: (p.adj || '').split('|').filter(Boolean),
    state_neighbors: STATE_ADJACENCY[p.state] || [],
    clues: buildClues(p),
    census: buildCensus(p),
  });
}

// --json → JSON array (for POST to the load-puzzles function); else upsert SQL.
if (process.argv.includes('--json')) {
  process.stdout.write(JSON.stringify(records));
} else {
  const sqlEsc = s => s.replace(/'/g, "''");
  const rows = records.map(r =>
    `('${r.date}', ${r.puzzle_number}, '${sqlEsc(r.district_id)}', '${sqlEsc(r.state)}', ` +
    `'${sqlEsc(JSON.stringify(r.neighbors))}'::jsonb, '${sqlEsc(JSON.stringify(r.state_neighbors))}'::jsonb, ` +
    `'${sqlEsc(JSON.stringify(r.clues))}'::jsonb, '${sqlEsc(JSON.stringify(r.census))}'::jsonb)`);
  process.stdout.write(
    `insert into public.puzzles (date, puzzle_number, district_id, state, neighbors, state_neighbors, clues, census) values\n` +
    rows.join(',\n') +
    `\non conflict (date) do update set\n` +
    `  puzzle_number = excluded.puzzle_number, district_id = excluded.district_id, state = excluded.state,\n` +
    `  neighbors = excluded.neighbors, state_neighbors = excluded.state_neighbors, clues = excluded.clues,\n` +
    `  census = excluded.census;\n`
  );
}
process.stderr.write(`Generated ${records.length} puzzle rows\n`);
