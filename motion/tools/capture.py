#!/usr/bin/env python3
"""Frame-exact capture of the explainer to MP4 (or PNG frames), standard library plus ffmpeg.

The page exposes window.__videoMeta, window.__ready and window.__seek(t). A headless Chromium
(Brave) is driven over the DevTools protocol: for every frame, __seek(i/fps) is awaited and a PNG
screenshot is taken, so no frame depends on real-time playback. PNG bytes are piped into ffmpeg.

Sharding (23 October 2026): --shards N (default 4) splits the frame list into N contiguous spans on
whole frames and runs one headless browser per span in parallel, each with its own profile directory,
its own ffmpeg writing <out>.shard-i.mp4 and its own capture log; the parent joins the shards
losslessly with ffmpeg's concat demuxer (-f concat -c copy), checks the frame count and duration
with ffprobe, and writes a merged log beside the shard logs. --shards 1 is the single-process path.
Every frame is a pure function of its time, so a sharded capture equals a single-process capture
frame for frame (see motion/README.md, determinism).

Usage:
  capture.py --url http://127.0.0.1:PORT/explainer.html --out build/x.mp4 [--seconds 3 | --range 10:20] [--shards 4]
  capture.py --url ... --frames 0,45,89 --png-dir build/frames        # specific frames as PNG files
  capture.py --url ... --audit build/audit.json [--audit-step 6]      # text boxes of every 6th frame
  capture.py --url ... --probe                                         # print the page's meta and exit
Fallbacks: --fallback brave-shot (one Brave process per frame) or --fallback firefox-shot."""
import argparse, base64, json, os, shutil, subprocess, sys, tempfile, time, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from cdp import CDP  # noqa: E402

BRAVE = "/opt/brave.com/brave/brave"
FIREFOX = "/snap/bin/firefox"

def brave_flags(profile, w, h, port_zero=True):
    f = [BRAVE, "--headless=new", "--user-data-dir=" + profile, "--window-size=%d,%d" % (w, h), "--hide-scrollbars",
         "--force-device-scale-factor=1", "--force-color-profile=srgb", "--disable-lcd-text", "--font-render-hinting=none",
         "--disable-gpu", "--run-all-compositor-stages-before-draw", "--disable-checker-imaging", "--disable-partial-raster",
         "--disable-threaded-animation", "--disable-background-timer-throttling", "--disable-renderer-backgrounding",
         "--disable-backgrounding-occluded-windows", "--no-first-run", "--no-default-browser-check", "--disable-extensions",
         "--disable-component-update", "--disable-background-networking", "--disable-sync", "--disable-brave-extension",
         "--disable-brave-rewards-extension", "--mute-audio", "--lang=en-US", "--disable-dev-shm-usage", "--enable-logging=stderr", "--log-level=2"]
    if port_zero:
        f.append("--remote-debugging-port=0")
    return f

def wait_port_file(profile, proc, timeout=30):
    path = os.path.join(profile, "DevToolsActivePort")
    deadline = time.time() + timeout
    while time.time() < deadline:
        if proc.poll() is not None:
            raise RuntimeError("Brave exited early with code %s" % proc.returncode)
        if os.path.exists(path):
            lines = open(path).read().split("\n")
            if len(lines) >= 1 and lines[0].strip().isdigit():
                return int(lines[0].strip())
        time.sleep(0.1)
    raise TimeoutError("DevToolsActivePort did not appear")

def page_ws_url(port):
    for _ in range(50):
        try:
            with urllib.request.urlopen("http://127.0.0.1:%d/json/list" % port, timeout=5) as r:
                targets = json.load(r)
            pages = [t for t in targets if t.get("type") == "page"]
            if pages:
                return pages[0]["webSocketDebuggerUrl"]
        except Exception:
            pass
        time.sleep(0.1)
    raise TimeoutError("no page target")

def browser_version(port):
    try:
        with urllib.request.urlopen("http://127.0.0.1:%d/json/version" % port, timeout=5) as r:
            return json.load(r).get("Browser")
    except Exception:
        return None

def ffmpeg_cmd(fps, out, crf, preset):
    return ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "image2pipe", "-framerate", str(fps), "-i", "-",
            "-c:v", "libx264", "-preset", preset, "-crf", str(crf), "-pix_fmt", "yuv420p", "-r", str(fps), "-fps_mode", "cfr",
            "-movflags", "+faststart", out]

def check_png(data, w, h):
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise RuntimeError("screenshot is not a PNG")
    pw = int.from_bytes(data[16:20], "big"); ph = int.from_bytes(data[20:24], "big")
    if (pw, ph) != (w, h):
        raise RuntimeError("screenshot is %dx%d, expected %dx%d" % (pw, ph, w, h))

