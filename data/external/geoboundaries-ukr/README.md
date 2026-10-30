# geoBoundaries gbOpen UKR ADM1 (simplified), downloaded 2026-10-30T00:58:46Z

Two files fetched with curl from geoBoundaries at commit 9469f09592ced973a3448cf66b6100b741b64c0d, the commit of the RUS ADM1 file
the basemap is built from. They are untrusted data: read them with `python3 -I` or `jsonlite::fromJSON`, never execute them.

- `geoBoundaries-UKR-ADM1_simplified.geojson`:
  `https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/UKR/ADM1/geoBoundaries-UKR-ADM1_simplified.geojson`.
  It is 761,290 bytes, sha256 4a5947e7497574d51f93255dfa7e03dce0c7acf6ecee52d25773a5205854a399, equal to the Git LFS pointer's oid
  and size at that commit (checked 30 October 2026). It holds 27 features. M1-basemap.R uses only shapeISO UA-43
  ("Autonomous Republic of Crimea", 358 vertices) and UA-40 ("Sevastopol", 133 vertices). Each is one polygon without holes, and they
  do not overlap each other or the RUS file's Krasnodar Krai.
- `geoBoundaries-UKR-ADM1-metaData.json`: the same folder's metadata, 852 bytes, sha256
  6bc805a97c6511fac49dab4a48176575df612acdf49ef0f5ac154989bf269470, equal to its LFS pointer's oid and size. Its fields:
  - boundary ID UKR-ADM1-14850775, year 2017;
  - source "OpenStreetMap, Wambacher", licence Open Data Commons Open Database License 1.0, built 12 December 2023.

  These match the RUS file, so the atlas's licence lines stay as they are: geoBoundaries CC BY 4.0 (Runfola et al. 2020) and
  OpenStreetMap through Wambacher, ODbL 1.0.

Coastal shapes in this file run out to the 12-nautical-mile line. The file gives Crimea 41,591 km² against 26,081 km² of land, and
Sevastopol 3,090 km² against 864 km². M1 therefore cuts both to land with `../natural-earth/ne_10m_land_crimea-box.geojson`.

Pinned in `config/sources.json` as `boundaries.ukr-adm1` and `boundaries.ukr-adm1-meta` (`scripts/pin-sources.py --only boundaries`).
