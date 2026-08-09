#!/usr/bin/env python3
"""Round two: fix the puzzle piece, push rings further.

PUZZLE — the first attempt's arc sweep-flags were wrong, so the tab read as a dent
instead of a bump. Rebuilt from explicit geometry: for a clockwise perimeter, an
OUTWARD bump uses sweep=1, an INWARD notch uses sweep=0 — verified by tracing what
each sweep direction does from a point directly above/right of its arc's centre.
Same convention build.py's own _rounded_rect already uses for corner rounding, which
is why plain corner rounding stays sweep=1 throughout.

RINGS — the round-one version was a plain centred bullseye, which reads as a generic
"zoom/focus/target" icon (camera icons, radio buttons, search icons all use this same
shape). Two refinements, both keeping the "pure concentric, no spokes" safety
property intact:
  offset       — the innermost square shifts off-centre, toward one corner. Ties
                 directly to the game's actual mechanic (narrow broadly, then zero in
                 on one spot) instead of reading as a generic focal icon.
  offset-round — same offset, plus corners that get progressively rounder moving
                 inward (sharp state-level square -> soft, almost-circular centre) —
                 broad/angular at the outside, precise/smooth at the point found.
"""
import os
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "explore11")
os.makedirs(OUT, exist_ok=True)
RED = "#C41230"
CREAM = "#F5F5F3"
G = 12.0


# ---------------------------------------------------------------- puzzle piece
def puzzle_path(s, ox, oy):
    rc, rt = 0.9 * s, 1.5 * s

    def pt(x, y):
        return f"{ox + x * s:.2f} {oy + y * s:.2f}"

    return (
        f'M{pt(0.9, 0)} L{pt(11.1, 0)} '
        f'A{rc:.2f} {rc:.2f} 0 0 1 {pt(12, 0.9)} '
        f'L{pt(12, 4.5)} '
        f'A{rt:.2f} {rt:.2f} 0 0 1 {pt(12, 7.5)} '           # outward tab, sweep=1
        f'L{pt(12, 11.1)} '
        f'A{rc:.2f} {rc:.2f} 0 0 1 {pt(11.1, 12)} '
        f'L{pt(7.5, 12)} '
        f'A{rt:.2f} {rt:.2f} 0 0 0 {pt(4.5, 12)} '           # inward notch, sweep=0
        f'L{pt(0.9, 12)} '
        f'A{rc:.2f} {rc:.2f} 0 0 1 {pt(0, 11.1)} '
        f'L{pt(0, 0.9)} '
        f'A{rc:.2f} {rc:.2f} 0 0 1 {pt(0.9, 0)} Z'
    )


def puzzle_tiled(inset=100):
    s = (512 - 2 * inset) / G
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" '
            f'width="512" height="512">'
            f'<rect width="512" height="512" rx="112" ry="112" fill="{RED}"/>'
            f'<path fill="#FFFFFF" d="{puzzle_path(s, inset, inset)}"/></svg>')


def puzzle_bare(inset=40):
    s = (512 - 2 * inset) / G
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" '
            f'width="512" height="512">'
            f'<rect width="512" height="512" fill="{CREAM}"/>'
            f'<path fill="{RED}" d="{puzzle_path(s, inset, inset)}"/></svg>')


# ---------------------------------------------------------------------- rings
def rings_svg(variant, tile, inset_box=100):
    box = 512 - 2 * inset_box
    s = box / G
    fg, bg = ("#FFFFFF", RED) if tile else (RED, CREAM)
    ground = (f'<rect width="512" height="512" rx="112" ry="112" fill="{RED}"/>'
              if tile else f'<rect width="512" height="512" fill="{CREAM}"/>')

    if variant == "centered":
        specs = [(1.0, 10.0, 0.9, fg), (2.4, 7.2, 0.85, bg), (3.8, 4.4, 0.8, fg)]
    elif variant == "offset":
        # each ring the same size as centred, but nudged toward the bottom-right —
        # "narrow broadly, then zero in on one spot" instead of a static bullseye.
        specs = [(1.0, 10.0, 0.9, fg, 0.0), (3.0, 7.2, 0.85, bg, 0.9),
                  (5.2, 4.4, 0.8, fg, 1.6)]
    else:  # offset-round: same offset, corner radius grows from sharp to near-circular
        specs = [(1.0, 10.0, 0.35, fg, 0.0), (3.0, 7.2, 0.9, bg, 0.9),
                  (5.2, 4.4, 2.2, fg, 1.6)]

    body = ""
    for spec in specs:
        if variant == "centered":
            inset, size, rr, col = spec
            dx = dy = inset
        else:
            inset, size, rr, col, shift = spec
            dx = inset + shift * 0.5
            dy = inset + shift * 0.3
        r = rr * s * (size / 10.0)
        x, y = inset_box + dx * s, inset_box + dy * s
        w = size * s
        body += (f'<rect x="{x:.2f}" y="{y:.2f}" width="{w:.2f}" height="{w:.2f}" '
                 f'rx="{r:.2f}" fill="{col}"/>')
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" '
            f'width="512" height="512">{ground}{body}</svg>')


CANDS = ["puzzle", "rings-centered", "rings-offset", "rings-offset-round"]


def build(name):
    if name == "puzzle":
        return puzzle_tiled(), puzzle_bare()
    variant = name.split("-", 1)[1]
    return rings_svg(variant, True), rings_svg(variant, False)


for n in CANDS:
    t, b = build(n)
    open(os.path.join(OUT, f"{n}-t.svg"), "w").write(t)
    open(os.path.join(OUT, f"{n}-b.svg"), "w").write(b)
    for kind in ("t", "b"):
        for s in (512, 32, 16):
            subprocess.run(["inkscape", os.path.join(OUT, f"{n}-{kind}.svg"),
                            "-w", str(s), "-h", str(s),
                            "-o", os.path.join(OUT, f"{n}-{kind}-{s}.png")],
                           capture_output=True)

cw, ch = 300, 596
parts = [f'<rect width="{len(CANDS) * cw}" height="{ch}" fill="#FAFAF8"/>']
for i, n in enumerate(CANDS):
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
                 f'font-family="Helvetica" font-size="16" fill="#15171B">{n}</text>')
p = os.path.join(OUT, "_sheet.svg")
open(p, "w").write(f'<svg xmlns="http://www.w3.org/2000/svg" '
                   f'xmlns:xlink="http://www.w3.org/1999/xlink" '
                   f'viewBox="0 0 {len(CANDS) * cw} {ch}" '
                   f'width="{len(CANDS) * cw}" height="{ch}">' + "".join(parts) + '</svg>')
subprocess.run(["inkscape", p, "-w", str(len(CANDS) * cw), "-h", str(ch),
                "-o", os.path.join(OUT, "_sheet.png")], capture_output=True)
print("candidates:", ", ".join(CANDS))
