#!/usr/bin/env python3
"""Assemble brand/spec.html — the presentation sheet for the Split-D Polygon logo
system.

Small-size renders are embedded as base64 of the ACTUAL rasters build.py produces, not
as scaled-down vectors. A scaled vector always looks fine; only a real 16px raster tells
you whether the mark survives.
"""
import base64
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
PX = os.path.join(HERE, "dist", "px")
os.makedirs(PX, exist_ok=True)

import build as B  # noqa: E402  — one source of geometry

RED, INK, NAVY, CREAM, WHITE = B.RED, B.INK, B.NAVY, B.CREAM, B.WHITE
RED_LIFT = B.RED_LIFT
G = B.G  # 100-unit grid


def render(src, name, size, height=None):
    B.png(src, name, size, out_dir=PX, height=height)
    return os.path.join(PX, name)


def b64(path):
    return "data:image/png;base64," + base64.b64encode(open(path, "rb").read()).decode()


# Flat red cuts feed the raster ladders (currentColor would render black in a raster).
SMALL = {s: b64(render("favicon-small-red.svg", f"s{s}.png", s))
         for s in (16, 20, 24, 32)}
DISPLAY = {s: b64(render("favicon-display-red.svg", f"d{s}.png", s))
           for s in (16, 20, 24, 32, 48, 64)}
TILE192 = b64(render("app-icon.svg", "t192.png", 192))
IOS180 = b64(render("app-icon.svg", "i180.png", 180))
MASK = b64(render("app-icon-maskable.svg", "mask.png", 192))


def mark(color, cut=B.DISPLAY):
    """The mark inline, in one colour, at the sheet's own tokens."""
    return (f'<svg viewBox="0 0 100 100" aria-hidden="true">'
            + B.glyph(cut=cut, color=color) + '</svg>')


def poly_vertices(d):
    n = re.findall(r"-?\d*\.?\d+", d)
    return [(float(n[i]), float(n[i + 1])) for i in range(0, len(n), 2)]


CUTS = {"display": B.DISPLAY, "small": B.SMALL}


def construction_svg(name):
    """The mark as a technical drawing: the bounding box and centre cross ruled
    through it, the ring radius dimensioned, and both figures' 14 vertices each
    dotted."""
    cut = CUTS[name]
    r = cut["r"]
    verts = poly_vertices(cut["right"]) + poly_vertices(cut["left"])
    c = 3.6                                    # px per unit
    ox, oy = 34.0, 26.0
    W = ox * 2 + G * c

    def X(u):
        return ox + u * c

    def Y(u):
        return oy + u * c

    cx, cy = X(50), Y(50)

    grid = [
        f'<rect x="{X(0):.1f}" y="{Y(0):.1f}" width="{G * c:.1f}" height="{G * c:.1f}"/>',
        f'<line x1="{cx:.1f}" y1="{Y(0):.1f}" x2="{cx:.1f}" y2="{Y(100):.1f}"/>',
        f'<line x1="{X(0):.1f}" y1="{cy:.1f}" x2="{X(100):.1f}" y2="{cy:.1f}"/>',
    ]

    # Ring radius, dimensioned along the top-left diagonal-free centreline.
    rx = X(50 - r)
    radius = (f'<line x1="{cx:.1f}" y1="{cy:.1f}" x2="{rx:.1f}" y2="{cy:.1f}"/>'
              f'<line x1="{rx:.1f}" y1="{cy - 5:.1f}" x2="{rx:.1f}" y2="{cy + 5:.1f}"/>'
              f'<text x="{(cx + rx) / 2:.1f}" y="{cy - 8:.1f}" text-anchor="middle">'
              f'r{r}</text>')

    # The 28 vertices (14 per half) — every point actually on one of the two figures.
    dots = ''.join(f'<circle cx="{X(vx):.1f}" cy="{Y(vy):.1f}" r="2.4" class="anchor"/>'
                   for vx, vy in verts)

    glyph = B.glyph(G * c, ox, oy, cut=cut, color="var(--ink)", indent="    ")
    return f'''<svg viewBox="0 0 {W:.0f} {oy + G * c + 26:.0f}" class="cons" aria-hidden="true">
  <g class="grid">{''.join(grid)}</g>
  <g class="mk">
{glyph}
  </g>
  <g class="dim">{radius}</g>
  <g class="anchors">{dots}</g>
</svg>'''


