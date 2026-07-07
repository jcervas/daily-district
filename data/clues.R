#!/usr/bin/env Rscript
# clues.R — regenerate puzzles.clues (the 6 state + 6 district hint cards the
# `today` function reveals as you guess).
#
# Ordering (low-signal first -> "basically the answer" last):
#   STATE phase   : land area, median income, median rent, foreign-born, time zone,
#                   delegation size
#   DISTRICT phase: median age, median income, largest racial/ethnic group,
#                   2024 presidential vote, population density, current representative
#
# The STATE deck is static per state (geography + state-level ACS), precomputed here.
# The DISTRICT deck is computed in SQL straight from the live `census` jsonb, so a
# re-run automatically reflects any census/representative change — no per-district
# data to assemble. Each card is { icon, label, value } to match the existing format.
#
# Sources: state land area / rent / foreign-born from ../state-acs.json; state median
# income fetched fresh from ACS B19013; time zones static; delegation counted from
# census_out.json; everything district-level from puzzles.census.
#
# Outputs clues_update.sql (one UPDATE). Apply like the others (make push-clues).

HERE <- tryCatch(dirname(sub("^--file=", "", grep("^--file=", commandArgs(FALSE), value = TRUE))), error = function(e) ".")
source(file.path(HERE, "config.R"))

STATE_ACS <- jsonlite::fromJSON(STATE_ACS_JSON, simplifyVector = FALSE)
CENSUS    <- jsonlite::fromJSON(file.path(HERE, "census_out.json"), simplifyVector = FALSE)
OUT_SQL   <- file.path(HERE, "clues_update.sql")

land_band <- function(mi) {
  if (mi < 10000) "Small state" else if (mi < 50000) "Mid-size state" else if (mi < 100000) "Large state" else "Very large state"
}

comma <- function(x) format(x, big.mark = ",", scientific = FALSE, trim = TRUE)

state_deck <- function(st, income, deleg) {
  a <- STATE_ACS[[st]]
  if (is.null(a)) a <- list()
  land <- a$landAreaSqMi; bach <- a$bachPlus_pct; fb <- a$foreignBorn_pct
  deleg_val <- if (deleg == 1) "At-large: only congressional district in its state" else sprintf("One of %d congressional districts in its state", deleg)
  list(
    list(icon = "dollar", label = "Median household income (state)",
         value = if (!is.null(income)) sprintf("$%s/yr", comma(income)) else "—"),
    list(icon = "people", label = "Foreign-born residents (state)",
         value = if (!is.null(fb)) sprintf("%s%% born outside the U.S.", fb) else "—"),
    list(icon = "people", label = "Bachelor's degree+ (state)",
         value = if (!is.null(bach)) sprintf("%s%% of adults 25+", bach) else "—"),
    list(icon = "ruler", label = "Land area (state)",
         value = if (!is.null(land)) sprintf("%s — ~%s sq mi", land_band(land), comma(land)) else "—"),
    list(icon = "clock", label = "Time zone (state)",
         value = sprintf("%s Time", if (!is.null(TZ[[st]])) TZ[[st]] else "—")),
    list(icon = "building", label = "Delegation size (state)", value = deleg_val)
  )
}

