# Shared by M9 (addresses) and M11 (cells and regions), round 9 (author's request, 25 October 2026): the nine industry
# classes, the 88 two-digit divisions, their English titles (Eurostat's NACE Rev. 2 codelist, pinned; OKVED 2 mirrors the
# two-digit codes), the SQL expression that maps a firm-year's industry2 to a division byte, and the tables both outputs embed.
# Byte encoding of a division (ind, u8): 1 to 99 the division code, 0 no OKVED 2 division code (class Other), 255 no firm
# with a statement and a positive revenue value (slot 0, "unknown", neutral on the page).
IND_CLASSES <- data.frame(id = 1:9, stringsAsFactors = FALSE,
  label = c("Agriculture, extraction and energy", "Manufacturing", "Construction", "Trade", "Transport and logistics",
            "Finance and real estate", "Professional services", "Public and social", "Other"))
IND_CLASS_DIVS <- list(c(1:3, 5:9, 35), 10:33, 41:43, 45:47, 49:53, c(64:66, 68), c(58:63, 69:75, 77:82), 84:88, c(36:39, 55, 56, 90:99))
IND_DIVS <- sort(unlist(IND_CLASS_DIVS))
stopifnot(length(IND_DIVS) == 88L, !anyDuplicated(IND_DIVS), all(IND_DIVS >= 1 & IND_DIVS <= 99))
IND_CLASS_DIVS_TEXT <- c("01 to 03, 05 to 09, 35", "10 to 33", "41 to 43", "45 to 47", "49 to 53", "64 to 66, 68", "58 to 63, 69 to 75, 77 to 82", "84 to 88",
                         "36 to 39, 55, 56, 90 to 99, and firms without a division code")
# Nine class colours. Round 10 (26 October 2026): the author's nine lit hues (amber, electric blue, orange, soft teal, yellow, violet,
# lavender grey, ice, slate), each moved inside its semantic window by the lab validator's coordinate search on the land #172A45 so that
# every pair among the nine, the neutral #B5C3D1 and the listed red is at least 13.9 normal and 8.5 colour-vision apart (the warm trio
# and the red share one lightness axis, the cool cluster, the neutral and the slate another; the legend and the tile name the class
# as the secondary encoding; the figures are in motion/README.md). Rounds 9: ColorBrewer qualitative hues nudged the same way.
IND_COLOURS_DARK <- c("#E8B533", "#2882F9", "#ED7D43", "#4CB3A4", "#FBEB87", "#E090FD", "#9887C7", "#ECF4FE", "#6D747A")
IND_COLOURS_LIGHT <- c("#936E16", "#2550B4", "#973001", "#1A7F7A", "#6D6816", "#7B3FD1", "#5D4E78", "#537A9B", "#5B6470")   # the light theme: darker hues at 3:1 or more on the cream, chosen by the same search; the warm family is too close to the red under deutan vision there
# NACE Rev. 2 sections by division range, for the check that the codelist's section letters agree.
IND_SECTIONS <- list(A = 1:3, B = 5:9, C = 10:33, D = 35, E = 36:39, F = 41:43, G = 45:47, H = 49:53, I = 55:56, J = 58:63, K = 64:66, L = 68,
                     M = 69:75, N = 77:82, O = 84, P = 85, Q = 86:88, R = 90:93, S = 94:96, T = 97:98, U = 99)
IND_LEGACY <- c("__MISSING__", "00", "34", "40", "57")   # codes seen in the registry that are no OKVED 2 division (recorded, not reinterpreted)

ind_class_of <- function(div) {   # 0 -> Other (9); 255 -> 0 (unknown); a division -> its class
  div <- as.integer(div); cls <- integer(length(div))
  for (i in seq_along(IND_CLASS_DIVS)) cls[div %in% IND_CLASS_DIVS[[i]]] <- i
  cls[div == 0L] <- 9L; cls[div == 255L] <- 0L; cls
}
ind_div_sql <- function(col = "industry2") sprintf("CASE WHEN TRY_CAST(%s AS INTEGER) IN (%s) THEN TRY_CAST(%s AS INTEGER) ELSE 0 END", col, paste(IND_DIVS, collapse = ", "), col)
ind_pad <- function(div) sprintf("%02d", as.integer(div))

