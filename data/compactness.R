#!/usr/bin/env Rscript
# compactness.R — per-district shape metrics for the national map + District Profile.
#
# Single shared implementation. Previously computed twice, two different ways, for
# the same current districts: via redistmetrics (EPSG:5070) inline in build-map.sh
# for districts.topojson, and via sf+lwgeom (EPSG:2163) in tools/census/compactness.R
# for the live DB. Both call sites (map.sh and apply_compactness.R) now read from here,
# so the number embedded in districts.topojson and the number in puzzles.census are
# provably the same computation.
#
# Outputs the COMPONENT PARTS the client needs to draw the District Profile cards,
# the compactness scores, and district adjacency:
#   area_sqmi      polygon area              (District Area card + Polsby-Popper)
#   perimeter_mi   polygon perimeter         (perimeter line + Polsby-Popper)
#   reock          area / min-bounding-circle area
#   polsby_popper  4*pi*area / perimeter^2
#   adj            pipe-separated list of neighboring state-district keys
#
# All geometry math is done in the US National Atlas Equal Area projection (EPSG:2163,
# now 9311) so it is valid for every state incl. AK/HI. sf + lwgeom use the same GEOS
# engine redist does, so these match redist::redist.compactness(measure=c("PolsbyPopper","Reock")).
#
# Usage:  Rscript compactness.R [input.topojson|.geojson] [out.csv]
#   defaults: ../districts-core.topojson  ->  compactness_out.csv

HERE <- tryCatch(dirname(sub("^--file=", "", grep("^--file=", commandArgs(FALSE), value = TRUE))), error = function(e) ".")
suppressMessages({ library(sf); library(lwgeom) })

args <- commandArgs(trailingOnly = TRUE)
inp  <- if (length(args) >= 1) args[[1]] else file.path(HERE, "..", "districts-core.topojson")
outp <- if (length(args) >= 2) args[[2]] else file.path(HERE, "compactness_out.csv")

SQM_PER_SQMI <- 2589988.110336   # square meters in a square mile
M_PER_MI     <- 1609.344

# TopoJSON inputs carry multiple layers (districts/states/points) — read "districts"
# by name when present instead of relying on layer order; plain GeoJSON has one layer.
layer_names <- tryCatch(st_layers(inp)$name, error = function(e) character(0))
g <- if ("districts" %in% layer_names) st_read(inp, layer = "districts", quiet = TRUE) else st_read(inp, quiet = TRUE)
# The national file carries the district id as `state.district` (sf dots the hyphen).
idcol <- intersect(c("state.district", "state-district", "state_district", "district_id"), names(g))[1]
if (is.na(idcol)) stop("no district id column (state-district / district_id) found in ", inp)
g$district_id <- as.character(g[[idcol]])

if (is.na(st_crs(g))) g <- st_set_crs(g, 4326)   # GeoJSON/TopoJSON is lon/lat
g <- st_transform(g, 2163)
g <- st_make_valid(g)

area_m  <- as.numeric(st_area(g))
perim_m <- as.numeric(st_perimeter_lwgeom(g))
circ_m  <- as.numeric(st_area(st_minimum_bounding_circle(st_geometry(g))))

# Adjacency: pipe-separated list of neighboring state-district keys, computed in the
# same projected CRS as the shape metrics above (one geometry pass for everything).
touches <- st_touches(g, sparse = TRUE)
adj <- vapply(touches, function(idx) paste(g$district_id[idx], collapse = "|"), character(1))

out <- data.frame(
  district_id   = g$district_id,
  area_sqmi     = round(area_m / SQM_PER_SQMI),
  perimeter_mi  = round(perim_m / M_PER_MI),
  reock         = round(area_m / circ_m, 3),
  polsby_popper = round(4 * pi * area_m / (perim_m^2), 3),
  adj           = adj,
  stringsAsFactors = FALSE
)
out <- out[order(out$district_id), ]
write.csv(out, outp, row.names = FALSE, quote = FALSE)
cat(sprintf("%d districts -> %s\n", nrow(out), outp))
