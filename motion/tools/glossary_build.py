#!/usr/bin/env python3
"""The REFERENCES panel's DEFINITIONS (round 16, the author's pick of 27 October 2026: rdB revised, a short glossary of the atlas's top terms and
subsamples): data/glossary.json and its twin, provenance and checks.

Each definition takes the chapter's wording where the term is shared with it (the read-only dissertation, chapters/02-opacity, as config/sources.json
pins it), else the atlas's own verified texts (js/explorer-app.js). The provenance records, for every definition, the source files, the lines and
the quoted sentences, with each file's SHA-256; nothing of that reaches the screen. Checks: every quoted sentence is in its file as quoted; every
definition is one or two sentences of at most 260 characters, with no semicolon, dash or "listed"; the terms are unique.
Run: python3 -I motion/tools/glossary_build.py"""
import csv, datetime, hashlib, json, os, re

HERE = os.path.dirname(os.path.abspath(__file__)); MOTION = os.path.normpath(os.path.join(HERE, "..")); DATA = os.path.join(MOTION, "data")
LATEX = "/home/armen/Documents/PhD/CGU/Dissertation/00 Full Dissertation/LaTeX/kaprelian_dissertation"
CH = lambda f: os.path.join(LATEX, "chapters", "02-opacity", f)
APP = os.path.join(MOTION, "js", "explorer-app.js")

TERMS = [   # term, definition (on screen), sources [(file, quoted sentence)]
    ("Eligible firms", "Every firm-year record the RFSD marks eligible, with or without a financial statement. Eligibility is the provider’s operational classification, not a verified legal duty to file.",
     [(CH("02-data-and-samples.tex"), "The population analysis retains every record with \\texttt{eligible=1}, including firms without financial statements."),
      (CH("02-data-and-samples.tex"), "Eligibility is the provider's operational classification, not an independently verified legal filing duty for every firm-year.")]),
    ("Registered at year-end", "Eligible firms that are also registered at the end of the financial year, the second population in the national chart.",
     [(CH("02-data-and-samples.tex"), "Annual registered population & Eligible and registered at each year-end."),
      (CH("05-results.tex"), "while the share among eligible firms registered at year-end changes from 71.7\\% to 71.2\\%")]),
    ("Statement availability", "A statement is available when the release holds the firm’s own filing for that year, filed and not imputed. A share with a statement is the fraction of eligible firms in a group and year that have one.",
     [(CH("02-data-and-samples.tex"), "A statement is available when the release holds the firm's own filing for that year, marked \\texttt{filed=1} and \\texttt{imputed=0}."),
      (CH("02-data-and-samples.tex"), "An availability share is the fraction of eligible records in a group and year with")]),
    ("Located firms", "Eligible firms whose registered address has map coordinates. Unlocated firms stay in the counts but are not drawn.",
     [(CH("05-results.tex"), "In 2021 there are 3,277,638 located eligible firms at 727,190 distinct coordinate pairs"),
      (CH("05-results.tex"), "The 79,471 unlocated firms remain in population accounting.")]),
    ("Coordinate pairs", "The distinct coordinates of geocoded registered addresses. Several firms can share one, since a registered address can be a business centre or an address rented for registration and correspondence.",
     [(CH("05-results.tex"), "located eligible firms at 727,190 distinct coordinate pairs"),
      (CH("05-results.tex"), "Registered legal addresses can be shared business centres or addresses rented for registration and correspondence, rather than production premises.")]),
    ("House-, street-level and other geocodes", "A house- or street-level geocode matches a registered address to a building or a street. Other geocodes are coordinates without a verified house or street match, so the atlas counts those firms but does not draw them.",
     [(APP, "with a house- or street-level geocode"),
      (APP, "Other geocodes, coordinates without a verified house or street match, are counted and not drawn.")]),
    ("Firms on the five lists (treated)", "Firms on at least one of the five lists: the sanctions list, the decree list, the 2020 filing-exemption list, the government strategic list and the presidential strategic list. Treated names the study’s group, not an effect.",
     [(CH("02-data-and-samples.tex"), "The five lists are the sanctions list, decree list, 2020 filing-exemption list, government strategic list, and presidential strategic list."),
      (APP, "Treated: a firm on at least one of the five lists"), (APP, "The word names the study’s group, not an effect.")]),
    ("Firms on no list (comparison group)", "Eligible firms on none of the five lists. Firms whose list membership is unknown are kept apart from this group.",
     [(APP, "Comparison group: firms on none of the five lists."),
      (CH("02-data-and-samples.tex"), "Unknown membership remains separate from the comparison group.")]),
    ("The 50-firm support rule", "A share is shown only where 50 or more firms make up its denominator. Cells, squares and regions with fewer are grey.",
     [(APP, "Shares are shown only for cells with 50 or more firms."), (APP, "Disclosure: a share needs 50 firms")]),
    ("Revenue cohort", "Firms eligible in 2021 with usable 2021 statements for revenue, cash relative to assets and the controls (the revenue cohort by cash share). Later survival, filing and list membership do not change who belongs.",
     [(CH("07-financial-sample-implications.tex"), "Cohort entry requires usable 2021 statements with the outcome, baseline resource, and controls."),
      (CH("07-financial-sample-implications.tex"), "Membership requires usable baseline accounts, outcomes, resources, and controls, without conditions on later survival, eligibility, statement availability, or list membership."),
      (CH("07-financial-sample-implications.tex"), "the revenue cohort by cash share contains 1,503,198")]),
    ("State-related firms", "Firms whose registry ownership code is state or municipal ownership, mixed ownership with state participation, or state-corporation ownership. The codes do not establish operational control or disclosure protection.",
     [(CH("02-data-and-samples.tex"), "State-related ownership groups the registry's codes for state or municipal ownership, mixed ownership with state participation, and state-corporation ownership."),
      (CH("02-data-and-samples.tex"), "These codes do not establish operational control or disclosure protection.")]),
    ("Unitary enterprises", "Firms with the unitary-enterprise legal form, which the chapter describes as state entities. They largely overlap with the state-related firms.",
     [(CH("05-results.tex"), "Unitary enterprises are state entities, so this is the ownership finding seen through a second classification of largely the same firms rather than an independent confirmation.")]),
]

