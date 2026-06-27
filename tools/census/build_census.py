#!/usr/bin/env python3
"""
build_census.py — aggregate ACS 5-year data to 2026 congressional districts.

Reproducible pipeline. For every district it computes the District Profile facts
by rolling Census TRACT estimates up to the district via the DRA block-assignment
files (latest year on disk per state = the map in effect for 2026).

Why tracts (not block groups): the target geography is whole congressional
districts, so tract resolution is plenty precise, and — unlike block groups —
every ACS table we need (foreign-born, health insurance, etc.) is published at
the tract level. One geography, one pass.

Method
  - block GEOID (15) -> tract GEOID (11) = first 11 chars
  - each tract -> the district its blocks mostly fall in (plurality by block count)
  - COUNT facts  : sum the tract estimates within the district
  - MEDIAN facts : aggregate the ACS bracket counts across tracts, then linear-
                   interpolate (income, home value, gross rent, age). Weighted
                   means of tract medians are 20%+ off; bracket interpolation
                   reproduces the published Census median. Validated against the
                   prior stored TX-07 population to 0.14% and race to ~1%.
  - MEAN commute : sum (bracket count * bracket midpoint) / commuters
  - at-large states (AK/DE/ND/SD/VT/WY): the whole state is district 01
  - CONNECTICUT: the block-assignment file predates CT's 2022 switch from counties
    to planning regions, so its tract GEOIDs carry the OLD county FIPS while ACS
    2023 uses the NEW ones. We remap CT crosswalk tracts to the current GEOID by
    matching the 6-digit tract number (unique for 881/884 CT tracts).

Config (env overrides)
  CENSUS_API_KEY   ACS API key            (default: project key)
  DD_ACS_YEAR      ACS 5-year vintage     (default: 2023  -> "2019-2023 ACS")
  DD_BAF_DIR       block-assignment dir   (default: the createMaps path below)
  DD_CENSUS_OUT    output json path       (default: ./census_out.json)

Usage
  python3 build_census.py                # all states  -> census_out.json
  python3 build_census.py TX CA          # just these states
Then apply with apply_census.py (writes puzzles.census, preserving the non-ACS
area_sqmi + 2024 presidential fields).
"""
import json, csv, os, sys, time, urllib.request, urllib.parse
from collections import defaultdict, Counter

KEY      = os.environ.get("CENSUS_API_KEY", "95fe940d2fe95c12900a6f024c35f29fac6f28ee")
ACS_YEAR = os.environ.get("DD_ACS_YEAR", "2023")
ACS      = f"https://api.census.gov/data/{ACS_YEAR}/acs/acs5"
BAF_DIR  = os.environ.get("DD_BAF_DIR",
    "/Users/cervas/Library/CloudStorage/GoogleDrive-jcervas@andrew.cmu.edu/My Drive/GitHub/createMaps/dra-block-assignments/2022-2026/congress")
OUT      = os.environ.get("DD_CENSUS_OUT", os.path.join(os.path.dirname(__file__), "census_out.json"))

FIPS = {'AL':'01','AK':'02','AZ':'04','AR':'05','CA':'06','CO':'08','CT':'09','DE':'10','FL':'12','GA':'13','HI':'15','ID':'16','IL':'17','IN':'18','IA':'19','KS':'20','KY':'21','LA':'22','ME':'23','MD':'24','MA':'25','MI':'26','MN':'27','MS':'28','MO':'29','MT':'30','NE':'31','NV':'32','NH':'33','NJ':'34','NM':'35','NY':'36','NC':'37','ND':'38','OH':'39','OK':'40','OR':'41','PA':'42','RI':'44','SC':'45','SD':'46','TN':'47','TX':'48','UT':'49','VT':'50','VA':'51','WA':'53','WV':'54','WI':'55','WY':'56'}
ATLARGE = {'AK','DE','ND','SD','VT','WY'}

