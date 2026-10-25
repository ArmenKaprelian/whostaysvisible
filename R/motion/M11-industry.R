# M11: the industry layer's cells and the region facts (round 9, author's request, 25 October 2026). Per financial year
# and 25 km cell (and the 100 km parents, and the 22 city windows' 1 km cells for 2019 to 2024): the division with the
# largest share of nominal revenue (line 2110) among located eligible firms with a statement and a positive revenue value,
# its share, the ranked mix (top-5 at 100 km, top-3 at 25 km) and the share of that revenue held by firms on the five lists
# (lsh). Population: every located eligible firm, as the cells view's other layers count them (listed firms and other
# geocodes included; the author's choice over the address field's population). Per registry region (region_model, mapped to
# the basemap's names by config/regions-crosswalk.csv) and year: located firms, with a statement, on the lists, the top-3
# divisions, the listed share, and Other's share with its leading division (the author's report). Same inputs, projection
# and located rule as M5 and M10, streamed per year without temporary tables. Nothing firm-level leaves DuckDB.
# Run: scripts/lab-run.sh --max 12G --duck-mem 8GB --duck-threads 8 --cpu 800% Rscript --vanilla R/motion/M11-industry.R
source(file.path(Sys.getenv("LAB_ROOT"), "R", "lab.R")); lab_init()
source(lab_path("R", "motion", "motion-common.R"))
source(lab_path("R", "motion", "industry-common.R"))
con <- lab_duck_connect(); on.exit(lab_duck_disconnect(con))
cy <- motion_read_json("cellsyears"); c25 <- motion_read_json("cells25")
bm <- jsonlite::fromJSON(file.path(motion_data_dir(), "basemap.json"), simplifyVector = FALSE)   # the parts as lists, for the ray casting
totals <- as.data.frame(cy$totals); avail <- as.data.frame(cy$avail); city1km <- as.data.frame(cy$city_1km[c("year", "label", "count", "sum_n")])
cities <- as.data.frame(lapply(bm$cities, unlist), stringsAsFactors = FALSE); cities$x_km <- as.numeric(cities$x_km); cities$y_km <- as.numeric(cities$y_km)
years <- as.integer(cy$mapped_years)
xw <- utils::read.csv(lab_path("config", "regions-crosswalk.csv"), stringsAsFactors = FALSE, encoding = "UTF-8", colClasses = "character")
geo <- lab_read_csv("geo.industry")
titles <- ind_titles(); TAB <- titles$table
G <- 25L; TOPK100 <- 8L; TOPK25 <- 8L; TOPK1 <- 8L   # the mix box shows up to eight rows per cell (author's correction, 25 October 2026)

