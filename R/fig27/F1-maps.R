# F1: Figure 2.7 design candidates (review Point 20, designs A and B), the availability-change
# map (Point 22) and a composite page, from the pinned inputs. Writes data/fig27/* with
# provenance and checks, then figures/20261018-fig27-gallery/*.pdf and variants.csv.
# Run (guarded; the point parquet has 3.28 million rows):
#   scripts/ram-status.sh && scripts/lab-run.sh Rscript --vanilla R/fig27/F1-maps.R
source(file.path(Sys.getenv("LAB_ROOT"), "R", "lab.R")); lab_init()
source(lab_path("R", "fig28", "fig28-common.R"))
source(lab_path("R", "fig27", "fig27-common.R"))
c2rr <- fig28_production()
inputs <- fig27_inputs(c2rr)
acc <- inputs$accounting; views <- inputs$views; basemap <- inputs$basemap; pts <- inputs$points
count <- fig27_count

# Aggregates and checks ----------------------------------------------------------------
d50 <- fig27_list_cells(50); d100 <- fig27_list_cells(100); totals <- fig27_list_totals()
lab_save_aggregate(rbind(cbind(grid_km = 50, d50), cbind(grid_km = 100, d100)), "fig27-list-cells-2021", stage = "fig27",
                   checks = fig27_list_checks(d50, d100, totals, acc))
lab_save_aggregate(totals, "fig27-list-totals-2021", stage = "fig27")
chg <- fig27_change_cells()
chg_checks <- fig27_change_checks(chg)
pal <- fig27_change_palette()
class_counts <- as.data.frame(table(class = chg$class[chg$supported]), stringsAsFactors = FALSE)
class_counts$label <- pal$labels[as.integer(class_counts$class)]
lab_save_aggregate(chg, "fig27-availability-change-cells", stage = "fig27", checks = chg_checks,
                   extra = list(breaks_pp = fig27_change_breaks, class_counts = class_counts))
pal_df <- data.frame(class = 1:6, label = pal$labels, hex = toupper(pal$hex), oklab_L = round(fig28_oklab_L(pal$hex), 4))
validation <- rbind(fig28_validate("change-navy-side", pal$navy, "ordinal"), fig28_validate("change-brick-side", pal$brick, "ordinal"),
                    fig28_validate("change-all-six", pal$hex, "all-pairs"))
lab_save_aggregate(pal_df, "fig27-change-palette", stage = "fig27", extra = list(validation = validation))
sup <- chg[chg$supported, ]
share21 <- 100 * sum(chg$n_available_2021) / sum(chg$n_eligible_2021); share24 <- 100 * sum(chg$n_available_2024) / sum(chg$n_eligible_2024)
share21s <- 100 * sum(sup$n_available_2021) / sum(sup$n_eligible_2021); share24s <- 100 * sum(sup$n_available_2024) / sum(sup$n_eligible_2024)
message(sprintf("located availability share: %.1f%% (2021) -> %.1f%% (2024); supported cells %.1f%% -> %.1f%%", share21, share24, share21s, share24s))

view_n <- function(state = NULL, view) {   # firms in a zoom window, from the saved view accounting
  v <- inputs$views_accounting; v <- v[v$view == view, ]
  if (is.null(state)) sum(v$firms) else v$firms[v$original_available == state]
}
moscow_all <- view_n(NULL, "Moscow"); petersburg_all <- view_n(NULL, "St Petersburg")
stopifnot(moscow_all == 459326 + 305912, petersburg_all == 174063 + 88617)

