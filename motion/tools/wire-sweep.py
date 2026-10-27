#!/usr/bin/env python3
"""The data wire's offset per frame while the cursor sweeps across regions (round 16, the author's item of 27 October 2026).

The author saw the wire stutter on the published atlas while the cursor crossed regions. This tool records what the
viewer sees: every frame's time and the on-screen position of one wire item (the next item past the window's middle once
the last one leaves), with the window's left edge, the track's transform and every region change and every new scroll
animation the page starts (the track's animate() is wrapped for the record; nothing else on the page is touched). The
cursor rests outside the map, then sweeps a fixed zig-zag across European Russia and the Urals through the browser's own
input (CDP mouse events), then rests again. The wire scrolls at 60 px per second, so each frame is judged against time:
a hold is a frame interval in which the item moved at under half that speed, a jump an interval more than 3 px off the
ideal, a step back any rightward move.

Headless Brave at the author's window (1,822 by 1,397 CSS px at 1.333) with threaded animation on (capture.py's flags turn
it off for still frames, which would change what is measured). The profile is removed when the browser exits.
Usage: python3 -I motion/tools/wire-sweep.py --out DIR [--url http://127.0.0.1:8765/explorer.html] [--mode firms|cells]
       [--label NAME] [--sweep 12] [--dpr 1.333] [--width 1822 --height 1397]"""
import argparse, json, os, socket, statistics, subprocess, sys, tempfile, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from capture import BRAVE, wait_port_file, page_ws_url, remove_profile
from cdp import CDP

SPEED, HOLD, JUMP = 60.0, 0.5, 3.0   # px per second; a hold below half the speed; a jump more than 3 px off the ideal

RECORDER = r"""(() => {
  const R = window.__wireRec = { frames: [], events: [], seg: 0, on: true }, tr = document.getElementById('wiretrack'), win = document.getElementById('ctxwin');
  const anim = tr.animate.bind(tr); tr.animate = (...a) => { R.events.push({ t: performance.now(), kind: 'animate' }); return anim(...a); };
  const live = () => { const a = document.getElementById('ctxA'), b = document.getElementById('ctxB'); return (a && a.classList.contains('live') ? a : b) || a; };
  let ref = null, slot = null;
  const step = t => {
    if (!R.on) return;
    const wr = win.getBoundingClientRect();
    if (ref && (!ref.isConnected || ref.getBoundingClientRect().right < wr.left + 20)) ref = null;
    if (!ref) { for (const el of tr.querySelectorAll('.wi')) { const r = el.getBoundingClientRect(); if (r.left > wr.left + wr.width / 2 && r.left < wr.right) { ref = el; break; } } R.seg++; }
    const s = live() ? live().textContent.trim() : ''; if (s !== slot) { R.events.push({ t, kind: 'slot', text: s }); slot = s; }
    if (window.__wireEvents) while (window.__wireEvents.length) R.events.push(window.__wireEvents.shift());   // a later build's own events, if it has them
    const m = getComputedStyle(tr).transform, tx = m && m !== 'none' ? parseFloat(m.split(',')[4]) : 0;
    R.frames.push([+t.toFixed(2), ref ? +ref.getBoundingClientRect().left.toFixed(2) : null, R.seg, +tx.toFixed(2), +wr.left.toFixed(2)]);
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step); return true;
})()"""

def flags(profile, w, h, dpr):
    return [BRAVE, "--headless=new", "--user-data-dir=" + profile, "--window-size=%d,%d" % (w, h), "--hide-scrollbars",
            "--force-device-scale-factor=%s" % dpr, "--force-color-profile=srgb", "--disable-background-timer-throttling",
            "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows", "--no-first-run", "--no-default-browser-check",
            "--disable-extensions", "--disable-component-update", "--disable-background-networking", "--disable-sync",
            "--disable-brave-extension", "--disable-brave-rewards-extension", "--mute-audio", "--lang=en-US", "--disable-dev-shm-usage",
            "--remote-debugging-port=0"]

def port_open(port):
    with socket.socket() as s:
        s.settimeout(0.3)
        return s.connect_ex(("127.0.0.1", port)) == 0

