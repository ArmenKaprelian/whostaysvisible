# Motion study: "Who stays visible?" (22 October 2026)

A Claude Motion-style explainer and an interactive atlas built from the dissertation's Chapter 2
aggregates, inside the dataviz lab. Nothing here is a research record, a manuscript source or an
authorization. Claude Motion itself (Team/Enterprise beta) is not available in this account; its
method is reproduced by hand: code animates text, charts, shapes and maps as a pure function of
time, so any frame can be sought deterministically and captured to MP4.

## Deliverables

| Piece | Path | What it is |
|---|---|---|
| Explainer | `explainer.html` (+ `js/`, `css/`, `data/*.js`) | 182 s, 12 scenes, 1920x1080 at 30 fps, dark stage; play, pause, scrub, chapter buttons; `?__render=1` capture mode; `?__debug=1` frame counter |
| Video | `build/who-stays-visible.mp4` | H.264 yuv420p, 5,460 frames, captured frame by frame through headless Brave and ffmpeg |
| Teaser | `build/who-stays-visible-teaser.mp4` | 40 s, 1,200 frames: the hook, the map through time, the Moscow zoom and the group divergence, played faster (scene `speed`), plus the closing card; `explainer.html?cut=teaser`, or the cut button on the page |
| Atlas | `explorer.html` (+ `js/explorer-app.js`) | six map layers, a 2014-2025 year slider, zoom from the country to 250 m cells, hover tooltips with counts and denominators, side charts, a provenance line on every panel, dark and light themes |
| Data | `data/*.json`, `data/*.js`, `data/*.provenance.json`, `data/*.checks.csv` | the aggregates the pages draw, each with a provenance sidecar and the checks that gated it |
| Tools | `tools/serve.py`, `tools/cdp.py`, `tools/capture.py`, `../scripts/motion-capture.sh` | static server, a stdlib DevTools client, the frame-exact capture, the host launcher with the lab bracket |

## Storyboard (explainer)

Audience: the author, then committee-adjacent colleagues. Venue: laptop or projector, 16:9. Every
number is read from `data/series.js` (`facts`) or the cell layers; none is typed into the scenes.

| # | Time | Scene | What moves | Source |
|---|---|---|---|---|
| 1 | 0-11 s | Who stays visible? | region outlines, 3.28M firms bloom as 5 km density cells, counter to 3,277,638 | `density.json`, `dot_accounting.csv` |
| 2 | 11-25 s | The archive | 63,308,662 records counter; provider bar Rosstat 2012-2018 / FNS 2019-2025; 2021 nested bars eligible, registered, with a statement; the definition line | Table B.1 source |
| 3 | 25-41 s | Availability over time | eligible and registered shares 2012-2025 drawn year by year; era shading; dotted dated events; "share up, statements down" panel | Table B.1 |
| 4 | 41-65 s | The map through time | 100 km cells by year 2014-2025 as labelled snapshots with crossfade; year, provider, national share, located share, supported-cell count | `cellsyears.json` (M5) |
| 5 | 65-77 s | The change map | 2024 against 2021, six classes revealed from the middle outward, class counts | `availability-change-cells.csv` |
| 6 | 77-103 s | Moscow and St Petersburg | camera flight national to the Moscow 90 km window (1 km cells, counts then shares) to central Moscow at 250 m, out and back into St Petersburg | `density.json` (M3), `coordinate_piles.csv` |
| 7 | 103-119 s | Who went dark | slope charts 2021 to 2024 by ownership and legal form | Figures 2.2 and 2.3 sources |
| 8 | 119-131 s | Absence and removal | 100% stacked bars of following-year states by prior statement, 2020-2024 | Figure 2.6 / Table B.2 source |
| 9 | 131-147 s | Firm size | odds ratios Q2-Q5 vs Q1 by year on a log axis, 2022 highlighted, the Q5 ratio of odds ratios 1.131 [1.062, 1.204] marked provisional | Figure 2.5 / Table B.4 sources |
| 10 | 147-163 s | Supplied lists | sanctioned-only and government-strategic-only odds against no-list firms with intervals; six-year history bins for the fixed 2019 cohort | Table B.7, Table B.13 sources |
| 11 | 163-175 s | What comes next | cohort inclusion by cell, four cohort counts, then the descriptive median real revenue change 2024 against 2021 by cell | Figure 2.8 source, `displayed-counts.csv`, `geo-revenue-change-from-2021-source.csv` |
| 12 | 175-182 s | Sources | credits and the standing caveats | - |

