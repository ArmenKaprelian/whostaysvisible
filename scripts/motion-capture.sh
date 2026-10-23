#!/usr/bin/env bash
# Host launcher for the explainer capture (motion study, 22 October 2026). Runs on the host, not in
# bubblewrap: Chromium's own sandbox conflicts with a nested namespace. It keeps the lab bracket:
# a run folder under logs/, the Brave profile under the run's scratch, the read-only check at the end.
# Usage: scripts/motion-capture.sh [--page PAGE] [capture.py arguments ...]   (--shards N, default 4: parallel browsers)
#   e.g. --seconds 3 --out motion/build/smoke.mp4
#        --page "explainer.html?cut=teaser-public" --out motion/build/who-stays-visible-teaser-public-40s.mp4
#        cut ids: full-public, teaser-public (aggregates only, may leave the lab), full-local, teaser-local, moscow (never published)
set -uo pipefail
source "$(dirname -- "${BASH_SOURCE[0]}")/common.sh"; lab_load_env
PAGE="explainer.html"
if [[ "${1:-}" == "--page" ]]; then PAGE=$2; shift 2; fi
lab_require_disk_scratch
lab_make_run "capture"
LAB_MEMORY_MAX_USED=none
trap 'rm -rf "$LAB_SCRATCH"' EXIT
# A static server on a free port, bound to 127.0.0.1, serving motion/.
python3 -I "$LAB/motion/tools/serve.py" --port 0 --dir "$LAB/motion" > "$LAB_RUN_DIR/serve.log" 2>&1 &
SERVER=$!
for _ in $(seq 1 50); do grep -q "serving http" "$LAB_RUN_DIR/serve.log" 2>/dev/null && break; sleep 0.1; done
URL=$(sed -n 's/^serving \(http:\/\/127\.0\.0\.1:[0-9]*\)\/.*/\1/p' "$LAB_RUN_DIR/serve.log" | head -n 1)
[[ -n "$URL" ]] || { echo "static server did not start" >&2; kill "$SERVER" 2>/dev/null; exit 1; }
echo "capture run $LAB_RUN_ID: serving $URL, profile $LAB_SCRATCH/brave-profile" >&2
python3 -I "$LAB/motion/tools/capture.py" --url "$URL/$PAGE" --profile "$LAB_SCRATCH/brave-profile" --log "$LAB_RUN_DIR/capture.json" "$@" 2>&1 | tee "$LAB_RUN_DIR/console.log"
status=${PIPESTATUS[0]}
kill "$SERVER" 2>/dev/null; wait "$SERVER" 2>/dev/null
lab_finish "$status" host "motion-capture $*"
exit "$status"
