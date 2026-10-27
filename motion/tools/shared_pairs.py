#!/usr/bin/env python3
"""Coordinate pairs shared by 100 or more firms (round 16, the author's item of 27 October 2026).

Reads the shipped address files (data/firms/firms-YYYY.bin.gz, M9: one record per coordinate pair of located eligible
firms on no list with a house- or street-level geocode, its firms n and statements a) and writes data/shared.json and its
twin, provenance and checks: per year 2014 to 2025, nationally and per 100 km and 25 km cell (the grids of M5 and M10,
floor(x_km / size)) and per 1 km square of the 22 city windows (M11's window: 45 km either side of the city, inclusive),
the firms and statements at pairs shared by 100 or more firms and in all, with the count of such pairs.
The population is the address files' own, so every figure names it; the density pass counts every located firm, firms
with city-level geocodes among them, whose shared city-centre coordinate is not a shared registration.
No address is written out: the output holds counts per cell only.
Checks: each year's totals equal data/firms.json's (firms, firms_at_100plus, addresses_100plus); every level adds up to
the national row (the windows to the firms inside them). Run: python3 motion/tools/shared_pairs.py"""
import array, base64, csv, datetime, gzip, hashlib, json, math, os, struct, sys

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.normpath(os.path.join(HERE, "..", "data"))
THRESHOLD, BIG, SUPPORT, YEARS = 100, 1000, 50, range(2014, 2026)

def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""): h.update(chunk)
    return h.hexdigest()

def b64(typecode, values):
    a = array.array(typecode, values)
    if sys.byteorder != "little": a.byteswap()
    return base64.b64encode(a.tobytes()).decode("ascii")

def read_year(y):
    b = gzip.open(os.path.join(DATA, "firms", "firms-%d.bin.gz" % y), "rb").read()
    magic, n, _, _, year, ver = struct.unpack_from("<4sIiiHH", b, 0)
    if magic != b"FRM1" or ver != 3 or year != y: raise SystemExit("shared_pairs: bad header in firms-%d" % y)
    def col(tc, off, size):
        a = array.array(tc); a.frombytes(b[off:off + size * n])
        if sys.byteorder != "little": a.byteswap()
        return a
    return col("i", 32, 4), col("i", 32 + 4 * n, 4), col("H", 32 + 8 * n, 2), col("H", 32 + 10 * n, 2)

def level(cells):   # {(ix, iy): [n, a, n100, a100, p100]} -> dense ix, iy, n, a for every cell with firms; the shared columns only where a shared pair is
    keys = sorted(cells, key=lambda k: (k[1], k[0]))
    rows = [cells[k] for k in keys]; hit = [i for i, r in enumerate(rows) if r[4]]
    return {"count": len(keys), "ix": b64("h", [k[0] for k in keys]), "iy": b64("h", [k[1] for k in keys]),
            "n": b64("i", [r[0] for r in rows]), "a": b64("i", [r[1] for r in rows]),
            "shared": len(hit), "k": b64("i", hit), "n100": b64("i", [rows[i][2] for i in hit]), "a100": b64("i", [rows[i][3] for i in hit]), "p100": b64("i", [rows[i][4] for i in hit])}

