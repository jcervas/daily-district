# District Profile census pipeline

Reproducibly rebuilds the ACS demographic facts shown in the **District Profile**
(`puzzles.census`) for all 435 congressional districts, aggregated to the **2026
district boundaries**.

## TL;DR — when something changes

```bash
cd tools/census
export DATABASE_URL='postgresql://...'   # once per shell (see Prerequisites)

# A map (district boundary) changed — rebuild demographics and push:
make census push-census

# House membership changed — rebuild representatives and push:
make reps push-reps

# Re-tune the hint cards (after any census/rep change) and push:
make clues push-clues

# Rebuild and push everything:
make all
```

`make census` reads the block-assignment maps in `DD_BAF_DIR`, aggregates ACS,
and writes `census_out.json` + `census_update.sql`. `make reps` scrapes
house.gov and writes `reps_out.json` + `reps_update.sql`. The `push-*` targets
apply the generated `.sql` to the database with `psql`. Run `make help` for the
full target list. (The generated `.sql` is also committed, so you can eyeball the
diff before pushing.)

Iterating on one state: `python3 build_census.py TX` (skips the push).

## Prerequisites

- **python3** (standard library only — no pip installs) and **psql**.
- **`DD_BAF_DIR`** — folder of DRA block-assignment CSVs (`<ST> <year> Congressional.csv`).
  The Makefile defaults to the local createMaps path; override with
  `make census DD_BAF_DIR=/path/to/congress`. The **latest year on disk per
  state** is treated as the current map (2026 where present, else 2024/2022), so
  to adopt a new map just drop the newer-year CSV into that folder and re-run.
- **`CENSUS_API_KEY`** — Census ACS key. A project key is the built-in default;
  override via the environment if needed.
- **`DATABASE_URL`** — Postgres connection string, required only for the `push-*`
  targets. Get it from **Supabase → Project Settings → Database → Connection
  string → Session pooler**. It contains the database password, so keep it out of
  source control (export it in your shell). `reps` only touches `census->'rep'`;
  `census` replaces the ACS fields (preserving the keys listed below).

## How it works

The target geography is whole congressional districts, so we aggregate Census
**tract** estimates (not block groups): tract resolution is plenty precise for a
district-level profile, and — unlike block groups — *every* ACS table we need
(foreign-born, health insurance, language, …) is published at the tract level.

1. **Crosswalk.** Each DRA block-assignment file (`DD_BAF_DIR`) maps 2020 census
   blocks → district for a given map year. We use the **latest year on disk per
   state** (2026 where present, else 2024/2022) = the map in effect for 2026.
   Blocks are rolled up to their tract (`GEOID[:11]`), and each tract is assigned
   to the district **most** of its blocks fall in (plurality).
2. **Fetch.** ACS 5-year (`DD_ACS_YEAR`, default 2023 = the 2019–2023 release)
   tract estimates for every variable, one state at a time.
3. **Aggregate** per district:
   - **counts** (population, race, degrees, …) are summed;
   - **medians** (household income, home value, gross rent, age) are computed by
     summing the ACS *bracket* counts across tracts and linear-interpolating the
     median. Weighted means of tract medians are 20 %+ off — bracket interpolation
     reproduces the published Census median;
   - **mean commute** = Σ(bracket count × bracket midpoint) / commuters.

### Edge cases

- **At-large states** (AK, DE, ND, SD, VT, WY) have no block-assignment file — the
  whole state is district `01`.
- **Connecticut** switched from counties to planning regions in 2022, so the
  block-assignment file's tract GEOIDs carry the *old* county FIPS while ACS 2023
  uses the *new* ones. The build remaps CT crosswalk tracts to the current GEOID
  by matching the 6-digit tract number (unique for 881/884 CT tracts).

## Validation

Aggregating with this method reproduces the previously stored TX-07 figures:
population to **0.14 %** (block-group) / ~1.5 % (tract) and race to ~1 %. The
medians intentionally **replace** the prior stored values, which did not
correspond to any standard ACS measure for the 2026 boundary (the old TX-07
"income" of $125,841 matched neither the household median $77 k, family median
$92 k, nor mean $133 k for that district).

## What's preserved vs recomputed

`apply_census.py` replaces every ACS field but preserves these non-ACS keys from
the existing census: `area_sqmi` (computed from the 2026 polygon), the 2024
presidential fields `Margin2024Pres`, `DemPct2024Pres`, `RepPct2024Pres`, and
`rep` (the current House member, below).

## Current representative

`build_reps.py` scrapes the official directory at
https://www.house.gov/representatives and writes a `rep` object onto each
district's census (`{name, party, partyCode, url}`). Representatives change over
time — re-run `make reps push-reps` whenever House membership shifts. It only
touches `census->'rep'`, and a census rebuild won't drop it (the key is in
`apply_census.py`'s preserve list).

## Hint clues (`puzzles.clues`)

`build_clues.py` regenerates the six **state** and six **district** hint cards the
`today` function reveals one-per-guess (each `{icon, label, value}`), ordered
low-signal → "basically the answer":

- **State:** land area · median household income · median gross rent · foreign-born
  · time zone · delegation size
- **District:** median age · median household income · largest racial/ethnic group
  · 2024 presidential vote · population density · current representative

The **state** deck is precomputed per state (state ACS from `state-acs.json`,
state median income from ACS B19013, land area + time zone + delegation count).
The **district** deck is computed in SQL straight from the live `census` jsonb, so
re-running `make clues push-clues` after any census/representative change refreshes
every district automatically — no per-district data to assemble. The qualitative
bands (e.g. "Very large state", "Dense urban", "Likely Democratic") live in the
generator. The live game renders these server strings directly (the client
`FACT_DEFS` array is legacy).

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
| `nonEnglishPct` | % households speaking a language other than English | C16002 |
| `avgHHSize` | average household size | B25008 / B25003 |

## How it reaches the live game

The data lives in `puzzles.census` (one row per puzzle date, keyed by
`district_id`). The `push-*` targets `UPDATE` those rows by `district_id`, so
every scheduled puzzle for a district picks up the change. The `today` Edge
Function reads `puzzle.census` live and returns it once a game is completed —
no redeploy needed, the next page load serves the new numbers. (Note: an
*anonymous* player who already finished today's puzzle keeps a browser-cached
copy until the next day; signed-in players and all future days are immediate.)

## Files

- `Makefile` — one-command build + push (`make help` for targets)
- `build_census.py` — aggregator (ACS tract → district) → `census_out.json`
- `apply_census.py` — `census_out.json` → `census_update.sql`
- `build_reps.py` — scrape house.gov → `reps_out.json` + `reps_update.sql`
- `build_clues.py` — rebuild the 6+6 hint cards → `clues_update.sql`
- `build_pop2020.py` — 2020 Census population per district → `pop2020_update.sql`
- `build_lang.py` — person-level non-English (C16001) → `lang_update.sql`
- `compactness.R` — area / perimeter / Reock per district in R (`sf`) → `compactness_out.csv`
- `apply_compactness.py` — `compactness_out.csv` → `compactness_update.sql` (writes area_sqmi, perimeter_mi, reock into census). Replaces the old PostGIS perimeter/reock bake; run `make push-compactness` before `push-derived`.
- `derived_update.sql` — percentile ranks (`census.pct`) over the census values
- `*_out.json` / `*_out.csv` / `*_update.sql` — generated artifacts (regenerable, committed)
