#!/usr/bin/env bash
# Usage: ram-watch.sh UNIT LOGFILE INTERVAL FLOOR_MIB SWAP_FLOOR_MIB
# Samples memory every INTERVAL seconds; stops the unit after two consecutive
# samples below either floor. A child of the launcher; it dies with it.
set -u
unit=$1; log=$2; interval=$3; floor=$4; sfloor=$5; strikes=0
mib() { if [[ "${1:-}" =~ ^[0-9]+$ ]]; then echo $(( $1 / 1048576 )); else echo ""; fi; }
echo "utc,mem_available_mib,swap_free_mib,unit_current_mib,unit_peak_mib,top_rss" > "$log"
while true; do
  ma=$(awk '/MemAvailable:/ {printf "%d", $2/1024}' /proc/meminfo)
  sf=$(awk '/SwapFree:/ {printf "%d", $2/1024}' /proc/meminfo)
  cur=$(systemctl --user show -p MemoryCurrent --value "$unit" 2>/dev/null)
  peak=$(systemctl --user show -p MemoryPeak --value "$unit" 2>/dev/null)
  top=$(ps -eo rss,comm --sort=-rss | awk 'NR>1 && NR<=7 {printf "%s:%dM ", $2, $1/1024}')
  echo "$(date -u +%FT%TZ),$ma,$sf,$(mib "$cur"),$(mib "$peak"),\"$top\"" >> "$log"
  if (( ma < floor || sf < sfloor )); then strikes=$((strikes + 1)); else strikes=0; fi
  if (( strikes >= 2 )); then
    systemctl --user stop "$unit.service" 2>/dev/null
    echo "STOPPED by watcher: MemAvailable=${ma} MiB, SwapFree=${sf} MiB" >> "$log"
    exit 0
  fi
  sleep "$interval"
done
