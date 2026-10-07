# B6 query: six-year reporting histories 2019-2024 among firms eligible in 2019 with consistent identity.
# States per firm-year: A available original; N eligible, registered, absent; X recorded removal by year-end
# (takes precedence); O other row (ineligible or unresolved registration); - no row in that year.
source(file.path(Sys.getenv("LAB_ROOT"), "R", "lab.R")); lab_init()
con <- lab_duck_connect()
state_sql <- "CASE WHEN registered_year_end = false THEN 'X'
                   WHEN eligible_raw = 1 AND original_available = 1 THEN 'A'
                   WHEN eligible_raw = 1 AND original_available = 0 AND registered_year_end THEN 'N'
                   ELSE 'O' END"
pivot <- paste(sprintf("coalesce(max(CASE WHEN year = %d THEN state END), '-')", 2019:2024), collapse = " || ")
sql <- sprintf("
WITH r AS (
  SELECT inn_key, year, %s AS state
  FROM %s WHERE inn_key IS NOT NULL AND identity_consistent),
u AS (SELECT DISTINCT inn_key FROM r WHERE year = 2019 AND state IN ('A', 'N')),
p AS (SELECT r.inn_key, %s AS history FROM r JOIN u USING (inn_key) GROUP BY r.inn_key)
SELECT history, count(*) AS firms FROM p GROUP BY 1 ORDER BY 2 DESC", state_sql, lab_registry_sql(2019:2024), pivot)
d <- lab_query(con, sql, "B6 histories")
sql2 <- sprintf("SELECT count(DISTINCT inn_key) AS firms_2019 FROM %s WHERE inn_key IS NOT NULL AND identity_consistent AND eligible_raw = 1 AND registered_year_end", lab_registry_sql(2019))
u <- lab_query(con, sql2, "B6 universe")
lab_duck_disconnect(con)
checks <- data.frame(check = "histories sum to the 2019 universe of eligible registered consistent firms", expected = u$firms_2019, observed = sum(d$firms), tolerance = 0)
lab_save_aggregate(d, "B6-histories", "stage-b", sql = sql, checks = checks, extra = list(universe_sql = sql2, state_definition = state_sql))