LOCKUP = B.lockup_horizontal("var(--red)")
LOCKUP_STACK = B.lockup_stacked("var(--red)")

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
             --rule:#2C2F36; --red:{RED_LIFT}; --navy:#9FB4D6; --grid:#33373F; }}
  }}
  :root[data-theme="dark"] {{ --ground:#131417; --panel:#1B1D22; --ink:#ECEAE7;
    --muted:#8E868C; --rule:#2C2F36; --red:{RED_LIFT}; --navy:#9FB4D6; --grid:#33373F; }}
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
  .hero .mk {{ width:190px; color:var(--red); }}
  .hero .mk svg {{ display:block; width:100%; height:auto; }}
  @media (max-width:720px) {{ .hero {{ grid-template-columns:1fr; gap:34px; }}
                              .hero .mk {{ width:138px; }} }}

  .cons {{ width:100%; height:auto; display:block; }}
  .cons .grid line {{ stroke:var(--grid); stroke-width:1; }}
  .cons .grid rect {{ fill:none; stroke:var(--grid); stroke-width:1; }}
  .cons .grid circle {{ stroke:var(--grid); stroke-width:1; }}
  .cons .anchor {{ fill:var(--red); }}
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
                   border-radius:3px; background:#FFFFFF; }}
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
  .avatars {{ display:flex; gap:20px; flex-wrap:wrap; }}
  .avatar {{ display:flex; flex-direction:column; align-items:center; gap:9px; }}
  .avatar img {{ width:84px; height:84px; border-radius:50%; display:block;
                 border:1px solid var(--rule); }}
  .avatar .cap {{ font-family:var(--mono); font-size:.68rem; color:var(--muted); }}
  .appbar {{ display:flex; align-items:center; gap:10px; padding:11px 14px;
             border:1px solid var(--rule); border-radius:8px; background:var(--panel); }}
  .appbar .lk {{ height:24px; color:var(--red); }}
  .appbar .lk svg {{ height:100%; width:auto; display:block; }}
  .appbar .sp {{ margin-left:auto; display:flex; gap:6px; }}
  .appbar .dot {{ width:9px; height:9px; border-radius:50%; background:var(--rule); }}

  .lockups {{ display:flex; flex-direction:column; gap:16px; }}
  .lk-row {{ padding:26px; display:flex; align-items:center; gap:20px; color:var(--red); }}
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
      <h1>A district, split in two.</h1>
      <p class="lede" style="margin-top:14px">The Split-D Polygon mark is a ring
      holding two half-figures &mdash; a D on the right, a reversed D on the left,
      split by a vertical channel. Each half is 14 sides after the "uncouth
      twenty-eight-sided figure" at the centre of <em>Gomillion v. Lightfoot</em>
      (1960), the boundary drawn to fence Tuskegee's Black voters out of town, held
      whole inside the circle. The two halves are deliberately not mirror images.
      One weight, one colour.</p>
    </div>
    <div class="mk">{mark("var(--red)")}</div>
  </header>

  <section>
    <div class="head">
      <div class="eyebrow">Construction</div>
      <h2>Ring and two figures</h2>
    </div>
    <div class="cuts">
      <div class="panel cut">
        <div class="cap">Display cut &middot; ring r{B.DISPLAY["r"]}, stroke {B.DISPLAY["ring"]}</div>
        {construction_svg("display")}
      </div>
      <div class="panel cut">
        <div class="cap">Small cut &middot; ring r{B.SMALL["r"]}, stroke {B.SMALL["ring"]}</div>
        {construction_svg("small")}
      </div>
    </div>
    <p>100&times;100 units, centred on (50,&nbsp;50). The ring is a plain stroked
    circle. Each half is a straight stem plus 13 surveyed edges &mdash; 14 sides,
    28 dotted vertices in total across both figures. The channel between the two
    stems and the gap between each figure and the ring both equal the ring's own
    stroke width. The two halves are deliberately not mirror images of each other
    &mdash; different vertex offsets, different arc spans &mdash; the asymmetry is
    the point.</p>
    <p class="note">Kept upright. A prior mark's diagonal variant was flagged as
    reading too close to a hate symbol and pulled immediately, so anything on a
    diagonal stays off the table. Never mirror one half to make the other, widen or
    narrow the channel, rotate the mark, fill the ring, stretch the circle to an
    ellipse, or split the ring and figures into two colours.</p>
  </section>

  <section>
    <div class="head">
      <div class="eyebrow">Optical sizes</div>
      <h2>Two smaller figures instead of one that blots</h2>
    </div>
    <p>The previous single-figure Polygon mark closed to a solid blot below 24px,
    so its small cut had to fall back to an outline. Splitting the figure into two
    smaller halves keeps each one legible on its own, so <strong>both cuts stay
    filled</strong> here. The small cut's figures are their own hand-set
    coordinates (stems at &plusmn;3.96 instead of &plusmn;2.64) rather than a
    scaled copy of the display figures, so the channel and the ring gap keep
    tracking the heavier stroke instead of thinning out.</p>
    <div class="vs">
      <div class="panel mock">
        <div class="cap">Display cut</div>
        <div class="ladder">
          {''.join(f"""<div class="rung">
            <img class="mag" src="{DISPLAY[s]}" width="72" height="72" alt="">
            <div class="cap">{s}px</div></div>""" for s in (16, 24, 32))}
        </div>
      </div>
      <div class="panel mock">
        <div class="cap">Small cut &mdash; own coordinates, bolder</div>
        <div class="ladder">
          {''.join(f"""<div class="rung">
            <img class="mag" src="{SMALL[s]}" width="72" height="72" alt="">
            <div class="cap">{s}px</div></div>""" for s in (16, 24, 32))}
        </div>
      </div>
    </div>
    <p class="note">Real PNGs at those pixel sizes, magnified &mdash; not scaled
    vectors. The <code>.ico</code> uses the small cut for its 16/24 frames and the
    display cut from 32px up.</p>
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
    <p class="note">Everywhere the site uses <code>/logo.svg</code> sits above the
    floor: the game header, the district pages, the teaser and the welcome screen.</p>
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
    <p class="note">The ring is inset inside the app-icon plates rather than run to
    their edge, so a rounded tile or a circle crop never clips it. The maskable icon
    is sized to fit entirely inside Android's 80% safe circle. The plate is CMU Red
    with a white mark; a navy plate (<code>app-icon-navy.svg</code>) is the alternate.</p>
  </section>

  <section>
    <div class="head">
      <div class="eyebrow">Social</div>
      <h2>Profile pictures</h2>
    </div>
    <div class="panel mock">
      <div class="cap">avatar-*.svg &middot; 1000px &middot; safe for a circle crop</div>
      <div class="avatars">
        <div class="avatar"><img src="{b64(render("avatar-red.svg", "av-r.png", 168))}" alt="">
          <div class="cap">red &middot; primary</div></div>
        <div class="avatar"><img src="{b64(render("avatar-navy.svg", "av-n.png", 168))}" alt="">
          <div class="cap">navy &middot; alternate</div></div>
        <div class="avatar"><img src="{b64(render("avatar-cream.svg", "av-c.png", 168))}" alt="">
          <div class="cap">cream &middot; light</div></div>
      </div>
    </div>
    <p class="note">The plated mark at a 16% inset, so the ring sits well inside the
    circle X, Instagram and the rest crop to. Rastered to
    <code>dist/avatar-*-1000.png</code>. The 1200&times;630
    <code>og-image.png</code> is the share card.</p>
  </section>

  <section>
    <div class="head">
      <div class="eyebrow">Lockups</div>
      <h2>Mark with wordmark</h2>
    </div>
    <div class="lockups">
      <div class="panel lk-row">{LOCKUP}<span class="tag">Primary<br>lockup-horizontal.svg</span></div>
      <div class="panel lk-row stack">{LOCKUP_STACK}<span class="tag">Stacked<br>lockup-stacked.svg</span></div>
    </div>
    <p class="note">Horizontal: mark at full height, wordmark set to 1.13&times; its
    native size so its weight reads level with the mark, 26 units clear of it
    (viewBox 0 0 420 100). Stacked: mark centred above the wordmark set to the full
    width, 20-unit gap. Both are <code>currentColor</code> &mdash; inline them and
    set <code>color</code>.</p>
  </section>

  <section>
    <div class="head">
      <div class="eyebrow">Colour</div>
      <h2>One colour, CMU Red on this site</h2>
    </div>
    <p>The mark is a single colour that matches the "Daily District" wordmark beside it:
    CMU Red (<code>#C41230</code>), never a second colour inside the mark. On dark
    grounds red lifts to <code>#FF3B57</code>, because <code>#C41230</code> goes
    muddy below about 20% ground luminance &mdash; a rendering correction, not a new
    brand colour. Navy (<code>#182C4B</code>) stays in the kit as the alternate plate.</p>
    <div class="swatches">
      <div class="sw"><div class="chip" style="background:{CREAM};color:{RED}">{mark("currentColor")}</div>
        <div class="lbl">--dd-bg &middot; red mark</div></div>
      <div class="sw"><div class="chip" style="background:{RED};color:{WHITE}">{mark("currentColor")}</div>
        <div class="lbl">--dd-red &middot; knockout</div></div>
      <div class="sw"><div class="chip" style="background:{NAVY};color:{WHITE}">{mark("currentColor")}</div>
        <div class="lbl">--dd-navy &middot; alternate</div></div>
      <div class="sw"><div class="chip" style="background:{INK};color:{WHITE}">{mark("currentColor")}</div>
        <div class="lbl">dark ground &middot; white</div></div>
      <div class="sw"><div class="chip" style="background:{CREAM};color:{RED}">{mark("currentColor", cut=B.SMALL)}</div>
        <div class="lbl">small cut &middot; red</div></div>
      <div class="sw"><div class="chip" style="background:{RED};color:{WHITE}">{mark("currentColor", cut=B.SMALL)}</div>
        <div class="lbl">small cut &middot; knockout</div></div>
    </div>
  </section>

  <section>
    <div class="head">
      <div class="eyebrow">Rules</div>
      <h2>Clear space and minimum sizes</h2>
    </div>
    <div class="scroll"><table>
      <tr><th>Rule</th><th>Value</th><th>Why</th></tr>
      <tr><td>Clear space</td><td class="f">1 ring stroke on all sides</td>
          <td>Keeps the ring from fusing with any rule or box it sits against.</td></tr>
      <tr><td>Minimum, small cut</td><td class="f">16px</td>
          <td>Below this the strokes silt up and the channel closes.</td></tr>
      <tr><td>Switch cuts at</td><td class="f">24px</td>
          <td>Display cut above, small cut at and below.</td></tr>
      <tr><td>Minimum stroke</td><td class="f">1 device pixel</td>
          <td>A sub-pixel stroke is what forces the small cut in the first place.</td></tr>
      <tr><td>Minimum, full lockup</td><td class="f">120px wide</td>
          <td>Set by the wordmark's counters, not the mark.</td></tr>
      <tr><td>Never</td><td class="f">&mdash;</td>
          <td>Mirror one half to make the other, widen or narrow the channel, set
              the mark on a diagonal, fill the ring, stretch the circle to an
              ellipse, or split the ring and figures into two colours.</td></tr>
    </table></div>
  </section>

  <section>
    <div class="head">
      <div class="eyebrow">Files &middot; brand/</div>
      <h2>What's in the kit</h2>
    </div>
    <div class="scroll"><table>
      <tr><th>File</th><th>Use</th></tr>
      <tr><td class="f">mark.svg</td><td>Primary &mdash; <code>currentColor</code>, one colour. Inline it and set <code>color</code>.</td></tr>
      <tr><td class="f">mark-small.svg</td><td>Small cut, <code>currentColor</code>. At or below 24px.</td></tr>
      <tr><td class="f">mark-red / -small-red / -navy / -white.svg</td><td>Baked CMU Red (display + small cuts), navy (alternate), white (dark grounds).</td></tr>
      <tr><td class="f">logo.svg</td><td>The red mark for <code>&lt;img src&gt;</code>. This is what the site's <code>logo.svg</code> is.</td></tr>
      <tr><td class="f">favicon.svg</td><td>Small cut in CMU Red; lifts to <code>#FF3B57</code> in the browser's dark mode.</td></tr>
      <tr><td class="f">app-icon.svg</td><td>CMU Red plate, white mark, ~19% inset &mdash; PWA "any" and iOS.</td></tr>
      <tr><td class="f">app-icon-maskable.svg</td><td>~27% inset, inside Android's 80% safe circle.</td></tr>
      <tr><td class="f">app-icon-navy.svg</td><td>Navy plate, white mark &mdash; alternate / event skins.</td></tr>
      <tr><td class="f">avatar-*.svg</td><td>Social profile pictures &mdash; red / navy / cream, 16% inset.</td></tr>
      <tr><td class="f">lockup-*.svg</td><td>Horizontal (currentColor / red / white) and stacked (currentColor).</td></tr>
      <tr><td class="f">og-image.svg</td><td>1200&times;630 social card &mdash; solid red plate, white mark + wordmark.</td></tr>
      <tr><td class="f">logo.css</td><td>Palette tokens + <code>.dd-mark</code> / <code>.dd-wordmark</code> mask helpers.</td></tr>
      <tr><td class="f">dist/</td><td>Rendered PNGs, the avatars at 1000px, and a 6-frame favicon.ico (16&ndash;128).</td></tr>
      <tr><td class="f">build.py</td><td>Regenerates everything above from the canonical path data.</td></tr>
    </table></div>
  </section>

</div>
'''

ASCII_SAFE = "".join(c if ord(c) < 128 else f"&#{ord(c)};" for c in HTML)
out = os.path.join(HERE, "spec.html")
with open(out, "w", encoding="utf-8") as f:
    f.write(ASCII_SAFE)
print("wrote", out, len(ASCII_SAFE), "bytes")