# Shared drawing pieces ------------------------------------------------------------------
all_located <- pts[, c("x_km", "y_km")]
avail <- pts[pts$original_available == 1, c("x_km", "y_km")]; absent <- pts[pts$original_available == 0, c("x_km", "y_km")]
raster_cache <- list()
rasters_for <- function(key, points, extents, rects, H, color) {
  id <- paste(key, round(H, 3), paste(round(unlist(rects), 5), collapse = ","), color)
  if (is.null(raster_cache[[id]])) raster_cache[[id]] <<- fig27_rasters(c2rr, points, extents, rects, H, color)
  raster_cache[[id]]
}
marks_sanction <- list(cells = d50, n = d50$n_sanctioned, kind = "disc", col = fig27_brick)
marks_gov_ring <- list(cells = d50, n = d50$n_govstrategic, kind = "ring", col = fig27_brick)
marks_gov_disc <- list(cells = d50, n = d50$n_govstrategic, kind = "disc", col = fig27_brick)

# One population block: title, subtitle, national map with insets and marks.
draw_block <- function(L, p, H, title, subtitle, pop_points, pop_color, marks, inset_counts, key) {
  rects <- L$rects(p); ex <- fig27_extents(c2rr, views, rects, H)
  ras <- rasters_for(key, pop_points, ex, rects, H, pop_color)
  fig27_page_layer()
  fig27_text(.035, L$y(p$title), title, cex = 1.1, font = 2)
  fig27_text(.035, L$y(p$subtitle), subtitle, room = .74)
  fig27_text(.80, L$y(p$moscow_label), paste0("Moscow\nN = ", count(inset_counts[1])), room = .175)
  fig27_text(.80, L$y(p$petersburg_label), paste0("St Petersburg\nN = ", count(inset_counts[2])), room = .175)
  for (v in names(rects)) fig27_panel(c2rr, basemap, ex[[v]], rects[[v]], H, rasters = list(ras$images[[v]]), marks = marks, box = v != "national")
  invisible(ras$counts)
}

# The list legend rows (sizes, then symbols with counts) and the notes block.
draw_mark_legends <- function(L, y_sizes, y_lists, two_marks = TRUE, which_lists = c("sanctions", "government")) {
  fig27_page_layer()
  H <- L$H
  sizes <- c(1, 10, 100, 1000); r <- fig27_radius_pt(sizes)
  graphics::text(.035, L$y(y_sizes), "Firms per 50 km cell:", adj = c(0, .5))
  cx <- .035 + graphics::strwidth("Firms per 50 km cell:  ") + r[1] / 468
  for (k in seq_along(sizes)) {
    if (k > 1) cx <- cx + r[k] / 468
    fig27_page_circle(cx, L$y(y_sizes), r[k], H)
    lab <- format(sizes[k], big.mark = ",")
    graphics::text(cx + r[k] / 468 + .008, L$y(y_sizes), lab, adj = c(0, .5))
    cx <- cx + r[k] / 468 + .008 + graphics::strwidth(lab) + .022
  }
  if (!is.null(y_lists)) {
    cx <- .035 + 4 / 468
    if ("sanctions" %in% which_lists) {
      fig27_page_circle(cx, L$y(y_lists), 4, H)
      lab <- sprintf("sanctions list, %s of %s firms located", count(totals$located[1]), count(totals$eligible[1]))
      graphics::text(cx + 4 / 468 + .010, L$y(y_lists), lab, adj = c(0, .5)); cx <- cx + 4 / 468 + .010 + graphics::strwidth(lab) + .055
    }
    if ("government" %in% which_lists) {
      if (two_marks) fig27_page_ring(cx, L$y(y_lists), 4, H) else fig27_page_circle(cx, L$y(y_lists), 4, H)
      lab <- sprintf("government strategic list, %s of %s", count(totals$located[2]), count(totals$eligible[2]))
      graphics::text(cx + 4 / 468 + .010, L$y(y_lists), lab, adj = c(0, .5))
    }
  }
}
draw_notes <- function(L, lines, y_top = L$notes_top) {
  fig27_page_layer()
  fig27_text(.035, L$y(y_top - L$line_in * (seq_along(lines) - 1)), lines)
}
note_pop <- sprintf("%s of %s eligible firms located (%.1f%%); %s unlocated. RFSD v3.1.0.",
                    count(acc$plotted_firms), count(acc$eligible_firms), 100 * acc$plotted_firms / acc$eligible_firms, count(acc$unlocated_firms))
