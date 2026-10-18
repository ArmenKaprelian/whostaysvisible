# Figure 2.8 restyle study, 18 October 2026. Shared loaders, classing, palettes, drawing and
# saving. Source after R/lab.R and lab_init(). Base graphics, as in the production figure
# (programming/R/chapter2-reconcile-refine-maps.R, c2rr_map_candidate2). The production helpers
# are reused read-only from their own environment; only the cell encoding, the legend and one
# note line change. Nothing here is a manuscript source or an authorization.

fig28_dir <- "20261018-fig28"
fig28_gray <- "#CDD3D0"          # production colour for cells with fewer than 50 eligible firms
fig28_land <- "#F1F2EF"          # production land fill; the surface the palettes are validated against

# The evidence copy of the drawing script (the manuscript's actual source) in an isolated
# environment, so nothing masks lab helpers. programming's copy is registered as an input too.
fig28_production <- function() {
  env <- new.env(parent = globalenv())
  sys.source(lab_source("fig28.script"), envir = env)
  lab_source("fig28.script-programming")
  env
}

fig28_inputs <- function(c2rr) {
  cells <- lab_read_csv("fig28.cells")
  manifest <- jsonlite::fromJSON(lab_source("fig28.manifest"))
  basemap <- c2rr$c2rr_map_basemap(lab_source("fig28.basemap", verify_hash = TRUE))
  list(cells = cells, views = manifest$base_extents, basemap = basemap, manifest = manifest)
}

# Production accounting block (c2rr_map_candidate2), unchanged; feeds the subtitles.
fig28_accounting <- function(cells) {
  do.call(rbind, lapply(c("cash", "inventory"), function(moderator) {
    d <- cells[cells$moderator == moderator, ]
    data.frame(outcome = "log_real_revenue", moderator = moderator,
      cohort_firms = sum(d$n_cohort), eligible_firms = sum(d$n_eligible),
      cells = nrow(d), supported_cells = sum(d$display_supported),
      below_support_cells = sum(!d$display_supported),
      cohort_firms_in_supported_cells = sum(d$n_cohort[d$display_supported]),
      eligible_firms_in_supported_cells = sum(d$n_eligible[d$display_supported]))
  }))
}

# Numbers the manuscript states (chapter 2, figure note and prose) and the saved rules.
fig28_checks <- function(cells) {
  a <- fig28_accounting(cells)
  data.frame(
    check = c("rows", "cells per panel", "panels", "supported cells cash", "supported cells inventory",
              "gray cells cash", "gray cells inventory", "cohort firms cash", "cohort firms inventory",
              "eligible firms cash", "eligible firms inventory", "support rule agrees", "share recomputes",
              "pooled supported cells"),
    expected = c(2308, 1154, 2, 667, 667, 487, 487, 1485616, 1164866, 3277638, 3277638, 2308, 0, 1334),
    observed = c(nrow(cells), nrow(cells) / 2, length(unique(cells$moderator)),
                 a$supported_cells[1], a$supported_cells[2], a$below_support_cells[1], a$below_support_cells[2],
                 a$cohort_firms[1], a$cohort_firms[2], a$eligible_firms[1], a$eligible_firms[2],
                 sum(cells$display_supported == (cells$n_eligible >= 50)),
                 max(abs(cells$inclusion_percent - 100 * cells$n_cohort / cells$n_eligible)),
                 sum(cells$display_supported)),
    tolerance = c(rep(0, 12), 1e-9, 0))
}

# Type-7 quintile cutpoints of the inclusion share over supported cells: pooled over both
# panels (the author's choice, one legend) or per panel (for the record). Ties go down.
fig28_cutpoints <- function(cells, pooled = TRUE) {
  sup <- cells[cells$display_supported, ]
  q <- function(x) stats::quantile(x, c(.2, .4, .6, .8), type = 7, names = FALSE)
  if (pooled) { p <- q(sup$inclusion_percent); return(list(cash = p, inventory = p)) }
  list(cash = q(sup$inclusion_percent[sup$moderator == "cash"]),
       inventory = q(sup$inclusion_percent[sup$moderator == "inventory"]))
}
fig28_class <- function(pct, cuts) as.integer(cut(pct, c(-Inf, cuts, Inf), labels = FALSE, right = TRUE))

# Legend labels: right-closed classes with whole-percent bounds, lowest and highest from the data.
fig28_class_labels <- function(cuts, range) {
  r <- function(x) formatC(x, format = "f", digits = 0)
  b <- c(r(range[1]), r(cuts), r(range[2]))
  c(paste0(b[1], "–", b[2], "%"), paste0(">", b[2:5], "–", b[3:6], "%"))
}

