#!/usr/bin/env bash
# The atlas audit at 400, 768, 1,200, 1,600 and 2,000 px, two or three widths at a time (the lab's audit default of
# 26 October 2026). Loads the lab's memory floors from config/lab.env, the values scripts/lab-run.sh enforces, and hands
# over to tools/audit_five.py, which checks them before every launch and never bypasses them. Options: tools/audit_five.py --help.
# Example, from the lab folder:  motion/tools/audit-five.sh               (all five widths)
#                                 motion/tools/audit-five.sh --widths 768  (a targeted re-run, never valid for a publish)
set -euo pipefail
LAB="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)"
source "$LAB/scripts/common.sh"; lab_load_env
export LAB_MEMAVAILABLE_MIN_MIB LAB_SWAPFREE_MIN_MIB
exec python3 -I "$LAB/motion/tools/audit_five.py" "$@"
