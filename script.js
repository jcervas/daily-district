// ============================================================
//  District Guess — script.js
// ============================================================
// ============================================================
//  GAME CONSTANTS
// ============================================================
const MAX_GUESSES = 6;
const STORAGE_PREFIX = 'districtguess_';
const HOW_TO_SEEN_KEY      = STORAGE_PREFIX + 'howToSeen';
const WELCOME_SEEN_KEY     = STORAGE_PREFIX + 'welcomeSeen';
const SETTINGS_SEEN_KEY    = STORAGE_PREFIX + 'settingsSeen';
const FEEDBACK_PROMPTED_AT = STORAGE_PREFIX + 'feedbackAt'; // games-played count when last prompted
const PUSH_PROMPTED_AT = STORAGE_PREFIX + 'pushPromptedAt'; // games-played count when last shown the push opt-in
const PUSH_DECISION_KEY = STORAGE_PREFIX + 'pushDecision';  // 'granted' | 'deferred' | 'dismissed'
// D3 US reference map coordinate space (viewBox dimensions)
const REF_VB_W = 960;
const REF_VB_H = 400;
// Bump on every push. Keep in sync with the ?v= cache-bust params in index.html.
const VERSION_NUMBER = '2.13.4';
const GAME_VERSION = (() => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `Beta ${VERSION_NUMBER} (${y}-${m}-${day} ${h}:${min})`;
})();
document.querySelectorAll('.beta-version').forEach(el => { el.textContent = VERSION_NUMBER; });

let DISTRICT_FIT_MARGIN = 0.90;
try { Object.defineProperty(window, 'DISTRICT_FIT_MARGIN', {
  get: () => DISTRICT_FIT_MARGIN, set: v => { DISTRICT_FIT_MARGIN = v; },
}); } catch (_) {}
// Looser margin used only when fitting to the REMAINING districts (after a wrong
// guess / locate press). The fit uses marker-dot centers, so the dots + badges sit
// at the bbox edges — extra padding keeps them off the edge. Lower = more breathing
// room. Tweak live with window.DISTRICT_ACTIVE_FIT_MARGIN.
let DISTRICT_ACTIVE_FIT_MARGIN = 0.74;
try { Object.defineProperty(window, 'DISTRICT_ACTIVE_FIT_MARGIN', {
  get: () => DISTRICT_ACTIVE_FIT_MARGIN, set: v => { DISTRICT_ACTIVE_FIT_MARGIN = v; },
}); } catch (_) {}

let DISTRICT_FIT_MARGIN_ANSWER = 0.50;
try { Object.defineProperty(window, 'DISTRICT_ACTIVE_FIT_MARGIN', {
  get: () => DISTRICT_FIT_MARGIN_ANSWER, set: v => { DISTRICT_FIT_MARGIN_ANSWER = v; },
}); } catch (_) {}

// ============================================================
//  LOOKUP TABLES
// ============================================================
const STATE_NAMES = {
  AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',
  CO:'Colorado',CT:'Connecticut',DE:'Delaware',FL:'Florida',GA:'Georgia',
  HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',
  KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',
  MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',
  NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',
  NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',
  OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',
  SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',
  VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',
  DC:'Washington D.C.'
};
// Primary time zone per state (some states span multiple zones — using dominant zone)
const STATE_TIMEZONES = {
  ME:'Eastern',NH:'Eastern',VT:'Eastern',MA:'Eastern',RI:'Eastern',CT:'Eastern',
  NY:'Eastern',NJ:'Eastern',PA:'Eastern',DE:'Eastern',MD:'Eastern',DC:'Eastern',
  VA:'Eastern',WV:'Eastern',NC:'Eastern',SC:'Eastern',GA:'Eastern',FL:'Eastern',
  OH:'Eastern',IN:'Eastern',MI:'Eastern',KY:'Eastern',TN:'Central',
  AL:'Central',MS:'Central',AR:'Central',LA:'Central',MO:'Central',
  IL:'Central',WI:'Central',MN:'Central',IA:'Central',ND:'Central',
  SD:'Central',NE:'Central',KS:'Central',OK:'Central',TX:'Central',
  MT:'Mountain',ID:'Mountain',WY:'Mountain',CO:'Mountain',UT:'Mountain',
  AZ:'Mountain',NM:'Mountain',NV:'Pacific',WA:'Pacific',OR:'Pacific',CA:'Pacific',
  AK:'Alaska',HI:'Hawaii–Aleutian'
};

// Adjacency: which states share a land border.
// AK and HI have no contiguous neighbors (empty array).
// Used for the hot/cold elimination mechanic:
//   correct IS adjacent → eliminate guessed + everything NOT in its neighbors
//   correct NOT adjacent → eliminate guessed + all of its neighbors
const STATE_ADJACENCY = {
  AL: ['FL','GA','MS','TN'],
  AK: ['WA'],
  AZ: ['CA','CO','NM','NV','UT'],
  AR: ['LA','MO','MS','OK','TN','TX'],
  CA: ['AZ','HI','NV','OR'],
  CO: ['AZ','KS','NE','NM','OK','UT','WY'],
  CT: ['MA','NY','RI'],
  DC: ['MD','VA'],
  DE: ['MD','NJ','PA'],
  FL: ['AL','GA'],
  GA: ['AL','FL','NC','SC','TN'],
  HI: ['CA'],
  ID: ['MT','NV','OR','UT','WA','WY'],
  IL: ['IN','IA','KY','MO','WI'],
  IN: ['IL','KY','MI','OH'],
  IA: ['IL','MN','MO','NE','SD','WI'],
  KS: ['CO','MO','NE','OK'],
  KY: ['IL','IN','MO','OH','TN','VA','WV'],
  LA: ['AR','MS','TX'],
  ME: ['NH'],
  MD: ['DC','DE','PA','VA','WV'],
  MA: ['CT','NH','NY','RI','VT'],
  MI: ['IN','OH','WI'],
  MN: ['IA','ND','SD','WI'],
  MS: ['AL','AR','LA','TN'],
  MO: ['AR','IL','IA','KS','KY','NE','OK','TN'],
  MT: ['ID','ND','SD','WY'],
  NE: ['CO','IA','KS','MO','SD','WY'],
  NV: ['AZ','CA','ID','OR','UT'],
  NH: ['MA','ME','VT'],
  NJ: ['DE','NY','PA'],
  NM: ['AZ','CO','OK','TX','UT'],
  NY: ['CT','MA','NJ','PA','VT'],
  NC: ['GA','SC','TN','VA'],
  ND: ['MN','MT','SD'],
  OH: ['IN','KY','MI','PA','WV'],
  OK: ['AR','CO','KS','MO','NM','TX'],
  OR: ['CA','ID','NV','WA'],
  PA: ['DE','MD','NJ','NY','OH','WV'],
  RI: ['CT','MA'],
  SC: ['GA','NC'],
  SD: ['IA','MN','MT','ND','NE','WY'],
  TN: ['AL','AR','GA','KY','MO','MS','NC','VA'],
  TX: ['AR','LA','NM','OK'],
  UT: ['AZ','CO','ID','NM','NV','WY'],
  VT: ['MA','NH','NY'],
  VA: ['DC','KY','MD','NC','TN','WV'],
  WA: ['AK','ID','OR'],
  WV: ['KY','MD','OH','PA','VA'],
  WI: ['IL','IA','MI','MN'],
  WY: ['CO','ID','MT','NE','SD','UT'],
};

// ============================================================
//  SVG ICON SYSTEM  (no emojis anywhere in the UI)
// ============================================================
// Each entry is the inner path/shape markup for a 24×24 viewBox.
const ICON_PATHS = {
  question:    `<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12" y2="17.01"/>`,
  barchart:    `<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>`,
  moon:        `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>`,
  sun:         `<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>`,
  clock:       `<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>`,
  checkCircle: `<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>`,
  xCircle:     `<path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>`,
  lock:        `<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>`,
  share:       `<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>`,
  target:      `<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>`,
  flame:       `<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>`,
  snowflake:   `<line x1="12" y1="2" x2="12" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="20" y1="16" x2="4" y2="8"/><line x1="20" y1="8" x2="4" y2="16"/><line x1="16" y1="20" x2="8" y2="4"/><line x1="8" y1="20" x2="16" y2="4"/>`,
  ruler:       `<path d="M21.3 8.7 8.7 21.3c-1 1-2.5 1-3.4 0l-2.6-2.6c-1-1-1-2.5 0-3.4L15.3 2.7c1-1 2.5-1 3.4 0l2.6 2.6c1 1 1 2.5 0 3.4z"/><path d="m7.5 10.5 3 3"/><path d="m10.5 7.5 3 3"/><path d="m13.5 4.5 3 3"/>`,
  building:    `<rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/>`,
  dollar:      `<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>`,
  people:      `<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>`,
  mappin:      `<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>`,
  maximize:    `<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>`,
  minimize:    `<path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>`,
  flag:        `<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>`,
  message:     `<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>`,
};

/** Returns an SVG element string for the named icon. */
function svgIcon(name, cls = 'icon') {
  const inner = ICON_PATHS[name] || '';
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
}

// Free clue (district area in sq mi), occupying slot 0 of the fixed MAX_GUESSES-card hint
// bar (see clientRevealClues) — revealed before any guess, without growing a 7th slot. The
// live daily gets this folded server-side into `clues[0]` (the `today`/`guess` edge
// functions compute it from puzzles.census, since the answer is still secret at that
// point). Archive puzzles get their full census object unconditionally (past days aren't
// secret), so this mirrors that same server-side logic client-side via clientRevealClues
// rather than adding a redundant round-trip.
function freeClueFromCensus(census) {
  const area = Math.round(Number(census && census.area_sqmi));
  if (!Number.isFinite(area) || area <= 0) return null;
  return { icon: 'ruler', label: 'District area', value: `${area.toLocaleString('en-US')} sq mi` };
}

// State boundary SVG cache
const statesvgCache = new Map();
async function getStateSvg(stateAbbr) {
  const lowerAbbr = stateAbbr.toLowerCase();
  if (statesvgCache.has(lowerAbbr)) {
    return statesvgCache.get(lowerAbbr);
  }
  try {
    const response = await fetch(`state-svgs/${lowerAbbr}.svg`);
    if (!response.ok) return null;
    const svg = await response.text();
    statesvgCache.set(lowerAbbr, svg);
    return svg;
  } catch (e) {
    return null;
  }
}

// State-level ACS clue data (QuickFacts-style), loaded once from state-acs.json.
// Keyed by state abbr: { pop, whiteNH_pct, foreignBorn_pct, medianRent,
// bachPlus_pct, meanTravelTime, landAreaSqMi, ... }. Built by build-map.sh from
// createMaps/acs_by_state.R.
let _stateAcs = null;
let _stateAcsPromise = null;
async function getStateAcs(stateAbbr) {
  if (!_stateAcs) {
    if (!_stateAcsPromise) {
      _stateAcsPromise = fetch('state-acs.json')
        .then(r => (r.ok ? r.json() : {}))
        .then(j => { _stateAcs = j; return j; })
        .catch(() => { _stateAcs = {}; return {}; });
    }
    await _stateAcsPromise;
  }
  return stateAbbr ? (_stateAcs[stateAbbr] || null) : _stateAcs;
}

// Built at load time from GeoJSON: { 'TX': ['01','02',...], 'WY': ['01'], ... }
let stateDistrictMap = {};

// District facts — Fact 0 is always visible; one more unlocks per wrong guess.
// fn receives districtDataFor(todayDistrict) = {state, district}
const FACT_DEFS = [
  // State-level hints first — narrow the state before drilling into district specifics
  {
    icon: 'building',
    label: 'State delegation size',
    fn: d => {
      const count = stateDistrictMap[d.state]?.length || 1;
      if (count === 1) return 'At-large: only congressional district in its state';
      return `One of ${count} congressional districts in its state`;
    }
  },
  {
    icon: 'clock',
    label: 'Time zone',
    fn: d => STATE_TIMEZONES[d.state] ? `${STATE_TIMEZONES[d.state]} Time` : '—'
  },
  {
    icon: 'ruler',
    label: 'State land area',
    fn: async d => {
      const s = await getStateAcs(d.state);
      if (!s) return '—';
      const mi = s.landAreaSqMi;
      const band = mi <  10000 ? 'Small state'
                 : mi <  50000 ? 'Mid-size state'
                 : mi < 100000 ? 'Large state'
                 : 'Very large state';
      return `${band} — ~${mi.toLocaleString()} sq mi`;
    }
  },
  {
    icon: 'people',
    label: 'Foreign-born residents (state)',
    fn: async d => {
      const s = await getStateAcs(d.state);
      return s ? `${s.foreignBorn_pct}% born outside the U.S.` : '—';
    }
  },
  {
    icon: 'dollar',
    label: 'Median gross rent (state)',
    fn: async d => {
      const s = await getStateAcs(d.state);
      return s ? `${formatCurrency(s.medianRent)}/mo` : '—';
    }
  },
  {
    icon: 'clock',
    label: 'Average commute (state)',
    fn: async d => {
      const s = await getStateAcs(d.state);
      return s ? `${s.meanTravelTime} min to work` : '—';
    }
  },
  {
    icon: 'building',
    label: 'College-educated (state)',
    fn: async d => {
      const s = await getStateAcs(d.state);
      return s ? `${s.bachPlus_pct}% hold a bachelor's degree or higher` : '—';
    }
  },
  // District-level hints
  {
    icon: 'ruler',
    label: 'District size',
    fn: () => {
      if (!todayDistrict) return '—';
      const areaMi2 = Math.round(todayDistrict.properties.area_sqmi || 0);
      if (areaMi2 <   300) return `Very compact — under 300 sq mi`;
      if (areaMi2 <  2000) return `Small: ~${areaMi2.toLocaleString()} sq mi`;
      if (areaMi2 < 15000) return `Mid-size: ~${areaMi2.toLocaleString()} sq mi`;
      return `Large: ~${areaMi2.toLocaleString()} sq mi`;
    }
  },
  {
    icon: 'flag',
    label: '2024 Presidential vote',
    fn: () => {
      if (!todayDistrict) return '—';
      const margin  = todayDistrict.properties.Margin2024Pres;
      if (margin == null || isNaN(+margin)) return 'No data';
      const pctDem  = Math.round((todayDistrict.properties.DemPct2024Pres || 0) * 100);
      const pctRep  = Math.round((todayDistrict.properties.RepPct2024Pres || 0) * 100);
      const absMar  = Math.abs(+margin * 100).toFixed(1);
      const m = +margin;
      const tag = m >  0.30 ? 'Strongly Democratic'
                : m >  0.10 ? 'Likely Democratic'
                : m >  0.05 ? 'Leans Democratic'
                : m < -0.30 ? 'Strongly Republican'
                : m < -0.10 ? 'Likely Republican'
                : m < -0.05 ? 'Leans Republican'
                : 'Competitive';
      const side = m > 0 ? `D+${absMar}%` : m < 0 ? `R+${absMar}%` : 'Even';
      return `${tag} — ${side} (${pctDem}D / ${pctRep}R)`;
    }
  },
  {
    icon: 'dollar',
    label: 'Median household income',
    fn: async d => fetchCensus(d, 'income')
  },
  {
    icon: 'people',
    label: 'Largest racial/ethnic group',
    fn: async d => fetchCensus(d, 'plurality')
  },
  // State name last — most revealing state-level clue
  {
    icon: 'mappin',
    label: 'State',
    fn: d => STATE_NAMES[d.state] || d.state
  },
];

// Map tile progression — label-free throughout (labels give away city/state names).
// Stage 0: outline only on a plain background (0 wrong guesses)
// Stage 1: outline only, plain background (1–3 wrong guesses) — no landscape imagery yet
// Stage 3: ESRI satellite/terrain imagery revealed — only AFTER the 4th wrong guess
//          (or at game over). Labeled tiles are never revealed.

// ============================================================
//  STATE
// ============================================================
let districts           = [];
let districtPoints      = {};  // state-district key → [lon, lat] inner point

// Manual overrides for districts where the computed inner point lands in water.
const POINT_OVERRIDES = {};
let topoRoads              = null;  // FeatureCollection from TopoJSON roads layer
// Debug logging — set window._debugGame = true in console to enable.
// Recorded events are in window._gameLog; call copy(window._gameLog.join('\n')) to export.
window._gameLog = [];
function dbg(...args) {
  if (!window._debugGame) return;
  const msg = `[${new Date().toISOString().slice(11,23)}] ${args.join(' ')}`;
  window._gameLog.push(msg);
  console.log('%c[DG]', 'color:#C41230;font-weight:bold', ...args);
}

let topoUrban              = null;  // FeatureCollection from TopoJSON urban layer
let topoCounties           = null;  // FeatureCollection of county boundary lines
let districtGameOverTransform = null; // saved game-over zoom transform for fit-toggle button
let topoStates          = {};    // state abbr → merged state Feature for clean outline drawing
let rawTopo             = null;  // raw TopoJSON topology — kept for topojson.mesh() calls
let adjMap              = new Map(); // state-district key → string[] of adjacent keys
let currentMapStage     = 0;     // highest stage reached; preserved across re-renders
// Tunable: fraction of the viewport the district/state zoom bbox fills (lower = more
// padding around it, higher = tighter). Used by every district-fit zoomToBBox call.
// Exposed on window so you can tweak it live in the console (e.g. DISTRICT_FIT_MARGIN = 0.7)
// then trigger a re-zoom (press the Fit button / make a guess).
let todayDistrict       = null;   // feature object
let todayKey            = '';     // 'YYYY-MM-DD'
let map, terrainLayer, satelliteLayer, streetLayer, districtLayer;
let usRefMap            = null;   // US states reference map SVG element
let usRefMapGroup       = null;   // main <g> inside the SVG (holds all paths)
let usRefLayers         = {};     // abbr → D3 path selection
let usRefCallouts       = {};     // abbr → { group, circle, line, text, anchorX, anchorY, offX, offY } for small-state callouts
let usRefZoom           = null;   // d3.zoom instance
let usRefSvgSel         = null;   // d3 selection of the SVG element
let usRefProjection     = null;   // d3.geoAlbersUsa() instance for inner-point bbox on ref map
let _usRefFullFitTransform = null; // full-US zoom (all 435 pts) saved once; used by fit-toggle zoom-out
let usRefPathGen        = null;   // reusable geoPath generator (set after projection.fitSize)
let eliminatedStates    = new Set(); // all states removed from valid set (wrong guess + adjacency)
let districtZoomBehavior    = null;   // saved d3.zoom instance for district tiles map
let districtUserZoomed      = false;  // true once user manually pans/zooms district map
let districtSavedTransform  = null;   // zoom transform preserved across rebuilds
let districtStateFitTransform = null; // full-state inner-point fit; used by fit-toggle second press
let _districtProjection    = null;   // AlbersUSA projection from most recent district ctx build
let _districtCssScale      = 1;      // cssScale from most recent district ctx build
let _districtDensityScale  = 1;      // density factor (>1 shrinks tiles+collision for dense states)
let _districtStateFitK     = 1;      // zoom scale at the full-state fit (density eases→1 as you zoom past it)
let _districtPathGen       = null;   // d3.geoPath from most recent district ctx build
let _districtStateFeatures = null;   // all features for the current state
let _districtW             = REF_VB_W; // viewBox width from most recent district ctx build
let _districtH             = REF_VB_H; // viewBox height from most recent district ctx build
let _usRefW                = REF_VB_W; // viewBox width of the US reference map SVG
let _usRefH                = REF_VB_H; // viewBox height of the US reference map SVG
let _usRefRO               = null;   // ResizeObserver on #us-ref-map (rebuilds on size change)
let districtSimulation     = null;   // active force simulation — updated on zoom for centroid pull
let _gameStarted        = false;   // true after welcome is dismissed; guards clue/guess DOM rendering
let guessCount          = 0;
let guessHistory        = [];     // [{text, correct}]
let cluesRevealed       = 0;      // how many text clues are showing
let correctStateGuessed = false;  // true once any guess has the right state
let timerInterval       = null;
let elapsedSeconds      = 0;
let timerRunning        = false;
let gameOver            = false;
let lastGameWon         = false;  // outcome of the most recently finished game (for confetti gating)
let _resultConfettiFired = false; // confetti fires once per game, the first time results are viewed
let _gameoverCelebrated = false; // district spark+firework celebration fires once, on first leaving the result modal
let _resultAdPushed = false;     // AdSense slot is push()'d once, only after it's visible (0-width push fails permanently)
let _sideAdsPushed  = false;     // desktop side rails push()'d once, only when wide enough to be displayed
let gamePhase            = 'state';  // 'state' | 'district' | 'gameover'
let _districtBuiltState  = null;     // stateAbbr currently rendered in the tiles SVG
let _districtSvgSel      = null;     // D3 selection of the tiles SVG (cached for zoom reuse)
let _districtPathSnap    = null;     // pathGen cached from last build (for reveal zoom)
let _districtStateFSnap  = null;     // stateFeatures cached from last build (for reveal zoom)
let _gameOverTime        = 0;        // Date.now() when endGame() was called (confetti gate)
let _gameOverAnimsCallback  = null;   // deferred: pulse/shake/confetti, fired after reveal circle collapses
let _goZoom         = null;   // gameover map zoom behavior
let _goZoomInitial  = null;   // gameover map initial fit transform (district)
let _goZoomState    = null;   // gameover map state-level fit transform
let _tileZoomInAnimating    = false;  // true during 700ms entry zoom-in so handler skips simulation re-runs
let username            = '';
let replayCount         = 0;      // increments each "Play Again" to pick a fresh district
let isArchiveGame       = false;  // true while playing a past puzzle from the archive — unofficial, not saved or counted
let _dailySnapshot      = null;   // daily game state captured when an archive launches, for no-reload return

// ── Server-authoritative daily ────────────────────────────────────────────────
// The daily puzzle's shape, clues, guess validation and once-per-day all come from
// the backend (the answer is never known to the client until the game ends). Signed-in
// players get a persisted, leaderboard-recorded game; anyone else plays anonymously
// (nothing recorded server-side). Archive replays of PAST puzzles validate locally
// (past answers are public, replays don't count).
let serverPuzzle  = null;   // last /today response: { puzzleNumber, geometry, clues, cluesTotal, result, answer }
let serverState   = null;   // the correctly-guessed state abbr (known only after a correct state guess / completion)
let serverAnswer  = null;   // revealed answer once completed: { districtId, state, census } (drives the game-over census panel)
// Server-backed archive replay. When set, we're replaying a PAST puzzle whose full
// data (answer + state shapes + clues) was fetched from the `archive` endpoint, so
// guesses validate locally (unofficial — no /guess, no saved result). Shape:
// { date, puzzleNumber, answer:{districtId,state,census}, clues:{state:[],district:[]} }.
let serverArchive = null;

// Temporary playtest instrumentation: capture a client-side error to telemetry so
// failures hidden behind try/catch (e.g. the game-over reveal) are observable
// server-side without the player's console. Safe to remove after the playtest.
function reportClientError(where, err) {
  try {
    window.DistrictBackend?.logTelemetry?.('error', {
      puzzleDate: (typeof todayKey !== 'undefined' ? todayKey : null),
      payload: {
        where,
        message: (err && (err.message || String(err))) || 'unknown',
        stack: (err && err.stack ? String(err.stack) : '').slice(0, 2000),
        phase: (typeof gamePhase !== 'undefined' ? gamePhase : null),
      },
    });
  } catch (_) { /* never disrupt */ }
}
if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => reportClientError('window_error', e.error || e.message));
  window.addEventListener('unhandledrejection', (e) => reportClientError('unhandled_rejection', e.reason));
}

// The player's current game settings (theme, hard mode, confirm-selection). Logged
// to telemetry so we can see which options people actually use and direct effort
// accordingly. `theme` is the stored preference: 'dark' | 'light' | 'system'.
function currentGameSettings() {
  return {
    hardMode: localStorage.getItem('districtguess_hardMode') === '1',
    theme: localStorage.getItem('districtguess_theme') || 'system',
    confirmSelection: localStorage.getItem('districtguess_confirmMode') === '1',
  };
}
// reason: 'snapshot' (passive, once per session) | 'change' (a toggle was flipped).
function reportSettings(reason) {
  try {
    window.DistrictBackend?.logTelemetry?.('settings', { payload: { reason, ...currentGameSettings() } });
  } catch (_) { /* best-effort; never disrupt */ }
}

// Build the redacted "mystery" feature from server geometry — no identity.
function serverMysteryFeature(geometry) {
  return { type: 'Feature', geometry, properties: {} };
}

// Anonymous (not-signed-in) play: the server records nothing for these players, so
// the browser is the only place the game state lives. We send the prior guesses with
// each /guess call and the server recomputes correctness statelessly.
let isAnonymousPlayer = false;

// Live ticker for the "new district at midnight ET" countdown on the game-over screen.
let _nextDistrictTimer = null;

// Seconds remaining until the next puzzle rolls over — midnight in America/New_York,
// the same timezone the server uses to pick the daily puzzle. DST-safe: we read the
// current wall-clock time in ET and count down to the next ET midnight.
function secondsUntilEasternMidnight() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour12: false,
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date());
  const get = (t) => parseInt(parts.find(p => p.type === t)?.value || '0', 10);
  let h = get('hour'); if (h === 24) h = 0; // some runtimes emit '24' at midnight
  const elapsed = h * 3600 + get('minute') * 60 + get('second');
  return Math.max(0, 86400 - elapsed);
}

// Drives the game-over countdown label. When it hits zero a fresh puzzle is live, so
// nudge the player to reload.
function startNextDistrictCountdown() {
  stopNextDistrictCountdown();
  // May drive more than one countdown label: the game-over screen and the result
  // modal's archive "today's district" block both carry .go-next-countdown.
  if (!document.querySelector('.go-next-countdown')) return;
  const tick = () => {
    const s = secondsUntilEasternMidnight();
    if (s <= 0) {
      document.querySelectorAll('.gameover-next-sub').forEach(sub => {
        sub.innerHTML = 'A new district is ready &middot; <a href="#" class="gameover-reload-link">refresh to play</a>';
      });
      document.querySelectorAll('.gameover-reload-link').forEach(a =>
        a.addEventListener('click', (e) => { e.preventDefault(); location.reload(); }));
      stopNextDistrictCountdown();
      return;
    }
    const hh = String(Math.floor(s / 3600)).padStart(2, '0');
    const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    document.querySelectorAll('.go-next-countdown').forEach(l => { l.textContent = `${hh}:${mm}:${ss}`; });
  };
  tick();
  _nextDistrictTimer = setInterval(tick, 1000);
}

function stopNextDistrictCountdown() {
  if (_nextDistrictTimer) { clearInterval(_nextDistrictTimer); _nextDistrictTimer = null; }
}

// Prior guesses in the shape the server expects for anonymous validation. Returns
// undefined for signed-in players (the server uses their persisted result instead).
function anonGuessOpts() {
  if (!isAnonymousPlayer) return {};
  return { history: guessHistory.map(g => ({ phase: g.phase, value: g.text })) };
}

// Server bootstrap: load states-only shapes + district names, fetch /today, and
// either restore the in-progress/finished game or start fresh. The answer's
// identity is never present client-side until the server reveals it.
async function initServer() {
  todayKey = getTodayKey();
  username = getUsername();

  // Archive replay is server-backed in server mode (the `archive` endpoint serves
  // past puzzles' shapes), so its entry points stay available.

  // 1. States-only topojson + district-names.json (no district geometry shipped).
  try {
    const [statesTopo, names] = await Promise.all([
      fetch('./states.topojson?v=2').then(r => { if (!r.ok) throw new Error(`states ${r.status}`); return r.json(); }),
      fetch('./district-names.json').then(r => { if (!r.ok) throw new Error(`names ${r.status}`); return r.json(); }),
    ]);
    rawTopo    = statesTopo;
    topoStates = {};
    topojson.feature(statesTopo, statesTopo.objects.states).features.forEach(f => {
      if (f.properties.state) topoStates[f.properties.state] = f;
    });
    stateDistrictMap = names;   // { state: ['01','02', …] }
    districts        = [];      // no district shapes client-side until a state is unlocked
    districtPoints   = {};
    adjMap           = new Map();
  } catch (err) {
    console.error('Server asset load failed:', err);
    alert(`Failed to load map data (${err.message}). Please refresh.`);
    return;
  }

  // 2. Today's puzzle from the server (answer withheld).
  let resp;
  try {
    // ?dev=1 asks the server to reset today's result so the puzzle can be replayed.
    // The reset is gated to allowlisted test accounts server-side; harmless for anyone else.
    const devReset = new URLSearchParams(location.search).get('dev') === '1';
    // Anonymous completed games live only in the browser. Pass the saved guess history so
    // the server can verify completion and return the FRESH answer + clues (reflecting any
    // same-day data change) instead of our stale local snapshot. Ignored for signed-in.
    resp = await window.DistrictBackend.today({ reset: devReset, history: loadAnonGame()?.guessHistory });
  } catch (err) {
    console.error('today() failed:', err);
    alert("Could not load today's puzzle. Please refresh.");
    return;
  }
  serverPuzzle  = resp;
  // Trust the server's view of whether this caller is signed in.
  isAnonymousPlayer = !!resp.anonymous;
  // Stamp the authoritative puzzle number on the welcome splash (server is the source
  // of truth — no client-side date epoch).
  if (resp.puzzleNumber != null) {
    const numLine = document.getElementById('welcome-puzzle-num');
    if (numLine) numLine.textContent = `No. ${resp.puzzleNumber}`;
  }
  todayDistrict = serverMysteryFeature(resp.geometry);

  initMap();
  setTimeout(() => { if (map) map.invalidateSize(); }, 50);
  // The US reference map is a heavy synchronous D3/topojson build. Building it here
  // would land on the still-spinning welcome loader globe and freeze it (a canvas
  // can't repaint while the main thread is blocked). It isn't visible until the
  // splash is dismissed, so we defer it: restore paths build it via ensureUSRefMap()
  // below, and fresh play builds it once the loader globe has been replaced (see the
  // _initPromise.then block).

  // Decorative overlays (roads + urban, counties) — also needed in server mode for
  // the game-over and district maps. Lazy-loaded, non-blocking.
  loadDecorativeOverlays();

  // 3. Restore an in-progress or finished game from the server result.
  const r = resp.result;
  if (r && ((r.guess_history && r.guess_history.length) || r.completed)) {
    await restoreServerGame(r, resp.answer);
    return;
  }

  // 3b. Anonymous players have no server result — resume their locally-saved game so a
  // refresh continues (or shows the finished result) instead of restarting the daily.
  if (isAnonymousPlayer) {
    const saved = loadAnonGame();
    if (saved && saved.date === resp.date &&
        ((saved.guessHistory && saved.guessHistory.length) || saved.gameOver)) {
      // If the server verified our completion it returns the FRESH answer + full clues
      // (current census/clue data); prefer those over the local snapshot. In-progress or
      // unverified games keep their locally-cached answer/clues.
      const fresh = !!resp.answer;
      serverPuzzle.clues      = (fresh ? resp.clues : saved.clues) || [];
      serverPuzzle.cluesTotal = (fresh ? resp.cluesTotal : saved.cluesTotal) || MAX_GUESSES;
      await restoreServerGame(
        { guess_history: saved.guessHistory, guesses: saved.guessCount,
          seconds: saved.elapsedSeconds, completed: saved.gameOver },
        fresh ? resp.answer : saved.answer
      );
      return;
    }
  }

  // 4. Fresh game.
  renderDistrict(todayDistrict);
  renderClues();
  renderGuessHistory();
  document.getElementById('guess-remaining').textContent = `${MAX_GUESSES} guesses`;
}

// Fetch + inject the guessed state's district shapes (gated server-side). Populates
// `districts`, `adjMap`, `districtPoints` for that one state so the existing
// district-phase map/tiles work. The answer among them is still unknown to the client.
let _stateShapesInflight = null;   // { state, promise } — dedupes the prefetch vs the awaited call
async function loadServerStateShapes(state) {
  if (districts.some(f => f.properties.state === state)) return;
  // The correct-guess handler prefetches during the 650ms celebration hold; when
  // enterServerDistrictPhase awaits shortly after, reuse that in-flight request.
  if (_stateShapesInflight?.state === state) return _stateShapesInflight.promise;
  const promise = _loadServerStateShapesInner(state);
  _stateShapesInflight = { state, promise };
  try { return await promise; } finally { _stateShapesInflight = null; }
}
async function _loadServerStateShapesInner(state) {
  const data = await window.DistrictBackend.stateShapes(state);
  (data.districts || []).forEach(d => {
    const feat = { type: 'Feature', geometry: d.geometry, properties: { state: d.state, 'state-district': d.districtId } };
    districts.push(feat);
    adjMap.set(d.districtId, d.adj || []);
    // Inner point for tile layout — centroid of the largest sub-polygon.
    const geom = d.geometry;
    let pt;
    if (geom && geom.type === 'MultiPolygon' && geom.coordinates.length) {
      const largest = geom.coordinates.reduce((a, b) =>
        d3.geoArea({ type: 'Polygon', coordinates: a }) >= d3.geoArea({ type: 'Polygon', coordinates: b }) ? a : b);
      pt = d3.geoCentroid({ type: 'Feature', geometry: { type: 'Polygon', coordinates: largest } });
    } else {
      pt = d3.geoCentroid(feat);
    }
    districtPoints[d.districtId] = pt;
  });
}

// Did a (wrong) district guess come back hot (adjacent to the answer)? In server
// mode the flag is stored on the guess; legacy falls back to the adjacency graph.
function guessWasAdjacent(guess, answerNeighbors) {
  if (typeof guess.adjacent === 'boolean') return guess.adjacent;
  return !!(answerNeighbors && answerNeighbors.has(guess.text));
}

// Mark a state correct (server-validated): reveal the state, fetch its shapes,
// and enter the district phase. `instant` skips the fade for restore.
async function enterServerDistrictPhase(state, instant = false) {
  serverState = state;
  todayDistrict.properties.state = state;        // safe: the player guessed it
  correctStateGuessed = true;
  try { await loadServerStateShapes(state); }
  catch (err) { console.error('stateShapes() failed:', err); }

  // Single-map model: no pre-build/cross-fade needed. lockStateDropdown() → showDistrictD3Map()
  // builds the district render directly into the shared SVG and zooms into the state.
  lockStateDropdown(state, instant);
  if (!instant) saveGameState();   // persist the solved state for anon refresh-resume
}

// Rebuild the board from the server result (in-progress or finished). Replays the
// stored guess history; fetches state shapes if a state was solved or the game is done.
async function restoreServerGame(result, answer) {
  _gameStarted   = true;
  // Give the still-spinning welcome loader globe a couple of frames to actually paint
  // before the heavy synchronous US-ref-map build below blocks the main thread — same
  // reasoning as the fresh-game path (see the _initPromise.then() block), which defers
  // ensureUSRefMap() the same way. Without this yield, a returning player (this path)
  // sees the globe freeze on its very first frame instead of animating at all.
  // Timeout-guarded: rAF never fires for a backgrounded/hidden tab, and this restore is
  // otherwise load-bearing (it's what actually shows the player's game), so it must not
  // hang forever waiting for frames that may never come.
  await new Promise((resolve) => {
    let framesLeft = 2;
    const timer = setTimeout(resolve, 500);
    const tick = () => { if (--framesLeft > 0) requestAnimationFrame(tick); else { clearTimeout(timer); resolve(); } };
    requestAnimationFrame(tick);
  });
  // Restoring an in-progress/finished game renders state eliminations onto the US
  // reference map, so it must exist before we proceed (the loader-window build was
  // deferred). Idempotent — no-op if already built.
  ensureUSRefMap();
  guessHistory   = (result.guess_history || []).map(g => ({
    text: String(g.text), correct: !!g.correct, phase: g.phase, adjacent: !!g.adjacent,
  }));
  guessCount     = result.guesses != null ? result.guesses
                   : guessHistory.filter(g => !g.correct).length;
  elapsedSeconds = result.seconds || 0;
  gameOver       = !!result.completed;

  const tvEl  = document.getElementById('timer-value');        if (tvEl)  tvEl.textContent  = formatTime(elapsedSeconds);
  const tvElI = document.getElementById('timer-value-inline'); if (tvElI) tvElI.textContent = formatTime(elapsedSeconds);

  // The solved/answer state (if any).
  const correctStateGuess = guessHistory.find(g => g.phase === 'state' && g.correct);
  const knownState = (answer && answer.state) || (correctStateGuess && correctStateGuess.text) || null;

  // Reconstruct state eliminations from the wrong state guesses (public adjacency only).
  eliminatedStates = new Set();
  const wrongGuessedSoFar = new Set();
  guessHistory.filter(g => g.phase === 'state' && !g.correct).forEach(g => {
    wrongGuessedSoFar.add(g.text);
    eliminatedStates.add(g.text);
    const nbrs = STATE_ADJACENCY[g.text] || [];
    if (g.adjacent) {
      const neighborSet = new Set(nbrs);
      for (const s of Object.keys(stateDistrictMap)) {
        if (s !== knownState && !neighborSet.has(s)) eliminatedStates.add(s);
      }
    } else {
      for (const n of nbrs) if (n !== knownState) eliminatedStates.add(n);
    }
  });

  // Reveal answer identity if completed.
  if (gameOver && answer) {
    serverAnswer = answer;
    todayDistrict.properties.state = answer.state;
    todayDistrict.properties['state-district'] = answer.districtId;
  }

  if (knownState) {
    await loadServerStateShapes(knownState);
    serverState = knownState;
    todayDistrict.properties.state = knownState;
  }

  const wrongCount = guessHistory.filter(g => !g.correct).length;
  applyMapStage(wrongCount, gameOver);
  renderDistrict(todayDistrict);
  renderGuessHistory();
  renderClues();

  if (knownState) {
    correctStateGuessed = true;
    lockStateDropdown(knownState, true);   // renders the district map (game-over highlight when gameOver)
  }

  if (gameOver) {
    cluesRevealed = FACT_DEFS.length;
    stopTimer();
    lastGameWon = guessHistory.some(g => g.phase === 'district' && g.correct);
    renderClues();
    showResult(lastGameWon, false);
    showGameoverModal();   // also renders the District Profile into the game-over card
    // Returning from an archive via "Today's Results" → land on the daily result modal.
    let openRes = false;
    try { openRes = sessionStorage.getItem('dd_open_result') === '1'; if (openRes) sessionStorage.removeItem('dd_open_result'); } catch (_) {}
    if (openRes) openResultModal();
  }
}

