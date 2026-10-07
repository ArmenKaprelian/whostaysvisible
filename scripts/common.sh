#!/usr/bin/env bash
# Shared launcher functions; sourced by lab-ro.sh, lab-run.sh and lab-unit-wrapper.sh.

lab_load_env() {
  LAB_SCRIPTS=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
  # shellcheck source=../config/lab.env
  source "$LAB_SCRIPTS/../config/lab.env"
  export LAB_SCRIPTS
}

lab_require_disk_scratch() {
  local fs free_kib
  fs=$(findmnt -n -o FSTYPE -T "$LAB_SCRATCH_PARENT" | head -n 1)
  if [[ -z "$fs" || "$fs" == tmpfs || "$fs" == ramfs ]]; then
    echo "Refusing RAM-backed or unidentified scratch filesystem: $fs" >&2; exit 1
  fi
  free_kib=$(df -Pk "$LAB_SCRATCH_PARENT" | awk 'END {print $4}')
  if (( free_kib < LAB_SCRATCH_MIN_GIB * 1048576 )); then
    echo "Need at least ${LAB_SCRATCH_MIN_GIB} GiB free on $LAB_SCRATCH_PARENT." >&2; exit 1
  fi
}

# Label for the run id: the first argument that names a script file, else the last argument.
lab_label() {
  local a label=""
  for a in "$@"; do case "$a" in *.R|*.py|*.sh) label=$(basename -- "$a"); break;; esac; done
  [[ -n "$label" ]] || label=$(basename -- "${@: -1}")
  printf '%s' "$label" | sed 's/[^A-Za-z0-9_.-]/_/g'
}

lab_mem_available_mib() { awk '/MemAvailable:/ {printf "%d", $2/1024}' /proc/meminfo; }
lab_swap_free_mib()     { awk '/SwapFree:/ {printf "%d", $2/1024}' /proc/meminfo; }

# $1 = label. Creates the run folder, disk scratch and the facts R records.
lab_make_run() {
  LAB_RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)-$1"
  LAB_RUN_DIR="$LAB/logs/$LAB_RUN_ID"
  mkdir -p "$LAB_RUN_DIR"
  LAB_SCRATCH=$(mktemp -d "$LAB_SCRATCH_PARENT/claude-dataviz-lab-$(id -u)-XXXXXXXX")
  mkdir -p "$LAB_SCRATCH/tmp" "$LAB_SCRATCH/duckdb" "$LAB_SCRATCH/home-cache"
  LAB_START_EPOCH=$(date +%s)
  LAB_PROG_HEAD=$(git -C "$PROG" --no-optional-locks rev-parse HEAD 2>/dev/null || echo unknown)
  LAB_PROG_DIRTY=$(git -C "$PROG" --no-optional-locks status --porcelain 2>/dev/null | wc -l | tr -d ' ')
  LAB_COMMIT=$(git -C "$LAB" --no-optional-locks rev-parse --verify -q HEAD 2>/dev/null) || LAB_COMMIT=none
  [[ -n "$LAB_COMMIT" ]] || LAB_COMMIT=none
  export LAB_RUN_ID LAB_RUN_DIR LAB_SCRATCH LAB_START_EPOCH LAB_PROG_HEAD LAB_PROG_DIRTY LAB_COMMIT
}

