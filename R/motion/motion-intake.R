# The checked intake for an exported table (round 18, 27 October 2026): a data frame checked against a schema, then saved through
# motion_save_json() with its .js twin, provenance and checks. Source after R/motion/motion-common.R.
#
# A schema is a list of general rules; a rule left out is not checked:
#   columns    named character vector, column = "integer" | "numeric" | "character" | "logical": every column present, no other, each of its type
#   keys       the columns that identify a row: no two rows share them
#   allowed    named list, column = its allowed values (NA only where listed)
#   years      list(column, rules = list(list(when = list(col = value, ...), min, max, na), ...)): each row takes the first rule whose `when`
#              it matches (an empty `when` matches every row) and its year lies in that rule's range, or is missing where the rule has
#              na = TRUE (a pooled estimate); a row that matches no rule is refused
#   omitted    list(column, estimate, interval = c(low, high), value = 0, series = c(...), rules = list(list(when = ..., year = ...), ...)):
#              at its rule's omitted year a row carries the value and no interval, and every series (each combination of the series
#              columns that a rule covers) has that row
#   only_when  list(list(column, value, when = list(col = value, ...)), ...): a row with that value only where the condition holds
#   intervals  list(list(estimate, low, high), ...): low <= estimate <= high wherever all three are present
#   support    list(count, min, figures = c(...)): a row whose count is under min carries none of the figures (the support rule)
# A broken rule stops the intake before anything is written, naming every failure. motion_intake_csv() reads a CSV with the schema's
# column classes (so a code such as "00010" stays text) and empty or NA fields as missing; motion_intake_pinned() reads an export
# pinned in config/sources.json that way, through lab_source(), which checks its size, date and hash against the pin.

motion_intake_matches <- function(df, when) {   # the rows whose columns equal the condition's values
  ok <- rep(TRUE, nrow(df))
  for (k in names(when)) ok <- ok & !is.na(df[[k]]) & as.character(df[[k]]) == as.character(when[[k]])
  ok
}

