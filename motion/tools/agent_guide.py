#!/usr/bin/env python3
"""The atlas's guide for a reader's AI agent (round 15, the author's item 19 as revised on 26 October 2026: TEACH YOUR AGENT; rewritten in full
on 29 October 2026 at the author's request, from the atlas's own texts only).

Builds the Markdown guide from the fixed text below (TEMPLATE) and the figures of the shipped data files (figures()), formatted as the page
formats them (tools/jsfmt.py), and writes it into js/agent-guide.js as a static string. The text describes only what the atlas shows: its terms,
both views and every layer, the tile and panels, the context line, the controls and view links, the charts, the findings as the atlas states
them, the limits and REFERENCES. Its figures are the page's: each one is computed from
the field the page reads, so a change of the data changes the guide and nothing in it is typed by hand.

It is kept current without a hand in it (the author's revision of 26 October 2026): tools/publish-set.py rebuilds it at every publish from the
data the set ships, with this builder as of the commit the set comes from, adds the publish date, and refuses the set if the guide breaks a rule;
the audits flag a working copy that no longer matches the data. The rules (29 October 2026, in place of the 1,200-word cap and the six sections):
no semicolons, no "listed" for list membership, numbered sections from 1 and paragraphs numbered within them, every layer of the page's LAYERS
named, and the public-release checks: no email address, no link but the atlas's own, no file path, no run of nine or more digits, no working note.

Usage: agent_guide.py            writes js/agent-guide.js
       agent_guide.py --check    rebuilds the guide and compares it with js/agent-guide.js and the rules (exit 1 on a finding)
As a module: build(data_dir, published=None) returns the guide (dated when published is given), check(motion_dir) the findings.
"""
import argparse, json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jsfmt import to_fixed, js_round, fmt_int, pct, signed   # Motion.fmt's rules in one module (round 18)

HERE = os.path.dirname(os.path.abspath(__file__))
MOTION = os.path.join(HERE, '..')
ATLAS = 'https://armenkaprelian.github.io/atlas/'   # the atlas on the author's site (28 October 2026; the claude.ai artifact's address before)
# Round 17 (the author's request of 27 October 2026): TEACH YOUR AGENT copies a link that a reader's agent fetches the guide from, in place of the text.
# The link must serve plain text to an agent without a session. A file inside the claude.ai artifact does not (its viewer loads the page through a token
# exchange, and the frame host answers 404 to a bare request). Since 28 October 2026 the guide is served beside the atlas on the author's site:
# tools/publish-set.py writes the dated guide to publish/agent-guide.md at each publish, the site's tools/import_atlas.py copies it to atlas/, and the site
# serves files as they are (it carries .nojekyll). With GUIDE_URL None the page's js/agent-guide.js is as before and the button copies the text.
GUIDE_URL = ATLAS + 'agent-guide.md'

def dec(v, d=3): return to_fixed(v, d)                                        # Motion.fmt.dec, three decimals by default here
def share(a, n): return pct(100 * a / n)

def app_js(data_dir):   # the page's script beside the data folder (the LAYERS list)
    return open(os.path.join(data_dir, '..', 'js', 'explorer-app.js'), encoding='utf-8').read()
def layers(js):   # [(id, label)] of the page's LAYERS, the array and the layers pushed after it
    return re.findall(r"\{ id: '(\w+)', label: '([^']+)'", js)

