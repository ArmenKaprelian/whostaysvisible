# M10: 25 km cells by financial year (author's request, 24 October 2026): the atlas's step between the
# 100 km cells and the city windows, so a zoom refines the cells across the country. Same inputs,
# projection, located rule and counts as M5, binned at 25 km on the plane's origin, so every 100 km cell
# holds exactly sixteen children: per year, located eligible firms (n), with a statement (a) and
# sanctions-list members (ns); 2021 adds the government strategic list (ng); the change layer compares
# 2024 with 2021 under the 100 km rule (50 or more firms in both years, six classes at -5, -2, 0, +2, +5
# points). List counts of 1 to 4 are suppressed (-1). Nothing firm-level leaves DuckDB.
# Run: scripts/lab-run.sh --max 12G --duck-mem 8GB --duck-threads 8 --cpu 800% Rscript --vanilla R/motion/M10-cells25.R
source(file.path(Sys.getenv("LAB_ROOT"), "R", "lab.R")); lab_init()
source(lab_path("R", "motion", "motion-common.R"))
con <- lab_duck_connect(); on.exit(lab_duck_disconnect(con))
cy <- motion_read_json("cellsyears"); c100 <- motion_read_json("cells100")
avail <- as.data.frame(cy$avail); totals <- as.data.frame(cy$totals); lists100 <- as.data.frame(c100$lists)
years <- as.integer(cy$mapped_years)
G <- 25L

