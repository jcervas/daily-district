#!/usr/bin/env bash
# ============================================================
# build-map.sh
# Packages the national 2026 district GeoJSON as a TopoJSON
# for the district-guess game.
#
# Input:  createMaps/national/output/national-cd-2026.geojson
# Output: districts.topojson  (served alongside index.html)
#   Layers:
#     districts  – 435 district polygons with all properties
#     states     – state boundaries (dissolved from districts)
#     points     – one inner point per district (inside the polygon)
#     urban      – Census TIGER 2020 urbanized areas
#     roads      – simplified road network
#
# Requires: mapshaper ≥ 0.6, python3
#
# Usage:
#   bash build-map.sh
#   SIMPLIFY=0.5% bash build-map.sh
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CREATEMAPS="$(cd "$SCRIPT_DIR/../../../createMaps" && pwd)"

DISTRICTS_SRC="$CREATEMAPS/national/output/national-cd-2026.geojson"
URBAN_SRC="$CREATEMAPS/us-urban.json"
ROADS_SRC="$CREATEMAPS/us_can_roads.json"
ACS_CSV="$CREATEMAPS/acs_by_district.csv"
STATE_ACS_CSV="$CREATEMAPS/acs_by_state.csv"   # produced by createMaps/acs_by_state.R
STATE_ACS_JSON="$SCRIPT_DIR/state-acs.json"
OUT="$SCRIPT_DIR/districts.topojson"

SIMPLIFY="20%"
STATE_SVGS="$SCRIPT_DIR/state-svgs"

# ── State EPSG codes (from createMaps/compactness/compactness.sh) ─────────────
state_epsg() {
  case "$1" in
    AL) echo 2759 ;; AK) echo 3338 ;; AZ) echo 2762 ;; AR) echo 2764 ;;
    CA) echo 3311 ;; CO) echo 2773 ;; CT) echo 2775 ;; DE) echo 2776 ;;
    FL) echo 2777 ;; GA) echo 2780 ;; HI) echo 2784 ;; ID) echo 2788 ;;
    IL) echo 2790 ;; IN) echo 2792 ;; IA) echo 2794 ;; KS) echo 2796 ;;
    KY) echo 2798 ;; LA) echo 2800 ;; ME) echo 2802 ;; MD) echo 2804 ;;
    MA) echo 2805 ;; MI) echo 2808 ;; MN) echo 2811 ;; MS) echo 2813 ;;
    MO) echo 2816 ;; MT) echo 2818 ;; NE) echo 2819 ;; NV) echo 2821 ;;
    NH) echo 2823 ;; NJ) echo 2824 ;; NM) echo 2826 ;; NY) echo 2829 ;;
    NC) echo 3358 ;; ND) echo 2832 ;; OH) echo 2834 ;; OK) echo 2836 ;;
    OR) echo 2838 ;; PA) echo 3362 ;; RI) echo 2840 ;; SC) echo 3360 ;;
    SD) echo 2841 ;; TN) echo 2843 ;; TX) echo 2845 ;; UT) echo 2850 ;;
    VT) echo 2852 ;; VA) echo 2853 ;; WA) echo 2855 ;; WV) echo 2857 ;;
    WI) echo 2860 ;; WY) echo 2863 ;; *) echo "" ;;
  esac
}

echo "=== district-guess map builder ==="
echo "  Input:    $DISTRICTS_SRC"
echo "  Simplify: $SIMPLIFY"
echo "  Output:   $OUT"
echo ""

if [ ! -f "$DISTRICTS_SRC" ]; then
  echo "ERROR: $DISTRICTS_SRC not found."
  echo "  Run createMaps/national/build_national.sh first."
  exit 1
fi

# Use a temp directory so files can have proper .json extensions
# (macOS mktemp does not support filename suffixes like file_XXXXXX.json)
TMPWORK="$(mktemp -d /tmp/build_map_XXXXXX)"
DISTRICTS_SIMPLE="$TMPWORK/districts.json"
STATES="$TMPWORK/states.json"
POINTS="$TMPWORK/points.json"
URBAN_SIMPLE="$TMPWORK/urban.json"
ROADS_FC="$TMPWORK/roads_fc.json"
ROADS_SIMPLE="$TMPWORK/roads.json"

