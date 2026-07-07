#!/usr/bin/env Rscript
# census.R — aggregate ACS 5-year data to 2026 congressional districts.
#
# Reproducible pipeline. For every district it computes the District Profile facts
# by rolling Census TRACT estimates up to the district via the DRA block-assignment
# files (latest year on disk per state = the map in effect for 2026).
#
# Why tracts (not block groups): the target geography is whole congressional
# districts, so tract resolution is plenty precise, and — unlike block groups —
# every ACS table we need (foreign-born, health insurance, etc.) is published at
# the tract level. One geography, one pass.
#
# Method
#   - block GEOID (15) -> tract GEOID (11) = first 11 chars
#   - each tract -> the district its blocks mostly fall in (plurality by block count)
#   - COUNT facts  : sum the tract estimates within the district
#   - MEDIAN facts : aggregate the ACS bracket counts across tracts, then linear-
#                    interpolate (income, home value, gross rent, age). Weighted
#                    means of tract medians are 20%+ off; bracket interpolation
#                    reproduces the published Census median.
#   - MEAN commute : sum (bracket count * bracket midpoint) / commuters
#   - at-large states (AK/DE/ND/SD/VT/WY): the whole state is district 01
#   - CONNECTICUT: the block-assignment file predates CT's 2022 switch from counties
#     to planning regions, so its tract GEOIDs carry the OLD county FIPS while ACS
#     uses the NEW ones. We remap CT crosswalk tracts to the current GEOID by
#     matching the 6-digit tract number (unique for 881/884 CT tracts).
#
# Config (env overrides): CENSUS_API_KEY, DD_ACS_YEAR (config.R: ACS_YEAR_CENSUS),
# DD_BAF_DIR (config.R: BAF_DIR).
#
# Usage
#   Rscript census.R          # all states  -> census_out.json
#   Rscript census.R TX CA    # just these states
# Then apply with apply_census.R (writes census_update.sql, preserving the non-ACS
# area_sqmi + 2024 presidential fields).

HERE <- tryCatch(dirname(sub("^--file=", "", grep("^--file=", commandArgs(FALSE), value = TRUE))), error = function(e) ".")
source(file.path(HERE, "config.R"))

OUT <- file.path(HERE, "census_out.json")
only_states <- commandArgs(trailingOnly = TRUE)

# ---- median bracket definitions (lower bound, width; last open = NA) --------
INC_LOWS <- c(0, 10000, 15000, 20000, 25000, 30000, 35000, 40000, 45000, 50000, 60000, 75000, 100000, 125000, 150000, 200000)
INC_WIDS <- c(10000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 10000, 15000, 25000, 25000, 25000, 50000, NA)
INC_VARS <- sprintf("B19001_%03dE", 2:17)

HV_LOWS <- c(0, 10000, 15000, 20000, 25000, 30000, 35000, 40000, 50000, 60000, 70000, 80000, 90000, 100000, 125000, 150000, 175000, 200000, 250000, 300000, 400000, 500000, 750000, 1000000, 1500000, 2000000)
HV_WIDS <- c(10000, 5000, 5000, 5000, 5000, 5000, 5000, 10000, 10000, 10000, 10000, 10000, 10000, 25000, 25000, 25000, 25000, 50000, 50000, 100000, 100000, 250000, 250000, 500000, 500000, NA)
HV_VARS <- sprintf("B25075_%03dE", 2:27)

RENT_LOWS <- c(0, 100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600, 650, 700, 750, 800, 900, 1000, 1250, 1500, 2000, 2500, 3000, 3500)
RENT_WIDS <- c(100, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 100, 100, 250, 250, 500, 500, 500, 500, NA)
RENT_VARS <- sprintf("B25063_%03dE", 3:26)

# B01001 sex-by-age -> single age distribution (male _003.._025 paired with female _027.._049)
AGE_BANDS <- list(c(0,5), c(5,5), c(10,5), c(15,3), c(18,2), c(20,1), c(21,1), c(22,3), c(25,5), c(30,5),
                   c(35,5), c(40,5), c(45,5), c(50,5), c(55,5), c(60,2), c(62,3), c(65,2), c(67,3), c(70,5),
                   c(75,5), c(80,5), c(85,16))
