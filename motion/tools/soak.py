#!/usr/bin/env python3
"""A long-session soak of the atlas in headless Brave (round 17, the author's request of 27 October 2026).

Drives the page for a set time with the browser's own input (CDP pointer moves over the map, wheel zooms, a click on the REFERENCES
button and Escape to close it) and the page's API for the rest (the view, the layer, the year, the preset), in cycles. After every cycle
it forces two garbage collections and records the JS heap and its backing stores (Runtime.getHeapUsage), the page's counts from
Performance.getMetrics (DOM nodes, event listeners, documents, ArrayBuffer contents), the attached elements, the running Web Animations,
the pending timeouts, intervals and animation frames, the live WebGL objects by kind (counted by wrapping their create and delete calls
at document start), the page's canvases, and the resident memory of every process of this browser. Nothing on the page is changed
except those counters. The profile is removed when the browser exits.

Usage: python3 -I motion/tools/soak.py --url http://127.0.0.1:8765/explorer.html --out soak.json [--minutes 6] [--width 1600 --height 1000]
The result is JSON: the samples and, per measure, the first and last value and the least-squares slope per minute over the second half."""
import argparse, json, os, random, subprocess, sys, tempfile, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from capture import brave_flags, wait_port_file, page_ws_url, remove_profile
from cdp import CDP

COUNTERS = r"""(() => {
  const C = window.__soak = { timeouts: new Set(), intervals: new Set(), raf: new Set(), gl: {} };
  const st = window.setTimeout, ct = window.clearTimeout, si = window.setInterval, ci = window.clearInterval, ra = window.requestAnimationFrame, ca = window.cancelAnimationFrame;
  window.setTimeout = function (fn, ms, ...a) { let id; id = st.call(window, function () { C.timeouts.delete(id); return typeof fn === 'function' ? fn.apply(this, arguments) : undefined; }, ms, ...a); C.timeouts.add(id); return id; };
  window.clearTimeout = function (id) { C.timeouts.delete(id); return ct.call(window, id); };
  window.setInterval = function (fn, ms, ...a) { const id = si.call(window, fn, ms, ...a); C.intervals.add(id); return id; };
  window.clearInterval = function (id) { C.intervals.delete(id); return ci.call(window, id); };
  window.requestAnimationFrame = function (fn) { let id; id = ra.call(window, t => { C.raf.delete(id); fn(t); }); C.raf.add(id); return id; };
  window.cancelAnimationFrame = function (id) { C.raf.delete(id); return ca.call(window, id); };
  const kinds = [['createBuffer', 'deleteBuffer', 'buffer'], ['createTexture', 'deleteTexture', 'texture'], ['createFramebuffer', 'deleteFramebuffer', 'framebuffer'], ['createRenderbuffer', 'deleteRenderbuffer', 'renderbuffer'], ['createProgram', 'deleteProgram', 'program'], ['createShader', 'deleteShader', 'shader'], ['createVertexArray', 'deleteVertexArray', 'vao']];
  for (const P of [window.WebGL2RenderingContext, window.WebGLRenderingContext]) { if (!P) continue; const proto = P.prototype;
    for (const [mk, rm, kind] of kinds) { const m = proto[mk], r = proto[rm]; if (!m || !r) continue;
      proto[mk] = function () { const o = m.apply(this, arguments); if (o) C.gl[kind] = (C.gl[kind] || 0) + 1; return o; };
      proto[rm] = function (o) { if (o) C.gl[kind] = (C.gl[kind] || 0) - 1; return r.apply(this, arguments); }; } }
})();"""

SAMPLE = r"""(() => { const C = window.__soak || {}; return { elements: document.getElementsByTagName('*').length, animations: document.getAnimations().length,
  timeouts: C.timeouts ? C.timeouts.size : null, intervals: C.intervals ? C.intervals.size : null, raf: C.raf ? C.raf.size : null, gl: Object.assign({}, C.gl || {}),
  canvases: document.querySelectorAll('canvas').length, refsOpen: !!(document.getElementById('refs') && document.getElementById('refs').open), pm_used: performance.memory ? performance.memory.usedJSHeapSize : null }; })()"""

