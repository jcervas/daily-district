#!/usr/bin/env python3
"""Non-letterform directions.

Same census-block vocabulary as the D, but depicting the subject instead of spelling
it. Sheet 1 killed the smooth blob (read as a stain) — this asks whether an ORTHOGONAL
district reads as a map on its own, without a letter to carry it.

Two lessons already baked in here:
  - Secondary tones use fill-opacity, not 8-digit hex. Inkscape parses #RRGGBBAA as
    opaque black, which silently wrecked the first run of this sheet.
  - Shapes are deliberately lopsided. A first pass produced 4-fold-symmetric polygons
    that read as a Swiss cross, not a district. Real districts are unbalanced.

Each candidate is rendered tiled, bare, and as a true 16px raster.
"""
import os
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "explore7")
os.makedirs(OUT, exist_ok=True)
RED = "#C41230"
G = 12.0


def emit(pts, s, ox, oy):
    return "".join(f"{'M' if i == 0 else 'L'}{ox + x * s:.2f} {oy + y * s:.2f}"
                   for i, (x, y) in enumerate(pts)) + "Z"


# n1 — a district on its own: mass swings bottom-right, no axis of symmetry.
N1 = [(0, 3), (5, 3), (5, 0), (11, 0), (11, 4), (8, 4), (8, 7), (12, 7), (12, 12),
      (4, 12), (4, 8), (0, 8)]

# n2 — one square, two districts. The dividing line is the subject.
N2_LEFT = [(0, 0), (6, 0), (6, 3), (4, 3), (4, 6), (8, 6), (8, 9), (5, 9), (5, 12),
           (0, 12)]
N2_RIGHT = [(6, 0), (12, 0), (12, 12), (5, 12), (5, 9), (8, 9), (8, 6), (4, 6),
            (4, 3), (6, 3)]

# n3 — the district as the blocks it is actually built from. Coarse 4x4: a 5x5 grid
# turned to noise at 16px on the first run.
N3_ON = {(1, 0), (2, 0),
         (0, 1), (1, 1), (2, 1), (3, 1),
         (0, 2), (1, 2), (2, 2),
         (1, 3), (2, 3), (3, 3)}

# n4 — pinned against a straight state line on the left, stepped everywhere else.
N4 = [(0, 0), (6, 0), (6, 2), (9, 2), (9, 6), (12, 6), (12, 9), (7, 9), (7, 12),
      (0, 12)]

# n7 — a district nested inside its state.
N7_OUT = [(0, 1), (12, 1), (12, 11), (0, 11)]
N7_IN = [(2, 3), (7, 3), (7, 5), (10, 5), (10, 9), (5, 9), (5, 7), (2, 7)]

# n9 — the contrast that defines district maps: surveyed straight on two sides,
# heavily jogged on the others.
N9 = [(0, 0), (12, 0), (12, 4), (9, 4), (9, 6), (11, 6), (11, 9), (7, 9), (7, 12),
      (4, 12), (4, 9), (0, 9)]

NAMES = ["n1-district", "n2-split", "n3-blocks", "n4-stateline", "n7-nested",
         "n9-surveyed"]


def body(name, s, ox, oy, fg, dim_op):
    """fg is a solid colour; secondary areas reuse it at dim_op opacity."""
    def path(pts, op=None, extra=""):
        o = f' fill-opacity="{op}"' if op else ""
        return f'<path fill="{fg}"{o} d="{emit(pts, s, ox, oy)}"{extra}/>'

    if name == "n1-district":
        return path(N1)
    if name == "n2-split":
        return path(N2_LEFT) + path(N2_RIGHT, op=dim_op)
    if name == "n3-blocks":
        cells, gap, cs = "", 0.16, G / 4.0
        for r in range(4):
            for c in range(4):
                on = (c, r) in N3_ON
                x, y = ox + (c * cs + gap) * s, oy + (r * cs + gap) * s
                w = (cs - gap * 2) * s
                op = "" if on else f' fill-opacity="{dim_op}"'
                cells += (f'<rect x="{x:.2f}" y="{y:.2f}" width="{w:.2f}" '
                          f'height="{w:.2f}" rx="{w * 0.14:.2f}" fill="{fg}"{op}/>')
        return cells
    if name == "n4-stateline":
        return path(N4)
    if name == "n7-nested":
        return (f'<path fill="none" stroke="{fg}" stroke-opacity="{dim_op}" '
                f'stroke-width="{0.8 * s:.2f}" stroke-linejoin="round" '
                f'd="{emit(N7_OUT, s, ox, oy)}"/>' + path(N7_IN))
    if name == "n9-surveyed":
        return path(N9)
    raise KeyError(name)


def tiled(name, inset=96):
    s = (512 - 2 * inset) / G
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" '
            f'width="512" height="512">'
            f'<rect width="512" height="512" rx="112" ry="112" fill="{RED}"/>'
            f'{body(name, s, inset, inset, "#FFFFFF", "0.38")}</svg>')


def bare(name, inset=40):
    s = (512 - 2 * inset) / G
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" '
            f'width="512" height="512">'
            f'<rect width="512" height="512" fill="#FAFAF8"/>'
            f'{body(name, s, inset, inset, RED, "0.30")}</svg>')


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
print("variants:", ", ".join(NAMES))
