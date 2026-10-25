# F7: the author's final layout (15 km white gaps, polished labels) drawn with the current
# continuous linear 0-100% ramp instead of the five classes, for a side-by-side comparison.
# Run: scripts/lab-ro.sh Rscript --vanilla R/fig28/F7-final-continuous.R
source(file.path(Sys.getenv("LAB_ROOT"), "R", "lab.R")); lab_init()
source(lab_path("R", "fig28", "fig28-common.R"))
c2rr <- fig28_production()
inputs <- fig28_inputs(c2rr)
cells <- inputs$cells
cuts <- fig28_cutpoints(cells, pooled = TRUE)
cells$class <- fig28_class(cells$inclusion_percent, cuts$cash)
range_sup <- range(cells$inclusion_percent[cells$display_supported])
pal <- fig28_palettes()
spec <- list(id = "final-s1a-gap15-continuous", tier = 1, palette = "continuous", shape = "tile", gap_km = 15,
  white_backing = TRUE, drop_prefix = TRUE, subtitle_cex = .96, legend_cex = .96,
  kind = "continuous", hex = pal$continuous$hex, palette_label = pal$continuous$label,
  label = "Final S1a layout with the current continuous 0-100% ramp (15 km white gaps, polished labels)")
draw <- fig28_draw(inputs, c2rr, cells, spec, cuts$cash, range_sup)
params <- spec[setdiff(names(spec), "hex")]; params$hex <- "101-step production ramp"
pdf <- fig28_save_figure(spec$id, fig28_dir, draw, params)
path <- lab_path("figures", fig28_dir, "variants.csv")
all <- utils::read.csv(path, stringsAsFactors = FALSE)
row <- data.frame(order = max(all$order) + 1, id = spec$id, tier = 1, shape = "tile", palette = "continuous",
  label = spec$label, palette_label = spec$palette_label, pdf = basename(pdf), pdf_sha256 = lab_sha256(pdf))
all <- rbind(all[all$id != spec$id, ], row); utils::write.csv(all, path, row.names = FALSE)
side <- all[match(c("final-s1a-gap15", spec$id), all$id), ]; side$order <- 1:2
utils::write.csv(side, lab_path("figures", fig28_dir, "variants-side.csv"), row.names = FALSE)
cat("rendered", spec$id, "\n")
