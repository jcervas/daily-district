# District Guess — Changelog

---

## v1.13 — State Outlines, Loading Globe & Confetti Perf

### State boundary outlines
- **State SVG pipeline (mapshaper)**: `build-map.sh` Step 6 generates a boundary SVG per state directly with mapshaper, replacing the earlier hand-rolled Python GeoJSON→SVG conversion
- **Per-state projection**: each state SVG is reprojected into its own state-plane/Albers CRS via `-proj crs=epsg:$epsg` (codes from `state_epsg()`), so outlines render undistorted instead of sheared raw lat/lon
- **Square viewBox + intrinsic fallback**: SVGs export with a centered square viewBox and `width/height="200"` as an intrinsic fallback so they never collapse to 0px inside flex containers
- **Browser-controlled sizing**: displayed size is set entirely by CSS per usage (guess-history slot `1.5rem`, gameover-grid correct-state slot `1.3em`); SVG carries `vector-effect="non-scaling-stroke"` so the outline stays a crisp ~1px at any size
- **Dark-mode safe**: paths stroke with `currentColor` (correct/wrong guesses tint green/red in guess history)
- **Guess history**: state guesses show the state's boundary outline beside the label
- **Gameover grid**: the correct-state slot (`⊙`) is replaced with the answer state's boundary outline

### Loading animation
- **Spinning tartan globe**: welcome/loading spinner replaced with a canvas-rendered tartan globe (`globe.js`) using Carnegie Red thread shades; "Loading…" caption beneath

### Performance
- **Win spark-trace de-jank**: removed the per-ember `drop-shadow` SVG filter (a per-frame GPU repaint for each of ~dozen live embers), cut the boundary spark from 5→3 laps, and throttled ember emission to every other frame — fixes the slow/stuttery confetti on win, especially on integrated GPUs. The lead spark keeps its glow.

### Fixes
- **Guesses render on tab open**: switching to the results-modal "Guesses" tab now calls `renderGuessHistory()` (guesses were previously blank)
- **Guesses survive reload**: `restoreGame()` sets `_gameStarted = true`, so `renderGuessHistory()` no longer early-returns after a page reload
- **Ref map viewBox**: US reference map uses the container's real dimensions instead of a hardcoded 960×400; prevents zoom-out on state elimination
- **Gameover map viewBox**: uses container dimensions rather than hardcoded 960×400

---

## v1.12 — Dynamic DOM, Navigation & Share Polish

- **Dynamic `#game-section` and `#gameover-modal`**: both elements removed from HTML and created/destroyed by JS — no hidden stale DOM between screens
- **Gameover screen sits below header**: `#gameover-modal` is a flex child of `<main>` (not a fixed overlay), so the sticky header remains visible
- **Click gameover to open results**: tapping anywhere on the gameover screen (except zoom buttons) opens the result modal
- **"Back to Map" returns to gameover**: closing the result modal reveals the already-built gameover screen underneath; gameover div is never rebuilt on dismiss
- **Welcome splash "Back to Map" / "Review Result"**: no longer recreates the gameover div — just hides the splash
- **`result-district-preview` size fix**: preview is re-rendered inside `openResultModal()` after the modal is visible, so `offsetWidth/Height` reflect real dimensions
- **US ref map geo bbox in state phase**: when no states are eliminated, the ref map shows the full national geographic view (`zoomIdentity`) instead of fitting to inner district points
- **Single remaining district zoom fix**: `zoomToBBox` now expands a zero-extent point to a 20×20 minimum bbox, preventing snap to national view when one district remains
- **State-phase loss shows gameover modal**: exhausting guesses before identifying the state now correctly triggers `showGameoverModal()`
- **Win/loss animations on correct screen**: `gameover-loss-shake` and `gameover-win-pulse` applied to `#gameover-map-wrap`, not the hidden `#district-tiles`
- **Rich share images**: landscape (800×450) and Instagram (1080×1350) share images now include urban areas, roads, and exterior dim mask matching the result preview style
- **Share watermark**: landscape share image includes `Daily District` watermark — no district key (spoiler-free)
- **Instagram share button**: new portrait 1080×1350 share image with map (top 60%) and details panel (bottom 40%); uses native share sheet on mobile, downloads PNG on desktop
- **Spoiler-free sharing**: district key and state name removed from all share text and images

---

## v1.11 — Gameover Modal Rewrite

