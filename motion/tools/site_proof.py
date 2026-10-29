#!/usr/bin/env python3
"""The site's proof (the author's pick B3, 29 October 2026): what a change to the site changed, and nothing else.

Run through site-check.py --base COMMIT [--trial COMMIT]. The base comes from the site's git history and the trial from its working tree
(or a second commit), both without atlas/, which has its own proof (change-proof.py). Each build is served and shot in headless Brave in
the same states: the home page at 1920x1080, 1440x900 and 1280x800 at rest, with the atlas and the contact previews, with the slogan's
card, and with keyboard focus on the first row; the pointer under the last row at 1920x1080; the home page stacked on a phone and on a
tablet both ways; the film, research, writing and contact pages at 1440x900 and on a phone, with a link, HOME and a chapter under the
pointer and keyboard focus on the film page; the 404 page. The page clock is fixed (performance.now and requestAnimationFrame), so the
data stream draws the same frame in both builds, and the film's player controls are hidden in both, since their loading state differs
between any two loads.

Frames are compared pixel for pixel. Each differing region is named by the smallest page element that holds its centre (the name, the
headshot, an index row, the slogan's card, the stream, a page's text). The run writes summary.json and proof.html (tools/review_page.py:
every differing region before and after) into motion/build/site-proof/<UTC time>/ and prints "identical" or the frames and regions that
differ. Brave only: the check in both engines stays site-check.py without --base. Brave's profile is removed when it finishes."""
import base64, functools, http.server, json, os, shutil, subprocess, sys, tempfile, threading, time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

CLOCK = """(() => { let T = 1000; performance.now = () => T; const q = [];
  window.requestAnimationFrame = cb => { q.push(cb); return q.length; }; window.cancelAnimationFrame = () => {};
  window.__step = t => { T = t; const cbs = q.splice(0); cbs.forEach(cb => cb(T)); return T; }; })();"""
# The elements a region is named by, smallest first wins: (name, selector).
NAMED = [("name", "h1"), ("rule", "hr"), ("headshot", ".portrait"), ("bio", ".lede p"), ("index row", ".index a"), ("index", ".index"),
         ("photo", ".photo > img"), ("preview", ".photo .pv.live, .photo[data-show] .pv"), ("slogan card", ".gloss"), ("caption bar", ".photo .bar"),
         ("stream", "canvas.stream"), ("image panel", ".visual"), ("text", ".page .body p"), ("link row", ".links li"), ("film", "video"),
         ("chapter", ".chapters li"), ("home link", ".homelink"), ("page", "main")]
BOXES_JS = """(named => { const out = []; for (const [name, sel] of named) { const els = [...document.querySelectorAll(sel)];
  els.forEach((e, i) => { const r = e.getBoundingClientRect(); if (!r.width || !r.height) return;
    const tag = e.dataset && e.dataset.k ? ' ' + e.dataset.k : els.length > 1 ? ' ' + (i + 1) : '';
    out.push([name + tag, r.left + scrollX, r.top + scrollY, r.right + scrollX, r.bottom + scrollY]); }); } return out; })(%s)"""

