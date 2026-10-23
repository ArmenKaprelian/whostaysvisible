# M1: projected and simplified region geometry for the web pages (read-only job).
# Run: scripts/lab-ro.sh Rscript --vanilla R/motion/M1-basemap.R
# Input: the pinned geoBoundaries RUS ADM1 basemap (lon/lat rings), projected with the
# production function c2rr_map_project (spherical LAEA, 100E 60N, R 6371 km). Output:
# motion/data/basemap.json: LOD0 rings simplified by Douglas-Peucker at 1 km for the national
# view, LOD1 exact rings for the regions around the city windows, graticule, extents, city
# reference points and licence lines. Coordinates are integers in 0.1 km, delta-encoded per ring.
source(file.path(Sys.getenv("LAB_ROOT"), "R", "lab.R")); lab_init()
source(lab_path("R", "fig28", "fig28-common.R"))
source(lab_path("R", "motion", "motion-common.R"))
c2rr <- fig28_production()

tol_km <- 1.0
raw <- jsonlite::fromJSON(lab_source("fig28.basemap", verify_hash = TRUE), simplifyVector = FALSE)
stopifnot(identical(raw$coordinate_system, "lonlat"))
production <- c2rr$c2rr_map_basemap(lab_source("fig28.basemap", verify_hash = TRUE))

# Project each ring exactly as production does (closing vertex appended when missing).
project_ring <- function(z) {
  m <- do.call(rbind, lapply(z, unlist, use.names = FALSE)); storage.mode(m) <- "double"
  xy <- c2rr$c2rr_map_project(m[, 1], m[, 2])
  if (!all(xy[1, ] == xy[nrow(xy), ])) xy <- rbind(xy, xy[1, ])
  xy
}
parts <- lapply(raw$polygons, function(p) list(name = p$shapeName, part = p$part, rings = lapply(p$rings, project_ring)))
names_all <- vapply(parts, `[[`, "", "name")
n_parts <- length(parts); n_rings <- sum(vapply(parts, function(p) length(p$rings), 0L))
n_vertices_in <- sum(unlist(lapply(parts, function(p) vapply(p$rings, nrow, 0L)))) - n_rings   # closing vertices not counted
prod_vertices <- sum(unlist(lapply(production$polygons, function(p) vapply(p, nrow, 0L)))) - n_rings
same_as_production <- all(vapply(seq_len(n_parts), function(i) isTRUE(all.equal(parts[[i]]$rings, production$polygons[[i]], check.attributes = FALSE)), NA))