def figures(data_dir):
    rd = lambda n: json.load(open(os.path.join(data_dir, n + '.json'), encoding='utf-8'))
    S, SS, CY, C100, C25, FM, TRN, REG, PR, SH, BM, DN = (rd(n) for n in ('series', 'statesplit', 'cellsyears', 'cells100', 'cells25', 'firms',
                                                                        'treatednational', 'regions', 'profiles', 'shared', 'basemap', 'density'))
    F, A, f = S['facts'], S['avail'], {}
    T = CY['totals']; tot = {y: i for i, y in enumerate(T['year'])}
    def elig(y): return T['n'][tot[y]]
    def esh(y): return pct(T['eligible_share'][tot[y]])
    f['release_v'] = F['release'].replace('RFSD ', ''); f['release_date'] = F['release_date']; f['records'] = fmt_int(F['records_total'])
    f['years_span'] = F['years'].replace('-', ' to ')
    for y in (2014, 2021, 2024, 2025): f['elig_%d' % y] = fmt_int(elig(y)); f['esh_%d' % y] = esh(y)
    f['loc_2021'] = fmt_int(T['n_located'][tot[2021]]); f['locsh_2021'] = pct(T['located_share'][tot[2021]]); f['locsh_2024'] = pct(T['located_share'][tot[2024]])
    ai = {y: i for i, y in enumerate(A['year'])}
    for y in (2014, 2021, 2024): f['stm_%d' % y] = fmt_int(A['eligible_available'][ai[y]])
    f['reg_end'] = pct(A['registered_share'][-1]); f['elig_end'] = pct(A['eligible_share'][-1])
    # The firms on the five lists (treatednational): red from the year added, the undated from 2014, the inferred dates.
    n = len(TRN['red_from']); f['lists_n'] = fmt_int(n); f['undated_n'] = fmt_int(sum(TRN['undated'])); f['inferred_n'] = fmt_int(sum(TRN['inferred']))
    added = lambda y: sum(1 for i in range(n) if TRN['red_from'][i] == y and not TRN['undated'][i])                              # the context line's national count
    pulse = lambda y: sum(1 for i in range(n) if TRN['red_from'][i] == y and not TRN['undated'][i] and TRN['filed'][i][y - 2014] != '-')   # the red button's (manualMask)
    for y in (2014, 2021, 2024): f['added_%d' % y] = fmt_int(added(y))
    for y in (2014, 2021, 2024, 2025): c = pulse(y); f['pulse_%d' % y] = fmt_int(c) if c else 'none'
    f['pairs_2021'] = fmt_int(F['distinct_locations']); f['pair_max_all'] = fmt_int(F['largest_location_firms']); f['at100_all'] = fmt_int(F['firms_at_100plus_locations'])
    by = FM['by_year']
    for y in (2021, 2024):
        b = by[str(y)]; f.update({'fv_firms_%d' % y: fmt_int(b['firms']), 'fv_pairs_%d' % y: fmt_int(b['addresses']), 'fv_listed_%d' % y: fmt_int(b['listed']),
                                  'other_geo_%d' % y: fmt_int(b['city_level']), 'pair_max_%d' % y: fmt_int(b['max_at_address'])})
    f['municipal'] = str(js_round(SS['municipal_share'][1]))
    f['cohort_n'] = fmt_int(F['cohorts']['revenue_cash'])
    cities = BM['cities']['label']; f['n_windows'] = str(len(cities)); f['city_list'] = ', '.join(cities[:-1]) + ' and ' + cities[-1]
    f['density_max'] = fmt_int(DN['national']['max_n'])
    ct = C100['change_totals']; f['chg_cells'] = fmt_int(sum(C100['change_classes']['cells'])); f['chg_sh21'] = pct(ct['availability_share_percent'][0]); f['chg_sh24'] = pct(ct['availability_share_percent'][1])
    f['chg25_cells'] = fmt_int(C25['change']['supported'])
    G = S['groups']; grp = lambda dim, g, y: next(i for i in range(len(G['year'])) if G['dimension'][i] == dim and G['group'][i] == g and G['year'][i] == y)
    for g, k in (('state', 'st'), ('private', 'pv')):
        for y in (2021, 2024): i = grp('ownership', g, y); f['%s_n_%d' % (k, y)] = fmt_int(G['n'][i]); f['%s_%d' % (k, y)] = pct(G['share'][i])
    for y in (2021, 2024): i = grp('legal', 'joint_stock', y); f['js_%d' % y] = pct(G['share'][i])
    f['js_chg'] = signed(G['share'][grp('legal', 'joint_stock', 2024)] - G['share'][grp('legal', 'joint_stock', 2021)])
    f['pv_chg'] = signed(G['share'][grp('ownership', 'private', 2024)] - G['share'][grp('ownership', 'private', 2021)])
    f['st_chg'] = signed(G['share'][grp('ownership', 'state', 2024)] - G['share'][grp('ownership', 'state', 2021)])
    su, so = SS['state_unitary']['share'], SS['state_other']['share']
    f.update(su_2021=pct(su[0]), su_2024=pct(su[1]), su_chg=signed(su[1] - su[0]), so_2021=pct(so[0]), so_2024=pct(so[1]))
    labs = C100['cohort_class_labels']; lab = lambda s: s.replace('-', '–').replace('>', '')
    f['cohort_classes'] = lab(labs[0]) + ', ' + ', '.join('over ' + lab(x).rstrip('%') for x in labs[1:-1]) + ' and over ' + lab(labs[-1])
    fin = C100['fin']; ks = [i for i in range(len(fin['year'])) if fin['year'][i] == 2024 and fin['outcome'][i] == 'revenue' and fin['moderator'][i] == 'cash']
    k = max(ks, key=lambda i: fin['n_base'][i]); f.update(fin_obs=fmt_int(fin['n_obs'][k]), fin_base=fmt_int(fin['n_base'][k]), fin_chg=to_fixed(abs(fin['change_pct'][k]), 1) + '% ' + ('above' if fin['change_pct'][k] >= 0 else 'below'))
    md = dict(zip(FM['median_by_year']['year'], FM['median_by_year']['med']))
    for y in (2014, 2021, 2024, 2025): f['med_%d' % y] = signed(md[y]) + '%'
    L = C100['lists']; k = max(range(len(L['n'])), key=lambda i: L['n'][i]); f.update(ls_sanc=fmt_int(L['sanctioned'][k]), ls_gov=fmt_int(L['govstrategic'][k]), ls_n=fmt_int(L['n'][k]))
    dv = REG['divisions']; short = {int(c): s for c, s in zip(dv['code'], dv['short'])}
    skip = ('Russia', 'outside the basemap outline', 'region not recorded')
    def lead(y):
        iN = next(i for i in range(len(REG['region'])) if REG['region'][i] == 'Russia' and REG['year'][i] == y); d = REG['d1'][iN]
        rows = [i for i in range(len(REG['region'])) if REG['year'][i] == y and REG['region'][i] not in skip]
        return '%s (%02d)' % (short[d], d), sum(1 for i in rows if REG['d1'][i] == d), len(rows)
    (f['lead_div'], k21, r21), (d24, k24, r24) = lead(2021), lead(2024)
    f.update(lead_21=fmt_int(k21), regions_21=fmt_int(r21), lead_24=fmt_int(k24), regions_24=fmt_int(r24))
    if d24 != f['lead_div']: raise ValueError('the leading division differs between 2021 and 2024: the template names one')
    N = SH['national']; si = {y: i for i, y in enumerate(N['year'])}
    for y in (2014, 2021, 2024, 2025):
        i = si[y]; fa, s, f1, s1 = N['firms'][i], N['statements'][i], N['firms_100'][i], N['statements_100'][i]
        first = y == 2014   # the first line spells the comparison out, the others follow it
        f['sh_%d' % y] = '%s of %s%s (%s) at %s %s, %s%s against %s%s' % (fmt_int(f1), fmt_int(fa), ' such firms' if first else '', share(f1, fa), fmt_int(N['pairs_100'][i]),
                                                                  'shared pairs' if first else 'pairs', share(s1, f1), ' with a statement' if first else '', share(s - s1, fa - f1), ' elsewhere' if first else '')
    r = PR['regions']; i = next(j for j in range(len(r['region'])) if r['region'][j] == 'Russia' and r['year'][j] == 2024)
    f['med_rev'] = to_fixed(r['med_rev_m'][i], 1); f['med_assets'] = to_fixed(r['med_assets_m'][i], 1)
    sc = S['size_changes']; later = next(j for j in range(len(sc['id'])) if sc['quintile'][j] == 'Q5' and sc['window'][j].startswith('2023'))
    f.update(q5_22=dec(F['size_q5_2022_ratio']), q5_22_lo=dec(F['size_q5_2022_low']), q5_22_hi=dec(F['size_q5_2022_high']),
             q5_l=dec(sc['ratio'][later]), q5_l_lo=dec(sc['low'][later]), q5_l_hi=dec(sc['high'][later]))
    TS = S['transitions']; tr = lambda y, p: next(j for j in range(len(TS['year'])) if TS['year'][j] == y and TS['prior'][j] == p)
    for y in (2021, 2024):
        a, b = tr(y, 'available'), tr(y, 'absent')
        f.update({'tr_lost_%d' % y: fmt_int(TS['N'][a]), 'tr_av_%d' % y: fmt_int(TS['origin'][a]), 'tr_lost_sh_%d' % y: share(TS['N'][a], TS['origin'][a]),
                  'tr_won_%d' % y: fmt_int(TS['A'][b]), 'tr_ab_%d' % y: fmt_int(TS['origin'][b]), 'tr_won_sh_%d' % y: share(TS['A'][b], TS['origin'][b]),
                  'rm_ab_%d' % y: fmt_int(TS['X'][b]), 'rm_ab_sh_%d' % y: share(TS['X'][b], TS['origin'][b]), 'rm_av_%d' % y: fmt_int(TS['X'][a]), 'rm_av_sh_%d' % y: share(TS['X'][a], TS['origin'][a])})
    f['hist_cohort'] = fmt_int(F['fixed_2019_cohort']); f['hist_all'] = fmt_int(F['hist_all_available']); f['hist_sh'] = share(F['hist_all_available'], F['fixed_2019_cohort'])
    rr = {(REG['region'][j], REG['year'][j]): j for j in range(len(REG['region']))}; m24, m21 = rr[('Moscow', 2024)], rr[('Moscow', 2021)]
    sh24, sh21 = 100 * REG['a'][m24] / REG['n'][m24], 100 * REG['a'][m21] / REG['n'][m21]
    f.update(msk_n=fmt_int(REG['n'][m24]), msk_sh=pct(sh24), msk_chg=signed(sh24 - sh21))
    return f

