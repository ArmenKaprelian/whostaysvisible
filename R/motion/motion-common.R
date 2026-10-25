# Motion-style explainer and explorer, 22 October 2026. Shared helpers for the data pass:
# JSON/JS exports for the web pages with provenance sidecars and numeric checks. Source after
# R/lab.R and lab_init(). Nothing here is a manuscript source or an authorization.

motion_dir <- function(...) lab_dir("motion", ...)
motion_data_dir <- function() motion_dir("data")

# Every name inside a nested list or data frame, for the identifier refusal.
motion_names <- function(x) {
  if (is.data.frame(x)) return(names(x))
  if (is.list(x)) return(unique(c(names(x), unlist(lapply(x, motion_names), use.names = FALSE))))
  character()
}

# One check row; motion_checks() binds several.
motion_check <- function(check, expected, observed, tolerance = 0) {
  if (length(observed) != 1L || length(expected) != 1L) stop(sprintf("check '%s': expected %d value(s), observed %d", check, length(expected), length(observed)))
  data.frame(check = check, expected = expected, observed = observed, tolerance = tolerance)
}
motion_checks <- function(...) do.call(rbind, list(...))

MOTION_NAME_KEYS <- c("name", "name_alt", "name_filed", "name_shared", "name_case", "names", "label_long")
MOTION_NAME_ALLOWED <- list(treated = c("name", "name_filed", "name_case", "name_shared"), treatednational = c("name", "name_filed", "name_case", "name_shared"), anchors = "label_long",
                            basemap = "name")   # basemap: the names of regions and city windows (M1), place names, not firms