MALE_AGE   <- sprintf("B01001_%03dE", 3:25)
FEM_AGE    <- sprintf("B01001_%03dE", 27:49)
AGE65_VARS <- c("B01001_020E","B01001_021E","B01001_022E","B01001_023E","B01001_024E","B01001_025E",
                "B01001_044E","B01001_045E","B01001_046E","B01001_047E","B01001_048E","B01001_049E")
COMMUTE_VARS <- sprintf("B08303_%03dE", 2:13)
COMMUTE_MID  <- c(2.5, 7, 12, 17, 22, 27, 32, 37, 42, 52, 74.5, 95)

COUNT <- c(
  pop = "B01003_001E",
  whiteNH = "B03002_003E", blackNH = "B03002_004E", asianNH = "B03002_006E", hisp = "B03002_012E",
  edu_total = "B15003_001E", bach = "B15003_022E", master = "B15003_023E", prof = "B15003_024E", doct = "B15003_025E",
  fb_total = "B05002_001E", foreign_born = "B05002_013E",
  work_total = "B08301_001E", transit = "B08301_010E", wfh = "B08301_021E",
  occ_units = "B25003_001E", owner = "B25003_002E",
  pov_universe = "C17002_001E", pov_lt50 = "C17002_002E", pov_5099 = "C17002_003E",
  vet_universe = "B21001_001E", veterans = "B21001_002E",
  ins_total = "B27001_001E",
  lang_total = "C16001_001E", english_only = "C16001_002E",
  pop_in_hh = "B25008_001E"
)
UNINS <- sprintf("B27001_%03dE", c(5, 8, 11, 14, 17, 20, 23, 26, 29, 33, 36, 39, 42, 45, 48, 51, 54, 57))

VARS <- unique(c(unname(COUNT), UNINS, AGE65_VARS, COMMUTE_VARS, INC_VARS, "B19001_001E",
                 HV_VARS, "B25075_001E", RENT_VARS, "B25063_001E", MALE_AGE, FEM_AGE))

# ACS sometimes uses large-negative sentinels (e.g. -666666666) for suppressed/missing.
fnum_clean <- function(x) ifelse(is.na(x) | x <= -1e8, NA_real_, x)