def main():
    manifest = json.load(open(os.path.join(DATA, "firms.json"), encoding="utf-8"))
    basemap = json.load(open(os.path.join(DATA, "basemap.json"), encoding="utf-8"))
    cities = basemap["cities"]
    wins = [(cities["label"][i], float(cities["x_km"][i]), float(cities["y_km"][i])) for i in range(len(cities["label"]))]
    near = {}   # each window under the 100 km cells it overlaps, so a pair is tested against two or three windows at most
    for lab, cx, cy in wins:
        for ix in range(math.floor((cx - 45) / 100), math.floor((cx + 45) / 100) + 1):
            for iy in range(math.floor((cy - 45) / 100), math.floor((cy + 45) / 100) + 1): near.setdefault((ix, iy), []).append((lab, cx, cy))
    national, cells100, cells25, city1km, checks = [], {}, {}, {}, []
    def check(name, expected, observed):
        checks.append({"check": name, "expected": expected, "observed": observed, "tolerance": 0, "pass": expected == observed})
    for y in YEARS:
        xs, ys, nn, aa = read_year(y)
        c100, c25, w1 = {}, {}, {lab: {} for lab, _, _ in wins}
        tot = [0, 0, 0, 0, 0]; big = [0, 0, 0]
        for x_m, y_m, n, a in zip(xs, ys, nn, aa):
            xk, yk = x_m / 1000.0, y_m / 1000.0; s = n >= THRESHOLD
            row = (n, a, n if s else 0, a if s else 0, 1 if s else 0)
            for i in range(5): tot[i] += row[i]
            if n >= BIG: big[0] += 1; big[1] += n; big[2] += a
            k100 = (math.floor(xk / 100), math.floor(yk / 100))
            for store, k in ((c100, k100), (c25, (math.floor(xk / 25), math.floor(yk / 25)))):
                r = store.setdefault(k, [0, 0, 0, 0, 0])
                for i in range(5): r[i] += row[i]
            for lab, cx, cy in near.get(k100, ()):
                if cx - 45 <= xk <= cx + 45 and cy - 45 <= yk <= cy + 45:
                    k = (min(math.floor(xk - (cx - 45)), 89), min(math.floor(yk - (cy - 45)), 89)); r = w1[lab].setdefault(k, [0, 0, 0, 0, 0])
                    for i in range(5): r[i] += row[i]
        exp = manifest["by_year"][str(y)]
        check("%d: firms equal firms.json's" % y, exp["firms"], tot[0])
        check("%d: firms at pairs shared by 100 or more equal firms.json's" % y, exp["firms_at_100plus"], tot[2])
        check("%d: pairs shared by 100 or more equal firms.json's" % y, exp["addresses_100plus"], tot[4])
        for name, store in (("100 km", c100), ("25 km", c25)):
            sums = [sum(r[i] for r in store.values()) for i in range(5)]
            check("%d: the %s cells add up to the national row" % (y, name), tot, sums)
        national.append({"year": y, "firms": tot[0], "statements": tot[1], "firms_100": tot[2], "statements_100": tot[3], "pairs_100": tot[4],
                         "pairs_1000": big[0], "firms_1000": big[1], "statements_1000": big[2]})
        cells100[str(y)] = level(c100); cells25[str(y)] = level(c25)
        city1km[str(y)] = {lab: level(w) for lab, w in w1.items()}
        print("%d: %d pairs shared by 100+ hold %s of %s firms (%.1f%%); with a statement %.1f%% there, %.1f%% elsewhere" % (
            y, tot[4], f"{tot[2]:,}", f"{tot[0]:,}", 100 * tot[2] / tot[0], 100 * tot[3] / tot[2], 100 * (tot[1] - tot[3]) / (tot[0] - tot[2])))
    common = {"years": list(YEARS), "threshold": THRESHOLD, "big": BIG, "support": SUPPORT,
              "population": "located eligible firms on no list with a house- or street-level geocode (the address files of M9); firms with city-level geocodes are left out, since a shared city-centre coordinate is not a shared registration",
              "encoding": "per year and level: count, then base64 little-endian int16 ix/iy and int32 n (firms) and a (with a statement) for every cell with firms; shared rows only, int32 k (the row's index), n100 and a100 (firms and statements at coordinate pairs shared by 100 or more firms), p100 (such pairs in the cell); 1 km squares indexed from the window's lower-left corner",
              "notes": ["Shares only where 50 or more firms (the project's support rule): the share of a unit's firms at shared pairs, and each statement share, at shared pairs and elsewhere.",
                        "Registered addresses, not operating sites. Registered legal addresses can be shared business centres or addresses rented for registration and correspondence, rather than production premises. Several firms can therefore share one registered address. The Federal Tax Service tracks mass-registration addresses.",
                        "Descriptive figures computed in the atlas from the address files; the chapter does not report this comparison."],
              "author": "by Armen G. Kaprelian"}
    outs = {"shared": dict(common, grids_km=[100, 25], national={k: [r[k] for r in national] for k in national[0]}, cells100=cells100, cells25=cells25),
            "shared-city": dict(common, window_km=90, city_1km=city1km)}
    bad = [c for c in checks if not c["pass"]]
    with open(os.path.join(DATA, "shared.checks.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, quoting=csv.QUOTE_NONNUMERIC); w.writerow(["check", "expected", "observed", "tolerance", "pass"])
        for c in checks: w.writerow([c["check"], json.dumps(c["expected"]), json.dumps(c["observed"]), 0, "TRUE" if c["pass"] else "FALSE"])
    if bad: raise SystemExit("shared_pairs: %d of %d checks failed: %s" % (len(bad), len(checks), "; ".join(c["check"] for c in bad)))
    inputs = [os.path.join(DATA, "firms", "firms-%d.bin.gz" % y) for y in YEARS] + [os.path.join(DATA, "firms.json"), os.path.join(DATA, "basemap.json")]
    ins = [{"path": os.path.relpath(p, os.path.dirname(DATA)), "sha256": sha256(p), "bytes": os.path.getsize(p)} for p in inputs]
    run = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    for oid, obj in outs.items():   # each file loads on demand (the layer or the toggle's first use), like the address files
        json_path, js_path = os.path.join(DATA, oid + ".json"), os.path.join(DATA, oid + ".js")
        with open(json_path, "w", encoding="utf-8") as f: json.dump(obj, f, separators=(",", ":"))
        txt = open(json_path, encoding="utf-8").read()
        with open(js_path, "w", encoding="utf-8") as f: f.write('window.MOTION_DATA = window.MOTION_DATA || {};\nwindow.MOTION_DATA["' + oid + '"] = ' + txt + ";\n")
        prov = {"id": oid, "tool": "motion/tools/shared_pairs.py", "tool_sha256": sha256(os.path.abspath(__file__)), "run_utc": run, "inputs": ins,
                "checks": "%d of %d passed (shared.checks.csv)" % (len(checks), len(checks)),
                "output": {"json": "data/%s.json" % oid, "json_sha256": sha256(json_path), "json_bytes": os.path.getsize(json_path), "js": "data/%s.js" % oid, "js_sha256": sha256(js_path)}}
        with open(os.path.join(DATA, oid + ".provenance.json"), "w", encoding="utf-8") as f: json.dump(prov, f, indent=1)
        print("%s.json %.0f kB" % (oid, os.path.getsize(json_path) / 1e3))
    print("shared: %d of %d checks passed" % (len(checks), len(checks)))

if __name__ == "__main__":
    main()
