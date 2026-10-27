#!/usr/bin/env python3
"""Audit of the Visibility atlas at several panel widths.

Loads explorer.html?__audit=1 in headless Brave at each width, switches every layer (and three years
of the share layer), redraws, and tests three things. (1) The recorded text boxes per canvas: overlap
(two visible strings of different groups on the same canvas whose boxes intersect by more than 15% of
the smaller), offcanvas (a box outside its canvas), small (under --min-size px). (2) The HTML overlays
on the map (the legend, the note, the zoom box, the scale bar): none may leave the map box or overlap
another, and a shown tooltip must stay inside the map (24 October 2026). (3) The camera after the click ladder, the zoom buttons
and the presets, through the page's instant API. Zero findings is the acceptance rule.

Usage: atlas-audit.py --url http://127.0.0.1:8765/explorer.html [--widths 400,768,1200,1600,2000] [--height 1000]"""
import re, argparse, base64, math, json, os, shutil, subprocess, sys, tempfile, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from capture import brave_flags, wait_port_file, page_ws_url, remove_profile
from cdp import CDP
import wire_check as WC   # the wire's re-derivation (round 10)
import grainguard as GG   # the surface grain's contrast guard (round 10)
import agent_guide as AG   # the guide that TEACH YOUR AGENT copies (round 15, item 19 as revised)
import profile_check as PC   # the profiles' re-derivation (round 15)

def bx(b):
    return json.dumps({k: round(b[k], 1) for k in ("x", "y", "x1", "y1")})

def inter(a, b):
    w = min(a["x1"], b["x1"]) - max(a["x"], b["x"]); h = min(a["y1"], b["y1"]) - max(a["y"], b["y"])
    return w * h if w > 0 and h > 0 else 0.0

def area(a): return max(0.0, a["x1"] - a["x"]) * max(0.0, a["y1"] - a["y"])

def audit_boxes(boxes, canvases, min_size, overlap):
    out = []
    vis = [b for b in boxes if b["eff"] >= 0.05 and b["str"].strip()]
    for b in vis:
        c = canvases.get(b["scene"])
        if c and b.get("kind") not in ("ghost", "cloud") and (b["x"] < -0.5 or b["y"] < -0.5 or b["x1"] > c["w"] + 0.5 or b["y1"] > c["h"] + 0.5):   # a ghost name may be clipped at the map's edge (round 12, part D)
            out.append(("offcanvas", b["scene"], b["str"]))
        if b["size"] < min_size:
            out.append(("small", b["scene"], "%s (%g px)" % (b["str"], b["size"])))
    for i in range(len(vis)):
        for j in range(i + 1, len(vis)):
            p, q = vis[i], vis[j]
            if p["scene"] != q["scene"] or (p["para"] is not None and p["para"] == q["para"]): continue
            if p.get("kind") == "cloud" or q.get("kind") == "cloud": continue   # the names on the ground (round 16, 8Gb; the kind is round 15's cloud pass): growing names lie over the data by design
            gp, gq = p.get("kind") == "ghost", q.get("kind") == "ghost"
            x = inter(p, q)
            if x <= 0: continue
            if gp and gq: out.append(("ghost-overlap", p["scene"], "%s | %s" % (p["str"], q["str"]))); continue   # two ghost names must never meet (the layout's own guarantee)
            if gp or gq: continue   # a ghost name lies under the data and the labels by design
            small = min(area(p), area(q))
            if small > 0 and x / small > overlap: out.append(("overlap", p["scene"], "%s | %s" % (p["str"], q["str"])))
    return out

CUR_W = None   # the width under audit, for the DOM rules that depend on it (round 11)
PANEL_H, PANEL_H_LISTED = 300, 560   # the Under the cursor panel's rows at most this tall (the industry layer's five swatch rows at 400 px) and with three listed firms named
CAPS_JS = "(() => { const want = [['header h1', 700, false], ['.byline .who', 500, true], ['.card h2', 500, true], ['#theme', 500, true], ['.yearrow .ui', 700, true], ['#yearlabel', 700, true], ['#modes .modelabel', 500, true], ['#modes .btn', 500, true], ['#layers .btn', 500, true], ['#presets .btn', 500, true], ['#legendtitle', 500, true], ['#legendbody .row:not(.p)', 500, true], ['#mixtitle', 500, true], ['#cellinfo > span', 500, true], ['.wi.tip', 500, true], ['.loc', 500, true]];\n  const bad = [];\n  for (const [sel, wt, tracked] of want) { const els = [...document.querySelectorAll(sel)]; if (!els.length) { bad.push(sel + ': no element'); continue; }\n    for (const el of els.slice(0, 3)) { const cs = getComputedStyle(el), fs = parseFloat(cs.fontSize), ls = cs.letterSpacing === 'normal' ? 0 : parseFloat(cs.letterSpacing);\n      if (cs.textTransform !== 'uppercase') bad.push(sel + ': transform ' + cs.textTransform); if (parseInt(cs.fontWeight) !== wt) bad.push(sel + ': weight ' + cs.fontWeight);\n      if (tracked ? Math.abs(ls - 0.08 * fs) > 0.06 : ls !== 0) bad.push(sel + ': spacing ' + cs.letterSpacing + ' at ' + fs + 'px'); if (!/IBM Plex Mono/.test(cs.fontFamily)) bad.push(sel + ': family ' + cs.fontFamily); } }\n  const u = [...document.querySelectorAll('.u')]; if (!u.length) bad.push('.u: no element'); for (const el of u.slice(0, 5)) if (getComputedStyle(el).textTransform !== 'none') bad.push('.u: transform ' + getComputedStyle(el).textTransform);\n  for (const [sel, txt] of [['#zoom-in', 'ZOOM IN (+)'], ['#zoom-out', 'ZOOM OUT (−)'], ['#zoom-fit', 'FIT THE WHOLE COUNTRY (0)']]) if (document.querySelector(sel).title !== txt) bad.push(sel + ': title ' + document.querySelector(sel).title); const by = getComputedStyle(document.documentElement).getPropertyValue('--by').replace(/[^A-Za-z. ]/g, '').trim(); if (by !== 'Armen G. Kaprelian') bad.push('--by: ' + by); const who = document.querySelector('.byline .who'); if (!who || who.textContent.trim() !== 'Armen G. Kaprelian · PhD Candidate, Claremont Graduate University') bad.push('byline: ' + (who && who.textContent));  if (!document.querySelector('meta[name=author]') || document.querySelector('meta[name=author]').content !== 'Armen G. Kaprelian') bad.push('meta author missing'); for (const [sel, min] of [['.card.act', 2.9], ['.card:not(.act)', 2.9], ['#theme', 2.9], ['#modes .btn', 2.9], ['#layers .btn', 2.9], ['#presets .btn', 2.9], ['#zoom-in', 2.9], ['#pulse', 2.9], ['#methodbtn', 2.9], ['.toggle', 2.9], ['#zoombox', 1.9], ['#legend', 1.9], ['#mapnote', 1.9], ['#mixbox', 1.9], ['#tip', 1.9]]) { const el = document.querySelector(sel); if (!el) continue; const cs = getComputedStyle(el); if (parseFloat(cs.borderTopWidth) < min || cs.borderTopLeftRadius !== '0px' || cs.boxShadow !== 'none') bad.push(sel + ': border ' + cs.borderTopWidth + ' radius ' + cs.borderTopLeftRadius + ' shadow ' + cs.boxShadow); } { const hd = document.querySelector('header'), hb = hd.getBoundingClientRect(), bb = document.querySelector('.byline').getBoundingClientRect(); if (innerWidth >= 1200 && hb.height > (innerWidth >= 1600 ? 48 : 92)) bad.push('header taller than its row (one row at 1,600 px and above, two at 1,200): ' + hb.height); if (bb.bottom > hb.bottom + 0.5 || hd.scrollHeight > hd.clientHeight + 1) bad.push('the byline spills out of the header: byline bottom ' + bb.bottom + ' header bottom ' + hb.bottom); const tb = document.querySelector('#theme').getBoundingClientRect(); if (innerWidth > 900 && (tb.left < bb.right + 8 || tb.right < hb.right - 0.5)) bad.push('the theme button is not at the right edge past the byline: button ' + tb.left + '-' + tb.right + ', byline right ' + bb.right + ', header right ' + hb.right); } const tg = document.querySelector('.tagline'); if (!tg || tg.textContent !== 'Where Russian firms file, and where their statements stop appearing.') bad.push('tagline: ' + (tg && tg.textContent)); const lic = document.querySelector('footer .lic'); if (!lic || !lic.textContent.startsWith(__LICENCE__)) bad.push('licence line: ' + (lic && lic.textContent)); { const tok = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim(); const col = el => getComputedStyle(el).borderTopColor; const rgb = h => 'rgb(' + [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)).join(', ') + ')'; const go = document.querySelector('.card.go'), act = document.querySelector('.card.act'), read = document.querySelector('.card:not(.act):not(.go)'); if (!go || col(go) !== rgb(tok('--go'))) bad.push('GO TO card border ' + (go && col(go)) + ' expected ' + tok('--go')); for (const b of document.querySelectorAll('#presets .btn:not(.russia)')) if (col(b) !== rgb(tok('--go'))) { bad.push('preset border ' + col(b) + ' expected ' + tok('--go')); break; } { const rb = document.querySelector('#presets .btn.russia'); if (!rb || col(rb) !== rgb(tok('--context'))) bad.push('RUSSIA border ' + (rb && col(rb)) + ' expected ' + tok('--context')); } if (!act || col(act) !== rgb(tok('--cursor'))) bad.push('LAYER card border ' + (act && col(act))); if (!read || col(read) !== rgb(tok('--context'))) bad.push('reading card border ' + (read && col(read))); const yu = document.querySelector('.yearrow .ui'), yl = document.querySelector('#yearlabel'), cu = getComputedStyle(yu), cl = getComputedStyle(yl); if (cu.fontSize !== '16px' || cl.fontSize !== '16px' || cu.fontWeight !== cl.fontWeight || Math.abs(yu.getBoundingClientRect().bottom - yl.getBoundingClientRect().bottom) > 0.5) bad.push('year row: ' + cu.fontSize + ' ' + cl.fontSize + ' ' + cu.fontWeight + '/' + cl.fontWeight + ' bottoms ' + yu.getBoundingClientRect().bottom + '/' + yl.getBoundingClientRect().bottom); for (const [sel, el] of [['#yearlabel', yl], ['.lockup .mk', document.querySelector('.lockup .mk')], ['#yearthumb', document.querySelector('#yearthumb')], ['#pulse svg', document.querySelector('#pulse svg')], ['.sw.dot', document.querySelector('.sw.dot')]]) if (!el) { if (sel !== '.sw.dot') bad.push(sel + ': missing'); } else { const cs = getComputedStyle(el); if ((cs.maskImage && cs.maskImage !== 'none') || (cs.webkitMaskImage && cs.webkitMaskImage !== 'none')) bad.push('striped symbol or value: ' + sel); } const st = document.querySelector('header h1 .striped'); if (!st || (getComputedStyle(st).maskImage === 'none' && getComputedStyle(st).webkitMaskImage === 'none')) bad.push('the title is not striped'); for (const sel of ['.card h2', '#legendtitle', '#mixtitle', '#notelabel', '.ctoggle']) { const el = document.querySelector(sel); if (el && getComputedStyle(el).color !== rgb(tok('--context'))) bad.push(sel + ': ' + getComputedStyle(el).color + ' expected the neon green'); } const csq = sel => getComputedStyle(document.querySelector(sel)); if (csq('#yearlabel').color !== rgb(tok('--context'))) bad.push('year value at rest ' + csq('#yearlabel').color + ' expected ' + tok('--context')); if (csq('#yearthumb').color !== rgb(tok('--context'))) bad.push('thumb at rest ' + csq('#yearthumb').color); if (csq('.yearrow .ui').color !== rgb(tok('--ink'))) bad.push('YEAR label ' + csq('.yearrow .ui').color); if (csq('#pulse').borderTopColor !== rgb(tok('--treated')) || csq('#pulse').color !== rgb(tok('--treated'))) bad.push('pulse button ' + csq('#pulse').borderTopColor + ' / ' + csq('#pulse').color + ' expected the listed red'); if (csq('#yearthumb path').strokeWidth !== '3px' || document.querySelector('#yearthumb').getAttribute('viewBox') !== '-2.4 -2.4 28.8 28.8') bad.push('thumb geometry ' + csq('#yearthumb path').strokeWidth + ' ' + document.querySelector('#yearthumb').getAttribute('viewBox')); }\n  return bad; })()"

# Round 17: expectations the shipped data set, read from it rather than written in (a new release, a re-run pass or a list update would otherwise break them):
# the release in the licence line and the located firms in the METHOD block (series.json facts), and the GO TO card's cities (basemap.json)
_DD = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")
SERIES_FACTS = json.load(open(os.path.join(_DD, "series.json"), encoding="utf-8"))["facts"]
N_CITIES = len(json.load(open(os.path.join(_DD, "basemap.json"), encoding="utf-8"))["cities"]["label"])
CAPS_JS = CAPS_JS.replace("__LICENCE__", json.dumps("Data: %s, CC BY 4.0" % SERIES_FACTS["release"]))

def audit_dom(dom, mode=None, layer=None):
    """The visible overlays must lie inside the map (0.5 px tolerance); the panels must never intersect one
    another. The tooltip follows the cursor and sits above the panels, so it is held inside the map but not
    counted against them. The pulse button (25 October 2026) is shown in the firms view and, since round 14, in the
    Cells view on the share and industry layers, inside the year row, clear of the slider and the year label, at least 24 px square."""
    out = []; m = dom["map"]
    hd = dom.get("header")   # the header's three groups (round 11, item 8): the title block, the centred lock-up and the theme button never touch, each inside the header; above 900 px the lock-up is centred on the header's width
    if hd:
        groups = [(n, hd[n]) for n in ("left", "lockup", "right") if hd.get(n) and hd[n]["visible"]]
        for i in range(len(groups)):
            for j in range(i + 1, len(groups)):
                if inter(groups[i][1], groups[j][1]) > 0: out.append(("header", "dom", "%s | %s overlap" % (groups[i][0], groups[j][0])))
        for n, b in groups:
            if b["x"] < hd["box"]["x"] - 0.5 or b["x1"] > hd["box"]["x1"] + 0.5 or b["y"] < hd["box"]["y"] - 0.5 or b["y1"] > hd["box"]["y1"] + 0.5: out.append(("header", "dom", "%s outside the header" % n))
        if CUR_W and CUR_W > 900 and hd.get("lockup") and hd["lockup"]["visible"]:
            lc = (hd["lockup"]["x"] + hd["lockup"]["x1"]) / 2; hc = (hd["box"]["x"] + hd["box"]["x1"]) / 2
            if abs(lc - hc) > 1.5: out.append(("header", "dom", "the lock-up is off the header's centre by %.1f px" % (lc - hc)))
    if dom.get("pulse") is not None and mode is not None:
        p = dom["pulse"]
        if p["visible"] != ((mode == "firms" or layer in ("share", "industry")) and bool(dom.get("yearrow") and dom["yearrow"]["visible"])): out.append(("pulse", "dom", "visible %s in the %s view on the %s layer" % (p["visible"], mode, layer)))
        if p["visible"]:
            yr = dom["yearrow"]
            if p["x"] < yr["x"] - 0.5 or p["y"] < yr["y"] - 0.5 or p["x1"] > yr["x1"] + 0.5 or p["y1"] > yr["y1"] + 0.5: out.append(("pulse", "dom", "outside the year row %s" % json.dumps({k: round(p[k], 1) for k in ("x", "y", "x1", "y1")})))
            for k in ("year", "yearlabel"):
                if inter(p, dom[k]) > 0: out.append(("pulse", "dom", "intersects the %s" % k))
            if p["x1"] - p["x"] < 24 or p["y1"] - p["y"] < 24: out.append(("pulse", "dom", "smaller than 24 px: %.1f by %.1f" % (p["x1"] - p["x"], p["y1"] - p["y"])))
    for cid, c in (dom.get("cards") or {}).items():   # the cards' collapse toggles (the author's addition of 25 October): inside the title row, at least 24 px, clear of the title; a collapsed card shows its title row only
        t, hd, ttl, bd, cd = c["toggle"], c["head"], c["title"], c["body"], c["card"]
        if not t["visible"]: out.append(("card", cid, "toggle not visible")); continue
        if t["x"] < hd["x"] - 0.5 or t["y"] < hd["y"] - 0.5 or t["x1"] > hd["x1"] + 0.5 or t["y1"] > hd["y1"] + 0.5: out.append(("card", cid, "toggle outside the title row %s" % json.dumps({k: round(t[k], 1) for k in ("x", "y", "x1", "y1")})))
        if t["x1"] - t["x"] < 24 or t["y1"] - t["y"] < 24: out.append(("card", cid, "toggle under 24 px: %.1f by %.1f" % (t["x1"] - t["x"], t["y1"] - t["y"])))
        if inter(t, ttl) > 0: out.append(("card", cid, "toggle meets the title"))
        i = c.get("info")
        if i is not None:   # the i just left of the toggle (round 15, the author's rule of 26 October 2026)
            if not i["visible"]: out.append(("card", cid, "i not visible"))
            else:
                if i["x"] < hd["x"] - 0.5 or i["y"] < hd["y"] - 0.5 or i["x1"] > hd["x1"] + 0.5 or i["y1"] > hd["y1"] + 0.5: out.append(("card", cid, "i outside the title row"))
                if i["x1"] > t["x"] + 0.5: out.append(("card", cid, "i not left of the toggle"))
                if inter(i, ttl) > 0: out.append(("card", cid, "i meets the title"))
                if i["x1"] - i["x"] < 24 or i["y1"] - i["y"] < 22: out.append(("card", cid, "i under 24 by 22 px: %.1f by %.1f" % (i["x1"] - i["x"], i["y1"] - i["y"])))
        if c["open"]:
            if not bd["visible"]: out.append(("card", cid, "open but the body is hidden"))
        else:
            if bd["visible"]: out.append(("card", cid, "collapsed but the body shows"))
            if cd["y1"] - cd["y"] > (hd["y1"] - hd["y"]) + 22 + 1: out.append(("card", cid, "collapsed card taller than its title row: %.1f against %.1f" % (cd["y1"] - cd["y"], hd["y1"] - hd["y"])))
    th = dom.get("thumb")   # the slider's mark (round 10, the author's correction of 25 October): 24 px square inside the year row at the thumb's place, clear of the labels and the pulse button, over a 24 px hit area
    if th is not None and dom.get("yearrow") and dom["yearrow"]["visible"]:
        yr, y = dom["yearrow"], dom["year"]
        if not th["visible"]: out.append(("thumb", "dom", "the slider's mark is not visible"))
        else:
            tw, tht = th["x1"] - th["x"], th["y1"] - th["y"]
            if tw < 23.5 or tht < 23.5: out.append(("thumb", "dom", "smaller than 24 px: %.1f by %.1f" % (tw, tht)))
            if th["x"] < yr["x"] - 0.5 or th["y"] < yr["y"] - 0.5 or th["x1"] > yr["x1"] + 0.5 or th["y1"] > yr["y1"] + 0.5: out.append(("thumb", "dom", "outside the year row %s" % json.dumps({k: round(th[k], 1) for k in ("x", "y", "x1", "y1")})))
            exp = y["x"] + dom.get("yearPct", 0) * ((y["x1"] - y["x"]) - 24)
            if abs(th["x"] - exp) > 1: out.append(("thumb", "dom", "the mark sits at x %.1f, the thumb at %.1f for the year value" % (th["x"], exp)))
            for k in ("yearlabel", "yearui", "pulse"):
                if dom.get(k) and dom[k]["visible"] and inter(th, dom[k]) > 0: out.append(("thumb", "dom", "intersects the %s" % k))
            hv = dom.get("thumbHit")   # the native thumb's rule size; the whole 24 px slider box takes the pointer too
            if hv is None or hv < 24 or y["y1"] - y["y"] < 24: out.append(("thumb", "dom", "hit area %s with a %.1f px slider, expected 24 px or more" % (hv, y["y1"] - y["y"])))
    if dom.get("note") and dom["note"]["visible"] and dom.get("notetoggle") and dom["notetoggle"]["visible"]:   # the note's toggle at the top right (round 15)
        nt, nb = dom["notetoggle"], dom["note"]
        if nb["x1"] - nt["x1"] > 14 or nt["y"] - nb["y"] > 10: out.append(("note", "dom", "the toggle is not at the top right: %s in %s" % (bx(nt), bx(nb))))
    if dom.get("popout") and dom["popout"]["visible"]:   # the pop-out (round 15, item 5.4, revised 26 October 2026): inside the map, at its lower right, above the scale bar and the zoom box
        po = dom["popout"]
        if po["x"] < m["x"] - 0.5 or po["y"] < m["y"] - 0.5 or po["x1"] > m["x1"] + 0.5 or po["y1"] > m["y1"] + 0.5: out.append(("popout", "dom", "outside the map %s" % bx(po)))
        if dom.get("strip") and dom["strip"]["visible"] and dom.get("stripOpen") and inter(po, dom["strip"]) > 0: out.append(("popout", "dom", "meets the open strip"))
        if abs((m["x1"] - po["x1"]) - 12) > 1.5: out.append(("popout", "dom", "not at the map's right edge less 12 px: %s" % bx(po)))
        for n in ("zoom", "scale"):
            if dom.get(n) and dom[n]["visible"] and inter(po, dom[n]) > 0: out.append(("popout", "dom", "covers the %s: %s against %s" % (n, bx(po), bx(dom[n]))))
    for o in dom.get("overflow") or []: out.append(("text-overflow", "dom", "%s %s runs %+d px past its box, %d px past its own" % (o["sel"], json.dumps(o["text"]), o["right"], o["over"])))   # tracked capitals (round 10)
    names = [n for n in ("legend", "note", "zoom", "scale", "tip", "strip", "mix") if dom.get(n) and dom[n]["visible"]]   # the pop-out is checked apart above: it lies over these while open
    if dom.get("mix") and dom["mix"]["visible"]:   # the revenue mix box (round 9): its toggle inside it
        t, b = dom["mixtoggle"], dom["mix"]
        if t["x"] < b["x"] - 0.5 or t["y"] < b["y"] - 0.5 or t["x1"] > b["x1"] + 0.5 or t["y1"] > b["y1"] + 0.5: out.append(("mix", "dom", "toggle outside the box"))
    panels = [n for n in names if n != "tip"]
    for n in names:
        b = dom[n]
        if b["x"] < m["x"] - 0.5 or b["y"] < m["y"] - 0.5 or b["x1"] > m["x1"] + 0.5 or b["y1"] > m["y1"] + 0.5:
            out.append(("offmap", "dom", "%s %s" % (n, json.dumps({k: round(b[k], 1) for k in ("x", "y", "x1", "y1")}))))
    for i in range(len(panels)):
        for j in range(i + 1, len(panels)):
            if inter(dom[panels[i]], dom[panels[j]]) > 0: out.append(("dom-overlap", "dom", "%s | %s" % (panels[i], panels[j])))
    # the cursor tile (round 9) never covers a panel, and the context strip holds its toggle and, when open, its glyph, lifts the
    # legend and the zoom box clear of itself, and as a collapsed stub meets neither the legend nor the zoom box
    if "tip" in names:
        for n in panels:
            if inter(dom["tip"], dom[n]) > 0 and not (n in ("legend", "note", "mix") and dom.get("tipRelaxed") and n in dom["tipRelaxed"]): out.append(("tile-overlap", "dom", "tip | %s  tip %s  %s %s  map %s" % (n, bx(dom["tip"]), n, bx(dom[n]), bx(dom["map"]))))
    if dom.get("strip") and dom["strip"]["visible"]:
        st, tg = dom["strip"], dom["striptoggle"]
        if tg["x"] < st["x"] - 0.5 or tg["y"] < st["y"] - 0.5 or tg["x1"] > st["x1"] + 0.5 or tg["y1"] > st["y1"] + 0.5: out.append(("strip", "dom", "the toggle lies outside the strip"))
        if dom.get("stripOpen"):
            g = dom["glyph"]
            if not g["visible"] or g["x"] < st["x"] - 0.5 or g["y"] < st["y"] - 0.5 or g["x1"] > st["x1"] + 0.5 or g["y1"] > st["y1"] + 0.5: out.append(("strip", "dom", "the glyph is hidden or outside the open strip"))
            for n in ("legend", "zoom"):
                if dom.get(n) and dom[n]["visible"] and dom[n]["y1"] > st["y"] - 8 + 0.5: out.append(("strip", "dom", "the %s is not lifted clear of the open strip" % n))
        else:
            if dom["glyph"]["visible"]: out.append(("strip", "dom", "the glyph shows while the strip is collapsed"))
    return out

def same_cam(c, ref, km=1e-6, rel=1e-9):
    return abs(c["cx"] - ref["cx"]) <= km and abs(c["cy"] - ref["cy"]) <= km and abs(c["k"] / ref["k"] - 1) <= rel

# The REFERENCES panel (round 16, the author's General 7): real presses over CDP on the button, the close toggle, a shortcut and the backdrop; Escape with a
# pop-out open (the panel goes, the pop-out stays); the page's own keys held while it is open; its box (the centred 80 percent of the map's area, the viewport
# less 16 px on a phone), the text inside its boxes, the capitals, the Armenian face, the links (YOUTUBE last), the SUPERUSER note equal to the page's source
# block, no request on open but the page's own font file, the contrast of its text over the brightest content behind the translucent ground; once per audit
# the header at 960 px, the light theme, the contrast and forced-colour settings and reduced motion.
def click(cdp, x, y):
    for t in ("mouseMoved", "mousePressed", "mouseReleased"): cdp.call("Input.dispatchMouseEvent", {"type": t, "x": x, "y": y, "button": "left" if t != "mouseMoved" else "none", "buttons": 1 if t == "mousePressed" else 0, "clickCount": 1})
def key(cdp, k, code, vk, text=None):
    p = {"key": k, "code": code, "windowsVirtualKeyCode": vk, "nativeVirtualKeyCode": vk}
    cdp.call("Input.dispatchKeyEvent", dict(p, type="keyDown", **({"text": text} if text else {}))); cdp.call("Input.dispatchKeyEvent", dict(p, type="keyUp"))
def centre(cdp, sel):
    r = cdp.evaluate("(() => { const el = document.querySelector(%s); if (!el) return null; el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()" % json.dumps(sel), await_promise=False)
    return r
