#!/usr/bin/env python3
"""Generate the Daily District logo system from one parametric source.

THE MARK
    An outlined district boundary — a single asymmetric loop, stroked, nothing
    filled inside it. It's the most literal mark tried yet: the whole game is
    naming a congressional district from its outline shape, and that's exactly
    what the mark depicts. No letterform, no interior seam, no radial symmetry.

    Two earlier directions were tried and dropped. A stepped letter D read as a
    damaged letter, not a map. A split-square divided by a jogged seam worked
    upright, but rotating it for a diagonal look turned the square into a diamond
    with bent segments radiating from its centre — flagged as reading too close to
    a hate symbol, reverted immediately. A puzzle piece (tab + notch) was built out
    fully and worked at every size, but this outline direction was asked for
    instead. It carries none of the earlier risks: a single stroked loop has no
    radiating arms and no rotational symmetry at all.

OPTICAL SIZES
    A thin outline is the first thing to turn to mush when rasterised small — a
    real 16px render of the original single-cut design confirmed this: legible and
    distinctive at 512px, an amorphous blob by 24px. So there are two cuts, drawn
    independently rather than one shrunk into the other:

      DISPLAY  the full 11-point boundary, moderate stroke   above 32px
      SMALL    a 6-point simplified loop, much thicker stroke   32px and below

    The small cut isn't just "the display cut, thicker" — a first pass at that
    literally reused the display polygon and came out reading as a stray letter (a
    "P") at 16px, because one point stuck out as a leg. The small cut is a
    deliberately different, rounder-cornered shape, tuned by rendering real 16px
    rasters until it read as an irregular loop and nothing more specific.

    python3 brand/build.py

Output goes to brand/ (vector) and brand/dist/ (raster). Nothing here writes into
the site; adopting the system is a deliberate copy out of dist/.

Requires: inkscape (SVG -> PNG).
"""
import os
import re
import struct
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DIST = os.path.join(HERE, "dist")
os.makedirs(DIST, exist_ok=True)

# ---------------------------------------------------------------- brand tokens
RED = "#C41230"        # --cmu-red
RED_LIFT = "#FF3B57"   # red lifted for dark grounds, where #C41230 goes muddy
NAVY = "#182C4B"       # --cmu-navy
CREAM = "#F5F5F3"      # --bg
INK = "#1A1A1A"        # --text

# ------------------------------------------------------------------- geometry
# Both polygons in the same normalised 0-100 space. Closed loops, stroked only.
POLY_DISPLAY = [(12, 22), (46, 10), (52, 30), (84, 18), (92, 44), (72, 56),
                (88, 74), (60, 96), (34, 86), (30, 62), (6, 52)]
POLY_SMALL = [(30, 5), (80, 15), (90, 55), (60, 90), (20, 80), (5, 40)]

# Stroke width as a fraction of the shape's own rendered size — NOT of the canvas —
# so it scales correctly at any consumer's box size. The small cut runs much
# thicker: proportionally heavier strokes are what keeps a loop from closing up
# into a blob once it's down past 32px.
STROKE_FRAC_DISPLAY = 0.116
STROKE_FRAC_SMALL = 0.206

CUT_THRESHOLD = 32   # px; favicon.ico frames at/under this use the small cut


def _bbox(pts):
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    return min(xs), max(xs), min(ys), max(ys)


def _poly_d(pts, s, ox, oy):
    return "M" + " L".join(f"{ox + (x - _bbox(pts)[0]) * s:.2f} "
                           f"{oy + (y - _bbox(pts)[2]) * s:.2f}" for x, y in pts) + "Z"


