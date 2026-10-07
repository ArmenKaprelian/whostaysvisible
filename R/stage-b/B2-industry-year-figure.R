# B2 figure: industry x year availability as a numbers-in-cells heatmap for industries with at
# least 1 % of 2021 eligible records, plus the 2018-to-2019 provider-change jump per industry.
source(file.path(Sys.getenv("LAB_ROOT"), "R", "lab.R")); lab_init()
library(ggplot2)

d <- lab_read_aggregate("B2-industry-year", "stage-b")
code <- suppressWarnings(as.integer(d$industry2))
d$industry2 <- ifelse(is.na(code), "__MISSING__", sprintf("%02d", code))   # missing and malformed classes together
d <- aggregate(cbind(eligible_rows, eligible_available) ~ year + industry2, d, sum)
industry_names <- c(`01` = "Agriculture", `10` = "Food products", `25` = "Metal products",
  `33` = "Machinery repair", `41` = "Building construction", `42` = "Civil engineering",
  `43` = "Specialised construction", `45` = "Motor trade and repair", `46` = "Wholesale trade",
  `47` = "Retail trade", `49` = "Land transport", `52` = "Transport support", `56` = "Food services",
  `62` = "Computer programming", `64` = "Financial services", `68` = "Real estate",
  `69` = "Legal and accounting", `70` = "Head offices / consulting", `71` = "Architecture / engineering",
  `73` = "Advertising / research", `74` = "Other professional", `77` = "Rental / leasing",
  `79` = "Travel services", `93` = "Sports / recreation", `81` = "Building / landscape services",
  `82` = "Business support", `85` = "Education", `86` = "Human health", `94` = "Membership organisations",
  `95` = "Computer / goods repair", `96` = "Other personal services", `__MISSING__` = "Industry missing")
pop21 <- d[d$year == 2021, ]; tot21 <- sum(pop21$eligible_rows)
big <- pop21$industry2[pop21$eligible_rows / tot21 >= 0.01 & pop21$industry2 != "__MISSING__"]
d$row <- ifelse(d$industry2 %in% big, d$industry2, ifelse(d$industry2 == "__MISSING__", "__MISSING__", "__OTHER__"))
h <- aggregate(cbind(eligible_rows, eligible_available) ~ year + row, d, sum)
h$rate <- ifelse(h$year == 2011, NA, h$eligible_available / h$eligible_rows)
h$supported <- h$eligible_rows >= 50
n_other <- length(setdiff(unique(d$industry2), c(big, "__MISSING__")))
nm <- c(industry_names, `__OTHER__` = sprintf("%d other industries, pooled", n_other))
lab_of <- function(r) ifelse(r %in% names(nm), paste0(ifelse(grepl("^[0-9]", r), paste0(r, "  "), ""), nm[r]), paste0("OKVED ", r))
r21 <- h[h$year == 2021, ]
r21$label <- NULL
ind_order <- r21$row[order(-r21$rate)]; ind_order <- ind_order[!ind_order %in% c("__OTHER__", "__MISSING__")]
order_rows <- c(ind_order, "__OTHER__", "__MISSING__")          # top to bottom
h$label <- factor(lab_of(h$row), levels = rev(lab_of(order_rows)))
jump <- merge(h[h$year == 2018, c("row", "rate")], h[h$year == 2019, c("row", "rate")], by = "row", suffixes = c("_2018", "_2019"))
jump$jump_pp <- 100 * (jump$rate_2019 - jump$rate_2018)
side <- merge(r21[, c("row", "eligible_rows", "rate")], jump[, c("row", "jump_pp")], by = "row")
side$share21 <- side$eligible_rows / tot21
side$label <- factor(lab_of(side$row), levels = levels(h$label))
out <- h[, c("year", "row", "label", "eligible_rows", "eligible_available", "rate", "supported")]
lab_save_aggregate(out, "B2-industry-heatmap", "stage-b")
lab_save_aggregate(side, "B2-industry-side", "stage-b")

