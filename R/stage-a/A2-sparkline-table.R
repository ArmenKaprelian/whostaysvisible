# A2. Membership groups at a glance: a table-graphic with a 2012-2025 sparkline per
# group, the 2021 and 2024 shares, the change and the listed N. Same source as A1.
source(file.path(Sys.getenv("LAB_ROOT"), "R", "lab.R")); lab_init()
library(ggplot2)

a1 <- lab_read_aggregate("A1-availability-by-list", "stage-a")
ann <- lab_read_csv("acct.annual-accounting")
m <- a1[a1$member, ]
rows <- unique(m$group)
allrow <- data.frame(year = ann$year, group = "All eligible records", eligible_rows = ann$eligible_rows,
                     eligible_available = ann$eligible_available, eligible_rate = ann$eligible_availability_share)
allrow <- allrow[allrow$year >= 2012, ]
s <- rbind(m[, c("year", "group", "eligible_rows", "eligible_available", "eligible_rate")], allrow)
s$group <- factor(s$group, levels = c(rows, "All eligible records"))
tab <- do.call(rbind, lapply(split(s, s$group), function(g) {
  data.frame(group = g$group[1],
             n_2021 = g$eligible_rows[g$year == 2021], n_2024 = g$eligible_rows[g$year == 2024],
             rate_2021 = g$eligible_rate[g$year == 2021], rate_2024 = g$eligible_rate[g$year == 2024],
             rate_min = min(g$eligible_rate), rate_max = max(g$eligible_rate),
             year_min = g$year[which.min(g$eligible_rate)], year_max = g$year[which.max(g$eligible_rate)])
}))
tab$change_pp <- 100 * (tab$rate_2024 - tab$rate_2021)
checks <- data.frame(check = c("all-eligible 2021 share = 63.43 %", "all-eligible 2024 share = 66.28 %"),
                     expected = c(0.6343, 0.6628), observed = tab$rate_2021[tab$group == "All eligible records"] * c(1, 0) + tab$rate_2024[tab$group == "All eligible records"] * c(0, 1),
                     tolerance = 0.00005)
lab_save_aggregate(tab, "A2-sparkline-table", "stage-a", checks = checks)

# Layout: y = row (group); sparklines occupy x in [0, 14] mapped from 2012-2025; text columns to the right.
s$row <- as.integer(s$group); tab$row <- as.integer(tab$group)
nrow_ <- nrow(tab)
s$ypos <- nrow_ - s$row + 1; tab$ypos <- nrow_ - tab$row + 1
spark_h <- 0.72
s$sx <- (s$year - 2012) * (14 / 13); s$sy <- s$ypos - spark_h / 2 + spark_h * s$eligible_rate
ext <- rbind(data.frame(group = tab$group, year = tab$year_min, rate = tab$rate_min, kind = "min"),
             data.frame(group = tab$group, year = tab$year_max, rate = tab$rate_max, kind = "max"))
