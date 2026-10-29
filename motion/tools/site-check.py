#!/usr/bin/env python3
"""The author's site checked in both engines, in one command (the author's request of 29 October 2026).

Every page of the site (~/Documents/website) loads in headless Brave (Chromium) and in WebKitGTK (Safari's engine family) at the
sizes the pages must hold: a phone upright and in landscape, a tablet upright and in landscape, a small laptop, a laptop and a
desktop (the home page at all seven, the other pages and the atlas at the phone and the laptop). The tool serves the site itself on
127.0.0.1 and reports, per page, size and engine:
  - script errors and failed loads (an error event, an unhandled rejection, a console error);
  - a page wider than its window (sideways scroll) and IBM Plex Mono not loaded;
  - on the home page, in the split layout: the photo's top edge off the index's top rule, a page taller than its window, the bio
    within 8 px of the index, an index row under 40 px; in the stacked layout: an index row under 44 px (a finger's target) and
    the photo not below the index.
One screenshot per page, size and engine goes to motion/build/site-check/<UTC time>/ with report.txt; the tool prints one line per
finding, or "zero findings", and exits 1 on findings. Brave's profile is removed when it finishes; WebKit runs in an ephemeral
context, which writes none. WebKitGTK is not iOS: no touch, no iOS toolbars or notch, and a newer engine than older iPhones; a short
check on a real iPhone covers those. The atlas's own audit (atlas-audit.py, audit-five.sh) stays its full check; here it is loaded
for errors and overflow only. About a minute and a half, the two engines in parallel.

Usage: python3 -I motion/tools/site-check.py [--site ~/Documents/website] [--engines brave,webkit] [--only home,film] [--out DIR]"""
import argparse, base64, functools, http.server, json, os, re, subprocess, sys, tempfile, threading, time

HERE = os.path.dirname(os.path.abspath(__file__))
LAB = os.path.dirname(os.path.dirname(HERE))

SIZES = [("phone", 390, 844, True), ("phone-landscape", 844, 390, True), ("tablet", 820, 1180, True), ("tablet-landscape", 1180, 820, True),
         ("small-laptop", 1280, 800, False), ("laptop", 1440, 900, False), ("desktop", 1920, 1080, False)]
PAGES = [("home", "", None), ("film", "film/", ("phone", "laptop")), ("research", "research/", ("phone", "laptop")),
         ("writing", "writing/", ("phone", "laptop")), ("contact", "contact/", ("phone", "laptop")), ("atlas", "atlas/", ("phone", "laptop"))]

# Collected from the first line of every page, the same way in both engines.
ERRORS_JS = r"""window.__errs = [];
addEventListener('error', e => __errs.push(e.message ? 'error: ' + e.message : 'failed load: ' + ((e.target && (e.target.currentSrc || e.target.src || e.target.href)) || '?')), true);
addEventListener('unhandledrejection', e => __errs.push('unhandled rejection: ' + ((e.reason && e.reason.message) || e.reason)));
(() => { const ce = console.error; console.error = (...a) => { __errs.push('console.error: ' + a.join(' ')); ce.apply(console, a); }; })();"""

CHECK_JS = r"""async () => {
  await document.fonts.ready;
  if (window.__atlas && window.__atlas.ready) await Promise.race([window.__atlas.ready(), new Promise(r => setTimeout(r, 15000))]);
  await new Promise(r => setTimeout(r, 1200));
  const de = document.documentElement, f = [], px = v => Math.round(v);
  if (de.scrollWidth > innerWidth + 1) f.push('page wider than its window: ' + de.scrollWidth + ' px in ' + innerWidth);
  if (!document.fonts.check('16px "IBM Plex Mono"')) f.push('IBM Plex Mono not loaded');
  const home = document.querySelector('main.home');
  if (home) {
    const box = s => document.querySelector(s).getBoundingClientRect();
    const rows = [...document.querySelectorAll('.index a')].map(a => a.getBoundingClientRect().height);
    const photo = box('.photo'), index = box('.index');
    if (getComputedStyle(home).display === 'grid') {
      if (Math.abs(photo.top - index.top) > 1) f.push('split: the photo top ' + px(photo.top) + ' is off the index rule ' + px(index.top));
      if (de.scrollHeight > innerHeight + 1) f.push('split: page taller than its window: ' + de.scrollHeight + ' px in ' + innerHeight);
      const ps = document.querySelectorAll('.lede p');
      const end = Math.max(ps[ps.length - 1].getBoundingClientRect().bottom, box('.portrait').bottom);
      if (end > index.top - 8) f.push('split: the bio and headshot end ' + px(index.top - end) + ' px above the index');
      if (Math.min(...rows) < 40) f.push('split: an index row is ' + px(Math.min(...rows)) + ' px tall');
    } else {
      if (Math.min(...rows) < 44) f.push('stacked: an index row is ' + px(Math.min(...rows)) + ' px tall');
      if (photo.top < index.bottom) f.push('stacked: the photo is not below the index');
    }
  }
  return {findings: f, errors: window.__errs || [], layout: home ? getComputedStyle(home).display : null};
}"""


