#!/usr/bin/env bash
# The atlas audit at 400, 768, 1,200, 1,600 and 2,000 px, all five at once since round 30 (two or three widths at a time before, the lab's audit default of
# 26 October 2026). Loads the lab's memory floors from config/lab.env, the values scripts/lab-run.sh enforces, and hands
# over to tools/audit_five.py, which checks them before every launch and never bypasses them. Options: tools/audit_five.py --help.
# Example, from the lab folder:  motion/tools/audit-five.sh               (all five widths)
#                                 motion/tools/audit-five.sh --widths 768  (a targeted re-run, never valid for a publish)
# Round 17: the lab is found through git, so a copy of the tools in a trial folder inside the lab (motion/build/...) runs its own audit_five.py with the lab's floors.
set -euo pipefail
HERE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
LAB="$(git -C "$HERE" rev-parse --show-toplevel 2>/dev/null || (cd -- "$HERE/../.." && pwd -P))"
source "$LAB/scripts/common.sh"; lab_load_env
export LAB_MEMAVAILABLE_MIN_MIB LAB_SWAPFREE_MIN_MIB
exec python3 -I "$HERE/audit_five.py" "$@"
