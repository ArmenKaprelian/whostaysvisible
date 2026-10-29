#!/usr/bin/env python3
"""Assemble the publish set of the two pages under motion/publish/.

The claude.ai artifact wraps a page in its own document skeleton, so the page copies drop the
doctype, html, head and body tags, keep the <title>, inline css/theme.css, add the Google Fonts
fallback (IBM Plex Mono (Google Fonts, the same build as the installed family) is metric-compatible with the Liberation/Arial family the pages use locally) and the
viewport-fit meta the page contract asks for. Beside them: the six shared scripts, every data file
(the aggregates and, since the author's rule change of 23 October 2026, the firm-level files: the
Moscow and national manifests, the listed firms, the anchors, the Moscow cells and comparison groups,
the registered-address files as base64 script twins), the Moscow rasters the journey loads and the national rasters.

Three rules are checked here: no shipped data file carries an identifier key (inn, ogrn); firm names
(name, name_filed, name_case, name_shared) ship only on the two listed-firm files and the anchor firm's hand-typed
label (25 October 2026: firms on the five lists are named, firms on no list never; basemap.json's region and window
names are place names and stay allowed); the neighbour firm (anchors.b) carries no name. Round 16: insights.json must be the file
tools/insights_build.py checked, with its twin, and passes that tool's text checks again here. The script prints the files by group with their sizes
so each artifact publish stays under 64 MB, and exits non-zero on a rule breach or a file over the
artifact's caps (16 MB page or text file, 15 MB binary file).

With --from COMMIT (round 14) the pages, the stylesheet and the scripts are read from that commit instead of the working tree, so an approved commit can be
published while later work sits uncommitted or in later commits; the data files still come from the working tree, and the set is refused if a tracked data
file differs from the commit's. The build stamp then names that commit.

Round 16: the fonts the atlas loads from its own folder (fonts/DejaVuSansMono.ttf, for the Armenian letters of the REFERENCES panel's note) ship in
fonts/ with their licence beside them, read from the --from commit like the scripts. Every http(s) link in the shipped pages, scripts and data
twins must be on the expected list: the insights' sources (insights.json), the cat facts' sources (offwire.json), and the page's own links
below (the footer's, the references', the fonts', the basemap's). A link that is on none of them refuses the set.

Round 18: every data twin must hold the same data as its JSON file, and every JSON file must match the hash its provenance recorded when the
pass or builder wrote it, so a refresh that left a stale twin or an edited file is refused without a browser run. Twins that neither page loads
are left out of the set and named (the author's decision of 27 October 2026, for industry-city.js, 4.3 MB).

TEACH YOUR AGENT (round 15, the author's revision of 26 October 2026): the set's js/agent-guide.js is rebuilt at every publish from the data the set
ships, with tools/agent_guide.py as of the commit the set comes from, and dated with the day of the publish; the set is refused if the guide breaks
one of the builder's rules, the public-release checks among them. The page itself never fetches it.

Publish dates (after v39, 28 October 2026): every date a publish writes is the UTC day of the publish, the guide's and the CORRECTIONS entry's
alike. The set compares the REFERENCES panel's CORRECTIONS with the last publish's, read from the commit named in the build line of the
publish copy committed at HEAD: at most one entry new since then, dated the publish day, on a day the last publish's entries do not
already hold (one entry per date; a second publish with corrections on one UTC day needs the author). --dates runs this check alone and
copies nothing: run it before the publish gate's five-width audit, so that a date edit lands before that run and needs no second one;
tools/audit_five.py shows its result as a note at the start of every run.

Round 19 (the author's decision of 28 October 2026): only --write builds into publish/. Without it the set is built and checked in a scratch
folder under build/, compared with publish/ (files added and changed) and removed, so a trial run never touches the publish copy. -h or
--help prints this note and builds nothing."""
import datetime, filecmp, hashlib, json, os, re, shutil, subprocess, sys, tempfile, types