def jobs_for(base, out, only):
    jobs = []
    for page, path, sizes in PAGES:
        if only and page not in only:
            continue
        for name, w, h, mobile in SIZES:
            if sizes is None or name in sizes:
                jobs.append({"page": page, "size": name, "w": w, "h": h, "mobile": mobile, "url": base + path,
                             "png": os.path.join(out, "%%s-%s-%s.png" % (page, name))})
    return jobs


class Handler(http.server.SimpleHTTPRequestHandler):
    """Static files with byte ranges, as GitHub Pages serves them (the film's index is read from the front of the file)."""
    def send_head(self):
        path = self.translate_path(self.path)
        rng = self.headers.get("Range")
        m = re.match(r"bytes=(\d*)-(\d*)$", rng or "")
        if not m or os.path.isdir(path) or not os.path.isfile(path):
            return super().send_head()
        size = os.path.getsize(path)
        a = int(m.group(1)) if m.group(1) else max(0, size - int(m.group(2) or 0))
        b = min(int(m.group(2)), size - 1) if m.group(1) and m.group(2) else size - 1
        f = open(path, "rb"); f.seek(a)
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path)); self.send_header("Content-Range", "bytes %d-%d/%d" % (a, b, size))
        self.send_header("Content-Length", str(b - a + 1)); self.send_header("Accept-Ranges", "bytes"); self.end_headers()
        self._left = b - a + 1
        return f

    def copyfile(self, src, dst):
        left = getattr(self, "_left", None)
        try:
            if left is None:
                return super().copyfile(src, dst)
            while left > 0:
                buf = src.read(min(65536, left))
                if not buf:
                    break
                dst.write(buf); left -= len(buf)
        except (BrokenPipeError, ConnectionResetError):
            pass   # a browser that has read what it needs closes the connection

    def log_message(self, *args):
        pass


