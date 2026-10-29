#!/usr/bin/env python3
"""Whether the five-width audit of an earlier build carries over to the current one (round 24, the author's approval of 29 October 2026).

The publish gate's audit counts for a later build when that build differs from the audited one only in text strings. tools/publish.sh
--audited X runs this in place of the audit, after the text rules (publish-set.py --texts), and stops when it refuses. Four checks:
  1. X passed a full five-width audit with zero findings: tools/audit_five.py records such a run in build/audit/passed.json, only when the
     shipped sources were committed and unchanged from start to end and the served page was the working tree's.
  2. X is an ancestor of the build (HEAD, or --trial).
  3. The shipped sources differ from X only inside string literals: the scripts are compared token by token with every string's contents
     masked (comments and spacing ignored), so a changed name, number, regular expression or structure refuses; the pages with their text
     and their title, aria-label, alt and placeholder values masked, their styles and attributes compared as they are; of the data, only
     the glossary's strings may change. The stylesheet, the fonts and any other data file must be unchanged.
  4. change-proof.py --base X: no new rule hit, no change in the map outside its panels, and every panel whose frames differ holds a
     changed text (a card's change may move the side column's other cards; text with no layout, such as the guide, a tooltip or an
     aria-label, changes no frame). The proof shoots 1,600 and 400 px.
Usage: audit_carry.py X [--trial COMMIT] [--skip-proof]   (exit 0: the audit on X counts; 1: refused, with the reasons)
       audit_carry.py --strings X [Y]                    (check 3 alone, Y the working tree by default)"""
import json, os, re, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__)); MOTION = os.path.normpath(os.path.join(HERE, "..")); LAB = os.path.dirname(MOTION)
PASSED = os.path.join(MOTION, "build", "audit", "passed.json")
SHIPPED = ("motion/explorer.html", "motion/explainer.html", "motion/js", "motion/css", "motion/fonts", "motion/data")
TEXT_DATA = ("motion/data/glossary.json",)   # data files whose strings are text; their provenance and checks are records that follow them
TEXT_ATTRS = ("title", "aria-label", "alt", "placeholder")

def git(*a, check=True): return subprocess.run(["git"] + list(a), cwd=LAB, capture_output=True, text=True, check=check).stdout

# ---- check 3: strings only -----------------------------------------------------------------------------------------------------
REGEX_AFTER = set("(,=:[!&|?{};+-*%<>~^")
REGEX_KW = {"return", "typeof", "case", "do", "else", "in", "of", "new", "delete", "void", "throw", "instanceof", "yield", "await"}
IDENT = re.compile(r"[A-Za-z_$][\w$]*"); NUM = re.compile(r"\d[\w.]*|\.\d[\w]*")
PUNCT = re.compile(r">>>=|\.\.\.|===|!==|\*\*=|<<=|>>=|>>>|=>|==|!=|<=|>=|&&|\|\||\?\?|\?\.|\+\+|--|\+=|-=|\*=|/=|%=|&=|\|=|\^=|\*\*|<<|>>|[^\s]")

def skip_quoted(s, i):   # s[i] is the quote; the index after the closing one
    q, j, n = s[i], i + 1, len(s)
    while j < n and s[j] != q: j += 2 if s[j] == "\\" else 1
    return j + 1
