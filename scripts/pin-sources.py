#!/usr/bin/env python3
"""Pin every lab input in config/sources.json: absolute path, generation id,
size, mtime, and sha256 (computed for small files, copied from the generation's
stage-manifest.csv or the RFSD manifest for large parquet). Re-run deliberately
when a selected generation changes; R/lab-sources.R refuses drifted inputs."""
import csv, glob, hashlib, json, os, re, subprocess, sys, time

ROOT = "/home/armen/Documents/PhD/CGU/Dissertation/00 Full Dissertation"
PROG = f"{ROOT}/programming"
FOUND = f"{PROG}/data/derived/task4-foundation-lightning-20261005/foundation"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "config", "sources.json")

def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()

def generation_of(path):
    m = re.search(r"generation-([0-9a-f]+)", path)
    return m.group(1) if m else None

def manifest_sha(path):
    d = os.path.dirname(path)
    with open(os.path.join(d, "stage-manifest.csv"), newline="") as f:
        for row in csv.DictReader(f):
            if row["path"] == os.path.basename(path):
                return row["sha256"], int(row["size_bytes"])
    raise SystemExit(f"no manifest row for {path}")

def entry(name, path, kind, sha, sha_source, stage_hint):
    st = os.stat(path)
    return {"name": name, "path": path, "kind": kind, "generation": generation_of(path),
            "size": st.st_size, "mtime": int(st.st_mtime), "sha256": sha,
            "sha256_source": sha_source, "stage": stage_hint}

sources = {}
def add_small(name, path, stage):
    sources[name] = entry(name, path, "csv", sha256(path), "computed", stage)
def add_large(name, path, stage, sha, src):
    e = entry(name, path, "parquet", sha, src, stage); sources[name] = e

# Foundation accounting CSVs.
acct = f"{FOUND}/accounting/generation-10b9d50c61438"
for p in sorted(glob.glob(f"{acct}/*.csv")):
    add_small("acct." + os.path.basename(p)[:-4], p, "A")
# Task 5 and Task 6 exhibit sources, Task 5 aggregates, geography.
for p in sorted(glob.glob(f"{PROG}/output/task5-20261005/exhibits/generation-bb2b915a630c6/*.csv")):
    add_small("t5." + os.path.basename(p)[:-4], p, "A")
for p in sorted(glob.glob(f"{PROG}/output/task6-20261006/exhibits/generation-ff2872a31a02b/*.csv")):
    add_small("t6." + os.path.basename(p)[:-4], p, "A")
for p in sorted(glob.glob(f"{PROG}/output/geography-review-20261006/reproduction/*.csv")):
    add_small("geo." + os.path.basename(p)[:-4], p, "A")
add_small("geo.figure-index", f"{PROG}/output/geography-clarifications-20261006/figure-index.csv", "A")
add_small("t5s.membership-nesting", f"{PROG}/output/task5-20261005/samples/generation-a2af61e5fc2e8/membership-nesting.csv", "A")
add_small("t5s.model-sample-counts", f"{PROG}/output/task5-20261005/samples/generation-a2af61e5fc2e8/model-sample-counts.csv", "A")
add_small("t5r.selected-contrasts", f"{PROG}/output/task5-20261005/references/generation-a6d2761625381/selected-contrasts.csv", "A")
add_small("t5r.reference-accounting", f"{PROG}/output/task5-20261005/references/generation-a6d2761625381/reference-accounting.csv", "A")
add_small("rfsd.manifest", f"{PROG}/metadata/rfsd-v3.1.0-manifest.csv", "meta")

# Foundation parquet, hashed by Codex's stage manifests.
for y in range(2011, 2026):
    for p in glob.glob(f"{FOUND}/registry/year={y}/generation-*/registry.parquet"):
        sha, size = manifest_sha(p); add_large(f"registry.{y}", p, "B", sha, "stage-manifest")
        assert os.stat(p).st_size == size
    for p in glob.glob(f"{FOUND}/source/year={y}/generation-*/raw-payload.parquet"):
        sha, size = manifest_sha(p); add_large(f"payload.{y}", p, "B", sha, "stage-manifest")
        assert os.stat(p).st_size == size
for p in glob.glob(f"{FOUND}/identity/generation-*/identity-dates.parquet"):
    sha, size = manifest_sha(p); add_large("identity", p, "B", sha, "stage-manifest")
# Task 5 financial measures and cohorts (selected generation a4bd91a3fefd6); no stage manifest beside them.
coh = f"{PROG}/data/derived/task5-20261005/chapter3-cohorts/generation-a4bd91a3fefd6"
for y in range(2019, 2025):
    add_large(f"finmeas.{y}", f"{coh}/financial-measures-{y}.parquet", "B", None, "size-mtime-only")
for p in sorted(glob.glob(f"{coh}/c3-recent-2021-*-baseline.parquet")):
    add_large("cohort." + os.path.basename(p)[len("c3-recent-2021-"):-len("-baseline.parquet")], p, "B", None, "size-mtime-only")
# Raw RFSD, hashed by the project manifest.
with open(f"{PROG}/metadata/rfsd-v3.1.0-manifest.csv", newline="") as f:
    rows = list(csv.DictReader(f))
for row in rows:
    rel = row["path"].split("RFSD/", 1)[1]
    p = f"{PROG}/data/inputs/RFSD/v3.1.0/{rel}"
    y = re.search(r"year=(\d{4})", rel).group(1)
    e = entry(f"rfsd.{y}", p, "parquet", row["sha256"], "rfsd-manifest", "C")
    assert e["size"] == int(row["size_bytes"]), p
    sources[e["name"]] = e

head = subprocess.run(["git", "-C", PROG, "--no-optional-locks", "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip()
dirty = subprocess.run(["git", "-C", PROG, "--no-optional-locks", "status", "--porcelain"], capture_output=True, text=True).stdout.count("\n")
doc = {"pinned_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "programming_head": head,
       "programming_dirty_files": dirty, "count": len(sources), "sources": sources}
with open(OUT, "w") as f:
    json.dump(doc, f, indent=1, sort_keys=False)
print(f"pinned {len(sources)} sources to {os.path.normpath(OUT)} (programming HEAD {head[:7]}, {dirty} dirty files)")
