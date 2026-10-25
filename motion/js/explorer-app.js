// Visibility atlas: an interactive explorer over the same aggregates as the explainer. State lives
// in the page; the map redraws on every state change; every panel names its source.
(function () {
  'use strict';
  const D = window.MOTION_DATA, S = D.series, C100 = D.cells100, DEN = D.density, BM = D.basemap, CY = D.cellsyears;
  const F = S.facts, fmt = Motion.fmt, MM = MotionMap, CH = MotionCharts;
  const $ = id => document.getElementById(id);
  // Text audit (as the explainer's): ?__audit=1 records every text box per canvas; tools/atlas-audit.py
  // drives the page at several panel widths through window.__atlas and tests overlaps, bounds and sizes.
  if (new URLSearchParams(location.search).get('__audit') === '1') Motion.audit.on = true;
  window.__atlasCanvases = {};
  // Firms view (round 5, 23 October 2026): every registered address per year from M9 (data/firms/*.bin.gz,
  // manifest data/firms.js) and the listed firms from treatednational.js; off when either is absent or the
  // browser cannot inflate gzip. Nothing here names a firm on no list: the address files carry counts and classes only;
  // listed firms carry their list-file names (25 October 2026).
  const FM = D.firms || null, TRN = D.treatednational || null;
  if (TRN && typeof TRN.psh === 'string') { TRN.psh = MM.b64Int16(TRN.psh); TRN.rev_m = typeof TRN.rev_m === 'string' ? MM.b64Float32(TRN.rev_m) : null; }   // the listed firms' shares of the revenue at their coordinate pairs (tenths of a percent, -1 none) and their revenue in millions (round 9)
  const INDD = D.industry || null, REG = D.regions || null, IND_T = INDD || (FM && FM.industry) || null;   // the industry layer (round 9): cells, regions, the division and class tables
  const FIRMS_OK = !!(FM && TRN && typeof DecompressionStream === 'function');
  const CLASS_LABELS = ['≤ −50%', '−50 to −20%', '−20 to 0%', '0 to +50%', '+50 to +150%', '> +150%'];

  // ---- theme -----------------------------------------------------------------------------------
  const root = document.documentElement;
  function readTheme() {
    const css = getComputedStyle(root), tok = n => css.getPropertyValue('--' + n).trim();
    const scheme = tok('scheme'); const dark = scheme ? scheme !== 'light' : tok('stage').toUpperCase() !== '#FFFFFF';
    // Dark theme: ColorBrewer YlGnBu for ordered layers and PRGn for signed change, off the navy chrome.
    // Light theme: the manuscript's navy ramps for ordered layers, PRGn (dark = strong) for signed change.
    const t = { dark, stage: tok('stage'), land: tok('land'), border: tok('border'), graticule: tok('graticule'), ink: tok('ink'), muted: tok('muted'), dim: tok('dim'), grid: tok('grid'), panel: tok('panel'),
             ind9: IND_T ? (dark ? IND_T.classes.colour_dark : IND_T.classes.colour_light) : [],
             cursor: tok('cursor') || '#FF45C8', cursorLive: tok('cursor-live') || '#FF8FDF', context: tok('context') || '#4DFF7F', contextLive: tok('context-live') || '#9AFFB8',   // the two accents (round 9): UI only, never data; the full neon rests, the live variant moves
             accent: tok('accent'), accentStrong: tok('accent-strong'), fall: tok('fall'), rise: tok('rise'), below: tok('below'), highlightBand: tok('highlight'), tick: tok('dim'), axis: tok('dim'), barMuted: tok('border'),
             ramp6: dark ? ['#1D91C0', '#38ADC3', '#6CC5BE', '#A2DAB8', '#D4EEB3', '#FFFFD9'] : ['#D9E8F5', '#A9C4DE', '#78A3C9', '#4F84B4', '#2F6395', '#16436E'],
             ramp5: dark ? ['#38ADC3', '#6CC5BE', '#A2DAB8', '#D4EEB3', '#FFFFD9'] : ['#78A3C9', '#4F84B4', '#2F6395', '#16436E', '#061C38'],
             change6: dark ? ['#E7D4E8', '#C2A5CF', '#9970AB', '#5AAE61', '#A6DBA0', '#D9F0D3'] : ['#762A83', '#9970AB', '#C2A5CF', '#A6DBA0', '#5AAE61', '#1B7837'],
             density: dark ? '#7FCDBB' : '#16436E',
             neutral: FM ? (dark ? FM.neutral.dark : FM.neutral.light) : '#B5C3D1', blue6: FM ? (dark ? FM.class_colours.dark : FM.class_colours.light) : [], treated: tok('treated') || '#E31A1C', treatedOutline: '#FFD9D9' };
    return Object.assign(t, MM.coreRamp(t));   // the bloom's pale-core tables (round 9)
  }
  let theme = readTheme();
  let explicit = null;
  try { explicit = localStorage.getItem('atlas-theme'); } catch (e) { explicit = null; }
  if (explicit === 'light' || explicit === 'dark') root.setAttribute('data-theme', explicit);
  function syncThemeButton() { const light = !readTheme().dark; $('theme').textContent = light ? 'Dark theme' : 'Light theme'; $('theme').setAttribute('aria-pressed', String(light)); }
  $('theme').addEventListener('click', () => { const next = readTheme().dark ? 'light' : 'dark'; root.setAttribute('data-theme', next); try { localStorage.setItem('atlas-theme', next); } catch (e) { /* no storage */ } theme = readTheme(); syncThemeButton(); redrawAll(); });
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => { theme = readTheme(); syncThemeButton(); redrawAll(); });

  // ---- data ------------------------------------------------------------------------------------
  const bmp = MM.buildBasemap(BM);
  const partPaths = BM.lod0.parts.map(p => ({ name: p.name, path: MM.partsToPath([p]) }));
  const nat = MM.decodeDensity(DEN.national);
  const FINE_BREAKS = [55, 62, 68, 74], YEAR_BREAKS = [20, 35, 50, 60, 70], FIN_BREAKS = [-20, -10, 0, 10, 20];
  // The national 5 km grid (36,585 cells) is split into 500 km blocks, so a draw touches only the blocks in view and
  // the pass inside a city window only the blocks under it (24 October 2026; the picture is unchanged).
  const NAT_BLOCK = 500;
  const natBlocks = (() => { const by = new Map(); for (let i = 0; i < nat.count; i++) { const bx = Math.floor(nat.ix[i] * nat.grid / NAT_BLOCK), byy = Math.floor(nat.iy[i] * nat.grid / NAT_BLOCK), key = bx + ',' + byy; let b = by.get(key); if (!b) { b = { x0: bx * NAT_BLOCK, y0: byy * NAT_BLOCK, x1: (bx + 1) * NAT_BLOCK, y1: (byy + 1) * NAT_BLOCK, ix: [], iy: [], n: [], a: [] }; by.set(key, b); } b.ix.push(nat.ix[i]); b.iy.push(nat.iy[i]); b.n.push(nat.n[i]); b.a.push(nat.a[i]); }
    return [...by.values()].map(b => ({ x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1, paths: MM.buildDensityPaths({ grid: nat.grid, origin: nat.origin, ix: b.ix, iy: b.iy, n: b.n, a: b.a, count: b.ix.length }, FINE_BREAKS) })); })();
  // Below k 0.5 (a 5 km cell under 2.5 px) the national counts come from a picture rendered once per theme at 0.35 px per
  // km (a cell is 1.75 px) and drawn scaled, which keeps the country view and the start of every flight at the frame rate;
  // the rasteriser averaged those sub-pixel cells anyway, so the picture is the same. Above it the blocks' rectangles draw.
  const NAT_BMP_K = 0.35; let natBmp = null;
  function natBitmap() {
    if (natBmp && natBmp.colour === theme.density) return natBmp;
    const ext = BM.extents.national, W = Math.ceil((ext.x[1] - ext.x[0]) * NAT_BMP_K) + 4, H = Math.ceil((ext.y[1] - ext.y[0]) * NAT_BMP_K) + 4;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const ctx2 = cv.getContext('2d');
    const st = { width: W, height: H, scale: 1, base() { ctx2.setTransform(1, 0, 0, 1, 0, 0); } };
    const camB = { cx: (ext.x[0] + ext.x[1]) / 2, cy: (ext.y[0] + ext.y[1]) / 2, k: NAT_BMP_K, ox: W / 2, oy: H / 2 };
    for (const b of natBlocks) MM.drawDensityCounts(ctx2, st, camB, b.paths, theme.density, 1);
    natBmp = { cv, cam: camB, W, H, colour: theme.density }; return natBmp;
  }
  // Draws the national grid's blocks that meet the view, or the given km rectangle, as counts or as shares.
  function drawNat(c, alpha, region, shares) {
    if (!shares && c.k < 0.5) {
      const b = natBitmap(), [px, py] = Motion.project(c, b.cam.cx - b.W / 2 / b.cam.k, b.cam.cy + b.H / 2 / b.cam.k), f = c.k / b.cam.k;
      mctx.save(); stage.base(); mctx.globalAlpha *= alpha; mctx.drawImage(b.cv, px, py, b.W * f, b.H * f); mctx.restore(); return;
    }
    const hx = stage.width / 2 / c.k, hy = stage.height / 2 / c.k; let x0 = c.cx - hx, x1 = c.cx + hx, y0 = c.cy - hy, y1 = c.cy + hy;
    if (region) { x0 = Math.max(x0, region.origin[0]); x1 = Math.min(x1, region.origin[0] + region.size); y0 = Math.max(y0, region.origin[1]); y1 = Math.min(y1, region.origin[1] + region.size); }
    for (const b of natBlocks) if (b.x1 > x0 && b.x0 < x1 && b.y1 > y0 && b.y0 < y1) { if (shares) MM.drawDensityShares(mctx, stage, c, b.paths, theme.ramp5, theme.below, alpha); else MM.drawDensityCounts(mctx, stage, c, b.paths, theme.density, alpha); }
  }
  const win1 = {}, win025 = {};
  for (const [label, w] of Object.entries(DEN.windows_1km)) { const d = MM.decodeDensity(w); win1[label] = { d, paths: MM.buildDensityPaths(d, FINE_BREAKS), cx: w.origin[0] + 45, cy: w.origin[1] + 45 }; }
  for (const [label, w] of Object.entries(DEN.windows_250m)) { const d = MM.decodeDensity(w); win025[label] = { d, paths: MM.buildDensityPaths(d, FINE_BREAKS), cx: w.origin[0] + 12, cy: w.origin[1] + 12 }; }
  const cityYear = {};   // label -> year -> {d, paths}
  for (const w of CY.city_1km) { const d = MM.decodeDensity(w); (cityYear[w.label] = cityYear[w.label] || {})[w.year] = { d, paths: MM.buildDensityPaths(d, FINE_BREAKS) }; }
  const years = CY.mapped_years;
  const yearIndex = {}; CY.avail.year.forEach((y, i) => { (yearIndex[y] = yearIndex[y] || []).push(i); });
  const cellKey = (ix, iy) => iy * 65536 + ix;
  const listClass = v => (v == null ? null : v >= 50 ? 3 : v >= 20 ? 2 : v >= 5 ? 1 : 0);
  const yearCells = {};   // year -> Map key -> {n, a, nr, ar, ns}
  for (const y of years) { const m = new Map(); for (const i of yearIndex[y]) m.set(cellKey(CY.avail.ix[i], CY.avail.iy[i]), { n: CY.avail.n[i], a: CY.avail.a[i], nr: CY.avail.nr[i], ar: CY.avail.ar[i], ns: CY.avail.ns[i] }); yearCells[y] = m; }
  const totals = {}; CY.totals.year.forEach((y, i) => totals[y] = { eligible: CY.totals.n[i], located: CY.totals.n_located[i], share: CY.totals.eligible_share[i], located_share: CY.totals.located_share[i] });
  const chg = C100.change, chgMap = new Map(); for (let i = 0; i < chg.ix.length; i++) chgMap.set(cellKey(chg.ix[i], chg.iy[i]), i);
  const coh = C100.cohort, cohIdx = [], cohMap = new Map(); for (let i = 0; i < coh.ix.length; i++) if (coh.outcome[i] === 'revenue' && coh.moderator[i] === 'cash') { cohIdx.push(i); cohMap.set(cellKey(coh.ix[i], coh.iy[i]), i); }
  const lists = C100.lists, listMap = new Map(), listClassCounts = [0, 0, 0, 0]; for (let i = 0; i < lists.ix.length; i++) { listMap.set(cellKey(lists.ix[i], lists.iy[i]), i); const cl = listClass(lists.sanctioned[i]); if (cl != null) listClassCounts[cl]++; }
  const fin = C100.fin, finIdx = [], finMap = new Map(); for (let i = 0; i < fin.ix.length; i++) if (fin.outcome[i] === 'revenue' && fin.moderator[i] === 'cash' && fin.year[i] === 2024) { finIdx.push(i); finMap.set(cellKey(fin.ix[i], fin.iy[i]), i); }
  // 25 km cells by year (M10, 24 October 2026): the step between the 100 km cells and the city windows, so a zoom
  // refines the cells across the country; without the file (older data) the 100 km cells simply stay.
  const C25 = D.cells25 || null, c25 = {}, G25 = C25 ? C25.grid_km : 25;
  const decode25 = (r, cols) => { const d = { count: r.count, ix: MM.b64Int16(r.ix), iy: MM.b64Int16(r.iy), map: new Map() }; for (const [k, src, wide] of cols) d[k] = r[src] == null ? null : (wide ? MM.b64Int32(r[src]) : MM.b64Int16(r[src])); for (let i = 0; i < d.count; i++) d.map.set(cellKey(d.ix[i], d.iy[i]), i); return d; };
  if (C25) for (const [y, r] of Object.entries(C25.by_year)) c25[+y] = decode25(r, [['n', 'n', true], ['a', 'a', true], ['ns', 'ns', true], ['ng', 'ng', true]]);
  const chg25 = C25 && C25.change ? decode25(C25.change, [['n21', 'n21', true], ['a21', 'a21', true], ['n24', 'n24', true], ['a24', 'a24', true], ['cls', 'class', false], ['pp', 'change_pp_x1000', true]]) : null;
  const list25Counts = [0, 0, 0, 0]; if (c25[2021]) { const d = c25[2021]; for (let i = 0; i < d.count; i++) if (d.ns[i] >= 5) list25Counts[listClass(d.ns[i])]++; }
  // ---- the industry layer (round 9, 25 October 2026): the division byte (1 to 99, 0 no OKVED 2 division code, 255 unknown) to its
  // class id (1 to 9; 0 unknown) from the manifests' division table, so the page and the passes share one definition; the cells'
  // leading division, its share, the listed share and the ranked mix per year (M11), and the 1 km city windows for 2019 to 2024.
  const IND_CLASS = new Uint8Array(256), IND_TITLE = new Map(), IND_SHORT = new Map();
  if (IND_T) { IND_T.divisions.code.forEach((c, i) => { IND_CLASS[+c] = IND_T.divisions.class[i]; IND_TITLE.set(+c, IND_T.divisions.title[i]); IND_SHORT.set(+c, IND_T.divisions.short[i]); }); IND_CLASS[0] = 9; IND_CLASS[255] = 0; }
  const divPad = code => String(code).padStart(2, '0');
  const divTitle = code => (code === 0 ? 'no OKVED 2 division code' : IND_TITLE.get(code) || `division ${divPad(code)}`);
  const divShort = code => (code === 0 ? 'no division code' : IND_SHORT.get(code) || `division ${divPad(code)}`);
  const divLabel = code => (code === 0 ? 'No OKVED 2 division code (missing or an earlier revision\'s code)' : `${divTitle(code)} (division ${divPad(code)})`);
  const indClassLabel = code => (IND_T && IND_CLASS[code] ? IND_T.classes.label[IND_CLASS[code] - 1] : '');
  const decodeInd = (r, k) => { const d = { count: r.count, k, ix: MM.b64Int16(r.ix), iy: MM.b64Int16(r.iy), nrev: MM.b64Int32(r.nrev), dom: MM.b64Uint8(r.dom), dsh: MM.b64Uint8(r.dsh), lsh: MM.b64Uint8(r.lsh), rv: r.rv ? MM.b64Int16(r.rv) : null, top: MM.b64Uint8(r.top_code), tsh: MM.b64Uint8(r.top_share), map: new Map() }; for (let i = 0; i < d.count; i++) d.map.set(cellKey(d.ix[i], d.iy[i]), i); return d; };
  const ind100 = {}, ind25 = {}, indCity = {};   // year -> cells; label -> year -> the 1 km window
  const decodeCity = (w, k) => { const d = { origin: w.origin, count: w.count, k, ix: MM.b64Int16(w.ix), iy: MM.b64Int16(w.iy), nrev: MM.b64Int16(w.nrev), dom: MM.b64Uint8(w.dom), dsh: MM.b64Uint8(w.dsh), rv: w.rv ? MM.b64Int16(w.rv) : null, top: w.top_code ? MM.b64Uint8(w.top_code) : null, tsh: w.top_share ? MM.b64Uint8(w.top_share) : null, map: new Map() }; for (let i = 0; i < d.count; i++) d.map.set(cellKey(d.ix[i], d.iy[i]), i); return d; };
  let indCityLoaded = false, indCityPending = null;
  function takeIndCity(C) { for (const w of C.city_1km) (indCity[w.label] = indCity[w.label] || {})[w.year] = decodeCity(w, C.topk || 1); indCityLoaded = true; }
  if (INDD) {
    for (const [y, r] of Object.entries(INDD.grid100.by_year)) ind100[+y] = decodeInd(r, INDD.grid100.topk);
    for (const [y, r] of Object.entries(INDD.grid25.by_year)) ind25[+y] = decodeInd(r, INDD.grid25.topk);
    if (Array.isArray(INDD.city_1km)) takeIndCity({ city_1km: INDD.city_1km, topk: 1 }); else if (D['industry-city']) takeIndCity(D['industry-city']);
  }
  // The 1 km city windows of the industry layer (data/industry-city.js, about 3 MB) load once the layer reaches a city window;
  // the 25 km tiles stand until they arrive. ready() waits for them.
  function ensureIndCity() {
    if (indCityLoaded || !INDD || !INDD.city_1km || !INDD.city_1km.file) return Promise.resolve();
    if (!indCityPending) indCityPending = loadScript('data/' + INDD.city_1km.file.replace(/\.json$/, '.js')).then(() => { const C = D['industry-city']; if (C) takeIndCity(C); else indCityLoaded = true; indCityPending = null; if (state.layer === 'industry') { drawMap(); updateContext(true); syncMix(); } }, () => { indCityLoaded = true; indCityPending = null; });
    return indCityPending;
  }
  // The hit of a cell on the industry layer: the leading division, its share, the listed share and the ranked mix (the tile's bar reads mix and rest).
  function indHit(d, i) {
    const out = { nrev: d.nrev[i], dom: d.dom[i], share: d.dsh[i], lsh: d.lsh ? d.lsh[i] : null, mix: [], rest: 0 };
    if (d.dom[i] === 255) return out;
    let sum = 0; const k = d.k || 1;
    for (let j = 0; j < k; j++) { const code = d.top ? d.top[i * k + j] : d.dom[i], sh = d.top ? d.tsh[i * k + j] : d.dsh[i]; if (code === 255) break; sum += sh; out.mix.push({ code, share: sh, cls: IND_CLASS[code], title: divTitle(code), short: divShort(code) }); }
    out.rest = Math.max(0, 100 - sum); return out;
  }
  // The 25 km grid fades in as a 100 km cell passes 45 px (k 0.45 to 0.8); the 2021 national 5 km shares take over from k 1.5.
  const alpha25 = k => (C25 ? Motion.step(k, 0.45, 0.35, Motion.ease.linear) : 0);
  const alpha5 = k => Motion.step(k, 1.5, 1.0, Motion.ease.linear);
  const tileCache = new Map();
  function tiles(key, build) { if (!tileCache.has(key)) tileCache.set(key, build()); return tileCache.get(key); }
  const classOfShare = (n, a, breaks) => { if (n < 50) return 'below'; const s = 100 * a / n; let c = 0; while (c < breaks.length && s >= breaks[c]) c++; return c; };

  // ---- state -----------------------------------------------------------------------------------
  const NAT = { cx: (BM.extents.national.x[0] + BM.extents.national.x[1]) / 2, cy: (BM.extents.national.y[0] + BM.extents.national.y[1]) / 2 };
  const state = { layer: 'share', year: 2021, cam: { cx: NAT.cx, cy: NAT.cy, k: 0.2 }, hover: null, mode: 'cells' };
  const LAYERS = [
    { id: 'density', label: 'Firm density, 2021', prov: 'Located eligible firms at registered addresses in 2021, counted per 5 km cell nationally and per 1 km and 250 m cell in city windows (M3 pass over the production point layer). Shares are shown only for cells with 50 or more firms.' },
    { id: 'share', label: 'Statement share by year', prov: 'Share of located eligible firms with an original statement, per 100 km cell, financial years 2014 to 2025 (M5 pass over the foundation registry and payload partitions, production projection and located rule; 2012 and 2013 carry no coordinates). City windows at 1 km for 2019 to 2024.' },
    { id: 'change', label: 'Change, 2024 against 2021', prov: 'Figure 2.7 lower panel: change in the located share with a statement, 2024 against 2021, 100 km cells with 50 or more located firms in both years; six classes at ±2 and ±5 points (presentation-finalization-20261019/data/availability-change-cells.csv).' },
    { id: 'cohort', label: 'Cohort inclusion', prov: 'Figure 2.8: share of a cell’s located eligible firms (2021) in the revenue cohort by cash share, pooled quintile classes of supported cells (candidate-02-cell-source.csv; cutpoints 33.3, 38.3, 43.0, 47.6%).' },
    { id: 'lists', label: 'List members (treated), 2021', prov: 'Located members of the sanctions list and the government strategic list (treated) per 100 km cell in 2021 (geography-review-20261006 cells); cells with fewer than 5 members of a list show no count. The lists are fixed memberships, not dated designations. Treated: a firm on at least one of the five lists (sanctions, decree, resident, government strategic, presidential strategic). The word names the study’s group, not an effect.' },
    { id: 'fin', label: 'Median revenue change (descriptive)', prov: 'Percent change of each cell’s median real revenue among the revenue-by-cash cohort firms observed in 2024, against the cell’s 2021 median; cells with 50 or more observed firms (pass2-reconcile geo-revenue-change-from-2021-source.csv). Descriptive: composition changes with observation; not a Chapter 3 estimate.' },
  ];

  if (INDD && IND_T) LAYERS.push({ id: 'industry', label: 'Leading industry by year',
    prov: 'The division (two-digit OKVED 2 code, identical to NACE Rev. 2) with the largest share of nominal revenue among located eligible firms with a statement and a positive revenue value, per 100 km and 25 km cell for 2014 to 2025 and per 1 km city cell for 2019 to 2024 (M11 pass over the foundation registry and payload partitions). Nine classes: ' + IND_T.classes.label.map((l, i) => `${l} (divisions ${IND_T.classes.divisions[i]})`).join('; ') + '. Division names: NACE Rev. 2, Eurostat codelist NACE_R2 version 20.1, which OKVED 2 (OK 029-2014) mirrors at the two-digit level. Shares are within the year. Firms on these lists (treated) are included in the cells and their share of a cell’s revenue is given in the hover. In the Firms view the colour is the division with the largest share of revenue at the coordinate pair among the firms on no list (comparison group); a coordinate pair without a firm with a revenue value is neutral.' });

  // ---- map canvas ------------------------------------------------------------------------------
  // Four layers (24 October 2026): #map (the stage, the basemap and every cells-mode layer), #field (the firms view's
  // address field, WebGL), #marks (the listed marks and, in the firms view, the city labels) and #overlay (the hover).
  // #map no longer reads its pixels back, so it may be hardware-rendered; the field has its own canvas.
  const wrap = $('mapwrap'), mapC = $('map'), fieldC = $('field'), marksC = $('marks'), ovC = $('overlay');
  const mctx = mapC.getContext('2d', { willReadFrequently: true }), kctx = marksC.getContext('2d'), octx = ovC.getContext('2d');
  // The map context keeps willReadFrequently although nothing reads it back any more: the flag also selects the canvas's raster
  // path (CPU with it, GPU without), and without it the cells view's flights ran two to three times slower at device-pixel
  // ratios 2 and 3 in the lab's headless browser on the Intel GPU (measured 24 October 2026); the author may test the other setting.
  let layersOn = true;   // the field and marks canvases are shown in the firms view only, so the cells view composites the two canvases it always had
  const stage = { width: 0, height: 0, scale: 1, base() { mctx.setTransform(stage.scale, 0, 0, stage.scale, 0, 0); } };
  function sizeCanvases() {
    const r = { width: wrap.clientWidth, height: wrap.clientHeight }, dpr = window.devicePixelRatio || 1;   // the content box inside the 1 px border (25 October 2026: the border box was read before, 2 px larger than the canvases' box, so the browser resampled every canvas by 0.17 %)
    stage.width = Math.max(1, Math.round(r.width)); stage.height = Math.max(1, Math.round(r.height)); stage.scale = dpr;
    for (const c of [mapC, fieldC, marksC, ovC].concat(field2d ? [field2d.canvas] : [])) { c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr); c.style.width = stage.width + 'px'; c.style.height = stage.height + 'px'; }   // an explicit CSS size, so a device pixel is a device pixel
    window.__atlasCanvases.marks = { w: stage.width, h: stage.height };
  }
  const cam = () => ({ cx: state.cam.cx, cy: state.cam.cy, k: state.cam.k, ox: stage.width / 2, oy: stage.height / 2 });
  // Camera targets (24 October 2026): pure helpers shared by the presets, the click ladder, the zoom buttons, the keys
  // and the audit API. k is CSS px per km; the floor is the fitted country, the ceiling 200 px per km.
  const SPAN_X = BM.extents.national.x[1] - BM.extents.national.x[0], SPAN_Y = BM.extents.national.y[1] - BM.extents.national.y[0], K_MAX = 200;
  const kFit = () => Math.min(stage.width / SPAN_X, stage.height / SPAN_Y) * 0.96;
  const minSide = () => Math.min(stage.width, stage.height);
  const clampK = k => Motion.clamp(k, kFit(), K_MAX);
  const fitTarget = () => ({ cx: NAT.cx, cy: NAT.cy, k: kFit() });
  const cityTarget = city => ({ cx: city.x, cy: city.y, k: minSide() / 95 });          // the city window: 95 km across the shorter side
  const fineTarget = (cx, cy) => ({ cx, cy, k: minSide() / 20 });                       // the 250 m cells: 20 km across
  const cellTarget = (ix, iy) => ({ cx: (ix + 0.5) * 100, cy: (iy + 0.5) * 100, k: minSide() / 500 });   // a 100 km cell without a preset city: 500 km across
  const atFloor = k => k <= kFit() * 1.001;   // fully zoomed out: the view re-centres on the country (a safe reset)
  // Earlier re-centring (author's decision, 25 October 2026): on a zoom-out step whose new zoom lies in the band from
  // RECENTRE_FROM x kFit down to kFit, the stepped centre is blended toward the country's centre in proportion (none at
  // the band's top, all at the floor). Within one run of zoom-out steps inside the band an anchor holds the un-pulled
  // centre, so the pull stays proportional and continuous; a zoom-in step, a pan, a flight, a preset or a resize forgets
  // it, and nothing is remembered on the way in: the wheel and the trackpad pinch zoom about the cursor, the touch pinch
  // about the finger midpoint, the + button, the + key and a double-tap about the view's centre, as before. The 300 ms
  // settle at the floor stays.
  const RECENTRE_FROM = 2;
  const pullW = k => Motion.clamp((RECENTRE_FROM * kFit() - k) / ((RECENTRE_FROM - 1) * kFit()), 0, 1);
  let pullFrom = null;
  function zoomStep(f, km) {   // km: the point to hold under its pixel {x, y, px, py}, or null for a centre-anchored step
    const k1 = state.cam.k, k2 = clampK(k1 * f);
    if (atFloor(k2)) { pullFrom = null; return fitTarget(); }
    const c = km ? { cx: km.x - (km.px - stage.width / 2) / k2, cy: km.y + (km.py - stage.height / 2) / k2 } : { cx: state.cam.cx, cy: state.cam.cy };   // the point under the cursor stays put, or the centre does
    const w = pullW(k2);
    if (k2 >= k1 || w <= 0) { pullFrom = null; return { cx: c.cx, cy: c.cy, k: k2 }; }   // zooming in, or above the band: nothing remembered
    const w1 = pullW(k1), dx = c.cx - state.cam.cx, dy = c.cy - state.cam.cy;   // the step's own shift of the centre
    if (!pullFrom) pullFrom = w1 <= 0 ? { cx: state.cam.cx, cy: state.cam.cy } : w1 >= 1 ? { cx: NAT.cx, cy: NAT.cy } : { cx: (state.cam.cx - w1 * NAT.cx) / (1 - w1), cy: (state.cam.cy - w1 * NAT.cy) / (1 - w1) };   // entering the band, or resuming inside it without a jump
    pullFrom = { cx: pullFrom.cx + dx, cy: pullFrom.cy + dy };
    return { cx: Motion.lerp(pullFrom.cx, NAT.cx, w), cy: Motion.lerp(pullFrom.cy, NAT.cy, w), k: k2, pull: true };
  }
  const stepAt = (km, f) => zoomStep(f, km);
  const stepCentre = f => zoomStep(f, null);
  const cityInCell = (ix, iy) => bmp.cities.find(c => Math.floor(c.x / 100) === ix && Math.floor(c.y / 100) === iy) || null;
  function fitNational() { state.cam = fitTarget(); }
  function nearestCity(c) { let best = null, bd = Infinity; for (const city of bmp.cities) { const d = Math.hypot(city.x - c.cx, city.y - c.cy); if (d < bd) { bd = d; best = city; } } return { city: best, dist: bd }; }

  // The city windows fade in over k 1.5 to 4 (1 km) and 24 to 40 (250 m); each coarser grid stays drawn around them.
  function gridAlphas(k) { return { one: Motion.step(k, 1.5, 2.5, Motion.ease.linear), fine: Motion.step(k, 24, 16, Motion.ease.linear) }; }
  const winRect = (d, size) => ({ origin: d.origin, size });
  // Draws a coarser layer around a finer window: at full alpha outside the window's square and, while the window fades
  // in, at (1 - w) inside it, so a zoom into open country never leaves blank ground (hand-over fix, 24 October 2026).
  function drawAround(c, win, w, draw) {   // draw(alpha, region): region is the window's square on the inside pass, null outside
    if (!win || w <= 0) { draw(1, null); return; }
    const [px, py] = Motion.project(c, win.origin[0], win.origin[1] + win.size), s = win.size * c.k;
    mctx.save(); stage.base(); mctx.beginPath(); mctx.rect(0, 0, stage.width, stage.height); mctx.rect(px, py, s, s); mctx.clip('evenodd'); draw(1, null); mctx.restore();
    if (w < 1) { mctx.save(); stage.base(); mctx.beginPath(); mctx.rect(px, py, s, s); mctx.clip(); draw(1 - w, win); mctx.restore(); }
    stage.base();
  }

  function drawMap(opts) {
    const flight = !!(opts && opts.flight);   // a flight frame skips the two DOM touches: the audit box and the legend
    Motion.audit.scene = 'map'; if (!flight) window.__atlasCanvases.map = { w: stage.width, h: stage.height }; if (!flight) queueMicrotask(updateContext);   // the strip follows every settled draw, never a flight frame   // the canvases' own size (the content box), for the audit
    const c = cam(); stage.base();
    mctx.fillStyle = theme.stage; mctx.fillRect(0, 0, stage.width, stage.height);
    MM.drawBasemap(mctx, stage, c, bmp, theme, { borderPx: c.k > 9 ? 1.2 : 0.8 });
    const L = state.layer;
    if (state.mode === 'firms') { if (!layersOn) { fieldC.hidden = false; marksC.hidden = false; layersOn = true; } drawFirms(c); drawMarks(c); }
    else if (L === 'density') {
      const ga = gridAlphas(c.k), near = nearestCity(c).city.label, w1 = win1[near] ? winRect(win1[near].d, 90) : null, w025 = win025[near] ? winRect(win025[near].d, 24) : null;
      drawAround(c, w1, ga.one, (a, region) => drawNat(c, a, region, false));
      if (ga.one > 0 && win1[near]) drawAround(c, w025, ga.fine, a => MM.drawDensityCounts(mctx, stage, c, win1[near].paths, theme.density, a * ga.one));
      if (ga.fine > 0 && win025[near]) MM.drawDensityCounts(mctx, stage, c, win025[near].paths, theme.density, ga.fine);
    } else if (L === 'share') {
      // 100 km cells, then the 25 km cells, the national 5 km shares (2021), the city 1 km window of the year and the 250 m window (2021).
      const y = state.year, ga = gridAlphas(c.k), near = nearestCity(c).city.label, a25 = c25[y] ? alpha25(c.k) : 0, a5 = y === 2021 ? alpha5(c.k) : 0;
      const win = y === 2021 ? (win1[near] || null) : (cityYear[near] && cityYear[near][y] ? cityYear[near][y] : null);
      const w1 = win ? winRect(win.d, 90) : null, w025 = y === 2021 && win025[near] ? winRect(win025[near].d, 24) : null;
      const shareColour = cl => (cl === 'below' ? theme.below : theme.ramp6[cl]), shareAlpha = cl => (cl === 'below' ? 0.5 : 1);
      if (a25 < 1) { const paths = tiles('share' + y, () => { const idx = yearIndex[y]; return MM.buildTiles(idx.length, idx.map(i => CY.avail.ix[i]), idx.map(i => CY.avail.iy[i]), j => classOfShare(CY.avail.n[idx[j]], CY.avail.a[idx[j]], YEAR_BREAKS), { gapKm: 15 }); }); MM.drawTiles(mctx, stage, c, paths, shareColour, { alpha: 1 - a25, alphaOf: shareAlpha }); }
      const a25e = a25 * (1 - a5);
      if (c25[y]) { const d = c25[y], paths = tiles('share25-' + y, () => MM.buildTiles(d.count, d.ix, d.iy, i => classOfShare(d.n[i], d.a[i], YEAR_BREAKS), { sizeKm: G25, gapKm: G25 * 0.12 }));   // built now, not mid-flight
        if (a25e > 0) drawAround(c, w1, ga.one, a => MM.drawTiles(mctx, stage, c, paths, shareColour, { alpha: a * a25e, alphaOf: shareAlpha })); }
      if (a5 > 0) drawAround(c, w1, ga.one, (a, region) => drawNat(c, a * a5, region, true));
      if (ga.one > 0 && win) drawAround(c, w025, ga.fine, a => MM.drawDensityShares(mctx, stage, c, win.paths, theme.ramp5, theme.below, a * ga.one));
      if (ga.fine > 0 && w025) MM.drawDensityShares(mctx, stage, c, win025[near].paths, theme.ramp5, theme.below, ga.fine);
    } else if (L === 'change') {
      const a25 = chg25 ? alpha25(c.k) : 0, colour = cl => (cl === 'below' ? theme.below : theme.change6[cl - 1]), alphaOf = cl => (cl === 'below' ? 0.5 : 1);
      if (a25 < 1) { const paths = tiles('change', () => MM.buildTiles(chg.ix.length, chg.ix, chg.iy, i => (chg.supported[i] ? chg.class[i] : 'below'), { gapKm: 15 })); MM.drawTiles(mctx, stage, c, paths, colour, { alpha: 1 - a25, alphaOf }); }
      if (chg25) { const paths = tiles('change25', () => MM.buildTiles(chg25.count, chg25.ix, chg25.iy, i => (chg25.cls[i] > 0 ? chg25.cls[i] : 'below'), { sizeKm: G25, gapKm: G25 * 0.12 })); if (a25 > 0) MM.drawTiles(mctx, stage, c, paths, colour, { alpha: a25, alphaOf }); }
    } else if (L === 'cohort') {
      const paths = tiles('cohort', () => MM.buildTiles(cohIdx.length, cohIdx.map(i => coh.ix[i]), cohIdx.map(i => coh.iy[i]), j => (coh.supported[cohIdx[j]] ? coh.class[cohIdx[j]] : 'below'), { gapKm: 15 }));
      MM.drawTiles(mctx, stage, c, paths, cl => (cl === 'below' ? theme.below : theme.ramp5[cl - 1]), { alphaOf: cl => (cl === 'below' ? 0.5 : 1) });
    } else if (L === 'lists') {
      const a25 = c25[2021] ? alpha25(c.k) : 0;
      if (a25 < 1) { const paths = tiles('lists', () => MM.buildTiles(lists.ix.length, lists.ix, lists.iy, i => listClass(lists.sanctioned[i]), { gapKm: 15 })); MM.drawTiles(mctx, stage, c, paths, cl => theme.ramp5[cl + 1], { alpha: 1 - a25 }); }
      if (c25[2021]) { const d = c25[2021], paths = tiles('lists25', () => MM.buildTiles(d.count, d.ix, d.iy, i => (d.ns[i] >= 5 ? listClass(d.ns[i]) : null), { sizeKm: G25, gapKm: G25 * 0.12 })); if (a25 > 0) MM.drawTiles(mctx, stage, c, paths, cl => theme.ramp5[cl + 1], { alpha: a25 }); }
    } else if (L === 'industry' && INDD) {
      // 100 km cells, then the 25 km cells, then the 1 km city window of the year (2019 to 2024); no 250 m layer.
      const y = state.year, ga = gridAlphas(c.k), near = nearestCity(c).city.label, a25 = ind25[y] ? alpha25(c.k) : 0;
      if (c.k >= 1.2 && !indCityLoaded) ensureIndCity();
      const win = indCity[near] && indCity[near][y] ? indCity[near][y] : null, w1 = win ? winRect(win, 90) : null;
      const indColour = cl => (cl === 'below' ? theme.below : theme.ind9[cl - 1]), indAlpha = cl => (cl === 'below' ? 0.5 : 1), classOfDom = dom => (dom === 255 ? 'below' : IND_CLASS[dom]);
      if (a25 < 1 && ind100[y]) { const d = ind100[y], paths = tiles('ind' + y, () => MM.buildTiles(d.count, d.ix, d.iy, i => classOfDom(d.dom[i]), { gapKm: 15 })); MM.drawTiles(mctx, stage, c, paths, indColour, { alpha: 1 - a25, alphaOf: indAlpha }); }
      if (ind25[y]) { const d = ind25[y], paths = tiles('ind25-' + y, () => MM.buildTiles(d.count, d.ix, d.iy, i => classOfDom(d.dom[i]), { sizeKm: G25, gapKm: G25 * 0.12 })); if (a25 > 0) drawAround(c, w1, ga.one, a => MM.drawTiles(mctx, stage, c, paths, indColour, { alpha: a * a25, alphaOf: indAlpha })); }
      if (ga.one > 0 && win) { const paths = tiles('ind1-' + near + '-' + y, () => MM.buildTiles(win.count, win.ix, win.iy, i => classOfDom(win.dom[i]), { sizeKm: 1, gapKm: 0.1, origin: win.origin })); MM.drawTiles(mctx, stage, c, paths, indColour, { alpha: ga.one, alphaOf: indAlpha }); }
    } else if (L === 'fin') {
      const paths = tiles('fin', () => MM.buildTiles(finIdx.length, finIdx.map(i => fin.ix[i]), finIdx.map(i => fin.iy[i]), j => { const v = fin.change_pct[finIdx[j]]; let cl = 0; while (cl < FIN_BREAKS.length && v >= FIN_BREAKS[cl]) cl++; return cl; }, { gapKm: 15 }));
      MM.drawTiles(mctx, stage, c, paths, cl => theme.change6[cl]);
    }
    stage.base();
    if (state.mode !== 'firms') { if (layersOn) { endPulse(); clearField(); clearMarks(); fieldC.hidden = true; marksC.hidden = true; if (field2d) field2d.canvas.hidden = true; layersOn = false; } drawLabels(mctx, c, 'map'); }   // in the firms view the labels sit on the marks layer, above the field
    if (!flight) { drawLegend(); drawScaleBar(); }
  }

  // ---- firms view: loader, renderer, hover ------------------------------------------------------------
  const firmYears = new Map(), firmPending = new Map(); let firmOrder = [], firmStatus = null;
  const lowerBound = (arr, v) => { let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] < v) lo = m + 1; else hi = m; } return lo; };
  // The artifact host serves only listed file types, so a year's gzipped bytes travel as base64 inside a
  // script (data/firms/firms-YYYY.js, the lab's pattern for binary arrays), injected on demand.
  const loadScript = src => new Promise((ok, fail) => { const el = document.createElement('script'); el.src = src; el.onload = () => ok(); el.onerror = () => fail(new Error('could not load ' + src)); document.head.appendChild(el); });
  async function loadYear(y) {
    const store = (D.firmsYear = D.firmsYear || {});
    if (!store[y]) await loadScript('data/' + FM.files[y].replace(/\.bin\.gz$/, '.js'));
    const b64 = store[y]; if (!b64) throw new Error('no data in the script'); delete store[y];
    const bin = atob(b64); let buf = new ArrayBuffer(bin.length); { const u8 = new Uint8Array(buf); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); }
    const head = new Uint8Array(buf, 0, 2);
    if (head[0] === 0x1f && head[1] === 0x8b) buf = await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    const dv = new DataView(buf), magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3));
    const n = dv.getUint32(4, true), year = dv.getUint16(16, true), ver = dv.getUint16(18, true), exp = FM.by_year[y];
    const MK = FM.layout.mix_rows || 8, RB = FM.layout.record_bytes || (17 + 2 * MK);   // version 3 (round 9): x, y, n, a, f, rv, cls, then MK (ind, ish) pairs by share descending
    if (magic !== 'FRM1' || ver !== 3 || year !== +y || n !== exp.addresses || buf.byteLength !== 32 + RB * n) throw new Error(`bad file (${magic} v${ver} ${year}, ${n} records, ${buf.byteLength} bytes)`);
    const x = new Int32Array(buf, 32, n), yv = new Int32Array(buf, 32 + 4 * n, n), nn = new Uint16Array(buf, 32 + 8 * n, n), a = new Uint16Array(buf, 32 + 10 * n, n), f = new Uint16Array(buf, 32 + 12 * n, n), rv = new Uint16Array(buf, 32 + 14 * n, n), cls = new Uint8Array(buf, 32 + 16 * n, n);
    const mixInd = [], mixSh = []; for (let k = 0; k < MK; k++) { mixInd.push(new Uint8Array(buf, 32 + (17 + 2 * k) * n, n)); mixSh.push(new Uint8Array(buf, 32 + (18 + 2 * k) * n, n)); }
    const ind = mixInd[0], ish = mixSh[0], indCls = new Uint8Array(n), byInd = new Uint32Array(10);
    const share = new Uint8Array(n); let sumN = 0;
    for (let i = 0; i < n; i++) { sumN += nn[i]; const sh = 100 * a[i] / nn[i]; let c = 0; while (c < YEAR_BREAKS.length && sh >= YEAR_BREAKS[c]) c++; share[i] = c; const ic = IND_CLASS[ind[i]]; indCls[i] = ic; byInd[ic]++; }
    if (sumN !== exp.firms) throw new Error(`firms ${sumN} differ from the manifest's ${exp.firms}`);
    if (exp.by_ind && exp.by_ind.some((v, i) => v !== byInd[i])) throw new Error(`addresses by industry class differ from the manifest's for ${y}`);
    return { year: +y, n, x, y: yv, nn, a, f, rv, cls, share, ind, ish, indCls, mixInd, mixSh, mk: MK };
  }
  function ensureYear(y) {
    if (firmYears.has(y)) return Promise.resolve(firmYears.get(y));
    if (firmPending.has(y)) return firmPending.get(y);
    const p = loadYear(y).then(d => { firmYears.set(y, d); firmOrder.push(y); while (firmOrder.length > 3) { const yy = firmOrder.shift(); firmYears.delete(yy); glFree(yy); } firmPending.delete(y); syncMix(); return d; }, e => { firmPending.delete(y); throw e; });
    firmPending.set(y, p); return p;
  }
  // Mark rules by zoom (base, s, cap, floor), the Moscow rasters' three extents: pixel marks with blocks below
  // 20 px per km (the region extent's rule), the city discs to 60, the downtown discs above.
  const MARK = { low: [1, 0.2, 3, 1.5], city: [2, 0.6, 8, 2], downtown: [3, 1.1, 11, 1.5] };
  const markRule = k => (k >= 60 ? MARK.downtown : k >= 20 ? MARK.city : MARK.low);
  const markRadius = (rule, n) => Math.max(rule[3], Math.min(rule[2], rule[0] + rule[1] * Math.sqrt(Math.max(0, n - 1))) / 2);
  const hex2rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const firmClass = (d, i, L) => (L === 'share' ? d.share[i] : L === 'fin' ? d.cls[i] : L === 'industry' ? d.indCls[i] : 0);
  const firmColour = (L, cl) => (L === 'share' ? theme.ramp6[cl] : L === 'fin' ? (cl ? theme.blue6[cl - 1] : theme.neutral) : L === 'industry' ? (cl ? theme.ind9[cl - 1] : theme.neutral) : theme.neutral);
  const firmPalette = L => (L === 'share' ? theme.ramp6 : L === 'fin' ? [theme.neutral].concat(theme.blue6) : L === 'industry' ? [theme.neutral].concat(theme.ind9) : [theme.neutral]).map(hex2rgb);
  function clearField() { if (gl && !glLost) { gl.viewport(0, 0, fieldC.width, fieldC.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); } if (field2d) { field2d.ctx.setTransform(1, 0, 0, 1, 0, 0); field2d.ctx.clearRect(0, 0, field2d.canvas.width, field2d.canvas.height); } }
  function clearMarks() { kctx.setTransform(1, 0, 0, 1, 0, 0); kctx.clearRect(0, 0, marksC.width, marksC.height); }
  function drawLabels(ctx, c, scene) {   // a label is drawn only when its text sits wholly inside the canvas (the audit's offcanvas rule; the video's 300 px edge fade is sized for its own frame)
    Motion.audit.scene = scene;
    if (c.k > 0.6) for (const city of bmp.cities) { const [px, py] = Motion.project(c, city.x, city.y); if (px < 0 || px >= stage.width || py < 0 || py >= stage.height) continue; const tw = Motion.measure(ctx, city.label, 13, 400); if (px + 7 + tw > stage.width - 1 || py - 5 - 13 < 0 || py - 5 + 4 > stage.height) continue; MM.cityLabel(ctx, c, city, theme, { size: 13, dot: 3, dx: 7, dy: -5 }); }
    Motion.audit.scene = 'map';
  }

  // ---- the address field in WebGL (24 October 2026) ---------------------------------------------------------------
  // Below 20 px per km every address is a point of 1, 2 or 3 device pixels (10 and 100 or more firms), snapped to
  // whole pixels and composited "over" with an alpha by count (96, 140, 200, 236 of 256), the earlier blit's rule
  // exactly; from 20 px per km a disc (a square under 1.75 px) sized by the mark rule, drawn largest first at alpha
  // 0.9 with an antialiased edge, overlaps compounding (the author's choice). Positions travel as metres relative to
  // the Moscow point; each frame the camera's integer metres shift them on the GPU and the fraction comes as a small
  // offset, so the GPU multiplies only small exact integers. One buffer set per loaded year, freed with the cache;
  // the layer and the palette are uniforms. Without WebGL, or after a lost context, the 2D fallback below draws the
  // same field into a transparent canvas of its own, composited by the browser ("over" is associative).
  const GL_R = [Math.round(bmp.cities[0].x * 1000), Math.round(bmp.cities[0].y * 1000)];
  const GL_VS = `
attribute vec2 a_pos; attribute float a_n; attribute vec4 a_cls;
uniform vec2 u_shift; uniform vec2 u_off; uniform float u_kk; uniform vec2 u_size;
uniform float u_mode; uniform float u_dpri; uniform float u_sc; uniform vec4 u_rule; uniform float u_which; uniform vec3 u_pal[16];
varying vec4 v_col; varying float v_r; varying float v_half; varying float v_square;
void main() {
  vec2 rel = a_pos + u_shift;
  float dx = u_off.x + rel.x * u_kk, dy = u_off.y - rel.y * u_kk;
  float cls = u_which < 0.5 ? a_cls.x : (u_which < 1.5 ? a_cls.y : (u_which < 2.5 ? a_cls.z : 0.0));
  vec3 col = u_pal[int(cls + 0.5)];
  if (u_mode < 0.5) {
    float bw = u_dpri * (a_n >= 100.0 ? 3.0 : (a_n >= 10.0 ? 2.0 : 1.0));
    float h = floor((bw - 1.0) * 0.5);
    vec2 c = vec2(floor(dx) - h, floor(dy) - h) + bw * 0.5;
    gl_Position = vec4(c.x / u_size.x * 2.0 - 1.0, 1.0 - c.y / u_size.y * 2.0, 0.0, 1.0);
    gl_PointSize = bw;
    float a = (a_n >= 100.0 ? 236.0 : (a_n >= 10.0 ? 200.0 : (a_n >= 2.0 ? 140.0 : 96.0))) / 256.0;
    v_col = vec4(col * a, a); v_r = 0.0; v_half = bw * 0.5; v_square = 0.0;
  } else {
    float r = max(u_rule.w, min(u_rule.z, u_rule.x + u_rule.y * sqrt(max(0.0, a_n - 1.0))) * 0.5);
    float rd = r * u_sc, size = ceil(rd * 2.0 + 3.0);
    gl_Position = vec4(dx / u_size.x * 2.0 - 1.0, 1.0 - dy / u_size.y * 2.0, 0.0, 1.0);
    gl_PointSize = size;
    v_col = vec4(col * 0.9, 0.9); v_r = rd; v_half = size * 0.5; v_square = r < 1.75 ? 1.0 : 0.0;
  }
}`;
  const GL_FS = `
precision mediump float;
varying vec4 v_col; varying float v_r; varying float v_half; varying float v_square;
void main() {
  if (v_r <= 0.0) { gl_FragColor = v_col; return; }
  vec2 d = (gl_PointCoord - 0.5) * (v_half * 2.0);
  float cov = v_square > 0.5 ? clamp(v_r - max(abs(d.x), abs(d.y)) + 0.5, 0.0, 1.0) : clamp(v_r - length(d) + 0.5, 0.0, 1.0);
  gl_FragColor = v_col * cov;
}`;
  let gl = null, glKind = null, glProg = null, glLoc = null, glIdx = null, glLost = false, field2d = null, glError = null, glLoseExt = null;
  const glYears = new Map();   // year -> { pos, n, cls, count }
  const useGL = () => !!gl && !glLost;
  function glInit() {
    if (new URLSearchParams(location.search).get('__nogl') === '1') return false;
    const opts = { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' };
    let g = fieldC.getContext('webgl2', opts), kind = 'webgl2';
    if (!g) { g = fieldC.getContext('webgl', opts); kind = 'webgl'; if (g && !g.getExtension('OES_element_index_uint')) g = null; }
    if (!g) { glError = 'no context'; return false; }
    glError = null;
    const sh = (type, src) => { const s = g.createShader(type); g.shaderSource(s, src); g.compileShader(s); if (!g.getShaderParameter(s, g.COMPILE_STATUS)) { glError = 'shader: ' + g.getShaderInfoLog(s); console.error(glError); return null; } return s; };
    const vs = sh(g.VERTEX_SHADER, GL_VS), fs = sh(g.FRAGMENT_SHADER, GL_FS); if (!vs || !fs) return false;
    const p = g.createProgram(); g.attachShader(p, vs); g.attachShader(p, fs); g.linkProgram(p);
    if (!g.getProgramParameter(p, g.LINK_STATUS)) { glError = 'link: ' + g.getProgramInfoLog(p); console.error(glError); return false; }
    gl = g; glKind = kind; glProg = p; glIdx = g.createBuffer(); glLoseExt = glLoseExt || g.getExtension('WEBGL_lose_context');   // kept from a live context: a lost one returns no extensions
    glLoc = { pos: g.getAttribLocation(p, 'a_pos'), n: g.getAttribLocation(p, 'a_n'), cls: g.getAttribLocation(p, 'a_cls') };
    for (const u of ['u_shift', 'u_off', 'u_kk', 'u_size', 'u_mode', 'u_dpri', 'u_sc', 'u_rule', 'u_which', 'u_pal']) glLoc[u] = g.getUniformLocation(p, u);
    g.disable(g.DEPTH_TEST); g.enable(g.BLEND); g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA);
    return true;
  }
  function glUpload(y, d) {
    if (!useGL() || glYears.has(y)) return;
    const n = d.n, pos = new Float32Array(2 * n), cls = new Uint8Array(4 * n);   // four class bytes per vertex: the share class, the revenue class, the industry class, one spare (round 9)
    for (let i = 0; i < n; i++) { pos[2 * i] = d.x[i] - GL_R[0]; pos[2 * i + 1] = d.y[i] - GL_R[1]; cls[4 * i] = d.share[i]; cls[4 * i + 1] = d.cls[i]; cls[4 * i + 2] = d.indCls[i]; }
    const mk = (data) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); return b; };
    glYears.set(y, { pos: mk(pos), n: mk(d.nn), cls: mk(cls), count: n });
  }
  function glFree(y) { const b = glYears.get(y); if (!b || !gl) return; gl.deleteBuffer(b.pos); gl.deleteBuffer(b.n); gl.deleteBuffer(b.cls); glYears.delete(y); }
  function glPalette(L) { const pal = L === 'share' ? theme.ramp6 : L === 'fin' ? [theme.neutral].concat(theme.blue6) : L === 'industry' ? [theme.neutral].concat(theme.ind9) : [theme.neutral]; const out = new Float32Array(48); for (let i = 0; i < 16; i++) { const c = hex2rgb(pal[Math.min(i, pal.length - 1)]); out[3 * i] = c[0] / 255; out[3 * i + 1] = c[1] / 255; out[3 * i + 2] = c[2] / 255; } return out; }
  function glDraw(c, d, L, i0, i1, discs, idx) {
    const y = state.year; glUpload(y, d); const buf = glYears.get(y); if (!buf) return;
    const W = fieldC.width, Hh = fieldC.height, sc = stage.scale, kk = c.k / 1000 * sc;
    const camx = c.cx * 1000, camy = c.cy * 1000, Cx = Math.round(camx), Cy = Math.round(camy);
    gl.viewport(0, 0, W, Hh); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.useProgram(glProg);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.pos); gl.enableVertexAttribArray(glLoc.pos); gl.vertexAttribPointer(glLoc.pos, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.n); gl.enableVertexAttribArray(glLoc.n); gl.vertexAttribPointer(glLoc.n, 1, gl.UNSIGNED_SHORT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.cls); gl.enableVertexAttribArray(glLoc.cls); gl.vertexAttribPointer(glLoc.cls, 4, gl.UNSIGNED_BYTE, false, 0, 0);
    gl.uniform2f(glLoc.u_shift, GL_R[0] - Cx, GL_R[1] - Cy);   // a_pos + u_shift = (X - R) + (R - C) = X - C, exact integers
    gl.uniform2f(glLoc.u_off, c.ox * sc + (Cx - camx) * kk, c.oy * sc - (Cy - camy) * kk);
    gl.uniform1f(glLoc.u_kk, kk); gl.uniform2f(glLoc.u_size, W, Hh); gl.uniform1f(glLoc.u_mode, discs ? 1 : 0);
    gl.uniform1f(glLoc.u_dpri, Math.max(1, Math.round(sc))); gl.uniform1f(glLoc.u_sc, sc);
    const rule = markRule(c.k); gl.uniform4f(glLoc.u_rule, rule[0], rule[1], rule[2], rule[3]);
    gl.uniform1f(glLoc.u_which, L === 'share' ? 0 : L === 'fin' ? 1 : L === 'industry' ? 2 : 3); gl.uniform3fv(glLoc.u_pal, glPalette(L));
    if (!discs) gl.drawArrays(gl.POINTS, i0, i1 - i0);
    else { gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, glIdx); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.DYNAMIC_DRAW); gl.drawElements(gl.POINTS, idx.length, gl.UNSIGNED_INT, 0); }
  }
  const glEvents = [];
  fieldC.addEventListener('webglcontextlost', e => { e.preventDefault(); glEvents.push('lost'); glLost = true; glYears.clear(); ensureField2d(); drawMap(); });
  fieldC.addEventListener('webglcontextrestored', () => { glEvents.push('restored'); if (glInit()) { glLost = false; if (field2d) field2d.canvas.hidden = true; drawMap(); } else glEvents.push('init failed: ' + glError); });
  glInit();
  // The 2D fallback: the same field into its own transparent canvas, created with willReadFrequently for the blit.
  function ensureField2d() {
    if (field2d) { field2d.canvas.hidden = false; return field2d; }
    const cv = document.createElement('canvas'); cv.id = 'field2d'; cv.setAttribute('aria-hidden', 'true'); fieldC.insertAdjacentElement('afterend', cv);
    cv.width = fieldC.width; cv.height = fieldC.height;
    field2d = { canvas: cv, ctx: cv.getContext('2d', { willReadFrequently: true }), pm: null };
    return field2d;
  }
  // The blocks, composited "over" in premultiplied bytes on a transparent buffer, then written as straight colour.
  function blit2d(f, c, d, L, i0, i1) {
    const ctx2 = f.ctx, W = f.canvas.width, H = f.canvas.height, sc = stage.scale, k = c.k;
    if (!f.pm || f.pm.length !== W * H * 4) f.pm = new Uint8ClampedArray(W * H * 4); const pm = f.pm; pm.fill(0);
    const ax = (c.ox - c.cx * k) * sc, ay = (c.oy + c.cy * k) * sc, kk = k / 1000 * sc;
    const pal = firmPalette(L), dprI = Math.max(1, Math.round(sc)), X = d.x, Y = d.y, N = d.nn;
    for (let i = i0; i < i1; i++) {
      const n = N[i], bw = dprI * (n >= 100 ? 3 : n >= 10 ? 2 : 1);
      const bx = Math.floor(ax + X[i] * kk) - ((bw - 1) >> 1), by = Math.floor(ay - Y[i] * kk) - ((bw - 1) >> 1);
      if (bx >= W || by >= H || bx + bw <= 0 || by + bw <= 0) continue;
      const col = pal[firmClass(d, i, L)] || pal[0], a8 = n >= 100 ? 236 : n >= 10 ? 200 : n >= 2 ? 140 : 96, ia = 256 - a8;
      const sr = (col[0] * a8) >> 8, sg = (col[1] * a8) >> 8, sb = (col[2] * a8) >> 8;
      const x0 = bx < 0 ? 0 : bx, y0 = by < 0 ? 0 : by, x1 = bx + bw > W ? W : bx + bw, y1 = by + bw > H ? H : by + bw;
      for (let yy = y0; yy < y1; yy++) { let o = (yy * W + x0) * 4; for (let xx = x0; xx < x1; xx++, o += 4) { pm[o] = sr + ((pm[o] * ia) >> 8); pm[o + 1] = sg + ((pm[o + 1] * ia) >> 8); pm[o + 2] = sb + ((pm[o + 2] * ia) >> 8); pm[o + 3] = a8 + ((pm[o + 3] * ia) >> 8); } }
    }
    const img = ctx2.createImageData(W, H), px = img.data;
    for (let o = 0; o < pm.length; o += 4) { const a = pm[o + 3]; if (!a) continue; px[o] = Math.min(255, Math.round(pm[o] * 255 / a)); px[o + 1] = Math.min(255, Math.round(pm[o + 1] * 255 / a)); px[o + 2] = Math.min(255, Math.round(pm[o + 2] * 255 / a)); px[o + 3] = a; }
    ctx2.setTransform(1, 0, 0, 1, 0, 0); ctx2.clearRect(0, 0, W, H); ctx2.putImageData(img, 0, 0);
  }
  function discs2d(f, c, d, L, idx) {
    const ctx2 = f.ctx, rule = markRule(c.k); ctx2.setTransform(1, 0, 0, 1, 0, 0); ctx2.clearRect(0, 0, f.canvas.width, f.canvas.height); ctx2.setTransform(stage.scale, 0, 0, stage.scale, 0, 0);
    ctx2.globalAlpha = 0.9;
    for (let j = 0; j < idx.length; j++) { const i = idx[j]; const r = markRadius(rule, d.nn[i]), [px, py] = Motion.project(c, d.x[i] / 1000, d.y[i] / 1000); ctx2.fillStyle = firmColour(L, firmClass(d, i, L)); ctx2.beginPath(); if (r < 1.75) ctx2.rect(px - r, py - r, 2 * r, 2 * r); else ctx2.arc(px, py, r, 0, Math.PI * 2); ctx2.fill(); }
    ctx2.globalAlpha = 1;
  }
  // The discs' order: the largest first, by a counting sort on the radius in tenths of a pixel, over the x-band and the y-range.
  function discOrder(c, d, i0, i1) {
    const k = c.k, rule = markRule(k), pad = markRadius(rule, 65535) / k * 1000 + 500;
    const ym0 = (c.cy - (stage.height - c.oy) / k) * 1000 - pad, ym1 = (c.cy + c.oy / k) * 1000 + pad;
    const buckets = []; let count = 0;
    for (let i = i0; i < i1; i++) { const yv = d.y[i]; if (yv < ym0 || yv > ym1) continue; const r10 = Math.round(markRadius(rule, d.nn[i]) * 10); (buckets[r10] || (buckets[r10] = [])).push(i); count++; }
    const idx = new Uint32Array(count); let j = 0; for (let r10 = buckets.length - 1; r10 >= 0; r10--) if (buckets[r10]) for (const i of buckets[r10]) idx[j++] = i;
    return idx;
  }
  function drawFirms(c) {
    const y = state.year, d = firmYears.get(y), L = state.layer;
    if (!d) {
      firmStatus = `Loading ${y} addresses…`; clearField();
      ensureYear(y).then(() => { if (state.mode === 'firms' && state.year === y) { firmStatus = null; drawMap(); } })
        .catch(e => { console.error(e); firmStatus = `Addresses for ${y} could not be loaded (${e.message}).`; if (state.mode === 'firms' && state.year === y) drawLegend(); });
      return;
    }
    firmStatus = null;
    const k = c.k, pad = markRadius(markRule(k), 65535) / k * 1000 + 1000;
    const i0 = lowerBound(d.x, (c.cx - c.ox / k) * 1000 - pad), i1 = lowerBound(d.x, (c.cx + (stage.width - c.ox) / k) * 1000 + pad);
    const discs = k >= 20, idx = discs ? discOrder(c, d, i0, i1) : null;   // the switch depends on the zoom alone (author's decision, 24 October 2026)
    if (useGL()) { if (field2d) field2d.canvas.hidden = true; glDraw(c, d, L, i0, i1, discs, idx); }
    else { const f = ensureField2d(); if (discs) discs2d(f, c, d, L, idx); else blit2d(f, c, d, L, i0, i1); }
  }
  // Listed firms on the marks layer, above the field (25 October 2026): before its listing year a firm keeps its ordinary
  // mark in the layer's colour for its own state and carries a thin red rim (membership visible from the first frame);
  // from its listing year it is red, solid with a statement and a ring without one. Undated members are red from 2014
  // and never rimmed or pulsed. The marks' size, halo, opacity and rim follow MM.listedRule by zoom (25 October 2026):
  // quietest at the national view, as drawn before at the street zoom. On a forward year change the firms newly red bloom
  // once as in the video: over 1.2 s the mark swells by at least 2.5 px and back while two rings expand from it, the red one
  // to r + 2 + Rmax(k) with an eased decay and a pale trailing one at 0.7 of its radius; backward changes and the cells view
  // show nothing. The pulse button beside the year slider replays the bloom for the firms
  // listed in the shown year; under prefers-reduced-motion a pulse is a still highlight held for the same 1.8 s.
  const PULSE_MS = 1800, DECAY_MS = 1600;   // a bloom lasts 1.8 s: each firm's 1.6 s decay plus the largest stagger (round 9; 1.2 s in round 8, 0.9 s before)
  let pulse = null, pulseRaf = 0, pulseTimer = 0;
  const pulseDelay = new Float32Array(TRN.n);   // each firm's start delay in the running pulse (ms), filled once per pulse: the west-to-east stagger (round 9)
  function makePulse(mask) {   // delays 0 to spreadMs from the westernmost to the easternmost pulsing mark inside the view and its margin
    const c = cam(), k = c.k, LR = MM.listedRule(markRule(k), k, kFit()), ox = c.ox - c.cx * k, oy = c.oy + c.cy * k, W = stage.width + MARK_MARGIN, H = stage.height + MARK_MARGIN, yi = state.year - 2014;
    let x0 = Infinity, x1 = -Infinity;
    for (let i = 0; i < TRN.n; i++) { if (!mask[i] || TRN.filed[i][yi] === '-') continue; const px = ox + TRN.x[i] * k, py = oy - TRN.y[i] * k; if (px < -MARK_MARGIN || px > W || py < -MARK_MARGIN || py > H) continue; if (TRN.x[i] < x0) x0 = TRN.x[i]; if (TRN.x[i] > x1) x1 = TRN.x[i]; }
    const span = x1 > x0 ? x1 - x0 : 0;
    for (let i = 0; i < TRN.n; i++) pulseDelay[i] = mask[i] && span ? LR.spreadMs * Motion.clamp((TRN.x[i] - x0) / span, 0, 1) : 0;
  }
  const setLive = on => $('yearrow').classList.toggle('live', !!on);   // the context layer's live marker while a pulse runs (round 9)
  function endPulse() { if (pulseRaf) cancelAnimationFrame(pulseRaf); pulseRaf = 0; if (pulseTimer) clearTimeout(pulseTimer); pulseTimer = 0; pulse = null; setLive(false); }
  function beginPulse(mask, count) {
    endPulse();
    makePulse(mask); pulse = { t0: performance.now(), mask, count, static: reduceMotion(), at: null }; setLive(true);
    if (pulse.static) { if (state.mode === 'firms') drawMarks(cam()); pulseTimer = setTimeout(() => { pulseTimer = 0; pulse = null; setLive(false); if (state.mode === 'firms') drawMarks(cam()); }, PULSE_MS); }
    else pulseRaf = requestAnimationFrame(pulseTick);
  }
  function startPulse(yPrev, yNew) {   // the automatic pulse: the firms newly red on a forward year change
    if (yNew === yPrev) return;
    endPulse();   // any change of year ends a running pulse; a backward one starts none
    if (!TRN || yNew < yPrev) return;
    const mask = new Uint8Array(TRN.n), yi = yNew - 2014; let any = 0;
    for (let i = 0; i < TRN.n; i++) if (TRN.red_from[i] > yPrev && TRN.red_from[i] <= yNew && TRN.filed[i][yi] !== '-') { mask[i] = 1; any++; }
    if (any) beginPulse(mask, any);
  }
  function pulseTick() { pulseRaf = 0; if (!pulse) return; if (performance.now() - pulse.t0 >= PULSE_MS) pulse = null; if (state.mode === 'firms') drawMarks(cam()); if (pulse) pulseRaf = requestAnimationFrame(pulseTick); }
  const manualMasks = new Map();   // per year: the dated firms listed that year and present in it (undated firms never pulse)
  function manualMask(y) {
    if (!manualMasks.has(y)) { const mask = new Uint8Array(TRN ? TRN.n : 0), yi = y - 2014; let count = 0; if (TRN) for (let i = 0; i < TRN.n; i++) if (TRN.red_from[i] === y && !TRN.undated[i] && TRN.filed[i][yi] !== '-') { mask[i] = 1; count++; } manualMasks.set(y, { mask, count }); }
    return manualMasks.get(y);
  }
  function replayPulse() { if (!FIRMS_OK || state.mode !== 'firms') return 0; const m = manualMask(state.year); if (!m.count) return 0; beginPulse(m.mask, m.count); return m.count; }
  function syncPulseButton() {
    const b = $('pulse'); if (!b) return;
    const show = FIRMS_OK && state.mode === 'firms', y = state.year, count = show ? manualMask(y).count : 0;
    b.hidden = !show; b.disabled = !count;
    const label = count ? `Replay the bloom of the firms listed in ${y}` : `No firm on these lists was listed in ${y}`; b.title = label; b.setAttribute('aria-label', label);
  }
  const MARK_MARGIN = 80;   // CSS px beyond the view inside which marks are drawn: the street zoom's flash and ring reach 72.6 px (round 9)
  const PH = { on: false, swell: 0, release: 0, grow: 0, glowA: 0, p: 0 };   // the bloom phase of the mark being drawn, reused (no allocation per frame)
  // The listed marks and the bloom (round 9): while a pulse runs, pass 0 lays the pale glows of the pulsing marks under
  // everything and pass 1 draws the marks and their rings; each pulsing firm runs its own clock, started by its stagger delay.
  function drawMarks(c) {
    clearMarks(); kctx.setTransform(stage.scale, 0, 0, stage.scale, 0, 0);
    const year = state.year, yi = year - 2014, k = c.k, LR = MM.listedRule(markRule(k), k, kFit()), L = state.layer, now = performance.now();
    const st = !!(pulse && pulse.static), tNow = pulse ? (pulse.at != null ? pulse.at : now - pulse.t0) : 0;
    const ox = c.ox - c.cx * k, oy = c.oy + c.cy * k, W = stage.width + MARK_MARGIN, H = stage.height + MARK_MARGIN;
    for (let pass = pulse && !st ? 0 : 1; pass < 2; pass++) for (let i = 0; i < TRN.n; i++) {
      const ch = TRN.filed[i][yi]; if (ch === '-') continue;
      const pulsing = !!(pulse && pulse.mask[i]); if (pass === 0 && !pulsing) continue;
      const px = ox + TRN.x[i] * k, py = oy - TRN.y[i] * k; if (px < -MARK_MARGIN || px > W || py < -MARK_MARGIN || py > H) continue;
      const r = MM.listedRadius(LR, TRN.pile[i]);
      if (pulsing) { if (st) { PH.on = true; PH.swell = 0.6; PH.release = 3 / 7; PH.grow = 1; PH.glowA = 0; PH.p = 1; } else MM.pulsePhase((tNow - pulseDelay[i]) / 1000, PH); }
      if (pass === 0) { if (PH.on && PH.glowA > 0.01) MM.glowDisc(kctx, px, py, 2 * (r + MM.flashPeak(r) * PH.swell), PH.glowA, theme); continue; }
      const fade = pulsing && PH.on ? 1 - PH.grow : 1;   // the ordinary fill and rim fade as the bloom grows; a firm whose stagger has not started is still rimmed
      if (TRN.red_from[i] > year || (pulsing && fade > 0.001)) {
        const sc = TRN.state[i][yi], col = L === 'fin' && sc >= '1' && sc <= '6' ? theme.blue6[+sc - 1] : L === 'share' ? theme.ramp6[ch === '1' ? 5 : 0] : theme.neutral;
        MM.rimmedMark(kctx, px, py, r, col, 0.9 * fade, LR.rimA * fade, theme, LR.rimW);
      }
      if (TRN.red_from[i] <= year) {
        if (pulsing) {
          if (!PH.on) continue;   // before its own start the firm shows its rimmed mark only
          const rr = r + MM.flashPeak(r) * PH.swell, core = PH.release < 1 ? MM.coreAt(ch === '1' ? theme.coreRed : theme.coreLand, PH.release) : null;
          const tt = st ? 0 : Motion.clamp((tNow - pulseDelay[i]) / DECAY_MS, 0, 1);
          MM.listedMark(kctx, px, py, rr, ch === '1' ? 1 : 0, PH.grow * (1 - (1 - LR.alpha) * tt), theme, LR.halo, core);
          if (st || (PH.p > 0 && PH.p < 1)) MM.pulseRing(kctx, px, py, r, LR, PH.p, theme, st);
        } else MM.listedMark(kctx, px, py, r, ch === '1' ? 1 : 0, LR.alpha, theme, LR.halo);
      }
    }
    drawLabels(kctx, c, 'marks');
  }
  // Hover in firms mode: the nearest address within its mark radius plus 2 px, found through the sorted x column, and the
  // listed firms at the cursor (within their mark radius plus 2 px, at least 6 px; a listed mark wins over an address):
  // counts, and for listed firms their list-file names (25 October 2026).
  const LISTED_HIT = 6;   // the listed marks' hit radius floor in CSS px (25 October 2026): a red dot is hovered within 6 px, and it wins over an address mark
  function firmAt(km) {
    const c = cam(), k = c.k, rule = markRule(k), LR = MM.listedRule(rule, k, kFit()), yi = state.year - 2014;
    const out = { kind: 'none', region: regionAt(km.px, km.py), kmx: km.x, kmy: km.y, ix: Math.floor(km.x / 100), iy: Math.floor(km.y / 100), grid: 100 };
    const d = firmYears.get(state.year);
    if (d) {
      const Rpx = markRadius(rule, 65535) + 2, Rm = Rpx / k * 1000, xm = km.x * 1000, ym = km.y * 1000;
      const i0 = lowerBound(d.x, xm - Rm), i1 = lowerBound(d.x, xm + Rm); let best = -1, bd = Infinity, br = 0;
      for (let i = i0; i < i1; i++) {
        const dy = d.y[i] - ym; if (dy > Rm || dy < -Rm) continue;
        const [px, py] = Motion.project(c, d.x[i] / 1000, d.y[i] / 1000), r = markRadius(rule, d.nn[i]) + 2, dist = Math.hypot(px - km.px, py - km.py);
        if (dist <= r && dist < bd) { bd = dist; best = i; br = r; }
      }
      if (best >= 0) { const [px, py] = Motion.project(c, d.x[best] / 1000, d.y[best] / 1000); Object.assign(out, { kind: 'firm', rec: best, n: d.nn[best], a: d.a[best], f: d.f[best], cls: d.cls[best], ind: d.ind ? d.ind[best] : null, ish: d.ish ? d.ish[best] : 0, px, py, r: br - 2 }); }
    }
    let ln = 0, lred = 0, lring = 0, lrim = 0, rimA = Infinity, rimB = 0, lpx = 0, lpy = 0, lr = 0, ld = Infinity;
    const top = [-1, -1, -1], topKey = [Infinity, Infinity, Infinity];   // the three listed firms shown by name: red first, then by listing year, then by distance
    const ox = c.ox - c.cx * k, oy = c.oy + c.cy * k;
    for (let i = 0; i < TRN.n; i++) {
      const ch = TRN.filed[i][yi]; if (ch === '-') continue;
      const px = ox + TRN.x[i] * k, py = oy - TRN.y[i] * k, r = MM.listedRadius(LR, TRN.pile[i]), hit = Math.max(r + 2, LISTED_HIT), dist = Math.hypot(px - km.px, py - km.py);
      if (dist > hit) continue;
      const red = TRN.red_from[i] <= state.year;
      ln++; if (red) { lred++; if (ch === '0') lring++; } else { lrim++; const yf = TRN.red_from[i]; if (yf < rimA) rimA = yf; if (yf > rimB) rimB = yf; }
      if (dist < ld) { ld = dist; lpx = px; lpy = py; lr = r; }
      const key = (red ? 0 : 1e6) + TRN.red_from[i] * 100 + Math.min(99, dist);
      for (let s = 0; s < 3; s++) if (key < topKey[s]) { for (let q = 2; q > s; q--) { top[q] = top[q - 1]; topKey[q] = topKey[q - 1]; } top[s] = i; topKey[s] = key; break; }
    }
    if (ln) {
      out.listed = { n: ln, red: lred, ring: lring, rim: lrim, rim_from: lrim ? rimA : null, rim_to: lrim ? rimB : null, within_km: k < 20 ? Math.max(MM.listedRadius(LR, 1) + 2, LISTED_HIT) / k : 0, top: top.filter(i => i >= 0) };
      if (out.kind === 'firm') out.address = { rec: out.rec, n: out.n, a: out.a, f: out.f, cls: out.cls, ind: out.ind, ish: out.ish, px: out.px, py: out.py, r: out.r };   // the address under the same cursor keeps its line and its panel row
      Object.assign(out, { kind: 'listed', px: lpx, py: lpy, r: lr });   // a listed mark wins the tie
    }
    return out;
  }
  const hitAt = km => (state.mode === 'firms' ? firmAt(km) : cellAt(km));
  const breakLabels = (breaks, m) => Array.from({ length: m }, (_, i) => i === 0 ? `< ${breaks[0]}%` : i === m - 1 ? `≥ ${breaks[i - 1]}%` : `${breaks[i - 1]}–${breaks[i]}%`);

  // The legend and the note (24 October 2026): a title row with a toggle and a body, collapsible; collapsed by default
  // on a narrow map (under 600 px) and remembered per viewer; written only when the text changes.
  function readPref(key) { try { const v = localStorage.getItem(key); return v === 'open' || v === 'closed' ? v : null; } catch (e) { return null; } }
  function writePref(key, v) { try { localStorage.setItem(key, v); } catch (e) { /* no storage */ } }
  const ui = { legend: readPref('atlas-legend'), note: readPref('atlas-note'), ctx: readPref('atlas-context') };
  const legendOpen = () => (ui.legend ? ui.legend === 'open' : stage.width >= 600);
  const noteOpen = () => (ui.note ? ui.note === 'open' : stage.width >= 600);
  function applyPanels() {
    dropObstacles();
    const lo = legendOpen(), no = noteOpen();
    $('legendbody').hidden = !lo; const lt = $('legendtoggle'); lt.textContent = lo ? '▾' : '▸'; lt.setAttribute('aria-expanded', String(lo)); lt.setAttribute('aria-label', lo ? 'Collapse the legend' : 'Expand the legend');
    $('notebody').hidden = !no; $('notelabel').hidden = no; const nt = $('notetoggle'); nt.textContent = no ? '▾' : '▸'; nt.setAttribute('aria-expanded', String(no)); nt.setAttribute('aria-label', no ? 'Collapse the note' : 'Expand the note');
  }
  // On a narrow map (under 600 px) one panel is open at a time: opening the legend closes the note and the reverse.
  const narrow = () => stage.width < 600;
  const tight = () => narrow() || stage.height < 640;   // a map too narrow or too short for the mix box and the legend together (round 9)
  function setLegend(v) { ui.legend = v; if (v === 'open' && narrow()) ui.note = 'closed'; if (v === 'open' && tight() && mixOpen()) { mixUI.open = 'closed'; applyMix(); } applyPanels(); }
  function setNote(v) { ui.note = v; if (v === 'open' && narrow()) ui.legend = 'closed'; applyPanels(); }
  $('legendtoggle').addEventListener('click', () => { const v = legendOpen() ? 'closed' : 'open'; writePref('atlas-legend', v); setLegend(v); });
  $('notetoggle').addEventListener('click', () => { const v = noteOpen() ? 'closed' : 'open'; writePref('atlas-note', v); setNote(v); });
  // ---- the revenue mix box (round 9, the author's correction of 25 October 2026) --------------------------------------------
  // A translucent box at the top left of the map on the industry layer: the revenue mix of what the cursor is over (the
  // 100 km, 25 km or 1 km cell in the cells view, the coordinate pair in the firms view), one row per division present by
  // share descending, each with its class colour (fixed per division, never by rank), the division's name and its share of
  // that unit's revenue, at most eight rows then "other divisions"; with the cursor off the map, the mix of the view.
  // Collapsible, remembered per viewer; on a narrow map it opens below the note and is collapsed by default.
  const mixUI = { open: readPref('atlas-mix'), key: '' };
  const mixOpen = () => (mixUI.open ? mixUI.open === 'open' : !tight());
  window.addEventListener('resize', () => requestAnimationFrame(() => { applyStrip(); applyMix(); }));   // after the canvases are re-sized: the narrow forms follow the map's width
  function placeMix() {
    const el = $('mixbox'), note = $('mapnote'); el.style.top = '12px'; if (el.hidden || note.hidden) return;
    const a = el.getBoundingClientRect(), b = note.getBoundingClientRect(), m = wrap.getBoundingClientRect();
    if (a.right + 8 > b.left && a.top < b.bottom) el.style.top = Math.round(b.bottom - m.top + 8) + 'px';
  }
  function applyMix() {
    const el = $('mixbox'), show = state.layer === 'industry' && !!IND_T; el.hidden = !show; dropObstacles(); if (!show) return;
    const open = mixOpen(), t = $('mixtoggle'); el.classList.toggle('closed', !open); $('mixbody').hidden = !open;
    t.textContent = open ? '▾' : '▸'; t.setAttribute('aria-expanded', String(open)); t.setAttribute('aria-label', open ? 'Collapse the revenue mix' : 'Expand the revenue mix');
    placeMix();
  }
  function openMix(v) { mixUI.open = v; if (v === 'open' && tight() && legendOpen()) { ui.legend = 'closed'; applyPanels(); } applyMix(); mixUI.key = ''; fillMixBox(state.hover); }
  $('mixtoggle').addEventListener('click', () => { const v = mixOpen() ? 'closed' : 'open'; writePref('atlas-mix', v); openMix(v); });
  function mixRowsFor(h) {   // the hovered unit's rows, or null for the view's
    if (!h) return null;
    if (h.kind === 'firm' || h.kind === 'listed' || h.kind === 'none') {
      const ad = h.kind === 'firm' ? h : h.address; if (!ad || ad.rec == null) return null; const d = firmYears.get(state.year); if (!d || !d.mixInd) return null;
      const rows = []; let sum = 0; for (let k = 0; k < d.mk; k++) { const code = d.mixInd[k][ad.rec]; if (code === 255) break; const sh = d.mixSh[k][ad.rec]; sum += sh; rows.push({ code, share: sh }); }
      return { rows, other: Math.max(0, 100 - sum), unit: 'coordinate pair at the cursor', empty: !rows.length };
    }
    if (h.mix) return { rows: h.mix.map(m => ({ code: m.code, share: m.share })), other: h.rest, unit: `${h.fine ? '1 km' : h.grid === G25 ? '25 km' : '100 km'} cell at the cursor`, empty: h.dom === 255 || !h.mix.length };
    return null;
  }
  const mixColour = code => theme.ind9[(IND_CLASS[code] || 9) - 1];
  function fillMixBox(h) {
    const el = $('mixbox'); if (el.hidden || !mixOpen()) return;
    let m = mixRowsFor(h); if (!m) { computeViewMix(); m = viewMix.rows ? { rows: viewMix.rows, other: viewMix.other, unit: viewMix.unit, empty: !viewMix.rows.length } : null; }
    const key = `${state.year}|${m ? m.unit + '|' + m.rows.map(r => r.code + ':' + r.share).join(',') + '|' + m.other : 'none'}`;
    if (mixUI.key === key) return; mixUI.key = key;
    $('mixtitle').textContent = `Revenue mix, ${state.year}${state.year === 2025 ? '*' : ''}`; $('mixunit').textContent = m ? m.unit : '';
    $('mixrows').innerHTML = !m ? '<div class="r muted"><span class="nm">no data in view</span></div>' : m.empty ? '<div class="r muted"><span class="nm">no firm with a revenue value here</span></div>'
      : m.rows.map(r => `<div class="r"><span class="sw" style="background:${mixColour(r.code)}"></span><span class="nm" title="${esc(divLabel(r.code))}">${esc(divShort(r.code))}${r.code ? ` (${divPad(r.code)})` : ''}</span><span class="pc num">${r.share ? r.share + '%' : '<1%'}</span></div>`).join('')
        + (m.other > 0 ? `<div class="r muted"><span class="sw" style="background:transparent"></span><span class="nm">other divisions</span><span class="pc num">${m.other}%</span></div>` : '');
  }
  function syncMix() { applyMix(); mixUI.key = ''; fillMixBox(state.hover); }
  // ---- the context strip (round 9, 25 October 2026) ------------------------------------------------------------------------
  // One line along the bottom of the map: a fact about the region under the camera (the country, the registry region or the
  // city window, by zoom band and layer, from the loaded data: regions.json and the page's own totals) or, once in a while, a
  // tip on using the page (each once per session, never while the cursor moves, at least 12 s after the last fact change).
  // At the left the region's simplified outline, stroked on over 0.4 s when the region changes. Nothing external, no fetch.
  let obsCache = null;   // the tile's obstacle boxes (the panels), read once per layout and dropped when a panel is written, toggled or resized
  const dropObstacles = () => { obsCache = null; };
  const regIndex = new Map();   // region -> year -> row index of regions.json
  if (REG) for (let i = 0; i < REG.rows; i++) { let m = regIndex.get(REG.region[i]); if (!m) regIndex.set(REG.region[i], m = new Map()); m.set(REG.year[i], i); }
  const regRow = (name, y) => { const m = regIndex.get(name); return m && m.has(y) ? m.get(y) : null; };
  const citySums = {};   // label -> year -> {n, a} over the 1 km window's cells
  function citySum(label, y) { const d = cityYear[label] && cityYear[label][y] ? cityYear[label][y].d : null; if (!d) return null; citySums[label] = citySums[label] || {}; if (!citySums[label][y]) { let n = 0, a = 0; for (let i = 0; i < d.count; i++) { n += d.n[i]; if (d.a[i] > 0) a += d.a[i]; } citySums[label][y] = { n, a }; } return citySums[label][y]; }
  const stripState = { fact: null, tip: null, lastFactAt: 0, tipTimer: 0, tipEnd: 0, glyphName: null, cur: 'A', seen: new Set(), tickRaf: 0 };
  try { const v = JSON.parse(sessionStorage.getItem('atlas-tips') || '[]'); if (Array.isArray(v)) v.forEach(i => stripState.seen.add(+i)); } catch (e) { /* no storage */ }
  const stripOpen = () => (ui.ctx ? ui.ctx === 'open' : true);
  function applyStrip() { dropObstacles(); const open = stripOpen(), el = $('ctxstrip'), t = $('ctxtoggle'); el.classList.toggle('narrow', narrow()); wrap.classList.toggle('narrow', narrow()); el.classList.toggle('closed', !open); wrap.classList.toggle('strip-open', open); t.textContent = open ? '▾' : '▸'; t.setAttribute('aria-expanded', String(open)); t.setAttribute('aria-label', open ? 'Collapse the context line' : 'Expand the context line'); }
  $('ctxtoggle').addEventListener('click', () => { const v = stripOpen() ? 'closed' : 'open'; writePref('atlas-context', v); ui.ctx = v; applyStrip(); if (v === 'open') updateContext(true); });
  const pts = (n, d) => `${fmt.signed(d)} points`;
  const shareOf = (a, n) => (n ? 100 * a / n : null);
  // The fact under the camera: {band, name, kind, text (HTML with the figures in .num spans), nums (the figures, for the tick)}
  function factFor(band, name) {
    const y = state.year, L = state.layer, ys = y + (y === 2025 ? '*' : ''), N = [], num = (v, f) => { N.push(v); return `<span class="num">${f}</span>`; };
    const nw = narrow();   // the short forms: no change clause, no basis words
    const loc = s => `<span class="loc">${esc(s)}</span>`;   // the place name in tracked capitals (round 10)
    const sp = (f) => `<span class="num">${f}</span>`;   // the short forms (a second tier under the narrow ones): used only when the narrow text overflows the strip, measured once per fact change
    const shareLine = (label, n, a, n21, a21, what) => { const sh = shareOf(a, n), s21 = shareOf(a21, n21), Nf = [], nf = (v, f) => { Nf.push(v); return sp(f); }; let t = `${label}, ${ys}: ${nf(n, fmt.int(n))} ${nw ? 'firms' : what}, ${nf(sh, fmt.pct(sh))} with a statement`; if (!nw && y !== 2021 && s21 != null && sh != null) t += `, ${nf(sh - s21, pts(0, sh - s21))} against 2021`; return { text: t, nums: Nf, short: `${label}, ${ys}: ${sp(fmt.pct(sh))} with a statement`, shortNums: [sh] }; };
    if (band === 'city' && L === 'industry') { band = 'region'; name = regionAt(stage.width / 2, stage.height / 2) || name; }   // no window-level industry aggregate exists: the region's leading division (registered-in basis)
    if (band === 'city') {
      const cs = citySum(name, y), c21 = citySum(name, 2021);
      if (cs && cs.n) return Object.assign({ band, name, kind: 'city-' + L }, shareLine(nw ? loc(name) : `${loc(name)} window`, cs.n, cs.a, c21 ? c21.n : 0, c21 ? c21.a : 0, 'located firms in the 1 km cells'));
      band = 'region';   // no window figures: the region's fact
    }
    if (band === 'region' && !regIndex.has(name)) { band = 'national'; name = 'Russia'; }
    const i = REG ? regRow(name, y) : null, i21 = REG ? regRow(name, 2021) : null, nat = band === 'national';
    const n = i != null ? REG.n[i] : null, a = i != null ? REG.a[i] : null, n21 = i21 != null ? REG.n[i21] : 0, a21 = i21 != null ? REG.a[i21] : 0;
    const what = nat ? 'located firms' : 'firms registered in the region';
    if (state.mode === 'firms' && nat && FM && FM.by_year[y]) { const by = FM.by_year[y]; return { band, name, kind: 'firms', text: nw ? `${loc('Russia')}, ${ys}: ${num(by.firms, fmt.int(by.firms))} firms on no list (comparison group)` : `${loc('Russia')}, ${ys}: ${num(by.firms, fmt.int(by.firms))} firms on no list (comparison group) at ${num(by.addresses, fmt.int(by.addresses))} coordinate pairs; ${num(by.listed, fmt.int(by.listed))} on the lists (treated)`, nums: N, short: `${loc('Russia')}, ${ys}: ${sp(fmt.int(by.firms))} on no list (comparison group)`, shortNums: [by.firms] }; }
    if (i == null) { const t = totals[y]; if (t) return { band, name, kind: 'share-t', text: `${loc('Russia')}, ${ys}: ${num(t.located, fmt.int(t.located))} located firms, ${num(t.share, fmt.pct(t.share))} of eligible firms with a statement`, nums: N }; return { band, name, kind: 'none', text: '', nums: N }; }
    if (L === 'industry' && REG.d1[i] !== 255) { const d = REG.d1[i]; return { band, name, kind: 'industry', text: nw ? `${loc(name)}, ${ys}: ${esc(divShort(d))} (${divPad(d)}), ${num(REG.s1[i], REG.s1[i] + '%')} of revenue` : `${loc(name)}, ${ys}: ${esc(divShort(d))} (division ${divPad(d)}) leads with ${num(REG.s1[i], REG.s1[i] + '%')} of revenue`, nums: N, short: `${loc(name)}, ${ys}: division ${divPad(d)}, ${sp(REG.s1[i] + '%')} of revenue`, shortNums: [REG.s1[i]] }; }
    if (L === 'lists') return { band, name, kind: 'lists', text: nw ? `${loc(name)}, ${ys}: ${num(REG.listed[i], fmt.int(REG.listed[i]))} of ${num(n, fmt.int(n))} on the lists (treated)` : `${loc(name)}, ${ys}: ${num(REG.listed[i], fmt.int(REG.listed[i]))} ${nat ? 'located firms' : 'firms registered in the region'} on the five lists (treated) of ${num(n, fmt.int(n))}`, nums: N, short: `${loc(name)}, ${ys}: ${sp(fmt.int(REG.listed[i]))} on the lists (treated)`, shortNums: [REG.listed[i]] };
    if (L === 'change') { const i24 = regRow(name, 2024); if (i24 != null && i21 != null) { const s21 = shareOf(REG.a[i21], REG.n[i21]), s24 = shareOf(REG.a[i24], REG.n[i24]); return { band, name, kind: 'change', text: `${loc(name)}: ${num(s21, fmt.pct(s21))} with a statement in 2021, ${num(s24, fmt.pct(s24))} in 2024, ${num(s24 - s21, pts(0, s24 - s21))}`, nums: N, short: `${loc(name)}: ${sp(fmt.pct(s21))} in 2021, ${sp(fmt.pct(s24))} in 2024`, shortNums: [s21, s24] }; } }
    return Object.assign({ band, name, kind: 'share' }, shareLine(loc(name), n, a, n21, a21, what));
  }
  function bandUnderCamera() {
    const c = cam();
    if (c.k < 3 * kFit()) return ['national', 'Russia'];
    const near = nearestCity(c).city.label, w = win1[near] ? win1[near].d : null;
    if (c.k >= 1.5 && w && c.cx >= w.origin[0] && c.cx < w.origin[0] + 90 && c.cy >= w.origin[1] && c.cy < w.origin[1] + 90 && cityYear[near] && cityYear[near][state.year]) return ['city', near];
    const rn = regionAt(stage.width / 2, stage.height / 2);
    return rn && regIndex.has(rn) ? ['region', rn] : ['national', 'Russia'];
  }
  function updateContext(force) {
    if (!stripOpen()) return;
    const [band, name] = bandUnderCamera(), f = factFor(band, name);
    const same = stripState.fact && stripState.fact.kind === f.kind && stripState.fact.name === f.name && (stripState.fact.full || stripState.fact.text) === f.text;
    if (same && !force) return;
    const prev = stripState.fact; stripState.fact = f; stripState.lastFactAt = performance.now();
    if (stripState.tip) endTip(false);
    setStripText(f, prev); setGlyph(band === 'national' ? 'Russia' : band === 'city' ? regionAt(stage.width / 2, stage.height / 2) || 'Russia' : name);
    scheduleTip();
  }
  function setStripText(f, prev) {   // crossfade the two stacked spans; when the previous fact had the same figures, the numbers count to the new values
    const ina = stripState.cur === 'A' ? $('ctxB') : $('ctxA'), out = stripState.cur === 'A' ? $('ctxA') : $('ctxB'); stripState.cur = stripState.cur === 'A' ? 'B' : 'A';
    ina.innerHTML = f.text; f.full = f.text; ina.classList.toggle('tip', f.kind === 'tip');   // a tip reads in tracked capitals (round 10)
    if (f.short && (ina.scrollWidth > ina.clientWidth + 1 || ina.scrollHeight > ina.clientHeight + 1)) { ina.innerHTML = f.short; f.text = f.short; f.nums = f.shortNums || []; }   // one layout read per fact change, never per frame
    ina.classList.add('live'); ina.classList.remove('hid'); out.classList.add('hid'); out.classList.remove('live');
    if (stripState.tickRaf) { cancelAnimationFrame(stripState.tickRaf); stripState.tickRaf = 0; }
    if (prev && prev.kind === f.kind && prev.nums.length === f.nums.length && f.nums.length && !reduceMotion()) {
      const spans = ina.querySelectorAll('.num'), finals = [...spans].map(sp => sp.textContent), t0 = performance.now();
      const fmtLike = (final, v) => { const m = final.match(/^([+−-]?)([\d,]+)(\.(\d+))?(.*)$/); if (!m) return final; const dec = m[4] ? m[4].length : 0; const sign = m[1] === '−' || m[1] === '-' ? (v < 0 ? '−' : m[1] === '+' ? '+' : '') : (m[1] === '+' ? (v < 0 ? '−' : '+') : ''); return sign + fmt.int(Math.floor(Math.abs(v))).replace(/\.\d+$/, '') .replace(/^(\d)/, '$1') + (dec ? '.' + Math.abs(v).toFixed(dec).split('.')[1] : '') + m[5]; };
      const step = () => { stripState.tickRaf = 0; const u = Math.min(1, (performance.now() - t0) / 300), e = Motion.ease.outCubic(u); spans.forEach((sp, j) => { sp.textContent = u >= 1 ? finals[j] : fmtLike(finals[j], prev.nums[j] + (f.nums[j] - prev.nums[j]) * e); }); if (u < 1) stripState.tickRaf = requestAnimationFrame(step); };
      stripState.tickRaf = requestAnimationFrame(step);
    }
    setTimeout(() => { if (stripState.fact === f) ina.classList.remove('live'); }, 320);
  }
  // Tips on using the page, each once per session, shown only when the strip is open, nothing is moving, the cursor is still and 12 s have passed since the last fact change.
  const TIPS = [   // each at most 72 characters (round 10: tracked capitals in the strip's slot at 768 px and the two-line phone strip); the two long round-9 tips split in two
    { text: 'A click on a cell flies to it: the city window from the country.', touch: 'Tap a cell for its values, double-tap to zoom, pinch to zoom.' },
    { text: 'From a city, a click flies to the 20 km scale, then steps of 2.5.', mouse: true },
    { text: 'Shift+click steps the zoom out at the point.', mouse: true },
    { text: 'The pulse button by the year replays the bloom of its listed firms.', firms: true },
    { text: 'The Firms view draws every registered address by year.', firms: true },
    { text: 'Firms on the five lists (treated) turn red from their listing year.', firms: true },
    { text: 'Open the atlas at a city by adding its name to the link, as in #Moscow.' },
    { text: 'With the map focused, + and − zoom, 0 fits the country, the arrows pan.', mouse: true },
  ];
  const units = h => h.replace(/(\d)\s(km|m)(?![A-Za-z])/g, '$1&nbsp;<span class="u">$2</span>');   // unit symbols keep their case inside tracked capitals (round 10)
  const coarse = () => window.matchMedia('(pointer: coarse)').matches;
  function nextTip() { for (let i = 0; i < TIPS.length; i++) { const t = TIPS[i]; if (stripState.seen.has(i)) continue; if (t.firms && !FIRMS_OK) continue; if (t.mouse && coarse()) continue; return [i, coarse() && t.touch ? t.touch : t.text]; } return null; }
  function scheduleTip() { if (stripState.tipTimer) clearTimeout(stripState.tipTimer); stripState.tipTimer = setTimeout(() => { stripState.tipTimer = 0; maybeTip(); }, 12000); }
  function maybeTip(force) {
    if (!stripOpen() || stripState.tip || (!force && (flight || press || pinch || !cursorStill || performance.now() - stripState.lastFactAt < 12000))) return false;
    const nt = nextTip(); if (!nt) return false;
    const [i, text] = nt; stripState.seen.add(i); try { sessionStorage.setItem('atlas-tips', JSON.stringify([...stripState.seen])); } catch (e) { /* no storage */ }
    stripState.tip = { i, text }; setStripText({ kind: 'tip', name: '', text: units(esc(text)), nums: [] }, null);
    stripState.tipEnd = setTimeout(() => endTip(true), 8000); return true;
  }
  function endTip(back) { if (stripState.tipEnd) { clearTimeout(stripState.tipEnd); stripState.tipEnd = 0; } stripState.tip = null; if (back && stripState.fact) { setStripText(stripState.fact, null); scheduleTip(); } }
  // The region glyph: one pre-simplified outline per region from the basemap's parts (the largest ring and any ring with at least a
  // quarter of its area, Douglas-Peucker to about 60 points, fitted into 22 by 22), built once on first use; Russia's outline traced
  // once from the filled parts on an offscreen canvas (the mainland's outer boundary).
  const glyphs = new Map();
  const decodeRing = r => { const p = []; let x = r[0], y = r[1]; p.push([x / 10, y / 10]); for (let i = 2; i < r.length; i += 2) { x += r[i]; y += r[i + 1]; p.push([x / 10, y / 10]); } return p; };
  const ringArea = p => { let a = 0; for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j][0] + p[i][0]) * (p[j][1] - p[i][1]); return Math.abs(a) / 2; };
  function simplify(p, tol) {   // Douglas-Peucker on an open or closed ring
    if (p.length <= 3) return p;
    const keep = new Uint8Array(p.length); keep[0] = keep[p.length - 1] = 1; const stack = [[0, p.length - 1]];
    while (stack.length) { const [a, b] = stack.pop(); let best = -1, bd = 0; const [ax, ay] = p[a], [bx, by] = p[b], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1e-12;
      for (let i = a + 1; i < b; i++) { const t = Math.max(0, Math.min(1, ((p[i][0] - ax) * dx + (p[i][1] - ay) * dy) / L2)), ex = ax + t * dx - p[i][0], ey = ay + t * dy - p[i][1], d = ex * ex + ey * ey; if (d > bd) { bd = d; best = i; } }
      if (best >= 0 && bd > tol * tol) { keep[best] = 1; stack.push([a, best], [best, b]); } }
    return p.filter((_, i) => keep[i]);
  }
  function fitPath(rings) {   // rings in km -> an SVG path in the 22 by 22 box with 1 px padding, y up in km, down on screen
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const r of rings) for (const [x, y] of r) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const sc = 20 / Math.max(x1 - x0, y1 - y0, 1e-9), xc = (x0 + x1) / 2, yc = (y0 + y1) / 2;
    return rings.map(r => 'M' + r.map(([x, y]) => `${(11 + sc * (x - xc)).toFixed(1)} ${(11 - sc * (y - yc)).toFixed(1)}`).join('L') + 'Z').join('');
  }
  function regionGlyph(name) {
    if (glyphs.has(name)) return glyphs.get(name);
    let d = '';
    if (name === 'Russia') d = russiaGlyph();
    else {
      const rings = []; for (const p of BM.lod0.parts) if (p.name === name) for (const r of p.rings) rings.push(decodeRing(r));
      if (rings.length) {
        const areas = rings.map(ringArea), amax = Math.max(...areas); let keep = rings.filter((_, i) => areas[i] >= 0.25 * amax);
        const span = (() => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const r of keep) for (const [x, y] of r) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return Math.max(x1 - x0, y1 - y0); })();
        let tol = span / 200, out = keep; for (let it = 0; it < 12; it++) { out = keep.map(r => simplify(r, tol)); if (out.reduce((n, r) => n + r.length, 0) <= 60) break; tol *= 1.5; }
        d = fitPath(out.filter(r => r.length >= 3));
      }
    }
    glyphs.set(name, d); return d;
  }
  function russiaGlyph() {   // the mainland's outer boundary: fill every part at 0.03 px per km, trace the contour (Moore neighbourhood), simplify
    const S = 0.03; let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;   // the bounds of every part
    for (const p of BM.lod0.parts) for (const r of p.rings) { let x = r[0] / 10, y = r[1] / 10; const upd = () => { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }; upd(); for (let i = 2; i < r.length; i += 2) { x += r[i] / 10; y += r[i + 1] / 10; upd(); } }
    const W = Math.ceil((x1 - x0) * S) + 4, H = Math.ceil((y1 - y0) * S) + 4, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d', { willReadFrequently: true });
    g.setTransform(S, 0, 0, -S, 2 - x0 * S, H - 2 + y0 * S); g.fillStyle = '#fff'; g.fill(MM.partsToPath(BM.lod0.parts), 'evenodd');
    const a = g.getImageData(0, 0, W, H).data, land = (x, y) => x >= 0 && y >= 0 && x < W && y < H && a[4 * (y * W + x) + 3] > 127;
    const cxp = Math.round(2 + (0 - x0) * S), cyp = Math.round(H - 2 - (0 - y0) * S); let sx = cxp, sy = cyp; while (sx > 0 && land(sx - 1, sy)) sx--;   // walk west from the plane's origin to the coast
    if (!land(sx, sy)) { for (let x = 0; x < W; x++) if (land(x, cyp)) { sx = x; break; } }
    const dirs = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]], path = []; let x = sx, y = sy, dir = 6, guard = 0;
    do { path.push([x, y]); let found = false; for (let k = 0; k < 8; k++) { const nd = (dir + 5 + k) % 8, nx = x + dirs[nd][0], ny = y + dirs[nd][1]; if (land(nx, ny)) { x = nx; y = ny; dir = nd; found = true; break; } } if (!found) break; } while ((x !== sx || y !== sy) && ++guard < 200000);
    const km = path.map(([px, py]) => [x0 + (px - 2) / S, y0 + (H - 2 - py) / S]);
    let tol = 20, out = km; for (let it = 0; it < 12; it++) { out = simplify(km, tol); if (out.length <= 80) break; tol *= 1.5; }
    return fitPath([out]);
  }
  function setGlyph(name) {
    if (!name || name === stripState.glyphName) return;
    const first = !stripState.glyphName; stripState.glyphName = name; const d = regionGlyph(name);
    const ina = stripState.glyphCur === 'A' ? $('ctxpathB') : $('ctxpathA'), out = stripState.glyphCur === 'A' ? $('ctxpathA') : $('ctxpathB'); stripState.glyphCur = stripState.glyphCur === 'A' ? 'B' : 'A';
    ina.setAttribute('d', d); out.classList.add('out'); out.classList.remove('live');
    if (first || reduceMotion()) { ina.classList.add('nt'); ina.style.strokeDashoffset = '0'; ina.classList.remove('out'); void ina.getBoundingClientRect(); ina.classList.remove('nt'); return; }
    ina.classList.add('nt'); ina.style.strokeDashoffset = '100'; ina.classList.remove('out'); void ina.getBoundingClientRect(); ina.classList.remove('nt'); ina.classList.add('live'); ina.style.strokeDashoffset = '0';
    setTimeout(() => { if (stripState.glyphName === name) ina.classList.remove('live'); }, 450);
  }
  stripState.glyphCur = 'A'; applyStrip();
  const lastLegend = { title: null, html: null, note: null };
  // The industry legend's counts for the current view (round 9): the cells of the active grid whose squares meet the camera's km
  // rectangle, or the addresses in the visible x band and y range; recomputed only when the view, year, layer or mode changed.
  // The revenue mix of the view (round 9, the author's correction): the eight largest divisions by their share of the summed
  // revenue of the cells or coordinate pairs in view, from each unit's own rows (its eight largest divisions; the rest joins
  // "other divisions"), weighted by the unit's revenue code. Computed once per camera settle, year, layer or view change.
  const POW = new Float64Array(2048); for (let i = 1; i < 2048; i++) POW[i] = Math.pow(10, (i - 1) / 100);   // rv codes to revenue; 0 stays 0
  const viewMix = { key: '', rows: null, other: 0, unit: '' };
  function computeViewMix() {
    if (state.layer !== 'industry' || !IND_T) { viewMix.key = ''; viewMix.rows = null; return; }
    const c = cam(), key = [state.mode, state.year, c.cx.toFixed(3), c.cy.toFixed(3), c.k.toFixed(5), stage.width, stage.height, indCityLoaded].join('|');
    if (viewMix.key === key) return;
    const acc = new Float64Array(100), hw = stage.width / 2 / c.k, hh = stage.height / 2 / c.k, x0 = c.cx - hw, x1 = c.cx + hw, y0 = c.cy - hh, y1 = c.cy + hh; let other = 0, total = 0;
    if (state.mode === 'firms') {
      const d = firmYears.get(state.year); if (!d || !d.mixInd) { viewMix.rows = null; viewMix.key = ''; return; }   // no cache without the year's data
      const i0 = lowerBound(d.x, x0 * 1000), i1 = lowerBound(d.x, x1 * 1000);
      for (let i = i0; i < i1; i++) { const yv = d.y[i] / 1000; if (yv < y0 || yv > y1) continue; const w = POW[d.rv[i]]; if (!w) continue; total += w; let sum = 0; for (let k = 0; k < d.mk; k++) { const code = d.mixInd[k][i]; if (code === 255) break; const sh = d.mixSh[k][i]; sum += sh; acc[code] += w * sh; } other += w * Math.max(0, 100 - sum); }
      viewMix.unit = 'coordinate pairs in view';
    } else {
      const y = state.year, near = nearestCity(c).city.label, fine = c.k >= 1.5 && indCity[near] && indCity[near][y], grid25 = alpha25(c.k) >= 0.5 && ind25[y];
      const d = fine ? indCity[near][y] : grid25 ? ind25[y] : ind100[y]; if (!d || !d.rv) { viewMix.rows = null; viewMix.key = ''; return; }
      const g = fine ? 1 : grid25 ? G25 : 100, o = fine ? d.origin : [0, 0], k = d.k || 1;
      for (let i = 0; i < d.count; i++) { const cx0 = o[0] + d.ix[i] * g, cy0 = o[1] + d.iy[i] * g; if (cx0 + g < x0 || cx0 > x1 || cy0 + g < y0 || cy0 > y1) continue; const w = POW[d.rv[i]]; if (!w) continue; total += w; let sum = 0; for (let j = 0; j < k; j++) { const code = d.top ? d.top[i * k + j] : d.dom[i]; if (code === 255) break; const sh = d.top ? d.tsh[i * k + j] : d.dsh[i]; sum += sh; acc[code] += w * sh; } other += w * Math.max(0, 100 - sum); }
      viewMix.unit = `${fine ? '1 km' : grid25 ? '25 km' : '100 km'} cells in view`;
    }
    const rows = []; for (let code = 0; code < 100; code++) if (acc[code] > 0) rows.push({ code, v: acc[code] }); rows.sort((p, q) => q.v - p.v || p.code - q.code);
    let rest = other; for (const r of rows.slice(8)) rest += r.v; const T = total || 1;
    viewMix.rows = rows.slice(0, 8).map(r => ({ code: r.code, share: Math.round(r.v / T) })); viewMix.other = Math.round(rest / T); viewMix.key = key;
  }

  function drawLegend() {
    const L = state.layer, c = cam(); const sw = col => `<span class="sw" style="background:${col}"></span>`, bar = col => `<span class="sw bars" style="--c:${col}"></span>`;   // ramp swatches as bars (round 10)
    let title = '', html = '', note = '';
    if (state.mode === 'firms') {
      const y = state.year, by = FM.by_year[y], ys = y + (y === 2025 ? '*' : '');
      const dot = (bg, border) => `<span class="sw dot" style="background:${bg}${border ? ';border:2px solid ' + border : ''}"></span>`;
      if (L === 'share') { title = `<b>Firms at registered addresses, ${ys}</b>`; html = `<div class="row p">Colour: share of the firms at the coordinate pair with a ${ys} statement</div>` + theme.ramp6.map((col, i) => `<div class="row">${bar(col)}${breakLabels(YEAR_BREAKS, 6)[i]}</div>`).join('') + '<div class="row p">A single firm shows the first colour (no statement) or the last (statement available).</div>'; }
      else if (L === 'fin') { title = `<b>Firms on no list (comparison group), ${ys}</b>`; html = `<div class="row p">Colour: real revenue change since the firm’s own 2019–2021 average, minus the year’s median change</div>` + theme.blue6.map((col, i) => `<div class="row">${bar(col)}${CLASS_LABELS[i]}</div>`).join('') + `<div class="row">${sw(theme.neutral)}no firm at the coordinate pair has a usable baseline</div>`; }
      else if (L === 'industry' && IND_T) { title = `<b>Firms at registered addresses, ${ys}</b>`; html = `<div class="row p">Colour: the division with the largest share of revenue at the coordinate pair, in nine classes</div>` + IND_T.classes.label.map((lab, i) => `<div class="row">${sw(theme.ind9[i])}${lab}</div>`).join('') + `<div class="row">${sw(theme.neutral)}no firm at the coordinate pair has a revenue value</div>`; }
      else { title = `<b>Firms at registered addresses, ${ys}</b>`; html = `<div class="row">${sw(theme.neutral)}every coordinate pair (this layer is a cell layer)</div>`; }
      html += `<div class="row">${dot(theme.neutral, 'rgba(227,26,28,0.8)')}On one of the five lists (treated), before its listing year</div><div class="row">${dot(theme.treated)}Listed (treated), red from its listing year, statement available</div><div class="row">${dot(theme.land, theme.treated)}Listed (treated), no statement that year</div><div class="row p">${c.k >= 20 ? 'Each dot is one coordinate pair. Larger dots hold more firms.' : 'Each dot is one coordinate pair. Dots widen at 10 and 100 or more firms.'}</div>`;
      note = firmStatus || `${fmt.int(by.firms)} firms on no list (comparison group) at ${fmt.int(by.addresses)} distinct coordinate pairs; ${fmt.int(by.listed)} firms on these lists (treated). ${fmt.int(by.city_level)} firms with other geocodes are not drawn.` + (TRN.name ? ' Hover a listed firm for its name.' : '');
    } else if (L === 'density') {
      title = '<b>Firms per cell</b> <span class="u">(' + (c.k < 1.5 ? '5 km' : c.k < 24 ? '1 km' : '250 m') + ')</span>';
      html = MM.countClassLabels.map((lab, i) => `<div class="row">${bar(hexAlpha(theme.density, MM.countAlpha[i]))}${lab}</div>`).join('');
      note = `${fmt.int(F.located_2021)} located eligible firms at ${fmt.int(F.distinct_locations)} distinct coordinate pairs in 2021 (${fmt.int(F.eligible_firms_2021)} eligible); the most shared coordinate pair holds ${fmt.int(F.largest_location_firms)} firms.`;
    } else if (L === 'share') {
      const near = nearestCity(c).city.label, hasWin = state.year === 2021 ? !!win1[near] : !!(cityYear[near] && cityYear[near][state.year]);
      const fine = c.k >= 1.5 && hasWin, grid25 = alpha25(c.k) >= 0.5 && !!c25[state.year];
      const breaks = fine ? FINE_BREAKS : YEAR_BREAKS, ramp = fine ? theme.ramp5 : theme.ramp6;
      const labels = ramp.map((_, i) => i === 0 ? `< ${breaks[0]}%` : i === ramp.length - 1 ? `≥ ${breaks[i - 1]}%` : `${breaks[i - 1]}–${breaks[i]}%`);
      title = `<b>Share with a statement, ${state.year}</b> <span class="u">(${fine ? (c.k < 24 ? '1 km' : '250 m') : grid25 ? '25 km' : '100 km'} cells)</span>`;
      html = ramp.map((col, i) => `<div class="row">${bar(col)}${labels[i]}</div>`).join('') + `<div class="row">${sw(theme.below)}fewer than 50 firms, share not shown</div>`;
      const t = totals[state.year]; note = t ? `${state.year}${state.year === 2025 ? '*' : ''}: ${fmt.pct(t.share)} of ${fmt.int(t.eligible)} eligible firms have a statement; ${fmt.pct(t.located_share)} located. Provider: ${state.year <= 2018 ? 'Rosstat' : 'FNS'}.` : '';
      if (fine && state.year !== 2021 && c.k >= 24) note += ' 250 m cells exist for 2021 only.';
    } else if (L === 'change') {
      const labels = ['≤ −5 points', '−5 to −2', '−2 to 0', '0 to +2', '+2 to +5', '> +5 points'];
      const grid25 = chg25 && alpha25(c.k) >= 0.5, counts = grid25 ? C25.change.class_cells : C100.change_classes.cells;
      title = `<b>Change in the share, 2024 against 2021</b> <span class="u">(${grid25 ? '25' : '100'} km cells)</span>`;
      html = [5, 4, 3, 2, 1, 0].map(i => `<div class="row">${bar(theme.change6[i])}${labels[i]} (${fmt.int(counts[i])} cells)</div>`).join('') + `<div class="row">${sw(theme.below)}fewer than 50 firms in a year</div>`;
      note = `${fmt.int(grid25 ? C25.change.supported : 658)} supported cells; located share ${fmt.pct(C100.change_totals.availability_share_percent[0])} → ${fmt.pct(C100.change_totals.availability_share_percent[1])}. Annual populations at registered addresses, not the same firms.`;
    } else if (L === 'cohort') {
      title = '<b>Revenue cohort by cash share: inclusion per cell</b>';
      html = theme.ramp5.map((col, i) => `<div class="row">${bar(col)}${C100.cohort_class_labels[i]}</div>`).join('') + `<div class="row">${sw(theme.below)}fewer than 50 eligible firms</div>`;
      note = `${fmt.int(F.cohorts.revenue_cash)} cohort firms; located cohort firms over located eligible firms per 2021 cell; pooled quintile classes.` + (c.k >= 1.5 ? ' 100 km cells are this layer’s finest resolution.' : '');
    } else if (L === 'industry' && IND_T) {
      const y = state.year, near = nearestCity(c).city.label, fine = c.k >= 1.5 && !!(indCity[near] && indCity[near][y]), grid25 = alpha25(c.k) >= 0.5 && !!ind25[y];
      title = `<b>Leading industry by revenue, ${y}${y === 2025 ? '*' : ''}</b> <span class="u">(${fine ? '1 km' : grid25 ? '25 km' : '100 km'} cells)</span>`;
      html = IND_T.classes.label.map((lab, i) => `<div class="row">${sw(theme.ind9[i])}${lab}</div>`).join('') + `<div class="row">${sw(theme.below)}no firm with a revenue value</div>`;
      note = `${y}${y === 2025 ? '*' : ''}: the division with the largest share of nominal revenue among located eligible firms with a statement and a positive revenue value. Division names from NACE Rev. 2 (Eurostat); OKVED 2 uses the same two-digit codes.` + (fine ? '' : c.k >= 1.5 ? ' No 1 km cells for this year or city.' : '');
    } else if (L === 'lists') {
      // Three classes, the ones listClass draws (ramp5[2], [3], [4]), each with its cell count; 1 to 4 members show no count.
      const grid25 = c25[2021] && alpha25(c.k) >= 0.5, counts = grid25 ? list25Counts : listClassCounts;
      title = `<b>Sanctions-list members (treated), 2021</b> <span class="u">(${grid25 ? '25' : '100'} km cells)</span>`;   // the grid size as a unit phrase (round 10)
      html = ['5–19', '20–49', '≥ 50'].map((lab, i) => `<div class="row">${bar(theme.ramp5[i + 2])}${lab} located members (${fmt.int(counts[i + 1])} cells)</div>`).join('');
      note = 'Memberships are fixed. Cells with 1 to 4 members show no count. The hover gives the government strategic list (treated) separately.';
    } else if (L === 'fin') {
      const labels = ['≤ −20%', '−20 to −10%', '−10 to 0%', '0 to +10%', '+10 to +20%', '> +20%'];
      title = '<b>Median real revenue, 2024 against 2021 (descriptive)</b>';
      html = [5, 4, 3, 2, 1, 0].map(i => `<div class="row">${bar(theme.change6[i])}${labels[i]}</div>`).join('');
      note = 'Revenue cohort by cash share; cells with 50 or more observed firms; composition changes with observation.' + (c.k >= 1.5 ? ' 100 km cells are this layer’s finest resolution.' : '');
    }
    if (title !== lastLegend.title) { $('legendtitle').innerHTML = title; lastLegend.title = title; }
    let rewrote = false;
    if (html !== lastLegend.html) { $('legendbody').innerHTML = html; lastLegend.html = html; dropObstacles(); rewrote = true; }
    if (note !== lastLegend.note) { $('notebody').textContent = note; $('mapnote').hidden = !note; lastLegend.note = note; dropObstacles(); rewrote = true; }   // the note's box changes with its text (round 9)
    if (rewrote && state.hover && !hoverQueued) { hoverQueued = true; queueMicrotask(() => { hoverQueued = false; refreshHover(); }); }   // a showing tile is re-placed against the panels' new boxes (round 9)
    applyPanels();
  }
  function hexAlpha(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }

  // ---- hover ------------------------------------------------------------------------------------
  function kmAt(ev) { const r = wrap.getBoundingClientRect(); const c = cam(); const x = ev.clientX - r.left, y = ev.clientY - r.top; return { x: c.cx + (x - c.ox) / c.k, y: c.cy - (y - c.oy) / c.k, px: x, py: y }; }
  function regionAt(px, py) { const c = cam(); mctx.save(); Motion.camTransform(mctx, stage, c); let name = null; const dx = px * stage.scale, dy = py * stage.scale; for (const p of partPaths) { if (mctx.isPointInPath(p.path, dx, dy, 'evenodd')) { name = p.name; break; } } mctx.restore(); stage.base(); return name; }
  function cellAt(km) {
    const c = cam(); const L = state.layer; const ix = Math.floor(km.x / 100), iy = Math.floor(km.y / 100), key = cellKey(ix, iy);
    const out = { ix, iy, grid: 100, region: regionAt(km.px, km.py), kmx: km.x, kmy: km.y };
    if (L === 'industry' && c.k >= 1.5) {   // the 1 km city window of the year, when the cursor is inside it
      const near = nearestCity(c).city.label, w = indCity[near] && indCity[near][state.year]; out.city = near;
      if (w && km.x >= w.origin[0] && km.x < w.origin[0] + 90 && km.y >= w.origin[1] && km.y < w.origin[1] + 90) {
        const jx = Math.floor(km.x - w.origin[0]), jy = Math.floor(km.y - w.origin[1]), i = w.map.get(cellKey(jx, jy));
        out.grid = 1; out.fine = true; out.origin = w.origin; out.yearShown = state.year;
        if (i != null) Object.assign(out, indHit(w, i)); else { out.dom = null; out.nrev = null; }
        return out;
      }
    }
    if (L === 'density' || (L === 'share' && c.k >= 1.5)) {
      const near = nearestCity(c).city.label; let layer = null, g = 5, origin = [0, 0], yearShown = 2021; out.city = near;
      const inWin = (d, size) => km.x >= d.origin[0] && km.x < d.origin[0] + size && km.y >= d.origin[1] && km.y < d.origin[1] + size;
      const w1 = L === 'density' || state.year === 2021 ? win1[near] : (cityYear[near] && cityYear[near][state.year]);
      if (c.k >= 24 && win025[near] && (L === 'density' || state.year === 2021) && inWin(win025[near].d, 24)) { layer = win025[near].d; g = 0.25; origin = layer.origin; }
      else if (c.k >= 1.5 && w1 && inWin(w1.d, 90)) { layer = w1.d; g = 1; origin = layer.origin; if (!(L === 'density' || state.year === 2021)) yearShown = state.year; }
      else if (L === 'density') { layer = nat; g = 5; }
      if (layer) {   // no window here: the national grids below answer instead
        const jx = Math.floor((km.x - origin[0]) / g), jy = Math.floor((km.y - origin[1]) / g);
        out.grid = g; out.fine = true; out.origin = origin; out.yearShown = yearShown;
        for (let i = 0; i < layer.count; i++) if (layer.ix[i] === jx && layer.iy[i] === jy) { out.n = layer.n[i]; out.a = layer.a[i] >= 0 ? layer.a[i] : null; return out; }
        out.n = null; out.a = null; return out;
      }
    }
    if (alpha25(c.k) >= 0.5 && (L === 'share' || L === 'change' || L === 'lists' || (L === 'industry' && ind25[state.year]))) {   // the 25 km cells (M10, and M11 for the industry layer)
      const jx = Math.floor(km.x / G25), jy = Math.floor(km.y / G25), k25 = cellKey(jx, jy);
      out.grid = G25; out.ix = jx; out.iy = jy;
      if (L === 'share') { const d = c25[state.year]; if (d) { const i = d.map.get(k25); if (i != null) Object.assign(out, { n: d.n[i], a: d.a[i], ns: d.ns[i] > 0 ? d.ns[i] : null }); } }
      else if (L === 'change') { if (chg25) { const i = chg25.map.get(k25); if (i != null) Object.assign(out, { n21: chg25.n21[i], a21: chg25.a21[i], n24: chg25.n24[i], a24: chg25.a24[i], change: chg25.pp[i] / 1000, supported: chg25.cls[i] > 0 }); } }
      else if (L === 'industry') { const d = ind25[state.year]; const i = d.map.get(k25); if (i != null) Object.assign(out, indHit(d, i)); }
      else { const d = c25[2021]; if (d) { const i = d.map.get(k25); if (i != null) Object.assign(out, { n: d.n[i], sanctioned: d.ns[i] >= 5 ? d.ns[i] : null, gov: d.ng && d.ng[i] >= 5 ? d.ng[i] : null }); } }
      return out;
    }
    if (L === 'share') { const d = yearCells[state.year].get(key); if (d) Object.assign(out, { n: d.n, a: d.a, nr: d.nr, ar: d.ar, ns: d.ns }); }
    else if (L === 'change') { const i = chgMap.get(key); if (i != null) Object.assign(out, { n21: chg.n21[i], a21: chg.a21[i], n24: chg.n24[i], a24: chg.a24[i], change: chg.change_pp[i], supported: chg.supported[i] }); }
    else if (L === 'cohort') { const i = cohMap.get(key); if (i != null) Object.assign(out, { n: coh.n[i], c: coh.c[i], pct: coh.pct[i], supported: coh.supported[i] }); }
    else if (L === 'lists') { const i = listMap.get(key); if (i != null) Object.assign(out, { n: lists.n[i], sanctioned: lists.sanctioned[i], gov: lists.govstrategic[i] }); }
    else if (L === 'fin') { const i = finMap.get(key); if (i != null) Object.assign(out, { n_base: fin.n_base[i], n_obs: fin.n_obs[i], change: fin.change_pct[i] }); }
    else if (L === 'industry') { const d = ind100[state.year]; if (d) { const i = d.map.get(key); if (i != null) Object.assign(out, indHit(d, i)); } }
    return out;
  }
  const band = n => (n < 10 ? 'fewer than 10' : fmt.int(n));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // One listed firm as a tooltip line: its mark's glyph (solid red with a statement, hollow red without one, a dotted ring before
  // its listing year), its display name from the list file (a shared name marked), and its listing year.
  // The listed glyphs of the tooltip and the panel are the legend's own three dots at 11 px (author's fix, 25 October 2026):
  // red with a statement, the land-filled ring without one that year, the neutral fill with a red rim before the listing year.
  const GLYPH = { red: () => `<span class="gl" style="background:${theme.treated}"></span>`,
                  hollow: () => `<span class="gl" style="background:${theme.land};border:2px solid ${theme.treated}"></span>`,
                  rim: () => `<span class="gl" style="background:${theme.neutral};border:2px solid rgba(227,26,28,0.8)"></span>` };
  function listedGlyph(i, year) { const yi = year - 2014; return TRN.red_from[i] > year ? GLYPH.rim() : TRN.filed[i][yi] === '1' ? GLYPH.red() : GLYPH.hollow(); }
  const listedYear = i => (TRN.undated[i] ? 'undated' : String(TRN.red_from[i]));
  const listedState = (i, year) => `${TRN.filed[i][year - 2014] === '1' ? '' : 'no '}${year} statement`;
  const LIST_WORDS = { s: 'sanctions', d: 'decree', r: 'resident', g: 'government strategic', p: 'presidential strategic' };
  const listedLists = i => (TRN.lists ? Array.from(TRN.lists[i] || '', c => LIST_WORDS[c]).filter(Boolean).join(', ') : '');
  const listedName = i => (TRN.name && TRN.name[i] ? esc(TRN.name[i]) : '<i>unnamed</i>');
  // The tooltip's short line (the glance view): the glyph, the display name and the listing year.
  const num = v => `<span class="num">${v}</span>`;   // the tile's figures in the monospace stack (round 9)
  // The firm's share of the revenue of every firm at its coordinate pair, from its most recent statement with a value up to
  // the slider's year; the year is named when it is not the slider's (the author's correction, 25 October 2026).
  function listedShare(i) {
    if (!TRN.psh) return '';
    for (let y = state.year; y >= 2014; y--) { const v = TRN.psh[i * 12 + (y - 2014)]; if (v >= 0) { const t = v >= 100 ? `${Math.round(v / 10)}%` : v >= 1 ? `${(v / 10).toFixed(1)}%` : '<0.1%'; return ` (${num(t)} of ${y === state.year ? '' : num(y) + ' '}revenue here)`; } }
    return '';
  }
  function listedRevenue(i, year) {   // the most recent statement's revenue up to the year, in millions of nominal rubles (the detail view)
    if (!TRN.rev_m) return '';
    for (let y = year; y >= 2014; y--) { const v = TRN.rev_m[i * 12 + (y - 2014)]; if (v === v) return `revenue ${y}: ${fmt.int(Math.round(v))} mn rubles`; }
    return '';
  }
  function listedLine(i) { return `${listedGlyph(i, state.year)}${listedName(i)} · ${num(listedYear(i))}${listedShare(i)}`; }
  function tipText(h) {
    const L = state.layer; const lines = [];
    if (h.region) lines.push(`<b class="loc">${esc(h.region)}</b>`);   // the region line in tracked capitals (round 10)
    if (h.kind === 'firm' || h.kind === 'listed' || h.kind === 'none') {
      const ad = h.kind === 'firm' ? h : h.address;
      if (ad) {   // the glance view (author's rule, 25 October 2026): one figures line, one listed line, the named lines in their short form; the detail stays in the panel
        lines.push(ad.n === 1 ? `1 firm, ${ad.a ? '' : 'no '}${num(state.year)} statement` : `${num(fmt.int(ad.n))} firms, ${num(fmt.int(ad.a))} with a ${num(state.year)} statement, ${num(fmt.pct(100 * ad.a / ad.n))}`);
        if (state.layer === 'fin') lines.push(ad.f ? `${fmt.int(ad.f)} with a baseline and a value, median change ${CLASS_LABELS[ad.cls - 1]}` : 'No firm with a usable baseline and a value');
        if (state.layer === 'industry' && ad.ind != null) lines.push(ad.ind === 255 ? 'No firm with a revenue value at this coordinate pair' : narrow() ? `${esc(divShort(ad.ind))} (${divPad(ad.ind)}), ${ad.ish}% of revenue here` : `${divLabel(ad.ind)}, ${ad.ish}% of revenue at this coordinate pair`);
      }
      if (h.listed) {
        const Ls = h.listed, parts = [];
        if (Ls.n === 1) parts.push(Ls.ring ? 'hollow' : Ls.red ? 'red' : 'before listing');
        else { if (Ls.red) parts.push(`${fmt.int(Ls.red)} red`); if (Ls.ring) parts.push(`${fmt.int(Ls.ring)} hollow`); if (Ls.rim) parts.push(`${fmt.int(Ls.rim)} before listing`); }
        lines.push(`${num(fmt.int(Ls.n))} on the lists: ${parts.join(', ')}`);
        if (TRN.name && Ls.top && Ls.top.length) {   // red first, then before their listing year; up to three
          const shown = narrow() ? Ls.top.slice(0, 1) : Ls.top;   // a phone-width map shows one name, then the rest as a count (the panel below lists three)
          for (const i of shown) lines.push(listedLine(i));
          if (Ls.n > shown.length) lines.push(`and ${num(fmt.int(Ls.n - shown.length))} more`);
        }
      }
      return lines.join('<br>');
    }
    if (L === 'industry') {   // the leading division and the ranked mix of the cell (round 9)
      const cell = h.fine ? '1 km cell' : `${h.grid} km cell`;
      if (h.dom == null || h.dom === 255) lines.push(`No firm with a revenue value in this ${cell}`);
      else {
        lines.push(`${cell}, ${state.year}: ${fmt.int(h.nrev)} firms with a revenue value`);
        lines.push(narrow() ? `Largest share: ${esc(divShort(h.dom))} (${divPad(h.dom)}), ${h.share}%` : `Largest share of revenue: ${divLabel(h.dom)}, ${h.share}%`);
        if (h.lsh) lines.push(`Firms on these lists (treated) hold ${h.lsh}% of this cell’s revenue`);
      }
      return lines.join('<br>');
    }
    if (h.fine && h.n == null) { lines.push(`No located firms in this ${h.grid < 1 ? '250 m' : h.grid + ' km'} cell`); return lines.join('<br>'); }
    if (h.fine) { lines.push(`${h.grid < 1 ? '250 m' : h.grid + ' km'} cell: ${band(h.n)} located firms` + (h.a != null ? `, ${fmt.int(h.a)} with a ${h.yearShown || 2021} statement (${fmt.pct(100 * h.a / h.n)})` : h.n >= 50 ? '' : '; share not shown under 50 firms')); return lines.join('<br>'); }
    if (L === 'share') { if (h.n == null) lines.push('No located firms in this 100 km cell'); else { lines.push(`${state.year}: ${fmt.int(h.n)} located eligible firms, ${fmt.int(h.a)} with a statement` + (h.n >= 50 ? ` (<b>${fmt.pct(100 * h.a / h.n)}</b>)` : ' (share not shown under 50 firms)')); if (h.nr) lines.push(`Registered at year-end: ${fmt.int(h.nr)}, ${fmt.int(h.ar)} with a statement (${fmt.pct(100 * h.ar / h.nr)})`); if (h.ns != null && h.ns > 0) lines.push(`Sanctions-list members (treated): ${fmt.int(h.ns)}`); } }
    else if (L === 'change') { if (h.n21 == null) lines.push('No located firms'); else lines.push(`2021: ${fmt.int(h.a21)} of ${fmt.int(h.n21)} (${fmt.pct(100 * h.a21 / h.n21)})<br>2024: ${fmt.int(h.a24)} of ${fmt.int(h.n24)} (${fmt.pct(100 * h.a24 / h.n24)})<br>` + (h.supported ? `Change <b>${fmt.signed(h.change)} points</b>` : 'Fewer than 50 firms in a year: not classed')); }
    else if (L === 'cohort') { if (h.n == null) lines.push('No located firms'); else lines.push(`${fmt.int(h.c)} of ${fmt.int(h.n)} located eligible firms in the revenue cohort by cash share` + (h.supported ? ` (<b>${fmt.pct(h.pct)}</b>)` : ' (fewer than 50 eligible: not classed)')); }
    else if (L === 'lists') { if (h.n == null) lines.push('No list members shown'); else lines.push(`${fmt.int(h.n)} located eligible firms<br>Sanctions list (treated): ${h.sanctioned == null ? 'under 5 or none' : fmt.int(h.sanctioned)}<br>Government strategic list (treated): ${h.gov == null ? 'under 5 or none' : fmt.int(h.gov)}`); }
    else if (L === 'fin') { if (h.n_base == null) lines.push('No supported cohort cell'); else lines.push(`${fmt.int(h.n_obs)} of ${fmt.int(h.n_base)} cohort firms observed in 2024<br>Median real revenue <b>${fmt.signed(h.change)}%</b> against the cell’s 2021 median`); }
    else lines.push(`100 km cell ${h.ix}, ${h.iy}`);
    return lines.join('<br>');
  }
  function drawOverlay(h) {
    octx.setTransform(stage.scale, 0, 0, stage.scale, 0, 0); octx.clearRect(0, 0, stage.width, stage.height);
    if (cross.on) {   // the crosshair at the (eased) cursor, 2 px, in the cursor colour: the full neon when still, the live variant while moving
      const cx = Math.round(cross.x) + 0.5, cy = Math.round(cross.y) + 0.5;
      octx.strokeStyle = cursorStill ? theme.cursor : theme.cursorLive; octx.lineWidth = 2; octx.globalAlpha = 0.9;
      octx.beginPath(); octx.moveTo(cx, 0); octx.lineTo(cx, stage.height); octx.moveTo(0, cy); octx.lineTo(stage.width, cy); octx.stroke(); octx.globalAlpha = 1;
    }
    if (!h) return; const c = cam();
    // The hover ring and the cell square in the cursor colour, cased in the stage colour so they read on lilac and pale cells too (round 9).
    const cased = draw => { octx.strokeStyle = theme.stage; octx.globalAlpha = 0.6; octx.lineWidth = 4.5; draw(); octx.globalAlpha = 1; octx.strokeStyle = cursorStill ? theme.cursor : theme.cursorLive; octx.lineWidth = 2.5; draw(); };
    if (h.kind === 'firm' || h.kind === 'listed') { cased(() => { octx.beginPath(); octx.arc(h.px, h.py, h.r + 3, 0, Math.PI * 2); octx.stroke(); }); return; }
    if (h.kind === 'none') return;
    const g = h.grid, o = h.origin || [0, 0];
    const x0 = o[0] + Math.floor((h.kmx - o[0]) / g) * g, y0 = o[1] + Math.floor((h.kmy - o[1]) / g) * g;
    const [px, py] = Motion.project(c, x0, y0 + g); const s = g * c.k;
    cased(() => octx.strokeRect(px, py, s, s));
  }
  // ---- camera flights (24 October 2026) ---------------------------------------------------------------
  // One animation for cell clicks, presets, the zoom buttons and the keys: the explainer's Motion.camera path
  // (cubic position, log-k zoom) run on requestAnimationFrame. The audit API jumps, so it stays deterministic;
  // a viewer who prefers reduced motion jumps too.
  const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let flight = null;
  function cancelFlight() { if (!flight) return; const f = flight; flight = null; cancelAnimationFrame(f.raf); f.resolve({ done: false, frames: f.frames, ms: performance.now() - f.t0 }); }
  // The flight's path: Motion.camera's directed interpolation over one segment, or two for a long pan (the centre moving
  // more than two viewport diagonals at the smaller k), which pulls out and back in through a middle keyframe.
  function flightPath(from, to, ms) {
    const W = stage.width, H = stage.height, dist = Math.hypot(to.cx - from.cx, to.cy - from.cy), dpx = dist * Math.min(from.k, to.k);
    const kf = [Object.assign({ t: 0 }, from), Object.assign({ t: ms }, to)];
    if (dpx > 2 * Math.hypot(W, H)) kf.splice(1, 0, { t: ms / 2, cx: (from.cx + to.cx) / 2, cy: (from.cy + to.cy) / 2, k: Math.max(kFit(), Math.min(from.k, to.k, 0.8 * minSide() / dist)) });
    return Motion.camera(kf, W, H);
  }
  function flyTo(target, { instant = false, duration = null } = {}) {
    cancelFlight(); if (!target.pull) pullFrom = null;   // a flight to a place, and the floor's settle, forget the zoom-out anchor
    const from = { cx: state.cam.cx, cy: state.cam.cy, k: state.cam.k }, to = { cx: target.cx, cy: target.cy, k: clampK(target.k) };
    const dk = Math.abs(Math.log2(to.k / from.k)), dpx = Math.hypot(to.cx - from.cx, to.cy - from.cy) * Math.min(from.k, to.k);
    if (instant || reduceMotion() || (dk < 0.01 && dpx < 0.5)) { hideHover(); state.cam = to; drawMap(); afterCameraMove(); return Promise.resolve({ done: true, frames: 0, ms: 0 }); }
    const ms = duration || Motion.clamp(600 + 250 * dk, 400, 1400);
    const path = flightPath(from, to, ms);
    hideHover();
    return new Promise(resolve => {
      const f = flight = { raf: 0, t0: performance.now(), frames: 0, resolve };
      const step = now => {
        if (flight !== f) return;
        const t = now - f.t0;
        if (t >= ms) { flight = null; state.cam = to; drawMap(); afterCameraMove(); resolve({ done: true, frames: f.frames + 1, ms: t }); return; }
        const p = path(t); state.cam = { cx: p.cx, cy: p.cy, k: p.k }; f.frames++; drawMap({ flight: true });
        f.raf = requestAnimationFrame(step);
      };
      f.raf = requestAnimationFrame(step);
    });
  }
  // Drag and wheel redraws are coalesced into one frame; drawMap itself stays synchronous.
  let drawQueued = false, drawAfter = null;
  function requestDraw(after) { if (after) drawAfter = after; if (drawQueued) return; drawQueued = true; requestAnimationFrame(() => { drawQueued = false; drawMap(); const fn = drawAfter; drawAfter = null; if (fn) fn(); }); }
  function afterCameraMove() { syncZoomButtons(); refreshHover(); updateContext(); if (!state.hover) fillMixBox(null); }

  // The click ladder (24 October 2026, revised the same evening): a click goes to what was clicked. The subject is the
  // city whose window holds the point (from the country, the city in the clicked 100 km cell), else the clicked cell's
  // centre. The rung is the zoom for the grid hit: the city window, a 100 km cell at 500 km across, a 25 km cell at
  // 100 km, a 5 km cell at 100 km as well, a 1 km cell at 20 km. When the rung is deeper than the view the camera flies in and
  // centres on the subject; when it is not, the view pans to the subject at its zoom, or, when the subject already sits
  // near the centre, zooms x2.5 on it. Shift+click steps out at the point. From the country an empty cell does nothing.
  function ladderTarget(h, km, shift) {
    if (shift) return { target: stepAt(km, 1 / 2.5), rung: 'out' };
    const k = state.cam.k, c = cam(), near = Math.hypot(km.px - c.ox, km.py - c.oy) < 0.15 * minSide();
    const zoomOn = (x, y) => ({ target: { cx: x, cy: y, k: clampK(k * 2.5) }, rung: 'zoom' });
    if (state.mode === 'firms') return zoomOn(km.x, km.y);
    const ix = Math.floor(h.kmx / 100), iy = Math.floor(h.kmy / 100), city = cityInCell(ix, iy);
    let t;
    if (k < 1.5) {
      const has = state.layer === 'density' ? yearCells[2021].has(cellKey(ix, iy)) : (h.n != null || h.n21 != null || h.n_base != null || h.sanctioned != null || h.gov != null || h.c != null || h.dom != null);
      if (!has) return null;
      t = city ? { target: cityTarget(city), rung: 'city' } : { target: cellTarget(ix, iy), rung: 'cell' };
    } else if (h.fine && h.grid < 5) {
      const g = h.grid, o = h.origin || [0, 0], cx = o[0] + Math.floor((h.kmx - o[0]) / g) * g + g / 2, cy = o[1] + Math.floor((h.kmy - o[1]) / g) * g + g / 2;
      t = g === 1 ? { target: fineTarget(cx, cy), rung: 'fine' } : zoomOn(cx, cy);
    } else {
      const g = h.grid || 100, cx = Math.floor(h.kmx / g) * g + g / 2, cy = Math.floor(h.kmy / g) * g + g / 2;
      if (city && Math.abs(city.x - h.kmx) <= 45 && Math.abs(city.y - h.kmy) <= 45) t = { target: cityTarget(city), rung: 'city' };
      else t = { target: { cx, cy, k: minSide() / (g < 100 ? 100 : 500) }, rung: 'cell' };   // a 25 km or 5 km cell at 100 km across, a 100 km cell at 500
    }
    if (t.target.k > k * 1.02) return t;
    if (!near) return { target: { cx: t.target.cx, cy: t.target.cy, k }, rung: 'pan' };
    return zoomOn(t.target.cx, t.target.cy);
  }
  const kmFromPx = (x, y) => { const c = cam(); return { x: c.cx + (x - c.ox) / c.k, y: c.cy - (y - c.oy) / c.k, px: x, py: y }; };
  function clickAt(x, y, shift) { const km = kmFromPx(x, y); const h = hitAt(km); h.kmx = km.x; h.kmy = km.y; const r = ladderTarget(h, km, shift); if (r) flyTo(r.target); return r; }

  // ---- pointer input: hover, drag, pinch, click and tap --------------------------------------------------
  const PRESS_PX = 5, PRESS_MS = 300, TAP_MS = 450, TAP_PX = 20;
  const WHEEL_RATE = 0.0015, PINCH_RATE = 0.018;   // zoom per pixel of wheel delta: a mouse wheel or two-finger scroll, and a trackpad pinch (author's tuning, 24 October 2026)
  const pointers = new Map(); let press = null, pinch = null, lastPointer = null, lastTap = null;
  const overControl = (ev, sel) => !!(ev.target && ev.target.closest && ev.target.closest(sel));
  function localXY(ev) { const r = wrap.getBoundingClientRect(); return { x: ev.clientX - r.left, y: ev.clientY - r.top }; }
  function hideHover() { $('tip').style.display = 'none'; state.hover = null; crossOff(); drawOverlay(null); wrap.classList.remove('clickable', 'zoomable'); fillMixBox(null); }
  function syncCursor(h) {
    const r = h && !press ? ladderTarget(h, kmFromPx(h.px0, h.py0), false) : null;
    wrap.classList.toggle('clickable', !!r && r.rung !== 'zoom'); wrap.classList.toggle('zoomable', !!r && r.rung === 'zoom');
  }
  // ---- the cursor tile, the crosshair and the still state (round 9, 25 October 2026) ------------------------------------
  // The tile is the glance view: the tooltip's lines, a class-mix bar on the industry layer and a footer with the cursor's
  // coordinate (the inverse of the basemap's projection) and the scale (metres per CSS pixel). It is placed clear of the hovered
  // mark and of every panel; the crosshair runs across the map at the cursor in the cursor colour, the live variant while the
  // cursor moves and the resting neon once it has been still for 200 ms, easing toward the cursor over 120 ms (a snap under
  // reduced motion).
  const LAEA = { lam0: BM.projection.longitude_origin * Math.PI / 180, phi0: BM.projection.latitude_origin * Math.PI / 180, R: BM.projection.earth_radius_km };
  function inverseLAEA(x, y) {
    const { lam0, phi0, R } = LAEA, rho = Math.hypot(x, y); if (rho < 1e-9) return [phi0 * 180 / Math.PI, lam0 * 180 / Math.PI];
    const c = 2 * Math.asin(Math.min(1, rho / (2 * R))), sc = Math.sin(c), cc = Math.cos(c);
    const phi = Math.asin(Math.max(-1, Math.min(1, cc * Math.sin(phi0) + y * sc * Math.cos(phi0) / rho)));
    let lam = lam0 + Math.atan2(x * sc, rho * Math.cos(phi0) * cc - y * Math.sin(phi0) * sc);
    lam = ((lam * 180 / Math.PI + 540) % 360) - 180; return [phi * 180 / Math.PI, lam];
  }
  const scaleParts = k => { const m = 1000 / k; return m >= 1000 ? [(m / 1000).toFixed(1), ' km'] : m >= 10 ? [String(Math.round(m)), ' m'] : [m.toFixed(1), ' m']; };
  const foot = { lat: 0, lon: 0, scale: 0, raf: 0 };
  function fillFoot(km, tick) {
    const [lat, lon] = inverseLAEA(km.x, km.y), [sv, su] = scaleParts(cam().k), target = { lat: Math.abs(lat), lon: Math.abs(lon), scale: +sv };
    $('tlatH').textContent = lat >= 0 ? 'N' : 'S'; $('tlonH').textContent = lon >= 0 ? 'E' : 'W'; $('tunit').textContent = su;
    const write = v => { $('tlat').textContent = v.lat.toFixed(2); $('tlon').textContent = v.lon.toFixed(2); $('tscale').textContent = su === ' km' || +sv % 1 ? v.scale.toFixed(1) : String(Math.round(v.scale)); };
    if (foot.raf) { cancelAnimationFrame(foot.raf); foot.raf = 0; }
    if (!tick || reduceMotion() || foot.scale === 0) { Object.assign(foot, target); write(foot); return; }
    const from = { lat: foot.lat, lon: foot.lon, scale: foot.scale }, t0 = performance.now();   // a camera moved under a still cursor: the figures count to the new values
    const step = () => { foot.raf = 0; const u = Math.min(1, (performance.now() - t0) / 200), e = Motion.ease.outCubic(u); const v = { lat: from.lat + (target.lat - from.lat) * e, lon: from.lon + (target.lon - from.lon) * e, scale: from.scale + (target.scale - from.scale) * e }; write(u >= 1 ? target : v); if (u < 1) foot.raf = requestAnimationFrame(step); else Object.assign(foot, target); };
    wrap.classList.add('cursor-live'); foot.raf = requestAnimationFrame(step); setTimeout(() => { if (cursorStill) wrap.classList.remove('cursor-live'); }, 220);
  }
  function tileObstacles() {
    if (obsCache) return obsCache;
    const m = wrap.getBoundingClientRect();
    return obsCache = ['legend', 'mapnote', 'mixbox', 'zoombox', 'scalebar', 'ctxstrip'].map(id => { const el = $(id); if (!el || el.hidden) return null; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 ? { id, x: r.left - m.left, y: r.top - m.top, x1: r.right - m.left, y1: r.bottom - m.top } : null; }).filter(Boolean);
  }
  const meets = (a, b, g = 2) => a.x < b.x1 + g && a.x1 > b.x - g && a.y < b.y1 + g && a.y1 > b.y - g;
  // Eight anchors around the cursor, each keeping d px of clearance on at least one axis so the tile never covers the hovered
  // mark; the first inside the map and clear of every panel wins; a second pass slides the anchors along their free axis.
  function placeTile(x, y, tw, th, obsAll, touch, r) {   // tiers: every panel; then without the note; then without the legend; then without both (the controls, the scale bar and the strip always stay clear)
    const tiers = [[], ['mapnote'], ['legend'], ['mapnote', 'legend']];
    for (const drop of tiers) { const obs = drop.length ? obsAll.filter(o => !drop.includes(o.id)) : obsAll; const b = placeTileAmong(x, y, tw, th, obs, touch, r); if (!b.fallback) { if (drop.length) b.relaxed = drop.map(id => id === 'mapnote' ? 'note' : id); return b; } }
    return placeTileAmong(x, y, tw, th, obsAll, touch, r);
  }
  function placeTileAmong(x, y, tw, th, obs, touch, r) {
    const d = touch ? 24 : Math.max(14, r + 9), W = stage.width, H = stage.height;
    const cands = [[x + d, y + d], [x - d - tw, y + d], [x + d, y - d - th], [x - d - tw, y - d - th], [x - tw / 2, y + d], [x - tw / 2, y - d - th], [x + d, y - th / 2], [x - d - tw, y - th / 2]];
    const order = touch ? [5, 2, 3, 4, 0, 1, 6, 7] : [0, 1, 2, 3, 4, 5, 6, 7];
    const inside = b => b.x >= 0 && b.y >= 0 && b.x1 <= W - 1 && b.y1 <= H - 4, clearOf = b => !obs.some(o => meets(b, o));
    for (const i of order) { const [bx, by] = cands[i], b = { x: bx, y: by, x1: bx + tw, y1: by + th, anchor: i }; if (inside(b) && clearOf(b)) return b; }
    for (const i of order) {   // the slide pass: push the anchor out of whatever it meets along its free axis, away from the obstacle first and then the other way
      const [bx, by] = cands[i], slideX = i === 4 || i === 5;
      for (const dir of [0, 1]) {
        const b = { x: bx, y: by, x1: bx + tw, y1: by + th, anchor: i, slid: true };
        for (let step = 0; step < 6; step++) { const hit = obs.find(o => meets(b, o)); if (!hit) break;
          if (slideX) { const away = (b.x + b.x1) / 2 < (hit.x + hit.x1) / 2, dx = (away !== !!dir) ? hit.x - 2 - b.x1 : hit.x1 + 2 - b.x; b.x += dx; b.x1 += dx; }
          else { const away = (b.y + b.y1) / 2 < (hit.y + hit.y1) / 2, dy = (away !== !!dir) ? hit.y - 2 - b.y1 : hit.y1 + 2 - b.y; b.y += dy; b.y1 += dy; } }
        if (inside(b) && clearOf(b)) return b;
      }
    }
    // The search pass (corners and narrow maps): the nearest position on a 16 px grid that is inside the map, clear of every
    // panel and keeps d px between its box and the cursor on both axes; at most a few thousand cheap tests, only when every
    // anchor failed.
    let best = null, bestD = Infinity;
    for (let by = 0; by <= H - th - 4; by += 16) for (let bx = 0; bx <= W - tw - 1; bx += 16) {
      const ddx = Math.max(bx - d - x, x - (bx + tw + d), 0), ddy = Math.max(by - d - y, y - (by + th + d), 0); if (ddx === 0 && ddy === 0) continue;
      const dist = Math.hypot(ddx, ddy); if (dist >= bestD) continue;
      const b = { x: bx, y: by, x1: bx + tw, y1: by + th }; if (!clearOf(b)) continue;
      bestD = dist; best = b;
    }
    if (best) return { x: best.x, y: best.y, x1: best.x1, y1: best.y1, anchor: -2, searched: true };
    const fx = Math.max(0, Math.min(x + d, W - tw - 1)), fy = Math.max(0, Math.min(y - 10, H - th - 4)); return { x: fx, y: fy, x1: fx + tw, y1: fy + th, anchor: -1, fallback: true };
  }
  let tileState = null, stillTimer = 0, cursorStill = true;
  const cross = { on: false, x: 0, y: 0, tx: 0, ty: 0, x0: 0, y0: 0, t0: 0, raf: 0 };
  function crossOff() { cross.on = false; if (cross.raf) { cancelAnimationFrame(cross.raf); cross.raf = 0; } if (stillTimer) { clearTimeout(stillTimer); stillTimer = 0; } cursorStill = true; wrap.classList.remove('cursor-live'); }
  function setCross(x, y, snap) {
    cross.tx = x; cross.ty = y;
    if (snap || !cross.on || reduceMotion()) { cross.on = true; cross.x = x; cross.y = y; if (cross.raf) { cancelAnimationFrame(cross.raf); cross.raf = 0; } return; }
    cross.x0 = cross.x; cross.y0 = cross.y; cross.t0 = performance.now(); if (!cross.raf) cross.raf = requestAnimationFrame(easeCross);
  }
  function easeCross() {
    cross.raf = 0; const u = Math.min(1, (performance.now() - cross.t0) / 120), e = Motion.ease.outCubic(u);
    cross.x = cross.x0 + (cross.tx - cross.x0) * e; cross.y = cross.y0 + (cross.ty - cross.y0) * e;
    drawOverlay(state.hover); if (u < 1) cross.raf = requestAnimationFrame(easeCross);
  }
  function armStill(touch) {
    if (stillTimer) clearTimeout(stillTimer);
    if (touch) { cursorStill = true; wrap.classList.remove('cursor-live'); return; }
    cursorStill = false; wrap.classList.add('cursor-live');
    stillTimer = setTimeout(() => { stillTimer = 0; cursorStill = true; wrap.classList.remove('cursor-live'); drawOverlay(state.hover); maybeTip(); }, 200);
  }
  function showHoverAt(x, y, opts = {}) {
    const km = kmFromPx(x, y); const h = hitAt(km); h.kmx = km.x; h.kmy = km.y; h.px0 = x; h.py0 = y; state.hover = h;
    const tip = $('tip'); $('tipbody').innerHTML = tipText(h); fillFoot(km, !!opts.tick); tip.style.display = 'block';
    const tw = tip.offsetWidth, th = tip.offsetHeight, obs = tileObstacles();   // one forced layout; the panels' boxes are read under it
    const mark = h.kind === 'firm' || h.kind === 'listed', b = placeTile(x, y, tw, th, obs, !!opts.touch, mark ? h.r : 0);
    tip.style.left = b.x + 'px'; tip.style.top = b.y + 'px';
    tileState = { box: b, cursor: [x, y], mark: mark ? [h.px, h.py] : null, anchor: b.anchor, fallback: !!b.fallback, slid: !!b.slid, searched: !!b.searched, relaxed: b.relaxed || null };
    setCross(x, y, !!opts.touch); drawOverlay(h); drawCellPanel(h); syncCursor(h); armStill(!!opts.touch); fillMixBox(h);
    return h;
  }
  let hoverQueued = false;
  function refreshHover() { if (press || pinch || flight || !lastPointer || !lastPointer.inside) return; showHoverAt(lastPointer.x, lastPointer.y, { tick: true, touch: cursorStill }); }
  function startPinch() { const [p, q] = [...pointers.values()]; return { d: Math.max(1, Math.hypot(p.x - q.x, p.y - q.y)), mid: { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 } }; }
  function movePinch() { const [p, q] = [...pointers.values()]; const d = Math.max(1, Math.hypot(p.x - q.x, p.y - q.y)), mid = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }, c = cam(); const km = { x: c.cx + (pinch.mid.x - c.ox) / c.k, y: c.cy - (pinch.mid.y - c.oy) / c.k, px: mid.x, py: mid.y }; const t = zoomStep(d / pinch.d, km); state.cam = { cx: t.cx, cy: t.cy, k: t.k }; pinch.d = d; pinch.mid = mid; requestDraw(); }   // the point under the previous midpoint stays under the new one (zoom and pan), through zoomStep for the pull
  wrap.addEventListener('pointerdown', ev => {
    if (overControl(ev, '.zoombox, .toggle') || (ev.pointerType === 'mouse' && ev.button !== 0)) return;
    cancelFlight(); try { wrap.setPointerCapture(ev.pointerId); } catch (e) { /* capture is optional */ }
    const p = localXY(ev); pointers.set(ev.pointerId, p);
    if (pointers.size === 1) press = { id: ev.pointerId, x: p.x, y: p.y, t: performance.now(), moved: false, shift: ev.shiftKey, type: ev.pointerType, last: p };
    else if (pointers.size === 2) { press = null; wrap.classList.remove('dragging'); pinch = startPinch(); hideHover(); }
  });
  wrap.addEventListener('pointermove', ev => {
    const p = localXY(ev);
    if (pointers.has(ev.pointerId)) pointers.set(ev.pointerId, p);
    if (pinch) { if (pointers.size === 2) movePinch(); return; }
    if (press && press.id === ev.pointerId) {
      if (!press.moved && Math.hypot(p.x - press.x, p.y - press.y) > PRESS_PX) { press.moved = true; wrap.classList.add('dragging'); hideHover(); }
      if (press.moved) { pullFrom = null; const c = cam(); state.cam.cx -= (p.x - press.last.x) / c.k; state.cam.cy += (p.y - press.last.y) / c.k; press.last = p; requestDraw(); }
      return;
    }
    if (ev.pointerType !== 'touch') { lastPointer = { x: p.x, y: p.y, inside: true }; if (!flight && !overControl(ev, '.zoombox, .toggle')) showHoverAt(p.x, p.y); }
  });
  function endPointer(ev) {
    const p = localXY(ev); pointers.delete(ev.pointerId);
    if (pinch) { if (pointers.size < 2) { pinch = null; if (atFloor(state.cam.k)) flyTo(fitTarget(), { duration: 300 }); else requestDraw(afterCameraMove); } return; }
    if (!press || press.id !== ev.pointerId) return;
    const pr = press; press = null; wrap.classList.remove('dragging');
    if (pr.moved) { requestDraw(afterCameraMove); return; }
    if (ev.type !== 'pointerup' || performance.now() - pr.t > PRESS_MS) return;
    if (pr.type === 'mouse') { clickAt(p.x, p.y, pr.shift); return; }
    // a touch or pen tap selects the cell; a second tap within 350 ms flies the ladder
    const now = performance.now();
    if (lastTap && now - lastTap.t <= TAP_MS && Math.hypot(p.x - lastTap.x, p.y - lastTap.y) <= TAP_PX) { lastTap = null; clickAt(p.x, p.y, false); return; }
    lastTap = { x: p.x, y: p.y, t: now }; lastPointer = { x: p.x, y: p.y, inside: true }; showHoverAt(p.x, p.y, { touch: true });
  }
  wrap.addEventListener('pointerup', endPointer);
  wrap.addEventListener('pointercancel', endPointer);
  wrap.addEventListener('pointerleave', ev => { if (ev.pointerType !== 'touch' && !press && !pinch) { lastPointer = lastPointer ? { x: lastPointer.x, y: lastPointer.y, inside: false } : null; hideHover(); } });
  wrap.addEventListener('wheel', ev => {
    if (overControl(ev, '.zoombox')) return;
    ev.preventDefault(); cancelFlight();
    // A trackpad pinch arrives as a wheel with the Ctrl flag and small deltas (the phone's pinch is a touch gesture,
    // handled apart); it takes PINCH_RATE against the wheel's WHEEL_RATE. Line- and page-based wheels are scaled to pixels.
    const dy = ev.deltaY * (ev.deltaMode === 1 ? 20 : ev.deltaMode === 2 ? 400 : 1);
    const km = kmAt(ev); const f = Math.exp(-dy * (ev.ctrlKey ? PINCH_RATE : WHEEL_RATE)); const t = zoomStep(f, km);
    if (ev.pointerType !== 'touch') lastPointer = { x: km.px, y: km.py, inside: true };
    hideHover();
    if (atFloor(t.k)) { flyTo(t, { duration: 300 }); return; }   // fully zoomed out: settle on the country's centre
    state.cam = { cx: t.cx, cy: t.cy, k: t.k };
    requestDraw(afterCameraMove);
  }, { passive: false });
  // Keys, when the map has focus: + and − zoom one step, 0 fits the country, the arrows pan (Shift: a small step).
  wrap.addEventListener('keydown', ev => {
    if (ev.target !== wrap) return;
    const panPx = Math.round(minSide() * (ev.shiftKey ? 0.05 : 0.2));
    const pan = (dx, dy) => flyTo({ cx: state.cam.cx + dx / state.cam.k, cy: state.cam.cy - dy / state.cam.k, k: state.cam.k }, { duration: 250 });
    switch (ev.key) {
      case '+': case '=': flyTo(stepCentre(2)); break;
      case '-': case '_': flyTo(stepCentre(0.5)); break;
      case '0': flyTo(fitTarget()); break;
      case 'ArrowLeft': pan(-panPx, 0); break; case 'ArrowRight': pan(panPx, 0); break;
      case 'ArrowUp': pan(0, -panPx); break; case 'ArrowDown': pan(0, panPx); break;
      default: return;
    }
    ev.preventDefault();
  });
  // The zoom box (bottom right) and the scale bar beside it.
  $('zoom-in').addEventListener('click', () => flyTo(stepCentre(2)));
  $('zoom-out').addEventListener('click', () => flyTo(stepCentre(0.5)));
  $('zoom-fit').addEventListener('click', () => flyTo(fitTarget()));
  function syncZoomButtons() { $('zoom-out').disabled = state.cam.k <= kFit() * 1.001; $('zoom-in').disabled = state.cam.k >= K_MAX * 0.999; }
  const SCALE_STEPS = [1000, 500, 200, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.25, 0.1];
  let lastScale = '';
  function drawScaleBar() {
    dropObstacles();
    const k = state.cam.k; let len = SCALE_STEPS[0]; for (const s of SCALE_STEPS) { len = s; if (s * k <= 84) break; }   // at most 84 px: the bar stays inside the right-hand column
    const px = Math.round(len * k * 10) / 10, label = len >= 1 ? `${fmt.int(len)} km` : `${Math.round(len * 1000)} m`, key = px + label;
    if (key === lastScale) return; lastScale = key;
    $('scalebar').querySelector('.bar').style.width = px + 'px'; $('scalebar').querySelector('.lab').textContent = label;
  }

  // ---- side panels -------------------------------------------------------------------------------
  function chartCtx(id) { const c = $(id); const r = c.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1; c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr); const ctx = c.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, r.width, r.height); Motion.audit.scene = id; window.__atlasCanvases[id] = { w: r.width, h: r.height }; return { ctx, w: r.width, h: r.height }; }
  function drawCellPanel(h) {
    const info = $('cellinfo'); const rows = [];
    if (h && h.region) rows.push(['Region', esc(h.region), 'loc']);
    const ad = h && (h.kind === 'firm' ? h : h.address);
    if (ad) { rows.push(['Coordinate pair', `${fmt.int(ad.n)} firm${ad.n === 1 ? '' : 's'}`]); rows.push([`${state.year} statement`, ad.n === 1 ? (ad.a ? 'available' : 'absent') : `${fmt.int(ad.a)} (${fmt.pct(100 * ad.a / ad.n)})`]); }
    if (h && h.listed && h.listed.top && TRN.name) {   // the detail view (author's rule, 25 October 2026): the display name, the filed name beneath, the listing year and the statement state on one line, the list memberships
      const Ls = h.listed, y = state.year, where = Ls.within_km ? `within ${Ls.within_km < 1 ? Math.round(Ls.within_km * 1000) + ' m' : fmt.dec(Ls.within_km, 1) + ' km'}` : 'at this pair';
      rows.push(['On the lists (treated)', `${fmt.int(Ls.n)} ${where}`]);
      const blocks = Ls.top.map(i => {
        const filed = TRN.name_filed ? TRN.name_filed[i] : '', nm = TRN.name[i], cs = TRN.name_case ? TRN.name_case[i] : 0, shared = TRN.name_shared ? TRN.name_shared[i] : 0, lists = listedLists(i);
        return `<div class="lf"><div class="lf-h"><b>${listedGlyph(i, y)}${listedName(i)}${cs === 2 ? ' <span class="muted">(transliterated)</span>' : ''}</b>${lists ? `<span class="muted lists">${lists}</span>` : ''}</div>`
          + (filed && filed !== nm ? `<div class="muted filed">${esc(filed)}</div>` : '') + (shared > 1 ? `<div class="muted filed">one of ${fmt.int(shared)} entries under this name</div>` : '')
          + `<div class="lf-s"><span>${TRN.undated[i] ? 'undated listing' : 'listed ' + TRN.red_from[i]}</span><span>${listedState(i, y)}</span></div>` + (listedRevenue(i, y) ? `<div class="muted filed">${listedRevenue(i, y)}</div>` : '') + `</div>`;
      });
      if (Ls.n > Ls.top.length) blocks.push(`<div class="lf more">and ${fmt.int(Ls.n - Ls.top.length)} more</div>`);
      rows.push(['', blocks.join(''), 'block']);
    }
    if (h && state.layer === 'industry' && h.kind !== 'listed' && h.kind !== 'firm' && h.dom != null && h.dom !== 255) {   // the detail view of a cell's industry mix (round 9)
      rows.push(['Leading division', `${esc(divTitle(h.dom))} (${divPad(h.dom)})`]); rows.push(['Share of revenue', `${h.share}%`]); rows.push(['Class', esc(indClassLabel(h.dom))]);
      if (h.mix.length > 1) rows.push(['', '<div class="lf">' + h.mix.slice(1).map(m => `<div class="lf-s"><span>${m.share}%</span><span>${esc(m.title)} (${divPad(m.code)})</span></div>`).join('') + (h.rest ? `<div class="lf-s"><span>${h.rest}%</span><span>other divisions</span></div>` : '') + '</div>', 'block']);
      if (h.lsh != null) rows.push(['On the lists (treated)', `${h.lsh}% of revenue`]);
      rows.push(['With a revenue value', fmt.int(h.nrev)]);
    }
    if (ad && state.layer === 'industry' && ad.ind != null && ad.ind !== 255) { rows.push(['Leading division', `${esc(divTitle(ad.ind))} (${divPad(ad.ind)})`]); rows.push(['Share of revenue', `${ad.ish}%`]); rows.push(['Class', esc(indClassLabel(ad.ind))]); }
    if (h && (h.fine || h.n != null || h.n21 != null || h.n_base != null || h.dom != null)) rows.push(['Cell', h.fine ? (h.grid < 1 ? '250 m' : h.grid + ' km') : `${h.grid} km (${h.ix}, ${h.iy})`]);
    info.innerHTML = rows.length ? rows.map(([k, v, t]) => (t === 'block' ? `<div class="listed">${v}</div>` : t === 'loc' ? `<span>${k}</span><b class="loc">${v}</b>` : `<span>${k}</span><b>${v}</b>`)).join('') : '<span>Hover a cell</span><b></b>';
    const { ctx, w, hgt = 0 } = chartCtx('cellchart'); const hh = $('cellchart').getBoundingClientRect().height;
    if (!h) return;
    const note = t => Motion.paragraph(ctx, t, 8, 24, w - 16, { size: 13, color: theme.muted });
    const chart = (pts, xDomain, xTicks, eras, caption) => {
      CH.lines(ctx, { x: 44, y: 14, w: w - 100, h: hh - 52 }, [{ label: '{y}', color: theme.accent, points: pts, gapAfter: [2018] }], { xDomain, yDomain: [0, 100], theme, yTicks: [0, 50, 100], xTicks, xFmt: v => (v === 2025 ? "25*" : String(v).slice(2)), labelSize: 12, lineWidth: 2, eras, yFmt: v => v + '%', axisSize: 12, axisDy: 20 });
      const cap = Motion.measure(ctx, caption, 11, 400) <= w - 16 ? caption : caption.replace(/, (\d{4} to \d{4}|by year)$/, '');   // a caption wider than the canvas drops its year suffix, which the axis shows (round 10)
      Motion.text(ctx, cap, 8, hh - 2, { size: 11, color: theme.dim });
    };
    if (h.fine) {
      // 1 km city cells carry year series for 2019 to 2024 (cellsyears.city_1km); 250 m cells and the 5 km density cells carry 2021 only.
      if (h.n == null) return note(`No located firms in this ${h.grid < 1 ? '250 m' : h.grid + ' km'} cell`);
      if (h.grid !== 1 || !cityYear[h.city]) return note(h.grid < 1 ? '250 m cells carry 2021 only' : '5 km density cells carry 2021 only');
      const pts = [];
      for (const [y, L1] of Object.entries(cityYear[h.city])) { const d = L1.d, jx = Math.floor((h.kmx - d.origin[0]) / 1), jy = Math.floor((h.kmy - d.origin[1]) / 1); for (let i = 0; i < d.count; i++) if (d.ix[i] === jx && d.iy[i] === jy) { if (d.n[i] >= 50 && d.a[i] >= 0) pts.push({ x: +y, y: 100 * d.a[i] / d.n[i] }); break; } }
      if (!pts.length) return note('Fewer than 50 located firms in every year, 2019 to 2024');
      return chart(pts.sort((a, b) => a.x - b.x), [2018.5, 2024.5], [2019, 2021, 2024], [], 'share with a statement, this 1 km cell, 2019 to 2024');
    }
    const key = cellKey(h.ix, h.iy); const pts = [];
    if (h.grid === G25 && C25) { for (const y of years) { const d = c25[y]; if (!d) continue; const i = d.map.get(key); if (i != null && d.n[i] >= 50) pts.push({ x: y, y: 100 * d.a[i] / d.n[i] }); } }
    else for (const y of years) { const d = yearCells[y].get(key); if (d && d.n >= 50) pts.push({ x: y, y: 100 * d.a / d.n }); }
    if (!pts.length) return note('Fewer than 50 located firms in every year');
    chart(pts, [2013.5, 2025.5], [2014, 2018, 2021, 2025], [{ from: 2018.5, to: 2025.5, color: theme.highlightBand }], `share with a statement, this ${h.grid} km cell, by year`);
  }
  function drawNational() {
    const { ctx, w } = chartCtx('natchart'); const hh = $('natchart').getBoundingClientRect().height;
    const el = [], reg = []; S.avail.year.forEach((y, i) => { if (S.avail.eligible_share[i] != null) { el.push({ x: y, y: S.avail.eligible_share[i] }); reg.push({ x: y, y: S.avail.registered_share[i] }); } });
    // The right margin fits the longer end label (measured), the axes draw at the panel's 12 px, the two end labels are pushed apart.
    const margin = Motion.measure(ctx, 'registered ' + Motion.fmt.pct(reg[reg.length - 1].y, 1), 12, 500) + 22;
    const r = CH.lines(ctx, { x: 44, y: 14, w: w - 44 - margin, h: hh - 44 }, [{ label: 'registered {y}', color: theme.accentStrong, points: reg, gapAfter: [2018], width: 2 }, { label: 'eligible {y}', color: theme.accent, points: el, gapAfter: [2018], width: 2 }],
      { xDomain: [2011.5, 2025.5], yDomain: [0, 80], theme, yTicks: [0, 40, 80], xTicks: [2012, 2016, 2020, 2024], labelSize: 12, dots: false, eras: [{ from: 2018.5, to: 2025.5, color: theme.highlightBand }], yFmt: v => v + '%', labelFmt: v => Motion.fmt.pct(v, 1), axisSize: 12, axisDy: 20, spreadLabels: true });
    if (state.layer === 'share' || state.layer === 'industry') { const x = r.sx(state.year); ctx.strokeStyle = theme.ink; ctx.lineWidth = 1.5; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(x, 14); ctx.lineTo(x, hh - 30); ctx.stroke(); ctx.setLineDash([]); }
    $('natprov').textContent = 'Table B.1: statements over the annual eligible population and over firms registered at year-end; 2011 has no statements, 2025* is flagged. Source ' + S.sources.avail + '.';
  }
  function drawGroups() {
    const { ctx, w } = chartCtx('groupchart'); const hh = $('groupchart').getBoundingClientRect().height;
    const items = [{ label: 'Joint-stock', a: F.legal.joint_stock[0], b: F.legal.joint_stock[1], color: theme.accent }, { label: 'State-related', a: F.own.state[0], b: F.own.state[1], color: theme.fall }, { label: 'Private', a: F.own.private[0], b: F.own.private[1], color: theme.accent }, { label: 'Unitary', a: F.legal.unitary[0], b: F.legal.unitary[1], color: theme.fall }];
    const vm = Motion.measure(ctx, '00.0%', 12, 500), lm = 16 + vm + 14 + Math.max(...items.map(it => Motion.measure(ctx, it.label, 12, 500))) + 6, rm = 16 + vm + 12;   // measured margins (round 10: the monospace widened the labels)
    CH.slopes(ctx, { x: 8, y: 30, w: w - 16, h: hh - 48 }, items, { yDomain: [44, 82], theme, size: 12, leftMargin: lm, rightMargin: rm, spread: true });
    $('groupprov').textContent = 'Share of eligible firms with a statement by ownership and legal form (Figures 2.2 and 2.3 sources); population comparisons by year, not the same firms.';
  }
  function drawOdds() {
    const { ctx, w } = chartCtx('oddschart'); const hh = $('oddschart').getBoundingClientRect().height;
    const sz = {}; for (let i = 0; i < S.size.year.length; i++) if (S.size.era[i] === 'recent') (sz[S.size.quintile[i]] = sz[S.size.quintile[i]] || []).push({ x: S.size.year[i], y: S.size.or[i], low: S.size.low[i], high: S.size.high[i] });
    const ls = []; for (let i = 0; i < S.lists.year.length; i++) if (S.lists.model[i] === 'annual-eligible-membership' && S.lists.contrast[i] === 'sanctioned_only' && S.lists.comparison[i] === 'level' && S.lists.year[i] != null) ls.push({ x: S.lists.year[i], y: S.lists.or[i], low: S.lists.low[i], high: S.lists.high[i] });
    // The right margin fits the longest end label (measured, as drawNational does): the label starts 22 px past the last point and ends 8 px inside the canvas.
    const listLabel = 'sanctions list (treated)', right = Motion.measure(ctx, listLabel, 12, 500) + 30;
    CH.yearDots(ctx, { x: 40, y: 10, w: w - right, h: hh - 44 }, [{ label: 'Q5 vs Q1', color: theme.accentStrong, points: sz.Q5 || [], whiskers: true, dot: 4, width: 2 }, { label: 'Q2 vs Q1', color: theme.accent, points: sz.Q2 || [], dot: 3, width: 1.5 }, { label: listLabel, color: theme.fall, points: ls, whiskers: true, dot: 4, width: 2 }],
      { xDomain: [2019, 2024], yDomain: [0.3, 5], yTicks: [0.5, 1, 2, 4], theme, size: 12, thinTicks: true, spreadLabels: true });
    $('oddsprov').textContent = `Adjusted odds of a statement: asset quintiles Q5 and Q2 against Q1 (Table B.4; 2022 vs 2021 Q5 ratio ${fmt.dec(F.size_q5_2022_ratio, 3)} [${fmt.dec(F.size_q5_2022_low, 3)}, ${fmt.dec(F.size_q5_2022_high, 3)}], provisional) and firms on the sanctions list only (treated) against firms on no list (comparison group) (Table B.7), two-way 95% intervals.`;
  }
  function redrawAll() { sizeCanvases(); drawMap(); drawCellPanel(state.hover); drawNational(); drawGroups(); drawOdds(); syncZoomButtons(); }

  // ---- controls -------------------------------------------------------------------------------------
  const layersEl = $('layers');
  // Firms view provenance (author's wording standard, 24 October 2026): the geocode categories defined once, the shared-registration text verbatim.
  const FIRMS_PROV = 'Firms view: every located eligible firm on no list (comparison group) with a house- or street-level geocode, drawn at its registered address and grouped by coordinate pair (M9 pass over the foundation registry and payload, one record per coordinate pair and year); firms on at least one of the five lists (treated) from the national pass (M8), red from their listing year. Listed firms are named from the list files (the decree and government strategic workbooks’ name columns, then the sanctions file’s name field): one display name per firm, the core name with its legal form abbreviated after a comma, in Latin script (the sanctions file’s Latin alias that transliterates the filed name, else a BGN/PCGN transliteration marked as such, else the Latin name as filed), cut at 60 characters; the full filed name is shown in the Under the cursor panel. Firms on no list are never named. Other geocodes, coordinates without a verified house or street match, are counted and not drawn. Most located firms have a house- or street-level address match. The remaining geocodes have unverified precision. Registered legal addresses can be shared business centres or addresses rented for registration and correspondence, rather than production premises. Several firms can therefore share one registered address. The Federal Tax Service tracks mass-registration addresses.';
  const syncProv = () => { $('layerprov').textContent = state.mode === 'firms' ? FIRMS_PROV : LAYERS.find(x => x.id === state.layer).prov; };
  LAYERS.forEach(L => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.textContent = L.label; b.dataset.id = L.id; b.setAttribute('aria-pressed', String(L.id === state.layer)); b.addEventListener('click', () => { state.layer = L.id; layersEl.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.id === L.id))); syncYearRow(); syncPulseButton(); syncProv(); drawMap(); drawNational(); syncMix(); }); layersEl.appendChild(b); });
  function syncYearRow() { $('yearrow').hidden = !(state.mode === 'firms' || state.layer === 'share' || state.layer === 'industry'); }
  $('pulse').addEventListener('click', () => replayPulse());
  // The view switch (round 5): cells as before, or every registered address as a mark.
  const modesEl = $('modes');
  if (FIRMS_OK) {
    const lab = document.createElement('span'); lab.className = 'modelabel'; lab.textContent = 'View'; modesEl.appendChild(lab);
    [['cells', 'Cells'], ['firms', 'Firms']].forEach(([m, label]) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.textContent = label; b.dataset.mode = m; b.setAttribute('aria-pressed', String(m === state.mode)); b.addEventListener('click', () => { if (state.mode === m) return; state.mode = m; syncProv(); modesEl.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.mode === m))); hideHover(); syncYearRow(); syncPulseButton(); drawMap(); syncMix(); drawCellPanel(null); }); modesEl.appendChild(b); });
  } else modesEl.hidden = true;
  $('layerprov').textContent = LAYERS[1].prov;
  $('year').addEventListener('input', () => { const prev = state.year; state.year = +$('year').value; $('yearlabel').textContent = state.year + (state.year === 2025 ? '*' : ''); if (state.mode === 'firms') startPulse(prev, state.year); syncPulseButton(); drawMap(); drawNational(); syncMix(); });
  const presets = $('presets');
  // Presets hold a target camera: the button flies there, the audit API jumps, a link's anchor opens there.
  const PRESETS = [];
  const slugOf = label => label.replace(/\s*\(.*\)$/, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const addPreset = (label, target) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; { const mm = /^(.*?)( \(.*\))?$/.exec(label); b.innerHTML = `${esc(mm[1])}${mm[2] ? `<span class="u">${esc(mm[2])}</span>` : ''}`; } /* the place name in capitals, a unit suffix as it is (round 10) */ b.addEventListener('click', () => flyTo(target())); presets.appendChild(b); PRESETS.push({ label, slug: slugOf(label), target, button: b }); };
  addPreset('Russia', fitTarget);
  for (const city of bmp.cities) addPreset(city.label, () => cityTarget(city));
  addPreset('Central Moscow (250 m)', () => { const c = bmp.cities[0]; return fineTarget(c.x + 1.5, c.y + 0.5); });
  function presetFromHash() {
    const raw = decodeURIComponent(location.hash.slice(1)).trim(); if (!raw || !/^[A-Za-z0-9_-]+$/.test(raw)) return null;
    let s = raw.toLowerCase(), firms = false; if (s.endsWith('-firms')) { firms = true; s = s.slice(0, -6); }
    const p = PRESETS.find(p => p.slug.toLowerCase() === s || p.slug.toLowerCase().replace(/-/g, '_') === s); return p ? { preset: p, firms } : null;
  }
  window.addEventListener('hashchange', () => { const hp = presetFromHash(); if (hp) flyTo(hp.preset.target()); });
  $('footer').innerHTML = `Data: ${F.release} (Bondarkov et al. 2025, CC BY 4.0), ${fmt.int(F.records_total)} annual records, financial years ${F.years}; boundaries geoBoundaries gbOpen (CC BY 4.0), OpenStreetMap/Wambacher 2017 (ODbL 1.0), © OpenStreetMap contributors. Every number is a checked aggregate with a provenance record in the lab (motion/data/*.provenance.json). Descriptive associations, not causal effects; absence from the archive is not withdrawal or concealment; the lists are fixed memberships, not dated designations. Treated: a firm on at least one of the five lists (sanctions, decree, resident, government strategic, presidential strategic). The word names the study’s group, not an effect. Comparison group: firms on none of the five lists. Open the atlas at a city by adding its name to the link, as in #Moscow or #St-Petersburg (#Moscow-firms for the firms view).`;
  // A resize keeps the centre and the span across the width (a phone turned sideways keeps its view).
  function onResize() { dropObstacles(); pullFrom = null; const w0 = stage.width; sizeCanvases(); if (w0 > 0 && stage.width !== w0) state.cam.k *= stage.width / w0; redrawAll(); syncZoomButtons(); refreshHover(); }
  window.addEventListener('resize', onResize);
  // The overlays' boxes relative to the map, for the audit's DOM check.
  // Interface labels in tracked capitals (round 10): no label may run past its card, panel or strip, and none may overflow its own box.
  function overflowing() {
    const out = [], sels = ['#theme', '#modes .modelabel', '#modes .btn', '#layers .btn', '#presets .btn', '.yearrow .ui', '#yearlabel', '#legendtitle', '#legendbody .row', '#mixtitle', '#cellinfo > span', '#notelabel'];
    for (const sel of sels) for (const el of document.querySelectorAll(sel)) {
      if (!el.offsetParent) continue;
      const host = el.closest('.card, .maplegend, .mixbox, .mapnote, header'); if (!host) continue;
      const r = el.getBoundingClientRect(), hb = host.getBoundingClientRect(), pr = parseFloat(getComputedStyle(host).paddingRight) || 0;
      if (r.right > hb.right - pr + 0.5 || el.scrollWidth > el.clientWidth + 1) out.push({ sel, text: (el.textContent || '').trim().slice(0, 60), right: Math.round(r.right - (hb.right - pr)), over: el.scrollWidth - el.clientWidth });
    }
    return out;
  }
  function domBoxes() {
    const m = wrap.getBoundingClientRect();
    const rel = id => { const el = $(id); const r = el.getBoundingClientRect(); const visible = !el.hidden && getComputedStyle(el).display !== 'none' && r.width > 0 && r.height > 0; return { x: r.left - m.left, y: r.top - m.top, x1: r.right - m.left, y1: r.bottom - m.top, visible }; };
    const pb = $('pulse'), pulse = Object.assign(rel('pulse'), { disabled: pb.disabled, title: pb.title });   // the side panel's year row, for the audit (map-relative boxes like the others)
    return { overflow: overflowing(), map: { x: 0, y: 0, x1: m.width, y1: m.height, visible: true }, legend: rel('legend'), note: rel('mapnote'), zoom: rel('zoombox'), scale: rel('scalebar'), tip: rel('tip'), pulse, yearrow: rel('yearrow'), year: rel('year'), yearlabel: rel('yearlabel'), strip: rel('ctxstrip'), striptoggle: rel('ctxtoggle'), glyph: rel('ctxglyph'), stripOpen: stripOpen(), mix: rel('mixbox'), mixtoggle: rel('mixtoggle'), mixOpen: mixOpen(), tipRelaxed: $('tip').style.display !== 'none' && tileState ? tileState.relaxed : null };
  }
  // Driven by tools/atlas-audit.py: switch the layer and the year, redraw, and hand back the text boxes, the overlays'
  // boxes and the camera; the camera moves here are instant.
  window.__atlas = {
    layers: LAYERS.map(L => L.id),
    layer(id) { const b = layersEl.querySelector(`button[data-id="${id}"]`); if (b) b.click(); },
    year(y) { $('year').value = String(y); $('year').dispatchEvent(new Event('input')); },
    redraw() { Motion.audit.boxes = []; Motion.audit.seq = 0; redrawAll(); return { boxes: Motion.audit.boxes, dom: domBoxes() }; },
    tips() {   // every tip measured in the strip's hidden span as it would show (round 10): the audit asserts none is clipped at any width
      const el = stripState.cur === 'A' ? $('ctxB') : $('ctxA'); const keep = el.innerHTML, had = el.classList.contains('tip'); el.classList.add('tip');
      const out = TIPS.flatMap((t, i) => [t.text, t.touch].filter(Boolean).map(str => { el.innerHTML = units(esc(str)); return { i, text: str, w: el.scrollWidth, slot: el.clientWidth, h: el.scrollHeight, hslot: el.clientHeight, clipped: el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1 }; }));
      el.innerHTML = keep; el.classList.toggle('tip', had); return out;
    },
    camera() { return { cx: state.cam.cx, cy: state.cam.cy, k: state.cam.k }; },
    kFit() { return kFit(); },
    preset(label) { const p = PRESETS.find(p => p.label === label); if (!p) return false; flyTo(p.target(), { instant: true }); return true; },
    hoverKm(x, y, opts) { const c = cam(); const px = c.ox + (x - c.cx) * c.k, py = c.oy - (y - c.cy) * c.k; let h; if (opts && opts.show && px >= 0 && px < stage.width && py >= 0 && py < stage.height) { lastPointer = { x: px, y: py, inside: true }; h = showHoverAt(px, py); } else { const km = { x, y, px, py }; h = hitAt(km); h.kmx = x; h.kmy = y; state.hover = h; } return { kind: h.kind || 'cell', address: !!(h.kind === 'firm' || h.address), grid: h.grid, fine: !!h.fine, n: h.n == null ? null : h.n, listed: h.listed || null }; },
    click(x, y, opts) { const c = cam(); const p = { x, y, px: c.ox + (x - c.cx) * c.k, py: c.oy - (y - c.cy) * c.k }; const h = hitAt(p); h.kmx = x; h.kmy = y; const r = ladderTarget(h, p, !!(opts && opts.shift)); return (r ? flyTo(r.target, { instant: true }) : Promise.resolve()).then(() => Object.assign(this.camera(), { moved: !!r, rung: r ? r.rung : null })); },
    zoom(dir) { return flyTo(dir > 0 ? stepCentre(2) : dir < 0 ? stepCentre(0.5) : fitTarget(), { instant: true }).then(() => this.camera()); },
    zoomBy(f, km) { const c = cam(); const p = km ? { x: km[0], y: km[1], px: c.ox + (km[0] - c.cx) * c.k, py: c.oy - (km[1] - c.cy) * c.k } : null; return flyTo(p ? stepAt(p, f) : stepCentre(f), { instant: true }).then(() => this.camera()); },   // an instant step by a factor, anchored at a km point or the centre (the audit's wheel)
    fly(target) { return flyTo(target); },
    // the real frame cadence of a flight to target: intervals between animation frames while it runs
    profileFlight(target) { const stamps = [], ks = []; const tick = now => { stamps.push(now); ks.push(state.cam.k); if (flight) requestAnimationFrame(tick); }; requestAnimationFrame(tick); return flyTo(target).then(r => { const iv = [], slow = []; for (let i = 1; i < stamps.length; i++) { const d = stamps[i] - stamps[i - 1]; iv.push(d); if (d > 25) slow.push([+ks[i - 1].toFixed(2), Math.round(d)]); } const sorted = iv.slice().sort((a, b) => a - b); const mean = iv.reduce((s, v) => s + v, 0) / Math.max(1, iv.length); return { frames: r.frames, ms: Math.round(r.ms), fps: Math.round(r.frames / Math.max(1, r.ms) * 1000), mean: +mean.toFixed(1), p95: +(sorted[Math.floor(sorted.length * 0.95)] || 0).toFixed(1), max: +(sorted[sorted.length - 1] || 0).toFixed(1), over25: slow.length, slow }; }); },
    hoverCost(n = 30) { const W = stage.width, H = stage.height; const t0 = performance.now(); let mx = 0; for (let i = 0; i < n; i++) { const a = performance.now(); showHoverAt(W * (0.2 + 0.6 * ((i * 7919) % 1000) / 1000), H * (0.2 + 0.6 * ((i * 104729) % 1000) / 1000)); mx = Math.max(mx, performance.now() - a); } hideHover(); return { mean: +((performance.now() - t0) / n).toFixed(2), max: +mx.toFixed(2) }; },
    // the subject's screen distance from the centre along the flight that fly(target) would take, at n + 1 samples
    pathPreview(target, n = 20) { const from = { cx: state.cam.cx, cy: state.cam.cy, k: state.cam.k }, to = { cx: target.cx, cy: target.cy, k: clampK(target.k) }; const ms = 1000, path = flightPath(from, to, ms); const out = []; for (let i = 0; i <= n; i++) { const p = path(ms * i / n); out.push(Math.hypot((to.cx - p.cx) * p.k, (to.cy - p.cy) * p.k)); } return out; },
    legend(open) { setLegend(open == null ? null : open ? 'open' : 'closed'); },   // null: back to the width rule
    note(open) { setNote(open == null ? null : open ? 'open' : 'closed'); },
    frameCost(n = 20) { const t0 = performance.now(); let mx = 0; for (let i = 0; i < n; i++) { const a = performance.now(); drawMap({ flight: true }); mx = Math.max(mx, performance.now() - a); } const mean = (performance.now() - t0) / n; drawMap(); return { mean, max: mx }; },
    mode(m) { const b = modesEl.querySelector(`button[data-mode="${m}"]`); if (b) b.click(); return state.mode; },
    field() { return useGL() ? glKind : '2d'; },
    glState() { return { kind: glKind, lost: glLost, isContextLost: gl ? gl.isContextLost() : null, error: glError, events: glEvents.slice() }; },
    loseContext() { if (glLoseExt) glLoseExt.loseContext(); return !!glLoseExt; },
    restoreContext() { if (glLoseExt) glLoseExt.restoreContext(); return !!glLoseExt; },
    pulsing() { return pulse ? pulse.count : 0; },
    pulse() { return replayPulse(); },
    hoverPx(px, py, opts) { return showHoverAt(px, py, opts || {}); },   // round 9: a hover at a map pixel (the tile placement states)
    tapAt(px, py) { return showHoverAt(px, py, { touch: true }); },
    tile() { return tileState; },
    strip(open) { ui.ctx = open == null ? null : (open ? 'open' : 'closed'); applyStrip(); if (stripOpen()) updateContext(true); return stripOpen(); },
    context() { const el = stripState.cur === 'A' ? $('ctxA') : $('ctxB'); const [band, name] = bandUnderCamera(); return { band, name, locs: el.querySelectorAll('.loc').length, kind: stripState.tip ? 'tip' : (stripState.fact ? stripState.fact.kind : 'none'), text: el.textContent, glyph: stripState.glyphName, glyphD: $(stripState.glyphCur === 'A' ? 'ctxpathA' : 'ctxpathB').getAttribute('d') || '', open: stripOpen(), clipped: el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1, motion: !reduceMotion() }; },
    tip(force) { if (force === 'reset') { stripState.seen.clear(); try { sessionStorage.removeItem('atlas-tips'); } catch (e) { /* no storage */ } return true; } if (force === false) { endTip(true); return false; } return maybeTip(true); },
    glyph(name) { return regionGlyph(name); },
    jump(t) { return flyTo(t, { instant: true }).then(() => cam()); },
    hoverOff() { hideHover(); return true; },   // round 9: clear a hover (the frames tool's rest frames)
    mix() { const el = $('mixbox'); return { visible: !el.hidden, open: mixOpen(), title: $('mixtitle').textContent, unit: $('mixunit').textContent, rows: [...document.querySelectorAll('#mixrows .r')].map(r => ({ name: r.querySelector('.nm').textContent, pct: r.querySelector('.pc') ? r.querySelector('.pc').textContent : null, colour: r.querySelector('.sw') ? r.querySelector('.sw').style.background : null })) }; },
    mixbox(open) { openMix(open == null ? null : (open ? 'open' : 'closed')); return mixOpen(); },
    mixCost(n = 10) { const t0 = performance.now(); let mx = 0; for (let i = 0; i < n; i++) { const a = performance.now(); viewMix.key = ''; computeViewMix(); mx = Math.max(mx, performance.now() - a); } return { mean: +((performance.now() - t0) / n).toFixed(2), max: +mx.toFixed(2), rows: viewMix.rows ? viewMix.rows.length : 0 }; },
    still() { if (stillTimer) { clearTimeout(stillTimer); stillTimer = 0; } cursorStill = true; wrap.classList.remove('cursor-live'); drawOverlay(state.hover); return true; },
    live(on) { if (stillTimer) { clearTimeout(stillTimer); stillTimer = 0; } cursorStill = !on; wrap.classList.toggle('cursor-live', !!on); drawOverlay(state.hover); return !cursorStill; },   // a test hook: hold the moving state for a frame
    overlayCost(n = 30) { const t0 = performance.now(); let mx = 0; for (let i = 0; i < n; i++) { const a = performance.now(); drawOverlay(state.hover); mx = Math.max(mx, performance.now() - a); } return { mean: +((performance.now() - t0) / n).toFixed(3), max: +mx.toFixed(3) }; },
    contextCost(n = 30) { const t0 = performance.now(); let mx = 0; for (let i = 0; i < n; i++) { const a = performance.now(); updateContext(true); mx = Math.max(mx, performance.now() - a); } return { mean: +((performance.now() - t0) / n).toFixed(3), max: +mx.toFixed(3) }; },
    listedRule() { const c = cam(), L = MM.listedRule(markRule(c.k), c.k, kFit()), rMax = MM.listedRadius(L, 65535), rMin = MM.listedRadius(L, 1); return Object.assign({ k: c.k, rMin, rMax, cull: MARK_MARGIN, pulseMs: PULSE_MS, decayMs: DECAY_MS, flashMax: MM.flashPeak(rMax), glowMax: 2 * (rMax + MM.flashPeak(rMax)) }, L); },   // the rule at the current zoom, for the audit
    pulseAt(ms) { if (ms == null) { endPulse(); drawMarks(cam()); return 0; } const m = manualMask(state.year); if (!m.count) return 0; endPulse(); makePulse(m.mask); pulse = { t0: performance.now() - ms, mask: m.mask, count: m.count, static: false, at: ms }; setLive(true); drawMarks(cam()); return m.count; },   // a frozen pulse frame at ms, for the comparison pictures; pulseAt(null) clears it
    ready() { return Promise.all([state.mode === 'firms' ? ensureYear(state.year) : Promise.resolve(), indCityPending || Promise.resolve()]).then(() => {}); },
    cities: Object.fromEntries(bmp.cities.map(c => [c.label, [c.x, c.y]])),
  };
  Promise.all([document.fonts.ready, document.fonts.load('400 13px "IBM Plex Mono"'), document.fonts.load('500 13px "IBM Plex Mono"'), document.fonts.load('700 13px "IBM Plex Mono"')].map(p => p.catch(() => null))).then(() => { sizeCanvases(); applyStrip(); applyMix(); const hp = presetFromHash(); state.cam = hp ? hp.preset.target() : fitTarget(); syncThemeButton(); syncPulseButton(); if (hp && hp.firms && FIRMS_OK) window.__atlas.mode('firms'); redrawAll(); syncZoomButtons(); });
})();
