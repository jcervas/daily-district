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
// D3 US reference map coordinate space (viewBox dimensions)
const REF_VB_W = 960;
const REF_VB_H = 400;
// Bump on every push. Keep in sync with the ?v= cache-bust params in index.html.
const VERSION_NUMBER = '2.9.28';
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

let DISTRICT_FIT_MARGIN = 0.95;
try { Object.defineProperty(window, 'DISTRICT_FIT_MARGIN', {
  get: () => DISTRICT_FIT_MARGIN, set: v => { DISTRICT_FIT_MARGIN = v; },
}); } catch (_) {}

// ---- CENSUS API KEY (optional, free) -------------------------
// Get one at https://api.census.gov/data/key_signup.html
// Leave empty for keyless access (rate-limited but works fine).
const CENSUS_API_KEY = '95fe940d2fe95c12900a6f024c35f29fac6f28ee';

// ============================================================
//  LOOKUP TABLES
// ============================================================
const STATE_FIPS = {
  AL:'01',AK:'02',AZ:'04',AR:'05',CA:'06',CO:'08',CT:'09',DE:'10',
  FL:'12',GA:'13',HI:'15',ID:'16',IL:'17',IN:'18',IA:'19',KS:'20',
  KY:'21',LA:'22',ME:'23',MD:'24',MA:'25',MI:'26',MN:'27',MS:'28',
  MO:'29',MT:'30',NE:'31',NV:'32',NH:'33',NJ:'34',NM:'35',NY:'36',
  NC:'37',ND:'38',OH:'39',OK:'40',OR:'41',PA:'42',RI:'44',SC:'45',
  SD:'46',TN:'47',TX:'48',UT:'49',VT:'50',VA:'51',WA:'53',WV:'54',
  WI:'55',WY:'56',DC:'11'
};
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

const STATE_REGIONS = {
  ME:'Northeast',NH:'Northeast',VT:'Northeast',MA:'Northeast',RI:'Northeast',
  CT:'Northeast',NY:'Northeast',NJ:'Northeast',PA:'Northeast',DE:'Northeast',
  MD:'Northeast',DC:'Northeast',
  VA:'South',WV:'South',KY:'South',TN:'South',NC:'South',SC:'South',
  GA:'South',FL:'South',AL:'South',MS:'South',AR:'South',LA:'South',
  TX:'South',OK:'South',
  OH:'Midwest',IN:'Midwest',IL:'Midwest',MI:'Midwest',WI:'Midwest',
  MN:'Midwest',IA:'Midwest',MO:'Midwest',ND:'Midwest',SD:'Midwest',
  NE:'Midwest',KS:'Midwest',
  MT:'West',ID:'West',WY:'West',CO:'West',NM:'West',AZ:'West',
  UT:'West',NV:'West',WA:'West',OR:'West',CA:'West',AK:'West',HI:'West'
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
let usDistLayers        = {};     // distPart ('01','02'…) → D3 path selection for district overlay
let eliminatedStates    = new Set(); // all states removed from valid set (wrong guess + adjacency)
let districtZoomBehavior    = null;   // saved d3.zoom instance for district tiles map
let districtUserZoomed      = false;  // true once user manually pans/zooms district map
let districtSavedTransform  = null;   // zoom transform preserved across rebuilds
let districtStateFitTransform = null; // full-state inner-point fit; used by fit-toggle second press
let _districtProjection    = null;   // AlbersUSA projection from most recent district ctx build
let _districtCssScale      = 1;      // cssScale from most recent district ctx build
let _districtPathGen       = null;   // d3.geoPath from most recent district ctx build
let _districtStateFeatures = null;   // all features for the current state
let _districtW             = REF_VB_W; // viewBox width from most recent district ctx build
let _districtH             = REF_VB_H; // viewBox height from most recent district ctx build
let _usRefW                = REF_VB_W; // viewBox width of the US reference map SVG
let _usRefH                = REF_VB_H; // viewBox height of the US reference map SVG
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
let gamePhase            = 'state';  // 'state' | 'district' | 'gameover'
let _districtBuiltState  = null;     // stateAbbr currently rendered in the tiles SVG
let _districtSvgSel      = null;     // D3 selection of the tiles SVG (cached for zoom reuse)
let _districtPathSnap    = null;     // pathGen cached from last build (for reveal zoom)
let _districtStateFSnap  = null;     // stateFeatures cached from last build (for reveal zoom)
let _gameOverTime        = 0;        // Date.now() when endGame() was called (confetti gate)
let _gameOverAnimsCallback  = null;   // deferred: pulse/shake/confetti, fired after reveal circle collapses
let _goZoom         = null;   // gameover map zoom behavior
let _goZoomInitial  = null;   // gameover map initial fit transform
let _tileZoomInAnimating    = false;  // true during 700ms entry zoom-in so handler skips simulation re-runs
let db                  = null;   // Firestore instance (if configured)
let username            = '';
let replayCount         = 0;      // increments each "Play Again" to pick a fresh district
let isArchiveGame       = false;  // true while playing a past puzzle from the archive — unofficial, not saved or counted

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
  const label = document.getElementById('gameover-next-countdown');
  const sub   = document.querySelector('#gameover-next .gameover-next-sub');
  if (!label) return;
  const tick = () => {
    const s = secondsUntilEasternMidnight();
    if (s <= 0) {
      if (sub) sub.innerHTML = 'A new district is ready &middot; <a href="#" id="gameover-reload-link">refresh to play</a>';
      document.getElementById('gameover-reload-link')?.addEventListener('click', (e) => { e.preventDefault(); location.reload(); });
      stopNextDistrictCountdown();
      return;
    }
    const hh = String(Math.floor(s / 3600)).padStart(2, '0');
    const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    label.textContent = `${hh}:${mm}:${ss}`;
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
      fetch('./states.topojson').then(r => { if (!r.ok) throw new Error(`states ${r.status}`); return r.json(); }),
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
async function loadServerStateShapes(state) {
  if (districts.some(f => f.properties.state === state)) return;
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
  }
}

// ============================================================
//  SERVER-BACKED ARCHIVE (replay a past puzzle, unofficial)
// ============================================================
// Reveal clues the same way the server does (phase-local), but client-side for the
// archive replay (no /guess round-trip — we have the answer). Mirrors revealClues()
// in the `guess`/`today` edge functions; keep them in sync.
// Mirror of revealClues() in the today/guess edge functions: a fixed 6-slot hint
// bar. One reveal per guess — state clues while the state is unsolved, district
// clues once it's solved. Total is always MAX_GUESSES. Returns { unlocked, total }.
function clientRevealClues(clues, history, completed) {
  const cl = clues || {};
  const stateDeck    = Array.isArray(cl) ? cl : (Array.isArray(cl.state) ? cl.state : []);
  const districtDeck = Array.isArray(cl) ? [] : (Array.isArray(cl.district) ? cl.district : []);
  const stateSolved  = history.some(g => g.phase === 'state' && g.correct);
  const wrongState   = history.filter(g => g.phase === 'state' && !g.correct).length;

  const nReveal = completed ? MAX_GUESSES : Math.min(history.length, MAX_GUESSES);

  let unlocked;
  if (!stateSolved) {
    unlocked = stateDeck.slice(0, Math.min(nReveal, stateDeck.length));
  } else {
    const nState = Math.min(wrongState, stateDeck.length);
    const nDistrict = Math.max(0, Math.min(nReveal - nState, districtDeck.length));
    unlocked = [...stateDeck.slice(0, nState), ...districtDeck.slice(0, nDistrict)];
  }
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
  const { unlocked, total: cluesTotal } = clientRevealClues(serverArchive.clues, hist, completed);
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

// Launch a server-backed archive replay for a past date. Fetches the puzzle, sets up
// the board the same way as the daily, but with local validation (isArchiveGame).
async function startServerArchive(date, num, label) {
  let data;
  try { data = await window.DistrictBackend.archivePuzzle(date); }
  catch (err) { console.error('archive load failed:', err); alert('Could not load that archive puzzle.'); return; }

  // Reset to a fresh, unofficial archive session.
  isArchiveGame      = true;
  serverArchive      = { date, puzzleNumber: data.puzzleNumber, answer: { districtId: data.districtId, state: data.state, census: data.census }, clues: data.clues || {} };
  serverPuzzle       = { clues: [], cluesTotal: MAX_GUESSES };
  serverAnswer       = serverArchive.answer;   // drives the game-over census panel
  serverState        = null;
  guessHistory       = [];
  guessCount         = 0;
  elapsedSeconds     = 0;
  gameOver           = false;
  correctStateGuessed = false;
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
    initUSRefMap();
    zoomUSRefMapToValid(false);
    if (map) map.invalidateSize();
  }));

  renderDistrict(todayDistrict);
  renderClues();
  renderGuessHistory();
  document.getElementById('guess-remaining').textContent = `${MAX_GUESSES} guesses`;
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

