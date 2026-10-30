# M1: projected and simplified region geometry for the web pages (read-only job).
# Run: scripts/lab-ro.sh Rscript --vanilla R/motion/M1-basemap.R
# Input: the pinned geoBoundaries RUS ADM1 basemap (lon/lat rings), projected with the
# production function c2rr_map_project (spherical LAEA, 100E 60N, R 6371 km). Output:
# motion/data/basemap.json: LOD0 rings simplified by Douglas-Peucker at 1 km for the national
# view, LOD1 exact rings for the regions around the city windows, graticule, extents, city
# reference points and licence lines. Coordinates are integers in 0.1 km, delta-encoded per ring. Since round 29 (30 October 2026) the
# parts also hold Crimea and Sevastopol from the pinned geoBoundaries UKR ADM1 file, cut to land with a Natural Earth extract (below).
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

# Crimea and Sevastopol (round 29, the author's decision of 30 October 2026) are drawn as regions like the rest, from geoBoundaries gbOpen
# UKR ADM1 at the RUS file's commit (shapeISO UA-43 and UA-40, renamed). That file runs coastal shapes out to the 12-nautical-mile line
# (Crimea 41,591 km2 against 26,081 of land), so each shape is intersected with Natural Earth's 1:10m land (public domain, cut to a box
# around Crimea by scripts/ne-land-extract.py; Clipper via polyclip). They join the parts here, after the production comparison above,
# which covers the RUS file only; the counts above stay the RUS file's.
ADDED <- c(`UA-43` = "Crimea", `UA-40` = "Sevastopol"); ADDED_LAND_KM2 <- c(Crimea = 26081, Sevastopol = 864)
ukr <- jsonlite::fromJSON(lab_source("boundaries.ukr-adm1", verify_hash = TRUE), simplifyVector = FALSE)
ne_land <- jsonlite::fromJSON(lab_source("boundaries.ne-land-crimea-box", verify_hash = TRUE), simplifyVector = FALSE)
geo_rings <- function(g) unlist(if (g$type == "Polygon") list(g$coordinates) else g$coordinates, recursive = FALSE)   # every ring of a (Multi)Polygon
as_contour <- function(xy) list(x = xy[-nrow(xy), 1], y = xy[-nrow(xy), 2])
contour_signed <- function(cn) { n <- length(cn$x); j <- c(2:n, 1L); sum(cn$x * cn$y[j] - cn$x[j] * cn$y) / 2 }
in_contour <- function(px, py, cn) { x <- cn$x; y <- cn$y; j <- c(length(x), seq_len(length(x) - 1L)); sum(((y > py) != (y[j] > py)) & (px < (x[j] - x) * (py - y) / (y[j] - y + 1e-12) + x)) %% 2 == 1 }
closed <- function(cn) { m <- cbind(cn$x, cn$y); rbind(m, m[1, ]) }
land_box <- lapply(unlist(lapply(ne_land$features, function(f) geo_rings(f$geometry)), recursive = FALSE), function(r) as_contour(project_ring(r)))
added <- list(); added_dropped <- 0
for (f in ukr$features) {
  iso <- f$properties$shapeISO; if (!iso %in% names(ADDED)) next
  shape <- lapply(geo_rings(f$geometry), function(r) as_contour(project_ring(r)))
  cut <- polyclip::polyclip(shape, land_box, op = "intersection", fillA = "evenodd", fillB = "evenodd")
  sa <- vapply(cut, contour_signed, 0); outer_sign <- sign(sa[which.max(abs(sa))])   # the largest contour is an outer boundary, whichever way Clipper turns it
  keep <- abs(sa) >= 0.5; added_dropped <- added_dropped + sum(!keep)   # slivers under half a square kilometre where the two coasts nearly meet
  outers <- cut[keep & sign(sa) == outer_sign]; holes <- cut[keep & sign(sa) != outer_sign]
  owner <- vapply(holes, function(h) { k <- which(vapply(outers, function(o) in_contour(h$x[1], h$y[1], o), NA)); if (length(k)) k[1] else NA_integer_ }, 0L)
  for (k in seq_along(outers)) added[[length(added) + 1L]] <- list(name = unname(ADDED[iso]), part = k, rings = c(list(closed(outers[[k]])), lapply(holes[which(owner == k)], closed)))
}
added_names <- vapply(added, `[[`, "", "name")
added_km2 <- vapply(names(ADDED_LAND_KM2), function(nm) sum(vapply(added[added_names == nm], function(p) abs(contour_signed(as_contour(p$rings[[1]]))) - sum(vapply(p$rings[-1], function(r) abs(contour_signed(as_contour(r))), 0)), 0)), 0)
parts <- c(parts, added)
n_rings_all <- sum(vapply(parts, function(p) length(p$rings), 0L))

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