# Iterative Douglas-Peucker on an open chain; returns kept indices.
dp_keep <- function(xy, tol) {
  n <- nrow(xy); keep <- logical(n); keep[c(1L, n)] <- TRUE
  if (n <= 2L) return(which(keep))
  stack <- list(c(1L, n))
  while (length(stack)) {
    r <- stack[[length(stack)]]; stack[[length(stack)]] <- NULL
    i <- r[1]; j <- r[2]; if (j - i < 2L) next
    idx <- (i + 1L):(j - 1L)
    px <- xy[i, 1]; py <- xy[i, 2]; dx <- xy[j, 1] - px; dy <- xy[j, 2] - py; L2 <- dx * dx + dy * dy
    # Distance to the segment (projection clamped), not to the infinite line, so every dropped
    # vertex is within tol of the simplified ring and the Hausdorff check below holds by construction.
    t <- if (L2 == 0) rep(0, length(idx)) else pmin(1, pmax(0, ((xy[idx, 1] - px) * dx + (xy[idx, 2] - py) * dy) / L2))
    d <- sqrt((xy[idx, 1] - (px + t * dx))^2 + (xy[idx, 2] - (py + t * dy))^2)
    m <- which.max(d)
    if (d[m] > tol) { k <- idx[m]; keep[k] <- TRUE; stack[[length(stack) + 1L]] <- c(i, k); stack[[length(stack) + 1L]] <- c(k, j) }
  }
  which(keep)
}
# Closed ring (first == last): anchor at vertex 1 and the farthest vertex, simplify both chains.
simplify_ring <- function(xy, tol) {
  open <- xy[-nrow(xy), , drop = FALSE]; n <- nrow(open)
  if (n < 4L) return(xy)
  f <- which.max((open[, 1] - open[1, 1])^2 + (open[, 2] - open[1, 2])^2)
  a <- dp_keep(open[1:f, , drop = FALSE], tol)
  b_idx <- c(f:n, 1L); b <- b_idx[dp_keep(open[b_idx, , drop = FALSE], tol)]
  keep <- sort(unique(c(a, b[b != 1L])))
  if (length(keep) < 3L) return(xy)   # a ring that collapses keeps its original vertices (tiny islands)
  out <- open[keep, , drop = FALSE]; rbind(out, out[1, ])
}
# Sutherland-Hodgman clip of a closed ring to an axis-aligned box; returns a closed ring or NULL.
clip_ring <- function(xy, box) {
  pts <- xy[-nrow(xy), , drop = FALSE]
  inside <- list(function(p) p[, 1] >= box[1], function(p) p[, 1] <= box[2], function(p) p[, 2] >= box[3], function(p) p[, 2] <= box[4])
  edge_val <- list(function(p) p[, 1] - box[1], function(p) box[2] - p[, 1], function(p) p[, 2] - box[3], function(p) box[4] - p[, 2])
  for (e in 1:4) {
    if (nrow(pts) < 3L) return(NULL)
    n <- nrow(pts); prev <- pts[c(n, 1:(n - 1)), , drop = FALSE]
    v_cur <- edge_val[[e]](pts); v_prev <- edge_val[[e]](prev)
    in_cur <- v_cur >= 0; in_prev <- v_prev >= 0
    out <- vector("list", n)
    for (i in seq_len(n)) {
      if (in_cur[i]) {
        if (!in_prev[i]) { t <- v_prev[i] / (v_prev[i] - v_cur[i]); out[[i]] <- rbind(prev[i, ] + t * (pts[i, ] - prev[i, ]), pts[i, ]) } else out[[i]] <- pts[i, , drop = FALSE]
      } else if (in_prev[i]) { t <- v_prev[i] / (v_prev[i] - v_cur[i]); out[[i]] <- matrix(prev[i, ] + t * (pts[i, ] - prev[i, ]), 1) }
    }
    pts <- do.call(rbind, out)
    if (is.null(pts) || nrow(pts) < 3L) return(NULL)
  }
  rbind(pts, pts[1, ])
}
# Largest distance from a dropped vertex to the simplified ring (the DP guarantee, verified).
ring_hausdorff <- function(orig, simp) {
  o <- orig[-nrow(orig), , drop = FALSE]; s <- simp
  best <- rep(Inf, nrow(o))
  for (k in seq_len(nrow(s) - 1L)) {
    px <- s[k, 1]; py <- s[k, 2]; dx <- s[k + 1, 1] - px; dy <- s[k + 1, 2] - py; L2 <- dx * dx + dy * dy
    t <- if (L2 == 0) rep(0, nrow(o)) else pmin(1, pmax(0, ((o[, 1] - px) * dx + (o[, 2] - py) * dy) / L2))
    d <- sqrt((o[, 1] - (px + t * dx))^2 + (o[, 2] - (py + t * dy))^2)
    best <- pmin(best, d)
  }
  max(best)
}
shoelace <- function(xy) abs(sum(xy[-nrow(xy), 1] * xy[-1, 2] - xy[-1, 1] * xy[-nrow(xy), 2])) / 2

lod0 <- lapply(parts, function(p) { p$rings <- lapply(p$rings, simplify_ring, tol = tol_km); p })
haus <- unlist(lapply(seq_len(n_parts), function(i) vapply(seq_along(parts[[i]]$rings), function(r) ring_hausdorff(parts[[i]]$rings[[r]], lod0[[i]]$rings[[r]]), 0)))
area_in <- sum(unlist(lapply(parts, function(p) vapply(p$rings, shoelace, 0))))
area_out <- sum(unlist(lapply(lod0, function(p) vapply(p$rings, shoelace, 0))))
n_vertices_lod0 <- sum(unlist(lapply(lod0, function(p) vapply(p$rings, nrow, 0L)))) - n_rings