# OKLab lightness (farver 2.1.2) for step checks and the hue-matched green ramp.
fig28_oklab_L <- function(hex) farver::convert_colour(t(grDevices::col2rgb(hex)), "rgb", "oklab")[, 1]
fig28_min_dL <- function(hex) min(abs(diff(fig28_oklab_L(hex))))

# Same OKLCH lightness and chroma as hex, with the hue of target; chroma is reduced only as far
# as needed to stay inside sRGB (farver clamps silently, so the round trip is the gamut test).
fig28_match_hue <- function(hex, target = "#004B3C") {
  h <- farver::convert_colour(t(grDevices::col2rgb(target)), "rgb", "oklch")[, 3]
  vapply(hex, function(x) {
    lch <- farver::convert_colour(t(grDevices::col2rgb(x)), "rgb", "oklch"); lch[, 3] <- h
    rgb <- NULL
    for (k in seq(1, 0, by = -0.01)) {
      try_lch <- lch; try_lch[, 2] <- lch[, 2] * k
      rgb <- farver::convert_colour(try_lch, "oklch", "rgb")
      back <- farver::convert_colour(rgb, "rgb", "oklch")
      if (abs(back[, 1] - try_lch[, 1]) < 0.004 && abs(back[, 2] - try_lch[, 2]) < 0.004) break
    }
    grDevices::rgb(rgb[1, 1], rgb[1, 2], rgb[1, 3], maxColorValue = 255)
  }, "", USE.NAMES = FALSE)
}

fig28_palettes <- function() {
  ramp <- grDevices::colorRampPalette(c("#D9E8F5", "#3E78A8", "#061C38"))(101)   # production line 233
  c1_candidates <- list(
    "production ramp at 33/47/62/80/100%" = ramp[1 + c(33, 47, 62, 80, 100)],
    "production ramp at 36/50/65/82/100%" = ramp[1 + c(36, 50, 65, 82, 100)],
    "navy set anchored on #16436E and #061C38" = c("#78A3C9", "#4F84B4", "#2F6395", "#16436E", "#061C38"))
  stopifnot(identical(toupper(c1_candidates[[1]]), c("#729EC2", "#477EAC", "#30618D", "#1C4064", "#061C38")))
  dL <- vapply(c1_candidates, fig28_min_dL, 0)
  pick <- which.max(dL)
  c1 <- unname(c1_candidates[[pick]])
  list(
    continuous = list(id = "continuous", kind = "continuous", hex = ramp,
      label = "current continuous ramp #D9E8F5-#3E78A8-#061C38, 101 steps, linear 0-100%"),
    c1 = list(id = "c1", kind = "classed", hex = c1,
      label = sprintf("C1 classed navy (%s; min adjacent OKLab dL %.3f)", names(c1_candidates)[pick], dL[pick]),
      candidates = c1_candidates, candidate_min_dL = dL),
    c2 = list(id = "c2", kind = "classed", hex = RColorBrewer::brewer.pal(9, "YlGnBu")[5:9],
      label = "C2 classed multi-hue sequential: ColorBrewer YlGnBu 9-class, steps 5-9"),
    dark2 = list(id = "dark2", kind = "classed", hex = RColorBrewer::brewer.pal(8, "Dark2")[1:5],
      label = "Dark2 first five (author request; qualitative, comparison only)"),
    green = list(id = "green", kind = "classed", hex = fig28_match_hue(c1, "#004B3C"),
      label = "phthalo-green ramp matched to C1 in OKLCH lightness and chroma (hue of #004B3C)"))
}

# The six checks of the dataviz validator, run in the sandbox. Returns a data frame of lines.
fig28_validate <- function(palette_id, hex, mode = c("ordinal", "all-pairs")) {
  mode <- match.arg(mode)
  args <- c("-I", lab_path("scripts", "validate_palette.py"), paste(hex, collapse = ","),
            "--mode", "light", "--surface", fig28_land, if (mode == "ordinal") "--ordinal" else c("--pairs", "all"))
  out <- suppressWarnings(system2("python3", shQuote(args), stdout = TRUE, stderr = TRUE))
  keep <- grepl("^\\s*\\[(PASS|FAIL|WARN)\\]|→", out)
  lines <- trimws(out[keep])
  status <- ifelse(grepl("^\\[", lines), sub("^\\[(\\w+)\\].*$", "\\1", lines), "VERDICT")
  detail <- ifelse(grepl("^\\[", lines), trimws(sub("^\\[\\w+\\]\\s*", "", lines)), lines)
  data.frame(palette = palette_id, mode = mode, surface = fig28_land, status = status, detail = detail)
}

