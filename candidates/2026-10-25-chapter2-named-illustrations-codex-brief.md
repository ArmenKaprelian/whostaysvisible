# Codex task brief: two named illustrations for Chapter 2 (Aeroflot's filing path, a table of the largest listed firms)

Written by Claude in the dataviz lab on 25 October 2026, for the author to paste if they decide to. It is an implementation specification and an assessment, not an authorization. The author's decisions are marked as such. Everything else is Claude's reading of the current records. It builds on the lab's memo of 25 October 2026 on naming listed firms (`motion/review/2026-10-25-listed-names-memo.md`) and on the standing rule recorded that day: firms on the five lists may be named, firms on no list never, and no INN or OGRN is printed anywhere.

## 1. Purpose and precedent

Chapter 1 names one firm as an illustration of the data. Section 1.4.2 reproduces a panel of Gazprom's filings as Table 1.2 (`tab:gazprom_panel`, `chapters/01-foundations/05-data-and-sources.tex`), adapted from the RFSD paper under CC BY 4.0, and two sentences of the same section use Gazprom to explain the revenue decomposition and the validation of outliers. Nothing else in the manuscript names a firm. Chapter 2 treats the five lists as fixed memberships, never names a member, and its results aggregate.

This brief proposes two additions to Chapter 2 in the same spirit as Chapter 1's Gazprom panel: illustrations of the mechanism and of who the listed firms are, framed as illustrations and never as evidence. Both are additions the author must choose. The brief gives definitions, sources and checks so that Codex computes every number from the programming project's verified inputs. No number computed in the lab is to be copied, and no INN value appears here.

## 2. Proposal (a): one paragraph on Aeroflot's filing path

Where it would go. The introduction of Chapter 2 or the opening of its results, as one paragraph that tells the chapter's mechanism in one firm, with the figures in prose and no new exhibit.

What it says, in the chapter's own vocabulary (available, absent, financial year, statement). Aeroflot, the public joint-stock company with a mixed federal ownership code in the registry, has a statement available for every financial year from 2014 to 2021, none for 2022, and statements again from 2023. The sanctions file records one listing with a start date of 19 May 2022 and the countries United Kingdom and United States. The firm is also on the government strategic and presidential strategic lists, so its membership pattern is one the chapter's group comparisons place among the other listed patterns, not among the selected ones. The paragraph says in one sentence that this is one firm's path, chosen because it is well known, and that the chapter's estimates are what they are regardless of it.

