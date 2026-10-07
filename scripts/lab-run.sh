#!/usr/bin/env bash
# Guarded launcher for Stage B and C: one job under a cgroup memory cap, inside
# the read-only sandbox, with a watcher. Modeled on programming/scripts/run-local-data.sh.
set -uo pipefail
source "$(dirname -- "${BASH_SOURCE[0]}")/common.sh"; lab_load_env
usage() { echo 'Usage: scripts/lab-run.sh [--max 4G] COMMAND [ARG ...]' >&2; exit 2; }
HIGH=$LAB_MEMORY_HIGH; MAX=$LAB_MEMORY_MAX; FLOOR=$LAB_MEMAVAILABLE_MIN_MIB
if [[ "${1:-}" == "--max" ]]; then
  [[ "${2:-}" == "4G" ]] || usage
  HIGH=$LAB_MEMORY_HIGH_BIG; MAX=$LAB_MEMORY_MAX_BIG; FLOOR=$LAB_MEMAVAILABLE_MIN_MIB_BIG; shift 2
fi
[[ $# -gt 0 ]] || usage

# Pre-flight refusals, in order.
lab_require_disk_scratch
if [[ "$(systemctl --user is-active "$CODEX_UNIT" 2>/dev/null)" == "active" ]]; then
  echo "Codex data job active (unit $CODEX_UNIT); refusing to start." >&2; exit 1
fi
if [[ -f "$CODEX_LOCK" ]] && fuser "$CODEX_LOCK" >/dev/null 2>&1; then
  echo "Codex data job active (lock $CODEX_LOCK is held); refusing to start." >&2; exit 1
fi
if [[ "$(systemctl --user is-active "$LAB_UNIT" 2>/dev/null)" == "active" ]]; then
  echo "A lab job is already running (unit $LAB_UNIT)." >&2; exit 1
fi
ma=$(lab_mem_available_mib); sf=$(lab_swap_free_mib)
if (( ma < FLOOR )); then echo "MemAvailable ${ma} MiB is below the ${FLOOR} MiB floor for a ${MAX} job; wait or free memory." >&2; exit 1; fi
if (( sf < LAB_SWAPFREE_MIN_MIB )); then echo "SwapFree ${sf} MiB is below ${LAB_SWAPFREE_MIN_MIB} MiB; wait or free memory." >&2; exit 1; fi
mkdir -p "$LAB/logs"
exec 9>"$LAB/logs/job.lock"
flock -n 9 || { echo 'Another lab job holds logs/job.lock.' >&2; exit 1; }

label=$(lab_label "$@")
lab_make_run "run-$label"
LAB_MEMORY_MAX_USED=$MAX
lab_write_env_file guarded "$MAX"
echo "lab-run $LAB_RUN_ID: cap $MAX (high $HIGH), MemAvailable ${ma} MiB, scratch $LAB_SCRATCH" >&2

high_bytes=$(echo "$HIGH" | awk '{v=$1; u=substr(v,length(v)); n=substr(v,1,length(v)-1); if (u=="G") print n*1073741824; else if (u=="M") print n*1048576; else print v}')
"$LAB_SCRIPTS/ram-watch.sh" "$LAB_UNIT" "$LAB_RUN_DIR/ram.log" "$LAB_WATCH_INTERVAL" \
  "$LAB_WATCH_FLOOR_MIB" "$LAB_WATCH_SWAP_FLOOR_MIB" "$high_bytes" &
WATCHER=$!
cleanup() { kill "$WATCHER" 2>/dev/null; wait "$WATCHER" 2>/dev/null; rm -rf "$LAB_SCRATCH"; }
trap cleanup EXIT

systemd-run --user --unit="$LAB_UNIT" --wait --pipe --collect --quiet \
  --working-directory="$LAB" \
  --property=MemoryAccounting=yes \
  --property="MemoryHigh=$HIGH" --property="MemoryMax=$MAX" \
  --property="MemorySwapMax=$LAB_SWAP_MAX" --property=OOMPolicy=kill \
  --property="CPUQuota=$LAB_CPU_QUOTA" --property="TasksMax=$LAB_TASKS_MAX" \
  --property=TimeoutStopSec=20 \
  --setenv="LAB_RUN_ENV=$LAB_SCRATCH/run.env" --setenv="LAB_SCRIPTS=$LAB_SCRIPTS" \
  -- "$LAB_SCRIPTS/lab-unit-wrapper.sh" "$@" 2>&1 | tee "$LAB_RUN_DIR/console.log"
status=${PIPESTATUS[0]}
# The wrapper records the command's own status; an OOM kill leaves no status file.
if [[ -f "$LAB_RUN_DIR/status.txt" ]]; then status=$(cat "$LAB_RUN_DIR/status.txt"); else echo "no status file: the unit was killed (OOM or watcher)" >&2; [[ "$status" -ne 0 ]] || status=137; fi
if [[ "$(systemctl --user is-active "$LAB_UNIT" 2>/dev/null)" == "active" ]]; then echo "unit still active after exit; stopping" >&2; systemctl --user stop "$LAB_UNIT"; fi
lab_finish "$status" guarded "$*"
exit "$status"