motion_intake_rules <- function(df, schema) {   # every rule with its count of failures (0 where it holds) and the rows or names it found
  out <- list()
  note <- function(rule, n, what = "") out[[length(out) + 1L]] <<- list(rule = rule, n = as.integer(n), what = what)
  rows <- function(m) if (any(m)) paste0("rows ", paste(utils::head(which(m), 8), collapse = ", "), if (sum(m) > 8) ", ..." else "") else ""
  cols <- schema$columns
  if (!is.null(cols)) {
    miss <- setdiff(names(cols), names(df)); extra <- setdiff(names(df), names(cols))
    note("columns", length(miss) + length(extra), paste(c(if (length(miss)) paste("missing", paste(miss, collapse = ", ")),
                                                          if (length(extra)) paste("not in the schema", paste(extra, collapse = ", "))), collapse = "; "))
    is_type <- list(integer = function(x) is.numeric(x) && all(is.na(x) | x == round(x)), numeric = is.numeric, character = is.character, logical = is.logical)
    wrong <- Filter(function(k) k %in% names(df) && !isTRUE(is_type[[cols[[k]]]](df[[k]])), names(cols))
    note("types", length(wrong), paste(wrong, collapse = ", "))
  }
  have <- function(ks) all(ks %in% names(df))
  needs <- function(rule, ks) { miss <- setdiff(unlist(ks), names(df)); if (length(miss)) note(paste(rule, "names a missing column"), length(miss), paste(miss, collapse = ", ")); !length(miss) }   # a misspelt column fails, never passes unchecked
  for (r in schema$years$rules) if (is.null(r$min) || is.null(r$max)) stop("intake schema: every years rule needs min and max", call. = FALSE)
  if (length(schema$keys) && needs("keys", schema$keys)) { d <- duplicated(df[schema$keys]); note("keys", sum(d), rows(d)) }
  for (k in names(schema$allowed)) if (needs(paste("allowed", k), k)) { m <- !(df[[k]] %in% schema$allowed[[k]]); note(paste("allowed", k), sum(m), rows(m)) }
  yr <- schema$years
  if (!is.null(yr) && needs("years", c(yr$column, unlist(lapply(yr$rules, function(r) names(r$when)))))) {
    hit <- rep(NA_integer_, nrow(df))
    for (j in seq_along(yr$rules)) { m <- is.na(hit) & motion_intake_matches(df, yr$rules[[j]]$when); hit[m] <- j }
    lo <- vapply(yr$rules, function(r) as.numeric(r$min), 0)[hit]; hi <- vapply(yr$rules, function(r) as.numeric(r$max), 0)[hit]
    na_ok <- vapply(yr$rules, function(r) isTRUE(r$na), TRUE)[hit]; na_ok[is.na(na_ok)] <- FALSE
    y <- df[[yr$column]]; m <- is.na(hit) | (is.na(y) & !na_ok) | (!is.na(y) & (y < lo | y > hi)); m[is.na(m)] <- TRUE
    note("years", sum(m), rows(m))
  }
  om <- schema$omitted
  if (!is.null(om) && needs("omitted year", c(om$column, om$estimate, om$interval, om$series, unlist(lapply(om$rules, function(r) names(r$when)))))) {
    v <- if (is.null(om$value)) 0 else om$value
    oy <- rep(NA_real_, nrow(df))
    for (r in om$rules) { m <- is.na(oy) & motion_intake_matches(df, r$when); oy[m] <- r$year }
    at <- !is.na(oy) & !is.na(df[[om$column]]) & df[[om$column]] == oy
    e <- df[[om$estimate]]; filled <- if (length(om$interval)) rowSums(!is.na(as.matrix(df[om$interval]))) > 0 else rep(FALSE, nrow(df))
    m <- at & (is.na(e) | abs(e - v) > 1e-12 | filled); note("omitted year", sum(m), rows(m))
    if (length(om$series)) {
      key <- do.call(paste, c(unname(as.list(df[om$series])), sep = "\r"))
      ruled <- tapply(!is.na(oy), key, any); has <- tapply(at, key, any)
      note("omitted year present", sum(ruled & !has), paste(utils::head(gsub("\r", "/", names(which(ruled & !has))), 6), collapse = "; "))
    }
  }
  for (r in schema$only_when) if (needs(sprintf("only when: %s %s", r$column, r$value), c(r$column, names(r$when)))) {
    m <- !is.na(df[[r$column]]) & as.character(df[[r$column]]) == as.character(r$value) & !motion_intake_matches(df, r$when)
    note(sprintf("only when: %s %s", r$column, r$value), sum(m), rows(m))
  }
  for (iv in schema$intervals) if (needs(paste("interval", iv$estimate), c(iv$estimate, iv$low, iv$high))) {
    e <- df[[iv$estimate]]; l <- df[[iv$low]]; h <- df[[iv$high]]
    m <- !is.na(e) & !is.na(l) & !is.na(h) & (l > e | e > h); note(paste("interval", iv$estimate), sum(m), rows(m))
  }
  sp <- schema$support
  if (!is.null(sp) && needs("support", c(sp$count, sp$figures))) {
    shown <- if (length(sp$figures)) rowSums(!is.na(as.matrix(df[sp$figures]))) > 0 else rep(FALSE, nrow(df))
    m <- !is.na(df[[sp$count]]) & df[[sp$count]] < sp$min & shown; note("support", sum(m), rows(m))
  }
  out
}

motion_intake_table <- function(df, id, schema, dir = motion_data_dir(), sources = .lab$used_sources, extra = list(), notes = character()) {
  df <- as.data.frame(df, stringsAsFactors = FALSE)
  rules <- motion_intake_rules(df, schema)
  failed <- Filter(function(r) r$n > 0L, rules)
  if (length(failed)) stop(sprintf("intake %s refused, nothing written: %s", id,
                                   paste(vapply(failed, function(r) sprintf("%s (%d%s)", r$rule, r$n, if (nzchar(r$what)) paste0(": ", r$what) else ""), ""), collapse = "; ")), call. = FALSE)
  checks <- do.call(motion_checks, c(list(motion_check("rows", nrow(df), nrow(df))), lapply(rules, function(r) motion_check(paste("rule:", r$rule), 0, r$n))))
  obj <- list(rows = nrow(df), columns = names(df), table = df, notes = as.list(notes))
  motion_save_json(obj, id, sources = sources, checks = checks, extra = c(extra, list(intake = list(schema = schema))), rows = nrow(df), dir = dir)
}

motion_intake_classes <- function(schema) unlist(schema$columns)   # the schema's types are read.csv's column classes
motion_intake_csv <- function(path, schema) utils::read.csv(path, colClasses = motion_intake_classes(schema), na.strings = c("", "NA"), check.names = FALSE, stringsAsFactors = FALSE)
motion_intake_pinned <- function(source, id, schema, ...) motion_intake_table(motion_intake_csv(lab_source(source), schema), id, schema, ...)   # lab_source() checks the pin and records the source as used
