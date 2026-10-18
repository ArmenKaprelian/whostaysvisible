# F0: re-render the current Figure 2.8 with the unmodified production function, exactly as
# LaTeX/research/evidence/chapter2-editorial-memo-2026-10-15/implementation/render-labels.R
# called it on 15 October 2026, from the same three pinned inputs. scripts/fig28-compare.sh
# then compares the result with the manuscript PDF pixel by pixel.
# Run: scripts/lab-ro.sh Rscript --vanilla R/fig28/F0-fidelity.R
source(file.path(Sys.getenv("LAB_ROOT"), "R", "lab.R")); lab_init()
source(lab_path("R", "fig28", "fig28-common.R"))
c2rr <- fig28_production()
inputs <- fig28_inputs(c2rr)
out <- lab_path("figures", fig28_dir, "s0-reference")
if (dir.exists(out)) unlink(out, recursive = TRUE)      # c2rr_map_save refuses to overwrite
dir.create(out, recursive = TRUE)
map <- c2rr$c2rr_map_candidate2(list(cells = inputs$cells, views = inputs$views, basemap = inputs$basemap), out)
stopifnot(identical(as.numeric(map$accounting$cohort_firms), c(1485616, 1164866)),
          all(map$accounting$supported_cells == 667 & map$accounting$below_support_cells == 487))
prov <- lab_provenance("s0-reference", .lab$used_sources, extra = list(
  note = "Unmodified c2rr_map_candidate2 from the evidence copy of chapter2-reconcile-refine-maps.R, called as render-labels.R did on 15 October 2026.",
  accounting = map$accounting, extent = map$extent))
prov$output <- list(pdf = map$path, pdf_sha256 = lab_sha256(map$path))
jsonlite::write_json(prov, file.path(out, "s0-reference.json"), auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null")
cat("s0 reference:", map$path, "\n")
