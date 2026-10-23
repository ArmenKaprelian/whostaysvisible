# M2: the 100 km cell layers for the pages (read-only job).
# Run: scripts/lab-ro.sh Rscript --vanilla R/motion/M2-cells.R
# Layers: statement availability by cell and year 2019-2024 (located eligible firms), the
# 2024-against-2021 change map, cohort inclusion for the four fixed 2021 cohorts with the
# pooled quintile cutpoints of Figure 2.8, supplied-list members per cell in 2021 (cells with
# fewer than 5 members suppressed), and the descriptive median real revenue and margin change
# from 2021 by cell for the cohort firms observed each year (medians from under 50 firms suppressed).
source(file.path(Sys.getenv("LAB_ROOT"), "R", "lab.R")); lab_init()
source(lab_path("R", "fig28", "fig28-common.R"))
source(lab_path("R", "fig27", "fig27-common.R"))
source(lab_path("R", "motion", "motion-common.R"))

# 1. Availability by cell and year.
cy <- lab_read_csv("fig27.cells-years")
cy <- cy[cy$grid_km == 100 & cy$quality_scope == "all", ]
cy <- cy[order(cy$year, cy$iy, cy$ix), ]
cov <- lab_read_csv("fig27.coverage-years")
avail <- data.frame(year = as.integer(cy$year), ix = as.integer(cy$ix), iy = as.integer(cy$iy), n = as.integer(cy$n_eligible), a = as.integer(cy$n_available))
per_year <- aggregate(cbind(n, a, cells = 1L) ~ year, avail, sum)
per_year$supported <- as.integer(table(factor(avail$year[avail$n >= 50], levels = per_year$year)))
located <- data.frame(year = cov$year, eligible = cov$n, located = cov$n_located, available = cov$n_available,
                      located_share = cov$located_share, located_available_share = cov$n_available / cov$n_located)

# 2. Change map 2024 against 2021 (the finalized data of Figure 2.7's lower panel).
chg <- lab_read_csv("motion.change-cells")
chg_counts <- lab_read_csv("motion.change-class-counts")
totals <- lab_read_csv("motion.annual-cell-totals")
lab_change <- fig27_change_cells()   # the lab's own derivation from the annual cells, for agreement
m <- merge(chg, lab_change, by = c("ix", "iy"), suffixes = c("", "_lab"))
change <- data.frame(ix = as.integer(chg$ix), iy = as.integer(chg$iy), n21 = as.integer(chg$n_eligible_2021), a21 = as.integer(chg$n_available_2021),
                     n24 = as.integer(chg$n_eligible_2024), a24 = as.integer(chg$n_available_2024),
                     supported = as.integer(chg$supported), change_pp = ifelse(chg$supported, round(chg$change_pp, 3), NA), class = ifelse(chg$supported, as.integer(chg$class), NA))

# 3. Cohort inclusion: Figure 2.8's two revenue cohorts with the pooled cutpoints, plus all four cohorts.
f28 <- lab_read_csv("fig28.cells")
cuts <- fig28_cutpoints(f28, pooled = TRUE)$cash
sel <- lab_read_csv("motion.selection-cells")
sel$class <- ifelse(sel$display_supported, fig28_class(sel$inclusion_percent, cuts), NA)
cohort <- data.frame(outcome = ifelse(sel$outcome == "log_real_revenue", "revenue", "margin"), moderator = sel$moderator,
                     ix = as.integer(sel$ix), iy = as.integer(sel$iy), n = as.integer(sel$n_eligible), c = as.integer(sel$n_cohort),
                     pct = round(sel$inclusion_percent, 3), supported = as.integer(sel$display_supported), class = sel$class)
f28_rev_cash <- f28[f28$moderator == "cash", ]; sel_rev_cash <- sel[sel$outcome == "log_real_revenue" & sel$moderator == "cash", ]
mm <- merge(f28_rev_cash, sel_rev_cash, by = c("ix", "iy"), suffixes = c("_f", "_s"))

# 4. Supplied-list members per 100 km cell, 2021 (suppressed under 5).
lists100 <- fig27_list_cells(grid_km = 100)
sup <- function(v) { v <- as.integer(v); s <- v > 0 & v < 5; v[s] <- NA; list(v = v, suppressed = sum(s)) }
ls <- sup(lists100$n_sanctioned); lg <- sup(lists100$n_govstrategic); la <- sup(lists100$n_admin)
lists <- data.frame(ix = as.integer(lists100$ix), iy = as.integer(lists100$iy), n = as.integer(lists100$n_eligible),
                    sanctioned = ls$v, govstrategic = lg$v, admin = la$v)
lists <- lists[!is.na(lists$sanctioned) | !is.na(lists$govstrategic) | !is.na(lists$admin), ]
lists <- lists[rowSums(cbind(lists$sanctioned, lists$govstrategic, lists$admin), na.rm = TRUE) > 0, ]

# 5. Descriptive cohort medians by cell: percent change of the cell's median from 2021 (observed cohort firms).
fin_layer <- function(name, label) {
  d <- lab_read_csv(name)
  d <- d[d$grid_km == 100 & d$display_supported & d$n_observed >= 50 & d$baseline_observed >= 50, ]
  data.frame(outcome = label, moderator = d$moderator, year = as.integer(d$year), ix = as.integer(d$ix), iy = as.integer(d$iy),
             n_base = as.integer(d$n_baseline), n_obs = as.integer(d$n_observed), change_pct = round(d$change, 2))
}
fin <- rbind(fin_layer("motion.revenue-change-cells", "revenue"), fin_layer("motion.margin-change-cells", "margin"))

