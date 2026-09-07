# Daily District — logo system

**Live on the site.** The Split-D Polygon mark. It replaces the single-figure
Polygon mark — see [History](#history) before reaching for any earlier direction
again.

## The mark

**A ring holding two half-figures.** A D on the right, a reversed D on the left,
split by a vertical channel. Each half is a straight stem plus 13 surveyed edges —
14 sides each, 28 in total, after the "uncouth twenty-eight-sided figure" at the
center of *Gomillion v. Lightfoot* (1960), the boundary drawn to fence Tuskegee's
Black voters out of town. Here the figure sits inside a whole circle: the
district, held.

The two halves are deliberately **not** mirror images of each other — different
vertex offsets, slightly different arc spans (164° right, 158° left). One weight,
one color.

**One color.** The ring and both figures are always the same color. Red
(`#C41230`) is the site primary; never a two-color split of ring and figures,
never a gradient.

**Kept upright.** Don't rotate the mark to a diagonal, mirror one half to make the
other, or stretch the circle to an ellipse. See [History](#history) for why
anything diagonal or radiating stays off the table.

### Geometry

100 × 100 units, one color. A stroked ring and two filled half-figures:

| Element | Construction |
| --- | --- |
| Ring | `<circle cx="50" cy="50" r="44">`, stroked, width 5.28 in the display cut |
| Right figure | 14-sided polygon, filled: `M52.64 20.06 L63.93 20.00 … Z` |
| Left figure | 14-sided polygon, filled: `M47.36 20.22 L35.91 23.22 … Z` |

Both figure paths are canonical and live in `build.py` (`RIGHT_DISPLAY` /
`LEFT_DISPLAY`, `RIGHT_SMALL` / `LEFT_SMALL`), never redrawn. The channel between
the two stems and the gap between each figure and the ring both equal the ring's
own stroke width — a proportion that has to be re-tuned by hand for each cut, which
is why the small cut is its own hand-set coordinates rather than a scaled copy of
the display figures (see [Optical sizes](#optical-sizes)).

### Optical sizes

Two cuts, like a type family's optical sizes:

| Cut | Ring | Figures | Use at |
| --- | --- | --- | --- |
| Display | r 44, stroke 5.28 | stems at ±2.64, outer extent 36.1 | above 24px |
| Small | r 44, stroke 7.9 | stems at ±3.96, outer extent 32.1 | 24px and below |

Unlike the previous single-figure Polygon mark — where the filled figure closed to
a blot below 24px and had to fall back to an outline — splitting into two smaller
figures keeps each one legible on its own, so **both cuts stay filled**. The small
cut's figures are re-derived by hand (not scaled from the display figures) so the
channel and the ring gap keep tracking the heavier small-cut stroke instead of
thinning out. Confirmed against real 16/24/32px renders, not a scaled-down vector.

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
"solved" fill file for this mark (the Split Ring's `mark-solved.svg` was a
brand-kit extra, never referenced by site code, and no mark since has defined an
equivalent) — dropped rather than carried forward unused. There is also no
outline treatment (`mark-outline.svg`, from the previous single-figure Polygon
mark) — splitting the figure in two removed the need for a small-size outline
fallback, so it isn't carried forward either.

`dist/` holds `favicon.ico` (6 frames, 16–128), `icon-192.png`, `icon-512.png`,
`apple-touch-icon.png`, `icon-maskable-512.png`, `og-image.png`, `logo-96.png`, and
the social avatars `avatar-red-1000.png`, `avatar-navy-1000.png`, `avatar-cream-1000.png`.

The app icons and avatars **inset** the ring inside their plate so a rounded tile or a
circle crop never clips it; the maskable icon sits entirely inside Android's 80% safe
circle. The social card is a solid CMU Red plate with the mark and wordmark in white,
centered — no ghost graphic, no tagline.

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
  was bumped to `?v=17` with this swap. Assets on their own version numbers
  (`style.css`, `backend.js`, etc.) were left alone; `VERSION_NUMBER` in `script.js`
  moved to `2.7`.
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

`build.py` embeds the canonical Split-D Polygon geometry and reads only the tracked
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
   D's. Replaced Ghost D. Shipped through two refinements; explored further as a
   wave-shifted, amplified, and rotated variant (a 35° rotation in particular read as a
   prohibition/cancel symbol) — none of it held up, and the direction was abandoned.
8. **Isoline** — a wireframe globe: limb, polar axis, and meridians east of the axis,
   sharing the limb's own curvature so every arc meets it exactly tangent. Replaced
   Split Ring; shipped.
9. **Polygon (single figure)** — a ring holding one 28-sided figure, the Gomillion v.
   Lightfoot boundary held whole inside the circle. Replaced Isoline. The filled figure
   closed to a blot below 24px, so the small cut had to fall back to an outline
   treatment instead of staying filled — a real constraint, not just a stylistic choice.
10. **This mark — Split-D Polygon.** Splits the single 28-sided figure into two
    14-sided half-figures — a D on the right, a reversed D on the left — separated by a
    vertical channel equal to the ring's own stroke width. Replaced the single-figure
    Polygon. Each half stays legible and filled on its own at every size, so unlike its
    predecessor, this mark never needs an outline fallback — `mark-outline.svg` is
    dropped from the kit as a result.

`explorations/` holds the contact sheets for the earlier rounds. Each candidate is
rendered large and again as a true 16px raster, since a scaled-down vector always
flatters a mark and only a real raster tells you whether it survives.
