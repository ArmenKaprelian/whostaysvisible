# B3 figure: Lexis surface of original availability by financial year and firm age at year-end.
source(file.path(Sys.getenv("LAB_ROOT"), "R", "lab.R")); lab_init()
library(ggplot2)

d <- lab_read_aggregate("B3-age-year", "stage-b")
a <- aggregate(cbind(eligible_rows, eligible_available) ~ year + age_band, d, sum)
a$rate <- ifelse(a$year == 2011, NA, a$eligible_available / a$eligible_rows)
a$supported <- a$eligible_rows >= 50
a$age_label <- ifelse(a$age_band < 0, "unknown", ifelse(a$age_band >= 30, "30+", as.character(a$age_band)))
lab_save_aggregate(a, "B3-age-surface", "stage-b")
s <- a[a$year >= 2012, ]
s$ypos <- ifelse(s$age_band < 0, -2, s$age_band)
n21 <- a[a$year == 2021, ]; n21$ypos <- ifelse(n21$age_band < 0, -2, n21$age_band)
cohorts <- data.frame(born = c(2012, 2016, 2020))
guides <- do.call(rbind, lapply(cohorts$born, function(b) data.frame(born = b, year = b:2025, age = 0:(2025 - b))))
guides <- guides[guides$age <= 30, ]
p1 <- ggplot(s, aes(year, ypos)) +
  geom_tile(aes(fill = 100 * rate), width = 1, height = 1) +
  geom_tile(data = s[!s$supported, ], fill = lab_palette[["unsupported"]], width = 1, height = 1) +
  geom_line(data = guides, aes(year, age, group = born), colour = "white", linewidth = 0.5, linetype = "11") +
  geom_text(data = unique(guides[guides$year == 2025, ]), aes(x = 2025.7, y = age, label = paste("born", born)), hjust = 0, family = lab_font, size = lab_pt(10), colour = lab_palette[["neutral"]]) +
  annotate("segment", x = 2018.5, xend = 2018.5, y = -2.5, yend = 30.5, colour = lab_palette[["text"]], linewidth = 0.5) +
  scale_fill_gradientn(colours = lab_seq(9), limits = c(30, 90), oob = scales::squish, na.value = "white",
                       name = "Share with an original statement (%)", breaks = c(30, 50, 70, 90)) +
  scale_y_continuous(breaks = c(-2, 0, 5, 10, 15, 20, 25, 30), labels = c("unknown", "0", "5", "10", "15", "20", "25", "30+"), expand = c(0, 0)) +
  scale_x_continuous(breaks = c(2012, 2015, 2018, 2021, 2024), limits = c(2011.5, 2029), expand = c(0, 0)) +
  coord_cartesian(clip = "off") +
  labs(title = "Original availability by firm age and financial year, 2012-2025",
       subtitle = "Share of eligible records with an original statement (%); each tile is one age in one financial year.\nDotted diagonals follow three registration cohorts; the vertical rule marks the 2019 provider change.",
       x = NULL, y = "Age at year-end (years)") +
  theme_lab(grid_y = FALSE) + theme(legend.position = "bottom", legend.key.height = grid::unit(6, "pt"), legend.key.width = grid::unit(40, "pt"),
                                    legend.title.position = "top", axis.ticks = element_blank())
p2 <- ggplot(n21, aes(ypos, eligible_rows / 1000)) +
  geom_col(fill = lab_palette[["neutral"]], width = 0.85) +
  scale_x_continuous(breaks = c(-2, 0, 10, 20, 30), labels = c("unknown", "0", "10", "20", "30+"), expand = c(0, 0.6)) +
  scale_y_continuous(expand = c(0, 0)) +
  labs(subtitle = "Eligible records by age in 2021 (thousands)", x = "Age at year-end (years)", y = NULL) + theme_lab()
p <- patchwork::wrap_plots(p1, p2, ncol = 1, heights = c(3.2, 1))
notes <- paste(
  "Source: RFSD v3.1.0; lab aggregation of the foundation registry by financial year and age at year-end (released age, otherwise",
  "the age implied by the registry creation date; unknown ages form their own row). Tiles with fewer than 50 eligible records are",
  "gray; 2011 has no original statements and is omitted. A diagonal reads as one registration cohort ageing through the years; the",
  "eligible population changes with entry and removal, so a tile is not a fixed set of firms. The 2018 to 2019 step coincides with",
  "the provider change. Descriptive; no survival claim.")
lab_save_figure(p, "B3-age-surface", "20261007-sketch", height = 7, stage = "B",
  title = "Original availability by firm age and financial year, 2012-2025",
  question = "Are young firms the absent ones, and did 2022 move all ages alike?",
  notes = notes, data = list(list(id = "B3-age-surface", stage = "stage-b")))
