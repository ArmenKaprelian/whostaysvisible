#!/usr/bin/env python3
"""The REFERENCES panel's DEFINITIONS (round 16, the author's pick of 27 October 2026: rdB revised, a short glossary of the atlas's top terms and
subsamples): data/glossary.json and its twin, provenance and checks.

Each definition takes the chapter's wording where the term is shared with it (the read-only dissertation, chapters/02-opacity, as config/sources.json
pins it), else the atlas's own verified texts (js/explorer-app.js). The provenance records, for every definition, the source files, the lines and
the quoted sentences, with each file's SHA-256; nothing of that reaches the screen. Checks: every quoted sentence is in its file as quoted; every
definition is one or two sentences of at most 260 characters, with no semicolon, dash or "listed"; the terms are unique.
Run: python3 -I motion/tools/glossary_build.py
Check: python3 -I motion/tools/glossary_build.py --check (round 18) rebuilds the glossary in memory, writes nothing, and reports where data/glossary.json
or its twin differs from the rebuild, a quoted sentence is no longer in its file, or a definition breaks a rule; a provenance recorded before a quoted
file last changed is noted, not counted (re-run the builder). tools/audit_five.py and atlas-audit.py run check() once per audit."""
import csv, datetime, hashlib, io, json, os, re

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
    ("The 50-firm support rule", "In the Cells view a share is shown only where 50 or more firms make up its denominator, and cells, squares and regions with fewer are grey. The Firms view shows each coordinate pair’s own share.",
     [(APP, "Shares are shown only for cells with 50 or more firms."), (APP, "Disclosure: in the Cells view a share needs 50 firms")]),
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

def relp(path):   # a source path as the provenance records it, the same from the lab or a trial copy of motion/ (round 18)
    return os.path.relpath(path, os.path.dirname(LATEX)) if path.startswith(LATEX) else "motion/" + os.path.relpath(path, MOTION).replace(os.sep, "/")
def sha256(path):
    with open(path, "rb") as f: return hashlib.sha256(f.read()).hexdigest()
def sentences(t): return len(re.findall(r"[.!?](?=\s|$)", t))
def write_new(path, text):   # round 18: a new file renamed over the old, so in a copy of motion/ whose data/ holds links to the lab's files the link is replaced, never the lab's file
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8", newline="") as f: f.write(text)
    os.replace(tmp, path)
def js_of(obj): return 'window.MOTION_DATA = window.MOTION_DATA || {};\nwindow.MOTION_DATA["glossary"] = ' + json.dumps(obj, ensure_ascii=False) + ";\n"

def build():   # the rebuild in memory: the checks, the provenance's terms, the object and its twin (round 18: shared by the builder and check())
    checks, prov = [], []
    def check(name, ok, detail=""): checks.append({"check": name, "pass": bool(ok), "detail": detail})
    texts = {}
    for term, text, srcs in TERMS:
        found = []
        for path, quote in srcs:
            body = open(path, encoding="utf-8").read(); i = body.find(quote)
            found.append({"file": relp(path),
                          "line": body.count("\n", 0, i) + 1 if i >= 0 else None, "quote": quote, "found": i >= 0})
        prov.append({"term": term, "sources": found}); texts[term] = text
        missing = [f["file"] + ": " + f["quote"][:60] for f in found if not f["found"]]
        check("%s: every quoted source sentence is in its file" % term, not missing, "; ".join(missing))
        bad = [w for w in (";", "—", "–") if w in text] + (["listed"] if re.search(r"\blisted\b", text, re.I) else [])
        check("%s: one or two sentences, at most 260 characters, no semicolon, dash or 'listed'" % term, 1 <= sentences(text) <= 2 and len(text) <= 260 and not bad,
              "%d sentences, %d characters %s" % (sentences(text), len(text), bad))
    check("the terms are unique", len(texts) == len(TERMS))
    obj = {"terms": [{"term": t, "text": x} for t, x, _ in TERMS], "notes": ["Definitions in the chapter’s wording where the term is shared with it, else the atlas’s own; the provenance names each source."],
           "author": "by Armen G. Kaprelian"}
    return checks, prov, obj

