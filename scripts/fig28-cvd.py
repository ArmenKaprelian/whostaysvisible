#!/usr/bin/env python3
"""Adjacent-pair colour differences (Euclidean OKLab x 100) under normal vision and the
validator's simulated protanopia, deuteranopia and tritanopia, for one palette.
Usage: python3 -I scripts/fig28-cvd.py '#hex,#hex,...'   (prints CSV)"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import validate_palette as vp
hexes = [h.strip() for h in sys.argv[1].split(",")]
print("pair,normal,protan,deutan,tritan")
for a, b in zip(hexes, hexes[1:]):
    print(f"{a}>{b}," + ",".join(f"{vp.deltaE(a, b, k):.1f}" for k in (None, "protan", "deutan", "tritan")))
