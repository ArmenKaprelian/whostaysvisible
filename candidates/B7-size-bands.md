# B7: Smaller firms go dark more often

Status: finalist. Rank: 5. Stage: B.

## Question
Among firms that reported an original statement last year, does the share reporting again rise with firm size, and did the gradient change after 2022? Descriptive. This previews the deferred Pass 2 "financial predictors among prior observers" family and is not an estimate.

## Data
| Source name | Generation | sha256 (first 12) | Columns used |
|---|---|---|---|
| registry.2012 … registry.2025 | per year in config | per file in config | year, source_row, inn_key, identity_consistent, eligible_raw, original_available |
| payload.2012 … payload.2024 | per year in config | per file in config | year, source_row, line_1600 |

Lab aggregate: `data/stage-b/B7-size-bands.csv` (120 rows: 12 years × 10 deciles) and `data/stage-b/B7-size-rates.csv`. Provenance holds the twelve per-year SQL statements. Check (pass): 2024 availability among prior observers with positive assets (90.9 %) within 5 points of the transition accounting's A share (90.4 %).

## Construction
For each financial year t in 2013–2018 and 2020–2025: records in t−1 with a consistent identity, an original statement and positive total assets (line 1600, thousand rubles) define the lag set; eligible consistent records in t are joined on INN; deciles of lagged assets are cut within year with exact quantiles; rate = records with an original statement in t over records in the decile. No lag crosses 2018 to 2019. Nominal and deflated assets give identical within-year ranks.

Key values: 2021, decile 1 (median assets 10 thousand rubles) 74.6 %, decile 10 (median 169 million) 93.6 %; 2024, 79.3 % to 95.1 %; 2013, about 70 % to 85 %. Each decile holds 205,000 to 216,000 firms in 2024.

## Encoding
Two panels (Rosstat era, FNS era), x = decile 1 to 10, y = 0–100 %, one line per year, gray before 2022 and blue from 2022, labels for 2013, 2018, 2020 and 2025. 6.5 × 4.8 in.

## Notes text (exact)
See `figures/20261007-polished/B7-size-bands-notes.tex`.

## Caveats
Conditioning on a prior original statement selects prior observers, so levels exceed the population rate. Size is the previous statement's total assets, not revenue or employment. Decile medians are reported in the subtitle; the smallest decile holds shell-sized balance sheets.

## Reproduction
`scripts/lab-run.sh Rscript --vanilla R/stage-b/B7-size-bands-query.R` (9 s, 939 MB peak) then `scripts/lab-ro.sh Rscript --vanilla R/stage-b/B7-size-bands-figure.R`. Fresh-session check on 7 October 2026: PDF text identical, CSV identical.

## Replication notes for Codex
Twelve per-year DuckDB joins of registry and payload on (year, source_row) and then on INN across adjacent years, exact `quantile_cont` cut points, `GROUP BY decile`. Base R: two panels with `lines()` per year; `c2t5_exhibit_pdf` at 6.5 × 4.8 in. Nothing here authorizes a change.

## Case for prose (≤ 150 words)
Not for Pass 1 prose: the financial-predictor analysis is a deferred Pass 2 family. The figure belongs in the Pass 2 brief as the descriptive baseline that the prior-observer models would have to adjust for, and it suggests that log real assets, already the approved size candidate, will carry a steep gradient at the small end.