def fit(box_w, box_h, inset=0.0, cut="display"):
    """Scale + stroke-width for centring the loop in a box, inset on every side.

    The stroke expands the visible shape by stroke_width/2 in every direction, so
    the fit accounts for it up front rather than clipping the outer edge of the
    line — solved directly rather than by iterating, since stroke width is defined
    as a fraction of the shape's OWN size once that size is known.
    """
    pts = POLY_DISPLAY if cut == "display" else POLY_SMALL
    frac = STROKE_FRAC_DISPLAY if cut == "display" else STROKE_FRAC_SMALL
    x0, x1, y0, y1 = _bbox(pts)
    pw, ph = x1 - x0, y1 - y0
    ref = max(pw, ph)
    avail = min(box_w, box_h) - 2 * inset
    s = avail / max(pw + frac * ref, ph + frac * ref)
    stroke = frac * ref * s
    rw, rh = pw * s, ph * s
    ox = (box_w - rw) / 2
    oy = (box_h - rh) / 2
    return s, ox, oy, stroke


def mark_element(color, box_w, box_h, inset=0.0, cut="display", extra=""):
    pts = POLY_DISPLAY if cut == "display" else POLY_SMALL
    s, ox, oy, stroke = fit(box_w, box_h, inset, cut)
    d = _poly_d(pts, s, ox, oy)
    return (f'  <path fill="none" stroke="{color}" stroke-width="{stroke:.2f}" '
            f'stroke-linejoin="round"{extra} d="{d}"/>')


def _rounded_rect(x, y, w, h, r):
    if r <= 0:
        return f"M{x:.3f} {y:.3f}H{x + w:.3f}V{y + h:.3f}H{x:.3f}Z"
    return (f"M{x + r:.3f} {y:.3f}H{x + w - r:.3f}A{r:.3f} {r:.3f} 0 0 1 "
            f"{x + w:.3f} {y + r:.3f}V{y + h - r:.3f}A{r:.3f} {r:.3f} 0 0 1 "
            f"{x + w - r:.3f} {y + h:.3f}H{x + r:.3f}A{r:.3f} {r:.3f} 0 0 1 "
            f"{x:.3f} {y + h - r:.3f}V{y + r:.3f}A{r:.3f} {r:.3f} 0 0 1 "
            f"{x + r:.3f} {y:.3f}Z")


def svg(body, w, h, vb=None, extra=""):
    vb = vb or f"0 0 {w} {h}"
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" '
            f'width="{w}" height="{h}"{extra}>\n{body}\n</svg>\n')


def write(name, text):
    open(os.path.join(HERE, name), "w").write(text)


LABEL = ' role="img" aria-label="Daily District"'

# ---------------------------------------------------------------- 1. the mark
write("mark.svg", svg(mark_element("currentColor", 512, 512, inset=40), 512, 512,
                      extra=LABEL))
write("mark-small.svg", svg(mark_element("currentColor", 512, 512, inset=40,
                            cut="small"), 512, 512, extra=LABEL))
write("mark-red.svg", svg(mark_element(RED, 512, 512, inset=40), 512, 512,
                          extra=LABEL))
write("mark-white.svg", svg(mark_element("#FFFFFF", 512, 512, inset=40), 512, 512,
                            extra=LABEL))


# ------------------------------------------------------- 2. favicon (SVG, ICO)
# Small cut, transparent ground — at 16-32px every pixel of the stroke counts. The
# embedded stylesheet lets the favicon answer the browser's own dark mode. This mark
# strokes rather than fills, so the dark-mode override targets `stroke`, not `fill`.
write("favicon.svg", svg(
    '  <style>\n'
    f'    path {{ stroke: {RED}; }}\n'
    f'    @media (prefers-color-scheme: dark) {{ path {{ stroke: {RED_LIFT}; }} }}\n'
    '  </style>\n' + mark_element("currentColor", 512, 512, inset=36, cut="small"),
    512, 512, extra=LABEL))
write("favicon-small-flat.svg", svg(
    mark_element(RED, 512, 512, inset=36, cut="small"), 512, 512))
write("favicon-display-flat.svg", svg(
    mark_element(RED, 512, 512, inset=40, cut="display"), 512, 512))


