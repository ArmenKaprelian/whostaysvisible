# Codex task brief: Figure 2.8 as five pooled-quintile classes with gapped tiles

Drafted by Claude on 18 October 2026 from the dataviz-lab study; the author pastes it. It is an implementation specification and an assessment, not an authorization. The author's decisions are marked as such; everything else is Claude's reading of the current records.

## 1. Author decisions (18 October 2026) and scope

- Figure 2.8 (`chapters/02-opacity/07-financial-sample-implications.tex`, `figures/chapter2/stage3-08-cohort-map.pdf`) changes from a continuous linear 0–100% navy ramp to **five ordered classes** at the **pooled type-7 quintiles of the inclusion share over the 1,334 supported cells of both panels** (667 per panel), with one legend for both panels. Ties go to the lower class.
- Cells are drawn as **85 km squares on a white 100 km backing**, so each cell has a 15 km (0.6 pt) white gap on every side.
- Colours: the **classed navy** `#78A3C9 #4F84B4 #2F6395 #16436E #061C38` (classes 1 to 5). The gray rule (`#CDD3D0` below 50 eligible firms) is unchanged.
- Labels: the stray candidate prefix `02  ` is dropped from the first title; subtitles go from `cex = .87` to `cex = .96`; the legend becomes five touching swatches with the class boundaries printed; note line 2 is reworded. All other strings stay as approved under Memo 19 item 17.
- Unchanged: the three saved inputs, projection, basemap, extents, panel rectangles, titles, notes 1 and 3–5, page geometry (6.5 × 7 in), device.
- Not in scope unless the author adds it: the same stray prefix `01  ` in Figure 2.7's title (same script, `c2rr_map_candidate1`), and the note text at 0.78 × 10.5 = 8.2 pt, below the project's 10.5 pt exhibit minimum (needs a re-layout; the lab left it).

Alternatives the author saw and did not choose: 25 km gaps, fixed and graduated circles, YlGnBu, Dark2 (rejected for lack of order and colour-vision failures), a navy/green two-hue version. Reasoning: `Claude Code/current/dataviz-lab/candidates/fig28-ranking.md`; page: `gallery/fig28-final.html`.

## 2. Reference render to match

- `Claude Code/current/dataviz-lab/figures/20261018-fig28/final-s1a-gap15.pdf`, sha256 `e740f1412eca9e4ebbb895587b8ffe109cd37c9653eb245857b646d65f1b5629`, drawn by `R/fig28/F6-finalists.R` with the helpers in `R/fig28/fig28-common.R` (base graphics, `cairo_pdf`, Nimbus Sans, pointsize 10.5).
- The lab helpers reproduce the current manuscript PDF with **zero differing pixels at 200 dpi** when set to the current encoding (`figures/20261018-fig28/fidelity/fidelity.txt`), so the reference differs from the manuscript in the encoding alone. The expected `pdftotext -layout` diff against the manuscript file is exactly: the title prefix, legend line 13, note line 15.
- Class table and cutpoints with provenance: `Claude Code/current/dataviz-lab/data/fig28/fig28-cell-classes.csv`, `fig28-cutpoints.csv`, `fig28-class-counts.csv`.

## 3. Inputs (unchanged; sha256 as recorded in `research/evidence/chapter2-editorial-memo-2026-10-15/implementation/figure-input-identities.csv`)

| File | sha256 |
|---|---|
| `programming/output/reconcile-visual-refinement-20261014/exhibits/generation-91a7a2b80fd6/maps/candidate-02-cell-source.csv` | `9766c77dd10b8c6bc016ed6f10a933d0eb042bc9acc69fb7337ba6adf7a9e6d7` |
| `…/maps/map-refinement-manifest.json` | `c9e8407752cb253c7ec1af55894f3a2d667bfcbbd1d5d2036d3755695de8fbde` |
| `programming/output/reconcile-visual-refinement-20261014/inputs/geoboundaries/basemap-geometry.json` | `a160f5f0dc84679e7c2f79b24d6fb65e865f15bfd7465381840236d82a6c9f5f` |

## 4. Code: `programming/R/chapter2-reconcile-refine-maps.R`, function `c2rr_map_candidate2`

**Prerequisite.** programming's copy still carries the pre-Memo-19 strings (line 247 `"Revenue / ", a$moderator, " cohort inclusion"` and line 256 `"Revenue/cash or revenue/inventory fixed cohort / all located eligible firms per 2021 cell."`). The manuscript file was rendered on 15 October from the evidence copy `research/evidence/chapter2-editorial-memo-2026-10-15/implementation/figure-source/chapter2-reconcile-refine-maps.R`, which differs only at those two lines. Adopt the evidence copy's strings first, or a re-render from programming reintroduces the old titles.

**Classes** (replace the `palette` line 233 and the fill at line 267):

