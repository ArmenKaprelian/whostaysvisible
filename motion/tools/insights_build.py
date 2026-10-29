#!/usr/bin/env python3
"""The profiles' insights as shipped data (round 16): data/insights.json and its twin, provenance and checks, from the second research pass
the author approved on 27 October 2026 ("I approve all your recommendations": the agents' texts as written, the alternatives not taken).

Inputs: motion/build/insights-drafts/pass2/out-A.json to out-F.json (git ignores them; the provenance records their hashes), check-allow.json
(the reviewed exceptions) and approval.json (the author's decision and the units left out). Output keys are the page's (profileUnit,
explorer-app.js): {regions: {basemap region name: {full, short, sources}}, cities: {window label: {...}}}, each source as publisher,
document type, date and link; titles, snippets, statuses and notes stay in the provenance, out of every shipped file.
Checks: every unit a region or a window of profiles.json; full at most 200 and short at most 76 characters; no semicolon, em-dash or
"listed"; no run of nine or more digits in a text; no shipped field naming a firm on no list (pass2/check.py's list); every source
with a link and a date. The provenance keeps that list and the reviewed exceptions, so tools/publish-set.py runs the same checks (text_checks) on the
shipped file from tracked files alone. Run: python3 -I motion/tools/insights_build.py"""
import csv, datetime, hashlib, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
MOTION = os.path.normpath(os.path.join(HERE, ".."))
P2 = os.path.join(MOTION, "build", "insights-drafts", "pass2")
DATA = os.path.join(MOTION, "data")

# One form per publisher and per document type (the six agents labelled the same sources differently): exact matches on the agents' labels, the
# rest as written. What a label carried besides the publisher (a mirror, an author, a citing chain, a site's address) stays in the provenance.
TREAS, OFAC, STATE, FCDO, COUNCIL, SOUES = ("US Treasury", "US Treasury, Office of Foreign Assets Control", "US Department of State",
                                            "UK Foreign, Commonwealth and Development Office", "Council of the European Union", "System Operator of the Unified Energy System of Russia")
PUB = {"US Department of the Treasury": TREAS, "U.S. Department of the Treasury, Office of Foreign Assets Control": OFAC, "US Department of the Treasury, Office of Foreign Assets Control": OFAC,
       "U.S. Department of State": STATE, "U.S. Department of State, Office of the Spokesperson": STATE, "US Department of State (Federal Register, Public Notice 12854)": STATE,
       "US Department of Commerce, Bureau of Industry and Security (Federal Register, 82 FR 60304)": "US Department of Commerce, Bureau of Industry and Security",
       "UK Foreign, Commonwealth & Development Office (GOV.UK)": FCDO, "Council of the European Union (Official Journal of the European Union, L series)": COUNCIL,
       "Official Journal of the European Union (Council of the EU)": COUNCIL, "Official Journal of the European Union": COUNCIL,
       "Business FM (BFM)": "Business FM", "Business FM (BFM.ru)": "Business FM", "Business FM (bfm.ru)": "Business FM", "Interfax (interfax.ru)": "Interfax",
       "Kommersant (Kommersant-Kuban)": "Kommersant", "Kommersant (Kommersant-Rostov)": "Kommersant", "System Operator of the Unified Energy System (SO UES)": SOUES,
       "System Operator of the Unified Energy System of Russia (so-ups.ru)": SOUES, "Republic of Ingushetia (official publication portal publication.pravo.gov.ru)": "Republic of Ingushetia",
       "Kabardino-Balkar Republic (official publication portal publication.pravo.gov.ru)": "Kabardino-Balkar Republic", "CAPA - Centre for Aviation": "CAPA \u2013 Centre for Aviation",
       "Government of the Republic of Karelia, official portal (gov.karelia.ru)": "Government of the Republic of Karelia",
       "Government of the Russian Federation (text from the ppt.ru legal database)": "Government of the Russian Federation", "Moscow City Government (mos.ru)": "Moscow City Government",
       "President of Russia (kremlin.ru)": "President of Russia", "Nuclear Engineering International (NEI Magazine)": "Nuclear Engineering International", "Power Technology (GlobalData)": "Power Technology",
       "Norwegian Ministry of Foreign Affairs (regjeringen.no), read in the Internet Archive copy of 25 May 2026": "Norwegian Ministry of Foreign Affairs",
       "Reuters (Russian service, via The Moscow Times)": "Reuters", "Reuters (syndicated copy, Pipeline & Gas Journal)": "Reuters", "Reuters (via The Star)": "Reuters",
       "Al Jazeera (Reuters report)": "Al Jazeera", "Euronews (Reuters)": "Euronews", "Voice of America (AFP report)": "Voice of America", "Bloomberg News (reproduced by MINING.COM)": "Bloomberg News",
       "Rambler (AirCargoNews.ru report citing Rostec)": "Rambler", "Finance Mail.ru (source: Market Power), citing a RIA Novosti interview with presidential adviser Anton Kobyakov": "Finance Mail.ru",
       "Gazeta.ru (republished by Finance Mail.ru), citing RIA Novosti and the Ministry of Economic Development": "Gazeta.ru", "PRIME (RIA Novosti), citing the Ministry of Economic Development": "PRIME",
       "Ukrainska Pravda, quoting the Gas Transmission System Operator of Ukraine": "Ukrainska Pravda", "LRT (Lithuanian National Radio and Television), BNS report": "LRT",
       "SkyTruth (with Global Fishing Watch data)": "SkyTruth", "Ministry of the Russian Federation for the Development of the Far East and Arctic, Investment Portal of the Arctic Zone of Russia": "Ministry for the Development of the Russian Far East and Arctic",
       "State Secretariat for Economic Affairs (SECO), Switzerland": "Swiss State Secretariat for Economic Affairs", "Bruegel (Ugn\u0117 Keliauskait\u0117, Georg Zachmann)": "Bruegel", "Direction g\u00e9n\u00e9rale du Tr\u00e9sor (France)": "Direction g\u00e9n\u00e9rale du Tr\u00e9sor",
       "Cambridge University Press (Richard Connolly)": "Cambridge University Press", "National Bureau of Economic Research (Fern\u00e1ndez-Villaverde, Li, Xu and Zanetti)": "National Bureau of Economic Research",
       "Oxford Institute for Energy Studies (Vitaly Yermakov)": "Oxford Institute for Energy Studies",
       "The Moscow Times, Russian service (Reuters report)": "Reuters", "GMK Center (citing Interfax)": "GMK Center"}
