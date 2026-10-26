# Motion study: "Who stays visible?" (22 October 2026)

A Claude Motion-style explainer and an interactive atlas built from the dissertation's Chapter 2
aggregates, inside the dataviz lab. Nothing here is a research record, a manuscript source or an
authorization. Claude Motion itself (Team/Enterprise beta) is not available in this account; its
method is reproduced by hand: code animates text, charts, shapes and maps as a pure function of
time, so any frame can be sought deterministically and captured to MP4.

## Deliverables

| Piece | Path | What it is |
|---|---|---|
| Explainer | `explainer.html` (+ `js/`, `css/`, `data/*.js`) | round 5: one cut family, `full` 287 s and `teaser` 46 s (the Moscow standalone and the two maps-and-firms cuts were retired on 24 October 2026), each cut with the Moscow section; 1920x1080 at 30 fps, charcoal stage; play, pause, scrub, chapter buttons, a cut button; `?cut=NAME`, `?__render=1` capture mode, `?__debug=1` frame counter |
| Videos | `build/who-stays-visible*.mp4` | H.264 yuv420p, captured frame by frame through headless Brave and ffmpeg (sharded); see the round-3 cuts table |
| Teaser | `build/who-stays-visible-teaser-46s.mp4` (`-720p` copy beside it) | 46 s, 1,380 frames since round 4 (round 1: 40 s, 1,200 frames): the hook, the map through time, the Moscow zoom and the group divergence, played faster (scene `speed`), plus the closing card; `explainer.html?cut=teaser`, or the cut button on the page |
| Treated cut (round 2; retired as a standalone cut on 24 October 2026, the sequence lives inside the full cut) | `js/treated-scenes.js` (the journey section; `?cut=moscow` and its file are gone) | 85 s, 2,550 frames: two firms on one street, a designation, and the Moscow field 2014-2025 at three extents; local only (it needs `data/points.js`, `data/treated.js`, `data/anchors.js` and the rasters under `data/points/`, none of which is published) |
| Atlas | `explorer.html` (+ `js/explorer-app.js`) | click-to-zoom flights, a zoom box with a scale bar, keyboard and touch input and a phone layout (24 October 2026); six map layers, a 2014-2025 year slider, zoom from the country to 250 m cells, hover tooltips with counts and denominators, side charts, a provenance line on every panel, dark and light themes |
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
| `M1-basemap.R` | read-only | `basemap.json` (659 kB since round 11; the graticule from 10 N): LOD0 rings simplified by Douglas-Peucker at 1 km (58,490 of 339,862 vertices), LOD1 rings clipped to 22 city windows at 0.1 km, graticule, extents, city points | 13: parts, rings, vertex totals, equality with the production reader, origin, Moscow window, Hausdorff bound, area change, LOD1 contents |
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
scripts/motion-capture.sh --out motion/build/who-stays-visible-full-287s.mp4 --shards 8     # the default cut
scripts/motion-capture.sh --page "explainer.html?cut=teaser" --out motion/build/who-stays-visible-teaser-46s.mp4
scripts/lab-run.sh --max 14G --duck-mem 9GB --duck-threads 6 --duck-temp 60GB --cpu 800% Rscript --vanilla R/motion/M9-firms.R a rel charcoal national   # the atlas's address files
python3 -I motion/tools/atlas-audit.py --url http://127.0.0.1:8765/explorer.html --out motion/build/audit-atlas.txt
scripts/motion-capture.sh --audit motion/build/audit-full.json --audit-step 6            # text boxes of every 6th frame
python3 -I motion/tools/audit.py motion/build/audit-full.json --out motion/build/audit-full.txt
python3 -I motion/tools/publish-set.py                                                   # motion/publish/: pages, scripts, every data file, the rasters the journey loads, the address scripts
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
  residents-list-only firms from 2020; the 200 other undated members from the first frame. Since 25 October a
  member carries a thin red rim before its listing year in both pages (the round of 25 October).
- Firms on no list, three states: a filer with a baseline carries its revenue-change class (real revenue
  against the firm's own 2019-2021 average of original filings with positive revenue, at least two of the
  three years; a filed zero counts as -100%); a firm with a baseline and no statement that year is the
  outcome, in the dark control colour; a firm without a usable baseline is only part of the faint neutral
  backdrop (never an outcome colour). Baseline firms that filed without a revenue value (0.1-2%) stay in
  the backdrop and are counted (`base_filed_novalue`).
- Other geocodes (RFSD geocoding quality 'city': coordinates without a verified house or street match) are not drawn (6,000-90,000 per year in the downtown rectangle) and are counted.
- Classes: six, breaks -50 / -20 / 0 / +50 / +150 percent, chosen by the author on 23 October from the
  2022-2024 quantiles after the first set (-40 / -15 / 0 / +15 / +40) put 69-84% of filers in the two
  extreme classes (see the spread below).

