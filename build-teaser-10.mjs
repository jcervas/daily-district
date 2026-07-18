// ============================================================
// build-teaser-10.mjs   (Teaser #10 — "Sign up & win")
//
// The pre-launch giveaway hook: the wordmark, then kinetic words flying AT
// the viewer ("SIGN UP." / "WIN PRIZES." / "BE FIRST."), a giveaway card
// (gift icon — sign up for a chance to win prizes), a launch-alert card
// (bell icon — be first to know when District #1 launches), then wordmark
// + CTA. ~17 s. 1:1 by default.
//
// All copy and timings live in the template — this builder just inlines
// fonts + wordmark and stamps the stage size.
//
// Usage:
//   node build-teaser-10.mjs                 # 1:1
//   node build-teaser-10.mjs --aspect=9x16   # 1x1 (default) | 9x16 | 16x9
//
// Output: social/teaser-10/teaser-10.html  (or teaser-10-<aspect>.html)
//         render to MP4 with render-mp4.mjs (see social/README.md)
// ============================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const read = f => fs.readFileSync(path.join(DIR, f), 'utf8');
const arg = k => (process.argv.find(a => a.startsWith(`--${k}=`)) || '').split('=')[1];

const ASPECTS = { '16x9': [1280, 720], '9x16': [1080, 1920], '1x1': [1080, 1080] };
const ASPECT = ASPECTS[arg('aspect')] ? arg('aspect') : '1x1';
const [STAGE_W, STAGE_H] = ASPECTS[ASPECT];

const FONT_WEIGHTS = { SemiBold:600, Bold:700, ExtraBold:800, Black:900 };
const fontsCss = Object.entries(FONT_WEIGHTS).map(([name, weight]) => {
  const b64 = fs.readFileSync(path.join(DIR,'social','fonts',`Barlow-${name}.ttf`)).toString('base64');
  return `@font-face{font-family:'Barlow';font-weight:${weight};font-style:normal;font-display:block;`
       + `src:url(data:font/ttf;base64,${b64}) format('truetype');}`;
}).join('\n');
const wordmarkInner = read('wordmark.svg').replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>[\s\S]*$/, '').trim();

let html = read('social/teaser-10/teaser.template.html').replace('/*{{FONTS_CSS}}*/', fontsCss);
const repl = { WORDMARK: wordmarkInner, STAGE_W: String(STAGE_W), STAGE_H: String(STAGE_H), ASPECT };
for (const [k, v] of Object.entries(repl)) html = html.replaceAll(`{{${k}}}`, v);

const outDir = path.join(DIR, 'social', 'teaser-10');
fs.mkdirSync(path.join(outDir, 'out'), { recursive: true });
const outName = ASPECT === '1x1' ? 'teaser-10.html' : `teaser-10-${ASPECT}.html`;
fs.writeFileSync(path.join(outDir, outName), html);
const leftover = html.match(/\{\{[A-Z_]+\}\}/g);
console.log(`${outName} written @ ${STAGE_W}×${STAGE_H} (${(html.length/1024).toFixed(0)} KB)`);
if (leftover) console.warn('  ⚠ unreplaced placeholders:', [...new Set(leftover)].join(', '));
