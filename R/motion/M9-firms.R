# M9: registered addresses per financial year for the atlas's firms view (round 5, 23 October 2026).
# One record per distinct address (1 m rounding) of located eligible firms on no supplied list with
# below-city-level geocodes, 2014-2025, nationally: the firms at the address, those with a statement,
# those with a usable baseline and a revenue value, and the address's relative revenue class (the
# median of those firms' change against their own 2019-2021 average, minus the year's national
# median of the drawn firms on no list, under the manifest's breaks). The definitions are M6's with
# the national scope (M6-common.R, as M8). Output (version 4, round 31): every address of every year once in
# motion/data/firms/firms-coords.bin.gz, and per year a gzipped little-endian binary with a presence bitmap over those
# addresses and the year's columns (n u16, a u16, f u16, rv u16, cls u8, and the eight (ind, ish) pairs: the divisions with
# revenue at the address by share descending, industry-common.R), and the manifest firms.json. No identifiers leave
# DuckDB; these files name no firm (they hold firms on no list). Listed firms, with their names, are in treatednational.json.
# Run: scripts/lab-run.sh --max 14G --duck-mem 9GB --duck-threads 6 --duck-temp 60GB --cpu 800% Rscript --vanilla R/motion/M9-firms.R a rel charcoal national
source(file.path(Sys.getenv("LAB_ROOT"), "R", "lab.R")); lab_init()
source(lab_path("R", "motion", "motion-common.R"))
con <- lab_duck_connect(); on.exit(lab_duck_disconnect(con))
source(lab_path("R", "motion", "M6-common.R"))
source(lab_path("R", "motion", "industry-common.R"))
if (SCOPE != "national") stop("M9 runs with the national scope: Rscript --vanilla R/motion/M9-firms.R a rel charcoal national")
if (!CANONICAL) stop("M9 writes only the canonical variant: ramp a, the default metric, the charcoal look")
DIR <- "firms"; out_dir <- lab_dir("motion", "data", DIR)
unlink(list.files(out_dir, pattern = "^firms-.*\\.bin(\\.gz)?$", full.names = TRUE))
nat <- motion_read_json("national"); msk <- motion_read_json("points"); facts <- motion_read_json("series")$facts
titles <- ind_titles()

# ---- the binary layout ------------------------------------------------------------------------------
# Header (32 bytes): magic 'FRM1', u32 records, u32 the coordinates' count (an origin x until version 3), i32 0, u16 year, u16 version (4 since round 31), 12 padding bytes that
# carry the author's initials and the year, 'AGK 2026' then zeros (round 10, the author's item 17; the page's parser ignores them).
FRM1_PAD <- { p <- raw(12); b <- charToRaw("AGK 2026"); p[seq_along(b)] <- b; p }
GZ_COMMENT <- "by Armen G. Kaprelian"   # written into each twin's gzip header as the RFC 1952 comment field (FCOMMENT); the bytes inside are unchanged
gz_comment <- function(path, comment) {   # set FLG bit 4 and insert the zero-terminated comment after the ten-byte header
  b <- readBin(path, "raw", file.info(path)$size)
  stopifnot(b[1] == as.raw(0x1f), b[2] == as.raw(0x8b), bitwAnd(as.integer(b[4]), 16L) == 0L)
  b[4] <- as.raw(bitwOr(as.integer(b[4]), 16L))
  writeBin(c(b[1:10], charToRaw(comment), as.raw(0), b[-(1:10)]), path)
}
gz_comment_read <- function(path) { b <- readBin(path, "raw", 80L); if (bitwAnd(as.integer(b[4]), 16L) == 0L) return(""); e <- which(b[-(1:10)] == as.raw(0))[1]; rawToChar(b[11:(9 + e)]) }
# Columns in descending element size so every typed-array view is aligned without padding.
# Version 3 (author's correction, 25 October 2026): after f comes rv, a u16 log code of the summed revenue at the address
# (thousands of rubles in the source: 10^((rv - 1) / 100), 0 without revenue), then cls and eight (ind, ish) pairs, the
# divisions with revenue at the address by share descending (255 and 0 beyond the present ones); ind1 and ish1 are the
# leader of version 2. Every firm at the address with a statement and a positive revenue value counts, listed ones included.
MIXK <- 8L
u16 <- function(v) { v <- as.integer(v); if (any(v < 0 | v > 65535)) stop("u16 overflow"); ifelse(v > 32767L, v - 65536L, v) }
# Version 4 (round 31): the years shared most of their addresses, and the coordinates were 8 of each record's 33 bytes and most of
# the gzipped size. firms-coords.bin.gz (magic 'FRC1', the same 32-byte header with the count, version 4) holds every address of every
# year once, sorted by x then y, as two i32 columns: x as the step from the previous address, and y as the step from the previous
# address where x repeats, else y itself. A year's file (magic 'FRM1', version 4; the header's third field is the coordinates' count)
# holds a bitmap over those addresses (bit i of byte i >> 3 for address i, lowest bit first, padded to whole 32-bit words so the u16
# columns stay aligned) and then the year's columns for the present addresses in the coordinates' order: n, a, f, rv u16, cls u8 and
# the eight (ind, ish) pairs.
header <- function(f, magic, n, third, year) {
  writeBin(charToRaw(magic), f); writeBin(as.integer(c(n, third, 0L)), f, size = 4L, endian = "little")
  writeBin(as.integer(c(year, 4L)), f, size = 2L, endian = "little"); writeBin(FRM1_PAD, f)
}
read_header <- function(g) list(magic = rawToChar(readBin(g, "raw", 4L)), n = readBin(g, "integer", 1L, size = 4L, endian = "little"), third = readBin(g, "integer", 1L, size = 4L, endian = "little"),
                                zero = readBin(g, "integer", 1L, size = 4L, endian = "little"), year = readBin(g, "integer", 1L, size = 2L, endian = "little"),
                                ver = readBin(g, "integer", 1L, size = 2L, endian = "little"), pad = { p <- readBin(g, "raw", 12L); rawToChar(p[p != as.raw(0)]) })
