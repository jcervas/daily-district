#!/usr/bin/env python3
"""Final pass on the block D.

Everything sits on a 12x12 cell grid — the same discipline a block-built district
has, and the reason the mark stays crisp when rasterised small. The one thing being
tested here is asymmetry: perfectly mirrored steps read as a pixel font, so the top
and bottom of the bowl are deliberately cut differently.
"""
import os
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "explore4")
os.makedirs(OUT, exist_ok=True)
RED = "#C41230"
G = 12.0                       # grid is 12 cells square

V = {}

# Control: the symmetric version from the previous sheet.
V["f1-symmetric"] = (
    [(1, 0), (7, 0), (7, 2), (9, 2), (9, 4), (11, 4), (11, 8), (9, 8), (9, 10),
     (7, 10), (7, 12), (1, 12)],
    [(3, 2), (6, 2), (6, 4), (8, 4), (8, 8), (6, 8), (6, 10), (3, 10)], None)

# Asymmetric: two shallow steps down the top, one deep step across the bottom.
V["f2-asym"] = (
    [(1, 0), (7, 0), (7, 2), (9, 2), (9, 4), (11, 4), (11, 8), (9, 8), (9, 10),
     (6, 10), (6, 12), (1, 12)],
    [(3, 2), (6, 2), (6, 4), (8, 4), (8, 8), (6, 8), (6, 10), (3, 10)], None)

# Same outline, calm rectangular counter.
V["f3-flatcounter"] = (
    [(1, 0), (7, 0), (7, 2), (9, 2), (9, 4), (11, 4), (11, 8), (9, 8), (9, 10),
     (6, 10), (6, 12), (1, 12)],
    [(3, 2), (8, 2), (8, 10), (3, 10)], None)

# Asymmetric outline, counter offset the other way — the counter is its own district.
V["f4-counteroff"] = (
    [(1, 0), (7, 0), (7, 2), (9, 2), (9, 4), (11, 4), (11, 8), (9, 8), (9, 10),
     (6, 10), (6, 12), (1, 12)],
    [(3, 2), (7, 2), (7, 5), (9, 5), (9, 7), (6, 7), (6, 10), (3, 10)], None)

# Deeper single bite on the right — fewer, larger events.
V["f5-onebite"] = (
    [(1, 0), (7, 0), (7, 2), (10, 2), (10, 5), (12, 5), (12, 9), (9, 9),
     (9, 12), (1, 12)],
    [(3, 2), (7, 2), (7, 5), (9, 5), (9, 7), (6, 7), (6, 10), (3, 10)], None)

# Asymmetric, with the counter pulled toward the top so the mark has a clear
# heavy corner rather than reading centred and static.
V["f6-topheavy"] = (
    [(1, 0), (7, 0), (7, 2), (9, 2), (9, 4), (11, 4), (11, 8), (9, 8), (9, 10),
     (6, 10), (6, 12), (1, 12)],
    [(3, 2), (6, 2), (6, 4), (8, 4), (8, 7), (5, 7), (5, 9), (3, 9)], None)


def render(pts, counter, extra, inset=100, radius=112, bg=RED, fg="#fff"):
    box = 512 - 2 * inset
    s = box / G

    def emit(p):
        return "".join(f"{'M' if i == 0 else 'L'}{inset + px * s:.1f} "
                       f"{inset + py * s:.1f}" for i, (px, py) in enumerate(p)) + "Z"

    d = emit(pts) + (emit(counter) if counter else "")
    body = (f'<rect width="512" height="512" rx="{radius}" ry="{radius}" fill="{bg}"/>'
            f'<path fill="{fg}" fill-rule="evenodd" d="{d}"/>')
    if extra:
        body += f'<path fill="{fg}" d="{emit(extra)}"/>'
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
