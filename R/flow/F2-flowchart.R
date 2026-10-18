# F2 (flow): the sample-flow flowchart the author asked for on 18 October 2026 ("more visual,
# more flowchart, less text; tie the terminology to the registry"). Every box carries a
# registry name, one count line and the model that uses the population; the two partitions
# are proportional bars (states in the following year by prior state; entry into the revenue
# cohort by cash share). One layout, computed here from measured Nimbus Sans widths, is
# emitted twice: a cairo PDF (flow2-r) and TikZ with absolute coordinates (flow2-tikz).
# Every printed count is checked against the pinned manuscript files and the two Appendix B
# accounting pages before anything is drawn.
# Run: scripts/lab-ro.sh Rscript --vanilla R/flow/F2-flowchart.R ; then scripts/lab-ro.sh scripts/flow-build.sh
source(file.path(Sys.getenv("LAB_ROOT"), "R", "lab.R")); lab_init()
out_dir <- "20261018-fig27-gallery"
pal <- c(navy = "#16436E", lightnavy = "#A9C4DE", darkgray = "#43515A", midgray = "#6E7B83", gray = "#9AA5AB", green = "#004B3C",
         fill = "#F6F8FA", rule = "#AEB8BE", muted = "#5B6770", ink = "#24323D", white = "#FFFFFF")
dark <- c("navy", "darkgray", "midgray", "green")   # segments whose inside label is white

# Specification --------------------------------------------------------------------------
# Boxes: a registry name, then lines of (text, model tag). Bars: proportional segments per
# group plus one table of names and counts under the bars. List: the seven dispositions.
cols <- list(top = c(0.05, 6.45), left = c(0.05, 3.35), right = c(3.65, 6.45))
seg <- function(name, count, fill) list(name = name, count = count, fill = fill)
ln <- function(text, tag = NULL) list(text = text, tag = tag)
elements <- list(
  list(id = "N0", col = "top", type = "box", name = "Annual eligible population", accent = NA,
       lines = list(ln("3,357,109 firms in 2021 \u00b7 3,147,504 in 2024", "eligible annual model"),
                    ln("annual registered population: 2,959,193 \u00b7 2,926,282", "registered annual model"))),
  list(id = "L2", col = "left", type = "box", name = "Transition population", accent = "navy",
       lines = list(ln("10,484,716 prior observers"), ln("4,814,211 prior absentees"))),
  list(id = "L3", col = "left", type = "bars", title = "Resolved states in the following year",
       groups = list(
         list(label = "Prior observers", short = "observers", total = 10484716,
              segments = list(seg("available survivor (A)", 9323396, "navy"), seg("absent survivor (N)", 860366, "lightnavy"),
                              seg("removed (X)", 300868, "darkgray"), seg("reporting-scope change", 39, "gray"), seg("unresolved", 47, "gray"))),
         list(label = "Prior absentees", short = "absentees", total = 4814211,
              segments = list(seg("available survivor (A)", 462941, "navy"), seg("absent survivor (N)", 2949830, "lightnavy"),
                              seg("removed (X)", 1401172, "darkgray"), seg("reporting-scope change", 18, "gray"), seg("unresolved", 250, "gray"))))),
  list(id = "L4", col = "left", type = "box", name = "Survivor population", accent = "navy",
       lines = list(ln("13,596,533 available and absent survivors"), ln("retained sample 13,517,387", "survivor model"))),
  list(id = "L5", col = "left", type = "box", name = "Financial-retention samples", accent = "navy",
       lines = list(ln("asset-quintile sample 9,975,404 transitions"), ln("joint-complete sample 7,326,875 transitions"),
                    ln(NULL, "size models and the six financial specifications"))),
  list(id = "R1", col = "right", type = "bars", title = "Entry into the revenue cohort by cash share",
       groups = list(list(label = "2021 annual eligible population", total = 3357109,
              segments = list(seg("unresolved identity", 1138, "gray"), seg("original statement absent", 1226797, "lightnavy"),
                              seg("revenue not usable", 579417, "gray"), seg("cash share not usable", 46559, "midgray"),
                              seg("revenue cohort by cash share", 1503198, "green"))))),
  list(id = "R2", col = "right", type = "grid", name = "Fixed 2021 cohorts", accent = "green", tag = "Chapter 3 regressions",
       heads = c("cash share", "inventory share"),
       rows = list(c("revenue", "1,503,198", "1,179,338"), c("margin", "1,502,477", "1,178,930"))),
  list(id = "R3", col = "right", type = "list", title = "Annual dispositions, 2019\u20132024",
       items = c("usable outcome", "original statement absent", "missing required input", "structurally unavailable",
                 "invalid domain", "pending comparability", "unresolved"), tag = "Figure 2.9; 2021 usable by construction"))