REFS_OPEN_JS = r"""(() => { const d = document.getElementById('refs'), A = window.__atlas, R = A.refs(), cs = el => getComputedStyle(el), out = { R };
  out.over = []; for (const el of d.querySelectorAll('h3, li, .rnav .btn, .rhead b, .note')) { if (!el.getClientRects().length) continue; const host = el.closest('.rbody') || el.closest('.rnav') || el.closest('.rhead') || d, r = el.getBoundingClientRect(), br = host.getBoundingClientRect();
    if (el.scrollWidth > el.clientWidth + 1 || r.right > br.right + 0.5 || r.left < br.left - 0.5) out.over.push((el.textContent || '').trim().slice(0, 50)); }
  const st = el => { const c = cs(el); return { tt: c.textTransform, w: c.fontWeight, ls: c.letterSpacing === 'normal' ? 0 : parseFloat(c.letterSpacing), fs: parseFloat(c.fontSize), fam: c.fontFamily }; };
  out.navs = [...d.querySelectorAll('.rnav .btn')].map(b => Object.assign(st(b), { t: b.textContent })); out.h3 = [...d.querySelectorAll('h3')].map(st); out.title = st(document.getElementById('refstitle'));
  const ls = document.getElementById('refs-links'), la = ls ? [...ls.querySelectorAll('a')] : [], all = [...d.querySelectorAll('a')];
  out.lastLink = la.length ? la[la.length - 1].href : null; out.lastLabel = ls ? ls.querySelector('li:last-child b').textContent : null; out.badRel = all.filter(a => a.target !== '_blank' || !/noopener/.test(a.rel) || !/noreferrer/.test(a.rel)).map(a => a.href).slice(0, 3);
  out.bg = cs(d).backgroundColor; out.ink = cs(d.querySelector('li b') || d).color; out.muted = cs(d.querySelector('li') || d).color; out.link = all.length ? cs(all[0]).color : null;
  const ins = document.getElementById('refs-insights'); out.insights = ins ? ins.querySelectorAll('li').length : 0; out.defs = [...document.querySelectorAll('#refs-definitions li')].map(li => li.textContent); out.inner = [innerWidth, innerHeight]; out.cursorMark = !!d.querySelector('.rcursor');
  { const b = document.getElementById('refsbtn'); out.btn = [b.classList.contains('on'), b.getAttribute('aria-expanded'), getComputedStyle(b).backgroundColor]; }
  out.shut = d.classList.contains('shut'); out.opacity = cs(d).opacity; out.transition = cs(d).transitionDuration; out.glow = cs(d.querySelector('.rglow')).filter; out.mask = cs(d.querySelector('.rlines')).maskImage || cs(d.querySelector('.rlines')).webkitMaskImage;
  return out; })()"""
def rgb_of(c):
    m = re.match(r"color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)(?: / ([\d.]+))?\)", c or "")
    if m: return [float(m.group(i)) * 255 for i in (1, 2, 3)], float(m.group(4) or 1)
    m = re.match(r"rgba?\((\d+(?:\.\d+)?), (\d+(?:\.\d+)?), (\d+(?:\.\d+)?)(?:, ([\d.]+))?\)", c or "")
    if m: return [float(m.group(i)) for i in (1, 2, 3)], float(m.group(4) or 1)
    return None, None
# The REFERENCES panel's CORRECTIONS (round 17, the author's rule of 27 October 2026): an entry only where a published version showed something wrong that a reader
# could have seen or quoted (a figure, a map mark, a count, a source or a factual claim); wording changes, records-only fixes and fixes made before a publish get none.
# One entry per publish that corrects something (the author's decision of 27 October 2026), newest first: the publish date in bold in the page's long form, then one
# or two sentences naming what it corrected by kind and count, at most CORRECTION_MAX_CHARS characters in all, with no semicolon, em-dash or "listed"; the round's
# README record holds the detail. No two entries share a date. At most CORRECTIONS_MAX entries, and every correction stays on the page: a ninth fails here and the
# author decides how to condense, never a drop. The limits are rules, not content, so they stay beside the check; the patch that makes a qualifying fix adds it to
# the entry for the next publish, dated when that publish happens.
CORRECTIONS_MAX = 8
CORRECTION_MAX_CHARS = 300
CORRECTION_MAX_SENTENCES = 2
CORRECTIONS_JS = "[...document.querySelectorAll('#refs-corrections li')].map(li => ({ text: li.textContent, lead: li.firstChild && li.firstChild.nodeName === 'B' ? li.firstChild.textContent : null }))"
MONTHS = ("January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December")
def corrections_check(entries):
    import datetime
    bad, dates = [], []
    if len(entries) > CORRECTIONS_MAX: bad.append("%d entries, more than CORRECTIONS_MAX (%d): every correction stays, so the author decides how to condense" % (len(entries), CORRECTIONS_MAX))
    for i, e in enumerate(entries, 1):
        t, lead, d = e.get("text") or "", e.get("lead") or "", None
        m = re.fullmatch(r"([1-9]|[12]\d|3[01]) (%s) (\d{4})" % "|".join(MONTHS), lead)
        if m:
            try: d = datetime.date(int(m.group(3)), MONTHS.index(m.group(2)) + 1, int(m.group(1)))
            except ValueError: d = None
        if d is None or not t.startswith(lead + ": "): bad.append("entry %d does not open with its publish date in bold in the page's long form: %r" % (i, t[:40]))
        else: dates.append(d)
        if len(t) > CORRECTION_MAX_CHARS: bad.append("entry %d runs to %d characters, more than CORRECTION_MAX_CHARS (%d)" % (i, len(t), CORRECTION_MAX_CHARS))
        n = len(re.findall(r"[.!?](?=\s|$)", (t[len(lead) + 2:] if d is not None else t).strip()))
        if not 1 <= n <= CORRECTION_MAX_SENTENCES: bad.append("entry %d has %d sentence(s), expected 1 to CORRECTION_MAX_SENTENCES (%d)" % (i, n, CORRECTION_MAX_SENTENCES))
        for name, rx in (("a semicolon", r";"), ("an em-dash", "\u2014"), ('"listed"', r"\blisted\b")):
            if re.search(rx, t, re.I): bad.append("entry %d carries %s" % (i, name))
    if dates != sorted(dates, reverse=True): bad.append("the entries are not newest first: %s" % ", ".join(d.isoformat() for d in dates))
    if len(set(dates)) != len(dates): bad.append("two entries share a publish date: one entry per publish (%s)" % ", ".join(sorted({d.isoformat() for d in dates if dates.count(d) > 1})))
    return bad
