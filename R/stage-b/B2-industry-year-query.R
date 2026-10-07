# B2 query: two-digit industry x financial year availability, 2011-2025.
source(file.path(Sys.getenv("LAB_ROOT"), "R", "lab.R")); lab_init()
con <- lab_duck_connect()
sql <- sprintf("
SELECT year, coalesce(industry2, '__MALFORMED__') AS industry2,
       count(*) FILTER (WHERE eligible_raw = 1) AS eligible_rows,
       count(*) FILTER (WHERE eligible_raw = 1 AND original_available = 1) AS eligible_available,
       count(*) FILTER (WHERE eligible_raw = 1 AND registered_year_end) AS eligible_registered,
       count(*) FILTER (WHERE eligible_raw = 1 AND registered_year_end AND original_available = 1) AS registered_available
FROM %s GROUP BY 1, 2 ORDER BY 1, 2", lab_registry_sql())
d <- lab_query(con, sql, "B2 industry x year")
lab_duck_disconnect(con)
lab_save_aggregate(d, "B2-industry-year", "stage-b", sql = sql, checks = lab_annual_checks(d))
