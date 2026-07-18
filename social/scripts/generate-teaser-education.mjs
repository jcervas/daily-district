// ============================================================
// generate-teaser-education.mjs
// Emits social/teaser-education.html — a second pre-launch teaser in the SAME
// looping CSS/JS motion-graphic technique as the live one on daily-district.com
// (the ".mp" block in index.html), but themed on the game's EDUCATIONAL value:
// learn all 435 districts by shape, place, and the facts behind them.
//
// Four looping scenes: intro → silhouette (swaps each loop) → District Profile
// facts card → CTA. Self-contained except Barlow via Google Fonts (same as the
// live teaser). Add #intro / #sil / #facts / #cta to the URL to freeze a scene.
//
//   node social/scripts/generate-teaser-education.mjs
// ============================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { geoAlbersUsa, geoPath, geoArea } from 'd3-geo';
import * as topojson from 'topojson-client';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..'); // repo root (script lives in social/scripts/)

// Districts shown in the morphing silhouette scene (varied, recognisable shapes).
const SIL_IDS = ['LA-02', 'IL-03', 'TX-07', 'MD-06', 'CA-38'];

// ── Geometry → silhouette path in a 300×220 box ──────────────────────────────
function fitFeatureOf(feature) {
  const g = feature.geometry;
  if (g && g.type === 'MultiPolygon') {
    const largest = g.coordinates.reduce((best, poly) =>
      geoArea({ type: 'Feature', geometry: { type: 'Polygon', coordinates: poly } }) >
      geoArea({ type: 'Feature', geometry: { type: 'Polygon', coordinates: best } }) ? poly : best);
    return { type: 'Feature', geometry: { type: 'Polygon', coordinates: largest } };
  }
  return feature;
}
function silPath(feature) {
  const proj = geoAlbersUsa().fitExtent([[12, 12], [288, 208]], fitFeatureOf(feature));
  return geoPath(proj)(feature);
}

// ── Wordmark inner markup (keeps fill="currentColor") ────────────────────────
function wordmarkInner() {
  const raw = fs.readFileSync(path.join(DIR, 'wordmark.svg'), 'utf8');
  return raw.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>[\s\S]*$/, '').trim();
}

