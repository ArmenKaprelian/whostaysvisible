# Natural Earth 1:10m land, cut to a box around Crimea (2026-10-30)

`ne_10m_land_crimea-box.geojson` is Natural Earth's 1:10m land inside lon 32 to 37, lat 44 to 46.5. It has 3 polygons and 667
vertices, is 14,826 bytes, and has sha256 ff00edddc6b97de8eb9a461a5a0732b3dba8cf718747b159d21b0daaede4f741. Natural Earth is public
domain, so it needs no licence line.

It was cut by `scripts/ne-land-extract.py` (Sutherland-Hodgman per ring) from the full file, which the lab does not keep:
- URL `https://github.com/nvkelso/natural-earth-vector/raw/f1890d9f152c896d250a77557a5751a93d494776/geojson/ne_10m_land.geojson`,
  release v5.1.2, commit f1890d9f152c896d250a77557a5751a93d494776;
- fetched with curl on 2026-10-30T01:44:30Z;
- 10,157,965 bytes, sha256 1ac90796408bc6ad6911d69448485d3c4dbf2190370080368a09976e1c9f7416;
- git blob 2d76878175b8054acd9c5a52917ee9ea59a36fc5, equal to GitHub's blob at that commit.

To make the extract again:

    python3 -I scripts/ne-land-extract.py ne_10m_land.geojson data/external/natural-earth/ne_10m_land_crimea-box.geojson

M1-basemap.R intersects the two geoBoundaries UKR ADM1 shapes it draws with this land, because the shapes run out to the
12-nautical-mile line. Measured on a 0.5 km grid, the cut leaves Crimea 26,161 km² (land reference 26,081) and Sevastopol 906 km²
(reference 864). The box holds both shapes whole. The data is untrusted: read it with `python3 -I` or `jsonlite::fromJSON`.

Pinned in `config/sources.json` as `boundaries.ne-land-crimea-box` (`scripts/pin-sources.py --only boundaries`).
