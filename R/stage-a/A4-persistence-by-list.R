# A4. Persistence by supplied list: among firms whose statement was available (or
# absent) last year, the share available next year and the share removed, listed
# versus not listed, by origin year and era. Source: transition membership denominators.
source(file.path(Sys.getenv("LAB_ROOT"), "R", "lab.R")); lab_init()
library(ggplot2)

tm <- lab_read_csv("acct.transition-membership-denominators")
tm$membership_level <- ifelse(is.na(tm$membership_level), "", as.character(tm$membership_level))
td <- lab_read_csv("acct.transition-denominators")
groups <- c("member_sanctioned", "member_putin_decree", "member_strateg_government", "member_strateg_putin", "administrative_union")
d <- tm[tm$membership_group %in% groups & tm$membership_level %in% c("0", "1"), ]
d$member <- d$membership_level == "1"
d$group <- factor(lab_group_names[d$membership_group], levels = lab_group_names[groups])
d$prior <- factor(ifelse(d$prior_absent == 1, "Previously absent", "Previously available"), levels = c("Previously available", "Previously absent"))
d$share_A <- d$A / d$R; d$share_X <- d$X / d$R; d$share_N <- d$N / d$R
d$supported <- d$R >= 50
d <- d[order(d$group, d$prior, d$member, d$origin_year), c("origin_year", "destination_year", "membership_group", "group", "prior", "member", "R", "A", "N", "X", "share_A", "share_N", "share_X", "supported")]
# Check: listed + not listed origins equal the all-origin denominators for the sanctioned list (unknown keys aside).
sums <- aggregate(R ~ origin_year + prior_absent, tm[tm$membership_group == "member_sanctioned" & tm$membership_level %in% c("0", "1"), ], sum)
chk <- merge(sums, td, by = c("origin_year", "prior_absent"))
checks <- data.frame(check = "sanctioned listed + not listed origins within 2 of all origins, every origin year and prior state",
                     expected = 0, observed = max(abs(chk$R - chk$origin_rows)), tolerance = 2)
lab_save_aggregate(d, "A4-persistence-by-list", "stage-a", checks = checks)

# Two figures: availability next year (A share) and recorded removal (X share).
d$era_group <- interaction(d$member, d$origin_year >= 2019)
make <- function(var, ylab, id, title, question) {
  d$y <- 100 * d[[var]]
  ends <- d[d$origin_year == 2024, ]
  ends$label <- sprintf("%s %s", ifelse(ends$member, "listed", "others"), lab_pct(ends[[var]], 0))
  p <- ggplot(d, aes(origin_year, y, group = era_group)) +
    lab_era_layers(0, 100, xmax = 2029.5, label_y = NULL) +
    geom_line(aes(colour = member, linewidth = member)) +
    geom_point(aes(colour = member, shape = supported, fill = member), size = 1.5) +
    ggrepel::geom_text_repel(data = ends, aes(x = 2024.4, y = y, label = label, colour = member), hjust = 0, direction = "y",
              segment.colour = NA, min.segment.length = Inf, box.padding = 0.1, family = lab_font, size = lab_pt(10), xlim = c(2024.4, 2029.5)) +
    scale_colour_manual(values = c(`TRUE` = lab_palette[["primary"]], `FALSE` = lab_palette[["neutral"]])) +
    scale_fill_manual(values = c(`TRUE` = lab_palette[["primary"]], `FALSE` = lab_palette[["neutral"]])) +
    scale_shape_manual(values = c(`TRUE` = 21, `FALSE` = 1)) +
    scale_linewidth_manual(values = c(`TRUE` = 0.8, `FALSE` = 0.55)) +
    scale_y_continuous(limits = c(0, 100), breaks = seq(0, 100, 50), expand = c(0, 0)) +
    scale_x_continuous(breaks = c(2012, 2016, 2020, 2024), limits = c(2011.5, 2029.5), expand = c(0, 0)) +
    coord_cartesian(clip = "off") +
    facet_grid(group ~ prior, switch = "y") +
    labs(title = title, subtitle = ylab, x = "Origin year", y = NULL) +
    theme_lab() + theme(strip.text.y.left = element_text(angle = 0, hjust = 1, face = "plain"), strip.placement = "outside",
                        panel.spacing.x = grid::unit(16, "pt"), panel.spacing.y = grid::unit(6, "pt"))
  p
}
pA <- make("share_A", "Share of origin firms with an original statement next year (%); hollow points mark fewer than 50 listed origins",
           "A4-availability-next-year-by-list", "Availability next year, listed firms versus others, by prior state and era",
           "Do listed firms that reported keep reporting, and do absent listed firms reappear, compared with other firms, in each era?")
pX <- make("share_X", "Share of origin firms with a recorded registry removal next year (%); hollow points mark fewer than 50 listed origins",
           "A4-removal-next-year-by-list", "Recorded removal next year, listed firms versus others, by prior state and era",
           "Are listed firms removed from the register at different rates than other firms, by prior availability?")
notes_common <- paste(
  "Source: RFSD v3.1.0, foundation transition accounting by supplied membership. Origins are eligible firms registered at the",
  "preceding year-end, split by prior original availability and by exact membership in the named supplied file; the others line",
  "includes members of the other lists. Panels are not additive across lists. Hollow points have fewer than 50 origins. Removal",
  "takes precedence over a dissolution-year statement; a missing destination row is not an exit. No transition crosses the 2018 to",
  "2019 provider change (shaded). Lists are fixed supplied files, not dated designations. Descriptive associations only.")
lab_save_figure(pA, "A4-availability-next-year-by-list", "20261007-sketch", height = 7, stage = "A",
  title = "Availability next year, listed firms versus others, by prior state and era",
  question = "Do listed firms that reported keep reporting, and do absent listed firms reappear, compared with other firms, in each era?",
  notes = notes_common, data = list(list(id = "A4-persistence-by-list", stage = "stage-a")))
lab_save_figure(pX, "A4-removal-next-year-by-list", "20261007-sketch", height = 7, stage = "A",
  title = "Recorded removal next year, listed firms versus others, by prior state and era",
  question = "Are listed firms removed from the register at different rates than other firms, by prior availability?",
  notes = notes_common, data = list(list(id = "A4-persistence-by-list", stage = "stage-a")))
