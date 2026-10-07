# B4 query: availability by financial year and years before the reconciled registry removal,
# among eligible rows with consistent identity and dates; the never-removed group is the reference.
source(file.path(Sys.getenv("LAB_ROOT"), "R", "lab.R")); lab_init()
con <- lab_duck_connect()
sql <- sprintf("
WITH base AS (
  SELECT year, original_available,
         CASE WHEN dissolution_date_reconciled IS NULL THEN NULL
              ELSE year(dissolution_date_reconciled) - year END AS years_to_removal
  FROM %s
  WHERE eligible_raw = 1 AND identity_consistent AND date_issue = 'consistent')
SELECT year,
       CASE WHEN years_to_removal IS NULL THEN 'no recorded removal'
            WHEN years_to_removal <= 0 THEN 'removed that year'
            ELSE cast(years_to_removal AS varchar) END AS years_before_removal,
       count(*) AS eligible_rows,
       count(*) FILTER (WHERE original_available = 1) AS eligible_available
FROM base GROUP BY 1, 2 ORDER BY 1, 2", lab_registry_sql())
d <- lab_query(con, sql, "B4 years before removal x year")
# Share of eligible rows that enter the consistent-identity universe, per year, for the notes.
sql2 <- sprintf("
SELECT year, count(*) FILTER (WHERE eligible_raw = 1) AS eligible_rows,
       count(*) FILTER (WHERE eligible_raw = 1 AND identity_consistent AND date_issue = 'consistent') AS consistent_rows
FROM %s GROUP BY 1 ORDER BY 1", lab_registry_sql())
u <- lab_query(con, sql2, "B4 universe coverage")
lab_duck_disconnect(con)
checks <- data.frame(check = "rows by removal horizon sum to the consistent universe each year (max abs diff)", expected = 0,
                     observed = max(abs(aggregate(eligible_rows ~ year, d, sum)$eligible_rows - u$consistent_rows)), tolerance = 0)
lab_save_aggregate(d, "B4-before-removal", "stage-b", sql = sql, checks = checks)
lab_save_aggregate(u, "B4-universe-coverage", "stage-b", sql = sql2)
