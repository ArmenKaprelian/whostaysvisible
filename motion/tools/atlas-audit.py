#!/usr/bin/env python3
"""Audit of the Visibility atlas at several panel widths.

Loads explorer.html?__audit=1 in headless Brave at each width, switches every layer (and three years
of the share layer), redraws, and tests three things. (1) The recorded text boxes per canvas: overlap
(two visible strings of different groups on the same canvas whose boxes intersect by more than 15% of
the smaller), offcanvas (a box outside its canvas), small (under --min-size px). (2) The HTML overlays
on the map (the legend, the note, the zoom box, the scale bar): none may leave the map box or overlap
another, and a shown tooltip must stay inside the map (24 October 2026). (3) The camera after the click ladder, the zoom buttons
and the presets, through the page's instant API. Zero findings is the acceptance rule.

Usage: atlas-audit.py --url http://127.0.0.1:8765/explorer.html [--widths 400,768,1200,1600,2000] [--height 1000]"""
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

def audit_dom(dom):
    """The visible overlays must lie inside the map (0.5 px tolerance); the panels must never intersect one
    another. The tooltip follows the cursor and sits above the panels, so it is held inside the map but not
    counted against them."""
    out = []; m = dom["map"]
    names = [n for n in ("legend", "note", "zoom", "scale", "tip") if dom.get(n) and dom[n]["visible"]]
    panels = [n for n in names if n != "tip"]
    for n in names:
        b = dom[n]
        if b["x"] < m["x"] - 0.5 or b["y"] < m["y"] - 0.5 or b["x1"] > m["x1"] + 0.5 or b["y1"] > m["y1"] + 0.5:
            out.append(("offmap", "dom", "%s %s" % (n, json.dumps({k: round(b[k], 1) for k in ("x", "y", "x1", "y1")}))))
    for i in range(len(panels)):
        for j in range(i + 1, len(panels)):
            if inter(dom[panels[i]], dom[panels[j]]) > 0: out.append(("dom-overlap", "dom", "%s | %s" % (panels[i], panels[j])))
    return out

