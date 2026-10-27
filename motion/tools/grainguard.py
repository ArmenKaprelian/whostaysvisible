#!/usr/bin/env python3
"""The surface grain's contrast guard (round 10, the author's item 22): on an empty patch of the Under the cursor card's body, of its title bar and of
the legend at 1,600 px, the average colour with the grain on and off, and the WCAG contrast of the ink, muted and dim tones against each, and of the
green titles on the bar (round 15's title bars, with their own grain on the dark theme); every difference must be within 0.05.
Imported by atlas-audit.py (guard(cdp) with an open page) and runnable alone: python3 -I motion/tools/grainguard.py --url http://127.0.0.1:8765/explorer.html"""
import argparse, base64, json, os, shutil, struct, subprocess, sys, tempfile, time, zlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def png_rgb(data):   # a minimal reader for the screenshots: 8-bit RGB or RGBA, non-interlaced
    assert data[:8] == b"\x89PNG\r\n\x1a\n"; pos = 8; w = h = 0; ct = 0; idat = b""
    while pos < len(data):
        n = struct.unpack(">I", data[pos:pos + 4])[0]; typ = data[pos + 4:pos + 8]; body = data[pos + 8:pos + 8 + n]; pos += 12 + n
        if typ == b"IHDR": w, h, bd, ct = struct.unpack(">IIBB", body[:10]); assert bd == 8 and ct in (2, 6) and body[12] == 0
        elif typ == b"IDAT": idat += body
    raw = zlib.decompress(idat); bpp = 4 if ct == 6 else 3; stride = w * bpp; out = []; prev = bytearray(stride); p = 0
    for y in range(h):
        f = raw[p]; line = bytearray(raw[p + 1:p + 1 + stride]); p += 1 + stride
        for i in range(stride):
            a = line[i - bpp] if i >= bpp else 0; b = prev[i]; c = prev[i - bpp] if i >= bpp else 0
            if f == 1: line[i] = (line[i] + a) & 255
            elif f == 2: line[i] = (line[i] + b) & 255
            elif f == 3: line[i] = (line[i] + (a + b) // 2) & 255
            elif f == 4:
                pp = a + b - c; pa, pb, pc = abs(pp - a), abs(pp - b), abs(pp - c); pr = a if pa <= pb and pa <= pc else b if pb <= pc else c; line[i] = (line[i] + pr) & 255
        out.append(bytes(line)); prev = line
    return w, h, bpp, out

def average(data):
    w, h, bpp, rows = png_rgb(data); s = [0, 0, 0]; n = 0; gs = []
    for r in rows:
        for x in range(w): s[0] += r[x * bpp]; s[1] += r[x * bpp + 1]; s[2] += r[x * bpp + 2]; n += 1; gs.append(r[x * bpp + 1])
    m = sum(gs) / n; average.spread = (sum((g - m) ** 2 for g in gs) / n) ** 0.5   # the green channel's spread, the grain's amplitude
    return [v / n for v in s]

def lum(rgb):
    f = lambda v: (v / 255) / 12.92 if v / 255 <= 0.03928 else ((v / 255 + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2])
def contrast(a, b): x, y = lum(a), lum(b); return (max(x, y) + 0.05) / (min(x, y) + 0.05)
def hexrgb(h): return [int(h[i:i + 2], 16) for i in (1, 3, 5)]

# the card's patches: one in its body under HOVER A CELL, one in its title bar between the title and the i button (round 15)
# The side column scrolls on its own: the card is brought into it first (it sat at the column's lower edge once round 15's title bars made the cards
# above it taller), and the column's scroll is put back after, for the audit's later states.
SETUP = "(() => { const A = window.__atlas; A.mode('cells'); A.layer('industry'); A.year(2024); A.preset('Russia'); A.legend(true); A.strip(true); if (A.hoverOff) A.hoverOff(); const side = document.querySelector('aside.side'), y0 = side ? side.scrollTop : 0, el = document.querySelector('.card:not(.act):not(.go)'); el.scrollIntoView({ block: 'center', inline: 'nearest' }); const r = el.getBoundingClientRect(), l = document.getElementById('legend').getBoundingClientRect(), cs = getComputedStyle(document.documentElement); return { card: [r.right - 130, r.top + 80, 50, 14], bar: [r.right - 130, r.top + 10, 50, 14], legend: [l.right - 60, l.bottom - 24, 40, 12], ink: cs.getPropertyValue('--ink').trim(), muted: cs.getPropertyValue('--muted').trim(), dim: cs.getPropertyValue('--dim').trim(), context: cs.getPropertyValue('--context').trim(), y0 }; })()"

def guard(cdp, tol=0.05):
    """Returns (findings, table) for the open page at its current size."""
    g = cdp.evaluate(SETUP, await_promise=False); time.sleep(0.2); out = []; table = []
    for patch in ("card", "bar", "legend"):
        x, y, w, h = g[patch]; avg = {}
        for on in (True, False):
            cdp.evaluate("window.__atlas.grain(%s)" % ("true" if on else "false"), await_promise=False); time.sleep(0.15)
            png = base64.b64decode(cdp.call("Page.captureScreenshot", {"format": "png", "clip": {"x": x, "y": y, "width": w, "height": h, "scale": 1}})["data"]); avg[on] = average(png); avg[("spread", on)] = round(average.spread, 2)
        cdp.evaluate("window.__atlas.grain(true)", await_promise=False)
        for tone in ("ink", "muted", "dim") + (("context",) if patch == "bar" else ()):
            c_on, c_off = contrast(hexrgb(g[tone]), avg[True]), contrast(hexrgb(g[tone]), avg[False]); table.append((patch, tone, round(c_off, 3), round(c_on, 3), round(c_on - c_off, 3)))
            if abs(c_on - c_off) > tol: out.append(("grain", patch, "%s contrast %.3f with the grain against %.3f without (%.3f)" % (tone, c_on, c_off, c_on - c_off)))
        table.append((patch, "average", [round(v, 1) for v in avg[False]], [round(v, 1) for v in avg[True]], "spread %s -> %s" % (avg[("spread", False)], avg[("spread", True)])))
    cdp.evaluate("(() => { const side = document.querySelector('aside.side'); if (side) side.scrollTop = %d; })()" % g["y0"], await_promise=False)
    return out, table

def main():
    from capture import brave_flags, wait_port_file, page_ws_url, remove_profile
    from cdp import CDP
    ap = argparse.ArgumentParser(); ap.add_argument("--url", required=True); ap.add_argument("--theme", default="dark"); a = ap.parse_args()
    profile = tempfile.mkdtemp(prefix="grain-"); proc = subprocess.Popen(brave_flags(profile, 1600, 1000) + ["about:blank"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        port = wait_port_file(profile, proc); cdp = CDP(page_ws_url(port)); cdp.call("Page.enable"); cdp.call("Runtime.enable")
        cdp.call("Emulation.setDeviceMetricsOverride", {"width": 1600, "height": 1000, "deviceScaleFactor": 1, "mobile": False})
        cdp.call("Page.addScriptToEvaluateOnNewDocument", {"source": "try { localStorage.setItem('atlas-theme', %s); } catch (e) {}" % json.dumps(a.theme)})
        cdp.call("Page.navigate", {"url": a.url + "?v=grain" + str(int(time.time()))}); cdp.wait_event("Page.loadEventFired", timeout=60); cdp.evaluate("document.fonts.ready.then(() => true)", await_promise=True, timeout=60); time.sleep(0.4)
        findings, table = guard(cdp)
        for row in table: print(a.theme, *row)
        print("grain guard (%s): %d finding(s)" % (a.theme, len(findings)))
        for f in findings: print("  ", f)
    finally:
        proc.terminate()
        try: proc.wait(timeout=20)
        except subprocess.TimeoutExpired: proc.kill(); proc.wait(timeout=10)
        remove_profile(profile)   # the profile goes with its browser (they had piled up in /tmp, a tmpfs here)

if __name__ == "__main__":
    main()
