#!/usr/bin/env bash
# Verifies the memory guard with a synthetic 5 GiB allocation. Expected: the
# cgroup kills the job, the launcher reports no status file, other processes
# are untouched. Run while nothing else of the lab is running.
set -u
here=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
echo "== before =="; "$here/ram-status.sh" | tail -n 1
"$here/lab-run.sh" Rscript --vanilla "$here/../R/tests/allocate-5gib.R"; st=$?
echo "== launcher exit status: $st (expected non-zero) =="
echo "== after =="; "$here/ram-status.sh" | tail -n 1
run=$(ls -1dt "$here"/../logs/*run-allocate-5gib.R* 2>/dev/null | head -n 1)
[[ -n "$run" ]] && { echo "== run folder: $run =="; cat "$run/run.json"; echo; tail -n 4 "$run/ram.log"; }
