// ============================================================
// build-teaser-9.mjs   ("Sudden Death" — soccer / free-kick shootout)
//
// A standalone promo built for the soccer/World-Cup moment: a ball curls in
// on a bending free-kick path each round (3D — grows as it "approaches
// camera", spins, motion-blurs, tilts away in perspective) and rips directly
// INTO a district silhouette rendered as a net (diagonal net-mesh over the
// shape) — the district itself is the goal, no separate frame graphic — with
// a net-ripple + "GOAL" flash at the point of impact, then the shape
// flubber-morphs fast into the next district and the next kick fires. A
// running shootout scoreboard (one dot per round, filling in as each kick
// scores) ties the loop structurally to Daily District's own guess-limit
// mechanic. Reuses the shared dynamic-intro scene and the shared end-card
// confetti/hold pattern verbatim from the other teasers.
// Tagline: "Sudden death, every day." at daily-district.com
//
// Usage:
//   node social/scripts/build-teaser-9.mjs                        # default line-up, 1:1
//   node social/scripts/build-teaser-9.mjs --aspect=9x16          # 1x1 (default) | 9x16 | 16x9
//   node social/scripts/build-teaser-9.mjs --districts=IL-04,MD-03,TX-35,NC-01,LA-02
//
// Output: social/teaser-9/teaser-9.html  (or teaser-9-<aspect>.html)
//         render to MP4 with render-mp4.mjs (see social/README.md)
// ============================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { geoAlbersUsa, geoPath, geoArea } from 'd3-geo';
import * as topojson from 'topojson-client';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..'); // repo root (script lives in social/scripts/)
const read = f => fs.readFileSync(path.join(DIR, f), 'utf8');
const arg = k => (process.argv.find(a => a.startsWith(`--${k}=`)) || '').split('=')[1];
const round = (s, p = 1) => s.replace(/-?\d+\.?\d*/g, n => {
  const v = Math.round(parseFloat(n) * 10 ** p) / 10 ** p; return v.toString();
});

const ASPECTS = { '16x9': [1280, 720], '9x16': [1080, 1920], '1x1': [1080, 1080] };
const ASPECT = ASPECTS[arg('aspect')] ? arg('aspect') : '1x1';
const [STAGE_W, STAGE_H] = ASPECTS[ASPECT];

const STATE_NAMES = { AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming' };

// Curated default line-up: recognizable, visually striking (irregular) shapes.
// Five, on purpose — mirrors a standard penalty-shootout round count.
const DEFAULT_IDS = ['IL-04', 'MD-03', 'TX-35', 'NC-01', 'LA-02'];
const ids = arg('districts')
  ? arg('districts').toUpperCase().split(',').map(s => { const [st, d] = s.split('-'); return `${st}-${String(d).padStart(2, '0')}`; })
  : DEFAULT_IDS;

// ── Load geometry ────────────────────────────────────────────────────────────
const core = JSON.parse(read('districts-core.topojson'));
const feats = topojson.feature(core, core.objects.districts).features;

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
const SIL_BOX = 400;
// Path + the shape's actual visual centroid (not just its bounding-box
// center) so the ball genuinely converges into the net, even for elongated/
// irregular districts like LA-02 or NC-01.
function silOf(f) {
  const ff = fitFeatureOf(f);
  const proj = geoAlbersUsa().fitExtent([[18, 18], [SIL_BOX - 18, SIL_BOX - 18]], ff);
  const gp = geoPath(proj);
  const [cx, cy] = gp.centroid(ff);
  return { path: round(gp(ff), 1), cx: +(cx / SIL_BOX * 100).toFixed(2), cy: +(cy / SIL_BOX * 100).toFixed(2) };
}

const DISTRICTS = ids.map(id => {
  const f = feats.find(x => x.properties['state-district'] === id);
  if (!f) throw new Error(`No geometry for ${id}`);
  const { path, cx, cy } = silOf(f);
  return { id, state: STATE_NAMES[f.properties.state] || f.properties.state, path, cx, cy };
});
const SIL_PATHS_JSON = JSON.stringify(DISTRICTS.map(d => d.path));
const DISTRICTS_META_JSON = JSON.stringify(DISTRICTS.map(({ id, state, cx, cy }) => ({ id, state, cx, cy })));
const SIL_PATH0 = DISTRICTS[0].path;

// ── Fonts + wordmark (shared with the other promos) ─────────────────────────
const FONT_WEIGHTS = { SemiBold:600, Bold:700, ExtraBold:800, Black:900 };
const fontsCss = Object.entries(FONT_WEIGHTS).map(([name, weight]) => {
  const b64 = fs.readFileSync(path.join(DIR,'social','fonts',`Barlow-${name}.ttf`)).toString('base64');
  return `@font-face{font-family:'Barlow';font-weight:${weight};font-style:normal;font-display:block;`
       + `src:url(data:font/ttf;base64,${b64}) format('truetype');}`;
}).join('\n');
const wordmarkInner = read('wordmark.svg').replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>[\s\S]*$/, '').trim();

// ── Assemble ─────────────────────────────────────────────────────────────────
// (Ball is a hand-drawn vector in the template — no bitmap asset to inline.)
const flubberJs = read('node_modules/flubber/build/flubber.min.js');
let html = read('social/teaser-9/teaser.template.html')
  .replace('/*{{FONTS_CSS}}*/', () => fontsCss)
  .replace('/*{{FLUBBER_JS}}*/', () => flubberJs);
const repl = {
  WORDMARK: wordmarkInner, STAGE_W: String(STAGE_W), STAGE_H: String(STAGE_H), ASPECT,
  SIL_BOX: String(SIL_BOX), SIL_PATH0, SIL_PATHS_JSON, DISTRICTS_META_JSON,
};
for (const [k, v] of Object.entries(repl)) html = html.replaceAll(`{{${k}}}`, v);

const outDir = path.join(DIR, 'social', 'teaser-9');
fs.mkdirSync(path.join(outDir, 'out'), { recursive: true });
const outName = ASPECT === '1x1' ? 'teaser-9.html' : `teaser-9-${ASPECT}.html`;
fs.writeFileSync(path.join(outDir, outName), html);
const leftover = html.match(/\{\{[A-Z_0-9]+\}\}/g);
console.log(`${outName} written @ ${STAGE_W}×${STAGE_H} — ${DISTRICTS.map(d=>d.id).join(', ')} (${(html.length/1024).toFixed(0)} KB)`);
if (leftover) console.warn('  ⚠ unreplaced placeholders:', [...new Set(leftover)].join(', '));
