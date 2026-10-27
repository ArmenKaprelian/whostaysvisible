# M13: statement availability by ownership group and legal form, by region (round 16, the author's item of 27 October 2026).
# Per registry region (region_model, mapped to the basemap's names by config/regions-crosswalk.csv), in 2021 and 2024, among
# eligible firms (eligible_raw = 1, located or not, the population of series.json's groups): firms (n) and firms with a
# statement (a) in every group of the chapter's two dimensions, classified as the chapter's addendum does it
# (programming/R/chapter2-pass2-addendum-data.R): ownership_form and legal_form joined to the chapter's crosswalk
# (motion.classifier-crosswalk) on the code; '__MISSING__' kept apart, a code outside the crosswalk '__UNMAPPED__'.
# Per 100 km cell (located firms, M12's projection, M5's grid: floor(x_km / 100)), the same for unitary enterprises and
# state-related firms only, to count the cells that clear the 50-firm rule before any cell form is proposed.
# Checks: for every group and year the regions' sums (with the firms without a region) equal series.json's n and a exactly.
# Nothing firm-level leaves DuckDB.
# Run: scripts/lab-run.sh --max 8G --duck-mem 4GB --duck-threads 4 --cpu 400% Rscript --vanilla R/motion/M13-groups.R
source(file.path(Sys.getenv("LAB_ROOT"), "R", "lab.R")); lab_init()
source(lab_path("R", "motion", "motion-common.R"))
con <- lab_duck_connect(); on.exit(lab_duck_disconnect(con))
YEARS <- c(2021L, 2024L); SUPPORT <- 50L; CELL_KM <- 100L; FOCUS <- c(legal = "unitary", ownership = "state")
exec <- function(sql, label) { t0 <- proc.time()[["elapsed"]]; DBI::dbExecute(con, sql); message(sprintf("  %s: %.1f s", label, proc.time()[["elapsed"]] - t0)) }

xw <- utils::read.csv(lab_path("config", "regions-crosswalk.csv"), stringsAsFactors = FALSE, encoding = "UTF-8", colClasses = "character")
cw <- utils::read.csv(lab_source("motion.classifier-crosswalk"), stringsAsFactors = FALSE, encoding = "UTF-8", colClasses = "character")
cw <- cw[cw$dimension %in% c("ownership", "legal"), c("dimension", "source_code", "display_group", "display_label")]
if (anyDuplicated(cw[c("dimension", "source_code")])) stop("crosswalk: a code appears twice in one dimension")
sg <- as.data.frame(motion_read_json("series")$groups, stringsAsFactors = FALSE)
sg <- sg[sg$dimension %in% c("ownership", "legal") & sg$year %in% YEARS, c("dimension", "group", "label", "year", "n", "a")]
DBI::dbWriteTable(con, "xw", xw[, c("region_model", "basemap_name")], temporary = TRUE, overwrite = TRUE)
DBI::dbWriteTable(con, "cw", cw, temporary = TRUE, overwrite = TRUE)

