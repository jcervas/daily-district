#!/usr/bin/env python3
"""Generate the Daily District logo system from one parametric source.

THE MARK
    One square, two districts, divided by a jogged seam. It depicts *districting* —
    the act of drawing the line — rather than depicting a district. Every jog is a
    right angle on a 12x12 cell grid, because congressional districts are assembled
    from census blocks and real boundaries are all right angles and jogs. The grid
    also means every edge lands on a whole cell, so the mark rasterises cleanly.

    The mark is built as ONE path: the square, plus the seam channel as an evenodd
    hole. So the channel is always transparent, and the same path serves the bare
    logo, the app tile and the maskable icon — only the outer radius changes.

    Kept strictly UPRIGHT. Do not rotate this mark or angle its outer square: a prior
    diagonal variant turned the square into a diamond with bent segments radiating
    from its centre and was flagged as reading too close to a hate symbol, then
    reverted immediately. The seam's own jogs are angular by design; the square's
    sides and the canvas orientation are not to be touched.

OPTICAL SIZES
    The mark carries its meaning in an interior seam, and interior detail is the first
    thing lost when a mark is rasterised small. So there are two cuts, the way a type
    family has optical sizes:

      DISPLAY  3 jogs, 1.6-cell channel   >= 48px
      SMALL    2 jogs, 2.6-cell channel   <= 32px

    The small cut is not a scaled display cut — it is redrawn with fewer jogs and a
    wider channel. Verified against true 16px rasters; a 1-jog cut was tried and
    rejected because it loses the interlock and reads as two bars.

    python3 brand/build.py

Output goes to brand/ (vector) and brand/dist/ (raster). Nothing here writes into the
site; adopting the system is a deliberate copy out of dist/.

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
G = 12.0               # the mark is G x G cells

# Seams run top edge to bottom edge. Vertices alternate: down, across, down...
SEAM_DISPLAY = [(6, 0), (6, 3), (4, 3), (4, 6), (8, 6), (8, 9), (5, 9), (5, 12)]
SEAM_SMALL = [(6, 0), (6, 4), (4, 4), (4, 8), (8, 8), (8, 12)]

CH_DISPLAY = 1.6
CH_SMALL = 2.6

RADIUS = 1.2           # default corner radius, in cells


def _offset(seam, h, side):
    """One side of the channel: the seam pushed h cells perpendicular to itself.

    side=-1 is the left district's edge, +1 the right's. Offsetting x alone (the
    obvious shortcut) leaves horizontal runs welded shut, so verticals move in x and
    horizontals move in y — and a horizontal jog's y offset flips with its direction,
    because which district sits above the jog depends on which way it turns.
    """
    pts = []
    for i, (x, y) in enumerate(seam):
        nx, ny = x + side * h, y
        prev_x = seam[i - 1][0] if i > 0 else None
        next_x = seam[i + 1][0] if i + 1 < len(seam) else None
        if next_x is not None and next_x != x:            # starts a horizontal run
            ny = y + (h if (next_x > x) == (side < 0) else -h)
        elif prev_x is not None and prev_x != x:          # ends a horizontal run
            ny = y + (h if (x > prev_x) == (side < 0) else -h)
        pts.append((nx, ny))
    return pts


def channel(seam, ch):
    """The gap between the two districts, as one closed polygon."""
    h = ch / 2.0
    return _offset(seam, h, -1) + list(reversed(_offset(seam, h, +1)))


def _poly(pts, s, ox, oy):
    return "".join(f"{'M' if i == 0 else 'L'}{ox + x * s:.3f} {oy + y * s:.3f}"
                   for i, (x, y) in enumerate(pts)) + "Z"


def _rounded_rect(x, y, w, h, r):
    if r <= 0:
        return f"M{x:.3f} {y:.3f}H{x + w:.3f}V{y + h:.3f}H{x:.3f}Z"
    return (f"M{x + r:.3f} {y:.3f}H{x + w - r:.3f}A{r:.3f} {r:.3f} 0 0 1 "
            f"{x + w:.3f} {y + r:.3f}V{y + h - r:.3f}A{r:.3f} {r:.3f} 0 0 1 "
            f"{x + w - r:.3f} {y + h:.3f}H{x + r:.3f}A{r:.3f} {r:.3f} 0 0 1 "
            f"{x:.3f} {y + h - r:.3f}V{y + r:.3f}A{r:.3f} {r:.3f} 0 0 1 "
            f"{x + r:.3f} {y:.3f}Z")


def mark_path(size, x=0.0, y=0.0, cut="display", radius=RADIUS):
    """The whole mark as one evenodd path: square outline, channel as a hole."""
    seam, ch = ((SEAM_DISPLAY, CH_DISPLAY) if cut == "display"
                else (SEAM_SMALL, CH_SMALL))
    s = size / G
    return (_rounded_rect(x, y, size, size, radius * s)
            + _poly(channel(seam, ch), s, x, y))


def svg(body, w, h, vb=None, extra=""):
    vb = vb or f"0 0 {w} {h}"
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" '
            f'width="{w}" height="{h}"{extra}>\n{body}\n</svg>\n')


def write(name, text):
    open(os.path.join(HERE, name), "w").write(text)


def glyph(fill, size, x=0.0, y=0.0, cut="display", radius=RADIUS, extra=""):
    return (f'  <path fill="{fill}" fill-rule="evenodd"{extra} '
            f'd="{mark_path(size, x, y, cut, radius)}"/>')


LABEL = ' role="img" aria-label="Daily District"'

# ---------------------------------------------------------------- 1. the mark
write("mark.svg", svg(glyph("currentColor", G), 512, 512,
                      vb=f"0 0 {G:g} {G:g}", extra=LABEL))
write("mark-small.svg", svg(glyph("currentColor", G, cut="small"), 512, 512,
                            vb=f"0 0 {G:g} {G:g}", extra=LABEL))
# Square-cornered cut, for contexts that impose their own shape.
write("mark-sharp.svg", svg(glyph("currentColor", G, radius=0), 512, 512,
                            vb=f"0 0 {G:g} {G:g}", extra=LABEL))
# Explicitly red: an <img> can't reach currentColor, so every <img src> use needs a
# baked fill. The channel stays a hole, so it picks up whatever sits behind — which
# means this one file is correct on light and dark grounds alike.
write("mark-red.svg", svg(glyph(RED, G), 512, 512,
                          vb=f"0 0 {G:g} {G:g}", extra=LABEL))
write("mark-white.svg", svg(glyph("#FFFFFF", G), 512, 512,
                            vb=f"0 0 {G:g} {G:g}", extra=LABEL))


# ------------------------------------------------------- 2. favicon (SVG, ICO)
# Small cut, minimal padding — at 16px every pixel of the seam counts. The embedded
# stylesheet lets the favicon answer the browser's own dark mode.
_fav = mark_path(456, 28, 28, cut="small")
write("favicon.svg", svg(
    '  <style>\n'
    f'    path {{ fill: {RED}; }}\n'
    f'    @media (prefers-color-scheme: dark) {{ path {{ fill: {RED_LIFT}; }} }}\n'
    '  </style>\n'
    f'  <path fill-rule="evenodd" d="{_fav}"/>', 512, 512, extra=LABEL))
write("favicon-small-flat.svg", svg(
    f'  <path fill="{RED}" fill-rule="evenodd" d="{mark_path(456, 28, 28, cut="small")}"/>',
    512, 512))
write("favicon-display-flat.svg", svg(
    f'  <path fill="{RED}" fill-rule="evenodd" d="{mark_path(456, 28, 28)}"/>',
    512, 512))


# --------------------------------------------------------------- 3. app icons
def app_icon(district, seam, radius_px, cut="display"):
    """The mark IS the tile — the districts run to the icon edge rather than floating
    inside a second square, which would read as a box in a box.

    Two layers: a solid plate in the seam colour, then the mark on top. The mark's
    channel is a hole, so the plate is what shows through it — the seam can't be left
    transparent here or a home screen wallpaper would show through the middle.
    """
    r_cells = radius_px / (512 / G)
    return svg(f'  <path fill="{seam}" '
               f'd="{_rounded_rect(0, 0, 512, 512, radius_px)}"/>\n'
               + glyph(district, 512, 0, 0, cut, r_cells), 512, 512)


def maskable_icon(ground, district, seam):
    """Android crops maskable icons to a circle inscribed in the 80% safe zone. A
    full-bleed mark would have its seam clipped top and bottom, visually rejoining the
    two districts and destroying the whole idea — so the mark is sized to sit entirely
    within that circle, and the ground carries the bleed."""
    safe_d = 512 * 0.8                       # safe circle diameter
    side = safe_d / (2 ** 0.5)               # largest square inside it
    inset = (512 - side) / 2
    r_px = 0.10 * side
    r_cells = r_px / (side / G)
    return svg(f'  <rect width="512" height="512" fill="{ground}"/>\n'
               f'  <path fill="{seam}" '
               f'd="{_rounded_rect(inset, inset, side, side, r_px)}"/>\n'
               + glyph(district, side, inset, inset, "display", r_cells), 512, 512)


write("icon-tile.svg", app_icon(RED, CREAM, 112))                 # PWA "any"
write("icon-ios.svg", app_icon(RED, CREAM, 0))                    # iOS adds a squircle
write("icon-maskable.svg", maskable_icon(RED, CREAM, RED))
write("icon-tile-cream.svg", app_icon(CREAM, RED, 112))
write("icon-tile-navy.svg", app_icon(NAVY, CREAM, 112))


# ----------------------------------------------------------------- 4. lockups
_wm = open(os.path.join(ROOT, "wordmark.svg")).read()
WORDMARK_D = re.search(r'\sd="([^"]+)"', _wm).group(1)
WM_X0, WM_Y0, WM_X1, WM_Y1 = 2.156, 11.572, 243.904, 52.756   # inkscape --query-all
WM_CAP_TOP, WM_BASELINE = 11.572, 44.0
CAP = WM_BASELINE - WM_CAP_TOP
WM_W, WM_H = WM_X1 - WM_X0, WM_Y1 - WM_Y0


def lockup_horizontal(mark_fill, word_fill):
    mh = CAP * 1.58
    mw = mh
    gap = CAP * 0.68
    pad = 6.0
    my = WM_CAP_TOP + CAP / 2 - mh / 2            # optically centred on the cap band
    dy = pad - min(my, WM_Y0)
    h = (max(my + mh, WM_Y1) - min(my, WM_Y0)) + 2 * pad
    w = pad + mw + gap + WM_W + pad
    return svg(
        f'  <path fill="{mark_fill}" fill-rule="evenodd" '
        f'd="{mark_path(mh, pad, my + dy, radius=RADIUS)}"/>\n'
        f'  <path fill="{word_fill}" '
        f'transform="translate({pad + mw + gap - WM_X0:.2f} {dy:.2f})" '
        f'd="{WORDMARK_D}"/>',
        round(w), round(h), vb=f"0 0 {w:.2f} {h:.2f}", extra=LABEL)


def lockup_stacked(mark_fill, word_fill):
    mw = WM_W * 0.30
    gap = CAP * 0.78
    h = mw + gap + WM_H
    return svg(
        f'  <path fill="{mark_fill}" fill-rule="evenodd" '
        f'd="{mark_path(mw, (WM_W - mw) / 2, 0.0, radius=RADIUS)}"/>\n'
        f'  <path fill="{word_fill}" '
        f'transform="translate({-WM_X0:.2f} {mw + gap - WM_Y0:.2f})" '
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
    # A low-opacity filled ghost, oversized and bleeding off the right edge. Fading
    # off-canvas reads fine for a filled shape; a STROKED outline treated the same way
    # reads as a cut-off picture frame instead, which is why this is fill, not stroke.
    gs = 470.0
    gx = 838.0
    inner = lockup_horizontal(RED, INK)
    m = re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', inner)
    lvw, lvh = float(m.group(1)), float(m.group(2))
    ls = 700.0 / lvw
    body = re.search(r'>\n(.*)\n</svg>', inner, re.S).group(1)
    return svg(
        f'  <rect width="{w:.0f}" height="{h:.0f}" fill="{CREAM}"/>\n'
        f'  <path fill="{RED}" fill-opacity="0.13" fill-rule="evenodd" '
        f'd="{mark_path(gs, gx, (h - gs) / 2)}"/>\n'
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
