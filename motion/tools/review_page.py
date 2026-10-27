#!/usr/bin/env python3
"""The review pages' helpers (round 16, from round 15's scratch builder, kept as a tool on the author's request of 27 October 2026).

A round's page builder imports this module: figures embedded as WebP data, rows of variants side by side, the decision block (recommendation,
confidence, likely regret), tables, sections, and the page itself in the memo theme the author set in round 15 (General 1): the atlas's
stage and panel, titles in the neon green, code, variable names and links in the neon fuchsia, boxes with full borders, never a
left-border-only highlight. Frames come from atlas-frames.py; every figure is cropped and scaled here, so the page is self-contained.

    from review_page import Page, fig, row, decide, table, p
    pg = Page("Round 16 proposal", "Visibility Atlas, 27 October 2026. ...")
    pg.section("i8", "8 · The ghost names", p("..."), row(fig("8A, as published", "frames/8A.png", box=(16, 64, 1172, 946), scale=0.5)), decide("8Gb", "Medium", "..."))
    pg.write("motion/review/2026-10-2X-round-16-proposal.html")"""
import base64, html, io, os

try:
    from PIL import Image
except ImportError:   # the builder needs Pillow for the figures; the text helpers work without it
    Image = None

CSS = """
:root { color-scheme: dark; --bg: #03060E; --panel: #091023; --ink: #ECEEF1; --muted: #B4C0D0; --dim: #7D889C; --line: #2E333D; --acc: #4DFF7F; --fu: #FF45C8; --ice: #CFE6FF; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 15px/1.55 "IBM Plex Mono", "DejaVu Sans Mono", ui-monospace, Menlo, monospace; }
main { max-width: 1240px; margin: 0 auto; padding: 24px 16px 80px; }
h1 { font-size: 22px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--acc); margin: 0 0 6px; }
h2 { font-size: 17px; letter-spacing: 0.05em; text-transform: uppercase; color: var(--acc); margin: 44px 0 10px; padding-top: 14px; border-top: 2px solid var(--acc); }
h3 { font-size: 14px; letter-spacing: 0.05em; text-transform: uppercase; color: var(--acc); margin: 24px 0 8px; }
p { margin: 8px 0; max-width: 980px; }
code, .var { color: var(--fu); }
a { color: var(--fu); }
.lede { color: var(--muted); }
nav { display: flex; flex-wrap: wrap; gap: 6px 14px; margin: 14px 0 6px; font-size: 13px; }
.row { display: flex; flex-wrap: wrap; gap: 14px; margin: 12px 0; align-items: flex-start; }
figure { margin: 0; flex: 0 1 auto; }
figure img, figure svg { display: block; max-width: 100%; height: auto; border: 1px solid var(--line); }
.lab { font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink); margin-bottom: 4px; font-weight: 600; }
.rec { color: var(--bg); background: var(--acc); padding: 0 6px; margin-left: 6px; font-size: 11px; }
figcaption { font-size: 12px; color: var(--muted); margin-top: 4px; max-width: 640px; }
dl.dec { display: grid; grid-template-columns: max-content 1fr; gap: 4px 14px; margin: 12px 0; padding: 10px 12px; border: 2px solid var(--acc); background: var(--panel); max-width: 980px; }
dl.dec dt { color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; font-size: 12px; padding-top: 2px; }
dl.dec dd { margin: 0; }
.box { border: 2px solid var(--line); background: var(--panel); padding: 10px 12px; margin: 12px 0; max-width: 1200px; }
table { border-collapse: collapse; margin: 10px 0; font-size: 13px; max-width: 1200px; }
th, td { border: 1px solid var(--line); padding: 5px 8px; vertical-align: top; text-align: left; }
th { color: var(--muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; font-size: 11px; }
ul, ol { max-width: 980px; }
@media (max-width: 700px) { body { font-size: 14px; } table { display: block; overflow-x: auto; } }
"""

def esc(t): return html.escape(str(t if t is not None else ""), quote=True)

def img(path, box=None, scale=1.0, q=82):
    """A frame as WebP data: cropped to box (x0, y0, x1, y1) in the image's pixels, then scaled."""
    if Image is None: raise SystemExit("review_page: Pillow is needed for figures")
    im = Image.open(path).convert("RGB")
    if box: im = im.crop(box)
    if scale != 1.0: im = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)
    b = io.BytesIO(); im.save(b, "WEBP", quality=q, method=5)
    return "data:image/webp;base64," + base64.b64encode(b.getvalue()).decode(), im.width, im.height

def raw(path, mime):
    """A file as data, for an animated WebP clip or an SVG chart."""
    return "data:%s;base64,%s" % (mime, base64.b64encode(open(path, "rb").read()).decode())

def fig(label, path, box=None, scale=1.0, note="", rec=False, width=None):
    src, w, h = img(path, box, scale)
    star = ' <span class="rec">recommended</span>' if rec else ""
    return '<figure style="max-width:%dpx"><div class="lab">%s%s</div><img src="%s" width="%d" height="%d" alt="%s" loading="lazy">%s</figure>' % (
        width or w, esc(label), star, src, w, h, esc(label), ("<figcaption>%s</figcaption>" % note) if note else "")

def svgfig(label, svg_text, note="", rec=False):
    """An inline SVG (a chart drawn by a tool) with the figure's label."""
    star = ' <span class="rec">recommended</span>' if rec else ""
    return '<figure><div class="lab">%s%s</div>%s%s</figure>' % (esc(label), star, svg_text, ("<figcaption>%s</figcaption>" % note) if note else "")

def row(*figs): return '<div class="row">%s</div>' % "".join(figs)
def p(t): return "<p>%s</p>" % t
def decide(rec, conf, regret): return '<dl class="dec"><dt>Recommendation</dt><dd>%s</dd><dt>Confidence</dt><dd>%s</dd><dt>Likely regret</dt><dd>%s</dd></dl>' % (rec, conf, regret)
def table(head, rows, cls="tbl"):
    return '<table class="%s"><thead><tr>%s</tr></thead><tbody>%s</tbody></table>' % (cls, "".join("<th>%s</th>" % h for h in head), "".join("<tr>%s</tr>" % "".join("<td>%s</td>" % c for c in r) for r in rows))

class Page:
    def __init__(self, title, lede=""):
        self.title, self.lede, self.parts, self.toc = title, lede, [], []
    def add(self, *parts): self.parts.extend(parts)
    def section(self, id_, title, *parts):
        self.toc.append((id_, title)); self.parts.append('<section id="%s"><h2>%s</h2>%s</section>' % (esc(id_), esc(title), "".join(parts)))
    def html(self):
        nav = "<nav>%s</nav>" % "".join('<a href="#%s">%s</a>' % (esc(i), esc(t)) for i, t in self.toc) if self.toc else ""
        return ('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>%s</title><style>%s</style></head>'
                '<body><main><h1>%s</h1>%s%s%s</main></body></html>') % (esc(self.title), CSS, esc(self.title), ('<p class="lede">%s</p>' % self.lede) if self.lede else "", nav, "".join(self.parts))
    def write(self, path):
        os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
        open(path, "w", encoding="utf-8").write(self.html()); return os.path.getsize(path)