RA, NEWS, ENTRY, IMPL = "recent actions notice", "news report", "sanctions list entry", "implementing regulation"
TYPE = {"recent actions (SDN list update)": RA, "recent-actions notice": RA, "recent actions notice (entities added to the SDN List)": RA, "recent actions notice (SDN list additions)": RA,
        "recent actions notice (SDN additions and SSI changes)": RA, "recent actions (Sectoral Sanctions Identifications List)": RA, "news article": NEWS, "news item": NEWS,
        "news article (Kommersant FM, citing Izvestia, the Ministry of Economic Development and KRDV)": NEWS, "news release": "press release", "press release (IP/22/1484)": "press release",
        "press release (AMF regulated-information copy)": "press release", "UK Sanctions List (entry RUS0255)": ENTRY, "UK Sanctions List (entry RUS2139)": ENTRY, "national asset-freeze register entry": ENTRY,
        "consolidated sanctions list (XML, version 2026-10-20)": ENTRY, "Specially Designated Nationals list (sdn.csv)": ENTRY, "implementing regulation, Annex I entry 382": IMPL,
        "implementing regulation, annex entry 1410": IMPL, "implementing regulation, annex entry 488": IMPL, "implementing regulation (Official Journal L series)": IMPL,
        "Council Implementing Regulation (EU) 2024/196": IMPL, "fact sheet, Office of the Spokesperson (archived)": "fact sheet", "fact sheet (archived)": "fact sheet", "analysis (PDF)": "analysis",
        "analysis (blog post)": "analysis", "energy comment": "analysis", "working paper (No. 33486)": "working paper", "Minerals Yearbook 2019, The Mineral Industry of Russia (advance release)": "yearbook",
        "shareholder structure page (undated, read 2026-10-27)": "web page", "power plant profile": "web page", "notice on a decision (Southern Main Branch)": "notice",
        "register of notices on issuers (Southern Main Branch, filtered list)": "register of notices", "final rule (Entity List additions)": "final rule", "notice of sanctions actions": "Federal Register notice",
        "trade magazine column (Rob Bates, Cutting Remarks)": "trade column", "trade column (John Jeffay, Memo)": "trade column", "interview with Alrosa's chief executive (newspaper No. 85, p. 1)": "interview"}
UNTYPED = {"publication.pravo.gov.ru/document/0600202607020002": "budget execution law", "publication.pravo.gov.ru/file/pdf?eoNumber=0600202607020002": "budget execution law",
           "publication.pravo.gov.ru/document/0700202601030002": "budget law", "centreforaviation.com/news/krasnodar-pashkovsky-airport-reopens-1331637": NEWS, "www.kommersant.ru/doc/8041867": NEWS}   # five sources the agents left untyped, typed from their titles