arrows <- list(
  list(from = "N0", to = "L2", label = "paired with the following year"),
  list(from = "L2", to = "L3", label = "state in the following year"),
  list(from = "L3", to = "L4", label = "available and absent survivors only"),
  list(from = "L4", to = "L5", label = "prior observers, usable accounts"),
  list(from = "N0", to = "R1", label = "the 2021 records"),
  list(from = "R1", to = "R2", label = "all requirements met"),
  list(from = "R2", to = "R3", label = "followed each year"))
footer <- "Two branches, not one funnel. Names as in the terminology registry; counts from Tables 2.1 and B.2."

# Checks ---------------------------------------------------------------------------------
tex <- paste(unlist(lapply(c("flow.tex-02-data", "flow.tex-05-results", "flow.tex-07-financial", "flow.tex-appendix-b"),
                           function(s) readLines(lab_source(s), warn = FALSE, encoding = "UTF-8"))), collapse = "\n")
pages <- paste(unlist(lapply(c("flow.fig-cohort-accounting-1", "flow.fig-cohort-accounting-2"),
                             function(s) system2("pdftotext", c("-layout", shQuote(lab_source(s)), "-"), stdout = TRUE))), collapse = "\n")
printed <- function(x) grepl(x, tex, fixed = TRUE) || grepl(x, pages, fixed = TRUE)
all_text <- unlist(lapply(elements, function(e) c(e$name, unlist(lapply(e$lines, function(l) l$text)), e$title, e$items, e$heads, unlist(e$rows),
  unlist(lapply(e$groups, function(g) c(g$label, format(unlist(lapply(g$segments, `[[`, "count")), big.mark = ",", trim = TRUE)))))))
nums <- unique(unlist(regmatches(all_text, gregexpr("[0-9]{1,3}(,[0-9]{3})+", all_text))))
checks <- data.frame(check = paste("count", nums, "printed in the manuscript or Figure B.1/B.2"), expected = 1,
                     observed = as.integer(vapply(nums, printed, TRUE)), tolerance = 0)
sum_checks <- do.call(rbind, lapply(elements, function(e) if (e$type != "bars") NULL else do.call(rbind, lapply(e$groups, function(g)
  data.frame(check = paste("segments sum to the total:", g$label), expected = g$total, observed = sum(unlist(lapply(g$segments, `[[`, "count"))), tolerance = 0)))))
checks <- rbind(checks, sum_checks, data.frame(
  check = c("survivor population = available + absent survivors", "survivor model retained = survivor population - 79,146"),
  expected = c(13596533, 13517387), observed = c(9323396 + 462941 + 860366 + 2949830, 13596533 - 79146), tolerance = 0))
spec_rows <- do.call(rbind, lapply(elements, function(e) data.frame(element = e$id, column = e$col, type = e$type,
  title = if (!is.null(e$name)) e$name else e$title,
  text = paste(c(unlist(lapply(e$lines, function(l) l$text)), e$items, e$heads, unlist(e$rows), unlist(lapply(e$groups, `[[`, "label"))), collapse = " | "),
  tags = paste(c(unlist(lapply(e$lines, function(l) l$tag)), e$tag), collapse = " | "))))