ext$ypos <- nrow_ - as.integer(ext$group) + 1
ext$sx <- (ext$year - 2012) * (14 / 13); ext$sy <- ext$ypos - spark_h / 2 + spark_h * ext$rate
col_x <- c(name = -0.6, spark = 0, r21 = 21, r24 = 26.5, chg = 33.5, n21 = 40.5, n24 = 47)
hdr <- data.frame(x = unname(col_x[c("r21", "r24", "chg", "n21", "n24")]), lab = c("2021", "2024", "Change", "N 2021", "N 2024"))
tab$small <- tab$n_2021 < 50 | tab$n_2024 < 50
txt_col <- ifelse(tab$small, lab_palette[["neutral"]], lab_palette[["text"]])
fmt_n <- function(n) ifelse(n >= 1e6, sprintf("%.2f M", n / 1e6), lab_n(n))
p <- ggplot() +
  annotate("rect", xmin = (2019 - 2012) * 14 / 13 - 0.5, xmax = 14 + 0.3, ymin = 0.45, ymax = nrow_ + 0.55, fill = lab_palette[["era"]], colour = NA) +
  geom_hline(yintercept = seq(0.5, nrow_ + 0.5, 1), colour = lab_palette[["grid"]], linewidth = 0.3) +
  geom_line(data = s, aes(sx, sy, group = group), colour = lab_palette[["primary"]], linewidth = 0.6) +
  geom_point(data = ext, aes(sx, sy, colour = kind), size = 1.6) +
  scale_colour_manual(values = c(min = lab_palette[["comparison"]], max = lab_palette[["primary"]])) +
  geom_text(data = tab, aes(col_x[["name"]], ypos, label = group), hjust = 1, family = lab_font, size = lab_pt(10), colour = lab_palette[["text"]]) +
  geom_text(data = tab, aes(col_x[["r21"]], ypos, label = lab_pct(rate_2021, 1)), hjust = 1, family = lab_font, size = lab_pt(10), colour = txt_col) +
  geom_text(data = tab, aes(col_x[["r24"]], ypos, label = lab_pct(rate_2024, 1)), hjust = 1, family = lab_font, size = lab_pt(10), colour = txt_col) +
  geom_text(data = tab, aes(col_x[["chg"]], ypos, label = sprintf("%+.1f", change_pp)), hjust = 1, family = lab_font, size = lab_pt(10),
            colour = ifelse(tab$small, lab_palette[["neutral"]], ifelse(tab$change_pp < 0, lab_palette[["comparison"]], lab_palette[["primary"]]))) +
  geom_text(data = tab, aes(col_x[["n21"]], ypos, label = fmt_n(n_2021)), hjust = 1, family = lab_font, size = lab_pt(10), colour = lab_palette[["neutral"]]) +
  geom_text(data = tab, aes(col_x[["n24"]], ypos, label = fmt_n(n_2024)), hjust = 1, family = lab_font, size = lab_pt(10), colour = lab_palette[["neutral"]]) +
  geom_text(data = hdr, aes(x, nrow_ + 1.05, label = lab), hjust = 1, family = lab_font, size = lab_pt(10), colour = lab_palette[["neutral"]]) +
  annotate("text", x = 0, y = nrow_ + 1.05, label = "2012", hjust = 0, family = lab_font, size = lab_pt(10), colour = lab_palette[["neutral"]]) +
  annotate("text", x = 14, y = nrow_ + 1.05, label = "2025*", hjust = 1, family = lab_font, size = lab_pt(10), colour = lab_palette[["neutral"]]) +
  annotate("text", x = (2019 - 2012) * 14 / 13 + 3.3, y = 0.2, label = "FNS era", hjust = 0.5, family = lab_font, size = lab_pt(10), colour = lab_palette[["era_label"]]) +
  scale_x_continuous(limits = c(-16, 48), expand = c(0, 0)) +
  scale_y_continuous(limits = c(0, nrow_ + 1.5), expand = c(0, 0)) +
  labs(title = "Original availability by supplied list, at a glance",
       subtitle = "Share of eligible records with an original statement (%), 2012-2025, and the change 2021 to 2024 in points.\nBrick dot: lowest year; blue dot: highest year. Gray rows have fewer than 50 listed firms.",
       x = NULL, y = NULL) +
  theme_lab(grid_y = FALSE) + theme(axis.text = element_blank(), axis.ticks = element_blank())
notes <- paste(
  "Source: RFSD v3.1.0, foundation accounting (annual-membership-shares, annual-accounting). Sparklines share one 0-100 scale.",
  "Shares divide eligible records with an original statement by all eligible records on each list; listed counts are eligible",
  "firm-year records matched to the supplied file. Rows with fewer than 50 listed firms are printed in gray. Lists overlap and",
  "are fixed supplied files, not dated designations. Sparklines break at the 2019 provider change. 2011 is",
  "omitted (no original statements in the release); 2025 is the flagged latest year. Descriptive; no causal comparison.")
lab_save_figure(p, "A2-sparkline-table", "20261007-sketch", height = 3.6,
  title = "Original availability by supplied list, at a glance", stage = "A",
  question = "Which supplied groups changed most between 2021 and 2024, and at what N?",
  notes = notes, data = list(list(id = "A2-sparkline-table", stage = "stage-a"), list(id = "A1-availability-by-list", stage = "stage-a")))