How Codex computes the facts, from the programming inputs only.
- The filing path: `original_available` by financial year for the firm's registry rows 2014 to 2025, read from the foundation registry partitions (`registry.parquet` per year); the 2025 value carries the chapter's flag.
- The listing date and the countries: the sanctions file's `startDate` and `countries` fields for the firm's row, through the memberships pass (`programming/R/chapter2-memberships.R`), which already reads every field; the chapter's rule that the sanctions-file date is a designation record and the administrative lists are not dated applies to the wording.
- The memberships: the five `member_*` flags of `keys.parquet` for the firm.
- The identification of the firm: by its name in the sanctions file (the file's `name` and `name_alt` fields), never by a typed identifier; the brief carries none. If several rows match, Codex reports them and stops.
- What the lab found, as expected values to check against, not to copy: statements available in every year 2014 to 2021, absent in 2022, available 2023 to 2025; one sanctions row dated 19 May 2022 with the countries gb and us; memberships on the sanctions, government strategic and presidential strategic lists.

Wording constraints. The chapter's terminology registry (statement available or absent; "listed by" with the file's countries; "designation" only for the sanctions file's act); no em-dashes; the paragraph is an illustration and says so.

## 3. Proposal (b): an Appendix B table of the largest listed firms

Definition. The 25 largest firms on at least one of the five lists by 2021 real assets, where real assets are the 2021 value of `line_1600` divided by the 2021-based deflator (the programming convention; the 2021 value equals the nominal value), among firms with a 2021 statement available and a positive 2021 assets value. Ranked descending. The cut at 25 is stated in the caption; the author may prefer 20 or 30.

Columns.
- The display name under the lab's rule of 25 October 2026 (section 4), with the full filed name in a note where the display name is cut.
- The list memberships in the chapter's printed names: sanctions list, decree list, 2020 filing-exemption list (Government Decree No. 35 of 22 January 2020), government strategic list, presidential strategic list; one letter or mark per list, defined in the note.
- Statement availability for financial years 2021 to 2025 as the glossary's letters (A available, N absent, X removed), with 2025 flagged as in every other Appendix B table.
- Real assets 2021 in billions of 2021 rubles, one decimal.

What the table does not carry. No INN, no OGRN, no address, no revenue or employment, no firm on no list.

Production. Through `programming/R/chapter2-author-table-generators.R`, as the other Appendix B longtables, exported to the run's `tables/` folder and replaced in `appendices/b-chapter2-evidence.tex` byte for byte, never hand-edited. The caption is a sentence-case noun phrase without a period; the note opens "Source: RFSD v3.1.0" as the others do.

Checks Codex reports. One name per firm and the join of names to keys equal to an R match; no name carries a run of nine or more digits or equals a list identifier; no entrepreneur's personal name (the "IP" legal form) among the 25; every display name within 60 characters; the count of listed firms with a 2021 statement and positive assets, and the share of their summed assets held by the 25; the number of firms whose display name is shared by another list entry; the five memberships of each row reconciled against `keys.parquet`.

## 4. The display-name rule to port

The lab's rule, applied in the atlas since 25 October 2026 and to be ported into the programming project's R before any table is produced.
- Sources in priority order: the decree workbook's name column, the government strategic workbook's name column, the sanctions file's `name` field; the sanctions file's `name_alt` field supplies Latin aliases. The lab's INN cell rule (a trimmed string, no repair) applies to the join.
- The core name: look-alike Latin letters inside Cyrillic words folded; footnote markers, a trailing stop, a locality in parentheses and a region after a comma dropped; the leading legal-form phrase or a trailing abbreviation stripped and kept as a tag after a comma, transliterated for Russian forms (AO, PAO, OAO, ZAO, OOO, FGUP, GUP, MUP, ANO, IP, NP) and kept as filed where the source string is English (LLC, JSC, PJSC, OJSC, CJSC, Ltd, Inc, GmbH); quotes trimmed with balanced inner pairs kept; "научно-исследовательский институт" and the like abbreviated.
- The script on the page is Latin, in three cases: (1) the sanctions file's Latin alias that transliterates the filed Cyrillic core, matched after both are normalised and the core transliterated with BGN/PCGN 1947 (Russian, plain form), accepted at a similarity of 0.85 or above by one minus the Levenshtein distance over the longer length; (2) otherwise the lab's own transliteration with the same scheme, marked as transliterated; (3) a name filed in Latin as it is, title-cased. Never a former or foreign-language alias.
- A 60-character cap including the tag, cut at a word boundary with an ellipsis, with an orphan opening quote dropped after the cut; shared display names marked with the number of list entries under the name.
- The code: the functions in `R/motion/motion-common.R` of the dataviz lab (`motion_display_names`, `motion_display_one`, `motion_translit`, `motion_drop_orphan` and their helpers) and the probe `R/tests/display-name-probe.R` with its twelve cases, to be run first after the port.
- The figures the lab produced over the list union, as expected values for the port: 6,318 of 6,372 members named; cases alias 2,249, transliterated 2,694, Latin as filed 1,375; 1,930 members share a display name with another; alias similarity over the 4,367 Cyrillic cores with a Latin alias: 2,149 at 0.90 or above, 100 between 0.85 and 0.90, 71 between 0.80 and 0.85, 2,047 below 0.80.

## 5. What the brief does not propose

No names in the models, in the group comparisons or on the maps. No change to the chapter's treatment of memberships as fixed and undated. No name for any firm on no list, and the neighbour firm of the lab's Moscow sequence stays anonymous everywhere.

## 6. Constraints the author decides

- Appendix B is at its 25-page limit and the Chapter 2 body at 12 exhibits. The table needs about one page. Either the appendix gives something up, or the table replaces an existing exhibit, or the proposal waits.
- The lab's own revenue series multiplied by the deflator until 25 October 2026 where the programming project divides; the lab was corrected that day. The ranking in proposal (b) uses the programming project's division and nothing from the lab.
- Table 1.2 prints Gazprom's INN in its note, reproduced from the source paper. This brief does not extend that precedent: the two additions print no identifier.
- Whether to name the firm in proposal (a) at all. The alternative is the same paragraph with "one large airline" in place of the name, which keeps the mechanism and loses the recognition.

## 7. Effort

Codex: a day for the port of the display rule with its probe and checks, half a day for the table through the generator, an hour for the paragraph. The author: reading the 25 names and the paragraph, and the two scope decisions above.