def analyse(frames, events, t0, t1):
    rows = [f for f in frames if f[1] is not None and t0 <= f[0] <= t1]
    holds, jumps, backs, dts = [], [], [], []
    for p, q in zip(rows, rows[1:]):
        if p[2] != q[2]: continue   # a new reference item: the interval is not a move
        dt = (q[0] - p[0]) / 1000.0; dx = q[1] - p[1]
        if dt <= 0: continue
        dts.append(dt * 1000)
        if dx > 0.5: backs.append({"t": p[0], "dx": round(dx, 2)})
        if dt >= 0.008 and -dx / dt < SPEED * HOLD: holds.append({"t": p[0], "ms": round(dt * 1000, 1), "moved": round(-dx, 2)})
        if abs(dx + SPEED * dt) > JUMP: jumps.append({"t": p[0], "off_px": round(dx + SPEED * dt, 2)})
    ev = [e for e in events if t0 <= e["t"] <= t1]
    slots = [e for e in ev if e["kind"] == "slot"]; anims = [e for e in ev if e["kind"] == "animate"]
    near = sum(1 for h in holds if any(0 <= h["t"] - a["t"] <= 50 or 0 <= a["t"] - h["t"] <= 20 for a in anims))
    return {"frames": len(rows), "median_frame_ms": round(statistics.median(dts), 2) if dts else None,
            "holds": len(holds), "hold_ms_total": round(sum(h["ms"] for h in holds), 1), "hold_ms_max": max((h["ms"] for h in holds), default=0),
            "holds_at_a_restart": near, "jumps": len(jumps), "steps_back": len(backs), "region_changes": max(0, len(slots) - 1), "animation_restarts": len(anims),
            "hold_list": holds[:200], "jump_list": jumps[:200], "back_list": backs[:200]}

def chart(frames, events, phases, path, title=""):   # the item's speed per frame against the ideal 60 px per second, region changes and new animations marked
    W, H, L, B, T = 1400, 300, 64, 34, 26
    rows = [f for f in frames if f[1] is not None]
    if len(rows) < 2: return
    t0 = rows[0][0]; tmax = rows[-1][0] - t0; top = 2.2 * SPEED
    X = lambda t: L + (W - L - 12) * t / max(tmax, 1); Y = lambda v: T + (H - B - T) * (top - min(max(v, 0), top)) / top
    out = ['<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" font-family="IBM Plex Mono, monospace" font-size="12">' % (W, H),
           '<rect width="100%" height="100%" fill="#03060E"/>', '<text x="%d" y="17" fill="#ECEEF1">%s</text>' % (L, title)]
    for name, a, b in phases: out.append('<rect x="%.1f" y="%d" width="%.1f" height="%d" fill="#091023"/><text x="%.1f" y="%d" fill="#7D889C">%s</text>' % (X(a - t0), T, X(b - t0) - X(a - t0), H - B - T, X(a - t0) + 4, T + 14, name))
    for v in (0, SPEED, 2 * SPEED): out.append('<line x1="%d" x2="%d" y1="%.1f" y2="%.1f" stroke="%s"/><text x="6" y="%.1f" fill="#B4C0D0">%d px/s</text>' % (L, W - 12, Y(v), Y(v), "#2E333D" if v != SPEED else "#7D889C", Y(v) + 4, v))
    for e in events:
        if e["t"] < t0: continue
        if e["kind"] == "slot": out.append('<line x1="%.1f" x2="%.1f" y1="%d" y2="%d" stroke="#FF45C8" stroke-opacity="0.45"/>' % (X(e["t"] - t0), X(e["t"] - t0), T, H - B))
        elif e["kind"] == "animate": out.append('<line x1="%.1f" x2="%.1f" y1="%d" y2="%d" stroke="#4DFF7F" stroke-width="2"/>' % (X(e["t"] - t0), X(e["t"] - t0), H - B - 10, H - B))
    pts = []
    for p, q in zip(rows, rows[1:]):
        if p[2] != q[2] or q[0] <= p[0]: continue
        v = -(q[1] - p[1]) / ((q[0] - p[0]) / 1000.0); pts.append("%.1f,%.1f %.1f,%.1f" % (X(p[0] - t0), Y(v), X(q[0] - t0), Y(v)))
    out.append('<polyline fill="none" stroke="#CFE6FF" stroke-width="1.3" points="%s"/>' % " ".join(pts))
    out.append('<text x="%d" y="%d" fill="#B4C0D0">%.0f s</text>' % (W - 52, H - 10, tmax / 1000))
    out.append('<text x="%d" y="%d" fill="#B4C0D0">the wire item&#8217;s speed per frame (ice); fuchsia lines: the first slot changes; green ticks: a new scroll animation</text></svg>' % (L, H - 10))
    open(path, "w", encoding="utf-8").write("\n".join(out))