build_state <- function(state) {
  xwalk <- tract_crosswalk_plurality(state)   # NULL for at-large
  tracts <- fetch_acs_tract(state, VARS, year = ACS_YEAR_CENSUS)
  var_cols <- setdiff(names(tracts), "GEOID")
  tracts[var_cols] <- lapply(tracts[var_cols], fnum_clean)

  if (!is.null(xwalk)) {
    xwalk <- ct_geoid_repair(xwalk, tracts$GEOID)
    dist <- unname(xwalk[tracts$GEOID])
  } else {
    dist <- rep("01", nrow(tracts))
  }
  tracts$district <- dist
  tracts <- tracts[!is.na(tracts$district), ]
  if (!nrow(tracts)) return(NULL)

  out <- list()
  for (d in sort(unique(tracts$district))) {
    rows <- tracts[tracts$district == d, , drop = FALSE]
    sumv <- function(code) sum(rows[[code]], na.rm = TRUE)

    pop <- sumv(COUNT[["pop"]])
    incb  <- colSums(as.matrix(rows[INC_VARS]),  na.rm = TRUE)
    hvb   <- colSums(as.matrix(rows[HV_VARS]),   na.rm = TRUE)
    rentb <- colSums(as.matrix(rows[RENT_VARS]), na.rm = TRUE)
    cmt   <- colSums(as.matrix(rows[COMMUTE_VARS]), na.rm = TRUE)
    ageb  <- colSums(as.matrix(rows[MALE_AGE]), na.rm = TRUE) + colSums(as.matrix(rows[FEM_AGE]), na.rm = TRUE)

    under18   <- sum(ageb[1:4])
    commN     <- sum(cmt)
    age65     <- sum(vapply(AGE65_VARS, sumv, numeric(1)))
    uninsured <- sum(vapply(UNINS, sumv, numeric(1)))

    pct <- function(num, den) if (is.finite(den) && den != 0) round(100 * num / den, 1) else NA_real_

    did <- sprintf("%s-%02d", state, as.integer(d))
    out[[did]] <- list(
      pop        = as.integer(round(pop)),
      whiteNH    = as.integer(round(sumv(COUNT[["whiteNH"]]))),
      black      = as.integer(round(sumv(COUNT[["blackNH"]]))),
      asian      = as.integer(round(sumv(COUNT[["asianNH"]]))),
      hispanic   = as.integer(round(sumv(COUNT[["hisp"]]))),
      bach       = as.integer(round(sumv(COUNT[["bach"]]))),
      master     = as.integer(round(sumv(COUNT[["master"]]) + sumv(COUNT[["prof"]]) + sumv(COUNT[["doct"]]))),
      edu_total  = as.integer(round(sumv(COUNT[["edu_total"]]))),
      income     = med_brackets(incb, INC_LOWS, INC_WIDS),
      medianHome = med_brackets(hvb, HV_LOWS, HV_WIDS),
      medianRent = med_brackets(rentb, RENT_LOWS, RENT_WIDS),
      medianAge  = med_age(ageb, AGE_BANDS),
      foreignBornPct = pct(sumv(COUNT[["foreign_born"]]), sumv(COUNT[["fb_total"]])),
      meanCommuteMin = if (commN > 0) round(sum(cmt * COMMUTE_MID) / commN, 1) else NA_real_,
      transitPct   = pct(sumv(COUNT[["transit"]]), sumv(COUNT[["work_total"]])),
      wfhPct       = pct(sumv(COUNT[["wfh"]]), sumv(COUNT[["work_total"]])),
      homeownerPct = pct(sumv(COUNT[["owner"]]), sumv(COUNT[["occ_units"]])),
      povertyPct   = pct(sumv(COUNT[["pov_lt50"]]) + sumv(COUNT[["pov_5099"]]), sumv(COUNT[["pov_universe"]])),
      under18Pct   = pct(under18, pop),
      age65Pct     = pct(age65, pop),
      veteranPct   = pct(sumv(COUNT[["veterans"]]), sumv(COUNT[["vet_universe"]])),
      uninsuredPct = pct(uninsured, sumv(COUNT[["ins_total"]])),
      nonEnglishPct = pct(sumv(COUNT[["lang_total"]]) - sumv(COUNT[["english_only"]]), sumv(COUNT[["lang_total"]])),
      avgHHSize    = if (sumv(COUNT[["occ_units"]]) > 0) round(sumv(COUNT[["pop_in_hh"]]) / sumv(COUNT[["occ_units"]]), 2) else NA_real_
    )
  }
  out
}

# Only the 50 congressional-district states (config.R's FIPS also covers DC/PR for
# acs_by_state.R, which have no congressional district to aggregate here).
states <- if (length(only_states)) only_states else sort(setdiff(names(FIPS), c("DC", "PR")))

res <- list()
for (i in seq_along(states)) {
  st <- states[i]
  t0 <- Sys.time()
  r <- tryCatch(build_state(st), error = function(e) { message("  ERROR ", st, ": ", conditionMessage(e)); NULL })
  if (!is.null(r)) res[names(r)] <- r
  message(sprintf("%s: %d districts (%.0fs)", st, if (!is.null(r)) length(r) else 0,
                   as.numeric(Sys.time() - t0, units = "secs")))
}

res <- res[order(names(res))]
json <- jsonlite::toJSON(res, auto_unbox = TRUE, null = "null", na = "null", digits = NA)
cat(json, file = OUT)
cat(sprintf("\nTOTAL %d districts -> %s\n", length(res), OUT))
