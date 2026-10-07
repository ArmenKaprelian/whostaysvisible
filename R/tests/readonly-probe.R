# Probe: scratch on disk, DuckDB temp directory, writes outside the lab refused.
source(file.path(Sys.getenv("LAB_ROOT"), "R", "lab.R")); lab_init(quiet = TRUE)
cat("tempdir:", tempdir(), "\n")
cat("tempdir filesystem:", system2("findmnt", c("-n", "-o", "FSTYPE", "-T", tempdir()), stdout = TRUE), "\n")
con <- lab_duck_connect()
cat("duckdb temp_directory:", DBI::dbGetQuery(con, "SELECT current_setting('temp_directory') AS d")$d, "\n")
cat("duckdb memory_limit:", DBI::dbGetQuery(con, "SELECT current_setting('memory_limit') AS d")$d, "\n")
cat("duckdb threads:", DBI::dbGetQuery(con, "SELECT current_setting('threads') AS d")$d, "\n")
lab_duck_disconnect(con)
for (target in c(file.path(Sys.getenv("LAB_PROG"), ".lab-probe"), file.path(Sys.getenv("LAB_LATEX"), ".lab-probe"))) {
  ok <- suppressWarnings(file.create(target))
  if (ok) { unlink(target); stop("WRITE SUCCEEDED outside the lab: ", target) }
  cat("write refused (good):", target, "\n")
}
res <- tryCatch(lab_path("..", "..", "programming", "x"), error = function(e) conditionMessage(e))
cat("lab_path outside the lab:", if (grepl("refuses", res)) "refused (good)" else paste("ALLOWED (bad):", res), "\n")
p <- lab_path("data", "stage-a", "probe.tmp"); writeLines("ok", p); unlink(p)
cat("write inside the lab: ok\n")
