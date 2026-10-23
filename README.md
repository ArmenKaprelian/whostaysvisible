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

## Figure 2.7 gallery (18 October 2026)

Candidates for Points 20, 22 and 13 of the Chapter 2 author-points review: the Figure 2.7
redesigns (one panel or two, both supplied lists in warm brick over the navy or phthalo-green
population, the current availability panels with the overlay), the availability-change map
2024 against 2021 on 15 km gapped tiles, a composite page, and the sample-flow diagram in TikZ
and R for two placements. Inputs are pinned as `fig27.*` and `flow.*`. Run
`scripts/ram-status.sh`, then `scripts/lab-run.sh Rscript --vanilla R/fig27/F1-maps.R`
(guarded: 3.28 million points), `scripts/lab-ro.sh Rscript --vanilla R/flow/F1-flow.R`,
`scripts/lab-ro.sh scripts/flow-build.sh` (pdflatex), `scripts/lab-ro.sh scripts/fig27-postprocess.sh`
and `scripts/lab-ro.sh Rscript --vanilla R/fig27/G-gallery.R`. Ranking (provisional until the
terminology registry is approved): `candidates/fig27-ranking.md`; page: `gallery/fig27.html`.

## Motion study (22 October 2026)

A Claude Motion-style explainer (`motion/explainer.html`, 182 s, captured to `motion/build/who-stays-visible.mp4`)
and an interactive atlas (`motion/explorer.html`) over the Chapter 2 aggregates, with a new data pass
`R/motion/M1-M5` (basemap, 100 km cells, density at 5 km / 1 km / 250 m, chart series and facts, and
availability by cell for every year 2014-2025 from the foundation partitions). Inputs are pinned as
`motion.*` (`scripts/pin-sources.py --only motion`); outputs sit in `motion/data/` with provenance and
checks. `scripts/lab-run.sh` now takes `--max SIZE`, `--cpu`, `--duck-mem`, `--duck-threads` and
`--duck-temp` (the author lifted the small memory cap for this study; the ceiling is a crash guard).
Capture: `scripts/motion-capture.sh` (host-side, headless Brave over the DevTools protocol, ffmpeg;
since 23 October sharded across cores with `--shards N`, default 4, joined losslessly and checked with
ffprobe). Round 2 (23 October) added the ColorBrewer palette (YlGnBu, PRGn, red reserved for listed
firms), the text audit (`?__audit=1`, `capture.py --audit`, `motion/tools/audit.py`), the firm-level
Moscow pass `R/motion/M6-treated.R` (rasters and listed-firm data, local only) and the treated cut
`explainer.html?cut=treated`. See `motion/README.md` for the storyboard, checks, run order and verification.

## Decision log

- 2026-10-06: plan approved by the author; firm-level reads allowed including raw
  RFSD under the guard; scope limited to Chapter 2 opacity, sample selection and
  geography; judging by gallery plus top five; Codex stays idle during lab runs.
- 2026-10-18: Figure 2.8 restyle previews. The author chose pooled cell quintiles (one
  legend for both panels) and asked for Dark2 renders beside the ordered palettes for
  comparison; firm asset quintiles do not apply to a map of cell shares.
- 2026-10-18: Figure 2.7 gallery (Points 20, 22, 13) built; labels use the proposed registry names; ranking provisional until the registry is approved. Author picks pending.
- 2026-10-18 (later): author's picks recorded; Figure 2.7 kept, the change map adopted (layout to Codex, brief in candidates/fig27-change-codex-brief.md), the diagram redone as a flowchart (flow2, `R/flow/F2-flowchart.R`).
- 2026-10-18 (evening): the flowchart was rejected too (still too dense); Codex makes its own pass from candidates/fig27-flow-codex-brief.md. Gallery phase closed for Points 20, 22 and 13.
- 2026-10-22: motion study approved from `~/.claude/plans/can-you-within-your-elegant-lantern.md`. Author answers: any data, including new analyses run in the lab, as long as nothing touches the rest of the project; local build, then private claude.ai artifacts; firm-level reads allowed, published pages carry binned aggregates only; length by quality; dark cinematic look held to Tufte principles; no 3 or 4 GB memory cap on local work (crash guard only).
- 2026-10-23: motion round 2 approved (same plan file, round-2 section). Author decisions: Aeroflot anchors the treated-firm sequence; undated list members red from the first frame (residents list from 2020); control metric = each firm's real revenue against its own 2019-2021 average; the sequence is its own cut, rendered for approval, then offered as a splice. Second note: report state shares and class spread, add the causal caveat to the close, keep three dark meanings apart (no-baseline firms as a faint backdrop only, dark reserved for baseline firms without a statement, a pile with any filers takes the filers' colour), ask before changing breaks or what a mark means. Third note: shard the capture across cores before any render. After the first render the author chose the proposed class breaks -50 / -20 / 0 / +50 / +150 (M6 re-run, treated cut re-rendered). Pending: the review of the treated cut, the splice.
