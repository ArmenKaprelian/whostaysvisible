# Shared by M6 (rasters, treated firms, anchors) and M7 (Moscow cells, comparison groups): the Moscow
# extents, the deflator and sanctions inputs, the firm-year temp tables and the class rule. Sourced as
# a fragment after `con` exists (round 3, 23 October 2026); one SQL text, so both passes build the
# same tables. M6 is never sourced whole: it deletes and rewrites the rasters.
years <- 2014:2025
ARGS <- commandArgs(trailingOnly = TRUE)   # [variant] [metric] [look] [scope]; the launcher's unit drops environment variables
basemap <- motion_read_json("basemap")
cities <- as.data.frame(basemap$cities, stringsAsFactors = FALSE)
MX <- cities$x_km[cities$label == "Moscow"]; MY <- cities$y_km[cities$label == "Moscow"]
exec <- function(sql, label) { t0 <- proc.time()[["elapsed"]]; DBI::dbExecute(con, sql); message(sprintf("  %s: %.1f s", label, proc.time()[["elapsed"]] - t0)) }
pq <- function(names) { paths <- vapply(names, lab_source, character(1), verify_hash = FALSE); sprintf("read_parquet([%s], hive_partitioning = false)", paste0("'", gsub("'", "''", paths, fixed = TRUE), "'", collapse = ", ")) }
q <- function(x) paste0("'", gsub("'", "''", x, fixed = TRUE), "'")

# ---- extents (16:9 km rectangles; the page draws each 1:1 at its k) -----------------------------
# Round 3: the downtown mark cap drops from 14 to 11 px (less clutter in the dense field).
EXT <- list(region = list(h = 90, k = 12, mark = list(base = 1, s = 0.2, cap = 3)),
            city = list(h = 36, k = 30, mark = list(base = 2, s = 0.6, cap = 8)),
            downtown = list(h = 12, k = 90, mark = list(base = 3, s = 1.1, cap = 11)))
for (n in names(EXT)) { e <- EXT[[n]]; e$w <- e$h * 16 / 9; e$xmin <- MX - e$w / 2; e$xmax <- MX + e$w / 2; e$ymin <- MY - e$h / 2; e$ymax <- MY + e$h / 2; EXT[[n]] <- e }
R <- EXT$region
# Scope (round 4, 23 October 2026): the fourth trailing argument. "moscow" (the default) builds the tables
# inside the region rectangle, as M6 and M7 do; "national" builds them inside the national rectangle of
# the explainer's left framing (k = 0.168 px per km, the map centre at 700/560 on the 1920 x 1080 stage,
# so one pixel is 1/0.168 = 5.95 km), the rest camera of the national year run (M8). That rectangle
# contains the basemap's national extent, so every located firm lies inside it, and the yearly median
# of the relative metric is then the median of the drawn firms on no list nationwide.
SCOPE <- tolower(if (length(ARGS) >= 4) ARGS[4] else "moscow")
if (!SCOPE %in% c("moscow", "national")) stop("the scope must be moscow or national")
NATCAM <- list(cx = mean(basemap$extents$national$x), cy = mean(basemap$extents$national$y), k = 0.168, ox = 700, oy = 560)
NAT <- list(k = NATCAM$k, w = 1920 / NATCAM$k, h = 1080 / NATCAM$k, xmin = NATCAM$cx - NATCAM$ox / NATCAM$k, xmax = NATCAM$cx + (1920 - NATCAM$ox) / NATCAM$k,
            ymax = NATCAM$cy + NATCAM$oy / NATCAM$k, ymin = NATCAM$cy - (1080 - NATCAM$oy) / NATCAM$k, mark = list(base = 2, s = 0, cap = 2), camera = NATCAM)
if (SCOPE == "national") R <- NAT

