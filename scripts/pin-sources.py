#!/usr/bin/env python3
"""Pin every lab input in config/sources.json: absolute path, generation id,
size, mtime, and sha256 (computed for small files, copied from the generation's
stage-manifest.csv or the RFSD manifest for large parquet). Re-run deliberately
when a selected generation changes; R/lab-sources.R refuses drifted inputs.
`--only PREFIX` re-pins just the entries of one prefix (e.g. motion) into the existing file."""
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
def add_small(name, path, stage, kind="csv"):
    sources[name] = entry(name, path, kind, sha256(path), "computed", stage)
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

# Figure 2.8 restyle study (18 Oct 2026): the three saved inputs the manuscript copy was
# rendered from on 15 Oct, the evidence copy of the drawing script actually used (two label
# strings differ from programming/R), programming's copy as a hash record, and the manuscript
# PDF for the fidelity comparison. config/sources.json is the only place the lab names paths
# outside itself, which is why the LaTeX-side files are pinned here too.
LATEX = f"{ROOT}/LaTeX"
refine = f"{PROG}/output/reconcile-visual-refinement-20261014"
memo19 = f"{LATEX}/research/evidence/chapter2-editorial-memo-2026-10-15/implementation"
add_small("fig28.cells", f"{refine}/exhibits/generation-91a7a2b80fd6/maps/candidate-02-cell-source.csv", "fig28")
add_small("fig28.manifest", f"{refine}/exhibits/generation-91a7a2b80fd6/maps/map-refinement-manifest.json", "fig28", kind="json")
add_small("fig28.basemap", f"{refine}/inputs/geoboundaries/basemap-geometry.json", "fig28", kind="json")
add_small("fig28.script", f"{memo19}/figure-source/chapter2-reconcile-refine-maps.R", "fig28", kind="r")
add_small("fig28.script-programming", f"{PROG}/R/chapter2-reconcile-refine-maps.R", "fig28", kind="r")
add_small("fig28.manuscript-pdf", f"{LATEX}/kaprelian_dissertation/figures/chapter2/stage3-08-cohort-map.pdf", "fig28", kind="pdf")


# Figure 2.7 gallery and the sample-flow diagram (18 Oct 2026). The located 2021 eligible
# points are the pass2 parquet that the map manifest hashes as its point input
# (sha256 2989f309...); the 2021 cells with supplied-list counts come from the October
# geographic review's visual revision (byte-identical to geo.cells); the 2021/2024 cells for
# the availability-change map are the pass2 aggregates. The manuscript figure PDF is the
# fidelity reference, and the four manuscript files hold every count the diagram repeats.
pass2 = f"{PROG}/output/pass2-reconcile-20261013/exhibits/generation-8e559d19ccc1/aggregates"
vis = f"{PROG}/output/visual-revision-20261006/geo/aggregates"
maps = f"{refine}/exhibits/generation-91a7a2b80fd6/maps"
add_small("fig27.points", f"{pass2}/candidate-01-eligible-points.parquet", "fig27", kind="parquet")
add_small("fig27.population-accounting", f"{maps}/candidate-01-population-accounting.csv", "fig27")
add_small("fig27.view-accounting", f"{maps}/candidate-01-view-accounting.csv", "fig27")
add_small("fig27.cells-lists-2021", f"{vis}/cells.csv", "fig27")
add_small("fig27.membership-overlap", f"{vis}/membership_overlap.csv", "fig27")
add_small("fig27.cells-years", f"{pass2}/cells.csv", "fig27")
add_small("fig27.coverage-years", f"{pass2}/coverage.csv", "fig27")
add_small("fig27.manuscript-pdf", f"{LATEX}/kaprelian_dissertation/figures/chapter2/stage3-07-eligible-map.pdf", "fig27", kind="pdf")
tex = f"{LATEX}/kaprelian_dissertation"
add_small("flow.tex-02-data", f"{tex}/chapters/02-opacity/02-data-and-samples.tex", "flow", kind="tex")
add_small("flow.tex-05-results", f"{tex}/chapters/02-opacity/05-results.tex", "flow", kind="tex")
add_small("flow.tex-07-financial", f"{tex}/chapters/02-opacity/07-financial-sample-implications.tex", "flow", kind="tex")
add_small("flow.tex-appendix-b", f"{tex}/appendices/b-chapter2-evidence.tex", "flow", kind="tex")
add_small("flow.fig-cohort-accounting-1", f"{tex}/figures/chapter2/stage3-b-cohort-accounting-1.pdf", "flow", kind="pdf")
add_small("flow.fig-cohort-accounting-2", f"{tex}/figures/chapter2/stage3-b-cohort-accounting-2.pdf", "flow", kind="pdf")