def lex_js(s, out=None):   # [(kind, text)]: S a string's contents, I a name, N a number, R a regular expression, P punctuation, T a template's frame
    out = [] if out is None else out; i, n, prev = 0, len(s), None
    while i < n:
        c = s[i]
        if c.isspace(): i += 1; continue
        if s.startswith("//", i): j = s.find("\n", i); i = n if j < 0 else j; continue
        if s.startswith("/*", i): j = s.find("*/", i + 2); i = n if j < 0 else j + 2; continue
        if c in "'\"": j = skip_quoted(s, i); out.append(("S", s[i + 1:j - 1])); i = j; prev = ("S", ""); continue
        if c == "`": i = lex_template(s, i, out); prev = ("S", ""); continue
        if c == "/" and (prev is None or (prev[0] == "P" and prev[1][-1] in REGEX_AFTER) or (prev[0] == "I" and prev[1] in REGEX_KW)):
            j, cls = i + 1, False
            while j < n and s[j] != "\n":
                if s[j] == "\\": j += 2; continue
                if s[j] == "[": cls = True
                elif s[j] == "]": cls = False
                elif s[j] == "/" and not cls: break
                j += 1
            j += 1
            while j < n and s[j].isalpha(): j += 1
            out.append(("R", s[i:j])); i = j; prev = ("R", ""); continue
        m = IDENT.match(s, i)
        if m: out.append(("I", m.group(0))); prev = out[-1]; i = m.end(); continue
        m = NUM.match(s, i)
        if m: out.append(("N", m.group(0))); prev = out[-1]; i = m.end(); continue
        m = PUNCT.match(s, i); out.append(("P", m.group(0))); prev = out[-1]; i = m.end()
    return out
def expr_end(s, i):   # the index of the } that closes a template's ${ opened before i
    depth, n = 0, len(s)
    while i < n:
        c = s[i]
        if c in "'\"": i = skip_quoted(s, i); continue
        if c == "`": i = lex_template(s, i, []); continue
        if s.startswith("//", i): j = s.find("\n", i); i = n if j < 0 else j; continue
        if s.startswith("/*", i): j = s.find("*/", i + 2); i = n if j < 0 else j + 2; continue
        if c == "{": depth += 1
        elif c == "}":
            if depth == 0: return i
            depth -= 1
        i += 1
    return n
def lex_template(s, i, out):   # s[i] is the backtick; the literal parts are strings, each ${ } expression is code
    out.append(("T", "`")); j, n, lit = i + 1, len(s), []
    while j < n:
        c = s[j]
        if c == "\\": lit.append(s[j:j + 2]); j += 2; continue
        if c == "`": out.append(("S", "".join(lit))); out.append(("T", "`")); return j + 1
        if c == "$" and s.startswith("${", j):
            out.append(("S", "".join(lit))); lit = []; e = expr_end(s, j + 2); out.append(("T", "${")); lex_js(s[j + 2:e], out); out.append(("T", "}")); j = e + 1; continue
        lit.append(c); j += 1
    return n
def lex_html(s):   # the page's tokens: inline scripts as code, styles verbatim, text and the text attributes as strings
    out, i = [], 0
    for m in re.finditer(r"<!--.*?-->|<(script|style)\b([^>]*)>(.*?)</\1\s*>|<[^>]+>", s, re.S):
        text = s[i:m.start()].strip()
        if text: out.append(("S", re.sub(r"\s+", " ", text)))
        i = m.end(); tok = m.group(0)
        if tok.startswith("<!--"): continue
        if m.group(1) == "script": out.append(("H", "<script" + m.group(2) + ">")); lex_js(m.group(3), out); continue
        if m.group(1) == "style": out.append(("H", "<style" + m.group(2) + ">" + re.sub(r"\s+", " ", m.group(3)).strip())); continue
        parts = re.split(r"""(\b(?:%s)\s*=\s*)("[^"]*"|'[^']*')""" % "|".join(TEXT_ATTRS), tok)
        for k, p in enumerate(parts):
            if k % 3 == 2: out.append(("S", p[1:-1]))
            elif p: out.append(("H", re.sub(r"\s+", " ", p)))
    text = s[i:].strip()
    if text: out.append(("S", text))
    return out
def mask_json(o, strings):
    if isinstance(o, dict): return {k: mask_json(v, strings) for k, v in o.items()}
    if isinstance(o, list): return [mask_json(v, strings) for v in o]
    if isinstance(o, str): strings.append(o); return ""
    return o
def show(rev, path):
    if rev is None: return open(os.path.join(LAB, path), encoding="utf-8").read()
    return git("show", "%s:%s" % (rev, path))
