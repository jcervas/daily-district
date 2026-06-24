# Unified map — migration plan (branch: unified-map)

Goal: collapse the two D3 picker maps (`#us-ref-map` + `#district-tiles`) into **one SVG,
one projection, one `d3.zoom`**. Transitions become `zoom.transform` tweens + layer
opacity toggles + restyle — no second SVG, no cross-fade. The Leaflet `#map` (mystery
shape + raster hint tiles) stays as-is (different content + raster tech).

## Done (Step 1, shipped to main as v2.3.0)
- District map reuses the ref map's **exact** `usRefProjection` instance + `_usRefW/_usRefH`
  viewBox; state→district handoff uses the **identical** transform (state-outline bounds,
  margin 0.85). The two maps now register pixel-for-pixel (~4px), so the transition
  dissolves between matching shapes. Mismatch fixed.
- Guarded the district pre-build so a throw can't strand the player in the state phase.

## Current surfaces
1. `#map` — Leaflet. Mystery district shape + progressive hillshade/satellite/street hint
   reveal (`applyMapStage`). **Keep.**
2. `#us-ref-map` — D3 SVG. `usRefProjection` (AlbersUSA, `fitSize`), `usRefZoom`. State
   polygons (clickable, hot/cold), white border mesh, offshore callouts. Group =
   `usRefMapGroup`. Zoom handler: callout rescale only.
3. `#district-tiles` — D3 SVG (now sharing #2's projection/viewBox). `districtZoomBehavior`.
   Built by `buildDistrictD3Map` → `_buildDistrictCtx` (+ `_drawGameplayTiles` /
   `_drawGameOverMap`). Force-sim circles, district polys, county/road/urban layers,
   game-over answer highlight + leader-line badge + spark/confetti. Zoom handler:
   counter-scales circles/text/strokes, retunes the force sim, repositions the badge,
   fades context layers.

## Target single-SVG architecture
One SVG (reuse `#us-ref-map`'s), one root `g` (`usRefMapGroup`), one `usRefZoom`.

Layer groups inside the root `g` (back→front):
- `g.layer-other-states`   national context fills (district/game-over phases)
- `g.layer-states`         the 50 clickable state paths + white border mesh (state phase)
- `g.layer-callouts`       offshore small-state callouts (state phase)
- `g.layer-context`        counties / roads / urban (district + game-over)
- `g.layer-districts`      the guessed state's district polygons + state border
- `g.layer-tiles`          force-sim circles + connectors (district phase, clickable)
- `g.layer-answer`         answer highlight + leader badge + spark (game over)

Phase controller `setMapPhase('state'|'district'|'gameover', {animated})`:
- state: zoom→valid-states bbox; show states+callouts; hide districts/tiles/context/answer.
- district: zoom→guessed-state fit (margin 0.85); build+show districts+tiles+context;
  fade/disable states; hide callouts.
- gameover: zoom→answer-district bbox; show context+answer+badge.

Unified zoom handler (`usRefZoom.on('zoom')`) does, per what's present:
- always: `g.attr('transform', t)`; if callouts present → `_updateCalloutsForZoom(k)`.
- if `.layer-tiles` present → counter-scale circles/text/strokes (`targetCirclePx/k`),
  retune force sim, hide connectors when `k>1.5`.
- if `.layer-answer` present → reposition/resize the badge; fade counties/roads/urban by k.

## Migration steps (each testable)
1. Add the layer-group skeleton to `initUSRefMap` (empty groups in `usRefMapGroup`); move
   the existing state paths + border + callouts into `layer-states`/`layer-callouts`.
2. Re-point `_buildDistrictCtx`/`_drawGameplayTiles`/`_drawGameOverMap` to append into
   `usRefMapGroup`'s `layer-*` groups instead of a new SVG. Drop the `#district-tiles` svg
   creation; keep the force sim (positions already in the shared projection).
3. Fold the district zoom-handler body into `usRefZoom.on('zoom')` (guarded by layer
   presence). Delete `districtZoomBehavior`.
4. Replace `showDistrictD3Map` + the cross-fade block with `setMapPhase('district')`
   (zoom + toggle). Replace `_applyDistrictZoom` with the phase zoom targets.
5. Rewire the +/−/fit zoom buttons to a single controller keyed off `gamePhase`.
6. Game-over: `setMapPhase('gameover')` (answer zoom + reveal layers); keep spark/confetti.
7. Delete `#district-tiles` from `buildGameSection`, plus dead vars
   (`districtZoomBehavior`, `_districtSvgSel`, the two-map crossfade timing).
8. Regression pass: daily win/lose, archive replay, session restore, dark mode, mobile
   (ResizeObserver re-fit), fit-toggle (state vs active vs national), hot/cold elimination.

## Risk areas
- Force-sim retune on live zoom must not thrash during the entry zoom (`_tileZoomInAnimating`).
- Badge counter-positioning math assumes the tiles' projection — already shared now.
- Game-over reveal sequencing (`_gameOverAnimsCallback`, spark, confetti) tied to the old
  tiles SVG lifecycle — must re-home onto the single SVG.
- Zoom `scaleExtent` differs by phase (state vs district) — set per phase.
