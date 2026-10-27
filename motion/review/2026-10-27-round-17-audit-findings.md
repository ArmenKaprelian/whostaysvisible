# Round 17: the read-only audit's findings

Run on 27 October 2026 inside the round 17 review pass, from the brief `review/2026-10-27-round-17-audit-brief.md`, on atlas v37 (the working tree at 1639c27, whose page and data equal the published build). Read-only: no page, script, data file, tool or pass of the lab was changed, nothing in `LaTeX/` or `programming/` was touched, and nothing was published. The audit's three parts ran as four research agents under the brief's rules, the author's personal-data rule word for word in each brief: web requests with a fixed generic User-Agent and no personal data, SEC skipped, 3 web searches in part 1 and none in parts 2 and 3 (part 2's budget was 20), one DuckDB job through `scripts/lab-run.sh` (7 s). Their working notes, downloads and scripts are in `motion/build/round-17-audit/part1/`, `part2a/`, `part2b/` and `part3/` (ignored by git). No firm on no list is named here, and no identifier appears.

A harness rule stopped the agents from writing report files with the editor, so two of them wrote theirs with the shell and two returned the text, which the main session saved. The per-unit saves therefore happened only where the shell was used; the files are complete.

## What was checked

| Part | Checked |
|---|---|
| 1. The treated firms' list data | All 4,803 drawn firms on the five lists joined back to the registry by INN in DuckDB (the lab's join reproduced for all 4,757 linked one to one); the round 16 cases (7 entities, 12 drawn entries); group 1 (matched by name) is empty by construction, since every membership is an exact INN match, so its nearest proxy, the 1,286 dated firms whose list name is Latin only, was classified automatically and 20 examined by hand; group 2, 11 workbook regions that differ from the registry (all examined) and 34 place-name mismatches; group 3, the 10 dates before 2014 (all examined); the 4,207 dates' authorities classified by the file's own fields |
| 2. The insights' facts | All 23 units that make a claim about 2025 or 2026, and a sample of 16 others across the six research groups including the one single-source unit; 39 units and 96 source records, fetched live with local copies where EUR-Lex returned a bot check |
| 3. Drift from the chapter | All 191 pinned sources re-hashed (13.9 GB); 12 outside origins looked up for newer releases (9 reachable); 139 generation folders of the foundation listed; Table B.1 (90 cells), Table B.7 (72 rows) and Tables B.4 and B.5 (52 rows) compared by script, 72 other chapter figures and the guide's 15 figures by hand |

Verdicts on the 39 insight units: 36 supported, 3 partly supported (Ryazan Oblast, Ufa, St Petersburg city), none not supported, none unavailable.

## Findings

Kinds: **screen** (wrong on screen), **wording** (misleading wording), **records** (in the records only).

### Part 1: the list data