lab_save_aggregate(spec_rows, "flow2-elements", stage = "flow", checks = checks)

# Measuring and wrapping ------------------------------------------------------------------
line_h <- 0.165; name_h <- 0.19; pad <- 0.07; bar_h <- 0.22
sw <- function(txt, cex = 1, font = 1) graphics::strwidth(txt, units = "inches", cex = cex, font = font)
wrap <- function(txt, width, cex = 1, font = 1) {
  words <- strsplit(txt, " ", fixed = TRUE)[[1]]; lines <- character(); cur <- ""
  for (w in words) { cand <- if (nzchar(cur)) paste(cur, w) else w
    if (sw(cand, cex, font) <= width) cur <- cand else { lines <- c(lines, cur); cur <- w } }
  c(lines, cur)
}

# Layout: absolute inches from the top-left corner. Returns drawable items and the height.
layout_flow <- function() {
  items <- list(); add <- function(x) items[[length(items) + 1]] <<- x
  tag_item <- function(x, y, text) add(list(kind = "tag", x = x, y = y, text = text))
  place_box <- function(e, x1, x2, y) {
    tx <- x1 + pad + 0.06; w <- x2 - tx - pad
    nl <- wrap(e$name, w, 1.1, 2)
    rows <- list()   # each row: text line, optional tag on the same line or on its own line
    for (l in e$lines) {
      if (is.null(l$text)) { rows[[length(rows) + 1]] <- list(text = NULL, tag = l$tag); next }
      tl <- wrap(l$text, w)
      for (i in seq_along(tl)) rows[[length(rows) + 1]] <- list(text = tl[i], tag = NULL)
      if (!is.null(l$tag)) {
        if (sw(tl[length(tl)]) + 0.25 + 0.11 + sw(l$tag) <= w) rows[[length(rows)]]$tag <- l$tag
        else rows[[length(rows) + 1]] <- list(text = NULL, tag = l$tag)
      }
    }
    h <- 2 * pad + length(nl) * name_h + length(rows) * line_h + 0.02
    add(list(kind = "box", id = e$id, x1 = x1, y1 = y, x2 = x2, y2 = y + h, accent = e$accent))
    ty <- y + pad
    for (l in nl) { add(list(kind = "text", x = tx, y = ty, text = l, cex = 1.1, font = 2, col = "ink")); ty <- ty + name_h }
    ty <- ty + 0.02
    for (r in rows) {
      if (!is.null(r$text)) add(list(kind = "text", x = tx, y = ty, text = r$text, cex = 1, font = 1, col = "ink"))
      if (!is.null(r$tag)) tag_item(x2 - pad - sw(r$tag) - 0.11, ty, r$tag)
      ty <- ty + line_h
    }
    y + h
  }
  place_bars <- function(e, x1, x2, y) {
    w <- x2 - x1
    for (l in wrap(e$title, w, 1, 2)) { add(list(kind = "text", x = x1, y = y, text = l, cex = 1, font = 2, col = "ink")); y <- y + line_h }
    y <- y + 0.045
    for (g in e$groups) {
      add(list(kind = "text", x = x1, y = y, text = g$label, cex = 1, font = 1, col = "muted")); y <- y + line_h + 0.015
      bx <- x1
      for (s in g$segments) {
        sw_in <- w * sum(s$count) / g$total
        if (sw_in < 0.004) next
        add(list(kind = "rect", x1 = bx, y1 = y, x2 = bx + sw_in, y2 = y + bar_h, fill = s$fill))
        lab <- paste(format(s$count, big.mark = ",", trim = TRUE), collapse = " + ")
        if (sw_in >= sw(lab) + 0.10) add(list(kind = "text", x = bx + sw_in / 2, y = y + bar_h / 2, text = lab, cex = 1, font = 1,
                                               col = if (s$fill %in% dark) "white" else "ink", anchor = "c"))
        bx <- bx + sw_in
      }
      y <- y + bar_h + 0.07
    }
    # table: one row per segment name, one count column per group
    y <- y + 0.03
    names_seen <- character(); fills <- character()
    for (g in e$groups) for (s in g$segments) if (!s$name %in% names_seen) { names_seen <- c(names_seen, s$name); fills <- c(fills, s$fill) }
    ng <- length(e$groups); colw <- if (ng > 1) 0.78 else 0.9
    if (ng > 1) { for (k in seq_len(ng)) add(list(kind = "text", x = x2 - (ng - k) * colw, y = y, text = e$groups[[k]]$short, cex = 1, font = 1, col = "muted", anchor = "ne")); y <- y + line_h }
    for (i in seq_along(names_seen)) {
      add(list(kind = "swatch", x1 = x1, y1 = y + 0.025, x2 = x1 + 0.12, y2 = y + 0.125, fill = fills[i]))
      add(list(kind = "text", x = x1 + 0.17, y = y, text = names_seen[i], cex = 1, font = 1, col = "ink"))
      for (k in seq_len(ng)) {
        s <- Filter(function(s) s$name == names_seen[i], e$groups[[k]]$segments)
        if (length(s)) add(list(kind = "text", x = x2 - (ng - k) * colw, y = y, text = paste(format(s[[1]]$count, big.mark = ",", trim = TRUE), collapse = " + "), cex = 1, font = 1, col = "ink", anchor = "ne"))
      }
      y <- y + line_h
    }
    y + 0.02
  }
  place_grid <- function(e, x1, x2, y) {
    tx <- x1 + pad + 0.06; c3 <- x2 - pad - 0.02; c2 <- c3 - 1.1
    nl <- wrap(e$name, x2 - tx - pad, 1.1, 2)
    h <- 2 * pad + length(nl) * name_h + 0.02 + (1 + length(e$rows)) * line_h + (if (!is.null(e$tag)) line_h else 0)
    add(list(kind = "box", id = e$id, x1 = x1, y1 = y, x2 = x2, y2 = y + h, accent = e$accent))
    ty <- y + pad
    for (l in nl) { add(list(kind = "text", x = tx, y = ty, text = l, cex = 1.1, font = 2, col = "ink")); ty <- ty + name_h }
    ty <- ty + 0.02
    add(list(kind = "text", x = c2, y = ty, text = e$heads[1], cex = 1, font = 1, col = "muted", anchor = "ne"))
    add(list(kind = "text", x = c3, y = ty, text = e$heads[2], cex = 1, font = 1, col = "muted", anchor = "ne")); ty <- ty + line_h
    for (r in e$rows) {
      add(list(kind = "text", x = tx, y = ty, text = r[1], cex = 1, font = 1, col = "ink"))
      add(list(kind = "text", x = c2, y = ty, text = r[2], cex = 1, font = 1, col = "ink", anchor = "ne"))
      add(list(kind = "text", x = c3, y = ty, text = r[3], cex = 1, font = 1, col = "ink", anchor = "ne")); ty <- ty + line_h
    }
    if (!is.null(e$tag)) tag_item(x2 - pad - sw(e$tag) - 0.11, ty, e$tag)
    y + h
  }
  place_list <- function(e, x1, x2, y) {
    for (l in wrap(e$title, x2 - x1, 1, 2)) { add(list(kind = "text", x = x1, y = y, text = l, cex = 1, font = 2, col = "ink")); y <- y + line_h }
    y <- y + 0.045
    for (i in seq_along(e$items)) {
      add(list(kind = "swatch", x1 = x1, y1 = y + 0.025, x2 = x1 + 0.12, y2 = y + 0.125, fill = if (i == 1) "navy" else "white", border = TRUE))
      add(list(kind = "text", x = x1 + 0.17, y = y, text = e$items[i], cex = 1, font = 1, col = "ink")); y <- y + line_h
    }
    if (!is.null(e$tag)) { y <- y + 0.02; tl <- wrap(e$tag, x2 - x1 - 0.11); tag_item(x1, y, tl[1]); y <- y + line_h
      for (l in tl[-1]) { add(list(kind = "text", x = x1 + 0.11, y = y, text = l, cex = 1, font = 1, col = "muted")); y <- y + line_h } }
    y
  }
  bottom <- place_box(elements[[1]], cols$top[1], cols$top[2], 0.05)
  ends <- c()
  for (side in c("left", "right")) {
    x1 <- cols[[side]][1]; x2 <- cols[[side]][2]; ax <- x1 + 0.45; y <- bottom; prev <- "N0"
    for (e in elements[-1]) {
      if (e$col != side) next
      a <- Filter(function(a) a$from == prev && a$to == e$id, arrows)[[1]]
      ll <- wrap(a$label, x2 - ax - 0.12)
      gap <- 0.08 + length(ll) * line_h + 0.08
      add(list(kind = "arrow", x = ax, y1 = y + 0.02, y2 = y + gap - 0.03, label = ll, lx = ax + 0.08, ly = y + 0.075))
      y <- y + gap
      y <- switch(e$type, box = place_box(e, x1, x2, y), grid = place_grid(e, x1, x2, y), bars = place_bars(e, x1, x2, y), list = place_list(e, x1, x2, y))
      prev <- e$id
    }
    ends <- c(ends, y)
  }
  fy <- max(ends) + 0.12; fl <- wrap(footer, 6.4)
  add(list(kind = "footer", x = 0.05, y = fy, lines = fl))
  list(items = items, H = ceiling((fy + length(fl) * line_h + 0.05) * 20) / 20)
}

