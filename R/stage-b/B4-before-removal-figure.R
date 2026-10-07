# B4 figure: going dark before a recorded registry removal. Removal cohorts (year of the reconciled
# removal) followed backwards within their provider era, against firms with no recorded removal.
source(file.path(Sys.getenv("LAB_ROOT"), "R", "lab.R")); lab_init()
library(ggplot2)

d <- lab_read_aggregate("B4-before-removal", "stage-b")
d <- d[d$year >= 2012, ]
d$rate <- d$eligible_available / d$eligible_rows
ref <- d[d$years_before_removal == "no recorded removal", c("year", "eligible_rows", "rate")]
k <- d[!d$years_before_removal %in% c("no recorded removal", "removed that year"), ]
k$k <- as.integer(k$years_before_removal)
k$removal_year <- k$year + k$k
k$era_year <- ifelse(k$year >= 2019, "FNS", "Rosstat")
k$era_removal <- ifelse(k$removal_year >= 2019, "FNS", "Rosstat")
k <- k[k$era_year == k$era_removal, ]              # no horizon crosses the provider change
k <- merge(k, ref, by = "year", suffixes = c("", "_ref"))
k$supported <- k$eligible_rows >= 50
cohorts <- c(2015:2018, 2022:2025)
k <- k[k$removal_year %in% cohorts & k$k <= 6, ]
k$panel <- factor(sprintf("Removed in %d", k$removal_year), levels = sprintf("Removed in %d", cohorts))
lab_save_aggregate(k[order(k$removal_year, k$k), ], "B4-removal-cohorts", "stage-b")
lab_save_aggregate(ref, "B4-no-removal-reference", "stage-b")
n1 <- k[k$k == 1, ]; n1$lab <- sprintf("%s firms\none year before", lab_n(n1$eligible_rows))
p <- ggplot(k, aes(k, 100 * rate)) +
  geom_line(aes(y = 100 * rate_ref), colour = lab_palette[["neutral"]], linewidth = 0.6, linetype = "22") +
  geom_line(colour = lab_palette[["primary"]], linewidth = 0.9) +
  geom_point(aes(shape = supported), colour = lab_palette[["primary"]], fill = lab_palette[["primary"]], size = 1.6) +
  geom_text(data = n1, aes(x = 6.35, y = 97, label = lab), hjust = 0, vjust = 1, family = lab_font, size = lab_pt(10), colour = lab_palette[["neutral"]], lineheight = 0.9) +
  scale_shape_manual(values = c(`TRUE` = 21, `FALSE` = 1)) +
  scale_x_reverse(breaks = 1:6, limits = c(6.4, 0.6)) +
  scale_y_continuous(limits = c(0, 100), breaks = seq(0, 100, 25), expand = c(0, 0)) +
  facet_wrap(~ panel, ncol = 4) +
  labs(title = "Going dark before a recorded registry removal",
       subtitle = "Share of eligible firms with an original statement (%), by years before the recorded removal (blue),\nand among firms never removed within the release (dashed). Top row: Rosstat era; bottom row: FNS era.",
       x = "Years before the recorded removal", y = NULL) +
  theme_lab() + theme(panel.spacing.x = grid::unit(12, "pt"))
notes <- paste(
  "Source: RFSD v3.1.0; lab aggregation of the foundation registry among eligible records with consistent identity and dates",
  "(99.97 percent of eligible records). A firm's removal year is the year of its reconciled registry dissolution date; horizons",
  "count financial years before it and stay within one provider era. The dashed reference is the availability of eligible firms",
  "with no recorded removal in the release, which is right-censored: some will be removed after 2025. Removal is a registry event,",
  "not a verified business exit, and absence before it is not evidence of non-submission or concealment. Descriptive.")
lab_save_figure(p, "B4-going-dark", "20261007-sketch", height = 5.2, stage = "B",
  title = "Going dark before a recorded registry removal",
  question = "Do firms stop reporting originals in the years before their registry removal, how far ahead, and did the profile change between the Rosstat and FNS eras?",
  notes = notes, data = list(list(id = "B4-removal-cohorts", stage = "stage-b"), list(id = "B4-no-removal-reference", stage = "stage-b")))
