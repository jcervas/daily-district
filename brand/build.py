#!/usr/bin/env python3
"""Generate the Daily District "Split-D Polygon" logo system from one parametric
source.

THE MARK
    A ring holding two half-figures: a D on the right, a reversed D on the left,
    split by a vertical channel. Each half is a straight stem plus 13 surveyed
    edges — 14 sides each, 28 in total, after the "uncouth twenty-eight-sided
    figure" at the centre of Gomillion v. Lightfoot (1960), the boundary drawn to
    fence Tuskegee's Black voters out of town. Here the figure sits inside a whole
    circle — the district, held.

    The channel between the stems and the gap between figure and ring both equal
    the ring stroke. The two halves are deliberately not mirror images: different
    vertex offsets, slightly different arc spans (164 degrees right, 158 left).

    Drawn on a 100 x 100 grid, centered on (50, 50). One color throughout — never a
    two-color split of ring and figures, never a gradient. The RIGHT/LEFT path data
    below IS the mark for each cut — never redrawn, only tinted. This file is the
    source of truth for the geometry; it reproduces every asset byte-for-byte.

OPTICAL SIZES
    Two cuts, like a type family's optical sizes:
      DISPLAY  ring r44, stroke 5.28   above 24px
      SMALL    ring r44, stroke 7.9    24px and below
    The small cut's figures are their own hand-tuned coordinates (stems at +-3.96
    instead of +-2.64, outer extent 32.1 instead of 36.1) rather than a scaled
    DISPLAY figure, so the channel and the ring gap keep tracking the heavier
    small-cut stroke width instead of thinning out.

    python3 brand/build.py

Output goes to brand/ (vector) and brand/dist/ (raster). Nothing here writes into
the site; adopting the system is a deliberate copy out (see the list printed at
the end). Requires an SVG rasteriser: inkscape, rsvg-convert or the cairosvg module.
"""
import os
import re
import shutil
import struct
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DIST = os.path.join(HERE, "dist")
os.makedirs(DIST, exist_ok=True)

# ---------------------------------------------------------------- brand tokens
NAVY = "#182C4B"        # --dd-navy   alternate colourway
RED = "#C41230"         # --dd-red    CMU Red, site primary
RED_LIFT = "#FF3B57"    # --dd-red-dark   red lifted for dark grounds
WHITE = "#FFFFFF"
CREAM = "#F4F3F1"       # --dd-bg     light ground
INK = "#15171B"

# ------------------------------------------------------------------- geometry
G = 100.0  # grid size


def num(v):
    """Trim a number: whole stays whole, else up to 4 decimals."""
    s = f"{v:.4f}".rstrip("0").rstrip(".")
    return s or "0"


# Canonical "Split-D Polygon" geometry on the 100-unit grid, centered on (50, 50).
# Each half is a straight stem plus 13 surveyed edges, after the Gomillion v.
# Lightfoot boundary. Not mirror images of each other — different vertex offsets,
# different arc spans — so never derive one half from the other.
RIGHT_DISPLAY = ("M52.64 20.06 L63.93 20.00 L68.38 25.97 L76.29 27.04 L78.93 33.87 "
                  "L78.95 40.98 L84.20 46.51 L85.70 53.65 L80.10 59.41 L78.93 66.13 "
                  "L75.85 72.54 L68.22 73.78 L63.71 79.43 L52.64 79.94 Z")
LEFT_DISPLAY = ("M47.36 20.22 L35.91 23.22 L28.43 23.26 L24.79 29.29 L23.02 35.73 "
                "L15.67 39.56 L18.10 46.89 L15.69 53.37 L15.96 60.34 L22.76 64.42 "
                "L24.56 70.92 L28.60 76.49 L36.03 76.50 L47.36 79.78 Z")
# Small cut: its own hand-tuned coordinates (not a scaled DISPLAY figure) so the
# channel and the ring gap keep tracking the heavier stroke width.
RIGHT_SMALL = ("M53.96 24.35 L63.63 24.30 L67.45 29.41 L74.22 30.33 L76.48 36.18 "
               "L76.51 42.27 L81.00 47.01 L82.28 53.13 L77.49 58.07 L76.48 63.82 "
               "L73.85 69.31 L67.30 70.37 L63.45 75.22 L53.96 75.65 Z")
LEFT_SMALL = ("M46.04 24.46 L36.22 27.03 L29.80 27.07 L26.67 32.23 L25.16 37.76 "
              "L18.85 41.05 L20.94 47.33 L18.87 52.89 L19.10 58.87 L24.94 62.37 "
              "L26.48 67.94 L29.95 72.72 L36.32 72.73 L46.04 75.54 Z")
DISPLAY = {"r": 44, "ring": 5.28, "right": RIGHT_DISPLAY, "left": LEFT_DISPLAY}
SMALL = {"r": 44, "ring": 7.9, "right": RIGHT_SMALL, "left": LEFT_SMALL}