# Page setup as c2rr_map_page(), with the lab font named explicitly instead of "sans".
fig28_page <- function() {
  graphics::par(fig = c(0, 1, 0, 1), mar = c(0, 0, 0, 0), cex = 1,
    family = lab_font, fg = "#24323D", col = "#24323D", xaxs = "i", yaxs = "i")
  graphics::plot.new(); graphics::plot.window(c(0, 1), c(0, 1))
}

fig28_fill <- function(d, spec, panel) {
  hex <- if (!is.null(spec$panel_hex)) spec$panel_hex[[panel]] else spec$hex
  fill <- if (spec$kind == "continuous") hex[pmax(1L, pmin(101L, 1L + floor(d$inclusion_percent)))] else hex[d$class]
  fill[!d$display_supported] <- fig28_gray
  fill
}

# Cell marks in the panel's km coordinates. Tiles: production rect with a smaller half-side.
# Dots: symbols() draws device circles from x-axis units; the extent fit is isotropic anyway.
fig28_cells <- function(d, fill, spec) {
  if (spec$shape == "tile") {
    h <- 50 - spec$gap_km / 2
    if (isTRUE(spec$white_backing))   # polish: gaps read as white, not as land showing through
      graphics::rect(d$x_km - 50, d$y_km - 50, d$x_km + 50, d$y_km + 50, col = "white", border = NA)
    graphics::rect(d$x_km - h, d$y_km - h, d$x_km + h, d$y_km + h, col = fill, border = NA)
  } else {
    r <- if (spec$shape == "dot") rep(spec$radius_km, nrow(d)) else spec$radii_km[d$class]
    r[!d$display_supported] <- spec$unsupported_radius_km
    graphics::symbols(d$x_km, d$y_km, circles = r, inches = FALSE, add = TRUE, bg = fill, fg = NA)
  }
}

# A circle in page coordinates (6.5 x 7 in page, unit square window): y radius corrected.
fig28_page_circle <- function(x, y, r, col) {
  t <- seq(0, 2 * pi, length.out = 64)
  graphics::polygon(x + r * cos(t), y + r * sin(t) * 6.5 / 7, col = col, border = NA)
}

# Legend on the production bar's footprint (x .12-.88, swatches y .123-.139, labels y .111).
fig28_legend <- function(spec, cuts, range, cex = .96) {
  if (spec$kind == "continuous") {                       # production lines 253-255 verbatim
    x <- seq(.12, .88, length.out = 102)
    graphics::rect(head(x, -1), .123, tail(x, -1), .139, col = spec$hex, border = NA)
    graphics::text(seq(.12, .88, length.out = 5), .111, paste0(seq(0, 100, 25), "%"), cex = .85)
    return(invisible())
  }
  if (identical(spec$legend, "boundaries")) {   # polish: five touching classes, values at the boundaries
    left <- .12; right <- .70; w <- (right - left) / 5; edges <- left + w * 0:5
    gap <- if (spec$shape == "tile") .005 else 0
    b <- formatC(c(range[1], cuts, range[2]), format = "f", digits = 0)
    labels <- c(paste0(b[1], "%"), b[2:5], paste0(b[6], "%"))
    for (k in 1:5) {
      if (spec$shape == "tile") graphics::rect(edges[k] + gap / 2, .123, edges[k + 1] - gap / 2, .139, col = spec$hex[k], border = NA)
      else fig28_page_circle((edges[k] + edges[k + 1]) / 2, .131, .0079, spec$hex[k])
    }
    graphics::text(edges, .111, labels, cex = cex)
    if (spec$shape == "tile") graphics::rect(.78, .123, .86, .139, col = fig28_gray, border = NA)
    else fig28_page_circle(.82, .131, .0063, fig28_gray)
    graphics::text(.82, .111, "<50 eligible", cex = cex)
    return(invisible())
  }
  labels <- c(fig28_class_labels(cuts, range), "<50 eligible")
  slot <- (.88 - .12) / 6; centers <- .12 + slot * (1:6 - .5)
  cols <- if (!is.null(spec$panel_hex)) spec$panel_hex else list(spec$hex)
  for (k in 1:6) {
    for (row in seq_along(cols)) {
      col <- if (k == 6) fig28_gray else cols[[row]][k]
      if (spec$shape == "tile") {
        y <- if (length(cols) == 1) c(.123, .139) else if (row == 1) c(.1315, .139) else c(.123, .1305)
        graphics::rect(centers[k] - .042, y[1], centers[k] + .042, y[2], col = col, border = NA)
      } else {
        rmax <- .0105
        r <- if (spec$shape == "dot" || k == 6) (if (k == 6) rmax * .6 else rmax * .75) else rmax * spec$radii_km[k] / max(spec$radii_km)
        fig28_page_circle(centers[k], .131, r, col)
      }
    }
  }
  graphics::text(centers, .111, labels, cex = cex)
}

