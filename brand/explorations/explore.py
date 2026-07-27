#!/usr/bin/env python3
"""Contact sheet of logo directions — each candidate rendered large, and again at a
true 16px raster magnified, so small-size legibility is judged rather than assumed.
"""
import math
import os
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "explore")
os.makedirs(OUT, exist_ok=True)

RED = "#C41230"
INK = "#15171B"

# ---------------------------------------------------------------------------
# A district-like polygon: mostly long surveyed runs, a few short jogs, one clear
# protrusion. Normalised to a 0..100 box; callers scale and place it.
DISTRICT = [(12, 22), (46, 10), (52, 30), (84, 18), (92, 44), (72, 56),
            (88, 74), (60, 96), (34, 86), (30, 62), (6, 52)]

# A second, blockier one — more surveyed, fewer diagonals.
DISTRICT_B = [(10, 16), (58, 16), (58, 4), (90, 4), (90, 46), (70, 46),
              (70, 62), (94, 62), (94, 96), (40, 96), (40, 70), (10, 70)]


def poly(pts, x, y, w, h, close=True):
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    sx, sy = w / (x1 - x0), h / (y1 - y0)
    s = min(sx, sy)
    ox = x + (w - (x1 - x0) * s) / 2
    oy = y + (h - (y1 - y0) * s) / 2
    d = []
    for i, (px, py) in enumerate(pts):
        cx = ox + (px - x0) * s
        cy = oy + (py - y0) * s
        d.append(f"{'M' if i == 0 else 'L'}{cx:.1f} {cy:.1f}")
    if close:
        d.append("Z")
    return "".join(d)


def offset_poly(pts, amount):
    """Shrink a polygon toward its centroid — good enough for concentric contours."""
    cx = sum(p[0] for p in pts) / len(pts)
    cy = sum(p[1] for p in pts) / len(pts)
    out = []
    for px, py in pts:
        dx, dy = px - cx, py - cy
        L = math.hypot(dx, dy) or 1
        out.append((px - dx / L * amount, py - dy / L * amount))
    return out


TILE = '<rect width="512" height="512" rx="112" ry="112" fill="%s"/>'

# ---------------------------------------------------------------------------
CANDIDATES = {}

# A — the shape itself, knocked out of the daily tile.
CANDIDATES["A-shape"] = (
    TILE % RED +
    f'<path fill="#fff" d="{poly(DISTRICT, 96, 96, 320, 320)}"/>')

# B — calendar page whose lower edge is a district boundary.
_cal = [(6, 22), (94, 22), (94, 62), (80, 70), (84, 88), (54, 82),
        (40, 96), (24, 78), (6, 74)]
CANDIDATES["B-calendar"] = (
    TILE % RED +
    f'<path fill="#fff" d="{poly(_cal, 96, 110, 320, 292)}"/>'
    '<rect x="188" y="86" width="34" height="64" rx="17" fill="#fff"/>'
    '<rect x="290" y="86" width="34" height="64" rx="17" fill="#fff"/>')

# C — concentric boundaries, like a contour map closing in on the answer.
_rings = "".join(
    f'<path fill="none" stroke="#fff" stroke-width="{sw}" stroke-linejoin="round" '
    f'd="{poly(offset_poly(DISTRICT, off), 78, 78, 356, 356)}"/>'
    for off, sw in ((0, 30), (13, 30), (26, 30)))
CANDIDATES["C-contour"] = TILE % RED + _rings

# D — the shape as a solid, with a bite of negative space reading as a counter.
CANDIDATES["D-blocky"] = (
    TILE % RED +
    f'<path fill="#fff" d="{poly(DISTRICT_B, 104, 104, 304, 304)}"/>')

# E — puzzle grid, one cell replaced by a district.
_cells = ""
for r in range(2):
    for c in range(2):
        x, y = 108 + c * 156, 108 + r * 156
        if r == 1 and c == 1:
            _cells += f'<path fill="#fff" d="{poly(DISTRICT, x, y, 132, 132)}"/>'
        else:
            _cells += (f'<rect x="{x}" y="{y}" width="132" height="132" rx="22" '
                       f'fill="#fff" fill-opacity="0.4"/>')
CANDIDATES["E-grid"] = TILE % RED + _cells

# F — a district under a rising sun: the "daily" half of the name, stated plainly.
CANDIDATES["F-sunrise"] = (
    TILE % RED +
    '<path fill="#fff" d="M170 232a86 86 0 0 1 172 0Z"/>' +
    f'<path fill="#fff" d="{poly(DISTRICT, 112, 258, 288, 168)}"/>')

# G — outline only: the boundary as a drawn line, nothing filled.
CANDIDATES["G-outline"] = (
    TILE % RED +
    f'<path fill="none" stroke="#fff" stroke-width="34" stroke-linejoin="round" '
    f'd="{poly(DISTRICT, 110, 110, 292, 292)}"/>')


def svg(body):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" '
            f'width="512" height="512">{body}</svg>')


def build():
    names = list(CANDIDATES)
    for n in names:
        open(os.path.join(OUT, f"{n}.svg"), "w").write(svg(CANDIDATES[n]))
        for s in (512, 16):
            subprocess.run(["inkscape", os.path.join(OUT, f"{n}.svg"), "-w", str(s),
                            "-h", str(s), "-o", os.path.join(OUT, f"{n}-{s}.png")],
                           capture_output=True)
    # contact sheet: big on top, the true 16px raster magnified underneath
    cols = len(names)
    cw, ch = 300, 400
    parts = [f'<rect width="{cols * cw}" height="{ch}" fill="#FAFAF8"/>']
    for i, n in enumerate(names):
        x = i * cw
        big = os.path.join(OUT, f"{n}-512.png")
        sml = os.path.join(OUT, f"{n}-16.png")
        parts.append(f'<image x="{x + 30}" y="24" width="240" height="240" '
                     f'href="{big}"/>')
        parts.append(f'<image x="{x + 118}" y="286" width="64" height="64" '
                     f'href="{sml}" style="image-rendering:pixelated"/>')
        parts.append(f'<text x="{x + 150}" y="376" text-anchor="middle" '
                     f'font-family="Helvetica" font-size="17" fill="#15171B">{n}</text>')
    sheet = (f'<svg xmlns="http://www.w3.org/2000/svg" '
             f'xmlns:xlink="http://www.w3.org/1999/xlink" '
             f'viewBox="0 0 {cols * cw} {ch}" width="{cols * cw}" height="{ch}">'
             + "".join(parts) + '</svg>')
    p = os.path.join(OUT, "_sheet.svg")
    open(p, "w").write(sheet)
    subprocess.run(["inkscape", p, "-w", str(cols * cw), "-h", str(ch),
                    "-o", os.path.join(OUT, "_sheet.png")], capture_output=True)
    print("candidates:", ", ".join(names))


if __name__ == "__main__":
    build()