# The land as one outline (round 14, 25 October 2026): the union of every part, so the atlas fills the country without its internal borders, at five
# tolerances for the national zooms (the atlas uses a level only while its tolerance stays under 0.3 CSS px, and lod0 above; the video keeps lod0).
# The union is Clipper's (polyclip, nonzero fill) after orienting each part's first ring counter-clockwise and its other rings clockwise, so holes stay holes
# and parts that touch or overlap merge.
ring_signed <- function(xy) sum(xy[-nrow(xy), 1] * xy[-1, 2] - xy[-1, 1] * xy[-nrow(xy), 2]) / 2
orient <- function(xy, ccw) if ((ring_signed(xy) > 0) != ccw) xy[nrow(xy):1, , drop = FALSE] else xy
contours_of <- function(ps) unlist(lapply(ps, function(p) lapply(seq_along(p$rings), function(r) { xy <- orient(p$rings[[r]], r == 1L); list(x = xy[-nrow(xy), 1], y = xy[-nrow(xy), 2]) })), recursive = FALSE)
# Round 29: the RUS parts' union is formed alone, as before, so its rings stay exactly as they were (Clipper's integer grid takes its
# origin from the input's extent, and Crimea lies west of every RUS part); the added regions' union follows it, and a check confirms the
# two never overlap (the area check below cannot see an overlap between unions formed apart).
union_rus <- polyclip::polysimplify(contours_of(parts[seq_len(n_parts)]), filltype = "nonzero", eps = 1e-4)
union_add <- polyclip::polysimplify(contours_of(added), filltype = "nonzero", eps = 1e-4)
added_overlap_km2 <- sum(abs(vapply(polyclip::polyclip(union_rus, union_add, op = "intersection", fillA = "nonzero", fillB = "nonzero", eps = 1e-4), contour_signed, 0)))
land_union <- lapply(c(union_rus, union_add), function(r) { xy <- cbind(r$x, r$y); rbind(xy, xy[1, ]) })
area_parts <- sum(vapply(parts, function(p) abs(ring_signed(p$rings[[1]])) - sum(vapply(p$rings[-1], function(xy) abs(ring_signed(xy)), 0)), 0))
area_union <- sum(vapply(land_union, ring_signed, 0))
land_tols <- c(16, 8, 4, 2, 1)
# A small island collapses under a coarse tolerance, and simplify_ring then returns it at full detail; here it steps down by quarters until it keeps three vertices.
simplify_land <- function(xy, tol) { t <- tol; repeat { r <- simplify_ring(xy, t); if (nrow(r) < nrow(xy) || t < 0.01) return(r); t <- t / 4 } }
land_levels <- lapply(land_tols, function(t) { rs <- lapply(land_union, simplify_land, tol = t); list(tol = t, rings = rs, haus = max(mapply(ring_hausdorff, land_union, rs)), vertices = sum(vapply(rs, nrow, 0L)) - length(rs)) })
haus <- unlist(lapply(seq_along(parts), function(i) vapply(seq_along(parts[[i]]$rings), function(r) ring_hausdorff(parts[[i]]$rings[[r]], lod0[[i]]$rings[[r]]), 0)))
area_in <- sum(unlist(lapply(parts, function(p) vapply(p$rings, shoelace, 0))))
area_out <- sum(unlist(lapply(lod0, function(p) vapply(p$rings, shoelace, 0))))
n_vertices_lod0 <- sum(unlist(lapply(lod0, function(p) vapply(p$rings, nrow, 0L)))) - n_rings_all

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

# Graticule for the pages (round 10, 25 October 2026; the production figure keeps its own ranges): meridians every 20 degrees around the
# full circle from 10 N to the pole, so the far-side lines fan upward from the pole and fill the band the stage shows beyond it, and
# parallels every 10 degrees from 10 N to 80 N as closed rings (the author's screenshot had the lines ending below the top of the map;
# round 11 moved the southern end from 20 N to 10 N, since the zoom floor at three-quarters of the fit showed the ends near the bottom of a
# 1,600 by 1,000 view).
grat <- c(lapply(seq(0, 340, 20), function(lon) c2rr$c2rr_map_project(lon, seq(10, 90, length.out = 81))),
          lapply(seq(10, 80, 10), function(lat) c2rr$c2rr_map_project(seq(0, 360, length.out = 181), lat)))