note_points <- "Equal points; overlap hides multiplicity; insets repeat firms. Registered addresses."
note_marks <- "Brick: list members per 50 km cell, area proportional to count; lists overlap."
shared_n <- max(which(fig27_radius_pt(1:100) <= fig27_radius_pt(1) + 1e-9))
note_lists <- sprintf("Lists are undated supplied labels, not designation dates; 1 to %d firms share a mark.", shared_n)
note_change <- "Change compares the 2021 and 2024 annual populations at registered addresses, not firms."
latex_common <- paste("Equal-sized points show located eligible firms; coincident coordinates overlap and the insets repeat national firms.",
  sprintf("Brick circles place supplied-list members at the centres of 50 km cells with area proportional to the count; cells with one to %d members share the smallest mark, and the two lists overlap.", shared_n),
  "List memberships are undated supplied labels, not designation dates. Registered addresses are not operating locations.",
  "The 2017 represented-year geoBoundaries geometry provides context and does not filter firm points.")

# Change-map pieces --------------------------------------------------------------------
tile_spec <- list(shape = "tile", gap_km = 15, white_backing = TRUE)
chg_fill <- ifelse(chg$supported, pal$hex[pmax(1L, chg$class)], fig27_gray); chg_fill[is.na(chg_fill)] <- fig27_gray
draw_change_panel <- function(rect, H) {
  extent <- c2rr$c2rr_map_fit_extent(views$national, 6.5 * diff(rect[1:2]) / (H * diff(rect[3:4])))
  graphics::par(fig = rect, mar = rep(0, 4), new = TRUE)
  c2rr$c2rr_map_background(basemap, extent)
  fig28_cells(chg, chg_fill, tile_spec)
  invisible(extent)
}
change_bounds <- function() c(min(sup$change_pp), fig27_change_breaks, max(sup$change_pp))
fmt_pp <- function(x) { s <- formatC(x, format = "f", digits = 0); s <- sub("^-", "\u2212", s); ifelse(x > 0, paste0("+", s), s) }
# Horizontal legend: six touching swatches, values at the boundaries, gray swatch at the right.
draw_change_legend_h <- function(L, y_in, left = .06, right = .62) {
  fig27_page_layer()
  H <- L$H; y <- L$y(y_in); hgt <- 0.11 / H
  w <- (right - left) / 6; edges <- left + w * 0:6; b <- change_bounds()
  for (k in 1:6) graphics::rect(edges[k] + .0025, y, edges[k + 1] - .0025, y + hgt, col = pal$hex[k], border = NA)
  graphics::text(edges, y - .02 / H * 7, fmt_pp(b), adj = c(.5, 1))
  graphics::text(right + .025, y + hgt / 2, "points", adj = c(0, .5))
  graphics::rect(right + .13, y, right + .18, y + hgt, col = fig27_gray, border = NA)
  graphics::text(right + .195, y + hgt / 2, "<50 firms in 2021 or 2024", adj = c(0, .5))
}
# Vertical legend in the inset column for the composite page.
draw_change_legend_v <- function(L, x = .80, y_top_in) {
  fig27_page_layer()
  H <- L$H; step <- 0.19 / H; sw <- 0.13 / H
  graphics::text(x, L$y(y_top_in), "Change, points", adj = c(0, 1))
  y0 <- L$y(y_top_in) - 0.25 / H
  for (k in 6:1) { yy <- y0 - (6 - k) * step
    graphics::rect(x, yy - sw, x + .035, yy, col = pal$hex[k], border = NA)
    graphics::text(x + .045, yy - sw / 2, pal$labels[k], adj = c(0, .5)) }
  yy <- y0 - 6 * step - 0.05 / H
  graphics::rect(x, yy - sw, x + .035, yy, col = fig27_gray, border = NA)
  graphics::text(x + .045, yy - sw / 2, "<50 firms", adj = c(0, .5))
}
change_title <- "Change in the availability share by cell, 2024 against 2021"
change_subtitle <- sprintf("%d supported cells; located share %.1f%% in 2021, %.1f%% in 2024", nrow(sup), share21, share24)
note_cells <- "100 km cells with 15 km gaps; classes symmetric around zero at 2 and 5 points."