SPLIT = [("1920", 1920, 1080), ("1440", 1440, 900), ("1280", 1280, 800)]
def jobs():   # (name, path, width, height, density, phone, whole page, actions)
    j = []
    for tag, w, h in SPLIT:
        j += [("home-%s" % tag, "", w, h, 1, False, False, []),
              ("home-%s-atlas-preview" % tag, "", w, h, 1, False, False, [("hover", ".index a[data-k=atlas] .label")]),
              ("home-%s-contact-preview" % tag, "", w, h, 1, False, False, [("hover", ".index a[data-k=contact] .label")]),
              ("home-%s-slogan" % tag, "", w, h, 1, False, False, [("hover", ".photo > img")]),
              ("home-%s-focus" % tag, "", w, h, 1, False, False, [("tab", 1)])]
    j += [("home-1920-below-last-row", "", 1920, 1080, 1, False, False, [("hover", ".index a[data-k=contact] .label"), ("below", ".index a[data-k=contact]")]),
          ("home-phone", "", 390, 844, 2, True, True, []), ("home-tablet", "", 820, 1180, 1, True, True, []), ("home-tablet-landscape", "", 1180, 820, 1, True, True, [])]
    for p in ("film", "research", "writing", "contact"):
        j += [("%s-1440" % p, p + "/", 1440, 900, 1, False, False, []), ("%s-phone" % p, p + "/", 390, 844, 2, True, True, [])]
    j += [("contact-1440-link", "contact/", 1440, 900, 1, False, False, [("hover", ".links li:nth-child(2) a")]),
          ("contact-1440-home", "contact/", 1440, 900, 1, False, False, [("hover", ".homelink")]),
          ("film-1440-chapter", "film/", 1440, 900, 1, False, False, [("hover", ".chapters li:nth-child(9) button")]),
          ("film-1440-focus", "film/", 1440, 900, 1, False, False, [("tab", 2)]),
          ("notfound-1440", "404.html", 1440, 900, 1, False, False, []), ("notfound-phone", "404.html", 390, 844, 2, True, True, [])]
    return j


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass


class Server(http.server.ThreadingHTTPServer):
    def handle_error(self, request, client_address):   # a request the browser dropped on leaving the page (the film's file) is no error
        if not isinstance(sys.exc_info()[1], (ConnectionResetError, BrokenPipeError)): super().handle_error(request, client_address)


def build(site, ref, dest):   # a commit's files without atlas/, or None for the working tree as it is
    if ref in (None, "", "worktree"): return os.path.abspath(site)
    os.makedirs(dest)
    arc = subprocess.run(["git", "-C", site, "archive", ref], capture_output=True, check=True).stdout
    subprocess.run(["tar", "-x", "-C", dest, "--exclude=atlas"], input=arc, check=True)
    return dest


def shoot(cdp, base_url, root, out, j):
    name, path, w, h, dpr, mobile, full, actions = j
    if not os.path.exists(os.path.join(root, path, "index.html") if not path.endswith(".html") else os.path.join(root, path)):
        return None   # the page is not in this build
    cdp.call("Emulation.setDeviceMetricsOverride", {"width": w, "height": h, "deviceScaleFactor": dpr, "mobile": mobile})
    cdp.call("Emulation.setTouchEmulationEnabled", {"enabled": mobile, "maxTouchPoints": 5 if mobile else 1})
    if not mobile: cdp.call("Input.dispatchMouseEvent", {"type": "mouseMoved", "x": w - 1, "y": 0})
    cdp.call("Page.navigate", {"url": "about:blank"}); time.sleep(0.1)
    cdp.call("Page.navigate", {"url": base_url + path}); cdp.wait_event("Page.loadEventFired", timeout=60)
    cdp.evaluate("document.fonts.ready.then(() => new Promise(r => setTimeout(r, 400)))", await_promise=True)
    if full:   # the whole page in the window before the clock steps, so the stream below the first screen runs in both builds
        for _ in range(3):
            ht = cdp.evaluate("Math.ceil(document.documentElement.scrollHeight)")
            cdp.call("Emulation.setDeviceMetricsOverride", {"width": w, "height": ht, "deviceScaleFactor": dpr, "mobile": mobile}); time.sleep(0.3)
            if cdp.evaluate("Math.ceil(document.documentElement.scrollHeight)") == ht: break
    cdp.evaluate("document.querySelectorAll('video').forEach(v => v.removeAttribute('controls')); window.__step && window.__step(5000)")
    T = 5000
    for kind, arg in actions:
        if kind == "tab":
            for _ in range(arg):
                for t in ("keyDown", "keyUp"): cdp.call("Input.dispatchKeyEvent", {"type": t, "key": "Tab", "code": "Tab", "windowsVirtualKeyCode": 9})
        else:
            r = cdp.evaluate("(() => { const r = document.querySelector(%s).getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; })()" % json.dumps(arg))
            cdp.call("Input.dispatchMouseEvent", {"type": "mouseMoved", "x": (r[0] + r[2]) / 2, "y": (r[1] + r[3]) / 2 if kind == "hover" else r[3] + 40})
        for _ in range(12):
            T += 40; cdp.evaluate("window.__step && window.__step(%d)" % T)
    time.sleep(0.35)   # the previews' 0.15 s fade
    args = {"format": "png"}
    png = os.path.join(out, name + ".png")
    open(png, "wb").write(base64.b64decode(cdp.call("Page.captureScreenshot", args)["data"]))
    return {"png": png, "dpr": dpr, "boxes": cdp.evaluate(BOXES_JS % json.dumps(NAMED))}