# Motion-style explainer and explorer (22 October 2026). Aggregates the pages draw from, beyond
# the entries already pinned above (fig27.*, fig28.*, t5/t6 exhibit sources, acct.*, registry/payload).
fin19 = f"{PROG}/output/presentation-finalization-20261019"
add_small("motion.change-cells", f"{fin19}/data/availability-change-cells.csv", "motion")
add_small("motion.change-class-counts", f"{fin19}/data/availability-change-class-counts.csv", "motion")
add_small("motion.annual-cell-totals", f"{fin19}/data/annual-cell-totals.csv", "motion")
add_small("motion.reference-points", f"{PROG}/metadata/chapter2-reconcile-reference-points.csv", "motion")
add_small("motion.printed-names", f"{PROG}/metadata/chapter2-printed-names.csv", "motion")
addendum = f"{PROG}/output/pass2-addendum-20261011/exhibits/generation-f12a6aa77065"
for dim in ("ownership", "legal", "industry"):
    add_small(f"motion.{dim}-year", f"{addendum}/ch2-p2-addendum-{dim}-source.csv", "motion")
fig25 = f"{PROG}/output/figure2-5-redesign-20261014/data"
add_small("motion.size-odds-ratios", f"{fig25}/saved-adjusted-odds-ratios.csv", "motion")
add_small("motion.size-raw-changes", f"{fig25}/raw-2021-2022-changes.csv", "motion")
ap = f"{PROG}/output/chapter2-author-points-20261018"
add_small("motion.size-changes", f"{ap}/contrasts/size-changes.csv", "motion")
add_small("motion.histories", f"{ap}/history/data/fixed-2019-pattern-histories.csv", "motion")
add_small("motion.history-bins", f"{ap}/history/history-with-any-list.csv", "motion")
add_small("motion.flow-counts", f"{PROG}/output/sample-flow-final-c-spacing-20261019/sources/displayed-counts.csv", "motion")
pass2agg = f"{PROG}/output/pass2-reconcile-20261013/exhibits/generation-8e559d19ccc1/aggregates"
pass2data = f"{PROG}/output/pass2-reconcile-20261013/exhibits/generation-8e559d19ccc1/data"
add_small("motion.dot-accounting", f"{pass2agg}/dot_accounting.csv", "motion")
add_small("motion.coordinate-piles", f"{pass2agg}/coordinate_piles.csv", "motion")
add_small("motion.selection-cells", f"{pass2agg}/selection_cells.csv", "motion")
add_small("motion.revenue-change-cells", f"{pass2data}/geo-revenue-change-from-2021-source.csv", "motion")
add_small("motion.margin-change-cells", f"{pass2data}/geo-margin-change-from-2021-source.csv", "motion")
# Round 2 (23 October 2026): the supplied sanctions list (dates, names, jurisdictions), the World Bank
# deflator download, and the archived OKVED name dictionary for the treated-firm sequence.
add_small("motion.sanctioned-list", f"{PROG}/data/raw_files/sanctioned_strategic/sanctioned/ru_sanctioned.csv", "motion")
add_small("motion.putin-decree-list", f"{PROG}/data/raw_files/sanctioned_strategic/strategic/putin_decree_list.xlsx", "motion", kind="xlsx")   # the names of listed firms (25 October 2026)
add_small("motion.strateg-government", f"{PROG}/data/raw_files/sanctioned_strategic/strategic/strateg_government.xlsx", "motion", kind="xlsx")
add_small("motion.deflator", f"{PROG}/data/raw_files/RF_GDP_deflator/API_NY.GDP.DEFL.ZS.AD_DS2_en_csv_v2_35893.csv", "motion")
add_small("motion.okved-names", f"{ROOT}/Claude Code/2026-09-24-before-migration/programming/data/raw_files/okved/okved_names.xlsx", "motion", kind="xlsx")
add_small("motion.okfs", f"{PROG}/output/pass2-addendum-20261011/classifier-sources/okfs.csv", "motion")
add_small("motion.okopf", f"{PROG}/output/pass2-addendum-20261011/classifier-sources/okopf-2012.csv", "motion")

head = subprocess.run(["git", "-C", PROG, "--no-optional-locks", "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip()
dirty = subprocess.run(["git", "-C", PROG, "--no-optional-locks", "status", "--porcelain"], capture_output=True, text=True).stdout.count("\n")
only = sys.argv[2] if len(sys.argv) >= 3 and sys.argv[1] == "--only" else None
now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
if only:
    with open(OUT) as f:
        old = json.load(f)
    added = {k: v for k, v in sources.items() if k.startswith(only + ".")}
    merged = {k: v for k, v in old["sources"].items() if not k.startswith(only + ".")}
    merged.update(added)
    doc = {"pinned_utc": old["pinned_utc"], "programming_head": old["programming_head"],
           "programming_dirty_files": old["programming_dirty_files"], "count": len(merged), "sources": merged,
           "partial_pins": old.get("partial_pins", []) + [{"prefix": only, "pinned_utc": now, "programming_head": head,
                                                           "programming_dirty_files": dirty, "entries": sorted(added)}]}
    with open(OUT, "w") as f:
        json.dump(doc, f, indent=1, sort_keys=False)
    print(f"pinned {len(added)} '{only}.*' sources into {os.path.normpath(OUT)}; {len(merged)} entries in total; other entries untouched")
    sys.exit(0)
doc = {"pinned_utc": now, "programming_head": head,
       "programming_dirty_files": dirty, "count": len(sources), "sources": sources}
with open(OUT, "w") as f:
    json.dump(doc, f, indent=1, sort_keys=False)
print(f"pinned {len(sources)} sources to {os.path.normpath(OUT)} (programming HEAD {head[:7]}, {dirty} dirty files)")
