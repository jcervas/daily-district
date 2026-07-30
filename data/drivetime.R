#!/usr/bin/env Rscript
# drivetime.R — max drive time across a district, via a local OSRM server.
#
# Samples points along the district boundary and asks OSRM's /table service for the full
# pairwise duration matrix, then takes the max. Boundary sampling is a heuristic — for a
# convex district the farthest pair by drive time is usually near the boundary, but it's
# not guaranteed for oddly-shaped (e.g. gerrymandered) districts.
#
# WHAT THE NUMBER MEANS. The metric is "max drive time WITHOUT LEAVING THE DISTRICT": the
# routing graph is clipped to the district polygon, so a route that would detour outside
# the district is unavailable. That makes it a measure of the district's internal road
# connectivity — a district you cannot traverse without leaving it is a real finding about
# its shape, not an error. (Clipping uses osmium's default complete_ways strategy, so a
# single road that dips just outside and comes back is kept whole; a connected detour
# network outside the district is not, since those ways are excluded entirely.)
#
# TWO DIFFERENT QUESTIONS ARE ANSWERED, because the max alone is ambiguous:
#   max_drive_min   the slowest pair anywhere in the district. Can be two points only a few
#                   miles apart with a mountain range between them, so a large value means
#                   "big OR slow" without saying which.
#   span_drive_min  the drive time between the two most spread-out points that are actually
#                   connected by road — "how long to cross it end to end". Reported with
#                   span_mi (straight-line distance for that pair) and geo_diameter_mi (the
#                   unrestricted geometric span, ignoring reachability).
# The gap between them is the useful part: max_drive_min >> span_drive_min means an internal
# terrain/road pathology rather than mere size. span_drive_min vs span_mi gives the detour
# factor — how far the roads deviate from a straight line.
#
# ROUTE GEOMETRY. max_route_poly / span_route_poly hold each route as an encoded polyline
# (precision 5, OSRM `overview=simplified`), so a map layer can later draw the real road
# path rather than a straight line between endpoints. max_route_mi / span_route_mi are the
# corresponding road distances (contrast with the straight-line span_mi).
#
# TWO FIGURES FOR THE MAX, because OSRM's car profile routes over `route=ferry`:
#   max_drive_min        road-only  (queried with ?exclude=ferry) — the headline stat.
#                        NA when no sampled pair is connected by road at all.
#   max_drive_min_ferry  ferry-inclusive — lets island districts (AK-01 over the Alaska
#                        Marine Highway, MA-09 to Nantucket/Martha's Vineyard) still show a
#                        figure without that boat time corrupting the headline number.
# Note the ferry figure is OSRM's synthetic duration: it adds no schedule wait, and some
# routes (e.g. the Aleutians) sail weekly, so treat it as indicative, not a travel estimate.
#
# `unreachable_pairs` / `total_pairs` quantify the road-only disconnection directly.
#
# Requires a local OSRM server built from a DISTRICT-clipped extract (see data/README.md) —
# this script does not call any paid API.
#
# Usage:  Rscript drivetime.R <DISTRICT_ID|STATE_ABBR> [OSRM_BASE_URL] [N_POINTS] [out.csv]
#   "VA-02" -> one district (server must hold that district's clipped graph)
#   "VA"    -> every district in the state against one shared server (state-clipped
#              semantics; kept for comparison, not the published definition)

HERE <- tryCatch(dirname(sub("^--file=", "", grep("^--file=", commandArgs(FALSE), value = TRUE))), error = function(e) ".")
suppressMessages({ library(sf); library(jsonlite) })

args     <- commandArgs(trailingOnly = TRUE)
target   <- if (length(args) >= 1) args[[1]] else "VA"
osrm_url <- if (length(args) >= 2) args[[2]] else "http://localhost:5001"
n_points <- if (length(args) >= 3) as.integer(args[[3]]) else 24L
outp     <- if (length(args) >= 4) args[[4]] else file.path(HERE, "drivetime_out.csv")