# ---- deflator (WDI NY.GDP.DEFL.ZS.AD, Russia), rebased to 2021 = 1 -----------------------------
wdi <- utils::read.csv(lab_source("motion.deflator"), skip = 4, check.names = FALSE, stringsAsFactors = FALSE)
rus <- wdi[wdi$`Country Code` == "RUS", ]
if (nrow(rus) != 1) stop("deflator: Russia row not found")
idx <- as.numeric(rus[1, as.character(2011:2025)])
deflator <- data.frame(year = 2011:2025, index = idx, defl = idx / idx[2021 - 2010])
# Real values are nominal values divided by this index (2021 rubles), the programming convention; until 25 October 2026
# the lab multiplied, which inverted the time direction of every real series (corrected in round 9).
DBI::dbWriteTable(con, "deflator", deflator[, c("year", "defl")], temporary = TRUE, overwrite = TRUE)

# ---- sanctions list: one row per INN with the earliest start date and that row's inferred flag ----
san <- utils::read.csv(lab_source("motion.sanctioned-list"), stringsAsFactors = FALSE, colClasses = "character", encoding = "UTF-8")
san$inn <- trimws(san$inn); san <- san[nzchar(san$inn), ]
san$start_year <- as.integer(substr(san$startDate, 1, 4)); san$inferred <- san$startDate_inferred == "1"
san <- san[order(san$inn, san$startDate), ]
san_first <- san[!duplicated(san$inn), c("inn", "start_year", "inferred", "countries", "name", "name_alt")]
san_first$countries_all <- vapply(split(san$countries, san$inn)[san_first$inn], function(v) { tok <- unlist(strsplit(v, "[|[:space:]]+")); paste(sort(unique(tok[nzchar(tok)])), collapse = " ") }, "")   # the file writes "gb | us"
DBI::dbWriteTable(con, "san", san_first[, c("inn", "start_year", "inferred", "countries_all")], temporary = TRUE, overwrite = TRUE)

# ---- listed firms' names (author's rule, 25 October 2026): the decree and government strategic workbooks' name columns,
# then the sanctions file's name; one display name per INN through motion_display_names() (motion-common.R); into DuckDB as
# listnames for the treated queries. The identifier stays in R memory and the in-memory database, as san does.
read_list_xlsx <- function(src) {
  x <- readxl::read_xlsx(lab_source(src), col_types = "list")
  cell <- function(v) vapply(v, function(c) if (is.null(c) || (length(c) == 1L && is.na(c))) "" else if (is.numeric(c)) format(c, scientific = FALSE, trim = TRUE, digits = 17L) else trimws(as.character(c)), "")
  data.frame(inn = trimws(cell(x$inn)), raw = cell(x$name), stringsAsFactors = FALSE)
}
ln_decree <- read_list_xlsx("motion.putin-decree-list"); ln_decree$source <- "decree"
ln_gov <- read_list_xlsx("motion.strateg-government"); ln_gov$source <- "government"
ln_san <- data.frame(inn = san_first$inn, raw = san_first$name, source = "sanctions", stringsAsFactors = FALSE)
ln <- rbind(ln_decree, ln_gov, ln_san); ln <- ln[nzchar(ln$inn) & nzchar(trimws(ln$raw)), ]
ln <- ln[order(match(ln$source, c("decree", "government", "sanctions"))), ]; ln <- ln[!duplicated(ln$inn), ]
ln_alias <- lapply(san_first$name_alt[match(ln$inn, san_first$inn)], function(a) if (is.na(a) || !nzchar(a)) character() else trimws(strsplit(a, " | ", fixed = TRUE)[[1]]))
LIST_NAMES <- cbind(ln, motion_display_names(ln$raw, ln_alias), stringsAsFactors = FALSE)
DBI::dbWriteTable(con, "listnames", LIST_NAMES[, c("inn", "name", "name_filed", "name_case", "name_shared")], temporary = TRUE, overwrite = TRUE)
message(sprintf("  list names: %d members, %d named (decree %d, government %d, sanctions %d); cases: alias %d, transliterated %d, Latin as filed %d; shared display names: %d firms",
                nrow(LIST_NAMES), sum(nzchar(LIST_NAMES$name)), sum(LIST_NAMES$source == "decree"), sum(LIST_NAMES$source == "government"), sum(LIST_NAMES$source == "sanctions"),
                sum(LIST_NAMES$name_case == 1), sum(LIST_NAMES$name_case == 2), sum(LIST_NAMES$name_case == 3), sum(LIST_NAMES$name_shared > 1)))
