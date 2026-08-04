#!/usr/bin/env python3
"""Generate the Daily District logo system from one parametric source.

THE MARK
    Five unequal districts on a 3x3 lattice, one of them filled: the district you are
    looking for today. It depicts a *districted map* with an answer sitting in it,
    which is the game, rather than depicting a single district.

    The lattice is deliberately UNEVEN — columns 21/14/14, rows 14/21/14 — because an
    even 3x3 grid reads as a word puzzle, not a map. Districts span it 1x2, 2x1, 1x1,
    1x2, 2x1, so they interlock instead of tiling. Every edge lands on a whole unit,
    so the mark rasterises cleanly instead of mushing.

    Four boundary districts are drawn as outlines; the answer cell is solid. Never
    fill the boundaries in the display cut, never outline the answer cell, and never
    colour the districts individually.

    Kept strictly UPRIGHT. Do not rotate the lattice: a prior mark's diagonal variant
    was flagged as reading too close to a hate symbol and reverted immediately, and
    the standing rule since is that anything with a rotational or radiating structure
    is off the table.

OPTICAL SIZES
    The display cut carries the mark in hairlines, and hairlines are the first thing
    lost to a raster. So there are two cuts, the way a type family has optical sizes:

      DISPLAY  4 outlined + 1 filled            above 24px
      SMALL    all 5 filled, boundaries tinted  24px and below

    The small cut is not a scaled display cut — it replaces stroke with tint, so the
    five districts stay separable once the outlines would have filled in. Verified
    against true 16px rasters, not scaled-down vectors.

    python3 brand/build.py

Output goes to brand/ (vector) and brand/dist/ (raster). Nothing here writes into the
site; adopting the system is a deliberate copy out of dist/.

Requires an SVG rasteriser: inkscape, rsvg-convert or the cairosvg module.
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
RED = "#C41230"        # --cmu-red    the answer cell
RED_LIFT = "#FF3B57"   # red lifted for dark grounds, where #C41230 goes muddy
NAVY = "#182C4B"       # --cmu-navy   boundaries, wordmark
CREAM = "#F5F5F3"      # --bg
INK = "#1A1A1A"        # --text

# Small-cut district tints. Mark-local, not brand colours: at 24px and below the
# boundaries stop being outlines and become flat fills, and these are the two values
# that keep adjacent districts apart without competing with the answer cell.
TINT_LIGHT = ("#B9C1CD", "#D5DAE1")
TINT_DARK = ("#3A4C6B", "#56688A")

# ------------------------------------------------------------------- geometry
G = 53.0               # the mark is G x G units
STROKE = 1.6           # 0.03 x G, centred on the district edge
# Lattice: columns 21/14/14 and rows 14/21/14, separated by 2-unit gutters
# (0.04 x G). 21 + 2 + 14 + 2 + 14 = 53, so every edge is a whole unit.

# Five districts, each a plain axis-aligned rect (x, y, w, h). Index 2 is the answer.
DISTRICTS = [
    (0.0, 0.0, 21.0, 37.0),    # 1  col 1, rows 1-2
    (23.0, 0.0, 30.0, 14.0),   # 2  cols 2-3, row 1
    (23.0, 16.0, 14.0, 21.0),  # 3  col 2, row 2 -- the answer cell
    (39.0, 16.0, 14.0, 37.0),  # 4  col 3, rows 2-3
    (0.0, 39.0, 37.0, 14.0),   # 5  cols 1-2, row 3
]
ANSWER = 2

# Padding inside the app-icon plates. The mark's own bounding box is a full square, so
# unlike the rounded-square mark this replaces it cannot run to a rounded tile's edge —
# its corner districts would overhang the corner arc.
TILE_PAD = 0.10        # fraction of the tile, PWA "any" icon
IOS_PAD = 0.13         # iOS crops to a squircle, which bites deeper than our own radius


def n(v, places=3):
    """Trim a coordinate: whole numbers stay whole, the rest keep `places` decimals."""
    s = f"{v:.{places}f}".rstrip("0").rstrip(".")
    return "0" if s in ("", "-", "-0") else s


def t(v):
    """Transform component, to the 2 decimals the lockup ratios are specified at."""
    return str(round(v, 2))


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


def glyph(size, x=0.0, y=0.0, cut="display", stroke=NAVY, answer=RED,
          tints=TINT_LIGHT, indent="  ", classed=False):
    """The mark: four boundary districts and the answer cell, as five rects.

    Display cut: boundaries outlined in `stroke`, answer filled in `answer`.
    Small cut:   boundaries FILLED, alternating `tints`, answer filled in `answer`.

    `classed` adds a d1..d5 class to each rect. Fill and stroke stay on the element as
    presentation attributes, which lose to any stylesheet rule — so a class is all a
    file needs to restate its colours under `prefers-color-scheme: dark`.
    """
    s = size / G
    sw = STROKE * s
    out = []
    for i, (dx, dy, dw, dh) in enumerate(DISTRICTS):
        rx, ry, rw, rh = x + dx * s, y + dy * s, dw * s, dh * s
        cls = f' class="d{i + 1}"' if classed else ""
        if i == ANSWER:
            paint = f'fill="{answer}"'
        elif cut == "display":
            # The stroke is centred, so the rect is drawn inset half a stroke on every
            # side; drawn on the nominal edge, the outer districts would spill half a
            # stroke past the mark's own bounding box.
            rx, ry, rw, rh = rx + sw / 2, ry + sw / 2, rw - sw, rh - sw
            paint = f'fill="none" stroke="{stroke}" stroke-width="{n(sw)}"'
        else:
            paint = f'fill="{tints[i % 2]}"'
        out.append(f'{indent}<rect{cls} x="{n(rx)}" y="{n(ry)}" width="{n(rw)}" '
                   f'height="{n(rh)}" {paint}></rect>')
    return "\n".join(out)


LABEL = ' role="img" aria-label="Daily District"'
VB = f"0 0 {n(G)} {n(G)}"


def mark_svg(**kw):
    return svg(glyph(G, **kw), 512, 512, vb=VB, extra=LABEL)


# ---------------------------------------------------------------- 1. the mark
write("mark.svg", mark_svg())                                       # primary
write("mark-mono.svg", mark_svg(stroke="currentColor", answer="currentColor"))
write("mark-reversed.svg", mark_svg(stroke=CREAM, answer=RED_LIFT))  # dark grounds
write("mark-knockout.svg", mark_svg(stroke=CREAM, answer=CREAM))     # red panels
# The site's /logo.svg is a copy of this file. It is the primary mark baked, byte for
# byte — mark.svg would serve, but the adoption step copies out by this name and has
# since the first mark, so the name stays.
write("mark-red.svg", mark_svg())
write("mark-small.svg", mark_svg(cut="small"))
write("mark-small-reversed.svg", mark_svg(cut="small", answer=RED_LIFT,
                                          tints=TINT_DARK))


# ------------------------------------------------------- 2. favicon (SVG, ICO)
# Small cut, minimal padding — at 16px every pixel counts. The embedded stylesheet
# restates the three fills so the favicon answers the browser's own dark mode.
write("favicon.svg", svg(
    '  <style>\n'
    '    @media (prefers-color-scheme: dark) {\n'
    f'      .d1, .d5 {{ fill: {TINT_DARK[0]}; }}\n'
    f'      .d2, .d4 {{ fill: {TINT_DARK[1]}; }}\n'
    f'      .d3 {{ fill: {RED_LIFT}; }}\n'
    '    }\n'
    '  </style>\n'
    + glyph(456, 28, 28, cut="small", classed=True), 512, 512, extra=LABEL))
# Flat feeds for the .ico frames: no classes, no media query, since the rasteriser
# renders these directly and would never resolve either.
write("favicon-small-flat.svg", svg(glyph(456, 28, 28, cut="small"), 512, 512))
write("favicon-display-flat.svg", svg(glyph(456, 28, 28), 512, 512))


# --------------------------------------------------------------- 3. app icons
def app_icon(plate, radius_px, pad, stroke=NAVY, answer=RED, tints=TINT_LIGHT):
    """A plate in the ground colour, with the mark centred on it.

    The mark is opaque, so unlike the seam mark this replaces the plate is purely a
    ground rather than something showing through the artwork. It is still needed: a
    transparent tile would put a home screen wallpaper behind the districts.

    The mark is inset rather than full-bleed. Its bounding box is a full square, so on
    a rounded tile its corner districts would sit outside the corner arc.
    """
    inset = 512 * pad
    return svg(f'  <path fill="{plate}" '
               f'd="{_rounded_rect(0, 0, 512, 512, radius_px)}"/>\n'
               + glyph(512 - 2 * inset, inset, inset, stroke=stroke, answer=answer,
                       tints=tints), 512, 512)


def maskable_icon(ground, plate, stroke=NAVY, answer=RED):
    """Android crops maskable icons to a circle inscribed in the 80% safe zone, so the
    mark is sized to sit entirely within that circle and the ground carries the bleed.
    A full-bleed mark would lose its outer districts to the crop, leaving the answer
    cell floating with nothing to be an answer to."""
    safe_d = 512 * 0.8                       # safe circle diameter
    side = safe_d / (2 ** 0.5)               # largest square inside it
    inset = (512 - side) / 2
    r_px = 0.10 * side
    pad = 0.08 * side                        # clears the plate's own corner arc
    return svg(f'  <rect width="512" height="512" fill="{ground}"/>\n'
               f'  <path fill="{plate}" '
               f'd="{_rounded_rect(inset, inset, side, side, r_px)}"/>\n'
               + glyph(side - 2 * pad, inset + pad, inset + pad,
                       stroke=stroke, answer=answer), 512, 512)


write("icon-tile.svg", app_icon(CREAM, 112, TILE_PAD))                  # PWA "any"
write("icon-ios.svg", app_icon(CREAM, 0, IOS_PAD))       # iOS adds its own squircle
write("icon-maskable.svg", maskable_icon(RED, CREAM))
write("icon-tile-cream.svg", app_icon(RED, 112, TILE_PAD,               # knockout
                                      stroke=CREAM, answer=CREAM))
write("icon-tile-navy.svg", app_icon(NAVY, 112, TILE_PAD,               # reversed
                                     stroke=CREAM, answer=RED_LIFT))


# ----------------------------------------------------------------- 4. lockups
_wm = open(os.path.join(ROOT, "wordmark.svg")).read()
WORDMARK_D = re.search(r'\sd="([^"]+)"', _wm).group(1)
WM_VB_W, WM_VB_H = 260.0, 56.0     # wordmark.svg viewBox

GAP_H = 14.0        # mark to wordmark, horizontal lockup
WM_RATIO_H = 0.74   # wordmark height as a fraction of mark height
GAP_V = 12.0        # mark to wordmark, stacked lockup
WM_RATIO_V = 2.29   # wordmark width as a multiple of mark width


def lockup_horizontal(stroke, answer, word):
    """Mark at full size, wordmark scaled to 0.74 of it and centred against it."""
    s = G * WM_RATIO_H / WM_VB_H
    wx = G + GAP_H
    wy = (G - WM_VB_H * s) / 2
    w = wx + WM_VB_W * s
    return svg(
        glyph(G, stroke=stroke, answer=answer) + "\n"
        f'  <g transform="translate({t(wx)} {t(wy)}) scale({round(s, 5)})">'
        f'<path fill="{word}" d="{WORDMARK_D}"></path></g>',
        round(w), round(G), vb=f"0 0 {n(round(w, 1))} {n(G)}", extra=LABEL)


def lockup_stacked(stroke, answer, word):
    """Wordmark set to 2.29 mark widths, mark centred above it."""
    ww = G * WM_RATIO_V
    s = ww / WM_VB_W
    wy = G + GAP_V
    h = wy + WM_VB_H * s
    return svg(
        f'  <g transform="translate({t((ww - G) / 2)} 0)">\n'
        + glyph(G, stroke=stroke, answer=answer, indent="    ") + "\n"
        '  </g>\n'
        f'  <g transform="translate(0 {t(wy)}) scale({round(s, 5)})">'
        f'<path fill="{word}" d="{WORDMARK_D}"></path></g>',
        round(ww), round(h),
        vb=f"0 0 {n(round(ww, 1))} {n(round(h, 1))}", extra=LABEL)


write("lockup-horizontal.svg", lockup_horizontal(NAVY, RED, NAVY))     # primary
write("lockup-horizontal-mono.svg",
      lockup_horizontal("currentColor", "currentColor", "currentColor"))
write("lockup-horizontal-reversed.svg", lockup_horizontal(CREAM, RED_LIFT, CREAM))
write("lockup-stacked.svg", lockup_stacked(NAVY, RED, NAVY))
write("lockup-stacked-mono.svg",
      lockup_stacked("currentColor", "currentColor", "currentColor"))
write("lockup-stacked-reversed.svg", lockup_stacked(CREAM, RED_LIFT, CREAM))
write("wordmark.svg", _wm)


# ------------------------------------------------------------- 5. social card
def og_card():
    w, h = 1200.0, 630.0
    # A low-opacity ghost, oversized and bleeding off the right edge. It uses the SMALL
    # (filled) cut in one colour: a filled shape fading off-canvas reads fine, where
    # the display cut's outlines treated the same way read as cut-off picture frames.
    gs = 470.0
    gx = 838.0
    inner = lockup_horizontal(NAVY, RED, NAVY)
    m = re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', inner)
    lvw, lvh = float(m.group(1)), float(m.group(2))
    ls = 700.0 / lvw
    body = re.search(r'>\n(.*)\n</svg>', inner, re.S).group(1)
    return svg(
        f'  <rect width="{w:.0f}" height="{h:.0f}" fill="{CREAM}"/>\n'
        f'  <g fill-opacity="0.13">\n'
        + glyph(gs, gx, (h - gs) / 2, cut="small", answer=RED, tints=(RED, RED),
                indent="    ") + "\n"
        f'  </g>\n'
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
def _rasteriser():
    """First of inkscape / rsvg-convert / cairosvg that this machine actually has."""
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
    png("icon-tile.svg", "icon-192.png", 192)
    png("icon-tile.svg", "icon-512.png", 512)
    png("icon-ios.svg", "apple-touch-icon.png", 180)
    png("icon-maskable.svg", "icon-maskable-512.png", 512)
    png("og-image.svg", "og-image.png", 1200, height=630)

    # favicon.ico — each frame rendered at its own size from vector, and the small
    # frames use the SMALL cut rather than a downscale of the display cut. Written by
    # hand: Pillow's ICO writer silently collapses append_images to a single frame.
    tmp = os.path.join(HERE, ".ico")
    os.makedirs(tmp, exist_ok=True)
    sizes = [16, 24, 32, 48, 64, 128]
    frames = []
    for s in sizes:
        src = "favicon-small-flat.svg" if s <= 32 else "favicon-display-flat.svg"
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

    # The in-app logo that replaces the site's logo.svg.
    png("mark-red.svg", "logo-96.png", 96)
    print("done")


if __name__ == "__main__":
    build_rasters()
