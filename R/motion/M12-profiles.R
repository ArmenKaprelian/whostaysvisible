# M12: the profiles behind the bios (round 15, the author's item 9, 26 October 2026). Per registry region (region_model,
# mapped to the basemap's names by config/regions-crosswalk.csv), per city window (the 22 windows of 90 by 90 km that M5
# and M11 use) and for Russia, in 2021 and 2024, among located eligible firms (M11's located rule): firms (n), with a
# statement (a), and among firms with a statement and a positive value the median real revenue (line 2110) and the median
# real total assets (line 1600), in millions of 2021 rubles (nominal divided by the WDI GDP deflator rebased to 2021 = 1, M6's
# convention); and the median real revenue change from 2021 to 2024 among firms with a statement and a positive revenue in
# both years, by their 2024 region and window (firms without an identifier cannot be followed and are left out, as in M6).
# For the windows also the top-3 divisions by revenue share and the share of that revenue held by firms on the five lists
# (regions.json carries both for the regions). Medians only where 50 or more firms (the project's support rule). Nothing
# firm-level leaves DuckDB.
# Run: scripts/lab-run.sh --max 12G --duck-mem 8GB --duck-threads 8 --cpu 800% Rscript --vanilla R/motion/M12-profiles.R
source(file.path(Sys.getenv("LAB_ROOT"), "R", "lab.R")); lab_init()
source(lab_path("R", "motion", "motion-common.R"))
source(lab_path("R", "motion", "industry-common.R"))
con <- lab_duck_connect(); on.exit(lab_duck_disconnect(con))
cy <- motion_read_json("cellsyears"); rg <- as.data.frame(motion_read_json("regions")[c("region", "year", "n", "a")], stringsAsFactors = FALSE)
basemap <- motion_read_json("basemap"); cities <- as.data.frame(basemap$cities, stringsAsFactors = FALSE)
totals <- as.data.frame(cy$totals); city1km <- as.data.frame(cy$city_1km[c("year", "label", "count", "sum_n")])
xw <- utils::read.csv(lab_path("config", "regions-crosswalk.csv"), stringsAsFactors = FALSE, encoding = "UTF-8", colClasses = "character")
YEARS <- c(2021L, 2024L); SUPPORT <- 50L; TOPK <- 3L
exec <- function(sql, label) { t0 <- proc.time()[["elapsed"]]; DBI::dbExecute(con, sql); message(sprintf("  %s: %.1f s", label, proc.time()[["elapsed"]] - t0)) }

# ---- the deflator (M6-common.R's lines): WDI NY.GDP.DEFL.ZS.AD for Russia, rebased to 2021 = 1; real = nominal / index ----
wdi <- utils::read.csv(lab_source("motion.deflator"), skip = 4, check.names = FALSE, stringsAsFactors = FALSE)
rus <- wdi[wdi$`Country Code` == "RUS", ]
if (nrow(rus) != 1) stop("deflator: Russia row not found")
idx <- as.numeric(rus[1, as.character(2011:2025)]); defl <- stats::setNames(idx / idx[2021 - 2010], 2011:2025)
if (any(!is.finite(defl[as.character(YEARS)]))) stop("deflator: no index for ", paste(YEARS[!is.finite(defl[as.character(YEARS)])], collapse = ", "))

DBI::dbWriteTable(con, "xw", xw[, c("region_model", "basemap_name")], temporary = TRUE, overwrite = TRUE)
DBI::dbWriteTable(con, "win", data.frame(label = cities$label, cx = as.numeric(cities$x_km), cy = as.numeric(cities$y_km), stringsAsFactors = FALSE), temporary = TRUE, overwrite = TRUE)

