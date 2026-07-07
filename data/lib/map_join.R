#!/usr/bin/env Rscript
# map_join.R <districts.geojson> <compactness.csv> <acs_by_district.csv> <output.geojson>
#
# Joins the shared compactness.R metrics (area/perimeter/Reock/Polsby-Popper/adj)
# and acs_by_district.R demographics into the simplified national districts
# GeoJSON, ahead of topojson assembly (map.sh).
args <- commandArgs(trailingOnly = TRUE)
suppressMessages(library(sf))

shp     <- st_read(args[1], quiet = TRUE)
compact <- read.csv(args[2], stringsAsFactors = FALSE)
acs     <- read.csv(args[3], stringsAsFactors = FALSE, check.names = FALSE)

# GDAL's OGR GeoJSON reader sanitizes "state-district" to "state.district" on
# read (R data.frame name rules); restore the hyphen so the field the client
# expects survives into the written output.
idcol <- intersect(c("state-district", "state.district", "state_district"), names(shp))[1]
if (is.na(idcol)) stop("no state-district column found in ", args[1])
if (idcol != "state-district") names(shp)[names(shp) == idcol] <- "state-district"

names(compact)[names(compact) == "district_id"] <- "state-district"

shp <- merge(shp, compact, by = "state-district", all.x = TRUE)
shp <- merge(shp, acs[, c("state-district", "pop", "income", "medianHome",
                          "whiteNH", "black", "asian", "hispanic", "bach", "master")],
             by = "state-district", all.x = TRUE)

st_write(shp, args[4], driver = "GeoJSON", delete_dsn = TRUE, quiet = TRUE)
cat(sprintf("  Joined compactness + ACS for %d districts -> %s\n", nrow(shp), args[4]))
