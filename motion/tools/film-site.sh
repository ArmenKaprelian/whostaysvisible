#!/usr/bin/env bash
# The film's site copy (round 32, 1 November 2026; the prose recipe of cut B2 as a tool): encodes the lab's 1080p render to the 720p
# file the site plays (Lanczos to 1280 by 720, x264 CRF 23, preset slow, +faststart) with a keyframe forced at every chapter start
# read from the site's film page, checks the duration and the keyframes with ffprobe, and with --write copies the file into the site.
# Usage: motion/tools/film-site.sh [--write] [RENDER]     (default render: motion/build/who-stays-visible-full-244s.mp4; SITE=... overrides ~/Documents/website)
set -euo pipefail
case "${1:-}" in -h|--help) sed -n '2,5p' "$0"; exit 0;; esac
WRITE=0; if [[ "${1:-}" == "--write" ]]; then WRITE=1; shift; fi
HERE="$(cd "$(dirname "$0")" && pwd)"; MOTION="$(cd "$HERE/.." && pwd)"; SITE="${SITE:-$HOME/Documents/website}"
SRC="${1:-$MOTION/build/who-stays-visible-full-244s.mp4}"; OUT="${SRC%.mp4}-720p.mp4"; PAGE="$SITE/film/index.html"; DEST="$SITE/film/who-stays-visible-244s.mp4"
times=$(grep -o 'data-t="[0-9.]*"' "$PAGE" | grep -o '[0-9.]*' | paste -sd,); n=$(tr ',' '\n' <<<"$times" | wc -l)
ffmpeg -loglevel error -y -i "$SRC" -vf "scale=1280:720:flags=lanczos" -c:v libx264 -crf 23 -preset slow -pix_fmt yuv420p -force_key_frames "$times" -movflags +faststart -an "$OUT"
dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT")
kf=$(ffprobe -v error -select_streams v:0 -skip_frame nokey -show_entries frame=pts_time -of csv=p=0 "$OUT" | tr '\n' ' ')
missing=$(python3 -I -c "
import sys; ts = [float(t) for t in sys.argv[1].split(',')]; kf = [float(x) for x in sys.argv[2].split()]
print(','.join(str(t) for t in ts if not any(abs(t - k) < 1 / 30 for k in kf)))" "$times" "$kf")
echo "encoded $OUT: $dur s, $n chapter starts, $(stat -c %s "$OUT") bytes; keyframes missing at: ${missing:-none}"
[[ -z "$missing" ]] || { echo "refused: a chapter start has no keyframe"; exit 1; }
if (( WRITE )); then cp "$OUT" "$DEST"; echo "copied to $DEST"; else echo "dry run: --write copies it to $DEST"; fi