def redraw(record_path, title):   # a chart again from a saved record
    d = json.load(open(record_path)); chart(d["frames"], d["events"], d["phases"], record_path[:-5] + ".svg", title)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://127.0.0.1:8765/explorer.html"); ap.add_argument("--out", required=True); ap.add_argument("--label", default="run")
    ap.add_argument("--mode", default="firms", choices=["firms", "cells"]); ap.add_argument("--sweep", type=float, default=12.0)
    ap.add_argument("--dpr", default="1.333"); ap.add_argument("--width", type=int, default=1822); ap.add_argument("--height", type=int, default=1397)
    ap.add_argument("--query", default="", help="extra query string for the page, e.g. v=WS1")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    server = None
    if not port_open(8765):
        server = subprocess.Popen([sys.executable, "-I", os.path.join(os.path.dirname(os.path.abspath(__file__)), "serve.py")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(50):
            if port_open(8765): break
            time.sleep(0.1)
    profile = tempfile.mkdtemp(prefix="wiresweep-")
    proc = subprocess.Popen(flags(profile, a.width, a.height, a.dpr) + ["about:blank"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        port = wait_port_file(profile, proc); cdp = CDP(page_ws_url(port)); cdp.call("Page.enable"); cdp.call("Runtime.enable")
        url = a.url + ("&" if "?" in a.url else "?") + "ws=" + str(int(time.time())) + ("&" + a.query if a.query else "")
        cdp.call("Page.navigate", {"url": url}); cdp.wait_event("Page.loadEventFired", timeout=90)
        cdp.evaluate("document.fonts.ready.then(() => true)", await_promise=True, timeout=60)
        cdp.evaluate("(async () => { const A = window.__atlas; A.mode(%s); A.preset('Russia'); await A.ready(); return true; })()" % json.dumps(a.mode), await_promise=True, timeout=120)
        rect = cdp.evaluate("(() => { const r = document.querySelector('.mapwrap').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()")
        mx, my, mw, mh = rect
        cdp.call("Input.dispatchMouseEvent", {"type": "mouseMoved", "x": mx + mw + 30, "y": my + 40})   # the cursor rests on the column, off the map
        time.sleep(4.0)   # the wire settles into its scroll
        cdp.evaluate(RECORDER)
        now = lambda: cdp.evaluate("performance.now()")
        phases = []
        t = now(); time.sleep(3.0); phases.append(("rest", t, now()))
        # the zig-zag across European Russia and the Urals, in fractions of the map (the Russia view)
        legs = [(0.06, 0.40), (0.38, 0.46), (0.08, 0.56), (0.40, 0.62), (0.10, 0.70), (0.42, 0.74), (0.20, 0.50)]
        pts = []
        for (x0, y0), (x1, y1) in zip(legs, legs[1:]):
            for i in range(60): f = i / 60; pts.append((mx + mw * (x0 + (x1 - x0) * f), my + mh * (y0 + (y1 - y0) * f)))
        dt = a.sweep / len(pts)
        t = now()
        for x, y in pts:
            cdp.call("Input.dispatchMouseEvent", {"type": "mouseMoved", "x": x, "y": y}); time.sleep(dt)
        phases.append(("sweep", t, now()))
        cdp.call("Input.dispatchMouseEvent", {"type": "mouseMoved", "x": mx + mw + 30, "y": my + 40})
        t = now(); time.sleep(3.0); phases.append(("rest after", t, now()))
        rec = cdp.evaluate("(() => { const R = window.__wireRec; R.on = false; return { frames: R.frames, events: R.events }; })()", timeout=120)
        summary = {"label": a.label, "mode": a.mode, "url": url, "window": [a.width, a.height], "dpr": a.dpr, "sweep_s": a.sweep, "moves": len(pts),
                   "phases": {name: analyse(rec["frames"], rec["events"], t0, t1) for name, t0, t1 in phases}}
        base = os.path.join(a.out, "wire-%s-%s" % (a.label, a.mode))
        json.dump({"summary": summary, "phases": phases, "frames": rec["frames"], "events": rec["events"]}, open(base + ".json", "w"), separators=(",", ":"))
        chart(rec["frames"], rec["events"], phases, base + ".svg", "%s, %s view" % (a.label, a.mode))
        for name, s in summary["phases"].items():
            print("%-10s %4d frames (median %s ms): %3d holds (%6.1f ms in all, max %5.1f ms, %d at a restart), %3d jumps, %2d steps back; %3d region changes, %3d new scroll animations" % (
                name, s["frames"], s["median_frame_ms"], s["holds"], s["hold_ms_total"], s["hold_ms_max"], s["holds_at_a_restart"], s["jumps"], s["steps_back"], s["region_changes"], s["animation_restarts"]))
        print("record:", base + ".json", "chart:", base + ".svg")
    finally:
        proc.terminate()
        try: proc.wait(timeout=20)
        except subprocess.TimeoutExpired: proc.kill(); proc.wait(timeout=10)
        remove_profile(profile)   # the profile goes with its browser (/tmp is a tmpfs here)
        if server: server.terminate(); server.wait(timeout=10)

if __name__ == "__main__":
    main()
