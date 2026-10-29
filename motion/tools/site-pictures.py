#!/usr/bin/env python3
"""The site's pictures in one command (the author's pick B4, 29 October 2026): the index's three preview pictures and the link card.

  img/preview-atlas.webp   the atlas at 1500 by 1050 in headless Brave once it is ready, scaled to 1000 by 700
  img/preview-film.webp    film/poster.jpg cut to 10 by 7 from the left, scaled to 1000 by 700
  img/preview-resume.webp  the resume's page 1 at 200 dpi (pdftoppm), its top 1700 by 1190 px, scaled to 1000 by 700 and brought to
                           80 percent brightness (ImageMagick's -modulate 80), so the page does not flash white on the dark site
  img/card.jpg             tools/card.html at 1200 by 630, the page clock fixed so the stream draws its frame at 4 s, JPEG quality 88

The previews are WebP at quality 82 through ImageMagick; the film's and the resume's recipes remake the files of 29 October 2026 exactly
(RMSE 0). Without --write the pictures go to motion/build/site-pictures/<UTC time>/ with sheet.html (the current and the new side by
side, with sizes and differences) and the site is untouched; --write copies them into the site's img/. Remake them after the atlas, the
film, the resume or the bio changes. Brave's profile is removed when it finishes.

Usage: python3 -I motion/tools/site-pictures.py [--site ~/Documents/website] [--only atlas,film,resume,card] [--write]"""
import argparse, base64, functools, glob, http.server, os, shutil, subprocess, sys, tempfile, threading, time

HERE = os.path.dirname(os.path.abspath(__file__))
LAB = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
CLOCK = """(() => { let T = 1000; performance.now = () => T; const q = [];
  window.requestAnimationFrame = cb => { q.push(cb); return q.length; }; window.cancelAnimationFrame = () => {};
  window.__step = t => { T = t; const cbs = q.splice(0); cbs.forEach(cb => cb(T)); return T; }; })();"""
PICTURES = [("atlas", "preview-atlas.webp"), ("film", "preview-film.webp"), ("resume", "preview-resume.webp"), ("card", "card.jpg")]
WEBP = ["-quality", "82"]
JPEG = ["-sampling-factor", "4:2:0", "-interlace", "JPEG", "-quality", "88", "-strip"]


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass


class Server(http.server.ThreadingHTTPServer):
    def handle_error(self, request, client_address):   # a request the browser dropped on leaving a page is no error
        if not isinstance(sys.exc_info()[1], (ConnectionResetError, BrokenPipeError)): super().handle_error(request, client_address)


def convert(*args): subprocess.run(["convert", *args], check=True)