# Candidates -----------------------------------------------------------------------------
manifest <- list()
add <- function(id, group, label, pdf, H, crop = NA) manifest[[id]] <<- data.frame(order = length(manifest) + 1, id = id, group = group,
  label = label, pdf = basename(pdf), pdf_sha256 = lab_sha256(pdf), height_in = H, crop = crop)

# s0: fidelity re-render of the manuscript figure (production geometry, strings and sizes).
{
  H <- 7; rectangles <- list(national = c(.035, .775, .565, .925), Moscow = c(.80, .975, .760, .905), `St Petersburg` = c(.80, .975, .565, .710))
  extents <- fig27_extents(c2rr, views, rectangles, H)
  ras1 <- fig27_rasters(c2rr, avail, extents, rectangles, H, "#16436E"); ras0 <- fig27_rasters(c2rr, absent, extents, rectangles, H, "#123F35")
  stopifnot(ras1$counts$firms[ras1$counts$view == "Moscow"] == 459326, ras0$counts$firms[ras0$counts$view == "St Petersburg"] == 88617)
  draw <- function() {
    fig27_page()
    for (state in c(1L, 0L)) {
      offset <- if (state == 1) 0 else -.42
      label <- if (state == 1) "01  Eligible firms, 2021: original available" else "Original absent"
      total <- if (state == 1) acc$located_available_firms else acc$located_absent_firms
      graphics::text(.035, .971 + offset, label, adj = c(0, 1), font = 2, cex = 1.02)
      graphics::text(.035, .942 + offset, paste0(count(total), " located firms"), adj = c(0, 1), cex = .9)
      graphics::text(.80, .942 + offset, paste0("Moscow zoom\nN = ", count(view_n(state, "Moscow"))), adj = c(0, 1), cex = .77)
      graphics::text(.80, .747 + offset, paste0("St Petersburg zoom\nN = ", count(view_n(state, "St Petersburg"))), adj = c(0, 1), cex = .75)
    }
    notes <- c(paste0(count(acc$plotted_firms), " / ", count(acc$eligible_firms), " eligible firms located (", sprintf("%.1f", 100 * acc$plotted_firms / acc$eligible_firms), "%); ", count(acc$unlocated_firms), " lack coordinates."),
      paste0("Equal points; overlap hides multiplicity. Insets repeat firms. Unknown availability: ", count(acc$original_unknown_firms), "."),
      "Registered addresses; no financial or extra registration screen. RFSD v3.1.0.",
      "Shared LAEA; outlines omit tested Crimea/Sevastopol/Ukraine locations; all firms retained.", fig27_attribution)
    graphics::text(.035, .118 - .020 * (seq_along(notes) - 1), notes, adj = c(0, 1), cex = .79)
    for (state in c(1L, 0L)) for (view in names(rectangles)) {
      r <- rectangles[[view]]; r[3:4] <- r[3:4] + if (state == 1) 0 else -.42
      img <- if (state == 1) ras1$images[[view]] else ras0$images[[view]]
      fig27_panel(c2rr, basemap, extents[[view]], r, H, rasters = list(img), box = view != "national")
    }
  }
  pdf <- fig27_save_figure("s0-current", draw, H, "Fidelity re-render of the manuscript Figure 2.7; not a candidate.",
                           params = list(views = rbind(cbind(state = 1, ras1$counts), cbind(state = 0, ras0$counts))), label = "S0 current figure redrawn by the lab")
  add("s0-current", "reference", "S0 current Figure 2.7 redrawn by the lab from the pinned inputs (production geometry, strings and text sizes)", pdf, H, "0.2275,0.525,4.81,2.52")
}

