#!/usr/bin/env Rscript
# roads_to_fc.R <in.json> <out.json> — GeometryCollection -> FeatureCollection,
# so mapshaper can simplify it like any other layer. Used by map.sh (Step 4).
args <- commandArgs(trailingOnly = TRUE)
data <- jsonlite::fromJSON(args[1], simplifyVector = FALSE)

empty_props <- setNames(list(), character(0))   # {} not [] when serialized
if (identical(data$type, "GeometryCollection")) {
  features <- lapply(data$geometries, function(g) list(type = "Feature", properties = empty_props, geometry = g))
} else if (identical(data$type, "FeatureCollection")) {
  features <- data$features
} else {
  features <- list()
}

fc <- list(type = "FeatureCollection", features = features)
cat(jsonlite::toJSON(fc, auto_unbox = TRUE, null = "null", na = "null", digits = NA), file = args[2])
cat(sprintf("  Roads: %d geometries ready.\n", length(features)))
