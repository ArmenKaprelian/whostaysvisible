# Round 17: a read-only audit of the atlas (brief)

Written on 27 October 2026, after atlas v37 was published (version id 1793105054-929e, from commit 331f7b1), at the author's request. Not started: the author starts it in a new session. The session works in `Claude Code/current/dataviz-lab/`, reads the lab's `CLAUDE.md` and `motion/README.md` (round 16 is the latest) first, and ends with the findings report described at the end of this brief.

## The author's request (27 October 2026, word for word)

> F. After the publish, write a brief for a read-only audit in a new session (don't start it), saved in motion/review/ and ending in a findings report for round 17. Add it as a tracker row now. Scope, limited to what no current check covers:
> 1. The treated firms' list data: whether each list entry's INN belongs to the firm it describes, and what the "on a list from" year means on screen (the sanctions file's start year, which can come from another country's or agency's act). Start with the review page's data findings (Karelia, VNIIEF, the listing dates) and Dagdizel's date.
> 2. The insights' facts: about 15 of the 104 checked against their sources, plus every claim about 2025 or 2026.
> 3. Drift from the chapter: re-hash the pinned sources in config/sources.json, look for newer generations of them, and compare the headline figures the atlas prints with the chapter's current tables.
> The brief carries my personal-data rule for web requests and leaves the chapter's own pipeline to the programming checkup.

The insights now number 103: the author left Kalmykia out on 27 October, after the request was written.

## Rules for the session

**Read-only.** The audit changes no page, script, data file, tool or pass of the lab, nothing in the dissertation's `LaTeX/` or `programming/` folders, and publishes nothing. It writes only its report, its working notes under `motion/build/round-17-audit/` (ignored by git) and the status cell of its tracker row. Fixes go into the report as proposals for round 17, for the author to accept or decline. The lab's standing rules apply: work on `main` with no branch or worktree, and commit and push the report and the tracker row as records.

**The author's personal-data rule, word for word from the author's global instructions:**

> Never send correspondence, or any of the author's personal data, to anyone on any platform without the author's explicit and direct approval of that specific send, given in the chat. Correspondence includes email, chat and direct messages, posts, comments and replies (GitHub issues and pull requests included), and form submissions. Personal data includes the author's name, email address, phone number, account names and any other contact details, wherever they would go: in a message, a form, or a request's headers (the User-Agent among them), parameters or body. An approval covers only the send it names.
>
> Web fetches, downloads and searches use a fixed generic User-Agent and carry no personal data. A source that will not answer without contact details is skipped, unless the author has given an address set up for that purpose. Every brief for a subagent or another session that may make network requests includes this rule.

The SEC's servers ask for contact details in the User-Agent; round 16's research sent the author's address there once, which led to this rule. SEC filings are skipped unless the author gives an address for the purpose. Any subagent's brief carries the rule above word for word.

**The chapter's pipeline stays out.** The audit reads the chapter's tables and the pinned source files. It does not run, review or judge the code and data passes under `programming/`: that is the programming checkup's work (`Claude Code/current/programming-checkup/CHECKUP.md`), which runs only when the author asks.

**Working habits (the lab's research rules).** Save the report after each unit checked, so an interrupted run resumes from it. Keep nothing the audit needs only in `/tmp`. Run DuckDB through `scripts/lab-run.sh` with the guard's memory settings. A headless browser removes its profile when it finishes. Names of firms on no list never leave DuckDB and never enter the report; firms on the five lists may be named.

## 1. The treated firms' list data

**Question.** For each entry of the five lists that the atlas draws, does its INN belong to the firm the entry describes? And what does the date on screen mean? The atlas says "on a list from <date>" and colours a firm red from that year. The date is the sanctions file's start date for the entry, which can come from another country's or another agency's act.

**Where.** The list files, pinned in `config/sources.json`; `R/motion/M6-treated.R`, `M6-common.R` and `M8-national.R`, which join the lists to the registry by INN inside DuckDB; `motion/data/treatednational.json` with its provenance and checks (`red_from`, the names and the memberships the page shows).

**Start with** the findings noted on the way in round 16's insight research (`review/2026-10-27-round-16-insights.html`, "Noticed on the way"; the agents' reports in `motion/build/insights-drafts/pass2/report-*.md`):
- Karelia: "Medvezhya Gora, OOO", on a list from 19 May 2023, looks like a namesake of OFAC's MEDVEZHYA GORA OOO, a former name of New Arctic Shipping, registered in Moscow. The Karelian record was matched by name only.
- VNIIEF: its two records are geocoded inside the Nizhny Novgorod city window and 54 km north of it, not at Sarov, a closed town. Nizhny Novgorod Oblast's profile in v37 names VNIIEF at Sarov.
- The listing dates: several "on a list from" dates are earlier acts by other countries or by the US Commerce Department, not the acts the insight texts name (Kurganpribor, Omsktransmash, UAC; VNIIEF and VNIITF, 30 June 1997).
- Dagdizel: the map dates it 18 March 2022, and the US designation is dated 24 March 2022. Which list gives the 18th?

**Then** a sample beyond these: the entries matched by name rather than by INN, if the passes record the match type; every entry whose registered region differs from the region its list entry gives; and every date earlier than 2014.

**For each entry checked:** whether the INN matches (yes, no or uncertain, with the evidence); which act and authority the date comes from; and, where the date misleads, a proposed wording or rule for "on a list from".

## 2. The insights' facts

**Question.** Does each source say what the insight says, with the dates and numbers exact?

**Where.** `motion/data/insights.json` (the texts and the cited sources), `motion/data/insights.provenance.json` (titles, snippets, research dates and the author's audit), the research files in `motion/build/insights-drafts/pass2/` (the reports and the downloads in `dl-*`), and the checks in `tools/insights_build.py`.

**Which units.** Every unit whose full text makes a claim about 2025 or 2026 (23 of the 103 on 27 October; list them from `insights.json` first), and about 15 others spread across the six region groups of the research (A to F), including every unit that rests on one source. Use direct fetches of the URLs in the provenance; search the web only where a source is gone, with no more than 20 searches in all.

**For each unit:** supported, partly supported, not supported, or source unavailable, with the passage that decides it or the reason, and a proposed fix.

## 3. Drift from the chapter

**Pinned sources.** Re-hash every file pinned in `config/sources.json` (its `sources` entries) against the recorded SHA-256 and size; report every mismatch and every missing file.

**Newer generations.** For each pinned source with an outside origin, look for a newer release or generation (the RFSD's Zenodo record after v3.1.0, geoBoundaries gbOpen RUS ADM1 after commit 9469f09, the list files, the World Bank deflator, the fonts) and for a newer generation of the foundation's derived files under `programming/data/derived/`. Report what exists and what would change; update nothing.

**Headline figures.** Compare the figures the atlas prints with the chapter's current tables in `LaTeX/kaprelian_dissertation/chapters/02-opacity/` and its appendix: the national availability by year, the group shares and counts for 2021 and 2024, the located firms and coordinate pairs of 2021 (3,277,638 at 727,190), the odds card's ratios, and the figures in the TEACH YOUR AGENT guide. For each difference: which side is newer, and which pass produced the atlas's number.

## The report

**File:** `motion/review/<date of the run>-round-17-audit-findings.md`, saved after each unit.

**Contents:**
- What was checked, with counts for each part.
- The findings, numbered. Each gives what is wrong, where (the file and line, the unit, or the list entry), the evidence (a quoted passage, a hash or a figure), the kind (wrong on screen, misleading wording, or in the records only), and a proposed fix.
- What was checked and found clean.
- **Findings for round 17**, at the end: a numbered list of proposed changes, one line each, for the author to accept or decline. The audit applies none of them.

When the report is done, the tracker's row "Read-only audit brief for round 17" (`review/2026-10-26-round-15-close-out-tracker.md`) gets a status of one or two sentences that names the report.
