#!/usr/bin/env bash
# Runs the Stage B queries one after another through the guarded launcher. Stops at the
# first failure. Heavy queries last. Usage: scripts/run-stage-b.sh [ids...]
set -u
here=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
ids=("$@"); [[ ${#ids[@]} -gt 0 ]] || ids=(B1-region-year B2-industry-year B3-age-year B4-before-removal B5-pattern-year B7-size-bands B6-histories)
for id in "${ids[@]}"; do
  echo "=================== $id ($(date -u +%H:%M:%SZ)) ==================="
  "$here/ram-status.sh" | tail -n 1
  if ! "$here/lab-run.sh" Rscript --vanilla "$here/../R/stage-b/$id-query.R"; then echo "FAILED: $id" >&2; exit 1; fi
done
echo "all done ($(date -u +%H:%M:%SZ))"
