# DuckDB, in memory, with the lab's limits. Reads only; the sandbox makes writes
# outside the lab impossible, and lab_query() refuses writing statements anyway.

lab_duck_connect <- function() {
  need <- c("LAB_DUCKDB_MEMORY_LIMIT", "LAB_DUCKDB_THREADS", "LAB_DUCKDB_TEMP_DIRECTORY", "LAB_DUCKDB_MAX_TEMP")
  vals <- Sys.getenv(need)
  if (any(!nzchar(vals))) stop("DuckDB limits are not set; run through the launchers: ", paste(need[!nzchar(vals)], collapse = ", "))
  home <- file.path(.lab$tmp, "duckdb-home"); dir.create(home, showWarnings = FALSE)
  dir.create(vals[["LAB_DUCKDB_TEMP_DIRECTORY"]], showWarnings = FALSE, recursive = TRUE)
  drv <- duckdb::duckdb(dbdir = ":memory:", home = home, allow_extensions = FALSE)
  con <- DBI::dbConnect(drv)
  settings <- c(
    sprintf("SET memory_limit = '%s'", vals[["LAB_DUCKDB_MEMORY_LIMIT"]]),
    sprintf("SET threads = %d", as.integer(vals[["LAB_DUCKDB_THREADS"]])),
    sprintf("SET temp_directory = '%s'", vals[["LAB_DUCKDB_TEMP_DIRECTORY"]]),
    sprintf("SET max_temp_directory_size = '%s'", vals[["LAB_DUCKDB_MAX_TEMP"]]),
    "SET preserve_insertion_order = false",
    "SET lock_configuration = true")
  for (s in settings) DBI::dbExecute(con, s)
  .lab$duckdb_settings <- stats::setNames(as.list(vals), need)
  .lab$duckdb_settings$duckdb_version <- as.character(utils::packageVersion("duckdb"))
  con
}

lab_query <- function(con, sql, name = "query") {
  if (grepl("\\b(COPY|EXPORT|ATTACH|INSTALL|LOAD|CREATE|INSERT|UPDATE|DELETE|PRAGMA)\\b", sql, ignore.case = TRUE)) {
    stop("lab_query refuses a writing or configuration statement in '", name, "'.")
  }
  t0 <- proc.time()[["elapsed"]]
  res <- DBI::dbGetQuery(con, sql)
  secs <- proc.time()[["elapsed"]] - t0
  message(sprintf("  %s: %d rows in %.1f s", name, nrow(res), secs))
  attr(res, "sql") <- sql
  attr(res, "seconds") <- secs
  res
}

lab_duck_disconnect <- function(con) DBI::dbDisconnect(con, shutdown = TRUE)

# Pinned foundation partitions as read_parquet fragments.
lab_registry_sql <- function(years = 2011:2025) lab_parquet_sql(paste0("registry.", years))
lab_payload_sql <- function(years = 2011:2025) lab_parquet_sql(paste0("payload.", years))

# Standard check: per-year eligible rows and available counts equal the foundation's annual accounting.
lab_annual_checks <- function(df, year_col = "year", rows_col = "eligible_rows", avail_col = "eligible_available", years = 2011:2025) {
  ann <- lab_read_csv("acct.annual-accounting")
  by_year <- aggregate(df[, c(rows_col, avail_col)], by = list(year = df[[year_col]]), FUN = sum)
  by_year <- by_year[by_year$year %in% years, ]
  m <- merge(by_year, ann, by = "year", suffixes = c("", "_ann"))
  data.frame(check = c("eligible rows per year equal annual accounting (max abs diff)", "eligible available per year equal annual accounting (max abs diff)"),
             expected = 0, observed = c(max(abs(m[[rows_col]] - m$eligible_rows_ann)), max(abs(m[[avail_col]] - m$eligible_available_ann))), tolerance = 0)
}
