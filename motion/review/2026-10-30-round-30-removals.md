# Round 30: the removals (30 October 2026)

The author asked for the atlas to lose features that cost performance and add little: the pulse's tree lines ("the bloom tree"), the light theme, the news scroll (the wire), the hovered region's fuchsia fill and BLINK. They then picked two overlaps to remove (the profile shown twice, the extra fit controls) and, at the review, how the context line behaves on phones. The plan is the session's plan file; round 31 (no visible change: dead code, idle work, a lighter first load, the pipeline) follows on approval.

## The steps

Each step changed the page, its tools and the guide together, so the audit and the proof ran at every checkpoint. The steps' files are kept in `motion/build/round-30/step-*/` and become one commit each.

- **F, the region fill.** `REGION_FILL`, `regionFillFade` and `drawRegionFill` are gone, and so are the two map redraws that existed only to repaint the fill when the pointer crossed a region border. The outline on the overlay stays. Audit: the states regionfill, regionfillcell and regiongrat are gone.
- **R, the tree lines.** `treeOf`, `warmTree`, `drawTrail` and the trail's timings are gone. The sweep (`lonOf`, `makePulse`) and the swell stay. The red button's label loses "Lines join them by distance only." The film keeps its own copy of the tree.
- **B, BLINK.** The button, its key (B), its state and the blink comparator's functions are gone, with the tip and the GO TO i text that named it. The year row's second line now hides on layers that follow the slider without a red button. Guide: 8.3 removed, 8.4 to 8.6 renumbered.
- **T, the light theme.** The `data-theme="light"` block (about 6.5 KB with three grain tiles), the button, the stored choice, the light branches in `readTheme`, `map-layers.js` (`tileEdge`, `pulseRing`, `swellDot`) and the GPU dot shader's light-only edge are gone. The film calls the shared code with `dark: true`, and its frames at 13 scene times are identical to HEAD's. `change-proof.py` shoots the dark theme only. The audit keeps one theme load: a light-preferring browser with a remembered light choice opens dark.
- **W, the wire.** The engine (about 250 lines: the track, its Web Animation, the 1 s watchdog, the 8 s reduced-motion timer, the debounce and commit timers, the cat key), `data/offwire.*`, the Tomorrow face and its four files, `tools/wire_check.py` and `tools/wire-sweep.py` are gone. The line keeps its glyph and gives one sentence about the place under the camera, the round-9 line that had been the reduced-motion form. `wireStripes` became `refsStripes`, since the REFERENCES icon uses its lines. The audit reads its data years and the list members itself. Guide: section 12 (the figures only the wire stated) removed, 13 to 15 renumbered, 7.4 rewritten.
- **P, the tile's profile.** The tile's profile box and the `profileFit` hook are gone. The profile shows in the UNDER THE CURSOR card.
- **X, the RUSSIA controls.** The RUSSIA button, the minimap's corner brackets (a button too) and the Diomede Islands fact are gone. The Russia preset stays without a button, so `#Russia` links and the audit's `A.preset('Russia')` still land on the fit. The zoom box's fit button and the 0 key fit the country.
- **Z, the phone line (the author's pick at the review).** On a map under 600 px wide the line starts collapsed to its toggle, as the legend and the note do, and opens in two rows; a viewer's own choice is kept. The phone dock and revenue mix states run with the line at that default.

- **S, the scale bar (the author's revision at approval).** The ruler, its CSS and its audit state are gone. `syncZoomFactor` keeps the ×1.0 beside the fit button, and the phone stub drops into the ruler's place (156 px, 168 on touch).
- **C, calmer accents (the author's revision at approval, with two rounds of picks).** Fuchsia #EE69C0 (live #F49ED2) and green #57CE70 (live #93E09E) replace the neon #FF45C8 and #4DFF7F (live #FF8FDF and #9AFFB8) on the atlas, the site's stylesheet and the review pages. The film keeps its colours (not re-rendered). The palette was chosen by measurement (`scripts/validate_palette.py`'s OKLab and Machado simulations): text on the panel 6.7 and 9.4:1, 36 normal, 25 protan and 13 deutan between the two, 11 from the nearest data colour each. The author's phthalo idea was tried: every blue-leaning green sat on the cyan data ramp. The first pick (#FC7DCF and #79EF8F) was rejected as too light a green, and #65DB7C as not deep enough. The site's favicon keeps the old green (its PNG and ICO copies would need remaking).

## Checks

- Change proof against HEAD (3b4a7cb), `build/round-30/proof-gate4`: all 44 frames at 1,600 px differ in the header, the strip, the LAYER and GO TO cards (and the cards below them, which move up), the tile and the fill under the hover ring, and nowhere else on the map; 353 text groups (the wire's items, the guide, the header, the tips, the red button's label, the GO TO reading text, the REFERENCES type line); no new rule hits. The proof's settle is 1.8 s since this round: the wire's pause had added 0.8 s, without which the Firms view's opening sweep could still be running in a frame.
- Five-width audit (one run, all five widths): zero findings, 1,301 states (1,376 at round 29's gate). Runs on the way found the phone layout below, the preset hooks' first-button assumption and the touch stub's rule order.
- The film: 0 of 13 frames differ after the shared drawing code changed (step T).
- `agent_guide.py --check` and `glossary_build.py --check`: zero findings at every step. The guide is 6,458 words (7,195 before).

## Known tight spots

Found on the way and fixed: on a touch phone the collapsed line's stub overlapped the scale bar by 8 px, because the touch rule came before the phone rule with the same specificity. It never showed while the line was open by default.


With the line opened in two rows on a phone, the right-hand column (zoom box and scale bar) rises 24 px. At the tallest phone map (562 px) with the revenue mix box expanded, the scale bar's top meets the box's bottom by 3 px (301 against 304), and on the 375 by 667 and 360 by 800 phones the tile has no docking place while the line is open. With the line at its default nothing collides. The published build already let the scale bar touch an expanded mix box on an 800 px tall phone (262 against 304); no audit state covered it.

## Not removed

- The Tomorrow TTF files' pins in `config/sources.json` stay as records of what is on disk; dropping them goes through `scripts/pin-sources.py`.
- The publish set: `publish-set.py --write` never removed a file whose source had gone, and the site's import copies the whole `fonts/` folder, so the Tomorrow files would have travelled to the site. Since round 30 `--write` removes fonts no page loads and twins whose source is gone, and the dry run lists what it would remove.

## The address files (measured for round 31)

The pasted advice of 30 October was checked against `M9-firms.R` and the real files. The files are already columnar, so "columns instead of rows" is done. Measured on 2024: now 6.5 MB per year switch; the mix split off, 4.95 MB; plus delta coordinates and byte planes, 4.1 MB; every coordinate pair once (3.1 MB, fetched once) with a per-year presence bitmap and counts, 2.3 MB. A full year run: 79.6 MB now, 30.9 MB with the last layout. The advice's estimates (2 to 2.5 MB, and 10 to 15 MB a run) were too optimistic: the counts alone are about 2.2 MB a year. Round 31 takes the last layout with the mix in its own file.
