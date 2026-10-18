# F1 (flow): the sample-flow diagram of review Point 13, two branches from the annual eligible
# population, never one funnel. One node specification (counts as the manuscript prints them)
# drives the R drawing and the TikZ source; every printed count is checked against the pinned
# manuscript files before anything is drawn. Two placements: the Chapter 1 Data section
# (flow-ch1-*) and a Chapter 2 version that could replace Table 2.1 (flow-ch2-*).
# Run: scripts/lab-ro.sh Rscript --vanilla R/flow/F1-flow.R ; then scripts/lab-ro.sh scripts/flow-build.sh
source(file.path(Sys.getenv("LAB_ROOT"), "R", "lab.R")); lab_init()
out_dir <- "20261018-fig27-gallery"
ink <- "#24323D"; muted <- "#5B6770"; rule <- "#AEB8BE"; boxfill <- "#F6F8FA"; navy <- "#16436E"; green <- "#004B3C"

# Node specifications -------------------------------------------------------------------
flow_ch2 <- list(
  id = "flow-ch2", title = "Populations and samples of the chapter: two branches, not one funnel",
  left_header = "Transitions (this chapter)", right_header = "Fixed 2021 cohorts (Chapter 3)",
  nodes = list(
    list(id = "N0", col = "top", title = "Annual eligible population, with its registered companion",
         body = "Every eligible financial-year record, with or without an original statement: 3,357,109 firms in 2021 and 3,147,504 in 2024. The annual registered population keeps those registered at the year-end: 2,959,193 and 2,926,282."),
    list(id = "L1", col = "left", title = "Transition population, following years 2020\u20132024",
         body = "Firm-year pairs, eligible and registered at the end of the preceding year: 10,484,716 prior observers and 4,814,211 prior absentees."),
    list(id = "L2", col = "left", title = "Resolved states in the following year",
         body = "Prior observers: 9,323,396 available, 860,366 absent, 300,868 removed, 39 scope changes, 47 unresolved. Prior absentees: 462,941 available, 2,949,830 absent, 1,401,172 removed, 18 scope changes, 250 unresolved."),
    list(id = "L3", col = "left", title = "Survivor population",
         body = "13,596,533 available and absent survivors; the survivor model retains 13,517,387 after categorical exclusions."),
    list(id = "L4", col = "left", title = "Financial-retention samples",
         body = "Prior observers with original exact-prior-year accounts and usable inputs: asset-quintile sample 9,975,404 transitions; joint-complete sample 7,326,875."),
    list(id = "R1", col = "right", title = "2021 annual eligible population",
         body = "3,357,109 firms."),
    list(id = "R2", col = "right", title = "Entry requirements, counted at the first failure",
         body = "Identity screen 1,138; no original 2021 statement 1,226,797, leaving 2,129,174; unusable outcome, revenue 579,417 or margin 580,228; unusable resource share, cash about 46,500 or inventories about 370,000."),
    list(id = "R3", col = "right", title = "Fixed 2021 cohorts",
         body = "Revenue cohort by cash share 1,503,198 and by inventory share 1,179,338; margin cohort 1,502,477 and 1,178,930. Cohorts overlap; membership never changes."),
    list(id = "R4", col = "right", title = "Annual dispositions, 2019\u20132024",
         body = "Each year's outcome is usable (100% in 2021 by construction) or falls in one of six other dispositions; follow-up is unbalanced, with no survival requirement.")),
  arrows = list(
    list(from = "N0", to = "L1", label = "registered firms paired with the following year"),
    list(from = "L1", to = "L2", label = "state in the following year"),
    list(from = "L2", to = "L3", label = "available and absent survivors only"),
    list(from = "L3", to = "L4", label = "prior observers with usable accounts"),
    list(from = "N0", to = "R1", label = "the 2021 records"),
    list(from = "R1", to = "R2", label = "requirements in a fixed order"),
    list(from = "R2", to = "R3", label = "all requirements met"),
    list(from = "R3", to = "R4", label = "followed each year")),
  footer = "Two branches, not one funnel: transitions count firm-year pairs within the FNS era; cohorts count firms fixed in 2021.")

