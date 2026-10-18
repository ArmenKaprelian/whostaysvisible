# Figure 2.7 gallery, 18 October 2026 (review Points 20 and 22). Loaders, checks, marks,
# layouts and saving for the design candidates. Source after R/lab.R, lab_init() and
# R/fig28/fig28-common.R (for fig28_production(), the classed navy and the tile helpers).
# Base graphics, as in the production figure (chapter2-reconcile-refine-maps.R,
# c2rr_map_candidate1), whose projection, basemap, extent fit and point raster are reused
# read-only from their own environment. Nothing here is a manuscript source or an authorization.

fig27_dir <- "20261018-fig27-gallery"
fig27_navy <- "#16436E"          # production colour of the available panel; the population here
fig27_absent <- "#123F35"        # production colour of the absent panel (design B keeps it)
fig27_green <- "#004B3C"         # phthalo green of the palette rule (LaTeX/AGENTS.md line 78)
fig27_brick <- "#B35832"         # warm brick, the established overlay colour (prototype geo-05)
fig27_gray <- "#CDD3D0"          # production colour for cells below support
fig27_ink <- "#24323D"

# Points, accounting, views and basemap, with the production's own consistency checks.
fig27_inputs <- function(c2rr) {
  con <- lab_duck_connect(); on.exit(lab_duck_disconnect(con))
  points <- lab_query(con, sprintf("SELECT x_km, y_km, original_available FROM %s", lab_parquet_sql("fig27.points")), "points")
  acc <- lab_read_csv("fig27.population-accounting")
  views_acc <- lab_read_csv("fig27.view-accounting")
  if (nrow(acc) != 1L || nrow(points) != acc$plotted_firms || any(!is.finite(as.matrix(points[c("x_km", "y_km")]))))
    stop("Point coordinates or saved population counts disagree.")
  if (anyNA(points$original_available) || any(!points$original_available %in% 0:1) || acc$located_unknown_firms != 0)
    stop("Unknown located availability needs review.")
  if (sum(points$original_available == 1) != acc$located_available_firms ||
      sum(points$original_available == 0) != acc$located_absent_firms ||
      acc$plotted_firms + acc$unlocated_firms != acc$eligible_firms) stop("Original-availability accounting failed.")
  manifest <- jsonlite::fromJSON(lab_source("fig28.manifest"))
  views <- manifest$base_extents
  nat <- list(x = range(points$x_km) + c(-100, 100), y = range(points$y_km) + c(-100, 100))
  if (max(abs(c(nat$x - views$national$x, nat$y - views$national$y))) > 1e-6) stop("Manifest national extent differs from the points.")
  basemap <- c2rr$c2rr_map_basemap(lab_source("fig28.basemap", verify_hash = TRUE))
  list(points = points, accounting = acc, views_accounting = views_acc, views = views, basemap = basemap, manifest = manifest)
}

# 2021 cells with supplied-list counts (October geographic review), one grid size.
fig27_list_cells <- function(grid_km = 50) {
  cells <- lab_read_csv("fig27.cells-lists-2021")
  d <- cells[cells$year == 2021 & cells$grid_km == grid_km & cells$quality_scope == "all", ]
  d <- d[order(-d$n_sanctioned), c("ix", "iy", "x_km", "y_km", "n_eligible", "n_available", "n_sanctioned", "n_govstrategic", "n_admin")]
  rownames(d) <- NULL
  d
}

# List totals from the saved membership overlap: eligible and located, per list and on both.
fig27_list_totals <- function() {
  m <- lab_read_csv("fig27.membership-overlap")
  m <- m[!is.na(m$member_sanctioned), ]
  s <- m$member_sanctioned == 1; g <- m$member_strateg_government == 1
  data.frame(list = c("sanctions list", "government strategic list", "both lists"),
             eligible = c(sum(m$n[s]), sum(m$n[g]), sum(m$n[s & g])),
             located = c(sum(m$n_located[s]), sum(m$n_located[g]), sum(m$n_located[s & g])))
}

fig27_list_checks <- function(d50, d100, totals, acc) {
  data.frame(
    check = c("50 km cells", "100 km cells", "located eligible in 50 km cells", "located eligible in 100 km cells",
              "located sanctions-list firms (50 km)", "located sanctions-list firms (100 km)",
              "located government-strategic firms (50 km)", "located government-strategic firms (100 km)",
              "eligible sanctions-list firms (overlap table)", "eligible government-strategic firms (overlap table)",
              "located on both lists", "located sanctions-list firms (overlap table)", "located government-strategic firms (overlap table)"),
    expected = c(3006, 1157, acc$plotted_firms, acc$plotted_firms, 3466, 3466, 953, 953, 3550, 982, 507, 3466, 953),
    observed = c(nrow(d50), nrow(d100), sum(d50$n_eligible), sum(d100$n_eligible),
                 sum(d50$n_sanctioned), sum(d100$n_sanctioned), sum(d50$n_govstrategic), sum(d100$n_govstrategic),
                 totals$eligible[1], totals$eligible[2], totals$located[3], totals$located[1], totals$located[2]),
    tolerance = 0)
}

