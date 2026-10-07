# Builds gallery/index.html from candidates/*.json (written by the figure scripts via
# lab_save_figure's JSON plus the candidate metadata). Self-contained: PNGs embedded.
source(file.path(Sys.getenv("LAB_ROOT"), "R", "lab.R")); lab_init(quiet = TRUE)
files <- list.files(lab_path("candidates"), pattern = "[.]json$", full.names = TRUE)
cards <- lapply(files, function(f) jsonlite::fromJSON(f, simplifyVector = FALSE))
rank_of <- function(c) if (is.null(c$rank) || is.na(c$rank)) 999 else as.numeric(c$rank)
cards <- cards[order(vapply(cards, rank_of, 1), vapply(cards, function(c) c$id, ""))]
esc <- function(x) { x <- gsub("&", "&amp;", x, fixed = TRUE); x <- gsub("<", "&lt;", x, fixed = TRUE); gsub(">", "&gt;", x, fixed = TRUE) }
b64 <- function(path) jsonlite::base64_enc(readBin(path, "raw", file.info(path)$size))
card_html <- function(c) {
  png <- c$png; img <- if (!is.null(png) && file.exists(png)) sprintf('<img src="data:image/png;base64,%s" alt="%s">', b64(png), esc(c$title)) else "<p class=\"meta\">no PNG</p>"
  fin <- if (!is.null(c$finalist) && isTRUE(c$finalist)) ' <span class="tag">finalist</span>' else ""
  caveats <- if (length(c$caveats)) paste0("<ul>", paste0("<li>", esc(unlist(c$caveats)), "</li>", collapse = ""), "</ul>") else ""
  sprintf('<section class="card" id="%s"><h2>%s. %s%s</h2><p class="meta">Rank %s · Stage %s · %s</p><p class="q"><strong>Question.</strong> %s</p>%s<p><strong>Reading.</strong> %s</p>%s<p class="meta">%s</p><p class="meta">Brief: <code>candidates/%s.md</code> · PDF: <code>%s</code></p></section>',
          esc(c$id), esc(c$id), esc(c$title), fin, esc(as.character(rank_of(c))), esc(c$stage %||% ""), esc(c$source_line %||% ""),
          esc(c$question %||% ""), img, esc(c$reading %||% ""), caveats, esc(c$notes_text %||% ""), esc(c$id), esc(basename(c$pdf %||% "")))
}
`%||%` <- function(a, b) if (is.null(a)) b else a
html <- c('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">',
  '<title>Dataviz lab gallery</title><style>',
  ':root{--ink:#24323D;--muted:#657680;--rule:#d9dee2;--blue:#2166AC;--brick:#B35832;--box:#f6f8fa}',
  'body{max-width:960px;margin:0 auto;padding:1rem 16px 3rem;font:16px/1.5 system-ui,sans-serif;color:var(--ink);background:#fff}',
  'h1{font-size:1.5rem;margin:0 0 .25rem}h2{font-size:1.15rem;margin:0 0 .3rem}.meta{color:var(--muted);font-size:.9rem;margin:.2rem 0}',
  '.card{border-top:1px solid var(--rule);padding:1.2rem 0}.card img{width:100%;height:auto;border:1px solid var(--rule);display:block;margin:.6rem 0}',
  '.tag{font-size:.75rem;background:var(--blue);color:#fff;padding:.1rem .4rem;border-radius:3px;vertical-align:middle}',
  '.q{margin:.3rem 0}ul{margin:.3rem 0 .3rem 1.2rem}code{font-size:.9em;background:var(--box);padding:0 .2em}',
  '@media print{.card{break-inside:avoid}}</style></head><body>',
  sprintf('<h1>Dataviz lab gallery</h1><p class="meta">Built %s UTC from %d candidate files. Finalists first. Every figure is a review artifact; nothing is a manuscript exhibit until the author adopts it through Codex.</p>',
          format(Sys.time(), "%Y-%m-%d %H:%M", tz = "UTC"), length(cards)),
  vapply(cards, card_html, ""), '</body></html>')
out <- lab_path("gallery", "index.html"); dir.create(dirname(out), showWarnings = FALSE)
writeLines(html, out, useBytes = TRUE)
cat("gallery:", out, "(", length(cards), "cards,", round(file.info(out)$size / 1e6, 1), "MB )\n")
