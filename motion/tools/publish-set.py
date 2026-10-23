#!/usr/bin/env python3
"""Assemble the publish set of the two pages under motion/publish/.

The claude.ai artifact wraps a page in its own document skeleton, so the page copies drop the
doctype, html, head and body tags, keep the <title>, inline css/theme.css, add the Google Fonts
fallback (Arimo is metric-compatible with the Liberation/Arial family the pages use locally) and the
viewport-fit meta the page contract asks for. The shared scripts and the aggregate data files are
copied beside them (published as files). Any name matching points|treated|anchors|moscow|national is refused:
the Moscow firm-level pieces never leave the lab. The script prints every file with its size and the
total, and exits non-zero if the set exceeds the artifact limit."""
import os, re, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
MOTION = os.path.normpath(os.path.join(HERE, ".."))
OUT = os.path.join(MOTION, "publish")
os.makedirs(OUT, exist_ok=True)
FONT = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Arimo:wght@400;600;700&display=swap">'
META = '<meta name="claude:viewport-fit-sides" content="cover">'

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
    out = "\n".join(parts) + "\n" + body.strip() + "\n"
    with open(os.path.join(OUT, name), "w", encoding="utf-8") as fh:
        fh.write(out)
    print("%s: %d bytes" % (name, len(out.encode("utf-8"))))

REFUSE = re.compile(r"points|treated|anchors|moscow|national", re.I)
SCRIPTS = ["motion-core.js", "map-layers.js", "charts.js", "explainer-scenes.js", "explorer-app.js"]
DATA = ["basemap.js", "cells100.js", "density.js", "series.js", "cellsyears.js"]
LIMIT = 16 * 1024 * 1024

def copy(sub, name):
    if REFUSE.search(name):
        sys.exit("refused: %s/%s matches the local-only pattern" % (sub, name))
    src = os.path.join(MOTION, sub, name); dst = os.path.join(OUT, sub, name)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copyfile(src, dst)
    return os.path.getsize(dst)

def main():
    total = 0
    for n in ("explainer.html", "explorer.html"):
        convert(n); total += os.path.getsize(os.path.join(OUT, n))
    for n in SCRIPTS:
        b = copy("js", n); total += b; print("js/%s: %d bytes" % (n, b))
    for n in DATA:
        b = copy("data", n); total += b; print("data/%s: %d bytes" % (n, b))
    # Nothing in the set may carry a local-only name, whatever put it there.
    for root, _, files in os.walk(OUT):
        for f in files:
            if REFUSE.search(f):
                sys.exit("refused: %s is in the publish set" % os.path.join(root, f))
    print("publish set: %.1f MB in %s" % (total / 1048576, OUT))
    if total > LIMIT:
        sys.exit("the publish set exceeds the 16 MB artifact limit")

if __name__ == "__main__":
    main()