# One variant's draw() closure: production layout, titles, subtitles and notes, with the
# cell encoding, legend and note line 2 from spec. cells carries the class column.
fig28_draw <- function(inputs, c2rr, cells, spec, cuts, range) {
  rectangle <- c(.035, .975, .565, .925)
  extent <- c2rr$c2rr_map_fit_extent(inputs$views$national, 6.5 * diff(rectangle[1:2]) / (7 * diff(rectangle[3:4])))
  accounting <- fig28_accounting(cells)
  count <- c2rr$c2rr_map_count
  note2 <- if (spec$kind == "continuous") "Linear 0-100%; 100 km cells; gray: <50 eligible; overlapping cohorts. RFSD v3.1.0." else
    "Classes: pooled quintiles of supported cells; 100 km cells; gray: <50 eligible; overlapping cohorts. RFSD v3.1.0."
  draw <- function() {
    fig28_page()
    for (i in 1:2) {
      offset <- if (i == 1) 0 else -.42; a <- accounting[i, ]
      prefix <- if (i == 1 && !isTRUE(spec$drop_prefix)) "02  " else ""   # polish drops the stray candidate number
      title <- paste0(prefix, "Inclusion in the revenue cohort by ", a$moderator, " share")
      graphics::text(.035, .971 + offset, title, adj = c(0, 1), font = 2, cex = 1.02)
      graphics::text(.035, .942 + offset,
        paste0(count(a$cohort_firms), " located cohort firms / ", count(a$eligible_firms), " located eligible firms"),
        adj = c(0, 1), cex = if (is.null(spec$subtitle_cex)) .87 else spec$subtitle_cex)
    }
    fig28_legend(spec, cuts, range)
    notes <- c("Each panel shows the share of located eligible firms in a 2021 cell included in its fixed revenue cohort.",
      note2,
      "Outlines omit tested Crimea/Sevastopol/Ukraine locations; all eligible firms retained.",
      "Boundaries: geoBoundaries.org gbOpen; OpenStreetMap/Wambacher (2017), ODbL 1.0.",
      "© OpenStreetMap contributors; https://www.openstreetmap.org/copyright")
    graphics::text(.035, .090 - .018 * (seq_along(notes) - 1), notes, adj = c(0, 1), cex = .78)
    for (i in 1:2) {
      r <- rectangle; r[3:4] <- r[3:4] + if (i == 1) 0 else -.42
      graphics::par(fig = r, mar = rep(0, 4), new = TRUE)
      c2rr$c2rr_map_background(inputs$basemap, extent)
      d <- cells[cells$moderator == accounting$moderator[i], ]
      fig28_cells(d, fig28_fill(d, spec, i), spec)
    }
  }
  draw
}

# One variant: the PDF at manuscript geometry plus a provenance sidecar. PNG previews are
# derived from the PDF afterwards (scripts/fig28-postprocess.sh), not drawn a second time.
fig28_save_figure <- function(id, dir, draw, params) {
  out <- lab_dir("figures", dir)
  pdf <- file.path(out, paste0(id, ".pdf"))
  grDevices::cairo_pdf(pdf, width = 6.5, height = 7, pointsize = 10.5, family = lab_font, onefile = TRUE)
  tryCatch(draw(), finally = grDevices::dev.off())
  prov <- lab_provenance(id, .lab$used_sources, extra = params)
  prov$output <- list(pdf = pdf, pdf_sha256 = lab_sha256(pdf), width_in = 6.5, height_in = 7,
                      pointsize = 10.5, font = lab_font)
  jsonlite::write_json(prov, file.path(out, paste0(id, ".json")), auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null")
  message(sprintf("  figure %s: %s (%.0f kB)", id, basename(pdf), file.info(pdf)$size / 1e3))
  invisible(pdf)
}
