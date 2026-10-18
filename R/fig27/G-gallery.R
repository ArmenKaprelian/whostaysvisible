# G: self-contained gallery page for the Figure 2.7 study (PNGs embedded): the current figure
# as reference, the Point 20 designs, the Point 22 change map and composite, the Point 13
# sample-flow diagrams, then the data behind them and the checks.
# Reads figures/20261018-fig27-gallery/variants.csv, candidates/fig27-ranking.csv, data/fig27/*, data/flow/*.
# Run: scripts/lab-ro.sh Rscript --vanilla R/fig27/G-gallery.R
source(file.path(Sys.getenv("LAB_ROOT"), "R", "lab.R")); lab_init(quiet = TRUE)
dir <- lab_path("figures", "20261018-fig27-gallery")
v <- utils::read.csv(file.path(dir, "variants.csv"), stringsAsFactors = FALSE)
rk <- utils::read.csv(lab_path("candidates", "fig27-ranking.csv"), stringsAsFactors = FALSE)
v <- merge(v, rk, by = "id", all.x = TRUE); v <- v[order(v$order), ]
read_data <- function(stage, id) utils::read.csv(lab_path("data", stage, paste0(id, ".csv")), check.names = FALSE, stringsAsFactors = FALSE)
esc <- function(x) { x <- gsub("&", "&amp;", x, fixed = TRUE); x <- gsub("<", "&lt;", x, fixed = TRUE); gsub(">", "&gt;", x, fixed = TRUE) }
b64 <- function(path) jsonlite::base64_enc(readBin(path, "raw", file.info(path)$size))
img <- function(path, alt, cls = "") if (file.exists(path)) sprintf('<img class="%s" src="data:image/png;base64,%s" alt="%s" loading="lazy">', cls, b64(path), esc(alt)) else ""
tbl <- function(df, swatch = NULL) {
  head <- paste0("<th>", esc(names(df)), "</th>", collapse = "")
  rows <- vapply(seq_len(nrow(df)), function(i) {
    cells <- vapply(names(df), function(n) {
      val <- df[i, n]; txt <- esc(if (is.numeric(val)) format(val, digits = 6, big.mark = ",") else as.character(val))
      if (!is.null(swatch) && n == swatch) sprintf('<td><span class="sw" style="background:%s"></span>%s</td>', val, txt) else paste0("<td>", txt, "</td>")
    }, "")
    paste0("<tr>", paste0(cells, collapse = ""), "</tr>")
  }, "")
  sprintf("<table><thead><tr>%s</tr></thead><tbody>%s</tbody></table>", head, paste0(rows, collapse = ""))
}
card <- function(r) {
  tag <- if (!is.na(r$rank) && nzchar(r$role)) sprintf("Rank %s · %s", r$rank, r$role) else if (!is.na(r$role)) r$role else ""
  side <- paste0(img(file.path(dir, paste0(r$id, "-zoom.png")), paste(r$id, "zoom"), "zoom"), img(file.path(dir, paste0(r$id, "-zoom-gray.png")), paste(r$id, "grayscale"), "zoom"))
  layout <- if (nzchar(side)) sprintf('<div class="row"><div class="full">%s</div><div class="side">%s</div></div>', img(file.path(dir, paste0(r$id, ".png")), r$id, "page"), side)
            else sprintf('<div class="row"><div class="full">%s</div></div>', img(file.path(dir, paste0(r$id, ".png")), r$id, "page"))
  sprintf('<section class="card" id="%s"><h3>%s <span class="tag">%s</span></h3><p class="lead">%s</p>%s<p class="meta">PDF <code>%s</code> · %.2f in tall · sha256 %s</p></section>',
          esc(r$id), esc(r$id), esc(tag), esc(ifelse(is.na(r$verdict), r$label, paste0(r$label, " — ", r$verdict))), layout, esc(r$pdf), r$height_in, esc(substr(r$pdf_sha256, 1, 12)))
}
groups <- list(c("reference", "Reference: the current Figure 2.7, redrawn by the lab from the pinned inputs (the author's choice for Item 1)"),
               c("fig27", "Item 1 (Point 20): Figure 2.7 redesigns A and B, not chosen"),
               c("change", "Item 2 (Point 22): availability change, 2024 against 2021, adopted"),
               c("composite", "Item 2 layouts on one page: the current available panel over the change map (for Codex), and the earlier A1 composite"),
               c("flow", "Item 3 (Point 13): the lab\'s diagrams, none adopted"))
