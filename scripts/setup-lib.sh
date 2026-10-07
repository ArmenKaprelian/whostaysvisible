#!/usr/bin/env bash
# Installs the lab's extra R packages into lib/ with pak (needs internet), pins
# them in config/pak.lock and snapshots every library the lab sees. Runs outside
# the sandbox because pak downloads. Never touches the user or renv libraries.
set -euo pipefail
source "$(dirname -- "${BASH_SOURCE[0]}")/common.sh"; lab_load_env
mkdir -p "$LAB/lib"
export R_LIBS="$LAB/lib:$RENV_LIB"
cd "$LAB"
Rscript --vanilla - <<'RS'
lab <- Sys.getenv("LAB_ROOT", unset = getwd())
lib <- file.path(lab, "lib")
pkgs <- c("patchwork", "ggrepel")
pak::pkg_install(pkgs, lib = lib, ask = FALSE)
pak::lockfile_create(pkgs, lockfile = file.path(lab, "config", "pak.lock"), lib = lib)
ip <- utils::installed.packages()
snap <- data.frame(package = ip[, "Package"], version = ip[, "Version"], library = ip[, "LibPath"], row.names = NULL)
snap <- snap[order(snap$package, snap$library), ]
utils::write.csv(snap, file.path(lab, "config", "library-snapshot.csv"), row.names = FALSE)
cat("installed:", paste(pkgs, vapply(pkgs, function(p) as.character(utils::packageVersion(p, lib.loc = lib)), ""), collapse = ", "), "\n")
RS
