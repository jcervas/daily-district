# Daily District — district mark

Five unequal districts on a 3×3 lattice, one filled: today's district. Drop-in
replacements for the `brand/` family; the wordmark path is the shipped
`wordmark.svg`, untouched.

## Geometry

53 × 53 units. Columns 21 / 14 / 14, rows 14 / 21 / 14, 2-unit gutters.
Stroke 1.6 units (0.03 × mark width), never rendered below 1px.
Districts: 1×2, 2×1, 1×1 (the answer), 1×2, 2×1.

## Files

| File | Use |
| --- | --- |
| `mark.svg` | Primary — navy boundaries, red answer cell |
| `mark-mono.svg` | `currentColor`, one colour — stamps, embossing, single-plate print |
| `mark-reversed.svg` | Cream boundaries, `#FF3B57` answer — navy and dark grounds |
| `mark-knockout.svg` | All cream — red panels, won state |
| `mark-small.svg` | Small cut. Filled and tinted, **not** outlined. 24px and below |
| `mark-small-reversed.svg` | Small cut on dark |
| `lockup-horizontal*.svg` | Primary lockup — site header, letterhead |
| `lockup-stacked*.svg` | Splash, share card |

## Rules

- The outlined cut fails below 24px — its hairlines fill in and the districts
  merge. Use the small cut there. It is redrawn, not shrunk.
- Never rotate the lattice; never make the cells equal (that reads as a word
  grid, not a map); never colour the districts individually.
- Clear space: one lattice unit (17.7 units) on all four sides.
- `#FF3B57` is a rendering correction for dark grounds, not a brand colour —
  `#C41230` goes muddy below ~20% ground luminance.

## Colour

| Role | Value |
| --- | --- |
| Answer cell | `#C41230` |
| Boundaries, type | `#182C4B` |
| Ground | `#F5F5F3` |
| Answer cell, dark grounds | `#FF3B57` |
| Small-cut district tints | `#B9C1CD` / `#D5DAE1` |
