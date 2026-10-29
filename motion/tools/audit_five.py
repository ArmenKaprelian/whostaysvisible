#!/usr/bin/env python3
"""The atlas audit at the five widths, run in parallel (the lab's audit default of 26 October 2026; started by tools/audit-five.sh).

Each width runs as its own atlas-audit.py process, two or three at a time. Before every launch the machine must clear the lab's
memory floors, MemAvailable and SwapFree, read from config/lab.env as scripts/lab-run.sh reads them (atlas-audit.py does not
run under lab-run.sh, so the check is made here). When the floors are not met the next launch waits, so fewer run at once, and
with nothing running it waits up to --max-wait and then stops without a result; the floors are never bypassed. Each process
writes its own result and removes its own Brave profile when it finishes, and a run opens with a one-line warning when idle
profiles from earlier runs are left in /tmp (tools/stale_profiles.py; a warning only). The checks that belong once to a whole audit (the
agent guide's) run once here and appear once, never per width; the states that exist at one width only (the grain guard at
1,600 px, the phone states inside the 400 px pass) stay with that width, and a width's own notes (the grain guard's figures)
are copied into this log. A width that ran beside others and has findings is run again alone, and both results are reported:
the solo run's findings count, and those only the parallel run showed are listed apart. A parallel-only finding is noted the
first time it shows. Every one is recorded in build/audit/parallel-only.json, kept across runs and output folders, and a
finding from a check that showed parallel-only in an earlier run counts: a check that is sensitive to the machine's load
cannot pass twice (the author's choice of 26 October 2026, the usual handling of intermittent failures in test systems).

Round 19 (the author's decisions of 28 October 2026): a finding from the same check at every width that ran is not load-dependent, so it gets no solo
re-run unless its check is already on the parallel-only record; a run whose only findings are of that kind costs one pass, not two. And when nothing
answers at a local --url, the run serves motion/ there itself with tools/serve.py and stops the server when it ends.

The merged result keeps atlas-audit.py's head line unchanged (the review pages read only that line), then one line per width
(the run it came from, its time, states, boxes and findings), the once-per-audit line, a composition line, and the findings.
--widths re-runs only the widths named: their results replace those widths' lines, the other widths keep theirs, and each line
says which run it came from; a mixed result is marked as not valid for a publish. Every run keeps its own folder under runs/,
named by its start time, with each width's result and log. Nothing earlier is replaced until the new merged result is complete.

Usage: tools/audit-five.sh [--url URL] [--widths 400,768,...] [--jobs 3] [--out build/audit/audit-five.txt] [--max-wait 1800]
"""
import argparse, atexit, json, os, re, subprocess, sys, time, urllib.error, urllib.parse, urllib.request
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__)); MOTION = os.path.normpath(os.path.join(HERE, '..'))
sys.path.insert(0, HERE)
ALL = [400, 768, 1200, 1600, 2000]
PASSED = os.path.join(MOTION, 'build', 'audit', 'passed.json')   # round 24: the commits a full five-width run passed, for tools/audit_carry.py
LEDGER = os.path.join(MOTION, 'build', 'audit', 'parallel-only.json')   # the parallel-only findings by check, with the runs that showed them
HEAD = re.compile(r'^atlas audit: (\d+) states, (\d+) boxes, (\d+) finding\(s\); field renderers seen: ([^;]*); tiles placed over the note or the legend for want of a clear place: (\d+) \((.*)\)$')

SHIPPED = ['explorer.html', 'explainer.html', 'js', 'css', 'fonts', 'data']
def tree_state(url):   # (commit, clean, served): HEAD, whether the shipped sources are committed, whether the served page and script are the working tree's
    try:
        g = lambda *a: subprocess.run(['git'] + list(a), cwd=MOTION, capture_output=True, text=True, check=True).stdout.strip()
        commit, clean = g('rev-parse', 'HEAD'), not g('status', '--porcelain', '--', *SHIPPED)
        base = url.rsplit('/', 1)[0] + '/'
        served = all(urllib.request.urlopen(base + f + '?carry=%d' % time.time(), timeout=20).read() == open(os.path.join(MOTION, f), 'rb').read() for f in ('explorer.html', 'js/explorer-app.js', 'js/charts.js', 'js/map-layers.js'))
        return commit, clean, served
    except Exception: return None, False, False