1. **Medvezhya Gora, OOO (Karelia) is a namesake** (screen). The sanctions file gives New Arctic Shipping a second row, "medvezhya gora ooo", carrying a Karelian INN; that INN is a stone quarry created in 2002, on no list, with a statement every year. OFAC's record names "Medvezhya Gora OOO" only as a former name of New Arctic Shipping, with the Moscow INN. Fix: a lab exclusion list of namesake INNs applied in DuckDB before the treated set is built, its count in the provenance.
2. **VNIIEF**: of its three drawn entries, one (entry 1564, the INN the government list also carries) is VNIIEF, geocoded at its registered address about 190 km from Sarov and 50 km from Nizhny Novgorod; entries 3585 and 581 carry other legal entities' INNs that the aggregator attached (screen). Its date, 30 June 1997, is the US Commerce Department's Entity List (as Arzamas-16).
3. **VNIITF**: the Chelyabinsk entry (2636) is VNIITF at Snezhinsk; the two Moscow entries named after it (1581, 2769) are other firms, both dissolved in 2017 (screen). Same 1997 Entity List date (as Chelyabinsk-70).
4. **The questioned dates are other countries' listings** (wording). Dagdizel's 18 March 2022 is New Zealand's (the day its Russia sanctions regulations took force); Omsktransmash's 13 April 2022 is Switzerland's (the EU's of 8 April was not in the file's data); Kurganpribor's 25 January 2023 and UAC's 12 November 2014 are probably Switzerland's. All four INNs are right.
5. **Eight of the ten entries dated before 2014 carry INNs of firms created after the listing** (screen): the three Apex entries (OOOs created 2014, 2018 and 2022, dated 9 October 2012) and Al Bir Al Daualia (a St Petersburg foundation registered in 2008, dated 21 November 2002), plus the VNIIEF and VNIITF entries of findings 2 and 3.
6. **What "on a list from" means** (wording): the earliest start date among the records an aggregator (OpenSanctions) held for the entity, across eight authorities and export-control lists; the file has no program or authority field. 2,098 of the 4,207 dates (50 percent) are inferred, and 157 fall on three days when the aggregator first recorded a whole list (6 August 2024, Canada; 27 May 2023; 20 April 2023). The page shows years before 2014 as 2014 in the panel, tile, find list, pulse label and the wire's count, while the wire's firm line prints the full date, so one firm can show two dates; "(date inferred)" appears only in the wire.
7. **One entity name covers several firms** (screen): 782 dated drawn firms belong to 389 entities with more than one INN. MTS has 29 drawn firms in 15 regions, 28 of them other companies; Volga Shipping 8, Orenburgneft 9, IFD Kapital 9. 350 dated firms left the registry before their listing year and still count as treated while they exist.
8. **A merged entity gives one firm another's date** (screen): the Kalinin Plant (entry 1325) sits in Koksokhimtrans's entity and shows its US date, 7 September 2016.
9. **Name lookups upstream** (screen): for Latin-only names, some INNs found by name belong to firms on no list: Terek Special Rapid Response Team, Khabarovsk Shipbuilding Plant, Zhiguli Radio Plant, North Design Bureau, Federal Center for Project Finance, Ashuluk Test Range, Krymskaya Pervaya Strakhovaya Kompaniya, the Azov distillery's two INNs and Imperski Legion all carry INNs of unrelated firms, several created after the listing. A random control of 8 unflagged Latin-only entries found the file's INN on the entity's page for 5, absent for 2, and 1 entity not found.

### Part 2: the insights

10. **St Petersburg (city)** (screen): "had built 60 of them by 2016" is one year's output; the cited report says 60 VK-2500 engines were assembled in 2016 alone, after 10 in 2015. Fix: "built 60 of them in 2016" (short form: "In 2016 ODK-Klimov made 60 engines", 72 characters).
11. **Ryazan Oblast** (wording): "and its refining subsidiaries" claims too much; Treasury sb0290 designates 8 refinery operators, and other subsidiaries are blocked by the 50 percent rule without designation. Fix: "and 8 of its refinery operators" (195 characters).
12. **Ufa** (wording): "decided in 2025" dates a decision Interfax (10 December 2025) does not date. Fix: "said in December 2025 it would sell".
13. **Nizhny Novgorod (city)** (wording): GAZ Group's sanctions basis is given only as the 2018 Deripaska link; since 14 September 2023 (jy1731) it is also designated under E.O. 14024 for the manufacturing sector.
14. **Kamchatka Krai** (screen, REFERENCES): the Oxford Institute for Energy Studies paper is dated October 2024 with no day; the panel prints "1 October 2024". Fix: date "2024-10".
15. **Vladivostok** (screen, REFERENCES): the Bank of Russia report carries a placeholder date, "1 January 2024"; the cited page is dated 24 June 2024.
16. **Saratov Oblast and Perm** (wording, REFERENCES): the UK list is dated by the CSV's report date (26 October 2026), not the entries' designation dates (24 February 2026, 18 May 2023), and the link downloads the 50 MB list.
17. **Leningrad oblast** (screen, REFERENCES): a European Commission Representation "News article" is cited as a "press release"; the build's TYPE map turns "news release" into "press release".
18. **St Petersburg (city)** (wording, REFERENCES): the publisher named is Rambler, the site carrying an AirCargoNews.ru article.
19. **Nenets Autonomous Okrug** (wording, REFERENCES): an undated portal page is shown with its first Internet Archive capture date (25 October 2020) as if it were the page's own.
20. **Living lists dated two ways** (records, minor on screen): the SDN file is dated by the download day in one unit (26 October 2026) and by the list's last update in another (21 October 2026).
21. **Krasnodar (city)** (records): "one of 11 Russian airports" rests only on a background paragraph beside a members-only CAPA brief; Kommersant confirms the closure and reopening, not the count.

### Part 3: drift from the chapter

