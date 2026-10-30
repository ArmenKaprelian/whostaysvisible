# Round 29: Crimea and Sevastopol drawn as regions

30 October 2026 (UTC). The author decided that Crimea and Sevastopol are drawn like every other region: navy land, borders, hover names and fill, and their own rows in the region figures in place of "outside the basemap outline". The occupied parts of Donetsk, Luhansk, Zaporizhzhia and Kherson stay outside the outline. The author picked the names Crimea and Sevastopol, and chose to have REFERENCES name the added sources plainly. Any disclosure is the author's to write. The author approved the change from before/after frames: `review/2026-10-30-round-29-frames.html`, a self-contained page that git does not track.

## Sources (b640e6a)

- **Region shapes.** geoBoundaries gbOpen UKR ADM1, simplified, at 9469f09 (the RUS file's commit): UA-43, renamed Crimea, and UA-40, Sevastopol. Both files match the Git LFS pointers at that commit in sha256 and size. Their provider and licence are the RUS file's, so the footer's licence line holds as it is.
- **Coast.** That file's coastal shapes run out to the 12-nautical-mile line: Crimea 41,591 km² in the file against 26,081 of land, Sevastopol 3,090 against 864. Both are cut to Natural Earth 1:10m land (v5.1.2, public domain). The lab keeps only a 14.8 kB extract inside lon 32 to 37, lat 44 to 46.5, cut by `scripts/ne-land-extract.py`; its README records the full file's URL, commit and hashes.
- **Pins.** Three entries through `pin-sources.py --only boundaries`; the other 191 are untouched. The script now prints its help for `-h` and stops on any argument other than `--only PREFIX`: on 29 October a run given `-h` had re-pinned every source, and was undone.

## The change (fd86dae)

- **Basemap (M1, 25/25 checks).** The two parts join after the comparison with the production reader, which covers the RUS file only.
  - Land areas: Crimea 26,160 km², Sevastopol 907.
  - Russia's union is formed alone, so its parts and land rings stay byte-identical. Each land level gains one ring. A first build that formed one union over everything had moved 8 RUS rings, because Clipper takes its grid origin from the input's extent.
  - New checks cover the areas, any overlap with the RUS union (0), and the LOD1 windows, none of which holds a new part.
  - `lod0.part_count` is recorded, and `basemap.json` is 1,164 kB of its 1.2 MB stop.
- **Explainer.** `explainer.html`'s load check reads that count in place of a literal 1,637. Its national scenes now draw Crimea. The published film is a recording, so it keeps the old outline until it is re-rendered.
- **Crosswalk and region data (M11, M12, M13, M8).** `crimea` and `sevastopol` map to the new regions, and Baikonur and the four mainland labels stay outside. `motion/build/round29/compare.py` compares every rebuilt file with the committed one:
  - Every region row other than Crimea's, Sevastopol's and the outside row is identical.
  - The old outside row equals the new outside row plus the two, in firms, statements, listed firms and revenue counts, for every year and group.
  - regions.json gains 24 rows, profiles 4 and 2, groups 36.
  - The other differences are the `author` mark on M11's three files (added in round 10 after M11's last run), groups' `support_counts` (it counts regions), and the order of profiles' unread `windows_change` table.
- **Listed firms.** treatednational holds the same 4,803 firms. 47 move from outside to Crimea (36) and Sevastopol (11); 3 stay outside.
  - M8's `GROUP BY ALL` had returned them in a new order on each run. They are now ordered by name, named firms first.
  - The tile names three firms at the cursor, and ties between firms at one address listed in the same year now fall alphabetically.
  - Overlapping red marks at one address can show a different mark on top.
- **M11's crosswalk check.** The inside rule stands: the lowest share is Chechnya's 0.925; Sevastopol's is 0.940 and Crimea's at least 0.970.
  - The rule "at most 10% of the outside labels' sample inside a polygon" would now test Baikonur's 17 firms, all geocoded in Russia. Drawn from 2024, the outside labels' sample (829 firms) has 38.8% inside a polygon, through the geocoder.
  - So the check now names the outside labels: exactly Baikonur and the four mainland regions. The share stays in `regions.json`'s `validation`.
- **M12's check.** "never more firms with a change than had revenue in either year" leaves out the pseudo-row. It holds Baikonur alone in 2021 and the mainland regions from 2022: 18 firms against 6.
- **Page.**
  - REFERENCES: "geoBoundaries gbOpen, Russia ADM1 and Ukraine ADM1 (two regions), cut to the coast with Natural Earth 1:10m land (public domain)."
  - The guide's computed counts: 60 of 85 regions in 2021 and 62 of 85 in 2024.

## What the page shows

- **Map:** Crimea and Sevastopol are navy land with borders and their own hover outline and fill.
- **Tile:** the tile names the region, and the strip's lead switches to it when the camera's centre is in it.
- **State-related layer:**
  - Crimea is classed: 334 state-related firms in 2021 (70.7% with a statement), 267 in 2024 (50.9%), −19.7 points.
  - Sevastopol: 60 (83.3%), 57 (80.7%), −2.6 points.
  - The legend counts move from 22 to 23 regions (−10 to 0) and from 36 to 37 (−20 to −10).
- **Wire:** the leading-industry lines read "in 64, 60, 62, 60 of 85 regions" for 2014, 2021, 2024 and 2025.
- **GO TO search:** listed firms in the two regions show their region, for example "Chernomorneftegaz, GUP · Crimea".
- **Profile:** none, since neither region has an approved insight; Kalmykia and Murmansk are the same today.

## Proof and audits

- **Proof.** `change-proof.py` links its base copy's `data/` to the lab's current files, so for this data change the base was served by hand: HEAD's page with round 28's publish data (`build/proof-base-r29`).
  - The proof `build/proof-r29b` against it found 18 text groups (9 per width) and no new rule hits.
  - The texts are the REFERENCES line, the region counts, the legend counts, and two different firms named "Avia Grupp, OOO" that swap places in one 2014 wire cycle (the new order).
  - 88 of 88 frames differ: the map around Crimea, the minimap, the wire, the legend and overlapping red marks. Spots far from Crimea differ by under 1%.
- **Frames.** `build/round29/frames-before`, `frames-after` and `pairs/`.
- **Audits.**
  - 1,600 px: 284 states, 0 findings.
  - Review gate at 1,600 and 400 px: see the README entry.

## Findings for the author

- **Republic registrations geocoded into Crimea.** The geocoder places most Luhansk-registered firms and many Donetsk-registered ones at Crimean places: 80% of Luhansk's city-level geocodes in 2024, 1,041 of them at one Simferopol point. About 250 of their drawn dots fall inside Crimea. This is round 28's "wrong republic" pattern again. The region figures go by registered region and are unaffected.
- **Two existing tile issues, left as they are:**
  - On the state-related layer, a hover made before `groups.js` has loaded says "No state-related firms registered here" until the pointer moves. The fix is to redraw the tile when the data arrives: a few lines, low risk.
  - Over a point outside every region, the tile says "Outside the regions" and the side card "Firms: none registered here". The fix is one string, low risk.
- **A tool gap.** `change-proof.py` cannot prove a data change without the hand-served base above. The data twins are not in git, so the base's data has to come from a folder. The fix is an option such as `--base-data motion/publish/data`, the last publish's twins: about 10 lines, low risk.
