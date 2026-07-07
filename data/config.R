# config.R — shared paths, API config, and state lookup tables for the data/ pipeline.
#
# Every top-level script sources this first:
#   HERE <- tryCatch(dirname(sub("^--file=", "", grep("^--file=", commandArgs(FALSE), value = TRUE))), error = function(e) ".")
#   source(file.path(HERE, "config.R"))
#
# config.R itself sources lib/census_api.R, lib/acs_helpers.R, lib/sql_write.R, so one
# source() call is all any script needs.

if (!exists("HERE")) HERE <- "."
HERE <- normalizePath(HERE, mustWork = FALSE)

# ---- Repo layout ------------------------------------------------------------
REPO_ROOT <- normalizePath(file.path(HERE, ".."), mustWork = FALSE)

# createMaps is a sibling repo holding the raw/shared redistricting source data
# (per-state plans, block-assignment files, base map layers) used by many
# projects beyond this game. Override with $CREATEMAPS_DIR (or legacy $CREATEMAPS).
CREATEMAPS_DIR <- Sys.getenv("CREATEMAPS_DIR",
  Sys.getenv("CREATEMAPS", normalizePath(file.path(REPO_ROOT, "..", "createMaps"), mustWork = FALSE)))

PLANS_DIR      <- file.path(CREATEMAPS_DIR, "Congressional-Plans")
BAF_DIR        <- Sys.getenv("DD_BAF_DIR", file.path(CREATEMAPS_DIR, "dra-block-assignments", "2022-2026", "congress"))
US_STATE_JSON  <- file.path(CREATEMAPS_DIR, "us-state.json")
US_URBAN_JSON  <- file.path(CREATEMAPS_DIR, "us-urban.json")
US_ROADS_JSON  <- file.path(CREATEMAPS_DIR, "us_can_roads.json")

# Game-specific input, small enough to live in this repo.
DOWNBALLOT_CSV <- file.path(HERE, "downballot_2024.csv")

# Intermediate national-map build output (per-year raw/clipped GeoJSON + SVG).
NATIONAL_OUT_DIR <- file.path(HERE, "output")

# Final served outputs — repo root, unchanged paths (script.js fetches these relative
# to index.html; data/ holds the build scripts, not the served files).
DISTRICTS_TOPOJSON <- file.path(REPO_ROOT, "districts.topojson")
DISTRICTS_CORE     <- file.path(REPO_ROOT, "districts-core.topojson")
DISTRICTS_OVERLAY  <- file.path(REPO_ROOT, "districts-overlay.topojson")
STATE_ACS_JSON     <- file.path(REPO_ROOT, "state-acs.json")
STATE_SVGS_DIR     <- file.path(REPO_ROOT, "state-svgs")

# ---- Census API ---------------------------------------------------------------
CENSUS_API_KEY  <- Sys.getenv("CENSUS_API_KEY", "95fe940d2fe95c12900a6f024c35f29fac6f28ee")
ACS_YEAR_MAP    <- as.integer(Sys.getenv("DD_ACS_YEAR_MAP", "2024"))  # acs_by_district.R / acs_by_state.R
ACS_YEAR_CENSUS <- as.integer(Sys.getenv("DD_ACS_YEAR", "2023"))      # census.R / lang.R (District Profile)
DEC_YEAR        <- 2020L                                             # pop2020.R (Decennial PL 94-171)

# ---- State lookup tables (hardcoded — no tigris) -------------------------------
FIPS <- c(AL="01",AK="02",AZ="04",AR="05",CA="06",CO="08",CT="09",DE="10",DC="11",FL="12",GA="13",
          HI="15",ID="16",IL="17",IN="18",IA="19",KS="20",KY="21",LA="22",ME="23",MD="24",
          MA="25",MI="26",MN="27",MS="28",MO="29",MT="30",NE="31",NV="32",NH="33",NJ="34",
          NM="35",NY="36",NC="37",ND="38",OH="39",OK="40",OR="41",PA="42",RI="44",SC="45",
          SD="46",TN="47",TX="48",UT="49",VT="50",VA="51",WA="53",WV="54",WI="55",WY="56",
          PR="72")
# DC/PR are included for the acs_by_state.R state-facts table (matches the ACS API's
# state-geography response + the existing committed acs_by_state.csv) but are not
# congressional-district states, so they're absent from AT_LARGE/the BAF pipeline.
FIPS2ST  <- setNames(names(FIPS), FIPS)
AT_LARGE <- c("AK","DE","ND","SD","VT","WY")

TZ <- c(ME="Eastern",NH="Eastern",VT="Eastern",MA="Eastern",RI="Eastern",CT="Eastern",NY="Eastern",
        NJ="Eastern",PA="Eastern",DE="Eastern",MD="Eastern",VA="Eastern",WV="Eastern",NC="Eastern",
        SC="Eastern",GA="Eastern",FL="Eastern",OH="Eastern",IN="Eastern",MI="Eastern",KY="Eastern",
        TN="Central",AL="Central",MS="Central",AR="Central",LA="Central",MO="Central",IL="Central",
        WI="Central",MN="Central",IA="Central",ND="Central",SD="Central",NE="Central",KS="Central",
        OK="Central",TX="Central",MT="Mountain",ID="Mountain",WY="Mountain",CO="Mountain",UT="Mountain",
        AZ="Mountain",NM="Mountain",NV="Pacific",WA="Pacific",OR="Pacific",CA="Pacific",
        AK="Alaska",HI="Hawaii–Aleutian")

# State-plane/Albers EPSG per state, for undistorted per-state SVG projections.
# (Previously duplicated verbatim in compactness.sh and build-map.sh; single copy now.)
EPSG_STATE <- c(AL=2759,AK=3338,AZ=2762,AR=2764,CA=3311,CO=2773,CT=2775,DE=2776,FL=2777,GA=2780,
                HI=2784,ID=2788,IL=2790,IN=2792,IA=2794,KS=2796,KY=2798,LA=2800,ME=2802,MD=2804,
                MA=2805,MI=2808,MN=2811,MS=2813,MO=2816,MT=2818,NE=2819,NV=2821,NH=2823,NJ=2824,
                NM=2826,NY=2829,NC=3358,ND=2832,OH=2834,OK=2836,OR=2838,PA=3362,RI=2840,SC=3360,
                SD=2841,TN=2843,TX=2845,UT=2850,VT=2852,VA=2853,WA=2855,WV=2857,WI=2860,WY=2863)

source(file.path(HERE, "lib", "census_api.R"))
source(file.path(HERE, "lib", "acs_helpers.R"))
source(file.path(HERE, "lib", "sql_write.R"))
