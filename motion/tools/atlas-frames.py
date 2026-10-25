#!/usr/bin/env python3
"""Reproducible atlas frames through headless Brave (round 9, 25 October 2026).

Each shot is one JSON object on the command line or in a --shots file: {"name", "preset", "mode", "layer", "year",
"pulse" (ms into the pulse, frozen through __atlas.pulseAt; without it any automatic pulse a year step started is ended, so the frame is at rest), "hover" ("red": the nearest red listed mark to the
preset's city in the shown year; "rim": the nearest rimmed one; "city": the preset city's own point; [x, y]: km), "focus" (an element id to show with its
focus-visible ring), "hoverpseudo" (an element id held in its :hover state through CSS.forcePseudoState; round 10), "jump" ([k] or [cx, cy, km-space k]: an instant camera jump after the preset, the centre kept when only k is given; round 10, the F13 checkpoint), "legend" (true: the legend opened), "tip" (true: the strip shows its first tip; round 10), "js" (a statement run after the setup, such as scrolling the side column), "tap" ([px, py] in CSS px: a touch tap through __atlas.tapAt), "live" (true: hold the cursor layer's moving state through __atlas.live), "swatches" (true: a strip of the page's colour tokens along the bottom), "theme" ("dark" | "light"),
"dpr", "crop" ([x, y, w, h] in CSS px, scaled by --zoom)}. Nothing on the page is changed beyond the shot's own state.

Usage: python3 -I motion/tools/atlas-frames.py --url http://127.0.0.1:8765/explorer.html --out DIR [--width 1600 --height 1000]
       [--zoom 3] --shots shots.json | --shot '{...}' ...
"""
import argparse, base64, json, os, subprocess, sys, tempfile, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from capture import brave_flags, wait_port_file, page_ws_url
from cdp import CDP

TOKENS = ["stage", "land", "panel", "panel-2", "grid", "graticule", "border", "below", "dim", "muted", "ink", "treated", "accent", "accent-strong", "fall", "rise",
          "cursor", "cursor-live", "context", "context-live"]

