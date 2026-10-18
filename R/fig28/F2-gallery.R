# F2: self-contained comparison page for the Figure 2.8 restyle study (PNGs embedded).
# Reads figures/20261018-fig28/variants.csv, candidates/fig28-ranking.csv and data/fig28/*.
# Run: scripts/lab-ro.sh Rscript --vanilla R/fig28/F2-gallery.R
source(file.path(Sys.getenv("LAB_ROOT"), "R", "lab.R")); lab_init(quiet = TRUE)
dir <- lab_path("figures", "20261018-fig28")
v <- utils::read.csv(file.path(dir, "variants.csv"), stringsAsFactors = FALSE)
rk <- utils::read.csv(lab_path("candidates", "fig28-ranking.csv"), stringsAsFactors = FALSE)
v <- merge(v, rk, by = "id", all.x = TRUE); v <- v[order(v$order), ]
read_data <- function(id) utils::read.csv(lab_path("data", "fig28", paste0(id, ".csv")), check.names = FALSE, stringsAsFactors = FALSE)
esc <- function(x) { x <- gsub("&", "&amp;", x, fixed = TRUE); x <- gsub("<", "&lt;", x, fixed = TRUE); gsub(">", "&gt;", x, fixed = TRUE) }
b64 <- function(path) jsonlite::base64_enc(readBin(path, "raw", file.info(path)$size))
img <- function(path, alt, cls = "") if (file.exists(path)) sprintf('<img class="%s" src="data:image/png;base64,%s" alt="%s" loading="lazy">', cls, b64(path), esc(alt)) else ""
tbl <- function(df, swatch = NULL) {
  head <- paste0("<th>", esc(names(df)), "</th>", collapse = "")
  rows <- vapply(seq_len(nrow(df)), function(i) {
    cells <- vapply(names(df), function(n) {
      val <- df[i, n]; txt <- esc(if (is.numeric(val)) format(val, digits = 4) else as.character(val))
      if (!is.null(swatch) && n == swatch) sprintf('<td><span class="sw" style="background:%s"></span>%s</td>', val, txt) else paste0("<td>", txt, "</td>")
    }, "")
    paste0("<tr>", paste0(cells, collapse = ""), "</tr>")
  }, "")
  sprintf("<table><thead><tr>%s</tr></thead><tbody>%s</tbody></table>", head, paste0(rows, collapse = ""))
}
card <- function(r) {
  tag <- if (!is.na(r$rank)) sprintf("Rank %d · %s", r$rank, r$role) else r$role
  sprintf('<section class="card" id="%s"><h3>%s <span class="tag">%s</span></h3><p class="lead">%s</p><div class="row"><div class="full">%s</div><div class="side">%s%s</div></div><p class="meta">Palette: %s</p><p class="meta">PDF <code>%s</code> · sha256 %s</p></section>',
          esc(r$id), esc(r$label), esc(tag), esc(r$verdict), img(file.path(dir, paste0(r$id, ".png")), r$id, "page"),
          img(file.path(dir, paste0(r$id, "-zoom.png")), paste(r$id, "zoom"), "zoom"), img(file.path(dir, paste0(r$id, "-zoom-gray.png")), paste(r$id, "grayscale"), "zoom"),
          esc(r$palette_label), esc(r$pdf), esc(substr(r$pdf_sha256, 1, 12)))
}
tiers <- list(c(1, "Tier 1: cell shapes on the classed navy (C1)"), c(2, "Tier 2: palettes on the 25 km tiles and on fixed circles"), c(3, "Tier 3: control"))
sections <- vapply(tiers, function(t) {
  rows <- v[v$tier == as.integer(t[1]), ]
  paste0(sprintf('<h2>%s</h2>', esc(t[2])), paste0(vapply(seq_len(nrow(rows)), function(i) card(rows[i, ]), ""), collapse = ""))
}, "")
ranking <- rk[order(is.na(rk$rank), rk$rank, rk$id), c("rank", "id", "role", "verdict")]
ranking$rank[is.na(ranking$rank)] <- ""
counts <- read_data("fig28-class-counts"); counts$lower_pct <- round(counts$lower_pct, 1); counts$upper_pct <- round(counts$upper_pct, 1)
cuts <- read_data("fig28-cutpoints"); cuts$cutpoint_pct <- round(cuts$cutpoint_pct, 2)
pal <- read_data("fig28-palettes"); val <- read_data("fig28-palette-validation"); cvd <- read_data("fig28-palette-cvd")
fid <- readLines(file.path(dir, "fidelity", "fidelity.txt"), warn = FALSE)
html <- c('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">',
  '<title>Figure 2.8 restyle previews</title><style>',
  ':root{--ink:#24323D;--muted:#657680;--rule:#d9dee2;--blue:#2166AC;--box:#f6f8fa}',
  'body{max-width:1180px;margin:0 auto;padding:1rem 16px 3rem;font:15px/1.45 system-ui,sans-serif;color:var(--ink);background:#fff}',
  'h1{font-size:1.5rem;margin:0 0 .25rem}h2{font-size:1.2rem;margin:1.6rem 0 .4rem;border-top:2px solid var(--rule);padding-top:.8rem}h3{font-size:1.05rem;margin:0 0 .3rem}',
  '.meta{color:var(--muted);font-size:.88rem;margin:.2rem 0}.lead{margin:.2rem 0 .5rem}',
  '.card{border-top:1px solid var(--rule);padding:1rem 0}.row{display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap}',
  '.full{flex:3 1 520px}.side{flex:2 1 360px;display:flex;flex-direction:column;gap:8px}',
  'img{width:100%;height:auto;border:1px solid var(--rule);display:block}',
  '.tag{font-size:.75rem;background:var(--blue);color:#fff;padding:.1rem .45rem;border-radius:3px;vertical-align:middle;font-weight:normal}',
  'table{border-collapse:collapse;font-size:.85rem;margin:.4rem 0 1rem}th,td{border:1px solid var(--rule);padding:.2rem .5rem;text-align:left;vertical-align:top}th{background:var(--box)}',
  '.sw{display:inline-block;width:1.1em;height:1.1em;border:1px solid #999;vertical-align:middle;margin-right:.4em}code{font-size:.9em;background:var(--box);padding:0 .2em}pre{font-size:.8rem;background:var(--box);padding:.6rem;overflow:auto}',
  '@media print{.card{break-inside:avoid}}</style></head><body>',
  sprintf('<h1>Figure 2.8 restyle previews</h1><p class="meta">Built %s UTC in the dataviz lab from the three pinned inputs of the manuscript figure. Classes: pooled type-7 quintiles of the inclusion share over 1,334 supported cells (cutpoints %s%%). Review artifacts only; nothing is a manuscript exhibit until the author adopts it through Codex. Reasoning: <code>candidates/fig28-ranking.md</code>.</p>',
          format(Sys.time(), "%Y-%m-%d %H:%M", tz = "UTC"), paste(round(cuts$cutpoint_pct[cuts$classing == "pooled"], 1), collapse = " / ")),
  '<p>Each card shows the full page (220 dpi), the European-Russia crop of the first panel (600 dpi) and the same crop in grayscale. Variants differ only in the cell encoding, the legend and note line 2; titles, subtitles, geography and all other text are the manuscript strings.</p>',
  '<h2>Ranking</h2>', tbl(ranking),
  sections,
  '<h2>Classes</h2><p class="meta">Cutpoints (pooled used; per-panel recorded for comparison) and cells, cohort firms and eligible firms per class and panel.</p>', tbl(cuts), tbl(counts),
  '<h2>Palettes</h2><p class="meta">OKLab lightness per class and the step to the previous class (visibility floor 0.06).</p>', tbl(pal, swatch = "hex"),
  '<p class="meta">Validator output (dataviz six checks; ordinal ramp mode for the ordered palettes, all-pairs categorical mode for Dark2, surface = land colour #F1F2EF).</p>', tbl(val),
  '<p class="meta">Adjacent-pair colour differences (OKLab x 100) under normal vision and simulated protanopia, deuteranopia and tritanopia.</p>', tbl(cvd),
  '<h2>Fidelity of the re-render</h2><pre>', esc(paste(fid, collapse = "\n")), '</pre>',
  '</body></html>')
out <- lab_path("gallery", "fig28.html"); dir.create(dirname(out), showWarnings = FALSE)
writeLines(html, out, useBytes = TRUE)
cat("gallery:", out, "(", nrow(v), "variants,", round(file.info(out)$size / 1e6, 1), "MB )\n")