def refs_block(cdp, w, a, once, page_src):
    out = []; F = lambda msg: out.append("%-11s width %d  %s" % ("refs", w, msg))
    src = re.search(r"<!-- SUPERUSER NOTE: start -->(.*?)<!-- SUPERUSER NOTE: end -->", page_src, re.S); want_note = src.group(1).strip("\n") if src else None
    cdp.evaluate("(async () => { const A = window.__atlas; A.refs(false); A.popout(null); A.mode('cells'); A.layer('industry'); A.year(2024); A.preset('Russia'); await A.ready(); return true; })()", await_promise=True, timeout=60); time.sleep(0.3)
    def behind(dark):   # the brightest (dark theme) or darkest (light theme) pixel behind the panel's box, the panel closed
        m = cdp.evaluate("(() => { const m = document.querySelector('.mapwrap').getBoundingClientRect(); return [m.left, m.top, m.width, m.height, innerWidth, innerHeight]; })()", await_promise=False)
        if w <= 900: x, y, bw, bh = 16, 16, m[4] - 32, m[5] - 32
        else: k = math.sqrt(0.8); bw, bh = m[2] * k, m[3] * k; x, y = m[0] + (m[2] - bw) / 2, m[1] + (m[3] - bh) / 2
        png = base64.b64decode(cdp.call("Page.captureScreenshot", {"format": "png", "clip": {"x": x, "y": y, "width": bw, "height": bh, "scale": 0.5}})["data"])
        W_, H_, bpp, rows = GG.png_rgb(png); best = None
        for r in rows:
            for i in range(0, W_ * bpp, bpp):
                px = (r[i], r[i + 1], r[i + 2]); L = GG.lum(px)
                if best is None or (L > best[0] if dark else L < best[0]): best = (L, px)
        return list(best[1])
    def contrast_ok(o, dark, tag):
        bg, alpha = rgb_of(o["bg"]); worst = behind(dark)
        if bg is None: F("%s: the panel's background %r unread" % (tag, o["bg"])); return
        comp = [alpha * bg[i] + (1 - alpha) * worst[i] for i in range(3)]
        for name in ("ink", "muted", "link"):
            c, _ = rgb_of(o[name]); cr = GG.contrast(c, comp) if c else 0
            if cr < 4.5: F("%s: %s text at contrast %.2f over the composite of the panel (alpha %.2f) and the %s pixel behind it %s" % (tag, name, cr, alpha, "brightest" if dark else "darkest", worst))
    # open with a press on the button, a pop-out open behind (desktop widths), the requests on open recorded
    if w > 900: cdp.evaluate("(() => { const A = window.__atlas; A.card('national', true); A.popout('national'); return true; })()", await_promise=False); time.sleep(0.3)
    worst_dark = None
    cdp.call("Network.enable"); cdp.events.append({"method": "__refs__"})
    b = centre(cdp, "#refsbtn"); click(cdp, *b); time.sleep(0.4)
    o = cdp.evaluate(REFS_OPEN_JS, await_promise=False); cdp.evaluate("1"); k0 = max(i for i, e in enumerate(cdp.events) if e.get("method") == "__refs__")
    sent = [e["params"]["request"]["url"] for e in cdp.events[k0:] if e.get("method") == "Network.requestWillBeSent"]; cdp.call("Network.disable")
    from urllib.parse import urljoin
    own = {urljoin(a.url.split("#")[0].split("?")[0], "fonts/" + f) for f in re.findall(r"url\('fonts/([^')]+)'\)", page_src)}   # round 17: the page's own font files at the address it was loaded from, so a copy served on another port or path is audited alike
    other = [u for u in sent if u.split("?")[0] not in own]
    if other: F("the open sent %d request(s) other than the page's own font file: %s" % (len(other), ", ".join(other)[:200]))
    R = o["R"]
    if not R["open"]: F("a press on the button did not open the panel"); return out
    if R["focus"] != "refstitle": F("focus on open is on #%s, expected the title" % R["focus"])
    if not (o["btn"][0] and o["btn"][1] == "true"): F("the REFERENCES button does not show its pressed state while the panel is open: %s" % o["btn"])
    if o["shut"] or abs(float(o["opacity"]) - 1) > 1e-3: F("the open animation did not finish: shut %s, opacity %s" % (o["shut"], o["opacity"]))
    x, y, bw, bh = R["rect"]
    if w <= 900: ex = [16, 16, o["inner"][0] - 32, o["inner"][1] - 32]
    else: m = R["map"]; k = math.sqrt(0.8); ex = [m[0] + m[2] * (1 - k) / 2, m[1] + m[3] * (1 - k) / 2, m[2] * k, m[3] * k]
    if any(abs(u - v) > 1.0 for u, v in zip([x, y, bw, bh], ex)): F("the panel's box %s, expected %s" % ([round(v, 1) for v in (x, y, bw, bh)], [round(v, 1) for v in ex]))
    DD = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data"); gloss = json.load(open(os.path.join(DD, "glossary.json"), encoding="utf-8"))["terms"] if os.path.exists(os.path.join(DD, "glossary.json")) else None
    want_secs = ["Data"] + (["Definitions"] if gloss else []) + ["Methods"] + (["Insights"] if os.path.exists(os.path.join(DD, "insights.json")) else []) + ["Type and software", "Corrections", "Links", "Superuser"]
    if gloss and o["defs"] != ["%s: %s" % (t["term"], t["text"]) for t in gloss]: F("the DEFINITIONS section differs from glossary.json: %s" % json.dumps(o["defs"][:2])[:200])
    if R["sections"] != want_secs: F("sections %s, expected %s" % (R["sections"], want_secs))
    if [n["t"] for n in o["navs"]] != want_secs: F("shortcuts %s" % [n["t"] for n in o["navs"]])
    if "Insights" in want_secs:   # every unit of insights.json, region or city window (103 since the author left Kalmykia out on 27 October 2026)
        ins = json.load(open(os.path.join(DD, "insights.json"), encoding="utf-8")); n_ins = len(ins["regions"]) + len(ins["cities"])
        if o["insights"] != n_ins: F("the insights section lists %d units, expected %d" % (o["insights"], n_ins))
    for f in corrections_check(cdp.evaluate(CORRECTIONS_JS, await_promise=False)): F("CORRECTIONS: " + f)   # round 17: every entry's form and the cap (corrections_check)
    if o["over"]: F("text past its box: %s" % "; ".join(o["over"][:4]))
    for nm, st, wt in [("the title", o["title"], 500)] + [("a section head", h, 700) for h in o["h3"][:3]] + [("a shortcut", n, 500) for n in o["navs"][:3]]:
        if st["tt"] != "uppercase" or int(st["w"]) != wt or abs(st["ls"] - 0.08 * st["fs"]) > 0.06 or "IBM Plex Mono" not in st["fam"]: F("%s set %s" % (nm, json.dumps(st)))
    if o["lastLink"] != "https://www.youtube.com/watch?v=dQw4w9WgXcQ" or o["lastLabel"] != "YOUTUBE": F("the links' last entry is %r %r" % (o["lastLabel"], o["lastLink"]))
    if o["badRel"]: F("links without target _blank and rel noopener noreferrer: %s" % o["badRel"])
    if not o["cursorMark"]: F("the block cursor after the last line is missing")
    if want_note is None or R["note"] != want_note: F("the SUPERUSER note %r against the source block %r" % (R["note"], want_note))
    doc = cdp.call("DOM.getDocument", {"depth": 1})["root"]["nodeId"]; nid = cdp.call("DOM.querySelector", {"nodeId": doc, "selector": "#superusernote"})["nodeId"]
    fams = {f["familyName"] for f in cdp.call("CSS.getPlatformFontsForNode", {"nodeId": nid})["fonts"]}; arm = "DejaVu Sans Mono"
    if arm not in fams or fams - {"IBM Plex Mono", arm}: F("the note rendered with %s, expected IBM Plex Mono and %s only" % (sorted(fams), arm))
    contrast_ok(o, True, "dark theme, Cells view")
    # the page's keys stand down while it is open: B (the blink), c-a-t (the cat key)
    k0 = cdp.evaluate("window.__atlas.extras().keyed", await_promise=False)
    key(cdp, "b", "KeyB", 66, "b"); time.sleep(0.25)
    for ch, vk in (("c", 67), ("a", 65), ("t", 84)): key(cdp, ch, "Key" + ch.upper(), vk, ch)
    time.sleep(0.4); ex_ = cdp.evaluate("window.__atlas.extras()", await_promise=False)
    if ex_["blink"] or ex_["keyed"] != k0: F("the page's keys acted with the panel open: %s" % json.dumps(ex_))
    # a shortcut scrolls its section to the top of the body (the one-body form)
    if True:
        for sec in ("refs-type", "refs-links"):   # a section scrolls to the body's top, or the body to its end where too little follows it
            c = centre(cdp, "#refsnav button[data-target='%s']" % sec); click(cdp, *c); time.sleep(0.2)
            sc = cdp.evaluate("(() => { const b = document.getElementById('refsbody'), s = document.getElementById(%s); return { top: s.getBoundingClientRect().top - b.getBoundingClientRect().top, end: b.scrollTop >= b.scrollHeight - b.clientHeight - 1 }; })()" % json.dumps(sec), await_promise=False)
            if not (-1 <= sc["top"] <= 6 or (sc["end"] and sc["top"] >= -1)): F("the %s shortcut left its section %.1f px from the body's top" % (sec, sc["top"]))
    # Escape closes the panel and returns focus; a pop-out open behind it stays
    key(cdp, "Escape", "Escape", 27); time.sleep(0.35)
    st = cdp.evaluate("(() => ({ open: document.getElementById('refs').open, focus: document.activeElement && document.activeElement.id, pop: window.__atlas.popout(), btn: [document.getElementById('refsbtn').classList.contains('on'), document.getElementById('refsbtn').getAttribute('aria-expanded')] }))()", await_promise=False)
    if st["open"] or st["focus"] != "refsbtn" or st["btn"][0] or st["btn"][1] != "false": F("after Escape: %s" % json.dumps(st))
    if w > 900 and st["pop"] != "national": F("Escape with the panel open closed the pop-out as well: %s" % json.dumps(st))
    cdp.evaluate("(() => { window.__atlas.popout(null); return true; })()", await_promise=False)
    # a press on the backdrop closes it and does not reach the map; the close toggle closes it
    cam0 = cdp.evaluate("window.__atlas.camera()", await_promise=False); click(cdp, *centre(cdp, "#refsbtn")); time.sleep(0.4)
    r = cdp.evaluate("window.__atlas.refs().rect", await_promise=False); px, py = (r[0] - 8, r[1] + r[3] / 2) if r[0] > 12 else (r[0] + r[2] / 2, r[1] + r[3] + 8)
    if r[0] <= 12 and r[1] + r[3] + 8 >= o["inner"][1]: px, py = (r[0] + r[2] / 2, 6)
    click(cdp, px, py); time.sleep(0.35)
    st = cdp.evaluate("(() => ({ open: document.getElementById('refs').open, focus: document.activeElement && document.activeElement.id, cam: window.__atlas.camera() }))()", await_promise=False)
    if st["open"] or st["focus"] != "refsbtn": F("after a press on the backdrop at (%.0f, %.0f): %s" % (px, py, json.dumps(st)))
    if not same_cam(st["cam"], cam0): F("the press on the backdrop reached the map: camera %s against %s" % (json.dumps(st["cam"]), json.dumps(cam0)))
    click(cdp, *centre(cdp, "#refsbtn")); time.sleep(0.4); click(cdp, *centre(cdp, "#refsclose")); time.sleep(0.35)
    st = cdp.evaluate("(() => ({ open: document.getElementById('refs').open, focus: document.activeElement && document.activeElement.id }))()", await_promise=False)
    if st["open"] or st["focus"] != "refsbtn": F("after a press on the close toggle: %s" % json.dumps(st))
    if not once: return out
    # once per audit: the busiest content behind (the Firms view at Moscow), the light theme, the contrast and forced-colour settings, reduced motion, the header at 960 px
    cdp.evaluate("(async () => { const A = window.__atlas; A.mode('firms'); A.preset('Moscow'); await A.ready(); return true; })()", await_promise=True, timeout=60); time.sleep(0.4)
    cdp.evaluate("window.__atlas.refs(true)", await_promise=False); time.sleep(0.4); o2 = cdp.evaluate(REFS_OPEN_JS, await_promise=False); cdp.evaluate("window.__atlas.refs(false)", await_promise=False); time.sleep(0.3)
    contrast_ok(o2, True, "dark theme, Firms view at Moscow")
    cdp.evaluate("(() => { document.getElementById('theme').click(); return true; })()", await_promise=False); time.sleep(0.4)
    cdp.evaluate("window.__atlas.refs(true)", await_promise=False); time.sleep(0.4); o3 = cdp.evaluate(REFS_OPEN_JS, await_promise=False); cdp.evaluate("window.__atlas.refs(false)", await_promise=False); time.sleep(0.3)
    if o3["glow"] != "none": F("the icon's glow on the light theme: %s" % o3["glow"])
    contrast_ok(o3, False, "light theme, Firms view at Moscow")
    cdp.evaluate("(async () => { document.getElementById('theme').click(); const A = window.__atlas; A.mode('cells'); A.preset('Russia'); await A.ready(); return true; })()", await_promise=True, timeout=60); time.sleep(0.3)
    for feat, val in (("prefers-contrast", "more"), ("forced-colors", "active")):
        cdp.call("Emulation.setEmulatedMedia", {"features": [{"name": feat, "value": val}]}); time.sleep(0.2)
        cdp.evaluate("window.__atlas.refs(true)", await_promise=False); time.sleep(0.4); o4 = cdp.evaluate(REFS_OPEN_JS, await_promise=False); cdp.evaluate("window.__atlas.refs(false)", await_promise=False); time.sleep(0.3)
        cdp.call("Emulation.setEmulatedMedia", {"features": [{"name": feat, "value": ""}]})
        if o4["glow"] != "none" or (o4["mask"] or "none") != "none": F("under %s: %s the icon keeps its glow %r or scanlines %r" % (feat, val, o4["glow"], o4["mask"]))
    cdp.call("Emulation.setEmulatedMedia", {"features": [{"name": "prefers-reduced-motion", "value": "reduce"}]}); time.sleep(0.2)
    click(cdp, *centre(cdp, "#refsbtn")); time.sleep(0.05); o5 = cdp.evaluate(REFS_OPEN_JS, await_promise=False)
    key(cdp, "Escape", "Escape", 27); time.sleep(0.05); gone = not cdp.evaluate("document.getElementById('refs').open", await_promise=False)
    cdp.call("Emulation.setEmulatedMedia", {"features": [{"name": "prefers-reduced-motion", "value": ""}]})
    if o5["shut"] or abs(float(o5["opacity"]) - 1) > 1e-3 or not gone: F("under reduced motion the panel animated: shut %s, opacity %s, closed at once %s" % (o5["shut"], o5["opacity"], gone))
    cdp.call("Emulation.setDeviceMetricsOverride", {"width": 960, "height": a.height, "deviceScaleFactor": 1, "mobile": False}); time.sleep(0.6)
    hd = cdp.evaluate("(() => { const r = id => { const b = document.getElementById(id).getBoundingClientRect(); return { x: b.left, y: b.top, x1: b.right, y1: b.bottom }; }, h = document.querySelector('header').getBoundingClientRect(); return { hleft: r('hleft'), lockup: r('lockup'), hright: r('hright'), refsbtn: r('refsbtn'), theme: r('theme'), header: { x: h.left, y: h.top, x1: h.right, y1: h.bottom }, sw: document.documentElement.scrollWidth, iw: innerWidth }; })()", await_promise=False)
    cdp.call("Emulation.setDeviceMetricsOverride", {"width": w, "height": a.height, "deviceScaleFactor": 1, "mobile": False}); time.sleep(0.6)
    cdp.evaluate("(async () => { await window.__atlas.ready(); return true; })()", await_promise=True, timeout=60)
    for p_, q_ in (("hleft", "hright"), ("hleft", "lockup"), ("lockup", "hright"), ("refsbtn", "theme")):
        if inter(hd[p_], hd[q_]) > 0: F("at 960 px the header's %s meets its %s: %s against %s" % (p_, q_, bx(hd[p_]), bx(hd[q_])))
    if hd["lockup"]["y"] < max(hd["hleft"]["y1"], hd["hright"]["y1"]) - 0.5: F("at 960 px the lock-up is not on its own row: %s" % bx(hd["lockup"]))
    if hd["theme"]["x1"] > hd["header"]["x1"] + 0.5 or hd["sw"] > hd["iw"]: F("at 960 px the header runs past the page: %s, scroll width %d" % (bx(hd["theme"]), hd["sw"]))
    return out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", required=True)
    ap.add_argument("--widths", default="400,768,1200,1600,2000")
    ap.add_argument("--height", type=int, default=1000)
    ap.add_argument("--min-size", type=float, default=11)
    ap.add_argument("--overlap", type=float, default=0.15)
    ap.add_argument("--out", default=None)
    ap.add_argument("--only", default=None, help="round 16: comma-separated substrings of state tags; only matching states run (a quick pass while building, never for a review or a publish)")
    ap.add_argument("--skip-once", action="store_true", help="leave out the checks that belong once to a whole audit (the agent guide's), for tools/audit_five.py, which runs them once itself")
    ap.add_argument("--refs-once", action="store_true", help="round 17: run the REFERENCES panel's once-per-audit checks (the light theme, the contrast and forced-colour settings, reduced motion, the header at 960 px) at this run's first width even with --skip-once; tools/audit_five.py sets it for 1,600 px, so the review and publish gates run them")
    a = ap.parse_args()
    url = a.url + ("&" if "?" in a.url else "?") + "__audit=1"
    findings = []; n_boxes = 0; n_states = 0; fields = set(); n_relaxed = 0; relaxed = []
    WIRE_DATA = WC.load(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data"))   # the wire's and the anniversaries' re-derivation (rounds 10 and 12)
    global CUR_W
    for w in [int(x) for x in a.widths.split(",")]:
        CUR_W = w
        profile = tempfile.mkdtemp(prefix="atlas-audit-")
        proc = subprocess.Popen(brave_flags(profile, w, a.height) + ["about:blank"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        try:
            port = wait_port_file(profile, proc); cdp = CDP(page_ws_url(port))
            cdp.call("Page.enable"); cdp.call("Runtime.enable"); cdp.call("DOM.enable"); cdp.call("CSS.enable")
            cdp.call("Emulation.setDeviceMetricsOverride", {"width": w, "height": a.height, "deviceScaleFactor": 1, "mobile": False})
            cdp.call("Page.navigate", {"url": url}); cdp.wait_event("Page.loadEventFired", timeout=60)
            cdp.evaluate("document.fonts.ready.then(() => true)", await_promise=True, timeout=60)
            time.sleep(0.5)
            # the console greeting (round 12, part D, item 4): the load logs exactly one message, the greeting with the mark, the title line, the build and the repository, and no error or warning
            msgs = [(e["params"]["type"], " ".join(str(x.get("value", x.get("description", ""))) for x in e["params"].get("args", []))) for e in cdp.events if e.get("method") == "Runtime.consoleAPICalled"]
            greet = [m for m in msgs if m[0] == "log" and "Visibility Atlas · Armen G. Kaprelian" in m[1] and "github.com/ArmenKaprelian/whostaysvisible" in m[1] and "Built from " in m[1] and "+--      --+" in m[1]]
            if len(msgs) != 1 or len(greet) != 1: findings.append("%-11s width %d  the load logged %d message(s), expected the greeting alone: %s" % ("console", w, len(msgs), json.dumps(msgs)[:300]))
            if cdp.problems: findings.append("%-11s width %d  errors or warnings on load: %s" % ("console", w, json.dumps(cdp.problems)[:300]))
            p_load = len(cdp.problems)   # round 17: what the page raises after its load (in handlers, timers and frames, through every state below) is reported at the width's end
            n_states += 1
            # the landing (round 10): before any call, the Cells view, the leading-industry layer, 2024, at the national zoom (the camera is compared with the Russia preset below)
            landing = cdp.evaluate("(() => { const A = window.__atlas; const mb = document.querySelector('#modes button[aria-pressed=\"true\"]'), lb = document.querySelector('#layers button[aria-pressed=\"true\"]'); return { mode: mb && mb.dataset.mode, layer: lb && lb.dataset.id, year: document.getElementById('year').value, label: document.getElementById('yearlabel').textContent, cam: A.camera(), theme: getComputedStyle(document.documentElement).getPropertyValue('--scheme').trim(), dataTheme: document.documentElement.getAttribute('data-theme'), button: document.getElementById('theme').textContent, yearrow: !document.getElementById('yearrow').hidden, mix: !document.getElementById('mixbox').hidden, prov: document.getElementById('layerprov').textContent.slice(0, 40) }; })()", await_promise=False)
            layers = cdp.evaluate("window.__atlas.layers", await_promise=False)
            L0 = cdp.evaluate("window.__atlas.layouts()", await_promise=False)   # the layouts of the normal load (round 11, item 7)
            if w == 1600:   # the surface grain's contrast guard (round 10, item 22): the ink, muted and dim figures on a grained patch of a card and of the legend within 0.05 of the plain surface's
                gf, gt = GG.guard(cdp)
                for g in gf: findings.append("%-11s width %d  %s: %s" % ("grain", w, g[1], g[2]))
                print("grain guard at 1,600 px: %d finding(s); " % len(gf) + "; ".join("%s %s %s -> %s" % (r[0], r[1], r[2], r[3]) for r in gt if r[1] != "average"))
            # the typeface (round 10): the headless browser must have resolved IBM Plex Mono for the title and a button, the only proof the installed face is in use
            doc = cdp.call("DOM.getDocument", {"depth": 1})["root"]["nodeId"]
            for sel in ("header h1", "#theme"):
                nid = cdp.call("DOM.querySelector", {"nodeId": doc, "selector": sel})["nodeId"]
                fams = [f["familyName"] for f in cdp.call("CSS.getPlatformFontsForNode", {"nodeId": nid})["fonts"]]
                if not any("IBM Plex Mono" in f for f in fams): findings.append("%-11s width %d  %s rendered with %s" % ("font", w, sel, fams))
            # the preset cameras at this width, the map's size and the fitted k, for the camera checks
            P = cdp.evaluate("(() => { const A = window.__atlas; A.mode('cells'); A.preset('Moscow'); const moscow = A.camera(); A.preset('Central Moscow (250 m)'); const cm = A.camera(); A.preset('Russia'); const russia = A.camera(); return { moscow, cm, russia, kfit: A.kFit(), W: window.__atlasCanvases.map.w, H: window.__atlasCanvases.map.h, m: A.cities.Moscow }; })()", await_promise=False)
            side = min(round(P["W"]), round(P["H"])); mx, my = P["m"]   # the page rounds the map's size to whole CSS px
            exp = {"mode": "cells", "layer": "industry", "year": "2024", "label": "2024", "theme": "dark", "dataTheme": None, "button": "Light theme", "yearrow": True, "mix": True}
            for k, v in exp.items():
                if landing.get(k) != v: findings.append("%-11s width %d  landing %s is %r, expected %r" % ("landing", w, k, landing.get(k), v))
            if not same_cam(landing["cam"], P["russia"]): findings.append("%-11s width %d  landing camera %s, expected the Russia preset %s" % ("landing", w, json.dumps(landing["cam"]), json.dumps(P["russia"])))
            if not landing["prov"].startswith("The division"): findings.append("%-11s width %d  landing provenance %r" % ("landing", w, landing["prov"]))
            n_states += 1
            def state(layer, year, setup, tag, check=None):
                if a.only and not any(t in tag for t in a.only.split(",")): return   # --only (round 16)
                nonlocal n_boxes, n_states, n_relaxed
                r = cdp.evaluate("(async () => { const A = window.__atlas, m = A.cities.Moscow; window.__extra = null; A.layer(%r); A.year(%d); await A.ready(); %s A.layer(%r); A.year(%d); await A.ready(); const r = A.redraw(); const mb = document.querySelector('#modes button[aria-pressed=\"true\"]'); return { boxes: r.boxes, dom: r.dom, cam: A.camera(), canvases: window.__atlasCanvases, field: A.field ? A.field() : null, pulsing: A.pulsing ? A.pulsing() : null, mode: mb ? mb.dataset.mode : 'cells', extra: window.__extra }; })()" % (layer, year, setup, layer, year), await_promise=True, timeout=180)
                n_boxes += len(r["boxes"]); n_states += 1
                if r["dom"].get("tipRelaxed"): n_relaxed += 1; relaxed.append("%d:%s:%s" % (w, tag, "+".join(r["dom"]["tipRelaxed"])))
                found = audit_boxes(r["boxes"], r["canvases"], a.min_size, a.overlap) + audit_dom(r["dom"], r.get("mode"), layer)
                if check: found += check(r)
                for kind, scene, key in found:
                    findings.append("%-11s width %d  %-7s %-5s %-8s %-10s %s" % (kind, w, layer, year, tag, scene, key))
                return r
            def cam_is(ref, label, km=1e-6, rel=1e-9):
                return lambda r: [] if same_cam(r["cam"], ref, km, rel) else [("camera", "cam", "%s: expected %s, got %s" % (label, json.dumps({k: round(ref[k], 4) for k in ref}), json.dumps({k: round(r["cam"][k], 4) for k in ("cx", "cy", "k")})))]
            def cam_k(kexp, label, cx=None, cy=None, km=0.8):
                def f(r):
                    c = r["cam"]; bad = []
                    if abs(c["k"] / kexp - 1) > 1e-6: bad.append(("camera", "cam", "%s: expected k %.4f, got %.4f" % (label, kexp, c["k"])))
                    if cx is not None and (abs(c["cx"] - cx) > km or abs(c["cy"] - cy) > km): bad.append(("camera", "cam", "%s: expected the centre within %g km of (%.2f, %.2f), got (%.2f, %.2f)" % (label, km, cx, cy, c["cx"], c["cy"])))
                    return bad
                return f
            for layer in layers:
                for year in ([2014, 2021, 2025] if layer in ("share", "industry") else [2021]):
                    state(layer, year, "A.mode('cells'); A.preset('Russia');", "-")
            # the context strip and the cursor tile (round 9): the strip open and closed, the fact's band at the country, inside a region
            # and at a city window, a forced tip, the tile at the map's corners and centre clear of the panels and of the hovered mark, a tap
            W, H = w, a.height
            def ctx_is(band, name_prefix, kind=None):
                return lambda r: [] if r["extra"] and r["extra"]["band"] == band and r["extra"]["name"].startswith(name_prefix) and r["extra"]["glyph"] and r["extra"]["glyphD"] and (kind is None or r["extra"]["kind"] == kind) and r["extra"]["open"] and not r["extra"]["clipped"] and r["extra"].get("locs", 0) >= 1 else [("context", "strip", json.dumps(r["extra"])[:220])]
            state("share", 2021, "A.strip(true); A.preset('Russia'); window.__extra = A.context();", "ctxnat", ctx_is("national", "Russia"))
            state("industry", 2021, "A.strip(true); A.preset('Russia'); window.__extra = A.context();", "ctxind", ctx_is("national", "Russia", "industry"))
            state("share", 2024, "A.strip(true); await A.jump({ cx: m[0] + 60, cy: m[1], k: 1.0 }); window.__extra = A.context();", "ctxreg", ctx_is("region", "Moscow Oblast"))
            state("share", 2021, "A.strip(true); A.preset('Moscow'); window.__extra = Object.assign(A.context(), { g2: A.glyph('Saint Petersburg') });", "ctxcity", lambda r: ctx_is("city", "Moscow")(r) + ([] if r["extra"] and r["extra"]["g2"] and r["extra"]["g2"] != r["extra"]["glyphD"] else [("context", "glyph", "the St Petersburg glyph is empty or equals Moscow's")]))
            state("share", 2021, "A.strip(true); A.preset('Russia'); A.tip('reset'); window.__extra = { shown: A.tip(true), c: A.context() }; A.tip(false);", "ctxtip", lambda r: [] if r["extra"] and r["extra"]["shown"] and r["extra"]["c"]["kind"] == "tip" and r["extra"]["c"]["text"] else [("context", "tip", json.dumps(r["extra"])[:200])])
            # interface labels in tracked capitals (round 10): the computed styles of every labelled element with a tip showing and a hover on, the zoom titles, every tip fitting the strip at this width
            state("industry", 2021, "A.mode('cells'); A.strip(true); A.preset('Moscow'); A.hoverKm(m[0], m[1], { show: true }); A.tip('reset'); A.tip(true); window.__extra = { caps: %s, tips: A.tips() }; A.tip(false);" % CAPS_JS, "caps",
                  lambda r: ([("caps", "dom", b) for b in (r["extra"] or {}).get("caps", ["no result"])] + [("tips", "strip", "clipped: %s" % json.dumps(t)) for t in (r["extra"] or {}).get("tips", []) if t["clipped"]] + ([] if r["extra"] and len(r["extra"]["tips"]) >= 9 else [("tips", "strip", "fewer tips measured than expected")])))
            # the ruler (round 12, part D, the author's request of 25 October 2026): at the three presets and the floor every major tick sits at the pad plus i times the step times
            # the zoom, the step a 1-2-5 value in km, the numbers on every every-th major with the right values, every label inside the box and clear of its neighbours
            RULER_STEPS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000]
            def ruler_ok(r):
                x = r["extra"]; bad = []
                if not x: return [("ruler", "dom", "no report")]
                for name, R in x.items():
                    if not R or "step" not in R: bad.append(("ruler", name, "no ruler state")); continue
                    if R["step"] not in RULER_STEPS: bad.append(("ruler", name, "step %s is not a 1-2-5 value" % R["step"]))
                    if R["n"] < 1 or R["every"] < 1: bad.append(("ruler", name, "n %s every %s" % (R["n"], R["every"])))
                    if R["step"] * R["k"] < 14 - 1e-6: bad.append(("ruler", name, "majors %.1f px apart, under 14" % (R["step"] * R["k"])))
                    if (R["n"] + 1) * R["step"] * R["k"] <= R["line"] + 1e-6: bad.append(("ruler", name, "a further major would fit: n %s, line %s px, step %.2f px" % (R["n"], R["line"], R["step"] * R["k"])))
                    if R["n"] * R["step"] * R["k"] > R["line"] + 1e-6: bad.append(("ruler", name, "the last major lies past the line's end"))
                    mult = 1000 if R["unit"] == "m" else 1
                    for t in R["ticks"]:
                        want = R["pad"] + t["i"] * R["step"] * R["k"]
                        if abs(t["x"] - want) > 0.3: bad.append(("ruler", name, "tick %d at %.2f, expected %.2f" % (t["i"], t["x"], want)))
                        if t["i"] % R["every"]: bad.append(("ruler", name, "tick %d numbered off the every-th rule" % t["i"]))
                        if t["label"] != str(round(R["step"] * t["i"] * mult)): bad.append(("ruler", name, "tick %d reads %r, expected %r" % (t["i"], t["label"], str(round(R["step"] * t["i"] * mult)))))
                    if [t["i"] for t in R["ticks"]] != list(range(0, R["n"] + 1, R["every"])): bad.append(("ruler", name, "numbered ticks %s" % [t["i"] for t in R["ticks"]]))
                    nums = [l for l in R["labels"] if not l["unit"]]; units = [l for l in R["labels"] if l["unit"]]
                    if len(units) != 1 or units[0]["text"] != R["unit"]: bad.append(("ruler", name, "unit label %s" % json.dumps(units)))
                    for l in R["labels"]:
                        if l["x"] < -0.5 or l["x1"] > R["box"]["w"] + 0.5 or l["y"] < -0.5 or l["y1"] > R["box"]["h"] + 0.5: bad.append(("ruler", name, "label %r outside the box: %s" % (l["text"], json.dumps({k: round(l[k], 1) for k in ("x", "x1", "y", "y1")}))))
                    nums.sort(key=lambda l: l["x"])
                    for a, b in zip(nums, nums[1:]):
                        if b["x"] < a["x1"] + 2: bad.append(("ruler", name, "labels %r and %r %.1f px apart" % (a["text"], b["text"], b["x"] - a["x1"])))
                    for u in units:
                        for l in nums:
                            if not (u["y1"] <= l["y"] + 0.5 or l["y1"] <= u["y"] + 0.5) and not (u["x1"] <= l["x"] or l["x1"] <= u["x"]): bad.append(("ruler", name, "the unit label meets %r" % l["text"]))
                return bad
            state("share", 2021, "A.mode('cells'); const out = {}; for (const p of ['Russia', 'Moscow', 'Central Moscow (250 m)']) { A.preset(p); await A.ready(); A.redraw(); out[p] = A.ruler(); } await A.zoom(-1); A.redraw(); out.floor = A.ruler(); A.preset('Russia'); window.__extra = out;", "ruler", ruler_ok)
            # the separators' clearances (the author's report of 25 October 2026): every mark on the track at least 0.6 em from the items beside it and covering none, the lead separator's margins the same, the window's edges faded
            def gap_ok(g):
                if not g: return [("wire", "gap", "no clearance report")]
                bad = []; em = g.get("em") or 14; floor = 0.6 * em
                if g["items"] and (g["min"] is None or g["min"] < floor - 0.5): bad.append(("wire", "gap", "a separator sits %.1f px from an item, under 0.6 em (%.1f px)" % (g["min"] if g["min"] is not None else -1, floor)))
                if g["covered"]: bad.append(("wire", "gap", "%d item boxes under a separator mark" % g["covered"]))
                if g["lsepLeft"] is not None and (g["lsepLeft"] < floor - 0.5 or g["lsepRight"] < floor - 0.5): bad.append(("wire", "gap", "the lead separator's margins are %.1f and %.1f px, under 0.6 em" % (g["lsepLeft"], g["lsepRight"])))
                if not g["fade"]: bad.append(("wire", "gap", "the window's edges carry no fade"))
                return bad
            # anniversaries (round 12, part D, item 6): the builder on four fixed days against the re-derivation (the anchor firm's day, the decree's day, a day with 167 listings, a day with none)
            ANNIV_DAYS = ["2026-05-19", "2026-01-22", "2026-02-24", "2026-01-01"]
            def anniv_ok(r):
                x = r["extra"]
                if not x: return [("anniversary", "strip", "no report")]
                bad = []
                for d, got in x["lines"]:
                    exp = WC.anniversary(WIRE_DATA, d)
                    if got != exp: bad.append(("anniversary", "strip", "%s: %r, expected %r" % (d, got, exp)))
                if sum(1 for d, got in x["lines"] if got) != 3: bad.append(("anniversary", "strip", "%d of the four days carry a line, expected three" % sum(1 for d, got in x["lines"] if got)))
                if not re.match(r"^\d{4}-\d{2}-\d{2}$", x["today"] or ""): bad.append(("anniversary", "strip", "the page's date is %r" % x["today"]))
                return bad
            state("share", 2021, "window.__extra = { lines: %s.map(d => [d, A.anniversary(d)]), today: A.today() };" % json.dumps(ANNIV_DAYS), "anniv", anniv_ok)
            if w < 600:
                def narrow_ok(r):
                    x = r["extra"]
                    if not x: return [("wire", "narrow", "no report")]
                    bad = gap_ok(x.get("gaps"))
                    if x["lead0"] != 0 or x["lead1"] != 0: bad.append(("wire", "narrow", "the lead slot shows on a phone-width map: %s, %s px" % (x["lead0"], x["lead1"])))
                    if x["r1"] != x["r0"] + 1 or x["sets"] != 1 or "Moscow Oblast" not in x["key"] or not x["ghost"]: bad.append(("wire", "narrow", "a context change did not rebuild under the crossfade: resets %s then %s, sets %s, key %s, ghost %s, context %s, timers %s, camera %s" % (x["r0"], x["r1"], x["sets"], x["key"][:40], x["ghost"], x.get("ctx"), json.dumps(x.get("timers")), json.dumps(x.get("cam")))))
                    if not (0 <= x["x"] < 80): bad.append(("wire", "narrow", "the new track did not start from the window's left edge: x %s" % x["x"]))
                    if not x["lead"].startswith("Moscow Oblast"): bad.append(("wire", "narrow", "the first item is not the new lead: %r" % x["lead"][:60]))
                    return bad
                state("share", 2024, "A.mode('cells'); A.strip(true); if (A.hoverOff) A.hoverOff(); A.preset('Russia'); A.year(+document.getElementById('year').value); await A.ready(); const wait = ms => new Promise(r => setTimeout(r, ms)); await wait(450); const w0 = A.wire(); await A.jump({ cx: m[0] + 60, cy: m[1], k: 1.0 }); await A.ready(); const w1 = A.wire(); const c1 = A.context(); window.__extra = { r0: w0.resets, r1: w1.resets, sets: w1.sets.length, key: w1.key, x: w1.x, lead0: w0.lead.width, lead1: w1.lead.width, lead: w1.items.length ? w1.items[0].text : '', ghost: document.querySelectorAll('.ctxt .track.old').length, ctx: c1.band + '|' + c1.name + '|' + c1.open, timers: w1.timers, cam: A.camera(), gaps: A.wireGaps() }; await wait(500);", "wirenarrow", narrow_ok)
            # the authorship mark (round 10, item 17): on the left bracket's arm the stage colour lifted 0.04 toward the ink, the plain stage 12 px to its left (a sea point at the Russia preset), and
            # under the data at the Moscow preset on the density layer the sample is a data colour; the twin's gzip comment reads through the page
            def mark_check(under):
                def f(r):
                    x = r["extra"]; h2 = lambda h: [int(h[i:i + 2], 16) for i in (1, 3, 5)]; st, ink = h2(x["stage"]), h2(x["ink"]); exp = [round(st[i] + 0.04 * (ink[i] - st[i])) for i in range(3)]
                    on, off = x["on"][:3], x["off"][:3]; near = lambda a, b, tol: all(abs(a[i] - b[i]) <= tol for i in range(3))
                    land = h2(x["land"]); lift = lambda g: [round(g[i] + 0.04 * (ink[i] - g[i])) for i in range(3)]   # a ground (the stage, the land or the pixel beside the arm) lifted 0.04 toward the ink
                    lifted = near(on, lift(st), 3) or near(on, lift(land), 3) or near(on, lift(off), 3)
                    if under: return [] if not lifted else [("mark", "pixel", "under the data the arm should read a data colour, not the lift: arm %s beside %s" % (on, off))]
                    return [] if lifted else [("mark", "pixel", "the mark's arm reads %s beside %s, expected the stage %s, the land %s or that ground lifted 0.04 toward the ink" % (on, off, lift(st), lift(land)))]
                return f
            state("lists", 2021, "A.mode('cells'); A.strip(true); A.preset('Russia'); if (A.hoverOff) A.hoverOff(); A.redraw(); window.__extra = A.markAt();", "mark", mark_check(False))
            state("density", 2021, "A.mode('cells'); A.preset('Central Moscow (250 m)'); A.redraw(); window.__extra = { cells: A.drawOrder(), firms: (A.mode('firms'), A.redraw(), A.drawOrder()) }; A.mode('cells');", "markunder",
                  lambda r: [] if r["extra"] and r["extra"]["cells"][:2] == ["basemap", "mark"] and len(r["extra"]["cells"]) >= 4 and r["extra"]["cells"][-1] == "ghost" and r["extra"]["firms"] == ["basemap", "mark", "firms", "ghost"] else [("mark", "order", "the mark must follow the basemap and precede every layer, the ghost names follow the layers (round 12, part D): %s" % json.dumps(r["extra"]))])
            def method_check(r):
                x = r["extra"]; bad = []
                if not x: return [("method", "dom", "no result")]
                if x["s0"]["open"]: bad.append(("method", "dom", "open before any click"))
                s1 = x["s1"]
                if not s1["open"] or s1["pressed"] != "true" or s1["more"] or s1["moreLabel"] != "More" or s1["height"] > 2.3 * s1["lineHeight"] or s1["height"] < 1.5 * s1["lineHeight"]: bad.append(("method", "dom", "opened: %s" % json.dumps(s1)[:200]))
                if not s1["intro"].startswith("{:,} located eligible firms".format(SERIES_FACTS["located_2021"])): bad.append(("method", "dom", "intro: %r" % s1["intro"]))
                s2 = x["s2"]
                if not s2["more"] or s2["moreLabel"] != "Less" or s2["height"] < 6 * s2["lineHeight"] or not s2["read"].startswith("Descriptive associations") or not s2["prov"]: bad.append(("method", "dom", "expanded: %s" % json.dumps(s2)[:200]))
                if x["s3"]["open"] or x["s3"]["pressed"] != "false": bad.append(("method", "dom", "closed again: %s" % json.dumps(x["s3"])[:120]))
                return bad
            state("share", 2021, "A.preset('Russia'); window.__extra = { s0: A.methodState(), s1: A.method(true), s2: A.methodMore(true), s3: (A.methodMore(false), A.method(false)) };", "method", method_check)
            # the Cells view's squares (round 14, the author's decisions of 25 October 2026): the 1 km squares from the address files at full strength from k 2.5 on the share,
            # industry and density layers (density in 2021), summing the year's firms on no list; the 2021 250 m windows over them from k 40 (the share layer in 2021 and the density
            # layer only); none at the country view; the legend names the grid; the 25 km cells take over from 100 km between 1.5 and 2.7 times the fitted zoom
            def sq_ok(micro, fine, word, hover_micro=None):
                def chk(r):
                    x = r["extra"]; bad = []
                    if not x: return [("squares", "state", "no report")]
                    M = x["M"]; d = M["drawn"]
                    if abs((d.get("micro") or 0) - micro) > 0.02 or abs((d.get("fine") or 0) - fine) > 0.02: bad.append(("squares", "weight", "1 km at %s and 250 m at %s, expected %s and %s at k %.3f" % (d.get("micro"), d.get("fine"), micro, fine, r["cam"]["k"])))
                    if micro > 0:
                        if not M["level"] or M["level"]["sumN"] != x["firms"]: bad.append(("squares", "sum", "the %s squares hold %s firms, the year's file %s" % (M["year"], M["level"] and M["level"]["sumN"], x["firms"])))
                        if "squares" not in M["log"]: bad.append(("squares", "drawn", "no squares in the draw: %s" % json.dumps(M["log"])))
                    if fine > 0 and "fine" not in M["log"]: bad.append(("squares", "drawn", "no 250 m cells in the draw: %s" % json.dumps(M["log"])))
                    if word not in x["legend"]: bad.append(("squares", "legend", "the legend's title lacks %r: %s" % (word, x["legend"][:120])))
                    if hover_micro is not None and bool(x["hover"] and x["hover"].get("micro")) != hover_micro: bad.append(("squares", "hover", "the hover reads %s, expected a square %s" % (json.dumps(x["hover"])[:160], hover_micro)))
                    if micro > 0 and (x["cost"]["mean"] > 10 or x["cost"]["max"] > 16): bad.append(("squares", "cost", "frame cost %.1f ms mean, %.1f max" % (x["cost"]["mean"], x["cost"]["max"])))
                    return bad
                return chk
            SQJS = "await A.ready(); A.redraw(); const M = A.mosaic(); const h = A.hoverKm(m[0] + 1.3, m[1] + 0.6, { show: true }); const legend = document.getElementById('legendtitle').innerText; const cost = A.frameCost(20); window.__extra = { M, legend, hover: h, cost, firms: MOTION_DATA.firms.by_year[M.year].firms }; if (A.hoverOff) A.hoverOff();"
            state("share", 2024, "A.mode('cells'); A.preset('Russia'); " + SQJS, "sqnat", sq_ok(0, 0, "(100 km)", False))
            state("share", 2024, "A.mode('cells'); A.preset('Moscow'); " + SQJS, "sqshare", sq_ok(1, 0, "(1 km)", True))
            state("industry", 2024, "A.mode('cells'); A.preset('Moscow'); " + SQJS, "sqind", sq_ok(1, 0, "(1 km)", True))
            state("density", 2021, "A.mode('cells'); A.preset('Moscow'); " + SQJS, "sqdens", sq_ok(1, 0, "(1 km)", True))
            state("share", 2021, "A.mode('cells'); A.preset('Central Moscow (250 m)'); " + SQJS, "sqfine", sq_ok(1, 1 if side / 20 >= 40 else min(1, max(0, (side / 20 - 24) / 16)), "(250 m)" if side / 20 >= 32 else "(1 km)"))
            state("share", 2024, "A.mode('cells'); A.preset('Central Moscow (250 m)'); " + SQJS, "sqfine24", sq_ok(1, 0, "(1 km)", True))
            for f_, word in ((1.4, "(100 km)"), (2.8, "(25 km)")):
                state("share", 2024, "A.mode('cells'); await A.jump({ cx: m[0] + 300, cy: m[1] - 200, k: A.kFit() * %r }); await A.ready(); A.redraw(); window.__extra = { legend: document.getElementById('legendtitle').innerText };" % f_, "band%s" % f_,
                      lambda r, word=word: [] if r["extra"] and word in r["extra"]["legend"] else [("squares", "band", "at %.2f times the fit the legend reads %s, expected %r" % (r["cam"]["k"] / P["kfit"], json.dumps(r["extra"])[:120], word))])
            # the tile's red count (round 14): the firms on these lists present in the layer's own year at coordinates inside the hovered cell, against an independent count over the
            # listed file, at every grid (100 km, 25 km, 1 km, 250 m, the 5 km density cells) and at an empty cell; the count bold red 19 px with the legend's dot at the first line's end
            def count_ok(r):
                x = r["extra"]
                if not x or not x.get("tc"): return [("count", "tile", "no count in the tile: %s" % json.dumps(x)[:200])]
                bad = []; tc = x["tc"]
                if tc["text"].replace(",", "") != str(x["n"]): bad.append(("count", "value", "the tile shows %s, the independent count is %s (grid %s, year %s)" % (tc["text"], x["n"], x["grid"], tc["year"])))
                if tc["year"] != x["yl"]: bad.append(("count", "year", "the count reads %s, the layer's own year is %s" % (tc["year"], x["yl"])))
                if not tc["dot"] or not tc["first"]: bad.append(("count", "place", "dot %s, on the first line %s" % (tc["dot"], tc["first"])))
                if abs(tc["size"] - 19) > 0.01 or str(tc["weight"]) != "700" or tc["colour"] != x["red"]: bad.append(("count", "style", "%s px, weight %s, colour %s (expected 19, 700, %s)" % (tc["size"], tc["weight"], tc["colour"], x["red"])))
                return bad
            CNT = "const T = MOTION_DATA.treatednational, yl = %d, X = %s, Y = %s; const h = A.hoverKm(X, Y, { show: true }); const g = h.grid, o = h.origin || [0, 0], x0 = o[0] + Math.floor((X - o[0]) / g) * g, y0 = o[1] + Math.floor((Y - o[1]) / g) * g; let n = 0; for (let i = 0; i < T.n; i++) { if (T.filed[i][yl - 2014] === '-') continue; if (T.x[i] >= x0 && T.x[i] < x0 + g && T.y[i] >= y0 && T.y[i] < y0 + g) n++; } const tk = getComputedStyle(document.documentElement).getPropertyValue('--treated').trim(); window.__extra = { n, yl, grid: g, tc: A.tileCount(), red: 'rgb(' + [1, 3, 5].map(i => parseInt(tk.slice(i, i + 2), 16)).join(', ') + ')' }; A.hoverOff();"
            for lyr, yr, setup, X, Y, yl, tg in [("share", 2024, "A.preset('Russia');", "m[0] + 10", "m[1] + 10", 2024, "cnt100"), ("share", 2021, "A.preset('Russia');", "m[0]", "m[1]", 2021, "cnt100b"),
                                                 ("share", 2024, "await A.jump({ cx: m[0], cy: m[1], k: A.kFit() * 3 });", "m[0] + 5", "m[1] - 7", 2024, "cnt25"), ("share", 2024, "A.preset('Moscow');", "m[0] + 1.3", "m[1] + 0.6", 2024, "cnt1"),
                                                 ("industry", 2022, "A.preset('Moscow');", "m[0] - 2.2", "m[1] + 1.1", 2022, "cnt1i"), ("share", 2021, "A.preset('Central Moscow (250 m)');", "m[0] + 0.1", "m[1] + 0.1", 2021, "cnt250"),
                                                 ("density", 2021, "A.preset('Russia');", "m[0]", "m[1]", 2021, "cnt5"), ("change", 2021, "A.preset('Russia');", "m[0]", "m[1]", 2024, "cntchg"), ("cohort", 2021, "A.preset('Russia');", "m[0]", "m[1]", 2021, "cntcoh"),
                                                 ("fin", 2021, "A.preset('Russia');", "m[0] + 300", "m[1]", 2024, "cntfin"), ("share", 2024, "A.preset('Russia');", "A.cities.Murmansk[0]", "A.cities.Murmansk[1] + 400", 2024, "cnt0")]:
                state(lyr, yr, "A.mode('cells'); " + setup + " await A.ready(); A.redraw(); " + CNT % (yl, X, Y), tg, count_ok)
            # the count's contrast on both themes' tiles (19 px bold is large text: at least 3 to 1 against the panel), and the tile's body in the GO TO card's ice with the footer in the reading green
            def lum(h):
                c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]; c = [v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4 for v in c]
                return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
            def contrast(a, b): la, lb = lum(a), lum(b); return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)
            def ice_ok(r):
                x = r["extra"]; bad = []
                if not x: return [("tile", "colour", "no report")]
                for th in x["themes"]:
                    if th["body"] != th.get("tile", th["go"]): bad.append(("tile", "colour", "%s theme: the tile's text is %s, expected its own ice %s" % (th["scheme"], th["body"], th.get("tile", th["go"]))))   # round 15 (item 6): the tile has its own token, --tile-ink
                    if th["foot"] not in (th["ctx"], th["ctxLive"]): bad.append(("tile", "colour", "%s theme: the footer is %s, expected the reading green" % (th["scheme"], th["foot"])))
                    cr = contrast(th["treated"], th["panel"])
                    if cr < 3.0: bad.append(("count", "contrast", "%s theme: the red count measures %.2f to 1 on the tile, under 3" % (th["scheme"], cr)))
                    if not th["tc"]: bad.append(("count", "tile", "%s theme: no count" % th["scheme"]))
                return bad
            ICE = "const css = () => getComputedStyle(document.documentElement), tok = n => css().getPropertyValue(n).trim(), rgb = h => 'rgb(' + [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)).join(', ') + ')'; const read = () => ({ scheme: tok('--scheme'), body: getComputedStyle(document.getElementById('tipbody')).color, foot: getComputedStyle(document.getElementById('tipfoot')).color, go: rgb(tok('--go')), tile: rgb(tok('--tile-ink')), ctx: rgb(tok('--context')), ctxLive: rgb(tok('--context-live')), treated: tok('--treated'), panel: tok('--panel'), tc: A.tileCount() }); const themes = []; A.preset('Moscow'); await A.ready(); A.hoverKm(m[0] + 1.3, m[1] + 0.6, { show: true }); themes.push(read()); document.getElementById('theme').click(); A.hoverKm(m[0] + 1.3, m[1] + 0.6, { show: true }); themes.push(read()); document.getElementById('theme').click(); window.__extra = { themes }; A.hoverOff();"
            state("share", 2024, "A.mode('cells'); " + ICE, "tileice", ice_ok)
            # the Cells view's pulse (round 14): at the country in 2022 every 100 km cell holding a firm listed that year pulses once, its rings at the cell's centre, staggered west to east
            # over the cells in view; at Moscow on the industry layer the 1 km squares do; under reduced motion the still highlight
            N22C = "(() => { const T = MOTION_DATA.treatednational; let n = 0; for (let i = 0; i < T.n; i++) if (T.red_from[i] === %d && !T.undated[i] && T.filed[i][%d] !== '-') n++; return n; })()"
            def cpulse_ok(g):
                def chk(r):
                    x = r["extra"]; bad = []
                    if not x or not x["s"]: return [("cpulse", "state", "no pulse: %s" % json.dumps(x)[:200])]
                    cells = x["s"]["cells"]
                    if x["n"] != len(cells) or not (0 < len(cells) <= x["firms"]): bad.append(("cpulse", "count", "%s cells pulsed (returned %s) for %s firms listed in the year" % (len(cells), x["n"], x["firms"])))
                    for cx, cy, dl in cells:
                        if abs(((cx / g) % 1) - 0.5) > 1e-6 or abs(((cy / g) % 1) - 0.5) > 1e-6: bad.append(("cpulse", "centre", "a ring at (%.3f, %.3f), not a %s km cell's centre" % (cx, cy, g))); break
                    spread = x["rule"]["spreadMs"]
                    if any(dl < -1e-6 or dl > spread + 1e-6 for _, _, dl in cells): bad.append(("cpulse", "stagger", "a delay outside 0 to %s ms" % spread))
                    vis = sorted(cells, key=lambda c: c[0])   # the delays grow with x over every cell (clamped outside the view), so the order holds for all
                    if any(b[2] < a[2] - 1e-6 for a, b in zip(vis, vis[1:]) if a[0] < b[0]): bad.append(("cpulse", "stagger", "the delays do not grow from west to east"))
                    if x["s"]["static"]: bad.append(("cpulse", "motion", "a still pulse with motion allowed"))
                    if not x["visible"]: bad.append(("cpulse", "button", "the pulse button is hidden in the Cells view on this layer"))
                    return bad
                return chk
            CP = "await A.ready(); A.redraw(); const n = A.cellPulseAt(600), s = A.cellPulseState(); window.__extra = { n, s, firms: %s, rule: A.listedRule(), visible: !document.getElementById('pulse').hidden }; A.cellPulseAt(null);"
            state("share", 2022, "A.mode('cells'); A.preset('Russia'); " + CP % (N22C % (2022, 8)), "cpulse", cpulse_ok(100))
            state("industry", 2022, "A.mode('cells'); A.preset('Moscow'); " + CP % (N22C % (2022, 8)), "cpulse1", cpulse_ok(1))
            state("density", 2021, "A.mode('cells'); A.preset('Russia'); await A.ready(); window.__extra = { n: A.pulse(), hidden: document.getElementById('pulse').hidden };", "cpulseoff", lambda r: [] if r["extra"] and r["extra"]["n"] == 0 and r["extra"]["hidden"] else [("cpulse", "button", "on the density layer: %s" % json.dumps(r["extra"]))])
            # the legend's two sides (round 14): the key side by default with the "i" shown, the reading side at the key side's width, back again; then the reading side left on for the DOM rules
            def sides_ok(r):
                x = r["extra"]; bad = []
                if not x: return [("legend", "sides", "no report")]
                k0, r1, k2 = x["k0"], x["r1"], x["k2"]
                if k0["reading"] or not k0["info"] or k0["pressed"] != "false": bad.append(("legend", "sides", "the default side: %s" % json.dumps(k0)[:160]))
                if not r1["reading"] or r1["pressed"] != "true" or abs(r1["w"] - k0["w"]) > 0.5 or "red number" not in r1["text"] or "< 55%" in r1["text"]: bad.append(("legend", "sides", "the reading side: width %.1f against %.1f, %s" % (r1["w"], k0["w"], json.dumps(r1)[:200])))
                if k2["reading"] or abs(k2["w"] - k0["w"]) > 0.5 or abs(k2["h"] - k0["h"]) > 0.5: bad.append(("legend", "sides", "back to the key: %s against %s" % (json.dumps(k2)[:120], json.dumps(k0)[:120])))
                if "red number" in k0["text"]: bad.append(("legend", "sides", "the key side shows the reading text"))
                return bad
            LS = "const L = () => { const el = document.getElementById('legend'), b = el.getBoundingClientRect(), i = document.getElementById('legendinfo'); return { w: b.width, h: b.height, reading: el.classList.contains('reading'), info: !i.hidden, pressed: i.getAttribute('aria-pressed'), text: document.getElementById('legendbody').innerText }; }; A.legendSide(false); A.legend(true); A.redraw(); const k0 = L(); document.getElementById('legendinfo').click(); const r1 = L(); document.getElementById('legendinfo').click(); const k2 = L(); window.__extra = { k0, r1, k2 };"
            state("share", 2024, "A.mode('cells'); A.preset('Moscow'); await A.ready(); " + LS, "lsides", sides_ok)
            state("fin", 2025, "A.mode('firms'); A.preset('Russia'); await A.ready(); " + LS, "lsidesf", lambda r: [] if r["extra"] and r["extra"]["r1"]["reading"] and abs(r["extra"]["r1"]["w"] - r["extra"]["k0"]["w"]) <= 0.5 and "Each pixel" in r["extra"]["r1"]["text"] else [("legend", "sides", json.dumps(r["extra"])[:240])])
            state("industry", 2024, "A.mode('cells'); A.preset('Moscow'); await A.ready(); A.legend(true); A.legendSide(true);", "lread")
            state("industry", 2024, "A.mode('firms'); A.preset('Moscow'); await A.ready(); A.legend(true); A.legendSide(true);", "lreadf")
            state("share", 2024, "A.legendSide(false); A.legend(null); A.mode('cells'); A.preset('Russia');", "lkey")
            # the data wire (round 10, W14 and E15): every item of the 50-item cycle re-derived from the data files by wire_check.py for 2021 and 2024 at the Russia preset and
            # inside Moscow Oblast; tips at every fifth slot and drawn from the page's TIPS; one cat item at the keyed slot, never beside a named firm; the lead carries a place name
            if w >= 768:
                def wire_check(y, band, name):
                    def chk(r):
                        x = r["extra"]
                        if not x: return [("wire", "items", "no report")]
                        exp = WC.cycle(WIRE_DATA, y, band, name, x["cycle"], today=x.get("today")); bad = gap_ok(x.get("gaps")); tipset = set(x["tips"])
                        if len(x["items"]) != 50: bad.append(("wire", "items", "%d items, expected 50" % len(x["items"])))
                        for i, (a, e) in enumerate(zip(x["items"], exp)):
                            if a["kind"] != e["kind"]: bad.append(("wire", "items", "%d: kind %s, expected %s (%s)" % (i, a["kind"], e["kind"], a["text"][:60])))
                            elif e["kind"] == "tip":
                                if a["text"] not in tipset: bad.append(("wire", "items", "%d: tip text not in TIPS: %s" % (i, a["text"][:80])))
                            elif a["text"] != e["text"]: bad.append(("wire", "items", "%d: %r expected %r" % (i, a["text"][:90], e["text"][:90])))
                            if i % 5 == 4 and a["kind"] != "tip": bad.append(("wire", "items", "%d: a tip slot holds %s" % (i, a["kind"])))
                        cats = [i for i, a in enumerate(x["items"]) if a["kind"] == "cat"]
                        if len(cats) != 1: bad.append(("wire", "cat", "%d cat items" % len(cats)))
                        elif (cats[0] > 0 and x["items"][cats[0] - 1]["kind"] == "firm") or (cats[0] + 1 < len(x["items"]) and x["items"][cats[0] + 1]["kind"] == "firm"): bad.append(("wire", "cat", "the cat item sits beside a named firm at %d" % cats[0]))
                        if x["locs"] < 1: bad.append(("wire", "loc", "no place-name span in the lead item"))
                        for i, a in enumerate(x["items"]):
                            if a["text"] and ";" in a["text"]: bad.append(("wire", "wording", "%d: a semicolon on screen: %s" % (i, a["text"][:80])))
                        sw, bw, vis = x.get("slotW"), x.get("barW"), x.get("vis")   # the slot's essentials (25 October 2026): never over a third of the bar, the window at least half of it from 1,200 px
                        if sw is not None and bw and sw > bw / 3 + 0.5: bad.append(("wire", "slot", "the slot is %.0f px of a %.0f px bar, over a third" % (sw, bw)))
                        if w >= 1200 and bw and vis is not None and vis < bw / 2: bad.append(("wire", "slot", "the track's window is %.0f px of a %.0f px bar, under half" % (vis, bw)))
                        if sw and (not x.get("slot") or " · " not in x["slot"] or not re.search(r"\d{4}\*?$", x["slot"])): bad.append(("wire", "slot", "the slot does not read as name, dot, year: %r" % x.get("slot")))
                        if x["scrolls"] and not (x["dur"] and x["width"] > 0): bad.append(("wire", "motion", "no scroll duration set (%s, width %s)" % (x["dur"], x["width"])))
                        return bad[:12]
                    return chk
                for y in (2021, 2024):
                    state("share", y, "A.mode('cells'); A.strip(true); A.layer('share'); A.year(%d); if (A.hoverOff) A.hoverOff(); A.preset('Russia'); A.year(+document.getElementById('year').value); await A.ready(); A.redraw(); await new Promise(r => setTimeout(r, 450)); window.__extra = Object.assign(A.wire(), { tips: A.tipTexts(), today: A.today(), gaps: A.wireGaps() });" % y, "wire%d" % y, wire_check(y, "national", "Russia"))
                    state("share", y, "A.mode('cells'); A.strip(true); A.layer('share'); A.year(%d); if (A.hoverOff) A.hoverOff(); await A.jump({ cx: m[0] + 60, cy: m[1], k: 1.0 }); await A.ready(); A.redraw(); await new Promise(r => setTimeout(r, 450)); window.__extra = Object.assign(A.wire(), { tips: A.tipTexts(), today: A.today(), gaps: A.wireGaps() });" % y, "wirereg%d" % y, wire_check(y, "region", "Moscow Oblast"))
                # the prune (25 October 2026): with the first item scrolled past, a region change prunes the passed items and appends the region's set; an item well inside the window keeps
                # its place on the screen (it advances at the wire's speed; an item at the window's edge may pass under the grown slot and be pruned, which is right), the track keeps at least a cycle, and the offset stays positive
                def prune_ok(r):
                    x = r["extra"]
                    if not x: return [("wire", "prune", "no report")]
                    bad = []
                    if x["after"]["text"] != x["before"]["text"]: bad.append(("wire", "prune", "the item in view left the track on a region change (%r, then %r)" % (x["before"]["text"], x["after"]["text"])))
                    else:
                        moved = x["before"]["left"] - x["after"]["left"]; exp = 60 * x["ms"] / 1000
                        if abs(moved - exp) > 15: bad.append(("wire", "prune", "the item in view moved %.0f px in %d ms, expected about %.0f (the wire's speed)" % (moved, x["ms"], exp)))
                    if x["after"]["rendered"] < 0: bad.append(("wire", "prune", "the offset went negative: %.0f" % x["after"]["rendered"]))
                    if not (50 <= x["after"]["dom"] <= 220): bad.append(("wire", "prune", "%d items on the track after the change (%d before)" % (x["after"]["dom"], x["before"]["dom"])))
                    if x["removed"] <= 0: bad.append(("wire", "prune", "nothing was pruned although the first item had passed (%d items before, %d after)" % (x["before"]["dom"], x["after"]["dom"])))
                    return bad
                state("share", 2021, "A.mode('cells'); A.strip(true); A.layer('share'); A.year(2021); if (A.hoverOff) A.hoverOff(); A.preset('Russia'); await A.ready(); A.redraw(); { const sleep = ms => new Promise(r => setTimeout(r, ms)); await sleep(450); const tr = document.getElementById('wiretrack'), win = document.getElementById('ctxwin'); const first = tr.querySelector('.wi'); const w0 = first.getBoundingClientRect().width; A.wireSeek(w0 + 400); await sleep(100); const wr0 = win.getBoundingClientRect(); const el0 = [...tr.querySelectorAll('.wi')].find(e => e.getBoundingClientRect().left > wr0.left + 120);   /* an item well inside the window: the slot may grow by up to a third of the bar and cover what sat at the edge */ const vis = () => ({ text: el0 && el0.isConnected ? el0.textContent.slice(0, 40) : null, left: el0 && el0.isConnected ? el0.getBoundingClientRect().left : null, dom: tr.querySelectorAll('.wi').length, rendered: A.wire().rendered }); const before = vis(), t0 = performance.now(); A.hoverKm(m[0] + 60, m[1], { show: true }); await sleep(450); const after = vis(); window.__extra = { before, after, ms: Math.round(performance.now() - t0), removed: (before.dom + 50) - after.dom }; A.hoverOff(); }", "wireprune", prune_ok)
                # the wire watchdog (the author's request of 25 October 2026): a hidden-then-visible document with a track that stalled while hidden advances again within two seconds
                def wake_ok(r):
                    x = r["extra"]
                    if not x: return [("wire", "watchdog", "no report")]
                    if not x["moving"]: return [("wire", "watchdog", "the track was not moving before the test")]
                    if not x["adv"]: return [("wire", "watchdog", "the track did not advance within two seconds of the document's return (restarts %s, %s to %s)" % (x["restarts"], x["x1"], x["xa"]))]
                    if x["restarts"] < 1: return [("wire", "watchdog", "the track advanced without a restart (the stall did not hold)")]
                    return []
                state("share", 2021, "A.mode('cells'); A.strip(true); A.layer('share'); A.year(2021); if (A.hoverOff) A.hoverOff(); A.preset('Russia'); await A.ready(); A.redraw(); { const sleep = ms => new Promise(r => setTimeout(r, ms)); await sleep(450); const a = A.wire().rendered; await sleep(300); const b = A.wire().rendered; Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); A.wireStall(true); await sleep(1200); const x1 = A.wire().rendered; delete document.visibilityState; document.dispatchEvent(new Event('visibilitychange')); const t0 = performance.now(); let adv = false, xa = x1; while (performance.now() - t0 < 2000) { await sleep(100); xa = A.wire().rendered; if (Math.abs(xa - x1) > 1) { adv = true; break; } } window.__extra = { moving: Math.abs(b - a) > 1, x1, xa, adv, ms: Math.round(performance.now() - t0), restarts: A.wire().restarts }; }", "wirewake", wake_ok)
                # the wire across context changes (round 11, item 6): two region hovers mid-scroll append and then replace the queued set, never the visible one; the scroll offset
                # stays monotone (no reset) and the new region's lead is queued within one cycle of the view; a year change resets under the crossfade
                def cross_ok(r):
                    x = r["extra"]; bad = []
                    if not x: return [("wire", "cross", "no report")]
                    if not (x["resets0"] == x["w1"]["resets"] == x["w2"]["resets"]): bad.append(("wire", "cross", "the track reset on a region change: resets %s, %s, %s" % (x["resets0"], x["w1"]["resets"], x["w2"]["resets"])))
                    k1 = [s["key"] for s in x["w1"]["sets"]]; k2 = [s["key"] for s in x["w2"]["sets"]]
                    if not k1 or "Moscow Oblast" not in k1[-1] or not x["w1"]["sets"][-1]["lead"].startswith("Moscow Oblast"): bad.append(("wire", "cross", "after the first hover the queued set is not Moscow Oblast's: %s" % json.dumps(k1)))
                    if not k2 or "Leningrad oblast" not in k2[-1] or not x["w2"]["sets"][-1]["lead"].startswith("Leningrad oblast") or not all(s["entered"] for s in x["w2"]["sets"][:-1]): bad.append(("wire", "cross", "the second hover did not replace the queued set with Leningrad's: %s" % json.dumps([(k, s["entered"]) for k, s in zip(k2, x["w2"]["sets"])])))
                    if x["w2"]["sets"] and x["w2"]["sets"][0]["key"] != x["w1"]["sets"][0]["key"]: bad.append(("wire", "cross", "the visible set changed"))
                    xs = x["xs"]
                    if any(xs[i] < xs[i - 1] for i in range(1, len(xs))) or xs[-1] <= xs[0]: bad.append(("wire", "cross", "the offset is not monotone or not moving: %s" % json.dumps(xs)))
                    if x["gap"] > x["maxw"] + x["w2"]["vis"] + 1: bad.append(("wire", "cross", "the new lead sits %.0f px ahead, more than one cycle (%.0f) and the view (%d)" % (x["gap"], x["maxw"], x["w2"]["vis"])))
                    if x["year"]["resets"] != x["w2"]["resets"] + 1 or x["year"]["sets"] != 1 or not x["year"]["ghost"]: bad.append(("wire", "cross", "the year change: resets %s after %s, sets %s, ghost %s" % (x["year"]["resets"], x["w2"]["resets"], x["year"]["sets"], x["year"]["ghost"])))
                    if x["sep"]["w"] < 13.5 or x["sep"]["w"] > 14.5 or x["sep"]["color"] != x["sep"]["context"]: bad.append(("wire", "sep", "the separator mark is %s px in %s, expected 14 px in the context green %s" % (x["sep"]["w"], x["sep"]["color"], x["sep"]["context"])))
                    return bad
                state("share", 2021, "A.mode('cells'); A.strip(true); A.layer('share'); A.year(2021); if (A.hoverOff) A.hoverOff(); A.preset('Russia'); A.year(+document.getElementById('year').value); await A.ready(); const wait = ms => new Promise(r => setTimeout(r, ms)); await wait(450); const w0 = A.wire(); A.hoverKm(m[0] + 60, m[1], { show: true }); await wait(450); const w1 = A.wire(); const sp = A.cities['St Petersburg']; A.hoverKm(sp[0] + 40, sp[1] - 60, { show: true }); await wait(450); const w2 = A.wire(); const xs = []; for (let i = 0; i < 5; i++) { xs.push(A.wire().x - A.wire().slotW); await wait(100); } const last = w2.sets[w2.sets.length - 1]; const sep = document.querySelector('.wsep'), sepW = sep ? sep.getBoundingClientRect().width : 0, sepColor = sep ? getComputedStyle(sep).color : '', tok = getComputedStyle(document.documentElement).getPropertyValue('--context').trim(), rgb = h => 'rgb(' + [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)).join(', ') + ')'; A.year(2024); await wait(60); const wy = A.wire(); window.__extra = { resets0: w0.resets, w1: { sets: w1.sets, resets: w1.resets }, w2: { sets: w2.sets, resets: w2.resets, vis: w2.vis, x: w2.x }, xs, gap: last.x0 - w2.x, maxw: Math.max(...w2.sets.map(s => s.x1 - s.x0)), year: { resets: wy.resets, sets: wy.sets.length, ghost: document.querySelectorAll('.ctxt .track.old').length }, sep: { w: sepW, color: sepColor, context: rgb(tok) } }; if (A.hoverOff) A.hoverOff(); A.year(2021); await wait(500);", "wirecross", cross_ok)
                # the wire's two-set queue (round 12, part D): the lead slot shows the hovered region at once; a pending set sits behind the playing set's next tip or cat
                # fact; it is committed after a 600 ms rest; fifty hover changes at 100 ms leave at most one pending set, at most two sets, a bounded track, no stray
                # timer and a stable heap; the capitals experiment's switch holds its state
                def queue_ok(r):
                    x = r["extra"]; bad = []
                    if not x: return [("wire", "queue", "no report")]
                    if not x["leadAtOnce"].startswith("Moscow Oblast"): bad.append(("wire", "queue", "the lead slot did not show the hovered region at once: %r" % x["leadAtOnce"][:60]))
                    p = x["pending"]
                    if len(p["sets"]) != 2 or p["sets"][1]["status"] != "pending" or p["sets"][0]["items"] > 5: bad.append(("wire", "queue", "after a hover: %s" % json.dumps([(s_["status"], s_["items"]) for s_ in p["sets"]])))
                    c = x["committed"]
                    if len(c["sets"]) != 1 or c["sets"][0]["status"] != "committed" or "Moscow Oblast" not in c["sets"][0]["key"] or c["commits"] != p["commits"] + 1: bad.append(("wire", "queue", "after a 600 ms rest: %s commits %s" % (json.dumps([(s_["status"], s_["key"][:30]) for s_ in c["sets"]]), c["commits"])))
                    f = x["after50"]
                    if len(f["sets"]) > 2 or sum(1 for s_ in f["sets"] if s_["status"] == "pending") > 1 or f["dom"] > 115 or f["orphans"] > 8: bad.append(("wire", "queue", "after fifty hovers: %d sets, dom %d, orphans %d" % (len(f["sets"]), f["dom"], f["orphans"])))
                    if not x["monotone"]: bad.append(("wire", "queue", "the offset ran backwards during the hovers"))
                    if x["heapMB"] is not None and x["heapMB"] > 24: bad.append(("wire", "queue", "the heap grew by %.1f MB over fifty hovers" % x["heapMB"]))
                    t = x["afterRest"]["timers"]
                    if t["debounce"] or t["commit"] or sum(1 for s_ in x["afterRest"]["sets"] if s_["status"] == "pending") > 0: bad.append(("wire", "queue", "after the rest a timer or a pending set is left: %s" % json.dumps(x["afterRest"]["timers"])))
                    if x["caps"]["on"] is not True or x["caps"]["data"] != "uppercase" or x["caps"]["lead"] != "uppercase" or x["caps"]["offData"] != "none" or x["caps"]["backOn"] is not True: bad.append(("wire", "caps", json.dumps(x["caps"])))
                    return bad
                state("share", 2021, "A.mode('cells'); A.strip(true); A.layer('share'); A.year(2021); if (A.hoverOff) A.hoverOff(); A.preset('Russia'); A.year(+document.getElementById('year').value); await A.ready(); const wait = ms => new Promise(r => setTimeout(r, ms)); await wait(400); const sp = A.cities['St Petersburg']; A.hoverKm(m[0] + 60, m[1], { show: true }); await wait(40); const leadAtOnce = A.wire().lead.text; await wait(300); const pending = A.wire(); await wait(400); const committed = A.wire(), leadAfterRest = committed.lead.text; const h0 = performance.memory ? performance.memory.usedJSHeapSize : null; const pts = [[m[0] + 60, m[1]], [sp[0] + 40, sp[1] - 60], [m[0] + 200, m[1] + 150], [m[0] - 150, m[1] - 100]]; const xs = []; for (let i = 0; i < 50; i++) { const q = pts[i % 4]; A.hoverKm(q[0], q[1], { show: true }); xs.push(A.wire().x - A.wire().slotW); await wait(100); } const after50 = A.wire(); await wait(700); const afterRest = A.wire(); if (A.hoverOff) A.hoverOff(); const caps = { on: A.wireCaps(), data: getComputedStyle(document.querySelector('.wi.data')).textTransform, lead: getComputedStyle(document.getElementById('ctxA')).textTransform }; A.wireCaps(false); caps.offData = getComputedStyle(document.querySelector('.wi.data')).textTransform; A.wireCaps(true); caps.backOn = A.wireCaps(); window.__extra = { leadAtOnce, leadAfterRest, pending, committed, after50, afterRest, monotone: xs.every((v, i) => i === 0 || v >= xs[i - 1]), heapMB: h0 == null ? null : (performance.memory.usedJSHeapSize - h0) / 1048576, caps };", "wirequeue", queue_ok)
            # the cards' collapse toggles (the author's addition of 25 October): all six collapsed at 1,600 and 400 px (the DOM rules above check each), then reopened
            if w in (1600, 400):
                state("share", 2024, "A.mode('cells'); A.preset('Russia'); for (const id of Object.keys(A.cards())) A.card(id, false); A.redraw(); window.__extra = A.cards();", "cardscollapsed", lambda r: [] if r["extra"] and not any(r["extra"].values()) else [("card", "state", "not all collapsed: %s" % json.dumps(r["extra"]))])
                state("share", 2024, "A.mode('cells'); for (const id of Object.keys(A.cards())) A.card(id, true); A.redraw(); window.__extra = A.cards();", "cardsopen", lambda r: [] if r["extra"] and all(r["extra"].values()) else [("card", "state", "not all open: %s" % json.dumps(r["extra"]))])
            # the Under the cursor panel (the author's correction of 25 October): on every layer a 100 km hover at the country and, on the industry layer, a 1 km hover at Moscow
            # keep the rows within PANEL_H (the chart stays in reach), every label a short tracked capital, no value past the card (the DOM overflow list carries '#cellinfo b')
            def panel_ok(limit):
                def chk(r):
                    x = r["extra"]
                    if not x: return [("panel", "dom", "no report")]
                    bad = []
                    if x["h"] > limit: bad.append(("panel", "height", "%d px of rows against %d allowed: %s" % (x["h"], limit, x["text"][:160])))
                    if x["labels"] > 9: bad.append(("panel", "rows", "%d labelled rows" % x["labels"]))
                    if any(len(t) > 16 for t in x["labelText"]): bad.append(("panel", "label", "a label over 16 characters: %s" % json.dumps(x["labelText"])))
                    if x["chartTop"] - x["cardTop"] > limit + 120: bad.append(("panel", "chart", "the chart sits %d px below the card's top" % (x["chartTop"] - x["cardTop"])))
                    return bad
                return chk
            PANEL_JS = "const ci = document.getElementById('cellinfo'); window.__extra = { h: Math.round(ci.getBoundingClientRect().height), labels: ci.querySelectorAll(':scope > span').length, labelText: [...ci.querySelectorAll(':scope > span')].map(e => e.textContent.trim()), text: ci.innerText.replace(/\\n/g, ' | '), chartTop: document.getElementById('cellchart').getBoundingClientRect().top, cardTop: document.getElementById('card-cursor').getBoundingClientRect().top };"
            for lyr, yr in [("share", 2021), ("change", 2021), ("cohort", 2021), ("lists", 2021), ("fin", 2021), ("density", 2021), ("industry", 2024)]:
                state(lyr, yr, "A.mode('cells'); A.preset('Russia'); A.card('cursor', true); A.hoverKm(m[0] + 300, m[1] + 100, { show: true }); " + PANEL_JS, "panel" + lyr, panel_ok(PANEL_H))
            state("industry", 2024, "A.mode('cells'); A.preset('Moscow'); A.card('cursor', true); A.hoverKm(m[0] + 1.2, m[1] - 0.6, { show: true }); " + PANEL_JS, "panelind1km", panel_ok(PANEL_H))
            # the minimap in the GO TO card (round 10, M12): above 900 px the map with its 22 cities, the layout rules clean, the button list hidden; at 768 and 400 px the buttons; a city group's own click lands where its preset does
            def mm_check(r):
                x = r["extra"]; bad = []
                if not x: return [("minimap", "dom", "no report")]
                tt = x.get("titles") or []
                if len(tt) != N_CITIES + 2: bad.append(("minimap", "title", "%d presets with titles, expected %d" % (len(tt), N_CITIES + 2)))
                for t in tt:
                    if not t["button"]: bad.append(("minimap", "title", "%s: the button carries no title" % t["label"]))
                    if len(t["button"]) > 200: bad.append(("minimap", "title", "%s: the title runs to %d characters" % (t["label"], len(t["button"]))))
                    if ";" in t["button"] or "\u2014" in t["button"]: bad.append(("minimap", "title", "%s: a semicolon or a dash in the title" % t["label"]))
                    if t["svg"] is not None and t["svg"] != t["button"]: bad.append(("minimap", "title", "%s: the group's title differs from the button's: %r" % (t["label"], (t["svg"] or "")[:40])))
                    if t["svg"] is None and t["label"] != "Central Moscow (250 m)": bad.append(("minimap", "title", "%s has no minimap group" % t["label"]))
                if w > 900:
                    if not x["visible"] or x["labels"] != N_CITIES or not x["rings"]: bad.append(("minimap", "dom", "visible %s labels %s rings %s" % (x["visible"], x["labels"], x["rings"])))
                    if x["violations"]: bad.append(("minimap", "layout", "rules broken: %s" % json.dumps(x["violations"])[:300]))
                    if x["presets"]: bad.append(("minimap", "dom", "the button list shows beside the minimap"))
                    if x["domvis"] is not True: bad.append(("minimap", "dom", "domBoxes reports the minimap hidden"))
                    for lbl, a, b in x["clicks"]:
                        if abs(a["cx"] - b["cx"]) > 0.01 or abs(a["cy"] - b["cy"]) > 0.01 or abs(a["k"] / b["k"] - 1) > 1e-6: bad.append(("minimap", "click", "%s: the group lands at %s, the preset at %s" % (lbl, json.dumps(a), json.dumps(b))))
                    if x["sel"] != [["mm-russia"], ["mm-moscow"]] or not x["selGreen"]: bad.append(("minimap", "selected", "selected groups %s, green %s" % (json.dumps(x["sel"]), x["selGreen"])))
                    if x.get("builds") != 1 or x.get("rebuilt") is not False: bad.append(("minimap", "measure", "built %s time(s), a verify rebuilt: %s (the canvas widths must match the rendered labels)" % (x.get("builds"), x.get("rebuilt"))))
                else:
                    if x["visible"] or x["domvis"]: bad.append(("minimap", "dom", "the minimap shows at %d px" % w))
                    if not x["presets"]: bad.append(("minimap", "dom", "the button list is hidden at %d px" % w))
                return bad
            state("share", 2021, "A.mode('cells'); A.preset('Russia'); const mm = A.minimap(), d = A.redraw().dom; const clicks = []; for (const lbl of ['Moscow', 'Novosibirsk', 'Vladivostok', 'Russia']) { const a = mm.visible ? await A.minimapClick(lbl) : null; A.preset(lbl); const b = A.camera(); if (a) clicks.push([lbl, a, b]); } A.preset('Russia'); const selOf = () => [...document.querySelectorAll('#minimap [aria-pressed=\"true\"]')].map(e => e.id); const sel = [selOf()]; A.preset('Moscow'); sel.push(selOf()); const tk = getComputedStyle(document.documentElement).getPropertyValue('--context').trim(), rgb = h => 'rgb(' + [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)).join(', ') + ')', g = document.querySelector('#mm-moscow'), selGreen = !!g && getComputedStyle(g).color === rgb(tk) && getComputedStyle(g.querySelector('text')).fill === rgb(tk) && getComputedStyle(g.querySelector('.ld')).stroke === rgb(tk); A.preset('Russia'); window.__extra = { visible: mm.visible, labels: mm.labels.length, rings: mm.rings, violations: mm.violations, presets: d.presets.visible, domvis: d.minimap.visible, clicks, sel, selGreen, builds: mm.builds, rebuilt: A.minimapVerify(), titles: mm.titles };", "minimap", mm_check)
            # the search by name (round 14, the author's request of 25 October 2026): the typed letters against the display and filed names, one to ten hits, each a listed firm whose
            # names hold the letters as the page normalises them; the list opens, Escape closes it; ArrowDown and Enter choose the second hit, which flies to the firm in the Firms view
            # (from the Cells view too), at the 20 km rung or closer, opens the tooltip with the firm's name, pulses its mark and writes the address; the field and its list stay inside the card
            def find_ok(r):
                x = r["extra"]; bad = []
                if not x: return [("find", "state", "no report")]
                if not (1 <= len(x["hits"]) <= 10): bad.append(("find", "hits", "%d hits for %r" % (len(x["hits"]), x["q"])))
                if any(x["qn"] not in k for k in x["keys"]): bad.append(("find", "match", "a hit whose names lack %r: %s" % (x["qn"], json.dumps(x["keys"])[:200])))
                if not x["listOpen"] or x["expanded"] != "true" or not x["escClosed"]: bad.append(("find", "list", "open %s, expanded %s, closed by Escape %s" % (x["listOpen"], x["expanded"], x["escClosed"])))
                st = x["st"]
                if not st["found"] or st["found"]["i"] != x["chosen"] or st["pin"] != x["chosen"]: bad.append(("find", "found", "chose %s, found %s" % (x["chosen"], json.dumps(st)[:160])))
                if st["mode"] != "firms": bad.append(("find", "view", "the search left the map in the %s view" % st["mode"]))
                if abs(st["cam"]["cx"] - x["fx"]) > 1e-6 or abs(st["cam"]["cy"] - x["fy"]) > 1e-6 or st["cam"]["k"] < x["kmin"] * (1 - 1e-9): bad.append(("find", "camera", "the camera %s, the firm at (%.4f, %.4f), k at least %.4f" % (json.dumps(st["cam"]), x["fx"], x["fy"], x["kmin"])))
                if x["name"] not in x["tip"]: bad.append(("find", "tooltip", "the tooltip lacks %r: %s" % (x["name"], x["tip"][:200])))
                if not x["closed"]: bad.append(("find", "list", "the list stays open after the choice"))
                if not st["hash"].startswith("#firms_"): bad.append(("find", "address", "the address did not follow the flight: %r" % st["hash"]))
                b, c, l = x["box"], x["card"], x["list"]
                if b["x"] < c["x"] - 0.5 or b["x1"] > c["x1"] + 0.5 or l["x"] < c["x"] - 0.5 or l["x1"] > c["x1"] + 0.5: bad.append(("find", "layout", "the field %s or its list %s leaves the card %s" % (json.dumps(b), json.dumps(l), json.dumps(c))))
                if x["static"] != x["rm"]: bad.append(("find", "motion", "the pulse is %s under reduced motion %s" % ("still" if x["static"] else "moving", x["rm"])))
                return bad
            FINDJS = "const Q = %r, rect = e => { const b = e.getBoundingClientRect(); return { x: b.left, x1: b.right, y: b.top, y1: b.bottom }; }, el = document.getElementById('findinput'), fl = document.getElementById('findlist'); el.focus(); const hits = A.find(Q).map(h => h.i); const listOpen = !fl.hidden, expanded = el.getAttribute('aria-expanded'), list = rect(fl), box = rect(el), card = rect(document.getElementById('card-goto')); el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); const escClosed = fl.hidden; A.find(Q); const chosen = hits.length > 1 ? hits[1] : hits[0]; if (hits.length > 1) el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); for (let t = 0; t < 80 && !(A.foundState().found && A.foundState().found.i === chosen); t++) await new Promise(q => setTimeout(q, 100)); const T = MOTION_DATA.treatednational, st = A.foundState(), cv = window.__atlasCanvases.map; window.__extra = { q: Q, qn: Q.normalize('NFKD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().replace(/[^\\p{L}\\p{N}]+/gu, ' ').trim(), hits, keys: hits.map(i => A.findKeys(i)), listOpen, expanded, escClosed, chosen, st, fx: T.x[chosen], fy: T.y[chosen], kmin: Math.min(Math.round(cv.w), Math.round(cv.h)) / 20, name: T.name[chosen], tip: document.getElementById('tipbody').innerText, closed: fl.hidden, box, card, list, static: !!(st.found && st.found.static), rm: matchMedia('(prefers-reduced-motion: reduce)').matches }; A.hoverOff();"
            state("share", 2024, "A.mode('firms'); A.preset('Russia'); await A.ready(); " + FINDJS % "avtomat", "find", find_ok)
            state("industry", 2024, "A.mode('cells'); A.preset('Russia'); await A.ready(); " + FINDJS % "ракетно", "findcells", find_ok)
            cdp.call("Emulation.setEmulatedMedia", {"features": [{"name": "prefers-reduced-motion", "value": "reduce"}]})
            state("share", 2024, "A.mode('cells'); A.preset('Moscow'); await A.ready(); " + FINDJS % "aeroflot", "findrm", find_ok)
            cdp.call("Emulation.setEmulatedMedia", {"features": [{"name": "prefers-reduced-motion", "value": ""}]})
            state("share", 2024, "A.mode('firms'); A.preset('Russia'); await A.ready(); { const el = document.getElementById('findinput'); el.focus(); const hits = A.find('zzqxw'); window.__extra = { hits: hits.length, none: document.querySelector('#findlist .none') ? document.querySelector('#findlist .none').textContent : null }; el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); el.blur(); }", "findnone",
                  lambda r: [] if r["extra"] and r["extra"]["hits"] == 0 and r["extra"]["none"] == "No list member by that name" else [("find", "none", json.dumps(r["extra"]))])
            # the tile on a phone (round 14, the author's decision of 25 October 2026), in a phone's viewport with touch: where the floating tile has no place, it docks along
            # the map's top edge at the map's width less 12 px margins, clear of the zoom box, the scale bar and the strip, the point below it with the hover's clearance, and a
            # hidden tile leaves the docked form; on a map under 450 px tall a search lands the firm at 62 percent of the map's height (360 by 800: a revenue-layer search whose
            # tile docks; 375 by 667: a share-layer search whose tile docks above the scale bar)
            if w == 400:
                PHONEJS = "await A.ready(); { const el = document.getElementById('findinput'); el.focus(); const i = A.find(%r)[0].i; el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); for (let t = 0; t < 100 && !(A.foundState().found && A.foundState().found.i === i); t++) await new Promise(q => setTimeout(q, 100)); el.blur(); await new Promise(q => setTimeout(q, 200)); const T = MOTION_DATA.treatednational, c = A.camera(), m = document.getElementById('mapwrap').getBoundingClientRect(), t = A.tile(), tip = document.getElementById('tip'); window.__extra = { W: m.width, H: m.height, fy: m.height / 2 - (T.y[i] - c.cy) * c.k, fx: m.width / 2 + (T.x[i] - c.cx) * c.k, docked: !!t.docked, fallback: !!t.fallback, box: t.box, cursor: t.cursor, cls: tip.className, tw: tip.getBoundingClientRect().width }; A.hoverOff(); window.__extra.after = { cls: tip.className, width: tip.style.width }; A.hoverPx(t.cursor[0], t.cursor[1], { touch: true }); }"   # shown again for the overlap checks
                def phone_ok(frac):
                    def f(r):
                        x = r["extra"]; bad = []
                        if not x: return [("phone", "state", "no report")]
                        if not x["docked"] or x["fallback"]: bad.append(("phone", "dock", "docked %s, last resort %s" % (x["docked"], x["fallback"])))
                        else:
                            b = x["box"]
                            if abs(b["x"] - 12) > 0.5 or abs(b["y"] - 12) > 0.5 or abs(b["x1"] - (x["W"] - 2 - 12)) > 1.5: bad.append(("phone", "dock", "the docked tile at %s on a %s px map" % (json.dumps({k: round(b[k], 1) for k in ("x", "y", "x1", "y1")}), round(x["W"]))))
                            if x["cursor"][1] < b["y1"] + 14 - 0.5: bad.append(("phone", "dock", "the point at y %.1f under the docked tile ending at %.1f" % (x["cursor"][1], b["y1"])))
                        if "docked" in x["after"]["cls"] or x["after"]["width"]: bad.append(("phone", "dock", "a hidden tile kept its docked form: %s" % json.dumps(x["after"])))
                        if abs(x["fy"] / x["H"] - frac) > 0.005 or abs(x["fx"] - x["W"] / 2) > 1: bad.append(("phone", "landing", "the firm at (%.1f, %.1f) on a %.0f by %.0f map, expected %.2f of its height" % (x["fx"], x["fy"], x["W"], x["H"], frac)))
                        return bad
                    return f
                for pw, ph, lyr, q, frac in ((360, 800, "fin", "aeroflot", 0.5), (375, 667, "share", "gazprom", 0.62)):
                    cdp.call("Emulation.setDeviceMetricsOverride", {"width": pw, "height": ph, "deviceScaleFactor": 1, "mobile": True}); cdp.call("Emulation.setTouchEmulationEnabled", {"enabled": True, "maxTouchPoints": 5}); time.sleep(0.5)
                    state(lyr, 2024, "A.mode('firms'); A.preset('Russia'); " + PHONEJS % q, "phone%d" % ph, phone_ok(frac))
                cdp.call("Emulation.setTouchEmulationEnabled", {"enabled": False}); cdp.call("Emulation.setDeviceMetricsOverride", {"width": w, "height": a.height, "deviceScaleFactor": 1, "mobile": False}); time.sleep(0.5)
            # links to the exact view (round 14): a settled view writes the address; the link button copies the artifact's address with it (or shows it in a field where the clipboard is
            # refused); the address read back restores the view, the layer, the year and the camera; a reload of it does too (below, with the presets' anchors)
            def vlink_ok(r):
                x = r["extra"]; bad = []
                if not x: return [("link", "state", "no report")]
                if x["hash"] != "#" + x["vh"]: bad.append(("link", "address", "the address %r, the view %r" % (x["hash"], x["vh"])))
                if not re.match(r"^firms_fin_2022_-?\d+\.\d{5}_-?\d+\.\d{5}_\d+(\.\d+)?km$", x["vh"]): bad.append(("link", "format", "the view reads %r" % x["vh"]))
                if not x["link"].endswith("#" + x["vh"]): bad.append(("link", "button", "the link %r does not carry the view" % x["link"]))
                if not (x["status"] == "Link copied" or x["field"] == x["link"]): bad.append(("link", "button", "status %r, field %r, link %r" % (x["status"], x["field"], x["link"])))
                b, c = x["btn"], x["card"]
                if b["x"] < c["x"] - 0.5 or b["x1"] > c["x1"] + 0.5: bad.append(("link", "layout", "the button %s leaves the card %s" % (json.dumps(b), json.dumps(c))))
                return bad
            state("fin", 2022, "A.mode('firms'); await A.jump({ cx: m[0] + 12.3, cy: m[1] - 4.5, k: 7.25 }); await A.ready(); { const rect = e => { const b = e.getBoundingClientRect(); return { x: b.left, x1: b.right }; }; document.getElementById('copylink').click(); await new Promise(q => setTimeout(q, 400)); const f = document.getElementById('linkfield'); window.__extra = { hash: location.hash, vh: A.viewHash(), link: A.viewLink(), status: document.getElementById('linkstatus').textContent, field: f.hidden ? null : f.value, btn: rect(document.getElementById('copylink')), card: rect(document.getElementById('card-goto')) }; f.hidden = true; document.getElementById('linkstatus').textContent = ''; }", "vlink", vlink_ok)
            # the note's default (round 15, the author's general point 5 of 26 October 2026): open, like the legend and the cards, on a map 600 px wide or more, at every
            # zoom and with the strip open or closed; collapsed on a narrow map; the viewer's choice winning
            def note_is(open_, label): return lambda r: [] if r["extra"] and r["extra"]["open"] is open_ else [("note", "default", "%s: expected open %s, got %s" % (label, open_, json.dumps(r["extra"])))]
            if w < 600: state("share", 2024, "A.mode('cells'); A.note(null); A.strip(true); A.preset('Russia'); A.redraw(); await new Promise(r => setTimeout(r, 60)); window.__extra = A.noteState();", "notenarrow", note_is(False, "narrow map"))
            if w >= 768:
                state("share", 2024, "A.mode('cells'); A.note(null); A.strip(true); A.preset('Russia'); A.redraw(); await new Promise(r => setTimeout(r, 60)); window.__extra = A.noteState();", "notenat", note_is(True, "national, strip open"))
                state("share", 2024, "A.mode('cells'); A.note(null); A.strip(true); A.preset('Moscow'); A.redraw(); await new Promise(r => setTimeout(r, 60)); window.__extra = A.noteState();", "notecity", note_is(True, "city window"))
                state("share", 2024, "A.mode('cells'); A.note(null); A.strip(false); A.preset('Russia'); A.redraw(); await new Promise(r => setTimeout(r, 60)); window.__extra = A.noteState(); A.strip(true);", "notestripoff", note_is(True, "national, strip closed"))
                state("share", 2024, "A.mode('cells'); A.note(true); A.strip(true); A.preset('Russia'); A.redraw(); await new Promise(r => setTimeout(r, 60)); window.__extra = A.noteState(); A.note(null);", "notemem", note_is(True, "national, the viewer's choice"))
            # ghost names, hairline borders, the hovered region's outline and the strip following the cursor (round 10, G13)
            # the ghost names float at a fixed size and opacity at every zoom (round 12, part D): the floors at the country, at least one name at the Moscow and Central Moscow presets in both views, the GO TO token as their colour
            # round 16 (item 8, the author's pick of 27 October 2026, 8Gb): the names on the ground, in the tile's ice; they grow with the zoom and are gone at the city presets, where they would lie over the dots
            def ghost_ok(floor, label, city=False):
                def f(r):
                    x = r["extra"]
                    if not x: return [("ghost", "map", "%s no report" % label)]
                    ok = abs(x["alpha"] - 0.3) < 1e-9 and x["colour"].upper() == x["tile"].upper() and (x["drawn"] == 0 if city else x["drawn"] >= floor)
                    return [] if ok else [("ghost", "map", "%s %s" % (label, json.dumps(x)))]
                return f
            GO = "window.__extra = Object.assign(A.ghost(), { go: getComputedStyle(document.documentElement).getPropertyValue('--go').trim(), tile: getComputedStyle(document.documentElement).getPropertyValue('--tile-ink').trim() });"
            state("share", 2021, "A.mode('cells'); A.preset('Russia'); A.redraw(); " + GO, "ghost", ghost_ok(12 if w >= 1600 else 1 if w <= 400 else 5, "at the Russia preset"))
            state("share", 2021, "A.mode('cells'); A.preset('Moscow'); A.redraw(); " + GO, "ghostcity", ghost_ok(1, "at the Moscow preset", True))
            state("share", 2021, "A.mode('cells'); A.preset('Central Moscow (250 m)'); A.redraw(); " + GO, "ghoststreet", ghost_ok(1, "at the Central Moscow preset", True))
            state("share", 2021, "A.mode('firms'); A.preset('Moscow'); await A.ready(); A.redraw(); " + GO + " A.mode('cells');", "ghostfirms", ghost_ok(1, "at the Moscow preset in the Firms view", True))
            # the dots at the city presets (round 15's cloud check, round 16's names on the ground): no name is drawn over them
            def ground_ok(r):
                g = (r.get("extra") or {}).get("ghost") or {}
                return [] if not g.get("drawn") else [("ground", "map", "%d name(s) still drawn at the city preset" % g["drawn"])]
            for city in ("Moscow", "St Petersburg"):
                state("industry", 2024, "A.mode('cells'); A.preset(%r); await A.ready(); A.redraw(); window.__extra = { ghost: A.ghost() };" % city, "ground-" + city[:3], ground_ok)
            # no sideways scroll, in the side column or the page (round 16, the author's report of 27 October 2026: the GO TO card's graticule ran 3 px past the card's border
            # and the column showed a horizontal scrollbar in Firefox and Brave)
            def sidex_ok(r):
                x = r.get("extra") or {}; out = []
                if w > 900 and x.get("side", 1) > 0: out.append(("sidex", "dom", "the side column scrolls sideways by %s px" % x.get("side")))
                if x.get("page", 1) > 0: out.append(("sidex", "dom", "the page scrolls sideways by %s px" % x.get("page")))
                return out
            state("share", 2021, "A.mode('cells'); A.preset('Russia'); await A.ready(); { const s = document.querySelector('.side'), d = document.documentElement; window.__extra = { side: s.scrollWidth - s.clientWidth, page: d.scrollWidth - d.clientWidth }; }", "sidex", sidex_ok)
            def near_any(pixels, rgb, tol): return any(all(abs(p[i] - rgb[i]) <= tol for i in range(3)) for p in pixels)
            # the hairline borders are under the data tiles, so the sample runs on the lists layer (85 coloured cells in 2021) over eight vertices of Moscow Oblast's first ring: at least one must read the ghost tone
            state("lists", 2021, "A.mode('cells'); A.strip(true); A.preset('Russia'); if (A.hoverOff) A.hoverOff(); A.redraw(); { const vs = [0, 9, 18, 27, 36, 45, 54, 63].map(i => { const v = A.regionVertex('Moscow Oblast', i); return { v, px: A.pixelsAt('map', v.px, v.py) }; }); window.__extra = { vs, ghost: getComputedStyle(document.documentElement).getPropertyValue('--ghost').trim() }; }", "borders",
                  lambda r: [] if r["extra"] and any(near_any(e["px"], [int(r["extra"]["ghost"][i:i + 2], 16) for i in (1, 3, 5)], 14) for e in r["extra"]["vs"]) else [("borders", "pixel", "no ghost-tone pixel at eight Moscow Oblast border vertices: %s" % json.dumps(r["extra"])[:240])])
            state("share", 2024, "A.mode('cells'); A.strip(true); A.preset('Russia'); A.hoverKm(m[0] + 60, m[1], { show: true }); window.__extra = Object.assign(A.context(), { hr: A.hoverRegion() });", "ctxhover", lambda r: [] if r["extra"] and r["extra"]["band"] == "region" and r["extra"]["name"] == "Moscow Oblast" and r["extra"]["hr"] == "Moscow Oblast" else [("context", "hover", json.dumps(r["extra"])[:200])])
            state("share", 2024, "A.mode('cells'); A.strip(true); A.preset('Russia'); A.hoverKm(m[0] + 60, m[1], { show: true }); { const v = A.regionVertex('Moscow Oblast'); const on = A.pixelsAt('overlay', v.px, v.py); A.hoverOff(); A.redraw(); window.__extra = { on, off: A.pixelsAt('overlay', v.px, v.py), c: A.context() }; }", "regionhov",
                  lambda r: [] if r["extra"] and any(p[3] > 120 and p[0] > 150 and p[2] > 120 and p[1] < 140 for p in r["extra"]["on"]) and all(p[3] == 0 for p in r["extra"]["off"]) and r["extra"]["c"]["band"] == "national" else [("regionhov", "pixel", json.dumps(r["extra"])[:300])])
            # the hovered region's outline at every zoom and in both views (the author's correction of 25 October): inside the Moscow window the city region's border reads fuchsia on the overlay while the cursor is on the map
            state("share", 2021, "A.mode('cells'); A.preset('Moscow'); A.hoverKm(m[0], m[1], { show: true }); { const v = A.regionVertex('Moscow', 40); const on = A.pixelsAt('overlay', v.px, v.py); A.hoverOff(); A.redraw(); window.__extra = { v, on, off: A.pixelsAt('overlay', v.px, v.py), hr: A.hoverRegion() }; }", "regionhovcity",
                  lambda r: [] if r["extra"] and any(p[3] > 120 and p[0] > 150 and p[2] > 120 and p[1] < 140 for p in r["extra"]["on"]) and all(p[3] == 0 for p in r["extra"]["off"]) else [("regionhov", "city", json.dumps(r["extra"])[:300])])
            # the hovered region's fill (the author's request of 25 October 2026): a bare land pixel inside the hovered region takes the land lifted by the cursor colour at the
            # theme's alpha, back to the land when the hover ends; a cell pixel inside it keeps the cell's own colour (the fill lies under the data)
            def hexrgb(h): return [int(h[i:i + 2], 16) for i in (1, 3, 5)]
            def fill_ok(r):
                x = r["extra"]
                if not x: return [("regionfill", "pixel", "no report")]
                land, cur, al = hexrgb(x["land"]), hexrgb(x["cursor"]), x["alpha"]
                cands = [c for c in x["cands"] if c["name"] and all(abs(c["before"][i] - land[i]) <= 1 for i in range(3)) and c["before"][3] == 255]
                if not cands: return [("regionfill", "pixel", "no bare land point found inside a hovered region: %s" % json.dumps(x["cands"])[:300])]
                c = cands[0]; exp = [land[i] + (cur[i] - land[i]) * al for i in range(3)]
                if not all(abs(c["on"][i] - exp[i]) <= 2 for i in range(3)): return [("regionfill", "pixel", "%s at (%d, %d): %s on hover, expected about %s (land %s, alpha %.2f)" % (c["name"], c["px"], c["py"], c["on"][:3], [round(v) for v in exp], land, al))]
                if not all(abs(c["off"][i] - land[i]) <= 1 for i in range(3)): return [("regionfill", "pixel", "%s: the land did not return after the hover: %s" % (c["name"], c["off"][:3]))]
                return []
            state("lists", 2021, "A.mode('cells'); A.strip(true); A.preset('Russia'); if (A.hoverOff) A.hoverOff(); A.redraw(); { const css = getComputedStyle(document.documentElement), mu = A.cities.Murmansk, cands = []; for (const [dx, dy] of [[0, -100], [0, -150], [0, -200], [40, -120], [-40, -160], [0, -250], [60, -200], [-60, -220], [0, -300]]) { const x = mu[0] + dx, y = mu[1] + dy, [px, py] = A.pxOf(x, y).map(Math.round); const before = A.pixelsAt('map', px, py)[4]; A.hoverKm(x, y, { show: true }); A.redraw(); const name = A.hoverRegion(); const on = A.pixelsAt('map', px, py)[4]; A.hoverOff(); A.redraw(); cands.push({ x, y, px, py, name, before, on, off: A.pixelsAt('map', px, py)[4] }); } window.__extra = { land: css.getPropertyValue('--land').trim(), cursor: css.getPropertyValue('--cursor').trim(), alpha: A.regionFill().alpha, cands }; }", "regionfill", fill_ok)
            state("share", 2024, "A.mode('cells'); A.strip(true); A.preset('Russia'); if (A.hoverOff) A.hoverOff(); A.redraw(); { const x = m[0] + 60, y = m[1], [px, py] = A.pxOf(x, y).map(Math.round); const before = A.pixelsAt('map', px, py)[4]; const h = A.hoverKm(x, y, { show: true }); A.redraw(); const name = A.hoverRegion(), kind = h && h.kind, fill = A.regionFill().name; const on = A.pixelsAt('map', px, py)[4]; A.hoverOff(); A.redraw(); window.__extra = { name, kind, fill, before, on, off: A.pixelsAt('map', px, py)[4] }; }", "regionfillcell",
                  lambda r: [] if r["extra"] and r["extra"]["name"] == "Moscow Oblast" and r["extra"]["fill"] == "Moscow Oblast" and r["extra"]["kind"] not in (None, "none") and r["extra"]["before"] == r["extra"]["on"] == r["extra"]["off"] else [("regionfill", "cell", json.dumps(r["extra"])[:300])])
            # the backdrop under a hover (25 October 2026): the graticule and the hairline borders keep their place while a region is filled (the fill's hook had reset the camera transform
            # inside drawBasemap, so every hover redrew them in pixel space); the counts of graticule- and ghost-toned pixels with the hover stay within a tenth of the counts without it
            def grat_ok(r):
                x = r["extra"]
                if not x: return [("regiongrat", "pixels", "no report")]
                bad = []
                for k in ("grat", "ghost"):
                    a, b = x["off"][k], x["on"][k]
                    if a and abs(b - a) > 0.1 * a: bad.append(("regiongrat", "pixels", "%s pixels %d without the hover, %d with it" % (k, a, b)))
                if x["off"] != x["off2"]: bad.append(("regiongrat", "pixels", "the backdrop did not return after the hover: %s then %s" % (json.dumps(x["off"]), json.dumps(x["off2"]))))
                return bad
            state("lists", 2021, "A.mode('cells'); A.strip(true); A.preset('Russia'); if (A.hoverOff) A.hoverOff(); A.redraw(); { const css = getComputedStyle(document.documentElement), hex = n => { const h = css.getPropertyValue(n).trim(); return [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); }; const G = hex('--graticule'), B = hex('--ghost'); const cv = document.getElementById('map'), g = cv.getContext('2d'); const count = () => { const d = g.getImageData(0, 0, cv.width, cv.height).data; let grat = 0, ghost = 0; for (let i = 0; i < d.length; i += 4) { const r = d[i], gg = d[i + 1], b = d[i + 2]; if (Math.abs(r - G[0]) <= 3 && Math.abs(gg - G[1]) <= 3 && Math.abs(b - G[2]) <= 3) grat++; if (Math.abs(r - B[0]) <= 3 && Math.abs(gg - B[1]) <= 3 && Math.abs(b - B[2]) <= 3) ghost++; } return { grat, ghost }; }; const off = count(); A.hoverKm(m[0] + 60, m[1], { show: true }); A.redraw(); const on = count(); A.hoverOff(); A.redraw(); window.__extra = { off, on, off2: count(), region: A.regionFill().name }; }", "regiongrat", grat_ok)
            state("share", 2021, "A.strip(false); A.preset('Russia'); window.__extra = A.context();", "ctxoff", lambda r: [] if r["extra"] and not r["extra"]["open"] and not r["dom"]["stripOpen"] else [("context", "closed", json.dumps(r["extra"])[:200])])
            state("share", 2021, "A.strip(null); A.preset('Russia');", "ctxdef")
            MAPSIZE = "const mbx = document.getElementById('mapwrap').getBoundingClientRect(), MW = mbx.width, MH = mbx.height; "
            def tile_ok(r):
                t = r["extra"] and r["extra"]["tile"]
                if not t: return [("tile", "hover", "no tile")]
                b, c = t["box"], t["cursor"]; bad = []
                if b["x"] - 6 <= c[0] <= b["x1"] + 6 and b["y"] - 6 <= c[1] <= b["y1"] + 6: bad.append(("tile", "cursor", "the tile covers the cursor at %s" % json.dumps([round(v) for v in c])))
                if t["mark"] and b["x"] - 6 <= t["mark"][0] <= b["x1"] + 6 and b["y"] - 6 <= t["mark"][1] <= b["y1"] + 6: bad.append(("tile", "mark", "the tile covers the hovered mark"))
                if t["fallback"]: bad.append(("tile", "fallback", "no clear anchor at %s" % json.dumps([round(v) for v in c])))
                return bad
            for mode_js, layer, preset, tagp in (("A.mode('cells'); ", "share", "Russia", "tc"), ("A.mode('cells'); ", "share", "Moscow", "tcm")):
                for cx, cy, tg in (("8", "8", "nw"), ("MW - 8", "8", "ne"), ("8", "MH - 8", "sw"), ("MW - 8", "MH - 8", "se"), ("MW / 2", "MH / 2", "c")):   # the map's own size, read in the page (the map is narrower than the viewport)
                    state(layer, 2021, mode_js + MAPSIZE + "A.strip(true); A.preset(%r); window.__extra = { tile: null }; A.hoverPx(%s, %s, { show: true }); window.__extra = { tile: A.tile() };" % (preset, cx, cy), tagp + tg, tile_ok)
            state("share", 2021, "A.mode('cells'); " + MAPSIZE + "A.strip(true); A.preset('Moscow'); A.tapAt(MW / 2, MH / 2); window.__extra = { tile: A.tile() };", "tap", lambda r: tile_ok(r) + ([] if r["extra"] and r["extra"]["tile"] and r["extra"]["tile"]["box"]["y1"] <= r["extra"]["tile"]["cursor"][1] - 14 + 0.5 else [("tile", "tap", "the tapped tile is not above the finger")]))
            # hovered states: the Moscow 100 km cell at the national view; at the Moscow preset a 1 km cell with firms and a point 300 m north-west of it (a gap or a neighbour); a density cell
            state("share", 2021, "A.preset('Russia'); A.hoverKm(m[0], m[1]);", "h100")
            state("share", 2021, "A.preset('Moscow'); A.hoverKm(m[0], m[1]);", "h1km")
            state("share", 2021, "A.preset('Moscow'); A.hoverKm(m[0] - 0.3, m[1] + 0.3);", "h1km2")
            state("share", 2023, "A.preset('Moscow'); A.hoverKm(m[0], m[1]);", "h1km")
            state("density", 2021, "A.preset('Russia'); A.hoverKm(m[0], m[1]);", "h5km")
            state("density", 2021, "A.preset('Central Moscow (250 m)'); A.hoverKm(m[0], m[1]);", "h250")
            # the tooltip shown on the map (an overlay the DOM check covers), at the Moscow preset
            state("share", 2021, "A.mode('cells'); A.layer('share'); A.year(2021); A.preset('Moscow'); A.hoverKm(m[0], m[1], { show: true });", "tip")
            # the click ladder, the zoom buttons and the presets (24 October 2026), through the instant API
            SET = "A.mode('cells'); A.layer('share'); A.year(2021); "
            state("share", 2021, SET + "A.preset('Russia'); await A.click(m[0], m[1]); A.hoverKm(m[0], m[1]);", "clk1", cam_is(dict(P["moscow"], k=side / 95), "a click on the Moscow cell from Russia lands on the Moscow city window (95 km)"))
            state("share", 2021, SET + "A.preset('Moscow'); await A.click(m[0], m[1]);", "clk2", cam_k(side / 20, "a click at the Moscow preset lands on the 20 km scale", mx, my))
            state("share", 2021, SET + "A.preset('Central Moscow (250 m)'); await A.click(m[0], m[1]);", "clk3", cam_k(min(2.5 * P["cm"]["k"], 200), "a click at Central Moscow steps x2.5"))
            state("share", 2021, SET + "A.preset('Central Moscow (250 m)'); await A.click(m[0], m[1]); await A.click(m[0], m[1], { shift: true });", "clk3b", cam_k(P["cm"]["k"], "a zoom on the clicked cell and a Shift+click out return to the preset's zoom near the subject", mx, my, 2.0))   # the step out is anchored at the cursor: 2.5 times the cell centre's offset, at most 1.8 km for a 1 km cell
            px, py = (mx + 60) // 1 + 0.5, my // 1 + 0.5
            state("share", 2021, SET + "A.preset('Moscow'); await A.ready(); await A.click(m[0] + 60, m[1]);", "clkpan", cam_k(side / 20, "a click on a 1 km square 60 km from Moscow lands on the 20 km rung at the square (round 14: the squares cover the country)", px, py, 1e-6))
            cx, cy = (int((mx + 300) // 100) + 0.5) * 100, (int(my // 100) + 0.5) * 100
            state("share", 2021, SET + "A.preset('Russia'); await A.click(m[0] + 300, m[1]);", "clkcell", cam_k(side / 500, "a click on the cell 300 km east of Moscow lands on its centre", cx, cy, 1e-6))
            state("share", 2021, SET + "A.preset('Russia'); await A.zoom(1); await A.zoom(1); await A.zoom(1);", "zoom3", cam_k(8 * P["kfit"], "three zoom-ins from Russia give 8 x kFit", P["russia"]["cx"], P["russia"]["cy"], 1e-6))
            state("share", 2021, SET + "A.preset('Russia'); await A.zoom(1); await A.zoom(1); await A.zoom(-1); await A.zoom(-1); await A.zoom(-1); await A.zoom(0);", "zoomfit", cam_is(P["russia"], "zooming in, out past the floor and fitting returns the Russia preset", 1e-6, 1e-6))
            # earlier re-centring (25 October 2026): zoom-out steps to just above the band keep the centre on Moscow; a wheel-sized step
            # into the band lands on the proportional blend (halfway at 1.5 x kFit); one more step lands exactly on the Russia preset;
            # and a zoom-in from the floor anchored at Moscow keeps Moscow under its pixel (nothing remembered on the way in)
            import math
            kM, kf, R = P["moscow"]["k"], P["kfit"], P["russia"]
            nsteps = int(math.floor(math.log2(kM / (2 * kf)))); kn = kM / 2 ** nsteps; fband = 1.5 * kf / kn
            OUT = "A.preset('Moscow'); " + "await A.zoom(-1); " * nsteps
            state("share", 2021, SET + OUT, "band0", cam_k(kn, "%d zoom-out steps from Moscow stay above the band with the centre on Moscow" % nsteps, mx, my, 1e-6))
            state("share", 2021, SET + OUT + "await A.zoomBy(%r);" % fband, "band1", cam_k(1.5 * kf, "a wheel-sized step into the band lands halfway between Moscow and the country's centre", (mx + R["cx"]) / 2, (my + R["cy"]) / 2, 0.01))
            FL = {"cx": R["cx"], "cy": R["cy"], "k": 0.75 * kf}   # the floor's target (round 11, item 5): three-quarters of the fit, centred on the country
            state("share", 2021, SET + OUT + "await A.zoomBy(%r); await A.zoom(-1);" % fband, "band2", cam_is(FL, "one more step from inside the band lands on the floor, centred on the country", 1e-6, 1e-6))
            state("share", 2021, SET + "A.preset('Russia'); { const c0 = A.camera(), W = window.__atlasCanvases.map.w, H = window.__atlasCanvases.map.h; const s0 = [W / 2 + (m[0] - c0.cx) * c0.k, H / 2 - (m[1] - c0.cy) * c0.k]; const c1 = await A.zoomBy(2, m); window.__extra = { s0, s1: [W / 2 + (m[0] - c1.cx) * c1.k, H / 2 - (m[1] - c1.cy) * c1.k] }; }", "floorin",
                  lambda r: ([] if abs(r["cam"]["k"] / (2 * kf) - 1) < 1e-6 else [("camera", "cam", "a zoom-in from the floor: expected k %.4f, got %.4f" % (2 * kf, r["cam"]["k"]))]) + ([] if r["extra"] and abs(r["extra"]["s0"][0] - r["extra"]["s1"][0]) < 0.01 and abs(r["extra"]["s0"][1] - r["extra"]["s1"][1]) < 0.01 else [("camera", "cam", "a zoom-in from the floor moved Moscow's screen point: %s" % json.dumps(r["extra"]))]) + ([] if math.hypot(r["cam"]["cx"] - R["cx"], r["cam"]["cy"] - R["cy"]) >= 1 else [("camera", "cam", "a zoom-in from the floor went into the country's centre")]))
            # the zoom floor (round 11, item 5): a step out from the fit lands on the floor with the minus button disabled, a further step stays there, the fit button returns exactly
            # to the fit, and a zoom-in from the floor anchored at Moscow keeps Moscow under its pixel (the one-way pull applies to zoom-out steps only)
            def floor_ok(r):
                x = r["extra"] or {}; bad = [] if same_cam(r["cam"], FL, 1e-6, 1e-6) else [("camera", "cam", "the floor: expected %s, got %s" % (json.dumps({k: round(FL[k], 4) for k in FL}), json.dumps({k: round(r["cam"][k], 4) for k in ("cx", "cy", "k")})))]
                if not x.get("minus") or x.get("plus"): bad.append(("floor", "buttons", "minus disabled %s, plus disabled %s at the floor" % (x.get("minus"), x.get("plus"))))
                if not x.get("floor") or abs(x["floor"]["fraction"] - 0.75) > 1e-9 or abs(x["floor"]["kfloor"] / x["floor"]["kfit"] - 0.75) > 1e-9: bad.append(("floor", "fraction", json.dumps(x.get("floor"))))
                return bad
            state("share", 2021, SET + "A.preset('Russia'); await A.zoom(-1); window.__extra = { minus: document.getElementById('zoom-out').disabled, plus: document.getElementById('zoom-in').disabled, floor: A.floor() };", "floor0", floor_ok)
            state("share", 2021, SET + "A.preset('Russia'); await A.zoom(-1); await A.zoom(-1); window.__extra = { minus: document.getElementById('zoom-out').disabled, plus: document.getElementById('zoom-in').disabled, floor: A.floor() };", "floor1", floor_ok)
            state("share", 2021, SET + "A.preset('Russia'); await A.zoom(-1); await A.zoom(0); window.__extra = { minus: document.getElementById('zoom-out').disabled };", "floorfit", lambda r: ([] if same_cam(r["cam"], R, 1e-6, 1e-6) else [("camera", "cam", "the fit from the floor: expected %s, got %s" % (json.dumps({k: round(R[k], 4) for k in R}), json.dumps({k: round(r["cam"][k], 4) for k in ("cx", "cy", "k")})))]) + ([] if r["extra"] and not r["extra"]["minus"] else [("floor", "buttons", "minus still disabled at the fit")]))
            state("share", 2021, SET + "A.preset('Russia'); await A.zoom(-1); { const c0 = A.camera(), W = window.__atlasCanvases.map.w, H = window.__atlasCanvases.map.h; const s0 = [W / 2 + (m[0] - c0.cx) * c0.k, H / 2 - (m[1] - c0.cy) * c0.k]; const c1 = await A.zoomBy(2, m); window.__extra = { s0, s1: [W / 2 + (m[0] - c1.cx) * c1.k, H / 2 - (m[1] - c1.cy) * c1.k] }; }", "floorin2",
                  lambda r: ([] if abs(r["cam"]["k"] / (1.5 * kf) - 1) < 1e-6 else [("camera", "cam", "a zoom-in from the floor: expected k %.4f, got %.4f" % (1.5 * kf, r["cam"]["k"]))]) + ([] if r["extra"] and abs(r["extra"]["s0"][0] - r["extra"]["s1"][0]) < 0.01 and abs(r["extra"]["s0"][1] - r["extra"]["s1"][1]) < 0.01 else [("camera", "cam", "a zoom-in from the floor moved Moscow's screen point: %s" % json.dumps(r["extra"]))]))
            # the 25 km cells (M10) and the hand-over around the city windows: three and four zoom steps in from the country
            Z3, Z4 = "A.preset('Russia'); await A.zoom(1); await A.zoom(1); await A.zoom(1);", "A.preset('Russia'); await A.zoom(1); await A.zoom(1); await A.zoom(1); await A.zoom(1);"
            for layer, year in [("share", 2021), ("share", 2014), ("change", 2021), ("lists", 2021), ("density", 2021), ("industry", 2021), ("industry", 2025)]:
                state(layer, year, "A.mode('cells'); " + Z3, "z3")
            # the industry layer (round 9): a 100 km hover at the country names the division and its share and the legend lists the nine classes; a 25 km hover inside Moscow's window
            state("industry", 2021, "A.mode('cells'); A.preset('Russia'); A.hoverKm(m[0], m[1], { show: true }); window.__extra = { tip: document.getElementById('tip').innerText, rows: document.querySelectorAll('#legendbody .row .sw').length };", "ihov100", lambda r: [] if r["extra"] and re.search(r"\(division \d\d\)|\(\d\d\), \d", r["extra"]["tip"]) and ("% of revenue" in r["extra"]["tip"] or "share of revenue" in r["extra"]["tip"] or "Largest share:" in r["extra"]["tip"]) and r["extra"]["rows"] >= 10 else [("industry", "tip", json.dumps(r["extra"])[:200])])
            # the revenue mix box (round 9, the author's correction): rows for the hovered unit, the view's mix off the map, hidden off the layer, the toggle
            MIXJS = "window.__extra = A.mix();"
            def mix_ok(unit_sub, closed=False):
                def f(r):
                    m = r["extra"]; bad = []
                    if not m or not m["visible"]: return [("mix", "box", "not visible")]
                    if closed: return [] if not m["open"] else [("mix", "open", "expected closed")]
                    if not m["open"]: return [("mix", "open", "expected open")]
                    if unit_sub not in m["unit"]: bad.append(("mix", "unit", m["unit"]))
                    rows = [x for x in m["rows"] if x["pct"] is not None]
                    if not rows: bad.append(("mix", "rows", "no rows: " + json.dumps(m)[:160]))
                    if len(rows) > 9: bad.append(("mix", "rows", "more than nine rows"))
                    named = [x for x in rows if x["name"] != "other divisions"]
                    if len(named) > 8: bad.append(("mix", "rows", "more than eight division rows"))
                    pcts = [0.5 if x["pct"] == "<1%" else float(x["pct"].rstrip("%")) for x in named]
                    if pcts != sorted(pcts, reverse=True): bad.append(("mix", "sort", json.dumps(pcts)))
                    if any(x["name"] == "other divisions" for x in rows) and rows[-1]["name"] != "other divisions": bad.append(("mix", "rows", "other divisions not last"))
                    if any(not x["colour"] for x in named): bad.append(("mix", "colour", "a division row without its class colour"))
                    return bad
                return f
            state("industry", 2021, "A.mode('cells'); A.mixbox(true); A.preset('Russia'); A.hoverKm(m[0], m[1], { show: true }); " + MIXJS, "mixhov100", mix_ok("100 km cell at the cursor"))
            state("industry", 2021, "A.mode('cells'); A.mixbox(true); A.preset('Moscow'); await A.ready(); A.redraw(); A.hoverKm(m[0] + 0.2, m[1] + 0.2, { show: true }); " + MIXJS, "mixhov1", mix_ok("1 km square at the cursor"))
            state("industry", 2021, "A.mode('cells'); A.mixbox(true); A.preset('Russia'); A.hoverOff(); " + MIXJS, "mixview", mix_ok("100 km cells in view"))
            state("industry", 2021, "A.mode('firms'); A.mixbox(true); A.preset('Central Moscow (250 m)'); await A.ready(); const AN = A.anchors(); A.hoverKm(AN.a[0], AN.a[1], { show: true }); " + MIXJS, "mixaddr", mix_ok("coordinate pair at the cursor"))
            state("industry", 2021, "A.mode('firms'); A.mixbox(true); await A.jump({ cx: m[0], cy: m[1], k: %r }); await A.ready(); A.hoverKm(m[0], m[1], { show: true }); " % (side / 95) + MIXJS, "mixsq", mix_ok("pixel at the cursor"))
            # a tap at the map's centre (round 14: where the search lands a firm): on a 400 px map the revenue layer's tile at Moscow is about 260 px tall and has no place at
            # a tap's 24 px, so it must take the hover's clearance rather than the last resort over the controls
            state("fin", 2021, "A.mode('firms'); A.preset('Moscow'); await A.ready(); A.hoverKm(m[0], m[1], { show: true, touch: true }); window.__extra = A.tile();", "tapcentre",
                  lambda r: [] if r["extra"] and not r["extra"].get("fallback") else [("tile", "tap", "a tap at the map's centre left the tile on the last resort: %s" % json.dumps(r["extra"])[:200])])
            state("industry", 2021, "A.mode('firms'); A.mixbox(true); A.preset('Moscow'); await A.ready(); A.hoverOff(); " + MIXJS, "mixviewf", mix_ok("coordinate pairs in view"))
            state("share", 2021, "A.mode('cells'); A.preset('Russia'); " + MIXJS, "mixoff", lambda r: [] if r["extra"] and not r["extra"]["visible"] else [("mix", "hidden", "the box shows off the industry layer")])
            state("industry", 2021, "A.mode('cells'); A.mixbox(false); A.preset('Russia'); " + MIXJS, "mixclosed", mix_ok("", closed=True))
            state("industry", 2021, "A.mode('cells'); A.mixbox(null); A.preset('Russia'); " + MIXJS, "mixdef", lambda r: [] if r["extra"] and r["extra"]["visible"] and r["extra"]["open"] == (w >= 1200) else [("mix", "default", "open %s at %d px" % (r["extra"] and r["extra"]["open"], w))])   # open by default only where the map is at least 600 px wide and 640 px tall (the side-by-side layout)
            state("industry", 2021, "A.mode('cells'); A.mixbox(null); A.preset('Russia');", "mixdef2")
            state("industry", 2021, "A.mode('cells'); " + Z3 + " { const c = A.camera(); A.hoverKm(c.cx + 30, c.cy - 20, { show: true }); window.__extra = { tip: document.getElementById('tip').innerText }; }", "ihov25", lambda r: [] if r["extra"] and ("revenue" in r["extra"]["tip"]) else [("industry", "tip25", json.dumps(r["extra"])[:200])])
            state("share", 2021, "A.mode('cells'); " + Z3 + " { const c = A.camera(); A.hoverKm(c.cx + 30, c.cy - 20, { show: true }); }", "z3hov")
            state("lists", 2021, "A.mode('cells'); A.layer('lists'); " + Z4 + " { const c = A.camera(); A.hoverKm(c.cx, c.cy, { show: true }); }", "z4hov")
            state("share", 2025, "A.mode('cells'); " + Z4, "z4")
            # a zoom-in flight keeps its subject converging on the centre from the first frame (24 October 2026)
            for tag, setup, target in [("path1", "A.preset('Russia');", "{ cx: m[0], cy: m[1], k: %r }" % P["moscow"]["k"]), ("path2", "A.preset('Moscow');", "{ cx: m[0] + 1.5, cy: m[1] + 0.5, k: %r }" % P["cm"]["k"]), ("path3", "A.preset('Russia');", "{ cx: m[0] + 300, cy: m[1], k: %r }" % (side / 500))]:
                d = cdp.evaluate("(() => { const A = window.__atlas, m = A.cities.Moscow; A.mode('cells'); %s return A.pathPreview(%s, 40); })()" % (setup, target), await_promise=False)
                bad = [i for i in range(1, len(d)) if d[i] > d[i - 1] + 0.5]
                n_states += 1
                if bad or d[-1] > 0.5: findings.append("%-11s width %d  %-7s %-5s %-8s %-10s %s" % ("path", w, "share", 2021, tag, "flight", "the subject moved away from the centre at samples %s; end offset %.2f px" % (bad[:5], d[-1])))
            # firms mode (round 5): the address marks by layer at three presets, two hovers, and a ladder step; since the
            # WebGL field (24 October 2026) the same states run on the renderer the page chose and again on the 2D
            # fallback (?__nogl=1), with the renderer asserted, plus a forward year change (the pulse) and a backward one
            F = "A.mode('firms'); "
            GL = ("webgl2", "webgl")
            def field_is(expect, label): return lambda r: [] if r["field"] in expect else [("field", "gl", "%s: expected %s, got %s" % (label, "/".join(expect), r["field"]))]
            def pulsing_is(expect, label): return lambda r: [] if bool(r["pulsing"]) == expect else [("pulse", "marks", "%s: expected pulsing %s, got %s" % (label, expect, r["pulsing"]))]
            def both(f, g): return lambda r: f(r) + g(r)
            def firms_states(expect, tag):
                for layer, year, preset in [("share", 2021, "Russia"), ("share", 2014, "Moscow"), ("share", 2025, "Central Moscow (250 m)"), ("fin", 2021, "Russia"), ("fin", 2021, "Moscow"), ("fin", 2021, "Central Moscow (250 m)"), ("density", 2021, "Moscow"), ("lists", 2021, "Russia"), ("industry", 2021, "Russia"), ("industry", 2021, "Moscow"), ("industry", 2021, "Central Moscow (250 m)")]:
                    state(layer, year, F + "A.preset(%r);" % preset, tag, field_is(expect, "the firms view draws on " + "/".join(expect)))
                state("share", 2021, F + "A.preset('Central Moscow (250 m)'); A.hoverKm(m[0] + 1.2, m[1] + 0.4);", tag + "hov", field_is(expect, "hover"))
                state("share", 2021, F + "A.preset('Moscow'); await A.ready(); window.__extra = { note: A.twinNote(2021) };", tag + "twin", lambda r: [] if r["extra"] and r["extra"]["note"] == "by Armen G. Kaprelian" else [("twin", "gzip", "the 2021 twin's comment reads %r" % (r["extra"] and r["extra"]["note"]))])
                state("fin", 2021, F + "A.preset('Moscow'); A.hoverKm(m[0], m[1]);", tag + "hov2", field_is(expect, "hover"))
                # the Firms view's click ladder (round 10): the Cells rungs by zoom alone, every landing centred on the click, x4 steps where no rung applies, Shift+click back down the rungs
                rung_is = lambda name: (lambda r: [] if r["extra"] and r["extra"].get("rung") == name else [("camera", "rung", "expected the rung %r, got %s" % (name, json.dumps(r["extra"])[:160]))])
                state("share", 2021, F + "A.layer('share'); A.year(2021); A.preset('Moscow'); await A.ready(); window.__extra = await A.click(m[0], m[1]);", tag + "clk", both(both(cam_k(side / 20, "a click at the Moscow preset in the firms view lands on the 20 km rung at the click", mx, my, 0.5), rung_is("fine")), field_is(expect, "click")))
                state("share", 2021, F + "A.layer('share'); A.year(2021); A.preset('Russia'); await A.ready(); window.__extra = await A.click(m[0], m[1]);", tag + "fclk1", both(cam_k(side / 95, "from the country a click on the Moscow cell lands on the city rung at the click", mx, my, 0.5), rung_is("city")))
                state("share", 2021, F + "A.layer('share'); A.year(2021); A.preset('Moscow'); await A.ready(); window.__extra = await A.click(m[0] + 3, m[1] - 2);", tag + "fclk2", both(cam_k(side / 20, "from the city rung a click lands on the 20 km rung at the click", mx + 3, my - 2, 0.5), rung_is("fine")))
                state("share", 2021, F + "A.layer('share'); A.year(2021); A.preset('Moscow'); await A.ready(); await A.click(m[0] + 3, m[1] - 2); window.__extra = await A.click(m[0] + 3, m[1] - 2);", tag + "fclk3", both(cam_k(min(4 * side / 20, 200), "from the 20 km rung a click steps x4 at the click", mx + 3, my - 2, 0.5), rung_is("zoom")))
                state("share", 2021, F + "A.layer('share'); A.year(2021); A.preset('Moscow'); await A.ready(); await A.click(m[0] + 3, m[1] - 2); await A.click(m[0] + 3, m[1] - 2); window.__extra = await A.click(m[0] + 3, m[1] - 2, { shift: true });", tag + "fclk4", both(cam_k(side / 20, "a Shift+click from the x4 step returns to the 20 km rung at the click", mx + 3, my - 2, 0.5), rung_is("fine")))
                state("share", 2021, F + "A.layer('share'); A.year(2021); A.preset('Moscow'); await A.ready(); await A.click(m[0] + 3, m[1] - 2); window.__extra = await A.click(m[0] + 3, m[1] - 2, { shift: true });", tag + "fclk5", both(cam_k(side / 95, "a Shift+click from the 20 km rung returns to the city rung at the click", mx + 3, my - 2, 0.5), rung_is("city")))
                state("share", 2021, F + "A.layer('share'); A.year(2021); await A.jump({ cx: m[0], cy: m[1], k: %r }); await A.ready(); window.__extra = await A.click(m[0] + 3, m[1] - 2, { shift: true });" % (side / 95), tag + "fclk6", both(cam_is(P["russia"], "a Shift+click from the city rung returns the Russia camera"), rung_is("fit")))
                state("share", 2021, F + "A.layer('share'); A.year(2021); A.preset('Russia'); await A.ready(); { const mu = A.cities.Murmansk; window.__extra = await A.click(mu[0], mu[1] + 400); }", tag + "fclkempty", both(cam_k(4 * P["kfit"], "from the country a click on an empty cell steps x4 at the click"), rung_is("zoom")))
                state("share", 2021, F + "A.layer('share'); A.year(2021); A.preset('Russia'); await A.ready(); window.__extra = await A.click(m[0] + 300, m[1]);", tag + "fclkcell", both(cam_k(side / 500, "from the country a click on a cell without a preset city lands on the 500 km rung at the click", mx + 300, my, 0.5), rung_is("cell")))
                state("share", 2022, F + "A.preset('Moscow'); A.layer('share'); A.year(2021); await A.ready(); A.year(2022); await new Promise(r => setTimeout(r, 250));", tag + "pulse", both(pulsing_is(True, "a forward year change pulses the newly red marks"), field_is(expect, "pulse")))
                state("share", 2020, F + "A.preset('Moscow'); A.layer('share'); A.year(2022); await A.ready(); A.year(2020); await A.ready();", tag + "back", pulsing_is(False, "a backward year change does not pulse"))
                state("share", 2025, "A.mode('cells'); A.preset('Moscow'); A.layer('share'); A.year(2021); await A.ready(); A.year(2025); await A.ready();", tag + "cells", pulsing_is(False, "a forward year change in the cells view does not pulse"))
                # the pulse button (25 October 2026): pressed at the Moscow preset for 2022 it replays the bloom for the firms listed that
                # year (dated, present), is disabled in 2025 (no listing), and works after a move back a year; a rimmed firm's hover
                N22 = "(() => { const T = MOTION_DATA.treatednational; let n = 0; for (let i = 0; i < T.n; i++) if (T.red_from[i] === %d && !T.undated[i] && T.filed[i][%d] !== '-') n++; return n; })()"
                def pulsed_is(y, label):
                    def f(r):
                        exp = r["extra"]["expect"] if r["extra"] else None
                        bad = []
                        if not r["extra"] or r["extra"]["pulsed"] != exp: bad.append(("pulse", "button", "%s: pulse() returned %s, expected %s" % (label, r["extra"] and r["extra"]["pulsed"], exp)))
                        if r["pulsing"] != exp: bad.append(("pulse", "button", "%s: pulsing %s, expected %s" % (label, r["pulsing"], exp)))
                        return bad
                    return f
                state("share", 2022, F + "A.preset('Moscow'); A.layer('share'); A.year(2022); await A.ready(); window.__extra = { pulsed: A.pulse(), expect: %s }; await new Promise(r => setTimeout(r, 250));" % (N22 % (2022, 8)), tag + "btn", both(pulsed_is(2022, "the button replays the bloom of the firms listed in 2022"), field_is(expect, "button")))
                # the year row while a pulse runs (round 10, final): the value and the thumb in the live green, the pulse button filled red
                state("share", 2022, F + "A.preset('Moscow'); A.layer('share'); A.year(2022); await A.ready(); A.pulseAt(null); const n = A.pulse(); await new Promise(r => setTimeout(r, 450)); const cs = s => getComputedStyle(document.querySelector(s)), tk = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim(), rgb = h => 'rgb(' + [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)).join(', ') + ')'; window.__extra = { n, live: document.getElementById('yearrow').classList.contains('live'), ok: cs('#yearlabel').color === rgb(tk('--context-live')) && cs('#yearthumb').color === rgb(tk('--context-live')) && cs('#pulse').backgroundColor === rgb(tk('--treated')), got: [cs('#yearlabel').color, cs('#yearthumb').color, cs('#pulse').backgroundColor] }; A.pulseAt(null);", tag + "yearlive", lambda r: [] if r["extra"] and r["extra"]["n"] > 0 and r["extra"]["live"] and r["extra"]["ok"] else [("pulse", "yearrow", "live colours %s" % json.dumps(r["extra"]))])
                state("share", 2025, F + "A.preset('Moscow'); A.layer('share'); A.year(2025); await A.ready(); await new Promise(r => setTimeout(r, 2000)); window.__extra = { pulsed: A.pulse(), expect: %s };" % (N22 % (2025, 11)), tag + "btn0", lambda r: pulsed_is(2025, "the button replays the bloom of the firms added in 2025")(r) if r["extra"] and r["extra"]["expect"] else ([] if r["extra"] and r["extra"]["pulsed"] == 0 and r["pulsing"] == 0 else [("pulse", "button", "2025: pulse() %s, pulsing %s" % (r["extra"] and r["extra"]["pulsed"], r["pulsing"]))]) + ([] if r["dom"]["pulse"]["disabled"] and r["dom"]["pulse"]["title"] == "No firm was added to these lists in 2025" else [("pulse", "button", "2025: disabled %s, title %r" % (r["dom"]["pulse"]["disabled"], r["dom"]["pulse"]["title"]))]))
                state("share", 2020, F + "A.preset('Moscow'); A.layer('share'); A.year(2022); await A.ready(); A.year(2020); await A.ready(); window.__extra = { pulsed: A.pulse(), expect: %s }; await new Promise(r => setTimeout(r, 250));" % (N22 % (2020, 6)), tag + "btnback", pulsed_is(2020, "after a move back a year the button pulses the firms listed in the shown year"))
                state("share", 2016, F + "A.preset('Moscow'); A.layer('share'); A.year(2016); await A.ready(); { const T = MOTION_DATA.treatednational; let best = -1, bd = Infinity; for (let i = 0; i < T.n; i++) { if (T.red_from[i] <= 2016 || T.filed[i][2] === '-') continue; const d = Math.hypot(T.x[i] - m[0], T.y[i] - m[1]); if (d < bd) { bd = d; best = i; } } window.__extra = { hover: A.hoverKm(T.x[best], T.y[best], { show: true }), d: bd }; }", tag + "rimhov", lambda r: [] if r["extra"] and r["extra"]["hover"].get("listed") and r["extra"]["hover"]["listed"]["rim"] >= 1 and r["extra"]["hover"]["listed"]["rim_from"] > 2016 else [("hover", "rim", "a rimmed firm's hover: %s" % json.dumps(r["extra"] and r["extra"]["hover"] and r["extra"]["hover"].get("listed")))])
                # a red mark is hovered within the 6 px floor and wins over the address under the cursor (25 October 2026)
                state("share", 2022, F + "A.preset('Moscow'); A.layer('share'); A.year(2022); await A.ready(); { const T = MOTION_DATA.treatednational, c = A.camera(); let best = -1, bd = Infinity; for (let i = 0; i < T.n; i++) { if (T.red_from[i] > 2022 || T.filed[i][8] === '-') continue; const d = Math.hypot(T.x[i] - m[0], T.y[i] - m[1]); if (d < bd) { bd = d; best = i; } } window.__extra = { hover: A.hoverKm(T.x[best] + 4.5 / c.k, T.y[best], { show: true }) }; }", tag + "redhov", lambda r: [] if r["extra"] and r["extra"]["hover"]["kind"] == "listed" and (r["extra"]["hover"].get("listed") or {}).get("red", 0) >= 1 else [("hover", "red", "a red mark 4.5 px off the cursor: %s" % json.dumps(r["extra"] and r["extra"]["hover"]))])
                # the listed firms' names (25 October 2026): at the nearest red firm to Moscow in 2022 the tooltip carries one to three named short lines, each with a glyph span,
                # lines and the panel their rows; skipped until the data carry names
                state("share", 2022, F + "A.preset('Moscow'); A.layer('share'); A.year(2022); await A.ready(); { const T = MOTION_DATA.treatednational; if (T.name) { let best = -1, bd = Infinity; for (let i = 0; i < T.n; i++) { if (T.red_from[i] > 2022 || T.filed[i][8] === '-') continue; const d = Math.hypot(T.x[i] - m[0], T.y[i] - m[1]); if (d < bd) { bd = d; best = i; } } const h = A.hoverKm(T.x[best], T.y[best], { show: true }); const top = (h.listed && h.listed.top) || []; window.__extra = { named: true, kind: h.kind, n: h.listed && h.listed.n, top: top.length, names: top.map(i => T.name[i]), tip: document.getElementById('tip').innerText, glyphs: document.querySelectorAll('#tip .gl').length, blocks: document.querySelectorAll('#cellinfo .lf:not(.more)').length, panelH: document.getElementById('cellinfo').getBoundingClientRect().height }; } else window.__extra = { named: false }; }", tag + "names",
                      lambda r: [] if not r["extra"] or not r["extra"]["named"] or (r["extra"]["kind"] == "listed" and 1 <= r["extra"]["top"] <= 3 and all(r["extra"]["names"]) and r["extra"]["glyphs"] == min(r["extra"]["top"], 1 if w < 600 else 3) and r["extra"]["blocks"] == r["extra"]["top"] and (r["extra"]["n"] <= 3 or " more" in r["extra"]["tip"]) and r["extra"]["panelH"] <= PANEL_H_LISTED) else [("names", "tip", json.dumps({k: r["extra"][k] for k in ("kind", "n", "top", "names", "panelH")}) + " | " + r["extra"]["tip"][-160:])])
                # the listed rule by zoom: the quiet weight falls with the zoom, the ring reach and width stay within their caps and the cull margin
                def rules_ok(r):
                    x = r["extra"] or {}; bad = []
                    for name, L in x.items():
                        if not (44 - 1e-6 <= L["Rmax"] <= 64 + 1e-6 and 2.2 - 1e-6 <= L["W"] <= 3.5 + 1e-6): bad.append(("rule", name, "Rmax %.2f W %.2f" % (L["Rmax"], L["W"])))
                        if not (60 - 1e-6 <= L["spreadMs"] <= 200 + 1e-6 and L["decayMs"] == 1600 and L["pulseMs"] == 1800): bad.append(("rule", name, "spread %.1f decay %s pulse %s" % (L["spreadMs"], L["decayMs"], L["pulseMs"])))
                        if L["rMax"] + 2 + L["Rmax"] + L["W"] / 2 > L["cull"] or 2 * (L["rMax"] + L["flashMax"]) > L["cull"]: bad.append(("rule", name, "the flash, the glow or the ring exceed the cull margin"))
                    for name, L in x.items():   # q follows the zoom by the stated formula, 1 at the country, falling with k
                        qe = min(1, max(0, math.log2(60 / L["k"]) / math.log2(120)))
                        if abs(L["q"] - qe) > 1e-6: bad.append(("rule", name, "q %.3f at k %.3f, expected %.3f" % (L["q"], L["k"], qe)))
                    if x and not (abs(x["russia"]["q"] - 1) < 1e-6 and x["russia"]["q"] >= x["moscow"]["q"] >= x["central"]["q"] >= 0): bad.append(("rule", "q", json.dumps({k: round(v["q"], 3) for k, v in x.items()})))   # central may reach 0: on a screen 1,400 px tall the 250 m preset's k passes 60, where the formula ends (seen at 2,560 by 1,400 on 25 October)
                    if x and (abs(x["russia"]["alpha"] - 0.48) > 1e-6 or abs(x["russia"]["floor"] - 0.85 * 0.82) > 1e-6): bad.append(("rule", "quiet", "at the country alpha %.3f floor %.3f, expected 0.48 and 0.697 (round 11's 0.60 and 0.85 with B'')" % (x["russia"]["alpha"], x["russia"]["floor"])))   # the national extra (round 11, item 2) with the cased marks of round 14 (B'')
                    if x and (x["moscow"].get("q2", 0) > 1e-6 or abs(x["moscow"]["alpha"] - (1 - 0.2 * x["moscow"]["q"])) > 1e-6): bad.append(("rule", "quiet", "at the city preset q2 %.3f alpha %.3f (q %.3f): the extra must end at the city zoom" % (x["moscow"].get("q2", 0), x["moscow"]["alpha"], x["moscow"]["q"])))
                    return bad
                state("share", 2021, F + "{ const out = {}; for (const [k, p] of [['russia', 'Russia'], ['moscow', 'Moscow'], ['central', 'Central Moscow (250 m)']]) { A.preset(p); out[k] = A.listedRule(); } window.__extra = out; A.preset('Moscow'); }", tag + "rules", rules_ok)
                def pair_ok(expect):
                    def chk(r):
                        x = r["extra"]
                        if not x or not x["AN"]: return [("pair", "tile", "no report or no anchors")]
                        bad = []; line = "The two firms of the film, %d m apart." % x["AN"]["distance"]
                        if x["AN"]["distance"] != 57 or x["AN"]["computed"] != 57: bad.append(("pair", "data", "the shipped distance is %s, the coordinates give %s" % (x["AN"]["distance"], x["AN"]["computed"])))
                        if x["kind"] not in ("firm", "listed"): bad.append(("pair", "hover", "no mark under the cursor: %s" % x["kind"]))
                        if (line in x["text"]) != expect: bad.append(("pair", "tile", "the line is %s: %s" % ("present" if expect is False else "absent", json.dumps(x["text"])[:200])))
                        if x["text"].count("film") > 1 or "Dental" in x["text"] or "dental" in x["text"]: bad.append(("pair", "tile", "more than the one line about the pair, or the neighbour described: %s" % json.dumps(x["text"])[:200]))
                        return bad
                    return chk
                state("share", 2021, F + "{ A.preset('Central Moscow (250 m)'); await A.ready(); const AN = A.anchors(); const h = A.hoverKm(AN.a[0], AN.a[1], { show: true }); window.__extra = { kind: h && h.kind, text: document.getElementById('tipbody').innerText, AN }; }", tag + "pair", pair_ok(True))
                state("share", 2021, F + "{ A.preset('Central Moscow (250 m)'); await A.ready(); const AN = A.anchors(); const h = A.hoverKm(AN.b[0], AN.b[1], { show: true }); window.__extra = { kind: h && h.kind, text: document.getElementById('tipbody').innerText, AN }; }", tag + "pairb", pair_ok(True))
                state("share", 2021, F + "{ A.preset('Central Moscow (250 m)'); await A.ready(); const AN = A.anchors(); const h = A.hoverKm(AN.a[0] + 0.1, AN.a[1], { show: true }); window.__extra = { kind: h && h.kind, text: document.getElementById('tipbody').innerText, AN }; }", tag + "pair100", pair_ok(False))
                # the pixel field (round 14, the author's decision of 25 October 2026): the video's per-pixel rule below the dots zoom, the dots from it, a crossfade over 1.4 x; the field's
                # cells sum the firms on no list in view (at the country, the year's whole file); on WebGL the composed image matches the CPU engine's within rounding; the hovered pixel's
                # figures equal an independent sum over every address of the year; the tile names the pixel
                def regime_ok(level):
                    def chk(r):
                        x = r["extra"]
                        if not x: return [("field", "regime", "no report")]
                        return [] if x.get("level") == level else [("field", "regime", "level %s (pixel %s, dots %s) at k %.3f, expected %s" % (x.get("level"), x.get("pix"), x.get("dots"), r["cam"]["k"], level))]
                    return chk
                state("share", 2024, F + "A.preset('Russia'); await A.ready(); A.redraw(); window.__extra = A.fieldRegime();", tag + "regpix", regime_ok("pixel"))
                state("industry", 2024, F + "A.preset('Moscow'); await A.ready(); A.redraw(); window.__extra = A.fieldRegime();", tag + "regpixc", regime_ok("pixel"))
                state("share", 2024, F + "A.preset('Russia'); await A.ready(); await A.jump({ cx: m[0], cy: m[1], k: A.fieldRegime().dotsK * 1.2 }); A.redraw(); window.__extra = A.fieldRegime();", tag + "regboth", regime_ok("both"))
                state("share", 2024, F + "A.preset('Central Moscow (250 m)'); await A.ready(); A.redraw(); window.__extra = A.fieldRegime();", tag + "regdots", regime_ok("dots"))
                def pix_ok(r):
                    x = r["extra"]; bad = []
                    if not x or not x.get("S"): return [("pixel", "stats", "no report")]
                    S = x["S"]
                    if S["sumN"] != S["inView"]: bad.append(("pixel", "sum", "the field's cells hold %s firms, the addresses in view %s" % (S["sumN"], S["inView"])))
                    if x.get("national") is not None and S["inView"] != x["national"]: bad.append(("pixel", "sum", "at the country the field holds %s of the year's %s firms on no list" % (S["inView"], x["national"])))
                    if S["gpuDiff"] is not None and S["gpuDiff"]["share"] > 0.005: bad.append(("pixel", "gpu", "%s of %s lit pixels differ from the CPU image by more than 2 levels" % (S["gpuDiff"]["bad"], S["gpuDiff"]["lit"])))
                    if S["blocks"][2] < 1 or S["blocks"][3] < 1: bad.append(("pixel", "blocks", "cells by block size %s" % S["blocks"]))
                    hp, ps = x["hp"], x["ps"]
                    if not hp or not ps: bad.append(("pixel", "hover", "no pixel under the cursor: %s" % json.dumps(x.get("hp"))))
                    elif (hp["n"], hp["a"], hp["p"]) != (ps["n"], ps["a"], ps["p"]): bad.append(("pixel", "hover", "the hovered pixel reads %s, the independent sum %s" % (json.dumps(hp), json.dumps(ps))))
                    if "Pixel at the cursor" not in x["tip"]: bad.append(("pixel", "tile", "the tile does not name the pixel: %s" % x["tip"][:120]))
                    return bad
                PIX = "await A.ready(); A.redraw(); const S = A.pixelStats(); { const c = A.camera(), AN = A.anchors(), at = c.k > 1 && AN ? AN.a : [m[0] + 30, m[1] - 20]; A.hoverKm(at[0], at[1], { show: true }); } const hp = A.hoverPixel(); const ps = hp ? A.pixelSum(hp.cell[0], hp.cell[1]) : null; window.__extra = { S, hp, ps, tip: document.getElementById('tipbody').innerText, national: %s }; if (A.hoverOff) A.hoverOff();"
                for lyr in ("share", "fin", "industry"):
                    state(lyr, 2025, F + "A.preset('Russia'); " + PIX % "MOTION_DATA.firms.by_year[2025].firms", tag + "pix" + lyr, pix_ok)
                state("share", 2024, F + "A.preset('Moscow'); " + PIX % "null", tag + "pixcity", pix_ok)
                # the opening sweep (once per tab at the country view; any input completes it) and the year dissolve (0.25 s; a camera move completes it)
                state("share", 2024, F + "A.preset('Russia'); await A.ready(); const s1 = A.sweep(true); window.dispatchEvent(new Event('pointerdown')); window.__extra = { s1, s2: A.sweep() };", tag + "sweep",
                      lambda r: [] if r["extra"] and r["extra"]["s1"]["on"] and not r["extra"]["s2"]["on"] else [("sweep", "state", "started %s, after a press %s" % (r["extra"] and json.dumps(r["extra"]["s1"]), r["extra"] and json.dumps(r["extra"]["s2"])))])
                state("share", 2023, F + "A.preset('Russia'); A.layer('share'); A.year(2024); await A.ready(); await new Promise(q => setTimeout(q, 300)); A.year(2023); const d0 = A.dissolve(); await A.ready(); await new Promise(q => setTimeout(q, 700)); window.__extra = { d0, d2: A.dissolve() };", tag + "dissolve",
                      lambda r: [] if r["extra"] and r["extra"]["d0"]["on"] and not r["extra"]["d2"]["on"] else [("dissolve", "state", json.dumps(r["extra"]))])
                state("share", 2021, F + "A.preset('Russia'); await A.ready(); const T = MOTION_DATA.treatednational; let lp = 0; for (let i = 0; i < T.n; i++) if (T.filed[i][7] !== '-') lp++; const n = A.firmsInView(); A.hoverKm(m[0], m[1], { show: true }); window.__extra = { n, expected: MOTION_DATA.firms.by_year[2021].firms + lp, tile: A.tile().firms, shown: !document.getElementById('tfirmsw').hidden, text: document.getElementById('tfirms').textContent };", tag + "inview",
                      lambda r: [] if r["extra"] and r["extra"]["n"] == r["extra"]["expected"] == r["extra"]["tile"] and r["extra"]["shown"] and r["extra"]["text"].replace(",", "") == str(r["extra"]["n"]) else [("tile", "firms", json.dumps(r["extra"]))])
                state("share", 2021, F + "A.preset('Moscow'); await A.ready(); const n = A.firmsInView(); A.mode('cells'); A.hoverKm(m[0], m[1], { show: true }); window.__extra = { n, national: MOTION_DATA.firms.by_year[2021].firms, shownInCells: !document.getElementById('tfirmsw').hidden }; A.mode('firms');", tag + "inviewcity",
                      lambda r: [] if r["extra"] and 0 < r["extra"]["n"] < r["extra"]["national"] and not r["extra"]["shownInCells"] else [("tile", "firms", json.dumps(r["extra"]))])
                # under prefers-reduced-motion the button highlights without animation: the count is there at once and the frame loop is not used
                cdp.call("Emulation.setEmulatedMedia", {"features": [{"name": "prefers-reduced-motion", "value": "reduce"}]})
                state("share", 2022, F + "A.preset('Moscow'); A.layer('share'); A.year(2022); await A.ready(); window.__extra = { pulsed: A.pulse(), expect: %s };" % (N22 % (2022, 8)), tag + "rmpulse", pulsed_is(2022, "under reduced motion the button still pulses (a still highlight)"))
                state("share", 2024, F + "A.preset('Russia'); await A.ready(); window.__extra = A.sweep(true);", tag + "rmsweep", lambda r: [] if r["extra"] and not r["extra"]["on"] else [("sweep", "motion", "the sweep ran under reduced motion: %s" % json.dumps(r["extra"]))])
                state("share", 2022, "A.mode('cells'); A.preset('Russia'); await A.ready(); A.pulse(); window.__extra = A.cellPulseState(); A.cellPulseAt(null);", tag + "rmcpulse", lambda r: [] if r["extra"] and r["extra"]["static"] and r["extra"]["count"] > 0 else [("cpulse", "motion", "under reduced motion the Cells pulse is not the still highlight: %s" % json.dumps(r["extra"])[:160])])
                cdp.call("Emulation.setEmulatedMedia", {"features": [{"name": "prefers-reduced-motion", "value": ""}]})
            F0 = cdp.evaluate("window.__atlas.field()", await_promise=False); fields.add(F0)
            firms_states(GL if F0 in GL else ("2d",), "firms")
            # a lost context falls back to the 2D field and a restored one returns to WebGL (on a page that had it)
            state("share", 2021, F + "A.preset('Moscow'); A.loseContext(); await new Promise(r => setTimeout(r, 300));", "flost", field_is(("2d",), "after a lost context the 2D fallback draws"))
            state("share", 2021, F + "A.preset('Moscow'); A.restoreContext(); await new Promise(r => setTimeout(r, 600));", "frestore", field_is(GL if F0 in GL else ("2d",), "after a restored context WebGL draws again"))
            # a narrower viewport: every canvas follows the map's new size
            if w >= 768:
                cdp.call("Emulation.setDeviceMetricsOverride", {"width": w - 200, "height": a.height, "deviceScaleFactor": 1, "mobile": False}); time.sleep(0.4)
                state("share", 2021, F + "A.preset('Moscow');", "fresize", lambda r: [] if r["canvases"]["map"]["w"] < P["W"] and round(r["canvases"]["map"]["w"]) == r["canvases"]["marks"]["w"] and round(r["canvases"]["map"]["h"]) == r["canvases"]["marks"]["h"] else [("resize", "map", "after a resize the canvases are %s (the map was %s wide)" % (json.dumps(r["canvases"]), P["W"]))])
                cdp.call("Emulation.setDeviceMetricsOverride", {"width": w, "height": a.height, "deviceScaleFactor": 1, "mobile": False}); time.sleep(0.4)
            # the same firms states on the 2D fallback
            cdp.call("Page.navigate", {"url": url + "&__nogl=1"}); cdp.wait_event("Page.loadEventFired", timeout=60)
            cdp.evaluate("document.fonts.ready.then(() => true)", await_promise=True, timeout=60); time.sleep(0.5)
            fields.add(cdp.evaluate("window.__atlas.field()", await_promise=False))
            firms_states(("2d",), "nogl")
            cdp.call("Page.navigate", {"url": url}); cdp.wait_event("Page.loadEventFired", timeout=60)
            cdp.evaluate("document.fonts.ready.then(() => true)", await_promise=True, timeout=60); time.sleep(0.5)
            # the legend and the note, collapsed and expanded, at the national and the Moscow views
            state("share", 2021, "A.mode('cells'); A.preset('Russia'); A.legend(true); A.note(true);", "open")
            state("share", 2021, "A.mode('cells'); A.preset('Moscow'); A.legend(true); A.note(true);", "open")
            state("share", 2021, "A.mode('firms'); A.preset('Moscow'); A.legend(true); A.note(true);", "fopen")
            state("share", 2021, "A.mode('cells'); A.preset('Russia'); A.legend(false); A.note(false);", "closed")
            state("share", 2021, "A.mode('cells'); A.preset('Russia'); A.legend(null); A.note(null);", "-")
            # hash links keep their meaning (round 10): #Moscow opens the Cells view at the Moscow preset, #Moscow-firms the Firms view there; the theme: a browser that prefers light
            # still opens dark, and a remembered light choice draws the first frame light (the read-order fix)
            qsep = "&" if "?" in url else "?"
            near_px = lambda px, rgb, tol=4: all(abs(px[i] - rgb[i]) <= tol for i in range(3))   # the canvas rounds the stage colour by a unit or two
            def wait_atlas():   # the page defines window.__atlas after its data scripts have run; wait for it, then the fonts
                t0 = time.time()
                while time.time() - t0 < 60:
                    if cdp.evaluate("typeof window.__atlas === 'object' && document.readyState === 'complete'", await_promise=False): break
                    time.sleep(0.3)
                cdp.evaluate("document.fonts.ready.then(() => true)", await_promise=True, timeout=60); time.sleep(0.6)
            if w in (400, 1600):
                # an anniversary load (round 12, part D, item 6): with the page's date pinned to the anchor firm's day the wire's lead item ends with the sentence and the lead slot keeps the fact alone
                sid = cdp.call("Page.addScriptToEvaluateOnNewDocument", {"source": "window.__today = '2026-05-19';"})["identifier"]
                cdp.call("Page.navigate", {"url": url + qsep + "v=anniv"}); cdp.wait_event("Page.loadEventFired", timeout=60); wait_atlas()
                r = cdp.evaluate("(async () => { const A = window.__atlas; A.strip(true); await A.ready(); await new Promise(r => setTimeout(r, 450)); const wv = A.wire(); return { today: A.today(), lead: wv.items.length ? wv.items[0].text : '', slot: A.context().text, src: wv.items.length ? wv.items[0].src : '' }; })()", await_promise=True, timeout=60)
                n_states += 1; exp_line = WC.anniversary(WIRE_DATA, "2026-05-19")
                if r["today"] != "2026-05-19" or not r["lead"].endswith(". " + exp_line) or exp_line in r["slot"] or not r["src"].endswith("+anniversary"): findings.append("%-11s width %d  on the anchor firm's day: %s" % ("anniversary", w, json.dumps(r)[:300]))
                cdp.call("Page.removeScriptToEvaluateOnNewDocument", {"identifier": sid})
                VIEW = {"cx": mx + 12.3, "cy": my - 4.5, "k": 7.25}
                cdp.call("Page.navigate", {"url": url + qsep + "v=view"}); cdp.wait_event("Page.loadEventFired", timeout=60); wait_atlas()
                vh = cdp.evaluate("(async () => { const A = window.__atlas; A.layer('fin'); A.year(2022); A.mode('firms'); await A.jump(%s); return A.viewHash(); })()" % json.dumps(VIEW), await_promise=True, timeout=60)
                if not re.match(r"^[A-Za-z0-9._~-]+$", vh): findings.append("%-11s width %d  the address %r holds characters the host does not pass on (letters, digits and . _ ~ - only)" % ("link", w, vh))
                p = vh.split("_"); vh_old = "/".join(p[:3]) + "/" + ",".join(p[3:5]) + "/" + p[5] if len(p) == 6 else vh   # the first build's slash form still opens the view
                for k, frag in enumerate((vh, vh_old)):
                    cdp.call("Page.navigate", {"url": url + qsep + "v=view%d#" % (k + 2) + frag}); cdp.wait_event("Page.loadEventFired", timeout=60); wait_atlas()
                    r = cdp.evaluate("(() => { const A = window.__atlas; const mb = document.querySelector('#modes button[aria-pressed=\"true\"]'), lb = document.querySelector('#layers button[aria-pressed=\"true\"]'); return { mode: mb && mb.dataset.mode, layer: lb && lb.dataset.id, year: document.getElementById('year').value, cam: A.camera(), hash: location.hash }; })()", await_promise=False)
                    n_states += 1
                    if r["mode"] != "firms" or r["layer"] != "fin" or r["year"] != "2022" or not same_cam(r["cam"], VIEW, 0.002, 1e-5): findings.append("%-11s width %d  the address %s reopened %s, expected the Firms view, fin, 2022 at %s" % ("link", w, frag, json.dumps(r), json.dumps(VIEW)))
                for frag, mode in (("#Moscow", "cells"), ("#Moscow-firms", "firms")):
                    # a new document URL each time (a fragment-only navigation fires no load event), then the page's own readiness
                    cdp.call("Page.navigate", {"url": url + qsep + "v=hash" + mode + frag}); cdp.wait_event("Page.loadEventFired", timeout=60); wait_atlas()
                    r = cdp.evaluate("(() => { const A = window.__atlas; const mb = document.querySelector('#modes button[aria-pressed=\"true\"]'), lb = document.querySelector('#layers button[aria-pressed=\"true\"]'); return { mode: mb && mb.dataset.mode, layer: lb && lb.dataset.id, year: document.getElementById('year').value, cam: A.camera() }; })()", await_promise=False)
                    n_states += 1
                    if r["mode"] != mode or r["layer"] != "industry" or r["year"] != "2024" or not same_cam(r["cam"], P["moscow"]): findings.append("%-11s width %d  %s opened %s, expected %s at the Moscow preset on industry 2024" % ("hash", w, frag, json.dumps(r), mode))
                cdp.call("Emulation.setEmulatedMedia", {"features": [{"name": "prefers-color-scheme", "value": "light"}]})
                cdp.call("Page.navigate", {"url": url + qsep + "v=themeA"}); cdp.wait_event("Page.loadEventFired", timeout=60); wait_atlas()
                r = cdp.evaluate("(() => ({ scheme: getComputedStyle(document.documentElement).getPropertyValue('--scheme').trim(), px: Array.from(document.getElementById('map').getContext('2d').getImageData(1, 1, 1, 1).data), stage: getComputedStyle(document.documentElement).getPropertyValue('--stage').trim(), button: document.getElementById('theme').textContent }))()", await_promise=False)
                n_states += 1
                st_rgb = tuple(int(r["stage"].lstrip("#")[i:i + 2], 16) for i in (0, 2, 4)) if re.match(r"^#[0-9A-Fa-f]{6}$", r["stage"]) else (-99, -99, -99)   # the page's own dark stage (round 15 made it a step darker)
                if r["scheme"] != "dark" or not near_px(r["px"], st_rgb) or r["button"] != "Light theme": findings.append("%-11s width %d  a browser preferring light did not open dark: %s" % ("theme", w, json.dumps(r)))
                cdp.call("Emulation.setEmulatedMedia", {"features": [{"name": "prefers-color-scheme", "value": "dark"}]})
                sid = cdp.call("Page.addScriptToEvaluateOnNewDocument", {"source": "try { localStorage.setItem('atlas-theme', 'light'); } catch (e) {}"})["identifier"]
                cdp.call("Page.navigate", {"url": url + qsep + "v=themeB"}); cdp.wait_event("Page.loadEventFired", timeout=60); wait_atlas()
                r = cdp.evaluate("(() => ({ scheme: getComputedStyle(document.documentElement).getPropertyValue('--scheme').trim(), px: Array.from(document.getElementById('map').getContext('2d').getImageData(1, 1, 1, 1).data), button: document.getElementById('theme').textContent, data: document.documentElement.getAttribute('data-theme'), stage: getComputedStyle(document.documentElement).getPropertyValue('--stage').trim() }))()", await_promise=False)
                n_states += 1
                lt_rgb = tuple(int(r["stage"].lstrip("#")[i:i + 2], 16) for i in (0, 2, 4)) if re.match(r"^#[0-9A-Fa-f]{6}$", r["stage"]) else (-99, -99, -99)   # the page's own light stage (#FBFBF9 since the sea and land swap of 26 October 2026; #EDF1F5 in round 15, white before)
                if r["scheme"] != "light" or not near_px(r["px"], lt_rgb) or r["button"] != "Dark theme" or r["data"] != "light": findings.append("%-11s width %d  a remembered light choice did not draw the first frame light: %s" % ("theme", w, json.dumps(r)))
                cdp.call("Page.removeScriptToEvaluateOnNewDocument", {"identifier": sid}); cdp.evaluate("(() => { try { localStorage.removeItem('atlas-theme'); } catch (e) {} return true; })()", await_promise=False)
                sid = cdp.call("Page.addScriptToEvaluateOnNewDocument", {"source": "try { localStorage.setItem('atlas-method', 'open'); localStorage.setItem('atlas-method-more', 'open'); } catch (e) {}"})["identifier"]
                cdp.call("Page.navigate", {"url": url + qsep + "v=method"}); cdp.wait_event("Page.loadEventFired", timeout=60); wait_atlas()
                r = cdp.evaluate("window.__atlas.methodState()", await_promise=False); n_states += 1
                if not (r["open"] and r["more"] and r["moreLabel"] == "Less"): findings.append("%-11s width %d  a remembered open method block did not open expanded at load: %s" % ("method", w, json.dumps(r)[:200]))
                cdp.call("Page.removeScriptToEvaluateOnNewDocument", {"identifier": sid}); cdp.evaluate("(() => { try { localStorage.removeItem('atlas-method'); localStorage.removeItem('atlas-method-more'); } catch (e) {} return true; })()", await_promise=False)
                # a collapsed card is remembered per viewer (the author's addition of 25 October): the groups card closed in storage opens the page with that card collapsed and the others open
                sid = cdp.call("Page.addScriptToEvaluateOnNewDocument", {"source": "try { localStorage.setItem('atlas-card-groups', 'closed'); } catch (e) {}"})["identifier"]
                cdp.call("Page.navigate", {"url": url + qsep + "v=cards"}); cdp.wait_event("Page.loadEventFired", timeout=60); wait_atlas()
                r = cdp.evaluate("window.__atlas.cards()", await_promise=False); n_states += 1
                if r.get("groups") is not False or not all(v for k, v in r.items() if k != "groups"): findings.append("%-11s width %d  a remembered collapsed card did not load collapsed with the others open: %s" % ("card", w, json.dumps(r)))
                cdp.call("Page.removeScriptToEvaluateOnNewDocument", {"identifier": sid}); cdp.evaluate("(() => { try { localStorage.removeItem('atlas-card-groups'); } catch (e) {} return true; })()", await_promise=False)
            # ---- round 15 (26 October 2026) ----------------------------------------------------------------------------------------------------------
            # the reading blocks (the author's i rule): every card's i opened, each block under its title row and inside its card
            def reads_ok(r):
                x = r.get("extra") or {}; bad = []
                for f in x.get("bad", []): bad.append(("reads", "dom", f))
                return bad
            state("share", 2021, "A.mode('cells'); A.preset('Russia'); if (A.popout) A.popout(null); const ids = ['goto', 'cursor', 'odds', 'national', 'groups']; for (const id of ids) { const b = document.getElementById('ci-' + id); if (b.getAttribute('aria-expanded') !== 'true') b.click(); } { const mb = document.getElementById('methodbtn'); if (mb.getAttribute('aria-expanded') !== 'true') mb.click(); } await A.ready(); const bad = []; for (const id of ids.concat(['layer'])) { const blk = document.getElementById(id === 'layer' ? 'method' : 'cr-' + id), card = document.getElementById('card-' + id), head = document.getElementById('ch-' + id); if (blk.hidden) { bad.push(id + ': the block did not open'); continue; } const b = blk.getBoundingClientRect(), c = card.getBoundingClientRect(), h = head.getBoundingClientRect(); if (b.top < h.bottom - 0.5 || b.left < c.left - 0.5 || b.right > c.right + 0.5) bad.push(id + ': the block is not under the title row inside the card'); if (/;/.test(blk.textContent)) bad.push(id + ': a semicolon in the block'); } window.__extra = { bad }; for (const id of ids) { const b = document.getElementById('ci-' + id); if (b.getAttribute('aria-expanded') === 'true') b.click(); } { const mb = document.getElementById('methodbtn'); if (mb.getAttribute('aria-expanded') === 'true') mb.click(); }", "reads", reads_ok)
            # the pop-out (item 5.4): each chart enlarged over the map above 900 px, none on the phone layout; inside the map, above the strip, joined to its card
            for pid in ("odds", "national", "groups"):
                def pop_ok(r, pid=pid):
                    d = r["dom"]; want = w > 900
                    if bool(d.get("popId")) != want or (want and not (d.get("popout") or {}).get("visible")): return [("popout", "dom", "%s: open %s at %d px, expected %s" % (pid, d.get("popId"), w, want))]
                    return []
                state("share", 2021, "A.mode('cells'); A.preset('Russia'); A.card('%s', true); A.popout('%s'); await new Promise(r => setTimeout(r, 250));" % (pid, pid), "pop-" + pid, pop_ok)
            cdp.evaluate("(() => { window.__atlas.popout(null); return true; })()", await_promise=False)
            # the profiles (item 9): the page's texts against their re-derivation from the data, and every text inside its box at this width
            prof = cdp.evaluate("JSON.stringify(window.__atlas.profiles())", await_promise=False); fit = cdp.evaluate("JSON.stringify(window.__atlas.profileFit())", await_promise=False); n_states += 1
            fj = json.loads(fit)
            if (w < 600) != bool(fj.get("narrow")) or fj.get("shown"): findings.append("%-11s width %d  the tile's profile box on a %s map: %s" % ("profile", w, "narrow" if w < 600 else "wide", fit[:160]))
            for f in PC.check(json.loads(prof), os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data"), json.loads(fit)): findings.append("%-11s width %d  %s" % ("profile", w, " | ".join(str(x) for x in f)[:240]))
            # the wire (item 3): Tomorrow resolved on a wire item, "(treated)" only on the five-list group, and the cat key's item from the pool
            doc = cdp.call("DOM.getDocument", {"depth": 1})["root"]["nodeId"]
            nid = cdp.call("DOM.querySelector", {"nodeId": doc, "selector": "#wiretrack .wi"})["nodeId"]
            if nid:
                fams = [f["familyName"] for f in cdp.call("CSS.getPlatformFontsForNode", {"nodeId": nid})["fonts"]]
                if not any("Tomorrow" in f for f in fams): findings.append("%-11s width %d  a wire item rendered with %s" % ("font", w, fams))
            wi = cdp.evaluate("(() => window.__atlas.wire().items.map(i => i.text))()", await_promise=False) or []; n_states += 1
            for t in wi:
                if t and re.search(r"(sanctions list|strategic list|sanctions-list members|list members)[^.]*\(treated\)", t): findings.append("%-11s width %d  a single list glossed (treated): %s" % ("wire", w, t[:80]))
            ck = cdp.evaluate("(async () => { const A = window.__atlas; A.mode('cells'); A.strip(true); A.preset('Russia'); await A.ready(); await new Promise(r => setTimeout(r, 400)); const ok = A.catNow(); const el = document.querySelector('#wiretrack .wi.keyed'); const pv = el ? el.previousElementSibling : null, cats = [...document.querySelectorAll('#wiretrack .wi.cat')].map(e => { const q = e.previousElementSibling; return !!(q && q.classList.contains('catsep') && q.querySelector('use') && q.querySelector('use').getAttribute('href') === '#mark-cat'); }); return { ok, keyed: A.extras().keyed, text: el ? el.textContent : null, src: el ? el.dataset.src : null, prevCat: !!(pv && pv.classList.contains('catsep')), catsHeaded: cats.length ? cats.every(Boolean) : null }; })()", await_promise=True, timeout=60); n_states += 1
            pool = {f["id"]: f["text"] for f in WIRE_DATA["offwire"]["facts"]} if WIRE_DATA.get("offwire") else {}
            if w == int(a.widths.split(",")[0]) and not a.skip_once:   # once per audit, at the run's first width
                for f in AG.check(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')): findings.append("%-11s %s" % ("agent-guide", " | ".join(f)[:200]))
            if not ck.get("ok") or ck.get("keyed") != 1 or not ck.get("src") or int(ck["src"].split(":")[1]) not in pool or pool[int(ck["src"].split(":")[1])] not in (ck.get("text") or "") or not ck.get("prevCat") or ck.get("catsHeaded") is False or "OFF THE WIRE" in (ck.get("text") or "").upper(): findings.append("%-11s width %d  the cat key's item: %s" % ("wire", w, json.dumps(ck)[:200]))
            # TEACH YOUR AGENT (round 15, the author's item 19 as revised on 26 October 2026; round 17: a link in place of the text once tools/agent_guide.py sets one): the copied text equals the guide built into the page, or its link, the notice reads
            # ">text copied", and no request leaves the page; with the clipboard refused, the guide shows in a read-only field, selected, and Escape closes it
            cdp.call("Network.enable"); cdp.events.append({"method": "__teach__"})
            tg = cdp.evaluate("(async () => { const sleep = ms => new Promise(r => setTimeout(r, ms)), b = document.getElementById('teachagent'), out = {}; if (!b) return { missing: true }; const wt = navigator.clipboard.writeText; let got = null; navigator.clipboard.writeText = t => { got = t; return Promise.resolve(); }; b.click(); await sleep(300); const ts = document.getElementById('agenttoast'); out.same = got === (window.AGENT_GUIDE_URL || window.AGENT_GUIDE) && !!window.AGENT_GUIDE; out.toast = !ts.hidden && ts.textContent === (window.AGENT_GUIDE_URL ? '>link copied' : '>text copied'); out.mailIcon = !!document.getElementById('copymail'); await sleep(2000); out.toastGone = ts.hidden; navigator.clipboard.writeText = () => Promise.reject(new Error('refused')); b.click(); await sleep(300); const f = document.getElementById('agenttext'); out.field = !document.getElementById('agentbox').hidden && f.readOnly && f.value === (window.AGENT_GUIDE_URL || window.AGENT_GUIDE) && f.selectionStart === 0 && f.selectionEnd === f.value.length; document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); out.closed = document.getElementById('agentbox').hidden; navigator.clipboard.writeText = wt; await sleep(200); return out; })()", await_promise=True, timeout=60); n_states += 1
            cdp.evaluate("1"); k0 = max(i for i, e in enumerate(cdp.events) if e.get("method") == "__teach__")
            sent = [e["params"]["request"]["url"] for e in cdp.events[k0:] if e.get("method") == "Network.requestWillBeSent"]
            cdp.call("Network.disable")
            if not tg or tg.get("missing") or not all(tg.get(k) for k in ("same", "toast", "mailIcon", "toastGone", "field", "closed")): findings.append("%-11s width %d  TEACH YOUR AGENT: %s" % ("agent", w, json.dumps(tg)[:200]))
            if sent: findings.append("%-11s width %d  TEACH YOUR AGENT sent %d request(s): %s" % ("agent", w, len(sent), ", ".join(sent)[:200]))
            # the footer's buttons (round 17, the author's request of 27 October 2026): the email copy, TEACH YOUR AGENT and the two square buttons to X, wherever two share a line, share its centre
            fb = cdp.evaluate("(() => { const els = [...document.querySelectorAll('footer #copymail, footer #teachagent, footer a.btn.sq')].map(e => { const r = e.getBoundingClientRect(); return { id: e.id || e.getAttribute('aria-label'), t: r.top, b: r.bottom }; }); const bad = []; for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) { const p = els[i], q = els[j]; if (Math.min(p.b, q.b) - Math.max(p.t, q.t) <= 0) continue; const d = Math.abs((p.t + p.b) / 2 - (q.t + q.b) / 2); if (d > 0.5) bad.push(p.id + ' and ' + q.id + ': centres ' + d.toFixed(2) + ' px apart'); } return { n: els.length, bad }; })()", await_promise=False)
            if fb["n"] != 4: findings.append("%-11s width %d  the footer has %d of its four buttons" % ("footer", w, fb["n"]))
            for b in fb["bad"]: findings.append("%-11s width %d  the footer's buttons are off their line: %s" % ("footer", w, b))
            # the REFERENCES panel (round 16): see refs_block; the once-per-audit part at the run's first width
            if not a.only or any(t in "refs" for t in a.only.split(",")):
                findings += refs_block(cdp, w, a, w == int(a.widths.split(",")[0]) and (not a.skip_once or a.refs_once), open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "explorer.html"), encoding="utf-8").read()); n_states += 1
            # the minimap's four corner marks in the neon green at the country and at a city (round 15, the author's general point 4)
            if w > 900:
                cm = cdp.evaluate("(async () => { const A = window.__atlas, col = () => { const p = document.querySelector('#mm-russia path'); return p ? getComputedStyle(p).stroke : null; }, want = getComputedStyle(document.documentElement).getPropertyValue('--context').trim(); A.preset('Russia'); await A.ready(); const atFit = col(); A.preset('Kazan'); await A.ready(); const atCity = col(); A.preset('Russia'); await A.ready(); const hex = c => { const m = /rgba?\\((\\d+), (\\d+), (\\d+)/.exec(c || ''); return m ? '#' + [m[1], m[2], m[3]].map(v => (+v).toString(16).padStart(2, '0')).join('').toUpperCase() : c; }; return { want: want.toUpperCase(), atFit: hex(atFit), atCity: hex(atCity) }; })()", await_promise=True, timeout=60); n_states += 1
                if not cm or cm.get("atFit") != cm.get("want") or cm.get("atCity") != cm.get("want"): findings.append("%-11s width %d  the minimap's corner marks are not green at every view: %s" % ("minimap", w, json.dumps(cm)))
            # the extras (item 7): the blink alternates the year shown and returns it, holding the wire; the run steps the years and stops
            bk = cdp.evaluate("(async () => { const A = window.__atlas, sleep = ms => new Promise(r => setTimeout(r, ms)); A.mode('cells'); A.layer('share'); A.year(2024); await A.ready(); const b0 = A.wire().builds, seen = new Set(); A.blink(true); for (let i = 0; i < 8; i++) { await sleep(400); seen.add(document.getElementById('yearlabel').textContent); } const hold = A.extras().wireHold; A.blink(false); await sleep(200); return { seen: [...seen], hold, back: document.getElementById('yearlabel').textContent, slider: document.getElementById('year').value, builds: A.wire().builds - b0, on: A.extras().blink }; })()", await_promise=True, timeout=60); n_states += 1
            if sorted(bk.get("seen", [])) != ["2021", "2024"] or not bk.get("hold") or bk.get("back") != "2024" or bk.get("slider") != "2024" or bk.get("builds") != 0 or bk.get("on"): findings.append("%-11s width %d  the blink: %s" % ("extras", w, json.dumps(bk)))
            rn = cdp.evaluate("(async () => { const A = window.__atlas, sleep = ms => new Promise(r => setTimeout(r, ms)); A.mode('cells'); A.layer('share'); A.year(2016); await A.ready(); document.getElementById('yearrun').click(); await sleep(2600); const mid = +document.getElementById('year').value, hold = A.extras().wireHold; document.getElementById('yearrun').click(); await sleep(100); return { mid, hold, after: A.extras() }; })()", await_promise=True, timeout=60); n_states += 1
            if not (2017 <= rn.get("mid", 0) <= 2019) or not rn.get("hold") or rn["after"].get("run") or rn["after"].get("wireHold"): findings.append("%-11s width %d  the year run: %s" % ("extras", w, json.dumps(rn)))
            cdp.evaluate("(() => { const A = window.__atlas; A.year(2024); return true; })()", await_promise=False)
            # the hidden-frame load (round 11, item 7): the page loaded with the root hidden for 500 ms, then shown without a window resize event; every load-time layout
            # must then match the normal load's (the stage, the fitted zoom and the landing camera, the minimap's label boxes, the wire's track, the strip's test, the obstacles)
            hid = cdp.call("Page.addScriptToEvaluateOnNewDocument", {"source": "document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.display = 'none'; setTimeout(() => { document.documentElement.style.display = ''; }, 500); });"})["identifier"]
            cdp.call("Page.navigate", {"url": url + "&v=hidden"}); cdp.wait_event("Page.loadEventFired", timeout=60)
            cdp.evaluate("document.fonts.ready.then(() => true)", await_promise=True, timeout=60); time.sleep(2.0)
            L1 = cdp.evaluate("(async () => { await window.__atlas.ready(); await new Promise(r => setTimeout(r, 300)); return window.__atlas.layouts(); })()", await_promise=True, timeout=60)
            cdp.call("Page.removeScriptToEvaluateOnNewDocument", {"identifier": hid}); n_states += 1
            hb = []
            if L1["stage"] != L0["stage"]: hb.append("stage %s against %s" % (L1["stage"], L0["stage"]))
            if abs(L1["kfit"] / L0["kfit"] - 1) > 1e-9: hb.append("kfit %s against %s" % (L1["kfit"], L0["kfit"]))
            if not same_cam(L1["cam"], L0["cam"], 1e-6, 1e-9): hb.append("landing camera %s against %s" % (json.dumps(L1["cam"]), json.dumps(L0["cam"])))
            if L1["minimap"]["width"] != L0["minimap"]["width"] or abs(L1["minimap"]["boxes"] - L0["minimap"]["boxes"]) > 1: hb.append("minimap %s against %s" % (json.dumps(L1["minimap"]), json.dumps(L0["minimap"])))
            if L1["wire"]["vis"] != L0["wire"]["vis"] or (L0["wire"]["width"] and not (L1["wire"]["width"] and abs(L1["wire"]["width"] - L0["wire"]["width"]) < 2)): hb.append("wire %s against %s" % (json.dumps(L1["wire"]), json.dumps(L0["wire"])))
            if L1["strip"] != L0["strip"] or L1["obstacles"] != L0["obstacles"]: hb.append("strip %s obstacles %s against %s and %s" % (json.dumps(L1["strip"]), L1["obstacles"], json.dumps(L0["strip"]), L0["obstacles"]))
            if not any(v["reason"] == "resize" for v in L1["verified"]): hb.append("no layout verification ran after the frame was shown: %s" % json.dumps(L1["verified"]))
            for b in hb: findings.append("%-11s width %d  %s" % ("hiddenload", w, b))
            late = cdp.problems[p_load:]   # round 17: the session's errors and warnings after the load (cdp.py records them all; only the load's had been read)
            if late: findings.append("%-11s width %d  %d error(s) or warning(s) after the load: %s" % ("console", w, len(late), json.dumps(late)[:300]))
        finally:
            proc.terminate()
            try: proc.wait(timeout=20)
            except subprocess.TimeoutExpired: proc.kill(); proc.wait(timeout=10)
            remove_profile(profile)   # each width's Brave profile goes with its browser (they had piled up in /tmp, a tmpfs here)
    head = "atlas audit: %d states, %d boxes, %d finding(s); field renderers seen: %s; tiles placed over the note or the legend for want of a clear place: %d (%s)" % (n_states, n_boxes, len(findings), ", ".join(sorted(fields)), n_relaxed, " ".join(relaxed))
    text = "\n".join([head] + sorted(set(findings))) + "\n"
    if a.out:
        with open(a.out, "w") as fh: fh.write(text)
    sys.stdout.write(text)
    return 1 if findings else 0

if __name__ == "__main__":
    sys.exit(main())