pole_xy <- c2rr$c2rr_map_project(100, 90)

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
  lod0 = list(tolerance_km = tol_km, part_count = length(lod0), parts = encode_parts(lod0)),   # part_count: the explainer checks its load against it (round 29)
  land = list(rule = "the union of every part (Clipper via polyclip, nonzero fill after orienting outer rings counter-clockwise and holes clockwise), simplified by Douglas-Peucker at each tolerance; filled even-odd; for the atlas's national zooms only, each level while its tolerance stays under 0.3 CSS px",
              levels = lapply(land_levels, function(L) list(tolerance_km = L$tol, rings = lapply(L$rings, encode_ring)))),
  lod1 = list(tolerance_km = tol1_km, grow_km = grow1_km, use_when_px_per_km_at_least = 9,
              windows = lapply(lod1, function(w) list(label = w$label, box = w$box, region_names = w$region_names, parts = encode_parts(w$parts)))),
  graticule = lapply(grat, encode_line),
  source = raw$source,
  source_added = list(list(title = "geoBoundaries gbOpen UKR ADM1, provider simplified: UA-43 as Crimea and UA-40 as Sevastopol",
                           boundary_id = "UKR-ADM1-14850775", year_represented = "2017", build_date = "Dec 12, 2023", provider = "OpenStreetMap, Wambacher",
                           provider_license = "Open Data Commons Open Database License 1.0", geoboundaries_acknowledgement = raw$source$geoboundaries_acknowledgement,
                           url = "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/UKR/ADM1/geoBoundaries-UKR-ADM1_simplified.geojson",
                           pinned_commit = "9469f09592ced973a3448cf66b6100b741b64c0d", attribution_url = raw$source$attribution_url,
                           processing = "the two shapes only, renamed, projected and intersected with Natural Earth 1:10m land v5.1.2 (public domain) inside lon 32 to 37, lat 44 to 46.5, since the file runs coastal shapes out to the 12-nautical-mile line")),
  notes = c("Boundaries: geoBoundaries.org gbOpen RUS ADM1, and UKR ADM1 for Crimea and Sevastopol (CC BY 4.0); OpenStreetMap/Wambacher (2017), ODbL 1.0; the two UKR shapes cut to land with Natural Earth 1:10m land (public domain).",
            "The outline omits the occupied parts of Donetsk, Luhansk, Zaporizhzhia and Kherson; firms located there keep their cells.",
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
  motion_check("St Petersburg LOD1 window holds Saint Petersburg and Leningrad oblast", 2, sum(c("Saint Petersburg", "Leningrad oblast") %in% lod1$`St Petersburg`$region_names)),
  motion_check("graticule: 18 meridians and 8 parallels", 26, length(grat)),
  motion_check("graticule: every meridian ends within 0.05 km of the pole", 0, sum(vapply(grat[1:18], function(xy) sqrt(sum((xy[nrow(xy), ] - pole_xy)^2)), 0) > 0.05)),
  motion_check("graticule: every parallel is closed (first and last vertex within 1e-6 km)", 0, sum(vapply(grat[19:26], function(xy) sqrt(sum((xy[nrow(xy), ] - xy[1, ])^2)), 0) > 1e-6)),
  motion_check("land union: area against the parts' own areas (percent, abs)", 0, 100 * abs(area_union - area_parts) / area_parts, 0.05),
  motion_check("land union: five levels, coarsest first", 5, sum(diff(vapply(land_levels, `[[`, 0, "tol")) < 0) + 1),
  motion_check("land levels: rings with a dropped vertex farther than the level's tolerance (count)", 0, sum(vapply(land_levels, function(L) as.integer(L$haus > L$tol + 1e-9), 0L))),
  motion_check("land levels: vertices never fall as the tolerance falls (count of decreases)", 0, sum(diff(vapply(land_levels, `[[`, 0, "vertices")) < 0)),
  motion_check("added regions (round 29): Crimea and Sevastopol each have at least one part", 2, length(intersect(unique(added_names), ADDED))),
  motion_check("added regions: Crimea's land against 26,081 km2 (percent, abs)", 0, 100 * abs(added_km2[["Crimea"]] - 26081) / 26081, 10),
  motion_check("added regions: Sevastopol's land against 864 km2 (percent, abs)", 0, 100 * abs(added_km2[["Sevastopol"]] - 864) / 864, 10),
  motion_check("added regions: LOD1 windows holding an added region (the pages draw them from LOD0)", 0, sum(vapply(lod1, function(w) any(w$region_names %in% ADDED), NA))),
  motion_check("added regions: overlap of their union with the RUS parts' union (km2)", 0, added_overlap_km2, 0.5))
message(sprintf("  added regions: %s; %d parts; %d slivers under 0.5 km2 dropped", paste(sprintf("%s %.0f km2", names(added_km2), added_km2), collapse = ", "), length(added), added_dropped))
message(sprintf("  land union: %d rings, area %.0f km2 (parts %.0f); levels %s", length(land_union), area_union, area_parts, paste(sprintf("%g km: %d vertices", land_tols, vapply(land_levels, `[[`, 0, "vertices")), collapse = ", ")))
message(sprintf("  vertices: in %d, LOD0 %d (%.1f%%), LOD1 %d in %d clipped parts over %d windows; max Hausdorff %.3f km; area change %.3f%%",
                n_vertices_in, n_vertices_lod0, 100 * n_vertices_lod0 / n_vertices_in, n_vertices_lod1, lod1_parts, length(lod1), max(haus), 100 * (area_out - area_in) / area_in))
message("  Moscow LOD1 regions: ", paste(lod1$Moscow$region_names, collapse = "; "))
motion_save_json(out, "basemap", checks = checks, rows = length(parts),
                 extra = list(added_parts = length(added), added_km2 = as.list(round(added_km2)), vertices_in = n_vertices_in, vertices_lod0 = n_vertices_lod0, vertices_lod1 = n_vertices_lod1,
                              lod1_parts = lod1_parts, max_hausdorff_km = max(haus), area_change_percent = 100 * (area_out - area_in) / area_in))
size <- file.size(lab_path("motion", "data", "basemap.json"))
if (size > 1.2e6) stop(sprintf("basemap.json is %.0f kB; raise the tolerance", size / 1e3))
