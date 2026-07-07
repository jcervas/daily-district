#!/usr/bin/env bash
# ============================================================
# map.sh
# Packages the national 2026 district GeoJSON as a TopoJSON for the
# district-guess game.
#
# Input:  output/national-cd-2026.geojson  (from national.sh / `make national`)
#         acs_by_district.csv, acs_by_state.csv (`make acs-district acs-state`)
# Output (repo root, unchanged serving paths):
#   districts.topojson / districts-core.topojson / districts-overlay.topojson
#     Layers: districts – 435 district polygons with all properties
#             states    – state boundaries (dissolved from districts)
#             points    – one inner point per district (inside the polygon)
#             urban     – Census TIGER 2020 urbanized areas
#             roads     – simplified road network
#   state-svgs/*.svg    – one boundary outline per state
#   state-acs.json      – state-phase clue facts
#
# Requires: mapshaper >= 0.6, Rscript
#
# Usage:
#   bash map.sh
#   SIMPLIFY=0.5% bash map.sh
# ============================================================
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE"
REPO_ROOT="$(cd "$HERE/.." && pwd)"
CREATEMAPS_DIR="${CREATEMAPS_DIR:-${CREATEMAPS:-$(cd "$HERE/../../createMaps" && pwd)}}"

DISTRICTS_SRC="$HERE/output/national-cd-2026.geojson"
URBAN_SRC="$CREATEMAPS_DIR/us-urban.json"
ROADS_SRC="$CREATEMAPS_DIR/us_can_roads.json"
ACS_CSV="$HERE/acs_by_district.csv"
STATE_ACS_CSV="$HERE/acs_by_state.csv"
STATE_ACS_JSON="$REPO_ROOT/state-acs.json"
OUT="$REPO_ROOT/districts.topojson"

SIMPLIFY="${SIMPLIFY:-20%}"
STATE_SVGS="$REPO_ROOT/state-svgs"

echo "=== district-guess map builder ==="
echo "  Input:    $DISTRICTS_SRC"
echo "  Simplify: $SIMPLIFY"
echo "  Output:   $OUT"
echo ""

if [ ! -f "$DISTRICTS_SRC" ]; then
  echo "ERROR: $DISTRICTS_SRC not found."
  echo "  Run 'make national' first."
  exit 1
fi

# Use a temp directory so files can have proper .json extensions
# (macOS mktemp does not support filename suffixes like file_XXXXXX.json)
TMPWORK="$(mktemp -d /tmp/build_map_XXXXXX)"
DISTRICTS_SIMPLE="$TMPWORK/districts.json"
DISTRICTS_JOINED="$TMPWORK/districts_joined.json"
STATES="$TMPWORK/states.json"
POINTS="$TMPWORK/points.json"
URBAN_SIMPLE="$TMPWORK/urban.json"
ROADS_FC="$TMPWORK/roads_fc.json"
ROADS_SIMPLE="$TMPWORK/roads.json"
COMPACT_CSV="$TMPWORK/compactness.csv"

cleanup() { rm -rf "$TMPWORK"; }
trap cleanup EXIT

# ── Districts: simplify ───────────────────────────────────────────────────────
echo "Step 1/5  Simplifying districts..."
mapshaper "$DISTRICTS_SRC" name=districts \
  -simplify "$SIMPLIFY" keep-shapes \
  -o "$DISTRICTS_SIMPLE"

# ── Compactness + area + adjacency (shared compactness.R) + ACS join ─────────
echo "  Computing area, Polsby-Popper, Reock, and adjacency..."
Rscript compactness.R "$DISTRICTS_SIMPLE" "$COMPACT_CSV"
Rscript lib/map_join.R "$DISTRICTS_SIMPLE" "$COMPACT_CSV" "$ACS_CSV" "$DISTRICTS_JOINED"
DISTRICTS_SIMPLE="$DISTRICTS_JOINED"

# ── States: dissolve districts by state ──────────────────────────────────────
echo "Step 2/5  Dissolving state boundaries..."
mapshaper "$DISTRICTS_SIMPLE" name=districts \
  -dissolve state name=states \
  -o "$STATES"

# ── Inner points: one per district, guaranteed inside polygon ─────────────────
echo "Step 3/5  Computing inner points..."
mapshaper "$DISTRICTS_SIMPLE" name=districts \
  -points inner \
  -filter-fields state-district \
  -o "$POINTS"

