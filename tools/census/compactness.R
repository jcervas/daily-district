#!/usr/bin/env Rscript
# compactness.R — per-district shape metrics for the District Profile, computed in R.
#
# Replaces the old PostGIS bake (ST_Perimeter / ST_MinimumBoundingRadius). Outputs the
# COMPONENT PARTS the client needs to draw the profile cards + the compactness scores:
#   area_sqmi      polygon area              (drives the District Area card + Polsby-Popper)
#   perimeter_mi   polygon perimeter         (drives the perimeter line + Polsby-Popper)
#   reock          area / min-bounding-circle area
#   polsby_popper  4*pi*area / perimeter^2
#
# All geometry math is done in the US National Atlas Equal Area projection (EPSG:2163,
# now 9311) so it is valid for every state incl. AK/HI — the same projection the previous
# PostGIS bake used, so values match. sf + lwgeom use the same GEOS engine redist does,
# so these are identical to redist::redist.compactness(measure = c("PolsbyPopper","Reock")).
#
# Usage:  Rscript compactness.R [input.topojson|.geojson] [out.csv]
#   defaults: ../../districts-core.topojson  ->  compactness_out.csv
# Then:   python3 apply_compactness.py   (-> compactness_update.sql)  ;  make push-compactness

suppressMessages({ library(sf); library(lwgeom) })

args <- commandArgs(trailingOnly = TRUE)
here <- tryCatch(dirname(sub("^--file=", "", grep("^--file=", commandArgs(FALSE), value = TRUE))), error = function(e) ".")
inp  <- if (length(args) >= 1) args[[1]] else file.path(here, "..", "..", "districts-core.topojson")
outp <- if (length(args) >= 2) args[[2]] else file.path(here, "compactness_out.csv")

SQM_PER_SQMI <- 2589988.110336   # square meters in a square mile
M_PER_MI     <- 1609.344

g <- st_read(inp, quiet = TRUE)
# The national file carries the district id as `state.district` (sf dots the dot).
idcol <- intersect(c("state.district", "state_district", "district_id"), names(g))[1]
if (is.na(idcol)) stop("no district id column (state.district / district_id) found in ", inp)
g$district_id <- as.character(g[[idcol]])

if (is.na(st_crs(g))) g <- st_set_crs(g, 4326)   # GeoJSON/TopoJSON is lon/lat
g <- st_transform(g, 2163)
g <- st_make_valid(g)

area_m  <- as.numeric(st_area(g))
perim_m <- as.numeric(st_perimeter_lwgeom(g))
circ_m  <- as.numeric(st_area(st_minimum_bounding_circle(st_geometry(g))))

out <- data.frame(
  district_id  = g$district_id,
  area_sqmi    = round(area_m / SQM_PER_SQMI),
  perimeter_mi = round(perim_m / M_PER_MI),
  reock        = round(area_m / circ_m, 3),
  polsby_popper = round(4 * pi * area_m / (perim_m^2), 3),
  stringsAsFactors = FALSE
)
out <- out[order(out$district_id), ]
write.csv(out, outp, row.names = FALSE)
cat(sprintf("%d districts -> %s\n", nrow(out), outp))