# A1: one panel, both lists as two marks, navy or phthalo green population.
for (variant in c("navy", "green")) {
  H <- 4.6; L <- fig27_layout(H, two_panels = FALSE); L$notes_top <- L$bottom - 0.70
  pop_col <- if (variant == "navy") fig27_navy else fig27_green
  draw <- function() {
    fig27_page()
    draw_block(L, L$p1, H, "Located eligible firms and two supplied lists, 2021",
               sprintf("%s located firms of the annual eligible population", count(acc$plotted_firms)),
               all_located, pop_col, list(marks_sanction, marks_gov_ring), c(moscow_all, petersburg_all), "all")
    draw_mark_legends(L, L$bottom - 0.21, L$bottom - 0.49)
    draw_notes(L, c(note_pop, note_marks, note_lists, fig27_attribution))
  }
  id <- paste0("a1-one-panel-", variant)
  pdf <- fig27_save_figure(id, draw, H, paste("Source: RFSD v3.1.0 located 2021 points and the saved 2021 cell aggregates.", latex_common),
                           params = list(design = "A1", population_colour = pop_col, marks = "sanctions list discs, government strategic list rings, 50 km cells"),
                           label = paste("A1 one panel,", variant, "population"))
  add(id, "fig27", sprintf("A1 one panel: %s population, sanctions list as brick discs and government strategic list as brick rings, Moscow and St Petersburg insets (6.5 x 4.6 in)",
                           if (variant == "navy") "navy" else "phthalo-green"), pdf, H, sprintf("0.2275,%.3f,4.81,2.52", H - L$p1$nat[2]))
}

# A2: two panels, one list each, navy or phthalo green population.
for (variant in c("navy", "green")) {
  H <- 7; L <- fig27_layout(H, two_panels = TRUE, nat_h = 2.45); L$notes_top <- L$bottom - 0.42
  pop_col <- if (variant == "navy") fig27_navy else fig27_green
  draw <- function() {
    fig27_page()
    draw_block(L, L$p1, H, "Located eligible firms and the sanctions list, 2021",
               sprintf("Sanctions list: %s of %s firms located", count(totals$located[1]), count(totals$eligible[1])),
               all_located, pop_col, list(marks_sanction), c(moscow_all, petersburg_all), "all")
    draw_block(L, L$p2, H, "Located eligible firms and the government strategic list, 2021",
               sprintf("Government strategic list: %s of %s firms located", count(totals$located[2]), count(totals$eligible[2])),
               all_located, pop_col, list(marks_gov_disc), c(moscow_all, petersburg_all), "all")
    draw_mark_legends(L, L$bottom - 0.21, NULL)
    draw_notes(L, c(note_pop, note_marks, fig27_attribution))
  }
  id <- paste0("a2-two-panels-", variant)
  pdf <- fig27_save_figure(id, draw, H, paste("Source: RFSD v3.1.0 located 2021 points and the saved 2021 cell aggregates.", latex_common),
                           params = list(design = "A2", population_colour = pop_col, marks = "one list per panel, brick discs, 50 km cells"),
                           label = paste("A2 two panels,", variant, "population"))
  add(id, "fig27", sprintf("A2 two panels: %s population in both, sanctions list over the top panel and government strategic list over the bottom panel, insets on both (6.5 x 7 in)",
                           if (variant == "navy") "navy" else "phthalo-green"), pdf, H, sprintf("0.2275,%.3f,4.81,2.45", H - L$p1$nat[2]))
}