# The 88 titles: Eurostat's codelist when pinned, else the archived OKVED 2 dictionary's English names (stated as such).
ind_titles <- function() {
  nace <- tryCatch(lab_source("motion.nace-rev2-codelist"), error = function(e) NULL)
  if (!is.null(nace)) {
    tsv <- utils::read.delim(nace, header = FALSE, quote = "", sep = "\t", encoding = "UTF-8", stringsAsFactors = FALSE, col.names = c("code", "title"), colClasses = "character")
    d <- tsv[grepl("^[A-U][0-9]{2}$", tsv$code), ]
    d <- data.frame(div = as.integer(substr(d$code, 2, 3)), section = substr(d$code, 1, 1), title = trimws(d$title), stringsAsFactors = FALSE)
    source_txt <- "Eurostat, NACE Rev. 2 codelist NACE_R2 version 20.1 (dissemination API, retrieved 2026-10-25); OKVED 2 (OK 029-2014) uses the same two-digit codes"
    source_kind <- "nace"
  } else {
    x <- readxl::read_xlsx(lab_source("motion.okved-names"), col_types = "text")
    code <- trimws(x[[1]]); keep <- grepl("^[0-9]{2}$", code)
    d <- data.frame(div = as.integer(code[keep]), section = NA_character_, title = trimws(x[[2]][keep]), stringsAsFactors = FALSE)
    source_txt <- "archived OKVED 2 dictionary (English names); Eurostat's NACE Rev. 2 titles were not available"
    source_kind <- "okved"
  }
  cw <- utils::read.csv(lab_source("motion.classifier-crosswalk"), stringsAsFactors = FALSE, encoding = "UTF-8", colClasses = "character")
  cw <- cw[cw$dimension == "industry", ]
  cw$div <- as.integer(cw$source_code); cw$short <- sub("^[0-9]{2}\\s+", "", cw$display_label)
  sec_ok <- if (source_kind == "nace") vapply(seq_len(nrow(d)), function(i) d$div[i] %in% IND_SECTIONS[[d$section[i]]], NA) else rep(TRUE, nrow(d))
  checks <- motion_checks(
    motion_check("industry: 88 divisions in the English title table", 88, nrow(d)),
    motion_check("industry: 88 divisions in the OKVED 2 crosswalk", 88, nrow(cw)),
    motion_check("industry: the two code sets coincide (symmetric difference)", 0, length(union(setdiff(d$div, cw$div), setdiff(cw$div, d$div)))),
    motion_check("industry: the code set equals the lab's 88 divisions", 0, length(union(setdiff(d$div, IND_DIVS), setdiff(IND_DIVS, d$div)))),
    motion_check("industry: every codelist section letter agrees with the division's NACE range", 0, sum(!sec_ok)),
    motion_check("industry: every title and short label non-empty", 0, sum(!nzchar(d$title)) + sum(!nzchar(cw$short))))
  tab <- merge(d, cw[, c("div", "short", "official_label")], by = "div", all.x = TRUE)
  tab <- tab[order(tab$div), ]
  tab$class <- ind_class_of(tab$div)
  list(table = tab, checks = checks, source = source_txt, kind = source_kind)
}

# The block both outputs embed (no key named name or names: the guards refuse those outside the listed-firm files).
ind_tables <- function(titles) {
  t <- titles$table
  list(divisions = list(code = ind_pad(t$div), title = t$title, short = t$short, class = as.integer(t$class)),
       classes = list(id = IND_CLASSES$id, label = IND_CLASSES$label, divisions = IND_CLASS_DIVS_TEXT, colour_dark = IND_COLOURS_DARK, colour_light = IND_COLOURS_LIGHT),
       encoding = "ind (u8): 1 to 99 the two-digit division, 0 no OKVED 2 division code (class Other), 255 no firm with a statement and a positive revenue value (unknown, neutral); shares are integer percent of nominal revenue (line 2110) within the year",
       division_titles_source = titles$source,
       equivalence = paste("OKVED 2 (OK 029-2014, Rosstat order of 31 January 2014) is built on NACE Rev. 2 with identical codes through four digits and national",
                           "extensions at five and six digits; at the two-digit level the 88 division codes coincide (checked against the programming project's OKVED 2",
                           "crosswalk, motion.classifier-crosswalk, from Rosstat's OKVED2 download recorded in motion.classifier-sources); titles are translations and",
                           "differ in emphasis (division 84's Russian title names military security and compulsory social insurance); known departures lie below the",
                           "two-digit level and do not affect this layer. Codes outside OKVED 2 seen in the registry (__MISSING__, 00, 34, 40, 57) carry pseudo-division 0."),
       legacy_codes = IND_LEGACY,
       sources = c("motion.nace-rev2-codelist", "motion.nace-rev2-sdmx", "motion.classifier-crosswalk", "motion.classifier-sources"))
}