# One row per located eligible firm-year, as M11 selects them, with the real values and the identifier for the change.
firm_sql <- function(y) sprintf("
  WITH r AS (SELECT source_row, inn_key, original_available, industry2, region_model,
                    coalesce(member_sanctioned, 0) + coalesce(member_putin_decree, 0) + coalesce(member_residents, 0) + coalesce(member_strateg_government, 0) + coalesce(member_strateg_putin, 0) > 0 AS listed
             FROM %s WHERE eligible_raw = 1),
       p AS (SELECT source_row, lon, lat, line_2110, line_1600 FROM %s),
       j AS (SELECT r.*, p.lon, p.lat, p.line_2110, p.line_1600 FROM r LEFT JOIN p USING (source_row)),
       a AS (SELECT *, coalesce(isfinite(lon) AND isfinite(lat) AND lon BETWEEN -180 AND 180 AND lat BETWEEN -90 AND 90, false) AS bounds_valid,
                    lat * pi() / 180 AS phi, ((lon - 100 + 180) - 360 * floor((lon - 100 + 180) / 360) - 180) * pi() / 180 AS dl FROM j),
       b AS (SELECT *, 1 + sin(pi() / 3) * sin(phi) + cos(pi() / 3) * cos(phi) * cos(dl) AS den FROM a)
  SELECT source_row, inn_key, coalesce(region_model, '__MISSING__') AS region_model, listed, coalesce(original_available = 1, false) AS filed, %s AS div,
         CASE WHEN original_available = 1 AND line_2110 > 0 THEN line_2110 END AS rev,
         CASE WHEN original_available = 1 AND line_2110 > 0 THEN line_2110 / %.15f END AS rrev,
         CASE WHEN original_available = 1 AND line_1600 > 0 THEN line_1600 / %.15f END AS rass,
         6371 * sqrt(2 / den) * cos(phi) * sin(dl) AS x_km,
         6371 * sqrt(2 / den) * (cos(pi() / 3) * sin(phi) - sin(pi() / 3) * cos(phi) * cos(dl)) AS y_km
  FROM b WHERE bounds_valid AND den > 1e-12",
  lab_parquet_sql(paste0("registry.", y)), lab_parquet_sql(paste0("payload.", y)), ind_div_sql("industry2"), defl[[as.character(y)]], defl[[as.character(y)]])
for (y in YEARS) exec(sprintf("CREATE TEMP TABLE f%d AS %s", y, firm_sql(y)), sprintf("located eligible firms %d", y))

unknown <- lab_query(con, "SELECT DISTINCT region_model FROM (SELECT region_model FROM f2021 UNION ALL SELECT region_model FROM f2024) WHERE region_model NOT IN (SELECT region_model FROM xw)", "region labels outside the crosswalk")
if (nrow(unknown)) stop("region labels missing from config/regions-crosswalk.csv: ", paste(unknown$region_model, collapse = ", "))

STATS <- "count(*) AS n, count(*) FILTER (WHERE filed) AS a, count(rrev) AS n_rev, median(rrev) AS med_rev, count(rass) AS n_assets, median(rass) AS med_assets"
WIN_JOIN <- "JOIN win w ON f.x_km >= w.cx - 45 AND f.x_km <= w.cx + 45 AND f.y_km >= w.cy - 45 AND f.y_km <= w.cy + 45"   # M11's window join: inclusive bounds
supported <- function(v, n) ifelse(n >= SUPPORT, v, NA_real_)
as_profile <- function(d, key, y) {
  for (col in c("n", "a", "n_rev", "n_assets")) d[[col]] <- as.integer(d[[col]])
  data.frame(key = d[[key]], year = y, n = d$n, a = d$a, n_rev = d$n_rev, med_rev_m = round(supported(d$med_rev, d$n_rev) / 1000, 3),
             n_assets = d$n_assets, med_assets_m = round(supported(d$med_assets, d$n_assets) / 1000, 3), stringsAsFactors = FALSE)
}

