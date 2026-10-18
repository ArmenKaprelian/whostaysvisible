# F1: the Figure 2.8 variant matrix from the pinned inputs. Classes are pooled type-7
# quintiles of the inclusion share over the 1,334 supported cells (author decision, 18 Oct
# 2026). Writes data/fig28/* with provenance and checks, then figures/20261018-fig28/*.pdf.
# Run: scripts/lab-ro.sh Rscript --vanilla R/fig28/F1-render.R
source(file.path(Sys.getenv("LAB_ROOT"), "R", "lab.R")); lab_init()
source(lab_path("R", "fig28", "fig28-common.R"))
c2rr <- fig28_production()
inputs <- fig28_inputs(c2rr)
cells <- inputs$cells

# Classes --------------------------------------------------------------------------------
checks <- fig28_checks(cells)
cuts <- fig28_cutpoints(cells, pooled = TRUE)
cuts_panel <- fig28_cutpoints(cells, pooled = FALSE)
cells$class <- fig28_class(cells$inclusion_percent, cuts$cash)
cells$class_panel <- ifelse(cells$moderator == "cash",
  fig28_class(cells$inclusion_percent, cuts_panel$cash), fig28_class(cells$inclusion_percent, cuts_panel$inventory))
sup <- cells[cells$display_supported, ]
range_sup <- range(sup$inclusion_percent)
counts <- aggregate(cbind(cells = 1, cohort_firms = n_cohort, eligible_firms = n_eligible) ~ moderator + class, data = sup, FUN = sum)
counts <- counts[order(counts$moderator, counts$class), ]
counts$lower_pct <- c(range_sup[1], cuts$cash)[counts$class]
counts$upper_pct <- c(cuts$cash, range_sup[2])[counts$class]
counts$label <- fig28_class_labels(cuts$cash, range_sup)[counts$class]
class_checks <- data.frame(
  check = c("class cells cash", "class cells inventory", "cutpoints increasing", "classes used", "pooled p20", "pooled p40", "pooled p60", "pooled p80"),
  expected = c(667, 667, 1, 5, 33.31, 38.33, 42.97, 47.62),
  observed = c(sum(counts$cells[counts$moderator == "cash"]), sum(counts$cells[counts$moderator == "inventory"]),
               as.integer(all(diff(cuts$cash) > 0)), length(unique(sup$class)), cuts$cash),
  tolerance = c(0, 0, 0, 0, rep(0.005, 4)))
lab_save_aggregate(cells[, c("ix", "iy", "x_km", "y_km", "moderator", "n_eligible", "n_cohort", "inclusion_percent",
                             "display_supported", "class", "class_panel")],
                   "fig28-cell-classes", stage = "fig28", checks = rbind(checks, class_checks))
lab_save_aggregate(rbind(
  data.frame(classing = "pooled", panel = "both", k = 1:4, cutpoint_pct = cuts$cash),
  data.frame(classing = "per-panel", panel = "cash", k = 1:4, cutpoint_pct = cuts_panel$cash),
  data.frame(classing = "per-panel", panel = "inventory", k = 1:4, cutpoint_pct = cuts_panel$inventory)),
  "fig28-cutpoints", stage = "fig28")
lab_save_aggregate(counts, "fig28-class-counts", stage = "fig28")

# Palettes ------------------------------------------------------------------------------
pal <- fig28_palettes()
pal_df <- do.call(rbind, lapply(pal[c("c1", "c2", "dark2", "green")], function(p)
  data.frame(palette = p$id, label = p$label, class = 1:5, hex = toupper(p$hex), oklab_L = round(fig28_oklab_L(p$hex), 4))))
pal_df$adjacent_dL <- ave(pal_df$oklab_L, pal_df$palette, FUN = function(L) c(NA, round(abs(diff(L)), 4)))
cand_df <- do.call(rbind, lapply(names(pal$c1$candidates), function(n) data.frame(
  candidate = n, hex = paste(toupper(pal$c1$candidates[[n]]), collapse = " "),
  min_adjacent_dL = round(unname(pal$c1$candidate_min_dL[n]), 4),
  chosen = identical(toupper(unname(pal$c1$candidates[[n]])), toupper(pal$c1$hex)))))
lab_save_aggregate(pal_df, "fig28-palettes", stage = "fig28", extra = list(c1_candidates = cand_df))
validation <- rbind(
  fig28_validate("c1", pal$c1$hex, "ordinal"), fig28_validate("c2", pal$c2$hex, "ordinal"),
  fig28_validate("green", pal$green$hex, "ordinal"),
  fig28_validate("dark2", pal$dark2$hex, "all-pairs"), fig28_validate("dark2", pal$dark2$hex, "ordinal"))