located_sql <- function(y) sprintf("
  WITH r AS (SELECT source_row, original_available, industry2, region_model,
                    coalesce(member_sanctioned, 0) + coalesce(member_putin_decree, 0) + coalesce(member_residents, 0) + coalesce(member_strateg_government, 0) + coalesce(member_strateg_putin, 0) > 0 AS listed
             FROM %s WHERE eligible_raw = 1),
       p AS (SELECT source_row, lon, lat, geocoding_quality, line_2110 FROM %s),
       j AS (SELECT r.*, p.lon, p.lat, p.geocoding_quality, p.line_2110 FROM r LEFT JOIN p USING (source_row)),
       a AS (SELECT *, coalesce(isfinite(lon) AND isfinite(lat) AND lon BETWEEN -180 AND 180 AND lat BETWEEN -90 AND 90, false) AS bounds_valid,
                    lat * pi() / 180 AS phi, ((lon - 100 + 180) - 360 * floor((lon - 100 + 180) / 360) - 180) * pi() / 180 AS dl FROM j),
       b AS (SELECT *, 1 + sin(pi() / 3) * sin(phi) + cos(pi() / 3) * cos(phi) * cos(dl) AS den FROM a)
  SELECT original_available, industry2, region_model, listed, coalesce(geocoding_quality = 'city', false) AS city_level,
         CASE WHEN original_available = 1 AND line_2110 > 0 THEN line_2110 END AS rev, %s AS div,
         coalesce(bounds_valid AND den > 1e-12, false) AS located,
         CASE WHEN bounds_valid AND den > 1e-12 THEN 6371 * sqrt(2 / den) * cos(phi) * sin(dl) END AS x_km,
         CASE WHEN bounds_valid AND den > 1e-12 THEN 6371 * sqrt(2 / den) * (cos(pi() / 3) * sin(phi) - sin(pi() / 3) * cos(phi) * cos(dl)) END AS y_km
  FROM b", lab_parquet_sql(paste0("registry.", y)), lab_parquet_sql(paste0("payload.", y)), ind_div_sql("industry2"))
city_values <- paste(sprintf("('%s', %.9f, %.9f)", gsub("'", "''", cities$label), cities$x_km, cities$y_km), collapse = ", ")
cities_sql <- sprintf("(SELECT * FROM (VALUES %s) AS c(label, cx, cy))", city_values)
DIV_COLS <- "count(*) AS n, count(*) FILTER (WHERE original_available = 1) AS a, count(*) FILTER (WHERE rev IS NOT NULL) AS nf, coalesce(sum(rev), 0) AS rev, coalesce(sum(rev) FILTER (WHERE listed), 0) AS rev_listed, count(*) FILTER (WHERE listed) AS nl"

# Rank the divisions inside each group (rows: one per group and division; key: the group id) and return per group the
# totals, the dominant (255 when no revenue), its share, the top-k codes and shares and the listed share.
rank_groups <- function(d, key, k) {
  o <- order(key, -d$rev, d$div); d <- d[o, ]; key <- key[o]   # grouped, the largest revenue first inside each group, ties to the lower code
  grp <- match(key, unique(key))
  tot <- data.frame(g = unique(key), n = as.integer(rowsum(d$n, grp)[, 1]), a = as.integer(rowsum(d$a, grp)[, 1]), nrev = as.integer(rowsum(d$nf, grp)[, 1]),
                    rt = rowsum(d$rev, grp)[, 1], rl = rowsum(d$rev_listed, grp)[, 1], nl = as.integer(rowsum(d$nl, grp)[, 1]), stringsAsFactors = FALSE)
  rk <- ave(seq_along(grp), grp, FUN = seq_along)
  top <- matrix(255L, nrow(tot), k); sh <- matrix(0L, nrow(tot), k)
  for (j in seq_len(k)) { sel <- rk == j & d$rev > 0; top[grp[sel], j] <- as.integer(d$div[sel]); sh[grp[sel], j] <- as.integer(round(100 * d$rev[sel] / tot$rt[grp[sel]])) }
  tot$dom <- ifelse(tot$rt > 0, top[, 1], 255L); tot$dsh <- ifelse(tot$rt > 0, sh[, 1], 0L)
  tot$lsh <- as.integer(ifelse(tot$rt > 0, round(100 * tot$rl / tot$rt), 0))
  tot$rv <- as.integer(ifelse(tot$rt > 0, pmax(0, round(100 * log10(pmax(tot$rt, 1e-9)))) + 1L, 0L))   # a log code of the cell's revenue (thousands of rubles): 10^((rv - 1) / 100); 0 without revenue
  # the share of revenue in class Other and its leading division (the author's report on Other)
  oth <- d$rev * (ind_class_of(d$div) == 9L); osum <- rowsum(oth, grp)[, 1]
  tot$osh <- as.integer(ifelse(tot$rt > 0, round(100 * osum / tot$rt), 0))
  ord <- order(grp, -oth, d$div); fo <- !duplicated(grp[ord]); lead <- rep(255L, nrow(tot)); lsh2 <- rep(0L, nrow(tot))
  lead[grp[ord][fo]] <- ifelse(oth[ord][fo] > 0, as.integer(d$div[ord][fo]), 255L); lsh2[grp[ord][fo]] <- as.integer(ifelse(tot$rt[grp[ord][fo]] > 0, round(100 * oth[ord][fo] / tot$rt[grp[ord][fo]]), 0))
  tot$od <- lead; tot$ods <- lsh2
  tot$top <- top; tot$sh <- sh
  tot
}
flat <- function(m) as.integer(t(m))   # row-major, k per group

checks <- list(); g100 <- list(); g25 <- list(); city1 <- list(); reg <- list(); diag21 <- NULL; rss <- function() as.numeric(system2("ps", c("-o", "rss=", "-p", Sys.getpid()), stdout = TRUE)) / 1024
for (y in years) {
  base <- located_sql(y)
  d <- lab_query(con, sprintf("SELECT CAST(floor(x_km / %d) AS INTEGER) AS ix, CAST(floor(y_km / %d) AS INTEGER) AS iy, div, %s FROM (%s) WHERE located GROUP BY 1, 2, 3", G, G, DIV_COLS, base), sprintf("25 km cells by division %d", y))
  for (col in c("ix", "iy", "div", "n", "a", "nf", "nl")) d[[col]] <- as.integer(d[[col]])
  key25 <- paste(d$ix, d$iy); t25 <- rank_groups(d, key25, TOPK25)
  ixy <- do.call(rbind, strsplit(t25$g, " ")); t25$ix <- as.integer(ixy[, 1]); t25$iy <- as.integer(ixy[, 2]); t25 <- t25[order(t25$iy, t25$ix), ]
  d$px <- floor(d$ix / 4); d$py <- floor(d$iy / 4)
  dp <- aggregate(cbind(n, a, nf, rev, rev_listed, nl) ~ px + py + div, data = d, FUN = sum)
  t100 <- rank_groups(dp, paste(dp$px, dp$py), TOPK100)
  pxy <- do.call(rbind, strsplit(t100$g, " ")); t100$ix <- as.integer(pxy[, 1]); t100$iy <- as.integer(pxy[, 2]); t100 <- t100[order(t100$iy, t100$ix), ]
  # checks against the cells passes
  ti <- which(totals$year == y); a100 <- avail[avail$year == y, ]; c25y <- c25$by_year[[as.character(y)]]
  ix25 <- readBin(jsonlite::base64_dec(c25y$ix), "integer", c25y$count, size = 2L, endian = "little"); iy25 <- readBin(jsonlite::base64_dec(c25y$iy), "integer", c25y$count, size = 2L, endian = "little")
  m100 <- merge(t100[, c("ix", "iy", "n")], a100[, c("ix", "iy", "n")], by = c("ix", "iy"), all = TRUE, suffixes = c("", "_m5"))
  shares_ok <- all(t25$sh[, 1] >= t25$sh[, 2] & t25$sh[, 2] >= t25$sh[, 3]) && all(t100$sh[, 1] >= t100$sh[, 2] & t100$sh[, 2] >= t100$sh[, 3] & t100$sh[, 3] >= t100$sh[, 4] & t100$sh[, 4] >= t100$sh[, 5])
  checks[[length(checks) + 1]] <- motion_checks(
    motion_check(sprintf("%d: located firms equal M5's total", y), totals$n_located[ti], sum(t25$n)),
    motion_check(sprintf("%d: 25 km cells equal cells25's cells (count)", y), c25y$count, nrow(t25)),
    motion_check(sprintf("%d: 25 km cells equal cells25's cells (set)", y), 0, length(union(setdiff(paste(t25$ix, t25$iy), paste(ix25, iy25)), setdiff(paste(ix25, iy25), paste(t25$ix, t25$iy))))),
    motion_check(sprintf("%d: 100 km cells equal cellsyears' cells", y), nrow(a100), sum(!is.na(m100$n) & !is.na(m100$n_m5))),
    motion_check(sprintf("%d: 100 km firms equal cellsyears' (max abs diff)", y), 0, max(abs(m100$n - m100$n_m5), na.rm = TRUE)),
    motion_check(sprintf("%d: a cell has a leading division exactly when a firm has a revenue value", y), 0, sum((t25$dom != 255L) != (t25$nrev > 0)) + sum((t100$dom != 255L) != (t100$nrev > 0))),
    motion_check(sprintf("%d: leading shares within 1 to 100 where known", y), 0, sum(t25$dsh[t25$dom != 255L] < 1 | t25$dsh > 100) + sum(t100$dsh[t100$dom != 255L] < 1 | t100$dsh > 100)),
    motion_check(sprintf("%d: ranked shares non-increasing", y), 1, as.integer(shares_ok)),
    motion_check(sprintf("%d: rounded top shares sum to at most 100 plus half a point per entry", y), 0, sum(rowSums(t25$sh) > 100 + TOPK25 / 2) + sum(rowSums(t100$sh) > 100 + TOPK100 / 2)),
    motion_check(sprintf("%d: listed shares within 0 to 100", y), 0, sum(t25$lsh < 0 | t25$lsh > 100) + sum(t100$lsh < 0 | t100$lsh > 100)))
  g25[[as.character(y)]] <- list(year = y, count = nrow(t25), with_revenue = sum(t25$nrev > 0), by_class = as.integer(tabulate(ind_class_of(t25$dom) + 1L, nbins = 10L)),
                                ix = motion_b64_int16(t25$ix), iy = motion_b64_int16(t25$iy), nrev = motion_b64_int32(t25$nrev), dom = motion_b64_uint8(t25$dom), dsh = motion_b64_uint8(t25$dsh), lsh = motion_b64_uint8(t25$lsh),
                                rv = motion_b64_int16(t25$rv), top_code = motion_b64_uint8(flat(t25$top)), top_share = motion_b64_uint8(flat(t25$sh)))
  g100[[as.character(y)]] <- list(year = y, count = nrow(t100), with_revenue = sum(t100$nrev > 0), by_class = as.integer(tabulate(ind_class_of(t100$dom) + 1L, nbins = 10L)),
                                 ix = motion_b64_int16(t100$ix), iy = motion_b64_int16(t100$iy), nrev = motion_b64_int32(t100$nrev), dom = motion_b64_uint8(t100$dom), dsh = motion_b64_uint8(t100$dsh), lsh = motion_b64_uint8(t100$lsh),
                                 rv = motion_b64_int16(t100$rv), top_code = motion_b64_uint8(flat(t100$top)), top_share = motion_b64_uint8(flat(t100$sh)))
  # the 22 city windows' 1 km cells, 2019 to 2024, as M5 joins them
  if (y >= 2019 && y <= 2024) {
    w <- lab_query(con, sprintf("SELECT c.label, LEAST(CAST(floor((p.x_km - (c.cx - 45)) / 1.0) AS INTEGER), 89) AS ix, LEAST(CAST(floor((p.y_km - (c.cy - 45)) / 1.0) AS INTEGER), 89) AS iy, p.div, %s
                                 FROM (%s) AS p JOIN %s AS c ON p.located AND p.x_km >= c.cx - 45 AND p.x_km <= c.cx + 45 AND p.y_km >= c.cy - 45 AND p.y_km <= c.cy + 45 GROUP BY 1, 2, 3, 4", DIV_COLS, base, cities_sql), sprintf("city 1 km cells by division %d", y))
    for (col in c("ix", "iy", "div", "n", "a", "nf", "nl")) w[[col]] <- as.integer(w[[col]])
    for (lab in sort(unique(w$label))) {
      wl <- w[w$label == lab, ]; tl <- rank_groups(wl, paste(wl$ix, wl$iy), TOPK1)
      lxy <- do.call(rbind, strsplit(tl$g, " ")); tl$ix <- as.integer(lxy[, 1]); tl$iy <- as.integer(lxy[, 2]); tl <- tl[order(tl$iy, tl$ix), ]
      m5 <- which(city1km$year == y & city1km$label == lab)
      ok <- length(m5) == 1 && city1km$count[m5] == nrow(tl) && city1km$sum_n[m5] == sum(tl$n)
      checks[[length(checks) + 1]] <- motion_check(sprintf("%d: the %s window's 1 km cells equal cellsyears' (count and firms)", y, lab), 1, as.integer(ok))
      ci <- cities[cities$label == lab, ]
      city1[[length(city1) + 1]] <- list(year = y, label = lab, grid_km = 1, origin = c(ci$x_km - 45, ci$y_km - 45), count = nrow(tl), with_revenue = sum(tl$nrev > 0),
                                         ix = motion_b64_int16(tl$ix), iy = motion_b64_int16(tl$iy), nrev = motion_b64_int16(pmin(tl$nrev, 32767L)), dom = motion_b64_uint8(tl$dom), dsh = motion_b64_uint8(tl$dsh), rv = motion_b64_int16(tl$rv), top_code = motion_b64_uint8(flat(tl$top)), top_share = motion_b64_uint8(flat(tl$sh)))
    }
  }
  # regions: the registry's region label, mapped to the basemap's names; the national row from the same rows
  r <- lab_query(con, sprintf("SELECT coalesce(region_model, '__MISSING__') AS region_model, div, %s FROM (%s) WHERE located GROUP BY 1, 2", DIV_COLS, base), sprintf("regions by division %d", y))
  for (col in c("div", "n", "a", "nf", "nl")) r[[col]] <- as.integer(r[[col]])
  unknown <- setdiff(unique(r$region_model), xw$region_model); if (length(unknown)) stop("region labels missing from config/regions-crosswalk.csv: ", paste(unknown, collapse = ", "))
  r$region <- xw$basemap_name[match(r$region_model, xw$region_model)]
  rr <- aggregate(cbind(n, a, nf, rev, rev_listed, nl) ~ region + div, data = r, FUN = sum)
  tr <- rank_groups(rr, rr$region, 3L)
  rn <- aggregate(cbind(n, a, nf, rev, rev_listed, nl) ~ div, data = r, FUN = sum); rn$region <- "Russia"
  tn <- rank_groups(rn, rn$region, 3L)
  checks[[length(checks) + 1]] <- motion_check(sprintf("%d: located firms over the regions equal M5's total", y), totals$n_located[ti], sum(tr$n))
  for (t in list(tr, tn)) reg[[length(reg) + 1]] <- data.frame(region = t$g, year = y, n = t$n, a = t$a, listed = t$nl, nrev = t$nrev, d1 = t$top[, 1], s1 = t$sh[, 1], d2 = t$top[, 2], s2 = t$sh[, 2], d3 = t$top[, 3], s3 = t$sh[, 3], lsh = t$lsh, osh = t$osh, od = t$od, ods = t$ods, stringsAsFactors = FALSE)
  if (y == 2021) {
    # the author's diagnostic: cells whose leader changes without listed firms, and without other geocodes
    dnl <- lab_query(con, sprintf("SELECT CAST(floor(x_km / %d) AS INTEGER) AS ix, CAST(floor(y_km / %d) AS INTEGER) AS iy, div, %s FROM (%s) WHERE located AND NOT listed GROUP BY 1, 2, 3", G, G, DIV_COLS, base), "2021 cells without listed firms")
    dnc <- lab_query(con, sprintf("SELECT CAST(floor(x_km / %d) AS INTEGER) AS ix, CAST(floor(y_km / %d) AS INTEGER) AS iy, div, %s FROM (%s) WHERE located AND NOT city_level GROUP BY 1, 2, 3", G, G, DIV_COLS, base), "2021 cells without other geocodes")
    for (z in list(dnl, dnc)) for (col in c("ix", "iy", "div", "n", "a", "nf", "nl")) z[[col]] <- as.integer(z[[col]])
    tnl <- rank_groups(dnl, paste(dnl$ix, dnl$iy), 1L); tnc <- rank_groups(dnc, paste(dnc$ix, dnc$iy), 1L)
    base_dom <- setNames(t25$dom, t25$g)
    flip <- function(t) { common <- intersect(names(base_dom), t$g); known <- base_dom[common] != 255L & t$dom[match(common, t$g)] != 255L; list(cells = sum(known), changed = sum(base_dom[common][known] != t$dom[match(common, t$g)][known])) }
    diag21 <- list(without_listed = flip(tnl), without_other_geocodes = flip(tnc))
    # the spot check against the pinned regional table (every (region, industry2) located count)
    rg <- lab_query(con, sprintf("SELECT coalesce(region_model, '__MISSING__') AS region_model, coalesce(industry2, '__MISSING__') AS industry2, count(*) FILTER (WHERE located) AS n_located FROM (%s) GROUP BY 1, 2", base), "2021 regions by industry2")
    mg <- merge(rg, geo[, c("region_model", "industry2", "n_located")], by = c("region_model", "industry2"), all = TRUE, suffixes = c("", "_pinned"))
    mg$n_located[is.na(mg$n_located)] <- 0L; mg$n_located_pinned[is.na(mg$n_located_pinned)] <- 0L
    checks[[length(checks) + 1]] <- motion_checks(
      motion_check("2021: (region, industry2) rows of the pinned regional table all present", nrow(geo), sum(paste(rg$region_model, rg$industry2) %in% paste(geo$region_model, geo$industry2))),
      motion_check("2021: (region, industry2) located counts equal the pinned regional table (max abs diff)", 0, max(abs(mg$n_located - mg$n_located_pinned))),
      motion_check("2021: the regional sums reproduce the located total", totals$n_located[ti], sum(rg$n_located)))
  }
  message(sprintf("  %d: %s 25 km cells (%s with revenue), %s 100 km cells, %d regions, RSS %.0f MB", y, motion_count(nrow(t25)), motion_count(sum(t25$nrev > 0)), motion_count(nrow(t100)), nrow(tr), rss()))
}
regions <- do.call(rbind, reg); regions <- regions[order(regions$region != "Russia", regions$region, regions$year), ]

# The crosswalk's geometric validation without a spatial library: 200 located 2021 firms per matched label, ray-cast against
# the named polygon's lod0 rings (even-odd, the basemap's 1 km simplification); at least 90 percent inside for every matched
# label, and at most 10 percent of the outside labels' samples inside any polygon (a few firms registered in the
# territories outside the outline carry addresses geocoded inside it; 6.7 percent in the first run).
decode_ring <- function(v) { v <- as.integer(unlist(v)); n <- length(v) / 2; x <- cumsum(v[seq(1, by = 2, length.out = n)]) / 10; y <- cumsum(v[seq(2, by = 2, length.out = n)]) / 10; cbind(x, y) }
inside_rings <- function(px, py, rings) {   # even-odd over all rings of a region's parts
  hit <- rep(FALSE, length(px))
  for (rg in rings) { x <- rg[, 1]; y <- rg[, 2]; n <- length(x); j <- c(n, seq_len(n - 1))
    for (i in seq_len(n)) { xi <- x[i]; yi <- y[i]; xj <- x[j[i]]; yj <- y[j[i]]
      cross <- ((yi > py) != (yj > py)) & (px < (xj - xi) * (py - yi) / (yj - yi + 1e-12) + xi)
      hit <- xor(hit, cross) } }
  hit
}
parts <- bm$lod0$parts; part_names <- vapply(parts, function(p) p$name, "")
rings_of <- function(name) unlist(lapply(parts[part_names == name], function(p) lapply(p$rings, decode_ring)), recursive = FALSE)
smp <- lab_query(con, sprintf("SELECT region_model, x_km, y_km FROM (%s) WHERE located QUALIFY row_number() OVER (PARTITION BY region_model ORDER BY random()) <= 200", located_sql(2021)), "2021 sample per region")
smp$region <- xw$basemap_name[match(smp$region_model, xw$region_model)]
matched <- setdiff(unique(xw$basemap_name), c("outside the basemap outline", "region not recorded"))
share_in <- vapply(matched, function(nm) { s <- smp[smp$region == nm, ]; if (!nrow(s)) return(NA_real_); mean(inside_rings(s$x_km, s$y_km, rings_of(nm))) }, 0)
all_rings <- unlist(lapply(parts, function(p) lapply(p$rings, decode_ring)), recursive = FALSE)
so <- smp[!(smp$region %in% matched), ]; out_in <- if (nrow(so)) mean(inside_rings(so$x_km, so$y_km, all_rings)) else 0
checks[[length(checks) + 1]] <- motion_checks(
  motion_check("crosswalk: every matched region has a sample", 0, sum(is.na(share_in))),
  motion_check("crosswalk: the lowest share of a region's sampled firms inside its polygon is at least 0.90", 1, as.integer(min(share_in, na.rm = TRUE) >= 0.90)),
  motion_check("crosswalk: at most 10 percent of the outside labels' samples fall inside any polygon (firms registered outside the outline but geocoded inside it)", 1, as.integer(out_in <= 0.10)),
  titles$checks)
checks_df <- do.call(rbind, checks)
worst <- sort(share_in)[1:5]
message(sprintf("  crosswalk validation: lowest inside shares %s; outside labels inside any polygon %.3f", paste(sprintf("%s %.3f", names(worst), worst), collapse = ", "), out_in))

tabs <- ind_tables(titles)
out <- c(list(grid100 = list(grid_km = 100, origin = c(0, 0), topk = TOPK100, by_year = g100), grid25 = list(grid_km = G, origin = c(0, 0), topk = TOPK25, by_year = g25),
              city_1km = list(file = "industry-city.json", windows = length(city1), topk = TOPK1, years = 2019:2024),
              years = years, population = "every located eligible firm at its registered address (listed firms and other geocodes included); the revenue mix over firms with a statement and a positive revenue value that year",
              consistency_2021 = diag21,
              encoding_columns = "base64 little-endian: ix, iy int16; nrev int32 (int16 in the city windows); dom, dsh, lsh u8; rv int16 (a log code of the cell's revenue in thousands of rubles, 10^((rv - 1) / 100), 0 without revenue); top_code and top_share u8 row-major with topk entries per cell, 255 and 0 padding",
              notes = c("The leading division is the one with the largest share of nominal revenue (line 2110) at the cell among firms with a statement and a positive revenue value; shares are within the year.",
                        "Firms on the five lists (treated) are included; lsh is their share of the cell's revenue. The 1 km city cells (industry-city.json, 2019 to 2024) carry the same eight rows.",
                        "Registered addresses, not operating sites; annual populations, not the same firms; descriptive.")), tabs)
motion_save_json(out, "industry", checks = checks_df, rows = sum(vapply(g25, function(z) z$count, 0)))
cityout <- list(grid_km = 1, topk = TOPK1, years = 2019:2024, windows = length(city1), city_1km = city1,
                encoding_columns = "base64 little-endian: ix, iy, nrev int16; dom, dsh u8; rv int16 (a log code of the cell's revenue in thousands of rubles, 10^((rv - 1) / 100), 0 without revenue); top_code and top_share u8 row-major with topk entries per cell, 255 and 0 padding",
                notes = "The 22 city windows' 1 km cells by year, as M5 joins them: the divisions with revenue in the cell by share descending (up to eight) and the cell's revenue code; loaded by the atlas when the industry layer reaches a city window.")
motion_save_json(cityout, "industry-city", checks = checks_df[grepl("1 km cells", checks_df$check), ], rows = sum(vapply(city1, function(z) z$count, 0)))
rout <- c(list(columns = names(regions), rows = nrow(regions), basis = "the registry's region label (region_model) mapped to the basemap's ADM1 names by config/regions-crosswalk.csv: firms registered in the region, not firms located inside the polygon; the national row is 'Russia'",
               crosswalk = list(region_model = xw$region_model, basemap_name = xw$basemap_name),
               validation = list(lowest_inside_share = min(share_in, na.rm = TRUE), outside_labels_inside_share = out_in),
               notes = c("Per region and year: located eligible firms (n), with a statement (a), on the five lists (listed), with a revenue value (nrev), the top-3 divisions by revenue share (d1 s1 d2 s2 d3 s3), the listed share of revenue (lsh), Other's share (osh) and Other's leading division with its share (od, ods).")),
          as.list(regions), tabs[c("divisions", "classes", "division_titles_source")])
motion_save_json(rout, "regions", checks = checks_df[grepl("^crosswalk|regions equal", checks_df$check), ], rows = nrow(regions))
oth21 <- regions[regions$year == 2021 & regions$region != "Russia", ]; oth21 <- oth21[order(-oth21$osh), ]
message("  Other's revenue share in 2021 (regions above 15 percent): ", if (any(oth21$osh > 15)) paste(sprintf("%s %d%% (division %s %d%%)", oth21$region[oth21$osh > 15], oth21$osh[oth21$osh > 15], ind_pad(oth21$od[oth21$osh > 15]), oth21$ods[oth21$osh > 15]), collapse = "; ") else "none")
message(sprintf("  industry: %d years, %s 25 km cell-years, %d city windows, %d region-years", length(years), motion_count(sum(vapply(g25, function(z) z$count, 0))), length(city1), nrow(regions)))
