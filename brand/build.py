#!/usr/bin/env python3
"""Generate the Daily District "Isoline" logo system from one parametric source.

THE MARK
    A wireframe globe: the limb (a stroked circle), the polar axis (a straight
    vertical line through the center), and one or two meridians east of the axis
    (elliptical arcs sharing the limb's own curvature). Both hidden letters share
    the axis as their stem — the inner meridian closes a narrow D, the outer one a
    wider D around it. Every line is one a cartographer would already draw, so the
    letters are there once you look for them and invisible until you do.

    Drawn on a 100 x 100 grid, centered on (50, 50). One color throughout — never a
    two-color split, never a gradient. This file is the source of truth for the
    geometry; it reproduces every asset byte-for-byte.

OPTICAL SIZES
    Two cuts, like a type family's optical sizes:
      DISPLAY  ring r44, stroke 6   above 24px    two meridians (rx 20, 35)
      SMALL    ring r45, stroke 8   24px and below   one meridian (rx 28)
    Below 24px the three concentric curves (axis + two meridians) converge at both
    poles and start to merge, so the small cut drops the outer meridian and
    thickens everything — one D survives instead of two.

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
# Canonical "Isoline" geometry on the 100-unit grid. `meridians` lists the
# elliptical arcs' semi-minor axes (rx), east of the polar axis, sharing the
# limb's own radius as ry — the only way an arc meets the limb exactly tangent.
DISPLAY = {"r": 44, "ring": 6, "axis": 5, "meridians": [20, 35], "mer": 5}
SMALL = {"r": 45, "ring": 8, "axis": 6, "meridians": [28], "mer": 6}
G = 100.0  # grid size


def num(v):
    """Trim a number: whole stays whole, else up to 4 decimals."""
    s = f"{v:.4f}".rstrip("0").rstrip(".")
    return s or "0"


def glyph(size=G, x=0.0, y=0.0, cut=DISPLAY, color="currentColor", indent=""):
    """The mark at `size`, top-left at (x, y), in one colour.

    Limb: a plain stroked circle. Axis: a straight round-capped stroke through the
    center, top to bottom. Meridians: elliptical arcs sharing the limb's own radius
    as ry, so each one meets the limb exactly tangent at both poles — no seam to
    align, because an arc and its parent circle sharing a radius can't fail to
    match there.
    """
    r = cut["r"]
    top, bot = num(50 - r), num(50 + r)
    limb = (f'<circle cx="50" cy="50" r="{num(r)}" fill="none" stroke="{color}" '
            f'stroke-width="{num(cut["ring"])}"></circle>')
    axis = (f'<line x1="50" y1="{top}" x2="50" y2="{bot}" fill="none" stroke="{color}" '
            f'stroke-width="{num(cut["axis"])}" stroke-linecap="round"></line>')
    meridians = "".join(
        f'<path d="M50 {top} A {num(rx)} {num(r)} 0 0 1 50 {bot}" fill="none" '
        f'stroke="{color}" stroke-width="{num(cut["mer"])}" stroke-linecap="round">'
        f'</path>'
        for rx in cut["meridians"])
    body = limb + axis + meridians
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
# the root, so one CSS declaration recolours the limb, axis and meridian together —
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

    The limb insets well inside the plate — it never bleeds to the edge, or a
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
# (X/Instagram/etc.). The limb sits well inside the inscribed circle. A cream
# plate with the red limb gives a lighter option for pale timelines.
write("avatar-red.svg", app_icon(RED, WHITE, 0.16))
write("avatar-navy.svg", app_icon(NAVY, WHITE, 0.16))
write("avatar-cream.svg", app_icon(CREAM, RED, 0.16))


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
write("lockup-red.svg", lockup_horizontal(RED))
write("lockup-white.svg", lockup_horizontal(WHITE))
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
