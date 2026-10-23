# M6: the treated-firm sequence data for Moscow, 2014-2025 (firm-level job).
# Run: scripts/lab-run.sh --max 16G --duck-mem 10GB --duck-threads 8 --cpu 800% Rscript --vanilla R/motion/M6-treated.R
# Every firm on any supplied list is one "treated" bucket, red from its designation year: the
# minimum sanctions-list startDate (2,419 of 5,743 dates are inferred); residents-list-only firms
# from 2020 (Decree 35); other undated list members from the first frame (author's decision,
# 23 October 2026). Non-treated firms carry a control metric: real revenue (GDP deflator, 2021 = 1)
# as a percent change against the firm's own 2019-2021 average, in six PRGn classes; firms with no
# original filing in the year are a dark control colour; firms without a baseline are muted.
# Outputs are local only: per-year point rasters for three 16:9 extents centred on the basemap's
# Moscow reference point (region 160 x 90 km, city 64 x 36 km, downtown 21.33 x 12 km), a treated
# JSON (coordinates of public-list firms, no identifiers), the two anchor firms' facts (the SME is
# never named), per-year counters and checks. Nothing firm-level is published.
source(file.path(Sys.getenv("LAB_ROOT"), "R", "lab.R")); lab_init()
source(lab_path("R", "motion", "motion-common.R"))

years <- 2014:2025
basemap <- motion_read_json("basemap")
cities <- as.data.frame(basemap$cities, stringsAsFactors = FALSE)
MX <- cities$x_km[cities$label == "Moscow"]; MY <- cities$y_km[cities$label == "Moscow"]
con <- lab_duck_connect(); on.exit(lab_duck_disconnect(con))
exec <- function(sql, label) { t0 <- proc.time()[["elapsed"]]; DBI::dbExecute(con, sql); message(sprintf("  %s: %.1f s", label, proc.time()[["elapsed"]] - t0)) }
pq <- function(names) { paths <- vapply(names, lab_source, character(1), verify_hash = FALSE); sprintf("read_parquet([%s], hive_partitioning = false)", paste0("'", gsub("'", "''", paths, fixed = TRUE), "'", collapse = ", ")) }
q <- function(x) paste0("'", gsub("'", "''", x, fixed = TRUE), "'")

# ---- extents (16:9 km rectangles; the page draws each 1:1 at its k) -----------------------------
EXT <- list(region = list(h = 90, k = 12, mark = list(base = 1, s = 0.2, cap = 3)),
            city = list(h = 36, k = 30, mark = list(base = 2, s = 0.6, cap = 8)),
            downtown = list(h = 12, k = 90, mark = list(base = 3, s = 1.1, cap = 14)))
for (n in names(EXT)) { e <- EXT[[n]]; e$w <- e$h * 16 / 9; e$xmin <- MX - e$w / 2; e$xmax <- MX + e$w / 2; e$ymin <- MY - e$h / 2; e$ymax <- MY + e$h / 2; EXT[[n]] <- e }
R <- EXT$region

# ---- deflator (WDI NY.GDP.DEFL.ZS.AD, Russia), rebased to 2021 = 1 -----------------------------
wdi <- utils::read.csv(lab_source("motion.deflator"), skip = 4, check.names = FALSE, stringsAsFactors = FALSE)
rus <- wdi[wdi$`Country Code` == "RUS", ]
if (nrow(rus) != 1) stop("deflator: Russia row not found")
idx <- as.numeric(rus[1, as.character(2011:2025)])
deflator <- data.frame(year = 2011:2025, index = idx, defl = idx / idx[2021 - 2010])
DBI::dbWriteTable(con, "deflator", deflator[, c("year", "defl")], temporary = TRUE, overwrite = TRUE)

# ---- sanctions list: one row per INN with the earliest start date and that row's inferred flag ----
san <- utils::read.csv(lab_source("motion.sanctioned-list"), stringsAsFactors = FALSE, colClasses = "character", encoding = "UTF-8")
san$inn <- trimws(san$inn); san <- san[nzchar(san$inn), ]
san$start_year <- as.integer(substr(san$startDate, 1, 4)); san$inferred <- san$startDate_inferred == "1"
san <- san[order(san$inn, san$startDate), ]
san_first <- san[!duplicated(san$inn), c("inn", "start_year", "inferred", "countries", "name", "name_alt")]
san_first$countries_all <- vapply(split(san$countries, san$inn)[san_first$inn], function(v) { tok <- unlist(strsplit(v, "[|[:space:]]+")); paste(sort(unique(tok[nzchar(tok)])), collapse = " ") }, "")   # the file writes "gb | us"
DBI::dbWriteTable(con, "san", san_first[, c("inn", "start_year", "inferred", "countries_all")], temporary = TRUE, overwrite = TRUE)

