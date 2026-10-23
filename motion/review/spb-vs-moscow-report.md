# St Petersburg against Moscow under the M6 definitions

Read-only diagnostic, 2026-10-23. Run `20261023T065747Z-ro-zz-spb-scan.R` through `scripts/lab-ro.sh` with DuckDB at the launcher defaults (memory limit 1536MB, 2 threads, temp cap 5GB). Total 41 s; the firm-year table was built one year at a time with the M6-common SQL text (2014 1 s, 2015 1 s, 2016 1 s, 2017 1 s, 2018 1 s, 2019 1 s, 2020 1 s, 2021 1 s, 2022 1 s, 2023 1 s, 2024 1 s, 2025 1 s).

Definitions are those of `R/motion/M6-common.R` and `R/motion/M6-treated.R`, parameterised by city: the registry (eligible_raw = 1) joined to the payload on year and source row, the Lambert azimuthal projection to x/y km, three 16:9 rectangles centred on the basemap reference point of each city (160 x 90, 64 x 36 and 21.33 x 12 km), firm-years without an identifier left out, one treated bucket (any supplied list), red from the sanctions file's first start year clamped to 2014 (residents-only firms 2020, other undated members 2014), baseline = the firm's 2019-2021 average real revenue over statements with positive revenue (two of three years), real revenue = line 2110 times the GDP deflator rebased to 2021, pct = 100 x (real revenue / baseline - 1), the relative metric = pct minus the year's median pct of the drawn firms on no list in the same city, city-level geocodes excluded from the drawn firms, classes under the breaks -50 / -20 / 0 / +50 / +150. The baseline and the yearly median are computed within each city's 160 x 90 km population, as M6 does for Moscow. A firm present in both cities over the years is treated separately in each (none expected within 660 km).

**Cross-checks against the lab's Moscow outputs:** 55 of 55 passed (points.json written 2026-10-23 02:36:48.538279, metric kind "relative"; treated.json; moscowcomparison.json). The Moscow side therefore reproduces the sequence's own counters, medians, class counts and comparison groups, and the St Petersburg side is the same code on the other rectangle.

**Population (160 x 90 km rectangle, 2014-2025):**

|  | Moscow | St Petersburg |
|:---|---:|---:|
| firms with an identifier (any year) | 2,572,813 | 714,101 |
| listed (treated) firms | 2,220 | 700 |
| of which in the sanctions file (dated, named) | 2,018 | 641 |
| of which residents-list only (red from 2020) | 2 | 0 |
| of which undated (red from 2014) | 200 | 59 |
| listed in 2022 | 429 | 124 |
| firms on no list with a baseline | 335,342 | 137,698 |
| eligible firm-years without an identifier (excluded) | 8 | 0 |

## 1. Listed firms present, red by year, share of red firms without a statement

Present = treated firms with a registry row that year inside the extent (firm-year coordinates); red = present and red-from reached; no statement = red and no original filing that year. The share is red firms without a statement over red firms.

### 160 x 90 km

| year | Msk present | Msk red | Msk red, no stmt | Msk % | SPb present | SPb red | SPb red, no stmt | SPb % |
|:---|---:|---:|---:|---:|---:|---:|---:|---:|
| 2014 | 1,344 | 205 | 37 | 18.0 | 437 | 61 | 16 | 26.2 |
| 2015 | 1,447 | 266 | 55 | 20.7 | 471 | 63 | 18 | 28.6 |
| 2016 | 1,534 | 324 | 63 | 19.4 | 494 | 86 | 19 | 22.1 |
| 2017 | 1,611 | 340 | 61 | 17.9 | 522 | 91 | 18 | 19.8 |
| 2018 | 1,668 | 358 | 59 | 16.5 | 548 | 104 | 21 | 20.2 |
| 2019 | 1,704 | 355 | 205 | 57.7 | 560 | 105 | 65 | 61.9 |
| 2020 | 1,735 | 359 | 210 | 58.5 | 573 | 110 | 66 | 60.0 |
| 2021 | 1,790 | 376 | 215 | 57.2 | 592 | 120 | 72 | 60.0 |
| 2022 | 1,842 | 713 | 388 | 54.4 | 605 | 222 | 134 | 60.4 |
| 2023 | 1,882 | 1,241 | 612 | 49.3 | 616 | 381 | 191 | 50.1 |
| 2024 | 1,874 | 1,874 | 843 | 45.0 | 615 | 615 | 289 | 47.0 |
| 2025 | 1,819 | 1,819 | 864 | 47.5 | 610 | 610 | 298 | 48.9 |

### 64 x 36 km

| year | Msk present | Msk red | Msk red, no stmt | Msk % | SPb present | SPb red | SPb red, no stmt | SPb % |
|:---|---:|---:|---:|---:|---:|---:|---:|---:|
| 2014 | 1,194 | 174 | 33 | 19.0 | 409 | 54 | 13 | 24.1 |
| 2015 | 1,265 | 233 | 52 | 22.3 | 440 | 56 | 15 | 26.8 |
| 2016 | 1,337 | 281 | 56 | 19.9 | 461 | 78 | 15 | 19.2 |
| 2017 | 1,406 | 298 | 57 | 19.1 | 487 | 83 | 14 | 16.9 |
| 2018 | 1,458 | 313 | 55 | 17.6 | 514 | 95 | 16 | 16.8 |
| 2019 | 1,485 | 311 | 176 | 56.6 | 525 | 96 | 58 | 60.4 |
| 2020 | 1,516 | 312 | 180 | 57.7 | 536 | 101 | 59 | 58.4 |
| 2021 | 1,567 | 329 | 186 | 56.5 | 553 | 112 | 65 | 58.0 |
| 2022 | 1,635 | 634 | 340 | 53.6 | 563 | 202 | 116 | 57.4 |
| 2023 | 1,666 | 1,100 | 539 | 49.0 | 574 | 355 | 172 | 48.5 |
| 2024 | 1,654 | 1,654 | 727 | 44.0 | 572 | 572 | 263 | 46.0 |
| 2025 | 1,621 | 1,621 | 744 | 45.9 | 567 | 567 | 272 | 48.0 |

### 21.33 x 12 km

