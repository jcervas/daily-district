# Daily District — logo system

**Live on the site.** The district mark, shipped from the design handoff in
`explorations/district-mark-handoff/`. It replaces the split-square seam mark. See
[History](#history) before reaching for any of the earlier directions again.

## The mark

**Five unequal districts on a 3×3 lattice, one filled** — the district you're looking
for today. It depicts a *districted map with an answer sitting in it*, which is the
game, rather than depicting a single district.

The lattice is deliberately uneven — columns 21/14/14, rows 14/21/14, 2-unit gutters
— because an even 3×3 grid reads as a word puzzle, not a map. The districts span it
1×2, 2×1, 1×1, 1×2, 2×1, so they interlock instead of tiling. Every edge lands on a
whole unit, so the mark rasterises cleanly instead of mushing.

Four boundary districts are drawn as **outlines**; the answer cell is **solid**. Never
fill the boundaries in the display cut, never outline the answer cell, and never
colour the districts individually.

**Kept strictly upright.** Do not rotate the lattice — see [History](#history).

### Geometry

53 × 53 units. Stroke 1.6 units (0.03 × mark width), centered, so each outlined rect
is drawn inset 0.8 on every side. Never render the stroke below 1 device pixel; that
is the constraint that forces the small cut.

| # | Cells | Rect | Role |
| --- | --- | --- | --- |
| 1 | col 1, rows 1–2 | `0, 0, 21, 37` | boundary |
| 2 | cols 2–3, row 1 | `23, 0, 30, 14` | boundary |
| 3 | col 2, row 2 | `23, 16, 14, 21` | **answer cell — filled** |
| 4 | col 3, rows 2–3 | `39, 16, 14, 37` | boundary |
| 5 | cols 1–2, row 3 | `0, 39, 37, 14` | boundary |

The mark is five separate rects, not one path — a structural break from the seam mark,
which was a single even-odd path with a transparent channel punched through it.

### Optical sizes

The display cut carries the mark in hairlines, and hairlines are the first thing lost
to a raster. So there are two cuts, the way a type family has optical sizes:

| Cut | Districts | Use at |
| --- | --- | --- |
| Display | 4 outlined + 1 filled | above 24px |
| Small | all 5 filled, boundaries tinted | 24px and below |

**The small cut is redrawn, not shrunk.** Below 24px the outlines fill in and the five
districts merge into one block; the small cut replaces stroke with tint so they stay
separable. Verified against true 16px rasters, not scaled-down vectors.

Small-cut tints alternate by district index — 1 and 5 take tint A, 2 and 4 take tint
B, and the answer cell is always full red.

| Ground | Tint A | Tint B | Answer |
| --- | --- | --- | --- |
| Light | `#B9C1CD` | `#D5DAE1` | `#C41230` |
| Dark | `#3A4C6B` | `#56688A` | `#FF3B57` |

Clear space is one lattice unit (53/3 ≈ 17.7 units) on all four sides.

## Files

| File | Use |
| --- | --- |
| `mark.svg` | **Primary** — navy boundaries, red answer cell |
| `mark-mono.svg` | `currentColor`, one plate — stamps, embossing, single-plate print |
| `mark-reversed.svg` | Cream boundaries, `#FF3B57` answer — navy and dark grounds |
| `mark-knockout.svg` | All cream — red panels, won state |
| `mark-red.svg` | The primary mark baked, for `<img src>`. **This is what the site's `logo.svg` is** |
| `mark-small.svg` | Small cut, light ground. At or below 24px |
| `mark-small-reversed.svg` | Small cut, dark ground |
| `favicon.svg` | Small cut; answers the browser's dark mode |
| `favicon-small-flat.svg`, `favicon-display-flat.svg` | Feed the `.ico` frames — no classes or media query, since the rasteriser renders them directly |
| `icon-tile.svg` | PWA icons — solid plate, mark inset |
| `icon-ios.svg` | iOS applies its own squircle, so the mark is inset further |
| `icon-maskable.svg` | Android maskable, inside the 80% safe circle |
| `icon-tile-cream.svg`, `icon-tile-navy.svg` | Knockout on red, reversed on navy |
| `lockup-horizontal.svg` | **Primary lockup** |
| `lockup-*-mono.svg` | `currentColor` |
| `lockup-*-reversed.svg` | Cream, for navy and photographic grounds |
| `lockup-stacked*.svg` | Stacked lockups |
| `og-image.svg` | 1200×630 social card |
| `spec.html` | The presentation sheet — open it in a browser |

`mark-red.svg` is byte-for-byte `mark.svg`. `mark.svg` would serve, but the adoption
step has copied out by the `-red` name since the first mark, so the name stays.

`dist/` holds `favicon.ico` (6 frames, 16–128), `icon-192.png`, `icon-512.png`,
`apple-touch-icon.png`, `icon-maskable-512.png`, `og-image.png` and `logo-96.png`.

The app icons inset the mark inside their plate rather than running it to the tile
edge. The seam mark was itself a rounded square and could *be* the tile; this mark's
bounding box is a full square, so on a rounded tile its corner districts would sit
outside the corner arc.

The maskable icon is sized to sit entirely inside Android's 80% safe circle. A
full-bleed version would lose its outer districts to the crop, leaving the answer cell
floating with nothing to be an answer to.

The social card's ghost graphic uses the **small (filled) cut** at low opacity in a
single colour. A filled shape can bleed off the canvas edge and still read fine; the
display cut's outlines treated the same way read as cut-off picture frames.

## Colour

Every value is already a token in `style.css` except the two small-cut tints, which
are mark-local rather than brand colours.

| Role | Value | Token |
| --- | --- | --- |
| Answer cell | `#C41230` | `--cmu-red` |
| Boundaries, wordmark | `#182C4B` | `--cmu-navy` |
| Ground | `#F5F5F3` | `--bg` |
| Answer cell, dark grounds | `#FF3B57` | *(existing correction)* |
| Small-cut tints | `#B9C1CD` / `#D5DAE1` | *(mark-local)* |

`#FF3B57` is a rendering correction rather than a brand colour: `#C41230` goes muddy
below roughly 20% ground luminance. `favicon.svg` applies the dark-ground palette
automatically via `prefers-color-scheme`.

## What's live on the site

- `/logo.svg`, `favicon.ico`, `favicon.svg`, `icon-192.png`, `icon-512.png`,
  `apple-touch-icon.png`, `icon-maskable-512.png`, `og-image.png`, and the
  `manifest.json` maskable entry are all copies of this mark's output.
- `VERSION_NUMBER` in `script.js` and every `?v=` cache-busting parameter on the
  affected filenames — across all seven top-level pages and all 435 district pages —
  were bumped together with the swap, per this repo's bump-every-push convention.
  Every `?v=8` in the repo was on an affected filename, so the bump to `?v=9` touched
  nothing unrelated; assets on their own version numbers (`district-pages.css?v=10`,
  `backend.js?v=24`, `style.css?v=220`) were left alone.
- `og:image`/`twitter:image` point at `og-image.png` (a real 1200×630 card) with
  `twitter:card` set to `summary_large_image`.
- The mark is square, same as the one it replaced, so `.game-logo` (32px),
  `.welcome-logo-svg` (64–104px), `.teaser-logo` (56px) and the district pages' header
  mark (34px) needed no CSS changes. All of them sit above the display cut's 24px
  floor.
- `.dd-wordmark` masks `/wordmark.svg` — unchanged, no action.

## Rebuilding

```bash
python3 brand/build.py      # regenerates every SVG here + all rasters in dist/
python3 brand/make_spec.py  # regenerates spec.html
```

`build.py` derives every asset from the one district table, so the family can't drift
out of sync. It rasterises with the first of `inkscape`, `rsvg-convert` or the
`cairosvg` module that the machine has. The `.ico` is assembled by hand — Pillow's ICO
writer silently collapses multi-frame input to a single frame, so each size is
rendered from vector at its own resolution instead, small cut at 16/24/32 and display
cut from 48px up.

## History

In order:

1. **A stepped letter D**, built from census-block-style right angles. Read as a
   damaged letter at a glance, not a map — the concept needed a paragraph of
   explanation to land, which means it hadn't landed. Dropped before shipping.
2. **The split square** — one square, two districts, divided by a jogged seam.
   Shipped, worked cleanly upright. It was then rotated 45° for a diagonal look, which
   turned the square into a diamond with bent segments radiating from its centre;
   someone flagged it as reading too close to a hate symbol, and it was reverted
   immediately, no iterating on it live. A follow-up that kept the square upright and
   only angled the seam's own waypoints shipped safely. It was later dropped for the
   outline mark, brought back, and has now been replaced by this one.
   **Lesson that stays in force regardless:** anything with a rotational or radiating
   structure is off the table, no matter how it's oriented.
3. **A puzzle piece** — one tab, one notch. Built out completely (favicon, tile,
   maskable, lockups, og-image) and held up at every size tested; a different
   direction was asked for before it shipped.
4. **An outlined district boundary** — a single asymmetric stroked loop, nothing
   filled. Shipped for a time, then reverted back to the split square.
5. **This mark — the district lattice.** Replaced the split square.

`explorations/` holds the contact sheets for all of this — sheets 1–6 are the D and
split-square work, 7–9 are non-letterform alternatives considered alongside the
split-square, 10 (`make_compare.py`) is the head-to-head between the D, the
split-square, and those alternatives, and the puzzle/outline rounds (`explore10.py`,
`explore11.py`, `make_rings_review.py`, `rings-review.html`) cover the two later
directions. `outline-mark-shipped-then-reverted/` holds that direction's full kit, and
`district-mark-handoff/` is the design handoff this mark was built from — including
the reference SVGs `build.py`'s output is verified against.
`Daily District logo concepts.zip` is that handoff exactly as it was delivered;
`district-mark-handoff/` is the same 17 files unpacked, so read the directory and keep
the zip only as the untouched original.

Every candidate is rendered large and again as a true 16px raster, since a scaled-down
vector always flatters a mark and only a real raster tells you whether it survives.