# Windows and LOD1 regions: exact rings for regions whose bounding box touches a city window grown by 60 km.
manifest <- jsonlite::fromJSON(lab_source("fig28.manifest"))
ext <- manifest$base_extents
ref <- lab_read_csv("motion.reference-points")
ref_xy <- c2rr$c2rr_map_project(ref$longitude, ref$latitude)
# Further city centres, hand-entered from common reference values; labels and preset views only.
more <- data.frame(label = c("Yekaterinburg", "Kazan", "Nizhny Novgorod", "Krasnodar", "Kaliningrad", "Rostov-on-Don", "Samara", "Chelyabinsk", "Omsk", "Ufa", "Perm", "Voronezh", "Volgograd", "Krasnoyarsk", "Irkutsk", "Khabarovsk", "Murmansk", "Tyumen"),
                   longitude = c(60.6057, 49.1221, 44.0020, 38.9769, 20.4522, 39.7015, 50.1500, 61.4291, 73.3686, 55.9578, 56.2502, 39.2003, 44.5133, 92.8672, 104.2807, 135.0719, 33.0827, 65.5343),
                   latitude = c(56.8389, 55.7887, 56.3269, 45.0355, 54.7104, 47.2357, 53.1959, 55.1644, 54.9885, 54.7388, 58.0105, 51.6720, 48.7080, 56.0153, 52.2870, 48.4802, 68.9585, 57.1530))
more_xy <- c2rr$c2rr_map_project(more$longitude, more$latitude)
cx <- c(ref_xy[, 1], more_xy[, 1]); cy <- c(ref_xy[, 2], more_xy[, 2])   # unrounded: the windows must equal the manifest extents
cities <- data.frame(label = c(ref$label, more$label), lon = c(ref$longitude, more$longitude), lat = c(ref$latitude, more$latitude),
                     x_km = round(cx, 3), y_km = round(cy, 3),
                     source = c(rep("Natural Earth 1:50m populated places (pinned reference points)", nrow(ref)), rep("hand-entered city centre, labels and preset views only", nrow(more))))
windows <- lapply(seq_len(nrow(cities)), function(i) list(label = cities$label[i], x = cx[i] + c(-45, 45), y = cy[i] + c(-45, 45)))
names(windows) <- cities$label
stopifnot(max(abs(c(windows$Moscow$x - ext$Moscow$x, windows$Moscow$y - ext$Moscow$y))) < 1e-6)
# LOD1: per city window, every part touching the window grown by 110 km, clipped to that box and
# simplified at 0.1 km. The pages use LOD1 only when the viewport lies inside the box (k >= 9 px/km).
bbox <- function(p) { m <- do.call(rbind, p$rings); c(range(m[, 1]), range(m[, 2])) }
touches <- function(bb, box) bb[1] <= box[2] && bb[2] >= box[1] && bb[3] <= box[4] && bb[4] >= box[3]
tol1_km <- 0.1; grow1_km <- 110
part_boxes <- lapply(parts, bbox)
lod1 <- lapply(seq_len(nrow(cities)), function(i) {
  box <- c(cx[i] - grow1_km, cx[i] + grow1_km, cy[i] - grow1_km, cy[i] + grow1_km)
  idx <- which(vapply(part_boxes, touches, NA, box = box))
  ps <- lapply(parts[idx], function(p) {
    rings <- Filter(Negate(is.null), lapply(p$rings, clip_ring, box = box))
    rings <- lapply(rings, simplify_ring, tol = tol1_km)
    if (!length(rings)) NULL else list(name = p$name, rings = rings)
  })
  ps <- Filter(Negate(is.null), ps)
  list(label = cities$label[i], box = box, region_names = sort(unique(vapply(ps, `[[`, "", "name"))), parts = ps)
})
names(lod1) <- cities$label
n_vertices_lod1 <- sum(unlist(lapply(lod1, function(w) unlist(lapply(w$parts, function(p) vapply(p$rings, nrow, 0L) - 1L)))))
lod1_parts <- sum(vapply(lod1, function(w) length(w$parts), 0L))

# Graticule as in production (20 degree meridians 20-180, 10 degree parallels 40-80), decimated.
grat <- c(lapply(seq(20, 180, 20), function(lon) c2rr$c2rr_map_project(lon, seq(35, 86, length.out = 60))),
          lapply(seq(40, 80, 10), function(lat) c2rr$c2rr_map_project(seq(10, 200, length.out = 96), lat)))

# Encoding: integers in 0.1 km, first vertex absolute, then deltas; the closing vertex is dropped (rings close implicitly).
encode_ring <- function(xy) { q <- round(xy[-nrow(xy), , drop = FALSE] * 10); d <- rbind(q[1, ], diff(q)); as.integer(t(d)) }
encode_parts <- function(ps) lapply(ps, function(p) list(name = p$name, rings = lapply(p$rings, encode_ring)))
encode_line <- function(xy) { q <- round(xy * 10); as.integer(t(rbind(q[1, ], diff(q)))) }