def glyph(size=G, x=0.0, y=0.0, cut=DISPLAY, color="currentColor", indent=""):
    """The mark at `size`, top-left at (x, y), in one colour.

    Ring: a plain stroked circle — the district, held whole. Figures: the two
    surveyed half-polygons, always filled (never outlined — unlike an earlier
    single-figure Polygon draft, splitting into two smaller figures keeps each one
    legible without needing an outline fallback at small sizes).
    """
    ring = (f'<circle cx="50" cy="50" r="{num(cut["r"])}" fill="none" '
            f'stroke="{color}" stroke-width="{num(cut["ring"])}"></circle>')
    figures = (f'<path d="{cut["right"]}" fill="{color}"></path>'
               f'<path d="{cut["left"]}" fill="{color}"></path>')
    body = ring + figures
    if size == G and x == 0 and y == 0:
        return indent + body
    s = size / G
    return (f'{indent}<g transform="translate({num(x)} {num(y)}) '
            f'scale({num(s)})">{body}</g>')


def svg(body, vb="0 0 100 100", label=True):
    lab = ' role="img" aria-label="Daily District"' if label else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}"{lab}>'
            f'{body}</svg>\n')


def write(name, text):
    open(os.path.join(HERE, name), "w").write(text)


# ---------------------------------------------------------------- 1. the mark
write("mark.svg", svg(glyph()))                                 # primary, currentColor
write("mark-small.svg", svg(glyph(cut=SMALL)))
write("mark-navy.svg", svg(glyph(color=NAVY)))                  # baked navy (alternate)
write("mark-red.svg", svg(glyph(color=RED)))                    # baked red (site primary)
write("mark-small-red.svg", svg(glyph(cut=SMALL, color=RED)))
write("mark-white.svg", svg(glyph(color=WHITE)))               # baked white (dark grounds)
# The site's /logo.svg is the primary mark baked in CMU Red (currentColor renders
# black in an <img>), so it matches the red wordmark it sits beside — in both light
# and dark, where the red wordmark does not shift, so the mark holds red too.
write("logo.svg", svg(glyph(color=RED)))


# ------------------------------------------------------- 2. favicon (SVG, ICO)
# Small cut, lifting to #FF3B57 under the browser's own dark mode (plain #C41230
# goes muddy on a dark tab bar). Drawn with currentColor and an explicit `color` on
# the root, so one CSS declaration recolours the ring and both figures together —
# no separate hooks needed for the two attribute types.
write("favicon.svg", svg(
    f'<style>:root{{color:{RED}}} '
    f'@media (prefers-color-scheme:dark){{:root{{color:{RED_LIFT}}}}}</style>'
    + glyph(cut=SMALL)))
# Flat feeds for the .ico frames — no media query, no currentColor.
write("favicon-small-red.svg", svg(glyph(cut=SMALL, color=RED)))
write("favicon-display-red.svg", svg(glyph(color=RED)))


# --------------------------------------------------------------- 3. app icons
def app_icon(plate, mark_color, pad):
    """A square plate in `plate`, the mark inset by `pad` (fraction of the tile).

    The ring insets well inside the plate — it never bleeds to the edge, or a
    rounded tile would clip it.
    """
    inset = 512 * pad
    return svg(f'<rect width="512" height="512" fill="{plate}"></rect>'
               + glyph(512 - 2 * inset, inset, inset, color=mark_color),
               vb="0 0 512 512")


write("app-icon.svg", app_icon(RED, WHITE, 0.1875))        # PWA "any" / iOS (primary)
write("app-icon-maskable.svg", app_icon(RED, WHITE, 0.27))   # Android safe circle
write("app-icon-navy.svg", app_icon(NAVY, WHITE, 0.1875))  # alternate / event skin

# Social avatars — the same plated mark, tuned for a platform's circle crop
# (X/Instagram/etc.). The ring sits well inside the inscribed circle. A cream
# plate with the red ring gives a lighter option for pale timelines.
write("avatar-red.svg", app_icon(RED, WHITE, 0.16))
write("avatar-navy.svg", app_icon(NAVY, WHITE, 0.16))
write("avatar-cream.svg", app_icon(CREAM, RED, 0.16))


# ----------------------------------------------------------------- 4. lockups
_wm = open(os.path.join(ROOT, "wordmark.svg")).read()
WORDMARK_D = re.search(r'\sd="([^"]+)"', _wm).group(1)
WM_W, WM_H = 260.0, 56.0                 # wordmark.svg viewBox

# Horizontal: mark 100 tall, wordmark set at 1.13x native size so its x-height
# reads level with the ring's own stroke weight — a plain unscaled placement (as a
# naive "gap + native size" formula would produce) sits the wordmark too light
# next to this heavier two-figure mark. Stacked: mark centred over the wordmark
# set to the full 180 width.
LOCKUP_WX, LOCKUP_WY, LOCKUP_WS = 126.0, 22.0, 1.13
GAP_V = 20.0


