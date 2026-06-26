# District Profile census pipeline

Reproducibly rebuilds the ACS demographic facts shown in the **District Profile**
(`puzzles.census`) for all 435 congressional districts, aggregated to the **2026
district boundaries**.

## Quick start

```bash
cd tools/census
export CENSUS_API_KEY=your_key          # optional; a project key is the default
python3 build_census.py                 # ~5 min -> census_out.json (435 districts)
python3 apply_census.py                 # -> census_update.sql
# then run census_update.sql against the DB (psql / Supabase SQL editor / apply_migration)
```

Build a single state while iterating: `python3 build_census.py TX`.

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
time — re-run it whenever House membership shifts:

```bash
python3 build_reps.py        # -> reps_out.json + reps_update.sql
# then apply reps_update.sql
```

It only touches `census->'rep'`, and a census rebuild won't drop it (the key is
in `apply_census.py`'s preserve list).

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

## Files

- `build_census.py` — aggregator (ACS tract → district) → `census_out.json`
- `apply_census.py` — `census_out.json` → `census_update.sql`
- `build_reps.py` — scrape house.gov → `reps_out.json` + `reps_update.sql`
- `*_out.json` / `*_update.sql` — generated artifacts (regenerable)