flow_ch1 <- list(
  id = "flow-ch1", title = "From the registry population to the samples of the two empirical chapters",
  left_header = "Chapter 2: availability and transitions", right_header = "Chapter 3: fixed 2021 cohorts",
  nodes = list(
    list(id = "N0", col = "top", title = "Annual eligible population, RFSD v3.1.0",
         body = "Every registered legal entity the provider classifies as required to file, with or without a public statement: 3,357,109 firms in 2021, of which 2,959,193 were registered at the year-end."),
    list(id = "L1", col = "left", title = "Transition population",
         body = "Pairs of consecutive financial years within one provider era, following years 2020\u20132024: 10,484,716 prior-observer and 4,814,211 prior-absentee transitions."),
    list(id = "L2", col = "left", title = "Resolved states and the survivor population",
         body = "Available, absent or removed in the following year; the 13,596,533 available and absent survivors form the survivor population."),
    list(id = "L3", col = "left", title = "Financial-retention samples",
         body = "Prior observers with original exact-prior-year accounts and usable inputs: asset-quintile sample 9,975,404 transitions; joint-complete sample 7,326,875."),
    list(id = "R1", col = "right", title = "2021 eligible population",
         body = "3,357,109 firms."),
    list(id = "R2", col = "right", title = "Fixed 2021 cohorts",
         body = "Usable original 2021 accounts with the outcome, the resource share and the controls: revenue cohort by cash share 1,503,198; revenue cohort by inventory share 1,179,338; margin cohorts 1,502,477 and 1,178,930."),
    list(id = "R3", col = "right", title = "Unbalanced follow-up, 2019\u20132024",
         body = "Each year's outcome is usable or falls in one of six other dispositions; membership never changes and no later survival is required.")),
  arrows = list(
    list(from = "N0", to = "L1", label = "registered firms paired with the following year"),
    list(from = "L1", to = "L2", label = "state in the following year"),
    list(from = "L2", to = "L3", label = "prior observers with usable accounts"),
    list(from = "N0", to = "R1", label = "the 2021 records"),
    list(from = "R1", to = "R2", label = "entry requirements met"),
    list(from = "R2", to = "R3", label = "followed each year")),
  footer = "Two branches, not one funnel: transitions count firm-year pairs; cohorts count firms fixed in 2021.")

# Checks: every count printed in a diagram occurs in the pinned manuscript files ------------
tex <- paste(unlist(lapply(c("flow.tex-02-data", "flow.tex-05-results", "flow.tex-07-financial", "flow.tex-appendix-b"),
                           function(s) readLines(lab_source(s), warn = FALSE, encoding = "UTF-8"))), collapse = "\n")
counts_in <- function(spec) {
  txt <- unlist(lapply(spec$nodes, function(n) c(n$title, n$body)))
  unique(unlist(regmatches(txt, gregexpr("[0-9]{1,3}(,[0-9]{3})+", txt))))
}
check_rows <- do.call(rbind, lapply(list(flow_ch2, flow_ch1), function(spec) {
  k <- counts_in(spec)
  data.frame(check = paste(spec$id, "count", k, "printed in the manuscript"), expected = 1,
             observed = as.integer(vapply(k, function(x) grepl(x, tex, fixed = TRUE), TRUE)), tolerance = 0)
}))
check_rows <- rbind(check_rows, data.frame(
  check = c("prior observers resolve: A + N + X + 39 + 47", "prior absentees resolve: A + N + X + 18 + 250",
            "survivor population = available + absent survivors", "removals = removed observers + removed absentees",
            "survivor model retained = survivor population - 79,146", "identity screen and statement requirement leave 2,129,174"),
  expected = c(10484716, 4814211, 13596533, 1702040, 13517387, 2129174),
  observed = c(9323396 + 860366 + 300868 + 39 + 47, 462941 + 2949830 + 1401172 + 18 + 250,
               9323396 + 462941 + 860366 + 2949830, 300868 + 1401172, 13596533 - 79146, 3357109 - 1138 - 1226797),
  tolerance = 0))
spec_table <- do.call(rbind, lapply(list(flow_ch2, flow_ch1), function(spec) do.call(rbind, lapply(spec$nodes, function(n)
  data.frame(diagram = spec$id, node = n$id, column = n$col, title = n$title, body = n$body)))))
lab_save_aggregate(spec_table, "flow-nodes", stage = "flow", checks = check_rows)

