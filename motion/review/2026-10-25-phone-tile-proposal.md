# The tile on small phones: a proposal (25 October 2026)

The question, from the redesign's audit: on a phone the tile often has no clear place and ends on its last resort, over the zoom buttons, the scale bar, the wire and the point itself. On a 360 px phone the tile is 64 percent of the map's width (227 px), too wide to pass the column of zoom buttons and the scale bar at the map's right, so a tile taller than about half the map's height has no place near its middle. The search lands every firm at the map's centre, so a search meets that case often.

## The proposal (three parts, built behind `?phonetile=dock-low-scale` in `motion/build/dock/`)

1. **The docked tile.** On a map under 600 px wide, where the floating tile has no clear place, the tile spans the map's width less 12 px margins along the map's top edge. Its lines wrap less, so it is shorter. It may cover the note, the mix box and the legend, never the zoom buttons or the wire, and the point stays below it with the hover's clearance. The crosshair's vertical line joins the tile to the point.
2. **A lower landing for a search on a short map.** On a map under 450 px tall (a 62vh map on a screen under about 726 px tall, as on a 375 by 667 phone), the found firm lands at 62 percent of the map's height instead of its centre, leaving the docked tile room above it.
3. **The scale bar steps aside.** On a map under 600 px wide the scale bar hides while the tile shows. The tile's footer gives the scale ("1 px = 61 m").

Elsewhere nothing changes: where the floating tile fits it floats as now, and desktops are untouched.

## Measurements (headless Brave, phone emulation)

Searches, last-resort placements per 100 seeded searches of named listed firms (share, revenue, industry layers, 2024):

| Screen (map) | Today (v34) | Proposal |
|---|---|---|
| 360 by 800 (328 by 498) | 0, 19, 19 | 0, 0, 0 |
| 375 by 667 (343 by 413) | 59, not run, 84 | 0, 6, 7 |
| 390 by 844 (358 by 525) | 0, 0, 0 | 0, 0, 0 (dock alone) |
| 360 by 640 (328 by 397) | not run | 3, 53, 51 |

The parts separately, on searches: the dock alone gives 0, 0, 0 at 360 by 800 and 0, 39, 44 at 375 by 667; the lower landing brings the latter to 0, 6, 7; the scale bar's step-aside adds nothing to searches.

Taps, last-resort placements per 200 seeded taps on the map, the same points in every variant (the Firms view at the Moscow preset, industry 2021 and revenue 2024, and the Cells view at the country, industry 2024):

| Screen | Today | Dock | Scale bar aside | Both |
|---|---|---|---|---|
| 360 by 800 | 22, 3, 0 | 17, 2, 0 | 17, 2, 0 | 14, 1, 0 |
| 375 by 667 | 46, 22, 21 | 35, 10, 15 | 31, 7, 4 | 30, 5, 2 |

## What stays

Tall Firms-view tiles near the middle of a short map: a pixel in central Moscow with 66 listed firms makes a 261 px tile that has no clear place on a 343 by 413 map even at full width. These need a shorter tile, a separate decision. The 360 by 640 screen, an older and shorter Android size, keeps about half of its revenue and industry searches on the last resort.

Frames: `motion/build/r27-dock/` (sheets 1 to 5, today against the proposal; sheet 5 is a remaining case). The prototype's code differs from e7ea0c5 by `dockTile` and `undockTile`, the scale-aside class and the lower landing in `findFirm`, all behind the flag.
