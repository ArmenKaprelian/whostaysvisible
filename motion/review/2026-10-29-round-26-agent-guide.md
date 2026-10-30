# Round 26 (29 October 2026): the full agent guide

The author's requests of 29 October 2026: a guide for a reader's AI agent "with as many words as you like but that are not redundant and are specific and precise", holding nothing that is not in the Visibility Atlas; then "wire it in".

## The text

The approved draft is `review/2026-10-29-agent-guide-v2.md` (d5a0a54). It was written from a text snapshot of the page in 144 states (`tools/text-snapshot.js`), the page's visible text at load, screenshots of the chart cards and the code of every control it describes. A separate fact-check compared each claim with the snapshot and the code and found 27 items (values the charts do not print, a sentence from the old guide that no atlas text holds, controls described wrongly, gaps and repetitions), all fixed before the draft was committed. The author chose to leave out the Firms view's tile line on the film's two firms.

The built guide is the draft with these changes, made so that nothing in it depends on the viewport or needs a hand to stay current:
- the pixel size (4.4), the search radius (6.3) and the revenue mix's percentages (7.2) are no longer quoted, since they change with the window and the view
- the per-class counts of cells and regions in 5.3, 5.4 and 5.8 are left to the legend, which shows them
- the region example in 7.4 is a pattern ("N of M firms ...") in place of Moscow Oblast's figures
- the 5.1 example names the busiest 5 km cell, and the 5.6 example the 100 km cell with the most cohort firms, which is the one over Moscow
- 14.4 quotes the CORRECTIONS entries as the page shows them, read from `js/explorer-app.js`
- 1.3 no longer cites 5.1 for shares

## The builder

`tools/agent_guide.py` keeps its interface (`build(data_dir, published=None)`, `check(motion_dir)`, `js_of`, `rules`, `GUIDE_URL`), so `publish-set.py`, `atlas-audit.py` and `audit_five.py` call it unchanged. The text is one template (`TEMPLATE`). `figures(data_dir)` computes each figure from the field the page reads, with `tools/jsfmt.py`'s rounding:
- `series.json`: the release, the records, the eligible and available counts, the national chart's end values, the groups, the size ratios, the transitions and removals, the 2019 cohort
- `cellsyears.json`: the eligible and located totals by year
- `treatednational.json`: the firms on the lists, the undated and inferred, the firms added by year (the context line's rule) and the red button's counts (`manualMask`'s rule)
- `firms.json`: the Firms view's totals, the other geocodes, the largest pair, the median real-revenue change
- `cells100.json`, `cells25.json`: the change layer's totals, the cohort classes, the Moscow examples
- `regions.json`, `profiles.json`, `shared.json`, `statesplit.json`, `density.json`, `basemap.json`: the leading division, Moscow's figures, the Russia medians, the shared pairs, the state-run split, the busiest 5 km cell, the city windows

The rules replace the 1,200-word cap and the six sections: numbered sections from 1, paragraphs numbered within their section, every layer label of the page's `LAYERS` named and every layer id in 10.4 (the old guide had missed two layers since round 16), with the semicolon, "listed" and public-release rules as before. Each new rule was tested on a broken copy and reports it.

## Checks

- The guide built from today's data equals the approved draft with the changes above, character for character.
- `agent_guide.py --check`: 0 findings. `publish-set.py --texts`: the guide as published keeps the rules, CORRECTIONS within the audit's rules, the glossary check passes.
- `change-proof.py` against d5a0a54 (`build/proof-guide-v2`): two text groups changed, `/fixed/guide` at 1,600 and 400 px. 0 of 88 frames differ, the map outside its panels is unchanged, and there are no new rule hits. The guide has no layout of its own, so under the review rule it needs no frames.
- The 1,600 px audit (`audit-five.sh --widths 1600`, 20261029T195701-0400): 284 states, 13,078 boxes, zero findings in 4 min 11 s, the guide's check and TEACH YOUR AGENT's copy check included. A first attempt called `atlas-audit.py` directly with no server running, and it stopped on an empty page. The wrapper serves `motion/` itself.

## The publish gate (30 October 2026, UTC)

The author said to run the gate. `publish.sh`, first run:
- the text rules passed
- the five-width audit (20261029T201009-0400) had 1,376 states, 63,817 boxes and zero findings in 7 min 49 s, recorded for e8b1e49
- the publish set is 141.2 MB, with the guide rebuilt and dated 30 October 2026, and `publish/agent-guide.md` equals `build(data, published='30 October 2026')`
- the publish copy is 0fa5515, pushed
- the site's import 620618b changes `atlas/agent-guide.md`, `atlas/js/agent-guide.js` and the build line in `atlas/index.html`

Nothing is public until the author runs `publish.sh --push`.

## Published (30 October 2026, UTC)

The author ran `publish.sh --push`. The site's check had zero findings in both engines (34 page loads, 42 s, `build/site-check/20261030T001910Z`), and it pushed 6650f2b..620618b. The live `agent-guide.md`, fetched through the github.io address's redirect to armenkaprelian.com, equals `publish/agent-guide.md` byte for byte, and the atlas page's build line reads e8b1e49.
