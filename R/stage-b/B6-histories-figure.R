# B6 figure: the most common six-year reporting histories, 2019-2024, among firms eligible and
# registered in 2019 with consistent identity.
source(file.path(Sys.getenv("LAB_ROOT"), "R", "lab.R")); lab_init()
library(ggplot2)

d <- lab_read_aggregate("B6-histories", "stage-b")
total <- sum(d$firms)
d <- d[order(-d$firms), ]
top <- head(d, 22)
rest <- data.frame(history = "all other histories", firms = total - sum(top$firms))
tab <- rbind(top, rest); tab$share <- tab$firms / total
tab$rank <- seq_len(nrow(tab))
# Summaries for the subtitle and notes.
first_n <- d[substr(d$history, 1, 1) == "N", ]
removed_by_2024 <- sum(first_n$firms[grepl("X", first_n$history)])
summ <- data.frame(firms_2019 = total, always_available = d$firms[d$history == "AAAAAA"] / total,
                   absent_2019 = sum(first_n$firms) / total, absent_2019_removed_by_2024 = removed_by_2024 / sum(first_n$firms),
                   always_absent = d$firms[d$history == "NNNNNN"] / total)
lab_save_aggregate(tab, "B6-top-histories", "stage-b")
lab_save_aggregate(summ, "B6-summary", "stage-b")
cells <- do.call(rbind, lapply(seq_len(nrow(top)), function(i) data.frame(rank = i, year = 2019:2024, state = strsplit(top$history[i], "")[[1]])))
state_names <- c(A = "A: original available", N = "N: registered, no original", X = "X: recorded removal", O = "other record", `-` = "no record")
cells$state <- factor(cells$state, levels = names(state_names))
fills <- c(A = lab_palette[["primary"]], N = lab_palette[["comparison"]], X = "#4A5760", O = "#D9A77A", `-` = "#F1F3F4")
tab$rowlab <- ifelse(tab$history == "all other histories", "all other histories", "")
pc <- ggplot(cells, aes(year, -rank)) +
  geom_tile(aes(fill = state), width = 0.92, height = 0.82) +
  geom_text(aes(label = ifelse(state == "-", "", as.character(state))), family = lab_font, size = lab_pt(10),
            colour = ifelse(cells$state %in% c("A", "N", "X"), "white", lab_palette[["text"]])) +
  scale_fill_manual(values = fills, labels = state_names, name = NULL) +
  scale_x_continuous(breaks = 2019:2024, position = "top", expand = c(0, 0.1)) +
  scale_y_continuous(breaks = -tab$rank, labels = ifelse(tab$history == "all other histories", "", sprintf("%d", tab$rank)), limits = c(-nrow(tab) - 0.6, -0.4), expand = c(0, 0)) +
  labs(x = NULL, y = NULL) + theme_lab(grid_y = FALSE) +
  theme(legend.position = "bottom", legend.direction = "horizontal", legend.key.size = grid::unit(9, "pt"), axis.ticks = element_blank(),
        legend.justification = "left", legend.text = element_text(size = 10), plot.margin = margin(6, 2, 6, 6)) +
  guides(fill = guide_legend(nrow = 2, byrow = TRUE))
ps <- ggplot(tab, aes(x = 100 * share, y = -rank)) +
  geom_col(fill = ifelse(tab$history == "all other histories", lab_palette[["grid"]], lab_palette[["neutral"]]), width = 0.7) +
  geom_text(aes(label = sprintf("%s   %s", lab_pct(share, 1), lab_n(firms))), hjust = 0, nudge_x = 0.6, family = lab_font, size = lab_pt(10), colour = lab_palette[["text"]]) +
  scale_x_continuous(limits = c(0, 80), expand = c(0, 0)) +
  scale_y_continuous(limits = c(-nrow(tab) - 0.6, -0.4), expand = c(0, 0)) +
  labs(subtitle = "Share of the 2019 firms (%), and count", x = NULL, y = NULL) + theme_lab(grid_y = FALSE) +
  theme(axis.text = element_blank(), axis.ticks = element_blank(), plot.margin = margin(6, 6, 6, 0))
p <- patchwork::wrap_plots(pc, ps, nrow = 1, widths = c(1.15, 1)) +
  patchwork::plot_annotation(
    title = "Six-year reporting histories of the 2019 registered population, 2019-2024",
    subtitle = sprintf("The %d most common histories of %s firms eligible and registered in 2019. %s were available every year;\nof the %s absent in 2019, %s had a recorded removal by 2024.",
                       nrow(top), lab_n(total), lab_pct(summ$always_available, 0), lab_pct(summ$absent_2019, 0), lab_pct(summ$absent_2019_removed_by_2024, 0)),
    theme = theme_lab())
notes <- paste(
  "Source: RFSD v3.1.0; lab aggregation of the foundation registry. The population is firms eligible and registered at year-end 2019",
  "with consistent identity across the release. Each year's state: A, eligible with an original statement; N, eligible, registered,",
  "no original; X, recorded registry removal by year-end, which takes precedence over a dissolution-year statement; other, a record",
  "that is ineligible or has unresolved registration; blank, no record in that year. A blank after X is expected; a blank without",
  "a prior X is not an exit. Rows after the top histories are pooled. FNS era only; no history crosses the provider change.",
  "Descriptive; the histories describe the retrieved release, not dated disclosure decisions.")
lab_save_figure(p, "B6-histories", "20261007-sketch", height = 7, stage = "B",
  title = "Six-year reporting histories of the 2019 registered population",
  question = "Which available, absent, removed and no-record sequences are most common among 2019 firms, and when do histories break?",
  notes = notes, data = list(list(id = "B6-top-histories", stage = "stage-b"), list(id = "B6-summary", stage = "stage-b")))