function parseDistrict(raw) {
  const t = raw.trim().toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/([A-Z]{2})-?0+$/, '$1-AT-LARGE'); // XX-0 → AT-LARGE
  return t;
}

function normalizeGuess(raw) {
  let t = raw.trim().toUpperCase().replace(/\s+/g, '-');
  // Insert dash if missing: NY14 → NY-14
  t = t.replace(/^([A-Z]{2})(\d+)$/, '$1-$2');
  // Normalize at-large variants
  if (/^([A-Z]{2})-(0+|AL|AT-?LARGE|ATLARGE)$/.test(t)) {
    t = t.replace(/^([A-Z]{2})-.*$/, '$1-AT-LARGE');
  }
  // Zero-pad single digit district numbers: NY-3 → NY-03 … but the data uses NY-03
  t = t.replace(/^([A-Z]{2})-(\d)$/, '$1-0$2');
  return t;
}

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

// ============================================================
//  INNER-POINT ZOOM (single source of truth for all map zooms)
// ============================================================

// Compute SVG bbox from projected inner points of the given district keys.
// tileR adds a radius pad so tiles aren't clipped at the edge.
function innerPointBBox(projection, activeKeys, tileR = 0) {
  if (!projection || !activeKeys?.size) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const key of activeKeys) {
    const refPt = POINT_OVERRIDES[key] || districtPoints[key];
    if (!refPt) continue;
    const proj = projection(refPt);
    if (!proj || !isFinite(proj[0])) continue;
    const [px, py] = proj;
    x0 = Math.min(x0, px - tileR); x1 = Math.max(x1, px + tileR);
    y0 = Math.min(y0, py - tileR); y1 = Math.max(y1, py + tileR);
  }
  return isFinite(x0) ? [[x0, y0], [x1, y1]] : null;
}

// Fit using geographic bounds for zoom level, inner-point centroid for center.
// For portrait states (CA, WA) in a landscape viewBox this prevents tiles from
// appearing bunched to one side while still respecting the full state extent.
function zoomToGeoBBoxCenteredOnPoints(geoBBox, innerBBox, W, H, { margin = DISTRICT_FIT_MARGIN } = {}) {
  if (!geoBBox || !innerBBox) return null;
  const [[gx0, gy0], [gx1, gy1]] = geoBBox;
  const [[ix0, iy0], [ix1, iy1]] = innerBBox;
  const bw = gx1 - gx0, bh = gy1 - gy0;
  if (!(bw > 0) || !(bh > 0)) return null;
  const k = margin / Math.max(bw / W, bh / H);
  const cx = (ix0 + ix1) / 2, cy = (iy0 + iy1) / 2;
  return d3.zoomIdentity.translate(W / 2 - k * cx, H / 2 - k * cy).scale(k);
}

