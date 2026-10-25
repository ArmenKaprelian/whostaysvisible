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
    return { lod0, lod1, grat, extents: bm.extents, cities, lod1MinK: bm.lod1.use_when_px_per_km_at_least || 9 };
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
  M.drawBasemap = function (ctx, stage, cam, bmp, theme, { landAlpha = 1, borderPx = 0.8, graticule = true, borders = true } = {}) {
    Motion.camTransform(ctx, stage, cam);
    const fine = M.windowLod(bmp, cam, stage);
    const w1 = fine ? Motion.clamp((cam.k - 6) / 6, 0, 1) : 0;
    const path = w1 >= 0.5 && fine ? fine : bmp.lod0;
    ctx.save(); ctx.globalAlpha *= landAlpha;
    ctx.fillStyle = theme.land; ctx.fill(path, 'evenodd');
    if (graticule) { ctx.strokeStyle = theme.graticule; ctx.lineWidth = 1.0 / cam.k; ctx.stroke(bmp.grat); }   // a whiter 1 px line since round 9 (0.7 px before)
    if (borders) {
      ctx.strokeStyle = theme.border; ctx.lineWidth = Math.min(borderPx, 1) / cam.k; ctx.lineJoin = 'round';
      if (w1 < 1) { ctx.save(); ctx.globalAlpha *= 1 - w1; ctx.stroke(bmp.lod0); ctx.restore(); }
      if (w1 > 0 && fine) { ctx.save(); ctx.globalAlpha *= w1; ctx.stroke(fine); ctx.restore(); }
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
  M.drawTiles = function (ctx, stage, cam, paths, colorOf, { alpha = 1, alphaOf = null, stroke = null, strokePx = 1, strokeAlpha = 0.3 } = {}) {
    Motion.camTransform(ctx, stage, cam);
    ctx.save(); ctx.globalAlpha *= alpha;
    for (const [c, p] of paths) {
      if (stroke && stroke.has(c)) { ctx.save(); ctx.globalAlpha *= strokeAlpha; ctx.strokeStyle = colorOf(c); ctx.lineWidth = strokePx / cam.k; ctx.stroke(p); ctx.restore(); continue; }
      ctx.fillStyle = colorOf(c); if (alphaOf) { ctx.save(); ctx.globalAlpha *= alphaOf(c); ctx.fill(p); ctx.restore(); } else ctx.fill(p);
    }
    ctx.restore(); stage.base();
  };

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
      ctx.fillStyle = it.color; if (it.alpha != null) { ctx.save(); ctx.globalAlpha *= it.alpha; ctx.fillRect(xx, yy, swatch, swatch); ctx.restore(); } else ctx.fillRect(xx, yy, swatch, swatch);
      Motion.text(ctx, it.label, xx + swatch + gapPx + 4, yy + swatch * 0.5, { size, color: it.textColor || theme.ink, baseline: 'middle' });
      if (it.right) Motion.text(ctx, it.right, xx + colWidth - 16, yy + swatch * 0.5, { size, color: theme.muted, baseline: 'middle', align: 'right', alpha: it.rightAlpha == null ? 1 : it.rightAlpha });
    });
    ctx.restore();
  };
  // Horizontal classed bar legend: touching swatches with boundary values printed between them.
  M.legendBar = function (ctx, x, y, w, colors, boundaries, theme, { height = 22, size = 22, alpha = 1, left = '', right = '', title = null } = {}) {
    ctx.save(); ctx.globalAlpha *= alpha;
    const n = colors.length, sw = w / n;
    if (title) Motion.text(ctx, title, x, y - 14, { size, color: theme.muted });
    colors.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(x + i * sw + 1.5, y, sw - 3, height); });
    boundaries.forEach((b, i) => Motion.text(ctx, b, x + (i + 1) * sw, y + height + 26, { size, color: theme.ink, align: 'center' }));
    if (left) Motion.text(ctx, left, x, y + height + 26, { size, color: theme.muted, align: 'left' });
    if (right) Motion.text(ctx, right, x + w, y + height + 26, { size, color: theme.muted, align: 'right' });
    ctx.restore();
  };

  // City marker and label in design space (after the camera transform is reset).
  // A label fades over the 300 px nearest the frame edge (a panning camera carries it in and out) and is not drawn outside.
  M.cityLabel = function (ctx, cam, city, theme, { size = 24, dot = 4, alpha = 1, dx = 10, dy = -8 } = {}) {
    const [px, py] = Motion.project(cam, city.x, city.y);
    const edge = Math.min(px, 1920 - px, py, 1080 - py); if (edge <= 0) return;
    alpha *= Motion.clamp(edge / 300, 0, 1); if (alpha <= 0) return;
    ctx.save(); ctx.globalAlpha *= alpha; ctx.fillStyle = theme.ink; ctx.beginPath(); ctx.arc(px, py, dot, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    Motion.text(ctx, city.label, px + dx, py + dy, { size, color: theme.ink, alpha, kind: 'label' });
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
  M.infoPanel = function (ctx, theme, { alpha = 1, loc = null, year = null, lines = [] } = {}) {
    if (alpha <= 0) return;
    Motion.panel(ctx, 1420, 70, 440, lines.length > 2 ? 230 : 210, theme, 0.92 * alpha);
    if (loc) {
      Motion.flipText(ctx, loc.from.name, loc.to.name, loc.u, { x: 1836, y: 108, size: 24, weight: 600, color: theme.muted, align: 'right', letterSpacing: 2, group: 'location', alpha });
      Motion.flipText(ctx, loc.from.size, loc.to.size, loc.u, { x: 1836, y: 138, size: 22, weight: 400, color: theme.dim, align: 'right', letterSpacing: 1, group: 'location-size', alpha });
    }
    if (year) {
      const u = year.b == null ? 0 : year.u;
      Motion.text(ctx, year.a, 1836, 212, { size: 84, weight: 700, color: theme.ink, align: 'right', alpha: alpha * (1 - u), group: 'year' });
      if (u > 0) Motion.text(ctx, year.b, 1836, 212, { size: 84, weight: 700, color: theme.ink, align: 'right', alpha: alpha * u, group: 'year' });
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
  M.listedMark = function (ctx, px, py, rr, fill, alpha, theme, halo = 1, core = null) {
    const TAU = Math.PI * 2, w = Math.max(1.0, Math.min(2.2, rr * 0.45)), R = rr + (1 - fill) * Math.max(0, 0.75 + w - rr);
    ctx.save(); ctx.globalAlpha = alpha;
    if (halo > 0.05) { ctx.fillStyle = theme.treatedOutline; ctx.beginPath(); ctx.arc(px, py, R + halo, 0, TAU); ctx.fill(); }
    ctx.fillStyle = core && fill < 1 ? core : theme.land; ctx.beginPath(); ctx.arc(px, py, R, 0, TAU); ctx.fill();
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
  M.listedRule = function (rule, k, kRef) {
    const q = M.quietWeight(k), lk = Math.log2(k / kRef);
    return { q, base: rule[0], s: rule[1], floor: rule[3] * (1 - 0.35 * q), cap: rule[2] * (1 - 0.30 * q), halo: 1 - q, alpha: 1 - 0.2 * q,
             rimW: 1.5 * (1 - 0.33 * q), rimA: 0.8 * (1 - 0.15 * q), Rmax: Motion.clamp(44 + 2 * lk, 44, 64), W: Motion.clamp(3.5 - 0.2 * lk, 2.2, 3.5), spreadMs: 60 + 140 * q };
  };
  M.listedRadius = (L, n) => Math.max(L.floor, Math.min(L.cap, L.base + L.s * Math.sqrt(Math.max(0, n - 1))) / 2);
  M.flashPeak = r => Math.min(14, Math.max(2.5 * r, 4));   // the flash's extra radius at its peak, px
  // The phase of one firm's bloom t seconds after its own start, into o: on (started), swell (the flash, 0 to 1 and back),
  // release (the pale core's fade to the mark's colour, 0 to 1), grow (the mark's opacity ramp), glowA (the glow's alpha), p (the rings, 0 to 1).
  M.pulsePhase = function (t, o, P = M.PULSE) {
    if (t <= 0) { o.on = false; o.swell = 0; o.release = 0; o.grow = 0; o.glowA = 0; o.p = 0; return o; }
    o.on = true;
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
  M.locationAt = function (entries, l) {
    let i = 0; while (i < entries.length - 1 && l >= entries[i + 1].start) i++;
    const to = entries[i], from = i > 0 ? entries[i - 1] : to;
    const n = Math.max(from.name.length, to.name.length), u = i > 0 ? Motion.clamp((l - to.start) / (0.5 + 0.03 * (n - 1)), 0, 1) : 1;
    return { from, to, u };
  };
})();