| year | Msk present | Msk red | Msk red, no stmt | Msk % | SPb present | SPb red | SPb red, no stmt | SPb % |
|:---|---:|---:|---:|---:|---:|---:|---:|---:|
| 2014 | 732 | 101 | 21 | 20.8 | 331 | 46 | 12 | 26.1 |
| 2015 | 771 | 144 | 34 | 23.6 | 351 | 47 | 13 | 27.7 |
| 2016 | 818 | 182 | 36 | 19.8 | 373 | 63 | 12 | 19.0 |
| 2017 | 861 | 200 | 39 | 19.5 | 390 | 66 | 10 | 15.2 |
| 2018 | 875 | 206 | 38 | 18.4 | 404 | 76 | 12 | 15.8 |
| 2019 | 882 | 204 | 111 | 54.4 | 413 | 78 | 46 | 59.0 |
| 2020 | 900 | 205 | 113 | 55.1 | 426 | 81 | 46 | 56.8 |
| 2021 | 931 | 213 | 115 | 54.0 | 439 | 91 | 52 | 57.1 |
| 2022 | 972 | 396 | 194 | 49.0 | 441 | 162 | 89 | 54.9 |
| 2023 | 978 | 674 | 312 | 46.3 | 447 | 282 | 137 | 48.6 |
| 2024 | 984 | 984 | 424 | 43.1 | 443 | 443 | 219 | 49.4 |
| 2025 | 953 | 953 | 432 | 45.3 | 438 | 438 | 221 | 50.5 |

Listing years of the treated firms (160 x 90 km; red-from year, firm level):

| red from | Moscow | of which inferred date | St Petersburg | of which inferred date |
|:---|---:|---:|---:|---:|
| 2014 | 235 | 0 | 67 | 0 |
| 2015 | 65 | 0 | 2 | 0 |
| 2016 | 64 | 0 | 46 | 0 |
| 2017 | 22 | 0 | 4 | 0 |
| 2018 | 19 | 0 | 13 | 0 |
| 2019 | 7 | 0 | 2 | 0 |
| 2020 | 13 | 0 | 4 | 0 |
| 2021 | 22 | 0 | 9 | 0 |
| 2022 | 429 | 0 | 124 | 0 |
| 2023 | 613 | 379 | 179 | 98 |
| 2024 | 731 | 624 | 250 | 205 |
| 2025 | 0 | 0 | 0 | 0 |

## 2. Firms on no list: drawn firms, usable baseline, statements among baseline firms

Drawn = on no list and geocoded below city level, inside the extent that year. Baseline % = drawn firms with a usable baseline over drawn firms. Statement % = baseline firms with an original filing that year over baseline firms (the filers with a revenue value are the coloured marks; the rest of the filers carry no value).

### 160 x 90 km

| year | Msk drawn | Msk baseline % | Msk stmt % of baseline | Msk filers with value | SPb drawn | SPb baseline % | SPb stmt % of baseline | SPb filers with value |
|:---|---:|---:|---:|---:|---:|---:|---:|---:|
| 2014 | 1,230,604 | 12.5 | 67.2 | 93,627 | 375,569 | 18.2 | 62.7 | 39,203 |
| 2015 | 1,188,819 | 15.0 | 78.3 | 126,473 | 379,704 | 20.9 | 80.6 | 58,031 |
| 2016 | 1,252,816 | 16.3 | 78.9 | 147,940 | 401,116 | 22.5 | 80.7 | 67,035 |
| 2017 | 1,106,924 | 20.9 | 80.8 | 174,181 | 380,330 | 26.8 | 82.3 | 78,298 |
| 2018 | 1,078,859 | 24.0 | 81.9 | 199,825 | 368,129 | 31.0 | 83.0 | 89,672 |
| 2019 | 945,613 | 30.5 | 95.3 | 268,475 | 333,194 | 37.9 | 95.7 | 118,230 |
| 2020 | 838,347 | 38.6 | 99.6 | 321,467 | 292,349 | 45.8 | 99.6 | 133,147 |
| 2021 | 745,500 | 43.2 | 93.2 | 299,483 | 255,352 | 52.3 | 92.3 | 122,865 |
| 2022 | 717,287 | 44.1 | 86.7 | 267,011 | 239,282 | 54.2 | 87.1 | 110,321 |
| 2023 | 743,161 | 41.1 | 84.4 | 244,629 | 229,709 | 53.8 | 85.7 | 101,900 |
| 2024 | 763,956 | 37.9 | 83.3 | 225,742 | 221,876 | 52.8 | 85.2 | 94,740 |
| 2025 | 768,871 | 36.0 | 79.7 | 204,669 | 221,118 | 50.6 | 82.5 | 86,645 |

### 64 x 36 km

| year | Msk drawn | Msk baseline % | Msk stmt % of baseline | Msk filers with value | SPb drawn | SPb baseline % | SPb stmt % of baseline | SPb filers with value |
|:---|---:|---:|---:|---:|---:|---:|---:|---:|
| 2014 | 1,113,465 | 11.8 | 67.6 | 80,827 | 355,168 | 17.9 | 62.5 | 36,320 |
| 2015 | 1,069,547 | 14.3 | 79.2 | 109,553 | 359,432 | 20.6 | 80.5 | 53,973 |
| 2016 | 1,124,855 | 15.6 | 79.4 | 127,503 | 380,434 | 22.2 | 80.6 | 62,594 |
| 2017 | 976,958 | 20.3 | 80.9 | 149,336 | 360,909 | 26.5 | 82.3 | 73,268 |
| 2018 | 950,003 | 23.3 | 82.2 | 171,747 | 349,041 | 30.6 | 83.2 | 83,984 |
| 2019 | 828,044 | 29.9 | 95.7 | 230,685 | 314,478 | 37.5 | 95.8 | 110,622 |
| 2020 | 734,295 | 38.0 | 99.6 | 277,358 | 273,915 | 45.6 | 99.6 | 124,213 |
| 2021 | 649,391 | 42.8 | 93.0 | 257,738 | 238,119 | 52.3 | 92.2 | 114,474 |
| 2022 | 620,443 | 43.9 | 86.4 | 228,779 | 222,459 | 54.3 | 86.9 | 102,598 |
| 2023 | 643,432 | 40.7 | 84.1 | 209,136 | 212,749 | 54.0 | 85.6 | 94,649 |
| 2024 | 660,305 | 37.5 | 83.2 | 192,690 | 204,723 | 53.1 | 85.1 | 87,927 |
| 2025 | 664,138 | 35.7 | 79.5 | 174,514 | 203,870 | 50.9 | 82.4 | 80,331 |

### 21.33 x 12 km

