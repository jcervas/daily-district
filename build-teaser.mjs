// ============================================================
// build-teaser.mjs
// Renders the launch-date fields of the pre-launch teaser (index.html) from the
// single source of truth in puzzle-schedule.mjs — so the site and the puzzle
// schedule can never disagree on the date.
//
// It rewrites, in place, only the date-bearing text: <title>, the description /
// og:title / og:description meta tags, the teaser headline + sub, the how-to
// note, and the top-of-file comment. Everything else in index.html is untouched.
//
// If LAUNCH_ANNOUNCED is false, every date is replaced with dateless
// "Coming soon" copy — so an undecided launch date simply reads "coming soon".
//
// Usage:
//   node build-teaser.mjs                      # render from the constants
//   node build-teaser.mjs --check              # print what would change, write nothing
//   node build-teaser.mjs --epoch=2026-08-03   # preview a different date (no constant edit)
//   node build-teaser.mjs --announced=false    # preview the dateless "coming soon" copy
// ============================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LAUNCH_EPOCH, LAUNCH_ANNOUNCED } from './puzzle-schedule.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const arg = k => (process.argv.find(a => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=');
const CHECK = process.argv.includes('--check');

const epoch = arg('epoch') || LAUNCH_EPOCH;
const announced = arg('announced') ? arg('announced') !== 'false' : LAUNCH_ANNOUNCED;

// ── Format the epoch (UTC, so the calendar date never drifts a day) ──────────
const [y, m, d] = epoch.split('-').map(Number);
const dt = new Date(Date.UTC(y, m - 1, d));
const fmt = opts => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...opts }).format(dt);
const weekday = fmt({ weekday: 'long' });                          // "Monday"
const short   = fmt({ month: 'long', day: 'numeric', year: 'numeric' }); // "July 13, 2026"
const full    = `${weekday}, ${short}`;                            // "Monday, July 13, 2026"
const nbsp    = short.replace(/ /g, '&nbsp;');                     // "July&nbsp;13,&nbsp;2026"
const fullNbsp = `${weekday}, ${nbsp}`;

// ── Copy for both states ─────────────────────────────────────────────────────
const T = announced ? {
  title:    `Daily District — Launching ${short}`,
  ogTitle:  `Daily District — Launching ${short}`,
  metaDesc: `Daily District is a free daily game to identify all 435 U.S. House districts. Launching ${full}. Meanwhile, explore profiles of every congressional district.`,
  ogDesc:   `A free daily game to identify all 435 U.S. House districts. Launching ${full}.`,
  headline: `Launching ${fullNbsp}`,
  sub:      `A free daily game to identify all 435 U.S. House districts from their shape — geographic, map-based, and contextual clues, one puzzle a day. Check back on launch day.`,
  howto:    `The game launches ${full}.`,
  comment:  `until ${epoch}`,
} : {
  title:    `Daily District — Coming soon`,
  ogTitle:  `Daily District — Coming soon`,
  metaDesc: `Daily District is a free daily game to identify all 435 U.S. House districts. Coming soon. Meanwhile, explore profiles of every congressional district.`,
  ogDesc:   `A free daily game to identify all 435 U.S. House districts. Coming soon.`,
  headline: `Launching soon`,
  sub:      `A free daily game to identify all 435 U.S. House districts from their shape — geographic, map-based, and contextual clues, one puzzle a day. Check back soon.`,
  howto:    `The game launches soon.`,
  comment:  `until launch`,
};

// ── Rewrite the date-bearing fields (targets containers, not values → idempotent)
const file = path.join(DIR, 'index.html');
let html = fs.readFileSync(file, 'utf8');
const before = html;

const swaps = [
  [/(<title>)[^<]*(<\/title>)/, `$1${T.title}$2`],
  [/(<meta name="description" content=")[^"]*(")/, `$1${T.metaDesc}$2`],
  [/(<meta property="og:title" content=")[^"]*(")/, `$1${T.ogTitle}$2`],
  [/(<meta property="og:description" content=")[^"]*(")/, `$1${T.ogDesc}$2`],
  [/(<h1 class="teaser-headline">)[\s\S]*?(<\/h1>)/, `$1${T.headline}$2`],
  [/(<p class="teaser-sub">)[\s\S]*?(<\/p>)/, `$1${T.sub}$2`],
  [/(<span class="how-to-note">)[^<]*(<\/span>)/, `$1${T.howto}$2`],
  [/(TEMPORARY pre-launch teaser \()[^)]*(\))/, `$1${T.comment}$2`],
];

const missed = [];
for (const [re, repl] of swaps) {
  if (!re.test(html)) missed.push(re.source.slice(0, 40));
  html = html.replace(re, repl);
}

console.log(`Teaser date: ${announced ? full : '(unannounced — "Coming soon")'}${arg('epoch') ? '  [preview epoch]' : ''}`);
console.log(`  title:    ${T.title}`);
console.log(`  headline: ${T.headline.replace(/&nbsp;/g, ' ')}`);
console.log(`  how-to:   ${T.howto}`);
if (missed.length) console.warn('  ⚠ selectors that did not match:', missed.join(' | '));

if (html === before) { console.log(CHECK ? 'No changes needed.' : 'index.html already up to date.'); process.exit(0); }
if (CHECK) { console.log('\n--check: index.html would be updated (not written).'); process.exit(0); }
fs.writeFileSync(file, html);
console.log('\nindex.html updated.');