HERE = os.path.dirname(os.path.abspath(__file__))
FROM = sys.argv[sys.argv.index("--from") + 1] if "--from" in sys.argv else None
MOTION = os.path.normpath(os.path.join(HERE, ".."))
if "-h" in sys.argv or "--help" in sys.argv: print(__doc__); sys.exit(0)
DATES_ONLY = "--dates" in sys.argv
WRITE = "--write" in sys.argv   # round 19: the publish copy is written only on request; a run without it builds in scratch and reports
PUBLISH = os.path.join(MOTION, "publish")
OUT = PUBLISH if WRITE or DATES_ONLY else tempfile.mkdtemp(prefix="publish-dry-", dir=os.path.join(MOTION, "build"))
if not DATES_ONLY: os.makedirs(OUT, exist_ok=True)
FONT = '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700%s&display=swap">'
FONT_EXTRA = {"explorer.html": "&family=Tomorrow:wght@400;500"}   # the atlas's data wire in Tomorrow (round 15, the author's final choice of 26 October 2026); the explainer loads Plex alone
META = '<meta name="claude:viewport-fit-sides" content="cover">'
def git(*args, text=True):
    return subprocess.run(["git"] + list(args), cwd=MOTION, capture_output=True, text=text, check=True).stdout
def build_id():   # the commit the set is built from, for the pages' console greeting (round 12, part D); a dirty shipped file is said so
    if FROM:
        h = git("rev-parse", "--short=12", FROM + "^{commit}").strip()
        if git("diff", "--name-only", FROM, "--", "data").strip(): raise SystemExit("publish-set: tracked data files differ from " + FROM + "; refused")
        return "commit " + h
    try:
        h = git("rev-parse", "--short=12", "HEAD").strip(); dirty = git("status", "--porcelain", "--", "explorer.html", "explainer.html", "js", "css", "data").strip()
    except Exception:
        return "an unrecorded build"
    return "commit " + h + (" with uncommitted changes" if dirty else "")
def source(path):   # a page, the stylesheet or a script: from the working tree, or from the --from commit
    if FROM: return git("show", FROM + ":motion/" + path, text=False)
    return open(os.path.join(MOTION, path), "rb").read()
BUILD = build_id()
BUILD_META = '<meta name="build" content="%s">' % BUILD
TEXT_CAP = 16 * 1024 * 1024; BIN_CAP = 15 * 1024 * 1024
FONT_LICENCE = {"DejaVuSansMono.ttf": "DejaVuSansMono-LICENSE.txt"}   # a font file and the licence that ships beside it (round 16)
LINKS = {"https://armenkaprelian.github.io/", "https://armenkaprelian.github.io/atlas/", "https://x.com/ArmenKaprelian", "https://www.youtube.com/watch?v=y4T5gmAndFk",   # 28 October 2026: the author's site and the atlas on it, the Galbraith video
         "https://doi.org/10.1038/s41597-025-05150-1", "https://doi.org/10.1371/journal.pone.0231866", "https://doi.org/10.5281/zenodo.22257046",
         "https://data.worldbank.org/indicator/NY.GDP.DEFL.ZS.AD", "https://www.openstreetmap.org/copyright", "https://opendatacommons.org/licenses/odbl/1-0/", "https://fonts.gstatic.com", "http://www.w3.org/2000/svg",
         "https://armenkaprelian.github.io/atlas/agent-guide.md"}   # TEACH YOUR AGENT's link (tools/agent_guide.py GUIDE_URL; on the author's site since 28 October 2026)
LINK_PREFIXES = ("https://x.com/intent/post?text=", "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono", "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/")
def page_fonts():   # the font files the pages load from fonts/ (round 16), read from the pages themselves so the set follows --from
    names = []
    for page in ("explainer.html", "explorer.html"):
        for n in re.findall(r"url\('fonts/([^']+)'\)", source(page).decode("utf-8")):
            for m in (n, FONT_LICENCE.get(n)):
                if m and m not in names: names.append(m)
    return names
def link_scan(data_dir):   # every http(s) link in the shipped text files against the expected list (round 16)
    want = set(LINKS); ins = json.load(open(os.path.join(data_dir, "insights.json"), encoding="utf-8"))
    for grp in ("regions", "cities"):
        for unit in ins[grp].values(): want.update(s["url"] for s in unit["sources"])
    want.update(f["ref"] for f in json.load(open(os.path.join(data_dir, "offwire.json"), encoding="utf-8"))["facts"])
    seen, bad = {}, []
    for root, _, files in os.walk(OUT):
        for n in files:
            if not n.endswith((".html", ".js")): continue
            for u in re.findall(r"""https?://[^\s"'<>`)\\]+""", open(os.path.join(root, n), encoding="utf-8").read()):
                seen.setdefault(u.rstrip(".,;"), os.path.relpath(os.path.join(root, n), OUT))
    for u, f in sorted(seen.items()):
        if u not in want and not u.startswith(LINK_PREFIXES): bad.append("a link not on the expected list: %s (in %s)" % (u[:120], f))
    return len(seen), bad