def rss_of(profile):   # resident memory of every process of this browser, MB (the processes name the profile in their command lines)
    tot = 0
    for pid in os.listdir('/proc'):
        if not pid.isdigit(): continue
        try:
            if profile not in open('/proc/%s/cmdline' % pid, 'rb').read().decode('utf-8', 'replace'): continue
            for line in open('/proc/%s/status' % pid):
                if line.startswith('VmRSS:'): tot += int(line.split()[1])
        except Exception: pass
    return round(tot / 1024, 1)

def slope(xs, ys):
    n = len(xs)
    if n < 2: return None
    mx, my = sum(xs) / n, sum(ys) / n; den = sum((x - mx) ** 2 for x in xs)
    return None if den == 0 else sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / den

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--url', required=True); ap.add_argument('--out', required=True)
    ap.add_argument('--minutes', type=float, default=6.0); ap.add_argument('--width', type=int, default=1600); ap.add_argument('--height', type=int, default=1000)
    ap.add_argument('--seed', type=int, default=17)
    a = ap.parse_args(); rnd = random.Random(a.seed)
    profile = tempfile.mkdtemp(prefix='soak-')
    proc = subprocess.Popen(brave_flags(profile, a.width, a.height) + ['about:blank'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    samples = []; out = {'url': a.url, 'minutes': a.minutes, 'size': [a.width, a.height], 'seed': a.seed, 'samples': samples}
    try:
        port = wait_port_file(profile, proc); cdp = CDP(page_ws_url(port))
        for m in ('Page.enable', 'Runtime.enable', 'Performance.enable', 'HeapProfiler.enable'): cdp.call(m)
        cdp.call('Page.addScriptToEvaluateOnNewDocument', {'source': COUNTERS})
        cdp.call('Page.navigate', {'url': a.url + ('&' if '?' in a.url else '?') + 'soak=' + str(int(time.time()))}); cdp.wait_event('Page.loadEventFired', timeout=90)
        cdp.evaluate('document.fonts.ready.then(() => window.__atlas.ready()).then(() => true)', await_promise=True, timeout=120)
        L = cdp.evaluate('window.__atlas.layers', await_promise=False)
        box = cdp.evaluate("(() => { const r = document.getElementById('mapwrap').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()", await_promise=False)
        rb = cdp.evaluate("(() => { const r = document.getElementById('refsbtn').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()", await_promise=False)
        mx = lambda: box[0] + box[2] * (0.1 + 0.8 * rnd.random()); my = lambda: box[1] + box[3] * (0.1 + 0.6 * rnd.random())
        def mouse(t, x, y, **kw): cdp.call('Input.dispatchMouseEvent', dict({'type': t, 'x': x, 'y': y}, **kw))
        def sample(cycle, t0):
            for _ in range(2): cdp.call('HeapProfiler.collectGarbage')
            time.sleep(0.3)
            hu = cdp.call('Runtime.getHeapUsage'); pm = {m['name']: m['value'] for m in cdp.call('Performance.getMetrics')['metrics']}
            s = cdp.evaluate(SAMPLE, await_promise=False)
            s.update({'cycle': cycle, 't_min': round((time.time() - t0) / 60, 3), 'heap_used_mb': round(hu['usedSize'] / 1e6, 2), 'heap_total_mb': round(hu['totalSize'] / 1e6, 2),
                      'backing_mb': round(hu.get('backingStorageSize', 0) / 1e6, 2), 'embedder_mb': round(hu.get('embedderHeapUsedSize', 0) / 1e6, 2),
                      'nodes': pm.get('Nodes'), 'listeners': pm.get('JSEventListeners'), 'documents': pm.get('Documents'), 'arraybuffers': pm.get('ArrayBufferContents'),
                      'layout_objects': pm.get('LayoutObjects'), 'js_heap_metric_mb': round((pm.get('JSHeapUsedSize') or 0) / 1e6, 2), 'rss_mb': rss_of(profile)})
            samples.append(s); json.dump(out, open(a.out, 'w'), indent=1)
            print('cycle %3d  %5.2f min  heap %7.2f MB (metric %s)  backing %7.2f MB  nodes %6s  listeners %5s  timeouts %s  raf %s  anims %s  gl %s  rss %s MB' % (
                cycle, s['t_min'], s['heap_used_mb'], s['js_heap_metric_mb'], s['backing_mb'], s['nodes'], s['listeners'], s['timeouts'], s['raf'], s['animations'], s['gl'], s['rss_mb']), flush=True)
        t0 = time.time(); sample(0, t0); cycle = 0; years = list(range(2014, 2026)); presets = ['Russia', 'Moscow', 'St Petersburg', 'Novosibirsk', 'Yekaterinburg']
        while time.time() - t0 < a.minutes * 60:
            cycle += 1
            mode = 'firms' if cycle % 2 else 'cells'; cdp.evaluate("window.__atlas.mode(%s)" % json.dumps(mode), await_promise=False)
            for j in range(3):
                cdp.evaluate("window.__atlas.layer(%s)" % json.dumps(L[(cycle * 3 + j) % len(L)]), await_promise=False)
                cdp.evaluate("window.__atlas.year(%d)" % years[(cycle * 3 + j) % len(years)], await_promise=False)
                cdp.evaluate("window.__atlas.preset(%s)" % json.dumps(presets[(cycle + j) % len(presets)]), await_promise=False)
                cdp.evaluate("window.__atlas.ready().then(() => true)", await_promise=True, timeout=120)
                for _ in range(25): mouse('mouseMoved', mx(), my()); time.sleep(0.03)   # hovers
                cx, cy = box[0] + box[2] / 2, box[1] + box[3] / 2
                for d in (-120,) * 6 + (120,) * 6: mouse('mouseWheel', cx, cy, deltaX=0, deltaY=d); time.sleep(0.05)   # zooms in and back out
                time.sleep(0.4)
            for _ in range(2):   # the REFERENCES panel opened by a click and closed with Escape
                mouse('mouseMoved', rb[0], rb[1]); mouse('mousePressed', rb[0], rb[1], button='left', clickCount=1); mouse('mouseReleased', rb[0], rb[1], button='left', clickCount=1); time.sleep(0.4)
                cdp.call('Input.dispatchKeyEvent', {'type': 'keyDown', 'key': 'Escape', 'code': 'Escape', 'windowsVirtualKeyCode': 27}); cdp.call('Input.dispatchKeyEvent', {'type': 'keyUp', 'key': 'Escape', 'code': 'Escape', 'windowsVirtualKeyCode': 27}); time.sleep(0.3)
            mouse('mouseMoved', 2, 2); time.sleep(0.5)   # the pointer leaves the map before the sample
            sample(cycle, t0)
        half = samples[len(samples) // 2:]
        out['summary'] = {k: {'first': samples[0].get(k), 'last': samples[-1].get(k), 'max': max(s.get(k) or 0 for s in samples),
                              'slope_per_min_2nd_half': (lambda v: None if v is None else round(v, 4))(slope([s['t_min'] for s in half], [s.get(k) or 0 for s in half]))}
                          for k in ('heap_used_mb', 'js_heap_metric_mb', 'backing_mb', 'nodes', 'listeners', 'elements', 'arraybuffers', 'layout_objects', 'timeouts', 'intervals', 'raf', 'animations', 'canvases', 'rss_mb')}
        out['summary']['gl'] = {'first': samples[0]['gl'], 'last': samples[-1]['gl']}
        json.dump(out, open(a.out, 'w'), indent=1); print(json.dumps(out['summary'], indent=1))
    finally:
        proc.terminate()
        try: proc.wait(timeout=20)
        except subprocess.TimeoutExpired: proc.kill(); proc.wait(timeout=10)
        remove_profile(profile)

if __name__ == '__main__':
    main()
