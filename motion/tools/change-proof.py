#!/usr/bin/env python3
"""What a change to the atlas changed, and nothing else (round 18, the author's request of 27 October 2026).

Given two served copies of the atlas, a base and a trial, the tool
- takes the page's texts in 144 states from both (tools/text-snapshot.js through tools/page-probe.py) at 1,600 and 400 px and
  lists every string that changed, grouped by the edit;
- checks every on-screen string for a semicolon, an em-dash or "listed", and names the hits the trial brings in apart from those
  the base already shows (tools/text-rules-allow.json holds the author's decided and pending exceptions);
- takes one set of frames from both (tools/atlas-frames.py, every shot with "settle", "wire" and "boxes", after a first shot per
  load that is not compared): both views on every layer, the Moscow preset, a hover per layer, a red mark, every card with its
  reading block, every chart that pops out, the footer, the REFERENCES panel and the legend's two sides, in both themes; at
  1,600 px, or at the five widths with --full. The layers, cards and charts come from the pages (__atlas.layers, cards() and the
  canvases that pop out), so a new layer or card is covered without an edit here;
- compares the frames pixel for pixel, finds the regions that differ, names the panels each touches, and says whether the map
  changed outside the panels drawn over it;
- writes summary.json and a crop sheet, proof.html (tools/review_page.py): the changed strings, then every differing frame's
  regions before and after.

Two runs of one build give "identical". Browsers start only above the lab's memory floors (config/lab.env), at most --jobs at
once, and each removes its profile (capture.remove_profile, inside the tools called).

Usage: python3 -I motion/tools/change-proof.py --base http://127.0.0.1:8783/explorer.html --trial http://127.0.0.1:8782/explorer.html
         --out motion/build/round-18/proof/NAME [--full | --widths 1600,400] [--themes dark,light] [--jobs 3] [--title TEXT]
         [--labels base,trial] [--reuse-base DIR] [--skip-text] [--skip-frames]"""
import argparse, difflib, html, json, os, re, shutil, subprocess, sys, threading, time
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
FULL = [400, 768, 1200, 1600, 2000]
HEIGHT = 1000                                          # the audit's height at every width
TEXT_SIZES = [(1600, 1000), (400, 1000)]
OVERLAYS = ['legend', 'mixbox', 'mapnote', 'scalebar', 'zoombox', 'ctxstrip', 'tip', 'popout', 'refs', 'agenttoast']   # panels drawn over the map
RULES = [('semicolon', re.compile(';')), ('em-dash', re.compile('—')), ('listed', re.compile(r'\blisted\b', re.I))]
BLOCK, GAP, MARGIN = 8, 2, 24                          # the difference grid (px), the blocks a region may skip, the crop's margin (px)
INFO_JS = """(() => { const A = window.__atlas; return { layers: A.layers, cards: Object.keys(A.cards()),
  pops: [...document.querySelectorAll('canvas[role="button"]')].map(c => { const k = c.closest('[id^="card-"]'); return k ? [k.id.slice(5), c.id] : null; }).filter(Boolean) }; })()"""
# Every shot starts from the same state whatever the shot before it opened: REFERENCES and the pop-out closed, every reading
# block closed, the side column and the page at their top, nothing focused. The legend is reset by each shot (legend(null) is
# the page's default; legendSide does not write the remembered choice).
RESET = ("A.refs(false); document.getElementById('popout').click(); "
         "for (const b of document.querySelectorAll('.btn.info[aria-expanded=\"true\"]')) b.click(); "
         "{ const sd = document.querySelector('.side'); if (sd) sd.scrollTop = 0; } window.scrollTo(0, 0); "
         "if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); ")

def lab_root():
    try: return subprocess.check_output(["git", "-C", HERE, "rev-parse", "--show-toplevel"], text=True, stderr=subprocess.DEVNULL).strip()
    except Exception: return os.path.normpath(os.path.join(HERE, "..", ".."))