# --------------------------------------------------------------- 3. app icons
def app_icon(bg, fg, radius, inset=110, cut="display"):
    """Standard pattern: solid rounded-square tile, glyph centred with padding — an
    open loop stretched full-bleed to a tile's own edges reads wrong, unlike the
    split-square mark this replaced, which effectively was its own tile."""
    return svg(f'  <rect width="512" height="512" rx="{radius}" ry="{radius}" '
               f'fill="{bg}"/>\n' + mark_element(fg, 512, 512, inset, cut), 512, 512)


write("icon-tile.svg", app_icon(RED, CREAM, 112))                # PWA "any"
write("icon-ios.svg", app_icon(RED, CREAM, 0, inset=120))         # iOS adds a squircle
write("icon-tile-cream.svg", app_icon(CREAM, RED, 112))
write("icon-tile-navy.svg", app_icon(NAVY, CREAM, 112))


def maskable_icon():
    """Android crops to a circle inscribed in the 80% safe zone — the glyph must sit
    entirely within the largest square that circle contains."""
    safe_d = 512 * 0.8
    side = safe_d / (2 ** 0.5)
    inset = (512 - side) / 2
    return svg(f'  <rect width="512" height="512" fill="{RED}"/>\n'
               + mark_element(CREAM, 512, 512, inset=inset + side * 0.12), 512, 512)


write("icon-maskable.svg", maskable_icon())


# ----------------------------------------------------------------- 4. lockups
_wm = open(os.path.join(ROOT, "wordmark.svg")).read()
WORDMARK_D = re.search(r'\sd="([^"]+)"', _wm).group(1)
WM_X0, WM_Y0, WM_X1, WM_Y1 = 2.156, 11.572, 243.904, 52.756   # inkscape --query-all
WM_CAP_TOP, WM_BASELINE = 11.572, 44.0
CAP = WM_BASELINE - WM_CAP_TOP
WM_W, WM_H = WM_X1 - WM_X0, WM_Y1 - WM_Y0


def lockup_horizontal(mark_color, word_fill):
    mh = CAP * 1.55
    gap = CAP * 0.62
    pad = 6.0
    my = WM_CAP_TOP + CAP / 2 - mh / 2      # optically centred on the cap band
    dy = pad - min(my, WM_Y0)
    h = (max(my + mh, WM_Y1) - min(my, WM_Y0)) + 2 * pad
    w = pad + mh + gap + WM_W + pad
    return svg(
        mark_element(mark_color, mh, mh, 0.0,
                     extra=f' transform="translate({pad:.2f} {my + dy:.2f})"') + "\n"
        f'  <path fill="{word_fill}" '
        f'transform="translate({pad + mh + gap - WM_X0:.2f} {dy:.2f})" '
        f'd="{WORDMARK_D}"/>',
        round(w), round(h), vb=f"0 0 {w:.2f} {h:.2f}", extra=LABEL)


def lockup_stacked(mark_color, word_fill):
    mh = WM_W * 0.30
    gap = CAP * 0.78
    h = mh + gap + WM_H
    return svg(
        mark_element(mark_color, mh, mh, 0.0,
                     extra=f' transform="translate({(WM_W - mh) / 2:.2f} 0)"') + "\n"
        f'  <path fill="{word_fill}" '
        f'transform="translate({-WM_X0:.2f} {mh + gap - WM_Y0:.2f})" '
        f'd="{WORDMARK_D}"/>',
        round(WM_W), round(h), vb=f"0 0 {WM_W:.2f} {h:.2f}", extra=LABEL)


write("lockup-horizontal.svg", lockup_horizontal("currentColor", "currentColor"))
write("lockup-horizontal-red.svg", lockup_horizontal(RED, INK))
write("lockup-horizontal-reversed.svg", lockup_horizontal("#FFFFFF", "#FFFFFF"))
write("lockup-stacked.svg", lockup_stacked("currentColor", "currentColor"))
write("lockup-stacked-red.svg", lockup_stacked(RED, INK))
write("lockup-stacked-reversed.svg", lockup_stacked("#FFFFFF", "#FFFFFF"))
write("wordmark.svg", _wm)


