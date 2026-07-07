#!/usr/bin/env Rscript
# build_national.R
#
# Reads original GeoJSON files from Congressional-Plans (never modifies them),
# enriches features in-memory, and writes national-cd-{year}-raw.geojson to
# output/.
#
# Enrichment per feature:
#   - Drops display/style fields (color, opacity, text-size, text-color, NAME)
#   - Files with "2020 Pres" in filename:
#       * Renames DemPct/RepPct/Margin -> DemPct2020Pres/RepPct2020Pres/Margin2020Pres
#       * Adds DemPct2024Pres/RepPct2024Pres/Margin2024Pres from The Downballot CSV
#   - All other files (DRA 2024 data):
#       * Renames DemPct/RepPct/Margin -> DemPct2024Pres/RepPct2024Pres/Margin2024Pres
#   - Notes is always the last field
#
# Usage:
#   Rscript build_national.R --year 2022   # all 2022 maps
#   Rscript build_national.R --year 2024   # most recent through 2024
#   Rscript build_national.R --year 2026   # most recent (default)
#
# Outputs: output/national-cd-{year}-raw.geojson

HERE <- tryCatch(dirname(sub("^--file=", "", grep("^--file=", commandArgs(FALSE), value = TRUE))), error = function(e) ".")
source(file.path(HERE, "config.R"))

FIELDS_TO_DROP <- c("color", "opacity", "text-size", "text-color", "NAME")
DRA_NOTE <- "Source: Dave's Redistricting App (https://davesredistricting.org)."
DB_URL   <- "https://docs.google.com/spreadsheets/d/1ng1i_Dm_RMDnEvauH44pgE6JCUsapcuu8F2pCfeLWFo"

# ---- args -----------------------------------------------------------------
args <- commandArgs(trailingOnly = TRUE)
yi <- which(args == "--year")
MAX_YEAR <- if (length(yi) && length(args) >= yi[1] + 1) as.integer(args[yi[1] + 1]) else 2026L

dir.create(NATIONAL_OUT_DIR, showWarnings = FALSE, recursive = TRUE)
OUT_FILE <- file.path(NATIONAL_OUT_DIR, sprintf("national-cd-%d-raw.geojson", MAX_YEAR))

# ---- load Downballot CSV ----------------------------------------------------
# Row 0: banner, Row 1: year headers, Row 2: column headers, Row 3+: data.
raw <- read.csv(DOWNBALLOT_CSV, header = FALSE, skip = 3, stringsAsFactors = FALSE, colClasses = "character")
raw <- raw[!is.na(raw[[1]]) & trimws(raw[[1]]) != "", ]

downballot <- list()
for (i in seq_len(nrow(raw))) {
  dist <- sub("-AL$", "-01", trimws(raw[[1]][i]))
  vals <- suppressWarnings(as.numeric(unlist(raw[i, 4:9], use.names = FALSE)))
  if (anyNA(vals)) next
  downballot[[dist]] <- list(harris = vals[1] / 100, trump24 = vals[2] / 100, margin24 = vals[3] / 100,
                             biden = vals[4] / 100, trump20 = vals[5] / 100, margin20 = vals[6] / 100)
}

# ---- select most recent file per state up to MAX_YEAR ----------------------
NAME_RE <- "^([A-Z]{2})-([0-9]{4})"
all_files <- list.files(PLANS_DIR, pattern = "\\.geojson$")
state_files <- list()   # abbr -> list(fname=, year=)
for (fname in all_files) {
  m <- regmatches(fname, regexec(NAME_RE, fname))[[1]]
  if (length(m) == 0) next
  state <- m[2]; year <- as.integer(m[3])
  if (year > MAX_YEAR) next
  cur <- state_files[[state]]
  if (is.null(cur) || year > cur$year) state_files[[state]] <- list(fname = fname, year = year)
}

# ---- enrich and combine -----------------------------------------------------
features <- vector("list", 0)
for (state in sort(names(state_files))) {
  fname <- state_files[[state]]$fname
  year  <- state_files[[state]]$year
  is_2020_file <- grepl("2020 Pres", fname, fixed = TRUE)

  data <- jsonlite::fromJSON(file.path(PLANS_DIR, fname), simplifyVector = FALSE)

  for (feat in data$features) {
    p <- feat$properties
    if (is.null(p)) p <- list()
    for (f in FIELDS_TO_DROP) p[[f]] <- NULL

    if (is_2020_file) {
      renames <- list(c("DemPct", "DemPct2020Pres"), c("RepPct", "RepPct2020Pres"), c("Margin", "Margin2020Pres"))
      for (rn in renames) {
        if (!is.null(p[[rn[1]]])) { p[[rn[2]]] <- p[[rn[1]]]; p[[rn[1]]] <- NULL }
      }

      dist <- sub("-AL$", "-01", trimws(if (is.null(p[["state-district"]])) "" else p[["state-district"]]))
      db <- downballot[[dist]]
      if (!is.null(db)) {
        p$DemPct2024Pres <- round(db$harris,   6)
        p$RepPct2024Pres <- round(db$trump24,  6)
        p$Margin2024Pres <- round(db$margin24, 6)
        note <- sprintf("2020 Pres data from original precinct-based shapefile. 2024 Pres data (Harris/Trump %%) from The Downballot (%s).", DB_URL)
      } else {
        cat(sprintf("  WARNING: %s not found in Downballot data\n", dist))
        note <- "2020 Pres data from original precinct-based shapefile."
      }
    } else {
      # DRA file — rename DemPct/RepPct as 2024, recalculate Margin from
      # DemPct - RepPct to avoid sign errors in the stored Margin field.
      dem <- p$DemPct; rep <- p$RepPct
      p$DemPct <- NULL; p$RepPct <- NULL; p$Margin <- NULL
      if (!is.null(dem) && !is.null(rep)) {
        p$DemPct2024Pres <- dem
        p$RepPct2024Pres <- rep
        p$Margin2024Pres <- round(dem - rep, 6)
      }
      note <- DRA_NOTE
    }

    # Stamp the plan year from the filename (authoritative — some source files
    # don't carry a year/state/state-district property). Fill state +
    # state-district only when the source omits them, deriving the district
    # from the feature id (1..N -> ST-01..ST-NN).
    p$year <- year
    if (is.null(p$state)) p$state <- state
    if (is.null(p[["state-district"]]) && !is.null(p$id)) {
      p[["state-district"]] <- sprintf("%s-%02d", state, as.integer(p$id))
    }

    # Mark whether this state's map changed vs. the previous cycle.
    p$changed <- if (year == MAX_YEAR && MAX_YEAR > 2022) 1L else 0L

    # Notes always last.
    p$Notes <- note

    feat$properties <- p
    features[[length(features) + 1]] <- feat
  }
  cat(sprintf("  %s (%d) — %s\n", state, year, fname))
}

combined <- list(type = "FeatureCollection", features = features)
json <- jsonlite::toJSON(combined, auto_unbox = TRUE, null = "null", na = "null", digits = NA)
cat(json, file = OUT_FILE)

cat(sprintf("\nWrote %d districts from %d states -> %s\n", length(features), length(state_files), OUT_FILE))
