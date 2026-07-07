#!/usr/bin/env Rscript
# ============================================================
# acs_by_state.R
# Pulls state-level ACS 5-year estimates for the district-guess
# game's STATE-PHASE clues (the QuickFacts-style facts shown
# while the player is still guessing the state).
#
# Output: acs_by_state.csv  (one row per state, 50 + DC + PR)
#
# Variables (mirrors census.gov/quickfacts):
#   pop             B01003_001   Total population
#   whiteNH_pct     B03002_003 / B03002_001
#   black_pct       B03002_004 / B03002_001
#   asian_pct       B03002_006 / B03002_001
#   hispanic_pct    B03002_012 / B03002_001
#   foreignBorn_pct B05002_013 / B05002_001
#   medianRent      B25064_001   Median gross rent ($)
#   bachPlus_pct    (B15003_022+023+024+025) / B15003_001  (age 25+)
#   meanTravelTime  B08013_001 / B08012_001  (minutes)
#   landAreaSqMi    TIGER ALAND (cartographic boundary shapefile), m^2 -> sq mi
# ============================================================

HERE <- tryCatch(dirname(sub("^--file=", "", grep("^--file=", commandArgs(FALSE), value = TRUE))), error = function(e) ".")
source(file.path(HERE, "config.R"))

OUT_FILE <- file.path(HERE, "acs_by_state.csv")

ACS_VARS <- c(pop = "B01003_001E", race_total = "B03002_001E", whiteNH = "B03002_003E", black = "B03002_004E",
              asian = "B03002_006E", hispanic = "B03002_012E", fb_total = "B05002_001E", foreignBorn = "B05002_013E",
              medianRent = "B25064_001E", edu_total = "B15003_001E", bach = "B15003_022E", master = "B15003_023E",
              prof = "B15003_024E", doctorate = "B15003_025E", travel_agg = "B08013_001E", travel_wrk = "B08012_001E")

message("Fetching state-level ACS ", ACS_YEAR_MAP, " 5-year estimates...")
raw <- fetch_acs_state(unname(ACS_VARS), year = ACS_YEAR_MAP)
names(raw)[match(unname(ACS_VARS), names(raw))] <- names(ACS_VARS)

# ---- land area (sq mi) from the Census cartographic-boundary shapefile ------
message("Fetching state land areas from TIGER cartographic boundary file...")
tmp_zip <- tempfile(fileext = ".zip"); tmp_dir <- tempfile()
utils::download.file("https://www2.census.gov/geo/tiger/GENZ2023/shp/cb_2023_us_state_500k.zip", tmp_zip, quiet = TRUE)
utils::unzip(tmp_zip, exdir = tmp_dir)
shp_file <- list.files(tmp_dir, pattern = "\\.shp$", full.names = TRUE)[1]
states_sf <- sf::st_read(shp_file, quiet = TRUE)
land <- data.frame(GEOID = as.character(states_sf$GEOID),
                    landAreaSqMi = round(as.numeric(states_sf$ALAND) / 2589988.110336),
                    stringsAsFactors = FALSE)
unlink(c(tmp_zip, tmp_dir), recursive = TRUE)

# ---- state abbreviation lookup (hardcoded FIPS table) -----------------------
raw$abbr <- FIPS2ST[raw$GEOID]

pct <- function(num, den) round(100 * num / den, 1)

merged <- merge(raw, land, by = "GEOID", all.x = TRUE)
out <- data.frame(
  state           = merged$abbr,
  name            = merged$NAME,
  pop             = round(merged$pop),
  whiteNH_pct     = pct(merged$whiteNH,  merged$race_total),
  black_pct       = pct(merged$black,    merged$race_total),
  asian_pct       = pct(merged$asian,    merged$race_total),
  hispanic_pct    = pct(merged$hispanic, merged$race_total),
  foreignBorn_pct = pct(merged$foreignBorn, merged$fb_total),
  medianRent      = round(merged$medianRent),
  bachPlus_pct    = pct(merged$bach + merged$master + merged$prof + merged$doctorate, merged$edu_total),
  meanTravelTime  = round(merged$travel_agg / merged$travel_wrk, 1),
  landAreaSqMi    = merged$landAreaSqMi,
  stringsAsFactors = FALSE
)
out <- out[!is.na(out$state), ]
out <- out[order(out$state), ]

message(sprintf("Writing %d states to %s", nrow(out), OUT_FILE))
write.csv(out, OUT_FILE, row.names = FALSE, na = "", quote = FALSE)

message("\nSample output:")
print(head(out, 6))
message("\nDone.")
