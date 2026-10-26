#!/usr/bin/env python3
"""The review export of the listed firms' names (round 14; recommended by review/2026-10-25-listed-names-memo.md).

Writes one row per named listed firm of data/treatednational.json (every listed firm with a located address) to a CSV under
motion/review, so that the display rule can be read in bulk, sorted and corrected by eye before the atlas's search by name ships.
Columns: the display name, the filed name, the script case (alias: the sanctions file's Latin alias of the filed Cyrillic core;
transliterated: the lab's BGN/PCGN transliteration; Latin as filed), the listing year (or undated), the list memberships, the
region of the firm's latest address, the number of list entries sharing the display name, and whether the same display and filed
name pair also ships in the Moscow file (data/treated.json). No identifier and no coordinate is written: the shipped files carry
none of the first, and the second stays in the files. The script refuses to write if a name carries a run of nine or more digits
(the publish set's rule for INN and OGRN).

Usage: names-review.py [--out motion/review/2026-10-25-listed-names-review.csv]"""
import argparse, csv, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__)); MOTION = os.path.normpath(os.path.join(HERE, ".."))
CASES = {0: "unnamed", 1: "alias", 2: "transliterated", 3: "Latin as filed"}
LISTS = {"s": "sanctions", "d": "decree", "r": "resident", "g": "government strategic", "p": "presidential strategic"}

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--out", default=os.path.join(MOTION, "review", "2026-10-25-listed-names-review.csv")); a = ap.parse_args()
    N = json.load(open(os.path.join(MOTION, "data", "treatednational.json"), encoding="utf-8"))
    M = json.load(open(os.path.join(MOTION, "data", "treated.json"), encoding="utf-8"))
    moscow = {(M["name"][i], M["name_filed"][i]) for i in range(M["n"]) if M["name"][i]}
    rows, unnamed, bad = [], 0, []
    for i in range(N["n"]):
        nm, fl = N["name"][i], N["name_filed"][i]
        if not nm: unnamed += 1; continue
        if re.search(r"\d{9,}", nm) or re.search(r"\d{9,}", fl or ""): bad.append(nm)
        rows.append({"display_name": nm, "filed_name": fl, "script_case": CASES.get(N["name_case"][i], str(N["name_case"][i])),
                     "listing_year": "undated" if N["undated"][i] else str(N["red_from"][i]), "lists": ", ".join(LISTS[c] for c in N["lists"][i] if c in LISTS),
                     "region": N["regions"][N["reg"][i]] if N["reg"][i] is not None and 0 <= N["reg"][i] < len(N["regions"]) else "",
                     "entries_sharing_name": N["name_shared"][i], "also_in_moscow_file": "yes" if (nm, fl) in moscow else "no"})
    if bad: sys.exit("names-review: refused, %d name(s) carry a run of nine or more digits: %s" % (len(bad), bad[:5]))
    rows.sort(key=lambda r: (r["display_name"].casefold(), r["filed_name"].casefold(), r["listing_year"]))
    pairs = {(r["display_name"], r["filed_name"]) for r in rows}
    missing = len(moscow - pairs)
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    with open(a.out, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()), lineterminator="\n"); w.writeheader(); w.writerows(rows)
    by_case = {}
    for r in rows: by_case[r["script_case"]] = by_case.get(r["script_case"], 0) + 1
    print("%s: %d named listed firms (%d unnamed left out), by case %s; %d rows also in the Moscow file; Moscow name pairs not found nationally: %d"
          % (os.path.relpath(a.out, MOTION), len(rows), unnamed, json.dumps(by_case), sum(1 for r in rows if r["also_in_moscow_file"] == "yes"), missing))

if __name__ == "__main__":
    main()
