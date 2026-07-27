#!/usr/bin/env python3
"""A proper look at the three rings variants — big, side by side, with real 16px
rasters rather than a cramped thumbnail. Answers "show me before I decide."
"""
import base64
import os
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "explore11")


def b64(path):
    return "data:image/png;base64," + base64.b64encode(open(path, "rb").read()).decode()


VARIANTS = [
    ("centered", "Centered", "Clean, immediately legible. Reads as a generic "
     "zoom / camera-focus / target icon — correct, but not specific to this game."),
    ("offset", "Offset", "The innermost square shifts toward the bottom-right, so "
     "it stops reading as a static bullseye and starts reading as “narrow down, "
     "then land on one spot” — the game's actual mechanic."),
    ("offset-round", "Offset + round", "Same shift, plus corners that soften from "
     "sharp (outer, state-level) to nearly circular (inner, the exact spot) — "
     "broad and angular outside, precise and smooth at the centre."),
]

CARDS = []
for key, label, note in VARIANTS:
    t512 = b64(os.path.join(OUT, f"rings-{key}-t-512.png"))
    b512 = b64(os.path.join(OUT, f"rings-{key}-b-512.png"))
    t32 = b64(os.path.join(OUT, f"rings-{key}-t-32.png"))
    t16 = b64(os.path.join(OUT, f"rings-{key}-t-16.png"))
    CARDS.append(f'''
    <div class="card">
      <h2>{label}</h2>
      <div class="big">
        <img src="{t512}" alt="{label} tiled">
        <img src="{b512}" alt="{label} bare">
      </div>
      <p class="note">{note}</p>
      <div class="ladder">
        <div class="rung"><img class="mag" src="{t32}" width="96" height="96" alt=""><span>32px, magnified</span></div>
        <div class="rung"><img class="mag" src="{t16}" width="96" height="96" alt=""><span>16px, magnified</span></div>
        <div class="rung"><img class="true" src="{t16}" width="16" height="16" alt=""><span>16px, true size</span></div>
      </div>
    </div>''')

HTML = f'''<title>Rings — Side by Side</title>
<style>
  :root {{ --ground:#F4F3F1; --panel:#FFFFFF; --ink:#15171B; --muted:#7B7378; --rule:#E3DFDA; --red:#C41230; }}
  @media (prefers-color-scheme:dark) {{ :root {{ --ground:#131417; --panel:#1B1D22; --ink:#ECEAE7; --muted:#8E868C; --rule:#2C2F36; --red:#FF3B57; }} }}
  :root[data-theme="dark"] {{ --ground:#131417; --panel:#1B1D22; --ink:#ECEAE7; --muted:#8E868C; --rule:#2C2F36; --red:#FF3B57; }}
  :root[data-theme="light"] {{ --ground:#F4F3F1; --panel:#FFFFFF; --ink:#15171B; --muted:#7B7378; --rule:#E3DFDA; --red:#C41230; }}
  body {{ background:var(--ground); color:var(--ink); font-family:ui-sans-serif,-apple-system,"Helvetica Neue",Arial,sans-serif; line-height:1.5; }}
  .wrap {{ max-width:1040px; margin:0 auto; padding:48px 24px 90px; }}
  h1 {{ font-size:1.9rem; font-weight:800; letter-spacing:-.02em; margin:0 0 34px; }}
  .cards {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:20px; }}
  .card {{ background:var(--panel); border:1px solid var(--rule); border-radius:8px; padding:22px; display:flex; flex-direction:column; gap:14px; }}
  .card h2 {{ font-size:1.05rem; margin:0; }}
  .big {{ display:flex; gap:10px; }}
  .big img {{ width:50%; height:auto; border-radius:6px; border:1px solid var(--rule); }}
  .note {{ font-size:.92rem; color:var(--muted); margin:0; }}
  .ladder {{ display:flex; gap:16px; align-items:flex-end; border-top:1px solid var(--rule); padding-top:14px; }}
  .rung {{ display:flex; flex-direction:column; align-items:center; gap:8px; }}
  .rung span {{ font-family:ui-monospace,monospace; font-size:.65rem; color:var(--muted); text-align:center; }}
  .rung img.mag {{ image-rendering:pixelated; border:1px solid var(--rule); border-radius:4px; }}
  .rung img.true {{ border:1px solid var(--rule); }}
</style>
<div class="wrap">
  <h1>Rings, side by side</h1>
  <div class="cards">{"".join(CARDS)}</div>
</div>
'''

ASCII_SAFE = "".join(c if ord(c) < 128 else f"&#{ord(c)};" for c in HTML)
out = os.path.join(HERE, "rings-review.html")
with open(out, "w", encoding="utf-8") as f:
    f.write(ASCII_SAFE)
print("wrote", out)