22. **The wire calls the whole cohort located** (screen): "2021: 1,503,198 located eligible firms in the revenue cohort by cash share" (`js/explorer-app.js`, the wire's facts; `tools/wire_check.py`). 1,503,198 is the cohort among all eligible firms; the located cohort is 1,485,616 (07-financial-sample-implications.tex, Figure 2.8, and the atlas's own `cells100.json`). Fix: "2021: 1,503,198 eligible firms in the revenue cohort by cash share, 1,485,616 of them located", or drop "located".
23. **"2025\* is incomplete"** (wording): the national card and the guide (2.4) say more than the chapter, which calls 2025 "a flagged latest-year extension" and says retrieval timing "has not been established as its cause".
24. **The third list's old name** (wording): three strings still say "resident" (the tooltip's list words, the List members provenance line, "Reading the atlas") where the chapter's current text, REFERENCES, the glossary and the guide say "2020 filing-exemption list". The chapter's rename is in its uncommitted working tree of 24 October.
25. **Citation scopes** (wording): REFERENCES lists "Figure 2.6 and Table B.2 (transitions)" and "Figures 2.2 to 2.4 (groups)" as behind the panels, though no panel draws the transitions or Figure 2.4 (Table B.2 does stand behind the wire's cohort count); the guide's 4.3 cites Table B.4 for both provider eras, where the early era is Table B.5.
26. **Ten pinned files changed after their pin** (records): four chapter .tex files, three figure PDFs, a programming script and the printed-names file; no atlas pass reads them, so `R/lab-sources.R`'s check never fires, and nine of the ten drifts are recorded nowhere.
27. **A missing partial-pin record** (records): the three Tomorrow font entries (pinned 26 October) have no line in `partial_pins`.
28. **The sanctions file ends at 7 November 2024** (wording only if the atlas implies a current list): the supplied lists are fixed as in the chapter; the aggregator the chapter cites is current to 27 October 2026, so firms first listed in the 2025 and 2026 packages are on no list in the atlas.
29. **Older Stage B pins** (records): the 18 `finmeas` and `cohort` pins point at a 5 October generation; a 13 October pass-2 generation exists. No lab code reads them.

## Checked and clean

- **Part 1.** New Arctic Shipping, Dagdizel, Kurganpribor, Omsktransmash, UAC, VNIIEF (1564), VNIITF (2636), Kalashnikov and Volga Shipping (3609): INN yes. Ten of the eleven differing workbook regions are moves of the registered address; the atlas places firms by the latest registry region, as its rule says. All 4,803 INNs pass the tax service's check-digit test.
- **Part 2.** 36 of 39 units supported; every present-tense sanctions claim holds against the current SDN, UK and EU files; the Ingushetia and Kabardino-Balkaria budget figures re-read from the official scans (78.4 and 65.4 percent); Volgograd's 52 releases, 5 in the oblast, re-tallied from the live register.
- **Part 3.** 0 of 191 pinned files missing; 163 match their hashes, and the 18 pinned by size and date match those. RFSD v3.1.0 is the latest release (Zenodo, 8 versions); geoBoundaries RUS ADM1 is still at 9469f09; the fonts are current; the World Bank's newer WDI release has identical Russia values; the only foundation build newer than the pinned one is its exact reproduction. Table B.1 (90 cells), B.7 (72 rows, within print rounding) and B.4 and B.5 (52 rows) equal `series.json`; the group shares, the located firms of 2021 (3,277,638 at 727,190 pairs) across six passes, Figures 2.7 and 2.8, the odds card and the guide's figures match the chapter.

## Needs the author

From part 1: what "on a list from" should mean on screen; whether the 157 capture-day dates show as undated; the rule for entities with several INNs (782 firms); whether the lab may keep an exclusion list of namesake INNs (the chapter's own sanctioned group uses the same file and match, which is for the programming checkup); whether a bulk check against OpenSanctions identifiers may be run (a download); VNIIEF's mark. From part 2: one rule for undated pages, for living lists, and for republished articles; "rubles" or "roubles"; whether to widen GAZ Group's approved text. From part 3: keep the supplied lists or move to a newer one (a request to the RFSD authors, which this audit did not send); "2025\* is incomplete" or the chapter's wording; when to follow the chapter's new list name; whether to re-pin the chapter files.

## Findings for round 17

Proposed changes, one line each, for the author to accept or decline; the audit applies none of them.

1. Exclude the Karelian Medvezhya Gora INN, the three Apex INNs and the Al Bir INN from the treated set through a lab exclusion list applied in DuckDB, disclosed in `treatednational.provenance.json` (findings 1 and 5).
2. Exclude the other INNs of the VNIIEF and VNIITF entities (entries 581, 3585, 1581, 2769) under the same list (findings 2 and 3).
3. Add the namesakes of finding 9 to the list.
4. Per multi-INN entity, keep the INN that the official record or a workbook carries and drop or mark the rest, after the author's rule (finding 7, 782 firms).
5. Treat the Kalinin Plant as undated until its own listing is found (finding 8).
6. Show the real year of listings before 2014 in the panel, tile and find list ("on a list from 1997, red from 2014") and leave them out of the 2014 pulse label and the wire's 2014 count (finding 6).
7. Carry "(date inferred)" wherever a listing date or year appears (finding 6).
8. Show the 157 capture-day dates as undated or as "first recorded <date>", after the author's choice (finding 6).
9. Say once in the sources or the glossary what the date is: the earliest start date among eight authorities' records in the supplied file, export-control lists included, half of them inferred (finding 6).
10. Add to VNIIEF's panel line that its position is the registry's geocode of the registered address, Sarov being a closed town (finding 2).
11. Add a check to M8: no drawn listed firm created after its listing date unless it is on a reviewed list of successors (findings 5 and 9).
12. On the author's word, check every sanctions-file INN in bulk against the identifiers in the official records (finding 9).
13. St Petersburg (city): "built 60 of them in 2016" and "In 2016 ODK-Klimov made 60 engines" (finding 10).
14. Ryazan Oblast: "and 8 of its refinery operators" (finding 11).
15. Ufa: "said in December 2025 it would sell" (finding 12).
16. Nizhny Novgorod (city): name GAZ Group's 2023 manufacturing-sector designation, with Treasury jy1731 as a source, if the author widens the approved text (finding 13).
17. Kamchatka Krai: date the OIES paper "2024-10" (finding 14).
18. Vladivostok: date the Bank of Russia report "2024-06-24" (finding 15).
19. Saratov Oblast and Perm: date the UK entries by their designation dates, 24 February 2026 and 18 May 2023 (finding 16).
20. Leningrad oblast: type the Commission Representation page as a news item, or cite the Commission's own press release (finding 17); fix the TYPE map in `tools/insights_build.py`.
21. St Petersburg (city): publisher "AirCargoNews.ru (on Rambler)" (finding 18).
22. Nenets Autonomous Okrug: show the portal page under the author's rule for undated pages (finding 19).
23. One dating rule for living lists, applied to the SDN file, the OFAC search entry and the UK list (finding 20).
24. Krasnodar (city): add a dated source that gives the count of 11 airports, or drop it (finding 21).
25. One spelling of the currency across the insights.
26. The wire's cohort line: "2021: 1,503,198 eligible firms in the revenue cohort by cash share, 1,485,616 of them located", in the page and in `tools/wire_check.py` (finding 22).
27. Replace "2025\* is incomplete" in the national card and the guide with the chapter's flagged latest year (finding 23).
28. Rename the third list "2020 filing-exemption" in the tooltip's list words, the List members provenance line and "Reading the atlas" (finding 24).
29. Narrow the REFERENCES line to the figures the panels show, and cite Tables B.4 and B.5 in the guide's 4.3 (finding 25).
30. State the sanctions list's cutoff on the atlas: lists as supplied to the chapter, latest listing 7 November 2024 (finding 28).
31. Record the ten drifted pins in the lab README's sources notes, and re-pin the flow and figure entries only when that work is re-run (finding 26).
32. Drop `motion.printed-names` from `config/sources.json`, or name the pass that reads it (finding 26).
33. Add the missing partial-pin record for the Tomorrow fonts, and make `pin-sources.py --only` always write one (finding 27).
34. Record the sha256 of the 18 size-and-date-only entries at the next pin (their hashes are in `part3/hashes.tsv`).
35. Note in the README that the pinned foundation is the primary build and `task4-rebuild-lightning-20261005` its exact reproduction.
36. Mark the 18 `finmeas` and `cohort` pins as superseded by the pass-2 generation, or drop them (finding 29).
37. Update the lab README's "188 entries" to 191 at the next re-pin.
