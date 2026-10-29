# M14: the state-related firms split by legal form (round 24, the author's question of 29 October 2026, after the Groups card's bug).
# Eligible firms by ownership group and legal form together, in 2021 and 2024, and the state-related unitary enterprises by founder level.
# The population, the crosswalk and the statement flag are M13's: eligible_raw = 1, ownership_form and legal_form through the chapter's
# classifier crosswalk (motion.classifier-crosswalk), '__MISSING__' and '__UNMAPPED__' kept apart, original_available = 1 for a statement.
# Founder level by legal_form code as the crosswalk labels them (OK 028-2012): 65141 and 65241 federal, 65142 and 65242 regional, 65143 and
# 65243 municipal; 65000, 65100, 65200 and the legacy 41 and 42 carry no level.
# Checks: each dimension's margins equal series.json's n and a for every group and year; the levels sum to the state-related unitary firms;
# the state-related split sums to series.json's state-related group. Counts only; nothing firm-level leaves DuckDB.
# Writes data/statesplit.json (the Groups card's state-run row and its i text).
# Run: scripts/lab-run.sh --max 8G --duck-mem 4GB --duck-threads 4 --cpu 400% Rscript --vanilla R/motion/M14-statesplit.R
source(file.path(Sys.getenv("LAB_ROOT"), "R", "lab.R")); lab_init()
source(lab_path("R", "motion", "motion-common.R"))
con <- lab_duck_connect(); on.exit(lab_duck_disconnect(con))
YEARS <- c(2021L, 2024L)
LEVEL <- c("65141" = "federal", "65241" = "federal", "65142" = "regional", "65242" = "regional", "65143" = "municipal", "65243" = "municipal")

cw <- utils::read.csv(lab_source("motion.classifier-crosswalk"), stringsAsFactors = FALSE, encoding = "UTF-8", colClasses = "character")
cw <- cw[cw$dimension %in% c("ownership", "legal"), c("dimension", "source_code", "display_group")]
if (anyDuplicated(cw[c("dimension", "source_code")])) stop("crosswalk: a code appears twice in one dimension")
DBI::dbWriteTable(con, "cw", cw, temporary = TRUE, overwrite = TRUE)
sg <- as.data.frame(motion_read_json("series")$groups, stringsAsFactors = FALSE)
sg <- sg[sg$dimension %in% c("ownership", "legal") & sg$year %in% YEARS, c("dimension", "group", "year", "n", "a")]

# One row per eligible firm-year: its two groups (M13's rule for missing and unmapped codes), its legal_form code and its statement.
grp_sql <- function(col, dim) sprintf("CASE WHEN %1$s IS NULL OR %1$s = '__MISSING__' THEN '__MISSING__' WHEN w%2$s.source_code IS NULL THEN '__UNMAPPED__' ELSE w%2$s.display_group END", col, dim)
xt <- list(); lv <- list(); checks <- list()
for (y in YEARS) {
  exec_sql <- sprintf("CREATE OR REPLACE TEMP TABLE f AS
    WITH r AS (SELECT CAST(ownership_form AS VARCHAR) AS oc, CAST(legal_form AS VARCHAR) AS lc, coalesce(original_available = 1, false) AS filed
               FROM %s WHERE eligible_raw = 1)
    SELECT %s AS ownership, %s AS legal, r.lc AS code, r.filed
    FROM r LEFT JOIN cw wo ON wo.dimension = 'ownership' AND wo.source_code = r.oc LEFT JOIN cw wl ON wl.dimension = 'legal' AND wl.source_code = r.lc",
    lab_parquet_sql(paste0("registry.", y)), grp_sql("r.oc", "o"), grp_sql("r.lc", "l"))
  DBI::dbExecute(con, exec_sql)
  x <- lab_query(con, "SELECT ownership, legal, count(*) AS n, count(*) FILTER (WHERE filed) AS a FROM f GROUP BY ALL ORDER BY 1, 2", sprintf("cross-tab %d", y))
  l <- lab_query(con, "SELECT code, count(*) AS n, count(*) FILTER (WHERE filed) AS a FROM f WHERE ownership = 'state' AND legal = 'unitary' GROUP BY ALL ORDER BY 1", sprintf("levels %d", y))
  x$n <- as.numeric(x$n); x$a <- as.numeric(x$a); x$year <- y; l$n <- as.numeric(l$n); l$a <- as.numeric(l$a); l$year <- y
  l$level <- ifelse(l$code %in% names(LEVEL), LEVEL[l$code], "no level")
  mo <- stats::aggregate(cbind(n, a) ~ ownership, data = x, FUN = sum); names(mo)[1] <- "group"; mo$dimension <- "ownership"
  ml <- stats::aggregate(cbind(n, a) ~ legal, data = x, FUN = sum); names(ml)[1] <- "group"; ml$dimension <- "legal"
  m <- merge(rbind(mo, ml), sg[sg$year == y, ], by = c("dimension", "group"), all = TRUE, suffixes = c("", "_series"))
  su <- x[x$ownership == "state" & x$legal == "unitary", ]
  checks[[length(checks) + 1]] <- motion_checks(
    motion_check(sprintf("%d: every series.json group present in the margins, and no other", y), 0, sum(is.na(m$n)) + sum(is.na(m$n_series))),
    motion_check(sprintf("%d: margins' firms equal series.json's (max abs diff)", y), 0, max(abs(m$n - m$n_series), na.rm = TRUE)),
    motion_check(sprintf("%d: margins' statements equal series.json's (max abs diff)", y), 0, max(abs(m$a - m$a_series), na.rm = TRUE)),
    motion_check(sprintf("%d: the levels sum to the state-related unitary firms", y), su$n, sum(l$n)),
    motion_check(sprintf("%d: the levels' statements sum to theirs", y), su$a, sum(l$a)))
  xt[[length(xt) + 1]] <- x; lv[[length(lv) + 1]] <- l
}
x <- do.call(rbind, xt); l <- do.call(rbind, lv)