def lockup_horizontal(color):
    w = 420.0
    return svg(glyph(color=color)
               + f'<g transform="translate({num(LOCKUP_WX)} {num(LOCKUP_WY)}) '
               f'scale({num(LOCKUP_WS)})">'
               f'<path fill="{color}" d="{WORDMARK_D}"></path></g>',
               vb=f"0 0 {num(w)} {num(G)}")


def lockup_stacked(color):
    ww = 180.0
    s = ww / WM_W
    mx = (ww - G) / 2
    wy = G + GAP_V
    h = wy + WM_H * s
    return svg(f'<g transform="translate({num(mx)} 0)">{glyph(color=color)}</g>'
               f'<g transform="translate(0 {num(wy)}) scale({num(s)})">'
               f'<path fill="{color}" d="{WORDMARK_D}"></path></g>',
               vb=f"0 0 {num(ww)} {num(round(h, 2))}")


write("lockup-horizontal.svg", lockup_horizontal("currentColor"))
write("lockup-red.svg", lockup_horizontal(RED))
write("lockup-white.svg", lockup_horizontal(WHITE))
write("lockup-stacked.svg", lockup_stacked("currentColor"))
write("wordmark.svg", _wm)


# ------------------------------------------------------------- 5. social card
def og_card():
    """Red plate, white mark + white wordmark, centred — no tagline. Matches the
    lockup's own 1.13x wordmark scale in spirit (the mark and wordmark sizes here
    are picked independently, tuned to fill the 1200x630 card)."""
    w, h = 1200.0, 630.0
    return svg(
        f'<rect width="{w:.0f}" height="{h:.0f}" fill="{RED}"></rect>'
        f'<g transform="translate(430 130) scale(3.4)">{glyph(color=WHITE)}</g>'
        f'<g transform="translate(340 500) scale(1.98)">'
        f'<path fill="{WHITE}" d="{WORDMARK_D}"></path></g>',
        vb=f"0 0 {w:.0f} {h:.0f}")


write("og-image.svg", og_card())


# ------------------------------------------------------------------ 6. rasters
def _rasteriser():
    """First of inkscape / rsvg-convert / cairosvg that this machine has."""
    for exe, argv in (("inkscape", lambda s, o, w, h: [
                          "inkscape", s, "-w", str(w), "-h", str(h), "-o", o]),
                      ("rsvg-convert", lambda s, o, w, h: [
                          "rsvg-convert", s, "-w", str(w), "-h", str(h), "-o", o])):
        if shutil.which(exe):
            return lambda s, o, w, h: subprocess.run(argv(s, o, w, h),
                                                     capture_output=True, check=True)
    import cairosvg  # noqa: E402
    return lambda s, o, w, h: cairosvg.svg2png(url=s, write_to=o,
                                               output_width=w, output_height=h)


RASTERISE = None


def png(src, out, size, out_dir=DIST, height=None):
    global RASTERISE
    if RASTERISE is None:
        RASTERISE = _rasteriser()
    RASTERISE(os.path.join(HERE, src), os.path.join(out_dir, out),
              size, height or size)


def build_rasters():
    png("app-icon.svg", "icon-192.png", 192)               # PWA "any"
    png("app-icon.svg", "icon-512.png", 512)
    png("app-icon.svg", "apple-touch-icon.png", 180)       # iOS home screen
    png("app-icon-maskable.svg", "icon-maskable-512.png", 512)
    png("og-image.svg", "og-image.png", 1200, height=630)

    # favicon.ico — each frame rendered at its own size from vector; the small
    # frames use the SMALL cut, larger frames the display cut. Written by hand:
    # Pillow's ICO writer silently collapses append_images to a single frame.
    tmp = os.path.join(HERE, ".ico")
    os.makedirs(tmp, exist_ok=True)
    sizes = [16, 24, 32, 48, 64, 128]
    frames = []
    for s in sizes:
        src = "favicon-small-red.svg" if s <= 24 else "favicon-display-red.svg"
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
    shutil.rmtree(tmp, ignore_errors=True)
    print("  favicon.ico  (%s)" % ", ".join(str(s) for s in sizes))

    png("logo.svg", "logo-96.png", 96)                     # older clients

    # Social profile pictures at 1000px (upload size; platforms downscale).
    png("avatar-red.svg", "avatar-red-1000.png", 1000)
    png("avatar-navy.svg", "avatar-navy-1000.png", 1000)
    png("avatar-cream.svg", "avatar-cream-1000.png", 1000)
    print("avatars      (red, navy, cream @ 1000px)")
    print("done")


if __name__ == "__main__":
    build_rasters()
    print("\nSite files to copy out of brand/:")
    for a, b in [("logo.svg", "logo.svg"), ("favicon.svg", "favicon.svg"),
                 ("dist/favicon.ico", "favicon.ico"), ("dist/icon-192.png", "icon-192.png"),
                 ("dist/icon-512.png", "icon-512.png"),
                 ("dist/icon-maskable-512.png", "icon-maskable-512.png"),
                 ("dist/apple-touch-icon.png", "apple-touch-icon.png"),
                 ("dist/og-image.png", "og-image.png")]:
        print(f"  brand/{a:<28} -> {b}")
