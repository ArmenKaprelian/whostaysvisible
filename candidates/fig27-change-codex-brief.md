# Codex task brief: Figure 2.7 kept as printed, plus the availability-change map (review Items 1 and 2)

Drafted by Claude on 18 October 2026 from the dataviz-lab gallery (`gallery/fig27.html`, `candidates/fig27-ranking.md`); the author pastes it. It is an implementation specification and an assessment, not an authorization. The author's decisions are marked as such; everything else is Claude's reading of the current records. The terminology registry (Section 3 of the 18 October review) is not yet approved: the strings below that depend on it are marked "registry".

## 1. Author decisions (18 October 2026, verbatim in `candidates/decisions.md`) and scope

- Item 1, Figure 2.7: "I don't like any of the proposals, keep the current." The figure keeps its two availability panels and insets. What still applies is the review's note-only re-render (Point 20 preconditions, Section 4 tick list): the stray `01  ` prefix goes, every drawn text rises to the 10.5 pt floor (notes are at 0.79 × 10.5 = 8.3 pt, the inset labels at 8.1 and 7.9 pt, the subtitles at 9.5 pt), and the word "approved" leaves the LaTeX note. Registry: the titles become "Located eligible firms, 2021: original statement available" and "Original statement absent" once the registry is approved.
- Item 2, the availability-change map: "I like it. Let Codex choose whether best to include both current printed visuals plus item 2, or replace one of the current with item 2." Two layouts realise the two readings within the 7 in page and the 12-exhibit cap, both under Figure 2.7's number:
  - **Option A, two pages.** Page 1 is the current figure re-rendered note-only; page 2 is the change map at 6.5 × 4.4 in. Included as Figure 2.5 already is, with `\includegraphics[page=1]` and `[page=2]` in one figure environment. Both printed panels stay.
  - **Option B, one page.** The available panel (top slot, insets kept) over the change map (bottom slot, legend in the inset column); the absent panel leaves the figure. Lab reference `c-available-with-change`.
  - A third reading, three map panels on one page, does not fit at the 10.5 pt floor (two national bands already fill the page); Option A is the way to keep both printed panels.
