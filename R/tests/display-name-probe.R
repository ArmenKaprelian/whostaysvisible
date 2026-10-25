# Probe of the listed firms' display-name rule (25 October 2026): twelve filed strings and their expected displays. Read-only.
source(file.path(Sys.getenv("LAB", "."), "R", "motion", "motion-common.R"))
cases <- list(
  list("dolphin alabuga llc", character(), "Dolphin Alabuga, LLC", 3L),
  list("ooo iaz", character(), "Iaz, OOO", 3L),
  list("joint stock company scientific production enterprise research and design institute of well logging", character(), "Scientific Production Enterprise Research And Design…, JSC", 3L),
  list("акционерное общество \"салаватский химический завод\"", c("salavat chemical plant jsc", "jsc salavatskiy khimicheskiy zavod"), "Salavatskiy Khimicheskiy Zavod, AO", 1L),
  list("открытое акционерное общество «кумертаусское авиационное производственное предприятие»", character(), "Kumertausskoye Aviatsionnoye Proizvodstvennoye…, OAO", 2L),
  list("мтс; публичное акционерное общество \"мобильные телесистемы\"", c("mobile telesystems pjsc", "mts"), "Mobilnyye Telesistemy, PAO", 2L),
  list("Публичное акционерное общество \"Акционерная нефтяная Компания \"Башнефть\" (г. Уфа).", c("pjsc aktsionernaya neftyanaya kompaniya bashneft", "bashneft"), "Aktsionernaya Neftyanaya Kompaniya Bashneft, PAO", 1L),
  list("Акционерное общество \"Машиностроительная компания \"Витязь\", Республика Башкортостан", character(), "Mashinostroitelnaya Kompaniya \"Vityaz\", AO", 2L),
  list("Уфимский завод микроэлектроники \"Магнетрон\", Республика Башкортостан", character(), "Ufimskiy Zavod Mikroelektroniki \"Magnetron\"", 2L),
  list("общество c ограниченной ответственностью мв", character(), "Mv, OOO", 2L),
  list("aeroflot - russian airlines pjsc", character(), "Aeroflot - Russian Airlines, PJSC", 3L),
  list("политическая партия \"коммунистическая партия российской федерации \"", character(), "Politicheskaya Partiya Kommunisticheskaya Partiya…", 2L))
d <- motion_display_names(vapply(cases, `[[`, "", 1), lapply(cases, `[[`, 2))
ok <- TRUE
for (i in seq_along(cases)) {
  exp <- cases[[i]][[3]]; got <- d$name[i]; cs <- d$name_case[i]
  status <- if (identical(got, exp) && cs == cases[[i]][[4]]) "ok " else { ok <- FALSE; "BAD" }
  cat(sprintf("%s  %-62s case %d (sim %s)  <- %s\n", status, got, cs, ifelse(is.na(d$similarity[i]), "-", sprintf("%.2f", d$similarity[i])), substr(cases[[i]][[1]], 1, 70)))
  if (status == "BAD") cat(sprintf("     expected %s (case %d)\n", exp, cases[[i]][[4]]))
}
cat(if (ok) "display-name probe: all cases as expected\n" else "display-name probe: differences above\n")
