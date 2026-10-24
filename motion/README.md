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
  residents-list-only firms from 2020; the 200 other undated members from the first frame.
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
no identifiers) and `anchors.json` (Aeroflot's facts with its listing date and jurisdictions from the
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
(manifest, counts, classes, checks), `data/treatednational.json` (4,803 firms, no identifiers), 24 rasters
under `data/points-national/`; all local, refused by `publish-set.py`.

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
helper refuses them too) and the neighbour firm (`anchors.b`) carries no name. The citation now reads
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
year's statement is absent, their own state's colour before. Hover gives counts, never a firm: the
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
nowhere on screen (the provenance word stays in this README and in the credits' caveat, which now reads
"Supplied lists are fixed memberships, not dated designations."). Legends, atlas and video: the red row
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

### Publishing

`tools/publish-set.py` assembles the pages, the six scripts, every `data/*.js`, the 49 Moscow rasters the
journey loads, the 24 national rasters and the 12 address scripts (109.8 MB) and refuses an identifier
key or a named neighbour. Explainer artifact: v10 and v11 (two uploads), v12 with the assets capability, v13 with the three 720p cuts as assets linked from the page, v14 and v15 with the 24 October wording, v16 with the re-rendered 720p assets, v17 with the wording correction, v18 with the side cuts retired;
atlas artifact: v6 and v7 (two uploads), v8 with the wording, v9 with the correction, v10 with the treated gloss, click-to-zoom, the zoom box and the phone layout. The published pages could not be opened from the lab's headless
browser (the links need a claude.ai session), so the load on the host is the author's check.

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
