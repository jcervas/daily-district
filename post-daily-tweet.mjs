// ============================================================
// post-daily-tweet.mjs
// Posts today's puzzle teaser to the @daily_district_ X account:
// the 800×450 landscape district image (same rendering as the in-app
// "Share" image, light mode, no answer text) plus a random hype message.
//
// Runs daily from .github/workflows/daily-tweet.yml. Needs four repo
// secrets from an X developer app with Read+Write permissions on the
// @daily_district_ account:
//   X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET
//
// Usage:
//   node post-daily-tweet.mjs                  post today's puzzle
//   DRY_RUN=1 node post-daily-tweet.mjs        render daily-tweet-preview.png + print text, no post
//   node post-daily-tweet.mjs --date=2026-07-04   override the puzzle date (testing)
//   node post-daily-tweet.mjs --delete-tweet=<id>  delete a tweet from the account (needs creds)
// ============================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { geoAlbersUsa, geoPath, geoArea, geoBounds } from 'd3-geo';
import * as topojson from 'topojson-client';
import { baseIds, districtIdForPuzzle } from './puzzle-schedule.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const SITE_URL = 'https://daily-district.com';

// Same epoch as seed-puzzles.mjs: puzzle No. 1 on 2026-06-22.
const EPOCH_UTC = Date.UTC(2026, 5, 22);

// Rotating teaser messages — one is picked at random each day.
const MESSAGES = [
  'Guess today’s District!',
  'Daily District is live!',
  'A new district just dropped. Can you place it?',
  'Do you know where this is?',
  'One district. Six guesses. Go.',
  'Today’s mystery district awaits.',
  'Where in the country is this?',
  'Recognize this shape? Prove it.',
  'Your daily dose of geography is here.',
  'New day, new district.',
];

// ── Today's district ─────────────────────────────────────────────────────────

// Puzzle date = the calendar date in US Eastern time (players' "today").
function puzzleDate() {
  const flag = process.argv.find(a => a.startsWith('--date='));
  if (flag) return flag.slice(7);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function puzzleNumberFor(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Math.floor((Date.UTC(y, m - 1, d) - EPOCH_UTC) / 86400000) + 1;
}

// ── Rendering (mirrors _renderDistrictToBlob / _buildRichMapLayers in script.js,
//    light mode) ──────────────────────────────────────────────────────────────

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// AlbersUSA fit to the largest sub-polygon so small islands don't blow out the extent.
function previewProjection(feature, W, H, pad) {
  let fitFeature = feature;
  const geom = feature.geometry;
  if (geom && geom.type === 'MultiPolygon') {
    const largest = geom.coordinates.reduce((best, poly) => {
      const a = geoArea({ type: 'Feature', geometry: { type: 'Polygon', coordinates: poly } });
      const b = geoArea({ type: 'Feature', geometry: { type: 'Polygon', coordinates: best } });
      return a > b ? poly : best;
    });
    fitFeature = { type: 'Feature', geometry: { type: 'Polygon', coordinates: largest } };
  }
  return geoAlbersUsa().fitExtent([[pad, pad], [W - pad, H - pad]], fitFeature);
}

function buildSvg(district, overlay) {
  const W = 800, H = 450, pad = 40;
  const projection = previewProjection(district, W, H, pad);
  const pathGen = geoPath(projection);

  const [[bx0, by0], [bx1, by1]] = geoBounds(district);
  const mg = 0.1;
  const inBounds = f => {
    try {
      const [[fx0, fy0], [fx1, fy1]] = geoBounds(f);
      return fx1 >= bx0 - mg && fx0 <= bx1 + mg && fy1 >= by0 - mg && fy0 <= by1 + mg;
    } catch { return false; }
  };

  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">`);
  parts.push(`<rect width="${W}" height="${H}" fill="#f3f4f6"/>`);

  const layer = (features, attrs) => {
    parts.push('<g>');
    for (const f of features.filter(inBounds)) {
      const d = pathGen(f);
      if (d) parts.push(`<path d="${d}" ${attrs}/>`);
    }
    parts.push('</g>');
  };
  if (overlay.urban) layer(overlay.urban.features, 'fill="rgba(0,0,0,0.09)" stroke="none"');
  if (overlay.roads) layer(overlay.roads.features, 'fill="none" stroke="#bbb" stroke-width="0.6"');

  const dPath = pathGen(district);
  parts.push(`<path d="M0,0L${W},0L${W},${H}L0,${H}Z ${dPath}" fill="rgba(0,0,0,0.18)" fill-rule="evenodd"/>`);
  parts.push(`<path d="${dPath}" fill="#C41230" fill-opacity="0.25"/>`);
  parts.push(`<path d="${dPath}" fill="none" stroke="#C41230" stroke-width="2.5" stroke-linejoin="round"/>`);
  parts.push(`<text x="${W - 12}" y="${H - 12}" text-anchor="end" font-family="Helvetica, Arial, 'DejaVu Sans', sans-serif" font-size="13" font-weight="600" fill="rgba(0,0,0,0.35)">${esc('Daily District')}</text>`);
  parts.push('</svg>');
  return parts.join('');
}

async function renderPng(svg) {
  const { Resvg } = await import('@resvg/resvg-js');
  // 2× the client's 800×450 canvas for a crisper timeline image.
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1600 },
    font: { loadSystemFonts: true },
  });
  return resvg.render().asPng();
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function xClient() {
  const { TwitterApi } = await import('twitter-api-v2');
  const missing = ['X_API_KEY', 'X_API_SECRET', 'X_ACCESS_TOKEN', 'X_ACCESS_TOKEN_SECRET']
    .filter(k => !process.env[k]);
  if (missing.length) throw new Error(`Missing env vars: ${missing.join(', ')}`);
  return new TwitterApi({
    appKey: process.env.X_API_KEY,
    appSecret: process.env.X_API_SECRET,
    accessToken: process.env.X_ACCESS_TOKEN,
    accessSecret: process.env.X_ACCESS_TOKEN_SECRET,
  });
}

