#!/usr/bin/env python3
"""The atlas's guide for a reader's AI agent (round 15, the author's item 19 as revised on 26 October 2026: TEACH YOUR AGENT).

Builds the Markdown guide from a fixed text and the figures of data/series.json, formatted as the page formats them (Motion.fmt), and writes it
into js/agent-guide.js as a static string, so the published page carries it and nothing is fetched when the button copies it. The text restates the
page's own reading texts and the chapter's sentences: no new claims, no semicolons, no "listed" for list membership, six numbered sections, under
about 1,200 words.

It is kept current without a hand in it (the author's revision of 26 October 2026): tools/publish-set.py rebuilds it at every publish from the
data the set ships, with this builder as of the commit the set comes from, adds the publish date, and refuses the set if the guide breaks a rule;
the audits flag a working copy that no longer matches the data. The rules include the public-release checks: no email address, no link but the
atlas's own, no file path, no run of nine or more digits, no working note.

Usage: agent_guide.py            writes js/agent-guide.js
       agent_guide.py --check    rebuilds the guide and compares it with js/agent-guide.js and the rules (exit 1 on a finding)
As a module: build(data_dir, published=None) returns the guide (dated when published is given), check(motion_dir) the findings.
"""
import argparse, json, math, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jsfmt import to_fixed, js_round, pct   # Motion.fmt's rules in one module (round 18)

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
def ci(lo, hi): return '95%% confidence interval %s to %s' % (dec(lo), dec(hi))

