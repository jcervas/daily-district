#!/usr/bin/env python3
"""
build_clues.py — regenerate puzzles.clues (the 6 state + 6 district hint cards the
`today` function reveals as you guess).

Ordering (low-signal first → "basically the answer" last):
  STATE phase   : land area, median income, median rent, foreign-born, time zone,
                  delegation size
  DISTRICT phase: median age, median income, largest racial/ethnic group,
                  2024 presidential vote, population density, current representative

The STATE deck is static per state (geography + state-level ACS), precomputed here.
The DISTRICT deck is computed in SQL straight from the live `census` jsonb, so a
re-run automatically reflects any census/representative change — no per-district
data to assemble. Each card is { icon, label, value } to match the existing format.

Sources: state land area / rent / foreign-born from ../../state-acs.json; state
median income from ACS B19013; time zones static; delegation counted from
census_out.json; everything district-level from puzzles.census.

Outputs clues_update.sql (one UPDATE). Apply like the others (make push-clues).
"""
import json, os, urllib.request
from collections import Counter

HERE = os.path.dirname(__file__)
KEY  = os.environ.get("CENSUS_API_KEY", "95fe940d2fe95c12900a6f024c35f29fac6f28ee")
STATE_ACS = json.load(open(os.path.join(HERE, "..", "..", "state-acs.json")))
CENSUS    = json.load(open(os.path.join(HERE, "census_out.json")))
OUT_SQL   = os.path.join(HERE, "clues_update.sql")

FIPS = {'AL':'01','AK':'02','AZ':'04','AR':'05','CA':'06','CO':'08','CT':'09','DE':'10','FL':'12','GA':'13','HI':'15','ID':'16','IL':'17','IN':'18','IA':'19','KS':'20','KY':'21','LA':'22','ME':'23','MD':'24','MA':'25','MI':'26','MN':'27','MS':'28','MO':'29','MT':'30','NE':'31','NV':'32','NH':'33','NJ':'34','NM':'35','NY':'36','NC':'37','ND':'38','OH':'39','OK':'40','OR':'41','PA':'42','RI':'44','SC':'45','SD':'46','TN':'47','TX':'48','UT':'49','VT':'50','VA':'51','WA':'53','WV':'54','WI':'55','WY':'56'}
FIPS2ST = {v: k for k, v in FIPS.items()}
TZ = {'ME':'Eastern','NH':'Eastern','VT':'Eastern','MA':'Eastern','RI':'Eastern','CT':'Eastern','NY':'Eastern','NJ':'Eastern','PA':'Eastern','DE':'Eastern','MD':'Eastern','VA':'Eastern','WV':'Eastern','NC':'Eastern','SC':'Eastern','GA':'Eastern','FL':'Eastern','OH':'Eastern','IN':'Eastern','MI':'Eastern','KY':'Eastern','TN':'Central','AL':'Central','MS':'Central','AR':'Central','LA':'Central','MO':'Central','IL':'Central','WI':'Central','MN':'Central','IA':'Central','ND':'Central','SD':'Central','NE':'Central','KS':'Central','OK':'Central','TX':'Central','MT':'Mountain','ID':'Mountain','WY':'Mountain','CO':'Mountain','UT':'Mountain','AZ':'Mountain','NM':'Mountain','NV':'Pacific','WA':'Pacific','OR':'Pacific','CA':'Pacific','AK':'Alaska','HI':'Hawaii–Aleutian'}

def fetch_state_income():
    q = f"https://api.census.gov/data/2023/acs/acs5?get=B19013_001E&for=state:*&key={KEY}"
    with urllib.request.urlopen(q, timeout=60) as r:
        rows = json.loads(r.read())
    return {FIPS2ST[row[1]]: int(row[0]) for row in rows[1:] if row[1] in FIPS2ST}

def land_band(mi):
    return ('Small state' if mi < 10000 else 'Mid-size state' if mi < 50000
            else 'Large state' if mi < 100000 else 'Very large state')

def state_deck(st, income, deleg):
    a = STATE_ACS.get(st, {})
    land = a.get('landAreaSqMi'); rent = a.get('medianRent'); fb = a.get('foreignBorn_pct')
    deleg_val = ('At-large: only congressional district in its state' if deleg == 1
                 else f'One of {deleg} congressional districts in its state')
    return [
        {"icon":"ruler",   "label":"State land area",
         "value": f"{land_band(land)} — ~{land:,} sq mi" if land else "—"},
        {"icon":"dollar",  "label":"Median household income (state)",
         "value": f"${income:,}/yr" if income else "—"},
        {"icon":"dollar",  "label":"Median gross rent (state)",
         "value": f"${rent:,}/mo" if rent else "—"},
        {"icon":"people",  "label":"Foreign-born residents (state)",
         "value": f"{fb}% born outside the U.S." if fb is not None else "—"},
        {"icon":"clock",   "label":"Time zone",
         "value": f"{TZ.get(st,'—')} Time"},
        {"icon":"building","label":"State delegation size", "value": deleg_val},
    ]

