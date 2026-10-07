# B7 query: availability in year t by decile of the firm's assets (line 1600) in its original
# statement of t-1, among eligible firms with consistent identity; year by year, no lag across
# the 2018/2019 provider change. Deciles are within year, so no deflation is needed for ranks.
source(file.path(Sys.getenv("LAB_ROOT"), "R", "lab.R")); lab_init()
con <- lab_duck_connect()
years <- c(2013:2018, 2020:2025)
out <- list(); sqls <- character()
for (t in years) {
  sql <- sprintf("
WITH lag AS (
  SELECT r.inn_key, p.line_1600 AS assets_prev
  FROM %s r JOIN %s p USING (year, source_row)
  WHERE r.inn_key IS NOT NULL AND r.identity_consistent AND r.original_available = 1 AND p.line_1600 > 0),
cur AS (
  SELECT inn_key, original_available FROM %s
  WHERE inn_key IS NOT NULL AND identity_consistent AND eligible_raw = 1),
j AS (SELECT c.original_available, l.assets_prev FROM cur c JOIN lag l USING (inn_key)),
q AS (SELECT quantile_cont(assets_prev, [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]) AS cuts FROM j),
b AS (SELECT j.original_available, j.assets_prev,
             1 + (CASE WHEN j.assets_prev > q.cuts[1] THEN 1 ELSE 0 END) + (CASE WHEN j.assets_prev > q.cuts[2] THEN 1 ELSE 0 END) +
                 (CASE WHEN j.assets_prev > q.cuts[3] THEN 1 ELSE 0 END) + (CASE WHEN j.assets_prev > q.cuts[4] THEN 1 ELSE 0 END) +
                 (CASE WHEN j.assets_prev > q.cuts[5] THEN 1 ELSE 0 END) + (CASE WHEN j.assets_prev > q.cuts[6] THEN 1 ELSE 0 END) +
                 (CASE WHEN j.assets_prev > q.cuts[7] THEN 1 ELSE 0 END) + (CASE WHEN j.assets_prev > q.cuts[8] THEN 1 ELSE 0 END) +
                 (CASE WHEN j.assets_prev > q.cuts[9] THEN 1 ELSE 0 END) AS decile
      FROM j, q)
SELECT %d AS year, decile, count(*) AS firms, count(*) FILTER (WHERE original_available = 1) AS available,
       min(assets_prev) AS assets_min, median(assets_prev) AS assets_median, max(assets_prev) AS assets_max
FROM b GROUP BY 1, 2 ORDER BY 1, 2", lab_registry_sql(t - 1), lab_payload_sql(t - 1), lab_registry_sql(t), t)
  out[[as.character(t)]] <- lab_query(con, sql, sprintf("B7 %d", t))
  sqls <- c(sqls, sql)
}
lab_duck_disconnect(con)
d <- do.call(rbind, out)
# Cross-check: prior observers available next year by era against the transition accounting (same direction, not identical sets).
td <- lab_read_csv("acct.transition-denominators")
ref <- td[td$prior_absent == 0 & td$destination_year == 2024, ]
chk <- data.frame(check = "2024 availability among prior observers with positive assets within 5 points of the transition accounting A share",
                  expected = ref$A / ref$origin_rows, observed = sum(d$available[d$year == 2024]) / sum(d$firms[d$year == 2024]), tolerance = 0.05)
lab_save_aggregate(d, "B7-size-bands", "stage-b", sql = paste(sqls, collapse = "\n\n"), checks = chk)
