// The treated cut: two firms on one street, a designation, and the Moscow field 2014-2025 (M6 data,
// local only; the published explainer carries neither this cut nor its rasters). Every frame is a
// pure function of t. Firms on any supplied list are one "treated" bucket, red from their red-from
// year; firms on no list carry their own real revenue change against their 2019-2021 average, or the
// dark control colour when they have a baseline and no statement that year; firms without a usable
// baseline are only the faint neutral backdrop. No spatial or proximity effect is estimated.
(function () {
  'use strict';
  const D = window.MOTION_DATA;
  if (!D || !D.points || !D.treated || !D.anchors || !D.basemap) { window.TreatedScenes = null; return; }
  const P = D.points, TR = D.treated, AN = D.anchors, BM = D.basemap;
  const fmt = Motion.fmt, step = Motion.step, E = Motion.ease, MM = MotionMap;
  const ramp = (v, a, b) => Motion.clamp((v - a) / (b - a), 0, 1);
  const lerp2 = (p, q, u) => [Motion.lerp(p[0], q[0], u), Motion.lerp(p[1], q[1], u)];
  const TAU = Math.PI * 2;
  const MX = P.anchor.x, MY = P.anchor.y, YEARS = P.years, Y0 = YEARS[0], Y1 = YEARS[YEARS.length - 1];
  const A = AN.a, B = AN.b;

  // ---- timeline -------------------------------------------------------------------------------
  const T = [['two', 0, 6, 'Two firms'], ['profiles', 6, 22, 'Who are they?'], ['listed', 22, 30, 'Designation'], ['map', 30, 40, 'The map appears'],
             ['downtown', 40, 54, 'Downtown, 2014–2025'], ['city', 54, 66, 'The city'], ['region', 66, 78, 'The region'], ['close', 78, 85, 'Close']];
  const timeline = {}; T.forEach(([id, start, end, title]) => timeline[id] = { id, start, end, title });
  const DURATION = 85;

  // ---- camera: one path, rests at each raster extent's k on the Moscow reference point ----------
  // v carries the financial year: holds and short transitions during a run, a quick rewind during
  // each pull-back, so the ticker and the rasters share one clock.
  const REST = { cx: MX, cy: MY, ox: 960, oy: 540 };
  const K = { downtown: P.extents.downtown.k, city: P.extents.city.k, region: P.extents.region.k };
  const keyframes = [];
  const push = (t, k, v, easing) => keyframes.push(Object.assign({ t, k, v }, REST, easing ? { easing } : {}));
  function run(t0, k, hold, trans) { let t = t0; for (let i = 0; i < YEARS.length; i++) { push(t, k, YEARS[i], E.inOutSine); push(t + hold, k, YEARS[i]); t += hold + (i < YEARS.length - 1 ? trans : 0); } return t; }
  push(0, 200, 2021); push(30, 200, 2021); push(40, K.downtown, 2021); push(40.2, K.downtown, 2021);
  const endDown = run(41, K.downtown, 0.75, 0.3); push(54, K.downtown, Y1);
  push(56.5, K.city, Y0); const endCity = run(56.5, K.city, 0.55, 0.25); push(66.5, K.city, Y1);
  push(69, K.region, Y0); const endRegion = run(69, K.region, 0.5, 0.25); push(78, K.region, Y1); push(DURATION, K.region, Y1);

  // ---- data preparation (once) ---------------------------------------------------------------
  const bmp = MM.buildBasemap(BM);
  const extentAlpha = k => ({ region: ramp(k, 3, 6) * (1 - ramp(k, 22, 30)), city: ramp(k, 14, 22) * (1 - ramp(k, 60, 80)), downtown: ramp(k, 60, 80) });
  const extentOf = k => (k >= 60 ? 'downtown' : k >= 20 ? 'city' : 'region');
  const markRadius = (ext, pile) => { const m = P.extents[ext].mark; return Math.min(m.cap, m.base + m.s * Math.sqrt(Math.max(0, pile - 1))) / 2; };
  const inExtent = (ext, x, y) => { const e = P.extents[ext]; return x >= e.xmin && x <= e.xmax && y >= e.ymin && y <= e.ymax; };
  const stateColour = s => (s >= '1' && s <= '6') ? P.class_colours[+s - 1] : s === 'd' ? P.nonfiler : null;
  // Per extent and year: listed firms shown red (present and red-from reached) and those without a statement.
  const redCounts = {};
  for (const ext of Object.keys(P.extents)) { redCounts[ext] = {}; for (const y of YEARS) { let red = 0, dark = 0; for (let i = 0; i < TR.n; i++) { const ch = TR.filed[i][y - Y0]; if (ch === '-' || TR.red_from[i] > y || !inExtent(ext, TR.x[i], TR.y[i])) continue; red++; if (ch === '0') dark++; } redCounts[ext][y] = { red, dark }; } }
  const counts = (ext, y) => P.counts[ext][String(y)];
  const breakLabels = P.breaks.map(b => (b > 0 ? '+' : b < 0 ? '−' : '') + Math.abs(b) + '%');
  const money = (mn, exact) => (mn == null ? 'no statement' : mn >= 1000 ? fmt.dec(mn / 1000, 1) + ' bn rubles' : (exact ? '' : 'about ') + fmt.int(mn) + ' mn rubles');
  const cap1 = s => s.charAt(0).toUpperCase() + s.slice(1);
  const ownText = s => (s === 'mixed Russian with a federal share' ? 'Mixed, with a federal share' : cap1(s));
  const yearIndex = y => A.years.year.indexOf(y);
  const val = (f, key, y) => f.years[key][yearIndex(y)];
  const ROWS = [
    ['Industry', A.okved_text, B.okved_text],
    ['Legal form', cap1(A.legal.en), cap1(B.legal.en)],
    ['Ownership', ownText(A.ownership.en), ownText(B.ownership.en)],
    ['Founded', String(A.founded), String(B.founded)],
    ['Revenue 2021', money(val(A, 'revenue_mn', 2021), true), money(val(B, 'revenue_mn', 2021), false)],
    ['Assets 2021', money(val(A, 'assets_mn', 2021), true), money(val(B, 'assets_mn', 2021), false)],
  ];
  const jurisdictions = (A.listed.jurisdiction_names || []).join(' and ');
  const listedDate = (() => { const d = new Date(A.listed.date + 'T00:00:00Z'); return d.getUTCDate() + ' ' + ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][d.getUTCMonth()] + ' ' + d.getUTCFullYear(); })();
  const AX = A.x_km, AY = A.y_km, BX = B.x_km, BY = B.y_km;

  // ---- raster compositing ---------------------------------------------------------------------
  let IMG = null; const OFF = [document.createElement('canvas'), document.createElement('canvas')];
  OFF.forEach(c => { c.width = 1920; c.height = 1080; });
  // Two years of one layer blended with 'lighter' at weights (1 - u, u): a mark present in both keeps its colour and opacity.
  function blendYears(off, ext, which, v) {
    const y0 = Math.max(Y0, Math.min(Y1, Math.floor(v))), y1 = Math.min(Y1, y0 + 1), u = Motion.clamp(v - y0, 0, 1);
    const o = off.getContext('2d'); o.setTransform(1, 0, 0, 1, 0, 0); o.globalCompositeOperation = 'source-over'; o.clearRect(0, 0, 1920, 1080);
    o.globalCompositeOperation = 'lighter';
    if (u < 1 || y1 === y0) { o.globalAlpha = y1 === y0 ? 1 : 1 - u; o.drawImage(IMG[ext][y0][which], 0, 0); }
    if (u > 0 && y1 !== y0) { o.globalAlpha = u; o.drawImage(IMG[ext][y1][which], 0, 0); }
    o.globalAlpha = 1; o.globalCompositeOperation = 'source-over';
    return off;
  }
  function rasterRect(cam, ext) { const e = P.extents[ext]; const [px, py] = Motion.project(cam, e.xmin, e.ymax); return [px, py, e.w_km * cam.k, e.h_km * cam.k]; }
  function drawField(ctx, cam, v, backAlpha, layerAlpha) {
    const ea = extentAlpha(cam.k);
    for (const ext of ['region', 'city', 'downtown']) {   // coarser extent first
      const a = ea[ext]; if (a <= 0.002) continue;
      const [px, py, w, h] = rasterRect(cam, ext);
      ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      if (backAlpha > 0) { ctx.save(); ctx.globalAlpha *= a * backAlpha; ctx.drawImage(blendYears(OFF[0], ext, 'backdrop', v), px, py, w, h); ctx.restore(); }
      if (layerAlpha > 0) { ctx.save(); ctx.globalAlpha *= a * layerAlpha; ctx.drawImage(blendYears(OFF[1], ext, 'layer', v), px, py, w, h); ctx.restore(); }
      ctx.restore();
    }
  }
  // Listed firms as vector marks: their own state until the red-from year, then red (filled when a
  // statement exists, a ring when not), blooming once with an expanding ring.
  function drawTreated(ctx, cam, v, alpha, theme) {
    if (alpha <= 0) return;
    const y0 = Math.max(Y0, Math.min(Y1, Math.floor(v))), y1 = Math.min(Y1, y0 + 1), u = Motion.clamp(v - y0, 0, 1);
    const ext = extentOf(cam.k); const hw = 960 / cam.k + 1, hh = 540 / cam.k + 1;
    for (let i = 0; i < TR.n; i++) {
      const x = TR.x[i], y = TR.y[i];
      if (x < cam.cx - hw || x > cam.cx + hw || y < cam.cy - hh || y > cam.cy + hh) continue;
      const s0 = TR.state[i][y0 - Y0], s1 = TR.state[i][y1 - Y0];
      const present = Motion.lerp(s0 === '-' ? 0 : 1, s1 === '-' ? 0 : 1, u); if (present <= 0) continue;
      const [px, py] = Motion.project(cam, x, y); const r = markRadius(ext, TR.pile[i]);
      const bloom = Motion.clamp(v - (TR.red_from[i] - 1), 0, 1);
      if (bloom < 1) {   // its own state, as the rasters would draw it
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

  // ---- intro positions: two dots in design space, then their true positions on the map ---------
  function anchorPositions(t, cam) {
    const enter = step(t, 0.2, 2.4, E.outCubic);
    const pA1 = [Motion.lerp(-40, 820, enter), 540], pB1 = [Motion.lerp(1960, 1100, enter), 540];
    const toCards = step(t, 6, 1.2); const pA = lerp2(pA1, [430, 236], toCards), pB = lerp2(pB1, [1210, 236], toCards);
    const toMap = step(t, 30, 4); const qa = Motion.project(cam, AX, AY), qb = Motion.project(cam, BX, BY);
    return { A: lerp2(pA, qa, toMap), B: lerp2(pB, qb, toMap), toMap, r: Motion.lerp(14, 4, toMap) };
  }
  function dot(ctx, p, r, color, alpha) { if (alpha <= 0) return; ctx.save(); ctx.globalAlpha *= alpha; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, TAU); ctx.fill(); ctx.restore(); }
  function panel(ctx, x, y, w, h, theme, alpha) { if (alpha <= 0) return; ctx.save(); ctx.globalAlpha *= alpha; ctx.fillStyle = theme.stage; ctx.fillRect(x, y, w, h); ctx.restore(); }
  function strip(ctx, x, y, firm, shown, theme, alpha) {   // 12 cells, revealed per year; filled = statement, dark = none
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

  // ---- scenes ---------------------------------------------------------------------------------
  const scenes = [];
  scenes.push({ id: 'field', title: 'The field', start: 0, end: DURATION, z: 1, fadeIn: 0, fadeOut: 0.8, draw({ ctx, t, cam, stage, theme }) {
    const v = Motion.clamp(cam.v == null ? 2021 : cam.v, Y0, Y1);
    const landAlpha = step(t, 34, 3), fieldReveal = step(t, 34.5, 3), layerReveal = step(t, 40.5, 1.5);
    if (landAlpha > 0) MM.drawBasemap(ctx, stage, cam, bmp, theme, { landAlpha, borderPx: 1.4 });
    const backAlpha = fieldReveal * (P.backdrop_alpha + (0.7 - P.backdrop_alpha) * (1 - layerReveal));
    if (fieldReveal > 0 && IMG) drawField(ctx, cam, v, backAlpha, layerReveal);
    if (layerReveal > 0) drawTreated(ctx, cam, v, layerReveal, theme);
    // The two anchors: dots through the intro, fading into the field once it resolves.
    const ap = anchorPositions(t, cam); const dotsAlpha = 1 - layerReveal;
    const red = step(t, 22.6, 0.8), pulse = 1 + 0.6 * Math.sin(Math.PI * red);
    const aColor = red <= 0 ? theme.muted : red >= 1 ? theme.treated : null;
    if (aColor) dot(ctx, ap.A, ap.r * pulse, aColor, dotsAlpha);
    else { dot(ctx, ap.A, ap.r * pulse, theme.muted, dotsAlpha * (1 - red)); dot(ctx, ap.A, ap.r * pulse, theme.treated, dotsAlpha * red); }
    const ringU = step(t, 22.7, 1.4, E.outCubic);
    if (ringU > 0 && ringU < 1) { ctx.save(); ctx.globalAlpha *= 0.9 * (1 - ringU); ctx.strokeStyle = theme.treated; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ap.A[0], ap.A[1], ap.r + 300 * ringU, 0, TAU); ctx.stroke(); ctx.restore(); }
    dot(ctx, ap.B, ap.r, theme.muted, dotsAlpha);
    // Names: under the dots in the first beat, then card headers (drawn by the cards scene), then beside the dots on the map.
    Motion.reveal(ctx, `Two firms, ${AN.distance_m} m apart in central Moscow`, 960, 330, t, 1.0, { size: 46, weight: 700, color: theme.ink, align: 'center', until: 6.4 });
    Motion.reveal(ctx, 'Aeroflot', ap.A[0], 596, t, 3.0, { size: 30, weight: 700, color: theme.ink, align: 'center', until: 6.4 });
    Motion.reveal(ctx, 'a private firm nearby', ap.B[0], 596, t, 3.3, { size: 28, color: theme.muted, align: 'center', until: 6.4 });
    const nameAlpha = Motion.plateau(t, 30, 34.4, 0.4, 0.6);
    if (nameAlpha > 0) { Motion.text(ctx, 'Aeroflot', ap.A[0] + 18, ap.A[1] + 9, { size: 26, weight: 700, color: theme.ink, alpha: nameAlpha }); Motion.text(ctx, 'a private firm nearby', ap.B[0] - 18, ap.B[1] - 14, { size: 24, color: theme.muted, align: 'right', alpha: nameAlpha }); }
    // One label for the pair once the map is up (they are 57 m apart: one point at every map scale).
    const labelAlpha = Motion.plateau(t, 34, DURATION + 1, 0.6, 0);
    if (labelAlpha > 0) {
      const [qx, qy] = Motion.project(cam, (AX + BX) / 2, (AY + BY) / 2); const lx = qx + 46, ly = qy - 44;
      ctx.save(); ctx.globalAlpha *= labelAlpha; ctx.strokeStyle = theme.ink; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(qx + 6, qy - 6); ctx.lineTo(lx - 8, ly + 6); ctx.stroke(); ctx.restore();
      Motion.text(ctx, `Aeroflot and the private firm, ${AN.distance_m} m apart`, lx, ly, { size: 22, color: theme.ink, alpha: labelAlpha, group: 'pairlabel' });
    }
    // The map's first fact: the split of what is drawn, once, for the year shown.
    const c21 = counts('downtown', 2021); const factAlpha = Motion.plateau(t, 35, 41, 0.5, 0.5);
    if (factAlpha > 0) { panel(ctx, 60, 950, 980, 90, theme, 0.78 * factAlpha); Motion.text(ctx, `${fmt.int(c21.drawn + c21.treated)} firms in view in 2021; ${fmt.int(c21.with_base_all)} with a usable revenue baseline`, 84, 1006, { size: 28, color: theme.ink, alpha: factAlpha }); }
    // Year ticker and listed-firm counters (top right), from the first run on.
    const ext = extentOf(cam.k), yr = Math.round(v), y0 = Math.floor(v), u = v - y0;
    const tickAlpha = step(t, 41, 0.6);
    if (tickAlpha > 0) {
      panel(ctx, 1400, 70, 460, 230, theme, 0.78 * tickAlpha);
      Motion.text(ctx, String(y0), 1836, 180, { size: 110, weight: 700, color: theme.ink, align: 'right', alpha: tickAlpha * (1 - u), group: 'year' });
      if (u > 0 && y0 < Y1) Motion.text(ctx, String(y0 + 1), 1836, 180, { size: 110, weight: 700, color: theme.ink, align: 'right', alpha: tickAlpha * u, group: 'year' });
      const rc = redCounts[ext][yr];
      Motion.text(ctx, `${fmt.int(rc.red)} listed firms shown red`, 1836, 232, { size: 26, color: theme.treated, align: 'right', alpha: tickAlpha, group: 'counters' });
      Motion.text(ctx, `${fmt.int(rc.dark)} of them without a ${yr} statement`, 1836, 270, { size: 24, color: theme.muted, align: 'right', alpha: tickAlpha, group: 'counters' });
    }
    // Legend (bottom left): the classes, then the three states with the year's counts.
    const legAlpha = step(t, 41.2, 0.6);
    if (legAlpha > 0) {
      const c = counts(ext, yr);
      panel(ctx, 60, 700, 760, 340, theme, 0.78 * legAlpha);
      Motion.text(ctx, 'Firms on no list: own real revenue against the firm’s 2019–2021 average', 84, 742, { size: 23, color: theme.muted, alpha: legAlpha });
      MM.legendBar(ctx, 84, 762, 600, P.class_colours, breakLabels, theme, { height: 20, size: 22, alpha: legAlpha });
      const rows = [[null, `own revenue change · ${fmt.int(c.filers_base)} firms`], [P.nonfiler, `no statement this ${yr === 2025 ? 'year*' : 'year'} · ${fmt.int(c.nonfilers_base)}`], ['faint', `no usable revenue baseline · ${fmt.int(c.nobase)}`], [theme.treated, `listed firm, red from its designation year`]];
      rows.forEach(([col, label], i) => {
        const yy = 850 + i * 42;
        ctx.save(); ctx.globalAlpha *= legAlpha;
        if (col === null) { P.class_colours.forEach((cc, j) => { ctx.fillStyle = cc; ctx.fillRect(84 + j * 4, yy, 4, 24); }); }
        else if (col === 'faint') { ctx.fillStyle = theme.land; ctx.fillRect(84, yy, 24, 24); ctx.globalAlpha *= P.backdrop_alpha; ctx.fillStyle = P.neutral; ctx.fillRect(84, yy, 24, 24); }
        else { ctx.fillStyle = col; ctx.fillRect(84, yy, 24, 24); }
        ctx.restore();
        Motion.text(ctx, label, 122, yy + 12, { size: 24, color: theme.ink, baseline: 'middle', alpha: legAlpha, group: 'legend' });
      });
    }
    // Close: the count, then the two caveats.
    const cr = counts('region', Y1);
    Motion.reveal(ctx, `${fmt.int(cr.red)} listed firms red by ${Y1} within 160 by 90 km of Moscow`, 80, 140, t, 78.5, { size: 34, weight: 700, color: theme.ink });
    Motion.reveal(ctx, `${fmt.int(cr.red_nonfilers)} of them without a ${Y1} statement`, 80, 186, t, 78.9, { size: 30, weight: 700, color: theme.ink });
    const cav1 = step(t, 79.8, 0.5), cav2 = step(t, 81.0, 0.5);
    Motion.paragraph(ctx, 'Colours show each firm’s own real revenue change against its 2019–2021 average; no spatial or proximity effect is estimated.', 80, 246, 1000, { size: 25, color: theme.muted, alpha: cav1 });
    Motion.paragraph(ctx, `Dated by the supplied sanctions list (${fmt.int(TR.inferred_n)} of ${fmt.int(TR.n)} dates inferred); ${fmt.int(TR.undated_n)} undated list members red throughout. Descriptive, not causal; 2025* is the flagged latest year.`, 80, 326, 1000, { size: 25, color: theme.muted, alpha: cav2 });
  } });

  scenes.push({ id: 'cards', title: 'Profiles', start: 6, end: 30.5, z: 2, fadeIn: 0.5, fadeOut: 0.5, draw({ ctx, t, theme }) {
    const until = 30;
    Motion.reveal(ctx, 'Aeroflot', 460, 248, t, 6.8, { size: 34, weight: 700, color: theme.ink, until });
    Motion.reveal(ctx, 'A private firm nearby', 1240, 248, t, 7.0, { size: 34, weight: 700, color: theme.ink, until });
    const colW = 700;
    let y = 340;
    ROWS.forEach(([label, va, vb], i) => {
      const t0 = 7.6 + i * 0.7;
      Motion.reveal(ctx, label, 120, y, t, t0, { size: 24, color: theme.muted, until });
      const u = Motion.step(t, t0 + 0.15, 0.5, E.outCubic) * (1 - Motion.step(t, until - 0.4, 0.4, E.inOutSine));
      if (u > 0) {
        const ya = Motion.paragraph(ctx, va, 430, y + 10 * (1 - u), colW - 20, { size: 29, color: theme.ink, alpha: u, lineHeight: 1.25 });
        const yb = Motion.paragraph(ctx, vb, 1210, y + 10 * (1 - u), colW - 20, { size: 29, color: theme.ink, alpha: u, lineHeight: 1.25 });
        y = Math.max(ya, yb) + 44 - 29 * 1.25;
      } else y += 44;
      y += 29 * 1.25 - 29;
    });
    // The filing strips: 2014-2021 in the profile beat, 2022-2025 at the designation.
    const sy = y + 24; const down = 1 - Motion.step(t, until - 0.4, 0.4, E.inOutSine);
    Motion.reveal(ctx, 'Statements 2014–2025', 120, sy, t, 11.8, { size: 24, color: theme.muted, until });
    const shown = i => (i <= 7 ? Motion.step(t, 12.0 + i * 0.12, 0.4, E.outCubic) : Motion.step(t, 24.6 + (i - 8) * 0.3, 0.4, E.outCubic));
    strip(ctx, 430, sy, A, shown, theme, down); strip(ctx, 1210, sy, B, shown, theme, down);
    // The designation, then the archive's answer.
    Motion.reveal(ctx, `${listedDate}: listed by the ${jurisdictions}`, 960, 900, t, 23.2, { size: 34, weight: 700, color: theme.ink, align: 'center', until });
    Motion.reveal(ctx, `No 2022 statement in the archive; back in 2023`, 960, 950, t, 25.2, { size: 28, color: theme.muted, align: 'center', until });
    const r22 = sy + 76;
    Motion.reveal(ctx, 'Revenue 2022', 120, r22, t, 25.6, { size: 24, color: theme.muted, until });
    Motion.reveal(ctx, money(val(A, 'revenue_mn', 2022) == null || !val(A, 'filed', 2022) ? null : val(A, 'revenue_mn', 2022), true), 430, r22, t, 25.8, { size: 29, color: theme.dim, until });
    Motion.reveal(ctx, money(val(B, 'revenue_mn', 2022), false), 1210, r22, t, 25.8, { size: 29, color: theme.ink, until });
  } });

  // Alignment probe (?__align=1): the align raster through the same compositing path, with 1 px vector
  // marks two pixels to the right of the projected anchor and of the point 10 km north of it.
  function alignScene() {
    return { id: 'align', title: 'Alignment probe', start: 0, end: DURATION, z: 9, fadeIn: 0, fadeOut: 0, draw({ ctx, cam, theme }) {
      if (!IMG || !IMG.align) return;
      const [px, py, w, h] = rasterRect(cam, 'downtown');
      ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(IMG.align, px, py, w, h); ctx.restore();
      for (const [x, y] of [[MX, MY], [MX, MY + 10]]) { const [qx, qy] = Motion.project(cam, x, y); ctx.fillStyle = '#00FFFF'; ctx.fillRect(Math.round(qx) + 2, Math.round(qy), 1, 1); }
      Motion.text(ctx, `align probe k=${cam.k.toFixed(3)} centre ${cam.cx.toFixed(4)}, ${cam.cy.toFixed(4)}`, 80, 1040, { size: 22, color: theme.muted });
    } };
  }

  window.TreatedScenes = {
    timeline, DURATION, keyframes,
    make(images, { align = false } = {}) { IMG = images; const sc = scenes.slice(); if (align) sc.push(alignScene()); return { scenes: sc, keyframes, DURATION, timeline }; },
    redCounts,
    async loadImages(base) {
      const out = {}; const jobs = [];
      for (const ext of Object.keys(P.files)) {
        out[ext] = {};
        for (const [y, f] of Object.entries(P.files[ext])) {
          out[ext][y] = {};
          for (const which of ['backdrop', 'layer']) {
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