def build(data_dir, published=None):
    js = app_js(data_dir); f = figures(data_dir)
    f['dated'] = ('Rebuilt from the atlas’s data when the atlas was published on %s.\n\n' % published) if published else ''   # the publish set's copy only
    f['atlas'] = ATLAS
    return TEMPLATE.format(**f)

PUBLIC = [('email address', r'[\w.+-]+@[\w-]+\.\w'), ('link other than the atlas', r'https?://(?!%s(?:\s|$))\S+' % re.escape(ATLAS.split('://', 1)[1])),   # round 19: from ATLAS, so a move of the atlas is one edit
          ('file path', r'(?:~/|/home/|/tmp/|\b[A-Za-z]:\\)'), ('nine or more digits', r'\d{9,}'), ('working note', r'\b(?:TODO|FIXME|XXX)\b')]

def rules(text, js=None):
    out = [('public', '%s: %s' % (name, m.group(0)[:60])) for name, rx in PUBLIC for m in [re.search(rx, text)] if m]
    if ';' in text: out.append(('semicolon', text[max(0, text.index(';') - 40): text.index(';') + 10]))
    if re.search(r'\blisted\b|\blisting\b', text, re.I): out.append(('listed', re.search(r'.{0,40}\b(listed|listing)\b.{0,20}', text, re.I).group(0)))
    secs = re.findall(r'^## (\d+)\. ', text, re.M)
    if secs != [str(i) for i in range(1, len(secs) + 1)] or not secs: out.append(('sections', ','.join(secs)))
    sec = None   # paragraphs numbered within their section: N.1, N.2, ... under "## N."
    for line in text.splitlines():
        h = re.match(r'## (\d+)\. ', line)
        if h: sec, k = h.group(1), 0; continue
        p = re.match(r'(\d+)\.(\d+)\. ', line)
        if p:
            k += 1
            if p.group(1) != sec or int(p.group(2)) != k: out.append(('numbering', line[:40]))
    if js is not None:   # every layer of the page named, and its id among the view link's layers (the guide had missed two, 29 October 2026)
        for lid, label in layers(js):
            if label not in text: out.append(('layer', 'the layer "%s" is not named' % label))
            if not re.search(r'(?<![\w-])%s(?![\w-])' % re.escape(lid), text.split('10.4.', 1)[-1].split('10.5.', 1)[0]): out.append(('layer', 'the layer id %s is not in 10.4' % lid))
    return out

def js_of(text):
    return ('// The guide for a reader\'s AI agent (round 15, the author\'s item 19, TEACH YOUR AGENT), built by tools/agent_guide.py from the data files.\n'
            '// A static string: the footer\'s button copies it, nothing is fetched. Do not edit by hand: change tools/agent_guide.py and run it.\n'
            'window.AGENT_GUIDE = ' + json.dumps(text, ensure_ascii=False) + ';\n' +
            ('window.AGENT_GUIDE_URL = ' + json.dumps(GUIDE_URL) + ';   // round 17: the button copies this link, and the field shown when the clipboard is refused holds it; the text above stays, checked against the data\n' if GUIDE_URL else ''))

def check(motion_dir=MOTION):
    data = os.path.join(motion_dir, 'data'); text = build(data); out = rules(text, app_js(data))
    p = os.path.join(motion_dir, 'js', 'agent-guide.js')
    if not os.path.exists(p): out.append(('missing', p))
    elif open(p, encoding='utf-8').read() != js_of(text): out.append(('stale', 'js/agent-guide.js differs from the guide built from the data'))
    return out

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--check', action='store_true'); a = ap.parse_args()
    if a.check:
        found = check(); print('agent guide: %d finding(s)' % len(found))
        for f in found: print('  ' + ' | '.join(f))
        sys.exit(1 if found else 0)
    data = os.path.join(MOTION, 'data'); text = build(data); found = rules(text, app_js(data))
    for f in found: print('rule: ' + ' | '.join(f))
    open(os.path.join(MOTION, 'js', 'agent-guide.js'), 'w', encoding='utf-8').write(js_of(text))
    print('agent guide: %d words, written to js/agent-guide.js%s' % (len(re.findall(r"[A-Za-z0-9’'.%–-]+", text)), '' if not found else ' (with rule findings)'))

