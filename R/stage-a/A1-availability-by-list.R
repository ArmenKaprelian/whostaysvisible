# A1. Original availability by supplied list, 2012-2025: member versus non-member
# lines on the eligible denominator, one panel per list. Source: foundation accounting.
source(file.path(Sys.getenv("LAB_ROOT"), "R", "lab.R")); lab_init()
library(ggplot2)

ams <- lab_read_csv("acct.annual-membership-shares")
ams$membership_level <- ifelse(is.na(ams$membership_level), "", as.character(ams$membership_level))  # blank = no usable key
ann <- lab_read_csv("acct.annual-accounting")
groups <- c("member_sanctioned", "member_putin_decree", "member_residents",
            "member_strateg_government", "member_strateg_putin", "administrative_union")
d <- ams[ams$membership_group %in% groups & ams$membership_level %in% c("0", "1") & ams$year >= 2012, ]
d$member <- d$membership_level == "1"
d$group <- factor(lab_group_names[d$membership_group], levels = lab_group_names[groups])
d$eligible_rate <- d$eligible_available / d$eligible_rows
d$registered_rate <- d$registered_available / d$eligible_registered
d <- d[order(d$group, d$member, d$year), c("year", "membership_group", "group", "member", "eligible_rows",
                                           "eligible_available", "eligible_registered", "registered_available",
                                           "eligible_rate", "registered_rate")]

# Checks: the two levels plus the unknown-key rows sum to the annual eligible population,
# and the member+non-member available counts reproduce the manuscript's 2021 and 2024 shares.
unknown <- ams[ams$membership_group == "member_sanctioned" & ams$membership_level == "", ]
tot <- aggregate(cbind(eligible_rows, eligible_available) ~ year, d[d$membership_group == "member_sanctioned", ], sum)
tot <- merge(tot, unknown[, c("year", "eligible_rows", "eligible_available")], by = "year", all.x = TRUE, suffixes = c("", "_unknown"))
tot[is.na(tot)] <- 0
tot$eligible_rows <- tot$eligible_rows + tot$eligible_rows_unknown
tot$eligible_available <- tot$eligible_available + tot$eligible_available_unknown
a21 <- ann[ann$year == 2021, ]; a24 <- ann[ann$year == 2024, ]
checks <- data.frame(
  check = c("eligible rows 2021 (list levels + unknown) = annual accounting", "eligible available 2024 = annual accounting",
            "2021 eligible availability share = 63.43 % (manuscript)", "2024 eligible availability share = 66.28 % (manuscript)"),
  expected = c(a21$eligible_rows, a24$eligible_available, 0.6343, 0.6628),
  observed = c(tot$eligible_rows[tot$year == 2021], tot$eligible_available[tot$year == 2024],
               tot$eligible_available[tot$year == 2021] / tot$eligible_rows[tot$year == 2021],
               tot$eligible_available[tot$year == 2024] / tot$eligible_rows[tot$year == 2024]),
  tolerance = c(0, 0, 0.00005, 0.00005))
lab_save_aggregate(d, "A1-availability-by-list", "stage-a", checks = checks)

# Figure: six small multiples, common 0-100 axis, eligible denominator; lines break at the
# 2018/2019 provider change so no segment implies a within-provider movement across it.
lab_fmt_n <- function(n) ifelse(n >= 1e6, sprintf("%.2f M", n / 1e6), lab_n(n))
d$era <- ifelse(d$year >= 2019, "FNS", "Rosstat")
ends <- d[d$year == 2024, ]
ends$label <- ifelse(ends$member, sprintf("listed %s\n%s firms", lab_pct(ends$eligible_rate, 0), lab_fmt_n(ends$eligible_rows)),
                     sprintf("others %s", lab_pct(ends$eligible_rate, 0)))
p <- ggplot(d, aes(year, 100 * eligible_rate, group = interaction(member, era))) +
  lab_era_layers(0, 100, xmax = 2031, label_y = 93) +
  geom_line(aes(colour = member, linewidth = member)) +
  geom_point(aes(colour = member), size = 1.1) +
  ggrepel::geom_text_repel(data = ends, aes(x = 2025.4, y = 100 * eligible_rate, label = label, colour = member),
            hjust = 0, direction = "y", nudge_x = 0, segment.colour = NA, min.segment.length = Inf, box.padding = 0.4, point.padding = 0,
            family = lab_font, size = lab_pt(10), lineheight = 0.9, xlim = c(2025.4, 2031)) +
  scale_colour_manual(values = c(`TRUE` = lab_palette[["primary"]], `FALSE` = lab_palette[["neutral"]])) +
  scale_linewidth_manual(values = c(`TRUE` = 0.9, `FALSE` = 0.6)) +
  scale_y_continuous(limits = c(0, 100), breaks = seq(0, 100, 25), expand = c(0, 0)) +
  scale_x_continuous(breaks = c(2012, 2016, 2020, 2024), labels = c("2012", "2016", "2020", "2024"),
                     limits = c(2011.6, 2031), expand = c(0, 0)) +
  coord_cartesian(clip = "off") +
  facet_wrap(~ group, ncol = 2) +
  labs(title = "Original-statement availability by supplied list, 2012-2025",
       subtitle = "Share of eligible records with an original statement (%): listed firms versus all other eligible firms",
       x = NULL, y = NULL) +
  theme_lab() + theme(panel.spacing.x = grid::unit(14, "pt"), panel.spacing.y = grid::unit(8, "pt"))
notes <- paste(
  "Source: RFSD v3.1.0, foundation accounting (annual-membership-shares). Each panel divides eligible records with an original",
  "statement (filed and not imputed) by all eligible records in that financial year, separately for firms on the named supplied",
  "list and for all other eligible firms, which include members of the other lists. Lists are fixed supplied files with overlaps,",
  "not dated designations. End labels give the 2024 share and the count of listed eligible firms in 2024. 2011 has no original",
  "statements in the release and is not plotted; 2025 is the flagged latest financial year. Lines break at the 2019 provider",
  "change (shaded): the Rosstat archive and the FNS resource are different collections, and the fall in listed groups' availability",
  "between 2018 and 2019 coincides with that change; it is not evidence of a change in firms' behaviour. Dotted markers identify",
  "2014, 2020 (Government Decree 35) and 2022 for context, not as causal comparisons.")
lab_save_figure(p, "A1-availability-by-list", "20261007-sketch", height = 7,
  title = "Original-statement availability by supplied list, 2012-2025",
  question = "Do firms on each supplied list show different original availability than other eligible firms, and did the gap move at the 2019 provider change, Decree 35 (2020) and 2022?",
  stage = "A", notes = notes, data = list(list(id = "A1-availability-by-list", stage = "stage-a")))