# One row per eligible firm-year and dimension: its region, its group, its statement, and its 100 km cell where located (M12's projection).
firm_sql <- function(y) sprintf("
  WITH r AS (SELECT source_row, original_available, ownership_form, legal_form, region_model FROM %s WHERE eligible_raw = 1),
       p AS (SELECT source_row, lon, lat FROM %s),
       j AS (SELECT r.*, p.lon, p.lat FROM r LEFT JOIN p USING (source_row)),
       a AS (SELECT *, coalesce(isfinite(lon) AND isfinite(lat) AND lon BETWEEN -180 AND 180 AND lat BETWEEN -90 AND 90, false) AS bounds_valid,
                    lat * pi() / 180 AS phi, ((lon - 100 + 180) - 360 * floor((lon - 100 + 180) / 360) - 180) * pi() / 180 AS dl FROM j),
       b AS (SELECT *, 1 + sin(pi() / 3) * sin(phi) + cos(pi() / 3) * cos(phi) * cos(dl) AS den FROM a),
       c AS (SELECT *, bounds_valid AND den > 1e-12 AS located,
                    6371 * sqrt(2 / den) * cos(phi) * sin(dl) AS x_km,
                    6371 * sqrt(2 / den) * (cos(pi() / 3) * sin(phi) - sin(pi() / 3) * cos(phi) * cos(dl)) AS y_km FROM b),
       d AS (SELECT 'ownership' AS dimension, CAST(ownership_form AS VARCHAR) AS code, * FROM c UNION ALL
             SELECT 'legal' AS dimension, CAST(legal_form AS VARCHAR) AS code, * FROM c)
  SELECT d.dimension, coalesce(d.region_model, '__MISSING__') AS region_model, coalesce(d.original_available = 1, false) AS filed,
         CASE WHEN d.code IS NULL OR d.code = '__MISSING__' THEN '__MISSING__' WHEN w.source_code IS NULL THEN '__UNMAPPED__' ELSE w.display_group END AS grp,
         d.located, CASE WHEN d.located THEN CAST(floor(d.x_km / %d) AS INTEGER) END AS ix, CASE WHEN d.located THEN CAST(floor(d.y_km / %d) AS INTEGER) END AS iy
  FROM d LEFT JOIN cw w ON w.dimension = d.dimension AND w.source_code = d.code",
  lab_parquet_sql(paste0("registry.", y)), lab_parquet_sql(paste0("payload.", y)), CELL_KM, CELL_KM)
for (y in YEARS) exec(sprintf("CREATE TEMP TABLE g%d AS %s", y, firm_sql(y)), sprintf("eligible firm-years by group %d", y))

unknown <- lab_query(con, "SELECT DISTINCT region_model FROM (SELECT region_model FROM g2021 UNION ALL SELECT region_model FROM g2024) WHERE region_model <> '__MISSING__' AND region_model NOT IN (SELECT region_model FROM xw)", "region labels outside the crosswalk")
if (nrow(unknown)) stop("region labels missing from config/regions-crosswalk.csv: ", paste(unknown$region_model, collapse = ", "))

