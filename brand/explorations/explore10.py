#!/usr/bin/env python3
"""Fresh directions, round two.

Both prior concepts are now off the table: the D letterform (rejected — read as a
damaged letter) and the split-square seam (rejected — the diagonal cut, rotated,
read as too close to a hate symbol; the upright zigzag version wasn't liked either).

Hard constraint carried forward from that scare: nothing with radial/rotational
symmetry, no bent arms converging on a centre point. Every candidate here is either
a single asymmetric silhouette or purely concentric (rings, never spokes).

Five candidates, unrelated to each other and to both previous directions:
  puzzle   — classic tab-and-notch puzzle piece. Ties directly to "daily puzzle"
             copy already on the site; universally legible silhouette.
  pin      — a map pin, the standard "place" glyph, with one census-block step cut
             into the head as the one brand-specific detail.
  district — a single bold, lopsided district silhouette (not a split) — chunkier
             massing than the earlier n1-district attempt, built to survive 16px.
  rings    — three concentric rounded squares. A "zooming into the map" idea, and
             deliberately pure concentric geometry — no spokes, no radial symmetry.
  calendar — a page with two binder holes and one stepped corner, pairing "Daily"
             (the page) with "District" (the boundary cut) in one glyph.

Each renders tiled, bare, and as a true 16px raster — a scaled vector always
flatters a mark, only the real raster tells the truth.
"""
import os
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "explore10")
os.makedirs(OUT, exist_ok=True)
RED = "#C41230"
CREAM = "#F5F5F3"
G = 12.0


def emit(pts, s, ox, oy, close=True):
    d = "".join(f"{'M' if i == 0 else 'L'}{ox + x * s:.2f} {oy + y * s:.2f}"
                for i, (x, y) in enumerate(pts))
    return d + ("Z" if close else "")


# ---------------------------------------------------------------- puzzle piece
# Rounded square body; a circular tab bulges from the right edge, a circular notch
# bites into the bottom edge — the two canonical puzzle-piece features.
def puzzle_body(s, ox, oy, fill):
    r = 1.1 * s          # tab/notch radius
    body = (f'<path fill="{fill}" fill-rule="evenodd" d="'
             f'M{ox + 1 * s:.2f} {oy + 0 * s:.2f} '
             f'L{ox + 8 * s:.2f} {oy + 0 * s:.2f} '
             f'A{1 * s:.2f} {1 * s:.2f} 0 0 1 {ox + 9 * s:.2f} {oy + 1 * s:.2f} '
             f'L{ox + 9 * s:.2f} {oy + 4.5 * s:.2f} '
             f'A{r:.2f} {r:.2f} 0 0 0 {ox + 9 * s:.2f} {oy + 7.5 * s:.2f} '
             f'L{ox + 9 * s:.2f} {oy + 11 * s:.2f} '
             f'A{1 * s:.2f} {1 * s:.2f} 0 0 1 {ox + 8 * s:.2f} {oy + 12 * s:.2f} '
             f'L{ox + 4.5 * s:.2f} {oy + 12 * s:.2f} '
             f'A{r:.2f} {r:.2f} 0 0 0 {ox + 1.5 * s:.2f} {oy + 12 * s:.2f} '
             f'L{ox + 1 * s:.2f} {oy + 12 * s:.2f} '
             f'A{1 * s:.2f} {1 * s:.2f} 0 0 1 {ox + 0 * s:.2f} {oy + 11 * s:.2f} '
             f'L{ox + 0 * s:.2f} {oy + 1 * s:.2f} '
             f'A{1 * s:.2f} {1 * s:.2f} 0 0 1 {ox + 1 * s:.2f} {oy + 0 * s:.2f} Z"/>')
    return body


# ------------------------------------------------------------------------ pin
def pin_body(s, ox, oy, fill):
    # Teardrop pin: circular head, tapering to a point. One right-angle step cut
    # into the head's right shoulder — the single district-boundary reference.
    cx, cy, r = ox + 6 * s, oy + 4.6 * s, 4.2 * s
    return (f'<path fill="{fill}" fill-rule="evenodd" d="'
            f'M{cx - r:.2f} {cy:.2f} '
            f'A{r:.2f} {r:.2f} 0 0 1 {cx + r * 0.55:.2f} {cy - r * 0.83:.2f} '
            f'L{cx + r * 0.30:.2f} {cy - r * 0.42:.2f} '
            f'L{cx + r * 0.62:.2f} {cy - r * 0.42:.2f} '
            f'L{cx + r * 0.62:.2f} {cy + r * 0.05:.2f} '
            f'A{r:.2f} {r:.2f} 0 0 1 {cx:.2f} {cy + r:.2f} '
            f'L{ox + 6 * s:.2f} {oy + 11.6 * s:.2f} '
            f'L{cx - r * 0.94:.2f} {cy + r * 0.55:.2f} '
            f'A{r:.2f} {r:.2f} 0 0 1 {cx - r:.2f} {cy:.2f} Z"/>')


# ------------------------------------------------------------- single district
DISTRICT = [(1, 1), (7, 1), (7, 3), (10, 3), (10, 6), (11, 6), (11, 10), (7, 10),
            (7, 11), (3, 11), (3, 8), (1, 8)]


