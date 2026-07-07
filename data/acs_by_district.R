#!/usr/bin/env Rscript
# ============================================================
# acs_by_district.R
# Aggregates ACS 5-year tract-level estimates to the current Congressional
# district boundaries using DRA block assignment files.
#
# Output: acs_by_district.csv  (one row per state-district)
#
# Variables aggregated:
#   pop          B01003_001E  Total population
#   income       B19013_001E  Median household income (pop-wtd mean of tract medians)
#   whiteNH      B03002_003E  White alone, not Hispanic
#   black        B03002_004E  Black alone, not Hispanic
#   asian        B03002_006E  Asian alone, not Hispanic
#   hispanic     B03002_012E  Hispanic or Latino
#   medianHome   B25077_001E  Median home value (pop-wtd mean of tract medians)
#   bach         B15003_022E  Bachelor's degree
#   master       B15003_023E  Master's degree
#
# Usage:
#   Rscript acs_by_district.R          # all states
#   Rscript acs_by_district.R TX CA    # just these states (for quick iteration)
# ============================================================

HERE <- tryCatch(dirname(sub("^--file=", "", grep("^--file=", commandArgs(FALSE), value = TRUE))), error = function(e) ".")
source(file.path(HERE, "config.R"))

OUT_FILE <- file.path(HERE, "acs_by_district.csv")
only_states <- commandArgs(trailingOnly = TRUE)

ACS_VARS <- c(pop = "B01003_001E", income = "B19013_001E", whiteNH = "B03002_003E", black = "B03002_004E",
              asian = "B03002_006E", hispanic = "B03002_012E", medianHome = "B25077_001E",
              bach = "B15003_022E", master = "B15003_023E")

# ---- pick most recent BAF file per state -----------------------------------
baf_all <- list.files(BAF_DIR, pattern = "\\.csv$")
baf_info <- data.frame(
  fname = baf_all,
  abbr  = sub("^([A-Z]+) .*", "\\1", baf_all),
  year  = as.integer(sub("^[A-Z]+ ([0-9]{4}) .*", "\\1", baf_all)),
  stringsAsFactors = FALSE
)
baf_info <- do.call(rbind, lapply(split(baf_info, baf_info$abbr), function(d) d[which.max(d$year), ]))
if (length(only_states)) baf_info <- baf_info[baf_info$abbr %in% only_states, ]
message(sprintf("Found BAF files for %d states (most recent plan per state).", nrow(baf_info)))

