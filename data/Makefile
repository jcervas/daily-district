# daily-district/data — national map + District Profile data pipeline
# ------------------------------------------------------------------
#   make normalize      canonicalize per-state plan files (Congressional-Plans/)
#   make national        combine per-state plans -> national-cd-{year}.geojson (+SVG)
#   make acs-district    ACS demographics by district -> acs_by_district.csv
#   make acs-state        ACS demographics by state -> acs_by_state.csv
#   make map              package the national map -> districts.topojson + state-svgs/ + state-acs.json
#   make compactness      area/perimeter/Reock/Polsby-Popper/adjacency, from districts-core.topojson
#   make census           ACS tract aggregation -> census_out.json + census_update.sql
#   make reps             scrape house.gov -> reps_out.json + reps_update.sql
#   make clues            rebuild the 6 state + 6 district hint cards -> clues_update.sql
#   make pop2020          2020 Census population per district -> pop2020_update.sql
#   make lang             person-level non-English (C16001) -> lang_update.sql
#   make plan-year        latest congressional plan year per state -> plan_year_update.sql
#   make build            everything above except lang (map + all District Profile data)
#   make push             push ALL generated SQL files to the database (in dependency order)
#   make push-census / push-reps / push-clues / push-pop2020 / push-lang / push-plan-year / push-compactness
#   make push-margins      backfill 2024-presidential fields (margins_update.sql, generated from the topojson)
#   make push-derived      recompute percentile ranks (run after census/compactness changes)
#   make all              build + push
#   make clean             delete generated artifacts
#
# Config (override on the command line or via the environment):
#   CREATEMAPS_DIR   sibling repo with the raw/shared redistricting source data
#                    (Congressional-Plans/, dra-block-assignments/, us-*.json).
#   DD_BAF_DIR       folder of DRA block-assignment CSVs (the maps). Latest year
#                    on disk per state is used as the current map.
#   CENSUS_API_KEY   Census API key (a project key is the built-in default).
#   DATABASE_URL     Postgres connection string for the push targets. Get it from
#                    Supabase -> Project Settings -> Database -> Connection string
#                    (Session pooler). Keep it private; it contains the password.
# ------------------------------------------------------------------

RSCRIPT ?= Rscript

# District polygons the compactness/derived steps read (the built national map).
DD_DISTRICTS ?= ../districts-core.topojson
export DD_DISTRICTS

.PHONY: all build normalize national acs-district acs-state map compactness \
        census reps clues pop2020 lang plan-year \
        push push-census push-reps push-clues push-derived push-pop2020 push-lang push-plan-year push-compactness push-margins \
        clean help guard-db

help:
	@grep -E '^#   make ' $(MAKEFILE_LIST) | sed 's/^#   //'

# ---- map-building (no database access) -----------------------------
normalize:            ## canonicalize per-state plan files in Congressional-Plans/
	$(RSCRIPT) normalize_plans.R

national: normalize   ## combine per-state plans -> national-cd-{year}.geojson (+SVG)
	bash national.sh

acs-district:         ## ACS demographics by district -> acs_by_district.csv
	$(RSCRIPT) acs_by_district.R

acs-state:            ## ACS demographics by state -> acs_by_state.csv
	$(RSCRIPT) acs_by_state.R

map: national acs-district acs-state   ## package the national map -> districts.topojson + state-svgs/ + state-acs.json
	bash map.sh

compactness: map      ## area/perimeter/Reock/Polsby-Popper/adjacency -> compactness_out.csv + compactness_update.sql
	$(RSCRIPT) compactness.R "$(DD_DISTRICTS)" compactness_out.csv
	$(RSCRIPT) apply_compactness.R

# ---- build (no database access) ------------------------------------
build: map compactness census reps clues pop2020 plan-year

census:               ## ACS tract aggregation -> census_out.json + census_update.sql
	$(RSCRIPT) census.R
	$(RSCRIPT) apply_census.R

reps:                 ## scrape house.gov -> reps_out.json + reps_update.sql
	$(RSCRIPT) reps.R

clues:                ## rebuild the 6 state + 6 district hint cards -> clues_update.sql
	$(RSCRIPT) clues.R

pop2020:              ## 2020 Census population per district -> pop2020_update.sql
	$(RSCRIPT) pop2020.R

lang:                 ## person-level non-English (C16001) -> lang_update.sql
	$(RSCRIPT) lang.R

plan-year:            ## latest congressional plan year per state -> plan_year_update.sql
	$(RSCRIPT) plan_year.R

# ---- push to the database (needs DATABASE_URL + psql) ---------------
# Order matters: census rebuilds the census object (resetting the preserved geo/vote/rep
# fields to null), so the additive steps must follow it, and clues/derived read those
# fields so they run last. margins backfills the 2024-presidential fields census.R only
# preserves (see margins_update.sql); lang refines nonEnglishPct.
push: push-census push-compactness push-margins push-pop2020 push-plan-year push-lang push-reps push-clues push-derived

push-census: census_update.sql guard-db
	psql "$$DATABASE_URL" -1 -v ON_ERROR_STOP=1 -f census_update.sql
	@echo "census pushed."

push-margins: margins_update.sql guard-db
	psql "$$DATABASE_URL" -1 -v ON_ERROR_STOP=1 -f margins_update.sql
	@echo "margins (2024 presidential) pushed."

push-reps: reps_update.sql guard-db
	psql "$$DATABASE_URL" -1 -v ON_ERROR_STOP=1 -f reps_update.sql
	@echo "reps pushed."

push-clues: clues_update.sql guard-db
	psql "$$DATABASE_URL" -1 -v ON_ERROR_STOP=1 -f clues_update.sql
	@echo "clues pushed."

push-pop2020: pop2020_update.sql guard-db
	psql "$$DATABASE_URL" -1 -v ON_ERROR_STOP=1 -f pop2020_update.sql
	@echo "pop2020 pushed."

push-lang: lang_update.sql guard-db
	psql "$$DATABASE_URL" -1 -v ON_ERROR_STOP=1 -f lang_update.sql
	@echo "lang (person-level non-English) pushed."

push-plan-year: plan_year_update.sql guard-db
	psql "$$DATABASE_URL" -1 -v ON_ERROR_STOP=1 -f plan_year_update.sql
	@echo "plan-year pushed."

push-compactness: compactness_update.sql guard-db
	psql "$$DATABASE_URL" -1 -v ON_ERROR_STOP=1 -f compactness_update.sql
	@echo "compactness (area + perimeter + reock) pushed."

push-derived: derived_update.sql guard-db
	psql "$$DATABASE_URL" -1 -v ON_ERROR_STOP=1 -f derived_update.sql
	@echo "derived (percentile ranks) pushed."

all: build push

guard-db:
	@test -n "$$DATABASE_URL" || { \
	  echo "ERROR: DATABASE_URL is not set."; \
	  echo "  Supabase -> Project Settings -> Database -> Connection string (Session pooler)."; \
	  echo "  export DATABASE_URL='postgresql://...'"; \
	  exit 1; }

clean:
	rm -f census_out.json census_update.sql reps_out.json reps_update.sql clues_update.sql \
	      pop2020_update.sql lang_update.sql plan_year_update.sql compactness_out.csv compactness_update.sql \
	      acs_by_district.csv acs_by_state.csv
	rm -rf output
	@echo "Note: does not remove ../districts.topojson, ../districts-core.topojson, ../districts-overlay.topojson," \
	      "../state-svgs/, or ../state-acs.json — those are served files at the repo root, not build scratch."