checks <- list(); regs <- list(); wins <- list(); divs <- list()
for (y in YEARS) {
  t <- sprintf("f%d", y)
  r <- lab_query(con, sprintf("SELECT x.basemap_name AS region, %s FROM %s f JOIN xw x USING (region_model) GROUP BY 1", STATS, t), sprintf("regions %d", y))
  n <- lab_query(con, sprintf("SELECT 'Russia' AS region, %s FROM %s f", STATS, t), sprintf("Russia %d", y))
  w <- lab_query(con, sprintf("SELECT w.label, %s FROM %s f %s GROUP BY 1", STATS, t, WIN_JOIN), sprintf("windows %d", y))
  dv <- lab_query(con, sprintf("SELECT w.label, f.div, sum(f.rev) AS rev, coalesce(sum(f.rev) FILTER (WHERE f.listed), 0) AS rev_listed FROM %s f %s WHERE f.rev IS NOT NULL GROUP BY 1, 2", t, WIN_JOIN), sprintf("window divisions %d", y))
  pr <- rbind(as_profile(n, "region", y), as_profile(r, "region", y)); pw <- as_profile(w, "label", y)
  regs[[length(regs) + 1]] <- pr; wins[[length(wins) + 1]] <- pw; dv$year <- y; divs[[length(divs) + 1]] <- dv
  # checks against M5 (the located total and the windows' firms) and M11 (every region's firms and statements)
  ti <- which(totals$year == y); m11 <- rg[rg$year == y, ]; mm <- merge(pr, m11, by.x = "key", by.y = "region", all = TRUE, suffixes = c("", "_m11"))
  cw <- merge(pw, city1km[city1km$year == y, ], by.x = "key", by.y = "label", all = TRUE)
  checks[[length(checks) + 1]] <- motion_checks(
    motion_check(sprintf("%d: located firms equal M5's total", y), totals$n_located[ti], n$n),
    motion_check(sprintf("%d: the regions' firms add up to the national row", y), n$n, sum(as.integer(r$n))),
    motion_check(sprintf("%d: every region of regions.json is present (and no other)", y), 0, sum(is.na(mm$n)) + sum(is.na(mm$n_m11))),
    motion_check(sprintf("%d: firms per region equal regions.json's (max abs diff)", y), 0, max(abs(mm$n - mm$n_m11), na.rm = TRUE)),
    motion_check(sprintf("%d: firms with a statement per region equal regions.json's (max abs diff)", y), 0, max(abs(mm$a - mm$a_m11), na.rm = TRUE)),
    motion_check(sprintf("%d: every city window present", y), nrow(cities), sum(!is.na(cw$n) & !is.na(cw$sum_n))),
    motion_check(sprintf("%d: firms per window equal cellsyears' city_1km sums (max abs diff)", y), 0, max(abs(cw$n - cw$sum_n), na.rm = TRUE)),
    motion_check(sprintf("%d: medians only where %d or more firms", y, SUPPORT), 0, sum(!is.na(pr$med_rev_m) & pr$n_rev < SUPPORT) + sum(!is.na(pw$med_rev_m) & pw$n_rev < SUPPORT) + sum(!is.na(pr$med_assets_m) & pr$n_assets < SUPPORT) + sum(!is.na(pw$med_assets_m) & pw$n_assets < SUPPORT)),
    motion_check(sprintf("%d: medians positive where present", y), 0, sum(c(pr$med_rev_m, pw$med_rev_m, pr$med_assets_m, pw$med_assets_m) <= 0, na.rm = TRUE)),
    motion_check(sprintf("%d: statements never exceed firms, revenue and asset counts never exceed statements", y), 0, sum(pr$a > pr$n | pr$n_rev > pr$a | pr$n_assets > pr$a) + sum(pw$a > pw$n | pw$n_rev > pw$a | pw$n_assets > pw$a)))
  message(sprintf("  %d: %s located firms, %d regions, %d windows; national median revenue %.2f m, assets %.2f m (2021 rubles)", y, motion_count(n$n), nrow(r), nrow(w), pr$med_rev_m[1], pr$med_assets_m[1]))
}
regions <- do.call(rbind, regs); windows <- do.call(rbind, wins)