def same_cam(c, ref, km=1e-6, rel=1e-9):
    return abs(c["cx"] - ref["cx"]) <= km and abs(c["cy"] - ref["cy"]) <= km and abs(c["k"] / ref["k"] - 1) <= rel

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", required=True)
    ap.add_argument("--widths", default="400,768,1200,1600,2000")
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
            # the preset cameras at this width, the map's size and the fitted k, for the camera checks
            P = cdp.evaluate("(() => { const A = window.__atlas; A.mode('cells'); A.preset('Moscow'); const moscow = A.camera(); A.preset('Central Moscow (250 m)'); const cm = A.camera(); A.preset('Russia'); const russia = A.camera(); return { moscow, cm, russia, kfit: A.kFit(), W: window.__atlasCanvases.map.w, H: window.__atlasCanvases.map.h, m: A.cities.Moscow }; })()", await_promise=False)
            side = min(round(P["W"]), round(P["H"])); mx, my = P["m"]   # the page rounds the map's size to whole CSS px
            def state(layer, year, setup, tag, check=None):
                nonlocal n_boxes, n_states
                r = cdp.evaluate("(async () => { const A = window.__atlas, m = A.cities.Moscow; %s A.layer(%r); A.year(%d); await A.ready(); const r = A.redraw(); return { boxes: r.boxes, dom: r.dom, cam: A.camera(), canvases: window.__atlasCanvases }; })()" % (setup, layer, year), await_promise=True, timeout=180)
                n_boxes += len(r["boxes"]); n_states += 1
                found = audit_boxes(r["boxes"], r["canvases"], a.min_size, a.overlap) + audit_dom(r["dom"])
                if check: found += check(r)
                for kind, scene, key in found:
                    findings.append("%-11s width %d  %-7s %-5s %-8s %-10s %s" % (kind, w, layer, year, tag, scene, key))
                return r
            def cam_is(ref, label, km=1e-6, rel=1e-9):
                return lambda r: [] if same_cam(r["cam"], ref, km, rel) else [("camera", "cam", "%s: expected %s, got %s" % (label, json.dumps({k: round(ref[k], 4) for k in ref}), json.dumps({k: round(r["cam"][k], 4) for k in ("cx", "cy", "k")})))]
            def cam_k(kexp, label, cx=None, cy=None, km=0.8):
                def f(r):
                    c = r["cam"]; bad = []
                    if abs(c["k"] / kexp - 1) > 1e-6: bad.append(("camera", "cam", "%s: expected k %.4f, got %.4f" % (label, kexp, c["k"])))
                    if cx is not None and (abs(c["cx"] - cx) > km or abs(c["cy"] - cy) > km): bad.append(("camera", "cam", "%s: expected the centre within %g km of (%.2f, %.2f), got (%.2f, %.2f)" % (label, km, cx, cy, c["cx"], c["cy"])))
                    return bad
                return f
            for layer in layers:
                for year in ([2014, 2021, 2025] if layer == "share" else [2021]):
                    state(layer, year, "A.mode('cells'); A.preset('Russia');", "-")
            # hovered states: the Moscow 100 km cell at the national view; at the Moscow preset a 1 km cell with firms and a point 300 m north-west of it (a gap or a neighbour); a density cell
            state("share", 2021, "A.preset('Russia'); A.hoverKm(m[0], m[1]);", "h100")
            state("share", 2021, "A.preset('Moscow'); A.hoverKm(m[0], m[1]);", "h1km")
            state("share", 2021, "A.preset('Moscow'); A.hoverKm(m[0] - 0.3, m[1] + 0.3);", "h1km2")
            state("share", 2023, "A.preset('Moscow'); A.hoverKm(m[0], m[1]);", "h1km")
            state("density", 2021, "A.preset('Russia'); A.hoverKm(m[0], m[1]);", "h5km")
            state("density", 2021, "A.preset('Central Moscow (250 m)'); A.hoverKm(m[0], m[1]);", "h250")
            # the tooltip shown on the map (an overlay the DOM check covers), at the Moscow preset
            state("share", 2021, "A.mode('cells'); A.layer('share'); A.year(2021); A.preset('Moscow'); A.hoverKm(m[0], m[1], { show: true });", "tip")
            # the click ladder, the zoom buttons and the presets (24 October 2026), through the instant API
            SET = "A.mode('cells'); A.layer('share'); A.year(2021); "
            state("share", 2021, SET + "A.preset('Russia'); await A.click(m[0], m[1]); A.hoverKm(m[0], m[1]);", "clk1", cam_is(P["moscow"], "a click on the Moscow cell from Russia lands on the Moscow preset"))
            state("share", 2021, SET + "A.preset('Moscow'); await A.click(m[0], m[1]);", "clk2", cam_k(side / 20, "a click at the Moscow preset lands on the 20 km scale", mx, my))
            state("share", 2021, SET + "A.preset('Central Moscow (250 m)'); await A.click(m[0], m[1]);", "clk3", cam_k(min(2.5 * P["cm"]["k"], 200), "a click at Central Moscow steps x2.5"))
            state("share", 2021, SET + "A.preset('Central Moscow (250 m)'); await A.click(m[0], m[1]); await A.click(m[0], m[1], { shift: true });", "clk3b", cam_is(P["cm"], "a step in and a Shift+click out return to the Central Moscow preset", 1e-6, 1e-6))
            cx, cy = (int((mx + 300) // 100) + 0.5) * 100, (int(my // 100) + 0.5) * 100
            state("share", 2021, SET + "A.preset('Russia'); await A.click(m[0] + 300, m[1]);", "clkcell", cam_k(side / 500, "a click on the cell 300 km east of Moscow lands on its centre", cx, cy, 1e-6))
            state("share", 2021, SET + "A.preset('Russia'); await A.zoom(1); await A.zoom(1); await A.zoom(1);", "zoom3", cam_k(8 * P["kfit"], "three zoom-ins from Russia give 8 x kFit", P["russia"]["cx"], P["russia"]["cy"], 1e-6))
            state("share", 2021, SET + "A.preset('Russia'); await A.zoom(1); await A.zoom(1); await A.zoom(-1); await A.zoom(-1); await A.zoom(-1); await A.zoom(0);", "zoomfit", cam_is(P["russia"], "zooming in, out past the floor and fitting returns the Russia preset", 1e-6, 1e-6))
            # the 25 km cells (M10) and the hand-over around the city windows: three and four zoom steps in from the country
            Z3, Z4 = "A.preset('Russia'); await A.zoom(1); await A.zoom(1); await A.zoom(1);", "A.preset('Russia'); await A.zoom(1); await A.zoom(1); await A.zoom(1); await A.zoom(1);"
            for layer, year in [("share", 2021), ("share", 2014), ("change", 2021), ("lists", 2021), ("density", 2021)]:
                state(layer, year, "A.mode('cells'); " + Z3, "z3")
            state("share", 2021, "A.mode('cells'); " + Z3 + " { const c = A.camera(); A.hoverKm(c.cx + 30, c.cy - 20, { show: true }); }", "z3hov")
            state("lists", 2021, "A.mode('cells'); A.layer('lists'); " + Z4 + " { const c = A.camera(); A.hoverKm(c.cx, c.cy, { show: true }); }", "z4hov")
            state("share", 2025, "A.mode('cells'); " + Z4, "z4")
            # a zoom-in flight keeps its subject converging on the centre from the first frame (24 October 2026)
            for tag, setup, target in [("path1", "A.preset('Russia');", "{ cx: m[0], cy: m[1], k: %r }" % P["moscow"]["k"]), ("path2", "A.preset('Moscow');", "{ cx: m[0] + 1.5, cy: m[1] + 0.5, k: %r }" % P["cm"]["k"]), ("path3", "A.preset('Russia');", "{ cx: m[0] + 300, cy: m[1], k: %r }" % (side / 500))]:
                d = cdp.evaluate("(() => { const A = window.__atlas, m = A.cities.Moscow; A.mode('cells'); %s return A.pathPreview(%s, 40); })()" % (setup, target), await_promise=False)
                bad = [i for i in range(1, len(d)) if d[i] > d[i - 1] + 0.5]
                n_states += 1
                if bad or d[-1] > 0.5: findings.append("%-11s width %d  %-7s %-5s %-8s %-10s %s" % ("path", w, "share", 2021, tag, "flight", "the subject moved away from the centre at samples %s; end offset %.2f px" % (bad[:5], d[-1])))
            # firms mode (round 5): the address marks by layer at three presets, two hovers, and a ladder step
            F = "A.mode('firms'); "
            for layer, year, preset in [("share", 2021, "Russia"), ("share", 2014, "Moscow"), ("share", 2025, "Central Moscow (250 m)"), ("fin", 2021, "Russia"), ("fin", 2021, "Moscow"), ("fin", 2021, "Central Moscow (250 m)"), ("density", 2021, "Moscow"), ("lists", 2021, "Russia")]:
                state(layer, year, F + "A.preset(%r);" % preset, "firms")
            state("share", 2021, F + "A.preset('Central Moscow (250 m)'); A.hoverKm(m[0] + 1.2, m[1] + 0.4);", "fhov")
            state("fin", 2021, F + "A.preset('Moscow'); A.hoverKm(m[0], m[1]);", "fhov2")
            state("share", 2021, F + "A.layer('share'); A.year(2021); A.preset('Moscow'); await A.ready(); await A.click(m[0], m[1]);", "fclk", cam_k(min(2.5 * P["moscow"]["k"], 200), "a click in the firms view steps x2.5"))
            # the legend and the note, collapsed and expanded, at the national and the Moscow views
            state("share", 2021, "A.mode('cells'); A.preset('Russia'); A.legend(true); A.note(true);", "open")
            state("share", 2021, "A.mode('cells'); A.preset('Moscow'); A.legend(true); A.note(true);", "open")
            state("share", 2021, "A.mode('firms'); A.preset('Moscow'); A.legend(true); A.note(true);", "fopen")
            state("share", 2021, "A.mode('cells'); A.preset('Russia'); A.legend(false); A.note(false);", "closed")
            state("share", 2021, "A.mode('cells'); A.preset('Russia'); A.legend(null); A.note(null);", "-")
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
