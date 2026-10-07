# Lab environment: guards, library order, paths. lab_init() runs first in every script.

lab_init <- function(quiet = FALSE) {
  args <- commandArgs(trailingOnly = FALSE)
  if (!"--vanilla" %in% args) stop("Run lab scripts with Rscript --vanilla.")
  root <- normalizePath(Sys.getenv("LAB_ROOT"), mustWork = TRUE)
  if (!startsWith(normalizePath(getwd()), root)) stop("The working directory must be inside the lab: ", root)
  tmp <- Sys.getenv("TMPDIR")
  if (!startsWith(tmp, "/var/tmp/") || grepl(" ", tmp, fixed = TRUE)) {
    stop("TMPDIR must be a disk-backed path under /var/tmp without spaces; got '", tmp, "'.")
  }
  if (!dir.exists(tmp)) stop("TMPDIR does not exist: ", tmp)
  renv_lib <- Sys.getenv("LAB_RENV_LIB")
  if (nzchar(renv_lib) && dir.exists(renv_lib) && !renv_lib %in% .libPaths()) {
    .libPaths(c(.libPaths(), renv_lib))   # appended: read-only, lowest priority after site/system
  }
  .lab$root <- root
  .lab$tmp <- normalizePath(tmp, mustWork = TRUE)
  .lab$run_id <- Sys.getenv("LAB_RUN_ID", unset = "unlaunched")
  .lab$run_dir <- Sys.getenv("LAB_RUN_DIR", unset = tmp)
  .lab$mode <- Sys.getenv("LAB_MODE", unset = "unknown")
  .lab$used_sources <- character()
  .lab$script <- lab_script_path()
  lab_check_libs(quiet = quiet)
  lab_sources_load()
  options(stringsAsFactors = FALSE, warn = 1, scipen = 999, width = 120,
          duckdb.materialize_message = FALSE)
  if (!quiet) message(sprintf("lab %s: run %s (%s), %d pinned sources, TMPDIR %s",
                              basename(root), .lab$run_id, .lab$mode, length(.lab$sources), tmp))
  invisible(root)
}

lab_script_path <- function() {
  args <- commandArgs(trailingOnly = FALSE)
  f <- sub("^--file=", "", grep("^--file=", args, value = TRUE))
  if (length(f) == 1 && file.exists(f)) normalizePath(f) else NA_character_
}

# Every package present in more than one library must have one version; key
# packages must resolve from the expected place.
lab_check_libs <- function(quiet = FALSE) {
  libs <- .libPaths()
  seen <- list()
  for (lib in libs) {
    for (p in list.dirs(lib, recursive = FALSE, full.names = FALSE)) {
      if (!file.exists(file.path(lib, p, "DESCRIPTION"))) next
      v <- tryCatch(as.character(utils::packageVersion(p, lib.loc = lib)), error = function(e) NA_character_)
      seen[[p]] <- c(seen[[p]], stats::setNames(v, lib))
    }
  }
  multi <- Filter(function(x) length(x) > 1, seen)
  conflicts <- Filter(function(x) length(unique(stats::na.omit(x))) > 1, multi)
  key <- c("ggplot2", "dplyr", "DBI", "duckdb", "scales", "ragg", "systemfonts", "jsonlite", "patchwork", "ggrepel")
  # Only packages the lab can load matter: the key set and its recursive dependencies.
  deps <- unique(c(key, unlist(tools::package_dependencies(key, db = utils::installed.packages(), recursive = TRUE))))
  relevant <- intersect(names(conflicts), deps)
  describe <- function(ps) paste(vapply(ps, function(p) paste0(p, " (", paste(unique(conflicts[[p]]), collapse = " vs "), ")"), ""), collapse = "; ")
  if (length(relevant)) stop("Package versions differ across libraries for packages the lab loads: ", describe(relevant))
  if (length(conflicts) && !quiet) message("  note: unrelated packages differ across libraries and are ignored: ", describe(names(conflicts)))
  .lab$packages <- do.call(rbind, lapply(key, function(p) {
    ok <- requireNamespace(p, quietly = TRUE)
    data.frame(package = p, version = if (ok) as.character(utils::packageVersion(p)) else NA_character_,
               library = if (ok) dirname(system.file(package = p)) else NA_character_)
  }))
  lib <- .lab$packages$library[.lab$packages$package == "duckdb"]
  renv_root <- file.path(Sys.getenv("LAB_PROG"), "renv")
  if (is.na(lib) || !startsWith(lib, renv_root)) {   # renv symlinks the library into its cache
    stop("duckdb must resolve from the programming renv library or cache; got ", lib)
  }
  if (!quiet) {
    for (i in seq_len(nrow(.lab$packages))) {
      message(sprintf("  %-12s %-8s %s", .lab$packages$package[i], .lab$packages$version[i], .lab$packages$library[i]))
    }
  }
  invisible(.lab$packages)
}

# The only way scripts build an output path: inside the lab or the run's scratch.
# Resolution is lexical (".." collapsed) so a path that does not exist yet is judged too.
lab_lexical <- function(p) {
  parts <- strsplit(p, "/", fixed = TRUE)[[1]]
  out <- character()
  for (x in parts) {
    if (x == "" || x == ".") next
    if (x == "..") { if (length(out)) out <- out[-length(out)]; next }
    out <- c(out, x)
  }
  paste0("/", paste(out, collapse = "/"))
}

lab_path <- function(...) {
  np <- lab_lexical(file.path(.lab$root, ...))
  if (!startsWith(np, paste0(.lab$root, "/")) && !identical(np, .lab$root) &&
      !startsWith(np, paste0(.lab$tmp, "/")) && !identical(np, .lab$tmp)) {
    stop("lab_path refuses a path outside the lab: ", np)
  }
  np
}

lab_dir <- function(...) { d <- lab_path(...); dir.create(d, recursive = TRUE, showWarnings = FALSE); d }

lab_sha256 <- function(path) {
  if (exists("sha256sum", asNamespace("tools"))) return(unname(tools::sha256sum(path)))
  trimws(sub(" .*$", "", system2("sha256sum", shQuote(path), stdout = TRUE)))
}
