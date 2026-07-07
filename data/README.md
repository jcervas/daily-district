# Data pipeline — national map + District Profile

Reproducibly rebuilds everything that used to be scattered across `createMaps` (a
sibling repo) and `daily-district/tools/census`: the national congressional-district
map served to players (`districts.topojson`, `state-svgs/`, `state-acs.json`) **and**
the ACS/compactness/representative data behind the District Profile
(`puzzles.census` / `puzzles.clues` in Supabase). One `Makefile`, one language (R +
mapshaper), one directory.

## TL;DR

```bash
cd data
export CENSUS_API_KEY='...'          # optional — a project key is the built-in default
export DATABASE_URL='postgresql://...'   # only needed for the push-* targets

make build          # rebuild the map + all District Profile data (no DB push)
make push           # push the generated *_update.sql to the database
# or just: make all

# A map (district boundary) changed:
make national map compactness push-compactness

# House membership changed:
make reps push-reps

# One targeted field, without a full rebuild:
make lang push-lang
```

Run `make help` for the full target list. The generated `*_out.json` / `*_out.csv` /
`*_update.sql` files are committed, so you can eyeball the diff before pushing.

## Two stages

**Map-building** (no database access) — produces the files served directly to
players, at the repo root:

```
normalize -> national -> map (needs acs-district, acs-state, compactness)
```

| target | output |
|---|---|
| `normalize` | canonicalizes per-state plan files in `Congressional-Plans/` |
| `national` | `output/national-cd-{2022,2024,2026}.geojson` (+ overview SVG) |
| `acs-district` | `acs_by_district.csv` — ACS demographics joined into the map |
| `acs-state` | `acs_by_state.csv` — ACS demographics for the state-phase clues |
| `compactness` | `compactness_out.csv` — area/perimeter/Reock/Polsby-Popper/adjacency |
| `map` | `../districts.topojson` (+ `-core`/`-overlay` split), `../state-svgs/*.svg`, `../state-acs.json` |

**District Profile / DB** (needs `DATABASE_URL` to push) — produces
`*_update.sql`, applied to `puzzles.census` / `puzzles.clues`:

| target | output |
|---|---|
| `census` | `census_out.json` + `census_update.sql` — ACS tract aggregation |
| `reps` | `reps_out.json` + `reps_update.sql` — current House member, scraped from house.gov |
| `clues` | `clues_update.sql` — the 6 state + 6 district hint cards |
| `pop2020` | `pop2020_update.sql` — 2020 Census population, for "change since 2020" |
| `lang` | `lang_update.sql` — targeted non-English-speakers recompute |
| `plan-year` | `plan_year_update.sql` — last-redrawn year per state |
| `compactness` | (shared with the map stage above) also feeds `apply_compactness.R` |

`make build` runs the map stage + all of the above except `lang` (a targeted
single-field recompute, run standalone). `make all` = `build` + `push`.

## Requirements

- **R** (`Rscript`) with packages `sf`, `lwgeom`, `jsonlite`, `rvest` (only `reps.R`
  needs it). No `tidycensus` or `tigris` anywhere — every Census API call goes
  straight to `api.census.gov` via `lib/census_api.R`, and `acs_by_state.R`
  downloads the TIGER cartographic-boundary shapefile directly for land area.
- **mapshaper** ≥ 0.6 (`npm install -g mapshaper`)
- **psql** (for the `push-*` targets only)

## Config (env overrides)

- `CREATEMAPS_DIR` (or legacy `CREATEMAPS`) — sibling repo holding the raw/shared
  redistricting source data (`Congressional-Plans/`, `dra-block-assignments/`,
  `us-state.json`, `us-urban.json`, `us_can_roads.json`) — shared across many
  projects beyond this game, so it isn't duplicated into this repo. Defaults to
  `../../createMaps`.
- `DD_BAF_DIR` — folder of DRA block-assignment CSVs (the maps). The **latest year
  on disk per state** is used as the current map. Defaults to
  `$CREATEMAPS_DIR/dra-block-assignments/2022-2026/congress`.
- `CENSUS_API_KEY` — Census API key (a project key is the built-in default).
- `DD_ACS_YEAR_MAP` / `DD_ACS_YEAR` — ACS 5-year vintage for the map stage
  (`acs_by_district.R`/`acs_by_state.R`, default 2024) vs. the District Profile
  stage (`census.R`/`lang.R`, default 2023). These are intentionally independent —
  a discrepancy carried over unchanged from the scripts this consolidates.