Outputs (local only, `motion/data/points/` and `motion/data/*.json`): 72 rasters (three 16:9 extents
centred on the Moscow point: region 160 x 90 km at k = 12, city 64 x 36 km at k = 30, downtown
21.33 x 12 km at k = 90, each drawn 1:1 when the camera rests there; per year a neutral backdrop of
every drawn firm and an outcome layer of the baseline firms), `points.json` (manifest: extents, mark
rule, colours, per-year counts and states, class counts under the current and three candidate break
sets, the pile hand-check, the deflator, rules), `treated.json` (2,220 listed firms: coordinates to
0.1 m, red-from year, flags, a 12-character filing string and a 12-character state string, pile size;
no identifiers; since 25 October 2026 a display name per firm from the list files, with the full filed name, the
script case and the count of list entries sharing the name) and `anchors.json` (Aeroflot's facts with its listing date and jurisdictions from the
file; the neighbour's facts rounded to two significant figures, never named). Marks: one per distinct
coordinate; the backdrop disc is sized by all firms at the address, `min(cap, base + s * sqrt(n - 1))`
px with (2, 0.6, 8) at the city extent and (3, 1.1, 14) downtown; the outcome disc is sized by its
baseline firms, a dark disc for the non-filers with an inner disc scaled by `sqrt(filers / baseline firms)`
in the filers' median class; the region rasters are pixel blocks (2 x 2 for 10+, 3 x 3 for 100+ firms).

Checks (163, all pass): per extent and year, firms = marks + other geocodes + treated, drawn firms = the three
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

Class spread of filers (shares in the six classes, declines to rises), downtown: under the first
breaks (-40 / -15 / 0 / +15 / +40) 2022 20.8 / 6.9 / 5.0 / 5.7 / 13.0 / 48.6 (extremes 69%); 2023
20.5 / 5.6 / 3.8 / 4.2 / 8.3 / 57.6 (78%); 2024 18.9 / 4.7 / 2.9 / 3.0 / 5.6 / 65.0 (84%). The city
extent is within one point. The distribution is wide and skewed (2023 downtown quantiles
5/10/25/50/75/90/95: -100, -89, -20, +59, +166, +421, +828), so the proposal from the quantiles kept
zero as the midpoint and widened the upper classes: breaks -50 / -20 / 0 / +50 / +150 give 2022
18.3 / 7.9 / 6.4 / 24.1 / 26.1 / 17.2 (extremes 36%), 2023 18.5 / 6.4 / 5.0 / 16.7 / 26.0 / 27.4 (46%),
2024 17.1 / 5.5 / 3.9 / 11.1 / 24.5 / 38.0 (55%); the flatter alternative -60 / -25 / 0 / +75 / +200
gives extremes of 28, 38 and 46%. The author chose -50 / -20 / 0 / +50 / +150 (23 October, after the
first render); M6 was re-run and the treated cut re-rendered with them. The manifest records the class
counts under the chosen, the previous and the two other candidate sets.

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
- Renders (sharded, four browsers each; runs `20261023T035339Z`, `035618Z` and `035658Z-capture`): the full cut 5,460 frames in 150 s (597 s single-process in round 1), the teaser 1,200 frames in 36 s, the treated cut 2,550 frames in 106 s; `ffprobe` reads 1920x1080, 30/1, h264 yuv420p and exactly 5,460 / 182.000 s, 1,200 / 40.000 s and 2,550 / 85.000 s against `__videoMeta`; no page exceptions in any shard log; files 24.3 MB, 11.2 MB and 46.9 MB (`build/who-stays-visible*.mp4`). Frames at 26.5, 49.8 and 83 s were extracted from the treated MP4 and inspected (`build/treated-check/`). Second treated render with the chosen breaks (run `20261023T040416Z-capture`): 2,550 frames in 107 s, ffprobe 2,550 / 85.000 s, no problems, 46.7 MB; the text audit on the re-labelled legend reported zero findings; the three review frames (`build/treated-review/`) and the 49.8 s frame from the MP4 were inspected; a 720p preview copy (`build/who-stays-visible-treated-720p.mp4`, 9.4 MB) exists for remote viewing.

### Sharded capture, verified

A 4 s test across four shards joined to 120 frames, 4.000 s by `ffprobe`; frames 0, 1200 and 2400
captured single-process and across three shards are byte-identical (ImageMagick AE = 0 for each).
Every render from here on is sharded: the audit passes, the three cuts, and the splice if approved.

### After the author's review

The treated cut was reviewed on 23 October; its approach became round 3 (the journey below), and the
splice was superseded by the integrated `full-moscow` cut.

## Round 3 (23 October 2026): one continuous journey

The author's review of the treated cut asked for its approach, continuous transitions and a camera
that zooms in for detail and out for context, applied to the whole presentation; a comparison beat
after the two profiles; a readable firm field; smaller, more opaque chrome with a location name that
follows the zoom; and a prose pass. Planning answers: the Moscow sequence is integrated into the full
presentation as one continuous piece (a local cut; the published artifact keeps a version without
firm-level data), and the city and region scales show area results. Later picks: ramp A (one blue
hue, lifted so its dark end sits at L 0.65), no absent-share cue; the relative metric; a charcoal
ground with the blue scale applied to the whole piece; and five changes (below). Everything stays
inside the lab; nothing firm-level is published.

### Cuts

| Cut (round-4 name; round-3 name) | URL | Length | Frames | Where it goes |
|---|---|---|---|---|
| `full-public` (`full`) | `explainer.html` (default) | 192 s | 5,760 | the artifact (no firm-level data); `build/who-stays-visible-full-public-192s.mp4` |
| `teaser-public` (`teaser`) | `?cut=teaser-public` | 40 s | 1,200 | the artifact; `build/who-stays-visible-teaser-public-40s.mp4` |
| `full-local` (`full-moscow`) | `?cut=full-local` | 287 s (275 s in round 3) | 8,610 | local only; `build/who-stays-visible-full-local-287s.mp4` (`-720p` copy beside it) |
| `teaser-local` (`teaser-moscow`) | `?cut=teaser-local` | 46 s | 1,380 | local only; `build/who-stays-visible-teaser-local-46s.mp4`; the teaser plus a six-second excerpt of the designation |
| `moscow` (`treated`) | `?cut=moscow` | 110 s (97 s in round 3) | 3,300 | local only; `build/who-stays-visible-moscow-110s.mp4` (`-720p` copy beside it); the standalone two-firm cut with the comparison beat and the national run |

Maps and firms (author's side project, 23 October; cutting and reordering only, no new data, no scene changes): `maps-firms-local` (`?cut=maps-firms-local`, 174 s, 5,220 frames, `build/who-stays-visible-maps-firms-local-instagram-174s.mp4`, `-720p` copy) holds the map beats and the two-firm section in their order and nothing else: the map through time, the change map, the flight to Moscow, the section from the street zoom to the close (its text played 1.5 s past the close so the next beat meets no text, the camera held at the left framing), and the cohort map (from 1.5 s in); `maps-firms-local-55` (55 s, 1,650 frames, `...-instagram-55s.mp4`, `-720p` copy) keeps the two-firm sequence without the street zoom (profiles from 0.4 s after their start, designation, revenue against comparison group, the map returns with the live box) and one map run, the downtown run over eight kept years, 2014, 2016, 2018, 2021, 2022, 2023, 2024 and 2025 (2015, 2017, 2019 and 2020 dropped), ending on 2025 with the live box; nothing is sped up. The dropped years are a cut option of the journey (a kept-year list; the camera's year channel then carries list positions and a dissolve joins two kept years directly), and `makeCut` merges windows that continue each other in both clocks into one span so a chapter boundary inside a contiguous stretch leaves no hold or fade; the existing cuts are byte-identical (five frames of `full-local` and `moscow` at AE 0). Audits: the counted live-box coverage only on both (17 lines on the 174 s cut, 5 on the 55 s cut, the box over red marks during the downtown run).

The page builds `full` and `teaser` from the five aggregate data files; the three local cuts join
once `data/points.js`, `treated.js`, `anchors.js`, `moscowcells.js`, `moscowcomparison.js` and the
rasters are present and decoded (the cut button cycles through whatever is built). `tools/publish-set.py`
assembles `motion/publish/` (the two pages, the four shared scripts, the five aggregate files) and
refuses any name matching `points|treated|anchors|moscow`.

### The journey (`full-moscow`, 275 s; `full` is the same list with a 20 s 250 m leg and a 5 s pull-out in place of the section)

A cut is a list of beats with durations (`explainer-scenes.js`); scenes, the ground schedules and
the camera keyframes are built from the beat starts. A ground scene (z 0) draws the land and the
national density under every beat from two schedules (land 1 under maps, 0.3 under the archive,
0.12 under the availability chart, 0.15 under the chart beats, 0.3 under the credits; density 1
under maps by scale, 0.22, 0.12, 0, 0.12), so the stage never goes blank between beats; the chart
beats keep the dimmed map under a slow drift. One camera path: a 4% push-in over the hook and the
archive, a 15% pull-out under the availability chart and a glide to the left framing as the chart
leaves, the left framing for the 100 km maps, one eased flight to Moscow at k = 12, the section,
the national framing again with a drift under the charts, and the left framing for the closing map.

| Time (s) | Beat | Camera | What is on the stage |
|---|---|---|---|
| 0-11 | Who stays visible? | national, 0.96 to 0.98 of the full extent | the land fades in, the density blooms by count class, the title, the 3,277,638 counter |
| 11-25 | The archive | push-in continues | records counter, provider bar (with "2025*: a flagged latest-year extension" once), 2021 nested bars, the definition line; the map at 0.3 |
| 25-41 | Availability over time | pulls out to 0.85, glides to the left framing in the last 2 s | the chart over the map at 0.12 |
| 41-65 | The map through time | left framing | 100 km cells by year; the column carries "Russia / 100 km cells" above the year |
| 65-77 | The change map | left framing | six classes, counts; the same location line |
| 77-88 | To Moscow | one eased flight to Moscow at k = 12 (arrives at 83) | the national density leaves by scale, the 1 km window arrives by scale (counts, then shares from 84.6), the city label once the camera has nearly arrived, the top-right panel (Moscow, 90 by 90 km, 1 km cells, 2021, the two counts) from 81.6 |
| 88-100 | Into the street | k 12 to 1,200 on the pair's midpoint | the 250 m density by scale, then the 2021 backdrop of every firm between k 60 and 260, then only the two anchors as dots in amber and mint; "Two firms, 57 m apart in central Moscow" at 94.5, the two names at 96 |
| 100-116 | Who are they? | hold | the land dims to the stage; the dots glide to the card headers; the profiles row by row |
| 116-124 | Designation | hold | the pulse, the red ring, the 2022 strip cell, "19 May 2022: listed by the United Kingdom and United States" |
| 124-138 | Revenue against comparison group | hold | two panels: each firm's real revenue index (own 2019-2021 average = 100, log axis) against the median and interquartile range of its group; the two gap facts and the counts |
| 138-146 | The map returns | k 1,200 to 90 over 138-143 | the chart shrinks over 2 s into the live box (right edge, under the counters) as the land and the backdrop return; the dots glide to their true positions; the markers from 140.5; the split line (305,780 firms in view in 2021, 129,159 with a usable revenue baseline) |
| 146-160 | Central Moscow, 2014-2025 | hold k = 90, the year on the camera's clock (0.75 s holds, 0.3 s dissolves) | firm marks in the blue scale, red marks with rings, the ticker (Central Moscow, 21 by 12 km), the three-row legend, the disclosure line once (152.6-159), the live box with the current-year dots |
| 160-172 | Moscow | pull-back to k = 30 over 2.5 s while the year rewinds; 0.55 s holds | 1 km cells (median of the cell's filers, 20 or more), the backdrop as texture, red points, the location flips to "Moscow, 64 by 36 km" |
| 172-184 | Moscow and surroundings | pull-back to k = 12; 0.5 s holds | 5 km cells, "Moscow and surroundings, 160 by 90 km" |
| 184-191 | Close of the Moscow section | hold 2025 | the count line, the three caveats, "Paths compared, no effect estimated." |
| 191-196 | Out to the country | k 12 to the national framing | the chrome and the marks leave (103-105.5 of the section), the density returns by scale |
| 196-268 | Groups, absence and removal, size, lists, what comes next | national with a slow drift (0.98 to 0.90, the origin shifting left), the left framing for the closing map | the chart beats over the dimmed map; the cohort map |
| 268-275 | Sources | hold | credits over the map at 0.3 |

Section-relative clock (`treated-scenes.js`, `SEC`): street 0-12, profiles 12-28, designation
28-36, comparison 36-50, return 50-58, downtown 58-72, city 72-84, region 84-96, close 96-103, out
103-108. `TreatedScenes.journey(images, S)` returns the two scenes, the absolute keyframes, the
chapters and the rest point for a section starting at `S`; `standalone(images)` is the 97 s cut
(two 0-6, profiles 6-22, designation 22-30, comparison 30-42, the map 42-52, downtown 52-66, city
66-78, region 78-90, close 90-97). The pieces are parameterised by `CITY` (name, data) so a second
city's section costs a data pass, not new scene code.

Re-cuts (`makeCut`): entries `[id, title, cutStart, cutEnd, fullStart, fullEnd]` play a window of
the parent between two cut times; every parent scene meeting the window is cloned with the matching
start, end, speed and offset (`local = max(0, t - start) * speed + offset`), clipped scenes get a
0.5 s fade, the ground draws from the parent's clock through the same time map, and map windows
carry the parent's keyframes compressed by the speed with a hold at each end. `teaser` (40 s): the
hook, the map through time, the flight to Moscow and the 250 m push-in (19 s of `full`), the groups,
the credits. `teaser-moscow` (46 s): the same with the flight running into the street zoom and a
six-second excerpt of the designation (section 26-32 s) in place of the 250 m leg.

### Five changes (author's instruction after the charcoal pick)

1. No purple "statement absent" marks for firms on no list, on the maps or in the legends (the
   state is still computed; a baseline firm without a statement is simply not drawn in the outcome
   layer and appears in the backdrop). Listed firms without a statement keep the red ring: stroke at
   least 1.5 px, radius floors of 1.5 / 2.0 / 2.5 px at the downtown / city / region scales, and the
   solid-to-ring change fades over 0.5 s with the year dissolve. One disclosure where the blue scale
   first appears: "The scale covers firms on no list with a statement that year."
2. The two anchors stay findable from the moment they land on the map to the end of the section:
   a fixed-size outline marker (circle for Aeroflot, diamond for the private firm, 2 px stroke,
   constant pixel size at every zoom) with a short leader to a panel-backed label, in two non-data
   colours: amber `#F2B134` (Aeroflot) and mint `#7CE8C3` (the private firm), 2 px strokes checked
   on the charcoal ground (contrast 9.9:1 and 12.6:1 against `#22262D`). The same colours identify
   each firm everywhere: the intro dots, the profile headers, the comparison lines, the live box.
   The label offsets are chosen per scale by scanning the 2025 red marks (five distances, eight
   directions, the position covering the fewest marks) and blended between scales by the extent
   alphas, so a label moves continuously during a pull-back.
3. Administrative boundaries by zoom: regional borders at the national and region scales, the
   finer Moscow geometry at the city and downtown scales, cross-faded between k 6 and 12
   (`drawBasemap` LOD blend), stroke never above 1 px on screen.
4. Legend: three rows (the bar with its breaks under the two-line title "Firms on no list, real
   revenue against own 2019-2021 average, relative to the year's median of firms on no list"; one
   muted line with the mark rule or the cell support at each scale; the red row with a solid and a
   ring glyph and "solid: statement available that year · ring: absent that year"). The backdrop,
   outline-only and absent rows are gone (facts below). Cells below support stay faint outlines.
   The comparison beat's "listed 2022" (foot) and "no 2022 statement" (top) labels no longer collide;
   2025* is explained once per cut (the archive beat in the journey, the comparison beat in the
   standalone cut).
5. The comparison beat and its live version are one element (`comparisonView`): one drawing
   routine interpolated between the full-screen layout and the corner box (`u`), the panel rectangle
   interpolated too so it always encloses the chart and its tick labels, the labels and facts leaving
   in the first half of the 2 s move and the panel (0.92) fading in during the second half. The box
   arrives before the first year run with 2021 current; each panel keeps the full 2014-2025 lines
   and bands, years after the current one drawn in place at 0.3 opacity, a dot on each line at the
   current year, firm lines in the anchor colours, medians and bands in the muted accent
   `#6FA39A`, red only for the dotted "listed 2022" marker, no text beyond the two group names and
   the axis. The box never overlaps the legend or the counters (audit rule `box-over-chrome`); the
   red marks it covers are counted per frame (`box-over-mark`, 1-35 marks in the dense downtown and
   city years, reported, not zero by design).

### Palette (charcoal ground, applied to the whole piece)

| Token | Value | Use |
|---|---|---|
| stage / land / border / graticule | `#121418` / `#22262D` / `#4A515C` / `#1A1D22` | the ground |
| ink / muted / dim / grid / panel | `#ECEEF1` / `#A3AAB4` / `#6B7380` / `#1D2126` / `#171A1F` | text and chrome (panels at 0.92) |
| blue scale (six classes, L 0.65-0.96) | `#4A97C9 #67ABD4 #88BEDC #ABCFE5 #CDE0F1 #EAF3FB` | firms on no list by relative real revenue change (breaks -50 / -20 / 0 / +50 / +150 against the year's median); validator: lightness gaps 0.061-0.063, dark end 4.74:1 on the land |
| red / outline | `#E31A1C` / `#FFD9D9` | listed firms, solid or ring; nothing else |
| amber / mint | `#F2B134` / `#7CE8C3` | the two anchors only (markers, headers, lines, dots) |
| accent muted | `#6FA39A` | group medians and bands in the comparison element |
| YlGnBu / PRGn | as round 2 | the national ordered layers / the signed change maps |

The look was chosen from four Central Moscow renders (the navy field, a grey or cream ground with
the navy scale, phthalo green, and the proposal: charcoal with the lifted blue scale); the author
picked the fourth for the whole piece. The relative metric: each firm's index (real revenue against
its own 2019-2021 average, 100 = the average) minus the median index of the drawn firms on no list in
that year, classed with the same breaks (`points.json` records the yearly medians).

### Data (M6, M7)

`R/motion/M6-common.R` holds the temp-table SQL shared by M6 and M7 (deflator, sanctions, `fy_all`,
`fy`, `firms`, `fym` with `pct` and `pct_rel`), the extents, breaks and the run options (variant,
metric, look as trailing script arguments, since the systemd unit drops environment variables).
M6 (`a rel charcoal`): 72 rasters (backdrop of every firm and the outcome layer of firms with a
statement and a value), `points.json` with the manifest (variant, ramp, look, metric kind, legend
title, yearly medians, red counts from fixed coordinates), `treated.json`, `anchors.json`; 163
checks. M7 (`R/motion/M7-moscow.R`): 1 km and 5 km cells per year anchored at the rectangle's
origin (the 1 km grid coincides with M5's Moscow grid shifted 35 columns), the cell's median of
its filers and the class with 20 or more filers, `n`, `nb`, `f`, `nfb` per cell; the comparison
groups (firms listed in 2022: 429 members, 60 to 134 with a statement per year; firms on no list
with a baseline: 335,342, 102,755 to 330,034) with yearly medians and quartiles over members with a
statement and positive revenue; the two anchors located by coordinates (no identifier leaves
DuckDB); the gap facts as distances from the median (Aeroflot 15.9 points above before 2022, 18.8
after; the private firm 4 below, 15 below); 201 checks (cell sums against M6's region counts, the
city rectangle, the M5 interior cells and window totals 2019-2024, membership, the firms' indices).
Absence is mapped at the downtown scale only (the ring); the city and region cells carry one
variable, the median change among the cell's filers; a per-cell absent share was assessed at the
checkpoint and declined by the author.

### Text audit rules (zero findings is the acceptance rule; `box-over-mark` reports counts)

`overlap` (15% of the smaller box, different groups), `offcanvas`, `small` (under 22 px), `cut-in`
(absent to 0.95 within one step), `cut-out` (0.9 to absent before the scene's own fade), `panel-clip`
(a text block inside the panel it was drawn in, 2 px), `label-under-panel`, `label-over-mark`,
`box-over-chrome` (the live box over another panel), `box-over-mark` (red marks under the live
box, counted). Block identity: the same string, or the same anchor within 2 px and 14 px.

### Prose pass (every changed on-screen string)

| Where | Before | After |
|---|---|---|
| chapter button | Who went dark | Availability by group |
| groups title and line | Visibility diverged after 2021; Visibility rose among ... | Availability diverged after 2021; Availability rose among ... |
| availability panel | 2021 → 2024 | 2021 to 2024 |
| years column | eyebrow "Availability by 100 km cell"; "FNS  ← provider changes" | eyebrow "Availability by cell" with the location line "Russia / 100 km cells"; "FNS, the provider changes" |
| change column | "Located share 64.0% → 66.5%" | "Located share 64.0% to 66.5%", with the location line |
| archive | - | "2025*: a flagged latest-year extension" beside the provider bar |
| zoom captions | two bottom captions ("Moscow, 90 km window at 1 km; n located firms; a with a 2021 statement (pct)", "Central Moscow at 250 m, registered addresses; piles") | the top-right panel: Moscow / 90 by 90 km, 1 km cells / 2021 / n located firms / a with a 2021 statement (pct); Central Moscow / 250 m cells, registered addresses / n firms at the largest address / m at addresses with 100 or more |
| transitions line | "... reappear with a statement; among prior-available firm-years, x% end in removal." | "Of n firm-years without a statement, ... reappear with a statement. Among firm-years with a statement, x% end in removal." |
| size title and subtitle | "Larger firms stay visible; the gap widened in 2022"; "... (Q1), adjusted; outcomes 2020–2024" | "Larger firms stay visible, and the gap widened in 2022"; "... (Q1), adjusted, outcomes 2020–2024" |
| lists title, subtitle, series, groups, caveat | "Sanctioned-only firms became relatively less visible by 2024"; "...no supplied list; annual eligible population..."; "Sanctioned only", "Government strategic only"; "...not dated designations; the odds compare..." | "Firms on the sanctions list only fell behind by 2024"; "...no supplied list, annual eligible population..."; "Sanctions list only", "Government strategic list only"; two sentences |
| credits | "Descriptive, not causal; dated events are context. Absence ... concealment; supplied lists are fixed lists, not dated designations." | "Descriptive, not causal. Dated events are context. Absence from the archive is not withdrawal or concealment." (the lists caveat stays on the lists beat) |
| treated close | "Colours show ... average; no spatial or proximity effect is estimated." "... Descriptive, not causal; 2025* is the flagged latest year." | "Colours show each firm's own real revenue change against its 2019-2021 average, relative to the year's median of firms on no list. No spatial or proximity effect is estimated." "... Descriptive, not causal." then "Paths compared, no effect estimated." |
| treated legend | six rows (bar, backdrop, outline-only, absent, no-baseline, red) | three rows (see change 4) |
| location names | - | "Central Moscow, 21 by 12 km", "Moscow, 64 by 36 km", "Moscow and surroundings, 160 by 90 km" (geographic windows, not registry regions: the manuscript's "Moscow city" and "Moscow reg." are registry regions) |
| atlas | "sanctioned only" (series), "sanctioned-only firms" (provenance) | "sanctions list only", "firms on the sanctions list only" (local copy; the atlas artifact stays at v2) |

Rules applied: available / absent / removed for the three states; "went dark" never names observed
absence; lists by their printed names; "designation" only for a sender's legal act; no em-dashes
and no semicolons on screen; each caveat once where it first matters.

### Round-3 verification

- Data: M6 163 checks and M7 201 checks pass; `check-readonly.sh` reported nothing changed outside the lab; no identifier names in any shipped `data/*.js`; the page's `__ready` checks the listed-firm counters and the cell sums against the manifest before any local cut is built.
- Palette: the lifted blue ramp passes the validator as an ordinal ramp (lightness gaps 0.061-0.063, dark end 4.30:1 on the navy and 4.74:1 on the charcoal land); the anchor colours read on the charcoal ground at 2 px (amber 9.9:1, mint 12.6:1).
- Page: all five cuts load and seek without exceptions in headless Brave (`--probe`: `problems: []`); the atlas loads without console errors after the shared-script changes (a CDP screenshot was inspected).
- Text audit (step 6; the teasers at step 3): zero findings on `full`, `teaser`, `teaser-moscow`; `full-moscow` and `treated` carry only the counted `box-over-mark` lines (the live box over 1-35 red marks during the downtown and city year runs, reported by design). Findings fixed on the way: the comparison element's labels, ticks and panel racing each other during the 2 s move (labels and facts now leave in the first half, the panel arrives in the second, the panel rectangle is interpolated too); the Moscow city label flying in from the screen edge during the flight (time-gated to the arrival); a marker label crossing the fading close text (the markers now leave with the section); the live box's "2025*" clipped by its panel (boxes 140 px wide, 1476 and 1690).
- Review frames: 24 frames of `full-moscow` from the page (`build/r3-g/`, at 5, 20, 33, 50, 70, 80, 86, 90, 95, 99, 110, 120, 130, 141, 150, 158, 165, 178, 188, 194, 205, 230, 262, 272 s) and 14 frames extracted from the finished MP4 (`build/r3-final/`, including the live box at 2016, 2022 and 2025: 149.2, 155.5 and 158.6 s) were inspected at full size; the published cut's 250 m leg (`full` at 86, 95, 107 s) and the designation excerpt of `teaser-moscow` likewise. Two defects found in the MP4 frames and fixed before the final renders: the 250 m count legend sat unbacked on the dense field (now on its own panel at 1420, 300) and the close's caveats sat on the bright 5 km cells (now on a 980 px panel that clears the markers); one defect found in the re-cut: the section's scenes read the stage clock instead of their local clock, so the teaser's designation excerpt showed only the two dots (fixed; the excerpt's street window now ends before the title).
- Renders (sharded; runs `20261023T073219Z` full-moscow with 8 shards, `072751Z` full, `073103Z` teaser, `073518Z` treated, the teaser-moscow run after the clock fix): `ffprobe` reads 1920x1080, 30/1, h264 yuv420p and exactly 8,250 / 275.000 s (149 s of capture, 80.9 MB), 5,760 / 192.000 s (172 s, 45.6 MB), 1,200 / 40.000 s (39 s, 14.8 MB), 2,910 / 97.000 s (115 s, 40.2 MB) and 1,380 / 46.000 s (run `073808Z`, 43 s, 17.6 MB) against `__videoMeta`; no page exceptions in any shard log. A 720p preview of the Moscow cut (`build/who-stays-visible-moscow-720p.mp4`, 21.4 MB) exists for remote viewing.
- Determinism: frames 1,500, 3,600 and 5,400 of `full-moscow` captured across three shards and in one process in another order are byte-identical (ImageMagick AE = 0 each), re-run after the last code change.
- Artifact: the publish set (two pages, four shared scripts, five aggregate files, 5.1 MB) contains no file matching `points|treated|anchors|moscow`; the explainer artifact was republished (v5, then v6 with the legend panel, v7 with the final scripts); it could not be opened from the lab's browser pane (the private page needs the author's claude.ai sign-in), so that check is the author's. The atlas artifact is at v3 (see below).
- Residuals: the backdrop between k 150 and 260 during the return (138-143 s) is the downtown raster drawn 1.7-2.4 times its size at low alpha for about two seconds (soft grey discs under the arriving markers); the live box covers red marks in the dense years (counted above); the chapter bar of the local cut carries 19 buttons.

## Round 4 (23 October 2026): the national run, the lists table, St Petersburg

Four items from the author's review of the round-3 renders; only the cuts they touch were re-rendered
(`full-moscow`, `full`, `treated`, `teaser-moscow`; the teaser was re-audited and left as rendered).

### 1. The two-firm section: refinements only

Structure, timing and encodings as built. Two refinements, both fades:

- The downtown backdrop and the red marks dissolve between k 110 and 150 instead of 150 and 260, so
  the downtown raster is never drawn above 1.7 times its size: the soft grey discs of the return
  (138-143 s) are gone and the street dissolve is tighter.
- While the year runs backwards (the 0.8 s rewind before the first downtown run and the three
  pull-backs) a listing is a plain crossfade: no expanding ring and no flash. The bloom played
  backwards through every rewind, a contracting ring per firm, conspicuous at the national scale.

No label moved and no pacing changed.

### 2. The national year run

A beat between the region run and the close, section-relative 96-108 (the section is 120 s; `full-moscow`
is 287 s, 8,610 frames; the standalone `treated` cut carries the same run at 90.5-103 and is 110 s,
3,300 frames). The pull-back from the region extent to the national framing is two eased segments so
Moscow stays on screen: zoom out in place from k 12 to 1 over 1.5 s (the region raster and cells leave
between k 6 and 3, the national raster and marks arrive between 3 and 1, all centred on Moscow, the year
rewinding to 2019), then the slide to the left framing (k 0.168, map centre at 700/560) over 1 s while
the zoom completes and the year reaches 2014; the twelve years then run at the region run's dwell
(0.5 s holds, 0.25 s dissolves), ending at 107.25, and 2025 holds. The close follows at 108-115; the
pull-out at 115-120 is now the move from the left framing to the chart beats' national framing.

On the stage: the M8 rasters (backdrop at 0.25, outcome layer at 0.9) at the left framing, the listed
firms nationwide as red vector marks with their rings (radius floor 1.5 px) blooming in their listing
year, the ticker "Russia / about 6 km per pixel" with the year and the two red counters (nationwide),
the three-row legend with the line "6 km pixels, median class of firms with a statement". No live box
(it leaves over the first second of the pull-back) and no anchor markers (they leave with the region run).

What a pixel holds at this scale: at the left framing one pixel is 1/0.168 = 5.95 km square. The
backdrop holds every located eligible firm on no list with a house- or street-level geocode whose address falls in
the pixel, neutral; the outcome layer holds the pixels with at least one such firm with a statement and a
revenue value that year, in the median class of those firms' relative change (own 2019-2021 average,
minus the year's median of the drawn firms on no list nationwide); pixels with 10 or more firms widen to
2x2 blocks and 100 or more to 3x3 (2014: 6,100 and 2,425 of 26,576 pixels; 2025: 5,634 and 2,087 of
25,701). Listed firms are not in the rasters; other geocodes are counted and not drawn. The
largest pixel is central Moscow (column 225, row 488): 85,577 firms in 2023, 25,376 with a value.

Two mark sets: the Moscow set (M6: every listed firm with a row in the region rectangle, at its latest
coordinates there, 2,220 firms) draws at the Moscow scales; the nationwide set (M8: 4,803 listed firms
at their latest coordinates anywhere) at the national scale; they cross-fade with the rasters between
k 3 and 1, and each scale's counters come from its own set and manifest. The sets differ for firms
that moved out of the rectangle: 2,140 of the 2,220 sit inside it by their latest coordinates, the
yearly Moscow counters differ by at most 16 firms before 2025 and by none in 2025
(`national.json`, `moscow_counters_minus_m6`).

M8 (`R/motion/M8-national.R`; `M6-common.R` gained a fourth trailing argument, the scope, and builds
the firm-year table one year at a time, since the nationwide twelve-year join in one statement exceeded
the DuckDB grant; the pixel-raster drawing moved into `M6-common.R`, shared with M6). Run under the
guard in 43 s (`scripts/lab-run.sh --max 14G --duck-mem 9GB --duck-threads 6 --duck-temp 60GB --cpu 800%
Rscript --vanilla R/motion/M8-national.R a rel charcoal national`, peak 12.9 GB). 74 checks pass: per
year, firms equal marks + other geocodes + treated, the drawn firms equal the three states, the outcome
pixels hold the filers with a value, the class counts sum to the filers, the located eligible firms equal
M5's located total (4,625,980 in 2014 to 3,062,023 in 2025); the 2021 count equals the density pass
(3,277,638); the red-from histogram equals an R recomputation from the list file; the Moscow population
equals M6's treated.json (2,220); the 2025 Moscow counters equal M6's; the largest 2023 pixel is
reproduced; the Moscow point's pixel agrees with the camera formula (225.7, 488.4 against the pixel
centre 225.5, 488.5); the rectangle contains the basemap's national extent; 24 rasters written. The
page checks the national counters against the manifest and the Moscow point's projection against the
manifest's pixel before building the local cuts, and refuses to build if the manifest's camera is not
its left framing. The national medians of the relative metric lie within 3.7 points of Moscow's every
year, so a Moscow pixel keeps its class across the two scales in nearly every case. Class shares of
the national filers under the breaks, 2022 / 2023 / 2024: 27.0, 11.5, 11.5, 21.7, 16.0, 12.3 /
31.1, 10.6, 8.3, 15.8, 15.3, 19.0 / 35.4, 8.8, 5.8, 11.7, 13.8, 24.6 percent. Outputs: `data/national.json`
(manifest, counts, classes, checks), `data/treatednational.json` (4,803 firms, no identifiers; display names from the list
files since 25 October 2026), 24 rasters under `data/points-national/`; in the publish set since round 5.

### 3. The lists scene (all cuts that carry it)

Title "Sanctions-listed firms: lower odds of a statement by 2024", subtitle "against firms on no list,
with 95% intervals", the chart as before, the eyebrow kept, and one table in place of the two bar
stacks: the four histories by group, percentages only on screen, the denominators in the column
headers. The counts:

| Six-year history, fixed 2019 cohort | Sanctions list only (2,784 firms) | No list (3,409,122 firms) |
|---|---|---|
| all six years available | 51.3% (1,428) | 36.2% (1,235,180) |
| available, then absent from 2022 | 3.5% (98) | 1.3% (44,515) |
| absent all six years | 25.2% (702) | 6.2% (210,236) |
| removed from the registry | 8.5% (236) | 41.9% (1,428,242) |

The other histories (other patterns, scope changes, unresolved) are not shown.

### 4. St Petersburg: no sequence; the evidence record and one sentence

`motion/review/spb-vs-moscow-report.md` and `spb-vs-moscow-scan-run1.log` (read-only scan of
23 October, run `20261023T065747Z-ro-zz-spb-scan.R`) compare St Petersburg with Moscow under the M6
definitions at the three extents, 2014-2025. Test: a revenue-path statistic (the no-list index
median, the listed-in-2022 index median, the drawn filers' pct median) differs if it departs from
Moscow's by more than Moscow's interquartile band in two of 2022-2024 at an extent. Result: none
differs in any year at any extent (departures of 5 to 39 points against bands of 106 to 264);
listed firms' absence after listing is between 0.5 points lower and 6 points higher; the one standing
difference is the share of drawn firms with a usable baseline, 53 to 55 percent in St Petersburg
against 37 to 44 in Moscow, present since 2014. Decision (author, 23 October): no St Petersburg
sequence, no second anchor pair. The close gains one sentence, its two numbers from the report's
160 by 90 km tables: absence after listing 60.4 / 50.1 / 47.0 / 48.9 against 54.4 / 49.3 / 45.0 / 47.5
percent in 2022-2025 (within 6 points), the baseline share 54.2 / 53.8 / 52.8 against 44.1 / 41.1 / 37.9
in 2022-2024 (53 to 54 against 38 to 44). The sentence: "St Petersburg shows the same pattern at 160 by
90 km: its listed firms' absence after listing stays within 6 points of Moscow's, and only its share
of firms with a usable baseline runs higher, 53 to 54 percent against 38 to 44 in 2022 to 2024."

### The close

Over the national map now, so its panel moved to the right column (680 x 560 at 1180, 300, clear of
the ticker and the legend; the far east lies under it): the count line, the two caveats, the St
Petersburg sentence, "Paths compared, no effect estimated."

### Closing the round (author's two items)

- Names. The five cuts follow one scheme in which the public/local word marks what may leave the lab:
  `full-public` (`full`; `build/who-stays-visible-full-public-192s.mp4`), `teaser-public` (`teaser`;
  `who-stays-visible-teaser-public-40s.mp4`), `full-local` (`full-moscow`; `who-stays-visible-full-local-287s.mp4`),
  `teaser-local` (`teaser-moscow`; `who-stays-visible-teaser-local-46s.mp4`), `moscow` (`treated`;
  `who-stays-visible-moscow-110s.mp4`); 720p copies take the suffix `-720p`; the lengths are the rendered
  ones. The page's cut ids, its labels, the capture script's usage note, the publish set (the page's
  default cut is `full-public`) and the audit file names use the new names; the run logs under `logs/` keep
  their run ids, and the verification lines of rounds 1-4 above keep the names of their day. The stale
  720p copy of the 85 s treated cut was removed.
- Residuals. The national raster fades in only once it is within 1.3 times its rest size (k 0.168 to
  0.218), so the slide to the national framing shows the land, the borders and the red marks, and the
  firm field arrives as the camera settles; the marks' two sets still cross-fade between k 3 and 1, so
  the pull-back is never bare. The close panel dims the map under it (0.6 instead of 0.92) rather than
  covering it, so the far east reads through the text.
- Verification of the close: all five cuts probe clean under the new names; the text audit reports zero
  findings on `full-public`, `teaser-local` and `teaser-public` and only the counted `box-over-mark`
  lines (17 each) on `full-local` and `moscow`; `full-local` re-rendered (run `20261023T090103Z`, 8 shards,
  155 s, 8,610 frames / 286.999 s, 79.7 MB; 720p copy 21.2 MB) and `moscow` (run `090425Z`, 4 shards,
  130 s, 3,300 frames / 110.000 s, 44.1 MB; 720p copy 13.6 MB), both verified by `ffprobe` against
  `__videoMeta`; frames 1,500, 5,590 (the slide) and 6,090 (the close) of `full-local` byte-identical
  across three shards and in one process (AE = 0); frames at 185.5, 186, 186.5 and 203 s of `full-local`
  and 105 s of `moscow` extracted from the finished files and inspected (`build/r4-close/`).

### Round-4 verification

- Data: M8 74 checks pass (listed above); M6 and M7 unchanged and not re-run (the shared code's per-year table build yields the same tables; `M6-treated.R` lost nothing but three function definitions that moved to `M6-common.R`); `check-readonly.sh` reported nothing changed outside the lab; no identifier names in `national.json` or `treatednational.json` (the save helper refuses them); the page's `__ready` checks the national counters against the manifest and the Moscow point's projection against the manifest's pixel before building the local cuts.
- Page: all five cuts load and seek without exceptions in headless Brave (`--probe`: `problems: []`); the first probe caught one syntax error of the round (a trailing comment that swallowed a one-line block in `drawField`), fixed before any frame was captured.
- Review frames from the page (`build/r4-a/`, `r4-b/`, `r4-c/`): the street dissolve at k 130 and the return at k 150 under the tighter fade; the pull-back at 184.5, 185, 185.5 and 186 s (the first single-segment move left bare land at 185 s because the camera centre moved east before the national raster had faded in; the two-segment move keeps Moscow on screen); the national run at 2014, 2020, 2025; the close at 199 and 203 s; the lists table at 260 and 261.5 s (the two denominators collided in the first layout; the labels dropped to 22 px and the columns moved apart); the Moscow pull-backs at 161 and 173 s and the national slide at 186 s without the backwards bloom rings. Frames from the finished MP4s (`build/r4-final/`: 93.8, 142, 184.5, 185.5, 186.5, 190, 195.5, 199, 203, 205 and 261.5 s of `full-moscow`, 97 and 105 s of `treated`, 166 s of `full`) were inspected at full size.
- Text audit (step 6; the teasers at step 3): zero findings on `full`, `teaser-moscow` and `teaser`; `full-moscow` and `treated` carry only the counted `box-over-mark` lines (17 each). The teaser was re-audited and not re-rendered: nothing in its windows changed.
- Renders (sharded; runs `20261023T083944Z` full-moscow with 8 shards, `084255Z` full, `084609Z` treated, `084827Z` teaser-moscow): `ffprobe` reads 1920x1080, 30/1, h264 yuv420p and 8,610 frames / 286.999 s (157 s of capture, 81.0 MB), 5,760 / 192.000 s (173 s, 45.5 MB), 3,300 / 110.000 s (123 s, 45.2 MB) and 1,380 / 46.000 s (43 s, 17.3 MB) against `__videoMeta`; no page exceptions in any shard log. The 720p preview of the Moscow cut (`build/who-stays-visible-moscow-720p.mp4`, 21.6 MB) was remade.
- Determinism: frames 1,500, 5,700 (the national run) and 6,000 (the close) of `full-moscow` captured across three shards and in one process in another order are byte-identical (ImageMagick AE = 0 each).
- Artifact: the publish set (5.1 MB; the refusal pattern now also covers `national`) carries the lists table and the renamed cut ids; the explainer artifact is at v8 (lists table) and v9 (names). The atlas artifact stays at v2.
- Residuals: the national raster is drawn at 6 to 3 times its size for about a second during the slide (k 1 to 0.3); the live box's mark coverage is counted, not zero; the close panel covers the far east of the national map for the seven seconds of the close.

### Atlas text at the artifact's panel width (23 October, after the author's screenshot)

At the artifact's 300 px side panel the atlas's charts overlapped and clipped: the line charts drew their tick labels at the explainer's 22 px inside a 44 px margin (every y tick read "0%"), the two end labels of the availability chart ran off the right edge and over each other, the slope chart stacked "State-related" and "Unitary" (69.2 and 68.8), and the odds chart's year ticks ran together. The chart helpers gained opt-in options (`axisSize`, `axisDy`, `spreadLabels` on `lines` and `yearDots`, `spread` on `slopes`, `thinTicks` on `yearDots`, a tick size and header offset that follow small text sizes) that the atlas sets and the explainer does not; `C.spread` pushes labels apart to a minimum gap inside the box. The atlas measures its longer end label for the right margin. A new `tools/atlas-audit.py` drives `explorer.html?__audit=1` through `window.__atlas` at 1,200, 1,600 and 2,000 px, every layer and three years of the share layer, and tests overlap, bounds and size per canvas: 24 states, 816 boxes, zero findings (`build/audit-atlas.txt`). The explainer stays byte-identical (three frames of `full-local` at AE 0). The atlas artifact was republished as v3.

### Atlas on the charcoal ground (23 October)

The atlas's dark theme now shares the explainer's round-3 palette: the charcoal ground and land, the pale borders, the ink, muted and dim text, the grid and the panel tokens from `css/theme.css`; the selected control is a teal (`#1F6F80`, 5.8:1 with white) in place of the navy-era blue; the map legend and note sit on the panel colour at 0.92, as the explainer's panels do. The data ramps are unchanged (YlGnBu for ordered layers, PRGn for signed change, the density teal). The light theme keeps the manuscript's production colours. Audited again at three widths (zero findings); both themes inspected in screenshots; the atlas artifact republished as v4.

### Under the cursor: 1 km year series and the empty-cell case (23 October)

The panel's year chart drew only for 100 km cells, although `cellsyears.city_1km` carries 2019 to 2024 series for the 1 km city cells; it now draws those six years for a hovered 1 km cell (cells with 50 or more located firms in a year), names the 250 m and 5 km density cells as 2021-only, and states an empty cell. A cursor in a gap between 1 km cells had resolved to the 100 km cell behind it for the panel while the tooltip reported an empty cell; a gap is now an empty cell of the fine grid for both. `tools/atlas-audit.py` gained six hovered states through `window.__atlas.hoverKm` (the Moscow 100 km cell, two 1 km cells in 2021 and one in 2023, a 5 km density cell, a 250 m cell): 42 states, zero findings. The atlas artifact was republished as v5.

## Round 5 (23 October 2026): firm-level publishing, the firms view, one cut family

### The rule change

Author's decision, 23 October 2026: the motion study's published artifacts may carry firm-level data
(coordinates, per-firm states and revenue classes) from RFSD, a public dataset cited on every page and
video under CC BY 4.0; the "aggregates only" constraint and the publish set's refusal of firm-level
files are withdrawn for the motion study. Two rules stay and are checked at publish time by
`tools/publish-set.py`: no shipped data file carries an identifier key (`inn`, `ogrn`; the R save
helper refuses them too) and the neighbour firm (`anchors.b`) carries no name. On 25 October 2026 the author added the
naming rule: firms on the five lists are named from the list files (the round of 25 October below); the save helper and
`publish-set.py` allow the name keys on `treated.json` and `treatednational.json` only, so firms on no list are never
named. The citation now reads
"RFSD v3.1.0, CC BY 4.0" on both pages and "(Bondarkov et al. 2025, CC BY 4.0)" in the atlas footer; the
video credits line reads "Data: RFSD v3.1.0 (Bondarkov et al. 2025, CC BY 4.0), 63,308,662 annual
records, financial years 2011–2025, values deflated and classed by the author", one line at 22 px.

### Size budget and hosting

Firms mode needs one record per distinct registered address (1 m rounding) of firms on no supplied
list with house- or street-level geocodes, per financial year: 15 bytes (x, y as int32 metres of the km
plane; n, a, f as uint16 firms, statements, filers with a baseline and a value; cls as uint8 relative
revenue class). 2021: 692,057 distinct coordinate pairs for 3,078,593 firms (727,190 distinct coordinate pairs over every
located firm, listed and other geocodes included, the density pass's count exactly), 10.4 MB raw, 3.8 MB
gzipped; 2014: 727,116 addresses for 4,288,612 firms, 10.9 MB raw, 3.9 MB gzipped; twelve years 44.9 MB
gzipped. The artifact host serves only listed file types, so each year's gzipped bytes travel as base64
inside a script (`data/firms/firms-YYYY.js`, about 5 MB, the lab's pattern for binary arrays), 59.9 MB
in all; the page injects the year's script on demand and inflates it with `DecompressionStream`. The
artifact's limits (16 MB per page or text file, 15 MB per binary file, 64 MB and 255 files per publish,
256 MB and 511 files per version) hold everything: the atlas publish set is 68 MB in two uploads, the
explainer's 49 Moscow rasters the journey loads (41.2 MB) and the 24 national rasters (1.3 MB) two
uploads. The author chose this over a static site and over firms inside the city windows only.

What every view shows: every firm is in the data at every zoom; nothing is sampled or thinned. Below
20 px per km (the Moscow region extent's rule) an address is a 1 px mark, 2x2 for 10 or more firms, 3x3
for 100 or more, with alpha rising by count, so addresses closer than one screen pixel merge into one
mark whose count the hover reports; at the Russia preset a pixel is about 5 km, as in Figure 2.7's print.
From 20 px per km every address is its own disc sized by count (the city rule to 60, the downtown rule
above). Firms at one coordinate pair are one mark by definition. Other geocodes (195,010 in 2021) are
counted in the legend and not drawn, as in the Moscow pass. The Moscow rasters the videos use are
unchanged; the atlas draws from the address files.

Videos: the 1080p files (14.7 to 79.8 MB) stay files for a video host; the 720p copies under the 15 MB
asset cap (the teaser, the Moscow cut, the 55 s maps-and-firms cut) are attached to the explainer
artifact as assets and linked from the page; the full cut (21.2 MB) and the 174 s cut (17.1 MB) do not
fit at 720p without visible loss.

### One cut family

The public/local split is retired. The two address-pile facts of the cells-only cut's 250 m leg now
sit in the downtown year run as one line on a 0.92 panel at the top left, from 1.6 to 8 s into the run
in both the journey and the standalone cut: "Across Russia in 2021: 7,928 firms at the largest registered
address, 514,368 at addresses shared by 100 or more." (the same counts and denominators). The audit
reported no finding for it, so the fallback (keeping a cells-only cut) was not needed: the cells-only
cuts, their beat lists (`LIST_FULL`, the `moscow250` and `out` beats), the zoom scene's published mode
and the public teaser's windows are deleted, and the page builds one family:

| Cut (round-5 name; round-4 name) | URL | Length | Frames | File |
|---|---|---|---|---|
| `full` (`full-local`) | `explainer.html` (default) | 287 s | 8,610 | `build/who-stays-visible-full-287s.mp4`, `-720p` copy |
| `teaser` (`teaser-local`) | `?cut=teaser` | 46 s | 1,380 | `build/who-stays-visible-teaser-46s.mp4`, `-720p` copy |
| `moscow` (retired 24 October 2026) | `?cut=moscow` | 110 s | 3,300 | `build/who-stays-visible-moscow-110s.mp4`, `-720p` copy |
| `maps-firms-instagram` (`maps-firms-local`; retired 24 October 2026) | `?cut=maps-firms-instagram` | 174 s | 5,220 | `build/who-stays-visible-maps-firms-instagram-174s.mp4`, `-720p` copy |
| `maps-firms-instagram-55` (`maps-firms-local-55`; retired 24 October 2026) | `?cut=maps-firms-instagram-55` | 55 s | 1,650 | `build/who-stays-visible-maps-firms-instagram-55s.mp4`, `-720p` copy |

The page builds every cut at once without the rasters and loads the Moscow and national rasters in the
background, handing them to the scenes through `TreatedScenes.setImages`; in render mode `__ready`
waits for them, so captures are unchanged. The logs under `logs/` keep the old names as the record.

### M9: registered addresses per year (`R/motion/M9-firms.R`)

National scope through `M6-common.R` (the per-year table build and the national yearly medians of M8).
Per year, one record per distinct coordinate pair of firms on no list with house- or street-level geocodes, sorted by x then
y, written as a 32-byte header (`FRM1`, record count, origin, year, version) and a struct of arrays
(x i32, y i32, n u16, a u16, f u16, cls u8), gzipped, with a base64 `.js` twin; `data/firms.json` holds
the layout, the per-year counts and sums, the files and sizes, the mark rules, the breaks and both looks'
colours. 173 checks pass (`data/firms.checks.csv`): per year the firms at the addresses equal M8's drawn
firms and the filers equal M8's `filers_base`, an address has a class exactly when it has a filer with a
value, the read-back header, first and last records and sums match, the raw size is 32 + 15 records and
the gzipped file is under 15 MB; M6's pile rule reproduced in SQL equals M6's Moscow piles and marks in
the city and downtown extents for every year, and the file's rounded subset differs from them only at
the rectangle's edge (at most four coordinate pairs); for 2021 the distinct coordinate pairs of all located firms,
the largest address (7,928 firms) and the firms at addresses with 100 or more (514,368) equal the
density pass's facts. Run under the guard in 108 s, peak 12.9 GB.

### The atlas's firms view

A "View" row above the layer buttons (Cells, Firms; hidden when the address data or `DecompressionStream`
is absent); cells mode is the round-4 code untouched. In firms mode the map draws every address of the
year (the year row applies to every layer): the national blit composites the marks by hand into the
map's device pixels (every address projected through the sorted x column's visible range, floor, blocks
scaled by the device pixel ratio, "over" on the opaque canvas), the discs draw one `Path2D` per colour
class, largest first. Colour by layer: the share layer gives the address's statement share in the six-class
ramp with the 100 km breaks (one firm: absent or available at the two ends), the revenue layer the
address's class in the blue ramp (neutral when no firm there has a baseline and a value), every other
layer the neutral tone; listed firms from `treatednational.js` draw last as vector marks (the Moscow
`redMark` style, now `MM.listedMark` in `map-layers.js`): red from their listing year, a ring when the
year's statement is absent, their own state's colour before (with a thin red rim since 25 October). Hover gives counts and, for listed firms, their list-file names (up to three, red first, then "and k more"; 25 October 2026): the
nearest address within its mark radius plus 2 px (found through the sorted x column), "Address: n located
firms, a with a YEAR statement (share)" and on the revenue layer the filers and the median class, plus
the listed firms at the address (below 20 px per km, within the mark's radius in km, which the tooltip
states); the under-the-cursor panel keeps the cursor's cell chart and gains an address row. The legend
names the layer's ramp, the one-firm reading, the red and ring glyphs, the mark rule at the zoom and the
year's totals (firms, coordinate pairs, other geocodes not drawn, firms on these lists). Light theme: the navy
ramp and neutral from `M6-common.R`'s light look. Timings in headless Brave at 1,400 by 1,000: a year
loads in 0.14 to 0.31 s from the local server, the national blit draws in 27 to 34 ms, a city or
downtown view in 10 to 12 ms.

`tools/atlas-audit.py` awaits the year's data (`__atlas.ready()`) and covers the firms states (share
2014/2021/2025, revenue 2021, density 2021 and lists 2021 at the Russia, Moscow and Central Moscow
presets) and two hovers beside the cells states: 75 states, 2,691 boxes, zero findings at 1,200, 1,600
and 2,000 px.

### Round-5 verification

- Cuts: the five cuts probe clean under the new ids; the text audits report only the counted live-box coverage (17 lines each on `full`, `moscow` and `maps-firms-instagram`, 5 on the 55 s cut) and zero findings on the teaser, with the fact line and the longer credits in place; frames of the fact line (full at 150 s, the 55 s cut at 50 s) and the credits (282 s) inspected at full size. Renders (sharded; runs `20261023T105526Z` full with 8 shards, `105850Z` teaser, `105945Z` moscow, `110211Z` maps-firms-instagram with 6 shards, `110439Z` the 55 s cut): `ffprobe` reads 1920x1080, 30/1, h264 yuv420p and exactly 8,610 frames / 286.999 s (154 s of capture, 79.8 MB), 1,380 / 46.000 s (44 s, 17.3 MB), 3,300 / 110.000 s (124 s, 44.1 MB), 5,220 / 174.000 s (117 s, 57.3 MB) and 1,650 / 54.999 s (71 s, 14.8 MB) against `__videoMeta`; 720p copies of every cut (21.2, 4.4, 13.6, 17.1 and 4.7 MB).
- Atlas: `atlas-audit.py` zero findings over 75 states at three widths; firms mode inspected in screenshots at the Russia, Moscow and Central Moscow presets on the dark theme and at the Russia preset on the light theme, with the hover and the legend; the loader exercised through the local server (a year in 0.14 to 0.31 s, the sentinel checks passing).
- M9: 173 checks pass; `check-readonly.sh` reported nothing changed outside the lab; `firms.json` carries no identifier names; every year file under 15 MB gzipped (3.8 to 4.1 MB) and under 16 MB as a script (about 5 MB).
- Publish set: the identifier and neighbour-name guards pass; 109.8 MB in all; the explainer artifact at v13 (v12 declared the assets capability, v13 links the three video assets) and the atlas at v7 hold every file; the load on the host could not be checked from the lab (a claude.ai session is needed), so that check is the author's.

### Wording on screen (author's decisions, 24 October 2026)

The screens say "listed firms" and "firms on no list"; "supplied list" and "treatment group" appear
nowhere on screen (the provenance word stays in this README; the credits' caveat read "Supplied lists are fixed memberships, not dated designations." until 25 October 2026, when it became "The lists are fixed memberships, not dated designations." under Part B item 5, so no exception remains on screen). Legends, atlas and video: the red row
"Sanctioned or strategic firm, red from its listing year." with the solid glyph, the ring row "listed, no
statement that year" with the ring glyph, and the size rule in dot language ("Each dot is one address.
Larger dots hold more firms." in the city windows, "Each dot is one address. Dots widen at 10 and 100 or
more firms." zoomed out; "Each mark is one address. Larger marks hold more firms." in the video's downtown
run). Atlas firms legend: the title "Firms by registered address, YEAR" with a colour line ("Colour:
share of the firms at the address with a YEAR statement", or on the revenue layer "Firms on no list, YEAR"
and "Colour: real revenue change since the firm's own 2019–2021 average, minus the year's median change"),
"A single firm shows the first colour (no statement) or the last (statement available).", the neutral
row "no firm at the address has a usable baseline", and the note "N firms at M addresses. C firms located
only to a city centre are not drawn. L listed firms." Atlas cells legends: "fewer than 50 firms, share not
shown"; the lists layer is "Listed firms, 2021" with "List memberships are fixed. Cells with 1 to 4
members show no count. The hover gives the government strategic list separately."; the footer says "the
lists are fixed memberships, not dated designations." Video: the chapter "Listed firms" with the caveat
"List memberships are fixed, not dated designations. The odds compare populations, not the same firms.";
the Moscow close "Dated by the sanctions list (1,003 of 2,220 dates inferred). 200 undated listed firms
red throughout. Descriptive, not causal."; the ticker unchanged ("listed firms shown red"); the comparison
beat keeps "firms listed in 2022" and "firms on no list". The credits caveat moved to 22 px to hold the
extra sentence. All five cuts were re-rendered: the legend changes reach the four with the Moscow section
and the credits caveat reaches the teaser as well.

Verification of the wording (24 October): the atlas audit reports 75 states, 2,691 boxes and no finding at
1,200, 1,600 and 2,000 px; the text audits report only the counted `box-over-mark` lines (`full` 17 over
1,435 frames at step 6, `moscow` 17 over 550, `maps-firms-instagram` 17 over 870, `maps-firms-instagram-55`
5 over 550 at step 3, `teaser` none over 460 at step 3). The lists caveat then moved from a 1,000 px box,
where it wrapped with one word on a second line, to 1,160 px (nothing else sits at that height), and
`full` was audited again (1,435 frames, 28,871 boxes, the same 17 lines) and rendered again. Renders
(sharded, `ffprobe` against `__videoMeta`): `full` run `20261024T053603Z-capture`, 8 shards, 169 s,
8,610 frames / 286.999 s, 79.8 MB, 720p copy 21.2 MB (the earlier run `052603Z` of this wording was
replaced by it); `teaser` run `052906Z`, 4 shards, 47 s, 1,380 / 46.000 s, 17.3 MB, 720p 4.4 MB;
`moscow` run `052957Z`, 4 shards, 128 s, 3,300 / 110.000 s, 44.1 MB, 720p 13.6 MB; `maps-firms-instagram`
run `053212Z`, 6 shards, 126 s, 5,220 / 174.000 s, 57.3 MB, 720p 17.1 MB; `maps-firms-instagram-55` run
`053428Z`, 4 shards, 71 s, 1,650 / 54.999 s, 14.8 MB, 720p 4.7 MB. Frames checked at full size: the Moscow
legend rows at 152 s of `full` (`build/r5-c/f04560.png`), the lists beat at 254 and 264 s (`f07620.png`,
`f07920.png`, the caveat on one line), the credits at 282 s (`f08460.png`), and frames extracted from the
finished files (the Moscow legend at 62 s of `moscow`, the credits at 44.8 s of `teaser`, the comparison
beat at 30 s of the 55 s cut, the caveat at 264 s of `full`). The three 720p assets on the explainer
artifact were replaced by the new teaser, Moscow and 55 s files and the old assets deleted (v16); the
atlas is at v8.

Clearing of `build/` (author's decision, 24 October 2026): the working frame folders of rounds 3 to 5 (57
folders, 263 PNG frames and the three JPG review sheets of rounds 3 and 4, 194 MB) and the audit JSON files
(31 files, 184 MB, regenerable with `capture.py --audit`) were deleted to save space. The frame paths named
above and in the round sections no longer exist; the frames had been inspected at the time, and the record
of what was checked stands in this README. Kept: the ten current videos, `smoke.mp4`, the six `audit-*.txt`
summaries and `logs/`.

Correction to the wording standard (author, 24 October 2026, superseding the items above where they
conflict). (a) The five-list union is "firms on at least one of the five lists", shortened to "firms on
these lists", never "sanctioned or strategic firms"; the red row reads "Firm on one of the five lists, red
from its listing year." in the atlas and the video; the ring row and the ticker ("listed firms shown red")
stand; the close reads "N firms on at least one of the five lists red by 2025 within 160 by 90 km of
Moscow" and "200 undated firms on these lists red throughout", the St Petersburg sentence "the absence of
its firms on these lists after listing"; the lists chapter is "The lists" with the title "Firms on the
sanctions list: lower odds of a statement by 2024"; the atlas lists layer is "List members, 2021" (its two
lists named in the provenance and the hover). (b) "Decree list" keeps its name (it was never renamed on
screen). (c) Geocoding categories are house-level, street-level and other geocodes, defined once in the
atlas firms-view provenance as "coordinates without a verified house or street match", with the line "Most
located firms have a house- or street-level address match. The remaining geocodes have unverified
precision."; "city-level geocodes" is retired in this README as well. The mapping is exact: RFSD's
geocoding quality among the 3,277,638 located eligible firms of 2021 takes three values, house (2,441,054),
street (641,375) and city (195,209), so the passes' quality-city flag is the other-geocodes category
(read-only query of 24 October, run `20261024T203404Z`). (d) Pile counts say "coordinate pairs", not
addresses: the atlas header "3,277,638 located eligible firms at 727,190 distinct coordinate pairs in
2021", the density note "the most shared coordinate pair holds 7,928 firms", the firms note "3,078,593
firms on no list at 692,057 distinct coordinate pairs; 4,034 firms on these lists. 195,010 firms with other
geocodes are not drawn.", the legends "Each dot is one coordinate pair." and "Each mark is one coordinate
pair.", the tooltip and the under-the-cursor row "Coordinate pair"; "registered address" stays where it
names the legal address at which a firm is drawn. (e) Shared registrations are explained in the author's
sentences, with "can", not "often": all three in the atlas firms-view provenance, the first two in the
video's downtown run, where the facts panel now reads "Across Russia in 2021: 7,928 firms at the most
shared coordinate pair, 514,368 at coordinate pairs shared by 100 or more firms." over them and stays for
the whole run (1.6 to 13.8 s of the run in the journey, 53.6 to 65.8 s of the standalone cut); the 55 s
cut, whose run is shorter, shows the facts alone. The transitions title "Absence often precedes removal"
is a different claim and keeps its word. The teaser carries none of these strings and was not re-rendered.

Verification of the correction: all five cuts probe clean; the atlas audit reports 75 states, 2,691 boxes
and no finding at 1,200, 1,600 and 2,000 px; the text audits report only the counted `box-over-mark` lines
(`full` 17 over 1,435 frames at step 6, `moscow` 17 over 550, `maps-firms-instagram` 17 over 870,
`maps-firms-instagram-55` 5 over 550 at step 3, `teaser` none over 460). Renders (sharded, `ffprobe`
against `__videoMeta`): `full` run `20261024T204123Z-capture`, 8 shards, 189 s, 8,610 frames / 286.999 s,
79.5 MB, 720p copy 21.1 MB; `moscow` run `204453Z`, 4 shards, 147 s, 3,300 / 110.000 s, 43.7 MB, 720p
13.5 MB; `maps-firms-instagram` run `204728Z`, 6 shards, 139 s, 5,220 / 174.000 s, 57.0 MB, 720p 17.0 MB;
`maps-firms-instagram-55` run `205002Z`, 4 shards, 83 s, 1,650 / 54.999 s, 14.5 MB, 720p 4.6 MB. Frames
checked at full size before the renders (`full` at 152, 158, 200 and 264 s, the 55 s cut at 50 s) and from
the finished files (the close at 203 s of `full`, the downtown run at 64 s of `moscow`); the atlas firms
view screenshotted at 1,600 px with its legend, note, provenance and header read back. Artifacts: atlas
v9, explainer v17 with the Moscow and 55 s 720p assets replaced and the old ones deleted (the teaser asset
is unchanged).

Cuts retired (author's decision, 24 October 2026; no video versions tagged "instagram" or "moscow"): the
Moscow standalone (`moscow`, 110 s) and the two maps-and-firms cuts (`maps-firms-instagram`, 174 s;
`maps-firms-instagram-55`, 55 s) are gone. Their six files (1080p and 720p) were deleted from `build/`; the
builders were removed from `js/explainer-scenes.js` (the `sequence` helper, the kept-year list and the two
cut specs) and `js/treated-scenes.js` (the standalone timeline, keyframes, scenes and the `make` and
`standalone` exports; the camera rest, the year-run helper and the journey's kept-year option stay, and the
alignment probe is exported for a future cut); the page's cut button offers `full` and `teaser`, and a
`?cut=` request for a retired id falls back to `full`; the publish set links the teaser asset only, and the
Moscow and 55 s assets were deleted from the explainer artifact (v18). Verification: both cuts probe clean;
the audits are unchanged (`full` 1,435 frames, 29,129 boxes, the 17 counted lines; `teaser` 460 frames,
none); frames 4,560, 4,740, 6,000 and 7,920 of `full` and 300, 700 and 1,300 of `teaser` captured before
and after the change are byte-identical, so the video files were not re-rendered. The video deliverables are
`full` and `teaser`, each with a 720p copy.

Correction (author, 25 October 2026): the two red legend rows above are replaced in both pages by three rows
with glyphs, "On one of the five lists, before its listing year" (a rimmed dot), "Listed, red from its listing
year, statement available" (solid red) and "Listed, no statement that year" (hollow red); the ticker reads
"N listed, shown red", "M on a list, ringed", "K without a YEAR statement" (the round of 25 October below).

### Atlas: the treated gloss, click-to-zoom, zoom controls, a phone layout (author's requests, 24 October 2026)

Wording. The atlas, and the atlas alone, carries a viewer-facing gloss after its list terms: "(treated)" after
every string that names the five-list union or one of its lists, and "(comparison group)" after "firms on no
list" (an atlas-only exception to the morning's rule against "treatment group" on screen, at the author's
request; "(designated)" was offered and declined, because four of the five lists are undated administrative
memberships and the page itself says "fixed memberships, not dated designations"). The word is defined once,
in the footer and in the lists layer's provenance: "Treated: a firm on at least one of the five lists (sanctions,
decree, resident, government strategic, presidential strategic). The word names the study's group, not an
effect." The footer adds "Comparison group: firms on none of the five lists." The strings: the firms legend's
red row "Firm on one of the five lists (treated), red from its listing year." and ring row "listed (treated), no
statement that year", the revenue-layer title "Firms on no list (comparison group), YEAR", the firms note
("... firms on no list (comparison group) at ... distinct coordinate pairs; ... firms on these lists (treated)
..."), the firms tooltip ("... on one of the five lists (treated) ..."), the firms-view provenance, the lists
layer "List members (treated), 2021" with its provenance, legend title "Sanctions-list members (treated) per
100 km cell, 2021" and note ("The hover gives the government strategic list (treated) separately."), the share
tooltip "Sanctions-list members (treated): n", the lists tooltip ("Sanctions list (treated)", "Government
strategic list (treated)"), the odds chart's series label "sanctions list (treated)" (its right margin is now
measured, as the national chart's is, since the glossed label is 128 px wide against the 128 px the fixed
margin left) and provenance ("... firms on the sanctions list only (treated) against firms on no list
(comparison group) ..."), and the odds canvas's aria-label. Two defects found on the way were fixed: the lists
legend showed four classes coloured one step off the three the map draws (now 5–19, 20–49 and ≥ 50 members at
the map's colours, with the cell counts 68, 12 and 5; three cells with 1 to 4 members show no count), and the
fine-cell tooltip said "with a 2021 statement" whatever the year (it now names the year of the grid it reads).

Interaction. One camera animation, `flyTo`, built on the explainer's `Motion.camera` (cubic position, log-k
zoom; about 600 ms plus 250 ms per doubling, at most 1.4 s; a long pan pulls out and back in through a middle
keyframe), serves cell clicks, the preset buttons, the zoom buttons, the keys and a double tap; a flight frame
skips the legend rewrite and the audit record, the last frame draws fully and refreshes the hover. The click
ladder: from the country a click on a 100 km cell flies to its preset city's window (95 km across the shorter
side, as the city presets) or, for a cell without one, to the cell at 500 km across; at the city scale to the
20 km scale (the 250 m cells) on the clicked 1 km cell; at the fine scale and in the firms view one step of
x2.5 at the point; a click always zooms in (past a rung it steps), Shift+click steps out, an empty cell does
nothing. A click is a press and release within 5 px and 300 ms; anything longer or farther is a drag. Pointer
events replace the mouse handlers: one finger drags, two fingers pinch (the wheel's cursor-anchor rule at the
midpoint), a tap on a touch screen selects the cell (tooltip, outline, the under-the-cursor panel) and a second
tap within 450 ms flies the ladder. Keys, when the map has focus: + and − zoom one step, 0 fits the country,
the arrows pan (Shift: a small step). The zoom floor is the fitted country for the wheel, the buttons and the
keys alike (the wheel's floor was 0.05 px per km). Cursors: grab, grabbing, pointer over a cell that would fly,
zoom-in where a click steps. The hover outline and tooltip are recomputed after every camera move (they went
stale after a wheel or a preset before), and the tooltip flips to the cursor's left near the right edge rather
than covering the zoom buttons. A zoom box sits at the bottom right (zoom in, zoom out, fit the country; 40 px,
44 px on a coarse pointer; "−" disabled at the fitted country, "+" at the 200 px per km ceiling) with a scale
bar above it (the largest round length at most 84 px wide, 1,000 km down to 100 m). `prefers-reduced-motion:
reduce` makes every flight a jump. A plain anchor opens the atlas at a preset, `#Moscow`, `#St-Petersburg`,
`#Central-Moscow` (a label without its parenthesis, non-alphanumerics as hyphens, case-insensitive), with a
`-firms` suffix for the firms view; the page never writes the hash.

Phone layout. Below 900 px the page scrolls: `html, body` take `min-height: 100%` instead of a fixed height,
`main` is a block, the map a fixed-height block (62vh, between 360 and 560 px) and the side cards stack under
it (the earlier viewport-locked layout squeezed the panels into a 98 px strip with 1,837 px of content
scrolling inside it, verified at 390 by 844 px). The legend and the note have a toggle in their head row,
start collapsed when the map is narrower than 600 px, remember the choice per viewer (localStorage, in
try/catch), and on a narrow map open one at a time. The legend's width clears the right-hand column (the zoom
box and the scale bar, 100 px); the panels size border-box. A resize keeps the centre and the span across the
width.

Audit. `tools/atlas-audit.py` now also reads the overlays' boxes (`window.__atlas.redraw()` returns `{boxes,
dom}`) and the camera, checks that the legend, note, zoom box and scale bar lie inside the map and never
intersect one another (the tooltip follows the cursor and sits above the panels, so it is held inside the map
but not counted against them), asserts the camera after the ladder, the zoom buttons and the presets through
the page's instant API (`preset`, `click`, `zoom`, `legend`, `note`, `camera`, `kFit`, `fly`, `frameCost`), and
runs at 400, 768, 1,200, 1,600 and 2,000 px: 190 states, 7,321 boxes, zero findings. Other checks (read-only
scripts in the session's scratchpad, not kept): real flights at 1,600 px run at 59, 60 and 56 fps in cells mode
(share and density layers, Russia to Moscow and Moscow to Central Moscow) and at 50 and 39 fps in firms mode
(the national blit costs about 35 ms of script time per frame; the loop is time-based, so a flight's length
holds); at 390 by 844 px with touch emulation the page is 2,872 px tall with the panels stacked, the legend and
note collapsed and 44 px buttons, a tap shows the tooltip and the panel without moving, a double tap flies to
the Moscow preset, a pinch to twice the finger distance doubles k (ratio 2.000); `#Moscow` opens at the Moscow
preset, `#St-Petersburg-firms` in the firms view at St Petersburg, an unknown anchor at the country; with
reduced motion emulated a flight resolves in 0 frames; a grep of the page and script finds no "supplied list",
"treatment group", "sanctioned or strategic", "designated" or "control" on screen (only the CSS tokens
`--control`); screenshots at 1,600 px (both themes) and on the phone were inspected. Left as they are, noted:
the hit test switches grids at k 1.5 and 24 while the drawing crossfades over 1.5–4 and 24–40, and the share
layer's hover shows no values at the city scale for years without a 1 km grid (2014 to 2018 and 2025). The
atlas artifact is at v10; `js/motion-core.js`, `js/map-layers.js` and `js/charts.js` are untouched, so the
explainer's frames are unchanged and no cut was re-rendered.

Directed flights (author's request, 24 October 2026, later the same evening): a zoom-in used to zoom into the
middle of the current view and pan to its subject in the last moments, because the camera's centre moved at a
steady pace in kilometres while the zoom grew exponentially, so the subject drifted outward on screen before
snapping to the centre. `Motion.camera` (shared by the explainer's keyframes and the atlas's flights) now
directs every segment at its subject: zooming in, the end centre's screen position moves linearly from where
it starts to its final place, so the zoom is aimed at it from the first frame; zooming out, the start centre's
screen position drifts linearly from the middle to where it ends up, so the view widens around the current
spot; a pan at a fixed zoom is the linear path. The author chose this over a two-phase pan-then-zoom, and asked
for the video as well as the atlas. Atlas: `window.__atlas.pathPreview(target, n)` returns the subject's
screen distance from the centre along the flight `fly(target)` would take, and the audit asserts that it never
grows and ends at 0 for Russia to Moscow, Moscow to Central Moscow and Russia to the cell 300 km east of
Moscow (205 states, 7,321 boxes, zero findings at the five widths); from the country Moscow's distance falls
389, 387, 377, 347, 289, 195, 100, 42, 12, 2, 0 px over a flight, and a Moscow to Vladivostok flight pulls out
and brings the destination on screen before settling. Video: the full cut and the teaser probe clean, their
text audits are unchanged (`full` 17 counted lines over 1,435 frames, `teaser` none over 460) and both were
re-rendered: `full` run `20261024T223650Z-capture`, 8 shards, 174 s, 8,610 frames / 286.999 s, 82.2 MB, 720p
copy 21.6 MB; `teaser` run `224003Z`, 4 shards, 47 s, 1,380 / 46.000 s, 19.4 MB, 720p 5.0 MB. Frames of the
flight to Moscow (78 to 92 s), the street zoom (93 to 99 s) and the pull-back to the national framing (184 to
186.5 s) were inspected; a camera trace confirms the pull-back zooms out in place to k 1 and then slides
Moscow across the screen in a straight line (766, 366, 226 px) to its place in the national framing. The
explainer artifact is at v19 with the new teaser asset, the atlas at v11.

Correction (author, 25 October 2026): the atlas rows now read "On one of the five lists (treated), before its
listing year", "Listed (treated), red from its listing year, statement available" and "Listed (treated), no
statement that year"; the tooltip names rimmed firms "on one of the five lists (treated), listed in YYYY".

Correction (author, 25 October 2026, evening): the firms tooltip of the table above is the glance view now: "N firms, A with a
YEAR statement, P%", "N on the lists: R red, H hollow, B before listing", one short line per named firm (the glyph, the name, the
listing year) and "and k more"; "(treated)", the cursor radius and the year words moved to the Under the cursor panel (the round-8
section).

Addition (round 9, 25 October 2026; no earlier string changes): the new on-screen strings follow the standard. The industry
layer: the button "Leading industry by year"; the legend "Leading industry by revenue, YEAR (100 km | 25 km | 1 km cells)" with
"Cells in view by class", nine class rows with counts, "no firm with a revenue value", and in the Firms view "Colour: the
division with the largest share of revenue at the coordinate pair, in nine classes" with "Coordinate pairs in view by class";
the tooltip's "Largest share of revenue: {NACE title} (division NN), P%" and "Then {short} (NN) P%"; the address line "{NACE
title} (division NN), P% of revenue at this coordinate pair", "No OKVED 2 division code (missing or an earlier revision's
code)" and "No firm with a revenue value at this coordinate pair"; the panel rows Leading division, Share of revenue, Class,
Ranked mix, "Firms on these lists (treated)" and "With a revenue value". The tile's footer: "55.75 N, 37.61 E" and "1 px =
110 m". The context strip: the facts listed in the round-9 section ("located firms", "with a statement", "registered in the
region", "firms on no list (comparison group)", "on the lists (treated)", "leads with P% of revenue", "+d points against
2021") and the six tips (the click ladder with its touch form, Shift+click, the pulse button, the Firms view's red rule, the
preset links, the keyboard), each one sentence (25 October 2026: eight tips, each at most 72 characters, in tracked capitals; see round 10). Toggle labels "Collapse the context line" and "Expand the context line". The revenue mix box (the author's correction):
"Revenue mix, YEAR", the unit line "100 km cell at the cursor" / "25 km cell at the cursor" / "1 km cell at the cursor" /
"coordinate pair at the cursor" / "100 km cells in view" / "coordinate pairs in view", the rows "{short name} (NN) P%",
"other divisions N%", "no firm with a revenue value here", "no data in view", the toggle labels "Collapse the revenue mix"
and "Expand the revenue mix"; the listed lines' clause "(12% of revenue here)" and "(12% of 2021 revenue here)"; the
panel's "revenue 2022: 12,345 mn rubles". Nothing says "supplied list", "treatment group", "sanctioned or strategic" or
"control".

### Atlas: pinch zoom, the hand-over between grids, and 25 km cells (author's requests, 24 October 2026)

Two observations from the author's laptop and phone. A trackpad pinch was too slow: it arrives as a wheel event
with the Ctrl flag and small deltas, which the handler treated at the mouse wheel's rate; a pinch now takes
about five times that rate (the ratio map libraries use), and line- and page-based wheels are scaled to pixels
first. On the phone a pinch enlarged the same cells into a few giant squares. Two causes. The national 5 km
grid (the density layer, and the share layer's 2021 shares) faded out between k 1.5 and 4 everywhere, not only
where a city window took over, so a zoom into open country ended on blank ground, and at street zoom the 1 km
cells vanished outside the 24 km square of the 250 m cells; each coarser grid is now drawn around the window
that replaces it (`drawAround`: full alpha outside the window's square and, while the window fades in, 1 minus
its alpha inside it). And for the share layer in years without city grids, the change layer and the lists
layer, 100 km cells were the finest data outside the 22 city windows, so a zoom could only enlarge them; the
firms view behaves differently because it has a point for every firm. The author chose a 25 km national grid
over leaving 100 km as the finest step and over adding a 5 km share grid for every year (mostly below support
outside cities).

M10 (`R/motion/M10-cells25.R`, run `20261024T225231Z`, 4 s, peak 1.2 GB under the guard): the M5 rules
(the production projection and located rule, eligible firms, the original statement, the sanctions-list and
government-strategic-list memberships) binned at 25 km on the plane's origin, so every 100 km cell of
`cellsyears` holds exactly sixteen children. Per year: located firms (n), with a statement (a) and
sanctions-list members (ns); 2021 adds the government strategic list (ng); list counts of 1 to 4 are
suppressed (-1). The change layer compares 2024 with 2021 under the 100 km rule (50 or more firms in both
years, six classes at -5, -2, 0, +2, +5 points). Output `data/cells25.json` and its `.js` twin (2.4 MB, base64
typed arrays): 7,702 to 8,031 cells a year (2,031 to 2,483 with 50 or more firms), 94,335 cell-years, the
change layer 8,019 cells of which 1,975 are supported. Checks (103, all pass): per year the located firms and
the statements equal M5's totals, the parents of the 25 km cells are exactly M5's 100 km cells and the
children's sums reproduce every 100 km cell's firms and statements, the sanctions members (a suppressed
parent's children hold 1 to 4), and for 2021 the shown 100 km government-strategic counts; the change rows
carry both years' totals and every supported cell has a class.

Atlas: the 25 km grid fades in as a 100 km cell passes 45 px (k 0.45 to 0.8) on the share layer (every year),
the change layer and the lists layer, and stays; on the share layer for 2021 the national 5 km shares take over
from k 1.5 to 2.5; the city 1 km windows (2019 to 2024) and the 250 m windows (2021) sit on top of whichever
national grid is shown, each coarser grid drawn around them. The hover reads the finest grid at the point (the
window's cell where a window is in view, else the 25 km cell, else the 100 km cell) and the share layer at the
city scale now answers for years without a 1 km grid (it used to show nothing); the under-the-cursor panel
names the grid and charts the 25 km cell's share by year; the legend names the grid shown and, on the change
and lists layers, gives the 25 km class counts; the cohort and revenue layers say "100 km cells are this
layer's finest resolution" once zoomed past k 1.5. The audit adds the 25 km states (three and four zoom steps
in from the country on the share, change, lists and density layers, two of them with a hover).

Verification: the atlas audit reports 245 states, 8,729 boxes and no finding at 400, 768, 1,200, 1,600 and 2,000
px (the canvas text, the overlays, the camera landings and the flight paths). Read back from the page at 1,600
px: at three zoom steps from the country (k 1.09) the share layer's legend says "(25 km cells)" and the Moscow
hover reads "2021: 444,908 located eligible firms, 261,835 with a statement (58.9%) | Sanctions-list members
(treated): 1,069" with the cursor panel "25 km (-133, 49)"; the change layer at 25 km gives 1,975 supported
cells and the Moscow cell "2021: 261,835 of 444,908 (58.9%), 2024: 261,682 of 446,076 (58.7%), change -0.2
points"; the lists layer "Sanctions list (treated): 1,069, Government strategic list (treated): 181"; the share
layer for 2025 at the Moscow preset, which used to show nothing, reads the 25 km cell (446,941 firms, 56.6%).
Hand-over: on the density layer at k 6 on the west edge of Moscow's 1 km window the national 5 km grid is drawn
up to the window's square and a hover 7 km outside it reads a 5 km cell; on the share layer for 2021 at k 30 on
the east edge of the 250 m window the 1 km cells continue outside the square and a hover there reads a 1 km
cell; for 2023 at k 6 the 25 km cells surround the 1 km window and a hover outside reads the 25 km cell with its
yearly series. A click on open country from the national view on the density layer flies to the 100 km cell
(it used to do nothing when the 5 km cell under the cursor was empty). The phone checks (390 by 844, touch
emulation) hold: the stacked page, the collapsed legend and note, a tap that selects, a double tap that flies
to the Moscow preset, a pinch that doubles k. Screenshots in both themes inspected. The atlas artifact is at
v12.

A click goes to what was clicked (author's observation, 24 October 2026, later): from Chelyabinsk's window a
click on a cell to the north-north-east used to zoom partway towards a point between the two, because a grid
without a deeper rung fell back to a zoom step anchored at the cursor. The ladder now names a subject, the city
whose window holds the point (from the country, the city in the clicked 100 km cell) or else the clicked cell's
centre, and a rung for the grid hit (the city window; a 100 km cell at 500 km across; a 25 km or 5 km cell at
100 km; a 1 km cell at 20 km; a 250 m cell zooms on itself). When the rung is deeper than the view the camera
flies in and centres on the subject; when it is not, the view pans to the subject at its zoom; when the subject
already sits within 15% of the shorter side from the centre, the view zooms x2.5 on it. Shift+click still steps
out at the point; from the country an empty cell still does nothing; the firms view zooms on the point. The
cursor says which (a pointer for a flight or a pan, zoom-in for a zoom). Checked through the API at 1,600 px:
from the country a click on Chelyabinsk's cell lands on its window (k 9.07); a click 160 km to the
north-north-east then pans at the same zoom to Yekaterinburg's window, whose square holds the point (the centre
33 km from the click, on the city); a click on Yekaterinburg's own cell flies to the 20 km scale (k 43.1); a
click near the centre zooms (k 107.75); from the Moscow preset a click 60 km east pans to that 25 km cell's
centre at the same zoom; on the density layer a second click after the 500 km rung frames the 5 km cell at
100 km across. The audit adds the pan state and expects the zoom-and-step-out pair to return to the preset's
zoom within 2 km of the subject (the step out is anchored at the cursor): 250 states, 8,943 boxes, zero findings.
The atlas artifact is at v13.

### Atlas: the trackpad pinch, the zoom floor, and a smoothness audit (author's requests, 24 October 2026)

Pinch. The laptop's pinch, a Ctrl-flagged wheel event with small deltas, now zooms at `PINCH_RATE` 0.018 per
pixel of delta against the wheel's 0.0015 (it was 0.008), a named constant for further tuning; the phone's
pinch is a two-finger touch gesture whose ratio is the finger distance itself, a separate path, so the two are
tuned apart. Zoom floor. Every zoom-out path (the wheel, the trackpad pinch, the touch pinch, the "−" button,
the "−" key, Shift+click) re-centres the map on the country when it reaches the fitted zoom: steps land on the
country's camera, a wheel or pinch that reaches the floor settles there with a 300 ms flight; a safe reset of
the place in view (checked: seven zoom-out steps from the Moscow preset land exactly on the Russia preset).
Since 25 October the pull toward the country's centre begins at twice the fitted zoom (the round of 25 October).

Smoothness. `window.__atlas.profileFlight(target)` records the intervals between animation frames during a
real flight (the compositor's cadence, which stretches when a frame paints slowly) and names the zoom of every
frame over 25 ms; `hoverCost(n)` times a hover. Measured in headless Brave at 1,600 by 1,000 px, device scale
1, software rendering, on the lab machine (not the author's laptop or phone), for three moves per layer and
mode (Russia to Moscow, k 0.14 to 9; Moscow to Central Moscow, 9 to 43; a 60 km pan at Moscow) and hovers at
three presets:

| mode, layer | Russia to Moscow | Moscow to Central | pan at Moscow | hover, mean/max ms |
|---|---|---|---|---|
| cells, share 2021 | 60 fps, p95 16.8, one first-flight frame of 50 ms | 60 fps | 60 fps | 0.9 / 2.8 |
| cells, share 2023 | 58 fps, p95 16.7 | 60 fps | 60 fps | 0.5 / 1.2 |
| cells, density | 59 fps, p95 16.8 (was 55 fps, p95 33) | 60 fps | 60 fps | 0.5 / 1.5 |
| cells, change / lists / cohort / revenue | 59 to 60 fps, p95 16.7 | 60 fps | 60 fps | ≤ 0.6 / ≤ 1.2 |
| firms, share / revenue / density | 46 to 47 fps, p95 33 to 50, a one-time first frame of 167 ms | 38 to 40 fps, p95 67, max 83 | 62 fps | ≤ 0.9 / ≤ 3 |

Three fixes, none changing the picture: the 25 km tiles of the current layer and year are built on the still
draw after a layer or year choice, not on a flight's first frame (a 67 ms frame became a one-time 50 ms on the
first flight only); the national 5 km grid (36,585 cells) is split into 500 km blocks so a draw touches only
the blocks in view and the inside pass of a window crossfade only the blocks under it; and below k 0.5, where a
5 km cell is under 2.5 px, the density counts come from a picture rendered once per theme at 0.35 px per km
and drawn scaled (the rasteriser averaged those sub-pixel cells anyway), which took the density layer's flight
from the country from 55 fps with frames of 33 ms to 60 fps with none. In the firms view the discs' per-frame
sort became a counting sort by radius in tenths of a pixel (equal radii may draw in any order), which did not
move the numbers: the slow stretches are the national blit (every address, 24 ms a frame at k 0.14 to 0.2) and
the disc rendering between k 19 and 43 (up to 42,000 arcs a frame), and they were left as they are pending the
author's choice among the options reported to them (leave as is; thin or halve the resolution of the field on
flight frames only; a cached national field picture per year for k under 0.3; WebGL point rendering).

### Atlas: the pulse of newly listed firms and the address field in WebGL (author's decisions, 24 October 2026)

The pulse. In the firms view a move of the year slider to a later year makes every listed firm that turns red
in the new year (its listing year after the old year and up to the new one, present in the new year)
bloom once as in the video: over 0.9 s the mark swells to 1.9 times its radius and back while its pre-listing
disc fades and a thin red ring expands by 26 px and fades (`startPulse`, `drawMarks`, `PULSE_MS`). A move to an
earlier year starts no pulse and ends a running one, the cells view never pulses, and the marks, the terms and
the legend are otherwise as they were. 732 marks pulse from 2021 to 2022, 3,300 from 2021 to 2024.

The renderer (the author's review of 24 October, seven findings checked against the working copy, which was
the published version). The map is now four canvases: the basemap and the cells on `#map` (a plain 2D context,
no `willReadFrequently`), the address field on `#field` (WebGL 2, or WebGL 1 with `OES_element_index_uint`),
the listed marks and the city labels on `#marks`, the hover outline on `#overlay`; the field and marks canvases
are shown in the firms view only, so the cells view composites the two canvases it always had. Every address
is one vertex (metres relative to the Moscow point, exact in single precision; the firm count; the statement
share class and the revenue class). Below 20 px per km the vertex shader snaps each address to the device pixel
the earlier blit chose (`floor`, blocks of 1, 2 and 3 device pixels per device-pixel ratio for 1, 10 and 100 or
more firms, alphas 96, 140, 200 and 236 of 256) and draws it as a point sprite, composited "over" in index
order with premultiplied blending, which is the blit's arithmetic; from 20 px per km the same vertices become
discs sized by the mark rule (a square under 1.75 px), drawn largest first through an index sorted by radius
(the counting sort), each at alpha 0.9 with an antialiased edge (coverage per fragment), overlaps compounding.
The switch from blocks to discs depends on the zoom alone (the earlier 120,000-address condition is gone), the
thresholds stay at 20 and 60 px per km, and M9 was re-run to say so in its manifest (173 checks, 103 s, 11.0 GB
peak; every per-year count unchanged, the twelve year files regenerated with the same raw and gzipped sizes;
the script's `files_js` key, absent from the earlier manifest, is now in it). Each frame uploads only uniforms:
the camera's integer metres as a shift (so the GPU adds and multiplies small exact integers) and its fraction as
an offset, the zoom, the layer, the palette of up to eight colours, the mark rule. One buffer set is kept per
loaded year and freed with the three-year cache. Without WebGL (the context refused, lost, or `?__nogl=1`) a
2D fallback draws the same field into a transparent canvas of its own (`blit2d`: the blocks composited in
premultiplied bytes, then written as straight colour; `discs2d`: the discs in the same order); a lost context
switches to it at once and a restored one returns to WebGL (the `WEBGL_lose_context` extension is kept from
the live context, since a lost one returns none).

Precision. The old blit floored a double; the GPU floors a single. The scheme above keeps every term exact
except the product of the relative position and the zoom, so the two agree unless an address lies within about
0.0001 px of a pixel boundary; at a zoom where a metre is a round fraction of a pixel (k 2: 0.002 px) one address
in 500 lies exactly on a boundary and single precision rounds either way. Counted on the 2021 file: 46 of
692,057 addresses in view at the country view, 230 of 115,523 at k 2, 4 of 61,358 at the Moscow preset move by
one pixel. No single-precision scheme can reproduce the double's tie-breaking at exact boundaries, so this is
the floor of what a GPU renderer can match; the eye cannot see it.

A defect found on the way, fixed on the author's decision (25 October 2026). `sizeCanvases` read the map wrap's
border box (`getBoundingClientRect`), 2 px wider and taller than the content box the canvases fill inside the
1 px border, so every canvas was drawn at, for example, 1,156 by 862 device pixels and shown in 1,154 by 859.6
CSS px: the browser resampled the whole map by 0.17 % (0.28 % vertically), which blurred 1 px marks a little
and shifted the far edges by up to 2 px, in every version published before v15. The fix reads the content box
(`clientWidth`, `clientHeight`) and gives the canvases an explicit CSS size, so a device pixel is a device pixel
at ratios 1, 2 and 3 (checked: the page's own composite of its four canvases equals the screenshot at offset
zero except 28, 87 and 168 pixels of 1.0, 4.0 and 8.9 million at the three ratios, against 93,704 of 1.0 million
before). The comparison below was run twice: on the page as published (v14 sizing), and on two temporary
copies (the committed renderer and the new one) with the sizing fix applied to both, which compares the
renderers alone; v15 therefore differs from v14 in the cells view too, by the removed resampling.

Verification (headless Brave, 1,600 by 1,000 px, device-pixel ratios 1, 2 and 3, both themes; 252 pictures per
set: nine cameras (the country, k 2, the Moscow preset, k 20, 30, 45, 60, 100 at Moscow, Central Moscow 250 m)
by three layers (share, revenue, density as the neutral layer) for the firms view, five cameras by three layers
for the cells view).

- Cells view: all 90 pictures identical to the committed page (largest per-channel difference 0), with and
  without the sizing fix.
- Block range (the country, k 2, Moscow), renderers alone: the share of pixels differing by more than 2 of 255
  is 0.000 to 0.043 % per picture (at most 1 pixel in 2,300); the pixels differing by 3 to 8 levels number 34 to
  2,559 of 1.0 to 8.9 million (the compositing's rounding: the blit truncated at every step, the GPU rounds);
  the largest per-channel difference is 4 to 172 and comes from the boundary addresses above (0 to about 380
  pixels per picture). On the page as published the same comparison shows 0.6 to 6.6 % of pixels differing by
  3 to 16 levels (largest 156): the resampling defect, which the earlier single canvas suffered once and the
  layered canvases suffer once each, differently at every mark edge.
- Disc range (k 20 to Central Moscow): 6 to 27 % of pixels differ on the share and revenue layers (largest
  223) and on the neutral layer (largest 53 to 83), most at k 20 to 45 where the discs are densest. Two reasons the author accepted: the earlier renderer filled
  one path per colour class, so a later class covered the earlier ones whatever the disc sizes, and now the
  largest disc draws first and the smallest last; and two overlapping discs of one class now compound
  (0.9 to 0.99) where one fill left 0.9. Crops where the size order changed: `motion/build/r6-webgl-crops/`.
- The 2D fallback against WebGL (both copies sized alike): the cells view identical; the block range differs at
  0.01 to 0.71 % of pixels, nearly all by 3 to 8 levels (the fallback composites in bytes and writes straight
  colour, which the browser premultiplies again), the largest differences 61 to 172 at the boundary addresses
  (the fallback floors doubles as the blit did); the disc range at 18 to 20 % of pixels with a largest
  difference of 64 to 87: the order and the compounding agree and only the edge antialiasing differs (Canvas 2D
  arcs against the shader's coverage).
- Audit (`tools/atlas-audit.py`, now with the field renderer asserted on every firms state, the same states
  again on the fallback (`?__nogl=1`), a lost and a restored context, the pulse forward, backward and in the
  cells view, and a narrower viewport): 349 states and 12,600 text boxes at 400, 768, 1,200, 1,600 and 2,000 px, zero findings, renderers seen `webgl2` and `2d` (`build/audit-atlas.txt`).
- Smoke (`atlas-gl-smoke.py`, kept in the session's scratch): WebGL 2 in use; the fallback start with
  `?__nogl=1` marks the same 23,819 pixels at the country view; a lost context draws through the fallback and
  a restored one through WebGL 2 again; a resize keeps the four canvases at one size; the theme toggle,
  the year, layer and mode switches and `#Moscow-firms` (the firms view at Moscow, WebGL 2) all draw.

Cadence (`profileFlight`, three moves per view on the share layer, frames over 25 ms counted; the pan at
Moscow is 60 km). Headless Brave's default renderer is SwiftShader, a CPU emulation of the GPU, which makes the
WebGL figures below pessimistic (it rasterises 700,000 point sprites in software); the second table uses the
machine's Intel Arc (Panther Lake) through Vulkan, closer to a laptop:

| view, move | ratio 1, before to after | ratio 2 | ratio 3 |
|---|---|---|---|
| cells, Russia to Moscow | 60 to 60 fps | 21 to 21 | 14 to 14 |
| cells, Moscow to Central | 61 to 61 | 44 to 42 | 23 to 23 |
| cells, 60 km pan at Moscow | 61 to 61 | 33 to 32 | 21 to 21 |
| firms, Russia to Moscow | 46 to 57 (worst frame 233 to 83 ms) | 15 to 23 (850 to 267) | 10 to 16 (1,133 to 317) |
| firms, Moscow to Central | 41 to 61 (83 to 17) | 19 to 46 (250 to 83) | 11 to 26 (383 to 100) |
| firms, 60 km pan at Moscow | 62 to 62 (133 to 17) | 25 to 37 (317 to 83) | 15 to 24 (483 to 100) |

On the GPU the cells view keeps the committed page's cadence at every ratio and the firms view gains most where
it was slowest: the disc range from 41 to 61 fps at ratio 1 and from 19 to 46 at ratio 2, the national field
from 46 to 57 and 15 to 23, with the worst frame of every firms move cut by two thirds or more (the first
frame of a national flight uploads the year's buffers once). Ratios 2 and 3 are slow in both views on both
pages here because headless Brave composites its large frames through a read-back; the ratios' relative
figures are what the table shows, not what a phone will do. The software (SwiftShader) figures, where the
GPU work of the field runs on the CPU and the firms view looks worse than it is, for the record:

| view, move | ratio 1, before to after (fps; worst frame ms) | ratio 2 | ratio 3 |
|---|---|---|---|
| cells, Russia to Moscow | 60 to 60 (33 to 33) | 24 to 25 (167 to 183) | 18 to 18 (233 to 217) |
| cells, Moscow to Central | 60 to 60 (17 to 17) | 51 to 51 (33 to 33) | 37 to 38 (50 to 50) |
| firms, Russia to Moscow | 47 to 33 (50 to 83) | 17 to 13 (133 to 167) | 11 to 8 (183 to 217) |
| firms, Moscow to Central | 40 to 60 (83 to 17) | 21 to 25 (117 to 50) | 13 to 15 (183 to 83) |

In software the cells view is the committed page's to the frame, the disc range gains as on the GPU, and the
national field loses (47 to 33 fps at ratio 1) because SwiftShader rasterises the 700,000 point sprites on the
CPU, which no device with a GPU does.

Review finding 2 (the map context's `willReadFrequently`, needed only by the blit's read-back) was applied
and then reverted on measurement: the flag also selects the canvas's raster path (CPU with it, GPU without),
and without it the cells view's flights ran two to three times slower at ratios 2 and 3 on the Intel GPU
(the 60 km pan at Moscow from 32 to 10 fps at ratio 2) with nothing else changed; with the flag the cells
view's cadence is the committed page's at every ratio, as the table shows. The author may try the other
setting on their devices (one word in `explorer-app.js`; the field does not need either).

Published as atlas v15 (version id 1792892885-2d7e) on 25 October 2026 after the author's confirmation, the sizing fix applied first and
the checks re-run on it (smoke; audit 349 states, 12,600 boxes, zero findings; the audit's map-size record now follows the canvases); the page, the script and `data/firms.js` (the corrected
manifest) uploaded, the twelve address scripts left as uploaded for v14 (M9 regenerated them with the same
content; only gzip's header timestamp differs). The author confirmed on 25 October that v15 loads and
moves well on their devices.


### Atlas and video: membership visible from the first frame, a pulse button, earlier re-centring (author's requests, 25 October 2026)

The rim. Before its listing year a firm on any of the five lists keeps its ordinary mark at the scale's radius
floor (atlas: the layer's colour for its own state; video: its class colour, the dark control colour #5A3175 for a
baseline firm without a statement, state 'd', and the backdrop neutral #B5C3D1 for a firm without a usable
baseline, state 'b'; every present member is now drawn, where the video drew only the class-coloured ones before)
and carries a thin rim in the listed red: 1.5 px wide, stroked outside the fill (from r to r + 1.5 px), at 0.8
opacity (`MM.rimmedMark` in `map-layers.js`, used by `drawMarks` in the atlas and `drawMarkSet` in the video).
At its listing year the mark blooms (the pulse of 24 October; the rim fades with the pre-listing disc) and
becomes red, solid with a statement and hollow without one, as before; hollow red keeps its one meaning.
Undated members (594 nationally, 200 in the Moscow set, all red from 2014) are never rimmed and never pulse;
resident-list-only firms keep their 2020 dating; the rewinds of the video are unchanged (a plain crossfade). The
rim never appears in the cells view and lives on the marks canvas, not in the WebGL field. The author chose the
outside rim over a rim centred on the fill's edge from a labelled comparison at two scales: at the 1.5 px floor
the outside rim leaves a 3 px core and is 6 px wide, the on-edge rim 4.5 px wide with a 1.5 px core.

Legend. Three rows with glyphs replace the two red rows in both pages: a rimmed dot "On one of the five lists,
before its listing year", a solid red dot "Listed, red from its listing year, statement available", a hollow red
dot "Listed, no statement that year", with "(treated)" after "lists" and "Listed" in the atlas only; the size
rule row stays. The atlas glyphs are round spans (`.sw.dot`; the earlier two were rounded squares); the video's
legend panel grows from 238 to 266 px (rows at y 985, 1013 and 1041, the canvas bottom at 1,080).

Ticker (video). Three lines: "N listed, shown red" (red), "M on a list, ringed" (muted, new) and "K without a
YEAR statement"; the shared info panel (`MM.infoPanel`, `MM.infoLines`) is 230 px tall with three lines at y 240,
266 and 292, each in its own audit group, and 210 px with two, so the explainer's zoom panel and the teaser are
unchanged (frames 300, 700 and 1,300 byte-identical to the baseline). The page-load check keeps red and dark
against `points.json` and adds the identity ringed = present − red for every extent and year, with present
counted in a separate loop (members present that year whose listing year lies ahead: downtown 2022 580 ringed
against 393 red; national 2022 2,422 against 1,694; 0 ringed in 2024 and 2025). The close is untouched.

Tooltip (atlas). Rimmed firms under the cursor read "N firm(s) on one of the five lists (treated) within X of the
cursor, listed in YYYY" (a range of years when they differ), or ", M before their listing year (YYYY)" appended
to the red line when both kinds share the spot; the hit radius r + 2 px already covers the rim.

The pulse button. A glyph button right of the year label (`#pulse`, a red ring and dot through a `--treated`
token; 28 px, 36 on coarse pointers), title and aria-label "Replay the bloom of the firms listed in YYYY",
disabled with "No firm on these lists was listed in YYYY" (2025 nationally), hidden with the year row and in the
cells view, keyboard focusable. It replays the bloom for the dated firms listed in the shown year and present in
it (732 in 2022, 21 in 2020), wherever the map is and at any time, including after a move back a year;
`window.__atlas.pulse()` presses it and returns the count. Under prefers-reduced-motion a pulse, manual or
automatic, is a still highlight (the ring at its largest radius, the mark at its size) held for the same 0.9 s
with no frame loop.

Earlier re-centring (atlas). `RECENTRE_FROM = 2`: on a zoom-out step whose new zoom lies in the band from
2 x kFit down to kFit the stepped centre is blended toward the country's centre by w = (2 kFit − k) / kFit (none
at the band's top, all at the floor); within one run of zoom-out steps inside the band an anchor holds the
un-pulled centre, so the pull is proportional and continuous, and the 300 ms settle at the floor stays. The pull
is one-way: a zoom-in step, a pan, a flight, a preset or a resize forgets the anchor, and nothing is remembered
on the way in: the wheel and the trackpad pinch zoom about the cursor, the touch pinch about the finger midpoint
(now an incremental step per move through the same `zoomStep`), the + button, the + key and a double-tap about
the view's centre, from the displayed camera as before. Checked: a wheel zoom-in from the floor anchored at
Moscow keeps Moscow under its pixel within 0.01 px and does not go into the country's centre.

Verification. Atlas audit 419 states, 15,377 boxes, zero findings at 400, 768, 1,200, 1,600 and 2,000 px on
both renderers (`build/audit-atlas.txt`); the new states: the button pressed at Moscow 2022 (732 marks), at
2025 (disabled, the title), after a move back (2020, 21), a rimmed hover, the same under reduced motion, the
band (n zoom-out steps to just above it with the centre still on Moscow, a wheel-sized step to 1.5 x kFit
landing halfway between Moscow and the country's centre, one more step exactly on the Russia preset) and the
zoom-in from the floor; the button's DOM box inside the year row, clear of the slider and the label, at least
24 px square; the earlier seven-step, zoomfit and Shift+click states still hold. Screenshots in both themes at
1,600 px and on the phone layout were sent to the author. Video: both probes pass the manifest and identity
checks; the text audit of the full cut has 1,435 frames, 29,702 boxes and the 17 counted box-over-mark lines
only, the teaser 460 frames and zero; seven review frames in `build/r9` (152.0, 155.1, 158.0, 190.0, 192.6,
195.0 and 203.0 s). Renders: the full cut 8,610 frames, 287.000 s (4 shards, 302 s; an 8-shard run crashed the
desktop app, and the shard fragments were deleted), the teaser 1,380 frames, 46.000 s; 720p copies of 21.9 MB
and 4.99 MB, the teaser's identical to the asset already on the explainer artifact, which was kept.

The chapter treats membership as fixed and uses no dates. This view is therefore the chapter's own view of the
group, with the dated turning-red added as a descriptive layer; the close's caveat (the sanctions-list dates,
the inferred share, the undated firms red throughout) is unchanged.

Published on 25 October 2026 after the author's confirmation: atlas v16 (version id 1792898590-9ef6) (the page, `js/explorer-app.js`,
`js/map-layers.js`) and explainer v20 (version id 1792898612-816b) (the page, `js/map-layers.js`, `js/treated-scenes.js`); the
teaser asset kept, the committed round c12d966. The author confirmed on 25 October that v16 and v20 load and
behave well on their devices. Round 8 published on 25 October 2026 after the author's three display fixes: atlas v17
(version id 1792908012-6e4e) (the page, `js/explorer-app.js`, `js/map-layers.js`, `data/treatednational.js`) and explainer v21
(version id 1792908009-6d9c) (the page, `js/map-layers.js`, `js/treated-scenes.js`, `data/treated.js`, `data/treatednational.js`,
the 27 Moscow rasters changed by the M6 re-run); the teaser asset kept; the cuts not re-rendered. The author approved the
fixes the same evening.

### Atlas and video: quieter resting red marks, a stronger pulse, a hover floor, names for listed firms (author's requests, 25 October 2026)

A. Resting red marks by zoom. The listed marks no longer share the address field's size rule: `MM.listedRule(rule, k, kRef)`
in `map-layers.js` derives their rule from it with a quiet weight q = clamp(log2(60 / k) / log2(120), 0, 1), 1 at k ≤ 0.5 px
per km (the national view) and 0 at k ≥ 60 (the street zoom): the floor × (1 − 0.35 q), the cap × (1 − 0.30 q), the pale
halo (1 − q) px wide (none at the national view), the resting opacity 1 − 0.2 q, the pre-listing rim 1.5 (1 − 0.33 q) px wide
at 0.8 (1 − 0.15 q) (the rim quieted with the same weight, the author's choice). At 1,600 px: the Russia preset q 1, radius
0.975 px, no halo, opacity 0.80; Moscow q 0.40, 1.29 px, halo 0.6 px, 0.92; Central Moscow q 0.07, 1.95 to 3.92 px, halo 0.93,
0.99; the street zoom as before. `MM.listedMark` keeps a hollow mark a ring at every zoom: the stroke w = clamp(0.45 rr, 1, 2.2)
and the outer radius rr + (1 − fill) · max(0, 0.75 + w − rr), so a hollow mark holds a land core of at least 0.75 px (at the
floor a 1.75 px ring beside 0.975 px solid dots; before, the stroke covered the core below 20 px per km and hollow equalled
solid there). The colour is untouched; the address field, its shader and the discs are untouched.

B. The pulse. 1.2 s (0.9 before): the mark swells by max(1.2 r, 2.5) px and back, two rings grow from the resting radius:
ring 1 in the listed red to r + 2 + Rmax(k) with an eased decay (width W (1 − 0.5 b), opacity (1 − b)²) and ring 2 trailing
at 0.7 of its radius in the pale outline colour (the red at half opacity on the light theme), Rmax = clamp(10 + 3 log2(k / kFit),
12, 30) (12 at the country, 28 at Moscow, 30 from Central Moscow) and W = clamp(3 − 0.25 log2(k / kFit), 1.5, 3) (3 at the
country, 1.5 from the city zoom); the cull margin 48 px; the projection inlined so no array is allocated per mark; the still
highlight under reduced motion holds both rings at their largest. In the video the same rule by extent (national k 0.168,
region 12, city 30, downtown 90) and the rings' decay on the section clock: `tStart(Y, ext)` from the run table `RUNS`
(the keyframes read the same table) and p = (l − tStart) / 0.6, so the rings outlast the 0.25 s year transition into the hold
(frame 5778, 0.1 s after the national 2022 transition, now shows the tail where it showed nothing). The flash and the mark's
opacity keep the bloom's own clock; rewinds draw no ring. Frame costs in the atlas (20 draws of the marks layer, software rendering at 1,600 px, mean ms): at rest the Russia preset 3.5 (3.2 before),
Moscow 1.0 (1.1), Central Moscow 1.8 (2.1); during a pulse of the 732 firms listed in 2022, Russia 8.8 (largest 16.6), Moscow 5.5,
Central Moscow 1.6: the two thick rings cost more than the one thin ring for the 1.2 s of a pulse and stay inside a 60 fps
frame on average; the resting cost, which is what every other frame pays, is unchanged.

C. Hover. A listed mark is hovered within max(r + 2, 6) px (`LISTED_HIT`) and wins over an address mark; the address under the
same cursor keeps its tooltip line and its panel row (`h.address`); the overlay ring stays on the drawn radius. Audit states
`redhov` (a red mark 4.5 px off the cursor at Moscow 2022: kind listed) and `rules` (q, Rmax, W and the cull margin at the
three presets); `btn0` waits 1.5 s for the longer automatic pulse.

D. Names for listed firms (the author's standing rule of 25 October 2026: firms on the five lists are named wherever
appropriate in the Claude Code materials; firms on no list are never named or given identifiers; the neighbour firm stays
anonymous). Sources: the decree workbook (118 names), the government strategic workbook (1,039), the sanctions file's `name`
(5,743 rows, lower-case) and its `name_alt` aliases; the residents and presidential strategic workbooks carry no names.
Over the list union of 6,372 INNs, 6,318 (99.2 %) have a name; the 54 without are on the two nameless lists only. Display
rule (`motion_display_names` in `motion-common.R`, probed by `R/tests/display-name-probe.R` over eleven filed strings):
look-alike Latin letters inside Cyrillic words folded; footnote markers, a trailing stop, a locality in parentheses and a
region after a comma dropped; ";"-joined entries keep the segment that starts with a legal form; the leading legal-form
phrase (Cyrillic and Latin tables, spelled out, abbreviated or transliterated, with an optional parenthesised abbreviation)
or a trailing abbreviation stripped and kept as a tag after a comma, transliterated for Russian forms (AO, PAO, OAO, ZAO, OOO,
FGUP, GUP, MUP, ANO, IP, NP) and English where the source string is English (LLC, JSC, PJSC, OJSC, CJSC, Ltd, Inc, GmbH);
quotes and guillemets trimmed with balanced inner pairs kept; "научно-исследовательский институт" and the like abbreviated;
then the Latin display: (1) the sanctions file's Latin alias that transliterates the filed Cyrillic core (both normalised to
letters and digits, the alias's legal-form words removed, the core transliterated with BGN/PCGN 1947 for Russian in its
plain form, accepted at a similarity of 0.85 or above by 1 − Levenshtein / length), the alias's own core title-cased; (2)
else our transliteration, title-cased, case 2; (3) a name filed in Latin, title-cased (a short all-caps name kept), case 3;
60 characters at most including the tag, cut at a word boundary with an ellipsis. The join: `M6-common.R` builds the union
(decree, then government, then sanctions by priority; the lab's INN cell rule), writes a temporary DuckDB table and both
treated queries `LEFT JOIN` it, so the identifier stays in R memory and the in-memory database; the two treated files gain
`name`, `name_filed` (the full filed string), `name_case` (0 unnamed, 1 alias, 2 transliterated, 3 Latin as filed),
`name_shared` (the list members sharing the display name) and a `names_summary`. Nine checks per file (one name per firm,
the join equal to an R match, no nine-digit run, no identifier as a name, no entrepreneur's personal name, unnamed at most
54, 60 characters, no control characters, the shared count). The save helper and `publish-set.py` now state a positive rule:
the name keys ship only on `treated.json` and `treatednational.json` (and the anchor's hand-typed `label_long`; `basemap.json`'s
`name` keys are the place names of regions and city windows from M1 and stay allowed), refused elsewhere; `publish-set.py` also checks the count, the digit run and the length. The two workbooks were pinned
(`motion.putin-decree-list`, `motion.strateg-government`); the re-pin found `motion.printed-names` changed on disk in
`programming/metadata/` since its pin (an uncommitted change there, not the lab's), and its pin was put back so the drift
surfaces on use. Run figures: the lab guard first refused both passes (SwapFree 1,022 MiB against the 1,024 MiB floor, the author's crash guard, not lowered), the author freed memory, and a first attempt to wait for a running capture hung on its own command line (`pgrep -f motion/tools/capture.py` matched the waiting shell; the rule is in the lab README's working notes), so the passes ran directly: M6 in 47 s at a peak of 11.6 GB (163 of 163 points checks, 9 of 9 name checks), M8 in 61 s at 12.9 GB (74 of 74 national checks, 9 of 9 name checks). The list union: 6,318 of 6,372 members named (decree 118, government 1,034, sanctions 5,166); cases alias 2,249, transliterated 2,694, Latin as filed 1,375; 1,930 members share a display name with another; the alias similarity over the 4,367 Cyrillic cores with a Latin alias: 2,149 at 0.90 or above, 100 between 0.85 and 0.90, 71 between 0.80 and 0.85, 2,047 below 0.80 (threshold 0.85, so the last two groups are transliterated by the lab). The national file: 4,753 of 4,803 named (99.0 %), 50 unnamed (members of the two nameless lists only); cases 1,879, 1,588 and 1,286; by source decree 113, government 993, sanctions 3,647; 729 firms share a display name (the largest group holds 478 list entries, branches under one parent's name); 401 names cut at 60 characters; similarity over 2,921 cores: 1,795, 84, 53 and 989. The Moscow file: 2,190 of 2,220 named (98.6 %), 30 unnamed; cases 892, 676 and 622; decree 19, government 314, sanctions 1,857; 302 shared; 200 cut; similarity over 1,396 cores: 852, 40, 24 and 480. A read-back of both files agreed with every figure (a count of names ending in the ellipsis, 168 and 88, misses the cut names that end in a tag; `capped` counts the ellipsis anywhere). The sha256 of M6's 78 other outputs: 44 unchanged (every region raster, the anchors, the alignment raster and the twins); `points.json` differs by one "-0" in the 2016 quantiles (a rounded negative zero, the same value); 32 rasters differ (every city and downtown backdrop, the city outcome layers 2021 to 2025, the downtown outcome layers 2021 to 2023) by 72 to 1,674 pixels of 2,073,600 (at most 0.08 %), the largest channel difference 2 of 255 on the backdrops and 1 of 255 on the one or two pixels of an outcome layer: the discs are drawn in DuckDB's output order, which varies between runs with six threads, and the 8-bit rounding at the edges of overlapping discs follows that order; the region rasters are per-pixel arrays and do not depend on it. Invisible at any zoom, but the 27 published rasters among them go up with explainer v21 so the artifact equals the lab's files; the renders of this round were captured before the pass, from the previous rasters, and are not re-rendered for it. The positive name rule refused the first publish set on `basemap.json`, whose region and window parts carry a `name` (place names from M1); both guards now allow that key there. Atlas: the tooltip's listed line drops its year parenthesis and is followed by one
line per listed firm at the hovered coordinate pair, each with its mark's glyph (● red with a statement, ○ red without one
that year, ◌ before its listing year), its display name (a shared name marked "one of k entries under this name") and its
listing year ("listed 2022", "listed 2022, no 2022 statement", "listed in 2024", "on a list, undated"), up to three then "and
k more on these lists"; the "Under the cursor" panel gets one row per such firm with the Latin name, "(transliterated)" for
case 2 and the full filed name beneath (the tooltip follows the cursor and cannot carry a title attribute, the author's
correction at approval); the legend note says "Hover a listed firm for its name." and the provenance names the sources and
the rule. Video: no change; the one place considered, labels on the ten largest listed piles of the downtown run, is not
recommended (an 11 px mark field and a text audit already carrying 17 counted lines).

Author's three display fixes after the report (25 October, evening). (1) The tooltip is the glance view and the panel the detail view: the firms-view tooltip keeps the region line, one figures line ("32 firms, 21 with a 2022 statement, 65.6%"; "1 firm, no 2022 statement" for a single firm), one listed line ("15 on the lists: 9 red, 3 hollow, 6 before listing", the hollow among the red; "1 on the lists: red", "hollow" or "before listing" for one firm) and the named lines in their short form ("Veb Lizing, OAO · 2015", the glyph before the name, "undated" for an undated member), then "and 12 more"; "(treated)", "within 663 m of the cursor", "Coordinate pair:", the shared-name marker and the repeated year words left the tooltip for the panel; the cells-view tooltips are unchanged. (2) The Under the cursor panel: the rows Region, Coordinate pair ("32 firms"), "2022 statement" ("21 (65.6%)") and "On the lists (treated)" ("15 within 663 m" or "1 at this pair"), then one block per named firm spanning both columns: the glyph and the display name in bold with "(transliterated)" for case 2 and the list memberships right-aligned in the muted ink ("sanctions", "decree", "resident", "government strategic", "presidential strategic"), the filed name beneath in the muted ink, "one of k entries under this name" when shared, and a tabular line with the listing year ("listed 2015", "undated listing") and the statement state ("2022 statement", "no 2022 statement"); then "and 12 more" and the Cell row. The memberships come from a new `lists` column on both treated files (the codes s, d, r, g, p in that order, read from the registry files' membership columns for the treated keys inside `M6-common.R`, so the firm-year tables keep their columns; two checks per file and, nationally, two more against the firms table's resident and other-list flags): nationally 3,625 firms on the sanctions list only, 487 on the sanctions and government strategic lists, 435 on the government strategic list only, 77 on the decree list only, 48 on the presidential strategic list only, 34 on both strategic lists, 32 on the sanctions and both strategic lists, 30 on the sanctions and decree lists. (3) The glyphs of the tooltip and the panel are the legend's own three dots drawn in CSS at 11 px (`.gl`: red; the land fill with a red border; the neutral fill with a red rim at 0.8), so the rimmed glyph can no longer be read as the hollow one; and a display name cut inside a quoted part drops the orphan opening quote (`motion_drop_orphan` in `motion-common.R`; a twelfth probe case, "Politicheskaya Partiya Kommunisticheskaya Partiya…"). Both passes re-run (M6 48 s at a peak of 11.6 GB, 163 of 163 and 11 of 11 checks; M8 63 s at 12.6 GB, 74 of 74 and 13 of 13); the names and their counts unchanged but for the orphan quotes (none left); the same 32 rasters changed again at rounding level (against the first run: the same files except the downtown outcome layers of 2021 and 2022, which matched this time), as the disc-order explanation predicts. The audit's `names` state now counts the glyph spans in the tooltip and the firm blocks in the panel.

Verification. Atlas audit (run before and after the three display fixes, the same figures both times) 449 states,
16,685 boxes and zero findings at 400, 768, 1,200, 1,600 and 2,000 px on both field
renderers (2d and webgl2) (the states of this round: `redhov`, `rules`, `names`, the longer `btn0` wait). Frame costs at 1,600 px (`frameCost(20)`, mean and largest of 20 frames in ms, the committed code then the
working tree): Russia at rest 3.3 and 5.7 then 3.7 and 6.0, during the 2022 pulse of 732 marks 4.2 and 5.7 then 4.8 and 6.0;
Moscow at rest 0.9 and 1.0 then 1.0 and 1.2, pulsing 1.4 and 2.0 then 1.2 and 1.5; Central Moscow at rest 1.6 and 3.9 then
1.6 and 2.9, pulsing 2.2 and 2.5 then 1.0 and 1.3: the second ring costs about half a millisecond at the national view and
nothing at the city zooms, where the halo and the hollow fills are now skipped. The hover (`hoverKm`) averages 0.6 ms, at
most 4.4 ms.
Video: both probes pass; the full cut's text audit has 1,435 frames, 29,702 boxes and the 17 counted box-over-mark lines
only (the rule counts mark centres, which the rims and the smaller radii do not move); the teaser 460 frames and zero.
Renders at 4 shards (an 8-shard run had crashed the desktop app): the full cut 8,610 frames, 287.000 s (316 s to render,
88.4 MB; the two rings add detail); the teaser 1,380 frames, 46.000 s. The teaser's frames 300, 700 and 1,300 are byte-
identical to the round-7 baseline: the teaser's beats (the hook, the years, the street zoom and the designation excerpt)
draw no listed mark, so A and B leave it unchanged, and its 720p copy and its asset stay as they were (4,991,065 bytes
again); the author had expected a change, and the test says there is none. 720p copies: the full cut 23.1 MB, the teaser
4.99 MB. The frames sent to the author before continuing: the atlas at the Russia, Moscow and Central Moscow presets in
2021 at rest and at the 2022 bloom mid-pulse (the committed code served from a copy beside the working tree), with 3x
crops, a light-theme pair and a ratio-2 pair; the video's frames 4651, 4653, 5771, 5774 and 5778 before and after.

Published: atlas v17 (version id 1792908012-6e4e) with the page, `explorer-app.js`, `map-layers.js` and `treatednational.js`;
explainer v21 (version id 1792908009-6d9c) with the page, `map-layers.js`, `treated-scenes.js`, `treated.js`, `treatednational.js` and
the 27 changed Moscow rasters; the teaser asset unchanged; the cuts not re-rendered (the author's decision: the raster
differences lie below the codec's quantisation).

### Round 9: the navy ground with two accents, the bloom's second pass, an industry layer, a cursor tile and crosshair, a context strip (author's request, 25 October 2026)

The request: seven items designed as one system on the round-8 base, atlas first and the video where the palette and the
pulse reach it, with no new per-frame computation beyond the hover's, every new element inside the audit's DOM checks and
every string under the wording rules; the neighbour firm stays anonymous. The author's four answers in planning: the
deflator direction is corrected in this round; agriculture joins extraction and energy and information joins professional
services, with a report on Other's revenue share by region; the cells' industry mix counts every located firm, listed
firms included; region facts use the registry's region label mapped to the basemap's names. Two defects found in planning
are fixed here: the deflator and the ring tails the video drew for firms red from 2014 at the start of every year run.

The deflator correction. `M6-common.R` rebased the WDI index to 2021 and then multiplied nominal revenue by it
(`line_2110 * d.defl`), where the programming project divides, so every real series of the lab ran backwards in time:
Aeroflot's 2014 revenue read 152,649 mn in 2021 rubles instead of 378,305 mn and 2024 read 994,791 mn instead of 510,928 mn.
The line now divides, the descriptions say so, and M6 (48 s, peak 10.5 GB), M7 (27 s, 9.7 GB) and M8 (62 s, 12.9 GB) re-ran
with every check passing; 79 of the 104 outputs changed (every data file of the three passes and 72 rasters; the 25
unchanged rasters are backdrops whose disc order happened to repeat). The revenue-change classes of M6, M8 and M9, the
Moscow cells and the comparison beat's index lines and facts changed; the cells view's own revenue layer, which comes from
the programming aggregates, was never affected. The lab decision log records the defect and the fix.

The palette (item 0). The stage is a near-black navy and the land a lit shape on it (the author's decision after the first
frames): stage #060B18 (OKLab L 0.152; the charcoal had 0.191), land #172A45 (L 0.284, 1.36:1 on the stage), panel #091023 (the
stage plus 0.026 in lightness, the rule of the first proposal), panel-2 and grid #0D162B, border #495669 (1.94:1 on the land,
2.54 on the panel), below #3C4852 (round 8's value: a cell class, not chrome), control the land, dim #7D889C (5.3:1 on the
panel, AA for the 12 px provenance and footer text), muted #9EABBD (8.4:1 on the stage, 6.2 on the land); the graticule is a
whiter, 1 px line (#2E333D, 1.55:1 on the stage and 1.14 over the land, 0.7 px and #1A1D22 before), structure that competes
with neither the land outline nor the data; ink, the ramps, the neutral, the blue classes, the density colour, the highlight
and the red unchanged (the red 4.15:1 on the stage, 3.05 on the land; the round-2 navy was rejected because the red falls to
2.9:1 there). Every data colour of every layer but the new one is round 8's, checked token by token against the committed
pages and manifests (the one drift found, `--below`, was reverted). The light theme is untouched. Two accents, never on data,
ramps or the red, neon at rest and brighter while something moves or has focus (the author's correction): `--cursor` #FF45C8
and `--cursor-live` #FF8FDF for the cursor layer (the crosshair at 2 px, the tile's 2 px border, the hover ring at 2.5 px
cased in the stage colour, the 2 px focus rings, the pulse button), `--context` #4DFF7F and `--context-live` #9AFFB8 for the
context layer (the strip's text, its 1.5 px rule and its glyph at 1.5 px, the tile footer's figures, the year row's live
marker while a pulse runs); light values #C60198 and #9E0079, #037E52 (the live green equals the resting one there: a darker
green loses its protan distance from the red). The validator, all pairs on the stage: the fuchsia 22 normal, 25 protan and
21 deutan from the red, the green 49, 48 and 28, the two 51, 41 and 24 from each other; the live pair 27, 33, 26 and 47, 50,
33 from the red and 33, 27, 16 from each other; contrasts on the stage, the land and the panel 6.5, 4.8 and 6.3 (fuchsia),
9.6, 7.1 and 9.2 (its live), 14.9, 11.0 and 14.4 (green), 16.3, 12.0 and 15.7 (its live). Recorded adjacencies, UI over
data: the fuchsia sits 5.5 (deutan) from the PRGn fall step and its live 3.7, the green 6.6 from the rise step and its live
7.9, and the fuchsia 12.9 normal and 5.3 deutan from the industry layer's finance pink #E78AC3 (the tile's border beside its
mix bar; the pink is paler and less saturated, and the legend and the tile name the class). The ramps re-validated on the stage: YlGnBu monotone with a 5.49:1 dark end (the one-hue check fails by design as in
round 2), the PRGn halves 4.92 and 7.17, the blue six 6.14; the categorical set red, purple control, dark control, neutral:
CVD worst 10.7 protan, the two controls at 13.8 normal as round 2 accepted, the purple at 1.99:1 on the stage (drawn on a few
pre-listing marks over the land, where it was 1.47 before). `readTheme` reads the scheme from a `--scheme` token; the
explainer's theme object carries `dark`. The palette frames went to the author twice, on the first navy and on the near-black
stage.

The bloom, second pass (item 1), shared in `map-layers.js`. Each pulsing firm runs its own clock from a start delayed by the
stagger: a flash to r + min(14, max(2.5r, 4)) px over 0.10 s with a pale core (#FFD9D9) fading to the mark's own colour
through an 8-step table over 0.35 s (to the red for a solid mark, to the land for a hollow one), a pale glow disc of twice
the flash radius at alpha 0.18 fading over 0.7 s (source-over; an additive composite would differ between the atlas's
transparent canvas and the video's opaque stage), ring 1 in the red from r + 2 to r + 2 + Rmax over 1.5 s with width W(1 −
0.4p) and alpha 0.95(1 − p)², ring 2 trailing at 0.7 of it in the pale; Rmax = clamp(44 + 2·log2(k/kRef), 44, 64) px and W =
clamp(3.5 − 0.2·log2(k/kRef), 2.2, 3.5), so the rings reach 47 px at the country, 60 at Moscow, 67 at Central Moscow and 72 at
the street zoom; the stagger runs west to east over 60 + 140q ms (200 ms at the country, 116 at Moscow, 60 at the street)
from one Float32Array filled when a pulse starts; the atlas pulse lasts 1.8 s (1.6 s decay plus the stagger), `MARK_MARGIN`
is 80 px, `pulseAt(ms)` freezes an exact frame; the reduced-motion highlight holds the mark at 0.6 of the flash with the
core at step 3 and ring 1 at 0.6 Rmax. The resting marks of round 8 are untouched. Video: the same language on the section
clock with the flash over the year transition, the rings' decay fitted inside each hold (downtown 0.85 s with a 0.06 s
spread, city 0.60 and 0.08, region and national 0.55 and 0.10; the national and region decay shortens from 0.6 to make room
for the stagger, the year timing is unchanged), rings only for firms listed from 2015 on and dated (the 2014 and undated
members never bloom: the ring tails seen in frame 4408 are gone), the audit's mark record at the resting radius so the
counted label-over-mark lines do not grow. Frame costs at 1,600 px (mean and largest of 20 frames, ms; the committed code
then this round at 300 ms, the costliest phase, and at 900 ms): Russia at rest 3.5 and 5.8, 3.6 and 6.1, 3.4 and 3.8; the
2022 pulse of 732 marks 4.6 and 5.5, 5.4 and 7.4, 4.6 and 6.1; Moscow at rest 1.3 and 3.1, 1.1 and 2.5, 1.0 and 1.1, pulsing
1.4 and 2.1, 1.5 and 2.1, 1.2 and 1.6; Central Moscow at rest 1.6 and 3.0, 1.7 and 3.6, 1.7 and 2.0, pulsing 0.9 and 1.1, 1.7
and 2.0, 1.4 and 1.5: inside the 16 ms budget with room. The `rules` audit state checks Rmax within 44 to 64, W within 2.2 to
3.5, the spread within 60 to 200 ms, the decay 1,600 and the pulse 1,800 ms, and that the flash, the glow and the rings stay
inside the cull margin; `btn0` waits 2.0 s. The before and after frames (the committed code served beside the working tree,
25, 50 and 75 percent of each version's pulse at the three presets; the video's frames 4650, 4654, 4662, 4672, 5771, 5774,
5778, 5783 and 5788) went to the author; where hundreds of 2022 listings share a few pixels (Moscow at the national zoom)
the rings saturate into one red disc for about half a second, offered to the author with a crowd factor as the knob.

The industry layer (item 2). Classes: 1 Agriculture, extraction and energy (divisions 01 to 03, 05 to 09, 35); 2
Manufacturing (10 to 33); 3 Construction (41 to 43); 4 Trade (45 to 47); 5 Transport and logistics (49 to 53); 6 Finance
and real estate (64 to 66, 68); 7 Professional services (58 to 63, 69 to 75, 77 to 82); 8 Public and social (84 to 88); 9
Other (36 to 39, 55, 56, 90 to 99 and firms without a division code). The byte: 1 to 99 the division, 0 no OKVED 2 division
code (class Other; `__MISSING__` and the legacy codes 00, 34, 40 and 57 are not reinterpreted), 255 no firm with a
statement and a positive revenue value (unknown, neutral). Names: Eurostat's NACE Rev. 2 codelist NACE_R2 version 20.1,
downloaded on 2026-10-25T07:28:31Z into `data/external/nace-rev2/` (the TSV, 78,151 bytes, sha256 5553f59f…8eff7, and the
SDMX-ML, 1,228,412 bytes, sha256 b3da1c91…0871, with a README) and pinned with the programming project's OKVED 2 crosswalk
and its sources record; `industry-common.R` checks that the 88 division codes of the two coincide and records the
equivalence (OKVED 2, OK 029-2014, mirrors NACE Rev. 2 through four digits; titles are translations that differ in
emphasis; departures lie below the two-digit level). M9 v3 (`firms-YYYY.bin.gz` version 3, 33 bytes per record: after the counts a revenue code `rv` (a u16 log code of the summed
revenue, in thousands of rubles, of every firm with a statement and a positive revenue value at the address, listed firms
included: 10^((rv - 1) / 100), 0 without revenue), the class, then eight (`ind`, `ish`) pairs, the divisions with revenue at
the address by share descending with their integer shares, 255 and 0 beyond the present ones; the first pair is version 2's
leader; the author's correction of 25 October replaced the single leader of version 2 and widened the address population
of the mix to every firm at the pair, since the listed firms' shares are measured against the same revenue; 201 s, peak 12.9 GB, 311 checks: 2021 holds
435,240 addresses with a revenue value of 692,057, 419,979 of them with eight or fewer divisions and so fully listed (96.5
percent; the most at one address is 70), 2014 389,843 of 727,116 and 2025 425,619 of 691,594; the files are 6.3 to 6.6 MB
gzipped (75.9 MB in all) and the twins about 8.4 MB each, under the 15 and 16 MB caps). M11 (`industry.json`, 4.3 MB with its twin, `industry-city.json`, 4.5 MB, loaded by the atlas only when the industry layer
reaches a city window, and `regions.json`, 80 kB; 35 s, peak 1.3 GB; 276, 72 and 15 checks): per 100 km, 25 km and 1 km city
cell and year the leading division, its share, the listed share of the cell's revenue (the 100 and 25 km grids), a revenue
code `rv` like the addresses' and the ranked mix of up to eight divisions with their shares (the author's correction of 25
October: eight rows everywhere; version 1 carried five, three and one) (94,335 25 km cell-years, 125,484 1 km cell-years in
132 city windows), every located eligible firm counted;
the 2021 diagnostic of cells whose leader changes without listed firms or without other geocodes is in the manifest; the
(region, division) located counts equal the pinned regional table for all its rows. Regions: `config/regions-crosswalk.csv`
maps the registry's 90 labels to the basemap's 83 names (seven labels outside the outline); the geometric validation by
ray casting 200 located 2021 firms per label against the named polygon: the lowest inside share Chechnya 0.925, then
Primorsky Krai 0.940 and Chukotka 0.945; 6.0 percent of the outside labels' samples fall inside a polygon (firms
registered in the territories but geocoded inside the outline; the check allows 10). Other's revenue share by region in
2021, the author's report: above 15 percent in Ingushetia (66 percent, division 38 waste collection, treatment and
disposal, 65) and Rostov Oblast (30 percent, division 38, 27); the proposed home is to move section E (divisions 36 to
39, water, sewerage and waste) into class 1 under the name "Agriculture, energy and utilities", the author's call. Colours
(ColorBrewer hues, searched for the largest smallest distance on the land with the red, the two accents and the neutral):
#7FC97F, #FF7F00, #FFFF33, #1B9E77, #FDBF6F, #E78AC3, #1F78B4, #CCEBC5, #999999 in class order; every class at 3:1 or more
on the land (Professional services 3.03); no selection of nine clears the validator's 15 floor with the neutral and the
accents, the closest pairs being Transport and Public 12.9, Finance and the cursor accent 12.9, Trade and Other 13.6,
Manufacturing and Transport 14.2, and under deutan vision Agriculture and Transport 3.0, Trade and Other 4.8, Finance and
Other 6.2; the hover and the legend therefore name the class and the division (the author's rule). The light theme's nine
(#1B9E77, #4E342E, #00838F, #0277BD, #7570B3, #984EA3, #3949AB, #7B1FA2, #616161) come from the same search over darker
hues; the warm family is too close to the red under deutan vision there. The atlas: a seventh layer "Leading industry by
year" in both views (100 km, 25 km and the 1 km window tiles; the address field through a third class byte per vertex and
a 16-slot palette, the 2D fallback through the same tables); the tooltip's lines ("100 km cell, 2021: 277,027 firms with a
revenue value", "Largest share of revenue: Wholesale trade, except of motor vehicles and motorcycles (division 46), 34%",
"Firms on these lists (treated) hold 13% of this cell's revenue"; at an address "… (division 10), 42% of revenue at this
coordinate pair"); the Under the cursor rows Leading division, Share of revenue, Class, the ranked mix, On the lists
(treated), With a revenue value; the legend's nine class swatches with their names and the division list per class in the
provenance. The revenue mix box (the author's correction of 25 October, which moved the breakdown out of the legend): a
translucent box at the top left of the map on the industry layer, live with the cursor: the revenue mix of the 100 km, 25 km
or 1 km cell under it in the cells view or of the coordinate pair in the firms view, one row per division present by share
descending, each with its class colour (fixed per division, never by rank), the division's short name with its code (the
full NACE title on the row's title attribute) and its share of that unit's revenue, at most eight rows then "other divisions
N%"; with the cursor off the map, the mix of the view: the eight largest divisions by their share of the summed revenue of
the cells or coordinate pairs in view, from each unit's own rows weighted by its revenue code (the divisions beyond a unit's
eight join "other divisions"), computed once per camera settle, year, layer or view change (`__atlas.mixCost()`), never per
frame; the box's row area keeps a fixed height so its box never changes under the cursor; collapsible ("Collapse the revenue
mix" / "Expand the revenue mix", remembered per viewer as `atlas-mix`), open by default where the map is at least 600 px wide
and 640 px tall and otherwise taking turns with the legend (opening one closes the other, as the legend and the note do
on narrow maps), placed below the note when the two would meet, an obstacle for the tile and a panel in the audit's DOM checks (inside the map, clear
of every other panel, never under the tile).

The cursor tile (item 3). The tooltip element keeps its id and becomes the tile: the glance lines of round 8 with the
figures in a monospace stack (the ranked mix the first draft put here as a bar moved to the mix box on the author's
correction), and a footer with the cursor's coordinate from the inverse of the basemap's projection ("55.75 N, 37.61
E") and the scale as metres per CSS pixel ("1 px = 110 m"; a round length is already on the scale bar). The border is 2 px in the
cursor colour, the live variant while the cursor moves. Placement: eight anchors around the cursor, each keeping d = max(14,
r + 9) px of clearance on one axis (24 on a tap) so the tile never covers the hovered mark; the first inside the map and
clear of the legend, note, mix box, zoom box, scale bar and strip wins; a second pass slides the anchors along their free
axis, away from what they meet and then the other way; a third searches a 16 px grid for the nearest place inside the map,
clear of every panel and d px from the cursor on both axes; when none exists (a phone or a portrait tablet with the panels
open) the tiers repeat without the note, then without the legend, then without both, and the tile may cover those two,
never the controls, the scale bar, the strip or the mix box (the audit allows exactly those two overlaps when the page
reports the tier, and counts them); the clamped placement of round 8 is the last resort. A showing tile is re-placed
whenever the legend or the note is rewritten (their boxes change with the text). On maps under 600 px the tile is compact:
64 percent of the map's width at 12 px, the short division label, one named firm then "and k more" (the panel below lists
three); a 400 px map with the panels open still has no clear place for the full tile. On a tap the tile appears
above the finger and stays. The footer's figures count to new values over 200 ms only when the camera moves under a still
cursor. Each listed firm's line carries, in parentheses, the firm's share of the revenue of every firm at its coordinate
pair from its most recent statement with a revenue value up to the slider's year, "(12% of revenue here)", with the year
named when it is not the slider's, "(12% of 2021 revenue here)" (the author's correction of 25 October; shares under 10
percent to one decimal, under 0.1 as "<0.1%"); the Under the cursor panel adds that statement's revenue, "revenue 2022:
12,345 mn rubles". The data: M8 and M6 join, per listed firm and year inside DuckDB, the filed revenue (`rev_m`, millions of
nominal rubles, float32, NaN without a statement or a positive value) and the firm's share of the summed revenue of every
firm with a statement and a positive revenue value registered at the same coordinate pair that year (`psh`, tenths of a
percent, int16, -1 without a value or with a city-level geocode: the denominator M9 sums per address, listed firms
included), 12 per firm, base64, to `treatednational.json` (4,803 firms: 24,996 firm-years with a value over 3,952 firms,
23,323 with a pair share; 1.49 MB with its twin, from 1.01) and `treated.json` (the Moscow rectangle: 11,474 firm-years
over 1,810 firms, 10,724 shares); five checks each (12 values per firm, shares within 0 to 1000, a share exactly where a
value and a non-city geocode exist, a firm alone with revenue at its pair holds all of it, a value only where the filing
string shows a statement); the identifier never leaves the database; the save helper and `publish-set.py` see two numeric
columns and nothing named. Unlisted firms stay as they are. The M6 re-run changed 30 Moscow rasters at rounding level
(the disc order), as round 8's did. A 1 px crosshair across the map at the cursor in the cursor colour, full while moving and muted after 200 ms
without a move (one timeout, no loop), eases toward the cursor over 120 ms (item 5: chosen over a stroke around the tile,
whose content changes on nearly every move in a dense field; a snap under reduced motion). The hover's cost: the inverse
projection, five rectangle reads under the one layout the tile already forced, at most sixteen placement tests, two lines on
the overlay.

The context strip (item 4). A 26 px bar along the bottom of the map over the canvases, the legend, zoom box and scale bar
lifted by its height while it is open (`--lift`), collapsible to its toggle at the right (remembered per viewer), the text,
its 1.5 px rule and its glyph in the context colour (the neon at rest; the live variant while the figures tick, the text
crossfades or the glyph strokes on) with the figures tabular. Facts by band and layer, from the loaded data: the country (k under
three times the fitted zoom), the city window (the camera centre inside the nearest city's 90 km square with a 1 km grid
for the year) or the registry region under the camera centre (`regionAt` once per settled draw). The strings: "Russia,
2021: 3,277,638 located firms, 55.0% with a statement, +1.2 points against 2021" (the share layer and every layer without
its own aggregate; the change clause drops for 2021), "Moscow Oblast, 2024: N firms registered in the region, P% with a
statement, +d points against 2021" (from `regions.json`, which counts firms by their registry region), "Moscow window,
2022: 732,362 located firms in the 1 km cells, 59.8% with a statement, +2.1 points against 2021" (the 1 km cells' sums for
2019 to 2024), "Russia: P% with a statement in 2021, P% in 2024, +d points" (the change layer), "N firms registered in the
region on the five lists (treated) of M" (the lists layer), "Moscow Oblast, 2021: Wholesale trade (division 46) leads with
32% of revenue" (the industry layer; in the city band too, from the registry region under the camera centre, since no
window-level industry aggregate exists: the 1 km cells carry each cell's leader, not the window's), and in the Firms view "Russia, 2021: 3,078,593 firms on no list (comparison group) at 692,057 coordinate
pairs; 4,034 on the lists (treated)". Six tips, each once per session, shown only while the strip is open, nothing moves, the
cursor is still and 12 s have passed since the last fact change, for 8 s: the click ladder (a touch variant on coarse
pointers), Shift+click, the pulse button, the Firms view, the preset links, the keyboard. The region glyph: the region's
largest ring and any ring with a quarter of its area, Douglas-Peucker to about 60 points, fitted into 22 by 22 and cached on
first use; Russia's outline traced once from the filled parts on an offscreen canvas at 0.03 px per km; stroked on over 0.4 s
in the live context colour when the region changes, still otherwise. Text changes crossfade over 0.3 s and, when the two
facts share a template, the figures count to their new values in that time. Nothing external, no fetch. The API gains
`hoverPx`, `tapAt`, `tile`, `strip`, `context`, `tip`, `glyph`, `jump`, `still`, `overlayCost` and `contextCost`; the audit
holds the tile clear of every panel and the strip inside the map with its toggle and glyph, the legend and zoom box lifted,
the collapsed stub clear, and runs the band states (the country, a point 60 km east of Moscow at k 1 as Moscow Oblast, the
Moscow preset as the city), a forced tip, the strip closed and by default, the tile at the map's corners and centre in both
views and a tap.

Verification. The atlas audit (`tools/atlas-audit.py`, now with the industry, tile, strip and mix-box rules and states):
649 states and 24,007 text boxes at 400, 768, 1,200, 1,600 and 2,000 px on both renderers with zero findings; the states
apply their layer and year before their setup as well as after it (the context and industry states had read the previous
state's); the corner-tile states use the map's own size; three tiles were placed over the note or the legend for want of a
clear place (the phone-width map and the 768 px map with the panels open), the count the audit now prints. Screenshots in both themes at 1,600 px and the phone layout at 390 × 844 went to the author. Costs
(`frameCost(20)`, `hoverCost(30)`, `overlayCost(30)`, `contextCost(30)` and `mixCost(10)` at 1,600 px, software rendering, the
firms view on the share layer for the frame costs): frames at rest 3.5 ms at Russia, 1.4 at Moscow, 1.6 at Central Moscow,
and 900 ms into the 2022 pulse 3.2, 1.2 and 1.4 (maxima 4.0, 1.4 and 1.6; the acceptance was a mean under 10 and a maximum
under 16 at Russia; the first pass of this round measured 5.4 at 300 ms, the costliest phase); the hover 0.4 to 0.7 ms mean
on every view (1.1 at the street zoom, where the first call pays for the tile's layout), the crosshair's overlay under 0.01,
the strip under 0.2; the view mix 0.2 ms over the 100 km cells, 0.7 to 1.6 over the coordinate pairs of a city window and
10.5 ms over the 692,057 coordinate pairs of the country, paid once per settle, year or layer change and never per frame. Video: both cuts re-rendered at 4 shards on the
corrected data and the new palette (`who-stays-visible-full-287s.mp4`, 8,610 frames in 318 s, 102.4 MB; `-teaser-46s.mp4`,
1,380 frames in 44 s, 20.2 MB), ffprobe confirming 287.0 and 46.0 s at 1920 by 1080; the 720p copies 27.1 and 5.3 MB (the
teaser's under the 15 MB asset cap); both probes clean after the M6 and M8 re-runs; the text audits: the full cut 1,435 frames at step 6, 29,702 boxes, 18
findings, all of them the counted live-box coverage of red marks in the Moscow field (17 in round 8; the corrected revenue
classes move a few marks under the box), zero label-over-mark; the teaser 460 frames at step 3, 6,659 boxes, zero (at step
6 the audit's cut-in rule fires on the teaser's own 0.3 s fades at its cuts, so the recorded step of 3 stands); the 2014
ring check on frames 4,404 to 4,412 shows rims only, no rings. The teaser identity test against round 8's frames 300, 700 and 1,300 (`build/r10-teaser-after`): all three differ (92.7, 99.3 and 100 percent of the pixels), as expected, since the stage colour reaches every frame; the new teaser is kept and its asset replaced at publishing. Publish set: `publish-set.py` rebuilt it on the final code, 163.7 MB: the two pages, six scripts, 17 data files (19.6 MB, with
`industry.js`, `industry-city.js`, `regions.js` and the heavier `treatednational.js`), the 49 Moscow rasters the journey
loads (41.2 MB), the 24 national rasters (1.3 MB) and the twelve address twins (101.2 MB); the guards (identifier keys,
firm-name keys outside the two listed-firm files, a named neighbour, the size caps) pass. The atlas goes up in three
uploads (the pages, scripts and data; the twins in two halves), the explainer in two (the pages, scripts and data; the
rasters). Published on the author's word (25 October 2026): the atlas in three uploads, versions 18 to 20 (the last version id
1792920994-0928: the page, the four scripts, the ten data files with `industry.js`, `industry-city.js` and `regions.js`,
then the twelve address twins in two halves); the explainer in two, versions 22 and 23 (version id 1792921063-21c7: the
page, the five scripts, the twelve data files, then the 73 rasters), with the new teaser asset
`/_blob/bc8d172861eeffb686718f551c873b0f` replacing the old one, which was deleted. The Codex brief
`candidates/2026-10-25-chapter2-named-illustrations-codex-brief.md` proposes an Aeroflot paragraph and an Appendix B table
of the largest listed firms, with the sources, the display rule to port and the checks, and names what it does not propose.

### Round 10 (25 October 2026): one monospace typeface, capitals, legend bars (step 1 of five; the round continues below as its steps land)

The author's request of 25 October, in three messages and a widening, is planned in full in the session's plan file (the lab holds no copy; the record here grows step by step). The steps, in the author's adjusted order: 1 the typeface, the re-fit, capitals and the legend bars (this section); 2 dark on every device and the landing view; 3 the cyan ramp, the industry nine, the diverging pair, the chrome; 4 the graticule, the Firms ladder, the minimap, the region tint and glow, the ghost names and hairline borders; 5 the full verification, the records and the report. The working tree is committed at the end of steps 1, 3 and 4 as "Round 10 in progress" commits with nothing published; the final commit and the publishing wait for the author's word; during steps 1 to 4 only the checks each step needs run (the validator for a colour step, the text audit on the touched scenes, the frame cost at the touched preset, a page probe after each page edit).

**The typeface (T1).** One family on both pages: IBM Plex Mono (SIL Open Font License 1.1), Google's own build from the google/fonts repository at commit 01d5d9f05246fb7090a8403b81257535cb1a088b, the Regular, Medium and Bold faces and the licence, fetched with curl into `data/external/fonts/ibm-plex-mono/` (sizes, times and sha256 in `data/external/fonts/README.md`) and pinned as `motion.font-plex-mono-400`, `-500`, `-700` and `motion.font-plex-mono-licence` (`scripts/pin-sources.py --only motion`, 188 entries; the deliberate `motion.printed-names` drift restored afterwards to its recorded object). Installed on the author's instruction, an exception to the lab's read-only rule, in `~/.local/share/fonts/ibm-plex-mono/` (`fc-cache -f`; fontconfig resolves the family's weights 80, 100 and 200 to the Regular, Medium and Bold files; the installed copies' sha256 equal the pins), so the headless browser on the host draws the same files the published pages fetch from Google Fonts (`publish-set.py` injects a preconnect to fonts.gstatic.com and the stylesheet `css2?family=IBM+Plex+Mono:wght@400;500;700&display=swap`; Arimo is gone). The stack `"IBM Plex Mono", "DejaVu Sans Mono", "Liberation Mono", Menlo, Consolas, monospace` lives in the `--font` token of both pages; `Motion.family` reads it and `Motion.font(px, weight, family)` builds every canvas font string from it; the tile's figures use the same token. Weights: 400 prose, 500 labels and figures (every former 600 on canvas and in the DOM), 700 headings, years and counters. Both pages wait for the three weights (`document.fonts.load` at 13 px on the atlas beside `fonts.ready`; the explainer's `__ready` loads 400, 500 and 700 at 28 px and then calls `TreatedScenes.remeasure()`, which recomputes the anchor labels' offsets with the font in force). Glyphs outside Plex Mono (the two triangles of the toggles, the non-breaking hyphen, Greek) fall to DejaVu Sans Mono. Tabular figures throughout (`font-variant-numeric: tabular-nums` on both bodies; a monospace is tabular by construction, the declaration covers any fallback face).

**The re-fit (T1).** A monospace advances 0.6 em per glyph, about a quarter wider than the sans, so every measured string was re-fitted by size, wrap or panel width inside the floors (22 px in the video, 11 px on the atlas canvases); no word was cut. Two shared helpers: `Motion.revealParagraph` (a wrapped paragraph with the reveal's alpha and rise, one audit group per block) and `Motion.measure` with an optional letter spacing; `MM.legendBar` takes a one- or two-line title, `MM.infoPanel` a width. Video, by scene: the archive's records line 28 px; "Share up, statements down" 28 px; the years scene's lines as 24 px paragraphs with the legend bar at 780 under a two-line title and the swatches at 860; the change scene's "2024 against 2021" 44 px; the zoom scene's info panel 520 px wide and its share legend with a two-line title; the lists title 46 px, the chart box 620 px wide, the table at x 1,130 with its value columns at 1,650 and 1,860 (the first placement at 1,770 and 1,860 overlapped the heads, which the audit caught); "Four fixed 2021 cohorts" 32 px, the cohort legend's two-line title, "Real revenue, 2024 vs 2021" 28 px, the "Chapter 3 asks" paragraph at 24 px wrapped at 500 px from y 870; the credits rebuilt as centred reveal paragraphs (the title at 400, the data line at 490, the boundaries line at 572 in 22 px, the caveat at 624); the treated scenes' location name in tracked capitals at 24/500 with the size line at 22/400, the Moscow legend panel 900 px wide, the live box's small panel 540 by 290 at (1,320, 340) with its two boxes 150 by 170 at x 1,376 and 1,650 and the right chart's head shortened to "listed in 2022" (at 1,603 with the full head the two chart heads, drawn 40 px left of their boxes, stood 16 px apart and read as one line; the full wording stays in the comparison panels' key lines), the fact-line panel 1,240 px wide, the comparison beat's key, gap and members lines as wrapped reveals at the full-screen column width (so the lines never re-break while the box moves; the first wrap at the moving box's width made lines appear and vanish within one audit step), the close panel 740 px tall, and the anchor labels kept out of the live box's panel (`LIVE_CLEAR`, the panel plus a 20 px margin, in `computeOffsets`). Atlas: the groups chart's margins measured from the labels, the cell caption at x 8 and the note as a wrapped 13 px paragraph, the tile 320 px wide, the mix box 340 px, the listed-firm state column 124 px, the body 14 px, the strip at phone width in two lines (`.ctx.narrow` 44 px tall with `--lift` 44) with the clipped test also reading the height.

**Capitals (T4, widened by the author on 25 October).** Proper names first: the page title (VISIBILITY ATLAS, the document title unchanged), the video's scene titles, the hook and the credits title (drawn upper-case at 700 without tracking), the place names on the map (`cityLabel`), in the video's location line and in the atlas's tile, panel and strip (`.loc`: Plex Mono 500, 8 percent tracking, 11.5 px in the tile and 12 px in the panel; the strip's facts wrap the place name only, the fact clause stays mixed case in 400). Then, the author's widening: every interface label of the atlas in Plex Mono 500 capitals tracked 8 percent like the card headers: the theme button (LIGHT THEME / DARK THEME), the year label and the slider's value, the view label and the view and layer buttons (the change layer's label reads "Change, 2024 against 2021" now, the "vs" gone), the preset buttons, the zoom and fit buttons' title attributes (ZOOM IN (+), ZOOM OUT (−), FIT THE WHOLE COUNTRY (0)), the legend's title and its swatch rows, the Under the cursor panel's row labels (12 px), the strip's tips, the mix box's title, the collapsed note's label; the minimap's labels when they come in step 4; the explainer page's control buttons (the cut, play and chapter buttons, hidden in renders) read as interface labels and follow. Mixed case stays only for running prose (the provenance and footer, the citation line, the note, the legend's sentence lines "Colour: …", "A single firm shows …" and "Each dot is one coordinate pair …", the tile's sentence lines, the pulse button's title sentence, the chart series labels on canvas, the aria-labels), firm names and legal-form tags, and unit symbols: a unit keeps its case inside a tracked label through a `.u` span (the preset suffix "(250 m)", the legend titles' grid phrases "(100 km cells)", the tips' "20 km", joined to its number with a non-breaking space by `units()`), and the lists legend's title reads "Sanctions-list members (treated), 2021 (100 km cells)" so its grid phrase sits in the same parenthesis as the other layers'. Wrapped legend rows hang under their text, not under the swatch (a 20 px hanging indent on the swatch rows).

**The strip's tips.** Tracked capitals run 13 percent wider than the mixed case (8.84 px per glyph at 13 px against 7.8), so the six round-9 tips became eight, each at most 72 characters: the click ladder split into "A click on a cell flies to it: the city window from the country." (with its touch form) and "From a city, a click flies to the 20 km scale, then steps of 2.5."; Shift+click; "The pulse button by the year replays the bloom of its listed firms." (71 characters); the Firms view's rule split into "The Firms view draws every registered address by year." and "Firms on the five lists (treated) turn red from their listing year."; the preset links with "#Moscow" alone; the keyboard tip as "With the map focused, + and − zoom, 0 fits the country, the arrows pan.". The strip's text slot measures 656 px at 768 px (75 glyphs), 676 at 1,200 and 1,076 at 1,600, and two lines of 288 px at 11.5 px on a 400 px phone (36 glyphs a line); `__atlas.tips()` measures all nine strings in the strip's hidden span as they would show and the audit asserts none is clipped at any width. A defect found on the way: the strip's text span grew with its content, so the two-line phone form's clipped test (`scrollHeight` against `clientHeight`, added in this round) could never fire and a third line would have shown past the strip's bottom (the strip's overflow is visible); the span now fills its slot (`bottom: 0`), and a 180-character string registers as clipped (469 by 48 px against a 288 by 32 px slot).

