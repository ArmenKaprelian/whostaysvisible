#!/usr/bin/env python3
"""Re-derives the atlas wire's cycle from the shipped data files (round 10, the author's items 14 and 15; 26 October 2026).

The generator in js/explorer-app.js (wireFacts, wireFirms, buildCycle) and this module share only the data: every data item is a template over
named fields of data/*.json, formatted here with the same rules (en-US grouping, one-decimal percentages rounded half up, the minus sign U+2212).
Tips are the page's own TIPS and are accepted by membership; the cat item is the pool entry at the keyed slot. Used by atlas-audit.py; the
command line prints the expected cycle for a context:  python3 -I motion/tools/wire_check.py motion/data 2024 national Russia [layer] [cycle]
"""
import json, math, os, sys

MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
SKIP = ('Russia', 'outside the basemap outline', 'region not recorded')

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jsfmt import fmt_int, pct as fmt_pct, signed as fmt_signed   # Motion.fmt's rules in one module (round 18: this copy rounded exact ties to even and negative halves away from zero)
def fnv(s):
    h = 2166136261
    for b in s.encode('utf-8'): h ^= b; h = (h * 16777619) & 0xffffffff
    return h
def date_of(iso):
    if not iso or len(iso) != 10: return ''
    y, m, d = iso.split('-'); return f'{int(d)} {MONTHS[int(m) - 1]} {y}'

def load(data_dir):
    rd = lambda n: json.load(open(os.path.join(data_dir, n), encoding='utf-8'))
    D = {n: rd(n + '.json') for n in ('treatednational', 'regions', 'cellsyears', 'firms', 'series', 'cells100', 'offwire', 'anchors')}
    dv = D['regions']['divisions']; D['short'] = {int(c): sh for c, sh in zip(dv['code'], dv['short'])}   # column arrays
    R = D['regions']; D['regrow'] = {(R['region'][i], R['year'][i]): i for i in range(len(R['region']))}
    global LAST; LAST = D['firms']['years'][-1]
    return D

def div_short(D, code): return 'no division code' if code == 0 else D['short'].get(code, f'division {code:02d}')
LAST = None   # the provisional, latest data year, set by load() from firms.json (round 18, H14)
def ys_of(y):
    if LAST is None: raise RuntimeError('wire_check: load() reads the latest year from firms.json before a year is written')
    return f'{y}*' if y == LAST else str(y)

def lead(D, y, band, name, layer='share'):
    """The band's own fact on the share layer in the Cells view (factFor's full form), as plain text."""
    R, ys = D['regions'], ys_of(y)
    if band == 'region' and (name, y) not in D['regrow']: band, name = 'national', 'Russia'
    i, i21 = D['regrow'].get((name, y)), D['regrow'].get((name, 2021)); nat = band == 'national'
    if layer != 'share': raise ValueError('only the share layer is re-derived')
    n, a = R['n'][i], R['a'][i]; n21, a21 = (R['n'][i21], R['a'][i21]) if i21 is not None else (0, 0)
    sh = 100 * a / n if n else None; s21 = 100 * a21 / n21 if n21 else None
    what = 'located firms' if nat else 'firms registered in the region'
    t = f'{name}, {ys}: {fmt_int(n)} {what}, {fmt_pct(sh)} with a statement'
    if y != 2021 and s21 is not None and sh is not None: t += f', {fmt_signed(sh - s21)} points against 2021'
    return t