# DISTRICT deck — computed in SQL from each row's census jsonb. Token placeholders
# are replaced with the jsonb casts so the casts read cleanly.
DISTRICT_SQL <- "jsonb_build_array(
  jsonb_build_object('icon','people','label','Median age (district)','value',
    (p.census->>'medianAge') || ' years'),
  jsonb_build_object('icon','dollar','label','Median household income (district)','value',
    '$' || to_char((p.census->>'income')::numeric,'FM999,999') || '/yr'),
  jsonb_build_object('icon','people','label','Largest racial/ethnic group (district)','value',
    CASE
      WHEN __W__>=__B__ AND __W__>=__A__ AND __W__>=__H__ THEN round(100*__W__/__P__)::int||'% White'||CASE WHEN __W__/__P__>0.5 THEN ' majority' ELSE ' plurality' END
      WHEN __B__>=__A__ AND __B__>=__H__ THEN round(100*__B__/__P__)::int||'% Black'||CASE WHEN __B__/__P__>0.5 THEN ' majority' ELSE ' plurality' END
      WHEN __A__>=__H__ THEN round(100*__A__/__P__)::int||'% Asian'||CASE WHEN __A__/__P__>0.5 THEN ' majority' ELSE ' plurality' END
      ELSE round(100*__H__/__P__)::int||'% Hispanic'||CASE WHEN __H__/__P__>0.5 THEN ' majority' ELSE ' plurality' END
    END),
  jsonb_build_object('icon','flag','label','2024 Presidential vote (district)','value',
    (CASE WHEN __M__>0.30 THEN 'Strongly Democratic' WHEN __M__>0.10 THEN 'Likely Democratic'
          WHEN __M__>0.03 THEN 'Lean Democratic' WHEN __M__>=-0.03 THEN 'Competitive'
          WHEN __M__>-0.10 THEN 'Lean Republican' WHEN __M__>-0.30 THEN 'Likely Republican'
          ELSE 'Strongly Republican' END)
    || ' — ' || (CASE WHEN __M__>=0 THEN 'D+' ELSE 'R+' END)
    || to_char(round(100*abs(__M__),1),'FM990.0') || '% ('
    || round(100*__DEM__)::int || 'D / ' || round(100*__REP__)::int || 'R)'),
  jsonb_build_object('icon','ruler','label','Population density (district)','value',
    (CASE WHEN __D__>10000 THEN 'Dense urban' WHEN __D__>2000 THEN 'Urban / suburban'
          WHEN __D__>500 THEN 'Suburban' WHEN __D__>100 THEN 'Exurban / small-town'
          ELSE 'Rural' END)
    || ' — ' || to_char(round(__D__),'FM999,999') || ' people / sq mi'),
  jsonb_build_object('icon','building','label','Current representative (district)','value',
    (p.census->'rep'->>'name') || COALESCE(' (' || (p.census->'rep'->>'partyCode') || ')',''))
)"

district_sql <- function() {
  sub <- c(
    "__W__" = "(p.census->>'whiteNH')::numeric",
    "__B__" = "(p.census->>'black')::numeric",
    "__A__" = "(p.census->>'asian')::numeric",
    "__H__" = "(p.census->>'hispanic')::numeric",
    "__P__" = "(p.census->>'pop')::numeric",
    "__M__" = "(p.census->>'Margin2024Pres')::numeric",
    "__DEM__" = "(p.census->>'DemPct2024Pres')::numeric",
    "__REP__" = "(p.census->>'RepPct2024Pres')::numeric",
    "__D__" = "((p.census->>'pop')::numeric/NULLIF((p.census->>'area_sqmi')::numeric,0))"
  )
  s <- DISTRICT_SQL
  for (k in names(sub)) s <- gsub(k, sub[[k]], s, fixed = TRUE)
  s
}

income_raw <- fetch_acs_state("B19013_001E", year = ACS_YEAR_CENSUS)
income_by_state <- setNames(as.integer(income_raw$B19013_001E), unname(FIPS2ST[income_raw$GEOID]))

deleg <- table(substr(names(CENSUS), 1, 2))
states <- sort(names(deleg))

rows <- vapply(states, function(st) {
  inc <- income_by_state[st]
  deck <- state_deck(st, if (!is.na(inc)) unname(inc) else NULL, as.integer(deleg[[st]]))
  sprintf("('%s',%s)", st, jsonb_literal(deck))
}, character(1))

sql <- paste0(
  "-- Generated by clues.R — rebuild puzzles.clues (6 state + 6 district hints).\n",
  "-- State deck precomputed per state; district deck computed from the live census jsonb.\n",
  "UPDATE puzzles p SET clues = jsonb_build_object('state', st.deck, 'district',\n",
  district_sql(), "\n)\n",
  "FROM (VALUES\n  ", paste(rows, collapse = ",\n  "), "\n) AS st(state, deck)\n",
  "WHERE p.state = st.state;\n"
)
write_sql(OUT_SQL, sql, length(states), "state decks + SQL district deck")