cleanup() { rm -rf "$TMPWORK"; }
trap cleanup EXIT

# ── Districts: simplify ───────────────────────────────────────────────────────
echo "Step 1/5  Simplifying districts..."
mapshaper "$DISTRICTS_SRC" name=districts \
  -simplify "$SIMPLIFY" keep-shapes \
  -o "$DISTRICTS_SIMPLE"

# ── Compactness + area via R redist package ───────────────────────────────────
DISTRICTS_WITH_COMPACT="$TMPWORK/districts_compact.json"
echo "  Computing area, Polsby-Popper, and Reock via R redist..."
Rscript - "$DISTRICTS_SIMPLE" "$DISTRICTS_WITH_COMPACT" "$ACS_CSV" <<'REOF'
args <- commandArgs(trailingOnly = TRUE)
suppressPackageStartupMessages({
  library(sf)
  library(redistmetrics)
})

shp <- st_read(args[1], quiet = TRUE)
shp_proj <- st_transform(shp, 5070)   # NAD83 / Conus Albers (equal-area)
shp_proj <- st_make_valid(shp_proj)

# Each row is its own district; plans vector = 1:nrow
plans <- seq_len(nrow(shp_proj))

shp$area_sqmi     <- round(as.numeric(st_area(shp_proj)) / 2589988.11)
shp$polsby_popper <- round(comp_polsby(plans, shp_proj), 4)
shp$reock         <- round(comp_reock(plans, shp_proj), 4)

# R replaces hyphens in column names with dots — restore original name
names(shp)[names(shp) == "state.district"] <- "state-district"

# Adjacency: pipe-separated list of neighboring state-district keys
adj_touches <- sf::st_touches(shp, sparse = TRUE)
ids <- shp[["state-district"]]
shp$adj <- sapply(seq_along(adj_touches), function(i) {
  paste(ids[adj_touches[[i]]], collapse = "|")
})
cat(sprintf("  Adjacency computed for %d districts.\n", nrow(shp)))

# Join ACS data if CSV path provided and exists
if (length(args) >= 3 && file.exists(args[3])) {
  acs <- read.csv(args[3], stringsAsFactors = FALSE, check.names = FALSE)
  shp <- merge(shp, acs[, c("state-district","pop","income","medianHome",
                              "whiteNH","black","asian","hispanic","bach","master")],
               by = "state-district", all.x = TRUE)
  cat(sprintf("  ACS data joined for %d districts.\n", sum(!is.na(shp$pop))))
}

st_write(shp, args[2], driver = "GeoJSON", delete_dsn = TRUE, quiet = TRUE)
cat(sprintf("  area/PP/Reock written for %d districts.\n", nrow(shp)))
REOF
DISTRICTS_SIMPLE="$DISTRICTS_WITH_COMPACT"

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

# Roads: convert GeometryCollection → FeatureCollection, then simplify
python3 - "$ROADS_SRC" "$ROADS_FC" <<'PYEOF'
import json, sys
with open(sys.argv[1]) as f:
    data = json.load(f)
if data.get('type') == 'GeometryCollection':
    features = [{'type': 'Feature', 'properties': {}, 'geometry': g}
                for g in data.get('geometries', [])]
elif data.get('type') == 'FeatureCollection':
    features = data['features']
else:
    features = []
fc = {'type': 'FeatureCollection', 'features': features}
with open(sys.argv[2], 'w') as f:
    json.dump(fc, f)
print(f"  Roads: {len(features)} geometries ready.")
PYEOF

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
python3 - "$OUT" <<'PYEOF'
import json, sys
with open(sys.argv[1]) as f:
    topo = json.load(f)
for name, obj in topo.get('objects', {}).items():
    n = len(obj.get('geometries', []))
    print(f"  {name:<14} {n} geometries")
PYEOF

# ── State boundary SVGs: for gameover-grid and guess-icon-svg ────────────────
echo ""
echo "Step 6/7  Generating state boundary SVGs with mapshaper..."
mkdir -p "$STATE_SVGS"

# Intrinsic fallback size (px) for the root <svg>. This is only a fallback so the
# SVG never collapses to 0px when no CSS size applies — the ACTUAL displayed size
# is controlled by CSS in the browser (per usage: guess-history, gameover-grid…).
SVG_PX=200