def floors():   # MemAvailable and SwapFree floors in MiB, from config/lab.env as scripts/lab-run.sh reads them
    f = {"LAB_MEMAVAILABLE_MIN_MIB": 5120, "LAB_SWAPFREE_MIN_MIB": 1024}
    try:
        for line in open(os.path.join(lab_root(), "config", "lab.env")):
            m = re.match(r"^(LAB_MEMAVAILABLE_MIN_MIB|LAB_SWAPFREE_MIN_MIB)=(\d+)", line.strip())
            if m: f[m.group(1)] = int(m.group(2))
    except OSError: pass
    return f["LAB_MEMAVAILABLE_MIN_MIB"], f["LAB_SWAPFREE_MIN_MIB"]

def meminfo():
    m = {}
    for line in open("/proc/meminfo"):
        k, v = line.split(":", 1); m[k] = int(v.split()[0]) // 1024
    return m["MemAvailable"], m["SwapFree"]

class Runner:
    """Subprocesses, at most `jobs` at once, each launched only above the memory floors and a few seconds after the last."""
    def __init__(self, jobs):
        self.sem, self.lock, self.last, self.floors = threading.Semaphore(jobs), threading.Lock(), 0.0, floors()
    def run(self, cmd, out, err):
        with self.sem:
            with self.lock:
                time.sleep(max(0.0, self.last + 3 - time.time())); t0 = time.time()
                while True:
                    ma, sf = meminfo()
                    if ma >= self.floors[0] and sf >= self.floors[1]: break
                    if time.time() - t0 > 1800: raise SystemExit("change-proof: the memory floors were not met for 30 minutes (MemAvailable %d, SwapFree %d MiB)" % (ma, sf))
                    time.sleep(5)
                self.last = time.time()
            with open(out, "w") as fo, open(err, "w") as fe:
                return subprocess.run(cmd, stdout=fo, stderr=fe).returncode

def probe_cmd(url, js_file=None, js=None, w=1600, h=HEIGHT):
    return [sys.executable, "-I", os.path.join(HERE, "page-probe.py"), "--url", url, "--width", str(w), "--height", str(h)] + (["--js-file", js_file] if js_file else ["--js", js])

def read_probe(path):   # the probe's result and the page's errors; None and a problem when the probe printed no JSON (its .err file says why)
    try: d = json.load(open(path, encoding="utf-8"))
    except (OSError, ValueError): return None, ["the probe gave no result (see %s.err)" % os.path.basename(path)]
    return d.get("result"), d.get("problems") or []

# ---- texts ------------------------------------------------------------------------------------------------------------------------
def flatten(o, path="", out=None):
    out = {} if out is None else out
    if isinstance(o, dict):
        for k in o: flatten(o[k], path + "/" + str(k), out)
    elif isinstance(o, list):
        for i, v in enumerate(o): flatten(v, path + "/" + str(i), out)
    elif isinstance(o, str): out[path] = o
    elif o is not None: out[path] = json.dumps(o)
    return out

def fragments(x, y):   # the edit itself, word by word, so one edit repeated over many states is one group
    if x is None or y is None: return (("(absent)" if x is None else x[:300], "(absent)" if y is None else y[:300]),)
    wa, wb = re.findall(r"\S+|\s+", x), re.findall(r"\S+|\s+", y)
    ops = difflib.SequenceMatcher(None, wa, wb, autojunk=False).get_opcodes()
    return tuple(("".join(wa[i1:i2]), "".join(wb[j1:j2])) for op, i1, i2, j1, j2 in ops if op != "equal")

def text_changes(a, b):
    fa, fb, groups = flatten(a), flatten(b), {}
    for p in sorted(set(fa) | set(fb)):
        x, y = fa.get(p), fb.get(p)
        if x == y: continue
        g = groups.setdefault(fragments(x, y), {"paths": [], "before": x, "after": y})
        g["paths"].append(p)
    return [dict(edits=[list(e) for e in k], **v) for k, v in groups.items()]