sections <- vapply(groups, function(g) {
  rows <- v[v$group == g[1], ]
  if (!nrow(rows)) return("")
  paste0(sprintf('<h2>%s</h2>', esc(g[2])), paste0(vapply(seq_len(nrow(rows)), function(i) card(rows[i, ]), ""), collapse = ""))
}, "")
ranking <- rk[order(rk$item, rk$rank), c("item", "rank", "id", "role", "verdict")]
totals <- read_data("fig27", "fig27-list-totals-2021")
chg <- read_data("fig27", "fig27-availability-change-cells"); sup <- chg[chg$supported, ]
classes <- as.data.frame(table(class = sup$class)); pal <- read_data("fig27", "fig27-change-palette")
classes <- merge(pal, classes, by = "class"); names(classes)[names(classes) == "Freq"] <- "supported cells"
val <- jsonlite::fromJSON(lab_path("data", "fig27", "fig27-change-palette.provenance.json"))$extra$validation
chk_list <- utils::read.csv(lab_path("data", "fig27", "fig27-list-cells-2021.checks.csv"), stringsAsFactors = FALSE)
chk_chg <- utils::read.csv(lab_path("data", "fig27", "fig27-availability-change-cells.checks.csv"), stringsAsFactors = FALSE)
chk_flow <- utils::read.csv(lab_path("data", "flow", "flow-nodes.checks.csv"), stringsAsFactors = FALSE)
fid <- readLines(file.path(dir, "fidelity", "fidelity.txt"), warn = FALSE)
pdfchk <- readLines(file.path(dir, "pdf-check.txt"), warn = FALSE)
manu <- file.path(dir, "fidelity", "manuscript.png")
html <- c('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">',
  '<title>Figure 2.7 gallery</title><style>',
  ':root{--ink:#24323D;--muted:#657680;--rule:#d9dee2;--blue:#16436E;--brick:#B35832;--box:#f6f8fa}',
  'body{max-width:1180px;margin:0 auto;padding:1rem 16px 3rem;font:15px/1.45 system-ui,sans-serif;color:var(--ink);background:#fff}',
  'h1{font-size:1.5rem;margin:0 0 .25rem}h2{font-size:1.2rem;margin:1.6rem 0 .4rem;border-top:2px solid var(--rule);padding-top:.8rem}h3{font-size:1.05rem;margin:0 0 .3rem}',
  '.meta{color:var(--muted);font-size:.88rem;margin:.2rem 0}.lead{margin:.2rem 0 .5rem}',
  '.card{border-top:1px solid var(--rule);padding:1rem 0}.row{display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap}',
  '.full{flex:3 1 520px}.side{flex:2 1 360px;display:flex;flex-direction:column;gap:8px}',
  'img{width:100%;height:auto;border:1px solid var(--rule);display:block}',
  '.tag{font-size:.75rem;background:var(--brick);color:#fff;padding:.1rem .45rem;border-radius:3px;vertical-align:middle;font-weight:normal}',
  'table{border-collapse:collapse;font-size:.85rem;margin:.4rem 0 1rem}th,td{border:1px solid var(--rule);padding:.2rem .5rem;text-align:left;vertical-align:top}th{background:var(--box)}',
  '.sw{display:inline-block;width:1.1em;height:1.1em;border:1px solid #999;vertical-align:middle;margin-right:.4em}code{font-size:.9em;background:var(--box);padding:0 .2em}pre{font-size:.8rem;background:var(--box);padding:.6rem;overflow:auto}',
  '.warn{background:#fff6e5;border:1px solid #e8c98a;padding:.5rem .8rem;border-radius:4px}',
  '@media print{.card{break-inside:avoid}}</style></head><body>',
  sprintf('<h1>Figure 2.7 gallery: Points 20, 22 and 13 of the 18 October review</h1><p class="meta">Built %s UTC in the dataviz lab from pinned inputs. Review artifacts only; nothing is a manuscript exhibit until the author adopts it through Codex. Reasoning and recommendations: <code>candidates/fig27-ranking.md</code>.</p>',
          format(Sys.time(), "%Y-%m-%d %H:%M", tz = "UTC")),
  '<p class="warn">Provisional. Every label uses the proposed names of the terminology registry (Section 3 of the review); the ranking stands until the registry is approved, and the picked candidate is re-rendered by Codex from the pipeline. The author\'s picks of 18 October are recorded verbatim in <code>candidates/decisions.md</code>: Item 1 keeps the current figure; Item 2 is adopted with the layout left to Codex (one page with the available panel, or a second page); Item 3 asked for a flowchart with less text; the lab\'s flowchart <code>flow2</code> was also found too dense, so no Item 3 candidate stands and Codex makes its own pass from <code>candidates/fig27-flow-codex-brief.md</code>.</p>',
  '<p>Map cards show the full page at 220 dpi, then a 600 dpi crop of European Russia in colour and in grayscale. The current manuscript figure is shown first for comparison. Every candidate is 6.5 in wide with text at 10.5 pt or larger; the current figure draws its notes at 8.3 pt.</p>',
  '<h2>Ranking (provisional)</h2>', tbl(ranking),
  '<h2>The current manuscript figure</h2>', img(manu, "manuscript Figure 2.7", "page"), '<pre>', esc(paste(fid, collapse = "\n")), '</pre>',
  sections,
  '<h2>Data behind the candidates</h2><p class="meta">Supplied-list totals in the 2021 annual eligible population (membership overlap table) and the located counts drawn as marks.</p>', tbl(totals),
  '<p class="meta">Availability change: classes, colours (OKLab lightness) and supported cells per class.</p>', tbl(classes[, c("class", "label", "hex", "oklab_L", "supported cells")], swatch = "hex"),
  '<p class="meta">Palette validator output (dataviz six checks; ordinal mode per side, all-pairs over the six classes, surface = land colour #F1F2EF).</p>', tbl(as.data.frame(val)),
  '<h2>Checks</h2><p class="meta">Supplied-list cells and totals.</p>', tbl(chk_list), '<p class="meta">Availability-change cells.</p>', tbl(chk_chg),
  '<p class="meta">Sample-flow diagram: every printed count occurs in the pinned manuscript files, and the arithmetic the diagram relies on.</p>', tbl(chk_flow),
  '<h2>pdf-check</h2><pre>', esc(paste(pdfchk, collapse = "\n")), '</pre>',
  '</body></html>')
out <- lab_path("gallery", "fig27.html"); dir.create(dirname(out), showWarnings = FALSE)
writeLines(html, out, useBytes = TRUE)
cat("gallery:", out, "(", nrow(v), "cards,", round(file.info(out)$size / 1e6, 1), "MB )\n")
