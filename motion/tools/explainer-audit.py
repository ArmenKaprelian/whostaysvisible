#!/usr/bin/env python3
"""The explainer page's player audit (round 10, the author's item 20; 26 October 2026): headless Brave at 1,600 by 1,000 and 400 by 844.

Reads the overlay's boxes (the bar inside the stage box along its lower edge, the chapter list inside the stage when open, the buttons inside the bar,
none overlapping the time or the scrub bar), the hidden state (opacity 0 and visibility hidden 2.5 s after play with no input), the shown state (paused,
or after a mouse move), the fade duration from the computed transition (0.3 s; none under prefers-reduced-motion), the full-screen button's presence and
label and its fallback; writes the frames playing-hidden, paused-shown and chapters-open. Zero findings is the acceptance rule.

Usage: python3 -I motion/tools/explainer-audit.py --url http://127.0.0.1:8765/explainer.html [--sizes 1600x1000,400x844] [--out DIR]
"""
import argparse, base64, json, os, shutil, subprocess, sys, tempfile, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from capture import brave_flags, wait_port_file, page_ws_url, remove_profile
from cdp import CDP

def inside(a, b, tol=0.5): return a["x"] >= b["x"] - tol and a["y"] >= b["y"] - tol and a["x1"] <= b["x1"] + tol and a["y1"] <= b["y1"] + tol
def inter(a, b): return max(0, min(a["x1"], b["x1"]) - max(a["x"], b["x"])) * max(0, min(a["y1"], b["y1"]) - max(a["y"], b["y"]))