def regions(a, b, block=8):   # the differing pixels as boxes on an 8 px grid, cells up to 3 apart merged
    from PIL import Image, ImageChops
    diff = ImageChops.difference(a, b).convert("L").point(lambda v: 255 if v else 0)
    if not diff.getbbox(): return 0, []
    small = diff.resize((max(1, a.size[0] // block), max(1, a.size[1] // block)), Image.BOX); sp = small.load()
    cells = {(x, y) for y in range(small.size[1]) for x in range(small.size[0]) if sp[x, y]}
    n = sum(1 for v in diff.getdata() if v) if not hasattr(diff, "get_flattened_data") else sum(1 for v in diff.get_flattened_data() if v)
    boxes = []
    while cells:
        stack = [cells.pop()]; grp = list(stack)
        while stack:
            cx, cy = stack.pop()
            for dx in range(-3, 4):
                for dy in range(-3, 4):
                    c = (cx + dx, cy + dy)
                    if c in cells: cells.remove(c); stack.append(c); grp.append(c)
        xs, ys = [c[0] for c in grp], [c[1] for c in grp]
        boxes.append([min(xs) * block, min(ys) * block, (max(xs) + 1) * block, (max(ys) + 1) * block])
    return n, sorted(boxes, key=lambda bx: (bx[1], bx[0]))


def name_of(box, shot):   # the smallest named element holding the region's centre, in CSS px
    cx, cy = (box[0] + box[2]) / 2 / shot["dpr"], (box[1] + box[3]) / 2 / shot["dpr"]
    hits = [(abs((e[3] - e[1]) * (e[4] - e[2])), e[0]) for e in shot["boxes"] if e[1] <= cx < e[3] and e[2] <= cy < e[4]]
    return min(hits)[1] if hits else "outside every named element"


def run(site, base_ref, trial_ref=None, out=None):
    from PIL import Image
    from capture import brave_flags, wait_port_file, page_ws_url, remove_profile
    from cdp import CDP
    import review_page as rp
    lab = os.path.dirname(os.path.dirname(HERE))
    out = out or os.path.join(lab, "motion", "build", "site-proof", time.strftime("%Y%m%dT%H%M%SZ", time.gmtime()))
    os.makedirs(out, exist_ok=True)
    t0 = time.time()
    labels = {"base": base_ref, "trial": trial_ref or "worktree"}
    roots = {"base": build(site, base_ref, os.path.join(out, "base-site")), "trial": build(site, trial_ref, os.path.join(out, "trial-site"))}
    servers, shots = {}, {"base": {}, "trial": {}}
    for k, root in roots.items():
        s = Server(("127.0.0.1", 0), functools.partial(Quiet, directory=root))
        threading.Thread(target=s.serve_forever, daemon=True).start(); servers[k] = s
    profile = tempfile.mkdtemp(prefix="site-proof-")
    proc = subprocess.Popen(brave_flags(profile, 1440, 900) + ["about:blank"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        cdp = CDP(page_ws_url(wait_port_file(profile, proc)))
        cdp.call("Page.enable"); cdp.call("Runtime.enable"); cdp.call("Network.enable"); cdp.call("Network.setCacheDisabled", {"cacheDisabled": True})
        cdp.call("Page.addScriptToEvaluateOnNewDocument", {"source": CLOCK})
        for k in ("base", "trial"):
            os.makedirs(os.path.join(out, k), exist_ok=True)
            url = "http://127.0.0.1:%d/" % servers[k].server_address[1]
            for j in jobs():
                shots[k][j[0]] = shoot(cdp, url, roots[k], os.path.join(out, k), j)
    finally:
        proc.terminate()
        try: proc.wait(10)
        except Exception: proc.kill()
        remove_profile(profile)
        for s in servers.values(): s.shutdown()
        for k in ("base", "trial"):
            d = os.path.join(out, k + "-site")
            if os.path.isdir(d): shutil.rmtree(d)

    frames, sections = [], []
    for name, *_ in jobs():
        b, t = shots["base"][name], shots["trial"][name]
        if not b or not t:
            frames.append({"frame": name, "state": "only in the " + ("trial" if t else "base") if (b or t) else "in neither"})
            if t: sections.append((name, rp.p("New in the trial."), rp.row(rp.fig("trial", t["png"], scale=0.5 / t["dpr"]))))
            continue
        A, B = Image.open(b["png"]).convert("RGB"), Image.open(t["png"]).convert("RGB")
        if A.size != B.size:
            frames.append({"frame": name, "state": "the page's height changed", "sizes": [A.size, B.size]})
            sections.append((name, rp.p("The page's height changed: %s to %s px." % (A.size[1] // b["dpr"], B.size[1] // t["dpr"])),
                             rp.row(rp.fig("base", b["png"], scale=0.4 / b["dpr"]), rp.fig("trial", t["png"], scale=0.4 / t["dpr"]))))
            continue
        n, boxes = regions(A, B)
        if not n:
            frames.append({"frame": name, "state": "identical"}); continue
        named = [{"box": bx, "element": name_of(bx, t)} for bx in boxes]
        frames.append({"frame": name, "state": "differs", "pixels": n, "regions": named})
        figs = []
        for r in named:
            m = 30; bx = r["box"]; box = (max(0, bx[0] - m), max(0, bx[1] - m), min(A.size[0], bx[2] + m), min(A.size[1], bx[3] + m))
            sc = min(1.0, 900 / max(1, box[2] - box[0])) if t["dpr"] == 1 else 0.5
            figs.append(rp.row(rp.fig("base: " + r["element"], b["png"], box=box, scale=sc), rp.fig("trial", t["png"], box=box, scale=sc)))
        sections.append((name, rp.p("%d pixels in %d regions." % (n, len(named))), *figs))
    differ = [f for f in frames if f["state"] != "identical"]
    verdict = ("identical: none of %d frames differs" % len(frames)) if not differ else "%d of %d frames differ" % (len(differ), len(frames))
    pg = rp.Page("Site proof", "Base %s, trial %s. %s (%.0f s)." % (labels["base"], labels["trial"], verdict, time.time() - t0))
    for i, (name, *parts) in enumerate(sections):
        pg.section("f%d" % i, name, *parts)
    pg.write(os.path.join(out, "proof.html"))
    json.dump({"base": labels["base"], "trial": labels["trial"], "verdict": verdict, "frames": frames, "seconds": round(time.time() - t0)},
              open(os.path.join(out, "summary.json"), "w"), indent=1)
    print("site proof, base %s, trial %s: %s (%.0f s)" % (labels["base"], labels["trial"], verdict, time.time() - t0))
    for f in differ:
        where = "; ".join(sorted({r["element"] for r in f.get("regions", [])})) or f["state"]
        print("  %-28s %s" % (f["frame"], where))
    print("sheet: " + os.path.join(out, "proof.html"))
    return 0