### Teaser cut (40 s)

| # | Time | Scene | Speed | Notes |
|---|---|---|---|---|
| 1 | 0-7.5 s | Who stays visible? | 1.47x | title, density bloom, counter |
| 2 | 7.5-17.5 s | The map through time | 2.4x | 12 annual snapshots, about 0.74 s each |
| 3 | 17.5-29 s | Moscow | 1.65x | the first 19 s of the full zoom scene: national, Moscow at 1 km, central Moscow at 250 m; St Petersburg is cut |
| 4 | 29-37.5 s | Who went dark | 1.88x | both slope charts and the reading line |
| 5 | 37.5-40 s | Sources | 2.8x | the closing card |

A scene's `speed` scales its own clock (`local` and `dur`) while fades stay in real time; the camera keyframes inside each map scene are compressed by the same factor, with holds at the scene's start and 0.5 s before its end so the camera slides only during a crossfade. Chart scenes contribute no keyframes.

## Data pass (`R/motion/`)

| Script | Mode | Output | Checks |
|---|---|---|---|
| `M1-basemap.R` | read-only | `basemap.json` (641 kB): LOD0 rings simplified by Douglas-Peucker at 1 km (58,490 of 339,862 vertices), LOD1 rings clipped to 22 city windows at 0.1 km, graticule, extents, city points | 13: parts, rings, vertex totals, equality with the production reader, origin, Moscow window, Hausdorff bound, area change, LOD1 contents |
| `M2-cells.R` | read-only | `cells100.json` (490 kB): availability by cell 2019-2024, change cells and classes, cohort inclusion for all four cohorts, list counts (under 5 suppressed), revenue and margin change by cell (under 50 observed suppressed) | 34, including 658 supported cells, class counts 73/82/109/125/145/124, cohort firms 1,485,616 and 1,164,866, cutpoints |
| `M3-density.R` | firm-level (DuckDB over the 2021 point layer) | `density.json` (1.6 MB): 5 km national cells, 1 km and 250 m cells in 22 city windows; shares only at 50+ firms; 250 m cells under 3 firms dropped | 13, including the Figure 2.7 inset counts 459,326 and 174,063 reproduced on the production extents |
| `M4-series.R` | read-only | `series.json` (53 kB): every chart series and the `facts` object | 54 manuscript values (Table B.1 shares, group shares, odds ratios, change ratios, transitions, histories, cohort counts) |
| `M5-years.R` | firm-level (DuckDB, one year per query over registry + payload) | `cellsyears.json` (2.5 MB): availability by 100 km cell 2014-2025 with registered-denominator counts, 1 km city cells 2019-2024, annual located totals | 81, including the 2021 cells equal to the production cells and every year's totals equal to the annual accounting; 2012-2013 carry no coordinates |

