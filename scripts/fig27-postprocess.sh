#!/usr/bin/env bash
# Previews and checks for the Figure 2.7 gallery (figures/20261018-fig27-gallery): 220 dpi full
# page, a 600 dpi crop per candidate (the crop column of variants.csv, inches from the top-left),
# the same crop in grayscale, a fidelity comparison of s0-current against the manuscript PDF,
# pdf-check on every candidate, and one combined PDF in manifest order.
# Run inside the sandbox: scripts/lab-ro.sh scripts/fig27-postprocess.sh
set -euo pipefail
cd "$LAB_ROOT"
D=figures/20261018-fig27-gallery
MANU=$(jq -r '.sources["fig27.manuscript-pdf"].path' config/sources.json)
mkdir -p "$D/fidelity"
python3 - "$D/variants.csv" > "$D/.manifest.tsv" <<'PY'
import csv, sys
rows = sorted(csv.DictReader(open(sys.argv[1])), key=lambda r: int(r["order"]))
for r in rows: print(r["id"], r.get("crop", "NA") or "NA", sep="\t")
PY
ids=()
while IFS=$'\t' read -r id crop; do
  ids+=("$id"); pdf="$D/$id.pdf"
  pdftoppm -r 220 -png -singlefile "$pdf" "$D/$id"
  if [[ "$crop" != "NA" ]]; then
    IFS=, read -r cx cy cw ch <<< "$crop"
    pdftoppm -r 600 -png -singlefile -x "$(awk -v v="$cx" 'BEGIN{printf "%d", v*600}')" -y "$(awk -v v="$cy" 'BEGIN{printf "%d", v*600}')" \
      -W "$(awk -v v="$cw" 'BEGIN{printf "%d", v*600*0.62}')" -H "$(awk -v v="$ch" 'BEGIN{printf "%d", v*600*0.72}')" "$pdf" "$D/$id-zoom"
    magick "$D/$id-zoom.png" -colorspace Gray "$D/$id-zoom-gray.png"
  fi
done < "$D/.manifest.tsv"
rm -f "$D/.manifest.tsv"

# Fidelity: the lab's s0 against the manuscript figure, national panel pixels and text.
if [[ -f "$D/s0-current.pdf" ]]; then
  pdftoppm -r 200 -png -singlefile "$MANU" "$D/fidelity/manuscript"
  pdftoppm -r 200 -png -singlefile "$D/s0-current.pdf" "$D/fidelity/s0-current"
  magick "$D/fidelity/manuscript.png" -crop 962x504+45+105 +repage "$D/fidelity/manuscript-national.png"
  magick "$D/fidelity/s0-current.png" -crop 962x504+45+105 +repage "$D/fidelity/s0-national.png"
  ae_nat=$(magick compare -metric AE "$D/fidelity/manuscript-national.png" "$D/fidelity/s0-national.png" "$D/fidelity/diff-national.png" 2>&1 || true)
  ae_page=$(magick compare -metric AE "$D/fidelity/manuscript.png" "$D/fidelity/s0-current.png" "$D/fidelity/diff-page.png" 2>&1 || true)
  pdftotext -layout "$MANU" "$D/fidelity/manuscript-text.txt"; pdftotext -layout "$D/s0-current.pdf" "$D/fidelity/s0-text.txt"
  textdiff=$(diff "$D/fidelity/manuscript-text.txt" "$D/fidelity/s0-text.txt" | grep -c '^[<>]' || true)
  {
    echo "Fidelity of s0-current against the manuscript Figure 2.7 ($(basename "$MANU")), 200 dpi"
    echo "manuscript fonts: $(pdffonts "$MANU" | awk 'NR>2 {print $1}' | sed 's/^[A-Z]*+//' | sort -u | tr '\n' ' ')"
    echo "lab fonts:        $(pdffonts "$D/s0-current.pdf" | awk 'NR>2 {print $1}' | sed 's/^[A-Z]*+//' | sort -u | tr '\n' ' ')"
    echo "differing pixels, national panel of the available map (962 x 504 px): $ae_nat"
    echo "differing pixels, whole page (1300 x 1400 px): $ae_page"
    echo "pdftotext lines differing: $textdiff"
  } > "$D/fidelity/fidelity.txt"
  cat "$D/fidelity/fidelity.txt"
fi

# Geometry, fonts and text floor for every candidate (s0 reproduces the manuscript's 8.3 pt notes and is reported separately).
cands=(); for id in "${ids[@]}"; do [[ "$id" == "s0-current" ]] || cands+=("$D/$id.pdf"); done
scripts/pdf-check.sh "${cands[@]}" | tee "$D/pdf-check.txt"
[[ -f "$D/s0-current.pdf" ]] && { echo "reference (not a candidate):"; scripts/pdf-check.sh "$D/s0-current.pdf" || true; } | tee -a "$D/pdf-check.txt"
pdfunite "${cands[@]}" "$D/fig27-gallery-all.pdf"
echo "combined: $D/fig27-gallery-all.pdf ($(pdfinfo "$D/fig27-gallery-all.pdf" | awk '/^Pages/ {print $2}') pages)"