# Geometry source. Deliberately NOT districts-core.topojson: that is the mapshaper-simplified
# file served to the browser (VA-08 keeps 128 of its 513 vertices, NY-12 28 of 204), and a
# simplified outline cuts across real road corridors — clipping OSM with it fragments the
# network and manufactures false "unreachable" pairs. The pre-simplification pipeline output
# carries the same 435 ids. Override with $DD_DRIVETIME_GEOM.
inp <- Sys.getenv("DD_DRIVETIME_GEOM", file.path(HERE, "output", "national-cd-2026-raw.geojson"))
if (!file.exists(inp)) inp <- file.path(HERE, "..", "districts-core.topojson")

single_district <- grepl("^[A-Z]{2}-[0-9]+$", target)

g <- suppressWarnings(
  if (grepl("topojson$", inp)) st_read(inp, layer = "districts", quiet = TRUE) else st_read(inp, quiet = TRUE))
idcol <- intersect(c("state.district", "state-district", "state_district", "district_id"), names(g))[1]
if (is.na(idcol)) stop("no district id column found in ", inp)
g$district_id <- as.character(g[[idcol]])
g <- if (single_district) g[g$district_id == target, ] else g[startsWith(g$district_id, paste0(target, "-")), ]
if (nrow(g) == 0) stop("no districts found for ", target)

if (is.na(st_crs(g))) g <- st_set_crs(g, 4326)
g <- st_make_valid(g)
g_proj <- st_transform(g, 2163)   # st_line_sample needs a projected (non-degree) CRS

# Pull the sampling ring INSIDE the district before sampling. The routing graph is clipped
# at the district edge, and osmium's complete_ways keeps whole roads that merely clip a
# corner — those become isolated stubs connected to nothing inside. A point sampled exactly
# on the boundary readily snaps to such a stub and comes back unreachable from the whole
# district, which looks like disconnection but is pure clipping artifact (it put Arlington's
# VA-08 at 39% unreachable — a dense, obviously connected urban district). Insetting a few
# hundred metres keeps the extremes while snapping to interior roads instead. Backs off if
# the inset would collapse a narrow district to nothing.
inset <- function(geom_proj, metres = c(500, 250, 100)) {
  for (d in metres) {
    g2 <- st_buffer(geom_proj, -d)
    if (!st_is_empty(g2) && as.numeric(st_area(g2)) > 0) return(g2)
  }
  geom_proj
}

# Sample n_points evenly spaced along the (inset) district boundary, allocated
# proportionally to each ring/part's length (for non-contiguous MULTIPOLYGON districts) —
# a district like AK-01 can have 400+ boundary rings (one per island), so parts below their
# proportional share round DOWN to 0 and are skipped, rather than every ring getting a
# forced minimum of 1 point and blowing the sample size up by 10-20x. Falls back to the
# single longest part if everything rounds to 0 (all parts similarly tiny).
sample_boundary <- function(geom_proj, n) {
  geom_proj <- inset(geom_proj)
  b <- st_sf(geometry = st_sfc(st_boundary(geom_proj), crs = st_crs(geom_proj)))
  b <- st_cast(b, "LINESTRING", warn = FALSE)
  lens <- as.numeric(st_length(b))
  n_each <- round(lens / sum(lens) * n)
  if (all(n_each == 0)) n_each[which.max(lens)] <- 1L
  pts <- do.call(c, lapply(which(n_each > 0), function(j) {
    st_line_sample(st_geometry(b)[j], n = n_each[j], type = "regular")
  }))
  pts <- st_transform(st_sf(geometry = pts), 4326)
  st_cast(pts, "POINT")
}

# OSRM returns JSON null for unreachable pairs. jsonlite gives a clean numeric matrix when
# every entry is a number, but a nested list as soon as one null appears — normalize both
# to a numeric matrix with NA for the nulls.
as_duration_matrix <- function(m) {
  if (is.matrix(m)) return(matrix(as.numeric(m), nrow = nrow(m)))
  n <- length(m)
  out <- matrix(NA_real_, n, n)
  for (i in seq_len(n)) {
    row <- m[[i]]
    out[i, ] <- vapply(row, function(x) if (is.null(x)) NA_real_ else as.numeric(x), numeric(1))
  }
  out
}

