#!/usr/bin/env python3
"""Assemble the publish set of the two pages under motion/publish/.

The claude.ai artifact wraps a page in its own document skeleton, so the page copies drop the
doctype, html, head and body tags, keep the <title>, inline css/theme.css, add the Google Fonts
fallback (Arimo is metric-compatible with the Liberation/Arial family the pages use locally) and the
viewport-fit meta the page contract asks for. Beside them: the six shared scripts, every data file
(the aggregates and, since the author's rule change of 23 October 2026, the firm-level files: the
Moscow and national manifests, the listed firms, the anchors, the Moscow cells and comparison groups,
the registered-address files as base64 script twins), the Moscow rasters the journey loads and the national rasters.

Two rules stay and are checked here: no shipped data file carries an identifier key (inn, ogrn) and
the neighbour firm (anchors.b) carries no name. The script prints the files by group with their sizes
so each artifact publish stays under 64 MB, and exits non-zero on a rule breach or a file over the
artifact's caps (16 MB page or text file, 15 MB binary file)."""
import json, os, re, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
MOTION = os.path.normpath(os.path.join(HERE, ".."))
OUT = os.path.join(MOTION, "publish")
os.makedirs(OUT, exist_ok=True)
FONT = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Arimo:wght@400;600;700&display=swap">'
META = '<meta name="claude:viewport-fit-sides" content="cover">'
TEXT_CAP = 16 * 1024 * 1024; BIN_CAP = 15 * 1024 * 1024
SCRIPTS = ["motion-core.js", "map-layers.js", "charts.js", "explainer-scenes.js", "treated-scenes.js", "explorer-app.js"]
ID_KEY = re.compile(r"(^|_)(inn|ogrn)(_|$)", re.I)
# The video assets of the explainer artifact (the three 720p cuts under the 15 MB asset cap, uploaded on
# 23 October 2026): the published page links them; the local page keeps its build/ files instead.
VIDEOS = [("Teaser, 46 s", "/_blob/736f29f07f3b4f219b71928cc7852c06"), ("Moscow, 110 s", "/_blob/5cad6fae05cb42ba961b2f51ff37e6cc"), ("Maps and firms, 55 s", "/_blob/a71b038a88a257227159c56f2039907e")]
VIDEO_NOTE = '<p class="note">Videos at 720p: ' + ', '.join('<a href="%s">%s</a>' % (u, l) for l, u in VIDEOS) + '. The full cut (4:47) and the 174 s maps-and-firms cut are larger than the asset cap and travel as files.</p>'

def convert(name):
    src = open(os.path.join(MOTION, name), encoding="utf-8").read()
    title = re.search(r"<title>.*?</title>", src, re.S).group(0)
    head = re.search(r"<head>(.*?)</head>", src, re.S).group(1)
    body = re.search(r"<body>(.*?)</body>", src, re.S).group(1)
    style = re.search(r"<style>.*?</style>", head, re.S)
    css_link = re.search(r'<link rel="stylesheet" href="css/theme.css">', head)
    parts = [title, META, FONT]
    if style:
        parts.append(style.group(0))
    if css_link:
        css = open(os.path.join(MOTION, "css", "theme.css"), encoding="utf-8").read()
        parts.append("<style>\n" + css + "\n</style>")
    if name == "explainer.html":
        body = body.replace("</p>\n<script", "</p>\n" + VIDEO_NOTE + "\n<script", 1)
    out = "\n".join(parts) + "\n" + body.strip() + "\n"
    with open(os.path.join(OUT, name), "w", encoding="utf-8") as fh:
        fh.write(out)
    return len(out.encode("utf-8"))

def copy(sub, name):
    src = os.path.join(MOTION, sub, name); dst = os.path.join(OUT, sub, name)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copyfile(src, dst)
    return os.path.getsize(dst)

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
        hits = sorted(k for k in keys_of(obj, set()) if ID_KEY.search(k))
        if hits:
            bad.append("%s carries identifier keys: %s" % (name, ", ".join(hits)))
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
    total = 0
    for g, items in groups.items():
        size = sum(b for _, b in items); total += size
        print("%-17s %3d files %7.1f MB" % (g, len(items), size / 1048576))
        for n, b in items:
            cap = TEXT_CAP if n.endswith((".html", ".js", ".json")) else BIN_CAP
            if b > cap: problems.append("%s is %.1f MB, over the %d MB cap" % (n, b / 1048576, cap // 1048576))
    print("publish set: %.1f MB in %s" % (total / 1048576, OUT))
    for pr in problems: print("REFUSED: " + pr)
    return 1 if problems else 0

if __name__ == "__main__":
    sys.exit(main())