// ============================================================
//  SERVER-BACKED ARCHIVE (replay a past puzzle, unofficial)
// ============================================================
// Reveal clues the same way the server does (phase-local), but client-side for the
// archive replay (no /guess round-trip — we have the answer). Mirrors revealClues()
// in the `guess`/`today` edge functions; keep them in sync.
// Mirror of revealClues() in the today/guess edge functions: a fixed MAX_GUESSES-card
// hint bar. All hidden at the start except slot 0, which is the always-on free clue
// (when present) — the guess-earned deck then only fills the remaining MAX_GUESSES-1
// slots, so total card count always matches MAX_GUESSES rather than growing a 7th
// slot. One reveal per guess — state clues while the state is unsolved, district clues
// once it's solved. Returns { unlocked, total }.
function clientRevealClues(clues, history, completed, freeClue) {
  const cl = clues || {};
  const stateDeck    = Array.isArray(cl) ? cl : (Array.isArray(cl.state) ? cl.state : []);
  const districtDeck = Array.isArray(cl) ? [] : (Array.isArray(cl.district) ? cl.district : []);
  const stateSolved  = history.some(g => g.phase === 'state' && g.correct);
  const wrongState   = history.filter(g => g.phase === 'state' && !g.correct).length;
  // A correct-state pick is a free transition and doesn't count toward MAX_GUESSES
  // (see the guess counter elsewhere) — reveals must use the same count, or the clue
  // bar runs one card ahead of what the displayed "guesses used" actually earned.
  const guessesUsed = history.filter(g => !(g.phase === 'state' && g.correct)).length;

  const realSlots = freeClue ? MAX_GUESSES - 1 : MAX_GUESSES;
  const nReveal = completed ? realSlots : Math.min(guessesUsed, realSlots);

  let unlocked;
  if (!stateSolved) {
    unlocked = stateDeck.slice(0, Math.min(nReveal, stateDeck.length));
  } else {
    const nState = Math.min(wrongState, stateDeck.length);
    const nDistrict = Math.max(0, Math.min(nReveal - nState, districtDeck.length));
    unlocked = [...stateDeck.slice(0, nState), ...districtDeck.slice(0, nDistrict)];
  }
  if (freeClue) unlocked = [freeClue, ...unlocked];
  return { unlocked, total: MAX_GUESSES };
}

// Build a /guess-shaped response locally for an archive guess (we know the answer).
// Lets submit*Server() + process*Server() be reused unchanged for archive replays.
function archiveLocalGuess(phase, value) {
  const ans = serverArchive.answer;
  value = String(value).toUpperCase();
  let correct, adjacent;
  if (phase === 'state') {
    correct  = value === ans.state;
    adjacent = (STATE_ADJACENCY[value] || []).includes(ans.state);
  } else {
    correct  = value === ans.districtId;
    adjacent = new Set(adjMap.get(ans.districtId) || []).has(value);
  }
  const hist = [...guessHistory.map(g => ({ phase: g.phase, correct: g.correct })), { phase, correct }];
  // A correct state pick is a free transition — not counted toward MAX_GUESSES.
  const guesses   = hist.filter(g => !(g.phase === 'state' && g.correct)).length;
  const won       = phase === 'district' && correct;
  const completed = won || guesses >= MAX_GUESSES;
  const { unlocked, total: cluesTotal } = clientRevealClues(serverArchive.clues, hist, completed, freeClueFromCensus(ans.census));
  return {
    correct, adjacent, phase, guesses, guessesLeft: MAX_GUESSES - guesses,
    completed, won,
    clues: unlocked,
    cluesTotal,
    state: (phase === 'state' && correct) || completed ? ans.state : null,
    answer: completed ? ans : null,
  };
}

// Inject a fetched archive puzzle's state shapes into districts/adjMap/districtPoints
// so the district phase renders (same shape the `state-shapes` endpoint returns).
function injectArchiveShapes(data) {
  (data.districts || []).forEach(d => {
    const feat = { type: 'Feature', geometry: d.geometry, properties: { state: d.state, 'state-district': d.districtId } };
    districts.push(feat);
    adjMap.set(d.districtId, d.adj || []);
    const geom = d.geometry;
    let pt;
    if (geom && geom.type === 'MultiPolygon' && geom.coordinates.length) {
      const largest = geom.coordinates.reduce((a, b) =>
        d3.geoArea({ type: 'Polygon', coordinates: a }) >= d3.geoArea({ type: 'Polygon', coordinates: b }) ? a : b);
      pt = d3.geoCentroid({ type: 'Feature', geometry: { type: 'Polygon', coordinates: largest } });
    } else {
      pt = d3.geoCentroid(feat);
    }
    districtPoints[d.districtId] = pt;
  });
}

// Pure-CSS (well, inline-SVG) tiled globe loader markup (used everywhere EXCEPT the
// welcome screen, which keeps the canvas TiledGlobe). Pointy-top hexagons laid out by
// hand (CSS Grid can't do the offset-row hex tiling) as SVG <polygon>s in a 0-100
// viewBox, so each tile can carry a real stroke — a clip-path <div> can only fake an
// outline via drop-shadow, which gets painted over by whichever neighbor tile happens to
// be later in DOM order, leaving the outline patchy/invisible. A polygon's stroke is part
// of its own paint, so it's never occluded by a sibling. Each tile's animation-delay is
// derived from its distance to the top-right corner (+ jitter) so the fill sweeps across
// like a forming globe. A second hex layer (same positions) sits on top as the "shade": a
// grayscale vignette — tiles near the rim get more opacity than tiles near the center —
// replacing the old smooth radial-gradient shade with texture that matches the tile grid.
// Tartan thread palette (CMU reds + gold, from globe.js's TiledGlobe): ~16% of tiles
// take a random thread colour, the rest stay Carnegie red — the flecks that read as
// tartan.
const GLOBE_THREADS = ['#c41230', '#a00a28', '#820519', '#6e0415', '#dc506e', '#f0788c', '#FDB515'];
const GLOBE_THREAD_PROB = 0.16;
function globeLoader(size = 96) {
  const cols = 25;                          // hex centers per row
  const spacingX = 100 / cols;              // % between hex centers, same row
  const r = spacingX / Math.sqrt(3);        // hex circumradius, in viewBox units
  const rDraw = r * 0.86;                   // shrink so adjacent hexes leave a visible gap
  const spacingY = 1.5 * r;                 // % between rows (pointy-top overlap)

  const hexPoints = (cx, cy) => {
    let pts = '';
    for (let i = 0; i < 6; i++) {
      const ang = (-90 + i * 60) * Math.PI / 180;
      pts += `${(cx + rDraw * Math.cos(ang)).toFixed(2)},${(cy + rDraw * Math.sin(ang)).toFixed(2)} `;
    }
    return pts.trim();
  };

  let tiles = '', shade = '', rowIdx = 0;
  for (let y = -20; y <= 120; y += spacingY, rowIdx++) {
    const xOff = (rowIdx % 2) ? spacingX / 2 : 0;
    for (let x = -20 - spacingX; x <= 120 + spacingX; x += spacingX) {
      const cx = x + xOff;
      const pts = hexPoints(cx, y);
      // Fill sweep: tiles closer to the top-right corner start further into their
      // (negative-delayed) animation cycle, same diagonal-wipe effect as before.
      const u = cx / 100, v = y / 100;
      const sweep = (1 - u) + v;
      const delay = -(0.55 * sweep + Math.random() * 0.12);
      const fill = Math.random() < GLOBE_THREAD_PROB
        ? GLOBE_THREADS[(Math.random() * GLOBE_THREADS.length) | 0] : 'var(--red)';
      tiles += `<polygon points="${pts}" style="fill:${fill};animation-delay:${delay.toFixed(3)}s"/>`;

      // Shade: opacity ramps from 0 near the globe's center to ~0.6 at the rim —
      // a vignette built from the same hex cells instead of a smooth gradient.
      const dx = cx - 50, dy = y - 50;
      const dist = Math.hypot(dx, dy) / 60;
      const op = Math.max(0, Math.min(1, (dist - 0.25) / 0.55)) * 0.6;
      if (op > 0.01) shade += `<polygon points="${pts}" style="opacity:${op.toFixed(3)}"/>`;
    }
  }
  return `<span class="globe-loader" role="status" aria-label="Loading" style="--size:${size}px;">`
    + `<svg class="tiles" viewBox="0 0 100 100" preserveAspectRatio="none">${tiles}</svg>`
    + `<svg class="shade" viewBox="0 0 100 100" preserveAspectRatio="none">${shade}</svg>`
    + `</span>`;
}

// Full-screen loader (the pure-CSS tiled globe) shown while a heavy build runs with no
// other UI up — e.g. an archive fetch + map build. Pure CSS, so it keeps animating
// through the synchronous build (no canvas/main-thread freeze).
function showBuildLoader(text = 'Loading...') {
  if (document.getElementById('build-loader')) return;
  const ov = document.createElement('div');
  ov.id = 'build-loader';
  ov.className = 'build-loader';
  const letters = [...text].map((c, i) => `<span style="--i:${i}">${c}</span>`).join('');
  ov.innerHTML = `<div class="welcome-loading-container">`
    + globeLoader(96)
    + `<div class="welcome-loading-text" aria-label="Loading">${letters}</div>`
    + `</div>`;
  document.body.appendChild(ov);
}
function hideBuildLoader() { document.getElementById('build-loader')?.remove(); }

// Launch a server-backed archive replay for a past date. Fetches the puzzle, sets up
// the board the same way as the daily, but with local validation (isArchiveGame).
async function startServerArchive(date, num, label) {
  showBuildLoader();   // CSS loader animates through the whole fetch + build (no freeze)
  let data;
  try { data = await window.DistrictBackend.archivePuzzle(date); }
  catch (err) { hideBuildLoader(); console.error('archive load failed:', err); alert('Could not load that archive puzzle.'); return; }

  // Snapshot the daily so we can return to it WITHOUT a reload. The resets below replace
  // these globals with fresh objects (new arrays/Sets), so the snapshot keeps the daily's
  // references intact and untouched by archive play. Capture once: an archive→archive jump
  // must preserve the ORIGINAL daily, so only snapshot when leaving a non-archive game.
  if (!isArchiveGame) {
    _dailySnapshot = {
      serverPuzzle, serverAnswer, serverState,
      guessHistory, guessCount, elapsedSeconds,
      gameOver, correctStateGuessed, currentMapStage, gamePhase,
      eliminatedStates, districts, districtPoints, adjMap,
      todayDistrict, lastGameWon, cluesRevealed,
    };
  }

  // Reset to a fresh, unofficial archive session.
  isArchiveGame      = true;
  serverArchive      = { date, puzzleNumber: data.puzzleNumber, answer: { districtId: data.districtId, state: data.state, census: data.census }, clues: data.clues || {} };
  {
    const { unlocked, total } = clientRevealClues(data.clues || {}, [], false, freeClueFromCensus(data.census));
    serverPuzzle = { clues: unlocked, cluesTotal: total };
  }
  serverAnswer       = serverArchive.answer;   // drives the game-over census panel
  serverState        = null;
  guessHistory       = [];
  guessCount         = 0;
  elapsedSeconds     = 0;
  gameOver           = false;
  correctStateGuessed = false;
  // Reset the map-imagery stage — it's a persistent "highest stage reached" ratchet, so
  // without this a fresh archive launched after finishing the daily (stage 3) would jump
  // straight to satellite on the first guess instead of revealing stages like the daily.
  currentMapStage    = 0;
  // Reset to the state phase or zoomUSRefMapToValid skips the national-fit branch
  // (which requires gamePhase === 'state') and the ref map opens zoomed-in/stale
  // when an archive game is launched after finishing the daily.
  gamePhase          = 'state';
  eliminatedStates   = new Set();
  _gameStarted       = true;
  districts          = [];
  districtPoints     = {};
  adjMap             = new Map();
  injectArchiveShapes(data);
  todayDistrict      = serverMysteryFeature(data.geometry);

  // Swap modals → game view.
  ['archive-modal', 'result-modal', 'welcome-modal'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
  destroyGameoverDiv();
  document.getElementById('archive-badge')?.classList.remove('hidden');
  document.getElementById('game-section')?.remove();
  buildGameSection();

  // buildGameSection() replaced the game DOM, so the previous game's ref-map SVG node
  // is detached. Null the ref-map/tile globals or initUSRefMap() bails on its
  // `if (usRefMap) return` guard and the reference map never rebuilds (blank map).
  usRefMap = null; usRefMapGroup = null; usRefLayers = {}; usRefCallouts = {};
  usRefZoom = null; usRefSvgSel = null;

  initMap();
  setTimeout(() => { if (map) map.invalidateSize(); }, 50);
  // Two rAFs so flex layout settles before initUSRefMap measures #us-ref-map — a
  // single frame can measure a 0-size container right after the rebuild, which makes
  // the projection fail to fit the screen.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    // initUSRefMap now builds across frames (loader globe keeps spinning); pull the loader
    // only once its last stage finishes, plus one frame so the finished map paints first.
    initUSRefMap(() => requestAnimationFrame(() => hideBuildLoader()));
    if (map) map.invalidateSize();
  }));

  renderDistrict(todayDistrict);
  renderClues();
  renderGuessHistory();
  document.getElementById('guess-remaining').textContent = `${MAX_GUESSES} guesses`;
}

// Return from an archive to today's daily WITHOUT a reload, by restoring the snapshot
// taken when the archive launched and rebuilding the daily game-over screen. If the
// snapshot is missing for any reason, fall back to a reload (re-fetches today's state).
// `openResult` lands on the daily result modal (the "Today's Results" path).
function returnToTodayDaily(openResult = false) {
  const s = _dailySnapshot;
  if (!s) {
    try { if (openResult) sessionStorage.setItem('dd_open_result', '1'); } catch (_) {}
    location.reload();
    return;
  }
  isArchiveGame      = false;
  serverArchive      = null;
  serverPuzzle       = s.serverPuzzle;
  serverAnswer       = s.serverAnswer;
  serverState        = s.serverState;
  guessHistory       = s.guessHistory;
  guessCount         = s.guessCount;
  elapsedSeconds     = s.elapsedSeconds;
  gameOver           = s.gameOver;
  correctStateGuessed = s.correctStateGuessed;
  currentMapStage    = s.currentMapStage;
  gamePhase          = s.gamePhase;
  eliminatedStates   = s.eliminatedStates;
  districts          = s.districts;
  districtPoints     = s.districtPoints;
  adjMap             = s.adjMap;
  todayDistrict      = s.todayDistrict;
  lastGameWon        = s.lastGameWon;
  cluesRevealed      = s.cluesRevealed;

  document.getElementById('archive-badge')?.classList.add('hidden');

  // Rebuild the daily game-over + result content, mirroring the completed-load path.
  showResult(lastGameWon, false);
  showGameoverModal();
  if (openResult) openResultModal();
}

// On any guess error (network blip, or a 409 because the day was completed in
// another tab), re-sync the board from the authoritative server state.
function serverGuessFailed(err) {
  console.error('server guess failed:', err);
  _guessLocked = false; _distLocked = false;
  // Signed-in: re-sync from the authoritative server result. Anonymous: there is no
  // server-side state to re-sync from, and re-initing would discard the in-progress
  // game held only in the browser — so just unlock and let the player retry the tap.
  if (isAnonymousPlayer) return;
  return initServer();
}

// ── State guess via /guess ──────────────────────────────────────
async function submitStateGuessServer(abbr) {
  _guessLocked = true;
  if (!timerRunning) startTimer();

  // Optimistic "registered" cue: a TRUE dim — fade the other live states toward the grey
  // basemap (CSS-animated fill-opacity) so the tapped one stands out, and freeze map
  // interaction while the guess is in flight so hovering can't re-highlight a state
  // mid-request. The result colour (green/red) on the tapped state is added once the
  // server answers.
  const pressedEl = usRefLayers[abbr];
  const DIM_FACTOR = 0.52;   // each other state keeps this fraction of its current opacity
  for (const [a, el] of Object.entries(usRefLayers)) {
    // Scale the OTHER states' current opacity by a constant factor — active states dim,
    // already-eliminated states (opacity 0) stay dropped (0 × factor = 0).
    if (a === abbr) continue;
    const cur = parseFloat(el.attr('fill-opacity'));
    el.attr('fill-opacity', (isNaN(cur) ? 1 : cur) * DIM_FACTOR);
  }
  // Dim the OTHER offshore callouts the same way (relative reduction of their group opacity).
  for (const a of Object.keys(usRefCallouts)) {
    if (a === abbr) continue;
    const co = usRefCallouts[a];
    const cur = parseFloat(co.group.style('opacity'));
    co.group.style('opacity', (isNaN(cur) ? 1 : cur) * DIM_FACTOR);
  }
  pressedEl?.raise();
  _setStatePickInteractive(false);
  // Restore each state + callout's proper style + interaction (network failure / wrong guess).
  const clearDim = () => {
    _setStatePickInteractive(true);
    for (const [a, el] of Object.entries(usRefLayers)) _applyStateStyle(el, a);
    for (const a of Object.keys(usRefCallouts)) _applyCalloutStyle(a);
  };
  const panel = document.getElementById('us-ref-map');

  let resp;
  // No motion until the server answers: shaking on every tap meant a correct guess shook
  // first, then turned green. The dim cue above is the only optimistic feedback; the shake
  // (wrong) or green flash (correct) is applied once we know the result.
  try { resp = serverArchive ? archiveLocalGuess('state', abbr) : await window.DistrictBackend.guess('state', abbr, elapsedSeconds, anonGuessOpts()); }
  catch (err) { clearDim(); return serverGuessFailed(err); }

  // Correct: confirm the hit first — fade the other states out to the grey basemap, fill the
  // correct state gold + stamp a checkmark, hold briefly, THEN enter the district phase
  // (white state + counties/roads/urban + tiles, zoomed to bbox). Interaction stays frozen.
  if (resp.correct) {
    for (const [a, el] of Object.entries(usRefLayers)) {
      if (a !== abbr) el.attr('fill-opacity', 0);
    }
    if (pressedEl) pressedEl.attr('fill', '#FDB515').attr('fill-opacity', 1).raise();
    _showStateCheck(abbr);
    _guessLocked = false;
    // Prefetch the state's district shapes NOW so the ~1s Edge Function round-trip runs
    // DURING the celebration hold instead of after it (enterServerDistrictPhase awaits the
    // same in-flight promise), roughly halving the pause before the district phase.
    loadServerStateShapes(resp.state || abbr).catch(() => {});
    setTimeout(() => {
      _hideStateCheck();
      processStateGuessServer(abbr, resp);
    }, 650);
    return;
  }

  // Wrong: now shake + escalate the tapped state to the unmistakable red miss colour while
  // the others stay grey. Stroke left untouched (normal border mesh). processStateGuessServer
  // re-renders shortly after, restoring proper colours.
  panel.classList.remove('shake');
  void panel.offsetWidth;            // restart the shake on rapid re-taps
  panel.classList.add('shake');
  if (pressedEl) {
    pressedEl.attr('fill', '#C41230').attr('fill-opacity', 0.9).raise();
  }
  setTimeout(() => panel.classList.remove('shake'), 450);
  setTimeout(() => { clearDim(); _guessLocked = false; processStateGuessServer(abbr, resp); }, 380);
}

function processStateGuessServer(abbr, resp) {
  serverPuzzle.clues = resp.clues || serverPuzzle.clues;
  if (resp.cluesTotal != null) serverPuzzle.cluesTotal = resp.cluesTotal;
  guessHistory.push({ text: abbr, correct: !!resp.correct, phase: 'state', adjacent: !!resp.adjacent });
  guessCount = resp.guesses;

  if (resp.correct) {
    const state = resp.state || abbr;
    // Correct state on the final guess: no district turn remains — reveal + lose.
    if (resp.completed && !resp.won) { renderGuessHistory(); renderClues(); finishServerLoss(resp); return; }
    const isAtLarge = (stateDistrictMap[state] || []).length === 1;
    // Mark the state solved BEFORE the repaint in renderClues so the ref map uses the
    // solved colour scheme (other states → inactive grey / faded) instead of briefly
    // flashing the stale "valid" salmon. enterServerDistrictPhase re-sets these idempotently.
    correctStateGuessed = true;
    serverState = state;
    todayDistrict.properties.state = state;
    // Keep the confirmed state GOLD through the transition — updateUSRefMap (in renderClues
    // and lockStateDropdown) would otherwise repaint it the confirmed red. It then fades out
    // gold as the white district render zooms in, so we go straight from gold → bbox zoom.
    const keepGold = () => usRefLayers[state]?.attr('fill', '#FDB515').attr('fill-opacity', 1).raise();
    renderGuessHistory();
    renderClues();
    keepGold();
    enterServerDistrictPhase(state).then(() => {
      keepGold();
      if (isAtLarge) {
        // At-large: the lone district is the answer; the server still wants a
        // district guess to record the win, so auto-submit it once tiles exist.
        setTimeout(() => submitDistrictTileServer('01'), 700);
      }
    });
    return;
  }

  // Wrong state — eliminate from the public adjacency graph using the server's
  // hot/cold flag. The answer is always retained (it is a neighbor when hot, and
  // not a neighbor when cold), so no knowledge of the answer is needed.
  eliminatedStates.add(abbr);
  const neighbors = STATE_ADJACENCY[abbr] || [];
  if (resp.adjacent) {
    const neighborSet = new Set(neighbors);
    for (const s of [...getValidStates()]) {
      if (!neighborSet.has(s)) eliminatedStates.add(s);
    }
  } else {
    for (const n of neighbors) eliminatedStates.add(n);
  }

  applyMapStage(guessHistory.filter(g => !g.correct).length);
  renderGuessHistory();
  renderClues();
  zoomUSRefMapToValid();
  saveGameState();   // persist anon progress so a refresh resumes

  if (resp.completed) { finishServerLoss(resp); return; }

  // Elimination narrowed to one state → it must be the answer; confirm via server.
  const remaining = getValidStates();
  if (remaining.size === 1) {
    const only = [...remaining][0];
    if (!gameOver && !correctStateGuessed) submitStateGuess(only);
  }
}

// Append a short stack of expanding "sonar" rings to a tapped district-tile group,
// centered on its circle. Returns the layer so it can be removed when the guess resolves.
function startTileRipple(group, baseCircle) {
  const ns = 'http://www.w3.org/2000/svg';
  const cx = baseCircle.getAttribute('cx');
  const cy = baseCircle.getAttribute('cy');
  const r  = baseCircle.getAttribute('r');
  const layer = document.createElementNS(ns, 'g');
  layer.setAttribute('class', 'tile-ripple-layer');
  layer.setAttribute('pointer-events', 'none');
  for (let i = 0; i < 2; i++) {
    const ring = document.createElementNS(ns, 'circle');
    ring.setAttribute('cx', cx); ring.setAttribute('cy', cy); ring.setAttribute('r', r);
    ring.setAttribute('class', 'tile-ripple');
    ring.style.animationDelay = `${i * 0.42}s`;
    layer.appendChild(ring);
  }
  // Behind the tile circle so the rings radiate out from under it.
  group.insertBefore(layer, group.firstChild);
  return layer;
}

// Optimistic district-guess feedback style. Default 'none': the guess resolves fast
// enough that no ping animation is wanted — just the brief dim of the other tiles. Opt
// into 'ripple' (sonar rings) or 'globe' (a small fast-spinning tartan globe) via
// ?ping=ripple / ?ping=globe to compare. Read once at load.
const TILE_PING_MODE = new URLSearchParams(location.search).get('ping') || 'none';

// Debug slow-motion factor for the state→district reveal. ?slow=4 plays that transition
// 4× slower so the cross-fade can be observed frame-by-frame. Default 1 (normal speed).
const ANIM_SLOW = Math.max(1, parseFloat(new URLSearchParams(location.search).get('slow')) || 1);

// Mount a small fast-spinning globe centered over the tapped district tile (an HTML
// overlay, since TiledGlobe renders to a <canvas> and the tiles are SVG). Returns the
// host element so it can be removed when the guess resolves.
function startTileGlobe(baseCircle) {
  if (!window.TiledGlobe) return null;
  const r = baseCircle.getBoundingClientRect();
  if (!r.width) return null;
  const size = Math.max(30, Math.round(r.width * 2));
  const host = document.createElement('div');
  host.className = 'tile-globe-host';
  host.style.cssText = `position:fixed;left:${Math.round(r.left + r.width / 2 - size / 2)}px;` +
    `top:${Math.round(r.top + r.height / 2 - size / 2)}px;width:${size}px;height:${size}px;` +
    `z-index:1200;pointer-events:none;`;
  document.body.appendChild(host);
  try {
    const span = host.appendChild(document.createElement('span'));
    new window.TiledGlobe(span, {
      size, tiles: 64, speed: 9, direction: 'ccw', origin: 'bottom-right',
      tilt: 26, roll: 18, empty: 0.5, snap: 0.7, scatter: 0.18, gap: 0.16, mode: 'tartan',
    });
  } catch (_) { host.remove(); return null; }
  return host;
}

// ── District guess via /guess ───────────────────────────────────
async function submitDistrictTileServer(dist) {
  if (gameOver || !correctStateGuessed || _distLocked) return;
  _distLocked = true;
  if (!timerRunning) startTimer();
  const state     = serverState || todayDistrict.properties.state;
  const fullGuess = `${state}-${dist}`;

  // Optimistic feedback before the /guess round-trip: a ping radiates from the tapped tile
  // and the other tiles dim, so the click feels instant without recolouring the tile (the
  // response resolves it to the correct-pop or wrong-shake). Ping style is the sonar
  // ripple by default, or a small fast-spinning globe with ?ping=globe (A/B test).
  const tilesEl     = document.getElementById('us-ref-map');   // tiles live in the shared map now
  const clickedTile = tilesEl?.querySelector(`g.district-tile[data-dist="${dist}"]`);
  const tileCircle  = clickedTile?.querySelector('circle');
  let rippleLayer = null, globeHost = null;
  if (clickedTile && tileCircle) {
    clickedTile.classList.add('tile-active');
    tilesEl.classList.add('tiles-pinging');
    if (TILE_PING_MODE === 'globe') globeHost = startTileGlobe(tileCircle);
    else if (TILE_PING_MODE === 'ripple') rippleLayer = startTileRipple(clickedTile, tileCircle);
    // default 'none' → just the dim of the other tiles, no ping animation
  }
  const clearPing = () => {
    clickedTile?.classList.remove('tile-active');
    tilesEl.classList.remove('tiles-pinging');
    rippleLayer?.remove();
    globeHost?.remove();
  };

  let resp;
  try { resp = serverArchive ? archiveLocalGuess('district', fullGuess) : await window.DistrictBackend.guess('district', fullGuess, elapsedSeconds, anonGuessOpts()); }
  catch (err) { clearPing(); return serverGuessFailed(err); }
  clearPing();

  if (resp.correct) {
    if (tileCircle) {
      tileCircle.classList.add('tile-correct-pop');
      const ns = 'http://www.w3.org/2000/svg';
      const checkEl = document.createElementNS(ns, 'text');
      checkEl.setAttribute('text-anchor', 'middle');
      checkEl.setAttribute('dominant-baseline', 'central');
      const svgEl = tilesEl.querySelector('svg');
      const curK = svgEl ? d3.zoomTransform(svgEl).k : 1;
      checkEl.setAttribute('font-size', String(10 / Math.max(curK, 1)));
      checkEl.setAttribute('font-weight', '900');
      checkEl.setAttribute('fill', '#1a1a1a');
      checkEl.setAttribute('pointer-events', 'none');
      checkEl.setAttribute('class', 'tile-correct-check');
      checkEl.textContent = '✓';
      clickedTile.appendChild(checkEl);
    }
    setTimeout(() => { _distLocked = false; processDistrictGuessServer(dist, fullGuess, resp); }, 380);
  } else {
    if (tileCircle) tileCircle.classList.add('tile-wrong-shake');
    setTimeout(() => {
      tileCircle?.classList.remove('tile-wrong-shake');
      _distLocked = false;
      processDistrictGuessServer(dist, fullGuess, resp);
    }, 380);
  }
}

function processDistrictGuessServer(dist, fullGuess, resp) {
  serverPuzzle.clues = resp.clues || serverPuzzle.clues;
  if (resp.cluesTotal != null) serverPuzzle.cluesTotal = resp.cluesTotal;
  guessHistory.push({ text: fullGuess, correct: !!resp.correct, phase: 'district', adjacent: !!resp.adjacent });
  guessCount = resp.guesses;
  if (resp.answer) { serverAnswer = resp.answer; todayDistrict.properties['state-district'] = resp.answer.districtId; }

  if (resp.correct) { startGameOverTransition(true, dist); return; }

  applyMapStage(guessHistory.filter(g => !g.correct).length);

  if (resp.completed) {
    renderGuessHistory();
    renderClues();
    startGameOverTransition(false, dist);
    return;
  }

  document.querySelector('.mzb-fit')?.classList.add('at-active-fit');
  requestAnimationFrame(() => { buildDistrictD3Map(serverState || todayDistrict.properties.state); });
  renderGuessHistory();
  renderClues();
  saveGameState();   // persist anon progress so a refresh resumes
}

// State phase exhausted (6 guesses, no district phase entered) — reveal + lose.
async function finishServerLoss(resp) {
  // Lock the game immediately. endGame() (which sets gameOver) only runs AFTER the
  // awaited state-shape load below — without this, a guess could slip in during that
  // await (e.g. a 7th state pick after the 6th wrong guess) before the game locks.
  gameOver = true;
  _guessLocked = true;
  if (resp.answer) {
    serverAnswer = resp.answer;
    serverState = resp.answer.state;
    todayDistrict.properties.state = resp.answer.state;
    todayDistrict.properties['state-district'] = resp.answer.districtId;
    // Play the same reveal tween as the district phase. The answer state's district
    // shapes load in parallel; the expanding fill covers the wait (no dead pause).
    const ready = loadServerStateShapes(resp.answer.state).catch(() => {});
    const distPart = resp.answer.districtId.slice(resp.answer.state.length + 1);
    startGameOverTransition(false, distPart, { ready });
    return;
  }
  endGame(false);
  showGameoverModal();
}

// ============================================================
//  HELPERS
// ============================================================
function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// State selected via D3 map or chips only.
// District selected via tile grid (shown after state is confirmed).