- Not in scope: any list overlay (the author rejected designs A and B), Figure 2.8, and the sample-flow diagram (Item 3, separate brief after the author's pick).

## 2. Reference renders to match (lab, `Claude Code/current/dataviz-lab/figures/20261018-fig27-gallery/`)

| File | sha256 | What it is |
|---|---|---|
| `change-2024-2021.pdf` | `e5435f0cdc7b187d8a7eff8777fbb4559ae21818d38b221096a6f4bbe2c1e04c` | the change map alone, 6.5 × 4.4 in (Option A page 2) |
| `c-available-with-change.pdf` | `fb700da163525ab38a05becf0a12c3c8d99ca9abd15f2e2dfd7115f17c876a8e` | the available panel over the change map, 6.5 × 7 in (Option B) |
| `s0-current.pdf` | `e1ca1e9417e8f8abe646211eb93b4f7f0154f4309718b411b5883a5cfdcb595b` | the current figure redrawn by the lab: national panel pixel-identical to the manuscript PDF at 200 dpi, identical text (`fidelity/fidelity.txt`) |

Drawn by `R/fig27/F1-maps.R` with `R/fig27/fig27-common.R` (base graphics, `cairo_pdf`, Nimbus Sans, pointsize 10.5), reusing the production helpers of `chapter2-reconcile-refine-maps.R` read-only. The change cells with provenance and checks: `data/fig27/fig27-availability-change-cells.csv` (`.checks.csv`, `.provenance.json`); the palette: `data/fig27/fig27-change-palette.csv`.

## 3. Inputs (sha256 as pinned in the lab's `config/sources.json`)

| File | sha256 |
|---|---|
| `programming/output/pass2-reconcile-20261013/exhibits/generation-8e559d19ccc1/aggregates/cells.csv` (annual 100 km cells, 2019–2024) | `3893bc31200ca2d362b5387aec5c256ecaae4ab7c794191ff261f8f274308087` |
| `…/aggregates/candidate-01-eligible-points.parquet` (the manifest's point input) | `2989f3096763960efadb7fa7d351f2d9b595daad878e6189a824584f5ad773db` |
| `programming/output/reconcile-visual-refinement-20261014/exhibits/generation-91a7a2b80fd6/maps/candidate-01-population-accounting.csv` | `6af65f3324289d42e627b3f6853408dd1792824a57101ff6c10befa451ec0811` |
| `…/maps/map-refinement-manifest.json` (extents, insets) | `c9e8407752cb253c7ec1af55894f3a2d667bfcbbd1d5d2036d3755695de8fbde` |
| `programming/output/reconcile-visual-refinement-20261014/inputs/geoboundaries/basemap-geometry.json` | `a160f5f0dc84679e7c2f79b24d6fb65e865f15bfd7465381840236d82a6c9f5f` |

## 4. Code: `programming/R/chapter2-reconcile-refine-maps.R`

**Prerequisite.** Adopt the evidence copy's strings first (see the Figure 2.8 brief, section 4); the map generator is otherwise current as of 18 October.

**Change cells.** From `cells.csv` rows with `grid_km == 100` and `quality_scope == "all"`, merge 2021 and 2024 on `ix, iy` (outer join, missing counts as 0). `share = 100 * n_available / n_eligible` per year; `supported = n_eligible_2021 >= 50 & n_eligible_2024 >= 50`; `change_pp = share_2024 - share_2021` on supported cells; `class = cut(change_pp, c(-Inf, -5, -2, 0, 2, 5, Inf), labels = FALSE, right = TRUE)`. Expected: 1,193 cells in either year; 658 supported; 9 supported in 2021 only and 12 in 2024 only (gray with the rest); classes 1–6 hold 73, 82, 109, 125, 145, 124 cells; located shares 63.98% (2021) and 66.51% (2024); change range −47 to +20 points.

**Palette** (brick side matched to the navy side in OKLCH lightness and chroma): classes 1–6 = `#8D4B30 #BE856F #DCB7A8 #A9C4DE #6E9AC2 #2F6395` (as in `data/fig27/fig27-change-palette.csv`); gray `#CDD3D0` below support.

**Tiles.** 100 km cells with 15 km white gaps, as the Figure 2.8 decision: `rect(x ± 50, y ± 50, col = "white", border = NA)` then `rect(x ± 42.5, y ± 42.5, col = fill, border = NA)`, over the production background at the national extent fitted to the panel's aspect (`c2rr_map_fit_extent(views$national, aspect)`).

**Text.** All drawn text at cex 1 (10.5 pt), titles cex 1.1 bold, Nimbus Sans. Title `Change in the availability share by cell, 2024 against 2021`; subtitle `658 supported cells; located share 64.0% in 2021, 66.5% in 2024`; note lines `Change compares the 2021 and 2024 annual populations at registered addresses, not firms.`, `100 km cells with 15 km gaps; classes symmetric around zero at 2 and 5 points.`, then the two attribution lines unchanged.

**Layout, Option B (6.5 × 7 in page, unit-square window; inches from the bottom).** Top block: title top 6.83, subtitle top 6.64, national rectangle x .035–.775, y 4.15-6.50 in; Moscow inset x .80–.975, y 5.41-6.34 in with its two-line label ("Moscow", "N = 459,326") top at 6.64; St Petersburg inset y 4.15-5.08 in, label top at 5.38. Bottom block: title top 4.10, subtitle top 3.91, change panel x .035–.775, y 1.42-3.77 in; vertical legend in the inset column at x .80 from the subtitle line down (six swatches 0.13 in tall, 0.19 in apart, labels `over +5`, `+2 to +5`, `0 to +2`, `-2 to 0`, `-5 to -2`, `under -5`, then `<50 firms`); notes top at 1.17, lines 0.155 in apart. `R/fig27/fig27-common.R`, function `fig27_layout(7, TRUE, nat_h = 2.35)`, computes these.

**Layout, Option A page 2 (6.5 × 4.4 in).** Title top 4.23, subtitle 4.04, panel x .035–.975, y 1.38–3.90 in; horizontal legend: six touching swatches from x .06 to .62, 0.11 in tall, bottom at 1.08 in, boundary values `−47  −5  −2  0  +2  +5  +20` under the edges, `points` to the right, gray swatch and `<50 firms in 2021 or 2024`; notes top at 0.70 in. Page 1 is the current figure with the note-only changes; `fig27_layout(7, TRUE, nat_h = 2.35)` also gives a two-availability-panel layout that fits four note lines at 10.5 pt (lab candidate `b-availability-overlay` without its marks).

**Outputs.** `c2rr_refine_maps` refuses a non-empty output directory: new run id. Write the merged change cells (ix, iy, counts, shares, change, supported, class) and the class counts beside the maps, and add the class rule and palette to the manifest. Render locally (Nimbus Sans).

## 5. Manuscript edits (`chapters/02-opacity/05-results.tex`, lines 116–124)

- Line 116, after `Registered addresses may locate headquarters rather than production or employment.` add one sentence reading the map, written after Codex's render and the author's reading, in the form: `The second panel shows where the availability share rose or fell between the 2021 and 2024 annual populations; the change is between annual populations at registered addresses, not within firms.` (Option A: "second page".)
- Caption (line 121), Option A: `Located eligible firms with available and absent original statements, 2021, and the change in the availability share, 2024 against 2021`; Option B: `Located eligible firms with an original statement available, 2021, and the change in the availability share, 2024 against 2021`.
- Note (line 123): drop `approved`; add `The change map divides each supported 100 km cell's 2024 availability share minus its 2021 share into six classes symmetric around zero at 2 and 5 points; 658 cells hold at least 50 located eligible firms in both years, the rest are gray. The two annual populations differ in composition, so the change is not a within-firm change.` Option B also drops the sentence about separate availability panels.
- Registry strings only once the registry is approved. The `\includegraphics` line gains `page=` arguments under Option A.

## 6. Records and workflow (per `LaTeX/AGENTS.md`)

- Numbered before/after comparison of the manuscript file against the new render(s) for the author's review before synchronization.
- Dated evidence folder under `research/evidence/` with the figure import record (hashes), input identities, the checks in section 7, session information and an authorization note quoting the author's decisions of 18 October 2026.
- Decision record: a new descriptive display, the availability change between the 2021 and 2024 annual populations by 100 km cell, under Figure 2.7's number; the Figure 2.7 design otherwise unchanged by the author's decision; the geography rules (100 km cells, gray under 50) unchanged.
- Build, validator, page and exhibit counts (Chapter 2 stays at 12 exhibits), Overleaf synchronization under the default workflow unless the author says local only.

## 7. Checks to report

- Cells and classes as in section 4; the sum of 2021 eligible firms over cells 3,277,638 and of 2024 eligible firms 3,083,823; available 2,097,055 and 2,051,002.
- `pdfinfo` 468 × 504 pt (one page) or 468 × 504 and 468 × 316 pt (two pages); `pdffonts` NimbusSans only; smallest word height at least 10 pt (`pdftotext -bbox`).
- `pdftotext -layout` of the new change panel identical to the lab reference; the availability panel text identical to the manuscript file except the prefix and the registry titles if applied.
- Pixel comparison of the availability panel against the manuscript file at 200 dpi (expected zero differing pixels in the map area).
