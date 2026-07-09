// ============================================================
// generate-social-banner.mjs
// Renders a 1500×500 Twitter/X header banner: a frieze of the most
// irregularly shaped congressional districts (lowest Polsby–Popper
// compactness) as white silhouettes on a Carnegie Red field, with the
// Daily District wordmark centred. CMU colour scheme (Carnegie Red #C41230).
//
//   node generate-social-banner.mjs            → social/out/banner-twitter.png
//   node generate-social-banner.mjs --n=9      → number of silhouettes in the frieze
//
// At-large / single-district states are excluded: their shape is the whole
// state, not a redistricting choice.
// ============================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { geoAlbersUsa, geoPath, geoArea } from 'd3-geo';
import * as topojson from 'topojson-client';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const SITE = 'daily-district.com';

// CMU palette.
const RED = '#C41230';
const WHITE = '#ffffff';

const FONT_FILES = ['SemiBold', 'Bold', 'ExtraBold', 'Black']
  .map(w => path.join(DIR, 'social', 'fonts', `Barlow-${w}.ttf`));
const AT_LARGE = new Set(['AK', 'DE', 'ND', 'SD', 'VT', 'WY']);

// ── Geometry ──────────────────────────────────────────────────────────────────
function fitFeatureOf(feature) {
  const geom = feature.geometry;
  if (geom && geom.type === 'MultiPolygon') {
    const largest = geom.coordinates.reduce((best, poly) => {
      const a = geoArea({ type: 'Feature', geometry: { type: 'Polygon', coordinates: poly } });
      const b = geoArea({ type: 'Feature', geometry: { type: 'Polygon', coordinates: best } });
      return a > b ? poly : best;
    });
    return { type: 'Feature', geometry: { type: 'Polygon', coordinates: largest } };
  }
  return feature;
}
// Fit a feature into a w×h box and return its path `d` plus the box's placement.
function silhouettePath(feature, w, h, pad) {
  const proj = geoAlbersUsa().fitExtent([[pad, pad], [w - pad, h - pad]], fitFeatureOf(feature));
  return geoPath(proj)(feature);
}

// ── Wordmark (currentColor → fill) ───────────────────────────────────────────
let _wordmarkRaw;
function wordmark(x, y, width, fill) {
  if (_wordmarkRaw === undefined) {
    try { _wordmarkRaw = fs.readFileSync(path.join(DIR, 'wordmark.svg'), 'utf8'); }
    catch { _wordmarkRaw = null; }
  }
  if (!_wordmarkRaw) return '';
  const vb = (_wordmarkRaw.match(/viewBox="([^"]+)"/)?.[1] || '0 0 260 56').split(/\s+/).map(Number);
  const scale = width / (vb[2] || 260);
  const inner = _wordmarkRaw
    .replace(/^[\s\S]*?<svg[^>]*>/, '')
    .replace(/<\/svg>[\s\S]*$/, '')
    .replace(/currentColor/g, fill);
  return `<g transform="translate(${x.toFixed(2)},${y.toFixed(2)}) scale(${scale.toFixed(4)})">${inner}</g>`;
}
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const text = (str, x, y, o) =>
  `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-family="Barlow" font-weight="${o.weight || 700}"`
  + ` font-size="${o.size}" fill="${o.fill}" text-anchor="${o.anchor || 'start'}"`
  + `${o.spacing ? ` letter-spacing="${o.spacing}"` : ''}>${esc(str)}</text>`;

// ── Build ─────────────────────────────────────────────────────────────────────
function buildBanner(features, n) {
  const W = 1500, H = 500;
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">`];
  parts.push(`<rect width="${W}" height="${H}" fill="${RED}"/>`);

  // The n most irregular districts (lowest Polsby–Popper), at-large excluded.
  const picks = features
    .map(f => ({ f, id: f.properties['state-district'], pp: f.properties.polsby_popper }))
    .filter(d => typeof d.pp === 'number' && d.id && !AT_LARGE.has(d.id.slice(0, 2)) && !d.id.startsWith('DC'))
    .sort((a, b) => a.pp - b.pp)
    .slice(0, n);

  // Centre chip geometry (defined first so the filmstrip can leave room for it).
  const wmW = 470, wmH = wmW * 56 / 260;
  const pw = 660, ph = 208, px = (W - pw) / 2, py = (H - ph) / 2;

  // Full-width filmstrip: large, evenly-spaced white silhouettes, centred
  // vertically. Skip the cells whose centre falls under the chip so nothing
  // pokes out around it — the shapes flank the wordmark on both sides.
  const boxH = 360, gap = 34, cellW = W / n, dy = (H - boxH) / 2;
  parts.push(`<g fill="${WHITE}">`);
  picks.forEach((d, i) => {
    const cx = i * cellW + cellW / 2;
    if (cx > px - 10 && cx < px + pw + 10) return; // behind the chip → skip
    const dPath = silhouettePath(d.f, cellW - gap, boxH, 4);
    parts.push(`<g transform="translate(${(i * cellW + gap / 2).toFixed(1)},${dy})"><path d="${dPath}"/></g>`);
  });
  parts.push('</g>');
  parts.push(`<rect x="${px}" y="${py}" width="${pw}" height="${ph}" rx="26" fill="${RED}"/>`);
  parts.push(wordmark((W - wmW) / 2, H / 2 - wmH / 2 - 16, wmW, WHITE));
  parts.push(text(`A daily geography game  ·  ${SITE}`, W / 2, H / 2 + wmH / 2 + 30,
    { size: 29, weight: 600, fill: WHITE, anchor: 'middle', spacing: 1 }));

  parts.push('</svg>');
  return { svg: parts.join(''), picks: picks.map(p => p.id) };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const arg = k => process.argv.find(a => a.startsWith(`--${k}`));
  const n = arg('n=') ? parseInt(arg('n=').slice(4), 10) : 6;
  const outDir = path.join(DIR, 'social', 'out');
  fs.mkdirSync(outDir, { recursive: true });

  const topo = JSON.parse(fs.readFileSync(path.join(DIR, 'districts-core.topojson'), 'utf8'));
  const features = topojson.feature(topo, topo.objects.districts).features;

  const { svg, picks } = buildBanner(features, n);
  const { Resvg } = await import('@resvg/resvg-js');
  const png = new Resvg(svg, {
    fitTo: { mode: 'width', value: 3000 }, // 2× 1500×500
    font: { fontFiles: FONT_FILES, loadSystemFonts: false, defaultFontFamily: 'Barlow' },
  }).render().asPng();

  const out = path.join(outDir, 'banner-twitter.png');
  fs.writeFileSync(out, png);
  console.log(`banner-twitter.png (${png.length}b) — frieze: ${picks.join(', ')}`);
}

main().catch(err => { console.error(err); process.exit(1); });