# the windows' top divisions by revenue share and the listed share, in each year (M11's ranking: the largest revenue first, ties to the lower code)
dv <- do.call(rbind, divs); dv$div <- as.integer(dv$div); dv <- dv[order(dv$label, dv$year, -dv$rev, dv$div), ]
wd <- do.call(rbind, lapply(split(dv, list(dv$label, dv$year), drop = TRUE), function(d) {
  tot <- sum(d$rev); top <- head(d, TOPK); sh <- as.integer(round(100 * top$rev / tot))
  pad <- function(v, fill) c(v, rep(fill, TOPK - length(v)))
  data.frame(key = d$label[1], year = d$year[1], d1 = pad(top$div, 255L)[1], s1 = pad(sh, 0L)[1], d2 = pad(top$div, 255L)[2], s2 = pad(sh, 0L)[2], d3 = pad(top$div, 255L)[3], s3 = pad(sh, 0L)[3],
             lsh = as.integer(round(100 * sum(d$rev_listed) / tot)), stringsAsFactors = FALSE)
}))
windows <- merge(windows, wd, by = c("key", "year"), all.x = TRUE)
checks[[length(checks) + 1]] <- motion_checks(
  motion_check("windows: every window-year has its divisions", 0, sum(is.na(windows$d1))),
  motion_check("windows: top shares non-increasing", 0, sum(!(windows$s1 >= windows$s2 & windows$s2 >= windows$s3), na.rm = TRUE)),
  motion_check("windows: listed shares within 0 to 100", 0, sum(windows$lsh < 0 | windows$lsh > 100, na.rm = TRUE)))

# ---- the change from 2021 to 2024: firms with a statement and a positive revenue in both years, one row per identifier and year ----
dedup <- function(t) sprintf("SELECT inn_key, arg_min(rrev, source_row) AS rrev, arg_min(region_model, source_row) AS region_model, arg_min(x_km, source_row) AS x_km, arg_min(y_km, source_row) AS y_km FROM %s WHERE inn_key IS NOT NULL AND rrev IS NOT NULL GROUP BY inn_key", t)
exec(sprintf("CREATE TEMP TABLE chg AS SELECT b.region_model, b.x_km, b.y_km, 100 * (b.rrev / a.rrev - 1) AS pct FROM (%s) a JOIN (%s) b USING (inn_key)", dedup("f2021"), dedup("f2024")), "firms with revenue in 2021 and 2024")
dups <- lab_query(con, "SELECT (SELECT count(*) - count(DISTINCT inn_key) FROM f2021 WHERE inn_key IS NOT NULL AND rrev IS NOT NULL) AS d21, (SELECT count(*) - count(DISTINCT inn_key) FROM f2024 WHERE inn_key IS NOT NULL AND rrev IS NOT NULL) AS d24, (SELECT count(*) FROM f2021 WHERE inn_key IS NULL AND rrev IS NOT NULL) AS noid21, (SELECT count(*) FROM f2024 WHERE inn_key IS NULL AND rrev IS NOT NULL) AS noid24", "repeated and missing identifiers")
CH <- "count(*) AS n_change, median(pct) AS med_change"
cn <- lab_query(con, sprintf("SELECT 'Russia' AS key, %s FROM chg", CH), "the change, Russia")
cr <- lab_query(con, sprintf("SELECT x.basemap_name AS key, %s FROM chg f JOIN xw x USING (region_model) GROUP BY 1", CH), "the change by region")
cw <- lab_query(con, sprintf("SELECT w.label AS key, %s FROM chg f %s GROUP BY 1", CH, WIN_JOIN), "the change by window")
tidy_change <- function(d) { d$n_change <- as.integer(d$n_change); d$med_change <- round(supported(d$med_change, d$n_change), 1); d[, c("key", "n_change", "med_change")] }
rchange <- tidy_change(rbind(cn, cr)); wchange <- tidy_change(cw)
r21 <- regions[regions$year == 2021, ]; r24 <- regions[regions$year == 2024, ]; mc <- merge(merge(rchange, r21[, c("key", "n_rev")], by = "key"), r24[, c("key", "n_rev")], by = "key", suffixes = c("_21", "_24"))
over <- mc[mc$n_change > pmin(mc$n_rev_21, mc$n_rev_24), ]
if (nrow(over)) message("  change above a year's revenue count: ", paste(sprintf("%s (%d against %d and %d)", over$key, over$n_change, over$n_rev_21, over$n_rev_24), collapse = "; "))
checks[[length(checks) + 1]] <- motion_checks(
  motion_check("change: the regions' firms add up to the national row", rchange$n_change[rchange$key == "Russia"], sum(rchange$n_change[rchange$key != "Russia"])),
  # Round 29: "outside the basemap outline" is left out. It holds Baikonur alone in 2021 and the occupied mainland regions from 2022, so firms
  # registered elsewhere in 2021 join it by 2024 (18 against 6); it has no polygon and the page never shows it.
  motion_check("change: never more firms than had revenue in either year (the regions)", 0, sum(mc$n_change > pmin(mc$n_rev_21, mc$n_rev_24) & mc$key != "outside the basemap outline")),
  motion_check("change: medians only where 50 or more firms", 0, sum(!is.na(rchange$med_change) & rchange$n_change < SUPPORT) + sum(!is.na(wchange$med_change) & wchange$n_change < SUPPORT)),
  motion_check("change: every window present", nrow(cities), nrow(wchange)))
