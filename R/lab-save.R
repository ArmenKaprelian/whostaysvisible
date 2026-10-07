# Figure output: one vector PDF at 6.5 in, a PNG preview, the notes snippet and a
# figure JSON for the gallery. Text sizes are checked before drawing.

lab_collect_ggplots <- function(plot) {
  if (inherits(plot, "patchwork")) {
    inner <- tryCatch(plot$patches$plots, error = function(e) list())
    c(Filter(function(p) inherits(p, "ggplot"), inner), list(plot))
  } else list(plot)
}

lab_text_elements <- c("axis.text.x", "axis.text.y", "axis.title.x", "axis.title.y", "strip.text.x", "strip.text.y",
                       "plot.title", "plot.subtitle", "plot.caption", "legend.text", "legend.title", "plot.tag")

lab_assert_min_text_size <- function(plot, min_pt = lab_min_pt) {
  problems <- character()
  for (p in lab_collect_ggplots(plot)) {
    th <- tryCatch(ggplot2::theme_get() + p$theme, error = function(e) NULL)
    if (!is.null(th)) {
      for (el in lab_text_elements) {
        e <- tryCatch(ggplot2::calc_element(el, th), error = function(err) NULL)
        if (is.null(e) || inherits(e, "element_blank") || is.null(e$size)) next
        if (is.numeric(e$size) && e$size < min_pt - 1e-6) problems <- c(problems, sprintf("%s = %.1f pt", el, e$size))
      }
    }
    layers <- tryCatch(p$layers, error = function(e) list())
    for (ly in layers) {
      g <- ly$geom
      if (!inherits(g, c("GeomText", "GeomLabel", "GeomTextRepel", "GeomLabelRepel"))) next
      sz <- ly$aes_params$size
      if (is.null(sz)) sz <- tryCatch(g$default_aes$size, error = function(e) NULL)
      if (is.null(sz)) sz <- 3.88
      pt <- as.numeric(sz) * ggplot2::.pt
      if (any(pt < min_pt - 0.06)) problems <- c(problems, sprintf("%s geom text = %.1f pt", class(g)[1], min(pt)))
    }
  }
  if (length(problems)) stop("Text below ", min_pt, " pt: ", paste(unique(problems), collapse = "; "))
  invisible(TRUE)
}

# dir: a figures subfolder name such as "20261007-sketch". notes: plain text for the
# LaTeX snippet. data: list of aggregate ids (and stages) the figure was drawn from.
lab_save_figure <- function(plot, id, dir, height, title, notes, data = list(), width = 6.5,
                            reading = NULL, caveats = NULL, question = NULL, stage = NULL, rank = NA,
                            png_dpi = 110, min_pt = lab_min_pt) {
  if (width != 6.5 || height > 7) stop("Figures are 6.5 in wide and at most 7 in tall.")
  lab_assert_min_text_size(plot, min_pt)
  dir <- Sys.getenv("LAB_FIGURE_DIR", unset = dir)   # launcher-side override for polished or reproduction renders
  out <- lab_dir("figures", dir)
  pdf <- file.path(out, paste0(id, ".pdf"))
  grDevices::cairo_pdf(pdf, width = width, height = height, family = lab_font, pointsize = 10.5, onefile = TRUE)
  print(plot); grDevices::dev.off()
  png <- file.path(out, paste0(id, ".png"))
  ragg::agg_png(png, width = width, height = height, units = "in", res = png_dpi, background = "white")
  print(plot); grDevices::dev.off()
  notes_path <- lab_write_notes(pdf, notes)
  data_records <- lapply(data, function(d) {
    st <- if (is.list(d)) d$stage else "stage-a"; i <- if (is.list(d)) d$id else d
    path <- lab_path("data", st, paste0(i, ".csv"))
    list(id = i, stage = st, path = path, sha256 = if (file.exists(path)) lab_sha256(path) else NA_character_,
         provenance = lab_path("data", st, paste0(i, ".provenance.json")))
  })
  meta <- list(
    id = id, title = title, question = question, stage = stage, rank = rank, folder = dir,
    pdf = pdf, png = png, notes_tex = notes_path, notes_text = notes,
    width_in = width, height_in = height, font = lab_font, min_text_pt = min_pt, png_dpi = png_dpi,
    palette = as.list(lab_palette[c("primary", "comparison", "neutral")]),
    data = data_records, reading = reading, caveats = caveats,
    run_id = .lab$run_id, time_utc = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
    script = .lab$script, lab_commit = Sys.getenv("LAB_COMMIT", unset = "none"),
    pdf_sha256 = lab_sha256(pdf), packages = lab_packages_loaded())
  jsonlite::write_json(meta, file.path(out, paste0(id, ".json")), auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null")
  message(sprintf("  figure %s: %s (%.1f x %.1f in), %s, %s", id, basename(pdf), width, height, basename(png), basename(notes_path)))
  invisible(meta)
}