def facts(D, y, band, name):
    """The data items in the page's order (round 25: about a quarter on the lists, half on how the body of firms responds, a quarter other)."""
    T, R, CY, FM, S, C = D['treatednational'], D['regions'], D['cellsyears'], D['firms'], D['series'], D['cells100']; F = S['facts']
    ys, out = ys_of(y), []
    nat = band == 'national'; reg = name if (not nat and any(r == name for r in R['region'])) else None
    TS = S['transitions']; tr = lambda prior: next((i for i in range(len(TS['year'])) if TS['year'][i] == y and TS['prior'][i] == prior), -1); ia, ib = tr('available'), tr('absent')
    G = S['groups']; own = lambda g, yy: next((i for i in range(len(G['year'])) if G['year'][i] == yy and G['dimension'][i] == 'ownership' and G['group'][i] == g), -1)
    pct_of = lambda a, n: fmt_pct(100 * a / n)
    k = CY['totals']['year'].index(y) if y in CY['totals']['year'] else -1; k21 = CY['totals']['year'].index(2021) if 2021 in CY['totals']['year'] else -1
    b = FM['by_year'].get(str(y))
    n = nr = 0; ri = T['regions'].index(reg) if reg and reg in T['regions'] else -1
    for i in range(T['n']):
        if T['red_from'][i] == y and not T['undated'][i]:
            n += 1
            if ri >= 0 and T['reg'][i] == ri: nr += 1
    out.append(f'{ys}: {fmt_int(n)} firms added to a list (treated) nationally' + (f', {fmt_int(nr)} in {reg}' if reg else ''))
    if k >= 0:
        E, na = CY['totals']['n'][k], CY['totals']['n_available'][k]
        out.append(f'{ys}: {fmt_int(na)} of {fmt_int(E)} eligible firms with a statement ({fmt_pct(CY["totals"]["eligible_share"][k])})' + (f', against {fmt_pct(CY["totals"]["eligible_share"][k21])} in 2021' if y != 2021 and k21 >= 0 else ''))
    if ia >= 0: out.append(f'{ys}: {fmt_int(TS["N"][ia])} of the {fmt_int(TS["origin"][ia])} firms with a statement in {y - 1} had none ({pct_of(TS["N"][ia], TS["origin"][ia])})')
    if k >= 0: out.append(f'{ys}: {fmt_int(CY["totals"]["n_located"][k])} of {fmt_int(CY["totals"]["n"][k])} eligible firms located ({fmt_pct(CY["totals"]["located_share"][k])})')
    s, p, s21, p21 = own('state', y), own('private', y), own('state', 2021), own('private', 2021)
    if s >= 0 and p >= 0:
        if y == 2021 or s21 < 0 or p21 < 0: out.append(f'{ys}: {fmt_pct(G["share"][s])} of the {fmt_int(G["n"][s])} state-related firms had a statement, against {fmt_pct(G["share"][p])} of the {fmt_int(G["n"][p])} private firms')
        else: out.append(f'{ys}: {fmt_pct(G["share"][s])} of the {fmt_int(G["n"][s])} state-related firms had a statement, against {fmt_pct(G["share"][s21])} in 2021. Private firms: {fmt_pct(G["share"][p])} of {fmt_int(G["n"][p])}, against {fmt_pct(G["share"][p21])}')
    red = sum(1 for i in range(T['n']) if T['red_from'][i] <= y)
    out.append(f'By {ys}: {fmt_int(red)} of the {fmt_int(T["n"])} firms on the lists (treated) are shown red. The {fmt_int(T["undated_n"])} on undated lists are red from 2014, and {fmt_int(T["inferred_n"])} dates of addition to a list are inferred')
    if ib >= 0: out.append(f'{ys}: {fmt_int(TS["A"][ib])} of the {fmt_int(TS["origin"][ib])} firms without a statement in {y - 1} had one ({pct_of(TS["A"][ib], TS["origin"][ib])})')
    iN = D['regrow'].get(('Russia', y))
    if iN is not None and R['d1'][iN] != 255:
        d = R['d1'][iN]; rows = [i for i in range(len(R['region'])) if R['year'][i] == y and R['region'][i] not in SKIP]; kd = sum(1 for i in rows if R['d1'][i] == d)
        out.append(f'{ys}: {div_short(D, d)} ({d:02d}) leads nationally and in {fmt_int(kd)} of {fmt_int(len(rows))} regions')
        if reg:
            ir = D['regrow'].get((reg, y))
            if ir is not None and R['d1'][ir] != 255 and R['d1'][ir] != d: out.append(f'{reg}, {ys}: {div_short(D, R["d1"][ir])} ({R["d1"][ir]:02d}) leads with {R["s1"][ir]}% of revenue')
    if reg:
        ir = D['regrow'].get((reg, y))
        if ir is not None: out.append(f'{reg}, {ys}: {fmt_int(R["listed"][ir])} of {fmt_int(R["n"][ir])} firms registered in the region are on the five lists (treated) and hold {R["lsh"][ir]}% of its revenue')
    if ia >= 0 and ib >= 0: out.append(f'{ys}: {fmt_int(TS["X"][ib])} of the firms without a statement in {y - 1} were removed from the registry ({pct_of(TS["X"][ib], TS["origin"][ib])}), against {fmt_int(TS["X"][ia])} of those with one ({pct_of(TS["X"][ia], TS["origin"][ia])})')
    if b:
        out.append(f'{ys}: {fmt_int(b["firms"])} firms on no list (comparison group) at {fmt_int(b["addresses"])} coordinate pairs')
        if y in FM['median_by_year']['year']:
            km = FM['median_by_year']['year'].index(y); out.append(f'{ys}: the median real-revenue change of firms on no list (comparison group) is {fmt_signed(FM["median_by_year"]["med"][km])}% against their own 2019 to 2021 average')
        out.append(f'{ys}: {fmt_int(b["listed"])} located firms on the lists (treated). {fmt_int(b["city_level"])} firms have other geocodes')
        out.append(f'{ys}: the largest coordinate pair holds {fmt_int(b["max_at_address"])} firms on no list. {fmt_int(b["firms_at_100plus"])} firms sit at the {fmt_int(b["addresses_100plus"])} pairs shared by 100 or more')
    if y == 2021: out.append(f'2021: {fmt_int(F["largest_location_firms"])} firms share the largest coordinate pair. Across all located firms, {fmt_int(F["firms_at_100plus_locations"])} sit at pairs shared by 100 or more')
    ct = C['change_totals']; sup = sum(1 for v in C['change']['supported'] if v)
    out.append(f'2024 against 2021: {fmt_int(sup)} 100 km cells have 50 or more located firms in both years. {fmt_pct(ct["availability_share_percent"][0])} of located firms had a statement in 2021 and {fmt_pct(ct["availability_share_percent"][1])} in 2024')
    out.append(f'2019 to 2024: {fmt_int(F["hist_all_available"])} of the {fmt_int(F["fixed_2019_cohort"])} firms followed from 2019 had a statement in every year ({pct_of(F["hist_all_available"], F["fixed_2019_cohort"])})')
    return out