function formatTime(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2,'0')}`;
}

function formatNumber(n) {
  return parseInt(n, 10).toLocaleString();
}

function formatCurrency(n) {
  return '$' + parseInt(n, 10).toLocaleString();
}

// Observable zoom-to-bounding-box pattern (observablehq.com/@d3/zoom-to-bounding-box).
// Returns a d3.ZoomTransform that centers the given bbox in a W×H viewport.
// margin is a fraction of the viewport (0.85 = 15% padding around the constraining axis).
function zoomToBBox([[x0, y0], [x1, y1]], W, H, { margin = 0.85, maxScale = Infinity, minScale = 0 } = {}) {
  let bw = x1 - x0, bh = y1 - y0;
  // Single point (one district remaining): expand to a minimum bbox so zoom stays local
  if (!(bw > 0) || !(bh > 0)) { bw = Math.max(bw, 20); bh = Math.max(bh, 20); x0 -= bw / 2; x1 += bw / 2; y0 -= bh / 2; y1 += bh / 2; }
  if (!(bw > 0) || !(bh > 0)) return d3.zoomIdentity;
  const k = Math.min(maxScale, Math.max(minScale, margin / Math.max(bw / W, bh / H)));
  return d3.zoomIdentity
    .translate(W / 2, H / 2)
    .scale(k)
    .translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
}

// Single cycling zoom button: each click jumps the map to the NEXT level and morphs
// the icon to whatever the following click will do. The icon always previews the next
// destination (district pin → state polygon → globe → …).
const GO_ZOOM_LEVELS = [
  { key: 'district', title: 'Zoom to district',
    icon: '<path d="M12 21s-6-5.7-6-10a6 6 0 0 1 12 0c0 4.3-6 10-6 10z"/><circle cx="12" cy="11" r="2"/>' },
  { key: 'state', title: 'Zoom to state',
    icon: '<polygon points="4 8 9 4 20 7 19 16 11 20 4 16"/>' },
  { key: 'nation', title: 'Zoom to nation',
    icon: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>' },
];
// Index of the level the button will go to on the NEXT click. Map opens at district(0),
// so the first click should take the player to state(1).
let _goZoomLevel = 1;

function _goZoomTo(idx) {
  const lvl = GO_ZOOM_LEVELS[idx];
  if (lvl.key === 'district')   _goAnimateTo(_goZoomInitial || d3.zoomIdentity);
  else if (lvl.key === 'state') _goAnimateTo(_goZoomState   || d3.zoomIdentity);
  else                          _goAnimateTo(d3.zoomIdentity);
}

// Crossfade the cycle button's icon to the given level (fade/scale out, swap, fade in).
function _setGoCycleIcon(idx) {
  const btn = document.querySelector('#gameover-modal .mzb-go-cycle');
  if (!btn) return;
  const lvl = GO_ZOOM_LEVELS[idx];
  btn.classList.add('swapping');
  btn.setAttribute('title', lvl.title);
  btn.setAttribute('aria-label', lvl.title);
  setTimeout(() => {
    const svg = btn.querySelector('.mzb-icon');
    if (svg) svg.innerHTML = lvl.icon;
    btn.classList.remove('swapping');
  }, 160);
}

// Smoothly tween the game-over map's zoom transform to `target` (a d3 zoomIdentity-
// derived transform). Shared by the district / state / nation zoom levels.
function _goAnimateTo(target, dur = 700) {
  const svgSel = d3.select('#gameover-map svg');
  if (svgSel.empty() || !_goZoom || !target) return;
  const cur = d3.zoomTransform(svgSel.node());
  const t0k = cur.k, t0x = cur.x, t0y = cur.y;
  const t1k = target.k, t1x = target.x, t1y = target.y;
  const ease = d3.easeCubicInOut;
  const start = performance.now();
  (function frame() {
    const elapsed = performance.now() - start;
    const t = ease(Math.min(elapsed / dur, 1));
    const tr = d3.zoomIdentity
      .translate(t0x + (t1x - t0x) * t, t0y + (t1y - t0y) * t)
      .scale(t0k + (t1k - t0k) * t);
    _goZoom.transform(svgSel, tr);
    if (elapsed < dur) requestAnimationFrame(frame);
  })();
}

// Return the set of active state-district keys for the current game phase:
//   state phase   → all district keys of remaining valid states
//   district phase → remaining valid district keys in the confirmed state (after eliminations)
function getActiveDistrictKeys() {
  if (gamePhase === 'district' && todayDistrict) {
    const stateAbbr      = todayDistrict.properties.state;
    const stateFeatures  = districts.filter(f => f.properties.state === stateAbbr);
    const answerKey      = todayDistrict.properties['state-district'];
    const answerNeighbors = new Set(adjMap.get(answerKey) || []);
    const wrongGuesses   = guessHistory.filter(g => g.phase === 'district' && !g.correct);
    let possible = new Set(stateFeatures.map(f => f.properties['state-district']));
    for (const guess of wrongGuesses) {
      const key = guess.text;
      if (guessWasAdjacent(guess, answerNeighbors)) {
        const nbrSet = new Set(adjMap.get(key) || []);
        for (const k of [...possible]) { if (k !== key && !nbrSet.has(k)) possible.delete(k); }
        possible.delete(key);
      } else {
        possible.delete(key);
        for (const nbr of (adjMap.get(key) || [])) possible.delete(nbr);
      }
    }
    return possible;
  }
  // State phase
  const validStates = correctStateGuessed && todayDistrict
    ? new Set([todayDistrict.properties.state])
    : getValidStates();
  const keys = new Set();
  for (const key of Object.keys(districtPoints)) {
    if (validStates.has(key.split('-')[0])) keys.add(key);
  }
  return keys;
}

// ============================================================
//  STORAGE
// ============================================================
// Signed-in players' progress is persisted server-side (results table). Anonymous
// players have no server record, so we save their game locally (keyed by puzzle date)
// — a refresh then resumes an in-progress game and keeps a finished daily locked,
// rather than restarting. Archive replays are unofficial and never saved.
const ANON_GAME_KEY = STORAGE_PREFIX + 'anonGame';
function saveGameState() {
  if (!isAnonymousPlayer || isArchiveGame || !serverPuzzle || !serverPuzzle.date) return;
  try {
    localStorage.setItem(ANON_GAME_KEY, JSON.stringify({
      date: serverPuzzle.date,
      guessHistory,
      guessCount,
      elapsedSeconds,
      gameOver,
      serverState,
      clues: serverPuzzle.clues || [],
      cluesTotal: serverPuzzle.cluesTotal || MAX_GUESSES,
      answer: serverAnswer || null,
    }));
  } catch (_) { /* storage full / disabled — non-fatal */ }
}

function loadAnonGame() {
  try {
    const raw = localStorage.getItem(ANON_GAME_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function savePersonalStats(won, guesses, seconds) {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + 'stats');
    const stats = raw ? JSON.parse(raw) : {
      played: 0, won: 0, streak: 0, maxStreak: 0,
      guessDist: { 1:0,2:0,3:0,4:0,5:0,6:0,X:0 },
      totalWonTime: 0,
      lastDate: null
    };
    stats.played++;
    if (won) {
      stats.won++;
      stats.streak = (stats.lastDate === getPrevDayKey()) ? stats.streak + 1 : 1;
      stats.maxStreak = Math.max(stats.maxStreak, stats.streak);
      stats.guessDist[guesses] = (stats.guessDist[guesses] || 0) + 1;
      stats.totalWonTime = (stats.totalWonTime || 0) + seconds;
    } else {
      stats.streak = 0;
      stats.guessDist['X'] = (stats.guessDist['X'] || 0) + 1;
    }
    stats.lastDate = todayKey;
    localStorage.setItem(STORAGE_PREFIX + 'stats', JSON.stringify(stats));
  } catch {}
}

function getPrevDayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function loadPersonalStats() {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + 'stats');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// Per-browser steps to re-enable a notification permission the user (or an earlier visit)
// blocked at the OS/browser level — the site itself can no longer re-prompt once denied,
// so this is the only way back short of guesswork.
const PUSH_BLOCKED_STEPS = {
  chrome: ['Click the lock/info icon at the left of the address bar', 'Set <strong>Notifications</strong> to <strong>Allow</strong>', 'Reload this page'],
  edge: ['Click the lock icon at the left of the address bar', 'Set <strong>Notifications</strong> to <strong>Allow</strong>', 'Reload this page'],
  firefox: ['Click the lock icon at the left of the address bar', 'Clear the <strong>Blocked</strong> notification permission (or set it to Allow)', 'Reload this page'],
  safari: ['Open <strong>Safari &rsaquo; Settings for This Website&hellip;</strong> (or Safari Preferences &rsaquo; Websites &rsaquo; Notifications)', 'Set Daily District\'s notification permission to <strong>Allow</strong>', 'Reload this page'],
  opera: ['Click the lock icon at the left of the address bar', 'Set <strong>Notifications</strong> to <strong>Allow</strong>', 'Reload this page'],
  'chrome-ios': ['Open the <strong>Settings</strong> app &rsaquo; Safari (iOS routes all browser permissions through Safari)', 'Find this site and allow notifications', 'Reload this page'],
  other: ['Open your browser\'s site settings for this page (often via the icon next to the address bar)', 'Set <strong>Notifications</strong> to <strong>Allow</strong>', 'Reload this page'],
};

// ── Push notification opt-in ─────────────────────────────────────────────────
// Shows one of three panels: the standard "enable notifications" ask, (iOS Safari not
// yet added to the Home Screen) instructions to install first since iOS only allows Web
// Push for installed/standalone PWAs, or (permission previously denied at the browser
// level) per-browser steps to unblock it — the site can't re-prompt once denied.
function showPushOptInModal({ forceIOSInstructions = false, blocked = false } = {}) {
  const modal = document.getElementById('push-optin-modal');
  if (!modal) return;
  const showIOS = !blocked && (forceIOSInstructions || (window.DistrictBackend?.isIOS?.() && !window.DistrictBackend?.isStandalone?.()));
  document.getElementById('push-optin-ask').classList.toggle('hidden', showIOS || blocked);
  document.getElementById('push-optin-ios').classList.toggle('hidden', !showIOS);
  document.getElementById('push-optin-blocked').classList.toggle('hidden', !blocked);
  if (blocked) {
    const name = window.DistrictBackend?.browserName?.() || 'other';
    const steps = PUSH_BLOCKED_STEPS[name] || PUSH_BLOCKED_STEPS.other;
    const stepsEl = document.getElementById('push-blocked-steps');
    if (stepsEl) stepsEl.innerHTML = steps.map(s => `<li>${s}</li>`).join('');
  }
  modal.classList.remove('hidden');
}

// Offered after the 1st completed game, and again before the 3rd if the player hasn't
// decided either way yet. Never shown once granted, permanently dismissed, or blocked
// at the browser level — Settings > Daily Reminder remains available regardless.
async function maybePromptPushOptIn() {
  if (!window.DistrictBackend?.pushSupported?.()) return;
  if (typeof Notification !== 'undefined' && Notification.permission === 'denied') return;
  const decision = localStorage.getItem(PUSH_DECISION_KEY);
  if (decision === 'granted' || decision === 'dismissed') return;
  const existing = await window.DistrictBackend.getPushSubscription();
  if (existing) { localStorage.setItem(PUSH_DECISION_KEY, 'granted'); return; }

  const played = loadPersonalStats()?.played ?? 0;
  if (played !== 1 && played !== 2) return;
  const lastPrompted = parseInt(localStorage.getItem(PUSH_PROMPTED_AT) || '0', 10);
  if (lastPrompted >= played) return;

  localStorage.setItem(PUSH_PROMPTED_AT, String(played));
  setTimeout(() => showPushOptInModal(), 3500);
}

// The Result tab reads device-local stats, which accumulate for anonymous play and are
// account-agnostic — so after a sign-in (or a DB reset + fresh account) they can disagree
// with the account-scoped Leaderboard. When a player is signed in, overwrite the local
// stats with the account's authoritative server aggregates so both panels match
// (played, won, current/max streak, guess distribution, and total solve time across wins).
async function hydratePersonalStatsFromServer() {
  try {
    const lb = await window.DistrictBackend.leaderboard();
    const u = lb && lb.user;
    if (!u) return;                       // signed out, or account has no recorded games yet
    const srcDist = u.dist || {};
    const guessDist = { 1:0, 2:0, 3:0, 4:0, 5:0, 6:0, X:0 };
    for (const k of Object.keys(guessDist)) guessDist[k] = Number(srcDist[k]) || 0;
    const won = [1,2,3,4,5,6].reduce((s, k) => s + guessDist[k], 0);
    const stats = {
      played: Number(u.played) || 0,
      won,
      streak: Number(u.curStreak) || 0,
      maxStreak: Number(u.maxStreak) || 0,
      guessDist,
      totalWonTime: Number(u.totalWonSeconds) || 0,   // sum of solve times across wins
      lastDate: null,
    };
    localStorage.setItem(STORAGE_PREFIX + 'stats', JSON.stringify(stats));
    renderInlinePersonalStats();          // refresh the Result tab if it's showing
  } catch (_) { /* non-fatal */ }
}

// A player can finish a game anonymously (nothing recorded server-side) and sign in
// afterward. Record that completed game to the now-signed-in account by replaying its
// guess history through /guess, which the signed-in path persists guess-by-guess. Runs
// at most once: a partial replay must NOT be retried or it would double-append, so the
// guard stays set even on error.
let _anonGameBound = false;
async function bindAnonymousGameToAccount() {
  if (_anonGameBound) return;
  if (isArchiveGame || !Array.isArray(guessHistory) || guessHistory.length === 0) return;
  _anonGameBound = true;
  try {
    for (const g of guessHistory) {
      await window.DistrictBackend.guess(g.phase, g.text, elapsedSeconds);
    }
  } catch (e) {
    reportClientError('anon_bind', e);   // leave guard set — don't risk a double-append
  }
}

// Reflect signed-in status in any visible game-over surfaces: drop the "sign in to save"
// nudges (result modal + game-over ribbon) and show the personal-stats block.
function refreshSignedInUI() {
  const anonCta = document.getElementById('result-anon-cta');
  const personalStats = document.getElementById('result-personal-stats');
  if (anonCta) anonCta.classList.toggle('hidden', !isAnonymousPlayer);   // hide once signed in
  if (personalStats) personalStats.classList.toggle('hidden', isAnonymousPlayer);
  const nextCta = document.getElementById('gameover-next-cta');
  if (nextCta) nextCta.classList.toggle('hidden', !isAnonymousPlayer);
  // Ad slot: shown only to not-signed-in players. Previously only showResult() toggled
  // this, which doesn't run just from opening the modal — same stale-visibility gap as
  // anonCta/personalStats before this function ran there too.
  document.getElementById('result-ad')?.classList.toggle('hidden', !isAnonymousPlayer);
  renderInlinePersonalStats();
}

function getUsername() {
  return localStorage.getItem(STORAGE_PREFIX + 'username') || '';
}

// ============================================================
//  DYNAMIC DOM BUILDERS
// ============================================================

function buildGameSection() {
  const el = document.createElement('div');
  el.id = 'game-section';
  el.innerHTML = `
    <div id="map"></div>
    <div id="game-controls">
      <div id="hint-bar" role="list" aria-label="Hints"></div>
    </div>
    <div id="map-panel">
      <div id="map-view">
        <div class="map-view-header">
          <div class="ref-label" id="ref-label">Click a state to select it</div>
          <div id="guess-counter" class="guess-counter"></div>
        </div>
        <div id="confirm-hint">Tap again to confirm</div>
        <div class="us-ref-map-wrap">
          <div id="us-ref-map"></div>
          <div id="district-tiles" class="hidden"></div>
          <div class="us-ref-hint" id="us-ref-hint">
            <span class="hint-desktop">Drag to pan \xB7 Scroll to zoom</span>
            <span class="hint-mobile">Drag \xB7 Pinch to zoom</span>
          </div>
        </div>
      </div>
      <div id="state-chips-section">
        <div class="ref-label">
          Possible states: <span id="state-match-count">all 51</span>
          <span id="state-chips-hint">(click to select)</span>
        </div>
        <div id="state-chips"></div>
      </div>
    </div>
  `;
  document.getElementById('result-modal').before(el);
  return el;
}

function destroyGameSection() {
  if (map) { map.remove(); map = null; }
  districtLayer = null;
  document.getElementById('game-section')?.remove();
}

function buildGameoverDiv() {
  const el = document.createElement('div');
  el.id = 'gameover-modal';
  el.innerHTML = `
    <div class="gameover-modal-content">
      <div class="gameover-ribbon banner">
        <div class="gameover-ribbon-inner">
          <span id="gameover-ribbon-text" class="gameover-ribbon-text"></span>
          <div class="banner-actions">
            <button id="gameover-result-btn">View Results</button>
            <button id="gameover-share-btn" class="go-share-btn" aria-label="Share result"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width:1em;height:1em;vertical-align:middle;margin-right:4px"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>Share</button>
            <button id="gameover-new-map-btn">Play Archive</button>
          </div>
        </div>
      </div>
      <div class="gameover-card">
        <div id="gameover-next" class="gameover-next">
          <div class="gameover-card-header">
            <span id="gameover-headline" class="gameover-headline"></span>
            <div class="gameover-stats">
              <span id="gameover-grid" class="gameover-grid"></span>
              <span id="gameover-solved-label" class="gameover-solved-label"></span>
              <span class="gameover-time-wrap">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" width="13" height="13"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <span id="gameover-time" class="gameover-time"></span>
              </span>
            </div>
          </div>
          <div class="gameover-next-main">
            <span class="gameover-next-title">That's today's district!</span>
            <span class="gameover-next-sub">New district in <strong id="gameover-next-countdown" class="go-next-countdown">--:--:--</strong> &middot; midnight ET</span>
          </div>
          <div id="gameover-next-cta" class="gameover-next-cta hidden">
            <span>Sign in to keep track of your stats and see how you compare with other players.</span>
            <button id="gameover-next-signin" class="gameover-next-signin">Sign in / Sign up</button>
          </div>
        </div>
        <div id="gameover-map-wrap">
          <div id="gameover-map"></div>
          <div class="map-zoom-btns">
            <button class="mzb mzb-go" data-dir="in" aria-label="Zoom in">+</button>
            <button class="mzb mzb-go" data-dir="out" aria-label="Zoom out">−</button>
            <button class="mzb mzb-go mzb-go-fit mzb-go-cycle" data-dir="fit-cycle" aria-label="Zoom to state" title="Zoom to state"><svg class="mzb-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" width="14" height="14"><polygon points="4 8 9 4 20 7 19 16 11 20 4 16"/></svg></button>
          </div>
        </div>
      </div>
      <!-- District Profile — open-by-default bottom sheet with a blurred backdrop.
           Dismiss by swiping the sheet down or tapping the chevron; reopen via the pill. -->
      <div id="gameover-census" class="gameover-census open" role="dialog" aria-label="District Profile">
        <section class="district-profile">
          <div class="gameover-census-handle"><span class="gameover-census-grip"></span></div>
          <div class="gameover-census-titlebar">
            <span class="gameover-census-title">District Profile</span>
            <button type="button" class="gameover-census-close" aria-label="Minimize District Profile">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" width="20" height="20"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
          </div>
          <div class="gameover-census-body">
            <div id="census-header"></div>
            <div id="census-loading">Fetching district data from the U.S. Census…</div>
            <div id="census-data" class="hidden"></div>
          </div>
        </section>
        <button type="button" class="gameover-census-reopen" aria-label="Show District Profile">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" width="16" height="16"><polyline points="18 15 12 9 6 15"/></svg>
          District Profile
        </button>
      </div>
    </div>
  `;
  document.getElementById('result-modal').before(el);
  return el;
}

// Wire the District Profile bottom sheet: open by default, dismiss via the
// chevron / backdrop / swiping the handle down, reopen via the pill.
// Size the District Profile to its content when it fits the area below the header;
// otherwise keep the reduced default (66%) and let the user swipe up to expand. The
// `.fits` class lifts the sheet's max-height so its content height drives it.
function fitGameoverCensus() {
  const wrap = document.getElementById('gameover-census');
  if (!wrap) return;
  if (wrap.classList.contains('expanded')) return;   // user chose full height — leave it
  if (wrap.classList.contains('user-sized')) return; // user dragged a custom height — leave it
  const handle = wrap.querySelector('.gameover-census-handle');
  const bar    = wrap.querySelector('.gameover-census-titlebar');
  const body   = wrap.querySelector('.gameover-census-body');
  if (!body) return;
  const avail  = wrap.clientHeight;                   // viewport minus the header
  const needed = (handle?.offsetHeight || 0) + (bar?.offsetHeight || 0) + body.scrollHeight + 4;
  wrap.classList.toggle('fits', avail > 0 && needed <= avail);
}

function wireGameoverCensus() {
  const wrap = document.getElementById('gameover-census');
  if (!wrap) return;
  const sheet = wrap.querySelector('.district-profile');
  const open  = () => { wrap.classList.add('open'); fitGameoverCensus(); };
  // Dismiss + drop any user-dragged height so the next open starts from the fitted default.
  const close = () => {
    wrap.classList.remove('open', 'expanded', 'user-sized');
    if (sheet) { sheet.style.height = ''; sheet.style.maxHeight = ''; }
  };

  wrap.querySelector('.gameover-census-close')?.addEventListener('click', close);
  wrap.querySelector('.gameover-census-reopen')?.addEventListener('click', open);

  // Drag the grip handle / titlebar to RESIZE the sheet to any height (anchored at the
  // bottom): drag up to grow, down to shrink. A tap (no real movement) toggles full /
  // fitted height; dragging down past the minimum dismisses it.
  const handleEl = wrap.querySelector('.gameover-census-handle');
  const barEl    = wrap.querySelector('.gameover-census-titlebar');
  let startY = null, dy = 0, startH = 0, minH = 0, maxH = 0;
  const onDown = (e) => {
    startY = e.clientY; dy = 0;
    startH = sheet ? sheet.getBoundingClientRect().height : 0;
    minH = (handleEl?.offsetHeight || 0) + (barEl?.offsetHeight || 0);  // never below the title strip
    maxH = wrap.clientHeight;                                           // never above the header
    if (sheet) sheet.style.transition = 'none';
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e) => {
    if (startY == null || !sheet) return;
    dy = e.clientY - startY;
    if (Math.abs(dy) < 3) return;                 // let a tap stay a tap
    // Dragging up (dy < 0) grows the sheet; clamp to [title strip, below header].
    const h = Math.max(minH, Math.min(maxH, startH - dy));
    wrap.classList.add('user-sized');             // takes over from the .fits/.expanded presets
    sheet.style.maxHeight = 'none';
    sheet.style.height = `${h}px`;
  };
  const onUp = () => {
    if (startY == null) return;
    if (sheet) sheet.style.transition = '';
    const floor = (handleEl?.offsetHeight || 0) + (barEl?.offsetHeight || 0);
    if (Math.abs(dy) < 6) {                        // tap → toggle full / fitted, clear manual size
      if (sheet) { sheet.style.height = ''; sheet.style.maxHeight = ''; }
      wrap.classList.remove('user-sized');
      wrap.classList.toggle('expanded');
    } else if (sheet && dy > 0 && sheet.getBoundingClientRect().height <= floor + 8) {
      close();                                     // dragged down to the floor → dismiss
    }
    startY = null; dy = 0;
    fitGameoverCensus();   // re-evaluate fit if we cleared the manual size
  };
  // Drag from the grip handle and the titlebar. Ignore pointerdowns on the close
  // button so its click still fires (setPointerCapture would otherwise swallow it).
  [wrap.querySelector('.gameover-census-handle'), wrap.querySelector('.gameover-census-titlebar')].forEach(z => {
    if (!z) return;
    z.addEventListener('pointerdown', (e) => { if (e.target.closest('.gameover-census-close')) return; onDown(e); });
    z.addEventListener('pointermove', onMove);
    z.addEventListener('pointerup', onUp);
    z.addEventListener('pointercancel', onUp);
  });

  // Decide the initial height once the content has laid out, and again on resize.
  requestAnimationFrame(() => requestAnimationFrame(fitGameoverCensus));
  if (!window._gameoverCensusResizeWired) {
    window._gameoverCensusResizeWired = true;
    window.addEventListener('resize', () => fitGameoverCensus());
  }
}

function destroyGameoverDiv() {
  _goZoom = null;
  _goZoomInitial = null;
  _goZoomState = null;
  stopNextDistrictCountdown();
  document.getElementById('gameover-modal')?.remove();
}

// ============================================================
//  MAP
// ============================================================

// Tile helpers — dark mode uses CartoDB Dark Matter; light uses OSM
function streetTileUrl() {
  return isDarkMode()
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
}
function streetTileAttrib() {
  return isDarkMode()
    ? '© <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>'
    : '© OpenStreetMap contributors';
}

// Track current street-layer opacity so we can restore it after a tile swap
let _streetOpacity = 0.01;

function initMap() {
  map = L.map('map', {
    zoomControl:      false,   // no zoom buttons — district map is for context only
    scrollWheelZoom:  false,
    doubleClickZoom:  false,
    touchZoom:        false,
    boxZoom:          false,
    dragging:         false,   // prevent accidental map panning on mobile
    attributionControl: false
  }).setView([37.8, -96], 4);

  // Layer 1: shaded relief — no labels, pure hillshade (light mode stage 1)
  terrainLayer = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}',
    { maxZoom: 13, opacity: 0, attribution: 'Tiles © Esri' }
  ).addTo(map);

  // Layer 2: satellite imagery — no labels, used as stage 2 hint in all modes
  satelliteLayer = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { maxZoom: 19, opacity: 0, attribution: 'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics' }
  ).addTo(map);

  // Layer 3: labeled tiles — CartoDB dark in dark mode, OSM in light; revealed only at game end
  streetLayer = L.tileLayer(streetTileUrl(), {
    maxZoom: 19,
    opacity: 0.01,
    attribution: streetTileAttrib()
  }).addTo(map);

  L.control.attribution({ position: 'bottomright', prefix: false }).addTo(map);

  // Re-sync D3 overlay whenever Leaflet repositions (fitBounds fires moveend)
  map.on('moveend zoomend', () => renderMapD3(currentMapStage));
}

function applyMapStage(wrongGuesses, gameEnded = false) {
  const dark = isDarkMode();
  let idx;
  // Landscape imagery (the satellite/terrain tile basemap, stage ≥ 2) is held back
  // until AFTER the 4th guess — before that the map shows the district outline only.
  if (gameEnded || wrongGuesses >= 4) idx = 3;
  else if (wrongGuesses >= 1)         idx = 1;
  else                                idx = 0;

  // Hard mode: shape only — no terrain/imagery reveal during play (full reveal at game over).
  const hardPlay = hardMode && !gameEnded;
  if (hardPlay) idx = 0;

  // D3 overlay: stages 0 (outline only), 1 (+ urban/roads), 2+ (transparent bg over terrain)
  currentMapStage = hardPlay ? 0 : Math.max(currentMapStage, idx);
  renderMapD3(currentMapStage);

  // One basemap per theme starting at stage 2: terrain in light mode, satellite in dark mode
  terrainLayer.setOpacity(dark ? 0 : (currentMapStage >= 2 ? 1 : 0));
  satelliteLayer.setOpacity(dark ? (currentMapStage >= 2 ? 1 : 0) : 0);

  // Labels never shown
  _streetOpacity = 0.01;
  streetLayer.setOpacity(0.01);
}

function districtStyle() {
  // Leaflet layer is used only for fitBounds — D3 overlay draws the visible border
  return { color: 'transparent', weight: 0, fillOpacity: 0 };
}

// Build a D3-compatible transform that matches Leaflet's current WebMercator viewport.
// d3.geoTransform wraps a point-stream function so d3.geoPath can consume it.
function _leafletProjection() {
  return d3.geoTransform({
    point(lng, lat) {
      const pt = map.latLngToContainerPoint(L.latLng(lat, lng));
      this.stream.point(pt.x, pt.y);
    }
  });
}

function renderMapD3(stage) {
  const mapEl = document.getElementById('map');
  if (!mapEl || !todayDistrict || !window.d3 || !map) return;

  let overlayEl = document.getElementById('map-d3-overlay');
  if (!overlayEl) {
    overlayEl = document.createElement('div');
    overlayEl.id = 'map-d3-overlay';
    overlayEl.style.cssText =
      'position:absolute;inset:0;z-index:500;pointer-events:none;';
    mapEl.appendChild(overlayEl);
  }
  overlayEl.innerHTML = '';

  const W = mapEl.offsetWidth  || 400;
  const H = mapEl.offsetHeight || 300;
  const dark = isDarkMode();

  // Use Leaflet's projection when tiles are visible (stage ≥ 2) so the D3 district
  // outline aligns with the WebMercator tile background. At stage 0-1 (plain background)
  // use a fitted AlbersUSA so the shape fills the available space nicely.
  const useTileProjection = stage >= 2 && map.getZoom;
  const projection = useTileProjection
    ? _leafletProjection()
    : _previewProjection(W, H, Math.min(W, H) * 0.1, { centerOnCentroid: gameOver });
  const pathGen = d3.geoPath(projection);
  const dPath   = pathGen(todayDistrict);
  if (!dPath) return;

  const svg = d3.select(overlayEl).append('svg')
    .attr('width', W).attr('height', H)
    .style('display', 'block');

  // Opaque background for stages 0-1 (no tile basemap visible)
  if (stage < 2) {
    const bg = getComputedStyle(document.body).getPropertyValue('--bg').trim();
    svg.append('rect').attr('width', W).attr('height', H).attr('fill', bg || '#f5f5f5');
  }

  // Urban areas + roads only after game ends (not during gameplay — too revealing)
  if (gameOver && (topoUrban || topoRoads)) {
    const [[bx0, by0], [bx1, by1]] = d3.geoBounds(todayDistrict);
    const mg = 0.1;
    const inBounds = f => {
      try {
        const [[fx0, fy0], [fx1, fy1]] = d3.geoBounds(f);
        return fx1 >= bx0-mg && fx0 <= bx1+mg && fy1 >= by0-mg && fy0 <= by1+mg;
      } catch { return false; }
    };
    if (topoUrban) topoUrban.features.filter(inBounds).forEach(f =>
      svg.append('path').attr('d', pathGen(f))
        .attr('fill', dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)')
        .attr('stroke', 'none'));
    if (topoRoads) topoRoads.features.filter(inBounds).forEach(f =>
      svg.append('path').attr('d', pathGen(f))
        .attr('fill', 'none')
        .attr('stroke', dark ? 'rgba(255,255,255,0.2)' : '#bbb')
        .attr('stroke-width', 0.6));
  }

  // District fill — white in dark mode after game over, subtle red tint otherwise
  const fillColor   = (dark && gameOver) ? '#ffffff' : '#C41230';
  const fillOpacity = (dark && gameOver) ? 0.25 : (dark ? 0.3 : 0.35);
  svg.append('path').attr('d', dPath)
    .attr('fill', fillColor)
    .attr('fill-opacity', fillOpacity);

  // District border — always white
  svg.append('path').attr('d', dPath)
    .attr('fill', 'none')
    .attr('stroke', '#ffffff')
    .attr('stroke-width', 2.5)
    .attr('stroke-linejoin', 'round');
}

function renderDistrict(feature) {
  if (!map) return;   // Leaflet map not initialised yet (e.g. mid-rebuild) — nothing to draw
  if (districtLayer) map.removeLayer(districtLayer);
  // Invisible Leaflet layer — used only to drive fitBounds; D3 overlay draws the visible border
  districtLayer = L.geoJSON(feature, { style: districtStyle() }).addTo(map);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (!map) return;
    map.invalidateSize();
    if (districtLayer) {
      map.fitBounds(districtLayer.getBounds(), { padding: [40, 40], animate: false });
    }
    renderMapD3(currentMapStage); // restore current stage (preserves urban/roads if already revealed)
  }));
}

// ============================================================
//  CENSUS DATA — read from TopoJSON properties (pre-aggregated via BAF)
// ============================================================
async function getDistrictCensusData() {
  if (!todayDistrict) return null;
  // Census for the day's district is served (pre-aggregated, matching the 2026
  // boundaries) only once the game is over, via the revealed answer. Pass the whole
  // census object through so every field (incl. the expanded ACS facts) is available.
  if (!serverAnswer || !serverAnswer.census) return null;
  return { name: serverAnswer.districtId, ...serverAnswer.census };
}

async function fetchCensus(districtData, field) {
  const d = await getDistrictCensusData();
  if (!d) return 'N/A';

  if (field === 'pop') {
    return formatNumber(d.pop) + ' people';
  }

  if (field === 'income') {
    return parseInt(d.income, 10) > 0 ? formatCurrency(d.income) + '/yr' : 'N/A';
  }

  if (field === 'plurality') {
    const total = parseInt(d.pop, 10);
    if (!total) return 'N/A';
    const groups = [
      { name: 'White',    val: parseInt(d.whiteNH,  10) },
      { name: 'Black',    val: parseInt(d.black,    10) },
      { name: 'Hispanic', val: parseInt(d.hispanic, 10) },
      { name: 'Asian',    val: parseInt(d.asian,    10) },
    ].filter(g => g.val > 0 && !isNaN(g.val));
    groups.sort((a, b) => b.val - a.val);
    if (!groups.length) return 'N/A';
    const top = groups[0];
    const pct = Math.round(top.val / total * 100);
    return `${pct}% ${top.name} plurality`;
  }

  return 'N/A';
}

function renderTabHeader(containerId) {
  const el = document.getElementById(containerId);
  if (!el || !todayDistrict) return;
  const answer    = todayDistrict.properties['state-district'] || '';
  const stateName = STATE_NAMES[todayDistrict.properties.state] || todayDistrict.properties.state;
  const isAtLarge = (stateDistrictMap[todayDistrict.properties.state] || []).length === 1;
  const distPart  = answer.slice(todayDistrict.properties.state.length + 1);
  const distLabel = isAtLarge ? 'At-Large District' : `District ${parseInt(distPart, 10)}`;
  const won       = guessHistory.some(g => g.correct && g.phase === 'district');
  const timeStr   = elapsedSeconds > 0 ? ` &middot; <strong>${formatTime(elapsedSeconds)}</strong>` : '';
  const solveStr  = won
    ? `Solved in <strong>${guessCount}</strong> guess${guessCount !== 1 ? 'es' : ''}${timeStr}`
    : `Not solved &mdash; the answer was <strong>${answer}</strong>`;
  el.innerHTML = `
    <div class="result-answer">
      <span class="result-answer-code">${answer}</span>
    </div>
    <div class="result-time-line">${solveStr}</div>`;
}

// Personal stats grid (played, win%, streaks, distribution)
function renderInlinePersonalStats() {
  const el = document.getElementById('result-personal-stats');
  if (!el) return;
  const stats = loadPersonalStats();
  if (!stats || stats.played === 0) { el.innerHTML = ''; return; }

  const winRate = Math.round(stats.won / stats.played * 100);
  const dist    = stats.guessDist || {};
  const wonToday = guessHistory.some(g => g.correct && g.phase === 'district');
  const hiKey = gameOver ? (wonToday ? guessCount : 'X') : null;

  // Same markup/classes as the Me / Everyone tabs so the stat cards + histogram
  // are identical in style and width.
  el.innerHTML = `
    <div class="personal-grid">
      <div class="stat-card"><div class="stat-val">${stats.played}</div><div class="stat-label">Played</div></div>
      <div class="stat-card"><div class="stat-val">${winRate}%</div><div class="stat-label">Win Rate</div></div>
      <div class="stat-card"><div class="stat-val">${stats.streak}</div><div class="stat-label">Current Streak</div></div>
      <div class="stat-card"><div class="stat-val">${stats.maxStreak}</div><div class="stat-label">Max Streak</div></div>
    </div>
    <div class="result-dist">
      <h4>Guess Distribution</h4>
      ${renderDistBars(dist, hiKey)}
    </div>`;
}

// Helper: switch the result modal between "result" and "census" tabs
function switchResultTab(tab) {
  document.querySelectorAll('.result-tab-pane').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.result-tab-btn').forEach(b => b.classList.remove('active'));
  const paneId = { result: 'result-section', guesses: 'guesses-section', alltime: 'alltime-section', mystats: 'mystats-section', 'today-everyone': 'today-everyone-section' }[tab] || 'result-section';
  const pane = document.getElementById(paneId);
  const btn  = document.querySelector(`.result-tab-btn[data-rtab="${tab}"]`);
  if (pane) pane.classList.add('active');
  if (btn)  btn.classList.add('active');
  if (tab === 'guesses' && gameOver) {
    renderTabHeader('guesses-header');
    renderGuessHistory();
  }
  if (tab === 'alltime' || tab === 'mystats' || tab === 'today-everyone') loadLeaderboardPanels();
}

// ── District Profile mini-graphics ─────────────────────────────────────────
// Each metric's min/max across all 435 districts + a label formatter. The bar puts
// the tick at the district's PERCENTILE position when one is supplied (so a district
// ranked at the 80th percentile sits 4/5 across the track), falling back to the
// value's linear position within [min, max] when no percentile is available.
function _fmtMoney(v) { return v >= 1e6 ? '$' + (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? '$' + Math.round(v / 1e3) + 'k' : '$' + v; }
function _fmtPct(v)   { return v + '%'; }
function _fmtChg(v)   { return (v > 0 ? '+' : '') + v + '%'; }
const METRICS = {
  income:         { r: [43969, 177521],  f: _fmtMoney },
  medianHome:     { r: [110177, 1795771],f: _fmtMoney },
  medianRent:     { r: [730, 3015],       f: v => '$' + v },
  medianAge:      { r: [30, 55],          f: v => v },
  foreignBornPct: { r: [1, 56],           f: _fmtPct },
  nonEnglishPct:  { r: [2, 86],           f: _fmtPct },
  povertyPct:     { r: [5, 29],           f: _fmtPct },
  homeownerPct:   { r: [12, 84],          f: _fmtPct },
  uninsuredPct:   { r: [2, 30],           f: _fmtPct },
  veteranPct:     { r: [1, 16],           f: _fmtPct },
  meanCommuteMin: { r: [19, 49],          f: v => v },
  avgHHSize:      { r: [1.8, 3.6],        f: v => v },
  edu:            { r: [11, 80],          f: _fmtPct },
  density:        { r: [1, 52265],        f: v => v >= 1000 ? Math.round(v / 1000) + 'k' : v },
  popChange:      { r: [-10, 6],          f: _fmtChg },
  area:           { r: [13, 583360],      f: v => v >= 1000 ? Math.round(v / 1000) + 'k' : v },
  perimeter:      { r: [18, 24535],       f: v => v >= 1000 ? Math.round(v / 1000) + 'k' : v },
  margin:         { r: [-66, 77],         f: v => v > 0 ? 'D+' + v : v < 0 ? 'R+' + (-v) : 'EVEN' },
};
// Thin track with a tick at the district's percentile within the metric (falling
// back to the value's linear position when no percentile is supplied), min/max
// labels, and (if a percentile rank is supplied) a plain-words rank line —
// e.g. "Higher than 97% of districts". `pctl` is census.pct[key] (0..1).
// opts.rank — { hi, lo } verbs for the rank line (default Higher/Lower).
function pctBar(value, key, pctl, opts = {}) {
  const m = key && METRICS[key];
  if (value == null || isNaN(value) || !m) return '';
  const linPos = (value - m.r[0]) / (m.r[1] - m.r[0]);
  const pos = Math.max(0, Math.min(1, (pctl != null && !isNaN(pctl)) ? pctl : linPos));
  const x = Math.max(2, Math.min(98, pos * 100));
  const bar = `<svg class="mini-pct" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">`
            + `<line class="mp-track" x1="1.5" y1="5" x2="98.5" y2="5"/>`
            + `<rect class="mp-tick" x="${(x - 0.9).toFixed(1)}" y="0.5" width="1.8" height="9" rx="0.9"/></svg>`;
  let rank = '';
  if (pctl != null && !isNaN(pctl)) {
    const w = opts.rank || { hi: 'Higher', lo: 'Lower' };
    const verb = pctl >= 0.5 ? w.hi : w.lo;
    const p = Math.round((pctl >= 0.5 ? pctl : 1 - pctl) * 100);
    // At the extremes "than 100% of districts" reads as a value, not a rank — and
    // collides with the metric's own % — so spell it out as "every other district".
    const tail = p >= 100 ? 'every other district' : `${p}% of districts`;
    rank = `<div class="mp-rank">${verb} than ${tail}</div>`;
  }
  return `<div class="mp-wrap">${bar}<div class="mp-ends"><span>${m.f(m.r[0])}</span><span>${m.f(m.r[1])}</span></div>${rank}</div>`;
}
// Party emblem — official party marks (Democratic donkey, Republican disc) from
// Wikimedia Commons (public domain); a neutral star for Independents/other. Each
// logo carries its own brand colors.
function partyIcon(code, big) {
  const cls = `party-icon party-${code === 'D' || code === 'R' ? code : 'I'}${big ? ' party-lg' : ''}`;
  if (code === 'D') {
    return `<svg class="${cls}" viewBox="0 0 293 262" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path fill="#003EB8" d="M289.2,148.7L289.2,148.7L267,91.5c-0.5-1.7-1.1-3.3-1.9-4.9l0,0c-2-4.2-4.9-8-8.3-11c-3.5-3.1-7.5-5.4-12-6.8c0.1-0.5,0.2-0.9,0.4-1.4C256.8,20,242.7,0,242.7,0s-13.6,12.4-19,49.3c0,0,0,0,0,0.1c-0.2-0.7-0.4-1.3-0.6-2C211.8,12,187.5,1.3,187.5,1.3c-4.5,28.4,6.5,52.5,17.5,68.6c-7.6,3.2-13.8,9.2-17.4,16.8h0L162,137.4H77c-10.2,0-20.4,2-29.7,6.1C27.6,152.2,21,165.6,21,165.6h-2.2c-7,0-12.8,5.6-13,12.6l-2.2,65.5l-0.1-0.1c0,0-0.1,0.1-0.3,0.3c-0.4,0.4-1.1,1.1-1.7,2.2c-1.8,3.2-3.3,9.4,3.9,18.4c0,0,2.4-1.5,5.1-3.9v56h43.6l10-70.5l-0.1-0.1h0.1l0.3-2.1h96.1l0.3,2.1h0l0,0.1l10,70.5h43.6v-70.5h-0.1l0.1-0.1v-57.8l14.5-39.8l18.5,12c0.3,12.1,10.2,21.9,22.4,21.9c12.4,0,22.4-10,22.4-22.4C292.1,155.8,291.1,152,289.2,148.7z M75.2,205l-9.5-6.9l-9.5,6.9l3.6-11.2l-9.5-6.9h11.7l3.6-11.2l3.6,11.2h11.7l-9.5,6.9L75.2,205z M125.8,205l-9.5-6.9l-9.5,6.9l3.6-11.2l-9.5-6.9h11.7l3.6-11.2l3.6,11.2h11.7l-9.5,6.9L125.8,205z M176.4,205l-9.5-6.9l-9.5,6.9l3.6-11.2l-9.5-6.9h11.7l3.6-11.2l3.6,11.2h11.7l-9.5,6.9L176.4,205z"/></svg>`;
  }
  if (code === 'R') {
    return `<svg class="${cls}" viewBox="0 0 227 227" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><g transform="translate(-593.21 -786.43)"><g transform="matrix(.15 0 0 .15 601.1 764.97)"><circle cy="900.93" cx="705.71" r="750" fill="#e81b23"/><circle cy="900.93" cx="705.71" r="675" fill="#fff"/><path fill="#e81b23" fill-rule="evenodd" transform="translate(-44.286 150.93)" d="m720.56 288.69c-3.8785-0.004-7.7816 0.007-11.707 0.0312-215.33 1.3515-401.98 49.795-401.96 287.12 0.004 61.448 2.107 66.398 38 66.291 35.505-0.10987 736.28-0.85005 736.79-0.84375 27.427 0.34084 34.753-6.3263 34.623-53.201-0.6688-241.48-151.4-299.15-395.75-299.39zm371.68 377.5c-27.439 0.54879-708.75 0.66317-753.26 0.42187-22.202-0.12723-29.979 5.9118-29.979 24.912 0 39.304-2.973 342.86-1.2656 392.25 0.67134 19.419 11.401 25.145 25.756 25.334 32.092 0.4223 111.89 1.4725 141.45 0.8437 20.267-0.4223 28.992-10.111 29.979-39.268 0.92446-27.335-0.43421-72.631 0.42188-113.16 0.28867-13.666 5.0664-23.644 19-24.066 35.315-1.0701 171.06-1.0878 198.03-0.42187 34.201 0.84449 39.691 0.42137 40.535 35.889 1.0035 42.148 0.84287 67.981-0.42382 100.49-1.3533 34.735 10.135 38 28.713 38.422 27.438 0.6236 90.779-0.8903 122.45-0.4219 42.103 0.604 41.319-12.226 41.801-67.135 0.21772-23.648 0.0356-106.02-0.84375-143.56-0.21842-9.3247 4.646-15.94 10.979-16.045 25.815-0.4222 31.19 67.146 37.578 100.91 23.683 125.18 78.428 141.15 128.36 141.45 62.59 0.3921 122.23-51.499 122.45-158.34 0.033-16.086-3.3787-29.979-15.201-29.979-52.792 0-21.963 0.7739-49.822 0-14.778-0.4222-27.868 1.6879-24.912 24.488 2.9556 22.8 4.2539 65.3-24.49 66.291-12.245 0.4222-21.955-8.4458-21.955-33.357 0-24.912-1.7543-278.69-2.5332-298.94-0.4223-10.978-0.8449-27.446-22.801-27.023z"/><path fill="#fff" fill-rule="evenodd" transform="translate(-44.286 150.93)" d="m651.38 387.97 23.482 73.174-62.135 45.787 76.848 0.27929 24.346 73.244 24.014-73 77.182-0.52343-62.008-45.395 23.355-73.566-62.336 44.945-62.748-44.945zm235.18 0.8457 23.482 73.172-62.135 45.789 76.848 0.2793 24.348 73.242 24.012-73 77.182-0.52148-62.006-45.396 23.353-73.564-62.336 44.943-62.748-44.943zm-470.79 0.0274 23.482 73.172-62.135 45.789 76.848 0.27735 24.346 73.244 24.014-73 77.182-0.52149-62.008-45.396 23.354-73.564-62.334 44.943-62.748-44.943z"/></g></g></svg>`;
  }
  return `<svg class="${cls}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 2.5l2.6 5.7 6.2.6-4.7 4.1 1.4 6.1L12 16l-5.5 3.1 1.4-6.1-4.7-4.1 6.2-.6z"/></svg>`;
}
// 100%-stacked bar from [{frac, cls}] segments (race composition, D/R vote, …).
function stackBar(segs) {
  let x = 0;
  const rects = (segs || []).filter(s => s.frac > 0).map(s => {
    const w = s.frac * 100;
    const r = `<rect class="${s.cls}" x="${x.toFixed(2)}" y="0" width="${w.toFixed(2)}" height="10"/>`;
    x += w; return r;
  }).join('');
  return rects ? `<svg class="mini-stack" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">${rects}</svg>` : '';
}
// District outline overlaid on an equal-area circle (Polsby-Popper compactness:
// a compact district fills its circle; an irregular one spills out / leaves gaps).
function compactnessSvg(feature) {
  if (!feature || !window.d3) return '';
  try {
    const S = 100, pad = 8;
    const pg = d3.geoPath(d3.geoMercator().fitExtent([[pad, pad], [S - pad, S - pad]], feature));
    const dPath = pg(feature), [cx, cy] = pg.centroid(feature), r = Math.sqrt(Math.abs(pg.area(feature)) / Math.PI);
    if (!dPath || !isFinite(cx) || !isFinite(r) || r <= 0) return '';
    return `<svg class="mini-shape" viewBox="0 0 ${S} ${S}" aria-hidden="true">`
         + `<circle class="ms-circle" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}"/>`
         + `<path class="ms-district" d="${dPath}"/></svg>`;
  } catch (_) { return ''; }
}
// Smallest circle enclosing a set of [x,y] points (Welzl's algorithm) — for the
// Reock graphic (district drawn inside its minimum bounding circle).
function minEnclosingCircle(points) {
  const pts = points.slice();
  for (let i = pts.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [pts[i], pts[j]] = [pts[j], pts[i]]; }
  const inC = (c, p) => !!c && (p[0]-c.x)**2 + (p[1]-c.y)**2 <= c.r*c.r + 1e-7;
  const c2  = (a, b) => { const x=(a[0]+b[0])/2, y=(a[1]+b[1])/2; return { x, y, r: Math.hypot(a[0]-x, a[1]-y) }; };
  const c3  = (a, b, c) => {
    const ax=a[0],ay=a[1],bx=b[0],by=b[1],cx=c[0],cy=c[1];
    const d = 2*(ax*(by-cy)+bx*(cy-ay)+cx*(ay-by));
    if (Math.abs(d) < 1e-9) { // collinear — use the farthest pair
      const ps=[a,b,c]; let best=c2(a,b);
      for (const [p,q] of [[a,c],[b,c]]) { const cc=c2(p,q); if (cc.r>best.r) best=cc; }
      return best;
    }
    const a2=ax*ax+ay*ay, b2=bx*bx+by*by, cc2=cx*cx+cy*cy;
    const ux=(a2*(by-cy)+b2*(cy-ay)+cc2*(ay-by))/d;
    const uy=(a2*(cx-bx)+b2*(ax-cx)+cc2*(bx-ax))/d;
    return { x: ux, y: uy, r: Math.hypot(ax-ux, ay-uy) };
  };
  let c = null;
  for (let i = 0; i < pts.length; i++) {
    if (inC(c, pts[i])) continue;
    c = { x: pts[i][0], y: pts[i][1], r: 0 };
    for (let j = 0; j < i; j++) {
      if (inC(c, pts[j])) continue;
      c = c2(pts[i], pts[j]);
      for (let k = 0; k < j; k++) { if (!inC(c, pts[k])) c = c3(pts[i], pts[j], pts[k]); }
    }
  }
  return c;
}
// The district drawn inside its smallest enclosing circle (the Reock circle).
function reockSvg(feature) {
  if (!feature || !window.d3) return '';
  try {
    const S = 100, pad = 8;
    const proj = d3.geoMercator().fitExtent([[pad, pad], [S - pad, S - pad]], feature);
    const dPath = d3.geoPath(proj)(feature);
    const pts = [];
    const g = feature.geometry;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
    polys.forEach(poly => poly.forEach(ring => ring.forEach(([lon, lat]) => {
      const p = proj([lon, lat]); if (p && isFinite(p[0]) && isFinite(p[1])) pts.push(p);
    })));
    if (!dPath || pts.length < 3) return '';
    const c = minEnclosingCircle(pts);
    if (!c || !isFinite(c.r) || c.r <= 0) return '';
    return `<svg class="mini-shape" viewBox="0 0 ${S} ${S}" aria-hidden="true">`
         + `<circle class="ms-circle" cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="${c.r.toFixed(1)}"/>`
         + `<path class="ms-district" d="${dPath}"/></svg>`;
  } catch (_) { return ''; }
}
// The district (filled) within its state's outline — "where in the state it sits".
function stateLocatorSvg(stateFeat, distFeat) {
  if (!stateFeat || !window.d3) return '';
  try {
    const S = 100, pad = 6;
    const pg = d3.geoPath(d3.geoMercator().fitExtent([[pad, pad], [S - pad, S - pad]], stateFeat));
    const sPath = pg(stateFeat), dPath = distFeat ? pg(distFeat) : '';
    if (!sPath) return '';
    return `<svg class="mini-shape" viewBox="0 0 ${S} ${S}" aria-hidden="true">`
         + `<path class="ms-state" d="${sPath}"/>${dPath ? `<path class="ms-here" d="${dPath}"/>` : ''}</svg>`;
  } catch (_) { return ''; }
}