# Emitters --------------------------------------------------------------------------------
draw_r <- function(L) {
  H <- L$H; Y <- function(y) H - y
  graphics::par(fig = c(0, 1, 0, 1), mar = rep(0, 4), xaxs = "i", yaxs = "i", family = lab_font, cex = 1, col = pal[["ink"]], fg = pal[["ink"]])
  graphics::plot.new(); graphics::plot.window(c(0, 6.5), c(0, H))
  for (it in L$items) switch(it$kind,
    box = {
      graphics::rect(it$x1, Y(it$y2), it$x2, Y(it$y1), col = pal[["fill"]], border = pal[["rule"]], lwd = .6)
      if (!is.na(it$accent)) graphics::rect(it$x1, Y(it$y2), it$x1 + 0.045, Y(it$y1), col = pal[[it$accent]], border = NA)
    },
    text = {
      adj <- switch(if (is.null(it$anchor)) "nw" else it$anchor, c = c(.5, .5), ne = c(1, 1), nw = c(0, 1))
      graphics::text(it$x, Y(it$y), it$text, adj = adj, cex = it$cex, font = it$font, col = pal[[it$col]])
    },
    swatch = graphics::rect(it$x1, Y(it$y2), it$x2, Y(it$y1), col = pal[[it$fill]], border = if (isTRUE(it$border)) pal[["rule"]] else NA, lwd = .6),
    rect = graphics::rect(it$x1, Y(it$y2), it$x2, Y(it$y1), col = pal[[it$fill]], border = "white", lwd = .5),
    tag = {
      graphics::polygon(it$x + c(0, 0.07, 0), Y(it$y + c(0.025, 0.07, 0.115)), col = pal[["muted"]], border = NA)
      graphics::text(it$x + 0.11, Y(it$y), it$text, adj = c(0, 1), col = pal[["muted"]])
    },
    arrow = {
      graphics::arrows(it$x, Y(it$y1), it$x, Y(it$y2), length = 0.07, angle = 22, lwd = 1, col = pal[["muted"]])
      ly <- it$ly; for (l in it$label) { graphics::text(it$lx, Y(ly), l, adj = c(0, 1), col = pal[["muted"]]); ly <- ly + line_h }
    },
    footer = { fy <- it$y; for (l in it$lines) { graphics::text(it$x, Y(fy), l, adj = c(0, 1), col = pal[["muted"]]); fy <- fy + line_h } })
}

