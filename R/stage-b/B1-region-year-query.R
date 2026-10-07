# B1 query: region x financial year availability, eligible and registered denominators, 2011-2025.
source(file.path(Sys.getenv("LAB_ROOT"), "R", "lab.R")); lab_init()
con <- lab_duck_connect()
sql <- sprintf("
SELECT year, region_model,
       count(*) FILTER (WHERE eligible_raw = 1) AS eligible_rows,
       count(*) FILTER (WHERE eligible_raw = 1 AND original_available = 1) AS eligible_available,
       count(*) FILTER (WHERE eligible_raw = 1 AND registered_year_end) AS eligible_registered,
       count(*) FILTER (WHERE eligible_raw = 1 AND registered_year_end AND original_available = 1) AS registered_available
FROM %s GROUP BY 1, 2 ORDER BY 1, 2", lab_registry_sql())
d <- lab_query(con, sql, "B1 region x year")
lab_duck_disconnect(con)
checks <- lab_annual_checks(d)
lab_save_aggregate(d, "B1-region-year", "stage-b", sql = sql, checks = checks)
