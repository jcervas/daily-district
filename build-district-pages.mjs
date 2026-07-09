#!/usr/bin/env node
/**
 * build-district-pages.mjs
 *
 * Generates static, crawlable reference pages — one per U.S. House district —
 * plus a browse index, sitemap.xml and robots.txt. This turns Daily District
 * from a single JS game page into a substantial content site (435+ unique pages
 * of representatives, Census demographics, election results and geography),
 * which is what AdSense's "minimum content requirements" ask for.
 *
 * Everything is generated from data already in the repo:
 *   district-names.json        canonical district list
 *   data/census_out.json       ACS demographics, keyed XX-01
 *   data/reps_out.json         current U.S. House member, keyed XX-01
 *   data/compactness_out.csv   area / perimeter / compactness / neighbors
 *   data/downballot_2024.csv   2024 & 2020 presidential results
 *
 * Output (committed, served by GitHub Pages):
 *   district/<slug>/index.html   e.g. district/pa-12/
 *   districts/index.html         browse hub
 *   sitemap.xml, robots.txt
 *
 * Run: node build-district-pages.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SITE = 'https://daily-district.com';
const CSS_V = 2; // bump when district-pages.css changes
const MAP_V = 1; // bump when districts-map.topojson changes

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

// ---- load data -------------------------------------------------------------
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const districtNames = JSON.parse(read('district-names.json'));
const census = JSON.parse(read('data/census_out.json'));
const reps   = JSON.parse(read('data/reps_out.json'));

function parseCsv(text) {
  return text.split(/\r?\n/).filter((l) => l.length).map((l) => l.split(','));
}

// compactness_out.csv: district_id,area_sqmi,perimeter_mi,reock,polsby_popper,adj
const compact = {};
for (const row of parseCsv(read('data/compactness_out.csv')).slice(1)) {
  const [id, area, perim, reock, pp, adj] = row;
  compact[id] = {
    area:  num(area),
    perim: num(perim),
    reock: num(reock),
    pp:    num(pp),
    adj:   (adj || '').split('|').map((s) => s.trim()).filter(Boolean),
  };
}

// downballot_2024.csv: District,Incumbent,Party,Harris,Trump,Margin24,Biden,Trump,Margin20
// First data row starts once the id looks like XX-YY. At-large uses XX-AL.
const pres = {};
for (const row of parseCsv(read('data/downballot_2024.csv'))) {
  const id = (row[0] || '').trim();
  if (!/^[A-Z]{2}-(\d{2}|AL)$/.test(id)) continue;
  pres[id] = {
    dem24: num(row[3]), rep24: num(row[4]), mar24: num(row[5]),
    dem20: num(row[6]), rep20: num(row[7]), mar20: num(row[8]),
  };
}

function num(v) {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(/[$,%\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}

// ---- helpers ---------------------------------------------------------------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const fmt   = (n) => n == null ? '—' : Number(n).toLocaleString('en-US');
const money = (n) => n == null ? '—' : '$' + Number(n).toLocaleString('en-US');
const pctS  = (n) => n == null ? '—' : n + '%';

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function slug(id) { return id.toLowerCase(); }        // PA-12 -> pa-12
function districtUrl(id) { return `/district/${slug(id)}/`; }

// Human district label: "12th Congressional District" or "At-Large Congressional District".
function districtLabel(state, districtNum, atLarge) {
  if (atLarge) return 'At-Large Congressional District';
  return `${ordinal(parseInt(districtNum, 10))} Congressional District`;
}

function possessive(name) { return name.endsWith('s') ? `${name}'` : `${name}'s`; }

// A stacked bar from [{frac, cls}] segments.
function stackBar(segs) {
  const inner = segs.filter((s) => s.frac > 0)
    .map((s) => `<span class="${s.cls}" style="width:${(s.frac * 100).toFixed(1)}%"></span>`).join('');
  return `<div class="dd-bar">${inner}</div>`;
}

// Presidential lean phrasing from a margin (positive = Democratic).
function presLean(margin) {
  if (margin == null) return null;
  const a = Math.abs(margin);
  const party = margin > 0 ? 'Democratic' : 'Republican';
  const tag = margin > 0 ? `D+${a}` : `R+${a}`;
  const strength = a >= 30 ? 'safely' : a >= 15 ? 'solidly' : a >= 6 ? 'leaning' : 'narrowly';
  return { party, tag, strength, competitive: a < 6 };
}

// ---- assemble merged records ----------------------------------------------
const records = [];
const byState = {};
for (const [state, dists] of Object.entries(districtNames)) {
  const atLarge = dists.length === 1;
  for (const dnum of dists) {
    const id = `${state}-${dnum}`;                // canonical, e.g. PA-12
    const presId = atLarge ? `${state}-AL` : id;  // downballot at-large key
    records.push({
      id, state, dnum, atLarge,
      stateName: STATE_NAMES[state] || state,
      c: census[id] || {},
      rep: reps[id] || null,
      geo: compact[id] || {},
      pres: pres[presId] || pres[id] || {},
    });
    (byState[state] ||= []).push(id);
  }
}
records.sort((a, b) => a.id.localeCompare(b.id));

// ---- page renderers --------------------------------------------------------
function shell({ title, description, canonical, body, scripts = '' }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <link rel="canonical" href="${canonical}" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${canonical}" />
  <meta name="google-adsense-account" content="ca-pub-2164002681613672" />
  <link rel="icon" href="/favicon.ico?v=2" sizes="any" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <meta name="theme-color" content="#C41230" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;600;700;800&family=Barlow+Condensed:wght@800;900&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/district-pages.css?v=${CSS_V}" />
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2164002681613672" crossorigin="anonymous"></script>
</head>
<body>
  <header class="dd-header">
    <div class="dd-header-inner">
      <img src="/logo.svg" alt="" aria-hidden="true" />
      <a class="dd-wordmark" href="/">Daily District</a>
      <a class="dd-play" href="/">Play today&rsquo;s puzzle</a>
    </div>
  </header>
  <main class="dd-main">
${body}
  </main>
  <footer class="dd-footer">
    <div>
      <a href="/">Play</a> ·
      <a href="/districts/">All districts</a> ·
      <a href="/privacy.html">Privacy</a>
    </div>
    <p>Daily District — a daily game about U.S. congressional districts.<br>
    Demographics from the U.S. Census Bureau (ACS 5-year); presidential results via The Downballot.</p>
  </footer>
${scripts}</body>
</html>`;
}

function districtPage(r) {
  const { c, geo, rep, pres: p } = r;
  const label = districtLabel(r.state, r.dnum, r.atLarge);
  const fullName = `${possessive(r.stateName)} ${label}`;
  const canonical = `${SITE}${districtUrl(r.id)}`;

  // demographics
  const total = c.pop || 0;
  const pctOf = (x) => total > 0 && x != null ? Math.round((x / total) * 100) : null;
  const whPct = pctOf(c.whiteNH), blPct = pctOf(c.black), hiPct = pctOf(c.hispanic), asPct = pctOf(c.asian);
  const otherPct = [whPct, blPct, hiPct, asPct].every((v) => v != null)
    ? Math.max(0, 100 - (whPct + blPct + hiPct + asPct)) : null;
  const bachPlus = (c.bach || 0) + (c.master || 0);
  const eduPct = c.edu_total > 0 ? Math.round((bachPlus / c.edu_total) * 100) : null;
  const density = geo.area > 0 && total ? Math.round(total / geo.area) : null;
  const ppLabel = geo.pp == null ? null
    : geo.pp >= 0.45 ? 'very compact' : geo.pp >= 0.30 ? 'fairly compact'
    : geo.pp >= 0.18 ? 'irregular in shape' : 'very irregular in shape';

  // representative
  const repName = rep?.name || null;
  const repParty = rep?.party || null;
  const repCode = rep?.partyCode || (repParty ? repParty[0] : null);

  // presidential
  const lean24 = presLean(p.mar24);
  const lean20 = presLean(p.mar20);

  // race groups
  const raceGroups = [
    { name: 'White',    pct: whPct,    seg: 'seg-white' },
    { name: 'Black',    pct: blPct,    seg: 'seg-black' },
    { name: 'Hispanic', pct: hiPct,    seg: 'seg-hisp'  },
    { name: 'Asian',    pct: asPct,    seg: 'seg-asian' },
    { name: 'Other',    pct: otherPct, seg: 'seg-other' },
  ].filter((g) => g.pct != null);
  const raceTop = raceGroups.length ? raceGroups.reduce((a, b) => b.pct > a.pct ? b : a) : null;

  // ---- prose lede (unique, data-driven) ----
  const sentences = [];
  sentences.push(
    `${fullName} is ${r.atLarge ? 'the statewide seat covering all of ' + r.stateName
      : 'one of ' + districtNames[r.state].length + ' U.S. House districts in ' + r.stateName}` +
    (repName ? `, represented in Congress by ${repName}${repParty ? ` (${repParty})` : ''}.` : '.'));
  if (total) {
    let s = `It is home to roughly ${fmt(total)} people`;
    if (c.medianAge != null) s += `, with a median age of ${c.medianAge}`;
    if (raceTop) s += `. The population is about ${raceTop.pct}% ${raceTop.name}`;
    sentences.push(s + '.');
  }
  if (c.income != null) {
    let s = `The median household income is ${money(c.income)}`;
    if (eduPct != null) s += `, and ${eduPct}% of adults 25 and older hold a bachelor’s degree or higher`;
    sentences.push(s + '.');
  }
  if (lean24) {
    sentences.push(lean24.competitive
      ? `In the 2024 presidential election the district was highly competitive (${lean24.tag}).`
      : `In the 2024 presidential election it voted ${lean24.strength} ${lean24.party} (${lean24.tag}).`);
  }
  const lede = sentences.join(' ');

  const metaDesc =
    `${fullName}: ${repName ? repName + ' represents this seat. ' : ''}` +
    `Population ${fmt(total)}${c.income != null ? `, median household income ${money(c.income)}` : ''}` +
    `${lean24 ? `, 2024 presidential lean ${lean24.tag}` : ''}. Census demographics, election results and maps.`;

  // ---- sections ----
  const S = [];

  // representative + election
  S.push(`<section class="dd-card">
      <h2>Representative</h2>
      <div class="dd-rep">
        <span class="dd-rep-name">${repName ? (rep.url
          ? `<a href="${esc(rep.url)}" target="_blank" rel="noopener">${esc(repName)}</a>` : esc(repName))
          : 'Vacant'}</span>
        ${repParty ? `<span class="dd-pill ${esc(repCode)}">${esc(repParty)}</span>` : ''}
      </div>
      <p class="dd-source">Current U.S. House member (source: house.gov).</p>
    </section>`);

  if (lean24 || lean20) {
    const stack = (p.dem24 != null && p.rep24 != null) ? stackBar([
      { frac: p.dem24 / 100, cls: 'seg-dem' },
      { frac: p.rep24 / 100, cls: 'seg-rep' },
      { frac: Math.max(0, 1 - (p.dem24 + p.rep24) / 100), cls: 'seg-oth' },
    ]) : '';
    S.push(`<section class="dd-card">
      <h2>Presidential results</h2>
      ${stack}
      <div class="dd-grid">
        ${lean24 ? statBox(lean24.tag, '2024 margin') : ''}
        ${p.dem24 != null ? statBox(p.dem24 + '% / ' + p.rep24 + '%', '2024 Dem / Rep') : ''}
        ${lean20 ? statBox(lean20.tag, '2020 margin') : ''}
      </div>
      <p class="dd-source">Two-party presidential vote by district (source: The Downballot).</p>
    </section>`);
  }

  // demographics
  if (total) {
    const raceLegend = raceGroups.length ? `<div class="dd-legend">` +
      raceGroups.map((g) => `<span><i class="${g.seg}"></i>${g.pct}% ${g.name}</span>`).join('') + `</div>` : '';
    S.push(`<section class="dd-card">
      <h2>Who lives here</h2>
      ${raceGroups.length ? stackBar(raceGroups.map((g) => ({ frac: g.pct / 100, cls: g.seg }))) : ''}
      ${raceLegend}
      <div class="dd-grid" style="margin-top:16px">
        ${statBox(fmt(total), 'Population')}
        ${statBox(c.medianAge != null ? c.medianAge : '—', 'Median age')}
        ${statBox(pctS(c.under18Pct), 'Under 18')}
        ${statBox(pctS(c.age65Pct), 'Age 65+')}
        ${statBox(pctS(c.foreignBornPct), 'Foreign-born')}
        ${statBox(pctS(c.veteranPct), 'Veterans')}
      </div>
      <p class="dd-source">U.S. Census Bureau, American Community Survey (5-year estimates).</p>
    </section>`);

    S.push(`<section class="dd-card">
      <h2>Economy &amp; education</h2>
      <div class="dd-grid">
        ${statBox(money(c.income), 'Median household income')}
        ${statBox(money(c.medianHome), 'Median home value')}
        ${statBox(c.medianRent != null ? money(c.medianRent) : '—', 'Median rent')}
        ${statBox(eduPct != null ? eduPct + '%' : '—', "Bachelor's or higher")}
        ${statBox(pctS(c.homeownerPct), 'Homeownership')}
        ${statBox(pctS(c.povertyPct), 'Poverty rate')}
        ${statBox(c.meanCommuteMin != null ? c.meanCommuteMin + ' min' : '—', 'Mean commute')}
        ${statBox(pctS(c.uninsuredPct), 'Uninsured')}
      </div>
      <p class="dd-source">U.S. Census Bureau, American Community Survey (5-year estimates).</p>
    </section>`);
  }

  // geography
  if (geo.area) {
    S.push(`<section class="dd-card">
      <h2>Geography</h2>
      <div class="dd-locator">
        <img src="/state-svgs/${r.state.toLowerCase()}.svg" alt="Outline of ${esc(r.stateName)}" loading="lazy" width="200" height="200" />
        <p class="dd-source">${esc(r.stateName)}${r.atLarge ? ' (single at-large district)' : ''}</p>
      </div>
      <div class="dd-grid" style="margin-top:12px">
        ${statBox(fmt(geo.area) + ' mi²', 'Land area')}
        ${density != null ? statBox(fmt(density) + '/mi²', 'Pop. density') : ''}
        ${geo.pp != null ? statBox(geo.pp.toFixed(2), 'Compactness (Polsby-Popper)') : ''}
      </div>
      ${ppLabel ? `<p style="margin:10px 0 0">By the Polsby-Popper measure, ${r.id} is ${ppLabel} compared with other districts.</p>` : ''}
    </section>`);
  }

  // neighbors
  const neighbors = (geo.adj || []).filter((id) => census[id] || reps[id]);
  if (neighbors.length) {
    S.push(`<section class="dd-card">
      <h2>Neighboring districts</h2>
      <ul class="dd-neighbors">
        ${neighbors.map((id) => `<li><a href="${districtUrl(id)}">${esc(id)}</a></li>`).join('')}
      </ul>
    </section>`);
  }

  const body = `    <nav class="dd-crumbs">
      <a href="/">Home</a><span>›</span>
      <a href="/districts/">Districts</a><span>›</span>
      ${esc(r.stateName)}<span>›</span>${esc(r.id)}
    </nav>
    <h1 class="dd-title">${esc(fullName)}</h1>
    <p class="dd-sub">${esc(r.stateName)} · ${esc(r.id)}${r.atLarge ? ' · At-large' : ''}</p>
    <p class="dd-lede">${lede}</p>
    ${S.join('\n    ')}
    <div class="dd-cta"><a href="/">Can you guess this district? Play Daily District →</a></div>`;

  return shell({ title: `${fullName} — Representative, Demographics &amp; Map | Daily District`,
    description: metaDesc, canonical, body });
}

function statBox(val, lbl) {
  return `<div class="dd-stat"><div class="dd-stat-val">${val}</div><div class="dd-stat-lbl">${esc(lbl)}</div></div>`;
}

function browsePage() {
  const canonical = `${SITE}/districts/`;
  const states = Object.keys(byState).sort((a, b) =>
    (STATE_NAMES[a] || a).localeCompare(STATE_NAMES[b] || b));
  const blocks = states.map((st) => {
    const ids = byState[st].slice().sort();
    const atLarge = ids.length === 1;
    const links = ids.map((id) => {
      const dnum = id.split('-')[1];
      const text = atLarge ? 'At-large' : ordinal(parseInt(dnum, 10));
      return `<a href="${districtUrl(id)}">${esc(text)}</a>`;
    }).join('');
    return `<div class="dd-browse-state">
      <h2>${esc(STATE_NAMES[st] || st)} <span style="font-weight:400;font-size:14px;color:var(--dd-muted)">(${ids.length})</span></h2>
      <div class="dd-browse-links">${links}</div>
    </div>`;
  }).join('\n    ');

  const mapFigure = `    <figure class="dd-map-wrap" style="margin:0 0 6px">
      <div id="dd-map"><p style="padding:44px 12px;text-align:center;color:var(--dd-muted)">Loading map…</p></div>
      <button type="button" id="dd-map-back" class="dd-map-back" aria-label="Back to all states">&lsaquo; All states</button>
      <div id="dd-map-title" class="dd-map-title"></div>
      <div id="dd-map-tip" class="dd-map-tip"></div>
    </figure>
    <p class="dd-map-hint">Click a state to zoom in, then click a district to open its profile.</p>`;

  const body = `    <nav class="dd-crumbs"><a href="/">Home</a><span>›</span>Districts</nav>
    <h1 class="dd-title">All U.S. House Districts</h1>
    <p class="dd-lede">Browse profiles for all ${records.length} U.S. congressional districts — the current representative, Census demographics, presidential results and geography for each seat. Then <a href="/">play today’s Daily District puzzle</a>.</p>
${mapFigure}
    ${blocks}`;

  return shell({
    title: 'All U.S. Congressional Districts — Representatives & Demographics | Daily District',
    description: `Directory of all ${records.length} U.S. House districts with representatives, Census demographics, and election results. Explore any district, then play the daily game.`,
    canonical, body, scripts: mapScripts(),
  });
}

// Interactive national map for /districts/. Client code avoids template
// literals and ${} so it can be embedded verbatim in this generator.
function mapScripts() {
  const client = `(function(){
  var STATE_NAMES=` + JSON.stringify(STATE_NAMES) + `;
  var ord=function(n){var s=['th','st','nd','rd'],v=n%100;return n+(s[(v-20)%10]||s[v]||s[0]);};
  var el=document.getElementById('dd-map');
  if(!el||typeof d3==='undefined'||typeof topojson==='undefined'){ if(el&&el.parentNode)el.parentNode.classList.add('dd-map-failed'); return; }
  var W=960,H=600;
  var back=document.getElementById('dd-map-back');
  var titleEl=document.getElementById('dd-map-title');
  var tip=document.getElementById('dd-map-tip');
  d3.json('/districts-map.topojson?v=` + MAP_V + `').then(function(topo){
    el.innerHTML='';
    var dcol=topojson.feature(topo,topo.objects.districts);
    var districts=dcol.features;
    var states=topojson.feature(topo,topo.objects.states).features;
    var proj=d3.geoAlbersUsa().fitSize([W,H],dcol);
    var path=d3.geoPath(proj);
    var svg=d3.select(el).append('svg').attr('viewBox','0 0 '+W+' '+H).attr('class','dd-map-svg').attr('role','img').attr('aria-label','Map of U.S. congressional districts');
    var g=svg.append('g');
    var stateFeat={}; states.forEach(function(f){stateFeat[f.properties.st]=f;});
    var counts={}; districts.forEach(function(f){counts[f.properties.st]=(counts[f.properties.st]||0)+1;});
    var dSel=g.selectAll('path.dd-d').data(districts).enter().append('path').attr('class','dd-d').attr('d',path);
    var sg=g.append('g'); sg.selectAll('path.dd-s').data(states).enter().append('path').attr('class','dd-s').attr('d',path);
    var selected=null;
    function labelFor(f){
      var st=f.properties.st, num=f.properties.sd.split('-')[1], name=STATE_NAMES[st]||st;
      return counts[st]===1 ? (name+' \\u2014 At-large') : (name+' '+ord(parseInt(num,10))+' District');
    }
    function showTip(ev,text){ var r=el.getBoundingClientRect(); tip.textContent=text; tip.style.left=(ev.clientX-r.left)+'px'; tip.style.top=(ev.clientY-r.top)+'px'; tip.classList.add('show'); }
    function hideTip(){ tip.classList.remove('show'); }
    dSel.on('mousemove',function(ev,d){ showTip(ev,labelFor(d)); })
        .on('mouseenter',function(ev,d){ d3.select(this).raise().classed('hot',true); })
        .on('mouseleave',function(){ d3.select(this).classed('hot',false); hideTip(); })
        .on('click',function(ev,d){ if(!selected){ zoomTo(d.properties.st); } else { window.location.href='/district/'+d.properties.sd.toLowerCase()+'/'; } });
    function updateDim(){ dSel.classed('dim',function(d){ return selected && d.properties.st!==selected; }); }
    function zoomTo(st){
      selected=st;
      var b=path.bounds(stateFeat[st]);
      var bw=b[1][0]-b[0][0], bh=b[1][1]-b[0][1], cx=(b[0][0]+b[1][0])/2, cy=(b[0][1]+b[1][1])/2;
      var k=Math.min(14, 0.92*Math.min(W/bw, H/bh));
      g.transition().duration(650).attr('transform','translate('+(W/2-k*cx)+','+(H/2-k*cy)+') scale('+k+')');
      updateDim(); back.classList.add('show'); titleEl.textContent=(STATE_NAMES[st]||st); hideTip();
    }
    function reset(){ selected=null; g.transition().duration(650).attr('transform','translate(0,0) scale(1)'); updateDim(); back.classList.remove('show'); titleEl.textContent=''; hideTip(); }
    back.addEventListener('click',reset);
    el.addEventListener('mouseleave',hideTip);
  }).catch(function(){ if(el&&el.parentNode)el.parentNode.classList.add('dd-map-failed'); });
})();`;
  return `  <script src="https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/topojson-client@3/dist/topojson-client.min.js"></script>
  <script>${client}</script>
`;
}

// ---- write output ----------------------------------------------------------
const outDir = join(ROOT, 'district');
if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true });

let count = 0;
for (const r of records) {
  const dir = join(ROOT, 'district', slug(r.id));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), districtPage(r));
  count++;
}

mkdirSync(join(ROOT, 'districts'), { recursive: true });
writeFileSync(join(ROOT, 'districts', 'index.html'), browsePage());

// sitemap.xml
const today = new Date().toISOString().slice(0, 10);
const urls = [
  { loc: `${SITE}/`, pri: '1.0' },
  { loc: `${SITE}/districts/`, pri: '0.9' },
  { loc: `${SITE}/privacy.html`, pri: '0.2' },
  ...records.map((r) => ({ loc: `${SITE}${districtUrl(r.id)}`, pri: '0.7' })),
];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u.loc}</loc><lastmod>${today}</lastmod><priority>${u.pri}</priority></url>`).join('\n')}
</urlset>
`;
writeFileSync(join(ROOT, 'sitemap.xml'), sitemap);

// robots.txt
writeFileSync(join(ROOT, 'robots.txt'),
`User-agent: *
Allow: /
Disallow: /globe-playground.html
Disallow: /globe-css-playground.html

Sitemap: ${SITE}/sitemap.xml
`);

console.log(`Generated ${count} district pages + browse index.`);
console.log(`Sitemap: ${urls.length} URLs. robots.txt written.`);