h$txt <- ifelse(is.na(h$rate), "", sprintf("%.0f", 100 * h$rate))
h$txt_col <- ifelse(!is.na(h$rate) & h$rate > 0.62, "white", lab_palette[["text"]])
p <- ggplot(h[h$year >= 2012, ], aes(year, label)) +
  geom_tile(aes(fill = 100 * rate), colour = "white", linewidth = 0.6) +
  geom_tile(data = h[h$year >= 2012 & !h$supported, ], fill = lab_palette[["unsupported"]], colour = "white", linewidth = 0.6) +
  geom_text(aes(label = txt, colour = txt_col), family = lab_font, size = lab_pt(10)) +
  geom_text(data = side, aes(x = 2026.6, y = label, label = sprintf("%+.0f", jump_pp)), hjust = 1, family = lab_font, size = lab_pt(10),
            colour = ifelse(side$jump_pp < 0, lab_palette[["comparison"]], lab_palette[["primary"]])) +
  geom_text(data = side, aes(x = 2029.6, y = label, label = sprintf("%.1f %%", 100 * share21)), hjust = 1, family = lab_font, size = lab_pt(10), colour = lab_palette[["neutral"]]) +
  annotate("text", x = 2026.6, y = length(order_rows) + 0.9, label = "2018→19\nchange, pp", hjust = 1, vjust = 0, family = lab_font, size = lab_pt(10), colour = lab_palette[["neutral"]], lineheight = 0.9) +
  annotate("text", x = 2029.6, y = length(order_rows) + 0.9, label = "Share of\n2021 firms", hjust = 1, vjust = 0, family = lab_font, size = lab_pt(10), colour = lab_palette[["neutral"]], lineheight = 0.9) +
  annotate("segment", x = 2018.5, xend = 2018.5, y = 0.5, yend = length(order_rows) + 0.5, colour = lab_palette[["text"]], linewidth = 0.5) +
  scale_fill_gradientn(colours = lab_seq(9), limits = c(20, 90), oob = scales::squish, na.value = "white", name = "%") +
  scale_colour_identity() +
  scale_x_continuous(breaks = c(2012, 2015, 2018, 2021, 2024), limits = c(2011.4, 2030), expand = c(0, 0)) +
  scale_y_discrete(expand = expansion(add = c(0.6, 2.4))) +
  coord_cartesian(clip = "off") +
  labs(title = "Original availability by industry and financial year, 2012-2025",
       subtitle = "Share of eligible records with an original statement (%); industries with at least 1 % of 2021 eligible\nfirms, sorted by the 2021 value. The vertical rule marks the 2019 provider change.",
       x = NULL, y = NULL) +
  theme_lab(grid_y = FALSE) + theme(legend.position = "none", axis.text.y = element_text(hjust = 1), axis.ticks = element_blank())
notes <- paste(
  "Source: RFSD v3.1.0; lab aggregation of the foundation registry by released two-digit OKVED class and financial year. Cells show",
  "eligible records with an original statement as a percentage of eligible records; darker blue is higher on a 20 to 90 scale.",
  "Industries holding at least 1 percent of 2021 eligible records are listed; the remaining classes are pooled in one row and records",
  "with a missing class in another. The 2018 to 2019 change coincides with the Rosstat to FNS provider change and is a measurement",
  "break, not industry behaviour. 2011 has no original statements and is not shown; 2025 is the flagged latest year. Descriptive.")
lab_save_figure(p, "B2-industries", "20261007-sketch", height = 7, stage = "B",
  title = "Original availability by industry and financial year, 2012-2025",
  question = "Which industries drive the level of availability, which moved in 2022, and how large was the provider break per industry?",
  notes = notes, data = list(list(id = "B2-industry-heatmap", stage = "stage-b"), list(id = "B2-industry-side", stage = "stage-b")))
