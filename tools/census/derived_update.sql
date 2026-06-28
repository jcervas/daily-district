-- Percentile-rank fields for the District Profile, computed straight from the DB
-- (run after a census/map change: `make push-derived`).
--   census.pct — each district's percentile rank (0..1) among all 435 for the key
--   numeric metrics; drives the "where this district ranks" tick bars.
--
-- The shape metrics this reads (area_sqmi, perimeter_mi, reock) are now computed in R
-- (compactness.R + apply_compactness.py -> make push-compactness), NOT PostGIS. Run
-- push-compactness before push-derived so the percentiles see fresh shape values.

-- Percentile ranks across all districts.
WITH d AS (SELECT DISTINCT ON (district_id) district_id, census FROM puzzles),
r AS (
  SELECT district_id,
    percent_rank() OVER (ORDER BY (census->>'income')::numeric)        AS income,
    percent_rank() OVER (ORDER BY (census->>'medianHome')::numeric)    AS "medianHome",
    percent_rank() OVER (ORDER BY (census->>'medianRent')::numeric)    AS "medianRent",
    percent_rank() OVER (ORDER BY (census->>'medianAge')::numeric)     AS "medianAge",
    percent_rank() OVER (ORDER BY (census->>'foreignBornPct')::numeric)AS "foreignBornPct",
    percent_rank() OVER (ORDER BY (census->>'nonEnglishPct')::numeric) AS "nonEnglishPct",
    percent_rank() OVER (ORDER BY (census->>'povertyPct')::numeric)    AS "povertyPct",
    percent_rank() OVER (ORDER BY (census->>'homeownerPct')::numeric)  AS "homeownerPct",
    percent_rank() OVER (ORDER BY (census->>'uninsuredPct')::numeric)  AS "uninsuredPct",
    percent_rank() OVER (ORDER BY (census->>'veteranPct')::numeric)    AS "veteranPct",
    percent_rank() OVER (ORDER BY (census->>'meanCommuteMin')::numeric)AS "meanCommuteMin",
    percent_rank() OVER (ORDER BY (census->>'avgHHSize')::numeric)     AS "avgHHSize",
    percent_rank() OVER (ORDER BY ((census->>'bach')::numeric+(census->>'master')::numeric)/NULLIF((census->>'edu_total')::numeric,0)) AS edu,
    percent_rank() OVER (ORDER BY (census->>'pop')::numeric/NULLIF((census->>'area_sqmi')::numeric,0)) AS density,
    percent_rank() OVER (ORDER BY 4*pi()*(census->>'area_sqmi')::numeric/power(NULLIF((census->>'perimeter_mi')::numeric,0),2)) AS compactness,
    percent_rank() OVER (ORDER BY (census->>'reock')::numeric) AS reock,
    percent_rank() OVER (ORDER BY ((census->>'pop')::numeric-(census->>'pop2020')::numeric)/NULLIF((census->>'pop2020')::numeric,0)) AS "popChange",
    percent_rank() OVER (ORDER BY (census->>'area_sqmi')::numeric)    AS area,
    percent_rank() OVER (ORDER BY (census->>'perimeter_mi')::numeric) AS perimeter,
    percent_rank() OVER (ORDER BY (census->>'Margin2024Pres')::numeric) AS margin
  FROM d)
UPDATE puzzles p SET census = census || jsonb_build_object('pct', jsonb_strip_nulls(jsonb_build_object(
  'income',round(r.income::numeric,3),'medianHome',round(r."medianHome"::numeric,3),'medianRent',round(r."medianRent"::numeric,3),
  'medianAge',round(r."medianAge"::numeric,3),'foreignBornPct',round(r."foreignBornPct"::numeric,3),'nonEnglishPct',round(r."nonEnglishPct"::numeric,3),
  'povertyPct',round(r."povertyPct"::numeric,3),'homeownerPct',round(r."homeownerPct"::numeric,3),'uninsuredPct',round(r."uninsuredPct"::numeric,3),
  'veteranPct',round(r."veteranPct"::numeric,3),'meanCommuteMin',round(r."meanCommuteMin"::numeric,3),'avgHHSize',round(r."avgHHSize"::numeric,3),
  'edu',round(r.edu::numeric,3),'density',round(r.density::numeric,3),'compactness',round(r.compactness::numeric,3),
  'reock',round(r.reock::numeric,3),'popChange',round(r."popChange"::numeric,3),
  'area',round(r.area::numeric,3),'perimeter',round(r.perimeter::numeric,3),'margin',round(r.margin::numeric,3))))
FROM r WHERE p.district_id = r.district_id;