def ffprobe_video(path):
    """Frame count (decoded) and duration of a video file, via ffprobe."""
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-count_frames", "-show_entries",
                          "stream=nb_read_frames,duration,avg_frame_rate", "-of", "json", path], check=True, capture_output=True, text=True).stdout
    s = json.loads(out)["streams"][0]
    return {"frames": int(s["nb_read_frames"]), "duration": float(s["duration"]), "avg_frame_rate": s.get("avg_frame_rate")}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", required=True)
    ap.add_argument("--out", default=None)
    ap.add_argument("--seconds", type=float, default=None)
    ap.add_argument("--range", default=None, help="a:b seconds")
    ap.add_argument("--frames", default=None, help="comma-separated frame indices to dump as PNG")
    ap.add_argument("--png-dir", default=None)
    ap.add_argument("--fps", type=int, default=None)
    ap.add_argument("--width", type=int, default=1920)
    ap.add_argument("--height", type=int, default=1080)
    ap.add_argument("--crf", type=int, default=18)
    ap.add_argument("--preset", default="medium")
    ap.add_argument("--profile", default=None)
    ap.add_argument("--log", default=None, help="capture.json path")
    ap.add_argument("--probe", action="store_true")
    ap.add_argument("--audit", default=None, help="write the text boxes of every --audit-step-th frame to this JSON file instead of capturing")
    ap.add_argument("--audit-step", type=int, default=6)
    ap.add_argument("--shards", type=int, default=4, help="parallel headless browsers over contiguous frame spans (1 = single process)")
    ap.add_argument("--frame-list", default=None, help=argparse.SUPPRESS)   # internal: a shard's explicit frame indices
    ap.add_argument("--tag", default="", help=argparse.SUPPRESS)            # internal: progress-line prefix of a shard
    ap.add_argument("--fallback", choices=["brave-shot", "firefox-shot"], default=None)
    a = ap.parse_args()

    profile = a.profile or tempfile.mkdtemp(prefix="motion-brave-")
    os.makedirs(profile, exist_ok=True)
    render_url = a.url + ("&" if "?" in a.url else "?") + "__render=1" + ("&__audit=1" if a.audit else "")
    log = {"url": render_url, "started_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "frames": [], "problems": []}

    if a.fallback:
        return fallback(a, render_url, profile, log)

    proc = subprocess.Popen(brave_flags(profile, a.width, a.height) + ["about:blank"], stdout=subprocess.DEVNULL, stderr=open(os.path.join(profile, "brave-stderr.log"), "wb"))
    cdp = None
    ff = None
    try:
        port = wait_port_file(profile, proc)
        log["browser"] = browser_version(port)
        cdp = CDP(page_ws_url(port))
        cdp.call("Page.enable"); cdp.call("Runtime.enable")
        cdp.call("Emulation.setDeviceMetricsOverride", {"width": a.width, "height": a.height, "deviceScaleFactor": 1, "mobile": False})
        cdp.call("Page.navigate", {"url": render_url})
        cdp.wait_event("Page.loadEventFired", timeout=60)
        meta = cdp.evaluate("window.__ready", await_promise=True, timeout=180)
        log["meta"] = meta
        if a.probe:
            print(json.dumps({"browser": log["browser"], "meta": meta, "problems": cdp.problems}, indent=1)); return 0
        fps = a.fps or int(meta["fps"]); duration = float(meta["duration"])
        whole = False
        if a.frame_list:
            frames = [int(x) for x in a.frame_list.split(",")]
        elif a.frames:
            frames = [int(x) for x in a.frames.split(",")]
        else:
            start, end = 0.0, duration
            if a.range:
                s, e = a.range.split(":"); start, end = float(s), float(e)
            if a.seconds is not None:
                end = min(end, start + a.seconds)
            frames = list(range(int(round(start * fps)), int(round(end * fps))))
            whole = (start == 0.0 and end == duration)
        if a.audit and a.audit_step > 1:
            frames = frames[::a.audit_step]
        if a.shards > 1 and not a.frame_list and len(frames) > 1:
            # The parent keeps its browser only for the probe; the shards do the work.
            try:
                cdp.call("Browser.close", timeout=5)
            except Exception:
                pass
            cdp = None
            return run_sharded(a, frames, fps, meta, whole, profile, log)
        if a.audit:
            return audit(a, cdp, meta, fps, frames, log)
        if a.png_dir:
            os.makedirs(a.png_dir, exist_ok=True)
        if a.out:
            ff = subprocess.Popen(ffmpeg_cmd(fps, a.out, a.crf, a.preset), stdin=subprocess.PIPE)
        t_all = time.time()
        for n, i in enumerate(frames):
            t = i / fps
            t0 = time.time()
            cdp.evaluate("window.__seek(%r)" % t, await_promise=True, timeout=60)
            shot = cdp.call("Page.captureScreenshot", {"format": "png", "fromSurface": True, "captureBeyondViewport": False, "optimizeForSpeed": True}, timeout=60)
            data = base64.b64decode(shot["data"])
            if n == 0:
                check_png(data, a.width, a.height)
            if ff:
                ff.stdin.write(data)
            if a.png_dir:
                with open(os.path.join(a.png_dir, "f%05d.png" % i), "wb") as fh:
                    fh.write(data)
            ms = (time.time() - t0) * 1000
            log["frames"].append([i, round(ms, 1)])
            if n % 150 == 0 or n == len(frames) - 1:
                print("%sframe %d/%d (t=%.2f s) %.0f ms; elapsed %.0f s" % (a.tag, n + 1, len(frames), t, ms, time.time() - t_all), file=sys.stderr, flush=True)
        if ff:
            ff.stdin.close(); rc = ff.wait()
            if rc != 0:
                raise RuntimeError("ffmpeg exit %d" % rc)
        log["problems"] = cdp.problems
        log["seconds"] = round(time.time() - t_all, 1)
        log["frame_count"] = len(frames)
        if a.out and whole:
            log["ffprobe"] = verify_video(a.out, len(frames), fps, meta)
        return 0
    finally:
        try:
            if cdp:
                cdp.call("Browser.close", timeout=5)
        except Exception:
            pass
        try:
            proc.terminate(); proc.wait(timeout=10)
        except Exception:
            proc.kill()
        if a.log:
            with open(a.log, "w") as fh:
                json.dump(log, fh, indent=1)
        if not a.profile:
            shutil.rmtree(profile, ignore_errors=True)

def verify_video(path, n_frames, fps, meta):
    """ffprobe frame count and duration against the request (and __videoMeta for a whole capture)."""
    p = ffprobe_video(path)
    expect_frames = n_frames; expect_duration = n_frames / fps
    p["expected_frames"] = expect_frames; p["expected_duration"] = round(expect_duration, 4)
    p["ok"] = (p["frames"] == expect_frames) and abs(p["duration"] - expect_duration) < 1.5 / fps
    if meta and n_frames == int(meta.get("frames", -1)):
        p["video_meta"] = {"frames": meta["frames"], "duration": meta["duration"]}
    print("ffprobe %s: %d frames, %.3f s (expected %d frames, %.3f s) -> %s" % (os.path.basename(path), p["frames"], p["duration"], expect_frames, expect_duration, "OK" if p["ok"] else "MISMATCH"), file=sys.stderr, flush=True)
    if not p["ok"]:
        raise RuntimeError("ffprobe mismatch for %s" % path)
    return p

def run_sharded(a, frames, fps, meta, whole, profile, log):
    """N contiguous spans of the frame list, one child capture per span, joined losslessly."""
    n = min(a.shards, len(frames))
    spans = []
    for i in range(n):
        lo = (len(frames) * i) // n; hi = (len(frames) * (i + 1)) // n
        if hi > lo:
            spans.append(frames[lo:hi])
    log_base = a.log or os.path.join(profile, "capture.json")
    stem = os.path.splitext(log_base)[0]
    procs = []; shard_files = []
    t_all = time.time()
    for i, span in enumerate(spans):
        cmd = [sys.executable, "-I", os.path.abspath(__file__), "--url", a.url, "--shards", "1", "--frame-list", ",".join(str(f) for f in span),
               "--profile", "%s-shard-%d" % (profile.rstrip("/"), i), "--log", "%s.shard-%d.json" % (stem, i), "--width", str(a.width), "--height", str(a.height),
               "--crf", str(a.crf), "--preset", a.preset, "--tag", "[shard %d] " % i]
        if a.fps:
            cmd += ["--fps", str(a.fps)]
        files = {}
        if a.out:
            root, ext = os.path.splitext(a.out); files["out"] = "%s.shard-%d%s" % (root, i, ext or ".mp4"); cmd += ["--out", files["out"]]
        if a.png_dir:
            cmd += ["--png-dir", a.png_dir]
        if a.audit:
            root, ext = os.path.splitext(a.audit); files["audit"] = "%s.shard-%d%s" % (root, i, ext or ".json"); cmd += ["--audit", files["audit"], "--audit-step", "1"]
        files["log"] = "%s.shard-%d.json" % (stem, i)
        shard_files.append(files)
        procs.append(subprocess.Popen(cmd))
    print("sharded capture: %d frames in %d spans %s" % (len(frames), len(spans), [[s[0], s[-1]] for s in spans]), file=sys.stderr, flush=True)
    rcs = [p.wait() for p in procs]
    merged = {"url": log["url"], "started_utc": log["started_utc"], "browser": log.get("browser"), "meta": meta, "shards": len(spans),
              "spans": [[s[0], s[-1], len(s)] for s in spans], "shard_logs": [f["log"] for f in shard_files], "frames": [], "problems": [], "exit_codes": rcs}
    for f in shard_files:
        try:
            with open(f["log"]) as fh:
                sl = json.load(fh)
            merged["frames"] += sl.get("frames", []); merged["problems"] += sl.get("problems", [])
        except Exception as e:
            merged["problems"].append("shard log unreadable: %s (%s)" % (f["log"], e))
    merged["frame_count"] = len(merged["frames"]); merged["seconds"] = round(time.time() - t_all, 1)
    if any(rcs):
        write_log(log_base, merged)
        raise RuntimeError("shard exit codes %s" % rcs)
    if a.out:
        lst = os.path.join(profile, "concat.txt")
        with open(lst, "w") as fh:
            for f in shard_files:
                fh.write("file '%s'\n" % os.path.abspath(f["out"]).replace("'", "'\\''"))
        subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", "-movflags", "+faststart", a.out], check=True)
        merged["concat"] = [f["out"] for f in shard_files]
        merged["ffprobe"] = verify_video(a.out, len(frames), fps, meta if whole else None)
        for f in shard_files:   # the joined file is verified; the shard videos are intermediate (their logs stay)
            try:
                os.remove(f["out"])
            except OSError:
                pass
    if a.audit:
        out = {"url": log["url"], "meta": meta, "fps": fps, "step": a.audit_step, "shards": len(spans), "frames": []}
        for f in shard_files:
            with open(f["audit"]) as fh:
                out["frames"] += json.load(fh)["frames"]
        out["frames"].sort(key=lambda fr: fr["frame"])
        with open(a.audit, "w") as fh:
            json.dump(out, fh)
        merged["audit"] = {"file": a.audit, "frames": len(out["frames"])}
        merged["frame_count"] = len(out["frames"])
    write_log(log_base, merged)
    log.clear(); log.update(merged)   # the caller's final write then carries the merged record
    print("sharded capture done: %d frames in %.0f s (%d shards)" % (len(merged["frames"]), merged["seconds"], len(spans)), file=sys.stderr, flush=True)
    return 0

def write_log(path, obj):
    with open(path, "w") as fh:
        json.dump(obj, fh, indent=1)

def audit(a, cdp, meta, fps, frames, log):
    """Seeks the listed frames and records the page's text boxes (window.__textBoxes()).
    No screenshots: the record is what the page measured while drawing. audit.py reads the file."""
    out = {"url": log["url"], "meta": meta, "fps": fps, "step": a.audit_step, "frames": []}
    t_all = time.time()
    for n, i in enumerate(frames):
        t = i / fps
        cdp.evaluate("window.__seek(%r)" % t, await_promise=True, timeout=60)
        boxes = json.loads(cdp.evaluate("JSON.stringify(window.__textBoxes())", timeout=60))
        out["frames"].append({"frame": i, "t": round(t, 4), "boxes": boxes})
        if n % 100 == 0 or n == len(frames) - 1:
            print("%saudit frame %d/%d (t=%.2f s) %d boxes; elapsed %.0f s" % (a.tag, n + 1, len(frames), t, len(boxes), time.time() - t_all), file=sys.stderr, flush=True)
    with open(a.audit, "w") as fh:
        json.dump(out, fh)
    log["audit"] = {"file": a.audit, "frames": len(frames), "seconds": round(time.time() - t_all, 1)}
    log["frame_count"] = len(frames); log["seconds"] = round(time.time() - t_all, 1)
    return 0

def fallback(a, render_url, profile, log):
    """One browser process per frame, via --screenshot. Slow, but needs no DevTools session."""
    fps = a.fps or 30
    frames = [int(x) for x in a.frames.split(",")] if a.frames else list(range(0, int(round((a.seconds or 3) * fps))))
    png_dir = a.png_dir or tempfile.mkdtemp(prefix="motion-shots-")
    os.makedirs(png_dir, exist_ok=True)
    for i in frames:
        out = os.path.join(png_dir, "f%05d.png" % i)
        url = render_url + "&t=%r" % (i / fps)
        if a.fallback == "brave-shot":
            cmd = brave_flags(profile, a.width, a.height, port_zero=False) + ["--screenshot=" + out, url]
        else:
            cmd = [FIREFOX, "--headless", "--profile", profile, "--window-size=%d,%d" % (a.width, a.height), "--screenshot", out, url]
        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=120)
        log["frames"].append([i, None])
    if a.out:
        subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-framerate", str(fps), "-pattern_type", "glob", "-i", os.path.join(png_dir, "f*.png"),
                        "-c:v", "libx264", "-preset", a.preset, "-crf", str(a.crf), "-pix_fmt", "yuv420p", "-movflags", "+faststart", a.out], check=True)
    if a.log:
        with open(a.log, "w") as fh:
            json.dump(log, fh, indent=1)
    return 0

if __name__ == "__main__":
    sys.exit(main())
