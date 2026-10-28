# Dataviz lab

Claude's visualization lab for the dissertation: the Visibility Atlas (`motion/explorer.html`, published at https://claude.ai/artifact/19DNAFozq23ng4qaD18m7n) and the explainer (`motion/explainer.html`). Sessions on the atlas or the explainer start here.

## Read first

- `motion/README.md`: the record of every round, the data passes, the tools and the publishing history. Round 18 is the latest.
- `design/principles.md`: the author's design rules. Read it before any visual work.
- `motion/review/`: round notes, proposals, measurements and review exports.

## Standing rules

- Publish only on the author's word.
- Frames first: any change with a visible or behavioural effect is shown as before/after frames and approved before it is committed.
- Proof by `motion/tools/change-proof.py` (the author's rule of 27 October 2026, round 18). A refactor whose run against the build before it comes out "identical" needs no frames. A change whose run shows only the strings it names changed, and frames that differ only in the panels that hold them (and in the side-column cards below them, which move with them), never in the map outside its panels, is reviewed from the run's crop sheet and needs no five-width audit at the review gate. Every other change keeps frames first and both gates. The publish gate's full five-width run stays for every publish.
- Work directly on `main`: no branch, worktree or forked session. Commit at each checkpoint and push after each commit.
- Audits (26 October 2026). While building, audit at 1,600 px only (`motion/tools/atlas-audit.py --widths 1600`). Run the full five-width audit, with `motion/tools/audit-five.sh`, only at two gates: before a review goes to the author, and before a publish.
- A publish needs a full run on the final build, all five widths in one run of `audit-five.sh`, with zero findings. Targeted re-runs (`--widths`) never count for a publish. A finding that shows only when widths run together, and not in its width's solo re-run, is noted the first time; once its check has shown that way in an earlier run, it counts (`motion/build/audit/parallel-only.json` keeps the record).
- Publish dates are UTC days (28 October 2026). Before the publish gate's run, `motion/tools/publish-set.py --dates` checks that a new CORRECTIONS entry carries the publish day and that no published entry already holds that day; the publish set refuses otherwise.
- Changes that arrive while an audit is running wait for the next run. A running audit is never stopped to fold them in.
- Every tool that makes a temporary browser profile removes it when it finishes (`/tmp` is a tmpfs here), and `scripts/lab-run.sh` and `audit-five.sh` warn about idle ones (`motion/tools/stale_profiles.py`) without deleting them.
- Build the publish set with `motion/tools/publish-set.py`. It never ships identifiers, and it names only firms on the five lists.
- Measure speed in the author's own Brave, with the window in front and live.