```r
pct <- inputs$cells$inclusion_percent; sup <- inputs$cells$display_supported
cuts <- stats::quantile(pct[sup], c(.2, .4, .6, .8), type = 7, names = FALSE)
inputs$cells$class <- as.integer(cut(pct, c(-Inf, cuts, Inf), labels = FALSE, right = TRUE))
palette <- c("#78A3C9", "#4F84B4", "#2F6395", "#16436E", "#061C38")
```

Expected `cuts`: 33.3085501858736, 38.3333333333333, 42.9696987542627, 47.6248003194888. Expected supported cells per class: cash 70 / 61 / 128 / 186 / 222, inventory 197 / 207 / 137 / 81 / 45 (667 each).

**Cells** (replace line 269; `d` is the panel's rows, `fill <- palette[d$class]; fill[!d$display_supported] <- "#CDD3D0"`):

```r
graphics::rect(d$x_km - 50, d$y_km - 50, d$x_km + 50, d$y_km + 50, col = "white", border = NA)
graphics::rect(d$x_km - 42.5, d$y_km - 42.5, d$x_km + 42.5, d$y_km + 42.5, col = fill, border = NA)
```

**Titles and subtitles** (lines 247–251): drop the `if (i == 1) "02  " else ""` prefix; subtitle `cex = .96`.

**Legend** (replace lines 253–255):

```r
left <- .12; right <- .70; w <- (right - left) / 5; edges <- left + w * 0:5
for (k in 1:5) graphics::rect(edges[k] + .0025, .123, edges[k + 1] - .0025, .139, col = palette[k], border = NA)
b <- formatC(c(min(pct[sup]), cuts, max(pct[sup])), format = "f", digits = 0)
graphics::text(edges, .111, c(paste0(b[1], "%"), b[2:5], paste0(b[6], "%")), cex = .96)
graphics::rect(.78, .123, .86, .139, col = "#CDD3D0", border = NA)
graphics::text(.82, .111, "<50 eligible", cex = .96)
```

Expected labels: `5%  33  38  43  48  68%  <50 eligible`.

**Note line 2** (line 257): `"Classes: pooled quintiles of supported cells; 100 km cells; gray: <50 eligible; overlapping cohorts. RFSD v3.1.0."`

**Outputs.** `c2rr_refine_maps` refuses a non-empty output directory, so use a new run id. The same entry point re-renders candidate 1 (Figure 2.7); keep its labels as approved unless the author adds the `01  ` fix. Render locally: the manuscript file embeds NimbusSans, while the Lightning renders embed Liberation Sans. Write the class assignments (ix, iy, moderator, inclusion_percent, class) and the cutpoints beside `candidate-02-cell-source.csv`, and add the classing rule and palette to `map-refinement-manifest.json`.

## 5. Manuscript edits (`chapters/02-opacity/07-financial-sample-implications.tex`)

Line 18, current: `The two panels use the same denominator, cell grid, and 0--100\% scale to compare separately defined cohorts.`
Proposed: `The two panels use the same denominator, cell grid, and five-class scale, cut at the pooled quintiles of the supported cells, to compare separately defined cohorts.`

Line 25 (figure note), current: `Both use the same 0--100\% scale and geographic frame.`
Proposed: `Both use the same five classes, cut at the pooled quintiles of the 1,334 supported cells (33, 38, 43 and 48\%), and the same geographic frame.`

Unchanged: the caption, the `\includegraphics` line and the file name (replace `stage3-08-cohort-map.pdf` in place; `scripts/publication-files.txt` and `kaprelian_dissertation/README.md` need no change). The "common 0--100\% scale" in Figure 2.9's note (line 41) belongs to that figure and stays.

## 6. Records and workflow (per `LaTeX/AGENTS.md`)

- A numbered before/after comparison of the manuscript file (sha256 `cd371e613eb598911fcd68cc7a42ed457beeaa934a08a78bbf2b53612cc36763`) against the new render, for the author's review before synchronization.
- A dated evidence folder under `research/evidence/` with the figure import record (hashes), input identities, the checks in section 7, the session information and an authorization note quoting the author's decision of 18 October 2026.
- Decision record: the 14 October "common navy 0–100% scale" for this figure (`research/evidence/chapter2-stage3-review-2026-10-14/figures/figure-manifest.csv`, row 08) is superseded by the five-class rule above; the 100 km cell and gray-under-50 rules (`decision-record.md`, item 4 of the geography review) are unchanged.
- Build, validation and Overleaf synchronization follow the default authorized workflow unless the author says local only.

## 7. Checks to report

- Located cohort firms 1,485,616 and 1,164,866; located eligible 3,277,638 per panel; 667 supported and 487 gray cells per panel; 1,154 cells per panel.
- Cutpoints and class counts as in section 4; classes 1–5 all used; cutpoints strictly increasing.
- `pdfinfo` 468 × 504 pt; `pdffonts` NimbusSans only.
- `pdftotext -layout` of the new PDF identical to the lab reference; against the manuscript file, differences limited to the title prefix, the legend line and note line 2.
- Pixel comparison against the lab reference at 200 dpi (expected zero or a handful of pixels from antialiasing).
