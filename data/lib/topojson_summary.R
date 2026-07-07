#!/usr/bin/env Rscript
# topojson_summary.R <file.topojson> — print layer/geometry counts (map.sh, final step).
args <- commandArgs(trailingOnly = TRUE)
topo <- jsonlite::fromJSON(args[1], simplifyVector = FALSE)
for (name in names(topo$objects)) {
  n <- length(topo$objects[[name]]$geometries)
  cat(sprintf("  %-14s %d geometries\n", name, n))
}
