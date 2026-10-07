# A1: Original availability by supplied list, 2012–2025

Status: finalist. Rank: 3. Stage: A. Companion table: A2 (`figures/20261007-sketch/A2-sparkline-table.pdf`).

## Question
Do firms on each supplied list show different original availability than other eligible firms, before any model, and did the gap move at the 2019 provider change, Decree 35 (2020) and 2022? The figure is descriptive: lists are fixed supplied files with overlaps, not dated designations, and nothing in it identifies an effect of designation.

## Data
| Source name | Generation | sha256 (first 12) | Columns used |
|---|---|---|---|
| acct.annual-membership-shares | 10b9d50c61438 | 1a32cede31db | year, membership_group, membership_level, eligible_rows, eligible_available, eligible_registered, registered_available |
| acct.annual-accounting | 10b9d50c61438 | 626ed47c53cb | year, eligible_rows, eligible_available (checks) |

Lab aggregate: `data/stage-a/A1-availability-by-list.csv` (168 rows: 6 groups × 2 levels × 14 years). Checks (all pass): levels plus unknown-key records sum to the annual eligible population; 2021 share 63.43 % and 2024 share 66.28 % as in the manuscript.

## Construction
For each list (sanctioned, decree, residents, government strategic, presidential strategic, and the administrative union) and financial year 2012–2025: rate = eligible records with an original statement over eligible records, separately for level 1 (listed) and level 0 (all other eligible records, which include members of the other lists). The registered-at-year-end rate is saved in the CSV but not drawn. 2011 is excluded (no originals in the release).

Key values, 2024, listed versus others: sanctioned 52 % vs 66 % (3,726 listed records), decree 47 % (113), residents 5 % (21), government strategic 9 % (937), presidential strategic 41 % (127), any administrative list 15 % (1,114). In 2018 the same groups stood at roughly 80, 97, 78, 65, 80 and 70 % against 48 % for others.

## Encoding
Six small multiples (2 × 3), common 0–100 axis, era shading from 2018.5 with dotted ticks at 2014, 2020 and 2022; the lines break at the provider change; blue listed, gray others; end labels with the 2024 value and the listed count. 6.5 × 7 in.

## Notes text (exact)
See `figures/20261007-polished/A1-availability-by-list-notes.tex`.

## Caveats
The fall between 2018 and 2019 coincides with the change from the Rosstat archive to the FNS resource; the decision record treats them as different collections, so no within-firm reading across the break is possible. The residents list has 21 to 22 eligible records and is below the 50-record support rule (gray in the companion table). The "others" line is not the manuscript's `00000` comparator; B5 supplies that pattern exactly.

## Reproduction
`scripts/lab-ro.sh Rscript --vanilla R/stage-a/A1-availability-by-list.R` (2 s, no guard needed). Fresh-session check on 7 October 2026: PDF text identical, CSV identical.

## Replication notes for Codex
Reads one saved accounting CSV; base R `layout(matrix(1:6, 3, 2, byrow = TRUE))`, `c2t5_exhibit_era()` for shading and ticks, two `lines()` per panel split at 2018/2019, `text()` end labels. The D3 proposal of 6 October 2026 described this figure; it remains an unimplemented proposal and the author's approval is required to add it.

## Case for prose (≤ 150 words)
The group-comparisons section opens with "Availability differs sharply across the supplied membership groups". This figure shows that difference model-free for every list over the whole release and adds one fact the models cannot: in the Rosstat archive the same groups were above other firms, and the reversal sits exactly at the provider change. That supports the data section's statement that the Rosstat archive and the FNS resource are distinct collections and should be cited there, with the caveat that it is not evidence of behaviour. Two sentences at most; the fitted comparisons remain the chapter's evidence.
