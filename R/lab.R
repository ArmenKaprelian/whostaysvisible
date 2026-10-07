# Loader: source(file.path(Sys.getenv("LAB_ROOT"), "R", "lab.R")); lab_init()
.lab <- new.env(parent = emptyenv())
local({
  root <- Sys.getenv("LAB_ROOT")
  if (!nzchar(root)) stop("LAB_ROOT is not set; run through scripts/lab-ro.sh or scripts/lab-run.sh.")
  for (f in c("lab-env.R", "lab-sources.R", "lab-duck.R", "lab-theme.R", "lab-notes.R",
              "lab-provenance.R", "lab-save.R")) {
    source(file.path(root, "R", f), local = FALSE)
  }
})