# Use mapshaper to filter each state and export as SVG, then post-process so the
# SVG has a SQUARE viewBox (no distortion) and a non-scaling stroke (the outline
# stays a crisp ~1px line at whatever size CSS renders it).
for state in AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY; do
  state_lower=$(echo "$state" | tr '[:upper:]' '[:lower:]')
  svg_file="$STATE_SVGS/${state_lower}.svg"
  epsg=$(state_epsg "$state")
  # Reproject each state into its own state-plane/Albers CRS so the outline shape
  # is undistorted; fall back to unprojected lat/lon if no EPSG is defined.
  proj_step=""
  [ -n "$epsg" ] && proj_step="-proj crs=epsg:$epsg"
  mapshaper "$STATES" name=state \
    -filter "state === '$state'" \
    $proj_step \
    -style fill=none stroke=currentColor stroke-width=1 \
    -o "$svg_file" format=svg 2>/dev/null && {
      SVG_PX="$SVG_PX" python3 - "$svg_file" <<'EOF'
import os, re, sys
svg_path = sys.argv[1]
px = float(os.environ.get("SVG_PX", "20"))
with open(svg_path) as f:
    content = f.read()
m = re.search(r'viewBox="([0-9.eE+-]+)\s+([0-9.eE+-]+)\s+([0-9.eE+-]+)\s+([0-9.eE+-]+)"', content)
if m:
    x, y, w, h = [float(v) for v in m.groups()]
    # Make a square viewBox by expanding the smaller dimension symmetrically.
    side = max(w, h)
    pad = side * 0.08            # breathing room so the stroke isn't clipped
    side_p = side + pad * 2
    cx, cy = x + w / 2, y + h / 2
    nx, ny = cx - side_p / 2, cy - side_p / 2
    content = re.sub(r'viewBox="[^"]*"',
                     f'viewBox="{nx:.3f} {ny:.3f} {side_p:.3f} {side_p:.3f}"',
                     content)
    # Force explicit pixel dimensions on the root <svg> so it has intrinsic size.
    content = re.sub(r'\s+width="[^"]*"',  '', content, count=1)
    content = re.sub(r'\s+height="[^"]*"', '', content, count=1)
    content = re.sub(r'<svg ',
                     f'<svg width="{px:g}" height="{px:g}" ',
                     content, count=1)
    # Use a non-scaling stroke so the outline renders at a constant ~1px no matter
    # what size CSS displays the SVG at. stroke-width is then in final device px.
    content = re.sub(r'stroke-width="[^"]*"', 'stroke-width="1"', content)
    content = re.sub(r'(<path\b)(?![^>]*vector-effect)',
                     r'\1 vector-effect="non-scaling-stroke"', content)
    with open(svg_path, 'w') as f:
        f.write(content)
EOF
      echo "  $state"
    }
done

echo "State SVGs written to $STATE_SVGS/"

# ── State-level ACS clues: CSV → compact JSON keyed by state abbr ─────────────
echo ""
echo "Step 7/7  Building state-level ACS clue JSON..."
if [ -f "$STATE_ACS_CSV" ]; then
  STATE_ACS_CSV="$STATE_ACS_CSV" STATE_ACS_JSON="$STATE_ACS_JSON" python3 - <<'PYEOF'
import csv, json, os
src = os.environ["STATE_ACS_CSV"]
out = os.environ["STATE_ACS_JSON"]
num = {"pop": int, "whiteNH_pct": float, "black_pct": float, "asian_pct": float,
       "hispanic_pct": float, "foreignBorn_pct": float, "medianRent": int,
       "bachPlus_pct": float, "meanTravelTime": float, "landAreaSqMi": int}
data = {}
with open(src) as f:
    for row in csv.DictReader(f):
        rec = {"name": row["name"]}
        for k, cast in num.items():
            rec[k] = cast(row[k])
        data[row["state"]] = rec
with open(out, "w") as f:
    json.dump(data, f, separators=(",", ":"), sort_keys=True)
print(f"  Wrote {len(data)} states to {os.path.basename(out)}")
PYEOF
else
  echo "  ⚠ $STATE_ACS_CSV not found — run createMaps/acs_by_state.R first. Skipping."
fi
