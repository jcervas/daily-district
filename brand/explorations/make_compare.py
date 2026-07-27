#!/usr/bin/env python3
"""Head-to-head: the best non-letterform candidates against the D, and the page that
presents the whole non-letterform question.
"""
import base64
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
BRAND = os.path.dirname(HERE)
OUT = os.path.join(HERE, "compare")
os.makedirs(OUT, exist_ok=True)
sys.path.insert(0, BRAND)

import build as B          # noqa: E402  the D, from the single source
import explore7 as E7      # noqa: E402
import explore8 as E8      # noqa: E402

RED = B.RED
G = 12.0


def d_mark(tile):
    if tile:
        return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" '
                f'width="512" height="512">'
                f'<rect width="512" height="512" rx="112" ry="112" fill="{RED}"/>'
                f'<path fill="#FFFFFF" fill-rule="evenodd" '
                f'transform="{B.fit(512, 512, inset=96)}" d="{B.D}"/></svg>')
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" '
            f'width="512" height="512"><rect width="512" height="512" fill="#FAFAF8"/>'
            f'<path fill="{RED}" fill-rule="evenodd" '
            f'transform="{B.fit(512, 512, inset=40)}" d="{B.D}"/></svg>')


def split_mark(tile, ch=1.6):
    return E8.tiled(ch) if tile else E8.bare(ch)


def n_mark(name, tile):
    return E7.tiled(name) if tile else E7.bare(name)


CANDS = [
    ("The D", lambda t: d_mark(t)),
    ("Split", lambda t: split_mark(t)),
    ("District", lambda t: n_mark("n1-district", t)),
    ("State line", lambda t: n_mark("n4-stateline", t)),
]


def build_sheet():
    for label, fn in CANDS:
        key = label.lower().replace(" ", "")
        for tile in (True, False):
            k = "t" if tile else "b"
            p = os.path.join(OUT, f"{key}-{k}.svg")
            open(p, "w").write(fn(tile))
            for s in (512, 32, 16):
                subprocess.run(["inkscape", p, "-w", str(s), "-h", str(s),
                                "-o", os.path.join(OUT, f"{key}-{k}-{s}.png")],
                               capture_output=True)

    cw, ch = 300, 596
    parts = [f'<rect width="{len(CANDS) * cw}" height="{ch}" fill="#FAFAF8"/>']
    for i, (label, _) in enumerate(CANDS):
        key = label.lower().replace(" ", "")
        x = i * cw
        parts.append(f'<image x="{x + 46}" y="20" width="208" height="208" '
                     f'href="{os.path.join(OUT, f"{key}-t-512.png")}"/>')
        parts.append(f'<image x="{x + 46}" y="240" width="208" height="208" '
                     f'href="{os.path.join(OUT, f"{key}-b-512.png")}"/>')
        for j, (k, sz, px) in enumerate((("t", 32, 88), ("t", 16, 60),
                                         ("b", 32, 88), ("b", 16, 60))):
            parts.append(f'<image x="{x + 30 + j * 66}" y="{468 + (88 - px) / 2:.0f}" '
                         f'width="{px}" height="{px}" '
                         f'href="{os.path.join(OUT, f"{key}-{k}-{sz}.png")}" '
                         f'style="image-rendering:pixelated"/>')
        parts.append(f'<text x="{x + 150}" y="578" text-anchor="middle" '
                     f'font-family="Helvetica" font-size="18" fill="#15171B">'
                     f'{label}</text>')
    p = os.path.join(OUT, "_sheet.svg")
    open(p, "w").write(f'<svg xmlns="http://www.w3.org/2000/svg" '
                       f'xmlns:xlink="http://www.w3.org/1999/xlink" '
                       f'viewBox="0 0 {len(CANDS) * cw} {ch}" '
                       f'width="{len(CANDS) * cw}" height="{ch}">'
                       + "".join(parts) + '</svg>')
    png = os.path.join(OUT, "_sheet.png")
    subprocess.run(["inkscape", p, "-w", str(len(CANDS) * cw), "-h", str(ch),
                    "-o", png], capture_output=True)
    return png


def b64(path):
    return "data:image/png;base64," + base64.b64encode(open(path, "rb").read()).decode()