- **Flash overlay reveal**: on game over, a full-viewport gold (win) or red (loss) overlay fades out while the gameover map fades in — no animated zoom, instant district context
- **Gameover map set directly**: zoom is set to district-fit transform immediately via `_goZoomInitial`; no D3 transition animation
- **Badge inside zoom group**: answer district label pill is now a child of the D3 zoom `<g>`, positioned at data coordinates `(dbx1, dby_center)` from `pathGen.bounds()`, with `scale(1/k)` counteracting zoom so the pill stays constant screen size during pan/zoom
- **Badge screen-size fix on mobile**: badge dimensions computed as `targetPx / renderScale` where `renderScale = min(containerW/960, containerH/400)`, so the pill is correctly sized on portrait mobile where the 960×400 viewBox renders at ~0.4× scale
- **Badge tracking**: badge updates `scale(1/k)` on every zoom event; previously was in the top-level SVG and did not follow map pan/zoom
- **Fit button toggle**: clicking the fit button alternates between district zoom and national zoom; uses a direct rAF loop with `performance.now()` (D3 transition tween was silently failing)
- **Zoom button style unified**: gameover zoom buttons now use `.mzb` class matching the gameplay map button style; removed separate `.mzb-go` CSS
- **Dismiss button removed**: `gameover-dismiss-btn` removed from index.html and CSS
- **`#game-section` hidden on gameover**: game section is hidden when gameover modal shows; restored (`hidden` class removed) when New Map starts
- **Gameover grid empty slots**: unused guess slots now show `□` instead of `⊗`; only slots used in a loss show `⊗`
- **`scaleExtent` expanded**: gameover zoom scaleExtent changed from `[0.3, Infinity]` to `[0.01, Infinity]` to prevent clamping during fit animation

---

## v1.8.2 — Mobile Polish & Confetti Performance

- **Confetti performance**: replaced per-particle `save/translate/rotate/restore` (4 canvas state calls) with a single `setTransform` call; set `globalAlpha` once per frame; sort particles by color to batch `fillStyle` switches; add `will-change: transform` to promote canvas to GPU layer — significantly faster on mobile GPUs
- **Fewer particles on touch devices**: `launchConfetti` drops from 140 → 70 particles; boundary confetti caps at 20 origins (evenly subsampled) with 4 particles each instead of 8
- **County borders at national zoom**: threshold raised from k > 1.5 to k > 3 and max opacity capped at 0.65 — county lines are invisible at national/state-level game-over zoom and only emerge when zoomed into a single district
- **Game-over badge size**: badge dimensions now divide by `k × cssScale` instead of `k` alone, making the pill a fixed 26 px tall in CSS pixels regardless of device pixel ratio — was ~9 px on mobile
- **Spark trace z-order**: spark layer raised above the state outline so the trace is never obscured by district or state lines
- **District tile text scaling**: font size capped at `targetCirclePx` so labels never overflow their circles in dense-state layouts (CA, TX, etc.)

---

## v1.8.1 — Game-Over Circle Reveal

- **Circle reveal transition**: on game over the selected district tile expands gold/red to fill the screen, the container resizes to game-over layout, then the circle collapses to reveal the already-built game-over map; spark and confetti fire after the reveal
- **Circle coverage fix**: switched overlay from `position: absolute` inside the tiles panel to `position: fixed` on `<body>` with viewport-diagonal sizing so it always covers the full screen
- **Confetti location fix**: corrected coordinate formula with `cssScale` and `xMidYMid meet` centering offsets so confetti origins land on the district boundary
- **Stroke-width fix at high zoom**: district tile circle `stroke-width` now scales as `1.5 / k` so stroke doesn't overwhelm fill at high auto-zoom levels (dense urban districts)

---

## v1.8 — Architecture Streamline & Elimination Redesign

- **Pre-built district tiles**: district map is built at page init (and after "New Map") so the state→district transition is a smooth reveal + zoom rather than a DOM rebuild mid-game — consistent starting point regardless of container size or scroll position
- **Explicit game phase**: `gamePhase` variable tracks `'state'` / `'district'` / `'gameover'` and is updated at each transition; replaces scattered boolean checks across the codebase
- **State elimination redesign**: wrong guess now narrows the remaining pool to only the guessed state's neighbors ("keep-only-neighbors"), then iteratively removes any state whose every adjacency neighbor is already eliminated ("dead-end cleanup") — example: guess MA → {CT, NH, NY, RI, VT} remain; then guess CT → only NY remains (RI auto-eliminated because both its neighbors CT and MA are gone)
- **Confetti after animation**: confetti waits until the win-pulse animation completes (~1.4 s after game over) before firing — no more confetti mid-transition
- **District tiles portrait-container fix**: district tiles SVG now uses `xMidYMid meet` instead of `slice`, preventing the NYC area from being clipped off-screen on narrow/portrait viewports
- **Restore game replay fix**: `restoreGame` replays eliminations through the new keep-only-neighbors + dead-end logic instead of the old hot/cold adjacency code