def record_pass(t0_state, url, widths, head, run):   # round 24: a full run with zero findings on a committed, unchanged, served tree is recorded by commit
    commit, clean, served = t0_state; now = tree_state(url)
    if not (commit and clean and served and now == t0_state and sorted(widths) == ALL and head and head.group(3) == '0'): return None
    rec = json.load(open(PASSED, encoding='utf-8')) if os.path.exists(PASSED) else {}
    rec[commit] = {'utc': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'), 'run': run, 'states': int(head.group(1)), 'widths': ALL}
    tmp = PASSED + '.new'; open(tmp, 'w', encoding='utf-8').write(json.dumps(rec, indent=1)); os.replace(tmp, PASSED); return commit
def stamp(t=None): return datetime.fromtimestamp(time.time() if t is None else t).astimezone().strftime('%Y%m%dT%H%M%S%z')   # local time and its offset
def clock(s): s = int(round(s)); return '%d:%02d:%02d' % (s // 3600, s % 3600 // 60, s % 60)
def say(msg): print(msg, flush=True)

def meminfo():   # MemAvailable and SwapFree in MiB, as scripts/common.sh reads them
    m = {}
    for line in open('/proc/meminfo'):
        k, v = line.split(':', 1); m[k] = int(v.split()[0]) // 1024
    return m['MemAvailable'], m['SwapFree']

def parse(path):   # one atlas-audit.py result: the head line's figures and the findings under it
    lines = open(path, encoding='utf-8').read().splitlines()
    m = HEAD.match(lines[0]) if lines else None
    if not m: raise RuntimeError('no head line in %s' % path)
    return {'states': int(m.group(1)), 'boxes': int(m.group(2)), 'nfind': int(m.group(3)), 'renderers': [r.strip() for r in m.group(4).split(',') if r.strip()],
            'relaxed': m.group(6).split() if m.group(6).strip() else [], 'findings': [l for l in lines[1:] if l.strip()]}

def run_widths(widths, a, rundir, tag, jobs, floors):
    """Runs the widths, at most jobs at a time and each launch only when the floors are met; returns {width: result}."""
    queue, running, done, waiting = list(widths), [], {}, None
    while queue or running:
        for r in list(running):
            if r['p'].poll() is None: continue
            r['fh'].close(); r['end'] = time.time(); running.remove(r)
            try: res = parse(r['out'])
            except Exception as e: res = {'error': '%s (exit %s, log %s)' % (e, r['p'].returncode, r['log'])}
            res.update({'start': stamp(r['start']), 'end': stamp(r['end']), 'wall_s': round(r['end'] - r['start'], 1)}); done[r['w']] = res
            say('  width %4d%s done in %s: %s' % (r['w'], tag, clock(r['end'] - r['start']), res.get('error') or '%d states, %d boxes, %d finding(s)' % (res['states'], res['boxes'], res['nfind'])))
            for line in open(r['log'], encoding='utf-8', errors='replace').read().splitlines():   # the width's own notes, such as the grain guard's at 1,600 px
                if line.strip() and not HEAD.match(line): say('    %s' % line)
        if queue and len(running) < jobs:
            ma, sf = meminfo()
            if ma >= floors[0] and sf >= floors[1]:
                w = queue.pop(0); out = os.path.join(rundir, 'w%d%s.txt' % (w, tag)); log = os.path.join(rundir, 'w%d%s.log' % (w, tag))
                cmd = [sys.executable, '-I', os.path.join(HERE, 'atlas-audit.py'), '--url', a.url, '--widths', str(w), '--out', out, '--skip-once'] + (['--height', str(a.height)] if a.height else []) + (['--refs-once'] if w == 1600 else [])   # round 17: the REFERENCES panel's once-per-audit checks run at 1,600 px (with --skip-once on every width they had never run at a gate)
                fh = open(log, 'w'); running.append({'w': w, 'p': subprocess.Popen(cmd, stdout=fh, stderr=subprocess.STDOUT, cwd=MOTION), 'fh': fh, 'out': out, 'log': log, 'start': time.time()})
                say('  width %4d%s started, %d running (MemAvailable %d MiB, SwapFree %d MiB)' % (w, tag, len(running), ma, sf)); waiting = None
                time.sleep(8)   # the next check sees this browser's memory
                continue
            if waiting is None: waiting = time.time(); say('  waiting to launch: MemAvailable %d MiB (floor %d), SwapFree %d MiB (floor %d), %d running' % (ma, floors[0], sf, floors[1], len(running)))
            if running: waiting = time.time()   # the wait with nothing running counts from the last width's end
            elif time.time() - waiting > a.max_wait:
                raise SystemExit('audit-five: the memory floors were not met for %d s with nothing running; stopped without a result (the floors are never bypassed)' % a.max_wait)
        time.sleep(3)
    return done

def once_checks():   # the checks that belong once to a whole audit, in atlas-audit.py's line format; None for a build before the agent guide (round 15)
    if not os.path.exists(os.path.join(HERE, 'agent_guide.py')): return None
    import agent_guide as AG
    out = ["%-11s %s" % ("agent-guide", " | ".join(f)[:200]) for f in AG.check(MOTION)]
    if os.path.exists(os.path.join(HERE, 'glossary_build.py')):   # round 18: the glossary rebuilt in memory against the shipped files; its notes are not findings
        import glossary_build as GB
        res = GB.check(); out += ["%-11s %s" % ("glossary", f[:200]) for f in res if not f.startswith("note:")]
        for f in res:
            if f.startswith("note:"): say("  glossary %s" % f)   # a note is shown, not counted
    return out

def profiles(): return {d for d in os.listdir('/tmp') if d.startswith('atlas-audit-')}
def check_key(f): return re.sub(r'\d+(?:\.\d+)?', '#', f)   # the check a finding comes from: its line with the numbers out (the width, the year, the measured values)

def serve_if_needed(url):   # round 19: when nothing answers at a local --url, motion/ is served there for this run (tools/serve.py), and stopped at exit
    try: urllib.request.urlopen(url, timeout=3).close(); return None
    except urllib.error.HTTPError as e: raise SystemExit('audit-five: %s answers with HTTP %d; give the page\'s address with --url' % (url, e.code))
    except Exception: pass
    u = urllib.parse.urlparse(url)
    if u.hostname not in ('127.0.0.1', 'localhost') or not u.port: raise SystemExit('audit-five: nothing answers at %s' % url)
    p = subprocess.Popen([sys.executable, '-I', os.path.join(HERE, 'serve.py'), '--port', str(u.port), '--dir', MOTION], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    atexit.register(lambda: (p.terminate(), p.wait(10)))
    for _ in range(50):
        time.sleep(0.1)
        try: urllib.request.urlopen(url, timeout=2).close(); say('  served motion/ on port %d for this run (nothing answered there)' % u.port); return p
        except Exception: pass
    raise SystemExit('audit-five: could not serve motion/ at %s' % url)

def fold(prev, widths, par, solo, run, wall, jobs, once, seen):
    """The new state: a run of all five widths starts afresh; a targeted run replaces only its own widths and keeps the rest. seen is the
    record of parallel-only findings before this run: a parallel-only finding whose check is in it is marked recurring, and counts."""
    state = prev if prev is not None and sorted(widths) != ALL else {'widths': {}, 'runs': {}}
    state.setdefault('runs', {})[run] = {'widths': widths, 'wall_s': round(wall, 1), 'jobs': jobs}
    for w in widths:
        e = dict(par[w], run=run, mode='parallel' if len(widths) > 1 and jobs > 1 else 'alone', full=sorted(widths) == ALL)
        if w in solo:
            e['solo'] = solo[w]; e['par_only'] = [f for f in par[w]['findings'] if f not in solo[w]['findings']]
            e['recurring'] = [f for f in e['par_only'] if seen.get(check_key(f))]
        state['widths'][str(w)] = e
    state['once'] = {'run': run, 'findings': once}
    return state

def merged_text(state):
    W = state['widths']; widths = [w for w in ALL if str(w) in W] + sorted(int(w) for w in W if int(w) not in ALL)
    eff = {w: (W[str(w)]['solo'] if W[str(w)].get('solo') else W[str(w)]) for w in widths}
    findings = [f for w in widths for f in eff[w]['findings'] + W[str(w)].get('recurring', [])] + (state['once']['findings'] or [])
    renderers = sorted({r for w in widths for r in eff[w]['renderers']}); relaxed = [x for w in widths for x in eff[w]['relaxed']]
    head = 'atlas audit: %d states, %d boxes, %d finding(s); field renderers seen: %s; tiles placed over the note or the legend for want of a clear place: %d (%s)' % (
        sum(eff[w]['states'] for w in widths), sum(eff[w]['boxes'] for w in widths), len(findings), ', '.join(renderers), len(relaxed), ' '.join(relaxed))
    lines = [head]
    for w in widths:
        e = W[str(w)]; t = 'width %4d  run %s  %s %s  states %d  boxes %d  findings %d' % (w, e['run'], e['mode'], clock(e['wall_s']), e['states'], e['boxes'], e['nfind'])
        if e.get('solo'): s = e['solo']; t += '  · solo %s  states %d  boxes %d  findings %d' % (clock(s['wall_s']), s['states'], s['boxes'], s['nfind'])
        lines.append(t)
    once = state['once']['findings']
    lines.append('once        run %s  %s' % (state['once']['run'], 'no once-per-audit check at this build' if once is None else 'the agent guide\'s and the glossary\'s checks: %d finding(s)' % len(once)))
    runs = sorted({W[str(w)]['run'] for w in widths})
    full = len(runs) == 1 and sorted(widths) == ALL and all(W[str(w)].get('full') for w in widths)
    lines.append(('composition: one full run, %s, all five widths in %s wall clock' % (runs[0], clock(state['runs'][runs[0]]['wall_s']))) if full else
                 ('composition: %s; a targeted or partial result, never valid for a publish' % ', '.join('%s (%s)' % (r, ', '.join(str(w) for w in widths if W[str(w)]['run'] == r)) for r in runs)))
    lines += sorted(set(findings))
    par_only = sorted({(f, f in W[str(w)].get('recurring', [])) for w in widths for f in W[str(w)].get('par_only', [])})
    if par_only: lines += ['parallel-only, not in the solo re-run:'] + ['  %s  [%s]' % (f, 'counts: its check showed parallel-only in an earlier run' if r else 'noted: the first time') for f, r in par_only]
    return '\n'.join(lines) + '\n'

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--url', default='http://127.0.0.1:8765/explorer.html')
    ap.add_argument('--widths', default=','.join(map(str, ALL)), help='a comma list; fewer than the five is a targeted re-run')
    ap.add_argument('--jobs', type=int, default=3, choices=[1, 2, 3], help='widths at a time, at most')
    ap.add_argument('--out', default=os.path.join('build', 'audit', 'audit-five.txt'), help='the merged result, relative to motion/')
    ap.add_argument('--height', type=int, default=None)
    ap.add_argument('--max-wait', type=int, default=1800, help='seconds to wait for the floors with nothing running before stopping')
    a = ap.parse_args()
    serve_if_needed(a.url)
    floors =(int(os.environ.get('LAB_MEMAVAILABLE_MIN_MIB', 5120)), int(os.environ.get('LAB_SWAPFREE_MIN_MIB', 1024)))
    widths = [int(x) for x in a.widths.split(',') if x.strip()]
    if not os.path.isabs(a.out) and os.path.normpath(a.out).split(os.sep)[0] == 'motion':   # 27 October 2026: --out motion/build/... wrote under motion/motion/
        sys.exit("audit_five: --out is read relative to motion/, so %r would write under motion/motion/. Give it as build/audit/... or as an absolute path." % a.out)
    out = a.out if os.path.isabs(a.out) else os.path.join(MOTION, a.out); sdir = os.path.dirname(out); os.makedirs(sdir, exist_ok=True)
    statef = os.path.join(sdir, os.path.splitext(os.path.basename(out))[0] + '.state.json')
    run, n = stamp(), 1
    while True:   # a run's own folder, never shared: a second run in the same second takes a suffix
        rundir = os.path.join(sdir, 'runs', run if n == 1 else '%s-%d' % (run, n))
        try: os.makedirs(rundir); run = os.path.basename(rundir); break
        except FileExistsError: n += 1
    before = profiles(); t0_state = tree_state(a.url)   # round 24: the tree at the start, for the record of a pass
    t0 = time.time(); say('audit-five %s: widths %s, %d at a time at most; floors MemAvailable %d MiB, SwapFree %d MiB' % (run, ','.join(map(str, widths)), a.jobs, floors[0], floors[1]))
    try:
        import stale_profiles as STALE; n, b, parts = STALE.summary(STALE.scan())
        if n: say('  warning: %d idle headless-browser profile(s) in /tmp hold %.0f MB (%s); motion/tools/stale_profiles.py lists them' % (n, b / 1e6, parts))
    except Exception: pass   # a warning only: never a reason to stop the audit
    if os.path.exists(os.path.join(HERE, 'publish-set.py')):   # the publish day's CORRECTIONS check (publish-set.py --dates), shown before the widths run; a note, never a finding
        try:
            r = subprocess.run([sys.executable, os.path.join(HERE, 'publish-set.py'), '--dates'], capture_output=True, text=True, timeout=60)
            for line in (r.stdout + r.stderr).splitlines():
                if line.strip(): say('  publish date: ' + line.strip())
        except Exception as e: say('  publish date: not checked (%s)' % e)
    par = run_widths(widths, a, rundir, '', a.jobs, floors)
    bad = {w: r['error'] for w, r in par.items() if 'error' in r}
    if bad: raise SystemExit('audit-five: width(s) %s gave no result, nothing replaced: %s' % (', '.join(map(str, bad)), '; '.join(bad.values())))
    seen = json.load(open(LEDGER, encoding='utf-8')) if os.path.exists(LEDGER) else {}
    everywhere = set.intersection(*[{check_key(f) for f in par[w]['findings']} for w in widths]) if len(widths) > 1 else set()   # round 19: one check at every width is not load-dependent
    needs_solo = lambda w: any(check_key(f) not in everywhere or check_key(f) in seen for f in par[w]['findings'])
    redo = [w for w in widths if par[w]['nfind'] and needs_solo(w)] if len(widths) > 1 and a.jobs > 1 else []   # only a width that ran beside others
    if len(widths) > 1 and a.jobs > 1 and any(par[w]['nfind'] and w not in redo for w in widths):
        say('  no solo re-run for findings from a check that failed at every width: %s' % '; '.join(sorted(everywhere))[:300])
    solo = run_widths(redo, a, rundir, '.solo', 1, floors) if redo else {}
    if any('error' in r for r in solo.values()): raise SystemExit('audit-five: a solo re-run gave no result, nothing replaced')
    once = once_checks(); wall = time.time() - t0
    state = fold(json.load(open(statef, encoding='utf-8')) if os.path.exists(statef) else None, widths, par, solo, run, wall, a.jobs, once, seen)
    text = merged_text(state)
    for w in widths:
        for f in state['widths'][str(w)].get('par_only', []): seen.setdefault(check_key(f), []).append(run)
    os.makedirs(os.path.dirname(LEDGER), exist_ok=True)
    for path, body in ((statef, json.dumps(state, indent=1)), (LEDGER, json.dumps(seen, indent=1)), (out, text)):   # the new result replaces the old only now, complete
        tmp = path + '.new'; open(tmp, 'w', encoding='utf-8').write(body); os.replace(tmp, path)
    passed = record_pass(t0_state, a.url, widths, HEAD.match(text.splitlines()[0]), run)
    if passed: say('  recorded: %s passed the five-width audit (build/audit/passed.json; tools/audit_carry.py reads it)' % passed[:7])
    left = sorted(profiles() - before)   # this run's own; older ones are not counted
    say('audit-five %s done in %s wall clock; %s; %s' % (run, clock(wall), text.splitlines()[0][:120], ('%d Brave profile(s) of this run left in /tmp: %s' % (len(left), ' '.join(left))) if left else 'no Brave profile of this run left in /tmp'))
    return 1 if HEAD.match(text.splitlines()[0]).group(3) != '0' else 0

if __name__ == '__main__':
    sys.exit(main())
