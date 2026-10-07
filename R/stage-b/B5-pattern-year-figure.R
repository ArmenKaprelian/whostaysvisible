# B5 figure: the five supplied lists as overlapping patterns, with 2021 counts and availability
# in 2021 and 2024 per pattern (an UpSet-style display).
source(file.path(Sys.getenv("LAB_ROOT"), "R", "lab.R")); lab_init()
library(ggplot2)

d <- lab_read_aggregate("B5-pattern-year", "stage-b")
d$pattern <- as.character(d$pattern)
d <- d[grepl("^[01]{5}$", d$pattern), ]
p21 <- d[d$year == 2021, ]; p24 <- d[d$year == 2024, ]
keep <- p21$pattern[p21$eligible_rows >= 30]
keep <- keep[order(-p21$eligible_rows[match(keep, p21$pattern)])]
other <- setdiff(unique(d$pattern), keep)
summarise_rows <- function(x, label) {
  r <- rbind(data.frame(pattern = keep, n = x$eligible_rows[match(keep, x$pattern)], avail = x$eligible_available[match(keep, x$pattern)]),
             data.frame(pattern = "other", n = sum(x$eligible_rows[x$pattern %in% other]), avail = sum(x$eligible_available[x$pattern %in% other])))
  r$rate <- r$avail / r$n; r$year <- label; r
}
tab <- rbind(summarise_rows(p21, 2021), summarise_rows(p24, 2024))
tab$row <- factor(tab$pattern, levels = rev(c(keep, "other")))
lists <- c("Sanctioned", "Decree", "Residents", "Government strategic", "Presidential strategic")
dots <- do.call(rbind, lapply(keep, function(pt) data.frame(pattern = pt, list = lists, member = strsplit(pt, "")[[1]] == "1")))
dots$row <- factor(dots$pattern, levels = levels(tab$row)); dots$list <- factor(dots$list, levels = lists)
lab_save_aggregate(tab, "B5-pattern-table", "stage-b")
t21 <- tab[tab$year == 2021, ]
t21$label <- ifelse(t21$pattern == "other", sprintf("other (%d)", length(other)), lab_n(t21$n))
t21$small <- t21$n < 50
w <- merge(tab[tab$year == 2021, c("row", "rate", "n")], tab[tab$year == 2024, c("row", "rate", "n")], by = "row", suffixes = c("_2021", "_2024"))
w$small <- w$n_2021 < 50 | w$n_2024 < 50
rowlab <- c(`00000` = "None of the five lists", `10000` = "Sanctioned only", `10010` = "Sanctioned + government strategic", `00010` = "Government strategic only",
            `01000` = "Decree only", `00001` = "Presidential strategic only", `00011` = "Government + presidential strategic", `10011` = "Sanctioned + both strategic",
            `11000` = "Sanctioned + decree", other = "All other patterns")
tab$rowlab <- ifelse(tab$pattern %in% names(rowlab), rowlab[tab$pattern], tab$pattern)
short <- c(Sanctioned = "S", Decree = "D", Residents = "R", `Government strategic` = "G", `Presidential strategic` = "P")
pm <- ggplot(dots, aes(list, row)) +
  geom_point(aes(colour = member), size = 3) +
  geom_line(data = dots[dots$member, ], aes(group = row), colour = lab_palette[["primary"]], linewidth = 0.8) +
  scale_colour_manual(values = c(`TRUE` = lab_palette[["primary"]], `FALSE` = lab_palette[["grid"]])) +
  scale_y_discrete(labels = function(x) ifelse(x %in% names(rowlab), rowlab[x], x)) +
  scale_x_discrete(position = "top", labels = function(x) short[x]) +
  labs(x = NULL, y = NULL) + theme_lab(grid_y = FALSE) +
  theme(axis.text.x.top = element_text(size = 10), axis.ticks = element_blank(), plot.margin = margin(6, 2, 6, 6))
pn <- ggplot(t21, aes(x = 1, y = row)) +
  geom_text(aes(label = label, colour = small), hjust = 1, family = lab_font, size = lab_pt(10)) +
  scale_colour_manual(values = c(`TRUE` = lab_palette[["neutral"]], `FALSE` = lab_palette[["text"]])) +
  scale_x_continuous(limits = c(-1.2, 1.05), expand = c(0, 0)) + coord_cartesian(clip = "off") +
  labs(subtitle = "Records, 2021", x = NULL, y = NULL) + theme_lab(grid_y = FALSE) +
  theme(axis.text = element_blank(), axis.ticks = element_blank(), plot.margin = margin(6, 2, 6, 0), plot.subtitle = element_text(hjust = 1))
pr <- ggplot(w, aes(y = row)) +
  geom_segment(aes(x = 100 * rate_2021, xend = 100 * rate_2024, yend = row), colour = lab_palette[["grid"]], linewidth = 1.6) +
  geom_point(aes(x = 100 * rate_2021), colour = ifelse(w$small, lab_palette[["unsupported"]], lab_palette[["neutral"]]), size = 2.4) +
  geom_point(aes(x = 100 * rate_2024), colour = ifelse(w$small, lab_palette[["unsupported"]], lab_palette[["primary"]]), size = 2.4) +
  geom_text(aes(x = 104, label = sprintf("%.0f \u2192 %.0f", 100 * rate_2021, 100 * rate_2024)), hjust = 0, family = lab_font, size = lab_pt(10),
            colour = ifelse(w$small, lab_palette[["neutral"]], lab_palette[["text"]])) +
  scale_x_continuous(limits = c(0, 145), breaks = c(0, 50, 100), expand = c(0, 0)) +
  coord_cartesian(clip = "off") +
  labs(subtitle = "Original share (%), 2021 \u2192 2024", x = NULL, y = NULL) + theme_lab(grid_y = FALSE, grid_x = TRUE) +
  theme(axis.text.y = element_blank(), axis.ticks.y = element_blank(), plot.margin = margin(6, 6, 6, 0))
p <- patchwork::wrap_plots(pm, pn, pr, nrow = 1, widths = c(1.45, 0.75, 1.9)) +
  patchwork::plot_annotation(title = "How the five supplied lists overlap, and availability by pattern",
                             subtitle = "Each row is one exact membership pattern among 2021 eligible records (at least 30 records).\nS sanctioned, D decree, R residents, G government strategic, P presidential strategic.\nGray: fewer than 50 records.",
                             theme = theme_lab())
notes <- paste(
  "Source: RFSD v3.1.0; lab aggregation of the foundation registry by exact five-list membership pattern and financial year. Each",
  "row is one pattern of the supplied lists (sanctioned, decree, residents, government strategic, presidential strategic); connected",
  "dots mark the lists a pattern belongs to, so rows are disjoint and their counts add up to the eligible population. Counts are",
  "eligible records in 2021; shares divide records with an original statement by eligible records in the pattern. Patterns with",
  "fewer than 50 records are shown in gray. Lists are fixed supplied files with overlaps, not dated designations. Descriptive.")
lab_save_figure(p, "B5-list-overlap", "20261007-sketch", height = 5, stage = "B",
  title = "How the five supplied lists overlap, and availability by pattern",
  question = "How do the overlapping memberships combine, how small are the overlaps that make some contrasts descriptive, and how does availability differ by exact pattern?",
  notes = notes, data = list(list(id = "B5-pattern-table", stage = "stage-b")))