# Availability change 2024 minus 2021 per 100 km cell, supported when both years hold at
# least 50 located eligible firms. Classes: six, symmetric, boundaries at -5, -2, 0, +2, +5 points.
fig27_change_breaks <- c(-5, -2, 0, 2, 5)
fig27_change_cells <- function() {
  cells <- lab_read_csv("fig27.cells-years")
  cells <- cells[cells$grid_km == 100 & cells$quality_scope == "all", ]
  a <- cells[cells$year == 2021, c("ix", "iy", "x_km", "y_km", "n_eligible", "n_available")]
  b <- cells[cells$year == 2024, c("ix", "iy", "x_km", "y_km", "n_eligible", "n_available")]
  names(a)[5:6] <- c("n_eligible_2021", "n_available_2021"); names(b)[5:6] <- c("n_eligible_2024", "n_available_2024")
  d <- merge(a, b, by = c("ix", "iy", "x_km", "y_km"), all = TRUE)
  for (v in c("n_eligible_2021", "n_available_2021", "n_eligible_2024", "n_available_2024")) d[[v]][is.na(d[[v]])] <- 0L
  d$share_2021 <- ifelse(d$n_eligible_2021 > 0, 100 * d$n_available_2021 / d$n_eligible_2021, NA)
  d$share_2024 <- ifelse(d$n_eligible_2024 > 0, 100 * d$n_available_2024 / d$n_eligible_2024, NA)
  d$supported <- d$n_eligible_2021 >= 50 & d$n_eligible_2024 >= 50
  d$change_pp <- ifelse(d$supported, d$share_2024 - d$share_2021, NA)
  d$class <- ifelse(d$supported, as.integer(cut(d$change_pp, c(-Inf, fig27_change_breaks, Inf), labels = FALSE, right = TRUE)), NA)
  d <- d[order(d$iy, d$ix), ]; rownames(d) <- NULL
  d
}

fig27_change_checks <- function(d) {
  cov <- lab_read_csv("fig27.coverage-years")
  sup <- d[d$supported, ]
  data.frame(
    check = c("cells in either year", "located eligible 2021", "located available 2021", "located eligible 2024", "located available 2024",
              "coverage table located 2021", "coverage table located 2024", "supported cells (both years >= 50)",
              "supported in 2021 only", "supported in 2024 only", "classes used", "zero is a class boundary",
              "share recomputes 2021", "share recomputes 2024"),
    expected = c(1193, 3277638, 2097055, 3083823, 2051002, 3277638, 3083823, 658, 9, 12, 6, 1, 0, 0),
    observed = c(nrow(d), sum(d$n_eligible_2021), sum(d$n_available_2021), sum(d$n_eligible_2024), sum(d$n_available_2024),
                 cov$n_located[cov$year == 2021], cov$n_located[cov$year == 2024], nrow(sup),
                 sum(d$n_eligible_2021 >= 50 & d$n_eligible_2024 < 50), sum(d$n_eligible_2024 >= 50 & d$n_eligible_2021 < 50),
                 length(unique(sup$class)), as.integer(0 %in% fig27_change_breaks),
                 max(abs(sup$share_2021 - 100 * sup$n_available_2021 / sup$n_eligible_2021)),
                 max(abs(sup$share_2024 - 100 * sup$n_available_2024 / sup$n_eligible_2024))),
    tolerance = c(rep(0, 12), 1e-9, 1e-9))
}

# Diverging palette: the three darkest navy classes of the Figure 2.8 study's C1 plus a
# light step, and the brick side matched in OKLCH lightness and chroma (fig28_match_hue).
fig27_change_palette <- function() {
  navy <- c("#A9C4DE", "#6E9AC2", "#2F6395")      # 0 to +2, +2 to +5, over +5
  brick <- fig28_match_hue(navy, fig27_brick)      # -2 to 0, -5 to -2, under -5
  list(hex = c(rev(brick), navy), navy = navy, brick = brick,
       labels = c("under -5", "-5 to -2", "-2 to 0", "0 to +2", "+2 to +5", "over +5"))
}