def run_brave(jobs, results):
    sys.path.insert(0, HERE)
    from capture import brave_flags, wait_port_file, page_ws_url, remove_profile
    from cdp import CDP
    profile = tempfile.mkdtemp(prefix="site-check-")
    proc = subprocess.Popen(brave_flags(profile, 1440, 900) + ["about:blank"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        cdp = CDP(page_ws_url(wait_port_file(profile, proc)))
        cdp.call("Page.enable"); cdp.call("Runtime.enable")
        cdp.call("Page.addScriptToEvaluateOnNewDocument", {"source": ERRORS_JS})
        for job in jobs:
            r = {"findings": [], "errors": []}
            try:
                cdp.call("Emulation.setDeviceMetricsOverride", {"width": job["w"], "height": job["h"], "deviceScaleFactor": 1, "mobile": job["mobile"]})
                cdp.call("Emulation.setTouchEmulationEnabled", {"enabled": job["mobile"], "maxTouchPoints": 5 if job["mobile"] else 1})
                cdp.call("Page.navigate", {"url": job["url"]}); cdp.wait_event("Page.loadEventFired", timeout=90)
                r = cdp.evaluate("(" + CHECK_JS + ")()", await_promise=True, timeout=120)
                open(job["png"] % "brave", "wb").write(base64.b64decode(cdp.call("Page.captureScreenshot", {"format": "png"})["data"]))
            except Exception as e:
                r["findings"].append("the check did not finish: %s" % e)
            results.append(dict(job, engine="brave", **r))
    finally:
        proc.terminate()
        try: proc.wait(timeout=20)
        except subprocess.TimeoutExpired: proc.kill(); proc.wait(timeout=10)
        remove_profile(profile)


def run_webkit(jobs, results):
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as t:
        json.dump(jobs, t); spec = t.name
    try:
        p = subprocess.run([sys.executable, "-I", os.path.abspath(__file__), "--webkit-worker", spec], capture_output=True, text=True,
                           timeout=60 + 60 * len(jobs))
        got = [json.loads(l) for l in p.stdout.splitlines() if l.startswith("{")]
        results.extend(dict(r, engine="webkit") for r in got)
        if len(got) < len(jobs):
            results.append({"page": "-", "size": "-", "engine": "webkit", "errors": [],
                            "findings": ["the WebKit worker stopped after %d of %d pages: %s" % (len(got), len(jobs), (p.stderr or "").strip()[-300:])]})
    finally:
        os.unlink(spec)


def webkit_worker(spec):
    """Runs in its own process: one GTK loop, one ephemeral WebKit context, the pages one after another, one JSON line each."""
    import gi
    gi.require_version("Gtk", "3.0"); gi.require_version("WebKit2", "4.1")
    from gi.repository import Gtk, WebKit2, GLib
    jobs = iter(json.load(open(spec)))
    Gtk.init([])
    ctx = WebKit2.WebContext.new_ephemeral()

    def next_job():
        job = next(jobs, None)
        if job is None:
            Gtk.main_quit(); return False
        ucm = WebKit2.UserContentManager()
        ucm.add_script(WebKit2.UserScript.new(ERRORS_JS, WebKit2.UserContentInjectedFrames.TOP_FRAME, WebKit2.UserScriptInjectionTime.START, None, None))
        view = WebKit2.WebView(web_context=ctx, user_content_manager=ucm)
        view.get_settings().set_hardware_acceleration_policy(WebKit2.HardwareAccelerationPolicy.NEVER)
        win = Gtk.OffscreenWindow(); win.set_default_size(job["w"], job["h"]); win.add(view); win.show_all()
        st = {"done": False, "result": {"findings": [], "errors": []}}

        def done():
            if st["done"]:
                return False
            st["done"] = True
            print(json.dumps(dict(job, **st["result"])), flush=True)
            win.destroy(); GLib.idle_add(next_job)
            return False

        def snap():
            def got(v, res):
                try: v.get_snapshot_finish(res).write_to_png(job["png"] % "webkit")
                except Exception as e: st["result"]["findings"].append("screenshot failed: %s" % e)
                done()
            view.get_snapshot(WebKit2.SnapshotRegion.VISIBLE, WebKit2.SnapshotOptions.NONE, None, got)
            return False

        def check():
            def got(v, res):
                try: st["result"] = json.loads(v.call_async_javascript_function_finish(res).to_string())
                except Exception as e: st["result"]["findings"].append("the check script failed: %s" % e)
                GLib.timeout_add(100, snap)
            view.call_async_javascript_function("return JSON.stringify(await (" + CHECK_JS + ")())", -1, None, None, None, None, got)
            return False

        def changed(v, ev):
            if ev == WebKit2.LoadEvent.FINISHED and not st["done"]:
                GLib.idle_add(check)

        def failed(v, ev, uri, err):
            st["result"]["findings"].append("the page did not load: %s" % err.message); GLib.idle_add(done)
            return True

        view.connect("load-changed", changed); view.connect("load-failed", failed)
        GLib.timeout_add_seconds(60, lambda: (st["result"]["findings"].append("timed out after 60 s") if not st["done"] else None, done())[1])
        view.load_uri(job["url"])
        return False

    GLib.idle_add(next_job)
    Gtk.main()


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--site", default=os.path.expanduser("~/Documents/website"), help="the site's folder (default ~/Documents/website)")
    ap.add_argument("--engines", default="brave,webkit", help="brave, webkit or both (default)")
    ap.add_argument("--only", default="", help="pages to check, from home, film, research, writing, contact, atlas (default all)")
    ap.add_argument("--out", default=None, help="the folder for the screenshots and report (default motion/build/site-check/<UTC time>)")
    ap.add_argument("--webkit-worker", default=None, help=argparse.SUPPRESS)
    a = ap.parse_args()
    if a.webkit_worker:
        return webkit_worker(a.webkit_worker)

    out = a.out or os.path.join(LAB, "motion", "build", "site-check", time.strftime("%Y%m%dT%H%M%SZ", time.gmtime()))
    os.makedirs(out, exist_ok=True)
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Handler, directory=os.path.abspath(a.site)))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    jobs = jobs_for("http://127.0.0.1:%d/" % httpd.server_address[1], out, set(filter(None, a.only.split(","))))
    engines = set(a.engines.split(","))
    t0 = time.time(); results = []; threads = []
    if "brave" in engines:
        threads.append(threading.Thread(target=run_brave, args=(jobs, results)))
    if "webkit" in engines:
        threads.append(threading.Thread(target=run_webkit, args=(jobs, results)))
    for t in threads: t.start()
    for t in threads: t.join()
    httpd.shutdown()

    lines = []
    for r in sorted(results, key=lambda r: (r["page"], r["size"], r["engine"])):
        for msg in r.get("findings", []) + r.get("errors", []):
            lines.append("%-8s %-17s %-6s %s" % (r["page"], r["size"], r["engine"], msg))
    n_pages = len(results)
    summary = "%d page loads in %s, %.0f s: %s" % (n_pages, " and ".join(sorted(engines)), time.time() - t0,
                                                   "zero findings" if not lines else "%d findings" % len(lines))
    report = "\n".join(lines + [summary, "screenshots and this report: " + out])
    open(os.path.join(out, "report.txt"), "w").write(report + "\n")
    print(report)
    return 1 if lines else 0


if __name__ == "__main__":
    sys.exit(main() or 0)