def strings_only(x, y=None):   # (problems, changed string pairs) between commit x and commit y (None: the working tree)
    names = git("diff", "--name-only", x, *([y] if y else []), "--", *SHIPPED).split()
    names += [n for n in git("ls-files", "--others", "--exclude-standard", "--", *SHIPPED).split() if not y]
    bad, pairs = [], []
    for path in sorted(set(names)):
        stem = re.sub(r"\.(provenance\.json|checks\.csv)$", ".json", path)
        if stem != path and stem in TEXT_DATA: continue   # a text file's records follow it
        try: a = show(x, path)
        except subprocess.CalledProcessError: bad.append("%s is new since %s" % (path, x)); continue
        try: b = show(y, path)
        except (subprocess.CalledProcessError, OSError): bad.append("%s is gone since %s" % (path, x)); continue
        if path.endswith(".js"): ta, tb = lex_js(a), lex_js(b)
        elif path.endswith(".html"): ta, tb = lex_html(a), lex_html(b)
        elif path in TEXT_DATA:
            sa, sb = [], []
            if mask_json(json.loads(a), sa) != mask_json(json.loads(b), sb) or len(sa) != len(sb): bad.append("%s changed beyond its strings" % path); continue
            pairs += [(path, p, q) for p, q in zip(sa, sb) if p != q]; continue
        else: bad.append("%s changed, and only scripts, pages and the glossary may differ in their strings" % path); continue
        ka, kb = [(k, "" if k == "S" else v) for k, v in ta], [(k, "" if k == "S" else v) for k, v in tb]
        # The masked streams must match, except whole strings added or removed with their separating commas (a new CORRECTIONS entry, a new
        # list item): only the stretch between the common head and tail is diffed, so a large script stays fast.
        h = 0
        while h < min(len(ka), len(kb)) and ka[h] == kb[h]: h += 1
        t = 0
        while t < min(len(ka), len(kb)) - h and ka[-1 - t] == kb[-1 - t]: t += 1
        ma, mb = ka[h:len(ka) - t], kb[h:len(kb) - t]
        whole = lambda seg: all(k in ("S", "T") and v in ("", "`") or (k, v) == ("P", ",") for k, v in seg)
        if ma or mb:
            import difflib
            ops = difflib.SequenceMatcher(None, ma, mb, autojunk=False).get_opcodes()
            if not all(op == "equal" or (whole(ma[i1:i2]) and whole(mb[j1:j2])) for op, i1, i2, j1, j2 in ops):
                ctx = lambda tt, n: " ".join(v for _, v in tt[max(0, h - 4):h + n + 4])
                bad.append("%s changed outside its strings, near: %r became %r" % (path, ctx(ta, len(ma))[:140], ctx(tb, len(mb))[:140])); continue
        import difflib   # the report: the strings themselves diffed, so an added entry is named where it was added
        sa, sb = [v for k, v in ta if k == "S"], [v for k, v in tb if k == "S"]
        for op, i1, i2, j1, j2 in difflib.SequenceMatcher(None, sa, sb, autojunk=False).get_opcodes():
            if op != "equal": pairs += [(path, " ".join(sa[i1:i2]), " ".join(sb[j1:j2]))]
    return bad, pairs
def around(a, b, w=40):   # the two strings from just before their first difference
    i = next((k for k, (p, q) in enumerate(zip(a, b)) if p != q), min(len(a), len(b))); i = max(0, i - 12)
    return ("…" if i else "") + a[i:i + w * 2], ("…" if i else "") + b[i:i + w * 2]

# ---- check 4: the proof's frames --------------------------------------------------------------------------------------------------
TEXT_PANEL = {"refs": "refs", "footer": "footer", "header": "header", "legend": "legend", "tile": "tip", "mixread": "mixbox", "mix": "mixbox", "presets": "card-goto", "tips": "ctxstrip", "strip": "ctxstrip"}
def panels_of(path):   # the panels a changed text's snapshot path lies in; None when its place is unknown
    for seg in path.strip("/").split("/"):
        if seg.startswith("cr-"): return {"card-" + seg[3:]}
        if seg in TEXT_PANEL: return {TEXT_PANEL[seg]}
        if seg in ("guide", "pulse", "profiles"): return set()   # no layout of its own: the guide, the pulse button's label, the profiles' tooltips
    return None
