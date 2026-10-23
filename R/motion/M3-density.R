# M3: density and statement-availability cells from the 2021 located-points layer (firm-level job).
# Run: scripts/lab-run.sh --max 12G --duck-mem 8GB --duck-threads 8 --cpu 800% Rscript --vanilla R/motion/M3-density.R
# Input: fig27.points (3,277,638 located eligible firms of 2021: x_km, y_km, original_available; no
# identifiers). Every aggregation happens inside DuckDB; only cell counts leave it. Grids: 5 km
# nationally; 1 km inside the 90 km city windows; 250 m inside 24 km downtown windows. Shares of
# firms with a statement are kept only for cells with 50 or more firms (the project's support
# rule); 250 m cells with fewer than 3 firms are dropped; the pages band counts under 10.
source(file.path(Sys.getenv("LAB_ROOT"), "R", "lab.R")); lab_init()
source(lab_path("R", "motion", "motion-common.R"))

basemap <- motion_read_json("basemap")
cities <- as.data.frame(basemap$cities, stringsAsFactors = FALSE)   # column arrays in the JSON
con <- lab_duck_connect(); on.exit(lab_duck_disconnect(con))
pts <- lab_parquet_sql("fig27.points")
dots <- lab_read_csv("motion.dot-accounting")
views <- lab_read_csv("fig27.view-accounting")

# Production view accounting reproduced with the production inside rule (inclusive bounds) on the
# aspect-fitted insets, so the Moscow and St Petersburg counts of Figure 2.7 are matched exactly.
view_counts <- do.call(rbind, lapply(c("Moscow", "St Petersburg"), function(v) {
  w <- views[views$view == v & views$original_available == 1, ]
  q <- lab_query(con, sprintf("SELECT count(*) AS n, sum(original_available) AS a FROM %s WHERE x_km >= %.12f AND x_km <= %.12f AND y_km >= %.12f AND y_km <= %.12f",
                              pts, w$xmin_km, w$xmax_km, w$ymin_km, w$ymax_km), paste("view", v))
  data.frame(view = v, n = q$n, a = q$a)
}))

city_values <- paste(sprintf("('%s', %.9f, %.9f)", gsub("'", "''", cities$label), cities$x_km, cities$y_km), collapse = ", ")
cities_sql <- sprintf("(SELECT * FROM (VALUES %s) AS c(label, cx, cy))", city_values)

