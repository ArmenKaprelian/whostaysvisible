# M7: area results for the Moscow sequence and the two comparison groups (round 3, 23 October 2026).
# Run: scripts/lab-run.sh --max 14G --duck-mem 9GB --duck-threads 8 --cpu 800% Rscript --vanilla R/motion/M7-moscow.R
# (a) 1 km and 5 km cells inside the 160 x 90 km rectangle, per year 2014-2025, anchored at the
#     rectangle's south-west corner: for the firms on no list drawn in the sequence (below city-level
#     geocodes), the counts of all firms, baseline firms, filers with a value and baseline firms without
#     a statement, the filers' median revenue change and its class (20 or more filers). The 1 km grid
#     coincides with M5's Moscow city_1km grid shifted by 35 columns, which gives an independent check.
# (b) The two comparison groups' revenue paths: firms listed in 2022 (Aeroflot's group) and firms on
#     no list with a baseline (the neighbour's group), as the yearly median and quartiles of
#     100 * real revenue / own 2019-2021 average among members with a statement and positive revenue.
# Outputs are local only (moscowcells.json, moscowcomparison.json); no identifier leaves DuckDB.
source(file.path(Sys.getenv("LAB_ROOT"), "R", "lab.R")); lab_init()
source(lab_path("R", "motion", "motion-common.R"))
con <- lab_duck_connect(); on.exit(lab_duck_disconnect(con))
source(lab_path("R", "motion", "M6-common.R"))

P <- motion_read_json(paste0("points", SUFFIX)); CY <- motion_read_json("cellsyears"); TR <- motion_read_json("treated"); AN <- motion_read_json("anchors")
MIN_FILERS <- 20L