# Writes the environment the job runs with. $1 = mode (ro|guarded), $2 = MemoryMax label.
lab_write_env_file() {
  cat > "$LAB_SCRATCH/run.env" <<EOF2
export TMPDIR="$LAB_SCRATCH/tmp"
export HOME="$HOME"
export PATH="/usr/local/bin:/usr/bin:/bin"
export LANG="C.UTF-8"
export LAB_ROOT="$LAB"
export LAB_PROG="$PROG"
export LAB_LATEX="$LATEX"
export LAB_RENV_LIB="$RENV_LIB"
export R_LIBS="$LAB/lib"
export LAB_RUN_ID="$LAB_RUN_ID"
export LAB_RUN_DIR="$LAB_RUN_DIR"
export LAB_SCRATCH="$LAB_SCRATCH"
export LAB_MODE="$1"
export LAB_MEMORY_MAX="${2:-none}"
export LAB_PROG_HEAD="$LAB_PROG_HEAD"
export LAB_PROG_DIRTY="$LAB_PROG_DIRTY"
export LAB_COMMIT="$LAB_COMMIT"
export LAB_DUCKDB_MEMORY_LIMIT="$LAB_DUCKDB_MEMORY_LIMIT"
export LAB_DUCKDB_THREADS="$LAB_DUCKDB_THREADS"
export LAB_DUCKDB_TEMP_DIRECTORY="$LAB_SCRATCH/duckdb"
export LAB_DUCKDB_MAX_TEMP="$LAB_DUCKDB_MAX_TEMP"
export OMP_NUM_THREADS=1
export OPENBLAS_NUM_THREADS=1
export MKL_NUM_THREADS=1
EOF2
}

# Read-only view of the whole filesystem; only the lab and scratch are writable.
lab_bwrap() {
  bwrap --ro-bind / / --dev /dev --proc /proc --tmpfs /tmp \
    --bind "$LAB" "$LAB" \
    --bind "$LAB_SCRATCH" "$LAB_SCRATCH" \
    --bind "$LAB_SCRATCH/home-cache" "$HOME/.cache" \
    --die-with-parent --new-session --chdir "$LAB" -- "$@"
}

# $1 = exit status, $2 = mode, $3 = command string. Writes run.json and the read-only check.
lab_finish() {
  local status=$1 mode=$2 cmd=$3 end peak ro
  end=$(date +%s)
  "$LAB_SCRIPTS/check-readonly.sh" "$LAB_START_EPOCH" > "$LAB_RUN_DIR/readonly-check.txt" 2>&1 || true
  peak="null"
  if [[ -f "$LAB_RUN_DIR/peak.txt" ]]; then
    peak=$(awk '$1=="memory.peak" && $2 ~ /^[0-9]+$/ {print $2}' "$LAB_RUN_DIR/peak.txt")
    [[ -n "$peak" ]] || peak="null"
  fi
  if [[ "$peak" == "null" && -f "$LAB_RUN_DIR/ram.log" ]]; then
    peak=$(awk -F, 'NR>1 && $7 ~ /^[0-9]+$/ {if ($7>m) m=$7} END {if (m>0) printf "%d", m*1048576; else print "null"}' "$LAB_RUN_DIR/ram.log")
  fi
  ro=$(grep -c . "$LAB_RUN_DIR/readonly-check.txt" 2>/dev/null); ro=${ro:-0}
  jq -n --arg run "$LAB_RUN_ID" --arg mode "$mode" --arg cmd "$cmd" --arg status "$status" \
        --arg start "$LAB_START_EPOCH" --arg end "$end" --arg peak "$peak" \
        --arg head "$LAB_PROG_HEAD" --arg dirty "$LAB_PROG_DIRTY" --arg lab "$LAB_COMMIT" \
        --arg mem "$LAB_MEMORY_MAX_USED" \
        --arg ro "$ro" \
    '{run_id:$run, mode:$mode, command:$cmd, exit_status:($status|tonumber),
      start_epoch:($start|tonumber), end_epoch:($end|tonumber), seconds:(($end|tonumber)-($start|tonumber)),
      memory_max:$mem, peak_bytes:(if $peak=="null" then null else ($peak|tonumber) end),
      programming_head:$head, programming_dirty_files:($dirty|tonumber), lab_commit:$lab,
      readonly_check_lines:($ro|tonumber)}' > "$LAB_RUN_DIR/run.json"
  echo "run $LAB_RUN_ID: exit $status, $((end - LAB_START_EPOCH)) s, peak ${peak} bytes, read-only check lines: $ro" >&2
}
