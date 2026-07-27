#!/usr/bin/env python3
"""Rescuing the one non-letterform idea with a real concept behind it.

n2-split depicts *districting* — two districts sharing a jogged border — rather than
depicting a district. But it relied on two tones, which fails at 16px, in single-colour
print, and in embroidery. That's a versatility failure, and versatility is the brief.

This tests the single-tone rescue: separate the two pieces with a channel of ground
instead of tinting one of them, and see how wide that channel has to be to survive a
real 16px raster.
"""
import os
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "explore8")
os.makedirs(OUT, exist_ok=True)
RED = "#C41230"
G = 12.0

# Border between the two districts, top to bottom, in cell coords.
SEAM = [(6, 0), (6, 3), (4, 3), (4, 6), (8, 6), (8, 9), (5, 9), (5, 12)]


def _offset_seam(h, side):
    """Walk the seam top to bottom, offsetting each segment perpendicular to itself.

    side=-1 gives the left district's edge, +1 the right's. Offsetting x only (the
    obvious shortcut) leaves horizontal runs welded shut, so verticals move in x and
    horizontals move in y — and a horizontal jog's y offset flips with its direction,
    because which district sits above the jog depends on which way it turns.
    """
    pts = []
    for i, (x, y) in enumerate(SEAM):
        nx = x + side * h
        ny = y
        prev_x = SEAM[i - 1][0] if i > 0 else None
        next_x = SEAM[i + 1][0] if i + 1 < len(SEAM) else None
        # A point that begins a horizontal jog, or ends one, shifts in y.
        if next_x is not None and next_x != x:          # start of a horizontal run
            ny = y + (h if (next_x > x) == (side < 0) else -h)
        elif prev_x is not None and prev_x != x:        # end of a horizontal run
            ny = y + (h if (x > prev_x) == (side < 0) else -h)
        pts.append((nx, ny))
    return pts


def pieces(ch):
    """Left and right districts, each pulled back ch/2 from the shared seam."""
    h = ch / 2.0
    left = [(0, 0)] + _offset_seam(h, -1) + [(0, 12)]
    right = [(12, 0)] + [(12, 12)] + list(reversed(_offset_seam(h, +1)))
    return left, right


def emit(pts, s, ox, oy):
    return "".join(f"{'M' if i == 0 else 'L'}{ox + x * s:.2f} {oy + y * s:.2f}"
                   for i, (x, y) in enumerate(pts)) + "Z"


V = {"c08": 0.8, "c12": 1.2, "c16": 1.6}


def body(ch, s, ox, oy, fg):
    l, r = pieces(ch)
    return (f'<path fill="{fg}" d="{emit(l, s, ox, oy)}"/>'
            f'<path fill="{fg}" d="{emit(r, s, ox, oy)}"/>')


def tiled(ch, inset=96):
    s = (512 - 2 * inset) / G
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" '
            f'width="512" height="512">'
            f'<rect width="512" height="512" rx="112" ry="112" fill="{RED}"/>'
            f'{body(ch, s, inset, inset, "#FFFFFF")}</svg>')


def bare(ch, inset=40):
    s = (512 - 2 * inset) / G
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" '
            f'width="512" height="512">'
            f'<rect width="512" height="512" fill="#FAFAF8"/>'
            f'{body(ch, s, inset, inset, RED)}</svg>')


names = list(V)
for n in names:
    open(os.path.join(OUT, f"{n}-t.svg"), "w").write(tiled(V[n]))
    open(os.path.join(OUT, f"{n}-b.svg"), "w").write(bare(V[n]))
    for kind in ("t", "b"):
        for s in (512, 32, 16):
            subprocess.run(["inkscape", os.path.join(OUT, f"{n}-{kind}.svg"),
                            "-w", str(s), "-h", str(s),
                            "-o", os.path.join(OUT, f"{n}-{kind}-{s}.png")],
                           capture_output=True)

cw, ch_ = 300, 596
parts = [f'<rect width="{len(names) * cw}" height="{ch_}" fill="#FAFAF8"/>']
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
    parts.append(f'<text x="{x + 150}" y="578" text-anchor="middle" '
                 f'font-family="Helvetica" font-size="17" fill="#15171B">'
                 f'channel {V[n]} cells</text>')
p = os.path.join(OUT, "_sheet.svg")
open(p, "w").write(f'<svg xmlns="http://www.w3.org/2000/svg" '
                   f'xmlns:xlink="http://www.w3.org/1999/xlink" '
                   f'viewBox="0 0 {len(names) * cw} {ch_}" '
                   f'width="{len(names) * cw}" height="{ch_}">' + "".join(parts) + '</svg>')
subprocess.run(["inkscape", p, "-w", str(len(names) * cw), "-h", str(ch_),
                "-o", os.path.join(OUT, "_sheet.png")], capture_output=True)
print("channels:", ", ".join(f"{V[n]}" for n in names))