tex_esc <- function(x) { x <- gsub("%", "\\\\%", x); x <- gsub("&", "\\\\&", x); x <- gsub("#", "\\\\#", x); x <- gsub("\u2013", "--", x); gsub("\u00b7", "\\\\textperiodcentered{}", x) }
emit_tikz <- function(L) {
  H <- L$H
  node <- function(x, y, text, col = "ink", font = "", anchor = "north west")
    sprintf("\\node[anchor=%s, inner sep=0pt, text=%s%s] at (%.4f,%.4f) {%s};", anchor, col, if (nzchar(font)) paste0(", font=", font) else "", x, y, tex_esc(text))
  rectp <- function(x1, y1, x2, y2, opts) sprintf("\\path[%s] (%.4f,%.4f) rectangle (%.4f,%.4f);", opts, x1, y1, x2, y2)
  tri <- function(x, y) sprintf("\\fill[muted] (%.4f,%.4f) -- (%.4f,%.4f) -- (%.4f,%.4f) -- cycle;", x, y + 0.025, x + 0.07, y + 0.07, x, y + 0.115)
  out <- c()
  for (it in L$items) out <- c(out, switch(it$kind,
    box = c(rectp(it$x1, it$y1, it$x2, it$y2, "draw=rule, fill=boxfill, line width=0.6pt"),
            if (!is.na(it$accent)) rectp(it$x1, it$y1, it$x1 + 0.045, it$y2, paste0("fill=", it$accent))),
    text = node(it$x, it$y, it$text, it$col, if (it$font == 2 && it$cex > 1) "\\bfseries\\fontsize{11.5}{13}\\selectfont" else if (it$font == 2) "\\bfseries" else "",
                switch(if (is.null(it$anchor)) "nw" else it$anchor, c = "center", ne = "north east", nw = "north west")),
    swatch = rectp(it$x1, it$y1, it$x2, it$y2, paste0("fill=", it$fill, if (isTRUE(it$border)) ", draw=rule, line width=0.6pt" else "")),
    rect = rectp(it$x1, it$y1, it$x2, it$y2, paste0("fill=", it$fill, ", draw=white, line width=0.5pt")),
    tag = c(tri(it$x, it$y), node(it$x + 0.11, it$y, it$text, "muted")),
    arrow = c(sprintf("\\draw[arrow] (%.4f,%.4f) -- (%.4f,%.4f);", it$x, it$y1, it$x, it$y2),
              { ly <- it$ly; lines <- c(); for (l in it$label) { lines <- c(lines, node(it$lx, ly, l, "muted")); ly <- ly + line_h }; lines }),
    footer = { fy <- it$y; lines <- c(); for (l in it$lines) { lines <- c(lines, node(it$x, fy, l, "muted")); fy <- fy + line_h }; lines }))
  c("% Generated by R/flow/F2-flowchart.R in the dataviz lab from one measured layout (absolute coordinates in inches,",
    "% y downward). Counts are the manuscript's own (Tables 2.1 and B.2, Figure B.2). Compile with pdflatex. Not a manuscript source.",
    "\\documentclass{article}",
    "\\usepackage[T1]{fontenc}\\usepackage[utf8]{inputenc}\\usepackage{helvet}\\renewcommand{\\familydefault}{\\sfdefault}",
    "\\usepackage{tikz}\\usetikzlibrary{arrows.meta}\\usepackage{xcolor}",
    paste0(sprintf("\\definecolor{%s}{HTML}{%s}", c("ink", "muted", "rule", "boxfill", "navy", "lightnavy", "darkgray", "midgray", "gray", "green", "white"),
                   sub("#", "", pal[c("ink", "muted", "rule", "fill", "navy", "lightnavy", "darkgray", "midgray", "gray", "green", "white")])), collapse = ""),
    "\\pagestyle{empty}\\parindent0pt",
    "\\tikzset{arrow/.style={-{Stealth[length=5pt, width=4pt]}, line width=0.7pt, draw=muted}}",
    "\\begin{document}\\newsavebox\\flowbox",
    sprintf("\\sbox\\flowbox{\\fontsize{10.5}{12.2}\\selectfont\\begin{tikzpicture}[x=1in, y=-1in]\\path (0,0) rectangle (6.5,%.4f);", H),
    out, "\\end{tikzpicture}}",
    sprintf("\\pdfpagewidth=6.5in \\pdfpageheight=%.4fin \\hoffset=-1in \\voffset=-1in \\topskip=0pt \\parskip=0pt", H),
    "\\shipout\\vbox to \\pdfpageheight{\\hbox to 6.5in{\\usebox\\flowbox\\hss}\\vss}", "\\csname @@end\\endcsname")   # plain TeX end: no \clearpage, so no blank second page
}