# R drawing -------------------------------------------------------------------------------
# Layout in inches from the top-left corner; text 10.5 pt (cex 1 at pointsize 10.5), titles bold.
draw_flow <- function(spec, measure_only = FALSE, H = 7) {
  col_w <- 3.08; margin <- 0.05
  left_x <- margin; right_x <- 6.5 - margin - col_w; top_w <- 6.5 - 2 * margin
  pad_x <- 0.10; pad_y <- 0.07; line_h <- 0.165; arrow_gap <- 0.28
  wrap <- function(txt, width_in, font = 1) {
    words <- strsplit(txt, " ", fixed = TRUE)[[1]]; lines <- character(); cur <- ""
    for (w in words) {
      cand <- if (nzchar(cur)) paste(cur, w) else w
      if (graphics::strwidth(cand, units = "inches", font = font) <= width_in) cur <- cand else { lines <- c(lines, cur); cur <- w }
    }
    c(lines, cur)
  }
  node_h <- function(n, w) { tl <- wrap(n$title, w - 2 * pad_x, 2); bl <- wrap(n$body, w - 2 * pad_x, 1); list(tl = tl, bl = bl, h = 2 * pad_y + (length(tl) + length(bl)) * line_h + 0.03) }
  nodes <- spec$nodes; names(nodes) <- vapply(nodes, `[[`, "", "id")
  pos <- list(); y <- 0.06
  top <- nodes$N0; m <- node_h(top, top_w); pos$N0 <- list(x = margin, y = y, w = top_w, h = m$h, tl = m$tl, bl = m$bl); y_top_end <- y + m$h
  place_col <- function(ids, x) {
    yy <- y_top_end + arrow_gap + 0.20
    for (id in ids) { m <- node_h(nodes[[id]], col_w); pos[[id]] <<- list(x = x, y = yy, w = col_w, h = m$h, tl = m$tl, bl = m$bl); yy <- yy + m$h + arrow_gap }
    yy - arrow_gap
  }
  left_ids <- names(nodes)[vapply(nodes, function(n) n$col == "left", TRUE)]; right_ids <- names(nodes)[vapply(nodes, function(n) n$col == "right", TRUE)]
  end_l <- place_col(left_ids, left_x); end_r <- place_col(right_ids, right_x)
  footer_lines <- wrap(spec$footer, 6.5 - 2 * margin, 1)
  total_h <- max(end_l, end_r) + 0.14 + length(footer_lines) * line_h + 0.06
  if (measure_only) return(total_h)
  Y <- function(inch) H - inch
  graphics::par(fig = c(0, 1, 0, 1), mar = rep(0, 4), xaxs = "i", yaxs = "i", family = lab_font, cex = 1, col = ink, fg = ink)
  graphics::plot.new(); graphics::plot.window(c(0, 6.5), c(0, H))
  bar_col <- function(id) if (grepl("^L", id)) navy else if (grepl("^R", id)) green else NA
  for (id in names(pos)) {
    p <- pos[[id]]
    graphics::rect(p$x, Y(p$y + p$h), p$x + p$w, Y(p$y), col = boxfill, border = rule, lwd = .6)
    bc <- bar_col(id); if (!is.na(bc)) graphics::rect(p$x, Y(p$y + p$h), p$x + 0.045, Y(p$y), col = bc, border = NA)
    ty <- p$y + pad_y
    for (l in p$tl) { graphics::text(p$x + pad_x, Y(ty), l, adj = c(0, 1), font = 2); ty <- ty + line_h }
    ty <- ty + 0.03
    for (l in p$bl) { graphics::text(p$x + pad_x, Y(ty), l, adj = c(0, 1)); ty <- ty + line_h }
  }
  graphics::text(left_x, Y(pos[[left_ids[1]]]$y - 0.05), spec$left_header, adj = c(0, 0), font = 2, col = navy)
  graphics::text(right_x, Y(pos[[right_ids[1]]]$y - 0.05), spec$right_header, adj = c(0, 0), font = 2, col = green)
  for (a in spec$arrows) {
    f <- pos[[a$from]]; t <- pos[[a$to]]
    ax <- t$x + 0.45
    y0 <- f$y + f$h; y1 <- t$y
    if (a$from == "N0") y1 <- t$y - 0.24
    graphics::arrows(ax, Y(y0 + 0.02), ax, Y(y1 - 0.03), length = 0.07, angle = 22, lwd = 1, col = muted)
    graphics::text(ax + 0.08, Y((y0 + y1) / 2), a$label, adj = c(0, .5), col = muted)
  }
  fy <- max(end_l, end_r) + 0.14
  for (l in footer_lines) { graphics::text(margin, Y(fy), l, adj = c(0, 1), col = muted); fy <- fy + line_h }
  invisible(total_h)
}
render_r <- function(spec) {
  tmp <- file.path(.lab$tmp, "measure.pdf")
  grDevices::cairo_pdf(tmp, width = 6.5, height = 7, pointsize = 10.5, family = lab_font)
  H <- draw_flow(spec, measure_only = TRUE); grDevices::dev.off()
  if (H > 7) stop(sprintf("%s needs %.2f in; the cap is 7 in. Shorten the text.", spec$id, H))
  H <- ceiling(H * 20) / 20
  out <- lab_dir("figures", out_dir); id <- paste0(spec$id, "-r")
  pdf <- file.path(out, paste0(id, ".pdf"))
  grDevices::cairo_pdf(pdf, width = 6.5, height = H, pointsize = 10.5, family = lab_font, onefile = TRUE)
  tryCatch(draw_flow(spec, H = H), finally = grDevices::dev.off())
  notes <- lab_write_notes(pdf, paste("Source: RFSD v3.1.0 and the sample accounting of Tables 2.1 and B.2.",
    "The two branches start from the same annual eligible population and are not successive steps of one funnel. Transition counts are firm-year pairs, not distinct firms; cohort counts are firms fixed in 2021 and followed without later-survival requirements."))
  prov <- lab_provenance(id, .lab$used_sources, extra = list(spec = spec$id, height_in = H))
  prov$output <- list(pdf = pdf, pdf_sha256 = lab_sha256(pdf), width_in = 6.5, height_in = H, pointsize = 10.5, font = lab_font, notes_tex = notes)
  jsonlite::write_json(prov, file.path(out, paste0(id, ".json")), auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null")
  message(sprintf("  figure %s: %.2f in tall", id, H))
  data.frame(id = id, pdf = basename(pdf), pdf_sha256 = lab_sha256(pdf), height_in = H)
}

# TikZ source ------------------------------------------------------------------------------
tex_escape <- function(x) { x <- gsub("%", "\\\\%", x); x <- gsub("&", "\\\\&", x); gsub("\u2013", "--", x) }
tikz_doc <- function(spec) {
  nodes <- spec$nodes; names(nodes) <- vapply(nodes, `[[`, "", "id")
  left_ids <- names(nodes)[vapply(nodes, function(n) n$col == "left", TRUE)]; right_ids <- names(nodes)[vapply(nodes, function(n) n$col == "right", TRUE)]
  node_tex <- function(n, style, at) sprintf("\\node[%s] (%s) at (%s) {\\textbf{%s}\\\\[1pt]%s};", style, n$id, at, tex_escape(n$title), tex_escape(n$body))
  lines <- c(
    "% Generated by R/flow/F1-flow.R in the dataviz lab; counts are the manuscript's own (Tables 2.1 and B.2).",
    "% Compile: pdflatex; the page is 6.5 in wide and as tall as the picture. Not a manuscript source.",
    "\\documentclass{article}",
    "\\usepackage[T1]{fontenc}\\usepackage[utf8]{inputenc}\\usepackage{helvet}\\renewcommand{\\familydefault}{\\sfdefault}",
    "\\usepackage{tikz}\\usetikzlibrary{arrows.meta,positioning,calc}\\usepackage{xcolor}",
    sprintf("\\definecolor{ink}{HTML}{%s}\\definecolor{muted}{HTML}{%s}\\definecolor{rule}{HTML}{%s}\\definecolor{boxfill}{HTML}{%s}\\definecolor{navy}{HTML}{%s}\\definecolor{green}{HTML}{%s}",
            sub("#", "", ink), sub("#", "", muted), sub("#", "", rule), sub("#", "", boxfill), sub("#", "", navy), sub("#", "", green)),
    "\\pagestyle{empty}\\parindent0pt",
    "\\tikzset{box/.style={rectangle, draw=rule, fill=boxfill, line width=0.5pt, inner xsep=8pt, inner ysep=4.5pt, align=left, text=ink, anchor=north west},",
    "  col/.style={box, text width=2.84in}, top/.style={box, text width=6.16in},",
    "  arrow/.style={-{Stealth[length=5pt, width=4pt]}, line width=0.6pt, draw=muted},",
    "  lab/.style={text=muted, anchor=west, inner sep=2pt}, head/.style={anchor=south west, inner sep=0pt, font=\\bfseries}}",
    "\\begin{document}",
    "\\newsavebox\\flowbox",
    "\\sbox\\flowbox{\\fontsize{10.5}{12.2}\\selectfont\\begin{tikzpicture}[x=1in, y=1in]",
    "\\path (0,0) -- (6.5,0);",
    node_tex(nodes$N0, "top", "0.05,-0.02"))
  prev <- "N0"; first <- TRUE
  for (id in left_ids) {
    at <- if (first) "[yshift=-0.50in]N0.south west" else sprintf("[yshift=-0.28in]%s.south west", prev)
    lines <- c(lines, node_tex(nodes[[id]], "col", at)); prev <- id; first <- FALSE
  }
  prev <- "N0"; first <- TRUE
  for (id in right_ids) {
    at <- if (first) "[yshift=-0.50in]N0.south east" else sprintf("[yshift=-0.28in]%s.south west", prev)
    style <- if (first) "col, anchor=north east" else "col"
    lines <- c(lines, node_tex(nodes[[id]], style, at)); prev <- id; first <- FALSE
  }
  lines <- c(lines,
    sprintf("\\node[head, text=navy] at ([yshift=0.05in]%s.north west) {%s};", left_ids[1], tex_escape(spec$left_header)),
    sprintf("\\node[head, text=green] at ([yshift=0.05in]%s.north west) {%s};", right_ids[1], tex_escape(spec$right_header)))
  for (id in c(left_ids, right_ids)) lines <- c(lines, sprintf("\\fill[%s] (%s.north west) rectangle ([xshift=3.2pt]%s.south west);", if (grepl("^L", id)) "navy" else "green", id, id))
  lines <- c(lines, sprintf("\\coordinate (LX) at ([xshift=0.45in]%s.north west); \\coordinate (RX) at ([xshift=0.45in]%s.north west);", left_ids[1], right_ids[1]))
  for (a in spec$arrows) {
    ax <- if (a$to %in% left_ids) "LX" else "RX"
    end <- if (a$from == "N0") sprintf("($(%s |- %s.north)+(0,0.24in)$)", ax, a$to) else sprintf("(%s |- %s.north)", ax, a$to)
    lines <- c(lines, sprintf("\\draw[arrow] (%s |- %s.south) -- %s node[lab, pos=0.5] {%s};", ax, a$from, end, tex_escape(a$label)))
  }
  last_l <- left_ids[length(left_ids)]; last_r <- right_ids[length(right_ids)]
  lines <- c(lines,
    sprintf("\\path let \\p1 = (%s.south), \\p2 = (%s.south) in coordinate (B) at (0.05, {min(\\y1, \\y2)});", last_l, last_r),
    sprintf("\\node[anchor=north west, inner sep=0pt, text width=6.3in, align=left, text=muted] at ([yshift=-0.12in]B) {%s};", tex_escape(spec$footer)),
    "\\end{tikzpicture}}",
    "\\pdfpagewidth=6.5in \\pdfpageheight=\\dimexpr\\ht\\flowbox+\\dp\\flowbox+0.08in\\relax",
    "\\hoffset=-1in \\voffset=-1in \\topskip=0pt \\parskip=0pt",
    "\\shipout\\vbox to \\pdfpageheight{\\vskip0.04in\\hbox to 6.5in{\\usebox\\flowbox\\hss}\\vss}",
    "\\csname @@end\\endcsname")   # plain TeX end: no \clearpage, so no blank second page
  lines
}
for (spec in list(flow_ch2, flow_ch1)) {
  path <- lab_path("R", "flow", paste0(spec$id, "-tikz.tex"))
  writeLines(tikz_doc(spec), path, useBytes = TRUE)
  message("  wrote ", basename(path))
}

# R renders and the manifest rows -------------------------------------------------------
rows <- do.call(rbind, lapply(list(flow_ch2, flow_ch1), render_r))
manifest_path <- lab_path("figures", out_dir, "variants.csv")
all <- utils::read.csv(manifest_path, stringsAsFactors = FALSE)
all <- all[!grepl("^flow-", all$id), ]
labels <- c(`flow-ch2-r` = "Sample-flow diagram, Chapter 2 version (R): full counts of Table 2.1 and B.2, could replace Table 2.1",
            `flow-ch1-r` = "Sample-flow diagram, Chapter 1 version (R): structure first with headline counts, serves both empirical chapters")
new <- data.frame(order = max(all$order) + seq_len(nrow(rows)), id = rows$id, group = "flow", label = labels[rows$id],
                  pdf = rows$pdf, pdf_sha256 = rows$pdf_sha256, height_in = rows$height_in, crop = NA)
utils::write.csv(rbind(all, new), manifest_path, row.names = FALSE)
cat("flow: R versions drawn, TikZ sources written; compile with scripts/lab-ro.sh scripts/flow-build.sh\n")