# `exclude = "ferry"` uses car.lua's excludable ferry class, so road-only and
# ferry-inclusive both come off the SAME graph — no second build per district.
#
# Also returns each point's SNAPPED position and how far it had to snap. OSRM matches a
# coordinate to the nearest road at any distance, so a point sampled in roadless country
# (AK-01's North Slope, big Western districts) silently resolves to a road that may be
# hundreds of km away. Two consequences we handle at the call site: the stored endpoints
# must be the snapped road positions, not the sampled ones, or a map overlay would draw
# them in the wrong place; and points that snap absurdly far aren't really in the district's
# road network and shouldn't anchor the statistic.
osrm_table <- function(coords, exclude = NULL) {
  coord_str <- paste(sprintf("%.6f,%.6f", coords[, 1], coords[, 2]), collapse = ";")
  url <- sprintf("%s/table/v1/driving/%s?annotations=duration%s", osrm_url, coord_str,
                 if (is.null(exclude)) "" else paste0("&exclude=", exclude))
  res <- fromJSON(url)
  if (!identical(res$code, "Ok")) stop("OSRM table error: ", res$code, " for ", url)
  loc <- res$sources$location
  list(dur  = as_duration_matrix(res$durations),
       loc  = if (is.matrix(loc)) loc else do.call(rbind, loc),
       snap = as.numeric(res$sources$distance))
}

# Metres a sampled point may snap before we treat it as outside the road network.
MAX_SNAP_M <- as.numeric(Sys.getenv("DD_DRIVETIME_MAX_SNAP_M", "5000"))

# Sample this many times the target, then discard unusable points and thin back. District
# polygons extend into open water, so a coastal district's seaward samples all land in the
# ocean and get discarded — sampling n directly left FL-28 (the Keys) with 3 usable points
# and HI-01 with 12. Oversampling costs nothing real: the OSRM /table call is one request,
# and n*OVERSAMPLE stays well inside --max-table-size 10000.
OVERSAMPLE <- as.integer(Sys.getenv("DD_DRIVETIME_OVERSAMPLE", "3"))

# Max finite duration + the coordinate pair that produced it.
#
# The diagonal MUST be masked off first. Self-to-self is always 0 and always "reachable",
# so a district where no genuine pair connects (HI-02: every island isolated once ferries
# are excluded) would otherwise report max = 0.0 minutes — a plausible-looking number that
# actually means "no route exists". That has to surface as NA, which becomes SQL NULL.
peak <- function(dur, coords) {
  none <- list(min = NA_real_, from = c(NA_real_, NA_real_), to = c(NA_real_, NA_real_))
  if (is.null(nrow(dur)) || nrow(dur) < 2) return(none)
  d <- dur
  diag(d) <- NA_real_
  if (all(is.na(d))) return(none)
  idx <- which(d == max(d, na.rm = TRUE), arr.ind = TRUE)[1, ]
  list(min = round(max(d, na.rm = TRUE) / 60, 1), from = coords[idx[1], ], to = coords[idx[2], ])
}

# Points that reach NOTHING and are reached by nothing are residual clipping artifacts
# (a stub road with no interior connection), not evidence about the district — drop them
# so one stray sample can't null out the whole row. Genuine disconnection survives this:
# an island half of a district still has its points mutually reachable, so it forms a real
# second component rather than a set of isolated singletons.
# The geometrically most spread-out pair that you can actually drive between, and its
# drive time. This is a DIFFERENT question from the max: `max_drive_min` is the worst pair
# anywhere, which can be two points a few miles apart with a mountain range between them,
# so on its own it conflates "this district is big" with "this district is slow". The
# span pair answers "how long to cross it end to end". Comparing the two separates the
# causes — when max_drive_min greatly exceeds span_drive_min, the district has an internal
# terrain or road pathology rather than mere size.
#
# Restricted to mutually reachable pairs so a drive time always exists; `geo_diameter_mi`
# is reported alongside as the unrestricted geometric span for reference.
span_pair <- function(dur, coords) {
  n <- nrow(coords)
  if (is.null(n) || n < 2) return(NULL)
  pts <- st_as_sf(data.frame(lon = coords[, 1], lat = coords[, 2]), coords = c("lon", "lat"), crs = 4326)
  dm  <- as.numeric(st_distance(pts)) / 1609.344   # miles, great-circle
  dim(dm) <- c(n, n)
  reach <- !is.na(dur) & !is.na(t(dur))
  diag(reach) <- FALSE
  if (!any(reach)) return(list(geo_mi = round(max(dm), 1), mi = NA_real_, min = NA_real_, i = NA, j = NA))
  masked <- ifelse(reach, dm, NA_real_)
  idx <- which(masked == max(masked, na.rm = TRUE), arr.ind = TRUE)[1, ]
  list(geo_mi = round(max(dm), 1),
       mi     = round(dm[idx[1], idx[2]], 1),
       min    = round(dur[idx[1], idx[2]] / 60, 1),
       i = idx[1], j = idx[2])
}

