# B6: Six-year reporting histories of the 2019 registered population

Status: finalist. Rank: 2. Stage: B.

## Question
Which sequences of available, absent, removed and no-record states are most common among firms eligible and registered in 2019, and when do histories break? The figure describes the retrieved release in the FNS era; it does not date disclosure decisions and does not follow firms entering after 2019.

## Data
| Source name | Generation | sha256 (first 12) | Columns used |
|---|---|---|---|
| registry.2019 … registry.2024 (6 files) | 10b9d382646ef, 10b9d3c8381fa, 10b9d5d363d92, 10b9d826b541, 10b9dafdc90e, 10b9d1db9b6af | per file in config | inn_key, year, eligible_raw, original_available, registered_year_end, identity_consistent |

Lab aggregates: `data/stage-b/B6-histories.csv` (161 histories), `data/stage-b/B6-top-histories.csv` (22 shown plus the pooled rest), `data/stage-b/B6-summary.csv`. Provenance with the exact SQL and state definition: `data/stage-b/B6-histories.provenance.json`. Check: histories sum to the 2019 universe of 3,413,062 eligible registered consistent firms (pass).

## Construction
Population: firms with a non-blank, identity-consistent INN that were eligible and registered at year-end 2019 (states A or N in 2019). State per firm-year, in precedence order: X if `registered_year_end = false` (recorded removal by year-end takes precedence over a dissolution-year statement); A if eligible with an original statement; N if eligible, registered and without an original; O for any other record (ineligible or unresolved registration); blank when no record exists in that year. The six states are concatenated per firm and counted. Summary: 36.2 % AAAAAA; 41 % of firms absent in 2019, of which 67 % had a recorded removal by 2024; 6.2 % NNNNNN; 13.6 % NX followed by no record.

## Encoding
Rows: the 22 most common histories plus "all other histories" (10.4 %); columns 2019–2024 as colored cells with the state letter (A blue, N brick, X dark gray, blank light); right: share of the 2019 firms and count. 6.5 × 7 in; legend at the bottom.

## Notes text (exact)
See `figures/20261007-polished/B6-histories-notes.tex`.

## Caveats
A blank after X is expected; a blank without a prior X would be a record gap, not an exit (none appears in the top histories). Eligibility can change, so O records exist but are rare in the top rows. The population excludes firms registered after 2019 and firms with inconsistent identity (0.03 %).

## Reproduction
`scripts/lab-run.sh Rscript --vanilla R/stage-b/B6-histories-query.R` (12 s, 2.05 GB peak under the 3 GB cap) then `scripts/lab-ro.sh Rscript --vanilla R/stage-b/B6-histories-figure.R`. Fresh-session check on 7 October 2026: PDF text identical, CSV identical.

## Replication notes for Codex
One DuckDB query: per-firm-year state, pivot by `inn_key` with `max(CASE WHEN year = … THEN state END)` for six years, then `GROUP BY history`. Memory about 2 GB at two threads; on Lightning trivial. Base R: `rect()` grid for cells, `text()` for letters, `barplot()` or `rect()` for shares; `c2t5_exhibit_pdf` at 6.5 × 7 in. Nothing here authorizes a change.

## Case for prose (≤ 150 words)
The transitions figure and table in the results section report one-year destinations. This figure shows the whole six-year path: a third of the 2019 population reported every year, and absence in 2019 led to a recorded removal within three years for two thirds of the absent firms. It supports the manuscript's sentence that the difference in subsequent availability "accompanies a substantial difference in registry destinations" and quantifies it along the full path. A sentence in the same subsection could cite it. It does not identify disclosure decisions, and the pooled "other histories" row must be kept.
