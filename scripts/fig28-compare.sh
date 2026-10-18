#!/usr/bin/env bash
# Fidelity of the lab's re-renders against the manuscript Figure 2.8: pixel difference at
# 200 dpi (ImageMagick AE = number of differing pixels), text and font listings.
# Run inside the sandbox: scripts/lab-ro.sh scripts/fig28-compare.sh
set -euo pipefail
cd "$LAB_ROOT"
D=figures/20261018-fig28; OUT=$D/fidelity; mkdir -p "$OUT"
MANU=$(jq -r '.sources["fig28.manuscript-pdf"].path' config/sources.json)
{
  echo "manuscript: $MANU"
  echo "manuscript sha256: $(sha256sum "$MANU" | cut -d' ' -f1)"
  pdftoppm -r 200 -png -singlefile "$MANU" "$OUT/manuscript"
  for cand in "$D/s0-reference/figures/candidate-02-financial-cohort-inclusion.pdf" "$D/s0-current.pdf"; do
    [[ -f "$cand" ]] || { echo "missing: $cand"; continue; }
    name=$(basename "$(dirname "$(dirname "$cand")")")-$(basename "$cand" .pdf); name=${name#20261018-fig28-}
    pdftoppm -r 200 -png -singlefile "$cand" "$OUT/$name"
    ae=$(magick compare -metric AE "$OUT/manuscript.png" "$OUT/$name.png" "$OUT/$name-diff.png" 2>&1 || true)
    echo; echo "== $cand"; echo "sha256: $(sha256sum "$cand" | cut -d' ' -f1)"
    echo "differing pixels at 200 dpi (of $(magick identify -format '%w x %h' "$OUT/manuscript.png")): $ae"
    if diff <(pdftotext -layout "$MANU" -) <(pdftotext -layout "$cand" -) > "$OUT/$name-text.diff"; then echo "pdftotext: identical"; else echo "pdftotext: differs, see $name-text.diff"; fi
    echo "fonts:"; pdffonts "$cand" | awk 'NR>2 {print "  " $1, $2}'
  done
} | tee "$OUT/fidelity.txt"