# B: the current availability panels with both lists overlaid on each.
{
  H <- 7; L <- fig27_layout(H, two_panels = TRUE, nat_h = 2.35); L$notes_top <- L$bottom - 0.70
  draw <- function() {
    fig27_page()
    draw_block(L, L$p1, H, "Located eligible firms, 2021: original statement available",
               sprintf("%s located firms", count(acc$located_available_firms)),
               avail, fig27_navy, list(marks_sanction, marks_gov_ring), c(view_n(1, "Moscow"), view_n(1, "St Petersburg")), "avail")
    draw_block(L, L$p2, H, "Original statement absent", sprintf("%s located firms", count(acc$located_absent_firms)),
               absent, fig27_absent, list(marks_sanction, marks_gov_ring), c(view_n(0, "Moscow"), view_n(0, "St Petersburg")), "absent")
    draw_mark_legends(L, L$bottom - 0.21, L$bottom - 0.49)
    draw_notes(L, c(note_pop, note_marks, fig27_attribution))
  }
  pdf <- fig27_save_figure("b-availability-overlay", draw, H, paste("Source: RFSD v3.1.0 located 2021 points and the saved 2021 cell aggregates. Separate availability panels on the same frame.", latex_common),
                           params = list(design = "B", colours = c(available = fig27_navy, absent = fig27_absent), marks = "both lists on both panels"),
                           label = "B current availability panels with both lists overlaid")
  add("b-availability-overlay", "fig27", "B the current two availability panels (available navy, absent dark green) with both lists overlaid on each, two marks (6.5 x 7 in)", pdf, H, sprintf("0.2275,%.3f,4.81,2.35", H - L$p1$nat[2]))
}

# Change map alone: full-width national panel, horizontal legend.
{
  H <- 4.4; L <- fig27_layout(H, two_panels = FALSE); L$notes_top <- L$bottom - 0.68
  rect <- L$fig(c(.035, .975), L$p1$nat)
  draw <- function() {
    fig27_page()
    fig27_text(.035, L$y(L$p1$title), change_title, cex = 1.1, font = 2)
    fig27_text(.035, L$y(L$p1$subtitle), change_subtitle)
    draw_change_panel(rect, H)
    draw_change_legend_h(L, L$bottom - 0.30)
    draw_notes(L, c(note_change, note_cells, fig27_attribution))
  }
  pdf <- fig27_save_figure("change-2024-2021", draw, H,
    paste("Source: saved RFSD v3.1.0 annual cell aggregates. Each supported cell shows the 2024 availability share of its located eligible firms minus the 2021 share, in percentage points; the two annual populations differ in composition, so the change is not a within-firm change.",
          "Classes are symmetric around zero at 2 and 5 points; 15 km gaps separate the 100 km cells. The 2017 represented-year geoBoundaries geometry provides context only."),
    params = list(design = "change", breaks_pp = fig27_change_breaks, hex = toupper(pal$hex), class_counts = class_counts,
                  located_share = c(`2021` = share21, `2024` = share24), supported_share = c(`2021` = share21s, `2024` = share24s)),
    label = "Availability change 2024 minus 2021")
  add("change-2024-2021", "change", "Availability-change map: 2024 minus 2021 share per 100 km cell on 658 supported cells, six symmetric classes, brick to navy, 15 km gaps (6.5 x 4.4 in)", pdf, H, sprintf("0.2275,%.3f,6.11,2.52", H - L$p1$nat[2]))
}