---

## v1.5 — Spark Animation Polish & Badge Sizing

- **Spark always plays**: animation runs every time the game-over screen is shown (including on page reload after completing a game), not just on the first reveal
- **District stays red**: fill is CMU red throughout the spark trace — no fill-hide/fade-in cycle
- **5 laps at 4 screen pixels**: spark circles the boundary 5 times at 4000 ms/lap (~20 s total); spark size 4 screen-pixels with triple drop-shadow glow
- **Larger badge pill**: pill height 16→20px, font 8→10px, per-character width factor 5.5→6.5 — pill and text are proportionally larger at all zoom levels
- **Shake/pulse gated to first reveal**: win-pulse and loss-shake CSS animations still only fire on the first correct/final guess, not on revisits

---

## v1.4.22 — rAF Spark (Internal)

- Switched from `d3.attrTween` (low-fps D3 transition) to `requestAnimationFrame` for smooth 60fps spark tracing

---

## v1.4.21 — Spark Animation, Badge Zoom Fix & Game-Over Zoom Tuning

- **Spark/ember boundary animation**: on game over, the answer district boundary now "draws in" like a welder tracing the outline — a glowing white spark rides the leading edge; `#ffb020` ember particles are emitted at ~45% probability per frame, flying outward and fading; after draw-in, the spark fades and the district fill fades in
- **Badge pill zoom scaling fixed**: the zoom handler now accounts for the icon's width and gap when computing pill width (`pW`), and repositions both the icon `<g>` and the text offset correctly on every zoom event — pill no longer drifts or grows at non-default zoom levels
- **Game-over zoom level reduced**: new formula `fitScale * 0.45` (capped 1.2–25×) replaces the old `Math.min(40, fitScale)` — district is shown with surrounding state/national context rather than filling the viewport
- **Check/x icon stroke-width reduced** to match `gc-icon-svg` standard (was 2.4, now 2)
- **Click-to-view results**: game over no longer auto-opens the result modal after a delay; a "View Results" button appears on the game screen so the user can inspect the highlighted district before viewing stats
- **Confetti gated**: confetti fires only on first explicit "View Results" click, not on every modal open

---

## v1.4.20 — Game-Over Badge & Animation

- **Badge pill on answer district**: after game over, a CMU-red pill badge appears at the answer district with a check (win) or × (loss) icon and the district label
- **`animateReveal` pipeline**: `showDistrictD3Map` and `buildDistrictD3Map` thread an `animateReveal` flag; correct final guess triggers the full animation path
- **Loss shake animation**: `gameover-loss-shake` CSS keyframe applied to `#district-tiles` on a loss
- **`openResultModal()` helper**: centralizes confetti gating and tab switching for all "View Results"/"Review Results" entry points

---

## v1.4.16 — Fix Map Size After Dismissing Welcome Splash

- **`map.invalidateSize()` on splash dismiss**: Leaflet's internal size cache was stale when the welcome modal was visible; `requestAnimationFrame(() => { map.invalidateSize(); map.fitBounds(...) })` in `dismissAndStart()` ensures the map fills its container correctly

---

## v1.4.15 — Wordmark Dark Mode

- **Wordmark turns white in dark mode**: `wordmark.svg` loaded via `<img>` cannot inherit `currentColor`; fixed with `filter: brightness(0) invert(1)` applied in both `@media (prefers-color-scheme: dark)` and `body.dark-mode`

---

## v1.4.14 — Instant Force Simulation & No Correct-Pick Delay

- **Force simulation synchronous**: `districtSimulation.stop().tick(N)` replaces the animated convergence — icons place instantly on first render and after zoom re-tune
- **No delay after correct district pick**: `submitDistrictTile` calls `processDistrictGuessTile` immediately (removed 480 ms `setTimeout`)

---

## v1.4.13 — District Auto-Zoom Fix

- **Skip auto-zoom for large remaining sets**: when the computed fit scale is ≤ 1.15 (remaining districts span most of the viewport), the auto-zoom is skipped entirely — prevents the map from zooming *out* and shifting the view unexpectedly