**Legend bars and flat colour (T3).** Every ramp swatch on both pages is a stack of horizontal bars with hairline gaps: on the atlas a `.sw.bars` span with a hard-stop stripe background (`repeating-linear-gradient(to bottom, var(--c) 0 2px, transparent 2px 3px)`: five 2 px bars with 1 px gaps in the 14 px swatch; a stripe pattern, not a tonal gradient) on the share, fin, density, change, cohort and lists rows, the categorical, neutral and below swatches and the mix box's swatches plain; in the video `MM.barSwatch` draws `min(8, floor((h + 1) / 3))` bars of equal height with 1 px gaps, used by `legendBar` (height 23, eight bars) and `legendSwatches`; the treated legend's discs are unchanged. Flat colour: the grep for shadow, gradient, filter, blur and backdrop finds no effect on either page; what stays and is named as translucency, not tone: the atlas panels at 92 percent of the panel colour, the scale bar at 85, the video's panels at 0.92 and the close panel at 0.6; the only glow is the pulse; the two accents stay exactly where round 9 put them.

**Audit additions.** The atlas audit (`tools/atlas-audit.py`) gains, per width, a platform-font check (`CSS.getPlatformFontsForNode` on `header h1` and `#theme` must name IBM Plex Mono, the only proof that the headless browser resolved the installed face) and a `caps` state at the Moscow preset with a hover and a tip showing: the computed style of fifteen selectors (the title at 700 untracked; the card headers, theme button, year label and value, view label and buttons, layer and preset buttons, legend title and swatch rows, mix title, panel row labels, the tip span and the `.loc` spans at 500, upper-case, letter-spaced 0.08 of their size, in the Plex family), the `.u` spans untransformed, the three zoom titles, and `tips()` with no clipped string; every state's DOM audit also reads an `overflow` list from `domBoxes()` (a label that runs past its card, panel or strip, or overflows its own box, among the buttons, labels, legend rows and the mix title) and reports `text-overflow`; the context checks require a `.loc` span in the shown fact (`locs`). The video audit needs no change: it records the drawn strings with the font in force. The frames tool (`tools/atlas-frames.py`) takes `legend` (the legend opened), `tip` (the strip's first tip) and `js` (a statement after the setup) shot keys.

