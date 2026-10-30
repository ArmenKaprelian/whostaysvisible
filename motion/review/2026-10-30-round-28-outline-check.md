# Round 28: firms drawn outside Russia's outline, and the region fill

30 October 2026 (UTC). The author's screenshot (2024, Firms view, ×8.1 over Rostov-on-Don and Krasnodar) showed dots on the dark ground west of the Sea of Azov. The author asked what they are, whether there are other slip-ups like it, and for the hovered region's fill to fade out sooner on zoom.

## What the dots are

They are firms that Russia's registry places in Crimea and Sevastopol. The basemap is geoBoundaries gbOpen RUS ADM1 (OpenStreetMap, 2017), whose outline follows Ukraine's internationally recognised border, so these firms are drawn on the dark ground. `data/basemap.json` already records this as a choice: "The outline omits Crimea, Sevastopol and the occupied Ukrainian territories; firms located there keep their cells." No text on the page says so.

The check tested every year's address file against the 1 km land outline, with a 3 km margin. Drawn firms on no list outside the outline:

| Year | Crimea and Sevastopol (addresses / firms) | Occupied mainland Ukraine (addresses / firms) |
|---|---|---|
| 2014 | 7,728 / 17,386 | none |
| 2015 to 2021 | 10,526 to 11,779 / 28,972 to 36,848 | none |
| 2022 | 11,678 / 34,549 | 868 / 1,879 (3 with a statement) |
| 2023 | 11,617 / 33,905 | 1,085 / 2,349 |
| 2024 | 11,663 / 34,235 | 1,191 / 2,644 |
| 2025 | 11,691 / 34,104 | 1,651 / 3,571 |

The mainland addresses are mostly Donetsk, Horlivka, Yenakiieve, Khartsyzk, Makiivka, Mariupol, Melitopol and Luhansk. They enter in 2022, after Russia's annexation claims. There are 50 listed firms (red marks) outside the outline: 48 in Crimea and Sevastopol and 2 on the mainland. These are the 50 that `treatednational.json` assigns to "outside the basemap outline". The region figures (`regions.json`, the profiles) come from the registry region through `config/regions-crosswalk.csv`, so these firms are kept under "outside the basemap outline" and are not counted in any region.

## Slip-ups found

1. **Ukrainian-held places.** About 25 firms in 2025, registered in Russia's "Kherson" and "Zaporizhzhia" regions, are geocoded to places Ukraine holds: Kharkiv (17), around Pavlohrad (6), and one each near Dnipro, Odesa and Khmelnytskyi. These look like geocoder matches in the wrong city. One more firm, registered in "Kherson", sits in Kherson city. Russia claims that city, so its address may be genuine.
2. **The wrong region inside Russia.** In 2024, 6,051 of 2,888,433 drawn firms (0.21%) sit more than 5 km outside the region they are registered in:
   - Moscow city: 2,318 in all. 1,913 are in Moscow Oblast, 1,254 of them in one 1 km square near Nakhabino, about 14 km west of the ring road. Another 144 are in Volgograd Oblast and 127 in Orenburg Oblast.
   - Udmurtia (758 of 25,920), Chechnya (547 of 2,950, 19%), Chuvashia (490 of 15,298) and Buryatia (104): these land mostly in Komi, Sakha, Tuva, Khakassia and the Altai Republic, which looks like the geocoder matching a street in the wrong republic.
   - Baikonur's 9 firms are in Tomsk Oblast, Krasnodar Krai and elsewhere.

   The map's dots and cells use the geocode, so these firms are drawn and counted in the wrong place. The region figures use the registry region and are not affected.
3. No drawn address lies anywhere else outside the outline: none at sea, none abroad other than the cases above.

## Open for the author

- **A. Say so on screen:** one sentence about Crimea, Sevastopol and the occupied regions, in the NOTE or the Firms view's i text. This is a text change, low risk.
- **B. Stop drawing geocodes that sit more than 5 km outside their registry region:** about 0.2% of drawn firms, which would be counted but not drawn, like city-level geocodes. This needs a data pass (M9, the cells), new counts in the NOTE and the full audit. Medium size and risk.
- **C. For the empirics, not the atlas:** the comparison group (firms on no list) includes about 34,000 firms in Crimea and Sevastopol. US and EU embargoes on that territory have applied since 2014, and on the occupied Donetsk and Luhansk areas since 2022.

## The region fill

`regionFillFade` was full to k 50 and gone at k 100 (round 15). It is now full to twice the country view and gone at eight times, linear in log zoom, and it is measured against `kFit` so every width shows the same extent. The outline still marks the hovered region. This was a one-time pass on the author's word, with no rule change, no frames and no audit. `tools/page-probe.py` read the fill's pixel 150 km south of Murmansk at ×1, ×1.5, ×2, ×3, ×4, ×6, ×8 and ×12 in both themes.
- Dark theme: the strength was 1.01, 1.01, 1.01, 0.64, 0.48, 0.14, 0 and 0, against the formula's 1, 1, 1, 0.71, 0.50, 0.21, 0 and 0. The differences come from 8-bit rounding of a 6% tint.
- The page reported no errors.

Scripts and outputs are in `build/outline-check/`, which git ignores.
