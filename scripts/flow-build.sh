#!/usr/bin/env bash
# Compiles every generated TikZ source of the sample-flow diagrams (R/flow/*-tikz.tex) with
# pdflatex (TinyTeX, by absolute path, since the sandbox PATH is /usr/bin only), writes a
# provenance sidecar per PDF and adds the TikZ rows to the gallery manifest.
# Run inside the sandbox: scripts/lab-ro.sh scripts/flow-build.sh
set -euo pipefail
cd "$LAB_ROOT"
D=figures/20261018-fig27-gallery
PDFLATEX=${PDFLATEX:-$HOME/bin/pdflatex}
for src in R/flow/*-tikz.tex; do
  id=$(basename "$src" .tex)
  "$PDFLATEX" -interaction=nonstopmode -halt-on-error -output-directory "$D" "$src" > "$D/$id.console.txt" 2>&1 || { tail -30 "$D/$id.console.txt"; exit 1; }
  rm -f "${D:?}/${id:?}.aux" "${D:?}/${id:?}.log"
  echo "$id: $(pdfinfo "$D/$id.pdf" | awk -F': *' '/^Page size/ {print $2}')"
  python3 - "$D/$id.pdf" "$src" "$D/$id.json" <<'PY'
import hashlib, json, os, sys, time
pdf, src, out = sys.argv[1:4]
h = lambda p: hashlib.sha256(open(p, "rb").read()).hexdigest()
json.dump({"id": os.path.basename(pdf)[:-4], "pdf": os.path.abspath(pdf), "pdf_sha256": h(pdf), "source_tex": os.path.abspath(src),
           "source_sha256": h(src), "compiler": "pdflatex (TinyTeX)", "time_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
           "run_id": os.environ.get("LAB_RUN_ID", "")}, open(out, "w"), indent=1)
PY
done
python3 - "$D/variants.csv" <<'PY'
import csv, hashlib, glob, os, subprocess, sys
p = sys.argv[1]; d = os.path.dirname(p)
rows = [r for r in csv.DictReader(open(p)) if not r["id"].endswith("-tikz")]
labels = {"flow-ch2-tikz": "Text diagram, Chapter 2 version (TikZ, pdflatex), superseded by the author's request for a flowchart",
          "flow-ch1-tikz": "Text diagram, Chapter 1 version (TikZ, pdflatex), superseded by the author's request for a flowchart",
          "flow2-tikz": "Flowchart (TikZ, pdflatex, absolute coordinates from the R layout): registry names and counts in the boxes, proportional bars for the two partitions, model tags"}
order = max(int(r["order"]) for r in rows)
for src in sorted(glob.glob("R/flow/*-tikz.tex")):
    id_ = os.path.basename(src)[:-4]; pdf = f"{d}/{id_}.pdf"; order += 1
    size = subprocess.run(["pdfinfo", pdf], capture_output=True, text=True).stdout
    h = next(l for l in size.splitlines() if l.startswith("Page size")).split()[4]
    rows.append({"order": order, "id": id_, "group": "flow", "label": labels.get(id_, id_), "pdf": f"{id_}.pdf",
                 "pdf_sha256": hashlib.sha256(open(pdf, "rb").read()).hexdigest(), "height_in": round(float(h) / 72, 2), "crop": "NA"})
w = csv.DictWriter(open(p, "w", newline=""), fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
print("manifest rows:", len(rows))
PY
