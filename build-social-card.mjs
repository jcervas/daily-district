// ============================================================
// build-social-card.mjs
// Assembles a self-contained static "district recap" social card from
// social/card.template.html for ANY district — the district silhouette, its
// id, and a 2×2 grid of profile stat cards (Representative, 2024 Pres. Vote,
// Demographics, Area), over the promo's warm-bloom background with the
// reusable floating-tile decor and a frozen confetti burst.
//
// Everything district-specific is generated from the same data the game uses
// (districts-core.topojson + data/reps_out.json), so any day resolves without
// baked art.
//
// Usage:
//   node build-social-card.mjs                     # YESTERDAY's puzzle district
//   node build-social-card.mjs --date=2026-07-09   # the puzzle for a date
//   node build-social-card.mjs --district=WV-01    # a specific district
//   node build-social-card.mjs --aspect=1x1        # 1x1 (default) | 9x16
//   node build-social-card.mjs --badge="Today's District"
//   node build-social-card.mjs --png               # also render a PNG (headless Chrome)
//
// Inputs:  districts-core.topojson, data/reps_out.json, wordmark.svg,
//          social/fonts/Barlow-*.ttf, social/card.template.html
// Output:  social/card/<district>-card[-<aspect>].html  (+ .png with --png)
// ============================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { geoAlbersUsa, geoPath, geoArea } from 'd3-geo';
import * as topojson from 'topojson-client';
import { baseIds, districtIdForPuzzle, puzzleNumberFor } from './puzzle-schedule.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const read = f => fs.readFileSync(path.join(DIR, f), 'utf8');
const arg = k => (process.argv.find(a => a.startsWith(`--${k}=`)) || '').split('=')[1];
const flag = k => process.argv.includes(`--${k}`);

// ── Aspect ──────────────────────────────────────────────────────────────────
const ASPECTS = { '1x1': [1080, 1080], '9x16': [1080, 1920] };
const ASPECT = ASPECTS[arg('aspect')] ? arg('aspect') : '1x1';
const [STAGE_W, STAGE_H] = ASPECTS[ASPECT];

const commas = n => Number(n).toLocaleString('en-US');
const round = (s, p = 1) => s.replace(/-?\d+\.?\d*/g, n => {
  const v = Math.round(parseFloat(n) * 10 ** p) / 10 ** p; return v.toString();
});

