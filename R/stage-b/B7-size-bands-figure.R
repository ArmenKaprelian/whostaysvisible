# B7 figure: availability in year t by decile of the firm's assets reported in its original statement of t-1.
source(file.path(Sys.getenv("LAB_ROOT"), "R", "lab.R")); lab_init()
library(ggplot2)

d <- lab_read_aggregate("B7-size-bands", "stage-b")
d$rate <- d$available / d$firms
d$era <- ifelse(d$year >= 2019, "FNS era, 2020-2025", "Rosstat era, 2013-2018")
d$era <- factor(d$era, levels = c("Rosstat era, 2013-2018", "FNS era, 2020-2025"))
d$supported <- d$firms >= 50
lab_save_aggregate(d, "B7-size-rates", "stage-b")
ends <- d[d$decile == 10 & d$year %in% c(2013, 2018, 2020, 2025), ]
ends$label <- as.character(ends$year); ends$label[ends$year == 2025] <- "2025*"
medians <- aggregate(assets_median ~ decile, d[d$year == 2024, ], median)
med_txt <- paste(ifelse(medians$assets_median >= 1e3, sprintf("%.0f", medians$assets_median / 1e3), sprintf("%.2f", medians$assets_median / 1e3)), collapse = ", ")
ncount <- aggregate(firms ~ year, d, sum)
p <- ggplot(d, aes(decile, 100 * rate, group = year)) +
  geom_line(aes(colour = year >= 2022), linewidth = 0.7) +
  geom_point(aes(colour = year >= 2022, shape = supported), size = 1.2) +
  ggrepel::geom_text_repel(data = ends, aes(x = 10.15, y = 100 * rate, label = label, colour = year >= 2022), hjust = 0, direction = "y",
                           segment.colour = NA, min.segment.length = Inf, family = lab_font, size = lab_pt(10), xlim = c(10.15, 12.5)) +
  scale_colour_manual(values = c(`TRUE` = lab_palette[["primary"]], `FALSE` = lab_palette[["neutral"]])) +
  scale_shape_manual(values = c(`TRUE` = 16, `FALSE` = 1)) +
  scale_x_continuous(breaks = 1:10, limits = c(0.7, 12.5), expand = c(0, 0)) +
  scale_y_continuous(limits = c(0, 100), breaks = seq(0, 100, 25), expand = c(0, 0)) +
  coord_cartesian(clip = "off") +
  facet_wrap(~ era, ncol = 2) +
  labs(title = "Smaller firms go dark more often",
       subtitle = sprintf("Share of eligible firms with an original statement in year t (%%), by decile of total assets in the firm's original\nstatement of t-1; one line per year, blue from 2022. Median assets by decile in 2024, million rubles: %s.", med_txt),
       x = "Decile of assets in the previous year's original statement (1 = smallest)", y = NULL) +
  theme_lab()
notes <- paste(
  "Source: RFSD v3.1.0; lab aggregation of the foundation registry and payload. For each financial year t, eligible firms with a",
  "consistent identity and an original statement in t-1 reporting positive total assets (line 1600) are ranked into deciles of those",
  "assets within year; the share with an original statement in t is plotted per decile. Each decile holds about 170,000 to 220,000",
  "firms. Conditioning on a prior original statement selects prior observers, so levels exceed the population rate. No lag crosses",
  "the 2018 to 2019 provider change. Nominal assets rank identically to deflated assets within a year. This previews the deferred",
  "financial-predictor analysis descriptively; it is not an estimate. *2025 is the flagged latest financial year.")
lab_save_figure(p, "B7-size-bands", "20261007-sketch", height = 4.8, stage = "B",
  title = "Availability by size of the previous original statement",
  question = "Do smaller firms withhold or lose their statements more often than larger firms, and did that gradient change after 2022?",
  notes = notes, data = list(list(id = "B7-size-rates", stage = "stage-b")))