def sha256(path):
    with open(path, "rb") as f: return hashlib.sha256(f.read()).hexdigest()
def sentences(t): return len(re.findall(r"[.!?](?=\s|$)", t))
def js_of(obj): return 'window.MOTION_DATA = window.MOTION_DATA || {};\nwindow.MOTION_DATA["glossary"] = ' + json.dumps(obj, ensure_ascii=False) + ";\n"

def main():
    checks, prov = [], []
    def check(name, ok, detail=""): checks.append({"check": name, "pass": bool(ok), "detail": detail})
    texts = {}
    for term, text, srcs in TERMS:
        found = []
        for path, quote in srcs:
            body = open(path, encoding="utf-8").read(); i = body.find(quote)
            found.append({"file": os.path.relpath(path, os.path.dirname(LATEX)) if path.startswith(LATEX) else os.path.relpath(path, os.path.dirname(MOTION)),
                          "line": body.count("\n", 0, i) + 1 if i >= 0 else None, "quote": quote, "found": i >= 0})
        prov.append({"term": term, "sources": found}); texts[term] = text
        missing = [f["file"] + ": " + f["quote"][:60] for f in found if not f["found"]]
        check("%s: every quoted source sentence is in its file" % term, not missing, "; ".join(missing))
        bad = [w for w in (";", "—", "–") if w in text] + (["listed"] if re.search(r"\blisted\b", text, re.I) else [])
        check("%s: one or two sentences, at most 260 characters, no semicolon, dash or 'listed'" % term, 1 <= sentences(text) <= 2 and len(text) <= 260 and not bad,
              "%d sentences, %d characters %s" % (sentences(text), len(text), bad))
    check("the terms are unique", len(texts) == len(TERMS))
    with open(os.path.join(DATA, "glossary.checks.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, quoting=csv.QUOTE_NONNUMERIC, lineterminator="\n"); w.writerow(["check", "pass", "detail"])
        for c in checks: w.writerow([c["check"], "TRUE" if c["pass"] else "FALSE", c["detail"]])
    failed = [c for c in checks if not c["pass"]]
    if failed: raise SystemExit("glossary_build: %d check(s) failed: %s" % (len(failed), "; ".join("%s (%s)" % (c["check"], c["detail"][:120]) for c in failed)))
    obj = {"terms": [{"term": t, "text": x} for t, x, _ in TERMS], "notes": ["Definitions in the chapter’s wording where the term is shared with it, else the atlas’s own; the provenance names each source."],
           "author": "by Armen G. Kaprelian"}
    jp, jsp = os.path.join(DATA, "glossary.json"), os.path.join(DATA, "glossary.js")
    with open(jp, "w", encoding="utf-8") as f: json.dump(obj, f, ensure_ascii=False, indent=1)
    with open(jsp, "w", encoding="utf-8") as f: f.write(js_of(obj))
    files = sorted({s for _, _, srcs in TERMS for s, _ in srcs})
    out = {"id": "glossary", "tool": "motion/tools/glossary_build.py", "run_utc": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
           "decision": "the author's pick of 27 October 2026 for the REFERENCES panel: rdB revised, the AUTHOR section removed, DEFINITIONS as a short glossary, wording from the dissertation where shared, sources in the provenance only",
           "files": [{"path": os.path.relpath(p, os.path.dirname(LATEX)) if p.startswith(LATEX) else os.path.relpath(p, os.path.dirname(MOTION)), "sha256": sha256(p)} for p in files],
           "terms": prov, "checks": "%d of %d passed (glossary.checks.csv)" % (len(checks), len(checks)),
           "output": {"json": "data/glossary.json", "json_sha256": sha256(jp), "js": "data/glossary.js", "js_sha256": sha256(jsp)}}
    with open(os.path.join(DATA, "glossary.provenance.json"), "w", encoding="utf-8") as f: json.dump(out, f, ensure_ascii=False, indent=1)
    print("glossary: %d terms; %d of %d checks passed" % (len(TERMS), len(checks), len(checks)))

if __name__ == "__main__":
    main()
