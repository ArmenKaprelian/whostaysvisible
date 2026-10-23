// The Moscow sequence: two firms on one street, a designation, their revenue against their comparison
// groups, and the Moscow field 2014-2025 at three scales (M6 and M7 data, local only; the published
// explainer carries neither this sequence nor its data). Every frame is a pure function of t. Firms on
// any supplied list are one bucket, red from their red-from year; firms on no list carry their own
// real revenue change against their 2019-2021 average (one blue ramp), or the dark colour when they
// have a baseline and no statement that year; firms without a usable baseline are only the faint
// backdrop. At the city and region scales the same metric is aggregated by 1 km and 5 km cells.
// No spatial or proximity effect is estimated.
//
// Round 3 (23 October 2026): the drawing is split into pieces with beat-relative clocks, so the
// standalone cut and the full presentation's Moscow section share them.
(function () {
  'use strict';
  const D = window.MOTION_DATA;
  if (!D || !D.points || !D.treated || !D.anchors || !D.basemap || !D.moscowcells || !D.moscowcomparison) { window.TreatedScenes = null; return; }
  const P = D.points, TR = D.treated, AN = D.anchors, BM = D.basemap, MC = D.moscowcells, CMP = D.moscowcomparison;
  const fmt = Motion.fmt, step = Motion.step, E = Motion.ease, MM = MotionMap, CH = MotionCharts;
  const ramp = (v, a, b) => Motion.clamp((v - a) / (b - a), 0, 1);
  const lerp2 = (p, q, u) => [Motion.lerp(p[0], q[0], u), Motion.lerp(p[1], q[1], u)];
  const TAU = Math.PI * 2;
  const MX = P.anchor.x, MY = P.anchor.y, YEARS = P.years, Y0 = YEARS[0], Y1 = YEARS[YEARS.length - 1];
  const A = AN.a, B = AN.b, AX = A.x_km, AY = A.y_km, BX = B.x_km, BY = B.y_km;
  const MIDX = (AX + BX) / 2, MIDY = (AY + BY) / 2;
  const BACK_ALPHA = P.backdrop_alpha == null ? 0.25 : P.backdrop_alpha, LAYER_ALPHA = P.layer_alpha == null ? 0.9 : P.layer_alpha;
  const K = { downtown: P.extents.downtown.k, city: P.extents.city.k, region: P.extents.region.k };
  const WINDOW = { downtown: { name: 'Central Moscow', size: '21 by 12 km' }, city: { name: 'Moscow', size: '64 by 36 km' }, region: { name: 'Moscow and surroundings', size: '160 by 90 km' } };

  // ---- data preparation (once) ---------------------------------------------------------------
  const bmp = MM.buildBasemap(BM);
  const extentAlpha = k => ({ region: ramp(k, 3, 6) * (1 - ramp(k, 22, 30)), city: ramp(k, 14, 22) * (1 - ramp(k, 60, 80)), downtown: ramp(k, 60, 80) * (1 - ramp(k, 150, 260)) });
  const extentOf = k => (k >= 60 ? 'downtown' : k >= 20 ? 'city' : 'region');
  const markRadius = (ext, pile) => { const m = P.extents[ext].mark; return Math.min(m.cap, m.base + m.s * Math.sqrt(Math.max(0, pile - 1))) / 2; };
  const inExtent = (ext, x, y) => { const e = P.extents[ext]; return x >= e.xmin && x <= e.xmax && y >= e.ymin && y <= e.ymax; };
  const stateColour = s => (s >= '1' && s <= '6') ? P.class_colours[+s - 1] : s === 'd' ? P.nonfiler : null;
  const redCounts = {};
  for (const ext of Object.keys(P.extents)) { redCounts[ext] = {}; for (const y of YEARS) { let red = 0, dark = 0; for (let i = 0; i < TR.n; i++) { const ch = TR.filed[i][y - Y0]; if (ch === '-' || TR.red_from[i] > y || !inExtent(ext, TR.x[i], TR.y[i])) continue; red++; if (ch === '0') dark++; } redCounts[ext][y] = { red, dark }; } }
  const counts = (ext, y) => P.counts[ext][String(y)];
  const breakLabels = P.breaks.map(b => (b > 0 ? '+' : b < 0 ? '−' : '') + Math.abs(b) + '%');
  const money = (mn, exact) => (mn == null ? 'no statement' : mn >= 1000 ? fmt.dec(mn / 1000, 1) + ' bn rubles' : (exact ? '' : 'about ') + fmt.int(mn) + ' mn rubles');
  const cap1 = s => s.charAt(0).toUpperCase() + s.slice(1);
  const ownText = s => (s === 'mixed Russian with a federal share' ? 'Mixed, with a federal share' : cap1(s));
  const yearIndex = y => A.years.year.indexOf(y);
  const val = (f, key, y) => f.years[key][yearIndex(y)];
  // Profile rows: the neighbour on the left, Aeroflot on the right (east of the neighbour on the map, so the dots never cross).
  const ROWS = [
    ['Industry', B.okved_text, A.okved_text],
    ['Legal form', cap1(B.legal.en), cap1(A.legal.en)],
    ['Ownership', ownText(B.ownership.en), ownText(A.ownership.en)],
    ['Founded', String(B.founded), String(A.founded)],
    ['Revenue 2021', money(val(B, 'revenue_mn', 2021), false), money(val(A, 'revenue_mn', 2021), true)],
    ['Assets 2021', money(val(B, 'assets_mn', 2021), false), money(val(A, 'assets_mn', 2021), true)],
  ];
  const COL = { left: { x: 430, hx: 460, dot: [430, 236], firm: B, name: 'A private firm nearby' }, right: { x: 1210, hx: 1240, dot: [1210, 236], firm: A, name: 'Aeroflot' } };
  const jurisdictions = (A.listed.jurisdiction_names || []).join(' and ');
  const listedDate = (() => { const d = new Date(A.listed.date + 'T00:00:00Z'); return d.getUTCDate() + ' ' + ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][d.getUTCMonth()] + ' ' + d.getUTCFullYear(); })();

  // Comparison groups (M7): the firm's index against its group's median and quartiles.
  const cmpSeries = (gid, anchor) => {
    const g = CMP.groups[gid], by = g.by_year;
    const band = by.year.map((y, i) => ({ x: y, med: by.med[i], q1: by.q1[i], q3: by.q3[i], n: by.n[i] }));
    const firm = anchor.years.map((y, i) => ({ x: y, y: anchor.idx[i] }));
    return { band, firm, group: g, anchor };
  };
  const CMPA = cmpSeries('listed2022', CMP.anchors.a), CMPB = cmpSeries('nolist', CMP.anchors.b);
  const yDomainCmp = [Math.min(10, Math.floor(CMP.extremes.min_q1 / 10) * 10, Math.floor(CMP.extremes.min_idx / 10) * 10), Math.max(500, Math.ceil(CMP.extremes.max_q3 / 100) * 100, Math.ceil(CMP.extremes.max_idx / 100) * 100)];
  const gapText = (gap, groupLabel, decimals) => {
    const word = v => (Math.abs(v) < 0.5 ? 'at the median' : fmt.dec(Math.abs(v), decimals) + ' points ' + (v > 0 ? 'above' : 'below'));
    const en = s => s.replace('-', '–');
    return [`${en(gap.years_before)}: on average ${word(gap.before)}${Math.abs(gap.before) < 0.5 ? '' : ' the median'} of ${groupLabel}.`, `${en(gap.years_after)}: ${word(gap.after)}${Math.abs(gap.after) < 0.5 ? '' : ' it'}.`];
  };
  const membersText = g => `${fmt.int(g.members)} ${g.label}, ${fmt.int(Math.min(...g.by_year.n))} to ${fmt.int(Math.max(...g.by_year.n))} with a statement per year`;

  // Cells (M7): one Path2D per grid, year and class; 'below' = 1-19 firms with a statement (outline).
  const TILES = {};
  for (const [gid, g] of Object.entries(MC.grids)) {
    TILES[gid] = {}; const c = g.cells, idx = {};
    for (let i = 0; i < c.year.length; i++) (idx[c.year[i]] = idx[c.year[i]] || []).push(i);
    for (const y of YEARS) {
      const rows = idx[y] || [];
      TILES[gid][y] = MM.buildTiles(rows.length, rows.map(i => c.ix[i]), rows.map(i => c.iy[i]), j => { const i = rows[j]; return c.cls[i] != null ? c.cls[i] - 1 : (c.f[i] > 0 ? 'below' : null); }, { sizeKm: g.size_km, gapKm: 0.1 * g.size_km, origin: MC.origin });
      // Mocks of a second cue (review only): ?cue=1 outlines supported cells by their absent share
      // (baseline firms without a statement over baseline firms, four classes); ?cue=2 draws a dark
      // inner square whose area is the absent share of the cell.
      TILES[gid][y].cue = MM.buildTiles(rows.length, rows.map(i => c.ix[i]), rows.map(i => c.iy[i]), j => { const i = rows[j]; if (c.cls[i] == null || !c.nb[i]) return null; const s = c.nfb[i] / c.nb[i]; return s < 0.1 ? 0 : s < 0.2 ? 1 : s < 0.3 ? 2 : 3; }, { sizeKm: g.size_km, gapKm: 0.1 * g.size_km, origin: MC.origin });
      const core = new Path2D();
      for (const i of rows) { if (c.cls[i] == null || !c.nb[i]) continue; const s = g.size_km * 0.9 * Math.sqrt(c.nfb[i] / c.nb[i]); if (s <= 0) continue; const cx = MC.origin[0] + (c.ix[i] + 0.5) * g.size_km, cy = MC.origin[1] + (c.iy[i] + 0.5) * g.size_km; core.rect(cx - s / 2, cy - s / 2, s, s); }
      TILES[gid][y].core = core;
    }
  }
  const CUE = new URLSearchParams(location.search).get('cue') || '', CUE_ALPHA = [0, 0.35, 0.7, 1];
  const supportOf = (gid, y) => { const s = MC.support; for (let i = 0; i < s.grid.length; i++) if (s.grid[i] === gid && s.year[i] === y) return { supported: s.supported[i], thin: s.thin[i] }; return { supported: 0, thin: 0 }; };
  const cellSums = {};
  for (const [gid, g] of Object.entries(MC.grids)) { cellSums[gid] = {}; const c = g.cells; for (let i = 0; i < c.year.length; i++) { const y = c.year[i]; const s = cellSums[gid][y] || (cellSums[gid][y] = { f: 0, nfb: 0, nb: 0 }); s.f += c.f[i]; s.nfb += c.nfb[i]; s.nb += c.nb[i]; } }
  const CELL_GRID = { city: '1km', region: '5km' };

  // ---- raster and cell compositing ---------------------------------------------------------------
  let IMG = null; const OFF = [0, 1, 2, 3, 4].map(() => { const c = document.createElement('canvas'); c.width = 1920; c.height = 1080; return c; });
  function yearPair(v) { const y0 = Math.max(Y0, Math.min(Y1, Math.floor(v))), y1 = Math.min(Y1, y0 + 1); return [y0, y1, Motion.clamp(v - y0, 0, 1)]; }
  // Two years of one raster blended with 'lighter' at weights (1 - u, u): a mark present in both keeps its colour and opacity.
  function blendYears(off, ext, which, v) {
    const [y0, y1, u] = yearPair(v);
    const o = off.getContext('2d'); o.setTransform(1, 0, 0, 1, 0, 0); o.globalCompositeOperation = 'source-over'; o.clearRect(0, 0, 1920, 1080);
    o.globalCompositeOperation = 'lighter';
    const i0 = IMG[ext][y0] && IMG[ext][y0][which], i1 = IMG[ext][y1] && IMG[ext][y1][which];
    if (i0 && (u < 1 || y1 === y0)) { o.globalAlpha = y1 === y0 ? 1 : 1 - u; o.drawImage(i0, 0, 0); }
    if (i1 && u > 0 && y1 !== y0) { o.globalAlpha = u; o.drawImage(i1, 0, 0); }
    o.globalAlpha = 1; o.globalCompositeOperation = 'source-over';
    return off;
  }
  function rasterRect(cam, ext) { const e = P.extents[ext]; const [px, py] = Motion.project(cam, e.xmin, e.ymax); return [px, py, e.w_km * cam.k, e.h_km * cam.k]; }
  // Backdrop rasters for every extent, the outcome raster at the downtown extent only (cells carry the other scales).
  function drawField(ctx, cam, v, backAlpha, layerAlpha) {
    if (!IMG) return;
    const ea = extentAlpha(cam.k);
    for (const ext of ['region', 'city', 'downtown']) {
      const a = ea[ext]; if (a <= 0.002) continue;
      const [px, py, w, h] = rasterRect(cam, ext);
      ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      if (backAlpha > 0) { ctx.save(); ctx.globalAlpha *= a * backAlpha; ctx.drawImage(blendYears(OFF[0], ext, 'backdrop', v), px, py, w, h); ctx.restore(); }
      if (layerAlpha > 0 && ext === 'downtown') { ctx.save(); ctx.globalAlpha *= a * layerAlpha * LAYER_ALPHA; ctx.drawImage(blendYears(OFF[1], ext, 'layer', v), px, py, w, h); ctx.restore(); }
      ctx.restore();
    }
  }
  // Cells at the city (1 km) and region (5 km) scales, blended between years on an offscreen canvas.
  function drawCells(ctx, stage, cam, v, alpha) {
    if (alpha <= 0) return;
    const ea = extentAlpha(cam.k); const [y0, y1, u] = yearPair(v);
    for (const ext of ['region', 'city']) {
      const a = ea[ext] * alpha; if (a <= 0.002) continue;
      const gid = CELL_GRID[ext];
      // Each year is drawn with normal compositing into its own canvas (so a dark mark can sit on a pale
      // cell), then the two years are added with 'lighter' at weights (1 - u, u), as for the rasters.
      const layer = (y, target) => {
        const o = target.getContext('2d'); o.setTransform(1, 0, 0, 1, 0, 0); o.globalCompositeOperation = 'source-over'; o.globalAlpha = 1; o.clearRect(0, 0, 1920, 1080);
        o.transform(cam.k, 0, 0, -cam.k, cam.ox - cam.cx * cam.k, cam.oy + cam.cy * cam.k);
        for (const [c, p] of TILES[gid][y]) { if (c === 'below') { o.save(); o.globalAlpha = 0.3; o.strokeStyle = P.neutral; o.lineWidth = 1 / cam.k; o.stroke(p); o.restore(); } else { o.fillStyle = P.class_colours[c]; o.fill(p); } }
        if (CUE === '1') for (const [c, p] of TILES[gid][y].cue) { if (!CUE_ALPHA[c]) continue; o.save(); o.globalAlpha = CUE_ALPHA[c]; o.strokeStyle = P.nonfiler; o.lineWidth = 2.5 / cam.k; o.stroke(p); o.restore(); }
        if (CUE === '2') { o.save(); o.globalAlpha = 0.85; o.fillStyle = P.nonfiler; o.fill(TILES[gid][y].core); o.restore(); }
        o.setTransform(1, 0, 0, 1, 0, 0);
      };
      layer(y0, OFF[3]); if (y1 !== y0) layer(y1, OFF[4]);
      const o = OFF[2].getContext('2d'); o.setTransform(1, 0, 0, 1, 0, 0); o.globalCompositeOperation = 'source-over'; o.globalAlpha = 1; o.clearRect(0, 0, 1920, 1080);
      o.globalCompositeOperation = 'lighter';
      o.globalAlpha = y1 === y0 ? 1 : 1 - u; o.drawImage(OFF[3], 0, 0);
      if (y1 !== y0 && u > 0) { o.globalAlpha = u; o.drawImage(OFF[4], 0, 0); }
      o.globalAlpha = 1; o.globalCompositeOperation = 'source-over';
      ctx.save(); ctx.globalAlpha *= a; ctx.drawImage(OFF[2], 0, 0); ctx.restore();
    }
  }
  // Listed firms as vector marks: their own state until the red-from year, then red (filled when a
  // statement exists, a ring when not), blooming once with an expanding ring.
  function drawTreated(ctx, cam, v, alpha, theme) {
    alpha *= 1 - ramp(cam.k, 150, 260);
    if (alpha <= 0) return;
    const [y0, y1, u] = yearPair(v);
    const ext = extentOf(cam.k); const hw = 960 / cam.k + 1, hh = 540 / cam.k + 1;
    for (let i = 0; i < TR.n; i++) {
      const x = TR.x[i], y = TR.y[i];
      if (x < cam.cx - hw || x > cam.cx + hw || y < cam.cy - hh || y > cam.cy + hh) continue;
      const s0 = TR.state[i][y0 - Y0], s1 = TR.state[i][y1 - Y0];
      const present = Motion.lerp(s0 === '-' ? 0 : 1, s1 === '-' ? 0 : 1, u); if (present <= 0) continue;
      const [px, py] = Motion.project(cam, x, y); const r = markRadius(ext, TR.pile[i]);
      const bloom = Motion.clamp(v - (TR.red_from[i] - 1), 0, 1);
      if (bloom < 1) {
        const c0 = stateColour(s0), c1 = stateColour(s1);
        const pre = (1 - E.outCubic(bloom)) * present * alpha;
        if (c0 && u < 1) { ctx.globalAlpha = pre * (1 - u); ctx.fillStyle = c0; ctx.beginPath(); ctx.arc(px, py, r, 0, TAU); ctx.fill(); }
        if (c1 && u > 0) { ctx.globalAlpha = pre * u; ctx.fillStyle = c1; ctx.beginPath(); ctx.arc(px, py, r, 0, TAU); ctx.fill(); }
      }
      if (bloom > 0) {
        const f0 = TR.filed[i][y0 - Y0] === '1' ? 1 : 0, f1 = TR.filed[i][y1 - Y0] === '1' ? 1 : 0; const fill = Motion.lerp(f0, f1, u);
        const grow = E.outCubic(bloom), flash = 1 + 0.9 * Math.sin(Math.PI * bloom), rr = Math.max(1.2, r) * flash;
        ctx.globalAlpha = alpha * present * grow;
        ctx.fillStyle = theme.treatedOutline; ctx.beginPath(); ctx.arc(px, py, rr + 1, 0, TAU); ctx.fill();
        ctx.fillStyle = theme.land; ctx.beginPath(); ctx.arc(px, py, rr, 0, TAU); ctx.fill();
        ctx.fillStyle = theme.treated; ctx.globalAlpha = alpha * present * grow * (0.3 + 0.7 * fill); ctx.beginPath(); ctx.arc(px, py, rr, 0, TAU); ctx.fill();
        if (fill < 1) { ctx.globalAlpha = alpha * present * grow; ctx.strokeStyle = theme.treated; ctx.lineWidth = Math.max(1, Math.min(2, rr * 0.5)); ctx.beginPath(); ctx.arc(px, py, Math.max(0.6, rr - ctx.lineWidth / 2), 0, TAU); ctx.stroke(); }
        if (bloom < 1) { ctx.globalAlpha = alpha * present * (1 - bloom) * 0.9; ctx.strokeStyle = theme.treated; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(px, py, rr + 4 + 22 * E.outCubic(bloom), 0, TAU); ctx.stroke(); }
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---- drawing pieces (beat-relative clocks) ----------------------------------------------------
  function dot(ctx, p, r, color, alpha) { if (alpha <= 0) return; ctx.save(); ctx.globalAlpha *= alpha; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, TAU); ctx.fill(); ctx.restore(); }
  function strip(ctx, x, y, firm, shown, theme, alpha) {   // 12 cells, revealed per year; filled = statement available, dark = absent
    for (let i = 0; i < YEARS.length; i++) {
      const a = alpha * shown(i); if (a <= 0) continue;
      const filed = firm.years.filed[i]; const xx = x + i * 30;
      ctx.save(); ctx.globalAlpha *= a;
      ctx.fillStyle = filed ? theme.accent : P.nonfiler; ctx.fillRect(xx, y - 20, 24, 24);
      if (!filed) { ctx.strokeStyle = theme.dim; ctx.lineWidth = 1; ctx.strokeRect(xx + 0.5, y - 19.5, 23, 23); }
      ctx.restore();
    }
    Motion.text(ctx, String(Y0), x, y + 30, { size: 22, color: theme.muted, alpha: alpha * shown(0) });
    Motion.text(ctx, String(Y1), x + 11 * 30 + 24, y + 30, { size: 22, color: theme.muted, align: 'right', alpha: alpha * shown(11) });
  }
  // The two firms' headers (names beside their dots) over a plateau.
  function headers(ctx, theme, alpha) {
    if (alpha <= 0) return;
    Motion.text(ctx, COL.left.name, COL.left.hx, 248, { size: 34, weight: 700, color: theme.ink, alpha, group: 'header-left' });
    Motion.text(ctx, COL.right.name, COL.right.hx, 248, { size: 34, weight: 700, color: theme.ink, alpha, group: 'header-right' });
  }
  // Profile rows, the filing strips and the designation lines; l is the beat clock from the start of
  // the profiles (rows reveal from 1.6 s), the designation at `des` seconds, everything leaves at `until`.
  function profiles(ctx, theme, l, { des = 16.6, until = 24 } = {}) {
    const down = 1 - Motion.step(l, until - 0.4, 0.4, E.inOutSine); if (down <= 0) return;
    let y = 340; const colW = 700;
    ROWS.forEach(([label, vl, vr], i) => {
      const t0 = 1.6 + i * 0.7;
      Motion.reveal(ctx, label, 120, y, l, t0, { size: 24, color: theme.muted, until });
      const u = Motion.step(l, t0 + 0.15, 0.5, E.outCubic) * down;
      if (u > 0) {
        const ya = Motion.paragraph(ctx, vl, COL.left.x, y + 10 * (1 - u), colW - 20, { size: 29, color: theme.ink, alpha: u, lineHeight: 1.25 });
        const yb = Motion.paragraph(ctx, vr, COL.right.x, y + 10 * (1 - u), colW - 20, { size: 29, color: theme.ink, alpha: u, lineHeight: 1.25 });
        y = Math.max(ya, yb) + 44 - 29 * 1.25;
      } else y += 44;
      y += 29 * 1.25 - 29;
    });
    const sy = y + 24;
    Motion.reveal(ctx, 'Statements 2014–2025', 120, sy, l, 5.8, { size: 24, color: theme.muted, until });
    const shown = i => (i <= 7 ? Motion.step(l, 6.0 + i * 0.12, 0.4, E.outCubic) : Motion.step(l, des + 2.0 + (i - 8) * 0.3, 0.4, E.outCubic));
    strip(ctx, COL.left.x, sy, COL.left.firm, shown, theme, down); strip(ctx, COL.right.x, sy, COL.right.firm, shown, theme, down);
    Motion.reveal(ctx, `${listedDate}: listed by the ${jurisdictions}`, 960, 900, l, des + 0.6, { size: 34, weight: 700, color: theme.ink, align: 'center', until });
    Motion.reveal(ctx, 'No 2022 statement in the archive. Back in 2023.', 960, 950, l, des + 2.6, { size: 28, color: theme.muted, align: 'center', until });
    const r22 = sy + 76;
    Motion.reveal(ctx, 'Revenue 2022', 120, r22, l, des + 3.0, { size: 24, color: theme.muted, until });
    Motion.reveal(ctx, money(val(B, 'revenue_mn', 2022), false), COL.left.x, r22, l, des + 3.2, { size: 29, color: theme.ink, until });
    Motion.reveal(ctx, money(val(A, 'filed', 2022) ? val(A, 'revenue_mn', 2022) : null, true), COL.right.x, r22, l, des + 3.2, { size: 29, color: theme.dim, until });
  }
  // The comparison beat: "Revenue against comparison group", two panels under the headers.
  function comparison(ctx, theme, l, { until = 12 } = {}) {
    const down = 1 - Motion.step(l, until - 0.4, 0.4, E.inOutSine); if (down <= 0) return;
    const inA = Motion.step(l, 0.4, 0.5, E.outCubic) * down;
    Motion.text(ctx, 'Revenue against comparison group', 960, 310, { size: 36, weight: 700, color: theme.ink, align: 'center', alpha: inA });
    Motion.text(ctx, 'Real revenue, own 2019–2021 average = 100', 960, 346, { size: 24, color: theme.muted, align: 'center', alpha: inA });
    const progress = Motion.step(l, 1.0, 3.5, E.inOutSine);
    // Two plots side by side: tick labels on the left of each, end labels to the right of each (170 px), a 40 px gap between.
    const panels = [[{ x: 140 }, CMPB, 'the private firm', 'median of firms on no list'], [{ x: 1050 }, CMPA, 'Aeroflot', 'median of firms listed in 2022']];
    panels.forEach(([col, s, firmLabel, medLabel], i) => {
      const box = { x: col.x, y: 400, w: 630, h: 330 };
      ctx.save(); ctx.globalAlpha *= inA;
      CH.bandLines(ctx, box, { firm: s.firm, band: s.band }, { yDomain: yDomainCmp, yTicks: [25, 50, 100, 200, 400], progress, theme, labels: { firm: firmLabel, median: 'median' },
        marker: s.anchor.marker ? { x: s.anchor.marker.year, label: s.anchor.marker.label } : null,
        gapLabel: s.anchor.idx.some(v => v == null) ? { x: 2022, y: 100, text: 'no 2022 statement' } : null });
      ctx.restore();
      // Key under the chart: the median line and the interquartile band, with the group named plainly.
      const ky = box.y + box.h + 58;
      ctx.save(); ctx.globalAlpha *= inA; ctx.strokeStyle = theme.accent; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(box.x, ky - 6); ctx.lineTo(box.x + 26, ky - 6); ctx.stroke();
      ctx.globalAlpha *= 0.22; ctx.fillStyle = theme.accent; ctx.fillRect(box.x + 36, ky - 14, 26, 16); ctx.restore();
      Motion.text(ctx, 'median and interquartile range of ' + medLabel.replace('median of ', ''), box.x + 72, ky, { size: 22, color: theme.muted, alpha: inA });
      const g = gapText(s.anchor.gap, s.group.label, i === 1 ? 1 : 0);
      Motion.reveal(ctx, g[0], box.x, ky + 44, l, 5.0, { size: 24, color: theme.ink, until });
      Motion.reveal(ctx, g[1], box.x, ky + 78, l, 5.6, { size: 24, color: theme.ink, until });
      Motion.reveal(ctx, membersText(s.group), box.x, ky + 114, l, 6.2, { size: 22, color: theme.muted, until });
    });
  }
  // Top-right panel: the location (split-flap), its window size, the year, the listed-firm counters.
  function ticker(ctx, theme, { v, ext, alpha, loc }) {
    if (alpha <= 0) return;
    const [y0, y1, u] = yearPair(v); const yr = Math.round(v);
    Motion.panel(ctx, 1420, 70, 440, 210, theme, 0.92 * alpha);
    Motion.flipText(ctx, loc.from.name, loc.to.name, loc.u, { x: 1836, y: 108, size: 24, weight: 600, color: theme.muted, align: 'right', letterSpacing: 2, group: 'location', alpha });
    Motion.flipText(ctx, loc.from.size, loc.to.size, loc.u, { x: 1836, y: 138, size: 22, weight: 400, color: theme.dim, align: 'right', letterSpacing: 1, group: 'location-size', alpha });
    Motion.text(ctx, String(y0), 1836, 212, { size: 84, weight: 700, color: theme.ink, align: 'right', alpha: alpha * (y1 === y0 ? 1 : 1 - u), group: 'year' });
    if (u > 0 && y1 !== y0) Motion.text(ctx, String(y1), 1836, 212, { size: 84, weight: 700, color: theme.ink, align: 'right', alpha: alpha * u, group: 'year' });
    const rc = redCounts[ext][yr];
    Motion.text(ctx, `${fmt.int(rc.red)} listed firms shown red`, 1836, 244, { size: 24, color: theme.treated, align: 'right', alpha, group: 'counters' });
    Motion.text(ctx, `${fmt.int(rc.dark)} without a ${yr} statement`, 1836, 272, { size: 22, color: theme.muted, align: 'right', alpha, group: 'counters' });
  }
  // Bottom-left legend in mark mode (downtown) or cell mode (city, region); modes crossfade by extent alpha.
  function legend(ctx, theme, { ext, yr, alpha, k }) {
    if (alpha <= 0) return;
    const ea = extentAlpha(k), marksW = ea.downtown, cellsW = Math.max(ea.city, ea.region);
    Motion.panel(ctx, 60, 740, 620, 300, theme, 0.92 * alpha);
    const c = counts(ext, yr);
    Motion.text(ctx, 'Firms on no list', 84, 772, { size: 22, weight: 700, color: theme.ink, alpha });
    Motion.text(ctx, 'real revenue against own 2019–2021 average', 84 + Motion.measure(ctx, 'Firms on no list', 22, 700) + 14, 772, { size: 22, color: theme.muted, alpha });
    MM.legendBar(ctx, 84, 790, 460, P.class_colours, breakLabels, theme, { height: 20, size: 22, alpha });
    const row = (i, swatch, label, a, group) => {
      const yy = 868 + i * 32; if (a <= 0) return;
      ctx.save(); ctx.globalAlpha *= a;
      if (swatch === 'ramp') P.class_colours.forEach((cc, j) => { ctx.fillStyle = cc; ctx.fillRect(84 + j * 4, yy, 4, 22); });
      else if (swatch === 'faint') { ctx.fillStyle = theme.land; ctx.fillRect(84, yy, 22, 22); ctx.globalAlpha *= BACK_ALPHA; ctx.fillStyle = P.neutral; ctx.fillRect(84, yy, 22, 22); }
      else if (swatch === 'outline') { ctx.globalAlpha *= 0.5; ctx.strokeStyle = P.neutral; ctx.lineWidth = 1; ctx.strokeRect(84.5, yy + 0.5, 21, 21); }
      else { ctx.fillStyle = swatch; ctx.fillRect(84, yy, 22, 22); }
      ctx.restore();
      Motion.text(ctx, label, 120, yy + 11, { size: 22, color: theme.ink, baseline: 'middle', alpha: a, group });
    };
    // The two modes crossfade row by row in place during a pull-back (one audit group per row).
    if (marksW > 0) {
      const a = alpha * marksW;
      row(0, 'ramp', `own revenue change · ${fmt.int(c.filers_base)} firms`, a, 'legend-0');
      row(1, P.nonfiler, `statement absent this year · ${fmt.int(c.nonfilers_base)}`, a, 'legend-1');
      row(2, 'faint', `no usable revenue baseline · ${fmt.int(c.nobase)}, backdrop`, a, 'legend-2');
      row(3, theme.treated, 'on a supplied list, red from its listing year', a, 'legend-3');
    }
    if (cellsW > 0) {
      const a = alpha * cellsW, gid = CELL_GRID[ext === 'downtown' ? 'city' : ext], sup = supportOf(gid, yr), size = gid === '1km' ? '1 km' : '5 km';
      row(0, 'ramp', `${size} cells with 20 or more firms with a statement · ${fmt.int(sup.supported)}`, a, 'legend-0');
      row(1, 'outline', `1 to 19 · ${fmt.int(sup.thin)}, outline only`, a, 'legend-1');
      row(2, P.nonfiler, `statements absent: downtown scale only (${fmt.int(c.nonfilers_base)} firms)`, a, 'legend-2');
      row(3, 'faint', `no usable revenue baseline · ${fmt.int(c.nobase)}, backdrop`, a, 'legend-3');
      row(4, theme.treated, 'on a supplied list, red from its listing year', a, 'legend-4');
    }
  }
  function pairLabel(ctx, cam, theme, alpha) {
    if (alpha <= 0) return;
    const [qx, qy] = Motion.project(cam, MIDX, MIDY); const lx = qx + 46, ly = qy - 44;
    const str = `Aeroflot and the private firm, ${AN.distance_m} m apart`, w = Motion.measure(ctx, str, 22, 400);
    ctx.save(); ctx.globalAlpha *= alpha; ctx.strokeStyle = theme.ink; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(qx + 6, qy - 6); ctx.lineTo(lx - 8, ly + 6); ctx.stroke();
    ctx.globalAlpha *= 0.6; ctx.fillStyle = theme.stage; ctx.fillRect(lx - 8, ly - 22, w + 16, 32); ctx.restore();   // a light backing over the dense field
    Motion.text(ctx, str, lx, ly, { size: 22, color: theme.ink, alpha, group: 'pairlabel', kind: 'label' });
  }
  function closeText(ctx, theme, l) {
    const cr = counts('region', Y1);
    Motion.reveal(ctx, `${fmt.int(cr.red)} listed firms red by ${Y1} within 160 by 90 km of Moscow`, 80, 140, l, 0.5, { size: 34, weight: 700, color: theme.ink });
    Motion.reveal(ctx, `${fmt.int(cr.red_nonfilers)} of them without a ${Y1} statement`, 80, 186, l, 0.9, { size: 30, weight: 700, color: theme.ink });
    Motion.paragraph(ctx, 'Colours show each firm’s own real revenue change against its 2019–2021 average. No spatial or proximity effect is estimated.', 80, 246, 1000, { size: 25, color: theme.muted, alpha: step(l, 1.8, 0.5) });
    Motion.paragraph(ctx, `Dated by the supplied sanctions list (${fmt.int(TR.inferred_n)} of ${fmt.int(TR.n)} dates inferred). ${fmt.int(TR.undated_n)} undated list members red throughout. Descriptive, not causal. 2025* is a flagged latest-year extension.`, 80, 326, 1000, { size: 25, color: theme.muted, alpha: step(l, 3.0, 0.5) });
    Motion.text(ctx, 'Paths compared, no effect estimated.', 80, 440, { size: 25, color: theme.muted, alpha: step(l, 4.0, 0.5) });
  }
  // The location schedule: entries {start, ext}; the name flips over 0.5 s plus the stagger from each start.
  function locationAt(entries, l) {
    let i = 0; while (i < entries.length - 1 && l >= entries[i + 1].start) i++;
    const to = WINDOW[entries[i].ext], from = i > 0 ? WINDOW[entries[i - 1].ext] : to;
    const n = Math.max(from.name.length, to.name.length), u = i > 0 ? Motion.clamp((l - entries[i].start) / (0.5 + 0.03 * (n - 1)), 0, 1) : 1;
    return { from, to, u };
  }

  // ---- the standalone cut (97 s) ---------------------------------------------------------------
  const T = [['two', 0, 6, 'Two firms'], ['profiles', 6, 22, 'Who are they?'], ['listed', 22, 30, 'Designation'], ['comparison', 30, 42, 'Revenue against comparison group'],
             ['map', 42, 52, 'The map appears'], ['downtown', 52, 66, 'Central Moscow, 2014–2025'], ['city', 66, 78, 'Moscow'], ['region', 78, 90, 'Moscow and surroundings'], ['close', 90, 97, 'Close']];
  const timeline = {}; T.forEach(([id, start, end, title]) => timeline[id] = { id, start, end, title });
  const DURATION = 97;
  const REST = { cx: MX, cy: MY, ox: 960, oy: 540 };
  const keyframes = [];
  const push = (t, k, v, easing) => keyframes.push(Object.assign({ t, k, v }, REST, easing ? { easing } : {}));
  function run(t0, k, hold, trans) { let t = t0; for (let i = 0; i < YEARS.length; i++) { push(t, k, YEARS[i], E.inOutSine); push(t + hold, k, YEARS[i]); t += hold + (i < YEARS.length - 1 ? trans : 0); } return t; }
  push(0, 200, 2021); push(42, 200, 2021); push(52, K.downtown, 2021); push(52.2, K.downtown, 2021);
  run(53, K.downtown, 0.75, 0.3); push(66, K.downtown, Y1);
  push(68.5, K.city, Y0); run(68.5, K.city, 0.55, 0.25); push(78.5, K.city, Y1);
  push(81, K.region, Y0); run(81, K.region, 0.5, 0.25); push(90, K.region, Y1); push(DURATION, K.region, Y1);
  const LOC = [{ start: 42, ext: 'downtown' }, { start: 66.0, ext: 'city' }, { start: 78.5, ext: 'region' }];

  function anchorPositionsStandalone(t, cam) {
    const enter = step(t, 0.2, 2.4, E.outCubic);
    const pL = [Motion.lerp(-40, 820, enter), 540], pR = [Motion.lerp(1960, 1100, enter), 540];   // the neighbour from the left, Aeroflot from the right
    const toCards = step(t, 6, 1.2); const cL = lerp2(pL, COL.left.dot, toCards), cR = lerp2(pR, COL.right.dot, toCards);
    const toMap = step(t, 42, 4); const qa = Motion.project(cam, AX, AY), qb = Motion.project(cam, BX, BY);
    return { A: lerp2(cR, qa, toMap), B: lerp2(cL, qb, toMap), toMap, r: Motion.lerp(14, 4, toMap) };
  }
  const standaloneScenes = [];
  standaloneScenes.push({ id: 'field', title: 'The field', start: 0, end: DURATION, z: 1, fadeIn: 0, fadeOut: 0.8, draw({ ctx, t, cam, stage, theme }) {
    const v = Motion.clamp(cam.v == null ? 2021 : cam.v, Y0, Y1);
    const landAlpha = step(t, 46, 3), fieldReveal = step(t, 46.5, 3), layerReveal = step(t, 52.5, 1.5);
    if (landAlpha > 0) MM.drawBasemap(ctx, stage, cam, bmp, theme, { landAlpha, borderPx: 1.4 });
    const backAlpha = fieldReveal * (BACK_ALPHA + (0.7 - BACK_ALPHA) * (1 - layerReveal));
    drawField(ctx, cam, v, backAlpha, layerReveal);
    drawCells(ctx, stage, cam, v, layerReveal);
    drawTreated(ctx, cam, v, layerReveal, theme);
    const ap = anchorPositionsStandalone(t, cam); const dotsAlpha = 1 - layerReveal;
    const red = step(t, 22.6, 0.8), pulse = 1 + 0.6 * Math.sin(Math.PI * red);
    if (red <= 0) dot(ctx, ap.A, ap.r * pulse, theme.muted, dotsAlpha); else if (red >= 1) dot(ctx, ap.A, ap.r * pulse, theme.treated, dotsAlpha);
    else { dot(ctx, ap.A, ap.r * pulse, theme.muted, dotsAlpha * (1 - red)); dot(ctx, ap.A, ap.r * pulse, theme.treated, dotsAlpha * red); }
    const ringU = step(t, 22.7, 1.4, E.outCubic);
    if (ringU > 0 && ringU < 1) { ctx.save(); ctx.globalAlpha *= 0.9 * (1 - ringU); ctx.strokeStyle = theme.treated; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ap.A[0], ap.A[1], ap.r + 300 * ringU, 0, TAU); ctx.stroke(); ctx.restore(); }
    dot(ctx, ap.B, ap.r, theme.muted, dotsAlpha);
    Motion.reveal(ctx, `Two firms, ${AN.distance_m} m apart in central Moscow`, 960, 330, t, 1.0, { size: 46, weight: 700, color: theme.ink, align: 'center', until: 6.4 });
    Motion.reveal(ctx, 'a private firm nearby', ap.B[0], 596, t, 3.0, { size: 28, color: theme.muted, align: 'center', until: 6.4 });
    Motion.reveal(ctx, 'Aeroflot', ap.A[0], 596, t, 3.3, { size: 30, weight: 700, color: theme.ink, align: 'center', until: 6.4 });
    headers(ctx, theme, Motion.plateau(t, 6.8, 42.4, 0.5, 0.4));
    const nameAlpha = Motion.plateau(t, 42.4, 46.6, 0.4, 0.6);
    if (nameAlpha > 0) { Motion.text(ctx, 'Aeroflot', ap.A[0] + 18, ap.A[1] + 9, { size: 26, weight: 700, color: theme.ink, alpha: nameAlpha }); Motion.text(ctx, 'a private firm nearby', ap.B[0] - 18, ap.B[1] - 14, { size: 24, color: theme.muted, align: 'right', alpha: nameAlpha }); }
    pairLabel(ctx, cam, theme, Motion.plateau(t, 46, DURATION + 1, 0.6, 0));
    const c21 = counts('downtown', 2021); const factAlpha = Motion.plateau(t, 47, 53, 0.5, 0.5);
    if (factAlpha > 0) { Motion.panel(ctx, 60, 950, 980, 90, theme, 0.92 * factAlpha); Motion.text(ctx, `${fmt.int(c21.drawn + c21.treated)} firms in view in 2021. ${fmt.int(c21.with_base_all)} with a usable revenue baseline.`, 84, 1006, { size: 28, color: theme.ink, alpha: factAlpha }); }
    const ext = extentOf(cam.k), yr = Math.round(v);
    ticker(ctx, theme, { v, ext, alpha: step(t, 53, 0.6), loc: locationAt(LOC, t) });
    legend(ctx, theme, { ext, yr, alpha: step(t, 53.2, 0.6), k: cam.k });
    if (t >= 89.5) closeText(ctx, theme, t - 90);
  } });
  standaloneScenes.push({ id: 'cards', title: 'Profiles', start: 6, end: 30.5, z: 2, fadeIn: 0.5, fadeOut: 0.5, draw({ ctx, t, theme }) { profiles(ctx, theme, t - 6, { des: 16.6, until: 24 }); } });
  standaloneScenes.push({ id: 'comparison', title: 'Comparison', start: 30, end: 42.5, z: 2, fadeIn: 0.5, fadeOut: 0.5, draw({ ctx, t, theme }) { comparison(ctx, theme, t - 30, { until: 12 }); } });

  // Alignment probe (?__align=1): the align raster through the same compositing path, with 1 px vector
  // marks two pixels to the right of the projected anchor and of the point 10 km north of it.
  function alignScene(duration) {
    return { id: 'align', title: 'Alignment probe', start: 0, end: duration, z: 9, fadeIn: 0, fadeOut: 0, draw({ ctx, cam, theme }) {
      if (!IMG || !IMG.align) return;
      const [px, py, w, h] = rasterRect(cam, 'downtown');
      ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(IMG.align, px, py, w, h); ctx.restore();
      for (const [x, y] of [[MX, MY], [MX, MY + 10]]) { const [qx, qy] = Motion.project(cam, x, y); ctx.fillStyle = '#00FFFF'; ctx.fillRect(Math.round(qx) + 2, Math.round(qy), 1, 1); }
      Motion.text(ctx, `align probe k=${cam.k.toFixed(3)} centre ${cam.cx.toFixed(4)}, ${cam.cy.toFixed(4)}`, 80, 1040, { size: 22, color: theme.muted });
    } };
  }

  window.TreatedScenes = {
    timeline, DURATION, keyframes, redCounts, cellSums,
    pieces: { drawField, drawCells, drawTreated, headers, profiles, comparison, ticker, legend, pairLabel, closeText, locationAt, extentAlpha, extentOf, counts, WINDOW, COL, dot, run, yearPair },
    make(images, { align = false } = {}) { IMG = images; const sc = standaloneScenes.slice(); if (align) sc.push(alignScene(DURATION)); return { scenes: sc, keyframes, DURATION, timeline }; },
    standalone(images, opts) { return this.make(images, opts); },
    async loadImages(base, { layers = ['downtown'] } = {}) {
      const out = {}; const jobs = [];
      for (const ext of Object.keys(P.files)) {
        out[ext] = {};
        for (const [y, f] of Object.entries(P.files[ext])) {
          out[ext][y] = {};
          for (const which of ['backdrop', 'layer']) {
            if (which === 'layer' && !layers.includes(ext)) continue;
            const img = new Image(); img.src = base + f[which]; out[ext][y][which] = img;
            jobs.push(img.decode().then(() => { if (img.naturalWidth !== 1920 || img.naturalHeight !== 1080) throw new Error('raster ' + f[which] + ' is ' + img.naturalWidth + 'x' + img.naturalHeight); }));
          }
        }
      }
      const al = new Image(); al.src = base + P.align; out.align = al; jobs.push(al.decode());
      await Promise.all(jobs);
      return out;
    },
  };
})();
