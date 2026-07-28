# Daily District — logo system

**Live on the site.** This is the fourth mark tried, and the one that shipped
(commit `19818fed`). Three earlier directions were built out, and in one case
shipped and then pulled — see [Rejected directions](#rejected-directions) below
before reaching for any of them again.

## The mark

**An outlined district boundary** — a single asymmetric loop, stroked, nothing
filled inside it. The whole game is naming a congressional district from its
outline shape; this mark just *is* that shape. No letterform, no interior seam, no
radial symmetry of any kind.

### Optical sizes

A thin outline is the first thing to turn to mush when rasterised small, so there
are two cuts, drawn independently rather than one shrunk into the other:

| Cut | Points | Stroke | Use at |
| --- | --- | --- | --- |
| Display | 11 | 11.6% of the shape's own size | above 32px |
| Small | 6 | 20.6% of the shape's own size | 32px and below |

**The small cut is a different shape, not the display cut thickened.** A first pass
at it reused the display polygon at a heavier stroke; rendered at a real 16px, one
vertex stuck out as a leg and the whole thing read as a stray letter — a "P". The
small cut actually shipped is a rounder-cornered six-point loop, tuned against real
rasters until it read as an irregular boundary and nothing more specific.

Stroke width is defined as a **fraction of the shape's own rendered size**, not of
the canvas, so `mark_path()` gives correct results at any box a consumer asks for —
a 50px lockup icon and a 512px favicon use the same formula, no per-consumer
tuning.

Never fill the loop, apply the display cut below 32px, or add any second element
with its own rotational axis. **The asymmetry is what keeps this safe** (see the
history below) — don't design that back in.

## Files

| File | Use |
| --- | --- |
| `mark.svg` | `currentColor`, display cut — inline in HTML |
| `mark-red.svg` | Baked red, for `<img src>`. **This is what the site's `logo.svg` is** |
| `mark-white.svg` | Baked white, for red and dark grounds |
| `mark-small.svg` | Small cut, at or below 32px |
| `favicon.svg` | Small cut; answers the browser's dark mode |
| `favicon-small-flat.svg`, `favicon-display-flat.svg` | Feed the `.ico` frames — no `currentColor`, since Inkscape rasterises them directly |
| `icon-tile.svg` | PWA icons — solid tile, glyph centred with padding |
| `icon-ios.svg` | Full-bleed tile; iOS applies its own squircle |
| `icon-maskable.svg` | Android maskable, inside the 80% safe circle |
| `icon-tile-cream.svg`, `icon-tile-navy.svg` | Reversed, for light and dark surfaces |
| `lockup-horizontal-red.svg` | **Primary lockup** |
| `lockup-*-reversed.svg` | White, for red and photographic grounds |
| `lockup-stacked*.svg` | Stacked lockups |
| `og-image.svg` | 1200×630 social card |
| `spec.html` | The presentation sheet — open it in a browser |

`dist/` holds `favicon.ico` (6 frames, 16–128), `icon-192.png`, `icon-512.png`,
`apple-touch-icon.png`, `icon-maskable-512.png`, `og-image.png` and `logo-96.png`.

The maskable icon is sized to sit entirely inside Android's 80% safe circle, so the
crop can't clip the loop and leave a broken arc.

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

Everything, as of `19818fed` (`?v=6`):

- `/logo.svg`, `favicon.ico`, `favicon.svg`, `icon-192.png`, `icon-512.png`,
  `apple-touch-icon.png`, `icon-maskable-512.png`, `og-image.png`, and the
  `manifest.json` maskable entry are all copies of this mark's `dist/` output.
- `VERSION_NUMBER` in `script.js` and every `?v=` cache-busting parameter across the
  seven top-level pages and all 435 district pages were bumped together with the
  swap, per this repo's bump-every-push convention.
- `og:image`/`twitter:image` point at `og-image.png` (a real 1200×630 card) with
  `twitter:card` set to `summary_large_image` — the old setup pointed at the square
  `icon-512.png` and used `summary`, which centre-crops a wide card to a square.

## Rebuilding

```bash
python3 brand/build.py      # regenerates every SVG here + all rasters in dist/
python3 brand/make_spec.py  # regenerates spec.html
```

`build.py` derives every asset from the two polygons (`POLY_DISPLAY`,
`POLY_SMALL`) and the two stroke fractions, so the family can't drift out of sync.
Requires `inkscape` on `PATH`. The `.ico` is assembled by hand — Pillow's ICO
writer silently collapses multi-frame input to a single frame, so each size is
rendered from vector at its own resolution instead, small cut at 16/24/32 and
display cut from 48px up.

## Rejected directions

Three earlier marks, in order:

1. **A stepped letter D**, built from census-block-style right angles. Read as a
   damaged letter at a glance, not a map — the concept needed a paragraph of
   explanation to land, which means it hadn't landed. Dropped before shipping.
2. **A square split into two districts by a jogged seam.** This one *shipped* —
   worked cleanly upright, with two optical cuts of its own. It was then rotated
   45° for a diagonal look, which turned the square into a diamond with bent
   segments radiating from its centre; someone flagged it as reading too close to
   a hate symbol, and it was reverted immediately, no iterating on it live. A
   follow-up that kept the square upright and only angled the seam's own waypoints
   shipped safely — but the mark itself was dropped shortly after in favour of a
   different direction, not because of the incident. **Lesson carried into the
   current mark:** anything with a rotational or radiating structure is off the
   table regardless of how it's oriented.
3. **A puzzle piece** — one tab, one notch. Built out completely (favicon, tile,
   maskable, lockups, og-image) and held up at every size tested; a different
   direction was asked for before it shipped.

`explorations/` holds the contact sheets for most of this — sheets 1–6 are the D and
split-square work, 7–9 are non-letterform alternatives considered alongside the
split-square, and 10 (`make_compare.py`) is the head-to-head between the D, the
split-square, and those alternatives. The puzzle/rings round (`explore10.py`,
`explore11.py`, `make_rings_review.py`) was reviewed directly as rendered artifacts
rather than saved as a numbered sheet; `rings-review.html` is the one page from that
round kept as a standalone record. Every candidate across all of this is rendered
large and again as a true 16px raster, since a scaled-down vector always flatters a
mark and only a real raster tells you whether it survives.
