#!/usr/bin/env bash
# Usage: ram-watch.sh UNIT LOGFILE INTERVAL FLOOR_MIB SWAP_FLOOR_MIB HIGH_BYTES
# Samples memory every INTERVAL seconds. Stops the unit (a) after two consecutive
# samples with the machine below either floor, or (b) after twelve consecutive
# samples (one minute) with the unit's anonymous memory plus swap at or above its
# MemoryHigh threshold: a job throttled there crawls instead of finishing.
# A child of the launcher; it dies with it.
set -u
exec 9>&-   # never inherit the launcher's lock descriptor
unit=$1; log=$2; interval=$3; floor=$4; sfloor=$5; high=${6:-0}
strikes=0; crawl=0
mib() { if [[ "${1:-}" =~ ^[0-9]+$ ]]; then echo $(( $1 / 1048576 )); else echo ""; fi; }
echo "utc,mem_available_mib,swap_free_mib,unit_current_mib,unit_anon_mib,unit_swap_mib,unit_peak_mib,top_rss" > "$log"
while true; do
  ma=$(awk '/MemAvailable:/ {printf "%d", $2/1024}' /proc/meminfo)
  sf=$(awk '/SwapFree:/ {printf "%d", $2/1024}' /proc/meminfo)
  cur=$(systemctl --user show -p MemoryCurrent --value "$unit" 2>/dev/null)
  peak=$(systemctl --user show -p MemoryPeak --value "$unit" 2>/dev/null)
  cg=$(systemctl --user show -p ControlGroup --value "$unit" 2>/dev/null)
  anon=""; uswap=""
  if [[ -n "$cg" && -r "/sys/fs/cgroup$cg/memory.stat" ]]; then
    anon=$(awk '$1=="anon" {print $2}' "/sys/fs/cgroup$cg/memory.stat")
    uswap=$(cat "/sys/fs/cgroup$cg/memory.swap.current" 2>/dev/null)
  fi
  top=$(ps -eo rss,comm --sort=-rss | awk 'NR>1 && NR<=7 {printf "%s:%dM ", $2, $1/1024}')
  echo "$(date -u +%FT%TZ),$ma,$sf,$(mib "$cur"),$(mib "$anon"),$(mib "$uswap"),$(mib "$peak"),\"$top\"" >> "$log"
  if (( ma < floor || sf < sfloor )); then strikes=$((strikes + 1)); else strikes=0; fi
  if [[ "$anon" =~ ^[0-9]+$ ]] && (( high > 0 )) && (( anon + ${uswap:-0} >= high )); then crawl=$((crawl + 1)); else crawl=0; fi
  if (( strikes >= 2 )); then
    systemctl --user stop "$unit.service" 2>/dev/null
    echo "STOPPED by watcher: MemAvailable=${ma} MiB, SwapFree=${sf} MiB" >> "$log"; exit 0
  fi
  if (( crawl >= 12 )); then
    systemctl --user stop "$unit.service" 2>/dev/null
    echo "STOPPED by watcher: unit anonymous memory $(mib "$anon") MiB + swap $(mib "${uswap:-0}") MiB at or above MemoryHigh for 60 s" >> "$log"; exit 0
  fi
  sleep "$interval"
done
