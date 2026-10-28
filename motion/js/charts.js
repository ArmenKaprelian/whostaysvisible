// Charts in design space. Each function draws one chart into a box {x, y, w, h} and takes a
// progress value in 0..1 that reveals the marks; everything else is a pure function of its inputs.
(function () {
  'use strict';
  const C = {};
  const T = (ctx, s, x, y, o) => Motion.text(ctx, s, x, y, o);
  // Labels fade with the chart's progress: a label never appears in one frame (text audit rule).
  const tail = (progress, from = 0.85) => Motion.clamp((progress - from) / (1 - from), 0, 1);   // the last part of the reveal
  const head = (progress, over = 0.4) => Motion.clamp(progress / over, 0, 1);                    // the first part (eased reveals start fast)

  C.scale = (domain, range) => v => range[0] + (v - domain[0]) / (domain[1] - domain[0]) * (range[1] - range[0]);
  // Label positions pushed apart to a minimum gap, in order, inside [lo, hi] (the atlas's narrow panels).
  C.spread = function (ys, gap, lo, hi) {
    const idx = ys.map((y, i) => i).sort((a, b) => ys[a] - ys[b]); const out = ys.slice();
    for (let k = 1; k < idx.length; k++) out[idx[k]] = Math.max(out[idx[k]], out[idx[k - 1]] + gap);
    const over = out[idx[idx.length - 1]] - hi; if (over > 0) for (const i of idx) out[i] -= over;
    for (let k = idx.length - 2; k >= 0; k--) out[idx[k]] = Math.min(out[idx[k]], out[idx[k + 1]] - gap);
    const under = lo - out[idx[0]]; if (under > 0) for (const i of idx) out[i] += under;
    return out;
  };
  C.logScale = (domain, range) => v => range[0] + (Math.log(v) - Math.log(domain[0])) / (Math.log(domain[1]) - Math.log(domain[0])) * (range[1] - range[0]);

  C.axisLeft = function (ctx, box, scaleY, ticks, theme, { fmt = v => String(v), size = 22, grid = true } = {}) {
    for (const t of ticks) {
      const y = scaleY(t);
      if (grid) { ctx.strokeStyle = theme.grid; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(box.x, y); ctx.lineTo(box.x + box.w, y); ctx.stroke(); }
      T(ctx, fmt(t), box.x - 14, y, { size, color: theme.muted, align: 'right', baseline: 'middle' });
    }
  };
  C.axisBottom = function (ctx, box, scaleX, ticks, theme, { fmt = v => String(v), size = 22, dy = 34 } = {}) {
    ctx.strokeStyle = theme.axis; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(box.x, box.y + box.h + 0.5); ctx.lineTo(box.x + box.w, box.y + box.h + 0.5); ctx.stroke();
    for (const t of ticks) T(ctx, fmt(t), scaleX(t), box.y + box.h + dy, { size, color: theme.muted, align: 'center' });
  };

  // Line chart of yearly series with era shading and dotted event ticks. series: [{label, color, points: [{x, y}], width}].
  C.lines = function (ctx, box, series, { xDomain, yDomain, progress = 1, theme, eras = [], events = [], yTicks = [], yFmt = v => v + '%', labelFmt = v => Motion.fmt.pct(v, 1), xTicks = [], xFmt = v => String(v), endLabels = true, labelSize = 24, lineWidth = 3.5, dots = true, axisSize = 22, axisDy = 34, spreadLabels = false } = {}) {
    const sx = C.scale(xDomain, [box.x, box.x + box.w]), sy = C.scale(yDomain, [box.y + box.h, box.y]);
    const xReveal = xDomain[0] + (xDomain[1] - xDomain[0]) * progress;
    // Era bands and event ticks.
    for (const e of eras) { ctx.fillStyle = e.color; ctx.fillRect(sx(Math.max(e.from, xDomain[0])), box.y, sx(Math.min(e.to, xDomain[1])) - sx(Math.max(e.from, xDomain[0])), box.h); if (e.label) T(ctx, e.label, (sx(e.from) + sx(e.to)) / 2, box.y + 30, { size: labelSize, color: theme.muted, align: 'center' }); }
    C.axisLeft(ctx, box, sy, yTicks, theme, { fmt: yFmt, size: axisSize });
    C.axisBottom(ctx, box, sx, xTicks, theme, { fmt: xFmt, size: axisSize, dy: axisDy });
    for (const ev of events) {
      if (ev.x > xReveal) continue;
      const evAlpha = Motion.clamp((xReveal - ev.x) / 0.6, 0, 1);   // over 0.6 years of the reveal
      const x = sx(ev.x); ctx.save(); ctx.globalAlpha *= evAlpha; ctx.setLineDash([3, 7]); ctx.strokeStyle = theme.tick; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, box.y); ctx.lineTo(x, box.y + box.h); ctx.stroke(); ctx.restore();
      if (ev.label) T(ctx, ev.label, x + 8, ev.labelY != null ? ev.labelY : box.y + box.h - 14 - (ev.row || 0) * 28, { size: labelSize - 2, color: theme.muted, alpha: evAlpha });
    }
    // Lines, revealed left to right with linear interpolation of the last visible segment (presentation only).
    const ends = [];
    for (const s of series) {
      const pts = s.points.filter(p => p.y != null).sort((a, b) => a.x - b.x);
      ctx.strokeStyle = s.color; ctx.lineWidth = s.width || lineWidth; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.beginPath(); let last = null; let started = false;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        if (p.x <= xReveal) { if (!started) { ctx.moveTo(sx(p.x), sy(p.y)); started = true; } else ctx.lineTo(sx(p.x), sy(p.y)); last = p; }
        else if (last && !(s.gapAfter && s.gapAfter.includes(last.x))) { const u = (xReveal - last.x) / (p.x - last.x); ctx.lineTo(sx(xReveal), sy(last.y + (p.y - last.y) * u)); break; }
        else break;
        if (s.gapAfter && s.gapAfter.includes(p.x) && i < pts.length - 1 && pts[i + 1].x <= xReveal) { ctx.moveTo(sx(pts[i + 1].x), sy(pts[i + 1].y)); }
      }
      ctx.stroke();
      if (dots) for (const p of pts) { if (p.x > xReveal) break; ctx.fillStyle = s.color; ctx.beginPath(); ctx.arc(sx(p.x), sy(p.y), 4.5, 0, Math.PI * 2); ctx.fill(); }
      if (endLabels && last && progress >= 0.9) ends.push({ str: s.label.replace('{y}', labelFmt(last.y)), x: sx(last.x) + 14, y: sy(last.y), color: s.color });
    }
    const ys = spreadLabels ? C.spread(ends.map(e => e.y), labelSize + 2, box.y + labelSize / 2, box.y + box.h - labelSize / 2) : ends.map(e => e.y);
    ends.forEach((e, i) => T(ctx, e.str, e.x, ys[i], { size: labelSize, color: e.color, baseline: 'middle', weight: 500, alpha: tail(progress, 0.9) }));
    return { sx, sy };
  };

  // Slope chart between two columns. items: [{label, a, b, color}]. progress draws the lines from a to b.
  C.slopes = function (ctx, box, items, { yDomain, progress = 1, theme, leftLabel = '2021', rightLabel = '2024', fmt = v => v.toFixed(1) + '%', size = 26, leftMargin = 330, rightMargin = 130, spread = false } = {}) {
    const sy = C.scale(yDomain, [box.y + box.h, box.y]);
    // spread: the labels of each column pushed apart (the atlas's narrow panels); the dots stay on their values.
    const la = spread ? C.spread(items.map(it => sy(it.a)), size + 2, box.y, box.y + box.h) : items.map(it => sy(it.a));
    const lb = spread ? C.spread(items.map(it => sy(it.b)), size + 2, box.y, box.y + box.h) : items.map(it => sy(it.b));
    const x0 = box.x + leftMargin, x1 = box.x + box.w - rightMargin;
    ctx.strokeStyle = theme.grid; ctx.lineWidth = 1; [x0, x1].forEach(x => { ctx.beginPath(); ctx.moveTo(x, box.y); ctx.lineTo(x, box.y + box.h); ctx.stroke(); });
    const hy = box.y - (size >= 20 ? 18 : size + 4);   // the column headers sit closer to a small chart's box
    T(ctx, leftLabel, x0, hy, { size, color: theme.muted, align: 'center' }); T(ctx, rightLabel, x1, hy, { size, color: theme.muted, align: 'center' });
    items.forEach((it, i) => {
      const ya = sy(it.a), yb = sy(it.b); const u = progress;
      ctx.strokeStyle = it.color; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x0, ya); ctx.lineTo(x0 + (x1 - x0) * u, ya + (yb - ya) * u); ctx.stroke();
      ctx.fillStyle = it.color; ctx.beginPath(); ctx.arc(x0, ya, 6, 0, Math.PI * 2); ctx.fill();
      T(ctx, fmt(it.a), x0 - 16, la[i], { size, color: theme.ink, align: 'right', baseline: 'middle' });
      T(ctx, it.label, x0 - 16 - Motion.measure(ctx, fmt(it.a), size) - 14, la[i], { size, color: theme.muted, align: 'right', baseline: 'middle' });
      if (u >= 1) { ctx.beginPath(); ctx.arc(x1, yb, 6, 0, Math.PI * 2); ctx.fill(); }
      if (u >= 0.85) T(ctx, fmt(it.b), x1 + 16, lb[i], { size, color: it.color, align: 'left', baseline: 'middle', weight: 500, alpha: tail(u) });
    });
  };

  // 100% stacked horizontal bars. groups: [{label, sub, total, parts: [{label, value, color}]}].
  C.stackedBars = function (ctx, box, groups, { progress = 1, theme, size = 26, barH = 64, gap = 60, minLabelFrac = 0.06, legend = true } = {}) {
    if (legend && groups.length) {   // one legend row above the bars; segment labels under bars collide when segments are narrow
      let lx = box.x; const y0 = box.y - 70;
      for (const p of groups[0].parts) { ctx.fillStyle = p.color; ctx.fillRect(lx, y0 - 14, 22, 22); T(ctx, p.label, lx + 32, y0, { size: size - 2, color: theme.muted, baseline: 'middle' }); lx += 32 + Motion.measure(ctx, p.label, size - 2) + 44; }
    }
    groups.forEach((g, gi) => {
      const y = box.y + gi * (barH + gap + 40);
      T(ctx, g.label, box.x, y - 16, { size: size + 2, color: theme.ink, weight: 500 });
      if (g.sub) T(ctx, g.sub, box.x + Motion.measure(ctx, g.label, size + 2, 500) + 18, y - 16, { size, color: theme.muted });
      let x = box.x; const w = box.w * progress;
      for (const p of g.parts) {
        const pw = w * p.value / g.total; ctx.fillStyle = p.color; ctx.fillRect(x + 1.5, y, Math.max(0, pw - 3), barH);
        if (progress >= 0.85) {
          const label = Motion.fmt.pct(100 * p.value / g.total), la = tail(progress);
          if (p.value / g.total >= minLabelFrac) T(ctx, label, x + pw / 2, y + barH / 2 + 1, { size, color: p.textColor || theme.stage, align: 'center', baseline: 'middle', weight: 500, alpha: la });
          else T(ctx, label, x + pw / 2, y + barH + 30, { size: size - 2, color: theme.muted, align: 'center', alpha: la });
        }
        x += pw;
      }
    });
  };

  // Dot and whisker on a log x axis. rows: [{label, v, low, high, color, highlight}]. progress reveals rows top to bottom.
  C.dotWhiskers = function (ctx, box, rows, { xDomain = [0.02, 5], progress = 1, theme, ticks = [0.05, 0.1, 0.25, 0.5, 1, 2, 4], size = 24, rowH = null, refLine = 1 } = {}) {
    const sx = C.logScale(xDomain, [box.x, box.x + box.w]); const rh = rowH || box.h / rows.length;
    for (const t of ticks) { const x = sx(t); ctx.strokeStyle = theme.grid; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, box.y); ctx.lineTo(x, box.y + box.h); ctx.stroke(); T(ctx, String(t), x, box.y + box.h + 30, { size: size - 2, color: theme.muted, align: 'center' }); }
    if (refLine != null) { const x = sx(refLine); ctx.strokeStyle = theme.ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, box.y - 6); ctx.lineTo(x, box.y + box.h); ctx.stroke(); }
    rows.forEach((r, i) => {
      const u = Motion.clamp(progress * rows.length - i, 0, 1); if (u <= 0) return;
      const y = box.y + rh * (i + 0.5); ctx.save(); ctx.globalAlpha *= u;
      T(ctx, r.label, box.x - 18, y, { size, color: r.highlight ? theme.ink : theme.muted, align: 'right', baseline: 'middle', weight: r.highlight ? 600 : 400 });
      if (r.low != null && r.high != null) { ctx.strokeStyle = r.color; ctx.lineWidth = r.highlight ? 4 : 2.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(sx(r.low), y); ctx.lineTo(sx(r.high), y); ctx.stroke(); }
      ctx.fillStyle = r.color; ctx.beginPath(); ctx.arc(sx(r.v), y, r.highlight ? 9 : 7, 0, Math.PI * 2); ctx.fill();
      if (r.valueLabel !== false) T(ctx, r.valueLabel || Motion.fmt.dec(r.v, 2), sx(r.high != null ? r.high : r.v) + 16, y, { size: size - 2, color: r.highlight ? theme.ink : theme.muted, baseline: 'middle' });
      ctx.restore();
    });
    return sx;
  };

  // Year-by-year dots joined by lines for several series, on a log y axis by default. series: [{label, color, points: [{x, y, low, high}], whiskers}].
  // Round 18: log: false draws a linear axis; ref is the tick drawn as the reference line (1 for ratios, 0 suits coefficients on a linear axis); yFmt writes the
  // tick labels (String by default; Motion.fmt.signed writes the minus sign). The defaults draw exactly as before.
  C.yearDots = function (ctx, box, series, { xDomain, yDomain = [1, 5], progress = 1, theme, yTicks = [1, 1.5, 2, 3, 4, 5], size = 24, highlightX = null, thinTicks = false, spreadLabels = false, pad = 40, endGap = 22, log = true, ref = 1, yFmt = String } = {}) {   // pad: the plot's inner margins; endGap: the end labels' distance from the last point (the atlas's small panel passes 14 and 10; round 10)
    const sx = C.scale(xDomain, [box.x + pad, box.x + box.w - pad]), sy = (log ? C.logScale : C.scale)(yDomain, [box.y + box.h, box.y]);
    const tickSize = size >= 20 ? size - 2 : size;   // small panels keep their tick labels at the text size
    for (const t of yTicks) { const y = sy(t); ctx.strokeStyle = t === ref ? theme.ink : theme.grid; ctx.lineWidth = t === ref ? 1.5 : 1; ctx.beginPath(); ctx.moveTo(box.x, y); ctx.lineTo(box.x + box.w, y); ctx.stroke(); T(ctx, yFmt(t), box.x - 14, y, { size: tickSize, color: theme.muted, align: 'right', baseline: 'middle' }); }
    const years = []; for (let x = xDomain[0]; x <= xDomain[1]; x++) years.push(x);
    // thinTicks: every n-th year counted back from the last, n the smallest step at which the year labels do not touch (the atlas's narrow panels: every other year
    // from about 390 px, every third or only the two ends on a narrower phone, round 14).
    const dx = sx(xDomain[0] + 1) - sx(xDomain[0]), need = Motion.measure(ctx, String(xDomain[1]), size) + 6;
    const step = thinTicks ? ([1, 2, 3, 4, 5].find(s => s * dx >= need) || xDomain[1] - xDomain[0]) : 1;
    years.filter(x => (xDomain[1] - x) % step === 0).forEach(x => T(ctx, String(x), sx(x), box.y + box.h + (thinTicks ? size + 8 : 32), { size, color: highlightX === x ? theme.ink : theme.muted, align: 'center', weight: highlightX === x ? 600 : 400 }));
    if (highlightX != null) { ctx.fillStyle = theme.highlightBand; ctx.fillRect(sx(highlightX) - 46, box.y, 92, box.h); }
    const xReveal = xDomain[0] + (xDomain[1] - xDomain[0]) * progress;
    const ends = [];
    for (const s of series) {
      const pts = s.points.filter(p => p.x <= xReveal + 1e-9);
      ctx.strokeStyle = s.color; ctx.lineWidth = s.width || 3; ctx.lineJoin = 'round'; ctx.beginPath(); pts.forEach((p, i) => { if (i === 0) ctx.moveTo(sx(p.x), sy(p.y)); else ctx.lineTo(sx(p.x), sy(p.y)); }); ctx.stroke();
      for (const p of pts) {
        if (s.whiskers && p.low != null) { ctx.strokeStyle = s.color; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(sx(p.x), sy(p.low)); ctx.lineTo(sx(p.x), sy(p.high)); ctx.stroke(); }
        ctx.fillStyle = s.color; ctx.beginPath(); ctx.arc(sx(p.x), sy(p.y), s.dot || 7, 0, Math.PI * 2); ctx.fill();
      }
      if (pts.length && progress >= 0.9) ends.push({ str: s.label, x: sx(pts[pts.length - 1].x) + endGap, y: sy(pts[pts.length - 1].y), color: s.color });
    }
    const ys = spreadLabels ? C.spread(ends.map(e => e.y), size + 2, box.y + size / 2, box.y + box.h - size / 2) : ends.map(e => e.y);
    ends.forEach((e, i) => T(ctx, e.str, e.x, ys[i], { size, color: e.color, baseline: 'middle', weight: 500, alpha: tail(progress, 0.9) }));
    return { sx, sy };
  };

  // Six-year history strips: rows of A/N/X letters as coloured cells. rows: [{history, share, firms}].
  C.historyStrips = function (ctx, box, rows, { progress = 1, theme, colors, years = ['2019', '2020', '2021', '2022', '2023', '2024'], cell = 44, gap = 6, size = 22 } = {}) {
    years.forEach((y, j) => T(ctx, y, box.x + j * (cell + gap) + cell / 2, box.y - 12, { size: size - 2, color: theme.muted, align: 'center' }));
    rows.forEach((r, i) => {
      const u = Motion.clamp(progress * rows.length - i, 0, 1); if (u <= 0) return;
      const y = box.y + i * (cell + gap); ctx.save(); ctx.globalAlpha *= u;
      for (let j = 0; j < r.history.length; j++) { const ch = r.history[j]; const col = colors[ch] || theme.grid; ctx.fillStyle = col; ctx.fillRect(box.x + j * (cell + gap), y, cell, cell); T(ctx, ch, box.x + j * (cell + gap) + cell / 2, y + cell / 2 + 1, { size: size - 2, color: ch === 'A' ? theme.stage : theme.ink, align: 'center', baseline: 'middle', weight: 500 }); }
      const xx = box.x + r.history.length * (cell + gap) + 14;
      const barW = Math.max(0, (box.w - (xx - box.x) - 150) * (r.share / 100) * 2.5);
      ctx.fillStyle = theme.barMuted; ctx.fillRect(xx, y + 8, barW, cell - 16);
      T(ctx, Motion.fmt.pct(r.share) + '  ' + Motion.fmt.int(r.firms), xx + barW + 12, y + cell / 2 + 1, { size, color: theme.ink, baseline: 'middle' });
      ctx.restore();
    });
  };

  // A firm's path against its comparison group: the group's median line and interquartile band, the
  // firm's line (broken where a year is missing), on a log y axis. data: { firm: [{x, y|null}],
  // band: [{x, med, q1, q3}] }. progress reveals left to right; labels fade with the progress.
  // Options: progress reveals left to right (the first showing); `current` (a year, fractional during
  // a transition) draws the years beyond it in place at `futureAlpha` and puts a dot on each line at
  // the current year (the live box); `compact` drops the labels and the marker's text. The marker is
  // drawn in `colors.marker` (red for the listing year) and the firm line in `colors.firm`.
  C.bandLines = function (ctx, box, data, { ringCurrent = false, xDomain = [2013.6, 2025.4], yDomain = [25, 500], yTicks = [50, 100, 200, 400], xTicks = [2014, 2018, 2022, 2025], progress = 1, theme,
                                            colors = {}, marker = null, labels = {}, gapLabel = null, size = 22, current = null, futureAlpha = 0.3, compact = false, textAlpha = 1,
                                            labelAlpha = 1, xTicksMinor = [], minorAlpha = 1 } = {}) {
    const col = Object.assign({ firm: theme.ink, median: theme.accent, band: theme.accent, marker: theme.tick }, colors);
    const sx = C.scale(xDomain, [box.x, box.x + box.w]), sy = C.logScale(yDomain, [box.y + box.h, box.y]);
    const xReveal = xDomain[0] + (xDomain[1] - xDomain[0]) * progress;
    for (const tk of yTicks) { const y = sy(tk); ctx.strokeStyle = tk === 100 ? theme.dim : theme.grid; ctx.lineWidth = tk === 100 ? 1.5 : 1; ctx.beginPath(); ctx.moveTo(box.x, y); ctx.lineTo(box.x + box.w, y); ctx.stroke(); T(ctx, String(tk), box.x - 10, y, { size, color: theme.muted, align: 'right', baseline: 'middle', alpha: textAlpha }); }
    const dy = compact ? 28 : 34, xf = v => (v === 2025 ? '2025*' : String(v));
    ctx.save(); ctx.globalAlpha *= textAlpha; C.axisBottom(ctx, box, sx, xTicks, theme, { fmt: xf, size, dy }); ctx.restore();
    for (const tk of xTicksMinor) T(ctx, xf(tk), sx(tk), box.y + box.h + dy, { size, color: theme.muted, align: 'center', alpha: textAlpha * minorAlpha });
    const band = data.band.filter(p => p.q1 != null && p.q3 != null).sort((a, b) => a.x - b.x);
    const firm = data.firm.slice().sort((a, b) => a.x - b.x);
    const clipTo = (pts, key, xr) => { const out = []; for (let i = 0; i < pts.length; i++) { const p = pts[i]; if (p.x <= xr) out.push([p.x, p[key]]); else { if (i > 0) { const q = pts[i - 1]; const u = (xr - q.x) / (p.x - q.x); out.push([xr, q[key] + (p[key] - q[key]) * u]); } break; } } return out; };
    // Draws the band, the median and the firm line up to xr (the last segment interpolated, presentation only).
    const drawTo = (xr) => {
      const top = clipTo(band, 'q3', xr), bottom = clipTo(band, 'q1', xr);
      if (top.length > 1) {
        ctx.save(); ctx.globalAlpha *= 0.22; ctx.fillStyle = col.band; ctx.beginPath();
        top.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(sx(x), sy(y)) : ctx.lineTo(sx(x), sy(y))));
        bottom.slice().reverse().forEach(([x, y]) => ctx.lineTo(sx(x), sy(y)));
        ctx.closePath(); ctx.fill(); ctx.restore();
      }
      const med = clipTo(band, 'med', xr);
      ctx.strokeStyle = col.median; ctx.lineWidth = compact ? 2.5 : 3; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.beginPath();
      med.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(sx(x), sy(y)) : ctx.lineTo(sx(x), sy(y)))); ctx.stroke();
      ctx.strokeStyle = col.firm; ctx.lineWidth = compact ? 3 : 3.5; ctx.beginPath(); let pen = false, lastPt = null;
      for (let i = 0; i < firm.length; i++) {
        const p = firm[i];
        if (p.y == null) { pen = false; continue; }
        if (p.x > xr) { if (lastPt && pen) { const u = (xr - lastPt.x) / (p.x - lastPt.x); ctx.lineTo(sx(xr), sy(lastPt.y + (p.y - lastPt.y) * u)); } break; }
        if (pen) ctx.lineTo(sx(p.x), sy(p.y)); else ctx.moveTo(sx(p.x), sy(p.y));
        pen = true; lastPt = p;
      }
      ctx.stroke();
      for (const p of firm) { if (p.y == null || p.x > xr) continue; ctx.fillStyle = col.firm; ctx.beginPath(); ctx.arc(sx(p.x), sy(p.y), compact ? 3.5 : 4.5, 0, Math.PI * 2); ctx.fill(); }
      return med;
    };
    let med;
    if (current == null) med = drawTo(xReveal);
    else {   // the whole path at reduced opacity, then the past at full opacity, then the dots of the current year
      ctx.save(); ctx.globalAlpha *= futureAlpha; drawTo(xDomain[1]); ctx.restore();
      med = drawTo(Math.min(current, xDomain[1]));
      const at = (pts, key) => { const s = pts.filter(p => p[key] != null).sort((a, b) => a.x - b.x); for (let i = 0; i < s.length - 1; i++) { if (current >= s[i].x && current <= s[i + 1].x && s[i + 1].x - s[i].x <= 1.001) { const u = (current - s[i].x) / (s[i + 1].x - s[i].x); return s[i][key] * Math.pow(s[i + 1][key] / s[i][key], u); } } const e = s.find(p => Math.abs(p.x - current) < 1e-9); return e ? e[key] : null; };
      const yf = at(firm, 'y'), ym = at(band, 'med');
      if (ym != null) { ctx.fillStyle = col.median; ctx.beginPath(); ctx.arc(sx(current), sy(ym), 6, 0, Math.PI * 2); ctx.fill(); }
      if (yf != null) { ctx.beginPath(); ctx.arc(sx(current), sy(yf), 6.5, 0, Math.PI * 2); if (ringCurrent) { ctx.fillStyle = theme.stage; ctx.fill(); ctx.strokeStyle = col.firm; ctx.lineWidth = 2; ctx.stroke(); } else { ctx.fillStyle = col.firm; ctx.fill(); ctx.strokeStyle = theme.stage; ctx.lineWidth = 1.5; ctx.stroke(); } }   // ringCurrent: the current point as a ring, the circle marker of a line drawn in the ink (round 13)
    }
    // The marker's label sits at the foot of its dotted line, the gap label at the top of the plot, so
    // neither meets the band or the other.
    if (marker && marker.x <= Math.max(xReveal, current == null ? -Infinity : xDomain[1])) {
      const x = sx(marker.x), a = current == null ? Motion.clamp((xReveal - marker.x) / 1.2, 0, 1) : 1;
      ctx.save(); ctx.globalAlpha *= a; ctx.setLineDash([3, 7]); ctx.strokeStyle = col.marker; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, box.y); ctx.lineTo(x, box.y + box.h); ctx.stroke(); ctx.restore();
      if (marker.label && labelAlpha > 0) T(ctx, marker.label, x + 8, box.y + box.h - 10, { size, color: theme.muted, alpha: a * textAlpha * labelAlpha });
    }
    if (gapLabel && labelAlpha > 0 && gapLabel.x <= xReveal) { const a = Motion.clamp((xReveal - gapLabel.x) / 1.2, 0, 1); T(ctx, gapLabel.text, sx(gapLabel.x), box.y + 20, { size, color: theme.muted, align: 'center', alpha: a * textAlpha * labelAlpha }); }
    // End labels at the last revealed points, one above and one below if they would collide.
    const la = tail(progress, 0.9) * textAlpha * labelAlpha;
    if (la > 0) {
      const lastFirm = firm.filter(p => p.y != null && p.x <= xReveal).pop(), lastMed = med[med.length - 1];
      let yF = lastFirm ? sy(lastFirm.y) : null, yM = lastMed ? sy(lastMed[1]) : null;
      if (yF != null && yM != null && Math.abs(yF - yM) < 30) { const mid = (yF + yM) / 2; yF = mid + (yF <= yM ? -16 : 16); yM = mid + (yF <= yM ? 16 : -16); }
      if (lastFirm && labels.firm) T(ctx, labels.firm, sx(lastFirm.x) + 12, yF, { size, color: col.firm, baseline: 'middle', weight: 500, alpha: la });
      if (lastMed && labels.median) T(ctx, labels.median, sx(lastMed[0]) + 12, yM, { size, color: col.median, baseline: 'middle', weight: 500, alpha: la });
    }
    return { sx, sy };
  };

  // Simple horizontal bars with labels. rows: [{label, value, color, text}].
  C.bars = function (ctx, box, rows, { max, progress = 1, theme, barH = 44, gap = 26, size = 26, fmt = v => Motion.fmt.int(v) } = {}) {
    rows.forEach((r, i) => {
      const y = box.y + i * (barH + gap); const w = box.w * (r.value / max) * progress;
      T(ctx, r.label, box.x, y - 10, { size, color: theme.muted, alpha: head(progress) });
      ctx.fillStyle = r.color; ctx.fillRect(box.x, y, w, barH);
      if (progress >= 0.85) T(ctx, r.text || fmt(r.value), box.x + box.w * (r.value / max) + 14, y + barH / 2 + 1, { size, color: theme.ink, baseline: 'middle', weight: 500, alpha: tail(progress) });
    });
  };

  window.MotionCharts = C;
})();