# DISTRICT deck — computed in SQL from each row's census jsonb. Token placeholders
# are replaced with the jsonb casts so the casts read cleanly.
DISTRICT_SQL = """jsonb_build_array(
  jsonb_build_object('icon','people','label','Median age','value',
    (p.census->>'medianAge') || ' years'),
  jsonb_build_object('icon','dollar','label','Median household income','value',
    '$' || to_char((p.census->>'income')::numeric,'FM999,999') || '/yr'),
  jsonb_build_object('icon','people','label','Largest racial/ethnic group','value',
    CASE
      WHEN __W__>=__B__ AND __W__>=__A__ AND __W__>=__H__ THEN round(100*__W__/__P__)::int||'% White'||CASE WHEN __W__/__P__>0.5 THEN ' majority' ELSE ' plurality' END
      WHEN __B__>=__A__ AND __B__>=__H__ THEN round(100*__B__/__P__)::int||'% Black'||CASE WHEN __B__/__P__>0.5 THEN ' majority' ELSE ' plurality' END
      WHEN __A__>=__H__ THEN round(100*__A__/__P__)::int||'% Asian'||CASE WHEN __A__/__P__>0.5 THEN ' majority' ELSE ' plurality' END
      ELSE round(100*__H__/__P__)::int||'% Hispanic'||CASE WHEN __H__/__P__>0.5 THEN ' majority' ELSE ' plurality' END
    END),
  jsonb_build_object('icon','flag','label','2024 Presidential vote','value',
    (CASE WHEN __M__>0.30 THEN 'Strongly Democratic' WHEN __M__>0.10 THEN 'Likely Democratic'
          WHEN __M__>0.03 THEN 'Lean Democratic' WHEN __M__>=-0.03 THEN 'Competitive'
          WHEN __M__>-0.10 THEN 'Lean Republican' WHEN __M__>-0.30 THEN 'Likely Republican'
          ELSE 'Strongly Republican' END)
    || ' — ' || (CASE WHEN __M__>=0 THEN 'D+' ELSE 'R+' END)
    || to_char(round(100*abs(__M__),1),'FM990.0') || '% ('
    || round(100*__DEM__)::int || 'D / ' || round(100*__REP__)::int || 'R)'),
  jsonb_build_object('icon','ruler','label','Population density','value',
    (CASE WHEN __D__>10000 THEN 'Dense urban' WHEN __D__>2000 THEN 'Urban / suburban'
          WHEN __D__>500 THEN 'Suburban' WHEN __D__>100 THEN 'Exurban / small-town'
          ELSE 'Rural' END)
    || ' — ' || to_char(round(__D__),'FM999,999') || ' people / sq mi'),
  jsonb_build_object('icon','building','label','Current representative','value',
    (p.census->'rep'->>'name') || COALESCE(' (' || (p.census->'rep'->>'partyCode') || ')',''))
)"""

def district_sql():
    sub = {
        "__W__": "(p.census->>'whiteNH')::numeric",
        "__B__": "(p.census->>'black')::numeric",
        "__A__": "(p.census->>'asian')::numeric",
        "__H__": "(p.census->>'hispanic')::numeric",
        "__P__": "(p.census->>'pop')::numeric",
        "__M__": "(p.census->>'Margin2024Pres')::numeric",
        "__DEM__": "(p.census->>'DemPct2024Pres')::numeric",
        "__REP__": "(p.census->>'RepPct2024Pres')::numeric",
        "__D__": "((p.census->>'pop')::numeric/NULLIF((p.census->>'area_sqmi')::numeric,0))",
    }
    s = DISTRICT_SQL
    for k, v in sub.items():
        s = s.replace(k, v)
    return s

def sqllit(obj):
    return "'" + json.dumps(obj, separators=(',',':'), ensure_ascii=False).replace("'", "''") + "'"

def main():
    income = fetch_state_income()
    deleg = Counter(d[:2] for d in CENSUS)              # districts per state
    states = sorted(deleg)
    rows = [f"('{st}',{sqllit(state_deck(st, income.get(st), deleg[st]))}::jsonb)" for st in states]
    sql = ("-- Generated by build_clues.py — rebuild puzzles.clues (6 state + 6 district hints).\n"
           "-- State deck precomputed per state; district deck computed from the live census jsonb.\n"
           "UPDATE puzzles p SET clues = jsonb_build_object('state', st.deck, 'district',\n"
           + district_sql() + "\n)\n"
           "FROM (VALUES\n  " + ",\n  ".join(rows) + "\n) AS st(state, deck)\n"
           "WHERE p.state = st.state;\n")
    open(OUT_SQL, "w").write(sql)
    print(f"{len(states)} state decks + SQL district deck -> {OUT_SQL}  ({len(sql)} bytes)")

if __name__ == "__main__":
    main()
