# M8: the national year run of the Moscow section (round 4, 23 October 2026). Per-year point rasters of
# every located eligible firm on no list at the national rest camera (the explainer's left framing,
# k = 0.168 px per km: one pixel is 5.95 km), built as the region extent's rasters are: one pixel per
# address pixel, the outcome layer in the median relative class of the firms with a statement and a
# value there, 2x2 and 3x3 blocks for 10+ and 100+ firms, a neutral backdrop for every drawn firm; and
# the listed firms nationwide as vector-mark data for the page (coordinates, red-from, filing string, display
# names from the list files since 25 October 2026, no identifiers). Same baseline, metric, breaks and checks as M6 (M6-common.R with the national scope: the
# relative metric subtracts the year's median of the drawn firms on no list nationwide); reconciled
# against M5's annual located totals, the density pass's 2021 count and M6's Moscow outputs.
# Run: scripts/lab-run.sh --max 14G --duck-mem 9GB --duck-threads 8 --cpu 800% Rscript --vanilla R/motion/M8-national.R a rel charcoal national
source(file.path(Sys.getenv("LAB_ROOT"), "R", "lab.R")); lab_init()
source(lab_path("R", "motion", "motion-common.R"))
con <- lab_duck_connect(); on.exit(lab_duck_disconnect(con))
source(lab_path("R", "motion", "M6-common.R"))
if (SCOPE != "national") stop("M8 runs with the national scope: Rscript --vanilla R/motion/M8-national.R a rel charcoal national")
if (!CANONICAL) stop("M8 writes only the canonical variant: ramp a, the default metric, the charcoal look")
E <- NAT; DIR <- "points-national"
out_dir <- lab_dir("motion", "data", DIR)
unlink(list.files(out_dir, pattern = "\\.png$", full.names = TRUE))
pixel_key <- sprintf("least(CAST(floor((x_km - %.9f) / %.12f * 1920) AS INTEGER), 1919) AS col, least(CAST(floor((%.9f - y_km) / %.12f * 1080) AS INTEGER), 1079) AS row", E$xmin, E$w, E$ymax, E$h)

