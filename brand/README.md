# Daily District — logo system

## The mark

**One square, two districts, divided by a jogged seam.** It depicts *districting* —
the act of drawing the line — rather than depicting a district.

Every jog is a right angle on a 12×12 cell grid, because congressional districts are
assembled from census blocks and real boundaries are all right angles and jogs. Because
every edge lands on a whole cell, the mark rasterises cleanly instead of mushing.

The mark is built as **one path**: the square, plus the channel as an even-odd hole. So
the seam is always *transparent* — one file is correct on a light page, a dark page, or
a photo, because the channel picks up whatever sits behind it. Only the outer corner
radius changes between the bare logo, the app tile and the maskable icon.

### Optical sizes

The mark carries its meaning in an interior seam, and interior detail is the first thing
lost when a mark is rasterised small. So there are two cuts, the way a type family has
optical sizes:

| Cut | Jogs | Channel | Use at |
| --- | --- | --- | --- |
| Display | 3 | 1.6 cells | above 32px |
| Small | 2 | 2.6 cells | 32px and below |

**The small cut is redrawn, not shrunk.** Verified against true 16px rasters. A one-jog
cut was tried and rejected — it loses the interlock and reads as two bars.

Never rotate the mark, fill the channel with a solid colour instead of leaving it open,
or re-space the jogs. **The seam is the mark.**

## Files

| File | Use |
| --- | --- |
| `mark.svg` | `currentColor`, display cut — inline in HTML |
| `mark-red.svg` | Baked red, for `<img src>`. **This is what the site's `logo.svg` now is** |
| `mark-white.svg` | Baked white, for red and dark grounds |
| `mark-small.svg` | Small cut, at or below 32px |
| `mark-sharp.svg` | Square corners, where the context imposes its own shape |
| `favicon.svg` | Small cut; answers the browser's dark mode |
| `favicon-display.svg` | Display cut, feeds the 48px+ `.ico` frames |
| `icon-tile.svg` | PWA icons, rounded tile |
| `icon-ios.svg` | Full-bleed; iOS applies its own squircle |
| `icon-maskable.svg` | Android maskable, inside the 80% safe circle |
| `icon-tile-cream.svg`, `icon-tile-navy.svg` | Reversed, for light and dark surfaces |
| `lockup-horizontal-red.svg` | **Primary lockup** |
| `lockup-*-reversed.svg` | White, for red and photographic grounds |
| `lockup-stacked*.svg` | Stacked lockups |
| `og-image.svg` | 1200×630 social card |
| `spec.html` | The presentation sheet — open it in a browser |

`dist/` holds `favicon.ico` (6 frames, 16–128), `icon-192.png`, `icon-512.png`,
`apple-touch-icon.png`, `icon-maskable-512.png` and `og-image.png`.

The maskable icon is sized to sit entirely inside Android's 80% safe circle. A
full-bleed version would have its seam clipped top and bottom, visually rejoining the
two districts and destroying the whole idea.

## Colour

Every value is already a token in `style.css` — no new brand colours.

| Role | Value | Token |
| --- | --- | --- |
| Mark, light grounds | `#C41230` | `--cmu-red` |
| Ground | `#F5F5F3` | `--bg` |
| Dark surface | `#182C4B` | `--cmu-navy` |
| Mark, dark grounds | `#FF3B57` | *(new)* |

`#FF3B57` is the one addition, and it's a rendering correction rather than a brand
colour: `#C41230` goes muddy below roughly 20% ground luminance. `favicon.svg` applies
it automatically via `prefers-color-scheme`.

## What is already live on the site

- **`/logo.svg` is now this mark.** It replaced the US-map silhouette, so all ~440
  references (index, mica, demo, the four content pages, and 435 district pages) picked
  it up with no HTML changes. The old map is recoverable: `git checkout logo.svg`.
- **CSS resized for the new aspect.** The map was 1.58:1 and the mark is square, so
  three rules were adjusted: `.game-logo` (44px wide → 32×32), `.welcome-logo-svg`, and
  the teaser logo in `index.html`. `.dd-header-inner img` needed no change — it was
  already locked to a square, which means the wide map had been squashed there.

## Not yet adopted

The favicon, app icons and social card at the repo root are still generated from the old
US map. To switch them:

1. Copy `dist/favicon.ico`, `dist/icon-192.png`, `dist/icon-512.png`,
   `dist/apple-touch-icon.png`, `dist/og-image.png` to the repo root.
2. Copy `favicon.svg` and `icon-maskable.svg` to the repo root.
3. Add `<link rel="icon" href="favicon.svg" type="image/svg+xml">` ahead of the existing
   `.ico` link, and bump the `?v=` cache parameters.
4. Add the maskable entry to `manifest.json`:
   `{ "src": "icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }`
5. Point `og:image` at `og-image.png` (currently `icon-512.png`, which crops badly in
   social previews) and add a matching `twitter:image`.

## Rebuilding

```bash
python3 brand/build.py      # regenerates every SVG here + all rasters in dist/
python3 brand/make_spec.py  # regenerates spec.html
```

`build.py` derives every asset from a single seam definition, so the family can't drift
out of sync. Requires `inkscape` on `PATH`. The `.ico` is assembled by hand — Pillow's
ICO writer silently collapses multi-frame input to a single frame, so each size is
rendered from vector at its own resolution instead.

## Rejected directions

`explorations/` holds the contact sheets, each with every candidate rendered large and
again as a true 16px raster. The failures explain the final choice: smooth irregular
blobs read as stains, thin outlines as scribbles, a detached "exclave" square as a
notification badge, a 4×4 block grid as a calculator keypad, and a nested district as a
photo frame. A stepped letter **D** was developed to completion first and dropped.