Run order from the lab root: `scripts/lab-ro.sh Rscript --vanilla R/motion/M1-basemap.R`, then M2 and M4
the same way, then `scripts/lab-run.sh --max 12G --duck-mem 8GB --duck-threads 8 --cpu 800% Rscript --vanilla R/motion/M3-density.R`
and the same for M5. Peak memory was 0.3 GB (M3) and 1.2 GB (M5); the ceiling is a crash guard only
(author's instruction of 22 October: no small cap on local work).

## Running and capturing

```bash
python3 -I motion/tools/serve.py --port 8765          # then open http://127.0.0.1:8765/explainer.html
scripts/motion-capture.sh --probe                      # headless Brave loads the page, prints the render metadata
scripts/motion-capture.sh --seconds 3 --out motion/build/smoke.mp4
scripts/motion-capture.sh --frames 0,45,89 --png-dir motion/build/det-a
scripts/motion-capture.sh --out motion/build/who-stays-visible.mp4 --preset slow
scripts/motion-capture.sh --page "explainer.html?cut=teaser" --out motion/build/who-stays-visible-teaser.mp4 --preset slow
```

The capture drives Brave (`/opt/brave.com/brave/brave --headless=new`) over the DevTools protocol
with a throwaway profile under the run's scratch: `Page.navigate`, `window.__ready`, then per frame
`window.__seek(i/30)` and `Page.captureScreenshot`, piped into `ffmpeg -c:v libx264 -crf 18 -pix_fmt yuv420p`.
Fallbacks in `tools/capture.py`: `--fallback brave-shot` (one process per frame) and `--fallback firefox-shot`.

## Verification

- Data: every `data/*.checks.csv` passes (13 + 34 + 13 + 54 + 81 checks); `check-readonly.sh` reported nothing changed outside the lab after each job.
- Page: all twelve scenes seek without exceptions in the browser pane and in headless Brave (`problems: []` in `logs/*-capture/capture.json`).
- Smoke render: 90 frames, 30/1, 1920x1080, 3.000 s, h264 yuv420p; about 110 ms per frame.
- Determinism: frames 0, 45 and 89 captured in two fresh Brave sessions in different orders are byte-identical (ImageMagick AE = 0); frame 0 differs from frame 45 (AE 938,811).
- Visual review: 15 frames across the scenes inspected at full size; the fixes (end-label collisions, the 2011 label, slope margins, stacked-bar labels, two overflowing lines, scene crossfades) were re-captured and rechecked.
- Full render (run `20261023T010225Z-capture`, Chrome/156 engine in Brave): 5,460 frames in 597 s (median 106 ms, max 164 ms per frame), no page exceptions or console errors; `ffprobe` reads 5,460 frames, 30/1, 1920x1080, h264 yuv420p, 182.000 s, 24.5 MB. Nine frames extracted from the MP4 at 8.5, 36, 55, 72, 93, 112, 140, 156 and 170 s were inspected (`build/final-check/`).
- Teaser render (run `20261023T011918Z-capture`): 1,200 frames in 157 s (median 133 ms per frame), no problems; `ffprobe` reads 1,200 frames, 30/1, 1920x1080, h264 yuv420p, 40.000 s, 10.9 MB. Review frames at 3, 7, 12, 17.3, 18, 21, 24, 27, 28.8, 31, 36 and 39 s were inspected before the render (`build/teaser-review/`); frames at 12, 27 and 36 s were extracted from the MP4 afterwards (`build/teaser-check/`). One defect found and fixed in review: camera holds from the chart scenes had pulled the camera off central Moscow.

## Design decisions

- Dark cinematic stage held to Tufte: no glows, gradients or 3D; motion only reveals data or moves the camera; every rate carries its denominator; one message per scene in the title line; the sequential ramp brightens with the value on the dark ground; the change ramp keeps brick for falling shares and blue for rising ones with lightness rising with magnitude.
- Discrete labelled annual snapshots; crossfades are presentation, never interpolation of values. Camera moves are pure functions of time (position cubic, zoom in log k).
- Wording stays descriptive: absence is not withdrawal or concealment; supplied lists are fixed memberships; no regional reading is put on the change map; the size widening is marked provisional.
- Disclosure: shares need 50 firms (the project's support rule); 250 m cells under 3 firms are dropped; fine-cell counts under 10 are banded in tooltips; list counts under 5 per cell are suppressed. No firm identifiers or coordinates leave the lab.
- Type: Nimbus Sans locally with Arimo (metric-compatible) as the web fallback; text at or above 22 px at 1080p, titles 54-78 px.

## Possibilities not built (ideas for a later pass)

- Per-year 250 m city cells (the M5 join could bin at 250 m; only 2021 exists today).
- Ownership and legal-form composition by cell, and an "addresses shared by 100+ firms" layer.
- A narrated version (voice-over aligned to the scene table) and a 40 s teaser cut of scenes 1, 4, 6 and 7.
- Porting the atlas into the Claude Dashboard artifact type with per-number source attribution and comments.
