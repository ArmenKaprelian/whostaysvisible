// Visibility atlas: an interactive explorer over the same aggregates as the explainer. State lives
// in the page; the map redraws on every state change; every panel names its source.
(function () {
  'use strict';
  const D = window.MOTION_DATA, S = D.series, C100 = D.cells100, DEN = D.density, BM = D.basemap, CY = D.cellsyears;
  const F = S.facts, fmt = Motion.fmt, MM = MotionMap, CH = MotionCharts;
  const $ = id => document.getElementById(id);

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
             density: dark ? '#7FCDBB' : '#16436E' };
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
  const natPaths = MM.buildDensityPaths(nat, FINE_BREAKS);
  const win1 = {}, win025 = {};
  for (const [label, w] of Object.entries(DEN.windows_1km)) { const d = MM.decodeDensity(w); win1[label] = { d, paths: MM.buildDensityPaths(d, FINE_BREAKS), cx: w.origin[0] + 45, cy: w.origin[1] + 45 }; }
  for (const [label, w] of Object.entries(DEN.windows_250m)) { const d = MM.decodeDensity(w); win025[label] = { d, paths: MM.buildDensityPaths(d, FINE_BREAKS), cx: w.origin[0] + 12, cy: w.origin[1] + 12 }; }
  const cityYear = {};   // label -> year -> {d, paths}
  for (const w of CY.city_1km) { const d = MM.decodeDensity(w); (cityYear[w.label] = cityYear[w.label] || {})[w.year] = { d, paths: MM.buildDensityPaths(d, FINE_BREAKS) }; }
  const years = CY.mapped_years;
  const yearIndex = {}; CY.avail.year.forEach((y, i) => { (yearIndex[y] = yearIndex[y] || []).push(i); });
  const cellKey = (ix, iy) => iy * 65536 + ix;
  const yearCells = {};   // year -> Map key -> {n, a, nr, ar, ns}
  for (const y of years) { const m = new Map(); for (const i of yearIndex[y]) m.set(cellKey(CY.avail.ix[i], CY.avail.iy[i]), { n: CY.avail.n[i], a: CY.avail.a[i], nr: CY.avail.nr[i], ar: CY.avail.ar[i], ns: CY.avail.ns[i] }); yearCells[y] = m; }
  const totals = {}; CY.totals.year.forEach((y, i) => totals[y] = { eligible: CY.totals.n[i], located: CY.totals.n_located[i], share: CY.totals.eligible_share[i], located_share: CY.totals.located_share[i] });
  const chg = C100.change, chgMap = new Map(); for (let i = 0; i < chg.ix.length; i++) chgMap.set(cellKey(chg.ix[i], chg.iy[i]), i);
  const coh = C100.cohort, cohIdx = [], cohMap = new Map(); for (let i = 0; i < coh.ix.length; i++) if (coh.outcome[i] === 'revenue' && coh.moderator[i] === 'cash') { cohIdx.push(i); cohMap.set(cellKey(coh.ix[i], coh.iy[i]), i); }
  const lists = C100.lists, listMap = new Map(); for (let i = 0; i < lists.ix.length; i++) listMap.set(cellKey(lists.ix[i], lists.iy[i]), i);
  const fin = C100.fin, finIdx = [], finMap = new Map(); for (let i = 0; i < fin.ix.length; i++) if (fin.outcome[i] === 'revenue' && fin.moderator[i] === 'cash' && fin.year[i] === 2024) { finIdx.push(i); finMap.set(cellKey(fin.ix[i], fin.iy[i]), i); }
  const tileCache = new Map();
  function tiles(key, build) { if (!tileCache.has(key)) tileCache.set(key, build()); return tileCache.get(key); }
  const classOfShare = (n, a, breaks) => { if (n < 50) return 'below'; const s = 100 * a / n; let c = 0; while (c < breaks.length && s >= breaks[c]) c++; return c; };
  const listClass = v => (v == null ? null : v >= 50 ? 3 : v >= 20 ? 2 : v >= 5 ? 1 : 0);

  // ---- state -----------------------------------------------------------------------------------
  const NAT = { cx: (BM.extents.national.x[0] + BM.extents.national.x[1]) / 2, cy: (BM.extents.national.y[0] + BM.extents.national.y[1]) / 2 };
  const state = { layer: 'share', year: 2021, cam: { cx: NAT.cx, cy: NAT.cy, k: 0.2 }, hover: null };
  const LAYERS = [
    { id: 'density', label: 'Firm density, 2021', prov: 'Located eligible firms at registered addresses in 2021, counted per 5 km cell nationally and per 1 km and 250 m cell in city windows (M3 pass over the production point layer). Shares are shown only for cells with 50 or more firms.' },
    { id: 'share', label: 'Statement share by year', prov: 'Share of located eligible firms with an original statement, per 100 km cell, financial years 2014 to 2025 (M5 pass over the foundation registry and payload partitions, production projection and located rule; 2012 and 2013 carry no coordinates). City windows at 1 km for 2019 to 2024.' },
    { id: 'change', label: 'Change, 2024 vs 2021', prov: 'Figure 2.7 lower panel: change in the located share with a statement, 2024 against 2021, 100 km cells with 50 or more located firms in both years; six classes at ±2 and ±5 points (presentation-finalization-20261019/data/availability-change-cells.csv).' },
    { id: 'cohort', label: 'Cohort inclusion', prov: 'Figure 2.8: share of a cell’s located eligible firms (2021) in the revenue cohort by cash share, pooled quintile classes of supported cells (candidate-02-cell-source.csv; cutpoints 33.3, 38.3, 43.0, 47.6%).' },
    { id: 'lists', label: 'Supplied-list members, 2021', prov: 'Located members of the sanctions list and the government strategic list per 100 km cell in 2021 (geography-review-20261006 cells); cells with fewer than 5 members of a list show no count. Supplied lists are fixed memberships, not dated designations.' },
    { id: 'fin', label: 'Median revenue change (descriptive)', prov: 'Percent change of each cell’s median real revenue among the revenue-by-cash cohort firms observed in 2024, against the cell’s 2021 median; cells with 50 or more observed firms (pass2-reconcile geo-revenue-change-from-2021-source.csv). Descriptive: composition changes with observation; not a Chapter 3 estimate.' },
  ];

  // ---- map canvas ------------------------------------------------------------------------------
  const wrap = $('mapwrap'), mapC = $('map'), ovC = $('overlay'), mctx = mapC.getContext('2d'), octx = ovC.getContext('2d');
  const stage = { width: 0, height: 0, scale: 1, base() { mctx.setTransform(stage.scale, 0, 0, stage.scale, 0, 0); } };
  function sizeCanvases() {
    const r = wrap.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    stage.width = Math.max(1, Math.round(r.width)); stage.height = Math.max(1, Math.round(r.height)); stage.scale = dpr;
    for (const c of [mapC, ovC]) { c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr); }
  }
  const cam = () => ({ cx: state.cam.cx, cy: state.cam.cy, k: state.cam.k, ox: stage.width / 2, oy: stage.height / 2 });
  function fitNational() { state.cam = { cx: NAT.cx, cy: NAT.cy, k: Math.min(stage.width / (BM.extents.national.x[1] - BM.extents.national.x[0]), stage.height / (BM.extents.national.y[1] - BM.extents.national.y[0])) * 0.96 }; }
  function nearestCity(c) { let best = null, bd = Infinity; for (const city of bmp.cities) { const d = Math.hypot(city.x - c.cx, city.y - c.cy); if (d < bd) { bd = d; best = city; } } return { city: best, dist: bd }; }

  function gridAlphas(k) { return { nat: 1 - Motion.step(k, 1.5, 2.5, Motion.ease.linear), one: Math.min(Motion.step(k, 1.5, 2.5, Motion.ease.linear), 1 - Motion.step(k, 24, 16, Motion.ease.linear)), fine: Motion.step(k, 24, 16, Motion.ease.linear) }; }

  function drawMap() {
    const c = cam(); stage.base();
    mctx.fillStyle = theme.stage; mctx.fillRect(0, 0, stage.width, stage.height);
    MM.drawBasemap(mctx, stage, c, bmp, theme, { borderPx: c.k > 9 ? 1.2 : 0.8 });
    const L = state.layer;
    if (L === 'density' || (L === 'share' && c.k >= 1.5 && (state.year === 2021 || c.k >= 24))) {
      // Density counts nationally and in windows; at city zoom with the share layer, 2021 fine cells show the share.
      const ga = gridAlphas(c.k); const shareMode = L === 'share';
      if (ga.nat > 0) { if (shareMode) MM.drawDensityShares(mctx, stage, c, natPaths, theme.ramp5, theme.below, ga.nat); else MM.drawDensityCounts(mctx, stage, c, natPaths, theme.density, ga.nat); }
      const near = nearestCity(c).city.label;
      if (ga.one > 0 && win1[near]) { const p = win1[near].paths; if (shareMode) MM.drawDensityShares(mctx, stage, c, p, theme.ramp5, theme.below, ga.one); else MM.drawDensityCounts(mctx, stage, c, p, theme.density, ga.one); }
      if (ga.fine > 0 && win025[near]) { const p = win025[near].paths; if (shareMode) MM.drawDensityShares(mctx, stage, c, p, theme.ramp5, theme.below, ga.fine); else MM.drawDensityCounts(mctx, stage, c, p, theme.density, ga.fine); }
    } else if (L === 'share') {
      const y = state.year;
      const paths = tiles('share' + y, () => { const idx = yearIndex[y]; return MM.buildTiles(idx.length, idx.map(i => CY.avail.ix[i]), idx.map(i => CY.avail.iy[i]), j => classOfShare(CY.avail.n[idx[j]], CY.avail.a[idx[j]], YEAR_BREAKS), { gapKm: 15 }); });
      MM.drawTiles(mctx, stage, c, paths, cl => (cl === 'below' ? theme.below : theme.ramp6[cl]), { alphaOf: cl => (cl === 'below' ? 0.5 : 1) });
      const near = nearestCity(c);
      if (c.k >= 1.5 && cityYear[near.city.label] && cityYear[near.city.label][y]) { const ga = gridAlphas(Math.min(c.k, 20)); MM.drawDensityShares(mctx, stage, c, cityYear[near.city.label][y].paths, theme.ramp5, theme.below, ga.one); }
    } else if (L === 'change') {
      const paths = tiles('change', () => MM.buildTiles(chg.ix.length, chg.ix, chg.iy, i => (chg.supported[i] ? chg.class[i] : 'below'), { gapKm: 15 }));
      MM.drawTiles(mctx, stage, c, paths, cl => (cl === 'below' ? theme.below : theme.change6[cl - 1]), { alphaOf: cl => (cl === 'below' ? 0.5 : 1) });
    } else if (L === 'cohort') {
      const paths = tiles('cohort', () => MM.buildTiles(cohIdx.length, cohIdx.map(i => coh.ix[i]), cohIdx.map(i => coh.iy[i]), j => (coh.supported[cohIdx[j]] ? coh.class[cohIdx[j]] : 'below'), { gapKm: 15 }));
      MM.drawTiles(mctx, stage, c, paths, cl => (cl === 'below' ? theme.below : theme.ramp5[cl - 1]), { alphaOf: cl => (cl === 'below' ? 0.5 : 1) });
    } else if (L === 'lists') {
      const paths = tiles('lists', () => MM.buildTiles(lists.ix.length, lists.ix, lists.iy, i => listClass(lists.sanctioned[i]), { gapKm: 15 }));
      MM.drawTiles(mctx, stage, c, paths, cl => theme.ramp5[cl + 1]);
    } else if (L === 'fin') {
      const paths = tiles('fin', () => MM.buildTiles(finIdx.length, finIdx.map(i => fin.ix[i]), finIdx.map(i => fin.iy[i]), j => { const v = fin.change_pct[finIdx[j]]; let cl = 0; while (cl < FIN_BREAKS.length && v >= FIN_BREAKS[cl]) cl++; return cl; }, { gapKm: 15 }));
      MM.drawTiles(mctx, stage, c, paths, cl => theme.change6[cl]);
    }
    stage.base();
    if (c.k > 0.6) for (const city of bmp.cities) { const [px, py] = Motion.project(c, city.x, city.y); if (px > -50 && px < stage.width + 50 && py > -20 && py < stage.height + 20) MM.cityLabel(mctx, c, city, theme, { size: 13, dot: 3, dx: 7, dy: -5 }); }
    drawLegend();
  }

  function drawLegend() {
    const L = state.layer, c = cam(); const sw = col => `<span class="sw" style="background:${col}"></span>`;
    let html = '', note = '';
    if (L === 'density' || (L === 'share' && c.k >= 1.5 && (state.year === 2021 || c.k >= 24) && L === 'density')) {
      html = '<div class="row"><b>Firms per cell</b> (' + (c.k < 1.5 ? '5 km' : c.k < 24 ? '1 km' : '250 m') + ')</div>' + MM.countClassLabels.map((lab, i) => `<div class="row">${sw(hexAlpha(theme.density, MM.countAlpha[i]))}${lab}</div>`).join('');
      note = `${fmt.int(F.located_2021)} located firms of ${fmt.int(F.eligible_firms_2021)} eligible in 2021; ${fmt.int(F.distinct_locations)} distinct coordinates; the largest address holds ${fmt.int(F.largest_location_firms)} firms.`;
    } else if (L === 'share') {
      const fine = c.k >= 1.5;
      const breaks = fine ? FINE_BREAKS : YEAR_BREAKS, ramp = fine ? theme.ramp5 : theme.ramp6;
      const labels = ramp.map((_, i) => i === 0 ? `< ${breaks[0]}%` : i === ramp.length - 1 ? `≥ ${breaks[i - 1]}%` : `${breaks[i - 1]}–${breaks[i]}%`);
      html = `<div class="row"><b>Share with a statement, ${state.year}</b> (${fine ? (c.k < 24 ? '1 km' : '250 m') : '100 km'} cells)</div>` + ramp.map((col, i) => `<div class="row">${sw(col)}${labels[i]}</div>`).join('') + `<div class="row">${sw(theme.below)}fewer than 50 located firms</div>`;
      const t = totals[state.year]; note = t ? `${state.year}${state.year === 2025 ? '*' : ''}: ${fmt.pct(t.share)} of ${fmt.int(t.eligible)} eligible firms have a statement; ${fmt.pct(t.located_share)} located. Provider: ${state.year <= 2018 ? 'Rosstat' : 'FNS'}.` : '';
      if (fine && state.year !== 2021 && c.k >= 24) note += ' 250 m cells exist for 2021 only.';
    } else if (L === 'change') {
      const labels = ['≤ −5 points', '−5 to −2', '−2 to 0', '0 to +2', '+2 to +5', '> +5 points'];
      html = '<div class="row"><b>Change in the share, 2024 against 2021</b></div>' + [5, 4, 3, 2, 1, 0].map(i => `<div class="row">${sw(theme.change6[i])}${labels[i]} (${fmt.int(C100.change_classes.cells[i])} cells)</div>`).join('') + `<div class="row">${sw(theme.below)}fewer than 50 firms in a year</div>`;
      note = `658 supported cells; located share ${fmt.pct(C100.change_totals.availability_share_percent[0])} → ${fmt.pct(C100.change_totals.availability_share_percent[1])}. Annual populations at registered addresses, not the same firms.`;
    } else if (L === 'cohort') {
      html = '<div class="row"><b>Revenue cohort by cash share: inclusion per cell</b></div>' + theme.ramp5.map((col, i) => `<div class="row">${sw(col)}${C100.cohort_class_labels[i]}</div>`).join('') + `<div class="row">${sw(theme.below)}fewer than 50 eligible firms</div>`;
      note = `${fmt.int(F.cohorts.revenue_cash)} cohort firms; located cohort firms over located eligible firms per 2021 cell; pooled quintile classes.`;
    } else if (L === 'lists') {
      html = '<div class="row"><b>Sanctions-list members per 100 km cell, 2021</b></div>' + ['5–19', '20–49', '50–199', '≥ 200'].map((lab, i) => `<div class="row">${sw(theme.ramp5[i + 1])}${lab} located members</div>`).join('');
      note = 'Fixed supplied memberships; cells with 1 to 4 members show no count. A separate hover value gives the government strategic list.';
    } else if (L === 'fin') {
      const labels = ['≤ −20%', '−20 to −10%', '−10 to 0%', '0 to +10%', '+10 to +20%', '> +20%'];
      html = '<div class="row"><b>Median real revenue, 2024 against 2021 (descriptive)</b></div>' + [5, 4, 3, 2, 1, 0].map(i => `<div class="row">${sw(theme.change6[i])}${labels[i]}</div>`).join('');
      note = 'Revenue cohort by cash share; cells with 50 or more observed firms; composition changes with observation.';
    }
    $('legend').innerHTML = html; $('mapnote').textContent = note; $('mapnote').hidden = !note;
  }
  function hexAlpha(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }

  // ---- hover ------------------------------------------------------------------------------------
  function kmAt(ev) { const r = wrap.getBoundingClientRect(); const c = cam(); const x = ev.clientX - r.left, y = ev.clientY - r.top; return { x: c.cx + (x - c.ox) / c.k, y: c.cy - (y - c.oy) / c.k, px: x, py: y }; }
  function regionAt(px, py) { const c = cam(); mctx.save(); Motion.camTransform(mctx, stage, c); let name = null; const dx = px * stage.scale, dy = py * stage.scale; for (const p of partPaths) { if (mctx.isPointInPath(p.path, dx, dy, 'evenodd')) { name = p.name; break; } } mctx.restore(); stage.base(); return name; }
  function cellAt(km) {
    const c = cam(); const L = state.layer; const ix = Math.floor(km.x / 100), iy = Math.floor(km.y / 100), key = cellKey(ix, iy);
    const out = { ix, iy, grid: 100, region: regionAt(km.px, km.py) };
    if (L === 'density' || (L === 'share' && c.k >= 1.5)) {
      const near = nearestCity(c).city.label; let layer = null, g = 5, origin = [0, 0];
      if (c.k >= 24 && win025[near] && (L === 'density' || state.year === 2021)) { layer = win025[near].d; g = 0.25; origin = layer.origin; }
      else if (c.k >= 1.5 && (L === 'density' ? win1[near] : (state.year === 2021 ? win1[near] : (cityYear[near] && cityYear[near][state.year])))) { layer = L === 'density' || state.year === 2021 ? win1[near].d : cityYear[near][state.year].d; g = 1; origin = layer.origin; }
      else if (L === 'density') { layer = nat; g = 5; }
      if (!layer) return out;
      const jx = Math.floor((km.x - origin[0]) / g), jy = Math.floor((km.y - origin[1]) / g);
      for (let i = 0; i < layer.count; i++) if (layer.ix[i] === jx && layer.iy[i] === jy) { out.grid = g; out.n = layer.n[i]; out.a = layer.a[i] >= 0 ? layer.a[i] : null; out.fine = true; return out; }
      out.grid = g; return out;
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
    if (h.fine) { lines.push(`${h.grid < 1 ? '250 m' : h.grid + ' km'} cell: ${band(h.n)} located firms` + (h.a != null ? `, ${fmt.int(h.a)} with a 2021 statement (${fmt.pct(100 * h.a / h.n)})` : h.n >= 50 ? '' : '; share not shown under 50 firms')); return lines.join('<br>'); }
    if (L === 'share') { if (h.n == null) lines.push('No located firms in this 100 km cell'); else { lines.push(`${state.year}: ${fmt.int(h.n)} located eligible firms, ${fmt.int(h.a)} with a statement` + (h.n >= 50 ? ` (<b>${fmt.pct(100 * h.a / h.n)}</b>)` : ' (share not shown under 50 firms)')); if (h.nr) lines.push(`Registered at year-end: ${fmt.int(h.nr)}, ${fmt.int(h.ar)} with a statement (${fmt.pct(100 * h.ar / h.nr)})`); if (h.ns != null && h.ns > 0) lines.push(`Sanctions-list members: ${fmt.int(h.ns)}`); } }
    else if (L === 'change') { if (h.n21 == null) lines.push('No located firms'); else lines.push(`2021: ${fmt.int(h.a21)} of ${fmt.int(h.n21)} (${fmt.pct(100 * h.a21 / h.n21)})<br>2024: ${fmt.int(h.a24)} of ${fmt.int(h.n24)} (${fmt.pct(100 * h.a24 / h.n24)})<br>` + (h.supported ? `Change <b>${fmt.signed(h.change)} points</b>` : 'Fewer than 50 firms in a year: not classed')); }
    else if (L === 'cohort') { if (h.n == null) lines.push('No located firms'); else lines.push(`${fmt.int(h.c)} of ${fmt.int(h.n)} located eligible firms in the revenue cohort by cash share` + (h.supported ? ` (<b>${fmt.pct(h.pct)}</b>)` : ' (fewer than 50 eligible: not classed)')); }
    else if (L === 'lists') { if (h.n == null) lines.push('No listed members shown'); else lines.push(`${fmt.int(h.n)} located eligible firms<br>Sanctions list: ${h.sanctioned == null ? 'under 5 or none' : fmt.int(h.sanctioned)}<br>Government strategic list: ${h.gov == null ? 'under 5 or none' : fmt.int(h.gov)}`); }
    else if (L === 'fin') { if (h.n_base == null) lines.push('No supported cohort cell'); else lines.push(`${fmt.int(h.n_obs)} of ${fmt.int(h.n_base)} cohort firms observed in 2024<br>Median real revenue <b>${fmt.signed(h.change)}%</b> against the cell’s 2021 median`); }
    else lines.push(`100 km cell ${h.ix}, ${h.iy}`);
    return lines.join('<br>');
  }
  function drawOverlay(h) {
    octx.setTransform(stage.scale, 0, 0, stage.scale, 0, 0); octx.clearRect(0, 0, stage.width, stage.height);
    if (!h) return; const c = cam();
    const g = h.grid, ox = h.fine && g !== 5 ? (g === 1 ? win1[nearestCity(c).city.label].d.origin : win025[nearestCity(c).city.label].d.origin) : [0, 0];
    const x0 = h.fine ? ox[0] + Math.floor((h.kmx - ox[0]) / g) * g : h.ix * 100, y0 = h.fine ? ox[1] + Math.floor((h.kmy - ox[1]) / g) * g : h.iy * 100;
    const [px, py] = Motion.project(c, x0, y0 + g); const s = g * c.k;
    octx.strokeStyle = theme.ink; octx.lineWidth = 2; octx.strokeRect(px, py, s, s);
  }
  wrap.addEventListener('mousemove', ev => {
    if (dragging) { const r = wrap.getBoundingClientRect(); const c = cam(); state.cam.cx -= (ev.clientX - r.left - dragLast.x) / c.k; state.cam.cy += (ev.clientY - r.top - dragLast.y) / c.k; dragLast = { x: ev.clientX - r.left, y: ev.clientY - r.top }; drawMap(); return; }
    const km = kmAt(ev); const h = cellAt(km); h.kmx = km.x; h.kmy = km.y; state.hover = h;
    const tip = $('tip'); tip.innerHTML = tipText(h); tip.style.display = 'block';
    const r = wrap.getBoundingClientRect(); tip.style.left = Math.min(km.px + 14, r.width - 290) + 'px'; tip.style.top = Math.max(0, km.py - 10) + 'px';
    drawOverlay(h); drawCellPanel(h);
  });
  wrap.addEventListener('mouseleave', () => { $('tip').style.display = 'none'; state.hover = null; drawOverlay(null); });
  let dragging = false, dragLast = null;
  wrap.addEventListener('mousedown', ev => { dragging = true; const r = wrap.getBoundingClientRect(); dragLast = { x: ev.clientX - r.left, y: ev.clientY - r.top }; });
  window.addEventListener('mouseup', () => { dragging = false; });
  wrap.addEventListener('wheel', ev => { ev.preventDefault(); const km = kmAt(ev); const f = Math.exp(-ev.deltaY * 0.0015); const k2 = Motion.clamp(state.cam.k * f, 0.05, 200); state.cam.cx = km.x - (km.px - stage.width / 2) / k2; state.cam.cy = km.y + (km.py - stage.height / 2) / k2; state.cam.k = k2; drawMap(); }, { passive: false });

  // ---- side panels -------------------------------------------------------------------------------
  function chartCtx(id) { const c = $(id); const r = c.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1; c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr); const ctx = c.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, r.width, r.height); return { ctx, w: r.width, h: r.height }; }
  function drawCellPanel(h) {
    const info = $('cellinfo'); const rows = [];
    if (h && h.region) rows.push(['Region', h.region]);
    if (h && (h.n != null || h.n21 != null || h.n_base != null)) rows.push(['Cell', h.fine ? (h.grid < 1 ? '250 m' : h.grid + ' km') : `100 km (${h.ix}, ${h.iy})`]);
    info.innerHTML = rows.length ? rows.map(([k, v]) => `<span>${k}</span><b>${v}</b>`).join('') : '<span>Hover a cell</span><b></b>';
    const { ctx, w, hgt = 0 } = chartCtx('cellchart'); const hh = $('cellchart').getBoundingClientRect().height;
    if (!h || h.fine) { Motion.text(ctx, h && h.fine ? 'Year series are kept for 100 km cells' : '', 8, 24, { size: 13, color: theme.muted }); return; }
    const key = cellKey(h.ix, h.iy); const pts = [];
    for (const y of years) { const d = yearCells[y].get(key); if (d && d.n >= 50) pts.push({ x: y, y: 100 * d.a / d.n }); }
    if (!pts.length) { Motion.text(ctx, 'Fewer than 50 located firms in every year', 8, 24, { size: 13, color: theme.muted }); return; }
    CH.lines(ctx, { x: 44, y: 14, w: w - 60, h: hh - 44 }, [{ label: '{y}', color: theme.accent, points: pts, gapAfter: [2018] }], { xDomain: [2013.5, 2025.5], yDomain: [0, 100], theme, yTicks: [0, 50, 100], xTicks: [2014, 2018, 2021, 2025], xFmt: v => (v === 2025 ? "25*" : String(v).slice(2)), labelSize: 12, lineWidth: 2, eras: [{ from: 2018.5, to: 2025.5, color: theme.highlightBand }], yFmt: v => v + '%' });
    Motion.text(ctx, 'share with a statement, this cell, by year', 44, hh - 2, { size: 11, color: theme.dim });
  }
  function drawNational() {
    const { ctx, w } = chartCtx('natchart'); const hh = $('natchart').getBoundingClientRect().height;
    const el = [], reg = []; S.avail.year.forEach((y, i) => { if (S.avail.eligible_share[i] != null) { el.push({ x: y, y: S.avail.eligible_share[i] }); reg.push({ x: y, y: S.avail.registered_share[i] }); } });
    const r = CH.lines(ctx, { x: 44, y: 14, w: w - 110, h: hh - 44 }, [{ label: 'registered {y}', color: theme.accentStrong, points: reg, gapAfter: [2018], width: 2 }, { label: 'eligible {y}', color: theme.accent, points: el, gapAfter: [2018], width: 2 }],
      { xDomain: [2011.5, 2025.5], yDomain: [0, 80], theme, yTicks: [0, 40, 80], xTicks: [2012, 2016, 2020, 2024], labelSize: 12, dots: false, eras: [{ from: 2018.5, to: 2025.5, color: theme.highlightBand }], yFmt: v => v + '%', labelFmt: v => Motion.fmt.pct(v, 1) });
    if (state.layer === 'share') { const x = r.sx(state.year); ctx.strokeStyle = theme.ink; ctx.lineWidth = 1.5; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(x, 14); ctx.lineTo(x, hh - 30); ctx.stroke(); ctx.setLineDash([]); }
    $('natprov').textContent = 'Table B.1: statements over the annual eligible population and over firms registered at year-end; 2011 has no statements, 2025* is flagged. Source ' + S.sources.avail + '.';
  }
  function drawGroups() {
    const { ctx, w } = chartCtx('groupchart'); const hh = $('groupchart').getBoundingClientRect().height;
    const items = [{ label: 'Joint-stock', a: F.legal.joint_stock[0], b: F.legal.joint_stock[1], color: theme.accent }, { label: 'State-related', a: F.own.state[0], b: F.own.state[1], color: theme.fall }, { label: 'Private', a: F.own.private[0], b: F.own.private[1], color: theme.accent }, { label: 'Unitary', a: F.legal.unitary[0], b: F.legal.unitary[1], color: theme.fall }];
    CH.slopes(ctx, { x: 8, y: 26, w: w - 16, h: hh - 44 }, items, { yDomain: [44, 82], theme, size: 12, leftMargin: 150, rightMargin: 70 });
    $('groupprov').textContent = 'Share of eligible firms with a statement by ownership and legal form (Figures 2.2 and 2.3 sources); population comparisons by year, not the same firms.';
  }
  function drawOdds() {
    const { ctx, w } = chartCtx('oddschart'); const hh = $('oddschart').getBoundingClientRect().height;
    const sz = {}; for (let i = 0; i < S.size.year.length; i++) if (S.size.era[i] === 'recent') (sz[S.size.quintile[i]] = sz[S.size.quintile[i]] || []).push({ x: S.size.year[i], y: S.size.or[i], low: S.size.low[i], high: S.size.high[i] });
    const ls = []; for (let i = 0; i < S.lists.year.length; i++) if (S.lists.model[i] === 'annual-eligible-membership' && S.lists.contrast[i] === 'sanctioned_only' && S.lists.comparison[i] === 'level' && S.lists.year[i] != null) ls.push({ x: S.lists.year[i], y: S.lists.or[i], low: S.lists.low[i], high: S.lists.high[i] });
    CH.yearDots(ctx, { x: 40, y: 10, w: w - 150, h: hh - 44 }, [{ label: 'Q5 vs Q1', color: theme.accentStrong, points: sz.Q5 || [], whiskers: true, dot: 4, width: 2 }, { label: 'Q2 vs Q1', color: theme.accent, points: sz.Q2 || [], dot: 3, width: 1.5 }, { label: 'sanctioned only', color: theme.fall, points: ls, whiskers: true, dot: 4, width: 2 }],
      { xDomain: [2019, 2024], yDomain: [0.3, 5], yTicks: [0.5, 1, 2, 4], theme, size: 12 });
    $('oddsprov').textContent = `Adjusted odds of a statement: asset quintiles Q5 and Q2 against Q1 (Table B.4; 2022 vs 2021 Q5 ratio ${fmt.dec(F.size_q5_2022_ratio, 3)} [${fmt.dec(F.size_q5_2022_low, 3)}, ${fmt.dec(F.size_q5_2022_high, 3)}], provisional) and sanctioned-only firms against no-list firms (Table B.7), two-way 95% intervals.`;
  }
  function redrawAll() { sizeCanvases(); drawMap(); drawCellPanel(state.hover); drawNational(); drawGroups(); drawOdds(); }

  // ---- controls -------------------------------------------------------------------------------------
  const layersEl = $('layers');
  LAYERS.forEach(L => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.textContent = L.label; b.dataset.id = L.id; b.setAttribute('aria-pressed', String(L.id === state.layer)); b.addEventListener('click', () => { state.layer = L.id; layersEl.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.id === L.id))); $('yearrow').hidden = L.id !== 'share'; $('layerprov').textContent = L.prov; drawMap(); drawNational(); }); layersEl.appendChild(b); });
  $('layerprov').textContent = LAYERS[1].prov;
  $('year').addEventListener('input', () => { state.year = +$('year').value; $('yearlabel').textContent = state.year + (state.year === 2025 ? '*' : ''); drawMap(); drawNational(); });
  const presets = $('presets');
  const addPreset = (label, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.textContent = label; b.addEventListener('click', () => { fn(); drawMap(); }); presets.appendChild(b); };
  addPreset('Russia', () => fitNational());
  for (const city of bmp.cities) addPreset(city.label, () => { state.cam = { cx: city.x, cy: city.y, k: Math.min(stage.width, stage.height) / 95 }; });
  addPreset('Central Moscow (250 m)', () => { const c = bmp.cities[0]; state.cam = { cx: c.x + 1.5, cy: c.y + 0.5, k: Math.min(stage.width, stage.height) / 20 }; });
  $('footer').innerHTML = `Data: ${F.release} (Bondarkov et al. 2025), ${fmt.int(F.records_total)} annual records, financial years ${F.years}; boundaries geoBoundaries gbOpen (CC BY 4.0), OpenStreetMap/Wambacher 2017 (ODbL 1.0), © OpenStreetMap contributors. Every number is a checked aggregate with a provenance record in the lab (motion/data/*.provenance.json). Descriptive associations, not causal effects; absence from the archive is not withdrawal or concealment; supplied lists are fixed lists, not dated designations.`;
  window.addEventListener('resize', redrawAll);
  document.fonts.ready.then(() => { sizeCanvases(); fitNational(); syncThemeButton(); redrawAll(); });
})();
