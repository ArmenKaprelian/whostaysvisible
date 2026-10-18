# Data-visualization lab (Claude-only)

An isolated sandbox for exploring novel, Tufte-grade displays of the dissertation's
data. The author judges the results; winners are migrated or replicated by Codex
through the existing programming workflow. Nothing here is a research record, a
manuscript source or an authorization. Created 6 October 2026 under the approved plan
in `~/.claude/plans/i-have-faith-in-sorted-jellyfish.md`.

## Isolation

- Everything outside this folder is read-only to the lab. Jobs run inside bubblewrap
  with the whole filesystem mounted read-only except this folder and a disk scratch
  directory under `/var/tmp`; a write under `programming/` or `LaTeX/` fails with a
  read-only filesystem error. `scripts/check-readonly.sh` lists anything that changed
  there during a run (expected: nothing).
- Inputs are pinned in `config/sources.json` (path, generation id, size, mtime, hash).
  `R/lab-sources.R` refuses an input that drifted. Re-pin deliberately with
  `scripts/pin-sources.py` when a selected generation changes.
- R runs with `--vanilla`, working directory here, never in `programming/` (its
  `.Rprofile` activates renv). DuckDB is in-memory, limited, and `lab_query()` refuses
  writing statements.
- Outputs: `data/` (lab aggregates with provenance and checks), `figures/<date>-*/`
  (PDF, PNG, notes snippet, figure JSON), `candidates/` (briefs), `gallery/`
  (contact sheet), `logs/<run>/` (console, RAM samples, peak, run.json).

## Running

```bash
scripts/ram-status.sh                                   # memory and job status with a verdict
scripts/lab-ro.sh  Rscript --vanilla R/stage-a/A1.R     # read-only job, no cap (KB inputs)
scripts/lab-run.sh Rscript --vanilla R/stage-b/B1-query.R   # guarded job: cgroup cap, watcher
scripts/lab-run.sh --max 4G Rscript --vanilla R/stage-b/B6-query.R   # one named heavy query
scripts/guard-test.sh                                   # synthetic 5 GiB allocation must be killed
scripts/pdf-check.sh figures/<folder>/*.pdf             # geometry, fonts, smallest word height
scripts/setup-lib.sh                                    # install extras into lib/ (internet)
```

Guard: `MemoryHigh=2G`, `MemoryMax=3G`, `MemorySwapMax=256M`, `OOMPolicy=kill`,
`CPUQuota=400%`; DuckDB 1536 MB, 2 threads, spill on disk scratch. Pre-flight refuses
when Codex's unit `rfsd-local-data` is active or its lock is held, when `MemAvailable`
is under 5 GiB or `SwapFree` under 1 GiB, or when `/var/tmp` has under 10 GiB free.
The watcher stops the lab unit after two samples with `MemAvailable` under 1.5 GiB or
`SwapFree` under 512 MiB. No service, timer or daemon is installed; the watcher dies
with the launcher.

## Principles checklist (every figure)

1. One question per figure, stated in the title or subtitle in the dissertation's terms.
2. Honest scales: counts and shares start at zero; log axes only for ratios, labelled.
3. Every rate with its denominator and N; every ranking with its rule; cells with
   fewer than 50 denominator firms gray and excluded from summaries.
4. Direct labels at series ends; legends only when strictly shorter than labels; group
   names in words, never codes or bit strings.
5. Palette roles: blue `#2166AC` principal, warm brick `#B35832` comparison, gray
   `#657680` context; single-hue sequential for ordered levels; brick-white-blue
   diverging around a meaningful zero; shape duplicates any colour that matters in gray.
6. Era shading from 2018.5; dotted ticks at 2014, 2020 (Decree 35) and 2022 "for
   context, not as causal comparisons"; no 2011 rate; no line across 2018 to 2019
   where the quantity is a transition; 2025 flagged.
7. Text at least 10 pt at the printed 6.5 in width; one figure per PDF, at most 7 in
   tall; notes in a separate `-notes.tex`, never drawn into the PDF.
8. Wording: descriptive association, never causation; supplied memberships are fixed
   lists, not dated designations; absence is never non-filing, concealment or
   withdrawal; a missing destination row is not an exit; removal takes precedence over
   a dissolution-year statement.
9. Numbers cross-checked against the saved aggregates and the manuscript before a
   figure is drawn (`<id>.checks.csv`).

## Figure 2.8 restyle study (18 October 2026)

Previews of the Chapter 2 cohort-inclusion map with five pooled quintile classes instead
of the continuous 0–100% ramp, in three cell shapes (gapped tiles, fixed circles,
graduated circles) and four palettes (classed navy, YlGnBu, Dark2 for comparison, a
navy/green two-hue version). Inputs are pinned as `fig28.*`; the production drawing
helpers are reused read-only from the evidence copy of
`chapter2-reconcile-refine-maps.R`. Run `R/fig28/F0-fidelity.R` (pixel-identical
re-render of the manuscript figure), `R/fig28/F1-render.R`, `scripts/fig28-compare.sh`,
`scripts/fig28-postprocess.sh` and `R/fig28/F2-gallery.R` through `scripts/lab-ro.sh`.
Ranking and reasoning: `candidates/fig28-ranking.md`; page: `gallery/fig28.html`;
palette checks: `scripts/validate_palette.py` (copied from the Claude Code dataviz skill).

## Decision log

- 2026-10-06: plan approved by the author; firm-level reads allowed including raw
  RFSD under the guard; scope limited to Chapter 2 opacity, sample selection and
  geography; judging by gallery plus top five; Codex stays idle during lab runs.
- 2026-10-18: Figure 2.8 restyle previews. The author chose pooled cell quintiles (one
  legend for both panels) and asked for Dark2 renders beside the ordered palettes for
  comparison; firm asset quintiles do not apply to a map of cell shares.