def shots(site, out, want):   # the atlas and the card, from the site served here
    from capture import brave_flags, wait_port_file, page_ws_url, remove_profile
    from cdp import CDP
    srv = Server(("127.0.0.1", 0), functools.partial(Quiet, directory=site))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    url = "http://127.0.0.1:%d/" % srv.server_address[1]
    profile = tempfile.mkdtemp(prefix="site-pictures-")
    proc = subprocess.Popen(brave_flags(profile, 1500, 1050) + ["about:blank"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        cdp = CDP(page_ws_url(wait_port_file(profile, proc))); cdp.call("Page.enable"); cdp.call("Runtime.enable")
        def shot(path, w, h, png, wait):
            cdp.call("Emulation.setDeviceMetricsOverride", {"width": w, "height": h, "deviceScaleFactor": 1, "mobile": False})
            cdp.call("Page.navigate", {"url": url + path}); cdp.wait_event("Page.loadEventFired", timeout=120)
            cdp.evaluate(wait, await_promise=True, timeout=120)
            open(png, "wb").write(base64.b64decode(cdp.call("Page.captureScreenshot", {"format": "png"})["data"]))
        if "atlas" in want:
            shot("atlas/", 1500, 1050, os.path.join(out, "atlas-1500.png"),
                 "(async () => { await document.fonts.ready; if (window.__atlas && __atlas.ready) await Promise.race([__atlas.ready(), new Promise(r => setTimeout(r, 20000))]); await new Promise(r => setTimeout(r, 2500)); })()")
            convert(os.path.join(out, "atlas-1500.png"), "-resize", "1000x700!", *WEBP, os.path.join(out, "preview-atlas.webp"))
        if "card" in want:
            cdp.call("Page.addScriptToEvaluateOnNewDocument", {"source": CLOCK})   # after the atlas, whose animations need the real clock
            shot("tools/card.html", 1200, 630, os.path.join(out, "card.png"),
                 "document.fonts.ready.then(() => new Promise(r => setTimeout(r, 400))).then(() => { window.__step(5000); return new Promise(r => setTimeout(r, 200)); })")
            convert(os.path.join(out, "card.png"), *JPEG, os.path.join(out, "card.jpg"))
    finally:
        proc.terminate()
        try: proc.wait(10)
        except Exception: proc.kill()
        remove_profile(profile); srv.shutdown()


def rmse(a, b):   # ImageMagick's normalised RMSE, 0 for the same pixels
    r = subprocess.run(["compare", "-metric", "RMSE", a, b, "null:"], capture_output=True, text=True)
    txt = (r.stderr or r.stdout).strip()
    try: return float(txt.split("(")[1].rstrip(")"))
    except Exception: return None


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--site", default=os.path.expanduser("~/Documents/website"), help="the site's folder (default ~/Documents/website)")
    ap.add_argument("--only", default="", help="pictures to make, from atlas, film, resume, card (default all)")
    ap.add_argument("--write", action="store_true", help="copy the new pictures into the site's img/ (without it the site is untouched)")
    a = ap.parse_args()
    site = os.path.abspath(a.site); want = set(filter(None, a.only.split(","))) or {k for k, _ in PICTURES}
    out = os.path.join(LAB, "motion", "build", "site-pictures", time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())); os.makedirs(out)
    t0 = time.time()
    if "film" in want:
        w, h = (int(v) for v in subprocess.run(["identify", "-format", "%w %h", os.path.join(site, "film", "poster.jpg")], capture_output=True, text=True, check=True).stdout.split())
        convert(os.path.join(site, "film", "poster.jpg"), "-crop", "%dx%d+0+0" % (round(h * 10 / 7), h), "+repage", "-resize", "1000x700!", *WEBP, os.path.join(out, "preview-film.webp"))
    if "resume" in want:
        subprocess.run(["pdftoppm", "-r", "200", "-f", "1", "-l", "1", "-png", os.path.join(site, "resume", "kaprelian-resume.pdf"), os.path.join(out, "resume")], check=True)
        page = sorted(glob.glob(os.path.join(out, "resume*.png")))[0]
        convert(page, "-crop", "1700x1190+0+0", "+repage", "-resize", "1000x700!", "-modulate", "80", *WEBP, os.path.join(out, "preview-resume.webp"))
    if want & {"atlas", "card"}:
        shots(site, out, want)

    import review_page as rp
    pg = rp.Page("Site pictures", "Made %s from %s. %s" % (time.strftime("%d %B %Y, %H:%M UTC", time.gmtime()), site,
                 "Written into the site's img/." if a.write else "Dry run: the site is untouched; --write copies these into its img/."))
    for key, name in PICTURES:
        if key not in want: continue
        new, cur = os.path.join(out, name), os.path.join(site, "img", name)
        d = rmse(cur, new) if os.path.exists(cur) else None
        state = "new" if not os.path.exists(cur) else "the same pixels" if d == 0 else "differs (RMSE %.4f)" % d if d is not None else "differs"
        print("%-20s current %7s, new %7d B: %s" % (name, "%d B" % os.path.getsize(cur) if os.path.exists(cur) else "none", os.path.getsize(new), state))
        figs = [rp.fig("current, %d KB" % (os.path.getsize(cur) // 1024), cur, scale=0.5)] if os.path.exists(cur) else []
        pg.section(key, name, rp.p(state), rp.row(*figs, rp.fig("new, %d KB" % (os.path.getsize(new) // 1024), new, scale=0.5)))
        if a.write: shutil.copyfile(new, cur)
    pg.write(os.path.join(out, "sheet.html"))
    print("%s (%.0f s); sheet: %s" % ("written into the site's img/" if a.write else "dry run, the site untouched", time.time() - t0, os.path.join(out, "sheet.html")))
    return 0


if __name__ == "__main__":
    sys.exit(main())