---

## v1.4.10 — Remove DC

- **DC excluded**: `districts` filtered to `f.properties.state !== 'DC'`; state count display reads "X of 50"

---

## v1.4.9 — Result Modal & Map Collapse Polish

- **Result modal buttons**: pill-style (`border-radius: 100px`) matching welcome-splash donate button style
- **New Map → welcome first**: `startNewMap()` shows the welcome modal before resetting `#map`
- **Thin bar on map collapse fixed**: `#game-section.map-collapsed #map` uses `transition: opacity 0s` so the shrinking sliver no longer flashes

---

## v1.4.8 — Welcome Splash Wordle Layout

- **Logo/wordmark pushed down**: `.welcome-top-spacer` flex spacer above the logo gives the splash more top breathing room matching Wordle's proportions
- **Narrower action buttons**: `max-width: 240px; min-width: 160px` on `.welcome-action-btn`

---

## v1.4.7 — Force Simulation Performance Fix

- **Fast simulation convergence**: raised D3 force simulation `alphaDecay` from the default `0.0228` (~300 ticks, ~5 s at 60 fps) to `0.12` (~35 ticks, < 1 s); `alphaMin` set to `0.01` — eliminates noticeable lag on large states like NY (26 districts)
- **Zoom re-tune also accelerated**: restart after zoom now uses the same `alphaDecay(0.12)` so re-layout after zooming settles quickly

---

## v1.4.6 — Welcome Modal Wordmark & New Map Flow

- **Wordmark SVG in welcome splash**: replaced plain "DAILY DISTRICT" text with `wordmark.svg` (Barlow 800 vector paths, CMU red `#C41230`); scales via `clamp(28px, 5vh, 44px)`
- **"Welcome Back" state**: for in-progress games the wordmark is swapped for a "Welcome Back" heading; CSS `[hidden] { display: none }` added to prevent `display: block` overriding the `hidden` attribute
- **New Map → welcome splash**: after clicking "New Map", the welcome splash now reappears with a fresh "Play" button instead of going straight into the game; `buildWelcomeButtons` lifted to module scope so `startNewMap` can call it after reset
- **`_gameStarted` reset on New Map**: ensures clue/history DOM guards fire correctly for the new game

---

## v1.4.5.1 — Bug Fix: Result Modal Not Blocking Welcome Splash

- **Fix "Back to map" routing**: closing the result modal no longer reveals the welcome splash — `showResult()` now skips auto-opening the modal when the welcome splash is still visible; users reach the result via the "Review Result" button on the welcome screen, which dismisses the splash first

---

## v1.4.5 — Result Modal & Map Label Polish

- **Result modal layout**: avg-time/guesses line moved below guess distribution; `result-time-line` gets a surface-alt background pill; `rstat-avg-time` drops its background and is now plain muted text
- **Avg guesses stat**: result modal now shows average number of guesses among correctly solved games (weighted from `guessDist`), alongside average solve time
- **Result answer code**: font-size clamped (`clamp(0.95rem, 3vw, 1.75rem)`) so long district names take less vertical space
- **result-message hidden on short viewports**: `@media (max-height: 720px)` hides the win/lose message to prevent scrolling on small screens
- **NE callout label collision avoidance**: small-state labels (VT, NH, MA, RI, CT, NJ, DE, MD) now start at each state's actual centroid Y and use iterative relaxation to push overlapping labels apart, rather than stepping from a fixed start point
- **Wordmark SVG**: `wordmark.svg` created as vector path outlines (Barlow 800 via Inkscape) — no font dependency, `fill="currentColor"` for dark/light theming

---

## v1.4.4 — Welcome Splash & Game-Over Polish

- **How to Play link** added to welcome splash above Donate button (small muted underline link)
- **Hint bar hidden on game over**: `#game-controls` no longer shown after game ends (no reason to show hints at that point)
- **Already-played banner fixed on mobile**: removed `position: sticky; top: 46px` that caused the banner to float over content; now `position: static`
- **"Use system default" placement**: moved below the Dark Theme label inside its settings row
- **Title click opens welcome splash**: clicking "Daily District" in the header re-opens the welcome modal

---

## v1.4.3 — Welcome Back, Confetti & Map Fixes

