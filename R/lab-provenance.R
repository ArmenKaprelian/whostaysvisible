# Provenance for every lab aggregate and figure, and the numeric checks that gate a candidate.

lab_packages_loaded <- function() {
  ns <- sort(loadedNamespaces())
  ns <- setdiff(ns, c("base", "compiler", "datasets", "graphics", "grDevices", "grid", "methods", "parallel", "splines", "stats", "stats4", "tcltk", "tools", "utils"))
  data.frame(package = ns, version = vapply(ns, function(p) as.character(utils::packageVersion(p)), ""),
             library = vapply(ns, function(p) dirname(system.file(package = p)), ""), row.names = NULL)
}

lab_provenance <- function(id, sources, sql = NULL, rows = NULL, extra = list()) {
  script <- .lab$script
  list(
    id = id, run_id = .lab$run_id, mode = .lab$mode, time_utc = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
    script = list(path = script, sha256 = if (!is.na(script)) lab_sha256(script) else NA_character_),
    lab_commit = Sys.getenv("LAB_COMMIT", unset = "none"),
    programming = list(head = Sys.getenv("LAB_PROG_HEAD"), dirty_files = as.integer(Sys.getenv("LAB_PROG_DIRTY", "0")),
                       pinned_utc = .lab$sources_meta$pinned_utc),
    sources = lapply(sources, lab_source_record),
    sql = sql, rows = rows,
    r_version = R.version.string,
    packages = lab_packages_loaded(),
    duckdb = .lab$duckdb_settings,
    memory_max = Sys.getenv("LAB_MEMORY_MAX", unset = "none"),
    extra = extra)
}

# checks: data.frame(check, expected, observed, tolerance). Writes <id>.checks.csv and
# stops on any failure: a candidate with a wrong number does not get drawn.
lab_run_checks <- function(id, checks, dir) {
  if (is.null(checks) || !nrow(checks)) return(invisible(NULL))
  if (is.null(checks$tolerance)) checks$tolerance <- 0
  checks$pass <- abs(as.numeric(checks$observed) - as.numeric(checks$expected)) <= checks$tolerance
  utils::write.csv(checks, file.path(dir, paste0(id, ".checks.csv")), row.names = FALSE)
  bad <- checks[!checks$pass, , drop = FALSE]
  if (nrow(bad)) stop(sprintf("%d check(s) failed for %s: %s", nrow(bad), id,
                             paste(sprintf("%s expected %s observed %s", bad$check, bad$expected, bad$observed), collapse = "; ")))
  message(sprintf("  %d/%d checks passed for %s", sum(checks$pass), nrow(checks), id))
  invisible(checks)
}

# Saves a lab aggregate with its provenance sidecar. Returns the CSV path.
lab_save_aggregate <- function(df, id, stage = c("stage-a", "stage-b", "stage-c", "fig28", "fig27", "flow", "motion"), sources = .lab$used_sources,
                               sql = NULL, checks = NULL, extra = list()) {
  stage <- match.arg(stage)
  if (any(grepl("inn|ogrn", names(df), ignore.case = TRUE))) stop("Lab aggregates never carry firm identifiers.")
  dir <- lab_dir("data", stage)
  lab_run_checks(id, checks, dir)
  csv <- file.path(dir, paste0(id, ".csv"))
  utils::write.csv(df, csv, row.names = FALSE)
  if (is.null(sql) && !is.null(attr(df, "sql"))) sql <- attr(df, "sql")
  prov <- lab_provenance(id, sources, sql = sql, rows = nrow(df), extra = extra)
  prov$output <- list(path = csv, sha256 = lab_sha256(csv), columns = names(df))
  jsonlite::write_json(prov, file.path(dir, paste0(id, ".provenance.json")), auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null")
  message(sprintf("  saved %s (%d rows) with provenance", basename(csv), nrow(df)))
  csv
}

lab_read_aggregate <- function(id, stage = c("stage-a", "stage-b", "stage-c", "fig28", "fig27", "flow", "motion")) {
  stage <- match.arg(stage)
  path <- lab_path("data", stage, paste0(id, ".csv"))
  if (!file.exists(path)) stop("No lab aggregate ", id, " in ", stage)
  df <- utils::read.csv(path, check.names = FALSE, stringsAsFactors = FALSE)
  attr(df, "lab_data_file") <- path
  attr(df, "lab_data_sha256") <- lab_sha256(path)
  df
}
