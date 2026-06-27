# District Profile data pipeline
# ------------------------------------------------------------------
# Rebuild + push the census demographics and current-representative data.
#
#   make census        rebuild ACS demographics from the block-assignment maps
#   make reps          rebuild current House members (scraped from house.gov)
#   make clues         rebuild the 6 state + 6 district hint cards (puzzles.clues)
#   make pop2020       2020 Census population per district (for "change since 2020")
#   make build         all of the above
#   make push          push ALL generated SQL files to the database
#   make push-census   push only census_update.sql
#   make push-reps     push only reps_update.sql
#   make push-clues    push only clues_update.sql
#   make push-derived  recompute perimeter + percentile ranks (after a census/map change)
#   make push-pop2020  push the 2020 Census population counts
#   make all           build + push everything
#   make clean         delete generated artifacts
#
# Config (override on the command line or via the environment):
#   DD_BAF_DIR       folder of DRA block-assignment CSVs (the maps).  Latest year
#                    on disk per state is used as the current map.
#   CENSUS_API_KEY   Census ACS API key (a project key is the built-in default).
#   DATABASE_URL     Postgres connection string for the push targets.  Get it from
#                    Supabase -> Project Settings -> Database -> Connection string
#                    (Session pooler).  Keep it private; it contains the password.
#
# Typical use:
#   When the maps change:  make census push-census
#   When members change:   make reps   push-reps
# ------------------------------------------------------------------

PYTHON ?= python3

# Default maps folder (override with `make census DD_BAF_DIR=/path/to/congress`).
DD_BAF_DIR ?= /Users/cervas/Library/CloudStorage/GoogleDrive-jcervas@andrew.cmu.edu/My Drive/GitHub/createMaps/dra-block-assignments/2022-2026/congress
export DD_BAF_DIR

.PHONY: all build census reps clues pop2020 push push-census push-reps push-clues push-derived push-pop2020 clean help

help:
	@grep -E '^#   make ' $(MAKEFILE_LIST) | sed 's/^#   //'

# ---- build (no database access) ----------------------------------
build: census reps clues pop2020

census:               ## ACS tract aggregation -> census_out.json + census_update.sql
	$(PYTHON) build_census.py
	$(PYTHON) apply_census.py

reps:                 ## scrape house.gov -> reps_out.json + reps_update.sql
	$(PYTHON) build_reps.py

clues:                ## rebuild the 6 state + 6 district hint cards -> clues_update.sql
	$(PYTHON) build_clues.py

pop2020:              ## 2020 Census population per district -> pop2020_update.sql
	$(PYTHON) build_pop2020.py

# ---- push to the database (needs DATABASE_URL + psql) -------------
push: push-census push-reps push-clues push-pop2020 push-derived

push-census: census_update.sql guard-db
	psql "$$DATABASE_URL" -1 -v ON_ERROR_STOP=1 -f census_update.sql
	@echo "census pushed."

push-reps: reps_update.sql guard-db
	psql "$$DATABASE_URL" -1 -v ON_ERROR_STOP=1 -f reps_update.sql
	@echo "reps pushed."

push-clues: clues_update.sql guard-db
	psql "$$DATABASE_URL" -1 -v ON_ERROR_STOP=1 -f clues_update.sql
	@echo "clues pushed."

push-pop2020: pop2020_update.sql guard-db
	psql "$$DATABASE_URL" -1 -v ON_ERROR_STOP=1 -f pop2020_update.sql
	@echo "pop2020 pushed."

push-derived: derived_update.sql guard-db
	psql "$$DATABASE_URL" -1 -v ON_ERROR_STOP=1 -f derived_update.sql
	@echo "derived (perimeter + percentile ranks) pushed."

all: build push

guard-db:
	@test -n "$$DATABASE_URL" || { \
	  echo "ERROR: DATABASE_URL is not set."; \
	  echo "  Supabase -> Project Settings -> Database -> Connection string (Session pooler)."; \
	  echo "  export DATABASE_URL='postgresql://...'"; \
	  exit 1; }

clean:
	rm -f census_out.json census_update.sql reps_out.json reps_update.sql clues_update.sql pop2020_update.sql
