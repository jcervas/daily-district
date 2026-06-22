// ============================================================
// build-puzzle-order.mjs
// Writes puzzle-order.json — the district order for ONE cycle of the schedule
// (default cycle 0), purely for inspection. The live schedule is computed on the
// fly by puzzle-schedule.mjs (each 435-day cycle is its own permutation), so this
// file is documentation, not the source of truth — seed-puzzles.mjs does not read it.
//
//   node build-puzzle-order.mjs [cycle]   # default cycle 0 (= the live first cycle)
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { baseIds, orderForCycle, cycleSeed } from './puzzle-schedule.mjs';

const DIR  = path.dirname(fileURLToPath(import.meta.url));
const TOPO = JSON.parse(fs.readFileSync(path.join(DIR, 'districts-core.topojson'), 'utf8'));

const cycle = parseInt(process.argv[2] || '0', 10) || 0;
const order = orderForCycle(cycle, baseIds(TOPO));

fs.writeFileSync(path.join(DIR, 'puzzle-order.json'), JSON.stringify(order));
console.error(`Wrote puzzle-order.json — cycle ${cycle} (seed 0x${cycleSeed(cycle).toString(16)}), ${order.length} districts. First 5: ${order.slice(0, 5).join(', ')}`);
