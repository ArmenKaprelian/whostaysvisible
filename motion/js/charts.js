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
  C.lines = function (ctx, box, series, { xDomain, yDomain, progress = 1, theme, eras = [], events = [], yTicks = [], yFmt = v => v + '%', labelFmt = v => Motion.fmt.pct(v, 1), xTicks = [], xFmt = v => String(v), endLabels = true, labelSize = 24, lineWidth = 3.5, dots = true } = {}) {
    const sx = C.scale(xDomain, [box.x, box.x + box.w]), sy = C.scale(yDomain, [box.y + box.h, box.y]);
    const xReveal = xDomain[0] + (xDomain[1] - xDomain[0]) * progress;
    // Era bands and event ticks.
    for (const e of eras) { ctx.fillStyle = e.color; ctx.fillRect(sx(Math.max(e.from, xDomain[0])), box.y, sx(Math.min(e.to, xDomain[1])) - sx(Math.max(e.from, xDomain[0])), box.h); if (e.label) T(ctx, e.label, (sx(e.from) + sx(e.to)) / 2, box.y + 30, { size: labelSize, color: theme.muted, align: 'center' }); }
    C.axisLeft(ctx, box, sy, yTicks, theme, { fmt: yFmt });
    C.axisBottom(ctx, box, sx, xTicks, theme, { fmt: xFmt });
    for (const ev of events) {
      if (ev.x > xReveal) continue;
      const evAlpha = Motion.clamp((xReveal - ev.x) / 0.6, 0, 1);   // over 0.6 years of the reveal
      const x = sx(ev.x); ctx.save(); ctx.globalAlpha *= evAlpha; ctx.setLineDash([3, 7]); ctx.strokeStyle = theme.tick; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, box.y); ctx.lineTo(x, box.y + box.h); ctx.stroke(); ctx.restore();
      if (ev.label) T(ctx, ev.label, x + 8, ev.labelY != null ? ev.labelY : box.y + box.h - 14 - (ev.row || 0) * 28, { size: labelSize - 2, color: theme.muted, alpha: evAlpha });
    }
    // Lines, revealed left to right with linear interpolation of the last visible segment (presentation only).
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
      if (endLabels && last && progress >= 0.9) T(ctx, s.label.replace('{y}', labelFmt(last.y)), sx(last.x) + 14, sy(last.y), { size: labelSize, color: s.color, baseline: 'middle', weight: 600, alpha: tail(progress, 0.9) });
    }
    return { sx, sy };
  };

  // Slope chart between two columns. items: [{label, a, b, color}]. progress draws the lines from a to b.
  C.slopes = function (ctx, box, items, { yDomain, progress = 1, theme, leftLabel = '2021', rightLabel = '2024', fmt = v => v.toFixed(1) + '%', size = 26, leftMargin = 330, rightMargin = 130 } = {}) {
    const sy = C.scale(yDomain, [box.y + box.h, box.y]);
    const x0 = box.x + leftMargin, x1 = box.x + box.w - rightMargin;
    ctx.strokeStyle = theme.grid; ctx.lineWidth = 1; [x0, x1].forEach(x => { ctx.beginPath(); ctx.moveTo(x, box.y); ctx.lineTo(x, box.y + box.h); ctx.stroke(); });
    T(ctx, leftLabel, x0, box.y - 18, { size, color: theme.muted, align: 'center' }); T(ctx, rightLabel, x1, box.y - 18, { size, color: theme.muted, align: 'center' });
    for (const it of items) {
      const ya = sy(it.a), yb = sy(it.b); const u = progress;
      ctx.strokeStyle = it.color; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x0, ya); ctx.lineTo(x0 + (x1 - x0) * u, ya + (yb - ya) * u); ctx.stroke();
      ctx.fillStyle = it.color; ctx.beginPath(); ctx.arc(x0, ya, 6, 0, Math.PI * 2); ctx.fill();
      T(ctx, fmt(it.a), x0 - 16, ya, { size, color: theme.ink, align: 'right', baseline: 'middle' });
      T(ctx, it.label, x0 - 16 - Motion.measure(ctx, fmt(it.a), size) - 14, ya, { size, color: theme.muted, align: 'right', baseline: 'middle' });
      if (u >= 1) { ctx.beginPath(); ctx.arc(x1, yb, 6, 0, Math.PI * 2); ctx.fill(); }
      if (u >= 0.85) T(ctx, fmt(it.b), x1 + 16, yb, { size, color: it.color, align: 'left', baseline: 'middle', weight: 600, alpha: tail(u) });
    }
  };

  // 100% stacked horizontal bars. groups: [{label, sub, total, parts: [{label, value, color}]}].
  C.stackedBars = function (ctx, box, groups, { progress = 1, theme, size = 26, barH = 64, gap = 60, minLabelFrac = 0.06, legend = true } = {}) {
    if (legend && groups.length) {   // one legend row above the bars; segment labels under bars collide when segments are narrow
      let lx = box.x; const y0 = box.y - 70;
      for (const p of groups[0].parts) { ctx.fillStyle = p.color; ctx.fillRect(lx, y0 - 14, 22, 22); T(ctx, p.label, lx + 32, y0, { size: size - 2, color: theme.muted, baseline: 'middle' }); lx += 32 + Motion.measure(ctx, p.label, size - 2) + 44; }
    }
    groups.forEach((g, gi) => {
      const y = box.y + gi * (barH + gap + 40);
      T(ctx, g.label, box.x, y - 16, { size: size + 2, color: theme.ink, weight: 600 });
      if (g.sub) T(ctx, g.sub, box.x + Motion.measure(ctx, g.label, size + 2, 600) + 18, y - 16, { size, color: theme.muted });
      let x = box.x; const w = box.w * progress;
      for (const p of g.parts) {
        const pw = w * p.value / g.total; ctx.fillStyle = p.color; ctx.fillRect(x + 1.5, y, Math.max(0, pw - 3), barH);
        if (progress >= 0.85) {
          const label = Motion.fmt.pct(100 * p.value / g.total), la = tail(progress);
          if (p.value / g.total >= minLabelFrac) T(ctx, label, x + pw / 2, y + barH / 2 + 1, { size, color: p.textColor || theme.stage, align: 'center', baseline: 'middle', weight: 600, alpha: la });
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

  // Year-by-year dots joined by lines for several series on a log y axis. series: [{label, color, points: [{x, y, low, high}], whiskers}].
  C.yearDots = function (ctx, box, series, { xDomain, yDomain = [1, 5], progress = 1, theme, yTicks = [1, 1.5, 2, 3, 4, 5], size = 24, highlightX = null } = {}) {
    const sx = C.scale(xDomain, [box.x + 40, box.x + box.w - 40]), sy = C.logScale(yDomain, [box.y + box.h, box.y]);
    for (const t of yTicks) { const y = sy(t); ctx.strokeStyle = t === 1 ? theme.ink : theme.grid; ctx.lineWidth = t === 1 ? 1.5 : 1; ctx.beginPath(); ctx.moveTo(box.x, y); ctx.lineTo(box.x + box.w, y); ctx.stroke(); T(ctx, String(t), box.x - 14, y, { size: size - 2, color: theme.muted, align: 'right', baseline: 'middle' }); }
    const years = []; for (let x = xDomain[0]; x <= xDomain[1]; x++) years.push(x);
    years.forEach(x => T(ctx, String(x), sx(x), box.y + box.h + 32, { size, color: highlightX === x ? theme.ink : theme.muted, align: 'center', weight: highlightX === x ? 600 : 400 }));
    if (highlightX != null) { ctx.fillStyle = theme.highlightBand; ctx.fillRect(sx(highlightX) - 46, box.y, 92, box.h); }
    const xReveal = xDomain[0] + (xDomain[1] - xDomain[0]) * progress;
    for (const s of series) {
      const pts = s.points.filter(p => p.x <= xReveal + 1e-9);
      ctx.strokeStyle = s.color; ctx.lineWidth = s.width || 3; ctx.lineJoin = 'round'; ctx.beginPath(); pts.forEach((p, i) => { if (i === 0) ctx.moveTo(sx(p.x), sy(p.y)); else ctx.lineTo(sx(p.x), sy(p.y)); }); ctx.stroke();
      for (const p of pts) {
        if (s.whiskers && p.low != null) { ctx.strokeStyle = s.color; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(sx(p.x), sy(p.low)); ctx.lineTo(sx(p.x), sy(p.high)); ctx.stroke(); }
        ctx.fillStyle = s.color; ctx.beginPath(); ctx.arc(sx(p.x), sy(p.y), s.dot || 7, 0, Math.PI * 2); ctx.fill();
      }
      if (pts.length && progress >= 0.9) T(ctx, s.label, sx(pts[pts.length - 1].x) + 22, sy(pts[pts.length - 1].y), { size, color: s.color, baseline: 'middle', weight: 600, alpha: tail(progress, 0.9) });
    }
    return { sx, sy };
  };

  // Six-year history strips: rows of A/N/X letters as coloured cells. rows: [{history, share, firms}].
  C.historyStrips = function (ctx, box, rows, { progress = 1, theme, colors, years = ['2019', '2020', '2021', '2022', '2023', '2024'], cell = 44, gap = 6, size = 22 } = {}) {
    years.forEach((y, j) => T(ctx, y, box.x + j * (cell + gap) + cell / 2, box.y - 12, { size: size - 2, color: theme.muted, align: 'center' }));
    rows.forEach((r, i) => {
      const u = Motion.clamp(progress * rows.length - i, 0, 1); if (u <= 0) return;
      const y = box.y + i * (cell + gap); ctx.save(); ctx.globalAlpha *= u;
      for (let j = 0; j < r.history.length; j++) { const ch = r.history[j]; const col = colors[ch] || theme.grid; ctx.fillStyle = col; ctx.fillRect(box.x + j * (cell + gap), y, cell, cell); T(ctx, ch, box.x + j * (cell + gap) + cell / 2, y + cell / 2 + 1, { size: size - 2, color: ch === 'A' ? theme.stage : theme.ink, align: 'center', baseline: 'middle', weight: 600 }); }
      const xx = box.x + r.history.length * (cell + gap) + 14;
      const barW = Math.max(0, (box.w - (xx - box.x) - 150) * (r.share / 100) * 2.5);
      ctx.fillStyle = theme.barMuted; ctx.fillRect(xx, y + 8, barW, cell - 16);
      T(ctx, Motion.fmt.pct(r.share) + '  ' + Motion.fmt.int(r.firms), xx + barW + 12, y + cell / 2 + 1, { size, color: theme.ink, baseline: 'middle' });
      ctx.restore();
    });
  };

  // Simple horizontal bars with labels. rows: [{label, value, color, text}].
  C.bars = function (ctx, box, rows, { max, progress = 1, theme, barH = 44, gap = 26, size = 26, fmt = v => Motion.fmt.int(v) } = {}) {
    rows.forEach((r, i) => {
      const y = box.y + i * (barH + gap); const w = box.w * (r.value / max) * progress;
      T(ctx, r.label, box.x, y - 10, { size, color: theme.muted, alpha: head(progress) });
      ctx.fillStyle = r.color; ctx.fillRect(box.x, y, w, barH);
      if (progress >= 0.85) T(ctx, r.text || fmt(r.value), box.x + box.w * (r.value / max) + 14, y + barH / 2 + 1, { size, color: theme.ink, baseline: 'middle', weight: 600, alpha: tail(progress) });
    });
  };

  window.MotionCharts = C;
})();
