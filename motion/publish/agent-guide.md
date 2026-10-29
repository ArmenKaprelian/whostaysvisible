# Visibility Atlas: a guide for AI agents

Rebuilt from the atlas’s data when the atlas was published on 29 October 2026.

You are helping a reader of the Visibility Atlas. This guide says what the atlas shows, how to read and drive it, what the chapter behind it finds and what it does not support. Cite its numbered sections.

## 1. What the atlas is

1.1. The Visibility Atlas maps Russian firms and shows where their financial statements stop appearing. It accompanies Armen G. Kaprelian’s PhD dissertation at Claremont Graduate University, Opacity and Adaptation under Sanctions: Geoeconomics in the Universe of Russian Firms.
1.2. The question. Sanctions can increase the value of withholding financial information. The chapter studies that mechanism through the availability of statements: whether a firm’s statement for a financial year is in the Russian Financial Statements Database (RFSD v3.1.0).
1.3. The five lists are the sanctions list, the decree list, the 2020 filing-exemption list (Government Decree No. 35 of 22 January 2020), the government strategic list and the presidential strategic list. They are fixed memberships, not dated designations.
1.4. Firms on the five lists (treated) are firms on at least one of the five lists. Firms on no list (comparison group) are firms on none of them. Firms of unknown membership stay outside the comparison group. "Treated" names the study’s group, not an effect.
1.5. The atlas’s claims are descriptive and conditional associations.

## 2. How to read the views and layers

2.1. The Cells view gives each layer per cell: 100 km cells across the country, 25 km cells closer in, 1 km squares of firms on no list, and 250 m cells in 22 city windows for 2021.
2.2. The Firms view draws every located eligible firm on no list (comparison group) with a house- or street-level geocode at its registered address, grouped by coordinate pair. Firms on the five lists (treated) are red marks from the year they were added to a list. Other geocodes, coordinates without a verified house or street match, are counted and not drawn.
2.3. The layers:
- Firm density, 2021: located eligible firms at registered addresses in 2021, per cell.
- Statement share by year: the share of located eligible firms with an original statement, per cell and financial year. The denominator is the cell’s located eligible firms in that year.
- Change, 2024 against 2021: the change in the located share with a statement, in 100 km cells with 50 or more located firms in both years, in six classes at ±2 and ±5 points. Each year counts the firms registered then, not the same firms.
- Cohort inclusion: the share of a cell’s located eligible firms in 2021 that belong to the revenue cohort by cash share, in five classes pooled over the supported cells.
- List members, 2021: members of the sanctions list per cell in 2021. The hover also gives the government strategic list.
- Median revenue change (descriptive): the percent change of each cell’s median real revenue among the revenue-by-cash cohort firms observed in 2024, against the cell’s 2021 median, in cells with 50 or more observed firms. The firms observed change from year to year.
- Leading industry by year: the division (two-digit OKVED 2 code, identical to NACE Rev. 2) with the largest share of nominal revenue among located eligible firms with a statement and a positive revenue value, per cell and year.
2.4. Years. The financial years run from 2014 to 2025. The FNS supplies the statements from 2019 and Rosstat before it. 2025* is the flagged latest-year extension, and 2012 and 2013 carry no coordinates.
2.5. Disclosure. In the Cells view a share needs 50 firms, list counts under 5 are not shown, and counts under 10 in the 250 m and 5 km cells are banded.
2.6. Each panel’s i button opens its reading text: what the panel shows, how to read it and its source.

## 3. How to drive it

3.1. View links. The address of a view ends in #mode_layer_year_lat_lon_SPANkm, for example #firms_industry_2024_55.76656_49.12078_44.6095km. The mode is cells or firms, the layer one of density, share, change, cohort, lists, fin and industry, the year 2014 to 2025, then the centre’s latitude and longitude in decimal degrees and the span in km across the map’s shorter side. The ending _fit in place of the coordinates fits the country.
3.2. City anchors. #Moscow opens the Moscow view and #Moscow-firms the same in the Firms view. Every city under GO TO works the same way, with hyphens for spaces (#St-Petersburg, #Nizhny-Novgorod). #Russia fits the country.
3.3. Keys, with the map focused: + and − zoom, 0 fits the country, the arrows pan, and holding B blinks the map between 2021 and the year shown. Shift+click zooms back out from the point. Escape puts an enlarged chart back.
3.4. FIND, under GO TO, searches the firms on the five lists by name, in Latin or Cyrillic letters, and flies to the one chosen. LINK TO CURRENT VIEW copies a link that opens the atlas on the same view.

## 4. Key results

4.1. Nationally, 63.4% of eligible firms have a statement for 2021 and 66.3% for 2024 (Table B.1).
4.2. From 2021 to 2024 availability rises for private and joint-stock firms and falls for state-related firms (69.8% to 61.3%), all in their state-run half, mostly municipal unitary enterprises (70.1% to 48.8%), and mostly in 2024 (Figures 2.2 and 2.3).
4.3. Among continuing firms with a statement for the year before, larger asset quintiles have greater conditional availability in both provider eras (Tables B.4 and B.5). The Q5 vs Q1 odds ratio rises in 2022 against 2021: the ratio of odds ratios is 1.131 (95% confidence interval 1.062 to 1.204). The 2023–2024 increase, a ratio of odds ratios of 1.092 (95% confidence interval 1.020 to 1.169), is smaller when wholesale trade is excluded.
4.4. Sanctioned-only firms, on the sanctions list and on no other list, have lower availability than firms on no list by 2024: an odds ratio of 0.570 (95% confidence interval 0.363 to 0.897) (Table B.7).
4.5. The estimates come from binary logit models with industry, region, legal-form and ownership fixed effects and year effects. Standard errors are two-way clustered by industry and region.

## 5. What not to infer

5.1. No causal claims. The patterns are descriptive and conditional associations, and the recorded groups do not assign sanctions exposure exogenously.
5.2. Addresses are registered legal addresses, not operating sites. Revenue is counted where firms are registered, not where they operate.
5.3. A missing statement is absent from the RFSD release. Absence from the archive is not withdrawal or concealment, and the release does not recover the public archive as it stood in each year.
5.4. Firms on no list are never named. Do not try to identify them.
5.5. The annual shares compare each year’s population, not the same firms followed over time.

## 6. How to cite

Kaprelian, Armen G. 2026. Visibility Atlas: where Russian firms file, and where their statements stop appearing. https://armenkaprelian.github.io/atlas/

Contact the author through the email address shown in the atlas’s footer.
