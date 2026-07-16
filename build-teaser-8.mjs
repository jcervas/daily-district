// ============================================================
// build-teaser-8.mjs   (Teaser #8 — "Drawing the district")
//
// A standalone promo built around a single reveal: slow, kinetic comet-tail
// lines race across the screen — right-to-left, then left-to-right, then
// vertically — pure buildup, not tied to any real geometry yet. Then the
// camera pulls back while the ACTUAL district boundary draws itself in and
// fills solid, its code + state pop in, then the wordmark + CTA — this time
// with the just-drawn district's outline framing the logo — and the shared
// end-card confetti (copied verbatim from the other teasers, per
// social/README.md, to keep every ending consistent).
// Tagline: "Every district has a shape. Learn it, every day."
//
// Usage:
//   node build-teaser-8.mjs                       # default district, 1:1
//   node build-teaser-8.mjs --aspect=9x16         # 1x1 (default) | 9x16 | 16x9
//   node build-teaser-8.mjs --district=NC-01      # feature a different district
//
// Output: social/teaser-8/teaser-8.html  (or teaser-8-<aspect>.html)
//         render to MP4 with render-mp4.mjs (see social/README.md)
// ============================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { geoAlbersUsa, geoPath, geoArea } from 'd3-geo';
import * as topojson from 'topojson-client';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const read = f => fs.readFileSync(path.join(DIR, f), 'utf8');
const arg = k => (process.argv.find(a => a.startsWith(`--${k}=`)) || '').split('=')[1];
const round = (s, p = 1) => s.replace(/-?\d+\.?\d*/g, n => {
  const v = Math.round(parseFloat(n) * 10 ** p) / 10 ** p; return v.toString();
});

const ASPECTS = { '16x9': [1280, 720], '9x16': [1080, 1920], '1x1': [1080, 1080] };
const ASPECT = ASPECTS[arg('aspect')] ? arg('aspect') : '1x1';
const [STAGE_W, STAGE_H] = ASPECTS[ASPECT];

const STATE_NAMES = { AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming' };

// Default: a visually striking (irregular) shape — same one vetted for
// "irregular shape" in build-teaser-6.mjs's DEFAULT_IDS — so the reveal reads
// clearly as a distinctive, recognizable district.
const id = (arg('district') || 'MD-03').toUpperCase().replace(/^([A-Z]{2})-?(\d+)$/, (_, st, d) => `${st}-${d.padStart(2, '0')}`);

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
const feat = feats.find(x => x.properties['state-district'] === id);
if (!feat) throw new Error(`No geometry for ${id}`);
const ff = fitFeatureOf(feat);
const STATE = STATE_NAMES[feat.properties.state] || feat.properties.state;

// ── The "draw" scene's trace geometry — fit to the district's OWN natural
// aspect ratio (not squeezed into a square) so it fills its box completely,
// then sized/rotated per output aspect so the reveal uses as much of the
// stage as possible. A district that's naturally wider than tall, shown in
// the tall 9x16 aspect, gets rotated 90° so its long axis runs down the
// frame instead of being squeezed into the narrow width. ────────────────────
const prelimProj = geoAlbersUsa().fitExtent([[0, 0], [1000, 1000]], ff);
const [[bx0, by0], [bx1, by1]] = geoPath(prelimProj).bounds(ff);
const shapeAspect = (bx1 - bx0) / (by1 - by0); // >1 = wider than tall

const TRACE_LONG = 640;
const TRACE_VB_W = shapeAspect >= 1 ? TRACE_LONG : TRACE_LONG * shapeAspect;
const TRACE_VB_H = shapeAspect >= 1 ? TRACE_LONG / shapeAspect : TRACE_LONG;
const TRACE_MARGIN = 26;
const traceProj = geoAlbersUsa().fitExtent([[TRACE_MARGIN, TRACE_MARGIN], [TRACE_VB_W - TRACE_MARGIN, TRACE_VB_H - TRACE_MARGIN]], ff);
const TRACE_PATH = round(geoPath(traceProj)(ff), 1);

const stageIsSquare = STAGE_W === STAGE_H;
const traceWide = TRACE_VB_W >= TRACE_VB_H;
const stageWide = STAGE_W >= STAGE_H;
const ROTATE = !stageIsSquare && traceWide !== stageWide;

// The box's FINAL (post-rotation) on-stage footprint — this is what the
// surrounding flex layout reserves; a wrapper holds the (unrotated) <svg>
// centered + rotated inside it, so rotating never breaks page layout.
const availW = (ROTATE ? STAGE_H : STAGE_W) * 0.92;
const availH = (ROTATE ? STAGE_W : STAGE_H) * 0.74; // leave room for the code/state label below
const traceScale = Math.min(availW / TRACE_VB_W, availH / TRACE_VB_H);
const TRACE_CSS_W = Math.round(TRACE_VB_W * traceScale);
const TRACE_CSS_H = Math.round(TRACE_VB_H * traceScale);
const TRACE_BOX_W = ROTATE ? TRACE_CSS_H : TRACE_CSS_W;
const TRACE_BOX_H = ROTATE ? TRACE_CSS_W : TRACE_CSS_H;

// ── Fonts + wordmark (shared with the other promos) ─────────────────────────
const FONT_WEIGHTS = { SemiBold:600, Bold:700, ExtraBold:800, Black:900 };
const fontsCss = Object.entries(FONT_WEIGHTS).map(([name, weight]) => {
  const b64 = fs.readFileSync(path.join(DIR,'social','fonts',`Barlow-${name}.ttf`)).toString('base64');
  return `@font-face{font-family:'Barlow';font-weight:${weight};font-style:normal;font-display:block;`
       + `src:url(data:font/ttf;base64,${b64}) format('truetype');}`;
}).join('\n');
const wordmarkInner = read('wordmark.svg').replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>[\s\S]*$/, '').trim();

// ── Assemble ─────────────────────────────────────────────────────────────────
let html = read('social/teaser-8/teaser.template.html')
  .replace('/*{{FONTS_CSS}}*/', () => fontsCss);
const repl = {
  WORDMARK: wordmarkInner, STAGE_W: String(STAGE_W), STAGE_H: String(STAGE_H), ASPECT,
  DIST_ID: id, STATE,
  TRACE_PATH, TRACE_VB_W: TRACE_VB_W.toFixed(1), TRACE_VB_H: TRACE_VB_H.toFixed(1),
  TRACE_CSS_W: String(TRACE_CSS_W), TRACE_CSS_H: String(TRACE_CSS_H),
  TRACE_BOX_W: String(TRACE_BOX_W), TRACE_BOX_H: String(TRACE_BOX_H),
  TRACE_ROTATE: ROTATE ? 'true' : 'false',
};
for (const [k, v] of Object.entries(repl)) html = html.replaceAll(`{{${k}}}`, v);

const outDir = path.join(DIR, 'social', 'teaser-8');
fs.mkdirSync(path.join(outDir, 'out'), { recursive: true });
const outName = ASPECT === '1x1' ? 'teaser-8.html' : `teaser-8-${ASPECT}.html`;
fs.writeFileSync(path.join(outDir, outName), html);
const leftover = html.match(/\{\{[A-Z_0-9]+\}\}/g);
console.log(`${outName} written @ ${STAGE_W}×${STAGE_H} — ${id} (${STATE}) (${(html.length/1024).toFixed(0)} KB)`);
if (leftover) console.warn('  ⚠ unreplaced placeholders:', [...new Set(leftover)].join(', '));