| year | Msk drawn | Msk baseline % | Msk stmt % of baseline | Msk filers with value | SPb drawn | SPb baseline % | SPb stmt % of baseline | SPb filers with value |
|:---|---:|---:|---:|---:|---:|---:|---:|---:|
| 2014 | 560,623 | 11.2 | 69.6 | 39,367 | 256,358 | 17.5 | 63.1 | 25,881 |
| 2015 | 522,797 | 13.8 | 80.9 | 52,625 | 257,117 | 20.1 | 80.7 | 37,942 |
| 2016 | 539,193 | 15.1 | 80.7 | 60,178 | 270,235 | 21.7 | 80.9 | 43,657 |
| 2017 | 453,926 | 20.3 | 81.6 | 69,489 | 252,296 | 26.0 | 82.7 | 50,701 |
| 2018 | 431,146 | 23.3 | 83.3 | 78,789 | 240,097 | 30.1 | 83.6 | 57,296 |
| 2019 | 369,988 | 29.7 | 96.1 | 103,051 | 211,320 | 37.2 | 95.9 | 73,807 |
| 2020 | 341,307 | 38.0 | 99.6 | 129,149 | 181,315 | 45.5 | 99.6 | 82,033 |
| 2021 | 304,849 | 42.2 | 93.0 | 119,392 | 155,278 | 52.8 | 92.2 | 75,355 |
| 2022 | 292,096 | 43.0 | 86.4 | 105,410 | 144,436 | 54.8 | 87.0 | 67,276 |
| 2023 | 301,075 | 39.8 | 84.2 | 95,871 | 136,725 | 54.8 | 85.7 | 61,774 |
| 2024 | 305,187 | 37.1 | 83.6 | 88,456 | 129,724 | 54.5 | 85.4 | 57,382 |
| 2025 | 304,927 | 35.3 | 80.3 | 79,856 | 128,344 | 52.4 | 82.7 | 52,348 |

City-level geocodes (excluded from the drawn firms) and all firms, 160 x 90 km:

| year | Msk firms | Msk city-level | Msk % | SPb firms | SPb city-level | SPb % |
|:---|---:|---:|---:|---:|---:|---:|
| 2014 | 1,358,479 | 126,531 | 9.3 | 388,417 | 12,411 | 3.2 |
| 2015 | 1,300,598 | 110,332 | 8.5 | 390,711 | 10,536 | 2.7 |
| 2016 | 1,368,904 | 114,554 | 8.4 | 412,174 | 10,564 | 2.6 |
| 2017 | 1,207,105 | 98,570 | 8.2 | 390,782 | 9,930 | 2.5 |
| 2018 | 1,173,735 | 93,208 | 7.9 | 378,512 | 9,835 | 2.6 |
| 2019 | 1,028,707 | 81,390 | 7.9 | 343,010 | 9,256 | 2.7 |
| 2020 | 877,534 | 37,452 | 4.3 | 301,812 | 8,890 | 2.9 |
| 2021 | 777,287 | 29,997 | 3.9 | 264,059 | 8,115 | 3.1 |
| 2022 | 747,011 | 27,882 | 3.7 | 248,084 | 8,197 | 3.3 |
| 2023 | 771,396 | 26,353 | 3.4 | 238,334 | 8,009 | 3.4 |
| 2024 | 793,908 | 28,078 | 3.5 | 230,449 | 7,958 | 3.5 |
| 2025 | 798,286 | 27,596 | 3.5 | 229,496 | 7,768 | 3.4 |

## 3. Revenue index (own 2019-2021 average = 100): yearly median and interquartile range

M7's comparison-group definition: members with a baseline, a statement and positive revenue in the year; firms on no list include city-level geocodes here, as in M7. Medians and quartiles change composition with observation.

### 160 x 90 km, firms on no list

| year | Msk n | Msk Q1 | Msk median | Msk Q3 | Msk IQR | SPb n | SPb Q1 | SPb median | SPb Q3 | SPb IQR | SPb - Msk median |
|:---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 2014 | 102,755 | 24.8 | 57.3 | 114.7 | 90.0 | 40,630 | 23.9 | 52.6 | 99.7 | 75.8 | -4.7 |
| 2015 | 138,309 | 27.8 | 61.1 | 114.8 | 87.0 | 59,795 | 26.8 | 56.8 | 103.0 | 76.1 | -4.3 |
| 2016 | 161,313 | 32.0 | 65.2 | 115.2 | 83.2 | 69,011 | 31.7 | 62.7 | 107.3 | 75.7 | -2.4 |
| 2017 | 189,603 | 38.6 | 72.0 | 118.2 | 79.6 | 80,470 | 38.3 | 70.0 | 111.4 | 73.1 | -2.0 |
| 2018 | 217,180 | 52.0 | 85.2 | 127.5 | 75.5 | 92,110 | 51.4 | 83.0 | 121.8 | 70.4 | -2.2 |
| 2019 | 288,864 | 66.8 | 92.9 | 122.0 | 55.2 | 120,606 | 66.4 | 91.8 | 119.7 | 53.3 | -1.0 |
| 2020 | 330,034 | 63.0 | 85.5 | 101.1 | 38.1 | 135,804 | 63.9 | 85.4 | 100.9 | 37.0 | -0.1 |
| 2021 | 297,223 | 94.0 | 119.5 | 148.2 | 54.2 | 122,024 | 96.3 | 120.8 | 148.3 | 52.0 | 1.3 |
| 2022 | 261,492 | 94.1 | 145.1 | 212.8 | 118.6 | 108,829 | 99.8 | 150.1 | 218.1 | 118.3 | 5.0 |
| 2023 | 239,152 | 102.3 | 169.8 | 279.5 | 177.2 | 100,403 | 109.8 | 177.3 | 286.8 | 177.0 | 7.5 |
| 2024 | 221,556 | 118.0 | 208.2 | 371.5 | 253.5 | 93,444 | 127.1 | 217.4 | 376.7 | 249.6 | 9.1 |
| 2025 | 200,374 | 119.9 | 227.5 | 424.2 | 304.4 | 85,323 | 127.3 | 234.7 | 423.5 | 296.1 | 7.2 |

### 160 x 90 km, firms listed in 2022