SWATCH_JS = """(() => {
  const css = getComputedStyle(document.documentElement), tok = n => css.getPropertyValue('--' + n).trim();
  const lum = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return ((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)).toFixed(2); };
  const panel = tok('panel'), land = tok('land');
  const old = document.getElementById('swatchstrip'); if (old) old.remove();
  const s = document.createElement('div'); s.id = 'swatchstrip';
  s.style.cssText = 'position:fixed;left:0;right:0;bottom:0;display:flex;gap:6px;padding:8px 12px;background:' + tok('stage') + ';border-top:1px solid ' + tok('border') + ';z-index:99;font:11px/1.25 ' + css.getPropertyValue('--font');
  for (const n of %s) {
    const v = tok(n); if (!v) continue;
    const d = document.createElement('div'); d.style.cssText = 'flex:1 1 0;min-width:0;color:' + tok('ink');
    const sw = document.createElement('div'); sw.style.cssText = 'height:34px;border-radius:3px;background:' + v + ';border:1px solid ' + tok('border');
    const t = document.createElement('div'); t.style.cssText = 'margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums';
    t.innerHTML = '<b>' + n + '</b><br>' + v.toUpperCase() + '<br>' + (v.startsWith('#') && v.length === 7 ? 'panel ' + ratio(v, panel) + ' land ' + ratio(v, land) : '');
    d.appendChild(sw); d.appendChild(t); s.appendChild(d);
  }
  document.body.appendChild(s); return s.children.length;
})()"""

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", required=True); ap.add_argument("--out", required=True)
    ap.add_argument("--width", type=int, default=1600); ap.add_argument("--height", type=int, default=1000)
    ap.add_argument("--zoom", type=int, default=3); ap.add_argument("--shots"); ap.add_argument("--shot", action="append", default=[])
    a = ap.parse_args()
    shots = [json.loads(s) for s in a.shot]
    if a.shots: shots += json.load(open(a.shots, encoding="utf-8"))
    os.makedirs(a.out, exist_ok=True)
    profile = tempfile.mkdtemp(prefix="frames-")
    proc = subprocess.Popen(brave_flags(profile, a.width, a.height) + ["about:blank"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        port = wait_port_file(profile, proc); cdp = CDP(page_ws_url(port)); cdp.call("Page.enable"); cdp.call("Runtime.enable"); cdp.call("DOM.enable"); cdp.call("CSS.enable")
        cur = None; themeScript = None
        for sh in shots:
            dpr = sh.get("dpr", 1); theme = sh.get("theme", "dark")
            if cur != (dpr, theme):
                cdp.call("Emulation.setDeviceMetricsOverride", {"width": a.width, "height": a.height, "deviceScaleFactor": dpr, "mobile": False})
                cdp.call("Emulation.setEmulatedMedia", {"features": [{"name": "prefers-color-scheme", "value": theme}]})   # for pages that still read the browser scheme (round 9 and before); the round-10 page reads the remembered choice below
                if themeScript is not None: cdp.call("Page.removeScriptToEvaluateOnNewDocument", {"identifier": themeScript})
                themeScript = cdp.call("Page.addScriptToEvaluateOnNewDocument", {"source": "try { localStorage.setItem('atlas-theme', %s); } catch (e) {}" % json.dumps(theme)})["identifier"]   # the page no longer reads the browser scheme (round 10): a light shot is a remembered choice
                cdp.call("Page.navigate", {"url": a.url + "?v=frames" + str(int(time.time()))}); cdp.wait_event("Page.loadEventFired", timeout=60)
                cdp.evaluate("document.fonts.ready.then(() => true)", await_promise=True, timeout=60); time.sleep(0.4); cur = (dpr, theme)
            js = """(async () => { const A = window.__atlas; A.pulseAt(null); A.mode(%s); if (%s) A.layer(%s); A.preset(%s); A.year(%d); await A.ready(); { const J = %s; if (Array.isArray(J)) { const c0 = A.camera(); await A.jump(J.length >= 3 ? { cx: J[0], cy: J[1], k: J[2] } : { cx: c0.cx, cy: c0.cy, k: J[0] }); } } if (%s == null) A.pulseAt(null); A.redraw(); if (%s) A.legend(true); if (%s) { A.tip('reset'); A.tip(true); } %s
              let hit = null; const H = %s;
              if (H === 'red' || H === 'rim') { const T = MOTION_DATA.treatednational, m = A.cities[%s] || A.camera() && [A.camera().cx, A.camera().cy], yi = %d - 2014; let b = -1, bd = Infinity;
                for (let i = 0; i < T.n; i++) { const ok = H === 'red' ? (T.red_from[i] <= %d && T.filed[i][yi] !== '-') : (T.red_from[i] > %d && T.filed[i][yi] !== '-'); if (!ok) continue; const d = Math.hypot(T.x[i] - m[0], T.y[i] - m[1]); if (d < bd) { bd = d; b = i; } }
                if (b >= 0) hit = A.hoverKm(T.x[b], T.y[b], { show: true }); }
              else if (H === 'city') { const mm = A.cities[%s] || A.cities.Moscow; hit = A.hoverKm(mm[0], mm[1], { show: true }); }
              else if (Array.isArray(H)) hit = A.hoverKm(H[0], H[1], { show: true });
              else if (A.hoverOff) A.hoverOff();
              const T2 = %s; if (Array.isArray(T2)) hit = A.tapAt(T2[0], T2[1]);
              if (%s != null) A.pulseAt(%s);
              if (%s && A.live) A.live(true);
              return { kind: hit && hit.kind, pulsing: A.pulsing() }; })()""" % (
                json.dumps(sh.get("mode", "firms")), "true" if sh.get("layer") else "false", json.dumps(sh.get("layer", "share")), json.dumps(sh.get("preset", "Russia")), sh.get("year", 2021), json.dumps(sh.get("jump")), json.dumps(sh.get("pulse")), "true" if sh.get("legend") else "false", "true" if sh.get("tip") else "false", sh.get("js", ""),
                json.dumps(sh.get("hover")), json.dumps(sh.get("city", sh.get("preset", "Moscow").split(" (")[0])), sh.get("year", 2021), sh.get("year", 2021), sh.get("year", 2021),
                json.dumps(sh.get("city", sh.get("preset", "Moscow").split(" (")[0])), json.dumps(sh.get("tap")), json.dumps(sh.get("pulse")), json.dumps(sh.get("pulse")), "true" if sh.get("live") else "false")
            r = cdp.evaluate(js, await_promise=True, timeout=120)
            if sh.get("focus"):
                node = cdp.call("DOM.getDocument", {"depth": 1})["root"]["nodeId"]
                nid = cdp.call("DOM.querySelector", {"nodeId": node, "selector": "#" + sh["focus"]})["nodeId"]
                cdp.call("CSS.forcePseudoState", {"nodeId": nid, "forcedPseudoClasses": ["focus-visible", "focus"]})
            if sh.get("hoverpseudo"):
                node = cdp.call("DOM.getDocument", {"depth": 1})["root"]["nodeId"]
                hid = cdp.call("DOM.querySelector", {"nodeId": node, "selector": "#" + sh["hoverpseudo"]})["nodeId"]
                cdp.call("CSS.forcePseudoState", {"nodeId": hid, "forcedPseudoClasses": ["hover"]}); time.sleep(0.2)
            if sh.get("swatches"): cdp.evaluate(SWATCH_JS % json.dumps(sh.get("tokens", TOKENS)), await_promise=False)   # "tokens": a list of token names for the strip (round 10)
            time.sleep(0.25)
            png = base64.b64decode(cdp.call("Page.captureScreenshot", {"format": "png"})["data"])
            path = os.path.join(a.out, sh["name"] + ".png"); open(path, "wb").write(png)
            if sh.get("crop"):
                x, y, w, h = sh["crop"]; z = a.zoom
                subprocess.run(["magick", path, "-crop", "%dx%d+%d+%d" % (w * dpr, h * dpr, x * dpr, y * dpr), "+repage", "-filter", "point", "-resize", "%d%%" % (100 * z), os.path.join(a.out, sh["name"] + "-x%d.png" % z)], check=True)
            if sh.get("swatches"): cdp.evaluate("(() => { const s = document.getElementById('swatchstrip'); if (s) s.remove(); return true; })()", await_promise=False)
            if sh.get("focus"): cdp.call("CSS.forcePseudoState", {"nodeId": nid, "forcedPseudoClasses": []})
            if sh.get("hoverpseudo"): cdp.call("CSS.forcePseudoState", {"nodeId": hid, "forcedPseudoClasses": []})
            cdp.evaluate("(() => { const A = window.__atlas; A.pulseAt(null); if (A.still) A.still(); return true; })()", await_promise=False)
            print(sh["name"], json.dumps(r), os.path.getsize(path), "bytes")
    finally:
        proc.terminate()

if __name__ == "__main__":
    main()
