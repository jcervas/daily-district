// ============================================================
// generate-social-banner.mjs
// Renders a 1500×500 Twitter/X header banner: a frieze of the most
// irregularly shaped congressional districts (lowest Polsby–Popper
// compactness) as white silhouettes on a Carnegie Red field, with the
// Daily District wordmark centred. CMU colour scheme (Carnegie Red #C41230).
//
//   node social/scripts/generate-social-banner.mjs            → social/out/banner-twitter.png
//   node social/scripts/generate-social-banner.mjs --n=9      → number of silhouettes in the frieze
//
// At-large / single-district states are excluded: their shape is the whole
// state, not a redistricting choice.
// ============================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { geoAlbersUsa, geoPath, geoArea } from 'd3-geo';
import * as topojson from 'topojson-client';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..'); // repo root (script lives in social/scripts/)
const SITE = 'daily-district.com';

// CMU palette.
const RED = '#C41230';
const WHITE = '#ffffff';
const INK = '#1a1a1a';

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

let _Resvg;
async function loadResvg() {
  if (!_Resvg) ({ Resvg: _Resvg } = await import('@resvg/resvg-js'));
  return _Resvg;
}
// Advance width (px) of a single line, via resvg's bbox.
async function measure(str, size, weight) {
  const Resvg = await loadResvg();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="4000" height="${Math.ceil(size * 2)}">`
    + `<text x="0" y="${size}" font-family="Barlow" font-weight="${weight}" font-size="${size}">${esc(str)}</text></svg>`;
  const bb = new Resvg(svg, { font: { fontFiles: FONT_FILES, loadSystemFonts: false, defaultFontFamily: 'Barlow' } }).getBBox();
  return bb ? bb.x + bb.width : str.length * size * 0.55;
}

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

// A guess "chip" like the game's autocomplete: white pill, soft shadow, a small
// red swatch, and a label. Centred on (cx, cy). Returns an SVG <g>.
async function chip(label, cx, cy, { scale = 1, opacity = 1, solid = false } = {}) {
  const size = 19 * scale, h = 44 * scale, r = h / 2;
  const padX = 17 * scale, sw = 20 * scale, gapS = 11 * scale, swR = 5 * scale;
  const w = padX + sw + gapS + await measure(label, size, 700) + padX;
  const x = cx - w / 2, y = cy - h / 2;
  return `<g opacity="${opacity}">`
    + `<rect x="${x.toFixed(1)}" y="${(y + 4 * scale).toFixed(1)}" width="${w.toFixed(1)}" height="${h}" rx="${r}" fill="rgba(30,15,20,0.13)" filter="url(#chipShadow)"/>`
    + `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h}" rx="${r}" fill="${WHITE}"/>`
    + `<rect x="${(x + padX).toFixed(1)}" y="${(cy - sw / 2).toFixed(1)}" width="${sw}" height="${sw}" rx="${swR}" fill="${RED}" fill-opacity="${solid ? 1 : 0.45}"/>`
    + text(label, x + padX + sw + gapS, cy + size * 0.34, { size, weight: 700, fill: '#70707a' })
    + `</g>`;
}

