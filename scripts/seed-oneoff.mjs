// ============================================================
// seed-oneoff.mjs
// Generates a Supabase `oneoff_events` upsert for ONE fixed district — the
// "special edition" one-off game where every player (signed in or anonymous)
// plays the same district. Clue text mirrors seed-puzzles.mjs EXACTLY (same
// extraction from script.js + the state ACS csv), just for an arbitrary
// district instead of the daily's date-driven schedule.
//
// `census` is NOT rebuilt here — it's pulled via a subquery from the district's
// own row in `puzzles`, which already carries the FULL enriched profile (current
// rep, redistricting year, perimeter/compactness/reock, percentile ranks, etc.)
// that the game-over "District Profile" card needs. That full shape comes from a
// separate data pipeline (data/), not from the clue-only fields this script
// computes — building a partial census object here left "Current Representative"
// / "Compactness" / "District Perimeter" etc. showing "—" the first time (every
// district appears once per 436-day cycle, so the subquery always finds a row).
//
//   node scripts/seed-oneoff.mjs <district_id> <slug> [title...]  > oneoff.sql
//   e.g. node scripts/seed-oneoff.mjs VA-02 special-1 Special Edition: VA-02
//
// Then run oneoff.sql against the daily-district Supabase project. Re-running
// with the same slug updates that event in place (upsert on slug).
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..'); // repo root (script lives in scripts/)
const SCRIPT = fs.readFileSync(path.join(DIR, 'script.js'), 'utf8');
const TOPO = JSON.parse(fs.readFileSync(path.join(DIR, 'districts-core.topojson'), 'utf8'));
const STATE_ACS = path.join(DIR, 'data/acs_by_state.csv');

// ── Extract a `const NAME = { ... };` object literal from script.js and eval it ─
// (identical to seed-puzzles.mjs, kept in sync deliberately — see that file)
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

const formatCurrency = n => '$' + parseInt(n, 10).toLocaleString('en-US');

// ── Load district properties (topojson geometry order == client districts order) ─
const districts = TOPO.objects.districts.geometries.map(g => g.properties);
const stateDistrictMap = {};
for (const p of districts) (stateDistrictMap[p.state] ||= []).push(p['state-district']);
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

// ── Clue builders (kept byte-for-byte in sync with seed-puzzles.mjs) ───────────
function buildStateClues(p) {
  const state = p.state;
  const s = acs[state];
  const out = [];
  const add = (icon, label, value) => out.push({ icon, label, value });

  if (s) {
    const mi = s.landAreaSqMi;
    const band = mi < 10000 ? 'Small state' : mi < 50000 ? 'Mid-size state'
               : mi < 100000 ? 'Large state' : 'Very large state';
    add('ruler', 'State land area', `${band} — ~${mi.toLocaleString('en-US')} sq mi`);
  }
  add('clock', 'Time zone', STATE_TIMEZONES[state] ? `${STATE_TIMEZONES[state]} Time` : '—');
  if (s) {
    add('dollar', 'Median gross rent (state)', `${formatCurrency(s.medianRent)}/mo`);
    add('clock', 'Average commute (state)', `${s.meanTravelTime} min to work`);
    add('people', 'Foreign-born residents (state)', `${s.foreignBorn_pct}% born outside the U.S.`);
  }
  {
    const count = stateDistrictMap[state]?.length || 1;
    add('building', 'State delegation size', count === 1
      ? 'At-large: only congressional district in its state'
      : `One of ${count} congressional districts in its state`);
  }
  return out.slice(0, 6);
}

function buildDistrictClues(p) {
  const out = [];
  const add = (icon, label, value) => out.push({ icon, label, value });

  {
    const a = Math.round(p.area_sqmi || 0);
    add('ruler', 'District size',
      a < 300 ? 'Very compact — under 300 sq mi'
      : a < 2000 ? `Small: ~${a.toLocaleString('en-US')} sq mi`
      : a < 15000 ? `Mid-size: ~${a.toLocaleString('en-US')} sq mi`
      : `Large: ~${a.toLocaleString('en-US')} sq mi`);
  }
  {
    const pop = parseInt(p.pop, 10);
    add('people', 'District population', pop > 0 ? `~${pop.toLocaleString('en-US')} residents` : 'N/A');
  }
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
  add('dollar', 'Median household income',
    parseInt(p.income, 10) > 0 ? formatCurrency(p.income) + '/yr' : 'N/A');
  add('dollar', 'Median home value',
    parseInt(p.medianHome, 10) > 0 ? formatCurrency(p.medianHome) : 'N/A');
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
  return out.slice(0, 6);
}

// ── CLI ─────────────────────────────────────────────────────────────────────────
const [, , districtIdArg, slugArg, ...titleParts] = process.argv;
if (!districtIdArg || !slugArg) {
  process.stderr.write('usage: node scripts/seed-oneoff.mjs <district_id> <slug> [title...]\n');
  process.exit(1);
}
const districtId = districtIdArg.toUpperCase();
const p = byId[districtId];
if (!p) { process.stderr.write(`Unknown district_id: ${districtId}\n`); process.exit(1); }
const title = titleParts.join(' ') || `Special Edition: ${districtId}`;

const record = {
  slug: slugArg,
  district_id: p['state-district'],
  state: p.state,
  title,
  clues: { state: buildStateClues(p), district: buildDistrictClues(p) },
};

const sqlEsc = s => s.replace(/'/g, "''");
process.stdout.write(
  `insert into public.oneoff_events (slug, district_id, state, title, clues, census, active) values\n` +
  `('${sqlEsc(record.slug)}', '${sqlEsc(record.district_id)}', '${sqlEsc(record.state)}', '${sqlEsc(record.title)}', ` +
  `'${sqlEsc(JSON.stringify(record.clues))}'::jsonb,\n` +
  `  (select census from public.puzzles where district_id = '${sqlEsc(record.district_id)}' order by date desc limit 1),\n` +
  `  true)\n` +
  `on conflict (slug) do update set\n` +
  `  district_id = excluded.district_id, state = excluded.state, title = excluded.title,\n` +
  `  clues = excluded.clues, census = excluded.census, active = excluded.active;\n`
);
process.stderr.write(`Generated oneoff_events row for ${record.district_id} (slug=${record.slug})\n`);