write_coords <- function(path, x, y) {
  f <- file(path, "wb"); on.exit(close(f)); header(f, "FRC1", length(x), 0L, 0L)
  dx <- c(x[1], diff(x)); same <- c(FALSE, diff(x) == 0L); dy <- ifelse(same, c(y[1], diff(y)), y)
  writeBin(as.integer(dx), f, size = 4L, endian = "little"); writeBin(as.integer(dy), f, size = 4L, endian = "little")
  invisible(32L + 8L * length(x))
}
read_coords <- function(path) {   # through gzfile: the header and both columns, the deltas undone
  g <- gzfile(path, "rb"); on.exit(close(g)); h <- read_header(g)
  dx <- readBin(g, "integer", h$n, size = 4L, endian = "little"); dy <- readBin(g, "integer", h$n, size = 4L, endian = "little")
  start <- c(TRUE, dx[-1] != 0L); cs <- cumsum(as.numeric(dy)); before <- (cs - dy)[start]   # y restarts where x changes
  x <- as.integer(cumsum(as.numeric(dx))); y <- as.integer(cs - before[cumsum(start)])
  c(h, list(x = x, y = y))
}
bitmap_words <- function(U) (U + 31L) %/% 32L
write_year <- function(path, year, d, idx, U) {
  bits <- logical(32L * bitmap_words(U)); bits[idx] <- TRUE
  f <- file(path, "wb"); on.exit(close(f)); header(f, "FRM1", nrow(d), U, year)
  writeBin(packBits(bits, "raw"), f)
  writeBin(u16(d$n), f, size = 2L, endian = "little"); writeBin(u16(d$a), f, size = 2L, endian = "little"); writeBin(u16(d$f), f, size = 2L, endian = "little"); writeBin(u16(d$rv), f, size = 2L, endian = "little")
  writeBin(as.raw(d$cls), f)
  for (k in seq_len(MIXK)) { writeBin(as.raw(d[[sprintf("ind%d", k)]]), f); writeBin(as.raw(d[[sprintf("ish%d", k)]]), f) }
  invisible(32L + 4L * bitmap_words(U) + (9L + 2L * MIXK) * nrow(d))
}
read_back <- function(path, C) {   # through gzfile: the header, the bitmap and the first and last records, their coordinates from the coordinates file
  g <- gzfile(path, "rb"); on.exit(close(g)); h <- read_header(g)
  idx <- which(rawToBits(readBin(g, "raw", 4L * bitmap_words(h$third))) == as.raw(1)); n <- h$n
  nn <- readBin(g, "integer", n, size = 2L, signed = FALSE, endian = "little"); a <- readBin(g, "integer", n, size = 2L, signed = FALSE, endian = "little")
  ff <- readBin(g, "integer", n, size = 2L, signed = FALSE, endian = "little"); rv <- readBin(g, "integer", n, size = 2L, signed = FALSE, endian = "little"); cls <- as.integer(readBin(g, "raw", n))
  mix <- lapply(seq_len(2L * MIXK), function(k) as.integer(readBin(g, "raw", n)))   # ind1, ish1, ..., ind8, ish8
  ind <- mix[[1]]; ish <- mix[[2]]; K <- 2L * MIXK; x <- C$x[idx]; y <- C$y[idx]
  c(h, list(present = length(idx),
       first = c(x[1], y[1], nn[1], a[1], ff[1], rv[1], cls[1], ind[1], ish[1], mix[[K - 1]][1], mix[[K]][1]), last = c(x[n], y[n], nn[n], a[n], ff[n], rv[n], cls[n], ind[n], ish[n], mix[[K - 1]][n], mix[[K]][n]),
       sum_n = sum(nn), sum_a = sum(a), sum_f = sum(ff), by_ind = tabulate(ind_class_of(ind) + 1L, nbins = 10L)))
}
gzip_marked <- function(raw_path) {
  if (system2("gzip", c("-9", "-n", "-f", shQuote(raw_path))) != 0) stop("gzip failed for ", raw_path)   # -n: no name or mtime in the header, so a re-run with the same bytes is byte-identical (round 10)
  gz <- paste0(raw_path, ".gz"); gz_comment(gz, GZ_COMMENT); gz
}
KEEP <- c("x_m", "y_m", "n", "a", "f", "rv", "cls", as.vector(rbind(sprintf("ind%d", seq_len(MIXK)), sprintf("ish%d", seq_len(MIXK)))))
dl <- list()

