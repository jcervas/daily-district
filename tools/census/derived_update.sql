-- Derived geometry/ranking fields for the District Profile, computed straight from
-- the DB (run after a census/map change: `make push-derived`). Two updates:
--   1. perimeter_mi  — district perimeter (PostGIS, miles), pairs with area_sqmi to
--      give Polsby-Popper compactness in the client.
--   2. census.pct    — each district's percentile rank (0..1) among all 435 for the
--      key numeric metrics; drives the "where this district ranks" tick bars.

-- 1. Perimeter (miles) from the 2026 polygons.
UPDATE puzzles p
SET census = census || jsonb_build_object(
  'perimeter_mi',
  round((ST_Perimeter(ST_GeomFromGeoJSON(g.geometry::text)::geography)/1609.344)::numeric)::int)
FROM district_geometries g
WHERE p.district_id = g.district_id;

-- 2. Percentile ranks across all districts (needs perimeter_mi from step 1).
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
    percent_rank() OVER (ORDER BY 4*pi()*(census->>'area_sqmi')::numeric/power(NULLIF((census->>'perimeter_mi')::numeric,0),2)) AS compactness
  FROM d)
UPDATE puzzles p SET census = census || jsonb_build_object('pct', jsonb_strip_nulls(jsonb_build_object(
  'income',round(r.income::numeric,3),'medianHome',round(r."medianHome"::numeric,3),'medianRent',round(r."medianRent"::numeric,3),
  'medianAge',round(r."medianAge"::numeric,3),'foreignBornPct',round(r."foreignBornPct"::numeric,3),'nonEnglishPct',round(r."nonEnglishPct"::numeric,3),
  'povertyPct',round(r."povertyPct"::numeric,3),'homeownerPct',round(r."homeownerPct"::numeric,3),'uninsuredPct',round(r."uninsuredPct"::numeric,3),
  'veteranPct',round(r."veteranPct"::numeric,3),'meanCommuteMin',round(r."meanCommuteMin"::numeric,3),'avgHHSize',round(r."avgHHSize"::numeric,3),
  'edu',round(r.edu::numeric,3),'density',round(r.density::numeric,3),'compactness',round(r.compactness::numeric,3))))
FROM r WHERE p.district_id = r.district_id;
