#!/usr/bin/env python3
"""Second pass: orthogonal (census-block) forms only.

The first sheet showed smooth irregular blobs read as stains and thin outlines read
as scribbles. Right-angle steps are what actually says "district map" — and they
snap to the pixel grid, so they sharpen at 16px instead of mushing.
"""
import os
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "explore2")
os.makedirs(OUT, exist_ok=True)
RED = "#C41230"

V = {}

# Carried forward from sheet 1 as the control.
V["1-control"] = ([(10, 16), (58, 16), (58, 4), (90, 4), (90, 46), (70, 46),
                   (70, 62), (94, 62), (94, 96), (40, 96), (40, 70), (10, 70)], None, None)

# A staircase climbing to the right off a surveyed baseline.
V["2-stair"] = ([(8, 8), (48, 8), (48, 28), (72, 28), (72, 52), (96, 52),
                 (96, 92), (8, 92)], None, None)

# Compact, wrapped around itself — mass in all four quadrants.
V["3-wrap"] = ([(12, 10), (52, 10), (52, 32), (88, 32), (88, 54), (66, 54),
                (66, 90), (28, 90), (28, 58), (12, 58)], None, None)

# The same idea, plus an exclave — districts really do have detached pieces.
V["4-exclave"] = ([(8, 18), (56, 18), (56, 6), (86, 6), (86, 56), (62, 56),
                   (62, 92), (8, 92)], None, [(70, 68), (94, 68), (94, 92), (70, 92)])

# A D built out of blocks: the original concept, re-cut orthogonally.
V["5-blockD"] = ([(12, 6), (60, 6), (60, 22), (78, 22), (78, 40), (92, 40),
                  (92, 62), (78, 62), (78, 80), (60, 80), (60, 94), (12, 94)],
                 [(32, 26), (52, 26), (52, 42), (64, 42), (64, 60), (52, 60),
                  (52, 76), (32, 76)], None)

# Interlocking halves — the split-a-county look.
V["6-interlock"] = ([(10, 10), (90, 10), (90, 40), (52, 40), (52, 56), (90, 56),
                     (90, 90), (10, 90), (10, 62), (34, 62), (34, 40), (10, 40)],
                    None, None)

# A dense, many-stepped boundary: closest to a real block-built district.
V["7-dense"] = ([(10, 24), (30, 24), (30, 10), (58, 10), (58, 26), (76, 26),
                 (76, 12), (92, 12), (92, 48), (74, 48), (74, 64), (92, 64),
                 (92, 90), (56, 90), (56, 74), (36, 74), (36, 90), (10, 90)],
                None, None)


def poly(pts, x, y, w, h):
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    s = min(w / (x1 - x0), h / (y1 - y0))
    ox = x + (w - (x1 - x0) * s) / 2
    oy = y + (h - (y1 - y0) * s) / 2
    return "".join(f"{'M' if i == 0 else 'L'}{ox + (px - x0) * s:.1f} "
                   f"{oy + (py - y0) * s:.1f}"
                   for i, (px, py) in enumerate(pts)) + "Z"


def render(pts, counter, extra, box=(96, 96, 320, 320)):
    x, y, w, h = box
    # All parts share one scale so the exclave keeps its true relationship.
    allpts = pts + (extra or [])
    xs = [p[0] for p in allpts]
    ys = [p[1] for p in allpts]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    s = min(w / (x1 - x0), h / (y1 - y0))
    ox = x + (w - (x1 - x0) * s) / 2
    oy = y + (h - (y1 - y0) * s) / 2

    def emit(p):
        return "".join(f"{'M' if i == 0 else 'L'}{ox + (px - x0) * s:.1f} "
                       f"{oy + (py - y0) * s:.1f}"
                       for i, (px, py) in enumerate(p)) + "Z"

    d = emit(pts)
    if counter:
        d += emit(counter)
    body = (f'<rect width="512" height="512" rx="112" ry="112" fill="{RED}"/>'
            f'<path fill="#fff" fill-rule="evenodd" d="{d}"/>')
    if extra:
        body += f'<path fill="#fff" d="{emit(extra)}"/>'
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" '
            f'width="512" height="512">{body}</svg>')


names = list(V)
for n in names:
    open(os.path.join(OUT, f"{n}.svg"), "w").write(render(*V[n]))
    for s in (512, 16):
        subprocess.run(["inkscape", os.path.join(OUT, f"{n}.svg"), "-w", str(s),
                        "-h", str(s), "-o", os.path.join(OUT, f"{n}-{s}.png")],
                       capture_output=True)

cw, ch = 300, 400
parts = [f'<rect width="{len(names) * cw}" height="{ch}" fill="#FAFAF8"/>']
for i, n in enumerate(names):
    x = i * cw
    parts.append(f'<image x="{x + 30}" y="24" width="240" height="240" '
                 f'href="{os.path.join(OUT, f"{n}-512.png")}"/>')
    parts.append(f'<image x="{x + 118}" y="286" width="64" height="64" '
                 f'href="{os.path.join(OUT, f"{n}-16.png")}" '
                 f'style="image-rendering:pixelated"/>')
    parts.append(f'<text x="{x + 150}" y="376" text-anchor="middle" '
                 f'font-family="Helvetica" font-size="17" fill="#15171B">{n}</text>')
p = os.path.join(OUT, "_sheet.svg")
open(p, "w").write(f'<svg xmlns="http://www.w3.org/2000/svg" '
                   f'xmlns:xlink="http://www.w3.org/1999/xlink" '
                   f'viewBox="0 0 {len(names) * cw} {ch}" '
                   f'width="{len(names) * cw}" height="{ch}">' + "".join(parts) + '</svg>')
subprocess.run(["inkscape", p, "-w", str(len(names) * cw), "-h", str(ch),
                "-o", os.path.join(OUT, "_sheet.png")], capture_output=True)
print("variants:", ", ".join(names))
