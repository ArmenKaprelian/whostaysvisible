# A6. Original availability against local firm density: 100 km equal-area cells,
# 2019-2024, eligible located firms. Source: geography review cell aggregates.
source(file.path(Sys.getenv("LAB_ROOT"), "R", "lab.R")); lab_init()
library(ggplot2)

cells <- lab_read_csv("geo.cells")
cov <- lab_read_csv("geo.coverage")
c100 <- cells[cells$grid_km == 100 & cells$quality_scope == "all", ]
c100$rate <- c100$n_available / c100$n_eligible
c100$supported <- c100$n_eligible >= 50
c100$log10_eligible <- log10(c100$n_eligible)
nat <- aggregate(cbind(n_available, n_eligible) ~ year, c100, sum); nat$rate <- nat$n_available / nat$n_eligible
cov_el <- cov[cov$population == "eligible", ]
checks <- data.frame(check = c("located eligible 2021 across cells = coverage file", "located available 2021 across cells = coverage file"),
                     expected = c(cov_el$n_located[cov_el$year == 2021], cov_el$n_located_available[cov_el$year == 2021]),
                     observed = c(nat$n_eligible[nat$year == 2021], nat$n_available[nat$year == 2021]), tolerance = 0)
sup <- c100[c100$supported, ]
sup$decile <- ave(sup$log10_eligible, sup$year, FUN = function(x) ceiling(10 * rank(x, ties.method = "first") / length(x)))
dec <- do.call(rbind, lapply(split(sup, list(sup$year, sup$decile)), function(g) data.frame(
  year = g$year[1], decile = g$decile[1], cells = nrow(g), median_log10_eligible = median(g$log10_eligible),
  median_rate = median(g$rate), eligible_firms = sum(g$n_eligible), pooled_rate = sum(g$n_available) / sum(g$n_eligible))))
dec <- dec[order(dec$year, dec$decile), ]
out <- c100[, c("year", "ix", "iy", "x_km", "y_km", "n_eligible", "n_available", "rate", "supported", "log10_eligible")]
lab_save_aggregate(out, "A6-cells-availability", "stage-a", checks = checks)
lab_save_aggregate(dec, "A6-density-deciles", "stage-a")
lab_save_aggregate(nat, "A6-national-located", "stage-a")

ncells <- aggregate(supported ~ year, c100, function(s) sprintf("%d of %d cells", sum(s), length(s)))
sup$panel <- factor(sprintf("%d: %s", sup$year, ncells$supported[match(sup$year, ncells$year)]))
dec$panel <- factor(sprintf("%d: %s", dec$year, ncells$supported[match(dec$year, ncells$year)]), levels = levels(sup$panel))
nat$panel <- factor(sprintf("%d: %s", nat$year, ncells$supported[match(nat$year, ncells$year)]), levels = levels(sup$panel))
nat$lab <- sprintf("national %s", lab_pct(nat$rate, 0))
p <- ggplot(sup, aes(log10_eligible, 100 * rate)) +
  geom_hline(data = nat, aes(yintercept = 100 * rate), colour = lab_palette[["comparison"]], linewidth = 0.5, linetype = "22") +
  geom_point(colour = lab_palette[["primary"]], alpha = 0.25, size = 0.9, shape = 16) +
  geom_line(data = dec, aes(median_log10_eligible, 100 * median_rate), colour = lab_palette[["text"]], linewidth = 0.9) +
  geom_point(data = dec, aes(median_log10_eligible, 100 * median_rate), colour = lab_palette[["text"]], size = 1.6) +
  geom_text(data = nat, aes(x = 5.85, y = 100 * rate - 3.5, label = lab), hjust = 1, vjust = 1, family = lab_font, size = lab_pt(10), colour = lab_palette[["comparison"]]) +
  scale_x_continuous(breaks = log10(c(100, 1000, 10000, 100000)), labels = c("100", "1k", "10k", "100k"), limits = c(1.69, 5.9)) +
  scale_y_continuous(limits = c(0, 100), breaks = seq(0, 100, 25), expand = c(0, 0)) +
  facet_wrap(~ panel, ncol = 3) +
  labs(title = "Original availability against local firm density, 100 km cells, 2019-2024",
       subtitle = "Each dot is a cell with at least 50 located eligible firms: share with an original statement (%).\nBlack line: median rate within deciles of cell density. Dashed line: national rate among located eligible firms.",
       x = "Located eligible firms in the cell (log scale; k = thousand)", y = NULL) +
  theme_lab(grid_x = TRUE)
notes <- paste(
  "Source: RFSD v3.1.0; saved geographic review aggregates (100 km spherical equal-area cells, all valid coordinates). Each dot is a",
  "cell-year with at least 50 located eligible firms; the rate divides located eligible firms with an original statement by located",
  "eligible firms in the cell. The black line joins the median rate within deciles of cell density; the dashed brick line is the",
  "national rate among located eligible firms. Cells are registered addresses, not operating sites, and the eligible population",
  "changes by year. Panel titles count supported cells. Descriptive; density is not a cause.")
lab_save_figure(p, "A6-availability-vs-density", "20261007-sketch", height = 5.2, stage = "A",
  title = "Original availability against local firm density, 100 km cells, 2019-2024",
  question = "Is original availability higher where eligible firms cluster, and did that gradient change across 2019-2024?",
  notes = notes, data = list(list(id = "A6-cells-availability", stage = "stage-a"), list(id = "A6-density-deciles", stage = "stage-a"), list(id = "A6-national-located", stage = "stage-a")))