| year | Msk n | Msk Q1 | Msk median | Msk Q3 | Msk IQR | SPb n | SPb Q1 | SPb median | SPb Q3 | SPb IQR | SPb - Msk median |
|:---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 2014 | 60 | 12.6 | 48.0 | 81.6 | 68.9 | 18 | 11.1 | 38.9 | 131.0 | 119.8 | -9.1 |
| 2015 | 72 | 17.0 | 47.5 | 89.8 | 72.8 | 24 | 25.7 | 55.9 | 155.8 | 130.2 | 8.4 |
| 2016 | 80 | 22.3 | 55.0 | 86.8 | 64.4 | 26 | 30.5 | 52.4 | 155.9 | 125.4 | -2.6 |
| 2017 | 94 | 31.6 | 67.2 | 101.8 | 70.1 | 30 | 43.6 | 58.0 | 120.5 | 76.9 | -9.2 |
| 2018 | 101 | 48.3 | 79.3 | 112.7 | 64.4 | 32 | 54.9 | 83.2 | 149.2 | 94.3 | 3.9 |
| 2019 | 126 | 59.3 | 81.4 | 97.4 | 38.1 | 34 | 66.1 | 86.7 | 110.8 | 44.7 | 5.3 |
| 2020 | 134 | 77.6 | 90.6 | 98.8 | 21.1 | 34 | 66.7 | 76.7 | 98.5 | 31.8 | -13.9 |
| 2021 | 124 | 109.0 | 121.4 | 146.2 | 37.2 | 33 | 80.8 | 123.2 | 156.8 | 76.0 | 1.8 |
| 2022 | 100 | 94.7 | 150.2 | 210.7 | 116.0 | 30 | 68.2 | 121.6 | 200.9 | 132.7 | -28.6 |
| 2023 | 91 | 119.7 | 171.3 | 271.7 | 152.0 | 27 | 17.8 | 134.2 | 294.2 | 276.5 | -37.1 |
| 2024 | 82 | 175.5 | 258.3 | 396.6 | 221.1 | 25 | 143.8 | 243.2 | 464.3 | 320.4 | -15.2 |
| 2025 | 81 | 172.6 | 306.2 | 418.6 | 246.0 | 23 | 152.1 | 310.4 | 400.5 | 248.4 | 4.3 |

### 64 x 36 km, firms on no list

| year | Msk n | Msk Q1 | Msk median | Msk Q3 | Msk IQR | SPb n | SPb Q1 | SPb median | SPb Q3 | SPb IQR | SPb - Msk median |
|:---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 2014 | 88,142 | 24.3 | 57.2 | 115.4 | 91.1 | 37,522 | 23.6 | 52.5 | 99.8 | 76.2 | -4.7 |
| 2015 | 119,257 | 27.3 | 61.0 | 115.5 | 88.1 | 55,431 | 26.7 | 56.7 | 103.1 | 76.4 | -4.3 |
| 2016 | 138,498 | 31.6 | 65.1 | 115.8 | 84.2 | 64,238 | 31.4 | 62.6 | 107.6 | 76.2 | -2.5 |
| 2017 | 161,901 | 38.1 | 72.0 | 119.1 | 81.0 | 75,088 | 38.1 | 70.0 | 111.7 | 73.6 | -2.0 |
| 2018 | 185,873 | 51.5 | 85.3 | 128.4 | 76.9 | 86,029 | 51.2 | 83.1 | 122.1 | 70.9 | -2.2 |
| 2019 | 246,975 | 66.6 | 93.2 | 122.8 | 56.2 | 112,533 | 66.4 | 91.9 | 120.0 | 53.7 | -1.2 |
| 2020 | 280,971 | 62.3 | 85.3 | 101.3 | 38.9 | 126,335 | 63.6 | 85.3 | 100.9 | 37.3 | 0.0 |
| 2021 | 252,057 | 93.4 | 119.4 | 148.5 | 55.1 | 113,305 | 96.2 | 120.8 | 148.4 | 52.2 | 1.4 |
| 2022 | 220,687 | 92.8 | 144.5 | 213.0 | 120.3 | 100,841 | 99.3 | 150.0 | 218.3 | 119.0 | 5.5 |
| 2023 | 201,484 | 100.7 | 169.1 | 280.7 | 180.0 | 92,939 | 109.3 | 177.3 | 287.4 | 178.1 | 8.2 |
| 2024 | 186,510 | 116.2 | 207.4 | 373.6 | 257.4 | 86,439 | 126.4 | 217.4 | 377.2 | 250.9 | 10.0 |
| 2025 | 168,590 | 117.9 | 226.5 | 426.9 | 309.0 | 78,799 | 126.7 | 234.8 | 423.8 | 297.1 | 8.3 |

### 64 x 36 km, firms listed in 2022

| year | Msk n | Msk Q1 | Msk median | Msk Q3 | Msk IQR | SPb n | SPb Q1 | SPb median | SPb Q3 | SPb IQR | SPb - Msk median |
|:---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 2014 | 54 | 11.9 | 45.0 | 80.3 | 68.4 | 18 | 11.1 | 38.9 | 131.0 | 119.8 | -6.2 |
| 2015 | 65 | 17.1 | 40.7 | 85.4 | 68.2 | 24 | 25.7 | 55.9 | 155.8 | 130.2 | 15.2 |
| 2016 | 73 | 21.2 | 54.7 | 82.2 | 61.0 | 26 | 30.5 | 52.4 | 155.9 | 125.4 | -2.3 |
| 2017 | 88 | 28.6 | 66.9 | 100.1 | 71.5 | 30 | 43.6 | 58.0 | 120.5 | 76.9 | -8.9 |
| 2018 | 96 | 48.3 | 79.3 | 109.1 | 60.8 | 32 | 54.9 | 83.2 | 149.2 | 94.3 | 3.9 |
| 2019 | 116 | 60.0 | 81.9 | 99.6 | 39.6 | 34 | 66.1 | 86.7 | 110.8 | 44.7 | 4.8 |
| 2020 | 124 | 77.3 | 91.2 | 99.2 | 21.9 | 34 | 66.7 | 76.7 | 98.5 | 31.8 | -14.5 |
| 2021 | 114 | 108.3 | 121.2 | 146.4 | 38.1 | 33 | 80.8 | 123.2 | 156.8 | 76.0 | 2.0 |
| 2022 | 91 | 94.5 | 149.2 | 218.1 | 123.7 | 29 | 67.2 | 120.6 | 196.8 | 129.6 | -28.6 |
| 2023 | 81 | 121.0 | 171.1 | 314.6 | 193.6 | 27 | 17.8 | 134.2 | 294.2 | 276.5 | -36.9 |
| 2024 | 73 | 170.7 | 255.0 | 434.9 | 264.2 | 25 | 143.8 | 243.2 | 464.3 | 320.4 | -11.8 |
| 2025 | 74 | 168.6 | 303.8 | 413.5 | 245.0 | 23 | 152.1 | 310.4 | 400.5 | 248.4 | 6.7 |

### 21.33 x 12 km, firms on no list