async function fetchAndRenderCensusPanel(districtData) {
  // District Profile now lives in the game-over card, so render its header here
  // (it used to be drawn when switching to the result-modal census tab).
  renderTabHeader('census-header');
  const censusLoading = document.getElementById('census-loading');
  const censusDataEl  = document.getElementById('census-data');
  if (!censusLoading || !censusDataEl) return;

  const d = await getDistrictCensusData();
  if (!d) {
    censusLoading.textContent = 'Census data unavailable for this district.';
    return;
  }

  const total    = parseInt(d.pop,       10);
  const whPct    = total > 0 ? Math.round(parseInt(d.whiteNH,  10) / total * 100) : 0;
  const blPct    = total > 0 ? Math.round(parseInt(d.black,    10) / total * 100) : 0;
  const hiPct    = total > 0 ? Math.round(parseInt(d.hispanic, 10) / total * 100) : 0;
  const asPct    = total > 0 ? Math.round(parseInt(d.asian,    10) / total * 100) : 0;
  const bachPlus = parseInt(d.bach, 10) + parseInt(d.master, 10);
  const edu25    = parseInt(d.edu_total, 10);
  const eduPct   = edu25 > 0 ? Math.round(bachPlus / edu25 * 100)
                 : total > 0 ? Math.round(bachPlus / total * 100) : 0;
  // ACS percentages arrive pre-computed (e.g. 38.6); show — when absent.
  const pv = (v, suf = '%') => (v == null || v === '') ? '—' : v + suf;

  // Shapefile-derived facts (precise values for District Profile)
  // Shapefile facts come from todayDistrict.properties in legacy mode; in server mode
  // the mystery feature is redacted, so they ride along in the revealed census (`d`).
  const areaMi2     = Math.round((d.area_sqmi ?? todayDistrict?.properties.area_sqmi) || 0);
  const delegCount  = (stateDistrictMap[districtData.state] || []).length;
  const margin      = d.Margin2024Pres ?? todayDistrict?.properties.Margin2024Pres;
  const pctDem      = Math.round((d.DemPct2024Pres ?? todayDistrict?.properties.DemPct2024Pres ?? 0) * 100);
  const pctRep      = Math.round((d.RepPct2024Pres ?? todayDistrict?.properties.RepPct2024Pres ?? 0) * 100);
  const absMar      = margin != null ? Math.abs(+margin * 100).toFixed(1) : null;
  const voteValue   = absMar == null ? 'No data'
    : +margin >  0.05 ? `D+${absMar}%`
    : +margin < -0.05 ? `R+${absMar}%`
    : 'Competitive';
  const voteSub     = absMar == null ? '' : `${pctDem}D / ${pctRep}R`;

  const density = areaMi2 > 0 ? Math.round(total / areaMi2) : 0;
  // Perimeter + Polsby-Popper compactness (4π·area/perimeter²; 1 = a circle, lower = more
  // irregular/gerrymandered-looking). Reported alongside the district area.
  const perimMi = Math.round(d.perimeter_mi || 0);
  const reock   = d.reock != null ? +d.reock : null;
  const ppScore = (areaMi2 > 0 && perimMi > 0) ? (4 * Math.PI * areaMi2) / (perimMi * perimMi) : null;
  const ppLabel = ppScore == null ? '' : ppScore >= 0.45 ? 'very compact'
                : ppScore >= 0.30 ? 'fairly compact' : ppScore >= 0.18 ? 'irregular' : 'very irregular';

  censusLoading.classList.add('hidden');
  censusDataEl.classList.remove('hidden');
  // Current U.S. House member (census->'rep', sourced from house.gov).
  const rep = d.rep && d.rep.name ? d.rep : null;
  const repName = rep
    ? (rep.url ? `<a href="${rep.url}" target="_blank" rel="noopener">${rep.name}</a>` : rep.name)
    : '—';
  const repParty = rep && rep.party
    ? `${rep.party}${rep.partyCode ? ` (${rep.partyCode})` : ''}`
    : 'Vacant';

  // Percentile ranks (census.pct) drive the plain-words "Higher than X% of districts" lines.
  const pct = d.pct || {};
  // Mini-graphic inputs: state-locator shape + stacked bars (compactness shapes are
  // built inline in the expander below).
  const stateSvg   = stateLocatorSvg(topoStates[districtData.state], todayDistrict);
  // Race/ethnicity groups, in bar order, with their legend swatch colors.
  const otherPct = Math.max(0, 100 - (whPct + blPct + hiPct + asPct));
  const raceGroups = [
    { name: 'White',    pct: whPct,    seg: 'seg-white', dot: 'rl-white' },
    { name: 'Black',    pct: blPct,    seg: 'seg-black', dot: 'rl-black' },
    { name: 'Hispanic', pct: hiPct,    seg: 'seg-hisp',  dot: 'rl-hisp'  },
    { name: 'Asian',    pct: asPct,    seg: 'seg-asian', dot: 'rl-asian' },
    { name: 'Other',    pct: otherPct, seg: 'seg-other', dot: 'rl-other' },
  ];
  const raceTop = raceGroups.reduce((a, b) => b.pct > a.pct ? b : a);
  const raceHeadline = total > 0 ? `${raceTop.pct}% ${raceTop.name}` : '—';
  // Stacked bar (bar order) + a color-keyed legend so the segments are identifiable.
  const raceStack  = total > 0 ? stackBar(raceGroups.map(g => ({ frac: g.pct / 100, cls: g.seg }))) : '';
  const raceLegend = total > 0 ? `<div class="race-legend">`
    + raceGroups.map(g => `<span><i class="rl-dot ${g.dot}"></i>${g.pct}% ${g.name}</span>`).join('')
    + `</div>` : '';
  const voteStack  = (pctDem || pctRep) ? stackBar([
    { frac: pctDem / 100, cls: 'seg-dem' },
    { frac: pctRep / 100, cls: 'seg-rep' },
    { frac: Math.max(0, 1 - (pctDem + pctRep) / 100), cls: 'seg-oth' },
  ]) : '';
  // Population change since the 2020 Census (pop2020 = decennial count, same boundaries).
  const popChange = (d.pop && d.pop2020) ? (d.pop - d.pop2020) / d.pop2020 * 100 : null;
  const popDelta  = (d.pop && d.pop2020) ? d.pop - d.pop2020 : null;
  const popDeltaStr = popDelta == null ? 'since the 2020 Census'
    : `${popDelta >= 0 ? '+' : '−'}${Math.abs(popDelta) >= 1000 ? Math.round(Math.abs(popDelta) / 1000) + 'k' : Math.abs(popDelta)} persons since 2020`;
  const partyEmblem = rep ? partyIcon(rep.partyCode, true) : '';
  // Compactness explainer — two labeled graphics (Polsby–Popper + Reock) in columns,
  // each with its score and how it ranks among all districts.
  // Plain-words compactness rank (the raw "more compact than 14%" percentile reads
  // backwards and is hard to parse). Higher percentile = more compact.
  const moreThan = p => {
    if (p == null || isNaN(p)) return '';
    if (p >= 0.8) return 'More compact than nearly all districts';
    if (p >= 0.6) return 'More compact than most districts';
    if (p >= 0.4) return 'About average compactness';
    if (p >= 0.2) return 'Less compact than most districts';
    return 'Less compact than nearly all districts';
  };
  const ppRankTxt = moreThan(pct.compactness);
  // The two shape graphics (+ score + rank) show right on the card; the definitions
  // of Polsby–Popper / Reock stay tucked in the expander.
  const ppGraphics = ppScore == null ? '' :
    `<div class="cmpct-cols">
       <div class="cmpct-col"><div class="cmpct-name">Polsby–Popper</div>${compactnessSvg(todayDistrict)}<div class="cmpct-val">${ppScore.toFixed(2)}</div></div>
       ${reock != null ? `<div class="cmpct-col"><div class="cmpct-name">Reock</div>${reockSvg(todayDistrict)}<div class="cmpct-val">${reock.toFixed(2)}</div></div>` : ''}
     </div>`;
  // Corner ⓘ hint + the explanation; the card toggles `.expanded` on click to reveal it.
  const ppCaption = ppScore == null ? '' :
    `<span class="ms-info" aria-hidden="true">ⓘ</span>
     <div class="ms-explain">
       <div class="cmpct-cols">
         <div class="cmpct-col"><div class="cmpct-rank">${moreThan(pct.compactness)}</div></div>
         <div class="cmpct-col"><div class="cmpct-rank">${moreThan(pct.reock)}</div></div>
       </div>
       <p class="cmpct-note">Both score 0–1; higher means a more regular shape.<br>Polsby–Popper compares the perimeter to a circle (penalizes squiggly lines)<br>Reock compares the area to the smallest circle that encloses the district (penalizes long, stretched shapes).</p>
     </div>`;

  censusDataEl.innerHTML = `
    <div class="census-grid">
      <div class="census-card census-shape-card census-rep">
        <div class="label">Current Representative</div>
        <div class="value">${repName}</div>
        <div class="sub">${rep ? rep.party : 'Vacant'}</div>
        ${partyEmblem}
      </div>
      <div class="census-card">
        <div class="label">District Plan Last Redrawn</div>
        <div class="value">${d.planYear ? d.planYear : (isAtLarge ? 'At-large' : '—')}</div>
        <div class="sub">${d.planYear ? (String(d.planYear) === '2022' ? 'post-2020 Census redistricting' : 'mid-decade redraw') : (isAtLarge ? 'single-district state — no redistricting' : '')}</div>
      </div>
      <div class="census-card">
        <div class="label">Population Change</div>
        <div class="value">${popChange != null ? (popChange >= 0 ? '+' : '−') + Math.abs(Math.round(popChange)) + '%' : '—'}</div>
        <div class="sub">${popDeltaStr}</div>
        ${pctBar(popChange, 'popChange', pct.popChange)}
      </div>
      <div class="census-card">
        <div class="label">2024 Presidential Vote</div>
        <div class="value">${voteValue}</div>
        <div class="sub">${voteSub}</div>
        ${voteStack}
        ${margin != null ? pctBar(Math.round(+margin * 100), 'margin', pct.margin, { rank: { hi: 'More Democratic', lo: 'More Republican' } }) : ''}
      </div>
      <div class="census-card">
        <div class="label">Demographics</div>
        <div class="value">${raceHeadline}</div>
        ${raceStack}${raceLegend}
      </div>
      <div class="census-card census-shape-card">
        <div class="label">Compactness</div>
        <div class="value">${ppScore != null ? ppLabel.replace(/^./, c => c.toUpperCase()) : '—'}</div>
        ${ppGraphics}
        ${ppCaption}
      </div>
      <div class="census-card">
        <div class="label">District Perimeter</div>
        <div class="value">${perimMi > 0 ? perimMi.toLocaleString() + ' mi' : '—'}</div>
        ${pctBar(perimMi, 'perimeter', pct.perimeter, { rank: { hi: 'Longer', lo: 'Shorter' } })}
      </div>
      <div class="census-card">
        <div class="label">District Area</div>
        <div class="value">${areaMi2 > 0 ? areaMi2.toLocaleString() + ' sq mi' : '—'}</div>
        <div class="sub">${density > 0 ? `${formatNumber(density)} people / sq mi` : '2026 district boundaries'}</div>
        ${pctBar(areaMi2, 'area', pct.area, { rank: { hi: 'Larger', lo: 'Smaller' } })}
      </div>
      <div class="census-card census-shape-card">
        <div class="label">State Delegation</div>
        <div class="value">${delegCount === 1 ? 'At-Large' : delegCount + ' districts'}</div>
        <div class="sub">${STATE_NAMES[districtData.state] || districtData.state}</div>
        ${stateSvg}
      </div>
      <div class="census-card">
        <div class="label">Foreign-Born</div>
        <div class="value">${pv(d.foreignBornPct)}</div>
        <div class="sub">of all residents were born abroad</div>
        ${pctBar(d.foreignBornPct, 'foreignBornPct', pct.foreignBornPct)}
      </div>
      <div class="census-card">
        <div class="label">Language</div>
        <div class="value">${pv(d.nonEnglishPct)}</div>
        <div class="sub">of residents 5+ speak a language other than English at home</div>
        ${pctBar(d.nonEnglishPct, 'nonEnglishPct', pct.nonEnglishPct)}
      </div>
      <div class="census-card">
        <div class="label">Median Age</div>
        <div class="value">${d.medianAge != null ? d.medianAge + ' yrs' : '—'}</div>
        <div class="sub">${pv(d.under18Pct)} under 18 · ${pv(d.age65Pct)} 65+</div>
        ${pctBar(d.medianAge, 'medianAge', pct.medianAge)}
      </div>
      <div class="census-card">
        <div class="label">Median Household Income</div>
        <div class="value">${parseInt(d.income,10) > 0 ? formatCurrency(d.income) : 'N/A'}</div>
        <div class="sub">${pv(d.povertyPct)} below poverty line</div>
        ${pctBar(+d.income, 'income', pct.income)}
      </div>
      <div class="census-card">
        <div class="label">Median Home Value</div>
        <div class="value">${parseInt(d.medianHome,10) > 0 ? formatCurrency(d.medianHome) : 'N/A'}</div>
        <div class="sub">${pv(d.homeownerPct)} owner-occupied</div>
        ${pctBar(+d.medianHome, 'medianHome', pct.medianHome)}
      </div>
      <div class="census-card">
        <div class="label">Median Gross Rent</div>
        <div class="value">${parseInt(d.medianRent,10) > 0 ? formatCurrency(d.medianRent) : 'N/A'}</div>
        <div class="sub">per month${d.avgHHSize != null ? ` · ${d.avgHHSize} people per household` : ''}</div>
        ${pctBar(+d.medianRent, 'medianRent', pct.medianRent)}
      </div>
      <div class="census-card">
        <div class="label">Bachelor's Degree+</div>
        <div class="value">${eduPct}%</div>
        <div class="sub">of adults 25+ have a bachelor's degree or more education</div>
        ${pctBar(eduPct, 'edu', pct.edu)}
      </div>
      <div class="census-card">
        <div class="label">Mean Commute</div>
        <div class="value">${d.meanCommuteMin != null ? d.meanCommuteMin + ' min' : '—'}</div>
        <div class="sub">${pv(d.transitPct)} transit · ${pv(d.wfhPct)} work from home</div>
        ${pctBar(d.meanCommuteMin, 'meanCommuteMin', pct.meanCommuteMin)}
      </div>
      <div class="census-card">
        <div class="label">Uninsured</div>
        <div class="value">${pv(d.uninsuredPct)}</div>
        <div class="sub">without health coverage</div>
        ${pctBar(d.uninsuredPct, 'uninsuredPct', pct.uninsuredPct)}
      </div>
      <div class="census-card">
        <div class="label">Veterans</div>
        <div class="value">${pv(d.veteranPct)}</div>
        <div class="sub">of adults 18+</div>
        ${pctBar(d.veteranPct, 'veteranPct', pct.veteranPct)}
      </div>
    </div>
    <div class="census-source">Sources: U.S. Census Bureau — ACS 5-Year (2019–2023) &amp; 2020 Census, aggregated to 2026 district boundaries; representative via house.gov. ${d.name}</div>
  `;
  // Content height is now known — size the sheet to it if it fits the available area.
  requestAnimationFrame(() => requestAnimationFrame(fitGameoverCensus));
}

// ============================================================
//  FACTS UI  (one per wrong guess; fact 0 always visible)
// ============================================================
function renderHintBar() {
  if (!todayDistrict) return;
  const bar = document.getElementById('hint-bar');
  if (!bar) return;
  if (!_gameStarted) { bar.innerHTML = ''; return; }

  // Hard mode: no textual hints during play (revealed once the game is over).
  if (hardMode && !gameOver) {
    bar.innerHTML = '<div class="hint-hard-note">Hard mode · no hints</div>';
    return;
  }

  bar.innerHTML = '';

  // Server mode: clues are pre-computed {icon,label,value}; `serverPuzzle.clues`
  // holds the unlocked-so-far set, `cluesTotal` the full count (rest are locked). Slot 0
  // is the always-on free clue (district area, revealed before any guess) when present —
  // folded into this same array/count server-side (see revealClues in the today/guess
  // edge functions) so the bar's total card count always matches MAX_GUESSES rather than
  // growing a 7th slot.
  if (serverPuzzle) {
    const unlocked = serverPuzzle.clues || [];
    const total    = serverPuzzle.cluesTotal || unlocked.length;
    for (let i = 0; i < total; i++) {
      const def      = unlocked[i];
      const revealed = i < unlocked.length;
      const isLatest = revealed && i === unlocked.length - 1;
      const card = document.createElement('div');
      card.className = 'hint-card' + (revealed ? ' revealed' + (isLatest ? ' latest' : '') : ' locked');
      card.setAttribute('role', 'listitem');
      if (revealed) {
        card.innerHTML = `
          <div class="hint-card-header">
            <span class="hint-card-icon">${svgIcon(def.icon, 'clue-icon-svg')}</span>
            <span class="hint-card-label">${def.label}</span>
          </div>
          <div class="hint-card-val"><span>${def.value}</span></div>`;
        if (!isLatest) {
          card.addEventListener('click', () => {
            renderHintsModal();
            document.getElementById('hints-modal')?.classList.remove('hidden');
          });
        }
      } else {
        card.innerHTML = `<div class="hint-card-header"><span class="hint-card-icon">${svgIcon('lock', 'clue-icon-svg')}</span></div>`;
      }
      bar.appendChild(card);
    }
    const latest = bar.querySelectorAll('.hint-card.revealed');
    if (latest.length) latest[latest.length - 1].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    return;
  }
  // Puzzle hasn't loaded yet — render nothing rather than read the redacted shape.
  bar.innerHTML = '';
}

function renderClues() {
  renderStateChips(); // update chip states whenever facts change
  updateUSRefMap();   // keep D3 map in sync
  renderHintBar();
  // hints-clues-list is populated lazily when the hints modal opens — not stored in DOM at rest
  updateHardModeLock();
}

// Turning Hard Mode OFF mid-game is harmless — it just reveals whatever hint/terrain this
// guess count would already show in normal mode, nothing the player hasn't earned. Turning
// it ON mid-game is blocked: by then the player has already seen clues/terrain hard mode is
// meant to withhold from the start, so switching to it now wouldn't actually hide anything
// they don't already know — only lock the OFF→ON direction, mid-game.
function updateHardModeLock() {
  const toggle = document.getElementById('settings-hard-toggle');
  const desc   = document.getElementById('settings-hard-desc');
  if (!toggle) return;
  const inProgress = Array.isArray(guessHistory) && guessHistory.length > 0 && !gameOver;
  const lockOn = inProgress && !hardMode;
  toggle.disabled = lockOn;
  toggle.closest('.settings-toggle-wrap')?.classList.toggle('disabled', lockOn);
  if (desc) desc.textContent = lockOn
    ? 'Can’t turn on mid-game — you’ve already seen this game’s clues'
    : 'No hints revealed — 6 guesses, shape only';
}

function renderHintsModal() {
  if (!todayDistrict) return;
  const list = document.getElementById('hints-clues-list');
  if (!list) return;
  list.innerHTML = '';

  if (serverPuzzle) {
    const unlocked = serverPuzzle.clues || [];
    const total    = serverPuzzle.cluesTotal || unlocked.length;
    for (let i = 0; i < total; i++) {
      const def      = unlocked[i];
      const revealed = i < unlocked.length;
      const div = document.createElement('div');
      if (revealed) {
        div.className = 'clue-item revealed';
        div.innerHTML = `
          <span class="clue-icon">${svgIcon(def.icon, 'clue-icon-svg')}</span>
          <span class="clue-text">
            <span class="clue-label">${def.label}</span>
            <span class="clue-val">${def.value}</span>
          </span>`;
      } else {
        div.className = 'clue-item locked';
        div.innerHTML = `<span class="clue-icon">${svgIcon('lock', 'clue-icon-svg locked')}</span><span class="clue-text">Locked — make a guess to reveal</span>`;
      }
      list.appendChild(div);
    }
    return;
  }
}

function districtDataFor(feature) {
  const state    = feature.properties.state;
  const sd       = feature.properties['state-district'] || '';
  const distPart = sd.slice(state.length + 1) || '01';
  // Census API uses '00' for at-large (single-district) states
  const censusDist = (stateDistrictMap[state] || []).length === 1 ? '00' : distPart;
  return { state, district: censusDist };
}

