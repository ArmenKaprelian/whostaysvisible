# A3. Persistence of reporting across both eras: among eligible firms registered at
# the prior year-end, shares available (A), absent (N) and removed (X) next year,
# by origin year 2012-2024 and prior state. Source: foundation transition denominators.
source(file.path(Sys.getenv("LAB_ROOT"), "R", "lab.R")); lab_init()
library(ggplot2)

td <- lab_read_csv("acct.transition-denominators")
t5 <- lab_read_csv("t5.ch2-p1-transitions-source")
td$prior <- factor(ifelse(td$prior_absent == 1, "Previously absent", "Previously available"),
                   levels = c("Previously available", "Previously absent"))
long <- do.call(rbind, lapply(c("A", "N", "X"), function(k) data.frame(
  origin_year = td$origin_year, destination_year = td$destination_year, prior = td$prior, origin_rows = td$origin_rows,
  state = k, count = td[[k]], share = td[[k]] / td$origin_rows)))
long$state_label <- c(A = "Available next year", N = "Registered, absent next year", X = "Recorded removal")[long$state]
long <- long[order(long$prior, long$state, long$origin_year), ]
# Checks against the Task 5 transitions source (2019-2023 origins).
chk <- merge(td, t5, by = c("origin_year", "destination_year", "prior_absent"), suffixes = c("", "_t5"))
checks <- data.frame(check = c("origin rows 2019-2023 equal Task 5 source", "A counts 2019-2023 equal Task 5 source",
                               "2021 prior-available origins = 2,122,411 (manuscript)"),
                     expected = c(sum(chk$origin_rows_t5), sum(chk$A_t5), 2122411),
                     observed = c(sum(chk$origin_rows), sum(chk$A), td$origin_rows[td$origin_year == 2021 & td$prior_absent == 0]),
                     tolerance = 0)
lab_save_aggregate(long, "A3-persistence-across-eras", "stage-a", checks = checks)

ends <- long[long$origin_year == 2024, ]
ends$label <- sprintf("%s  %s", c(A = "Available next year", N = "Absent next year", X = "Recorded removal")[ends$state], lab_pct(ends$share, 0))
nlab <- unique(long[, c("origin_year", "prior", "origin_rows")])
strip_n <- vapply(levels(long$prior), function(pr) {
  g <- nlab[nlab$prior == pr, ]
  sprintf("%s: %.2f M origins in 2012, %.2f M in 2019, %.2f M in 2024", pr,
          g$origin_rows[g$origin_year == 2012] / 1e6, g$origin_rows[g$origin_year == 2019] / 1e6, g$origin_rows[g$origin_year == 2024] / 1e6)
}, "")
long$panel <- factor(strip_n[as.character(long$prior)], levels = strip_n)
ends$panel <- factor(strip_n[as.character(ends$prior)], levels = strip_n)
cols <- c(A = lab_palette[["primary"]], N = lab_palette[["comparison"]], X = lab_palette[["neutral"]])
p <- ggplot(long, aes(origin_year, 100 * share, colour = state, group = interaction(state, origin_year >= 2019))) +
  lab_era_layers(0, 100, xmax = 2031, label_y = 94) +
  geom_line(linewidth = 0.8) + geom_point(size = 1.3) +
  ggrepel::geom_text_repel(data = ends, aes(x = 2024.4, y = 100 * share, label = label), hjust = 0, direction = "y",
            segment.colour = NA, min.segment.length = Inf, box.padding = 0.15, family = lab_font, size = lab_pt(10), xlim = c(2024.4, 2031)) +
  scale_colour_manual(values = cols) +
  scale_y_continuous(limits = c(0, 100), breaks = seq(0, 100, 25), expand = c(0, 0)) +
  scale_x_continuous(breaks = c(2012, 2015, 2018, 2021, 2024), labels = c("2012\u219213", "2015\u219216", "2018\u219219", "2021\u219222", "2024\u219225*"),
                     limits = c(2011.5, 2031), expand = c(0, 0)) +
  coord_cartesian(clip = "off") +
  facet_wrap(~ panel, ncol = 1) +
  labs(title = "What follows an available or an absent statement, 2012\u219213 to 2024\u219225",
       subtitle = "Share of eligible firms registered at the prior year-end (%), by next-year destination",
       x = "Origin year \u2192 destination year", y = NULL) +
  theme_lab()
notes <- paste(
  "Source: RFSD v3.1.0, foundation transition accounting. Origins are eligible firms registered at the preceding year-end, split by",
  "prior original availability. Destinations: available original (A), registered with original absent (N), recorded registry",
  "removal (X); scope changes and unresolved destinations (under 0.01 %) complete the denominator and are omitted. Removal takes",
  "precedence over a dissolution-year statement; a missing destination row is not an exit. No transition crosses the 2018 to 2019",
  "provider change, so the 2018 origin does not exist; the 2012 origin is a coverage diagnostic (low original coverage). *Destination",
  "2025 is the flagged latest financial year. The manuscript figure shows destinations 2020-2024 only. Descriptive.")
lab_save_figure(p, "A3-persistence-across-eras", "20261007-sketch", height = 6.6,
  title = "What follows an available or an absent statement, across both eras", stage = "A",
  question = "Among eligible firms registered at the prior year-end, how do next-year availability, absence and recorded removal move over the whole release, by prior state?",
  notes = notes, data = list(list(id = "A3-persistence-across-eras", stage = "stage-a")))