# ---- firm-years inside the region rectangle, 2014-2025 ------------------------------------------
exec(sprintf("CREATE TEMP TABLE fy_all AS
  WITH r AS (SELECT year, source_row, inn_key, original_available, creation_date_reconciled, industry2, legal_form, ownership_form,
                    coalesce(member_sanctioned, 0) + coalesce(member_putin_decree, 0) + coalesce(member_strateg_government, 0) + coalesce(member_strateg_putin, 0) AS other_lists,
                    coalesce(member_residents, 0) AS residents
             FROM %s WHERE eligible_raw = 1),
       p AS (SELECT year, source_row, lon, lat, geocoding_quality, line_2110, line_1600 FROM %s),
       j AS (SELECT r.*, p.lon, p.lat, p.geocoding_quality, p.line_2110, p.line_1600 FROM r JOIN p USING (year, source_row)),
       a AS (SELECT *, coalesce(isfinite(lon) AND isfinite(lat) AND lon BETWEEN -180 AND 180 AND lat BETWEEN -90 AND 90, false) AS bounds_valid,
                    lat * pi() / 180 AS phi, ((lon - 100 + 180) - 360 * floor((lon - 100 + 180) / 360) - 180) * pi() / 180 AS dl FROM j),
       b AS (SELECT *, 1 + sin(pi() / 3) * sin(phi) + cos(pi() / 3) * cos(phi) * cos(dl) AS den FROM a),
       c AS (SELECT *, CASE WHEN bounds_valid AND den > 1e-12 THEN 6371 * sqrt(2 / den) * cos(phi) * sin(dl) END AS x_km,
                    CASE WHEN bounds_valid AND den > 1e-12 THEN 6371 * sqrt(2 / den) * (cos(pi() / 3) * sin(phi) - sin(pi() / 3) * cos(phi) * cos(dl)) END AS y_km FROM b)
  SELECT year, inn_key, x_km, y_km, coalesce(original_available, 0) = 1 AS filed, line_2110, line_1600, line_2110 * d.defl AS real_rev,
         (other_lists + residents) > 0 AS treated_row, residents > 0 AS residents_row, other_lists > 0 AS other_row,
         geocoding_quality = 'city' AS city_level, industry2, legal_form, ownership_form, creation_date_reconciled
  FROM c JOIN deflator d USING (year)
  WHERE x_km BETWEEN %.9f AND %.9f AND y_km BETWEEN %.9f AND %.9f", pq(paste0("registry.", years)), pq(paste0("payload.", years)), R$xmin, R$xmax, R$ymin, R$ymax), "firm-years in the region rectangle")
# Firms without an identifier cannot be followed across years or matched to a list; they are counted and left out.
exec("CREATE TEMP TABLE fy AS SELECT * FROM fy_all WHERE inn_key IS NOT NULL", "firm-years with an identifier")
no_id <- lab_query(con, "SELECT count(*) AS n, count(*) FILTER (WHERE year = 2021) AS n2021 FROM fy_all WHERE inn_key IS NULL", "firm-years without an identifier")

# ---- firm attributes: treated bucket, red-from year, baseline -----------------------------------
exec("CREATE TEMP TABLE firms AS
  WITH f AS (SELECT inn_key, bool_or(treated_row) AS treated, bool_or(residents_row) AS residents, bool_or(other_row) AS other_lists,
                    arg_max(x_km, year) AS x_km, arg_max(y_km, year) AS y_km, max(year) AS last_year, min(year) AS first_year,
                    arg_max(industry2, year) AS industry2, arg_max(legal_form, year) AS legal_form, arg_max(ownership_form, year) AS ownership_form,
                    min(creation_date_reconciled) AS created
             FROM fy GROUP BY inn_key),
       b AS (SELECT inn_key, avg(real_rev) FILTER (WHERE filed AND line_2110 > 0) AS base, count(*) FILTER (WHERE filed AND line_2110 > 0) AS nbase
             FROM fy WHERE year BETWEEN 2019 AND 2021 GROUP BY inn_key)
  SELECT f.*, CASE WHEN b.nbase >= 2 THEN b.base END AS base, coalesce(b.nbase, 0) AS nbase,
         s.start_year, s.inferred, s.countries_all,
         CASE WHEN NOT f.treated THEN NULL
              WHEN s.start_year IS NOT NULL THEN greatest(s.start_year, 2014)
              WHEN f.residents AND NOT f.other_lists THEN 2020
              ELSE 2014 END AS red_from,
         f.treated AND s.start_year IS NULL AND NOT (f.residents AND NOT f.other_lists) AS undated
  FROM f LEFT JOIN b USING (inn_key) LEFT JOIN san s ON s.inn = f.inn_key", "firm attributes")

exec("CREATE TEMP TABLE fym AS
  SELECT y.*, m.treated, m.red_from, m.undated, m.inferred, m.base,
         CASE WHEN y.filed AND y.line_2110 >= 0 AND m.base IS NOT NULL THEN 100 * (y.real_rev / m.base - 1) END AS pct
  FROM fy y JOIN firms m USING (inn_key)", "firm-year metric")

# Three states for a drawn (non-treated, geocoded below city level) firm in a year (author's rule,
# 23 October 2026): a filer with a baseline carries its revenue-change class; a firm with a baseline
# and no statement that year is the outcome, in the dark control colour; a firm without a usable
# baseline is only part of the faint neutral backdrop. A baseline firm that filed without a revenue
# value is counted (base_filed_novalue) and left to the backdrop.
dist <- lab_query(con, "SELECT quantile_cont(pct, [0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95]) AS q FROM fym WHERE NOT treated AND NOT city_level AND year BETWEEN 2022 AND 2024 AND pct IS NOT NULL", "metric quantiles")
# Breaks chosen by the author on 23 October 2026 from the 2022-2024 quantiles (zero stays the midpoint,
# the upper classes widen); the first set was -40 / -15 / 0 / +15 / +40, which put 69-84% of filers in
# the two extreme classes. The manifest keeps the class counts under every candidate.
BREAKS <- c(-50, -20, 0, 50, 150)
CANDIDATES <- list(current = BREAKS, previous = c(-40, -15, 0, 15, 40), c2 = c(-40, -15, 0, 40, 120), c3 = c(-60, -25, 0, 75, 200))
CLASS_COLS <- c("#E7D4E8", "#C2A5CF", "#9970AB", "#5AAE61", "#A6DBA0", "#D9F0D3")   # declines then rises (PRGn, lightness rises with magnitude)
# Dark control: a saturated deep purple, so it separates from the faint backdrop (neutral at 0.35
# over the land) and from the land by chroma rather than lightness alone (validator, 23 October:
# deltaE 13.8 normal / 11.0 deutan against the effective backdrop, 14.1 / 10.7 against the land).
COL_NONFILER <- "#5A3175"; COL_NEUTRAL <- "#B5C3D1"; COL_RED <- "#E31A1C"
class_of <- function(p, breaks = BREAKS) ifelse(is.na(p), NA_integer_, 1L + findInterval(p, breaks, left.open = TRUE))

# ---- marks per extent and year -------------------------------------------------------------------
# One mark per pile (distinct coordinate; the region groups by pixel). n: all firms; nb: firms with a
# baseline; f: filers with a value; nfb: baseline firms without a statement; med: median change of the filers.
marks_for <- function(e, year) {
  where <- sprintf("NOT treated AND NOT city_level AND x_km BETWEEN %.9f AND %.9f AND y_km BETWEEN %.9f AND %.9f AND year = %d", e$xmin, e$xmax, e$ymin, e$ymax, year)
  key <- if (identical(e$k, 12)) sprintf("least(CAST(floor((x_km - %.9f) / %.12f * 1920) AS INTEGER), 1919) AS col, least(CAST(floor((%.9f - y_km) / %.12f * 1080) AS INTEGER), 1079) AS row", e$xmin, e$w, e$ymax, e$h)
         else "round(x_km, 3) AS px, round(y_km, 3) AS py"
  grp <- if (identical(e$k, 12)) "col, row" else "px, py"
  lab_query(con, sprintf("SELECT %s, count(*) AS n, count(*) FILTER (WHERE base IS NOT NULL) AS nb, count(*) FILTER (WHERE pct IS NOT NULL) AS f,
                                 count(*) FILTER (WHERE base IS NOT NULL AND NOT filed) AS nfb, quantile_cont(pct, 0.5) AS med
                          FROM fym WHERE %s GROUP BY %s", key, where, grp), sprintf("%s %s marks", names(EXT)[vapply(EXT, function(z) identical(z$k, e$k), NA)], year))
}
hex2rgb <- function(h) t(grDevices::col2rgb(h)) / 255
block_size <- function(cnt) ifelse(cnt >= 100, 3L, ifelse(cnt >= 10, 2L, 1L))

draw_region <- function(m, file, colours, cnt, order_by) {
  # One pixel per mark; piles of 10+ widen to 2x2 and 100+ to 3x3 (centred). Larger piles and stronger
  # classes are assigned last, so they win where blocks overlap.
  arr <- array(0, c(1080, 1920, 4))
  size <- block_size(cnt)
  o <- order(size, order_by)
  rgb <- hex2rgb(colours[o]); size <- size[o]; row0 <- m$row[o] + 1L - (size == 3L); col0 <- m$col[o] + 1L - (size == 3L)
  for (s in 1:3) {
    sel <- which(size == s); if (!length(sel)) next
    g <- expand.grid(dr = 0:(s - 1L), dc = 0:(s - 1L))
    rows <- as.vector(outer(row0[sel], g$dr, "+")); cols <- as.vector(outer(col0[sel], g$dc, "+")); who <- rep(sel, times = nrow(g))
    ok <- rows >= 1 & rows <= 1080 & cols >= 1 & cols <= 1920
    for (ch in 1:3) arr[cbind(rows[ok], cols[ok], ch)] <- rgb[who[ok], ch]
    arr[cbind(rows[ok], cols[ok], 4L)] <- 1
  }
  ragg::agg_png(file, width = 1920, height = 1080, units = "px", background = "transparent")
  grid::grid.newpage(); grid::grid.raster(arr, x = 0, y = 0, width = 1, height = 1, just = c("left", "bottom"), interpolate = FALSE)
  grDevices::dev.off()
  invisible(NULL)
}
disc_radius_km <- function(e, cnt) pmin(e$mark$cap, e$mark$base + e$mark$s * sqrt(pmax(0, cnt - 1))) / 2 / e$k
draw_discs <- function(m, e, file, inner, outer, inner_frac, cnt, order_by) {
  r_km <- disc_radius_km(e, cnt)
  o <- order(!is.na(outer), order_by)
  ragg::agg_png(file, width = 1920, height = 1080, units = "px", background = "transparent")
  grid::grid.newpage(); grid::pushViewport(grid::viewport(x = 0, y = 0, width = 1, height = 1, just = c("left", "bottom"), xscale = c(e$xmin, e$xmax), yscale = c(e$ymin, e$ymax)))
  ring <- o[!is.na(outer[o])]
  if (length(ring)) grid::grid.circle(m$px[ring], m$py[ring], r = r_km[ring], default.units = "native", gp = grid::gpar(fill = outer[ring], col = NA))
  grid::grid.circle(m$px[o], m$py[o], r = r_km[o] * ifelse(is.na(outer[o]), 1, inner_frac[o]), default.units = "native", gp = grid::gpar(fill = inner[o], col = NA))
  grid::popViewport(); grDevices::dev.off()
}
# Backdrop: every drawn firm, neutral, sized by the whole pile. Outcome layer: baseline firms only,
# sized by their count; a pile with any filers takes the filers' median class, its disc scaled by
# sqrt(filers / baseline firms) inside a dark disc for the non-filers; a pile with baseline firms and
# no filers is dark throughout.
draw_pair <- function(n, e, m, y) {
  back <- file.path(out_dir, sprintf("%s-%d-all.png", n, y)); layer <- file.path(out_dir, sprintf("%s-%d.png", n, y))
  neutral <- rep(COL_NEUTRAL, nrow(m))
  sel <- which(m$nb > 0); mo <- m[sel, ]
  inner <- ifelse(mo$f > 0, CLASS_COLS[class_of(mo$med)], COL_NONFILER)
  outer <- ifelse(mo$f > 0 & mo$nfb > 0, COL_NONFILER, NA)
  frac <- sqrt(mo$f / mo$nb)
  strength <- abs(ifelse(is.na(mo$med), 0, mo$med))
  if (n == "region") {
    draw_region(m, back, neutral, m$n, m$n)
    draw_region(mo, layer, inner, mo$nb, strength)
  } else {
    draw_discs(m, e, back, neutral, rep(NA, nrow(m)), rep(1, nrow(m)), m$n, m$n)
    draw_discs(mo, e, layer, inner, outer, frac, mo$nb, strength)
  }
  list(backdrop = paste0("points/", basename(back)), layer = paste0("points/", basename(layer)),
       piles = nrow(m), piles_outcome = nrow(mo), piles_coloured = sum(mo$f > 0), piles_dark_only = sum(mo$f == 0))
}

out_dir <- lab_dir("motion", "data", "points")
unlink(list.files(out_dir, pattern = "\\.png$", full.names = TRUE))
files <- list(); counts <- list(); classes <- list()
for (n in names(EXT)) {
  e <- EXT[[n]]; files[[n]] <- list(); counts[[n]] <- list(); classes[[n]] <- list()
  for (yy in years) {
    m <- marks_for(e, yy)
    pair <- draw_pair(n, e, m, yy)
    files[[n]][[as.character(yy)]] <- pair[c("backdrop", "layer")]
    tot <- lab_query(con, sprintf("SELECT count(*) AS firms, count(*) FILTER (WHERE treated) AS treated, count(*) FILTER (WHERE city_level AND NOT treated) AS city_level,
                                    count(*) FILTER (WHERE treated AND red_from <= %1$d) AS red, count(*) FILTER (WHERE treated AND red_from <= %1$d AND NOT filed) AS red_nonfilers,
                                    count(*) FILTER (WHERE treated AND red_from <= %1$d AND undated) AS red_undated,
                                    count(*) FILTER (WHERE NOT treated AND NOT city_level) AS drawn,
                                    count(*) FILTER (WHERE NOT treated AND NOT city_level AND pct IS NOT NULL) AS filers_base,
                                    count(*) FILTER (WHERE NOT treated AND NOT city_level AND base IS NOT NULL AND NOT filed) AS nonfilers_base,
                                    count(*) FILTER (WHERE NOT treated AND NOT city_level AND base IS NULL) AS nobase,
                                    count(*) FILTER (WHERE NOT treated AND NOT city_level AND base IS NULL AND filed) AS nobase_filed,
                                    count(*) FILTER (WHERE NOT treated AND NOT city_level AND base IS NOT NULL AND filed AND pct IS NULL) AS base_filed_novalue,
                                    count(*) FILTER (WHERE NOT city_level AND base IS NOT NULL) AS with_base_all
                                    FROM fym WHERE year = %1$d AND x_km BETWEEN %2$.9f AND %3$.9f AND y_km BETWEEN %4$.9f AND %5$.9f", yy, e$xmin, e$xmax, e$ymin, e$ymax), sprintf("%s %d totals", n, yy))
    counts[[n]][[as.character(yy)]] <- c(as.list(tot), pair[c("piles", "piles_outcome", "piles_coloured", "piles_dark_only")], list(marks_firms = sum(m$n), marks_firms_base = sum(m$nb)))
    pcts <- lab_query(con, sprintf("SELECT pct FROM fym WHERE NOT treated AND NOT city_level AND pct IS NOT NULL AND year = %d AND x_km BETWEEN %.9f AND %.9f AND y_km BETWEEN %.9f AND %.9f", yy, e$xmin, e$xmax, e$ymin, e$ymax), sprintf("%s %d filer values", n, yy))$pct
    classes[[n]][[as.character(yy)]] <- c(list(filers = length(pcts), quantiles = round(unname(stats::quantile(pcts, c(0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95))), 1)),
                                          lapply(CANDIDATES, function(b) as.integer(tabulate(class_of(pcts, b), nbins = 6))))
  }
}
# Alignment raster: single white pixels at the Moscow point and 10 km north of it (region extent).
align <- array(0, c(1080, 1920, 4)); px_of <- function(x, y, e) c(col = floor((x - e$xmin) / e$w * 1920), row = floor((e$ymax - y) / e$h * 1080))
p0 <- px_of(MX, MY, R); p1 <- px_of(MX, MY + 10, R)
for (p in list(p0, p1)) { align[p[["row"]] + 1, p[["col"]] + 1, ] <- 1 }
ragg::agg_png(file.path(out_dir, "align.png"), width = 1920, height = 1080, units = "px", background = "transparent"); grid::grid.newpage()
grid::grid.raster(align, x = 0, y = 0, width = 1, height = 1, just = c("left", "bottom"), interpolate = FALSE); grDevices::dev.off()
align_px <- as.numeric(strsplit(trimws(system2("magick", c("identify", "-format", shQuote("%[fx:p{960,540}.r] %[fx:p{960,540}.a] %[fx:p{960,420}.r] %[fx:p{960,420}.a] %[fx:p{960,541}.a] %[fx:p{959,540}.a]"), shQuote(file.path(out_dir, "align.png"))), stdout = TRUE)), " ")[[1]])

# ---- treated firms (public-list members): coordinates, red-from, filing string, pile size -------
# Per firm and year: the filing string ('-' absent, '0' no statement, '1' statement) and the state the
# page draws before the firm turns red, under the same three-state rule as the rasters ('-' absent,
# 'b' backdrop only, 'd' dark, '1'..'6' revenue-change class).
cls_sql <- paste0("1", paste(sprintf(" + CAST(y.pct > %d AS INTEGER)", BREAKS), collapse = ""))
tr <- lab_query(con, sprintf("SELECT m.inn_key, m.x_km, m.y_km, m.red_from, m.undated, coalesce(m.inferred, false) AS inferred, m.first_year, m.last_year,
                        string_agg(CASE WHEN y.year IS NULL THEN '-' WHEN y.filed THEN '1' ELSE '0' END, '' ORDER BY g.year) AS filed,
                        string_agg(CASE WHEN y.year IS NULL THEN '-' WHEN y.pct IS NOT NULL THEN CAST(%s AS VARCHAR) WHEN y.base IS NOT NULL AND NOT y.filed THEN 'd' ELSE 'b' END, '' ORDER BY g.year) AS state
                 FROM firms m CROSS JOIN (SELECT unnest(range(2014, 2026)) AS year) g LEFT JOIN fym y ON y.inn_key = m.inn_key AND y.year = g.year
                 WHERE m.treated GROUP BY ALL", cls_sql), "treated firms")
piles <- lab_query(con, "SELECT round(x_km, 3) AS px, round(y_km, 3) AS py, count(*) AS n FROM fy WHERE year = 2021 GROUP BY 1, 2", "2021 piles")
tr$pile <- piles$n[match(paste(round(tr$x_km, 3), round(tr$y_km, 3)), paste(piles$px, piles$py))]
tr$pile[is.na(tr$pile)] <- 1L
red_hist <- table(factor(tr$red_from, levels = years))
# Listed-firm counters per extent and year from the page's own inputs (fixed coordinates, red-from,
# filing string): shown red = present and red-from reached; dark = of those, no statement. The page
# recomputes these from treated.json and refuses to build when they differ.
for (n in names(EXT)) {
  e <- EXT[[n]]; inside <- tr$x_km >= e$xmin & tr$x_km <= e$xmax & tr$y_km >= e$ymin & tr$y_km <= e$ymax
  for (yy in years) {
    ch <- substr(tr$filed, yy - 2013, yy - 2013); red <- inside & ch != "-" & tr$red_from <= yy
    counts[[n]][[as.character(yy)]]$red <- sum(red)
    counts[[n]][[as.character(yy)]]$red_nonfilers <- sum(red & ch == "0")
    counts[[n]][[as.character(yy)]]$red_undated <- sum(red & tr$undated)
  }
}

# ---- anchors: Aeroflot (named, public list) and the nearest clean SME (never named) ------------
san_inn <- san_first$inn[grepl("aeroflot", san_first$name_alt, ignore.case = TRUE) | grepl("аэрофлот", san_first$name, ignore.case = TRUE)]
aero <- lab_query(con, sprintf("SELECT m.inn_key, m.x_km, m.y_km, m.red_from, m.inferred, m.countries_all, m.created, m.industry2, m.legal_form, m.ownership_form,
                                       (SELECT line_2110 FROM fy WHERE inn_key = m.inn_key AND year = 2021) AS rev21
                                FROM firms m WHERE m.treated AND m.inn_key IN (%s) AND m.x_km BETWEEN %.6f AND %.6f AND m.y_km BETWEEN %.6f AND %.6f ORDER BY rev21 DESC NULLS LAST LIMIT 1",
                               paste(q(san_inn), collapse = ", "), EXT$downtown$xmin, EXT$downtown$xmax, EXT$downtown$ymin, EXT$downtown$ymax), "Aeroflot")
if (nrow(aero) != 1) stop("Aeroflot not found in the downtown rectangle")
A <- aero$inn_key[1]
years_of <- function(key) lab_query(con, sprintf("SELECT year, filed, line_2110, line_1600, real_rev, pct FROM fym WHERE inn_key = %s ORDER BY year", q(key)), "anchor years")
aero_y <- years_of(A)
sme <- lab_query(con, sprintf("WITH cand AS (
    SELECT inn_key, 1000 * sqrt((arg_max(x_km, year) - %.9f)^2 + (arg_max(y_km, year) - %.9f)^2) AS dist_m,
           1000 * (max(x_km) - min(x_km) + max(y_km) - min(y_km)) AS drift_m,
           count(*) FILTER (WHERE filed AND line_2110 > 0) AS good_years, count(*) AS present_years,
           max(CASE WHEN year = 2021 THEN line_2110 END) AS rev21, any_value(industry2) AS industry2
    FROM fym WHERE NOT treated AND NOT city_level GROUP BY inn_key)
  SELECT * FROM cand WHERE good_years = 12 AND present_years = 12 AND drift_m <= 50 AND rev21 BETWEEN 50000 AND 3000000 AND industry2 NOT IN ('70', '64', '68') ORDER BY dist_m LIMIT 5", aero$x_km[1], aero$y_km[1]), "SME candidates")
if (!nrow(sme)) stop("no SME candidate")
S <- sme$inn_key[1]
sme_attr <- lab_query(con, sprintf("SELECT created, industry2, legal_form, ownership_form, x_km, y_km FROM firms WHERE inn_key = %s", q(S)), "SME attributes")
sme_y <- years_of(S)

# OKVED, legal form and ownership labels.
okv <- readxl::read_xlsx(lab_source("motion.okved-names"))
okv_code <- trimws(as.character(okv[[1]])); okv_name <- as.character(okv[[2]])
raw21 <- lab_query(con, sprintf("SELECT inn, okved FROM %s WHERE inn IN (%s)", lab_parquet_sql("rfsd.2021"), paste(q(c(A, S)), collapse = ", ")), "raw okved")
okved_text <- function(code) {   # RFSD pads the last segment to two digits (51.10.10 is the dictionary's 51.10.1); fall back to the parent code
  if (is.na(code)) return(NA_character_)
  cands <- unique(c(code, sub("(\\.\\d)0$", "\\1", code), sub("\\.\\d+$", "", code), sub("\\.\\d+$", "", sub("\\.\\d+$", "", code))))
  i <- match(cands, okv_code); i <- i[!is.na(i)]
  if (length(i)) okv_name[i[1]] else NA_character_
}
okopf <- utils::read.csv2(lab_source("motion.okopf"), header = FALSE, colClasses = "character", encoding = "UTF-8", quote = "\"")
okfs <- utils::read.csv2(lab_source("motion.okfs"), header = FALSE, colClasses = "character", encoding = "UTF-8", quote = "\"")
legal_en <- c(`12247` = "public joint-stock company", `12267` = "non-public joint-stock company", `12300` = "limited-liability company", `12200` = "joint-stock company")
own_en <- c(`16` = "private", `12` = "federal", `13` = "regional (subject of the Federation)", `14` = "municipal", `23` = "foreign", `34` = "joint private and foreign",
            `41` = "mixed Russian with a federal share", `42` = "mixed Russian with a regional share", `49` = "other mixed Russian", `53` = "foreign legal entities")
label_legal <- function(code) list(code = code, en = unname(legal_en[code]), ru = okopf$V2[match(code, gsub(" ", "", okopf$V1))])
label_own <- function(code) list(code = code, en = unname(own_en[code]), ru = okfs$V2[match(code, gsub(" ", "", okfs$V1))])
# Money in millions of rubles (RFSD lines are thousands); the SME's values are rounded to two
# significant figures so that no exact figure of an unnamed firm is printed.
signif2 <- function(x) ifelse(is.na(x), NA, signif(x, 2))
anchor_facts <- function(attr, yrs, raw_okved, exact = TRUE) list(
  x_km = attr$x_km[1], y_km = attr$y_km[1], founded = as.integer(substr(as.character(attr$created[1]), 1, 4)), industry2 = attr$industry2[1],
  okved = raw_okved, okved_text = okved_text(raw_okved), legal = label_legal(attr$legal_form[1]), ownership = label_own(attr$ownership_form[1]),
  years = data.frame(year = yrs$year, filed = yrs$filed,
                     revenue_mn = if (exact) round(yrs$line_2110 / 1e3, 1) else signif2(yrs$line_2110 / 1e3),
                     assets_mn = if (exact) round(yrs$line_1600 / 1e3, 1) else signif2(yrs$line_1600 / 1e3),
                     real_revenue_mn = if (exact) round(yrs$real_rev / 1e3, 1) else signif2(yrs$real_rev / 1e3),
                     pct = if (exact) round(yrs$pct, 1) else round(yrs$pct)))
jur_names <- c(us = "United States", eu = "European Union", gb = "United Kingdom", ca = "Canada", ch = "Switzerland", jp = "Japan", au = "Australia", nz = "New Zealand", ua = "Ukraine")
jur_tokens <- Filter(nzchar, strsplit(trimws(aero$countries_all[1]), "\\s+")[[1]])
aero_facts <- anchor_facts(aero, aero_y, raw21$okved[raw21$inn == A], exact = TRUE)
aero_facts$label <- "Aeroflot"; aero_facts$label_long <- "PJSC Aeroflot - Russian Airlines"
aero_facts$listed <- list(date = san$startDate[san$inn == A][1], year = aero$red_from[1], inferred = aero$inferred[1], jurisdictions = jur_tokens,
                          jurisdiction_names = unname(ifelse(is.na(jur_names[jur_tokens]), toupper(jur_tokens), jur_names[jur_tokens])),
                          programs_in_file = sum(san$inn == A))
sme_facts <- anchor_facts(sme_attr, sme_y, raw21$okved[raw21$inn == S], exact = FALSE)
sme_facts$label <- "a nearby private firm"; sme_facts$distance_m <- round(sme$dist_m[1]); sme_facts$drift_m <- round(sme$drift_m[1], 1); sme_facts$candidates_within_rule <- nrow(sme)

# ---- checks ----------------------------------------------------------------------------------------
dens <- motion_read_json("density")
msk_n <- dens$windows_1km$Moscow$sum_n
sq21 <- lab_query(con, sprintf("SELECT count(*) AS n FROM fy_all WHERE year = 2021 AND x_km BETWEEN %.9f AND %.9f AND y_km BETWEEN %.9f AND %.9f", MX - 45, MX + 45, MY - 45, MY + 45), "2021 inscribed square (all eligible firms)")
# Independent red-from recomputation in R: match the treated identifiers against the list file with match(),
# apply the three rules, and compare the histogram with DuckDB's (identifiers stay in memory; nothing is written).
tr_keys <- lab_query(con, "SELECT inn_key, residents, other_lists, red_from FROM firms WHERE treated", "treated keys")
r_start <- san_first$start_year[match(tr_keys$inn_key, san_first$inn)]
r_red <- ifelse(!is.na(r_start), pmax(r_start, 2014), ifelse(tr_keys$residents & !tr_keys$other_lists, 2020, 2014))
red_hist_r <- table(factor(r_red, levels = years))
pile_big <- lab_query(con, "SELECT round(x_km, 3) AS px, round(y_km, 3) AS py, count(*) AS n, count(*) FILTER (WHERE pct IS NOT NULL) AS filers, count(*) FILTER (WHERE base IS NOT NULL) AS nb, quantile_cont(pct, 0.5) AS med
                             FROM fym WHERE year = 2023 AND NOT treated AND NOT city_level GROUP BY 1, 2 ORDER BY n DESC LIMIT 1", "largest pile 2023")
m23 <- marks_for(EXT$downtown, 2023L)
pile_in_marks <- m23[m23$px == pile_big$px[1] & m23$py == pile_big$py[1], ]
expect_aero <- c(`2014` = 240.3, `2019` = 551.8, `2021` = 378.7, `2024` = 712.9)
rows_check <- do.call(rbind, lapply(names(EXT), function(n) do.call(rbind, lapply(years, function(y) { c <- counts[[n]][[as.character(y)]]
  rbind(motion_check(sprintf("%s %d: firms equal marks + city-level + treated", n, y), c$firms, c$marks_firms + c$city_level + c$treated),
        motion_check(sprintf("%s %d: drawn firms equal the three states", n, y), c$drawn, c$filers_base + c$nonfilers_base + c$nobase + c$base_filed_novalue),
        motion_check(sprintf("%s %d: outcome marks hold the baseline firms", n, y), c$filers_base + c$nonfilers_base + c$base_filed_novalue, c$marks_firms_base),
        motion_check(sprintf("%s %d: class counts sum to the filers", n, y), c$filers_base, sum(classes[[n]][[as.character(y)]]$current))) }))))
checks <- motion_checks(rows_check,
  motion_check("2021 inscribed 90 km square equals the density pass Moscow window", msk_n, sq21$n),
  motion_check("red-from histogram equals an R recomputation from the list file (max abs diff)", 0, max(abs(as.integer(red_hist) - as.integer(red_hist_r)))),
  motion_check("red-from histogram covers every treated firm", nrow(tr), sum(red_hist)),
  motion_check("treated firms counted once", nrow(tr), length(unique(tr$inn_key))),
  motion_check("largest 2023 pile reproduced in the downtown marks (n)", pile_big$n[1], if (nrow(pile_in_marks)) pile_in_marks$n[1] else -1),
  motion_check("largest 2023 pile reproduced (filers with a value)", pile_big$filers[1], if (nrow(pile_in_marks)) pile_in_marks$f[1] else -1),
  motion_check("largest 2023 pile reproduced (baseline firms)", pile_big$nb[1], if (nrow(pile_in_marks)) pile_in_marks$nb[1] else -1),
  motion_check("Aeroflot revenue 2014 (bn)", expect_aero[["2014"]], aero_facts$years$revenue_mn[aero_facts$years$year == 2014] / 1e3, 0.1),
  motion_check("Aeroflot revenue 2019 (bn)", expect_aero[["2019"]], aero_facts$years$revenue_mn[aero_facts$years$year == 2019] / 1e3, 0.1),
  motion_check("Aeroflot revenue 2021 (bn)", expect_aero[["2021"]], aero_facts$years$revenue_mn[aero_facts$years$year == 2021] / 1e3, 0.1),
  motion_check("Aeroflot revenue 2024 (bn)", expect_aero[["2024"]], aero_facts$years$revenue_mn[aero_facts$years$year == 2024] / 1e3, 0.1),
  motion_check("Aeroflot listed 2022", 2022, aero$red_from[1]),
  motion_check("Aeroflot no original 2022 filing", 0, as.integer(aero_facts$years$filed[aero_facts$years$year == 2022])),
  motion_check("align pixels at (960,540) and (960,420) are opaque white, neighbours clear", 1, as.integer(length(align_px) == 6 && all(align_px[1:4] == 1) && all(align_px[5:6] == 0))),
  motion_check("align pixels computed at col 960 rows 540 and 420", 0, abs(p0[["col"]] - 960) + abs(p0[["row"]] - 540) + abs(p1[["col"]] - 960) + abs(p1[["row"]] - 420)),
  motion_check("SME: 12 original filings with positive revenue", 12, sme$good_years[1]),
  motion_check("SME: geocode drift under 50 m", 1, as.integer(sme$drift_m[1] <= 50)),
  motion_check("72 raster files written (3 extents x 12 years x backdrop and layer)", 72, length(list.files(out_dir, pattern = "^(region|city|downtown)-.*\\.png$"))),
  motion_check("deflator 2021 equals 1", 1, deflator$defl[deflator$year == 2021], 1e-12))

# ---- save --------------------------------------------------------------------------------------------
manifest <- list(
  anchor = list(x = MX, y = MY), years = years, breaks = BREAKS, candidate_breaks = CANDIDATES, class_colours = CLASS_COLS, nonfiler = COL_NONFILER, neutral = COL_NEUTRAL, backdrop_alpha = 0.35, treated = COL_RED,
  metric = "real revenue (line 2110 times the GDP deflator rebased to 2021 = 1) as percent change against the firm's own 2019-2021 average of original filings with positive revenue (at least two of the three years)",
  metric_quantiles_2022_2024 = list(probs = c(0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95), values = round(unlist(dist$q[[1]]), 2)),
  extents = lapply(EXT, function(e) list(xmin = e$xmin, xmax = e$xmax, ymin = e$ymin, ymax = e$ymax, w_km = e$w, h_km = e$h, k = e$k, mark = e$mark)),
  files = files, align = "points/align.png", counts = counts, classes = classes,
  pile_check = list(year = 2023, x = pile_big$px[1], y = pile_big$py[1], n = pile_big$n[1], filers = pile_big$filers[1], baseline_firms = pile_big$nb[1], median_pct = round(pile_big$med[1], 2)),
  deflator = deflator,
  rules = list(red_from = "minimum sanctions-list startDate year, clamped to 2014; residents-list-only firms 2020 (Decree 35); other undated list members 2014 (author's decision 23 October 2026)",
               states = "filers_base: filed with a revenue value and a baseline (revenue-change class); nonfilers_base: baseline and no statement that year (dark control colour); nobase: no usable baseline, filed or not (faint neutral backdrop only); base_filed_novalue: baseline, filed, no revenue value (backdrop only)",
               excluded = "city-level geocodes are not drawn; treated firms are vector marks drawn by the page, not in the rasters",
               piles = "one mark per distinct coordinate (1 m); backdrop disc sized by all firms at the address, min(cap, base + s * sqrt(n - 1)); outcome disc sized by its baseline firms, a dark disc for non-filers with an inner disc scaled by sqrt(filers / baseline firms) in the filers' median class; region rasters by pixel with 2x2 and 3x3 blocks for 10+ and 100+ firms"),
  excluded_no_identifier = list(firm_years = no_id$n[1], firm_years_2021 = no_id$n2021[1]),
  notes = c("Supplied memberships are fixed lists; designation dates come from the supplied sanctions file (2,419 of 5,743 inferred, all 2023-2024); undated administrative lists are red throughout.",
            "Eligible firm-years without an identifier (excluded_no_identifier) are counted in the window check and drawn nowhere.",
            "Registered addresses, not production sites; coincident addresses are drawn as one mark sized by count.",
            "Descriptive: the control metric is a firm's own revenue path, not an estimate of any effect."))
motion_save_json(manifest, "points", checks = checks, rows = sum(vapply(counts, length, 0L)))
treated_out <- list(x = round(tr$x_km, 4), y = round(tr$y_km, 4), red_from = as.integer(tr$red_from), undated = tr$undated, inferred = tr$inferred, filed = tr$filed, state = tr$state, pile = as.integer(tr$pile),
                    red_from_counts = as.list(stats::setNames(as.integer(red_hist), names(red_hist))), n = nrow(tr), inferred_n = sum(tr$inferred), undated_n = sum(tr$undated),
                    state_key = list(`-` = "absent from the registry", b = "no usable baseline (backdrop only)", d = "baseline, no statement (dark)", `1-6` = "revenue-change class"))
motion_save_json(treated_out, "treated", rows = nrow(tr))
motion_save_json(list(a = aero_facts, b = sme_facts, distance_m = round(1000 * sqrt((aero_facts$x_km - sme_facts$x_km)^2 + (aero_facts$y_km - sme_facts$y_km)^2))), "anchors", rows = 2)
message("  SME candidates: ", nrow(sme), "; chosen at ", round(sme$dist_m[1]), " m, industry ", sme_facts$okved, " ", sme_facts$okved_text)
message("  Aeroflot: ", aero_facts$okved, " ", aero_facts$okved_text, "; listed ", aero_facts$listed$date, " (", aero_facts$listed$jurisdictions, ")")
message("  metric quantiles 2022-2024: ", paste(round(unlist(dist$q[[1]]), 1), collapse = " "))