located_sql <- function(y) sprintf("
  WITH r AS (SELECT source_row, original_available, member_sanctioned, member_strateg_government FROM %s WHERE eligible_raw = 1),
       p AS (SELECT source_row, lon, lat FROM %s),
       j AS (SELECT r.*, p.lon, p.lat FROM r LEFT JOIN p USING (source_row)),
       a AS (SELECT *, coalesce(isfinite(lon) AND isfinite(lat) AND lon BETWEEN -180 AND 180 AND lat BETWEEN -90 AND 90, false) AS bounds_valid,
                    lat * pi() / 180 AS phi, ((lon - 100 + 180) - 360 * floor((lon - 100 + 180) / 360) - 180) * pi() / 180 AS dl FROM j),
       b AS (SELECT *, 1 + sin(pi() / 3) * sin(phi) + cos(pi() / 3) * cos(phi) * cos(dl) AS den FROM a)
  SELECT original_available, member_sanctioned, member_strateg_government, coalesce(bounds_valid AND den > 1e-12, false) AS located,
         CASE WHEN bounds_valid AND den > 1e-12 THEN 6371 * sqrt(2 / den) * cos(phi) * sin(dl) END AS x_km,
         CASE WHEN bounds_valid AND den > 1e-12 THEN 6371 * sqrt(2 / den) * (cos(pi() / 3) * sin(phi) - sin(pi() / 3) * cos(phi) * cos(dl)) END AS y_km
  FROM b", lab_parquet_sql(paste0("registry.", y)), lab_parquet_sql(paste0("payload.", y)))

suppress <- function(v) { v <- as.integer(v); v[v > 0 & v < 5] <- -1L; v }
checks <- list(); by_year <- list(); cells <- list(); rss <- function() as.numeric(system2("ps", c("-o", "rss=", "-p", Sys.getpid()), stdout = TRUE)) / 1024
for (y in years) {
  d <- lab_query(con, sprintf("SELECT CAST(floor(x_km / %d) AS INTEGER) AS ix, CAST(floor(y_km / %d) AS INTEGER) AS iy, count(*) AS n,
                               count(*) FILTER (WHERE original_available = 1) AS a, count(*) FILTER (WHERE member_sanctioned = 1) AS ns,
                               count(*) FILTER (WHERE member_strateg_government = 1) AS ng FROM (%s) WHERE located GROUP BY 1, 2 ORDER BY 2, 1", G, G, located_sql(y)), sprintf("25 km cells %d", y))
  for (col in c("ix", "iy", "n", "a", "ns", "ng")) d[[col]] <- as.integer(d[[col]])
  ti <- which(totals$year == y)
  # nesting: the parent of a 25 km cell is floor(ix / 4), floor(iy / 4), the 100 km cell M5 counted
  d$px <- floor(d$ix / 4); d$py <- floor(d$iy / 4)
  p <- aggregate(cbind(n, a, ns) ~ px + py, data = d, FUN = sum)
  a100 <- avail[avail$year == y, ]
  m <- merge(p, a100, by.x = c("px", "py"), by.y = c("ix", "iy"), all = TRUE, suffixes = c("", "_100"))
  both <- !is.na(m$n) & !is.na(m$n_100)
  ns_ok <- ifelse(is.na(m$ns_100), m$ns >= 1 & m$ns <= 4, m$ns == m$ns_100)
  checks[[length(checks) + 1]] <- motion_checks(
    motion_check(sprintf("%d: located firms equal M5's total", y), totals$n_located[ti], sum(d$n)),
    motion_check(sprintf("%d: located firms with a statement equal M5's total", y), totals$n_located_available[ti], sum(d$a)),
    motion_check(sprintf("%d: the parents of the 25 km cells are exactly M5's 100 km cells", y), nrow(a100), sum(both)),
    motion_check(sprintf("%d: no parent without a 100 km cell and no 100 km cell without children", y), nrow(m), sum(both)),
    motion_check(sprintf("%d: children sums reproduce the 100 km firms (max abs diff)", y), 0, max(abs(m$n[both] - m$n_100[both]))),
    motion_check(sprintf("%d: children sums reproduce the 100 km statements (max abs diff)", y), 0, max(abs(m$a[both] - m$a_100[both]))),
    motion_check(sprintf("%d: children sums reproduce the 100 km sanctions members (a suppressed parent holds 1 to 4)", y), 0, sum(!ns_ok[both])),
    motion_check(sprintf("%d: every cell has 1 to 65535 firms", y), 1, as.integer(all(d$n >= 1 & d$n <= 65535) || all(d$n >= 1))))
  if (y == 2021) {
    pg <- aggregate(cbind(ng) ~ px + py, data = d, FUN = sum)
    shown <- lists100[!is.na(lists100$govstrategic), c("ix", "iy", "govstrategic")]
    mg <- merge(pg, shown, by.x = c("px", "py"), by.y = c("ix", "iy"))
    checks[[length(checks) + 1]] <- motion_checks(
      motion_check("2021: every shown 100 km government-strategic count has children", nrow(shown), nrow(mg)),
      motion_check("2021: children sums reproduce the shown 100 km government-strategic members (max abs diff)", 0, max(abs(mg$ng - mg$govstrategic))))
  }
  cells[[as.character(y)]] <- d
  rec <- list(year = y, count = nrow(d), sum_n = sum(d$n), sum_a = sum(d$a), supported = sum(d$n >= 50), max_n = max(d$n),
              ix = motion_b64_int16(d$ix), iy = motion_b64_int16(d$iy), n = motion_b64_int32(d$n), a = motion_b64_int32(d$a), ns = motion_b64_int32(suppress(d$ns)))
  if (y == 2021) rec$ng <- motion_b64_int32(suppress(d$ng))
  by_year[[as.character(y)]] <- rec
  message(sprintf("  %d: %s cells, %s with 50 or more firms, %s located firms, RSS %.0f MB", y, motion_count(nrow(d)), motion_count(sum(d$n >= 50)), motion_count(sum(d$n)), rss()))
}
# The change layer, 2024 against 2021, under the 100 km rule.
d21 <- cells[["2021"]][, c("ix", "iy", "n", "a")]; d24 <- cells[["2024"]][, c("ix", "iy", "n", "a")]
ch <- merge(d21, d24, by = c("ix", "iy"), all = TRUE, suffixes = c("21", "24"))
for (col in c("n21", "a21", "n24", "a24")) ch[[col]][is.na(ch[[col]])] <- 0L
ch$supported <- ch$n21 >= 50 & ch$n24 >= 50
ch$change_pp <- ifelse(ch$supported, 100 * (ch$a24 / ch$n24 - ch$a21 / ch$n21), NA)
ch$class <- ifelse(ch$supported, as.integer(cut(ch$change_pp, breaks = c(-Inf, -5, -2, 0, 2, 5, Inf), right = TRUE, labels = FALSE)), 0L)
ch <- ch[order(ch$iy, ch$ix), ]
class_counts <- as.integer(table(factor(ch$class[ch$supported], levels = 1:6)))
checks[[length(checks) + 1]] <- motion_checks(
  motion_check("change: supported cells have 50 or more firms in both years", 1, as.integer(all(ch$n21[ch$supported] >= 50 & ch$n24[ch$supported] >= 50))),
  motion_check("change: every supported cell has a class 1 to 6 and no other cell has one", 0, sum((ch$class > 0) != ch$supported)),
  motion_check("change: class counts sum to the supported cells", sum(ch$supported), sum(class_counts)),
  motion_check("change: 2021 firms over the change rows equal the 2021 total", totals$n_located[totals$year == 2021], sum(ch$n21)),
  motion_check("change: 2024 firms over the change rows equal the 2024 total", totals$n_located[totals$year == 2024], sum(ch$n24)))
change <- list(count = nrow(ch), supported = sum(ch$supported), class_cells = class_counts,
               ix = motion_b64_int16(ch$ix), iy = motion_b64_int16(ch$iy), n21 = motion_b64_int32(ch$n21), a21 = motion_b64_int32(ch$a21), n24 = motion_b64_int32(ch$n24), a24 = motion_b64_int32(ch$a24),
               class = motion_b64_int16(ch$class), change_pp_x1000 = motion_b64_int32(ifelse(ch$supported, round(ch$change_pp * 1000), 0)))
checks_df <- do.call(rbind, checks)
out <- list(grid_km = G, origin = c(0, 0), years = years, support = 50, suppression = 5, by_year = by_year, change = change,
            encoding = "by_year[YYYY]: base64 little-endian int16 ix/iy (cell index on the plane's origin, 25 km) and int32 n (located eligible firms), a (with a statement), ns (sanctions-list members, -1 when 1 to 4), 2021 also ng (government strategic list, -1 when 1 to 4); change: int16 ix/iy and class (1 to 6 for supported cells, 0 otherwise), int32 n21, a21, n24, a24 and change_pp_x1000 (points times 1,000)",
            notes = c("Located eligible firms by financial year at registered addresses, projected and binned with the production rule at 25 km on the plane's origin, so every 100 km cell of cellsyears holds sixteen children (checked exactly for firms and statements).",
                      "Shares are shown only for cells with 50 or more located firms; list counts of 1 to 4 per cell are suppressed; the change layer follows the 100 km rule (50 or more firms in both years, six classes at -5, -2, 0, +2, +5 points).",
                      "Annual populations at registered addresses, not the same firms; descriptive."))
motion_save_json(out, "cells25", checks = checks_df, rows = sum(vapply(cells, nrow, 0L)))
message(sprintf("  cells25: %d years, %s rows, change %d rows (%d supported)", length(years), motion_count(sum(vapply(cells, nrow, 0L))), nrow(ch), sum(ch$supported)))
