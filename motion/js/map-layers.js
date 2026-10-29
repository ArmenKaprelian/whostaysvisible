// Map layers in the production km plane (spherical LAEA, 100E 60N). Geometry and cells are built
// once into Path2D objects in km and drawn under the camera transform; line widths are divided by
// the camera scale so they stay in design pixels.
(function () {
  'use strict';
  const M = {};

  // --- decoding -------------------------------------------------------------------------------
  M.decodeRing = function (ints) {
    const n = ints.length >> 1; const xs = new Float64Array(n), ys = new Float64Array(n);
    let x = 0, y = 0;
    for (let i = 0; i < n; i++) { x += ints[2 * i]; y += ints[2 * i + 1]; xs[i] = x / 10; ys[i] = y / 10; }
    return { xs, ys };
  };
  M.partsToPath = function (parts) {
    const p = new Path2D();
    for (const part of parts) for (const ring of part.rings) {
      const r = M.decodeRing(ring); if (r.xs.length < 3) continue;
      p.moveTo(r.xs[0], r.ys[0]);
      for (let i = 1; i < r.xs.length; i++) p.lineTo(r.xs[i], r.ys[i]);
      p.closePath();
    }
    return p;
  };
  M.b64Int16 = function (b64) { const bin = atob(b64); const buf = new ArrayBuffer(bin.length); const u8 = new Uint8Array(buf); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return new Int16Array(buf); };
  M.b64Float32 = function (b64) { const bin = atob(b64); const buf = new ArrayBuffer(bin.length); const u8 = new Uint8Array(buf); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return new Float32Array(buf); };   // NaN marks no value (round 9)
  M.b64Uint8 = function (b64) { const bin = atob(b64); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; };
  M.b64Int32 = function (b64) { const bin = atob(b64); const buf = new ArrayBuffer(bin.length); const u8 = new Uint8Array(buf); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return new Int32Array(buf); };

  // --- basemap --------------------------------------------------------------------------------
  M.buildBasemap = function (bm) {
    const lod0 = M.partsToPath(bm.lod0.parts);
    const lod1 = {};
    for (const [label, w] of Object.entries(bm.lod1.windows)) lod1[label] = { path: M.partsToPath(w.parts), box: w.box, label };
    const grat = new Path2D();
    for (const line of bm.graticule) { const r = M.decodeRing(line); grat.moveTo(r.xs[0], r.ys[0]); for (let i = 1; i < r.xs.length; i++) grat.lineTo(r.xs[i], r.ys[i]); }
    const cities = []; const c = bm.cities;
    for (let i = 0; i < c.label.length; i++) cities.push({ label: c.label[i], x: c.x_km[i], y: c.y_km[i], lon: c.lon[i], lat: c.lat[i] });
    // The land's levels and the parts with their bounds (round 14, the atlas only, through M.landLevels): the land as one outline at five tolerances (M1), and
    // each lod0 part with its km box so a deeper view fills and strokes only the parts that meet it (a ring outside the view cannot change the even-odd fill inside it).
    const land = bm.land ? bm.land.levels.map(L => ({ tol: L.tolerance_km, path: M.partsToPath([{ rings: L.rings }]) })) : null;
    const lod0Parts = bm.lod0.parts.map(p => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const r of p.rings) { let x = 0, y = 0; for (let i = 0; i < r.length; i += 2) { x += r[i]; y += r[i + 1]; const X = x / 10, Y = y / 10; if (X < x0) x0 = X; if (X > x1) x1 = X; if (Y < y0) y0 = Y; if (Y > y1) y1 = Y; } } return { x0, y0, x1, y1, path: M.partsToPath([p]) }; });
    return { lod0, lod1, grat, extents: bm.extents, cities, lod1MinK: bm.lod1.use_when_px_per_km_at_least || 9, land, lod0Parts };
  };
  // The fine geometry of a city window applies only when the whole viewport lies inside its box.
  M.chooseLod = function (bmp, cam, stage) {
    if (cam.k >= bmp.lod1MinK) {
      const hw = stage.width / (2 * cam.k), hh = stage.height / (2 * cam.k);
      for (const w of Object.values(bmp.lod1)) {
        if (cam.cx - hw >= w.box[0] && cam.cx + hw <= w.box[1] && cam.cy - hh >= w.box[2] && cam.cy + hh <= w.box[3]) return w.path;
      }
    }
    return bmp.lod0;
  };
  // The fine geometry (lod1) of a city window, when the viewport lies inside its box, or null.
  M.windowLod = function (bmp, cam, stage) {
    const hw = stage.width / (2 * cam.k), hh = stage.height / (2 * cam.k);
    for (const w of Object.values(bmp.lod1)) {
      if (cam.cx - hw >= w.box[0] && cam.cx + hw <= w.box[1] && cam.cy - hh >= w.box[2] && cam.cy + hh <= w.box[3]) return w.path;
    }
    return null;
  };
  // Boundaries follow the zoom (round 3): the national geometry's regional borders below k 6, the
  // window geometry (the Moscow city limit among them) above k 12, a crossfade between; thin pale
  // lines, never heavier than the marks. The land fill is one polygon set at a time.
  // The project mark (round 10, the author's items 14 and 17): four corner brackets with a centred dot (M.mark), or with the author's initials inside
  // the square (M.markAGK, the authorship mark drawn under every data layer at 4 percent). Plain fillText, so the text audit records no box.
  function brackets(ctx, cx, cy, size) { const s = size / 24, x0 = cx - size / 2, y0 = cy - size / 2, x1 = cx + size / 2, y1 = cy + size / 2; ctx.lineWidth = 2 * s; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
    ctx.moveTo(x0 + 2 * s, y0 + 8 * s); ctx.lineTo(x0 + 2 * s, y0 + 2 * s); ctx.lineTo(x0 + 8 * s, y0 + 2 * s); ctx.moveTo(x1 - 8 * s, y0 + 2 * s); ctx.lineTo(x1 - 2 * s, y0 + 2 * s); ctx.lineTo(x1 - 2 * s, y0 + 8 * s);
    ctx.moveTo(x1 - 2 * s, y1 - 8 * s); ctx.lineTo(x1 - 2 * s, y1 - 2 * s); ctx.lineTo(x1 - 8 * s, y1 - 2 * s); ctx.moveTo(x0 + 8 * s, y1 - 2 * s); ctx.lineTo(x0 + 2 * s, y1 - 2 * s); ctx.lineTo(x0 + 2 * s, y1 - 8 * s); ctx.stroke(); }
  M.mark = function (ctx, cx, cy, size, colour, alpha = 1) { ctx.save(); ctx.globalAlpha *= alpha; ctx.strokeStyle = colour; ctx.fillStyle = colour; brackets(ctx, cx, cy, size); ctx.beginPath(); ctx.arc(cx, cy, 2.5 * size / 24, 0, Math.PI * 2); ctx.fill(); ctx.restore(); };
  M.markAGK = function (ctx, cx, cy, size, colour, alpha = 1) {   // drawn whole at every size: no symbol takes the striped style (the author's correction of 25 October to item 18)
    ctx.save(); ctx.globalAlpha *= alpha; ctx.strokeStyle = colour; ctx.fillStyle = colour; brackets(ctx, cx, cy, size); ctx.font = Motion.font(Math.round(size * 0.3), 500); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('AGK', cx, cy + size * 0.02); ctx.restore(); };
  // Thin lines on a fractional device ratio (round 14, measured in the author's Brave at 1.33 on 25 October 2026): a 1 CSS px stroke is 1.33 device px there,
  // which takes the canvas off its hairline path, and the 58,490-vertex regional borders then cost 40 to 58 ms a frame against 2 ms at 1 device px. A stroke
  // whose device width lies between 1 and 1.6 px is drawn as a 1 device px hairline with its alpha multiplied by the width it replaces, the same ink per unit
  // length (capped at alpha 1). A visible change (lines one device pixel wide and stronger), so it is the atlas's alone: M.hairlines is 1 there and 0 in the
  // video, which draws exactly as before. Used for the borders and outlines, never for the listed marks.
  M.hairlines = 0;
  // The land by level of detail (round 14, the atlas only, M.landLevels 1 there): at the national zooms the land is filled from the unioned outline at the coarsest
  // tolerance under 0.3 CSS px, deeper in from the lod0 parts that meet the view (the same pixels as the whole lod0), so the 58,490-vertex fill is not redrawn whole.
  M.landLevels = 0; M.LAND_TOL_PX = 0.3;
  let lod0ViewMemo = { key: '', path: null };
  M.lod0InView = function (bmp, cam, stage) {
    const k = cam.k, ox = cam.ox == null ? stage.width / 2 : cam.ox, oy = cam.oy == null ? stage.height / 2 : cam.oy;
    const x0 = cam.cx - ox / k, x1 = cam.cx + (stage.width - ox) / k, y0 = cam.cy - (stage.height - oy) / k, y1 = cam.cy + oy / k;
    const ids = []; for (let i = 0; i < bmp.lod0Parts.length; i++) { const p = bmp.lod0Parts[i]; if (p.x1 >= x0 && p.x0 <= x1 && p.y1 >= y0 && p.y0 <= y1) ids.push(i); }
    if (ids.length === bmp.lod0Parts.length) return bmp.lod0;
    const key = ids.join(','); if (lod0ViewMemo.key === key) return lod0ViewMemo.path;
    const path = new Path2D(); for (const i of ids) path.addPath(bmp.lod0Parts[i].path);
    lod0ViewMemo = { key, path }; return path;
  };
  M.strokeHair = function (ctx, path) {
    if (!M.hairlines) { ctx.stroke(path); return; }
    const m = ctx.getTransform(), s = Math.hypot(m.a, m.b), d = ctx.lineWidth * s;
    if (!(d > 1.0001 && d < 1.6)) { ctx.stroke(path); return; }
    const lw = ctx.lineWidth, ga = ctx.globalAlpha; ctx.lineWidth = 0.999 / s; ctx.globalAlpha = Math.min(1, ga * d); ctx.stroke(path); ctx.lineWidth = lw; ctx.globalAlpha = ga;   // 0.999, not 1: Skia takes its hairline path only while the device width is at most 1 in single precision, and 1 / s * s rounded above 1 at some zooms (34 ms a frame instead of 1.4 at 2.1 times the fit, found 25 October 2026)
  };
  M.drawBasemap = function (ctx, stage, cam, bmp, theme, { landAlpha = 1, borderPx = 0.8, graticule = true, borders = true, lod0Colour = null, lod0Alpha = 1, lod0Px = null, afterLand = null } = {}) {   // afterLand(ctx): drawn right after the land fill and before every line (round 10: the Firms view's tint and glow)   // lod0Colour, lod0Alpha, lod0Px: the national regional borders' own tone, fade and width (round 10, G13b; the atlas passes the ghost tone fading by k 3)
    Motion.camTransform(ctx, stage, cam);
    const fine = M.windowLod(bmp, cam, stage);
    const w1 = fine ? Motion.clamp((cam.k - 6) / 6, 0, 1) : 0;
    const path = w1 >= 0.5 && fine ? fine : bmp.lod0;
    const lod0View = M.landLevels && bmp.lod0Parts ? M.lod0InView(bmp, cam, stage) : bmp.lod0;   // the parts that meet the view, or the whole lod0
    let landPath = path === bmp.lod0 ? lod0View : path;
    if (M.landLevels && path === bmp.lod0 && bmp.land) for (const L of bmp.land) if (L.tol * cam.k <= M.LAND_TOL_PX) { landPath = L.path; break; }   // the coarsest level whose tolerance stays under 0.3 CSS px
    ctx.save(); ctx.globalAlpha *= landAlpha;
    ctx.fillStyle = theme.land; ctx.fill(landPath, 'evenodd');
    if (afterLand) afterLand(ctx);
    if (graticule) { ctx.strokeStyle = theme.graticule; ctx.lineWidth = 1.0 / cam.k; ctx.stroke(bmp.grat); }   // a whiter 1 px line since round 9 (0.7 px before)
    if (borders) {
      ctx.strokeStyle = theme.border; ctx.lineWidth = Math.min(borderPx, 1) / cam.k; ctx.lineJoin = 'round';
      if (w1 < 1 && lod0Alpha > 0) { ctx.save(); ctx.globalAlpha *= (1 - w1) * lod0Alpha; if (lod0Colour) ctx.strokeStyle = lod0Colour; if (lod0Px) ctx.lineWidth = lod0Px / cam.k; M.strokeHair(ctx, lod0View); ctx.restore(); }
      if (w1 > 0 && fine) { ctx.save(); ctx.globalAlpha *= w1; M.strokeHair(ctx, fine); ctx.restore(); }
    }
    ctx.restore();
    stage.base();
  };

  // --- 100 km cell layers ---------------------------------------------------------------------
  // cells: {ix[], iy[], ...}; classOf(i) returns a class index or null (not drawn). Returns a
  // Map class -> Path2D of gapped tiles.
  M.buildTiles = function (n, ixs, iys, classOf, { sizeKm = 100, gapKm = 15, origin = [0, 0] } = {}) {
    const paths = new Map(); const h = gapKm / 2, s = sizeKm - gapKm;
    for (let i = 0; i < n; i++) {
      const c = classOf(i); if (c == null) continue;
      let p = paths.get(c); if (!p) { p = new Path2D(); paths.set(c, p); }
      p.rect(origin[0] + ixs[i] * sizeKm + h, origin[1] + iys[i] * sizeKm + h, s, s);
    }
    return paths;
  };
  // Classes listed in `stroke` are outlined (strokePx design pixels, strokeAlpha) instead of filled.
  M.tileEdge = null;   // set by the atlas's light theme: { colour, alpha, low(fill) } (27 October 2026); the video leaves it unset
  M.drawTiles = function (ctx, stage, cam, paths, colorOf, { alpha = 1, alphaOf = null, stroke = null, strokePx = 1, strokeAlpha = 0.3, outline = null } = {}) {   // outline: { colour, alpha, px } strokes every filled tile after its fill (round 10, the city-window hand-over)
    Motion.camTransform(ctx, stage, cam);
    ctx.save(); ctx.globalAlpha *= alpha;
    for (const [c, p] of paths) {
      if (stroke && stroke.has(c)) { ctx.save(); ctx.globalAlpha *= strokeAlpha; ctx.strokeStyle = colorOf(c); ctx.lineWidth = strokePx / cam.k; ctx.stroke(p); ctx.restore(); continue; }
      ctx.fillStyle = colorOf(c); if (alphaOf) { ctx.save(); ctx.globalAlpha *= alphaOf(c); ctx.fill(p); ctx.restore(); } else ctx.fill(p);
      const e = M.tileEdge; if (e && e.low(colorOf(c))) { ctx.save(); ctx.globalAlpha *= e.alpha * (alphaOf ? alphaOf(c) : 1); ctx.strokeStyle = e.colour; ctx.lineWidth = 1 / cam.k; M.strokeHair(ctx, p); ctx.restore(); }   // the atlas's light-theme edge on a fill under 3:1 against the land (27 October 2026)
    }
    ctx.restore();
    if (outline && outline.alpha > 0) { ctx.save(); ctx.globalAlpha *= outline.alpha; ctx.strokeStyle = outline.colour; ctx.lineWidth = (outline.px || 1) / cam.k; for (const [c, p] of paths) M.strokeHair(ctx, p); ctx.restore(); }
    stage.base();
  };

  // The result style (round 13, the author's request of 25 October 2026): a delivered figure sits in a subtle box, the anchor amber at 10 percent over the stage with a 1 px
  // border at 30 percent, squared, no shadow; the ink at 6 and 25 percent with a ring marker before the figure where the frame already carries an amber (the pair's declines,
  // the anchor firm's line), so that one amber never means two things in a frame. The box is recorded as a panel for the audit's panel-clip rule.
  M.resultBox = function (ctx, x, y, w, h, theme, alpha = 1, variant = 'amber') {
    if (alpha <= 0) return;
    const col = variant === 'ink' ? theme.ink : (theme.result || theme.anchorA || '#F2B134');
    Motion.panel(ctx, x, y, w, h, theme, 0.7 * alpha, 'result');
    ctx.save(); ctx.globalAlpha *= alpha * (variant === 'ink' ? 0.06 : 0.10); ctx.fillStyle = col; ctx.fillRect(x, y, w, h); ctx.restore();
    ctx.save(); ctx.globalAlpha *= alpha * (variant === 'ink' ? 0.25 : 0.30); ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1); ctx.restore();
  };
  M.resultColour = theme => theme.result || theme.anchorA || '#F2B134';
  M.ringMarker = function (ctx, x, y, r, colour, alpha = 1) { if (alpha <= 0) return; ctx.save(); ctx.globalAlpha *= alpha; ctx.strokeStyle = colour; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); };

  // --- density layers (base64 typed arrays) --------------------------------------------------
  M.countClass = function (n) { return n <= 2 ? 0 : n <= 5 ? 1 : n <= 10 ? 2 : n <= 25 ? 3 : n <= 60 ? 4 : n <= 150 ? 5 : n <= 400 ? 6 : 7; };
  M.countAlpha = [0.22, 0.32, 0.44, 0.56, 0.68, 0.8, 0.9, 1.0];
  M.countClassLabels = ['1–2', '3–5', '6–10', '11–25', '26–60', '61–150', '151–400', '> 400'];
  M.decodeDensity = function (layer) {
    const ix = M.b64Int16(layer.ix), iy = M.b64Int16(layer.iy), n = M.b64Int32(layer.n), a = M.b64Int32(layer.a);
    return { label: layer.label, grid: layer.grid_km, origin: layer.origin, ix, iy, n, a, count: layer.count, sum_n: layer.sum_n, sum_a: layer.sum_a, max_n: layer.max_n, shown_shares: layer.shown_shares };
  };
  // Paths by count class (8) and by share class (5 classes over 50+ firm cells, class 5 = below support).
  M.buildDensityPaths = function (d, shareBreaks) {
    const byCount = new Map(), byShare = new Map(); const g = d.grid, ox = d.origin[0], oy = d.origin[1];
    const gap = g >= 1 ? g * 0.12 : g * 0.1; const s = g - gap, h = gap / 2;
    for (let i = 0; i < d.count; i++) {
      const x = ox + d.ix[i] * g + h, y = oy + d.iy[i] * g + h;
      const cc = M.countClass(d.n[i]); let p = byCount.get(cc); if (!p) { p = new Path2D(); byCount.set(cc, p); } p.rect(x, y, s, s);
      let sc = 5; if (d.a[i] >= 0 && d.n[i] >= 50) { const share = 100 * d.a[i] / d.n[i]; sc = 0; while (sc < shareBreaks.length && share >= shareBreaks[sc]) sc++; }
      let q = byShare.get(sc); if (!q) { q = new Path2D(); byShare.set(sc, q); } q.rect(x, y, s, s);
    }
    return { byCount, byShare };
  };
  M.drawDensityCounts = function (ctx, stage, cam, paths, color, alpha) {
    Motion.camTransform(ctx, stage, cam); ctx.save(); ctx.globalAlpha *= alpha; ctx.fillStyle = color;
    for (const [c, p] of paths.byCount) { ctx.save(); ctx.globalAlpha *= M.countAlpha[c]; ctx.fill(p); ctx.restore(); }
    ctx.restore(); stage.base();
  };
  M.drawDensityShares = function (ctx, stage, cam, paths, ramp, belowColor, alpha) {
    Motion.camTransform(ctx, stage, cam); ctx.save(); ctx.globalAlpha *= alpha;
    for (const [c, p] of paths.byShare) { ctx.fillStyle = c === 5 ? belowColor : ramp[c]; if (c === 5) { ctx.save(); ctx.globalAlpha *= 0.55; ctx.fill(p); ctx.restore(); } else ctx.fill(p); }
    ctx.restore(); stage.base();
  };

  // --- legends (design space) -----------------------------------------------------------------
  M.legendSwatches = function (ctx, x, y, items, theme, { swatch = 26, gapPx = 8, size = 24, alpha = 1, columns = 1, colWidth = 300, rowGap = 12 } = {}) {
    ctx.save(); ctx.globalAlpha *= alpha;
    items.forEach((it, i) => {
      const col = i % columns, row = Math.floor(i / columns);
      const xx = x + col * colWidth, yy = y + row * (swatch + rowGap);
      if (it.alpha != null) { ctx.save(); ctx.globalAlpha *= it.alpha; M.barSwatch(ctx, xx, yy + 1, swatch, swatch - 3, it.color); ctx.restore(); } else M.barSwatch(ctx, xx, yy + 1, swatch, swatch - 3, it.color);
      Motion.text(ctx, it.label, xx + swatch + gapPx + 4, yy + swatch * 0.5, { size, color: it.textColor || theme.ink, baseline: 'middle' });
      if (it.right) Motion.text(ctx, it.right, xx + colWidth - 16, yy + swatch * 0.5, { size, color: theme.muted, baseline: 'middle', align: 'right', alpha: it.rightAlpha == null ? 1 : it.rightAlpha });
    });
    ctx.restore();
  };
  // A ramp swatch as horizontal bars with hairline gaps (round 10): bars 2 px, gaps 1 px, eight where the swatch is 23 px or taller, fewer where not.
  M.barSwatch = function (ctx, x, y, w, h, colour) { const n = Math.max(1, Math.min(8, Math.floor((h + 1) / 3))), bh = (h - (n - 1)) / n; ctx.fillStyle = colour; for (let i = 0; i < n; i++) ctx.fillRect(x, y + i * (bh + 1), w, bh); };
  // Horizontal classed bar legend: swatches of bars with boundary values printed between them; a one- or two-line title above.
  M.legendBar = function (ctx, x, y, w, colors, boundaries, theme, { height = 23, size = 22, alpha = 1, left = '', right = '', title = null } = {}) {
    ctx.save(); ctx.globalAlpha *= alpha;
    const n = colors.length, sw = w / n;
    if (title) (Array.isArray(title) ? title : [title]).forEach((ln, i, arr) => Motion.text(ctx, ln, x, y - 14 - 28 * (arr.length - 1 - i), { size, color: theme.muted, group: 'legend-title' }));
    colors.forEach((c, i) => M.barSwatch(ctx, x + i * sw + 1.5, y, sw - 3, height, c));
    boundaries.forEach((b, i) => Motion.text(ctx, b, x + (i + 1) * sw, y + height + 26, { size, color: theme.ink, align: 'center' }));
    if (left) Motion.text(ctx, left, x, y + height + 26, { size, color: theme.muted, align: 'left' });
    if (right) Motion.text(ctx, right, x + w, y + height + 26, { size, color: theme.muted, align: 'right' });
    ctx.restore();
  };

  // City marker and label in design space (after the camera transform is reset).
  // A label fades over the 300 px nearest the frame edge (a panning camera carries it in and out) and is not drawn outside.
  M.cityLabel = function (ctx, cam, city, theme, { size = 24, dot = 4, alpha = 1, dx = 10, dy = -8 } = {}) {   // the label in tracked capitals at 500 (round 10)
    const [px, py] = Motion.project(cam, city.x, city.y);
    const edge = Math.min(px, 1920 - px, py, 1080 - py); if (edge <= 0) return;
    alpha *= Motion.clamp(edge / 300, 0, 1); if (alpha <= 0) return;
    ctx.save(); ctx.globalAlpha *= alpha; ctx.fillStyle = theme.ink; ctx.beginPath(); ctx.arc(px, py, dot, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    Motion.text(ctx, city.label.toUpperCase(), px + dx, py + dy, { size, weight: 500, color: theme.ink, alpha, kind: 'label', letterSpacing: size * 0.08 });
  };

  window.MotionMap = M;
  // --- the top-right information panel -------------------------------------------------------
  // Shared by the explainer's Moscow beats and the treated cut's ticker: the location (split-flap)
  // with its window line, a large year (two strings crossfading during a dissolve) and up to three
  // right-aligned count lines. Everything sits inside one 440 px wide panel at (1420, 70): 210 px tall
  // with up to two lines (at y 244 and 272), 230 px with three (at 240, 266 and 292; 25 October 2026).
  M.infoLines = function (ctx, theme, lines, alpha) {
    if (alpha <= 0) return;
    const three = lines.length > 2, y0 = three ? 240 : 244, dy = three ? 26 : 28;
    lines.forEach(([s, color], i) => Motion.text(ctx, s, 1836, y0 + dy * i, { size: i === 0 ? 24 : 22, color: color || (i === 0 ? theme.ink : theme.muted), align: 'right', alpha, group: 'counters-' + i }));
  };
  M.infoPanel = function (ctx, theme, { alpha = 1, loc = null, year = null, lines = [], w = 440 } = {}) {   // w: wider where a line needs it (round 10)
    if (alpha <= 0) return;
    Motion.panel(ctx, 1860 - w, 70, w, lines.length > 2 ? 230 : 210, theme, 0.92 * alpha);
    if (loc) {
      Motion.flipText(ctx, loc.from.name.toUpperCase(), loc.to.name.toUpperCase(), loc.u, { x: 1836, y: 108, size: 24, weight: 500, color: theme.muted, align: 'right', letterSpacing: 24 * 0.08, group: 'location', alpha });   // the place name in tracked capitals; the size line below stays mixed (round 10)
      Motion.flipText(ctx, loc.from.size, loc.to.size, loc.u, { x: 1836, y: 138, size: 22, weight: 400, color: theme.dim, align: 'right', letterSpacing: 1, group: 'location-size', alpha });
    }
    if (year) {
      const u = year.b == null ? 0 : year.u;
      Motion.text(ctx, year.a, 1836, 212, { size: 84, weight: 700, color: theme.ink, align: 'right', alpha: alpha * (1 - u), group: 'year', stripe: { gap: 2 } });   // the large year, striped (round 10)
      if (u > 0) Motion.text(ctx, year.b, 1836, 212, { size: 84, weight: 700, color: theme.ink, align: 'right', alpha: alpha * u, group: 'year', stripe: { gap: 2 } });
    }
    M.infoLines(ctx, theme, lines, alpha);
  };
  // Location schedule: entries [{start, name, size}] on the caller's clock; returns the previous
  // and current entries and the flip progress (0.5 s plus 30 ms per extra glyph, a pure function of time).
  // A listed firm's mark: a pale halo of the given width (0 removes it), the land disc, the red fill when a statement is
  // available (fill 1) and a red ring when it is absent (fill 0); fill between the two fades one into the other. A hollow
  // mark keeps a land core of at least 0.75 px inside a stroke of at least 1 px, so it stays a ring at every zoom (its outer
  // radius grows above the solid mark's at the floor; 25 October 2026).
  // ---- listed marks (round 8) and the bloom, second pass (round 9, 25 October 2026): a flash with a pale core that fades to
  // the mark's own colour, a soft pale glow under it, two rings that reach 44 to 64 px, a per-firm start (the atlas's
  // west-to-east stagger) and a 1.5 s decay; nothing is allocated per mark, the phase is written into a caller-owned object.
  // The atlas's cased marks (round 14, the author's choice B'' of 25 October 2026; style is the rule from M.listedRule with M.listedCased on): a thin casing in the stage
  // colour in place of the pale halo, at 0.4 of its strength and 0.6 of its width up to k 20 and full by k 60, so the red stays red at the city zoom and is set apart
  // from the amber and cyan dots at the street zoom without a glow; at the national zoom no land disc under a solid mark, so the red blends with the field.
  M.listedMark = function (ctx, px, py, rr, fill, alpha, theme, halo = 1, core = null, style = null) {
    const TAU = Math.PI * 2, w = Math.max(1.0, Math.min(2.2, rr * 0.45)), R = rr + (1 - fill) * Math.max(0, 0.75 + w - rr), cased = !!(style && style.casingA != null);
    ctx.save(); ctx.globalAlpha = alpha;
    if (halo > 0.05 && !cased) { ctx.fillStyle = theme.treatedOutline; ctx.beginPath(); ctx.arc(px, py, R + halo, 0, TAU); ctx.fill(); }
    if (halo > 0.05 && cased) { ctx.fillStyle = theme.stage; ctx.globalAlpha = alpha * style.casingA; ctx.beginPath(); ctx.arc(px, py, R + Math.min(1, halo) * style.casingW, 0, TAU); ctx.fill(); ctx.globalAlpha = alpha; }
    if (!cased || style.underlay || fill < 1) { ctx.fillStyle = core && fill < 1 ? core : theme.land; ctx.beginPath(); ctx.arc(px, py, R, 0, TAU); ctx.fill(); }
    if (fill > 0) { ctx.fillStyle = core || theme.treated; ctx.globalAlpha = alpha * fill; ctx.beginPath(); ctx.arc(px, py, R, 0, TAU); ctx.fill(); }
    if (fill < 1) { ctx.globalAlpha = alpha; ctx.strokeStyle = theme.treated; ctx.lineWidth = w; ctx.beginPath(); ctx.arc(px, py, R - w / 2, 0, TAU); ctx.stroke(); }
    ctx.restore();
  };
  M.rimmedMark = function (ctx, px, py, r, colour, fillAlpha, rimAlpha, theme, rimW = 1.5) {
    const TAU = Math.PI * 2; ctx.save();
    ctx.globalAlpha = fillAlpha; ctx.fillStyle = colour; ctx.beginPath(); ctx.arc(px, py, r, 0, TAU); ctx.fill();
    ctx.globalAlpha = rimAlpha; ctx.strokeStyle = theme.treated; ctx.lineWidth = rimW; ctx.beginPath(); ctx.arc(px, py, r + rimW / 2, 0, TAU); ctx.stroke();
    ctx.restore();
  };
  M.PULSE = { attack: 0.10, release: 0.35, ringDelay: 0.08, glow: 0.70, decay: 1.5, cull: 80 };   // seconds; the atlas's timings (the video fits its own inside each hold)
  M.quietWeight = k => Motion.clamp(Math.log2(60 / k) / Math.log2(120), 0, 1);
  // The listed rule by zoom: the resting marks' floor, cap, halo and alpha and the rim (round 8, untouched), and the bloom's
  // ring reach Rmax (44 px at the reference zoom, up to 64), ring width W and the stagger spread (200 ms at the country, 60 at the street).
  // The atlas's national extra (round 11, the author's item 2; M.listedQuiet is 1 on the atlas and 0 on the video): below the city zoom (the city preset's own k, which the
  // atlas sets in M.listedCityK from the stage's size: 9.3 at 1,600 by 1,000, 3.9 on a phone) the resting alpha falls further to 0.60 at the country and the radius
  // floor to 0.85 px, through the same weight; nothing changes from the city zoom up; the pulse is untouched.
  // The atlas's B'' (round 14, M.listedCased 1 there, 0 in the video): at the country the resting alpha a further fifth lower (0.48) and the floor 18 percent smaller (0.70 px),
  // and the casing's strength, width and the land disc as listedMark describes.
  M.listedQuiet = 0; M.listedCityK = 10; M.listedCased = 0;
  M.listedRule = function (rule, k, kRef) {
    const q = M.quietWeight(k), lk = Math.log2(k / kRef), qc = M.quietWeight(M.listedCityK), q2 = M.listedQuiet * Motion.clamp((q - qc) / Math.max(1e-9, 1 - qc), 0, 1);
    const L = { q, q2, base: rule[0], s: rule[1], floor: rule[3] * (1 - 0.35 * q - (1 / 12) * q2), cap: rule[2] * (1 - 0.30 * q), halo: 1 - q, alpha: 1 - 0.2 * q - 0.2 * q2,
             rimW: 1.5 * (1 - 0.33 * q), rimA: 0.8 * (1 - 0.15 * q), Rmax: Motion.clamp(44 + 2 * lk, 44, 64), W: Motion.clamp(3.5 - 0.2 * lk, 2.2, 3.5), spreadMs: 60 + 140 * q };
    if (M.listedCased) { const t = Motion.clamp((k - 20) / 40, 0, 1); L.alpha *= 1 - 0.2 * q2; L.floor *= 1 - 0.18 * q2; L.casingA = 0.8 * (0.4 + 0.6 * t); L.casingW = 0.6 + 0.4 * t; L.underlay = q2 < 0.5; }
    return L;
  };
  M.listedRadius = (L, n) => Math.max(L.floor, Math.min(L.cap, L.base + L.s * Math.sqrt(Math.max(0, n - 1))) / 2);
  M.flashPeak = r => Math.min(14, Math.max(2.5 * r, 4));   // the flash's extra radius at its peak, px
  // The phase of one firm's bloom t seconds after its own start, into o: on (started), swell (the flash, 0 to 1 and back),
  // release (the pale core's fade to the mark's colour, 0 to 1), grow (the mark's opacity ramp), glowA (the glow's alpha), p (the rings, 0 to 1).
  // The atlas's reformed pulse (round 15, the author's items 4 and 7B, M.pulseModern 1 there, 0 in the video): no swell, no pale core and no glow; the mark fades
  // in to its red over 0.35 s and one thin ring expands and fades (pulseRing), so a year's new firms read as a quiet sweep and each frame draws one stroke per firm.
  // Since round 22 that ring marks only the firm found by name; a year's listed firms swell instead (M.swellPhase below).
  M.pulseModern = 0;
  M.pulsePhase = function (t, o, P = M.PULSE) {
    if (t <= 0) { o.on = false; o.swell = 0; o.release = 0; o.grow = 0; o.glowA = 0; o.p = 0; return o; }
    o.on = true;
    if (M.pulseModern) { o.swell = 0; o.release = 1; o.glowA = 0; o.grow = Motion.ease.outCubic(Motion.clamp(t / 0.35, 0, 1)); o.p = Motion.clamp((t - P.ringDelay) / P.decay, 0, 1); return o; }
    o.swell = t < P.attack ? Motion.ease.outCubic(t / P.attack) : t < P.attack + P.release ? 1 - Motion.ease.inOutSine((t - P.attack) / P.release) : 0;
    o.release = t < P.attack ? 0 : Motion.clamp((t - P.attack) / P.release, 0, 1);
    o.grow = Motion.ease.outCubic(Motion.clamp(t / (P.attack + P.release), 0, 1));
    const g = 1 - Motion.clamp(t / P.glow, 0, 1); o.glowA = 0.18 * g * g;
    o.p = Motion.clamp((t - P.ringDelay) / P.decay, 0, 1);
    return o;
  };
  // The pale core's 8-step tables, built once per theme: pale to the listed red (solid marks) and pale to the land (hollow marks).
  M.coreRamp = function (theme) {
    const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
    const mix = (a, b, t) => { const pa = rgb(a), pb = rgb(b); return '#' + [0, 1, 2].map(i => Math.round(pa[i] + (pb[i] - pa[i]) * t).toString(16).padStart(2, '0')).join(''); };
    const steps = (from, to) => Array.from({ length: 8 }, (_, i) => mix(from, to, i / 7));
    return { coreRed: steps(theme.treatedOutline, theme.treated), coreLand: steps(theme.treatedOutline, theme.land) };
  };
  M.coreAt = (table, release) => table[Math.min(7, Math.max(0, Math.round(release * 7)))];
  M.glowDisc = function (ctx, px, py, radius, alpha, theme) {
    ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = theme.treatedOutline; ctx.beginPath(); ctx.arc(px, py, radius, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  };
  // The two rings at progress p (0 to 1) around a mark of resting radius r: ring 1 in the listed red reaching r + 2 + Rmax,
  // ring 2 trailing at 0.7 of it in the pale outline colour (the red at half alpha on a light theme); still: the held highlight.
  M.pulseRing = function (ctx, px, py, r, L, p, theme, still) {
    const TAU = Math.PI * 2, light = theme.dark === false; let r1, w1, a1, r2, w2, a2;
    if (M.pulseModern) {   // one ring in the treated red, about half the bloom's width, eased out to r + 2 + Rmax and gone; still: held at half that reach
      const w = Math.max(1.25, 0.55 * L.W), rr = still ? 2 + 0.5 * L.Rmax : 2 + L.Rmax * Motion.ease.outCubic(p), a = still ? 0.6 : 0.85 * (1 - p) * (1 - p);
      if (a <= 0.01) return; ctx.save(); ctx.lineWidth = w; ctx.globalAlpha = light ? 0.8 * a : a; ctx.strokeStyle = theme.treated; ctx.beginPath(); ctx.arc(px, py, r + rr, 0, TAU); ctx.stroke(); ctx.restore(); return;
    }
    if (still) { r1 = 2 + 0.6 * L.Rmax; w1 = L.W; a1 = 0.6; r2 = 0.7 * r1; w2 = 0.8 * L.W; a2 = 0.4; }
    else {
      const g = Motion.ease.outCubic(p); r1 = 2 + L.Rmax * g; w1 = L.W * (1 - 0.4 * p); a1 = 0.95 * (1 - p) * (1 - p);
      const p2 = Motion.clamp((p - 0.15) / 0.85, 0, 1), fade2 = Motion.clamp((p - 0.15) / 0.1, 0, 1); r2 = 0.7 * r1; w2 = 0.8 * L.W; a2 = 0.7 * fade2 * (1 - p2) * (1 - p2);
    }
    ctx.save();
    ctx.lineWidth = w1; ctx.globalAlpha = a1; ctx.strokeStyle = theme.treated; ctx.beginPath(); ctx.arc(px, py, r + r1, 0, TAU); ctx.stroke();
    if (a2 > 0.01) { ctx.lineWidth = w2; ctx.globalAlpha = light ? a2 * 0.5 : a2; ctx.strokeStyle = light ? theme.treated : theme.treatedOutline; ctx.beginPath(); ctx.arc(px, py, r + r2, 0, TAU); ctx.stroke(); }
    ctx.restore();
  };
  // The atlas's listed pulse since round 22 (the author's pick A of 29 October 2026): each new red mark swells to r + swellPeak(r) and settles back over
  // 0.9 s, with no ring, no glow and no pale core; on the Cells view a red dot at each pulsing cell's centre swells and goes (swellDot), cased in the stage colour. The 44 to 64 px ring
  // before it read as an explosion, and painting 1,480 of them (2024) dropped about a third of the frames; the swell draws one disc per firm.
  M.SWELL = 0.9;   // seconds
  M.swellPeak = r => Math.min(12, Math.max(5, 2.4 * r));   // the extra radius at the peak, px: twice round 22's (the author's pick of 29 October 2026, round 23; 2.5 to 6 px read too quiet)
  M.swellPhase = function (t, o) {   // into the bloom phase's fields: on, grow (the red's fade-in over 0.2 s), swell (0 to 1 and back), p (0 to 1)
    if (t <= 0) { o.on = false; o.swell = 0; o.release = 0; o.grow = 0; o.glowA = 0; o.p = 0; return o; }
    const u = Motion.clamp(t / M.SWELL, 0, 1);
    o.on = true; o.release = 1; o.glowA = 0; o.grow = Motion.ease.outCubic(Motion.clamp(t / 0.2, 0, 1)); o.swell = Math.sin(Math.PI * u); o.p = u; return o;
  };
  M.swellDot = function (ctx, px, py, r, p, theme, still) {   // still (reduced motion): held at 0.6 of the peak
    const R = (r + M.swellPeak(r)) * (still ? 0.6 : Math.sin(Math.PI * p)); if (R <= 0.3) return;
    const dark = theme.dark !== false; ctx.save(); ctx.globalAlpha = dark ? 0.9 : 0.8;
    { const cw = dark ? 1.5 : 1; ctx.strokeStyle = theme.stage; ctx.lineWidth = cw; ctx.beginPath(); ctx.arc(px, py, R + cw / 2, 0, Math.PI * 2); ctx.stroke(); }   // the casing (the author's picks of 29 October 2026): the stage colour outside the dot, as on the hover ring; 1.5 px on the dark theme, where the orange and amber cells swallowed the dot, 1 px on the light theme, where the red is 1.01 to 1.62:1 against every industry colour and 1.5 px read as a white ring
    ctx.fillStyle = theme.treated; ctx.beginPath(); ctx.arc(px, py, R, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  };
  M.locationAt = function (entries, l) {
    let i = 0; while (i < entries.length - 1 && l >= entries[i + 1].start) i++;
    const to = entries[i], from = i > 0 ? entries[i - 1] : to;
    const n = Math.max(from.name.length, to.name.length), u = i > 0 ? Motion.clamp((l - to.start) / (0.5 + 0.03 * (n - 1)), 0, 1) : 1;
    return { from, to, u };
  };
})();