**Checks run in step 1.** The text audit of the full cut at step 6 with 8 shards: 1,435 frames, 31,190 boxes, 22 findings, all `box-over-mark` and all in the city and national year runs where the live box's panel, 540 px wide now, covers marks (18 lines before the widening; the counted category, reported as the plan said it would be); zero of every other kind after the comparison-beat wrap and the anchor-label clearance above. The teaser's text audit at step 3: 460 frames, 7,235 boxes, zero findings. The atlas audit at 400, 768, 1,200, 1,600 and 2,000 px on both renderers found the wider type in three places on its first run (14 findings at the two narrow widths): the opened note at 400 px, a column 46 percent of the map wide in 13 px, ran down into the scale bar; the firms legend at 768 px, 598 px wide with its capital rows, reached under the note; and the cell chart's 11 px caption "share with a statement, this 1 km cell, 2019 to 2024" ran 7 px off the 352 px canvas. Fixes: the legend is capped at 53 percent of the map and the note at 43 on maps 600 px and wider, so the two never share the map's width (the legend's longest rows wrap at 768 to 1,200 px with the hanging indent); on phone-width maps the note is 11.5 px with a 1.3 line height and up to 62 percent wide (its bottom at 159 px against the scale bar's top at 330); a caption wider than the canvas drops its year suffix, which the axis shows. Second run: 654 states, 24,194 boxes, zero findings (the platform-font check names IBM Plex Mono at every width; the `caps` state passes its fifteen selectors, the `.u` spans, the three zoom titles and all nine tip strings at every width; no `text-overflow`); tiles placed over the note or the legend for want of a clear place: 16 (three at 400 px, eleven at 768, two at 1,200; the panels are larger in the monospace, so the relaxed tiers are reached more often than round 9's three), reported as before. Review frames to the author in `build/r12-type` (the landing, the Firms view at Moscow with a hover and the side column, the firms legend, a tip, the light theme, the phone's landing, legend and tip, the Under the cursor card) and `build/r12-type-video` (six frames of the full cut). The working tree committed as "Round 10 in progress (1): the typeface"; nothing published.