# ------------------------------------------------------------- 5. social card
def og_card():
    w, h = 1200.0, 630.0
    gh = 400.0
    gx = w - gh - 90.0
    inner = lockup_horizontal(RED, INK)
    m = re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', inner)
    lvw, lvh = float(m.group(1)), float(m.group(2))
    ls = 700.0 / lvw
    body = re.search(r'>\n(.*)\n</svg>', inner, re.S).group(1)
    ghost = mark_element(RED, gh, gh, 0.0,
                         extra=f' opacity="0.13" transform="translate({gx:.1f} '
                               f'{(h - gh) / 2:.1f})"')
    return svg(
        f'  <rect width="{w:.0f}" height="{h:.0f}" fill="{CREAM}"/>\n'
        f'{ghost}\n'
        f'  <g transform="translate(96 {(h - lvh * ls) / 2 - 30:.1f}) scale({ls:.4f})">\n'
        f'{body}\n  </g>\n'
        f'  <text x="98" y="{h / 2 + 76:.0f}" font-family="Barlow, Helvetica, Arial, '
        f'sans-serif" font-size="40" font-weight="500" fill="{NAVY}">'
        f'Name the congressional district from its shape.</text>\n'
        f'  <text x="98" y="{h / 2 + 130:.0f}" font-family="Barlow, Helvetica, Arial, '
        f'sans-serif" font-size="34" font-weight="700" fill="{RED}" '
        f'letter-spacing="1.5">A NEW ONE EVERY DAY</text>',
        int(w), int(h))


write("og-image.svg", og_card())


# ------------------------------------------------------------------ 6. rasters
def png(src, out, size, out_dir=DIST, height=None):
    subprocess.run(["inkscape", os.path.join(HERE, src), "-w", str(size),
                    "-h", str(height or size), "-o", os.path.join(out_dir, out)],
                   capture_output=True, check=True)


def build_rasters():
    png("icon-tile.svg", "icon-192.png", 192)
    png("icon-tile.svg", "icon-512.png", 512)
    png("icon-ios.svg", "apple-touch-icon.png", 180)
    png("icon-maskable.svg", "icon-maskable-512.png", 512)
    png("og-image.svg", "og-image.png", 1200, height=630)

    # favicon.ico — each frame rendered at its own size from vector, small cut at
    # and below CUT_THRESHOLD, display cut above it. Written by hand: Pillow's ICO
    # writer silently collapses multi-frame input to a single frame.
    tmp = os.path.join(HERE, ".ico")
    os.makedirs(tmp, exist_ok=True)
    sizes = [16, 24, 32, 48, 64, 128]
    frames = []
    for s in sizes:
        src = "favicon-small-flat.svg" if s <= CUT_THRESHOLD else "favicon-display-flat.svg"
        png(src, f"f{s}.png", s, out_dir=tmp)
        frames.append(open(os.path.join(tmp, f"f{s}.png"), "rb").read())

    offset = 6 + 16 * len(sizes)
    entries, blobs = b"", b""
    for s, data in zip(sizes, frames):
        entries += struct.pack("<BBBBHHII", s % 256, s % 256, 0, 0, 1, 32,
                               len(data), offset)
        offset += len(data)
        blobs += data
    with open(os.path.join(DIST, "favicon.ico"), "wb") as f:
        f.write(struct.pack("<HHH", 0, 1, len(sizes)) + entries + blobs)
    print("  favicon.ico  (%s)" % ", ".join(str(s) for s in sizes))

    # The in-app logo that replaces logo.svg.
    png("mark.svg", "logo-96.png", 96)
    print("done")


if __name__ == "__main__":
    build_rasters()
