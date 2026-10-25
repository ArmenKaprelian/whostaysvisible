# Codex task brief: Figure 2.8 with 75 km squares and 25 km gaps

Drafted by Claude on 18 October 2026; the author pastes it. Author instruction: replace the figure landed today (85 km squares, 15 km gaps; the evidence record is `research/evidence/figure28-classes-2026-10-18/`) with the same figure at 75 km squares and 25 km gaps, the version Claude recommended. Apart from the latitude below, nothing else about the figure changes: classes, cutpoints, palette, white backing, titles, subtitle size, legend, notes, the taller page with the note footer, and the two manuscript sentences all stay as they are now.

## Change

`programming/R/chapter2-reconcile-refine-maps.R`, `c2rr_map_candidate2`, lines 287–289 as of today:

```r
      # 12.5 km inset per side gives 25 km white gaps between adjacent marks.
      graphics::rect(d$x_km - 50, d$y_km - 50, d$x_km + 50, d$y_km + 50, col = "white", border = NA)
      graphics::rect(d$x_km - 37.5, d$y_km - 37.5, d$x_km + 37.5, d$y_km + 37.5, col = fill, border = NA)
```

and the manifest entry at line 305: `adjacent_tile_gap_km = 25`. The legend swatch gaps are unchanged.

## Latitude

The author allows Codex to make adjustments it judges improvements while applying this change, for example to the legend swatch gaps if 25 km gaps make the current small legend gaps look inconsistent, to comments and manifest fields, or to any layout consequence of the wider gaps. Apply the 25 km version on top of today's landed layout (taller page, note footer, enlarged notes, updated manuscript sentences), not on top of the lab render. Report every adjustment in the evidence record; anything that would change what the figure shows, an accepted rule, or the manuscript text beyond the records listed below goes to the author as a proposal instead.

## Reference

Lab render of the same encoding on the 7-inch page: `Claude Code/current/dataviz-lab/figures/20261018-fig28/final-s1b-gap25.pdf`, sha256 `a27e588542680df0f336593c43a80d235ff11f9004d2a502006b4ce1ba1cc82e` (its page lacks today's note footer, so compare the cell geometry and the text lines, not whole-page pixels). Current manuscript file: sha256 `168aa30f906650593f26ab93928e4c2cd7bd4b6aab42038cba7b53afc0275ed6`.

## Records

- Re-render into a new output directory, replace `figures/chapter2/stage3-08-cohort-map.pdf` in place, and give a numbered before/after comparison against the current file for the author's review.
- New dated evidence folder with the figure import hashes, input identities (the three saved inputs are unchanged), checks and an authorization note quoting this instruction.
- `research/decision-record.md` line 11: "85 km squares … 7.5 km inset per side and 15 km gaps" becomes "75 km squares … 12.5 km inset per side and 25 km gaps".
- Manuscript text: no change (neither sentence mentions the gap width). Build, validate and synchronize under the default workflow unless the author says local only.

## Checks to report

- `pdftotext -layout` of the new file identical to the current file.
- Page 468 × 552 pt, NimbusSans fonts only; cutpoints 33.31 / 38.33 / 42.97 / 47.62 and class counts cash 70/61/128/186/222, inventory 197/207/137/81/45 unchanged.
- Pixel difference against the current file confined to the cell marks (all 2,308 squares shrink by 5 km per side); titles, legend and notes identical.
