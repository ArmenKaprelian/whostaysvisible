#!/usr/bin/env bash
# The site's résumé: builds site/resume/kaprelian-resume.tex with TinyTeX into site/resume/build/ and checks it (one page, no phone
# number). With --write it also copies the PDF to the site (resume/kaprelian-resume.pdf) and remakes the home page's preview with
# motion/tools/site-pictures.py. The source is the author's Overleaf export with the site's edits (round 32, 1 November 2026).
# Usage: site/resume/build.sh [--write]      SITE=... overrides ~/Documents/website
set -euo pipefail
case "${1:-}" in -h|--help) sed -n '2,5p' "$0"; exit 0;; esac
HERE="$(cd "$(dirname "$0")" && pwd)"; LAB="$(cd "$HERE/../.." && pwd)"; SITE="${SITE:-$HOME/Documents/website}"; OUT="$HERE/build"; mkdir -p "$OUT"
PATH="$HOME/bin:$PATH" latexmk -pdf -interaction=nonstopmode -halt-on-error -outdir="$OUT" "$HERE/kaprelian-resume.tex" >"$OUT/latexmk.log" 2>&1 || { tail -20 "$OUT/latexmk.log"; exit 1; }
pages=$(pdfinfo "$OUT/kaprelian-resume.pdf" | awk '/^Pages:/ {print $2}')
if pdftotext "$OUT/kaprelian-resume.pdf" - | head -4 | grep -q '+1 '; then echo "refused: the phone number is in the header"; exit 1; fi
[ "$pages" = 1 ] || { echo "refused: $pages pages, not one"; exit 1; }
echo "built $OUT/kaprelian-resume.pdf: one page, no phone number"
if [ "${1:-}" = "--write" ]; then
  cp "$OUT/kaprelian-resume.pdf" "$SITE/resume/kaprelian-resume.pdf" && echo "copied to $SITE/resume/kaprelian-resume.pdf"
  python3 -I "$LAB/motion/tools/site-pictures.py" --only resume --write
else echo "dry run: --write copies the PDF to the site and remakes its preview"; fi