checks_df <- do.call(rbind, checks)
message(sprintf("  change 2021 to 2024: %s firms nationally, median %+.1f%%; repeated identifiers %s and %s, firms without one %s and %s (2021, 2024; left out)",
                motion_count(rchange$n_change[rchange$key == "Russia"]), rchange$med_change[rchange$key == "Russia"], motion_count(dups$d21), motion_count(dups$d24), motion_count(dups$noid21), motion_count(dups$noid24)))

names(regions)[names(regions) == "key"] <- "region"; names(windows)[names(windows) == "key"] <- "label"
names(rchange)[names(rchange) == "key"] <- "region"; names(wchange)[names(wchange) == "key"] <- "label"
regions <- regions[order(regions$region != "Russia", regions$region, regions$year), ]; windows <- windows[order(windows$label, windows$year), ]
out <- list(years = YEARS, support = SUPPORT,
            regions = regions, regions_change = rchange, windows = windows, windows_change = wchange,
            identifiers = list(repeated_2021 = dups$d21, repeated_2024 = dups$d24, without_2021 = dups$noid21, without_2024 = dups$noid24),
            units = "n, a, n_rev, n_assets, n_change: firms; med_rev_m, med_assets_m: millions of 2021 rubles (lines 2110 and 1600, thousands of rubles in the source, divided by the GDP deflator rebased to 2021 = 1); med_change: percent; d1 to d3: two-digit divisions (255 none); s1 to s3, lsh: percent of the window's revenue",
            basis = "regions: firms registered in the region (region_model through config/regions-crosswalk.csv), as regions.json; windows: firms at located addresses inside the 90 by 90 km window around the city, as cellsyears.city_1km; Russia: every located eligible firm",
            notes = c("Medians among located eligible firms with a statement and a positive value that year; shown only where 50 or more firms (null otherwise).",
                      "The change is each firm's real revenue in 2024 against its own in 2021, among firms with a statement and a positive revenue in both years, by the firm's 2024 region and window; firms without an identifier are left out and repeated identifiers keep their first row.",
                      "Registered addresses, not operating sites; descriptive figures, not effects."))
motion_save_json(out, "profiles", checks = checks_df, rows = nrow(regions) + nrow(windows))
message(sprintf("  profiles: %d region-years, %d window-years", nrow(regions), nrow(windows)))
