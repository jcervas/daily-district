# Daily District — logo system

**Live on the site.** The Split Ring mark. It replaces the Ghost D — see
[History](#history) before reaching for any earlier direction again.

## The mark

**A ring divided by a straight vertical stem and a curved S-spine.** The spine bows
right across the top half and left across the bottom, closing against the stem into the
bowl of a **D** — one upright, one rotated 180° (Daily District). One weight, one
colour, drawn entirely in strokes with round caps and joins.

**One colour.** The ring, stem and spine are always the same colour. Red (`#C41230`) is
the site primary and the in-product *solved* fill (`mark-solved.svg` fills one D
region); never a two-colour split, never a gradient.

**Kept upright.** The mark sits square on its baseline — don't rotate it to a
diagonal or stretch the circle to an ellipse. See [History](#history) for why anything
diagonal or radiating stays off the table.

### Geometry

100 × 100 units. Three strokes, one colour:

| Element | Spec |
| --- | --- |
| Ring | `<circle cx="50" cy="50" r="44">`, stroked |
| Stem | `<line x1="50" y1="6" x2="50" y2="94">` |
| Spine | `M50 6 C 70 6 78 16 78 28 C 78 40 68 50 50 50 C 32 50 22 60 22 72 C 22 84 30 94 50 94` |
| Caps / joins | `stroke-linecap="round"`, `stroke-linejoin="round"` |

Stem and spine are both 180°-rotationally symmetric about the centre `(50,50)`, so the
two D's are one shape and its turn. All three parts share the stroke — **6** units in
the display cut. The path data lives in `build.py` (`DISPLAY` / `SMALL`) and is never
redrawn — assets only scale and tint it.

### Optical sizes

The display cut carries the ring and spine in thin strokes, the first thing lost to a
raster. So there are two cuts, the way a type family has optical sizes:

| Cut | Ring | Stroke | Use at |
| --- | --- | --- | --- |
| Display | r 44 | 6 | above 24px |
| Small | r 45 | 9 | 24px and below |

**The small cut is redrawn, not shrunk.** Below 24px the thin strokes silt up and the
interior closes to a solid disc; the small cut fattens the ring and the spine and pulls
the spine's shoulders wider so the two D's stay open. Verified against true 16px
rasters, not scaled-down vectors.

Clear space is one ring stroke on all four sides.

## Files

| File | Use |
| --- | --- |
| `mark.svg` | **Primary** — `currentColor`, one colour; inline it and set `color` |
| `mark-small.svg` | Small cut, `currentColor`. At or below 24px |
| `mark-red.svg`, `mark-navy.svg`, `mark-white.svg` | The mark baked CMU Red (site primary) / navy (alternate) / white (dark grounds) |
| `mark-solved.svg` | In-product *solved* state — one D region filled, ring drawn over |
| `logo.svg` | The mark baked in **CMU Red** for `<img src>`, to match the red wordmark it sits beside. **This is what the site's `logo.svg` is** |
| `favicon.svg` | Small cut in CMU Red; lifts to `#FF3B57` under the browser's dark mode |
| `favicon-small-red.svg`, `favicon-display-red.svg` | Feed the `.ico` frames — flat red, no classes or media query, since the rasteriser renders them directly |
| `app-icon.svg` | CMU Red plate, white mark, 19% inset — PWA `purpose: any` and iOS |
| `app-icon-maskable.svg` | Same, 27% inset — inside Android's 80% safe circle |
| `app-icon-navy.svg` | Navy plate, white mark — alternate icon / event skins |
| `avatar-red.svg`, `avatar-navy.svg`, `avatar-cream.svg` | Social profile pictures — plated mark tuned for a platform's circle crop (16% inset). Rastered to `dist/avatar-*-1000.png` |
| `lockup-horizontal.svg` | **Primary lockup** — `currentColor`, mark + wordmark |
| `lockup-stacked.svg` | Stacked lockup — `currentColor`, for square crops and avatars |
| `wordmark.svg` | Wordmark alone (unchanged across the mark swap) |
| `og-image.svg` | 1200×630 social card |
| `logo.css` | Palette tokens + `.dd-mark` / `.dd-wordmark` mask helpers (drop-in) |

Because the mark is a single `currentColor` plate, there are no `-mono` /
`-reversed` / `-knockout` colourway files: mono *is* `mark.svg`, and reversed is the
same file with `color` set to cream on a dark ground.

`dist/` holds `favicon.ico` (6 frames, 16–128), `icon-192.png`, `icon-512.png`,
`apple-touch-icon.png`, `icon-maskable-512.png`, `og-image.png`, `logo-96.png`, and
the social avatars `avatar-red-1000.png`, `avatar-navy-1000.png`, `avatar-cream-1000.png`.

The app icons and avatars **inset** the ring inside their plate so a rounded tile or a
circle crop never clips it; the maskable icon sits entirely inside Android's 80% safe
circle. The social card's ghost graphic is the mark at low opacity in one colour,
oversized and bleeding off the right edge.

## Colour

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
(below ~20% ground luminance). The navy colourway (`mark-navy.svg`, `app-icon-navy.svg`,
`avatar-navy.svg`) stays in the kit as the alternate.

## What's live on the site

- `/logo.svg`, `favicon.ico`, `favicon.svg`, `icon-192.png`, `icon-512.png`,
  `apple-touch-icon.png`, `icon-maskable-512.png`, `og-image.png`, and the
  `manifest.json` maskable entry are all copies of this mark's output.
- Every `?v=` cache-busting parameter on the affected brand filenames — across
  `index.html`, the district pages, `mica.html`, `demo.html` and `manifest.json` —
  was bumped to `?v=11` with the swap. Assets on their own version numbers were left
  alone.
- `og:image` / `twitter:image` point at `og-image.png` (a real 1200×630 card) with
  `twitter:card` set to `summary_large_image`.
- The mark (`.game-logo` header, `.teaser-logo`) is CMU Red and holds `#C41230` in
  both themes — the red wordmark beside it does not shift, so the mark doesn't either.
  All sit above the display cut's 24px floor.

## Rebuilding

```bash
python3 brand/build.py      # regenerates every SVG here + all rasters in dist/
python3 brand/make_spec.py  # regenerates spec.html (the presentation sheet)
```

`build.py` embeds the canonical Split Ring path data and reads only the tracked
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
   radiating structure oriented on a diagonal is off the table.
3. **A puzzle piece** — one tab, one notch. Built out completely; a different direction
   was asked for before it shipped.
4. **An outlined district boundary** — a single asymmetric stroked loop. Shipped for a
   time, then reverted back to the split square.
5. **The district lattice** — five unequal districts on a 3×3 grid, one filled. Replaced
   the split square; shipped.
6. **Ghost D** — two interlocking D's carved into a square frame, one colour plate.
   Replaced the lattice; shipped.
7. **This mark — Split Ring.** A ring bisected by a vertical S-spine, reading as two
   interlocking D's. Replaced Ghost D. Kept upright (a diagonal cut would read as a
   radiating split — see #2); red drops to the in-product *solved* fill.

`explorations/` holds the contact sheets for the earlier rounds. Each candidate is
rendered large and again as a true 16px raster, since a scaled-down vector always
flatters a mark and only a real raster tells you whether it survives.

The Split Ring design handoff (the brand sheet and the delivered asset set) is the
reference `build.py`'s output was checked against: the path data is byte-for-byte, and
the app-icon transforms match apart from number formatting (build.py centres the mark
exactly — `translate(96 96) scale(3.2)` — where the handoff rounded to `97 / 3.18`).
