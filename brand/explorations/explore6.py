#!/usr/bin/env python3
"""Micro-pass on the winner, checked tiled AND bare.

Bare matters: the favicon, single-colour merch, embroidery and etching all drop the
tile, and a mark that only works knocked out of a square isn't a system.
"""
import os
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "explore6")
os.makedirs(OUT, exist_ok=True)
RED = "#C41230"
GW, GH = 13.0, 14.0

OUTER = [(1, 0), (8, 0), (8, 2), (10, 2), (10, 4), (12, 4), (12, 10), (10, 10),
         (10, 12), (7, 12), (7, 14), (1, 14)]

V = {}
V["h1-base"] = (OUTER, [(4, 3), (9, 3), (9, 11), (4, 11)])
# One step in the counter, echoing the outer boundary without crowding it.
V["h2-counterstep"] = (OUTER, [(4, 3), (9, 3), (9, 8), (7, 8), (7, 11), (4, 11)])
# Counter stepped the other way, so inner and outer boundaries aren't parallel.
V["h3-counterstep2"] = (OUTER, [(4, 3), (7, 3), (7, 5), (9, 5), (9, 11), (4, 11)])
# Deeper top, shallower bottom — reverses the mark's weight.
V["h4-flip"] = ([(1, 0), (7, 0), (7, 2), (10, 2), (10, 4), (12, 4), (12, 10),
                 (10, 10), (10, 12), (8, 12), (8, 14), (1, 14)],
                [(4, 3), (9, 3), (9, 11), (4, 11)])


def paths(pts, counter, s, ox, oy):
    def emit(p):
        return "".join(f"{'M' if i == 0 else 'L'}{ox + px * s:.1f} {oy + py * s:.1f}"
                       for i, (px, py) in enumerate(p)) + "Z"
    return emit(pts) + emit(counter)


def tiled(pts, counter, inset=88):
    box = 512 - 2 * inset
    s = min(box / GW, box / GH)
    d = paths(pts, counter, s, (512 - GW * s) / 2, (512 - GH * s) / 2)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" '
            f'width="512" height="512">'
            f'<rect width="512" height="512" rx="112" ry="112" fill="{RED}"/>'
            f'<path fill="#fff" fill-rule="evenodd" d="{d}"/></svg>')


def bare(pts, counter, inset=40):
    box = 512 - 2 * inset
    s = min(box / GW, box / GH)
    d = paths(pts, counter, s, (512 - GW * s) / 2, (512 - GH * s) / 2)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" '
            f'width="512" height="512">'
            f'<rect width="512" height="512" fill="#FAFAF8"/>'
            f'<path fill="{RED}" fill-rule="evenodd" d="{d}"/></svg>')


names = list(V)
for n in names:
    open(os.path.join(OUT, f"{n}-t.svg"), "w").write(tiled(*V[n]))
    open(os.path.join(OUT, f"{n}-b.svg"), "w").write(bare(*V[n]))
    for kind in ("t", "b"):
        for s in (512, 32, 16):
            subprocess.run(["inkscape", os.path.join(OUT, f"{n}-{kind}.svg"),
                            "-w", str(s), "-h", str(s),
                            "-o", os.path.join(OUT, f"{n}-{kind}-{s}.png")],
                           capture_output=True)

cw, ch = 300, 560
parts = [f'<rect width="{len(names) * cw}" height="{ch}" fill="#FAFAF8"/>']
for i, n in enumerate(names):
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
    parts.append(f'<text x="{x + 150}" y="546" text-anchor="middle" '
                 f'font-family="Helvetica" font-size="17" fill="#15171B">{n}</text>')
p = os.path.join(OUT, "_sheet.svg")
open(p, "w").write(f'<svg xmlns="http://www.w3.org/2000/svg" '
                   f'xmlns:xlink="http://www.w3.org/1999/xlink" '
                   f'viewBox="0 0 {len(names) * cw} {ch}" '
                   f'width="{len(names) * cw}" height="{ch}">' + "".join(parts) + '</svg>')
subprocess.run(["inkscape", p, "-w", str(len(names) * cw), "-h", str(ch),
                "-o", os.path.join(OUT, "_sheet.png")], capture_output=True)
print("variants:", ", ".join(names))