// ── Reference data ──────────────────────────────────────────────────────────
const STATE_NAMES = { AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming' };

// ── Date / district resolution (puzzleNumberFor + epoch live in puzzle-schedule.mjs)
function easternDate(offsetDays = 0) {
  const now = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
}

// "1st", "2nd", "At-Large" (when the state has a single district).
function ordinal(n, stateCount) {
  if (stateCount === 1) return 'At-Large';
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// ── Silhouette (largest polygon), fit to a box ──────────────────────────────
function fitFeatureOf(feature) {
  const g = feature.geometry;
  if (g && g.type === 'MultiPolygon') {
    const largest = g.coordinates.reduce((best, poly) => {
      const a = geoArea({ type:'Feature', geometry:{ type:'Polygon', coordinates:poly } });
      const b = geoArea({ type:'Feature', geometry:{ type:'Polygon', coordinates:best } });
      return a > b ? poly : best;
    });
    return { type:'Feature', geometry:{ type:'Polygon', coordinates:largest } };
  }
  return feature;
}

// ── Resolve district ────────────────────────────────────────────────────────
const core = JSON.parse(read('districts-core.topojson'));
const coreFeat = topojson.feature(core, core.objects.districts).features;

let DIST_ID, BADGE = arg('badge');
if (arg('district')) {
  const [st, dn] = arg('district').toUpperCase().split('-');
  DIST_ID = `${st}-${String(dn).padStart(2, '0')}`;
  if (BADGE === undefined) BADGE = 'Daily District';
} else {
  const date = arg('date') || easternDate(-1); // default: yesterday (Eastern)
  const num = puzzleNumberFor(date);
  if (num < 1) throw new Error(`Puzzle for ${date} (No. ${num}) is before launch (2026-06-22)`);
  DIST_ID = districtIdForPuzzle(num, baseIds(core));
  if (BADGE === undefined) BADGE = arg('date') ? 'Daily District' : "Yesterday's District";
  console.log(`${date} → puzzle No. ${num} → ${DIST_ID}`);
}

const dFeat = coreFeat.find(f => f.properties['state-district'] === DIST_ID);
if (!dFeat) throw new Error(`No geometry for ${DIST_ID}`);
const P = dFeat.properties;
const ST = P.state;
const DNUM = parseInt(DIST_ID.split('-')[1], 10);
const stateCount = coreFeat.filter(f => f.properties.state === ST).length;

const reps = JSON.parse(read('data/reps_out.json'));
const rep = reps[DIST_ID] || { name: '—', party: '' };

// ── Silhouette path ─────────────────────────────────────────────────────────
const SIL_BOX = 560, silPad = 20, SIL_DISP = ASPECT === '9x16' ? 340 : 300;
const silProj = geoAlbersUsa().fitExtent([[silPad, silPad], [SIL_BOX - silPad, SIL_BOX - silPad]], fitFeatureOf(dFeat));
const SIL_PATH = round(geoPath(silProj)(dFeat), 1);

// ── Derived card copy ───────────────────────────────────────────────────────
const isD = P.Margin2024Pres > 0;
const marginPct = Math.abs(P.Margin2024Pres * 100).toFixed(1);
const LEAN = `${isD ? 'D' : 'R'}+${marginPct}%`;
const LEAN_COLOR = isD ? '#2f6fd0' : '#C41230';
const demP = Math.round(P.DemPct2024Pres * 100), repP = Math.round(P.RepPct2024Pres * 100);
const VOTE_SPLIT = `${demP}D / ${repP}R`;

const groups = [['White', P.WhitePct], ['Hispanic', P.HispanicPct], ['Black', P.BlackPct], ['Asian', P.AsianPct]]
  .map(([k, v]) => [k, Math.round(v * 100)]).sort((a, b) => b[1] - a[1]);
const DEMO_TOP = `${groups[0][1]}% ${groups[0][0]}`;
const DEMO_SUB = `${groups[1][1]}% ${groups[1][0]} · ${groups[2][1]}% ${groups[2][0]}`;

const PLACE = `${STATE_NAMES[ST] || ST}'s ${ordinal(DNUM, stateCount)} District`;

// ── Stat cards ──────────────────────────────────────────────────────────────
// Two card sets: "profile" (district facts) and "play" (yesterday's gameplay).
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const statCard = (lab, val, sub2, color) =>
  `<div class="stat"><div class="lab">${esc(lab)}</div>`
  + `<div class="val"${color ? ` style="color:${color}"` : ''}>${esc(val)}</div>`
  + `<div class="sub2">${esc(sub2)}</div></div>`;

const MODE = ['profile', 'play'].includes(arg('mode')) ? arg('mode') : 'profile';
let STAT_CARDS, STATS_MOD = '';

if (MODE === 'play') {
  STATS_MOD = 'three';
  // No live gameplay data is recorded yet (backend in legacy client-only mode),
  // so these come from flags; placeholders make the design previewable.
  const players = arg('players') ?? '—';
  const guesses = arg('guesses') ?? '—';
  const time    = arg('time')    ?? '—';
  STAT_CARDS = [
    statCard('Players', players, 'played yesterday'),
    statCard('Avg. Guesses', guesses, 'to the district'),
    statCard('Avg. Time', time, 'to solve'),
  ].join('');
} else {
  STAT_CARDS = [
    statCard('Representative', rep.name, rep.party),
    statCard('2024 Pres. Vote', LEAN, VOTE_SPLIT, LEAN_COLOR),
    statCard('Demographics', DEMO_TOP, DEMO_SUB),
    statCard('District Area', commas(P.area_sqmi), `sq mi · ${commas(P.perimeter_mi)} mi perim.`),
  ].join('');
}

// ── Fonts → @font-face base64 ───────────────────────────────────────────────
const FONT_WEIGHTS = { SemiBold:600, Bold:700, ExtraBold:800, Black:900 };
const fontsCss = Object.entries(FONT_WEIGHTS).map(([name, weight]) => {
  const b64 = fs.readFileSync(path.join(DIR, 'social', 'fonts', `Barlow-${name}.ttf`)).toString('base64');
  return `@font-face{font-family:'Barlow';font-weight:${weight};font-style:normal;font-display:block;`
       + `src:url(data:font/ttf;base64,${b64}) format('truetype');}`;
}).join('\n');

const wordmarkInner = read('wordmark.svg')
  .replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>[\s\S]*$/, '').trim();

// ── Assemble ────────────────────────────────────────────────────────────────
const repl = {
  WORDMARK: wordmarkInner,
  STAGE_W: String(STAGE_W), STAGE_H: String(STAGE_H), ASPECT,
  SIL_BOX: String(SIL_BOX), SIL_DISP: String(SIL_DISP), SIL_PATH,
  DIST_ID, PLACE, BADGE,
  STAT_CARDS, STATS_MOD,
};
let html = read('social/card.template.html').replace('/*{{FONTS_CSS}}*/', fontsCss);
for (const [k, v] of Object.entries(repl)) html = html.replaceAll(`{{${k}}}`, v);

const outDir = path.join(DIR, 'social', 'card');
fs.mkdirSync(outDir, { recursive: true });
const modeTag = MODE === 'play' ? '-stats' : '';
const suffix = ASPECT === '1x1' ? '' : `-${ASPECT}`;
const outHtml = path.join(outDir, `${DIST_ID}-card${modeTag}${suffix}.html`);
fs.writeFileSync(outHtml, html);

const leftover = html.match(/\{\{[A-Z_]+\}\}/g);
console.log(`social/card/${path.basename(outHtml)} written for ${DIST_ID} @ ${STAGE_W}×${STAGE_H} (${(html.length / 1024).toFixed(0)} KB)`);
if (leftover) console.warn('  ⚠ unreplaced placeholders:', [...new Set(leftover)].join(', '));

// ── Optional PNG via Chrome's built-in headless screenshot (no extra deps) ──
// Renders the full window at 2× (the card fills the frame in #shot/clean mode).
if (flag('png')) {
  const { spawnSync } = await import('node:child_process');
  // CHROME_BIN overrides; otherwise the macOS app bundle locally, or PATH lookup
  // (google-chrome) on Linux — GitHub's ubuntu runners ship Chrome that way.
  const CHROME = process.env.CHROME_BIN
    || (process.platform === 'darwin'
      ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
      : 'google-chrome');
  const outPng = outHtml.replace(/\.html$/, '.png');
  const r = spawnSync(CHROME, [
    '--headless=new', `--screenshot=${outPng}`,
    `--window-size=${STAGE_W},${STAGE_H}`, '--force-device-scale-factor=2',
    '--hide-scrollbars', '--force-color-profile=srgb', '--no-sandbox',
    '--virtual-time-budget=1500',
    'file://' + outHtml + '#shot',
  ], { stdio: ['ignore', 'ignore', 'inherit'] });
  if (r.status !== 0 || !fs.existsSync(outPng)) { console.error('Chrome screenshot failed'); process.exit(1); }
  console.log(`social/card/${path.basename(outPng)} rendered @ ${STAGE_W * 2}×${STAGE_H * 2} (${(fs.statSync(outPng).size / 1024).toFixed(0)} KB)`);
}
