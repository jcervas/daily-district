#!/bin/bash
# drivetime.sh — orchestrator for "max drive time WITHOUT LEAVING THE DISTRICT".
#
# Per state: download the Geofabrik extract once, then for each district in that state
# clip the extract to the district polygon (osmium), build a small OSRM graph, and query
# the pairwise duration matrix twice off that one graph — once with ?exclude=ferry
# (road-only, the headline stat) and once without (ferry-inclusive). Then discard both the
# district graph and, at the end of the state, the state extract, so peak disk stays at
# roughly one state's worth rather than the whole country's.
#
# Resumable: a district that already has a result in $WORK/per_district is skipped, so an
# interrupted run picks up where it stopped. `make drivetime-clean` clears them.
#
# Requires: osmium-tool (brew install osmium-tool), Docker, Rscript. See data/README.md.
#
# Usage: ./drivetime.sh [STATE ...]        (default: all 50)
#   env: DD_DRIVETIME_WORK   scratch dir for extracts/graphs (default ./osrm_work)
#        DD_DRIVETIME_N      boundary sample points per district (default 24)
#        DD_DRIVETIME_PORT   host port for osrm-routed (default 5002; 5000 is often
#                            taken by macOS AirPlay Receiver)
#        DD_DRIVETIME_GEOM   district geometry source (default the raw pipeline geojson;
#                            deliberately NOT the simplified web topojson — see README)
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORK="${DD_DRIVETIME_WORK:-$HERE/osrm_work}"
NPTS="${DD_DRIVETIME_N:-24}"
PORT="${DD_DRIVETIME_PORT:-5002}"
GEOM="${DD_DRIVETIME_GEOM:-$HERE/output/national-cd-2026-raw.geojson}"
export DD_DRIVETIME_GEOM="$GEOM"

OUT_DIR="$WORK/per_district"
POLY_DIR="$WORK/polys"
LOG="$WORK/drivetime_run.log"
CONTAINER=osrm-dist
COMBINED="$HERE/drivetime_out.csv"

mkdir -p "$OUT_DIR" "$POLY_DIR"
log() { echo "[$(date '+%H:%M:%S')] $*" | tee -a "$LOG"; }

for tool in osmium docker Rscript curl; do
  command -v "$tool" >/dev/null 2>&1 || { echo "ERROR: $tool not found (see data/README.md Requirements)"; exit 1; }
done
[ -f "$GEOM" ] || { echo "ERROR: district geometry not found: $GEOM (run 'make national')"; exit 1; }

# macOS ships bash 3.2 (no associative arrays), so this is a case statement.
slug_for() {
  case "$1" in
    AL) echo alabama ;;        AK) echo alaska ;;          AZ) echo arizona ;;
    AR) echo arkansas ;;       CA) echo california ;;      CO) echo colorado ;;
    CT) echo connecticut ;;    DE) echo delaware ;;        FL) echo florida ;;
    GA) echo georgia ;;        HI) echo hawaii ;;          ID) echo idaho ;;
    IL) echo illinois ;;       IN) echo indiana ;;         IA) echo iowa ;;
    KS) echo kansas ;;         KY) echo kentucky ;;        LA) echo louisiana ;;
    ME) echo maine ;;          MD) echo maryland ;;        MA) echo massachusetts ;;
    MI) echo michigan ;;       MN) echo minnesota ;;       MS) echo mississippi ;;
    MO) echo missouri ;;       MT) echo montana ;;         NE) echo nebraska ;;
    NV) echo nevada ;;         NH) echo new-hampshire ;;   NJ) echo new-jersey ;;
    NM) echo new-mexico ;;     NY) echo new-york ;;        NC) echo north-carolina ;;
    ND) echo north-dakota ;;   OH) echo ohio ;;            OK) echo oklahoma ;;
    OR) echo oregon ;;         PA) echo pennsylvania ;;    RI) echo rhode-island ;;
    SC) echo south-carolina ;; SD) echo south-dakota ;;    TN) echo tennessee ;;
    TX) echo texas ;;          UT) echo utah ;;            VT) echo vermont ;;
    VA) echo virginia ;;       WA) echo washington ;;      WV) echo west-virginia ;;
    WI) echo wisconsin ;;      WY) echo wyoming ;;
    *) echo ""; return 1 ;;
  esac
}

