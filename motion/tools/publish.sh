#!/usr/bin/env bash
# The atlas's publish to the author's site in one command (round 19, the author's decision of 28 October 2026). It stops at the first failure.
#
#   motion/tools/publish.sh          the gate and the copies; nothing goes public:
#     1. publish-set.py --dates      the publish day (UTC) and the CORRECTIONS entry
#     2. audit-five.sh               the full five-width audit of the working tree, served for the run; zero findings, or it stops
#     3. publish-set.py --write      the publish set in motion/publish/, its checks passed
#     4. the publish copy committed and pushed to the lab's repository (the lab's rule: commit at each checkpoint, push after each commit)
#     5. the site's tools/import_atlas.py copies the set into the site's atlas/, and the site commits it
#   motion/tools/publish.sh --push   pushes the site, which GitHub Pages publishes; only on the author's word. One command for an atlas publish
#                                    and a site-only change: the site clean, an atlas change only from this gate's import, the site's check
#                                    in both engines (site-check.py, about 45 s) with zero findings, then the push. It pushes main only:
#                                    site work waiting for the author's approval stays on a local branch until it is merged.
#
# The site's folder is ~/Documents/website unless SITE names another. Run from anywhere inside the lab.
set -euo pipefail
HERE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
LAB="$(git -C "$HERE" rev-parse --show-toplevel)"
SITE="${SITE:-$HOME/Documents/website}"
say() { printf '%s\n' "publish: $*"; }

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then sed -n '2,15p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0; fi

if [[ "${1:-}" == "--push" ]]; then   # the author's pick B2 (29 October 2026): one push for atlas publishes and site-only changes
  branch="$(git -C "$SITE" rev-parse --abbrev-ref HEAD)"   # the author's pick B5: work waiting for approval stays on a branch, main is what is live
  [[ "$branch" == main ]] || { say "the site is on '$branch': merge it into main once it is approved, then push"; exit 1; }
  [[ -z "$(git -C "$SITE" status --porcelain)" ]] || { say "the site has uncommitted changes; commit or discard them first"; exit 1; }
  git -C "$SITE" fetch -q origin
  up="origin/main"
  ahead="$(git -C "$SITE" log --oneline "$up..HEAD")"
  [[ -n "$ahead" ]] || { say "nothing to push: the site's commits are all on GitHub"; exit 0; }
  atlas="$(git -C "$SITE" log -1 --format=%s "$up..HEAD" -- atlas)"   # the last commit to push that touches atlas/
  [[ -z "$atlas" || "$atlas" == Atlas:* ]] || { say "atlas/ changed in '$atlas', not in an import by this tool's gate; run publish.sh without --push first"; exit 1; }
  say "the site's check in both engines (about 45 s)"
  if ! out="$(python3 -I "$HERE/site-check.py" --site "$SITE" 2>&1)"; then printf '%s\n' "$out" | tail -25; say "the site's check has findings; nothing was pushed"; exit 1; fi
  printf '%s\n' "$out" | tail -2
  git -C "$SITE" push origin main
  say "pushed:"; printf '%s\n' "$ahead" | sed 's/^/  /'
  say "GitHub Pages publishes it in about a minute. Check it with a hard reload (Ctrl+Shift+R): browsers keep a script or a stylesheet for 10 minutes."   # the author's pick B1 (29 October 2026)
  exit 0
fi

cd "$LAB"
[[ -z "$(git status --porcelain -- motion/explorer.html motion/js motion/css motion/fonts motion/data motion/tools)" ]] \
  || { say "the atlas has uncommitted changes; commit them (approved) before publishing"; exit 1; }
round="$(grep -oE '^### Round [0-9]+' motion/README.md | tail -1 | grep -oE '[0-9]+')"
src="$(git rev-parse --short=7 HEAD)"

say "1/5 the publish day"
python3 -I motion/tools/publish-set.py --dates

say "2/5 the five-width audit (about 8 minutes)"
motion/tools/audit-five.sh

say "3/5 the publish set"
python3 -I motion/tools/publish-set.py --write
day="$(date -u '+%-d %B %Y')"

say "4/5 the publish copy, committed and pushed"
git add -A motion/publish
if git diff --cached --quiet; then say "the publish copy is unchanged"; else
  git commit -q -m "Publish copy: round $round (from $src), $day (UTC)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
  git push -q origin HEAD
fi

say "5/5 the site's atlas"
python3 -I "$SITE/tools/import_atlas.py" "$LAB/motion/publish"
git -C "$SITE" add -A
if git -C "$SITE" diff --cached --quiet; then say "the site's atlas is unchanged"; else
  git -C "$SITE" commit -q -m "Atlas: round $round publish copy (lab $(git rev-parse --short=7 HEAD)), $day (UTC)"
fi
say "ready. Nothing is public yet: on the author's word, run motion/tools/publish.sh --push"