def page_scripts():   # the scripts the two pages load, read from the pages themselves (round 14: js/pixel-field.js joined the atlas), so the set follows --from too
    names = []
    for page in ("explainer.html", "explorer.html"):
        for n in re.findall(r'<script src="js/([^"]+)"', source(page).decode("utf-8")):
            if n not in names: names.append(n)
    return names
SCRIPTS = page_scripts()
ID_KEY = re.compile(r"(^|_)(inn|ogrn)(_|$)", re.I)
NAME_KEY = re.compile(r"^(name|name_alt|name_filed|name_shared|name_case|names|label_long)$", re.I)   # firm-name keys (25 October 2026): allowed only where listed below
NAME_ALLOWED = {"treated.json": {"name", "name_filed", "name_case", "name_shared"}, "treatednational.json": {"name", "name_filed", "name_case", "name_shared"}, "anchors.json": {"label_long"},
                "basemap.json": {"name"}}   # basemap: the names of regions and city windows (M1), place names, not firms
# The video asset of the explainer artifact (the teaser's 720p cut under the 15 MB asset cap; the Moscow and 55 s
# cuts were retired on 24 October 2026, and the 25 October re-render was byte-identical, so the asset stayed): the
# published page links it; the local page keeps its build/ files instead.
VIDEOS = [("Teaser, 46 s", "/_blob/21895bd12c78c044b081622745188895")]   # the round-15 teaser asset (27 October 2026: the darker stage and the round's wording; c5240020… of round 13 before it)
VIDEO_NOTE = '<p class="note">Video at 720p: ' + ', '.join('<a href="%s">%s</a>' % (u, l) for l, u in VIDEOS) + '. The full cut (4:47) is larger than the asset cap and travels as a file.</p>'

def convert(name):
    src = source(name).decode("utf-8")
    title = re.search(r"<title>.*?</title>", src, re.S).group(0)
    head = re.search(r"<head>(.*?)</head>", src, re.S).group(1)
    body = re.search(r"<body>(.*?)</body>", src, re.S).group(1)
    style = re.search(r"<style>.*?</style>", head, re.S)
    css_link = re.search(r'<link rel="stylesheet" href="css/theme.css">', head)
    parts = [title, META, BUILD_META, FONT % FONT_EXTRA.get(name, "")]
    if style:
        parts.append(style.group(0))
    if css_link:
        css = source("css/theme.css").decode("utf-8")
        parts.append("<style>\n" + css + "\n</style>")
    if name == "explainer.html":
        anchor = "</p>\n<footer class=\"efoot\">" if "</p>\n<footer class=\"efoot\">" in body else "</p>\n<script"   # the note sits before the footer since round 10 (before the scripts until round 9)
        if anchor not in body: raise SystemExit("publish-set: the video note found no place in the explainer page")
        body = body.replace(anchor, "</p>\n" + VIDEO_NOTE + "\n" + anchor[len("</p>\n"):], 1)
    out = "\n".join(parts) + "\n" + body.strip() + "\n"
    with open(os.path.join(OUT, name), "w", encoding="utf-8") as fh:
        fh.write(out)
    return len(out.encode("utf-8"))

def copy(sub, name):
    src = os.path.join(MOTION, sub, name); dst = os.path.join(OUT, sub, name)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    if sub in ("js", "fonts"): open(dst, "wb").write(source(sub + "/" + name))   # the scripts and the fonts follow --from; the data stay the working tree's
    else: shutil.copyfile(src, dst)
    return os.path.getsize(dst)

