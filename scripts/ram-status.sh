#!/usr/bin/env bash
# One-shot memory and job status with a verdict. Never installed as a service.
set -u
source "$(dirname -- "${BASH_SOURCE[0]}")/common.sh"; lab_load_env
free -m | sed -n '1,3p'
swapon --show 2>/dev/null
echo "top RSS:"; ps -eo rss,pcpu,comm --sort=-rss | awk 'NR==1 || NR<=11 {printf "  %7s MiB  %5s%%  %s\n", (NR==1?"RSS":int($1/1024)), (NR==1?"CPU":$2), $3}'
echo "codex unit $CODEX_UNIT: $(systemctl --user is-active "$CODEX_UNIT" 2>/dev/null)"
if [[ -f "$CODEX_LOCK" ]] && fuser "$CODEX_LOCK" >/dev/null 2>&1; then echo "codex lock: held"; else echo "codex lock: free"; fi
echo "lab unit $LAB_UNIT: $(systemctl --user is-active "$LAB_UNIT" 2>/dev/null)"
latest=$(ls -1dt "$LAB"/logs/*/ram.log 2>/dev/null | head -n 1)
[[ -n "$latest" ]] && { echo "latest watcher log ($latest):"; tail -n 3 "$latest"; }
ma=$(lab_mem_available_mib); sf=$(lab_swap_free_mib)
if [[ "$(systemctl --user is-active "$CODEX_UNIT" 2>/dev/null)" == "active" ]]; then verdict="wait: Codex job active"
elif (( ma >= LAB_MEMAVAILABLE_MIN_MIB && sf >= LAB_SWAPFREE_MIN_MIB )); then verdict="OK for a guarded ${LAB_MEMORY_MAX} job (MemAvailable ${ma} MiB, SwapFree ${sf} MiB)"
elif (( ma >= 3072 )); then verdict="OK for a read-only job only (MemAvailable ${ma} MiB, SwapFree ${sf} MiB)"
else verdict="wait (MemAvailable ${ma} MiB, SwapFree ${sf} MiB)"; fi
echo "verdict: $verdict"