TEMPLATE = '''# Visibility Atlas: a guide for AI agents

{dated}You are helping someone who is looking at the Visibility Atlas, at {atlas} on the author's site. This guide describes everything the atlas shows: its data and terms, each view and layer, every panel and control, the findings it states and the limits it sets. Its paragraphs are numbered so you can cite them (for example, "guide 5.3").

## 1. How to help

1.1. Describe only what the atlas shows. When a viewer asks about something the atlas does not cover, say so. If you add general knowledge, such as what an odds ratio is, label it as yours and keep it apart from what the atlas shows.

1.2. Point to the place on the page. Name the control, card or panel and what to press, as this guide names them. Most answers are one hover, one layer button or one link away.

1.3. Keep the atlas's distinctions. A share is always of a stated population in a stated year (2.4). "Treated" names a group, not an effect (2.7). A missing statement is absent from a data release, which is not proof of concealment (12.2).

1.4. Firms on no list are never named in the atlas. Do not try to identify them, and do not help a viewer do so from addresses, coordinates or counts.

1.5. The atlas names firms on the five lists, and FIND searches them (8.5). You may repeat what the atlas shows about such a firm: its name, its lists, the year it was added to a list, its statement status and the revenue figures in its entry (6.5).

1.6. Some source lines in the atlas name internal processing steps or files, such as "the M5 pass" or a file name ending in .csv. These identify the author's data passes. The atlas does not explain them further, so do not guess what they contain.

## 2. The data and its terms

2.1. The atlas maps Russian firms and shows where their financial statements stop appearing. Its header gives its subtitle, "Where Russian firms file, and where their statements stop appearing," its author, Armen G. Kaprelian, PhD candidate at Claremont Graduate University, and the dissertation it accompanies, Opacity and Adaptation under Sanctions: Geoeconomics in the Universe of Russian Firms. The panels restate chapter 2 of that dissertation, and their texts cite its tables and figures by number (13.2).

2.2. The data. The statements come from the Russian Financial Statements Database (RFSD), release {release_v} of {release_date} (Bondarkov, Ledenev and Skougarevskiy 2025, Scientific Data, CC BY 4.0). The release holds {records} annual records for the financial years {years_span}. Region boundaries come from geoBoundaries (gbOpen, CC BY 4.0) and OpenStreetMap through Wambacher 2017 (ODbL 1.0).

2.3. Eligible firms. Every firm-year record the RFSD marks eligible, with or without a statement. Eligibility is the data provider's operational classification, not a verified legal duty to file. Eligible firms per year: {elig_2014} in 2014, {elig_2021} in 2021, {elig_2024} in 2024 and {elig_2025} in 2025.

2.4. Statement availability. A statement is available when the release holds the firm's own filing for that year, filed and not imputed. The atlas's word for this is an "original statement." A share with a statement is the fraction of a group's eligible firms in a year that have one. Every share in the atlas is of one year's population. It compares years, not the same firms followed over time, unless a text says it follows firms (2.16).

2.5. Registered at year-end. Eligible firms that are also registered at the end of the financial year. It is the second population in the national chart (9.3) and the second line of the Statement share tile (5.2).

2.6. Providers and years. Rosstat supplied the statements before 2019 and the Federal Tax Service (FNS) supplies them from 2019. The national chart shades the FNS years and breaks its lines between 2018 and 2019. 2011 has no statements. 2012 and 2013 have statements but no coordinates, so the map starts in 2014. 2025 is the flagged latest-year extension, written 2025* in most titles, notes and the context line.

2.7. The five lists are the sanctions list, the decree list, the 2020 filing-exemption list (Government Decree No. 35 of 22 January 2020), the government strategic list and the presidential strategic list. The RFSD's authors provided them on request. The atlas names them and does not describe their contents further. They are fixed memberships, not dated designations: a firm on a list stays in the group in every year.
- Firms on the five lists (treated): firms on at least one list. "Treated" names the study's group, not an effect.
- Firms on no list (comparison group): eligible firms on none of the lists.
- Firms whose membership is unknown are kept apart from the comparison group.
- Sanctioned-only firms: firms on the sanctions list and on no other list (9.2).

2.8. Dates of addition. Although memberships are fixed, the map turns a firm red from the year it was added to a list. Of the {lists_n} firms on the lists, {undated_n} are on lists without dates and are red from 2014.

2.9. Located firms. Eligible firms whose registered address has map coordinates. Unlocated firms stay in the counts but are not drawn. {locsh_2021} of eligible firms are located in 2021 ({loc_2021} of {elig_2021}) and {locsh_2024} in 2024.

2.10. Registered addresses. Every location in the atlas is a registered legal address. A registered address can be a business centre or an address rented for registration and correspondence, so several firms can share one. The Federal Tax Service tracks mass-registration addresses.

2.11. Coordinate pairs. The distinct coordinates of geocoded registered addresses. In 2021 the located firms sit at {pairs_2021} pairs. The most shared pair holds {pair_max_all} firms, and {at100_all} located firms sit at pairs shared by 100 or more.

2.12. Geocode levels. A house- or street-level geocode matches an address to a building or a street. Other geocodes are coordinates without a verified house or street match. The Firms view and the 1 km squares draw only firms on no list with house- or street-level geocodes. Firms with other geocodes are counted and not drawn: {other_geo_2021} in 2021 and {other_geo_2024} in 2024.

2.13. Ownership and legal form come from the registry's codes (OKFS and OKOPF), grouped as the chapter groups them.
- State-related firms: ownership code for state or municipal ownership, mixed ownership with state participation, or state-corporation ownership.
- State-run firms: state-related firms with the unitary-enterprise legal form. A federal, regional or municipal body owns them outright and they issue no shares. They are about half of the state-related firms, and {municipal}% of them were municipal in 2024.
- The codes do not establish operational control or disclosure protection.

2.14. Industry. Firms are classed by division, the two-digit OKVED 2 code, which is identical to NACE Rev. 2 at two digits. The atlas uses NACE Rev. 2 division names and shows the code in brackets, as in "Wholesale trade (46)." The industry layer groups divisions into nine classes (5.7).

2.15. Revenue. Nominal revenue is in current rubles. Real revenue is in constant 2021 rubles, deflated by the World Bank's linked GDP deflator for Russia, rebased to 2021. Revenue is counted where a firm is registered.

2.16. The revenue cohort by cash share. Firms eligible in 2021 with usable 2021 statements for revenue, cash relative to assets and the controls: {cohort_n} firms. Membership is fixed in 2021. Later survival, filing and list membership do not change who belongs.

2.17. The 50-firm support rule and disclosure. In the Cells view a share is shown only where 50 or more firms make up its denominator. Cells, squares and regions with fewer are grey. List counts under 5 in a cell are not shown. Counts under 10 in the 250 m city cells and the 5 km density cells are banded: they read "fewer than 10." The Firms view and the 1 km squares show exact counts, and the Firms view shows each coordinate pair's own share.

2.18. The {n_windows} city windows are square areas around the cities under GO TO (8.4): {city_list}. The tile names the window and its size, as in "Moscow window, 90 by 90 km." Inside them the atlas has 250 m cells for 2021 and, on the shared-pairs layer, 1 km squares.

## 3. The page

3.1. The header gives the title, the subtitle, the author line and the dissertation's title. REFERENCES at its right opens the reference panel (13).

3.2. The map fills the left. Over it sit the legend (7.1), the revenue mix box on the industry layer (7.2), the NOTE (7.3), the scale bar and zoom buttons (7.5), and along its bottom edge the context line (7.4).

3.3. The side column holds six cards: LAYER (8.1), GO TO (8.4), UNDER THE CURSOR (6.2), ADJUSTED ODDS RATIOS FOR STATEMENT AVAILABILITY (9.2), NATIONAL AVAILABILITY BY YEAR (9.3) and GROUPS, 2021 TO 2024 (9.4). Each card's i button opens its reading text. On the three chart cards it gives what the chart shows, its findings, the question behind it and its source. On LAYER it opens the METHOD text (8.1), on GO TO the instructions for moving the map (10.1 to 10.3), and on UNDER THE CURSOR an account of its rows, chart and disclosure rules. The legend and the mix box have i buttons of their own. The triangle buttons collapse the cards, the legend, the mix box and the NOTE.

3.4. The footer holds the author's name, the email address with a copy button, TEACH YOUR AGENT, which copies the link to this guide, a link to the author's website, buttons for the author's X account and for sharing on X, and the data credit line: "RFSD {release_v}, CC BY 4.0 · geoBoundaries gbOpen, CC BY 4.0 · OpenStreetMap, ODbL 1.0."

3.5. On a phone the cards stack below the map, the hover tile docks inside the map, and the map takes touch gestures (10.3).

3.6. The atlas opens in the Cells view on Leading industry by year, 2024, with the whole country in view.

## 4. The two views

4.1. VIEW, at the top of the LAYER card, switches between CELLS and FIRMS.

4.2. The Cells view aggregates firms into grid cells, or into regions on the state-related layer. The grid gets finer as you zoom in. Depending on the layer, it runs from 100 km cells at the country scale to 25 km cells closer in, then 1 km squares, and 250 m cells inside the city windows. Section 5 gives each layer's grids. A cell's colour is its value in the legend's classes. Grey means fewer than 50 firms (2.17).

4.3. The Firms view draws the firms themselves at their registered addresses, year by year. It draws every located eligible firm on no list with a house- or street-level geocode, grouped by coordinate pair, and every located firm on the five lists as a red mark (4.5). The note gives the year's totals: in 2024, {fv_firms_2024} firms on no list at {fv_pairs_2024} coordinate pairs and {fv_listed_2024} firms on the five lists. In 2021 the totals are {fv_firms_2021} firms at {fv_pairs_2021} pairs and {fv_listed_2021} firms on the lists.

4.4. Pixels and dots. Below 20 px per km of map, each screen pixel sums the firms on no list at the addresses inside it. The legend states the pixel's size at the current zoom. Blocks of 2 and 3 px mark pixels with 10 and 100 or more firms. Past 20 px per km the map draws dots: each dot is one coordinate pair, and larger dots hold more firms.

4.5. The red marks show firms on the five lists. Before the year a firm was added to a list it is a grey mark with a red rim. From that year it is solid red if it has a statement for the year shown, and hollow red if it has none. Hover a red mark for the firm's name (6.5).

4.6. What colours the Firms view. On Statement share by year it is the share of the firms in each pixel or at each pair with a statement that year. On Median revenue change it is the firm-level revenue class (5.6). On Leading industry by year it is the leading class (5.7). On the other layers the Firms view shows firm counts by brightness, and its legend says the layer is a cell layer. At dot zoom those layers draw every coordinate pair in one colour.

4.7. In the Firms view a toggle under the label MARKS, also named PAIRS SHARED BY 100+, draws a ring around each coordinate pair shared by 100 or more firms, on any layer. It adds a row to the legend and a line to the tile at such a pair. It is not the Cells-view layer of the same name (5.9).

## 5. The nine layers

The LAYER card groups the layers under COUNTS, STATEMENTS and REVENUE. Some layers show a fixed year or comparison and hide the year row. The others follow the year slider (8.2).

5.1. Firm density, 2021 (COUNTS, fixed to 2021). Located eligible firms at registered addresses per cell in 2021. Grids: 5 km cells across the country, 1 km squares closer in (firms on no list with a house- or street-level geocode), and 250 m cells in the city windows. Classes: 1–2, 3–5, 6–10, 11–25, 26–60, 61–150, 151–400 and more than 400 firms. The tile also gives the cell's firms with a 2021 statement. The busiest 5 km cell, over central Moscow, holds {density_max} located firms.

5.2. Statement share by year (STATEMENTS, follows the slider, 2014 to 2025). The share of located eligible firms with an original statement, per cell and year. The denominator is the cell's located eligible firms that year. Grids: 100 km cells, 25 km cells closer in, 1 km squares from the address files for every year, and 250 m cells in the city windows for 2021. Classes at 100 km: under 20%, 20–35, 35–50, 50–60, 60–70 and 70% or more. The 1 km squares use their own classes (under 55%, 55–62, 62–68, 68–74 and 74% or more) and count only firms on no list with house- or street-level geocodes. The tile adds the cell's firms registered at year-end and their share, and the cell's sanctions-list members. The note gives the national figure: {esh_2021} of eligible firms in 2021 and {esh_2024} in 2024.

5.3. Change, 2024 against 2021 (STATEMENTS, fixed). The change in the located share with a statement, in percentage points, in 100 km cells with 50 or more located firms in both years. Six classes at ±2 and ±5 points: more than +5, +2 to +5, 0 to +2, −2 to 0, −5 to −2 and −5 or less. The legend gives each class's count of cells. {chg_cells} cells qualify at 100 km. Across these cells the located share moves from {chg_sh21} to {chg_sh24}. Closer in, 25 km cells follow the same rule ({chg25_cells} cells). The atlas notes that the chapter's figure shows only the 100 km cells. Each year counts the firms registered then, not the same firms. The tile gives both years' counts and shares and the change.

5.4. Change: state-related (STATEMENTS, fixed). The change in the share of eligible state-related firms (2.13) with a statement, 2024 against 2021, by region. Firms are counted in the region where they are registered, located or not. A region is classed only where 50 or more state-related firms are registered in both years. Amber regions lost availability among state-related firms and cyan regions gained it, in classes of 10 points: more than +20, +10 to +20, 0 to +10, −10 to 0, −20 to −10 and −20 or less. The legend gives each class's count of regions and the count of grey regions. Nationally the share falls from {st_2021} of {st_n_2021} firms in 2021 to {st_2024} of {st_n_2024} in 2024. The layer shows where in the country the decline sits. The tile gives both years' counts and shares. Under the cursor shows no chart on this layer.

5.5. Cohort inclusion (REVENUE, fixed to 2021). The share of a cell's located eligible firms in 2021 that belong to the revenue cohort by cash share (2.16). Five classes, pooled over the supported cells: {cohort_classes}. 100 km cells only. The next layer (5.6) uses the same cohort.

5.6. Median revenue change (descriptive) (REVENUE, fixed). In the Cells view: the percent change of each cell's median real revenue among cohort firms observed in 2024, against the cell's 2021 median, in cells with 50 or more observed firms. Classes: more than +20%, +10 to +20, 0 to +10, −10 to 0, −20 to −10 and −20% or less. 100 km cells only. It is descriptive because the firms observed change from year to year: a cell's median can move because the set of firms observed changes, not only because their revenue changed. Its source line says it is "Not a Chapter 3 estimate." Example: in the 100 km cell over Moscow, the one with the most cohort firms, {fin_obs} of {fin_base} cohort firms are observed in 2024, and their median real revenue is {fin_chg} the cell's 2021 median.
In the Firms view the layer follows the slider and colours firms on no list by a firm-level measure: each firm's real revenue against its own 2019–2021 average, minus the year's median. Classes: −50% or less, −50 to −20, −20 to 0, 0 to +50, +50 to +150 and more than +150%. Faint marks have no usable baseline. Pixels count filers, not firms.

5.7. Leading industry by year (REVENUE, follows the slider). Per cell and year, the division with the largest share of nominal revenue among located eligible firms with a statement and a positive revenue value. Firms on the five lists are included, and the tile gives their share of the cell's revenue. Grids: 100 km and 25 km cells for 2014 to 2025, and 1 km squares for every year, coloured by the class with the largest revenue at their coordinate pairs. In the Firms view the colour is the leading class at each coordinate pair, over every firm there with a statement and a positive revenue value. Pairs without one are faint. The nine classes and their divisions:
- Agriculture, extraction and energy: 01 to 03, 05 to 09, 35
- Manufacturing: 10 to 33
- Construction: 41 to 43
- Trade: 45 to 47
- Transport and logistics: 49 to 53
- Finance and real estate: 64 to 66, 68
- Professional services: 58 to 63, 69 to 75, 77 to 82
- Public and social: 84 to 88
- Other: 36 to 39, 55, 56, 90 to 99, and firms without a division code
{lead_div} leads nationally and in {lead_21} of {regions_21} regions in 2021 and {lead_24} of {regions_24} in 2024. Shares are within the year.

5.8. List members, 2021 (COUNTS, fixed to 2021). Located members of the sanctions list per cell in 2021, at 100 km and 25 km. Classes: 5–19, 20–49 and 50 or more members, with each class's count of cells in the legend. Cells with 1 to 4 members show no count (2.17). The tile also gives the cell's members of the government strategic list. Example: the 100 km cell over Moscow holds {ls_sanc} sanctions-list members and {ls_gov} government strategic list members among {ls_n} located eligible firms.

5.9. Pairs shared by 100+ (COUNTS, follows the slider). The share of a cell's firms registered at coordinate pairs shared by 100 or more firms, among located eligible firms on no list with a house- or street-level geocode, the Firms view's population. Firms with other geocodes are left out, since a shared city-centre coordinate is not a shared registration. Darker cyan means more of the cell's firms are at such pairs. Classes: none, under 2.5%, 2.5–5, 5–10, 10–20 and 20% or more. Grids: 100 km cells at the country scale, 25 km cells closer in and 1 km squares inside the {n_windows} city windows. The tile and Under the cursor compare the share with a statement at the shared pairs and elsewhere in the cell, and the card's chart plots both by year. National figures from the note:
- 2014: {sh_2014}
- 2021: {sh_2021}
- 2024: {sh_2024}
- 2025*: {sh_2025}
The atlas computes this comparison from its address files. The chapter does not report it, and it is descriptive.

## 6. Hovering: the tile and Under the cursor

6.1. The tile. Hovering the map opens a tile at the cursor. Its first line names the region and, in the Cells view on every layer but Change: state-related, ends with a red number: the firms on the five lists present in the layer's year at coordinates inside the hovered cell, counted at the cell's own size. A cell without them shows 0. The next lines give the layer's values for the cell, square, pixel, pair or region, with counts of firms. Then come the coordinates and the pixel size ("1 px = 7.4 km"). The tile gives the values of the cell, square or pixel. The region's own figures appear on the context line (7.4).

6.2. UNDER THE CURSOR repeats the tile's values as labelled rows and adds a chart and the profile. In the Firms view it also lists the firms on the five lists nearby. Every share comes with its count of firms. The chart plots the share of located eligible firms with an original statement in that cell by financial year, leaving out years with fewer than 50 firms. On a 1 km square it plots the surrounding 25 km cell. The 1 km city cells plot 2019 to 2024. The 250 m cells and the 5 km density cells carry 2021 only and have no chart. On the shared-pairs layer it plots the firms at shared pairs against those elsewhere. The state-related layer shows a note in place of a chart.

6.3. In the Firms view the tile describes the pixel or pair at the cursor: its firms on no list and their coordinate pairs, how many have a statement that year, on the industry layer the leading division's share of revenue there, and the firms on the five lists nearby, split into red (with a statement), hollow (without) and "added later" (added to a list after the year shown). A line gives the firms in view. Under the cursor gives their count and the radius it searched.

6.4. The profile. For a region, or a city window when zoomed into one, the panel gives one sourced sentence on its economy, then the medians of revenue and total assets in 2024, in constant 2021 rubles, of firms registered in the region (or located in the window) with a statement and a positive value, where 50 or more firms. For Russia as a whole the medians are {med_rev} million rubles of revenue and {med_assets} million of total assets. Many sentences concern sanctions designations and other events involving firms in the region. Their sources appear by region and window under REFERENCES, INSIGHTS (13.4).

6.5. A firm on the five lists. The tile gives the firm's display name, the year it was added to a list ("undated" for lists without dates) and, in brackets, its share of the revenue of every firm at its coordinate pair, from its most recent statement up to the year shown. The year is named when it is not the slider's year. Under the cursor adds:
- the name as filed, in Cyrillic
- "(transliterated)" where the atlas transliterated the filed name into Latin letters
- whether it has a statement for the year shown
- its lists
- its revenue from its most recent statement up to the year shown, in "mn rubles", with that statement's year
- "one of N entries under this name" where several entries share the name
Display names come from the list files, in Latin letters, with the legal form abbreviated after a comma and cut at 60 characters. A few firms on the lists have no name in the list files and appear as "unnamed."

## 7. The map's overlays

7.1. The legend (bottom left of the map) gives the layer's title with its year and grid, its classes, and the grey and red keys. Its i button shows the reading side: how the colour, the red number and the pixel blocks are read at the current zoom.

7.2. REVENUE MIX appears on Leading industry by year. It gives the revenue mix of what lies under the cursor, or of the whole view when the cursor is off the map. It shows each division's share of nominal revenue among firms with a statement and a positive revenue value, the eight largest divisions and then the rest, in the industry layer's colours. Its first line says what it sums: 100 km cells, 1 km squares or coordinate pairs in view.

7.3. NOTE states the layer's national figures for the year shown, such as the year's share with a statement and the data provider, or the Firms view's totals.

7.4. The context line runs along the bottom of the map, with the outline of the place it describes at its left. It gives one sentence about the place under the camera for the layer and year shown: the country at the national view, the region under the cursor or at the map's centre, or a city window when zoomed into one. On most layers the sentence gives the place's firms and its share with a statement, and in years other than 2021 the change against 2021. On Change, 2024 against 2021 it gives the shares in 2021 and 2024, on Leading industry by year the leading division and its share of revenue, on List members, 2021 how many of the place's firms are on the five lists, and in the Firms view the year's firms on no list, their coordinate pairs and the firms on the lists. A region's figures count the firms registered in the region. On a narrow map the sentence is shorter. Once in a while, when nothing moves, a tip on using the page takes its place. The triangle at its right end collapses it.

7.5. The scale bar shows kilometres at the current zoom. Under it, + and − zoom, and the bracket button fits the country. The ×1.0 readout gives the zoom relative to that fit.

7.6. City names are printed on the map. A watermark of the author's initials sits near the bottom of the map.

## 8. The LAYER and GO TO cards

8.1. LAYER holds VIEW (4.1), the layer buttons in their groups (section 5), the Firms view's PAIRS SHARED BY 100+ toggle (4.7) and the year row. Its i button opens the METHOD text: a summary of the data and its counts, the current layer's source line, and "Reading the atlas", the reading rules restated in 12.1. MORE expands it.

8.2. The year row appears for the layers that follow the slider (5.2, 5.7, 5.9) and in the Firms view. The slider runs from 2014 to 2025*. The play button steps the years forward one a second from the year shown to 2025, starting from 2014 if the year shown is 2025, and pauses on a second press. Its tooltip reads "Run the years from 2014 to 2025, one a second."

8.3. The red button. In the Cells view, on Statement share by year and Leading industry by year, it pulses the cells holding a firm added to a list in the year shown. In the Firms view it replays a west-to-east sweep in which each of those firms swells in turn. Its label counts the firms it shows that year: {pulse_2014} in 2014, {pulse_2021} in 2021, {pulse_2024} in 2024 and {pulse_2025} in 2025. The button is hidden on the other Cells-view layers and disabled in years with no such firm. In the Firms view, stepping the year forward also pulses the firms that turn red in the new year.

8.4. GO TO holds FIND, a minimap of Russia whose city labels fly to the {n_windows} cities (on a phone, a row of city buttons takes its place), RUSSIA (fit the country), CENTRAL MOSCOW (250 m), which opens the 250 m cells of central Moscow, and LINK TO CURRENT VIEW, which copies a link to the view on screen. Each city's tooltip gives a fact about the place.

8.5. FIND searches the firms on the five lists by name, in Latin or Cyrillic letters. Arrow keys move through the matches, and Enter or a click chooses one. The atlas then switches to the Firms view, moves to a year in which the firm is present if needed, and flies to it. Escape closes the list, then clears the text.

## 9. The chart cards

9.1. On screens wider than 900 px, a click on any chart in the column, the Under the cursor chart included, enlarges it over the map. A click or Escape puts it back.

9.2. ADJUSTED ODDS RATIOS FOR STATEMENT AVAILABILITY. Odds ratios from the chapter's binary logit models with industry, region, legal-form and ownership fixed effects and year effects, on a logarithmic axis with ticks at 0.5, 1, 2 and 4. A ratio above 1 means higher odds of an available statement than the reference group. Whiskers show 95% confidence intervals, and standard errors are two-way clustered by industry and region. Three lines:
- Q5 vs Q1: the largest asset quintile against the smallest, for a statement in the following year among continuing firms with a statement for the year before (Table B.4). Dots for 2020 to 2024, between 3 and 4, highest in 2022 and 2023.
- Q2 vs Q1: the second quintile against the smallest, same sample, without whiskers. Dots for 2020 to 2024, flat near 2.
- Sanctioned-only firms against firms on no list, for a statement in the year among eligible firms (Table B.7). Dots for 2019 to 2024, above 1 in 2019 and falling below 1 from 2021, lowest in 2024.
The chart prints no values. Read levels from its axis and do not quote exact ratios beyond those in the card's text.
The card's findings, in its words: larger asset quintiles have greater conditional availability in both provider eras. The Q5 vs Q1 odds ratio rises in 2022 against 2021, a ratio of odds ratios of {q5_22} (95% confidence interval {q5_22_lo} to {q5_22_hi}). The 2023–2024 increase, a ratio of odds ratios of {q5_l} ({q5_l_lo} to {q5_l_hi}), is smaller when wholesale trade is excluded. Sanctioned-only firms have lower availability than firms on no list by 2024.

9.3. NATIONAL AVAILABILITY BY YEAR. The share of firms with a statement by financial year, 2012 to 2025*, for two populations: the year's eligible firms and those of them registered at year-end (Table B.1). The FNS years from 2019 are shaded, and the lines break between 2018 and 2019. On Statement share by year and Leading industry by year, a dashed line marks the year shown. The chart prints its end values: eligible {elig_end} and registered {reg_end} in 2025*. The NOTE on Statement share by year gives the eligible share for each year on the slider, for example {esh_2014} in 2014, {esh_2021} in 2021 and {esh_2024} in 2024.

9.4. GROUPS, 2021 TO 2024. The share of eligible firms with a statement in 2021 and 2024, by ownership and legal form, with the change in points:
- joint-stock companies: {js_2021} to {js_2024}, {js_chg}
- private firms: {pv_2021} to {pv_2024}, {pv_chg}
- state-related firms: {st_2021} to {st_2024}, {st_chg}
- state-run firms: {su_2021} to {su_2024}, {su_chg}
The state-run firms are about half of the state-related firms and carry the whole decline. The other state-related firms rise, from {so_2021} to {so_2024}. The card's i text adds that the declines are concentrated in 2024 (Figures 2.2 and 2.3).

## 10. Driving the atlas

10.1. Mouse. Scroll, or the + and − buttons, to zoom. Drag to pan. A click on a cell flies to it, or to its city if the cell holds one. From a city a click goes to the 20 km scale, then 2.5 times closer. In the Firms view, clicks past the 20 km scale zoom 4 times closer. Shift+click zooms back out from the point.

10.2. Keys, with the map focused: + and − zoom, 0 fits the country, and the arrows pan (Shift with an arrow pans in smaller steps). Escape puts an enlarged chart back.

10.3. Touch. Drag with one finger, pinch to zoom, tap a cell for its values, and double-tap to zoom.

10.4. View links. A view's address ends in a fragment of the form #mode_layer_year_lat_lon_SPANkm, for example #firms_industry_2024_55.76656_49.12078_44.6095km.
- mode: cells or firms
- layer: density, share, change, gs (Change: state-related), cohort, lists, fin (Median revenue change), industry or shared (Pairs shared by 100+)
- year: 2014 to 2025
- then the centre's latitude and longitude in decimal degrees, and the span in km across the map's shorter side
The ending _fit in place of the coordinates fits the country, as in #cells_share_2021_fit. LINK TO CURRENT VIEW copies such a link.

10.5. City anchors. #Moscow opens the Moscow view and #Moscow-firms the same in the Firms view. Every city under GO TO works the same way, with hyphens for spaces (#St-Petersburg, #Nizhny-Novgorod, #Rostov-on-Don). #Russia fits the country, and #Central-Moscow opens the 250 m cells.

## 11. Findings as the atlas states them

11.1. National availability rises from {esh_2021} of eligible firms in 2021 to {esh_2024} in 2024 (Table B.1). This series is the national level against which the group, size and list comparisons are read.

11.2. Groups. From 2021 to 2024 availability falls among state-related firms, all of it among the state-run firms, and rises among private firms and joint-stock companies (9.4). The atlas calls these population comparisons the chapter's clearest findings on the sanctions period. It says the chapter's opacity model organizes them without predicting them.

11.3. Size. Larger asset quintiles have greater conditional availability. The largest firms' advantage rises modestly after 2021 (9.2). The atlas calls this financial selection: the largest firms stay visible.

11.4. The lists. Sanctioned-only firms have lower availability than firms on no list by 2024 (9.2, Table B.7). The atlas calls this comparison the most direct test of the chapter's opacity prediction: under the chapter's assumptions, firms exposed to sanctions value withholding more.

11.5. The question behind all of them, in the atlas's words: whether sanctions increase the value of withholding financial information. The chapter measures withholding through statement availability.

11.6. Shared registrations. In the four years quoted in 5.9, firms at coordinate pairs shared by 100 or more firms have a statement less often than firms elsewhere. The atlas computes this itself and marks it as descriptive, outside the chapter.

## 12. What not to infer

12.1. The atlas's reading rules, as the METHOD text states them: descriptive associations, not causal effects. Absence from the archive is not withdrawal or concealment. The lists are fixed memberships, not dated designations. "Treated" names the study's group, not an effect. Every finding in section 11 is a descriptive or conditional association, so do not present a difference between groups as an effect of sanctions.

12.2. A missing statement is absent from the RFSD release. The release does not recover the public archive as it stood in each year, so absence is not proof that a firm withheld or withdrew a statement.

12.3. The other limits are stated where they apply: locations are registered legal addresses (2.10), annual shares compare each year's population (2.4), ownership codes do not establish control (2.13), Median revenue change is descriptive (5.6), and firms on no list are never named (1.4).

## 13. REFERENCES

13.1. REFERENCES has seven tabs: DATA, DEFINITIONS, METHODS, INSIGHTS, TYPE AND SOFTWARE, LINKS and SUPERUSER.

13.2. DATA gives the sources in 2.2, the five lists' provenance, the GDP deflator (World Bank, NY.GDP.DEFL.ZS.AD, rebased to 2021) and the industry and ownership classifications. DEFINITIONS gives the terms in section 2. METHODS names the chapter (chapter 2 of the dissertation in 2.1) and the tables and figures behind the panels: Table B.1 (availability), Figures 2.2 and 2.3 (groups), Figure 2.5 and Tables B.4 and B.5 (adjusted odds ratios), Table B.7 (the lists), Figure 2.7 (the eligible map, the change layer's source) and Figure 2.8 (cohort inclusion). It also restates the models (9.2) and that they give associations, not effects.

13.3. TYPE AND SOFTWARE: IBM Plex Mono (SIL Open Font License 1.1), DejaVu Sans Mono for Armenian letters, data passes in R 4.5.2 and DuckDB 1.5.6, with Python 3 for the shared pairs, the insights and the definitions. The page draws with the browser's canvas and WebGL and loads no outside library.

13.4. INSIGHTS lists the sources of each region's and city window's profile sentence (6.4) by publisher, type and date: government press releases and notices, sanctions list entries, news reports and analyses.

13.5. LINKS gives the author's email address, website and X account, a share-on-X link, and a video: James K. Galbraith, "Sanctions: To Russia with Love", Institute for New Economic Thinking, 2024.

13.6. SUPERUSER holds a one-line quotation in Armenian attributed to Nzhdeh. In English it reads roughly "Some notice the sun only during an eclipse." The translation is this guide's, not the atlas's.

## 14. How to cite

The atlas gives no citation form. This guide suggests:

Kaprelian, Armen G. 2026. Visibility Atlas: where Russian firms file, and where their statements stop appearing. {atlas}

To contact the author, use the email address shown in the atlas's footer.
'''

if __name__ == '__main__':
    main()
