# B4: Going dark before a recorded registry removal

Status: finalist. Rank: 1. Stage: B.

## Question
Do firms stop reporting original statements in the years before their registry removal, how far ahead, and did the profile differ between the Rosstat and FNS eras? The figure describes the retrieved release; it does not establish why a firm stops reporting, does not date a disclosure decision, and does not treat a registry removal as a verified business exit.

## Data
| Source name | Generation | sha256 (first 12) | Columns used |
|---|---|---|---|
| registry.2011 … registry.2025 (15 files) | 10b9d66eb2efe … 10b9d246463d5 (per year, in config/sources.json) | per file in config | year, eligible_raw, original_available, identity_consistent, date_issue, dissolution_date_reconciled |

Lab aggregates: `data/stage-b/B4-before-removal.csv` (year × years-before-removal; 135 rows), `data/stage-b/B4-universe-coverage.csv`, `data/stage-b/B4-removal-cohorts.csv` (36 rows drawn), `data/stage-b/B4-no-removal-reference.csv`. Provenance and the exact SQL: `data/stage-b/B4-before-removal.provenance.json`. Check: rows by horizon sum to the consistent universe in every year (pass).

## Construction
Universe: eligible records (`eligible_raw = 1`) with `identity_consistent` and `date_issue = 'consistent'`; this keeps 99.97 % of eligible records in 2021. For each record, `years_to_removal = year(dissolution_date_reconciled) − year`; NULL means no recorded removal in the release; 0 or negative means removed in that year. Group by financial year and horizon k. A removal cohort R is the set of records with year + k = R; cohorts are followed only within one provider era (no horizon crosses 2018 to 2019). Displayed cohorts: removals in 2015–2018 and 2022–2025, horizons 1 to 6. The reference for horizon k of cohort R is the availability of the no-removal group in financial year R − k. Rate = records with an original statement (filed and not imputed) over records.

Key values (2021 financial year): 1 year before removal 19.3 %, 2 years 39.9 %, 3 years 63.1 %, 4 years 68.0 %, no recorded removal 83.8 %, removed that year 1.7 %. Rosstat era (2015): 7.2, 14.2, 31.1, 50.3, 57.2 % for 1 to 5 years, 69.1 % for 6 and more, no removal 75.6 %.

## Encoding
Two rows of four panels (6.5 × 5.2 in). x: years before removal, 6 to 1, reversed so time runs left to right. y: 0–100 %. Blue line and points: the removal cohort; dashed gray line: no-removal reference in the same financial years; hollow points would mark horizons with fewer than 50 records (none occur). Gray text in each panel: records one year before removal. Text at least 10 pt; Nimbus Sans.

## Notes text (exact)
See `figures/20261007-polished/B4-going-dark-notes.tex`.

## Caveats
Removal is the reconciled registry dissolution date, a registry event. The no-removal reference is right-censored: some of those firms will be removed after 2025, which biases the reference down slightly in late years. Absence before removal is not evidence of non-submission or concealment; dormancy and liquidation procedures are not observed. The Rosstat-era cohorts sit low at every horizon partly because Rosstat coverage itself was lower.

## Reproduction
`scripts/lab-run.sh Rscript --vanilla R/stage-b/B4-before-removal-query.R` (3 s, 177 MB peak) then `scripts/lab-ro.sh Rscript --vanilla R/stage-b/B4-before-removal-figure.R`. Fresh-session check on 7 October 2026: PDF text identical, CSV identical.

## Replication notes for Codex
One DuckDB `GROUP BY year, horizon` over the 15 registry partitions (SQL in the provenance JSON). Base R: `layout(matrix(1:8, 2, 4, byrow = TRUE))`, per panel `plot()` with `xlim = c(6.4, 0.6)`, `lines()` for the reference (lty 2, gray) and the cohort (blue), `points()`, `text()` for the count; the `c2t5_exhibit_pdf` wrapper at 6.5 × 5.2 in and `c2_exhibit_palette()` primary and neutral. Nothing here authorizes a change.

## Case for prose (≤ 150 words)
The results section "Persistence, reappearance and registry removal" states that an absent history is informative about future observation. This figure gives that statement a time profile: among FNS-era removals, availability falls from near the reference level four or five years ahead to 20 to 30 % one year ahead, so absence is partly the leading edge of registry exit rather than a disclosure choice among continuing firms. One sentence after the survivor-model paragraph could say so, with the reference caveat. It does not show why firms go dark, and it must not be read as a prediction of removal.
