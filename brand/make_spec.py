#!/usr/bin/env python3
"""Assemble brand/spec.html — the presentation sheet for the logo system.

Small-size renders are embedded as base64 of the ACTUAL rasters build.py produces, not
as scaled-down vectors. A scaled vector always looks fine; only a real 16px raster
tells you whether the mark survives.
"""
import base64
import os
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
PX = os.path.join(HERE, "dist", "px")
os.makedirs(PX, exist_ok=True)

import build as B  # noqa: E402  — one source of geometry

RED, INK, NAVY, CREAM = B.RED, B.INK, B.NAVY, B.CREAM
G = B.G


def render(src, name, size, height=None):
    subprocess.run(["inkscape", os.path.join(HERE, src), "-w", str(size),
                    "-h", str(height or size), "-o", os.path.join(PX, name)],
                   capture_output=True, check=True)
    return os.path.join(PX, name)


def b64(path):
    return "data:image/png;base64," + base64.b64encode(open(path, "rb").read()).decode()


SMALL = {s: b64(render("favicon.svg", f"s{s}.png", s)) for s in (16, 20, 24, 32)}
DISPLAY = {s: b64(render("favicon-display-flat.svg", f"d{s}.png", s))
           for s in (16, 20, 24, 32, 48, 64)}
TILE192 = b64(render("icon-tile.svg", "t192.png", 192))
IOS180 = b64(render("icon-ios.svg", "i180.png", 180))
MASK = b64(render("icon-maskable.svg", "mask.png", 192))


def mark(fill, cut="display", radius=B.RADIUS):
    return (f'<svg viewBox="0 0 {G:g} {G:g}" fill="{fill}" aria-hidden="true">'
            f'<path fill-rule="evenodd" d="{B.mark_path(G, cut=cut, radius=radius)}"/>'
            f'</svg>')


def construction_svg(seam, ch, label):
    """The mark as a technical drawing: grid visible through a washed fill, with the
    channel dimensioned across a vertical run near the top."""
    c = 24.0
    ox, oy = 34.0, 30.0
    w, h = ox * 2 + G * c, oy * 2 + G * c
    lines = []
    for i in range(int(G) + 1):
        x = ox + i * c
        y = oy + i * c
        lines.append(f'<line x1="{x:.0f}" y1="{oy:.0f}" x2="{x:.0f}" '
                     f'y2="{oy + G * c:.0f}"/>')
        lines.append(f'<line x1="{ox:.0f}" y1="{y:.0f}" x2="{ox + G * c:.0f}" '
                     f'y2="{y:.0f}"/>')

    dy = oy + 1.4 * c
    x1, x2 = ox + (seam[0][0] - ch / 2) * c, ox + (seam[0][0] + ch / 2) * c
    dim = (f'<line x1="{x1:.0f}" y1="{dy:.0f}" x2="{x2:.0f}" y2="{dy:.0f}"/>'
           f'<line x1="{x1:.0f}" y1="{dy - 6:.0f}" x2="{x1:.0f}" y2="{dy + 6:.0f}"/>'
           f'<line x1="{x2:.0f}" y1="{dy - 6:.0f}" x2="{x2:.0f}" y2="{dy + 6:.0f}"/>'
           f'<text x="{(x1 + x2) / 2:.0f}" y="{dy - 14:.0f}" text-anchor="middle">'
           f'{ch}</text>')

    return f'''<svg viewBox="0 0 {w:.0f} {h:.0f}" class="cons" aria-hidden="true">
  <g class="grid">{''.join(lines)}</g>
  <path class="fill" fill-rule="evenodd" vector-effect="non-scaling-stroke"
        d="{B.mark_path(G * c, ox, oy, cut=label, radius=0)}"/>
  <g class="dim">{dim}</g>
</svg>'''


LOCKUP = B.lockup_horizontal(RED, "var(--ink)")
LOCKUP_STACK = B.lockup_stacked(RED, "var(--ink)")