async function main() {
  const deleteFlag = process.argv.find(a => a.startsWith('--delete-tweet='));
  if (deleteFlag) {
    const id = deleteFlag.slice(15);
    if (!/^\d+$/.test(id)) throw new Error(`Bad tweet id: ${id}`);
    const client = await xClient();
    const { data } = await client.v2.deleteTweet(id);
    console.log(`Delete tweet ${id}: deleted=${data.deleted}`);
    return;
  }

  const date = puzzleDate();
  const num = puzzleNumberFor(date);
  if (num < 1) throw new Error(`Puzzle number ${num} for ${date} is before launch (2026-06-22)`);

  const topo = JSON.parse(fs.readFileSync(path.join(DIR, 'districts-core.topojson'), 'utf8'));
  const ids = baseIds(topo);
  const districtId = districtIdForPuzzle(num, ids);
  const districts = topojson.feature(topo, topo.objects.districts).features;
  const district = districts.find(f => f.properties['state-district'] === districtId);
  if (!district) throw new Error(`No geometry for ${districtId}`);

  const overlayTopo = JSON.parse(fs.readFileSync(path.join(DIR, 'districts-overlay.topojson'), 'utf8'));
  const overlay = {
    roads: overlayTopo.objects.roads ? topojson.feature(overlayTopo, overlayTopo.objects.roads) : null,
    urban: overlayTopo.objects.urban ? topojson.feature(overlayTopo, overlayTopo.objects.urban) : null,
  };

  const png = await renderPng(buildSvg(district, overlay));

  const msg = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
  const text = `${msg}\n\nDaily District No. ${num}\n${SITE_URL}`;
  const altText = 'Outline of today’s mystery congressional district. Play at daily-district.com';

  console.log(`Date ${date} → puzzle No. ${num} (${districtId}), image ${png.length} bytes`);
  console.log(`Tweet text:\n${text}\n`);

  if (process.env.DRY_RUN) {
    const out = path.join(DIR, 'daily-tweet-preview.png');
    fs.writeFileSync(out, png);
    console.log(`DRY_RUN — wrote ${out}, nothing posted.`);
    return;
  }

  const client = await xClient();

  const mediaId = await client.v2.uploadMedia(Buffer.from(png), { media_type: 'image/png' });
  try {
    await client.v2.createMediaMetadata(mediaId, { alt_text: { text: altText } });
  } catch (e) {
    console.warn('Alt text failed (non-fatal):', e.message || e);
  }
  const { data } = await client.v2.tweet({ text, media: { media_ids: [mediaId] } });
  console.log(`Posted: https://x.com/daily_district_/status/${data.id}`);
}

main().catch(err => { console.error(err); process.exit(1); });