process_state <- function(abbr, fname) {
  baf <- read.csv(file.path(BAF_DIR, fname), colClasses = c(GEOID20 = "character", District = "integer"))
  baf$tract_fips <- substr(baf$GEOID20, 1, 11)

  # Weighted tract -> district crosswalk: tracts split across districts are
  # weighted by the share of blocks assigned to each (blocks within a tract have
  # similar population density, so this is a reasonable approximation).
  n_blocks <- aggregate(GEOID20 ~ tract_fips + District, baf, length)
  names(n_blocks)[3] <- "n_blocks"
  tract_total <- aggregate(n_blocks ~ tract_fips, n_blocks, sum)
  names(tract_total)[2] <- "tract_total"
  crosswalk <- merge(n_blocks, tract_total, by = "tract_fips")
  crosswalk$weight <- crosswalk$n_blocks / crosswalk$tract_total

  # CT switched to new Planning Region county codes in 2022 ACS; 2020 blocks use
  # old codes. Use 2021 ACS for CT so tract GEOIDs match the BAF block GEOIDs.
  acs_year_state <- if (abbr == "CT") 2021L else ACS_YEAR_MAP
  message(sprintf("   Getting ACS tract data (year %d)...", acs_year_state))
  tracts <- tryCatch(fetch_acs_tract(abbr, unname(ACS_VARS), year = acs_year_state),
                      error = function(e) { message("   ACS tract failed: ", e$message); NULL })
  if (is.null(tracts)) return(NULL)
  names(tracts)[match(unname(ACS_VARS), names(tracts))] <- names(ACS_VARS)
  for (v in names(ACS_VARS)) tracts[[v]][is.na(tracts[[v]])] <- 0

  j <- merge(tracts, crosswalk, by.x = "GEOID", by.y = "tract_fips")
  j <- j[!is.na(j$District), ]
  if (!nrow(j)) return(NULL)

  wmean <- function(x, w) { keep <- x > 0 & !is.na(x); if (!any(keep)) return(NA_real_); stats::weighted.mean(x[keep], w[keep]) }
  wsum  <- function(x, w) sum(x * w, na.rm = TRUE)

  out <- do.call(rbind, lapply(split(j, j$District), function(d) {
    data.frame(
      District   = d$District[1],
      pop        = wsum(d$pop, d$weight),
      # Medians: population-weighted average of tract medians (approximation).
      income     = wmean(d$income,     d$n_blocks * d$weight),
      medianHome = wmean(d$medianHome, d$n_blocks * d$weight),
      whiteNH    = wsum(d$whiteNH,  d$weight),
      black      = wsum(d$black,   d$weight),
      asian      = wsum(d$asian,   d$weight),
      hispanic   = wsum(d$hispanic,d$weight),
      bach       = wsum(d$bach,    d$weight),
      master     = wsum(d$master,  d$weight)
    )
  }))
  out$state    <- abbr
  out$district <- sprintf("%02d", out$District)
  out[["state-district"]] <- paste0(abbr, "-", out$district)
  out[, c("state-district", "state", "district", "pop", "income", "medianHome",
          "whiteNH", "black", "asian", "hispanic", "bach", "master")]
}

results <- list()
for (i in seq_len(nrow(baf_info))) {
  row <- baf_info[i, ]
  message(sprintf("[%d/%d] %s (%s plan)", i, nrow(baf_info), row$abbr, row$year))
  r <- process_state(row$abbr, row$fname)
  if (!is.null(r)) results[[row$abbr]] <- r
}
results <- do.call(rbind, results)

# ---- at-large states not in BAF (AK, DE, ND, SD, VT, WY) -------------------
at_large_missing <- setdiff(AT_LARGE, baf_info$abbr)
if (length(only_states)) at_large_missing <- intersect(at_large_missing, only_states)
if (length(at_large_missing)) {
  message("\nFetching at-large states from ACS API: ", paste(at_large_missing, collapse = ", "))
  al_rows <- lapply(at_large_missing, function(abbr) {
    message("  ", abbr)
    d <- tryCatch(fetch_acs_cd(abbr, unname(ACS_VARS), year = ACS_YEAR_MAP),
                  error = function(e) { message("  Failed: ", e$message); NULL })
    if (is.null(d) || !nrow(d)) return(NULL)
    names(d)[match(unname(ACS_VARS), names(d))] <- names(ACS_VARS)
    d <- d[1, , drop = FALSE]
    data.frame(`state-district` = paste0(abbr, "-01"), state = abbr, district = "01",
               pop = d$pop, income = d$income, medianHome = d$medianHome,
               whiteNH = d$whiteNH, black = d$black, asian = d$asian, hispanic = d$hispanic,
               bach = d$bach, master = d$master, check.names = FALSE)
  })
  results <- rbind(results, do.call(rbind, al_rows))
}

# ---- round and write --------------------------------------------------------
num_cols <- c("pop", "income", "medianHome", "whiteNH", "black", "asian", "hispanic", "bach", "master")
for (col in num_cols) results[[col]] <- round(results[[col]])
results <- results[order(results[["state-district"]]), ]

message(sprintf("\nWriting %d districts to %s", nrow(results), OUT_FILE))
write.csv(results, OUT_FILE, row.names = FALSE, na = "", quote = FALSE)

message("\nSample output:")
print(head(results, 6))
message("\nDone.")
