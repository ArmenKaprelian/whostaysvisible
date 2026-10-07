#!/usr/bin/env bash
# Usage: check-readonly.sh START_EPOCH. Lists files under programming/ and LaTeX/
# modified since the run started. Expected output: nothing.
set -u
source "$(dirname -- "${BASH_SOURCE[0]}")/common.sh"; lab_load_env
start=${1:?START_EPOCH}
find "$PROG" "$LATEX" -newermt "@$start" \( -type f -o -type d \) -print 2>/dev/null | while IFS= read -r p; do
  case "$p" in
    */output/local-execution/job.lock) echo "$p  (Codex launcher touches this; not a lab write)";;
    */.git/index) echo "$p  (git status without --no-optional-locks refreshes this; not a lab write)";;
    *) echo "$p";;
  esac
done
