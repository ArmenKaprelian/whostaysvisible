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
import re, argparse, math, json, os, subprocess, sys, tempfile, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from capture import brave_flags, wait_port_file, page_ws_url
from cdp import CDP

def bx(b):
    return json.dumps({k: round(b[k], 1) for k in ("x", "y", "x1", "y1")})

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

CAPS_JS = "(() => { const want = [['header h1', 700, false], ['.card h2', 500, true], ['#theme', 500, true], ['.yearrow .ui', 500, true], ['#yearlabel', 500, true], ['#modes .modelabel', 500, true], ['#modes .btn', 500, true], ['#layers .btn', 500, true], ['#presets .btn', 500, true], ['#legendtitle', 500, true], ['#legendbody .row:not(.p)', 500, true], ['#mixtitle', 500, true], ['#cellinfo > span', 500, true], ['.ctxt .t.tip', 500, true], ['.loc', 500, true]];\n  const bad = [];\n  for (const [sel, wt, tracked] of want) { const els = [...document.querySelectorAll(sel)]; if (!els.length) { bad.push(sel + ': no element'); continue; }\n    for (const el of els.slice(0, 3)) { const cs = getComputedStyle(el), fs = parseFloat(cs.fontSize), ls = cs.letterSpacing === 'normal' ? 0 : parseFloat(cs.letterSpacing);\n      if (cs.textTransform !== 'uppercase') bad.push(sel + ': transform ' + cs.textTransform); if (parseInt(cs.fontWeight) !== wt) bad.push(sel + ': weight ' + cs.fontWeight);\n      if (tracked ? Math.abs(ls - 0.08 * fs) > 0.06 : ls !== 0) bad.push(sel + ': spacing ' + cs.letterSpacing + ' at ' + fs + 'px'); if (!/IBM Plex Mono/.test(cs.fontFamily)) bad.push(sel + ': family ' + cs.fontFamily); } }\n  const u = [...document.querySelectorAll('.u')]; if (!u.length) bad.push('.u: no element'); for (const el of u.slice(0, 5)) if (getComputedStyle(el).textTransform !== 'none') bad.push('.u: transform ' + getComputedStyle(el).textTransform);\n  for (const [sel, txt] of [['#zoom-in', 'ZOOM IN (+)'], ['#zoom-out', 'ZOOM OUT (−)'], ['#zoom-fit', 'FIT THE WHOLE COUNTRY (0)']]) if (document.querySelector(sel).title !== txt) bad.push(sel + ': title ' + document.querySelector(sel).title);\n  return bad; })()"

