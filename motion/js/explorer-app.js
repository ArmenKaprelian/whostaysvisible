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
  // browser cannot inflate gzip. Nothing here names a firm: the files carry counts and classes only.
  const FM = D.firms || null, TRN = D.treatednational || null;
  const FIRMS_OK = !!(FM && TRN && typeof DecompressionStream === 'function');
  const CLASS_LABELS = ['≤ −50%', '−50 to −20%', '−20 to 0%', '0 to +50%', '+50 to +150%', '> +150%'];

  // ---- theme -----------------------------------------------------------------------------------
  const root = document.documentElement;
  function readTheme() {
    const css = getComputedStyle(root), tok = n => css.getPropertyValue('--' + n).trim();
    const dark = tok('stage').toUpperCase() !== '#FFFFFF';
    // Dark theme: ColorBrewer YlGnBu for ordered layers and PRGn for signed change, off the navy chrome.
    // Light theme: the manuscript's navy ramps for ordered layers, PRGn (dark = strong) for signed change.
    return { dark, stage: tok('stage'), land: tok('land'), border: tok('border'), graticule: tok('graticule'), ink: tok('ink'), muted: tok('muted'), dim: tok('dim'), grid: tok('grid'),
             accent: tok('accent'), accentStrong: tok('accent-strong'), fall: tok('fall'), rise: tok('rise'), below: tok('below'), highlightBand: tok('highlight'), tick: tok('dim'), axis: tok('dim'), barMuted: tok('border'),
             ramp6: dark ? ['#1D91C0', '#38ADC3', '#6CC5BE', '#A2DAB8', '#D4EEB3', '#FFFFD9'] : ['#D9E8F5', '#A9C4DE', '#78A3C9', '#4F84B4', '#2F6395', '#16436E'],
             ramp5: dark ? ['#38ADC3', '#6CC5BE', '#A2DAB8', '#D4EEB3', '#FFFFD9'] : ['#78A3C9', '#4F84B4', '#2F6395', '#16436E', '#061C38'],
             change6: dark ? ['#E7D4E8', '#C2A5CF', '#9970AB', '#5AAE61', '#A6DBA0', '#D9F0D3'] : ['#762A83', '#9970AB', '#C2A5CF', '#A6DBA0', '#5AAE61', '#1B7837'],
             density: dark ? '#7FCDBB' : '#16436E',
             neutral: FM ? (dark ? FM.neutral.dark : FM.neutral.light) : '#B5C3D1', blue6: FM ? (dark ? FM.class_colours.dark : FM.class_colours.light) : [], treated: '#E31A1C', treatedOutline: '#FFD9D9' };
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
    { id: 'change', label: 'Change, 2024 vs 2021', prov: 'Figure 2.7 lower panel: change in the located share with a statement, 2024 against 2021, 100 km cells with 50 or more located firms in both years; six classes at ±2 and ±5 points (presentation-finalization-20261019/data/availability-change-cells.csv).' },
    { id: 'cohort', label: 'Cohort inclusion', prov: 'Figure 2.8: share of a cell’s located eligible firms (2021) in the revenue cohort by cash share, pooled quintile classes of supported cells (candidate-02-cell-source.csv; cutpoints 33.3, 38.3, 43.0, 47.6%).' },
    { id: 'lists', label: 'List members (treated), 2021', prov: 'Located members of the sanctions list and the government strategic list (treated) per 100 km cell in 2021 (geography-review-20261006 cells); cells with fewer than 5 members of a list show no count. The lists are fixed memberships, not dated designations. Treated: a firm on at least one of the five lists (sanctions, decree, resident, government strategic, presidential strategic). The word names the study’s group, not an effect.' },
    { id: 'fin', label: 'Median revenue change (descriptive)', prov: 'Percent change of each cell’s median real revenue among the revenue-by-cash cohort firms observed in 2024, against the cell’s 2021 median; cells with 50 or more observed firms (pass2-reconcile geo-revenue-change-from-2021-source.csv). Descriptive: composition changes with observation; not a Chapter 3 estimate.' },
  ];

  // ---- map canvas ------------------------------------------------------------------------------
  const wrap = $('mapwrap'), mapC = $('map'), ovC = $('overlay'), mctx = mapC.getContext('2d', { willReadFrequently: true }), octx = ovC.getContext('2d');
  const stage = { width: 0, height: 0, scale: 1, base() { mctx.setTransform(stage.scale, 0, 0, stage.scale, 0, 0); } };
  function sizeCanvases() {
    const r = wrap.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    stage.width = Math.max(1, Math.round(r.width)); stage.height = Math.max(1, Math.round(r.height)); stage.scale = dpr;
    for (const c of [mapC, ovC]) { c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr); }
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
  const stepAt = (km, f) => { const k2 = clampK(state.cam.k * f); if (atFloor(k2)) return fitTarget(); return { cx: km.x - (km.px - stage.width / 2) / k2, cy: km.y + (km.py - stage.height / 2) / k2, k: k2 }; };   // the wheel's rule: the point under the cursor stays put
  const stepCentre = f => { const k2 = clampK(state.cam.k * f); return atFloor(k2) ? fitTarget() : { cx: state.cam.cx, cy: state.cam.cy, k: k2 }; };
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
    Motion.audit.scene = 'map'; if (!flight) { const r = wrap.getBoundingClientRect(); window.__atlasCanvases.map = { w: r.width, h: r.height }; }
    const c = cam(); stage.base();
    mctx.fillStyle = theme.stage; mctx.fillRect(0, 0, stage.width, stage.height);
    MM.drawBasemap(mctx, stage, c, bmp, theme, { borderPx: c.k > 9 ? 1.2 : 0.8 });
    const L = state.layer;
    if (state.mode === 'firms') drawFirms(c);
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
    } else if (L === 'fin') {
      const paths = tiles('fin', () => MM.buildTiles(finIdx.length, finIdx.map(i => fin.ix[i]), finIdx.map(i => fin.iy[i]), j => { const v = fin.change_pct[finIdx[j]]; let cl = 0; while (cl < FIN_BREAKS.length && v >= FIN_BREAKS[cl]) cl++; return cl; }, { gapKm: 15 }));
      MM.drawTiles(mctx, stage, c, paths, cl => theme.change6[cl]);
    }
    stage.base();
    if (c.k > 0.6) for (const city of bmp.cities) { const [px, py] = Motion.project(c, city.x, city.y); if (px > -50 && px < stage.width + 50 && py > -20 && py < stage.height + 20) MM.cityLabel(mctx, c, city, theme, { size: 13, dot: 3, dx: 7, dy: -5 }); }
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
    if (magic !== 'FRM1' || ver !== 1 || year !== +y || n !== exp.addresses || buf.byteLength !== 32 + 15 * n) throw new Error(`bad file (${magic} v${ver} ${year}, ${n} records, ${buf.byteLength} bytes)`);
    const x = new Int32Array(buf, 32, n), yv = new Int32Array(buf, 32 + 4 * n, n), nn = new Uint16Array(buf, 32 + 8 * n, n), a = new Uint16Array(buf, 32 + 10 * n, n), f = new Uint16Array(buf, 32 + 12 * n, n), cls = new Uint8Array(buf, 32 + 14 * n, n);
    const share = new Uint8Array(n); let sumN = 0;
    for (let i = 0; i < n; i++) { sumN += nn[i]; const sh = 100 * a[i] / nn[i]; let c = 0; while (c < YEAR_BREAKS.length && sh >= YEAR_BREAKS[c]) c++; share[i] = c; }
    if (sumN !== exp.firms) throw new Error(`firms ${sumN} differ from the manifest's ${exp.firms}`);
    return { year: +y, n, x, y: yv, nn, a, f, cls, share };
  }
  function ensureYear(y) {
    if (firmYears.has(y)) return Promise.resolve(firmYears.get(y));
    if (firmPending.has(y)) return firmPending.get(y);
    const p = loadYear(y).then(d => { firmYears.set(y, d); firmOrder.push(y); while (firmOrder.length > 3) firmYears.delete(firmOrder.shift()); firmPending.delete(y); return d; }, e => { firmPending.delete(y); throw e; });
    firmPending.set(y, p); return p;
  }
  // Mark rules by zoom (base, s, cap, floor), the Moscow rasters' three extents: pixel marks with blocks below
  // 20 px per km (the region extent's rule), the city discs to 60, the downtown discs above.
  const MARK = { low: [1, 0.2, 3, 1.5], city: [2, 0.6, 8, 2], downtown: [3, 1.1, 11, 1.5] };
  const markRule = k => (k >= 60 ? MARK.downtown : k >= 20 ? MARK.city : MARK.low);
  const markRadius = (rule, n) => Math.max(rule[3], Math.min(rule[2], rule[0] + rule[1] * Math.sqrt(Math.max(0, n - 1))) / 2);
  const hex2rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const firmClass = (d, i, L) => (L === 'share' ? d.share[i] : L === 'fin' ? d.cls[i] : 0);
  const firmColour = (L, cl) => (L === 'share' ? theme.ramp6[cl] : L === 'fin' ? (cl ? theme.blue6[cl - 1] : theme.neutral) : theme.neutral);
  const firmPalette = L => (L === 'share' ? theme.ramp6 : L === 'fin' ? [theme.neutral].concat(theme.blue6) : [theme.neutral]).map(hex2rgb);
  function drawFirms(c) {
    const y = state.year, d = firmYears.get(y), L = state.layer;
    if (!d) {
      firmStatus = `Loading ${y} addresses…`;
      ensureYear(y).then(() => { if (state.mode === 'firms' && state.year === y) { firmStatus = null; drawMap(); } })
        .catch(e => { console.error(e); firmStatus = `Addresses for ${y} could not be loaded (${e.message}).`; if (state.mode === 'firms' && state.year === y) drawLegend(); });
      return;
    }
    firmStatus = null;
    const k = c.k, pad = markRadius(markRule(k), 65535) / k * 1000 + 1000;
    const i0 = lowerBound(d.x, (c.cx - c.ox / k) * 1000 - pad), i1 = lowerBound(d.x, (c.cx + (stage.width - c.ox) / k) * 1000 + pad);
    if (k < 20 || i1 - i0 > 120000) blitFirms(c, d, L, i0, i1); else discFirms(c, d, L, i0, i1);
    drawListed(c, y);
  }
  // Below 20 px per km: every address as a 1 px mark (2x2 and 3x3 blocks for 10 and 100 or more firms) composited
  // by hand into the map's device pixels, alpha rising with the count, so a million addresses draw in one pass.
  function blitFirms(c, d, L, i0, i1) {
    const W = mapC.width, H = mapC.height, sc = stage.scale, k = c.k;
    const img = mctx.getImageData(0, 0, W, H), px = img.data;
    const ax = (c.ox - c.cx * k) * sc, ay = (c.oy + c.cy * k) * sc, kk = k / 1000 * sc;
    const pal = firmPalette(L), dprI = Math.max(1, Math.round(sc)), X = d.x, Y = d.y, N = d.nn;
    for (let i = i0; i < i1; i++) {
      const n = N[i], bw = dprI * (n >= 100 ? 3 : n >= 10 ? 2 : 1);
      const bx = Math.floor(ax + X[i] * kk) - ((bw - 1) >> 1), by = Math.floor(ay - Y[i] * kk) - ((bw - 1) >> 1);
      if (bx >= W || by >= H || bx + bw <= 0 || by + bw <= 0) continue;
      const col = pal[firmClass(d, i, L)] || pal[0], r = col[0], g = col[1], b = col[2], a8 = n >= 100 ? 236 : n >= 10 ? 200 : n >= 2 ? 140 : 96, ia = 256 - a8;
      const x0 = bx < 0 ? 0 : bx, y0 = by < 0 ? 0 : by, x1 = bx + bw > W ? W : bx + bw, y1 = by + bw > H ? H : by + bw;
      for (let yy = y0; yy < y1; yy++) { let o = (yy * W + x0) * 4; for (let xx = x0; xx < x1; xx++, o += 4) { px[o] = (r * a8 + px[o] * ia) >> 8; px[o + 1] = (g * a8 + px[o + 1] * ia) >> 8; px[o + 2] = (b * a8 + px[o + 2] * ia) >> 8; } }
    }
    mctx.putImageData(img, 0, 0); stage.base();
  }
  // From 20 px per km: discs sized by the firms at the address, the largest first so small discs sit on big ones.
  function discFirms(c, d, L, i0, i1) {
    const k = c.k, rule = markRule(k), pad = markRadius(rule, 65535) / k * 1000 + 500;
    const ym0 = (c.cy - (stage.height - c.oy) / k) * 1000 - pad, ym1 = (c.cy + c.oy / k) * 1000 + pad;
    // the largest discs first, by a counting sort on the radius in tenths of a pixel (discs of equal radius may draw in any order)
    const buckets = []; for (let i = i0; i < i1; i++) { const yv = d.y[i]; if (yv < ym0 || yv > ym1) continue; const r10 = Math.round(markRadius(rule, d.nn[i]) * 10); (buckets[r10] || (buckets[r10] = [])).push(i); }
    const idx = []; for (let r10 = buckets.length - 1; r10 >= 0; r10--) if (buckets[r10]) for (const i of buckets[r10]) idx.push(i);
    const paths = new Map();
    for (const i of idx) {
      const r = markRadius(rule, d.nn[i]), [px, py] = Motion.project(c, d.x[i] / 1000, d.y[i] / 1000), cl = firmClass(d, i, L);
      let path = paths.get(cl); if (!path) { path = new Path2D(); paths.set(cl, path); }
      if (r < 1.75) path.rect(px - r, py - r, 2 * r, 2 * r); else { path.moveTo(px + r, py); path.arc(px, py, r, 0, Math.PI * 2); }
    }
    mctx.save(); mctx.globalAlpha = 0.9; for (const [cl, path] of paths) { mctx.fillStyle = firmColour(L, cl); mctx.fill(path); } mctx.restore();
  }
  // Listed firms on top: red from their listing year, a ring when the year's statement is absent; before that
  // year, a plain mark in the layer's colour for their own state.
  function drawListed(c, year) {
    const yi = year - 2014, rule = markRule(c.k), L = state.layer;
    for (let i = 0; i < TRN.n; i++) {
      const ch = TRN.filed[i][yi]; if (ch === '-') continue;
      const [px, py] = Motion.project(c, TRN.x[i], TRN.y[i]); if (px < -20 || px > stage.width + 20 || py < -20 || py > stage.height + 20) continue;
      const r = markRadius(rule, TRN.pile[i]);
      if (TRN.red_from[i] > year) {
        const st = TRN.state[i][yi], col = L === 'fin' && st >= '1' && st <= '6' ? theme.blue6[+st - 1] : L === 'share' ? theme.ramp6[ch === '1' ? 5 : 0] : theme.neutral;
        mctx.save(); mctx.globalAlpha = 0.9; mctx.fillStyle = col; mctx.beginPath(); mctx.arc(px, py, r, 0, Math.PI * 2); mctx.fill(); mctx.restore();
      } else MM.listedMark(mctx, px, py, r, ch === '1' ? 1 : 0, 1, theme);
    }
  }
  // Hover in firms mode: the nearest address within its mark radius plus 2 px, found through the sorted x column,
  // and the listed firms at the cursor; counts only, never a firm.
  function firmAt(km) {
    const c = cam(), k = c.k, rule = markRule(k), yi = state.year - 2014;
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
      if (best >= 0) { const [px, py] = Motion.project(c, d.x[best] / 1000, d.y[best] / 1000); Object.assign(out, { kind: 'firm', n: d.nn[best], a: d.a[best], f: d.f[best], cls: d.cls[best], px, py, r: br - 2 }); }
    }
    let ln = 0, lred = 0, lring = 0, lpx = 0, lpy = 0, lr = 0, ld = Infinity;
    for (let i = 0; i < TRN.n; i++) {
      const ch = TRN.filed[i][yi]; if (ch === '-') continue;
      const [px, py] = Motion.project(c, TRN.x[i], TRN.y[i]), r = markRadius(rule, TRN.pile[i]) + 2, dist = Math.hypot(px - km.px, py - km.py);
      if (dist > r) continue;
      ln++; if (TRN.red_from[i] <= state.year) { lred++; if (ch === '0') lring++; }
      if (dist < ld) { ld = dist; lpx = px; lpy = py; lr = r - 2; }
    }
    if (ln) { out.listed = { n: ln, red: lred, ring: lring, within_km: k < 20 ? (markRadius(rule, 1) + 2) / k : 0 }; if (out.kind === 'none') Object.assign(out, { kind: 'listed', px: lpx, py: lpy, r: lr }); }
    return out;
  }
  const hitAt = km => (state.mode === 'firms' ? firmAt(km) : cellAt(km));
  const breakLabels = (breaks, m) => Array.from({ length: m }, (_, i) => i === 0 ? `< ${breaks[0]}%` : i === m - 1 ? `≥ ${breaks[i - 1]}%` : `${breaks[i - 1]}–${breaks[i]}%`);

  // The legend and the note (24 October 2026): a title row with a toggle and a body, collapsible; collapsed by default
  // on a narrow map (under 600 px) and remembered per viewer; written only when the text changes.
  function readPref(key) { try { const v = localStorage.getItem(key); return v === 'open' || v === 'closed' ? v : null; } catch (e) { return null; } }
  function writePref(key, v) { try { localStorage.setItem(key, v); } catch (e) { /* no storage */ } }
  const ui = { legend: readPref('atlas-legend'), note: readPref('atlas-note') };
  const legendOpen = () => (ui.legend ? ui.legend === 'open' : stage.width >= 600);
  const noteOpen = () => (ui.note ? ui.note === 'open' : stage.width >= 600);
  function applyPanels() {
    const lo = legendOpen(), no = noteOpen();
    $('legendbody').hidden = !lo; const lt = $('legendtoggle'); lt.textContent = lo ? '▾' : '▸'; lt.setAttribute('aria-expanded', String(lo)); lt.setAttribute('aria-label', lo ? 'Collapse the legend' : 'Expand the legend');
    $('notebody').hidden = !no; $('notelabel').hidden = no; const nt = $('notetoggle'); nt.textContent = no ? '▾' : '▸'; nt.setAttribute('aria-expanded', String(no)); nt.setAttribute('aria-label', no ? 'Collapse the note' : 'Expand the note');
  }
  // On a narrow map (under 600 px) one panel is open at a time: opening the legend closes the note and the reverse.
  const narrow = () => stage.width < 600;
  function setLegend(v) { ui.legend = v; if (v === 'open' && narrow()) ui.note = 'closed'; applyPanels(); }
  function setNote(v) { ui.note = v; if (v === 'open' && narrow()) ui.legend = 'closed'; applyPanels(); }
  $('legendtoggle').addEventListener('click', () => { const v = legendOpen() ? 'closed' : 'open'; writePref('atlas-legend', v); setLegend(v); });
  $('notetoggle').addEventListener('click', () => { const v = noteOpen() ? 'closed' : 'open'; writePref('atlas-note', v); setNote(v); });
  const lastLegend = { title: null, html: null, note: null };
  function drawLegend() {
    const L = state.layer, c = cam(); const sw = col => `<span class="sw" style="background:${col}"></span>`;
    let title = '', html = '', note = '';
    if (state.mode === 'firms') {
      const y = state.year, by = FM.by_year[y], ys = y + (y === 2025 ? '*' : '');
      const ring = `<span class="sw" style="background:transparent;border:2px solid ${theme.treated};box-sizing:border-box"></span>`;
      if (L === 'share') { title = `<b>Firms at registered addresses, ${ys}</b>`; html = `<div class="row">Colour: share of the firms at the coordinate pair with a ${ys} statement</div>` + theme.ramp6.map((col, i) => `<div class="row">${sw(col)}${breakLabels(YEAR_BREAKS, 6)[i]}</div>`).join('') + '<div class="row">A single firm shows the first colour (no statement) or the last (statement available).</div>'; }
      else if (L === 'fin') { title = `<b>Firms on no list (comparison group), ${ys}</b>`; html = `<div class="row">Colour: real revenue change since the firm’s own 2019–2021 average, minus the year’s median change</div>` + theme.blue6.map((col, i) => `<div class="row">${sw(col)}${CLASS_LABELS[i]}</div>`).join('') + `<div class="row">${sw(theme.neutral)}no firm at the coordinate pair has a usable baseline</div>`; }
      else { title = `<b>Firms at registered addresses, ${ys}</b>`; html = `<div class="row">${sw(theme.neutral)}every coordinate pair (this layer is a cell layer)</div>`; }
      html += `<div class="row">${sw(theme.treated)}Firm on one of the five lists (treated), red from its listing year.</div><div class="row">${ring}listed (treated), no statement that year</div><div class="row">${c.k >= 20 ? 'Each dot is one coordinate pair. Larger dots hold more firms.' : 'Each dot is one coordinate pair. Dots widen at 10 and 100 or more firms.'}</div>`;
      note = firmStatus || `${fmt.int(by.firms)} firms on no list (comparison group) at ${fmt.int(by.addresses)} distinct coordinate pairs; ${fmt.int(by.listed)} firms on these lists (treated). ${fmt.int(by.city_level)} firms with other geocodes are not drawn.`;
    } else if (L === 'density') {
      title = '<b>Firms per cell</b> (' + (c.k < 1.5 ? '5 km' : c.k < 24 ? '1 km' : '250 m') + ')';
      html = MM.countClassLabels.map((lab, i) => `<div class="row">${sw(hexAlpha(theme.density, MM.countAlpha[i]))}${lab}</div>`).join('');
      note = `${fmt.int(F.located_2021)} located eligible firms at ${fmt.int(F.distinct_locations)} distinct coordinate pairs in 2021 (${fmt.int(F.eligible_firms_2021)} eligible); the most shared coordinate pair holds ${fmt.int(F.largest_location_firms)} firms.`;
    } else if (L === 'share') {
      const near = nearestCity(c).city.label, hasWin = state.year === 2021 ? !!win1[near] : !!(cityYear[near] && cityYear[near][state.year]);
      const fine = c.k >= 1.5 && hasWin, grid25 = alpha25(c.k) >= 0.5 && !!c25[state.year];
      const breaks = fine ? FINE_BREAKS : YEAR_BREAKS, ramp = fine ? theme.ramp5 : theme.ramp6;
      const labels = ramp.map((_, i) => i === 0 ? `< ${breaks[0]}%` : i === ramp.length - 1 ? `≥ ${breaks[i - 1]}%` : `${breaks[i - 1]}–${breaks[i]}%`);
      title = `<b>Share with a statement, ${state.year}</b> (${fine ? (c.k < 24 ? '1 km' : '250 m') : grid25 ? '25 km' : '100 km'} cells)`;
      html = ramp.map((col, i) => `<div class="row">${sw(col)}${labels[i]}</div>`).join('') + `<div class="row">${sw(theme.below)}fewer than 50 firms, share not shown</div>`;
      const t = totals[state.year]; note = t ? `${state.year}${state.year === 2025 ? '*' : ''}: ${fmt.pct(t.share)} of ${fmt.int(t.eligible)} eligible firms have a statement; ${fmt.pct(t.located_share)} located. Provider: ${state.year <= 2018 ? 'Rosstat' : 'FNS'}.` : '';
      if (fine && state.year !== 2021 && c.k >= 24) note += ' 250 m cells exist for 2021 only.';
    } else if (L === 'change') {
      const labels = ['≤ −5 points', '−5 to −2', '−2 to 0', '0 to +2', '+2 to +5', '> +5 points'];
      const grid25 = chg25 && alpha25(c.k) >= 0.5, counts = grid25 ? C25.change.class_cells : C100.change_classes.cells;
      title = `<b>Change in the share, 2024 against 2021</b> (${grid25 ? '25' : '100'} km cells)`;
      html = [5, 4, 3, 2, 1, 0].map(i => `<div class="row">${sw(theme.change6[i])}${labels[i]} (${fmt.int(counts[i])} cells)</div>`).join('') + `<div class="row">${sw(theme.below)}fewer than 50 firms in a year</div>`;
      note = `${fmt.int(grid25 ? C25.change.supported : 658)} supported cells; located share ${fmt.pct(C100.change_totals.availability_share_percent[0])} → ${fmt.pct(C100.change_totals.availability_share_percent[1])}. Annual populations at registered addresses, not the same firms.`;
    } else if (L === 'cohort') {
      title = '<b>Revenue cohort by cash share: inclusion per cell</b>';
      html = theme.ramp5.map((col, i) => `<div class="row">${sw(col)}${C100.cohort_class_labels[i]}</div>`).join('') + `<div class="row">${sw(theme.below)}fewer than 50 eligible firms</div>`;
      note = `${fmt.int(F.cohorts.revenue_cash)} cohort firms; located cohort firms over located eligible firms per 2021 cell; pooled quintile classes.` + (c.k >= 1.5 ? ' 100 km cells are this layer’s finest resolution.' : '');
    } else if (L === 'lists') {
      // Three classes, the ones listClass draws (ramp5[2], [3], [4]), each with its cell count; 1 to 4 members show no count.
      const grid25 = c25[2021] && alpha25(c.k) >= 0.5, counts = grid25 ? list25Counts : listClassCounts;
      title = `<b>Sanctions-list members (treated) per ${grid25 ? '25' : '100'} km cell, 2021</b>`;
      html = ['5–19', '20–49', '≥ 50'].map((lab, i) => `<div class="row">${sw(theme.ramp5[i + 2])}${lab} located members (${fmt.int(counts[i + 1])} cells)</div>`).join('');
      note = 'Memberships are fixed. Cells with 1 to 4 members show no count. The hover gives the government strategic list (treated) separately.';
    } else if (L === 'fin') {
      const labels = ['≤ −20%', '−20 to −10%', '−10 to 0%', '0 to +10%', '+10 to +20%', '> +20%'];
      title = '<b>Median real revenue, 2024 against 2021 (descriptive)</b>';
      html = [5, 4, 3, 2, 1, 0].map(i => `<div class="row">${sw(theme.change6[i])}${labels[i]}</div>`).join('');
      note = 'Revenue cohort by cash share; cells with 50 or more observed firms; composition changes with observation.' + (c.k >= 1.5 ? ' 100 km cells are this layer’s finest resolution.' : '');
    }
    if (title !== lastLegend.title) { $('legendtitle').innerHTML = title; lastLegend.title = title; }
    if (html !== lastLegend.html) { $('legendbody').innerHTML = html; lastLegend.html = html; }
    if (note !== lastLegend.note) { $('notebody').textContent = note; $('mapnote').hidden = !note; lastLegend.note = note; }
    applyPanels();
  }
  function hexAlpha(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }

  // ---- hover ------------------------------------------------------------------------------------
  function kmAt(ev) { const r = wrap.getBoundingClientRect(); const c = cam(); const x = ev.clientX - r.left, y = ev.clientY - r.top; return { x: c.cx + (x - c.ox) / c.k, y: c.cy - (y - c.oy) / c.k, px: x, py: y }; }
  function regionAt(px, py) { const c = cam(); mctx.save(); Motion.camTransform(mctx, stage, c); let name = null; const dx = px * stage.scale, dy = py * stage.scale; for (const p of partPaths) { if (mctx.isPointInPath(p.path, dx, dy, 'evenodd')) { name = p.name; break; } } mctx.restore(); stage.base(); return name; }
  function cellAt(km) {
    const c = cam(); const L = state.layer; const ix = Math.floor(km.x / 100), iy = Math.floor(km.y / 100), key = cellKey(ix, iy);
    const out = { ix, iy, grid: 100, region: regionAt(km.px, km.py), kmx: km.x, kmy: km.y };
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
    if (alpha25(c.k) >= 0.5 && (L === 'share' || L === 'change' || L === 'lists')) {   // the 25 km cells (M10)
      const jx = Math.floor(km.x / G25), jy = Math.floor(km.y / G25), k25 = cellKey(jx, jy);
      out.grid = G25; out.ix = jx; out.iy = jy;
      if (L === 'share') { const d = c25[state.year]; if (d) { const i = d.map.get(k25); if (i != null) Object.assign(out, { n: d.n[i], a: d.a[i], ns: d.ns[i] > 0 ? d.ns[i] : null }); } }
      else if (L === 'change') { if (chg25) { const i = chg25.map.get(k25); if (i != null) Object.assign(out, { n21: chg25.n21[i], a21: chg25.a21[i], n24: chg25.n24[i], a24: chg25.a24[i], change: chg25.pp[i] / 1000, supported: chg25.cls[i] > 0 }); } }
      else { const d = c25[2021]; if (d) { const i = d.map.get(k25); if (i != null) Object.assign(out, { n: d.n[i], sanctioned: d.ns[i] >= 5 ? d.ns[i] : null, gov: d.ng && d.ng[i] >= 5 ? d.ng[i] : null }); } }
      return out;
    }
    if (L === 'share') { const d = yearCells[state.year].get(key); if (d) Object.assign(out, { n: d.n, a: d.a, nr: d.nr, ar: d.ar, ns: d.ns }); }
    else if (L === 'change') { const i = chgMap.get(key); if (i != null) Object.assign(out, { n21: chg.n21[i], a21: chg.a21[i], n24: chg.n24[i], a24: chg.a24[i], change: chg.change_pp[i], supported: chg.supported[i] }); }
    else if (L === 'cohort') { const i = cohMap.get(key); if (i != null) Object.assign(out, { n: coh.n[i], c: coh.c[i], pct: coh.pct[i], supported: coh.supported[i] }); }
    else if (L === 'lists') { const i = listMap.get(key); if (i != null) Object.assign(out, { n: lists.n[i], sanctioned: lists.sanctioned[i], gov: lists.govstrategic[i] }); }
    else if (L === 'fin') { const i = finMap.get(key); if (i != null) Object.assign(out, { n_base: fin.n_base[i], n_obs: fin.n_obs[i], change: fin.change_pct[i] }); }
    return out;
  }
  const band = n => (n < 10 ? 'fewer than 10' : fmt.int(n));
  function tipText(h) {
    const L = state.layer; const lines = [];
    if (h.region) lines.push(`<b>${h.region}</b>`);
    if (h.kind === 'firm' || h.kind === 'listed' || h.kind === 'none') {
      if (h.kind === 'firm') {
        lines.push(`Coordinate pair: ${fmt.int(h.n)} located firm${h.n === 1 ? '' : 's'}, ${fmt.int(h.a)} with a ${state.year} statement` + (h.n > 1 ? ` (${fmt.pct(100 * h.a / h.n)})` : ''));
        if (state.layer === 'fin') lines.push(h.f ? `${fmt.int(h.f)} with a baseline and a value; median change ${CLASS_LABELS[h.cls - 1]}` : 'No firm with a usable baseline and a value');
      }
      if (h.listed) lines.push(`${fmt.int(h.listed.n)} firm${h.listed.n === 1 ? '' : 's'} on one of the five lists (treated) ${h.listed.within_km ? `within ${h.listed.within_km < 1 ? Math.round(h.listed.within_km * 1000) + ' m' : fmt.dec(h.listed.within_km, 1) + ' km'} of the cursor` : 'at this coordinate pair'}: ${fmt.int(h.listed.red)} red this year` + (h.listed.ring ? `, ${fmt.int(h.listed.ring)} without a ${state.year} statement` : ''));
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
    if (!h) return; const c = cam();
    if (h.kind === 'firm' || h.kind === 'listed') { octx.strokeStyle = theme.ink; octx.lineWidth = 2; octx.beginPath(); octx.arc(h.px, h.py, h.r + 3, 0, Math.PI * 2); octx.stroke(); return; }
    if (h.kind === 'none') return;
    const g = h.grid, o = h.origin || [0, 0];
    const x0 = o[0] + Math.floor((h.kmx - o[0]) / g) * g, y0 = o[1] + Math.floor((h.kmy - o[1]) / g) * g;
    const [px, py] = Motion.project(c, x0, y0 + g); const s = g * c.k;
    octx.strokeStyle = theme.ink; octx.lineWidth = 2; octx.strokeRect(px, py, s, s);
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
    cancelFlight();
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
  function afterCameraMove() { syncZoomButtons(); refreshHover(); }

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
      const has = state.layer === 'density' ? yearCells[2021].has(cellKey(ix, iy)) : (h.n != null || h.n21 != null || h.n_base != null || h.sanctioned != null || h.gov != null || h.c != null);
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
  function hideHover() { $('tip').style.display = 'none'; state.hover = null; drawOverlay(null); wrap.classList.remove('clickable', 'zoomable'); }
  function syncCursor(h) {
    const r = h && !press ? ladderTarget(h, kmFromPx(h.px0, h.py0), false) : null;
    wrap.classList.toggle('clickable', !!r && r.rung !== 'zoom'); wrap.classList.toggle('zoomable', !!r && r.rung === 'zoom');
  }
  function showHoverAt(x, y) {
    const km = kmFromPx(x, y); const h = hitAt(km); h.kmx = km.x; h.kmy = km.y; h.px0 = x; h.py0 = y; state.hover = h;
    const tip = $('tip'); tip.innerHTML = tipText(h); tip.style.display = 'block';
    // to the right of the cursor, or to its left when that would reach the zoom column at the right edge
    const tw = tip.offsetWidth, th = tip.offsetHeight; let left = x + 14; if (left + tw > stage.width - 72) left = x - 14 - tw;
    left = Math.max(0, Math.min(left, stage.width - tw - 1));
    tip.style.left = left + 'px'; tip.style.top = Math.max(0, Math.min(y - 10, stage.height - th - 4)) + 'px';
    drawOverlay(h); drawCellPanel(h); syncCursor(h);
    return h;
  }
  function refreshHover() { if (press || pinch || flight || !lastPointer || !lastPointer.inside) return; showHoverAt(lastPointer.x, lastPointer.y); }
  function startPinch() { const [p, q] = [...pointers.values()]; const c = cam(); const mid = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }; return { d0: Math.max(1, Math.hypot(p.x - q.x, p.y - q.y)), k0: c.k, km: { x: c.cx + (mid.x - c.ox) / c.k, y: c.cy - (mid.y - c.oy) / c.k } }; }
  function movePinch() { const [p, q] = [...pointers.values()]; const d = Math.hypot(p.x - q.x, p.y - q.y), mid = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }; const k2 = clampK(pinch.k0 * d / pinch.d0); state.cam = { cx: pinch.km.x - (mid.x - stage.width / 2) / k2, cy: pinch.km.y + (mid.y - stage.height / 2) / k2, k: k2 }; requestDraw(); }
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
      if (press.moved) { const c = cam(); state.cam.cx -= (p.x - press.last.x) / c.k; state.cam.cy += (p.y - press.last.y) / c.k; press.last = p; requestDraw(); }
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
    lastTap = { x: p.x, y: p.y, t: now }; lastPointer = { x: p.x, y: p.y, inside: true }; showHoverAt(p.x, p.y);
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
    const km = kmAt(ev); const f = Math.exp(-dy * (ev.ctrlKey ? PINCH_RATE : WHEEL_RATE)); const k2 = clampK(state.cam.k * f);
    if (ev.pointerType !== 'touch') lastPointer = { x: km.px, y: km.py, inside: true };
    hideHover();
    if (atFloor(k2)) { flyTo(fitTarget(), { duration: 300 }); return; }   // fully zoomed out: settle on the country's centre
    state.cam.cx = km.x - (km.px - stage.width / 2) / k2; state.cam.cy = km.y + (km.py - stage.height / 2) / k2; state.cam.k = k2;
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
    const k = state.cam.k; let len = SCALE_STEPS[0]; for (const s of SCALE_STEPS) { len = s; if (s * k <= 84) break; }   // at most 84 px: the bar stays inside the right-hand column
    const px = Math.round(len * k * 10) / 10, label = len >= 1 ? `${fmt.int(len)} km` : `${Math.round(len * 1000)} m`, key = px + label;
    if (key === lastScale) return; lastScale = key;
    $('scalebar').querySelector('.bar').style.width = px + 'px'; $('scalebar').querySelector('.lab').textContent = label;
  }

  // ---- side panels -------------------------------------------------------------------------------
  function chartCtx(id) { const c = $(id); const r = c.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1; c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr); const ctx = c.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, r.width, r.height); Motion.audit.scene = id; window.__atlasCanvases[id] = { w: r.width, h: r.height }; return { ctx, w: r.width, h: r.height }; }
  function drawCellPanel(h) {
    const info = $('cellinfo'); const rows = [];
    if (h && h.region) rows.push(['Region', h.region]);
    if (h && h.kind === 'firm') rows.push(['Coordinate pair', `${fmt.int(h.n)} firm${h.n === 1 ? '' : 's'}`]);
    if (h && (h.fine || h.n != null || h.n21 != null || h.n_base != null)) rows.push(['Cell', h.fine ? (h.grid < 1 ? '250 m' : h.grid + ' km') : `${h.grid} km (${h.ix}, ${h.iy})`]);
    info.innerHTML = rows.length ? rows.map(([k, v]) => `<span>${k}</span><b>${v}</b>`).join('') : '<span>Hover a cell</span><b></b>';
    const { ctx, w, hgt = 0 } = chartCtx('cellchart'); const hh = $('cellchart').getBoundingClientRect().height;
    if (!h) return;
    const note = t => Motion.text(ctx, t, 8, 24, { size: 13, color: theme.muted });
    const chart = (pts, xDomain, xTicks, eras, caption) => {
      CH.lines(ctx, { x: 44, y: 14, w: w - 100, h: hh - 52 }, [{ label: '{y}', color: theme.accent, points: pts, gapAfter: [2018] }], { xDomain, yDomain: [0, 100], theme, yTicks: [0, 50, 100], xTicks, xFmt: v => (v === 2025 ? "25*" : String(v).slice(2)), labelSize: 12, lineWidth: 2, eras, yFmt: v => v + '%', axisSize: 12, axisDy: 20 });
      Motion.text(ctx, caption, 44, hh - 2, { size: 11, color: theme.dim });
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
    const margin = Motion.measure(ctx, 'registered ' + Motion.fmt.pct(reg[reg.length - 1].y, 1), 12, 600) + 22;
    const r = CH.lines(ctx, { x: 44, y: 14, w: w - 44 - margin, h: hh - 44 }, [{ label: 'registered {y}', color: theme.accentStrong, points: reg, gapAfter: [2018], width: 2 }, { label: 'eligible {y}', color: theme.accent, points: el, gapAfter: [2018], width: 2 }],
      { xDomain: [2011.5, 2025.5], yDomain: [0, 80], theme, yTicks: [0, 40, 80], xTicks: [2012, 2016, 2020, 2024], labelSize: 12, dots: false, eras: [{ from: 2018.5, to: 2025.5, color: theme.highlightBand }], yFmt: v => v + '%', labelFmt: v => Motion.fmt.pct(v, 1), axisSize: 12, axisDy: 20, spreadLabels: true });
    if (state.layer === 'share') { const x = r.sx(state.year); ctx.strokeStyle = theme.ink; ctx.lineWidth = 1.5; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(x, 14); ctx.lineTo(x, hh - 30); ctx.stroke(); ctx.setLineDash([]); }
    $('natprov').textContent = 'Table B.1: statements over the annual eligible population and over firms registered at year-end; 2011 has no statements, 2025* is flagged. Source ' + S.sources.avail + '.';
  }
  function drawGroups() {
    const { ctx, w } = chartCtx('groupchart'); const hh = $('groupchart').getBoundingClientRect().height;
    const items = [{ label: 'Joint-stock', a: F.legal.joint_stock[0], b: F.legal.joint_stock[1], color: theme.accent }, { label: 'State-related', a: F.own.state[0], b: F.own.state[1], color: theme.fall }, { label: 'Private', a: F.own.private[0], b: F.own.private[1], color: theme.accent }, { label: 'Unitary', a: F.legal.unitary[0], b: F.legal.unitary[1], color: theme.fall }];
    CH.slopes(ctx, { x: 8, y: 30, w: w - 16, h: hh - 48 }, items, { yDomain: [44, 82], theme, size: 12, leftMargin: 150, rightMargin: 70, spread: true });
    $('groupprov').textContent = 'Share of eligible firms with a statement by ownership and legal form (Figures 2.2 and 2.3 sources); population comparisons by year, not the same firms.';
  }
  function drawOdds() {
    const { ctx, w } = chartCtx('oddschart'); const hh = $('oddschart').getBoundingClientRect().height;
    const sz = {}; for (let i = 0; i < S.size.year.length; i++) if (S.size.era[i] === 'recent') (sz[S.size.quintile[i]] = sz[S.size.quintile[i]] || []).push({ x: S.size.year[i], y: S.size.or[i], low: S.size.low[i], high: S.size.high[i] });
    const ls = []; for (let i = 0; i < S.lists.year.length; i++) if (S.lists.model[i] === 'annual-eligible-membership' && S.lists.contrast[i] === 'sanctioned_only' && S.lists.comparison[i] === 'level' && S.lists.year[i] != null) ls.push({ x: S.lists.year[i], y: S.lists.or[i], low: S.lists.low[i], high: S.lists.high[i] });
    // The right margin fits the longest end label (measured, as drawNational does): the label starts 22 px past the last point and ends 8 px inside the canvas.
    const listLabel = 'sanctions list (treated)', right = Motion.measure(ctx, listLabel, 12, 600) + 30;
    CH.yearDots(ctx, { x: 40, y: 10, w: w - right, h: hh - 44 }, [{ label: 'Q5 vs Q1', color: theme.accentStrong, points: sz.Q5 || [], whiskers: true, dot: 4, width: 2 }, { label: 'Q2 vs Q1', color: theme.accent, points: sz.Q2 || [], dot: 3, width: 1.5 }, { label: listLabel, color: theme.fall, points: ls, whiskers: true, dot: 4, width: 2 }],
      { xDomain: [2019, 2024], yDomain: [0.3, 5], yTicks: [0.5, 1, 2, 4], theme, size: 12, thinTicks: true, spreadLabels: true });
    $('oddsprov').textContent = `Adjusted odds of a statement: asset quintiles Q5 and Q2 against Q1 (Table B.4; 2022 vs 2021 Q5 ratio ${fmt.dec(F.size_q5_2022_ratio, 3)} [${fmt.dec(F.size_q5_2022_low, 3)}, ${fmt.dec(F.size_q5_2022_high, 3)}], provisional) and firms on the sanctions list only (treated) against firms on no list (comparison group) (Table B.7), two-way 95% intervals.`;
  }
  function redrawAll() { sizeCanvases(); drawMap(); drawCellPanel(state.hover); drawNational(); drawGroups(); drawOdds(); syncZoomButtons(); }

  // ---- controls -------------------------------------------------------------------------------------
  const layersEl = $('layers');
  // Firms view provenance (author's wording standard, 24 October 2026): the geocode categories defined once, the shared-registration text verbatim.
  const FIRMS_PROV = 'Firms view: every located eligible firm on no list (comparison group) with a house- or street-level geocode, drawn at its registered address and grouped by coordinate pair (M9 pass over the foundation registry and payload, one record per coordinate pair and year); firms on at least one of the five lists (treated) from the national pass (M8), red from their listing year. Other geocodes, coordinates without a verified house or street match, are counted and not drawn. Most located firms have a house- or street-level address match. The remaining geocodes have unverified precision. Registered legal addresses can be shared business centres or addresses rented for registration and correspondence, rather than production premises. Several firms can therefore share one registered address. The Federal Tax Service tracks mass-registration addresses.';
  const syncProv = () => { $('layerprov').textContent = state.mode === 'firms' ? FIRMS_PROV : LAYERS.find(x => x.id === state.layer).prov; };
  LAYERS.forEach(L => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.textContent = L.label; b.dataset.id = L.id; b.setAttribute('aria-pressed', String(L.id === state.layer)); b.addEventListener('click', () => { state.layer = L.id; layersEl.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.id === L.id))); syncYearRow(); syncProv(); drawMap(); drawNational(); }); layersEl.appendChild(b); });
  function syncYearRow() { $('yearrow').hidden = !(state.mode === 'firms' || state.layer === 'share'); }
  // The view switch (round 5): cells as before, or every registered address as a mark.
  const modesEl = $('modes');
  if (FIRMS_OK) {
    const lab = document.createElement('span'); lab.className = 'modelabel'; lab.textContent = 'View'; modesEl.appendChild(lab);
    [['cells', 'Cells'], ['firms', 'Firms']].forEach(([m, label]) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.textContent = label; b.dataset.mode = m; b.setAttribute('aria-pressed', String(m === state.mode)); b.addEventListener('click', () => { if (state.mode === m) return; state.mode = m; syncProv(); modesEl.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.mode === m))); hideHover(); syncYearRow(); drawMap(); drawCellPanel(null); }); modesEl.appendChild(b); });
  } else modesEl.hidden = true;
  $('layerprov').textContent = LAYERS[1].prov;
  $('year').addEventListener('input', () => { state.year = +$('year').value; $('yearlabel').textContent = state.year + (state.year === 2025 ? '*' : ''); drawMap(); drawNational(); });
  const presets = $('presets');
  // Presets hold a target camera: the button flies there, the audit API jumps, a link's anchor opens there.
  const PRESETS = [];
  const slugOf = label => label.replace(/\s*\(.*\)$/, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const addPreset = (label, target) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.textContent = label; b.addEventListener('click', () => flyTo(target())); presets.appendChild(b); PRESETS.push({ label, slug: slugOf(label), target, button: b }); };
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
  function onResize() { const w0 = stage.width; sizeCanvases(); if (w0 > 0 && stage.width !== w0) state.cam.k *= stage.width / w0; redrawAll(); syncZoomButtons(); refreshHover(); }
  window.addEventListener('resize', onResize);
  // The overlays' boxes relative to the map, for the audit's DOM check.
  function domBoxes() {
    const m = wrap.getBoundingClientRect();
    const rel = id => { const el = $(id); const r = el.getBoundingClientRect(); const visible = !el.hidden && getComputedStyle(el).display !== 'none' && r.width > 0 && r.height > 0; return { x: r.left - m.left, y: r.top - m.top, x1: r.right - m.left, y1: r.bottom - m.top, visible }; };
    return { map: { x: 0, y: 0, x1: m.width, y1: m.height, visible: true }, legend: rel('legend'), note: rel('mapnote'), zoom: rel('zoombox'), scale: rel('scalebar'), tip: rel('tip') };
  }
  // Driven by tools/atlas-audit.py: switch the layer and the year, redraw, and hand back the text boxes, the overlays'
  // boxes and the camera; the camera moves here are instant.
  window.__atlas = {
    layers: LAYERS.map(L => L.id),
    layer(id) { const b = layersEl.querySelector(`button[data-id="${id}"]`); if (b) b.click(); },
    year(y) { $('year').value = String(y); $('year').dispatchEvent(new Event('input')); },
    redraw() { Motion.audit.boxes = []; Motion.audit.seq = 0; redrawAll(); return { boxes: Motion.audit.boxes, dom: domBoxes() }; },
    camera() { return { cx: state.cam.cx, cy: state.cam.cy, k: state.cam.k }; },
    kFit() { return kFit(); },
    preset(label) { const p = PRESETS.find(p => p.label === label); if (!p) return false; flyTo(p.target(), { instant: true }); return true; },
    hoverKm(x, y, opts) { const c = cam(); const px = c.ox + (x - c.cx) * c.k, py = c.oy - (y - c.cy) * c.k; let h; if (opts && opts.show && px >= 0 && px < stage.width && py >= 0 && py < stage.height) { lastPointer = { x: px, y: py, inside: true }; h = showHoverAt(px, py); } else { const km = { x, y, px, py }; h = hitAt(km); h.kmx = x; h.kmy = y; state.hover = h; } return { kind: h.kind || 'cell', grid: h.grid, fine: !!h.fine, n: h.n == null ? null : h.n, listed: h.listed || null }; },
    click(x, y, opts) { const c = cam(); const p = { x, y, px: c.ox + (x - c.cx) * c.k, py: c.oy - (y - c.cy) * c.k }; const h = hitAt(p); h.kmx = x; h.kmy = y; const r = ladderTarget(h, p, !!(opts && opts.shift)); return (r ? flyTo(r.target, { instant: true }) : Promise.resolve()).then(() => Object.assign(this.camera(), { moved: !!r, rung: r ? r.rung : null })); },
    zoom(dir) { return flyTo(dir > 0 ? stepCentre(2) : dir < 0 ? stepCentre(0.5) : fitTarget(), { instant: true }).then(() => this.camera()); },
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
    ready() { return state.mode === 'firms' ? ensureYear(state.year).then(() => {}) : Promise.resolve(); },
    cities: Object.fromEntries(bmp.cities.map(c => [c.label, [c.x, c.y]])),
  };
  document.fonts.ready.then(() => { sizeCanvases(); const hp = presetFromHash(); state.cam = hp ? hp.preset.target() : fitTarget(); syncThemeButton(); if (hp && hp.firms && FIRMS_OK) window.__atlas.mode('firms'); redrawAll(); syncZoomButtons(); });
})();