grid_national <- function(size_km) {
  q <- lab_query(con, sprintf("SELECT CAST(floor(x_km / %1$s) AS INTEGER) AS ix, CAST(floor(y_km / %1$s) AS INTEGER) AS iy, count(*) AS n, sum(original_available) AS a FROM %2$s GROUP BY 1, 2 ORDER BY 2, 1", size_km, pts), sprintf("national %g km", size_km))
  q
}
grid_windows <- function(size_km, half_km) {
  n_cells <- as.integer(round(2 * half_km / size_km))
  lab_query(con, sprintf(
    "SELECT c.label, LEAST(CAST(floor((p.x_km - (c.cx - %1$.9f)) / %2$s) AS INTEGER), %3$d) AS ix, LEAST(CAST(floor((p.y_km - (c.cy - %1$.9f)) / %2$s) AS INTEGER), %3$d) AS iy, count(*) AS n, sum(original_available) AS a
     FROM %4$s AS p JOIN %5$s AS c ON p.x_km >= c.cx - %1$.9f AND p.x_km <= c.cx + %1$.9f AND p.y_km >= c.cy - %1$.9f AND p.y_km <= c.cy + %1$.9f
     GROUP BY 1, 2, 3 ORDER BY 1, 3, 2", half_km, size_km, n_cells - 1L, pts, cities_sql), sprintf("windows %g km cells, +-%g km", size_km, half_km))
}

nat <- grid_national(5)
w1 <- grid_windows(1, 45)
w025 <- grid_windows(0.25, 12)

pack <- function(d, size_km, origin, label = NULL, min_n = 1L) {
  d <- d[d$n >= min_n, ]
  a <- as.integer(d$a); a[d$n < 50] <- -1L           # share not shown below support
  list(label = label, grid_km = size_km, origin = origin, count = nrow(d), sum_n = sum(d$n), sum_a = sum(d$a), max_n = max(d$n),
       shown_shares = sum(d$n >= 50), ix = motion_b64_int16(d$ix), iy = motion_b64_int16(d$iy), n = motion_b64_int32(d$n), a = motion_b64_int32(a))
}
windows_pack <- function(w, size_km, half_km, min_n) {
  lapply(split(w, w$label), function(d) {
    ci <- cities[cities$label == d$label[1], ]
    pack(d[, c("ix", "iy", "n", "a")], size_km, origin = c(ci$x_km - half_km, ci$y_km - half_km), label = d$label[1], min_n = min_n)
  })
}
national <- pack(nat, 5, origin = c(0, 0))
win1 <- windows_pack(w1, 1, 45, 1L)
win025 <- windows_pack(w025, 0.25, 12, 3L)
msk <- w1[w1$label == "Moscow", ]; spb <- w1[w1$label == "St Petersburg", ]
msk025 <- w025[w025$label == "Moscow", ]

checks <- motion_checks(
  motion_check("national 5 km cells: firms", dots$plotted_firms, sum(nat$n)),
  motion_check("national 5 km cells: firms with a statement", dots$located_available_firms, sum(nat$a)),
  motion_check("national 5 km cell indices fit int16", 1, as.integer(all(abs(c(nat$ix, nat$iy)) < 32767))),
  motion_check("Figure 2.7 Moscow inset: firms with a statement (fitted extent)", 459326, view_counts$a[view_counts$view == "Moscow"]),
  motion_check("Figure 2.7 Moscow inset: firms (fitted extent)", 459326 + 305912, view_counts$n[view_counts$view == "Moscow"]),
  motion_check("Figure 2.7 St Petersburg inset: firms with a statement (fitted extent)", 174063, view_counts$a[view_counts$view == "St Petersburg"]),
  motion_check("Figure 2.7 St Petersburg inset: firms (fitted extent)", 174063 + 88617, view_counts$n[view_counts$view == "St Petersburg"]),
  motion_check("1 km Moscow window indices within 0..89", 1, as.integer(all(msk$ix >= 0 & msk$ix <= 89 & msk$iy >= 0 & msk$iy <= 89))),
  motion_check("250 m Moscow window indices within 0..95", 1, as.integer(all(msk025$ix >= 0 & msk025$ix <= 95 & msk025$iy >= 0 & msk025$iy <= 95))),
  motion_check("1 km windows: 22 cities", 22, length(win1)), motion_check("250 m windows: 22 cities", 22, length(win025)),
  motion_check("Moscow 1 km window holds more firms than the 24 km downtown window", 1, as.integer(sum(msk$n) > sum(msk025$n))),
  motion_check("no empty cell", 0, sum(nat$n <= 0) + sum(w1$n <= 0) + sum(w025$n <= 0)))

summary <- data.frame(grid = c("national 5 km", paste("1 km", names(win1)), paste("250 m", names(win025))),
                      cells = c(national$count, vapply(win1, `[[`, 0, "count"), vapply(win025, `[[`, 0, "count")),
                      firms = c(national$sum_n, vapply(win1, `[[`, 0, "sum_n"), vapply(win025, `[[`, 0, "sum_n")),
                      with_statement = c(national$sum_a, vapply(win1, `[[`, 0, "sum_a"), vapply(win025, `[[`, 0, "sum_a")),
                      max_cell = c(national$max_n, vapply(win1, `[[`, 0, "max_n"), vapply(win025, `[[`, 0, "max_n")),
                      shown_shares = c(national$shown_shares, vapply(win1, `[[`, 0, "shown_shares"), vapply(win025, `[[`, 0, "shown_shares")))
message(paste(capture.output(print(summary, row.names = FALSE)), collapse = "\n"))

out <- list(
  encoding = "ix, iy: base64 little-endian int16; n, a: base64 little-endian int32; a = -1 where the share is not shown (fewer than 50 firms)",
  national = national, windows_1km = win1, windows_250m = win025, half_km = list(`1km` = 45, `250m` = 12),
  view_counts = view_counts, summary = summary,
  notes = c("2021 located eligible firms at registered addresses; a statement means the firm's own 2021 filing is in the release.",
            "Registered addresses are not production sites; coincident addresses are counted, not drawn as points.",
            "Shares are shown only for cells with 50 or more firms; 250 m cells with fewer than 3 firms are omitted; counts under 10 are banded in tooltips."))
motion_save_json(out, "density", checks = checks, rows = national$count)
lab_save_aggregate(summary, "density-summary", stage = "motion")