# ---------------- median bracket definitions (lower bound, width; last open) ----------------
INC_LOWS=[0,10000,15000,20000,25000,30000,35000,40000,45000,50000,60000,75000,100000,125000,150000,200000]
INC_WIDS=[10000,5000,5000,5000,5000,5000,5000,5000,5000,10000,15000,25000,25000,25000,50000,None]
INC_VARS=[f"B19001_{i:03d}E" for i in range(2,18)]
HV_LOWS=[0,10000,15000,20000,25000,30000,35000,40000,50000,60000,70000,80000,90000,100000,125000,150000,175000,200000,250000,300000,400000,500000,750000,1000000,1500000,2000000]
HV_WIDS=[10000,5000,5000,5000,5000,5000,5000,10000,10000,10000,10000,10000,10000,25000,25000,25000,25000,50000,50000,100000,100000,250000,250000,500000,500000,None]
HV_VARS=[f"B25075_{i:03d}E" for i in range(2,28)]
RENT_LOWS=[0,100,150,200,250,300,350,400,450,500,550,600,650,700,750,800,900,1000,1250,1500,2000,2500,3000,3500]
RENT_WIDS=[100,50,50,50,50,50,50,50,50,50,50,50,50,50,50,100,100,250,250,500,500,500,500,None]
RENT_VARS=[f"B25063_{i:03d}E" for i in range(3,27)]
# B01001 sex-by-age -> single age distribution (male _003.._025 paired with female _027.._049)
AGE_BANDS=[(0,5),(5,5),(10,5),(15,3),(18,2),(20,1),(21,1),(22,3),(25,5),(30,5),(35,5),(40,5),(45,5),(50,5),(55,5),(60,2),(62,3),(65,2),(67,3),(70,5),(75,5),(80,5),(85,16)]
MALE_AGE=[f"B01001_{i:03d}E" for i in range(3,26)]
FEM_AGE =[f"B01001_{i:03d}E" for i in range(27,50)]
AGE65_VARS=["B01001_020E","B01001_021E","B01001_022E","B01001_023E","B01001_024E","B01001_025E","B01001_044E","B01001_045E","B01001_046E","B01001_047E","B01001_048E","B01001_049E"]
COMMUTE_VARS=[f"B08303_{i:03d}E" for i in range(2,14)]
COMMUTE_MID=[2.5,7,12,17,22,27,32,37,42,52,74.5,95]

COUNT={
 "pop":"B01003_001E",
 "whiteNH":"B03002_003E","blackNH":"B03002_004E","asianNH":"B03002_006E","hisp":"B03002_012E",
 "edu_total":"B15003_001E","bach":"B15003_022E","master":"B15003_023E","prof":"B15003_024E","doct":"B15003_025E",
 "fb_total":"B05002_001E","foreign_born":"B05002_013E",
 "work_total":"B08301_001E","transit":"B08301_010E","wfh":"B08301_021E",
 "occ_units":"B25003_001E","owner":"B25003_002E",
 "pov_universe":"C17002_001E","pov_lt50":"C17002_002E","pov_5099":"C17002_003E",
 "vet_universe":"B21001_001E","veterans":"B21001_002E",
 "ins_total":"B27001_001E",
 "lang_total":"C16001_001E","english_only":"C16001_002E",  # person-level (pop 5+), not households
 "pop_in_hh":"B25008_001E",
}
UNINS=[f"B27001_{i:03d}E" for i in (5,8,11,14,17,20,23,26,29,33,36,39,42,45,48,51,54,57)]
VARS=list(dict.fromkeys(list(COUNT.values())+UNINS+AGE65_VARS+COMMUTE_VARS+INC_VARS+["B19001_001E"]+HV_VARS+["B25075_001E"]+RENT_VARS+["B25063_001E"]+MALE_AGE+FEM_AGE))

def fnum(x):
    try:
        v=float(x); return v if v>-1e8 else None
    except: return None
def chunks(l,n):
    for i in range(0,len(l),n): yield l[i:i+n]
def fetch(fips,ch):
    q=urllib.parse.urlencode({"get":",".join(ch),"for":"tract:*","in":f"state:{fips} county:*","key":KEY})
    for a in range(4):
        try:
            with urllib.request.urlopen(f"{ACS}?{q}",timeout=180) as r: return json.loads(r.read())
        except Exception: time.sleep(2*(a+1))
    raise RuntimeError(f"fetch fail {fips} {ch[:2]}")
def med_brackets(c,lows,wids):
    N=sum(c)
    if N<=0: return None
    half=N/2; cum=0
    for i,x in enumerate(c):
        if cum+x>=half:
            return lows[i] if wids[i] is None else round(lows[i]+((half-cum)/x)*wids[i])
        cum+=x
    return lows[-1]
def med_age(c):
    N=sum(c)
    if N<=0: return None
    half=N/2; cum=0
    for i,(s,w) in enumerate(AGE_BANDS):
        if cum+c[i]>=half: return round(s+((half-cum)/c[i])*w,1)
        cum+=c[i]
    return None

def tract_crosswalk(state):
    """tract GEOID(11) -> plurality district number. None for at-large."""
    if state in ATLARGE: return None
    fn=max(f for f in os.listdir(BAF_DIR) if f.startswith(state+" ") and f.endswith("Congressional.csv"))
    gc=defaultdict(Counter)
    with open(os.path.join(BAF_DIR,fn)) as fh:
        r=csv.reader(fh); next(r)
        for geoid,dist in r: gc[geoid[:11]][dist]+=1
    return {g:c.most_common(1)[0][0] for g,c in gc.items()}

