# M5: statement availability by 100 km cell for every financial year 2012-2025, and by 1 km city
# cell for 2019-2024 (firm-level job, one DuckDB query per year).
# Run: scripts/lab-run.sh --max 12G --duck-mem 8GB --duck-threads 8 --cpu 800% Rscript --vanilla R/motion/M5-years.R
# Inputs: the pinned foundation registry and raw-payload partitions (registry.YYYY: eligibility,
# availability, registration, memberships; payload.YYYY: lon, lat), joined on source_row within
# the year. The projection and the located rule are the production SQL of
# chapter2-pass2-reconcile-geography.R (spherical LAEA 100E 60N, R 6371 km; located = finite
# coordinates inside bounds with a positive projection denominator). Nothing firm-level leaves
# DuckDB: only cell counts and annual totals are collected.
source(file.path(Sys.getenv("LAB_ROOT"), "R", "lab.R")); lab_init()
source(lab_path("R", "motion", "motion-common.R"))

basemap <- motion_read_json("basemap")
cities <- as.data.frame(basemap$cities, stringsAsFactors = FALSE)
con <- lab_duck_connect(); on.exit(lab_duck_disconnect(con))
ann <- lab_read_csv("acct.annual-accounting")
cov <- lab_read_csv("fig27.coverage-years")
cy <- lab_read_csv("fig27.cells-years"); cy <- cy[cy$grid_km == 100 & cy$quality_scope == "all", ]
dots <- lab_read_csv("motion.dot-accounting")
years <- 2012:2025   # 2011 has no statements in the release