| year | Msk n | Msk Q1 | Msk median | Msk Q3 | Msk IQR | SPb n | SPb Q1 | SPb median | SPb Q3 | SPb IQR | SPb - Msk median |
|:---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 2014 | 45,651 | 25.0 | 58.5 | 117.5 | 92.6 | 26,806 | 24.6 | 53.8 | 101.9 | 77.3 | -4.7 |
| 2015 | 60,875 | 28.2 | 62.3 | 117.8 | 89.6 | 39,016 | 27.7 | 57.7 | 105.0 | 77.3 | -4.6 |
| 2016 | 69,467 | 32.1 | 66.2 | 117.9 | 85.8 | 44,866 | 32.2 | 63.7 | 109.4 | 77.2 | -2.4 |
| 2017 | 80,059 | 38.3 | 72.9 | 121.0 | 82.7 | 52,055 | 38.8 | 70.8 | 113.8 | 75.0 | -2.1 |
| 2018 | 90,616 | 51.8 | 86.5 | 131.1 | 79.2 | 58,801 | 52.0 | 84.0 | 123.6 | 71.6 | -2.5 |
| 2019 | 117,140 | 67.6 | 94.0 | 125.2 | 57.6 | 75,303 | 67.2 | 92.7 | 121.4 | 54.2 | -1.3 |
| 2020 | 131,101 | 61.2 | 84.7 | 100.8 | 39.6 | 83,601 | 63.4 | 85.1 | 100.8 | 37.4 | 0.4 |
| 2021 | 116,822 | 92.4 | 118.8 | 148.0 | 55.6 | 74,710 | 95.3 | 120.2 | 147.8 | 52.5 | 1.4 |
| 2022 | 101,899 | 90.2 | 142.6 | 209.6 | 119.4 | 66,232 | 98.5 | 149.0 | 216.8 | 118.3 | 6.5 |
| 2023 | 92,190 | 97.6 | 166.6 | 276.9 | 179.3 | 60,863 | 108.3 | 176.1 | 285.0 | 176.7 | 9.4 |
| 2024 | 85,511 | 113.1 | 205.2 | 371.6 | 258.4 | 56,487 | 125.5 | 216.1 | 374.5 | 249.0 | 11.0 |
| 2025 | 76,944 | 116.4 | 225.3 | 424.0 | 307.7 | 51,450 | 126.7 | 234.0 | 420.9 | 294.2 | 8.7 |

### 21.33 x 12 km, firms listed in 2022

| year | Msk n | Msk Q1 | Msk median | Msk Q3 | Msk IQR | SPb n | SPb Q1 | SPb median | SPb Q3 | SPb IQR | SPb - Msk median |
|:---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 2014 | 40 | 11.3 | 45.0 | 82.0 | 70.7 | 15 | 11.2 | 51.5 | 139.1 | 127.9 | 6.4 |
| 2015 | 47 | 14.7 | 40.7 | 86.3 | 71.6 | 19 | 39.7 | 63.2 | 159.3 | 119.6 | 22.5 |
| 2016 | 50 | 22.7 | 52.0 | 84.2 | 61.5 | 21 | 35.9 | 54.1 | 157.6 | 121.6 | 2.1 |
| 2017 | 61 | 19.5 | 60.1 | 97.3 | 77.8 | 25 | 43.8 | 58.2 | 128.9 | 85.1 | -1.9 |
| 2018 | 65 | 45.2 | 78.3 | 107.9 | 62.8 | 27 | 58.9 | 87.6 | 153.6 | 94.7 | 9.2 |
| 2019 | 74 | 56.3 | 81.6 | 104.0 | 47.7 | 30 | 66.6 | 86.7 | 109.8 | 43.2 | 5.1 |
| 2020 | 80 | 75.9 | 89.1 | 97.5 | 21.6 | 30 | 68.1 | 83.0 | 104.5 | 36.4 | -6.1 |
| 2021 | 75 | 107.5 | 121.5 | 152.5 | 45.0 | 29 | 80.8 | 119.0 | 149.1 | 68.3 | -2.5 |
| 2022 | 60 | 92.4 | 145.2 | 198.9 | 106.5 | 26 | 68.6 | 121.6 | 194.4 | 125.8 | -23.6 |
| 2023 | 51 | 129.8 | 171.1 | 312.5 | 182.7 | 25 | 14.7 | 131.8 | 251.6 | 236.9 | -39.3 |
| 2024 | 52 | 192.9 | 266.7 | 438.0 | 245.2 | 23 | 132.3 | 243.2 | 483.8 | 351.5 | -23.6 |
| 2025 | 48 | 174.8 | 252.9 | 429.3 | 254.5 | 21 | 139.6 | 310.4 | 421.1 | 281.5 | 57.5 |

The sequence's own metric population (drawn firms on no list with a value: below city-level geocodes), pct = index - 100, 160 x 90 km:

| year | Msk n | Msk p5 | Msk Q1 | Msk median | Msk Q3 | Msk p95 | SPb n | SPb p5 | SPb Q1 | SPb median | SPb Q3 | SPb p95 |
|:---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 2014 | 93,627 | -97.4 | -75.3 | -42.9 | 14.5 | 540.4 | 39,203 | -97.2 | -76.2 | -47.4 | -0.3 | 368.3 |
| 2015 | 126,473 | -97.0 | -72.4 | -39.0 | 14.7 | 461.4 | 58,031 | -96.8 | -73.3 | -43.2 | 3.1 | 341.8 |
| 2016 | 147,940 | -96.2 | -68.1 | -34.9 | 15.2 | 400.8 | 67,035 | -96.0 | -68.4 | -37.3 | 7.4 | 319.8 |
| 2017 | 174,181 | -94.6 | -61.5 | -28.1 | 18.3 | 330.4 | 78,298 | -94.4 | -61.8 | -30.1 | 11.5 | 274.5 |
| 2018 | 199,825 | -91.0 | -48.1 | -14.9 | 27.5 | 262.0 | 89,672 | -90.5 | -48.7 | -16.9 | 22.0 | 220.2 |
| 2019 | 268,475 | -87.1 | -34.4 | -7.5 | 21.6 | 93.5 | 118,230 | -85.6 | -34.3 | -8.4 | 19.4 | 90.5 |
| 2020 | 321,467 | -88.3 | -38.3 | -14.8 | 0.9 | 53.8 | 133,147 | -85.4 | -37.0 | -14.8 | 0.7 | 51.2 |
| 2021 | 299,483 | -98.5 | -12.8 | 17.6 | 46.5 | 100.0 | 122,865 | -94.1 | -8.6 | 19.2 | 46.9 | 100.1 |
| 2022 | 267,011 | -100 | -19.9 | 40.1 | 106.6 | 419.2 | 110,321 | -98.6 | -10.0 | 46.2 | 113.3 | 416.0 |
| 2023 | 244,629 | -100 | -14.6 | 62.2 | 169.2 | 821.8 | 101,900 | -99.1 | -2.2 | 71.4 | 179.0 | 775.9 |
| 2024 | 225,742 | -100 | -2.1 | 97.6 | 256.2 | 1,361.7 | 94,740 | -98.8 | 12.5 | 108.9 | 264.6 | 1,237.7 |
| 2025 | 204,669 | -100 | -2.0 | 114.4 | 304.5 | 1,736.8 | 86,645 | -99.1 | 10.5 | 124.6 | 308.7 | 1,535.9 |

