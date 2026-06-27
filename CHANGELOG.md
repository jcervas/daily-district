# District Guess — Changelog

## v2.9.31 — Game-over: expose the result behind the Profile

- The District Profile sheet now auto-opens to ~66% instead of ~88%, leaving the result banner ("View Result") + headline/stats exposed above it — making it clear there are more pages behind the Profile. The exposed strip stays directly clickable (no backdrop blocking it).

## v2.9.30 — Card polish, Reock, mobile-friendly compactness

- **Footer graphics bottom-align** on every card, so the bars and their rank lines sit at a consistent height across the grid.
- **Population Change** moved up to the second card (right after Representative).
- Renamed cards: "Racial / Ethnic Composition" → **Demographics**, "Speak Another Language" → **Language**.
- **Compactness** explainer is now a tap/click `<details>` (works on mobile, where the old hover tooltip didn't), and adds **Reock** (area ÷ smallest enclosing circle, EPSG:2163) alongside Polsby–Popper, each with a one-line definition.

## v2.9.29 — Official party logos

- Replaced the hand-drawn party silhouettes with the **official party marks** (Democratic donkey, Republican disc) from Wikimedia Commons (public domain), in their own brand colors; a neutral star for Independents.

## v2.9.28 — Race plurality + legend, percentile words, person-level language

- **Racial composition** now headlines the **largest group** ("35% Hispanic plurality" / "…majority"), not always White, and adds a **color-keyed legend** so each bar segment is identifiable.
- **Percentile in words** under every range bar: "Higher than 97% of districts" / "Lower than N% of districts" — the rank info the value-position bar alone didn't convey.
- **Non-English language** is now its **own card**, **person-level** (% of residents 5+, table C16001), and clearly labeled — fixing the misleading "51% of the 38% foreign-born" nesting. (`build_lang.py` / `make lang push-lang`.)
- **Median Gross Rent** sub clarified: "2.48 people per household" (was the bare "2.48 per household").
- **Party emblem** enlarged to match the shape thumbnails; **all profile cards** now share a uniform minimum height.

## v2.9.27 — Bar fix, Population Change, party animals

- **Fixed the bar position**: the tick now sits at the value's spot within the min–max range (so 38.6% on a 1–56% axis sits ~2/3 across), instead of by percentile rank — which was confusingly near the end for skewed metrics.
- **Total Population → Population Change**: shows the rounded ± % since the 2020 Census ("+2%", with "764,983 → 778,356" underneath) and its own range bar.
- **Party emblem** is now a **donkey** (D) / **elephant** (R) / **star** (Independent), color-coded, replacing the letter badge.

## v2.9.26 — District Profile mini-graphics, round 2

- **Reordered** the cards by what players care about most: Representative, 2024 Vote, Racial composition, District Area, Delegation, Foreign-born — then the rest.
- **Population change since 2020** replaces the (meaningless) population-rank bar: 2020 Census counts aggregated to the 2026 districts (`build_pop2020.py`), shown as e.g. "−1.3% since 2020 · 751/sq mi".
- **Racial-composition stacked bar** now follows the text order (White, Black, Hispanic, Asian, Other).
- **Party emblem** (color-coded D/R/I badge) on the Representative card.
- **Percentile bars** now carry min/max **range labels** so you can read the full span, not just the tick.
- **Compactness shape**: the equal-area circle is now dashed and visible in dark mode, with a named, hover-explained **"Polsby–Popper"** caption; perimeter is stated separately as a plain fact (a long perimeter alone isn't compactness).
- Pipeline: `make pop2020 / push-pop2020`; `pop2020` + `pct` preserved across census rebuilds.

## v2.9.25 — District Profile mini-graphics

- Added four small inline-SVG visuals to the District Profile, each reinforcing a number without competing with it:
  - **Percentile tick bars** showing where the district ranks among all 435 for income, median age, home value, rent, density, education, commute, foreign-born, uninsured, and veterans (ranks precomputed in `census.pct`).
  - **100%-stacked bars** for racial/ethnic composition and the 2024 D/R vote.
  - **Compactness shape** — the district's outline drawn inside its equal-area circle (Polsby-Popper), on the District Area card.
  - **State locator** — the district highlighted within its state's outline, on the Delegation card.
- New reproducible `derived_update.sql` (+ `make push-derived`) recomputes perimeter and the percentile ranks from the DB after any census/map change.

## v2.9.24 — District Profile: perimeter + compactness

- District Area card now shows the perimeter and a Polsby-Popper compactness label (e.g. TX-07: "114 mi perimeter · very irregular"). `perimeter_mi` computed via PostGIS and added to the census preserve list.

## v2.9.23 — Restored games show current data; tab hover line

- A finished game restored from the browser now shows the **current** answer data (census, hint clues, current representative) instead of the snapshot saved at completion — so a same-day data change is reflected on reload. The client passes its local guess history to the `today` function (now v12), which verifies the win — the winning guess names the answer, so only a solver can produce it, no leak — and returns fresh data. Signed-in players already got this.
- `.result-tab-btn` now shows a hover underline (the "mouseover line"); the active tab keeps its red line.

## v2.9.22 — Current Representative link styling

- The representative name (a link) now inherits the District Profile card's value color/weight/size with an underline, instead of default link coloring.

## v2.9.21 — Welcome loader globe no longer stutters

- The spinning loader globe on the welcome splash froze/jumped during load: the heavy synchronous US reference-map build (D3/topojson) ran while the globe was animating, and a canvas can't repaint while the main thread is blocked.
- The reference map isn't visible until the splash is dismissed, so its build is now deferred out of the loader window — fresh play builds it right after the loader globe is swapped for the PLAY/SIGN IN buttons; restore paths build it on demand via `ensureUSRefMap()` (idempotent). The globe now spins smoothly through load.

---

## v2.9.20 — District Profile: current representative

- Added the **current U.S. House member** to each District Profile (name, party, and a link to their official site), sourced from https://www.house.gov/representatives via a new `tools/census/build_reps.py` scraper. Stored as `census.rep` for all 435 districts.
- `apply_census.py` now preserves `rep` so a demographic rebuild won't drop it.
- Validation note: the ACS aggregation was re-checked against an **unchanged** district (NV-01, since TX-07 was redrawn after the ACS vintage). NV-01 matches the Census Bureau's published CD-level values within ~1% (pop 765,392 vs 763,217; income $68,378 vs $67,470; home value, rent, age all <0.5%).

---

## v2.9.19 — District Profile: full ACS demographic rebuild

- Rebuilt every district's census from ACS 5-year (2019–2023) data aggregated to the **2026 boundaries** via a new reproducible pipeline (`tools/census/`), rolling Census **tract** estimates up to each district through the DRA block-assignment files (latest map year per state).
- District Profile now shows ~22 facts (was 8): median age, gross rent, poverty rate, homeownership, mean commute + transit/WFH share, foreign-born %, non-English-speaking households, under-18 / 65+ share, veterans, uninsured, avg household size, and population density — alongside the existing population, income, home value, degrees, and race composition.
- Medians (income, home value, rent, age) now use ACS bracket interpolation, which reproduces the published Census median; the prior stored income (e.g. TX-07 $125,841) corresponded to no standard ACS measure for the 2026 boundary and is replaced with the true median household income ($77,379).
- Bachelor's-degree share is now "% of adults 25+" (was % of total population).
- Connecticut handled specially: its block-assignment file predates the 2022 county→planning-region switch, so tracts are remapped to current GEOIDs by tract number.
- `area_sqmi` and the 2024-presidential fields are preserved (not ACS-derived).

---

## v2.9.18 — Spacing fixes (game-over ribbon + District Profile header)

- `#gameover-next` had asymmetric vertical margin (10px top, 4px bottom) — now symmetric.
- Added breathing room below the District Profile district code (the "Solved in" line beneath it is hidden, so it sat flush against the stats).

---

## v2.9.17 — How to Play: sign-in note

- Added a line to the How to Play modal: sign in to track your statistics and compare with other players.

---

## v2.9.16 — Drop "Solved in X guesses" from District Profile

- The District Profile (game-over census sheet) no longer shows the "Solved in X guesses" line; it keeps the district code header.

---

## v2.9.15 — Divider between result-modal tab groups

- Added a vertical divider (with symmetric padding) between the "Today's District" tabs (Result/Guesses) and the "Lifetime Statistics" tabs (Me/Everyone) so the two halves read as distinct.

---

## v2.9.14 — Reveal tween on a state-phase loss

- Losing in the state phase (6 wrong state guesses) skipped the reveal tween and showed a dead pause while the answer's shapes loaded, then jumped to the game-over screen. Now it plays the same expanding-fill reveal as the district phase — emanating from the answer state on the map — and loads the shapes in parallel under cover of the fill (no dead pause). Added a `ready` gate to `startGameOverTransition`.

---

## v2.9.13 — Archive badge no longer covers the map

- The "Archive · unofficial — not counted" badge was `position: fixed` at `top: 60px`, floating over the district map and wrapping oddly. It's now an in-flow centered single-line pill between the header and the game, so it never overlaps the district.

---

## v2.9.12 — Correct state pick is free (fixes premature game-over + missing tween)

- The server counted every pick toward MAX_GUESSES, but the client UI always treated a *correct state* pick as a free transition (not a guess). That mismatch meant a correct state on the "6th" pick ended the game early — and routed through the loss path that skips the reveal tween.
- Now the server (and archive replay) exclude correct-state picks from the count: guesses = wrong picks + district picks. A correct state always advances to the district phase with guesses remaining, so the normal win/loss flow (and its tween) runs. Verified: 5 wrong + correct state → 5 used, 1 left, not completed.

---

## v2.9.11 — Fix 7th guess after 6 wrong

- After the 6th wrong state guess, a 7th guess could slip in before the game locked: `finishServerLoss` awaits the answer's state-shape load before `endGame()` sets `gameOver`, and input had already been unlocked. Now `gameOver`/the guess lock are set synchronously at the start of `finishServerLoss`, closing that window (covers the district phase too).

---

## v2.9.10 — Tunable district-fit margin

- Extracted the repeated district zoom-fit margin (0.85, used in 6 places) into a single `DISTRICT_FIT_MARGIN` variable, exposed on `window` for live tweaking in the console (lower = more padding, higher = tighter). The two state-phase/fit-button `0.9` margins are left separate.

---

## v2.9.9 — Hard Mode actually hides hints

- Hard Mode was stored but never wired to anything (hints still showed). It now lives up to "No hints revealed — shape only": the clue/hint bar is replaced with a "Hard mode · no hints" note and the map stays shape-only (no terrain/urban/roads reveal) during play. Everything is revealed at game over. Toggling the setting applies immediately.

---

## v2.9.8 — District zoom: fit tiles on entry, Fit button → whole state

- Entering the "Pick a district" view now zooms to the bbox of the eligible district tiles (dist-icons) for a tighter initial frame, instead of the whole state outline.
- The Fit button now zooms out to the full guessed-state bbox (then back to the tiles on a second press). Falls back to the state fit if tiles aren't built yet.

---

## v2.9.7 — Grouped result-modal tabs + equal stat widths

- The result-modal tabs are now two centered, labeled groups: "Today's District" (Result · Guesses) and "Lifetime Statistics" (Me · Everyone), with a gap that grows on wide screens instead of pinning them to the edges.
- Fixed the stat cards + guess histograms being different widths across tabs: the Result and Me stat containers weren't `width:100%`, so they shrank to content inside the centered pane. All three tabs now render the stats at the full pane width (matching Everyone).

---

## v2.9.6 — Result-modal tab polish

- Renamed the stats tabs to "Me" (your stats) and "Everyone" (all players); reordered to Result · Guesses (left) and Me · Everyone (right-aligned).
- The Result tab's stat cards + guess histogram now use the exact same markup/style/width as the Me and Everyone tabs (were a different, smaller style).
- Fixed the "Back to map" button overlapping the district preview — the base `.modal-close` is `position: absolute`; the result-modal back button now sits in its own row above the preview.

---

## v2.9.5 — Flatten leaderboard into result-modal tabs

- Dropped the nested "Leaderboard" tab and its sub-tabs. "All Time" and "My Stats" are now top-level tabs in line with "Result" and "Guesses".
- Removed the "Today" leaderboard view (it duplicated the Result tab).
- Widened the result modal (480 → 680px on desktop) and tightened the tab row so all four tabs stay on one line; the stats now use much more horizontal space.

---

## v2.9.4 — Keep the globe loop continuous

- Reverted the globe loader's idle-stop from v2.9.3: the animation loop runs continuously again (it's a loader and should keep playing whenever it's on the page; it only "stops" by being dropped from the DOM, which the loop still handles).

---

## v2.9.3 — Mobile performance

- Removed `backdrop-filter: blur()` from the perpetually-pulsing "View Results" arrow on the game-over screen — an animated element with a backdrop-filter forces continuous recompositing (expensive on iOS) for no visible benefit. This overlaps the win confetti, so it should make that smoother.

---

## v2.9.2 — Fix result-modal Donate button on mobile

- The result modal's full-width "Donate to CMU" button was collapsing to a tiny empty icon-circle on mobile (it shares the `.donate-btn` class with the header pill). Excluded `.result-donate-btn` from the mobile circle-collapse so it stays a full-width outlined red pill.

---

## v2.9.1 — reopen pill: neutral glass + visible light stroke

- Dropped the red tint on the reopen pill (neutral white glass now).
- Light-mode stroke is now a visible dark `rgba(0,0,0,0.28)` (the previous white `0.3` was invisible on light backgrounds); dark mode keeps the solid black `rgba(0,0,0,1)` stroke.

---

## v2.8.9 — Glass reopen pill

- The "District Profile" reopen pill now uses the same frosted-glass treatment (red-tinted `rgba(196,18,48,0.2)` + `blur(5px)` + light border), filling solid red on hover.

---

## v2.8.8 — District Profile cards more solid than sheet

- The census stat cards are now less translucent (0.55) than the glass sheet (0.2) so they read as solid panels against the see-through background. Dark-theme cards bumped to match.

---

## v2.8.7 — District Profile glass + z-order

- Adopted the css.glass recipe for the District Profile sheet (`rgba(255,255,255,0.2)` + `blur(5px)` + subtle border/shadow); cards are glassy to match, with a dark-theme tint variant.
- The District Profile sheet now sits **below** the welcome splash (z-150 vs z-200), so on reload the splash appears in front of an open profile instead of over it.

---

## v2.8.6 — District Profile sheet: actually see-through

- The frosted sheet was 80% opaque with solid stat cards, so the map behind was hidden. Dropped the sheet to ~55% translucency and made the stat cards glassy (~45%), so the blurred game-over map shows through while text stays readable.

---

## v2.8.5 — Urban areas + roads on the district-pick map

- The district-pick reference map (`_drawGameplayTiles`) only drew county lines — it never rendered urban areas or roads. Added both, clipped to the active state at a fixed opacity (urban behind, roads, then county borders on top).
- Gated the zoom-fade of the urban/roads layers to game-over only, so the gameplay layers keep their fixed opacity instead of being zeroed out at low zoom.

---

## v2.8.4 — District Profile sheet: frosted glass + working close

- The blur is now on the District Profile sheet itself (frosted glass) rather than blurring the game-over content behind it — the backdrop is a plain dim.
- Fixed the close chevron doing nothing: the swipe-drag was attached to the whole titlebar, so `setPointerCapture` swallowed the close button's click. Drag now initiates only from the grip handle.

---

## v2.8.3 — District Profile sheet, urban/roads fix, click-capture fix

- **District Profile** is now an open-by-default bottom sheet over a blurred, dimmed backdrop. Dismiss by swiping the sheet down or tapping the down-chevron; reopen via the "District Profile" pill. (Was a collapsed `<details>` that wouldn't open.)
- **Fixed:** clicking the District Profile no longer triggers the "click anywhere on the game-over screen → open results" handler.
- **Fixed:** urban areas + roads weren't drawing on the reference/game-over map in server mode — the clip path was built only from district geometry (absent in server mode), so the layers referenced a missing clip and were clipped to nothing. Now the clip falls back to the merged states geometry.

---

## v2.8.2 — Matching Sign in / Donate header pills

- The header Sign in and Donate buttons are now identical size (92×34) outlined red pills with the same fill-on-hover style.
- On narrow screens (≤480px) both collapse to 34px icon circles (person / heart) to free up header space, matching the other header icon buttons.

---

## v2.8.1 — Donate button restyle

- The Donate button no longer uses the CMU red-arrow style (the arrow looked bad on the compact mobile pill). It's now an outlined red pill that fills on hover, matching `#play-again-btn` / the Sign in pill. Play and login Sign in keep the red-arrow treatment.

---

## v2.8.0 — Consolidated results, leaderboard & district profile

- **Leaderboard folded into the result modal** as a third tab (Today / All Time / My Stats sub-tabs). The standalone leaderboard modal and the header Leaderboard icon are removed; the leaderboard is now reachable from the result screen after playing.
- When the result modal is opened without a finished game, it lands on the Leaderboard tab and the Result/Guesses tabs show a "finish today's puzzle…" placeholder.
- **District Profile moved to the game-over screen** as a collapsible "District Profile ▸" section beneath the revealed district map (removed from the result modal's tabs). Census data renders into the game-over card once it's built.

---

## v2.7.3 — Link swipe-underline + secondary button fill

- Text links now use the `.link-underline-swipe` effect from jonathancervas.com: a currentColor underline that swipes in left→right on hover (instead of the underline-thicken).
- The secondary welcome button ("Review Result" / "Sign in") fills bottom-to-top on hover (clear `.Button` behaviour), complementing the primary button's left-to-right red fill.

---

## v2.7.2 — Faithful CMU button + link styles

- Primary CTAs (Play, Donate, login/profile submit) now use the CMU `.Button--alt` red button: a red arrow box on the left that expands to a full red fill on hover, with the label flipping to white.
- The header "Sign in" pill is the CMU clear `.Button`: outlined, with the fill sliding up from the bottom on hover.
- Text links (Forgot password?, How to Play, settings links) are carnegie-red with an underline that thickens 1px→2px on hover (CMU `a:not(.Button)`).
- Label color uses the theme token so it stays readable in both light and dark mode.

---

## v2.7.1 — Button fill-slide-up hover (jonathancervas.com)

- Replaced the button sheen with the `.menu-item Button` effect from jonathancervas.com: on hover the fill slides up from the bottom (`.4s ease`). The outlined "Sign in" pill fills solid red with white text; the solid red CTAs (Play, Donate, Sign in submit) deepen as the fill rises. The outlined "Review Result" secondary button keeps its border hover.

---

## v2.7.0 — Header layout + jonathancervas.com link/button effects

- Moved the sign-in / account avatar to the right side of the menu, next to Donate.
- The "Daily District" wordmark is now absolutely centered on the menu bar at all times (was drifting on mobile when the side groups had unequal widths). Reworked the header into a flex shell with an absolutely-centered title.
- Adopted the hyperlink + button hover effects from jonathancervas.com: text links are bold carnegie-red with a soft grey highlight that swipes in behind the text on hover; primary buttons get a light sheen that sweeps left→right on hover. Respects `prefers-reduced-motion`.

---

## v2.6.9 — Fixed 6-card hint bar

- The hint bar is now always exactly 6 cards, all hidden at the start. Each guess reveals the next card — a state clue while the state is unsolved, a district clue once it's solved. Fixes the bar swelling to 9+ cards mid-game and no longer resets to a single card after solving the state. (Server `today`/`guess` reveal logic + client archive mirror.)

---

## v2.6.8 — Hint cards no longer reset after solving the state

- Solving the correct state used to switch the clue deck and drop the hint bar back to a single card. Now the already-earned state clues stay and district clues are appended. (Superseded by v2.6.9's fixed 6-card bar.)

---

## v2.6.7 — Hold landscape imagery until after the 4th guess

- The map's satellite/terrain landscape imagery now reveals only after the 4th wrong guess (was the 3rd). Before that the map shows the district outline only.

---

## v2.6.6 — How to Play: 'Back to game' instead of 'Back to map'

- Renamed the How to Play modal's back button to "Back to game" (it can be opened before any map is shown).

---

## v2.6.5 — Fix header hidden on mobile (proper flex shell)

- The body used `min-height: 100vh`, which on mobile is *taller* than the visible viewport (`100dvh`) because it ignores the browser toolbars — so game content (especially the map) overflowed and pushed past the header.
- Reworked into a clean two-row flex shell: `body` is a fixed `100dvh` flex column, the header is a fixed, non-shrinking top row, and `main` fills exactly the remaining height. All game content now sits below the header at every screen size. Removed the hardcoded `calc(100dvh - 44px)` header-height guess in the landscape grid.

---

## v2.6.4 — Reset welcome splash on sign-out

- **Sign-out now reloads** so the welcome splash rebuilds against the anonymous state. Previously the signed-out splash wrongly kept the previous account's "Back to Map" / "Review Result" buttons.

---

## v2.6.3 — No splash confetti on revisit; signup email confirmation

- **No confetti on the welcome splash.** Returning to a finished, won game rebuilt the game-over map and fired the full-screen confetti over the splash (slow + distracting). Confetti now only fires on a fresh win, not on revisit.
- **Email confirmation on signup.** Signup now sends the confirmation link back to the app and shows a "check your email" state; the user isn't signed in until they confirm. (Requires "Confirm email" enabled in Supabase Auth.)

---

## v2.6.2 — Delete account

- **Delete account** from Edit profile (two-step confirm). Removes the auth identity, profile, email, and telemetry/device fingerprint server-side via a new `delete-account` edge function (service role, own-account only).
- Game history is **retained anonymously**: the `results → auth.users` FK was dropped so a player's rows survive deletion with no link back to any identity, and still count toward the global leaderboard aggregates.
- On delete, local `districtguess_*` / `dd_*` storage is cleared and the app reloads signed-out.

---

## v2.6.1 — Menu bar reachable over modals

- **Header always on top** — the menu bar (How to play, Leaderboard, Settings, account/Sign in, Donate) now sits above all modals and stays tappable, fixing mobile where the full-screen game-over / result modal covered it with no way to reach the leaderboard, settings, sign-out, or feedback.
- Modals now reserve the header strip (`--header-h`) so their content and close button never hide behind the menu bar.

---

## v2.6.0 — State-pick polish, account recovery & leaderboard test data

Rollup release of the 2.5.x line:

- **Layered state map** — a static grey basemap with a live overlay; eliminated states fade to transparent (revealing grey) and stop receiving clicks; a pending guess does a true relative dim; map interaction freezes while a guess is in flight.
- **Correct-state flow** — the state fills gold with the guess-history check icon (fitted inside the state) and holds briefly, then stays gold straight into a smooth build-then-zoom to the state bbox (no red flash, no jiggle).
- **Gameplay map slimmed** — district polygons are no longer drawn during play (only at game over); the white backdrop is the state outline and all zoom bboxes come from the tile (dist-icon) positions.
- **Callouts** dim on a pending guess and go solid grey when eliminated, matching the states.
- **Account recovery** — "Forgot password?" on sign-in emails a reset link and opens a "Set a new password" modal on return.
- **Leaderboard** now exposes per-player solve time; seeded ~40 fake users / ~1,150 results into Supabase so the Today / All-Time aggregates and distribution can be tested.

---

## v2.5.10 — Drop "Forgot username?"

- Removed the "Forgot username?" link — sign-in is by email, so there's no username credential to recover. The "Forgot password?" link (centred) remains.

---

## v2.5.9 — Forgot password on sign-in

- Added **"Forgot password?"** to the login form — emails a Supabase reset link; following it opens a recovery session and a new "Set a new password" modal (`resetPassword` / `updatePassword` in backend.js, `PASSWORD_RECOVERY` handled in login.js).

---

## v2.5.8 — Callouts dim + grey with the states

- The offshore callouts now **dim during a pending guess** (relative group-opacity reduction, same factor as the states, CSS-animated) instead of staying bright.
- **Eliminated callouts now go solid grey** (`#b8bcc4`, opacity 1) to match the eliminated states' basemap grey — dropped the old 0.55 opacity de-emphasis since the grey fill already signals "out of play."

---

## v2.5.7 — No red flash after the gold confirmation

- The correct state stayed gold for the confirmation beat but then flashed the confirmed red (from `updateUSRefMap` in `renderClues`/`lockStateDropdown`) before the zoom. It now stays **gold** through the transition and fades out gold as the white district render zooms in — straight from gold → bbox zoom, no red.

---

## v2.5.6 — Correct-state check uses the guess-history icon, fitted to the state

- The correct-state confirmation now stamps the same `checkCircle` icon used in the guess history (`guess-icon-svg`) instead of a hand-drawn tick, sized to fit inside the state's bbox (~55% of its smaller dimension, leaving padding) and centred on its centroid.

---

## v2.5.5 — Gold + checkmark confirmation on a correct state

- A correct state guess now fills the state **gold** (`#FDB515`) and stamps a **checkmark** on it, held ~650ms as a clear "correct!" beat, before entering the district phase and zooming to the bbox. The other states fade to the grey basemap during the hold.
- The deliberate hold also separates the confirmation from the zoom, so the entry reads as one clean motion instead of the previous slight zoom-out-then-in jiggle (which came from fitting the state's bbox immediately after a tighter mid-game view).

---

## v2.5.4 — Don't draw district shapes during play

- **The gameplay `state-fill` is now the single state outline, not the district polygons.** Previously it appended one path per district (`stateFeatures`), so the district boundary geometry sat in the DOM during play (readable/inspectable). The white state backdrop now comes from the state silhouette only; the district shapes are revealed at game over (unchanged).
- **Zoom bboxes are computed from tile (dist-icon) positions, not district geometry.** New `_districtTileBBox(keys)` helper drives the active-set re-zoom and the fit-toggle button; the entry/state fit uses the state outline. Removed the now-redundant invisible `phantom-anchors` layer.

---

## v2.5.3 — Simpler, smoother correct-state transition

- **Removed the green-flash / `keepGreen` complexity** on a correct state guess. The flow is now: fade every other state out to the grey basemap, then enter the district phase — which fills the correct state white (counties/roads/urban), smoothly zooms to its bbox, and shows the district tiles. The zoom is the confirmation.
- **Smooth zoom (no jank).** The heavy district render (counties + tiles) is now built *before* the zoom animates instead of mid-animation, and the zoom is kicked on the next frame — so the transform tweens cleanly instead of jumping.

---

## v2.5.2 — Pending dim is a relative opacity reduction

- The pending-guess dim now multiplies each other state's *current* opacity by a constant factor (0.52) instead of setting a flat value. Active states dim to 52% of full; already-eliminated states (opacity 0) stay dropped automatically (0 × factor = 0) — no valid-set check needed.

---

## v2.5.1 — Pending dim only touches active states

- Fix: the pending-guess dim set `fill-opacity: 0.22` on *every* other state, so already-eliminated states (transparent salmon) ghosted back in as faint red. The dim now applies only to still-active states (`getValidStates()`); eliminated states stay dropped at opacity 0.

---

## v2.5.0 — Layered state map (grey basemap + live overlay)

The state picker is now drawn as two layers: a **static grey basemap** (`layer-basemap`, every state in the inactive `#b8bcc4`/`#48484a`) and the **live state overlay** on top.

- **Elimination is now "drop from the live layer."** Out-of-play states fade their fill to transparent (revealing the grey basemap) and set `pointer-events: none` — instead of being recoloured grey. `_applyStateStyle` rewritten around this; `_stateColors` is retained for the offshore callouts.
- **True dimming on a pending guess.** While a guess is in flight, the other live states fade to a low opacity (grey shows through) rather than an instant colour swap — animated via a CSS `fill-opacity` transition. Elimination uses the same transition for a smooth fade-out.
- **Interaction frozen during the request.** The live layer's `pointer-events` are disabled while the server verdict is pending, so hovering can no longer re-highlight a state mid-request.

---

## v2.4.8 — Fix: states flashed back to active after a correct pick

- After a correct state guess the other states briefly flashed back to their "valid" salmon before going grey. Cause: `renderClues()` repaints the ref map (`updateUSRefMap`) and it ran *before* `correctStateGuessed` was set, so it used the stale valid-colour scheme. The correct branch now marks the state solved up-front so the repaint paints the solved scheme (others → inactive grey), and re-asserts the green cue on the tapped state through the zoom.

---

## v2.4.7 — State-pick dim reuses the inactive-district grey

- **The "other states" dim is now the inactive/eliminated grey** (`#b8bcc4` light / `#48484a` dark) instead of a 0.3-opacity fade — the same colour out-of-play districts use, so the state picker and district picker share one visual language. Restores via `_applyStateStyle` on a wrong guess / network failure; persists into the zoom on a correct one.
- **No thicker stroke on the tapped state.** Both the correct (green) and wrong (red) states now only change fill; the stroke is left at its normal value (border mesh), instead of getting a heavy white outline.

---

## v2.4.6 — Cleaner correct-state visual

- **Dropped the heavy white outline** on a correct state pick — the dimmed neighbours already isolate it, so the tapped state just tints green.
- **Dim now persists into the district transition.** The dim was being cleared right before the reward zoom (states briefly snapped back to full opacity); it's no longer cleared, so it carries through as `enterServerDistrictPhase` fades the whole state layer out.

---

## v2.4.5 — Snappier, cleaner correct-state feedback

- **No more shake-then-green.** The neutral shake was applied on *every* state tap before the server replied, so a correct guess shook first and only then turned green. The shake now fires only on a confirmed wrong guess; a correct guess goes straight to the green flash.
- **Shorter pause on a correct state.** The hold before the reward zoom dropped from 380ms → 140ms, so the green registers without stalling the transition into the district phase.

---

## v2.4.4 — Sign-in after an anonymous game now sticks

- **Fixed: the result modal kept showing "Sign in / Sign up" after signing in.** `isAnonymousPlayer` was set at game start and never cleared when a player signed in *after* finishing (the re-init listener only fires when no guesses have been made yet). The `district-auth` handler now clears `isAnonymousPlayer` and refreshes the game-over surfaces (drops the result-modal + ribbon sign-in nudges, shows the personal-stats block).
- **The finished anonymous game is now recorded to the account on sign-in.** `bindAnonymousGameToAccount()` replays the completed game's guess history through `/guess` (the signed-in path persists it guess-by-guess), so the game actually counts instead of leaving the new account with empty stats. Runs once; a partial replay isn't retried to avoid double-appending.

---

## v2.4.3 — Positive feedback on a correct state guess

- **Correct state now reads as a hit.** Previously only a *wrong* state shook + flashed red, while a correct pick went straight into the reward zoom with no positive signal. A correct guess now flashes the tapped state green (white outline, other states dimmed) and fires the green `flashCorrect` pulse-ring on the map, held ~380ms before the zoom into the state — the clear counterpart to the red+shake miss.

---

## v2.4.2 — Per-player solve time in stats

- **`get_leaderboard` now returns the signed-in player's solve time.** The `results.seconds` column was already recorded per game and aggregated for the today/all-time leaderboards, but the per-user `user` object didn't expose it. Added `avgSeconds` + `totalWonSeconds` to the `user` section of the RPC.
- **Result tab keeps the correct avg time after sign-in.** `hydratePersonalStatsFromServer()` now repopulates `totalWonTime` from `totalWonSeconds`, so the Result tab's "Avg. time" survives the account hydrate instead of resetting to "—".
- **"My Stats" tab now shows Avg. time** alongside avg guesses.

---

## v2.4.1 — Reconcile device stats with the account on sign-in

- **Result tab now matches the Leaderboard for signed-in players.** The Result tab reads device-local stats (`districtguess_stats`), which accumulate for anonymous play and survive DB resets / fresh sign-ins — so they could disagree with the account-scoped Leaderboard (e.g. "Played 2" locally vs 1 game on the server). On sign-in (and on load when already signed in), `hydratePersonalStatsFromServer()` overwrites the local stats with the account's authoritative server aggregates (`played`, `won`, current/max streak, guess distribution). Avg-time is dropped on hydrate since the server doesn't track per-game time.

---

## v2.4.0 — Unified state + district map (one SVG)

### One map for the whole game
- **Single shared map (`#us-ref-map`)** now drives both gameplay phases instead of two separate D3 SVGs + a cross-fade. State pick zooms into the guessed state, the 50-state fills fade out, and the district tiles + county/road/state-border context render into a `district-render` group **inside the shared map group** — no second SVG, no cross-fade, so the state→district handoff is a single continuous zoom.
- **`usRefZoom` drives the district view**: one zoom behavior for both phases, counter-scaling the district tiles to a constant screen size via `_applyTileZoomScaling`; `districtZoomBehavior` is aliased to `usRefZoom`.
- **`setMapDistrictView(on)`** toggles the view — fades/disables the state fills + offshore callouts and reveals the district render (reversible for a fresh state phase).
- **Game-over stays its own screen** (the game-over modal), so the in-play map only handles state→district gameplay; `buildDistrictD3Map` is a no-op at game-over.

### Plumbing
- `_buildDistrictCtx` renders into the shared map and no longer depends on the `#district-tiles` element or a `tilesEl` size probe; uses the ref map's exact `usRefProjection` + `_usRefW/_usRefH`. County clip `defs` live in the render group so they clear on each rebuild.
- `zoomUSRefMapToValid` (district branch) records the state-fit transform (so tiles size correctly and the fit-toggle has a reference).
- Tile interactions (optimistic ping/dim, win morph), the ping/dim CSS, and the `+/−/fit` zoom buttons all retargeted from `#district-tiles` to the shared map.
- Removed the now-redundant district pre-build + cross-fade timing in `enterServerDistrictPhase`/`showDistrictD3Map`.

### Verified
- State→district transition, geographic tile placement, win→game-over, and wrong-guess hot/cold elimination.

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