HEAD2HEAD = b64(build_sheet())
SHEET7 = b64(os.path.join(HERE, "explore7", "_sheet.png"))
SHEET8 = b64(os.path.join(HERE, "explore8", "_sheet.png"))

HTML = f'''<title>Daily District — Non-Letterform Directions</title>
<style>
  :root {{
    --ground:#F4F3F1; --panel:#FFFFFF; --ink:#15171B; --muted:#7B7378;
    --rule:#E3DFDA; --red:{RED};
    --mono:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,monospace;
    --sans:ui-sans-serif,-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif;
  }}
  @media (prefers-color-scheme:dark) {{
    :root {{ --ground:#131417; --panel:#1B1D22; --ink:#ECEAE7; --muted:#8E868C;
             --rule:#2C2F36; --red:#FF3B57; }}
  }}
  :root[data-theme="dark"] {{ --ground:#131417; --panel:#1B1D22; --ink:#ECEAE7;
    --muted:#8E868C; --rule:#2C2F36; --red:#FF3B57; }}
  :root[data-theme="light"] {{ --ground:#F4F3F1; --panel:#FFFFFF; --ink:#15171B;
    --muted:#7B7378; --rule:#E3DFDA; --red:{RED}; }}

  body {{ background:var(--ground); color:var(--ink); font-family:var(--sans);
         line-height:1.55; -webkit-font-smoothing:antialiased; }}
  .wrap {{ max-width:1020px; margin:0 auto; padding:60px 26px 110px;
           display:flex; flex-direction:column; gap:66px; }}
  h1 {{ font-size:clamp(2.1rem,4.6vw,3rem); font-weight:800; letter-spacing:-.028em;
        line-height:1.06; margin:0; text-wrap:balance; }}
  h2 {{ font-size:1.28rem; font-weight:700; letter-spacing:-.012em; margin:0; }}
  p {{ margin:0; max-width:66ch; }}
  .lede {{ font-size:1.1rem; color:var(--muted); }}
  .eyebrow {{ font-family:var(--mono); font-size:.7rem; letter-spacing:.14em;
              text-transform:uppercase; color:var(--red); }}
  section {{ display:flex; flex-direction:column; gap:20px; }}
  .head {{ display:flex; flex-direction:column; gap:7px;
           border-top:1px solid var(--rule); padding-top:16px; }}
  figure {{ margin:0; border:1px solid var(--rule); border-radius:6px;
            background:var(--panel); overflow:hidden; }}
  figure img {{ display:block; width:100%; height:auto; }}
  figcaption {{ font-family:var(--mono); font-size:.7rem; color:var(--muted);
                padding:11px 14px; border-top:1px solid var(--rule); }}
  .verdicts {{ display:flex; flex-direction:column; gap:11px; }}
  .v {{ display:grid; grid-template-columns:118px minmax(0,1fr); gap:16px;
        padding:13px 0; border-bottom:1px solid var(--rule); align-items:baseline; }}
  .v .n {{ font-family:var(--mono); font-size:.78rem; color:var(--ink); }}
  .v .r {{ font-size:.93rem; color:var(--muted); }}
  .v .r b {{ color:var(--ink); font-weight:600; }}
  @media (max-width:600px) {{ .v {{ grid-template-columns:1fr; gap:4px; }} }}
  .call {{ border-left:3px solid var(--red); padding:4px 0 4px 18px;
           display:flex; flex-direction:column; gap:10px; }}
</style>

<div class="wrap">

  <header>
    <div class="eyebrow">Counterpoint</div>
    <h1>Non&#8209;letterform directions</h1>
    <p class="lede" style="margin-top:13px">Same census&#8209;block vocabulary as the D,
    but depicting a district instead of spelling one. Six candidates, then a rescue
    attempt on the only one with a real idea behind it, then the head&#8209;to&#8209;head.
    Every mark is shown tiled, bare, and as a true 16px raster.</p>
  </header>

  <section>
    <div class="head">
      <div class="eyebrow">Round one</div>
      <h2>Six ways to draw the thing itself</h2>
    </div>
    <figure><img src="{SHEET7}" alt="Six non-letterform candidates">
      <figcaption>Top: tiled. Middle: bare. Bottom: true 32px and 16px rasters.</figcaption>
    </figure>
    <div class="verdicts">
      <div class="v"><span class="n">n1-district</span><span class="r">A lopsided
        block district. At 16px it's <b>a blob with notches</b> — could be anything.</span></div>
      <div class="v"><span class="n">n2-split</span><span class="r">Two districts
        sharing a jogged border. <b>The only one with a real idea</b>: it depicts
        districting, not a district. But it needed two tones, so 16px went muddy.</span></div>
      <div class="v"><span class="n">n3-blocks</span><span class="r">Reads as a
        <b>calculator keypad</b>. Pure noise at 16px even at 4&times;4.</span></div>
      <div class="v"><span class="n">n4-stateline</span><span class="r">Flat state
        line, stepped elsewhere. Reads as <b>a folder or a chunky arrow</b>.</span></div>
      <div class="v"><span class="n">n7-nested</span><span class="r">District inside
        its state. Reads as <b>a photo frame</b>; the interior dies at 16px.</span></div>
      <div class="v"><span class="n">n9-surveyed</span><span class="r">Straight on two
        sides, jogged on two. Collapses to <b>a solid stamp</b> small.</span></div>
    </div>
  </section>

  <section>
    <div class="head">
      <div class="eyebrow">Round two &middot; the rescue</div>
      <h2>Making the split work in one colour</h2>
    </div>
    <p>Two tones is a versatility failure — it dies at 16px, in single&#8209;colour
    print, and in embroidery. The fix is to separate the two districts with a channel
    of bare ground instead of tinting one. The question is how wide that channel has to
    be to survive a real 16px raster.</p>
    <figure><img src="{SHEET8}" alt="Split mark at three channel widths">
      <figcaption>Channel width, in grid cells. At 0.8 the seam closes up small; 1.6 holds.</figcaption>
    </figure>
    <p>It works at 1.6 cells. This is a legitimate mark — the seam stays continuous and
    legible right down to 16px.</p>
  </section>

  <section>
    <div class="head">
      <div class="eyebrow">Head to head</div>
      <h2>Against the D</h2>
    </div>
    <figure><img src="{HEAD2HEAD}" alt="The D compared with three non-letterform marks">
      <figcaption>Same treatment, same sizes, same rasteriser.</figcaption>
    </figure>
    <div class="call">
      <p><b>The D still wins, and there's a structural reason rather than a taste
      one.</b></p>
      <p>A letter is a shape the viewer already carries in their head. That gives the
      steps something to deviate <em>from</em> — they register as a deliberate
      modification of a known form, which is what makes them read as surveyed
      geography. An arbitrary polygon has no such baseline, so the same steps read as
      "some blob." That's exactly why n1, n4 and n9 all collapse into an
      unnamed shape at small sizes while the D stays legible.</p>
      <p>The split is the real contender and it's genuinely distinctive. What rules it
      out is that <b>its silhouette is a square</b> — every bit of meaning lives in an
      interior detail. Interior detail is the first thing lost at 16px, the first thing
      lost in embroidery, and the first thing lost when someone drops the mark on a
      busy photo. The D carries its meaning in its outline, which is the part that
      survives.</p>
      <p>There's also a plain naming argument: people say "the D." Nobody has a word
      for the split.</p>
    </div>
  </section>

  <section>
    <div class="head">
      <div class="eyebrow">If you want it anyway</div>
      <h2>Where the split would earn its place</h2>
    </div>
    <p>It's too good to throw away entirely. It works as a <b>secondary device</b>
    rather than the primary mark — a section divider, a loading state, the back of a
    card, a pattern for merch lining, or the ghost graphic on the social card where the
    D currently sits. It has room to be detailed there, which is precisely where it's
    strong and the D is not.</p>
  </section>

</div>
'''

ASCII_SAFE = "".join(c if ord(c) < 128 else f"&#{ord(c)};" for c in HTML)
out = os.path.join(BRAND, "nonletterform.html")
with open(out, "w", encoding="utf-8") as f:
    f.write(ASCII_SAFE)
print("wrote", out)
