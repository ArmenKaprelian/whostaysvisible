#!/usr/bin/env bash
# Runs inside the systemd unit: enters the read-only sandbox, then records the
# unit's peak memory from its cgroup before the unit is collected.
set -uo pipefail
source "$LAB_RUN_ENV"
source "$LAB_SCRIPTS/common.sh"
LAB="$LAB_ROOT"
lab_bwrap "$@"
status=$?
cg=$(cut -d: -f3 /proc/self/cgroup)
{
  echo "memory.peak $(cat "/sys/fs/cgroup$cg/memory.peak" 2>/dev/null || echo unknown)"
  echo "memory.swap.peak $(cat "/sys/fs/cgroup$cg/memory.swap.peak" 2>/dev/null || echo unknown)"
  echo "cgroup $cg"
} > "$LAB_RUN_DIR/peak.txt"
echo "$status" > "$LAB_RUN_DIR/status.txt"
exit "$status"
