#!/usr/bin/env Rscript
# normalize_plans.R — canonicalize the per-state plan files in Congressional-Plans/.
#
# Most state GeoJSONs already carry `state`, `state-district`, and `year` (and have
# shed the DRA label fields `labelx`/`labely`). A few older exports were exported
# without those identity fields and still carry the label fields, so downstream
# tools (build_national.R, compactness.R) would see NA. This step makes every file
# uniform:
#   year           <- the year in the filename (e.g. LA-2026.geojson -> 2026)
#   state          <- the state in the filename
#   state-district <- f"{state}-{id:02d}" from the feature id (when missing)
#   drops labelx / labely (DRA label-position hints, not used downstream)
#
# Only files that actually change are rewritten, so it's idempotent. Run before
# national.R / compactness.R when a new plan is dropped into Congressional-Plans/.

HERE <- tryCatch(dirname(sub("^--file=", "", grep("^--file=", commandArgs(FALSE), value = TRUE))), error = function(e) ".")
source(file.path(HERE, "config.R"))

DROP    <- c("labelx", "labely")
NAME_RE <- "^([A-Z]{2})-([0-9]{4})"

files <- sort(list.files(PLANS_DIR, pattern = "\\.geojson$", full.names = TRUE))
changed_files <- 0

for (path in files) {
  bn <- basename(path)
  m  <- regmatches(bn, regexec(NAME_RE, bn))[[1]]
  if (length(m) == 0) next
  state <- m[2]; year <- as.integer(m[3])

  data <- jsonlite::fromJSON(path, simplifyVector = FALSE)
  touched <- FALSE

  data$features <- lapply(data$features, function(feat) {
    p <- feat$properties
    if (is.null(p)) p <- list()

    if (is.null(p$year) || p$year != year) { p$year <- year; touched <<- TRUE }
    if (is.null(p$state)) { p$state <- state; touched <<- TRUE }
    if (is.null(p[["state-district"]]) && !is.null(p$id)) {
      p[["state-district"]] <- sprintf("%s-%02d", state, as.integer(p$id))
      touched <<- TRUE
    }
    for (k in DROP) {
      if (!is.null(p[[k]])) { p[[k]] <- NULL; touched <<- TRUE }
    }

    feat$properties <- p
    feat
  })

  if (touched) {
    json <- jsonlite::toJSON(data, auto_unbox = TRUE, null = "null", na = "null", digits = NA)
    cat(json, file = path)
    changed_files <- changed_files + 1
    cat(sprintf("  normalized %s\n", bn))
  }
}

if (changed_files > 0) {
  cat(sprintf("%d file(s) normalized.\n", changed_files))
} else {
  cat("All plan files already uniform.\n")
}