// ── Style: "chips" — scattered guess-chips on a light field, centred lockup ────
async function buildChips(features) {
  const W = 1500, H = 500;
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">`];
  parts.push('<defs>'
    + `<radialGradient id="bg" cx="0.5" cy="0.42" r="0.75">`
    + `<stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#f2ecef"/></radialGradient>`
    + `<filter id="chipShadow" x="-40%" y="-40%" width="180%" height="180%">`
    + `<feGaussianBlur stdDeviation="5"/></filter></defs>`);
  parts.push(`<rect width="${W}" height="${H}" fill="url(#bg)"/>`);

  // Faint district line-art in the background — a few of the gnarliest shapes,
  // large and bleeding off the edges, behind the chips and lockup.
  const byId = id => features.find(f => f.properties['state-district'] === id);
  const lines = [
    ['MD-01', -150, -120, 580, 520], // top-left bleed
    ['WA-02', 1120, 140, 600, 560],  // bottom-right bleed
    ['NC-01', 30, 250, 380, 340],    // lower-left
  ];
  parts.push(`<g fill="none" stroke="${RED}" stroke-opacity="0.13" stroke-width="2.5" stroke-linejoin="round">`);
  for (const [id, x, y, w, h] of lines) {
    const f = byId(id);
    if (f) parts.push(`<g transform="translate(${x},${y})"><path d="${silhouettePath(f, w, h, 4)}"/></g>`);
  }
  parts.push('</g>');

  // Scattered guess-chips. [label, cx, cy, scale, opacity, solidSwatch]
  const chips = [
    ['OHIO', 130, 66, 0.95, 0.5, false],
    ['AZ-03', 612, 78, 0.82, 0.4, false],
    ['FL-27', 662, 132, 1.0, 1, true],
    ['PA-08', 1372, 66, 0.95, 0.5, false],
    ['NY-14', 1226, 250, 1.0, 0.95, true],
    ['WA-07', 1168, 300, 0.9, 0.45, false],
    ['VA-05', 322, 300, 0.9, 0.5, false],
    ['CA-05', 438, 340, 0.95, 0.72, false],
    ['TEXAS', 1078, 428, 0.98, 0.85, true],
    ['NC-02', 176, 468, 0.98, 0.9, true],
    ['IL-12', 262, 476, 0.9, 0.45, false],
    ['ILLINOIS', 842, 462, 0.98, 0.95, true],
    ['VA-10', 772, 470, 0.9, 0.5, false],
  ];
  for (const [label, cx, cy, scale, opacity, solid] of chips) {
    parts.push(await chip(label, cx, cy, { scale, opacity, solid }));
  }

  // Centre lockup: wordmark, two-tone tagline, URL.
  const wmW = 620, wmH = wmW * 56 / 260, wc = 200;
  parts.push(wordmark((W - wmW) / 2, wc - wmH / 2, wmW, RED));

  const tSize = 31, a = 'Play free.', b = 'New district every day.';
  const aw = await measure(a, tSize, 800), bw = await measure(b, tSize, 800);
  const wsp = tSize * 0.32; // word-space between the two colours (bbox trims spaces)
  const sx = W / 2 - (aw + wsp + bw) / 2, tY = wc + wmH / 2 + 44;
  parts.push(text(a, sx, tY, { size: tSize, weight: 800, fill: INK }));
  parts.push(text(b, sx + aw + wsp, tY, { size: tSize, weight: 800, fill: RED }));

  parts.push(text('daily-district.com', W / 2, tY + 62, { size: 54, weight: 900, fill: RED, anchor: 'middle' }));

  parts.push('</svg>');
  return { svg: parts.join(''), picks: chips.map(c => c[0]) };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const arg = k => process.argv.find(a => a.startsWith(`--${k}`));
  const style = arg('style=') ? arg('style=').slice(8) : 'chips'; // 'chips' | 'red'
  const n = arg('n=') ? parseInt(arg('n=').slice(4), 10) : 7;
  const outDir = path.join(DIR, 'social', 'out');
  fs.mkdirSync(outDir, { recursive: true });

  const topo = JSON.parse(fs.readFileSync(path.join(DIR, 'districts-core.topojson'), 'utf8'));
  const features = topojson.feature(topo, topo.objects.districts).features;
  const built = style === 'red' ? buildBanner(features, n) : await buildChips(features);
  const { svg, picks } = built;

  const Resvg = await loadResvg();
  const png = new Resvg(svg, {
    fitTo: { mode: 'width', value: 3000 }, // 2× 1500×500
    font: { fontFiles: FONT_FILES, loadSystemFonts: false, defaultFontFamily: 'Barlow' },
  }).render().asPng();

  const out = path.join(outDir, 'banner-twitter.png');
  fs.writeFileSync(out, png);
  console.log(`banner-twitter.png (${png.length}b) — ${style}: ${picks.join(', ')}`);
}

main().catch(err => { console.error(err); process.exit(1); });