def district_body(s, ox, oy, fill):
    return f'<path fill="{fill}" d="{emit(DISTRICT, s, ox, oy)}"/>'


# ------------------------------------------------------------------ rings
def rings_body(s, ox, oy, fill, bg):
    parts = []
    specs = [(1.0, 10.0, fill), (2.4, 7.2, bg), (3.8, 4.4, fill)]
    for inset, size, c in specs:
        r = 0.9 * s * (size / 10.0)
        x, y = ox + inset * s, oy + inset * s
        w = size * s
        parts.append(f'<rect x="{x:.2f}" y="{y:.2f}" width="{w:.2f}" height="{w:.2f}" '
                     f'rx="{r:.2f}" fill="{c}"/>')
    return "".join(parts)


# --------------------------------------------------------------- calendar
def calendar_body(s, ox, oy, fill):
    page = [(1, 1.5), (11, 1.5), (11, 11), (7, 11), (7, 8), (11 - 11, 8),
            (0, 8)]
    # simpler explicit page with one stepped corner (bottom-right)
    page = [(1, 1.5), (11, 1.5), (11, 8), (8, 8), (8, 11), (1, 11)]
    d = f'<path fill="{fill}" d="{emit(page, s, ox, oy)}"/>'
    for hx in (3.4, 8.6):
        d += (f'<rect x="{ox + (hx - 0.5) * s:.2f}" y="{oy + 0.1 * s:.2f}" '
              f'width="{1.0 * s:.2f}" height="{1.8 * s:.2f}" rx="{0.5 * s:.2f}" '
              f'fill="{fill}"/>')
    return d


CANDS = {
    "puzzle": puzzle_body,
    "pin": pin_body,
    "district": district_body,
    "rings": None,   # special-cased (needs bg colour)
    "calendar": calendar_body,
}


def tiled(name, inset=100):
    s = (512 - 2 * inset) / G
    if name == "rings":
        body = rings_body(s, inset, inset, "#FFFFFF", RED)
    else:
        body = CANDS[name](s, inset, inset, "#FFFFFF")
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" '
            f'width="512" height="512">'
            f'<rect width="512" height="512" rx="112" ry="112" fill="{RED}"/>'
            f'{body}</svg>')


def bare(name, inset=40):
    s = (512 - 2 * inset) / G
    if name == "rings":
        body = rings_body(s, inset, inset, RED, CREAM)
    else:
        body = CANDS[name](s, inset, inset, RED)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" '
            f'width="512" height="512">'
            f'<rect width="512" height="512" fill="{CREAM}"/>'
            f'{body}</svg>')


NAMES = list(CANDS)
for n in NAMES:
    open(os.path.join(OUT, f"{n}-t.svg"), "w").write(tiled(n))
    open(os.path.join(OUT, f"{n}-b.svg"), "w").write(bare(n))
    for kind in ("t", "b"):
        for s in (512, 32, 16):
            subprocess.run(["inkscape", os.path.join(OUT, f"{n}-{kind}.svg"),
                            "-w", str(s), "-h", str(s),
                            "-o", os.path.join(OUT, f"{n}-{kind}-{s}.png")],
                           capture_output=True)

cw, ch = 300, 596
parts = [f'<rect width="{len(NAMES) * cw}" height="{ch}" fill="#FAFAF8"/>']
for i, n in enumerate(NAMES):
    x = i * cw
    parts.append(f'<image x="{x + 46}" y="20" width="208" height="208" '
                 f'href="{os.path.join(OUT, f"{n}-t-512.png")}"/>')
    parts.append(f'<image x="{x + 46}" y="240" width="208" height="208" '
                 f'href="{os.path.join(OUT, f"{n}-b-512.png")}"/>')
    for j, (kind, sz, px) in enumerate((("t", 32, 88), ("t", 16, 60),
                                        ("b", 32, 88), ("b", 16, 60))):
        parts.append(f'<image x="{x + 30 + j * 66}" y="{468 + (88 - px) / 2:.0f}" '
                     f'width="{px}" height="{px}" '
                     f'href="{os.path.join(OUT, f"{n}-{kind}-{sz}.png")}" '
                     f'style="image-rendering:pixelated"/>')
    parts.append(f'<text x="{x + 150}" y="578" text-anchor="middle" '
                 f'font-family="Helvetica" font-size="17" fill="#15171B">{n}</text>')
p = os.path.join(OUT, "_sheet.svg")
open(p, "w").write(f'<svg xmlns="http://www.w3.org/2000/svg" '
                   f'xmlns:xlink="http://www.w3.org/1999/xlink" '
                   f'viewBox="0 0 {len(NAMES) * cw} {ch}" '
                   f'width="{len(NAMES) * cw}" height="{ch}">' + "".join(parts) + '</svg>')
subprocess.run(["inkscape", p, "-w", str(len(NAMES) * cw), "-h", str(ch),
                "-o", os.path.join(OUT, "_sheet.png")], capture_output=True)
print("candidates:", ", ".join(NAMES))