**Step 2: dark on every device (C6) and the landing (L9).** The atlas opens dark whatever the browser's colour scheme: the `@media (prefers-color-scheme: light)` block is gone from `explorer.html`, `:root[data-theme="light"]` stays for the theme button, and the remembered choice (`atlas-theme`) is applied to the root before the first `readTheme()`, which until now drew the canvases in the wrong theme until a click when the remembered choice differed from the browser's; the OS-scheme listener, which could change nothing once the media block was gone, is dropped. The published host's skeleton sets `color-scheme: light` on the root; the inlined page style sets `color-scheme: dark` later at equal specificity and the page no longer reads the browser's scheme, so the host cannot produce a light atlas on its own. The explainer has one dark theme and no toggle, so it already opens dark on every device; no toggle is added (the 73 rasters and both cuts are rendered for the dark stage). The landing: every screen opens in the Cells view on the leading-industry layer (when its data exist, else the statement share), 2024, at the national zoom (`state` defaults, the year input and label at 2024, `syncProv()` and `syncYearRow()` at init, `syncMix()` after the first draw so the mix box shows the view's mix at once); the year slider's default is 2024 everywhere it applies, the Firms view loading the 2024 twin when first chosen; the hash links keep their meaning (`#Moscow` the Cells view at the Moscow preset, `#Moscow-firms` the Firms view there, the layer and year the defaults). The frames tool makes light shots through a remembered choice (`Page.addScriptToEvaluateOnNewDocument` setting `atlas-theme`) instead of emulating the browser scheme. Audit: a `landing` check per width right after the load and before any call (the pressed view and layer buttons, the year input and label, the camera equal to the Russia preset's, the `--scheme` token dark with no `data-theme`, the theme button reading "Light theme", the year row and the mix box shown, the industry provenance), and at 400 and 1,600 px two hash loads (`#Moscow` and `#Moscow-firms` on industry 2024 at the Moscow preset camera) and two theme loads (a browser preferring light still opens dark, the map canvas's corner pixel the stage colour; a remembered light choice draws the first frame light, the pixel white, the button reading "Dark theme"). Run at 400 and 1,600 px with the new checks: 271 states, 9,510 boxes; the landing and hash checks pass, and the theme checks pass once the pixel comparison allows the canvas's rounding of the stage colour (it reads 254, 254, 255 for the white stage and 6, 10, 25 for the navy; a tolerance of 4 per channel). The frames `build/r12-landing` show the landing dark, light through the remembered choice, dark again, and on the phone.

**Step 3: the colours and the chrome.** The sequential ramp on the dark theme is a single-hue cyan ramp, six steps at even OKLCH lightness 0.556 to 0.940 with the hue sliding from 195 to 172 degrees: #1C8383, #269C96, #50B5AA, #79CDBF, #A1E4D3, #C7F8E7 (the validator's ordinal run passes on the land #172A45 and the stage #060B18: monotone, adjacent steps 0.073 to 0.081, dark end 3.18:1 and 4.33:1, hue spread 23 degrees; `review/2026-10-26-palette-validator-round10.txt`). The accent is step 4, the accent-strong step 6, the highlight step 4 at 0.10; the same six serve the share tiles at every grid, the firms view's share colouring, the cohort and lists tiles (steps 2 to 6), the density colour (step 4), the national chart's two lines and every chart that reads the accent; the explainer's RAMP6 and the size beat's quintile lines (the ramp's steps 2 to 4 with Q5 in the accent-strong) follow; the light theme keeps its navy ramp. The industry nine are the author's lit hues moved inside their semantic windows by the validator's coordinate search so that every pair among the nine, the neutral and the listed red is at least 13.9 normal and 8.5 colour-vision apart: Agriculture #E8B533, Manufacturing #2882F9, Construction #ED7D43, Trade #4CB3A4, Transport #FBEB87, Finance #E090FD, Professional #9887C7, Public #ECF4FE, Other #6D747A (the light nine #936E16, #2550B4, #973001, #1A7F7A, #6D6816, #7B3FD1, #5D4E78, #537A9B, #5B6470 at 3:1 or more on the cream); the residual pairs under the floors are the warm trio with the red on one lightness axis and the cool cluster with the neutral and the slate on another (Agriculture and Construction 13.9 and 9.4 deutan, Manufacturing and Professional 14.2 and 9.6 protan, Trade and Professional 8.5 deutan, Trade and the neutral 14.2 and 8.7 protan, Finance and the neutral 9.5 deutan), named in the legend and the tile as the secondary encoding; the UI adjacencies (Transport and the green 1.6 protan, two lit yellows under red-green deficiency; Public and the ramp's pale end 6.0) are recorded, not fixed, since the green never colours data. The signed layers share one diverging pair: declines amber to orange (class 1, the largest decline, #FFB000; #F39523; the inner step #EA7719 held at L 0.69 so that it stays 10.3 ΔE from the listed red under deutan vision) and rises in the cyan ramp's steps 3 to 5 (#50B5AA, #79CDBF, #A1E4D3), the zero class (no usable baseline) the slate #6B7482; each half passes the ordinal run on both grounds (gaps at or above 0.06, dark ends 4.92:1 and 5.87:1 on the land); the light pair #854505, #9D5E01, #B27901, #1C989E, #0A7E83, #196369 with the zero #727C86. The pair colours the Change layer, the Cells view's revenue layer, the Firms view's revenue classes and the pre-listing rimmed marks on that layer, the explainer's change map (CHANGE6) and the fall and rise tokens (classes 2 and 5). The page reads the nine, the six and the zero from tokens (`--ind-1` to `--ind-9`, `--div-1` to `--div-6`, `--zero`, in both themes) with the passes' tables as the fallback; `readTheme` keeps `change6` and `div6` one array. The R constants moved with them (`industry-common.R`, `M6-common.R` with `COL_ZERO`) and the passes re-ran under the lab guard with every colour final: M11 (34 s, 15 of 15 regions checks; `industry.json` carries the nine), M6 (46 s, peak 10.7 GB; 163 and 16 checks), M7 (27 s; 201), M8 (66 s, peak 12.9 GB; 74 and 22, four new), M9 (206 s, peak 12.9 GB; 335, two new); every raster changed (the 36 outcome layers and the 12 national year layers in colour, the backdrops by the disc-order noise the record names), the twelve twins' decompressed records are byte-identical to the step-1 copies (the header's padding and the gzip comment are the difference, below), and every manifest now carries `author`. Checkpoints sent to the author: the share layer at Russia in the Cells view, the industry layer at Moscow with the mix box, the Change layer at Russia and the revenue layer in the Firms view at Moscow with a hover, each before (the step-1 copy on port 8766, with its own data) and after, the swatch strips of the nine and the pair, the explainer's change map and size scene (`build/r12-colours-before`, `build/r12-colours-after`, `build/r12-ramp-video*`, `build/r12-signed-video*`).

The chrome (the author's item 10, corrected twice on 25 October: first to a full border with the bar inside, then from the mock to no bar at all): every button carries a 3 px border in its role colour at rest, the live variant on hover, the pressed state the solid accent fill with the stage colour as text (6.5:1 dark, 5.7:1 light), disabled at 0.4, no left-edge bar anywhere (the mock's 1.5 px border with a 3 px inside bar is gone from both pages); the side column's cards and the explainer's control bar 3 px, the map overlays (the legend, the tile, the mix box, the strip's rule, the scale bar, the zoom box's frame) their 2 px so the map stays quiet; fuchsia where a control acts on the map (the Layer and Go to cards, the view, layer and preset buttons, the zoom box and its buttons, the theme and pulse buttons, the tile, the footer's square buttons, the explainer's control bar and its buttons) and green where a panel only reads (the Under the cursor and chart cards, the legend, the note, the mix box, the scale bar, the strip's 2 px top rule and the toggles); squared corners everywhere but the round listed-state glyphs; the map wrap keeps its 1 px neutral border. Focus shows the mark's four corner brackets in the live cursor colour instead of a ring (four 8 by 8 px data-URI images on a `::after` layer, one per corner, so they never distort; `--mk-tl` to `--mk-br` per theme), on buttons, toggles, the map and the explainer's controls. The mock (`build/r12-chrome`) went to the author before the chrome reached the explainer page. The mark (the author's item 14b): one inline SVG symbol `#mark`, four L-shaped corner brackets of arm 6 and stroke 2 in a 24-unit square with a dot of radius 2.5 at the centre, in the current colour; used at 18 px before VISIBILITY ATLAS, at 16 px before the explainer's page title, at 12 px before the name in both bylines and footers, on canvas in the video credits before the name line (`MM.mark`), and as the focus corners above; the minimap's Russia frame and the wire's separator come in step 4; nowhere on the map at a location. The right column (the author's correction from the mock): the layer's provenance paragraph left its place under the slider for a METHOD row under VIEW with a square "i" button in the green role (the only green button; two accents only) that toggles a block, collapsed by default and remembered per viewer (`atlas-method`), showing its first two lines under a fade with a More toggle (remembered too, `atlas-method-more`): the first section opens with the counts from the former header description ("3,277,638 located eligible firms at 727,190 distinct coordinate pairs in 2021, 100 km cells by year, city windows at 1 km and 250 m"), the records line and the provenance sentence from the former footer, then the layer's or the Firms view's provenance as before; a second section headed READING THE ATLAS holds the former footer's reading notes (descriptive associations, absence is not withdrawal, the treated and comparison-group definitions, the hash-link sentence). The header is one 44 px row: the mark and VISIBILITY ATLAS at 20 px with the one-line tagline "Where Russian firms file, and where their statements stop appearing." under it at the left, the theme button and the byline's two lines at the right as one group; below about 1,400 px (the tagline, the button and the 612 px byline no longer share a row) the group wraps as a whole to a second row at the right, and the header never shrinks over the map (`flex: 0 0 auto`, a defect the 1,200 px frame showed before the group was made one). The footer is one line: the author line at the left, at the right only the licences the data require, "Data: RFSD v3.1.0, CC BY 4.0 · geoBoundaries gbOpen, CC BY 4.0 · OpenStreetMap, ODbL 1.0 · © 2026 Armen G. Kaprelian" (item 17's licence line, in the author's wording). The explainer page carries the same header row (its title at 20 px with the tagline, the byline at the right) and the same footer line. The byline and the about line (item 16, the author's values): "ARMEN G. KAPRELIAN · PHD CANDIDATE, CLAREMONT GRADUATE UNIVERSITY" at 12 px in Plex Mono 500 tracked capitals in the ink colour, right-aligned on the title's baseline, the dissertation title "Opacity and Adaptation under Sanctions. Geoeconomics in the Universe of Russian Firms" beneath in the muted tone at 12 px, nothing larger and no border, the theme button to its left; under 900 px the block wraps under the description, left-aligned. The footer line on both pages: the name with the mark, the email as selectable text in a code span with a square copy button (the clipboard call inside the click, the text selected when it is refused, "Copied" for 1.5 s; no mail link), "[personal website]" as plain text until an address is given, two square buttons to the author's profile on X (https://x.com/ArmenKaprelian) and to an X share intent with a prepared text that names the page, carries the artifact's fixed link and mentions @ArmenKaprelian, both opening in a new tab; then the licence line. The credits title card gains the name line at 22 px in tracked capitals under the title, the mark before it. The authorship marks (item 17), the string "by Armen G. Kaprelian": `<meta name="author">` and the footer's licence line on both pages; the `author` field on every manifest `motion_save_json` writes (M2 to M5 and M10 did not re-run in this round, so their files carry none until they do); the twelve padding bytes of each FRM1 header carry "AGK 2026" then zeros (the page's parser ignores them; M9's read-back asserts the string); both renders carry metadata tags through ffmpeg on the shards and the join (`author` and `comment` as written here in step 3; step 5 found the MP4 muxer drops a generic `author` key, so the tags are `artist`, `copyright` and `comment`); the project mark with the initials inside its square (`MM.markAGK`: the brackets with "AGK" in Plex Mono 500 at 0.3 of the size, plain fillText so the text audit records no box) drawn on the atlas's map canvas right after the basemap at the map's lower edge, centred, 96 px wide, 44 px above the strip, at 0.04 alpha in the ink colour, fixed in screen space, and on the video's stage after the ground's basemap at (960, 1,040), 72 px wide, 0.04, under every data layer and panel in every cut; and two marks of the lab's own design that a copier would not think to normalise: a CSS custom property `--by: "Armen G. Kaprelian"` in both pages' root token blocks and in `theme.css`, read by nothing, and a gzip comment field (RFC 1952 FCOMMENT, "by Armen G. Kaprelian") in each address twin's header, written by M9 after `gzip -9 -n` (FLG bit 4 set, the zero-terminated comment after the ten-byte header; every decoder skips it, `DecompressionStream` included; the page exposes it as `__atlas.twinNote(year)`). Nothing on screen beyond the byline is more visible than the byline.

**Checks run in step 3.** The validator record `review/2026-10-26-palette-validator-round10.txt` (the cyan ramp and both diverging halves pass their ordinal runs on both grounds; the all-pairs runs of the nine and of the pair fail the band and chroma checks by design, as round 9's did, with the adjacencies named above). The passes' checks all pass (M11 15, M6 163 and 16, M7 201, M8 74 and 22, M9 335); the twelve twins' records are byte-identical to the step-1 copies under the new headers (a Python decompression of each pair; the padding reads "AGK 2026" and the gzip comment "by Armen G. Kaprelian" in every twin); the ffmpeg tags are on the renders at step 5. The text audit of the full cut at step 6 with 8 shards: 1,435 frames, 31,222 boxes, 22 findings, all the counted box-over-mark lines of the live box; the teaser at step 3: 460 frames, 7,258 boxes, zero. The explainer's credits name line and the 4 percent mark changed no other box. The atlas audit at the five widths on both renderers ran six times during the step as the chrome settled: the first run after the mock found 275 findings, 265 of them the odds chart's year labels overlapping at 400 px (the chart kept 40 px inner margins on each side of its plot and the monospace end label "sanctions list (treated)" left 59 px for five years; the small panel's chart now passes 14 px margins and a 10 px end gap, so the plot has 97 px), one the legend reaching under the mix box's collapsed stub at 768 px in the 2D renderer (the legend now ends below the stub when the box is present, `mix-on`, and scrolls inside), and the rest my own new checks reading the wrong thing (the mark's pixel test sampled a different ground beside the arm, the remembered More state used a value the preference reader does not accept, the draw-order push sat inside a comment); the method block itself had a defect the frames showed and the audit did not (its grid display overrode the hidden attribute, and the state reader looked at the attribute, not the rendering; both fixed, and the reader now reads the rendering). The final run of the step: 694 states, 25,099 boxes, zero findings at 400, 768, 1,200, 1,600 and 2,000 px on both renderers (the landing, hash, theme and method reloads, the caps state with the byline, the licence line, the 3 px borders without shadows and the header's row rule, the mark's draw order and pixel, the twin comment, every tip measured); tiles placed over the note or the legend for want of a clear place: 16, as in step 1. The mark's place under every data layer is proven by the page's own draw log (`__atlas.drawOrder()`: basemap, mark, then the layer, in the Cells and the Firms views) and its presence by the pixel test on the lists layer at the Russia preset (the arm reads a ground lifted 0.04 toward the ink; the ground beside it is the stage or the land). Frames: `build/r12-colours-*`, `build/r12-ramp-video*`, `build/r12-signed-video*`, `build/r12-chrome` (the mock, then the corrected chrome), `build/r12-landing`, `build/r12-graticule-*` (the graticule, re-run in this step so the audit covered the new basemap: M1 16 of 16 checks, 25 lines, 2,545 vertices, 656 kB).



**Step 4: the map, the wire and the player.** The graticule (G8) is rebuilt in M1 for the pages only: 18 meridians every 20 degrees from 20 N to the pole, where they meet within 1e-12, and 7 parallels from 20 to 80 N as closed rings, 25 lines and 2,545 vertices, `basemap.json` 656 kB (640 kB before), three new checks (25 lines, every meridian's last vertex at the pole, every parallel closed) beside M1's thirteen; the atlas and the video stroke the same path, so the far-side meridians fan above the pole and no line ends inside the frame. The Firms view's click ladder (K9) has its own rungs by zoom alone, every landing centred on the click: at or above the 20 km rung a step of 4, at or above the city rung the 20 km rung, below it an empty 100 km cell a step of 4, a cell holding a preset city the city rung, otherwise the 500 km rung; Shift+click a quarter above the 20 km rung, the city rung between, the fit below; the Cells path is untouched and its camera states hold by tag. Two clicks reach the 20 km rung where a preset city lies in the cell, three where the 500 km rung comes first; the Firms view needed about seven steps of 2.5 before.

**The city-window hand-over (C19).** On the share, density and industry layers the 25 km cells outside the window fade to a quarter with a 1 px outline in the ghost tone as the 1 km grid comes in, following the window's own ramp, through `drawAround`'s outside pass; `__atlas.handover()` reports the window's strength, the outside alpha and the outline (the 1 km pass only: the 250 m passes no longer overwrite the record). At the Moscow preset the window is at full strength from 768 px up; the 376 px phone map sits at k 3.96, 0.94 of the way up the ramp, and the audit accepts 0.9 there. Frames in `build/r12-handover-before` and `-after`.

**The striped display style (S18).** On canvas `Motion.text` takes a `stripe` option (applied at 28 px and above) and `Motion.striped` cuts the glyph box into eight bars per capital height on an offscreen canvas (`destination-out` gap rows), 1 px gaps on the atlas and 2 px in the video, inside the measured ink box so the text audit's boxes are unchanged; the scene titles, the hook, the credits title and the video's large year take it. On the page the title spans (VISIBILITY ATLAS, Who stays visible?) carry a CSS mask at a 3 px pitch (2 px bars, 1 px gaps: a fractional pitch blurs under the mask's antialiasing; six and a half bars over the 19.5 px cap of a 28 px line, a recorded deviation from eight), on a span around the text so the 18 px mark beside it stays whole, plain where masks are unsupported. The author's corrections of 25 October: no symbol takes the stripes (the mark, the listed-state glyphs, the pulse button's ring and dot, the region glyphs, the minimap's dots and frame are drawn whole; `M.markAGK` lost its striped branch), and the year value is set at 16 px, under the display floor, unstriped; the legend's ramp bars stay the one striped non-text element. Frames in `build/r12-stripes-*`.

**Ghost names, hairline borders, the hovered region (G13).** The 22 preset cities in tracked capitals (Plex Mono 500, 12 percent tracking) ranked by their 2021 located count in the 90 km window, 34 px for the first down to 26 for the last on a straight line, in the ghost tone #1F3350 (light #E4E7E4), the baseline 10 px above the dot, drawn on the map canvas right after the basemap and the authorship mark and under every data layer; collisions resolved once per zoom bucket (`floor(log2 k)`) at the bucket's smallest zoom, its most crowded, by trying above, below, right and left and then smaller sizes to 26 with a 2 px gutter, dropped where nothing fits (the audit's ghost-overlap rule, which a layout resolved mid-bucket broke at the band1 camera); alpha 1 below k 1 to 0 at k 3 in log k, the 13 px labels from k 1.5 to 3. The regional borders at the national zoom in the ghost tone at 1 px with the same fade (`drawBasemap`'s lod0 options); the region under the cursor outlined in the cursor colour on the overlay canvas from a cached `Path2D` per region, at every zoom and in both views, inside a city window included (as corrected 25 October; the first version limited it to the strip's region), and the strip follows the cursor's region below the city band. Audit: `ghost` (at least 12 of 22 drawn at 1,600 px, 8 at 768 and 1,200, 2 at 400, where the rank sizes keep most names off the 376 px map), `ghostoff`, `borders` (eight vertices of Moscow Oblast's first ring on the lists layer, where the tiles leave the borders bare), `regionhov`, `regionhovcity`, `ctxhover`. Hover cost 0.66 ms mean before and 0.89 after at the Russia preset (the region change's strip update; a hover-driven wire rebuild waits 250 ms and the camera's own band is memoised, which brought a 4.3 ms regression back).

**Two layers under the dot field (F13).** Through `drawBasemap`'s new `afterLand` hook, right after the land fill and before the graticule, the region borders and the ghost names (the author's correction of 25 October): the region tint, each region in its leading industry's class colour with the OKLab chroma halved, 8 percent, full below k 0.5 and gone by 1.5, from a km-space bitmap at 0.175 px per km (1,428 by 809) built once per year and theme, two cached; the glow, the year's addresses accumulated in the layer's palette with the field's alpha-by-count rule into a buffer at one eighth of the fitted zoom (147 by 87 px at 1,600 px), a two-pass box blur of radius 2 in JS, drawn at 6 percent, full below k 1.5 and gone by 3, cached per year, layer, theme and fitted zoom and never rebuilt within a frame; `__atlas.firmsLayers()` and `__atlas.dotContrast(n)` for the audit; the first values (18 and 35 percent) were pulled back twice by the author. The dots' mean WCAG contrast against the composite beneath them at the Russia preset keeps 0.83 (share), 0.85 (industry) and 0.87 (fin) of the bare value: the author's 0.1 rule is unmeetable with any visible layer (the tint alone at 8 percent cost 1.0 of 9.2 on the share layer; the glow at 15 percent 2.2) and the author accepted the measured figures on 25 October; the audit's floor is 0.80. Frame cost at Russia in the Firms view 3.60 ms mean before, 3.67 after. Frames in `build/r12-firms-before`, `-after`, `-after2`, `-after3`.

**The minimap (M12).** In the GO TO card above 900 px, an inline SVG (`viewBox 0 0 376 232`): the national extent in a 272 by 154 box at x 104, y 10 (0.033397 px per km), a 100 px label column at the left and a 56 px band below; the land traced from the basemap's parts filled at 0.03 px per km (13 components of four pixels or more, the mainland first, each trace starting at the leftmost pixel of the component's fullest row, since a start on a one-pixel spur closes the walk early), simplified at 12 km for the mainland and 8 km for the rest, filled in the land colour with a 1 px border stroke; the graticule's polylines clipped to the box; the 22 cities as dots (r 3) with straight leaders to the midpoint of the box edge facing the dot and label boxes 12 px tall in 9 px Plex Mono 500 tracked capitals (10 px, the plan's size, does not fit NIZHNY NOVGOROD in the column; a recorded deviation); the layout table in `explorer-app.js` (`MM_LAYOUT`: the column, right edge at x 100, St Petersburg 0, Kaliningrad 14, Moscow 42, Kazan 56, Voronezh 70, Rostov-on-Don 84, Krasnodar 98, Volgograd 112, Samara 126, Ufa 140; in place Murmansk, Nizhny Novgorod, Perm, Yekaterinburg, Tyumen, Krasnoyarsk, Omsk, Novosibirsk, Irkutsk and Khabarovsk; the band Chelyabinsk and Vladivostok) resolved by hand against the rules `minimapCheck()` tests: no box within 2 px of another box or a dot, no leader crossing another, none within 2 px of another city's dot edge (the plan's 4 px proved unmeetable in the Volga cluster: Kazan's leader passes Voronezh at 5.5 px from its centre or not at all) or through a box, every box inside the viewBox. Colours (the author's corrections of 25 October): dots and box strokes #9CC8FF, leaders #CFE6FF, names in the ink; a hover lights the dot, leader and box to the live green with the name in the ink; the selected preset (the city the camera is on, RUSSIA at the fit) in the full neon green on all four; keyboard focus a 2 px fuchsia-live stroke; the Russia frame is the mark's four brackets at the box's corners with its label box inside the top-right corner; the leaders draw on once at load over 0.6 s (none under reduced motion); click, Enter and Space fly through the preset's own target; the button list keeps Central Moscow only; the phone keeps the buttons. `__atlas.minimap()` and `minimapClick(label)`; the audit's `minimap` state (visibility by width, the rules, four clicks against their presets, the selected groups and their green).

