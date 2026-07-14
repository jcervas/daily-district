// ============================================================
// build-teaser-4.mjs   (Teaser #4 — "Civics / education mission")
//
// A standalone promo with a calmer, mission-driven tone: why districts
// matter. The wordmark, then the real U.S. map with all 435 district lines
// ("435 districts · each ≈ 761,000 people"), the redistricting fact (the lines
// never stop moving — mid-decade redraws, lawsuits, court-ordered maps), the
// learn-by-playing beat (an accelerating rotation through ~30 district
// silhouettes, starting on CO-03), the makers line (Carnegie Mellon
// University · Redistrict Network), then wordmark + CTA. ~28 s. 1:1 by default.
//
// The U.S. map (national outline + state borders + all district lines) is
// generated from districts-map.topojson — the same simplified geometry the
// game's interactive maps use.
//
// Usage:
//   node build-teaser-4.mjs                 # 1:1
//   node build-teaser-4.mjs --aspect=9x16   # 1x1 (default) | 9x16 | 16x9
//
// Output: social/teaser-4/teaser-4.html  (or teaser-4-<aspect>.html)
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

// ── U.S. map: outline + state borders + all 435 district lines ──────────────
const MAP_W = 1000, MAP_H = 620;
const tm = JSON.parse(read('districts-map.topojson'));
const stObj = tm.objects.states, dObj = tm.objects.districts;
const stFeat = topojson.feature(tm, stObj);
const proj = geoAlbersUsa().fitExtent([[10, 10], [MAP_W - 10, MAP_H - 10]], stFeat);
const gp = geoPath(proj);
const US_OUTLINE = round(gp(topojson.mesh(tm, stObj, (a, b) => a === b)), 1);
const US_STATES  = round(gp(topojson.mesh(tm, stObj, (a, b) => a !== b)), 1);
// Every district as its own polygon, so the map scene can mosaic-fill them
// one by one in randomized order.
const US_DIST_FILLS = topojson.feature(tm, dObj).features
  .map(f => round(gp(f), 1)).filter(Boolean);

// ── "Learn" beat: an accelerating rotation through ~30 district silhouettes,
//    starting on CO-03 (slow) and speeding up into an indecipherable blur. ────
const LEARN_ID = (arg('learn') || 'CO-03').toUpperCase();
const SIL_COUNT = parseInt(arg('sils') || '30', 10);
const core = JSON.parse(read('districts-core.topojson'));
const allDist = topojson.feature(core, core.objects.districts).features;
const dFeat = allDist.find(f => f.properties['state-district'] === LEARN_ID);
if (!dFeat) throw new Error(`No geometry for ${LEARN_ID}`);
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
const silPathOf = f => round(geoPath(geoAlbersUsa()
  .fitExtent([[18, 18], [SIL_BOX - 18, SIL_BOX - 18]], fitFeatureOf(f)))(f), 1);
// CO-03 first (recognisable while slow), then the most irregular real districts
// — striking shapes for the clear early beats — excluding at-large whole states.
const AT_LARGE = new Set(['AK', 'DE', 'ND', 'SD', 'VT', 'WY']);
const others = allDist
  .filter(f => { const id = f.properties['state-district'];
    return id && id !== LEARN_ID && !AT_LARGE.has(id.slice(0, 2)) && !id.startsWith('DC')
      && typeof f.properties.polsby_popper === 'number'; })
  .sort((a, b) => a.properties.polsby_popper - b.properties.polsby_popper)
  .slice(0, Math.max(0, SIL_COUNT - 1));
const SIL_PATHS = [dFeat, ...others].map(silPathOf);
const SIL_PATH = SIL_PATHS[0];

// ── Fonts + wordmark ─────────────────────────────────────────────────────────
const FONT_WEIGHTS = { SemiBold:600, Bold:700, ExtraBold:800, Black:900 };
const fontsCss = Object.entries(FONT_WEIGHTS).map(([name, weight]) => {
  const b64 = fs.readFileSync(path.join(DIR,'social','fonts',`Barlow-${name}.ttf`)).toString('base64');
  return `@font-face{font-family:'Barlow';font-weight:${weight};font-style:normal;font-display:block;`
       + `src:url(data:font/ttf;base64,${b64}) format('truetype');}`;
}).join('\n');
const wordmarkInner = read('wordmark.svg').replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>[\s\S]*$/, '').trim();

// ── Assemble ─────────────────────────────────────────────────────────────────
let html = read('social/teaser-4/teaser.template.html').replace('/*{{FONTS_CSS}}*/', fontsCss);
const repl = {
  WORDMARK: wordmarkInner, STAGE_W: String(STAGE_W), STAGE_H: String(STAGE_H), ASPECT,
  MAP_W: String(MAP_W), MAP_H: String(MAP_H),
  US_OUTLINE, US_STATES, US_DIST_FILLS_JSON: JSON.stringify(US_DIST_FILLS),
  SIL_BOX: String(SIL_BOX), SIL_PATH, SIL_PATHS_JSON: JSON.stringify(SIL_PATHS), LEARN_ID,
};
for (const [k, v] of Object.entries(repl)) html = html.replaceAll(`{{${k}}}`, v);

const outDir = path.join(DIR, 'social', 'teaser-4');
fs.mkdirSync(path.join(outDir, 'out'), { recursive: true });
const outName = ASPECT === '1x1' ? 'teaser-4.html' : `teaser-4-${ASPECT}.html`;
fs.writeFileSync(path.join(outDir, outName), html);
const leftover = html.match(/\{\{[A-Z_]+\}\}/g);
console.log(`${outName} written @ ${STAGE_W}×${STAGE_H} (${(html.length/1024).toFixed(0)} KB)`);
if (leftover) console.warn('  ⚠ unreplaced placeholders:', [...new Set(leftover)].join(', '));
