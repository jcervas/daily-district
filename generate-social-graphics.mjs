// ============================================================
// generate-social-graphics.mjs
// Renders the two "Social Graphics" promo templates (from the
// Social Graphics.dc.html design canvas) to PNG for any district:
//
//   1a  16:9  1600×900   — X / YouTube / link-preview promo card
//                          (full-bleed district map + headline + CTA)
//   1b  9:16  1080×1920  — Reels / TikTok / Stories card
//                          (red district silhouette + headline + CTA)
//
// Everything is drawn from the same topojson the daily tweet uses, so no
// baked per-district art is needed. Barlow (the design font) is bundled in
// social/fonts/ and handed to resvg directly — system fonts are not used.
//
// Usage:
//   node generate-social-graphics.mjs                 today's puzzle district
//   node generate-social-graphics.mjs --district=IL-3 a specific district
//   node generate-social-graphics.mjs --date=2026-07-04   the puzzle for a date
//   node generate-social-graphics.mjs --all           every base district (435)
//   node generate-social-graphics.mjs --out=some/dir  output directory
//
// Output: social/out/<district>-16x9.png and <district>-9x16.png
// ============================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { geoAlbersUsa, geoPath, geoArea } from 'd3-geo';
import * as topojson from 'topojson-client';
import { baseIds, districtIdForPuzzle, puzzleNumberFor } from './puzzle-schedule.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const SITE = 'daily-district.com';

// ── Brand tokens (from the design) ───────────────────────────────────────────
const RED = '#C41230';
const INK = '#1a1a1a';
const LIGHT_BG = '#f5f5f3';
const CARD_BG = '#E0E0E0';

const FONT_FILES = ['SemiBold', 'Bold', 'ExtraBold', 'Black']
  .map(w => path.join(DIR, 'social', 'fonts', `Barlow-${w}.ttf`));

// ── Date / district resolution (puzzleNumberFor + epoch live in puzzle-schedule.mjs)
function todayEastern() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

// ── Geometry ──────────────────────────────────────────────────────────────────

// AlbersUSA fit to the largest sub-polygon so small islands don't blow out the extent.
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
function containProjection(feature, W, H, pad) {
  return geoAlbersUsa().fitExtent([[pad, pad], [W - pad, H - pad]], fitFeatureOf(feature));
}
// ── Wordmark (wordmark.svg uses fill="currentColor"; resvg won't resolve that,
//    so substitute the colour). Returns an SVG <g> scaled to `width`. ──────────
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

// ── Text ────────────────────────────────────────────────────────────────────
let _Resvg;
async function loadResvg() {
  if (!_Resvg) ({ Resvg: _Resvg } = await import('@resvg/resvg-js'));
  return _Resvg;
}
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Measure a single line's advance width (px) at the given size/weight via resvg's bbox.
async function measure(text, size, weight) {
  const Resvg = await loadResvg();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="4000" height="${Math.ceil(size * 2)}">`
    + `<text x="0" y="${size}" font-family="Barlow" font-weight="${weight}" font-size="${size}">${esc(text)}</text></svg>`;
  const bb = new Resvg(svg, { font: { fontFiles: FONT_FILES, loadSystemFonts: false, defaultFontFamily: 'Barlow' } }).getBBox();
  return bb ? bb.x + bb.width : text.length * size * 0.55;
}
function text(str, x, y, { size, weight = 800, fill = INK, anchor = 'start', spacing = 0 }) {
  const ls = spacing ? ` letter-spacing="${spacing}"` : '';
  return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-family="Barlow" font-weight="${weight}"`
    + ` font-size="${size}" fill="${fill}" text-anchor="${anchor}"${ls}>${esc(str)}</text>`;
}
// A pill (rounded rect sized to its text + padding) with centred label.
async function pill(str, x, y, { size, weight = 800, padX, height, bg = RED, fill = '#ffffff', spacing = 0 }) {
  const tw = await measure(str, size, weight) + spacing * (str.length - 1);
  const w = tw + padX * 2;
  const cx = x + w / 2, cy = y + height / 2 + size * 0.35;
  const rect = `<rect x="${x}" y="${y}" width="${w.toFixed(1)}" height="${height}" rx="${height / 2}" fill="${bg}"/>`;
  return { w, svg: rect + text(str, cx, cy, { size, weight, fill, anchor: 'middle', spacing }) };
}

// ── 1a — 16:9 promo (1600×900) ────────────────────────────────────────────────
// Same flat treatment as the 9:16: a solid-red district silhouette (no roads or
// urban areas) on the light background, laid out two-column — text left, the
// silhouette in a rounded card on the right.
async function build16x9(district) {
  const W = 1600, H = 900;
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">`];
  parts.push(`<rect width="${W}" height="${H}" fill="${LIGHT_BG}"/>`);

  // Right: silhouette card.
  const cardW = 660, cardH = 660, cardX = W - 60 - cardW, cardY = (H - cardH) / 2;
  parts.push(`<rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" rx="40" fill="${CARD_BG}"/>`);
  const box = 520;
  const proj = containProjection(district, box, box, 0);
  const [dx, dy] = [cardX + (cardW - box) / 2, cardY + (cardH - box) / 2];
  parts.push(`<g transform="translate(${dx},${dy})"><path d="${geoPath(proj)(district)}" fill="${RED}"/></g>`);

  // Left column: wordmark, badge, headline, CTA.
  const x = 70;
  parts.push(wordmark(x, 215, 360, RED));
  const badge = await pill('A DAILY GEOGRAPHY GAME', x, 320, { size: 26, weight: 800, padX: 22, height: 46, spacing: 2.6 });
  parts.push(badge.svg);
  parts.push(text('Can you identify', x, 470, { size: 78, weight: 900, fill: INK }));
  parts.push(text('this district?', x, 552, { size: 78, weight: 900, fill: INK }));
  parts.push(text(`Play free at ${SITE}`, x, 632, { size: 34, weight: 700, fill: RED }));

  parts.push('</svg>');
  return parts.join('');
}

