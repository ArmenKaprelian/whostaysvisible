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
  if (!D || !D.points || !D.treated || !D.anchors || !D.basemap || !D.moscowcells || !D.moscowcomparison || !D.national || !D.treatednational) { window.TreatedScenes = null; return; }
  const CITY = { P: D.points, TR: D.treated, AN: D.anchors, MC: D.moscowcells, CMP: D.moscowcomparison, name: 'Moscow' };
  const P = CITY.P, TR = CITY.TR, AN = CITY.AN, BM = D.basemap, MC = CITY.MC, CMP = CITY.CMP, SF = D.series.facts;
  // The national year run (M8, round 4): its rasters, counts and camera join the Moscow manifest as a
  // fourth extent; its listed firms nationwide join the Moscow set as marks outside the region rectangle.
  const NP = D.national, TRN = D.treatednational, NATCAM = NP.camera;
  P.extents.national = NP.extent; P.files.national = NP.files; P.counts.national = NP.counts;
  const fmt = Motion.fmt, step = Motion.step, E = Motion.ease, MM = MotionMap, CH = MotionCharts;
  const ramp = (v, a, b) => Motion.clamp((v - a) / (b - a), 0, 1);
  const lerp2 = (p, q, u) => [Motion.lerp(p[0], q[0], u), Motion.lerp(p[1], q[1], u)];
  const TAU = Math.PI * 2;
  const MX = P.anchor.x, MY = P.anchor.y, YEARS = P.years, Y0 = YEARS[0], Y1 = YEARS[YEARS.length - 1];
  const A = AN.a, B = AN.b, AX = A.x_km, AY = A.y_km, BX = B.x_km, BY = B.y_km;
  const BACK_ALPHA = P.backdrop_alpha == null ? 0.25 : P.backdrop_alpha, LAYER_ALPHA = P.layer_alpha == null ? 0.9 : P.layer_alpha;
  const K = { downtown: P.extents.downtown.k, city: P.extents.city.k, region: P.extents.region.k, national: P.extents.national.k };
  const NATBASE = { cx: NATCAM.cx, cy: NATCAM.cy, ox: NATCAM.ox, oy: NATCAM.oy };
  const WINDOW = { downtown: { name: 'Central ' + CITY.name, size: '21 by 12 km' }, city: { name: CITY.name, size: '64 by 36 km' }, region: { name: CITY.name + ' and surroundings', size: '160 by 90 km' }, national: { name: 'Russia', size: 'about 6 km per pixel' } };
  const RING_FLOOR = { downtown: 1.5, city: 2.0, region: 2.5, national: 1.5 };   // red marks never shrink below these radii (px)

  // ---- data preparation (once) ---------------------------------------------------------------
  const bmp = MM.buildBasemap(BM);
  const extentAlpha = k => ({ national: 1 - ramp(k, 1.0, 3.0), region: ramp(k, 3, 6) * (1 - ramp(k, 22, 30)), city: ramp(k, 14, 22) * (1 - ramp(k, 60, 80)), downtown: ramp(k, 60, 80) * (1 - ramp(k, 110, 150)) });
  const extentOf = k => (k >= 60 ? 'downtown' : k >= 20 ? 'city' : k >= 2 ? 'region' : 'national');
  // The national raster fades in only once it is within 1.3 times its rest size (author, round 4 close); the
  // marks' two sets still cross-fade between k 3 and 1 (extentAlpha.national), so the pull-back is never bare.
  const nationalRaster = k => 1 - ramp(k, K.national, K.national * 1.3);
  const markRadius = (ext, pile) => { const m = P.extents[ext].mark; return Math.min(m.cap, m.base + m.s * Math.sqrt(Math.max(0, pile - 1))) / 2; };
  const inExtent = (ext, x, y) => { const e = P.extents[ext]; return x >= e.xmin && x <= e.xmax && y >= e.ymin && y <= e.ymax; };
  const stateColour = s => ((s >= '1' && s <= '6') ? P.class_colours[+s - 1] : s === 'd' ? P.nonfiler : s === 'b' ? (P.zero || P.neutral) : null);   // before its listing year every present member is drawn (25 October 2026): its class, the dark control colour for 'd' (baseline, no statement), the backdrop neutral for 'b' (no usable baseline)
  // Two mark sets: the Moscow set (M6: every listed firm with a row in the region rectangle, at its
  // latest coordinates there) for the Moscow scales, and the nationwide set (M8: every listed firm at
  // its latest coordinates anywhere) for the national scale. They cross-fade with the rasters by scale;
  // each scale's counters come from its own set, as its manifest does.
  const SETS = { moscow: TR, national: TRN };
  const setOf = ext => (ext === 'national' ? TRN : TR);
  const redCounts = {}, presentCounts = {};
  for (const ext of Object.keys(P.extents)) { const S = setOf(ext); redCounts[ext] = {}; for (const y of YEARS) { let red = 0, dark = 0, ringed = 0; for (let i = 0; i < S.n; i++) { const ch = S.filed[i][y - Y0]; if (ch === '-' || !inExtent(ext, S.x[i], S.y[i])) continue; if (S.red_from[i] > y) { ringed++; continue; } red++; if (ch === '0') dark++; } redCounts[ext][y] = { red, dark, ringed }; } }
  // members present that year in the extent, counted apart from the red and ringed loop: the page refuses to build unless ringed = present − red
  for (const ext of Object.keys(P.extents)) { const S = setOf(ext); presentCounts[ext] = {}; for (const y of YEARS) { let present = 0; for (let i = 0; i < S.n; i++) if (S.filed[i][y - Y0] !== '-' && inExtent(ext, S.x[i], S.y[i])) present++; presentCounts[ext][y] = present; } }
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
  const mixHex = (a, b, u) => { if (u <= 0) return a; if (u >= 1) return b; const c = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)), x = c(a), y = c(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * u).toString(16).padStart(2, '0')).join(''); };
  const aeroflotColour = (theme, inkU) => mixHex(theme.anchorA, theme.ink, inkU);   // Aeroflot keeps the anchor amber; where the diverging pair's amber shares the frame (the revenue classes of the Moscow runs), its marker and line take the ink with the circle marker (Part B item 2, the author's decision of 25 October 2026)

  // Comparison groups (M7): the firm's index against its group's median and quartiles.
  const cmpSeries = (gid, anchor) => {
    const g = CMP.groups[gid], by = g.by_year;
    const band = by.year.map((y, i) => ({ x: y, med: by.med[i], q1: by.q1[i], q3: by.q3[i], n: by.n[i] }));
    const firm = anchor.years.map((y, i) => ({ x: y, y: anchor.idx[i] }));
    return { band, firm, group: g, anchor };
  };
  const CMPA = cmpSeries('listed2022', CMP.anchors.a), CMPB = cmpSeries('nolist', CMP.anchors.b);
  // The paired y-axis follows the data (round 13, the author's request of 25 October 2026): the lower bound the largest of a nice set at or below 0.9 times the smallest value drawn
  // in either panel (a quartile or a firm's index), the upper bound the smallest at or above 1.1 times the largest; 20 to 250 with the shipped data (10 to 500 before).
  const cmpLo = 0.9 * Math.min(CMP.extremes.min_q1, CMP.extremes.min_idx), cmpHi = 1.1 * Math.max(CMP.extremes.max_q3, CMP.extremes.max_idx);
  const yDomainCmp = [[10, 15, 20, 25, 30, 40, 50].filter(v => v <= cmpLo).pop() || 10, [150, 200, 250, 300, 400, 500].find(v => v >= cmpHi) || 500];
  const yTicksCmp = [25, 50, 100, 200, 400].filter(t => t >= yDomainCmp[0] && t <= yDomainCmp[1]);
  const gapText = (gap, groupLabel, decimals) => {
    const word = v => (Math.abs(v) < 0.5 ? 'at the median' : fmt.dec(Math.abs(v), decimals) + ' points ' + (v > 0 ? 'above' : 'below'));
    const en = s => s.replace('-', '–');
    return [`${en(gap.years_before)}: on average ${word(gap.before)}${Math.abs(gap.before) < 0.5 ? '' : ' the median'} of ${groupLabel}.`, `${en(gap.years_after)}: ${word(gap.after)}${Math.abs(gap.after) < 0.5 ? '' : ' it'}.`];
  };
  const groupName = g => (g === CMP.groups.listed2022 ? 'firms on a list from 2022' : g.label);   // the data's own label says "listed", never on screen for list membership (round 15)
  const membersText = g => `${fmt.int(g.members)} ${groupName(g)}, ${fmt.int(Math.min(...g.by_year.n))} to ${fmt.int(Math.max(...g.by_year.n))} with a statement per year`;

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
  // The camera's v is a year; with a kept-year list active (a cut that drops years, author's side project
  // of 23 October) it is a position in that list, so a dissolve joins two kept years directly. The list is
  // set by the journey's field scene for its own draw only; every other cut keeps the year semantics.
  let YL_ACTIVE = null;
  function yearPair(v) {
    if (YL_ACTIVE) { const n = YL_ACTIVE.length, i = Math.max(0, Math.min(n - 1, Math.floor(v))), j = Math.min(n - 1, i + 1); return [YL_ACTIVE[i], YL_ACTIVE[j], Motion.clamp(v - i, 0, 1)]; }
    const y0 = Math.max(Y0, Math.min(Y1, Math.floor(v))), y1 = Math.min(Y1, y0 + 1); return [y0, y1, Motion.clamp(v - y0, 0, 1)];
  }
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
    for (const ext of ['national', 'region', 'city', 'downtown']) {
      const a = ext === 'national' ? nationalRaster(cam.k) : ea[ext]; if (a <= 0.002) continue;
      const [px, py, w, h] = rasterRect(cam, ext);
      ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      if (backAlpha > 0) { ctx.save(); ctx.globalAlpha *= a * backAlpha; ctx.drawImage(blendYears(OFF[0], ext, 'backdrop', v), px, py, w, h); ctx.restore(); }
      // The city and region scales draw cells instead of their outcome layers.
      if (layerAlpha > 0 && (ext === 'downtown' || ext === 'national')) { ctx.save(); ctx.globalAlpha *= a * layerAlpha * LAYER_ALPHA; ctx.drawImage(blendYears(OFF[1], ext, 'layer', v), px, py, w, h); ctx.restore(); }
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
  // The red mark is MM.listedMark (shared with the atlas); its size, halo and opacity follow MM.listedRule by zoom (25 October 2026).
  const listedRuleAt = (ext, k) => { const m = P.extents[ext].mark; return MM.listedRule([m.base, m.s, m.cap, RING_FLOOR[ext]], k, K.national); };
  // The year runs' schedule (section-relative start of the first year's hold, the hold, the transition), shared by the
  // keyframes and the pulse's ring decay: tStart(Y, ext) is when the transition into year Y begins.
  let RUNS = null;   // filled beside SEC below, once the section's times exist
  // A run may hold one year longer (the bold cut's national run holds 2024 for the sweep): [t0, hold, trans, longYear, longHold].
  const tStart = (Y, ext) => { const [t0, hold, trans, ly, lh] = RUNS[ext]; return t0 + (Y - Y0) * (hold + trans) - trans + (ly != null && Y > ly ? lh - hold : 0); };
  // rewind: while the year runs backwards (the pull-backs), a listing is a plain crossfade, not a bloom.
  function drawTreated(ctx, cam, v, alpha, theme, rewind = false, l = null) {   // l: the section clock, for the ring decay (null: the bloom's own clock)
    alpha *= 1 - ramp(cam.k, 110, 150);
    if (alpha <= 0) return;
    const wNat = extentAlpha(cam.k).national;
    if (wNat < 1) drawMarkSet(ctx, cam, v, alpha * (1 - wNat), theme, TR, rewind, l);
    if (wNat > 0) drawMarkSet(ctx, cam, v, alpha * wNat, theme, TRN, rewind, l);
  }
  // The video's bloom timings (round 9): the flash over the year transition with the pale core and the glow, the rings' decay
  // and the west-to-east stagger fitted inside each run's hold, so RUNS and the year timing are unchanged (the national and
  // region ring decay is 0.55 s, from 0.6, to make room for the stagger). Rings only for firms listed from 2015 on and dated
  // (the 2014 and undated members are red from the first frame and never bloom).
  const VP = { downtown: { attack: 0.09, release: 0.21, ringDelay: 0.05, glow: 0.30, decay: 0.85, cull: 80 }, city: { attack: 0.075, release: 0.175, ringDelay: 0.05, glow: 0.25, decay: 0.60, cull: 80 },
               region: { attack: 0.075, release: 0.175, ringDelay: 0.05, glow: 0.25, decay: 0.55, cull: 80 }, national: { attack: 0.075, release: 0.175, ringDelay: 0.05, glow: 0.25, decay: 0.55, cull: 80 } };
  const SPREAD = { downtown: 0.06, city: 0.08, region: 0.10, national: 0.10 };   // s: the stagger across the extent, west to east
  const PH = { on: false, swell: 0, release: 0, grow: 0, glowA: 0, p: 0 };   // the bloom phase of the mark being drawn, reused
  const stagger = (ext, x) => { const e = P.extents[ext]; return SPREAD[ext] * Motion.clamp((x - e.xmin) / (e.xmax - e.xmin), 0, 1); };
  // The atlas's pulse in the film (the bold cut of 29 October 2026): each newly red mark swells (MM.swellPhase, MM.swellPeak) and settles back over 0.9 s,
  // with no glow, pale core or rings (all three retired in the atlas, rounds 15 and 22); the west-to-east stagger stays. At the national run's 2024 hold,
  // the year the most firms were added to a list, the atlas's round-24 sweep: a front crosses the country west to east by longitude in 1.5 s, each firm
  // swells as it passes, and the year's minimum spanning tree by distance traces behind it, each edge held 0.3 s and gone over 0.6 s (explorer-app.js).
  const SWELL = true;
  const SWEEP = { year: 2024, pass: 1.5, hold: 0.3, fade: 0.6 };
  const sweepIn = i => TRN.red_from[i] === SWEEP.year && !TRN.undated[i] && TRN.filed[i][SWEEP.year - Y0] !== '-';   // the atlas's mask: added in the year, present that year
  const SW = (() => {   // the sweep's firms, each one's delay (s) by longitude, and the tree; built once
    const R = 6371, sp = Math.sin(Math.PI / 3), cp = Math.cos(Math.PI / 3), idx = [], lon = [];   // the km plane is spherical LAEA about 60 N, 100 E (map-layers.js)
    for (let i = 0; i < TRN.n; i++) { if (!sweepIn(i)) continue; const x = TRN.x[i], y = TRN.y[i], rho = Math.hypot(x, y), cc = 2 * Math.asin(Math.min(1, rho / (2 * R)));
      idx.push(i); lon.push(rho < 1e-9 ? 100 : 100 + Math.atan2(x * Math.sin(cc), rho * cp * Math.cos(cc) - y * sp * Math.sin(cc)) * 180 / Math.PI); }
    const l0 = Math.min(...lon), l1 = Math.max(...lon), delay = new Float32Array(TRN.n).fill(-1);
    idx.forEach((i, j) => { delay[i] = l1 > l0 ? SWEEP.pass * (lon[j] - l0) / (l1 - l0) : 0; });
    // Prim's minimum spanning tree by km distance, each edge kept west end first so it traces with the front (the atlas's treeOf)
    const m = idx.length, X = idx.map(i => TRN.x[i]), Y = idx.map(i => TRN.y[i]), best = new Float64Array(m).fill(Infinity), from = new Int32Array(m), used = new Uint8Array(m), a = [], b = [];
    let cur = 0; if (m) used[0] = 1;
    for (let it = 1; it < m; it++) {
      let bi = -1, bd = Infinity;
      for (let j = 0; j < m; j++) { if (used[j]) continue; const dx = X[j] - X[cur], dy = Y[j] - Y[cur], d = dx * dx + dy * dy; if (d < best[j]) { best[j] = d; from[j] = cur; } if (best[j] < bd) { bd = best[j]; bi = j; } }
      used[bi] = 1; const p = idx[from[bi]], q = idx[bi]; if (delay[p] <= delay[q]) { a.push(p); b.push(q); } else { a.push(q); b.push(p); } cur = bi;
    }
    return { count: m, delay, a, b };
  })();
  const sweepDelay = (ext, MARKS, i) => (SWELL && ext === 'national' && MARKS === TRN && SW.delay[i] >= 0 ? SW.delay[i] : stagger(ext, MARKS.x[i]));
  // The trail under the marks: each edge traces from its west end as the front passes, holds, then fades in four steps, on a casing in the stage colour.
  function drawTrail(ctx, cam, l, alpha, theme, LR) {
    const t = l - tStart(SWEEP.year, 'national'); if (t <= 0 || t > SWEEP.pass + SWEEP.hold + SWEEP.fade + 0.1 || alpha <= 0) return;
    const rr = LR.floor + MM.swellPeak(LR.floor), min2 = Math.max(36, rr * rr);
    const live = new Path2D(), steps = [new Path2D(), new Path2D(), new Path2D(), new Path2D()], A = [1, 0.75, 0.5, 0.25];
    for (let e = 0; e < SW.a.length; e++) {
      const i = SW.a[e], j = SW.b[e], [ax, ay] = Motion.project(cam, TRN.x[i], TRN.y[i]), [bx, by] = Motion.project(cam, TRN.x[j], TRN.y[j]), dx = bx - ax, dy = by - ay;
      if (dx * dx + dy * dy < min2) continue;
      const da = SW.delay[i], db = SW.delay[j]; if (t < da) continue;
      const f = db > da ? Math.min(1, (t - da) / (db - da)) : 1;
      if (f < 1) { live.moveTo(ax, ay); live.lineTo(ax + dx * f, ay + dy * f); continue; }
      const age = t - db - SWEEP.hold; if (age >= SWEEP.fade) continue;
      const q = age <= 0 ? 0 : Math.min(3, Math.floor(age / SWEEP.fade * 4)); steps[q].moveTo(ax, ay); steps[q].lineTo(bx, by);
    }
    ctx.save(); ctx.lineCap = 'round';
    for (let q = 3; q >= 0; q--) { ctx.strokeStyle = theme.stage; ctx.globalAlpha = alpha * 0.6 * A[q]; ctx.lineWidth = 4.5; ctx.stroke(steps[q]); ctx.strokeStyle = theme.treated; ctx.globalAlpha = alpha * 0.85 * A[q]; ctx.lineWidth = 2; ctx.stroke(steps[q]); }
    ctx.strokeStyle = theme.stage; ctx.globalAlpha = alpha * 0.6; ctx.lineWidth = 5.5; ctx.stroke(live); ctx.strokeStyle = theme.treated; ctx.globalAlpha = alpha; ctx.lineWidth = 3; ctx.stroke(live);
    ctx.restore();
  }
  // The sweep's caption, in the atlas's words (the red button's label and the pulse's tooltip), for the length of the 2024 hold.
  function sweepCaption(ctx, theme, l, mul) {
    const t0 = tStart(SWEEP.year, 'national'), t1 = t0 + RUNS.national[2] + RUNS.national[4], a = mul * Motion.plateau(l, t0, t1 + 0.3, 0.3, 0.4); if (a <= 0) return;
    const s1 = `${fmt.int(SW.count)} FIRMS ADDED TO A LIST IN ${SWEEP.year}`, s2 = 'Lines join them by distance only.', w = Math.max(measure(s1, 24, 500) + 23 * 24 * 0.08, measure(s2, 22, 400));
    Motion.panel(ctx, 60, 92, w + 48, 104, theme, 0.92 * a);
    Motion.text(ctx, s1, 84, 132, { size: 24, weight: 500, color: theme.ink, letterSpacing: 24 * 0.08, alpha: a, group: 'sweep-caption' });
    Motion.text(ctx, s2, 84, 170, { size: 22, color: theme.muted, alpha: a, group: 'sweep-caption-2' });
  }
  function drawMarkSet(ctx, cam, v, alpha, theme, MARKS, rewind, l = null) {
    const [y0, y1, u] = yearPair(v); const vy = y0 + (y1 - y0) * u;   // the year value of the pair (equal to v without a kept-year list)
    const ext = extentOf(cam.k), LR = listedRuleAt(ext, cam.k), VPX = VP[ext]; const hw = (960 + MM.PULSE.cull) / cam.k + 1, hh = (540 + MM.PULSE.cull) / cam.k + 1;   // 80 px beyond the frame: the largest flash and ring stay inside
    const clock = l != null && !rewind;   // the section clock drives each firm's bloom from its own start; without it (kept-year cuts) the year value does
    const inView = i => { const x = MARKS.x[i], y = MARKS.y[i]; return !(x < cam.cx - hw || x > cam.cx + hw || y < cam.cy - hh || y > cam.cy + hh); };
    if (SWELL && clock && ext === 'national' && MARKS === TRN) drawTrail(ctx, cam, l, alpha, theme, LR);
    if (clock && !SWELL) for (let i = 0; i < MARKS.n; i++) {   // pass 0: the pale glows of the blooming marks under everything
      if (MARKS.red_from[i] <= Y0 || MARKS.undated[i] || !inView(i)) continue;
      const s0 = MARKS.state[i][y0 - Y0], s1 = MARKS.state[i][y1 - Y0]; const present = Motion.lerp(s0 === '-' ? 0 : 1, s1 === '-' ? 0 : 1, u); if (present <= 0) continue;
      MM.pulsePhase(l - tStart(MARKS.red_from[i], ext) - stagger(ext, MARKS.x[i]), PH, VPX);
      if (!PH.on || PH.glowA <= 0.01) continue;
      const [px, py] = Motion.project(cam, MARKS.x[i], MARKS.y[i]); const r = MM.listedRadius(LR, MARKS.pile[i]);
      MM.glowDisc(ctx, px, py, 2 * (r + MM.flashPeak(r) * PH.swell), PH.glowA * alpha * present, theme);
    }
    for (let i = 0; i < MARKS.n; i++) {
      if (!inView(i)) continue;
      const x = MARKS.x[i], y = MARKS.y[i], yl = MARKS.red_from[i];
      const s0 = MARKS.state[i][y0 - Y0], s1 = MARKS.state[i][y1 - Y0];
      const present = Motion.lerp(s0 === '-' ? 0 : 1, s1 === '-' ? 0 : 1, u); if (present <= 0) continue;
      const [px, py] = Motion.project(cam, x, y); const r = MM.listedRadius(LR, MARKS.pile[i]);   // the listed rule's floor and cap by zoom
      const bloom = Motion.clamp(vy - (yl - 1), 0, 1);
      const dated = yl > Y0 && !MARKS.undated[i];
      let t = 0; if (clock && dated) { t = l - tStart(yl, ext) - sweepDelay(ext, MARKS, i); if (SWELL) MM.swellPhase(t, PH); else MM.pulsePhase(t, PH, VPX); }
      const own = clock && dated;   // this firm's bloom runs on its own clock
      const started = own ? PH.on : bloom > 0, done = own ? (SWELL ? PH.on && PH.p >= 1 : PH.on && PH.grow >= 1 && PH.swell <= 0) : bloom >= 1;
      const grow = own ? PH.grow : (rewind ? bloom : E.outCubic(bloom));
      if (!done) {
        const c0 = stateColour(s0), c1 = stateColour(s1);
        const pre = (1 - grow) * present * alpha;   // the ordinary fill at the listed radius, fading as the bloom grows
        if (c0 && u < 1) { ctx.globalAlpha = pre * (1 - u); ctx.fillStyle = c0; ctx.beginPath(); ctx.arc(px, py, r, 0, TAU); ctx.fill(); }
        if (c1 && u > 0) { ctx.globalAlpha = pre * u; ctx.fillStyle = c1; ctx.beginPath(); ctx.arc(px, py, r, 0, TAU); ctx.fill(); }
        if (c0 || c1) { ctx.globalAlpha = pre * LR.rimA; ctx.strokeStyle = theme.treated; ctx.lineWidth = LR.rimW; ctx.beginPath(); ctx.arc(px, py, r + LR.rimW / 2, 0, TAU); ctx.stroke(); }   // the rim outside the fill: membership visible from the first frame (25 October 2026)
      }
      if (started) {
        const f0 = MARKS.filed[i][y0 - Y0] === '1' ? 1 : 0, f1 = MARKS.filed[i][y1 - Y0] === '1' ? 1 : 0; const fill = Motion.lerp(f0, f1, E.inOutSine(u));
        const swell = own ? PH.swell : (rewind ? 0 : Math.sin(Math.PI * bloom)), rr = r + (own ? (SWELL ? MM.swellPeak(r) : MM.flashPeak(r)) : Math.max(1.2 * r, 2.5)) * swell;
        const core = own && !SWELL && PH.release < 1 && theme.coreRed ? MM.coreAt(fill >= 0.5 ? theme.coreRed : theme.coreLand, PH.release) : null;
        const settle = own ? (SWELL ? PH.p : Motion.clamp(t / (VPX.ringDelay + VPX.decay), 0, 1)) : bloom;
        if (Motion.audit.on && alpha * present * grow >= 0.05) Motion.audit.marks.push({ x: px, y: py, r: r + LR.halo });   // the resting radius: the flash is transient
        MM.listedMark(ctx, px, py, rr, fill, alpha * present * grow * (1 - (1 - LR.alpha) * settle), theme, LR.halo, core);
        if (!rewind && !SWELL) {   // the rings on the section clock (this firm's start), else on the bloom's own clock
          const p = own ? PH.p : (dated ? bloom : 1);
          if (p > 0 && p < 1) { ctx.globalAlpha = alpha * present; MM.pulseRing(ctx, px, py, r, LR, p, theme, false); }
        }
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
    const LR = listedRuleAt(ext, cam.k);
    for (let i = 0; i < TR.n; i++) { if (TR.filed[i][Y1 - Y0] === '-' || TR.red_from[i] > Y1 || !inExtent(ext, TR.x[i], TR.y[i])) continue; const [px, py] = Motion.project(cam, TR.x[i], TR.y[i]); out.push({ x: px, y: py, r: MM.listedRadius(LR, TR.pile[i]) + LR.halo }); }
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
  const LIVE_CLEAR = { x: 1300, y: 320, x1: 1880, y1: 650 };   // the live box's panel (1320, 340, 540 x 290) with a 20 px margin: no anchor label inside it (round 10)
  function computeOffsets() {   // measured with the face in force; __ready calls remeasure() once the typeface has loaded (round 10)
  for (const ext of ['downtown', 'city', 'region']) {   // no markers at the national scale
    const cam = restCam(ext), marks = redMarks2025(ext);
    const pa = Motion.project(cam, AX, AY), pb = Motion.project(cam, BX, BY);
    const wA = measure(LABEL.A, 22, 500), wB = measure(LABEL.B, 22, 500);
    let best = null;
    for (const da of DIRS) for (const dA of DISTS) for (const db of DIRS) for (const dB of DISTS) {
      const bA = labelBox(pa[0], pa[1], da, dA, wA), bB = labelBox(pb[0], pb[1], db, dB, wB);
      if (overlapsBox(bA, bB)) continue;
      const inside = b => b.x >= 20 && b.y >= 20 && b.x1 <= 1900 && b.y1 <= 1060; if (!inside(bA) || !inside(bB)) continue;
      const symA = { x: pa[0] - 14, y: pa[1] - 14, x1: pa[0] + 14, y1: pa[1] + 14 }, symB = { x: pb[0] - 14, y: pb[1] - 14, x1: pb[0] + 14, y1: pb[1] + 14 };
      if (overlapsBox(bA, symB) || overlapsBox(bB, symA) || overlapsBox(bA, symA) || overlapsBox(bB, symB)) continue;
      if (overlapsBox(bA, LIVE_CLEAR) || overlapsBox(bB, LIVE_CLEAR)) continue;
      const score = hits(bA, marks) + hits(bB, marks) + 0.001 * (dA + dB);
      if (!best || score < best.score) best = { score, A: { dir: da, dist: dA }, B: { dir: db, dist: dB }, covered: hits(bA, marks) + hits(bB, marks) };
    }
    OFFSETS[ext] = best || { A: { dir: DIRS[1], dist: 72 }, B: { dir: DIRS[5], dist: 72 }, covered: -1 };
  }
  }
  computeOffsets();
  function offsetAt(k, key) {   // blended between the scales by their alphas, so the label moves continuously during a pull-back
    const ea = extentAlpha(Math.min(k, 90)); let sx = 0, sy = 0, sd = 0, sw = 0;
    for (const ext of Object.keys(ea)) { const w = ea[ext]; if (w <= 0 || !OFFSETS[ext]) continue; const o = OFFSETS[ext][key]; sx += w * o.dir[0] * o.dist; sy += w * o.dir[1] * o.dist; sd += w * o.dist; sw += w; }
    if (sw <= 0) { const o = OFFSETS.downtown[key]; return { dx: o.dir[0] * o.dist, dy: o.dir[1] * o.dist, dir: o.dir, dist: o.dist }; }
    const dx = sx / sw, dy = sy / sw, n = Math.hypot(dx, dy) || 1; return { dx, dy, dir: [dx / n, dy / n], dist: sd / sw };
  }
  function drawMarker(ctx, cam, theme, key, alpha, inkU = 0) {
    if (alpha <= 0) return;
    const colour = key === 'A' ? aeroflotColour(theme, inkU) : anchorColour(theme, key), [px, py] = key === 'A' ? Motion.project(cam, AX, AY) : Motion.project(cam, BX, BY);
    const o = offsetAt(cam.k, key), w = measure(LABEL[key], 22, 500), b = labelBox(px, py, o.dir, o.dist, w);
    ctx.save(); ctx.globalAlpha *= alpha; ctx.strokeStyle = colour; ctx.lineWidth = 2; ctx.lineJoin = 'round';
    ctx.beginPath();
    if (key === 'A') ctx.arc(px, py, 9, 0, TAU); else { ctx.moveTo(px, py - 11); ctx.lineTo(px + 11, py); ctx.lineTo(px, py + 11); ctx.lineTo(px - 11, py); ctx.closePath(); }
    ctx.stroke();
    const start = [px + o.dir[0] * 13, py + o.dir[1] * 13], end = [px + o.dir[0] * (o.dist - 6), py + o.dir[1] * (o.dist - 6)];
    ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(start[0], start[1]); ctx.lineTo(end[0], end[1]); ctx.stroke();
    ctx.restore();
    Motion.panel(ctx, b.x, b.y, b.x1 - b.x, b.y1 - b.y, theme, 0.92 * alpha);
    Motion.text(ctx, LABEL[key], b.tx, b.ty, { size: 22, weight: 500, color: colour, alpha, group: 'anchor-' + key });
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
    Motion.reveal(ctx, `${listedDate}: sanctioned by the ${jurisdictions}`, 960, 900, l, des + 0.6, { size: 34, weight: 700, color: theme.ink, align: 'center', until });
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
  // The spacing pass of 29 October 2026 (the author: the text under the charts was too squished): the plots 256 px tall at y 392, one key line shared by
  // both, and each side's facts and counts on a 780 px column (the plot's 630 px before), with more leading.
  const BIG = { panel: { x: 84, y: 344, w: 1626, h: 372 }, left: { x: 140, y: 392, w: 630, h: 256 }, right: { x: 1050, y: 392, w: 630, h: 256 } };
  const TW = 780;   // the text column under each plot
  let CMP_LINES = null;   // the facts' line counts at that width, the longer side's (measured once, at the first draw, with the loaded face)
  const cmpLines = () => CMP_LINES || (CMP_LINES = (() => { const n = s => lineCount(s, 24, 400, TW - 56), gs = [gapText(CMPB.anchor.gap, groupName(CMPB.group), 0), gapText(CMPA.anchor.gap, groupName(CMPA.group), 1)];
    return { n1: Math.max(...gs.map(g => n(g[0]))), n2: Math.max(...gs.map(g => n(g[1]))) }; })());
  const SMALL = { panel: { x: 1320, y: 340, w: 540, h: 290 }, left: { x: 1376, y: 388, w: 150, h: 170 }, right: { x: 1650, y: 388, w: 150, h: 170 } };   // 540 wide since round 10 (the monospace group labels)
  const lerpBox = (a, b, u) => ({ x: Motion.lerp(a.x, b.x, u), y: Motion.lerp(a.y, b.y, u), w: Motion.lerp(a.w, b.w, u), h: Motion.lerp(a.h, b.h, u) });
  function comparisonView(ctx, theme, { u, alpha, progress = 1, textAlpha = 1, v = null, l = 0, until = 12, explain2025 = true, inkU = 0 }) {
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
    const panels = [['left', CMPB, 'B', 'the private firm', 'firms on no list'], ['right', CMPA, 'A', 'Aeroflot', 'firms on a list from 2022']];
    panels.forEach(([side, s, key, firmLabel, groupLabel], i) => {
      const box = lerpBox(BIG[side], SMALL[side], u), colour = key === 'A' ? aeroflotColour(theme, inkU) : anchorColour(theme, key);
      const nameA = pa;   // the group names of the live box arrive with its panel
      if (nameA > 0) Motion.text(ctx, side === 'right' ? 'on a list from 2022' : groupLabel, box.x - 40, Motion.lerp(BIG.panel.y, SMALL.panel.y, u) + 30, { size: 22, color: theme.muted, alpha: nameA, group: 'livebox-' + key });   // rides with the box, so it stays inside the interpolated panel
      ctx.save();
      CH.bandLines(ctx, box, { firm: s.firm, band: s.band }, { yDomain: yDomainCmp, yTicks: yTicksCmp, xTicks: [2014, 2025], xTicksMinor: [2018, 2022], minorAlpha: gone, progress: live ? 1 : progress, theme,
        colors: { firm: colour, median: theme.cmpLine, band: theme.cmpBand, marker: theme.treated }, labels: { firm: firmLabel, median: 'median' }, textAlpha: 1, labelAlpha: gone, ringCurrent: key === 'A' && inkU > 0.5,
        marker: s.anchor.marker ? { x: s.anchor.marker.year, label: 'on a list from ' + s.anchor.marker.year } : null,   // not the data's own label, which says "listed" (round 15: never on screen for list membership)
        gapLabel: s.anchor.idx.some(x => x == null) ? { x: 2022, y: 100, text: 'no 2022 statement' } : null,
        current: live ? v : null, compact: u > 0.5 });
      ctx.restore();
      if (big) {   // the two gap facts and the counts of the first showing, fading with the move (the key is shared, below)
        const top = box.y + box.h + 112, ta = textAlpha * gone, LH = 24 * 1.45;
        if (ta > 0) {
          const g = gapText(s.anchor.gap, groupName(s.group), i === 1 ? 1 : 0), rb = ta * step(l, 5.0, 0.5) * (until ? 1 - step(l, until - 0.4, 0.4) : 1);   // in with the first fact, out with the texts
          const CL = cmpLines(), b1 = top + 44, b2 = b1 + (CL.n1 - 1) * LH + LH + 10, bottom = b2 + (CL.n2 - 1) * LH + 28;   // both sides' boxes as tall as the longer facts
          MM.resultBox(ctx, box.x - 24, top, TW + 48, bottom - top, theme, rb, 'ink'); MM.ringMarker(ctx, box.x + 8, b1 - 8, 7, theme.ink, rb);   // the gap facts in an ink box: the anchor's amber is on this screen (round 13)
          Motion.revealParagraph(ctx, g[0], box.x + 28, b1, TW - 56, l, 5.0, { size: 24, color: theme.ink, lineHeight: 1.45, until, alpha: ta, group: 'cmp-gap1-' + key });
          Motion.revealParagraph(ctx, g[1], box.x + 28, b2, TW - 56, l, 5.6, { size: 24, color: theme.ink, lineHeight: 1.45, until, alpha: ta, group: 'cmp-gap2-' + key });
          Motion.revealParagraph(ctx, membersText(s.group), box.x, bottom + 42, TW, l, 6.2, { size: 22, color: theme.muted, lineHeight: 1.45, until, alpha: ta, group: 'cmp-members-' + key });
        }
      }
    });
    if (big && textAlpha * gone > 0) {   // one key for both plots, centred under them
      const ta = textAlpha * gone, ky = Motion.lerp(BIG.left.y, SMALL.left.y, u) + Motion.lerp(BIG.left.h, SMALL.left.h, u) + 76, s = 'median and interquartile range of each comparison group';
      const kw = 26 + 10 + 26 + 14 + measure(s, 22, 400), kx = 960 - kw / 2;
      ctx.save(); ctx.globalAlpha *= ta; ctx.strokeStyle = theme.cmpLine; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(kx, ky - 6); ctx.lineTo(kx + 26, ky - 6); ctx.stroke();
      ctx.globalAlpha *= 0.22; ctx.fillStyle = theme.cmpBand; ctx.fillRect(kx + 36, ky - 14, 26, 16); ctx.restore();
      Motion.text(ctx, s, kx + 76, ky, { size: 22, color: theme.muted, alpha: ta, group: 'cmp-key' });
    }
    if (big && explain2025 && textAlpha * gone > 0) Motion.reveal(ctx, '2025* is a flagged latest-year extension', 960, 1050, l, 6.8, { size: 22, color: theme.muted, align: 'center', until, alpha: textAlpha * gone });
    ctx.restore();
  }
  // Top-right panel: the location (split-flap), its window size, the year, the listed-firm counters.
  function ticker(ctx, theme, { v, ext, alpha, loc }) {
    if (alpha <= 0) return;
    const [y0, y1, u] = yearPair(v); const yr = u < 0.5 ? y0 : y1; const rc = redCounts[ext][yr];
    MM.infoPanel(ctx, theme, { alpha, loc, year: { a: String(y0), b: y1 === y0 ? null : String(y1), u },
      lines: [[`${fmt.int(rc.red)} on a list, shown red`, theme.treated], [`${fmt.int(rc.ringed)} added later, ringed`, theme.muted], [`${fmt.int(rc.dark)} without a ${yr} statement`, theme.muted]] });   // three lines (25 October 2026); the panel grows for the third
  }
  // Bottom-left legend (author's instruction, 23 October, round 3; the three listed rows of 25 October): the bar with its
  // two-line title, one muted line with the mark rule and support at each scale, and three rows for the firms on the five
  // lists: rimmed before the listing year, solid red with a statement, hollow red without one.
  function legend(ctx, theme, { alpha, k }) {
    if (alpha <= 0) return;
    const ea = extentAlpha(k);
    // The spacing pass (29 October 2026): the panel 18 px taller, the bar's ticks and the rule line apart, the three rows 30 px apart (28 before).
    Motion.panel(ctx, 60, 784, 900, 284, theme, 0.92 * alpha);   // 900 wide since round 10
    Motion.text(ctx, (P.legend_title || 'Firms on no list, real revenue against own 2019-2021 average,').replace('2019-2021', '2019–2021'), 84, 818, { size: 22, color: theme.ink, alpha });
    Motion.text(ctx, P.legend_subtitle || 'relative to the year’s median of firms on no list', 84, 848, { size: 22, color: theme.muted, alpha });
    MM.legendBar(ctx, 84, 864, 460, P.class_colours, breakLabels, theme, { height: 20, size: 22, alpha });
    const rule = [['Each mark is one coordinate pair. Larger marks hold more firms.', ea.downtown], ['1 km cells, 20 or more firms with a statement', ea.city], ['5 km cells, 20 or more firms with a statement', ea.region], ['6 km pixels, median class of firms with a statement', ea.national]];
    for (const [s, w] of rule) if (w > 0) Motion.text(ctx, s, 84, 946, { size: 22, color: theme.muted, alpha: alpha * w, group: 'legend-rule' });
    ctx.save(); ctx.globalAlpha *= alpha;
    ctx.fillStyle = P.class_colours[2]; ctx.beginPath(); ctx.arc(95, 982, 9, 0, TAU); ctx.fill(); ctx.globalAlpha *= 0.8; ctx.strokeStyle = theme.treated; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(95, 982, 10, 0, TAU); ctx.stroke(); ctx.globalAlpha /= 0.8;
    ctx.fillStyle = theme.treated; ctx.beginPath(); ctx.arc(95, 1012, 9, 0, TAU); ctx.fill();
    ctx.fillStyle = theme.land; ctx.beginPath(); ctx.arc(95, 1042, 9, 0, TAU); ctx.fill(); ctx.strokeStyle = theme.treated; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(95, 1042, 8, 0, TAU); ctx.stroke();
    ctx.restore();
    Motion.text(ctx, 'On one of the five lists, before the year it was added', 118, 982, { size: 22, color: theme.ink, baseline: 'middle', alpha });
    Motion.text(ctx, 'Added to a list, red from that year, statement available', 118, 1012, { size: 22, color: theme.ink, baseline: 'middle', alpha });
    Motion.text(ctx, 'Added to a list, no statement that year', 118, 1042, { size: 22, color: theme.muted, baseline: 'middle', alpha });
  }
  // The two shared-registration facts of the density pass, once in the downtown run where the sized piles are
  // visible (round 5; same counts, same denominators), with the author's standard explanation of shared
  // registrations (24 October 2026). The kept-years cut shows the facts alone (brief): its run is shorter.
  const lineCount = (s, size, weight, maxWidth) => { let n = 0, line = ''; for (const w of s.split(' ')) { const t = line ? line + ' ' + w : w; if (measure(t, size, weight) > maxWidth && line) { n++; line = w; } else line = t; } return n + (line ? 1 : 0); };
  function pileFacts(ctx, theme, alpha, brief) {
    if (alpha <= 0) return;
    const facts = `Across Russia in 2021: ${fmt.int(SF.largest_location_firms)} firms at the most shared coordinate pair, ${fmt.int(SF.firms_at_100plus_locations)} at coordinate pairs shared by 100 or more firms.`;
    const why = 'Registered legal addresses can be shared business centres or addresses rented for registration and correspondence, rather than production premises. Several firms can therefore share one registered address.';
    const W = 1160, h1 = lineCount(facts, 24, 400, W) * 24 * 1.45, h2 = brief ? 0 : 14 + lineCount(why, 22, 400, W) * 22 * 1.45;   // 1.45 leading and 14 px between the two (1.35 and 8 before; the spacing pass of 29 October 2026)
    Motion.panel(ctx, 60, 100, W + 48, h1 + h2 + 36, theme, 0.92 * alpha);
    const y = Motion.paragraph(ctx, facts, 84, 136, W, { size: 24, color: theme.ink, lineHeight: 1.45, alpha });
    if (!brief) Motion.paragraph(ctx, why, 84, y + 14, W, { size: 22, color: theme.muted, lineHeight: 1.45, alpha });
  }
  // One disclosure where the blue scale first appears: the scale covers firms with a statement that year.
  function disclosure(ctx, theme, alpha) {
    if (alpha <= 0) return;
    const s = 'The scale covers firms on no list with a statement that year.', w = measure(s, 22, 400);
    Motion.panel(ctx, 60, 724, w + 48, 44, theme, 0.92 * alpha);   // 16 px above the legend's taller panel
    Motion.text(ctx, s, 84, 753, { size: 22, color: theme.muted, alpha });
  }
  // The close: the count line, the caveats, the St Petersburg sentence (round 4; the two numbers checked
  // against motion/review/spb-vs-moscow-report.md, 160 by 90 km, 2022-2025 and 2022-2024) and the
  // comparison line, on one opaque panel in the right column, clear of the ticker and the legend.
  function closeText(ctx, theme, l, mul = 1) {   // the count lines in their ink box and nothing under them (the author, 25 October 2026, evening: the caveat cascade read as a wall of text; its disclosures live in review/2026-10-25-screen-text-notes.md and the README)
    if (mul <= 0) return;
    ctx.save(); ctx.globalAlpha *= mul;
    const cr = counts('region', Y1), x = 1204, w = 632;
    const y = 466; const line1 = `${fmt.int(cr.red)} firms on at least one of the five lists red by ${Y1} within 160 by 90 km of ${CITY.name}`, line2 = `${fmt.int(cr.red_nonfilers)} of them without a ${Y1} statement`;
    const yEnd = Motion.paragraph(ctx, line2, x + 28, Motion.paragraph(ctx, line1, x + 28, y, w - 28, { size: 26, lineHeight: 1.38, alpha: 0.001 }) + 10, w - 28, { size: 24, lineHeight: 1.38, alpha: 0.001 });   // the lines' extent, drawn all but invisible (a zero alpha returns early; the audit ignores boxes under 0.05)
    const yb = yEnd + 4 + 24 + 21;   // the St Petersburg note 28 px under the box (the author, 25 October 2026, evening: kept, shorter and scannable): an eyebrow and two figure lines, baselines 34 px apart (29 before the spacing pass of 29 October 2026)
    Motion.panel(ctx, 1180, y - 28 - 16, 680, (yb + 68 + 6 + 18) - (y - 28 - 16), theme, 0.6 * step(l, 0.3, 0.5));   // 16 px around the box and the note; dims the map under it rather than covering it
    const rb = step(l, 0.5, 0.5); MM.resultBox(ctx, x - 8, y - 28, w + 16, yEnd - y + 32, theme, rb, 'ink'); MM.ringMarker(ctx, x + 8, y - 9, 7, theme.ink, rb);   // the count lines in an ink box: the revenue classes around are amber (round 13)
    let yy = Motion.paragraph(ctx, line1, x + 28, y, w - 28, { size: 26, weight: 700, color: theme.ink, lineHeight: 1.38, alpha: step(l, 0.5, 0.5) }) + 10;
    Motion.paragraph(ctx, line2, x + 28, yy, w - 28, { size: 24, weight: 700, color: theme.ink, lineHeight: 1.38, alpha: step(l, 0.9, 0.5) });
    Motion.text(ctx, 'ST PETERSBURG, 160 BY 90 KM, 2022 TO 2024', x, yb, { size: 22, weight: 500, color: theme.muted, letterSpacing: 22 * 0.08, alpha: step(l, 1.8, 0.5) });
    Motion.text(ctx, 'Absence once on a list: within 6 points of Moscow', x, yb + 34, { size: 22, color: theme.ink, alpha: step(l, 2.4, 0.5) });   // review/spb-vs-moscow-report.md: the listed firms' absence after listing within 6 points of Moscow's every year
    Motion.text(ctx, 'Usable baseline: 53 to 54%, Moscow 38 to 44%', x, yb + 68, { size: 22, color: theme.ink, alpha: step(l, 3.0, 0.5) });   // the share of firms with a usable revenue baseline, 2022 to 2024
    ctx.restore();
  }
  const locationAt = (entries, l) => MM.locationAt(entries.map(e => Object.assign({ start: e.start }, WINDOW[e.ext])), l);

  // The camera's rest on the Moscow point and the year runs (holds and 0.5 s transitions; the ring change and the
  // dissolves share the clock). The standalone Moscow cut that once lived here was retired by the author on 24 October 2026.
  const REST = { cx: MX, cy: MY, ox: 960, oy: 540 };
  // holdOf (the bold cut): a year's own hold, for the national run's long 2024 hold. kOf (the bold cut): the zoom at a time, for the merged city and region
  // run, whose camera pulls out continuously (log-linear, both channels linear between keyframes) while the years step.
  function runYears(kf, t0, k, hold, trans, base = REST, list = null, holdOf = null, kOf = null) { let t = t0; const ys = list || YEARS; ys.forEach((y, i) => { const v = list ? i : y, h = holdOf ? holdOf(y, hold) : hold; kf.push(Object.assign({ t, k: kOf ? kOf(t) : k, v, easing: kOf ? E.linear : E.inOutSine }, base)); kf.push(Object.assign({ t: t + h, k: kOf ? kOf(t + h) : k, v }, base, kOf ? { easing: E.linear } : {})); t += h + (i < ys.length - 1 ? trans : 0); }); return t; }

  // ---- the journey section (108 s inside the full cut; every time section-relative) ------------
  // street 0-12 (k 12 to 1200 on the pair's midpoint), profiles 12-28, designation 28-36, comparison
  // 36-50, the map returns 50-58 (k 1200 to 90 while the comparison chart shrinks into its box),
  // downtown 58-72, city 72-84, region 84-96, close 96-103, out 103-108 (the camera leaves for the
  // country; the explainer's keyframes continue from the last one here).
  // The bold cut of 29 October 2026 (100 s, from 120): the street zoom 11 s, the profiles 12 s, the comparison 13 s, the return 6 s; the city and region
  // runs merged into one run of the years while the camera pulls out from the city to the region (the ticker's place changes where the grid does, at
  // k 20); the national run holds 2024 for 2.6 s for the sweep; the pull-out to the country 3 s.
  const SEC = { street: 0, profiles: 11, designation: 23, comparison: 31, back: 44, downtown: 50, city: 64, national: 76.5, close: 90, out: 97, end: 100 };
  RUNS = { downtown: [SEC.downtown + 0.8, 0.75, 0.3], city: [SEC.city + 2.5, 0.55, 0.25], national: [SEC.national + 2.5, 0.5, 0.25, SWEEP.year, 2.6] };   // the year runs: start of the first hold, hold, transition (and a long hold)
  RUNS.region = RUNS.city;
  // The pull-out follows an S-curve in log k (a logistic of steepness 12 over the run, normalized): the camera stays near the city scale for the early
  // years and near the region scale for the late ones, so the 1 km and 5 km grids crossfade in under 2 s (a log-linear pull-out mixed them for 4 s).
  const MERGED = (() => { const [t0, h, tr] = RUNS.city, T = (YEARS.length - 1) * (h + tr) + h, sg = x => 1 / (1 + Math.exp(-12 * (x - 0.5))), g = f => (sg(f) - sg(0)) / (sg(1) - sg(0));
    const kOf = t => Math.exp(Math.log(K.city) + (Math.log(K.region) - Math.log(K.city)) * g(Motion.clamp((t - t0) / T, 0, 1)));
    const target = Math.log(20 / K.city) / Math.log(K.region / K.city); let lo = 0, hi = 1; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (g(m) < target) lo = m; else hi = m; }
    return { t0, T, kOf, switchAt: t0 + T * lo }; })();   // switchAt: where k crosses 20, the city scale's floor (extentOf)
  SEC.region = MERGED.switchAt;   // the chapter and the ticker's place only: there is no region rewind
  const CMPW = SEC.back - SEC.comparison;   // the comparison's length: its texts leave and the chart shrinks into the live box at its end
  const PROF = { des: SEC.designation - SEC.profiles + 0.6, until: SEC.comparison - SEC.profiles };   // the cards' clock: the designation line and the cards' exit
  const MID = { cx: (AX + BX) / 2, cy: (AY + BY) / 2, ox: 960, oy: 540 };
  function journeyKeyframes(S, YL = null) {
    // With a kept-year list the v channel carries list positions (a year not in the list takes the nearest kept year's position).
    const pv = y => { if (!YL) return y; let b = 0; YL.forEach((x, j) => { if (Math.abs(x - y) < Math.abs(YL[b] - y)) b = j; }); return b; };
    const kf = []; const at = (t, k, v, base, easing) => kf.push(Object.assign({ t: S + t, k, v: pv(v) }, base || REST, easing ? { easing } : {}));
    at(SEC.street, K.region, 2021); at(SEC.profiles, 1200, 2021, MID); at(SEC.back, 1200, 2021, MID); at(SEC.back + 5, K.downtown, 2021); at(SEC.downtown, K.downtown, 2021);
    runYears(kf, S + RUNS.downtown[0], K.downtown, RUNS.downtown[1], RUNS.downtown[2], REST, YL); at(SEC.city, K.downtown, Y1);
    at(SEC.city + 2.5, K.city, Y0); runYears(kf, S + RUNS.city[0], K.city, RUNS.city[1], RUNS.city[2], REST, YL, null, t => MERGED.kOf(t - S)); at(SEC.national, K.region, Y1);
    // Two segments so Moscow stays on screen: zoom out in place to k 1 (the region raster leaves, the national
    // raster arrives, both centred on Moscow), then slide to the left framing while the zoom completes.
    at(SEC.national + 1.5, 1.0, 2019, REST, E.inSine); at(SEC.national + 2.5, K.national, Y0, NATBASE, E.outSine); runYears(kf, S + RUNS.national[0], K.national, RUNS.national[1], RUNS.national[2], NATBASE, YL, (y, h) => (y === SWEEP.year ? RUNS.national[4] : h)); at(SEC.close, K.national, Y1, NATBASE); at(SEC.out, K.national, Y1, NATBASE);
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
  function journey(images, S, { years: YL = null } = {}) {   // years: a kept-year list for a cut that drops years (positions in the v channel)
    IMG = images;
    const LOCJ = [{ start: SEC.back, ext: 'downtown' }, { start: SEC.city, ext: 'city' }, { start: SEC.region, ext: 'region' }, { start: SEC.national, ext: 'national' }];
    // Both scenes read their own clock (local), which a re-cut maps through its window; in the full cut local = t - S.
    const field = { id: 'field', title: 'The Moscow field', start: S, end: S + SEC.end, z: 1.5, fadeIn: 0, fadeOut: 0, draw({ ctx, local: l, cam, stage, theme }) {
      const k = cam.k;
      YL_ACTIVE = YL;
      const v = YL ? Motion.clamp(cam.v == null ? 0 : cam.v, 0, YL.length - 1) : Motion.clamp(cam.v == null ? 2021 : cam.v, Y0, Y1);
      const [vy0, vy1, vu] = yearPair(v), vy = vy0 + (vy1 - vy0) * vu;   // the year value (equal to v without a list)
      const outA = 1 - step(l, SEC.out, 1.5), marksOut = 1 - step(l, SEC.out + 0.5, 2);
      const layerReveal = step(l, SEC.downtown + 0.5, 1.5) * marksOut;
      // The 2021 backdrop: in with the street zoom (k 60-80) and out above k 150-260 (the scale ramps
      // sit in extentAlpha), back with the return, dimmed once the outcome layer shows; before the
      // downtown beat only the downtown extent is drawn.
      const backAlpha = (BACK_ALPHA + (0.7 - BACK_ALPHA) * (1 - layerReveal)) * (l < SEC.downtown ? ramp(k, 60, 80) : 1) * marksOut;
      drawField(ctx, cam, v, backAlpha, layerReveal);
      drawCells(ctx, stage, cam, v, layerReveal);
      const rewind = [[SEC.downtown, SEC.downtown + 0.8], [SEC.city, SEC.city + 2.5], [SEC.national, SEC.national + 2.5]].some(([a, b]) => l >= a && l < b);
      drawTreated(ctx, cam, v, layerReveal, theme, rewind, YL ? null : l);   // the section clock drives the ring decay (not for a kept-year cut)
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
      const markerAlpha = Motion.plateau(l, SEC.back + 2.5, SEC.national, 0.6, 0.5);   // findable through the Moscow scales; none at the national scale
      drawMarker(ctx, cam, theme, 'A', markerAlpha, layerReveal); drawMarker(ctx, cam, theme, 'B', markerAlpha);   // Aeroflot's marker in the ink once the classes show
      const c21 = counts('downtown', 2021); const factAlpha = Motion.plateau(l, SEC.back + 3.5, SEC.downtown + 1, 0.5, 0.5);
      if (factAlpha > 0) { Motion.panel(ctx, 60, 950, 1240, 90, theme, 0.92 * factAlpha); Motion.text(ctx, `${fmt.int(c21.drawn + c21.treated)} firms in view in 2021. ${fmt.int(c21.with_base_all)} with a usable revenue baseline.`, 84, 1006, { size: 28, color: theme.ink, alpha: factAlpha }); }
      pileFacts(ctx, theme, Motion.plateau(l, SEC.downtown + 1.6, SEC.downtown + 13.8, 0.5, 0.5), !!YL);
      ticker(ctx, theme, { v, ext: extentOf(k), alpha: step(l, SEC.downtown + 1, 0.6) * outA, loc: locationAt(LOCJ, l) });
      legend(ctx, theme, { alpha: step(l, SEC.downtown + 1.2, 0.6) * outA, k });
      disclosure(ctx, theme, Motion.plateau(l, SEC.downtown + 1.6, SEC.downtown + 8, 0.5, 0.5));
      if (l >= SEC.comparison) { const lc = l - SEC.comparison; comparisonView(ctx, theme, { u: step(lc, CMPW, 2), inkU: layerReveal, alpha: step(lc, 0.4, 0.5, E.outCubic) * outA * (1 - step(l, SEC.national, 1.0)), progress: step(lc, 1.0, 3.5, E.inOutSine), textAlpha: 1, l: lc, until: CMPW + 0.4, v: vy, explain2025: false }); }
      if (SWELL && !YL) sweepCaption(ctx, theme, l, outA);
      if (l >= SEC.close - 0.5) closeText(ctx, theme, l - SEC.close, outA);
      YL_ACTIVE = null;
    } };
    const cards = { id: 'cards', title: 'Profiles', start: S + SEC.profiles, end: S + SEC.comparison + 0.5, z: 2, fadeIn: 0.5, fadeOut: 0.5, draw({ ctx, local, theme }) { profiles(ctx, theme, local, PROF); } };
    const chapters = [['street', 0, SEC.designation, 'Two firms'], ['designation', SEC.designation, SEC.comparison, 'Designation'], ['comparison', SEC.comparison, SEC.back, 'Revenue against comparison group'],
                      ['downtown', SEC.back, SEC.city, `Central ${CITY.name}, ${Y0}–${Y1}`], ['city', SEC.city, SEC.region, CITY.name], ['region', SEC.region, SEC.national, `${CITY.name} and surroundings`], ['national', SEC.national, SEC.close, `Russia, ${Y0}–${Y1}`], ['close', SEC.close, SEC.end, 'Close']];
    const timeline = {}; chapters.forEach(([id, a, b, title]) => timeline[id] = { id, start: S + a, end: S + b, title });
    return { scenes: [field, cards], keyframes: journeyKeyframes(S, YL), timeline, rest: REST, SEC, start: S, end: S + SEC.end, years: YL };
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

  window.TreatedScenes = { remeasure: computeOffsets,
    redCounts, presentCounts, cellSums, OFFSETS, CITY, SEC, journey, NATCAM, SETS, alignScene,
    pieces: { drawField, drawCells, drawTreated, drawMarker, headers, profiles, comparisonView, ticker, legend, disclosure, closeText, locationAt, extentAlpha, extentOf, counts, WINDOW, COL, dot, yearPair, anchorColour, LABEL },
    setImages(images) { IMG = images; },   // the rasters, handed over when they have loaded (the cuts are built before)
    async loadImages(base, { layers = ['downtown', 'national'] } = {}) {
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
