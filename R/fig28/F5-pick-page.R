# F5: four-variant comparison page for the author's pick: the pick, its navy twin, the 25 km
# tiles on the same palette, and the graduated circles on the same palette. Three view strips.
# Run: scripts/lab-ro.sh Rscript --vanilla R/fig28/F5-pick-page.R
source(file.path(Sys.getenv("LAB_ROOT"), "R", "lab.R")); lab_init(quiet = TRUE)
dir <- lab_path("figures", "20261018-fig28")
args <- commandArgs(trailingOnly = TRUE)   # optional: manifest file name, page file name, heading note
manifest <- if (length(args) >= 1) args[1] else "variants-pick.csv"
page <- if (length(args) >= 2) args[2] else "fig28-pick.html"
heading <- if (length(args) >= 3) args[3] else "Same variants in the same order in every strip."
v <- utils::read.csv(file.path(dir, manifest), stringsAsFactors = FALSE); v <- v[order(v$order), ]
esc <- function(x) { x <- gsub("&", "&amp;", x, fixed = TRUE); x <- gsub("<", "&lt;", x, fixed = TRUE); gsub(">", "&gt;", x, fixed = TRUE) }
b64 <- function(path) jsonlite::base64_enc(readBin(path, "raw", file.info(path)$size))
img <- function(path, alt) sprintf('<img src="data:image/png;base64,%s" alt="%s" loading="lazy">', b64(path), esc(alt))
card <- function(r, suffix) sprintf('<figure><figcaption>%s<strong>%s</strong> · %s</figcaption>%s</figure>',
  if (r$id == "s1a-gap15-c2") '<span class="tag">Your pick</span> ' else "", esc(r$id), esc(r$label), img(file.path(dir, paste0(r$id, suffix, ".png")), paste(r$id, suffix)))
`%||%` <- function(a, b) if (is.null(a)) b else a
strip <- function(id, title, note, suffix) sprintf('<section id="%s"><h2>%s <span class="note">%s</span></h2><div class="grid">%s</div></section>',
  id, esc(title), esc(note), paste0(vapply(seq_len(nrow(v)), function(i) card(v[i, ], suffix), ""), collapse = ""))
html <- c('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">',
  '<title>Figure 2.8: the pick</title><style>',
  ':root{--ink:#24323D;--muted:#657680;--rule:#d9dee2;--blue:#2166AC}',
  'body{max-width:1600px;margin:0 auto;padding:0 16px 3rem;font:15px/1.4 system-ui,sans-serif;color:var(--ink);background:#fff}',
  'nav{position:sticky;top:0;background:#fff;border-bottom:1px solid var(--rule);padding:.6rem 0;margin-bottom:.6rem;z-index:2}',
  'nav a{margin-right:1.2rem;color:var(--blue);text-decoration:none;font-weight:600}nav .meta{color:var(--muted);font-size:.85rem;margin-left:.5rem}',
  'h2{font-size:1.15rem;margin:1.4rem 0 .5rem}.note{color:var(--muted);font-weight:normal;font-size:.9rem}',
  '.grid{display:grid;gap:14px;grid-template-columns:repeat(2,1fr)}',
  'figure{margin:0;border:1px solid var(--rule);border-radius:4px;padding:8px;background:#fff}figure img{width:100%;height:auto;display:block;margin-top:6px}',
  'figcaption{font-size:.9rem;line-height:1.35}.tag{font-size:.75rem;background:var(--blue);color:#fff;padding:.1rem .45rem;border-radius:3px;vertical-align:middle}',
  '</style></head><body>',
  sprintf('<nav><a href="#pages">Full pages</a><a href="#zoom">Zoom crops</a><a href="#gray">Grayscale crops</a><span class="meta">%s Classes: pooled quintiles, cutpoints 33.3 / 38.3 / 43.0 / 47.6%%.</span></nav>', esc(heading)),
  strip("pages", "Full pages", "220 dpi, whole 6.5 x 7 in figure", ""),
  strip("zoom", "Zoom crops", "600 dpi, European Russia, first panel", "-zoom"),
  strip("gray", "Grayscale crops", "the same crop with colour removed", "-zoom-gray"),
  '</body></html>')
out <- lab_path("gallery", page); writeLines(html, out, useBytes = TRUE)
cat("page:", out, "(", nrow(v), "variants,", round(file.info(out)$size / 1e6, 1), "MB )\n")
