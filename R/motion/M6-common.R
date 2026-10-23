# Shared by M6 (rasters, treated firms, anchors) and M7 (Moscow cells, comparison groups): the Moscow
# extents, the deflator and sanctions inputs, the firm-year temp tables and the class rule. Sourced as
# a fragment after `con` exists (round 3, 23 October 2026); one SQL text, so both passes build the
# same tables. M6 is never sourced whole: it deletes and rewrites the rasters.
years <- 2014:2025
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

# ---- deflator (WDI NY.GDP.DEFL.ZS.AD, Russia), rebased to 2021 = 1 -----------------------------
wdi <- utils::read.csv(lab_source("motion.deflator"), skip = 4, check.names = FALSE, stringsAsFactors = FALSE)
rus <- wdi[wdi$`Country Code` == "RUS", ]
if (nrow(rus) != 1) stop("deflator: Russia row not found")
idx <- as.numeric(rus[1, as.character(2011:2025)])
deflator <- data.frame(year = 2011:2025, index = idx, defl = idx / idx[2021 - 2010])
DBI::dbWriteTable(con, "deflator", deflator[, c("year", "defl")], temporary = TRUE, overwrite = TRUE)

# ---- sanctions list: one row per INN with the earliest start date and that row's inferred flag ----
san <- utils::read.csv(lab_source("motion.sanctioned-list"), stringsAsFactors = FALSE, colClasses = "character", encoding = "UTF-8")
san$inn <- trimws(san$inn); san <- san[nzchar(san$inn), ]
san$start_year <- as.integer(substr(san$startDate, 1, 4)); san$inferred <- san$startDate_inferred == "1"
san <- san[order(san$inn, san$startDate), ]
san_first <- san[!duplicated(san$inn), c("inn", "start_year", "inferred", "countries", "name", "name_alt")]
san_first$countries_all <- vapply(split(san$countries, san$inn)[san_first$inn], function(v) { tok <- unlist(strsplit(v, "[|[:space:]]+")); paste(sort(unique(tok[nzchar(tok)])), collapse = " ") }, "")   # the file writes "gb | us"
DBI::dbWriteTable(con, "san", san_first[, c("inn", "start_year", "inferred", "countries_all")], temporary = TRUE, overwrite = TRUE)

# ---- firm-years inside the region rectangle, 2014-2025 ------------------------------------------
exec(sprintf("CREATE TEMP TABLE fy_all AS
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
  SELECT year, inn_key, x_km, y_km, coalesce(original_available, 0) = 1 AS filed, line_2110, line_1600, line_2110 * d.defl AS real_rev,
         (other_lists + residents) > 0 AS treated_row, residents > 0 AS residents_row, other_lists > 0 AS other_row,
         geocoding_quality = 'city' AS city_level, industry2, legal_form, ownership_form, creation_date_reconciled
  FROM c JOIN deflator d USING (year)
  WHERE x_km BETWEEN %.9f AND %.9f AND y_km BETWEEN %.9f AND %.9f", pq(paste0("registry.", years)), pq(paste0("payload.", years)), R$xmin, R$xmax, R$ymin, R$ymax), "firm-years in the region rectangle")
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
ARGS <- commandArgs(trailingOnly = TRUE)
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
                               description = "real revenue (line 2110 times the GDP deflator rebased to 2021 = 1) as percent change against the firm's own 2019-2021 average of statements with positive revenue (at least two of the three years)"),
                    rel = list(kind = "relative", legend_title = "Firms on no list, real revenue against own 2019-2021 average,", legend_subtitle = "relative to the year's median of firms on no list",
                               description = "the firm's own percent change against its 2019-2021 average, minus the median change of the drawn firms on no list in the same year"))[[METRIC]]
# Dark control: a saturated deep purple, so it separates from the faint backdrop and from the land by
# chroma rather than lightness alone (validator, 23 October: deltaE 13.8 normal / 11.0 deutan against
# the effective backdrop at 0.35, 14.1 / 10.7 against the land).
COL_NONFILER <- "#5A3175"; COL_NEUTRAL <- LOOKS[[LOOK]]$neutral; COL_RED <- "#E31A1C"
BACKDROP_ALPHA <- 0.25; LAYER_ALPHA <- 0.9   # applied by the page when it composites the rasters
class_of <- function(p, breaks = BREAKS) ifelse(is.na(p), NA_integer_, 1L + findInterval(p, breaks, left.open = TRUE))