# The state-related group split in two: its unitary enterprises (the card's state-run row) and the rest.
part <- function(y, unitary) { z <- x[x$year == y & x$ownership == "state" & (x$legal == "unitary") == unitary, ]; c(n = sum(z$n), a = sum(z$a)) }
split <- lapply(c(unitary = TRUE, other = FALSE), function(u) { p <- sapply(YEARS, part, unitary = u); list(n = unname(p["n", ]), a = unname(p["a", ]), share = unname(100 * p["a", ] / p["n", ])) })
st <- sg[sg$dimension == "ownership" & sg$group == "state", ]; st <- st[order(st$year), ]
checks[[length(checks) + 1]] <- motion_checks(
  motion_check("the split's firms sum to series.json's state-related group (max abs diff)", 0, max(abs(split$unitary$n + split$other$n - st$n))),
  motion_check("the split's statements sum to series.json's (max abs diff)", 0, max(abs(split$unitary$a + split$other$a - st$a))))
levels <- stats::aggregate(cbind(n, a) ~ year + level, data = l, FUN = sum); levels <- levels[order(levels$year, levels$level), ]
mun <- sapply(YEARS, function(y) 100 * sum(levels$n[levels$year == y & levels$level == "municipal"]) / sum(levels$n[levels$year == y]))
checks_df <- do.call(rbind, checks)

out <- list(years = YEARS, state_unitary = split$unitary, state_other = split$other, municipal_share = unname(mun),
            levels = levels[, c("year", "level", "n", "a")], crosstab = x[order(x$year, x$ownership, x$legal), c("year", "ownership", "legal", "n", "a")],
            basis = "eligible firms (eligible_raw = 1) by ownership group and legal form, classified with the chapter's crosswalk as M13 does; state_unitary: state-related ownership and the unitary-enterprise legal form; state_other: the other state-related firms; municipal_share: the municipal share of state_unitary by legal_form code",
            notes = c("Unitary enterprises lie almost wholly inside the state-related group; the rest have no ownership code or another one (crosstab).",
                      "Founder level from the legal_form code; codes without a level are counted in the denominator of municipal_share."))
motion_save_json(out, "statesplit", checks = checks_df, rows = nrow(x) + nrow(levels))
message(sprintf("  state-related unitary %s to %s; other state-related %s to %s; municipal share %s (2024)",
                motion_pct(split$unitary$share[1]), motion_pct(split$unitary$share[2]), motion_pct(split$other$share[1]), motion_pct(split$other$share[2]), motion_pct(mun[2])))
