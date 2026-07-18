// ============================================================
// build-teaser-3.mjs   (Teaser #3 — "Compete" showcase)
//
// A standalone, fast-cut promo (for X) that showcases Daily District's
// competitive / stats features — not a single puzzle: the wordmark, then the
// results "Guesses", your personal stats (Played · Win Rate · streaks), the
// Guess Distribution histogram, and the leaderboard (compete with everyone),
// then wordmark + CTA. ~17 s, 1:1 by default.
//
// The sample numbers are illustrative and live in the template (easy to tweak);
// this builder just inlines the fonts + wordmark and stamps the stage size.
//
// Usage:
//   node social/scripts/build-teaser-3.mjs                 # 1:1 (for X)
//   node social/scripts/build-teaser-3.mjs --aspect=9x16   # 1:1 (default) | 9x16 | 16x9
//
// Output: social/teaser-3/teaser-3.html  (or teaser-3-<aspect>.html)
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

// ── Guess-row geometry (small state / district outlines) ────────────────────
const GBOX = 100;
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
const fitPath = feature => round(geoPath(
  geoAlbersUsa().fitExtent([[8, 8], [GBOX - 8, GBOX - 8]], fitFeatureOf(feature)))(feature), 1);

const mapTopo = JSON.parse(read('districts-map.topojson'));
const states = topojson.feature(mapTopo, mapTopo.objects.states).features;
const coreTopo = JSON.parse(read('districts-core.topojson'));
const dists = topojson.feature(coreTopo, coreTopo.objects.districts).features;
const stPath = st => fitPath(states.find(f => f.properties.st === st));
const sdPath = sd => fitPath(dists.find(f => f.properties['state-district'] === sd));

// Illustrative guess sequence: two states (cold, hot) then the answer district.
const GUESSES = [
  { n: 1, name: 'Texas',    pill: 'cold', path: stPath('TX') },
  { n: 2, name: 'Virginia', pill: 'hot',  path: stPath('VA') },
  { n: 3, name: 'WV-01',    pill: 'win',  path: sdPath('WV-01') },
];

// ── Fonts + wordmark (shared with the other promos) ─────────────────────────
const FONT_WEIGHTS = { SemiBold:600, Bold:700, ExtraBold:800, Black:900 };
const fontsCss = Object.entries(FONT_WEIGHTS).map(([name, weight]) => {
  const b64 = fs.readFileSync(path.join(DIR,'social','fonts',`Barlow-${name}.ttf`)).toString('base64');
  return `@font-face{font-family:'Barlow';font-weight:${weight};font-style:normal;font-display:block;`
       + `src:url(data:font/ttf;base64,${b64}) format('truetype');}`;
}).join('\n');
const wordmarkInner = read('wordmark.svg').replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>[\s\S]*$/, '').trim();

// ── Assemble ─────────────────────────────────────────────────────────────────
let html = read('social/teaser-3/teaser.template.html').replace('/*{{FONTS_CSS}}*/', fontsCss);
const repl = {
  WORDMARK: wordmarkInner, STAGE_W: String(STAGE_W), STAGE_H: String(STAGE_H), ASPECT,
  GBOX: String(GBOX), GUESSES_JSON: JSON.stringify(GUESSES),
};
for (const [k, v] of Object.entries(repl)) html = html.replaceAll(`{{${k}}}`, v);

const outDir = path.join(DIR, 'social', 'teaser-3');
fs.mkdirSync(path.join(outDir, 'out'), { recursive: true });   // ensure teaser-3/ (and out/) exist
const outName = ASPECT === '1x1' ? 'teaser-3.html' : `teaser-3-${ASPECT}.html`;
fs.writeFileSync(path.join(outDir, outName), html);
const leftover = html.match(/\{\{[A-Z_]+\}\}/g);
console.log(`${outName} written @ ${STAGE_W}×${STAGE_H} (${(html.length/1024).toFixed(0)} KB)`);
if (leftover) console.warn('  ⚠ unreplaced placeholders:', [...new Set(leftover)].join(', '));
