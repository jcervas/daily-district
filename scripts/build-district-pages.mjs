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
 * Run: node scripts/build-district-pages.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'); // repo root (script lives in scripts/)
const SITE = 'https://daily-district.com';
const CSS_V = 7; // bump when district-pages.css changes
const MAP_V = 1; // bump when districts-map.topojson changes
const DETAIL_V = 1; // bump when districts-detail/*.topojson changes
const MAP_JS_V = 5; // bump when the emitted district-map.js changes

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
      <a class="dd-play" id="dd-auth" href="/?signup=1">Sign up</a>
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
${scripts}${authAssets()}</body>
</html>`;
}

// Header Sign up / Sign out control. Reuses the game's real auth stack
// (supabase-js + backend.js → window.DistrictBackend). The Supabase session
// lives in localStorage and is shared same-origin, so a visitor who created an
// account on the homepage is recognised here. Signed out → "Sign up" links to
// /?signup=1, which opens the homepage's real sign-in/sign-up modal (the game
// isn't live yet); signed in → "Sign out" in place.
function authAssets() {
  // Real sign-up/sign-in modal, opened in place so visitors never leave the
  // district page. Wired directly to window.DistrictBackend (same Supabase
  // stack as the homepage); Google OAuth and the email-confirm link both
  // redirect back to the current page.
  const googleG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>';
  const modal = `  <div id="dd-auth-modal" class="dd-auth-modal hidden" role="dialog" aria-modal="true" aria-labelledby="dd-auth-title">
    <div class="dd-auth-card">
      <button type="button" class="dd-auth-close" id="dd-auth-close" aria-label="Close">&times;</button>
      <h2 id="dd-auth-title">Sign up</h2>
      <p class="dd-auth-sub" id="dd-auth-sub">Sign up for a chance to win prizes and be first to know when we launch.</p>
      <button type="button" class="dd-auth-google" id="dd-auth-google">${googleG}Continue with Google</button>
      <div class="dd-auth-or">or</div>
      <form id="dd-auth-form" novalidate>
        <input type="email" id="dd-auth-email" placeholder="Email" autocomplete="email" />
        <input type="password" id="dd-auth-password" placeholder="Password" autocomplete="new-password" />
        <label class="dd-auth-check" id="dd-auth-marketing-wrap"><input type="checkbox" id="dd-auth-marketing" checked /> Email me occasional updates</label>
        <button type="submit" class="dd-auth-submit" id="dd-auth-submit">Sign up</button>
      </form>
      <div class="dd-auth-error" id="dd-auth-error"></div>
      <button type="button" class="dd-auth-toggle" id="dd-auth-toggle">Already have an account? Sign in</button>
      <p class="dd-auth-legal">By continuing you agree to our <a href="/privacy.html">Privacy Policy</a>.</p>
    </div>
  </div>`;
  const js = `(function(){
  function init(){
    var el=document.getElementById('dd-auth'), B=window.DistrictBackend;
    if(!el||!B) return;
    var modal=document.getElementById('dd-auth-modal');
    var title=document.getElementById('dd-auth-title'), sub=document.getElementById('dd-auth-sub');
    var form=document.getElementById('dd-auth-form');
    var emailI=document.getElementById('dd-auth-email'), pwI=document.getElementById('dd-auth-password');
    var mkWrap=document.getElementById('dd-auth-marketing-wrap'), mk=document.getElementById('dd-auth-marketing');
    var submit=document.getElementById('dd-auth-submit'), errEl=document.getElementById('dd-auth-error');
    var toggle=document.getElementById('dd-auth-toggle'), googleBtn=document.getElementById('dd-auth-google');
    var closeBtn=document.getElementById('dd-auth-close');
    var mode='signup', busy=false;
    function setErr(m,ok){ errEl.textContent=m||''; errEl.className='dd-auth-error'+(ok?' ok':''); }
    function label(){ return mode==='signup'?'Sign up':'Sign in'; }
    function setBusy(on){ busy=on; submit.disabled=on; googleBtn.disabled=on; submit.textContent=on?'Please wait…':label(); }
    function setMode(m){
      mode=m; setErr('');
      if(m==='signup'){ title.textContent='Sign up'; sub.textContent='Sign up for a chance to win prizes and be first to know when we launch.'; if(mkWrap) mkWrap.style.display=''; pwI.setAttribute('autocomplete','new-password'); toggle.textContent='Already have an account? Sign in'; }
      else { title.textContent='Sign in'; sub.textContent='Welcome back — sign in to your account.'; if(mkWrap) mkWrap.style.display='none'; pwI.setAttribute('autocomplete','current-password'); toggle.textContent='Need an account? Sign up'; }
      submit.textContent=label();
    }
    function open(m){ setMode(m||'signup'); modal.classList.remove('hidden'); setTimeout(function(){ try{ emailI.focus(); }catch(_){ } },40); }
    function close(){ modal.classList.add('hidden'); setBusy(false); }
    function render(user){
      if(user){ el.textContent='Sign out'; el.dataset.auth='in'; el.setAttribute('href','#'); }
      else { el.textContent='Sign up'; el.dataset.auth='out'; el.setAttribute('href','/?signup=1'); }
    }
    el.addEventListener('click',function(e){
      e.preventDefault();
      if(el.dataset.auth==='in'){ Promise.resolve(B.signOut()).then(function(){ render(null); }).catch(function(){}); }
      else { open('signup'); }
    });
    closeBtn.addEventListener('click',close);
    modal.addEventListener('click',function(e){ if(e.target===modal) close(); });
    document.addEventListener('keydown',function(e){ if(e.key==='Escape' && !modal.classList.contains('hidden')) close(); });
    toggle.addEventListener('click',function(){ setMode(mode==='signup'?'signin':'signup'); });
    googleBtn.addEventListener('click',function(){ if(busy) return; setErr(''); setBusy(true); Promise.resolve(B.signInWithOAuth('google')).catch(function(ex){ setErr((ex&&ex.message)||'Could not start Google sign-in'); setBusy(false); }); });
    form.addEventListener('submit',function(e){
      e.preventDefault(); if(busy) return; setErr('');
      var email=emailI.value.trim(), pw=pwI.value;
      if(!email || pw.length<6){ setErr('Enter an email and a 6+ character password.'); return; }
      setBusy(true);
      var p = mode==='signup' ? B.signUpWithEmail(email, pw, undefined, mk?mk.checked:false) : B.signInWithEmail(email, pw);
      Promise.resolve(p).then(function(res){
        if(res && res.error) throw res.error;
        if(mode==='signup' && res && res.data && !res.data.session){ setErr('Account created! Check your email to confirm — then you are signed in.', true); setBusy(false); return; }
        // Otherwise a session exists now; onAuthChange closes + re-renders.
      }).catch(function(ex){ setErr((ex&&ex.message)||'Something went wrong'); setBusy(false); });
    });
    Promise.resolve(B.getUser()).then(function(u){ render(u); if(u) close(); }).catch(function(){ render(null); });
    if(B.onAuthChange){ try{ B.onAuthChange(function(user){ render(user); if(user) close(); }); }catch(_){ } }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();`;
  return `
${modal}
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2" defer></script>
  <script src="/backend.js?v=24" defer></script>
  <script>${js}</script>
`;
}

// Responsive Display ad (one reused unit, slot 3771556759). A labeled placeholder box
// shows until AdSense is actually serving; the inline push queues this slot even though
// the adsbygoogle loader in <head> is async, and `.dd-ad-box:has([data-ad-status=filled])`
// drops the placeholder chrome once a real ad renders.
function adUnit() {
  return `<div class="dd-ad">
      <span class="dd-ad-label">Advertisement</span>
      <div class="dd-ad-box"><ins class="adsbygoogle" style="display:block"
        data-ad-client="ca-pub-2164002681613672" data-ad-slot="3771556759"
        data-ad-format="auto" data-full-width-responsive="true"></ins></div>
      <script>(adsbygoogle=window.adsbygoogle||[]).push({});</script>
    </div>`;
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

  // geography — placed right after the representative
  if (geo.area) {
    S.push(`<section class="dd-card">
      <h2>Geography</h2>
${mapFigure({
      focusState: r.state,
      focusDistrict: r.id,
      fallback: `<img src="/state-svgs/${r.state.toLowerCase()}.svg" alt="Map of ${esc(r.stateName)}" width="200" height="200" />`,
      hint: r.atLarge
        ? `${esc(r.stateName)} elects a single at-large representative. Zoom out to explore other states.`
        : `${esc(r.id)} is shown in red. Click a neighboring district to open it, or zoom out to explore the country.`,
    })}
      <div class="dd-grid" style="margin-top:12px">
        ${statBox(fmt(geo.area) + ' mi²', 'Land area')}
        ${density != null ? statBox(fmt(density) + '/mi²', 'Pop. density') : ''}
        ${geo.pp != null ? statBox(geo.pp.toFixed(2), 'Compactness (Polsby-Popper)') : ''}
      </div>
      ${ppLabel ? `<p style="margin:10px 0 0">By the Polsby-Popper measure, ${r.id} is ${ppLabel} compared with other districts.</p>` : ''}
    </section>`);
  }

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

  // One in-content ad, placed after the first couple of profile cards.
  if (S.length) S.splice(Math.min(2, S.length), 0, adUnit());

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
    description: metaDesc, canonical, body, scripts: mapAssets() });
}

function statBox(val, lbl) {
  return `<div class="dd-stat"><div class="dd-stat-val">${val}</div><div class="dd-stat-lbl">${esc(lbl)}</div></div>`;
}

function browsePage() {
  const canonical = `${SITE}/districts/`;
  const states = Object.keys(byState).sort((a, b) =>
    (STATE_NAMES[a] || a).localeCompare(STATE_NAMES[b] || b));
  // Text index of every district. Collapsed by default (the map is the primary
  // way to browse) but kept in the DOM so it stays a crawlable internal-link hub
  // — the district pages' discoverability, and the AdSense case, lean on this.
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
  }).join('\n      ');

  const body = `    <nav class="dd-crumbs"><a href="/">Home</a><span>›</span>Districts</nav>
    <h1 class="dd-title">All U.S. House Districts</h1>
    <p class="dd-lede">Browse profiles for all ${records.length} U.S. congressional districts — the current representative, Census demographics, presidential results and geography for each seat. Then <a href="/">play today’s Daily District puzzle</a>.</p>
${mapFigure({ hint: 'Click a state to zoom in, then click a district to open its profile.' })}
    ${adUnit()}
    <details class="dd-browse-all">
      <summary>Or browse all ${records.length} districts as a list</summary>
      ${blocks}
    </details>`;

  return shell({
    title: 'All U.S. Congressional Districts — Representatives & Demographics | Daily District',
    description: `Directory of all ${records.length} U.S. House districts with representatives, Census demographics, and election results. Explore any district, then play the daily game.`,
    canonical, body, scripts: mapAssets(),
  });
}

// Map figure markup, shared by the browse hub (no focus) and each district
// profile (focusState/focusDistrict start it zoomed on that district). Zoom
// cluster reuses the game's markup/classes (.map-zoom-btns / .mzb).
function mapFigure({ focusState = '', focusDistrict = '', fallback = '', hint = '' } = {}) {
  const data = focusState
    ? ` data-focus-state="${esc(focusState)}" data-focus-district="${esc(focusDistrict)}"`
    : '';
  const loading = fallback || `<p style="padding:44px 12px;text-align:center;color:var(--dd-muted)">Loading map…</p>`;
  return `    <figure class="dd-map-wrap" style="margin:0 0 6px">
      <div id="dd-map"${data}>${loading}</div>
      <div class="map-zoom-btns" role="group" aria-label="Map zoom">
        <button type="button" class="mzb" data-zoom="in" aria-label="Zoom in">+</button>
        <button type="button" class="mzb" data-zoom="out" aria-label="Zoom out">&minus;</button>
        <button type="button" class="mzb" data-zoom="fit" aria-label="Fit the whole country" title="Fit"><svg class="mzb-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg></button>
      </div>
      <button type="button" id="dd-map-back" class="dd-map-back" aria-label="Back to all states">&lsaquo; All states</button>
      <div id="dd-map-title" class="dd-map-title"></div>
      <div id="dd-map-tip" class="dd-map-tip"></div>
    </figure>${hint ? `\n    <p class="dd-map-hint">${hint}</p>` : ''}`;
}

// d3 + topojson + the shared map client (external, cached across all pages).
function mapAssets() {
  return `  <script src="https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/topojson-client@3/dist/topojson-client.min.js"></script>
  <script src="/district-map.js?v=${MAP_JS_V}" defer></script>
`;
}

// The shared client, written to /district-map.js. Reads its target from the
// #dd-map element's data attributes; with no focus it's the national browse
// map, with a focus it starts zoomed on that district (shown in red). Avoids
// template literals / ${} so it embeds verbatim.
function mapClientJs() {
  return `(function(){
  var STATE_NAMES=` + JSON.stringify(STATE_NAMES) + `;
  var ord=function(n){var s=['th','st','nd','rd'],v=n%100;return n+(s[(v-20)%10]||s[v]||s[0]);};
  var el=document.getElementById('dd-map');
  if(!el||typeof d3==='undefined'||typeof topojson==='undefined'){ if(el&&el.parentNode)el.parentNode.classList.add('dd-map-failed'); return; }
  var focusState=el.getAttribute('data-focus-state')||'';
  var focusDistrict=el.getAttribute('data-focus-district')||'';
  var W=960,H=600;
  var wrap=el.parentNode;
  var back=document.getElementById('dd-map-back');
  var titleEl=document.getElementById('dd-map-title');
  var tip=document.getElementById('dd-map-tip');
  function init(){
  d3.json('/districts-map.topojson?v=` + MAP_V + `').then(function(topo){
    el.innerHTML='';
    var dcol=topojson.feature(topo,topo.objects.districts);
    var districts=dcol.features;
    var states=topojson.feature(topo,topo.objects.states).features;
    var proj=d3.geoAlbersUsa().fitSize([W,H],dcol);
    var path=d3.geoPath(proj);
    var svg=d3.select(el).append('svg').attr('viewBox','0 0 '+W+' '+H).attr('class','dd-map-svg').attr('role','img').attr('aria-label','Map of U.S. congressional districts');
    var g=svg.append('g');
    // Layers, bottom to top: districts, state borders, transparent state hit-targets.
    var districtsLayer=g.append('g');
    var bordersLayer=g.append('g');
    var hitLayer=g.append('g');
    var stateFeat={}; states.forEach(function(f){stateFeat[f.properties.st]=f;});
    var distFeat={}; districts.forEach(function(f){distFeat[f.properties.sd]=f;});
    var counts={}; districts.forEach(function(f){counts[f.properties.st]=(counts[f.properties.st]||0)+1;});
    var dSel=districtsLayer.selectAll('path.dd-d').data(districts).enter().append('path').attr('class','dd-d').attr('d',path)
      .classed('current',function(d){ return focusDistrict && d.properties.sd===focusDistrict; });
    bordersLayer.selectAll('path.dd-s').data(states).enter().append('path').attr('class','dd-s').attr('d',path);
    var hitSel=hitLayer.selectAll('path.dd-statehit').data(states).enter().append('path').attr('class','dd-statehit').attr('d',path);
    var selected=null;

    function labelFor(f){
      var st=f.properties.st, num=f.properties.sd.split('-')[1], name=STATE_NAMES[st]||st;
      return counts[st]===1 ? (name+' \\u2014 At-large') : (name+' '+ord(parseInt(num,10))+' District');
    }
    function showTip(ev,text){ var r=el.getBoundingClientRect(); tip.textContent=text; tip.style.left=(ev.clientX-r.left)+'px'; tip.style.top=(ev.clientY-r.top)+'px'; tip.classList.add('show'); }
    function hideTip(){ tip.classList.remove('show'); }
    function setStateHot(st,on){ dSel.filter(function(d){return d.properties.st===st;}).classed('hot',on); }

    // Which layer receives pointer events depends on the mode: pick a state
    // first (hit layer), then pick a district within it (districts layer).
    function applyMode(){
      if(selected){
        dSel.classed('dim',function(d){return d.properties.st!==selected;})
            .classed('live',function(d){return d.properties.st===selected;});
        hitLayer.style('pointer-events','none');
        districtsLayer.style('pointer-events','all');
      } else {
        dSel.classed('dim',false).classed('live',false).classed('hot',false);
        hitLayer.style('pointer-events','all');
        districtsLayer.style('pointer-events','none');
      }
    }

    // National view: hover highlights a whole state, click zooms to it.
    hitSel.on('mousemove',function(ev,d){ showTip(ev, STATE_NAMES[d.properties.st]||d.properties.st); })
          .on('mouseenter',function(ev,d){ setStateHot(d.properties.st,true); })
          .on('mouseleave',function(ev,d){ setStateHot(d.properties.st,false); hideTip(); })
          .on('click',function(ev,d){ zoomToState(d.properties.st); });

    // State view: hover highlights one district, click opens its profile.
    dSel.on('mousemove',function(ev,d){ if(selected===d.properties.st) showTip(ev,labelFor(d)); })
        .on('mouseenter',function(ev,d){ if(selected===d.properties.st) d3.select(this).raise().classed('hot',true); })
        .on('mouseleave',function(ev,d){ d3.select(this).classed('hot',false); hideTip(); })
        .on('click',function(ev,d){ if(selected===d.properties.st && d.properties.sd!==focusDistrict) window.location.href='/district/'+d.properties.sd.toLowerCase()+'/'; });

    // Zoom/pan via d3.zoom; wheel disabled so the page still scrolls over the map.
    var zoom=d3.zoom().scaleExtent([1,160]).on('zoom',function(ev){ g.attr('transform',ev.transform); });
    svg.call(zoom).on('wheel.zoom',null).on('dblclick.zoom',null);

    // fill = fraction of the viewport the bbox should occupy (states get more
    // context, a single district is framed tighter).
    function transformFor(b, fill){
      fill=fill||0.9;
      var bw=b[1][0]-b[0][0], bh=b[1][1]-b[0][1], cx=(b[0][0]+b[1][0])/2, cy=(b[0][1]+b[1][1])/2;
      var k=Math.max(1, Math.min(160, fill*Math.min(W/bw, H/bh)));
      return d3.zoomIdentity.translate(W/2,H/2).scale(k).translate(-cx,-cy);
    }
    // Swap in unsimplified per-state geometry the first time we zoom to a state,
    // so district boundaries are crisp up close (the national file is heavily
    // simplified). Cached; the state outline is re-merged from the detail arcs.
    var detailDone={};
    function upgradeDetail(st){
      if(detailDone[st]) return; detailDone[st]=true;
      d3.json('/districts-detail/'+st.toLowerCase()+'.topojson?v=` + DETAIL_V + `').then(function(topo){
        var obj=topo.objects[Object.keys(topo.objects)[0]];
        var byId={}; topojson.feature(topo,obj).features.forEach(function(f){ byId[f.properties.sd]=f; });
        dSel.filter(function(d){return d.properties.st===st;}).each(function(d){ if(byId[d.properties.sd]) d3.select(this).attr('d', path(byId[d.properties.sd])); });
        var outline=topojson.merge(topo, obj.geometries);
        bordersLayer.selectAll('path.dd-s').filter(function(d){return d.properties.st===st;}).attr('d', path(outline));
      }).catch(function(){ detailDone[st]=false; });
    }
    // Programmatic zoom is applied instantly (svg.call(zoom.transform)): d3's
    // own zoom transitions stall unpredictably when mixed with an instant set on
    // mount, so we snap rather than animate — reliable and predictable.
    function applyZoom(T){ svg.call(zoom.transform, T); }
    function zoomToState(st, instant){
      selected=st; setStateHot(st,false); applyMode(); upgradeDetail(st);
      back.classList.add('show'); titleEl.textContent=STATE_NAMES[st]||st; hideTip();
      applyZoom(transformFor(path.bounds(stateFeat[st])), instant);
    }
    // Frame a single district (used on profile pages): its state's districts
    // stay selectable, but the view opens on the district's own extent.
    function zoomToDistrict(sd, instant){
      var f=distFeat[sd]; if(!f){ return; }
      var st=f.properties.st;
      selected=st; setStateHot(st,false); applyMode(); upgradeDetail(st);
      back.classList.add('show'); titleEl.textContent=STATE_NAMES[st]||st; hideTip();
      applyZoom(transformFor(path.bounds(f), 0.72), instant);
    }
    function fit(){
      selected=null; applyMode();
      back.classList.remove('show'); titleEl.textContent=''; hideTip();
      applyZoom(d3.zoomIdentity);
    }
    back.addEventListener('click',fit);
    el.addEventListener('mouseleave',hideTip);

    // Zoom in/out around the viewport centre, respecting the scale extent.
    function zoomBy(f){
      var c=d3.zoomTransform(svg.node()), nk=Math.max(1,Math.min(160,c.k*f));
      var cx=(W/2-c.x)/c.k, cy=(H/2-c.y)/c.k;
      applyZoom(d3.zoomIdentity.translate(W/2-nk*cx, H/2-nk*cy).scale(nk));
    }
    // Zoom buttons (reused from the game).
    Array.prototype.forEach.call(wrap.querySelectorAll('.mzb'),function(b){
      b.addEventListener('click',function(){
        var z=b.getAttribute('data-zoom');
        if(z==='in') zoomBy(1.6);
        else if(z==='out') zoomBy(1/1.6);
        else fit();
      });
    });

    applyMode();
    // A district profile opens framed on its own district; falls back to the
    // whole state (e.g. at-large) if the district isn't found.
    if(focusDistrict && distFeat[focusDistrict]){ zoomToDistrict(focusDistrict, true); }
    else if(focusState && stateFeat[focusState]){ zoomToState(focusState, true); }
  }).catch(function(){ if(el&&el.parentNode)el.parentNode.classList.add('dd-map-failed'); });
  }
  // Only load geometry + render once the map is near the viewport (profile maps
  // sit below the fold); fires immediately when already in view (browse hub).
  if('IntersectionObserver' in window){
    var io=new IntersectionObserver(function(es){ if(es.some(function(e){return e.isIntersecting;})){ io.disconnect(); init(); } }, { rootMargin: '300px' });
    io.observe(el);
  } else { init(); }
})();`;
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

// Shared interactive-map client, loaded by the browse hub and every profile.
writeFileSync(join(ROOT, 'district-map.js'), mapClientJs());

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
Disallow: /loaders/

Sitemap: ${SITE}/sitemap.xml
`);

console.log(`Generated ${count} district pages + browse index.`);
console.log(`Sitemap: ${urls.length} URLs. robots.txt written.`);