located_sql <- function(y) sprintf("
  WITH r AS (SELECT source_row, original_available, registered_year_end, member_sanctioned FROM %s WHERE eligible_raw = 1),
       p AS (SELECT source_row, lon, lat, TRUE AS has_payload FROM %s),
       j AS (SELECT r.*, p.lon, p.lat, coalesce(p.has_payload, FALSE) AS has_payload FROM r LEFT JOIN p USING (source_row)),
       a AS (SELECT *, coalesce(isfinite(lon) AND isfinite(lat) AND lon BETWEEN -180 AND 180 AND lat BETWEEN -90 AND 90, false) AS bounds_valid,
                    lat * pi() / 180 AS phi, ((lon - 100 + 180) - 360 * floor((lon - 100 + 180) / 360) - 180) * pi() / 180 AS dl FROM j),
       b AS (SELECT *, 1 + sin(pi() / 3) * sin(phi) + cos(pi() / 3) * cos(phi) * cos(dl) AS den FROM a)
  SELECT original_available, registered_year_end, member_sanctioned, NOT has_payload AS no_payload_row, coalesce(bounds_valid AND den > 1e-12, false) AS located,
         CASE WHEN bounds_valid AND den > 1e-12 THEN 6371 * sqrt(2 / den) * cos(phi) * sin(dl) END AS x_km,
         CASE WHEN bounds_valid AND den > 1e-12 THEN 6371 * sqrt(2 / den) * (cos(pi() / 3) * sin(phi) - sin(pi() / 3) * cos(phi) * cos(dl)) END AS y_km
  FROM b", lab_parquet_sql(paste0("registry.", y)), lab_parquet_sql(paste0("payload.", y)))
city_values <- paste(sprintf("('%s', %.9f, %.9f)", gsub("'", "''", cities$label), cities$x_km, cities$y_km), collapse = ", ")
cities_sql <- sprintf("(SELECT * FROM (VALUES %s) AS c(label, cx, cy))", city_values)

totals <- list(); cells <- list(); city1 <- list(); checks <- list()
for (y in years) {
  base <- located_sql(y)
  t <- lab_query(con, sprintf("SELECT %d AS year, count(*) AS n, count(*) FILTER (WHERE located) AS n_located, count(*) FILTER (WHERE original_available = 1) AS n_available,
                               count(*) FILTER (WHERE located AND original_available = 1) AS n_located_available, count(*) FILTER (WHERE registered_year_end) AS n_registered,
                               count(*) FILTER (WHERE located AND registered_year_end) AS n_located_registered, count(*) FILTER (WHERE no_payload_row) AS n_without_payload_row FROM (%s)", y, base), sprintf("totals %d", y))
  c100 <- lab_query(con, sprintf("SELECT %d AS year, CAST(floor(x_km / 100) AS INTEGER) AS ix, CAST(floor(y_km / 100) AS INTEGER) AS iy, count(*) AS n, count(*) FILTER (WHERE original_available = 1) AS a,
                                  count(*) FILTER (WHERE registered_year_end) AS nr, count(*) FILTER (WHERE registered_year_end AND original_available = 1) AS ar,
                                  count(*) FILTER (WHERE member_sanctioned = 1) AS ns FROM (%s) WHERE located GROUP BY 2, 3 ORDER BY 3, 2", y, base), sprintf("cells %d", y))
  a <- ann[ann$year == y, ]
  checks[[length(checks) + 1]] <- motion_checks(
    motion_check(sprintf("%d eligible rows equal annual accounting", y), a$eligible_rows, t$n),
    motion_check(sprintf("%d eligible available equal annual accounting", y), a$eligible_available, t$n_available),
    motion_check(sprintf("%d registered equal annual accounting", y), a$eligible_registered, t$n_registered),
    motion_check(sprintf("%d every eligible registry row has a payload row", y), 0, t$n_without_payload_row),
    motion_check(sprintf("%d located firms equal the cell sum", y), t$n_located, sum(c100$n)))
  if (y %in% cov$year) checks[[length(checks) + 1]] <- motion_check(sprintf("%d located firms equal the production coverage table", y), cov$n_located[cov$year == y], t$n_located)
  if (y == 2021) {
    m <- merge(c100, cy[cy$year == 2021, c("ix", "iy", "n_eligible", "n_available")], by = c("ix", "iy"), all = TRUE)
    checks[[length(checks) + 1]] <- motion_checks(
      motion_check("2021 cells equal the production cells (count)", sum(cy$year == 2021), nrow(c100)),
      motion_check("2021 cells matched both ways", nrow(c100), sum(!is.na(m$n) & !is.na(m$n_eligible))),
      motion_check("2021 cell firms equal production (max abs diff)", 0, max(abs(m$n - m$n_eligible), na.rm = TRUE)),
      motion_check("2021 cell available equal production (max abs diff)", 0, max(abs(m$a - m$n_available), na.rm = TRUE)),
      motion_check("2021 located available equal dot accounting", dots$located_available_firms, t$n_located_available))
  }
  if (y >= 2019 && y <= 2024) {
    w <- lab_query(con, sprintf(
      "SELECT c.label, LEAST(CAST(floor((p.x_km - (c.cx - 45)) / 1.0) AS INTEGER), 89) AS ix, LEAST(CAST(floor((p.y_km - (c.cy - 45)) / 1.0) AS INTEGER), 89) AS iy,
              count(*) AS n, count(*) FILTER (WHERE original_available = 1) AS a
       FROM (%s) AS p JOIN %s AS c ON p.located AND p.x_km >= c.cx - 45 AND p.x_km <= c.cx + 45 AND p.y_km >= c.cy - 45 AND p.y_km <= c.cy + 45
       GROUP BY 1, 2, 3 ORDER BY 1, 3, 2", base, cities_sql), sprintf("city 1 km cells %d", y))
    city1[[as.character(y)]] <- w
  }
  totals[[length(totals) + 1]] <- t; cells[[length(cells) + 1]] <- c100
  message(sprintf("  %d: %s eligible, %s located (%.2f%%), %s with a statement, %d cells, peak RSS so far %.0f MB", y, motion_count(t$n), motion_count(t$n_located),
                  100 * t$n_located / t$n, motion_count(t$n_available), nrow(c100), as.numeric(system2("ps", c("-o", "rss=", "-p", Sys.getpid()), stdout = TRUE)) / 1024))
}
totals <- do.call(rbind, totals); cells <- do.call(rbind, cells); checks <- do.call(rbind, checks)
totals$located_share <- round(100 * totals$n_located / totals$n, 3)
totals$eligible_share <- round(100 * totals$n_available / totals$n, 3)
totals$located_eligible_share <- round(100 * totals$n_located_available / totals$n_located, 3)
totals$flagged <- totals$year == 2025
ns <- as.integer(cells$ns); ns[ns > 0 & ns < 5] <- NA_integer_   # list counts under 5 per cell are suppressed
avail <- data.frame(year = as.integer(cells$year), ix = cells$ix, iy = cells$iy, n = as.integer(cells$n), a = as.integer(cells$a), nr = as.integer(cells$nr), ar = as.integer(cells$ar), ns = ns)

# 1 km city cells per year, base64 like density.json (shares not shown under 50 firms).
pack_city <- function(d, y, label) {
  ci <- cities[cities$label == label, ]
  a <- as.integer(d$a); a[d$n < 50] <- -1L
  list(year = y, label = label, grid_km = 1, origin = c(ci$x_km - 45, ci$y_km - 45), count = nrow(d), sum_n = sum(d$n), sum_a = sum(d$a), max_n = max(d$n),
       ix = motion_b64_int16(d$ix), iy = motion_b64_int16(d$iy), n = motion_b64_int32(d$n), a = motion_b64_int32(a))
}
city_layers <- unlist(lapply(names(city1), function(y) { w <- city1[[y]]; lapply(split(w, w$label), function(d) pack_city(d, as.integer(y), d$label[1])) }), recursive = FALSE)
names(city_layers) <- NULL

mapped_years <- totals$year[totals$n_located > 0]   # the release carries coordinates from 2014 on; 2012-2013 have none
out <- list(years = years, mapped_years = mapped_years, avail = avail, totals = totals, city_1km = city_layers,
            encoding = "avail: column arrays (n located eligible firms, a with a statement, nr registered at year-end, ar registered with a statement, ns sanctions-list members or null when 1-4); city_1km: base64 little-endian int16 ix/iy and int32 n/a, a = -1 where the share is not shown",
            notes = c("Located eligible firms by financial year at registered addresses, projected and binned with the production rule; the located share differs by year and is printed with each map. The 2012 and 2013 partitions carry no coordinates, so the map starts in 2014.",
                      "Statement available: the firm's own filing for the year is in the release (filed, not imputed). 2011 has no statements; 2025 is the flagged latest year.",
                      "Providers: Rosstat for 2012-2018 and FNS for 2019-2025; no transition crosses the boundary.",
                      "Shares are shown only for cells with 50 or more located firms."))
motion_save_json(out, "cellsyears", checks = checks, rows = nrow(avail))
lab_save_aggregate(totals, "annual-located-totals", stage = "motion")