def rule_hits(flat, allow):
    hits = {}
    for p, s in flat.items():
        for name, rx in RULES:
            for m in rx.finditer(s):
                ok = next((e for e in allow if e["rule"] == name and any(a.start() <= m.start() < a.end() for a in re.finditer(e["pattern"], s))), None)
                ctx = s[max(0, m.start() - 60): m.end() + 40].replace("\n", " ")
                h = hits.setdefault(name + "\u0000" + ctx, {"rule": name, "context": ctx, "paths": [], "status": ok and ok["status"], "why": ok and ok["why"]})
                h["paths"].append(p)
    return hits

# ---- frames -----------------------------------------------------------------------------------------------------------------------
def shot_list(layers, cards, pops, themes):
    out = []
    for theme in themes:
        n = [0]
        def sh(slug, js="", read=False, **kw):
            d = dict(mode="cells", layer="share", year=2024, preset="Russia"); d.update(kw)
            leg = "A.legendSide(%s); " % ("true" if read else "false")
            if not d.get("legend"): leg = "A.legend(null); " + leg
            name = "s00-%s" % slug if slug.startswith("warm") else "%02d-%s" % (n[0], slug)
            n[0] += 1
            d.update(name=name + "-" + theme, theme=theme, settle=1.0, wire=600, boxes=True, js=RESET + leg + js)
            out.append(d)
        for i, L in enumerate(("density", "share", "change")): sh("warm%d" % (i + 1), layer=L)   # the first shots after a load are not compared: the wire's glyphs settle over the first two (round 18: one warm-up left two frames differing in the wire between runs)
        for mode in ("cells", "firms"):
            for L in layers: sh("%s-%s" % (mode, L), mode=mode, layer=L, need={"layer": L})
        sh("moscow-cells-share", preset="Moscow"); sh("moscow-firms-industry", mode="firms", layer="industry", preset="Moscow", need={"layer": "industry"})
        for L in layers: sh("hover-%s" % L, layer=L, hover="city", city="Moscow", need={"layer": L})
        sh("firms-red", mode="firms", preset="Moscow", hover="red")
        for c in cards:
            sh("card-%s" % c, js="{ const k = document.getElementById('card-%s'), b = k && k.querySelector('.btn.info'); if (b && b.getAttribute('aria-expanded') !== 'true') b.click(); if (k) k.scrollIntoView({ block: 'start' }); }" % c, need={"card": c})
        for c, cid in pops:
            sh("pop-%s" % c, hover="city", city="Moscow", need={"pop": cid},
               js="{ const c = document.getElementById('%s'), k = c && c.closest('[id^=\"card-\"]'); if (k) k.scrollIntoView({ block: 'start' }); if (c) c.click(); }" % cid)
        sh("footer", js="document.querySelector('footer').scrollIntoView({ block: 'end' });")
        sh("refs", js="A.refs(true); await new Promise(q => setTimeout(q, 400));")
        sh("legend-key", legend=True); sh("legend-read", legend=True, read=True)
    return out

def frames_cmd(url, outdir, width, shots):
    os.makedirs(outdir, exist_ok=True)
    sf = os.path.join(outdir, "shots.json"); json.dump([{k: v for k, v in s.items() if k != "need"} for s in shots], open(sf, "w"), indent=1)
    return [sys.executable, "-I", os.path.join(HERE, "atlas-frames.py"), "--url", url, "--out", outdir, "--width", str(width), "--height", str(HEIGHT), "--shots", sf]

def load_boxes(path):
    try: return json.load(open(path))
    except (OSError, ValueError): return {}

