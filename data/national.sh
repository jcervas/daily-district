#!/usr/bin/env bash
# ============================================================
# national.sh
# Combines per-state congressional district plans into a single
# national GeoJSON and SVG for each plan year.
#
# Outputs per year (2022, 2024, 2026):
#   output/national-cd-{year}.geojson   clipped, cleaned GeoJSON
#   output/national-cd-{year}.svg       overview map colored by 2024 vote
#
# Does NOT add compactness, area, or centroids — those are computed by
# compactness.R in the map.sh (`make map`) stage.
#
# Requires: mapshaper >= 0.6, Rscript
# ============================================================
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE"

# createMaps is a sibling repo (…/GitHub/createMaps). Override with $CREATEMAPS_DIR
# (or legacy $CREATEMAPS) — same convention config.R uses for the R scripts.
CREATEMAPS_DIR="${CREATEMAPS_DIR:-${CREATEMAPS:-$(cd "$HERE/../../createMaps" && pwd)}}"
US_STATE_JSON="$CREATEMAPS_DIR/us-state.json"

OUT_DIR="$HERE/output"
mkdir -p "$OUT_DIR"

echo "--- Step 0: Normalize per-state plan files ---"
Rscript normalize_plans.R

for YEAR in 2022 2024 2026; do
  echo "========================================"
  echo "=== Building $YEAR national map ==="
  echo "========================================"

  RAW="$OUT_DIR/national-cd-${YEAR}-raw.geojson"
  OUT="$OUT_DIR/national-cd-${YEAR}.geojson"
  SVG="$OUT_DIR/national-cd-${YEAR}.svg"

  echo "--- Step 1: Combine per-state files ---"
  Rscript build_national.R --year "$YEAR"

  echo ""
  echo "--- Step 2: Clip water and clean ---"
  mapshaper \
    -i "$RAW" name=cd \
    -i "$US_STATE_JSON" name=us-state \
    -dissolve target=us-state \
    -clip target=cd source=us-state \
    -clean target=cd \
    -o "$OUT" target=cd format=geojson

  echo ""
  echo "--- Step 3: Generate SVG (colored by 2024 presidential vote) ---"
  mapshaper \
    -i "$OUT" name=cd \
    -proj albersusa \
    -each 'Party = Margin2024Pres > 0 ? "DEM" : "GOP"' target=cd \
    -each 'winning_pct = Party === "DEM" ? DemPct2024Pres * 100 : RepPct2024Pres * 100' target=cd \
    -each 'color = Party === "DEM" ? (winning_pct >= 60 ? "#1375B7" : winning_pct >= 55 ? "#5295CC" : winning_pct >= 50 ? "#92BDE0" : "#CEEAFD") : (winning_pct >= 60 ? "#C93135" : winning_pct >= 55 ? "#DB7171" : winning_pct >= 50 ? "#EAA9A9" : "#FCE0E0")' target=cd \
    -style fill=color opacity=0.8 stroke=none target=cd \
    -lines + name=district-lines \
    -style stroke='rgba(255,255,255,0.25)' stroke-width='TYPE=="inner" ? 0.5 : 0' fill=none target=district-lines \
    -dissolve state + name=state target=cd \
    -lines + name=state-lines target=state \
    -style stroke='#c5c5c5' stroke-width='TYPE=="inner" ? 1 : 0.7' fill=none target=state-lines \
    -filter 'changed === 1' + name=changed-states target=cd \
    -dissolve state target=changed-states \
    -style stroke='#000000' stroke-width=1.5 fill=none target=changed-states \
    -drop target=state \
    -dissolve target=cd fill \
    -simplify 5% \
    -o "$SVG" target=cd,state-lines,district-lines,changed-states format=svg

  echo ""
  echo "--- Step 4: District seat count ---"
  mapshaper -i "$OUT" -calc 'dem=sum(Margin2024Pres > 0 ? 1 : 0); rep=sum(Margin2024Pres < 0 ? 1 : 0)'

  echo ""
  echo "Done → $OUT"
  echo "Done → $SVG"
  echo ""
done

echo "All years complete."
echo "Next: run 'make map' to package the current year's map for the game."
