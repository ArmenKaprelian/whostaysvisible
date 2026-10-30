#!/usr/bin/env python3
"""Cut Natural Earth's 1:10m land to a lon/lat box and write the result as GeoJSON (round 29, 30 October 2026).

M1-basemap.R intersects the two geoBoundaries UKR ADM1 shapes it draws (Crimea, Sevastopol), whose coastal edges run out to the
12-nautical-mile line, with this land, so the map's coast is land as on every Russian region. Each polygon ring is clipped to the box
(Sutherland-Hodgman); a ring that leaves no area is dropped. The box holds both shapes whole, so the cut changes nothing inside them.
The input is untrusted data: run with python3 -I and pass both paths.

Usage: python3 -I scripts/ne-land-extract.py FULL.geojson OUT.geojson [--box LON0,LAT0,LON1,LAT1]   (default box 32,44,37,46.5)"""
import json, sys

def clip_ring(ring, box):
    x0, y0, x1, y1 = box
    pts = ring[:-1] if ring and ring[0] == ring[-1] else list(ring)
    edges = ((lambda p: p[0] >= x0, lambda a, b: x0, 0), (lambda p: p[0] <= x1, lambda a, b: x1, 0),
             (lambda p: p[1] >= y0, lambda a, b: y0, 1), (lambda p: p[1] <= y1, lambda a, b: y1, 1))
    for inside, edge, axis in edges:
        if len(pts) < 3: return None
        out = []
        for i, cur in enumerate(pts):
            prev = pts[i - 1]
            if inside(cur):
                if not inside(prev): out.append(cross(prev, cur, edge(prev, cur), axis))
                out.append(cur)
            elif inside(prev): out.append(cross(prev, cur, edge(prev, cur), axis))
        pts = out
    if len(pts) < 3: return None
    return pts + [pts[0]]

def cross(a, b, v, axis):   # the point on segment a-b where coordinate `axis` equals v
    t = (v - a[axis]) / (b[axis] - a[axis])
    return [v, a[1] + t * (b[1] - a[1])] if axis == 0 else [a[0] + t * (b[0] - a[0]), v]

def main():
    args = [a for a in sys.argv[1:]]
    if not args or args[0] in ('-h', '--help') or len(args) not in (2, 4): print(__doc__); sys.exit(0 if args[:1] in (['-h'], ['--help']) else 2)
    box = (32.0, 44.0, 37.0, 46.5)
    if len(args) == 4:
        if args[2] != '--box': print(__doc__); sys.exit(2)
        box = tuple(float(v) for v in args[3].split(','))
    src = json.load(open(args[0], encoding='utf-8'))
    polys = []
    for f in src['features']:
        g = f['geometry']; P = [g['coordinates']] if g['type'] == 'Polygon' else g['coordinates']
        for poly in P:
            xs = [p[0] for p in poly[0]]; ys = [p[1] for p in poly[0]]
            if max(xs) < box[0] or min(xs) > box[2] or max(ys) < box[1] or min(ys) > box[3]: continue
            outer = clip_ring(poly[0], box)
            if outer is None: continue
            polys.append([outer] + [r for r in (clip_ring(h, box) for h in poly[1:]) if r is not None])
    out = {"type": "FeatureCollection", "features": [{"type": "Feature", "geometry": {"type": "MultiPolygon", "coordinates": polys},
           "properties": {"source": "Natural Earth 1:10m land (ne_10m_land.geojson), public domain", "box_lon_lat": list(box),
                          "cut_by": "scripts/ne-land-extract.py (Sutherland-Hodgman per ring)"}}]}
    with open(args[1], 'w', encoding='utf-8') as fh: json.dump(out, fh, separators=(',', ':'))
    print('%d polygons, %d vertices, box %s, written to %s' % (len(polys), sum(len(r) for p in polys for r in p), box, args[1]))

if __name__ == '__main__': main()
