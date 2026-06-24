# TODO 🚧

## Updates

- [ ] Verify the v2.4.0 unified state→district map on a real browser (daily-district.com) — the headless preview can't tick rAF, so the zoom transition / force-sim spread / rAF-deferred rebuild weren't observable there. Tune transition timing if the state→district zoom feels off.
- [ ] Position `go-badge-layer` wholly within `gameover-map` near the district boundary (currently can sit outside the visible map).
- [ ] Cleanup after the unified-map merge: remove the now-unused `#district-tiles` element from `buildGameSection`, and the dead `_drawGameOverMap` path (game-over renders only in the game-over modal now).

## Major upgrades



## UI

- [ ] When a user plays in hard mode, we should differentiate when they share. Eventually we will have a database with all this information and will need to record it there, too.
- [ ] clicking the timer should pop open a modal that has a recent history of the puzzle speeds. It can look alot like the "guesses" tab on the results modal. Colors and symbols can be used to differentiate those correct from those incorrect puzzles. clicking on it can open the "game over" screen with that map shown.

## Features

District Information
- [ ] add Polsby-Popper (show district inside circle, white with black stroke)
- [ ] add → Reock (draw circle with district comparison)
- [ ] add other redistricting data like county splits
- [ ] add information about current member (https://www.house.gov/representatives)