# ---- marks per pixel and year (the region extent's rule at the national camera) ----------------------
marks_for <- function(year) lab_query(con, sprintf(
  "SELECT %s, count(*) AS n, count(*) FILTER (WHERE base IS NOT NULL) AS nb, count(*) FILTER (WHERE pct IS NOT NULL) AS f,
          count(*) FILTER (WHERE base IS NOT NULL AND NOT filed) AS nfb, quantile_cont(%s, 0.5) AS med
   FROM fym WHERE NOT treated AND NOT city_level AND year = %d GROUP BY col, row", pixel_key, PCOL, year), sprintf("national %d marks", year))
files <- list(); counts <- list(); classes <- list()
for (yy in years) {
  m <- marks_for(yy)
  back <- file.path(out_dir, sprintf("national-%d-all.png", yy)); layer <- file.path(out_dir, sprintf("national-%d.png", yy))
  mo <- m[m$f > 0, ]
  draw_region(m, back, rep(COL_NEUTRAL, nrow(m)), m$n, m$n)
  draw_region(mo, layer, CLASS_COLS[class_of(mo$med)], mo$f, abs(ifelse(is.na(mo$med), 0, mo$med)))
  files[[as.character(yy)]] <- list(backdrop = paste0(DIR, "/", basename(back)), layer = paste0(DIR, "/", basename(layer)))
  tot <- lab_query(con, sprintf("SELECT count(*) AS firms, count(*) FILTER (WHERE treated) AS treated, count(*) FILTER (WHERE city_level AND NOT treated) AS city_level,
      count(*) FILTER (WHERE NOT treated AND NOT city_level) AS drawn,
      count(*) FILTER (WHERE NOT treated AND NOT city_level AND pct IS NOT NULL) AS filers_base,
      count(*) FILTER (WHERE NOT treated AND NOT city_level AND base IS NOT NULL AND NOT filed) AS nonfilers_base,
      count(*) FILTER (WHERE NOT treated AND NOT city_level AND base IS NULL) AS nobase,
      count(*) FILTER (WHERE NOT treated AND NOT city_level AND base IS NULL AND filed) AS nobase_filed,
      count(*) FILTER (WHERE NOT treated AND NOT city_level AND base IS NOT NULL AND filed AND pct IS NULL) AS base_filed_novalue,
      count(*) FILTER (WHERE NOT city_level AND base IS NOT NULL) AS with_base_all
    FROM fym WHERE year = %d", yy), sprintf("national %d totals", yy))
  located <- lab_query(con, sprintf("SELECT count(*) AS n, count(*) FILTER (WHERE inn_key IS NULL) AS no_id FROM fy_all WHERE year = %d", yy), sprintf("national %d located firm-years", yy))
  counts[[as.character(yy)]] <- c(as.list(tot), list(located_all = located$n[1], located_no_id = located$no_id[1], piles = nrow(m), piles_outcome = nrow(mo),
                                                     marks_firms = sum(m$n), marks_firms_base = sum(m$nb), marks_firms_f = sum(mo$f), blocks_2x2 = sum(block_size(m$n) == 2L), blocks_3x3 = sum(block_size(m$n) == 3L)))
  pcts <- lab_query(con, sprintf("SELECT %s AS v FROM fym WHERE NOT treated AND NOT city_level AND pct IS NOT NULL AND year = %d", PCOL, yy), sprintf("national %d filer values", yy))$v
  classes[[as.character(yy)]] <- c(list(filers = length(pcts), quantiles = round(unname(stats::quantile(pcts, c(0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95))), 1)),
                                   lapply(CANDIDATES, function(b) as.integer(tabulate(class_of(pcts, b), nbins = 6))))
  message(sprintf("  %d: %s located, %s drawn, %s with a value, %s pixels (%s outcome)", yy, format(located$n[1], big.mark = ","), format(tot$drawn, big.mark = ","), format(tot$filers_base, big.mark = ","), format(nrow(m), big.mark = ","), format(nrow(mo), big.mark = ",")))
}

# ---- listed firms nationwide: coordinates, red-from, filing and state strings, pile size ---------------
cls_sql <- paste0("1", paste(sprintf(" + CAST(y.%s > %d AS INTEGER)", PCOL, BREAKS), collapse = ""))
tr <- lab_query(con, sprintf("SELECT m.inn_key, m.x_km, m.y_km, m.red_from, m.undated, coalesce(m.inferred, false) AS inferred, m.region_model, m.start_date, coalesce(nm.name, '') AS name, coalesce(nm.name_filed, '') AS name_filed, coalesce(nm.name_case, 0) AS name_case, coalesce(nm.name_shared, 0) AS name_shared, coalesce(ms.lists, '') AS lists,
                        string_agg(CASE WHEN y.year IS NULL THEN '-' WHEN y.filed THEN '1' ELSE '0' END, '' ORDER BY g.year) AS filed,
                        string_agg(CASE WHEN y.year IS NULL THEN '-' WHEN y.pct IS NOT NULL THEN CAST(%s AS VARCHAR) WHEN y.base IS NOT NULL AND NOT y.filed THEN 'd' ELSE 'b' END, '' ORDER BY g.year) AS state
                 FROM firms m CROSS JOIN (SELECT unnest(range(2014, 2026)) AS year) g LEFT JOIN fym y ON y.inn_key = m.inn_key AND y.year = g.year LEFT JOIN listnames nm ON nm.inn = m.inn_key LEFT JOIN memberships ms ON ms.inn_key = m.inn_key
                 WHERE m.treated GROUP BY ALL", cls_sql), "treated firms nationwide")
lr <- motion_listed_revenue(); lrc <- motion_listed_revenue_cols(lr, tr$inn_key, tr$filed)
# The wire (round 10, the author's item 14): the registry region of each listed firm as an index into the crosswalk's basemap names, and the day of its listing.
xw <- utils::read.csv(lab_path("config", "regions-crosswalk.csv"), stringsAsFactors = FALSE, encoding = "UTF-8", colClasses = "character")
region_names <- unique(xw$basemap_name)
tr$region <- xw$basemap_name[match(tr$region_model, xw$region_model)]; tr$region[is.na(tr$region)] <- "region not recorded"
tr$reg <- match(tr$region, region_names) - 1L
tr$red_date <- ifelse(tr$undated | is.na(tr$start_date), "", tr$start_date)   # the sanctions file's earliest start date; members dated by the resident rule or undated carry none
   # yearly revenue and pair shares (author's request, 25 October 2026)
piles <- lab_query(con, "SELECT round(x_km, 3) AS px, round(y_km, 3) AS py, count(*) AS n FROM fy WHERE year = 2021 GROUP BY 1, 2", "2021 piles")
tr$pile <- piles$n[match(paste(round(tr$x_km, 3), round(tr$y_km, 3)), paste(piles$px, piles$py))]; tr$pile[is.na(tr$pile)] <- 1L
red_hist <- table(factor(tr$red_from, levels = years))
inside_of <- function(e) tr$x_km >= e$xmin & tr$x_km <= e$xmax & tr$y_km >= e$ymin & tr$y_km <= e$ymax
counters <- function(inside) lapply(stats::setNames(as.list(years), years), function(yy) { ch <- substr(tr$filed, yy - 2013, yy - 2013); red <- inside & ch != "-" & tr$red_from <= yy
  list(red = sum(red), red_nonfilers = sum(red & ch == "0"), red_undated = sum(red & tr$undated)) })
nat_ctr <- counters(inside_of(E)); msk_ctr <- counters(inside_of(EXT$region))
# M6's Moscow set is every listed firm with at least one row inside the region rectangle; here a firm sits
# at its latest coordinates nationwide, which places those that moved out of the rectangle elsewhere.
msk_any <- lab_query(con, sprintf("SELECT count(*) AS n FROM firms m WHERE m.treated AND EXISTS (SELECT 1 FROM fy y WHERE y.inn_key = m.inn_key AND y.x_km BETWEEN %.9f AND %.9f AND y.y_km BETWEEN %.9f AND %.9f)", EXT$region$xmin, EXT$region$xmax, EXT$region$ymin, EXT$region$ymax), "treated firms with a row in the Moscow rectangle")
for (yy in years) counts[[as.character(yy)]][c("red", "red_nonfilers", "red_undated")] <- nat_ctr[[as.character(yy)]]

# ---- checks ----------------------------------------------------------------------------------------------
cy <- motion_read_json("cellsyears")$totals
dens <- motion_read_json("density"); msk_tr <- motion_read_json("treated"); msk_pts <- motion_read_json("points")
tr_keys <- lab_query(con, "SELECT inn_key, residents, other_lists FROM firms WHERE treated", "treated keys")
r_start <- san_first$start_year[match(tr_keys$inn_key, san_first$inn)]
r_red <- ifelse(!is.na(r_start), pmax(r_start, 2014), ifelse(tr_keys$residents & !tr_keys$other_lists, 2020, 2014))
red_hist_r <- table(factor(r_red, levels = years))
pile_big <- lab_query(con, sprintf("SELECT %s, count(*) AS n, count(*) FILTER (WHERE pct IS NOT NULL) AS filers FROM fym WHERE year = 2023 AND NOT treated AND NOT city_level GROUP BY col, row ORDER BY n DESC LIMIT 1", pixel_key), "largest 2023 pixel")
m23 <- marks_for(2023L); pb <- m23[m23$col == pile_big$col[1] & m23$row == pile_big$row[1], ]
# The Moscow point under the rectangle's pixel grid and under the camera formula the page uses.
mcol <- floor((MX - E$xmin) / E$w * 1920); mrow <- floor((E$ymax - MY) / E$h * 1080)
mpx <- NATCAM$ox + (MX - NATCAM$cx) * NATCAM$k; mpy <- NATCAM$oy - (MY - NATCAM$cy) * NATCAM$k
# M6's Moscow counters: exact in 2025 (a firm's latest coordinates place it); earlier years may differ for
# firms that moved into the rectangle, whose early rows M6's rectangle-bound table does not see. Recorded.
m6_region <- function(yy, f) msk_pts$counts$region[[as.character(yy)]][[f]]
msk_diff <- lapply(stats::setNames(as.list(years), years), function(yy) list(red = msk_ctr[[as.character(yy)]]$red - m6_region(yy, "red"), red_nonfilers = msk_ctr[[as.character(yy)]]$red_nonfilers - m6_region(yy, "red_nonfilers")))
rows_check <- do.call(rbind, lapply(years, function(y) { c <- counts[[as.character(y)]]; i <- match(y, cy$year)
  rbind(motion_check(sprintf("%d: firms equal marks + city-level + treated", y), c$firms, c$marks_firms + c$city_level + c$treated),
        motion_check(sprintf("%d: drawn firms equal the three states", y), c$drawn, c$filers_base + c$nonfilers_base + c$nobase + c$base_filed_novalue),
        motion_check(sprintf("%d: outcome marks hold the firms with a statement and a value", y), c$filers_base, c$marks_firms_f),
        motion_check(sprintf("%d: class counts sum to the filers", y), c$filers_base, sum(classes[[as.character(y)]]$current)),
        motion_check(sprintf("%d: located eligible firms equal M5's located total", y), cy$n_located[i], c$located_all)) }))
checks <- motion_checks(rows_check,
  motion_check("2021 located firms equal the density pass's national count", dens$national$sum_n, counts[["2021"]]$located_all),
  motion_check("red-from histogram equals an R recomputation from the list file (max abs diff)", 0, max(abs(as.integer(red_hist) - as.integer(red_hist_r)))),
  motion_check("red-from histogram covers every treated firm", nrow(tr), sum(red_hist)),
  motion_check("treated firms counted once", nrow(tr), length(unique(tr$inn_key))),
  motion_check("listed firms with a row in the Moscow rectangle equal M6's treated.json", msk_tr$n, msk_any$n[1]),
  motion_check("Moscow rectangle 2025 red counter equals M6's", m6_region(2025, "red"), msk_ctr[["2025"]]$red),
  motion_check("Moscow rectangle 2025 red firms without a statement equal M6's", m6_region(2025, "red_nonfilers"), msk_ctr[["2025"]]$red_nonfilers),
  motion_check("largest 2023 pixel reproduced in the marks (n)", pile_big$n[1], if (nrow(pb)) pb$n[1] else -1),
  motion_check("largest 2023 pixel reproduced (filers with a value)", pile_big$filers[1], if (nrow(pb)) pb$f[1] else -1),
  motion_check("the Moscow point's pixel agrees with the camera formula (px)", mpx, mcol + 0.5, 1),
  motion_check("the Moscow point's pixel agrees with the camera formula (py)", mpy, mrow + 0.5, 1),
  motion_check("the rectangle contains the basemap's national extent", 1, as.integer(E$xmin <= basemap$extents$national$x[1] && E$xmax >= basemap$extents$national$x[2] && E$ymin <= basemap$extents$national$y[1] && E$ymax >= basemap$extents$national$y[2])),
  motion_check("24 raster files written (12 years x backdrop and layer)", 24, length(list.files(out_dir, pattern = "^national-.*\\.png$"))),
  motion_check("deflator 2021 equals 1", 1, deflator$defl[deflator$year == 2021], 1e-12))

# ---- save -------------------------------------------------------------------------------------------------
manifest <- list(
  scope = "national", camera = NATCAM,
  extent = list(xmin = E$xmin, xmax = E$xmax, ymin = E$ymin, ymax = E$ymax, w_km = E$w, h_km = E$h, k = E$k, mark = E$mark, px_km = 1 / E$k),
  years = years, breaks = BREAKS, class_colours = CLASS_COLS, neutral = COL_NEUTRAL, zero = COL_ZERO, backdrop_alpha = BACKDROP_ALPHA, layer_alpha = LAYER_ALPHA, treated = COL_RED,
  metric_kind = METRIC_TEXT$kind, metric = METRIC_TEXT$description, metric_median_by_year = yearmed, moscow_median_by_year = msk_pts$metric_median_by_year,
  files = files, counts = counts, classes = classes,
  moscow_pixel = list(col = mcol, row = mrow, px = mpx, py = mpy), moscow_counters_minus_m6 = msk_diff,
  moscow_rectangle = list(firms_with_a_row = msk_any$n[1], firms_by_latest_coordinates = sum(inside_of(EXT$region)), m6_treated = msk_tr$n),
  pile_check = list(year = 2023, col = pile_big$col[1], row = pile_big$row[1], n = pile_big$n[1], filers = pile_big$filers[1]),
  rules = list(pixel = "one pixel (5.95 km) per address pixel: the backdrop holds every located eligible firm on no list below city-level geocodes, neutral; the outcome layer holds the pixels with at least one firm with a statement and a revenue value, in the median class of those firms' relative change; piles of 10+ firms widen to 2x2 and 100+ to 3x3 blocks; listed firms are vector marks drawn by the page",
               median = "the relative metric subtracts the year's median of the drawn firms on no list nationwide (metric_median_by_year); the Moscow extents subtract Moscow's (moscow_median_by_year)",
               excluded = "city-level geocodes are not drawn (counted); eligible firm-years without an identifier are counted in located_all and drawn nowhere"),
  notes = c("Registered addresses, not production sites; a pixel is a 5.95 km square of the left framing, so a city's firms share a few pixels.",
            "Descriptive: the control metric is a firm's own revenue path, not an estimate of any effect."))
motion_save_json(manifest, "national", checks = checks, rows = length(years))
treated_out <- list(x = round(tr$x_km, 4), y = round(tr$y_km, 4), red_from = as.integer(tr$red_from), undated = tr$undated, inferred = tr$inferred, red_date = tr$red_date, reg = as.integer(tr$reg), regions = region_names, filed = tr$filed, state = tr$state, pile = as.integer(tr$pile),
                      name = tr$name, name_filed = tr$name_filed, name_case = as.integer(tr$name_case), name_shared = as.integer(tr$name_shared), lists = tr$lists, names_summary = motion_names_summary(tr),
                      rev_m = lrc$rev_m, psh = lrc$psh, revenue_note = MOTION_REVENUE_NOTE, revenue_counts = list(firm_years_with_value = lrc$n_with_value, firm_years_with_pair_share = lrc$n_with_share, firms_with_any_value = lrc$firms_with_any_value),
                    red_from_counts = as.list(stats::setNames(as.integer(red_hist), names(red_hist))), n = nrow(tr), inferred_n = sum(tr$inferred), undated_n = sum(tr$undated),
                    moscow_rectangle_n = sum(inside_of(EXT$region)),
                    state_key = list(`-` = "absent from the registry", b = "no usable baseline (backdrop only)", d = "baseline, no statement", `1-6` = "revenue-change class, national median"))
motion_save_json(treated_out, "treatednational", rows = nrow(tr),
                 checks = motion_checks(motion_name_checks(tr), lrc$checks,
                                        motion_check("reg: every listed firm has a region index", 0, sum(is.na(tr$reg))),
                                        motion_check("reg: the index points into the region list", 0, sum(tr$reg < 0 | tr$reg >= length(region_names))),
                                        motion_check("red_date: an ISO day for every dated listing, none otherwise", 0, sum(ifelse(!tr$undated & !is.na(tr$start_year), !grepl("^\\d{4}-\\d{2}-\\d{2}$", tr$red_date), nzchar(tr$red_date)))),
                                        motion_check("red_date: the year agrees with red_from for listings since 2014", 0, sum(nzchar(tr$red_date) & as.integer(substr(tr$red_date, 1, 4)) >= 2014 & as.integer(substr(tr$red_date, 1, 4)) != tr$red_from)),
                                        motion_check("lists: the resident code agrees with the firms table", 0, sum(grepl("r", tr$lists, fixed = TRUE) != tr_keys$residents[match(tr$inn_key, tr_keys$inn_key)])),
                                        motion_check("lists: the other-list codes agree with the firms table", 0, sum(grepl("[sdgp]", tr$lists) != tr_keys$other_lists[match(tr$inn_key, tr_keys$inn_key)]))))
message(sprintf("  listed firms nationwide: %d (%d in the Moscow rectangle); Moscow point at pixel %d,%d (camera %.1f,%.1f)", nrow(tr), sum(inside_of(EXT$region)), mcol, mrow, mpx, mpy))