ALL_STATES="AK AL AR AZ CA CO CT DE FL GA HI IA ID IL IN KS KY LA MA MD ME MI MN MO MS MT NC ND NE NH NJ NM NV NY OH OK OR PA RI SC SD TN TX UT VA VT WA WI WV WY"
STATES="${*:-$ALL_STATES}"

for ST in $STATES; do
  slug="$(slug_for "$ST")" || { log "FAIL $ST: unknown state"; continue; }

  Rscript "$HERE/drivetime_polys.R" "$ST" "$POLY_DIR" >>"$LOG" 2>&1
  todo=""
  for f in "$POLY_DIR/$ST-"*.geojson; do
    [ -e "$f" ] || continue
    did="$(basename "$f" .geojson)"
    [ -s "$OUT_DIR/$did.csv" ] || todo="$todo $did"
  done
  if [ -z "$todo" ]; then log "SKIP $ST (all districts done)"; continue; fi

  pbf="$WORK/${slug}-latest.osm.pbf"
  if [ ! -s "$pbf" ]; then
    log "=== $ST ($slug): downloading ==="
    if ! curl -fL --retry 3 -o "$pbf" "https://download.geofabrik.de/north-america/us/${slug}-latest.osm.pbf" 2>>"$LOG"; then
      log "FAIL $ST: download"; rm -f "$pbf"; continue
    fi
  fi

  for did in $todo; do
    log "--- $did: clipping ---"
    if ! osmium extract -p "$POLY_DIR/$did.geojson" "$pbf" -o "$WORK/${did}.osm.pbf" --overwrite >>"$LOG" 2>&1; then
      log "FAIL $did: osmium extract"; rm -f "$WORK/${did}.osm.pbf"; continue
    fi

    ok=1
    for step in extract partition customize; do
      case $step in
        extract)   cmd="osrm-extract -p /opt/car.lua /data/${did}.osm.pbf" ;;
        partition) cmd="osrm-partition /data/${did}.osrm" ;;
        customize) cmd="osrm-customize /data/${did}.osrm" ;;
      esac
      if ! docker run --rm -t -v "$WORK:/data" osrm/osrm-backend $cmd >>"$LOG" 2>&1; then
        log "FAIL $did: osrm-$step"; ok=0; break
      fi
    done
    if [ "$ok" -ne 1 ]; then rm -f "$WORK/${did}".osm.pbf "$WORK/${did}".osrm*; continue; fi

    docker rm -f "$CONTAINER" >/dev/null 2>&1
    docker run -d --name "$CONTAINER" -p "$PORT:5000" -v "$WORK:/data" osrm/osrm-backend \
      osrm-routed --algorithm mld --max-table-size 10000 "/data/${did}.osrm" >>"$LOG" 2>&1

    ready=0
    for _ in $(seq 1 30); do
      if curl -s "http://localhost:${PORT}/nearest/v1/driving/-77,38" 2>/dev/null | grep -q '"code"'; then ready=1; break; fi
      sleep 1
    done
    if [ "$ready" -ne 1 ]; then
      log "FAIL $did: osrm-routed not ready"
      docker rm -f "$CONTAINER" >/dev/null 2>&1
      rm -f "$WORK/${did}".osm.pbf "$WORK/${did}".osrm*
      continue
    fi

    if (cd "$HERE" && Rscript drivetime.R "$did" "http://localhost:${PORT}" "$NPTS" "$OUT_DIR/$did.csv") >>"$LOG" 2>&1; then
      log "OK $did"
    else
      log "FAIL $did: drivetime.R"
    fi

    docker rm -f "$CONTAINER" >/dev/null 2>&1
    rm -f "$WORK/${did}".osm.pbf "$WORK/${did}".osrm*
  done

  rm -f "$pbf"
  log "=== $ST complete ==="
done

shopt -s nullglob
csvs=("$OUT_DIR"/*.csv)
if [ ${#csvs[@]} -eq 0 ]; then log "no per-district results to combine"; exit 1; fi
log "=== combining ${#csvs[@]} districts -> drivetime_out.csv ==="
{
  head -1 "${csvs[0]}"
  for f in "${csvs[@]}"; do tail -n +2 "$f"; done | sort -t, -k1,1
} > "$COMBINED"
log "$(($(wc -l < "$COMBINED") - 1)) districts -> $COMBINED"
nfail=$(grep -c " FAIL " "$LOG" || true)
log "=== DONE: $nfail failure line(s) in $LOG ==="
