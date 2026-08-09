#!/usr/bin/env python3
"""Generate the Daily District "Ghost D" logo system from one parametric source.

THE MARK
    A closed square frame with two D letterforms carved into the negative space —
    one glyph and its 180-degree rotation about the centre. Their stems land on
    the frame's inner edge and their bowls overlap across the middle, so four
    regions meet with no gaps. ONE colour plate: frame and both D's are always
    the same colour. Red (#C41230) is an in-product state, never the resting mark.

    Drawn on a 100 x 100 grid. This file is the source of truth for the geometry
    (the two cuts below); it reproduces every asset byte-for-byte without the
    design handoff present. The handoff lives, gitignored, under
    explorations/ghost-d-handoff/ for re-verification only.

OPTICAL SIZES
    Two cuts, like a type family's optical sizes:
      DISPLAY  frame inset 4, D stroke 7.5   above 24px
      SMALL    full-bleed frame, D stroke 14  24px and below
    The small cut reclaims the 4-unit inset and thickens the stroke so the
    interior holds at favicon sizes instead of closing to a solid square.

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
NAVY = "#182C4B"        # --dd-navy   primary mark + text
RED = "#C41230"         # --dd-red    CMU Red, accent / solved state
RED_LIFT = "#FF3B57"    # --dd-red-dark   red lifted for dark grounds
WHITE = "#FFFFFF"
CREAM = "#F4F3F1"       # --dd-bg     light ground
INK = "#15171B"

# ------------------------------------------------------------------- geometry
# Canonical Ghost D path data on the 100-unit grid, per the brand book. The two
# D's are one letterform and its 180-degree rotation; the frame is an even-odd
# square ring. These strings ARE the mark — never redrawn, only scaled/tinted.
DISPLAY = {
    "frame": "M4 4h92v92H4z M21 21h58v58H21z",
    "d1": "M21 21v37h19l12-12V33L40 21Z",
    "d2": "M79 79V42H60L48 54v13l12 12Z",
    "stroke": 7.5,
}
SMALL = {   # 24px and below: full-bleed frame, thicker stroke
    "frame": "M0 0h100v100H0z M22 22h56v56H22z",
    "d1": "M22 22v36h18l12-12V34L40 22Z",
    "d2": "M78 78V42H60L48 54v12l12 12Z",
    "stroke": 14,
}
G = 100.0  # grid size


def num(v):
    """Trim a number: whole stays whole, else up to 4 decimals."""
    s = f"{v:.4f}".rstrip("0").rstrip(".")
    return s or "0"


def glyph(size=G, x=0.0, y=0.0, cut=DISPLAY, color="currentColor", indent=""):
    """The mark at `size`, top-left at (x, y), in one colour.

    Emitted as the canonical 100-grid paths wrapped in a translate+scale, so the
    path data (and byte-for-byte identity of the primary files) never changes.
    """
    d_grp = (f'<g fill="none" stroke="{color}" stroke-width="{num(cut["stroke"])}" '
             f'stroke-linejoin="miter"><path d="{cut["d1"]}"></path>'
             f'<path d="{cut["d2"]}"></path></g>')
    frame = f'<g fill="{color}"><path fill-rule="evenodd" d="{cut["frame"]}"></path></g>'
    body = d_grp + frame
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
# The site's /logo.svg is the primary mark baked in CMU Red (currentColor renders
# black in an <img>), so it matches the red wordmark it sits beside — in both light
# and dark, where the red wordmark does not shift, so the mark holds red too.
write("logo.svg", svg(glyph(color=RED)))


# ------------------------------------------------------- 2. favicon (SVG, ICO)
# Small cut in CMU Red, lifting to #FF3B57 under the browser's own dark mode
# (plain #C41230 goes muddy on a dark tab bar).
_fav_body = glyph(cut=SMALL, color=RED)
_fav_body = _fav_body.replace(
    f'stroke="{RED}"', f'class="gd-s" stroke="{RED}"').replace(
    f'<g fill="{RED}">', f'<g class="gd-f" fill="{RED}">')
write("favicon.svg", svg(
    f'<style>@media (prefers-color-scheme:dark){{.gd-s{{stroke:{RED_LIFT}}}'
    f'.gd-f{{fill:{RED_LIFT}}}}}</style>' + _fav_body))
# Flat feeds for the .ico frames — no media query, no currentColor.
write("favicon-small-red.svg", svg(glyph(cut=SMALL, color=RED)))
write("favicon-display-red.svg", svg(glyph(color=RED)))


# --------------------------------------------------------------- 3. app icons
def app_icon(plate, mark_color, pad):
    """A square plate in `plate`, the mark inset by `pad` (fraction of the tile).

    The mark's bounding box is a full square, so it insets inside the plate — it
    never bleeds to the edge, or a rounded tile would clip its corners.
    """
    inset = 512 * pad
    return svg(f'<rect width="512" height="512" fill="{plate}"></rect>'
               + glyph(512 - 2 * inset, inset, inset, color=mark_color),
               vb="0 0 512 512")


write("app-icon.svg", app_icon(RED, WHITE, 0.1875))        # PWA "any" / iOS (primary)
write("app-icon-maskable.svg", app_icon(RED, WHITE, 0.27))   # Android safe circle
write("app-icon-navy.svg", app_icon(NAVY, WHITE, 0.1875))  # alternate / event skin


# ----------------------------------------------------------------- 4. lockups
_wm = open(os.path.join(ROOT, "wordmark.svg")).read()
WORDMARK_D = re.search(r'\sd="([^"]+)"', _wm).group(1)
WM_W, WM_H = 260.0, 56.0                 # wordmark.svg viewBox

# Horizontal: mark 100 tall, 24-unit gap, wordmark at native size, vertically
# centred. Stacked: mark centred over the wordmark set to the full 180 width.
GAP_H, GAP_V = 24.0, 20.0


def lockup_horizontal(color):
    wx, wy = G + GAP_H, (G - WM_H) / 2
    w = wx + WM_W
    return svg(glyph(color=color)
               + f'<g transform="translate({num(wx)} {num(wy)})">'
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
write("lockup-stacked.svg", lockup_stacked("currentColor"))
write("wordmark.svg", _wm)


# ------------------------------------------------------------- 5. social card
def og_card():
    w, h = 1200.0, 630.0
    lock = lockup_horizontal(RED)
    lvw = float(re.search(r'viewBox="0 0 ([\d.]+)', lock).group(1))
    inner = re.search(r'">(.*)</svg>', lock, re.S).group(1)
    ls = 660.0 / lvw
    ly = (h - 100 * ls) / 2 - 34
    gs, gx = 500.0, 860.0
    gy = (h - gs) / 2
    return svg(
        f'<rect width="{w:.0f}" height="{h:.0f}" fill="{CREAM}"></rect>'
        f'<g opacity="0.1">{glyph(gs, gx, gy, color=RED)}</g>'
        f'<g transform="translate(96 {ly:.1f}) scale({ls:.4f})">{inner}</g>'
        f'<text x="98" y="{h / 2 + 82:.0f}" font-family="Space Grotesk, Barlow, '
        f'Helvetica, Arial, sans-serif" font-size="40" font-weight="500" '
        f'fill="{INK}">Name the congressional district from its shape.</text>'
        f'<text x="98" y="{h / 2 + 136:.0f}" font-family="JetBrains Mono, Barlow, '
        f'Helvetica, Arial, sans-serif" font-size="30" font-weight="700" '
        f'fill="{RED}" letter-spacing="2">A NEW ONE EVERY DAY</text>',
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
        src = "favicon-small-red.svg" if s <= 32 else "favicon-display-red.svg"
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