# ── Urban areas ───────────────────────────────────────────────────────────────
echo "Step 4/5  Simplifying urban areas and roads..."
mapshaper "$URBAN_SRC" name=urban \
  -simplify 1% keep-shapes \
  -filter-fields 'NAME20,GEOID20' \
  -o "$URBAN_SIMPLE"

# Roads: convert GeometryCollection -> FeatureCollection, then simplify
Rscript lib/roads_to_fc.R "$ROADS_SRC" "$ROADS_FC"

mapshaper "$ROADS_FC" name=roads \
  -simplify 0.5% \
  -o "$ROADS_SIMPLE"

# ── Combine all layers into one TopoJSON ─────────────────────────────────────
echo "Step 5/5  Building TopoJSON..."

# Core file: districts + states + points (needed to start playing)
CORE_OUT="${OUT%.topojson}-core.topojson"
mapshaper \
  -i "$DISTRICTS_SIMPLE" "$STATES" "$POINTS" combine-files \
  -rename-layers districts,states,points \
  -o "$CORE_OUT" format=topojson

# Overlay file: urban + roads (decorative; lazy-loaded after game starts)
OVERLAY_OUT="${OUT%.topojson}-overlay.topojson"
mapshaper \
  -i "$URBAN_SIMPLE" "$ROADS_SIMPLE" combine-files \
  -rename-layers urban,roads \
  -o "$OVERLAY_OUT" format=topojson

# Legacy combined file (kept for backwards compatibility; uses quantization now)
mapshaper \
  -i "$CORE_OUT" "$OVERLAY_OUT" combine-files \
  -o "$OUT" format=topojson

echo ""
SIZE=$(du -sh "$OUT" | cut -f1)
CORE_SIZE=$(du -sh "$CORE_OUT" | cut -f1)
OVERLAY_SIZE=$(du -sh "$OVERLAY_OUT" | cut -f1)
echo "Done → $OUT  ($SIZE)"
echo "      → $CORE_OUT  ($CORE_SIZE)  [core — served first]"
echo "      → $OVERLAY_OUT  ($OVERLAY_SIZE)  [overlay — lazy-loaded]"
echo ""
echo "Layers:"
Rscript lib/topojson_summary.R "$OUT"

# ── State boundary SVGs: for gameover-grid and guess-icon-svg ────────────────
echo ""
echo "Step 6/7  Generating state boundary SVGs with mapshaper..."
mkdir -p "$STATE_SVGS"

# Intrinsic fallback size (px) for the root <svg>. This is only a fallback so the
# SVG never collapses to 0px when no CSS size applies — the ACTUAL displayed size
# is controlled by CSS in the browser (per usage: guess-history, gameover-grid…).
SVG_PX=200

EPSG_TABLE="$TMPWORK/epsg.txt"
Rscript lib/state_epsg.R > "$EPSG_TABLE"

# Use mapshaper to filter each state and export as SVG, then post-process so the
# SVG has a SQUARE viewBox (no distortion) and a non-scaling stroke (the outline
# stays a crisp ~1px line at whatever size CSS renders it).
for state in AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY; do
  state_lower=$(echo "$state" | tr '[:upper:]' '[:lower:]')
  svg_file="$STATE_SVGS/${state_lower}.svg"
  epsg=$(awk -v s="$state" '$1 == s { print $2 }' "$EPSG_TABLE")
  # Reproject each state into its own state-plane/Albers CRS so the outline shape
  # is undistorted; fall back to unprojected lat/lon if no EPSG is defined.
  proj_step=""
  [ -n "$epsg" ] && proj_step="-proj crs=epsg:$epsg"
  mapshaper "$STATES" name=state \
    -filter "state === '$state'" \
    $proj_step \
    -style fill=none stroke=currentColor stroke-width=1 \
    -o "$svg_file" format=svg 2>/dev/null && {
      Rscript lib/svg_postprocess.R "$svg_file" "$SVG_PX"
      echo "  $state"
    }
done

echo "State SVGs written to $STATE_SVGS/"

# ── State-level ACS clues: CSV → compact JSON keyed by state abbr ─────────────
echo ""
echo "Step 7/7  Building state-level ACS clue JSON..."
if [ -f "$STATE_ACS_CSV" ]; then
  Rscript lib/state_acs_json.R "$STATE_ACS_CSV" "$STATE_ACS_JSON"
else
  echo "  ⚠ $STATE_ACS_CSV not found — run 'make acs-state' first. Skipping."
fi