- **Welcome back screen**: returning to an in-progress game shows "Welcome Back", guess count, and a "Continue" button — built after `init()` resolves so game state is accurate
- **Confetti on win**: canvas confetti animation fires when the result modal opens after a correct guess
- **US map zoom fixed**: `Math.max(0.3, fit)` instead of `Math.max(1, fit)` allows scale < 1 so the full country is visible at game start; corners of contiguous US touch the container edges
- **Star ratings fixed**: feedback form star clicks now correctly highlight and store values
- **"STATISTICS" heading removed** from result modal to save space
- **Force simulation on zoom**: district icon positions re-tune (smaller collision radius, stronger centroid pull) as user zooms in
- **Urban/road context layers**: replaced D3 district mesh with road and urban area overlays for better visual context

---

## v1.4.2.1 — Welcome Modal Guards & Hint-Bar Cleanup

- **Welcome modal shown immediately** (before `init()` resolves) so there's no flash of unstyled game content on load
- **Clue/history DOM guarded**: `renderClues()` and `renderGuessHistory()` are no-ops until the welcome splash is dismissed (`_gameStarted` flag)
- **Hints modal lazy population**: `hints-clues-list` is populated only on modal open and cleared on close to avoid stale DOM
- **Locked hint cards**: icon-only in DOM until the clue is earned — label and value rendered only after reveal

---

## v1.4.2 — Performance & Feedback Polish

- **Deferred script loading**: non-critical scripts (Firebase, analytics) loaded after first interaction
- **Lazy Firebase initialization**: Firebase SDK loaded on demand, not at page load
- **Split TopoJSON**: large topology file broken into chunks for faster initial paint
- **Badge stroke scaling fixed**: beta badge stroke no longer scales with zoom transform
- **Feedback modal enhanced**: star rating UI, subject field, improved layout
- **Settings modal added**: dark/light/system theme toggle, confirm-selection mode toggle
- **Welcome modal revamped**: cleaner layout, Donate button pinned to bottom, spacing improvements
- **Map UI tweaks**: zoom buttons (+/−), rotate overlay hint, national backdrop layer
- **Mobile landscape layout**: two-column layout for landscape phones

---

## v1.4.1 — Welcome Modal, Context Map & Result Modal Polish

- **Welcome modal introduced**: shown on every visit; "Play" / "Continue" / "Back to Map" / "Review Result" buttons built after `init()` resolves to reflect restored game state
- **Result modal polished**: tightened spacing, smaller action buttons and stat numbers, district preview fills 35% of viewport height on mobile
- **Context map**: national D3 backdrop rendered behind district map
- **Map logo added** to header alongside wordmark

---

## v1.4.0.1 — Patch: District Icon Zoom & Daily/Random Split

- **District icon zoom**: icons, labels, and connector lines scale correctly at any zoom level; connector lines hide above 1.5×; force attraction strengthens with zoom
- **Daily vs. random games**: first game each day is deterministic (date seed); "New Map" uses per-user random seed in sessionStorage
- **Result modal**: removed redundant district sub-line; district preview projection fitted to container

---

## v1.4 — Mobile Polish & Scoring Fix

- **Mobile hint bar**: revealed cards collapse to icon-only strip on mobile; tap to open hints modal
- **District map auto-zoom**: after eliminations, map zooms to fit remaining possible districts; manual zoom preserved across rebuilds
- **Reference map aspect ratio**: SVG viewBox adapts to container and state shape
- **Guess scoring fix**: correct-state and correct-district picks are free; only wrong guesses count toward the total
- **Responsive hint cards** with auto-scroll to latest revealed card

---

## v1.35 — Hint Cards Redesign

- Replaced single expanding hint bar with a horizontal scrollable card row
- Each clue gets its own card: locked → lock icon; revealed → icon + label + value
- Latest revealed card highlighted with accent border and reveal animation
- Desktop: all values always visible; mobile: tap card to expand/collapse value
- Expand button removed (all hints inline)

---

## v1.34 — 2024 ACS Data & Game-Over Redesign

- Updated ACS data source to 2020–2024 5-year ACS; UI label updated accordingly
- Fixed missing districts (387 → 435) using block-count crosswalk weights from Block Assignment Files
- Share text redesigned: outcome summary + link only (no date)
- On game over: main map collapses; reference panel expands to full width
- All result modal tabs share a single district preview above the tab row
- Copyright line added to How to Play modal

---

## v1.33 — Game-Over Map Improvements

