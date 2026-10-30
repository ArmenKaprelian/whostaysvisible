#!/usr/bin/env python3
"""Load the atlas (or any page) once in headless Brave with chosen variants, run a script in it, print the result as JSON (round 16, the
author's request of 27 October 2026: the probes each round rebuilt, kept as one tool).

The page loads at the given window and device ratio, with ?opt= when given; the tool waits for the fonts and, on the atlas, for
window.__atlas.ready(); then it evaluates the script (an expression or an async IIFE; awaited) and prints {"result": ..., "problems": [...]},
the problems being the page's exceptions and console errors. --shot saves a screenshot after the script. The browser's profile is removed
when it finishes (capture.remove_profile). Needs tools/serve.py on 127.0.0.1:8765 for the lab's pages.
Usage: python3 -I motion/tools/page-probe.py [--url http://127.0.0.1:8765/explorer.html] [--opt 8Gb,wsA] [--width 1600 --height 1000 --dpr 1]
       [--wait 0.5] (--js "window.__atlas.ghost()" | --js-file probe.js) [--shot out.png]"""
import argparse, base64, json, os, subprocess, sys, tempfile, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from capture import brave_flags, wait_port_file, page_ws_url, remove_profile
from cdp import CDP

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://127.0.0.1:8765/explorer.html"); ap.add_argument("--opt", default=None)
    ap.add_argument("--width", type=int, default=1600); ap.add_argument("--height", type=int, default=1000); ap.add_argument("--dpr", type=float, default=1.0)
    ap.add_argument("--wait", type=float, default=0.5)
    ap.add_argument("--js", default=None); ap.add_argument("--js-file", default=None); ap.add_argument("--shot", default=None)
    a = ap.parse_args()
    js = a.js if a.js is not None else (open(a.js_file, encoding="utf-8").read() if a.js_file else "true")
    url = a.url + ("&" if "?" in a.url else "?") + "probe=%d" % time.time() + ("&opt=" + a.opt if a.opt else "")
    profile = tempfile.mkdtemp(prefix="probe-")
    proc = subprocess.Popen(brave_flags(profile, a.width, a.height) + ["about:blank"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        cdp = CDP(page_ws_url(wait_port_file(profile, proc))); cdp.call("Page.enable"); cdp.call("Runtime.enable")
        cdp.call("Emulation.setDeviceMetricsOverride", {"width": a.width, "height": a.height, "deviceScaleFactor": a.dpr, "mobile": False})
        cdp.call("Page.navigate", {"url": url}); cdp.wait_event("Page.loadEventFired", timeout=90)
        cdp.evaluate("document.fonts.ready.then(() => true)", await_promise=True, timeout=60)
        cdp.evaluate("(async () => { if (window.__atlas && window.__atlas.ready) await window.__atlas.ready(); return true; })()", await_promise=True, timeout=120)
        time.sleep(a.wait)
        result = cdp.evaluate(js, await_promise=True, timeout=180)
        if a.shot: open(a.shot, "wb").write(base64.b64decode(cdp.call("Page.captureScreenshot", {"format": "png"})["data"]))
        print(json.dumps({"result": result, "problems": list(getattr(cdp, "problems", []))[:20]}, ensure_ascii=False))
    finally:
        proc.terminate()
        try: proc.wait(timeout=20)
        except subprocess.TimeoutExpired: proc.kill(); proc.wait(timeout=10)
        remove_profile(profile)   # the profile goes with its browser (/tmp is a tmpfs here)

if __name__ == "__main__":
    main()
