# Guard test: allocate 5 GiB in 512 MiB steps and touch every page. Expected to be
# killed by the cgroup before completion when run through scripts/lab-run.sh.
cat("allocate-5gib: start\n")
chunks <- list()
for (i in 1:10) {
  chunks[[i]] <- numeric(512 * 2^20 / 8)
  chunks[[i]][] <- as.numeric(i)
  cat(sprintf("allocated %d MiB\n", i * 512)); flush.console()
}
cat("allocate-5gib: completed without a kill (unexpected under the guard)\n")
