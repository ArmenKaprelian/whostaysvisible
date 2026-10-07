#!/usr/bin/env bash
# Read-only wrapper for Stage A scripts, figure rendering and gallery builds.
# No memory cap: use only for KB-to-MB inputs. Guarded jobs use lab-run.sh.
set -uo pipefail
source "$(dirname -- "${BASH_SOURCE[0]}")/common.sh"; lab_load_env
[[ $# -gt 0 ]] || { echo 'Usage: scripts/lab-ro.sh COMMAND [ARG ...]' >&2; exit 2; }
lab_require_disk_scratch
label=$(lab_label "$@")
lab_make_run "ro-$label"
trap 'rm -rf "$LAB_SCRATCH"' EXIT
LAB_MEMORY_MAX_USED=none
lab_write_env_file ro none
echo "lab-ro run $LAB_RUN_ID (scratch $LAB_SCRATCH)" >&2
( source "$LAB_SCRATCH/run.env"; lab_bwrap "$@" ) 2>&1 | tee "$LAB_RUN_DIR/console.log"
status=${PIPESTATUS[0]}
lab_finish "$status" ro "$*"
exit "$status"
