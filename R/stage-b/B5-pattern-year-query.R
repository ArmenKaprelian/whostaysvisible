# B5 query: five-bit supplied-membership pattern x financial year, eligible rows and availability.
source(file.path(Sys.getenv("LAB_ROOT"), "R", "lab.R")); lab_init()
con <- lab_duck_connect()
bit <- function(col) sprintf("coalesce(cast(%s AS varchar), '?')", col)
sql <- sprintf("
SELECT year, %s || %s || %s || %s || %s AS pattern,
       count(*) FILTER (WHERE eligible_raw = 1) AS eligible_rows,
       count(*) FILTER (WHERE eligible_raw = 1 AND original_available = 1) AS eligible_available,
       count(*) FILTER (WHERE eligible_raw = 1 AND registered_year_end) AS eligible_registered,
       count(*) FILTER (WHERE eligible_raw = 1 AND registered_year_end AND original_available = 1) AS registered_available
FROM %s GROUP BY 1, 2 ORDER BY 1, 2",
  bit("member_sanctioned"), bit("member_putin_decree"), bit("member_residents"), bit("member_strateg_government"), bit("member_strateg_putin"),
  lab_registry_sql())
d <- lab_query(con, sql, "B5 pattern x year")
lab_duck_disconnect(con)
lab_save_aggregate(d, "B5-pattern-year", "stage-b", sql = sql, checks = lab_annual_checks(d))
