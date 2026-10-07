# <id>: <title>

Status: candidate | finalist | picked | dropped. Rank: <n>. Stage: <A|B|C>.

## Question
One sentence in the dissertation's terms, and what the figure does not establish.

## Data
| Source name (config/sources.json) | Generation | sha256 (first 12) | Columns used |
|---|---|---|---|

Lab aggregate: `data/<stage>/<id>.csv` (sha256 …); provenance `data/<stage>/<id>.provenance.json`; checks `<id>.checks.csv`.

## Construction
Keys, numerators and denominators, support rule, sort or ranking rule, exact SQL or R steps.

## Encoding
Marks, scales (axis limits, log or linear), colour roles, label rules, sizes (6.5 x h in, text ≥ 10 pt).

## Notes text (exact)
Source: …

## Caveats

## Reproduction
`scripts/lab-ro.sh Rscript --vanilla R/stage-?/<id>-figure.R` from `data/<stage>/<id>.csv`; fresh-session check: PDF text identical, CSV byte-identical.

## Replication notes for Codex
Base R equivalents (layout(), rect, segments, points, text; the c2t5_exhibit_pdf wrapper; c2_exhibit_palette() names), or ggplot2 if Codex adds it. Nothing here authorizes a change.

## Case for prose (only when warranted, ≤ 150 words)
Which passage it would support; what it does not show.
