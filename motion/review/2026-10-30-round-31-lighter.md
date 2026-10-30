# Round 31: a lighter atlas, no visible change (30 October 2026)

Round 30's plan, second half: dead code, idle work, a lighter first load, the address files and a tidy of the pipeline, with nothing on screen changing. The author asked for audits kept to an essential minimum in this round (a one-time exception, no rule change), so each step was checked by its change proof against the build before it, plus one 1,600 px audit where an audit check itself changed. The publish gate's five-width audit is unchanged.

## The steps

- **D, dead code and unused startup work** (9f05779). The 1 km city windows were decoded and turned into about 251,000 paths at load, though the page read only their totals. The windows' 1 km cells and the national grid's share paths went too, along with ten unused test hooks, `fitNational`, `firmPalette` and the atlas's copy of the film's core-ramp tables. Unused shared code went as well: `charts.js`'s slopes, dot whiskers and history strips, `map-layers.js`'s `chooseLod` and `motion-core.js`'s `mulberry32`. The film's frames are unchanged.
- **L, a lighter first load** (1ecbff3, 92cba29). `cellsyears.json` carried the city windows' 1 km cells (2.1 MB), which the atlas never read. M5 now writes them to `cellsyears-city.json`, read by M7, and keeps each window's yearly totals, which the page, M11 and M12 read. `industry.json` carried the 25 km grid (3.75 MB), which M11 now writes to `industry25.json`. The two 25 km files load after the first draw, in idle time, and `A.ready()` waits for them. M11's crosswalk sample is ordered by a hash of each firm's source row instead of `random()`, so its check is reproducible.
- **M, the address files' version 4** (5cb5944). The years share most of their addresses, and the coordinates were 8 of each record's 33 bytes and most of the gzipped size. `firms-coords.bin.gz` holds every address of every year once (1,115,431, sorted by x then y, stored as deltas). Each year's file holds a bitmap over those addresses and the year's columns. Every year decodes to the version-3 file byte for byte. M9 no longer writes the base64 `.js` twins, which nothing has read since round 21. The mix columns stay in each year's file, because the industry 1 km squares read them in every year, so round 30's measured plan of a separate mix file was not followed.
- **Q, the pipeline tidy** (0cd87b0, a1ff9b8; the author's request of 30 October 2026, after it had first been left out as minor). `js/agent-guide.js` holds only the link. The guide's text, which the page never showed, is the lab's `agent-guide.md` beside the page, and the publish set keeps writing its dated copy there. The profiles' short form, unshown since the tile lost its profile in round 30, leaves `insights.json`; the drafts keep it. `groups.json` no longer ships the 100 km cells, which no page draws; their counts stay in `support_counts`.

## Sizes

| | Round 30 | Round 31 |
|---|---|---|
| Scripts and data before the first draw | 14.8 MB (4.1 MB gzipped) | 6.5 MB (1.7 MB gzipped) |
| A year switch in the Firms view | 6.5 MB | 4.0 MB |
| The Firms view's first year | 6.5 MB | 7.7 MB (the coordinates, 3.7 MB, once) |
| All twelve years | 79.6 MB | 52.1 MB |
| `js/agent-guide.js` | 37 KB | 0.3 KB |
| `data/insights.js` | 74 KB | 65 KB |
| `data/groups.js` (the Groups layer's first use) | 195 KB | 82 KB |
| The publish set | 141.1 MB | 112.7 MB |

The Firms view's first year costs 1.2 MB more than before. Every later year costs 2.5 MB less.

## Checks

- Change proofs: D, L, M and Q came out identical (no string, no frame and no rule hit differs). For L, M and Q the base was the previous commit's page served with the previous data, since `change-proof.py --base` links data to the lab's current files. `groups.json` was checked by structure instead: it equals the previous file without `cells100`, with its basis line updated, and no page or tool reads the key.
- M9: 351 of 351 checks, including read-backs of every year through the coordinates file. A separate decode of all twelve years against the published version-3 files matched every column. `shared_pairs.py` reads version 4 and passes 60 of 60 checks, and its outputs are byte-identical.
- Q: `agent_guide.py --check` (0 findings; it now compares `agent-guide.md` and the twin), `insights_build.py` (8 of 8) and `glossary_build.py --check` (0). The lab's `agent-guide.md` equals the text that HEAD's twin carried. The text snapshot reads the guide from `agent-guide.md` when the page has no `AGENT_GUIDE`, and it leaves the profiles' short form out of both builds. The audit's TEACH YOUR AGENT check now compares the link, and the audit's fixed checks at 1,600 px (16, the profiles and TEACH YOUR AGENT among them) had zero findings.
- The publish set's dry run on a1ff9b8: every twin against its JSON, 26 JSON files against their provenance's hash, 193 links, all expected.
- The film: frames unchanged after D (the only step to touch shared code).

## Not done

- Smoother interaction (the plan's I): pointer moves and resizes are not coalesced, because browsers already deliver each once per frame. The tile still moves by `left` and `top`: a transform would save the layout of one absolutely placed box per move, and it could shift the tile's text by subpixel rendering.
- Speed in the author's Brave, which needs the author present.
- Comments stripped from the published copy: no JavaScript parser is installed, and a regex would break strings that hold `//`.
- The DejaVu subset (343 KB to about 15 KB) needs `fonttools`, which is not installed.
- On disk only: the 12 old `firms-YYYY.js` twins (about 107 MB, git-ignored, stale since this round) were deleted from `motion/data/firms/` on the author's OK of 30 October 2026.