def label(s):
    pub, ty = PUB.get(s.get("publisher"), s.get("publisher")), TYPE.get(s.get("type"), s.get("type"))
    if not ty: ty = UNTYPED.get(re.sub(r"^https?://", "", s.get("url") or ""), ty)
    return pub, ty

def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""): h.update(chunk)
    return h.hexdigest()

def text_checks(obj, regions_ok, windows_ok, off_list, allow):   # [(check, passed, detail)] for a built insights object; also run by publish-set.py
    checks = []
    def check(name, ok, detail=""): checks.append({"check": name, "pass": bool(ok), "detail": detail})
    allu = [(u, "region", v) for u, v in obj["regions"].items()] + [(u, "window", v) for u, v in obj["cities"].items()]
    check("every region is a region of profiles.json", all(u in regions_ok for u in obj["regions"]), ", ".join(u for u in obj["regions"] if u not in regions_ok))
    check("every window is a window of profiles.json", all(u in windows_ok for u in obj["cities"]), ", ".join(u for u in obj["cities"] if u not in windows_ok))
    bad = [u for u, k, v in allu if len(v["full"]) > 200 or len(v["short"]) > 76]; check("full at most 200 and short at most 76 characters", not bad, ", ".join(bad))
    bad = [u for u, k, v in allu if any(c in v["full"] + v["short"] for c in (";", "\u2014")) or re.search(r"\blisted\b", v["full"] + v["short"], re.I)]; check("no semicolon, em-dash or 'listed'", not bad, ", ".join(bad))
    bad = [u for u, k, v in allu if re.search(r"\d{9,}", v["full"] + v["short"])]; check("no run of nine or more digits in a text", not bad, ", ".join(bad))
    allowed = lambda u, f: any(a["unit"] == u and a["finding"] in f for a in allow)
    bad = []
    for u, k, v in allu:
        fields = [v["full"], v["short"]] + [x for s in v["sources"] for x in (s["publisher"] or "", s["type"] or "", s["url"] or "")]
        for f in off_list:   # as pass2/check.py: the plain text, and the fields with their separators dropped (a link's path)
            if any(f in x.lower() or f.replace(" ", "") in re.sub(r"[-_ /.]", "", x.lower()) for x in fields) and not allowed(u, f): bad.append("%s: %s" % (u, f))
    check("no shipped field names a firm on no list", not bad, "; ".join(bad))
    bad = [u for u, k, v in allu if not v["sources"] or any(not s["url"] or not s["date"] or not s["publisher"] or not s["type"] for s in v["sources"])]; check("every unit sourced, every source with a publisher, a type, a date and a link", not bad, ", ".join(bad))
    bad = sorted({x for u, k, v in allu for s in v["sources"] for x in (s["publisher"], s["type"]) if re.search(r"\(|\bvia\b|citing|quoting|reproduced|republished", x or "")})
    check("no label carries a mirror, an author or a citing chain", not bad, "; ".join(bad))
    return checks

def js_of(obj): return 'window.MOTION_DATA = window.MOTION_DATA || {};\nwindow.MOTION_DATA["insights"] = ' + json.dumps(obj, ensure_ascii=False) + ";\n"