# Writes motion/data/<id>.json, the <id>.js global wrapper (window.MOTION_DATA[id]), a
# provenance sidecar and <id>.checks.csv. Data frames become column arrays. Stops on a
# failed check or an identifier-like name anywhere in the object.
motion_save_json <- function(obj, id, sources = .lab$used_sources, checks = NULL, extra = list(),
                             rows = NULL, digits = NA) {
  nm <- motion_names(obj)
  bad <- grep("(^|_)(inn|ogrn)(_|$)", nm, ignore.case = TRUE, value = TRUE)   # whole tokens: "pinned" is not an identifier
  if (length(bad)) stop("Motion data never carry firm identifiers: ", paste(bad, collapse = ", "))
  # Firm names ship only on the two listed-firm files and as the anchor firm's hand-typed label (author's rule, 25 October
  # 2026): firms on the five lists are named from the list files; firms on no list are never named.
  allowed <- MOTION_NAME_ALLOWED[[id]]; if (is.null(allowed)) allowed <- character()
  bad_name <- setdiff(intersect(nm, MOTION_NAME_KEYS), allowed)
  if (length(bad_name)) stop("Firm names ship only on the listed-firm files (treated, treatednational) and the anchor's hand-typed label; ", id, " carries: ", paste(bad_name, collapse = ", "))
  dir <- motion_data_dir()
  lab_run_checks(id, checks, dir)
  json <- file.path(dir, paste0(id, ".json"))
  jsonlite::write_json(obj, json, auto_unbox = TRUE, digits = digits, null = "null", na = "null", dataframe = "columns")
  txt <- paste(readLines(json, warn = FALSE), collapse = "\n")
  js <- file.path(dir, paste0(id, ".js"))
  writeLines(c("window.MOTION_DATA = window.MOTION_DATA || {};",
               paste0('window.MOTION_DATA["', id, '"] = ', txt, ";")), js, useBytes = TRUE)
  prov <- lab_provenance(id, sources, rows = rows, extra = extra)
  prov$output <- list(json = json, json_sha256 = lab_sha256(json), json_bytes = file.size(json),
                      js = js, js_sha256 = lab_sha256(js), names = nm)
  jsonlite::write_json(prov, file.path(dir, paste0(id, ".provenance.json")), auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null")
  message(sprintf("  motion data %s: %s (%.0f kB), %s", id, basename(json), file.size(json) / 1e3, basename(js)))
  invisible(json)
}

motion_read_json <- function(id) jsonlite::fromJSON(file.path(motion_data_dir(), paste0(id, ".json")), simplifyVector = TRUE)

# Base64 of little-endian integer vectors for the dense cell layers.
motion_b64_int16 <- function(x) jsonlite::base64_enc(writeBin(as.integer(x), raw(), size = 2L, endian = "little"))
motion_b64_int32 <- function(x) jsonlite::base64_enc(writeBin(as.integer(x), raw(), size = 4L, endian = "little"))
motion_b64_uint8 <- function(x) { x <- as.integer(x); if (any(x < 0 | x > 255)) stop("uint8 overflow"); jsonlite::base64_enc(as.raw(x)) }
motion_b64_float32 <- function(x) jsonlite::base64_enc(writeBin(as.numeric(x), raw(), size = 4L, endian = "little"))   # NA is written as a NaN; the page reads NaN as no value

# Format helpers used in facts.
motion_count <- function(x) format(round(x), big.mark = ",", trim = TRUE, scientific = FALSE)
motion_pct <- function(x, digits = 1) formatC(x, format = "f", digits = digits)

# ---- listed firms' display names (author's rule, 25 October 2026) --------------------------------------
# One display name per firm on the five lists, Latin on screen: the core name with the legal form abbreviated after a
# comma (AO, PAO, OOO, ZAO, OAO, FGUP, GUP, IP and the like for Russian forms; LLC, JSC, PJSC, Ltd only where the source
# string is itself English), capped at 60 characters with an ellipsis. The script: (1) the sanctions file's Latin alias
# that transliterates the filed Cyrillic core (compared after transliteration and normalisation, accepted at a similarity
# of 0.85 or above), (2) else our own transliteration (BGN/PCGN 1947 for Russian, plain form, marked case 2), (3) a name
# filed in Latin as it is. Never a former or foreign-language alias. The full filed name travels beside the display name.
MOTION_CYR_FORMS <- c(   # spelled-out Russian legal forms, longest first; the tag is the transliterated abbreviation
  "федеральное государственное автономное образовательное учреждение высшего (профессионального )?образования" = "FGAOU VO",
  "федеральное государственное бюджетное образовательное учреждение высшего (профессионального )?образования" = "FGBOU VO",
  "федеральное государственное бюджетное научное учреждение" = "FGBNU", "федеральное государственное бюджетное учреждение науки" = "FGBUN",
  "федеральное государственное унитарное предприятие" = "FGUP", "федеральное государственное бюджетное учреждение" = "FGBU",
  "федеральное государственное автономное учреждение" = "FGAU", "федеральное государственное казенное учреждение" = "FGKU",
  "федеральное государственное учреждение" = "FGU", "федеральное казенное предприятие" = "FKP",
  "государственное унитарное предприятие( республики крым)?" = "GUP", "государственное бюджетное учреждение" = "GBU",
  "муниципальное унитарное предприятие" = "MUP", "публичное акционерное общество" = "PAO", "открытое акционерное общество" = "OAO",
  "закрытое акционерное общество" = "ZAO", "акционерное общество" = "AO", "общество с ограниченной ответственностью" = "OOO",
  "автономная некоммерческая организация" = "ANO", "некоммерческое партнерство" = "NP", "индивидуальный предприниматель" = "IP")
MOTION_CYR_ABBR <- c("фгуп" = "FGUP", "фгбу" = "FGBU", "гуп" = "GUP", "муп" = "MUP", "пао" = "PAO", "оао" = "OAO", "зао" = "ZAO", "ооо" = "OOO", "ано" = "ANO", "ао" = "AO", "нп" = "NP", "ип" = "IP")
MOTION_LAT_FORMS <- c(   # English and transliterated forms; the English ones keep their English tag
  "public joint[ -]stock company" = "PJSC", "open joint[ -]stock company" = "OJSC", "closed joint[ -]stock company" = "CJSC",
  "joint[ -]stock company" = "JSC", "limited liability company" = "LLC", "limited liability partnership" = "LLP",
  "federal state unitary enterprise" = "FSUE", "publichnoe aktsionernoe obshchestvo" = "PAO", "otkrytoe aktsionernoe obshchestvo" = "OAO",
  "zakrytoe aktsionernoe obshchestvo" = "ZAO", "aktsionernoe obshchestvo" = "AO", "obshchestvo s ogranichenno[iy] otvetstvennost[iy]?yu" = "OOO",
  "federalnoe gosudarstvennoe unitarnoe predpriyatie" = "FGUP")
MOTION_LAT_ABBR <- c("pjsc" = "PJSC", "ojsc" = "OJSC", "cjsc" = "CJSC", "jsc" = "JSC", "llc" = "LLC", "llp" = "LLP", "fsue" = "FSUE", "fgup" = "FGUP",
                     "ltd\\.?" = "Ltd", "limited" = "Ltd", "inc\\.?" = "Inc", "gmbh" = "GmbH", "ooo" = "OOO", "oao" = "OAO", "pao" = "PAO", "zao" = "ZAO", "ao" = "AO", "gup" = "GUP")
MOTION_ABBREV <- c("научно-исследовательский институт" = "НИИ", "научно-производственное предприятие" = "НПП", "научно-производственное объединение" = "НПО",
                   "центральное конструкторское бюро" = "ЦКБ", "опытно-конструкторское бюро" = "ОКБ", "конструкторское бюро" = "КБ", "научно-технический центр" = "НТЦ",
                   "научно-производственный центр" = "НПЦ", "российской академии наук" = "РАН", "имени" = "им.")
MOTION_TRANSLIT <- c(   # BGN/PCGN 1947, plain form (no diacritics; the hard and soft signs dropped); the Ukrainian letters for aliases
  "а" = "a", "б" = "b", "в" = "v", "г" = "g", "д" = "d", "е" = "e", "ё" = "yo", "ж" = "zh", "з" = "z", "и" = "i", "й" = "y", "к" = "k", "л" = "l", "м" = "m",
  "н" = "n", "о" = "o", "п" = "p", "р" = "r", "с" = "s", "т" = "t", "у" = "u", "ф" = "f", "х" = "kh", "ц" = "ts", "ч" = "ch", "ш" = "sh", "щ" = "shch",
  "ъ" = "", "ы" = "y", "ь" = "", "э" = "e", "ю" = "yu", "я" = "ya", "і" = "i", "ї" = "yi", "є" = "ye", "ґ" = "g")
motion_has_cyr <- function(x) grepl("[\u0400-\u04ff]", x, perl = TRUE)
motion_translit <- function(x) {   # lower-case input; е becomes ye at a word start and after a vowel or a sign
  x <- tolower(x)
  x <- gsub("(^|[^\\p{L}]|[аеёиоуыэюяъь])е", "\\1ye", x, perl = TRUE)
  for (ch in names(MOTION_TRANSLIT)) x <- gsub(ch, MOTION_TRANSLIT[[ch]], x, fixed = TRUE)
  x
}
motion_title <- function(x) gsub("(^|[\\s(\"'-])(\\p{Ll})", "\\1\\U\\2", x, perl = TRUE)
motion_norm <- function(x) gsub("[^a-z0-9]+", "", tolower(x), perl = TRUE)
motion_strip_form <- function(x) {   # the core and the tag of one filed name (Cyrillic or Latin); x already trimmed
  tag <- ""; english <- FALSE
  rx <- function(pat) paste0("(*UCP)^(", pat, ")(\\s*\\([^)]{2,10}\\))?[\\s:,-]+")
  for (f in names(MOTION_CYR_FORMS)) if (grepl(rx(f), x, perl = TRUE, ignore.case = TRUE)) { tag <- MOTION_CYR_FORMS[[f]]; x <- sub(rx(f), "", x, perl = TRUE, ignore.case = TRUE); break }
  if (!nzchar(tag)) for (f in names(MOTION_LAT_FORMS)) if (grepl(rx(f), x, perl = TRUE, ignore.case = TRUE)) { tag <- MOTION_LAT_FORMS[[f]]; english <- TRUE; x <- sub(rx(f), "", x, perl = TRUE, ignore.case = TRUE); break }
  if (!nzchar(tag)) for (f in names(MOTION_CYR_ABBR)) { pat <- paste0("(*UCP)^", f, "[\\s:,-]+"); if (grepl(pat, x, perl = TRUE, ignore.case = TRUE)) { tag <- MOTION_CYR_ABBR[[f]]; x <- sub(pat, "", x, perl = TRUE, ignore.case = TRUE); break } }
  if (!nzchar(tag)) for (f in names(MOTION_LAT_ABBR)) { pat <- paste0("(*UCP)^", f, "[\\s:,-]+"); if (grepl(pat, x, perl = TRUE, ignore.case = TRUE)) { tag <- MOTION_LAT_ABBR[[f]]; english <- TRUE; x <- sub(pat, "", x, perl = TRUE, ignore.case = TRUE); break } }
  if (!nzchar(tag)) {   # a trailing abbreviation ("aeroflot - russian airlines pjsc", "сибкапитал ооо")
    for (f in c(names(MOTION_LAT_ABBR), names(MOTION_CYR_ABBR))) { pat <- paste0("(*UCP)[\\s,-]+", f, "\\.?$"); if (grepl(pat, x, perl = TRUE, ignore.case = TRUE)) { tag <- c(MOTION_LAT_ABBR, MOTION_CYR_ABBR)[[f]]; english <- f %in% names(MOTION_LAT_ABBR); x <- sub(pat, "", x, perl = TRUE, ignore.case = TRUE); break } }
  }
  list(core = x, tag = tag, english = english)
}
motion_clean_core <- function(x) {   # quotes, guillemets and loose punctuation around the core; balanced inner pairs stay
  x <- gsub("^[\\s,;:-]+|[\\s,;:-]+$", "", x, perl = TRUE)
  x <- sub("^[\"«“„']\\s*", "", x, perl = TRUE)
  q <- lengths(regmatches(x, gregexpr("[\"«»“”„']", x, perl = TRUE)))
  if (q %% 2 == 1 && grepl("[\"»”“']$", x, perl = TRUE)) x <- sub("\\s*[\"»”“']$", "", x, perl = TRUE)
  q <- lengths(regmatches(x, gregexpr("[\"«»“”„']", x, perl = TRUE)))
  if (q %% 2 == 1) x <- sub("[\"«»“”„']", "", x, perl = TRUE)
  gsub("^[\\s,;:-]+|[\\s,;:-]+$", "", x, perl = TRUE)
}
# A cut inside a quoted part drops the orphan opening quote (author's fix, 25 October 2026): an odd count of straight
# quotes loses the last one, an opening guillemet or curly quote without its close likewise; trailing separators go.
motion_drop_orphan <- function(s) {
  cnt <- function(ch) nchar(s) - nchar(gsub(ch, "", s, fixed = TRUE))
  drop_last <- function(ch) { p <- max(gregexpr(ch, s, fixed = TRUE)[[1]]); paste0(substr(s, 1, p - 1), substr(s, p + 1, nchar(s))) }
  if (cnt('"') %% 2 == 1) s <- drop_last('"')
  for (pr in list(c("\u00ab", "\u00bb"), c("\u201c", "\u201d"))) if (cnt(pr[1]) > cnt(pr[2])) s <- drop_last(pr[1])
  gsub("[\\s,;:-]+$", "", s, perl = TRUE)
}
motion_display_one <- function(raw, aliases, threshold = 0.85) {
  out <- list(name = "", name_filed = "", name_case = 0L, latin = "", core = "", tag = "", similarity = NA_real_, capped = FALSE)
  if (is.na(raw) || !nzchar(trimws(raw))) return(out)
  x <- gsub("\\s+", " ", trimws(raw)); out$name_filed <- x
  # look-alike Latin letters inside Cyrillic words
  toks <- strsplit(x, " ", fixed = TRUE)[[1]]
  cyr <- grepl("[\u0400-\u04ff]", x, perl = TRUE)
  mixed <- (grepl("[\u0400-\u04ff]", toks, perl = TRUE) & grepl("[A-Za-z]", toks, perl = TRUE)) | (cyr & grepl("^[aceopxyABCEHKMOPTXYk]{1,2}$", toks, perl = TRUE))   # a mixed token, or a lone look-alike letter in a Cyrillic name
  toks[mixed] <- chartr("aceopxyABCEHKMOPTXYk", "асеорхуАВСЕНКМОРТХУк", toks[mixed]); x <- paste(toks, collapse = " ")
  x <- gsub("\\s*<\\*+>", "", x, perl = TRUE); x <- sub("\\.\\s*$", "", x, perl = TRUE)
  x <- sub("(*UCP)\\s*\\((г|с|п|пос|пгт|д|рп|ст|х)\\.?\\s[^()]*\\)$", "", x, perl = TRUE, ignore.case = TRUE)
  x <- sub("(*UCP)\\s*\\([^()]*(область|край|республика|округ|автономн)[^()]*\\)$", "", x, perl = TRUE, ignore.case = TRUE)
  x <- sub("(*UCP),\\s*(г\\.\\s*)?[^,\"«»]*?(область|край|республика|округ|москва|санкт-петербург|севастополь|югра)[^,\"«»]*$", "", x, perl = TRUE, ignore.case = TRUE)
  tag <- ""; english <- FALSE
  m <- regmatches(x, regexec("(*UCP)\\s*\\((публичное акционерное общество|открытое акционерное общество|закрытое акционерное общество|акционерное общество|общество с ограниченной ответственностью)\\)$", x, perl = TRUE, ignore.case = TRUE))[[1]]
  if (length(m)) { tag <- MOTION_CYR_FORMS[[tolower(m[2])]]; x <- sub("(*UCP)\\s*\\([^()]*\\)$", "", x, perl = TRUE) }
  if (grepl(";", x, fixed = TRUE)) {   # ";"-joined entries: the first segment that starts with a legal form, else the first
    segs <- trimws(strsplit(x, ";", fixed = TRUE)[[1]]); pick <- segs[1]
    for (s in segs) if (nzchar(motion_strip_form(s)$tag)) { pick <- s; break }
    x <- pick
  }
  if (!nzchar(tag)) { sf <- motion_strip_form(x); x <- sf$core; tag <- sf$tag; english <- sf$english }
  x <- motion_clean_core(x)
  for (ab in names(MOTION_ABBREV)) x <- gsub(paste0("(*UCP)\\b", ab, "\\b"), MOTION_ABBREV[[ab]], x, perl = TRUE, ignore.case = TRUE)
  x <- gsub("\\s+", " ", trimws(x)); out$core <- x; out$tag <- tag
  if (!nzchar(x)) return(out)
  if (!motion_has_cyr(x)) { latin <- motion_title(tolower(x)); if (x == toupper(x) && nchar(x) <= 6) latin <- x; out$name_case <- 3L }   # filed in Latin (a short all-caps name stays)
  else {
    target <- motion_norm(motion_translit(x)); best <- NA_real_; best_alias <- ""
    for (al in aliases) {
      if (!nzchar(al) || motion_has_cyr(al)) next
      ac <- motion_clean_core(motion_strip_form(gsub("\\s+", " ", trimws(al)))$core); an <- motion_norm(ac)
      if (!nzchar(an) || !nzchar(target)) next
      sim <- 1 - utils::adist(an, target)[1, 1] / max(nchar(an), nchar(target))
      if (is.na(best) || sim > best) { best <- sim; best_alias <- ac }
    }
    out$similarity <- best
    if (!is.na(best) && best >= threshold) { latin <- motion_title(tolower(best_alias)); out$name_case <- 1L }
    else { latin <- motion_title(motion_translit(x)); out$name_case <- 2L }
  }
  out$latin <- latin
  tail <- if (nzchar(tag)) paste0(", ", tag) else ""
  room <- 60L - nchar(tail)
  if (nchar(latin) > room) {
    cut <- substr(latin, 1, room - 1); sp <- max(gregexpr(" ", cut)[[1]]); if (sp > room / 2) cut <- substr(cut, 1, sp - 1)
    latin <- paste0(motion_drop_orphan(cut), "\u2026"); out$capped <- TRUE
  }
  out$name <- paste0(latin, tail)
  out
}
# Vectorised over a list union: raw (the chosen filed name), aliases (a list of character vectors, the sanctions file's
# name_alt split on " | "). Returns a data frame; name_shared counts the list members sharing the display name.
motion_display_names <- function(raw, aliases, threshold = 0.85) {
  stopifnot(l10n_info()[["UTF-8"]])
  res <- Map(function(r, a) motion_display_one(r, a, threshold), raw, aliases)
  d <- data.frame(name = vapply(res, `[[`, "", "name"), name_filed = vapply(res, `[[`, "", "name_filed"), name_case = vapply(res, `[[`, 0L, "name_case"),
                  latin = vapply(res, `[[`, "", "latin"), core = vapply(res, `[[`, "", "core"), tag = vapply(res, `[[`, "", "tag"),
                  similarity = vapply(res, `[[`, NA_real_, "similarity"), capped = vapply(res, `[[`, FALSE, "capped"), stringsAsFactors = FALSE)
  shared <- table(d$name[nzchar(d$name)]); d$name_shared <- ifelse(nzchar(d$name), as.integer(shared[d$name]), 0L)
  d
}