// ── 1b — 9:16 vertical (1080×1920) ────────────────────────────────────────────
async function build9x16(district) {
  const W = 1080, H = 1920;
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">`];
  parts.push(`<rect width="${W}" height="${H}" fill="${LIGHT_BG}"/>`);

  // Wordmark (red), centred.
  const wmW = 620, wmH = wmW * 56 / 260, wmY = 110;
  parts.push(wordmark((W - wmW) / 2, wmY, wmW, RED));

  // Headline, two centred lines.
  const hSize = 74, hLead = hSize * 1.04;
  let y = wmY + wmH + 90 + hSize * 0.8;
  parts.push(text('This is a real', W / 2, y, { size: hSize, weight: 900, fill: INK, anchor: 'middle' }));
  parts.push(text('congressional district.', W / 2, y + hLead, { size: hSize, weight: 900, fill: INK, anchor: 'middle' }));

  // Silhouette card.
  const cardY = y + hLead + 70, cardW = 880, cardH = 760, cardX = (W - cardW) / 2;
  parts.push(`<rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" rx="40" fill="${CARD_BG}"/>`);
  const box = 720, boxH = 600;
  const proj = containProjection(district, box, boxH, 24);
  const [dx, dy] = [cardX + (cardW - box) / 2, cardY + (cardH - boxH) / 2];
  parts.push(`<g transform="translate(${dx},${dy})"><path d="${geoPath(proj)(district)}" fill="${RED}"/></g>`);

  // "Can you identify it?" + CTA pill (measured first so we can centre it).
  const cy = cardY + cardH + 80 + 62 * 0.7;
  parts.push(text('Can you identify it?', W / 2, cy, { size: 62, weight: 800, fill: RED, anchor: 'middle' }));
  const ctaW = await measure(`Play free · ${SITE}`, 40, 800) + 54 * 2;
  const cta = await pill(`Play free · ${SITE}`, (W - ctaW) / 2, cy + 44, { size: 40, weight: 800, padX: 54, height: 88 });
  parts.push(cta.svg);

  parts.push('</svg>');
  return parts.join('');
}

// ── Render ────────────────────────────────────────────────────────────────────
async function renderPng(svg, outW) {
  const Resvg = await loadResvg();
  const r = new Resvg(svg, {
    fitTo: { mode: 'width', value: outW },
    font: { fontFiles: FONT_FILES, loadSystemFonts: false, defaultFontFamily: 'Barlow' },
  });
  return r.render().asPng();
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const arg = k => process.argv.find(a => a.startsWith(`--${k}`));
  const outDir = arg('out=') ? arg('out=').slice(6) : path.join(DIR, 'social', 'out');
  fs.mkdirSync(outDir, { recursive: true });

  const topo = JSON.parse(fs.readFileSync(path.join(DIR, 'districts-core.topojson'), 'utf8'));
  const features = topojson.feature(topo, topo.objects.districts).features;
  const byId = id => features.find(f => f.properties['state-district'] === id);

  let ids;
  if (arg('all')) {
    ids = baseIds(topo);
  } else if (arg('district=')) {
    // Accept IL-3 or IL-03; the topojson ids are zero-padded (IL-03).
    const [st, dist] = arg('district=').slice(11).toUpperCase().split('-');
    ids = [`${st}-${String(dist).padStart(2, '0')}`];
  } else {
    const date = arg('date=') ? arg('date=').slice(7) : todayEastern();
    const num = puzzleNumberFor(date);
    if (num < 1) throw new Error(`Puzzle for ${date} (No. ${num}) is before launch (2026-06-22)`);
    ids = [districtIdForPuzzle(num, baseIds(topo))];
    console.log(`${date} → puzzle No. ${num} → ${ids[0]}`);
  }

  for (const id of ids) {
    const district = byId(id);
    if (!district) { console.warn(`  skip ${id} — no geometry`); continue; }
    // Render at 2× the design dimensions for crisp, high-resolution output.
    const png16 = await renderPng(await build16x9(district), 3200);
    const png9 = await renderPng(await build9x16(district), 2160);
    fs.writeFileSync(path.join(outDir, `${id}-16x9.png`), png16);
    fs.writeFileSync(path.join(outDir, `${id}-9x16.png`), png9);
    console.log(`  ${id}  →  ${id}-16x9.png (${png16.length}b), ${id}-9x16.png (${png9.length}b)`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
