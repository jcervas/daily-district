#!/usr/bin/env python3
"""Assemble brand/spec.html — the presentation sheet for the outline mark.

Small-size renders are embedded as base64 of the ACTUAL rasters build.py produces,
not scaled-down vectors — a scaled vector always flatters a mark, only a real raster
tells you whether it survives.
"""
import base64
import os
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
PX = os.path.join(HERE, "dist", "px")
os.makedirs(PX, exist_ok=True)

import build as B  # noqa: E402

RED, INK, NAVY, CREAM = B.RED, B.INK, B.NAVY, B.CREAM


def render(src, name, size, height=None):
    subprocess.run(["inkscape", os.path.join(HERE, src), "-w", str(size),
                    "-h", str(height or size), "-o", os.path.join(PX, name)],
                   capture_output=True, check=True)
    return os.path.join(PX, name)


def b64(path):
    return "data:image/png;base64," + base64.b64encode(open(path, "rb").read()).decode()


SMALL = {s: b64(render("favicon-small-flat.svg", f"s{s}.png", s))
         for s in (16, 20, 24, 32)}
DISPLAY = {s: b64(render("favicon-display-flat.svg", f"d{s}.png", s))
           for s in (32, 40, 48, 64)}
TILE = b64(render("icon-tile.svg", "tile.png", 192))
IOS = b64(render("icon-ios.svg", "ios.png", 180))
MASK = b64(render("icon-maskable.svg", "mask.png", 192))


def mark_svg(color, cut="display", box=200):
    return (f'<svg viewBox="0 0 {box} {box}" aria-hidden="true">'
            f'{B.mark_element(color, box, box, inset=box * 0.08, cut=cut)}</svg>')


def construction_svg():
    """Display and small cuts side by side, on their own grid, with the stroke
    fraction called out on each."""
    c, gap = 220, 60
    w = c * 2 + gap
    h = c + 46

    def one(cut, label):
        s, ox, oy, stroke = B.fit(c, c, inset=c * 0.1, cut=cut)
        pts = B.POLY_DISPLAY if cut == "display" else B.POLY_SMALL
        d = B._poly_d(pts, s, ox, oy)
        return (f'<g>'
                f'<rect width="{c}" height="{c}" fill="none" class="frame"/>'
                f'<path class="fill" stroke-width="{stroke:.2f}" d="{d}"/>'
                f'<text x="{c/2:.0f}" y="{c + 30}" text-anchor="middle" '
                f'class="lbl">{label}</text></g>')

    return f'''<svg viewBox="0 0 {w} {h}" class="cons" aria-hidden="true">
  {one("display", "display · 11 points · stroke 11.6% of size")}
  <g transform="translate({c + gap} 0)">{one("small", "small · 6 points · stroke 20.6% of size")}</g>
</svg>'''


LOCKUP = B.lockup_horizontal(RED, "var(--ink)")
LOCKUP_STACK = B.lockup_stacked(RED, "var(--ink)")

