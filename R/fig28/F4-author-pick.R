# F4: the author's pick (18 October 2026): S1a tiles with 15 km gaps on the classed YlGnBu
# palette, plus S3 graduated circles on the same palette for comparison. Same inputs, classes
# and helpers as F1. Writes figures/20261018-fig28/variants-pick.csv (four variants in the
# author's order) and appends the two new rows to variants.csv.
# Run: scripts/lab-ro.sh Rscript --vanilla R/fig28/F4-author-pick.R
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
grad <- list(shape = "graduated", radii_km = 100 * c(.45, .575, .70, .825, .95) / 2, unsupported_radius_km = 17.5)
specs <- list(
  c(list(id = "s1a-gap15-c2", tier = 2, palette = "c2", label = "S1a tiles with 15 km gaps (0.6 pt), C2 classed YlGnBu (author's pick)"), list(shape = "tile", gap_km = 15)),
  c(list(id = "s3-graduated-c2", tier = 2, palette = "c2", label = "S3 graduated circles, diameter 45 to 95 km by class, C2 classed YlGnBu"), grad))
rows <- list()
for (s in specs) {
  p <- pal[[s$palette]]
  spec <- c(s, list(kind = p$kind, hex = p$hex, palette_label = p$label))
  draw <- fig28_draw(inputs, c2rr, cells, spec, cuts$cash, range_sup)
  params <- spec[setdiff(names(spec), "hex")]
  params$hex <- toupper(p$hex); params$cutpoints_pct <- cuts$cash; params$class_counts <- counts
  pdf <- fig28_save_figure(s$id, fig28_dir, draw, params)
  rows[[s$id]] <- data.frame(order = NA, id = s$id, tier = s$tier, shape = s$shape, palette = s$palette,
    label = s$label, palette_label = spec$palette_label, pdf = basename(pdf), pdf_sha256 = lab_sha256(pdf))
}
new <- do.call(rbind, rows)
path <- lab_path("figures", fig28_dir, "variants.csv")
all <- utils::read.csv(path, stringsAsFactors = FALSE)
all <- all[!all$id %in% new$id, ]
new$order <- max(all$order) + seq_len(nrow(new))
all <- rbind(all, new)
utils::write.csv(all, path, row.names = FALSE)
pick <- all[match(c("s1a-gap15-c2", "s1a-gap15-c1", "s1b-gap25-c2", "s3-graduated-c2"), all$id), ]
pick$order <- seq_len(nrow(pick))
utils::write.csv(pick, lab_path("figures", fig28_dir, "variants-pick.csv"), row.names = FALSE)
cat("rendered", nrow(new), "new variants; pick manifest:", paste(pick$id, collapse = ", "), "\n")
