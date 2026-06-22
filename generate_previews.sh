#!/bin/bash
# generate_previews.sh
# Generates SVG previews for all 435 congressional districts.
# Each SVG shows district boundary + clipped roads + clipped urban areas.
#
# Requires: mapshaper (npm install -g mapshaper)
#           national-cd-2026.geojson (in same directory)
#           ../../createMaps/us_can_roads.json
#           ../../createMaps/us-urban.json
#
# Output: previews/STATE-NN.svg  (e.g. previews/NY-24.svg)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
GEOJSON="$SCRIPT_DIR/national-cd-2026.geojson"
ROADS="/Users/cervas/Library/CloudStorage/GoogleDrive-jcervas@andrew.cmu.edu/My Drive/GitHub/createMaps/us_can_roads.json"
URBAN="/Users/cervas/Library/CloudStorage/GoogleDrive-jcervas@andrew.cmu.edu/My Drive/GitHub/createMaps/us-urban.json"
OUT_DIR="$SCRIPT_DIR/previews"

mkdir -p "$OUT_DIR"

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
    WI) echo 2860 ;; WY) echo 2863 ;; DC) echo 2804 ;; *) echo "" ;;
  esac
}

# Extract all state-district IDs from the GeoJSON
DISTRICTS=$(python3 -c "
import json, sys
with open('$GEOJSON') as f:
    data = json.load(f)
seen = set()
for feat in data['features']:
    p = feat['properties']
    sd = p.get('state-district')
    if sd and sd not in seen:
        seen.add(sd)
        print(sd)
" | sort)

total=$(echo "$DISTRICTS" | wc -l | tr -d ' ')
count=0
skipped=0
failed=0

echo "Generating $total district SVGs → $OUT_DIR/"
echo ""

for sd in $DISTRICTS; do
  count=$((count + 1))
  state=$(echo "$sd" | cut -d'-' -f1)
  epsg=$(state_epsg "$state")

  outsvg="${OUT_DIR}/${sd}.svg"

  # Skip if already exists (re-run friendly)
  if [[ -f "$outsvg" ]]; then
    echo "  [SKIP] $sd — already exists"
    continue
  fi

  if [[ -z "$epsg" ]]; then
    echo "  [SKIP] $sd — no EPSG for state '$state'"
    skipped=$((skipped + 1))
    continue
  fi

  mapshaper "$GEOJSON" name=district \
    -filter "this.properties['state-district'] == '${sd}'" \
    -i "$ROADS" name=roads \
    -i "$URBAN" name=urban \
    -clip source=district target=urban \
    -clip source=district target=roads \
    -proj crs=epsg:${epsg} target='*' \
    -style target=roads stroke="#aaa" stroke-width=0.6 fill=none \
    -style fill='rgba(0,0,0,0.1)' stroke=none target=urban \
    -style fill='rgba(0,0,0,0.2)' stroke='rgba(0,0,0,1)' stroke-width=1.5 target=district \
    -o "$outsvg" format=svg target='*' 2>/dev/null \
  && echo "  [OK]  ($count/$total) $sd" \
  || { echo "  [FAIL] $sd"; failed=$((failed + 1)); }

done

echo ""
echo "Done. $(ls "$OUT_DIR"/*.svg 2>/dev/null | wc -l | tr -d ' ') SVGs in $OUT_DIR/"
[[ $skipped -gt 0 ]] && echo "  Skipped (no EPSG): $skipped"
[[ $failed  -gt 0 ]] && echo "  Failed: $failed"