// ============================================================
//  TIMER
// ============================================================
function startTimer() {
  if (timerRunning) return;
  timerRunning = true;
  // Lock in how this game is being played the moment play begins.
  gameHardMode = hardMode;
  document.getElementById('timer-display').classList.add('running');
  timerInterval = setInterval(() => {
    elapsedSeconds++;
    const t = formatTime(elapsedSeconds);
    const tv = document.getElementById('timer-value');
    if (tv) tv.textContent = t;
    const tvi = document.getElementById('timer-value-inline');
    if (tvi) tvi.textContent = t;
    // Persist every 30s instead of every second to avoid thrashing localStorage
    if (elapsedSeconds % 30 === 0) saveGameState();
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerRunning = false;
  document.getElementById('timer-display').classList.remove('running');
}

// ============================================================
//  GUESS HANDLING
// ============================================================
function renderGuessHistory() {
  if (!_gameStarted) return;
  const el = document.getElementById('guess-history');
  const answerKey = todayDistrict?.properties['state-district'];
  const answerNeighbors = new Set(adjMap.get(answerKey) || []);
  el.innerHTML = guessHistory.map((g, idx) => {
    const iconName = g.correct ? 'checkCircle' : 'xCircle';
    const cls      = g.correct ? 'correct' : 'wrong';

    if (g.phase === 'state') {
      const label = STATE_NAMES[g.text] || g.text;
      const stateAbbr = g.text.substring(0, 2).toUpperCase();

      if (!g.correct) {
        const hint = g.adjacent
          ? `<span class="guess-hint hot">${svgIcon('flame','hint-icon')} Adjacent</span>`
          : `<span class="guess-hint cold">${svgIcon('snowflake','hint-icon')} Not adjacent</span>`;
        return `<div class="guess-row ${cls}">
          <span class="guess-icon guess-icon-state-slot" data-state="${stateAbbr}">${svgIcon(iconName,'guess-icon-svg')}</span>
          <span class="guess-label">${label}</span>${hint}
        </div>`;
      }
      return `<div class="guess-row ${cls}">
        <span class="guess-icon guess-icon-state-slot" data-state="${stateAbbr}">${svgIcon(iconName,'guess-icon-svg')}</span>
        <span class="guess-label">${label}</span>
        <span class="guess-hint hot">Correct state!</span>
      </div>`;
    }

    // District phase
    const distPart   = g.text.split('-').slice(1).join('-');
    const guessState = g.text.split('-')[0];
    const distLabel  = (stateDistrictMap[guessState] || []).length === 1
      ? 'At-Large' : `District ${parseInt(distPart, 10)}`;
    let distHint = '';
    // Server mode stores the hot/cold flag on the guess (the answer is unknown to
    // the client); legacy infers it from the answer's adjacency graph.
    const distAdjacent = (typeof g.adjacent === 'boolean')
      ? g.adjacent
      : (answerNeighbors ? answerNeighbors.has(g.text) : null);
    if (g.correct) {
      distHint = `<span class="guess-hint hot">Correct!</span>`;
    } else if (distAdjacent === true) {
      distHint = `<span class="guess-hint hot">${svgIcon('flame','hint-icon')} Adjacent</span>`;
    } else if (distAdjacent === false) {
      distHint = `<span class="guess-hint cold">${svgIcon('snowflake','hint-icon')} Not adjacent</span>`;
    }
    return `<div class="guess-row ${cls}">
      <span class="guess-icon">${svgIcon(iconName,'guess-icon-svg')}</span>
      <span class="guess-label">${distLabel}</span>
      ${distHint}
    </div>`;
  }).join('');

  const remaining = MAX_GUESSES - guessCount;
  const remEl = document.getElementById('guess-remaining');
  if (!gameOver) {
    remEl.textContent = remaining === 1
      ? '1 guess remaining'
      : `${remaining} guesses remaining`;
  } else {
    remEl.textContent = '';
  }

  updateGuessCounter();

  // Load state boundary SVGs asynchronously for state guesses
  el.querySelectorAll('.guess-icon-state-slot').forEach(slot => {
    const stateAbbr = slot.dataset.state;
    if (stateAbbr) {
      getStateSvg(stateAbbr).then(svg => {
        if (svg) {
          slot.innerHTML = `<div class="state-svg-container">${svg}</div>`;
        }
      });
    }
  });
}

/** Render the small dot-row guess progress indicator in the reference panel. */
function updateGuessCounter() {
  const el = document.getElementById('guess-counter');
  if (!el) return;

  // Build a counted-guess list: wrong guesses (both phases) + the winning guess if any.
  // Excludes the correct-state transition (it doesn't cost a guess).
  const countedGuesses = guessHistory.filter(g => !g.correct || g.phase === 'district');
  const dots = Array.from({ length: MAX_GUESSES }, (_, i) => {
    const g = countedGuesses[i];
    if (!g) return '<span class="gc-dot gc-empty"></span>';
    if (g.correct) return `<span class="gc-dot gc-used gc-correct">${svgIcon('checkCircle','gc-icon-svg')}</span>`;
    return `<span class="gc-dot gc-used gc-wrong">${svgIcon('xCircle','gc-icon-svg')}</span>`;
  }).join('');

  const used    = guessCount;
  const wonGame = guessHistory.some(g => g.correct);
  const label   = gameOver
    ? (wonGame ? 'Solved!' : 'No more guesses')
    : used === 0
      ? `${MAX_GUESSES} guesses`
      : `${used} / ${MAX_GUESSES} · ${MAX_GUESSES - used} left`;

  const timerVal = document.getElementById('timer-value-inline');
  const timerHtml = `<div id="timer-display-inline" class="timer-inline">${svgIcon('clock','icon')}<span id="timer-value-inline">${timerVal ? timerVal.textContent : '0:00'}</span></div>`;
  el.innerHTML = `<div class="gc-dots">${dots}</div><span class="gc-label">${label}</span>${timerHtml}`;
}

// ---- Hard mode ----
let hardMode = localStorage.getItem('districtguess_hardMode') === '1';
// True only if the player was in hard mode for the WHOLE game. Seeded at the first guess
// (startTimer) and latched to false the instant hard mode is turned off during play — so
// flipping it off to peek at hints/imagery, even briefly, disqualifies the game. Turning
// it back on later does NOT restore it. Drives the share text (and, later, the results DB).
let gameHardMode = hardMode;

// ---- Confirm-selection mode ----
let confirmInputMode   = localStorage.getItem('districtguess_confirmMode') === '1';
let _pendingConfirmAbbr = null;

function setConfirmPending(abbr) {
  _pendingConfirmAbbr = abbr;
  const hint = document.getElementById('confirm-hint');
  if (hint) {
    hint.textContent = abbr ? `Tap ${abbr} again to confirm` : 'Tap again to confirm';
    hint.classList.toggle('visible', !!abbr);
  }
  // Highlight the pending state in blue ("selected — tap again to confirm"),
  // restore others. NOT gold (#FDB515) — gold is the correct-answer/win color and
  // reading a pending wrong pick as "correct" is confusing.
  // Use a stroke outline, not a fill — on touch the wrong-flash red is close to the
  // in-play state fill, so a fill change is hard to see; an outline reads clearly.
  // raise() lifts the path above the white border mesh so the outline isn't clipped.
  const PENDING = isDarkMode() ? '#ffffff' : '#000000';
  Object.entries(usRefLayers).forEach(([a, pathEl]) => {
    if (a === abbr) {
      pathEl.attr('stroke', PENDING).attr('stroke-width', 3)
            .attr('stroke-opacity', 1).attr('vector-effect', 'non-scaling-stroke').raise();
    } else {
      _applyStateStyle(pathEl, a);   // resets stroke to none
    }
  });
  Object.entries(usRefCallouts).forEach(([a, co]) => {
    // Raise the whole group (not just the ellipse) so the pending outline lifts above
    // its neighbours while keeping the text label on top of its own filled pill —
    // raising the ellipse alone would bury the label behind it.
    if (a === abbr) { co.circle.attr('stroke', PENDING).attr('stroke-width', 2.5); co.group.raise(); }
    else _applyCalloutStyle(a);
  });
}

function handleStateSelection(abbr) {
  if (!confirmInputMode) { submitStateGuess(abbr); return; }
  if (_pendingConfirmAbbr === abbr) {
    setConfirmPending(null);
    submitStateGuess(abbr);
  } else {
    setConfirmPending(abbr);
  }
}

// Called when a state is chosen via map click or chip click.
let _guessLocked = false; // prevent double-submit during animation
function submitStateGuess(abbr) {
  if (gameOver || correctStateGuessed || _guessLocked) return;
  submitStateGuessServer(abbr);
}

// ── Phase 2: district tile input ──────────────────────────────
let _distLocked = false; // prevent double-tap during tile animation

function submitDistrictTile(dist) {
  if (gameOver || !correctStateGuessed || _distLocked) return;
  submitDistrictTileServer(dist);
}

// Alias used by the D3 map click handlers
const submitDistrictGuess = submitDistrictTile;

// Animated game-over reveal: the clicked tile morphs from a circle into a full-viewport
// rectangle via D3 shape tweening (4 cubic bezier segments, same structure on both ends
// so numeric interpolation is smooth). Once the fill covers the screen, endGame() runs
// under cover, then the shape fades out to reveal the result.
function startGameOverTransition(won, dist, opts = {}) {
  // opts.ready: a promise to await before swapping to the game-over screen (e.g. the
  // answer state's district shapes loading on a state-phase loss). The expanding fill
  // covers the wait so there's no dead pause.
  const ready = opts.ready || null;
  const tilesEl = document.getElementById('us-ref-map');   // tiles live in the shared map now

  // Tile center and radius in viewport (CSS pixel) coordinates.
  const tileG  = tilesEl?.querySelector(`g.district-tile[data-dist="${dist}"]`);
  const circleEl = tileG?.querySelector('circle');
  let ox = window.innerWidth  / 2;
  let oy = window.innerHeight / 2;
  let tileR = 14; // fallback
  if (circleEl) {
    const cr = circleEl.getBoundingClientRect();
    ox    = cr.left + cr.width  / 2;
    oy    = cr.top  + cr.height / 2;
    tileR = cr.width / 2;
  } else if (serverState && usRefLayers[serverState]) {
    // State-phase loss (no district tile yet): emanate from the answer state on the map.
    const sr = usRefLayers[serverState].node().getBoundingClientRect();
    if (sr.width) { ox = sr.left + sr.width / 2; oy = sr.top + sr.height / 2; }
  }

  const W = window.innerWidth, H = window.innerHeight;
  const fillColor = won ? '#FDB515' : '#C41230';

  // Full-viewport SVG overlay for the shape tween.
  const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svgEl.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svgEl.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:1000;pointer-events:none;overflow:visible';
  document.body.appendChild(svgEl);
  const pathEl = d3.select(svgEl).append('path').attr('fill', fillColor);

  // Encode both shapes as 26 numbers: [startX, startY] + 4 × [c1x,c1y,c2x,c2y,ex,ey].
  // Each uses 4 cubic bezier arcs of 90°.
  //
  // The circle starts at its DIAGONAL points (45°/135°/225°/315°), which map directly to
  // the rectangle's CORNERS — making corners path *endpoints* (not control points) so the
  // rectangle ends with sharp 90° corners instead of rounded ones.
  //
  // k = bezier magic number for 90° arc; D = 1/√2 (diagonal unit)
  const k = 0.5522847498, D = 1 / Math.SQRT2;
  const a = D, b = (1 + k) * D, c = (1 - k) * D, r = tileR;

  const circleNums = [
    ox - r*a, oy - r*a,                                              // M  TL diagonal
    ox - r*c, oy - r*b,  ox + r*c, oy - r*b,  ox + r*a, oy - r*a,  // C1 TL→TR (via top)
    ox + r*b, oy - r*c,  ox + r*b, oy + r*c,  ox + r*a, oy + r*a,  // C2 TR→BR (via right)
    ox + r*c, oy + r*b,  ox - r*c, oy + r*b,  ox - r*a, oy + r*a,  // C3 BR→BL (via bottom)
    ox - r*b, oy + r*c,  ox - r*b, oy - r*c,  ox - r*a, oy - r*a,  // C4 BL→TL (via left)
  ];

  // Corners are endpoints; control points lie on the edges → sharp 90° corners.
  const rectNums = [
    0,     0,                                // M  top-left corner
    W/3,   0,    2*W/3, 0,    W,   0,       // C1 TL→TR along top edge
    W,     H/3,  W,     2*H/3, W,  H,       // C2 TR→BR along right edge
    2*W/3, H,    W/3,   H,    0,   H,       // C3 BR→BL along bottom edge
    0,     2*H/3, 0,    H/3,  0,   0,       // C4 BL→TL along left edge
  ];

  const toPath = n =>
    `M${n[0]},${n[1]}` +
    `C${n[2]},${n[3]},${n[4]},${n[5]},${n[6]},${n[7]}` +
    `C${n[8]},${n[9]},${n[10]},${n[11]},${n[12]},${n[13]}` +
    `C${n[14]},${n[15]},${n[16]},${n[17]},${n[18]},${n[19]}` +
    `C${n[20]},${n[21]},${n[22]},${n[23]},${n[24]},${n[25]}Z`;

  const interp = d3.interpolateNumberArray(circleNums, rectNums);

  pathEl.attr('d', toPath(circleNums))
    .transition()
    .duration(400)
    .ease(d3.easeCubicInOut)
    .attrTween('d', () => t => toPath(interp(t)))
    .on('end', async () => {
      // The fill holds full-screen while `ready` resolves, then we build the game-over
      // screen behind it, land on the result modal, and hand the gold/red flash off to
      // the result background before revealing it. Errors must never leave the screen
      // locked on the flash, so always remove the overlay.
      try {
        if (ready) { try { await ready; } catch (_) {} }
        endGame(won, { skipAnims: true });
        showGameoverModal();   // build the game-over screen…
        // Daily lands on the result modal; archive stays on the game-over screen with the
        // archived district's profile (its result modal is today-only — reached via the
        // game-over screen's "Today's Results" button, which returns to the daily).
        if (!isArchiveGame) openResultModal();
        _gameOverAnimsCallback = null;
        // Tween the flash colour to the destination's background, then fade it away —
        // the result modal's --surface for the daily, the game-over --bg for archive.
        const destVar = isArchiveGame ? '--bg' : '--surface';
        const surface = getComputedStyle(document.documentElement).getPropertyValue(destVar).trim() || '#ffffff';
        pathEl.transition().duration(300).ease(d3.easeCubicInOut).style('fill', surface)
          .transition().duration(220).style('opacity', 0)
          .on('end', () => svgEl.remove());
      } catch (e) {
        console.error('game-over reveal error:', e);
        reportClientError('gameover_reveal', e);
        svgEl.remove();
      }
    });
}

// ============================================================
//  REFERENCE PANEL
// ============================================================

// Returns the set of state abbreviations still in play.
// Valid = not yet eliminated by the adjacency-based hot/cold mechanic.
function getValidStates() {
  const all = Object.keys(stateDistrictMap);
  if (!todayDistrict) return new Set(all);
  return new Set(all.filter(abbr => !eliminatedStates.has(abbr)));
}

// Inverted lookup: full name → abbreviation (built from STATE_NAMES)
const STATE_ABBR_BY_NAME = {};
for (const [abbr, name] of Object.entries(STATE_NAMES)) STATE_ABBR_BY_NAME[name] = abbr;

// FIPS code → state abbreviation (for us-atlas TopoJSON)
const FIPS_TO_ABBR = {
  '01':'AL','02':'AK','04':'AZ','05':'AR','06':'CA','08':'CO','09':'CT',
  '10':'DE','11':'DC','12':'FL','13':'GA','15':'HI','16':'ID','17':'IL',
  '18':'IN','19':'IA','20':'KS','21':'KY','22':'LA','23':'ME','24':'MD',
  '25':'MA','26':'MI','27':'MN','28':'MS','29':'MO','30':'MT','31':'NE',
  '32':'NV','33':'NH','34':'NJ','35':'NM','36':'NY','37':'NC','38':'ND',
  '39':'OH','40':'OK','41':'OR','42':'PA','44':'RI','45':'SC','46':'SD',
  '47':'TN','48':'TX','49':'UT','50':'VT','51':'VA','53':'WA','54':'WV',
  '55':'WI','56':'WY'
};

// ============================================================
//  DARK MODE
// ============================================================
function isDarkMode() {
  return document.body.classList.contains('dark-mode') ||
    (!document.body.classList.contains('light-mode') &&
     window.matchMedia('(prefers-color-scheme: dark)').matches);
}

function applyDarkModeClass() {
  const saved = localStorage.getItem('districtguess_theme');
  if (saved === 'dark')  document.body.classList.add('dark-mode');
  if (saved === 'light') document.body.classList.add('light-mode');
}

function toggleDarkMode() {
  const dark = isDarkMode();
  document.body.classList.toggle('dark-mode',  !dark);
  document.body.classList.toggle('light-mode',  dark);
  localStorage.setItem('districtguess_theme', dark ? 'light' : 'dark');
  updateThemeToggle();
  updateUSRefMap(); // repaint D3 reference map with new color scheme
  // Swap Leaflet street tiles to match new theme
  if (map && streetLayer) {
    map.removeLayer(streetLayer);
    streetLayer = L.tileLayer(streetTileUrl(), {
      maxZoom: 19,
      opacity: _streetOpacity,
      attribution: streetTileAttrib(),
    }).addTo(map);
  }
  // Re-apply map tile stage (dark mode skips terrain, prefers satellite)
  if (map) {
    const wrongCount = guessHistory.filter(g => !g.correct).length;
    applyMapStage(wrongCount, gameOver);
  }
  // Update district boundary color for new theme
  if (districtLayer) districtLayer.setStyle(districtStyle());
  // Rebuild game-over context map so colors match new theme
  if (gameOver && todayDistrict) buildDistrictD3Map(todayDistrict.properties.state);
}

function updateThemeToggle() {
  const cb = document.getElementById('settings-dark-toggle');
  if (cb) cb.checked = isDarkMode();
}

// First-visit discoverability for the Settings gear: a small, non-blocking callout that
// points at the icon (plus a brief icon pulse) instead of force-opening the modal. It
// clears itself after 5s or on the player's first interaction with the gear.
let _settingsHintTimer = null;
function dismissSettingsHint() {
  if (_settingsHintTimer) { clearTimeout(_settingsHintTimer); _settingsHintTimer = null; }
  document.getElementById('settings-btn')?.classList.remove('hint-pulse');
  const hint = document.getElementById('settings-hint');
  if (hint) { hint.classList.remove('show'); setTimeout(() => hint.remove(), 250); }
}
function showSettingsHint() {
  const btn = document.getElementById('settings-btn');
  if (!btn || document.getElementById('settings-hint')) return;
  // On first visit the "How to Play" modal is up over the header — wait until it's
  // dismissed (any method) so the callout isn't hidden behind it or timed out unseen.
  const howTo = document.getElementById('how-to-modal');
  if (howTo && !howTo.classList.contains('hidden')) {
    const mo = new MutationObserver(() => {
      if (howTo.classList.contains('hidden')) { mo.disconnect(); setTimeout(showSettingsHint, 350); }
    });
    mo.observe(howTo, { attributes: true, attributeFilter: ['class'] });
    return;
  }
  const hint = document.createElement('div');
  hint.id = 'settings-hint';
  hint.className = 'settings-hint';
  hint.innerHTML = '<span class="settings-hint-gear">⚙️</span> Customize the theme &amp; map here';
  document.body.appendChild(hint);
  // Anchor below the gear with the arrow pointing up at it (arrow sits 18px from the
  // bubble's left edge, so offset the bubble so that arrow lands on the gear's center).
  const r = btn.getBoundingClientRect();
  hint.style.top  = `${Math.round(r.bottom + 10)}px`;
  hint.style.left = `${Math.round(r.left + r.width / 2 - 18)}px`;
  btn.classList.add('hint-pulse');
  requestAnimationFrame(() => hint.classList.add('show'));
  hint.addEventListener('click', dismissSettingsHint);
  btn.addEventListener('click', dismissSettingsHint, { once: true });
  _settingsHintTimer = setTimeout(dismissSettingsHint, 5000);
}

// ---- US reference map (clickable states) ----

// ---- D3 AlbersUSA reference map ----

// Returns theme-aware D3 map colors
// Hover fill used in initUSRefMap mouseover — kept in sync here.
const STATE_COLOR = {
  // Light mode
  light: {
    valid:     { fill: '#d4606e', opacity: 1.0 },   // saturated salmon-red — clearly "in play"
    elim:      { fill: '#b8bcc4', opacity: 1.0 },   // blue-gray — clearly "out"
    confirmed: { fill: '#C41230', opacity: 1.0 },   // solid CMU red — the answer
    hover:     '#a01025',                            // darker red — clear interactive feedback
  },
  // Dark mode
  dark: {
    valid:     { fill: '#9b2d3e', opacity: 1.0 },   // medium crimson — warm on dark bg
    elim:      { fill: '#48484a', opacity: 1.0 },   // dark gray — clearly inactive
    confirmed: { fill: '#e8314a', opacity: 1.0 },   // bright red — pops on dark bg
    hover:     '#ff4d62',                            // bright pink-red — obvious on dark
  },
};

function _stateColors(abbr) {
  const c = isDarkMode() ? STATE_COLOR.dark : STATE_COLOR.light;

  if (correctStateGuessed) {
    const confirmed = todayDistrict ? todayDistrict.properties.state : null;
    if (abbr === confirmed) return c.confirmed;
    return c.elim;
  }
  const valid = getValidStates();
  return valid.has(abbr) ? c.valid : c.elim;
}

// Layered model: a static grey basemap (layer-basemap) sits behind these live state paths.
// In-play states paint salmon (the answer paints red); out-of-play states fade their fill to
// transparent so the grey basemap shows through and stop receiving pointer events — i.e. an
// eliminated state is literally "dropped" from the live layer rather than recoloured grey.
function _applyStateStyle(sel, abbr) {
  const c = isDarkMode() ? STATE_COLOR.dark : STATE_COLOR.light;
  const confirmed = correctStateGuessed && todayDistrict && todayDistrict.properties.state === abbr;
  const inPlay    = !correctStateGuessed && getValidStates().has(abbr);
  sel.attr('stroke', 'none');   // borders drawn as separate white mesh overlay
  if (confirmed) {
    sel.attr('fill', c.confirmed.fill).attr('fill-opacity', 1).style('pointer-events', null).style('cursor', 'default');
  } else if (inPlay) {
    sel.attr('fill', c.valid.fill).attr('fill-opacity', 1).style('pointer-events', null).style('cursor', 'pointer');
  } else {
    sel.attr('fill', c.valid.fill).attr('fill-opacity', 0).style('pointer-events', 'none').style('cursor', 'default');
  }
}

// Grey backdrop colour for the static basemap (theme-aware).
function _basemapFill() {
  return (isDarkMode() ? STATE_COLOR.dark : STATE_COLOR.light).elim.fill;
}

// Toggle interaction on the live state layer — used to freeze hover/click while a guess is
// in flight to the server (so a state can't re-highlight mid-request).
function _setStatePickInteractive(on) {
  if (!usRefMapGroup) return;
  const layer = d3.select(usRefMapGroup).select('.layer-states');
  if (!layer.empty()) layer.style('pointer-events', on ? null : 'none');
}

// Inner point [lon,lat] for a state. Prefers the interior point baked into the topojson at
// build time (states.topojson `innerX/innerY`, from mapshaper's guaranteed-inside label
// point — see build-server-assets.mjs). Falls back to the largest sub-polygon's centroid
// for any feature without it (e.g. archive states injected from another source). The
// whole-feature centroid of a concave / multi-part state (FL panhandle, MI's two
// peninsulas, HI's island chain) can fall in the water, which is why we don't use it.
function _stateInnerPoint(feat) {
  const p = (feat && feat.properties) || {};
  if (isFinite(p.innerX) && isFinite(p.innerY)) return [p.innerX, p.innerY];
  const geom = feat && feat.geometry;
  if (geom && geom.type === 'MultiPolygon') {
    const largest = geom.coordinates.reduce((best, poly) =>
      d3.geoArea({ type: 'Feature', geometry: { type: 'Polygon', coordinates: poly } })
        > d3.geoArea({ type: 'Feature', geometry: { type: 'Polygon', coordinates: best } }) ? poly : best);
    return d3.geoCentroid({ type: 'Feature', geometry: { type: 'Polygon', coordinates: largest } });
  }
  return d3.geoCentroid(feat);
}

// Stamp the guess-history check icon (checkCircle) on a correctly-guessed state, sized to
// fit inside the state's bbox with padding and centred on its inner point. Shown briefly
// before the zoom into the district phase.
function _showStateCheck(abbr) {
  _hideStateCheck();
  if (!usRefMapGroup || !usRefPathGen || !usRefProjection) return;
  const feat = topoStates[abbr];
  if (!feat) return;
  const b = usRefPathGen.bounds(feat);
  const c = usRefProjection(_stateInnerPoint(feat));
  if (!b || !isFinite(b[0][0]) || !c || !isFinite(c[0])) return;
  const w = b[1][0] - b[0][0], h = b[1][1] - b[0][1];
  // Fit to ~55% of the state's smaller dimension → padding remains inside the state.
  const side = Math.max(4, Math.min(w, h) * 0.25);
  const g = d3.select(usRefMapGroup).append('g').attr('class', 'state-check').attr('pointer-events', 'none');
  g.html(`<svg x="${c[0] - side / 2}" y="${c[1] - side / 2}" width="${side}" height="${side}" `
    + `viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" stroke-width="2.2" `
    + `stroke-linecap="round" stroke-linejoin="round" class="guess-icon-svg state-check-icon">`
    + `${ICON_PATHS.checkCircle}</svg>`);
}
function _hideStateCheck() {
  if (usRefMapGroup) d3.select(usRefMapGroup).select('.state-check').remove();
}

// Resize/reposition callouts based on current zoom k.
// k=1 → full offshore + full size; higher k → lerp toward anchor, shrink, fade.
function _updateCalloutsForZoom(k) {
  _usRefZoomK = k || 1;
  const K_FULL = 1.0;
  const K_HIDE = 2.4;
  const t = Math.max(0, Math.min(1, (k - K_FULL) / (K_HIDE - K_FULL)));
  const inv = 1 / k;

  for (const abbr of Object.keys(usRefCallouts)) {
    const co = usRefCallouts[abbr];
    // Callouts stay at their stacked offshore position; only fade out with zoom.
    const x = co.offX;
    const y = co.offY;
    const rx = CALLOUT_RX * inv;
    const ry = CALLOUT_RY * inv;
    const fontSize = 11 * inv;

    co.circle.attr('cx', x).attr('cy', y).attr('rx', rx).attr('ry', ry);
    co.text.attr('x', x).attr('y', y).attr('font-size', fontSize);
    co.line
      .attr('x2', x).attr('y2', y)
      .attr('stroke-width', 0.8 * inv);

    // Solid at any in/out-of-play state — the fill colour (salmon vs grey) signals
    // eliminated, matching the state layer, so no extra opacity de-emphasis. Only the
    // zoom-fade (t) reduces it as the map zooms in.
    const opacity = 1 - t;
    co.group.style('opacity', opacity);
    co.group.style('pointer-events', opacity < 0.15 ? 'none' : null);
  }
}

function _applyCalloutStyle(abbr) {
  const co = usRefCallouts[abbr];
  if (!co) return;
  const s = _stateColors(abbr);
  const clickable = !correctStateGuessed && getValidStates().has(abbr);
  const stroke = isDarkMode() ? '#ffffff' : '#ffffff';
  co.circle
    .attr('fill', s.fill)
    .attr('fill-opacity', s.opacity)
    .attr('stroke', stroke)
    .attr('stroke-width', 0.25)
    .style('cursor', clickable ? 'pointer' : 'default');
  co.line
    .attr('stroke', s.fill)
    .attr('stroke-opacity', 0.7);
  // Opacity is controlled jointly by zoom level and clickability — applied in _updateCalloutsForZoom.
  _updateCalloutsForZoom(_usRefZoomK);
}

let _usRefZoomK = 1;

// Small/dense states that are easy to misclick — render a labeled
// callout badge offshore connected by a leader line.
const CALLOUT_STATES = ['VT', 'NH', 'MA', 'RI', 'CT', 'NJ', 'DE', 'MD'];
const CALLOUT_RX = 14;   // ellipse horizontal radius
const CALLOUT_RY = 8.5;  // ellipse vertical radius
const CALLOUT_GAP = 8;   // vertical pixel gap between stacked ellipses

function _addStateCallouts(g, geojson, pathGen, fipsToFeature) {
  // Collect, sorted north-to-south by each state's bbox upper bound (min y in projection).
  const items = [];
  let maxEast = -Infinity;
  CALLOUT_STATES.forEach((abbr) => {
    const fips = Object.keys(FIPS_TO_ABBR).find(k => FIPS_TO_ABBR[k] === abbr);
    const feature = fipsToFeature[fips];
    if (!feature) return;
    const [cx, cy] = pathGen.centroid(feature);
    if (!isFinite(cx)) return;
    const b = pathGen.bounds(feature); // [[x0,y0],[x1,y1]]
    items.push({ abbr, anchorX: cx, anchorY: cy, topY: b[0][1], eastX: b[1][0] });
    if (b[1][0] > maxEast) maxEast = b[1][0];
  });
  items.sort((a, b) => a.topY - b.topY);

  // Stack left-aligned at a common X just east of the eastmost state's edge.
  const stackX = maxEast + 28 + CALLOUT_RX;

  const layer = g.append('g').attr('class', 'us-ref-callouts');

  // Place labels evenly spaced (N→S order), centered at the mean anchor Y.
  // This is O(n) and guaranteed collision-free regardless of how close anchors are.
  const minSpacing = 2 * CALLOUT_RY + CALLOUT_GAP;
  const nodes = items.map(it => ({
    abbr: it.abbr,
    anchorX: it.anchorX,
    anchorY: it.anchorY,
    x: stackX,
    y: it.anchorY,
  }));
  nodes.sort((a, b) => a.anchorY - b.anchorY);
  const meanAnchorY = nodes.reduce((s, n) => s + n.anchorY, 0) / nodes.length;
  const totalH  = (nodes.length - 1) * minSpacing;
  const startY  = Math.max(CALLOUT_RY + 2,
                    Math.min(_usRefH - CALLOUT_RY - totalH - 2,
                      meanAnchorY - totalH / 2));
  nodes.forEach((n, i) => { n.y = startY + i * minSpacing; });

  nodes.forEach(n => {
    const grp = layer.append('g').attr('data-abbr', n.abbr);
    const line = grp.append('line')
      .attr('x1', n.anchorX).attr('y1', n.anchorY)
      .attr('x2', n.x).attr('y2', n.y)
      .attr('stroke-width', 0.8)
      .attr('vector-effect', 'non-scaling-stroke')
      .attr('pointer-events', 'none');
    const circle = grp.append('ellipse')
      .attr('cx', n.x).attr('cy', n.y)
      .attr('rx', CALLOUT_RX).attr('ry', CALLOUT_RY)
      .attr('vector-effect', 'non-scaling-stroke');
    const textSel = grp.append('text')
      .attr('x', n.x).attr('y', n.y)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('font-size', 11)
      .attr('font-weight', '700')
      .attr('fill', '#ffffff')
      .attr('pointer-events', 'none')
      .text(n.abbr);

    usRefCallouts[n.abbr] = {
      group: grp, circle, line, text: textSel,
      anchorX: n.anchorX, anchorY: n.anchorY,
      offX: n.x, offY: n.y,
    };

    const tooltip = document.getElementById('us-ref-tooltip');
    circle
      .on('click', () => {
        if (tooltip) tooltip.classList.remove('visible'); // map rebuilds on guess → mouseout won't fire
        if (gameOver || correctStateGuessed) return;
        if (!getValidStates().has(n.abbr)) return;
        handleStateSelection(n.abbr);
      })
      .on('mouseover', (event) => {
        if (tooltip && !window.matchMedia('(pointer: coarse)').matches) {
          tooltip.textContent = (STATE_NAMES[n.abbr] || n.abbr) + ' (' + n.abbr + ')';
          tooltip.classList.add('visible');
          tooltip.style.left = (event.clientX + 14) + 'px';
          tooltip.style.top  = (event.clientY - 34) + 'px';
        }
        if (!window.matchMedia('(pointer: coarse)').matches
            && !correctStateGuessed && getValidStates().has(n.abbr)) {
          const hoverColor = isDarkMode() ? STATE_COLOR.dark.hover : STATE_COLOR.light.hover;
          circle.attr('fill', hoverColor).attr('fill-opacity', 1.0);
          // Also flash the actual state path
          const pathEl = usRefLayers[n.abbr];
          if (pathEl) pathEl.attr('fill', hoverColor).attr('fill-opacity', 1.0);
        }
      })
      .on('mousemove', (event) => {
        if (tooltip) {
          tooltip.style.left = (event.clientX + 14) + 'px';
          tooltip.style.top  = (event.clientY - 34) + 'px';
        }
      })
      .on('mouseout', () => {
        if (tooltip) tooltip.classList.remove('visible');
        _applyCalloutStyle(n.abbr);
        const pathEl = usRefLayers[n.abbr];
        if (pathEl) _applyStateStyle(pathEl, n.abbr);
      });

    _applyCalloutStyle(n.abbr);
  });
}

// Build the US states reference map on demand (idempotent). Kept out of the
// welcome-loader window so the heavy D3/topojson build doesn't freeze the spinning
// loader globe — a canvas can't repaint while the main thread is blocked.
function ensureUSRefMap() {
  if (usRefMap) return;
  initUSRefMap();
  zoomUSRefMapToValid(false);
}

// Tear down and rebuild the ref map at the container's CURRENT size — used when the panel
// settles to a different size than it was built with (so the viewBox + projection match
// the panel and the map fills it). initUSRefMap re-fits everything, restores the district
// overlay (if a state is confirmed) and re-fits the zoom, so the game state is preserved.
function rebuildUSRefMap() {
  const el = document.getElementById('us-ref-map');
  if (!el) return;
  if (_usRefRO) { _usRefRO.disconnect(); _usRefRO = null; }
  el.innerHTML = '';
  usRefMap = null; usRefMapGroup = null; usRefLayers = {}; usRefCallouts = {};
  usRefZoom = null; usRefSvgSel = null;
  initUSRefMap();
}

// Cheap, flash-free response to a container SIZE change (mobile browser-chrome show/hide,
// rotation, panel reflow). A full rebuildUSRefMap() tears the SVG down and re-runs the
// staged render, which momentarily paints the all-red state basemap at the wrong
// projection and resets the zoom — visible as a jarring "reset" on mobile. Instead, just
// retarget the viewBox to the new size and re-fit the current view: the projection's path
// `d` coords are unchanged, and the zoom transform re-frames them into the new viewport.
function resyncUSRefViewBox() {
  const el = document.getElementById('us-ref-map');
  if (!el || !usRefSvgSel) return;
  const W = el.offsetWidth, H = el.offsetHeight;
  if (!W || !H) return;
  if (Math.abs(W - _usRefW) > 1 || Math.abs(H - _usRefH) > 1) {
    _usRefW = W; _usRefH = H;
    _districtW = W; _districtH = H;
    usRefSvgSel.attr('viewBox', `0 0 ${W} ${H}`);
  }
  zoomUSRefMapToValid(false);
}

function initUSRefMap(onDone) {
  if (usRefMap) { if (onDone) onDone(); return; }
  const container = document.getElementById('us-ref-map');

  // Use actual container dimensions so the projection fills the container without letterboxing.
  const W = container.offsetWidth  || REF_VB_W;
  const H = container.offsetHeight || REF_VB_H;
  _usRefW = W; _usRefH = H;

  const svgSel = d3.select(container)
    .append('svg')
    .attr('viewBox', `0 0 ${W} ${H}`)
    .attr('width', '100%')
    .attr('height', '100%')
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .style('display', 'block')
    .style('background', 'transparent')
    .style('touch-action', 'none');  // let D3 zoom own all touch gestures (pinch, two-finger)

  usRefMap    = svgSel.node();
  usRefSvgSel = svgSel;

  // D3 zoom — allow user to pan & scroll-zoom the reference map
  usRefZoom = d3.zoom()
    .scaleExtent([0.3, Infinity])
    .on('zoom', (event) => {
      const root = d3.select(usRefMapGroup);
      root.attr('transform', event.transform);
      _updateCalloutsForZoom(event.transform.k);
      // Counter-scale the in-map district render so tiles stay constant screen size on
      // zoom (no-op when no district content is present, e.g. the state-pick phase).
      _applyTileZoomScaling(root, event.transform.k);
      // Dismiss the pan/zoom hint on the first user gesture (not programmatic transitions)
      if (event.sourceEvent) {
        const hint = document.getElementById('us-ref-hint');
        if (hint) hint.classList.add('dismissed');
        document.querySelector('.mzb-fit')?.classList.remove('at-active-fit');
        if (gamePhase === 'district') districtSavedTransform = event.transform;
      }
    });
  svgSel.call(usRefZoom);
  // Double-click resets to fitted view instead of zooming in
  svgSel.on('dblclick.zoom', () => zoomUSRefMapToValid(true));

  // Zoom +/- buttons — added once to the wrap, shared by ref-map and district-tiles
  const wrap = container.closest('.us-ref-map-wrap');
  if (wrap && !wrap.querySelector('.map-zoom-btns')) {
    const btnWrap = document.createElement('div');
    btnWrap.className = 'map-zoom-btns';
    btnWrap.innerHTML = '<button class="mzb" data-dir="in" aria-label="Zoom in">+</button>'
                      + '<button class="mzb" data-dir="out" aria-label="Zoom out">−</button>'
                      + '<button class="mzb mzb-fit" data-dir="fit" aria-label="Fit view" title="Fit view">'
                      + svgIcon('maximize', 'mzb-icon') + '</button>';
    wrap.appendChild(btnWrap);
    btnWrap.addEventListener('click', e => {
      const btn = e.target.closest('.mzb');
      if (!btn) return;
      const dir = btn.dataset.dir;
      const tilesHidden = gamePhase === 'state';

      if (dir === 'fit') {
        if (tilesHidden) {
          // Single-purpose "fit to remaining valid states" — matches the district-phase
          // Fit. No toggle-out to the national view; the − button handles zooming out, and
          // the button disables (via _refreshFitBtnState) once the view already frames them.
          const t = _validStatesFitTransform();
          if (!t || _atCandidateFit(t)) return;
          zoomUSRefMapToValid(true);
          return;
        }
        const tilesSvg = usRefSvgSel;   // single map: district zoom is the shared zoom
        if (!tilesSvg || tilesSvg.empty() || !districtZoomBehavior || !_districtProjection) return;
        if (!gameOver) {
          // Single-purpose "fit to remaining candidates": always frame the eligible tiles.
          // No toggle-out — the − button handles zooming out. If the view already matches
          // the candidate fit there's nothing to do (the button is also disabled in that
          // state via _refreshFitBtnState), so bail rather than nudge the zoom.
          const t = _candidateFitTransform();
          if (!t || _atCandidateFit(t)) return;
          districtUserZoomed = false;
          tilesSvg.transition().duration(500).ease(d3.easeCubicInOut)
            .call(districtZoomBehavior.transform, t);
          districtSavedTransform = t;
          return;
        }
        // Game-over: toggle between district view and national view
        const atNational = btn.classList.contains('at-national');
        if (atNational) {
          const target = districtGameOverTransform || d3.zoomIdentity;
          tilesSvg.transition().duration(600).ease(d3.easeCubicInOut)
            .call(districtZoomBehavior.transform, target);
          btn.classList.remove('at-national');
          btn.querySelector('svg')?.replaceWith(
            Object.assign(document.createRange().createContextualFragment(svgIcon('maximize','mzb-icon')).firstChild)
          );
        } else {
          tilesSvg.transition().duration(600).ease(d3.easeCubicInOut)
            .call(districtZoomBehavior.transform, d3.zoomIdentity);
          btn.classList.add('at-national');
          btn.querySelector('svg')?.replaceWith(
            Object.assign(document.createRange().createContextualFragment(svgIcon('minimize','mzb-icon')).firstChild)
          );
        }
        return;
      }

      const factor = dir === 'in' ? 1.6 : 1 / 1.6;
      if (tilesHidden) {
        usRefSvgSel?.transition().duration(250).call(usRefZoom.scaleBy, factor);
      } else {
        const tilesSvg = usRefSvgSel;   // single map: district zoom is the shared zoom
        if (tilesSvg && !tilesSvg.empty() && districtZoomBehavior) {
          tilesSvg.transition().duration(250).call(districtZoomBehavior.scaleBy, factor);
        }
      }
    });
  }

  usRefProjection  = d3.geoAlbersUsa(); // stored for inner-point bbox on the ref map
  const projection = usRefProjection;
  const pathGen    = d3.geoPath().projection(projection);

  const tooltip = document.getElementById('us-ref-tooltip');

  // Use states already loaded from districts-core.topojson — no CDN fetch needed.
  // The heavy drawing (≈50 state paths + 2 national meshes + callouts) is split into
  // stages run one-per-animation-frame so a concurrent loader globe (canvas, rAF-driven)
  // keeps painting between stages instead of freezing through one long synchronous block.
  const stateFeatures = Object.values(topoStates).filter(Boolean);
  const geojson = { type: 'FeatureCollection', features: stateFeatures };
  projection.fitSize([W, H], geojson);
  usRefPathGen = pathGen; // save for district overlay

  // Single group for ALL content so zoom transforms everything. All sub-layers are
  // created synchronously up front (cheap) so their z-order is fixed before the stages
  // fill them: states → district context → district polys → tiles → answer → callouts.
  const g = svgSel.append('g');
  usRefMapGroup = g.node();
  const layerBasemap   = g.append('g').attr('class', 'layer-basemap').style('pointer-events', 'none');
  const layerStates    = g.append('g').attr('class', 'layer-states');
  g.append('g').attr('class', 'layer-context');    // counties/roads/urban (district+gameover)
  g.append('g').attr('class', 'layer-districts');  // guessed-state district polygons + border
  g.append('g').attr('class', 'layer-tiles');      // force-sim circles (district phase)
  g.append('g').attr('class', 'layer-answer');     // answer highlight + leader badge (gameover)

  // ── Stage 1: static inactive backdrop (every state in the eliminated/inactive grey) ──
  const stageBasemap = () => {
    const baseFill = _basemapFill();
    stateFeatures.forEach(feature => {
      const abbr = feature.properties && feature.properties.state;
      if (!abbr || !stateDistrictMap[abbr]) return;
      layerBasemap.append('path')
        .datum(feature)
        .attr('d', pathGen)
        .attr('data-abbr', abbr)
        .attr('fill', baseFill)
        .attr('stroke', 'none');
    });
  };

  // ── Stage 2: clickable state fills + interactivity ──
  const stageStates = () => {
    stateFeatures.forEach(feature => {
      const abbr = feature.properties && feature.properties.state;
      if (!abbr || !stateDistrictMap[abbr]) return;

      const pathEl = layerStates.append('path')
        .datum(feature)
        .attr('d', pathGen)
        .attr('stroke', 'none')
        .attr('data-abbr', abbr);

      usRefLayers[abbr] = pathEl;
      _applyStateStyle(pathEl, abbr);

      pathEl
        .on('click', () => {
          if (tooltip) tooltip.classList.remove('visible'); // map rebuilds on guess → mouseout won't fire
          if (gameOver || correctStateGuessed) return;
          if (!getValidStates().has(abbr)) return;
          handleStateSelection(abbr);
        })
        .on('mouseover', (event) => {
          // Tooltip — desktop/mouse only
          if (tooltip && !window.matchMedia('(pointer: coarse)').matches) {
            tooltip.textContent = (STATE_NAMES[abbr] || abbr) + ' (' + abbr + ')';
            tooltip.classList.add('visible');
            tooltip.style.left = (event.clientX + 14) + 'px';
            tooltip.style.top  = (event.clientY - 34) + 'px';
          }
          // Highlight only clickable states — mouse only. On touch, mouseover
          // fires on tap and sticks (no mouseout until you tap elsewhere), leaving
          // the tapped state lit in a "selected"-looking color before the verdict.
          if (!window.matchMedia('(pointer: coarse)').matches
              && !correctStateGuessed && getValidStates().has(abbr)) {
            const hoverColor = isDarkMode() ? STATE_COLOR.dark.hover : STATE_COLOR.light.hover;
            pathEl.attr('fill', hoverColor).attr('fill-opacity', 1.0);
          }
        })
        .on('mousemove', (event) => {
          if (tooltip) {
            tooltip.style.left = (event.clientX + 14) + 'px';
            tooltip.style.top  = (event.clientY - 34) + 'px';
          }
        })
        .on('mouseout', () => {
          if (tooltip) tooltip.classList.remove('visible');
          _applyStateStyle(pathEl, abbr);
        });
    });
  };

  // ── Stage 3: white internal borders + outer US boundary (the topojson meshes) ──
  const stageBorders = () => {
    if (!(rawTopo && rawTopo.objects.states)) return;
    layerStates.append('path')
      .datum(topojson.mesh(rawTopo, rawTopo.objects.states, (a, b) => a !== b))
      .attr('d', pathGen)
      .attr('fill', 'none')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 1)
      .attr('vector-effect', 'non-scaling-stroke')
      .attr('pointer-events', 'none');

    layerStates.append('path')
      .datum(topojson.mesh(rawTopo, rawTopo.objects.states, (a, b) => a === b))
      .attr('d', pathGen)
      .attr('fill', 'none')
      .attr('stroke', '#adb5bd')
      .attr('stroke-width', 0.75)
      .attr('vector-effect', 'non-scaling-stroke')
      .attr('pointer-events', 'none');
  };

  // ── Stage 4: callouts for small states, then fit + (restored) district overlay ──
  const stageCallouts = () => {
    const fipsToFeature = {};
    stateFeatures.forEach(f => {
      const abbr = f.properties && f.properties.state;
      if (abbr) {
        const fips = Object.keys(FIPS_TO_ABBR).find(k => FIPS_TO_ABBR[k] === abbr);
        if (fips) fipsToFeature[fips] = f;
      }
    });
    _addStateCallouts(g, geojson, pathGen, fipsToFeature);

    // Always fit the ref map to the current valid state set (removes AlbersUSA whitespace)
    zoomUSRefMapToValid(false);
    // If state already confirmed (restored session), draw district overlay immediately
    if (correctStateGuessed && todayDistrict && !gameOver) {
      showDistrictD3Map(todayDistrict.properties.state, true);
    }

    // Keep the map fitted to the panel. The viewBox + projection are built from the
    // container size at init; if the panel later settles to a different size (layout
    // settling, rotation, window resize) the SVG would letterbox / not fill. Rebuild at
    // the real size when it changes materially; otherwise just (re)fit the zoom (the
    // original mobile timing fix for a map built before layout settled).
    const refEl = document.getElementById('us-ref-map');
    if (refEl && window.ResizeObserver) {
      if (_usRefRO) { _usRefRO.disconnect(); }
      let settleT = null;
      _usRefRO = new ResizeObserver(() => {
        const cw = refEl.offsetWidth, ch = refEl.offsetHeight;
        if (!cw || !ch) return;
        // Flash-free: retarget the viewBox + re-fit rather than tearing the SVG down.
        clearTimeout(settleT);
        settleT = setTimeout(resyncUSRefViewBox, 120);
      });
      _usRefRO.observe(refEl);
    }
  };

  // Run the stages one per frame so the loader globe paints between them, then signal done.
  const stages = [stageBasemap, stageStates, stageBorders, stageCallouts];
  let si = 0;
  (function runStage() {
    if (si >= stages.length) { if (onDone) onDone(); return; }
    try { stages[si++](); } catch (e) { reportClientError('usrefmap_stage', e); }
    requestAnimationFrame(runStage);
  })();
}

// Zoom the US ref map to fit the inner points of currently-active districts.
// Pass animated=false for instant placement (e.g., on restore).
function zoomUSRefMapToValid(animated = true) {
  // A map zoom/rebuild can strand a hover tooltip "visible" (no mouseout fires) — clear it.
  document.getElementById('us-ref-tooltip')?.classList.remove('visible');
  if (!usRefSvgSel || !usRefZoom || !usRefProjection) return;
  const W = _usRefW, H = _usRefH;

  // Game over: the pick map (behind the result sheet) would otherwise stay frozen at the
  // tight remaining-districts zoom, so frame the actual answer district instead.
  if (gameOver && todayDistrict && usRefPathGen) {
    const akey = todayDistrict.properties['state-district'];
    const af = districts.find(f => f.properties['state-district'] === akey);
    if (af) {
      const t = zoomToBBox(usRefPathGen.bounds(af), W, H, { margin: DISTRICT_FIT_MARGIN_ANSWER, maxScale: 40 });
      usRefZoom.scaleExtent([Math.min(t.k, 0.3), Infinity]);
      if (animated) usRefSvgSel.transition().duration(600).ease(d3.easeCubicInOut).call(usRefZoom.transform, t);
      else usRefSvgSel.call(usRefZoom.transform, t);
      return;
    }
  }

  // No district inner points are shipped, so state-phase zoom is driven by the
  // geometry of the remaining valid STATES instead of getActiveDistrictKeys().
  if (gamePhase === 'state') {
    if (!usRefPathGen) return;
    const feats = [...getValidStates()].map(a => topoStates[a]).filter(Boolean);
    if (!feats.length) return;
    const bbox = usRefPathGen.bounds({ type: 'FeatureCollection', features: feats });
    // margin < 1 fits the whole valid-states bbox with padding; > 1 overshoots and
    // clips edge states (e.g. the answer state sitting at the bottom of the cluster).
    const t = zoomToBBox(bbox, W, H, { margin: 0.9 });
    usRefZoom.scaleExtent([Math.min(t.k, 0.7), Infinity]);
    if (animated) {
      usRefSvgSel.transition().duration(700).ease(d3.easeCubicInOut).call(usRefZoom.transform, t);
    } else {
      usRefSvgSel.call(usRefZoom.transform, t);
    }
    if (!_usRefFullFitTransform) _usRefFullFitTransform = t;
    return;
  }

  // District phase (single map): the INITIAL view fits the eligible TILES (dist-icon
  // positions) for a tight frame. The full guessed-state bbox is recorded as the
  // fit-toggle reference (pressing Fit zooms out to the whole state).
  if (gamePhase === 'district' && serverState && usRefPathGen) {
    const feat = topoStates[serverState];
    if (!feat) return;
    const stateFit = zoomToBBox(usRefPathGen.bounds(feat), W, H, { margin: DISTRICT_FIT_MARGIN });
    districtStateFitTransform = stateFit;   // Fit button zooms out to this

    const tileBox = _districtTileBBox(getActiveDistrictKeys());
    // Looser margin so the remaining district markers + badges aren't flush to the edges.
    const t = tileBox ? zoomToBBox(tileBox, W, H, { margin: DISTRICT_ACTIVE_FIT_MARGIN }) : stateFit;
    // Allow zooming out at least to the full-state fit.
    usRefZoom.scaleExtent([Math.min(stateFit.k, 0.3), Infinity]);
    if (!districtUserZoomed) districtSavedTransform = t;
    // We're now at the tile fit, so the Fit button's next press zooms out to the state.
    document.querySelector('.mzb-fit')?.classList.add('at-active-fit');
    if (animated) {
      usRefSvgSel.transition().duration(350 * ANIM_SLOW).ease(d3.easeCubicInOut).call(usRefZoom.transform, t);
    } else {
      usRefSvgSel.call(usRefZoom.transform, t);
    }
    return;
  }
}

function updateUSRefMap() {
  if (!usRefMap) return;
  if (usRefMapGroup) {
    d3.select(usRefMapGroup).select('.layer-basemap').selectAll('path').attr('fill', _basemapFill());
  }
  for (const [abbr, pathEl] of Object.entries(usRefLayers)) {
    _applyStateStyle(pathEl, abbr);
  }
  for (const abbr of Object.keys(usRefCallouts)) {
    _applyCalloutStyle(abbr);
  }
  // Eliminating states changes the valid-states fit, so re-evaluate the Fit button.
  _refreshFitBtnState();
}

function renderStateChips() {
  const container = document.getElementById('state-chips');
  const countEl   = document.getElementById('state-match-count');
  if (!container) return;

  const validStates = getValidStates();
  countEl.textContent = `${validStates.size} of 50`;

  // Sort: valid first (alpha), then eliminated (alpha)
  const allStates = Object.keys(stateDistrictMap).sort((a, b) =>
    (STATE_NAMES[a] || a).localeCompare(STATE_NAMES[b] || b)
  );

  container.innerHTML = '';
  for (const abbr of allStates) {
    const chip = document.createElement('button');
    chip.className = 'state-chip' + (validStates.has(abbr) ? '' : ' eliminated');
    chip.textContent = abbr;
    chip.title = STATE_NAMES[abbr] || abbr;
    chip.disabled = correctStateGuessed; // lock chips once state is confirmed

    chip.addEventListener('click', () => {
      if (correctStateGuessed || gameOver) return;
      if (!validStates.has(abbr)) return;
      handleStateSelection(abbr);
    });

    container.appendChild(chip);
  }

  // Keep the US ref map in sync
  updateUSRefMap();
}

function lockStateDropdown(stateAbbr, instant = false) {
  gamePhase = 'district';

  // Update chips and US ref map to show only the confirmed state
  renderStateChips();
  updateUSRefMap();

  // Build the district render FIRST (counties + tiles are heavy — building it mid-zoom
  // starves the animation and the zoom appears to jump), then animate the zoom into the
  // state so it's smooth. On a real frame the built render paints, then the transform tweens.
  showDistrictD3Map(stateAbbr, instant);
  if (instant) {
    zoomUSRefMapToValid(false);
  } else {
    requestAnimationFrame(() => zoomUSRefMapToValid(true));
  }
}

// Switch the SHARED map between the state-pick view and the district view. In the
// district view the 50-state fills + offshore callouts fade out (the district render
// draws its own state context + tiles); reversing restores them for a fresh state phase.
function setMapDistrictView(on, instant = false) {
  if (!usRefMapGroup) return;
  const root = d3.select(usRefMapGroup);
  const dur  = (instant || !on) ? 0 : Math.round(260 * (typeof ANIM_SLOW !== 'undefined' ? ANIM_SLOW : 1));
  const states   = root.select('.layer-states');
  const callouts = root.select('.us-ref-callouts');
  const render   = root.select('.district-render');
  if (on) {
    states.interrupt().transition().duration(dur).style('opacity', 0).on('end', () => states.style('pointer-events', 'none'));
    if (instant) states.style('opacity', 0).style('pointer-events', 'none');
    callouts.interrupt().style('opacity', 0).style('pointer-events', 'none');
    render.interrupt().style('opacity', 1).style('pointer-events', null);
  } else {
    states.interrupt().style('opacity', 1).style('pointer-events', null);
    callouts.interrupt().style('opacity', null).style('pointer-events', null);
    if (!render.empty()) render.interrupt().style('opacity', 0).style('pointer-events', 'none').selectAll('*').remove();
  }
}

function showDistrictD3Map(stateAbbr, instant = false, animateReveal = false) {
  document.querySelector('.mzb-fit')?.classList.remove('at-active-fit');
  const labelEl = document.getElementById('ref-label');

  // Hide state chips (the section may be absent in some game-over rebuilds — guard it so
  // the reveal doesn't abort midway).
  document.getElementById('state-chips-section')?.classList.add('hidden');

  // Update label
  const count = (stateDistrictMap[stateAbbr] || []).length;
  if (labelEl) {
    labelEl.textContent = count === 1
      ? 'One district — click to guess'
      : `Pick a district (${count} total)`;
  }

  if (!gameOver) {
    districtUserZoomed        = false;
    districtSavedTransform    = null;
    districtStateFitTransform = null;
  }
  const hintEl = document.getElementById('us-ref-hint');
  if (hintEl) hintEl.classList.add('dismissed');

  // Game-over is its own screen (the game-over modal) — nothing to render in the play map.
  if (gameOver) return;

  // Build the district render into the shared map, then switch to the district view.
  // The zoom into the state is applied by zoomUSRefMapToValid (district branch), called
  // from lockStateDropdown just before this, on the same shared SVG.
  buildDistrictD3Map(stateAbbr, animateReveal, !instant);
  setMapDistrictView(true, instant);
}

// ─── District D3 Map ────────────────────────────────────────────────────────
//
// Split into focused functions:
//   buildDistrictD3Map   — thin coordinator: clears container, builds context, routes
//   _buildDistrictCtx    — creates SVG, projection, zoom behavior; returns shared context
//   _applyDistrictZoom   — picks and applies the correct initial transform
//   _drawGameplayTiles   — gameplay render (clickable circles + force simulation)

// Counter-scale the district tiles / connectors / game-over badge / context layers so
// circles stay a constant SCREEN size as the (shared) map zooms. Extracted from the
// per-build zoom closure so the unified usRefZoom handler can call it too once the
// district content lives in the ref map's SVG. `g` = the district render group, `k` =
// the current zoom scale. Reads module render constants (cssScale=1, target=14px, W).
// Effective density factor at zoom scale k. Dense states start shrunk (base > 1 at the
// state-fit zoom), but as the player zooms IN past the state fit fewer tiles share the
// viewport and there's room to grow — so ease the factor back toward 1 (standard 14px
// radius), reaching it once you've zoomed in by the base factor.
function _effDensity(k) {
  const base = _districtDensityScale || 1;
  const fitK = _districtStateFitK || 1;
  if (base <= 1 || !fitK) return base;
  return Math.max(1, base / Math.max(1, k / fitK));
}

// The zoom transform that frames the remaining candidate tiles (district phase).
function _candidateFitTransform() {
  if (gameOver || !_districtProjection) return null;
  const bbox = _districtTileBBox(getActiveDistrictKeys());
  return bbox ? zoomToBBox(bbox, _districtW, _districtH, { margin: DISTRICT_ACTIVE_FIT_MARGIN })
              : districtStateFitTransform;
}

// The zoom transform that frames the remaining valid STATES (state-pick phase). The
// state-phase analog of _candidateFitTransform — must match the math in zoomUSRefMapToValid.
function _validStatesFitTransform() {
  if (gameOver || !usRefPathGen || !usRefProjection) return null;
  const feats = [...getValidStates()].map(a => topoStates[a]).filter(Boolean);
  if (!feats.length) return null;
  const bbox = usRefPathGen.bounds({ type: 'FeatureCollection', features: feats });
  return zoomToBBox(bbox, _usRefW, _usRefH, { margin: 0.9 });
}

// The fit transform for the current phase (candidates in district phase, valid states in
// the state-pick phase).
function _phaseFitTransform() {
  return gamePhase === 'state' ? _validStatesFitTransform() : _candidateFitTransform();
}

// True when the current map zoom is already (within a hair of) the candidate fit, so
// pressing Fit would do nothing visible.
function _atCandidateFit(t) {
  const svg = usRefSvgSel?.node();
  if (!t || !svg) return false;
  const cur = d3.zoomTransform(svg);
  return Math.abs(cur.k - t.k) < 0.01 * t.k && Math.abs(cur.x - t.x) < 1.5 && Math.abs(cur.y - t.y) < 1.5;
}

// Grey out / enable the district-phase Fit button depending on whether a press would
// change anything. Called on every zoom tick and after each tile rebuild.
function _refreshFitBtnState() {
  const btn = document.querySelector('.mzb-fit');
  if (!btn) return;
  if (gameOver) { btn.classList.remove('is-disabled'); btn.removeAttribute('disabled'); return; }
  const t = _phaseFitTransform();
  const off = !!t && _atCandidateFit(t);
  btn.classList.toggle('is-disabled', off);
  if (off) btn.setAttribute('disabled', ''); else btn.removeAttribute('disabled');
}

function _applyTileZoomScaling(g, k) {
  const targetCirclePx = 14, densityScale = _effDensity(k), cssScale = _districtCssScale || 1, W = _districtW;
  const rk = targetCirclePx / (k * cssScale * densityScale);

  // Gameplay circles: radius, stroke, text
  g.select('.dist-icons').selectAll('circle')
    .attr('r', rk)
    .attr('stroke-width', 1.5 / k);
  g.select('.dist-icons').selectAll('text').each(function() {
    if (this.parentNode && this.parentNode.querySelector('rect')) return; // skip badge text
    const baseSize = Math.min(this.textContent.length > 2 ? 8 : 9, targetCirclePx);
    d3.select(this).attr('font-size', `${baseSize / (k * cssScale * densityScale)}px`);
  });
  g.select('.dist-connectors').selectAll('line').attr('stroke-width', 0.8 / k);
  g.select('.dist-connectors').attr('display', k > 1.5 ? 'none' : null);

  // Game-over pill badge: reposition + resize so it stays fixed on screen
  const leader = g.select('.dist-leader');
  if (!leader.empty()) {
    const ldbx0 = +leader.attr('data-dbx0'), ldbx1 = +leader.attr('data-dbx1');
    const ldby0 = +leader.attr('data-dby0'), ldby1 = +leader.attr('data-dby1');
    const nby = (ldby0 + ldby1) / 2;
    const badgeG   = g.select('.dist-icons');
    const label    = badgeG.select('text').text();
    const hasIcon  = !badgeG.select('.gc-icon-svg').empty();
    const iconSize = 13 / (k * cssScale), iconGap = 4 / (k * cssScale);
    const pH = 26 / (k * cssScale);
    const pW = (label.length * 7.5 + 22) / (k * cssScale) + (hasIcon ? iconSize + iconGap : 0);
    let nbx = ldbx1 + 10 / (k * cssScale) + pW / 2;
    if (nbx + pW / 2 > W * 0.94) nbx = ldbx0 - 10 / (k * cssScale) - pW / 2;
    leader.attr('x2', nbx).attr('y2', nby).attr('stroke-width', 1 / (k * cssScale));
    g.selectAll('.dist-leader').attr('stroke-width', 1 / k);
    badgeG.attr('transform', `translate(${nbx},${nby})`);
    badgeG.select('rect')
      .attr('width', pW).attr('height', pH).attr('rx', pH / 2)
      .attr('x', -pW / 2).attr('y', -pH / 2)
      .attr('stroke-width', 1 / (k * cssScale));
    if (hasIcon) {
      const iconX = -pW / 2 + 7 / (k * cssScale) + iconSize / 2;
      badgeG.select('.gc-icon-svg')
        .attr('transform', `translate(${iconX},0) scale(${iconSize / 24}) translate(-12,-12)`);
      badgeG.select('text').attr('x', iconSize / 2 + iconGap / 2);
    }
    badgeG.select('text')
      .attr('font-size', `${12 / (k * cssScale)}px`)
      .attr('letter-spacing', 0.3 / (k * cssScale));
  }

  // Retune simulation so tiles stay collision-free at the new zoom level
  if (districtSimulation && !gameOver && districtSimulation._applyIconPositions && !_tileZoomInAnimating) {
    const newCollide  = 16 / (k * cssScale * densityScale);
    const newStrength = Math.min(0.98, 0.6 + (k - 1) * 0.15);
    districtSimulation
      .force('collide', d3.forceCollide(d => d.isCold ? newCollide * 0.25 : d.isHot ? newCollide * 0.45 : newCollide))
      .force('x', d3.forceX(d => d.ox).strength(newStrength))
      .force('y', d3.forceY(d => d.oy).strength(newStrength))
      .alpha(0.3).stop();
    districtSimulation.tick(20);
    districtSimulation._applyIconPositions();
  }

  // Context layers fade in with zoom at game over. During gameplay the context
  // layers keep the fixed opacity set in _drawGameplayTiles (no zoom gating).
  if (gameOver) {
    const countyOpacity = k > 3 ? Math.min(0.65, (k - 3) * 0.25) : 0;
    g.select('.context-counties').attr('opacity', countyOpacity);
    const fadeOpacity = k > 2 ? Math.min(1, (k - 2) * 0.35) : 0;
    g.select('.context-urban').attr('opacity', fadeOpacity);
    g.select('.context-roads').attr('opacity', fadeOpacity);
  }

  _refreshFitBtnState();   // a press is only useful when the view isn't already the candidate fit
}

function buildDistrictD3Map(stateAbbr, animateReveal = false, zoomIn = false) {
  // Game-over is its own screen (the game-over modal renders the answer); the in-play
  // unified map only handles state→district GAMEPLAY, so skip building it at game-over.
  if (gameOver) return;
  dbg(`buildDistrictD3Map state=${stateAbbr} zoomIn=${zoomIn} savedK=${districtSavedTransform?.k?.toFixed(2)??'null'}`);

  const ctx = _buildDistrictCtx(stateAbbr, null);
  if (!ctx) return;

  _applyDistrictZoom(ctx, zoomIn);
  _drawGameplayTiles(ctx);
}

// Creates the SVG, projection, and zoom behavior.  Returns a context object
// shared by _applyDistrictZoom and the two render functions.
function _buildDistrictCtx(stateAbbr, tilesEl) {
  const stateFeatures = districts.filter(f => f.properties.state === stateAbbr);
  if (!stateFeatures.length) return null;

  const targetCirclePx = 14;

  // Hot/cold inference from guess history
  const answerKey       = todayDistrict?.properties['state-district'];
  const answerNeighbors = new Set(adjMap.get(answerKey) || []);
  const wrongGuesses    = guessHistory.filter(g => g.phase === 'district' && !g.correct);

  let possibleKeys = new Set(stateFeatures.map(f => f.properties['state-district']));
  const hotGuessKeys = new Set(), coldGuessKeys = new Set();
  for (const guess of wrongGuesses) {
    const key  = guess.text;
    const dist = key.split('-').slice(1).join('-');
    if (guessWasAdjacent(guess, answerNeighbors)) {
      hotGuessKeys.add(dist);
      const nbrSet = new Set(adjMap.get(key) || []);
      for (const k of [...possibleKeys]) {
        if (k !== key && !nbrSet.has(k)) possibleKeys.delete(k);
      }
      possibleKeys.delete(key);
    } else {
      coldGuessKeys.add(dist);
      possibleKeys.delete(key);
      for (const nbr of (adjMap.get(key) || [])) possibleKeys.delete(nbr);
    }
  }
  // Only DIRECTLY-guessed hot/cold districts keep a marker tile (dimmed) once they drop
  // out of possibleKeys — districts eliminated purely by inference (a cold guess's
  // neighbors, or the non-neighbors pruned by a hot guess) should actually disappear from
  // the board. Previously coldKeys included every non-possible district (the complement of
  // possibleKeys minus hotGuessKeys), which — combined with the node filter below — meant
  // literally every district always got a tile and nothing was ever visually eliminated.
  const hotKeys  = hotGuessKeys;
  const coldKeys = coldGuessKeys;

  const wonDist     = guessHistory.find(g => g.phase === 'district' && g.correct);
  const wonDistPart = wonDist ? wonDist.text.split('-').slice(1).join('-') : null;
  const isAtLarge   = stateFeatures.length === 1;

  // Density-aware circle sizing: dense states (TX, CA) get smaller tiles AND a tighter
  // collision radius so their many districts pack compactly near their true geographic
  // positions instead of the force sim exploding them across the panel with long
  // criss-crossing connectors. Keyed to the number of tiles actually drawn (the remaining
  // candidates), so as wrong/eliminated districts drop out the survivors grow back toward
  // full size. Below ~18 tiles the original 14px circles are unchanged; above that the
  // factor grows with √(count) and is capped so labels stay legible.
  const tileCount    = possibleKeys.size;
  const densityScale = tileCount > 18 ? Math.min(1.7, Math.sqrt(tileCount / 18)) : 1;

  // Share the ref map's EXACT coordinate system so the two maps register pixel-for-pixel:
  // same viewBox dimensions (W,H) and the same AlbersUSA projection instance. Without this
  // the two maps fit independent projections at slightly different sizes, so the same state
  // lands in different places and the state→district transition shows a mismatch. Fall back
  // to local container dims + a fresh fit only if the ref map hasn't been built yet.
  // Single map: the district render lives in the shared ref-map SVG, so use its exact
  // viewBox dims. Fall back to the ref container only if the ref map isn't measured yet.
  const _refEl  = document.getElementById('us-ref-map');
  const cssScale = 1;   // viewBox = container, 1 viewBox unit = 1 CSS pixel
  const W = _usRefW || _refEl?.offsetWidth  || REF_VB_W;
  const H = _usRefH || _refEl?.offsetHeight || REF_VB_H;
  _districtW = W; _districtH = H;
  const dark = isDarkMode();

  const stateFC  = { type: 'FeatureCollection', features: stateFeatures };
  const allStatesFC = { type: 'FeatureCollection', features: Object.values(topoStates).filter(Boolean) };
  const projection  = usRefProjection || d3.geoAlbersUsa().fitSize([W, H], allStatesFC);
  _districtProjection    = projection;  // stored for external zoom calls
  _districtCssScale      = cssScale;
  _districtDensityScale  = densityScale;
  _districtStateFeatures = stateFeatures;
  const pathGen     = d3.geoPath().projection(projection);
  _districtPathGen       = pathGen;
  // Fit to the STATE outline (single non-secret shape), not the district polygons.
  const stateOutline = topoStates[stateAbbr];
  const stateBBox   = stateOutline ? pathGen.bounds(stateOutline) : pathGen.bounds(stateFC);
  const stateFitTransform = zoomToBBox(stateBBox, W, H, { margin: DISTRICT_FIT_MARGIN, maxScale: W / 12 });
  _districtStateFitK = stateFitTransform.k || 1;   // baseline zoom for density→1 easing

  // Bbox of a district-key set's TILE (dist-icon) positions — lets us fit the remaining
  // tiles WITHOUT touching the district polygon geometry (shapes only draw at game over).
  const tileBBox = (keys) => _districtTileBBox(keys) || stateBBox;

  dbg(`SVG W=${W} H=${H} cssScale=${cssScale.toFixed(2)} possibleKeys=${possibleKeys.size}/${stateFeatures.length}`);

  // ONE MAP: render the district content into the SHARED ref-map SVG, in a dedicated
  // 'district-render' group above the state fills and below the callouts. It's cleared
  // and rebuilt whenever the district set changes. The shared usRefZoom drives this map
  // (its handler calls _applyTileZoomScaling), so there is no separate district SVG/zoom —
  // districtZoomBehavior is aliased to usRefZoom so the existing transform helpers still work.
  const svg = usRefSvgSel;
  const rootSel = d3.select(usRefMapGroup);
  let g = rootSel.select('g.district-render');
  if (g.empty()) g = rootSel.insert('g', '.us-ref-callouts').attr('class', 'district-render');
  g.selectAll('*').remove();

  _districtSvgSel     = svg;
  _districtPathSnap   = pathGen;
  _districtStateFSnap = stateFeatures;
  _districtBuiltState = stateAbbr;
  districtZoomBehavior = usRefZoom;

  return { svg, g, pathGen, projection, cssScale, W, H, dark, tilesEl, stateAbbr,
           stateFeatures, stateFC, stateBBox, stateFitTransform, tileBBox,
           densityScale, targetCirclePx,
           possibleKeys, hotKeys, coldKeys,
           wonDist, wonDistPart, isAtLarge, answerKey };
}

// Decides and applies the initial zoom transform (zoomIn animation, game-over zoom,

// Bbox (projected px) of the given district keys' tile (dist-icon) positions, using the
// stored projection + state features. `keys` null = all districts. Returns null if unknown.
function _districtTileBBox(keys) {
  const proj = _districtProjection, feats = _districtStateFeatures || [];
  if (!proj || !feats.length) return null;
  const refPt = (f) => POINT_OVERRIDES[f.properties['state-district']]
                    || districtPoints[f.properties['state-district']]
                    || d3.geoCentroid(f);
  const pts = feats
    .filter(f => !keys || keys.has(f.properties['state-district']))
    .map(f => proj(refPt(f)))
    .filter(p => p && isFinite(p[0]));
  if (!pts.length) return null;
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  return [[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]];
}

function _applyDistrictZoom(ctx, zoomIn) {
  const { stateBBox, possibleKeys, tileBBox, W, H } = ctx;

  // State fit: bbox of the whole state outline (the "zoomed out" district reference).
  const stateFit = zoomToBBox(stateBBox, W, H, { margin: DISTRICT_FIT_MARGIN });
  districtStateFitTransform = stateFit;

  if (zoomIn) {
    // Entry: the zoom into the state is applied on the SHARED SVG by zoomUSRefMapToValid
    // (district branch), so don't issue a competing zoom here — just record the fit.
    districtSavedTransform = stateFit;
    return;
  }

  // After a wrong district guess (rebuild): zoom the shared map to the bbox of the remaining
  // eligible TILES (dist-icon positions) so they fill the view — no district geometry.
  // Looser margin so the marker dots + badges aren't flush against the edges.
  const activeFit = zoomToBBox(tileBBox(possibleKeys), W, H, { margin: DISTRICT_ACTIVE_FIT_MARGIN });
  districtSavedTransform = activeFit;
  const dur = 500 * (typeof ANIM_SLOW !== 'undefined' ? ANIM_SLOW : 1);
  usRefSvgSel.transition().duration(dur).ease(d3.easeCubicInOut).call(usRefZoom.transform, activeFit);
}

// Renders the gameplay tile view: state context fill, clickable circles with
// hot/cold styling, connector lines, and a force-directed collision layout.
function _drawGameplayTiles(ctx) {
  const { svg, g, pathGen, projection, cssScale, W, H, dark, stateAbbr,
          stateFeatures, stateFC, densityScale, targetCirclePx,
          possibleKeys, hotKeys, coldKeys, wonDist, wonDistPart, isAtLarge,
          stateFitTransform } = ctx;

  // Other states as a muted context
  const otherStateFills = Object.values(topoStates).filter(f => f && f.properties?.state !== stateAbbr);
  g.append('g').attr('class', 'context-other-states').attr('pointer-events', 'none')
    .selectAll('path').data(otherStateFills).join('path').attr('d', pathGen)
    .attr('fill', dark ? 'rgba(255,255,255,0.05)' : 'rgba(160,160,175,0.25)')
    .attr('stroke', dark ? 'rgba(255,255,255,0.12)' : 'rgba(130,130,150,0.45)')
    .attr('stroke-width', 0.4).attr('vector-effect', 'non-scaling-stroke');

  // White state backdrop from the STATE OUTLINE only — the district polygons are NOT drawn
  // during play (so a player can't read district boundaries from the DOM); the answer shape
  // is revealed at game over.
  const stateOutline = topoStates[stateAbbr];
  const fillG = g.append('g').attr('class', 'state-fill');
  if (stateOutline) {
    fillG.append('path').datum(stateOutline).attr('d', pathGen)
      .attr('style', 'fill: var(--surface);').attr('stroke', 'none').attr('pointer-events', 'none');
  }

  // Urban areas + roads — decorative geographic context, clipped to the active
  // state, always visible during gameplay (no zoom threshold). Drawn before the
  // county lines so the dashed county borders sit on top.
  // Restrict the national roads/counties/urban datasets to features overlapping
  // the active state's bbox before drawing. The clip-path masks the rest visually,
  // but a path the renderer never sees is far cheaper than one clipped away — this
  // cuts the in-play map from ~18k paths to a few hundred (mirrors the gameover path,
  // which already filters via inBounds).
  let inStateBounds = () => true;
  if (stateOutline) {
    try {
      const [[sbx0, sby0], [sbx1, sby1]] = d3.geoBounds(stateOutline);
      const sm = 0.1;
      inStateBounds = f => {
        try {
          const [[fx0, fy0], [fx1, fy1]] = d3.geoBounds(f);
          return fx1 >= sbx0 - sm && fx0 <= sbx1 + sm && fy1 >= sby0 - sm && fy0 <= sby1 + sm;
        } catch { return false; }
      };
    } catch { /* keep pass-through */ }
  }

  if (stateOutline && (topoUrban || topoRoads)) {
    const ctxClipId = `gameplay-context-clip-${stateAbbr}`;
    g.append('defs').append('clipPath').attr('id', ctxClipId)
      .append('path').attr('d', pathGen(stateOutline));
    if (topoUrban) {
      g.append('g').attr('class', 'context-urban').attr('pointer-events', 'none')
        .attr('clip-path', `url(#${ctxClipId})`).attr('opacity', 1)
        .selectAll('path').data(topoUrban.features.filter(inStateBounds)).join('path').attr('d', pathGen)
        .attr('fill', dark ? 'rgba(255,255,255,0.07)' : 'rgba(80,80,140,0.12)').attr('stroke', 'none');
    }
    if (topoRoads) {
      g.append('g').attr('class', 'context-roads').attr('pointer-events', 'none')
        .attr('clip-path', `url(#${ctxClipId})`).attr('opacity', 1)
        .selectAll('path').data(topoRoads.features.filter(inStateBounds)).join('path').attr('d', pathGen)
        .attr('fill', 'none')
        .attr('stroke', dark ? 'rgba(255,255,255,0.18)' : 'rgba(60,60,100,0.22)')
        .attr('stroke-width', 0.5).attr('vector-effect', 'non-scaling-stroke');
    }
  }

  // County lines — always visible in gameplay (no zoom threshold), clipped to active state
  if (topoCounties && stateOutline) {
    const clipId = `gameplay-county-clip-${stateAbbr}`;
    // defs go into the district render group (g) so they're cleared on each rebuild
    // rather than accumulating duplicate ids on the shared SVG.
    g.append('defs').append('clipPath').attr('id', clipId)
      .append('path').attr('d', pathGen(stateOutline));
    g.append('g').attr('class', 'context-counties').attr('pointer-events', 'none')
      .attr('clip-path', `url(#${clipId})`).attr('opacity', 0.45)
      .selectAll('path').data(topoCounties.features.filter(inStateBounds)).join('path').attr('d', pathGen)
      .attr('fill', 'none')
      .attr('stroke', dark ? 'rgba(255,255,255,0.30)' : 'rgba(0,0,0,0.35)')
      .attr('stroke-width', 0.5).attr('stroke-dasharray', '2 3')
      .attr('vector-effect', 'non-scaling-stroke');
  }

  // State border
  if (stateOutline) {
    g.append('path').datum(stateOutline).attr('class', 'state-border').attr('d', pathGen)
      .attr('fill', 'none').attr('stroke', dark ? '#999' : '#555')
      .attr('stroke-width', 2).attr('vector-effect', 'non-scaling-stroke').attr('pointer-events', 'none');
  }

  // Build node data — possible-answer districts get a live tile, PLUS any
  // hot/cold-guessed district (even though guessing it removed it from possibleKeys)
  // so the hot/cold styling below (dimmed fill, disabled click) actually has a tile to
  // apply to. Without this, every wrong guess just vanished from the board instead of
  // staying visible as a "warm"/"cold" marker.
  const nodes = stateFeatures.filter(f => {
    const sdKey = f.properties['state-district'];
    const dist  = sdKey?.split('-').slice(1).join('-') || '00';
    return possibleKeys.has(sdKey) || hotKeys.has(dist) || coldKeys.has(dist);
  }).map(f => {
    const sdKey = f.properties['state-district'];
    const dist  = sdKey?.split('-').slice(1).join('-') || '00';
    const label = isAtLarge ? 'AL' : String(parseInt(dist, 10));
    const isHot = hotKeys.has(dist), isCold = coldKeys.has(dist);
    const refPoint  = POINT_OVERRIDES[sdKey] || districtPoints[sdKey] || d3.geoCentroid(f);
    const projected = projection(refPoint);
    const [ox, oy]  = projected && isFinite(projected[0]) ? projected : [W / 2, H / 2];
    return { dist, label, isWrong: isHot || isCold, isCorrect: wonDistPart === dist,
             isHot, isCold, x: ox, y: oy, ox, oy };
  });
  nodes.sort((a, b) => (a.isCold ? 0 : a.isHot ? 1 : 2) - (b.isCold ? 0 : b.isHot ? 1 : 2));

  // zoomK is the scale that will actually be on screen — use it to size circles so they
  // render correctly before any subsequent zoom event fires.
  const zoomK = districtSavedTransform ? districtSavedTransform.k : stateFitTransform.k;
  const effDensity = _effDensity(zoomK);   // eases base→1 if restored already zoomed-in
  const R     = targetCirclePx / (zoomK * cssScale * effDensity);

  // Connector lines (drawn first so they appear behind circles)
  const lineG   = g.append('g').attr('class', 'dist-connectors');
  const lineEls = nodes.map(d =>
    lineG.append('line')
      .attr('x1', d.ox).attr('y1', d.oy).attr('x2', d.ox).attr('y2', d.oy)
      .attr('stroke', dark ? '#666' : '#aaa').attr('stroke-width', 0.8)
      .attr('stroke-opacity', 0).attr('pointer-events', 'none').node()
  );

  // Clickable tile circles
  const iconG   = g.append('g').attr('class', 'dist-icons');
  // Tiles share the state palette so the two phases read as the same colors:
  // in-play = valid, answer = confirmed, eliminated/cold = elim, hot = dimmed valid.
  const c = dark ? STATE_COLOR.dark : STATE_COLOR.light;
  const iconEls = nodes.map(d => {
    const disabled  = d.isWrong || d.isCorrect;
    const fillColor = d.isCorrect ? c.confirmed.fill
                    : d.isCold   ? c.elim.fill
                    : c.valid.fill;   // in-play and hot share the valid color (hot is dimmed via opacity)
    const textColor = (d.isCold && !dark) ? '#888' : '#fff';
    const opacity   = d.isCold ? 0.18 : d.isHot ? 0.32 : 1;

    const grp = iconG.append('g')
      .attr('transform', `translate(${d.ox},${d.oy})`).attr('data-dist', d.dist)
      .attr('class', 'district-tile').style('cursor', disabled ? 'default' : 'pointer')
      .style('opacity', opacity);
    grp.append('circle').attr('r', R)
      .attr('fill', fillColor).attr('stroke', dark ? '#222' : '#fff').attr('stroke-width', 1.5 / zoomK);
    grp.append('text')
      // Center the number with the browser-native baseline (well-supported across all
      // current browsers, and consistent with the callout/badge labels). It scales cleanly
      // as the font-size changes with zoom. The older dy="0.35em" hack mis-centered the
      // label in Safari (which appears to mishandle a sub-pixel em dy under heavy zoom).
      .attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
      .attr('font-size', `${Math.min(d.label.length > 2 ? 8 : 9, targetCirclePx) / (zoomK * cssScale * effDensity)}px`)
      .attr('font-weight', '700').attr('fill', textColor).attr('pointer-events', 'none')
      .text(d.label);
    if (!disabled) {
      grp.on('mouseover', function() { d3.select(this).select('circle').attr('fill', c.hover); })
         .on('mouseout',  function() { d3.select(this).select('circle').attr('fill', fillColor); })
         .on('click',     () => submitDistrictGuess(d.dist));
    }
    return grp.node();
  });

  // Force simulation — run synchronously so tiles are at their final positions on first paint
  const collide      = 16 / (zoomK * cssScale * effDensity);
  const forceStrength = Math.min(0.98, 0.6 + (zoomK - 1) * 0.15);

  function applyIconPositions() {
    nodes.forEach((d, i) => {
      d3.select(iconEls[i]).attr('transform', `translate(${d.x},${d.y})`);
      const dx = d.x - d.ox, dy = d.y - d.oy;
      d3.select(lineEls[i])
        .attr('x1', d.ox).attr('y1', d.oy).attr('x2', d.x).attr('y2', d.y)
        .attr('stroke-opacity', Math.sqrt(dx * dx + dy * dy) > 4 ? 1 : 0);
    });
  }

  districtSimulation = d3.forceSimulation(nodes)
    .alphaDecay(0.12).alphaMin(0.01)
    .force('collide', d3.forceCollide(collide))
    .force('x', d3.forceX(d => d.ox).strength(forceStrength))
    .force('y', d3.forceY(d => d.oy).strength(forceStrength))
    .stop();
  districtSimulation.tick(Math.ceil(Math.log(districtSimulation.alphaMin() / districtSimulation.alpha()) / Math.log(1 - districtSimulation.alphaDecay())));
  applyIconPositions();
  districtSimulation._applyIconPositions = applyIconPositions;
  _refreshFitBtnState();   // candidate set changed → re-evaluate whether Fit is actionable
}

// skipAnims: true when called from startGameOverTransition — animations are deferred
// until the reveal circle finishes collapsing (_gameOverAnimsCallback fires then).
function endGame(won, { skipAnims = false } = {}) {
  gameOver = true;
  gamePhase = 'gameover';
  if (won) _gameOverTime = Date.now();
  stopTimer();
  cluesRevealed = FACT_DEFS.length;   // reveal all text clues
  applyMapStage(0, true);
  // Ensure state is locked to the answer
  if (!correctStateGuessed) {
    correctStateGuessed = true;
    lockStateDropdown(todayDistrict.properties.state);
  }
  // Always rebuild district tiles at game-over so the answer district gets the highlight
  // showDistrictD3Map updates the label correctly for game-over state
  showDistrictD3Map(todayDistrict.properties.state, true, !skipAnims);
  // Reset the fit-toggle button icon for game-over view
  document.querySelector('.mzb-fit')?.classList.remove('at-national');
  renderClues();
  renderGuessHistory();
  // NOTE: guessCount already reflects the server's total (resp.guesses includes the
  // winning guess). Do NOT add 1 here — that double-counts and can push the count above
  // MAX_GUESSES, which breaks Array(MAX_GUESSES - guessCount) in the grids/share image.
  // Save stats BEFORE showResult so renderInlinePersonalStats shows current game.
  // Archive games are unofficial — never counted. Anonymous players record nothing
  // (their outcomes are not saved anywhere) — the results screen invites them to sign in.
  if (!isArchiveGame && !isAnonymousPlayer) savePersonalStats(won, guessCount, elapsedSeconds);
  lastGameWon = won;
  // Render result content now, but don't auto-open the modal — let the user watch the
  // map-ref reveal animation (boundary draw-in + shake/pulse) on the game-over screen,
  // then open results via the "View Result" banner button when ready.
  showResult(won, false);

  // Offer the push notification opt-in after game 1 / before game 3 (real, signed-in
  // games only — same gate as savePersonalStats, since it reads that played count).
  if (!isArchiveGame && !isAnonymousPlayer) maybePromptPushOptIn();

  // Auto-prompt feedback every 5 games if not already prompted at this count
  const _fbStats = loadPersonalStats();
  if (_fbStats && _fbStats.played > 0 && _fbStats.played % 5 === 0) {
    const lastPrompted = parseInt(localStorage.getItem(FEEDBACK_PROMPTED_AT) || '0', 10);
    if (lastPrompted < _fbStats.played) {
      localStorage.setItem(FEEDBACK_PROMPTED_AT, String(_fbStats.played));
      setTimeout(() => {
        document.getElementById('result-modal')?.classList.add('hidden');
        document.getElementById('feedback-modal').classList.remove('hidden');
      }, 3000);
    }
  }
  saveGameState();
  // Results persist server-side via DistrictBackend.guess() (Supabase). The District
  // Profile is rendered by showGameoverModal() (the game-over card owns it now).
}

// ============================================================
//  RESULT & SHARE
// ============================================================

function _previewProjection(W, H, pad, { centerOnCentroid = false } = {}) {
  // Use AlbersUSA so the district shape matches the district tile map and ref map.
  // For MultiPolygon, fit to the largest sub-polygon so small islands don't
  // blow out the extent.
  const geom = todayDistrict && todayDistrict.geometry;
  let fitFeature = todayDistrict;
  if (geom && geom.type === 'MultiPolygon') {
    const largest = geom.coordinates.reduce((best, poly) => {
      const a = d3.geoArea({ type: 'Feature', geometry: { type: 'Polygon', coordinates: poly } });
      const b = d3.geoArea({ type: 'Feature', geometry: { type: 'Polygon', coordinates: best } });
      return a > b ? poly : best;
    });
    fitFeature = { type: 'Feature', geometry: { type: 'Polygon', coordinates: largest } };
  }
  const projection = d3.geoAlbersUsa().fitExtent([[pad, pad], [W - pad, H - pad]], fitFeature);
  if (centerOnCentroid) {
    // fitExtent centers the bounding box; shift translate so the geographic centroid
    // lands at (W/2, H/2) instead, giving a more natural centered view.
    const centroidGeo = d3.geoCentroid(fitFeature);
    const projected = projection(centroidGeo);
    if (projected) {
      const [tx, ty] = projection.translate();
      projection.translate([tx + (W / 2 - projected[0]), ty + (H / 2 - projected[1])]);
    }
  }
  return projection;
}

function buildGameoverMap(_retry = 0) {
  if (!todayDistrict || !rawTopo) return;
  const container = document.getElementById('gameover-map');
  if (!container) return;
  // Guard a degenerate render: with no state geometry yet (or a not-yet-laid-out, zero-
  // size container) the AlbersUSA fitExtent collapses and the map comes out blank. Retry
  // on the next frame a few times rather than painting nothing.
  const notReady = !Object.keys(topoStates || {}).length
    || !container.clientWidth || !container.clientHeight;
  if (notReady && _retry < 10) { requestAnimationFrame(() => buildGameoverMap(_retry + 1)); return; }
  container.innerHTML = '';

  // Use actual container dimensions for responsive viewBox
  const W = container.clientWidth || REF_VB_W;
  const H = container.clientHeight || REF_VB_H;
  const dark        = isDarkMode();
  const stateAbbr   = todayDistrict.properties.state;
  const stateFeatures = districts.filter(f => f.properties.state === stateAbbr);
  const answerKey   = todayDistrict.properties['state-district'];
  const answerF     = stateFeatures.find(f => f.properties['state-district'] === answerKey);

  const allStatesFC = { type: 'FeatureCollection', features: Object.values(topoStates).filter(Boolean) };
  const projection  = d3.geoAlbersUsa().fitExtent([[10, 10], [W - 10, H - 10]], allStatesFC);
  const pathGen     = d3.geoPath().projection(projection);

  const svg = d3.select(container).append('svg')
    .attr('viewBox', `0 0 ${W} ${H}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .attr('width', '100%').attr('height', '100%')
    .style('display', 'block').style('touch-action', 'none');

  // Clip path on the answer state so overlay layers (roads/urban/counties) don't
  // bleed outside the state boundary.
  const stateOutline = topoStates[stateAbbr];
  const clipId = 'go-state-clip';
  const defs = svg.append('defs');
  if (stateOutline) {
    defs.append('clipPath').attr('id', clipId)
      .append('path').datum(stateOutline).attr('d', pathGen);
  }

  const g = svg.append('g');

  // ── Layer 1: Other states (faded national context) ──────────────────────
  const otherStates = Object.values(topoStates).filter(f => f.properties?.state !== stateAbbr);
  if (otherStates.length) {
    g.append('g').attr('class', 'go-other-states')
      .selectAll('path').data(otherStates).join('path').attr('d', pathGen)
      .attr('fill', dark ? 'rgba(255,255,255,0.06)' : 'rgba(100,100,120,0.10)')
      .attr('stroke', dark ? 'rgba(255,255,255,0.08)' : 'rgba(130,130,140,0.25)')
      .attr('stroke-width', 0.5).style('vector-effect', 'non-scaling-stroke');
  }

  // ── Layer 2: State fill (answer state background) ───────────────────────
  if (stateOutline) {
    g.append('path').attr('class', 'go-state-fill').datum(stateOutline).attr('d', pathGen)
      .attr('fill', dark ? 'rgba(255,255,255,0.04)' : 'rgba(220,220,228,0.5)')
      .attr('stroke', 'none').attr('pointer-events', 'none');
  }

  // ── Layer 3: Urban areas — clipped to state, fade in at mid zoom ─────────
  if (topoUrban) {
    g.append('g').attr('class', 'go-urban').attr('opacity', 0).attr('pointer-events', 'none')
      .attr('clip-path', stateOutline ? `url(#${clipId})` : null)
      .selectAll('path').data(topoUrban.features).join('path').attr('d', pathGen)
      .attr('fill', dark ? 'rgba(255,255,255,0.07)' : 'rgba(80,80,140,0.09)')
      .attr('stroke', 'none');
  }

  // ── Layer 4: Roads — clipped to state, fade in at mid zoom ───────────────
  if (topoRoads) {
    g.append('g').attr('class', 'go-roads').attr('opacity', 0).attr('pointer-events', 'none')
      .attr('clip-path', stateOutline ? `url(#${clipId})` : null)
      .selectAll('path').data(topoRoads.features).join('path').attr('d', pathGen)
      .attr('fill', 'none')
      .attr('stroke', dark ? 'rgba(255,255,255,0.14)' : 'rgba(60,60,100,0.18)')
      .attr('stroke-width', 0.5).style('vector-effect', 'non-scaling-stroke');
  }

  // ── Layer 5: County lines — clipped to state, fade in at higher zoom ──────
  if (topoCounties) {
    g.append('g').attr('class', 'go-counties').attr('opacity', 0).attr('pointer-events', 'none')
      .attr('clip-path', stateOutline ? `url(#${clipId})` : null)
      .selectAll('path').data(topoCounties.features).join('path').attr('d', pathGen)
      .attr('fill', 'none')
      .attr('stroke', dark ? 'rgba(255,255,255,0.30)' : 'rgba(0,0,0,0.35)')
      .attr('stroke-width', 0.5).attr('stroke-dasharray', '2 3')
      .style('vector-effect', 'non-scaling-stroke');
  }

  // ── Layer 6: District fills + outlines for answer state ─────────────────
  g.append('g').attr('class', 'go-all-districts')
    .selectAll('path').data(stateFeatures).join('path').attr('d', pathGen)
    .attr('fill', dark ? 'rgba(255,255,255,0.05)' : 'rgba(180,180,190,0.18)')
    .attr('stroke', dark ? 'rgba(255,255,255,0.22)' : 'rgba(90,90,110,0.45)')
    .attr('stroke-width', 1).style('vector-effect', 'non-scaling-stroke');

  // ── Layer 7: Answer district highlight ──────────────────────────────────
  // The spark trace + confetti firework no longer fire here during the reveal — both run
  // together when the player leaves the result modal (revealGameoverFromResult →
  // _celebrateGameoverDistrict). The path is drawn now so it's ready to trace later.
  if (answerF) {
    g.append('path').attr('class', 'go-answer-district').datum(answerF).attr('d', pathGen)
      .attr('fill', dark ? 'rgba(255,80,80,0.5)' : 'rgba(196,18,48,0.65)')
      .attr('stroke', '#C41230').attr('stroke-width', 2)
      .style('vector-effect', 'non-scaling-stroke');
  }

  // ── Layer 8: State border (bold, on top of all fills) ──────────────────
  if (stateOutline) {
    g.append('path').attr('class', 'go-state-border').datum(stateOutline).attr('d', pathGen)
      .attr('fill', 'none')
      .attr('stroke', dark ? '#bbb' : '#222').attr('stroke-width', 1.5)
      .style('vector-effect', 'non-scaling-stroke').attr('pointer-events', 'none');
  }

  // ── Zoom setup ──────────────────────────────────────────────────────────
  _goZoomInitial = answerF
    ? zoomToBBox(pathGen.bounds(answerF), W, H, { margin: DISTRICT_FIT_MARGIN_ANSWER, maxScale: 40 })
    : d3.zoomIdentity;
  // Intermediate fit: the whole answer state (between district and nation).
  _goZoomState = stateOutline
    ? zoomToBBox(pathGen.bounds(stateOutline), W, H, { margin: DISTRICT_FIT_MARGIN, maxScale: 40 })
    : d3.zoomIdentity;

  // ── Badge inside zoom group — pans/zooms with map, scale(1/k) keeps it constant size ─
  // The pill is anchored to a district edge in data (projection viewBox) space, then drawn
  // toward the side of the district with the most open room in the framed viewport — so it
  // sits wholly inside the map instead of clipping off the right edge when the district
  // fills the width or hugs an edge. A clamp keeps it on-canvas along the other axis.
  let badgeLayer = null;
  let badgeDataX = 0, badgeDataY = 0;
  if (answerF) {
    const [[dbx0, dby0], [dbx1, dby1]] = pathGen.bounds(answerF);
    const midX = (dbx0 + dbx1) / 2, midY = (dby0 + dby1) / 2;

    // Badge local space: 1 unit = 1 viewBox unit (g scales by k, badge by 1/k → net 1),
    // and 1 viewBox unit ≈ renderScale screen px — so /renderScale gives screen-px sizes.
    const svgBB = svg.node().getBoundingClientRect();
    const renderScale = svgBB.width > 0 ? Math.min(svgBB.width / W, svgBB.height / H) : 1;
    const pillPx = 30 / renderScale, pillWPx = (answerKey.length * 8 + 28) / renderScale, gapPx = 10 / renderScale;
    const fontPx = 13 / renderScale;

    // District bbox in viewBox coords at the initial framing → room on each side.
    const t = _goZoomInitial;
    const sx0 = dbx0 * t.k + t.x, sx1 = dbx1 * t.k + t.x;
    const sy0 = dby0 * t.k + t.y, sy1 = dby1 * t.k + t.y;
    const room = { right: W - sx1, left: sx0, top: sy0, bottom: H - sy1 };
    const needH = gapPx + pillWPx;   // horizontal footprint (left/right placement)
    const needV = gapPx + pillPx;    // vertical footprint (top/bottom placement)

    // Pick the side with the most room; sides that actually fit the pill win outright,
    // with a slight bias toward left/right (the pill reads naturally beside the district).
    let side = 'right', best = -Infinity;
    for (const s of ['right', 'left', 'top', 'bottom']) {
      const horiz = (s === 'right' || s === 'left');
      const fits = room[s] >= (horiz ? needH : needV);
      const score = room[s] + (fits ? 1e6 : 0) + (horiz ? 1 : 0);
      if (score > best) { best = score; side = s; }
    }

    // Anchor (data) at the chosen edge midpoint; local offsets draw the pill into the room.
    let rectX, rectY, textX = 0, textY = 0;
    if (side === 'right') {
      badgeDataX = dbx1; badgeDataY = midY;
      rectX = gapPx; rectY = -pillPx / 2; textX = gapPx + pillWPx / 2;
    } else if (side === 'left') {
      badgeDataX = dbx0; badgeDataY = midY;
      rectX = -(gapPx + pillWPx); rectY = -pillPx / 2; textX = -(gapPx + pillWPx / 2);
    } else if (side === 'top') {
      badgeDataX = midX; badgeDataY = dby0;
      rectX = -pillWPx / 2; rectY = -(gapPx + pillPx); textY = -(gapPx + pillPx / 2);
    } else { // bottom
      badgeDataX = midX; badgeDataY = dby1;
      rectX = -pillWPx / 2; rectY = gapPx; textY = gapPx + pillPx / 2;
    }

    // Clamp the anchor along the perpendicular axis so the pill stays within the viewport.
    if (side === 'right' || side === 'left') {
      let cy = badgeDataY * t.k + t.y;
      cy = Math.max(pillPx / 2 + 2, Math.min(H - pillPx / 2 - 2, cy));
      badgeDataY = (cy - t.y) / t.k;
    } else {
      let cx = badgeDataX * t.k + t.x;
      cx = Math.max(pillWPx / 2 + 2, Math.min(W - pillWPx / 2 - 2, cx));
      badgeDataX = (cx - t.x) / t.k;
    }

    badgeLayer = g.append('g').attr('class', 'go-badge-layer');
    badgeLayer.append('rect')
      .attr('x', rectX).attr('y', rectY).attr('width', pillWPx).attr('height', pillPx)
      .attr('rx', pillPx / 2)
      .attr('fill', 'rgba(196,18,48,0.92)').attr('stroke', '#fff')
      .attr('stroke-width', 2).style('vector-effect', 'non-scaling-stroke')
      .style('filter', 'drop-shadow(0 1px 3px rgba(0,0,0,0.4))');
    badgeLayer.append('text')
      .attr('x', textX).attr('y', textY)
      .attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
      .attr('font-size', `${fontPx}px`).attr('font-weight', '700').attr('fill', '#fff')
      .attr('letter-spacing', '0.5').attr('pointer-events', 'none').text(answerKey);
  }

  function _updateBadge(k) {
    if (!badgeLayer) return;
    badgeLayer.attr('transform', `translate(${badgeDataX},${badgeDataY}) scale(${1 / k})`);
  }

  function _updateGoLayers(k) {
    const cOp = k > 3  ? Math.min(0.9, (k - 3)  * 0.3)  : 0;
    const fOp = k > 2  ? Math.min(1,   (k - 2)  * 0.4)  : 0;
    g.select('.go-counties').attr('opacity', cOp);
    g.select('.go-roads').attr('opacity', fOp);
    g.select('.go-urban').attr('opacity', fOp * 0.7);
  }

  _goZoom = d3.zoom().scaleExtent([0.01, Infinity])
    .on('zoom', event => {
      g.attr('transform', event.transform);
      _updateGoLayers(event.transform.k);
      _updateBadge(event.transform.k);
    });
  svg.call(_goZoom).on('dblclick.zoom', null);

  // Set zoom directly to district view — no animation
  svg.call(_goZoom.transform, _goZoomInitial);
  _updateGoLayers(_goZoomInitial.k);
  _updateBadge(_goZoomInitial.k);
  // Opening at district view → the cycle button previews "state" as the next step.
  _goZoomLevel = 1;
  const cycleBtn = document.querySelector('#gameover-modal .mzb-go-cycle');
  if (cycleBtn) {
    const svgIcon = cycleBtn.querySelector('.mzb-icon');
    if (svgIcon) svgIcon.innerHTML = GO_ZOOM_LEVELS[1].icon;
    cycleBtn.setAttribute('title', GO_ZOOM_LEVELS[1].title);
    cycleBtn.setAttribute('aria-label', GO_ZOOM_LEVELS[1].title);
  }
}

async function showGameoverModal() {
  destroyGameSection();
  // A hover tooltip can get stuck "visible" if the map is torn down mid-hover, leaving a
  // stray "State (XX)" label floating over the game-over screen — hide it.
  document.getElementById('us-ref-tooltip')?.classList.remove('visible');
  // Remove any existing game-over modal first. buildGameoverDiv() inserts a fresh node
  // without de-duping, so a second call would leave TWO #gameover-modal elements;
  // getElementById() then updates the stale (DOM-first) one — its map + countdown —
  // while the visible newest modal stays blank with a frozen "—:—:—" countdown.
  destroyGameoverDiv();
  _gameOverAnimsCallback = null;  // animations ran on district-tiles which is now gone
  buildGameoverDiv();

  // District Profile lives in the game-over card now — populate it once the card exists.
  if (todayDistrict) fetchAndRenderCensusPanel(districtDataFor(todayDistrict));
  wireGameoverCensus();

  const won = guessHistory.some(g => g.correct && g.phase === 'district');

  // Populate the card text/grid. Wrapped so a failure here (e.g. a slot SVG glitch) can
  // NEVER prevent the countdown + map below from running — that previously left the
  // visible modal with a blank map and a frozen "—:—:—" countdown.
  try {
    const answerKey = todayDistrict?.properties['state-district'] || '?';
    const districtNum = todayDistrict?.properties['district'] || todayDistrict?.properties['CD118FP'] || '';

    // Top ribbon: "The answer was CA-31." / "You got it! CA-31."
    const ribbonEl = document.getElementById('gameover-ribbon-text');
    if (ribbonEl) ribbonEl.textContent = won ? `Game over. You got it! ${answerKey}.` : `Game over. The answer was ${answerKey}.`;

    // Card header headline: "Answer was: CA-31 — District 31"
    const hl = document.getElementById('gameover-headline');
    if (hl) {
      const districtLabel = districtNum ? ` — District ${+districtNum || districtNum}` : '';
      hl.textContent = `Answer was: ${answerKey}${districtLabel}`;
      hl.className   = 'gameover-headline ' + (won ? 'won' : 'lost');
    }

    // Guess grid — the correct-state slot (⊙) shows the actual state boundary SVG
    const correctStateAbbr = todayDistrict?.properties?.state || '';
    const usedSlots = guessHistory.map(g => {
      if (g.correct && g.phase === 'district') return '<span class="go-slot">✓</span>';
      if (g.correct && g.phase === 'state')    return `<span class="go-slot go-slot-state" data-state="${correctStateAbbr}">⊙</span>`;
      return '<span class="go-slot">⊗</span>';
    });
    const unusedCount = won ? MAX_GUESSES - guessCount : 0;
    const gridHtml = [...usedSlots, ...Array(unusedCount).fill('<span class="go-slot">□</span>')].join(' ');
    const gridEl = document.getElementById('gameover-grid');
    if (gridEl) {
      gridEl.innerHTML = gridHtml;
      // Swap the correct-state slot's symbol for the state's boundary outline
      gridEl.querySelectorAll('.go-slot-state').forEach(slot => {
        const abbr = slot.dataset.state;
        if (abbr) {
          getStateSvg(abbr).then(svg => {
            if (svg) slot.innerHTML = `<span class="state-svg-container">${svg}</span>`;
          }).catch(() => {});
        }
      });
    }

    // "Solved!" label only when won
    const solvedEl = document.getElementById('gameover-solved-label');
    if (solvedEl) solvedEl.textContent = won ? 'Solved!' : '';

    // Time
    const timeEl = document.getElementById('gameover-time');
    if (timeEl) timeEl.textContent = formatTime(elapsedSeconds);
  } catch (e) {
    reportClientError('gameover_modal_content', e);
  }

  if (isArchiveGame) {
    // Archive game-over: this is a PAST puzzle, not today's. Swap the "today's district"
    // countdown block for archive context, hide the sign-in CTA, relabel "View Results"
    // → "Today's Results", and don't run the daily countdown.
    const num     = serverArchive?.puzzleNumber;
    const dateStr = serverArchive?.date
      ? new Date(serverArchive.date + 'T00:00:00').toLocaleDateString('en-US',
          { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      : '';
    const main = document.querySelector('#gameover-next .gameover-next-main');
    if (main) {
      main.innerHTML = `<span class="gameover-next-title">Archive${num != null ? ` · No. ${num}` : ''}</span>` +
        `<span class="gameover-next-sub">This district was played on ${dateStr ? dateStr + ' &middot; ' : ''}</span>`;
    }
    document.getElementById('gameover-next-cta')?.classList.add('hidden');
    const resBtn = document.getElementById('gameover-result-btn');
    if (resBtn) resBtn.textContent = "Today's Results";
    // Keep Share visible in archive too — the share text names the specific puzzle
    // ("Daily District No. N"), so it doesn't read as today's daily (see buildShareText).
    document.getElementById('gameover-share-btn')?.classList.remove('hidden');
  } else {
    // "New district at midnight ET" ribbon + countdown. Anonymous players also get a
    // sign-in nudge (track stats / compare); signed-in players just see the countdown.
    const nextCta = document.getElementById('gameover-next-cta');
    if (nextCta) nextCta.classList.toggle('hidden', !isAnonymousPlayer);
    document.getElementById('gameover-next-signin')?.addEventListener('click', () => {
      document.getElementById('login-modal')?.classList.remove('hidden');
    });
    try { startNextDistrictCountdown(); } catch (e) { reportClientError('gameover_countdown', e); }
  }

  const mapWrap = document.getElementById('gameover-map-wrap');

  requestAnimationFrame(() => {
    try { buildGameoverMap(); } catch (e) { reportClientError('gameover_map', e); }
    // Re-frame the pick map behind the sheet onto the answer district (it would
    // otherwise stay frozen at the tight remaining-districts zoom).
    try { zoomUSRefMapToValid(true); } catch (e) { reportClientError('gameover_refzoom', e); }
    if (mapWrap) mapWrap.classList.add(won ? 'gameover-win-pulse' : 'gameover-loss-shake');
  });
}

// ── Share image helpers ──────────────────────────────────────────────────────

// Serialize a D3 SVG selection (or DOM node) to a PNG blob via canvas.
function _svgToBlob(svgNode, W, H) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(
      new Blob([new XMLSerializer().serializeToString(svgNode)], { type: 'image/svg+xml' })
    );
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      canvas.getContext('2d').drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob(b => b ? resolve(b) : reject('toBlob failed'), 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject('svg→img failed'); };
    img.src = url;
  });
}

// Append urban areas, roads, exterior dim mask, and district fill+stroke to sel.
// W and H are the dimensions of the map area (for the exterior mask rectangle).
function _buildRichMapLayers(sel, projection, W, H) {
  const pathGen = d3.geoPath(projection);
  const dark = isDarkMode();
  const [[bx0, by0], [bx1, by1]] = d3.geoBounds(todayDistrict);
  const mg = 0.1;
  const inBounds = f => {
    try {
      const [[fx0, fy0], [fx1, fy1]] = d3.geoBounds(f);
      return fx1 >= bx0 - mg && fx0 <= bx1 + mg && fy1 >= by0 - mg && fy0 <= by1 + mg;
    } catch { return false; }
  };
  if (topoUrban) {
    const g = sel.append('g');
    topoUrban.features.filter(inBounds).forEach(f =>
      g.append('path').attr('d', pathGen(f))
        .attr('fill', dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)').attr('stroke', 'none'));
  }
  if (topoRoads) {
    const g = sel.append('g');
    topoRoads.features.filter(inBounds).forEach(f =>
      g.append('path').attr('d', pathGen(f))
        .attr('fill', 'none')
        .attr('stroke', dark ? 'rgba(255,255,255,0.2)' : '#bbb')
        .attr('stroke-width', 0.6));
  }
  const dPath = pathGen(todayDistrict);
  sel.append('path')
    .attr('d', `M0,0L${W},0L${W},${H}L0,${H}Z ${dPath}`)
    .attr('fill', dark ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.18)')
    .attr('fill-rule', 'evenodd');
  sel.append('path').attr('d', dPath)
    .attr('fill', '#C41230').attr('fill-opacity', dark ? 0.45 : 0.25);
  sel.append('path').attr('d', dPath)
    .attr('fill', 'none')
    .attr('stroke', dark ? '#ff6b6b' : '#C41230')
    .attr('stroke-width', 2.5).attr('stroke-linejoin', 'round');
}

// Landscape share image (800×450) — richer style + watermark.
function _renderDistrictToBlob() {
  if (!todayDistrict || !window.d3) return Promise.reject('no district');
  const W = 800, H = 450, pad = 40;
  const dark = isDarkMode();
  const answerKey = todayDistrict.properties['state-district'] || '';
  const projection = _previewProjection(W, H, pad);

  const svg = d3.create('svg')
    .attr('xmlns', 'http://www.w3.org/2000/svg')
    .attr('width', W).attr('height', H);
  svg.append('rect').attr('width', W).attr('height', H)
    .attr('fill', dark ? '#252526' : '#f3f4f6');
  _buildRichMapLayers(svg, projection, W, H);
  // Watermark bottom-right
  svg.append('text')
    .attr('x', W - 12).attr('y', H - 12)
    .attr('text-anchor', 'end').attr('dominant-baseline', 'auto')
    .attr('font-family', 'system-ui, sans-serif').attr('font-size', 13).attr('font-weight', '600')
    .attr('fill', dark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.35)')
    .text('Daily District');

  return _svgToBlob(svg.node(), W, H);
}

// Portrait share image (1080×1350) — map top 60%, details panel bottom 40%.
function _renderShareBlob() {
  if (!todayDistrict || !window.d3) return Promise.reject('no district');
  const W = 1080, H = 1350, mapH = 810, panelH = 540, pad = 60;
  const dark = isDarkMode();
  const answerKey  = todayDistrict.properties['state-district'] || '';
  const stateName  = todayDistrict.properties['state-name'] || todayDistrict.properties['NAME'] || '';
  const distNum    = todayDistrict.properties['district'] || todayDistrict.properties['CD118FP'] || '';
  const isAtLarge  = (stateDistrictMap[answerKey.split('-')[0]] || []).length === 1;
  const distLabel  = isAtLarge ? 'At-Large District' : `District ${parseInt(distNum, 10) || distNum}`;
  const won        = guessHistory.some(g => g.correct && g.phase === 'district');
  const outcome    = won ? `Solved in ${guessCount} / ${MAX_GUESSES}` : `Unsolved`;
  const usedSlots  = guessHistory.map(g =>
    g.correct && g.phase === 'district' ? '✓' : g.correct && g.phase === 'state' ? '○' : '✗');
  const grid = usedSlots.join('  ');   // only the guesses made — no empty-slot padding

  const projection = _previewProjection(W, mapH, pad);

  const svg = d3.create('svg')
    .attr('xmlns', 'http://www.w3.org/2000/svg')
    .attr('width', W).attr('height', H);

  // Map area
  svg.append('rect').attr('width', W).attr('height', mapH)
    .attr('fill', dark ? '#252526' : '#f3f4f6');
  const defs = svg.append('defs');
  defs.append('clipPath').attr('id', 'ig-map-clip')
    .append('rect').attr('width', W).attr('height', mapH);
  const mapG = svg.append('g').attr('clip-path', 'url(#ig-map-clip)');
  _buildRichMapLayers(mapG, projection, W, mapH);

  // Details panel
  const panelColor = won ? '#C41230' : '#1c1c2e';
  svg.append('rect').attr('x', 0).attr('y', mapH).attr('width', W).attr('height', panelH)
    .attr('fill', panelColor);

  const txt = (x, y, text, size, weight, opacity = 1) =>
    svg.append('text')
      .attr('x', x).attr('y', y).attr('text-anchor', 'middle')
      .attr('font-family', 'system-ui, -apple-system, sans-serif')
      .attr('font-size', size).attr('font-weight', weight)
      .attr('fill', `rgba(255,255,255,${opacity})`)
      .text(text);

  txt(W/2, mapH + 100, 'DAILY DISTRICT',  32, '800', 0.65);
  txt(W/2, mapH + 230, outcome,           52, '700', 1);
  txt(W/2, mapH + 340, grid,              40, '400', 1);
  txt(W/2, mapH + 490, 'daily-district.com', 22, '400', 0.45);

  return _svgToBlob(svg.node(), W, H);
}

function renderDistrictPreview(containerId = 'result-district-preview') {
  const container = document.getElementById(containerId);
  if (!container || !todayDistrict || !window.d3) return;
  container.innerHTML = '';

  const pad = 20;
  // Use the content box (clientWidth/Height) — offsetWidth/Height include the 1px
  // border, which skews the viewBox aspect ratio and letterboxes a thin gap.
  const W = Math.max(container.clientWidth  || 440, 100);
  const H = Math.max(container.clientHeight || 180, 100);
  const dark = isDarkMode();
  const projection = _previewProjection(W, H, pad);
  const pathGen = d3.geoPath(projection);

  // Filter roads/urban to the geographic area actually VISIBLE in the preview viewport
  // (not just the district bbox) so they fill the whole box rather than stopping at the
  // district edges. Invert the viewport corners; fall back to the district bbox. The
  // preview container's overflow:hidden clips the overdraw cleanly at the box edges.
  const db = d3.geoBounds(todayDistrict);
  let bx0 = db[0][0], by0 = db[0][1], bx1 = db[1][0], by1 = db[1][1];
  try {
    const pts = [[0, 0], [W, 0], [0, H], [W, H]].map(p => projection.invert(p))
      .filter(p => p && isFinite(p[0]) && isFinite(p[1]));
    if (pts.length >= 2) {
      const lons = pts.map(p => p[0]), lats = pts.map(p => p[1]);
      bx0 = Math.min(...lons); bx1 = Math.max(...lons);
      by0 = Math.min(...lats); by1 = Math.max(...lats);
    }
  } catch (_) { /* keep district bbox */ }
  const mg = 0.05;
  const inBounds = f => {
    try {
      const [[fx0, fy0], [fx1, fy1]] = d3.geoBounds(f);
      return fx1 >= bx0 - mg && fx0 <= bx1 + mg && fy1 >= by0 - mg && fy0 <= by1 + mg;
    } catch { return false; }
  };

  const svg = d3.create('svg')
    .attr('viewBox', `0 0 ${W} ${H}`)
    .attr('class', 'district-preview-svg');

  // Urban areas
  if (topoUrban) {
    const urbanG = svg.append('g');
    topoUrban.features.filter(inBounds).forEach(f => {
      urbanG.append('path').attr('d', pathGen(f))
        .attr('fill', dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)')
        .attr('stroke', 'none');
    });
  }

  // Roads
  if (topoRoads) {
    const roadsG = svg.append('g');
    topoRoads.features.filter(inBounds).forEach(f => {
      roadsG.append('path').attr('d', pathGen(f))
        .attr('fill', 'none')
        .attr('stroke', dark ? 'rgba(255,255,255,0.2)' : '#bbb')
        .attr('stroke-width', 0.6);
    });
  }

  // Exterior mask: dims area outside the district
  const dPath = pathGen(todayDistrict);
  svg.append('path')
    .attr('d', `M0,0L${W},0L${W},${H}L0,${H}Z ${dPath}`)
    .attr('fill', dark ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.18)')
    .attr('fill-rule', 'evenodd');

  // District fill
  svg.append('path').attr('d', dPath)
    .attr('fill', '#C41230').attr('fill-opacity', dark ? 0.45 : 0.25);

  // District stroke
  svg.append('path').attr('d', dPath)
    .attr('fill', 'none')
    .attr('stroke', dark ? '#ff6b6b' : '#C41230')
    .attr('stroke-width', 2.5).attr('stroke-linejoin', 'round');

  container.appendChild(svg.node());
}

// Spark that laps the answer-district boundary trailing embers. Runs on the live game-over
// map (reads .go-answer-district from the DOM), so it works at the current zoom/pan.
function _runGameoverSparkTrace() {
  const container = document.getElementById('gameover-map');
  if (!container) return;
  const svgNode    = container.querySelector('svg');
  const gNode      = container.querySelector('svg > g') || svgNode;
  const answerNode = container.querySelector('.go-answer-district');
  if (!svgNode || !gNode || !answerNode) return;
  const len = answerNode.getTotalLength ? answerNode.getTotalLength() : 0;
  if (!(len > 0)) return;

  const wonGame = lastGameWon;
  const glow1 = wonGame ? '#FDB515' : '#ff6060';
  const glow2 = wonGame ? '#ffb020' : '#C41230';
  const g = d3.select(gNode);
  g.select('.go-spark-layer').remove();   // drop any prior trace before re-running
  const sparkLayer = g.append('g').attr('class', 'go-spark-layer').attr('pointer-events', 'none');
  sparkLayer.raise();

  function getK() { return d3.zoomTransform(svgNode).k || 1; }
  const spark = sparkLayer.append('circle')
    .attr('r', 4 / getK()).attr('pointer-events', 'none')
    .attr('fill', wonGame ? '#fffbe8' : '#fff')
    .style('filter', `drop-shadow(0 0 4px #fff) drop-shadow(0 0 10px ${glow1}) drop-shadow(0 0 16px ${glow2})`);
  const p0 = answerNode.getPointAtLength(0);
  spark.attr('cx', p0.x).attr('cy', p0.y);

  // Embers are plain bright circles — no per-element drop-shadow filter, which forces an
  // expensive GPU repaint every frame for each of the ~dozen embers alive at once.
  function emitEmber(x, y) {
    const k = getK();
    const ang = Math.random() * Math.PI * 2;
    const d = (6 + Math.random() * 9) / k;
    sparkLayer.append('circle')
      .attr('cx', x).attr('cy', y).attr('r', (1.5 + Math.random() * 1.2) / k)
      .attr('fill', Math.random() < 0.5 ? glow1 : glow2).attr('pointer-events', 'none')
      .transition().duration(350 + Math.random() * 200).ease(d3.easeCubicOut)
        .attr('cx', x + Math.cos(ang) * d).attr('cy', y + Math.sin(ang) * d)
        .attr('r', 0).style('opacity', 0).remove();
  }

  const LAPS = 5, LAP_MS = 5000, t0 = performance.now();
  let emberToggle = false;
  (function frame(now) {
    const elapsed = now - t0;
    const pt = answerNode.getPointAtLength(((elapsed % LAP_MS) / LAP_MS) * len);
    spark.attr('cx', pt.x).attr('cy', pt.y).attr('r', 4 / getK());
    emberToggle = !emberToggle;
    if (emberToggle) emitEmber(pt.x, pt.y);
    if (elapsed < LAPS * LAP_MS) requestAnimationFrame(frame);
    else spark.transition().duration(300).attr('r', 0).style('opacity', 0).remove();
  })(t0);
}

// The district celebration: the boundary spark trace. Fired when the player returns to
// the map from the result modal. (The confetti firework used to burst from the district's
// on-screen center here too, but its full-viewport canvas sat on top of the District
// Profile sheet that opens at the same moment, hiding it — suppressed entirely.)
function _celebrateGameoverDistrict() {
  _runGameoverSparkTrace();
}

function launchConfetti() {
  const isMobile = navigator.maxTouchPoints > 0;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;will-change:transform;transform:translateZ(0)';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  const COLORS = ['#C41230','#FDB515','#2563EB','#16a34a','#f97316','#8b5cf6'];
  const count = isMobile ? 70 : 140;
  const particles = Array.from({length: count}, () => ({
    x: Math.random() * canvas.width,
    y: -10 - Math.random() * 100,
    w: 6 + Math.random() * 6,
    h: 3 + Math.random() * 4,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    vx: (Math.random() - 0.5) * 3,
    vy: 2 + Math.random() * 4,
    angle: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 0.2,
  }));
  particles.sort((a, b) => (a.color < b.color ? -1 : a.color > b.color ? 1 : 0));
  let frame, start;
  function tick(ts) {
    if (!start) start = ts;
    const elapsed = ts - start;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const alpha = elapsed < 2000 ? 1 : Math.max(0, 1 - (elapsed - 2000) / 800);
    ctx.globalAlpha = alpha;
    let alive = false, lastColor = null;
    for (const p of particles) {
      p.x += p.vx; p.y += p.vy; p.vy += 0.08;
      p.angle += p.spin;
      if (p.y < canvas.height + 20) alive = true;
      if (p.color !== lastColor) { ctx.fillStyle = p.color; lastColor = p.color; }
      const cos = Math.cos(p.angle), sin = Math.sin(p.angle);
      ctx.setTransform(cos, sin, -sin, cos, p.x, p.y);
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (alive && elapsed < 3500) frame = requestAnimationFrame(tick);
    else { cancelAnimationFrame(frame); canvas.remove(); }
  }
  frame = requestAnimationFrame(tick);
}


// Activate the result-modal AdSense slot. Only fires for anonymous players and only once
// the <ins> actually has width on screen — AdSense permanently marks a slot "done" (unfilled)
// if push() runs while it's display:none / 0-width, so we retry until it's visible.
function _pushResultAd(attempt = 0) {
  if (_resultAdPushed || !isAnonymousPlayer) return;
  const ins = document.querySelector('#result-ad ins.adsbygoogle');
  if (!ins || ins.offsetWidth < 1) {
    if (attempt < 12) setTimeout(() => _pushResultAd(attempt + 1), 200);
    return;
  }
  try { (window.adsbygoogle = window.adsbygoogle || []).push({}); _resultAdPushed = true; }
  catch (e) { /* adsbygoogle.js blocked or not loaded — leave the slot empty */ }
}

// Activate the desktop side-rail ad slots. Only pushes when the rails are actually shown
// (wide desktop → non-zero width) and the placeholder slot id has been replaced with a real
// one, since AdSense permanently fails a slot pushed at 0 width / with a bad slot.
function _pushSideAds() {
  if (_sideAdsPushed) return;
  const rails = [...document.querySelectorAll('.side-ad ins.adsbygoogle')]
    .filter(ins => /^\d+$/.test(ins.getAttribute('data-ad-slot') || ''));   // skip the REPLACE_… placeholder
  if (!rails.length || !rails.every(ins => ins.offsetWidth > 0)) return;
  try { rails.forEach(() => (window.adsbygoogle = window.adsbygoogle || []).push({})); _sideAdsPushed = true; }
  catch (e) { /* adsbygoogle.js blocked or not loaded — leave the rails empty */ }
}

// Opens the (already-populated) result modal and fires confetti once per game on a win.
// Used by the "View Result" banner button and "Review Result" welcome-splash button —
// the actual content is rendered ahead of time by showResult(won, false) in endGame().
function openResultModal() {
  document.querySelector('.gameover-results-arrow')?.remove();
  document.getElementById('gameover-census')?.classList.remove('open');
  const modal = document.getElementById('result-modal');
  modal.classList.remove('hidden');
  // Re-render preview now that modal is visible and container has real dimensions
  requestAnimationFrame(() => renderDistrictPreview());
  _pushResultAd();   // anonymous players: activate the ad slot now that it's on screen
  // Ensure the anon-CTA/personal-stats visibility matches the CURRENT sign-in state every
  // time the modal opens — the static HTML ships with them backwards for an anonymous
  // session (personal-stats visible, anon-cta hidden), and nothing else corrects that
  // until a game actually ends. Without this, a fresh anonymous session (e.g. right after
  // signing out) that opens results before finishing a game shows the wrong widget.
  refreshSignedInUI();
  if (gameOver) {
    switchResultTab('result');
  } else {
    // No finished game yet — land on All Time stats and placeholder the rest.
    const rs = document.getElementById('result-stats');
    const gh = document.getElementById('guess-history');
    if (rs) rs.innerHTML = '<div class="lb-empty">Finish today’s puzzle to see your result.</div>';
    if (gh) gh.innerHTML = '<div class="lb-empty">Finish today’s puzzle to see your guesses.</div>';
    switchResultTab('alltime');
  }
  if (lastGameWon && !_resultConfettiFired) {
    _resultConfettiFired = true;
    _launchConfettiAfterAnim();
  }
}


// Fire confetti only after the game-over win-pulse animation has completed.
// The pulse runs with a 650ms delay + 700ms duration = ~1350ms total.
// If the user opens results before then, we wait out the remainder first.
function _launchConfettiAfterAnim() {
  const WIN_ANIM_MS = 1400;
  const wait = Math.max(0, WIN_ANIM_MS - (Date.now() - _gameOverTime));
  setTimeout(() => {
    launchConfetti();
  }, wait);
}

function showResult(won, autoOpen = true) {
  const modal = document.getElementById('result-modal');
  // Don't auto-open the result modal if the welcome splash is still up —
  // the user will reach it via the "Review Result" button on that screen.
  const welcomeVisible = !document.getElementById('welcome-modal')?.classList.contains('hidden');
  if (autoOpen && !welcomeVisible) {
    modal.classList.remove('hidden');
    switchResultTab('result');
    _pushResultAd();   // anonymous players: activate the ad slot now that it's on screen
    if (won && !_resultConfettiFired) {
      _resultConfettiFired = true;
      _launchConfettiAfterAnim();
    }
  }

  const answer    = todayDistrict.properties['state-district'];
  const stateName = STATE_NAMES[todayDistrict.properties.state] || todayDistrict.properties.state;
  const distPart  = answer.slice(todayDistrict.properties.state.length + 1);
  const isAtLarge = (stateDistrictMap[todayDistrict.properties.state] || []).length === 1;
  const distLabel = isAtLarge ? 'At-Large District' : `District ${parseInt(distPart, 10)}`;

  // District preview map
  renderDistrictPreview();

  // Answer block
  const msg   = document.getElementById('result-message');
  const stats = document.getElementById('result-stats');

  // The result modal is today-only — archive never opens it (archive ends on the
  // game-over screen with the archived district's profile instead).
  if (won) {
    // Pick a random celebratory line, tiered by how few guesses it took.
    const praise = guessCount === 1
      ? ['Hole in one!', 'Bullseye!', 'On the money!', 'Gold medal!', 'Bingo!', 'Nailed it!']
      : guessCount <= 3
        ? ['Impressive!', 'Amazing!', 'Awesome!', 'Fantastic!', '¡Fantástico!', 'Magnifique!']
        : ['Got it!', 'Cool!', '¡Excelente!', '¡Bueno!'];
    msg.innerHTML = praise[Math.floor(Math.random() * praise.length)];
    msg.className = 'won';
  } else {
    // Pick a random consolation line.
    const consolation = [
      'Better luck tomorrow!', 'Better luck next time!', 'Tough break!',
      'Back to the drawing board!', 'Close call!', 'Game over!',
      "You win some, you lose some.", 'Not this round!', 'Tough luck!', 'No dice!',
      "We'll get 'em next time!", 'On to the next one!',
    ];
    msg.innerHTML = consolation[Math.floor(Math.random() * consolation.length)];
    msg.className = 'lost';
  }

  stats.innerHTML = `
    <div class="result-answer">
      <span class="result-answer-code">${answer}</span>
    </div>
    ${won ? `<div class="result-time-line">Solved in <strong>${guessCount}</strong> guess${guessCount !== 1 ? 'es' : ''} &middot; <strong>${formatTime(elapsedSeconds)}</strong></div>` : ''}`;

  // Wordle-style statistics + distribution
  renderInlinePersonalStats();

  // Anonymous players: hide the (empty) personal-stats block and invite them to sign
  // in. Signed-in players see their stats and no CTA.
  const anonCta = document.getElementById('result-anon-cta');
  const personalStats = document.getElementById('result-personal-stats');
  if (anonCta) anonCta.classList.toggle('hidden', !isAnonymousPlayer);
  if (personalStats) personalStats.classList.toggle('hidden', isAnonymousPlayer);
  // Ad slot: shown only to not-signed-in players.
  document.getElementById('result-ad')?.classList.toggle('hidden', !isAnonymousPlayer);
}

function buildShareText() {
  const answer  = todayDistrict.properties['state-district'];
  const won     = guessHistory.some(g => g.correct && g.phase === 'district');
  // guessCount already reflects wrong guesses + 1 for the win (added in endGame)
  const winNum  = won ? guessCount : null;
  const usedSlots = guessHistory.map(g => {
    if (g.correct && g.phase === 'district') return '✓';
    if (g.correct && g.phase === 'state')    return '○';  // correct state — not a "wrong" guess
    return '✗';
  });
  const grid = usedSlots.join(' ');   // only the guesses made — no empty-slot padding
  const outcome = won ? `solved in ${winNum}/${MAX_GUESSES} guesses` : `unsolved (${MAX_GUESSES}/${MAX_GUESSES})`;
  // Differentiate a hard-mode game (shape only — no terrain/hints during play).
  const hardTag = gameHardMode ? ' 🔒 Hard mode' : '';
  // Archive replays name the specific past puzzle so the share doesn't read as today's daily.
  const title = (isArchiveGame && serverArchive?.puzzleNumber != null)
    ? `Daily District No. ${serverArchive.puzzleNumber}`
    : 'Daily District';
  return `🗺️ ${title} — ${outcome}${hardTag}\n${grid}\nCan you identify it? https://daily-district.com/`;
}

// Share the result as text + a landscape map image via the Web Share API; falls back to
// share-text-only, then to a Twitter/X intent. Shared by the result modal and the
// game-over screen's Share button.
async function shareResultText() {
  const text = buildShareText();
  if (navigator.canShare && todayDistrict && window.d3) {
    try {
      const blob = await _renderDistrictToBlob();
      const file = new File([blob], 'daily-district.png', { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text }); return; }
    } catch (err) { if (err?.name === 'AbortError') return; }
  }
  if (navigator.share) {
    try { await navigator.share({ text }); return; } catch (err) { if (err?.name === 'AbortError') return; }
  }
  window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(text), '_blank', 'noopener,noreferrer');
}

// Share a portrait 1080×1350 image (map + details) via Web Share; desktop falls back to a
// download. Shared by the result modal and the game-over screen's Post button.
async function shareResultImage() {
  try {
    const blob = await _renderShareBlob();
    const fname = `daily-district-${todayDistrict?.properties['state-district'] || 'share'}.png`;
    const file = new File([blob], fname, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file] }); return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fname;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  } catch (err) {
    if (err?.name !== 'AbortError') console.warn('Share failed:', err);
  }
}

