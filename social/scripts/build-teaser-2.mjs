// ============================================================
// build-teaser-2.mjs   (Teaser #2 — "District Profile showcase")
//
// NOTE: distinct from build-teaser.mjs, which manages the launch-date text in
// the pre-launch index.html. THIS builds a standalone promo video.
//
// Teaser #2 is a fast-cut, standalone promo (for X) that showcases the District
// Profile feature — not gameplay: the wordmark, then a montage of several real
// districts (each drawing its boundary lines and flashing its profile cards —
// representative, 2024 vote, and a distinctive "hero" stat), then wordmark + CTA.
//
// Everything is generated from the same topojson + reps data the game uses, so
// the curated line-up below can be swapped freely.
//
// Usage:
//   node social/scripts/build-teaser-2.mjs                       # default line-up, 1:1 (for X)
//   node social/scripts/build-teaser-2.mjs --aspect=9x16         # 1:1 (default) | 9x16 | 16x9
//   node social/scripts/build-teaser-2.mjs --districts=IL-04,AK-01,NY-13,GA-05,WY-01
//
// Output: social/teaser-2/teaser-2.html  (or teaser-2-<aspect>.html)
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
const commas = n => Number(n).toLocaleString('en-US');
const round = (s, p = 1) => s.replace(/-?\d+\.?\d*/g, n => {
  const v = Math.round(parseFloat(n) * 10 ** p) / 10 ** p; return v.toString();
});

const ASPECTS = { '16x9': [1280, 720], '9x16': [1080, 1920], '1x1': [1080, 1080] };
const ASPECT = ASPECTS[arg('aspect')] ? arg('aspect') : '1x1';
const [STAGE_W, STAGE_H] = ASPECTS[ASPECT];

const STATE_NAMES = { AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming' };

// Curated line-up. Each entry's "hero" card highlights one distinctive dimension
// of that district's profile (shape, area, demographics, …). hero(p) receives
// the district's topojson properties.
const DEFAULT_LINEUP = [
  { id: 'IL-04', hero: p => ({ label: 'Shape', value: 'Irregular', sub: `Polsby–Popper ${p.polsby_popper}` }) },
  { id: 'NY-13', hero: p => ({ label: 'District Area', value: commas(p.area_sqmi), sub: `sq mi · ${Math.round(p.TotalPop/1000)}k people` }) },
  { id: 'AK-01', hero: p => ({ label: 'District Area', value: commas(p.area_sqmi), sub: 'sq mi · largest in the U.S.' }) },
  { id: 'GA-05', hero: p => ({ label: 'Demographics', value: `${Math.round(p.BlackPct*100)}% Black`, sub: 'majority-Black · Atlanta' }) },
  { id: 'WY-01', hero: p => ({ label: 'House seats', value: '1 of 435', sub: 'Wyoming — one at-large seat' }) },
];

const lineup = arg('districts')
  ? arg('districts').toUpperCase().split(',').map(s => { const [st, d] = s.split('-'); return { id: `${st}-${String(d).padStart(2,'0')}`, hero: null }; })
  : DEFAULT_LINEUP;

// ── Load data ────────────────────────────────────────────────────────────────
const core = JSON.parse(read('districts-core.topojson'));
const feats = topojson.feature(core, core.objects.districts).features;
const reps = JSON.parse(read('data/reps_out.json'));

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
const BOX = 560, PAD = 40;
const DISTRICTS = lineup.map(({ id, hero }) => {
  const d = feats.find(f => f.properties['state-district'] === id);
  if (!d) throw new Error(`No geometry for ${id}`);
  const p = d.properties, st = p.state, rep = reps[id] || { name: '—', party: '', partyCode: '' };
  const proj = geoAlbersUsa().fitExtent([[PAD, PAD], [BOX - PAD, BOX - PAD]], fitFeatureOf(d));
  const isD = p.Margin2024Pres > 0;
  const lean = `${isD ? 'D' : 'R'}+${Math.round(Math.abs(p.Margin2024Pres * 100))}`;
  const heroCard = (hero || (() => ({ label: 'District Area', value: commas(p.area_sqmi), sub: 'sq mi' })))(p);
  return {
    id, state: STATE_NAMES[st] || st, box: BOX, path: round(geoPath(proj)(d), 1),
    cards: [
      { label: 'Representative', value: rep.name, sub: rep.party },
      { label: '2024 Pres. Vote', value: `${lean}%`, color: isD ? '#2f6fd0' : '#C41230', sub: `${Math.round(p.DemPct2024Pres*100)}D / ${Math.round(p.RepPct2024Pres*100)}R` },
      heroCard,
    ],
  };
});

// ── Fonts + wordmark (shared with the promo) ─────────────────────────────────
const FONT_WEIGHTS = { SemiBold:600, Bold:700, ExtraBold:800, Black:900 };
const fontsCss = Object.entries(FONT_WEIGHTS).map(([name, weight]) => {
  const b64 = fs.readFileSync(path.join(DIR,'social','fonts',`Barlow-${name}.ttf`)).toString('base64');
  return `@font-face{font-family:'Barlow';font-weight:${weight};font-style:normal;font-display:block;`
       + `src:url(data:font/ttf;base64,${b64}) format('truetype');}`;
}).join('\n');
const wordmarkInner = read('wordmark.svg').replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>[\s\S]*$/, '').trim();

// ── Assemble ─────────────────────────────────────────────────────────────────
let html = read('social/teaser-2/teaser.template.html').replace('/*{{FONTS_CSS}}*/', fontsCss);
const repl = {
  WORDMARK: wordmarkInner, STAGE_W: String(STAGE_W), STAGE_H: String(STAGE_H), ASPECT,
  DISTRICTS_JSON: JSON.stringify(DISTRICTS),
};
for (const [k, v] of Object.entries(repl)) html = html.replaceAll(`{{${k}}}`, v);

const outDir = path.join(DIR, 'social', 'teaser-2');
fs.mkdirSync(path.join(outDir, 'out'), { recursive: true });   // ensure teaser-2/ (and out/) exist
const outName = ASPECT === '1x1' ? 'teaser-2.html' : `teaser-2-${ASPECT}.html`;
fs.writeFileSync(path.join(outDir, outName), html);
const leftover = html.match(/\{\{[A-Z_]+\}\}/g);
console.log(`${outName} written @ ${STAGE_W}×${STAGE_H} — ${DISTRICTS.map(d=>d.id).join(', ')} (${(html.length/1024).toFixed(0)} KB)`);
if (leftover) console.warn('  ⚠ unreplaced placeholders:', [...new Set(leftover)].join(', '));
