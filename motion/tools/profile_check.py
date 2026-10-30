#!/usr/bin/env python3
"""Re-derives the atlas's profiles (round 15, the author's item 9 and the text rule of 26 October 2026) from the shipped data and checks the page's text.

A region or a city window has a profile only when data/insights.json holds its researched insight: the insight's sentence (at most 200
characters) and, from profiles.json (M12), the median revenue and total assets in 2024 against Russia's (the tile's short form left the data in
round 31). The profile never restates what the atlas shows elsewhere, which the author audits; this checker rebuilds the size
sentence by the page's rules and tests the rest: no semicolon, the length, every text inside its box at the tile's width (the
page's own measure), and no profile at all without the insights file.

Usage: profile_check.py --page profiles.json [--fit fit.json] [--data motion/data]
       (profiles.json: the page's window.__atlas.profiles(); fit.json: the tile's box fit, from builds before round 30, when the tile carried a profile box)
As a module: check(page, data_dir, fit=None) returns a list of findings (empty when clean).
"""
import argparse, json, math, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jsfmt import to_fixed, js_round, fmt_int as f_int, pct as f_pct, dec as f_dec, signed as f_signed   # Motion.fmt's rules in one module (round 18)

HERE = os.path.dirname(os.path.abspath(__file__))


def load(data_dir, name, required=True):
    p = os.path.join(data_dir, name + '.json')
    if not os.path.exists(p):
        if required: raise SystemExit('profile_check: missing ' + p)
        return None
    with open(p, encoding='utf-8') as fh: return json.load(fh)

PROFILE_YEAR = 2024   # the year the page's profiles state (explorer-app.js writes "in 2024"); check() reports a profiles.json whose latest year differs (round 18, H15)

def derive(data_dir):
    PROF, INS = load(data_dir, 'profiles', required=False), load(data_dir, 'insights', required=False)
    def rub_m(m):   # millions of 2021 rubles, under one million in thousands
        k = js_round(m * 1000)
        return '%s million' % f_dec(m, 1) if k >= 1000 else '%s thousand' % f_int(k)
    def size(kind, key, name):
        if not PROF: return None
        R, N = PROF[kind], PROF['regions']
        def at(T, k, v): return next((i for i in range(len(T[k])) if T[k][i] == v and T['year'][i] == PROFILE_YEAR), -1)
        i, n = at(R, key, name), at(N, 'region', 'Russia')
        if i < 0 or n < 0 or R['med_rev_m'][i] is None or R['med_assets_m'][i] is None: return None
        return 'In constant 2021 rubles, median revenue was %s and median total assets %s in %d (Russia %s and %s).' % (rub_m(R['med_rev_m'][i]), rub_m(R['med_assets_m'][i]), PROFILE_YEAR, rub_m(N['med_rev_m'][n]), rub_m(N['med_assets_m'][n]))
    out = {'region': {}, 'window': {}}
    if INS:
        for kind, sect, rows, key in (('region', 'regions', 'regions', 'region'), ('window', 'cities', 'windows', 'label')):
            for name, ins in (INS.get(sect) or {}).items():
                if not ins or not ins.get('full'): continue
                sz = size(rows, key, name)
                out[kind][name] = {'full': [ins['full']] + ([sz] if sz else [])}
    return out['region'], out['window'], bool(PROF), bool(INS)

def rules(kind, name, p):
    out = []
    if any(';' in t for t in p['full']): out.append(('semicolon', kind, name))
    if len(p['full'][0]) > 200: out.append(('length', kind, name, 'insight %d characters' % len(p['full'][0])))
    return out

def check(page, data_dir, fit=None):
    regions, windows, medians, insights = derive(data_dir)
    out = []
    P = load(data_dir, 'profiles', required=False)
    if P and P.get('years') and P['years'][-1] != PROFILE_YEAR: out.append(('year', "profiles.json's latest year is %s, and the page and this check write %d" % (P['years'][-1], PROFILE_YEAR)))
    if bool(page.get('medians')) != medians: out.append(('medians', 'the page and the data disagree on whether profiles.json is shipped'))
    if bool(page.get('insights')) != insights: out.append(('insights', 'the page and the data disagree on whether insights.json is shipped'))
    for kind, mine, theirs in (('region', regions, page.get('regions', {})), ('window', windows, page.get('windows', {}))):
        for name in sorted(set(mine) | set(theirs)):
            if name not in theirs: out.append(('missing', kind, name)); continue
            if name not in mine: out.append(('extra', kind, name)); continue
            a, b = mine[name], theirs[name]
            if a['full'] != b['full']: out.append(('text', kind, name, ' '.join(b['full']), ' '.join(a['full'])))
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