// ── Build ─────────────────────────────────────────────────────────────────────
const topo = JSON.parse(fs.readFileSync(path.join(DIR, 'districts-core.topojson'), 'utf8'));
const features = topojson.feature(topo, topo.objects.districts).features;
const byId = id => features.find(f => f.properties['state-district'] === id);
const sils = SIL_IDS.map(id => silPath(byId(id))).filter(Boolean);
const silDefs = sils.map((d, i) => `<path id="mp-s${i}" d="${d}"/>`).join('\n        ');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Daily District — Learn every district</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;600;700;800;900&display=swap" rel="stylesheet" />
<style>
  :root { --red:#C41230; --ink:#1a1a1a; --muted:#565a63; --bg:#f5f5f3; --card:#fff; }
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body { height:100%; }
  body { font-family:'Barlow','Helvetica Neue',sans-serif; background:
         radial-gradient(120% 90% at 50% 0%, #fff 0%, #f2ecef 100%); color:var(--ink);
         display:grid; place-items:center; padding:32px 18px; }
  .teaser-card { width:100%; max-width:560px; text-align:center; }
  .teaser-logo { width:76px; height:auto; margin:0 auto 6px; display:block; }
  .teaser-eyebrow { font-weight:800; letter-spacing:.16em; text-transform:uppercase;
                    font-size:13px; color:var(--red); }
  .teaser-headline { font-weight:900; font-size:clamp(30px,7vw,44px); line-height:1.02; margin:6px 0 10px; }
  .teaser-sub { font-weight:600; font-size:clamp(14px,3.6vw,17px); line-height:1.45; color:var(--muted);
                max-width:460px; margin:0 auto; }

  /* ── Motion promo (".mp") — self-contained looping teaser ─────────────── */
  .teaser-art { margin:22px auto 20px; }
  .mp { position:relative; width:100%; max-width:520px; aspect-ratio:16/10; margin:0 auto;
        border-radius:22px; overflow:hidden; background:var(--card);
        box-shadow:0 20px 55px rgba(24,44,75,.14); }
  .mp-floaters { position:absolute; inset:0; overflow:hidden; pointer-events:none; opacity:0; transition:opacity .3s; }
  .mp-floater { position:absolute; display:flex; align-items:center; gap:7px; padding:6px 11px; border-radius:999px;
                background:#fff; box-shadow:0 6px 16px rgba(24,44,75,.12); font-weight:700; font-size:12px;
                color:#70707a; white-space:nowrap; will-change:transform,opacity; }
  .mp-floater i { width:9px; height:9px; border-radius:3px; background:rgba(196,18,48,.55); display:block; }
  .mp-scene { position:absolute; inset:0; display:grid; place-items:center; opacity:0; }
  .mp-wrap { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px;
             padding:0 26px; text-align:center; }
  .mp [data-anim] { opacity:0; will-change:transform,opacity; }
  .mp-wordmark { color:var(--red); width:min(62%,240px); }
  .mp-wordmark svg { display:block; width:100%; height:auto; }
  .mp-sub { font-weight:700; color:#6b6b74; font-size:clamp(14px,3.6vw,19px); line-height:1.2; }
  .mp-sub b { color:var(--red); }
  .mp-tag { font-weight:800; letter-spacing:.14em; text-transform:uppercase; color:var(--red);
            font-size:clamp(10px,2.5vw,12.5px); }
  .mp-kicker { font-weight:800; letter-spacing:.16em; text-transform:uppercase; color:#fff; background:var(--red);
               border-radius:999px; padding:6px 16px; font-size:clamp(10px,2.4vw,12px); }
  .mp-sil { width:clamp(120px,34vw,168px); height:auto; filter:drop-shadow(0 12px 22px rgba(196,18,48,.26)); }
  .mp-sil path { fill:var(--red); }

  /* District Profile facts card (educational scene) */
  .mp-profile { background:var(--bg); border:2px solid #e7e2e4; border-radius:18px; padding:20px 22px;
                width:min(80%,380px); box-shadow:0 10px 26px rgba(24,44,75,.10); }
  .mp-profile .pl { font-weight:800; letter-spacing:.14em; text-transform:uppercase; font-size:11px; color:var(--red); }
  .mp-profile .ph { font-weight:900; font-size:clamp(19px,4.6vw,25px); margin:3px 0 14px; }
  .mp-stats { display:flex; flex-direction:column; gap:9px; }
  .mp-stat { display:flex; align-items:center; gap:11px; text-align:left; }
  .mp-stat b { font-weight:900; color:var(--red); font-size:17px; min-width:118px; }
  .mp-stat span { font-weight:600; color:var(--muted); font-size:14.5px; }

  .teaser-cta { display:inline-block; margin-top:4px; font-weight:800; font-size:clamp(15px,3.6vw,18px);
                color:#fff; background:var(--red); border-radius:999px; padding:15px 30px; text-decoration:none; }
  .teaser-cta:hover { filter:brightness(1.07); }
  .teaser-follow { margin:16px 0 0; font-size:14px; color:var(--muted); }
  .teaser-follow a { color:var(--red); text-decoration:none; font-weight:700; }
  .teaser-follow a:hover { text-decoration:underline; }

  @media (prefers-reduced-motion: reduce) {
    .mp-scene[data-scene="intro"] { opacity:1; }
    .mp-scene[data-scene="intro"] [data-anim] { opacity:1; transform:none; }
  }
</style>
</head>
<body>
<main class="teaser-card">
  <p class="teaser-eyebrow">Learn the map</p>
  <h1 class="teaser-headline">Know every district</h1>
  <p class="teaser-sub">A free daily game — and a crash course in the U.S. House. Learn all 435 congressional
     districts by shape, by place, and by the facts behind them.</p>

  <div class="teaser-art">
    <div class="mp" id="mp" role="img" aria-label="Daily District — learn all 435 U.S. House districts by shape, place, and the facts behind them">
      <div class="mp-floaters" id="mp-floaters"></div>

      <div class="mp-scene" data-scene="intro">
        <div class="mp-wrap">
          <span class="mp-wordmark" data-anim="pop" data-d="0.10">
            <svg viewBox="0 0 260 56" role="img" aria-label="Daily District">${wordmarkInner()}</svg>
          </span>
          <span class="mp-sub" data-anim="rise" data-d="0.34">Learn all <b>435 U.S. House districts.</b></span>
        </div>
      </div>

      <div class="mp-scene" data-scene="sil">
        <div class="mp-wrap">
          <svg class="mp-sil" data-anim="pop" data-d="0.08" viewBox="0 0 300 220" aria-hidden="true"><path id="mp-sil-path" d="${sils[0]}"/></svg>
          <span class="mp-tag" data-anim="rise" data-d="0.42">See the shape · Learn the place</span>
        </div>
      </div>

      <div class="mp-scene" data-scene="facts">
        <div class="mp-wrap">
          <div class="mp-profile" data-anim="pop" data-d="0.08">
            <div class="pl">District Profile</div>
            <div class="ph">Every district, explained</div>
            <div class="mp-stats">
              <div class="mp-stat" data-anim="rise" data-d="0.30"><b>~761,000</b><span>people represented</span></div>
              <div class="mp-stat" data-anim="rise" data-d="0.44"><b>1 of 435</b><span>seats in the House</span></div>
              <div class="mp-stat" data-anim="rise" data-d="0.58"><b>every 10 yrs</b><span>redrawn after the census</span></div>
            </div>
          </div>
        </div>
      </div>

      <div class="mp-scene" data-scene="cta">
        <div class="mp-wrap">
          <span class="mp-kicker" data-anim="pop" data-d="0.10">Go deeper</span>
          <span class="mp-sub" data-anim="rise" data-d="0.32">Explore <b>every district profile.</b></span>
        </div>
      </div>
    </div>
    <svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
        ${silDefs}
    </defs></svg>
  </div>

  <a class="teaser-cta" href="/districts/">Explore all 435 district profiles →</a>
  <p class="teaser-follow">Follow <a href="https://x.com/daily_district_" target="_blank" rel="noopener">@daily_district_ on X</a> for launch updates.</p>
</main>

<script>
/* Looping motion-graphic driver — mirrors the live teaser's ".mp" animation.
   Scenes slide/blur in and out; child elements pop/rise; floating district
   chips drift during the intro + cta windows; the silhouette swaps each loop.
   Add #intro / #sil / #facts / #cta to the URL to freeze one scene. */
(function () {
  var mp = document.getElementById('mp');
  if (!mp || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;

  var silPath = document.getElementById('mp-sil-path'), SILS = [];
  for (var i = 0; i < 8; i++) { var p = document.getElementById('mp-s' + i); if (p) SILS.push(p.getAttribute('d')); }

  var floLayer = document.getElementById('mp-floaters'), FLO = [];
  [['OH',8,15],['PA-8',80,11],['FL-27',14,78],['NY-14',84,70],['CA-12',6,48],['TX',86,40],['GA-5',30,86],['AZ-3',72,85]]
    .forEach(function (it, i) {
      var el = document.createElement('div'); el.className = 'mp-floater'; el.innerHTML = '<i></i>' + it[0];
      el.style.left = it[1] + '%'; el.style.top = it[2] + '%';
      floLayer.appendChild(el);
      FLO.push({ el: el, period: 5 + (i % 4) * 1.2, phase: (i * 0.137) % 1, amp: 14 + (i % 3) * 4 });
    });

  var SCENES = [
    { name: 'intro', t0: 0.0,  t1: 3.0,  dir: 1,  ax: 'y' },
    { name: 'sil',   t0: 3.0,  t1: 6.1,  dir: 1,  ax: 'x' },
    { name: 'facts', t0: 6.1,  t1: 9.6,  dir: 1,  ax: 'x' },
    { name: 'cta',   t0: 9.6,  t1: 12.7, dir: -1, ax: 'x' }
  ];
  SCENES.forEach(function (s) {
    s.el = mp.querySelector('.mp-scene[data-scene="' + s.name + '"]');
    s.kids = [].slice.call(s.el.querySelectorAll('[data-anim]')).map(function (n) {
      return { n: n, type: n.dataset.anim, d: parseFloat(n.dataset.d) || 0 };
    });
  });
  var floScenes = { intro: 1, cta: 1 };
  var LOOP = SCENES[SCENES.length - 1].t1;
  var ENTER = 0.5, EXIT = 0.45, TRAVEL = 240, BLUR = 13, CHILD = 0.5;
  var eOut = function (t) { return 1 - Math.pow(1 - t, 3); };
  var eIn  = function (t) { return t * t * t; };
  var cl   = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var lp   = function (a, b, t) { return a + (b - a) * t; };

  // Debug: freeze a scene via URL hash (#intro / #sil / #facts / #cta).
  var freeze = null, hs = SCENES.filter(function (s) { return '#' + s.name === location.hash; })[0];
  if (hs) freeze = (hs.t0 + hs.t1) / 2;

  function revealKids(s, lt) {
    for (var i = 0; i < s.kids.length; i++) {
      var k = s.kids[i], p = eOut(cl((lt - k.d) / CHILD, 0, 1)), tf = '';
      if (k.type === 'pop') tf = 'scale(' + lp(.7, 1, p) + ')';
      else if (k.type === 'rise') tf = 'translateY(' + lp(18, 0, p) + 'px)';
      k.n.style.opacity = p.toFixed(3); k.n.style.transform = tf;
    }
  }

  var start = null, silIdx = -1;
  function frame(ts) {
    if (start === null) start = ts;
    var elapsed = (ts - start) / 1000, t = freeze !== null ? freeze : elapsed % LOOP, loopN = Math.floor(elapsed / LOOP);

    var wantIdx = SILS.length ? (loopN % SILS.length) : 0;
    if (SILS.length && wantIdx !== silIdx) { silIdx = wantIdx; if (silPath) silPath.setAttribute('d', SILS[silIdx]); }

    var cur = SCENES.filter(function (s) { return t >= s.t0 && t < s.t1; })[0];
    var floOn = !!(cur && floScenes[cur.name]);
    floLayer.style.opacity = floOn ? '1' : '0';
    if (floOn) for (var i = 0; i < FLO.length; i++) {
      var f = FLO[i], ph = ((t / f.period) + f.phase) % 1, y = lp(10, -f.amp, ph), op = Math.sin(Math.PI * cl(ph, 0, 1));
      f.el.style.transform = 'translateY(' + y.toFixed(1) + 'px)'; f.el.style.opacity = (op * .68).toFixed(2);
    }

    for (var si = 0; si < SCENES.length; si++) {
      var s = SCENES[si], el = s.el, lt = t - s.t0, dur = s.t1 - s.t0;
      if (t < s.t0 - 0.02 || t >= s.t1 + 0.02) { el.style.opacity = '0'; el.style.filter = 'none'; continue; }
      var x = 0, y = 0, sc = 1, bl = 0, op = 1;
      if (lt < ENTER) {
        var p = eOut(cl(lt / ENTER, 0, 1)), off = (1 - p) * TRAVEL * s.dir;
        if (s.ax === 'x') x = off; else y = off * 0.7;
        sc = 1.08 - 0.08 * p; bl = BLUR * (1 - p); op = cl(p * 1.6, 0, 1);
      } else if (lt > dur - EXIT) {
        var p2 = eIn(cl((lt - (dur - EXIT)) / EXIT, 0, 1)), o2 = -p2 * TRAVEL * s.dir;
        if (s.ax === 'x') x = o2; else y = o2 * 0.7;
        sc = 1 - 0.05 * p2; bl = BLUR * p2; op = cl(1 - p2 * 1.4, 0, 1);
      } else {
        var hp = (lt - ENTER) / (dur - ENTER - EXIT); sc = 1 + 0.025 * hp; y = -5 * hp;
      }
      el.style.opacity = op.toFixed(3);
      el.style.filter = bl > 0.05 ? 'blur(' + bl.toFixed(1) + 'px)' : 'none';
      el.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) scale(' + sc.toFixed(3) + ')';
      revealKids(s, lt);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
</script>
</body>
</html>
`;

const out = path.join(DIR, 'social', 'teaser-education.html');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(`teaser-education.html (${html.length}b) — silhouettes: ${SIL_IDS.join(', ')}`);