# Render ----------------------------------------------------------------------------------
tmp <- file.path(.lab$tmp, "measure.pdf")
grDevices::cairo_pdf(tmp, width = 6.5, height = 7, pointsize = 10.5, family = lab_font)
L <- layout_flow(); grDevices::dev.off()
if (nzchar(Sys.getenv("FLOW_DEBUG")) || L$H > 7) {
  for (it in L$items) if (it$kind == "box") message(sprintf("  box %-3s y %.2f-%.2f (%.2f)", it$id, it$y1, it$y2, it$y2 - it$y1))
    else if (it$kind == "text" && it$font == 2) message(sprintf("  title at y %.2f: %s", it$y, it$text))
    else if (it$kind == "arrow") message(sprintf("  arrow y %.2f-%.2f, %d label lines", it$y1, it$y2, length(it$label)))
    else if (it$kind == "footer") message(sprintf("  footer at y %.2f", it$y))
}
if (L$H > 7) stop(sprintf("flowchart needs %.2f in; the cap is 7 in", L$H))
out <- lab_dir("figures", out_dir); id <- "flow2-r"; pdf <- file.path(out, paste0(id, ".pdf"))
grDevices::cairo_pdf(pdf, width = 6.5, height = L$H, pointsize = 10.5, family = lab_font, onefile = TRUE)
tryCatch(draw_r(L), finally = grDevices::dev.off())
notes <- lab_write_notes(pdf, paste("Source: RFSD v3.1.0 and the sample accounting of Tables 2.1 and B.2 and Figure B.2.",
  "Box labels are the registry names; the model named under each population is the one estimated on it. Bars divide each prior-state transition population by its state in the following year, and the 2021 eligible population by the first failing entry requirement of the revenue cohort by cash share; segments too narrow to draw are stated in the bar labels.",
  "Transition counts are firm-year pairs, not distinct firms; cohort counts are firms fixed in 2021 and followed without later-survival requirements."))
prov <- lab_provenance(id, .lab$used_sources, extra = list(height_in = L$H, columns = cols))
prov$output <- list(pdf = pdf, pdf_sha256 = lab_sha256(pdf), width_in = 6.5, height_in = L$H, pointsize = 10.5, font = lab_font, notes_tex = notes)
jsonlite::write_json(prov, file.path(out, paste0(id, ".json")), auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null")
tex_path <- lab_path("R", "flow", "flow2-tikz.tex")
writeLines(emit_tikz(L), tex_path, useBytes = TRUE)
manifest_path <- lab_path("figures", out_dir, "variants.csv")
all <- utils::read.csv(manifest_path, stringsAsFactors = FALSE); all <- all[all$id != id, ]
all <- rbind(all, data.frame(order = max(all$order) + 1, id = id, group = "flow",
  label = "Flowchart (R): registry names and counts in the boxes, proportional bars for the two partitions, model tags; same layout as the TikZ version",
  pdf = basename(pdf), pdf_sha256 = lab_sha256(pdf), height_in = L$H, crop = NA))
utils::write.csv(all, manifest_path, row.names = FALSE)
cat(sprintf("flowchart: %s (%.2f in tall); TikZ source %s\n", basename(pdf), L$H, basename(tex_path)))