## 4. Class spread of baseline filers, breaks -50 / -20 / 0 / +50 / +150, 2022-2024

Filers = drawn firms with a statement, a revenue value and a baseline. Absolute = the firm's own pct; relative = pct minus the year's median pct of the city's drawn filers (so class 3/4 straddle zero by construction). Shares in percent of the filers; classes 1-6 from the largest decline to the largest rise.

### 160 x 90 km, absolute

| year | city | filers | 1: < -50 | 2: -50 to -20 | 3: -20 to 0 | 4: 0 to +50 | 5: +50 to +150 | 6: > +150 | extremes 1+6 |
|:---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 2022 | Msk | 267,011 | 17.4 | 7.6 | 6.2 | 24.2 | 27.0 | 17.6 | 35.0 |
| 2022 | SPb | 110,321 | 14.9 | 7.2 | 6.1 | 23.8 | 29.6 | 18.3 | 33.2 |
| 2023 | Msk | 244,629 | 17.5 | 6.3 | 4.9 | 16.6 | 26.9 | 27.8 | 45.3 |
| 2023 | SPb | 101,900 | 14.9 | 6.0 | 4.7 | 16.2 | 28.8 | 29.4 | 44.3 |
| 2024 | Msk | 225,742 | 16.3 | 5.3 | 3.8 | 11.2 | 24.9 | 38.5 | 54.9 |
| 2024 | SPb | 94,740 | 13.9 | 5.0 | 3.7 | 10.9 | 25.7 | 40.8 | 54.7 |

### 160 x 90 km, relative to the year's no-list median

| year | city | filers | 1: < -50 | 2: -50 to -20 | 3: -20 to 0 | 4: 0 to +50 | 5: +50 to +150 | 6: > +150 | extremes 1+6 |
|:---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 2022 | Msk | 267,011 | 27.9 | 11.2 | 10.8 | 20.8 | 15.8 | 13.4 | 41.4 |
| 2022 | SPb | 110,321 | 27.0 | 11.9 | 11.2 | 20.6 | 16.3 | 13.1 | 40.1 |
| 2023 | Msk | 244,629 | 31.9 | 10.2 | 7.9 | 14.8 | 15.0 | 20.2 | 52.1 |
| 2023 | SPb | 101,900 | 31.6 | 10.7 | 7.7 | 14.8 | 15.1 | 20.1 | 51.7 |
| 2024 | Msk | 225,742 | 35.9 | 8.5 | 5.5 | 11.0 | 13.3 | 25.8 | 61.7 |
| 2024 | SPb | 94,740 | 36.0 | 8.7 | 5.3 | 11.0 | 13.5 | 25.5 | 61.5 |

### 64 x 36 km, absolute

| year | city | filers | 1: < -50 | 2: -50 to -20 | 3: -20 to 0 | 4: 0 to +50 | 5: +50 to +150 | 6: > +150 | extremes 1+6 |
|:---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 2022 | Msk | 228,779 | 17.7 | 7.7 | 6.3 | 24.0 | 26.6 | 17.7 | 35.4 |
| 2022 | SPb | 102,598 | 15.0 | 7.2 | 6.2 | 23.7 | 29.5 | 18.4 | 33.3 |
| 2023 | Msk | 209,136 | 17.7 | 6.3 | 4.9 | 16.6 | 26.5 | 27.9 | 45.7 |
| 2023 | SPb | 94,649 | 14.9 | 6.0 | 4.7 | 16.1 | 28.7 | 29.5 | 44.5 |
| 2024 | Msk | 192,690 | 16.5 | 5.4 | 3.8 | 11.2 | 24.6 | 38.5 | 55.0 |
| 2024 | SPb | 87,927 | 14.0 | 5.0 | 3.7 | 10.9 | 25.6 | 40.8 | 54.8 |

### 64 x 36 km, relative to the year's no-list median

| year | city | filers | 1: < -50 | 2: -50 to -20 | 3: -20 to 0 | 4: 0 to +50 | 5: +50 to +150 | 6: > +150 | extremes 1+6 |
|:---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 2022 | Msk | 228,779 | 28.4 | 11.3 | 10.8 | 20.4 | 15.7 | 13.5 | 41.9 |
| 2022 | SPb | 102,598 | 27.1 | 11.9 | 11.1 | 20.4 | 16.3 | 13.2 | 40.3 |
| 2023 | Msk | 209,136 | 32.4 | 10.1 | 7.8 | 14.6 | 14.9 | 20.3 | 52.7 |
| 2023 | SPb | 94,649 | 31.7 | 10.6 | 7.6 | 14.8 | 15.1 | 20.2 | 51.9 |
| 2024 | Msk | 192,690 | 36.3 | 8.4 | 5.5 | 10.8 | 13.1 | 25.9 | 62.2 |
| 2024 | SPb | 87,927 | 36.1 | 8.6 | 5.3 | 11.0 | 13.5 | 25.5 | 61.6 |

### 21.33 x 12 km, absolute

| year | city | filers | 1: < -50 | 2: -50 to -20 | 3: -20 to 0 | 4: 0 to +50 | 5: +50 to +150 | 6: > +150 | extremes 1+6 |
|:---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 2022 | Msk | 105,410 | 18.3 | 7.9 | 6.4 | 24.1 | 26.1 | 17.2 | 35.5 |
| 2022 | SPb | 67,276 | 15.2 | 7.3 | 6.2 | 24.0 | 29.3 | 18.1 | 33.3 |
| 2023 | Msk | 95,871 | 18.5 | 6.4 | 5.0 | 16.7 | 26.0 | 27.4 | 45.9 |
| 2023 | SPb | 61,774 | 15.0 | 6.0 | 4.8 | 16.3 | 28.7 | 29.2 | 44.2 |
| 2024 | Msk | 88,456 | 17.1 | 5.5 | 3.9 | 11.1 | 24.5 | 38.0 | 55.1 |
| 2024 | SPb | 57,382 | 14.0 | 5.1 | 3.7 | 10.8 | 25.9 | 40.4 | 54.4 |

### 21.33 x 12 km, relative to the year's no-list median

| year | city | filers | 1: < -50 | 2: -50 to -20 | 3: -20 to 0 | 4: 0 to +50 | 5: +50 to +150 | 6: > +150 | extremes 1+6 |
|:---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 2022 | Msk | 105,410 | 29.2 | 11.3 | 10.9 | 20.2 | 15.2 | 13.2 | 42.4 |
| 2022 | SPb | 67,276 | 27.4 | 12.0 | 11.2 | 20.3 | 16.2 | 13.0 | 40.4 |
| 2023 | Msk | 95,871 | 33.2 | 10.2 | 7.8 | 14.3 | 14.6 | 19.9 | 53.1 |
| 2023 | SPb | 61,774 | 31.9 | 10.7 | 7.7 | 14.8 | 14.9 | 19.9 | 51.8 |
| 2024 | Msk | 88,456 | 36.9 | 8.4 | 5.5 | 10.8 | 12.8 | 25.6 | 62.5 |
| 2024 | SPb | 57,382 | 36.2 | 8.8 | 5.3 | 11.1 | 13.4 | 25.3 | 61.5 |

