# M4: the chart series and the facts the captions quote (read-only job).
# Run: scripts/lab-ro.sh Rscript --vanilla R/motion/M4-series.R
# Every number a caption repeats is checked here against the manuscript value (Chapter 2 and
# Appendix B of the 22 October 2026 edition) and written once into series.json$facts, so the
# pages never carry a typed count.
source(file.path(Sys.getenv("LAB_ROOT"), "R", "lab.R")); lab_init()
source(lab_path("R", "motion", "motion-common.R"))

pct1 <- function(x) round(100 * x, 1)

# 1. Statement availability by year, both denominators (Table B.1; Figure 2.1).
av <- lab_read_csv("t5.ch2-p1-availability-source")
avail <- data.frame(year = as.integer(av$year), eligible = as.integer(av$eligible_rows), eligible_available = as.integer(av$eligible_available),
                    registered = as.integer(av$eligible_registered), registered_available = as.integer(av$registered_available),
                    eligible_share = ifelse(av$year == 2011, NA, round(100 * av$eligible_availability_share, 3)),
                    registered_share = ifelse(av$year == 2011, NA, round(100 * av$registered_availability_share, 3)),
                    provider = av$provider, flagged = av$year == 2025)
g <- function(y, col) avail[[col]][avail$year == y]

# 2. Groups by year: ownership, legal form, industry (Figures 2.2-2.4 sources).
grp <- do.call(rbind, lapply(c("ownership", "legal", "industry"), function(d) {
  x <- lab_read_csv(paste0("motion.", d, "-year"))
  data.frame(dimension = x$dimension, group = x$display_group, label = x$display_label, order = as.integer(x$display_order),
             year = as.integer(x$year), n = as.integer(x$denominator), a = as.integer(x$numerator), share = round(100 * x$rate, 3), flagged = x$flagged_2025)
}))
message("  group labels: ", paste(unique(grp$label[grp$dimension != "industry"]), collapse = " | "))
gl <- function(label, y) { r <- grp[grp$label == label & grp$dimension != "industry" & grp$year == y, ]; if (nrow(r) != 1) stop("label match failed: ", label, " ", y); r$share }

# 3. Size: adjusted odds ratios Q2-Q5 vs Q1 by year, two eras (Figure 2.5 and Table B.4/B.5 sources).
or <- lab_read_csv("motion.size-odds-ratios")
size <- data.frame(era = or$era, year = as.integer(or$year), quintile = toupper(sub("-vs-q1", "", or$contrast_id)),
                   or = round(or$odds_ratio, 4), low = round(or$two_way_or_low, 4), high = round(or$two_way_or_high, 4),
                   firm_low = round(or$firm_or_low, 4), firm_high = round(or$firm_or_high, 4), status = or$inference_status)
so <- function(y, q, col = "or") size[[col]][size$year == y & size$quintile == q]
sc <- lab_read_csv("motion.size-changes")
# Rows alternate two-way then firm covariance; the "later" rows' label carries a comma that shifts the
# covariance column, so the two-way rows are taken by position and the intact ones are verified.
two_way <- sc[seq(1, nrow(sc), by = 2), ]
intact <- two_way$covariance %in% c("industry_region_two_way", "firm_secondary")
if (!all(two_way$covariance[intact] == "industry_region_two_way")) stop("size-changes rows are not in two-way/firm order")
window_of <- function(id) ifelse(grepl("earlier_2020", id), "2020 vs 2021", ifelse(grepl("immediate_2022", id), "2022 vs 2021", "2023-2024 vs 2021"))
size_changes <- data.frame(id = two_way$contrast_id, quintile = paste0("Q", two_way$quintile), window = window_of(two_way$contrast_id),
                           ratio = round(two_way$ratio_of_odds_ratios, 4), low = round(two_way$ratio_low, 4), high = round(two_way$ratio_high, 4))
raw <- lab_read_csv("motion.size-raw-changes")
q5_2022 <- size_changes[size_changes$quintile == "Q5" & size_changes$window == "2022 vs 2021", ]
if (nrow(q5_2022) != 1) stop("Q5 2022 vs 2021 row not found")

