#!/usr/bin/env python3
"""Idle headless-browser profiles left in /tmp by the lab's tools (27 October 2026).

/tmp is a tmpfs on this machine, so a profile left behind holds memory and, under pressure, swap; enough of them tripped
scripts/lab-run.sh's SwapFree floor. The tools now remove their own profiles when they finish; this lists what is left
over: folders with the tools' prefixes that no running browser uses (its --user-data-dir). It never deletes anything.

Usage: stale_profiles.py           lists the idle folders by prefix, with their count and size
       stale_profiles.py --warn    prints one line when any exist, nothing otherwise (scripts/lab-run.sh and tools/audit_five.py call it)
Exit status 0 always: a warning, never a refusal.
"""
import argparse, os, re, subprocess, sys

PREFIXES = ('atlas-audit-', 'probe-', 'grain-', 'frames-', 'explainer-audit-', 'motion-brave-', 'evaljs-')

def in_use():   # the profile folders that running processes name in --user-data-dir
    try: args = subprocess.run(['ps', '-eo', 'args'], capture_output=True, text=True, timeout=5).stdout
    except Exception: return set()
    return {m.group(1).rstrip('/') for m in re.finditer(r'--user-data-dir=(\S+)', args)}

def size(path):   # the bytes the folder holds (allocated blocks, what a tmpfs keeps in memory)
    total = 0
    for root, dirs, files in os.walk(path):
        for name in files + dirs:
            try: total += os.lstat(os.path.join(root, name)).st_blocks * 512
            except OSError: pass
    return total

def scan(tmp='/tmp'):
    """{prefix: [(path, bytes), ...]} for the idle folders, owned by this user, with one of the tools' prefixes."""
    busy = in_use(); uid = os.getuid(); out = {}
    try: names = os.listdir(tmp)
    except OSError: return out
    for name in sorted(names):
        pre = next((p for p in PREFIXES if name.startswith(p)), None)
        path = os.path.join(tmp, name)
        if not pre or path in busy or os.path.islink(path) or not os.path.isdir(path): continue
        try:
            if os.lstat(path).st_uid != uid: continue
        except OSError: continue
        out.setdefault(pre, []).append((path, size(path)))
    return out

def summary(found):
    n = sum(len(v) for v in found.values()); b = sum(s for v in found.values() for _, s in v)
    parts = ', '.join('%s %d' % (p, len(v)) for p, v in sorted(found.items(), key=lambda kv: -len(kv[1])))
    return n, b, parts

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--warn', action='store_true', help='one line when idle profiles exist, nothing otherwise')
    a = ap.parse_args()
    found = scan(); n, b, parts = summary(found)
    if a.warn:
        if n: print('warning: %d idle headless-browser profile(s) in /tmp hold %.0f MB (%s); motion/tools/stale_profiles.py lists them' % (n, b / 1e6, parts), flush=True)
        return 0
    for pre, items in sorted(found.items()):
        print('%-17s %3d folders  %7.1f MB' % (pre, len(items), sum(s for _, s in items) / 1e6))
        for path, s in items: print('    %s  %.1f MB' % (path, s / 1e6))
    print('idle headless-browser profiles in /tmp: %d, %.1f MB' % (n, b / 1e6))
    return 0

if __name__ == '__main__':
    sys.exit(main())