out <- list(
  projection = list(name = "spherical Lambert azimuthal equal-area", longitude_origin = 100, latitude_origin = 60, earth_radius_km = 6371,
                    units = "km", encoding = "integers in 0.1 km; each ring: x0, y0, then dx, dy deltas; closing vertex implied"),
  extents = list(national = ext$national, Moscow = ext$Moscow, `St Petersburg` = ext$`St Petersburg`),
  windows = windows,
  cities = cities,
  lod0 = list(tolerance_km = tol_km, parts = encode_parts(lod0)),
  lod1 = list(tolerance_km = tol1_km, grow_km = grow1_km, use_when_px_per_km_at_least = 9,
              windows = lapply(lod1, function(w) list(label = w$label, box = w$box, region_names = w$region_names, parts = encode_parts(w$parts)))),
  graticule = lapply(grat, encode_line),
  source = raw$source,
  notes = c("Boundaries: geoBoundaries.org gbOpen RUS ADM1 (CC BY 4.0); OpenStreetMap/Wambacher (2017), ODbL 1.0.",
            "The outline omits Crimea, Sevastopol and the occupied Ukrainian territories; firms located there keep their cells.",
            "Geometry is context, never a population, border or coordinate-validity screen."))

checks <- motion_checks(
  motion_check("polygon parts", 1637, n_parts),
  motion_check("rings", 1682, n_rings),
  motion_check("vertices in, closing vertices included (file total)", 341544, n_vertices_in + n_rings),
  motion_check("distinct vertices in (closing vertices excluded)", 339862, n_vertices_in),
  motion_check("projected rings equal the production reader", 1, as.integer(same_as_production)),
  motion_check("production vertex count agrees", n_vertices_in, prod_vertices),
  motion_check("origin projects to (0,0): |x|+|y|", 0, sum(abs(c2rr$c2rr_map_project(100, 60))), 1e-9),
  motion_check("Moscow reference point equals the manifest window centre (km)", 0, max(abs(c(ref_xy[1, 1] - mean(ext$Moscow$x), ref_xy[1, 2] - mean(ext$Moscow$y)))), 1e-6),
  motion_check("LOD0 rings with a dropped vertex farther than the tolerance (count)", 0, sum(haus > tol_km + 1e-9)),
  motion_check("area change LOD0 (percent, abs)", 0, 100 * abs(area_out - area_in) / area_in, 0.5),
  motion_check("every LOD0 ring has at least 3 distinct vertices", 1, as.integer(all(unlist(lapply(lod0, function(p) vapply(p$rings, nrow, 0L))) >= 4L))),
  motion_check("Moscow LOD1 window holds Moscow and Moscow Oblast", 2, sum(c("Moscow", "Moscow Oblast") %in% lod1$Moscow$region_names)),
  motion_check("St Petersburg LOD1 window holds Saint Petersburg and Leningrad oblast", 2, sum(c("Saint Petersburg", "Leningrad oblast") %in% lod1$`St Petersburg`$region_names)))
message(sprintf("  vertices: in %d, LOD0 %d (%.1f%%), LOD1 %d in %d clipped parts over %d windows; max Hausdorff %.3f km; area change %.3f%%",
                n_vertices_in, n_vertices_lod0, 100 * n_vertices_lod0 / n_vertices_in, n_vertices_lod1, lod1_parts, length(lod1), max(haus), 100 * (area_out - area_in) / area_in))
message("  Moscow LOD1 regions: ", paste(lod1$Moscow$region_names, collapse = "; "))
motion_save_json(out, "basemap", checks = checks, rows = n_parts,
                 extra = list(vertices_in = n_vertices_in, vertices_lod0 = n_vertices_lod0, vertices_lod1 = n_vertices_lod1,
                              lod1_parts = lod1_parts, max_hausdorff_km = max(haus), area_change_percent = 100 * (area_out - area_in) / area_in))
size <- file.size(lab_path("motion", "data", "basemap.json"))
if (size > 1.2e6) stop(sprintf("basemap.json is %.0f kB; raise the tolerance", size / 1e3))
