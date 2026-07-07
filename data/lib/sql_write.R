# lib/sql_write.R — shared SQL-literal helpers for the *.R scripts that generate
# puzzles.<col> UPDATE statements (census.R, apply_census.R, apply_compactness.R,
# reps.R, clues.R, pop2020.R, lang.R, plan_year.R).

#' R list/vector -> a Postgres jsonb string literal, e.g. '{"a":1}'::jsonb
jsonb_literal <- function(x) {
  j <- jsonlite::toJSON(x, auto_unbox = TRUE, null = "null", na = "null", digits = NA)
  paste0("'", gsub("'", "''", j, fixed = TRUE), "'::jsonb")
}

#' Quote+escape a plain (non-jsonb) SQL string literal.
sql_literal <- function(x) paste0("'", gsub("'", "''", x, fixed = TRUE), "'")

#' Write `sql` to `path` and print the same one-line confirmation every apply_*.py
#' used to print (row count, destination, byte size).
write_sql <- function(path, sql, n, label = "rows") {
  con <- file(path, "wb")
  on.exit(close(con))
  writeChar(sql, con, eos = NULL)
  cat(sprintf("%d %s -> %s  (%d bytes)\n", n, label, path, nchar(sql, type = "bytes")))
}
