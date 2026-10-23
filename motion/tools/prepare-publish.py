#!/usr/bin/env python3
"""Make the artifact copies of the two pages under motion/publish/.

The claude.ai artifact wraps a page in its own document skeleton, so the copies drop the doctype,
html, head and body tags, keep the <title>, inline css/theme.css, add the Google Fonts fallback
(Arimo is metric-compatible with the Liberation/Arial family the pages use locally) and the
viewport-fit meta the page contract asks for. Scripts and data stay relative (published as files)."""
import os, re, sys

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

for n in ("explainer.html", "explorer.html"):
    convert(n)