checks <- motion_checks(
  motion_check("availability cells 2019", 1160, sum(avail$year == 2019)), motion_check("availability cells 2020", 1157, sum(avail$year == 2020)),
  motion_check("availability cells 2021", 1154, sum(avail$year == 2021)), motion_check("availability cells 2022", 1180, sum(avail$year == 2022)),
  motion_check("availability cells 2023", 1180, sum(avail$year == 2023)), motion_check("availability cells 2024", 1182, sum(avail$year == 2024)),
  motion_check("located eligible per year equal coverage (max abs diff)", 0, max(abs(per_year$n - cov$n_located[match(per_year$year, cov$year)]))),
  motion_check("located available 2021", 2097055, per_year$a[per_year$year == 2021]), motion_check("located available 2024", 2051002, per_year$a[per_year$year == 2024]),
  motion_check("supported cells 2021", 667, per_year$supported[per_year$year == 2021]), motion_check("supported cells 2024", 670, per_year$supported[per_year$year == 2024]),
  motion_check("change rows", 1193, nrow(change)), motion_check("change supported", 658, sum(change$supported)),
  motion_check("change class counts 1..6 agree (sum abs diff)", 0, sum(abs(as.integer(table(factor(change$class, levels = 1:6))) - chg_counts$cells[order(chg_counts$class)]))),
  motion_check("change class counts are 73/82/109/125/145/124", 0, sum(abs(chg_counts$cells[order(chg_counts$class)] - c(73, 82, 109, 125, 145, 124)))),
  motion_check("change agrees with the lab derivation (rows matched)", 1193, nrow(m)),
  motion_check("change agrees with the lab derivation (max abs diff in change_pp over supported)", 0, max(abs(m$change_pp[m$supported] - m$change_pp_lab[m$supported])), 1e-9),
  motion_check("annual totals: located share 2021 (percent)", 63.98067754889344, totals$availability_share_percent[totals$year == 2021], 1e-9),
  motion_check("annual totals: located share 2024 (percent)", 66.50842152743526, totals$availability_share_percent[totals$year == 2024], 1e-9),
  motion_check("cohort layers", 4, length(unique(paste(cohort$outcome, cohort$moderator)))), motion_check("cohort rows per layer", 1154, nrow(cohort) / 4),
  motion_check("cohort firms revenue by cash", 1485616, sum(cohort$c[cohort$outcome == "revenue" & cohort$moderator == "cash"])),
  motion_check("cohort firms revenue by inventory", 1164866, sum(cohort$c[cohort$outcome == "revenue" & cohort$moderator == "inventory"])),
  motion_check("supported cohort cells per layer", 667, sum(cohort$supported) / 4),
  motion_check("cutpoint 1", 33.3085, cuts[1], 5e-4), motion_check("cutpoint 2", 38.3333, cuts[2], 5e-4), motion_check("cutpoint 3", 42.9697, cuts[3], 5e-4), motion_check("cutpoint 4", 47.6248, cuts[4], 5e-4),
  motion_check("fig28 cells equal selection cells (revenue by cash, max abs diff in n_cohort)", 0, max(abs(mm$n_cohort_f - mm$n_cohort_s))),
  motion_check("list cells 100 km (all)", 1157, nrow(lists100)),
  motion_check("located sanctions-list firms (100 km, before suppression)", 3466, sum(lists100$n_sanctioned)),
  motion_check("located government-strategic firms (100 km, before suppression)", 953, sum(lists100$n_govstrategic)),
  motion_check("financial change rows have supported cells only", 1, as.integer(all(fin$n_obs >= 50 & fin$n_base >= 50))),
  motion_check("financial change years are 2019-2024 minus 2021", 1, as.integer(all(fin$year %in% c(2019, 2020, 2022, 2023, 2024)))))

out <- list(
  grid_km = 100,
  avail = avail, avail_years = per_year, located = located,
  change = change, change_classes = data.frame(class = chg_counts$class, cells = chg_counts$cells, label = chg_counts$label, color = chg_counts$color, interval = chg_counts$interval_pp),
  change_totals = totals,
  cohort = cohort, cohort_cutpoints = round(cuts, 4), cohort_class_labels = c("5-33%", ">33-38%", ">38-43%", ">43-48%", ">48-68%"),
  lists = lists, lists_suppressed = list(sanctioned = ls$suppressed, govstrategic = lg$suppressed, admin = la$suppressed, rule = "cells with 1-4 members of a list show no count"),
  fin = fin,
  notes = c("Cells: 100 km squares of the production grid, ix = floor(x_km/100), centre (ix+0.5)*100.",
            "Availability: located eligible firms with an original statement for the year, by registered address; shares shown only for cells with 50 or more located firms.",
            "Change: 2024 against 2021 annual populations at registered addresses, not the same firms; six symmetric classes at -5, -2, 0, +2, +5 points.",
            "Cohort inclusion: share of a cell's located eligible firms (2021) in each fixed 2021 cohort; five pooled quintile classes of supported cells (Figure 2.8).",
            "Lists: supplied memberships are fixed lists, not dated designations; counts under 5 per cell are suppressed.",
            "Financial change: percent change of the cell's median real revenue (or operating margin) among the cohort firms observed in the year, against the cell's 2021 median; descriptive, composition changes with observation."))
motion_save_json(out, "cells100", checks = checks, rows = nrow(avail))
