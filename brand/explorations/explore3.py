#!/usr/bin/env python3
"""Refinement pass on the two surviving directions.

  EXCLAVE — a block-built district with a detached piece. Depicts the subject; no
            letterform. The detached square is the signature.
  BLOCK D — the same census-block vocabulary cut into a D. Monogram plus subject.

Each rendered at 512 / 32 / 16 so the small end is judged, not assumed.
"""
import os
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "explore3")
os.makedirs(OUT, exist_ok=True)
RED = "#C41230"

# (outline, counter, exclave)
V = {}

V["ex-a"] = ([(8, 18), (56, 18), (56, 6), (86, 6), (86, 56), (62, 56),
              (62, 92), (8, 92)], None, [(70, 68), (94, 68), (94, 92), (70, 92)])

# One more step on the left so it stops reading as "rectangle minus a corner".
V["ex-b"] = ([(6, 30), (28, 30), (28, 10), (78, 10), (78, 38), (94, 38),
              (94, 64), (58, 64), (58, 90), (6, 90)], None,
             [(70, 76), (94, 76), (94, 96), (70, 96)])

# Exclave promoted to a proper second piece, top-right, with the main mass lower.
V["ex-c"] = ([(6, 34), (34, 34), (34, 14), (72, 14), (72, 44), (92, 44),
              (92, 94), (6, 94)], None, [(80, 6), (100, 6), (100, 30), (80, 30)])

V["d-a"] = ([(12, 6), (60, 6), (60, 22), (78, 22), (78, 40), (92, 40),
             (92, 62), (78, 62), (78, 80), (60, 80), (60, 94), (12, 94)],
            [(32, 26), (52, 26), (52, 42), (64, 42), (64, 60), (52, 60),
             (52, 76), (32, 76)], None)

# Wider, calmer counter; the stem keeps one straight surveyed edge.
V["d-b"] = ([(10, 6), (58, 6), (58, 24), (76, 24), (76, 44), (90, 44),
             (90, 58), (76, 58), (76, 78), (58, 78), (58, 94), (10, 94)],
            [(30, 24), (50, 24), (50, 42), (62, 42), (62, 60), (50, 60),
             (50, 76), (30, 76)], None)

# Fewer, bigger steps — one step per side, so 16px keeps every one of them.
V["d-c"] = ([(10, 8), (56, 8), (56, 26), (80, 26), (80, 74), (56, 74),
             (56, 92), (10, 92)],
            [(30, 26), (50, 26), (50, 44), (62, 44), (62, 56), (50, 56),
             (50, 74), (30, 74)], None)

# Block D with an exclave — the two ideas combined.
V["d-d"] = ([(10, 6), (58, 6), (58, 24), (76, 24), (76, 44), (90, 44),
             (90, 58), (76, 58), (76, 78), (58, 78), (58, 94), (10, 94)],
            [(30, 24), (50, 24), (50, 42), (62, 42), (62, 60), (50, 60),
             (50, 76), (30, 76)],
            None)


def render(pts, counter, extra, inset=104):
    x = y = inset
    w = h = 512 - 2 * inset
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

    d = emit(pts) + (emit(counter) if counter else "")
    body = (f'<rect width="512" height="512" rx="112" ry="112" fill="{RED}"/>'
            f'<path fill="#fff" fill-rule="evenodd" d="{d}"/>')
    if extra:
        body += f'<path fill="#fff" d="{emit(extra)}"/>'
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" '
            f'width="512" height="512">{body}</svg>')


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
