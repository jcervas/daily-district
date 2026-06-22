# Stage B — client swap (server-authoritative gameplay)

Goal: the browser never knows today's answer until the game ends. Everything
needed to hide it is already on the server (verified):
- `today` returns `{ puzzleNumber, geometry (unlabeled), clues (gated), result, answer|null }`
- `guess` validates server-side, returns hot/cold/correct + unlocked clues, reveals answer on win/6th miss
- `district_geometries` (435) + `puzzles` (92, No.1 = today) are loaded

This must ship as ONE change — until step 5 lands, the answer is recoverable by
matching the served shape against the public topojson, so partial = no benefit.

## Steps

1. **Bootstrap from `/today`.** When signed in, `init()` calls
   `DistrictBackend.today()` instead of `seededIndex(dateSeed(), …)`. Build
   `todayDistrict = { type:'Feature', geometry: resp.geometry, properties:{} }`.
   Store `serverPuzzle = resp` (puzzleNumber, clues, cluesTotal, result, answer).
   Do NOT pick a district locally.

2. **Render the shape from server geometry.** `renderDistrict` / the mystery
   outline render from `todayDistrict.geometry`. The state-phase map still shows
   all states for guessing (state shapes ship; not a spoiler).

3. **Clues from the server.** Replace the FACT_DEFS computation in
   `renderHintBar` / `renderHintsModal` with `serverPuzzle.clues` (already the
   unlocked, ordered `{icon,label,value}` set). Drop client `cluesRevealed`.

4. **Guesses via `/guess`.**
   - State guess → `guess('state', abbr)`. Use `{correct, adjacent}` to drive the
     existing elimination UX (it works from the guess + adjacent flag without
     knowing the answer — the hot/cold keeps/removes neighbors; the `correctState`
     guards can be dropped). On `correct`, the response must reveal the **state**
     so the district phase can render that state's districts.
   - District guess → `guess('district', 'XX-NN')`. Use `{correct, adjacent}`.
   - On `completed`, use `answer` for the game-over reveal. Persist nothing to
     localStorage; restore from `serverPuzzle.result` instead.
   - **`/guess` change needed:** include `state` in the response when a state
     guess is correct (so the client can enter the district phase).

5. **Privatize the geometry (closes the fingerprint hole).**
   - Stop shipping `districts-core.topojson` (and overlay/counties contain
     district geom too — audit). Ship instead: a states-only topojson + a
     `district-names.json` (state → district numbers) for the dropdowns/tiles.
   - The mystery shape comes from `/today`; the answer district's rich context map
     at game-over can be served by `today`/`guess` (it already returns geometry;
     extend with neighbors' geometry if the gameover map needs them, or simplify).
   - District phase: pick a district **number** within the guessed state (names,
     not shapes) — or fetch the state's district shapes from a new endpoint after
     the state is correct.

## Restore / once-per-day
- On load, `serverPuzzle.result` gives `{won, completed, guesses, seconds,
  guess_history}` → rebuild the board from it. Remove the `districtguess_today`
  localStorage path (keep only settings/theme locally).

## Archive (unofficial) under Stage B
- Archive games are local-only replays and must NOT hit `/guess` (they'd be
  rejected once-per-day and would record). Keep archive fully client-side using
  the shipped state shapes + names + a local seeded pick — it doesn't need to
  hide anything (past answers are public). `isArchiveGame` already gates writes;
  ensure it also bypasses the server path.

## Test plan
- Signed-in fresh: `/today` → shape renders, No.1, 1 clue, answer hidden.
- Wrong state (cold/hot) unlocks clues; correct state reveals state + enters
  district phase; correct district wins + reveals answer.
- Reload mid-game restores from `result`. Second play same day → 409.
- Confirm `districts-core.topojson` is no longer fetched by the client.
