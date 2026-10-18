#!/usr/bin/env bash
# Previews from the variant PDFs: 220 dpi full page, 600 dpi European-Russia crop of panel 1
# (x -4600..-1500 km, y 600..2500 km in the shared projection), grayscale crop, text diff
# against the manuscript, and one combined PDF in manifest order.
# Run inside the sandbox: scripts/lab-ro.sh scripts/fig28-postprocess.sh
set -euo pipefail
cd "$LAB_ROOT"
D=figures/20261018-fig28
MANU=$(jq -r '.sources["fig28.manuscript-pdf"].path' config/sources.json)
pdftotext -layout "$MANU" "$D/manuscript-text.txt"
ids=$(python3 -c 'import csv,sys; print("\n".join(r["id"] for r in sorted(csv.DictReader(open(sys.argv[1])), key=lambda r:int(r["order"]))))' "$D/variants.csv")
: > "$D/text-diffs.txt"
for id in $ids; do
  pdf="$D/$id.pdf"
  pdftoppm -r 220 -png -singlefile "$pdf" "$D/$id"
  pdftoppm -r 600 -png -singlefile -x 620 -y 519 -W 1016 -H 623 "$pdf" "$D/$id-zoom"
  magick "$D/$id-zoom.png" -colorspace Gray "$D/$id-zoom-gray.png"
  { echo "== $id"; diff <(cat "$D/manuscript-text.txt") <(pdftotext -layout "$pdf" -) || true; } >> "$D/text-diffs.txt"
done
pdfunite $(for id in $ids; do printf '%s ' "$D/$id.pdf"; done) "$D/fig28-all-variants.pdf"
echo "previews for: $ids" | tr '\n' ' '; echo; echo "combined: $D/fig28-all-variants.pdf ($(pdfinfo "$D/fig28-all-variants.pdf" | awk '/^Pages/ {print $2}') pages)"