def agent_guide(problems):   # the guide rebuilt for the set (see the module's note); returns a line for the report, or None when the pages do not load it
    if "agent-guide.js" not in SCRIPTS: return None
    if FROM:
        try:   # round 18: the builder imports Motion.fmt's port; the commit's own copy is registered first, so the guide formats as it did at that commit
            jf = types.ModuleType("jsfmt"); jf.__file__ = os.path.join(HERE, "jsfmt.py")
            exec(compile(git("show", FROM + ":motion/tools/jsfmt.py"), "jsfmt.py at " + FROM, "exec"), jf.__dict__); sys.modules["jsfmt"] = jf
        except Exception: pass   # a commit before round 18: its builder carries its own formatting
        mod = types.ModuleType("agent_guide_at_commit"); mod.__file__ = os.path.join(HERE, "agent_guide.py")   # its paths resolve here; build() takes the data folder
        exec(compile(git("show", FROM + ":motion/tools/agent_guide.py"), "agent_guide.py at " + FROM, "exec"), mod.__dict__)
    else:
        sys.path.insert(0, HERE); import agent_guide as mod
    when = long_date(publish_day())
    text = mod.build(os.path.join(MOTION, "data"), published=when)
    for f in mod.rules(text): problems.append("agent guide: " + " | ".join(f))
    same = source("js/agent-guide.js").decode("utf-8") == mod.js_of(mod.build(os.path.join(MOTION, "data")))
    open(os.path.join(OUT, "js", "agent-guide.js"), "w", encoding="utf-8").write(mod.js_of(text))
    if getattr(mod, "GUIDE_URL", None):   # round 17: the button copies a link to the dated guide, which the publish copy's commit serves from the public repository (not an artifact file)
        open(os.path.join(OUT, "agent-guide.md"), "w", encoding="utf-8").write(text)
        return "agent guide: rebuilt and dated %s; the button copies %s, served from the site's atlas/ once its tools/import_atlas.py copies this publish set and the site is pushed" % (when, mod.GUIDE_URL)
    return "agent guide: rebuilt from the shipped data and dated %s; %s" % (when, "the source's copy matched it" if same else "the source's copy was stale, the set carries the rebuilt guide")

MONTH_DAY = r"\d{1,2} (?:January|February|March|April|May|June|July|August|September|October|November|December) \d{4}"
def publish_day(): return datetime.datetime.now(datetime.timezone.utc).date()   # one clock for every date a publish writes: the UTC day
def long_date(d): return "%d %s %d" % (d.day, d.strftime("%B"), d.year)
def correction_entries(app_js):   # [(date, text)] of the REFERENCES panel's CORRECTIONS in js/explorer-app.js, newest first
    m = re.search(r"S\.push\(\['corrections'.*?\]\]\);", app_js, re.S)
    return re.findall(r"`<b>(%s)</b>: (.*?)`" % MONTH_DAY, m.group(0), re.S) if m else []
def last_published():   # the source commit of the last publish, from the build line of the publish copy committed at HEAD
    try: m = re.search(r'<meta name="build" content="commit ([0-9a-f]{7,})', git("show", "HEAD:motion/publish/explorer.html"))
    except subprocess.CalledProcessError: return None
    return m.group(1) if m else None
def corrections_dates(cur, pub, day):
    """(problems, notes) for the CORRECTIONS entries cur against the last publish's pub, on the publish day day (see the module's note)."""
    want = long_date(day); new = [e for e in cur if e not in pub]; gone = [e for e in pub if e not in cur]; bad, notes = [], []
    if gone: notes.append("CORRECTIONS: %d entry(ies) of the last publish changed or left (every correction stays on the page; a condensing is the author's)" % len(gone))
    if not new: return bad, notes + ["CORRECTIONS: no entry new since the last publish; the publish day is %s (UTC)" % want]
    if len(new) > 1: bad.append("CORRECTIONS: %d entries new since the last publish, where one publish adds one (the author decides how to combine them)" % len(new))
    if want in {d for d, _ in pub}: bad.append("CORRECTIONS: a published entry is already dated %s, the publish day (UTC), and dates are one per entry: the author decides (fold the new entry into it, or publish after 00:00 UTC)" % want)
    else:
        for d, _ in new:
            if d != want: bad.append("CORRECTIONS: the new entry is dated %s and the publish day is %s (UTC): date it %s before the gate's five-width run" % (d, want, want))
    if not bad: notes.append("CORRECTIONS: the new entry carries the publish day, %s (UTC)" % want)
    return bad, notes
def dates_check():   # corrections_dates on the shipped script against the last publish's
    base = last_published()
    if base is None: return [], ["CORRECTIONS: no publish copy at HEAD names its commit, so the entries were not compared; the publish day is %s (UTC)" % long_date(publish_day())]
    cur = correction_entries(source("js/explorer-app.js").decode("utf-8")); pub = correction_entries(git("show", base + ":motion/js/explorer-app.js"))
    return corrections_dates(cur, pub, publish_day())

def keys_of(obj, out):
    if isinstance(obj, dict):
        for k, v in obj.items():
            out.add(k); keys_of(v, out)
    elif isinstance(obj, list):
        for v in obj: keys_of(v, out)
    return out

