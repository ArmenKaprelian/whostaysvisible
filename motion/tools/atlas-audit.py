#!/usr/bin/env python3
"""Text audit of the Visibility atlas at several panel widths.

Loads explorer.html?__audit=1 in headless Brave at each width, switches every layer (and three years
of the share layer), redraws, and tests the recorded text boxes per canvas: overlap (two visible
strings of different groups on the same canvas whose boxes intersect by more than 15% of the
smaller), offcanvas (a box outside its canvas), small (under --min-size px). Zero findings is the
acceptance rule.

Usage: atlas-audit.py --url http://127.0.0.1:8765/explorer.html [--widths 1200,1600,2000] [--height 1000]"""
import argparse, json, os, subprocess, sys, tempfile, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from capture import brave_flags, wait_port_file, page_ws_url
from cdp import CDP

def inter(a, b):
    w = min(a["x1"], b["x1"]) - max(a["x"], b["x"]); h = min(a["y1"], b["y1"]) - max(a["y"], b["y"])
    return w * h if w > 0 and h > 0 else 0.0

def area(a): return max(0.0, a["x1"] - a["x"]) * max(0.0, a["y1"] - a["y"])

def audit_boxes(boxes, canvases, min_size, overlap):
    out = []
    vis = [b for b in boxes if b["eff"] >= 0.05 and b["str"].strip()]
    for b in vis:
        c = canvases.get(b["scene"])
        if c and (b["x"] < -0.5 or b["y"] < -0.5 or b["x1"] > c["w"] + 0.5 or b["y1"] > c["h"] + 0.5):
            out.append(("offcanvas", b["scene"], b["str"]))
        if b["size"] < min_size:
            out.append(("small", b["scene"], "%s (%g px)" % (b["str"], b["size"])))
    for i in range(len(vis)):
        for j in range(i + 1, len(vis)):
            p, q = vis[i], vis[j]
            if p["scene"] != q["scene"] or (p["para"] is not None and p["para"] == q["para"]): continue
            x = inter(p, q)
            if x <= 0: continue
            small = min(area(p), area(q))
            if small > 0 and x / small > overlap: out.append(("overlap", p["scene"], "%s | %s" % (p["str"], q["str"])))
    return out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", required=True)
    ap.add_argument("--widths", default="1200,1600,2000")
    ap.add_argument("--height", type=int, default=1000)
    ap.add_argument("--min-size", type=float, default=11)
    ap.add_argument("--overlap", type=float, default=0.15)
    ap.add_argument("--out", default=None)
    a = ap.parse_args()
    url = a.url + ("&" if "?" in a.url else "?") + "__audit=1"
    findings = []; n_boxes = 0; n_states = 0
    for w in [int(x) for x in a.widths.split(",")]:
        profile = tempfile.mkdtemp(prefix="atlas-audit-")
        proc = subprocess.Popen(brave_flags(profile, w, a.height) + ["about:blank"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        try:
            port = wait_port_file(profile, proc); cdp = CDP(page_ws_url(port))
            cdp.call("Page.enable"); cdp.call("Runtime.enable")
            cdp.call("Emulation.setDeviceMetricsOverride", {"width": w, "height": a.height, "deviceScaleFactor": 1, "mobile": False})
            cdp.call("Page.navigate", {"url": url}); cdp.wait_event("Page.loadEventFired", timeout=60)
            cdp.evaluate("document.fonts.ready.then(() => true)", await_promise=True, timeout=60)
            time.sleep(0.5)
            layers = cdp.evaluate("window.__atlas.layers", await_promise=False)
            def state(layer, year, setup, tag):
                nonlocal n_boxes, n_states
                r = cdp.evaluate("(() => { %s window.__atlas.layer(%r); window.__atlas.year(%d); const boxes = window.__atlas.redraw(); return { boxes, canvases: window.__atlasCanvases }; })()" % (setup, layer, year), await_promise=False)
                n_boxes += len(r["boxes"]); n_states += 1
                for kind, scene, key in audit_boxes(r["boxes"], r["canvases"], a.min_size, a.overlap):
                    findings.append("%-9s width %d  %-7s %-5s %-6s %-10s %s" % (kind, w, layer, year, tag, scene, key))
            for layer in layers:
                for year in ([2014, 2021, 2025] if layer == "share" else [2021]):
                    state(layer, year, "window.__atlas.preset('Russia');", "-")
            # hovered states: the Moscow 100 km cell at the national view; at the Moscow preset a 1 km cell with firms and a point 300 m north-west of it (a gap or a neighbour); a 5 km density cell
            M = "const m = window.__atlas.cities.Moscow;"
            state("share", 2021, M + "window.__atlas.preset('Russia'); window.__atlas.hoverKm(m[0], m[1]);", "h100")
            state("share", 2021, M + "window.__atlas.preset('Moscow'); window.__atlas.hoverKm(m[0], m[1]);", "h1km")
            state("share", 2021, M + "window.__atlas.preset('Moscow'); window.__atlas.hoverKm(m[0] - 0.3, m[1] + 0.3);", "h1km2")
            state("share", 2023, M + "window.__atlas.preset('Moscow'); window.__atlas.hoverKm(m[0], m[1]);", "h1km")
            state("density", 2021, M + "window.__atlas.preset('Russia'); window.__atlas.hoverKm(m[0], m[1]);", "h5km")
            state("density", 2021, M + "window.__atlas.preset('Central Moscow (250 m)'); window.__atlas.hoverKm(m[0], m[1]);", "h250")
        finally:
            proc.terminate()
    head = "atlas audit: %d states, %d boxes, %d finding(s)" % (n_states, n_boxes, len(findings))
    text = "\n".join([head] + sorted(set(findings))) + "\n"
    if a.out:
        with open(a.out, "w") as fh: fh.write(text)
    sys.stdout.write(text)
    return 1 if findings else 0

if __name__ == "__main__":
    sys.exit(main())