lab_save_aggregate(validation, "fig28-palette-validation", stage = "fig28")
cvd_helper <- lab_path("scripts", "fig28-cvd.py")
if (file.exists(cvd_helper)) {
  cvd <- do.call(rbind, lapply(c("c1", "c2", "dark2", "green"), function(id) {
    out <- system2("python3", shQuote(c("-I", cvd_helper, paste(pal[[id]]$hex, collapse = ","))), stdout = TRUE)
    cbind(palette = id, utils::read.csv(text = out, check.names = FALSE))
  }))
  lab_save_aggregate(cvd, "fig28-palette-cvd", stage = "fig28")
}

# Variants ------------------------------------------------------------------------------
dot <- list(shape = "dot", radius_km = 35, unsupported_radius_km = 20)
grad <- list(shape = "graduated", radii_km = 100 * c(.45, .575, .70, .825, .95) / 2, unsupported_radius_km = 17.5)
tile <- function(gap) list(shape = "tile", gap_km = gap)
specs <- list(
  c(list(id = "s0-current", tier = 1, palette = "continuous", label = "S0 current encoding redrawn by the lab: contiguous 100 km tiles, continuous navy ramp"), tile(0)),
  c(list(id = "s1a-gap15-c1", tier = 1, palette = "c1", label = "S1a tiles with 15 km gaps (0.6 pt), C1 classed navy"), tile(15)),
  c(list(id = "s1b-gap25-c1", tier = 1, palette = "c1", label = "S1b tiles with 25 km gaps (1.0 pt), C1 classed navy"), tile(25)),
  c(list(id = "s2-dots-c1", tier = 1, palette = "c1", label = "S2 fixed circles, diameter 70 km (2.8 pt), C1 classed navy"), dot),
  c(list(id = "s3-graduated-c1", tier = 1, palette = "c1", label = "S3 graduated circles, diameter 45 to 95 km by class, C1 classed navy"), grad),
  c(list(id = "s1b-gap25-c2", tier = 2, palette = "c2", label = "S1b tiles with 25 km gaps, C2 classed YlGnBu"), tile(25)),
  c(list(id = "s2-dots-c2", tier = 2, palette = "c2", label = "S2 fixed circles, C2 classed YlGnBu"), dot),
  c(list(id = "s1b-gap25-dark2", tier = 2, palette = "dark2", label = "S1b tiles with 25 km gaps, Dark2 (comparison only)"), tile(25)),
  c(list(id = "s2-dots-dark2", tier = 2, palette = "dark2", label = "S2 fixed circles, Dark2 (comparison only)"), dot),
  c(list(id = "e-gap25-navy-green", tier = 2, palette = "e", label = "E tiles with 25 km gaps, C1 navy for cash and a lightness-matched phthalo green for inventory"), tile(25)),
  c(list(id = "s1b-gap25-continuous", tier = 3, palette = "continuous", label = "S1b tiles with 25 km gaps, current continuous ramp (gaps without classes)"), tile(25)))
manifest <- list()
for (s in specs) {
  p <- if (s$palette == "e") pal$c1 else pal[[s$palette]]
  spec <- c(s, list(kind = p$kind, hex = p$hex, palette_label = p$label))
  if (s$palette == "e") {
    spec$panel_hex <- list(pal$c1$hex, pal$green$hex)
    spec$palette_label <- paste0("cash: ", pal$c1$label, "; inventory: ", pal$green$label)
  }
  draw <- fig28_draw(inputs, c2rr, cells, spec, cuts$cash, range_sup)
  params <- spec[setdiff(names(spec), "hex")]
  params$hex <- if (p$kind == "continuous") "101-step production ramp" else toupper(p$hex)
  params$cutpoints_pct <- cuts$cash; params$class_counts <- counts
  pdf <- fig28_save_figure(s$id, fig28_dir, draw, params)
  manifest[[s$id]] <- data.frame(order = length(manifest) + 1, id = s$id, tier = s$tier, shape = s$shape, palette = s$palette,
    label = s$label, palette_label = spec$palette_label, pdf = basename(pdf), pdf_sha256 = lab_sha256(pdf))
}
manifest <- do.call(rbind, manifest)
utils::write.csv(manifest, lab_path("figures", fig28_dir, "variants.csv"), row.names = FALSE)
cat(sprintf("%d variants in figures/%s; cutpoints %s\n", nrow(manifest), fig28_dir, paste(round(cuts$cash, 2), collapse = " / ")))