def main():
    if "-h" in sys.argv or "--help" in sys.argv: print(__doc__); return   # round 19: help only
    sys.path.insert(0, P2)
    from check import OFF_LIST   # the one list of firms on no list met in the research (pass2/check.py), copied into the provenance
    approval = json.load(open(os.path.join(P2, "approval.json"), encoding="utf-8"))
    leave = approval.get("excluded", {})
    prof = json.load(open(os.path.join(DATA, "profiles.json"), encoding="utf-8"))
    regions_ok = set(prof["regions"]["region"]) if isinstance(prof["regions"], dict) else {r["region"] for r in prof["regions"]}
    windows_ok = set(prof["windows"]["label"]) if isinstance(prof["windows"], dict) else {w["label"] for w in prof["windows"]}
    out = {"regions": {}, "cities": {}}; prov_units = []; n_src = 0
    for X in "ABCDEF":
        path = os.path.join(P2, "out-%s.json" % X)
        for o in json.load(open(path, encoding="utf-8")):
            u, kind = o["unit"], o["kind"]
            if u in leave: prov_units.append({"unit": u, "kind": kind, "agent": X, "left_out": leave[u]}); continue
            alt = u in approval.get("alternatives_taken", {})   # the author's pick of the alternative shown beside the text (27 October 2026)
            if alt and not o.get("alternative"): raise SystemExit("insights_build: %s has no alternative to take" % u)
            body = o["alternative"] if alt else o
            srcs, seen = [], set()
            for s in body.get("sources") or []:   # a page cited twice for two snippets ships once, and so does a document under two links (a page and its PDF)
                pub, ty = label(s); k1, k2 = s.get("url"), (pub, ty, s.get("date"))
                if k1 in seen or k2 in seen: continue
                seen.update((k1, k2)); srcs.append({"publisher": pub, "type": ty, "date": s.get("date"), "url": s.get("url")})
            fe = approval.get("fit_edits", {}).get(u, {})   # an approved text changed to fit its box (approval.json says why)
            if fe and fe.get("was") != body["short"] and fe.get("was") != body["full"]: raise SystemExit("insights_build: the fit edit for %s no longer matches its text" % u)
            ed = approval.get("edits", {}).get(u, {})   # a rewording the author approved, applied only over the exact text it replaces
            if ed and (ed["was_full"] != body["full"] or ed["was_short"] != body["short"]): raise SystemExit("insights_build: the edit for %s no longer matches its text" % u)
            rec = {"full": ed.get("full", fe.get("full", body["full"])), "short": ed.get("short", fe.get("short", body["short"])), "sources": srcs}
            (out["regions"] if kind == "region" else out["cities"])[u] = rec; n_src += len(srcs)
            prov_units.append({"unit": u, "kind": kind, "agent": X, "text": "alternative" if alt else "edited" if ed else "draft", "status": o.get("status"), "classification": o.get("classification"), "changes": o.get("changes"),
                               "named_firms": o.get("named_firms"), "sources_lab": [{"publisher": s.get("publisher"), "type": s.get("type"), "title": s.get("title_lab"), "snippet": s.get("snippet_lab"), "bib": s.get("bib"), "url": s.get("url")} for s in body.get("sources") or []]})
    allow = json.load(open(os.path.join(P2, "check-allow.json"), encoding="utf-8"))
    checks = text_checks(out, regions_ok, windows_ok, OFF_LIST, allow)
    obj = dict(out, approved="27 October 2026", notes=["One researched, sourced sentence for each region and city window, in a full form for the card and a short form for the tile.",
                                                        "Each source is cited by publisher, document type and date, with its link."], author="by Armen G. Kaprelian")
    failed = [c for c in checks if not c["pass"]]
    if "--write" not in sys.argv:   # round 19 (the author's decision of 28 October 2026): without --write the checks run and nothing is written
        print("insights: %d of %d checks passed%s; nothing written, --write builds" % (len(checks) - len(failed), len(checks), (", failed: " + "; ".join(c["check"] for c in failed))[:300] if failed else ""))
        raise SystemExit(1 if failed else 0)
    with open(os.path.join(DATA, "insights.checks.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, quoting=csv.QUOTE_NONNUMERIC, lineterminator="\n"); w.writerow(["check", "pass", "detail"])
        for c in checks: w.writerow([c["check"], "TRUE" if c["pass"] else "FALSE", c["detail"]])
    if failed: raise SystemExit("insights_build: %d check(s) failed: %s" % (len(failed), "; ".join("%s (%s)" % (c["check"], c["detail"][:120]) for c in failed)))
    jp, jsp = os.path.join(DATA, "insights.json"), os.path.join(DATA, "insights.js")
    with open(jp, "w", encoding="utf-8") as f: json.dump(obj, f, ensure_ascii=False, indent=1)
    with open(jsp, "w", encoding="utf-8") as f: f.write(js_of(obj))
    inputs = [os.path.join(P2, n) for n in ["out-%s.json" % X for X in "ABCDEF"] + ["check-allow.json", "approval.json", "BRIEF-2.md"]]
    prov = {"id": "insights", "tool": "motion/tools/insights_build.py", "run_utc": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "approval": approval, "off_list": OFF_LIST, "allow": allow, "inputs": [{"path": os.path.relpath(p, MOTION), "sha256": sha256(p)} for p in inputs],
            "reports": ["build/insights-drafts/pass2/report-%s.md" % X for X in "ABCDEF"], "review_page": "review/2026-10-27-round-16-insights.html",
            "checks": "%d of %d passed (insights.checks.csv)" % (len(checks), len(checks)), "units": prov_units,
            "output": {"json": "data/insights.json", "json_sha256": sha256(jp), "js": "data/insights.js", "js_sha256": sha256(jsp)}}
    with open(os.path.join(DATA, "insights.provenance.json"), "w", encoding="utf-8") as f: json.dump(prov, f, ensure_ascii=False, indent=1)
    print("insights: %d regions, %d windows, %d sources; %d left out; %d of %d checks passed" % (len(out["regions"]), len(out["cities"]), n_src, len(leave), len(checks), len(checks)))

if __name__ == "__main__":
    main()