# Route geometry for one pair, as an encoded polyline (precision 5) — compact enough to
# store for every district and decodable by any standard polyline library, so a future map
# layer can draw the actual road path instead of just the two endpoints.
osrm_route <- function(p1, p2, exclude = "ferry") {
  url <- sprintf("%s/route/v1/driving/%.6f,%.6f;%.6f,%.6f?overview=simplified&geometries=polyline%s",
                 osrm_url, p1[1], p1[2], p2[1], p2[2],
                 if (is.null(exclude)) "" else paste0("&exclude=", exclude))
  res <- tryCatch(fromJSON(url), error = function(e) NULL)
  if (is.null(res) || !identical(res$code, "Ok")) return(list(poly = NA_character_, mi = NA_real_))
  list(poly = as.character(res$routes$geometry[1]),
       mi   = round(as.numeric(res$routes$distance[1]) / 1609.344, 1))
}

isolated_idx <- function(dur) {
  n <- nrow(dur)
  if (is.null(n) || n < 2) return(integer(0))
  offdiag <- function(v, i) v[-i]
  which(vapply(seq_len(n), function(i)
    all(is.na(offdiag(dur[i, ], i))) && all(is.na(offdiag(dur[, i], i))), logical(1)))
}

# Size of the largest mutually-reachable group, so a district that genuinely splits in two
# is distinguishable from one that is fully connected.
largest_component <- function(dur) {
  n <- nrow(dur)
  if (is.null(n) || n == 0) return(0L)
  adj <- !is.na(dur) & !is.na(t(dur))
  seen <- rep(FALSE, n); best <- 0L
  for (s in seq_len(n)) {
    if (seen[s]) next
    stack <- s; comp <- 0L
    while (length(stack)) {
      v <- stack[1]; stack <- stack[-1]
      if (seen[v]) next
      seen[v] <- TRUE; comp <- comp + 1L
      stack <- c(stack, setdiff(which(adj[v, ]), which(seen)))
    }
    best <- max(best, comp)
  }
  best
}

