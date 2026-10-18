# F3: trimmed comparison page for the author's scan (18 October 2026): the manuscript figure
# and the six non-rejected candidates in three view strips (full page, zoom, grayscale), same
# order and labels in each strip, label plus rank plus a one-line verdict. No tables.
# Run: scripts/lab-ro.sh Rscript --vanilla R/fig28/F3-compare-page.R
source(file.path(Sys.getenv("LAB_ROOT"), "R", "lab.R")); lab_init(quiet = TRUE)
dir <- lab_path("figures", "20261018-fig28")
v <- utils::read.csv(file.path(dir, "variants.csv"), stringsAsFactors = FALSE)
keep <- data.frame(stringsAsFactors = FALSE,
  id = c("s0-current", "s1a-gap15-c1", "s1b-gap25-c1", "s1b-gap25-c2", "s2-dots-c1", "s2-dots-c2", "s3-graduated-c1"),
  tag = c("Before", "Rank 4", "Rank 1, recommended", "Colour option 2", "Rank 2", "Colour option 2 on dots", "Rank 3"),
  verdict = c(
    "One flat blue: the 0-100% ramp wastes its range on data that live between 8 and 68%.",
    "The 0.6 pt gap nearly closes at page scale; the map reads almost contiguous again.",
    "Discrete cells, the best separation of the five classes, geography still visible through the gaps.",
    "Larger light-end steps, but the teal draws the eye to low coverage and the dark steps drift from the house navy.",
    "Airy and graphic; the two darkest classes blur at 2.8 pt, and a dot grid reads as points rather than cells.",
    "Same palette trade on dots; the teal dots are the most conspicuous marks on the page.",
    "Loudest hierarchy and best grayscale, but size plus colour overstates the dense core."))
v <- merge(keep, v, by = "id", sort = FALSE); v <- v[match(keep$id, v$id), ]
esc <- function(x) { x <- gsub("&", "&amp;", x, fixed = TRUE); x <- gsub("<", "&lt;", x, fixed = TRUE); gsub(">", "&gt;", x, fixed = TRUE) }
b64 <- function(path) jsonlite::base64_enc(readBin(path, "raw", file.info(path)$size))
img <- function(path, alt) sprintf('<img src="data:image/png;base64,%s" alt="%s" loading="lazy">', b64(path), esc(alt))
card <- function(r, suffix) sprintf('<figure><figcaption><span class="tag">%s</span> <strong>%s</strong> · %s<br><span class="v">%s</span></figcaption>%s</figure>',
  esc(r$tag), esc(r$id), esc(r$label), esc(r$verdict), img(file.path(dir, paste0(r$id, suffix, ".png")), paste(r$id, suffix)))
strip <- function(id, title, note, suffix, cls) sprintf('<section id="%s"><h2>%s <span class="note">%s</span></h2><div class="grid %s">%s</div></section>',
  id, esc(title), esc(note), cls, paste0(vapply(seq_len(nrow(v)), function(i) card(v[i, ], suffix), ""), collapse = ""))
html <- c('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">',
  '<title>Figure 2.8 candidates</title><style>',
  ':root{--ink:#24323D;--muted:#657680;--rule:#d9dee2;--blue:#2166AC;--box:#f6f8fa}',
  'body{max-width:1600px;margin:0 auto;padding:0 16px 3rem;font:15px/1.4 system-ui,sans-serif;color:var(--ink);background:#fff}',
  'nav{position:sticky;top:0;background:#fff;border-bottom:1px solid var(--rule);padding:.6rem 0;margin-bottom:.6rem;z-index:2}',
  'nav a{margin-right:1.2rem;color:var(--blue);text-decoration:none;font-weight:600}nav .meta{color:var(--muted);font-size:.85rem;margin-left:.5rem}',
  'h2{font-size:1.15rem;margin:1.4rem 0 .5rem}.note{color:var(--muted);font-weight:normal;font-size:.9rem}',
  '.grid{display:grid;gap:14px}.pages{grid-template-columns:repeat(auto-fit,minmax(540px,1fr))}.crops{grid-template-columns:repeat(auto-fit,minmax(480px,1fr))}',
  'figure{margin:0;border:1px solid var(--rule);border-radius:4px;padding:8px;background:#fff}figure img{width:100%;height:auto;display:block;margin-top:6px}',
  'figcaption{font-size:.9rem;line-height:1.35}.v{color:var(--muted)}',
  '.tag{font-size:.75rem;background:var(--blue);color:#fff;padding:.1rem .45rem;border-radius:3px;vertical-align:middle}',
  '</style></head><body>',
  '<nav><a href="#pages">Full pages</a><a href="#zoom">Zoom crops</a><a href="#gray">Grayscale crops</a><span class="meta">Same seven variants in the same order in every strip. Classes: pooled quintiles, cutpoints 33.3 / 38.3 / 43.0 / 47.6%. Review artifacts only.</span></nav>',
  strip("pages", "Full pages", "220 dpi, whole 6.5 x 7 in figure", "", "pages"),
  strip("zoom", "Zoom crops", "600 dpi, European Russia, first panel: judge gaps, dots and class separation here", "-zoom", "crops"),
  strip("gray", "Grayscale crops", "the same crop with colour removed: what a black-and-white print shows", "-zoom-gray", "crops"),
  '</body></html>')
out <- lab_path("gallery", "fig28-compare.html"); writeLines(html, out, useBytes = TRUE)
cat("page:", out, "(", nrow(v), "variants,", round(file.info(out)$size / 1e6, 1), "MB )\n")
