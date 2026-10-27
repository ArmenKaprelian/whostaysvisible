#!/usr/bin/env python3
"""Re-derives the atlas's profiles (round 15, the author's item 9 and the text rule of 26 October 2026) from the shipped data and checks the page's text.

A region or a city window has a profile only when data/insights.json holds its researched insight: the insight's sentence (at most 200
characters) and, from profiles.json (M12), the median revenue and total assets in 2024 against Russia's; the tile carries the insight's short form
(at most 76 characters). The profile never restates what the atlas shows elsewhere, which the author audits; this checker rebuilds the size
sentence by the page's rules and tests the rest: no semicolon in either form, the lengths, every text inside its box at the tile's width (the
page's own measure), and no profile at all without the insights file.

Usage: profile_check.py --page profiles.json [--fit fit.json] [--data motion/data]
       (profiles.json: the page's window.__atlas.profiles(); fit.json: window.__atlas.profileFit())
As a module: check(page, data_dir, fit=None) returns a list of findings (empty when clean).
"""
import argparse, json, math, os, re, sys
from decimal import Decimal, ROUND_HALF_UP

HERE = os.path.dirname(os.path.abspath(__file__))

# JavaScript's number formatting, as Motion.fmt writes it
def to_fixed(v, d):   # Number.prototype.toFixed: the exact value, ties to the larger magnitude
    q = Decimal(1).scaleb(-d)
    r = Decimal(abs(v)).quantize(q, rounding=ROUND_HALF_UP)
    s = format(r, 'f')
    return ('-' + s) if v < 0 and r != 0 else s
def js_round(v): return math.floor(v + 0.5)
def f_int(v): return f"{js_round(v):,}"
def f_pct(v, d=1): return to_fixed(js_round(v * 10 ** d) / 10 ** d, d) + '%'
def f_dec(v, d=2): return to_fixed(v, d)
def f_signed(v, d=1): return ('+' if v > 0 else '−' if v < 0 else '') + to_fixed(abs(v), d)

def load(data_dir, name, required=True):
    p = os.path.join(data_dir, name + '.json')
    if not os.path.exists(p):
        if required: raise SystemExit('profile_check: missing ' + p)
        return None
    with open(p, encoding='utf-8') as fh: return json.load(fh)

def derive(data_dir):
    PROF, INS = load(data_dir, 'profiles', required=False), load(data_dir, 'insights', required=False)
    def rub_m(m):   # millions of 2021 rubles, under one million in thousands
        k = js_round(m * 1000)
        return '%s million' % f_dec(m, 1) if k >= 1000 else '%s thousand' % f_int(k)
    def size(kind, key, name):
        if not PROF: return None
        R, N = PROF[kind], PROF['regions']
        def at(T, k, v): return next((i for i in range(len(T[k])) if T[k][i] == v and T['year'][i] == 2024), -1)
        i, n = at(R, key, name), at(N, 'region', 'Russia')
        if i < 0 or n < 0 or R['med_rev_m'][i] is None or R['med_assets_m'][i] is None: return None
        return 'In constant 2021 rubles, median revenue was %s and median total assets %s in 2024 (Russia %s and %s).' % (rub_m(R['med_rev_m'][i]), rub_m(R['med_assets_m'][i]), rub_m(N['med_rev_m'][n]), rub_m(N['med_assets_m'][n]))
    out = {'region': {}, 'window': {}}
    if INS:
        for kind, sect, rows, key in (('region', 'regions', 'regions', 'region'), ('window', 'cities', 'windows', 'label')):
            for name, ins in (INS.get(sect) or {}).items():
                if not ins or not ins.get('full') or not ins.get('short'): continue
                sz = size(rows, key, name)
                out[kind][name] = {'full': [ins['full']] + ([sz] if sz else []), 'tile': ins['short']}
    return out['region'], out['window'], bool(PROF), bool(INS)

def rules(kind, name, p):
    out = []
    if any(';' in t for t in p['full'] + [p['tile']]): out.append(('semicolon', kind, name))
    if len(p['full'][0]) > 200: out.append(('length', kind, name, 'insight %d characters' % len(p['full'][0])))
    if len(p['tile']) > 76: out.append(('length', kind, name, 'short form %d characters' % len(p['tile'])))
    return out

def check(page, data_dir, fit=None):
    regions, windows, medians, insights = derive(data_dir)
    out = []
    if bool(page.get('medians')) != medians: out.append(('medians', 'the page and the data disagree on whether profiles.json is shipped'))
    if bool(page.get('insights')) != insights: out.append(('insights', 'the page and the data disagree on whether insights.json is shipped'))
    for kind, mine, theirs in (('region', regions, page.get('regions', {})), ('window', windows, page.get('windows', {}))):
        for name in sorted(set(mine) | set(theirs)):
            if name not in theirs: out.append(('missing', kind, name)); continue
            if name not in mine: out.append(('extra', kind, name)); continue
            a, b = mine[name], theirs[name]
            if a['full'] != b['full']: out.append(('text', kind, name, ' '.join(b['full']), ' '.join(a['full'])))
            if a['tile'] != b['tile']: out.append(('tile', kind, name, b['tile'], a['tile']))
            out += rules(kind, name, b)
    if fit is not None:
        for pid in fit.get('overflow', []): out.append(('overflow', pid))
    return out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--page', required=True); ap.add_argument('--fit'); ap.add_argument('--data', default=os.path.join(HERE, '..', 'data'))
    a = ap.parse_args()
    page = json.load(open(a.page, encoding='utf-8')); fit = json.load(open(a.fit, encoding='utf-8')) if a.fit else None
    found = check(page, a.data, fit)
    print('profile check: %d regions and %d windows checked, %d finding(s)' % (len(page.get('regions', {})), len(page.get('windows', {})), len(found)))
    for f in found: print('  ' + ' | '.join(str(x) for x in f))
    sys.exit(1 if found else 0)

if __name__ == '__main__':
    main()