# Proportional circles for list members per cell: area proportional to the count, with a
# floor so that single-firm cells stay visible (the smallest cells share one mark; the note says how many).
fig27_radius_pt <- function(n) pmax(0.95, 0.42 * sqrt(n))
fig27_marks <- function(d, n, km_per_pt, kind = c("disc", "ring"), col = fig27_brick) {
  kind <- match.arg(kind)
  keep <- n > 0; d <- d[keep, ]; n <- n[keep]
  o <- order(-n); d <- d[o, ]; n <- n[o]
  r <- fig27_radius_pt(n) * km_per_pt
  if (kind == "disc") {
    graphics::symbols(d$x_km, d$y_km, circles = r, inches = FALSE, add = TRUE, bg = col, fg = "white", lwd = .5)
  } else {
    graphics::symbols(d$x_km, d$y_km, circles = r, inches = FALSE, add = TRUE, bg = NA, fg = "white", lwd = 2.2)
    graphics::symbols(d$x_km, d$y_km, circles = r, inches = FALSE, add = TRUE, bg = NA, fg = col, lwd = 1.0)
  }
}

# A circle of radius r_pt on the unit-square page of 6.5 x H inches.
fig27_page_circle <- function(x, y, r_pt, H, col = fig27_brick, border = "white", lwd = .5) {
  t <- seq(0, 2 * pi, length.out = 72)
  graphics::polygon(x + r_pt / 468 * cos(t), y + r_pt / (72 * H) * sin(t), col = col, border = border, lwd = lwd)
}
fig27_page_ring <- function(x, y, r_pt, H, col = fig27_brick) {
  t <- seq(0, 2 * pi, length.out = 72)
  graphics::polygon(x + r_pt / 468 * cos(t), y + r_pt / (72 * H) * sin(t), col = NA, border = "white", lwd = 2.2)
  graphics::polygon(x + r_pt / 468 * cos(t), y + r_pt / (72 * H) * sin(t), col = NA, border = col, lwd = 1.0)
}

# Legend row for the marks: reference circles 1, 10, 100, 1,000 and the list symbols.
fig27_mark_legend <- function(x, y, H, two_marks = TRUE, cex = 1) {
  sizes <- c(1, 10, 100, 1000); r <- fig27_radius_pt(sizes)
  graphics::text(x, y, "Firms per 50 km cell", adj = c(0, .5), cex = cex)
  cx <- x + .20
  for (k in seq_along(sizes)) {
    cx <- cx + (if (k == 1) 0 else (r[k - 1] + r[k]) / 468 + .012)
    fig27_page_circle(cx, y, r[k], H)
    graphics::text(cx + r[k] / 468 + .006, y, format(sizes[k], big.mark = ","), adj = c(0, .5), cex = cex)
    cx <- cx + .030 + nchar(format(sizes[k], big.mark = ",")) * .0115
  }
  if (two_marks) {
    cx <- cx + .02
    fig27_page_circle(cx, y, 4, H); graphics::text(cx + .014, y, "sanctions list", adj = c(0, .5), cex = cex)
    cx <- cx + .185
    fig27_page_ring(cx, y, 4, H); graphics::text(cx + .014, y, "government strategic list", adj = c(0, .5), cex = cex)
  }
}

# Back to the page layer after a panel: plot.new() resets the clipping region to the page.
fig27_page_layer <- function() {
  graphics::par(fig = c(0, 1, 0, 1), mar = rep(0, 4), new = TRUE)
  graphics::plot.new(); graphics::plot.window(c(0, 1), c(0, 1))
}

fig27_page <- function() {
  graphics::par(fig = c(0, 1, 0, 1), mar = c(0, 0, 0, 0), cex = 1, family = lab_font,
                fg = fig27_ink, col = fig27_ink, xaxs = "i", yaxs = "i")
  graphics::plot.new(); graphics::plot.window(c(0, 1), c(0, 1))
}

# Rectangles (par fig fractions) and text anchors for a page of height H inches, with a
# national band nat_h inches tall (production 2.52). Positions are inches from the bottom
# edge; fig() converts. Insets keep the production column (.80-.975) and share the band.
fig27_layout <- function(H, two_panels = TRUE, nat_h = 2.52, line_in = 0.155) {
  nat_w <- c(.035, .775); inset_w <- c(.80, .975)
  h_in <- (nat_h - 0.49) / 2                           # inset height: two insets, labels between
  panel <- function(y_top) {
    nat_top <- y_top - 0.33
    list(title = y_top, subtitle = y_top - 0.19, nat = c(nat_top - nat_h, nat_top),
         moscow_label = y_top - 0.19, moscow = c(nat_top - 0.16 - h_in, nat_top - 0.16),
         petersburg_label = nat_top - 0.16 - h_in - 0.03, petersburg = c(nat_top - nat_h, nat_top - nat_h + h_in))
  }
  p1 <- panel(H - 0.17)
  out <- list(H = H, nat_h = nat_h, h_in = h_in, nat_w = nat_w, inset_w = inset_w, p1 = p1, line_in = line_in)
  if (two_panels) out$p2 <- panel(p1$nat[1] - 0.05)
  out$bottom <- if (two_panels) out$p2$nat[1] else p1$nat[1]
  out$y <- function(inch) inch / H
  out$fig <- function(xr, yr) c(xr, yr / H)
  out$rects <- function(p) list(national = out$fig(nat_w, p$nat), Moscow = out$fig(inset_w, p$moscow),
                                `St Petersburg` = out$fig(inset_w, p$petersburg))
  out
}