def check_rules(data_dir):
    bad = []
    for name in sorted(os.listdir(data_dir)):
        if not name.endswith(".json") or name.endswith(".provenance.json"):
            continue
        obj = json.load(open(os.path.join(data_dir, name), encoding="utf-8"))
        keys = keys_of(obj, set())
        hits = sorted(k for k in keys if ID_KEY.search(k))
        if hits:
            bad.append("%s carries identifier keys: %s" % (name, ", ".join(hits)))
        names = sorted(k for k in keys if NAME_KEY.match(k) and k not in NAME_ALLOWED.get(name, set()))
        if names:
            bad.append("%s carries a firm-name key outside the listed-firm files: %s" % (name, ", ".join(names)))
        if name == "insights.json":   # round 16: the profiles' insights as tools/insights_build.py built and checked them; its text checks run again here from the provenance's list
            sys.path.insert(0, HERE); import insights_build as IB
            prov = json.load(open(os.path.join(data_dir, "insights.provenance.json"), encoding="utf-8")); prof = json.load(open(os.path.join(data_dir, "profiles.json"), encoding="utf-8"))
            if IB.sha256(os.path.join(data_dir, name)) != prov["output"]["json_sha256"]: bad.append("insights.json differs from the file insights_build.py checked")
            if open(os.path.join(data_dir, "insights.js"), encoding="utf-8").read() != IB.js_of(obj): bad.append("insights.js is not the twin of insights.json")
            for c in IB.text_checks(obj, set(prof["regions"]["region"]), set(prof["windows"]["label"]), prov["off_list"], prov["allow"]):
                if not c["pass"]: bad.append("insights.json: %s (%s)" % (c["check"], c["detail"][:160]))
        if name in ("treated.json", "treatednational.json"):
            vals = obj.get("name", [])
            if len(vals) != obj.get("n"): bad.append("%s: %d names for %s firms" % (name, len(vals), obj.get("n")))
            if any(re.search(r"\d{9,}", v or "") for v in vals): bad.append("%s: a name carries a run of nine or more digits" % name)
            if any(len(v or "") > 60 for v in vals): bad.append("%s: a name is longer than 60 characters" % name)
        if name == "anchors.json":
            b = obj.get("b", {})
            if any(k in b for k in ("name", "name_alt", "label_long")) or "private" not in str(b.get("label", "")).lower():
                bad.append("anchors.json: the neighbour firm must stay anonymous (label %r)" % b.get("label"))
    return bad

TWIN = re.compile(r'window\.MOTION_DATA(?:\[\s*"([^"]+)"\s*\]|\.([A-Za-z_$][\w$]*))\s*=\s*')   # anywhere on its line: offwire.js assigns after the guard on one line
def twin_data(path):   # the data a .js twin assigns: window.MOTION_DATA["id"] = {...}; (the passes and builders) or window.MOTION_DATA.id = {...}; (offwire)
    txt = open(path, encoding="utf-8").read(); m = None
    for m in TWIN.finditer(txt): pass
    if m is None: return None
    body = txt[m.end():].rstrip()
    return json.loads(body[:-1] if body.endswith(";") else body)

def page_loads():   # the text of the two pages and their scripts, which name every data file a page loads as 'data/<file>'
    loads = ""
    for page in ("explorer.html", "explainer.html"): loads += source(page).decode("utf-8")
    for n in SCRIPTS: loads += source("js/" + n).decode("utf-8")
    return loads
def loaded(name, loads): return re.search(r"""["'`]data/%s["'`]""" % re.escape(name), loads) is not None

def twin_checks(data_dir, loads):   # round 18: twins against their JSON, JSON against its provenance's hash, and the twins no page loads
    bad, notes = [], []
    hashed = 0
    for name in sorted(os.listdir(data_dir)):
        if not name.endswith(".json") or name.endswith(".provenance.json"): continue
        stem = name[:-5]; js = os.path.join(data_dir, stem + ".js")
        if os.path.exists(js):
            try:
                if twin_data(js) != json.load(open(os.path.join(data_dir, name), encoding="utf-8")): bad.append("data/%s.js does not hold the data of %s" % (stem, name))
            except ValueError as e: bad.append("data/%s.js cannot be read as a twin: %s" % (stem, e))
        pv = os.path.join(data_dir, stem + ".provenance.json")
        if os.path.exists(pv):
            want = (json.load(open(pv, encoding="utf-8")).get("output") or {}).get("json_sha256")
            if want:
                hashed += 1
                if hashlib.sha256(open(os.path.join(data_dir, name), "rb").read()).hexdigest() != want: bad.append("%s differs from the file its provenance recorded (%s.provenance.json)" % (name, stem))
    orphans = [n for n in sorted(os.listdir(data_dir)) if n.endswith(".js") and not loaded(n, loads)]
    notes.append("data: every twin checked against its JSON, %d JSON files against their provenance's hash" % hashed)
    if orphans: notes.append("data: %d twin(s) that neither page loads, left out of the set: %s (%.1f MB)" % (len(orphans), ", ".join(orphans), sum(os.path.getsize(os.path.join(data_dir, n)) for n in orphans) / 1048576))
    return bad, notes

