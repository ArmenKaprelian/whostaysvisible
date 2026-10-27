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

TEACH YOUR AGENT (round 15, the author's revision of 26 October 2026): the set's js/agent-guide.js is rebuilt at every publish from the data the set
ships, with tools/agent_guide.py as of the commit the set comes from, and dated with the day of the publish; the set is refused if the guide breaks
one of the builder's rules, the public-release checks among them. The page itself never fetches it."""
import datetime, json, os, re, shutil, subprocess, sys, types

HERE = os.path.dirname(os.path.abspath(__file__))
FROM = sys.argv[sys.argv.index("--from") + 1] if "--from" in sys.argv else None
MOTION = os.path.normpath(os.path.join(HERE, ".."))
OUT = os.path.join(MOTION, "publish")
os.makedirs(OUT, exist_ok=True)
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
    if sub == "js": open(dst, "wb").write(source(sub + "/" + name))   # the scripts follow --from; the data stay the working tree's
    else: shutil.copyfile(src, dst)
    return os.path.getsize(dst)

def agent_guide(problems):   # the guide rebuilt for the set (see the module's note); returns a line for the report, or None when the pages do not load it
    if "agent-guide.js" not in SCRIPTS: return None
    if FROM:
        mod = types.ModuleType("agent_guide_at_commit"); mod.__file__ = os.path.join(HERE, "agent_guide.py")   # its paths resolve here; build() takes the data folder
        exec(compile(git("show", FROM + ":motion/tools/agent_guide.py"), "agent_guide.py at " + FROM, "exec"), mod.__dict__)
    else:
        sys.path.insert(0, HERE); import agent_guide as mod
    d = datetime.date.today(); when = "%d %s %d" % (d.day, d.strftime("%B"), d.year)
    text = mod.build(os.path.join(MOTION, "data"), published=when)
    for f in mod.rules(text): problems.append("agent guide: " + " | ".join(f))
    same = source("js/agent-guide.js").decode("utf-8") == mod.js_of(mod.build(os.path.join(MOTION, "data")))
    open(os.path.join(OUT, "js", "agent-guide.js"), "w", encoding="utf-8").write(mod.js_of(text))
    return "agent guide: rebuilt from the shipped data and dated %s; %s" % (when, "the source's copy matched it" if same else "the source's copy was stale, the set carries the rebuilt guide")

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

def main():
    groups = {"pages": [], "scripts": [], "data": [], "moscow rasters": [], "national rasters": [], "addresses": []}
    for n in ("explainer.html", "explorer.html"):
        groups["pages"].append((n, convert(n)))
    for n in SCRIPTS:
        groups["scripts"].append(("js/" + n, copy("js", n)))
    data_dir = os.path.join(MOTION, "data")
    for n in sorted(os.listdir(data_dir)):
        if n.endswith(".js"):
            groups["data"].append(("data/" + n, copy("data", n)))
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
    guide = agent_guide(problems)
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
    for pr in problems: print("REFUSED: " + pr)
    return 1 if problems else 0

if __name__ == "__main__":
    sys.exit(main())
