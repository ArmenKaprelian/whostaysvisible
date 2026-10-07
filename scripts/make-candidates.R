# Merges candidates/ranking.csv with each figure's JSON into candidates/<id>.json for the gallery.
source(file.path(Sys.getenv("LAB_ROOT"), "R", "lab.R")); lab_init(quiet = TRUE)
rk <- utils::read.csv(lab_path("candidates", "ranking.csv"), stringsAsFactors = FALSE)
folder_sketch <- Sys.getenv("LAB_SKETCH_DIR", "20261007-sketch"); folder_pol <- Sys.getenv("LAB_POLISHED_DIR", "20261007-polished")
for (i in seq_len(nrow(rk))) {
  id <- rk$id[i]
  folder <- if (isTRUE(rk$finalist[i]) && file.exists(lab_path("figures", folder_pol, paste0(id, ".json")))) folder_pol else folder_sketch
  fig <- jsonlite::fromJSON(lab_path("figures", folder, paste0(id, ".json")), simplifyVector = FALSE)
  card <- list(id = id, title = fig$title, question = fig$question, rank = rk$rank[i], finalist = isTRUE(rk$finalist[i]), stage = rk$stage[i],
               script = rk$script[i], folder = folder, png = fig$png, pdf = fig$pdf, notes_tex = fig$notes_tex, notes_text = fig$notes_text,
               reading = rk$reading[i], caveats = as.list(strsplit(rk$caveats[i], "|", fixed = TRUE)[[1]]), source_line = rk$source_line[i],
               data = fig$data, width_in = fig$width_in, height_in = fig$height_in, pdf_sha256 = fig$pdf_sha256, run_id = fig$run_id)
  jsonlite::write_json(card, lab_path("candidates", paste0(id, ".json")), auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null")
}
cat("candidate cards:", nrow(rk), "\n")
