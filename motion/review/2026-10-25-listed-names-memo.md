# Where else listed firms could be named, and what a Codex handoff would involve

Memo for the author, 25 October 2026, after round 8 of the motion study. Prose only; nothing here is built.

## What exists now

Since round 8 the two listed-firm files carry a display name, the full filed name, the script case, the
number of list entries sharing the name and the list memberships, for 4,753 of the 4,803 listed firms with
a located address (99.0 %) and 2,190 of the 2,220 in the Moscow window. The atlas shows them in two places:
the tooltip, as a glance view of up to three short lines, and the Under the cursor panel, as the detail
view. The video names nobody beyond the anchor firm, which it always did. The standing rule holds
everywhere: firms on no list and the neighbour firm are never named.

## Places where names could still appear

A find-by-name box in the atlas. A text field in the Go to card that matches the typed letters against the
4,803 display names and filed names, lists the first ten hits, and flies the camera to the chosen firm with
its tooltip open. Effort: half a day, including the audit states and the phone layout. Worth: high for your
own exploration and for anyone who arrives with a firm in mind; it is the one addition that turns the atlas
from a map one reads into a map one asks. The data are already on the page, so nothing new ships.

Labels on the map at the street zooms. From the 1 km scale down, the listed firms in view could carry a
short label as the cities do, with collision handling so that labels never overlap each other or a mark.
Effort: a day, most of it the collision rule and the audit. Worth: moderate. The central Moscow window holds
1,311 listed firms within 24 km, so at the city scale the labels would have to be rationed to the nearest
few and the view would read as cluttered; at the 250 m scale they read well. I would build the find box
first and decide on labels after using it.

The lists layer of the cells view. The 100 km cells' tooltip gives counts of sanctions-list and government
strategic members; it could add the three earliest-listed names in the cell, derived on the page from the
national file. Effort: two hours. Worth: moderate; it gives the national view a foothold in names without
a search.

Labels on the video's largest downtown piles. The one place the video could name firms is the downtown
year run, where the ten largest listed piles could carry a name as the year moves. Effort: half a day with
the text audit. Worth: low, and I advise against it: the marks are 11 px in a dense field, the audit already
carries 17 counted lines there, and a name that flashes for 0.75 s per year is read by nobody.

A review export. A script that writes the named listed firms to a CSV under motion/review (display name,
filed name, script case, listing year, list memberships, Moscow or national, no identifier and no
coordinate) so that the display rule can be read in bulk, sorted and corrected by eye. Effort: an hour.
Worth: high for quality control; the probe covers twelve strings, and 4,753 names deserve a pass by eye
before anyone else reads them. I would do this first, before any new screen.

Charts and legends. The charts aggregate (shares, odds, medians and quartiles), so there is no series a name
could attach to beyond the anchor firm in the comparison beat, which is named already. Legends describe
classes, not firms. Nothing to do there.

The comparison group. Never, by the rule.

## What a Codex handoff for the manuscript would involve

The manuscript treats the five memberships as fixed and unnamed, and its tables and figures aggregate.
Naming listed firms there is a scope decision, not a technical one: the natural places would be an appendix
table of the named members by list, or named call-outs on the Moscow insets of Figure 2.7. If you decide
to name them, the handoff is a self-contained brief in candidates/ with these parts.

The sources: the decree and government strategic workbooks' name columns and the sanctions file's name and
alias fields, named by their pinned source ids, with the priority order (decree, government, sanctions)
and the lab's INN cell rule. The display rule: the legal-form stripping and tagging, the three script
cases with the 0.85 similarity threshold and the BGN/PCGN 1947 scheme, the 60-character cap at a word
boundary, the orphan-quote rule, and the figures this run produced (6,318 of 6,372 members named; the case
counts; 1,930 shared display names; the similarity distribution) so that Codex can check its port against
them. The code: the four functions in R/motion/motion-common.R and the probe in R/tests, to be ported into
programming's R with the probe run first; programming/R/chapter2-memberships.R already imports every list
field, so the join is one step. The checks: one name per firm, the join equal to an R match, no identifier
or digit run in a name, no entrepreneur's personal name, the cap, and the count of unnamed members. The
rule, stated for the manuscript: listed firms may be named, firms on no list never, and no INN or OGRN is
printed anywhere.

Effort on Codex's side: a day for the port and the checks, plus whatever exhibit you choose. Effort on
yours: reading the review export first, because the display rule will put a few hundred names in front of
readers who know the firms, and the places where it is wrong are easier to find in a table than on a map.
