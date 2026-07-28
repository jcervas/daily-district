# Daily District — logo system

**Live on the site.** This is the second mark tried, reverted back into place after
two later directions (a puzzle piece, then an outlined boundary) were explored and
set aside. See [History](#history) below before reaching for either of those again.

## The mark

**One square, two districts, divided by a jogged seam.** It depicts *districting* —
the act of drawing the line — rather than depicting a district. Every jog is a right
angle on a 12×12 cell grid, because congressional districts are assembled from census
blocks and real boundaries are all right angles and jogs. Because every edge lands on
a whole cell, the mark rasterises cleanly instead of mushing.

The mark is built as **one path**: the square, plus the channel as an even-odd hole.
So the seam is always *transparent* — one file is correct on a light page, a dark
page, or a photo, because the channel picks up whatever sits behind it. Only the
outer corner radius changes between the bare logo, the app tile and the maskable
icon.

**Kept strictly upright.** Do not rotate this mark or angle its outer square — see
[History](#history). The seam's own jogs are angular by design; the square's sides
and the canvas orientation are not to be touched.

### Optical sizes

The mark carries its meaning in an interior seam, and interior detail is the first
thing lost when a mark is rasterised small. So there are two cuts, the way a type
family has optical sizes:

| Cut | Jogs | Channel | Use at |
| --- | --- | --- | --- |
| Display | 3 | 1.6 cells | above 32px |
| Small | 2 | 2.6 cells | 32px and below |

**The small cut is redrawn, not shrunk.** Verified against true 16px rasters. A
one-jog cut was tried and rejected — it loses the interlock and reads as two bars.

Never fill the channel with a solid colour instead of leaving it open, or re-space
the jogs. **The seam is the mark.**

## Files

| File | Use |
| --- | --- |
| `mark.svg` | `currentColor`, display cut — inline in HTML |
| `mark-red.svg` | Baked red, for `<img src>`. **This is what the site's `logo.svg` is** |
| `mark-white.svg` | Baked white, for red and dark grounds |
| `mark-small.svg` | Small cut, at or below 32px |
| `mark-sharp.svg` | Square corners, where the context imposes its own shape |
| `favicon.svg` | Small cut; answers the browser's dark mode |
| `favicon-small-flat.svg`, `favicon-display-flat.svg` | Feed the `.ico` frames — no `currentColor`, since Inkscape rasterises them directly |
| `icon-tile.svg` | PWA icons — solid tile, the mark's own square runs to the tile's edge |
| `icon-ios.svg` | Full-bleed; iOS applies its own squircle |
| `icon-maskable.svg` | Android maskable, inside the 80% safe circle |
| `icon-tile-cream.svg`, `icon-tile-navy.svg` | Reversed, for light and dark surfaces |
| `lockup-horizontal-red.svg` | **Primary lockup** |
| `lockup-*-reversed.svg` | White, for red and photographic grounds |
| `lockup-stacked*.svg` | Stacked lockups |
| `og-image.svg` | 1200×630 social card |
| `spec.html` | The presentation sheet — open it in a browser |

`dist/` holds `favicon.ico` (6 frames, 16–128), `icon-192.png`, `icon-512.png`,
`apple-touch-icon.png`, `icon-maskable-512.png`, `og-image.png` and `logo-96.png`.

The maskable icon is sized to sit entirely inside Android's 80% safe circle. A
full-bleed version would have its seam clipped top and bottom, visually rejoining the
two districts and destroying the whole idea.

The social card's ghost graphic is a low-opacity **filled** square, not a stroked
outline — a filled shape can bleed off the canvas edge and still read fine, where a
stroked outline treated the same way reads as a cut-off picture frame.

## Colour

Every value is already a token in `style.css` — no new brand colours.

| Role | Value | Token |
| --- | --- | --- |
| Mark, light grounds | `#C41230` | `--cmu-red` |
| Ground | `#F5F5F3` | `--bg` |
| Dark surface | `#182C4B` | `--cmu-navy` |
| Mark, dark grounds | `#FF3B57` | *(new)* |

`#FF3B57` is the one addition, and it's a rendering correction rather than a brand
colour: `#C41230` goes muddy below roughly 20% ground luminance. `favicon.svg`
applies it automatically via `prefers-color-scheme`.

## What's live on the site

- `/logo.svg`, `favicon.ico`, `favicon.svg`, `icon-192.png`, `icon-512.png`,
  `apple-touch-icon.png`, `icon-maskable-512.png`, `og-image.png`, and the
  `manifest.json` maskable entry are all copies of this mark's `dist/` output.
- `VERSION_NUMBER` in `script.js` and every `?v=` cache-busting parameter on the
  affected filenames — across all seven top-level pages and all 435 district pages —
  were bumped together with the swap, per this repo's bump-every-push convention.
  Unrelated assets that coincidentally shared the old version number (e.g.
  `district-map.js`) were left alone; only the logo/icon/manifest/og-image filenames
  were targeted.
- `og:image`/`twitter:image` point at `og-image.png` (a real 1200×630 card) with
  `twitter:card` set to `summary_large_image`.
- The mark is square (both this design and the outline mark it replaced use a square
  viewBox), so no CSS layout changes were needed on this revert — `.game-logo`,
  `.welcome-logo-svg` and `.teaser-logo` were already square-compatible.

## Rebuilding

```bash
python3 brand/build.py      # regenerates every SVG here + all rasters in dist/
python3 brand/make_spec.py  # regenerates spec.html
```

`build.py` derives every asset from a single seam definition, so the family can't
drift out of sync. Requires `inkscape` on `PATH`. The `.ico` is assembled by hand —
Pillow's ICO writer silently collapses multi-frame input to a single frame, so each
size is rendered from vector at its own resolution instead, small cut at 16/24/32 and
display cut from 48px up.

## History

In order:

1. **A stepped letter D**, built from census-block-style right angles. Read as a
   damaged letter at a glance, not a map — the concept needed a paragraph of
   explanation to land, which means it hadn't landed. Dropped before shipping.
2. **This mark — the split square.** Shipped, worked cleanly upright. It was then
   rotated 45° for a diagonal look, which turned the square into a diamond with bent
   segments radiating from its centre; someone flagged it as reading too close to a
   hate symbol, and it was reverted immediately, no iterating on it live. A
   follow-up that kept the square upright and only angled the seam's own waypoints
   shipped safely. The mark was then dropped in favour of a different direction, not
   because of the incident — and has now been brought back, still upright.
   **Lesson that stays in force regardless:** anything with a rotational or radiating
   structure is off the table, no matter how it's oriented.
3. **A puzzle piece** — one tab, one notch. Built out completely (favicon, tile,
   maskable, lockups, og-image) and held up at every size tested; a different
   direction was asked for before it shipped.
4. **An outlined district boundary** — a single asymmetric stroked loop, nothing
   filled. Shipped for a time, then reverted back to this mark.

`explorations/` holds the contact sheets for all of this — sheets 1–6 are the D and
split-square work, 7–9 are non-letterform alternatives considered alongside the
split-square, 10 (`make_compare.py`) is the head-to-head between the D, the
split-square, and those alternatives, and the puzzle/outline rounds
(`explore10.py`, `explore11.py`, `make_rings_review.py`, `rings-review.html`) cover
the two later directions. Every candidate is rendered large and again as a true 16px
raster, since a scaled-down vector always flatters a mark and only a real raster
tells you whether it survives.