# 4. List contrasts against no-list firms, 2019-2024 (Table B.7 source).
ct <- lab_read_csv("t6.ch2-p1-contrasts-source", colClasses = c(pattern_a = "character", pattern_b = "character"))
message("  list models: ", paste(unique(ct$model_id), collapse = " | "), "; contrasts: ", paste(unique(ct$contrast_id), collapse = " | "))
lists <- data.frame(model = sub("^c2-p1-recent-", "", ct$model_id), contrast = ct$contrast_id, pattern_a = ct$pattern_a, pattern_b = ct$pattern_b,
                    year = as.integer(ct$year), prior_absent = ct$prior_absent, comparison = ct$comparison,
                    or = round(ct$odds_ratio, 4), low = round(ct$two_way_or_low, 4), high = round(ct$two_way_or_high, 4), status = ct$inference_status)
lo <- function(model, contrast, y, comparison = "level", col = "or") {
  r <- lists[lists$model == model & lists$contrast == contrast & lists$year == y & lists$comparison == comparison, ]
  if (nrow(r) != 1) stop("contrast lookup failed: ", model, " ", contrast, " ", y, " ", comparison); r[[col]]
}

# 5. Transitions ending 2020-2024 by prior state (Figure 2.6; Table B.2).
td <- lab_read_csv("acct.transition-denominators")
tr <- td[td$destination_year >= 2020 & td$destination_year <= 2024, ]
trans <- data.frame(prior = ifelse(tr$prior_absent == 1, "absent", "available"), year = as.integer(tr$destination_year),
                    origin = as.integer(tr$origin_rows), A = as.integer(tr$A), N = as.integer(tr$N), X = as.integer(tr$X), S = as.integer(tr$scope_change), U = as.integer(tr$unresolved))
pooled <- aggregate(cbind(origin, A, N, X, S, U) ~ prior, trans, sum)
pv <- function(p, col) pooled[[col]][pooled$prior == p]

# 6. Six-year histories of the fixed 2019 cohort (Table B.13 source) and the bins by list group.
hist <- lab_read_csv("motion.histories", colClasses = c(pattern = "character", history = "character"))   # five-bit patterns stay text
by_hist <- aggregate(firms ~ history, hist, sum); by_hist <- by_hist[order(-by_hist$firms), ]
denom <- sum(hist$firms)
top <- head(by_hist, 24); top$share <- round(100 * top$firms / denom, 3)
pat_denom <- aggregate(firms ~ pattern, hist, sum)
hp <- function(pattern, history) { f <- hist$firms[hist$pattern == pattern & hist$history == history]; if (!length(f)) 0L else sum(f) }
bins <- lab_read_csv("motion.history-bins", colClasses = c(group = "character"))
history_bins <- data.frame(group = bins$group, denominator = as.integer(bins$denominator), bin = bins$bin, firms = as.integer(bins$firms), share = round(100 * bins$share, 3))

# 7. Sample flow, dot accounting, coordinate piles.
flow <- lab_read_csv("motion.flow-counts")
dots <- lab_read_csv("motion.dot-accounting")
piles <- lab_read_csv("motion.coordinate-piles")

# 8. Timeline events (manuscript anchors in the explainer README).
events <- data.frame(
  year = c(2014, 2016, 2019, 2020.05, 2022.1, 2022.3, 2024.45, 2026.67),
  label = c("Crimea sanctions; reporting thresholds tightened", "FNS removal campaign begins", "Provider changes: Rosstat to FNS",
            "Decree No. 35 (22 Jan 2020): listed residents exempt from the mandatory copy", "Invasion (Feb 2022); reserves frozen",
            "FNS notice (18 Apr 2022): firms may restrict public access to accounts from 2019", "US designates MOEX, NCC, NSD (12 Jun 2024)", "RFSD v3.1.0 released (2 Sep 2026)"),
  kind = c("context", "context", "provider", "legal", "context", "legal", "context", "data"))

