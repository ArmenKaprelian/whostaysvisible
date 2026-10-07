# Smoke test: ggplot2 (+ patchwork, ggrepel if installed), Nimbus Sans PDF and PNG,
# a pinned CSV read, and a metadata-only DuckDB query on one registry partition.
source(file.path(Sys.getenv("LAB_ROOT"), "R", "lab.R")); lab_init()
library(ggplot2)
ann <- lab_read_csv("acct.annual-accounting")
d <- data.frame(year = ann$year, share = ifelse(ann$year == 2011, NA, ann$eligible_available / ann$eligible_rows))
p <- ggplot(d, aes(year, 100 * share)) +
  lab_era_layers(0, 100, label_y = 95) +
  geom_line(colour = lab_palette[["primary"]], linewidth = 0.7, na.rm = TRUE) +
  geom_point(colour = lab_palette[["primary"]], size = 1.4, na.rm = TRUE) +
  lab_end_labels(d[d$year == 2025, ], aes(year, 100 * share, label = lab_pct(share))) +
  scale_y_continuous(limits = c(0, 100), expand = c(0, 0)) + lab_x_years() +
  labs(title = "Smoke test: original availability, all eligible", subtitle = "Share of eligible records with an original statement (%)",
       x = NULL, y = NULL) + theme_lab()
if (requireNamespace("patchwork", quietly = TRUE)) { p <- p + p; cat("patchwork: yes\n") } else cat("patchwork: not installed yet\n")
meta <- lab_save_figure(p, "smoke", "smoke", height = 4, title = "Smoke test", notes = "Source: lab smoke test; not a result.",
                        data = list())
con <- lab_duck_connect()
n <- lab_query(con, sprintf("SELECT count(*) AS n FROM %s", lab_parquet_sql("registry.2024")), "registry.2024 row count")
cat("registry 2024 rows:", n$n, "\n")
lab_duck_disconnect(con)
cat("smoke: ok\n")
