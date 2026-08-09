# Daily District — logo system

**Live on the site.** The Ghost D mark, built from a design handoff that is not kept
in this repo — see [History](#history). It replaces the district-lattice mark; read
that section before reaching for any of the earlier directions again.

## The mark

**A closed square frame with two D's carved into the negative space** — one letterform
and its 180° rotation about the centre. Their stems land on the frame's inner edge and
their bowls overlap across the middle, so four regions meet with no gaps. It reads as a
monogram (two D's for Daily District) and as a bordered map cell at once.

**One colour plate.** The frame and both D's are always the same colour. Red (`#C41230`)
is an in-product state — the *solved* fill of one D region — never the resting mark. No
gradients, no two-colour splits.

**Kept strictly upright and square.** Do not rotate it or stretch the square to a
rectangle — see [History](#history).

### Geometry

100 × 100 units. Two elements, one colour:

| Element | Spec |
| --- | --- |
| Frame | even-odd square ring, 17 units wide, inset 4 from the artboard edge |
| D one | `M21 21v37h19l12-12V33L40 21Z`, stroked |
| D two | `M79 79V42H60L48 54v13l12 12Z`, stroked (D one rotated 180°) |
| Joins | `stroke-linejoin="miter"`, butt caps, no radii |

The D stroke is **7.5** units (0.44 × the frame weight) in the display cut. The path data
lives in `build.py` (`DISPLAY` / `SMALL`) and is never redrawn — assets only scale and
tint it.

### Optical sizes

The display cut carries the frame in hairlines, the first thing lost to a raster. So
there are two cuts, the way a type family has optical sizes:

| Cut | Frame | D stroke | Use at |
| --- | --- | --- | --- |
| Display | inset 4 | 7.5 | above 24px |
| Small | full-bleed | 14 | 24px and below |

**The small cut is redrawn, not shrunk.** Below 24px the interior closes and the mark
reads as a solid square; the small cut reclaims the 4-unit inset and thickens the D
stroke so the letters stay open. Verified against true 16px rasters, not scaled-down
vectors.

Clear space is one frame stroke (17 units, 0.17 × width) on all four sides — the mark
is a closed square and reads as part of any rule or box it touches.

## Files

| File | Use |
| --- | --- |
| `mark.svg` | **Primary** — `currentColor`, one plate; inline it and set `color` |
| `mark-small.svg` | Small cut, `currentColor`. At or below 24px |
| `mark-navy.svg` | Primary baked navy |
| `logo.svg` | The navy mark baked for `<img src>`. **This is what the site's `logo.svg` is** |
| `favicon.svg` | Small cut in navy; answers the browser's dark mode (flips to white) |
| `favicon-small-navy.svg`, `favicon-display-navy.svg` | Feed the `.ico` frames — flat navy, no classes or media query, since the rasteriser renders them directly |
| `app-icon.svg` | Navy plate, white mark, 19% inset — PWA `purpose: any` and iOS |
| `app-icon-maskable.svg` | Same, 27% inset — inside Android's 80% safe circle |
| `app-icon-red.svg` | CMU Red plate, white mark — alternate icon / event skins |
| `lockup-horizontal.svg` | **Primary lockup** — `currentColor`, mark + wordmark |
| `lockup-stacked.svg` | Stacked lockup — `currentColor`, for square crops and avatars |
| `wordmark.svg` | Wordmark alone (unchanged across the mark swap) |
| `og-image.svg` | 1200×630 social card |

Because the mark is a single `currentColor` plate, the previous family's `-mono` /
`-reversed` / `-knockout` colourway files are gone: mono *is* `mark.svg`, and reversed
is the same file with `color` set to cream on a dark ground.

`dist/` holds `favicon.ico` (6 frames, 16–128), `icon-192.png`, `icon-512.png`,
`apple-touch-icon.png`, `icon-maskable-512.png`, `og-image.png` and `logo-96.png`.

The app icons **inset** the mark inside their plate rather than running it to the tile
edge. The mark's bounding box is a full square, so on a rounded tile its corners would
sit outside the corner arc. The maskable icon is sized to sit entirely inside Android's
80% safe circle. The social card's ghost graphic is the mark at low opacity in one
colour, oversized and bleeding off the right edge.

## Colour

Every value is also a token in `style.css`.

| Role | Value | Token |
| --- | --- | --- |
| Primary mark, primary text | `#182C4B` | `--dd-navy` |
| Accent, solved state, red plate | `#C41230` | `--dd-red` |
| Red on dark grounds | `#FF3B57` | `--dd-red-dark` |
| Light ground | `#F4F3F1` | `--dd-bg` |

`#FF3B57` is a rendering correction rather than a brand colour: `#C41230` goes muddy
below roughly 20% ground luminance. The resting mark is one navy plate; on dark grounds
it flips to white (`favicon.svg` via `prefers-color-scheme`; the in-page marks via a
CSS `filter` on `.game-logo` / `.teaser-logo` / `.welcome-logo-svg`).

## What's live on the site

- `/logo.svg`, `favicon.ico`, `favicon.svg`, `icon-192.png`, `icon-512.png`,
  `apple-touch-icon.png`, `icon-maskable-512.png`, `og-image.png`, and the
  `manifest.json` maskable entry are all copies of this mark's output.
- Every `?v=` cache-busting parameter on the affected brand filenames — across
  `index.html`, `mica.html`, `demo.html` and `manifest.json` — was bumped `?v=9` →
  `?v=10` with the swap. Those were the only `?v=9` refs in the repo; assets on their
  own version numbers were left alone.
- `og:image` / `twitter:image` point at `og-image.png` (a real 1200×630 card) with
  `twitter:card` set to `summary_large_image`.
- The mark is a single navy plate, so unlike the two-colour lattice it needs a dark-mode
  treatment: `.game-logo` (header, 32px), `.teaser-logo` (56px) and `.welcome-logo-svg`
  (welcome splash) flip to white on dark grounds via a CSS `filter`, matching the
  wordmark. All sit above the display cut's 24px floor.
- `.dd-wordmark` masks `/wordmark.svg` — unchanged, no action.

## Rebuilding

```bash
python3 brand/build.py      # regenerates every SVG here + all rasters in dist/
python3 brand/make_spec.py  # regenerates spec.html (the presentation sheet)
```

`build.py` embeds the canonical Ghost D path data and reads only the tracked
`wordmark.svg`, so it reproduces every asset without the handoff present — the family
can't drift out of sync. It rasterises with the first of `inkscape`, `rsvg-convert` or
the `cairosvg` module that the machine has. The `.ico` is assembled by hand — Pillow's
ICO writer silently collapses multi-frame input to a single frame, so each size is
rendered from vector at its own resolution instead, small cut at 16/24/32 and display
cut from 48px up. `make_spec.py` imports `build` for its geometry and embeds real
rasters (not scaled vectors) so `spec.html` shows what actually ships.

## History

In order:

1. **A stepped letter D**, built from census-block-style right angles. Read as a
   damaged letter at a glance, not a map — dropped before shipping.
2. **The split square** — one square, two districts, divided by a jogged seam. Shipped,
   worked cleanly upright. A 45° diagonal variant turned it into a diamond radiating
   from its centre; someone flagged it as reading too close to a hate symbol, and it was
   reverted immediately. **Lesson that stays in force:** anything with a rotational or
   radiating structure is off the table, no matter how it's oriented.
3. **A puzzle piece** — one tab, one notch. Built out completely; a different direction
   was asked for before it shipped.
4. **An outlined district boundary** — a single asymmetric stroked loop. Shipped for a
   time, then reverted back to the split square.
5. **The district lattice** — five unequal districts on a 3×3 grid, one filled. Replaced
   the split square; shipped.
6. **This mark — Ghost D.** Two interlocking D's carved into a square frame, one colour
   plate. Replaced the lattice. Red drops to an in-product *solved* state rather than
   sitting in the resting mark.

`explorations/` holds the contact sheets for the earlier rounds. Each candidate is
rendered large and again as a true 16px raster, since a scaled-down vector always
flatters a mark and only a real raster tells you whether it survives.

The Ghost D design handoff — the delivered zip and the same files unpacked — is
**deliberately not in the repo**; both are ignored (`explorations/ghost-d-handoff/` and
the root bundle), since the site is served straight from it. The original lives in
Drive. Its reference SVGs are what `build.py`'s output was checked against; the path
data is byte-for-byte, and the app-icon transforms match apart from number formatting
(`scale(3.2)` vs `scale(3.2000)`) and the ¼-px maskable inset rounding. To re-run that
check, drop the bundle back into `explorations/ghost-d-handoff/` and diff `brand/*.svg`
against its `assets/`.
