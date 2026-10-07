# B1 figure: regional dispersion of original availability through time, and 2021 versus 2024 by region.
source(file.path(Sys.getenv("LAB_ROOT"), "R", "lab.R")); lab_init()
library(ggplot2)

d <- lab_read_aggregate("B1-region-year", "stage-b")
d$rate <- ifelse(d$year == 2011, NA, d$eligible_available / d$eligible_rows)
d$supported <- d$eligible_rows >= 50
d$region <- d$region_model
new_terr <- c("donetsk", "luhansk", "zaporizhzhia", "kherson")
d$new_territory <- d$region %in% new_terr
d <- d[d$region != "__MISSING__", ]
nat <- aggregate(cbind(eligible_rows, eligible_available) ~ year, d, sum); nat$rate <- ifelse(nat$year == 2011, NA, nat$eligible_available / nat$eligible_rows)
nice <- function(x) { x <- gsub("-", " ", x); x <- tools::toTitleCase(x); x <- sub("^Sankt Petersburg$", "St Petersburg", x); x }
d$label <- nice(d$region)

# Panel 1: strip of all regions per year, supported cells only; national rate; new territories hollow brick.
s <- d[!is.na(d$rate) & d$supported, ]
s$kind <- ifelse(s$new_territory, "new", "other")
# Panel 2: 2021 vs 2024, point size = 2021 eligible firms; labels for the largest movers and the largest regions.
w <- merge(d[d$year == 2021, c("region", "label", "rate", "eligible_rows", "new_territory")],
           d[d$year == 2024, c("region", "rate", "eligible_rows")], by = "region", suffixes = c("_2021", "_2024"))
w <- w[w$eligible_rows_2021 >= 50 & w$eligible_rows_2024 >= 50, ]
w$change <- w$rate_2024 - w$rate_2021
w$show <- w$new_territory | rank(-abs(w$change)) <= 4 | rank(-w$eligible_rows_2021) <= 3 | rank(w$rate_2021) <= 2
summ <- data.frame(regions = nrow(w), up = sum(w$change > 0), down = sum(w$change < 0),
                   median_change_pp = 100 * median(w$change), national_2021 = nat$rate[nat$year == 2021], national_2024 = nat$rate[nat$year == 2024])
lab_save_aggregate(w, "B1-region-2021-2024", "stage-b")
lab_save_aggregate(summ, "B1-region-summary", "stage-b")

p1 <- ggplot(s, aes(year, 100 * rate)) +
  lab_era_layers(0, 100, xmax = 2025.5, label_y = 95) +
  geom_point(data = s[s$kind == "other", ], colour = lab_palette[["primary"]], alpha = 0.35, size = 1.1, shape = 16,
             position = position_jitter(width = 0.12, height = 0, seed = 1)) +
  geom_point(data = s[s$kind == "new", ], colour = lab_palette[["comparison"]], shape = 1, size = 1.6) +
  geom_line(data = nat[!is.na(nat$rate), ], aes(year, 100 * rate, group = year >= 2019), colour = lab_palette[["text"]], linewidth = 0.9) +
  annotate("text", x = 2019.3, y = 100 * nat$rate[nat$year == 2019] - 9, label = "national rate", hjust = 0, family = lab_font, size = lab_pt(10), colour = lab_palette[["text"]]) +
  scale_y_continuous(limits = c(0, 100), breaks = seq(0, 100, 25), expand = c(0, 0)) + lab_x_years(2012, 2025) +
  labs(title = sprintf("Original availability across the %d registered-address regions, 2012-2025", length(unique(d$region))),
       subtitle = "Each dot is a region-year with at least 50 eligible records: share with an original statement (%).\nHollow brick dots: the four regions annexed in 2022.",
       x = NULL, y = NULL) + theme_lab()
p2 <- ggplot(w, aes(100 * rate_2021, 100 * rate_2024)) +
  geom_abline(slope = 1, intercept = 0, colour = lab_palette[["tick"]], linewidth = 0.5) +
  geom_point(aes(size = eligible_rows_2021), colour = lab_palette[["primary"]], alpha = 0.55, shape = 16) +
  geom_point(data = w[w$new_territory, ], aes(size = eligible_rows_2021), colour = lab_palette[["comparison"]], shape = 1) +
  ggrepel::geom_text_repel(data = w[w$show, ], aes(label = label), family = lab_font, size = lab_pt(10), colour = lab_palette[["text"]],
                           min.segment.length = 0.2, segment.colour = lab_palette[["neutral"]], box.padding = 0.25, max.overlaps = 20, seed = 2) +
  scale_size_area(max_size = 7) +
  scale_x_continuous(limits = c(0, 100), breaks = seq(0, 100, 25), expand = c(0, 0)) +
  scale_y_continuous(limits = c(0, 100), breaks = seq(0, 100, 25), expand = c(0, 0)) +
  coord_equal(clip = "off") +
  labs(subtitle = sprintf("The same regions in 2021 and 2024; circle area is the 2021 eligible population.\n%d regions rose, %d fell; median change %+.1f points.",
                          summ$up, summ$down, summ$median_change_pp),
       x = "Share with an original statement, 2021 (%)", y = "Share with an original statement, 2024 (%)") +
  theme_lab(grid_x = TRUE)
p <- patchwork::wrap_plots(p1, p2, ncol = 1, heights = c(1, 1.5))
notes <- paste(
  "Source: RFSD v3.1.0; lab aggregation of the foundation registry by released region and financial year. Rates divide eligible",
  "records with an original statement by all eligible records in the region-year; region-years with fewer than 50 eligible records",
  "are omitted. Regions are registered addresses, not operating sites. The four regions annexed in 2022 carry registry rows with",
  "no original statements before 2022 by construction of the release. The upper panel breaks at the 2019 provider change; no",
  "line crosses it. The lower panel compares the same regions in 2021 and 2024. Descriptive; not a withdrawal history.")
lab_save_figure(p, "B1-regions", "20261007-sketch", height = 7, stage = "B",
  title = "Original availability across regions: dispersion through time and 2021 versus 2024",
  question = "Which registered-address regions report originals least, how dispersed are regions within each year, and did the ordering change between 2021 and 2024?",
  notes = notes, data = list(list(id = "B1-region-year", stage = "stage-b"), list(id = "B1-region-2021-2024", stage = "stage-b"), list(id = "B1-region-summary", stage = "stage-b")))