- Reference map zooms to answer district with surrounding context after game over
- Answer district filled theme-aware (white in dark mode, near-black in light)
- All other districts rendered with transparent fill + boundary strokes only
- "Already Played" banner persists after result modal is dismissed
- State outline and other-district boundaries rendered in muted tone for context

---

## v1.32 — Compactness Metrics & ACS in TopoJSON

- Added district compactness metrics: area (sq mi), Polsby-Popper, Reock — computed via `redistmetrics` R package
- ACS demographic data embedded in TopoJSON at build time (no runtime Census API calls)
- Reference map: zoom and pan via `d3.zoom()` (scale 0.5–20×, double-click disabled)
- Fixed map dragging after D3 zoom integration

---

## v1.31 — Polish & Bug Fixes

- Refined beta badge styling and map background
- Fixed dark mode district highlight (now theme-aware)
- Fixed share text: correct guess count, ✓/✗ symbols instead of color emojis
- Added "Correct!" indicator in correct-guess rows in Guesses tab

---

## v1.3 — TopoJSON Pipeline & D3 Overhaul

- Replaced static GeoJSON with a custom TopoJSON build pipeline
- TopoJSON bundles five layers: districts, state boundaries, urban areas, roads, inner points
- D3 overlay renders in stages: roads → urban areas → state outline → district highlight
- 2026 district boundaries used throughout
- Game-over view shows answer district with full state context

---

## v1.2 — Hint Bar, Census Cards & Layout

- Progressive hint bar: clue icons, labels, values — one clue unlocked per wrong guess
- Result modal "District Profile" tab with census demographic cards
- State outline layer added to D3 reference map
- Viewport layout improvements; reference panel below main map
- Modal sizing fixed (no longer shifts between tabs)

---

## v1.11 — Hints Modal & UX Refinements

- Hints modal added (auto-opens on first visit)
- D3-based reference map replaces Leaflet for US state selection
- "Guesses" tab added to result modal
- Beta badge with version number
- D3 district map with force layout for label placement; click to submit guess
- Clues reordered: size → delegation → income → racial plurality → partisanship → state

---

## v1.1 — Hot/Cold Elimination & Two-Phase Guessing

- Hot/cold elimination on wrong state guesses: adjacent states stay in play; non-adjacent states and their neighbors eliminated and greyed out
- State chips greyed out as eliminated; count updated dynamically
- District tiles replace dropdown after correct state guess
- Clickable US reference map auto-submits on state click
- Correct/wrong flash animation on state guess
- Play Again added (no page reload)
- SVG icon system replaces emojis in header
- `MAX_GUESSES` raised from 5 to 6
- District preview rendered as SVG; PNG blob for image sharing via Web Share API
- Mobile inline timer injected into guess counter
- Donate to CMU button added to result modal and census panel
- Distribution bar counts rendered inside bars; minimum bar width enforced

---

## v1.0 — Beta Launch

- Two-phase guessing: select state first, then district number
- Clickable D3 AlbersUSA reference map with state chips
- Progressive clue reveal: one clue per wrong guess (size → delegation → income → race → partisanship → state)
- Six guesses per game (Wordle-style)
- Dark / light mode toggle with CMU color scheme
- Timer starts on first guess submission
- Leaderboard with Today / All-Time / Personal tabs (Firebase Firestore)
- Feedback form (cervas@cmu.edu & jafierman@gmail.com)
- Share result + Post to X buttons
- 2024 presidential margin clue (D+/R+)
- Donate to CMU link in header
- Color-blind-accessible guess counter (shapes + colors)
- Copyright: Jonathan Cervas & Jason Fierman

---

## Pre-Release Development Milestones

### Map Pipeline
- Integrated mapshaper simplification (10%) with intersection repair
- State boundary dissolve from district features
- Inner centroid points for label placement
- Roads (TIGER) and urban area (Census) layers simplified and clipped

### Data Pipeline
- ACS tract-level data aggregated to districts via Block Assignment Files (BAF)
- Tract → district crosswalk weighted by block counts (proxy for population)
- Connecticut handled separately (2021 ACS; Planning Region FIPS issue)
- Compactness metrics computed in R via `redistmetrics` and joined at build time

### UI Foundations
- CSS custom properties for theming (`--accent`, `--surface`, `--border`, `--text`, `--muted`, `--radius`, `--shadow`)
- D3 projection: `geoMercator().fitExtent()` with manual scale-back for zoom-with-context
- SVG draw order: state fills → boundary strokes → district highlight on top
- Two-column desktop layout → stacked mobile layout via flex and media queries