def check():   # round 18: the rebuild against the shipped files, nothing written; findings as one line each, notes prefixed "note:" are not findings
    try: checks, prov, obj = build()
    except OSError as e: return ["a quoted file cannot be read (%s): the check could not run" % e]
    out = []
    for c in checks:
        if not c["pass"]: out.append("check failed: %s (%s)" % (c["check"], c["detail"][:120]))
    jp, jsp = os.path.join(DATA, "glossary.json"), os.path.join(DATA, "glossary.js")
    want = json.dumps(obj, ensure_ascii=False, indent=1)
    try: have = open(jp, encoding="utf-8").read()
    except OSError: have = None
    if have != want: out.append("data/glossary.json differs from the rebuild: re-run motion/tools/glossary_build.py")
    try: twin = open(jsp, encoding="utf-8").read()
    except OSError: twin = None
    if have is not None and twin != js_of(json.loads(have)): out.append("data/glossary.js is not the twin of data/glossary.json")
    try:
        pv = json.load(open(os.path.join(DATA, "glossary.provenance.json"), encoding="utf-8")); rec = {f["path"]: f["sha256"] for f in pv.get("files", [])}
        files = sorted({s for _, _, srcs in TERMS for s, _ in srcs})
        stale = [relp(p) for p in files if rec.get(relp(p)) != sha256(p)]
        if stale: out.append("note: the provenance predates the current %s; re-run motion/tools/glossary_build.py to record the lines as they are" % ", ".join(stale))
    except (OSError, ValueError): out.append("data/glossary.provenance.json is missing or unreadable")
    return out

def main():
    import sys
    if "--check" in sys.argv:
        out = check(); bad = [f for f in out if not f.startswith("note:")]
        for f in out: print("glossary:", f)
        print("glossary check: %d finding(s), %d note(s)" % (len(bad), len(out) - len(bad))); raise SystemExit(1 if bad else 0)
    checks, prov, obj = build()
    buf = io.StringIO(); w = csv.writer(buf, quoting=csv.QUOTE_NONNUMERIC, lineterminator="\n"); w.writerow(["check", "pass", "detail"])
    for c in checks: w.writerow([c["check"], "TRUE" if c["pass"] else "FALSE", c["detail"]])
    write_new(os.path.join(DATA, "glossary.checks.csv"), buf.getvalue())
    failed = [c for c in checks if not c["pass"]]
    if failed: raise SystemExit("glossary_build: %d check(s) failed: %s" % (len(failed), "; ".join("%s (%s)" % (c["check"], c["detail"][:120]) for c in failed)))
    jp, jsp = os.path.join(DATA, "glossary.json"), os.path.join(DATA, "glossary.js")
    write_new(jp, json.dumps(obj, ensure_ascii=False, indent=1)); write_new(jsp, js_of(obj))
    files = sorted({s for _, _, srcs in TERMS for s, _ in srcs})
    out = {"id": "glossary", "tool": "motion/tools/glossary_build.py", "run_utc": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
           "decision": "the author's pick of 27 October 2026 for the REFERENCES panel: rdB revised, the AUTHOR section removed, DEFINITIONS as a short glossary, wording from the dissertation where shared, sources in the provenance only",
           "files": [{"path": relp(p), "sha256": sha256(p)} for p in files],
           "terms": prov, "checks": "%d of %d passed (glossary.checks.csv)" % (len(checks), len(checks)),
           "output": {"json": "data/glossary.json", "json_sha256": sha256(jp), "js": "data/glossary.js", "js_sha256": sha256(jsp)}}
    write_new(os.path.join(DATA, "glossary.provenance.json"), json.dumps(out, ensure_ascii=False, indent=1))
    print("glossary: %d terms; %d of %d checks passed" % (len(TERMS), len(checks), len(checks)))

if __name__ == "__main__":
    main()