# Composite: A1 (navy) over the change map, one 6.5 x 7 in page with the legend in the inset column.
{
  H <- 7; L <- fig27_layout(H, two_panels = TRUE, nat_h = 2.25); L$notes_top <- L$bottom - 0.70
  rect2 <- L$fig(L$nat_w, L$p2$nat)
  draw <- function() {
    fig27_page()
    draw_block(L, L$p1, H, "Located eligible firms and two supplied lists, 2021",
               sprintf("%s located firms of the annual eligible population", count(acc$plotted_firms)),
               all_located, fig27_navy, list(marks_sanction, marks_gov_ring), c(moscow_all, petersburg_all), "all")
    fig27_page_layer()
    fig27_text(.035, L$y(L$p2$title), change_title, cex = 1.1, font = 2)
    fig27_text(.035, L$y(L$p2$subtitle), change_subtitle)
    draw_change_panel(rect2, H)
    draw_change_legend_v(L, .80, L$p2$subtitle)
    draw_mark_legends(L, L$bottom - 0.21, L$bottom - 0.49)
    draw_notes(L, c(note_pop, note_marks, note_change, fig27_attribution))
  }
  pdf <- fig27_save_figure("a1-with-change", draw, H, paste("Source: RFSD v3.1.0 located 2021 points and the saved annual cell aggregates. Top: located eligible firms with the two supplied lists. Bottom: 2024 minus 2021 availability share per supported 100 km cell, in percentage points, between annual populations and not within firms.", latex_common),
                           params = list(design = "A1 + change", breaks_pp = fig27_change_breaks), label = "A1 over the availability-change map")
  add("a1-with-change", "composite", "Composite: A1 (navy) in the top slot and the availability-change map in the bottom slot of one 6.5 x 7 in page; one exhibit number for both", pdf, H, sprintf("0.2275,%.3f,4.81,2.25", H - L$p1$nat[2]))
}

# C: the current available panel over the change map, the Item 2 layout the author left to Codex
# (the alternative is two pages: the current figure re-rendered note-only, then the change map).
{
  H <- 7; L <- fig27_layout(H, two_panels = TRUE, nat_h = 2.35); L$notes_top <- L$bottom - 0.25
  rect2 <- L$fig(L$nat_w, L$p2$nat)
  draw <- function() {
    fig27_page()
    draw_block(L, L$p1, H, "Located eligible firms, 2021: original statement available",
               sprintf("%s located firms", count(acc$located_available_firms)),
               avail, fig27_navy, NULL, c(view_n(1, "Moscow"), view_n(1, "St Petersburg")), "avail")
    fig27_page_layer()
    fig27_text(.035, L$y(L$p2$title), change_title, cex = 1.1, font = 2)
    fig27_text(.035, L$y(L$p2$subtitle), change_subtitle)
    draw_change_panel(rect2, H)
    draw_change_legend_v(L, .80, L$p2$subtitle)
    draw_notes(L, c(note_pop, note_points, note_change, fig27_attribution))
  }
  pdf <- fig27_save_figure("c-available-with-change", draw, H, paste("Source: RFSD v3.1.0 located 2021 points and the saved annual cell aggregates. Top: located eligible firms with an original statement available for 2021, equal points. Bottom: 2024 minus 2021 availability share per supported 100 km cell, in percentage points, between annual populations and not within firms.",
                           "Coincident coordinates overlap and the insets repeat national firms; registered addresses are not operating locations. Classes are symmetric around zero at 2 and 5 points; 15 km gaps separate the cells."),
                           params = list(design = "C: available panel + change", breaks_pp = fig27_change_breaks), label = "Current available panel over the change map")
  add("c-available-with-change", "composite", "Item 2 layout for Codex: the current available panel (registry names, text at the floor) in the top slot and the availability-change map in the bottom slot of one 6.5 x 7 in page", pdf, H, sprintf("0.2275,%.3f,4.81,2.35", H - L$p1$nat[2]))
}

manifest <- do.call(rbind, manifest)
manifest_path <- lab_path("figures", fig27_dir, "variants.csv")
if (file.exists(manifest_path)) {   # keep the rows other scripts own (the flow diagrams), renumbered after the maps
  other <- utils::read.csv(manifest_path, stringsAsFactors = FALSE); other <- other[!other$id %in% manifest$id, ]
  if (nrow(other)) { other$order <- nrow(manifest) + seq_len(nrow(other)); manifest <- rbind(manifest, other[names(manifest)]) }
}
utils::write.csv(manifest, manifest_path, row.names = FALSE)
cat(sprintf("%d candidates in figures/%s\n", nrow(manifest), fig27_dir))
