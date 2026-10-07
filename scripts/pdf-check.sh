#!/usr/bin/env bash
# Usage: pdf-check.sh FILE.pdf [...]. Asserts manuscript geometry and fonts:
# width 468 pt (6.5 in), height at most 504 pt (7 in), NimbusSans faces only.
# Prints the smallest word height from pdftotext for comparison with the
# production figures: Codex's 10.5 pt exhibits measure 10.00 pt, so anything under 9.5 pt fails.
set -u
rc=0
for f in "$@"; do
  size=$(pdfinfo "$f" 2>/dev/null | awk -F': *' '/^Page size/ {print $2}')
  w=$(echo "$size" | awk '{print $1}'); h=$(echo "$size" | awk '{print $3}')
  fonts=$(pdffonts "$f" 2>/dev/null | awk 'NR>2 {print $1}' | sort -u | tr '\n' ' ')
  minh=$(pdftotext -bbox "$f" - 2>/dev/null | python3 -c '
import re,sys
hs=[float(m.group(2))-float(m.group(1)) for m in re.finditer(r"yMin=\"([0-9.]+)\" xMax=\"[0-9.]+\" yMax=\"([0-9.]+)\"", sys.stdin.read())]
print("%.2f" % min(hs) if hs else "none")')
  ok="ok"
  awk -v w="$w" -v h="$h" 'BEGIN {exit !(w > 467.9 && w < 468.1 && h <= 504.1)}' || { ok="BAD GEOMETRY"; rc=1; }
  echo "$fonts" | grep -q -v -E '^(.*NimbusSans[^ ]* ?)+$' && { ok="$ok, NON-NIMBUS FONT"; rc=1; }
  [[ -z "$fonts" ]] && { ok="$ok, NO FONTS LISTED"; rc=1; }
  awk -v m="$minh" 'BEGIN {exit !(m != "none" && m + 0 >= 9.5)}' || { ok="$ok, TEXT UNDER 9.5 PT"; rc=1; }
  printf '%s: %s x %s pt, fonts [%s], min word height %s pt: %s\n' "$(basename "$f")" "$w" "$h" "$fonts" "$minh" "$ok"
done
exit $rc
