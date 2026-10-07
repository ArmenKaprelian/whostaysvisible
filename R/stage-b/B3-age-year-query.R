# B3 query: availability by financial year and firm age at year-end (0-30, 30+, unknown), eligible denominator.
source(file.path(Sys.getenv("LAB_ROOT"), "R", "lab.R")); lab_init()
con <- lab_duck_connect()
sql <- sprintf("
SELECT year,
       CASE WHEN invalid_age = 1 OR age_year_end IS NULL THEN -1 ELSE least(floor(age_year_end), 30) END AS age_band,
       age_source,
       count(*) FILTER (WHERE eligible_raw = 1) AS eligible_rows,
       count(*) FILTER (WHERE eligible_raw = 1 AND original_available = 1) AS eligible_available
FROM %s GROUP BY 1, 2, 3 ORDER BY 1, 2, 3", lab_registry_sql())
d <- lab_query(con, sql, "B3 age x year")
lab_duck_disconnect(con)
lab_save_aggregate(d, "B3-age-year", "stage-b", sql = sql, checks = lab_annual_checks(d))