def diff(pa, pb, ba, bb):
    from PIL import Image, ImageChops
    A, B = Image.open(pa).convert("RGB"), Image.open(pb).convert("RGB")
    if A.size != B.size: return {"pixels": -1, "size": [A.size, B.size], "regions": [], "panels": [], "map": True}
    dr, dg, db = ImageChops.difference(A, B).split(); m = ImageChops.lighter(ImageChops.lighter(dr, dg), db).point(lambda v: 255 if v else 0)   # any channel that differs: a grey conversion hid a one-step change in one channel (the review of 27 October 2026)
    n = m.histogram()[255]
    if not n: return {"pixels": 0, "regions": [], "panels": [], "map": False}
    g = m.reduce(BLOCK); gx = g.load(); on = {(x, y) for y in range(g.size[1]) for x in range(g.size[0]) if gx[x, y]}
    seen, regs = set(), []
    for c in sorted(on):
        if c in seen: continue
        stack, comp = [c], []; seen.add(c)
        while stack:
            x, y = stack.pop(); comp.append((x, y))
            for dx in range(-GAP - 1, GAP + 2):
                for dy in range(-GAP - 1, GAP + 2):
                    q = (x + dx, y + dy)
                    if q in on and q not in seen: seen.add(q); stack.append(q)
        xs, ys = [q[0] for q in comp], [q[1] for q in comp]
        regs.append([min(xs) * BLOCK, min(ys) * BLOCK, min(A.width, (max(xs) + 1) * BLOCK), min(A.height, (max(ys) + 1) * BLOCK)])
    vis = [(k, r) for src in (ba, bb) for k, r in src.items() if r.get("visible")]
    def touched(box):   # a region inside a panel drawn over everything else (REFERENCES, the notice, the pop-out, the tile) is that panel's alone, not the panels under it
        for t in ("refs", "agenttoast", "popout", "tip"):
            for k, r in vis:
                if k == t and r["x"] - BLOCK <= box[0] and r["y"] - BLOCK <= box[1] and box[2] <= r["x1"] + BLOCK and box[3] <= r["y1"] + BLOCK: return {k}
        return {k for k, r in vis if box[0] < r["x1"] and box[2] > r["x"] and box[1] < r["y1"] and box[3] > r["y"]}
    panels = sorted(set().union(*[touched(b) for b in regs])) if regs else []
    maps = [r for k, r in vis if k == "map"]; over = [r for k, r in vis if k in OVERLAYS]
    inside = lambda r, x, y: r["x"] <= x < r["x1"] and r["y"] <= y < r["y1"]
    mp, changed = m.load(), False
    for (bx, by) in on:   # the map changed when a differing pixel lies on it outside every panel drawn over it
        for y in range(by * BLOCK, min(A.height, by * BLOCK + BLOCK)):
            for x in range(bx * BLOCK, min(A.width, bx * BLOCK + BLOCK)):
                if mp[x, y] and any(inside(r, x + 0.5, y + 0.5) for r in maps) and not any(inside(r, x + 0.5, y + 0.5) for r in over): changed = True; break
            if changed: break
        if changed: break
    return {"pixels": n, "regions": regs, "panels": panels, "map": changed, "size": list(A.size)}

def crops(regs, w, h):   # each region with a margin, overlapping ones merged
    boxes = [[max(0, r[0] - MARGIN), max(0, r[1] - MARGIN), min(w, r[2] + MARGIN), min(h, r[3] + MARGIN)] for r in regs]
    merged = True
    while merged:
        merged = False
        for i in range(len(boxes)):
            for j in range(i + 1, len(boxes)):
                a, b = boxes[i], boxes[j]
                if a[0] < b[2] and b[0] < a[2] and a[1] < b[3] and b[1] < a[3]:
                    boxes[i] = [min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3])]; del boxes[j]; merged = True; break
            if merged: break
    return sorted(boxes, key=lambda b: (b[1], b[0]))

# ---- the sheet --------------------------------------------------------------------------------------------------------------------
def mark(edits, side):
    return " … ".join(('<del>%s</del>' if side == 0 else '<ins>%s</ins>') % html.escape(e[side] or "(nothing)") for e in edits[:6]) + (" …" if len(edits) > 6 else "")

