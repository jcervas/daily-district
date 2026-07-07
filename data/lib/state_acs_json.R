#!/usr/bin/env Rscript
# state_acs_json.R <acs_by_state.csv> <state-acs.json>
# CSV -> compact JSON keyed by state abbr, for the client's state-phase clues.
args <- commandArgs(trailingOnly = TRUE)
src <- args[1]; out <- args[2]

df <- read.csv(src, stringsAsFactors = FALSE)
num_cols <- list(pop = "integer", whiteNH_pct = "double", black_pct = "double", asian_pct = "double",
                  hispanic_pct = "double", foreignBorn_pct = "double", medianRent = "integer",
                  bachPlus_pct = "double", meanTravelTime = "double", landAreaSqMi = "integer")

data <- list()
for (i in seq_len(nrow(df))) {
  row <- df[i, ]
  rec <- list(name = row$name)
  for (k in names(num_cols)) {
    v <- row[[k]]
    rec[[k]] <- if (num_cols[[k]] == "integer") as.integer(round(v)) else as.numeric(v)
  }
  data[[row$state]] <- rec[order(names(rec))]
}
data <- data[order(names(data))]

json <- jsonlite::toJSON(data, auto_unbox = TRUE, null = "null", na = "null", digits = NA)
cat(json, file = out)
cat(sprintf("  Wrote %d states to %s\n", length(data), basename(out)))
