"""Motion.fmt (js/motion-core.js) in Python, for the tools that re-derive the page's texts (round 18): wire_check.py, agent_guide.py and
profile_check.py, which kept three copies that rounded exact ties differently.

The page writes int as Intl.NumberFormat('en-US') of Math.round(v), pct as Math.round(v * 10^d) / 10^d through toFixed(d) and '%', dec as
toFixed(d), and signed as '+' or the minus sign U+2212 before toFixed(d) of the magnitude. toFixed rounds the exact binary value of the number
with ties to the larger magnitude and writes "-" before any negative number, which Decimal reproduces; Math.round rounds ties up, toward +infinity,
so -2.5 gives -2."""
import math
from decimal import Decimal, ROUND_HALF_UP

def to_fixed(v, d):   # Number.prototype.toFixed
    s = format(Decimal(abs(v)).quantize(Decimal(1).scaleb(-d), rounding=ROUND_HALF_UP), 'f')
    return ('-' + s) if v < 0 else s
def js_round(v): return math.floor(v + 0.5)   # Math.round
def fmt_int(v): return f"{js_round(v):,}"
def pct(v, d=1): return to_fixed(js_round(v * 10 ** d) / 10 ** d, d) + '%'
def dec(v, d=2): return to_fixed(v, d)
def signed(v, d=1): return ('+' if v > 0 else '−' if v < 0 else '') + to_fixed(abs(v), d)
