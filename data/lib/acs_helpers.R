# lib/acs_helpers.R — tract -> district crosswalk (plurality) + ACS median-bracket
# interpolation. Shared by census.R / pop2020.R / lang.R (the tract-level District
# Profile scripts, which all roll 2020 census blocks up to 2026 districts the same way).
# Requires config.R (BAF_DIR, AT_LARGE) to be sourced first.

#' tract GEOID(11) -> plurality district number, for one state's LATEST block-assignment
#' file on disk. Returns NULL for at-large states (whole state = district 01).
tract_crosswalk_plurality <- function(state_abbr, baf_dir = BAF_DIR) {
  if (state_abbr %in% AT_LARGE) return(NULL)
  files <- list.files(baf_dir, pattern = paste0("^", state_abbr, " .*Congressional\\.csv$"))
  if (!length(files)) stop("no block-assignment file for ", state_abbr, " in ", baf_dir)
  fn <- max(files)   # filenames are "<ST> <YYYY> Congressional.csv" - lexicographic max = latest year
  baf <- read.csv(file.path(baf_dir, fn), colClasses = "character")
  names(baf)[1:2] <- c("GEOID20", "District")
  tract <- substr(baf$GEOID20, 1, 11)
  district <- baf$District

  # Count blocks per (tract, district) pair, then within each tract keep the
  # plurality winner, tied broken by whichever district was ENCOUNTERED FIRST in
  # the file — matches Python's Counter.most_common() insertion-order tie-break
  # (exact 50/50 splits do happen at real district boundaries).
  key <- paste(tract, district, sep = "\r")
  counts <- table(key)
  first_idx <- !duplicated(key)
  pairs <- data.frame(tract = tract[first_idx], district = district[first_idx],
                       n = as.integer(counts[key[first_idx]]), stringsAsFactors = FALSE)
  by_tract <- split(seq_len(nrow(pairs)), pairs$tract)   # split() preserves original row order
  winner <- vapply(by_tract, function(idx) pairs$district[idx[which.max(pairs$n[idx])]], character(1))
  setNames(unname(winner), names(by_tract))
}

#' Remap crosswalk tract GEOIDs to the ACS/Decennial vintage's GEOIDs when the direct
#' join misses (e.g. CT's 2022 county -> planning-region switch), by matching the
#' unique 6-digit tract number.
ct_geoid_repair <- function(xwalk, have_geoids) {
  missing <- setdiff(names(xwalk), have_geoids)
  if (!length(missing)) return(xwalk)
  t6 <- substr(have_geoids, 6, 11)
  for (g in missing) {
    cand <- have_geoids[t6 == substr(g, 6, 11)]
    if (length(cand) == 1) xwalk[[cand]] <- xwalk[[g]]
  }
  xwalk
}

#' Linear-interpolate a median from ACS bracket counts.
#' counts: numeric vector of bracket counts, same order as lows/wids.
#' lows:   lower bound of each bracket. wids: bracket width (NA = open-ended top bracket).
med_brackets <- function(counts, lows, wids) {
  n <- sum(counts, na.rm = TRUE)
  if (!is.finite(n) || n <= 0) return(NA_real_)
  half <- n / 2; cum <- 0
  for (i in seq_along(counts)) {
    x <- counts[i]; if (is.na(x)) x <- 0
    if (cum + x >= half) {
      if (is.na(wids[i])) return(lows[i])
      return(round(lows[i] + ((half - cum) / x) * wids[i]))
    }
    cum <- cum + x
  }
  lows[length(lows)]
}

#' Median from B01001-style age-band bracket counts.
#' bands: list of c(start, width) pairs, same order as counts.
med_age <- function(counts, bands) {
  n <- sum(counts, na.rm = TRUE)
  if (!is.finite(n) || n <= 0) return(NA_real_)
  half <- n / 2; cum <- 0
  for (i in seq_along(counts)) {
    x <- counts[i]; if (is.na(x)) x <- 0
    if (cum + x >= half) return(round(bands[[i]][1] + ((half - cum) / x) * bands[[i]][2], 1))
    cum <- cum + x
  }
  NA_real_
}
