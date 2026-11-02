# "Denominator": a wording review (2 November 2026)

The author asked for a review of the word "denominator" across the published site (atlas, atlas details, film) and for a clearer, more conventional replacement, read against the dissertation's own use of the term. The rule was refined twice on the author's notes of the same day: first "name the set the share is divided by", then "say it in plain English". Nothing on the site or in the dissertation was changed; this note is the inventory and the proposal.

## What the word means in our use

In every case on the site, and in 28 of the dissertation's 35 uses, "denominator" stands for which firms a share counts: all eligible firms, or firms registered at year-end, or a cell's located eligible firms, or the firms followed from 2019. The word names the position of a number in a fraction, so the reader has to rebuild the fraction ("statements over firms") to know which firms are meant. It also does double duty in the dissertation, where it sometimes means the literal bottom of a formula's ratio (total assets under a stock change, the deflator cancelling from a ratio). The two senses should be separated.

## The rule (the author's notes of 2 November 2026)

**Say which firms the share counts, in plain words.** "Denominator" names a role, the bottom of a fraction. Replacing it with "population", "set" or "cohort" as a generic noun, or with "divides by", only restates that a fraction has a bottom. The real distinctions are few: all eligible firms, firms registered at year-end, a cell's located eligible firms, the firms followed from 2019, a group's firms, or a stated count. So:

- Every share is written as "the share of [these firms] with a statement". The word "of" names the firms, so no noun for the role is needed. The other words are "among", "out of" and "counted".
- A rule that applies across shares, such as the atlas's 50-firm rule, says it in counts: "a share is shown only for cells, squares and regions with 50 or more firms".
- A sentence that contrasts two ways of counting says so in those words: "which firms are counted", "count different firms".
- The dissertation's defined names ("annual eligible population", "transition population", "fixed 2019 cohort", "reference population") stay where a sentence already uses them for a specific thing. The rewrites add none of them.
- Not used: "population", "set" or "cohort" as a generic noun for the role; "divides by"; "sample" for a share of a population or cohort; "base" (it collides with chapter 3's "baseline").
- Keep "denominator" only where a formula's ratio is literally discussed (chapter 3's asset ratios, the deflator).

## The site: four visible uses

| Where | Now | Proposed | Cost |
|---|---|---|---|
| Film, 0:22 to 0:36 ("Availability over time"), burned-in subtitle; source `js/explainer-scenes.js:189` and the line labels at `:193-194` | Share of firms with a statement, by financial year and denominator; lines labelled "registered" and "eligible" | Share of firms with a statement, by financial year; lines labelled "all eligible firms" and "registered at year-end". The longer labels sit right of the chart, where the frame has room; the fit is checked frames first at the re-render. | A re-render of the 244 s film and a publish of the mp4 (26 MB) |
| Atlas, REFERENCES panel, Definitions, "The 50-firm support rule"; source `tools/glossary_build.py:47`, shipped in `data/glossary.js` | In the Cells view a share is shown only where 50 or more firms make up its denominator, and cells, squares and regions with fewer are grey. The Firms view shows each coordinate pair's own share. | In the Cells view a share is shown only for cells, squares and regions with 50 or more firms, and those with fewer are grey. The Firms view shows each coordinate pair's own share. | A wording change in one panel: approved by the request, proof by change-proof, crop sheet in the next publish review |
| Agent guide 2.17 (`agent-guide.md`, source `tools/agent_guide.py:237`) | In the Cells view a share is shown only where 50 or more firms make up its denominator. Cells, squares and regions with fewer are grey. | In the Cells view a share is shown only for cells, squares and regions with 50 or more firms. Those with fewer are grey. (The rest of 2.17 is unchanged.) | Rebuild of the guide, text only |
| Agent guide 5.2 (source `tools/agent_guide.py:277`) | The share of located eligible firms with an original statement, per cell and year. The denominator is the cell's located eligible firms that year. | The second sentence is dropped. The first already says which firms are counted, per cell and year. | Rebuild of the guide, text only |

