# Map & puzzle data pipeline

How the game's district shapes, demographics, and daily schedule are built —
and specifically, **what to do when new district shapefiles arrive**
(redistricting, a new map year, a mid-decade court-ordered redraw, etc.).

This is an ops runbook for an admin with shell access, not a code walkthrough.
Commands throughout are R / mapshaper CLI / `psql`, per project preference,
with one bash wrapper (`build-map.sh`) tying the mapshaper steps together.

## Prerequisites

- **mapshaper** ≥ 0.6 (`npm i -g mapshaper`)
- **R** with the `sf`, `redistmetrics`, and `lwgeom` packages
  (`install.packages(c("sf","redistmetrics","lwgeom"))` — not automated anywhere
  in this repo; do this once per machine)
- **python3**, standard library only — no `pip install` needed for anything here
- **node** ≥ 18 (for the `.mjs` scripts)
- **psql** and a Supabase `DATABASE_URL` (Project Settings → Database →
  Connection string → **Session pooler**) — keep it out of source control,
  `export` it in your shell instead
- A sibling **`createMaps`** repo checked out next to this one
  (`.../GitHub/createMaps`), and inside it a **DRA block-assignment** folder
  (`dra-block-assignments/2022-2026/congress`, one `<ST> <year> Congressional.csv`
  per state, from [Dave's Redistricting App](https://davesredistricting.org/))

## The big picture

```
                    ┌─────────────────────────────────────────────┐
                    │   createMaps repo (SIBLING, not this repo)   │
                    │   raw shapefiles/BAFs → national-cd-YYYY     │
                    │   .geojson + acs_by_district.csv + acs_by_   │
                    │   state.csv + us-urban.json + us_can_roads   │
                    └───────────────────────┬───────────────────────┘
                                            │
                                            ▼
                    1. build-map.sh   (this repo, mapshaper + R + python3)
                       → districts-core.topojson, districts-overlay.topojson,
                         state-svgs/*.svg, state-acs.json
                                            │
                    2. tools/census/  (make census reps clues pop2020 ...)
                       → *_update.sql, pushed to `puzzles.census` / `.clues`
                                            │
                    3. scripts/build-server-assets.mjs
                       → states.topojson, district-names.json,
                         /tmp/dd_adj_update.sql (→ district_geometries.adj)
                                            │
                    4. scripts/seed-puzzles.mjs  →  puzzles.sql  →  psql
                       (schedules districts onto calendar dates,
                        writes puzzles.clues + puzzles.census fresh)
                                            │
                                            ▼
                          Supabase: puzzles, district_geometries
                          served by the today / guess / state-shapes
                          Edge Functions — no redeploy needed
```

Steps 1–3 are **this repo's map-geometry pipeline**. Step 4 is **scheduling**
(which district shows up on which date). They're independent: you can rerun
step 4 any time to extend the calendar without touching geometry, and you
must rerun steps 1–3 (map changed) before step 4 will reflect a new map.

---

## Step 0 (out of scope, sibling repo): raw shapefile → `national-cd-YYYY.geojson`

This repo does **not** ingest raw TIGER/Line or DRA shapefiles directly — that
happens in the sibling `createMaps` repo, via `createMaps/national/build_national.sh`
(not covered here; treat it as a black box that must already have run). `build-map.sh`
below refuses to run and tells you so if its output is missing:

```
ERROR: .../createMaps/national/output/national-cd-2026.geojson not found.
  Run createMaps/national/build_national.sh first.
```

What `build-map.sh` expects to find, all inside `createMaps/`:

| File | Contents |
|---|---|
| `national/output/national-cd-2026.geojson` | all 435 district polygons, one feature per district, with a `state-district` property (e.g. `"NV-02"`) and a `state` property |
| `acs_by_district.csv` | per-district ACS: `state-district, pop, income, medianHome, whiteNH, black, asian, hispanic, bach, master` |
| `acs_by_state.csv` | per-state ACS, produced by `createMaps/acs_by_state.R` |
| `us-urban.json` | Census TIGER 2020 urbanized areas (decorative overlay) |
| `us_can_roads.json` | simplified US/Canada road network (decorative overlay) |

**When redistricting happens, this is where the new boundaries actually land
first** — get the new shapefile turned into `national-cd-<year>.geojson` with
a `state-district` property per polygon, in `createMaps`, before anything
below will do anything useful.

---

## Step 1: `build-map.sh` — geometry, compactness, state SVGs

```bash
bash build-map.sh
# or, to change the simplification tolerance (default 20%):
SIMPLIFY=0.5% bash build-map.sh
```

Reads the `createMaps` files above (override the sibling-repo path with
`CREATEMAPS=/path/to/createMaps bash build-map.sh`). Produces, all at this
repo's root:

| Output | From |
|---|---|
| `districts-core.topojson` | `districts` + `states` (dissolved) + `points` (one inner point per district) layers — **the file everything downstream reads** |
| `districts-overlay.topojson` | `urban` + `roads` decorative layers, lazy-loaded client-side |
| `districts.topojson` | legacy core+overlay combined file — nothing in this repo's own scripts reads it back; kept for backwards compatibility only |
| `state-svgs/<state>.svg` (50 files) | one boundary outline per state, each reprojected into its own state-plane/Albers EPSG code for an undistorted shape |
| `state-acs.json` | compact per-state ACS json, built from `acs_by_state.csv` (skipped with a warning if that CSV isn't present) |

Exact mapshaper invocations (also documented as comments in the script):

```bash
mapshaper "$DISTRICTS_SRC" name=districts -simplify "$SIMPLIFY" keep-shapes -o "$DISTRICTS_SIMPLE"
mapshaper "$DISTRICTS_SIMPLE" name=districts -dissolve state name=states -o "$STATES"
mapshaper "$DISTRICTS_SIMPLE" name=districts -points inner -filter-fields state-district -o "$POINTS"
mapshaper "$URBAN_SRC" name=urban -simplify 1% keep-shapes -filter-fields 'NAME20,GEOID20' -o "$URBAN_SIMPLE"
mapshaper "$ROADS_FC" name=roads -simplify 0.5% -o "$ROADS_SIMPLE"
mapshaper -i "$DISTRICTS_SIMPLE" "$STATES" "$POINTS" combine-files -rename-layers districts,states,points -o "$CORE_OUT" format=topojson
mapshaper -i "$URBAN_SIMPLE" "$ROADS_SIMPLE" combine-files -rename-layers urban,roads -o "$OVERLAY_OUT" format=topojson
mapshaper -i "$CORE_OUT" "$OVERLAY_OUT" combine-files -o "$OUT" format=topojson

# per state, reprojected into its own EPSG (see build-map.sh's state_epsg() table):
mapshaper "$STATES" name=state -filter "state === '$state'" -proj crs=epsg:$epsg \
  -style fill=none stroke=currentColor stroke-width=1 -o "$svg_file" format=svg
```

Between the first mapshaper call and the "dissolve" step, an inline `Rscript`
(embedded as a heredoc inside `build-map.sh` — no separate `.R` file) computes
per-district `area_sqmi`, `polsby_popper`, `reock` (via the `redistmetrics`
package, projected to EPSG:5070 / NAD83 Conus Albers), and `adj` (a
pipe-separated list of touching `state-district` ids via `sf::st_touches`),
and joins in `acs_by_district.csv`. **These area/compactness/adjacency values
get superseded later by `tools/census/compactness.R` in Step 2** — `build-map.sh`'s
copy is what first goes into `districts-core.topojson`, and Step 2 recomputes
the same numbers off that same file and pushes them into `puzzles.census`.

## Step 2: `tools/census/` — demographics, current rep, hint clues

This is the most fully-documented part of the pipeline —
**read `tools/census/README.md` in full**; this section only summarizes it,
and the README should win if the two ever disagree.

```bash
cd tools/census
export DATABASE_URL='postgresql://...'   # once per shell

# A map (district boundary) changed — this is the redistricting case:
make census push-census
make compactness push-compactness   # must run before push-derived
make push-derived
make clues push-clues               # re-tune hint cards after any census change

# Or, to rebuild + push absolutely everything at once:
make all
```

| `make` target | Script | Input | Output |
|---|---|---|---|
| `census` | `build_census.py` → `apply_census.py` | `DD_BAF_DIR` block-assignment CSVs + Census ACS5 API | `census_out.json`, `census_update.sql` |
| `reps` | `build_reps.py` | scrapes `https://www.house.gov/representatives` | `reps_out.json`, `reps_update.sql` |
| `clues` | `build_clues.py` | `census_out.json` + `state-acs.json` (repo root) | `clues_update.sql` |
| `pop2020` | `build_pop2020.py` | 2020 Decennial PL 94-171 API | `pop2020_update.sql` |
| `lang` | `build_lang.py` | ACS `C16001` | `lang_update.sql` |
| `plan-year` | `build_plan_year.py` | filenames in `DD_BAF_DIR` (no API call) | `plan_year_update.sql` |
| `compactness` | `compactness.R` → `apply_compactness.py` | `districts-core.topojson` | `compactness_out.csv`, `compactness_update.sql` |

All of them write plain `.sql` text (no ORM); every `push-*` target applies it
with `psql "$DATABASE_URL" -1 -v ON_ERROR_STOP=1 -f <file>.sql`. The generated
`.sql`/`.json`/`.csv` files are committed to git, so `git diff` shows exactly
what a rebuild is about to change before you push it.

**How a new map year gets picked up automatically:** `build_census.py` (and
`build_plan_year.py`) look at every `<ST> <year> Congressional.csv` in
`DD_BAF_DIR` and use **the latest year on disk per state**. So the redistricting
runbook for this step is just: *drop the new year's block-assignment CSVs into
`DD_BAF_DIR`, then `make census push-census`* — no code changes.

`compactness.R`'s invocation (from the Makefile, not run standalone):

```bash
Rscript compactness.R "../../districts-core.topojson" compactness_out.csv
```

### Two things to double-check, not automated

- **`make push-lang` is not part of `make push`, `make build`, or `make all`.**
  If you want the non-English-language field refreshed, run
  `make lang push-lang` yourself.
- **`derived_update.sql` (percentile ranks) is hand-written SQL, not generated
  by any script.** If the *set* of census fields changes, this file needs a
  manual edit — `push-derived` just replays whatever's currently in it.

## Step 3: `scripts/build-server-assets.mjs` — client-safe geometry + adjacency

```bash
node scripts/build-server-assets.mjs
```

Reads `districts-core.topojson`, writes:

- **`states.topojson`** — states layer only, arcs rebuilt via mapshaper so no
  district boundary data leaks to the client (the whole point of "Stage B"
  server-authoritative mode: the browser never receives the mystery
  district's own shape).
  ```bash
  mapshaper -i districts-core.topojson -target states \
    -each 'innerX=Math.round(this.innerX*1e5)/1e5, innerY=Math.round(this.innerY*1e5)/1e5' \
    -o states.topojson format=topojson
  ```
- **`district-names.json`** — `{ "NV": ["01","02",...], ... }`, DC excluded.
- **`/tmp/dd_adj_update.sql`** — run this against Supabase whenever district
  shapes change; it seeds `district_geometries.adj` (adjacency, used for the
  hot/cold guess feedback) keyed by the same `district_id` string
  (`"NV-02"`-style) that `puzzles.district_id` uses.

## Step 4: `scripts/seed-puzzles.mjs` — put districts on the calendar

```bash
node scripts/seed-puzzles.mjs [startDate] [days] > puzzles.sql
psql "$DATABASE_URL" -1 -v ON_ERROR_STOP=1 -f puzzles.sql
```

- Defaults: `startDate` = today (UTC, shifted back one day for timezone
  spread), `days` = 63.
- For a full fresh non-repeating cycle of all 435 districts:
  `node scripts/seed-puzzles.mjs 2026-06-22 436`
- `--json` emits a JSON array instead of SQL (for POSTing to a load-puzzles
  function, if you have one, instead of `psql`).

**Scheduling math** (in `scripts/puzzle-schedule.mjs`, imported by this script):

1. `baseIds(topo)` pulls every `state-district` out of
   `districts-core.topojson`'s `districts` layer, drops any `DC-*` id, and
   sorts — this is the canonical 435-item list.
2. `cycleSeed(cycle) = (0x05D15784 + cycle * 0x9E3779B1) >>> 0` seeds a
   `mulberry32` PRNG that Fisher–Yates-shuffles that list — each 435-day
   "cycle" is a distinct permutation; every district appears exactly once
   per cycle.
3. `EPOCH_UTC = Date.UTC(2026, 5, 22)` — June 22 2026 is puzzle No. 1.
   `puzzleNumber = floor((date − EPOCH_UTC) / 1 day) + 1`.
4. `districtIdForPuzzle(n, ids)`: `cycle = floor((n-1)/435)`,
   `pos = (n-1) mod 435`, district = `orderForCycle(cycle, ids)[pos]`.

**`BASE_SEED` (`0x05D15784`) must never change** — it's what makes cycle 0
reproduce the live schedule byte-for-byte. Changing it reshuffles every date
that's ever been seeded.

For each date, `scripts/seed-puzzles.mjs` looks up that date's district in
`districts-core.topojson`'s properties and writes a fresh
`puzzles.clues`/`puzzles.census` from scratch (its own `buildStateClues` /
`buildDistrictClues` / `buildCensus` functions — **not** `tools/census/build_clues.py`;
see the gotcha below), then upserts:

```sql
insert into public.puzzles (date, puzzle_number, district_id, state, neighbors, state_neighbors, clues, census) values
(...), (...), ...
on conflict (date) do update set
  puzzle_number = excluded.puzzle_number, district_id = excluded.district_id, state = excluded.state,
  neighbors = excluded.neighbors, state_neighbors = excluded.state_neighbors, clues = excluded.clues,
  census = excluded.census;
```

`scripts/build-puzzle-order.mjs` (`node scripts/build-puzzle-order.mjs [cycle]` →
`puzzle-order.json`) is **documentation only** — a human-readable dump of what
one cycle's shuffle looks like. `scripts/seed-puzzles.mjs` does not read
`puzzle-order.json`; it always recomputes the schedule live from
`scripts/puzzle-schedule.mjs`. Don't bother regenerating it unless you specifically
want to eyeball an order.

**Extending the calendar** (no map change, just more scheduled days) is just
step 4 — re-run `scripts/seed-puzzles.mjs` periodically (or on a scheduled job)
so `puzzles` always has upcoming dates.

---

## The redistricting runbook, end to end

When a new congressional map arrives (annual redraw, court order, mid-decade
DRA update):

1. In the **`createMaps`** sibling repo: get the new shapefile turned into
   `national/output/national-cd-<year>.geojson` (one polygon per district,
   `state-district` + `state` properties) via its own build process, and drop
   the new year's DRA block-assignment CSVs into
   `createMaps/dra-block-assignments/<cycle>/congress/` — see Step 0 above.
   *(This step lives outside this repo; if `createMaps` doesn't have a build
   script for the new shapefile yet, that has to be written there first —
   it's not something this repo's tooling can do for you.)*
2. `bash build-map.sh` (this repo) — rebuilds `districts-core.topojson`,
   `districts-overlay.topojson`, `state-svgs/*.svg`, `state-acs.json`.
3. `cd tools/census && make all` — rebuilds census, reps, clues, pop2020,
   plan-year, and compactness, and pushes every `*_update.sql` to Supabase
   (in the order the Makefile already encodes: compactness before derived).
   Then separately run `make lang push-lang` if you want the language field
   too (see the Step 2 gotcha above — it's excluded from `all`).
4. `node scripts/build-server-assets.mjs` — refreshes `states.topojson`,
   `district-names.json`, and applies `/tmp/dd_adj_update.sql` against
   Supabase (`district_geometries.adj`).
5. `node scripts/seed-puzzles.mjs 2026-06-22 436 > puzzles.sql` (or whatever date
   range makes sense) then `psql "$DATABASE_URL" -f puzzles.sql` — this
   reschedules every date across the new district set and rewrites
   `puzzles.clues`/`puzzles.census` fresh for all of them.
6. Commit the regenerated topojson/SVG/JSON files and the `tools/census/*_update.sql`
   files (all of them are meant to be committed, per the census README) —
   whoever redeploys next should be able to `git diff` and see exactly what
   changed.
7. Smoke-test: load the site, play a puzzle through to completion, and check
   the District Profile numbers look sane for a district you know changed.

### Gaps in this pipeline (found while researching, not resolved)

- **`district_geometries.geometry` (the actual polygon Supabase serves back to
  a player mid-game once they've solved the state) has no generating script
  anywhere in this repo.** `scripts/build-server-assets.mjs` only ever touches
  `district_geometries.adj`. Find and document how that column's initial load
  happened (likely a one-off manual import) before relying on this runbook
  for a real redistricting cycle — right now step 5 above reschedules
  `puzzles` correctly, but nothing here proves `district_geometries.geometry`
  gets refreshed to match the new boundaries.
- **Two different, independent clue-generation implementations exist for the
  same `puzzles.clues` column**: `scripts/seed-puzzles.mjs`'s own
  `buildStateClues`/`buildDistrictClues` (used at seed time, JS) vs.
  `tools/census/build_clues.py` (used for later refreshes, Python + SQL). They
  pick different fields and different wording. Re-running `scripts/seed-puzzles.mjs`
  after `make clues push-clues` has already run **will overwrite that day's
  clues with the seed script's own version** — know which one you want to be
  authoritative before running both.
- `tools/census/README.md`'s prose on "what's preserved" during a census
  rebuild lists 5 keys; `apply_census.py`'s actual `PRESERVE` list has 10
  (`area_sqmi`, `perimeter_mi`, `reock`, `pop2020`, `planYear`,
  `Margin2024Pres`, `DemPct2024Pres`, `RepPct2024Pres`, `rep`, `pct`). Trust
  the code over the prose until someone updates the README.
- `BACKEND.md`'s documented `puzzles` table schema omits the `census` jsonb
  column that `scripts/seed-puzzles.mjs` clearly populates — that doc reads as a
  point-in-time snapshot, not current schema.
- `build_reps.py` scrapes house.gov's HTML directly (regex against specific
  CSS class names); it will silently break if house.gov's markup changes.
  No fallback beyond skipping vacant seats.
- No R package install step is scripted anywhere — `sf`, `redistmetrics`,
  `lwgeom` are assumed already installed on the admin's machine.

---

## Reference: file inventory

| File | Generated by | Hand-maintained? |
|---|---|---|
| `districts-core.topojson`, `districts-overlay.topojson`, `districts.topojson` | `build-map.sh` | no |
| `state-svgs/*.svg` | `build-map.sh` | no |
| `state-acs.json` | `build-map.sh`, from `createMaps/acs_by_state.csv` | no |
| `states.topojson`, `district-names.json` | `scripts/build-server-assets.mjs` | no |
| `counties-lines.topojson` | *(none found in this repo)* | **yes — treat as static/externally produced** until a generator turns up |
| `puzzle-order.json` | `scripts/build-puzzle-order.mjs` | no, but also unused by `scripts/seed-puzzles.mjs` (documentation artifact only) |
| `tools/census/*_out.json`, `*_out.csv`, `*_update.sql` | the matching `tools/census/*.py` / `.R` script | no, except `derived_update.sql` (static, hand-written) |
| `puzzles.sql` (not committed — you generate it) | `scripts/seed-puzzles.mjs` | no |

## Reference: Supabase tables touched by this pipeline

- **`puzzles`** — one row per calendar date: `date` (PK), `puzzle_number`,
  `district_id`, `state`, `neighbors`, `state_neighbors`, `clues` (jsonb —
  `{state:[...], district:[...]}`, 6 cards each), `census` (jsonb demographic
  snapshot). Written by `scripts/seed-puzzles.mjs` (whole row) and by every
  `tools/census/push-*` target (`census`/`clues` fields only, matched by
  `district_id` across every scheduled date that district appears on).
- **`district_geometries`** — keyed by `district_id` (same `"NV-02"`-style
  string as `puzzles.district_id`). `adj` is written by
  `scripts/build-server-assets.mjs`; the actual `geometry` column's pipeline is the
  open gap noted above.
- Both `today`/`guess`/`state-shapes` Edge Functions read these tables live —
  no redeploy is needed after a data push, only after an Edge Function code
  change. See `BACKEND.md` for the Edge Function contracts themselves.