def build_state(state):
    fips=FIPS[state]
    xwalk=tract_crosswalk(state)
    data=defaultdict(dict)
    for ch in chunks(VARS,45):
        rows=fetch(fips,ch); h=rows[0]; ix=[h.index(c) for c in ch]
        gi=(h.index("state"),h.index("county"),h.index("tract"))
        for row in rows[1:]:
            g=row[gi[0]]+row[gi[1]]+row[gi[2]]
            for c,i in zip(ch,ix): data[g][c]=fnum(row[i])
    # CT (or any state) GEOID-vintage repair: remap crosswalk tracts to current
    # GEOIDs by 6-digit tract number when the direct GEOID join misses.
    if xwalk is not None:
        acs_tracts=set(data.keys())
        missing=[g for g in xwalk if g not in acs_tracts]
        if missing:
            by_t6=defaultdict(list)
            for g in acs_tracts: by_t6[g[5:]].append(g)
            for g in missing:
                cand=by_t6.get(g[5:])
                if cand and len(cand)==1: xwalk[cand[0]]=xwalk[g]
    A=defaultdict(lambda: defaultdict(float))
    incb=defaultdict(lambda:[0.0]*16); hvb=defaultdict(lambda:[0.0]*26)
    rentb=defaultdict(lambda:[0.0]*24); ageb=defaultdict(lambda:[0.0]*23); cmt=defaultdict(lambda:[0.0]*12)
    for g,d in data.items():
        dist='01' if state in ATLARGE else (xwalk or {}).get(g)
        if dist is None: continue
        a=A[dist]
        for n,v in COUNT.items():
            x=d.get(v)
            if x: a[n]+=x
        for v in AGE65_VARS: a["age65"]+= d.get(v) or 0
        for v in UNINS:      a["uninsured"]+= d.get(v) or 0
        for i,v in enumerate(INC_VARS):  incb[dist][i]+= d.get(v) or 0
        for i,v in enumerate(HV_VARS):   hvb[dist][i]+= d.get(v) or 0
        for i,v in enumerate(RENT_VARS): rentb[dist][i]+= d.get(v) or 0
        for i,v in enumerate(COMMUTE_VARS): cmt[dist][i]+= d.get(v) or 0
        for i,(mv,fv) in enumerate(zip(MALE_AGE,FEM_AGE)): ageb[dist][i]+=(d.get(mv) or 0)+(d.get(fv) or 0)
    out={}
    for dist,a in A.items():
        did=f"{state}-{int(dist):02d}"; pop=a["pop"]
        under18=sum(ageb[dist][0:4]); commN=sum(cmt[dist])
        pct=lambda num,den: round(100*num/den,1) if den else None
        out[did]={
            "pop":int(round(pop)),
            "whiteNH":int(round(a["whiteNH"])),"black":int(round(a["blackNH"])),"asian":int(round(a["asianNH"])),"hispanic":int(round(a["hisp"])),
            "bach":int(round(a["bach"])),"master":int(round(a["master"]+a["prof"]+a["doct"])),"edu_total":int(round(a["edu_total"])),
            "income":med_brackets(incb[dist],INC_LOWS,INC_WIDS),
            "medianHome":med_brackets(hvb[dist],HV_LOWS,HV_WIDS),
            "medianRent":med_brackets(rentb[dist],RENT_LOWS,RENT_WIDS),
            "medianAge":med_age(ageb[dist]),
            "foreignBornPct":pct(a["foreign_born"],a["fb_total"]),
            "meanCommuteMin":round(sum(c*m for c,m in zip(cmt[dist],COMMUTE_MID))/commN,1) if commN else None,
            "transitPct":pct(a["transit"],a["work_total"]),
            "wfhPct":pct(a["wfh"],a["work_total"]),
            "homeownerPct":pct(a["owner"],a["occ_units"]),
            "povertyPct":pct(a["pov_lt50"]+a["pov_5099"],a["pov_universe"]),
            "under18Pct":pct(under18,pop),
            "age65Pct":pct(a["age65"],pop),
            "veteranPct":pct(a["veterans"],a["vet_universe"]),
            "uninsuredPct":pct(a["uninsured"],a["ins_total"]),
            "nonEnglishPct":pct(a["lang_total"]-a["english_only"],a["lang_total"]),
            "avgHHSize":round(a["pop_in_hh"]/a["occ_units"],2) if a["occ_units"] else None,
        }
    return out

if __name__=="__main__":
    states=sys.argv[1:] or sorted(FIPS.keys())
    res={}
    for s in states:
        t=time.time(); st=build_state(s); res.update(st)
        print(f"{s}: {len(st)} districts ({time.time()-t:.0f}s)",flush=True)
    json.dump(res,open(OUT,"w"))
    print(f"\nTOTAL {len(res)} districts -> {OUT}")
