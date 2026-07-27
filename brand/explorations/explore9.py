#!/usr/bin/env python3
"""Optical sizes for the split mark.

The split carries its meaning in an interior seam, and interior detail is what dies
first when a mark is rasterised small. Type families solve exactly this with optical
sizes — a denser cut for small use. This tests whether the same trick works here:
fewer jogs and a wider channel as the mark shrinks.

Judged on true 16/20/24px rasters, magnified. Anything judged from a scaled vector is
judged wrong.
"""
import os
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "explore9")
os.makedirs(OUT, exist_ok=True)
RED = "#C41230"
G = 12.0

# Seams, top to bottom. Fewer jogs survive fewer pixels.
SEAMS = {
    "3jog": [(6, 0), (6, 3), (4, 3), (4, 6), (8, 6), (8, 9), (5, 9), (5, 12)],
    "2jog": [(6, 0), (6, 4), (4, 4), (4, 8), (8, 8), (8, 12)],
    "1jog": [(7, 0), (7, 6), (4, 6), (4, 12)],
}


def _offset(seam, h, side):
    pts = []
    for i, (x, y) in enumerate(seam):
        nx, ny = x + side * h, y
        prev_x = seam[i - 1][0] if i > 0 else None
        next_x = seam[i + 1][0] if i + 1 < len(seam) else None
        if next_x is not None and next_x != x:
            ny = y + (h if (next_x > x) == (side < 0) else -h)
        elif prev_x is not None and prev_x != x:
            ny = y + (h if (x > prev_x) == (side < 0) else -h)
        pts.append((nx, ny))
    return pts


def pieces(seam, ch):
    h = ch / 2.0
    left = [(0, 0)] + _offset(seam, h, -1) + [(0, 12)]
    right = [(12, 0), (12, 12)] + list(reversed(_offset(seam, h, +1)))
    return left, right


def emit(pts, s, ox, oy):
    return "".join(f"{'M' if i == 0 else 'L'}{ox + x * s:.2f} {oy + y * s:.2f}"
                   for i, (x, y) in enumerate(pts)) + "Z"


def svg(seam_key, ch, inset, radius, bg, fg):
    s = (512 - 2 * inset) / G
    l, r = pieces(SEAMS[seam_key], ch)
    ground = (f'<rect width="512" height="512" rx="{radius}" ry="{radius}" '
              f'fill="{bg}"/>') if bg else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" '
            f'width="512" height="512">{ground}'
            f'<path fill="{fg}" d="{emit(l, s, inset, inset)}"/>'
            f'<path fill="{fg}" d="{emit(r, s, inset, inset)}"/></svg>')


# name -> (seam, channel). Progressively denser cuts for smaller sizes.
CUTS = {
    "display 3jog/1.6": ("3jog", 1.6),
    "text 3jog/2.2": ("3jog", 2.2),
    "small 2jog/2.2": ("2jog", 2.2),
    "micro 2jog/2.8": ("2jog", 2.8),
    "micro 1jog/2.8": ("1jog", 2.8),
}

SIZES = (16, 20, 24, 32)

for name, (sk, ch) in CUTS.items():
    key = name.split()[0] + "-" + sk + "-" + str(ch).replace(".", "")
    # Bare: red districts on light ground, the channel left open. This is the favicon
    # case and the one that decides whether a cut is usable.
    open(os.path.join(OUT, f"{key}.svg"), "w").write(
        svg(sk, ch, 36, 0, "#FFFFFF", RED))
    for s in SIZES + (512,):
        subprocess.run(["inkscape", os.path.join(OUT, f"{key}.svg"), "-w", str(s),
                        "-h", str(s), "-o", os.path.join(OUT, f"{key}-{s}.png")],
                       capture_output=True)

names = list(CUTS)
keys = [n.split()[0] + "-" + CUTS[n][0] + "-" + str(CUTS[n][1]).replace(".", "")
        for n in names]

cw, rh, top = 300, 130, 250
ch_total = top + rh * len(SIZES) + 60
parts = [f'<rect width="{len(names) * cw}" height="{ch_total}" fill="#FAFAF8"/>']
for i, (n, k) in enumerate(zip(names, keys)):
    x = i * cw
    parts.append(f'<image x="{x + 60}" y="20" width="180" height="180" '
                 f'href="{os.path.join(OUT, f"{k}-512.png")}"/>')
    parts.append(f'<text x="{x + 150}" y="228" text-anchor="middle" '
                 f'font-family="Helvetica" font-size="17" fill="#15171B">{n}</text>')
    for j, s in enumerate(SIZES):
        y = top + j * rh
        parts.append(f'<image x="{x + 60}" y="{y}" width="96" height="96" '
                     f'href="{os.path.join(OUT, f"{k}-{s}.png")}" '
                     f'style="image-rendering:pixelated"/>')
        parts.append(f'<image x="{x + 172}" y="{y + 48 - s // 2}" width="{s}" '
                     f'height="{s}" href="{os.path.join(OUT, f"{k}-{s}.png")}"/>')
        parts.append(f'<text x="{x + 212}" y="{y + 54}" '
                     f'font-family="Helvetica" font-size="13" fill="#7B7378">'
                     f'{s}px</text>')
p = os.path.join(OUT, "_sheet.svg")
open(p, "w").write(f'<svg xmlns="http://www.w3.org/2000/svg" '
                   f'xmlns:xlink="http://www.w3.org/1999/xlink" '
                   f'viewBox="0 0 {len(names) * cw} {ch_total}" '
                   f'width="{len(names) * cw}" height="{ch_total}">'
                   + "".join(parts) + '</svg>')
subprocess.run(["inkscape", p, "-w", str(len(names) * cw), "-h", str(ch_total),
                "-o", os.path.join(OUT, "_sheet.png")], capture_output=True)
print("cuts:", ", ".join(names))
