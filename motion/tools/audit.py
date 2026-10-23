#!/usr/bin/env python3
"""Text audit of a cut: reads the boxes that capture.py --audit recorded and reports, as time ranges,

  overlap   two visible strings of different groups whose boxes intersect by more than 15% of the smaller
  offcanvas a visible string outside the 1920 x 1080 design space
  small     a visible string under 22 px
  cut-in    a block that goes from absent to 0.95 alpha or more within one audit step (no fade in)
  cut-out   a block that goes from 0.9 alpha or more to absent within one audit step, before its scene's
            own fade-out (no fade out)

A block is a string in a scene at a size: the same string (a label may move with the camera), or a box
whose left or right edge is within 2 px and whose baseline is within 14 px of the previous frame's
(reveals rise 10 px; counters and tickers change their digits in place). Visible means effective
alpha >= 0.05. Zero findings is the acceptance rule.

Usage: audit.py audit.json [--out audit.txt] [--min-size 22]"""
import argparse, json, sys
from collections import defaultdict

def inter(a, b):
    w = min(a["x1"], b["x1"]) - max(a["x"], b["x"]); h = min(a["y1"], b["y1"]) - max(a["y"], b["y"])
    return w * h if w > 0 and h > 0 else 0.0

def area(a):
    return max(0.0, a["x1"] - a["x"]) * max(0.0, a["y1"] - a["y"])

def same_block(a, b):
    if a["scene"] != b["scene"] or a["size"] != b["size"]:
        return False
    if a["str"] == b["str"]:
        return True
    if "ax" in a and "ax" in b:   # the text anchor: the same point whatever the string's glyphs
        return abs(a["ax"] - b["ax"]) <= 2 and abs(a["ay"] - b["ay"]) <= 14
    return (abs(a["x"] - b["x"]) <= 2 or abs(a["x1"] - b["x1"]) <= 2) and abs(a["y"] - b["y"]) <= 14

def label(b):
    s = b["str"]; return s if len(s) <= 48 else s[:45] + "..."

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("audit")
    ap.add_argument("--out", default=None)
    ap.add_argument("--min-size", type=float, default=22)
    ap.add_argument("--overlap", type=float, default=0.15)
    a = ap.parse_args()
    data = json.load(open(a.audit))
    frames = data["frames"]; meta = data.get("meta") or {}
    scene_end = {s["id"]: s["end"] for s in (meta.get("scenes") or [])}
    findings = []   # (kind, scene, key, t)
    prev = []
    for fi, fr in enumerate(frames):
        t = fr["t"]; boxes = [b for b in fr["boxes"] if b["eff"] >= 0.05 and b["str"].strip()]
        for b in boxes:
            if b["x"] < -0.5 or b["y"] < -0.5 or b["x1"] > 1920.5 or b["y1"] > 1080.5:
                findings.append(("offcanvas", b["scene"], label(b), t))
            if b["size"] < a.min_size:
                findings.append(("small", b["scene"], "%s (%g px)" % (label(b), b["size"]), t))
        for i in range(len(boxes)):
            for j in range(i + 1, len(boxes)):
                p, q = boxes[i], boxes[j]
                if p["para"] is not None and p["para"] == q["para"]:
                    continue
                x = inter(p, q)
                if x <= 0:
                    continue
                small = min(area(p), area(q))
                if small > 0 and x / small > a.overlap:
                    findings.append(("overlap", p["scene"] if p["scene"] == q["scene"] else "%s+%s" % (p["scene"], q["scene"]), "%s | %s" % (label(p), label(q)), t))
        # transitions against the previous audited frame
        if fi > 0:
            for b in boxes:
                if b["eff"] >= 0.95 and not any(same_block(b, o) for o in prev):
                    findings.append(("cut-in", b["scene"], label(b), t))
            for o in prev:
                if o["eff"] >= 0.9 and not any(same_block(o, b) for b in boxes):
                    end = scene_end.get(o["scene"])
                    if end is not None and t >= end - 0.6:
                        continue   # the scene itself is fading out
                    findings.append(("cut-out", o["scene"], label(o), frames[fi - 1]["t"]))
        prev = boxes
    # merge into ranges per (kind, scene, key)
    groups = defaultdict(list)
    for kind, scene, key, t in findings:
        groups[(kind, scene, key)].append(t)
    step_s = (data.get("step") or 6) / float(data.get("fps") or 30) + 1e-6
    lines = []
    for (kind, scene, key), ts in sorted(groups.items(), key=lambda kv: (kv[0][0], min(kv[1]))):
        ts = sorted(set(ts)); ranges = []; start = ts[0]; last = ts[0]
        for t in ts[1:]:
            if t - last > step_s * 1.5:
                ranges.append((start, last)); start = t
            last = t
        ranges.append((start, last))
        rs = ", ".join("%.1f-%.1f s" % r if r[0] != r[1] else "%.1f s" % r[0] for r in ranges)
        lines.append("%-9s %-13s %s   [%s]" % (kind, scene, key, rs))
    nb = sum(len(fr["boxes"]) for fr in frames)
    head = "text audit: %d frames (step %s), %d boxes, %d finding(s)" % (len(frames), data.get("step"), nb, len(lines))
    text = "\n".join([head] + lines) + "\n"
    if a.out:
        with open(a.out, "w") as fh:
            fh.write(text)
    sys.stdout.write(text)
    return 1 if lines else 0

if __name__ == "__main__":
    sys.exit(main())