# ---- per year -----------------------------------------------------------------------------------------
cls_sql <- paste0("CASE WHEN f = 0 THEN 0 ELSE 1", paste(sprintf(" + CAST(med > %d AS INTEGER)", BREAKS), collapse = ""), " END")
years_out <- list(); files <- list(); checks_rows <- list()
for (yy in years) {
  # Round 9: the division with the largest share of nominal revenue at the address (firms with a statement and a positive
  # revenue value that year; ties to the lower code) and its share; 255 and 0 where no firm has a revenue value.
  cte <- sprintf("WITH p AS (SELECT round(x_km, 3) AS px, round(y_km, 3) AS py, count(*) AS n, count(*) FILTER (WHERE filed) AS a,
                                     count(*) FILTER (WHERE pct IS NOT NULL) AS f, quantile_cont(%s, 0.5) AS med
                              FROM fym WHERE year = %d AND NOT treated AND NOT city_level GROUP BY 1, 2),
                      r AS (SELECT round(x_km, 3) AS px, round(y_km, 3) AS py, %s AS div, sum(line_2110) AS rev, count(*) AS nf
                            FROM fym WHERE year = %d AND NOT city_level AND filed AND line_2110 > 0 GROUP BY 1, 2, 3),
                      t AS (SELECT px, py, sum(rev) AS rt, sum(nf) AS nr, count(*) AS nd FROM r GROUP BY 1, 2),
                      w AS (SELECT r.px, r.py, list(r.div ORDER BY r.rev DESC, r.div) AS divs, list(CAST(round(100 * r.rev / t.rt) AS INTEGER) ORDER BY r.rev DESC, r.div) AS shares
                            FROM r JOIN t USING (px, py) GROUP BY r.px, r.py)", PCOL, yy, ind_div_sql("industry2"), yy)
  mixcols <- paste(sprintf("coalesce(w.divs[%d], 255) AS ind%d, coalesce(w.shares[%d], 0) AS ish%d", seq_len(MIXK), seq_len(MIXK), seq_len(MIXK), seq_len(MIXK)), collapse = ", ")
  d <- lab_query(con, sprintf("%s SELECT CAST(round(p.px * 1000) AS INTEGER) AS x_m, CAST(round(p.py * 1000) AS INTEGER) AS y_m, p.n, p.a, p.f, %s AS cls, %s,
                                        coalesce(t.nr, 0) AS nr, coalesce(t.nd, 0) AS nd, CASE WHEN t.rt > 0 THEN greatest(0, CAST(round(100 * log10(t.rt)) AS INTEGER)) + 1 ELSE 0 END AS rv
                               FROM p LEFT JOIN w ON w.px = p.px AND w.py = p.py LEFT JOIN t ON t.px = p.px AND t.py = p.py ORDER BY x_m, y_m", cte, cls_sql, mixcols), sprintf("addresses %d", yy))
  for (col in c(sprintf("ind%d", seq_len(MIXK)), sprintf("ish%d", seq_len(MIXK)), "nr", "nd", "rv")) d[[col]] <- as.integer(d[[col]])
  d$ind <- d$ind1; d$ish <- d$ish1
  cdm <- as.matrix(d[sprintf("ind%d", seq_len(MIXK))]); shm <- as.matrix(d[sprintf("ish%d", seq_len(MIXK))])
  mix_bad <- 0L; for (k in 2:MIXK) mix_bad <- mix_bad + sum((cdm[, k] == 255L & shm[, k] != 0L) | (cdm[, k - 1] == 255L & cdm[, k] != 255L) | (cdm[, k] != 255L & shm[, k] > shm[, k - 1]))
  nrev_direct <- lab_query(con, sprintf("%s SELECT coalesce(sum(t.nr), 0) AS n FROM t JOIN p USING (px, py)", cte), sprintf("firms with revenue at the addresses %d", yy))$n[1]
  nolisted_only <- lab_query(con, sprintf("%s SELECT count(*) AS n FROM p WHERE p.a = 0 AND EXISTS (SELECT 1 FROM fym z WHERE z.year = %d AND z.treated AND z.filed AND z.line_2110 > 0 AND NOT z.city_level AND round(z.x_km, 3) = p.px AND round(z.y_km, 3) = p.py)", cte, yy), sprintf("addresses whose only statements are listed firms' %d", yy))$n[1]
  legacy <- lab_query(con, sprintf("SELECT coalesce(industry2, '__MISSING__') AS code, count(*) AS n FROM fym WHERE year = %d AND NOT treated AND NOT city_level AND filed AND line_2110 > 0 AND coalesce(industry2, '__MISSING__') IN (%s) GROUP BY 1", yy, paste(sprintf("'%s'", IND_LEGACY), collapse = ", ")), sprintf("legacy codes %d", yy))
  dl[[as.character(yy)]] <- d[KEEP]
  m8 <- nat$counts[[as.character(yy)]]
  years_out[[as.character(yy)]] <- list(addresses = nrow(d), firms = sum(d$n), statements = sum(d$a), filers = sum(d$f), by_cls = as.integer(tabulate(d$cls + 1L, nbins = 7L)),
                                        by_ind = as.integer(tabulate(ind_class_of(d$ind) + 1L, nbins = 10L)), addresses_with_revenue = sum(d$ind != 255L), firms_with_revenue = sum(d$nr), nodiv_dominant = sum(d$ind == 0L), addresses_fully_listed = sum(d$ind != 255L & d$nd <= MIXK), divisions_max = max(d$nd),
                                        legacy_codes = as.list(setNames(as.integer(legacy$n), legacy$code)),
                                        max_at_address = max(d$n), addresses_100plus = sum(d$n >= 100), firms_at_100plus = sum(d$n[d$n >= 100]),
                                        city_level = m8$city_level, listed = m8$treated)
  checks_rows[[as.character(yy)]] <- rbind(
    motion_check(sprintf("%d: firms at the addresses equal M8's drawn firms", yy), m8$drawn, sum(d$n)),
    motion_check(sprintf("%d: filers with a value equal M8's filers_base", yy), m8$filers_base, sum(d$f)),
    motion_check(sprintf("%d: an address has a class exactly when it has a filer with a value", yy), 0, sum((d$cls > 0) != (d$f > 0))),
    motion_check(sprintf("%d: industry bytes within 255, 0 and the 88 divisions", yy), 0, sum(!(cdm %in% c(255L, 0L, IND_DIVS)))),
    motion_check(sprintf("%d: mix rows: 255 with share 0 beyond the present divisions, and shares never rise along the rows", yy), 0, mix_bad),
    motion_check(sprintf("%d: mix rows: the rounded shares of an address sum to at most 100 + 4", yy), 0, sum(rowSums(shm) > 104L)),
    motion_check(sprintf("%d: rv is 0 exactly for an address without a revenue value", yy), 0, sum((d$rv == 0L) != (d$ind == 255L))),
    motion_check(sprintf("%d: an address lists every division when it has eight or fewer", yy), 0, sum(d$nd <= MIXK & rowSums(cdm != 255L) != d$nd)),
    motion_check(sprintf("%d: the leading share is 0 exactly for an unknown address and 1 to 100 otherwise", yy), 0, sum((d$ind == 255L) != (d$ish == 0L)) + sum(d$ish > 100)),
    motion_check(sprintf("%d: an address is unknown exactly when no firm there has a revenue value", yy), 0, sum((d$ind == 255L) != (d$nr == 0L))),
    motion_check(sprintf("%d: firms with a revenue value over the addresses equal a direct count", yy), nrev_direct, sum(d$nr)),
    motion_check(sprintf("%d: an address with a revenue value but no statement among its own firms has a listed firm with a revenue value at the pair", yy), nolisted_only, sum(d$ind != 255L & d$a == 0L)))
  # The Moscow extents: M6's rule (raw coordinates inside the inclusive bounds, then 1 m rounding) reproduced in
  # SQL equals M6's piles exactly; the file's subset by rounded coordinates may differ at the rectangle's edge
  # by the addresses whose rounding crosses a bound (recorded, at most a handful).
  for (ext in c("city", "downtown")) {
    e <- msk$extents[[ext]]; c6 <- msk$counts[[ext]][[as.character(yy)]]
    sq <- lab_query(con, sprintf("WITH p AS (SELECT round(x_km, 3) AS px, round(y_km, 3) AS py, count(*) AS n FROM fym WHERE year = %d AND NOT treated AND NOT city_level AND x_km BETWEEN %.9f AND %.9f AND y_km BETWEEN %.9f AND %.9f GROUP BY 1, 2) SELECT count(*) AS piles, sum(n) AS firms FROM p", yy, e$xmin, e$xmax, e$ymin, e$ymax), sprintf("%d %s piles under M6's rule", yy, ext))
    inside <- d$x_m >= e$xmin * 1000 - 0.5 & d$x_m <= e$xmax * 1000 + 0.5 & d$y_m >= e$ymin * 1000 - 0.5 & d$y_m <= e$ymax * 1000 + 0.5
    checks_rows[[as.character(yy)]] <- rbind(checks_rows[[as.character(yy)]],
      motion_check(sprintf("%d: M6's pile rule in the Moscow %s extent reproduces M6's piles", yy, ext), c6$piles, sq$piles[1]),
      motion_check(sprintf("%d: and their firms equal M6's marks (%s)", yy, ext), c6$marks_firms, sq$firms[1]),
      motion_check(sprintf("%d: the file's addresses inside the %s extent differ from M6's piles only at the edge (at most 4)", yy, ext), 1, as.integer(abs(sum(inside) - c6$piles) <= 4)))
  }
  message(sprintf("  %d: %s addresses (%s with a revenue value), %s firms, %s with a statement", yy, format(nrow(d), big.mark = ","), format(sum(d$ind != 255L), big.mark = ","), format(sum(d$n), big.mark = ","), format(sum(d$a), big.mark = ",")))
}
# ---- the files (version 4, round 31) ---------------------------------------------------------------------
# Every address of every year once, sorted by x then y; each year's rows are already in that order (ORDER BY x_m, y_m).
key_of <- function(x, y) (as.numeric(x) + 8388608) * 16777216 + (as.numeric(y) + 8388608)   # exact in a double: |x|, |y| < 2^23 m
stopifnot(all(vapply(dl, function(d) all(abs(d$x_m) < 8388608 & abs(d$y_m) < 8388608), TRUE)))
keys <- sort(unique(unlist(lapply(dl, function(d) key_of(d$x_m, d$y_m)), use.names = FALSE))); U <- length(keys)
CX <- as.integer(floor(keys / 16777216) - 8388608); CY <- as.integer(keys - floor(keys / 16777216) * 16777216 - 8388608)
coords_path <- file.path(out_dir, "firms-coords.bin"); coords_raw <- write_coords(coords_path, CX, CY); coords_gz <- gzip_marked(coords_path)
CR <- read_coords(coords_gz)
coord_checks <- motion_checks(
  motion_check("coordinates: read-back header (magic, count, version 4)", 1, as.integer(CR$magic == "FRC1" && CR$n == U && CR$ver == 4L)),
  motion_check("coordinates: read-back equals every year's addresses, sorted, once", 1, as.integer(identical(CR$x, CX) && identical(CR$y, CY))),
  motion_check("coordinates: the gzip header carries the comment field", 1, as.integer(gz_comment_read(coords_gz) == GZ_COMMENT)),
  motion_check("coordinates: raw bytes equal 32 + 8 per address", coords_raw, 32 + 8 * U))
for (yy in years) {
  d <- dl[[as.character(yy)]]; idx <- match(key_of(d$x_m, d$y_m), keys)
  raw_path <- file.path(out_dir, sprintf("firms-%d.bin", yy)); raw_bytes <- write_year(raw_path, yy, d, idx, U)
  gz_path <- gzip_marked(raw_path); gz_bytes <- file.size(gz_path); rb <- read_back(gz_path, CR)
  years_out[[as.character(yy)]]$bytes_raw <- raw_bytes; years_out[[as.character(yy)]]$bytes_gz <- gz_bytes
  files[[as.character(yy)]] <- paste0(DIR, "/", basename(gz_path))
  checks_rows[[as.character(yy)]] <- rbind(checks_rows[[as.character(yy)]],
    motion_check(sprintf("%d: every address is in the coordinates, in their order", yy), 1, as.integer(!anyNA(idx) && !is.unsorted(idx, strictly = TRUE))),
    motion_check(sprintf("%d: read-back header (magic, count, coordinates, year, version 4)", yy), 1, as.integer(rb$magic == "FRM1" && rb$n == nrow(d) && rb$third == U && rb$year == yy && rb$ver == 4L)),
    motion_check(sprintf("%d: read-back padding carries the author's mark", yy), 1, as.integer(rb$pad == "AGK 2026")),
    motion_check(sprintf("%d: gzip header carries the comment field", yy), 1, as.integer(gz_comment_read(gz_path) == GZ_COMMENT)),
    motion_check(sprintf("%d: the bitmap marks exactly the year's addresses", yy), nrow(d), rb$present),
    motion_check(sprintf("%d: read-back first and last records", yy), 1, as.integer(all(rb$first == c(d$x_m[1], d$y_m[1], d$n[1], d$a[1], d$f[1], d$rv[1], d$cls[1], d$ind1[1], d$ish1[1], d$ind8[1], d$ish8[1])) && all(rb$last == unlist(d[nrow(d), c("x_m", "y_m", "n", "a", "f", "rv", "cls", "ind1", "ish1", "ind8", "ish8")])))),
    motion_check(sprintf("%d: read-back addresses by industry class", yy), 1, as.integer(all(rb$by_ind == years_out[[as.character(yy)]]$by_ind))),
    motion_check(sprintf("%d: read-back sums (n, a, f)", yy), 1, as.integer(rb$sum_n == sum(d$n) && rb$sum_a == sum(d$a) && rb$sum_f == sum(d$f))),
    motion_check(sprintf("%d: raw bytes equal 32 + the bitmap + 25 per address", yy), raw_bytes, 32 + 4 * bitmap_words(U) + (9 + 2 * MIXK) * nrow(d)),
    motion_check(sprintf("%d: gzipped file under the 15 MB asset cap", yy), 1, as.integer(gz_bytes < 15 * 1024 * 1024)))
  message(sprintf("  %d: raw %.1f MB, gz %.1f MB", yy, raw_bytes / 1048576, gz_bytes / 1048576))
}
message(sprintf("  coordinates: %s addresses over the years, raw %.1f MB, gz %.1f MB", format(U, big.mark = ","), coords_raw / 1048576, file.size(coords_gz) / 1048576))
# The 2021 address facts of the density pass (every located eligible firm, exact coordinates).
loc21 <- lab_query(con, "WITH p AS (SELECT x_km, y_km, count(*) AS n FROM fy_all WHERE year = 2021 GROUP BY 1, 2)
                         SELECT count(*) AS addresses, max(n) AS largest, sum(n) FILTER (WHERE n >= 100) AS at_100plus, sum(n) AS firms FROM p", "2021 addresses of all located firms")
loc21r <- lab_query(con, "WITH p AS (SELECT round(x_km, 3) AS px, round(y_km, 3) AS py, count(*) AS n FROM fy_all WHERE year = 2021 GROUP BY 1, 2) SELECT count(*) AS addresses FROM p", "2021 addresses at 1 m rounding")
checks <- do.call(motion_checks, c(unname(checks_rows), list(
  motion_check("2021: distinct coordinates of all located firms equal the density pass's distinct_locations", facts$distinct_locations, loc21$addresses[1]),
  motion_check("2021: the largest address holds largest_location_firms", facts$largest_location_firms, loc21$largest[1]),
  motion_check("2021: firms at addresses with 100 or more equal firms_at_100plus_locations", facts$firms_at_100plus_locations, loc21$at_100plus[1]),
  motion_check("2021: located firms equal the density pass's national count", facts$located_2021, loc21$firms[1]),
  motion_check("12 year files written", 12, length(list.files(out_dir, pattern = "^firms-\\d{4}\\.bin\\.gz$")))), list(coord_checks, titles$checks)))

manifest <- list(
  layout = list(version = 4, header_bytes = 32, header = "magic 'FRM1' u32 | records u32 | the coordinates' count u32 | 0 i32 | year u16 | version u16 (4) | 12 padding bytes ('AGK 2026' then zeros; ignored by the parser)",
                coords = "firms-coords.bin.gz: magic 'FRC1' | count u32 | 0 i32 | 0 i32 | 0 u16 | version u16 (4) | the 12 padding bytes, then every address of every year once, sorted by x then y, as two i32 columns: dx, metres east of the previous address (the first address: x itself), and dy, metres north of the previous address where x repeats, else y itself (x and y in metres of the km plane)",
                bitmap = "after a year file's header: one bit per address of the coordinates file, bit i of byte i >> 3 for address i, lowest bit first, padded to whole 32-bit words (4 * ceiling(count / 32) bytes); set where the year has the address",
                columns = list(n = "u16 firms at the address", a = "u16 with a statement that year", f = "u16 with a usable baseline and a revenue value",
                               rv = "u16 log code of the summed revenue (line 2110, thousands of rubles) of every firm with a statement and a positive value at the address, listed firms included: 10^((rv - 1) / 100); 0 without revenue",
                               cls = "u8 relative revenue-change class of the address's filers (0 none, 1 to 6)",
                               mix = "eight (ind u8, ish u8) pairs: the divisions with revenue at the address by share descending, ish the rounded percent of the address's revenue; 255 and 0 beyond the present divisions; ind1 and ish1 are the leader (255 and 0 where no firm has a revenue value; 0 a firm without a division code)"),
                byte_order = "little-endian, struct of arrays in the column order n, a, f, rv, cls, ind1, ish1, ..., ind8, ish8 over the year's addresses in the coordinates' order, gzip -9 -n with a comment field in the header", record_bytes = 9 + 2 * MIXK, mix_rows = MIXK),
  years = years, coords = list(file = paste0(DIR, "/", basename(coords_gz)), addresses = U, bytes_raw = coords_raw, bytes_gz = file.size(coords_gz)), files = files, by_year = years_out, breaks = BREAKS, class_colours = list(dark = CLASS_COLS, light = LOOKS$light$cols), neutral = list(dark = COL_NEUTRAL, light = LOOKS$light$neutral), zero = list(dark = COL_ZERO_DARK, light = COL_ZERO_LIGHT),
  metric = METRIC_TEXT$description, median_by_year = nat$metric_median_by_year, industry = ind_tables(titles),
  rules = list(address = "one record per distinct registered address at 1 m rounding of firms on no supplied list with below-city-level geocodes; city-level geocodes and listed firms are counted in by_year and not in the files (listed firms: treatednational.json)",
               marks = "below 20 px per km: 1 px marks, 2x2 blocks for 10 or more firms, 3x3 for 100 or more, alpha by count; from 20 px per km: discs of radius min(cap, base + s * sqrt(n - 1)) / 2 with (base, s, cap) = (2, 0.6, 8) below 60 px per km and (3, 1.1, 11) above (the thresholds the atlas draws with, aligned with the Moscow extents, 24 October 2026)",
               colours = "share layer: the address's statement share in the six-class ramp with the 100 km breaks; revenue layer: cls in the blue ramp, 0 neutral; other layers neutral",
               addresses_2021 = list(all_located_exact = loc21$addresses[1], all_located_1m = loc21r$addresses[1])),
  notes = c("Registered addresses, not operating sites; firms at one address are one record.", "No firm is named or identified; the files carry counts and classes only."))
motion_save_json(manifest, "firms", checks = checks, rows = length(years))
message(sprintf("  firms: %d years and the coordinates, %.1f MB gzipped in all", length(years), (file.size(coords_gz) + sum(vapply(years_out, function(y) y$bytes_gz, 0))) / 1048576))