facts <- list(
  records_total = 63308662L, years = "2011-2025", release = "RFSD v3.1.0", release_date = "2 September 2026",
  eligible_2021 = g(2021, "eligible"), registered_2021 = g(2021, "registered"), statements_2021 = g(2021, "eligible_available"), statements_2024 = g(2024, "eligible_available"),
  eligible_share_2021 = g(2021, "eligible_share"), eligible_share_2024 = g(2024, "eligible_share"), eligible_share_2025 = g(2025, "eligible_share"),
  registered_share_2021 = g(2021, "registered_share"), registered_share_2024 = g(2024, "registered_share"),
  eligible_share_2012 = g(2012, "eligible_share"), eligible_share_2018 = g(2018, "eligible_share"), eligible_share_2019 = g(2019, "eligible_share"),
  located_2021 = dots$plotted_firms, eligible_firms_2021 = dots$eligible_firms, unlocated_2021 = dots$unlocated_firms,
  located_available_2021 = dots$located_available_firms, located_absent_2021 = dots$located_absent_firms,
  distinct_locations = piles$distinct_locations, largest_location_firms = piles$largest_location_firms, firms_at_100plus_locations = piles$firms_at_100plus_locations,
  own = list(private = c(gl("Private", 2021), gl("Private", 2024)), foreign = c(gl("Foreign / joint", 2021), gl("Foreign / joint", 2024)), state = c(gl("State-related ownership", 2021), gl("State-related ownership", 2024))),
  legal = list(unitary = c(gl("Unitary enterprise", 2021), gl("Unitary enterprise", 2024)), joint_stock = c(gl("Joint-stock", 2021), gl("Joint-stock", 2024)), llc = c(gl("Limited liability", 2021), gl("Limited liability", 2024))),
  size_q5_2022_ratio = q5_2022$ratio, size_q5_2022_low = q5_2022$low, size_q5_2022_high = q5_2022$high,
  size_raw_q1_2022 = raw$share_2022[raw$asset_quintile == 1], size_raw_q5_2022 = raw$share_2022[raw$asset_quintile == 5],
  sanctioned_only_or_2019 = lo("annual-eligible-membership", "sanctioned_only", 2019), sanctioned_only_or_2024 = lo("annual-eligible-membership", "sanctioned_only", 2024),
  sanctioned_only_or_2024_low = lo("annual-eligible-membership", "sanctioned_only", 2024, col = "low"), sanctioned_only_or_2024_high = lo("annual-eligible-membership", "sanctioned_only", 2024, col = "high"),
  prior_available = pv("available", "origin"), prior_available_A = pv("available", "A"), prior_available_X = pv("available", "X"),
  prior_absent = pv("absent", "origin"), prior_absent_A = pv("absent", "A"), prior_absent_X = pv("absent", "X"),
  fixed_2019_cohort = denom, hist_all_available = by_hist$firms[by_hist$history == "AAAAAA"],
  aaannn_sanctioned_only = hp("10000", "AAANNN"), aaannn_sanctioned_only_denom = pat_denom$firms[pat_denom$pattern == "10000"],
  aaannn_no_list = hp("00000", "AAANNN"), aaannn_no_list_denom = pat_denom$firms[pat_denom$pattern == "00000"],
  cohorts = stats::setNames(as.list(as.integer(flow$value)), flow$id))

