# Handoff: Daily District logo system — the district mark

## Overview

A replacement mark for Daily District: **five unequal districts on a 3×3 lattice,
one filled** — the district you're looking for today. It replaces the current
split-square seam mark. The wordmark is unchanged; \`wordmark.svg\` is used verbatim.

Two jobs in this handoff:

1. Rewrite \`brand/build.py\` so the whole family derives from the new geometry.
2. Run it, copy \`brand/dist/\` out to the site, and bump \`VERSION_NUMBER\` +
   \`?v=\` params per the repo's convention.

Everything below is exact. The reference SVGs in \`assets/\` are the source of truth
for geometry — if the rewritten \`build.py\` output differs from them, the script is
wrong.

## About the design files

The files in \`assets/\` are **hand-generated reference SVGs**, correct and shippable
as-is, but they are not the deliverable: the repo's convention is that every brand
asset derives from one parametric source (\`brand/build.py\`) so the family cannot
drift out of sync. Port the geometry into that script rather than committing these
files directly.

\`design/\` holds two HTML design documents — the concept exploration and the final
brand sheet. Those are presentation artifacts, not code to port.

## Fidelity

**High-fidelity.** Exact geometry, exact hex values. Reproduce precisely.

## The mark — geometry

A **53 × 53 unit** square. Columns \`21 / 14 / 14\`, rows \`14 / 21 / 14\`, with
**2-unit gutters** between them.

Column x-ranges: \`0–21\`, \`23–37\`, \`39–53\`. Row y-ranges are identical.

Five districts, each a plain axis-aligned rect (x, y, w, h):

| # | Cells | Rect | Role |
| --- | --- | --- | --- |
| 1 | col 1, rows 1–2 | \`0, 0, 21, 37\` | boundary |
| 2 | cols 2–3, row 1 | \`23, 0, 30, 14\` | boundary |
| 3 | col 2, row 2 | \`23, 16, 14, 21\` | **answer cell — filled** |
| 4 | col 3, rows 2–3 | \`39, 16, 14, 37\` | boundary |
| 5 | cols 1–2, row 3 | \`0, 39, 37, 14\` | boundary |

**Stroke:** 1.6 units (0.03 × mark width), centered — so each outlined rect is drawn
inset by 0.8 on every side: \`x+0.8, y+0.8, w−1.6, h−1.6\`. Never render below 1
device pixel; that is the constraint that forces the small cut.

**Answer cell:** always district 3, always solid fill, never outlined.

The mark is **not** a single evenodd path. It is five rects — four stroked, one
filled — which is a structural break from the current seam mark. Plan for that when
rewriting \`build.py\`; see below.

## Two optical cuts

| Cut | Districts | Use at |
| --- | --- | --- |
| **Display** | 4 stroked + 1 filled | above 24px |
| **Small** | all 5 filled, boundaries tinted | 24px and below |

The outlined cut fails below 24px: hairlines fill in and the five districts merge
into one block. The small cut replaces stroke with **tint** — boundary districts
alternate two greys, the answer cell stays full red. It is redrawn, not shrunk.

Small-cut tints, alternating by district index (1,3,5 → tint A; 2,4 → tint B):

| Ground | Tint A | Tint B | Answer |
| --- | --- | --- | --- |
| Light | \`#B9C1CD\` | \`#D5DAE1\` | \`#C41230\` |
| Dark | \`#3A4C6B\` | \`#56688A\` | \`#FF3B57\` |

## Colour

All existing tokens in \`style.css\`. No new brand colours.

| Role | Value | Token |
| --- | --- | --- |
| Answer cell | \`#C41230\` | \`--cmu-red\` |
| Boundaries, wordmark | \`#182C4B\` | \`--cmu-navy\` |
| Ground | \`#F5F5F3\` | \`--bg\` |
| Answer cell, dark grounds | \`#FF3B57\` | *(existing correction)* |
| Small-cut tints | \`#B9C1CD\` / \`#D5DAE1\` | *(new, mark-local)* |

\`#FF3B57\` is a rendering correction, not a brand colour — \`#C41230\` goes muddy
below roughly 20% ground luminance. Carry the existing
\`@media (prefers-color-scheme: dark)\` rule in \`favicon.svg\` forward unchanged.

## Lockups

**Horizontal.** Mark at 53 units. Gap 14 units. Wordmark scaled so its height is
**0.74 × mark height** (\`scale = 53 × 0.74 / 56 ≈ 0.70\` against the 260 × 56
wordmark viewBox), vertically centered against the mark:
\`y = (53 − wordmarkHeight) / 2\`. Total viewBox ≈ \`249 × 53\`.

**Stacked.** Wordmark width = **2.29 × mark width**; mark horizontally centered above
it; gap 12 units. Total viewBox ≈ \`121.4 × 91.2\`.

The existing \`build.py\` derives lockup metrics from the wordmark's cap height
(\`WM_CAP_TOP\`/\`WM_BASELINE\`, already measured in the file). Either keep that
approach and tune the multipliers to land on the ratios above, or hard-code the
ratios — but the rendered result must match \`assets/lockup-horizontal.svg\`.

**Clear space:** one lattice unit (53/3 ≈ 17.7 units) on all four sides. In the
horizontal lockup, mark-to-wordmark gap is 0.75 unit.

## Rewriting \`brand/build.py\`

The script currently builds one evenodd path — a rounded square with a seam channel
punched through as a hole — and every downstream asset assumes that shape. The new
mark has no hole, no outer square, and two colours. Concretely:

1. **Replace the geometry block.** \`SEAM_DISPLAY\`, \`SEAM_SMALL\`, \`CH_DISPLAY\`,
   \`CH_SMALL\`, \`_offset()\`, \`channel()\`, \`_poly()\` and \`mark_path()\` all go.
   In their place: the \`G = 53\` lattice and the five-rect table above.
2. **\`glyph()\` grows a second colour.** It currently takes one \`fill\`. It now needs
   \`(stroke, answer_fill)\` for the display cut and \`(tint_a, tint_b, answer_fill)\`
   for the small cut. Keep \`size/x/y\` so the icon builders keep working.
3. **\`_rounded_rect()\` stays**, but only for icon plates — the mark itself has
   square corners now. \`RADIUS\` no longer applies to the mark; drop
   \`mark-sharp.svg\` (it exists only because the old mark was rounded).
4. **App icons simplify.** \`app_icon()\` and \`maskable_icon()\` currently layer a
   solid plate under the mark so the transparent seam reads against it. The new mark
   has no hole, so the plate is now just a background. Keep the layering — the tile
   still needs a ground — but the comment about the seam no longer applies. The
   maskable safe-circle math is unchanged and still correct.
5. **Icons use the small cut with tints**, not the display cut: at 192px the outline
   is fine, but the same file is rasterised down to 16px for the \`.ico\`. Follow the
   existing rule — \`favicon-small-flat.svg\` at ≤32, \`favicon-display-flat.svg\`
   above.
6. **Add \`mark-mono.svg\`** — every district in \`currentColor\`, boundaries stroked,
   answer filled. This is the one-plate print / stamp / emboss version, and it
   replaces the old \`mark-white.svg\` + \`mark-red.svg\` pair for inline use.
   Keep a baked \`mark-red.svg\` for \`<img src>\` (an \`<img>\` can't reach
   \`currentColor\`) — that is still what the site's \`/logo.svg\` is.
7. **\`og_card()\` needs one change.** Its ghost graphic is a low-opacity *filled*
   shape, deliberately, because a stroked outline bleeding off-canvas reads as a
   cut-off picture frame. The new display mark is mostly stroke — so the ghost must
   use the **small (filled) cut** at low opacity, not the display cut. The rest of
   the card is unchanged.
8. **Raster targets are unchanged.** Same \`dist/\` filenames, same \`.ico\` frame
   sizes (16/24/32/48/64/128), same hand-written ICO packing.
9. **Update the module docstring and \`brand/README.md\`.** Both describe the seam
   mark at length. \`assets/README.md\` in this bundle is a drop-in replacement for
   \`brand/README.md\`.

### Rules that stay in force

- **Never rotate the lattice.** The repo's history records a rotated variant of the
  previous mark being flagged and reverted; the standing rule is that anything with
  a rotational or radiating structure is off the table. Keep this mark upright.
- Never make the cells equal — an even 3×3 grid reads as a word puzzle, not a map,
  and that was the specific failure the unequal lattice was drawn to fix.
- Never colour the districts individually.
- Never fill the boundary districts in the display cut, and never outline the
  answer cell.

## Verification

After running \`python3 brand/build.py\`:

- Diff each generated SVG against its counterpart in \`assets/\` — geometry should
  match to within rounding.
- Open \`brand/dist/favicon.ico\` and confirm all six frames are present (Pillow's
  ICO writer silently collapses multi-frame input; the script writes the file by
  hand for exactly this reason).
- Look at the true 16px raster, not a scaled-down vector. The five districts must
  stay separable.
- Regenerate \`brand/spec.html\` via \`python3 brand/make_spec.py\`.

## Adoption checklist

Per \`brand/README.md\`'s existing process:

- Copy \`brand/dist/\` output to \`/logo.svg\`, \`favicon.ico\`, \`favicon.svg\`,
  \`icon-192.png\`, \`icon-512.png\`, \`apple-touch-icon.png\`,
  \`icon-maskable-512.png\`, \`og-image.png\`.
- Bump \`VERSION_NUMBER\` in \`script.js\` and every \`?v=\` param on those filenames,
  across all seven top-level pages and all 435 district pages. Leave unrelated
  assets that coincidentally share the version number alone.
- The mark is square, same as the one it replaces, so \`.game-logo\`,
  \`.welcome-logo-svg\` and \`.teaser-logo\` need no CSS changes.
- \`.dd-wordmark\` masks \`/wordmark.svg\` — unchanged, no action.

## Files in this bundle

| Path | What |
| --- | --- |
| \`assets/mark.svg\` | Primary — navy boundaries, red answer |
| \`assets/mark-mono.svg\` | \`currentColor\`, one plate |
| \`assets/mark-reversed.svg\` | Cream boundaries, \`#FF3B57\` answer |
| \`assets/mark-knockout.svg\` | All cream — red panels |
| \`assets/mark-small.svg\` | Small cut, light ground |
| \`assets/mark-small-reversed.svg\` | Small cut, dark ground |
| \`assets/lockup-horizontal*.svg\` | Horizontal lockup, 3 colourways |
| \`assets/lockup-stacked*.svg\` | Stacked lockup, 2 colourways |
| \`assets/README.md\` | Drop-in replacement for \`brand/README.md\` |
| \`design/Daily District Brand Sheet.dc.html\` | Final spec sheet — construction, clear space, don'ts, applications |
| \`design/Daily District Logo.dc.html\` | Concept exploration, turns 1–5 |
| \`design/wordmark.svg\` | Copy of the repo's shipped wordmark, for the design docs |

The two \`.dc.html\` files reference \`wordmark.svg\` as a sibling; keep it next to
them if you open them in a browser.