HTML = f'''<title>Daily District — Logo System</title>
<style>
  :root {{
    --ground:#F4F3F1; --panel:#FFFFFF; --ink:#15171B; --muted:#7B7378;
    --rule:#E3DFDA; --red:{RED}; --navy:{NAVY}; --grid:#D8D3CC;
    --mono:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,monospace;
    --sans:ui-sans-serif,-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif;
  }}
  @media (prefers-color-scheme:dark) {{
    :root {{ --ground:#131417; --panel:#1B1D22; --ink:#ECEAE7; --muted:#8E868C;
             --rule:#2C2F36; --red:#FF3B57; --navy:#9FB4D6; --grid:#33373F; }}
  }}
  :root[data-theme="dark"] {{ --ground:#131417; --panel:#1B1D22; --ink:#ECEAE7;
    --muted:#8E868C; --rule:#2C2F36; --red:#FF3B57; --navy:#9FB4D6; --grid:#33373F; }}
  :root[data-theme="light"] {{ --ground:#F4F3F1; --panel:#FFFFFF; --ink:#15171B;
    --muted:#7B7378; --rule:#E3DFDA; --red:{RED}; --navy:{NAVY}; --grid:#D8D3CC; }}

  body {{ background:var(--ground); color:var(--ink); font-family:var(--sans);
         line-height:1.55; -webkit-font-smoothing:antialiased; }}
  .wrap {{ max-width:1000px; margin:0 auto; padding:64px 28px 120px;
           display:flex; flex-direction:column; gap:76px; }}
  h1,h2 {{ text-wrap:balance; margin:0; }}
  h1 {{ font-size:clamp(2.3rem,5.2vw,3.5rem); font-weight:800; letter-spacing:-.028em;
        line-height:1.04; }}
  h2 {{ font-size:1.32rem; font-weight:700; letter-spacing:-.012em; }}
  p {{ margin:0; max-width:64ch; }}
  .lede {{ font-size:1.12rem; color:var(--muted); }}
  .note {{ font-size:.9rem; color:var(--muted); }}
  .eyebrow {{ font-family:var(--mono); font-size:.7rem; letter-spacing:.14em;
              text-transform:uppercase; color:var(--red); }}
  section {{ display:flex; flex-direction:column; gap:22px; }}
  .head {{ display:flex; flex-direction:column; gap:7px;
           border-top:1px solid var(--rule); padding-top:16px; }}
  .panel {{ background:var(--panel); border:1px solid var(--rule); border-radius:6px; }}

  .hero {{ display:grid; grid-template-columns:minmax(0,1fr) auto; gap:52px;
           align-items:center; }}
  .hero .mk {{ width:190px; }}
  .hero .mk svg {{ display:block; width:100%; height:auto; }}
  @media (max-width:720px) {{ .hero {{ grid-template-columns:1fr; gap:34px; }}
                              .hero .mk {{ width:138px; }} }}

  .cons {{ width:100%; height:auto; display:block; }}
  .cons .grid line {{ stroke:var(--grid); stroke-width:1; }}
  .cons .fill {{ fill:var(--red); fill-opacity:.15; stroke:var(--red);
                 stroke-width:2; }}
  .cons .dim line {{ stroke:var(--ink); stroke-width:1.4; }}
  .cons .dim text {{ font-family:var(--mono); font-size:12px; fill:var(--ink); }}
  .cuts {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(250px,1fr));
           gap:22px; }}
  .cut {{ padding:18px; display:flex; flex-direction:column; gap:10px; }}
  .cut .cap {{ font-family:var(--mono); font-size:.68rem; color:var(--muted);
               letter-spacing:.08em; text-transform:uppercase; }}

  .ladder {{ display:flex; gap:26px; flex-wrap:wrap; align-items:flex-end; }}
  .rung {{ display:flex; flex-direction:column; align-items:center; gap:11px; }}
  .rung .true {{ display:flex; align-items:center; justify-content:center; height:66px; }}
  .rung img.mag {{ image-rendering:pixelated; border:1px solid var(--rule);
                   border-radius:3px; background:var(--panel); }}
  .rung .cap {{ font-family:var(--mono); font-size:.7rem; color:var(--muted); }}
  .vs {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr));
         gap:22px; }}

  .mocks {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(258px,1fr));
            gap:22px; }}
  .mock {{ padding:20px; display:flex; flex-direction:column; gap:14px; }}
  .mock .cap {{ font-family:var(--mono); font-size:.68rem; color:var(--muted);
                letter-spacing:.08em; text-transform:uppercase; }}
  .tabbar {{ background:var(--ground); border:1px solid var(--rule);
             border-radius:8px 8px 0 0; padding:9px 9px 0; }}
  .tab {{ background:var(--panel); border:1px solid var(--rule); border-bottom:none;
          border-radius:7px 7px 0 0; padding:7px 13px; display:flex; gap:8px;
          align-items:center; font-size:.78rem; width:max-content; max-width:100%; }}
  .tab img {{ width:16px; height:16px; flex:none; }}
  .springboard {{ background:linear-gradient(150deg,#2B3550,#141A28); border-radius:14px;
                  padding:24px; display:flex; gap:20px; }}
  .app {{ display:flex; flex-direction:column; align-items:center; gap:7px; width:62px; }}
  .app img {{ width:62px; height:62px; border-radius:14px; display:block; }}
  .app .nm {{ font-size:.62rem; color:#fff; opacity:.92; text-align:center; }}
  .app.ghost .sq {{ background:#ffffff1f; border-radius:14px; width:62px; height:62px; }}
  .appbar {{ display:flex; align-items:center; gap:10px; padding:11px 14px;
             border:1px solid var(--rule); border-radius:8px; background:var(--panel); }}
  .appbar .lk {{ height:24px; }}
  .appbar .lk svg {{ height:100%; width:auto; display:block; }}
  .appbar .sp {{ margin-left:auto; display:flex; gap:6px; }}
  .appbar .dot {{ width:9px; height:9px; border-radius:50%; background:var(--rule); }}

  .lockups {{ display:flex; flex-direction:column; gap:16px; }}
  .lk-row {{ padding:26px; display:flex; align-items:center; gap:20px; }}
  .lk-row svg {{ height:44px; width:auto; max-width:100%; display:block; }}
  .lk-row.stack svg {{ height:120px; }}
  .lk-row .tag {{ margin-left:auto; font-family:var(--mono); font-size:.68rem;
                  color:var(--muted); text-align:right; }}

  .swatches {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr));
               gap:14px; }}
  .sw {{ border-radius:6px; overflow:hidden; border:1px solid var(--rule); }}
  .sw .chip {{ aspect-ratio:1; display:grid; place-items:center; }}
  .sw .chip svg {{ width:56%; height:auto; }}
  .sw .lbl {{ padding:9px 11px; font-family:var(--mono); font-size:.67rem;
              color:var(--muted); background:var(--panel); }}

  table {{ border-collapse:collapse; width:100%; font-size:.86rem; }}
  th,td {{ text-align:left; padding:9px 12px; border-bottom:1px solid var(--rule);
           vertical-align:top; }}
  th {{ font-family:var(--mono); font-size:.68rem; text-transform:uppercase;
        letter-spacing:.1em; color:var(--muted); font-weight:500; }}
  td.f {{ font-family:var(--mono); font-size:.78rem; white-space:nowrap; }}
  .scroll {{ overflow-x:auto; }}
</style>

<div class="wrap">

  <header class="hero">
    <div>
      <div class="eyebrow">Logo system</div>
      <h1>One square, two districts.</h1>
      <p class="lede" style="margin-top:14px">The mark depicts <em>districting</em> —
      the act of drawing the line — rather than depicting a district. Every jog is a
      right angle on a 12&times;12 cell grid, because congressional districts are
      assembled from census blocks and real boundaries are all right angles and jogs.
      Because every edge lands on a whole cell, it rasterises cleanly instead of
      mushing.</p>
    </div>
    <div class="mk">{mark("var(--red)")}</div>
  </header>

  <section>
    <div class="head">
      <div class="eyebrow">Construction</div>
      <h2>One path, and the seam is a hole</h2>
    </div>
    <div class="cuts">
      <div class="panel cut">
        <div class="cap">Display cut &middot; 3 jogs &middot; 1.6 channel</div>
        {construction_svg(B.SEAM_DISPLAY, B.CH_DISPLAY, "display")}
      </div>
      <div class="panel cut">
        <div class="cap">Small cut &middot; 2 jogs &middot; 2.6 channel</div>
        {construction_svg(B.SEAM_SMALL, B.CH_SMALL, "small")}
      </div>
    </div>
    <p>The mark is built as a single path: the square, plus the channel as an
    even&#8209;odd hole. That means the seam is always <em>transparent</em>, so one
    file is correct on a light page, a dark page, or a photo — the channel simply
    picks up whatever sits behind it. Only the outer corner radius changes between the
    bare logo, the app tile and the maskable icon.</p>
    <p class="note">Kept strictly upright. A prior diagonal variant turned the square
    into a diamond with bent segments radiating from its centre and was pulled
    immediately after it was flagged as reading too close to a hate symbol — never
    rotate this mark or angle the outer square, regardless of how the seam itself is
    drawn.</p>
  </section>

  <section>
    <div class="head">
      <div class="eyebrow">Optical sizes</div>
      <h2>The small cut is redrawn, not shrunk</h2>
    </div>
    <p>The mark carries its meaning in an interior seam, and interior detail is the
    first thing lost when a mark is rasterised small. So there are two cuts, the way a
    type family has optical sizes. Below 32px the display cut's three jogs collapse
    into mush; the small cut drops to two jogs and widens the channel to compensate.
    A one&#8209;jog cut was tried and rejected — it loses the interlock and reads as
    two bars.</p>
    <div class="vs">
      <div class="panel mock">
        <div class="cap">Display cut below 32px &mdash; muddy</div>
        <div class="ladder">
          {''.join(f"""<div class="rung">
            <img class="mag" src="{DISPLAY[s]}" width="72" height="72" alt="">
            <div class="cap">{s}px</div></div>""" for s in (16, 20, 24))}
        </div>
      </div>
      <div class="panel mock">
        <div class="cap">Small cut &mdash; holds</div>
        <div class="ladder">
          {''.join(f"""<div class="rung">
            <img class="mag" src="{SMALL[s]}" width="72" height="72" alt="">
            <div class="cap">{s}px</div></div>""" for s in (16, 20, 24))}
        </div>
      </div>
    </div>
    <p class="note">Real PNGs at those pixel sizes, magnified — not scaled vectors.
    The <code>.ico</code> uses the small cut for its 16/24/32 frames and the display
    cut from 48px up.</p>
  </section>

  <section>
    <div class="head">
      <div class="eyebrow">Scale</div>
      <h2>Display cut, true size</h2>
    </div>
    <div class="ladder">
      {''.join(f"""<div class="rung">
        <div class="true"><img src="{DISPLAY[s]}" width="{s}" height="{s}" alt=""></div>
        <img class="mag" src="{DISPLAY[s]}" width="72" height="72" alt="">
        <div class="cap">{s}px</div>
      </div>""" for s in (24, 32, 48, 64))}
    </div>
  </section>

  <section>
    <div class="head">
      <div class="eyebrow">In place</div>
      <h2>Where it has to hold up</h2>
    </div>
    <div class="mocks">
      <div class="panel mock">
        <div class="cap">Browser tab &middot; 16px small cut</div>
        <div class="tabbar"><div class="tab">
          <img src="{SMALL[16]}" alt=""><span>Daily District</span>
        </div></div>
      </div>
      <div class="panel mock">
        <div class="cap">iOS home screen &middot; 180px</div>
        <div class="springboard">
          <div class="app"><img src="{IOS180}" alt=""><div class="nm">Daily District</div></div>
          <div class="app ghost"><div class="sq"></div></div>
        </div>
      </div>
      <div class="panel mock">
        <div class="cap">Android maskable &middot; safe circle</div>
        <div style="display:flex;gap:14px;align-items:center">
          <img src="{MASK}" width="76" height="76" style="border-radius:50%" alt="">
          <img src="{MASK}" width="76" height="76" style="border-radius:18px" alt="">
        </div>
      </div>
      <div class="panel mock">
        <div class="cap">Site header</div>
        <div class="appbar">
          <span class="lk">{LOCKUP}</span>
          <span class="sp"><i class="dot"></i><i class="dot"></i><i class="dot"></i></span>
        </div>
      </div>
    </div>
    <p class="note">The maskable icon is sized to sit entirely inside Android's 80%
    safe circle. A full-bleed version would have its seam clipped top and bottom,
    visually rejoining the two districts and destroying the whole idea.</p>
  </section>

  <section>
    <div class="head">
      <div class="eyebrow">Lockups</div>
      <h2>Mark with wordmark</h2>
    </div>
    <div class="lockups">
      <div class="panel lk-row">{LOCKUP}<span class="tag">Primary<br>lockup-horizontal-red.svg</span></div>
      <div class="panel lk-row stack">{LOCKUP_STACK}<span class="tag">Stacked<br>lockup-stacked-red.svg</span></div>
    </div>
  </section>

  <section>
    <div class="head">
      <div class="eyebrow">Colour &middot; existing tokens only</div>
      <h2>No new brand colours</h2>
    </div>
    <p>Every value is already in <code>style.css</code>. On dark grounds the red lifts
    to <code>#FF3B57</code>, because <code>#C41230</code> goes muddy below about 20%
    ground luminance — a rendering correction rather than a new brand colour.</p>
    <div class="swatches">
      <div class="sw"><div class="chip" style="background:{CREAM}">{mark(RED)}</div>
        <div class="lbl">--bg &middot; {CREAM}</div></div>
      <div class="sw"><div class="chip" style="background:{RED}">{mark(CREAM)}</div>
        <div class="lbl">--cmu-red &middot; {RED}</div></div>
      <div class="sw"><div class="chip" style="background:{NAVY}">{mark(CREAM)}</div>
        <div class="lbl">--cmu-navy &middot; {NAVY}</div></div>
      <div class="sw"><div class="chip" style="background:{INK}">{mark("#FF3B57")}</div>
        <div class="lbl">dark ground &middot; #FF3B57</div></div>
    </div>
  </section>

  <section>
    <div class="head">
      <div class="eyebrow">Rules</div>
      <h2>Clear space and minimum sizes</h2>
    </div>
    <div class="scroll"><table>
      <tr><th>Rule</th><th>Value</th><th>Why</th></tr>
      <tr><td>Clear space</td><td class="f">1 cell = mark size / 12</td>
          <td>The seam needs breathing room or it reads as part of the neighbour.</td></tr>
      <tr><td>Minimum, small cut</td><td class="f">16px</td>
          <td>Below this the 2.6-cell channel drops under 2px and the halves fuse.</td></tr>
      <tr><td>Switch cuts at</td><td class="f">32px</td>
          <td>Display cut above, small cut at and below.</td></tr>
      <tr><td>Minimum, full lockup</td><td class="f">120px wide</td>
          <td>Set by the wordmark's counters, not the mark.</td></tr>
      <tr><td>Never</td><td class="f">&mdash;</td>
          <td>Rotate it, fill the channel with a solid colour instead of leaving it
              open, or re-space the jogs. The seam is the mark.</td></tr>
    </table></div>
  </section>

  <section>
    <div class="head">
      <div class="eyebrow">Files &middot; brand/</div>
      <h2>What's in the kit</h2>
    </div>
    <div class="scroll"><table>
      <tr><th>File</th><th>Use</th></tr>
      <tr><td class="f">mark.svg</td><td><code>currentColor</code>, display cut — inline in HTML.</td></tr>
      <tr><td class="f">mark-red.svg</td><td>Baked red, for <code>&lt;img src&gt;</code>. This is what the site's <code>logo.svg</code> now is.</td></tr>
      <tr><td class="f">mark-small.svg</td><td>Small cut, for use at or below 32px.</td></tr>
      <tr><td class="f">favicon.svg</td><td>Small cut; answers the browser's dark mode.</td></tr>
      <tr><td class="f">icon-tile.svg</td><td>PWA icons, rounded tile.</td></tr>
      <tr><td class="f">icon-ios.svg</td><td>Full-bleed; iOS applies its own squircle.</td></tr>
      <tr><td class="f">icon-maskable.svg</td><td>Android maskable, inside the 80% safe circle.</td></tr>
      <tr><td class="f">lockup-*.svg</td><td>Horizontal and stacked; red, reversed, currentColor.</td></tr>
      <tr><td class="f">og-image.svg</td><td>1200&times;630 social card.</td></tr>
      <tr><td class="f">dist/</td><td>Rendered PNGs plus a 6-frame favicon.ico (16&ndash;128).</td></tr>
      <tr><td class="f">build.py</td><td>Regenerates everything above from one seam definition.</td></tr>
    </table></div>
  </section>

</div>
'''

ASCII_SAFE = "".join(c if ord(c) < 128 else f"&#{ord(c)};" for c in HTML)
out = os.path.join(HERE, "spec.html")
with open(out, "w", encoding="utf-8") as f:
    f.write(ASCII_SAFE)
print("wrote", out, len(ASCII_SAFE), "bytes")