Two adjustments to the author's examples, for accuracy: the glossary and 2.17 keep "cells, squares and regions", since the 1 km squares and the state-run layer's regions follow the same 50-firm rule, and the on-screen sentence joins its halves with "and", since the design principles allow no semicolon on screen (the text audit's wire rule counts one as a finding).

Not on screen, optional:

- `data/statesplit.js` provenance note: "codes without a level are counted in the denominator of municipal_share" could read "codes without a level are still counted in municipal_share".
- `data/series.js` key `history_bins.denominator`: a data key, not text. Renaming it to match the screen label ("firms followed") touches `explainer-scenes.js` and `R/motion/M4-series.R` and would be a refactor proved identical.
- Code comments (`explainer-scenes.js:358-359`, `treated-scenes.js:491`), `motion/README.md` (ten lines) and `design/principles.md:12` ("every rate with its denominator", which could read "every rate says which firms it counts"). Internal records; the author's call.

Checked and clean: the atlas's tooltips, legends, provenance lines and panel texts (`explorer-app.js`, `map-layers.js`), the site's home, film page, résumé, contact, research and writing pages, and the claude.ai pointer artifacts.

## The dissertation: 35 uses in the .tex sources, 2 in AGENTS.md

Read-only. Grouped by sense, with a rewrite for each.

**Keep (a formula's ratio), 4**

- `chapters/01-foundations/05-data-and-sources.tex:83` "ratios whose numerator and denominator use the same year and deflator".
- `chapters/03-financial-resilience/02-data-and-measurement.tex:48` "movements in the denominator of contemporaneous total assets".
- `chapters/03-financial-resilience/02-data-and-measurement.tex:58` "rather than a denominator that itself moves after 2022".
- `appendices/b-chapter2-evidence.tex:723` "a positive-revenue margin denominator".

**Reword as a count, 3**

- `chapters/03-.../02-data-and-measurement.tex:66` "The denominator as a share of the group's fixed baseline count measures coverage of valid nonnegative revenue" → "The number of accounts with valid nonnegative revenue, as a share of the group's fixed baseline count, measures coverage of valid nonnegative revenue".
- `chapters/03-.../02-data-and-measurement.tex:68` "Small denominators are identified." → "Group-years with few firms are flagged."
- `chapters/02-opacity/05-results.tex:124` "visible dots are not a firm-count denominator" → "the visible dots are not a count of firms".

**Say which firms are counted, 28**

- `introduction.tex:27` "whose registry frame also provides a denominator for statement absence" → "whose registry frame lists every eligible firm, with or without a statement, so that absence can be measured".
- `chapters/01-foundations/05-data-and-sources.tex:22` "with the population denominators defined separately" → "counting all eligible firms and, separately, firms registered at year-end".
- `...05-data-and-sources.tex:94` "an eligible registry population that includes firms whose statements are unavailable, providing a denominator for measuring absence" → "an eligible registry population that includes firms whose statements are unavailable, so that absence can be counted".
- `...05-data-and-sources.tex:132` "when firms with absent statements are removed from the denominator" → "when firms with absent statements are no longer counted".
- `chapters/02-opacity/02-data-and-samples.tex:9` "access restrictions, imputation, and denominator changes also affect the share" → "access restrictions, imputation, and changes in which firms are counted also affect the share".
- `...02-data-and-samples.tex:15` "combines rising statement counts and falling denominators" → "combines more statements and fewer firms counted".
- `...02-data-and-samples.tex:27` table header "Denominator and interpretation" → "Firms counted and interpretation".
- `...02-data-and-samples.tex:48` "Descriptive transition shares retain the full $\mathcal R_y$ denominator, separately by preceding-year availability" → "Descriptive transition shares are of every firm in $\mathcal R_y$, separately by preceding-year availability".
- `chapters/02-opacity/05-results.tex:4` heading "Availability Depends on the Population Denominator" → "Availability Depends on Which Firms Are Counted".
- `...05-results.tex:14` "Denominators retain all eligible records and the annual registered population." → "Shares are of all eligible firms, and separately of firms registered at year-end."
- `...05-results.tex:17` "consistent with changing denominator composition" → "consistent with a change in which firms are counted".
- `...05-results.tex:39` "Denominators are all eligible records in each annual legal-form group, including absent statements." → "Shares are of all eligible firms in each annual legal-form group, including those with absent statements."
- `...05-results.tex:114` "A + N + X + scope changes + unresolved status exhaust that denominator." → "A + N + X + scope changes + unresolved status together account for every firm eligible and registered at the preceding year-end." (Long, but it is the definition.)
- `chapters/02-opacity/06-group-comparisons.tex:48` "using each group's full fixed-cohort denominator" → "each out of all firms in the group followed from 2019".
- `chapters/02-opacity/07-financial-sample-implications.tex:18` "The two panels use the same denominator, cell grid, and five-class scale" → "The two panels count the same located eligible firms of 2021 and use the same cell grid and five-class scale".
- `tables/chapter2/history-aaa.tex:21` (two) "Denominators retain subsequent removal, reporting-scope changes and unresolved histories." → "Firms later removed, with reporting-scope changes or with unresolved histories stay counted."; "denominators remain shown" → "the firm counts remain shown".
- `appendices/a-supplementary-material.tex:176` "Available, absent, removed, reporting-scope change, and unresolved exhaust the denominator." → "Available, absent, removed, reporting-scope change, and unresolved together account for every firm."
- `...a-supplementary-material.tex:186` "The list-pattern history percentages use each full fixed-cohort group denominator." → "The list-pattern history percentages are of all firms in each group."
- `...a-supplementary-material.tex:187` "Subsequent removals, reporting-scope changes, and unresolved histories remain in the denominator." → "Subsequent removals, reporting-scope changes, and unresolved histories stay counted."
- `...a-supplementary-material.tex:197` "The cohort maps use the 2021 eligible denominator." → "The cohort maps show each cell's cohort firms out of its located eligible firms in 2021."
- `...a-supplementary-material.tex:199` "a subgroup denominator of at least 50" → "a subgroup of at least 50 firms".
- `...a-supplementary-material.tex:203` "Population, retained-sample, and fixed-cohort denominators are distinct." → "Population, retained-sample and fixed-cohort shares count different firms."
- `appendices/b-chapter2-evidence.tex:4` "Annual populations, transition populations, samples of continuing firms, and fixed 2021 cohorts have different denominators." → "...count different firms." The author's example adds "so their shares are not comparable"; the original states no such inference, so the clause is the author's call.
- `...b-chapter2-evidence.tex:11` and `:15` caption "Statement availability under both annual population denominators" → "Statement availability among all eligible firms and among firms registered at year-end".
- `...b-chapter2-evidence.tex:79` "Prior-state denominators exhaust A + N + X + reporting-scope change + unresolved before continuing-firm restriction." → "Within each prior state, A + N + X + reporting-scope change + unresolved together account for every firm before the continuing-firm restriction."
- `...b-chapter2-evidence.tex:681` "The 2014 A/N/X denominator includes all firms eligible and registered at year-end 2013, including 278 reporting-scope changes and 104 unresolved cases." → "The 2014 A/N/X shares are of all firms eligible and registered at year-end 2013, including 278 reporting-scope changes and 104 unresolved cases."

**AGENTS.md (shared with Codex), 2**

- line 40 "windows, cohorts, outcomes, denominators, measurement rules" → "windows, cohorts, outcomes, which firms each share counts, measurement rules".
- line 80 "the denominator and ranking rule" → "which firms are counted and the ranking rule".

The decision record (`research/decision-record.md`) uses the word in about twenty entries; those are dated records and were not reviewed for change.
