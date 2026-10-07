# One theme, one palette, the house era layers and label helpers.
# Colors are the manuscript's current palette (programming/R/chapter2-task5-exhibits.R).

lab_palette <- c(primary = "#2166AC", comparison = "#B35832", neutral = "#657680",
                 text = "#24323D", axis_text = "#43515A", axis = "#56636C",
                 grid = "#E3E7E9", era = "#F3F5F6", tick = "#C4CDD2", era_label = "#66747D",
                 cash = "#1B7837", borrowing = "#762A83", unsupported = "#D9DEE2")
lab_okabe <- c("#0072B2", "#D55E00", "#009E73", "#CC79A7", "#E69F00", "#56B4E9", "#F0E442", "#000000")
lab_font <- "Nimbus Sans"
lab_min_pt <- 10

# Sequential single-hue ramp (light to primary blue) and diverging brick-white-blue.
lab_seq <- function(n = 7) grDevices::colorRampPalette(c("#EAF1F8", "#9DBCDB", lab_palette[["primary"]], "#0B3D6E"))(n)
lab_div <- function(n = 9) grDevices::colorRampPalette(c(lab_palette[["comparison"]], "#F7F7F5", lab_palette[["primary"]]))(n)

# Text sizes in points: ggplot2 geom text sizes are in mm, so divide by .pt.
lab_pt <- function(pt) pt / ggplot2::.pt

theme_lab <- function(base_size = 10.5, grid_y = TRUE, grid_x = FALSE) {
  t <- ggplot2::theme_minimal(base_size = base_size, base_family = lab_font) +
    ggplot2::theme(
      text = ggplot2::element_text(colour = lab_palette[["text"]], family = lab_font),
      axis.text = ggplot2::element_text(size = 10, colour = lab_palette[["axis_text"]]),
      axis.title = ggplot2::element_text(size = 10.5, colour = lab_palette[["text"]]),
      axis.ticks = ggplot2::element_line(colour = lab_palette[["axis"]], linewidth = 0.3),
      axis.ticks.length = grid::unit(2, "pt"),
      panel.grid.minor = ggplot2::element_blank(),
      panel.grid.major.x = if (grid_x) ggplot2::element_line(colour = lab_palette[["grid"]], linewidth = 0.3) else ggplot2::element_blank(),
      panel.grid.major.y = if (grid_y) ggplot2::element_line(colour = lab_palette[["grid"]], linewidth = 0.3) else ggplot2::element_blank(),
      strip.text = ggplot2::element_text(size = 10.5, face = "bold", hjust = 0, colour = lab_palette[["text"]],
                                         margin = ggplot2::margin(b = 3)),
      strip.background = ggplot2::element_blank(),
      plot.title = ggplot2::element_text(size = 12, face = "bold", hjust = 0, margin = ggplot2::margin(b = 2)),
      plot.subtitle = ggplot2::element_text(size = 10.5, colour = lab_palette[["neutral"]], margin = ggplot2::margin(b = 6)),
      plot.caption = ggplot2::element_text(size = 10, colour = lab_palette[["neutral"]], hjust = 0),
      plot.title.position = "plot", plot.caption.position = "plot",
      legend.position = "none",
      legend.text = ggplot2::element_text(size = 10), legend.title = ggplot2::element_text(size = 10),
      panel.spacing = grid::unit(10, "pt"),
      plot.margin = ggplot2::margin(6, 12, 6, 6),
      plot.background = ggplot2::element_rect(fill = "white", colour = NA))
  t
}

# FNS-era shading from 2018.5 and dotted context ticks at 2014, 2020 and 2022,
# as in the production figures. Add first so data draw on top.
lab_era_layers <- function(ymin = -Inf, ymax = Inf, xmax = 2025.5, label_y = NULL, ticks = c(2014, 2020, 2022), labels = c("Rosstat", "FNS")) {
  layers <- list(
    ggplot2::annotate("rect", xmin = 2018.5, xmax = xmax, ymin = ymin, ymax = ymax,
                      fill = lab_palette[["era"]], colour = NA),
    ggplot2::geom_vline(xintercept = ticks, colour = lab_palette[["tick"]], linetype = "dotted", linewidth = 0.4))
  if (!is.null(label_y) && !is.null(labels)) {
    lab_df <- data.frame(x = c(2015, 2022), y = label_y, label = labels)
    layers <- c(layers, list(ggplot2::geom_text(data = lab_df, ggplot2::aes(x = x, y = y, label = label),
                                                inherit.aes = FALSE, colour = lab_palette[["era_label"]],
                                                family = lab_font, size = lab_pt(10), hjust = 0.5)))
  }
  layers
}

lab_x_years <- function(from = 2011, to = 2025, flag_2025 = TRUE, breaks = c(2011, 2014, 2017, 2020, 2022, 2025)) {
  lab <- as.character(breaks); if (flag_2025) lab[breaks == 2025] <- "2025*"
  ggplot2::scale_x_continuous(breaks = breaks, labels = lab, limits = c(from - 0.3, to + 0.5), expand = c(0, 0))
}

lab_pct <- function(x, digits = 1) ifelse(is.na(x), "", paste0(formatC(100 * x, format = "f", digits = digits), " %"))
lab_n <- function(x) ifelse(is.na(x), "", format(round(x), big.mark = ",", trim = TRUE, scientific = FALSE))

# Direct end labels; ggrepel if present (installed by scripts/setup-lib.sh), plain text otherwise.
lab_end_labels <- function(data, mapping, nudge_x = 0.15, size_pt = 10, colour = lab_palette[["text"]], ...) {
  if (requireNamespace("ggrepel", quietly = TRUE)) {
    ggrepel::geom_text_repel(data = data, mapping = mapping, nudge_x = nudge_x, hjust = 0, direction = "y",
                             segment.colour = NA, family = lab_font, size = lab_pt(size_pt), colour = colour,
                             box.padding = 0.1, min.segment.length = Inf, ...)
  } else {
    ggplot2::geom_text(data = data, mapping = mapping, nudge_x = nudge_x, hjust = 0, family = lab_font,
                       size = lab_pt(size_pt), colour = colour, ...)
  }
}

# Readable group names for the five supplied lists and the derived groups.
lab_group_names <- c(
  member_sanctioned = "Sanctioned list", member_putin_decree = "Decree list", member_residents = "Residents list",
  member_strateg_government = "Government strategic list", member_strateg_putin = "Presidential strategic list",
  administrative_union = "Any administrative list", administrative_pattern = "Administrative pattern",
  `00000` = "None of the five lists", `10000` = "Sanctioned only", `00010` = "Government strategic only",
  `10010` = "Sanctioned + government strategic", `11000` = "Sanctioned + decree")