def proof_check(x, trial):
    out = os.path.join(MOTION, "build", "carry", time.strftime("%Y%m%dT%H%M%S"))
    cmd = [sys.executable, "-I", os.path.join(HERE, "change-proof.py"), "--base", x, "--out", out, "--title", "audit carry-over from " + x] + (["--trial", trial] if trial else [])
    r = subprocess.run(cmd, cwd=LAB, capture_output=True, text=True)
    if r.returncode not in (0, 1) or not os.path.exists(os.path.join(out, "summary.json")): return ["the proof against %s did not run: %s" % (x, (r.stdout + r.stderr)[-300:])], out
    s = json.load(open(os.path.join(out, "summary.json"), encoding="utf-8")); bad = []
    if s["rules"]["new"]: bad.append("the proof finds %d new rule hit(s)" % len(s["rules"]["new"]))
    held, unknown = set(), []
    for w, groups in s["text"].items():
        for g in groups:
            for p in g["paths"]:
                q = panels_of(p)
                if q is None: unknown.append(p)
                else: held |= q
    diffs = s["frames"]["differ"]
    if any(d["map"] for d in diffs): bad.append("the map changed outside its panels in %d frame(s)" % sum(1 for d in diffs if d["map"]))
    moved = {p for d in diffs for p in d["panels"]}
    allowed = held | ({p for p in moved if p.startswith("card-")} if any(h.startswith("card-") for h in held) else set())   # a card's text may move the column's other cards
    if any(h.startswith("card-") for h in held): allowed.add("popout")
    if moved - allowed: bad.append("frames differ in %s, which hold no changed text%s" % (", ".join(sorted(moved - allowed)), " (changed text at an unmapped place: %s)" % unknown[0] if unknown else ""))
    return bad, out

def main():
    if "-h" in sys.argv or "--help" in sys.argv: print(__doc__); return 0
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if "--strings" in sys.argv:
        bad, pairs = strings_only(args[0], args[1] if len(args) > 1 else None)
        for p, a, b in pairs: print("string  %s: %r -> %r" % ((p,) + around(a, b)))
        for b in bad: print("REFUSED: " + b)
        return 1 if bad else 0
    x = git("rev-parse", "--short=7", args[0] + "^{commit}").strip()
    trial = sys.argv[sys.argv.index("--trial") + 1] if "--trial" in sys.argv else None
    bad = []
    rec = (json.load(open(PASSED, encoding="utf-8")) if os.path.exists(PASSED) else {}).get(git("rev-parse", x).strip())
    if not rec: bad.append("no full five-width audit with zero findings is recorded for %s (build/audit/passed.json)" % x)
    else: print("audit carry: %s passed the five-width audit on %s (%s states, run %s)" % (x, rec["utc"], rec["states"], rec["run"]))
    if subprocess.run(["git", "merge-base", "--is-ancestor", x, trial or "HEAD"], cwd=LAB).returncode != 0: bad.append("%s is not an ancestor of %s" % (x, trial or "HEAD"))
    sb, pairs = strings_only(x, trial or "HEAD"); bad += sb
    for p, a, b in pairs: print("audit carry: string  %s: %r -> %r" % ((p,) + around(a, b)))
    if not bad and "--skip-proof" not in sys.argv:
        pb, out = proof_check(x, trial); bad += pb; print("audit carry: proof in %s" % os.path.relpath(out, LAB))
    for b in bad: print("REFUSED: audit carry: " + b)
    if not bad: print("audit carry: the audit on %s counts for this build (%d string(s) changed)" % (x, len(pairs)))
    return 1 if bad else 0

if __name__ == "__main__":
    sys.exit(main())
