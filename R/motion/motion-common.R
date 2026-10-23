# Motion-style explainer and explorer, 22 October 2026. Shared helpers for the data pass:
# JSON/JS exports for the web pages with provenance sidecars and numeric checks. Source after
# R/lab.R and lab_init(). Nothing here is a manuscript source or an authorization.

motion_dir <- function(...) lab_dir("motion", ...)
motion_data_dir <- function() motion_dir("data")

# Every name inside a nested list or data frame, for the identifier refusal.
motion_names <- function(x) {
  if (is.data.frame(x)) return(names(x))
  if (is.list(x)) return(unique(c(names(x), unlist(lapply(x, motion_names), use.names = FALSE))))
  character()
}

# One check row; motion_checks() binds several.
motion_check <- function(check, expected, observed, tolerance = 0) {
  if (length(observed) != 1L || length(expected) != 1L) stop(sprintf("check '%s': expected %d value(s), observed %d", check, length(expected), length(observed)))
  data.frame(check = check, expected = expected, observed = observed, tolerance = tolerance)
}
motion_checks <- function(...) do.call(rbind, list(...))

# Writes motion/data/<id>.json, the <id>.js global wrapper (window.MOTION_DATA[id]), a
# provenance sidecar and <id>.checks.csv. Data frames become column arrays. Stops on a
# failed check or an identifier-like name anywhere in the object.
motion_save_json <- function(obj, id, sources = .lab$used_sources, checks = NULL, extra = list(),
                             rows = NULL, digits = NA) {
  nm <- motion_names(obj)
  bad <- grep("(^|_)(inn|ogrn)(_|$)", nm, ignore.case = TRUE, value = TRUE)   # whole tokens: "pinned" is not an identifier
  if (length(bad)) stop("Motion data never carry firm identifiers: ", paste(bad, collapse = ", "))
  dir <- motion_data_dir()
  lab_run_checks(id, checks, dir)
  json <- file.path(dir, paste0(id, ".json"))
  jsonlite::write_json(obj, json, auto_unbox = TRUE, digits = digits, null = "null", na = "null", dataframe = "columns")
  txt <- paste(readLines(json, warn = FALSE), collapse = "\n")
  js <- file.path(dir, paste0(id, ".js"))
  writeLines(c("window.MOTION_DATA = window.MOTION_DATA || {};",
               paste0('window.MOTION_DATA["', id, '"] = ', txt, ";")), js, useBytes = TRUE)
  prov <- lab_provenance(id, sources, rows = rows, extra = extra)
  prov$output <- list(json = json, json_sha256 = lab_sha256(json), json_bytes = file.size(json),
                      js = js, js_sha256 = lab_sha256(js), names = nm)
  jsonlite::write_json(prov, file.path(dir, paste0(id, ".provenance.json")), auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null")
  message(sprintf("  motion data %s: %s (%.0f kB), %s", id, basename(json), file.size(json) / 1e3, basename(js)))
  invisible(json)
}

motion_read_json <- function(id) jsonlite::fromJSON(file.path(motion_data_dir(), paste0(id, ".json")), simplifyVector = TRUE)

# Base64 of little-endian integer vectors for the dense cell layers.
motion_b64_int16 <- function(x) jsonlite::base64_enc(writeBin(as.integer(x), raw(), size = 2L, endian = "little"))
motion_b64_int32 <- function(x) jsonlite::base64_enc(writeBin(as.integer(x), raw(), size = 4L, endian = "little"))

# Format helpers used in facts.
motion_count <- function(x) format(round(x), big.mark = ",", trim = TRUE, scientific = FALSE)
motion_pct <- function(x, digits = 1) formatC(x, format = "f", digits = digits)
