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
| Treated cut (round 2) | `explainer.html?cut=treated`, `js/treated-scenes.js`, `build/who-stays-visible-treated.mp4` | 85 s, 2,550 frames: two firms on one street, a designation, and the Moscow field 2014-2025 at three extents; local only (it needs `data/points.js`, `data/treated.js`, `data/anchors.js` and the rasters under `data/points/`, none of which is published) |
| Atlas | `explorer.html` (+ `js/explorer-app.js`) | six map layers, a 2014-2025 year slider, zoom from the country to 250 m cells, hover tooltips with counts and denominators, side charts, a provenance line on every panel, dark and light themes |
| Data | `data/*.json`, `data/*.js`, `data/*.provenance.json`, `data/*.checks.csv` | the aggregates the pages draw, each with a provenance sidecar and the checks that gated it |
| Tools | `tools/serve.py`, `tools/cdp.py`, `tools/capture.py`, `tools/audit.py`, `../scripts/motion-capture.sh` | static server, a stdlib DevTools client, the frame-exact sharded capture, the text audit, the host launcher with the lab bracket |

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
scripts/motion-capture.sh --probe --shards 1           # headless Brave loads the page, prints the render metadata
scripts/motion-capture.sh --seconds 3 --out motion/build/smoke.mp4
scripts/motion-capture.sh --frames 0,45,89 --png-dir motion/build/det-a
scripts/motion-capture.sh --out motion/build/who-stays-visible.mp4                       # 4 shards by default
scripts/motion-capture.sh --page "explainer.html?cut=teaser" --out motion/build/who-stays-visible-teaser.mp4
scripts/motion-capture.sh --page "explainer.html?cut=treated" --out motion/build/who-stays-visible-treated.mp4
scripts/motion-capture.sh --audit motion/build/audit-full.json --audit-step 6            # text boxes of every 6th frame
python3 -I motion/tools/audit.py motion/build/audit-full.json --out motion/build/audit-full.txt
```

The capture drives Brave (`/opt/brave.com/brave/brave --headless=new`) over the DevTools protocol
with a throwaway profile under the run's scratch: `Page.navigate`, `window.__ready`, then per frame
`window.__seek(i/30)` and `Page.captureScreenshot`, piped into `ffmpeg -c:v libx264 -crf 18 -pix_fmt yuv420p`.
Sharding (round 2, author's instruction of 23 October): `--shards N` (default 4) splits the frame list
into N contiguous spans on whole frames and runs one browser per span in parallel, each with its own
profile, its own ffmpeg writing `<out>.shard-i.mp4` and its own log; the parent joins the shards with
ffmpeg's concat demuxer (`-f concat -c copy`), checks the frame count and duration with `ffprobe`
against the request (and `__videoMeta` for a whole cut), removes the shard videos once the joined file passes, and writes a merged `capture.json` beside the
shard logs. `--shards 1` is the single-process path. The same sharding serves `--png-dir` and `--audit`.
Fallbacks in `tools/capture.py`: `--fallback brave-shot` (one process per frame) and `--fallback firefox-shot`.

## Verification

- Data: every `data/*.checks.csv` passes (13 + 34 + 13 + 54 + 81 checks); `check-readonly.sh` reported nothing changed outside the lab after each job.
- Page: all twelve scenes seek without exceptions in the browser pane and in headless Brave (`problems: []` in `logs/*-capture/capture.json`).
- Smoke render: 90 frames, 30/1, 1920x1080, 3.000 s, h264 yuv420p; about 110 ms per frame.
- Determinism: frames 0, 45 and 89 captured in two fresh Brave sessions in different orders are byte-identical (ImageMagick AE = 0); frame 0 differs from frame 45 (AE 938,811).
- Visual review: 15 frames across the scenes inspected at full size; the fixes (end-label collisions, the 2011 label, slope margins, stacked-bar labels, two overflowing lines, scene crossfades) were re-captured and rechecked.
- Full render (run `20261023T010225Z-capture`, Chrome/156 engine in Brave): 5,460 frames in 597 s (median 106 ms, max 164 ms per frame), no page exceptions or console errors; `ffprobe` reads 5,460 frames, 30/1, 1920x1080, h264 yuv420p, 182.000 s, 24.5 MB. Nine frames extracted from the MP4 at 8.5, 36, 55, 72, 93, 112, 140, 156 and 170 s were inspected (`build/final-check/`).
- Teaser render (run `20261023T011918Z-capture`): 1,200 frames in 157 s (median 133 ms per frame), no problems; `ffprobe` reads 1,200 frames, 30/1, 1920x1080, h264 yuv420p, 40.000 s, 10.9 MB. Review frames at 3, 7, 12, 17.3, 18, 21, 24, 27, 28.8, 31, 36 and 39 s were inspected before the render (`build/teaser-review/`); frames at 12, 27 and 36 s were extracted from the MP4 afterwards (`build/teaser-check/`). One defect found and fixed in review: camera holds from the chart scenes had pulled the camera off central Moscow.

## Round 2 (23 October 2026)

The author's feedback of 23 October asked for four things: data colours clearly apart from the navy
chrome (ColorBrewer where it fits); less text, no overlaps, text that enters and leaves with its point;
a Moscow sequence over the years with every supplied-list firm in one red "treated" bucket and firms
on no list coloured by their own revenue path; and an intro that profiles two neighbouring firms. The
author's decisions: Aeroflot anchors the story; undated list members are red from the first frame
(residents list from 2020, Decree 35); the control metric is each firm's real revenue as a percent
change against its own 2019-2021 average; the sequence is its own cut, rendered for approval, then
offered as a splice. A second note (same day) asked, before the treated scenes were written, for the
state shares, the class spread, a causal caveat in the close, and three dark meanings kept apart.

### Palette

| Role | Colours | Validation (`scripts/validate_palette.py`, dark surface `#1E2E42`) |
|---|---|---|
| Chrome | stage `#0B1A2E`, land `#1E2E42`, border `#33475E`, ink `#E8EEF4`, muted `#9FB0C2`, dim `#5F7389` | unchanged |
| Ordered quantities (availability share, cohort inclusion, atlas ordered layers) | YlGnBu, six steps resampled at even OKLab lightness: `#1D91C0 #38ADC3 #6CC5BE #A2DAB8 #D4EEB3 #FFFFD9` (five-class ramps drop the first) | monotone lightness, every gap >= 0.06, dark end 3.85:1 against the land; multi-hue by design, so the one-hue check is failed knowingly (Brewer's own six steps had two light-end gaps of 0.058 and 0.036) |
| Signed change (change map, revenue change, slope directions) | PRGn: declines `#9970AB #C2A5CF #E7D4E8`, rises `#5AAE61 #A6DBA0 #D9F0D3`, lightness rising with magnitude | each half passes as an ordinal ramp (hue spread 9 and 6 degrees) |
| Chart series | principal `#7FCDBB`, secondary `#EDF8B1`, falling `#C2A5CF`, rising `#A6DBA0` | the former brick and green tokens are retired |
| Listed (treated) firms | `#E31A1C`, 1 px outline `#FFD9D9` | reserved; 2.9:1 against the land, hence the pale outline |
| Dark control (baseline, no statement that year) | `#5A3175` | deltaE 13.8 normal / 11.0 deutan / 13.8 protan / 11.8 tritan against the effective backdrop, 14.1 / 10.7 against the land; a saturated purple separates by chroma where lightness alone could not (`#4B3D57` sat at deltaE 4.9 / 2.3 against the first backdrop) |
| Backdrop (no usable baseline) | `#B5C3D1` at alpha 0.35 over the land (effective `#536274`) | |
| Atlas light theme | the manuscript's navy ramps for ordered layers; PRGn `#762A83 ... #1B7837` for signed layers | |

### Text audit

`?__audit=1` makes `Motion.text` and every line of `Motion.paragraph` record its design-space box, its
anchor, its effective alpha and its group (a paragraph's lines, or an explicit `group` for blocks that
crossfade in place such as the year ticker). `capture.py --audit FILE [--audit-step N]` seeks every
N-th frame and stores the boxes; `tools/audit.py` reports, as time ranges: overlaps of two visible
strings of different groups by more than 15% of the smaller box, boxes outside 1920 x 1080, text under
22 px, blocks that reach 0.95 alpha within one step of appearing (no fade in) and blocks that vanish
from 0.9 alpha within one step before their scene's own fade-out (no fade out). A block is a string in
a scene at a size, or a box whose anchor is within 2 px horizontally and 14 px vertically of the
previous frame's (counters change their digits in place; labels move with the camera).

Reductions, one message per scene: the archive keeps the counter, the provider bar and one definition
sentence; availability loses the right panel's second clause and the context note (now in the credits);
the years map loses its bottom paragraph; the change map loses its explanatory paragraph; the zoom
captions are one title and one fact line each; groups, transitions and size keep one sentence; next and
credits lose a line each. Every rate keeps its denominator. Transitions: `Motion.reveal` takes `until`
(a 0.4 s fade-out before a replacing block), chart labels fade with the chart's progress (`charts.js`),
legend counts, provider labels and city labels fade rather than switch, the archive's text leaves before
the scene crossfades into the availability chart, and `Motion.camera` carries an optional scalar channel
`v` (the treated cut's year) that moves on the camera's own clock.

Results after the fixes: zero findings on the full cut (910 audited frames at step 6, 16,552 boxes),
the teaser (400 frames at step 3, since its scenes play faster) and the treated cut (425 frames at
step 6). Before the fixes the full cut had 21 findings (instant chart labels, legend counts, provider
labels, two off-canvas titles, one crossfade overlap).

### M6: the Moscow firm-level pass (`R/motion/M6-treated.R`)

Inputs: foundation `registry.YYYY` and `payload.YYYY` 2014-2025, the sanctions file (`motion.sanctioned-list`),
the five list memberships of the registry, the GDP deflator (`motion.deflator`, rebased 2021 = 1), the
archived OKVED dictionary (`motion.okved-names`) and the OKFS and OKOPF classifiers. Eligible firms in a
160 x 90 km rectangle centred on the basemap's Moscow reference point; firm-years without an identifier
(8, one in 2021) are counted and left out. Run: `scripts/lab-run.sh --max 14G --duck-mem 9GB --duck-threads 8 --cpu 800% Rscript --vanilla R/motion/M6-treated.R`
(25 s, peak 8.7 GB).

Rules (author's decisions, 23 October):
- Treated: any of the five list memberships, one firm once. Red from the minimum sanctions-file start
  year (clamped to 2014; 1,003 of the 2,220 treated firms in the rectangle carry an inferred date);
  residents-list-only firms from 2020; the 200 other undated members from the first frame.
- Firms on no list, three states: a filer with a baseline carries its revenue-change class (real revenue
  against the firm's own 2019-2021 average of original filings with positive revenue, at least two of the
  three years; a filed zero counts as -100%); a firm with a baseline and no statement that year is the
  outcome, in the dark control colour; a firm without a usable baseline is only part of the faint neutral
  backdrop (never an outcome colour). Baseline firms that filed without a revenue value (0.1-2%) stay in
  the backdrop and are counted (`base_filed_novalue`).
- City-level geocodes are not drawn (6,000-90,000 per year in the downtown rectangle) and are counted.
- Classes: six, breaks -40 / -15 / 0 / +15 / +40 percent (see the spread below; a change waits for the
  author's decision).

Outputs (local only, `motion/data/points/` and `motion/data/*.json`): 72 rasters (three 16:9 extents
centred on the Moscow point: region 160 x 90 km at k = 12, city 64 x 36 km at k = 30, downtown
21.33 x 12 km at k = 90, each drawn 1:1 when the camera rests there; per year a neutral backdrop of
every drawn firm and an outcome layer of the baseline firms), `points.json` (manifest: extents, mark
rule, colours, per-year counts and states, class counts under the current and three candidate break
sets, the pile hand-check, the deflator, rules), `treated.json` (2,220 listed firms: coordinates to
0.1 m, red-from year, flags, a 12-character filing string and a 12-character state string, pile size;
no identifiers) and `anchors.json` (Aeroflot's facts with its listing date and jurisdictions from the
file; the neighbour's facts rounded to two significant figures, never named). Marks: one per distinct
coordinate; the backdrop disc is sized by all firms at the address, `min(cap, base + s * sqrt(n - 1))`
px with (2, 0.6, 8) at the city extent and (3, 1.1, 14) downtown; the outcome disc is sized by its
baseline firms, a dark disc for the non-filers with an inner disc scaled by `sqrt(filers / baseline firms)`
in the filers' median class; the region rasters are pixel blocks (2 x 2 for 10+, 3 x 3 for 100+ firms).

Checks (163, all pass): per extent and year, firms = marks + city-level + treated, drawn firms = the three
states, outcome marks hold the baseline firms, class counts sum to the filers; the 2021 inscribed 90 km
square equals the density pass's Moscow window (762,760); the red-from histogram equals an R
recomputation from the list file with `match()`; the largest 2023 pile (2,765 firms, 906 with a
baseline, 701 filers) is reproduced in the downtown marks; Aeroflot's revenue by year equals the
exploration table and its 2022 row carries no original filing; the alignment raster's white pixels sit
at (960, 540) and (960, 420) with clear neighbours; the SME has 12 original filings with positive
revenue and no geocode drift; 72 raster files; the deflator is 1 in 2021. The page recomputes the
listed-firm counters per extent and year from `treated.json` and refuses to build the cut when they
differ from the manifest.

SME rule: the nearest firm on no list to Aeroflot with original filings and positive revenue in every
year 2014-2025, a geocode within 50 m every year, 2021 revenue between 50 million and 3 billion rubles
and an industry outside holdings, finance and real estate. Five candidates met it; the nearest is a
private limited-liability dental practice founded in 1999, 57 m away.

### What the data said (the author's four concerns)

State shares among drawn firms on no list (filers with a baseline / baseline but no statement / no
usable baseline), downtown extent: 2014 7 / 3 / 89%; 2018 18 / 4 / 77%; 2021 39 / 3 / 58%; 2022
36 / 6 / 57%; 2023 32 / 6 / 60%; 2024 29 / 6 / 63%; 2025 26 / 7 / 65%. The city and region extents
are within two points of these. Under the first colouring (non-filers dark whatever their baseline,
no-baseline filers muted) the field would have read as "most firms went dark" when the fact is that most
firms have no usable revenue baseline; the three-state rule keeps the dark colour for the 3-7% that
have a baseline and no statement. At the mark level the coloured field is dense: 73-77% of downtown
piles carry at least one filer in 2021-2025 (67-72% at the city extent), so the density-tint fallback
was not needed.

Class spread of filers (shares in the six classes, declines to rises), downtown: 2022 under the current
breaks 20.8 / 6.9 / 5.0 / 5.7 / 13.0 / 48.6 (extremes 69%); 2023 20.5 / 5.6 / 3.8 / 4.2 / 8.3 / 57.6
(78%); 2024 18.9 / 4.7 / 2.9 / 3.0 / 5.6 / 65.0 (84%). The city extent is within one point. The
distribution is wide and skewed (2023 downtown quantiles 5/10/25/50/75/90/95: -100, -89, -20, +59,
+166, +421, +828), so the proposal from the quantiles keeps zero as the midpoint and widens the upper
classes: breaks -50 / -20 / 0 / +50 / +150 give 2022 18.3 / 7.9 / 6.4 / 24.1 / 26.1 / 17.2 (extremes
36%), 2023 18.5 / 6.4 / 5.0 / 16.7 / 26.0 / 27.4 (46%), 2024 17.1 / 5.5 / 3.9 / 11.1 / 24.5 / 38.0
(55%); the flatter alternative -60 / -25 / 0 / +75 / +200 gives extremes of 28, 38 and 46%. Nothing
was changed: the rendered cut uses the current breaks, and the manifest records all three candidates.

### The treated cut (storyboard)

| # | Time | Beat | Visual | Text |
|---|---|---|---|---|
| T1 | 0-6 s | Two firms | a solid stage; two dots drift in from the edges and centre | "Two firms, 57 m apart in central Moscow"; the names under the dots |
| T2 | 6-22 s | Who are they? | side-by-side profiles revealed row by row: industry (OKVED text), legal form, ownership, founded, revenue 2021, assets 2021, a 12-cell filing strip (2014-2021 revealed here) | facts only; the neighbour is "A private firm nearby" |
| T3 | 22-30 s | Designation | Aeroflot's dot pulses and turns red, a ring expands; the strip's 2022-2025 cells reveal (2022 dark); a "Revenue 2022" row with "no statement" greyed | "19 May 2022: listed by the United Kingdom and United States" / "No 2022 statement in the archive; back in 2023" |
| T4 | 30-40 s | The map appears | the dots glide to their true positions while the camera eases from k = 200 to 90; the land and the neutral backdrop of every firm fade in; one leader label for the pair | "305,780 firms in view in 2021; 129,159 with a usable revenue baseline" |
| T5 | 40-54 s | Downtown, 2014-2025 | the outcome layer resolves and the backdrop drops to 0.35; the year runs (0.75 s holds, 0.3 s dissolves with an additive blend so unchanged marks keep their opacity); listed firms bloom red in their red-from year, filled when they file and a ring when they do not | top right: the year, "n listed firms shown red", "m of them without a statement"; bottom left: the six classes, three state rows with the year's counts, the red swatch |
| T6 | 54-66 s | The city | pull-back to k = 30 over 2.5 s while the year rewinds; the years run again (0.55 s holds) | counts update |
| T7 | 66-78 s | The region | pull-back to k = 12; the years run again (0.5 s holds) | counts update |
| T8 | 78-85 s | Close | hold on 2025 | "1,819 listed firms red by 2025 within 160 by 90 km of Moscow" / "864 of them without a 2025 statement"; "Colours show each firm's own real revenue change against its 2019-2021 average; no spatial or proximity effect is estimated."; "Dated by the supplied sanctions list (1,003 of 2,220 dates inferred); 200 undated list members red throughout. Descriptive, not causal; 2025* is the flagged latest year." |

One camera path (position cubic, zoom in log k) rests at each raster extent's k on the Moscow
reference point, so each raster is drawn 1:1 there; between rests the extents cross-dissolve by k
(region at k 3-6 in, 22-30 out; city 14-22 in, 60-80 out; downtown 60-80 in). Listed firms are vector
marks over the rasters: before their red year they carry their own state (the same three-state rule),
then red with the extent's mark size by pile. The two anchors are 57 m apart, one point at every map
scale, so they share one leader label.

### Round-2 verification

- Palette: the validator passes the resampled YlGnBu (ordinal, multi-hue noted) and both PRGn halves; the categorical set (red, the two PRGn mid steps, the dark control, the effective backdrop) is separated by the numbers in the palette table; grayscale copies of the change-map frame (t = 72 s) and a downtown treated frame (t = 49.8 s) were inspected: the six classes keep their lightness order on each side of zero (a diverging ramp's two extremes share lightness by design and are told apart by hue), and the red marks read as ringed discs through their pale outline.
- Text: zero findings on the three cuts (see the audit section); 12 review frames of the treated cut (2.5, 14, 24, 27, 36, 39.5, 45, 52, 60, 72, 80 and 84 s) and the three requested frames (downtown 2022, city 2024, region 2025, `build/treated-review/`) were inspected at full size.
- M6: 163 checks pass; `check-readonly.sh` reported nothing changed outside the lab; no identifier names in any shipped `data/*.js` (grep for `inn` and `ogrn` tokens).
- Determinism, treated cut: frames 300, 1500 and 2400 captured across three shards and in one process in another order are byte-identical (AE = 0 each).
- Renders (sharded, four browsers each; runs `20261023T035339Z`, `035618Z` and `035658Z-capture`): the full cut 5,460 frames in 150 s (597 s single-process in round 1), the teaser 1,200 frames in 36 s, the treated cut 2,550 frames in 106 s; `ffprobe` reads 1920x1080, 30/1, h264 yuv420p and exactly 5,460 / 182.000 s, 1,200 / 40.000 s and 2,550 / 85.000 s against `__videoMeta`; no page exceptions in any shard log; files 24.3 MB, 11.2 MB and 46.9 MB (`build/who-stays-visible*.mp4`). Frames at 26.5, 49.8 and 83 s were extracted from the treated MP4 and inspected (`build/treated-check/`).

### Sharded capture, verified

A 4 s test across four shards joined to 120 frames, 4.000 s by `ffprobe`; frames 0, 1200 and 2400
captured single-process and across three shards are byte-identical (ImageMagick AE = 0 for each).
Every render from here on is sharded: the audit passes, the three cuts, and the splice if approved.

### Pending the author's review

The class breaks (proposal above), the splice of the treated cut into the full cut after the Moscow
zoom (`full-treated`, not built until approved), and the review of the treated cut itself.

## Design decisions

- Dark cinematic stage held to Tufte: no glows, gradients or 3D; motion only reveals data or moves the camera; every rate carries its denominator; one message per scene in the title line; the sequential ramp brightens with the value on the dark ground; the change ramp keeps purple for falling shares and green for rising ones with lightness rising with magnitude (round 2; round 1 used brick and blue).
- Discrete labelled annual snapshots; crossfades are presentation, never interpolation of values. Camera moves are pure functions of time (position cubic, zoom in log k).
- Wording stays descriptive: absence is not withdrawal or concealment; supplied lists are fixed memberships; no regional reading is put on the change map; the size widening is marked provisional.
- Disclosure: shares need 50 firms (the project's support rule); 250 m cells under 3 firms are dropped; fine-cell counts under 10 are banded in tooltips; list counts under 5 per cell are suppressed. No firm identifiers or coordinates leave the lab.
- Type: Nimbus Sans locally with Arimo (metric-compatible) as the web fallback; text at or above 22 px at 1080p, titles 54-78 px.

## Possibilities not built (ideas for a later pass)

- Per-year 250 m city cells (the M5 join could bin at 250 m; only 2021 exists today).
- Ownership and legal-form composition by cell, and an "addresses shared by 100+ firms" layer.
- A narrated version (voice-over aligned to the scene table) and a 40 s teaser cut of scenes 1, 4, 6 and 7.
- Porting the atlas into the Claude Dashboard artifact type with per-number source attribution and comments.
