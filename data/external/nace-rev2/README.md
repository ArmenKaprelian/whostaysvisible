# NACE Rev. 2 codelist (Eurostat), downloaded 2026-10-25T07:28:31Z

Two files fetched with curl from Eurostat's dissemination API (the SDMX 2.1 codelist `NACE_R2` of agency ESTAT), untrusted
data: read with `python3 -I` or `utils::read.delim(..., quote = "", encoding = "UTF-8")`, never executed.

- `NACE_R2-ESTAT-20.1.tsv`: `https://ec.europa.eu/eurostat/api/dissemination/sdmx/2.1/codelist/ESTAT/NACE_R2?format=TSV`,
  78,151 bytes, sha256 5553f59fbc4090e65bf65a7d2557c34e0d17d89cccbbacd27440b06c8958eff7. Two tab-separated columns without a
  header: the code and the English title; 1,342 rows (aggregates, sections, divisions, groups and classes). The 88 divisions
  carry the section letter before the two digits ("C10", "G46"); codelist version 20.1; NACE Rev. 2 (2008), not Rev. 2.1
  (division 95 reads "Repair of computers and personal and household goods").
- `NACE_R2-ESTAT-20.1.sdmx.xml`: the same codelist without the format parameter (SDMX-ML), 1,228,412 bytes, sha256
  b3da1c9149f97670cd4231ca5c0fc4583952a0d0f068d18a23e04163e2a90871, kept as the evidence of the version (20.1) and the
  update date (2026-09-17) in its annotations; its header carries a per-request id and timestamp, so the hash identifies this
  copy only.

Reuse: Eurostat classifications are reusable under the Commission's reuse decision (2011/833/EU); cite as "Eurostat, NACE
Rev. 2 codelist NACE_R2 version 20.1". Pinned in `config/sources.json` as `motion.nace-rev2-codelist` and `motion.nace-rev2-sdmx`
(scripts/pin-sources.py). Used by `R/motion/industry-common.R` for the English names of the 88 two-digit divisions, which
OKVED 2 (OK 029-2014) mirrors; the equivalence record is written into `motion/data/industry.json`.