// Loads the leaderboard panels inside the result modal's Leaderboard tab.
// Fills the All Time (global aggregate) and My Stats (personal) tab panes.
// Pure-CSS loading block: the tiled globe loader + a label. Compositor-animated, so it
// keeps moving even while the main thread is busy. Reused across async panels.
function loadingBlock(text = 'Loading…') {
  return `<div class="lb-loading">${globeLoader(52)}<span>${text}</span></div>`;
}

async function loadLeaderboardPanels() {
  const alltimeEl  = document.getElementById('alltime-scores');
  const personalEl = document.getElementById('personal-stats');
  const todayEl    = document.getElementById('today-everyone-scores');
  if (!alltimeEl || !personalEl) return;
  alltimeEl.innerHTML = personalEl.innerHTML = loadingBlock();
  if (todayEl) todayEl.innerHTML = loadingBlock();

  if (!window.DistrictBackend) {
    alltimeEl.innerHTML = personalEl.innerHTML = '<div class="lb-empty">Stats unavailable.</div>';
    if (todayEl) todayEl.innerHTML = '<div class="lb-empty">Stats unavailable.</div>';
    return;
  }

  try {
    // All stats come from the database — nothing local.
    const lb = await window.DistrictBackend.leaderboard();
    alltimeEl.innerHTML = renderAggregatePanel(lb.allTime, 'No games recorded yet.');
    // lb.user is null specifically when signed OUT (vs. signed in with 0 games played) —
    // show the same "sign in to save your stats" widget used on the Today's District "Me"
    // tab, rather than a plain empty-state sentence, for a signed-out player here too.
    personalEl.innerHTML = !lb.user
      ? anonStatsCtaMarkup()
      : lb.user.played > 0
        ? renderUserStats(lb.user)
        : '<div class="lb-empty">Play today’s puzzle to start tracking your stats.</div>';
    if (todayEl) todayEl.innerHTML = renderAggregatePanel(lb.today, 'No one has finished today’s puzzle yet.');
  } catch (e) {
    alltimeEl.innerHTML = personalEl.innerHTML = '<div class="lb-empty">Couldn’t load stats.</div>';
    if (todayEl) todayEl.innerHTML = '<div class="lb-empty">Couldn’t load stats.</div>';
  }
}