# ---- cells ------------------------------------------------------------------------------------------
cells_for <- function(g) {
  nx <- as.integer(round(R$w / g)); ny <- as.integer(round(R$h / g))
  d <- lab_query(con, sprintf("SELECT year, least(CAST(floor((x_km - %.9f) / %g) AS INTEGER), %d) AS ix, least(CAST(floor((y_km - %.9f) / %g) AS INTEGER), %d) AS iy,
                                      count(*) AS n, count(*) FILTER (WHERE base IS NOT NULL) AS nb, count(*) FILTER (WHERE pct IS NOT NULL) AS f,
                                      count(*) FILTER (WHERE base IS NOT NULL AND NOT filed) AS nfb, quantile_cont(%s, 0.5) AS med
                               FROM fym WHERE NOT treated AND NOT city_level GROUP BY 1, 2, 3 ORDER BY 1, 3, 2", R$xmin, g, nx - 1L, R$ymin, g, ny - 1L, PCOL), sprintf("%g km cells", g))
  d$med <- ifelse(d$f > 0, round(d$med, 1), NA)
  d$cls <- ifelse(d$f >= MIN_FILERS, class_of(d$med), NA_integer_)
  list(size_km = g, nx = nx, ny = ny, cells = d)
}
G <- list(`1km` = cells_for(1), `5km` = cells_for(5))

# Sums and support per grid and year, for the manifest and the checks.
sums <- do.call(rbind, lapply(names(G), function(gn) { d <- G[[gn]]$cells; a <- stats::aggregate(cbind(n, nb, f, nfb) ~ year, d, sum); a$grid <- gn; a }))
support <- do.call(rbind, lapply(names(G), function(gn) { d <- G[[gn]]$cells
  s <- stats::aggregate(cbind(cells = 1, supported = f >= MIN_FILERS, thin = f > 0 & f < MIN_FILERS, empty = f == 0) ~ year, d, sum); s$grid <- gn; s }))
class_counts <- do.call(rbind, lapply(names(G), function(gn) { d <- G[[gn]]$cells; d <- d[!is.na(d$cls), ]
  cc <- as.data.frame(table(year = d$year, cls = factor(d$cls, levels = 1:6))); cc$grid <- gn; cc }))

# ---- M5 reconciliation: M5's own binning over every eligible located firm in the 90 km window ----------
m5 <- lab_query(con, sprintf("SELECT year, least(CAST(floor((x_km - %.9f) / 1) AS INTEGER), 89) AS ix, least(CAST(floor((y_km - %.9f) / 1) AS INTEGER), 89) AS iy,
                                     count(*) AS n, count(*) FILTER (WHERE filed) AS a
                              FROM fy_all WHERE year BETWEEN 2019 AND 2024 AND x_km BETWEEN %.9f AND %.9f AND y_km BETWEEN %.9f AND %.9f GROUP BY 1, 2, 3", MX - 45, MY - 45, MX - 45, MX + 45, MY - 45, MY + 45), "M5 binning over fy_all")
# Our 1 km grid over the same population (all eligible firms, identifier or not, listed and city-level included).
all1 <- lab_query(con, sprintf("SELECT year, least(CAST(floor((x_km - %.9f) / 1) AS INTEGER), 159) AS ix, least(CAST(floor((y_km - %.9f) / 1) AS INTEGER), 89) AS iy, count(*) AS n_all
                                FROM fy_all WHERE year BETWEEN 2019 AND 2024 GROUP BY 1, 2, 3", R$xmin, R$ymin), "1 km cells over every eligible firm")
cy <- CY$city_1km; cy <- cy[cy$label == "Moscow", ]
dec <- function(b64, n, size) readBin(jsonlite::base64_dec(b64), "integer", n = n, size = size, endian = "little", signed = TRUE)
m5_checks <- list(); align_checks <- list()
for (i in seq_len(nrow(cy))) {
  yy <- cy$year[i]; cnt <- cy$count[i]
  ref <- data.frame(ix = dec(cy$ix[i], cnt, 2L), iy = dec(cy$iy[i], cnt, 2L), n = dec(cy$n[i], cnt, 4L), a = dec(cy$a[i], cnt, 4L))
  ours <- m5[m5$year == yy, ]
  mm <- merge(ref, ours, by = c("ix", "iy"), all = TRUE, suffixes = c("_m5", "_m7"))
  mm$a_m5[!is.na(mm$a_m5) & mm$a_m5 < 0] <- NA   # M5 writes -1 where n < 50 (the share is suppressed); compare counts where it is present
  m5_checks[[length(m5_checks) + 1]] <- motion_check(sprintf("M5 Moscow 1 km %d: max |n difference| over the window", yy), 0, max(abs(mm$n_m5 - mm$n_m7), na.rm = FALSE))
  m5_checks[[length(m5_checks) + 1]] <- motion_check(sprintf("M5 Moscow 1 km %d: max |a difference| where M5 shows a", yy), 0, max(abs(mm$a_m5 - mm$a_m7), na.rm = TRUE))
  m5_checks[[length(m5_checks) + 1]] <- motion_check(sprintf("M5 Moscow 1 km %d: window total", yy), cy$sum_n[i], sum(ours$n))
  # Alignment of our grid: interior cells (M5 ix 0..88) must equal our cells at ix + 35, same iy.
  oi <- all1[all1$year == yy, ]; oi$ix5 <- oi$ix - 35L
  mi <- merge(ref[ref$ix <= 88, c("ix", "iy", "n")], oi[, c("ix5", "iy", "n_all")], by.x = c("ix", "iy"), by.y = c("ix5", "iy"), all.x = TRUE)
  align_checks[[length(align_checks) + 1]] <- motion_check(sprintf("1 km grid aligned with M5 (interior cells) %d", yy), 0, max(abs(mi$n - mi$n_all)))
}

# ---- comparison groups ---------------------------------------------------------------------------------
IDX_FILTER <- "base IS NOT NULL AND filed AND line_2110 > 0"
group_stats <- function(where, label) lab_query(con, sprintf("SELECT year, count(*) AS n, quantile_cont(idx, 0.5) AS med, quantile_cont(idx, 0.25) AS q1, quantile_cont(idx, 0.75) AS q3
                                                               FROM (SELECT year, 100 * real_rev / base AS idx FROM fym WHERE %s AND %s) GROUP BY 1 ORDER BY 1", where, IDX_FILTER), label)
ga <- group_stats("treated AND red_from = 2022", "firms listed in 2022")
gb <- group_stats("NOT treated", "firms on no list")
members <- lab_query(con, "SELECT count(*) FILTER (WHERE treated AND red_from = 2022) AS a, count(*) FILTER (WHERE treated AND red_from = 2022 AND red_from <> 2022) AS a_bad,
                                  count(*) FILTER (WHERE NOT treated AND base IS NOT NULL) AS b FROM firms", "group membership")
# The two anchors' own paths, located without identifiers leaving DuckDB, to check anchors.json.
anchor_idx <- function(where, label) lab_query(con, sprintf("SELECT year, 100 * real_rev / base AS idx FROM fym WHERE inn_key IN (SELECT inn_key FROM firms WHERE %s) AND %s ORDER BY year", where, IDX_FILTER), label)
ia <- anchor_idx(sprintf("treated AND red_from = 2022 AND abs(x_km - %.9f) < 1e-6 AND abs(y_km - %.9f) < 1e-6", AN$a$x_km, AN$a$y_km), "Aeroflot path")
ib <- anchor_idx(sprintf("NOT treated AND abs(x_km - %.9f) < 1e-6 AND abs(y_km - %.9f) < 1e-6 AND industry2 = %s", AN$b$x_km, AN$b$y_km, q(AN$b$industry2)), "neighbour path")
idx_from_anchor <- function(f) ifelse(is.na(f$years$pct), NA, f$years$pct + 100)
ia_json <- idx_from_anchor(AN$a); ib_json <- idx_from_anchor(AN$b)
cmp_idx <- function(db, js) { m <- js[match(db$year, AN$a$years$year)]; max(abs(db$idx - m)) }
gaps <- function(js, g, before = 2014:2021, after) {
  dev <- js - g$med[match(AN$a$years$year, g$year)]
  list(before = round(mean(dev[AN$a$years$year %in% before], na.rm = TRUE), 1), after = round(mean(dev[AN$a$years$year %in% after], na.rm = TRUE), 1),
       years_before = sprintf("%d-%d", min(before), max(before)), years_after = sprintf("%d-%d", min(after), max(after)), by_year = round(dev, 1))
}
gap_a <- gaps(ia_json, ga, after = 2023:2025); gap_b <- gaps(ib_json, gb, after = 2022:2025)
gap_b$before <- round(gap_b$before); gap_b$after <- round(gap_b$after); gap_b$by_year <- round(gap_b$by_year)   # the neighbour's figures stay rounded

# ---- checks ---------------------------------------------------------------------------------------------
cell_checks <- do.call(rbind, lapply(names(G), function(gn) do.call(rbind, lapply(years, function(y) {
  s <- sums[sums$grid == gn & sums$year == y, ]; c <- P$counts$region[[as.character(y)]]
  rbind(motion_check(sprintf("%s %d: cells hold the drawn firms", gn, y), c$drawn, s$n),
        motion_check(sprintf("%s %d: cells hold the baseline firms", gn, y), c$filers_base + c$nonfilers_base + c$base_filed_novalue, s$nb),
        motion_check(sprintf("%s %d: cells hold the filers with a value", gn, y), c$filers_base, s$f),
        motion_check(sprintf("%s %d: cells hold the baseline firms without a statement", gn, y), c$nonfilers_base, s$nfb)) }))))
city_cells <- G$`1km`$cells[G$`1km`$cells$ix >= 48 & G$`1km`$cells$ix <= 111 & G$`1km`$cells$iy >= 27 & G$`1km`$cells$iy <= 62, ]
city_checks <- do.call(rbind, lapply(years, function(y) { cc <- city_cells[city_cells$year == y, ]; c <- P$counts$city[[as.character(y)]]
  rbind(motion_check(sprintf("1 km cells inside the city extent %d: filers", y), c$filers_base, sum(cc$f)),
        motion_check(sprintf("1 km cells inside the city extent %d: baseline firms without a statement", y), c$nonfilers_base, sum(cc$nfb))) }))
class_checks <- do.call(rbind, lapply(names(G), function(gn) do.call(rbind, lapply(years, function(y) {
  d <- G[[gn]]$cells[G[[gn]]$cells$year == y, ]
  rbind(motion_check(sprintf("%s %d: every supported cell carries a class", gn, y), 0, sum(d$f >= MIN_FILERS & is.na(d$cls))),
        motion_check(sprintf("%s %d: class counts equal the supported cells", gn, y), sum(d$f >= MIN_FILERS), sum(!is.na(d$cls)))) }))))
checks <- motion_checks(cell_checks, city_checks, class_checks, do.call(rbind, m5_checks), do.call(rbind, align_checks),
  motion_check("firms listed in 2022: membership equals treated.json", TR$red_from_counts[["2022"]], members$a[1]),
  motion_check("firms listed in 2022: every member carries red-from 2022", 0, members$a_bad[1]),
  motion_check("firms on no list with a baseline: membership positive", 1, as.integer(members$b[1] > 0)),
  motion_check("firms listed in 2022: yearly counts never exceed membership", 1, as.integer(max(ga$n) <= members$a[1])),
  motion_check("firms on no list: yearly counts never exceed membership", 1, as.integer(max(gb$n) <= members$b[1])),
  motion_check("Aeroflot's index equals anchors.json (max abs diff, 1-decimal rounding)", 0, cmp_idx(ia, ia_json), 0.06),
  motion_check("neighbour's index equals anchors.json (max abs diff, whole-point rounding)", 0, cmp_idx(ib, ib_json), 0.51),
  motion_check("Aeroflot has no 2022 index", 0, sum(ia$year == 2022)),
  motion_check("both groups cover every year", 24, nrow(ga) + nrow(gb)))

# ---- save ------------------------------------------------------------------------------------------------
cells_out <- list(origin = c(R$xmin, R$ymin), extent = list(xmin = R$xmin, xmax = R$xmax, ymin = R$ymin, ymax = R$ymax), years = years, breaks = BREAKS, min_filers = MIN_FILERS,
                  class_colours = CLASS_COLS, ramp = RAMPS[[VARIANT]]$name, metric_kind = METRIC_TEXT$kind, metric = METRIC_TEXT$description,
                  grids = lapply(G, function(g) list(size_km = g$size_km, nx = g$nx, ny = g$ny, cells = g$cells[, c("year", "ix", "iy", "n", "nb", "f", "nfb", "med", "cls")])),
                  sums = sums[, c("grid", "year", "n", "nb", "f", "nfb")], support = support[, c("grid", "year", "cells", "supported", "thin", "empty")],
                  class_counts = class_counts[, c("grid", "year", "cls", "Freq")],
                  rules = list(population = "firms on no supplied list, geocoded below city level, inside the 160 x 90 km rectangle (the same firms as the M6 rasters)",
                               cell = "floor((x - xmin) / size), floor((y - ymin) / size), the top edges folded into the last cell; the 1 km grid coincides with M5's Moscow city_1km grid shifted 35 columns east",
                               colour = "a cell carries the class of its filers' median revenue change when it has 20 or more filers with a value; otherwise it is an outline only",
                               absence = "statements absent (baseline firms without a statement) are counted per cell (nfb) but not mapped at the city and region scales; the sequence shows absence only at the downtown scale"),
                  notes = c("Registered addresses, not operating sites.", "Descriptive: the metric is each firm's own revenue path, aggregated by cell; no spatial or proximity effect is estimated."))
motion_save_json(cells_out, paste0("moscowcells", SUFFIX), checks = checks, rows = sum(vapply(G, function(g) nrow(g$cells), 0L)), digits = 1)
if (!CANONICAL) { message("  comparison groups unchanged by the metric; not rewritten in this run"); quit(save = "no", status = 0) }
cmp_out <- list(years = years, index = "100 * real revenue (line 2110 times the GDP deflator, 2021 = 1) / the firm's own 2019-2021 average of statements with positive revenue",
                filter = "members with a baseline, a statement and positive revenue in the year (the map's metric admits a filed zero; the log axis cannot)",
                groups = list(listed2022 = list(label = "firms listed in 2022", rule = "on a supplied list with red-from 2022 (the sanctions file's first start year), inside the rectangle", members = members$a[1], by_year = ga),
                              nolist = list(label = "firms on no list", rule = "on none of the five supplied lists, with a baseline, inside the rectangle", members = members$b[1], by_year = gb)),
                anchors = list(a = list(label = "Aeroflot", group = "listed2022", years = AN$a$years$year, idx = ia_json, gap = gap_a, marker = list(year = 2022, label = "listed 2022")),
                               b = list(label = "the private firm", group = "nolist", years = AN$b$years$year, idx = ib_json, gap = gap_b)),
                extremes = list(min_q1 = min(c(ga$q1, gb$q1)), max_q3 = max(c(ga$q3, gb$q3)), min_idx = min(c(ia_json, ib_json), na.rm = TRUE), max_idx = max(c(ia_json, ib_json), na.rm = TRUE)),
                notes = c("Paths compared, no effect estimated.", "Medians and quartiles change composition with observation: only members with a statement that year enter."))
motion_save_json(cmp_out, "moscowcomparison", rows = nrow(ga) + nrow(gb), digits = 1)
message(sprintf("  listed in 2022: %d members, yearly n %d-%d; no list: %d members, yearly n %d-%d", members$a[1], min(ga$n), max(ga$n), members$b[1], min(gb$n), max(gb$n)))
message(sprintf("  Aeroflot: %.1f points from the median before, %.1f after; neighbour: %d before, %d after", gap_a$before, gap_a$after, gap_b$before, gap_b$after))
message(sprintf("  1 km cells: %d rows; supported per year %s", nrow(G$`1km`$cells), paste(support$supported[support$grid == "1km"], collapse = " ")))
