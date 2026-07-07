#!/usr/bin/env Rscript
# state_epsg.R [ST] — single source of truth for config.R's EPSG_STATE table
# (previously duplicated verbatim in compactness.sh and build-map.sh).
#   Rscript state_epsg.R      -> dump every "ABBR EPSG" pair, one per line
#   Rscript state_epsg.R TX   -> print just that state's EPSG code (or nothing)
LIB_DIR <- tryCatch(dirname(sub("^--file=", "", grep("^--file=", commandArgs(FALSE), value = TRUE))), error = function(e) ".")
HERE <- file.path(LIB_DIR, "..")   # config.R's own source() calls for lib/*.R expect HERE == data/
source(file.path(HERE, "config.R"))
args <- commandArgs(trailingOnly = TRUE)

if (length(args) >= 1) {
  v <- EPSG_STATE[args[1]]
  if (!is.na(v)) cat(unname(v))
} else {
  cat(paste(names(EPSG_STATE), unname(EPSG_STATE)), sep = "\n")
}
