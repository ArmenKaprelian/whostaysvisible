# B2: Original availability by industry and financial year, 2012–2025

Status: finalist. Rank: 4. Stage: B.

## Question
Which industries report originals most and least, is the ordering stable, which moved in 2022, and how large was the provider break per industry? Descriptive; released two-digit OKVED classes; no composition decomposition.

## Data
| Source name | Generation | sha256 (first 12) | Columns used |
|---|---|---|---|
| registry.2011 … registry.2025 (15 files) | per year in config/sources.json | per file in config | year, industry2, eligible_raw, original_available, registered_year_end |

Lab aggregates: `data/stage-b/B2-industry-year.csv` (1,000-odd rows, all classes), `data/stage-b/B2-industry-heatmap.csv` (rows drawn), `data/stage-b/B2-industry-side.csv` (2021 share and 2018 to 2019 change). Checks (pass): per-year sums equal the annual accounting exactly.

## Construction
Group by financial year and two-digit class; records with a missing or malformed class form one row. Rows: classes holding at least 1 % of 2021 eligible records (20 classes), the remaining 73 classes pooled, and the missing-class row, sorted by the 2021 rate. Cell value = eligible records with an original statement over eligible records. Margin columns: change from 2018 to 2019 in points, and the class's share of 2021 eligible records. Industry names are the ones used in the production exhibit module (`R/chapter2-task5-exhibits.R`).

Key values, 2024: human health 85 %, architecture and engineering 78 %, computer programming 72 %, metal products 73 % (+13 points at the break), wholesale trade 63 % (19.3 % of firms), membership organisations 48 % (−6 at the break), transport support 50 %; records without a class 1 %.

## Encoding
Numbers-in-cells heatmap, 22 rows × 14 years, single-hue blue ramp on a fixed 20 to 90 scale, white text on dark cells, a vertical rule at the provider change, two gray margin columns. 6.5 × 7 in.

## Notes text (exact)
See `figures/20261007-polished/B2-industries-notes.tex`.

## Caveats
The 2018 to 2019 column is a measurement break. Pooled and missing rows are not industries. Rates are shares of records, not of firms' economic weight.

## Reproduction
`scripts/lab-run.sh Rscript --vanilla R/stage-b/B2-industry-year-query.R` (2 s, 219 MB peak) then `scripts/lab-ro.sh Rscript --vanilla R/stage-b/B2-industry-year-figure.R`. Fresh-session check on 7 October 2026: PDF text identical, CSV identical.

## Replication notes for Codex
One DuckDB `GROUP BY year, industry2`; base R `image()` or `rect()` with `text()` in cells, `axis()` labels, margin `text()`; `c2t5_exhibit_pdf` at 6.5 × 7 in; the fill ramp from `colorRampPalette` on the palette primary. Nothing here authorizes a change.

## Case for prose (≤ 150 words)
Weak case for the main text; a possible appendix exhibit beside the industry inclusion figure. It documents why industry enters the models as an absorbed control (level differences of 30 to 40 points that are stable over years) and shows the provider break is uneven across industries, which matters for any early-era comparison in Pass 2.
