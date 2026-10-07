# Notes live outside the PDF, in the house LaTeX form. Returns the snippet path.

lab_tex_escape <- function(x) {
  special <- c("\\" = "\\textbackslash{}", "&" = "\\&", "%" = "\\%", "$" = "\\$", "#" = "\\#",
               "_" = "\\_", "{" = "\\{", "}" = "\\}", "~" = "\\textasciitilde{}", "^" = "\\textasciicircum{}")
  vapply(x, function(s) {
    chars <- strsplit(s, "", fixed = TRUE)[[1]]
    repl <- chars %in% names(special)
    chars[repl] <- unname(special[chars[repl]])
    paste0(chars, collapse = "")
  }, character(1), USE.NAMES = FALSE)
}

lab_write_notes <- function(pdf, notes) {
  path <- sub("[.]pdf$", "-notes.tex", pdf)
  writeLines(c("% Generated notes; insert inside the manuscript figure environment.",
               paste0("\\par\\vspace{2pt}{\\footnotesize\\setstretch{1.0} ", lab_tex_escape(notes), "\\par}")),
             path, useBytes = TRUE)
  path
}
