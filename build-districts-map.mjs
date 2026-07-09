#!/usr/bin/env node
/**
 * build-districts-map.mjs
 *
 * Produces districts-map.topojson — a small, property-stripped, simplified
 * geometry file used ONLY by the interactive map on /districts/. It is kept
 * separate from the game's districts-core.topojson on purpose: the game plans
 * to stop shipping district geometry (fingerprint hardening), so the public
 * browse map owns its own lightweight copy and won't block that.
 *
 * Source: districts-core.topojson (districts + states objects).
 * Output: districts-map.topojson  (objects: districts {sd,st}, states {st})
 *
 * Requires mapshaper on PATH (npm i -g mapshaper). Run: node build-districts-map.mjs
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SRC = 'districts-core.topojson';
const OUT = 'districts-map.topojson';
const SIMPLIFY = '8%'; // visvalingam; keep-shapes so no district collapses

const t = JSON.parse(readFileSync(SRC, 'utf8'));

// Strip to two objects with only the ids we need.
const stripped = {
  type: 'Topology', transform: t.transform, arcs: t.arcs,
  objects: {
    districts: {
      type: 'GeometryCollection',
      geometries: t.objects.districts.geometries.map((g) => ({
        type: g.type, arcs: g.arcs,
        properties: { sd: g.properties['state-district'], st: g.properties.state },
      })),
    },
    states: {
      type: 'GeometryCollection',
      geometries: t.objects.states.geometries.map((g) => ({
        type: g.type, arcs: g.arcs, properties: { st: g.properties.state },
      })),
    },
  },
};

const tmp = mkdtempSync(join(tmpdir(), 'ddmap-'));
const tmpIn = join(tmp, 'in.topojson');
writeFileSync(tmpIn, JSON.stringify(stripped));

try {
  execFileSync('mapshaper', [
    tmpIn,
    '-simplify', 'visvalingam', SIMPLIFY, 'keep-shapes',
    '-o', OUT, 'format=topojson', 'quantization=1e5',
  ], { stdio: ['ignore', 'ignore', 'inherit'] });
} catch (err) {
  console.error('mapshaper failed — install it with `npm i -g mapshaper`.');
  throw err;
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

const out = JSON.parse(readFileSync(OUT, 'utf8'));
const nd = out.objects.districts.geometries.length;
const ns = out.objects.states.geometries.length;
const missing = out.objects.districts.geometries.filter((g) => !g.arcs || !g.arcs.length).length;
console.log(`Wrote ${OUT}: ${nd} districts, ${ns} states, ${missing} with no geometry.`);
if (nd !== 435 || missing) process.exitCode = 1;