// Guess-distribution bars, shared by the aggregate and personal panels.
function renderDistBars(dist, highlightKey) {
  const keys = [1, 2, 3, 4, 5, 6, 'X'];
  const maxBar = Math.max(...keys.map(k => Number(dist?.[k]) || 0), 1);
  return keys.map(k => {
    const count = Number(dist?.[k]) || 0;
    const pct   = count > 0 ? Math.max(Math.round(count / maxBar * 100), 12) : 0;
    const hi    = highlightKey != null && k === highlightKey;
    return `<div class="rdist-row">
      <span class="rdist-n">${k}</span>
      <div class="rdist-bar-wrap">
        <div class="rdist-bar${hi ? ' today' : ''}" style="width:${pct}%">
          ${count ? `<span class="rdist-count">${count}</span>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
}

// "Sign in to save your stats" widget — shown on any "Me" tab for a signed-out player
// (Today's District's #result-anon-cta is the static original; this is the same markup for
// dynamically-rendered panels like Lifetime's "Me" tab). The button has no id since this can
// render more than once; a delegated click listener (by class) opens the login modal.
function anonStatsCtaMarkup() {
  return `
    <div class="result-anon-cta">
      <div class="result-anon-cta-text">
        <strong>Want to save your stats?</strong>
        <span>Sign in to track your streak and compare with other players.</span>
      </div>
      <button class="result-anon-cta-btn">Sign in / Sign up</button>
    </div>`;
}

// Today / All Time — aggregate across ALL players.
function renderAggregatePanel(d, emptyMsg) {
  const headCount = d ? (d.games != null ? d.games : d.players) : 0;
  const avgGuesses = d && d.avgGuessesWin != null ? Number(d.avgGuessesWin).toFixed(1) : '—';
  const avgTime    = d && d.avgSeconds != null ? formatTime(d.avgSeconds) : '—';
  const headLabel  = d && d.games != null ? 'Games' : 'Players';
  // Even with no games yet, still show the full guess-distribution skeleton (all
  // possible outcomes 1–6 and X) so the histogram always represents every guess.
  const emptyNote = !headCount ? `<div class="lb-empty">${emptyMsg}</div>` : '';
  return `
    ${emptyNote}
    <div class="personal-grid">
      <div class="stat-card"><div class="stat-val">${headCount}</div><div class="stat-label">${headLabel}</div></div>
      <div class="stat-card"><div class="stat-val">${(d && d.winPct) ?? 0}%</div><div class="stat-label">Win Rate</div></div>
      <div class="stat-card"><div class="stat-val">${avgGuesses}</div><div class="stat-label">Avg Guesses</div></div>
      <div class="stat-card"><div class="stat-val">${avgTime}</div><div class="stat-label">Avg Time</div></div>
    </div>
    <div class="result-dist">
      <h4>Guess Distribution · all players</h4>
      ${renderDistBars(d && d.dist)}
    </div>`;
}

// My Stats — the signed-in player only (distribution + avg guesses + streaks).
function renderUserStats(u) {
  const avgGuesses = u.avgGuessesWin != null ? Number(u.avgGuessesWin).toFixed(1) : '—';
  const avgTime    = u.avgSeconds != null ? formatTime(Number(u.avgSeconds)) : '—';
  const wonToday = gameOver && guessHistory.some(g => g.correct && g.phase === 'district');
  const hiKey = gameOver ? (wonToday ? guessCount : 'X') : null;
  return `
    <div class="personal-grid">
      <div class="stat-card"><div class="stat-val">${u.played}</div><div class="stat-label">Played</div></div>
      <div class="stat-card"><div class="stat-val">${u.winPct ?? 0}%</div><div class="stat-label">Win Rate</div></div>
      <div class="stat-card"><div class="stat-val">${u.curStreak ?? 0}</div><div class="stat-label">Current Streak</div></div>
      <div class="stat-card"><div class="stat-val">${u.maxStreak ?? 0}</div><div class="stat-label">Max Streak</div></div>
    </div>
    <div class="result-dist">
      <h4>Guess Distribution</h4>
      ${renderDistBars(u.dist, hiKey)}
    </div>
    <div class="rstat-avg-time">Avg. guesses (wins): <strong>${avgGuesses}</strong> &nbsp;&middot;&nbsp; Avg. time: <strong>${avgTime}</strong></div>`;
}


// ============================================================
//  INIT
// ============================================================
// Lazy-load decorative overlays (roads + urban, county lines) — non-blocking.
// Only needed for district-phase and game-over maps, so it never blocks first paint.
function loadDecorativeOverlays() {
  // Roads + urban.
  fetch('./districts-overlay.topojson')
    .then(r => r.ok ? r.json() : Promise.reject(r.status))
    .then(topo => {
      if (topo.objects.roads) topoRoads = topojson.feature(topo, topo.objects.roads);
      if (topo.objects.urban) topoUrban = topojson.feature(topo, topo.objects.urban);
      // Re-render if game is already over so roads/urban appear even if fetch was slow
      if (gameOver && map) renderMapD3(currentMapStage);
    })
    .catch(err => console.warn('Overlay load failed (non-fatal):', err));

  // County boundary lines — used on district gameplay and game-over screens.
  fetch('./counties-lines.topojson')
    .then(r => r.ok ? r.json() : Promise.reject(r.status))
    .then(topo => {
      const obj = topo.objects[Object.keys(topo.objects)[0]];
      if (obj) {
        topoCounties = topojson.feature(topo, obj);
        // If already in district gameplay, rebuild so the county layer appears immediately
        if (gamePhase === 'district' && !gameOver && todayDistrict) {
          buildDistrictD3Map(todayDistrict.properties.state, false, false);
        }
      }
    })
    .catch(err => console.warn('Counties load failed (non-fatal):', err));
}

async function init() {
  // Server-authoritative daily. Signed-in players get the persisted, leaderboard-
  // recorded game; anyone else plays anonymously (nothing recorded server-side). If an
  // anonymous player signs in before making a guess, re-bind to their account by re-initing.
  let user = null;
  try { user = await window.DistrictBackend.getUser(); } catch (_) {}
  isAnonymousPlayer = !user;
  if (isAnonymousPlayer) {
    window.addEventListener('district-auth', () => {
      // Reload rather than calling init() again in-place: initServer() wires up a lot of
      // DOM/map/event-listener state that isn't safe to run twice on the same page load —
      // a second in-place init() left the map genuinely broken (state clicks stopped
      // working) after a sign-in that landed here. A reload always starts clean.
      if (isAnonymousPlayer && guessHistory.length === 0 && !gameOver) window.location.reload();
    }, { once: true });
  } else {
    // Already signed in on load: align the device-local stats with the account's server
    // stats so the Result tab matches the Leaderboard (fire-and-forget).
    hydratePersonalStatsFromServer();
  }
  return initServer();
}

// ============================================================
//  EVENT LISTENERS
// ============================================================
// A sign-in mid/post-session (incl. switching accounts) means the player is no longer
// anonymous. The local anonymous session (finished OR still in progress) doesn't
// necessarily belong to this account — it could already have its OWN server-side result
// for today (e.g. played earlier, on this or another device; that account's result is
// authoritative and must never be clobbered). So: check first. If the account has no
// result yet, carry the anonymous guesses forward onto it (bindAnonymousGameToAccount
// handles a finished or in-progress game the same way — otherwise they'd be signed in
// with empty stats and still see the "sign in to save" nudge). Either way, reload so the
// board rebuilds from initServer() against the now-authoritative account state, rather
// than trying to hand-patch the in-place D3/game state (subtle bugs) or leave the stale
// anonymous screen showing (previously the finished-game case skipped this check
// entirely and just replayed guesses regardless — the server's "already_completed" guard
// stopped it from actually overwriting a prior result, but the client silently swallowed
// that rejection and never showed the player their real game).
// (Anonymous→sign-in *before* guessing re-inits via the once-listener in init().)
window.addEventListener('district-auth', async () => {
  const wasAnon = isAnonymousPlayer;
  isAnonymousPlayer = false;

  if (wasAnon && !isArchiveGame && Array.isArray(guessHistory) && guessHistory.length > 0) {
    let accountResult = null;
    try { accountResult = (await window.DistrictBackend.today())?.result ?? null; }
    catch (e) { /* network hiccup — fall through; safest is to still attempt the bind */ }
    if (!accountResult) await bindAnonymousGameToAccount();
    window.location.reload();
    return;
  }
  // No anonymous guesses to reconcile, but the account being signed into may already
  // have completed today's puzzle on another device/session — the in-memory game state
  // (gameOver, guessHistory, welcome buttons) still reflects whatever was showing before
  // login, so check the server and reload to rebuild everything from initServer() if so.
  if (!isArchiveGame) {
    let accountResult = null;
    try { accountResult = (await window.DistrictBackend.today())?.result ?? null; }
    catch (e) { /* network hiccup — fall through, no reload */ }
    if (accountResult && accountResult.completed && !gameOver) {
      window.location.reload();
      return;
    }
  }
  await hydratePersonalStatsFromServer(); // now includes the just-bound game
  refreshSignedInUI();                     // hide the sign-in nudges, show personal stats
});

document.addEventListener('DOMContentLoaded', () => {
  applyDarkModeClass(); // must run before init() so D3 map gets correct colors
  updateThemeToggle();

  buildGameSection();

  // Show welcome splash immediately — game loads in background behind it. The puzzle
  // number is authoritative from the server (stamped by initServer once /today returns);
  // we only fill the date instantly here.
  (function showWelcomeImmediately() {
    const wm = document.getElementById('welcome-modal');
    if (!wm) return;
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const dateLine = document.getElementById('welcome-date-line');
    if (dateLine) dateLine.textContent = dateStr;
  })();

  const _initPromise = init();

  // Register the service worker on every visit (not gated on the push opt-in decision):
  // it's also what makes the site installable, which iOS requires before Web Push works.
  window.DistrictBackend?.registerServiceWorker?.();

  // District tile clicks — delegated from document so it survives game-section recreation
  document.addEventListener('click', e => {
    if (!e.target.closest('#district-tiles')) return;
    const tile = e.target.closest('.district-tile');
    if (!tile || tile.disabled) return;
    submitDistrictTile(tile.dataset.dist);
  });

  // ── Play Archive — replay a past daily puzzle (unofficial, not counted) ────
  // Build + open the archive list: every past daily (newest first), fetched from the
  // `archive` endpoint. Past answers are public, so this is safe.
  // Archive picker state: every past puzzle keyed by date, plus the months that have any.
  let _archiveByDate = {};      // 'YYYY-MM-DD' -> { date, puzzleNumber }
  let _archiveMonths = [];      // ['YYYY-MM', ...] newest first

  async function openArchive() {
    const list = document.getElementById('archive-list');
    list.innerHTML = loadingBlock();
    document.getElementById('result-modal')?.classList.add('hidden');
    document.getElementById('archive-modal').classList.remove('hidden');
    let resp;
    try { resp = await window.DistrictBackend.archiveList(); }
    catch (e) { list.innerHTML = '<div class="lb-empty">Could not load the archive.</div>'; return; }
    const puzzles = (resp && resp.puzzles) || [];
    _archiveByDate = {};
    const months = new Set();
    for (const p of puzzles) { _archiveByDate[p.date] = p; months.add(p.date.slice(0, 7)); }
    _archiveMonths = [...months].sort().reverse();
    renderArchiveMonths();
  }

  // Level 1: a list of months (newest first), each showing its puzzle count.
  function renderArchiveMonths() {
    const list = document.getElementById('archive-list');
    list.classList.remove('archive-calendar-view');
    if (!_archiveMonths.length) { list.innerHTML = '<div class="lb-empty">No past puzzles yet.</div>'; return; }
    list.innerHTML = _archiveMonths.map(ym => {
      const [y, m] = ym.split('-').map(Number);
      const label  = new Date(y, m - 1, 1).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      const count  = Object.keys(_archiveByDate).filter(d => d.startsWith(ym)).length;
      return `<button class="archive-item archive-month-btn" data-ym="${ym}">` +
             `<span class="archive-num">${label}</span>` +
             `<span class="archive-date">${count} puzzle${count !== 1 ? 's' : ''} ›</span></button>`;
    }).join('');
  }

  // Level 2: a calendar grid for one month; only days with a puzzle are clickable.
  function renderArchiveCalendar(ym) {
    const list = document.getElementById('archive-list');
    const [y, m] = ym.split('-').map(Number);
    const monthLabel  = new Date(y, m - 1, 1).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    const firstDow    = new Date(y, m - 1, 1).getDay();   // 0 = Sunday
    const daysInMonth = new Date(y, m, 0).getDate();
    const weekdays = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
      .map(d => `<span class="archive-cal-wd">${d}</span>`).join('');
    let cells = '';
    for (let i = 0; i < firstDow; i++) cells += '<span class="archive-cal-cell empty"></span>';
    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${ym}-${String(day).padStart(2, '0')}`;
      const p = _archiveByDate[date];
      if (p) {
        const full = new Date(y, m - 1, day).toLocaleDateString('en-US',
          { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
        cells += `<button class="archive-cal-cell has-puzzle" data-date="${date}" ` +
                 `data-num="${p.puzzleNumber}" data-label="${full}" title="No. ${p.puzzleNumber}">${day}</button>`;
      } else {
        cells += `<span class="archive-cal-cell">${day}</span>`;
      }
    }
    list.classList.add('archive-calendar-view');
    list.innerHTML =
      `<div class="archive-cal-head"><button class="archive-cal-back" data-archive-back>‹ Months</button>` +
      `<span class="archive-cal-title">${monthLabel}</span></div>` +
      `<div class="archive-cal-grid">${weekdays}${cells}</div>`;
  }

  document.getElementById('archive-list').addEventListener('click', (e) => {
    const monthBtn = e.target.closest('.archive-month-btn');
    if (monthBtn) { renderArchiveCalendar(monthBtn.dataset.ym); return; }
    if (e.target.closest('[data-archive-back]')) { renderArchiveMonths(); return; }
    const cell = e.target.closest('.archive-cal-cell.has-puzzle');
    if (!cell || !cell.dataset.date) return;
    startServerArchive(cell.dataset.date, parseInt(cell.dataset.num, 10), cell.dataset.label);
  });
  document.getElementById('archive-close').addEventListener('click', () => {
    document.getElementById('archive-modal').classList.add('hidden');
  });
  document.getElementById('play-again-btn').addEventListener('click', openArchive);
  document.getElementById('banner-new-map-btn').addEventListener('click', openArchive);

  // Game-over modal controls — delegated from document so they survive div recreation
  document.addEventListener('click', e => {
    if (e.target.closest('#gameover-result-btn')) {
      // The result modal is today-only. From an archive game-over, "Today's Results"
      // returns to the daily (no reload) and opens its result modal on arrival.
      if (isArchiveGame) returnToTodayDaily(true);
      else openResultModal();
      return;
    }
    if (e.target.closest('#gameover-share-btn')) { shareResultText(); return; }
    if (e.target.closest('#gameover-new-map-btn')) { openArchive(); return; }
    const btn = e.target.closest('#gameover-modal .mzb-go');
    if (!btn || !_goZoom) return;
    const svgSel = d3.select('#gameover-map svg');
    if (svgSel.empty()) return;
    const dir = btn.dataset.dir;
    if (dir === 'in')  svgSel.transition().duration(250).call(_goZoom.scaleBy, 1.6);
    else if (dir === 'out') svgSel.transition().duration(250).call(_goZoom.scaleBy, 1 / 1.6);
    else if (dir === 'fit-cycle') {
      _goZoomTo(_goZoomLevel);                       // jump to the previewed level
      _goZoomLevel = (_goZoomLevel + 1) % GO_ZOOM_LEVELS.length;
      _setGoCycleIcon(_goZoomLevel);                 // morph icon to the next destination
    }
  });

  // Result-modal share buttons (shared logic with the game-over screen's Share/Post).
  document.getElementById('post-x-btn').addEventListener('click', shareResultText);
  document.getElementById('share-btn').addEventListener('click', shareResultImage);

  // Census cards that have an explanation (.ms-explain) toggle it open/closed when clicked
  // anywhere — single toggle source, so a second click always collapses it.
  document.addEventListener('click', (e) => {
    const card = e.target.closest('.census-card');
    if (!card || !card.querySelector('.ms-explain')) return;
    card.classList.toggle('expanded');
  });

  // Resize — keep Leaflet map tile grid current when container changes
  window.addEventListener('resize', () => {
    if (map) map.invalidateSize();
    _pushSideAds();   // a window widened into the rail breakpoint can now show + fill them
  });
  // Wide desktops show the rails immediately — activate them once the layout settles.
  requestAnimationFrame(_pushSideAds);


  // Leaderboard
  document.getElementById('show-results-btn')?.addEventListener('click', openResultModal);

  // Anonymous results CTA → open the login modal (login.js wires the form/providers).
  // Delegated by class rather than the static button's id, since anonStatsCtaMarkup()
  // renders the same widget (button with no id) into dynamically-built panels too — e.g.
  // the Lifetime Statistics "Me" tab.
  document.addEventListener('click', (e) => {
    if (e.target.closest('.result-anon-cta-btn')) {
      document.getElementById('login-modal')?.classList.remove('hidden');
    }
  });

  // Result modal tabs
  document.querySelectorAll('.result-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchResultTab(btn.dataset.rtab));
  });

  // Welcome splash — shown every time the game opens
  const welcomeModal = document.getElementById('welcome-modal');

  function buildWelcomeButtons() {
    const container = document.getElementById('welcome-buttons');
    container.innerHTML = '';

    // Reset wordmark to SVG (may have been swapped to "Welcome Back" text)
    const wmSvg  = document.querySelector('.welcome-wordmark-svg');
    const wmBack = document.getElementById('welcome-back-text');
    const slogan = document.querySelector('.welcome-slogan');
    if (wmSvg)  wmSvg.hidden  = false;
    if (wmBack) wmBack.hidden = true;
    if (slogan) slogan.textContent = 'Identify the district from its shape';

    function dismissAndStart() {
      const isFirstPlay = !localStorage.getItem(SETTINGS_SEEN_KEY);
      _gameStarted = true;
      ensureUSRefMap();   // safety: build now if PLAY is clicked before the deferred build ran
      welcomeModal.classList.add('hidden');
      localStorage.setItem(WELCOME_SEEN_KEY, '1');
      localStorage.setItem(HOW_TO_SEEN_KEY, '1');
      localStorage.setItem(SETTINGS_SEEN_KEY, '1');
      renderClues();
      renderGuessHistory();
      // #map was sized while hidden behind the modal — Leaflet's cached size is stale
      requestAnimationFrame(() => {
        if (map) map.invalidateSize();
        if (districtLayer) map.fitBounds(districtLayer.getBounds(), { padding: [40, 40], animate: false });
        if (isFirstPlay) {
          updateThemeToggle();
          // Don't force the Settings modal open — point new players to it with a
          // brief, non-blocking callout on the gear that fades after 5s or first tap.
          showSettingsHint();
        }
      });
    }

    if (gameOver) {
      const btnMap = document.createElement('button');
      btnMap.className = 'welcome-action-btn secondary';
      btnMap.textContent = 'Back to Map';
      btnMap.addEventListener('click', () => {
        welcomeModal.classList.add('hidden');
        // Gameover div already exists — just reveal it by hiding the welcome splash
      });

      const btnResult = document.createElement('button');
      btnResult.className = 'welcome-action-btn secondary';
      btnResult.textContent = 'Review Results';
      btnResult.addEventListener('click', () => {
        welcomeModal.classList.add('hidden');
        openResultModal();
      });

      container.appendChild(btnMap);
      container.appendChild(btnResult);

      // Signed-in players who've finished today's puzzle can jump straight into the
      // archive from the welcome screen.
      if (!isAnonymousPlayer) {
        const btnArchive = document.createElement('button');
        btnArchive.className = 'welcome-action-btn secondary';
        btnArchive.textContent = 'Play Archive';
        btnArchive.addEventListener('click', () => {
          welcomeModal.classList.add('hidden');
          openArchive();
        });
        container.appendChild(btnArchive);
      }
    } else {
      const inProgress = guessCount > 0 || correctStateGuessed;
      if (inProgress) {
        if (wmSvg)  wmSvg.hidden  = true;
        if (wmBack) wmBack.hidden = false;
        if (slogan) slogan.textContent =
          `You've made ${guessCount} of ${MAX_GUESSES} guess${guessCount !== 1 ? 'es' : ''}. Keep it up!`;
      }
      const btnPlay = document.createElement('button');
      btnPlay.className = 'welcome-action-btn secondary';
      btnPlay.textContent = inProgress ? 'Continue' : 'Play';
      btnPlay.addEventListener('click', dismissAndStart);
      container.appendChild(btnPlay);
    }
  }

  // After init() resolves (data loaded), keep the loader globe spinning until the heavy
  // US-ref map is actually BUILT — i.e. the game is ready behind the splash — then swap
  // the globe for the Play buttons. (The synchronous build briefly freezes the globe at
  // the very end; that's preferable to dropping the loader before the maps are ready.)
  // A couple of rAFs let the globe paint before/around the blocking build.
  _initPromise.then(() => {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    try { ensureUSRefMap(); } catch (e) { reportClientError('init_refmap', e); }
    requestAnimationFrame(() => {
      buildWelcomeButtons();
      // Game behind the splash is actually ready now — safe to reveal it through a
      // frosted-glass backdrop instead of the solid loading-state background.
      welcomeModal.classList.add('bg-ready');
    });
  }));

  // How to play — auto-show on first visit (after welcome buttons ready)
  const howToModal = document.getElementById('how-to-modal');
  if (!localStorage.getItem(HOW_TO_SEEN_KEY)) {
    howToModal.classList.remove('hidden');
  }
  document.getElementById('how-to-btn').addEventListener('click', () => {
    howToModal.classList.remove('hidden');
  });
  document.getElementById('welcome-how-to-btn')?.addEventListener('click', () => {
    howToModal.classList.remove('hidden');
  });
  document.getElementById('how-to-got-it').addEventListener('click', () => {
    howToModal.classList.add('hidden');
    localStorage.setItem(HOW_TO_SEEN_KEY, '1');
  });

  // About / Donate — header button opens the modal instead of navigating straight out.
  // The decorative header graphic is the canvas TiledGlobe (data-globe span in the HTML,
  // auto-instantiated by globe.js on DOMContentLoaded) — same one used on the welcome screen.
  document.getElementById('donate-btn')?.addEventListener('click', () => {
    document.getElementById('donate-modal')?.classList.remove('hidden');
  });
  }); // end _initPromise.then

  // Title click → show welcome splash
  document.getElementById('title-home-btn')?.addEventListener('click', () => {
    document.getElementById('welcome-modal').classList.remove('hidden');
  });

  // Settings modal
  const settingsModal = document.getElementById('settings-modal');
  document.getElementById('settings-btn').addEventListener('click', () => {
    dismissSettingsHint();
    updateThemeToggle();
    updateHardModeLock();
    refreshPushToggle();
    settingsModal.classList.remove('hidden');
  });
  document.getElementById('settings-close').addEventListener('click', () => {
    settingsModal.classList.add('hidden');
  });
  settingsModal.addEventListener('click', e => {
    if (e.target === settingsModal) settingsModal.classList.add('hidden');
  });
  document.getElementById('settings-dark-toggle').addEventListener('change', () => {
    toggleDarkMode();
    reportSettings('change');
  });
  document.getElementById('settings-reset-theme').addEventListener('click', () => {
    localStorage.removeItem('districtguess_theme');
    document.body.classList.remove('dark-mode', 'light-mode');
    updateThemeToggle();
    // repaint everything to match system pref
    updateUSRefMap();
    if (map && streetLayer) {
      map.removeLayer(streetLayer);
      streetLayer = L.tileLayer(streetTileUrl(), { maxZoom: 19, opacity: _streetOpacity, attribution: streetTileAttrib() }).addTo(map);
    }
    if (map) applyMapStage(guessHistory.filter(g => !g.correct).length, gameOver);
    if (districtLayer) districtLayer.setStyle(districtStyle());
    if (gameOver && todayDistrict) buildDistrictD3Map(todayDistrict.properties.state);
    reportSettings('change');
  });

  // When system preference changes and user has no manual override, repaint everything
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (localStorage.getItem('districtguess_theme')) return; // user chose manually — respect it
    updateThemeToggle();
    updateUSRefMap();
    if (map && streetLayer) {
      map.removeLayer(streetLayer);
      streetLayer = L.tileLayer(streetTileUrl(), { maxZoom: 19, opacity: _streetOpacity, attribution: streetTileAttrib() }).addTo(map);
    }
    if (map) applyMapStage(guessHistory.filter(g => !g.correct).length, gameOver);
    if (districtLayer) districtLayer.setStyle(districtStyle());
    if (gameOver && todayDistrict) buildDistrictD3Map(todayDistrict.properties.state);
  });

  // Closing the result modal at game-over returns to the full game-over view:
  // reveal the game-over screen behind it and re-open the District Profile sheet.
  const revealGameoverFromResult = () => {
    document.getElementById('gameover-modal')?.classList.remove('hidden');
    document.getElementById('gameover-census')?.classList.add('open');
    // District celebration: the boundary spark trace + (on a win) the confetti firework,
    // fired together once the player returns to the map from the result modal. rAF so the
    // game-over modal has laid out before we read the district path's screen position.
    if (!_gameoverCelebrated) {
      _gameoverCelebrated = true;
      requestAnimationFrame(_celebrateGameoverDistrict);
    }
  };

  // Modal close buttons
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = btn.closest('.modal');
      modal.classList.add('hidden');
      // Clear hints list when closing hints modal — populated lazily on open
      if (modal.id === 'hints-modal') {
        const list = document.getElementById('hints-clues-list');
        if (list) list.innerHTML = '';
      }
      if (modal.id === 'result-modal' && gameOver) revealGameoverFromResult();
    });
  });

  // Close modal on backdrop click — except the welcome splash, which must start the
  // game through its Play button (so the map gets sized correctly) rather than a
  // bare backdrop dismiss.
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', e => {
      if (e.target !== modal) return;
      if (modal.id === 'welcome-modal') return;
      modal.classList.add('hidden');
      if (modal.id === 'result-modal' && gameOver) revealGameoverFromResult();
    });
  });

  // Hint bar expand → opens full hints modal
  document.getElementById('hint-bar-expand')?.addEventListener('click', () => {
    renderHintsModal();
    document.getElementById('hints-modal').classList.remove('hidden');
  });

  // Feedback — opened from settings panel
  document.getElementById('settings-feedback-btn')?.addEventListener('click', () => {
    document.getElementById('settings-modal').classList.add('hidden');
    document.getElementById('feedback-modal').classList.remove('hidden');
  });

  document.getElementById('result-feedback-btn')?.addEventListener('click', () => {
    document.getElementById('result-modal').classList.add('hidden');
    document.getElementById('feedback-modal').classList.remove('hidden');
  });

  // ── Push notification opt-in prompt ────────────────────────────────────────
  // showPushOptInModal / maybePromptPushOptIn are defined at module scope (used by
  // endGame() too) — this block just wires the modal's buttons.
  document.getElementById('push-optin-enable')?.addEventListener('click', async () => {
    const modal = document.getElementById('push-optin-modal');
    try {
      await window.DistrictBackend.subscribePush();
      localStorage.setItem(PUSH_DECISION_KEY, 'granted');
    } catch (_) {
      // Declined the browser prompt, or subscription failed — treat like "not now"
      // at stage 1 (still eligible for the 3rd-game re-ask) so a mis-tap isn't final.
      const played = loadPersonalStats()?.played ?? 0;
      localStorage.setItem(PUSH_DECISION_KEY, played >= 2 ? 'dismissed' : 'deferred');
    } finally {
      modal?.classList.add('hidden');
    }
  });
  document.getElementById('push-optin-dismiss')?.addEventListener('click', () => {
    const played = loadPersonalStats()?.played ?? 0;
    localStorage.setItem(PUSH_DECISION_KEY, played >= 2 ? 'dismissed' : 'deferred');
    document.getElementById('push-optin-modal')?.classList.add('hidden');
  });
  document.getElementById('push-optin-ios-dismiss')?.addEventListener('click', () => {
    document.getElementById('push-optin-modal')?.classList.add('hidden');
  });
  document.getElementById('push-optin-blocked-dismiss')?.addEventListener('click', () => {
    document.getElementById('push-optin-modal')?.classList.add('hidden');
  });

  // Wire Hard Mode toggle
  const hardToggle = document.getElementById('settings-hard-toggle');
  if (hardToggle) {
    hardToggle.checked = hardMode;
    hardToggle.addEventListener('change', () => {
      hardMode = hardToggle.checked;
      localStorage.setItem('districtguess_hardMode', hardMode ? '1' : '0');
      // Turning hard mode off mid-game disqualifies this game from being a hard-mode
      // game (latch — turning it back on doesn't restore it). timerRunning ⟺ a game is
      // actively in progress (starts on first guess, stops at game over).
      if (timerRunning && !hardMode) gameHardMode = false;
      reportSettings('change');
      // Apply immediately: refresh the hint bar + map imagery for the new mode.
      renderClues();
      if (map) applyMapStage(guessHistory.filter(g => !g.correct).length, gameOver);
    });
  }

  // Wire Confirm Selection toggle
  const confirmToggle = document.getElementById('settings-confirm-toggle');
  if (confirmToggle) {
    confirmToggle.checked = confirmInputMode;
    confirmToggle.addEventListener('change', () => {
      confirmInputMode = confirmToggle.checked;
      localStorage.setItem('districtguess_confirmMode', confirmInputMode ? '1' : '0');
      if (!confirmInputMode) setConfirmPending(null); // clear any pending state
      reportSettings('change');
    });
  }

  // Wire Daily Reminder (push) toggle
  const pushToggle = document.getElementById('settings-push-toggle');
  const pushDesc = document.getElementById('settings-push-desc');
  async function refreshPushToggle() {
    if (!pushToggle) return;
    const supported = window.DistrictBackend?.pushSupported?.();
    const blocked = supported && typeof Notification !== 'undefined' && Notification.permission === 'denied';
    // iOS Safari (and Chrome-for-iOS, which shares the same WebKit push restriction) never
    // reports pushSupported() true unless the site has been added to the Home Screen first
    // — that's a real, actionable state, not just "unsupported", so it needs its own message
    // instead of falling into the generic "Not supported in this browser" text below.
    const iosNeedsInstall = !supported && window.DistrictBackend?.isIOS?.() && !window.DistrictBackend?.isStandalone?.();
    if (!supported || blocked) {
      pushToggle.checked = false;
      pushToggle.disabled = true;
      if (pushDesc) {
        if (blocked) {
          pushDesc.innerHTML = 'Blocked in your browser’s site settings — <a href="#" id="settings-push-blocked-link">tap here to see how to enable it</a>';
          document.getElementById('settings-push-blocked-link')?.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('settings-modal')?.classList.add('hidden');
            showPushOptInModal({ blocked: true });
          });
        } else if (iosNeedsInstall) {
          pushDesc.innerHTML = 'iPhone/iPad requires adding this site to your Home Screen first — <a href="#" id="settings-push-ios-link">tap here to see how</a>';
          document.getElementById('settings-push-ios-link')?.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('settings-modal')?.classList.add('hidden');
            showPushOptInModal({ forceIOSInstructions: true });
          });
        } else {
          pushDesc.textContent = 'Not supported in this browser';
        }
      }
      return;
    }
    pushToggle.disabled = false;
    if (pushDesc) pushDesc.textContent = 'One notification a day when the new district is live';
    const sub = await window.DistrictBackend.getPushSubscription();
    pushToggle.checked = !!sub;
  }
  if (pushToggle) {
    pushToggle.addEventListener('change', async () => {
      const wantOn = pushToggle.checked;
      pushToggle.disabled = true;
      try {
        if (wantOn) {
          if (window.DistrictBackend.isIOS() && !window.DistrictBackend.isStandalone()) {
            pushToggle.checked = false;
            document.getElementById('settings-modal').classList.add('hidden');
            showPushOptInModal({ forceIOSInstructions: true });
          } else if (isAnonymousPlayer) {
            // subscribePush() ties the subscription to an account row — silently failing
            // here (as a plain catch would) left players who tried this signed out with no
            // idea why the toggle snapped back off. Send them to sign in instead.
            pushToggle.checked = false;
            document.getElementById('settings-modal')?.classList.add('hidden');
            document.getElementById('login-modal')?.classList.remove('hidden');
          } else {
            await window.DistrictBackend.subscribePush();
            localStorage.setItem(PUSH_DECISION_KEY, 'granted');
          }
        } else {
          await window.DistrictBackend.unsubscribePush();
        }
      } catch (_) {
        pushToggle.checked = !wantOn; // revert on failure/declined permission
      } finally {
        await refreshPushToggle();
        reportSettings('change');
      }
    });
  }

  // One-time passive snapshot of the player's settings for this session.
  reportSettings('snapshot');

  document.querySelectorAll('.fb-rating-group').forEach(group => {
    const hidden = group.querySelector('input[type="hidden"]');
    const labels = group.querySelectorAll('.fb-star-label');
    labels.forEach(lbl => {
      lbl.addEventListener('click', () => {
        const val = lbl.dataset.val;
        if (hidden) hidden.value = val;
        labels.forEach(l => l.classList.toggle('selected', +l.dataset.val <= +val));
      });
      lbl.addEventListener('mouseover', () => {
        const val = +lbl.dataset.val;
        labels.forEach(l => l.classList.toggle('hovered', +l.dataset.val <= val));
      });
      lbl.addEventListener('mouseout', () => {
        labels.forEach(l => l.classList.remove('hovered'));
      });
    });
  });

  document.getElementById('feedback-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const val = id => (document.getElementById(id)?.value || '').trim();
    const sel = id => { const el = document.getElementById(id); return el ? el.value : ''; };
    const name     = val('fb-name') || 'Anonymous';
    const email    = val('fb-email');
    const overall  = sel('fb-overall');
    const diff     = sel('fb-difficulty');
    const intuit   = sel('fb-intuitive');
    const mechanic = sel('fb-mechanic');
    const challenge= sel('fb-challenge');
    const freq     = sel('fb-frequency');
    const recommend= sel('fb-recommend');
    const enjoyed  = val('fb-enjoyed');
    const improve  = val('fb-improve');
    const comment  = val('fb-comment');
    const errEl    = document.getElementById('fb-error');

    // All fields optional — submit whatever is filled in (useful for quick bug reports).
    errEl.textContent = '';

    const stats  = loadPersonalStats();

    // Build guess history summary for today's session
    const guessLog = guessHistory.map((g, i) =>
      `  ${i+1}. [${g.phase}] ${g.text}${g.correct ? ' ✓' : g.adjacent === true ? ' (hot)' : g.adjacent === false ? ' (cold)' : ''}`
    ).join('\n') || '  (no guesses yet)';

    // Settings snapshot
    const settingsSnap = [
      `Dark mode: ${isDarkMode() ? 'on' : 'off'}`,
      `Confirm selection: ${confirmInputMode ? 'on' : 'off'}`,
      `Theme pref stored: ${localStorage.getItem('districtguess_theme') || 'system default'}`,
    ].join(', ');

    const subject = `Daily District Feedback — ${name}`;
    const body = [
      `=== Session Info ===`,
      `Version: ${GAME_VERSION}`,
      `Date: ${todayKey}`,
      `District (today): ${todayDistrict ? todayDistrict.properties['state-district'] : 'unknown'}`,
      `Game status: ${gameOver ? (guessHistory.some(g => g.correct) ? 'won' : 'lost') : 'in progress'}`,
      `Guesses used: ${guessCount}`,
      `Solve time: ${elapsedSeconds > 0 ? formatTime(elapsedSeconds) : '—'}`,
      `Replay count (session): ${replayCount}`,
      ``,
      `=== Guess History ===`,
      guessLog,
      ``,
      `=== Lifetime Stats ===`,
      `Played: ${stats?.played ?? 0}  |  Won: ${stats?.won ?? 0}  |  Win %: ${stats?.played ? Math.round((stats.won/stats.played)*100) : 0}%`,
      `Current streak: ${stats?.streak ?? 0}  |  Max streak: ${stats?.maxStreak ?? 0}`,
      `Avg solve time (wins): ${stats?.won > 0 ? formatTime(Math.round((stats.totalWonTime||0)/stats.won)) : '—'}`,
      ``,
      `=== Settings ===`,
      settingsSnap,
      `Browser: ${navigator.userAgent}`,
      `Screen: ${screen.width}×${screen.height}  |  Viewport: ${window.innerWidth}×${window.innerHeight}`,
      ``,
      `=== Player Info ===`,
      `Name: ${name}`,
      `Email: ${email || 'Not provided'}`,
      ``,
      `=== Ratings (1–5 stars) ===`,
      `Overall experience: ${overall}/5`,
      `Difficulty: ${diff}/5  (1=too easy, 5=too hard)`,
      `Ease of understanding: ${intuit}/5`,
      ``,
      `=== Gameplay Questions ===`,
      `Hot/Cold mechanic made sense: ${mechanic}`,
      `Biggest challenge: ${challenge || 'not answered'}`,
      `How often would play: ${freq}`,
      `Would recommend: ${recommend}`,
      ``,
      `=== Open Feedback ===`,
      `Enjoyed most: ${enjoyed || '—'}`,
      `Should improve: ${improve || '—'}`,
      `Other comments: ${comment || '—'}`,
    ].join('\n');

    window.open(
      `mailto:cervas@cmu.edu,jafierman@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
      '_blank'
    );
    localStorage.setItem(FEEDBACK_PROMPTED_AT, String(stats?.played ?? 0));
    document.getElementById('feedback-modal').classList.add('hidden');
    document.getElementById('feedback-form').reset();
  });
});
