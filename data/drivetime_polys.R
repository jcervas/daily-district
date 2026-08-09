#!/usr/bin/env Rscript
# drivetime_polys.R — write one GeoJSON polygon per district, for `osmium extract -p`.
# Called by drivetime.sh; see data/README.md for the wider picture.
#
# Uses the pre-simplification pipeline geometry (see drivetime.R): the web topojson is
# mapshaper-simplified and its outline cuts across real road corridors, which fragments
# the clipped routing graph and manufactures false "unreachable" pairs.
#
# Usage: Rscript drivetime_polys.R <STATE_ABBR> <out_dir>

HERE <- tryCatch(dirname(sub("^--file=", "", grep("^--file=", commandArgs(FALSE), value = TRUE))), error = function(e) ".")
suppressMessages(library(sf))

args   <- commandArgs(trailingOnly = TRUE)
state  <- args[[1]]
outdir <- args[[2]]
dir.create(outdir, showWarnings = FALSE, recursive = TRUE)

inp <- Sys.getenv("DD_DRIVETIME_GEOM", file.path(HERE, "output", "national-cd-2026-raw.geojson"))
if (!file.exists(inp)) inp <- file.path(HERE, "..", "districts-core.topojson")

g <- suppressWarnings(
  if (grepl("topojson$", inp)) st_read(inp, layer = "districts", quiet = TRUE) else st_read(inp, quiet = TRUE))
idcol <- intersect(c("state.district", "state-district", "state_district", "district_id"), names(g))[1]
if (is.na(idcol)) stop("no district id column found in ", inp)
g$district_id <- as.character(g[[idcol]])
g <- g[startsWith(g$district_id, paste0(state, "-")), ]
if (nrow(g) == 0) stop("no districts found for state ", state)
if (is.na(st_crs(g))) g <- st_set_crs(g, 4326)
g <- st_make_valid(g)

for (i in seq_len(nrow(g))) {
  did <- g$district_id[i]
  # Buffer out ~50 m so roads running exactly along the district line, and the points
  # sampled near it, aren't lost to a hairline clip.
  geom <- st_transform(st_buffer(st_transform(st_geometry(g)[i], 2163), 50), 4326)
  st_write(st_sf(id = did, geometry = geom), file.path(outdir, paste0(did, ".geojson")),
           driver = "GeoJSON", delete_dsn = TRUE, quiet = TRUE)
}
cat(nrow(g), "polygons ->", outdir, "\n")
