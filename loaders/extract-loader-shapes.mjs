// ============================================================
// loaders/extract-loader-shapes.mjs
//
// Generates the district outlines used by the district morph loader
// (loaders/district-loader-playground.html): the largest ring of each chosen
// district, projected into a 100×100 box and resampled by arc length to a
// fixed point count with consistent winding + a canonical start point (the
// topmost vertex). With every shape sharing the same point count and start,
// a runtime morph is a plain per-point lerp — no flubber needed.
//
// Usage:
//   node loaders/extract-loader-shapes.mjs                 # default rotation
//   node loaders/extract-loader-shapes.mjs IL-04,TX-35,... # custom rotation
//
// Output: loaders/loader-shapes.json, and the same JSON injected into
//         loaders/district-loader-playground.html between the
//         /*SHAPES-START*/ ... /*SHAPES-END*/ markers.
// ============================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { geoAlbersUsa, geoArea } from 'd3-geo';
import * as topojson from 'topojson-client';

const DIR = path.dirname(fileURLToPath(import.meta.url));   // loaders/
const ROOT = path.join(DIR, '..');
const N = 72;      // points per shape
const BOX = 100;   // normalized viewBox

// Default rotation: iconic gerrymanders + a couple of clean shapes for contrast.
const WANT = (process.argv[2] || 'IL-04,TX-35,MD-03,NC-06,TX-33,FL-05,OH-01,NJ-08,LA-06,PA-10').split(',');

const core = JSON.parse(fs.readFileSync(path.join(ROOT, 'districts-core.topojson'), 'utf8'));
const allDist = topojson.feature(core, core.objects.districts).features;

// MultiPolygon → the largest ring only (a single closed polygon morphs cleanly).
const largestRingFeature = f => {
  const g = f.geometry;
  if (g && g.type === 'MultiPolygon') {
    const largest = g.coordinates.reduce((best, poly) => {
      const a = geoArea({ type: 'Feature', geometry: { type: 'Polygon', coordinates: poly } });
      const b = geoArea({ type: 'Feature', geometry: { type: 'Polygon', coordinates: best } });
      return a > b ? poly : best;
    });
    return { type: 'Feature', geometry: { type: 'Polygon', coordinates: largest } };
  }
  return f;
};

const out = {};
for (const id of WANT) {
  const f = allDist.find(x => x.properties['state-district'] === id);
  if (!f) { console.warn('missing:', id); continue; }
  const ff = largestRingFeature(f);
  const proj = geoAlbersUsa().fitExtent([[4, 4], [BOX - 4, BOX - 4]], ff);
  let ring = ff.geometry.coordinates[0].map(c => proj(c)).filter(Boolean);

  // Consistent winding: force clockwise in screen coords (positive signed area).
  let area2 = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i], [x2, y2] = ring[(i + 1) % ring.length];
    area2 += x1 * y2 - x2 * y1;
  }
  if (area2 < 0) ring = ring.slice().reverse();

  // Canonical start: topmost point (min y, tie-break min x) — pairs of shapes
  // then correspond roughly point-for-point, which is what keeps the lerp sane.
  let s = 0;
  for (let i = 1; i < ring.length; i++)
    if (ring[i][1] < ring[s][1] - 1e-9 || (Math.abs(ring[i][1] - ring[s][1]) < 1e-9 && ring[i][0] < ring[s][0])) s = i;
  ring = ring.slice(s).concat(ring.slice(0, s));

  // Arc-length resample to exactly N points.
  const lens = [0];
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i], [x2, y2] = ring[(i + 1) % ring.length];
    lens.push(lens[i] + Math.hypot(x2 - x1, y2 - y1));
  }
  const total = lens[lens.length - 1];
  const pts = [];
  for (let k = 0; k < N; k++) {
    const t = (k / N) * total;
    let i = 0;
    while (i < ring.length - 1 && lens[i + 1] < t) i++;
    const seg = lens[i + 1] - lens[i] || 1;
    const u = (t - lens[i]) / seg;
    const [x1, y1] = ring[i], [x2, y2] = ring[(i + 1) % ring.length];
    pts.push([+(x1 + (x2 - x1) * u).toFixed(1), +(y1 + (y2 - y1) * u).toFixed(1)]);
  }
  out[id] = pts;
}

const ids = WANT.filter(id => out[id]);
const json = JSON.stringify({ ids, shapes: ids.map(id => out[id]) });
fs.writeFileSync(path.join(DIR, 'loader-shapes.json'), json);
console.log(`loader-shapes.json: ${ids.length} shapes × ${N} pts (${(json.length / 1024).toFixed(1)} KB)`);
console.log(`  ${ids.join(', ')}`);

// Inject into the playground between the shape markers so it stays standalone
// (openable via file:// — no fetch).
const pgPath = path.join(DIR, 'district-loader-playground.html');
if (fs.existsSync(pgPath)) {
  const html = fs.readFileSync(pgPath, 'utf8');
  const next = html.replace(/\/\*SHAPES-START\*\/[\s\S]*?\/\*SHAPES-END\*\//,
    () => `/*SHAPES-START*/${json}/*SHAPES-END*/`);
  if (next === html) console.warn('  ⚠ playground markers not found — not injected');
  else { fs.writeFileSync(pgPath, next); console.log('  injected into district-loader-playground.html'); }
}