def run(url, w, h, out, findings):
    profile = tempfile.mkdtemp(prefix="explainer-audit-")
    proc = subprocess.Popen(brave_flags(profile, w, h) + ["about:blank"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        port = wait_port_file(profile, proc); cdp = CDP(page_ws_url(port)); cdp.call("Page.enable"); cdp.call("Runtime.enable")
        cdp.call("Emulation.setDeviceMetricsOverride", {"width": w, "height": h, "deviceScaleFactor": 1, "mobile": w < 700})
        def load(reduce=False):
            cdp.call("Emulation.setEmulatedMedia", {"features": [{"name": "prefers-reduced-motion", "value": "reduce" if reduce else "no-preference"}]})
            cdp.call("Page.navigate", {"url": url + "?v=paudit" + str(int(time.time() * 1000))}); cdp.wait_event("Page.loadEventFired", timeout=90)
            cdp.evaluate("window.__ready.then(() => true)", await_promise=True, timeout=120); time.sleep(0.3)
        def st(): return cdp.evaluate("window.__player.state()", await_promise=False)
        def bad(kind, msg): findings.append((w, kind, msg)); print("  %d px  %-10s %s" % (w, kind, msg))
        def shot(name):
            png = base64.b64decode(cdp.call("Page.captureScreenshot", {"format": "png"})["data"]); p = os.path.join(out, "%s-%d.png" % (name, w)); open(p, "wb").write(png)
        load()
        # the console greeting (round 12, part D, item 4): the load logs exactly one message, the greeting, and no error or warning
        msgs = [(e["params"]["type"], " ".join(str(x.get("value", x.get("description", ""))) for x in e["params"].get("args", []))) for e in cdp.events if e.get("method") == "Runtime.consoleAPICalled"]
        greet = [m for m in msgs if m[0] == "log" and "Who stays visible? · Armen G. Kaprelian" in m[1] and "github.com/ArmenKaprelian/whostaysvisible" in m[1] and "Built from " in m[1]]
        if len(msgs) != 1 or len(greet) != 1: bad("console", "the load logged %d message(s), expected the greeting alone: %s" % (len(msgs), json.dumps(msgs)[:200]))
        if cdp.problems: bad("console", "errors or warnings on load: %s" % json.dumps(cdp.problems)[:200])
        s = st(); b = s["boxes"]; stage = {"x": 0, "y": 0, "x1": s["stage"]["w"], "y1": s["stage"]["h"]}
        # the stage box: 16:9 within a pixel, inside the viewport, bound by the width or the height
        if abs(s["stage"]["w"] / s["stage"]["h"] - 16 / 9) > 0.01: bad("stage", "aspect %.3f" % (s["stage"]["w"] / s["stage"]["h"]))
        if s["stage"]["y"] + s["stage"]["h"] > h + 0.5 or s["stage"]["x"] < 0: bad("stage", "outside the viewport: %s" % json.dumps(s["stage"]))
        availW = w - 32; chrome = float(s["chromeH"].replace("px", "")) if s["chromeH"].endswith("px") else 240.0
        if not (abs(s["stage"]["w"] - availW) < 1.5 or abs(s["stage"]["h"] - (h - chrome)) < 1.5): bad("stage", "neither the width (%s of %s) nor the height (%s of %s) binds" % (s["stage"]["w"], availW, s["stage"]["h"], h - chrome))
        # the bar along the lower edge, inside the stage; the buttons inside the bar; none overlapping the time or the scrub
        c = b["controls"]
        if not c["visible"]: bad("bar", "not visible on load")
        if not inside(c, stage): bad("bar", "outside the stage %s" % json.dumps(c))
        if abs(c["y1"] - stage["y1"]) > 1 or abs(c["x"] - stage["x"]) > 1 or abs(c["x1"] - stage["x1"]) > 1: bad("bar", "not along the lower edge: %s stage %s" % (json.dumps(c), json.dumps(stage)))
        names = ["play", "cut", "time", "scrub", "chaptersbtn", "fsbtn"]
        for n in names:
            if not inside(b[n], c, 1): bad("bar", "%s outside the bar %s" % (n, json.dumps(b[n])))
        for i in range(len(names)):
            for j in range(i + 1, len(names)):
                if inter(b[names[i]], b[names[j]]) > 0: bad("bar", "%s overlaps %s" % (names[i], names[j]))
        if b["fsbtn"]["x1"] - b["fsbtn"]["x"] < 24 or b["fsbtn"]["y1"] - b["fsbtn"]["y"] < 24: bad("bar", "the full-screen button is under 24 px")
        if s["fsLabel"] != "Full screen": bad("fs", "label %r" % s["fsLabel"])
        if s["transition"].split(",")[0].strip() not in ("0.3s",): bad("fade", "transition %r, expected 0.3s" % s["transition"])
        if s["away"] or s["chapters"]: bad("state", "on load: away %s chapters %s" % (s["away"], s["chapters"]))
        # paused and shown (the frame at 6 s, where the hook has drawn; the first frame is dark)
        cdp.evaluate("window.__seek(6).then(() => true)", await_promise=True, timeout=60); time.sleep(0.2); shot("paused-shown")
        # playing: hidden 2.5 s after the last input with no input
        cdp.evaluate("window.__player.play()", await_promise=False); time.sleep(3.0); s2 = st()
        if not (s2["playing"] and s2["away"] and s2["opacity"] == "0" and s2["visibility"] == "hidden"): bad("hide", "2.5 s into play: playing %s away %s opacity %s visibility %s" % (s2["playing"], s2["away"], s2["opacity"], s2["visibility"]))
        shot("playing-hidden")
        # a mouse move shows it again; then it hides again; a pause shows it
        cdp.call("Input.dispatchMouseEvent", {"type": "mouseMoved", "x": w // 2, "y": h // 3}); time.sleep(0.45); s3 = st()
        if s3["away"] or s3["visibility"] != "visible" or float(s3["opacity"]) < 0.99: bad("show", "after a mouse move: away %s opacity %s visibility %s" % (s3["away"], s3["opacity"], s3["visibility"]))
        time.sleep(3.0); s4 = st()
        if not s4["away"]: bad("hide", "not hidden again 2.5 s after the mouse move")
        cdp.evaluate("window.__player.pause()", await_promise=False); time.sleep(0.4); s5 = st()
        if s5["playing"] or s5["away"]: bad("show", "after pause: playing %s away %s" % (s5["playing"], s5["away"]))
        # the chapter list: inside the stage, above the bar, focus on a chapter button; Escape closes it and returns focus
        cdp.evaluate("window.__player.chapters(true)", await_promise=False); time.sleep(0.2); s6 = st(); ch = s6["boxes"]["chapters"]
        if not (s6["chapters"] and ch["visible"]): bad("chapters", "not open")
        if not inside(ch, stage, 3.5): bad("chapters", "outside the stage %s" % json.dumps(ch))
        if ch["y1"] > s6["boxes"]["controls"]["y"] + 1: bad("chapters", "not above the bar: list bottom %.1f bar top %.1f" % (ch["y1"], s6["boxes"]["controls"]["y"]))
        if not s6["focusInChapters"]: bad("chapters", "focus did not move into the list")
        hb = {"x": ch["x"], "y": -1e9, "x1": ch["x1"], "y1": 1e9} if s6["chaptersScroll"] else ch   # a list taller than the stage scrolls inside its box: the buttons are held horizontally
        if not s6["boxes"]["chapterButtons"] or any(not inside(x, hb, 1) for x in s6["boxes"]["chapterButtons"]): bad("chapters", "a chapter button lies outside the list")
        shot("chapters-open")
        cdp.call("Input.dispatchKeyEvent", {"type": "keyDown", "key": "Escape", "code": "Escape", "windowsVirtualKeyCode": 27}); cdp.call("Input.dispatchKeyEvent", {"type": "keyUp", "key": "Escape", "code": "Escape", "windowsVirtualKeyCode": 27}); time.sleep(0.2); s7 = st()
        if s7["chapters"] or not s7["focusOnChaptersBtn"]: bad("chapters", "Escape: open %s, focus on the CHAPTERS button %s" % (s7["chapters"], s7["focusOnChaptersBtn"]))
        # full screen: the API needs a gesture, so headless takes the fallback; the box then fills the viewport and the label changes; the same button leaves
        on = cdp.evaluate("window.__player.fs()", await_promise=True); s8 = st()
        if not (on and s8["fs"] and s8["fsLabel"] == "Leave full screen"): bad("fs", "entering: %s label %r" % (on, s8["fsLabel"]))
        if abs(s8["stage"]["x"]) > 1 or abs(s8["stage"]["y"]) > 1 or abs(s8["stage"]["w"] - w) > 1 or abs(s8["stage"]["h"] - h) > 1: bad("fs", "the stage box does not fill the viewport: %s" % json.dumps(s8["stage"]))
        off = cdp.evaluate("window.__player.fs()", await_promise=True); s9 = st()
        if off or s9["fs"] or s9["fsLabel"] != "Full screen": bad("fs", "leaving: %s label %r" % (off, s9["fsLabel"]))
        # reduced motion: no fade
        load(reduce=True); s10 = st()
        if s10["transition"].split(",")[0].strip() not in ("0s",): bad("fade", "under reduced motion the transition is %r" % s10["transition"])
    finally:
        proc.terminate()
        try: proc.wait(timeout=20)
        except subprocess.TimeoutExpired: proc.kill(); proc.wait(timeout=10)
        remove_profile(profile)   # the profile goes with its browser (they had piled up in /tmp, a tmpfs here)

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--url", required=True); ap.add_argument("--sizes", default="1600x1000,400x844"); ap.add_argument("--out", default="motion/build/r12-player")
    a = ap.parse_args(); os.makedirs(a.out, exist_ok=True); findings = []
    for sz in a.sizes.split(","):
        w, h = [int(v) for v in sz.split("x")]; print("explainer audit at %d by %d" % (w, h)); run(a.url, w, h, a.out, findings)
    print("explainer audit: %d finding(s)" % len(findings)); sys.exit(1 if findings else 0)

if __name__ == "__main__":
    main()
