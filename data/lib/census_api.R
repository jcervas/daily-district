# lib/census_api.R — shared raw Census API client (base R + jsonlite; no tidycensus/tigris).
# Requires config.R to be sourced first (CENSUS_API_KEY, FIPS, ACS_YEAR_MAP).

.census_get <- function(url, tries = 4) {
  for (a in seq_len(tries)) {
    res <- tryCatch(jsonlite::fromJSON(url), error = function(e) e)
    if (!inherits(res, "error")) return(res)
    if (a < tries) Sys.sleep(2 * a)
  }
  stop("Census API request failed after ", tries, " tries: ", url)
}

.chunk <- function(x, n) unname(split(x, ceiling(seq_along(x) / n)))

.census_query <- function(params) {
  paste(mapply(function(k, v) paste0(k, "=", utils::URLencode(v, reserved = TRUE)),
               names(params), params), collapse = "&")
}

# JSON array-of-arrays (header row + data rows, all strings) -> data.frame keyed by GEOID.
.rows_to_df <- function(m, id_vars) {
  h <- m[1, ]
  body <- m[-1, , drop = FALSE]
  geoid <- paste0(body[, h == "state"], body[, h == "county"], body[, h == "tract"])
  df <- as.data.frame(body[, h %in% id_vars, drop = FALSE], stringsAsFactors = FALSE)
  names(df) <- h[h %in% id_vars]
  df[] <- lapply(df, as.numeric)
  df$GEOID <- geoid
  df
}

#' Fetch ACS variables for every tract in a state, chunked (the API caps ~50 vars/call).
#' Returns a data.frame: one row per tract, `GEOID` (11-digit tract FIPS) + one column per variable.
fetch_acs_tract <- function(state_abbr, vars, year = ACS_YEAR_MAP, dataset = "acs/acs5", chunk_size = 45) {
  fips <- FIPS[[state_abbr]]
  base <- sprintf("https://api.census.gov/data/%d/%s", year, dataset)
  out <- NULL
  for (ch in .chunk(vars, chunk_size)) {
    q <- .census_query(list(get = paste(ch, collapse = ","), `for` = "tract:*",
                             `in` = sprintf("state:%s county:*", fips), key = CENSUS_API_KEY))
    df <- .rows_to_df(.census_get(paste0(base, "?", q)), ch)
    out <- if (is.null(out)) df else merge(out, df, by = "GEOID", all = TRUE)
  }
  out
}

#' Fetch a Decennial (e.g. 2020 PL 94-171) variable for every tract in a state.
fetch_decennial_tract <- function(state_abbr, vars, year = DEC_YEAR, dataset = "dec/pl") {
  fips <- FIPS[[state_abbr]]
  base <- sprintf("https://api.census.gov/data/%d/%s", year, dataset)
  q <- .census_query(list(get = paste(vars, collapse = ","), `for` = "tract:*",
                           `in` = sprintf("state:%s county:*", fips), key = CENSUS_API_KEY))
  .rows_to_df(.census_get(paste0(base, "?", q)), vars)
}

#' Fetch ACS variables at "congressional district" geography for one state
#' (used for at-large states, which have exactly one row/district).
fetch_acs_cd <- function(state_abbr, vars, year = ACS_YEAR_MAP, dataset = "acs/acs5") {
  fips <- FIPS[[state_abbr]]
  base <- sprintf("https://api.census.gov/data/%d/%s", year, dataset)
  q <- .census_query(list(get = paste(vars, collapse = ","), `for` = "congressional district:*",
                           `in` = sprintf("state:%s", fips), key = CENSUS_API_KEY))
  m <- .census_get(paste0(base, "?", q))
  h <- m[1, ]; body <- m[-1, , drop = FALSE]
  df <- as.data.frame(body, stringsAsFactors = FALSE)
  names(df) <- h
  for (v in vars) df[[v]] <- as.numeric(df[[v]])
  df
}

#' Fetch ACS variables for every state at once.
#' Returns a data.frame with `GEOID` (2-digit state FIPS), `NAME` (full state name), + one column per variable.
fetch_acs_state <- function(vars, year = ACS_YEAR_MAP, dataset = "acs/acs5") {
  base <- sprintf("https://api.census.gov/data/%d/%s", year, dataset)
  q <- .census_query(list(get = paste(c("NAME", vars), collapse = ","), `for` = "state:*", key = CENSUS_API_KEY))
  m <- .census_get(paste0(base, "?", q))
  h <- m[1, ]; body <- m[-1, , drop = FALSE]
  df <- as.data.frame(body, stringsAsFactors = FALSE)
  names(df) <- h
  df$GEOID <- body[, h == "state"]
  for (v in vars) df[[v]] <- as.numeric(df[[v]])
  df
}