**The data wire and the cat facts (W14, E15).** The context strip is a 34 px wire (`--lift` 34) with 14 px text: one row of items written twice in a track that a transform animation scrolls at 60 px per second (`--wire-dur` from the track's width: 35,072 px and 584.5 s a loop at 1,600 px), paused under the pointer or keyboard focus within the bar; the text row takes pointer events, so the map's bottom 34 px are not hoverable under it (round 9's strip passed hovers through); under reduced motion no scrolling, the items crossfade one at a time, 8 s each, on round 9's spans. A cycle is 50 items in two halves of 25: each half opens with the lead fact (the band's own fact in its full form), carries the data facts in one order (the second half reversed), five named listed firms that turned red that year at data slots 2, 6, 10, 14 and 18 (ten picks at `floor(i n / 10)` over the names sorted, the halves taking alternate picks; a region's own listed firms when it has two or more, else the national picks) and a tip at every fifth slot (the page's tips in order, the touch and Firms-view variants as the page shows them). The data facts, each a template over named fields: the year's listing count nationally and in the region (`treatednational.red_from`, `reg`), the eligible and located totals with their statement counts and shares (`cellsyears.totals`), the leading division nationally and in how many regions (`regions.d1`), the region's leader when it differs and its listed share of revenue and listed count (`regions.lsh`, `listed`), the address field's counts, the largest coordinate pair and the pairs shared by 100 or more (`firms.by_year`), the median real-revenue change of firms on no list (`firms.median_by_year`), the 2021 series facts, the change layer's supported cells and shares (`cells100.change`, `change_totals`), the lists layer's cells with five or more sanctions-list members, the revenue cohort's size, the cumulative red count and the undated and inferred counts; a named firm reads "NAME · listed 19 May 2022 (date inferred) · 2022 statement absent" with the statement state from `filed`. One slot in the cycle carries a cat fact: slot `12 + (FNV-1a(year|region) mod 26)`, moved forward past tip slots and past any slot beside a named firm, the fact `pool[(hash + 7 × loops) mod 44]` with the loop counted at each `animationiteration` (the track rebuilds on the seam), the prefix "OFF THE WIRE ·" in the muted context colour and the fact in the ink; the pool of 44 facts and their references is listed below. `tools/wire_check.py` re-derives every item from the data files with the same formatting rules (the generator and the checker share only the data) and the audit compares the cycle item by item for 2021 and 2024 at the Russia preset and inside Moscow Oblast (tips by membership, the cat by its slot and text). `__atlas.wire()`, `wireAt(year, region)`, `tipTexts()`; `tip(true)` pins the next tip item at the window's left edge for the audit's tip states.

**The cat pool (E15), 44 facts with their references** (checked on 25 October 2026 against the source named; the reference never shows on screen; the prefix on screen is "OFF THE WIRE ·").

- 1. Cats can see with about one sixth of the light people need. (Wikipedia, Cat: senses (vision); https://en.wikipedia.org/wiki/Cat)
- 2. A cat hears up to about 79 kilohertz, far above the human ceiling. (Wikipedia, Cat: senses (hearing, 55 Hz to 79 kHz); https://en.wikipedia.org/wiki/Cat)
- 3. A cat's hearing is sharpest between 500 hertz and 32 kilohertz. (Wikipedia, Cat: senses (hearing); https://en.wikipedia.org/wiki/Cat)
- 4. Cats sleep 12 to 16 hours a day, 13 to 14 on average. (Wikipedia, Cat: behaviour (sleep); https://en.wikipedia.org/wiki/Cat)
- 5. The name Felis catus was given by Carl Linnaeus in 1758. (Wikipedia, Cat: taxonomy; https://en.wikipedia.org/wiki/Cat)
- 6. The domestic cat descends from the African wildcat, Felis lybica. Taming began in the Near East around 7500 BCE. (Wikipedia, Cat: domestication; Driscoll et al. 2007, Science 317: 519; https://en.wikipedia.org/wiki/Cat)
- 7. Domestic cats trace to at least five founding wildcat lineages of the Fertile Crescent. (Driscoll et al. 2007, The Near Eastern origin of cat domestication, Science 317: 519-523; https://www.science.org/doi/10.1126/science.1139518)
- 8. The oldest known cat burial, at Shillourokambos on Cyprus, is about 9,500 years old. The cat lay 40 centimetres from a person. (National Geographic, 8 April 2004 (Vigne et al. 2004, Science); https://www.nationalgeographic.com/animals/article/oldest-known-pet-cat-9500-year-old-burial-found-on-cyprus)
- 9. Cats cannot taste sweetness: their sweet-receptor gene Tas1r2 is a pseudogene. (Li et al. 2005, PLoS Genetics 1(1): e3; https://pmc.ncbi.nlm.nih.gov/articles/PMC1183522/)
- 10. A cat purrs at 25 to 150 hertz, on the in-breath and the out-breath alike. (Scientific American, Why do cats purr? (Leslie Lyons), 2006; https://www.scientificamerican.com/article/why-do-cats-purr/)
- 11. The spines on a cat's tongue are scoop-shaped: they carry saliva deep into the fur, and the cat cools as it dries. (Noel and Hu 2018, PNAS 115: 12377; National Geographic, November 2018; https://pmc.ncbi.nlm.nih.gov/articles/PMC6298085)
- 12. A cat has five toes on each front paw and four on each hind paw: eighteen in all. (Wikipedia, Cat anatomy: paws; https://en.wikipedia.org/wiki/Cat_anatomy)
- 13. A cat's collarbones float free, held by muscle rather than joined to other bones. (Wikipedia, Cat anatomy: skeleton; https://en.wikipedia.org/wiki/Cat_anatomy)
- 14. Cats sweat mainly through their paw pads. (Wikipedia, Cat anatomy: skin; https://en.wikipedia.org/wiki/Cat_anatomy)
- 15. A cat's third eyelid is the nictitating membrane. (Wikipedia, Cat anatomy: eyes; https://en.wikipedia.org/wiki/Cat_anatomy)
- 16. A cat moves each ear on its own. (Wikipedia, Cat anatomy: ears; https://en.wikipedia.org/wiki/Cat_anatomy)
- 17. A cat's claws rest sheathed and extend at will. (Wikipedia, Cat anatomy: claws; https://en.wikipedia.org/wiki/Cat_anatomy)
- 18. The righting reflex appears at three to four weeks of age and is perfected by six to nine. (Wikipedia, Cat righting reflex; https://en.wikipedia.org/wiki/Cat_righting_reflex)
- 19. A cat falling from up to three metres can right itself and land on its paws. (Wikipedia, Cat: righting; https://en.wikipedia.org/wiki/Cat)
- 20. The ancient Egyptian word for cat was mjw. Cats appear in Egyptian scenes from about 1980 BC. (Wikipedia, Cats in ancient Egypt; https://en.wikipedia.org/wiki/Cats_in_ancient_Egypt)
- 21. Bastet, the Egyptian cat goddess, is attested from the Second Dynasty onward. (Wikipedia, Cats in ancient Egypt; https://en.wikipedia.org/wiki/Cats_in_ancient_Egypt)
- 22. The Hermitage in St Petersburg keeps cats in its basements against mice, as Empress Elizabeth ordered in 1745. (Wikipedia, Hermitage cats; https://en.wikipedia.org/wiki/Hermitage_cats)
- 23. The Hermitage's cats have their own press secretary and a Hermitage Cat Day every spring. (Wikipedia, Hermitage cats; https://en.wikipedia.org/wiki/Hermitage_cats)
- 24. The Siberian is a centuries-old natural variety of cat from Russia and its national cat. (Wikipedia, Siberian cat; https://en.wikipedia.org/wiki/Siberian_cat)
- 25. Siberian cats appear in Slavic folktales and artwork from the 10th century. (Wikipedia, Siberian cat; https://en.wikipedia.org/wiki/Siberian_cat)
- 26. The Russian Blue may have begun as a landrace in the port of Arkhangelsk. The Archangel Blues have emerald-green eyes. (Wikipedia, Russian Blue; https://en.wikipedia.org/wiki/Russian_Blue)
- 27. The Kurilian Bobtail, with a pom-pom tail of 2 to 10 vertebrae, is a natural breed of the Kuril Islands, Sakhalin and Kamchatka. (Wikipedia, Kurilian Bobtail; https://en.wikipedia.org/wiki/Kurilian_Bobtail)
- 28. Catnip's nepetalactone delights about two thirds of cats. Leopards, cougars, servals and lynxes often react too. (Wikipedia, Catnip; https://en.wikipedia.org/wiki/Catnip)
- 29. Cats younger than six months may not react to catnip at all. (Wikipedia, Catnip; https://en.wikipedia.org/wiki/Catnip)
- 30. The world's first cat café opened in Taipei in 1998. Japan's first opened in Osaka in 2004. (Wikipedia, Cat café; https://en.wikipedia.org/wiki/Cat_caf%C3%A9)
- 31. On Aoshima, Japan's Cat Island, cats have outnumbered people by up to 36 to one. (Wikipedia, Aoshima, Ehime; https://en.wikipedia.org/wiki/Aoshima,_Ehime)
- 32. The first cat show was held at the Crystal Palace in London in 1871, organised by Harrison Weir. (Wikipedia, Cat show; https://en.wikipedia.org/wiki/Cat_show)
- 33. The Maine Coon, one of the largest breeds, has been Maine's official state cat since 1985. (Wikipedia, Maine Coon; https://en.wikipedia.org/wiki/Maine_Coon)
- 34. A male Maine Coon weighs 8 to 10 kilograms on average. (Wikipedia, Maine Coon; https://en.wikipedia.org/wiki/Maine_Coon)
- 35. The longest domestic cat on record, Stewie, a Maine Coon, measured 123 centimetres from nose to tail tip in 2010. (Guinness World Records, Stewie, the longest cat in the world (2011); https://www.guinnessworldrecords.com/news/2011/9/record-holder-profile-video-stewie-the-longest-cat-in-the-world)
- 36. The oldest cat on record, Creme Puff of Austin, Texas, lived 38 years and 3 days. (Guinness World Records, Oldest cat ever; https://www.guinnessworldrecords.com/world-records/oldest-cat-ever)
- 37. Nearly 60 polydactyl cats live at the Hemingway Home in Key West, descended from Snow White, a six-toed cat a ship's captain gave Hemingway. (The Ernest Hemingway Home and Museum, Our cats; https://hemingwayhome.com/our-cats)
- 38. Hemingway named his cats after famous people, and the Key West museum keeps the custom. (The Ernest Hemingway Home and Museum, Our cats; https://hemingwayhome.com/our-cats)
- 39. A cat's cerebral cortex holds about 250 million neurons. (Jardim-Messeder et al. 2017, Frontiers in Neuroanatomy 11: 118; https://www.frontiersin.org/articles/10.3389/fnana.2017.00118/full)
- 40. The orange-coat mutation sits near the Arhgap36 gene on the X chromosome. Two teams found it in May 2025. (Scientific American, May 2025 (Kaelin et al. and Sasaki et al. 2025, Current Biology); https://www.scientificamerican.com/article/this-strange-mutation-explains-the-mystifying-color-of-orange-cats/)
- 41. An adult cat's heart beats 140 to 220 times a minute. At rest it takes 20 to 30 breaths. (Vetstreet, Feline fine: how to read your cat's vital signs (Marty Becker); https://www.vetstreet.com/dr-marty-becker/feline-fine-how-to-read-your-cats-vital-signs)
- 42. A cat's normal temperature runs from 100 to 102.5 degrees Fahrenheit, about 37.8 to 39.2 Celsius. (Vetstreet, Feline fine: how to read your cat's vital signs (Marty Becker); https://www.vetstreet.com/dr-marty-becker/feline-fine-how-to-read-your-cats-vital-signs)
- 43. Whiskers grow above a cat's eyes and on its forelegs as well as on the muzzle. (Wikipedia, Whiskers; https://en.wikipedia.org/wiki/Whiskers)
- 44. The average pet cat's lifespan rose from about 7 years in the early 1980s to about 13 by 2014. (Wikipedia, Cat: lifespan; https://en.wikipedia.org/wiki/Cat)

**The explainer page's player (P20).** The stage box fills the viewport width at 16:9, capped by the viewport height less the header, caption and footer (`--chrome-h`, measured once per resize); the control bar overlays the box's lower edge on the panel colour at 92 percent with the 3 px fuchsia border: play, the cut, the time, the scrub bar, CHAPTERS (the list opens upward over the stage, the current chapter in the pressed fill, focus to it, the arrows move within the list, Escape closes it and returns focus; on a stage too short for the list it scrolls inside its box) and a full-screen button (the Fullscreen API, else a fixed-to-viewport fallback the same button and Escape leave); shown on load and whenever paused, hidden 2.5 s after the last input while playing, back on any mouse movement, key or touch, 0.3 s fades and none under reduced motion; the keyboard shortcuts unchanged; the caption and footer stay below. `tools/explainer-audit.py` (1,600 by 1,000 and 400 by 844): zero findings; frames `build/r12-player`. Render mode is untouched: frames 150 and 8,130 rendered after the change are byte-identical to those before.

**The GO TO card's neutral (N21).** Travel neither acts on the data nor reads it, so the card, its buttons and the minimap take the page's neutral instead of a role colour: first the ink, then the author's ice blue #CFE6FF (no pale blue-white clears 15 from the cyan ramp's pale end; the record `review/2026-10-26-chrome-corrections-validator-round10.txt`), then the colder #9CC8FF of the minimap correction, validated at 15.5 from the pale end, 22.7 from the Manufacturing blue, 29.2 (11.3 deutan) from the fuchsia and 27.0 from the green; the pressed button a solid fill with stage text, the hover full white; the light theme #22364D (18.1 from the light Manufacturing blue). The audit's capitals state checks the card's and buttons' border colour against the token and the other cards against their roles.

**The surface grain (G22).** One 128 px SVG tile (`feTurbulence` fractal noise, two octaves, stitched; made grey, its contrast stretched, each pixel black or white by threshold, its alpha a V around the mid tone with arms sized to the theme's surface: 0.375 for black and 0.025 for white on the dark theme, 0.016 and 0.44 on the light, so the lift and the drop are equal, about 6 levels on the dark theme and 4 on the light) as a second background layer, composited normally, on every chrome surface: the header and footer bands, the cards, the legend, the tile, the mix box, the wire, the scale bar, the zoom box, the note, and on the explainer's control bar, chapter list, header and footer; never on the map canvas or the stage. The first tile, 2.5 percent alpha noise blended with overlay as planned, was invisible on the dark panel (the overlay's range on a 16-level surface is under one level) and was replaced. The guard (`tools/grainguard.py`, run by the atlas audit at 1,600 px): on an empty patch of the Under the cursor card and of the legend the ink, muted and dim contrasts with the grain against without differ by 0.036 at most (card ink 16.28 to 16.31, muted 10.26 to 10.29, dim 5.29 to 5.30; the legend 0.016 or less; the light theme 0.011 or less), the pixel spread 1.7 levels on the dark theme and 1.0 on the light; the hover cost unchanged (0.89 ms). Crops at 3x in `build/r12-grain-before` and `-after`.

**The chrome corrections of 25 October.** The muted text tone lifted one step to #B4C0D0 (light #52636D, the same OKLab step; the contrast table in the chrome-corrections record); the year row final: YEAR in the ink and the value in the neon green at 16 px Plex Mono 700 tracked capitals on one baseline, the thumb the project mark at 20 px with 2.5 px strokes and a 4 px dot in the neon green, both stepping to the live green while a pulse runs and settling back over 0.3 s, the track fuchsia, the brackets opening 2 px on hover and drag, a 24 px hit area, the pulse button the one red control (a red border and glyph, filled red while a pulse runs); the note starting collapsed at the national and regional zooms while the wire is open and expanded in a city window or with the wire closed, the viewer's toggle remembered; the card titles and the overlays' titles in the neon green (14.4:1 on the dark panel, 4.8:1 on the light); a `[hidden] { display: none !important }` rule as the published host's skeleton has, which the lab page lacked (the pulse button showed dimmed in the Cells view). No window dragging anywhere.

**Collapse toggles on the cards (the author's addition of 25 October, before step 5).** Each of the six cards (LAYER, GO TO, UNDER THE CURSOR, NATIONAL AVAILABILITY BY YEAR, GROUPS, ODDS) carries the map overlays' square toggle at the right of its title row (26 by 24 px, the green border, the glyph in the neon green, the mark's fuchsia corners on focus, `aria-expanded` and `aria-controls`); collapsed, the card shows its title row only (46 px: the 24 px row, the 8 px padding and the 3 px borders); the state is remembered per viewer under `atlas-card-<id>`; every card opens by default on every screen. A collapsed chart card's chart is not drawn (its canvas has no size) and redraws on opening; the GO TO card's minimap measures its labels in a shown subtree even when the card loads collapsed. `__atlas.card(id, open, persist)` and `cards()`; the audit holds the six boxes (the toggle inside the title row, at least 24 px, clear of the title; a collapsed body hidden and the card no taller than its row), a `cardscollapsed` state at 1,600 and 400 px, and a reload with the groups card closed in storage.

**Checks run in step 4.** The atlas audit at the five widths on both renderers: the full run on the step's final code found 916 states and 36,351 boxes with three findings, all in the ghost names (the plan's floors of eight drawn names at 768 and 1,200 px against six, and two boxes crossing at the band1 camera at 2,000 px, boxes placed on the far side of each other's dots that cross as the dots spread within a zoom bucket); the layout now tests each candidate at the bucket's floor, middle and top, and the floors follow the measured counts (13 of 17 laid at 1,600 px, 5 of 7 at 768 and 1,200, 1 of 5 at 400); the re-runs: 768, 1,200 and 2,000 px 549 states, 22,239 boxes, the two floor findings only, then 768 and 1,200 px 366 states, 14,528 boxes, zero findings, and 400 and 1,600 px 367 states, 13,922 boxes, one finding, the 400 px floor again (one name drawn of five laid on the 376 px map, so that floor is one); the last run at 400 px 179 states, 6,394 boxes, zero findings, so every width has passed on the step's final code. The smoke run before the day's last corrections (911 states) also caught the wire's capitals selector and the states' 60 ms wait, both updated (the wire's tips are `.wi.tip`; a hover-driven rebuild waits 250 ms, so the wire states wait 450). The explainer audit: zero findings at both sizes. Frame costs at 1,600 px (`cost4.py`, the step-1 copy on 8766 against the working tree): cells/share at Russia 0.02 to 0.10 ms, cells/industry 0.02 to 0.10, firms/share at Russia 3.60 to 3.67, cells/share at Moscow 0.03 to 0.04, hover 0.66 to 0.89 (the region change's strip update). The text audits of both cuts and the renders wait for step 5 (the credits name line, the whole-drawn mark and the striped titles reach the frames there).

**Step 5: the verification (25 October 2026; nothing published).** The atlas audit at 400, 768, 1,200, 1,600 and 2,000 px on both renderers, with the cards' toggles: 922 states, 36,257 boxes, zero findings (the tiles placed over the note or the legend for want of a clear place: 20, all at 400 and 768 px as before). The explainer's player audit at 1,600 by 1,000 and 400 by 844: zero findings. Frame costs at 1,600 px (`cost5.py`, the step-1 copy on 8766 against the working tree, measured while the renders ran): cells/share at Russia 0.02 to 0.05 ms mean, cells/industry at Russia 0.02 to 0.06, firms/share at Russia 5.28 to 3.38 (max 9.7 to 4.0), cells/share at Moscow 0.08 to 0.05, cells/industry at Moscow 0.17 to 0.10, firms/share at Moscow 2.15 to 1.43, the Central Moscow preset 0.03 to 0.03 (share), 0.18 to 0.03 (industry) and 1.77 to 1.60 (firms); the hover at Russia 0.49 to 1.38 under that load and 0.88 measured alone (the region lookup per move since G13, the strip's region update, the outline), at Moscow 0.54 to 1.30 under load and 0.46 alone; the context fact 0.07 to 0.03; the overlay 0.01 to 0.11. The region lookup under the cursor now tests each part's km bounds before its path (the names it returns are unchanged). The landing: the load event at 0.39 s and the first draw ready at 0.76 s (0.61 and 0.80 on the step-1 copy). Screenshots in `build/r12-final` (the landing, the Firms view at Moscow with a red hover, the Cells view at Moscow, the light theme's landing and Firms view at 1,600 px) and `build/r12-final-phone` (390 by 844 with touch: a tap's tile, the Cells view). The publish set rebuilt by `tools/publish-set.py`: 163.8 MB over pages (2), scripts (6), data (18, `offwire.js` among them), 49 Moscow rasters, 24 national rasters and 12 address twins, both pages linking IBM Plex Mono from Google Fonts with the local family first; the read-only check runs inside the capture launcher and reported zero lines on every render. Both cuts rendered at 4 shards: the full cut 8,610 frames at 287.000 s in 306 s of capture, the teaser 1,380 frames at 46.000 s in 43 s, each matching `__videoMeta` under ffprobe; the text audits: the full cut at step 6 with 8 shards, 1,435 frames, 31,222 boxes, 22 findings, all `box-over-mark` and all the live box's counted lines (the same 22 as step 1), the teaser at step 3, 460 frames, 7,258 boxes, zero; the teaser identity test against the step-4 teaser differs as expected at frames 300, 700 and 1,300 (532,819, 788,640 and 197,887 pixels apart by `compare -metric AE`: the typeface, the stripes, the mark and the credits reach every frame), so the new teaser replaces the artifact's asset at publish time; the 720p copies 28.4 MB (the full cut, for the video host) and 5.3 MB (the teaser, under the 15 MB asset cap). The render tags: the MP4 muxer drops a generic `author` key, which step 3 had passed and recorded as present; found here, the tags are now `artist` (Armen G. Kaprelian), `copyright` (© 2026 Armen G. Kaprelian) and `comment` (by Armen G. Kaprelian; Who stays visible? (RFSD v3.1.0, CC BY 4.0)), set in `capture.py`'s `AUTHOR_TAGS`, applied to the two masters by a remux without re-encoding (the frames are the capture's bytes) and inherited by the 720p copies; a one-second smoke render confirms the tool writes them. Review frames in `build/r12-render-review` (the hook, the national bloom at 5,778, the cohorts at 8,130, the credits at 8,460 and 8,550 with the name line and the whole-drawn mark). Committed as the round's final commit on the author's word the same day, then published: the explainer artifact v24 (the page, the five scripts and the twelve data files) and v25 (the 49 Moscow and 24 national rasters), the new teaser 720p uploaded as the asset `/_blob/221e92f4dc668c3f67425f354a3ce31a` and linked from the page (`publish-set.py` anchors the video note before the footer now, where round 10 moved the caption; the old asset `bc8d1728…` deleted); the atlas artifact v21 (the page, the four scripts and the twelve data files, `offwire.js` among them), v22 and v23 (the address twins, six per upload); v24 (25 October, after the author's device check: the page and `js/explorer-app.js` with the canvas-measured minimap, the rewritten Under the cursor panel, the header order and the wide-screen column); v25 (25 October, round 11: the page, `js/explorer-app.js`, `js/map-layers.js` and `data/basemap.js`), with the explainer artifact's v26 (its page with the shared header, `js/map-layers.js` and `data/basemap.js`; its renders and assets unchanged); v26 (25 October, round 12: the ghost names, the page and `js/explorer-app.js`); v27 (25 October, the ghost names' final colour, the page and `js/explorer-app.js`). The atlas opened on the host in the lab's browser pane with its title, the mix box and the graticule drawn and no error of its own (the host's account call answers 403 in the pane); the explainer is private and the pane is not signed in, so its load on the host is the author's check.

### After the publish: the author's device check (25 October 2026)

The author opened the published atlas in Brave on a laptop whose viewport is about 2,520 CSS px wide and sent two screenshots with three findings. Fixed the same day and, on the author's word, published as atlas v24 (the page and `js/explorer-app.js`, the only files that change).

**The GO TO minimap: label boxes collapsed on the host.** The screenshot showed every label box 8 px wide, the names spilling to the right and the outline pushed into the right of the card ("not properly centred, and tiny"). `buildMinimap` measured each label with the SVG's own `getComputedTextLength()`, which answers 0 for text that has not been laid out; the published page is built while the host still holds the frame hidden (the lab's headless browser and the desktop app's pane lay it out at once, so neither showed it). The widths now come from the canvas, `Motion.measure(mctx, label, 9, 500, 9 × 0.08)`, the same font stack with the tracking counted after every glyph as the SVG lays it: checked against the rendered advance on all 23 labels, the two agree within 0.12 px and give the same integer box width after the 4 px padding, so the layout table and its rules are unchanged. `verifyMinimap()` compares the rendered labels against the built widths whenever the page is resized or `document.fonts` reports a load (`loadingdone`) and rebuilds the minimap, at most twice, if any label differs by more than 0.75 px (a late webfont); it does nothing while the minimap is hidden. The audit's minimap state asserts one build and no rebuild on a verify (`builds`, `rebuilt` in `__atlas.minimap()` and `__atlas.minimapVerify()`).

**The side column on wide screens.** At 2,520 px the 400 px column held the minimap at 374 px and every card at the phone's width. The column is now `clamp(400px, 20vw, 520px)`: 400 px at every audited width up to 2,000 px (unchanged there), a fifth of the viewport beyond (504 px at the author's width, 512 at 2,560, 520 from 2,600), the minimap and the charts scaling with it (the SVG keeps its viewBox, so the 9 px labels grow with the card). An extra audit run at 2,560 by 1,400 px on both renderers (outside the five-width acceptance set, which is unchanged): 191 states, 8,747 boxes, zero findings, after one check of the listed-mark rule was relaxed: it had asserted the quiet weight above zero at the Central Moscow preset, and on a 1,400 px tall screen that preset's k passes 60, where the weight's own formula ends at zero; the check now asserts the ordering down to zero and the formula itself as before.

**UNDER THE CURSOR, rewritten as short rows.** The second screenshot (the industry layer, Khabarovsk Krai) showed a right-aligned value column wrapping the full NACE title over four lines, the class name over two, the ranked mix as a 124 px grid and the provenance paragraph under the chart, so the chart was out of reach. The panel now has one tracked-capital label per row (at most 16 characters) with the value at the left, wrapping inside the card and never right-aligned; the rows per layer: REGION and CELL first, then on the share layer FIRMS, the year's STATEMENT with its share (or "share not shown under 50 firms") and SANCTIONS when the cell has members; on the change layer 2021, 2024 and CHANGE in points; COHORT; on the lists layer FIRMS, SANCTIONS and GOV STRATEGIC ("under 5 or none" where suppressed); on the fin layer OBSERVED and MEDIAN REVENUE; on the density grids FIRMS and the statement; on the industry layer WITH REVENUE, LEADING as a class swatch, the short division name, the code and the share with the class name beneath, four ranked swatch rows after the leader (the divisions past them folded into "other divisions", so the remainder is exact) and LISTED (TREATED) with the share of revenue held by firms on the lists. In the Firms view: COORDINATE PAIR, the year's STATEMENT, BASELINE and MEDIAN CHANGE on the fin layer, LEADING on the industry layer, LISTED (TREATED) with the count and the radius, then each named firm as one line (the glyph, the display name, the listing year at the right), the filed name beneath where it differs, the shared-name note, and one muted line joining the statement state, the list memberships and the latest revenue; "and k more"; the chart's 100 km CELL last. The cell-series provenance moved into the METHOD block under the layer's provenance (`#cellprov`, hidden with the clamp). The chart note for an industry 1 km cell no longer says "no located firms" when the hit carries a revenue count. The labels keep the panel's CAPS rule; `#cellinfo b` joined the overflow list of `domBoxes()`; the audit gains a `panel<layer>` state on every layer at the country (a hover on the cell 300 km east and 100 km north of Moscow) and `panelind1km` at Moscow, each asserting the rows at most 300 px tall (`PANEL_H`), at most nine labelled rows, no label over 16 characters and the chart within 420 px of the card's top; the names state asserts the listed detail at most 560 px (`PANEL_H_LISTED`). Measured: the industry rows 243 px at 1,600 and 400 px and 209 at 2,560 (the mix bounded at four rows), the share, change and lists rows 103, the fin rows 118, the cohort and density rows 60, the 1 km industry rows 206; the listed detail with three named firms 394 px at 1,600, 539 at 400 and 329 at 2,560.

**The header.** The byline's two lines now sit right-aligned beside the theme button, which is the last element at the header's right edge (the audit's header rule asserts the button past the byline and at the row's edge above 900 px). Nothing was added at the centre: the row stays one quiet 44 px band with the title at the left, and the map's top edge already carries the revenue mix and the note. Not changed: the explainer page's header (no theme button there).

**Checks.** The atlas audit at 400 and 1,600 px on both renderers with the new states: 389 states, 14,758 boxes, zero findings. The full audit at 400, 768, 1,200, 1,600 and 2,000 px on both renderers: 962 states, 38,306 boxes, zero findings (the tiles placed over the note or the legend for want of a clear place: 16, all at 400 and 768 px as before). Frames in `build/r14-fixes/` (the GO TO card in both themes, the header, the panel on six layers and with named listed firms at 1,600 px; the landing, the header, the GO TO card and the panel at 2,560 by 1,400). The publish set rebuilt (163.8 MB, the same files).

### Round 11 (25 October 2026): the additive field, quieter national marks, firms in view, a zoom floor past the fit, a continuous wire, load-time guards, the header lock-up

The author's eight items, atlas only, taken without plan mode; the publish waits for the author's word. The "before" copy for the frames and the costs is the committed round-10 state (743304e) served on port 8766 with the working tree's data; the "after" the working tree on 8765.

**Item 1, additive accumulation.** Below k 1.5 the address blocks no longer composite "over" (where four overlapping single-firm marks already reach 0.85 and every pixel of European Russia saturates); they accumulate. On WebGL the block pass draws into a float render target with additive blending (RGBA32F where `EXT_color_buffer_float` is renderable, RGBA16F or the WebGL1 float extensions otherwise; without any float target the page takes the 2D path), each mark adding its colour times its firm count and the count itself in alpha; a second pass draws the texture through a tone curve: alpha 0.5 for one firm, rising by the log of the count to 1 at S_MAX, the colour the count-weighted mean of the marks' own colours (the layer's palette, so share, revenue, industry and the neutral keep their meaning). S_MAX is the densest pixel's firm count of the year at the fitted zoom, measured once per year and stage size under the block rule (2024 at 1,600 by 1,000: 312,954 firms in one 5.5 km pixel of central Moscow; over the 23,933 lit pixels the median holds 5 firms, the 75th percentile 26, the 90th 160, the 99th 6,241, the 99.9th 61,143), scaled by the pixel's area at other zooms (max 100), so the densest pixel alone reaches full strength and Moscow keeps its gradient. Between k 1.5 and 3 the additive image fades out at weight 1 − u under the "over" image fading in at weight u (the mark colours scaled by u in the shader), so individual marks take over by k 3; from 20 px per km the discs as before. The 2D fallback accumulates in a Float32Array beside the "over" bytes and applies the same curve and mix per pixel. The listed marks, the rim and the pulse are drawn on the marks canvas as before. `__atlas.fieldRegime()` reports the weights and the float format, `__atlas.fieldStats()` the per-pixel count percentiles. Frame cost at 1,600 px (software rendering, `cost5.py`, 20 frames): firms/share at Russia 3.25 ms mean (max 3.5) before, 3.23 (3.6) after; at Moscow 1.21 (4.1) before, 1.15 (1.3) after; at Central Moscow 1.62 (2.3) and 1.60 (1.8); the hover (four runs of `hoverCost(30)` on each copy) 0.75 to 0.80 ms at Russia and 0.41 to 0.42 at Moscow on both. Frames in `build/r15-field/` (before and after: Russia 2024 on the share and industry layers with 3x Moscow crops; Siberia at k 0.5 and 1.0 with the glow at 6 percent and at 0).

**Item 2, the resting listed marks at the national zoom.** `MM.listedRule` gains a national extra q2 that runs from 0 at the city zoom to 1 at the country, through the existing weight: the resting alpha 1 − 0.2q − 0.2q2 (0.60 at the country, from 0.80) and the radius floor 1.5(1 − 0.35q − q2/12) px (0.85 at the country, from 0.975); the cap, the halo, the rim and the pulse are untouched. The city zoom is the city preset's own k at the stage's size (`MM.listedCityK`, set with the canvases: 9.3 at 1,600 by 1,000, 5.9 at 768, 3.9 on a 400 px phone), so at the Moscow preset q2 is exactly 0 at every width and from there up nothing changes (a fixed k 10 was tried first and left q2 at 0.32 on the phone's city window). The extra is switched on by `MM.listedQuiet = 1` in the atlas only; the video keeps round 8's rule and its renders are unchanged.

**Item 3, firms in view.** The tile's footer carries "N firms in view" on its own line under the coordinate and the scale, in the Firms view only: the firms on no list at the addresses inside the visible range (the sorted x column cut by binary search, the y range tested) plus the listed firms present in the year, counted once per settle (the end of a flight, a wheel or drag settle, a year's data arriving, a view switch) by `countFirmsInView()`, never per frame, and ticking with the other footer figures when the camera moves under a still cursor. At the country in 2021 the count is 3,082,627 (the manifest's 3,078,593 firms on no list plus the 4,034 listed firms present), at the Moscow preset 744,377; the audit asserts the national equality and the footer's presence (`inview`, `inviewcity`). The line makes the tile 16 px taller, and on a 400 px map with the industry mix open the tile then had no clear place: the placement's last tiers may now cover the mix box as they cover the legend and the note (the controls, the scale bar and the strip always stay clear; the audit's relaxed-placement count reports it).

**Item 5, the zoom floor.** The floor is three-quarters of the fitted zoom (`kFloor`); the fit button and the 0 key return exactly to the fit; the one-way re-centring band stays defined from the fit, so between the fit and the floor the centre is the country's; a wheel or button step that reaches the floor settles on the floor's own target (centred) and the minus button disables there; a zoom-in from the floor goes where the cursor is (the pull applies to zoom-out steps only). The audit's `band2` expectation moved to the floor's target; new states `floor0`, `floor1`, `floorfit`, `floorin2` and, in the Firms view on both renderers, `floorcover`, which asserts at the floor that the region tint's bitmap covers the projected national extent and the glow's bitmap covers it with the blur's margin to spare (`__atlas.firmsLayers().cover`; the bitmaps are sized to the extent, so beyond it there is sea and nothing to draw). The graticule: at the floor at 1,600 by 1,000 three of the meridians' 20 N ends had come into the bottom of the view, so M1 now runs the meridians from 10 N to the pole (81 vertices each) and adds the 10 N parallel (26 lines; `basemap.json` 659 kB; 16 of 16 checks; the video's national framing never reached the ends either way, so its renders stand). After the re-run no end is visible at the floor at 1,600 by 1,000, 768 by 1,024, 2,000 by 1,000 or 2,560 by 1,400; on a 1,200 by 1,000 window (a 754 by 837 map), on the phone (400 by 844) and on a portrait window (1,000 by 1,400) five, five and eight ends remain in view, because the view's half-diagonal at the floor there exceeds the distance of any southern end short of about 20 S; reported for the author's decision (a further extension costs vertices only). Frames `build/r15-frames/floor-1600.png`, `floor-firms-1600.png` and `floor-768.png`.

**Item 6, the wire scrolls on across context changes.** The track is a queue of cycles ("sets") scrolled by one linear Web Animations entry at 60 px per second from the current offset to the queue's end (`wireAnimate`), so nothing restarts on a change: a change of region (hover or camera), layer or view (`wireContextNow('append')`, the hover's 250 ms debounce kept) drops the sets that have not entered the view, keeps the visible one, and appends the new context's cycle, the lead first, after the last item kept; a set already carrying the new context is left as it is; the queue tops itself up with the next cycle of the current context 300 px before its end would enter the view (`wireTopUp`, the cat fact advancing by seven), and the sets that have passed the left edge leave the track with the offset reduced by their width (`wirePrune`). Only a year change rebuilds at once (`wireReset` under a crossfade: a frozen clone of the old track fades out over 0.3 s while the new track fades in). The pause under the pointer or focus, the pinned tip and the reduced-motion crossfade path are as before, driven from the animation instead of the CSS keyframes (gone, with `--wire-dur`). The separator is the mark at 14 px with 2 px strokes (`#mark-wire`, the symbol's strokes 3.43 units at 24) in the full context green. Measured at 1,600 px: the offset advances at 60.0 px per second and stays monotone across two hovers (Moscow Oblast, then Leningrad oblast: the second replaces the first's queued set and the visible set is untouched; a cycle is about 33,400 to 35,300 px); `__atlas.wire()` now reports the offset, the queue (each set's key, edges, whether it has entered the view, its lead) and the build and reset counts. The audit's `wirecross` state asserts all of it (the resets unchanged across the hovers, the queued set replaced, the offset monotone and moving, the new lead within one cycle plus the view, the year change resetting under the crossfade, the separator's size and colour); the `wire2021` to `wirereg2024` states still re-derive the current cycle item by item.

**Item 7, load-time measurements guarded.** `verifyLayouts(reason)` runs on every resize (now also from a ResizeObserver on the map wrap, so a frame shown without a window resize event counts) and after a font load: it verifies the minimap (25 October's guard), rebuilds the wire's queue when the visible width changed or any set measured zero (`wireContextNow('reset')`), drops the tile's obstacles and re-picks the strip's short form (`updateContext(true)`); `onResize` lands a stage that measured 1 px at load on the fit (or the link's preset) instead of scaling a degenerate zoom. `__atlas.layouts()` reports every load-time layout (the stage, the fitted zoom, the camera, the minimap's width and box widths, the wire's track, the strip's test, the obstacles, the last verifications). The audit's hidden-frame state loads the page once more at every width with the root hidden for 500 ms after DOMContentLoaded and shown without a resize event, waits, and asserts the layouts match the normal load's (the stage, the fitted zoom and the landing camera exactly, the minimap's width and box widths, the wire's visible width and track width within 2 px, the strip's test and the obstacle count, and that a verification ran after the frame was shown).

**Item 8, the header lock-up.** Three groups on one 44 px row that never touch: at the left the striped title with the tagline under it and no mark before it (the tagline at 11 px: 68 characters, 449 px); at the centre one lock-up, the project mark at the height of two text lines (32 px) with, left-aligned against it, the name and affiliation in the tracked small capitals (12 px) and the dissertation title in the muted tone (11 px) beneath, the group centred as a unit on the header's width (a grid of two equal outer columns, `minmax(0, 1fr) auto minmax(0, 1fr)`); at the right the theme button at the edge. Below 1,600 px (not 1,400: at 1,600 the outer columns are 464 px beside the 603 px lock-up, and a two-line lock-up needs 1,569 px for the tagline to fit) the lock-up drops the affiliation to a third line and lets the title wrap at 400 px; at 900 px and below it stacks under the title, left-aligned, the theme button at the right of the title row. The explainer page takes the same header with its own title and an empty right group. The three groups join `domBoxes().header` and the DOM rules: pairwise no overlap, each inside the header, the lock-up centred on the header within 1.5 px above 900 px; `CAPS_JS` reads the lock-up's mark in place of the title's. Frames `build/r15-frames/header-1600.png` and `header-2560.png` (also 1,200, 768 and 400).

**Checks.** The atlas audit at 400, 768, 1,200, 1,600 and 2,000 px on both renderers with the new states (the floor, the bitmap cover, the field's regimes, the firms in view, the wire across two regions, the header's groups, the hidden-frame load at every width): 1,051 states, 42,001 boxes, zero findings (the tiles placed over a readout for want of a clear place: 30, all at 400 and 768 px, five of them over the mix box at 400 px); at 2,560 by 1,400: 209 states, 9,629 boxes, zero. A first run had found 19 findings in two checks of this round's own making, both corrected before the clean run: the national extra's city zoom had been pinned at k 10, above the phone's city window, and the taller tile had no clear place on a 400 px map with the industry mix open. The explainer audit: zero findings. The hover cost and the frame costs above. The data: M1 re-run only (the graticule); every other file unchanged. The publish set rebuilt (`basemap.js` among the twins); published on the author's word as atlas v25 and explainer v26 and committed the same day.

### Round 12 (25 October 2026): the design document, the audit against it, the ghost names

Three parts in the author's order; the first two prose and read-only, the third code; published on the author's word as atlas v26 (the page and `js/explorer-app.js`) and committed the same day.

**Part A, the design document.** `design/principles.md`, "Armen G. Kaprelian: design preferences and principles", written from the plan file, the round sections of this README, the lab's decision log, the memory and the author's checkpoint corrections: a one-page summary, then identity, colour, motion, text, layout, data honesty and the rejected options, every principle paired with the decision that produced it and, where one exists, the option rejected and why (about 4,500 words). One entry the author's list names, the news feed, has no record of its own in the lab's files; the document records the principle it would break and leaves the entry for the author to complete. A memory file points to the document.

**Part B, the audit against it.** `design/2026-10-26-audit-against-principles.md`: both pages and the video's panels read against the document; seven departures, ordered by visibility, each with the principle, the file and line and a one-line fix: semicolons in five wire facts and the fine-cell tooltip; Aeroflot's anchor amber beside the diverging pair's amber in the Moscow section; the comparison element's medians and bands in a muted teal from round 3; the explainer's links in the ramp's accent; the credits' "Supplied lists" (the recorded exception); the minimap's 9 px labels (the recorded deviation); the cat prefix's stylesheet rule naming a token that no longer exists (on screen it is already the full green). Checked and clean: corners, effects, gradients, weights, em-dashes, the forbidden words, the video's panels, the explainer's control labels, the accents' roles. Nothing fixed; the author picks.

**Part C, the ghost names.** Sizes by a steeper weight on the 2021 located-firm count of each city's 1 km window: four anchors on the log of the count, linear between them, the smallest window 24 px, the third largest 30, St Petersburg 38, Moscow 44 (Moscow 762,760 firms, St Petersburg 262,429, Yekaterinburg 93,659, Murmansk 9,983 at the foot), so the other twenty lie on a gentle slope from 30 down to 24: Novosibirsk 30, Kazan, Nizhny Novgorod and Samara 29, Krasnodar to Vladivostok 28, Irkutsk to Kaliningrad 27, Khabarovsk and Volgograd 26. Round 10 had sized by rank alone (34 down to 26) and, a defect found on the way, sorted the cities by an object rather than its count, so the rank order was the data's own order; the sizes now follow the counts. The layout's smallest fallback size is 24. Colour, final (the author's correction the same day; published as atlas v27 on the author's word): the GO TO card's own ice token `--go` (#9CC8FF on the dark theme, #22364D on the light; read into the theme as `theme.go`, so the names and the card stay tied) at 30 percent, plainly there when looked for and back in the ground when not; the first build had used the cyan ramp's second step at 12 percent, which read as a cold tint verging toward transparent. The sizes, the layering, the fade with the zoom and the collision rule are unchanged; the hairline borders and the hand-over outline keep the ghost tone. The names under every data layer by the draw log in both views; the dots' contrast against the composite beneath them at the Russia preset with the two layers on keeps 0.82 of the value with them off (the floor 0.80), the names present in both; the grain guard's ink, muted and dim figures unchanged. The atlas audit at the five widths on both renderers with the final colour: 1,051 states, 42,571 boxes, zero findings; the grain guard at 1,600 px reports the card's ink, muted and dim figures at 12.03, 7.58 and 3.91 against 12.06, 7.60 and 3.92 plain and the legend's at 16.42, 10.35 and 5.34 against 16.43, 10.36 and 5.34, within its 0.05 tolerance. Layering confirmed by the page's draw log: land, the region tint and the glow (through `afterLand`), the graticule and borders, the authorship mark, the ghost names, then every data layer in both views (`basemap, mark, ghost, industry` and `basemap, mark, ghost, firms`). The ghost states at the Russia preset draw 2 names at 400 px, 6 at 768, 8 at 1,200, 14 at 1,600 and 17 at 2,000 (the floors 1, 5 and 12 hold), none at the Moscow preset; a name never draws over the authorship mark's 96 px box at the map's lower edge (at 30 percent it would hide the 4 percent mark, and the audit's pixel test of the mark at 768 px found one there). The atlas audit at the five widths on both renderers with the new names: 1,051 states, 42,743 boxes, zero findings (the ghost floors, the ghost-overlap rule and the collision pass included; the tiles placed over a readout for want of a clear place: 30, as in round 11). Frames in `build/r16-ghost/` (Russia 2024 in both views with 3x crops over European Russia, and the light theme).

### Round 12, part D (25 October 2026): the wire's two-set queue and a capitals experiment, the ghost names floating

Two changes before the Part B fixes; the publish waits for the author's word.

**The wire's queue and priorities.** At most two sets exist at any time: the committed set playing on the track and one pending set. A change of region, layer or view replaces the pending set, never the committed one, and the replaced set's items leave the track at once (no growing list; a change clears the timer of the set it replaces). A pending set is committed once the cursor has rested on its region for 600 ms (counted from the change, so the 250 ms hover debounce lies inside it) or the camera has settled there (`afterCameraMove` marks its context update as settled); after that a later change queues behind it, and a pending set whose items have entered the view counts as committed. Priority: the playing set keeps its items up to and including the first tip or cat fact past the visible ones, so a tip or a cat due in the current cycle plays before the pending set takes over; tips keep their slot at every fifth position and the cat fact its keyed slot, both deterministic. The items of a superseded set that are still crossing the view stay as orphans until they pass; the track's end is topped up with the committed context's next cycle only when no pending set waits. The lead fact of the region under the cursor shows at once in the strip's first slot: a lead zone before the scrolling track (at most 46 percent of the strip, the full width under reduced motion) holds round 9's two stacked spans, which crossfade and take the short form when the full one would clip, with the separator mark between the lead and the track. Measured at 1,600 px: the lead changes within 40 ms of a hover; a pending set sits after five kept items (the lead slot's cycle up to its first tip); a 600 ms rest commits it; fifty hover changes at 100 ms leave one set, no pending set, 55 items on the track, five orphans, no stray timer and a heap 3.5 MB larger (the garbage collector's own schedule), the offset monotone throughout. `__atlas.wire()` reports the sets with their status, edges, entry and lead, the orphans, the item count, the timers, the heap and the lead slot's text; the audit's `wirequeue` state asserts all of it (the lead at once, the pending set and its cut, the commit after the rest, at most one pending set and two sets after fifty hovers, the track under 115 items, no timer left, the heap under 24 MB, the capitals switch), beside `wirecross`.

**The capitals experiment.** `WIRE_CAPS` (default on; `__atlas.wireCaps(on)`) sets every wire item and the lead in tracked capitals (Plex Mono 500, 8 percent), except the cat facts, which keep their colour and sentence form, and the firm names, which stay as filed (wrapped in a `.nm` span inside their item). Frames of both states in `build/r17-partd/` (`wire-on-*`, `wire-off-*` at the lead, a named firm and the cat fact; `wide-wire-*` at 2,560 px); the author decides whether the capitals stay.

**The ghost names, floating.** Each name keeps its pixel size at every zoom, anchored to its city's screen position, with no fade and no scaling, so a zoom into Moscow brings the letters to float over the city at the size they have at the country view; the collision pass runs per zoom bucket as before; a name is clipped at the map's edge rather than dropped. Layer: above the cells, the dots and the listed marks, below the pulse rings, the hover ring, the crosshair, the tile and the panels: on the map canvas after the cells layers and before the small labels, on the marks canvas after the marks and before the pulse rings in the Firms view (the rings are drawn in a pass of their own while a pulse runs); no new canvas, 22 text calls at most. Colour and opacity as v27 (the GO TO token at 30 percent); the hairline borders keep their fade and the mark clearance stands. The draw log reads basemap, mark, the layer, ghost in both views; at the Russia preset 17 names draw at 1,600 px (the clipped ones included), one at the Moscow and Central Moscow presets in both views. Frame cost at 1,600 px in the Firms view 2.67 ms mean at Russia and 1.47 at Moscow. The audit's ghost states: the floors at the country, at least one name at the Moscow and Central Moscow presets in both views, the colour equal to the GO TO token, the draw order with the names after the layers, ghost boxes exempt from the off-canvas rule and from the overlap rule against other text, never from the rule against each other. Frames in `build/r17-partd/` (Russia, Moscow and Central Moscow in both views). The atlas audit's seventh run of 25 October, after every change of the day (the lead slot, the tips, the queue timing, the zoom row and the ruler, the eggs, the separator's clearances): 1,113 states and 45,861 boxes at 400, 768, 1,200, 1,600 and 2,000 px on both renderers with zero findings, the grain guard within 0.03 (card ink 12.03 to 12.06, legend ink 16.42 to 16.43), 32 tiles placed over the note or the legend for want of a clear place at 400 to 1,200 px as before; the explainer audit zero findings at 1,600 by 1,000 and 400 by 844 with the console check. Published on the author's word on 25 October 2026 from commit e5d521c: atlas v28 (explorer.html, js/explorer-app.js and data/anchors.js, new to the atlas's set) and explainer v27 (explainer.html; the shared scripts unchanged since v26). The runs before it: 40 findings (the lead slot and the queue timing), 11 (the stub, the hidden-frame form, the phone-width wire state), 2, 13 (the ruler's half-kilometre labels, the settled hover's effect on the queue states), 0, then the row and the separator changes and the clean run.

**The lead slot and the phone (the audit's findings of 25 October, fixed the same day).** The first run of the five-width audit on part D reported forty findings in four groups, all from the lead slot: a content-sized slot of at most 46 percent clipped the facts at 1,200 px and below, the hidden-frame load measured a different window width from the normal load (the slot took the width of whichever text its two stacked spans held), the reduced-motion tips measured for the first time in the slot they show in (the round-10 measure read a hidden span and was vacuous) ran 2 to 22 px past the slot at 768 and 1,200 px in tracked capitals and wrapped to three lines on a phone, and the two-hover state found the first pending set committed before the second hover, because the 600 ms rest was counted through the 250 ms debounce. The rules now: the lead slot is a fixed share of the strip, two thirds at most 680 px (`flex: 0 0 min(680px, 64%)`), so the window's width never follows the lead's text, the scroll never jumps and the layout guard sees one width per map width; a fact that fits neither the full nor the short form in the slot takes an ellipsis (long region names at 1,200 px and below; the wire's lead item carries the full form). A phone-width map (under 600 px) has no slot: the lead rides the wire, and every context change there rebuilds the track under the 0.3 s crossfade as a year change does, so the lead shows at once at the window's left edge (the priority rule and the pending set apply where the slot exists). The reduced-motion form on a phone-width map is two lines of 13 px in a 58 px strip (`rm2`, the lift 58 px), its tips in sentence case; the two longest tips were shortened to 68 characters ("Open the atlas at a city: add its name to the link, as in #Moscow." and "Map focused: + and − zoom, 0 fits the country, the arrows pan."), so every tip fits the reduced-motion slot at 768 px in capitals (638 px of 654) and two lines on a phone. The queue: a region change clears the pending set's commit timer at once, and a hover back onto the pending region re-arms the rest from that change (`wireArmCommit`). The second run's eleven findings (the collapsed strip's stub meeting the widened zoom box, the hidden-frame load keeping the strip's narrow form, and the phone-width wire state) led to the stub's new offsets and to `onResize` applying the strip's and the mix box's forms itself (the frame's show fires no resize event). The third run's one finding, the phone-width wire state, traced a real slip: with a pointer left on the map, a camera settle's hover refresh updated the context before the settled flag was set, so the rebuild waited for the 250 ms debounce; `afterCameraMove` now sets the flag before the hover refresh. A sixth run reported zero findings at 1,113 states and 45,861 boxes.

**The separator's clearances (the author's report of 25 October).** In the 1,600 px strip frame the lead separator's mark sat 4 px from a glyph clipped at the window's edge and read as covering it. The lead separator now carries 12 px (0.86 em) on both sides, the window's edges fade over 14 px (a CSS mask), so a glyph scrolling out leaves softly instead of being cut beside the mark, and the track's own separators keep the 12 px of padding each item carries. `__atlas.wireGaps()` measures the smallest gap between a mark and the glyphs beside it (an item's text extent, not its padded box), the lead separator's two margins, the fade and any item box under a mark; the wire states at every width assert at least 0.6 em, no covered box and the fade. The probe found a second slip: the slot's rules had matched the wire's own lead items (they carry the class too), so on a phone-width map the lead items had vanished with the slot; the rules now reach the slot alone. Probed before the re-run: at 1,600, 1,200, 768 and 400 px no fact clips, no tip clips, the second hover replaces the pending set with the committed set untouched and the commit follows the rest.

**The zoom row and the ruler (the author's device check and request of 25 October).** The author first asked for the zoom column as wide as the scale bar (both went to 100 px), then for a larger and more visible scale that stays exact, offering a horizontal zoom row with a fixed-width ruler above it. Built that way on maps of 600 px and wider: the three zoom buttons in a 220 px row at the lower right (the + and − buttons 40 px wide, 40 px tall, 44 on coarse pointers; the fit button takes the rest and shows beside its icon the zoom as a factor of the country view, ×1.0 at the fit, ×0.75 at the floor, ×68 at the Moscow preset and ×323 at Central Moscow on a 1,600 by 1,000 window, the author's note of 25 October having asked for something to fill the width, a percentage or something thematic), and above it a box of the same width holding a ruler drawn as an inline SVG: a line of fixed length (the box's content less 15 px at each end, so the end numbers stay inside; 170 px in the 220 px boxes of the author's third note, which asked for a wider ruler with the row matched to it), major ticks at a 1-2-5 step in kilometres that follows the zoom (the smallest step that puts the majors at least 14 px apart), a minor tick at every half step, the numbers under the majors in 12 px tabular figures of the ink (on every major, or every second or third where the widest number would not fit), and the unit at the top right in the muted tone (metres under a kilometre's step, kilometres once the numbered step reaches one). Every tick sits at the pad plus i times the step times the zoom in CSS pixels, so the ruler is exact at every zoom; it redraws on every settled draw and wheel step, never on a flight frame. At 1,600 px the ruler reads 0 to 1,200 km in 200 km majors at the country (numbered 0, 400, 800, 1,200: the widest number is wider than a 27 px step, so every second major carries one), 0 to 18 km in 2 km majors at the Moscow preset, every one numbered, and 0 to 3 km in 500 m majors at Central Moscow (numbered 0, 1, 2, 3 km). A phone-width map keeps the vertical column (100 px) with the ruler above it at 100 px (0 and 1,000 km at the country, 0, 5, 10 km at Moscow), and its collapsed strip stub moves above the ruler, clear of the legend. The legend's clearance on wide maps is 256 px (12, the boxes, 12, 12), the collapsed strip's stub sits left of the zoom row at 244 px, and the audit's `ruler` state asserts the step, the tick positions, the numbering rule, the values and every label inside the box and clear of its neighbours at the three presets and the floor.

**The share link (the author's report of 25 October).** The round-10 atlas footer quoted the `encodeURIComponent` call into the intent address, so the composer opened with the code as its text. Both pages now send the intent's three fields separately: `text`, `url` and `via=ArmenKaprelian`.

**Minimap tooltips, an easter egg (item 3).** Each of the 22 city groups and the RUSSIA frame carries an SVG `<title>` (the browser's own tooltip after its usual delay), and every preset button, the phone's list included, the same fact as its `title` attribute; the facts live in `MM_FACTS` in `js/explorer-app.js`, keyed by preset label. Each is one or two sentences, at most 200 characters (the longest 186), neutral, nothing about living persons or current politics, no semicolon or dash, and verified on 25 October 2026 against the references below (never on screen). The audit's `minimap` state asserts a title on all 24 presets, the group's title equal to the button's, the length and punctuation rules.

| Place | Fact on the tooltip | Reference |
|---|---|---|
| Russia | Russia and the United States lie 3.8 km apart at the Diomede Islands in the Bering Strait. The date line runs between them, so the Russian island is almost a day ahead. | https://en.wikipedia.org/wiki/Diomede_Islands |
| Moscow | From 1680 to the late 19th century the Kremlin's walls were kept whitewashed with lime. The red brick showed again only after the coats were left to wear away, by the early 1900s. | https://www.vedomosti.ru/gorod/culturalcity/articles/istoriya-odnogo-zdaniya-moskovskii-kreml (the whitewash from 1680, the red returning as the coats were not renewed from the late 19th century, the traces gone in the early 20th); https://www.gw2ru.com/lifestyle/3300-secret-kremlins-walls |
| St Petersburg | In April 1942, with the paintings evacuated to the Urals, a Hermitage guide led visiting cadets through the halls and described the pictures by their empty frames. | https://www.culture.ru/news/258662/ermitazh-predstavlyaet-memorialno-vystavochnyi-proekt-ermitazh-v-gody-voiny-1941-1945 (Pavel Gubchevsky's own account of the April 1942 tour for cadets); the evacuation to Sverdlovsk: https://scholarlycommons.obu.edu/honors_theses/89 |
| Novosibirsk | Novosibirsk began in 1893 as a camp for the Trans-Siberian bridge over the Ob and passed one million inhabitants in 1962, 69 years after its founding. | https://54.rosstat.gov.ru/storage/mediabank/130%20лет%20Новосибирску%20.pdf (Novosibirskstat, the 1893 founding and the million in 1962); https://en.wikipedia.org/wiki/Novosibirsk |
| Vladivostok | Vladivostok lies at 43° north, a little south of Sochi, yet its January mean is about −12 °C against Sochi's +6 °C. | https://ds.data.jma.go.jp/tcc/tcc/products/climate/normal/parts/NrmMonth_e.php?stn=31960 (JMA normals, Vladivostok 43.12° N, January −11.9 °C); https://en.wikipedia.org/wiki/Climate_of_Sochi (January daily mean 6.3 °C, 1991 to 2020); https://en.wikipedia.org/wiki/Sochi (43°35′ N) |
| Yekaterinburg | Yekaterinburg, founded in 1723 as an ironworks on the Iset, is named for Catherine I, the wife of Peter the Great, not for Catherine the Great. | https://www.themoscowtimes.com/2018/06/01/a-short-history-of-yekaterinburg-a61739 |
| Kazan | Nikolai Lobachevsky, a founder of non-Euclidean geometry, was rector of Kazan University for 19 years, from 1827 to 1846. | https://mathshistory.st-andrews.ac.uk/Biographies/Lobachevsky/ |
| Nizhny Novgorod | A 19th-century saying made St Petersburg Russia's head, Moscow its heart and Nizhny Novgorod its purse, after the summer fair that drew traders from Europe and Asia until 1929. | https://en.wikipedia.org/wiki/Nizhny_Novgorod_Fair (the saying, the fair's end in 1929); https://scalar.fas.harvard.edu/imperiia/a-fair-place-for-industry |
| Krasnodar | Until December 1920 the city was Yekaterinodar, Catherine's gift. Its new name reads two ways: krasny means red, and in older Russian beautiful. | https://en.wikipedia.org/wiki/Krasnodar |
| Kaliningrad | Immanuel Kant lived his whole life in Königsberg, today's Kaliningrad, and is said never to have travelled far from it. His tomb stands by the cathedral on Kant Island, the old Kneiphof. | https://en.wikipedia.org/wiki/K%C3%B6nigsberg_Cathedral |
| Rostov-on-Don | Until 1928 Rostov had a twin city a wheat field away: Nakhichevan-on-Don, founded in 1779 by Armenians resettled from Crimea, which became one of Rostov's districts. | https://en.wikipedia.org/wiki/Nakhichevan-on-Don; https://en.wikipedia.org/wiki/Rostov-on-Don (the field of wheat between the two) |
| Samara | In October 1941 Samara, then Kuybyshev, became the Soviet Union's reserve capital: the foreign embassies moved there from Moscow and stayed until 1943. | https://journals.ssau.ru/hpp/article/view/5177; https://soviethistory.msu.edu/1943/wartime-evacuation/wartime-evacuation-texts/stalins-order-to-evacuate/ (the State Defense Committee's resolution of 15 October 1941 on the missions) |
| Chelyabinsk | On 15 February 2013 an asteroid of about 17 to 20 m across exploded high above Chelyabinsk with the energy of some 500 kilotons, the largest such event recorded since Tunguska in 1908. | https://www.cambridge.org/core/journals/proceedings-of-the-international-astronomical-union/article/chelyabinsk-event/8B9AF6EF233C58B2430540CB4EF79114 (about 19 m, the largest confirmed impactor since Tunguska); https://space.com/19838-russian-meteor-blast-bigger-size.html (NASA's 17 m and nearly 500 kilotons) |
| Omsk | Fyodor Dostoevsky served four years of hard labour in the Omsk fortress, from January 1850 to early 1854. Notes from a Dead House grew out of them. | https://en.wikipedia.org/wiki/The_House_of_the_Dead_(novel) |
| Ufa | From 1789 Ufa housed the Orenburg Muslim Spiritual Assembly, the Russian Empire's central body for its Muslim subjects, created by a decree of Catherine II in 1788. | https://en.wikipedia.org/wiki/Orenburg_Muslim_Spiritual_Assembly (the decree of 22 September 1788, the opening in Ufa on 4 December 1789) |
| Perm | The Permian period of the geological timescale takes its name from here: Roderick Murchison named it in 1841 after the strata he studied in the Perm region. | https://en.wikipedia.org/wiki/Permian |
| Voronezh | Russia's first regular navy was built at Voronezh: from the winter of 1695 Peter I's shipyards on the river sent galleys and warships down to the Don for the capture of Azov in 1696. | https://rusmania.com/central/voronezh-region/voronezh/history; https://en.wikipedia.org/wiki/List_of_ships_of_the_line_of_Russia |
| Volgograd | The Motherland Calls on Mamayev Kurgan, completed in 1967, rises 85 m to the tip of its sword and was then the tallest statue in the world. | https://en.wikipedia.org/wiki/The_Motherland_Calls |
| Krasnoyarsk | Lavr Proskuryakov's railway bridge over the Yenisei at Krasnoyarsk, opened in 1899, won a gold medal at the 1900 Paris Exposition for its truss design. | https://en.wikipedia.org/wiki/Krasnoyarsk_Bridge; https://mirtr.elpub.ru/jour/article/download/1173/3174 (Tikhonova 2017, the Great Gold Medal of 1900) |
| Irkutsk | Irkutsk stands on the Angara, the only river that flows out of Lake Baikal. Hundreds of streams flow in, and this one carries the lake's water on to the Yenisei. | https://en.wikipedia.org/wiki/Angara |
| Khabarovsk | Khabarovsk is the city on the 5,000-ruble note: the Muravyov-Amursky monument and the embankment on the front, the bridge over the Amur on the back. | https://www.cbr.ru/eng/cash_circulation/banknotes/5000rub/ |
| Murmansk | Murmansk was founded in October 1916 as Romanov-on-Murman, the last city founded in the Russian Empire, for a port that stays ice-free where Arkhangelsk freezes. | https://en.wikipedia.org/wiki/Murmansk; https://thebarentsobserver.com/arctic/happy-anniversary-murmansk/114637 |
| Tyumen | From July 1941 to the spring of 1945 Lenin's embalmed body was kept in Tyumen, in the building of the agricultural college, after a secret evacuation from Moscow. | https://en.wikipedia.org/wiki/Lenin%27s_Mausoleum; https://russianlife.com/stories/online/tyumen/lenin/ |
| Central Moscow | An eighth Stalin skyscraper was begun in Zaryadye in 1947 and abandoned. The Rossiya hotel rose on its foundations in 1967, and since 2017 the site has been a park. | https://en.wikipedia.org/wiki/Eighth_Sister; https://www.zaryadyepark.ru/en/history/the_history_of_the_eighth_stalin_skyscraper_in_zaryadye.html; https://en.wikipedia.org/wiki/Rossiya_Hotel |

**A console greeting (item 4).** Both pages log one message on load and nothing else: the project mark in ASCII, "Visibility Atlas · Armen G. Kaprelian" (the explainer says "Who stays visible? · Armen G. Kaprelian"), "Built from" the commit the publish set was built from, and github.com/ArmenKaprelian/whostaysvisible. The commit comes from a `<meta name="build">` in each page: the lab copies say "the working tree", and `tools/publish-set.py` writes `commit <12 hex>` into both published copies, adding "with uncommitted changes" when any shipped page, script, stylesheet or data file differs from the commit. So the set is built after the round's commit from then on (commit, build, publish, push), and the build line of the set's output records what it wrote. Both audits assert that the load logs exactly one message, the greeting, and that the CDP client saw no error, warning or exception.

**The pair (item 5).** In the Firms view, with the cursor within 35 m of either of the two firms the film follows (their coordinates from `data/anchors.js`, which the atlas now loads), the tile adds one line, "The two firms of the film, 57 m apart.", the distance the shipped `distance_m` field and equal to the one the coordinates give (57.5 m rounded). Nothing else about the pair is shown and the neighbour stays unnamed. Audit states at the Central Moscow preset on both renderers: a hover on the first firm's point and on the second's carry the line, a hover 100 m east of the first does not, and the tile never describes the neighbour.

**Anniversaries (item 6).** The wire's lead item carries one sentence on three kinds of day, built from the shipped files at load from the viewer's local date (`window.__today`, an ISO day, is the audit's hook): the anchor firm's listing date ("19 May: Aeroflot was listed on this day in 2022.", the label and the date from `anchors.a`), the resident list's decree ("22 January: the resident list rests on Government Decree No. 35, signed on this day in 2020.", the one date typed in), and every other day on which firms of the national list file were listed by a dated, non-inferred designation: one firm by its display name ("15 October: Lenpromtransproyekt, ZAO was listed on this day in 2020."), several by count and years ("24 February: 167 firms on the lists (treated) were listed on this day in 2022 and 2023."). Of the 366 days, 137 carry a dated listing of 2,109 firms; 212 carry none (every day of January but the 11th, the 22nd and the 26th among them) and show nothing. The sentence follows the lead fact in the wire's lead item, in the strip's slot the fact stays alone. `tools/wire_check.py` re-derives the sentence (`anniversary(D, iso)`) and takes the page's date (`today`) for the lead; the audit runs the page's builder on four fixed days against it (19 May, 22 January, 24 February, 1 January, the last empty) at every width, and at 400 and 1,600 px loads the page with the date pinned to 19 May and asserts the sentence at the end of the lead item and absent from the slot.

### Round 13: the binned Firms view, the comparison axis, the result style (the author's requests of 25 October 2026)

The author's three requests after part D, in `review/2026-10-25-round-13-design.md` before the build: a Firms view whose top level is a mosaic of binned tiles that refine with the zoom and hand over to the dots, insightful and in the atlas's design language, the two views made to match where they can; the comparison beat's y-axis trimmed in both directions on one paired scale; a go-to colour and format for the video's delivered figures, the existing anchor amber by the author's decision (no gold), the ink with its circle marker where an amber is already in the frame. Built on the `round-13` branch from part D's working state.

**The binned Firms view.** Below the dots zoom (k 20 px per km) the year's addresses are binned on the Cells view's own grids and drawn as gapped squares on the map canvas, under the listed marks and the pulse and over the region tint and the glow: 25 km squares at the country (the national 25 km grid), 1 km squares from k 1.5 (the city windows' grid, here everywhere), the dots from k 20; the hand-overs are crossfades (25 km to 1 km over k 1.5 to 2.5, as the Cells view's 1 km windows arrive; 1 km to the dots over k 20 to 28, the field canvas's opacity rising as the squares fade). The squares share the grids' origin (the km plane's), so a flip between the views at any zoom shows the same squares. Per square the pass keeps n firms, p coordinate pairs, a with a statement, f filers with a revenue-change class, the summed revenue by industry class (each address's revenue, 10^((rv − 1)/100), split by its mix shares) and the filers by class; the statistic per layer: share, a over n with the year breaks at 25 km (fifty firms for a colour, the below tone otherwise) and the window breaks at 1 km; density, n in the eight count classes at the count alphas; industry, the class with the largest revenue; revenue change, the filer-weighted median class, the zero slate without filers; the cell layers (change, cohort, lists), the count classes in the density colour. The hover names the square (its firms on no list at their coordinate pairs, with a statement, the leading division on the industry layer computed from the addresses inside it on hover, the median class on the revenue layer) in the tile, the panel and the mix box ("1 km square at the cursor"); the listed marks still win the hover. The legend names the level ("25 km squares"), the population ("firms on no list") and ends "Each square bins the firms on no list at the addresses inside it. Zoom in past 20 px per km for the dots." The population difference stands: the address file holds firms on no list at house- and street-level geocodes; the Cells view counts every located eligible firm. Drawing: squares of 6 px and more (and the 25 km level, 6,912 squares in 2024) are filled per frame inside the view, the bins sorted by column and the x-band cut by a binary search, grouped into one path per class; smaller squares (the 1 km level between k 1.5 and 6) are rendered once into a bitmap of the view with a margin of its own size and drawn through the nine-argument drawImage so a frame costs the view's area, rebuilt when the view leaves the margin or the zoom drifts past 40 percent. The binning pass runs once per year and level (92,883 1 km squares and 6,912 25 km squares in 2024, each level summing to the year's 2,884,476 firms on no list), cached with the year's addresses and dropped with them. Frame costs at 1,600 px on WebGL: 4.8 ms mean at the country (10.6 max), 7.5 in the crossfade at k 2.2, 4.7 at k 3, 1.8 at the Moscow preset, 2.4 at k 24, 2.2 at Central Moscow; the additive field of round 11 is no longer drawn below k 20 (the code stays for the discs path) and `fieldRegime()` reports the level. The audit's field states expect the level (25 at the country, 1 in the band and at the city preset, the dots' over field from Central Moscow, the crossfade at k 24), the `mosaic` states assert the level, the mode, the alphas, the field's opacity, the sums, the tile's and the legend's words and the cost at the five zooms on both renderers, the contrast check of round 10 is carried to the squares (`mosaicContrast`), and the mix box's address state moved to the dots zoom with a square state at Moscow. Frames in `build/r18-mosaic/`. The atlas audit's fourth run of 25 October (evening) with every change of the round in place: 1,202 states and 49,363 boxes at 400, 768, 1,200, 1,600 and 2,000 px on both renderers with zero findings, the grain guard within 0.05, 37 tiles placed over the note, the legend or the mix box for want of a clear place at 400 to 1,200 px. The runs before it: 24 findings on the mosaic alone (the 250 m preset under the hand-over at 400 px, the drawing-mode word fixed per state, the crossfade's cost at 2,000 px, the mix box's address state hitting a square), 30 after the evening's requests (eight cat facts joined with semicolons, the slot's width transition clipping its text for a moment, the chrome check expecting the card's neutral on RUSSIA, the two fade states aimed at k 24 whatever the map's band), 4 (the queue state reading the offset against a window whose left edge now moves with the slot), then zero. The explainer audit: zero findings at 1,600 by 1,000 and 400 by 844 with the console check.

**The comparison beat's y-axis.** Data-driven and paired: the lower bound the largest of 10, 15, 20, 25, 30, 40 and 50 at or below 0.9 times the smallest value drawn in either panel (a quartile or a firm's index), the upper bound the smallest of 150, 200, 250, 300, 400 and 500 at or above 1.1 times the largest, the ticks the members of 25, 50, 100, 200 and 400 inside it; 20 to 250 with the shipped data (10 to 500 before). On the author's note that the text under the plots looked squished, the plots lost 40 px of height (290 from 330), the two gap facts sit in their box with 24 px around them at a 1.45 line height, and the members line moved below the box.

**The result style.** `MM.resultBox` in `js/map-layers.js`: a panel in the stage colour at 0.7, the result colour at 10 percent over it and a 1 px border at 30 percent (the ink at 6 and 25 percent in the ink variant), squared, recorded as a panel for the text audit's panel-clip rule; `MM.ringMarker` draws the ink variant's ring before the figure. The colour is the anchor amber `--anchor-a` #F2B134 (`--result` in `css/theme.css` for the record), kept as it is by the author's decision; the gold search was stopped (the nearest gold to the amber, #F2C14E, sat 4.4 ΔE from it). Where: the archive's share of records with a statement (amber, the caption at 22 px to stay inside), the size scene's ratio of odds ratios with its interval (amber, the box sized from the four lines with 24 px all round, the title at 28 px), the change map's located shares (the ink with the marker: the declines on that map are amber), the comparison beat's gap facts (the ink: the anchor's amber line is on screen) and the Moscow close's count lines (the ink: the revenue classes around are amber), the close's panel starting 16 px above the box, as its left edge does, and the box's top near y 440 on the author's note. The text audit of the first round-13 render then found the close's last caveat line 4 px off the canvas (the cascade had moved down with the box); the author, shown the frame, called the cascade a wall of text, so three of the four items under the box (the metric's definition, the dating caveat with the inferred and undated counts, "Paths compared, no effect estimated.") left the screen on 25 October 2026 (evening); the St Petersburg comparison stays by the author's second word, compressed to an eyebrow and two figure lines ("ST PETERSBURG, 160 BY 90 KM, 2022 TO 2024", "Absence after listing: within 6 points of Moscow", "Usable baseline: 53 to 54%, Moscow 38 to 44%") 24 px under the box, the panel closing 16 px around both; the disclosures and the remaining multi-line blocks are listed in `review/2026-10-25-screen-text-notes.md` for the author's lectures and decisions. The lists scene prints no figure and keeps its table. Frames in `build/r18-results/`. Both cuts re-rendered on the branch at 4 shards from the working tree served on port 8768 (25 October 2026, evening, after every change of the round): the full cut 8,610 frames, 287.000 s, 1920 by 1080, 105.4 MB in 322 s, its 720p copy 28.2 MB; the teaser 1,380 frames, 46.000 s, 20.3 MB in 49 s, its 720p copy 5.3 MB. The text audits: the teaser zero findings over 460 frames (step 3) and 7,258 boxes; the full cut 1,435 frames (step 6), 30,522 boxes, 22 findings, every one a counted live-box-over-red-marks line of the Moscow runs (170 to 184 s), none else; the first full-cut audit of the evening had also reported the close's last caveat line 4 px off the canvas, which led to the close's rework above. The teaser identity test against the main tree's frames 300, 700 and 1,300: frame 300 differs on 3.6 percent of its pixels (the archive beat's result box reaches the teaser's opening), 700 and 1,300 are byte-identical; the new teaser is kept and its 720p copy replaces the asset at the publish. Published on the author's word on 25 October 2026 from commit bbd3319 (the round in dff73a4): atlas v29 (explorer.html, js/explorer-app.js, js/map-layers.js, js/charts.js, data/offwire.js) and explainer v28 (explainer.html, js/explainer-scenes.js, js/treated-scenes.js, js/map-layers.js, js/charts.js), the teaser's 720p copy uploaded as the asset c5240020b128598cd541799c0fb71eb8 (5,311,353 bytes) and linked from the page, the round-10 asset 221e92f4… deleted.

**The author's decisions and requests of 25 October 2026, evening (on the branch).** The dots stay at k 20 as built and no 250 m level is added. One adjustment for phones: a 400 px map's fine rung (the "Central Moscow (250 m)" preset, minSide / 20) lands at k 18.3, under the hand-over, so that preset showed 1 km squares there; the hand-over now starts at k 20 or at the fine rung divided by 1.4 where that is lower (`dotsK()`), the band keeping its 1.4 ratio (13.1 to 18.3 at 400 px, 20 to 28 on every map 768 px and wider), so the preset labelled 250 m always shows the dots. The 1 km level's bitmap takes half a view of margin on each side instead of a whole one, which keeps a 2,000 px map under the 4,096 px cap, and a blit at the device's own resolution copies without filtering, aligned to device pixels; the crossfade band at 2,000 px costs 1.3 to 2.0 ms a frame (10.5 before, 1.7 without the squares). The audit's drawing-mode expectation follows the page's rule (direct paths at 6 px per square or 20,000 squares or fewer, else the bitmap) instead of a fixed word per state.

Part B of round 12, by the author's picks: (1) no semicolon on screen, the five wire facts and the fine-cell line split into two sentences with every figure and denominator kept ("2024: 4,034 located firms on the lists (treated). 195,010 firms with other geocodes"), the checker's templates matched and a wire rule added (a semicolon in any item is a finding), which caught eight cat facts of the off-wire pool joined with semicolons (ids 6, 8, 20, 26, 28, 30, 40 and 41), each rewritten as two sentences in `data/offwire.json`, its twin and the list below; (2) settled by the amber decision: Aeroflot keeps the anchor amber, and where the diverging pair's amber shares the frame (the Moscow runs' revenue classes) its marker, leader and label on the map and its line in the live box take the ink, the live box's current point drawn as a ring (`ringCurrent` in `bandLines`), the colour crossing with the classes' reveal (`aeroflotColour`, a hex mix over `layerReveal`); (3) the comparison medians and bands in the cyan ramp's third and second steps (`--cmp-line` #50B5AA, `--cmp-band` #269C96 at 22 percent), `--accent-muted` retired; (4) the explainer's links in the cursor accent with the ink on hover, the atlas's footer rule aligned; (5) the credits' caveat "The lists are fixed memberships, not dated designations."; (6) the minimap's 9 px labels accepted as the recorded deviation; (7) the cat prefix in the muted text tone through its own token `--wire-pre` (#B4C0D0 dark, #52636D light), the dead reference gone.

Five atlas requests the same evening. The toggles: the collapse triangles are drawn by the stylesheet (a 12 by 8 px `::before` in the button's colour, clipped to a triangle, 8 by 12 px pointing right when collapsed) in place of the 12 px glyph set in type, so they read the same on every device; the script no longer writes the glyphs. The strip's slot: the glyph, then the region's name and the slider's year in tracked capitals ("KRASNOYARSK KRAI · 2024") and nothing more, sized to its text by the script with a width transition under the crossfade (125 px for RUSSIA and 192 px for MOSCOW OBLAST of a 1,154 px bar at 1,600 px, a tenth and a sixth), capped at a third of the bar with an ellipsis; the region's full fact rides the wire as its set's first item, where it was already, so it still appears when the cursor rests; the year changes under the crossfade and never ticks; the phone's reduced-motion two-line form is untouched; the audit asserts the slot under a third of the bar at every width and the track's window at least half the bar from 1,200 px. Divisions: wherever the strip, the tile or the wire names one it is the short label with the code ("Wholesale trade (46)"), never the code alone, at every width; the full NACE title stays in the panel and the METHOD block; the checker's two templates follow. The hovered region: its area is filled in the cursor fuchsia at 6 percent on the dark theme and 4 on the light, right after the land on the map canvas from the outline's cached path, under every data layer; the map redraws when the hovered region changes and never per pointer move; the outline stays on the overlay; two states sample a bare land pixel inside Murmansk Oblast (the land lifted to the expected mix within 2 per channel, back to the land after the hover) and a Moscow Oblast cell (its colour unchanged). The wire watchdog: once a second while the document is visible, and at once on visibilitychange and on window focus, the track's rendered offset is compared with the last check's, the offset at hiding kept; a track that should be moving and has not advanced restarts its animation from its rendered offset, or tops up at the track's end; nothing is logged; the state stalls the animation under a simulated hidden document and sees the track advance 101 ms after the return. The GO TO card: RUSSIA leaves the minimap's frame (the four brackets, the tooltip and the pressed state stay) and joins CENTRAL MOSCOW under it as a kept button at the left, above it, both at 11 px with 2 by 6 px padding (the frame label was 9 px, the list's buttons are 12 px), RUSSIA in the context green with the green pressed fill, CENTRAL MOSCOW in the card's neutral as before; the minimap's layout rules run over the 22 city boxes. Frames in `build/r18-toggles/` (the triangles open, collapsed and hovered, the GO TO card) and `build/r18-results/` (the comparison beat, the downtown and city runs with the ink marker, the credits).

**The hover glitch of 25 October 2026 (atlas v29, fixed the same day).** The author's device check after the publish found the backdrop jumbled and the zoom stuttering. The cause was the hovered region's fill: its hook ran inside `MM.drawBasemap` right after the land and ended with `stage.base()`, which reset the camera transform before the basemap stroked the graticule and the hairline borders, so every hover over a region (nearly every pointer position on the map) drew those lines in pixel space, and a wheel zoom alternated correct and broken draws while the hover was cleared and re-read each tick. The audit had not seen it: the region-fill states sampled a land pixel and a cell pixel, and the borders state's tolerance of 14 per channel admitted the land tone itself. Fixed by dropping the reset (the hook's own save and restore leave the camera transform in place); and the hover's draws are coalesced now (a hidden hover and a region change queue one draw through `requestDraw` instead of drawing at once), and a wheel tick keeps the hovered region and its fill until the settled hover re-reads it (`hideHover({ keepRegion: true })`), so the strip no longer flips to the camera's band and back on every tick. A `regiongrat` state counts the graticule- and ghost-toned pixels of the map canvas with and without a hover at the Russia preset and requires them within a tenth of each other, and the two region-fill states redraw before sampling. The probe before the fix: 2,062 graticule-toned pixels without the hover, 15,431 with it; after: 2,429 and 2,429. Frame in `build/r19-hoverfix/`. The atlas audit on the fix: 1,207 states and 49,587 boxes at the five widths on both renderers with zero findings, the grain guard within 0.05. Published on the author's word as atlas v30 (explorer.html and js/explorer-app.js) on 25 October 2026 from commit 5628fda (the fix in 0198a32); the explainer untouched.

**The wire glitch of 25 October 2026 (atlas v30, fixed the same day).** Reported with the hover glitch: the wire raced through its items at a crazy pace. `wirePrune` judged each next element's position after the previous removal had already shifted it left, so once the first item had scrolled past, one region change emptied the whole track (36,916 px), and the context path then read the offset again from a stored value the prune had not moved, so the new set leapt into view at the old offset, hundreds of pixels at a time while the cursor crossed regions (a defect of the part D queue that the slot's frequent region changes made visible). The loop now compares positions in the track's original frame (the shift of what follows measured exactly, margins included), the stored offset moves with the removed width, and a state (`wireprune`) scrolls the first item past, changes the region and expects an item well inside the window to keep its place at the wire's speed with the offset positive and at least a cycle on the track. The watchdog judges a stall only against a check at least half a second old (a focus event right after a tick had restarted the animation for nothing). Reproduced and verified in the desktop app's own browser with real pointer and wheel input against the lab's server (the speed at rest 60 px per second, no same-item jump across six region changes and two zoom steps, zero restarts). The atlas audit with the fix and the new state: 1,211 states and 49,774 boxes at 400, 768, 1,200, 1,600 and 2,000 px on both renderers, zero findings, the grain guard within 0.05 (a first run had reported the new state at four widths, because it followed an item at the window's edge that the grown slot had rightly covered; the state now follows an item well inside the window). Published on the author's word as atlas v31 (explorer.html, js/explorer-app.js).

### Round 14 (25 October 2026): speed, a pixel-field Firms view, 1 km squares in the Cells view

**Dates and the workspace (the author's request of 25 October 2026).** The work of rounds 10 to 13 and the fixes after them was all done on 25 October 2026 (the commit timestamps). The lab's records had dated much of it 26 October; the text records and the code comments now say 25 October. The commit messages keep the wrong date, and so do two file names: `design/2026-10-26-audit-against-principles.md` and `review/2026-10-26-chrome-corrections-validator-round10.txt` (with `review/2026-10-26-palette-validator-round10.txt`). The state before this round: one branch, `main`, equal to `origin/main`, with no other branch, worktree or stash. Round 13's branch and worktree had been merged and removed, and the fork session's wire fix was committed and pushed. The live atlas (v31) was byte-identical to the committed publish copy. Working rule from this round: work directly on `main` (no branch, no worktree, no forked session), commit at each checkpoint, push after each commit, and publish only on the author's word.

**The author's screens and how speed is measured.** The author's laptop panel is 3200 by 2000 at 1.33 and 165 Hz; the external monitor is 2560 by 1440 at 1. Brave reported a device ratio of 1.33 on the external monitor too, and a map canvas of 1,836 by 1,704 device pixels. (`xrandr` reports XWayland's virtual framebuffer under fractional scaling, 4800 by 3000, not the panel.) Speed is measured in the author's own Brave through the Claude extension, only with the window in front and uncovered on the screen being tested, and only after a check that idle frames match that screen's refresh (6.1 ms at 165 Hz, 6.9 ms at 144 Hz). The frame rates of a first test on 25 October were discarded because the window was most likely covered, and GNOME throttles a covered window. Draw times, timed inside the drawing calls with a one-pixel read to flush the canvas, are not affected by that throttling and stand. Headless Brave (`--force-device-scale-factor=1.333`, the author's 1,822 by 1,397 window) serves for regressions between commits.

**Thin lines at a fractional device ratio (approved by the author from the before/after crops, committed in c9a3025).** At 1.33 a 1 CSS px stroke is 1.33 device px wide, which takes the canvas off its hairline path. Stroking the 58,490-vertex regional borders then cost 40 to 58 ms a frame in the author's Brave, against 2 ms at 1 device px; a full draw at the country view cost 81 to 87 ms in the Cells view and 100 to 105 ms in the Firms view. `MM.strokeHair` (in `js/map-layers.js`) draws any basemap stroke between 1 and 1.6 device px as a 1 device px hairline, with its alpha multiplied by the width it replaces (capped at 1), so the ink per unit length stays the same. It covers the regional borders, the city windows' borders, the tile outlines and the hovered region's outline, never the listed marks. It is the atlas's alone (`MM.hairlines`; `?hairlines=0` draws as before); the video draws exactly as before. Crops at 1.33 (`build/r20-lines/`): 2 to 4 percent of pixels change in the four views, by at most a few levels, on the faint lines only.

**The land by level of detail (the same approval and commit).** M1 now also writes the land as one outline, the union of every part (polyclip 1.10-7, the Clipper library, with a nonzero fill after orienting outer rings counter-clockwise and holes clockwise), at tolerances of 16, 8, 4, 2 and 1 km (7,618 to 24,110 vertices, against lod0's 58,490 with every internal border twice). A small island that would collapse under a tolerance steps down by quarters until it keeps three vertices. Four new checks: the union's area within 0.05 percent of the parts' (observed 0.0000058 percent), five levels coarsest first, every dropped vertex within the level's tolerance, and vertices never falling as the tolerance falls. The atlas fills the land from the coarsest level whose tolerance stays under 0.3 CSS px and, deeper in, from the lod0 parts whose boxes meet the view (a ring outside the view cannot change the even-odd fill inside it). It is also the atlas's alone (`MM.landLevels`; `?land=0`); every key the explainer reads is byte-identical to before (`land` is a new key). polyclip joined the lab's extras in `scripts/setup-lib.sh` and `config/pak.lock`. Full draws in headless Brave at 1.33, the Cells view on the industry layer, before and after both changes: 74 to 16 ms at the country view, 34 to 9 ms at a regional zoom (k 2), 17 to 5.5 ms at the Moscow preset. Most of the gain is the hairline: with it alone the regional zoom draws in 9.6 ms, with the land levels alone in 21.5.

**Tested and kept as it was: the map canvas on the GPU.** Dropping `willReadFrequently` from the map context, so the canvas draws on the GPU, measured slower in the author's Brave, under the throttling above (Cells flights 13 to 14 fps against 18 to 20). `?canvas=gpu` selects it for the re-check under the measurement rule.

**Found, left for the author: the GO TO minimap's graticule has never drawn.** `buildMinimap` maps the graticule's typed arrays with `Float64Array.prototype.map`, which turns every coordinate string into NaN, so the path's `d` reads "MNaNLNaN…" and the browser logs an error on every load. Fixing it adds the graticule to the minimap, which the author has never seen there.

**The invisible fixes (committed in fd47050).** The hover is keyed by the unit under the cursor (the mode, layer, year and the cell, square, pixel, coordinate pair or listed set): while the key holds, a pointer move only moves the tile, writes the footer and moves the crosshair; the tile's text, the side panel, its chart and the mix box are rebuilt when the key changes (about 0.5 ms a move inside one unit). A wheel step draws the map, the zoom buttons, the ruler and the tile from that cache; the settle, 150 ms after the last step, counts the firms in view, rebuilds the tile and the panels and updates the strip, the wire, the view's revenue mix (13 ms a step before, on the Firms view's industry layer) and the presets' pressed state. The field and marks canvases redraw only when what they show changed (a key of the mode, layer, year, theme, camera, size and renderer), so a hovered region's fill redraws the map canvas alone. A loaded year's bins are built in idle time, outside flights, drags, pinches and wheel runs, instead of in the first frame that needs them (a 312 ms stall before).

**The hairline at 0.999 device px (committed in 66cbe88).** A sweep of full draws across the zoom found spikes at some zooms (93 ms at 2.1 times the fit against 28 on either side): `1 / s * s` rounded above 1 in single precision there, so Skia left its hairline path and stroked the regional borders in full (34 ms for the borders alone). The hairline's width is now 0.999 device px, which keeps the fast path at every zoom; the 0.1 percent lower coverage is not visible. The same sweep after the fix: 19 to 33 ms at every sampled zoom between 1.2 and 2.8 times the fit, in headless Brave at 1.33. The fix is in the speed release.

**The publish set from a commit.** `tools/publish-set.py --from COMMIT` reads the pages, the stylesheet and the scripts from that commit (the data stay the working tree's, and the set is refused if a tracked data file differs from the commit's), and stamps that commit as the build, so the speed release ships from 66cbe88 while the redesign is committed after it. The script list is read from the pages' own script tags, so `js/pixel-field.js` joins the atlas's set when the page loads it.

**The Firms view: the video's per-pixel rule, live (the author's decision of 25 October 2026).** Below the dots zoom every CSS pixel of the map sums the firms on no list at the coordinate pairs inside it and takes the layer's statistic, the rule of the video's national year run (`R/motion/M8-national.R` with `draw_region` in `M6-common.R`): blocks of 2 by 2 pixels where 10 or more firms share a pixel and 3 by 3 at 100 or more (by filers on the revenue layer), the 3 by 3 centred and the 2 by 2 extending right and down, the larger block winning an overlap and then the larger count; the layer at 0.9 over a neutral backdrop of every firm at 0.25 on the revenue and industry layers. Revenue: the filer-weighted median class; statement share: the share of the pixel's firms with a statement on the year's breaks; industry: the class with the largest revenue, each pair counted in its leading class; the cell layers: the density colour at the count alphas. `js/pixel-field.js` computes it on WebGL2 (float targets with additive blending: accumulate, classify, dilate and compose, copy) or, without blendable float targets, with a CPU engine of the same rules; the hover reads the pixel whose block is drawn under the cursor by the drawing's own rule and sums that pixel's pairs for the tile, the panel and the mix box. The dots from k 20 as before, crossfading over 1.4 times. Checks: the field's cells sum the firms in view (2025 at the country: 2,865,746, the year's file); the GPU image matches the CPU engine's within rounding (4 of 34,700 lit pixels differ by more than 2 levels at the country, 97 of 68,968 at the Moscow preset, where float32 positions put a few addresses across a pixel's edge). The opening sweep: once per browser tab, the first time the Firms view opens at the country view, every pixel and listed mark fades in as an invisible edge passes west to east over 1.3 s; any pointer, wheel, key or touch input completes it; never under reduced motion. The year dissolve: the previous year's field crossfades into the new one over 0.25 s (kept under reduced motion, a crossfade); a camera move completes it. Retired: the region tint and the glow under the field, round 11's additive field and round 13's squares in this view. Firms flights in headless Brave at 1.33 on the GPU: about 23 to 27 fps before, 49 to 52 after.

**The listed marks, B″ (the author's decision of 25 October 2026, "a bit overemphasized" at the country and the city).** In the atlas only (`MM.listedCased`; the video keeps its marks): at the country the resting alpha a fifth lower (0.48) and the radius floor 18 percent smaller (0.70 px), and in place of the pale halo a casing in the stage colour, its strength 0.8 times 0.4 to 1 and its width 0.6 to 1 px rising from k 20 to 60; no land disc under solid marks at the national zooms. Frames of the variants in `build/r22-red/`.

**The Cells view (the author's decisions of 25 October 2026).** Round 13's 1 km squares from the address files cover the country on the share, industry and density layers (density in 2021), from k 1.5 to full at 2.5, once the year's address file is loaded (prefetched from k 1.2 on a settled view; the 25 km cells stand until then): firms on no list at house- and street-level geocodes, which the legend's reading side names, coloured as round 13 coloured them (the windows' share breaks 55, 62, 68 and 74 percent in the five-step ramp with grey under 50 firms, the class with the largest revenue, the density colour at the count alphas). They draw on the field canvas as one instanced quad each (`PF.createSquaresGL`: grid indices shifted by the camera's nearest index so only small integers are multiplied, the edge covered exactly per device pixel, round 13's 12 percent gap from 5 px), and the 2021 250 m windows join the same pass from k 24 to 40, the 1 km squares fading to a quarter outside the window and out inside it (round 10's hand-over). Without WebGL2 the map canvas draws them as round 13 did. Retired from the drawing: the 24 city windows' 1 km cells, the 2021 national 5 km shares and the industry layer's city file (`industry-city.js` is no longer loaded); the windows' data still give the strip's city facts and the ghost names' sizes. The 25 km cells take over from the 100 km cells between 1.5 and 2.7 times the fitted zoom (k 0.45 to 0.8 before, 2.7 to 4.8 times the fit on the author's laptop), so the 100 km cells hold at the country view on every screen. The ghost names and the city labels moved to the marks canvas in both views, above the squares. Cells flights in headless Brave at 1.33 on the GPU, with the year's squares built: 30 to 35 fps before the round (v31), 49 to 57 after the speed release, 48 to 56 with the squares.

**The red count in the Cells tile.** At the right end of the tile's first line, the legend's solid red dot and a bold red number (Plex Mono 700, 19 px): the firms on the five lists present in the layer's own year (2021 on the density, lists and cohort layers, 2024 on the change and revenue layers, the slider's year on the share and industry layers, the author's decision relayed from the side chat) at coordinates inside the hovered cell, at its own size (100 km, 25 km, 1 km, 250 m or the 5 km density cell), exact, 0 included. The legend's key side defines it ("N listed (treated), YYYY"), its reading side states the rule. The red measures 4.0 to 1 on the dark tile and 4.4 to 1 on the light, above the 3 to 1 floor for large text.

**The pulse in both views.** In the Cells view the pulse button shows on the share and industry layers and pulses every cell at the shown level that holds a firm listed in the shown year (dated and present that year; undated firms never), with the Firms view's two rings at the cell's centre and its west-to-east stagger over the cells in view; under reduced motion the still highlight. The automatic pulse on a forward year change stays in the Firms view.

**The tile's text in the GO TO card's ice (the author's request).** The tile's body takes `--go` (#9CC8FF dark, #22364D light); the footer keeps the reading green and the count its red.

**The two-sided legend (the author's request about the box's width, approved with the round's frames).** The key side, shown by default, holds the title and the rows with a swatch, so the box is as wide as its longest class label or its title row. Measured at the author's window (1,822 by 1,397 at 1.33): the Firms view's legend 730 px wide before, 414 to 458 after (37 to 43 percent narrower); the Cells view's share and industry legends 5 percent narrower (435 to 414 px at the country, 461 to 440 on industry at Moscow) with the count's row added; the density legend, the narrowest, 240 to 272 px (the "i" button). The grid's size in the titles reads "(100 km)", "(25 km)", "(1 km)", "(250 m)", and the count's key row "N listed (treated), YYYY". A green "i" in the title row, styled like the METHOD button, turns the box to the reading side, the sentences on how to read the colours, wrapped to the key side's width (the key side keeps the box's width while hidden); the choice is remembered per viewer. The listed marks' three rows sit under one header, "On one of the five lists (treated)", and the Firms title no longer carries the pixel's size (the reading side and the tile's footer do).

**The names review export (recommended by `review/2026-10-25-listed-names-memo.md`, written before the search ships).** `tools/names-review.py` writes `review/2026-10-25-listed-names-review.csv`: one row per named listed firm of `treatednational.json` (4,753; the 50 unnamed left out), with the display name, the filed name, the script case (alias 1,879, transliterated 1,588, Latin as filed 1,286), the listing year or undated, the list memberships, the region of the latest address, the entries sharing the display name and whether the same name pair ships in the Moscow file. No identifier and no coordinate; a name with a run of nine or more digits refuses the export. A first scan for the author: 151 display names keep a legal form spelled out or broken by a space ("Aksioma Limited Liability Company", "Aktsionernoye O Bshchestvo ..."), 3 keep doubled single quotes from the filing, and 76 reach the 60-character cap.

**Find a firm on these lists (the author's request of 25 October 2026, following the memo).** A field at the top of the GO TO card, labelled FIND on its own row like VIEW, METHOD and YEAR (the author's naming), in the card's ice with square corners, its placeholder interface text in tracked capitals ("LIST MEMBERS, LATIN | КИРИЛЛИЦА"; 13 px, 12 px on a phone under 400 px, where 13 px is clipped, and 11 px under 379 px; typed names keep their case), matches the typed letters against the display names and the filed names without case, accents or punctuation (a name's start first, then a word's start, then anywhere, then every typed word somewhere) and lists the first ten hits, each with its mark's glyph in the shown year, its listing year and its region. A choice by click, tap or Enter (the arrows move through the list, Escape closes it and then clears the field) flies to the firm in the Firms view, from the Cells view too, where listed firms are not drawn (the proposal shown to the author with frames), at the 20 km rung or closer, in the shown year or, where the firm has no record that year, the nearest year with one; the tooltip opens at its mark with its name first, and the mark then pulses once with the button's two rings (the still highlight under reduced motion). On the phone layout the field sits above the city buttons and a choice scrolls the map into view. When nothing matches, the list reads "No list member by that name". Firms on no list carry no name and never appear.

**Links to the exact view.** The page's address carries the view, the layer, the year and the camera, as `#firms/industry/2024/55.75580,37.61730/20km`: the centre in degrees (5 decimals, about a metre) and the span of the map's shorter side in km, so a link opens on the same ground on any screen; the country's fitted view reads `/fit`. The address follows every settled view, replaced in place rather than added to the history, and a link opened later, or a hash typed by hand, restores the view; `#Moscow` and `#Moscow-firms` keep their meaning. On the published page the address bar belongs to the host, so a "LINK TO THIS VIEW" button under the GO TO card's presets copies the artifact's own address with the view appended (where the browser refuses the clipboard, the link appears selected in a field beneath). On the host a fresh load carries the fragment to the page (checked with the speed release's preset links, below).

**The author's approval (25 October 2026).** The frames of the second release (`build/r25-review/`, sheets A to D) were approved, with the two proposals: a search from the Cells view opens the Firms view, where listed firms are drawn, and the link button sits under the presets in the GO TO card. Still open by the author's choice: the presentation tour (not to be built unless asked for a talk) and the minimap's graticule fix. Before either publish: the five-width audit at zero findings and the measurement in the author's Brave on both screens.

**The measurement sitting in the author's Brave (25 October 2026, evening).** Through the Claude extension, in one Brave window holding the atlas tab, maximised, with Brave focused and untouched; first on the laptop panel (1.33, 165 Hz), then on the external monitor (1, 144 Hz); the old page (v31, `build/before/`), the speed release (66cbe88, `build/p1/`) and the redesign (the working tree), each on the Cells and Firms views of the industry layer in 2024: a full draw at the country view and at the Moscow preset (timed with a one-pixel read of the map, the marks and the field), five flights (Russia to Moscow, Moscow to the 20 km rung, back to Russia, and the pair again), 40-step wheel runs in and out, and the hover. The raw figures are in `review/2026-10-25-brave-sitting.json`.

What the sitting found first: in this Brave on GNOME (Wayland) a page whose content changes gets a frame only every 3 to 6 refresh intervals, 18 to 36 ms on the laptop panel and 21 to 28 ms on the external monitor, measured with a 2 px box moved every frame on a plain directory listing as well as on the atlas (24 ms on a blank page, 24 on a page holding only a WebGL canvas, 6 on a page holding only a CPU-drawn 2D canvas, 18 on a GPU-drawn one); a page without any change gets a frame once a second. Unfocused, the window fell to those rates at once. This floor, set by the browser and the desktop rather than the page, caps every animation at about 28 to 55 fps on the laptop and 36 to 48 fps on the external monitor, and makes the measurement rule's idle check (idle frames at the refresh) unattainable; the sitting checked instead that the window was live (frames with a moving box under 45 ms, no gap over 250 ms). The cause lies outside the lab (a Brave flag such as the X11 backend, or GNOME's fractional scaling, are the first things to try); the lab cannot remove it.

| Laptop (1.33, 165 Hz) | v31 | speed release | redesign |
|---|---|---|---|
| Cells, full draw at the country / Moscow (ms) | 163 / 39 | 24 / 15 | 35 / 11 |
| Cells flights (fps, five) | 13 to 23 | 29 to 35 | 14 to 29 |
| Cells wheel in / out (fps) | 12 / 13 | 20 / 28 | 20 / 21 |
| Firms, full draw at the country / Moscow (ms) | 220 / 92 | 84 / 87 | 34 / 19 |
| Firms flights (fps) | 14 to 30 | 19 to 29 | 15 to 24 |
| Firms wheel in / out (fps) | 10 / 10 | 17 / 18 | 20 / 21 |

| External monitor (1, 144 Hz) | v31 | speed release | redesign |
|---|---|---|---|
| Cells, full draw at the country / Moscow (ms) | 36 / 16 | 18 / 11 | 30 / 6 |
| Cells flights (fps) | 32 to 44 | 37 to 44 | 36 to 44 |
| Cells wheel in / out (fps) | 32 / 33 | 37 / 34 | 29 / 31 |
| Firms, full draw at the country / Moscow (ms) | 84 / 48 | 58 / 43 | 24 / 16 |
| Firms flights (fps) | 21 to 38 | 25 to 34 | 34 to 43 |
| Firms wheel in / out (fps) | 20 / 22 | 25 / 26 | 17 / 30 (one 1 s gap) |

Reading: the thin-line fix carries the laptop (a 1.33 screen), where the Cells view's full draw at the country fell from 163 to 24 ms; at a device ratio of 1 the old page was already near the floor. The redesign's Firms view draws in a third to a fifth of the time and its flights reach the floor on the external monitor. Flights at or near the floor cannot show further gains, and single runs vary with the floor (18 ms in one laptop run, 36 in another), which explains the laptop's spread for the redesign's Cells flights (one flight at 14 fps, the others 22 to 29; the external monitor's run put all five at the floor). The redesign's Cells draw at the country includes a read of the marks canvas, which now carries the ghost names in the Cells view too; a real frame does no such read. Re-checked under the sitting: the map canvas on the GPU (`?canvas=gpu`) is slower again on the laptop (Cells flights 18 to 23 fps against 29 to 35, the full draw at Moscow 88 ms against 15), so the CPU setting stays.

**The speed release published (25 October 2026, the author's word).** Atlas v32 from 66cbe88: the page, `js/explorer-app.js`, `js/map-layers.js` and `data/basemap.js`, the other 26 files kept from v31. Its audit at five widths on a copy of 66cbe88: 1,211 states, 0 findings. On the host, a fresh load carries the address's fragment to the page: `#Moscow-firms` opened the Firms view and `?r=1#Moscow` the Cells view at the Moscow preset. A fragment changed in a tab that already shows the atlas does not reload the page, so the old view stays until a reload.

**The tile after a tap or a search (found by the redesign's audit before the second publish).** The five-width audit of the redesign found the cursor tile on its last resort at 400 px, over the zoom box, the scale bar, the legend and the wire, in three Firms-view states at the Moscow preset. A pointer left by an earlier state redrew the tile at the map's centre with a tap's 24 px clearance, and the revenue layer's tile there had grown from 245 to 260 px with the pixel's line, past the 255 px that a 562 px map leaves above or below its centre. The search lands every firm at the centre, so on a phone a tall tile met the same case: on a 360 by 800 screen the search for "aeroflot" on the share layer left its 229 px tile over the controls and the found mark. A tap's 24 px now gives way to the hover's clearance (14 px, or the mark's radius plus 9) before the last resort. The controls, the scale bar, the strip and the mix box stay clear as before, and only placements that ended on the last resort move. Still on the last resort: tiles taller than about 258 px on a 360 px phone, where the tile (64 percent of the map's width) cannot pass the column of zoom buttons and the scale bar that starts about 260 px down the 498 px map, so no place clears the edges, the controls and the mark together. In a seeded sample of 100 searches on a 360 by 800 screen, 19 on the revenue layer and 19 on the industry layer still end there (38 and 40 before the change), none on the share layer (1 before), with the found mark under the tile; on a 390 by 844 screen none on either layer; on a 375 by 667 screen, whose map is 413 px tall, 59 on the share layer and 84 on the industry layer. The tile passes taps through (`pointer-events: none`), so the controls under it still work. Landing the firm lower on small maps was tried and does not help, for the same column. A new audit state taps the map's centre at the Moscow preset on the revenue layer and requires a placement other than the last resort (`hoverKm` takes `touch: true`). Frames in `build/r26-tile/`.

### Publishing

`tools/publish-set.py` assembles the pages, the six scripts, every `data/*.js`, the 49 Moscow rasters the
journey loads, the 24 national rasters and the 12 address scripts (113.1 MB with the names) and refuses an identifier
key, a firm-name key outside the two listed-firm files, or a named neighbour. Explainer artifact: v10 and v11 (two uploads), v12 with the assets capability, v13 with the three 720p cuts as assets linked from the page, v14 and v15 with the 24 October wording, v16 with the re-rendered 720p assets, v17 with the wording correction, v18 with the side cuts retired, v19 with the directed camera and the re-rendered teaser asset;
atlas artifact: v6 and v7 (two uploads), v8 with the wording, v9 with the correction, v10 with the treated gloss, click-to-zoom, the zoom box and the phone layout, v11 with the directed flights, v12 with the 25 km cells, the hand-over between grids and the pinch rate, v13 with the click that goes to what was clicked, v14 with the pinch rate, the zoom floor and the smoothness fixes, v15 with the address field in WebGL, the pulse of newly listed firms, the corrected address manifest and the canvas-sizing fix (the page, the script and `data/firms.js`; the address scripts kept from v14), v16 with the rim before the listing year, the three legend rows, the pulse button and the earlier re-centring, v17 with the quieter marks, the prominent pulse, the hover floor and the names; explainer v20 with the rim, the three legend rows and the ringed ticker line (the teaser asset unchanged), v21 with the quieter marks, the pulse, the names data and the 27 re-run Moscow rasters (the teaser asset unchanged again). The published pages could not be opened from the lab's headless
browser (the links need a claude.ai session), so the load on the host is the author's check.

## Design decisions

- Dark cinematic stage held to Tufte: no glows, gradients or 3D; motion only reveals data or moves the camera; every rate carries its denominator; one message per scene in the title line; the sequential ramp brightens with the value on the dark ground; the change ramp keeps purple for falling shares and green for rising ones with lightness rising with magnitude (round 2; round 1 used brick and blue).
- Discrete labelled annual snapshots; crossfades are presentation, never interpolation of values. Camera moves are pure functions of time (position cubic, zoom in log k).
- Wording stays descriptive: absence is not withdrawal or concealment; supplied lists are fixed memberships; no regional reading is put on the change map; the size widening is marked provisional.
- Disclosure: shares need 50 firms (the project's support rule); 250 m cells under 3 firms are dropped; fine-cell counts under 10 are banded in tooltips; list counts under 5 per cell are suppressed. No firm identifiers leave the lab; coordinates and per-firm states ship since round 5; firms on the five lists are named from the list files since 25 October 2026, firms on no list never.
- Type (round 10, 25 October 2026): one typeface, IBM Plex Mono (SIL OFL 1.1), at 400 for prose, 500 for labels and figures and 700 for headings and emphasis, installed locally for the headless renders from the pinned files and served to the published pages from Google Fonts with the local family first in the stack; interface labels, place names and scene titles in capitals, the labels tracked at 8 percent; tabular figures throughout; text at or above 22 px at 1080p, titles 46-78 px. Rounds 1 to 9 used Nimbus Sans locally with Arimo as the web fallback.

## Possibilities not built (ideas for a later pass)

- Per-year 250 m city cells (the M5 join could bin at 250 m; only 2021 exists today).
- Ownership and legal-form composition by cell, and an "addresses shared by 100+ firms" layer.
- A narrated version (voice-over aligned to the scene table) and a 40 s teaser cut of scenes 1, 4, 6 and 7.
- Porting the atlas into the Claude Dashboard artifact type with per-number source attribution and comments.
