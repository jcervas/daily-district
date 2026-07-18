#!/usr/bin/env node
/**
 * build-districts-map.mjs
 *
 * Produces the geometry the interactive map uses:
 *
 *  1. districts-map.topojson — small, property-stripped, heavily simplified
 *     (8%) national file. Loaded up front for the whole-country view. Kept
 *     separate from the game's districts-core.topojson on purpose (the game
 *     plans to drop district geometry for fingerprint hardening).
 *
 *  2. districts-detail/<st>.topojson — one full-detail (unsimplified) file per
 *     state, loaded on demand when the map zooms into that state so district
 *     boundaries are crisp up close. Source: districts.topojson (full detail).
 *
 * Requires mapshaper on PATH (npm i -g mapshaper). Run: node scripts/build-districts-map.mjs
 */
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Anchor everything to the repo root (script lives in scripts/) so this works
// regardless of the cwd it's invoked from.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'districts-core.topojson');
const OUT = join(ROOT, 'districts-map.topojson');
const DETAIL_SRC = join(ROOT, 'districts.topojson');   // full-detail source (gitignored)
const DETAIL_DIR = join(ROOT, 'districts-detail');
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

// ---- per-state full-detail slices -----------------------------------------
if (!existsSync(DETAIL_SRC)) {
  console.warn(`\nSkipping ${DETAIL_DIR}/ — ${DETAIL_SRC} not found (gitignored full-detail source).`);
} else {
  const full = JSON.parse(readFileSync(DETAIL_SRC, 'utf8'));
  const states = [...new Set(full.objects.districts.geometries.map((g) => g.properties.state))].sort();
  rmSync(DETAIL_DIR, { recursive: true, force: true });
  mkdirSync(DETAIL_DIR, { recursive: true });
  let biggest = 0, biggestSt = '';
  for (const st of states) {
    const dest = join(DETAIL_DIR, `${st.toLowerCase()}.topojson`);
    execFileSync('mapshaper', [
      DETAIL_SRC,
      '-target', 'districts',
      '-filter', `this.properties.state===${JSON.stringify(st)}`,
      '-each', 'sd=this.properties["state-district"], st=this.properties.state',
      '-filter-fields', 'sd,st',
      '-o', dest, 'format=topojson', 'quantization=1e5',
    ], { stdio: ['ignore', 'ignore', 'ignore'] });
    const kb = readFileSync(dest).length;
    if (kb > biggest) { biggest = kb; biggestSt = st; }
  }
  console.log(`Wrote ${DETAIL_DIR}/ — ${states.length} states, largest ${biggestSt} ${(biggest / 1024).toFixed(0)} KB.`);
}
