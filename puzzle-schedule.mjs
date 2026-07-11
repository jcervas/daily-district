// ============================================================
// puzzle-schedule.mjs
// Single source of truth for the daily puzzle schedule.
//
// The schedule is an endless run of 435-day CYCLES. Each cycle is its own
// shuffled permutation of all 435 districts, so within any cycle every district
// appears exactly once, and consecutive cycles use DIFFERENT orders (cycle N+1
// does not repeat cycle N). Everything is deterministic and reproducible from the
// base seed, so any past/future puzzle number resolves without storing each cycle.
//
//   puzzle No. N (1-based, N=1 on 2026-06-22):
//     cycle = floor((N-1)/435)        order = orderForCycle(cycle, ids)
//     pos   = (N-1) mod 435           districtId = order[pos]
//
// Cycle 0 reproduces puzzle-order.json byte-for-byte (BASE_SEED), so the rows
// already seeded for the first cycle stay valid.
// ============================================================

// Base seed for cycle 0 — do not change (would reshuffle the live first cycle).
export const BASE_SEED = 0x05D15784;
export const CYCLE_LEN = 435;

// ── Launch epoch ─────────────────────────────────────────────────────────────
// Calendar date (America/New_York) of puzzle No. 1 — the SINGLE SOURCE OF TRUTH
// for every date→puzzle-number conversion (seed-puzzles, the tweet/social
// generators, daily-recap all import puzzleNumberFor below). To move the launch
// date, change this ONE line and reseed the puzzles table; the schedule itself
// (which district maps to a given puzzle number) is independent and does not shift.
export const LAUNCH_EPOCH = '2026-07-13';
const [_ey, _em, _ed] = LAUNCH_EPOCH.split('-').map(Number);
export const LAUNCH_EPOCH_UTC = Date.UTC(_ey, _em - 1, _ed);

// Is the launch date public yet? The schedule always needs a concrete epoch
// above (pencil in a provisional one), but the teaser only SHOWS a date when
// this is true. Set false while the date is undecided → build-teaser.mjs renders
// a dateless "Coming soon" page; flip to true once you've committed to LAUNCH_EPOCH.
export const LAUNCH_ANNOUNCED = true;

// Puzzle number (1-based) for a 'YYYY-MM-DD' calendar date; N = 1 on LAUNCH_EPOCH.
export function puzzleNumberFor(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Math.floor((Date.UTC(y, m - 1, d) - LAUNCH_EPOCH_UTC) / 86400000) + 1;
}

// Distinct, deterministic seed per cycle (odd golden-ratio step → no short period).
export function cycleSeed(cycle) {
  return (BASE_SEED + cycle * 0x9E3779B1) >>> 0;
}

// mulberry32 PRNG — same family as the client's seededIndex.
function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Sorted base list of district ids (DC excluded), from the districts topojson.
export function baseIds(topo) {
  return topo.objects.districts.geometries
    .map(g => g.properties['state-district'])
    .filter(id => id && !id.startsWith('DC'))
    .sort();
}

// The shuffled district order for a given cycle (Fisher–Yates over a copy of ids).
export function orderForCycle(cycle, ids) {
  const rand = mulberry32(cycleSeed(cycle));
  const order = ids.slice();
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

// district id for puzzle number N (handles N <= 0 buffer days via floor/mod wrap).
export function districtIdForPuzzle(n, ids) {
  const len = ids.length;                       // 435
  const cycle = Math.floor((n - 1) / len);
  const pos = ((n - 1) % len + len) % len;
  return orderForCycle(cycle, ids)[pos];
}
