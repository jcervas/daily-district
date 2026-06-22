# TODO 🚧

## Updates

Gameflow: Welcome Splash -> Game Screen (district map, hints, reference map) -> game over screen -> results modal -> welcome splash *(phase state machine + pre-build implemented in v1.8)*
Actual game: Select state (hints about state) -> Select a district (hints about district) -> Either win or lose

- [ ] Drop out district tiles that are no longer active (currently grayed out — should be removed). Zoom to convex hull of remaining active district tiles (same behavior as state-level zoom to remaining states).

## Major upgrades

- [ ] Need to add database. Data base will hold user gameplay data, which will store user data that will be retrieved instead of locally. This allows for the play once per day. 
- [ ] Users will need to log in to play. I'd like to accept Google, Apple, and other SSO instead of having them register directly (though we can still have that if its workable/desirable.) Once we have this, the game will need to be reworked to pull data from the database related to individual players. I'll also want to add statistics to compare users to the universe of users. 


## UI

- [ ] When a user plays in hard mode, we should differentiate when they share. Eventually we will have a database with all this information and will need to record it there, too.
- [ ] clicking the timer should pop open a modal that has a recent history of the puzzle speeds. It can look alot like the "guesses" tab on the results modal. Colors and symbols can be used to differentiate those correct from those incorrect puzzles. clicking on it can open the "game over" screen with that map shown.

## Features

- [ ] **Hint ordering / categorization**: Split hints into state-level (revealed before State is shown) and district-level (revealed after). Consider adding new district-specific hints (e.g. district number, neighboring districts, partisan lean relative to state average). Hint reveal order options: (1) random, (2) least-to-most revealing, (3) most-to-least revealing.
- [ ] add Polsby-Popper (show district inside circle, white with black stroke)
- [ ] add → Reock (draw circle with district comparison)
- [ ] add other redistricting data like county splits
