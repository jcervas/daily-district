// ============================================================
// build-teaser-1.mjs
// Assembles the self-contained kinetic promo video page
// (teaser-1.html) from teaser-1/teaser.template.html for ANY district.
//
// Everything district-specific — the silhouette, the zoomed state + district
// for the "pick" scene, the clue/hint values, and the win-screen stat cards —
// is generated straight from the same topojson + reps data the game uses, so
// swapping districts is a one-flag change.
//
// Usage:
//   node build-teaser-1.mjs                     # default district (below)
//   node build-teaser-1.mjs --district=CA-19    # a specific district
//
// Inputs:  districts-core.topojson (geometry + stats), districts-map.topojson
//          (simplified state/district outlines), data/reps_out.json (rep names),
//          wordmark.svg, social/fonts/Barlow-*.ttf, social/teaser-1/teaser.template.html
// Output:  social/teaser-1/teaser-1[-<aspect>].html
//          (render to MP4 with render-mp4.mjs)
// ============================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { geoAlbersUsa, geoPath, geoArea } from 'd3-geo';
import * as topojson from 'topojson-client';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const read = f => fs.readFileSync(path.join(DIR, f), 'utf8');
const arg = k => (process.argv.find(a => a.startsWith(`--${k}=`)) || '').split('=')[1];

// ── Aspect ratio ────────────────────────────────────────────────────────────
const ASPECTS = { '16x9':[1280,720], '9x16':[1080,1920], '1x1':[1080,1080] };
const ASPECT = ASPECTS[arg('aspect')] ? arg('aspect') : '16x9';
const [STAGE_W, STAGE_H] = ASPECTS[ASPECT];

// ── Which district? (accept CA-19 or CA-9 → CA-09) ──────────────────────────
const rawId = (arg('district') || 'CA-19').toUpperCase();
const [ST, DNUM] = rawId.split('-');
const DIST_ID = `${ST}-${String(DNUM).padStart(2, '0')}`;

const round = (s, p = 1) => s.replace(/-?\d+\.?\d*/g, n => {
  const v = Math.round(parseFloat(n) * 10 ** p) / 10 ** p; return v.toString();
});
const commas = n => n.toLocaleString('en-US');