sims <- LIST_NAMES$similarity[!is.na(LIST_NAMES$similarity)]
message(sprintf("  alias similarity (Cyrillic cores with Latin aliases, %d): at least 0.90 %d, 0.85 to 0.90 %d, 0.80 to 0.85 %d, below 0.80 %d",
                length(sims), sum(sims >= 0.9), sum(sims >= 0.85 & sims < 0.9), sum(sims >= 0.8 & sims < 0.85), sum(sims < 0.8)))
motion_name_checks <- function(tr) {
  r <- LIST_NAMES$name[match(tr$inn_key, LIST_NAMES$inn)]; r[is.na(r)] <- ""
  motion_checks(
    motion_check("names: one per firm", nrow(tr), length(tr$name)),
    motion_check("names: the DuckDB join equals an R match against the list files (differences)", 0, sum(r != tr$name)),
    motion_check("names: no run of nine or more digits", 0, sum(grepl("[0-9]{9,}", tr$name))),
    motion_check("names: no display equals a list identifier", 0, sum(tr$name %in% LIST_NAMES$inn)),
    motion_check("names: no personal name of an entrepreneur", 0, sum(grepl(", IP$", tr$name))),
    motion_check("names: unnamed firms at most 54", 1, as.integer(sum(!nzchar(tr$name)) <= 54)),
    motion_check("names: every display within 60 characters", 0, sum(nchar(tr$name) > 60)),
    motion_check("names: no control characters or angle brackets", 0, sum(grepl("[[:cntrl:]<>]", tr$name))),
    motion_check("names: shared count at least 1 when named", 0, sum(nzchar(tr$name) & tr$name_shared < 1)),
    motion_check("lists: every treated firm carries at least one membership code", 0, sum(!nzchar(tr$lists))),
    motion_check("lists: only the codes s, d, r, g, p in that order", 0, sum(!grepl("^s?d?r?g?p?$", tr$lists))))
}
motion_names_summary <- function(tr) {
  sims <- LIST_NAMES$similarity[match(tr$inn_key, LIST_NAMES$inn)]; sims <- sims[!is.na(sims)]
  list(named = sum(nzchar(tr$name)), unnamed = sum(!nzchar(tr$name)),
       by_case = list(alias = sum(tr$name_case == 1), transliterated = sum(tr$name_case == 2), latin_as_filed = sum(tr$name_case == 3)),
       by_source = as.list(table(factor(LIST_NAMES$source[match(tr$inn_key, LIST_NAMES$inn)], levels = c("decree", "government", "sanctions")))),
       shared_firms = sum(tr$name_shared > 1), capped = sum(LIST_NAMES$capped[match(tr$inn_key, LIST_NAMES$inn)], na.rm = TRUE), threshold = 0.85,
       alias_similarity = list(n = length(sims), ge_090 = sum(sims >= 0.9), s085_090 = sum(sims >= 0.85 & sims < 0.9), s080_085 = sum(sims >= 0.8 & sims < 0.85), lt_080 = sum(sims < 0.8)),
       scheme = "BGN/PCGN 1947 (Russian), plain form",
       rule = "the core name without its legal-form phrase, quotes and region qualifier, with the legal form abbreviated after a comma (Russian forms transliterated: AO, PAO, OOO, ZAO, OAO, FGUP, GUP, IP; English sources keep LLC, JSC, PJSC, Ltd); Latin on screen: the sanctions file's alias that transliterates the filed Cyrillic core (case 1), else our transliteration (case 2), else the Latin name as filed (case 3); 60 characters at most; name_filed is the full filed name")
}