checks <- motion_checks(
  motion_check("Table B.1 eligible share 2012", 14.9, round(facts$eligible_share_2012, 1), 1e-9), motion_check("Table B.1 eligible share 2018", 47.4, round(facts$eligible_share_2018, 1), 1e-9),
  motion_check("Table B.1 eligible share 2019", 50.0, round(facts$eligible_share_2019, 1), 1e-9), motion_check("Table B.1 eligible share 2021", 63.4, round(facts$eligible_share_2021, 1), 1e-9),
  motion_check("Table B.1 eligible share 2024", 66.3, round(facts$eligible_share_2024, 1), 1e-9), motion_check("Table B.1 eligible share 2025", 64.3, round(facts$eligible_share_2025, 1), 1e-9),
  motion_check("Table B.1 registered share 2021", 71.7, round(facts$registered_share_2021, 1), 1e-9), motion_check("Table B.1 registered share 2024", 71.2, round(facts$registered_share_2024, 1), 1e-9),
  motion_check("statements 2021", 2129509, facts$statements_2021), motion_check("statements 2024", 2086055, facts$statements_2024),
  motion_check("eligible 2021", 3357109, facts$eligible_2021), motion_check("registered 2021", 2959193, facts$registered_2021),
  motion_check("located 2021", 3277638, facts$located_2021), motion_check("located with statement 2021", 2097055, facts$located_available_2021),
  motion_check("distinct locations", 727190, facts$distinct_locations), motion_check("largest location", 7928, facts$largest_location_firms),
  motion_check("private 2021", 64.2, round(facts$own$private[1], 1), 1e-9), motion_check("private 2024", 67.2, round(facts$own$private[2], 1), 1e-9),
  motion_check("foreign or joint 2021", 56.5, round(facts$own$foreign[1], 1), 1e-9), motion_check("foreign or joint 2024", 58.1, round(facts$own$foreign[2], 1), 1e-9),
  motion_check("state-related 2021", 69.8, round(facts$own$state[1], 1), 1e-9), motion_check("state-related 2024", 61.3, round(facts$own$state[2], 1), 1e-9),
  motion_check("unitary 2021", 69.2, round(facts$legal$unitary[1], 1), 1e-9), motion_check("unitary 2024", 48.2, round(facts$legal$unitary[2], 1), 1e-9),
  motion_check("joint-stock 2021", 73.0, round(facts$legal$joint_stock[1], 1), 1e-9), motion_check("joint-stock 2024", 78.2, round(facts$legal$joint_stock[2], 1), 1e-9),
  motion_check("LLC 2021", 65.2, round(facts$legal$llc[1], 1), 1e-9), motion_check("LLC 2024", 68.3, round(facts$legal$llc[2], 1), 1e-9),
  motion_check("Q5 odds ratio 2022", 3.835, so(2022, "Q5"), 5e-4), motion_check("Q5 odds ratio 2021", 3.391, so(2021, "Q5"), 5e-4), motion_check("Q2 odds ratio 2020", 1.984, so(2020, "Q2"), 5e-4),
  motion_check("Q5 2022 vs 2021 ratio", 1.131, facts$size_q5_2022_ratio, 5e-4), motion_check("Q5 2022 vs 2021 low", 1.062, facts$size_q5_2022_low, 5e-4), motion_check("Q5 2022 vs 2021 high", 1.204, facts$size_q5_2022_high, 5e-4),
  motion_check("raw Q1 2022", 83.9, round(facts$size_raw_q1_2022, 1), 1e-9), motion_check("raw Q5 2022", 95.1, round(facts$size_raw_q5_2022, 1), 1e-9),
  motion_check("sanctioned only OR 2019 (eligible)", 1.470, facts$sanctioned_only_or_2019, 5e-4), motion_check("sanctioned only OR 2024 (eligible)", 0.570, facts$sanctioned_only_or_2024, 5e-4),
  motion_check("sanctioned only OR 2024 (registered)", 0.445, lo("annual-registered-membership", "sanctioned_only", 2024), 5e-4),
  motion_check("administrative_only is Table B.7's government strategic only: OR 2019 (eligible)", 0.055, lo("annual-eligible-membership", "administrative_only", 2019), 5e-4),
  motion_check("administrative_only OR 2024 (eligible)", 0.028, lo("annual-eligible-membership", "administrative_only", 2024), 5e-4),
  motion_check("prior-available transitions 2020-2024", 10484716, facts$prior_available), motion_check("prior-available next-year statement", 9323396, facts$prior_available_A),
  motion_check("prior-available removed", 300868, facts$prior_available_X), motion_check("prior-absent transitions", 4814211, facts$prior_absent),
  motion_check("prior-absent reappear", 462941, facts$prior_absent_A), motion_check("prior-absent removed", 1401172, facts$prior_absent_X),
  motion_check("fixed 2019 cohort", 3413062, facts$fixed_2019_cohort), motion_check("sanctioned only denominator", 2784, facts$aaannn_sanctioned_only_denom),
  motion_check("AAANNN sanctioned only", 98, facts$aaannn_sanctioned_only), motion_check("AAANNN sanctioned only share", 3.52, round(100 * facts$aaannn_sanctioned_only / facts$aaannn_sanctioned_only_denom, 2), 1e-9),
  motion_check("AAANNN no list share", 1.31, round(100 * facts$aaannn_no_list / facts$aaannn_no_list_denom, 2), 1e-9),
  motion_check("revenue cohort by cash share", 1503198, facts$cohorts$revenue_cash), motion_check("margin cohort by inventory share", 1178930, facts$cohorts$margin_inventory))

out <- list(avail = avail, groups = grp, size = size, size_changes = size_changes, size_raw = raw, lists = lists,
            transitions = trans, transitions_pooled = pooled, histories = top, history_bins = history_bins,
            flow = data.frame(id = flow$id, value = as.integer(flow$value), population = flow$population, unit = flow$unit, source = flow$source),
            events = events, facts = facts,
            sources = list(avail = "Table B.1 (ch2-p1-availability-source.csv)", groups = "Figures 2.2-2.4 sources (pass2 addendum)", size = "Figure 2.5 / Tables B.4-B.5 (saved-adjusted-odds-ratios.csv)",
                           size_changes = "Table B.4 (size-changes.csv)", lists = "Table B.7 (ch2-p1-contrasts-source.csv)", transitions = "Figure 2.6 / Table B.2 (transition-denominators.csv)",
                           histories = "Table B.13 (fixed-2019-pattern-histories.csv)", flow = "Figure 1.3 (displayed-counts.csv)", dots = "Figure 2.7 accounting (dot_accounting.csv, coordinate_piles.csv)"))
motion_save_json(out, "series", checks = checks, rows = nrow(avail))