## 5. Listed firms: industry mix, legal form, ownership (160 x 90 km, firm level, latest registry values)

### Moscow: two-digit OKVED, top eight of 2,220 listed firms

| OKVED | division | firms | % |
|:---|---:|---:|---:|
| 46 | wholesale trade | 402 | 18.1 |
| 72 | scientific research and development | 288 | 13.0 |
| 64 | financial services except insurance | 187 | 8.4 |
| 70 | head offices and management consultancy | 181 | 8.2 |
| 62 | computer programming and consultancy | 156 | 7.0 |
| 26 | computer, electronic and optical products | 122 | 5.5 |
| 68 | real estate | 102 | 4.6 |
| 71 | architecture and engineering | 69 | 3.1 |

### St Petersburg: two-digit OKVED, top eight of 700 listed firms

| OKVED | division | firms | % |
|:---|---:|---:|---:|
| 46 | wholesale trade | 180 | 25.7 |
| 72 | scientific research and development | 96 | 13.7 |
| 26 | computer, electronic and optical products | 57 | 8.1 |
| 71 | architecture and engineering | 35 | 5.0 |
| 62 | computer programming and consultancy | 31 | 4.4 |
| 68 | real estate | 26 | 3.7 |
| 28 | machinery and equipment | 26 | 3.7 |
| 30 | other transport equipment | 22 | 3.1 |

Downtown rectangle (21.33 x 12 km), top eight:

Moscow (1,198 listed firms downtown):

| OKVED | division | firms | % |
|:---|---:|---:|---:|
| 46 | wholesale trade | 174 | 14.5 |
| 70 | head offices and management consultancy | 142 | 11.9 |
| 64 | financial services except insurance | 140 | 11.7 |
| 72 | scientific research and development | 102 | 8.5 |
| 62 | computer programming and consultancy | 98 | 8.2 |
| 68 | real estate | 62 | 5.2 |
| 71 | architecture and engineering | 48 | 4.0 |
| 26 | computer, electronic and optical products | 44 | 3.7 |

St Petersburg (506 listed firms downtown):

| OKVED | division | firms | % |
|:---|---:|---:|---:|
| 46 | wholesale trade | 128 | 25.3 |
| 72 | scientific research and development | 73 | 14.4 |
| 26 | computer, electronic and optical products | 45 | 8.9 |
| 62 | computer programming and consultancy | 24 | 4.7 |
| 71 | architecture and engineering | 22 | 4.3 |
| 30 | other transport equipment | 16 | 3.2 |
| 28 | machinery and equipment | 15 | 3.0 |
| 68 | real estate | 15 | 3.0 |

### Legal form (OKOPF), top six

Moscow:

| code | form | firms | % |
|:---|---:|---:|---:|
| 12300 | limited-liability company | 1,314 | 59.2 |
| 12267 | non-public joint-stock company | 627 | 28.2 |
| 12247 | public joint-stock company | 113 | 5.1 |
| 65241 | federal state unitary enterprise | 78 | 3.5 |
| 71400 | autonomous non-profit organisation | 20 | 0.9 |
| 12200 | joint-stock company | 8 | 0.4 |

St Petersburg:

| code | form | firms | % |
|:---|---:|---:|---:|
| 12300 | limited-liability company | 428 | 61.1 |
| 12267 | non-public joint-stock company | 219 | 31.3 |
| 12247 | public joint-stock company | 33 | 4.7 |
| 65241 | federal state unitary enterprise | 13 | 1.9 |
| 71400 | autonomous non-profit organisation | 1 | 0.1 |
| 70412 | charitable foundation | 1 | 0.1 |

### Ownership (OKFS), top six

Moscow:

| code | ownership | firms | % |
|:---|---:|---:|---:|
| 16 | private | 1,646 | 74.1 |
| 12 | federal | 162 | 7.3 |
| 61 | property of state corporations | 127 | 5.7 |
| 41 | mixed Russian with a federal share | 78 | 3.5 |
| 49 | other mixed Russian | 55 | 2.5 |
| 34 | joint private and foreign | 49 | 2.2 |

St Petersburg:

| code | ownership | firms | % |
|:---|---:|---:|---:|
| 16 | private | 592 | 84.6 |
| 12 | federal | 29 | 4.1 |
| 41 | mixed Russian with a federal share | 27 | 3.9 |
| 61 | property of state corporations | 20 | 2.9 |
| 34 | joint private and foreign | 13 | 1.9 |
| 49 | other mixed Russian | 9 | 1.3 |

## 6. Candidate anchor pairs under the M6 rule

Listed firms in the downtown rectangle with a public name in the sanctions file: Moscow 1,112 of 1,198 treated firms (237 listed in 2022); St Petersburg 465 of 506 (95 listed in 2022). Ranked by 2021 revenue (line 2110), as M6 ranks Aeroflot. SME rule (M6): on no list, below city-level geocode, present all twelve years with an original filing and positive revenue each year, geocode drift at most 50 m, 2021 revenue between 50 million and 3 billion rubles, not in OKVED 70, 64 or 68. Pool meeting the rule anywhere in the 160 x 90 km rectangle: Moscow 5,722, St Petersburg 2,854. Names below are the sanctions file's own (its first spelling; the file lists every spelling); unlisted firms are counted, never named; the nearest firm's distance is rounded to 10 m; 0 m means a firm at the same address.

### St Petersburg

| name (sanctions file) | listed | date inferred | jurisdictions | OKVED2 | rev 2021 bn | rev 2024 bn | filed 2014-2025 | from centre m | SME within 200 m | within 500 m | nearest m | nearest OKVED2 |
|:---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| gazprom neft | 2014 | no | au ca ch eu gb nz us | 46 | 2,675.2 |  | 111111110000 | 1,057 | 3 | 16 | 110 | 55 |
| gazprom mezhregiongaz | 2016 | no | us | 46 | 1,135.6 | 1,420.4 | -11111111111 | 3,454 | 1 | 6 | 60 | 18 |
| aktsionernoe obshchestvo gazstroiprom | 2023 | yes | us | 71 | 579.5 |  | ----11111000 | 5,576 | 2 | 14 | 130 | 46 |
| gazprom kapital | 2016 | no | us | 64 | 487.2 | 665.7 | ---111111111 | 2,944 | 10 | 17 | 0 | 71 |
| gaz-oil | 2016 | no | us | 46 | 246.7 | 381.1 | -----1111111 | 2,153 | 14 | 29 | 100 | 80 |
| gazprom transgaz ukhta | 2016 | no | us | 19 | 154.9 | 256.9 | ---111111111 | 3,523 | 4 | 26 | 80 | 41 |
| gazprom neft shelf | 2022 | no | us | 06 | 117.2 |  | --1111110000 | 1,179 | 4 | 20 | 130 | 46 |
| limited liability company td elektrotekhmontazh | 2024 | yes | us | 46 | 113.1 |  | 01111111110- | 3,607 | 4 | 12 | 90 | 46 |

