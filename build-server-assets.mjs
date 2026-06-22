// ============================================================
// build-server-assets.mjs
// Regenerates the Stage B (server-authoritative) client assets from the full
// district topojson, so the browser can render + guess WITHOUT shipping any
// district geometry (which would let the served mystery shape be fingerprinted).
//
// Produces:
//   states.topojson       – states layer only, arcs rebuilt (no district arcs leak)
//   district-names.json    – { state: ["01","02", …] } for the dropdown / tiles
//   /tmp/dd_adj_update.sql  – UPDATE seeding district_geometries.adj (run in Supabase)
//
// The states.topojson step shells out to mapshaper (≥ 0.6), which prunes arcs not
// referenced by the states layer — district boundaries are NOT included.
//
//   node build-server-assets.mjs
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const DIR  = path.dirname(fileURLToPath(import.meta.url));
const CORE = path.join(DIR, 'districts-core.topojson');

// 1. states.topojson — states layer only, clean arcs.
execSync(
  `mapshaper -i ${JSON.stringify(CORE)} -target states -o ${JSON.stringify(path.join(DIR, 'states.topojson'))} format=topojson`,
  { stdio: 'inherit' }
);

// 2. district-names.json + adjacency, from the district properties.
const topo  = JSON.parse(fs.readFileSync(CORE, 'utf8'));
const geoms = topo.objects.districts.geometries;
const names = {};
const adj   = {};
for (const g of geoms) {
  const p = g.properties, sd = p['state-district'], st = p.state;
  if (!st || st === 'DC') continue;
  (names[st] ||= []).push(sd.slice(st.length + 1));
  adj[sd] = (p.adj || '').split('|').filter(Boolean);
}
for (const k of Object.keys(names)) names[k].sort();
fs.writeFileSync(path.join(DIR, 'district-names.json'), JSON.stringify(names));

// 3. SQL to (re)seed district_geometries.adj — run against Supabase when shapes change.
const rows = Object.entries(adj).map(
  ([k, v]) => `('${k}','${JSON.stringify(v)}'::jsonb)`
);
const sql =
  `alter table public.district_geometries add column if not exists adj jsonb;\n` +
  `update public.district_geometries dg set adj = v.adj from (values\n` +
  rows.join(',\n') +
  `\n) as v(district_id, adj) where dg.district_id = v.district_id;\n`;
fs.writeFileSync('/tmp/dd_adj_update.sql', sql);

console.error(
  `Wrote states.topojson, district-names.json (${Object.keys(names).length} states), ` +
  `/tmp/dd_adj_update.sql (${rows.length} districts).`
);