def build(data_dir, published=None):
    S = json.load(open(os.path.join(data_dir, 'series.json'), encoding='utf-8')); F = S['facts']; A = S['avail']
    e = dict(zip(A['year'], A['eligible_share']))
    sc = S['size_changes']; later = next(((sc['ratio'][i], sc['low'][i], sc['high'][i]) for i in range(len(sc['id'])) if sc['quintile'][i] == 'Q5' and sc['window'][i].startswith('2023')), None)
    size = 'The Q5 vs Q1 odds ratio rises in 2022 against 2021: the ratio of odds ratios is %s (%s).' % (dec(F['size_q5_2022_ratio']), ci(F['size_q5_2022_low'], F['size_q5_2022_high']))
    if later: size += ' The 2023–2024 increase, a ratio of odds ratios of %s (%s), is smaller when wholesale trade is excluded.' % (dec(later[0]), ci(later[1], later[2]))
    L = []
    add = L.append
    add('# Visibility Atlas: a guide for AI agents')
    add('')
    if published: add('Rebuilt from the atlas’s data when the atlas was published on %s.' % published); add('')   # the publish set's copy only
    add('You are helping a reader of the Visibility Atlas. This guide says what the atlas shows, how to read and drive it, what the chapter behind it finds and what it does not support. Cite its numbered sections.')
    add('')
    add('## 1. What the atlas is')
    add('')
    add('1.1. The Visibility Atlas maps Russian firms and shows where their financial statements stop appearing. It accompanies Armen G. Kaprelian’s PhD dissertation at Claremont Graduate University, Opacity and Adaptation under Sanctions: Geoeconomics in the Universe of Russian Firms.')
    add('1.2. The question. Sanctions can increase the value of withholding financial information. The chapter studies that mechanism through the availability of statements: whether a firm’s statement for a financial year is in the Russian Financial Statements Database (%s).' % F['release'])
    add('1.3. The five lists are the sanctions list, the decree list, the 2020 filing-exemption list (Government Decree No. 35 of 22 January 2020), the government strategic list and the presidential strategic list. They are fixed memberships, not dated designations.')
    add('1.4. Firms on the five lists (treated) are firms on at least one of the five lists. Firms on no list (comparison group) are firms on none of them. Firms of unknown membership stay outside the comparison group. "Treated" names the study’s group, not an effect.')
    add('1.5. The atlas’s claims are descriptive and conditional associations.')
    add('')
    add('## 2. How to read the views and layers')
    add('')
    add('2.1. The Cells view gives each layer per cell: 100 km cells across the country, 25 km cells closer in, 1 km squares of firms on no list, and 250 m cells in 22 city windows for 2021.')
    add('2.2. The Firms view draws every located eligible firm on no list (comparison group) with a house- or street-level geocode at its registered address, grouped by coordinate pair. Firms on the five lists (treated) are red marks from the year they were added to a list. Other geocodes, coordinates without a verified house or street match, are counted and not drawn.')
    add('2.3. The layers:')
    add('- Firm density, 2021: located eligible firms at registered addresses in 2021, per cell.')
    add('- Statement share by year: the share of located eligible firms with an original statement, per cell and financial year. The denominator is the cell’s located eligible firms in that year.')
    add('- Change, 2024 against 2021: the change in the located share with a statement, in 100 km cells with 50 or more located firms in both years, in six classes at ±2 and ±5 points. Each year counts the firms registered then, not the same firms.')
    add('- Cohort inclusion: the share of a cell’s located eligible firms in 2021 that belong to the revenue cohort by cash share, in five classes pooled over the supported cells.')
    add('- List members, 2021: members of the sanctions list per cell in 2021. The hover also gives the government strategic list.')
    add('- Median revenue change (descriptive): the percent change of each cell’s median real revenue among the revenue-by-cash cohort firms observed in 2024, against the cell’s 2021 median, in cells with 50 or more observed firms. The firms observed change from year to year.')
    add('- Leading industry by year: the division (two-digit OKVED 2 code, identical to NACE Rev. 2) with the largest share of nominal revenue among located eligible firms with a statement and a positive revenue value, per cell and year.')
    add('2.4. Years. The financial years run from 2014 to 2025. The FNS supplies the statements from 2019 and Rosstat before it. 2025* is the flagged latest-year extension, and 2012 and 2013 carry no coordinates.')
    add('2.5. Disclosure. In the Cells view a share needs 50 firms, list counts under 5 are not shown, and counts under 10 in the 250 m and 5 km cells are banded.')
    add('2.6. Each panel’s i button opens its reading text: what the panel shows, how to read it and its source.')
    add('')
    add('## 3. How to drive it')
    add('')
    add('3.1. View links. The address of a view ends in #mode_layer_year_lat_lon_SPANkm, for example #firms_industry_2024_55.76656_49.12078_44.6095km. The mode is cells or firms, the layer one of density, share, change, cohort, lists, fin and industry, the year 2014 to 2025, then the centre’s latitude and longitude in decimal degrees and the span in km across the map’s shorter side. The ending _fit in place of the coordinates fits the country.')
    add('3.2. City anchors. #Moscow opens the Moscow view and #Moscow-firms the same in the Firms view. Every city under GO TO works the same way, with hyphens for spaces (#St-Petersburg, #Nizhny-Novgorod). #Russia fits the country.')
    add('3.3. Keys, with the map focused: + and − zoom, 0 fits the country, the arrows pan, and holding B blinks the map between 2021 and the year shown. Shift+click zooms back out from the point. Escape puts an enlarged chart back.')
    add('3.4. FIND, under GO TO, searches the firms on the five lists by name, in Latin or Cyrillic letters, and flies to the one chosen. LINK TO CURRENT VIEW copies a link that opens the atlas on the same view.')
    add('')
    add('## 4. Key results')
    add('')
    add('4.1. Nationally, %s of eligible firms have a statement for 2021 and %s for 2024 (Table B.1).' % (pct(e[2021]), pct(e[2024])))
    add('4.2. Between 2021 and 2024 availability falls among state-related firms (%s to %s) and unitary enterprises (%s to %s) and rises among private firms and joint-stock companies. The declines are concentrated in 2024 (Figures 2.2 and 2.3).' % (pct(F['own']['state'][0]), pct(F['own']['state'][1]), pct(F['legal']['unitary'][0]), pct(F['legal']['unitary'][1])))
    add('4.3. Among continuing firms with a statement for the year before, larger asset quintiles have greater conditional availability in both provider eras (Tables B.4 and B.5). ' + size)
    add('4.4. Sanctioned-only firms, on the sanctions list and on no other list, have lower availability than firms on no list by 2024: an odds ratio of %s (%s) (Table B.7).' % (dec(F['sanctioned_only_or_2024']), ci(F['sanctioned_only_or_2024_low'], F['sanctioned_only_or_2024_high'])))
    add('4.5. The estimates come from binary logit models with industry, region, legal-form and ownership fixed effects and year effects. Standard errors are two-way clustered by industry and region.')
    add('')
    add('## 5. What not to infer')
    add('')
    add('5.1. No causal claims. The patterns are descriptive and conditional associations, and the recorded groups do not assign sanctions exposure exogenously.')
    add('5.2. Addresses are registered legal addresses, not operating sites. Revenue is counted where firms are registered, not where they operate.')
    add('5.3. A missing statement is absent from the RFSD release. Absence from the archive is not withdrawal or concealment, and the release does not recover the public archive as it stood in each year.')
    add('5.4. Firms on no list are never named. Do not try to identify them.')
    add('5.5. The annual shares compare each year’s population, not the same firms followed over time.')
    add('')
    add('## 6. How to cite')
    add('')
    add('Kaprelian, Armen G. 2026. Visibility Atlas: where Russian firms file, and where their statements stop appearing. %s' % ATLAS)
    add('')
    add('Contact the author through the email address shown in the atlas’s footer.')
    return '\n'.join(L) + '\n'

