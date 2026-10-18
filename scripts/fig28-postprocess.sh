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
# Optional argument: a manifest CSV (default variants.csv); the combined PDF and the text-diff
# file take the manifest's suffix (variants-pick.csv -> fig28-all-pick.pdf, text-diffs-pick.txt).
MANIFEST=${1:-$D/variants.csv}; NAME=$(basename "$MANIFEST" .csv); SUFFIX=${NAME#variants}
COMBINED="$D/fig28-all${SUFFIX:--variants}.pdf"; TXT="$D/text-diffs$SUFFIX.txt"
ids=$(python3 -c 'import csv,sys; print("\n".join(r["id"] for r in sorted(csv.DictReader(open(sys.argv[1])), key=lambda r:int(r["order"]))))' "$MANIFEST")
: > "$TXT"
for id in $ids; do
  pdf="$D/$id.pdf"
  pdftoppm -r 220 -png -singlefile "$pdf" "$D/$id"
  pdftoppm -r 600 -png -singlefile -x 620 -y 519 -W 1016 -H 623 "$pdf" "$D/$id-zoom"
  magick "$D/$id-zoom.png" -colorspace Gray "$D/$id-zoom-gray.png"
  { echo "== $id"; diff <(cat "$D/manuscript-text.txt") <(pdftotext -layout "$pdf" -) || true; } >> "$TXT"
done
pdfunite $(for id in $ids; do printf '%s ' "$D/$id.pdf"; done) "$COMBINED"
echo "previews for: $ids" | tr '\n' ' '; echo; echo "combined: $COMBINED ($(pdfinfo "$COMBINED" | awk '/^Pages/ {print $2}') pages)"
