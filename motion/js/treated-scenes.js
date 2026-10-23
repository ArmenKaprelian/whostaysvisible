// The Moscow sequence: two firms on one street, a designation, their revenue against their comparison
// groups, and the Moscow field 2014-2025 at three scales (M6 and M7 data, local only; the published
// explainer carries neither this sequence nor its data). Every frame is a pure function of t.
//
// Encoding (author's decisions, 23 October 2026, round 3): firms on any supplied list are one bucket,
// red from their listing year, solid when a statement is available that year and a ring when it is
// absent; firms on no list with a statement that year carry their own real revenue change against
// their 2019-2021 average, relative to the year's median of firms on no list, on one blue scale
// (marks at the downtown scale, 1 km and 5 km cells at the city and region scales); firms without a
// statement are not drawn as marks; the faint neutral backdrop is every firm. The two anchor firms
// keep a fixed-size outline marker in their own colours (amber: Aeroflot, mint: the private firm)
// from the moment they land on the map. No spatial or proximity effect is estimated.
//
// The pieces take beat-relative clocks so the standalone cut and the full presentation share them.
// Data access goes through one CITY object; a second city would supply its own M6 and M7 outputs.
(function () {
  'use strict';
  const D = window.MOTION_DATA;
  if (!D || !D.points || !D.treated || !D.anchors || !D.basemap || !D.moscowcells || !D.moscowcomparison) { window.TreatedScenes = null; return; }
  const CITY = { P: D.points, TR: D.treated, AN: D.anchors, MC: D.moscowcells, CMP: D.moscowcomparison, name: 'Moscow' };
  const P = CITY.P, TR = CITY.TR, AN = CITY.AN, BM = D.basemap, MC = CITY.MC, CMP = CITY.CMP;
  const fmt = Motion.fmt, step = Motion.step, E = Motion.ease, MM = MotionMap, CH = MotionCharts;
  const ramp = (v, a, b) => Motion.clamp((v - a) / (b - a), 0, 1);
  const lerp2 = (p, q, u) => [Motion.lerp(p[0], q[0], u), Motion.lerp(p[1], q[1], u)];
  const TAU = Math.PI * 2;
  const MX = P.anchor.x, MY = P.anchor.y, YEARS = P.years, Y0 = YEARS[0], Y1 = YEARS[YEARS.length - 1];
  const A = AN.a, B = AN.b, AX = A.x_km, AY = A.y_km, BX = B.x_km, BY = B.y_km;
  const BACK_ALPHA = P.backdrop_alpha == null ? 0.25 : P.backdrop_alpha, LAYER_ALPHA = P.layer_alpha == null ? 0.9 : P.layer_alpha;
  const K = { downtown: P.extents.downtown.k, city: P.extents.city.k, region: P.extents.region.k };
  const WINDOW = { downtown: { name: 'Central ' + CITY.name, size: '21 by 12 km' }, city: { name: CITY.name, size: '64 by 36 km' }, region: { name: CITY.name + ' and surroundings', size: '160 by 90 km' } };
  const RING_FLOOR = { downtown: 1.5, city: 2.0, region: 2.5 };   // red marks never shrink below these radii (px)

  // ---- data preparation (once) ---------------------------------------------------------------
  const bmp = MM.buildBasemap(BM);
  const extentAlpha = k => ({ region: ramp(k, 3, 6) * (1 - ramp(k, 22, 30)), city: ramp(k, 14, 22) * (1 - ramp(k, 60, 80)), downtown: ramp(k, 60, 80) * (1 - ramp(k, 150, 260)) });
  const extentOf = k => (k >= 60 ? 'downtown' : k >= 20 ? 'city' : 'region');
  const markRadius = (ext, pile) => { const m = P.extents[ext].mark; return Math.min(m.cap, m.base + m.s * Math.sqrt(Math.max(0, pile - 1))) / 2; };
  const inExtent = (ext, x, y) => { const e = P.extents[ext]; return x >= e.xmin && x <= e.xmax && y >= e.ymin && y <= e.ymax; };
  const stateColour = s => ((s >= '1' && s <= '6') ? P.class_colours[+s - 1] : null);   // 'd' (absent) and 'b' are not drawn
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
  const COL = { left: { x: 430, hx: 460, dot: [430, 236], firm: B, name: 'A private firm nearby', key: 'B' }, right: { x: 1210, hx: 1240, dot: [1210, 236], firm: A, name: 'Aeroflot', key: 'A' } };
  const jurisdictions = (A.listed.jurisdiction_names || []).join(' and ');
  const listedDate = (() => { const d = new Date(A.listed.date + 'T00:00:00Z'); return d.getUTCDate() + ' ' + ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][d.getUTCMonth()] + ' ' + d.getUTCFullYear(); })();
  const anchorColour = (theme, key) => (key === 'A' ? theme.anchorA : theme.anchorB);

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

  // Cells (M7): one Path2D per grid, year and class; 'below' = 1-19 firms with a statement (faint outline).
  const TILES = {};
  for (const [gid, g] of Object.entries(MC.grids)) {
    TILES[gid] = {}; const c = g.cells, idx = {};
    for (let i = 0; i < c.year.length; i++) (idx[c.year[i]] = idx[c.year[i]] || []).push(i);
    for (const y of YEARS) {
      const rows = idx[y] || [];
      TILES[gid][y] = MM.buildTiles(rows.length, rows.map(i => c.ix[i]), rows.map(i => c.iy[i]), j => { const i = rows[j]; return c.cls[i] != null ? c.cls[i] - 1 : (c.f[i] > 0 ? 'below' : null); }, { sizeKm: g.size_km, gapKm: 0.1 * g.size_km, origin: MC.origin });
    }
  }
  const cellSums = {};
  for (const [gid, g] of Object.entries(MC.grids)) { cellSums[gid] = {}; const c = g.cells; for (let i = 0; i < c.year.length; i++) { const y = c.year[i]; const s = cellSums[gid][y] || (cellSums[gid][y] = { f: 0, nfb: 0, nb: 0 }); s.f += c.f[i]; s.nfb += c.nfb[i]; s.nb += c.nb[i]; } }
  const CELL_GRID = { city: '1km', region: '5km' };

  // ---- raster and cell compositing ---------------------------------------------------------------
  let IMG = null; const OFF = [0, 1, 2, 3, 4].map(() => { const c = document.createElement('canvas'); c.width = 1920; c.height = 1080; return c; });
  function yearPair(v) { const y0 = Math.max(Y0, Math.min(Y1, Math.floor(v))), y1 = Math.min(Y1, y0 + 1); return [y0, y1, Motion.clamp(v - y0, 0, 1)]; }
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
  function drawCells(ctx, stage, cam, v, alpha) {
    if (alpha <= 0) return;
    const ea = extentAlpha(cam.k); const [y0, y1, u] = yearPair(v);
    for (const ext of ['region', 'city']) {
      const a = ea[ext] * alpha; if (a <= 0.002) continue;
      const gid = CELL_GRID[ext];
      const layer = (y, target) => {
        const o = target.getContext('2d'); o.setTransform(1, 0, 0, 1, 0, 0); o.globalCompositeOperation = 'source-over'; o.globalAlpha = 1; o.clearRect(0, 0, 1920, 1080);
        o.transform(cam.k, 0, 0, -cam.k, cam.ox - cam.cx * cam.k, cam.oy + cam.cy * cam.k);
        for (const [c, p] of TILES[gid][y]) { if (c === 'below') { o.save(); o.globalAlpha = 0.3; o.strokeStyle = P.neutral; o.lineWidth = 1 / cam.k; o.stroke(p); o.restore(); } else { o.fillStyle = P.class_colours[c]; o.fill(p); } }
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
  // Listed firms as vector marks: their own class until the red-from year, then red: solid when a
  // statement is available, a ring when it is absent (the change fades over the year transition),
  // a stroke of at least 1.5 px and a radius floor per scale, blooming once with an expanding ring.
  function redMark(ctx, px, py, rr, fill, alpha, theme) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = theme.treatedOutline; ctx.beginPath(); ctx.arc(px, py, rr + 1, 0, TAU); ctx.fill();
    ctx.fillStyle = theme.land; ctx.beginPath(); ctx.arc(px, py, rr, 0, TAU); ctx.fill();
    ctx.fillStyle = theme.treated; ctx.globalAlpha = alpha * fill; ctx.beginPath(); ctx.arc(px, py, rr, 0, TAU); ctx.fill();
    if (fill < 1) { ctx.globalAlpha = alpha; ctx.strokeStyle = theme.treated; ctx.lineWidth = Math.max(1.5, Math.min(2.2, rr * 0.5)); ctx.beginPath(); ctx.arc(px, py, Math.max(0.8, rr - ctx.lineWidth / 2), 0, TAU); ctx.stroke(); }
  }
  function drawTreated(ctx, cam, v, alpha, theme) {
    alpha *= 1 - ramp(cam.k, 150, 260);
    if (alpha <= 0) return;
    const [y0, y1, u] = yearPair(v);
    const ext = extentOf(cam.k); const hw = 960 / cam.k + 1, hh = 540 / cam.k + 1, floor = RING_FLOOR[ext];
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
        const f0 = TR.filed[i][y0 - Y0] === '1' ? 1 : 0, f1 = TR.filed[i][y1 - Y0] === '1' ? 1 : 0; const fill = Motion.lerp(f0, f1, E.inOutSine(u));
        const grow = E.outCubic(bloom), flash = 1 + 0.9 * Math.sin(Math.PI * bloom), rr = Math.max(floor, r) * flash;
        if (Motion.audit.on && alpha * present * grow >= 0.05) Motion.audit.marks.push({ x: px, y: py, r: rr + 1 });
        redMark(ctx, px, py, rr, fill, alpha * present * grow, theme);
        if (bloom < 1) { ctx.globalAlpha = alpha * present * (1 - bloom) * 0.9; ctx.strokeStyle = theme.treated; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(px, py, rr + 4 + 22 * E.outCubic(bloom), 0, TAU); ctx.stroke(); }
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---- anchor markers: fixed-size outline symbols with leaders, placed clear of the 2025 red marks ----
  const LABEL = { A: 'Aeroflot', B: 'the private firm' };
  const measure = (() => { const c = document.createElement('canvas').getContext('2d'); return (s, size, weight) => { c.font = Motion.font(size, weight); return c.measureText(s).width; }; })();
  const restCam = ext => ({ cx: MX, cy: MY, k: K[ext], ox: 960, oy: 540 });
  function redMarks2025(ext) {
    const cam = restCam(ext), out = [];
    for (let i = 0; i < TR.n; i++) { if (TR.filed[i][Y1 - Y0] === '-' || TR.red_from[i] > Y1 || !inExtent(ext, TR.x[i], TR.y[i])) continue; const [px, py] = Motion.project(cam, TR.x[i], TR.y[i]); out.push({ x: px, y: py, r: Math.max(RING_FLOOR[ext], markRadius(ext, TR.pile[i])) + 1 }); }
    return out;
  }
  const hits = (box, marks) => marks.reduce((s, m) => s + (box.x <= m.x + m.r && box.x1 >= m.x - m.r && box.y <= m.y + m.r && box.y1 >= m.y - m.r ? 1 : 0), 0);
  const overlapsBox = (a, b) => a.x < b.x1 && a.x1 > b.x && a.y < b.y1 && a.y1 > b.y;
  // Per scale: for each anchor a direction and distance whose label box covers the fewest red marks of
  // 2025, never the other anchor's label or symbol; the nearest among ties. Pure data, computed once.
  const DIRS = [[1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1], [1, 1]].map(([dx, dy]) => { const n = Math.hypot(dx, dy); return [dx / n, dy / n]; });
  const DISTS = [48, 72, 100, 132, 168];
  function labelBox(px, py, dir, dist, w) { const cx = px + dir[0] * dist, cy = py + dir[1] * dist; const x = dir[0] > 0.3 ? cx : dir[0] < -0.3 ? cx - w : cx - w / 2; return { x: x - 8, y: cy - 22, x1: x + w + 8, y1: cy + 10, tx: x, ty: cy, lx: cx, ly: cy }; }
  const OFFSETS = {};
  for (const ext of Object.keys(P.extents)) {
    const cam = restCam(ext), marks = redMarks2025(ext);
    const pa = Motion.project(cam, AX, AY), pb = Motion.project(cam, BX, BY);
    const wA = measure(LABEL.A, 22, 600), wB = measure(LABEL.B, 22, 600);
    let best = null;
    for (const da of DIRS) for (const dA of DISTS) for (const db of DIRS) for (const dB of DISTS) {
      const bA = labelBox(pa[0], pa[1], da, dA, wA), bB = labelBox(pb[0], pb[1], db, dB, wB);
      if (overlapsBox(bA, bB)) continue;
      const inside = b => b.x >= 20 && b.y >= 20 && b.x1 <= 1900 && b.y1 <= 1060; if (!inside(bA) || !inside(bB)) continue;
      const symA = { x: pa[0] - 14, y: pa[1] - 14, x1: pa[0] + 14, y1: pa[1] + 14 }, symB = { x: pb[0] - 14, y: pb[1] - 14, x1: pb[0] + 14, y1: pb[1] + 14 };
      if (overlapsBox(bA, symB) || overlapsBox(bB, symA) || overlapsBox(bA, symA) || overlapsBox(bB, symB)) continue;
      const score = hits(bA, marks) + hits(bB, marks) + 0.001 * (dA + dB);
      if (!best || score < best.score) best = { score, A: { dir: da, dist: dA }, B: { dir: db, dist: dB }, covered: hits(bA, marks) + hits(bB, marks) };
    }
    OFFSETS[ext] = best || { A: { dir: DIRS[1], dist: 72 }, B: { dir: DIRS[5], dist: 72 }, covered: -1 };
  }
  function offsetAt(k, key) {   // blended between the scales by their alphas, so the label moves continuously during a pull-back
    const ea = extentAlpha(Math.min(k, 90)); let sx = 0, sy = 0, sd = 0, sw = 0;
    for (const ext of Object.keys(ea)) { const w = ea[ext]; if (w <= 0) continue; const o = OFFSETS[ext][key]; sx += w * o.dir[0] * o.dist; sy += w * o.dir[1] * o.dist; sd += w * o.dist; sw += w; }
    if (sw <= 0) { const o = OFFSETS.downtown[key]; return { dx: o.dir[0] * o.dist, dy: o.dir[1] * o.dist, dir: o.dir, dist: o.dist }; }
    const dx = sx / sw, dy = sy / sw, n = Math.hypot(dx, dy) || 1; return { dx, dy, dir: [dx / n, dy / n], dist: sd / sw };
  }
  function drawMarker(ctx, cam, theme, key, alpha) {
    if (alpha <= 0) return;
    const colour = anchorColour(theme, key), [px, py] = key === 'A' ? Motion.project(cam, AX, AY) : Motion.project(cam, BX, BY);
    const o = offsetAt(cam.k, key), w = measure(LABEL[key], 22, 600), b = labelBox(px, py, o.dir, o.dist, w);
    ctx.save(); ctx.globalAlpha *= alpha; ctx.strokeStyle = colour; ctx.lineWidth = 2; ctx.lineJoin = 'round';
    ctx.beginPath();
    if (key === 'A') ctx.arc(px, py, 9, 0, TAU); else { ctx.moveTo(px, py - 11); ctx.lineTo(px + 11, py); ctx.lineTo(px, py + 11); ctx.lineTo(px - 11, py); ctx.closePath(); }
    ctx.stroke();
    const start = [px + o.dir[0] * 13, py + o.dir[1] * 13], end = [px + o.dir[0] * (o.dist - 6), py + o.dir[1] * (o.dist - 6)];
    ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(start[0], start[1]); ctx.lineTo(end[0], end[1]); ctx.stroke();
    ctx.restore();
    Motion.panel(ctx, b.x, b.y, b.x1 - b.x, b.y1 - b.y, theme, 0.92 * alpha);
    Motion.text(ctx, LABEL[key], b.tx, b.ty, { size: 22, weight: 600, color: colour, alpha, group: 'anchor-' + key });
  }

  // ---- drawing pieces (beat-relative clocks) ----------------------------------------------------
  function dot(ctx, p, r, color, alpha) { if (alpha <= 0) return; ctx.save(); ctx.globalAlpha *= alpha; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, TAU); ctx.fill(); ctx.restore(); }
  function strip(ctx, x, y, firm, shown, theme, alpha) {   // 12 cells, revealed per year; filled = statement available, outlined = absent
    for (let i = 0; i < YEARS.length; i++) {
      const a = alpha * shown(i); if (a <= 0) continue;
      const filed = firm.years.filed[i]; const xx = x + i * 30;
      ctx.save(); ctx.globalAlpha *= a;
      if (filed) { ctx.fillStyle = theme.accent; ctx.fillRect(xx, y - 20, 24, 24); } else { ctx.strokeStyle = theme.muted; ctx.lineWidth = 1.5; ctx.strokeRect(xx + 0.75, y - 19.25, 22.5, 22.5); }
      ctx.restore();
    }
    Motion.text(ctx, String(Y0), x, y + 30, { size: 22, color: theme.muted, alpha: alpha * shown(0) });
    Motion.text(ctx, String(Y1), x + 11 * 30 + 24, y + 30, { size: 22, color: theme.muted, align: 'right', alpha: alpha * shown(11) });
  }
  function headers(ctx, theme, alpha) {
    if (alpha <= 0) return;
    Motion.text(ctx, COL.left.name, COL.left.hx, 248, { size: 34, weight: 700, color: theme.anchorB, alpha, group: 'header-left' });
    Motion.text(ctx, COL.right.name, COL.right.hx, 248, { size: 34, weight: 700, color: theme.anchorA, alpha, group: 'header-right' });
  }
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
  // The comparison element: one drawing routine between the full-screen layout (u = 0) and the live
  // box on the right edge under the counters (u = 1). progress reveals the first showing; v is the
  // current year in the box (years beyond it in place at reduced opacity, a dot on each line).
  // The panel rectangles enclose their boxes with the tick-label margins at both ends, so every
  // interpolated panel encloses the interpolated boxes and their labels.
  const BIG = { panel: { x: 84, y: 352, w: 1626, h: 450 }, left: { x: 140, y: 400, w: 630, h: 330 }, right: { x: 1050, y: 400, w: 630, h: 330 } };
  const SMALL = { panel: { x: 1420, y: 340, w: 440, h: 290 }, left: { x: 1476, y: 388, w: 140, h: 170 }, right: { x: 1690, y: 388, w: 140, h: 170 } };
  const lerpBox = (a, b, u) => ({ x: Motion.lerp(a.x, b.x, u), y: Motion.lerp(a.y, b.y, u), w: Motion.lerp(a.w, b.w, u), h: Motion.lerp(a.h, b.h, u) });
  function comparisonView(ctx, theme, { u, alpha, progress = 1, textAlpha = 1, v = null, l = 0, until = 12, explain2025 = true }) {
    if (alpha <= 0) return;
    const big = u < 1, live = u >= 1 && v != null;
    ctx.save(); ctx.globalAlpha *= alpha;
    const gone = 1 - step(u, 0, 0.5, E.inOutSine), titleA = textAlpha * (1 - u);   // labels and facts leave in the first half of the move
    if (titleA > 0) {
      Motion.text(ctx, 'Revenue against comparison group', 960, 310, { size: 36, weight: 700, color: theme.ink, align: 'center', alpha: titleA });
      Motion.text(ctx, 'Real revenue, own 2019–2021 average = 100', 960, 346, { size: 24, color: theme.muted, align: 'center', alpha: titleA });
    }
    const pa = step(u, 0.5, 0.5, E.inOutSine);   // the panel fades in behind the chart in the second half of the move
    if (pa > 0) { const pb = lerpBox(BIG.panel, SMALL.panel, u); Motion.panel(ctx, pb.x, pb.y, pb.w, pb.h, theme, 0.92 * pa, 'livebox'); }
    const panels = [['left', CMPB, 'B', 'the private firm', 'firms on no list'], ['right', CMPA, 'A', 'Aeroflot', 'firms listed in 2022']];
    panels.forEach(([side, s, key, firmLabel, groupLabel], i) => {
      const box = lerpBox(BIG[side], SMALL[side], u), colour = anchorColour(theme, key);
      const nameA = pa;   // the group names of the live box arrive with its panel
      if (nameA > 0) Motion.text(ctx, groupLabel, box.x - 40, Motion.lerp(BIG.panel.y, SMALL.panel.y, u) + 30, { size: 22, color: theme.muted, alpha: nameA, group: 'livebox-' + key });   // rides with the box, so it stays inside the interpolated panel
      ctx.save();
      CH.bandLines(ctx, box, { firm: s.firm, band: s.band }, { yDomain: yDomainCmp, yTicks: [25, 50, 100, 200, 400], xTicks: [2014, 2025], xTicksMinor: [2018, 2022], minorAlpha: gone, progress: live ? 1 : progress, theme,
        colors: { firm: colour, median: theme.accentMuted, band: theme.accentMuted, marker: theme.treated }, labels: { firm: firmLabel, median: 'median' }, textAlpha: 1, labelAlpha: gone,
        marker: s.anchor.marker ? { x: s.anchor.marker.year, label: s.anchor.marker.label } : null,
        gapLabel: s.anchor.idx.some(x => x == null) ? { x: 2022, y: 100, text: 'no 2022 statement' } : null,
        current: live ? v : null, compact: u > 0.5 });
      ctx.restore();
      if (big) {   // the key, the two gap facts and the counts of the first showing, fading with the move
        const ky = box.y + box.h + 58, ta = textAlpha * gone;
        if (ta > 0) {
          ctx.save(); ctx.globalAlpha *= ta; ctx.strokeStyle = theme.accentMuted; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(box.x, ky - 6); ctx.lineTo(box.x + 26, ky - 6); ctx.stroke();
          ctx.globalAlpha *= 0.22; ctx.fillStyle = theme.accentMuted; ctx.fillRect(box.x + 36, ky - 14, 26, 16); ctx.restore();
          Motion.text(ctx, 'median and interquartile range of ' + groupLabel, box.x + 72, ky, { size: 22, color: theme.muted, alpha: ta });
          const g = gapText(s.anchor.gap, s.group.label, i === 1 ? 1 : 0);
          Motion.reveal(ctx, g[0], box.x, ky + 44, l, 5.0, { size: 24, color: theme.ink, until, alpha: ta });
          Motion.reveal(ctx, g[1], box.x, ky + 78, l, 5.6, { size: 24, color: theme.ink, until, alpha: ta });
          Motion.reveal(ctx, membersText(s.group), box.x, ky + 114, l, 6.2, { size: 22, color: theme.muted, until, alpha: ta });
        }
      }
    });
    if (big && explain2025 && textAlpha * gone > 0) Motion.reveal(ctx, '2025* is a flagged latest-year extension', 960, 964, l, 6.8, { size: 22, color: theme.muted, align: 'center', until, alpha: textAlpha * gone });
    ctx.restore();
  }
  // Top-right panel: the location (split-flap), its window size, the year, the listed-firm counters.
  function ticker(ctx, theme, { v, ext, alpha, loc }) {
    if (alpha <= 0) return;
    const [y0, y1, u] = yearPair(v); const yr = Math.round(v); const rc = redCounts[ext][yr];
    MM.infoPanel(ctx, theme, { alpha, loc, year: { a: String(y0), b: y1 === y0 ? null : String(y1), u },
      lines: [[`${fmt.int(rc.red)} listed firms shown red`, theme.treated], [`${fmt.int(rc.dark)} without a ${yr} statement`, theme.muted]] });
  }
  // Bottom-left legend (author's instruction, 23 October, round 3): the bar with its two-line title,
  // one muted line with the mark rule and support at each scale, and the red row with its two glyphs.
  function legend(ctx, theme, { alpha, k }) {
    if (alpha <= 0) return;
    const ea = extentAlpha(k);
    Motion.panel(ctx, 60, 802, 700, 238, theme, 0.92 * alpha);
    Motion.text(ctx, (P.legend_title || 'Firms on no list, real revenue against own 2019-2021 average,').replace('2019-2021', '2019–2021'), 84, 834, { size: 22, color: theme.ink, alpha });
    Motion.text(ctx, P.legend_subtitle || 'relative to the year’s median of firms on no list', 84, 862, { size: 22, color: theme.muted, alpha });
    MM.legendBar(ctx, 84, 878, 460, P.class_colours, breakLabels, theme, { height: 20, size: 22, alpha });
    const rule = [['firm marks, sized by firms at the address', ea.downtown], ['1 km cells, 20 or more firms with a statement', ea.city], ['5 km cells, 20 or more firms with a statement', ea.region]];
    for (const [s, w] of rule) if (w > 0) Motion.text(ctx, s, 84, 950, { size: 22, color: theme.muted, alpha: alpha * w, group: 'legend-rule' });
    ctx.save(); ctx.globalAlpha *= alpha;
    ctx.fillStyle = theme.treated; ctx.beginPath(); ctx.arc(95, 987, 9, 0, TAU); ctx.fill();
    ctx.fillStyle = theme.land; ctx.beginPath(); ctx.arc(122, 987, 9, 0, TAU); ctx.fill(); ctx.strokeStyle = theme.treated; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(122, 987, 8, 0, TAU); ctx.stroke();
    ctx.restore();
    Motion.text(ctx, 'on a supplied list, red from its listing year', 146, 987, { size: 22, color: theme.ink, baseline: 'middle', alpha });
    Motion.text(ctx, 'solid: statement available that year · ring: absent that year', 84, 1022, { size: 22, color: theme.muted, alpha });
  }
  // One disclosure where the blue scale first appears: the scale covers firms with a statement that year.
  function disclosure(ctx, theme, alpha) {
    if (alpha <= 0) return;
    const s = 'The scale covers firms on no list with a statement that year.', w = measure(s, 22, 400);
    Motion.panel(ctx, 60, 748, w + 48, 44, theme, 0.92 * alpha);
    Motion.text(ctx, s, 84, 777, { size: 22, color: theme.muted, alpha });
  }
  function closeText(ctx, theme, l, mul = 1) {
    if (mul <= 0) return;
    ctx.save(); ctx.globalAlpha *= mul;
    const cr = counts('region', Y1);
    Motion.reveal(ctx, `${fmt.int(cr.red)} listed firms red by ${Y1} within 160 by 90 km of ${CITY.name}`, 80, 140, l, 0.5, { size: 34, weight: 700, color: theme.ink });
    Motion.reveal(ctx, `${fmt.int(cr.red_nonfilers)} of them without a ${Y1} statement`, 80, 186, l, 0.9, { size: 30, weight: 700, color: theme.ink });
    Motion.paragraph(ctx, 'Colours show each firm’s own real revenue change against its 2019–2021 average, relative to the year’s median of firms on no list. No spatial or proximity effect is estimated.', 80, 246, 1000, { size: 25, color: theme.muted, alpha: step(l, 1.8, 0.5) });
    Motion.paragraph(ctx, `Dated by the supplied sanctions list (${fmt.int(TR.inferred_n)} of ${fmt.int(TR.n)} dates inferred). ${fmt.int(TR.undated_n)} undated list members red throughout. Descriptive, not causal.`, 80, 326, 1000, { size: 25, color: theme.muted, alpha: step(l, 3.0, 0.5) });
    Motion.text(ctx, 'Paths compared, no effect estimated.', 80, 440, { size: 25, color: theme.muted, alpha: step(l, 4.0, 0.5) });
    ctx.restore();
  }
  const locationAt = (entries, l) => MM.locationAt(entries.map(e => Object.assign({ start: e.start }, WINDOW[e.ext])), l);

  // ---- the standalone cut (97 s) ---------------------------------------------------------------
  const T = [['two', 0, 6, 'Two firms'], ['profiles', 6, 22, 'Who are they?'], ['listed', 22, 30, 'Designation'], ['comparison', 30, 42, 'Revenue against comparison group'],
             ['map', 42, 52, 'The map appears'], ['downtown', 52, 66, 'Central Moscow, 2014–2025'], ['city', 66, 78, 'Moscow'], ['region', 78, 90, 'Moscow and surroundings'], ['close', 90, 97, 'Close']];
  const timeline = {}; T.forEach(([id, start, end, title]) => timeline[id] = { id, start, end, title });
  const DURATION = 97;
  const REST = { cx: MX, cy: MY, ox: 960, oy: 540 };
  const keyframes = [];
  const push = (t, k, v, easing) => keyframes.push(Object.assign({ t, k, v }, REST, easing ? { easing } : {}));
  // Year runs: holds and 0.5 s transitions (the ring change and the dissolves share the clock).
  function runYears(kf, t0, k, hold, trans) { let t = t0; YEARS.forEach((y, i) => { kf.push(Object.assign({ t, k, v: y, easing: E.inOutSine }, REST)); kf.push(Object.assign({ t: t + hold, k, v: y }, REST)); t += hold + (i < YEARS.length - 1 ? trans : 0); }); return t; }
  const run = (t0, k, hold, trans) => runYears(keyframes, t0, k, hold, trans);
  push(0, 200, 2021); push(42, 200, 2021); push(52, K.downtown, 2021); push(52.2, K.downtown, 2021);
  run(53, K.downtown, 0.6, 0.5); push(66, K.downtown, Y1);
  push(68.5, K.city, Y0); run(68.5, K.city, 0.35, 0.5); push(78.5, K.city, Y1);
  push(81, K.region, Y0); run(81, K.region, 0.3, 0.5); push(90.5, K.region, Y1); push(DURATION, K.region, Y1);
  const LOC = [{ start: 42, ext: 'downtown' }, { start: 66.0, ext: 'city' }, { start: 78.5, ext: 'region' }];

  function anchorPositionsStandalone(t, cam) {
    const enter = step(t, 0.2, 2.4, E.outCubic);
    const pL = [Motion.lerp(-40, 820, enter), 540], pR = [Motion.lerp(1960, 1100, enter), 540];
    const toCards = step(t, 6, 1.2); const cL = lerp2(pL, COL.left.dot, toCards), cR = lerp2(pR, COL.right.dot, toCards);
    const toMap = step(t, 42, 4); const qa = Motion.project(cam, AX, AY), qb = Motion.project(cam, BX, BY);
    return { A: lerp2(cR, qa, toMap), B: lerp2(cL, qb, toMap), toMap, r: Motion.lerp(14, 5, toMap) };
  }
  const standaloneScenes = [];
  standaloneScenes.push({ id: 'field', title: 'The field', start: 0, end: DURATION, z: 1, fadeIn: 0, fadeOut: 0.8, draw({ ctx, t, cam, stage, theme }) {
    const v = Motion.clamp(cam.v == null ? 2021 : cam.v, Y0, Y1);
    const landAlpha = step(t, 46, 3), fieldReveal = step(t, 46.5, 3), layerReveal = step(t, 52.5, 1.5);
    if (landAlpha > 0) MM.drawBasemap(ctx, stage, cam, bmp, theme, { landAlpha, borderPx: 1 });
    const backAlpha = fieldReveal * (BACK_ALPHA + (0.7 - BACK_ALPHA) * (1 - layerReveal));
    drawField(ctx, cam, v, backAlpha, layerReveal);
    drawCells(ctx, stage, cam, v, layerReveal);
    drawTreated(ctx, cam, v, layerReveal, theme);
    // The two anchors: dots through the intro in their own colours, the red listing ring at the designation, then the markers.
    const ap = anchorPositionsStandalone(t, cam); const dotsAlpha = 1 - layerReveal;
    const red = step(t, 22.6, 0.8), pulse = 1 + 0.6 * Math.sin(Math.PI * red);
    dot(ctx, ap.A, ap.r * pulse, theme.anchorA, dotsAlpha);
    if (red > 0) { ctx.save(); ctx.globalAlpha *= dotsAlpha * red; ctx.strokeStyle = theme.treated; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(ap.A[0], ap.A[1], ap.r * pulse + 5, 0, TAU); ctx.stroke(); ctx.restore(); }
    const ringU = step(t, 22.7, 1.4, E.outCubic);
    if (ringU > 0 && ringU < 1) { ctx.save(); ctx.globalAlpha *= 0.9 * (1 - ringU); ctx.strokeStyle = theme.treated; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ap.A[0], ap.A[1], ap.r + 300 * ringU, 0, TAU); ctx.stroke(); ctx.restore(); }
    dot(ctx, ap.B, ap.r, theme.anchorB, dotsAlpha);
    Motion.reveal(ctx, `Two firms, ${AN.distance_m} m apart in central ${CITY.name}`, 960, 330, t, 1.0, { size: 46, weight: 700, color: theme.ink, align: 'center', until: 6.4 });
    Motion.reveal(ctx, 'a private firm nearby', ap.B[0], 596, t, 3.0, { size: 28, color: theme.anchorB, align: 'center', until: 6.4 });
    Motion.reveal(ctx, 'Aeroflot', ap.A[0], 596, t, 3.3, { size: 30, weight: 700, color: theme.anchorA, align: 'center', until: 6.4 });
    headers(ctx, theme, Motion.plateau(t, 6.8, 42.4, 0.5, 0.4));
    const markerAlpha = Motion.plateau(t, 46, DURATION + 1, 0.6, 0);
    drawMarker(ctx, cam, theme, 'A', markerAlpha); drawMarker(ctx, cam, theme, 'B', markerAlpha);
    const c21 = counts('downtown', 2021); const factAlpha = Motion.plateau(t, 47, 53, 0.5, 0.5);
    if (factAlpha > 0) { Motion.panel(ctx, 60, 950, 980, 90, theme, 0.92 * factAlpha); Motion.text(ctx, `${fmt.int(c21.drawn + c21.treated)} firms in view in 2021. ${fmt.int(c21.with_base_all)} with a usable revenue baseline.`, 84, 1006, { size: 28, color: theme.ink, alpha: factAlpha }); }
    const ext = extentOf(cam.k);
    ticker(ctx, theme, { v, ext, alpha: step(t, 53, 0.6), loc: locationAt(LOC, t) });
    legend(ctx, theme, { alpha: step(t, 53.2, 0.6), k: cam.k });
    disclosure(ctx, theme, Motion.plateau(t, 53.6, 60, 0.5, 0.5));
    // The comparison element, one routine from the full showing (30 s) through the move (42-44 s) into the live box.
    if (t >= 30) { const l = t - 30; comparisonView(ctx, theme, { u: step(l, 12, 2), alpha: step(l, 0.4, 0.5, E.outCubic), progress: step(l, 1.0, 3.5, E.inOutSine), textAlpha: 1, l, until: 12.4, v }); }
    if (t >= 89.5) closeText(ctx, theme, t - 90);
  } });
  standaloneScenes.push({ id: 'cards', title: 'Profiles', start: 6, end: 30.5, z: 2, fadeIn: 0.5, fadeOut: 0.5, draw({ ctx, t, theme }) { profiles(ctx, theme, t - 6, { des: 16.6, until: 24 }); } });

  // ---- the journey section (108 s inside the full cut; every time section-relative) ------------
  // street 0-12 (k 12 to 1200 on the pair's midpoint), profiles 12-28, designation 28-36, comparison
  // 36-50, the map returns 50-58 (k 1200 to 90 while the comparison chart shrinks into its box),
  // downtown 58-72, city 72-84, region 84-96, close 96-103, out 103-108 (the camera leaves for the
  // country; the explainer's keyframes continue from the last one here).
  const SEC = { street: 0, profiles: 12, designation: 28, comparison: 36, back: 50, downtown: 58, city: 72, region: 84, close: 96, out: 103, end: 108 };
  const MID = { cx: (AX + BX) / 2, cy: (AY + BY) / 2, ox: 960, oy: 540 };
  function journeyKeyframes(S) {
    const kf = []; const at = (t, k, v, base) => kf.push(Object.assign({ t: S + t, k, v }, base || REST));
    at(SEC.street, K.region, 2021); at(SEC.profiles, 1200, 2021, MID); at(SEC.back, 1200, 2021, MID); at(SEC.back + 5, K.downtown, 2021); at(SEC.downtown, K.downtown, 2021);
    runYears(kf, S + SEC.downtown + 0.8, K.downtown, 0.75, 0.3); at(SEC.city, K.downtown, Y1);
    at(SEC.city + 2.5, K.city, Y0); runYears(kf, S + SEC.city + 2.5, K.city, 0.55, 0.25); at(SEC.region, K.city, Y1);
    at(SEC.region + 2.5, K.region, Y0); runYears(kf, S + SEC.region + 2.5, K.region, 0.5, 0.25); at(SEC.close, K.region, Y1); at(SEC.out, K.region, Y1);
    return kf;
  }
  // The anchors between their projected positions and the card headers; the dot grows from the mark's
  // size on the map to 14 px as the field dissolves above k 150.
  function anchorPositionsJourney(l, cam) {
    const qa = Motion.project(cam, AX, AY), qb = Motion.project(cam, BX, BY);
    const w = step(l, SEC.profiles, 1.2) * (1 - step(l, SEC.back, 4));
    const r = Motion.lerp(1.5 * cam.k / 90, 14, ramp(cam.k, 150, 400));
    return { A: lerp2(qa, COL.right.dot, w), B: lerp2(qb, COL.left.dot, w), r };
  }
  function journey(images, S) {
    IMG = images;
    const LOCJ = [{ start: SEC.back, ext: 'downtown' }, { start: SEC.city, ext: 'city' }, { start: SEC.region, ext: 'region' }];
    const field = { id: 'field', title: 'The Moscow field', start: S, end: S + SEC.end, z: 1.5, fadeIn: 0, fadeOut: 0, draw({ ctx, t, cam, stage, theme }) {
      const l = t - S, k = cam.k;
      const v = Motion.clamp(cam.v == null ? 2021 : cam.v, Y0, Y1);
      const outA = 1 - step(l, SEC.out, 1.5), marksOut = 1 - step(l, SEC.out + 0.5, 2);
      const layerReveal = step(l, SEC.downtown + 0.5, 1.5) * marksOut;
      // The 2021 backdrop: in with the street zoom (k 60-80) and out above k 150-260 (the scale ramps
      // sit in extentAlpha), back with the return, dimmed once the outcome layer shows; before the
      // downtown beat only the downtown extent is drawn.
      const backAlpha = (BACK_ALPHA + (0.7 - BACK_ALPHA) * (1 - layerReveal)) * (l < SEC.downtown ? ramp(k, 60, 80) : 1) * marksOut;
      drawField(ctx, cam, v, backAlpha, layerReveal);
      drawCells(ctx, stage, cam, v, layerReveal);
      drawTreated(ctx, cam, v, layerReveal, theme);
      // The two anchors: vector dots from k 60, the red listing ring at the designation, gliding to
      // the card headers and back, then the fixed-size markers once the field is drawn.
      const ap = anchorPositionsJourney(l, cam); const dotsAlpha = ramp(k, 60, 80) * (1 - layerReveal);
      const red = step(l, SEC.designation + 0.6, 0.8), pulse = 1 + 0.6 * Math.sin(Math.PI * red);
      dot(ctx, ap.A, ap.r * pulse, theme.anchorA, dotsAlpha);
      if (red > 0) { ctx.save(); ctx.globalAlpha *= dotsAlpha * red; ctx.strokeStyle = theme.treated; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(ap.A[0], ap.A[1], ap.r * pulse + 5, 0, TAU); ctx.stroke(); ctx.restore(); }
      const ringU = step(l, SEC.designation + 0.7, 1.4, E.outCubic);
      if (ringU > 0 && ringU < 1) { ctx.save(); ctx.globalAlpha *= 0.9 * (1 - ringU); ctx.strokeStyle = theme.treated; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ap.A[0], ap.A[1], ap.r + 300 * ringU, 0, TAU); ctx.stroke(); ctx.restore(); }
      dot(ctx, ap.B, ap.r, theme.anchorB, dotsAlpha);
      const introUntil = SEC.profiles + 0.4;
      Motion.reveal(ctx, `Two firms, ${AN.distance_m} m apart in central ${CITY.name}`, 960, 330, l, 6.5, { size: 46, weight: 700, color: theme.ink, align: 'center', until: introUntil });
      Motion.reveal(ctx, 'a private firm nearby', ap.B[0] - 26, ap.B[1], l, 8.0, { size: 28, color: theme.anchorB, align: 'right', baseline: 'middle', until: introUntil });
      Motion.reveal(ctx, 'Aeroflot', ap.A[0] + 26, ap.A[1], l, 8.3, { size: 30, weight: 700, color: theme.anchorA, baseline: 'middle', until: introUntil });
      headers(ctx, theme, Motion.plateau(l, SEC.profiles + 0.8, SEC.back + 0.4, 0.5, 0.4));
      const markerAlpha = Motion.plateau(l, SEC.back + 2.5, SEC.out, 0.6, 0.5);   // findable to the end of the section
      drawMarker(ctx, cam, theme, 'A', markerAlpha); drawMarker(ctx, cam, theme, 'B', markerAlpha);
      const c21 = counts('downtown', 2021); const factAlpha = Motion.plateau(l, SEC.back + 3.5, SEC.downtown + 1, 0.5, 0.5);
      if (factAlpha > 0) { Motion.panel(ctx, 60, 950, 980, 90, theme, 0.92 * factAlpha); Motion.text(ctx, `${fmt.int(c21.drawn + c21.treated)} firms in view in 2021. ${fmt.int(c21.with_base_all)} with a usable revenue baseline.`, 84, 1006, { size: 28, color: theme.ink, alpha: factAlpha }); }
      ticker(ctx, theme, { v, ext: extentOf(k), alpha: step(l, SEC.downtown + 1, 0.6) * outA, loc: locationAt(LOCJ, l) });
      legend(ctx, theme, { alpha: step(l, SEC.downtown + 1.2, 0.6) * outA, k });
      disclosure(ctx, theme, Motion.plateau(l, SEC.downtown + 1.6, SEC.downtown + 8, 0.5, 0.5));
      if (l >= SEC.comparison) { const lc = l - SEC.comparison; comparisonView(ctx, theme, { u: step(lc, 14, 2), alpha: step(lc, 0.4, 0.5, E.outCubic) * outA, progress: step(lc, 1.0, 3.5, E.inOutSine), textAlpha: 1, l: lc, until: 14.4, v, explain2025: false }); }
      if (l >= SEC.close - 0.5) closeText(ctx, theme, l - SEC.close, outA);
    } };
    const cards = { id: 'cards', title: 'Profiles', start: S + SEC.profiles, end: S + SEC.comparison + 0.5, z: 2, fadeIn: 0.5, fadeOut: 0.5, draw({ ctx, t, theme }) { profiles(ctx, theme, t - S - SEC.profiles, { des: 16.6, until: 24 }); } };
    const chapters = [['street', 0, SEC.designation, 'Two firms'], ['designation', SEC.designation, SEC.comparison, 'Designation'], ['comparison', SEC.comparison, SEC.back, 'Revenue against comparison group'],
                      ['downtown', SEC.back, SEC.city, `Central ${CITY.name}, ${Y0}–${Y1}`], ['city', SEC.city, SEC.region, CITY.name], ['region', SEC.region, SEC.close, `${CITY.name} and surroundings`], ['close', SEC.close, SEC.end, 'Close']];
    const timeline = {}; chapters.forEach(([id, a, b, title]) => timeline[id] = { id, start: S + a, end: S + b, title });
    return { scenes: [field, cards], keyframes: journeyKeyframes(S), timeline, rest: REST, SEC, start: S, end: S + SEC.end };
  }

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
    timeline, DURATION, keyframes, redCounts, cellSums, OFFSETS, CITY, SEC, journey,
    pieces: { drawField, drawCells, drawTreated, drawMarker, headers, profiles, comparisonView, ticker, legend, disclosure, closeText, locationAt, extentAlpha, extentOf, counts, WINDOW, COL, dot, run, yearPair, anchorColour, LABEL },
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