// Zoom svgSel to fit activeKeys using their inner points.
// Returns the computed ZoomTransform (or null if no points found).
function fitToActiveKeys(svgSel, zoomBehavior, projection, W, H, activeKeys, {
  animated = true, margin = 0.85, tileR = 0, duration = 500
} = {}) {
  const bbox = innerPointBBox(projection, activeKeys, tileR);
  if (!bbox) return null;
  const t = zoomToBBox(bbox, W, H, { margin });
  if (svgSel && zoomBehavior) {
    if (animated) {
      svgSel.transition().duration(duration).ease(d3.easeCubicInOut)
        .call(zoomBehavior.transform, t);
    } else {
      svgSel.call(zoomBehavior.transform, t);
    }
  }
  return t;
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
        <span id="gameover-ribbon-text" class="gameover-ribbon-text"></span>
        <div class="banner-actions">
          <button id="gameover-result-btn">View Result</button>
          <button id="gameover-new-map-btn">Play Archive</button>
        </div>
      </div>
      <div class="gameover-card">
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
        <div id="gameover-next" class="gameover-next">
          <div class="gameover-next-main">
            <span class="gameover-next-title">That's today's district!</span>
            <span class="gameover-next-sub">New district in <strong id="gameover-next-countdown">--:--:--</strong> &middot; midnight ET</span>
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
            <button class="mzb mzb-go mzb-go-fit" data-dir="fit" aria-label="Fit to district" title="Fit to district"><svg class="mzb-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" width="14" height="14"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg></button>
          </div>
        </div>
      </div>
      <!-- District Profile — open-by-default bottom sheet with a blurred backdrop.
           Dismiss by swiping the sheet down or tapping the chevron; reopen via the pill. -->
      <div id="gameover-census" class="gameover-census open" role="dialog" aria-label="District Profile">
        <section class="gameover-census-sheet">
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
function wireGameoverCensus() {
  const wrap = document.getElementById('gameover-census');
  if (!wrap) return;
  const sheet = wrap.querySelector('.gameover-census-sheet');
  const open  = () => wrap.classList.add('open');
  const close = () => wrap.classList.remove('open');

  wrap.querySelector('.gameover-census-close')?.addEventListener('click', close);
  wrap.querySelector('.gameover-census-reopen')?.addEventListener('click', open);

  // Swipe the sheet down (from its top grip handle) to dismiss.
  let startY = null, dy = 0;
  const onDown = (e) => {
    startY = e.clientY; dy = 0;
    if (sheet) sheet.style.transition = 'none';
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e) => {
    if (startY == null || !sheet) return;
    dy = Math.max(0, e.clientY - startY);
    sheet.style.transform = `translateY(${dy}px)`;
  };
  const onUp = () => {
    if (startY == null) return;
    if (sheet) { sheet.style.transition = ''; sheet.style.transform = ''; }
    if (dy > 90) close();
    startY = null; dy = 0;
  };
  // Drag only from the grip handle — attaching to the titlebar would let
  // setPointerCapture swallow the close button's click.
  const z = wrap.querySelector('.gameover-census-handle');
  if (z) {
    z.addEventListener('pointerdown', onDown);
    z.addEventListener('pointermove', onMove);
    z.addEventListener('pointerup', onUp);
    z.addEventListener('pointercancel', onUp);
  }
}

function destroyGameoverDiv() {
  _goZoom = null;
  _goZoomInitial = null;
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

// kept for backward compat call sites
function renderGuessesSummary() { renderTabHeader('guesses-header'); }

// Wordle-style personal stats grid (played, win%, streaks, distribution)
function renderInlinePersonalStats() {
  const el = document.getElementById('result-personal-stats');
  if (!el) return;
  const stats = loadPersonalStats();
  if (!stats || stats.played === 0) { el.innerHTML = ''; return; }

  const winRate = Math.round(stats.won / stats.played * 100);
  const dist    = stats.guessDist || {};
  const wonToday = guessHistory.some(g => g.correct && g.phase === 'district');
  const hiKey = gameOver ? (wonToday ? guessCount : 'X') : null;

  const avgSecs  = stats.won > 0 ? Math.round((stats.totalWonTime || 0) / stats.won) : null;
  const avgLabel = avgSecs !== null ? formatTime(avgSecs) : '—';
  const totalWonGuesses = [1,2,3,4,5,6].reduce((s, k) => s + k * (dist[k] || 0), 0);
  const totalWonCount   = [1,2,3,4,5,6].reduce((s, k) => s + (dist[k] || 0), 0);
  const avgGuesses = totalWonCount > 0 ? (totalWonGuesses / totalWonCount).toFixed(1) : '—';

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
    </div>
    <div class="rstat-avg-time">Avg. guesses (wins): <strong>${avgGuesses}</strong> &nbsp;&middot;&nbsp; Avg. time: <strong>${avgLabel}</strong></div>`;
}

// Helper: switch the result modal between "result" and "census" tabs
function switchResultTab(tab) {
  document.querySelectorAll('.result-tab-pane').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.result-tab-btn').forEach(b => b.classList.remove('active'));
  const paneId = { result: 'result-section', guesses: 'guesses-section', alltime: 'alltime-section', mystats: 'mystats-section' }[tab] || 'result-section';
  const pane = document.getElementById(paneId);
  const btn  = document.querySelector(`.result-tab-btn[data-rtab="${tab}"]`);
  if (pane) pane.classList.add('active');
  if (btn)  btn.classList.add('active');
  if (tab === 'guesses' && gameOver) {
    renderTabHeader('guesses-header');
    renderGuessHistory();
  }
  if (tab === 'alltime' || tab === 'mystats') loadLeaderboardPanels();
}

// ── District Profile mini-graphics ─────────────────────────────────────────
// Each metric's min/max across all 435 districts + a label formatter. The bar puts
// the tick at the VALUE's linear position within [min, max], so it lines up with the
// labeled axis (a value 2/3 of the way from min to max sits 2/3 across the track).
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
};
// Thin track with a tick at the value's position within the metric's full range,
// min/max labels, and (if a percentile rank is supplied) a plain-words rank line —
// e.g. "Higher than 97% of districts". `pctl` is census.pct[key] (0..1).
function pctBar(value, key, pctl) {
  const m = key && METRICS[key];
  if (value == null || isNaN(value) || !m) return '';
  const pos = Math.max(0, Math.min(1, (value - m.r[0]) / (m.r[1] - m.r[0])));
  const x = Math.max(2, Math.min(98, pos * 100));
  const bar = `<svg class="mini-pct" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">`
            + `<line class="mp-track" x1="1.5" y1="5" x2="98.5" y2="5"/>`
            + `<rect class="mp-tick" x="${(x - 0.9).toFixed(1)}" y="0.5" width="1.8" height="9" rx="0.9"/></svg>`;
  let rank = '';
  if (pctl != null && !isNaN(pctl)) {
    rank = pctl >= 0.5
      ? `<div class="mp-rank">Higher than ${Math.round(pctl * 100)}% of districts</div>`
      : `<div class="mp-rank">Lower than ${Math.round((1 - pctl) * 100)}% of districts</div>`;
  }
  return `<div class="mp-wrap">${bar}<div class="mp-ends"><span>${m.f(m.r[0])}</span><span>${m.f(m.r[1])}</span></div>${rank}</div>`;
}
// Party emblem: donkey (D), elephant (R), star (Independent/other). Filled silhouettes.
function partyIcon(code, big) {
  const P = {
    D: 'M3.6 13.1c0-.66.54-1.2 1.2-1.2h.42l-.74-4.6c-.09-.55.64-.83.95-.36l1.5 2.3.6-3.1c.1-.55.86-.55.96 0l.6 3.1 1.5-2.3c.3-.47 1.04-.19.95.36l-.74 4.6H17c1.93 0 3.5 1.57 3.5 3.5v2.6c0 .55-.45 1-1 1s-1-.45-1-1v-2h-1.1v2c0 .55-.45 1-1 1s-1-.45-1-1v-2H9v2c0 .55-.45 1-1 1s-1-.45-1-1v-2H5.6v2c0 .55-.45 1-1 1s-1-.45-1-1z',
    R: 'M2.5 12.6c0-.66.53-1.2 1.2-1.2.3-3.3 3.2-5.8 6.9-5.8 3.9 0 7 2.8 7 6.3v3.3c0 .55-.45 1-1 1s-1-.45-1-1v-2.3c-.5.2-1 .33-1.55.42v1.88c0 .55-.45 1-1 1s-1-.45-1-1v-1.72h-2v1.72c0 .55-.45 1-1 1s-1-.45-1-1v-2.05c-1-.3-1.87-.86-2.5-1.62-.22.36-.62.6-1.08.6-.7 0-1.27-.55-1.27-1.22zm2.5-.9c.13-2.6 2.4-4.5 5.2-4.5.62 0 1.2.1 1.74.27-.85-.55-1.9-.87-3.04-.87-2.6 0-4.7 1.7-4.95 3.9.32-.06.65-.06 1.05.05z',
    I: 'M12 2.5l2.6 5.7 6.2.6-4.7 4.1 1.4 6.1L12 16l-5.5 3.1 1.4-6.1-4.7-4.1 6.2-.6z',
  };
  const c = P[code] ? code : 'I';
  return `<svg class="party-icon party-${c}${big ? ' party-lg' : ''}" viewBox="0 0 24 24" aria-hidden="true"><path d="${P[c]}"/></svg>`;
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
  // Mini-graphic inputs: district/state shapes, stacked bars.
  const compactSvg = compactnessSvg(todayDistrict);
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
  const raceHeadline = total > 0 ? `${raceTop.pct}% ${raceTop.name}${raceTop.pct >= 50 ? ' majority' : ' plurality'}` : '—';
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
  const partyEmblem = rep ? partyIcon(rep.partyCode, true) : '';
  // Polsby-Popper caption for the compactness shape (named + explained on hover).
  const ppCaption = ppScore == null ? '' :
    `<div class="ms-caption" title="Polsby–Popper compactness = 4π × area ÷ perimeter². 1.0 = a perfect circle; lower = a more contorted shape.">Polsby–Popper ${ppScore.toFixed(2)} · ${ppLabel}</div>`;

  censusDataEl.innerHTML = `
    <div class="census-grid">
      <div class="census-card census-shape-card census-rep">
        <div class="label">Current Representative</div>
        <div class="value">${repName}</div>
        <div class="sub">${rep ? rep.party : 'Vacant'}</div>
        ${partyEmblem}
      </div>
      <div class="census-card">
        <div class="label">2024 Presidential Vote</div>
        <div class="value">${voteValue}</div>
        <div class="sub">${voteSub}</div>
        ${voteStack}
      </div>
      <div class="census-card">
        <div class="label">Racial / Ethnic Composition</div>
        <div class="value">${raceHeadline}</div>
        ${raceStack}${raceLegend}
      </div>
      <div class="census-card census-shape-card">
        <div class="label">District Area</div>
        <div class="value">${areaMi2 > 0 ? areaMi2.toLocaleString() + ' sq mi' : '—'}</div>
        <div class="sub">${perimMi > 0 ? `${perimMi.toLocaleString()} mi perimeter` : '2026 district boundaries'}</div>
        ${compactSvg}${ppCaption}
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
        <div class="label">Speak Another Language</div>
        <div class="value">${pv(d.nonEnglishPct)}</div>
        <div class="sub">of residents 5+ speak a language other than English at home</div>
        ${pctBar(d.nonEnglishPct, 'nonEnglishPct', pct.nonEnglishPct)}
      </div>
      <div class="census-card">
        <div class="label">Population Change</div>
        <div class="value">${popChange != null ? (popChange >= 0 ? '+' : '−') + Math.abs(Math.round(popChange)) + '%' : '—'}</div>
        <div class="sub">${d.pop2020 ? `${formatNumber(d.pop2020)} → ${formatNumber(d.pop)} since 2020` : 'since the 2020 Census'}</div>
        ${pctBar(popChange, 'popChange', pct.popChange)}
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
        <div class="sub">of adults 25+</div>
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
}

// ============================================================
//  FIREBASE / LEADERBOARD
// ============================================================
let _firebaseReady = null; // Promise that resolves when Firebase is loaded and initialized

function loadFirebase() {
  if (_firebaseReady) return _firebaseReady;
  if (!FIREBASE_CONFIG) { _firebaseReady = Promise.resolve(); return _firebaseReady; }
  _firebaseReady = new Promise(resolve => {
    const s1 = document.createElement('script');
    s1.src = 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js';
    s1.onload = () => {
      const s2 = document.createElement('script');
      s2.src = 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js';
      s2.onload = () => {
        try {
          firebase.initializeApp(FIREBASE_CONFIG);
          db = firebase.firestore();
        } catch (e) { console.warn('Firebase init failed:', e); }
        resolve();
      };
      s2.onerror = resolve; // non-fatal
      document.head.appendChild(s2);
    };
    s1.onerror = resolve; // non-fatal
    document.head.appendChild(s1);
  });
  return _firebaseReady;
}

async function submitScore(won, guesses, seconds) {
  await loadFirebase();
  if (!db) return;
  try {
    await db.collection('scores').add({
      date: todayKey,
      username,
      guesses: won ? guesses : MAX_GUESSES + 1,
      time: seconds,
      won,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (e) {
    console.warn('Score submit failed:', e);
  }
}

async function loadTodayScores() {
  await loadFirebase();
  if (!db) return null;
  try {
    const snap = await db.collection('scores')
      .where('date', '==', todayKey)
      .orderBy('won', 'desc')
      .orderBy('guesses', 'asc')
      .orderBy('time', 'asc')
      .limit(50)
      .get();
    return snap.docs.map(d => d.data());
  } catch { return null; }
}

async function loadAlltimeScores() {
  await loadFirebase();
  if (!db) return null;
  try {
    // Fetch recent 500 scores and aggregate client-side
    const snap = await db.collection('scores')
      .where('won', '==', true)
      .orderBy('timestamp', 'desc')
      .limit(500)
      .get();
    const rows = snap.docs.map(d => d.data());

    // Aggregate by username
    const agg = {};
    for (const r of rows) {
      if (!agg[r.username]) agg[r.username] = { username: r.username, games: 0, wins: 0, totalGuesses: 0, totalTime: 0 };
      agg[r.username].games++;
      agg[r.username].wins++;
      agg[r.username].totalGuesses += r.guesses;
      agg[r.username].totalTime    += r.time;
    }
    return Object.values(agg)
      .map(a => ({ ...a, avgGuesses: a.totalGuesses / a.wins, avgTime: a.totalTime / a.wins }))
      .sort((a, b) => a.avgGuesses - b.avgGuesses || a.avgTime - b.avgTime)
      .slice(0, 30);
  } catch { return null; }
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
  // holds the unlocked-so-far set, `cluesTotal` the full count (rest are locked).
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
    if (a === abbr) co.circle.attr('stroke', PENDING).attr('stroke-width', 2.5).raise();
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
      // Remove the full-viewport flash overlay in a finally so an error in
      // endGame()/showGameoverModal() can never leave the screen locked on the
      // gold/red reveal. The fill holds full-screen while `ready` resolves.
      try {
        if (ready) { try { await ready; } catch (_) {} }
        endGame(won, { skipAnims: true });
        showGameoverModal();
        if (_gameOverAnimsCallback) {
          _gameOverAnimsCallback();
          _gameOverAnimsCallback = null;
        }
      } catch (e) {
        console.error('game-over reveal error:', e);
        reportClientError('gameover_reveal', e);
      } finally {
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

// Stamp the guess-history check icon (checkCircle) on a correctly-guessed state, sized to
// fit inside the state's bbox with padding and centred on its centroid. Shown briefly
// before the zoom into the district phase.
function _showStateCheck(abbr) {
  _hideStateCheck();
  if (!usRefMapGroup || !usRefPathGen || !usRefProjection) return;
  const feat = topoStates[abbr];
  if (!feat) return;
  const b = usRefPathGen.bounds(feat);
  const c = usRefProjection(d3.geoCentroid(feat));
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

function initUSRefMap() {
  if (usRefMap) return;
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
          const atActiveFit = btn.classList.contains('at-active-fit');
          if (atActiveFit && _usRefFullFitTransform) {
            // Second press: zoom out to full-US (all 435 inner points)
            usRefSvgSel?.transition().duration(500).ease(d3.easeCubicInOut)
              .call(usRefZoom.transform, _usRefFullFitTransform);
            btn.classList.remove('at-active-fit');
          } else {
            // First press: zoom to remaining valid states (inner points)
            zoomUSRefMapToValid(true);
            btn.classList.add('at-active-fit');
          }
          return;
        }
        const tilesSvg = usRefSvgSel;   // single map: district zoom is the shared zoom
        if (!tilesSvg || tilesSvg.empty() || !districtZoomBehavior || !_districtProjection) return;
        if (!gameOver) {
          const W = _districtW, H = _districtH;
          const atActiveFit = btn.classList.contains('at-active-fit');
          if (atActiveFit && districtStateFitTransform) {
            // Second press: zoom out to full state geographic bbox
            districtUserZoomed = false;
            districtSavedTransform = districtStateFitTransform;
            tilesSvg.transition().duration(500).ease(d3.easeCubicInOut)
              .call(districtZoomBehavior.transform, districtStateFitTransform);
            btn.classList.remove('at-active-fit');
          } else {
            // First press: zoom to the remaining eligible TILES (dist-icon positions).
            districtUserZoomed = false;
            const activeBBox = _districtTileBBox(getActiveDistrictKeys());
            let t = activeBBox ? zoomToBBox(activeBBox, W, H, { margin: DISTRICT_FIT_MARGIN }) : districtStateFitTransform;
            if (t) {
              tilesSvg.transition().duration(500).ease(d3.easeCubicInOut)
                .call(districtZoomBehavior.transform, t);
              districtSavedTransform = t;
            }
            btn.classList.add('at-active-fit');
          }
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
  (function renderRefMap() {
    const stateFeatures = Object.values(topoStates).filter(Boolean);
    const geojson = { type: 'FeatureCollection', features: stateFeatures };
    projection.fitSize([W, H], geojson);
    usRefPathGen = pathGen; // save for district overlay

    // Single group for ALL content so zoom transforms everything
    const g = svgSel.append('g');
    usRefMapGroup = g.node();

    // Static inactive backdrop: every state painted the eliminated/inactive grey, drawn once
    // and never interactive. The live state layer sits on top; out-of-play states fade to
    // transparent to reveal this (a true dim) instead of being recoloured.
    const layerBasemap = g.append('g').attr('class', 'layer-basemap').style('pointer-events', 'none');
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

    // State content (clickable state fills + the white border mesh) lives in its own
    // layer so the whole state map can be shown/hidden as one unit when toggling between
    // the state-pick and district phases (unified-map migration).
    const layerStates = g.append('g').attr('class', 'layer-states');

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

    // White internal borders
    if (rawTopo && rawTopo.objects.states) {
      layerStates.append('path')
        .datum(topojson.mesh(rawTopo, rawTopo.objects.states, (a, b) => a !== b))
        .attr('d', pathGen)
        .attr('fill', 'none')
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 1)
        .attr('vector-effect', 'non-scaling-stroke')
        .attr('pointer-events', 'none');

      // Outer US boundary
      layerStates.append('path')
        .datum(topojson.mesh(rawTopo, rawTopo.objects.states, (a, b) => a === b))
        .attr('d', pathGen)
        .attr('fill', 'none')
        .attr('stroke', '#adb5bd')
        .attr('stroke-width', 0.75)
        .attr('vector-effect', 'non-scaling-stroke')
        .attr('pointer-events', 'none');
    }

    // Single-SVG layer skeleton (unified-map migration, Stage 1). District + game-over
    // content will be appended into these groups so the whole game lives in ONE zooming
    // SVG. Created above the state fills/border and below the callouts so z-order is
    // states → district context → district polys → tiles → answer → callouts.
    g.append('g').attr('class', 'layer-context');    // counties/roads/urban (district+gameover)
    g.append('g').attr('class', 'layer-districts');  // guessed-state district polygons + border
    g.append('g').attr('class', 'layer-tiles');      // force-sim circles (district phase)
    g.append('g').attr('class', 'layer-answer');     // answer highlight + leader badge (gameover)

    // Callouts for small states — build abbr-keyed lookup from our state features
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

    // Re-zoom once the container has real CSS dimensions (fixes mobile timing issue
    // where getBBox() fires before layout settles, leaving the map too zoomed out)
    const refEl = document.getElementById('us-ref-map');
    if (refEl && window.ResizeObserver) {
      let fired = false;
      const ro = new ResizeObserver(() => {
        if (refEl.offsetWidth > 0 && refEl.offsetHeight > 0 && !fired) {
          fired = true;
          ro.disconnect();
          zoomUSRefMapToValid(false);
        }
      });
      ro.observe(refEl);
    }
  })();
}

// Zoom the US ref map to fit the inner points of currently-active districts.
// Pass animated=false for instant placement (e.g., on restore).
function zoomUSRefMapToValid(animated = true) {
  // A map zoom/rebuild can strand a hover tooltip "visible" (no mouseout fires) — clear it.
  document.getElementById('us-ref-tooltip')?.classList.remove('visible');
  if (!usRefSvgSel || !usRefZoom || !usRefProjection) return;
  const W = _usRefW, H = _usRefH;

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
    const t = tileBox ? zoomToBBox(tileBox, W, H, { margin: DISTRICT_FIT_MARGIN }) : stateFit;
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

  // Hide state chips
  document.getElementById('state-chips-section').classList.add('hidden');

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
// Split into four focused functions:
//   buildDistrictD3Map   — thin coordinator: clears container, builds context, routes
//   _buildDistrictCtx    — creates SVG, projection, zoom behavior; returns shared context
//   _applyDistrictZoom   — picks and applies the correct initial transform
//   _drawGameOverMap     — game-over render (answer highlight, badge, spark, context layers)
//   _drawGameplayTiles   — gameplay render (clickable circles + force simulation)

// Counter-scale the district tiles / connectors / game-over badge / context layers so
// circles stay a constant SCREEN size as the (shared) map zooms. Extracted from the
// per-build zoom closure so the unified usRefZoom handler can call it too once the
// district content lives in the ref map's SVG. `g` = the district render group, `k` =
// the current zoom scale. Reads module render constants (cssScale=1, target=14px, W).
function _applyTileZoomScaling(g, k) {
  const targetCirclePx = 14, densityScale = 1, cssScale = _districtCssScale || 1, W = _districtW;
  const rk = targetCirclePx / (k * cssScale);

  // Gameplay circles: radius, stroke, text
  g.select('.dist-icons').selectAll('circle')
    .attr('r', rk)
    .attr('stroke-width', 1.5 / k);
  g.select('.dist-icons').selectAll('text').each(function() {
    if (this.parentNode && this.parentNode.querySelector('rect')) return; // skip badge text
    const baseSize = Math.min(this.textContent.length > 2 ? 8 : 9, targetCirclePx);
    d3.select(this).attr('font-size', `${baseSize / (k * cssScale)}px`);
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

  // Density-aware circle sizing: dense states (TX, CA) get smaller circles.
  const densityScale   = 1; // reserved; circles are always the same screen size
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
  const hotKeys  = hotGuessKeys;
  const coldKeys = new Set(
    stateFeatures.map(f => f.properties['state-district'])
      .filter(k => !possibleKeys.has(k))
      .map(k => k.split('-').slice(1).join('-'))
      .filter(d => !hotGuessKeys.has(d))
  );

  const wonDist     = guessHistory.find(g => g.phase === 'district' && g.correct);
  const wonDistPart = wonDist ? wonDist.text.split('-').slice(1).join('-') : null;
  const isAtLarge   = stateFeatures.length === 1;

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
  _districtStateFeatures = stateFeatures;
  const pathGen     = d3.geoPath().projection(projection);
  _districtPathGen       = pathGen;
  // Fit to the STATE outline (single non-secret shape), not the district polygons.
  const stateOutline = topoStates[stateAbbr];
  const stateBBox   = stateOutline ? pathGen.bounds(stateOutline) : pathGen.bounds(stateFC);
  const stateFitTransform = zoomToBBox(stateBBox, W, H, { margin: DISTRICT_FIT_MARGIN, maxScale: W / 12 });

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
  const activeFit = zoomToBBox(tileBBox(possibleKeys), W, H, { margin: DISTRICT_FIT_MARGIN });
  districtSavedTransform = activeFit;
  const dur = 500 * (typeof ANIM_SLOW !== 'undefined' ? ANIM_SLOW : 1);
  usRefSvgSel.transition().duration(dur).ease(d3.easeCubicInOut).call(usRefZoom.transform, activeFit);
}

// Renders the game-over view: national context, district boundary lines, answer highlight,
// leader-line badge, and deferred spark/confetti animations.
function _drawGameOverMap(ctx, animateReveal) {
  const { svg, g, pathGen, projection, cssScale, W, H, dark, tilesEl, stateAbbr,
          stateFeatures, stateFC, wonDist, wonDistPart, isAtLarge, answerKey } = ctx;

  const answerLabel = isAtLarge ? stateAbbr : answerKey;

  // ── National context layers ───────────────────────────────────────────────
  if (rawTopo) {
    const allStateFills = Object.values(topoStates).filter(f => f.properties?.state !== stateAbbr);

    g.append('g').attr('class', 'context-state-fills').attr('pointer-events', 'none')
      .selectAll('path').data(allStateFills).join('path').attr('d', pathGen)
      .attr('fill', dark ? 'rgba(255,255,255,0.06)' : 'rgba(100,100,120,0.12)')
      .attr('stroke', 'none');

    // Clip roads/urban to the US land boundary. Legacy mode merges the district
    // geometries; server mode ships a states-only topo, so fall back to merging
    // the states. (Previously this skipped the clipPath entirely in server mode,
    // but the layers still referenced url(#clip) → they were clipped to nothing
    // and roads/urban never appeared.)
    const clipId = 'gameover-us-land-clip';
    let landGeom = null;
    if (rawTopo.objects.districts)   landGeom = topojson.merge(rawTopo, rawTopo.objects.districts.geometries);
    else if (rawTopo.objects.states) landGeom = topojson.merge(rawTopo, rawTopo.objects.states.geometries);
    if (landGeom) {
      let defs = svg.select('defs');
      if (defs.empty()) defs = svg.insert('defs', ':first-child');
      defs.selectAll(`#${clipId}`).remove();
      defs.append('clipPath').attr('id', clipId)
        .append('path').datum(landGeom).attr('d', pathGen);
    }
    const clipRef = landGeom ? `url(#${clipId})` : null;

    if (topoUrban) {
      g.append('g').attr('class', 'context-urban')
        .attr('clip-path', clipRef).attr('opacity', 0).attr('pointer-events', 'none')
        .selectAll('path').data(topoUrban.features).join('path').attr('d', pathGen)
        .attr('fill', dark ? 'rgba(255,255,255,0.06)' : 'rgba(80,80,140,0.08)').attr('stroke', 'none');
    }
    if (topoRoads) {
      g.append('g').attr('class', 'context-roads')
        .attr('clip-path', clipRef).attr('opacity', 0).attr('pointer-events', 'none')
        .selectAll('path').data(topoRoads.features).join('path').attr('d', pathGen)
        .attr('fill', 'none')
        .attr('stroke', dark ? 'rgba(255,255,255,0.14)' : 'rgba(60,60,100,0.18)')
        .attr('stroke-width', 0.5).attr('vector-effect', 'non-scaling-stroke');
    }
    if (topoCounties) {
      g.append('g').attr('class', 'context-counties')
        .attr('clip-path', clipRef).attr('opacity', 0).attr('pointer-events', 'none')
        .selectAll('path').data(topoCounties.features).join('path').attr('d', pathGen)
        .attr('fill', 'none')
        .attr('stroke', dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.45)')
        .attr('stroke-width', 0.5).attr('stroke-dasharray', '2 3').attr('vector-effect', 'non-scaling-stroke');
    }

    // Sync context-layer opacity to current zoom (zoom handler fired before these existed)
    {
      const k0 = d3.zoomTransform(svg.node()).k || 1;
      const cOp = k0 > 3 ? Math.min(0.65, (k0 - 3) * 0.25) : 0;
      const fOp = k0 > 2 ? Math.min(1,    (k0 - 2) * 0.35) : 0;
      g.select('.context-counties').attr('opacity', cOp);
      g.select('.context-roads').attr('opacity', fOp);
      g.select('.context-urban').attr('opacity', fOp);
    }

    // National district-boundary mesh (legacy topo only; server mode has no
    // nationwide district geometry — the target state's own districts still
    // draw below from stateFeatures).
    if (rawTopo.objects.districts) {
      g.append('path')
        .datum(topojson.mesh(rawTopo, rawTopo.objects.districts,
          (a, b) => a !== b && a.properties?.state === b.properties?.state && a.properties?.state !== stateAbbr))
        .attr('class', 'context-district-lines').attr('d', pathGen)
        .attr('fill', 'none')
        .attr('stroke', dark ? 'rgba(255,255,255,0.22)' : 'rgba(60,60,90,0.50)')
        .attr('stroke-width', 0.5).attr('vector-effect', 'non-scaling-stroke').attr('pointer-events', 'none');
    }

    g.append('g').attr('class', 'context-state-borders').attr('pointer-events', 'none')
      .selectAll('path').data(allStateFills).join('path').attr('d', pathGen)
      .attr('fill', 'none')
      .attr('stroke', dark ? 'rgba(255,255,255,0.30)' : 'rgba(40,40,60,0.60)')
      .attr('stroke-width', 0.7).attr('vector-effect', 'non-scaling-stroke');
  }

  // ── Target-state district boundaries ─────────────────────────────────────
  stateFeatures.forEach(f => {
    g.append('path').datum(f)
      .attr('data-key', f.properties['state-district']).attr('d', pathGen)
      .attr('fill', 'none')
      .attr('stroke', dark ? 'rgba(255,255,255,0.35)' : 'rgba(60,60,80,0.25)')
      .attr('stroke-width', 0.8).attr('vector-effect', 'non-scaling-stroke').attr('pointer-events', 'none');
  });

  // ── Answer district highlight + spark + badge ─────────────────────────────
  const answerFeature = stateFeatures.find(f => f.properties['state-district'] === answerKey);
  if (answerFeature) {
    const won = !!wonDist;

    const answerPath = g.append('path').datum(answerFeature).attr('d', pathGen)
      .attr('fill',   dark ? 'rgba(196,18,48,0.55)' : 'rgba(196,18,48,0.30)')
      .attr('stroke', '#C41230').attr('stroke-width', 2)
      .attr('vector-effect', 'non-scaling-stroke').attr('pointer-events', 'none');

    // ── Leader line + pill badge ──────────────────────────────────────────
    const initK  = d3.zoomTransform(svg.node()).k || 1;
    const initR  = Math.max(1, 13 / initK);
    const [[dbx0, dby0], [dbx1, dby1]] = pathGen.bounds(answerFeature);
    const screenGap = 18 / (initK * cssScale);
    let bx = dbx1 + screenGap;
    let by = (dby0 + dby1) / 2;
    if (bx + initR > W - 4) bx = dbx0 - screenGap;
    bx = Math.max(initR + 4, Math.min(W - initR - 4, bx));
    by = Math.max(initR + 4, Math.min(H - initR - 4, by));

    g.append('line').attr('class', 'dist-leader')
      .attr('x1', dbx1).attr('y1', by).attr('x2', bx).attr('y2', by)
      .attr('stroke', dark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.4)')
      .attr('stroke-width', 1 / (initK * cssScale)).attr('pointer-events', 'none')
      .attr('data-dbx0', dbx0).attr('data-dbx1', dbx1)
      .attr('data-dby0', dby0).attr('data-dby1', dby1);

    const iconSize = 13 / (initK * cssScale), iconGap = 4 / (initK * cssScale);
    const pillH = 26 / (initK * cssScale);
    const pillW = (answerLabel.length * 7.5 + 22) / (initK * cssScale) + iconSize + iconGap;
    const badge = g.append('g').attr('class', 'dist-icons').attr('transform', `translate(${bx},${by})`);
    badge.append('rect')
      .attr('x', -pillW / 2).attr('y', -pillH / 2).attr('width', pillW).attr('height', pillH)
      .attr('rx', pillH / 2)
      .attr('fill', 'rgba(196,18,48,0.82)').attr('stroke', 'rgba(255,255,255,0.35)')
      .attr('stroke-width', 1 / (initK * cssScale));

    const iconX    = -pillW / 2 + 7 / (initK * cssScale) + iconSize / 2;
    const iconScale = iconSize / 24;
    const iconG = badge.append('g').attr('class', 'gc-icon-svg')
      .attr('transform', `translate(${iconX},0) scale(${iconScale}) translate(-12,-12)`)
      .attr('fill', 'none').attr('stroke', '#fff')
      .attr('stroke-width', 2).attr('stroke-linecap', 'round').attr('stroke-linejoin', 'round')
      .html(wonDist ? ICON_PATHS.checkCircle : ICON_PATHS.xCircle);
    iconG.selectAll('path, circle, line, polyline').attr('vector-effect', 'non-scaling-stroke');

    badge.append('text')
      .attr('x', iconSize / 2 + iconGap / 2)
      .attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
      .attr('font-size', `${12 / (initK * cssScale)}px`).attr('font-weight', '600')
      .attr('fill', '#fff').attr('letter-spacing', 0.3 / (initK * cssScale))
      .attr('pointer-events', 'none').text(answerLabel);
  }

  // ── State outline (topmost) ───────────────────────────────────────────────
  const stateOutline = topoStates[stateAbbr];
  if (stateOutline) {
    g.append('path').datum(stateOutline).attr('d', pathGen)
      .attr('fill', 'none').attr('stroke', dark ? '#aaa' : '#555')
      .attr('stroke-width', 2).attr('vector-effect', 'non-scaling-stroke').attr('pointer-events', 'none');
  }
  g.select('.dist-leader').raise();
  g.select('.dist-icons').raise();
  g.select('.spark-layer').raise();
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
  if (stateOutline && (topoUrban || topoRoads)) {
    const ctxClipId = `gameplay-context-clip-${stateAbbr}`;
    g.append('defs').append('clipPath').attr('id', ctxClipId)
      .append('path').attr('d', pathGen(stateOutline));
    if (topoUrban) {
      g.append('g').attr('class', 'context-urban').attr('pointer-events', 'none')
        .attr('clip-path', `url(#${ctxClipId})`).attr('opacity', 1)
        .selectAll('path').data(topoUrban.features).join('path').attr('d', pathGen)
        .attr('fill', dark ? 'rgba(255,255,255,0.07)' : 'rgba(80,80,140,0.12)').attr('stroke', 'none');
    }
    if (topoRoads) {
      g.append('g').attr('class', 'context-roads').attr('pointer-events', 'none')
        .attr('clip-path', `url(#${ctxClipId})`).attr('opacity', 1)
        .selectAll('path').data(topoRoads.features).join('path').attr('d', pathGen)
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
      .selectAll('path').data(topoCounties.features).join('path').attr('d', pathGen)
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

  // Build node data — only possible-answer districts get a tile
  const nodes = stateFeatures.filter(f => possibleKeys.has(f.properties['state-district'])).map(f => {
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
  const R     = targetCirclePx / (zoomK * cssScale);

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
  const iconEls = nodes.map(d => {
    const disabled  = d.isWrong || d.isCorrect;
    const fillColor = d.isCorrect ? '#2563EB'
                    : d.isCold   ? (dark ? '#333' : '#bbb')
                    : d.isHot    ? (dark ? '#6b3030' : '#d4908a')
                    : '#C41230';
    const textColor = (d.isCold && !dark) ? '#888' : (d.isHot && !dark) ? '#7a2020' : '#fff';
    const opacity   = d.isCold ? 0.18 : d.isHot ? 0.32 : 1;

    const grp = iconG.append('g')
      .attr('transform', `translate(${d.ox},${d.oy})`).attr('data-dist', d.dist)
      .attr('class', 'district-tile').style('cursor', disabled ? 'default' : 'pointer')
      .style('opacity', opacity);
    grp.append('circle').attr('r', R)
      .attr('fill', fillColor).attr('stroke', dark ? '#222' : '#fff').attr('stroke-width', 1.5 / zoomK);
    grp.append('text')
      .attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
      .attr('font-size', `${Math.min(d.label.length > 2 ? 8 : 9, targetCirclePx) / (zoomK * cssScale)}px`)
      .attr('font-weight', '700').attr('fill', textColor).attr('pointer-events', 'none')
      .text(d.label);
    if (!disabled) {
      grp.on('mouseover', function() { d3.select(this).select('circle').attr('fill', '#a01025'); })
         .on('mouseout',  function() { d3.select(this).select('circle').attr('fill', fillColor); })
         .on('click',     () => submitDistrictGuess(d.dist));
    }
    return grp.node();
  });

  // Force simulation — run synchronously so tiles are at their final positions on first paint
  const collide      = 16 / (zoomK * cssScale * densityScale);
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

  // Submit to Firebase. Anonymous outcomes are never submitted (no leaderboard entry);
  // telemetry still fires elsewhere. The District Profile is rendered by
  // showGameoverModal() (the game-over card owns it now).
  if (!isAnonymousPlayer) submitScore(won, guessCount, elapsedSeconds);
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
  if (answerF) {
    g.append('path').attr('class', 'go-answer-district').datum(answerF).attr('d', pathGen)
      .attr('fill', dark ? 'rgba(255,80,80,0.5)' : 'rgba(196,18,48,0.65)')
      .attr('stroke', '#C41230').attr('stroke-width', 2)
      .style('vector-effect', 'non-scaling-stroke');

    // Spark trace — fires after the flash overlay fades (~900ms)
    const sparkLayer = g.append('g').attr('class', 'go-spark-layer').attr('pointer-events', 'none');
    const svgNode = svg.node();
    setTimeout(() => {
      sparkLayer.raise(); // above state border layer
      const answerNode = container.querySelector('.go-answer-district');
      if (!answerNode) return;
      const len = answerNode.getTotalLength ? answerNode.getTotalLength() : 0;
      if (!(len > 0)) return;

      const wonGame = guessHistory.some(gh => gh.correct && gh.phase === 'district');
      const glow1 = wonGame ? '#FDB515' : '#ff6060';
      const glow2 = wonGame ? '#ffb020' : '#C41230';

      // Only celebrate on a fresh win. When the game-over map is rebuilt on a
      // page revisit (restored completed game), the welcome splash is up — firing
      // the full-screen confetti over it is slow and distracting, so skip it.
      const welcomeSplashUp = !document.getElementById('welcome-modal')?.classList.contains('hidden');
      if (wonGame && !welcomeSplashUp) {
        const svgRect = svgNode.getBoundingClientRect();
        const { k, x: tx, y: ty } = d3.zoomTransform(svgNode);
        const [dcx, dcy] = pathGen.centroid(answerF);
        const renderScale = svgRect.width > 0 ? Math.min(svgRect.width / W, svgRect.height / H) : 1;
        const xOff = (svgRect.width  - W * renderScale) / 2;
        const yOff = (svgRect.height - H * renderScale) / 2;
        const sx = svgRect.left + xOff + (tx + dcx * k) * renderScale;
        const sy = svgRect.top  + yOff + (ty + dcy * k) * renderScale;
        launchBoundaryConfetti([{ x: sx, y: sy }]);
      }

      function getK() { return d3.zoomTransform(svgNode).k || 1; }
      const spark = sparkLayer.append('circle')
        .attr('r', 4 / getK()).attr('pointer-events', 'none')
        .attr('fill', wonGame ? '#fffbe8' : '#fff')
        .style('filter', `drop-shadow(0 0 4px #fff) drop-shadow(0 0 10px ${glow1}) drop-shadow(0 0 16px ${glow2})`);
      const p0 = answerNode.getPointAtLength(0);
      spark.attr('cx', p0.x).attr('cy', p0.y);

      // Embers are plain bright circles — no per-element drop-shadow filter, which
      // forces an expensive GPU repaint every frame for each of the ~dozen embers
      // alive at once. The lead spark keeps its glow; embers are too small to need it.
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
        // Emit at most one ember every other frame (~30/s) instead of ~45% of frames.
        emberToggle = !emberToggle;
        if (emberToggle) emitEmber(pt.x, pt.y);
        if (elapsed < LAPS * LAP_MS) requestAnimationFrame(frame);
        else spark.transition().duration(300).attr('r', 0).style('opacity', 0).remove();
      })(t0);
    }, 300);
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
    ? zoomToBBox(pathGen.bounds(answerF), W, H, { margin: DISTRICT_FIT_MARGIN, maxScale: 40 })
    : d3.zoomIdentity;

  // ── Badge inside zoom group — pans/zooms with map, scale(1/k) keeps it constant size ─
  // Badge is anchored at district right-edge in data (projection) space.
  // TODO: position the go-badge-layer wholly WITHIN the gameover-map viewport, placed in
  // open space near the district boundary (not always to the right) — e.g. pick the side
  // with the most empty room between the district bbox and the map edges so the pill never
  // clips off-canvas. Right edge is fine only when that's where the open space is.
  let badgeLayer = null;
  let badgeDataX = 0, badgeDataY = 0;
  if (answerF) {
    const [[dbx0, dby0], [dbx1, dby1]] = pathGen.bounds(answerF);
    badgeDataX = dbx1;
    badgeDataY = (dby0 + dby1) / 2;

    // Badge local space: 1 unit = 1 screen pixel (scale(1/k) cancels zoom, /renderScale converts viewBox→screen)
    const svgBB = svg.node().getBoundingClientRect();
    const renderScale = svgBB.width > 0 ? Math.min(svgBB.width / W, svgBB.height / H) : 1;
    const pillPx = 30 / renderScale, pillWPx = (answerKey.length * 8 + 28) / renderScale, gapPx = 10 / renderScale;
    const fontPx = 13 / renderScale;

    badgeLayer = g.append('g').attr('class', 'go-badge-layer');
    // rect/text live in local space where 1 unit = 1 screen px (achieved via scale(1/k))
    badgeLayer.append('rect')
      .attr('x', gapPx).attr('y', -pillPx / 2).attr('width', pillWPx).attr('height', pillPx)
      .attr('rx', pillPx / 2)
      .attr('fill', 'rgba(196,18,48,0.92)').attr('stroke', '#fff')
      .attr('stroke-width', 2).style('vector-effect', 'non-scaling-stroke')
      .style('filter', 'drop-shadow(0 1px 3px rgba(0,0,0,0.4))');
    badgeLayer.append('text')
      .attr('x', gapPx + pillWPx / 2).attr('y', 0)
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
    if (ribbonEl) ribbonEl.textContent = won ? `You got it! ${answerKey}.` : `The answer was ${answerKey}.`;

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

  // "New district at midnight ET" ribbon + countdown. Anonymous players also get a
  // sign-in nudge (track stats / compare); signed-in players just see the countdown.
  const nextCta = document.getElementById('gameover-next-cta');
  if (nextCta) nextCta.classList.toggle('hidden', !isAnonymousPlayer);
  document.getElementById('gameover-next-signin')?.addEventListener('click', () => {
    document.getElementById('login-modal')?.classList.remove('hidden');
  });
  try { startNextDistrictCountdown(); } catch (e) { reportClientError('gameover_countdown', e); }

  const mapWrap = document.getElementById('gameover-map-wrap');

  requestAnimationFrame(() => {
    try { buildGameoverMap(); } catch (e) { reportClientError('gameover_map', e); }
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
  const grid = [...usedSlots, ...Array(won ? MAX_GUESSES - guessCount : 0).fill('□')].join('  ');

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
  const W = Math.max(container.offsetWidth  || 440, 100);
  const H = Math.max(container.offsetHeight || 180, 100);
  const dark = isDarkMode();
  const projection = _previewProjection(W, H, pad);
  const pathGen = d3.geoPath(projection);

  // Bounding box of district for filtering roads/urban to visible area
  const [[bx0, by0], [bx1, by1]] = d3.geoBounds(todayDistrict);
  const mg = 0.1;
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

// Burst confetti outward from a set of screen-coordinate {x,y} origin points.
function launchBoundaryConfetti(origins) {
  const isMobile = navigator.maxTouchPoints > 0;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;will-change:transform;transform:translateZ(0)';
  document.body.appendChild(canvas);
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d');
  const COLORS = ['#C41230','#ffffff','#ffb020','#ff7700','#fffbe8','#FDB515'];
  const perOrigin = isMobile ? 40 : 80;
  const particles = [];
  for (const o of origins) {
    const count = perOrigin + Math.floor(Math.random() * (isMobile ? 10 : 20));
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 4 + Math.random() * 10;
      particles.push({
        x: o.x, y: o.y,
        w: 5 + Math.random() * 6, h: 2.5 + Math.random() * 3.5,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 4,
        angle: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.25,
      });
    }
  }
  // Sort by color so fillStyle switches are minimised across the draw loop.
  particles.sort((a, b) => (a.color < b.color ? -1 : a.color > b.color ? 1 : 0));
  let frame, start;
  function tick(ts) {
    if (!start) start = ts;
    const elapsed = ts - start;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // All particles share the same opacity at any instant — set it once per frame.
    const alpha = elapsed < 2200 ? 1 : Math.max(0, 1 - (elapsed - 2200) / 1200);
    ctx.globalAlpha = alpha;
    let lastColor = null;
    for (const p of particles) {
      p.x += p.vx; p.y += p.vy; p.vy += 0.10;
      p.angle += p.spin;
      if (p.color !== lastColor) { ctx.fillStyle = p.color; lastColor = p.color; }
      // setTransform replaces save/translate/rotate/restore (4 calls → 1).
      const cos = Math.cos(p.angle), sin = Math.sin(p.angle);
      ctx.setTransform(cos, sin, -sin, cos, p.x, p.y);
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (alpha > 0) frame = requestAnimationFrame(tick);
    else { cancelAnimationFrame(frame); canvas.remove(); }
  }
  frame = requestAnimationFrame(tick);
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

  if (won) {
    msg.innerHTML = guessCount === 1 ? 'Hole in one!' :
                    guessCount <= 3  ? 'Impressive!' : 'Got it!';
    msg.className = 'won';
  } else {
    msg.innerHTML = 'Better luck tomorrow';
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
  const unusedCount = won ? MAX_GUESSES - guessCount : 0;
  const grid = [...usedSlots, ...Array(unusedCount).fill('⬜')].join(' ');
  const outcome = won ? `solved in ${winNum}/${MAX_GUESSES} guesses` : `unsolved (${MAX_GUESSES}/${MAX_GUESSES})`;
  return `🗺️ Daily District — ${outcome}\n${grid}\nCan you identify it? https://daily-district.com/`;
}

// ============================================================
//  LEADERBOARD UI
// ============================================================
function renderScoreRow(entry, rank, isMe) {
  const rankClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
  const guessLabel = entry.won === false ? 'X' : entry.guesses;
  return `
    <div class="score-row ${isMe ? 'me' : ''} ${entry.won === false ? 'lost-row' : ''}">
      <span class="rank ${rankClass}">${rank}</span>
      <span class="name">${escapeHtml(entry.username)}${isMe ? ' (you)' : ''}</span>
      <span class="guesses">${guessLabel} guess${guessLabel !== 1 ? 'es' : ''}</span>
      <span class="time-val">${formatTime(entry.time || 0)}</span>
    </div>`;
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// Loads the leaderboard panels inside the result modal's Leaderboard tab.
// Fills the All Time (global aggregate) and My Stats (personal) tab panes.
async function loadLeaderboardPanels() {
  const alltimeEl  = document.getElementById('alltime-scores');
  const personalEl = document.getElementById('personal-stats');
  if (!alltimeEl || !personalEl) return;
  alltimeEl.innerHTML = personalEl.innerHTML = '<div class="lb-empty">Loading…</div>';

  if (!window.DistrictBackend) {
    alltimeEl.innerHTML = personalEl.innerHTML = '<div class="lb-empty">Stats unavailable.</div>';
    return;
  }

  try {
    // All stats come from the database — nothing local.
    const lb = await window.DistrictBackend.leaderboard();
    alltimeEl.innerHTML = renderAggregatePanel(lb.allTime, 'No games recorded yet.');
    personalEl.innerHTML = (lb.user && lb.user.played > 0)
      ? renderUserStats(lb.user)
      : '<div class="lb-empty">Sign in and play to track your personal stats.</div>';
  } catch (e) {
    alltimeEl.innerHTML = personalEl.innerHTML = '<div class="lb-empty">Couldn’t load stats.</div>';
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
      if (isAnonymousPlayer && guessHistory.length === 0 && !gameOver) init();
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
// anonymous. If they'd already FINISHED a game anonymously, record it to the account so it
// actually counts (otherwise they'd be signed in with empty stats and still see the "sign
// in to save" nudge). Then re-align device stats with the account and drop the nudges.
// (Anonymous→sign-in *before* guessing re-inits via the once-listener in init().)
window.addEventListener('district-auth', async () => {
  const wasAnon = isAnonymousPlayer;
  isAnonymousPlayer = false;
  if (wasAnon && gameOver && !isArchiveGame) {
    await bindAnonymousGameToAccount();   // replay the finished game to the new account
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
  async function openArchive() {
    const list = document.getElementById('archive-list');
    list.innerHTML = '<div class="lb-empty">Loading…</div>';
    document.getElementById('result-modal')?.classList.add('hidden');
    document.getElementById('archive-modal').classList.remove('hidden');
    let resp;
    try { resp = await window.DistrictBackend.archiveList(); }
    catch (e) { list.innerHTML = '<div class="lb-empty">Could not load the archive.</div>'; return; }
    const puzzles = (resp && resp.puzzles) || [];
    let html = '', curMonth = '';
    for (const p of puzzles) {
      const d = new Date(p.date + 'T00:00:00');
      const month = d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      if (month !== curMonth) { curMonth = month; html += `<div class="archive-month">${month}</div>`; }
      const dayLabel  = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      const fullLabel = d.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
      html += `<button class="archive-item" data-date="${p.date}" data-num="${p.puzzleNumber}" data-label="${fullLabel}">` +
              `<span class="archive-num">No. ${p.puzzleNumber}</span><span class="archive-date">${dayLabel}</span></button>`;
    }
    list.innerHTML = html || '<div class="lb-empty">No past puzzles yet.</div>';
  }

  document.getElementById('archive-list').addEventListener('click', (e) => {
    const item = e.target.closest('.archive-item');
    if (!item || !item.dataset.date) return;
    startServerArchive(item.dataset.date, parseInt(item.dataset.num, 10), item.dataset.label);
  });
  document.getElementById('archive-close').addEventListener('click', () => {
    document.getElementById('archive-modal').classList.add('hidden');
  });
  document.getElementById('play-again-btn').addEventListener('click', openArchive);
  document.getElementById('banner-new-map-btn').addEventListener('click', openArchive);

  // Game-over modal controls — delegated from document so they survive div recreation
  document.addEventListener('click', e => {
    if (e.target.closest('#gameover-result-btn')) { openResultModal(); return; }
    if (e.target.closest('#gameover-new-map-btn')) { openArchive(); return; }
    // Clicking anywhere on the gameover screen (except zoom buttons and the
    // District Profile sheet) opens results
    if (e.target.closest('#gameover-modal') && !e.target.closest('.mzb-go') && !e.target.closest('#gameover-census')) {
      openResultModal(); return;
    }
    const btn = e.target.closest('#gameover-modal .mzb-go');
    if (!btn || !_goZoom) return;
    const svgSel = d3.select('#gameover-map svg');
    if (svgSel.empty()) return;
    const dir = btn.dataset.dir;
    if (dir === 'in')  svgSel.transition().duration(250).call(_goZoom.scaleBy, 1.6);
    else if (dir === 'out') svgSel.transition().duration(250).call(_goZoom.scaleBy, 1 / 1.6);
    else if (dir === 'fit') {
      const cur = d3.zoomTransform(svgSel.node());
      const atDistrict = _goZoomInitial && Math.abs(cur.k - _goZoomInitial.k) / _goZoomInitial.k < 0.15;
      const t1 = atDistrict ? d3.zoomIdentity : (_goZoomInitial || d3.zoomIdentity);
      const t0k = cur.k, t0x = cur.x, t0y = cur.y;
      const t1k = t1.k, t1x = t1.x, t1y = t1.y;
      const dur = 700, ease = d3.easeCubicInOut;
      const start = performance.now();
      (function frame() {
        const elapsed = performance.now() - start;
        const t = ease(Math.min(elapsed / dur, 1));
        const tr = d3.zoomIdentity.translate(t0x + (t1x - t0x) * t, t0y + (t1y - t0y) * t).scale(t0k + (t1k - t0k) * t);
        _goZoom.transform(svgSel, tr);
        if (elapsed < dur) requestAnimationFrame(frame);
      })();
    }
  });

  // Share — landscape image + text via Web Share API; falls back to Twitter/X intent
  document.getElementById('post-x-btn').addEventListener('click', async () => {
    const text = buildShareText();
    if (navigator.canShare && todayDistrict && window.d3) {
      try {
        const blob = await _renderDistrictToBlob();
        const file = new File([blob], 'daily-district.png', { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], text });
          return;
        }
      } catch (err) { if (err?.name === 'AbortError') return; }
    }
    if (navigator.share) {
      try { await navigator.share({ text }); return; } catch (err) {
        if (err?.name === 'AbortError') return;
      }
    }
    window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(text), '_blank', 'noopener,noreferrer');
  });

  // Share — portrait 1080×1350, map + details panel
  document.getElementById('share-btn').addEventListener('click', async () => {
    try {
      const blob = await _renderShareBlob();
      const fname = `daily-district-${todayDistrict?.properties['state-district'] || 'share'}.png`;
      const file = new File([blob], fname, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
        return;
      }
      // Desktop fallback: download the image
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = fname;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    } catch (err) {
      if (err?.name !== 'AbortError') console.warn('Share failed:', err);
    }
  });

  // Resize — keep Leaflet map tile grid current when container changes
  window.addEventListener('resize', () => {
    if (map) map.invalidateSize();
  });


  // Leaderboard
  document.getElementById('show-results-btn')?.addEventListener('click', openResultModal);

  // Anonymous results CTA → open the login modal (login.js wires the form/providers).
  document.getElementById('result-anon-signin-btn')?.addEventListener('click', () => {
    document.getElementById('login-modal')?.classList.remove('hidden');
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
          document.getElementById('settings-modal').classList.remove('hidden');
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
      btnResult.textContent = 'Review Result';
      btnResult.addEventListener('click', () => {
        welcomeModal.classList.add('hidden');
        openResultModal();
      });

      container.appendChild(btnMap);
      container.appendChild(btnResult);
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

  // Build buttons after init() resolves so guessCount/gameOver reflect restored state
  _initPromise.then(() => {
  buildWelcomeButtons();

  // buildWelcomeButtons() just replaced the loader globe with the splash buttons, so
  // the heavy US-ref-map build can now run without freezing the globe. Two rAFs let the
  // button swap paint first. Idempotent — a restore path may have built it already.
  requestAnimationFrame(() => requestAnimationFrame(ensureUSRefMap));

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
  }); // end _initPromise.then

  // Title click → show welcome splash
  document.getElementById('title-home-btn')?.addEventListener('click', () => {
    document.getElementById('welcome-modal').classList.remove('hidden');
  });

  // Settings modal
  const settingsModal = document.getElementById('settings-modal');
  document.getElementById('settings-btn').addEventListener('click', () => {
    updateThemeToggle();
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
      if (modal.id === 'result-modal' && gameOver) {
        document.getElementById('gameover-modal')?.classList.remove('hidden');
      }
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

  // Wire Hard Mode toggle
  const hardToggle = document.getElementById('settings-hard-toggle');
  if (hardToggle) {
    hardToggle.checked = hardMode;
    hardToggle.addEventListener('change', () => {
      hardMode = hardToggle.checked;
      localStorage.setItem('districtguess_hardMode', hardMode ? '1' : '0');
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