- `DATABASE_URL` — Postgres connection string for the `push-*` targets. Get it from
  **Supabase → Project Settings → Database → Connection string → Session pooler**.
  Contains the database password — keep it out of source control (export it in
  your shell, don't commit it).

## How it works

The target geography is whole congressional districts. Two different crosswalks
are used, on purpose, for two different consumers:

- **`acs_by_district.R`** (feeds `districts.topojson`) uses a **weighted**
  tract→district crosswalk — a tract split across districts contributes to each
  proportionally by block-count share — and simple weighted sums/means. Coarser,
  but cheap and good enough for the map's embedded stats.
- **`census.R` / `pop2020.R` / `lang.R`** (feed the District Profile / DB) use a
  **plurality** crosswalk (`lib/acs_helpers.R`'s `tract_crosswalk_plurality()`) —
  each tract is assigned *wholly* to the district most of its blocks fall in, ties
  broken by whichever district was encountered first in the block-assignment file
  (matters for a literal handful of exactly-50/50 boundary tracts nationally) — plus
  **bracket interpolation** for medians (income, home value, rent, age): summing the
  ACS bracket counts across tracts and linearly interpolating, since weighted means
  of tract medians run 20%+ off the true district median.
- **Connecticut**: block-assignment files predate CT's 2022 switch from counties to
  planning regions, so tract GEOIDs carry the *old* county FIPS while current ACS
  vintages use the *new* ones. `ct_geoid_repair()` remaps crosswalk tracts to the
  current GEOID by matching the unique 6-digit tract number.
- **At-large states** (AK, DE, ND, SD, VT, WY) have no block-assignment file — the
  whole state is district `01`, fetched directly at `congressional district`
  geography instead of aggregated from tracts.

**Compactness is computed once, shared by both stages.** `compactness.R` is the
single implementation of area/perimeter/Reock/Polsby-Popper/adjacency (previously
computed two different ways: `redistmetrics`/EPSG:5070 inline in the old
`build-map.sh`, and `sf`+`lwgeom`/EPSG:2163 in the old `tools/census/compactness.R`).
Both `map.sh` (embeds it in `districts.topojson`) and `apply_compactness.R` (pushes
it to `puzzles.census`) now read from the same script, standardized on EPSG:2163 —
the number in the map and the number in the DB are provably the same computation.

## What's preserved vs. recomputed (DB push)

`apply_census.R` replaces every ACS field but preserves these non-ACS keys already
in the stored census: `area_sqmi`, `perimeter_mi`, `reock` (written by
`push-compactness`), `pop2020` / `planYear` / `Margin2024Pres` / `DemPct2024Pres` /
`RepPct2024Pres` (written by their own targeted pushes), `rep` (current House
member), and `pct` (percentile ranks, written by `push-derived`).

## Field glossary (`census_out.json`)

| key | meaning | ACS source |
|---|---|---|
| `pop` | total population | B01003 |
| `whiteNH` `black` `asian` `hispanic` | race/ethnicity counts | B03002 |
| `bach` `master` `edu_total` | bachelor's / grad+prof+doc degrees; pop 25+ | B15003 |
| `income` | median household income | B19001 (brackets) |
| `medianHome` | median value, owner-occupied | B25075 (brackets) |
| `medianRent` | median gross rent | B25063 (brackets) |
| `medianAge` | median age | B01001 (brackets) |
| `foreignBornPct` | % foreign-born | B05002 |
| `meanCommuteMin` | mean travel time to work (min) | B08303 |
| `transitPct` `wfhPct` | % public transit / work-from-home commuters | B08301 |
| `homeownerPct` | % owner-occupied households | B25003 |
| `povertyPct` | % below poverty | C17002 |
| `under18Pct` `age65Pct` | % under 18 / 65+ | B01001 |
| `veteranPct` | % veterans (civilian 18+) | B21001 |
| `uninsuredPct` | % without health insurance | B27001 |
| `nonEnglishPct` | % households speaking a language other than English | C16001 |
| `avgHHSize` | average household size | B25008 / B25003 |

## Out of scope

- `createMaps/compactness/{compactness.sh, compactness.R, compactness_grid.sh}` —
  a separate research tool ranking compactness across *every* historical plan
  (e.g. "most gerrymandered district ever"), not just the current map. Unrelated to
  the live game; stays in `createMaps/compactness/`.
- Raw/shared geographic source data (`Congressional-Plans/`,
  `dra-block-assignments/`, `us-state.json`, `us-urban.json`, `us_can_roads.json`) —
  stays in `createMaps` (`$CREATEMAPS_DIR`), the shared workspace for many
  redistricting projects beyond this game.

## Files

- `Makefile` — one-command build + push (`make help` for targets)
- `config.R` — shared paths, API config, and state lookup tables (FIPS, time zones,
  EPSG codes); sourced first by every script
- `lib/census_api.R` — raw Census API client (base R + jsonlite; no tidycensus)
- `lib/acs_helpers.R` — plurality tract→district crosswalk, CT GEOID repair,
  median-bracket interpolation
- `lib/sql_write.R` — shared jsonb/SQL-literal helpers for the apply/DB scripts
- `lib/map_join.R`, `lib/roads_to_fc.R`, `lib/state_epsg.R`, `lib/svg_postprocess.R`,
  `lib/state_acs_json.R`, `lib/topojson_summary.R` — small glue scripts called from
  `map.sh`
- `normalize_plans.R`, `build_national.R`, `national.sh` — combine per-state plans
  into the national map
- `acs_by_district.R`, `acs_by_state.R` — ACS demographics for the map / state clues
- `compactness.R` — shared shape-metrics script (area/perimeter/Reock/Polsby-Popper/adjacency)
- `map.sh` — package the national map into `districts.topojson` + state SVGs + state-acs.json
- `census.R` / `apply_census.R` — ACS tract aggregation → DB push SQL
- `reps.R`, `clues.R`, `pop2020.R`, `lang.R`, `plan_year.R`, `apply_compactness.R` —
  the rest of the District Profile data
- `derived_update.sql` — percentile ranks (`census.pct`), pure SQL, unchanged
- `*_out.json` / `*_out.csv` / `*_update.sql` — generated artifacts (regenerable, committed)