HTML = f'''<title>Daily District — Logo System</title>
<style>
  :root {{
    --ground:#F4F3F1; --panel:#FFFFFF; --ink:#15171B; --muted:#7B7378;
    --rule:#E3DFDA; --red:{RED}; --navy:{NAVY};
    --mono:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,monospace;
    --sans:ui-sans-serif,-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif;
  }}
  @media (prefers-color-scheme:dark) {{
    :root {{ --ground:#131417; --panel:#1B1D22; --ink:#ECEAE7; --muted:#8E868C;
             --rule:#2C2F36; --red:#FF3B57; --navy:#9FB4D6; }}
  }}
  :root[data-theme="dark"] {{ --ground:#131417; --panel:#1B1D22; --ink:#ECEAE7;
    --muted:#8E868C; --rule:#2C2F36; --red:#FF3B57; --navy:#9FB4D6; }}
  :root[data-theme="light"] {{ --ground:#F4F3F1; --panel:#FFFFFF; --ink:#15171B;
    --muted:#7B7378; --rule:#E3DFDA; --red:{RED}; --navy:{NAVY}; }}

  body {{ background:var(--ground); color:var(--ink); font-family:var(--sans);
         line-height:1.55; -webkit-font-smoothing:antialiased; }}
  .wrap {{ max-width:1000px; margin:0 auto; padding:64px 28px 120px;
           display:flex; flex-direction:column; gap:76px; }}
  h1,h2 {{ text-wrap:balance; margin:0; }}
  h1 {{ font-size:clamp(2.1rem,5vw,3.2rem); font-weight:800; letter-spacing:-.028em;
        line-height:1.06; }}
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
  .hero .mk {{ width:170px; }}
  .hero .mk svg {{ display:block; width:100%; height:auto; }}
  @media (max-width:720px) {{ .hero {{ grid-template-columns:1fr; gap:34px; }}
                              .hero .mk {{ width:120px; }} }}

  .cons {{ width:100%; max-width:520px; height:auto; display:block; }}
  .cons .frame {{ stroke:var(--rule); stroke-width:1; }}
  .cons .fill {{ fill:none; stroke:var(--red); }}
  .cons .lbl {{ font-family:var(--mono); font-size:12px; fill:var(--muted); }}

  .history {{ display:flex; flex-direction:column; gap:10px; }}
  .hrow {{ display:flex; gap:12px; align-items:baseline; padding:8px 0;
           border-bottom:1px solid var(--rule); }}
  .hrow .n {{ font-family:var(--mono); font-size:.68rem; color:var(--muted); width:90px;
              flex:none; }}
  .hrow .r {{ font-size:.9rem; }}

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
  .sw .chip {{ aspect-ratio:1.1; display:grid; place-items:center; }}
  .sw .chip svg {{ width:56%; height:auto; }}
  .sw .lbl2 {{ padding:9px 11px; font-family:var(--mono); font-size:.67rem;
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
      <div class="eyebrow">Logo system &middot; fourth attempt</div>
      <h1>Just the outline.</h1>
      <p class="lede" style="margin-top:14px">The whole game is naming a district
      from its shape. This mark is that shape, drawn as an outline &mdash; the most
      literal option tried yet. Nothing filled, no letterform, no interior seam.</p>
    </div>
    <div class="mk">{mark_svg("var(--red)")}</div>
  </header>

  <section>
    <div class="head">
      <div class="eyebrow">Why this, fourth try</div>
      <h2>What the first three got wrong</h2>
    </div>
    <div class="history">
      <div class="hrow"><span class="n">Attempt 1</span><span class="r">A stepped
        letter D. Read as a damaged letter at a glance, not a map.</span></div>
      <div class="hrow"><span class="n">Attempt 2</span><span class="r">A square
        split by a jogged seam. Rotating it for a diagonal look turned the square
        into a diamond with bent segments radiating from its centre &mdash; flagged
        as reading too close to a hate symbol. Reverted immediately.</span></div>
      <div class="hrow"><span class="n">Attempt 3</span><span class="r">A puzzle
        piece &mdash; tab and notch. Worked at every size; a different direction was
        asked for before it shipped.</span></div>
      <div class="hrow"><span class="n">Attempt 4</span><span class="r">This outline.
        A single asymmetric stroked loop &mdash; no radiating arms, no rotational
        symmetry, and the most literal tie to the game of anything tried.</span></div>
    </div>
  </section>

  <section>
    <div class="head">
      <div class="eyebrow">Optical sizes</div>
      <h2>The small cut is a different shape, not a thicker line</h2>
    </div>
    {construction_svg()}
    <p>A first pass at the small cut just reused the display polygon at a heavier
    stroke. Rendered at true 16px, it read as a stray letter &mdash; a "P" &mdash;
    because one vertex stuck out as a leg. The small cut here is a genuinely
    different, rounder-cornered six-point loop, tuned against real rasters until it
    read as an irregular boundary and nothing more specific.</p>
    <p class="note">Stroke width is defined as a fraction of the shape's own
    rendered size, not of the canvas, so it scales correctly at any box a consumer
    asks for &mdash; a lockup icon at 50px and a favicon at 512px use the same
    formula, not a fixed pixel value.</p>
  </section>

  <section>
    <div class="head">
      <div class="eyebrow">Scale &middot; rendered, not simulated</div>
      <h2>What it actually looks like small</h2>
    </div>
    <p class="note">Each image is the real PNG the build produces at that pixel
    size. A scaled-down vector always flatters a mark; only a real raster tells the
    truth.</p>
    <div class="vs">
      <div class="panel mock">
        <div class="cap">Small cut &middot; 16&ndash;32px</div>
        <div class="ladder">
          {''.join(f"""<div class="rung">
            <div class="true"><img src="{SMALL[s]}" width="{s}" height="{s}" alt=""></div>
            <img class="mag" src="{SMALL[s]}" width="72" height="72" alt="">
            <div class="cap">{s}px</div></div>""" for s in (16, 20, 24, 32))}
        </div>
      </div>
      <div class="panel mock">
        <div class="cap">Display cut &middot; 32&ndash;64px</div>
        <div class="ladder">
          {''.join(f"""<div class="rung">
            <div class="true"><img src="{DISPLAY[s]}" width="{s}" height="{s}" alt=""></div>
            <img class="mag" src="{DISPLAY[s]}" width="72" height="72" alt="">
            <div class="cap">{s}px</div></div>""" for s in (32, 40, 48, 64))}
        </div>
      </div>
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
        <div class="cap">iOS home screen</div>
        <div class="springboard">
          <div class="app"><img src="{IOS}" alt=""><div class="nm">Daily District</div></div>
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
    <p>Every value is already in <code>style.css</code>. On dark grounds the red
    lifts to <code>#FF3B57</code>, since <code>#C41230</code> goes muddy below about
    20% ground luminance &mdash; a rendering correction, not a new brand colour.</p>
    <div class="swatches">
      <div class="sw"><div class="chip" style="background:{CREAM}">{mark_svg(RED)}</div>
        <div class="lbl2">--bg &middot; {CREAM}</div></div>
      <div class="sw"><div class="chip" style="background:{RED}">{mark_svg(CREAM)}</div>
        <div class="lbl2">--cmu-red &middot; {RED}</div></div>
      <div class="sw"><div class="chip" style="background:{NAVY}">{mark_svg(CREAM)}</div>
        <div class="lbl2">--cmu-navy &middot; {NAVY}</div></div>
      <div class="sw"><div class="chip" style="background:{INK}">{mark_svg("#FF3B57")}</div>
        <div class="lbl2">dark ground &middot; #FF3B57</div></div>
    </div>
  </section>

  <section>
    <div class="head">
      <div class="eyebrow">Files &middot; brand/</div>
      <h2>What's in the kit</h2>
    </div>
    <div class="scroll"><table>
      <tr><th>File</th><th>Use</th></tr>
      <tr><td class="f">mark.svg</td><td><code>currentColor</code>, display cut &mdash; inline in HTML.</td></tr>
      <tr><td class="f">mark-red.svg</td><td>Baked red, for <code>&lt;img src&gt;</code>. This is what the site's <code>logo.svg</code> would become.</td></tr>
      <tr><td class="f">mark-small.svg</td><td>Small cut, for use at or below 32px.</td></tr>
      <tr><td class="f">favicon.svg</td><td>Small cut; answers the browser's dark mode.</td></tr>
      <tr><td class="f">icon-tile.svg</td><td>PWA icons &mdash; solid tile, glyph centred with padding.</td></tr>
      <tr><td class="f">icon-ios.svg</td><td>Full-bleed tile; iOS applies its own squircle.</td></tr>
      <tr><td class="f">icon-maskable.svg</td><td>Android maskable, inside the 80% safe circle.</td></tr>
      <tr><td class="f">lockup-*.svg</td><td>Horizontal and stacked; red, reversed, currentColor.</td></tr>
      <tr><td class="f">og-image.svg</td><td>1200&times;630 social card.</td></tr>
      <tr><td class="f">dist/</td><td>Rendered PNGs plus a 6-frame favicon.ico (16&ndash;128).</td></tr>
      <tr><td class="f">build.py</td><td>Regenerates everything above from the two polygons.</td></tr>
    </table></div>
    <p class="note">Nothing here is wired into the site. Nothing has been pushed.
    This is the review before that decision gets made.</p>
  </section>

</div>
'''

ASCII_SAFE = "".join(c if ord(c) < 128 else f"&#{ord(c)};" for c in HTML)
out = os.path.join(HERE, "spec.html")
with open(out, "w", encoding="utf-8") as f:
    f.write(ASCII_SAFE)
print("wrote", out, len(ASCII_SAFE), "bytes")