def audit_dom(dom, mode=None):
    """The visible overlays must lie inside the map (0.5 px tolerance); the panels must never intersect one
    another. The tooltip follows the cursor and sits above the panels, so it is held inside the map but not
    counted against them. The pulse button (25 October 2026) is shown in the firms view only, inside the year
    row, clear of the slider and the year label, at least 24 px square."""
    out = []; m = dom["map"]
    if dom.get("pulse") is not None and mode is not None:
        p = dom["pulse"]
        if p["visible"] != (mode == "firms"): out.append(("pulse", "dom", "visible %s in the %s view" % (p["visible"], mode)))
        if p["visible"]:
            yr = dom["yearrow"]
            if p["x"] < yr["x"] - 0.5 or p["y"] < yr["y"] - 0.5 or p["x1"] > yr["x1"] + 0.5 or p["y1"] > yr["y1"] + 0.5: out.append(("pulse", "dom", "outside the year row %s" % json.dumps({k: round(p[k], 1) for k in ("x", "y", "x1", "y1")})))
            for k in ("year", "yearlabel"):
                if inter(p, dom[k]) > 0: out.append(("pulse", "dom", "intersects the %s" % k))
            if p["x1"] - p["x"] < 24 or p["y1"] - p["y"] < 24: out.append(("pulse", "dom", "smaller than 24 px: %.1f by %.1f" % (p["x1"] - p["x"], p["y1"] - p["y"])))
    for o in dom.get("overflow") or []: out.append(("text-overflow", "dom", "%s %s runs %+d px past its box, %d px past its own" % (o["sel"], json.dumps(o["text"]), o["right"], o["over"])))   # tracked capitals (round 10)
    names = [n for n in ("legend", "note", "zoom", "scale", "tip", "strip", "mix") if dom.get(n) and dom[n]["visible"]]
    if dom.get("mix") and dom["mix"]["visible"]:   # the revenue mix box (round 9): its toggle inside it
        t, b = dom["mixtoggle"], dom["mix"]
        if t["x"] < b["x"] - 0.5 or t["y"] < b["y"] - 0.5 or t["x1"] > b["x1"] + 0.5 or t["y1"] > b["y1"] + 0.5: out.append(("mix", "dom", "toggle outside the box"))
    panels = [n for n in names if n != "tip"]
    for n in names:
        b = dom[n]
        if b["x"] < m["x"] - 0.5 or b["y"] < m["y"] - 0.5 or b["x1"] > m["x1"] + 0.5 or b["y1"] > m["y1"] + 0.5:
            out.append(("offmap", "dom", "%s %s" % (n, json.dumps({k: round(b[k], 1) for k in ("x", "y", "x1", "y1")}))))
    for i in range(len(panels)):
        for j in range(i + 1, len(panels)):
            if inter(dom[panels[i]], dom[panels[j]]) > 0: out.append(("dom-overlap", "dom", "%s | %s" % (panels[i], panels[j])))
    # the cursor tile (round 9) never covers a panel, and the context strip holds its toggle and, when open, its glyph, lifts the
    # legend and the zoom box clear of itself, and as a collapsed stub meets neither the legend nor the zoom box
    if "tip" in names:
        for n in panels:
            if inter(dom["tip"], dom[n]) > 0 and not (n in ("legend", "note") and dom.get("tipRelaxed") and n in dom["tipRelaxed"]): out.append(("tile-overlap", "dom", "tip | %s  tip %s  %s %s  map %s" % (n, bx(dom["tip"]), n, bx(dom[n]), bx(dom["map"]))))
    if dom.get("strip") and dom["strip"]["visible"]:
        st, tg = dom["strip"], dom["striptoggle"]
        if tg["x"] < st["x"] - 0.5 or tg["y"] < st["y"] - 0.5 or tg["x1"] > st["x1"] + 0.5 or tg["y1"] > st["y1"] + 0.5: out.append(("strip", "dom", "the toggle lies outside the strip"))
        if dom.get("stripOpen"):
            g = dom["glyph"]
            if not g["visible"] or g["x"] < st["x"] - 0.5 or g["y"] < st["y"] - 0.5 or g["x1"] > st["x1"] + 0.5 or g["y1"] > st["y1"] + 0.5: out.append(("strip", "dom", "the glyph is hidden or outside the open strip"))
            for n in ("legend", "zoom"):
                if dom.get(n) and dom[n]["visible"] and dom[n]["y1"] > st["y"] - 8 + 0.5: out.append(("strip", "dom", "the %s is not lifted clear of the open strip" % n))
        else:
            if dom["glyph"]["visible"]: out.append(("strip", "dom", "the glyph shows while the strip is collapsed"))
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
    findings = []; n_boxes = 0; n_states = 0; fields = set(); n_relaxed = 0; relaxed = []
    for w in [int(x) for x in a.widths.split(",")]:
        profile = tempfile.mkdtemp(prefix="atlas-audit-")
        proc = subprocess.Popen(brave_flags(profile, w, a.height) + ["about:blank"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        try:
            port = wait_port_file(profile, proc); cdp = CDP(page_ws_url(port))
            cdp.call("Page.enable"); cdp.call("Runtime.enable"); cdp.call("DOM.enable"); cdp.call("CSS.enable")
            cdp.call("Emulation.setDeviceMetricsOverride", {"width": w, "height": a.height, "deviceScaleFactor": 1, "mobile": False})
            cdp.call("Page.navigate", {"url": url}); cdp.wait_event("Page.loadEventFired", timeout=60)
            cdp.evaluate("document.fonts.ready.then(() => true)", await_promise=True, timeout=60)
            time.sleep(0.5)
            layers = cdp.evaluate("window.__atlas.layers", await_promise=False)
            # the typeface (round 10): the headless browser must have resolved IBM Plex Mono for the title and a button, the only proof the installed face is in use
            doc = cdp.call("DOM.getDocument", {"depth": 1})["root"]["nodeId"]
            for sel in ("header h1", "#theme"):
                nid = cdp.call("DOM.querySelector", {"nodeId": doc, "selector": sel})["nodeId"]
                fams = [f["familyName"] for f in cdp.call("CSS.getPlatformFontsForNode", {"nodeId": nid})["fonts"]]
                if not any("IBM Plex Mono" in f for f in fams): findings.append("%-11s width %d  %s rendered with %s" % ("font", w, sel, fams))
            # the preset cameras at this width, the map's size and the fitted k, for the camera checks
            P = cdp.evaluate("(() => { const A = window.__atlas; A.mode('cells'); A.preset('Moscow'); const moscow = A.camera(); A.preset('Central Moscow (250 m)'); const cm = A.camera(); A.preset('Russia'); const russia = A.camera(); return { moscow, cm, russia, kfit: A.kFit(), W: window.__atlasCanvases.map.w, H: window.__atlasCanvases.map.h, m: A.cities.Moscow }; })()", await_promise=False)
            side = min(round(P["W"]), round(P["H"])); mx, my = P["m"]   # the page rounds the map's size to whole CSS px
            def state(layer, year, setup, tag, check=None):
                nonlocal n_boxes, n_states, n_relaxed
                r = cdp.evaluate("(async () => { const A = window.__atlas, m = A.cities.Moscow; window.__extra = null; A.layer(%r); A.year(%d); await A.ready(); %s A.layer(%r); A.year(%d); await A.ready(); const r = A.redraw(); const mb = document.querySelector('#modes button[aria-pressed=\"true\"]'); return { boxes: r.boxes, dom: r.dom, cam: A.camera(), canvases: window.__atlasCanvases, field: A.field ? A.field() : null, pulsing: A.pulsing ? A.pulsing() : null, mode: mb ? mb.dataset.mode : 'cells', extra: window.__extra }; })()" % (layer, year, setup, layer, year), await_promise=True, timeout=180)
                n_boxes += len(r["boxes"]); n_states += 1
                if r["dom"].get("tipRelaxed"): n_relaxed += 1; relaxed.append("%d:%s:%s" % (w, tag, "+".join(r["dom"]["tipRelaxed"])))
                found = audit_boxes(r["boxes"], r["canvases"], a.min_size, a.overlap) + audit_dom(r["dom"], r.get("mode"))
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
                for year in ([2014, 2021, 2025] if layer in ("share", "industry") else [2021]):
                    state(layer, year, "A.mode('cells'); A.preset('Russia');", "-")
            # the context strip and the cursor tile (round 9): the strip open and closed, the fact's band at the country, inside a region
            # and at a city window, a forced tip, the tile at the map's corners and centre clear of the panels and of the hovered mark, a tap
            W, H = w, a.height
            def ctx_is(band, name_prefix, kind=None):
                return lambda r: [] if r["extra"] and r["extra"]["band"] == band and r["extra"]["name"].startswith(name_prefix) and r["extra"]["glyph"] and r["extra"]["glyphD"] and (kind is None or r["extra"]["kind"] == kind) and r["extra"]["open"] and not r["extra"]["clipped"] and r["extra"].get("locs", 0) >= 1 else [("context", "strip", json.dumps(r["extra"])[:220])]
            state("share", 2021, "A.strip(true); A.preset('Russia'); window.__extra = A.context();", "ctxnat", ctx_is("national", "Russia"))
            state("industry", 2021, "A.strip(true); A.preset('Russia'); window.__extra = A.context();", "ctxind", ctx_is("national", "Russia", "industry"))
            state("share", 2024, "A.strip(true); await A.jump({ cx: m[0] + 60, cy: m[1], k: 1.0 }); window.__extra = A.context();", "ctxreg", ctx_is("region", "Moscow Oblast"))
            state("share", 2021, "A.strip(true); A.preset('Moscow'); window.__extra = Object.assign(A.context(), { g2: A.glyph('Saint Petersburg') });", "ctxcity", lambda r: ctx_is("city", "Moscow")(r) + ([] if r["extra"] and r["extra"]["g2"] and r["extra"]["g2"] != r["extra"]["glyphD"] else [("context", "glyph", "the St Petersburg glyph is empty or equals Moscow's")]))
            state("share", 2021, "A.strip(true); A.preset('Russia'); A.tip('reset'); window.__extra = { shown: A.tip(true), c: A.context() }; A.tip(false);", "ctxtip", lambda r: [] if r["extra"] and r["extra"]["shown"] and r["extra"]["c"]["kind"] == "tip" and r["extra"]["c"]["text"] else [("context", "tip", json.dumps(r["extra"])[:200])])
            # interface labels in tracked capitals (round 10): the computed styles of every labelled element with a tip showing and a hover on, the zoom titles, every tip fitting the strip at this width
            state("industry", 2021, "A.mode('cells'); A.strip(true); A.preset('Moscow'); A.hoverKm(m[0], m[1], { show: true }); A.tip('reset'); A.tip(true); window.__extra = { caps: %s, tips: A.tips() }; A.tip(false);" % CAPS_JS, "caps",
                  lambda r: ([("caps", "dom", b) for b in (r["extra"] or {}).get("caps", ["no result"])] + [("tips", "strip", "clipped: %s" % json.dumps(t)) for t in (r["extra"] or {}).get("tips", []) if t["clipped"]] + ([] if r["extra"] and len(r["extra"]["tips"]) >= 9 else [("tips", "strip", "fewer tips measured than expected")])))
            state("share", 2021, "A.strip(false); A.preset('Russia'); window.__extra = A.context();", "ctxoff", lambda r: [] if r["extra"] and not r["extra"]["open"] and not r["dom"]["stripOpen"] else [("context", "closed", json.dumps(r["extra"])[:200])])
            state("share", 2021, "A.strip(null); A.preset('Russia');", "ctxdef")
            MAPSIZE = "const mbx = document.getElementById('mapwrap').getBoundingClientRect(), MW = mbx.width, MH = mbx.height; "
            def tile_ok(r):
                t = r["extra"] and r["extra"]["tile"]
                if not t: return [("tile", "hover", "no tile")]
                b, c = t["box"], t["cursor"]; bad = []
                if b["x"] - 6 <= c[0] <= b["x1"] + 6 and b["y"] - 6 <= c[1] <= b["y1"] + 6: bad.append(("tile", "cursor", "the tile covers the cursor at %s" % json.dumps([round(v) for v in c])))
                if t["mark"] and b["x"] - 6 <= t["mark"][0] <= b["x1"] + 6 and b["y"] - 6 <= t["mark"][1] <= b["y1"] + 6: bad.append(("tile", "mark", "the tile covers the hovered mark"))
                if t["fallback"]: bad.append(("tile", "fallback", "no clear anchor at %s" % json.dumps([round(v) for v in c])))
                return bad
            for mode_js, layer, preset, tagp in (("A.mode('cells'); ", "share", "Russia", "tc"), ("A.mode('cells'); ", "share", "Moscow", "tcm")):
                for cx, cy, tg in (("8", "8", "nw"), ("MW - 8", "8", "ne"), ("8", "MH - 8", "sw"), ("MW - 8", "MH - 8", "se"), ("MW / 2", "MH / 2", "c")):   # the map's own size, read in the page (the map is narrower than the viewport)
                    state(layer, 2021, mode_js + MAPSIZE + "A.strip(true); A.preset(%r); window.__extra = { tile: null }; A.hoverPx(%s, %s, { show: true }); window.__extra = { tile: A.tile() };" % (preset, cx, cy), tagp + tg, tile_ok)
            state("share", 2021, "A.mode('cells'); " + MAPSIZE + "A.strip(true); A.preset('Moscow'); A.tapAt(MW / 2, MH / 2); window.__extra = { tile: A.tile() };", "tap", lambda r: tile_ok(r) + ([] if r["extra"] and r["extra"]["tile"] and r["extra"]["tile"]["box"]["y1"] <= r["extra"]["tile"]["cursor"][1] - 14 + 0.5 else [("tile", "tap", "the tapped tile is not above the finger")]))
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
            state("share", 2021, SET + "A.preset('Central Moscow (250 m)'); await A.click(m[0], m[1]); await A.click(m[0], m[1], { shift: true });", "clk3b", cam_k(P["cm"]["k"], "a zoom on the clicked cell and a Shift+click out return to the preset's zoom near the subject", mx, my, 2.0))   # the step out is anchored at the cursor: 2.5 times the cell centre's offset, at most 1.8 km for a 1 km cell
            px, py = (int((mx + 60) // 25) + 0.5) * 25, (int(my // 25) + 0.5) * 25
            state("share", 2021, SET + "A.preset('Moscow'); await A.click(m[0] + 60, m[1]);", "clkpan", cam_k(P["moscow"]["k"], "a click on a 25 km cell outside the window pans to it at the same zoom", px, py, 1e-6))
            cx, cy = (int((mx + 300) // 100) + 0.5) * 100, (int(my // 100) + 0.5) * 100
            state("share", 2021, SET + "A.preset('Russia'); await A.click(m[0] + 300, m[1]);", "clkcell", cam_k(side / 500, "a click on the cell 300 km east of Moscow lands on its centre", cx, cy, 1e-6))
            state("share", 2021, SET + "A.preset('Russia'); await A.zoom(1); await A.zoom(1); await A.zoom(1);", "zoom3", cam_k(8 * P["kfit"], "three zoom-ins from Russia give 8 x kFit", P["russia"]["cx"], P["russia"]["cy"], 1e-6))
            state("share", 2021, SET + "A.preset('Russia'); await A.zoom(1); await A.zoom(1); await A.zoom(-1); await A.zoom(-1); await A.zoom(-1); await A.zoom(0);", "zoomfit", cam_is(P["russia"], "zooming in, out past the floor and fitting returns the Russia preset", 1e-6, 1e-6))
            # earlier re-centring (25 October 2026): zoom-out steps to just above the band keep the centre on Moscow; a wheel-sized step
            # into the band lands on the proportional blend (halfway at 1.5 x kFit); one more step lands exactly on the Russia preset;
            # and a zoom-in from the floor anchored at Moscow keeps Moscow under its pixel (nothing remembered on the way in)
            import math
            kM, kf, R = P["moscow"]["k"], P["kfit"], P["russia"]
            nsteps = int(math.floor(math.log2(kM / (2 * kf)))); kn = kM / 2 ** nsteps; fband = 1.5 * kf / kn
            OUT = "A.preset('Moscow'); " + "await A.zoom(-1); " * nsteps
            state("share", 2021, SET + OUT, "band0", cam_k(kn, "%d zoom-out steps from Moscow stay above the band with the centre on Moscow" % nsteps, mx, my, 1e-6))
            state("share", 2021, SET + OUT + "await A.zoomBy(%r);" % fband, "band1", cam_k(1.5 * kf, "a wheel-sized step into the band lands halfway between Moscow and the country's centre", (mx + R["cx"]) / 2, (my + R["cy"]) / 2, 0.01))
            state("share", 2021, SET + OUT + "await A.zoomBy(%r); await A.zoom(-1);" % fband, "band2", cam_is(R, "one more step from inside the band lands exactly on the Russia preset", 1e-6, 1e-6))
            state("share", 2021, SET + "A.preset('Russia'); { const c0 = A.camera(), W = window.__atlasCanvases.map.w, H = window.__atlasCanvases.map.h; const s0 = [W / 2 + (m[0] - c0.cx) * c0.k, H / 2 - (m[1] - c0.cy) * c0.k]; const c1 = await A.zoomBy(2, m); window.__extra = { s0, s1: [W / 2 + (m[0] - c1.cx) * c1.k, H / 2 - (m[1] - c1.cy) * c1.k] }; }", "floorin",
                  lambda r: ([] if abs(r["cam"]["k"] / (2 * kf) - 1) < 1e-6 else [("camera", "cam", "a zoom-in from the floor: expected k %.4f, got %.4f" % (2 * kf, r["cam"]["k"]))]) + ([] if r["extra"] and abs(r["extra"]["s0"][0] - r["extra"]["s1"][0]) < 0.01 and abs(r["extra"]["s0"][1] - r["extra"]["s1"][1]) < 0.01 else [("camera", "cam", "a zoom-in from the floor moved Moscow's screen point: %s" % json.dumps(r["extra"]))]) + ([] if math.hypot(r["cam"]["cx"] - R["cx"], r["cam"]["cy"] - R["cy"]) >= 1 else [("camera", "cam", "a zoom-in from the floor went into the country's centre")]))
            # the 25 km cells (M10) and the hand-over around the city windows: three and four zoom steps in from the country
            Z3, Z4 = "A.preset('Russia'); await A.zoom(1); await A.zoom(1); await A.zoom(1);", "A.preset('Russia'); await A.zoom(1); await A.zoom(1); await A.zoom(1); await A.zoom(1);"
            for layer, year in [("share", 2021), ("share", 2014), ("change", 2021), ("lists", 2021), ("density", 2021), ("industry", 2021), ("industry", 2025)]:
                state(layer, year, "A.mode('cells'); " + Z3, "z3")
            # the industry layer (round 9): a 100 km hover at the country names the division and its share and the legend lists the nine classes; a 25 km hover inside Moscow's window
            state("industry", 2021, "A.mode('cells'); A.preset('Russia'); A.hoverKm(m[0], m[1], { show: true }); window.__extra = { tip: document.getElementById('tip').innerText, rows: document.querySelectorAll('#legendbody .row .sw').length };", "ihov100", lambda r: [] if r["extra"] and re.search(r"\(division \d\d\)|\(\d\d\), \d", r["extra"]["tip"]) and ("% of revenue" in r["extra"]["tip"] or "share of revenue" in r["extra"]["tip"] or "Largest share:" in r["extra"]["tip"]) and r["extra"]["rows"] >= 10 else [("industry", "tip", json.dumps(r["extra"])[:200])])
            # the revenue mix box (round 9, the author's correction): rows for the hovered unit, the view's mix off the map, hidden off the layer, the toggle
            MIXJS = "window.__extra = A.mix();"
            def mix_ok(unit_sub, closed=False):
                def f(r):
                    m = r["extra"]; bad = []
                    if not m or not m["visible"]: return [("mix", "box", "not visible")]
                    if closed: return [] if not m["open"] else [("mix", "open", "expected closed")]
                    if not m["open"]: return [("mix", "open", "expected open")]
                    if unit_sub not in m["unit"]: bad.append(("mix", "unit", m["unit"]))
                    rows = [x for x in m["rows"] if x["pct"] is not None]
                    if not rows: bad.append(("mix", "rows", "no rows: " + json.dumps(m)[:160]))
                    if len(rows) > 9: bad.append(("mix", "rows", "more than nine rows"))
                    named = [x for x in rows if x["name"] != "other divisions"]
                    if len(named) > 8: bad.append(("mix", "rows", "more than eight division rows"))
                    pcts = [0.5 if x["pct"] == "<1%" else float(x["pct"].rstrip("%")) for x in named]
                    if pcts != sorted(pcts, reverse=True): bad.append(("mix", "sort", json.dumps(pcts)))
                    if any(x["name"] == "other divisions" for x in rows) and rows[-1]["name"] != "other divisions": bad.append(("mix", "rows", "other divisions not last"))
                    if any(not x["colour"] for x in named): bad.append(("mix", "colour", "a division row without its class colour"))
                    return bad
                return f
            state("industry", 2021, "A.mode('cells'); A.mixbox(true); A.preset('Russia'); A.hoverKm(m[0], m[1], { show: true }); " + MIXJS, "mixhov100", mix_ok("100 km cell at the cursor"))
            state("industry", 2021, "A.mode('cells'); A.mixbox(true); A.preset('Moscow'); await A.ready(); A.redraw(); A.hoverKm(m[0] + 0.2, m[1] + 0.2, { show: true }); " + MIXJS, "mixhov1", mix_ok("1 km cell at the cursor"))
            state("industry", 2021, "A.mode('cells'); A.mixbox(true); A.preset('Russia'); A.hoverOff(); " + MIXJS, "mixview", mix_ok("100 km cells in view"))
            state("industry", 2021, "A.mode('firms'); A.mixbox(true); A.preset('Moscow'); await A.ready(); A.hoverKm(m[0], m[1], { show: true }); " + MIXJS, "mixaddr", mix_ok("coordinate pair at the cursor"))
            state("industry", 2021, "A.mode('firms'); A.mixbox(true); A.preset('Moscow'); await A.ready(); A.hoverOff(); " + MIXJS, "mixviewf", mix_ok("coordinate pairs in view"))
            state("share", 2021, "A.mode('cells'); A.preset('Russia'); " + MIXJS, "mixoff", lambda r: [] if r["extra"] and not r["extra"]["visible"] else [("mix", "hidden", "the box shows off the industry layer")])
            state("industry", 2021, "A.mode('cells'); A.mixbox(false); A.preset('Russia'); " + MIXJS, "mixclosed", mix_ok("", closed=True))
            state("industry", 2021, "A.mode('cells'); A.mixbox(null); A.preset('Russia'); " + MIXJS, "mixdef", lambda r: [] if r["extra"] and r["extra"]["visible"] and r["extra"]["open"] == (w >= 1200) else [("mix", "default", "open %s at %d px" % (r["extra"] and r["extra"]["open"], w))])   # open by default only where the map is at least 600 px wide and 640 px tall (the side-by-side layout)
            state("industry", 2021, "A.mode('cells'); A.mixbox(null); A.preset('Russia');", "mixdef2")
            state("industry", 2021, "A.mode('cells'); " + Z3 + " { const c = A.camera(); A.hoverKm(c.cx + 30, c.cy - 20, { show: true }); window.__extra = { tip: document.getElementById('tip').innerText }; }", "ihov25", lambda r: [] if r["extra"] and ("revenue" in r["extra"]["tip"]) else [("industry", "tip25", json.dumps(r["extra"])[:200])])
            state("share", 2021, "A.mode('cells'); " + Z3 + " { const c = A.camera(); A.hoverKm(c.cx + 30, c.cy - 20, { show: true }); }", "z3hov")
            state("lists", 2021, "A.mode('cells'); A.layer('lists'); " + Z4 + " { const c = A.camera(); A.hoverKm(c.cx, c.cy, { show: true }); }", "z4hov")
            state("share", 2025, "A.mode('cells'); " + Z4, "z4")
            # a zoom-in flight keeps its subject converging on the centre from the first frame (24 October 2026)
            for tag, setup, target in [("path1", "A.preset('Russia');", "{ cx: m[0], cy: m[1], k: %r }" % P["moscow"]["k"]), ("path2", "A.preset('Moscow');", "{ cx: m[0] + 1.5, cy: m[1] + 0.5, k: %r }" % P["cm"]["k"]), ("path3", "A.preset('Russia');", "{ cx: m[0] + 300, cy: m[1], k: %r }" % (side / 500))]:
                d = cdp.evaluate("(() => { const A = window.__atlas, m = A.cities.Moscow; A.mode('cells'); %s return A.pathPreview(%s, 40); })()" % (setup, target), await_promise=False)
                bad = [i for i in range(1, len(d)) if d[i] > d[i - 1] + 0.5]
                n_states += 1
                if bad or d[-1] > 0.5: findings.append("%-11s width %d  %-7s %-5s %-8s %-10s %s" % ("path", w, "share", 2021, tag, "flight", "the subject moved away from the centre at samples %s; end offset %.2f px" % (bad[:5], d[-1])))
            # firms mode (round 5): the address marks by layer at three presets, two hovers, and a ladder step; since the
            # WebGL field (24 October 2026) the same states run on the renderer the page chose and again on the 2D
            # fallback (?__nogl=1), with the renderer asserted, plus a forward year change (the pulse) and a backward one
            F = "A.mode('firms'); "
            GL = ("webgl2", "webgl")
            def field_is(expect, label): return lambda r: [] if r["field"] in expect else [("field", "gl", "%s: expected %s, got %s" % (label, "/".join(expect), r["field"]))]
            def pulsing_is(expect, label): return lambda r: [] if bool(r["pulsing"]) == expect else [("pulse", "marks", "%s: expected pulsing %s, got %s" % (label, expect, r["pulsing"]))]
            def both(f, g): return lambda r: f(r) + g(r)
            def firms_states(expect, tag):
                for layer, year, preset in [("share", 2021, "Russia"), ("share", 2014, "Moscow"), ("share", 2025, "Central Moscow (250 m)"), ("fin", 2021, "Russia"), ("fin", 2021, "Moscow"), ("fin", 2021, "Central Moscow (250 m)"), ("density", 2021, "Moscow"), ("lists", 2021, "Russia"), ("industry", 2021, "Russia"), ("industry", 2021, "Moscow"), ("industry", 2021, "Central Moscow (250 m)")]:
                    state(layer, year, F + "A.preset(%r);" % preset, tag, field_is(expect, "the firms view draws on " + "/".join(expect)))
                state("share", 2021, F + "A.preset('Central Moscow (250 m)'); A.hoverKm(m[0] + 1.2, m[1] + 0.4);", tag + "hov", field_is(expect, "hover"))
                state("fin", 2021, F + "A.preset('Moscow'); A.hoverKm(m[0], m[1]);", tag + "hov2", field_is(expect, "hover"))
                state("share", 2021, F + "A.layer('share'); A.year(2021); A.preset('Moscow'); await A.ready(); await A.click(m[0], m[1]);", tag + "clk", both(cam_k(min(2.5 * P["moscow"]["k"], 200), "a click in the firms view steps x2.5"), field_is(expect, "click")))
                state("share", 2022, F + "A.preset('Moscow'); A.layer('share'); A.year(2021); await A.ready(); A.year(2022); await new Promise(r => setTimeout(r, 250));", tag + "pulse", both(pulsing_is(True, "a forward year change pulses the newly red marks"), field_is(expect, "pulse")))
                state("share", 2020, F + "A.preset('Moscow'); A.layer('share'); A.year(2022); await A.ready(); A.year(2020); await A.ready();", tag + "back", pulsing_is(False, "a backward year change does not pulse"))
                state("share", 2025, "A.mode('cells'); A.preset('Moscow'); A.layer('share'); A.year(2021); await A.ready(); A.year(2025); await A.ready();", tag + "cells", pulsing_is(False, "a forward year change in the cells view does not pulse"))
                # the pulse button (25 October 2026): pressed at the Moscow preset for 2022 it replays the bloom for the firms listed that
                # year (dated, present), is disabled in 2025 (no listing), and works after a move back a year; a rimmed firm's hover
                N22 = "(() => { const T = MOTION_DATA.treatednational; let n = 0; for (let i = 0; i < T.n; i++) if (T.red_from[i] === %d && !T.undated[i] && T.filed[i][%d] !== '-') n++; return n; })()"
                def pulsed_is(y, label):
                    def f(r):
                        exp = r["extra"]["expect"] if r["extra"] else None
                        bad = []
                        if not r["extra"] or r["extra"]["pulsed"] != exp: bad.append(("pulse", "button", "%s: pulse() returned %s, expected %s" % (label, r["extra"] and r["extra"]["pulsed"], exp)))
                        if r["pulsing"] != exp: bad.append(("pulse", "button", "%s: pulsing %s, expected %s" % (label, r["pulsing"], exp)))
                        return bad
                    return f
                state("share", 2022, F + "A.preset('Moscow'); A.layer('share'); A.year(2022); await A.ready(); window.__extra = { pulsed: A.pulse(), expect: %s }; await new Promise(r => setTimeout(r, 250));" % (N22 % (2022, 8)), tag + "btn", both(pulsed_is(2022, "the button replays the bloom of the firms listed in 2022"), field_is(expect, "button")))
                state("share", 2025, F + "A.preset('Moscow'); A.layer('share'); A.year(2025); await A.ready(); await new Promise(r => setTimeout(r, 2000)); window.__extra = { pulsed: A.pulse(), expect: 0 };", tag + "btn0", lambda r: ([] if r["extra"] and r["extra"]["pulsed"] == 0 and r["pulsing"] == 0 else [("pulse", "button", "2025: pulse() %s, pulsing %s" % (r["extra"] and r["extra"]["pulsed"], r["pulsing"]))]) + ([] if r["dom"]["pulse"]["disabled"] and r["dom"]["pulse"]["title"] == "No firm on these lists was listed in 2025" else [("pulse", "button", "2025: disabled %s, title %r" % (r["dom"]["pulse"]["disabled"], r["dom"]["pulse"]["title"]))]))
                state("share", 2020, F + "A.preset('Moscow'); A.layer('share'); A.year(2022); await A.ready(); A.year(2020); await A.ready(); window.__extra = { pulsed: A.pulse(), expect: %s }; await new Promise(r => setTimeout(r, 250));" % (N22 % (2020, 6)), tag + "btnback", pulsed_is(2020, "after a move back a year the button pulses the firms listed in the shown year"))
                state("share", 2016, F + "A.preset('Moscow'); A.layer('share'); A.year(2016); await A.ready(); { const T = MOTION_DATA.treatednational; let best = -1, bd = Infinity; for (let i = 0; i < T.n; i++) { if (T.red_from[i] <= 2016 || T.filed[i][2] === '-') continue; const d = Math.hypot(T.x[i] - m[0], T.y[i] - m[1]); if (d < bd) { bd = d; best = i; } } window.__extra = { hover: A.hoverKm(T.x[best], T.y[best], { show: true }), d: bd }; }", tag + "rimhov", lambda r: [] if r["extra"] and r["extra"]["hover"].get("listed") and r["extra"]["hover"]["listed"]["rim"] >= 1 and r["extra"]["hover"]["listed"]["rim_from"] > 2016 else [("hover", "rim", "a rimmed firm's hover: %s" % json.dumps(r["extra"] and r["extra"]["hover"] and r["extra"]["hover"].get("listed")))])
                # a red mark is hovered within the 6 px floor and wins over the address under the cursor (25 October 2026)
                state("share", 2022, F + "A.preset('Moscow'); A.layer('share'); A.year(2022); await A.ready(); { const T = MOTION_DATA.treatednational, c = A.camera(); let best = -1, bd = Infinity; for (let i = 0; i < T.n; i++) { if (T.red_from[i] > 2022 || T.filed[i][8] === '-') continue; const d = Math.hypot(T.x[i] - m[0], T.y[i] - m[1]); if (d < bd) { bd = d; best = i; } } window.__extra = { hover: A.hoverKm(T.x[best] + 4.5 / c.k, T.y[best], { show: true }) }; }", tag + "redhov", lambda r: [] if r["extra"] and r["extra"]["hover"]["kind"] == "listed" and (r["extra"]["hover"].get("listed") or {}).get("red", 0) >= 1 else [("hover", "red", "a red mark 4.5 px off the cursor: %s" % json.dumps(r["extra"] and r["extra"]["hover"]))])
                # the listed firms' names (25 October 2026): at the nearest red firm to Moscow in 2022 the tooltip carries one to three named short lines, each with a glyph span,
                # lines and the panel their rows; skipped until the data carry names
                state("share", 2022, F + "A.preset('Moscow'); A.layer('share'); A.year(2022); await A.ready(); { const T = MOTION_DATA.treatednational; if (T.name) { let best = -1, bd = Infinity; for (let i = 0; i < T.n; i++) { if (T.red_from[i] > 2022 || T.filed[i][8] === '-') continue; const d = Math.hypot(T.x[i] - m[0], T.y[i] - m[1]); if (d < bd) { bd = d; best = i; } } const h = A.hoverKm(T.x[best], T.y[best], { show: true }); const top = (h.listed && h.listed.top) || []; window.__extra = { named: true, kind: h.kind, n: h.listed && h.listed.n, top: top.length, names: top.map(i => T.name[i]), tip: document.getElementById('tip').innerText, glyphs: document.querySelectorAll('#tip .gl').length, blocks: document.querySelectorAll('#cellinfo .lf:not(.more)').length }; } else window.__extra = { named: false }; }", tag + "names",
                      lambda r: [] if not r["extra"] or not r["extra"]["named"] or (r["extra"]["kind"] == "listed" and 1 <= r["extra"]["top"] <= 3 and all(r["extra"]["names"]) and r["extra"]["glyphs"] == min(r["extra"]["top"], 1 if w < 600 else 3) and r["extra"]["blocks"] == r["extra"]["top"] and (r["extra"]["n"] <= 3 or " more" in r["extra"]["tip"])) else [("names", "tip", json.dumps({k: r["extra"][k] for k in ("kind", "n", "top", "names")}) + " | " + r["extra"]["tip"][-160:])])
                # the listed rule by zoom: the quiet weight falls with the zoom, the ring reach and width stay within their caps and the cull margin
                def rules_ok(r):
                    x = r["extra"] or {}; bad = []
                    for name, L in x.items():
                        if not (44 - 1e-6 <= L["Rmax"] <= 64 + 1e-6 and 2.2 - 1e-6 <= L["W"] <= 3.5 + 1e-6): bad.append(("rule", name, "Rmax %.2f W %.2f" % (L["Rmax"], L["W"])))
                        if not (60 - 1e-6 <= L["spreadMs"] <= 200 + 1e-6 and L["decayMs"] == 1600 and L["pulseMs"] == 1800): bad.append(("rule", name, "spread %.1f decay %s pulse %s" % (L["spreadMs"], L["decayMs"], L["pulseMs"])))
                        if L["rMax"] + 2 + L["Rmax"] + L["W"] / 2 > L["cull"] or 2 * (L["rMax"] + L["flashMax"]) > L["cull"]: bad.append(("rule", name, "the flash, the glow or the ring exceed the cull margin"))
                    for name, L in x.items():   # q follows the zoom by the stated formula, 1 at the country, falling with k
                        qe = min(1, max(0, math.log2(60 / L["k"]) / math.log2(120)))
                        if abs(L["q"] - qe) > 1e-6: bad.append(("rule", name, "q %.3f at k %.3f, expected %.3f" % (L["q"], L["k"], qe)))
                    if x and not (abs(x["russia"]["q"] - 1) < 1e-6 and x["russia"]["q"] >= x["moscow"]["q"] >= x["central"]["q"] > 0): bad.append(("rule", "q", json.dumps({k: round(v["q"], 3) for k, v in x.items()})))
                    return bad
                state("share", 2021, F + "{ const out = {}; for (const [k, p] of [['russia', 'Russia'], ['moscow', 'Moscow'], ['central', 'Central Moscow (250 m)']]) { A.preset(p); out[k] = A.listedRule(); } window.__extra = out; A.preset('Moscow'); }", tag + "rules", rules_ok)
                # under prefers-reduced-motion the button highlights without animation: the count is there at once and the frame loop is not used
                cdp.call("Emulation.setEmulatedMedia", {"features": [{"name": "prefers-reduced-motion", "value": "reduce"}]})
                state("share", 2022, F + "A.preset('Moscow'); A.layer('share'); A.year(2022); await A.ready(); window.__extra = { pulsed: A.pulse(), expect: %s };" % (N22 % (2022, 8)), tag + "rmpulse", pulsed_is(2022, "under reduced motion the button still pulses (a still highlight)"))
                cdp.call("Emulation.setEmulatedMedia", {"features": [{"name": "prefers-reduced-motion", "value": ""}]})
            F0 = cdp.evaluate("window.__atlas.field()", await_promise=False); fields.add(F0)
            firms_states(GL if F0 in GL else ("2d",), "firms")
            # a lost context falls back to the 2D field and a restored one returns to WebGL (on a page that had it)
            state("share", 2021, F + "A.preset('Moscow'); A.loseContext(); await new Promise(r => setTimeout(r, 300));", "flost", field_is(("2d",), "after a lost context the 2D fallback draws"))
            state("share", 2021, F + "A.preset('Moscow'); A.restoreContext(); await new Promise(r => setTimeout(r, 600));", "frestore", field_is(GL if F0 in GL else ("2d",), "after a restored context WebGL draws again"))
            # a narrower viewport: every canvas follows the map's new size
            if w >= 768:
                cdp.call("Emulation.setDeviceMetricsOverride", {"width": w - 200, "height": a.height, "deviceScaleFactor": 1, "mobile": False}); time.sleep(0.4)
                state("share", 2021, F + "A.preset('Moscow');", "fresize", lambda r: [] if r["canvases"]["map"]["w"] < P["W"] and round(r["canvases"]["map"]["w"]) == r["canvases"]["marks"]["w"] and round(r["canvases"]["map"]["h"]) == r["canvases"]["marks"]["h"] else [("resize", "map", "after a resize the canvases are %s (the map was %s wide)" % (json.dumps(r["canvases"]), P["W"]))])
                cdp.call("Emulation.setDeviceMetricsOverride", {"width": w, "height": a.height, "deviceScaleFactor": 1, "mobile": False}); time.sleep(0.4)
            # the same firms states on the 2D fallback
            cdp.call("Page.navigate", {"url": url + "&__nogl=1"}); cdp.wait_event("Page.loadEventFired", timeout=60)
            cdp.evaluate("document.fonts.ready.then(() => true)", await_promise=True, timeout=60); time.sleep(0.5)
            fields.add(cdp.evaluate("window.__atlas.field()", await_promise=False))
            firms_states(("2d",), "nogl")
            cdp.call("Page.navigate", {"url": url}); cdp.wait_event("Page.loadEventFired", timeout=60)
            cdp.evaluate("document.fonts.ready.then(() => true)", await_promise=True, timeout=60); time.sleep(0.5)
            # the legend and the note, collapsed and expanded, at the national and the Moscow views
            state("share", 2021, "A.mode('cells'); A.preset('Russia'); A.legend(true); A.note(true);", "open")
            state("share", 2021, "A.mode('cells'); A.preset('Moscow'); A.legend(true); A.note(true);", "open")
            state("share", 2021, "A.mode('firms'); A.preset('Moscow'); A.legend(true); A.note(true);", "fopen")
            state("share", 2021, "A.mode('cells'); A.preset('Russia'); A.legend(false); A.note(false);", "closed")
            state("share", 2021, "A.mode('cells'); A.preset('Russia'); A.legend(null); A.note(null);", "-")
        finally:
            proc.terminate()
    head = "atlas audit: %d states, %d boxes, %d finding(s); field renderers seen: %s; tiles placed over the note or the legend for want of a clear place: %d (%s)" % (n_states, n_boxes, len(findings), ", ".join(sorted(fields)), n_relaxed, " ".join(relaxed))
    text = "\n".join([head] + sorted(set(findings))) + "\n"
    if a.out:
        with open(a.out, "w") as fh: fh.write(text)
    sys.stdout.write(text)
    return 1 if findings else 0

if __name__ == "__main__":
    sys.exit(main())
