#!/usr/bin/env python3
"""Generate the Daily District "Split Ring" logo system from one parametric source.

THE MARK
    A circle divided by a straight vertical stem and a curved S-spine. The spine
    bows right across the top half and left across the bottom, closing against the
    stem into the bowl of a D — one upright, one rotated 180° (Daily District).
    ONE colour: ring, stem and spine are always the same colour, all strokes with
    round caps and joins. Red (#C41230) is the site primary and the in-product
    "solved" fill; never a two-colour split.

    The display cut adds a small flourish accent at each tip of the spine — a
    tapered flick reading like a pennant or a compass flourish, fitting for a
    civics game. It is CLIPPED to a circle matching the ring's true outer edge, so
    it (and the stem's round caps, which would otherwise poke a hair past the ring
    at 12 and 6 o'clock) never break the mark's circular silhouette. This came from
    a Claude Design export (`brand/explorations/design-canvas-export/`) — the ring,
    stem, spine and flourish path data there are reproduced verbatim as DISPLAY's
    geometry, not redrawn by hand.

    Drawn on a 100 x 100 grid. This file is the source of truth for the geometry
    (the two cuts below); it reproduces every asset byte-for-byte.

OPTICAL SIZES
    Two cuts, like a type family's optical sizes:
      DISPLAY  ring r40, stroke 9, flourish   above 32px
      SMALL    ring r42, stroke 12, no flourish   32px and below
    The flourish is the first thing lost to a raster — by 16px it's noise, verified
    against a real render, not assumed — so the small cut drops it entirely rather
    than shrinking it into a smear. It also fattens the ring and stroke and widens
    the spine's shoulders so the two D counters stay open instead of silting up.

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
# Canonical "Split Ring" path data on the 100-unit grid. A ring divided by a
# straight vertical stem and a curved S-spine: the spine bows right across the top
# half and left across the bottom, closing against the stem into the bowl of a D —
# one upright, one rotated 180°. Three strokes (ring, stem, spine), one colour,
# round caps/joins. These strings ARE the mark — never redrawn, only scaled/tinted.

# The two flourish accents, verbatim from the Claude Design export (see the module
# docstring) — a flattened curve, not hand-simplified, since this is someone else's
# approved artwork being reproduced exactly, not redrawn.
_FLOURISH_NE = (
    "M 65.43 13.56 L 66.07 13.79 L 66.71 14.05 L 67.34 14.33 L 67.97 14.63 "
    "L 68.59 14.95 L 69.2 15.29 L 69.81 15.65 L 70.4 16.04 L 70.99 16.45 "
    "L 71.56 16.88 L 72.12 17.33 L 72.67 17.81 L 73.21 18.31 L 73.73 18.83 "
    "L 74.23 19.37 L 74.72 19.94 L 75.18 20.52 L 75.63 21.13 L 76.06 21.76 "
    "L 76.46 22.41 L 76.84 23.07 L 77.2 23.76 L 77.53 24.46 L 77.84 25.18 "
    "L 78.12 25.91 L 78.38 26.66 L 78.6 27.42 L 78.8 28.2 L 78.96 28.99 "
    "L 79.1 29.78 L 79.2 30.59 L 79.28 31.4 L 79.32 32.22 L 79.33 33.05 "
    "L 79.31 33.88 L 79.25 34.71 L 79.17 35.54 L 79.05 36.37 L 78.9 37.2 "
    "L 78.71 38.03 L 78.84 37.72 L 78.98 37.42 L 79.12 37.12 L 79.28 36.82 "
    "L 79.44 36.53 L 79.6 36.24 L 79.79 35.96 L 79.98 35.69 L 80.19 35.44 "
    "L 80.43 35.2 L 80.7 35.01 L 81.01 34.87 L 81.34 34.84 L 81.66 34.93 "
    "L 81.94 35.11 L 82.18 35.34 L 82.39 35.6 L 82.57 35.88 L 82.74 36.17 "
    "L 82.89 36.46 L 83.02 36.77 L 83.15 37.08 L 83.27 37.39 L 83.38 37.7 "
    "L 83.49 38.02 L 83.59 38.34 L 83.69 38.65 L 83.78 38.98 L 83.87 39.3 "
    "L 83.95 39.62 L 85.85 38 L 87.73 36.35 L 89.59 34.69 L 91.43 32.99 "
    "L 93.23 31.27 L 95.01 29.51 L 96.74 27.71 L 98.41 25.85 L 100.02 23.94 "
    "L 101.52 21.94 L 102.87 19.84 L 103.95 17.6 L 104.53 15.17 L 104.05 12.76 "
    "L 102.29 11.02 L 99.99 10.09 L 97.54 9.62 L 95.05 9.42 L 92.55 9.4 "
    "L 90.05 9.5 L 87.56 9.69 L 85.08 9.96 L 82.6 10.28 L 80.13 10.65 "
    "L 77.67 11.07 L 75.21 11.51 L 72.76 11.99 L 70.31 12.49 L 67.87 13.01 "
    "L 65.43 13.56 Z")
_FLOURISH_SW = (  # the NE flourish rotated 180° about (50,50) — same shape, same turn
    "M 34.57 86.44 L 33.93 86.21 L 33.29 85.95 L 32.66 85.67 L 32.03 85.37 "
    "L 31.41 85.05 L 30.80 84.71 L 30.19 84.35 L 29.60 83.96 L 29.01 83.55 "
    "L 28.44 83.12 L 27.88 82.67 L 27.33 82.19 L 26.79 81.69 L 26.27 81.17 "
    "L 25.77 80.63 L 25.28 80.06 L 24.82 79.48 L 24.37 78.87 L 23.94 78.24 "
    "L 23.54 77.59 L 23.16 76.93 L 22.80 76.24 L 22.47 75.54 L 22.16 74.82 "
    "L 21.88 74.09 L 21.62 73.34 L 21.40 72.58 L 21.20 71.80 L 21.04 71.01 "
    "L 20.90 70.22 L 20.80 69.41 L 20.72 68.60 L 20.68 67.78 L 20.67 66.95 "
    "L 20.69 66.12 L 20.75 65.29 L 20.83 64.46 L 20.95 63.63 L 21.10 62.80 "
    "L 21.29 61.97 L 21.16 62.28 L 21.02 62.58 L 20.88 62.88 L 20.72 63.18 "
    "L 20.56 63.47 L 20.40 63.76 L 20.21 64.04 L 20.02 64.31 L 19.81 64.56 "
    "L 19.57 64.80 L 19.30 64.99 L 18.99 65.13 L 18.66 65.16 L 18.34 65.07 "
    "L 18.06 64.89 L 17.82 64.66 L 17.61 64.40 L 17.43 64.12 L 17.26 63.83 "
    "L 17.11 63.54 L 16.98 63.23 L 16.85 62.92 L 16.73 62.61 L 16.62 62.30 "
    "L 16.51 61.98 L 16.41 61.66 L 16.31 61.35 L 16.22 61.02 L 16.13 60.70 "
    "L 16.05 60.38 L 14.15 62.00 L 12.27 63.65 L 10.41 65.31 L 8.57 67.01 "
    "L 6.77 68.73 L 4.99 70.49 L 3.26 72.29 L 1.59 74.15 L -0.02 76.06 "
    "L -1.52 78.06 L -2.87 80.16 L -3.95 82.40 L -4.53 84.83 L -4.05 87.24 "
    "L -2.29 88.98 L 0.01 89.91 L 2.46 90.38 L 4.95 90.58 L 7.45 90.60 "
    "L 9.95 90.50 L 12.44 90.31 L 14.92 90.04 L 17.40 89.72 L 19.87 89.35 "
    "L 22.33 88.93 L 24.79 88.49 L 27.24 88.01 L 29.69 87.51 L 32.13 86.99 "
    "L 34.57 86.44 Z")

DISPLAY = {
    "r": 40,
    # One continuous path, top-centre to bottom-centre (not two subpaths, even
    # though the export drew it as two) — glyph_solved()'s fill-outline math walks
    # this string as a single curve, so it has to stay one.
    "spine": "M50 10 C 84.3 10 84.3 50 50 50 C 15.7 50 15.7 90 50 90",
    "stem": (10, 90),
    "stroke": 9,
    # Trims the stem's round caps (which overshoot the ring by stroke/2 at 12 and 6
    # o'clock) and the flourish tips flush with the ring's own true outer edge —
    # r + stroke/2 exactly, so the ring's own stroke is untouched by the clip.
    "clip_r": 44.5,
    "flourish": (_FLOURISH_NE, _FLOURISH_SW),
}
SMALL = {   # 32px and below: fuller ring, thicker strokes, no flourish — see OPTICAL SIZES
    "r": 42,
    "spine": "M50 8 C 88 8 88 50 50 50 C 12 50 12 92 50 92",
    "stem": (8, 92),
    "stroke": 12,
    "clip_r": 48,
}
G = 100.0  # grid size


def num(v):
    """Trim a number: whole stays whole, else up to 4 decimals."""
    s = f"{v:.4f}".rstrip("0").rstrip(".")
    return s or "0"


_clip_n = [0]


def _clip_id():
    """A fresh id per call — some documents (og-image.svg) embed the mark twice, and
    a repeated <clipPath id> would silently clobber the first instance."""
    _clip_n[0] += 1
    return f"src{_clip_n[0]}"


def glyph(size=G, x=0.0, y=0.0, cut=DISPLAY, color="currentColor", indent=""):
    """The mark at `size`, top-left at (x, y), in one colour.

    Emitted as the canonical 100-grid ring + spine wrapped in a translate+scale,
    so the path data (and byte-for-byte identity of the primary files) never
    changes.
    """
    body = (f'<g fill="none" stroke="{color}" stroke-width="{num(cut["stroke"])}" '
            f'stroke-linecap="round" stroke-linejoin="round">'
            f'<circle cx="50" cy="50" r="{num(cut["r"])}"></circle>'
            f'<path d="{cut["spine"]}"></path>'
            f'<line x1="50" y1="{num(cut["stem"][0])}" x2="50" '
            f'y2="{num(cut["stem"][1])}"></line></g>')
    if cut.get("flourish"):
        body += "".join(f'<path fill="{color}" stroke="{color}" stroke-width="0.3" '
                        f'd="{d}"></path>' for d in cut["flourish"])
    if cut.get("clip_r"):
        cid = _clip_id()
        body = (f'<defs><clipPath id="{cid}"><circle cx="50" cy="50" '
                f'r="{num(cut["clip_r"])}"></circle></clipPath></defs>'
                f'<g clip-path="url(#{cid})">{body}</g>')
    if size == G and x == 0 and y == 0:
        return indent + body
    s = size / G
    return (f'{indent}<g transform="translate({num(x)} {num(y)}) '
            f'scale({num(s)})">{body}</g>')


def glyph_solved(color="currentColor", cut=DISPLAY):
    """The in-product "solved" state: the right-hand D filled, the ring drawn over.

    The fill closes the spine back up the ring's right edge with an arc, so exactly
    one of the two D regions reads as filled."""
    top = cut["spine"].split()[1]          # y of the spine's start point
    r = num(cut["r"])
    fill = (f'<path fill="{color}" d="{cut["spine"]} '
            f'A{r} {r} 0 0 0 50 {top} Z"></path>')
    return fill + glyph(color=color, cut=cut)


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
write("mark-white.svg", svg(glyph(color=WHITE)))               # baked white (dark grounds)
write("mark-solved.svg", svg(glyph_solved()))                  # in-product "solved" state
# The site's /logo.svg is the primary mark baked in CMU Red (currentColor renders
# black in an <img>), so it matches the red wordmark it sits beside — in both light
# and dark, where the red wordmark does not shift, so the mark holds red too.
write("logo.svg", svg(glyph(color=RED)))


# ------------------------------------------------------- 2. favicon (SVG, ICO)
# Small cut in CMU Red, lifting to #FF3B57 under the browser's own dark mode
# (plain #C41230 goes muddy on a dark tab bar). The mark is a single stroked
# group now, so one class hook (.sr) carries the dark-mode swap.
_fav_body = glyph(cut=SMALL, color=RED).replace(
    f'stroke="{RED}"', f'class="sr" stroke="{RED}"')
write("favicon.svg", svg(
    f'<style>@media (prefers-color-scheme:dark){{.sr{{stroke:{RED_LIFT}}}}}</style>'
    + _fav_body))
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
