# Daily District — logo system

**Live on the site.** The Isoline mark. It replaces the Split Ring — see
[History](#history) before reaching for any earlier direction again.

## The mark

**A wireframe globe.** The limb (a stroked circle), the polar axis (a straight
vertical line through the center), and one or two meridians east of the axis
(elliptical arcs sharing the limb's own radius). Both hidden letters share the
axis as their stem — the inner meridian closes a narrow D, the outer one a wider D
around it. Every line is one a cartographer would already draw, so the letters are
there once you look for them and invisible until you do. One weight, one color.

**One color.** The limb, axis and meridians are always the same color. Red
(`#C41230`) is the site primary; never a two-color split, never a gradient.

**Kept upright.** The axis is polar and stays vertical — don't rotate the mark to a
diagonal, mirror the meridians to the west side, or stretch the circle to an
ellipse. See [History](#history) for why anything diagonal or radiating stays off
the table.

### Geometry

100 × 100 units, one color, three kinds of stroked line, all sharing the limb's own
radius as their curvature:

| Element | Construction |
| --- | --- |
| Limb | `<circle cx="50" cy="50" r="44">`, stroked, width 6 in the display cut |
| Axis | A straight vertical line, `x1=x2=50`, `y 6` to `y 94`, round-capped |
| Meridians | Elliptical arcs `M50 6 A rx 44 0 0 1 50 94`, one per semi-minor axis, round-capped |

A meridian's `ry` is always the limb's own radius, so every arc meets the limb
exactly tangent at both poles — the two curves aren't independently drawn and
nudged into alignment; sharing a radius makes them tangent by construction, the
same way the Split Ring's tapered ribbons came to a literal point at the ring
instead of patching an accent onto it (see [History](#history)).

Both meridians (display cut) sit **east** of the axis — that asymmetry is what
gives the mark direction. Mirroring them to the west, or splitting one to each
side, breaks the two-D reading.

### Optical sizes

Two cuts, like a type family's optical sizes:

| Cut | Ring | Axis | Meridians | Use at |
| --- | --- | --- | --- | --- |
| Display | r 44, stroke 6 | stroke 5 | 20 and 35, stroke 5 | above 24px |
| Small | r 45, stroke 8 | stroke 6 | 28 only, stroke 6 | 24px and below |

Below 24px the three concentric curves (axis + two meridians) converge at both
poles and start to merge, closing the counters. The small cut drops the outer
meridian entirely rather than just thickening strokes — one D survives instead of
two blurring into each other — and bumps the ring and remaining meridian bolder for
the smallest real use on the site, the browser-tab favicon. Confirmed against real
16/24/32px renders, not a scaled-down vector.

Never re-weight either cut to fake an intermediate size; pick the nearer cut.

Clear space is one ring stroke on all four sides.

## Files

| File | Use |
| --- | --- |
| `mark.svg` | **Primary** — `currentColor`, one color; inline it and set `color` |
| `mark-small.svg` | Small cut, `currentColor`. At or below 24px |
| `mark-red.svg`, `mark-small-red.svg`, `mark-navy.svg`, `mark-white.svg` | The mark baked CMU Red (display + small cuts) / navy (alternate) / white (dark grounds) |
| `logo.svg` | The mark baked in **CMU Red** for `<img src>`, to match the red wordmark it sits beside. **This is what the site's `logo.svg` is** |
| `favicon.svg` | Small cut in CMU Red; lifts to `#FF3B57` under the browser's dark mode |
| `favicon-small-red.svg`, `favicon-display-red.svg` | Feed the `.ico` frames — flat red, no classes or media query, since the rasteriser renders them directly |
| `app-icon.svg` | CMU Red plate, white mark, ~19% inset — PWA `purpose: any` and iOS |
| `app-icon-maskable.svg` | Same, ~27% inset — inside Android's 80% safe circle |
| `app-icon-navy.svg` | Navy plate, white mark — alternate icon / event skins |
| `avatar-red.svg`, `avatar-navy.svg`, `avatar-cream.svg` | Social profile pictures — plated mark tuned for a platform's circle crop (16% inset). Rastered to `dist/avatar-*-1000.png` |
| `lockup-horizontal.svg` | **Primary lockup** — `currentColor`, mark + wordmark |
| `lockup-red.svg`, `lockup-white.svg` | Baked-color horizontal lockups |
| `lockup-stacked.svg` | Stacked lockup — `currentColor`, for square crops and avatars |
| `wordmark.svg` | Wordmark alone (unchanged across the mark swap) |
| `og-image.svg` | 1200×630 social card |
| `logo.css` | Palette tokens + `.dd-mark` / `.dd-wordmark` mask helpers (drop-in) |

Because the mark is a single `currentColor` plate, there are no `-mono` /
`-reversed` / `-knockout` colorway files: mono *is* `mark.svg`, and reversed is the
same file with `color` set to cream on a dark ground. There is no in-product
"solved" fill file for this mark (the Split Ring's `mark-solved.svg` was a brand-kit
extra, never referenced by site code, and the Isoline spec doesn't define an
equivalent) — dropped rather than carried forward unused.

`dist/` holds `favicon.ico` (6 frames, 16–128), `icon-192.png`, `icon-512.png`,
`apple-touch-icon.png`, `icon-maskable-512.png`, `og-image.png`, `logo-96.png`, and
the social avatars `avatar-red-1000.png`, `avatar-navy-1000.png`, `avatar-cream-1000.png`.

The app icons and avatars **inset** the ring inside their plate so a rounded tile or a
circle crop never clips it; the maskable icon sits entirely inside Android's 80% safe
circle. The social card's ghost graphic is the mark at low opacity in one color,
oversized and bleeding off the right edge.

## Color

Every value is also a token in `style.css`.

| Role | Value | Token |
| --- | --- | --- |
| Primary mark + wordmark **on this site** | `#C41230` | `--dd-red` (`--cmu-red`) |
| Alternate plate | `#182C4B` | `--dd-navy` |
| Red on dark grounds | `#FF3B57` | `--dd-red-dark` |
| Light ground | `#F4F3F1` | `--dd-bg` |

The mark matches the "Daily District" wordmark it sits beside. The wordmark is
`#C41230` in both light and dark (it does not shift), so `logo.svg` holds `#C41230` in
both too — no dark flip. `favicon.svg` is the one exception: it lifts to `#FF3B57` under
`prefers-color-scheme: dark`, since `#C41230` goes muddy on a dark browser tab bar
(below ~20% ground luminance). The navy colorway (`mark-navy.svg`, `app-icon-navy.svg`,
`avatar-navy.svg`) stays in the kit as the alternate.

## What's live on the site

- `/logo.svg`, `favicon.ico`, `favicon.svg`, `icon-192.png`, `icon-512.png`,
  `apple-touch-icon.png`, `icon-maskable-512.png`, `og-image.png`, and the
  `manifest.json` maskable entry are all copies of this mark's output.
- Every `?v=` cache-busting parameter on the affected brand filenames — across
  `index.html`, the district pages, `mica.html`, `demo.html` and `manifest.json` —
  was bumped to `?v=15` with this swap. Assets on their own version numbers
  (`style.css`, `backend.js`, etc.) were left alone; `VERSION_NUMBER` in `script.js`
  moved to `2.5`.
- `og:image` / `twitter:image` point at `og-image.png` (a real 1200×630 card) with
  `twitter:card` set to `summary_large_image`.
- The mark (`.game-logo` header, `.teaser-logo`) is CMU Red and holds `#C41230` in
  both themes — the red wordmark beside it does not shift, so the mark doesn't either.
  `/logo.svg` is always the display cut regardless of on-page size (there's no
  size-aware swap for an `<img>`), and the smallest real usage — 26px on the mobile
  header — was checked against a true render and holds up cleanly.

## Rebuilding

```bash
python3 brand/build.py      # regenerates every SVG here + all rasters in dist/
python3 brand/make_spec.py  # regenerates spec.html (the presentation sheet)
```

`build.py` embeds the canonical Isoline geometry and reads only the tracked
`wordmark.svg`, so it reproduces every asset without the handoff present — the family
can't drift out of sync. It rasterises with the first of `inkscape`, `rsvg-convert` or
the `cairosvg` module that the machine has. The `.ico` is assembled by hand — Pillow's
ICO writer silently collapses multi-frame input to a single frame, so each size is
rendered from vector at its own resolution instead, small cut at 16/24 and display
cut from 32px up. `make_spec.py` imports `build` for its geometry and embeds real
rasters (not scaled vectors) so `spec.html` shows what actually ships.

## History

In order:

1. **A stepped letter D**, built from census-block-style right angles. Read as a
   damaged letter at a glance, not a map — dropped before shipping.
2. **The split square** — one square, two districts, divided by a jogged seam. Shipped,
   worked cleanly upright. A 45° diagonal variant turned it into a diamond radiating
   from its center; someone flagged it as reading too close to a hate symbol, and it was
   reverted immediately. **Lesson that stays in force:** anything with a rotational or
   radiating structure oriented on a diagonal is off the table.
3. **A puzzle piece** — one tab, one notch. Built out completely; a different direction
   was asked for before it shipped.
4. **An outlined district boundary** — a single asymmetric stroked loop. Shipped for a
   time, then reverted back to the split square.
5. **The district lattice** — five unequal districts on a 3×3 grid, one filled. Replaced
   the split square; shipped.
6. **Ghost D** — two interlocking D's carved into a square frame, one color plate.
   Replaced the lattice; shipped.
7. **Split Ring** — a ring bisected by a vertical S-spine, reading as two interlocking
   D's. Replaced Ghost D. Shipped through two refinements (a flourish-accent version
   that left a visible notch where the accent met the ring, then a tapered-ribbon
   version that fixed the seam by construction). Explored further as a wave-shifted,
   amplified, and rotated variant; none of those held up (a 35° rotation in particular
   read as a prohibition/cancel symbol) and the direction was abandoned in favor of
   something more geometrically disciplined.
8. **This mark — Isoline.** A wireframe globe: limb, polar axis, and meridians east of
   the axis, sharing the limb's own curvature so every arc meets it exactly tangent —
   no separate accent, no offset ribbon, nothing that has to be nudged into alignment.
   Replaced Split Ring. Kept upright for the same reason as #2/#7: the axis is polar,
   so rotating it away from vertical breaks the metaphor as well as the alignment.

`explorations/` holds the contact sheets for the earlier rounds. Each candidate is
rendered large and again as a true 16px raster, since a scaled-down vector always
flatters a mark and only a real raster tells you whether it survives.