results <- lapply(seq_len(nrow(g)), function(i) {
  did <- g$district_id[i]
  pts <- sample_boundary(st_geometry(g_proj)[i], n_points * OVERSAMPLE)
  if (nrow(pts) < 2) return(NULL)
  coords <- st_coordinates(pts)

  t_road  <- osrm_table(coords, exclude = "ferry")
  t_ferry <- osrm_table(coords)
  road  <- t_road$dur
  ferry <- t_ferry$dur
  # Report positions on the road network, not the sampled boundary points.
  snapped <- t_road$loc

  # `alive` tracks which ORIGINAL sample indices are still in play, so reported diagnostics
  # describe the points the statistic actually rests on rather than the discarded ones.
  alive <- seq_len(nrow(snapped))
  subset_all <- function(keep) {
    road    <<- road[keep, keep, drop = FALSE]
    ferry   <<- ferry[keep, keep, drop = FALSE]
    snapped <<- snapped[keep, , drop = FALSE]
    alive   <<- alive[keep]
  }

  # 1. Points that had to snap unreasonably far are not in this district's road network.
  far <- which(t_road$snap > MAX_SNAP_M)
  n_far <- length(far)
  if (n_far > 0 && n_far < nrow(snapped) - 1) subset_all(setdiff(seq_len(nrow(snapped)), far))

  # 2. Then drop residual clipping-artifact singletons.
  drop <- isolated_idx(road)
  n_iso <- length(drop)
  if (n_iso > 0 && n_iso < nrow(snapped) - 1) subset_all(setdiff(seq_len(nrow(snapped)), drop))

  # 3. Thin back to the target count, evenly across the survivors. Because we oversampled
  # (see OVERSAMPLE), a coastal district whose ocean-side points were all discarded still
  # arrives here with a full complement, while an inland district isn't scored on 3x the
  # points — the max of a pairwise matrix only grows with sample size, so leaving the
  # counts uneven would make districts non-comparable.
  if (nrow(snapped) > n_points) {
    subset_all(unique(round(seq(1, nrow(snapped), length.out = n_points))))
  }

  p_road  <- peak(road, snapped)
  p_ferry <- peak(ferry, snapped)
  sp      <- span_pair(road, snapped)

  # Road geometry for the two pairs worth drawing: the slowest pair and the end-to-end pair.
  r_max  <- if (is.na(p_road$min)) list(poly = NA_character_, mi = NA_real_) else
              osrm_route(p_road$from, p_road$to)
  r_span <- if (is.null(sp) || is.na(sp$min)) list(poly = NA_character_, mi = NA_real_) else
              osrm_route(snapped[sp$i, ], snapped[sp$j, ])

  # Ignore the diagonal (self-to-self is always 0 and always reachable) when counting
  # how disconnected the district's road network is.
  offdiag <- road[row(road) != col(road)]

  data.frame(
    district_id         = did,
    n_points            = nrow(snapped),
    n_sampled           = length(t_road$snap),
    far_snap_dropped    = n_far,
    isolated_dropped    = n_iso,
    # Worst snap among the points that SURVIVED — the discarded ocean samples would
    # otherwise dominate this and say nothing about the reported figure.
    max_snap_m          = round(max(t_road$snap[alive], na.rm = TRUE)),
    max_drive_min       = p_road$min,
    from_lon            = p_road$from[1],  from_lat  = p_road$from[2],
    to_lon              = p_road$to[1],    to_lat    = p_road$to[2],
    max_route_mi        = r_max$mi,
    # End-to-end span pair: how long to cross the district, as distinct from its worst pair.
    span_mi             = if (is.null(sp)) NA_real_ else sp$mi,
    span_drive_min      = if (is.null(sp)) NA_real_ else sp$min,
    span_from_lon       = if (is.null(sp) || is.na(sp$i)) NA_real_ else snapped[sp$i, 1],
    span_from_lat       = if (is.null(sp) || is.na(sp$i)) NA_real_ else snapped[sp$i, 2],
    span_to_lon         = if (is.null(sp) || is.na(sp$j)) NA_real_ else snapped[sp$j, 1],
    span_to_lat         = if (is.null(sp) || is.na(sp$j)) NA_real_ else snapped[sp$j, 2],
    span_route_mi       = r_span$mi,
    geo_diameter_mi     = if (is.null(sp)) NA_real_ else sp$geo_mi,
    max_drive_min_ferry = p_ferry$min,
    ferry_from_lon      = p_ferry$from[1], ferry_from_lat = p_ferry$from[2],
    ferry_to_lon        = p_ferry$to[1],   ferry_to_lat   = p_ferry$to[2],
    unreachable_pairs   = sum(is.na(offdiag)),
    total_pairs         = length(offdiag),
    largest_component   = largest_component(road),
    # Encoded polylines last: they are long, and the polyline alphabet is ASCII 63-126,
    # which excludes comma and newline, so they stay safe in an unquoted CSV.
    max_route_poly      = r_max$poly,
    span_route_poly     = r_span$poly,
    stringsAsFactors    = FALSE
  )
})

out <- do.call(rbind, results)
out <- out[order(out$district_id), ]
write.csv(out, outp, row.names = FALSE, quote = FALSE)
cat(sprintf("%d district(s) -> %s\n", nrow(out), outp))
print(out[, c("district_id", "n_points", "max_drive_min", "span_drive_min", "span_mi",
              "geo_diameter_mi", "max_drive_min_ferry", "unreachable_pairs", "total_pairs",
              "largest_component")], row.names = FALSE)