### Moscow

| name (sanctions file) | listed | date inferred | jurisdictions | OKVED2 | rev 2021 bn | rev 2024 bn | filed 2014-2025 | from centre m | SME within 200 m | within 500 m | nearest m | nearest OKVED2 |
|:---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| lukoil | 2014 | no | au ca nz us | 70 | 2,389.3 | 3,046.9 | 111111111111 | 1,952 | 2 | 31 | 120 | 79 |
| jsc "rzd" | 2022 | no | au ca ch eu gb nz us | 49 | 1,963.6 |  | 111111110000 | 2,804 | 2 | 25 | 110 | 80 |
| aeroflot - russian airlines pjsc | 2022 | no | gb us | 51 | 378.7 | 712.9 | 111111110111 | 925 | 2 | 16 | 60 | 86 |
| mts | 2024 | yes | ca | 61 | 373.3 | 458.2 | 111111111111 | 3,485 | 16 | 39 | 70 | 46 |
| limited liability company "veles aktiv" | 2023 | no | us | 64 | 371.7 | 335.7 | 111111111111 | 5,468 | 2 | 7 | 0 | 94 |

Aeroflot (M6's Moscow anchor), same rule: 2 SME-rule firms within 200 m, 16 within 500 m, nearest 57 m.

## Where the cities differ by more than Moscow's interquartile band

| statistic (SPb median - Moscow median, against Moscow Q3 - Q1) | 2022 | 2023 | 2024 | years exceeding | differs in 2+ years |
|:---|---:|---:|---:|---:|---:|
| no-list index median, 160 x 90 km | 5.0 vs band 118.6 | 7.5 vs band 177.2 | 9.1 vs band 253.5 | 0 of 3 | no |
| listed-2022 index median, 160 x 90 km | -28.6 vs band 116.0 | -37.1 vs band 152.0 | -15.2 vs band 221.1 | 0 of 3 | no |
| drawn filers' pct median, 160 x 90 km | 6.1 vs band 126.6 | 9.2 vs band 183.8 | 11.3 vs band 258.3 | 0 of 3 | no |
| no-list index median, 64 x 36 km | 5.5 vs band 120.3 | 8.2 vs band 180.0 | 10.0 vs band 257.4 | 0 of 3 | no |
| listed-2022 index median, 64 x 36 km | -28.6 vs band 123.7 | -36.9 vs band 193.6 | -11.8 vs band 264.2 | 0 of 3 | no |
| drawn filers' pct median, 64 x 36 km | 6.6 vs band 128.2 | 10.1 vs band 186.3 | 12.4 vs band 261.4 | 0 of 3 | no |
| no-list index median, 21.33 x 12 km | 6.5 vs band 119.4 | 9.4 vs band 179.3 | 11.0 vs band 258.4 | 0 of 3 | no |
| listed-2022 index median, 21.33 x 12 km | -23.6 vs band 106.5 | -39.3 vs band 182.7 | -23.6 vs band 245.2 | 0 of 3 | no |
| drawn filers' pct median, 21.33 x 12 km | 7.7 vs band 127.6 | 11.7 vs band 186.0 | 13.4 vs band 262.6 | 0 of 3 | no |

Shares have no interquartile band; their percentage-point differences (SPb minus Moscow) in 2022-2024 are:

| extent | year | red without statement, pp | baseline share, pp | statement share of baseline, pp | extreme classes 1+6 (absolute), pp |
|:---|---:|---:|---:|---:|---:|
| 160 x 90 km | 2022 | +5.9 | +10.0 | +0.3 | -1.8 |
| 160 x 90 km | 2023 | +0.8 | +12.7 | +1.4 | -1.0 |
| 160 x 90 km | 2024 | +2.0 | +14.9 | +1.9 | -0.1 |
| 64 x 36 km | 2022 | +3.8 | +10.4 | +0.5 | -2.1 |
| 64 x 36 km | 2023 | -0.5 | +13.4 | +1.5 | -1.2 |
| 64 x 36 km | 2024 | +2.0 | +15.6 | +2.0 | -0.3 |
| 21.33 x 12 km | 2022 | +5.9 | +11.8 | +0.5 | -2.2 |
| 21.33 x 12 km | 2023 | +2.3 | +15.0 | +1.5 | -1.7 |
| 21.33 x 12 km | 2024 | +6.3 | +17.4 | +1.8 | -0.7 |

## Summary under the test

Nothing differs by more than Moscow's interquartile band in any of 2022-2024, let alone in two years, at any extent. The no-list revenue index median runs 5 to 11 points higher in St Petersburg against Moscow bands of 119 to 258 points; the drawn filers' pct median 6 to 13 points higher against bands of 127 to 263; the listed-in-2022 median 12 to 39 points lower against bands of 106 to 264, with 23 to 30 St Petersburg filers behind each of those medians against 51 to 100 in Moscow, so that group's own quartiles are the noisier of the two. Where no band exists, one share differs in every extent and year: drawn firms with a usable baseline are 53 to 55 percent in St Petersburg against 37 to 44 in Moscow, 10 to 17 percentage points apart, a composition difference already present in 2014 (18 against 12.5 percent) and widening as Moscow's baseline share falls after 2022 while St Petersburg's holds. The rest of the shares do not differ: red firms without a statement are between 0.5 points lower and 6 points higher in St Petersburg; baseline firms with a statement are within 2 points; every class share under the breaks is within 3.2 points in the absolute metric and within 2 points in the relative one, the two extreme classes together within 2.2 points; and the city-level geocode share, 9 against 3 percent in 2014, is equal from 2020 on. The listed stock is a third the size (700 against 2,220 firms; 506 against 1,198 downtown; 124 against 429 listed in 2022), more private (85 against 74 percent) and weighted to wholesale trade, research and development, electronics and transport-equipment manufacturing where Moscow's carries finance and head-office divisions; the largest named listed firms in the St Petersburg downtown rectangle are the Gazprom group, each with 1 to 14 SME-rule firms within 200 m, against 2 for Aeroflot.

