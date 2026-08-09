#!/usr/bin/env python3
"""Proportion fix.

The previous sheet failed at large sizes because the counter was ~5 cells wide on a
12-cell mark, leaving a ring too thin to survive being stepped — the bowl visually
detached from the stem. Here the grid is 12 wide x 14 tall (letterform proportions,
not a square), the ring is a constant 3 cells on every side, and the counter is
correspondingly small.
"""
import os
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "explore5")
os.makedirs(OUT, exist_ok=True)
RED = "#C41230"
GW, GH = 13.0, 14.0

V = {}

# Steps on both contours, ring a constant 3 cells.
V["g1-stepped"] = (
    [(1, 0), (8, 0), (8, 2), (10, 2), (10, 4), (12, 4), (12, 10), (10, 10),
     (10, 12), (7, 12), (7, 14), (1, 14)],
    [(4, 3), (7, 3), (7, 5), (9, 5), (9, 9), (7, 9), (7, 11), (4, 11)])

# Same outline, plain rectangular counter — steps carried by the silhouette alone.
V["g2-plaincounter"] = (
    [(1, 0), (8, 0), (8, 2), (10, 2), (10, 4), (12, 4), (12, 10), (10, 10),
     (10, 12), (7, 12), (7, 14), (1, 14)],
    [(4, 3), (9, 3), (9, 11), (4, 11)])

# Two big steps instead of four small ones.
V["g3-twostep"] = (
    [(1, 0), (8, 0), (8, 3), (12, 3), (12, 11), (8, 11), (8, 14), (1, 14)],
    [(4, 3), (9, 3), (9, 11), (4, 11)])

# Asymmetric: shallow at the top, deep at the bottom.
V["g4-asym"] = (
    [(1, 0), (9, 0), (9, 2), (12, 2), (12, 9), (9, 9), (9, 12), (6, 12),
     (6, 14), (1, 14)],
    [(4, 3), (8, 3), (8, 6), (9, 6), (9, 9), (6, 9), (6, 11), (4, 11)])

# One straight surveyed edge on the right, steps only on the corners — the way a
# district that runs up against a state line actually looks.
V["g5-oneflat"] = (
    [(1, 0), (8, 0), (8, 2), (12, 2), (12, 12), (8, 12), (8, 14), (1, 14)],
    [(4, 3), (9, 3), (9, 6), (7, 6), (7, 8), (9, 8), (9, 11), (4, 11)])

# Deep single notch cut into the right edge — the gerrymander pinch, orthogonally.
V["g6-pinch"] = (
    [(1, 0), (8, 0), (8, 2), (12, 2), (12, 6), (10, 6), (10, 8), (12, 8),
     (12, 12), (8, 12), (8, 14), (1, 14)],
    [(4, 3), (9, 3), (9, 11), (4, 11)])


def render(pts, counter, inset=88, radius=112, bg=RED, fg="#fff"):
    box = 512 - 2 * inset
    s = min(box / GW, box / GH)
    ox = (512 - GW * s) / 2
    oy = (512 - GH * s) / 2

    def emit(p):
        return "".join(f"{'M' if i == 0 else 'L'}{ox + px * s:.1f} {oy + py * s:.1f}"
                       for i, (px, py) in enumerate(p)) + "Z"

    d = emit(pts) + emit(counter)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" '
            f'width="512" height="512">'
            f'<rect width="512" height="512" rx="{radius}" ry="{radius}" fill="{bg}"/>'
            f'<path fill="{fg}" fill-rule="evenodd" d="{d}"/></svg>')


names = list(V)
for n in names:
    open(os.path.join(OUT, f"{n}.svg"), "w").write(render(*V[n]))
    for s in (512, 32, 16):
        subprocess.run(["inkscape", os.path.join(OUT, f"{n}.svg"), "-w", str(s),
                        "-h", str(s), "-o", os.path.join(OUT, f"{n}-{s}.png")],
                       capture_output=True)

cw, ch = 300, 440
parts = [f'<rect width="{len(names) * cw}" height="{ch}" fill="#FAFAF8"/>']
for i, n in enumerate(names):
    x = i * cw
    parts.append(f'<image x="{x + 30}" y="24" width="240" height="240" '
                 f'href="{os.path.join(OUT, f"{n}-512.png")}"/>')
    parts.append(f'<image x="{x + 72}" y="290" width="96" height="96" '
                 f'href="{os.path.join(OUT, f"{n}-32.png")}" '
                 f'style="image-rendering:pixelated"/>')
    parts.append(f'<image x="{x + 184}" y="322" width="64" height="64" '
                 f'href="{os.path.join(OUT, f"{n}-16.png")}" '
                 f'style="image-rendering:pixelated"/>')
    parts.append(f'<text x="{x + 150}" y="416" text-anchor="middle" '
                 f'font-family="Helvetica" font-size="17" fill="#15171B">{n}</text>')
p = os.path.join(OUT, "_sheet.svg")
open(p, "w").write(f'<svg xmlns="http://www.w3.org/2000/svg" '
                   f'xmlns:xlink="http://www.w3.org/1999/xlink" '
                   f'viewBox="0 0 {len(names) * cw} {ch}" '
                   f'width="{len(names) * cw}" height="{ch}">' + "".join(parts) + '</svg>')
subprocess.run(["inkscape", p, "-w", str(len(names) * cw), "-h", str(ch),
                "-o", os.path.join(OUT, "_sheet.png")], capture_output=True)
print("variants:", ", ".join(names))