def main():
    if DATES_ONLY:
        bad, notes = dates_check()
        for t in notes: print(t)
        for pr in bad: print("REFUSED: " + pr)
        return 1 if bad else 0
    groups = {"pages": [], "scripts": [], "fonts": [], "data": [], "moscow rasters": [], "national rasters": [], "addresses": []}
    for n in ("explainer.html", "explorer.html"):
        groups["pages"].append((n, convert(n)))
    for n in SCRIPTS:
        groups["scripts"].append(("js/" + n, copy("js", n)))
    for n in page_fonts():
        groups["fonts"].append(("fonts/" + n, copy("fonts", n)))
    data_dir = os.path.join(MOTION, "data"); loads = page_loads()
    for n in sorted(os.listdir(data_dir)):
        if not n.endswith(".js"): continue
        if loaded(n, loads): groups["data"].append(("data/" + n, copy("data", n)))
        elif os.path.exists(os.path.join(OUT, "data", n)): os.remove(os.path.join(OUT, "data", n))   # a twin no page loads: no stale copy stays in the set
    years = range(2014, 2026)
    wanted = ["align.png"] + ["%s-%d%s.png" % (ext, y, suf) for y in years for ext, suf in (("city", "-all"), ("downtown", "-all"), ("downtown", ""), ("region", "-all"))]
    for n in wanted:   # the rasters the journey loads: every backdrop, the downtown and national outcome layers
        groups["moscow rasters"].append(("data/points/" + n, copy("data/points", n)))
    for n in sorted(os.listdir(os.path.join(data_dir, "points-national"))):
        if n.endswith(".png"): groups["national rasters"].append(("data/points-national/" + n, copy("data/points-national", n)))
    firms = os.path.join(data_dir, "firms")
    if os.path.isdir(firms):
        for n in sorted(os.listdir(firms)):
            if n.endswith(".js"): groups["addresses"].append(("data/firms/" + n, copy("data/firms", n)))   # the base64 twins; the host serves no raw binaries
    problems = check_rules(data_dir)
    twin_bad, twin_notes = twin_checks(data_dir, loads); problems += twin_bad
    guide = agent_guide(problems)
    n_links, bad_links = link_scan(data_dir); problems += bad_links
    date_bad, date_notes = dates_check(); problems += date_bad
    total = 0
    for g, items in groups.items():
        size = sum(b for _, b in items); total += size
        print("%-17s %3d files %7.1f MB" % (g, len(items), size / 1048576))
        for n, b in items:
            cap = TEXT_CAP if n.endswith((".html", ".js", ".json")) else BIN_CAP
            if b > cap: problems.append("%s is %.1f MB, over the %d MB cap" % (n, b / 1048576, cap // 1048576))
    print("publish set: %.1f MB in %s" % (total / 1048576, OUT))
    print("build: " + BUILD)
    if guide: print(guide)
    for t in twin_notes + date_notes: print(t)
    print("links: %d distinct http(s) links in the shipped pages, scripts and data twins, %d not on the expected list" % (n_links, len(bad_links)))
    for pr in problems: print("REFUSED: " + pr)
    return 1 if problems else 0

def dry_report():   # round 19: what --write would change in publish/; the scratch set is removed after
    def files(root): return {os.path.relpath(os.path.join(r, n), root) for r, _, fs in os.walk(root) for n in fs}
    new, old = files(OUT), files(PUBLISH) if os.path.isdir(PUBLISH) else set()
    changed = sorted(p for p in new & old if not filecmp.cmp(os.path.join(OUT, p), os.path.join(PUBLISH, p), shallow=False))
    print("dry run, publish/ untouched: %d files would be added and %d changed; --write builds into publish/" % (len(new - old), len(changed)))
    for p in (sorted(new - old) + changed)[:12]: print("  " + p)

if __name__ == "__main__":
    code = main()
    if not WRITE and not DATES_ONLY:
        try: dry_report()
        finally: shutil.rmtree(OUT, ignore_errors=True)
    sys.exit(code)