def write_sheet(path, title, summary, frames_dir, labels):
    from review_page import Page, fig, row, table, p
    s = summary; pg = Page(title, "Base %s, trial %s. %s" % (html.escape(s["base"]), html.escape(s["trial"]), html.escape(s["verdict"])))
    rows = []
    for w, groups in s.get("text", {}).items():
        for g in groups:
            rows.append([w, str(len(g["paths"])), html.escape(g["paths"][0]), mark(g["edits"], 0), mark(g["edits"], 1)])
    pg.section("text", "Texts", p("%d groups of changed strings (an edit repeated over many states is one group)." % len(rows)) + (table(["width", "states", "first state", "before", "after"], rows) if rows else ""))
    rr = [[h["rule"], html.escape(h["context"]), str(len(h["paths"])), html.escape(h["paths"][0]), html.escape(h.get("status") or "new")] for h in s.get("rules", {}).get("new", [])]
    pg.section("rules", "Text rules", p("Hits the trial brings in (semicolon, em-dash, \"listed\"): %d. Hits the base already shows: %d (%d of them on the allow list)." % (len(rr), s.get("rules", {}).get("base", 0), s.get("rules", {}).get("base_allowed", 0))) + (table(["rule", "context", "states", "first state", "status"], rr) if rr else ""))
    parts = [p("%d frames compared, %d identical, %d differ, %d only in one build." % (s["frames"]["compared"], s["frames"]["identical"], len(s["frames"]["differ"]), len(s["frames"]["unpaired"])))]
    for d in s["frames"]["differ"][:150]:
        a = os.path.join(frames_dir, labels[0], "w%d" % d["width"], d["name"] + ".png"); b = os.path.join(frames_dir, labels[1], "w%d" % d["width"], d["name"] + ".png")
        head = "<h3>%s · %d px · %s px differ · %s%s</h3>" % (html.escape(d["name"]), d["width"], format(d["pixels"], ","), html.escape(", ".join(d["panels"]) or "no panel"), " · the map changed" if d["map"] else "")
        figs = []
        for bx in crops(d["regions"], *d["size"])[:4]:
            sc = min(1.0, 560.0 / max(1, bx[2] - bx[0]))
            figs.append(row(fig("before", a, box=tuple(bx), scale=sc), fig("after", b, box=tuple(bx), scale=sc)))
        parts.append(head + "".join(figs))
    for u in s["frames"]["unpaired"][:40]:
        f = os.path.join(frames_dir, u["label"], "w%d" % u["width"], u["name"] + ".png")
        if os.path.exists(f): parts.append("<h3>%s · %d px · only in %s</h3>" % (html.escape(u["name"]), u["width"], html.escape(u["label"])) + row(fig(u["label"], f, scale=0.4)))
    pg.section("frames", "Frames", *parts)
    return pg.write(path)

