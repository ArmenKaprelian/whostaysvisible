# F6: the three finalists (S1a, S1b, S2 on the classed navy), polished: stray "02" title prefix
# dropped, subtitles at 10.1 pt, legend as five touching classes with the class boundaries
# printed (5, 33, 38, 43, 48, 68%), crisp white gaps under the tiles, and dots enlarged to
# 80% of the pitch so the dark classes carry more colour. Everything else as in F1.
# Run: scripts/lab-ro.sh Rscript --vanilla R/fig28/F6-finalists.R
source(file.path(Sys.getenv("LAB_ROOT"), "R", "lab.R")); lab_init()
source(lab_path("R", "fig28", "fig28-common.R"))
c2rr <- fig28_production()
inputs <- fig28_inputs(c2rr)
cells <- inputs$cells
cuts <- fig28_cutpoints(cells, pooled = TRUE)
stopifnot(identical(round(cuts$cash, 2), c(33.31, 38.33, 42.97, 47.62)))
cells$class <- fig28_class(cells$inclusion_percent, cuts$cash)
sup <- cells[cells$display_supported, ]
range_sup <- range(sup$inclusion_percent)
counts <- lab_read_aggregate("fig28-class-counts", "fig28")
pal <- fig28_palettes()
polish <- list(drop_prefix = TRUE, subtitle_cex = .96, legend = "boundaries")
specs <- list(
  c(list(id = "final-s1a-gap15", tier = 1, palette = "c1", shape = "tile", gap_km = 15, white_backing = TRUE,
         label = "Final S1a: tiles with 15 km (0.6 pt) white gaps, classed navy, boundary legend"), polish),
  c(list(id = "final-s1b-gap25", tier = 1, palette = "c1", shape = "tile", gap_km = 25, white_backing = TRUE,
         label = "Final S1b: tiles with 25 km (1.0 pt) white gaps, classed navy, boundary legend"), polish),
  c(list(id = "final-s2-dots", tier = 1, palette = "c1", shape = "dot", radius_km = 40, unsupported_radius_km = 20,
         label = "Final S2: circles of diameter 80 km (3.1 pt), classed navy, boundary legend"), polish))
rows <- list()
for (s in specs) {
  p <- pal[[s$palette]]
  spec <- c(s, list(kind = p$kind, hex = p$hex, palette_label = p$label))
  draw <- fig28_draw(inputs, c2rr, cells, spec, cuts$cash, range_sup)
  params <- spec[setdiff(names(spec), "hex")]
  params$hex <- toupper(p$hex); params$cutpoints_pct <- cuts$cash; params$class_counts <- counts
  pdf <- fig28_save_figure(s$id, fig28_dir, draw, params)
  rows[[s$id]] <- data.frame(order = length(rows) + 1, id = s$id, tier = s$tier, shape = s$shape, palette = s$palette,
    label = s$label, palette_label = spec$palette_label, pdf = basename(pdf), pdf_sha256 = lab_sha256(pdf))
}
final <- do.call(rbind, rows)
utils::write.csv(final, lab_path("figures", fig28_dir, "variants-final.csv"), row.names = FALSE)
path <- lab_path("figures", fig28_dir, "variants.csv")
all <- utils::read.csv(path, stringsAsFactors = FALSE); all <- all[!all$id %in% final$id, ]
final$order <- max(all$order) + seq_len(nrow(final)); utils::write.csv(rbind(all, final), path, row.names = FALSE)
cat("rendered", nrow(final), "finalists\n")
