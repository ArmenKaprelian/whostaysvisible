# A5. Why 2021-cohort firms are not usable in each year: the six exhaustive reasons as
# shares of the fixed baseline cohort, four cash-moderator cohorts. Source: Task 5 exhibit source.
source(file.path(Sys.getenv("LAB_ROOT"), "R", "lab.R")); lab_init()
library(ggplot2)

r <- lab_read_csv("t5.ch2-p1-cohort-observation-reasons-source")
r <- r[r$moderator == "cash", ]
outcome_names <- c(log_real_revenue = "Real revenue", operating_margin = "Operating margin", cash_share = "Cash share", borrowing_share = "Borrowing share")
reason_names <- c(structural_unavailable = "Before incorporation or after dissolution year", absent_original = "No original statement",
                  missing_inputs = "Original present, required line missing", invalid_domain = "Outside the outcome's domain",
                  pending_financial_comparability = "Pending financial comparability", other_unresolved = "Unresolved")
r$outcome_label <- factor(outcome_names[r$outcome], levels = outcome_names)
r$reason_label <- factor(reason_names[r$reason], levels = rev(reason_names))
usable <- aggregate(rows ~ outcome + year + baseline_firms, r, sum)
usable$usable <- usable$baseline_firms - usable$rows
usable$usable_share <- usable$usable / usable$baseline_firms
obs <- lab_read_csv("t5.ch2-p1-cohort-observation-source")
obs <- obs[obs$moderator == "cash", ]
chk <- merge(usable, obs[, c("outcome", "year", "observed_usable", "baseline_firms")], by = c("outcome", "year"))
checks <- data.frame(check = c("usable = baseline minus reasons, all cohorts and years (max abs diff)",
                               "borrowing cohort baseline = 362,682 (manuscript)", "borrowing 2024 missing inputs = 101,070 (manuscript)",
                               "borrowing 2024 absent original = 47,264 (manuscript)"),
                     expected = c(0, 362682, 101070, 47264),
                     observed = c(max(abs(chk$usable - chk$observed_usable)), unique(r$baseline_firms[r$outcome == "borrowing_share"]),
                                  r$rows[r$outcome == "borrowing_share" & r$year == 2024 & r$reason == "missing_inputs"],
                                  r$rows[r$outcome == "borrowing_share" & r$year == 2024 & r$reason == "absent_original"]),
                     tolerance = 0)
out <- r[, c("outcome", "outcome_label", "year", "baseline_firms", "reason", "reason_label", "rows", "baseline_share")]
lab_save_aggregate(out, "A5-unusable-reasons", "stage-a", checks = checks)

fills <- c("No original statement" = lab_palette[["comparison"]], "Original present, required line missing" = lab_palette[["primary"]],
           "Before incorporation or after dissolution year" = "#9AA6AE", "Outside the outcome's domain" = "#4A5760",
           "Pending financial comparability" = "#D9A77A", "Unresolved" = "#000000")
top2 <- do.call(rbind, lapply(split(r, list(r$outcome, r$year)), function(g) {
  g <- g[order(-g$rows), ][1:2, ]; g$cum <- cumsum(g$baseline_share); g$mid <- g$cum - g$baseline_share / 2; g }))
top2 <- top2[top2$year %in% c(2019, 2022, 2024) & top2$baseline_share >= 0.04, ]
top2$lab <- lab_pct(top2$baseline_share, 0)
titles <- unique(usable[, c("outcome", "baseline_firms")]); titles$label <- sprintf("%s cohort: %s firms", outcome_names[titles$outcome], lab_n(titles$baseline_firms))
r$panel <- factor(titles$label[match(r$outcome, titles$outcome)], levels = titles$label[match(names(outcome_names), titles$outcome)])
top2$panel <- factor(titles$label[match(top2$outcome, titles$outcome)], levels = levels(r$panel))
usable$panel <- factor(titles$label[match(usable$outcome, titles$outcome)], levels = levels(r$panel))
usable$lab <- sprintf("%s usable", lab_pct(usable$usable_share, 0))
p <- ggplot(r, aes(year, 100 * baseline_share)) +
  geom_col(aes(fill = reason_label), width = 0.72, colour = "white", linewidth = 0.2) +
  geom_text(data = top2, aes(year, 100 * mid, label = lab), family = lab_font, size = lab_pt(10), colour = "white") +
  geom_text(data = usable, aes(year, 100 * (1 - usable_share) + 1.5, label = lab), family = lab_font, size = lab_pt(10),
            colour = lab_palette[["text"]], vjust = 0, angle = 90, hjust = 0) +
  scale_fill_manual(values = fills, breaks = names(fills)) +
  scale_y_continuous(limits = c(0, 75), breaks = seq(0, 75, 25), expand = c(0, 0)) +
  scale_x_continuous(breaks = 2019:2024, limits = c(2018.4, 2024.6), expand = c(0, 0)) +
  coord_cartesian(clip = "off") +
  facet_wrap(~ panel, ncol = 2) +
  labs(title = "Why 2021-cohort firms have no usable observation, 2019-2024",
       subtitle = "Share of the fixed 2021 baseline cohort (%) by reason; the vertical label gives the usable remainder",
       x = NULL, y = NULL, fill = NULL) +
  theme_lab() + theme(legend.position = "bottom", legend.direction = "vertical", legend.key.size = grid::unit(10, "pt"),
                      legend.text = element_text(size = 10), legend.margin = margin(0, 0, 0, 0))
notes <- paste(
  "Source: RFSD v3.1.0; saved Task 5 cohort observation accounting for the four outcome cohorts with the cash moderator. Each bar",
  "stacks the firms of the fixed 2021 baseline cohort that lack a comparable usable observation in that financial year, divided by",
  "the cohort size, by exhaustive reason; the remainder is usable. 2021 is 100 percent usable by construction. Years before 2021",
  "are backward observation of a cohort defined in 2021, not survival. No original statement is not evidence of non-submission or",
  "concealment. The four cohorts overlap and must not be summed. The appendix tabulates these counts; this is their picture.")
lab_save_figure(p, "A5-unusable-reasons", "20261007-sketch", height = 6.8, stage = "A",
  title = "Why 2021-cohort firms have no usable observation, 2019-2024",
  question = "Which loss dominates in each cash-moderator cohort before and after 2021: a missing required line or an absent original statement?",
  notes = notes, data = list(list(id = "A5-unusable-reasons", stage = "stage-a")))
