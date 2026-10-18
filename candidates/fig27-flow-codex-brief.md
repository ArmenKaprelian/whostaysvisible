# Codex task brief: the sample-flow diagram (review Point 13, Item 3), Codex's own pass

Drafted by Claude on 18 October 2026 after the author rejected the lab's candidates; the author pastes it. It is a specification of content, constraints and direction, and an assessment, not an authorization. The terminology registry (Section 3 of the 18 October review) is not yet approved: every name below is the registry's proposed name and changes with it.

## 1. Author decisions and the design direction

- Review Point 13 (author choice pending between the two placements): a reader-level diagram of the Chapter 2 populations that shows what Table 2.1 says in words, that the populations "are not successive steps of one funnel". It draws two branches from the annual eligible population: one through the transition population to the resolved states, the survivor population and the financial-retention samples; the other from the 2021 eligible population to the four fixed 2021 cohorts and their annual dispositions. Counts come from Table 2.1, Table B.2 and Appendix Figure B.2; nothing is computed.
- The author's words of 18 October on the lab's last attempt (verbatim in `candidates/decisions.md`): "I was hoping for something more readable, less text ... and more visually easy to follow (the point of a flowchart)." The example the author attached, "a general example, not binding format", pairs a data-flow diagram (shapes by role, two to four words per node, every arrow labelled with what moves) with a flowchart (a start node, decision diamonds with labelled branches, process boxes, an end node). "Let's just give Codex what it needs to attempt its own pass at this."
- Direction that follows. One question under the title (for Chapter 1: which populations and samples the two empirical chapters use; for Chapter 2: which population answers which question). A handful of nodes, each a shape by role with a registry name of two to four words. Every arrow labelled with the rule it applies, in five words or fewer. Screens as decision diamonds whose "no" branch names the exclusion. No sentences inside nodes. At most one count per node, exact as printed; everything else goes to the caption, the note, Table 2.1, Table B.2 and the glossary table the registry creates.

## 2. Content: nodes, arrows and counts (registry names)

| Node (shape by role) | Count available (exact, as printed) | Source |
|---|---|---|
| Annual eligible population (population box, the single root) | 3,357,109 firms in 2021; 3,147,504 in 2024 | Table 2.1 |
| Annual registered population (population box) | 2,959,193 in 2021; 2,926,282 in 2024 | Table 2.1 |
| Transition population, following years 2020–2024 (population box) | 10,484,716 prior observers; 4,814,211 prior absentees | Table 2.1 |
| State in the following year (decision diamond; branches A, N, X, other) | prior observers: 9,323,396 available survivor (A), 860,366 absent survivor (N), 300,868 removed (X), 39 reporting-scope change, 47 unresolved; prior absentees: 462,941; 2,949,830; 1,401,172; 18; 250 | Table B.2 |
| Survivor population (population box; receives A and N) | 13,596,533 transitions; the survivor model retains 13,517,387 | Table B.2 |
| Financial-retention samples (sample box; prior observers only) | asset-quintile sample 9,975,404; joint-complete sample 7,326,875 | Table 2.1 |
| 2021 annual eligible population (the root's 2021 records) | 3,357,109 | Table 2.1 |
| Entry requirements (decision diamonds in the fixed order: original 2021 statement; usable outcome; usable resource share) | exclusions at the first failure: 1,138 unresolved identity; 1,226,797 without an original statement; revenue not usable 579,417 (margin 580,228); cash share not usable 46,559 (margin cohort 46,469); inventory share not usable 370,419 (370,016) | Figure B.2 (text layer), prose of the financial-sample section |
| Fixed 2021 cohorts (sample box) | revenue cohort by cash share 1,503,198; by inventory share 1,179,338; margin cohort by cash share 1,502,477; by inventory share 1,178,930 | Table 2.1 |
| Annual dispositions, 2019–2024 (end node or a short list) | usable outcome, original statement absent, missing required input, structurally unavailable, invalid domain, pending comparability, unresolved | Figure 2.9 |

Arrow labels the lab verified against the chapter's definitions: `registered at the year-end`; `paired with the following year`; `state in the following year`; `available and absent survivors`; `prior observers with usable accounts`; `the 2021 records`; `all requirements met`; `followed each year`. Models that could close each branch as terminal tags: eligible annual model, registered annual model, survivor model, size models and the six financial specifications, Chapter 3 regressions.

Every count above was checked by the lab against the pinned manuscript files and the text of Appendix Figures B.1 and B.2 (`Claude Code/current/dataviz-lab/data/flow/flow2-elements.checks.csv`, 29 checks, and `flow-nodes.checks.csv`, 44 checks). Two numbers the prose rounds ("about 46,500", "about 370,000") are exact in Figure B.2.

## 3. Constraints

- Geometry and type: 6.5 in wide, at most 7 in tall, and shorter is better (about 5 in suits the Chapter 1 placement); all text 10.5 pt or larger; Nimbus Sans; one figure per vector PDF; the note in LaTeX, not drawn.
- House default: an R base-graphics generator in `programming/`, exported like the other exhibits with hashes and a figure record. A TikZ figure compiled inside the manuscript is an alternative the author would have to authorize separately; it is not the default.
- Palette: navy and phthalo green for the two branches (`LaTeX/AGENTS.md` line 78), light fills, gray arrows and labels; brick stays reserved for the supplied-list overlays of the maps. The example's drop shadows and pastel fills are not required.
- Wording: registry names exactly; descriptive, no causal words; "transition" means a firm-year pair; the caption states that the branches are not successive steps of one funnel and that cohorts overlap.
- Numbers: one count per node at most, exact with thousands separators, none derived by arithmetic; the caption names the tables.

## 4. Placement

Chapter 1's Data section after Table 1.3 carries no exhibit cap and serves both empirical chapters; the review recommends it with Table 2.1 unchanged. Replacing Table 2.1 keeps Chapter 2 at twelve exhibits and returns about half a page of body text, but only once the registry's glossary table exists, since a diagram with two to four words per node carries no definitions. The author decides the placement after seeing Codex's draft.

## 5. What the lab tried and why it was rejected

Four text diagrams (boxes with definition sentences, 5 to 7 in tall) and a flowchart with proportional bars and count tables (6.95 in tall) are in `Claude Code/current/dataviz-lab/figures/20261018-fig27-gallery/` (`flow-*`, `flow2-*`) and on `gallery/fig27.html`. The author found them too dense and not easy to follow. They are not references to copy; the node specification and the checks are the parts worth reusing.

## 6. Records and workflow (per `LaTeX/AGENTS.md`)

- A draft render for the author's review before any manuscript integration (a new exhibit, so no before/after pair; a numbered proof page instead).
- A dated evidence folder under `research/evidence/` with the generator, the figure record (hashes), the count checks of section 7, session information and an authorization note quoting the author's decision.
- Decision record: the placement, and the figure-for-table decision if Table 2.1 is replaced.
- Build, validator, page and exhibit counts, Overleaf synchronization under the default workflow unless the author says local only.

## 7. Checks to report

- Every printed count equals its value in Table 2.1, Table B.2 or Figure B.2 (list them).
- Both branches leave the annual eligible population node; no node suggests that the cohorts are a subset of the transition population.
- `pdfinfo` 468 pt wide, at most 504 pt tall; `pdffonts` NimbusSans only; smallest word height at least 10 pt (`pdftotext -bbox`).
- Registry names exact; arrow labels five words or fewer; no node longer than four words plus one count.