PUBLIC = [('email address', r'[\w.+-]+@[\w-]+\.\w'), ('link other than the atlas', r'https?://(?!%s(?:\s|$))\S+' % re.escape(ATLAS.split('://', 1)[1])),   # round 19: from ATLAS, so a move of the atlas is one edit
          ('file path', r'(?:~/|/home/|/tmp/|\b[A-Za-z]:\\)'), ('nine or more digits', r'\d{9,}'), ('working note', r'\b(?:TODO|FIXME|XXX)\b')]

def rules(text):
    out = [('public', '%s: %s' % (name, m.group(0)[:60])) for name, rx in PUBLIC for m in [re.search(rx, text)] if m]
    if ';' in text: out.append(('semicolon', text[max(0, text.index(';') - 40): text.index(';') + 10]))
    if re.search(r'\blisted\b|\blisting\b', text, re.I): out.append(('listed', re.search(r'.{0,40}\b(listed|listing)\b.{0,20}', text, re.I).group(0)))
    words = len(re.findall(r"[A-Za-z0-9’'.%–-]+", text))
    if words > 1200: out.append(('length', '%d words' % words))
    secs = re.findall(r'^## (\d+)\. ', text, re.M)
    if secs != [str(i) for i in range(1, 7)]: out.append(('sections', ','.join(secs)))
    return out

def js_of(text):
    return ('// The guide for a reader\'s AI agent (round 15, the author\'s item 19, TEACH YOUR AGENT), built by tools/agent_guide.py from data/series.json.\n'
            '// A static string: the footer\'s button copies it, nothing is fetched. Do not edit by hand: change tools/agent_guide.py and run it.\n'
            'window.AGENT_GUIDE = ' + json.dumps(text, ensure_ascii=False) + ';\n' +
            ('window.AGENT_GUIDE_URL = ' + json.dumps(GUIDE_URL) + ';   // round 17: the button copies this link, and the field shown when the clipboard is refused holds it; the text above stays, checked against the data\n' if GUIDE_URL else ''))

def check(motion_dir=MOTION):
    text = build(os.path.join(motion_dir, 'data')); out = rules(text)
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
    text = build(os.path.join(MOTION, 'data')); found = rules(text)
    for f in found: print('rule: ' + ' | '.join(f))
    open(os.path.join(MOTION, 'js', 'agent-guide.js'), 'w', encoding='utf-8').write(js_of(text))
    print('agent guide: %d words, written to js/agent-guide.js%s' % (len(re.findall(r"[A-Za-z0-9’'.%–-]+", text)), '' if not found else ' (with rule findings)'))

if __name__ == '__main__':
    main()