# ---- main -------------------------------------------------------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--base", required=True); ap.add_argument("--trial", required=True); ap.add_argument("--out", required=True)
    ap.add_argument("--full", action="store_true"); ap.add_argument("--widths", default=None); ap.add_argument("--themes", default="dark,light")
    ap.add_argument("--jobs", type=int, default=3); ap.add_argument("--title", default="Change proof"); ap.add_argument("--labels", default="base,trial")
    ap.add_argument("--reuse-base", default=None, help="an earlier run's --out: its base texts and frames are reused when its shots match")
    ap.add_argument("--skip-text", action="store_true"); ap.add_argument("--skip-frames", action="store_true")
    ap.add_argument("--compare-only", action="store_true", help="take nothing: compare the texts and frames an earlier run left in --out again")
    a = ap.parse_args()
    labels = a.labels.split(","); urls = dict(zip(labels, [a.base, a.trial]))
    widths = FULL if a.full else [int(w) for w in (a.widths or "1600").split(",")]
    out = os.path.abspath(a.out); os.makedirs(out, exist_ok=True); logs = os.path.join(out, "logs"); os.makedirs(logs, exist_ok=True)
    run = Runner(a.jobs); t0 = time.time()
    allow = json.load(open(os.path.join(HERE, "text-rules-allow.json"), encoding="utf-8"))["allow"]
    summary = {"base": a.base, "trial": a.trial, "labels": labels, "widths": widths, "text": {}, "problems": {}}

    # what each page carries (the shot list follows the union, so a layer or card new in the trial gets its frames)
    info = {}
    if not a.compare_only:
        with ThreadPoolExecutor(2) as ex:
            fut = {lb: ex.submit(run.run, probe_cmd(u, js=INFO_JS), os.path.join(logs, "info-%s.json" % lb), os.path.join(logs, "info-%s.err" % lb)) for lb, u in urls.items()}
            for lb, f in fut.items(): f.result()
    for lb in labels:
        info[lb] = read_probe(os.path.join(logs, "info-%s.json" % lb))[0]
        if not info[lb]: raise SystemExit("change-proof: no layer and card list from %s (%s); is it served?" % (urls[lb], os.path.join(logs, "info-%s.err" % lb)))
    u = lambda key: [x for x in info[labels[0]][key]] + [x for x in info[labels[1]][key] if x not in info[labels[0]][key]]
    layers, cards, pops = u("layers"), u("cards"), [tuple(x) for x in u("pops")]
    has = {lb: {"layer": set(info[lb]["layers"]), "card": set(info[lb]["cards"]), "pop": {x[1] for x in info[lb]["pops"]}} for lb in labels}

    reuse = os.path.abspath(a.reuse_base) if a.reuse_base else None
    if reuse:   # an earlier run's base files are reused only when that run served the same URL under the same label (the build behind it is trusted not to have changed)
        if reuse == out: raise SystemExit("change-proof: --reuse-base names an earlier run's folder, not --out")
        try: rs = json.load(open(os.path.join(reuse, "summary.json"), encoding="utf-8")); served = dict(zip(rs["labels"], [rs["base"], rs["trial"]]))
        except (OSError, ValueError, KeyError): served = {}
        if served.get(labels[0]) != a.base: print("change-proof: %s did not serve %s as %r; nothing reused" % (reuse, a.base, labels[0])); reuse = None
    tasks = []
    if not a.skip_text:
        for (w, h) in TEXT_SIZES:
            for lb in labels:
                dst = os.path.join(out, "text-%s-%d.json" % (lb, w)); src = reuse and os.path.join(reuse, "text-%s-%d.json" % (lb, w))
                if lb == labels[0] and src and os.path.exists(src): shutil.copyfile(src, dst); continue
                tasks.append((probe_cmd(urls[lb], js_file=os.path.join(HERE, "text-snapshot.js"), w=w, h=h), dst, dst + ".err"))
    shots = shot_list(layers, cards, pops, a.themes.split(","))
    if not a.skip_frames:
        for w in widths:
            for lb in labels:
                dst = os.path.join(out, "frames", lb, "w%d" % w); src = reuse and os.path.join(reuse, "frames", lb, "w%d" % w)
                if lb == labels[0] and src and os.path.exists(os.path.join(src, "shots.json")):
                    old = json.load(open(os.path.join(src, "shots.json"))); new = [{k: v for k, v in s.items() if k != "need"} for s in shots]
                    if old == new and len([f for f in os.listdir(src) if f.endswith(".png")]) == len(shots):
                        if os.path.exists(dst): shutil.rmtree(dst)
                        shutil.copytree(src, dst); continue
                tasks.append((frames_cmd(urls[lb], dst, w, shots), os.path.join(logs, "frames-%s-%d.log" % (lb, w)), os.path.join(logs, "frames-%s-%d.err" % (lb, w))))
    if a.compare_only: tasks = []
    with ThreadPoolExecutor(max(1, len(tasks))) as ex:
        codes = list(ex.map(lambda t: run.run(*t), tasks))
    failed = [t[1] for t, c in zip(tasks, codes) if c != 0]
    if failed: summary["failed"] = failed

    if not a.skip_text:
        new_hits, base_n, base_allowed = [], 0, 0
        for (w, h) in TEXT_SIZES:
            ra, pa = read_probe(os.path.join(out, "text-%s-%d.json" % (labels[0], w))); rb, pb = read_probe(os.path.join(out, "text-%s-%d.json" % (labels[1], w)))
            if ra is None or rb is None: summary.setdefault("failed", []).append("the text snapshot at %d px" % w); continue
            summary["text"][str(w)] = text_changes(ra, rb)
            if pa or pb: summary["problems"]["text-%d" % w] = {labels[0]: pa, labels[1]: pb}
            ha, hb = rule_hits(flatten(ra), allow), rule_hits(flatten(rb), allow)
            if w == TEXT_SIZES[0][0]: base_n, base_allowed = len(ha), sum(1 for v in ha.values() if v["status"])
            new_hits += [dict(v, width=w) for k, v in hb.items() if k not in ha]
        summary["rules"] = {"new": new_hits, "base": base_n, "base_allowed": base_allowed}

    fr = {"compared": 0, "identical": 0, "differ": [], "unpaired": []}
    if not a.skip_frames:
        for w in widths:
            for s in shots:
                if s["name"].startswith("s00-"): continue
                need = s.get("need") or {}
                miss = [lb for lb in labels if any(v not in has[lb][k] for k, v in need.items())]
                pa = os.path.join(out, "frames", labels[0], "w%d" % w, s["name"] + ".png"); pb = os.path.join(out, "frames", labels[1], "w%d" % w, s["name"] + ".png")
                if miss or not (os.path.exists(pa) and os.path.exists(pb)):
                    for lb in labels:
                        if lb not in miss: fr["unpaired"].append({"name": s["name"], "width": w, "label": lb})
                    continue
                d = diff(pa, pb, load_boxes(pa[:-4] + ".boxes.json"), load_boxes(pb[:-4] + ".boxes.json")); fr["compared"] += 1
                if d["pixels"] == 0: fr["identical"] += 1
                else: fr["differ"].append(dict(d, name=s["name"], width=w))
    summary["frames"] = fr

    nt = sum(len(g) for g in summary["text"].values()); nr = len(summary.get("rules", {}).get("new", []))
    np_ = sum(len(v) for p_ in summary["problems"].values() for v in p_.values())   # the pages' errors and console warnings during the text walk
    scope = "texts and frames" if not (a.skip_text or a.skip_frames) else "texts only" if a.skip_frames else "frames only"
    if not nt and not fr["differ"] and not fr["unpaired"] and not nr and not np_ and not summary.get("failed"): verdict = "identical: no string, no frame and no rule hit differs" + ("" if scope == "texts and frames" else " (%s compared)" % scope)
    else:
        panels = sorted({x for d in fr["differ"] for x in d["panels"]})
        verdict = "differs: %d text groups; %d of %d frames differ%s; panels %s; the map outside its panels %s; new rule hits %d%s" % (
            nt, len(fr["differ"]), fr["compared"], (", %d only in one build" % len(fr["unpaired"])) if fr["unpaired"] else "", ", ".join(panels) or "none",
            "changed" if any(d["map"] for d in fr["differ"]) else "unchanged", nr, ("; page errors %d" % np_ if np_ else "") + (("; FAILED runs: " + ", ".join(summary["failed"])) if summary.get("failed") else ""))
    summary["verdict"] = verdict; summary["seconds"] = round(time.time() - t0)
    json.dump(summary, open(os.path.join(out, "summary.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    size = write_sheet(os.path.join(out, "proof.html"), a.title, summary, os.path.join(out, "frames"), labels)
    print("change-proof: %s (%d s); sheet %s, %.1f MB" % (verdict, summary["seconds"], os.path.join(out, "proof.html"), size / 1e6))
    return 0 if verdict.startswith("identical") else 1

if __name__ == "__main__":
    sys.exit(main())
