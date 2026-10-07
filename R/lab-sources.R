# Pinned inputs. config/sources.json is the only place that names paths outside the lab.

lab_sources_load <- function() {
  path <- file.path(.lab$root, "config", "sources.json")
  s <- jsonlite::fromJSON(path, simplifyVector = FALSE)
  .lab$sources <- s$sources
  .lab$sources_meta <- s[c("pinned_utc", "programming_head", "programming_dirty_files")]
  invisible(length(.lab$sources))
}

# Returns the absolute path after checking size and mtime against the pin, and the
# content hash for small files. A mismatch means a generation changed under the lab.
lab_source <- function(name, verify_hash = NULL) {
  src <- .lab$sources[[name]]
  if (is.null(src)) stop("Unknown source '", name, "'; add it to config/sources.json with scripts/pin-sources.py.")
  p <- src$path
  if (!file.exists(p)) stop("Pinned source is missing: ", p)
  info <- file.info(p)
  if (info$size != src$size) stop("Size changed since pinning for ", name, ": ", p)
  if (as.integer(info$mtime) != src$mtime) stop("mtime changed since pinning for ", name, ": ", p)
  if (is.null(verify_hash)) verify_hash <- identical(src$sha256_source, "computed") && src$size <= 2e6
  if (isTRUE(verify_hash) && identical(src$sha256_source, "computed")) {
    if (!identical(lab_sha256(p), src$sha256)) stop("sha256 changed since pinning for ", name, ": ", p)
  }
  .lab$used_sources <- union(.lab$used_sources, name)
  p
}

lab_source_names <- function(pattern) grep(pattern, names(.lab$sources), value = TRUE)

lab_source_record <- function(name) {
  src <- .lab$sources[[name]]
  src[c("name", "path", "kind", "generation", "size", "mtime", "sha256", "sha256_source")]
}

lab_read_csv <- function(name, ...) {
  utils::read.csv(lab_source(name), check.names = FALSE, stringsAsFactors = FALSE, ...)
}

# SQL fragment reading one or more pinned parquet files.
lab_parquet_sql <- function(names, union_by_name = FALSE) {
  paths <- vapply(names, lab_source, character(1), verify_hash = FALSE)
  quoted <- paste0("'", gsub("'", "''", paths, fixed = TRUE), "'", collapse = ", ")
  sprintf("read_parquet([%s]%s)", quoted, if (union_by_name) ", union_by_name = true" else "")
}