# ---- firm-years inside the region rectangle, 2014-2025 ------------------------------------------
# One SQL text per year (the nationwide join of twelve years in one statement exceeds the DuckDB memory
# grant; the union of the per-year selects is the same table), inserted into fy_all year by year.
fy_year_sql <- function(y) sprintf("
  WITH r AS (SELECT year, source_row, inn_key, original_available, creation_date_reconciled, industry2, legal_form, ownership_form,
                    coalesce(member_sanctioned, 0) + coalesce(member_putin_decree, 0) + coalesce(member_strateg_government, 0) + coalesce(member_strateg_putin, 0) AS other_lists,
                    coalesce(member_residents, 0) AS residents
             FROM %s WHERE eligible_raw = 1),
       p AS (SELECT year, source_row, lon, lat, geocoding_quality, line_2110, line_1600 FROM %s),
       j AS (SELECT r.*, p.lon, p.lat, p.geocoding_quality, p.line_2110, p.line_1600 FROM r JOIN p USING (year, source_row)),
       a AS (SELECT *, coalesce(isfinite(lon) AND isfinite(lat) AND lon BETWEEN -180 AND 180 AND lat BETWEEN -90 AND 90, false) AS bounds_valid,
                    lat * pi() / 180 AS phi, ((lon - 100 + 180) - 360 * floor((lon - 100 + 180) / 360) - 180) * pi() / 180 AS dl FROM j),
       b AS (SELECT *, 1 + sin(pi() / 3) * sin(phi) + cos(pi() / 3) * cos(phi) * cos(dl) AS den FROM a),
       c AS (SELECT *, CASE WHEN bounds_valid AND den > 1e-12 THEN 6371 * sqrt(2 / den) * cos(phi) * sin(dl) END AS x_km,
                    CASE WHEN bounds_valid AND den > 1e-12 THEN 6371 * sqrt(2 / den) * (cos(pi() / 3) * sin(phi) - sin(pi() / 3) * cos(phi) * cos(dl)) END AS y_km FROM b)
  SELECT year, inn_key, x_km, y_km, coalesce(original_available, 0) = 1 AS filed, line_2110, line_1600, line_2110 / d.defl AS real_rev,
         (other_lists + residents) > 0 AS treated_row, residents > 0 AS residents_row, other_lists > 0 AS other_row,
         geocoding_quality = 'city' AS city_level, industry2, legal_form, ownership_form, creation_date_reconciled
  FROM c JOIN deflator d USING (year)
  WHERE x_km BETWEEN %.9f AND %.9f AND y_km BETWEEN %.9f AND %.9f", pq(paste0("registry.", y)), pq(paste0("payload.", y)), R$xmin, R$xmax, R$ymin, R$ymax)
for (y in years) exec(paste0(if (y == years[1]) "CREATE TEMP TABLE fy_all AS" else "INSERT INTO fy_all", fy_year_sql(y)), sprintf("firm-years %d in the %s rectangle", y, SCOPE))
# Firms without an identifier cannot be followed across years or matched to a list; they are counted and left out.
exec("CREATE TEMP TABLE fy AS SELECT * FROM fy_all WHERE inn_key IS NOT NULL", "firm-years with an identifier")
no_id <- lab_query(con, "SELECT count(*) AS n, count(*) FILTER (WHERE year = 2021) AS n2021 FROM fy_all WHERE inn_key IS NULL", "firm-years without an identifier")

# ---- firm attributes: treated bucket, red-from year, baseline -----------------------------------
exec("CREATE TEMP TABLE firms AS
  WITH f AS (SELECT inn_key, bool_or(treated_row) AS treated, bool_or(residents_row) AS residents, bool_or(other_row) AS other_lists,
                    arg_max(x_km, year) AS x_km, arg_max(y_km, year) AS y_km, max(year) AS last_year, min(year) AS first_year,
                    arg_max(industry2, year) AS industry2, arg_max(legal_form, year) AS legal_form, arg_max(ownership_form, year) AS ownership_form,
                    min(creation_date_reconciled) AS created
             FROM fy GROUP BY inn_key),
       b AS (SELECT inn_key, avg(real_rev) FILTER (WHERE filed AND line_2110 > 0) AS base, count(*) FILTER (WHERE filed AND line_2110 > 0) AS nbase
             FROM fy WHERE year BETWEEN 2019 AND 2021 GROUP BY inn_key)
  SELECT f.*, CASE WHEN b.nbase >= 2 THEN b.base END AS base, coalesce(b.nbase, 0) AS nbase,
         s.start_year, s.inferred, s.countries_all,
         CASE WHEN NOT f.treated THEN NULL
              WHEN s.start_year IS NOT NULL THEN greatest(s.start_year, 2014)
              WHEN f.residents AND NOT f.other_lists THEN 2020
              ELSE 2014 END AS red_from,
         f.treated AND s.start_year IS NULL AND NOT (f.residents AND NOT f.other_lists) AS undated
  FROM f LEFT JOIN b USING (inn_key) LEFT JOIN san s ON s.inn = f.inn_key", "firm attributes")

# ---- list memberships of the treated firms (author's request, 25 October 2026): one code per list, s d r g p ----
# Read from the registry files for the treated keys only, so the firm-year tables keep their columns.
lists_union <- paste(vapply(years, function(y) sprintf("SELECT inn_key, member_sanctioned AS s, member_putin_decree AS d, member_residents AS r, member_strateg_government AS g, member_strateg_putin AS p FROM %s WHERE eligible_raw = 1 AND inn_key IS NOT NULL", pq(paste0("registry.", y))), ""), collapse = " UNION ALL ")
exec(sprintf("CREATE TEMP TABLE memberships AS
  SELECT inn_key, concat(CASE WHEN bool_or(coalesce(s, 0) > 0) THEN 's' ELSE '' END, CASE WHEN bool_or(coalesce(d, 0) > 0) THEN 'd' ELSE '' END,
                         CASE WHEN bool_or(coalesce(r, 0) > 0) THEN 'r' ELSE '' END, CASE WHEN bool_or(coalesce(g, 0) > 0) THEN 'g' ELSE '' END,
                         CASE WHEN bool_or(coalesce(p, 0) > 0) THEN 'p' ELSE '' END) AS lists
  FROM (%s) WHERE inn_key IN (SELECT inn_key FROM firms WHERE treated) GROUP BY inn_key", lists_union), "list memberships of the treated firms")

exec("CREATE TEMP TABLE fym0 AS
  SELECT y.*, m.treated, m.red_from, m.undated, m.inferred, m.base,
         CASE WHEN y.filed AND y.line_2110 >= 0 AND m.base IS NOT NULL THEN 100 * (y.real_rev / m.base - 1) END AS pct
  FROM fy y JOIN firms m USING (inn_key)", "firm-year metric")
# The relative metric (author's test, 23 October): the firm's change minus the year's median change of
# the drawn firms on no list (the same population as the marks: no list, below city-level geocodes,
# inside the rectangle), so the field stays centred each year and a mark pales only when a firm
# outgrows its peers.
exec("CREATE TEMP TABLE yearmed AS SELECT year, quantile_cont(pct, 0.5) AS med FROM fym0 WHERE NOT treated AND NOT city_level AND pct IS NOT NULL GROUP BY year", "yearly median of the drawn firms")
exec("CREATE TEMP TABLE fym AS SELECT f.*, f.pct - m.med AS pct_rel FROM fym0 f LEFT JOIN yearmed m USING (year)", "firm-year metric, absolute and relative")
yearmed <- lab_query(con, "SELECT year, med FROM yearmed ORDER BY year", "yearly medians")

# ---- classes and colours ------------------------------------------------------------------------
# Breaks chosen by the author on 23 October 2026 from the 2022-2024 quantiles (zero stays the midpoint,
# the upper classes widen); the first set was -40 / -15 / 0 / +15 / +40, which put 69-84% of filers in
# the two extreme classes. The manifest keeps the class counts under every candidate.
BREAKS <- c(-50, -20, 0, 50, 150)
CANDIDATES <- list(current = BREAKS, previous = c(-40, -15, 0, 15, 40), c2 = c(-40, -15, 0, 40, 120), c3 = c(-60, -25, 0, 75, 200))
# Round 3 (author's point 4): one hue for the change classes. Variant A (MOTION_VARIANT unset or "a"):
# six steps of ColorBrewer Blues resampled at even OKLab lightness (L 0.58 to 0.93) on the navy ground,
# darkest for the largest decline, palest for the largest rise; validator: monotone, gaps 0.068-0.072,
# 3.25:1 at the dark end, deltaE 22.3 / 18.0 against the purple control and 16.6 / 15.7 against the
# backdrop at 0.25. Variant B ("b"): a six-class muted diverging ramp without red (BrBG family, lightness
# rising with magnitude), written to points-b/ for the author's A/B review. Same breaks in both.
# The launcher runs the job in a systemd unit with its own environment, so the options travel as the
# script's trailing arguments: `Rscript --vanilla R/motion/M6-treated.R [a|b] [abs|rel]`.
VARIANT <- tolower(if (length(ARGS) >= 1) ARGS[1] else Sys.getenv("MOTION_VARIANT", "a"))
if (!VARIANT %in% c("a", "b")) stop("the ramp variant must be a or b")
# The author's pick (23 October) is ramp A with its dark end lifted to L 0.65 (a clear mid-blue against
# the land): six Blues steps at even lightness 0.65-0.96; validator: gaps 0.061-0.063, 4.30:1 at the
# dark end, deltaE 28.3 / 24.8 against the purple control and 22.4 / 21.4 against the backdrop at 0.25.
RAMPS <- list(a = list(name = "blues-even-lightness-0.65-0.96", cols = c("#4A97C9", "#67ABD4", "#88BEDC", "#ABCFE5", "#CDE0F1", "#EAF3FB")),
              b = list(name = "brbg-muted", cols = c("#F6E8C3", "#DFC27D", "#BF812D", "#80CDC1", "#C7EAE5", "#E8F6F3")))
CLASS_COLS <- RAMPS[[VARIANT]]$cols
# Looks (author's colour review, 23 October): the ground and the control-firm scale together. "navy"
# is the current dark navy ground with the lifted blue ramp; "light" a cream ground with a navy scale
# running pale (largest decline) to deep navy (largest rise); "green" the navy ground with a phthalo
# green scale (even lightness 0.65-0.96, validator passes, 4.47:1 at the dark end); "charcoal" a
# neutral dark ground with the blue ramp (rasters identical to "navy"). The third trailing argument.
LOOK <- tolower(if (length(ARGS) >= 3) ARGS[3] else "navy")
LOOKS <- list(navy = list(cols = CLASS_COLS, neutral = "#B5C3D1", ramp = RAMPS[[VARIANT]]$name),
              charcoal = list(cols = CLASS_COLS, neutral = "#B5C3D1", ramp = RAMPS[[VARIANT]]$name),
              green = list(cols = c("#45A382", "#5DB694", "#7EC7A9", "#9FD8BE", "#C2E8D4", "#E7F6EE"), neutral = "#B5C3D1", ramp = "phthalo-green-even-lightness-0.65-0.96"),
              light = list(cols = c("#A4C1E2", "#7DA7D5", "#568EC8", "#3373B6", "#1B5A9A", "#0E4377"), neutral = "#8A9BAE", ramp = "navy-on-cream-even-lightness-0.80-0.38"))
if (!LOOK %in% names(LOOKS)) stop("the look must be navy, charcoal, green or light")
CLASS_COLS <- LOOKS[[LOOK]]$cols
LOOK_SUFFIX <- if (LOOK %in% c("navy", "charcoal")) "" else paste0("-", LOOK)
# The metric: "abs" is the firm's own change; "rel" subtracts the year's median of the drawn firms on
# no list (the author's test). DEFAULT_METRIC names the canonical outputs (points, moscowcells,
# treated, anchors, moscowcomparison); the other metric writes "-rel" or "-abs" suffixed copies.
DEFAULT_METRIC <- "rel"   # the author's pick, 23 October 2026
METRIC <- tolower(if (length(ARGS) >= 2) ARGS[2] else DEFAULT_METRIC)
if (!METRIC %in% c("abs", "rel")) stop("the metric must be abs or rel")
PCOL <- if (METRIC == "rel") "pct_rel" else "pct"
SUFFIX <- if (METRIC == DEFAULT_METRIC) "" else paste0("-", METRIC)
CANONICAL <- VARIANT == "a" && METRIC == DEFAULT_METRIC && LOOK %in% c("navy", "charcoal")
METRIC_TEXT <- list(abs = list(kind = "absolute", legend_title = "Firms on no list, real revenue against own 2019-2021 average", legend_subtitle = NULL,
                               description = "real revenue (line 2110 divided by the GDP deflator rebased to 2021 = 1) as percent change against the firm's own 2019-2021 average of statements with positive revenue (at least two of the three years)"),
                    rel = list(kind = "relative", legend_title = "Firms on no list, real revenue against own 2019-2021 average,", legend_subtitle = "relative to the year's median of firms on no list",
                               description = "the firm's own percent change against its 2019-2021 average, minus the median change of the drawn firms on no list in the same year"))[[METRIC]]
# Dark control: a saturated deep purple, so it separates from the faint backdrop and from the land by
# chroma rather than lightness alone (validator, 23 October: deltaE 13.8 normal / 11.0 deutan against
# the effective backdrop at 0.35, 14.1 / 10.7 against the land).
COL_NONFILER <- "#5A3175"; COL_NEUTRAL <- LOOKS[[LOOK]]$neutral; COL_RED <- "#E31A1C"
BACKDROP_ALPHA <- 0.25; LAYER_ALPHA <- 0.9   # applied by the page when it composites the rasters
class_of <- function(p, breaks = BREAKS) ifelse(is.na(p), NA_integer_, 1L + findInterval(p, breaks, left.open = TRUE))

# ---- pixel rasters (the region extent in M6, the national run in M8) -----------------------------------
hex2rgb <- function(h) t(grDevices::col2rgb(h)) / 255
block_size <- function(cnt) ifelse(cnt >= 100, 3L, ifelse(cnt >= 10, 2L, 1L))
draw_region <- function(m, file, colours, cnt, order_by) {
  # One pixel per mark; piles of 10+ widen to 2x2 and 100+ to 3x3 (centred). Larger piles and stronger
  # classes are assigned last, so they win where blocks overlap.
  arr <- array(0, c(1080, 1920, 4))
  size <- block_size(cnt)
  o <- order(size, order_by)
  rgb <- hex2rgb(colours[o]); size <- size[o]; row0 <- m$row[o] + 1L - (size == 3L); col0 <- m$col[o] + 1L - (size == 3L)
  for (s in 1:3) {
    sel <- which(size == s); if (!length(sel)) next
    g <- expand.grid(dr = 0:(s - 1L), dc = 0:(s - 1L))
    rows <- as.vector(outer(row0[sel], g$dr, "+")); cols <- as.vector(outer(col0[sel], g$dc, "+")); who <- rep(sel, times = nrow(g))
    ok <- rows >= 1 & rows <= 1080 & cols >= 1 & cols <= 1920
    for (ch in 1:3) arr[cbind(rows[ok], cols[ok], ch)] <- rgb[who[ok], ch]
    arr[cbind(rows[ok], cols[ok], 4L)] <- 1
  }
  ragg::agg_png(file, width = 1920, height = 1080, units = "px", background = "transparent")
  grid::grid.newpage(); grid::grid.raster(arr, x = 0, y = 0, width = 1, height = 1, just = c("left", "bottom"), interpolate = FALSE)
  grDevices::dev.off()
  invisible(NULL)
}

# ---- listed firms' yearly revenue and their share of the revenue at their coordinate pair (author's request, 25 October 2026) ----
# Per listed firm and year: rev_m, the filed revenue (line 2110, thousands of rubles in the source) in millions of nominal
# rubles, NA without a statement or a positive value; psh, the firm's share of the summed revenue of every firm with a
# statement and a positive revenue value registered at the same coordinate pair that year (1 m rounding, house- or
# street-level geocodes, firms on any list included: the denominator M9 sums per address), in tenths of a percent, NA when
# the firm has no revenue value or a city-level geocode. The identifier stays inside R and the in-memory database.
MOTION_REVENUE_NOTE <- "rev_m: filed revenue (line 2110) in millions of nominal rubles, years 2014 to 2025 (float32, NaN without a statement or a positive value); psh: the firm's share of the revenue of every firm with a statement and a positive revenue value registered at its coordinate pair that year, in tenths of a percent (int16, -1 without a value or with a city-level geocode); both row-major, 12 per firm, base64 little-endian"
motion_listed_revenue <- function() {
  d <- lab_query(con, "
    WITH pr AS (SELECT year, round(x_km, 3) AS px, round(y_km, 3) AS py, sum(line_2110) AS rt, count(*) AS nf
                FROM fym WHERE filed AND line_2110 > 0 AND NOT city_level GROUP BY 1, 2, 3)
    SELECT m.inn_key, g.year, y.line_2110, coalesce(y.filed, false) AS filed, coalesce(y.city_level, false) AS city_level, pr.rt, pr.nf
    FROM firms m CROSS JOIN (SELECT unnest(range(2014, 2026)) AS year) g
    LEFT JOIN fym y ON y.inn_key = m.inn_key AND y.year = g.year
    LEFT JOIN pr ON pr.year = g.year AND pr.px = round(y.x_km, 3) AND pr.py = round(y.y_km, 3)
    WHERE m.treated ORDER BY m.inn_key, g.year", "listed firms' revenue and the revenue at their coordinate pairs")
  has <- !is.na(d$line_2110) & d$filed & d$line_2110 > 0
  d$rev_m <- ifelse(has, round(d$line_2110 / 1000, 1), NA_real_)
  d$psh <- ifelse(has & !d$city_level & !is.na(d$rt) & d$rt > 0, round(1000 * d$line_2110 / d$rt), NA_real_)
  d
}
motion_listed_revenue_cols <- function(lr, inn_keys, filed_strings) {   # row-major, 12 values per firm in the order of inn_keys
  idx <- match(paste(rep(inn_keys, each = 12L), rep(2014:2025, times = length(inn_keys))), paste(lr$inn_key, lr$year))
  if (anyNA(idx)) stop("listed revenue: a firm-year is missing")
  rev <- lr$rev_m[idx]; psh <- lr$psh[idx]; has <- !is.na(rev)
  fchar <- substring(rep(filed_strings, each = 12L), rep(1:12, times = length(inn_keys)), rep(1:12, times = length(inn_keys)))
  list(rev_m = motion_b64_float32(rev), psh = motion_b64_int16(ifelse(is.na(psh), -1L, as.integer(psh))),
       n_with_value = sum(has), n_with_share = sum(!is.na(psh)), firms_with_any_value = sum(tapply(has, rep(seq_along(inn_keys), each = 12L), any)),
       checks = motion_checks(
         motion_check("listed revenue: 12 values per firm", 12L * length(inn_keys), length(rev)),
         motion_check("listed revenue: pair shares within 0 to 1000", 0L, sum(psh < 0 | psh > 1000, na.rm = TRUE)),
         motion_check("listed revenue: a pair share exists exactly where a revenue value does and the geocode is not city-level", 0L, sum(!is.na(psh) != (has & !lr$city_level[idx]))),
         motion_check("listed revenue: a firm alone with revenue at its coordinate pair holds all of it", 0L, sum(!is.na(psh) & lr$nf[idx] == 1 & psh != 1000)),
         motion_check("listed revenue: a revenue value implies a statement in the filing string", 0L, sum(has & fchar != "1"))))
}