checks <- list(); regs <- list(); cells <- list(); clear <- list()
for (y in YEARS) {
  t <- sprintf("g%d", y)
  r <- lab_query(con, sprintf("SELECT coalesce(x.basemap_name, '__NO_REGION__') AS region, f.dimension, f.grp AS \"group\", count(*) AS n, count(*) FILTER (WHERE f.filed) AS a
                                FROM %s f LEFT JOIN xw x USING (region_model) GROUP BY ALL", t), sprintf("regions %d", y))
  r$n <- as.integer(r$n); r$a <- as.integer(r$a); r$year <- y
  tot <- stats::aggregate(cbind(n, a) ~ dimension + group, data = r, FUN = sum)
  m <- merge(tot, sg[sg$year == y, ], by = c("dimension", "group"), all = TRUE, suffixes = c("", "_series"))
  c100 <- lab_query(con, sprintf("SELECT ix, iy, dimension, grp AS \"group\", count(*) AS n, count(*) FILTER (WHERE filed) AS a FROM %s
                                   WHERE located AND ((dimension = 'legal' AND grp = 'unitary') OR (dimension = 'ownership' AND grp = 'state')) GROUP BY ALL", t), sprintf("100 km cells %d", y))
  c100$n <- as.integer(c100$n); c100$a <- as.integer(c100$a); c100$year <- y
  checks[[length(checks) + 1]] <- motion_checks(
    motion_check(sprintf("%d: every series.json group present here, and no other", y), 0, sum(is.na(m$n)) + sum(is.na(m$n_series))),
    motion_check(sprintf("%d: firms per group equal series.json's (max abs diff)", y), 0, max(abs(m$n - m$n_series), na.rm = TRUE)),
    motion_check(sprintf("%d: firms with a statement per group equal series.json's (max abs diff)", y), 0, max(abs(m$a - m$a_series), na.rm = TRUE)),
    motion_check(sprintf("%d: the two dimensions count the same firms", y), sum(r$n[r$dimension == "ownership"]), sum(r$n[r$dimension == "legal"])),
    motion_check(sprintf("%d: statements never exceed firms", y), 0, sum(r$a > r$n) + sum(c100$a > c100$n)),
    motion_check(sprintf("%d: located cell firms never exceed the group's total", y), 0,
                 sum(vapply(names(FOCUS), function(d) sum(c100$n[c100$dimension == d]) > sum(r$n[r$dimension == d & r$group == FOCUS[[d]]]), logical(1)))))
  regs[[length(regs) + 1]] <- r; cells[[length(cells) + 1]] <- c100
  message(sprintf("  %d: %s eligible firms, %d regions (and %s firms without a region)", y, motion_count(sum(r$n[r$dimension == "legal"])),
                  length(setdiff(unique(r$region), "__NO_REGION__")), motion_count(sum(r$n[r$dimension == "legal" & r$region == "__NO_REGION__"]))))
}
regions <- do.call(rbind, regs); cells <- do.call(rbind, cells)

# The support rule (50 firms) for the two groups the layer shows: regions and 100 km cells that clear it in both years.
for (d in names(FOCUS)) {
  g <- FOCUS[[d]]
  rr <- regions[regions$dimension == d & regions$group == g & regions$region != "__NO_REGION__", ]
  r21 <- rr[rr$year == 2021, c("region", "n")]; r24 <- rr[rr$year == 2024, c("region", "n")]; rb <- merge(r21, r24, by = "region", all = TRUE)
  cc <- cells[cells$dimension == d & cells$group == g, ]
  c21 <- cc[cc$year == 2021, c("ix", "iy", "n")]; c24 <- cc[cc$year == 2024, c("ix", "iy", "n")]; cb <- merge(c21, c24, by = c("ix", "iy"), all = TRUE)
  clear[[g]] <- list(group = g, dimension = d,
                     regions = nrow(rb), regions_clear_both = sum(rb$n.x >= SUPPORT & rb$n.y >= SUPPORT, na.rm = TRUE),
                     cells_with_firms = nrow(cb), cells_clear_both = sum(cb$n.x >= SUPPORT & cb$n.y >= SUPPORT, na.rm = TRUE),
                     firms_2024_in_clear_cells = sum(cb$n.y[cb$n.x >= SUPPORT & cb$n.y >= SUPPORT], na.rm = TRUE), firms_2024 = sum(r24$n))
  message(sprintf("  %s: %d of %d regions and %d of %d 100 km cells have %d or more firms in both years (the cells holding %s of the %s located-or-not firms of 2024)",
                  g, clear[[g]]$regions_clear_both, clear[[g]]$regions, clear[[g]]$cells_clear_both, clear[[g]]$cells_with_firms, SUPPORT,
                  motion_count(clear[[g]]$firms_2024_in_clear_cells), motion_count(clear[[g]]$firms_2024)))
}
checks_df <- do.call(rbind, checks)

regions <- regions[order(regions$region == "__NO_REGION__", regions$region, regions$dimension, regions$group, regions$year), c("region", "year", "dimension", "group", "n", "a")]
cells <- cells[order(cells$dimension, cells$year, cells$iy, cells$ix), c("ix", "iy", "year", "dimension", "group", "n", "a")]
labels <- unique(cw[, c("dimension", "display_group", "display_label")]); names(labels) <- c("dimension", "group", "label")
out <- list(years = YEARS, support = SUPPORT, cell_km = CELL_KM, focus = as.list(FOCUS), labels = labels,
            regions = regions, cells100 = cells, support_counts = unname(clear),
            basis = "regions: eligible firms registered in the region (region_model through config/regions-crosswalk.csv), located or not, the population of series.json's groups; '__NO_REGION__' holds the firms without a region; cells100: located eligible firms of the two groups the layer shows, in M5's 100 km grid",
            notes = c("Groups as the chapter's addendum classifies them: the registry's ownership_form and legal_form codes through the chapter's classifier crosswalk; missing codes and codes outside the crosswalk kept apart.",
                      "Shares within a group only where 50 or more firms of the group in the year (the project's support rule).",
                      "Registered addresses and registry regions, not operating sites; descriptive figures, not effects."))
motion_save_json(out, "groups", checks = checks_df, rows = nrow(regions) + nrow(cells))
message(sprintf("  groups: %d region rows, %d cell rows", nrow(regions), nrow(cells)))