// ── Reference data ──────────────────────────────────────────────────────────
const STATE_NAMES = { AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming' };
// Contiguous-state adjacency (for the hot/cold "narrowed set")
const ADJ = { AL:['FL','GA','MS','TN'],AZ:['CA','CO','NV','NM','UT'],AR:['LA','MS','MO','OK','TN','TX'],CA:['AZ','NV','OR'],CO:['AZ','KS','NE','NM','OK','UT','WY'],CT:['MA','NY','RI'],DE:['MD','NJ','PA'],FL:['AL','GA'],GA:['AL','FL','NC','SC','TN'],ID:['MT','NV','OR','UT','WA','WY'],IL:['IN','IA','KY','MO','WI'],IN:['IL','KY','MI','OH'],IA:['IL','MN','MO','NE','SD','WI'],KS:['CO','MO','NE','OK'],KY:['IL','IN','MO','OH','TN','VA','WV'],LA:['AR','MS','TX'],ME:['NH'],MD:['DE','PA','VA','WV'],MA:['CT','NH','NY','RI','VT'],MI:['IN','OH','WI'],MN:['IA','ND','SD','WI'],MS:['AL','AR','LA','TN'],MO:['AR','IL','IA','KS','KY','NE','OK','TN'],MT:['ID','ND','SD','WY'],NE:['CO','IA','KS','MO','SD','WY'],NV:['AZ','CA','ID','OR','UT'],NH:['ME','MA','VT'],NJ:['DE','NY','PA'],NM:['AZ','CO','OK','TX','UT'],NY:['CT','MA','NJ','PA','VT'],NC:['GA','SC','TN','VA'],ND:['MN','MT','SD'],OH:['IN','KY','MI','PA','WV'],OK:['AR','CO','KS','MO','NM','TX'],OR:['CA','ID','NV','WA'],PA:['DE','MD','NJ','NY','OH','WV'],RI:['CT','MA'],SC:['GA','NC'],SD:['IA','MN','MT','ND','NE','WY'],TN:['AL','AR','GA','KY','MS','MO','NC','VA'],TX:['AR','LA','NM','OK'],UT:['AZ','CO','ID','NV','NM','WY'],VT:['MA','NH','NY'],VA:['KY','MD','NC','TN','WV'],WA:['ID','OR'],WV:['KY','MD','OH','PA','VA'],WI:['IA','IL','MI','MN'],WY:['CO','ID','MT','NE','SD','UT'] };

// ── Load geometry + stats ───────────────────────────────────────────────────
const core = JSON.parse(read('districts-core.topojson'));
const coreFeat = topojson.feature(core, core.objects.districts).features;
const dFeat = coreFeat.find(f => f.properties['state-district'] === DIST_ID);
if (!dFeat) throw new Error(`No geometry for ${DIST_ID}`);
const P = dFeat.properties;
const stateCount = coreFeat.filter(f => f.properties.state === ST).length;
const reps = JSON.parse(read('data/reps_out.json'));
const rep = reps[DIST_ID] || { name: '—', party: '', partyCode: '' };

// ── Silhouette (largest polygon), fit to a 560 box ──────────────────────────
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
const SIL_BOX = 560, silPad = 26;
const silProj = geoAlbersUsa().fitExtent([[silPad,silPad],[SIL_BOX-silPad,SIL_BOX-silPad]], fitFeatureOf(dFeat));
const SIL_PATH = round(geoPath(silProj)(dFeat), 1);

// ── Pick scene: zoomed state outline + internal borders + this district ─────
const map = JSON.parse(read('districts-map.topojson'));
const mapDistricts = map.objects.districts;
const mapStates = map.objects.states;
const stateFeat = topojson.feature(map, mapStates).features.find(f => f.properties.st === ST);
const distMapFeat = topojson.feature(map, mapDistricts).features.find(f => f.properties.sd === DIST_ID);
const PW = 470, PH = 350, pPad = 20;
const pickProj = geoAlbersUsa().fitExtent([[pPad,pPad],[PW-pPad,PH-pPad]], stateFeat);
const gp = geoPath(pickProj);
const STATE_PATH = round(gp(stateFeat), 1);
const DIST_PATH  = round(gp(distMapFeat), 1);
const stateInner = round(gp(topojson.mesh(map, mapDistricts, (a,b) => a!==b && a.properties.st===ST && b.properties.st===ST)), 1);
const [pinX, pinY] = gp.centroid(distMapFeat);
const PIN_LEFT = (pinX / PW * 100).toFixed(1);
const PIN_TOP  = (pinY / PH * 100).toFixed(1);

// ── Derived copy ────────────────────────────────────────────────────────────
const isD = P.Margin2024Pres > 0;
const marginPct = Math.abs(P.Margin2024Pres * 100).toFixed(1);
const LEAN = `${isD ? 'D' : 'R'}+${marginPct}`;
const LEAN_COLOR = isD ? '#2f6fd0' : '#C41230';
const demP = Math.round(P.DemPct2024Pres * 100), repP = Math.round(P.RepPct2024Pres * 100);
const VOTE_SPLIT = `${demP}D / ${repP}R`;
// demographics: leading group + next two
const groups = [['White',P.WhitePct],['Hispanic',P.HispanicPct],['Black',P.BlackPct],['Asian',P.AsianPct]]
  .map(([k,v]) => [k, Math.round(v*100)]).sort((a,b) => b[1]-a[1]);
const DEMO_TOP = `${groups[0][1]}% ${groups[0][0]}`;
const DEMO_SUB = `${groups[1][1]}% ${groups[1][0]} · ${groups[2][1]}% ${groups[2][0]}`;
// hot/cold narrowed set = state + its neighbours
const LIVE = [ST, ...(ADJ[ST] || [])];
const NARROW_COUNT = LIVE.length;
const AREA = commas(P.area_sqmi);
const PERIM = commas(P.perimeter_mi);
const INCOME = '$' + commas(P.income);

// ── Fonts → @font-face base64 ───────────────────────────────────────────────
const FONT_WEIGHTS = { SemiBold:600, Bold:700, ExtraBold:800, Black:900 };
const fontsCss = Object.entries(FONT_WEIGHTS).map(([name, weight]) => {
  const b64 = fs.readFileSync(path.join(DIR,'social','fonts',`Barlow-${name}.ttf`)).toString('base64');
  return `@font-face{font-family:'Barlow';font-weight:${weight};font-style:normal;font-display:block;`
       + `src:url(data:font/ttf;base64,${b64}) format('truetype');}`;
}).join('\n');

const wordmarkInner = read('wordmark.svg')
  .replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>[\s\S]*$/, '').trim();

// ── Assemble ─────────────────────────────────────────────────────────────────
const repl = {
  FONTS_CSS: fontsCss, WORDMARK: wordmarkInner,
  STAGE_W: String(STAGE_W), STAGE_H: String(STAGE_H), ASPECT,
  SIL_BOX: String(SIL_BOX), SIL_PATH,
  PICK_W: String(PW), PICK_H: String(PH), STATE_PATH, DIST_PATH, STATE_INNER: stateInner,
  PIN_LEFT, PIN_TOP, DIST_NUM: String(parseInt(DNUM, 10)),
  DIST_ID, STATE_ABBR: ST, STATE_NAME: STATE_NAMES[ST] || ST, STATE_COUNT: String(stateCount),
  AREA, PERIM, INCOME, LEAN, LEAN_COLOR, VOTE_SPLIT, DEMO_TOP, DEMO_SUB,
  REP_NAME: rep.name, REP_PARTY: rep.party,
  NARROW_COUNT: String(NARROW_COUNT), LIVE_JSON: JSON.stringify(LIVE),
};
let html = read('social/teaser-1/teaser.template.html').replace('/*{{FONTS_CSS}}*/', fontsCss);
for (const [k, v] of Object.entries(repl)) html = html.replaceAll(`{{${k}}}`, v);

const outName = ASPECT === '16x9' ? 'teaser-1.html' : `teaser-1-${ASPECT}.html`;
fs.writeFileSync(path.join(DIR, 'social', 'teaser-1', outName), html);
const leftover = html.match(/\{\{[A-Z_]+\}\}/g);
console.log(`${outName} written for ${DIST_ID} @ ${STAGE_W}×${STAGE_H} (${(html.length/1024).toFixed(0)} KB)`);
if (leftover) console.warn('  ⚠ unreplaced placeholders:', [...new Set(leftover)].join(', '));