# Panel extents for a set of rects (fig fractions) on a page of height H: production fit.
fig27_extents <- function(c2rr, views, rects, H) {
  ex <- lapply(names(rects), function(v) { r <- rects[[v]]; c2rr$c2rr_map_fit_extent(views[[v]], 6.5 * diff(r[1:2]) / (H * diff(r[3:4]))) })
  names(ex) <- names(rects); ex
}

# Text that must fit: stops when a line is wider than the room, so wording gets fixed
# instead of the size being reduced below the floor.
fig27_text <- function(x, y, labels, room = .975 - x, cex = 1, adj = c(0, 1), ...) {
  w <- graphics::strwidth(labels, cex = cex)
  if (any(w > room)) stop("Text does not fit (", paste(sprintf("%.2f > %.2f", w[w > room], room), collapse = "; "), "): ", labels[which(w > room)[1]])
  graphics::text(x, y, labels, adj = adj, cex = cex, ...)
}

# Draw one map panel: background, equal-point raster(s), marks. rect in fig fractions.
fig27_panel <- function(c2rr, basemap, extent, rect, H, rasters = list(), marks = NULL, box = FALSE) {
  graphics::par(fig = rect, mar = rep(0, 4), new = TRUE)
  c2rr$c2rr_map_background(basemap, extent)
  for (r in rasters) graphics::rasterImage(r, extent$x[1], extent$y[1], extent$x[2], extent$y[2], interpolate = FALSE)
  if (!is.null(marks)) {
    km_per_pt <- diff(extent$x) / (6.5 * diff(rect[1:2]) * 72)
    for (m in marks) fig27_marks(m$cells, m$n, km_per_pt, m$kind, m$col)
  }
  if (box) graphics::box(col = "#AFBBB5", lwd = .4)
}

# Equal-point rasters for every view at the panel's inch size; returns images and counts.
fig27_rasters <- function(c2rr, points, extents, rects, H, color) {
  out <- list(); counts <- list()
  for (view in names(rects)) {
    r <- rects[[view]]; ex <- extents[[view]]
    layer <- c2rr$c2rr_map_point_raster(points, ex, 6.5 * diff(r[1:2]), H * diff(r[3:4]), color)
    if (view == "national" && layer$assigned_rows != nrow(points)) stop("National extent dropped a located eligible firm.")
    out[[view]] <- layer$image
    counts[[view]] <- data.frame(view = view, firms = layer$assigned_rows, occupied_pixels = layer$occupied_pixels,
                                 raster_columns = layer$nx, raster_rows = layer$ny, dpi = layer$dpi)
  }
  list(images = out, counts = do.call(rbind, counts))
}

fig27_count <- function(x) format(x, big.mark = ",", scientific = FALSE, trim = TRUE)

# Notes drawn into the PDF (attribution lines are a licence requirement); the rest of the
# figure note belongs in the LaTeX snippet beside it.
fig27_attribution <- c("Boundaries: geoBoundaries.org gbOpen; OpenStreetMap/Wambacher (2017), ODbL 1.0.",
                       "© OpenStreetMap contributors; https://www.openstreetmap.org/copyright")

# One candidate: PDF at 6.5 x H in, provenance sidecar, notes snippet; PNG previews come from
# scripts/fig27-postprocess.sh. draw() receives nothing; params are recorded in the JSON.
fig27_save_figure <- function(id, draw, H, notes_tex, params = list(), label = "") {
  out <- lab_dir("figures", fig27_dir)
  pdf <- file.path(out, paste0(id, ".pdf"))
  grDevices::cairo_pdf(pdf, width = 6.5, height = H, pointsize = 10.5, family = lab_font, onefile = TRUE)
  tryCatch(draw(), finally = grDevices::dev.off())
  notes_path <- lab_write_notes(pdf, notes_tex)
  prov <- lab_provenance(id, .lab$used_sources, extra = params)
  prov$output <- list(pdf = pdf, pdf_sha256 = lab_sha256(pdf), width_in = 6.5, height_in = H, pointsize = 10.5,
                      font = lab_font, notes_tex = notes_path, label = label)
  jsonlite::write_json(prov, file.path(out, paste0(id, ".json")), auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null")
  message(sprintf("  figure %s: %s (%.0f kB, %.2f in tall)", id, basename(pdf), file.info(pdf)$size / 1e3, H))
  invisible(pdf)
}