def firms(D, y, band, name):
    """Four named firms on the lists that turned red in y, each as (text, follow-up): the share line of its region (round 25), or None where that region is the one shown or has no row."""
    T, R, ys = D['treatednational'], D['regions'], ys_of(y)
    here = name if band != 'national' and any(r == name for r in R['region']) else None
    ri = T['regions'].index(name) if here and name in T['regions'] else -1
    def pick(use_reg):
        idx = [i for i in range(T['n']) if T['red_from'][i] == y and not T['undated'][i] and T['name'][i] and (not use_reg or T['reg'][i] == ri)]
        return sorted(idx, key=lambda i: (T['name'][i], i))
    idx = pick(True) if ri >= 0 else []
    if len(idx) < 2: idx = pick(False)
    if not idx: return []
    picks = []
    for i in range(4):
        j = idx[(i * len(idx)) // 4]
        if j not in picks: picks.append(j)
    def follow(r):
        if r == here or r in ('outside the basemap outline', 'region not recorded'): return None
        i = D['regrow'].get((r, y))
        if i is None or not R['n'][i]: return None
        return lead(D, y, 'region', r)
    out = []
    for j in picks:
        ch = T['filed'][j][y - D['firms']['years'][0]]; st = 'available' if ch == '1' else 'absent' if ch == '0' else 'not in the registry'; d = date_of(T['red_date'][j])
        out.append((f'{T["name"][j]} · {("on a list from " + d) if d else ("on a list from " + str(y))}{" (date inferred)" if T["inferred"][j] else ""} · {ys} statement {st}', follow(T['regions'][T['reg'][j]])))
    return out

def anniversary(D, iso):
    """The anniversary sentence for an ISO day, as the page builds it (round 12, part D, item 6), or None: the anchor firm's listing date, the resident list's decree
    on 22 January, else the firms of the national list file listed on that day by a dated, non-inferred designation (one firm by name, several by count and years)."""
    y, m, d = iso.split('-'); md = f'{m}-{d}'; day = f'{int(d)} {MONTHS[int(m) - 1]}'
    A = D['anchors']['a']
    if A['listed']['date'][5:] == md: return f"{day}: {A['label']} was added to a list on this day in {A['listed']['date'][:4]}."
    if md == '01-22': return f'{day}: the 2020 filing-exemption list rests on Government Decree No. 35, signed on this day in 2020.'
    T = D['treatednational']; hits = [i for i in range(T['n']) if T['red_date'][i] and T['red_date'][i][5:] == md and not T['inferred'][i] and not T['undated'][i]]
    if not hits: return None
    years = sorted({T['red_date'][i][:4] for i in hits}); yrs = years[0] if len(years) == 1 else ', '.join(years[:-1]) + ' and ' + years[-1]
    if len(hits) == 1 and T['name'][hits[0]]: return f"{day}: {T['name'][hits[0]]} was added to a list on this day in {yrs}."
    return f'{day}: {fmt_int(len(hits))} firms were added to a list (treated) on this day in {yrs}.'

def cycle(D, y, band, name, cycle_index=0, layer='share', today=None):
    """The 50 items as dicts {kind, text}; a tip's text is None (any of the page's tips is accepted); on an anniversary (today, an ISO day) the lead carries the sentence."""
    ann = anniversary(D, today) if today else None
    L = {'kind': 'lead', 'text': lead(D, y, band, name, layer) + ('. ' + ann if ann else '')}; fs = [{'kind': 'data', 'text': t} for t in facts(D, y, band, name)]; fr = firms(D, y, band, name)
    fa, fb = fr[0::2], fr[1::2]; slots = {6, 14}
    def half(fo, fh):
        data, fi, di = [L], 0, 0
        while len(data) < 20:   # a firm at its slot, or wherever the facts have run out, with its follow-up right after it
            if (len(data) in slots or di >= len(fo)) and fi < len(fh):
                text, fol = fh[fi]; fi += 1; data.append({'kind': 'firm', 'text': text})
                if fol and len(data) < 20: data.append({'kind': 'data', 'text': fol})
                continue
            data.append(fo[di % len(fo)] if fo else L); di += 1
        items, dj = [], 0
        for p in range(25):
            if p % 5 == 4: items.append({'kind': 'tip', 'text': None})
            else: items.append(data[dj]); dj += 1
        return items
    cyc = half(fs, fa) + half(list(reversed(fs)), fb)
    pool = D['offwire']['facts']
    if pool:
        h = fnv(f'{y}|{name}'); slot = 12 + h % 26; guard = 0
        is_firm = lambda i: 0 <= i < len(cyc) and cyc[i]['kind'] == 'firm'
        while guard < 60 and (cyc[slot]['kind'] == 'tip' or is_firm(slot) or is_firm(slot - 1) or is_firm(slot + 1)):
            guard += 1; slot += 1
            if slot >= len(cyc): slot = 12
        f = pool[(h + 7 * cycle_index) % len(pool)]
        cyc[slot] = {'kind': 'cat', 'text': f["text"]}   # the fact alone since round 15 (the author's item 7C: a cat's head in place of the mark before it, no prefix)
    return cyc

if __name__ == '__main__':
    D = load(sys.argv[1]); y, band, name = int(sys.argv[2]), sys.argv[3], sys.argv[4]; layer = sys.argv[5] if len(sys.argv) > 5 else 'share'; ci = int(sys.argv[6]) if len(sys.argv) > 6 else 0
    for i, it in enumerate(cycle(D, y, band, name, ci, layer)): print(i, it['kind'], it['text'])
