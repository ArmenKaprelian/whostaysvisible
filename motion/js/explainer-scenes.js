// Scenes of the explainer "Who stays visible?". Each scene is a pure function of its local time.
// Every number drawn comes from MOTION_DATA (series.facts and the cell layers); nothing is typed in.
// Round 3 (23 October 2026): one continuous camera journey. A cut is a list of beats; a ground
// scene draws the land and the national density under every beat from two schedules, the chart
// beats keep the dimmed map under a slow drift, and the Moscow section (treated-scenes.js) follows
// the flight to Moscow. Round 5 (23 October 2026): one cut family, every cut carrying the section;
// the cells-only cuts and their beats are gone (the firm-level data are published).
(function () {
  'use strict';
  const D = window.MOTION_DATA;
  const S = D.series, C100 = D.cells100, DEN = D.density, BM = D.basemap, CY = D.cellsyears || null;
  const F = S.facts, fmt = Motion.fmt, step = Motion.step, E = Motion.ease;
  const MM = MotionMap, CH = MotionCharts;

  // ---- beats -----------------------------------------------------------------------------------
  // Scenes, the ground schedules and the camera keyframes are built from the beat starts.
  const TITLES = { hook: 'Who stays visible?', archive: 'The archive', availability: 'Availability over time', years: 'The map through time', change: 'The change map',
                   zoom: 'To Moscow', groups: 'Availability by group', transitions: 'Absence and removal',
                   size: 'Firm size', lists: 'The lists', next: 'What comes next', credits: 'Sources' };
  const HEAD = [['hook', 11], ['archive', 14], ['availability', 16], ['years', 24], ['change', 12], ['zoom', 11]];
  const TAIL = [['groups', 16], ['transitions', 12], ['size', 16], ['lists', 16], ['next', 12], ['credits', 7]];
  const BEATS = HEAD.concat([['section', 120]], TAIL);   // round 4: the national year run adds 12 s
  function beatsOf(list) { const B = {}; let t = 0; for (const [id, d] of list) { B[id] = { id, start: t, end: t + d, dur: d }; t += d; } return { B, total: t }; }

  // ---- palette (charcoal ground: lightness rises with the value) ---------------------------------
  // Ordered quantities use ColorBrewer YlGnBu (teal to pale yellow), signed change uses PRGn
  // (purple declines, green rises). Red is reserved for listed firms.
  const RAMP6 = ['#1C8383', '#269C96', '#50B5AA', '#79CDBF', '#A1E4D3', '#C7F8E7'];   // availability share, 6 fixed classes: the single-hue cyan ramp (round 10, 26 October 2026; OKLCH L 0.556 to 0.940 in even steps, hue 195 to 172; YlGnBu before it)
  const RAMP5 = RAMP6.slice(1);                                                        // 5 classes (fine cells, cohort inclusion)
  const CHANGE6 = ['#FFB000', '#F39523', '#EA7719', '#50B5AA', '#79CDBF', '#A1E4D3']; // <= -5, -5..-2, -2..0, 0..2, 2..5, > 5 points: amber to orange for declines, the cyan ramp's steps 3 to 5 for rises (round 10; PRGn before it)
  const YEAR_BREAKS = [20, 35, 50, 60, 70];
  const FINE_BREAKS = [55, 62, 68, 74];
  const FIN_BREAKS = [-20, -10, 0, 10, 20];

  // ---- data preparation (once) ---------------------------------------------------------------
  const bmp = MM.buildBasemap(BM);
  const city = Object.fromEntries(bmp.cities.map(c => [c.label, c]));
  const nat = MM.decodeDensity(DEN.national); const natPaths = MM.buildDensityPaths(nat, FINE_BREAKS);
  const dens = { one: MM.buildDensityPaths(MM.decodeDensity(DEN.windows_1km.Moscow), FINE_BREAKS), fine: MM.buildDensityPaths(MM.decodeDensity(DEN.windows_250m.Moscow), FINE_BREAKS) };
  const yearSource = CY ? CY.avail : C100.avail;
  const yearList = CY ? (CY.mapped_years || CY.years) : Array.from(new Set(C100.avail.year)).sort();   // 2012-2013 carry no coordinates
  const yearTotals = {};
  if (CY) { const t = CY.totals; for (let i = 0; i < t.year.length; i++) yearTotals[t.year[i]] = { share: t.eligible_share[i], located: t.located_share[i], n: t.n[i] }; }
  else { const a = S.avail; for (let i = 0; i < a.year.length; i++) yearTotals[a.year[i]] = { share: a.eligible_share[i], located: null, n: a.eligible[i] }; }
  const providerOf = y => (y <= 2018 ? 'Rosstat' : 'FNS');
  const yearPaths = new Map();
  function yearTiles(y) {
    if (yearPaths.has(y)) return yearPaths.get(y);
    const idx = []; for (let i = 0; i < yearSource.year.length; i++) if (yearSource.year[i] === y) idx.push(i);
    const ix = idx.map(i => yearSource.ix[i]), iy = idx.map(i => yearSource.iy[i]);
    let supported = 0;
    const paths = MM.buildTiles(idx.length, ix, iy, j => { const i = idx[j]; const n = yearSource.n[i]; if (n < 50) return 'below'; supported++; const s = 100 * yearSource.a[i] / n; let c = 0; while (c < YEAR_BREAKS.length && s >= YEAR_BREAKS[c]) c++; return c; }, { gapKm: 15 });
    const out = { paths, supported, cells: idx.length }; yearPaths.set(y, out); return out;
  }
  const chg = C100.change;
  const changeTiles = MM.buildTiles(chg.ix.length, chg.ix, chg.iy, i => (chg.supported[i] ? chg.class[i] : 'below'), { gapKm: 15 });
  const changeCounts = {}; C100.change_classes.class.forEach((c, i) => changeCounts[c] = C100.change_classes.cells[i]);
  const coh = C100.cohort; const cohIdx = []; for (let i = 0; i < coh.ix.length; i++) if (coh.outcome[i] === 'revenue' && coh.moderator[i] === 'cash') cohIdx.push(i);
  const cohortTiles = MM.buildTiles(cohIdx.length, cohIdx.map(i => coh.ix[i]), cohIdx.map(i => coh.iy[i]), j => (coh.supported[cohIdx[j]] ? coh.class[cohIdx[j]] : 'below'), { gapKm: 15 });
  const cohortFirms = cohIdx.reduce((s, i) => s + coh.c[i], 0);
  const fin = C100.fin; const finIdx = []; for (let i = 0; i < fin.ix.length; i++) if (fin.outcome[i] === 'revenue' && fin.moderator[i] === 'cash' && fin.year[i] === 2024) finIdx.push(i);
  const finTiles = MM.buildTiles(finIdx.length, finIdx.map(i => fin.ix[i]), finIdx.map(i => fin.iy[i]), j => { const v = fin.change_pct[finIdx[j]]; let c = 0; while (c < FIN_BREAKS.length && v >= FIN_BREAKS[c]) c++; return c; }, { gapKm: 15 });
  const finCounts = {}; finIdx.forEach(i => { const v = fin.change_pct[i]; let c = 0; while (c < FIN_BREAKS.length && v >= FIN_BREAKS[c]) c++; finCounts[c] = (finCounts[c] || 0) + 1; });

  const series = (() => { const a = S.avail; const el = [], reg = []; for (let i = 0; i < a.year.length; i++) { if (a.eligible_share[i] == null) continue; el.push({ x: a.year[i], y: a.eligible_share[i] }); reg.push({ x: a.year[i], y: a.registered_share[i] }); } return { el, reg }; })();
  const sizeRows = (() => { const z = S.size; const out = {}; for (let i = 0; i < z.year.length; i++) { if (z.era[i] !== 'recent') continue; (out[z.quintile[i]] = out[z.quintile[i]] || []).push({ x: z.year[i], y: z.or[i], low: z.low[i], high: z.high[i] }); } return out; })();
  const earlyQ5 = (() => { const z = S.size; const v = []; for (let i = 0; i < z.year.length; i++) if (z.era[i] === 'early' && z.quintile[i] === 'Q5') v.push(z.or[i]); return [Math.min(...v), Math.max(...v)]; })();
  const listRows = (model, contrast) => { const z = S.lists; const out = []; for (let i = 0; i < z.year.length; i++) if (z.model[i] === model && z.contrast[i] === contrast && z.comparison[i] === 'level' && z.year[i] != null) out.push({ x: z.year[i], y: z.or[i], low: z.low[i], high: z.high[i] }); return out.sort((a, b) => a.x - b.x); };
  const bin = (group, name) => { const b = S.history_bins; for (let i = 0; i < b.group.length; i++) if (b.group[i] === group && b.bin[i] === name) return { share: b.share[i], firms: b.firms[i], denominator: b.denominator[i] }; return null; };
  const pooled = (() => { const p = S.transitions_pooled; const o = {}; for (let i = 0; i < p.prior.length; i++) o[p.prior[i]] = { origin: p.origin[i], A: p.A[i], N: p.N[i], X: p.X[i] }; return o; })();
  const cohortCounts = S.flow;
  const flowValue = id => cohortCounts.value[cohortCounts.id.indexOf(id)];
  const msk1 = DEN.windows_1km.Moscow;

  // ---- camera --------------------------------------------------------------------------------
  const NAT = { cx: (BM.extents.national.x[0] + BM.extents.national.x[1]) / 2, cy: (BM.extents.national.y[0] + BM.extents.national.y[1]) / 2 };
  const K_FULL = 1080 / (BM.extents.national.y[1] - BM.extents.national.y[0]);
  const LEFT = { ox: 700, oy: 560, k: 0.168 };
  const msk = city.Moscow, spb = city['St Petersburg'];
  const natK = (f, ox = 960) => ({ cx: NAT.cx, cy: NAT.cy, k: K_FULL * f, ox, oy: 540 });
  const leftK = () => ({ cx: NAT.cx, cy: NAT.cy, k: LEFT.k, ox: LEFT.ox, oy: LEFT.oy });
  const cityK = (c, k, dx = 0, dy = 0) => ({ cx: c.cx + dx, cy: c.cy + dy, k, ox: 960, oy: 540 });
  // One path per cut: the national framing with a slow push-in, a pull-out under the availability
  // chart, the left framing for the 100 km maps, one eased flight to Moscow, the Moscow leg or the
  // section, the national framing with a slow drift under the charts, the left framing to close.
  function keyframesFor(B, section) {
    const kf = []; const at = (t, c) => kf.push(Object.assign({ t }, c));
    const mos = { cx: section.rest.cx, cy: section.rest.cy };
    at(0, natK(0.96)); at(B.archive.start, natK(0.98)); at(B.availability.start, natK(1.0)); at(B.years.start - 2, natK(0.85)); at(B.years.start, leftK());
    at(B.zoom.start, leftK()); at(B.zoom.start + 6, cityK(mos, 12)); at(B.zoom.end, cityK(mos, 12));
    section.keyframes.forEach(k => kf.push(k));
    at(B.groups.start, natK(0.98)); at(B.next.start - 2, natK(0.90, 900)); at(B.next.start + 0.5, leftK()); at(B.credits.end, leftK());
    return kf;
  }

  // ---- ground: the land and the national density under every beat --------------------------------
  function schedulesFor(B, section) {
    const land = [{ start: 0, value: 1 }, { start: B.archive.start, value: 0.3 }, { start: B.availability.start, value: 0.12 }, { start: B.years.start, value: 1 }];
    const dens = [{ start: 0, value: 1 }, { start: B.archive.start, value: 0.22 }, { start: B.availability.start, value: 0.12 }, { start: B.years.start, value: 0 }, { start: B.zoom.start, value: 1 }];
    if (section) { const s = B.section.start, SEC = section.SEC; land.push({ start: s + SEC.profiles, value: 0, blend: 2 }, { start: s + SEC.back + 2.5, value: 1, blend: 3 }); dens.push({ start: s + SEC.national, value: 0 }); }   // the national run draws firm points, not the density
    land.push({ start: B.groups.start, value: 0.15 }, { start: B.next.start, value: 1 }, { start: B.credits.start, value: 0.3 });
    dens.push({ start: B.groups.start, value: 0.12 }, { start: B.next.start, value: 0 }, { start: B.credits.start, value: 0.12 });
    return { land: Motion.schedule(land, 0.6), dens: Motion.schedule(dens, 0.6) };
  }
  function drawGround(ctx, stage, cam, theme, T, sch) {
    MM.drawBasemap(ctx, stage, cam, bmp, theme, { landAlpha: Math.min(sch.land(T), step(T, 0, 1.6)), borderPx: 1 });
    MM.markAGK(ctx, 960, 1040, 72, theme.ink, 0.04);   // the authorship mark (round 10, the author's item 17): the frame's lower edge, under every data layer and panel, 4 percent
    const dA = sch.dens(T) * (1 - step(cam.k, 1.5, 2.5, E.linear));   // the national density leaves as the camera closes in
    if (dA <= 0) return;
    const g0 = ctx.globalAlpha;
    Motion.camTransform(ctx, stage, cam); ctx.save(); ctx.fillStyle = theme.accent;
    for (const [c, p] of natPaths.byCount) { const a = dA * MM.countAlpha[c] * (T < 6 ? step(T, 1.2 + c * 0.28, 1.4, E.outCubic) : 1); if (a <= 0) continue; ctx.globalAlpha = g0 * a; ctx.fill(p); }
    ctx.restore(); stage.base();
  }
  const groundScene = (sch, duration, timeMap) => ({ id: 'ground', title: 'Ground', start: 0, end: duration, z: 0, fadeIn: 0, fadeOut: 0, draw({ ctx, t, cam, stage, theme }) { drawGround(ctx, stage, cam, theme, timeMap ? timeMap(t) : t, sch); } });

  // ---- helpers ---------------------------------------------------------------------------------
  const title = (ctx, s, t, t0, theme, y = 118, size = 54) => Motion.reveal(ctx, s.toUpperCase(), 80, y, t, t0, { size, weight: 700, color: theme.ink, stripe: { gap: 2 } });   // striped display type (round 10)   // scene titles in capitals (round 10)
  const subtitle = (ctx, s, t, t0, theme, y = 164) => Motion.revealParagraph(ctx, s, 80, y, 1760, t, t0, { size: 28, color: theme.muted, lineHeight: 1.35 });   // wrapped inside 1,760 px (round 10)
  const eyebrow = (ctx, s, x, y, theme, alpha = 1) => Motion.text(ctx, s.toUpperCase(), x, y, { size: 22, weight: 500, color: theme.muted, alpha, letterSpacing: 22 * 0.08 });
  // The location line of a map beat without a panel: the name and the window under it.
  const locationLine = (ctx, theme, name, sub, x, y, alpha) => { if (alpha <= 0) return; Motion.text(ctx, name.toUpperCase(), x, y, { size: 24, weight: 500, color: theme.muted, letterSpacing: 24 * 0.08, alpha, group: 'location' }); Motion.text(ctx, sub, x, y + 30, { size: 22, color: theme.dim, letterSpacing: 1, alpha, group: 'location-size' }); };
  function drawYearTiles(ctx, stage, cam, y, theme, alpha) {
    const yt = yearTiles(y);
    MM.drawTiles(ctx, stage, cam, yt.paths, c => (c === 'below' ? theme.below : RAMP6[c]), { alpha, alphaOf: c => (c === 'below' ? 0.45 : 1) });
    return yt;
  }
  // The Moscow density windows by scale: 1 km cells between k 1.5 and 40, 250 m cells above k 24,
  // leaving above k 60 where the firm field of the Moscow section takes over.
  const gridAlphas = k => ({ one: Math.min(step(k, 1.5, 2.5, E.linear), 1 - step(k, 24, 16, E.linear)), fine: step(k, 24, 16, E.linear) * (1 - step(k, 60, 20, E.linear)) });
  const shareLegend = (ctx, x, y, w, theme, alpha, title) => MM.legendBar(ctx, x, y, w, RAMP5, FINE_BREAKS.map(b => b + '%'), theme, { alpha, title, left: '', right: '' });

  // ---- scenes (beat-local time l) --------------------------------------------------------------
  const DEFS = {};
  DEFS.hook = { z: 1, fadeIn: 0, draw({ ctx, local: l, theme }) {
    Motion.reveal(ctx, 'WHO STAYS VISIBLE?', 80, 128, l, 0.9, { size: 78, weight: 700, color: theme.ink, stripe: { gap: 2 } });
    Motion.reveal(ctx, 'Financial statements of Russian firms under sanctions, 2012–2025', 80, 184, l, 1.8, { size: 30, color: theme.muted });
    if (l > 5.2) {
      const v = Motion.counter(l, 5.2, 3.2, F.located_2021);
      Motion.text(ctx, fmt.int(v), 80, 990, { size: 84, weight: 700, color: theme.ink, alpha: step(l, 5.2, 0.6) });
      Motion.reveal(ctx, 'firms eligible to file 2021 accounts, each drawn at its registered address', 80, 1034, l, 5.8, { size: 26, color: theme.muted });
    }
  } };

  DEFS.archive = { z: 1, draw({ ctx, local: l, dur, theme }) {
    const out = 1 - step(l, dur - 1.0, 0.5, E.inOutSine);   // the text leaves before the scene crossfades into the chart
    eyebrow(ctx, 'The archive', 80, 120, theme, step(l, 0.2, 0.5) * out);
    const v = Motion.counter(l, 0.4, 3.0, F.records_total);
    Motion.text(ctx, fmt.int(v), 80, 262, { size: 124, weight: 700, color: theme.ink, alpha: step(l, 0.4, 0.5) * out });
    Motion.reveal(ctx, `annual records of Russian firms, financial years ${F.years}, ${F.release} (released ${F.release_date})`, 80, 316, l, 1.4, { size: 30, color: theme.muted, until: dur - 0.5 });
    // Provider bar.
    const u = step(l, 4.2, 2.6, E.inOutSine);
    if (u > 0 && out > 0) {
      const x0 = 80, x1 = 1480, y = 430, years = []; for (let y0 = 2011; y0 <= 2025; y0++) years.push(y0);
      const sx = CH.scale([2011, 2026], [x0, x1]);
      eyebrow(ctx, 'Two providers, one archive', 80, 392, theme, u * out);
      ctx.save(); ctx.globalAlpha *= u * out;
      const segs = [{ from: 2011, to: 2012, color: theme.below, label: null }, { from: 2012, to: 2019, color: theme.dim, label: 'Rosstat, 2012–2018' }, { from: 2019, to: 2026, color: theme.accent, label: 'Federal Tax Service (FNS), 2019–2025' }];
      for (const s of segs) { const xa = sx(s.from), xb = sx(Math.min(s.to, 2011 + 15 * u)); if (xb <= xa) continue; ctx.fillStyle = s.color; ctx.fillRect(xa + 1, y, xb - xa - 2, 36); }
      const reach = 2011 + 15 * u;   // the bar's right edge in years; each year label fades in over the next two years of growth
      years.forEach(yy => Motion.text(ctx, yy === 2025 ? '2025*' : String(yy), sx(yy + 0.5), y + 68, { size: 22, color: theme.muted, align: 'center', alpha: Motion.clamp((reach - yy) / 2, 0, 1) }));
      const labAlpha = Motion.clamp((u - 0.85) / 0.15, 0, 1);
      if (labAlpha > 0) {
        segs.forEach(s => { if (s.label) Motion.text(ctx, s.label, sx(s.from) + 8, y - 12, { size: 24, color: s.color, weight: 500, alpha: labAlpha }); });
        Motion.text(ctx, '2011: imputed records only, no availability rate', sx(2011), y + 100, { size: 22, color: theme.muted, alpha: labAlpha });
        Motion.text(ctx, '2025*: a flagged latest-year extension', sx(2026), y + 100, { size: 22, color: theme.muted, align: 'right', alpha: labAlpha });
      }
      ctx.restore();
    }
    // 2021 nested bars.
    const u2 = step(l, 8.2, 2.2, E.outCubic);
    if (u2 > 0 && out > 0) {
      eyebrow(ctx, 'Financial year 2021', 80, 606, theme, u2 * out);
      const rows = [{ label: 'Eligible to file', value: F.eligible_2021, color: theme.dim }, { label: 'Registered at year-end', value: F.registered_2021, color: theme.muted }, { label: 'With a statement in the release', value: F.statements_2021, color: theme.accent }];
      ctx.save(); ctx.globalAlpha *= out;
      CH.bars(ctx, { x: 80, y: 650, w: 1000, h: 300 }, rows, { max: F.eligible_2021, progress: u2, theme, barH: 46, gap: 44, size: 26, fmt: v => fmt.int(v) + ' firms' });
      ctx.restore();
    }
    Motion.paragraph(ctx, 'A statement is available when the firm’s own filing for the year is in the release: filed, not imputed.', 80, 1000, 1500, { size: 28, color: theme.ink, alpha: step(l, 11.2, 0.6) * out });
  } };

  DEFS.availability = { z: 1, draw({ ctx, local: l, theme }) {
    title(ctx, 'Availability rose while the archive shrank', l, 0.2, theme);
    subtitle(ctx, 'Share of firms with a statement, by financial year and denominator', l, 0.6, theme);
    const box = { x: 170, y: 250, w: 1000, h: 620 };
    const progress = step(l, 1.2, 8.0, E.inOutSine);
    CH.lines(ctx, box, [
      { label: 'registered {y}', color: theme.accentStrong, points: series.reg, gapAfter: [2018] },
      { label: 'eligible {y}', color: theme.accent, points: series.el, gapAfter: [2018] },
    ], { xDomain: [2011.4, 2025.6], yDomain: [0, 80], progress, theme, yTicks: [0, 20, 40, 60, 80], xTicks: [2012, 2014, 2016, 2018, 2020, 2022, 2024, 2025], xFmt: v => (v === 2025 ? '2025*' : String(v)),
         eras: [{ from: 2018.5, to: 2025.6, color: theme.highlightBand, label: 'FNS era' }, { from: 2011.4, to: 2018.5, color: 'rgba(0,0,0,0)', label: 'Rosstat era' }],
         events: [{ x: 2014, label: 'Crimea sanctions', row: 0 }, { x: 2020.05, label: 'Decree 35, Jan 2020', row: 1 }, { x: 2022.1, label: 'Invasion, Feb 2022', row: 0 }, { x: 2022.3, label: 'Access notice, Apr 2022', row: 2 }] });
    const px = 1440;
    if (l > 10) {
      Motion.reveal(ctx, 'Share up, statements down', px, 300, l, 10, { size: 32, weight: 700, color: theme.ink });
      Motion.reveal(ctx, '2021 to 2024', px, 346, l, 10.3, { size: 26, color: theme.muted });
      const u = step(l, 10.6, 1.6, E.outCubic);
      CH.bars(ctx, { x: px, y: 400, w: 300, h: 200 }, [{ label: 'Statements 2021', value: F.statements_2021, color: theme.dim }, { label: 'Statements 2024', value: F.statements_2024, color: theme.accent }], { max: F.statements_2021, progress: u, theme, barH: 40, gap: 46, size: 24 });
      Motion.paragraph(ctx, `${fmt.int(F.statements_2021 - F.statements_2024)} fewer statements, while the eligible share rose from ${fmt.pct(F.eligible_share_2021)} to ${fmt.pct(F.eligible_share_2024)}.`, px, 620, 400, { size: 26, color: theme.ink, alpha: step(l, 12.4, 0.6) });
    }
  } };

  DEFS.years = { z: 1, draw({ ctx, local: l, cam, stage, theme, dur }) {
    const n = yearList.length, start = 1.6, dwell = (dur - start - 1.2) / n;
    const pos = Motion.clamp((l - start) / dwell, 0, n - 1e-6); const i = Math.floor(pos), frac = pos - i;
    const blend = i < n - 1 ? step(frac, 0.78, 0.22, E.inOutSine) : 0;
    const intro = step(l, 0.3, 1.2);
    const yt = drawYearTiles(ctx, stage, cam, yearList[i], theme, intro * (1 - blend));
    if (blend > 0) drawYearTiles(ctx, stage, cam, yearList[i + 1], theme, blend);
    const yShow = blend > 0.5 ? yearList[i + 1] : yearList[i]; const tot = yearTotals[yShow] || {}; const ytShow = blend > 0.5 ? yearTiles(yShow) : yt;
    const px = 1400;
    eyebrow(ctx, 'Availability by cell', px, 140, theme, step(l, 0.2, 0.5));
    locationLine(ctx, theme, 'Russia', '100 km cells', px, 196, step(l, 0.2, 0.5));
    const yearLabel = y => String(y) + (y === 2025 ? '*' : '');
    Motion.text(ctx, yearLabel(yearList[i]), px, 330, { size: 128, weight: 700, color: theme.ink, alpha: step(l, 0.4, 0.5) * (1 - blend), group: 'year' });
    if (blend > 0) Motion.text(ctx, yearLabel(yearList[i + 1]), px, 330, { size: 128, weight: 700, color: theme.ink, alpha: blend, group: 'year' });
    Motion.text(ctx, yShow === 2019 ? 'FNS, the provider changes' : providerOf(yShow), px, 380, { size: 26, color: yShow === 2019 ? theme.accentStrong : theme.muted, alpha: step(l, 0.4, 0.5) });
    if (tot.share != null) {
      Motion.text(ctx, fmt.pct(tot.share), px, 500, { size: 72, weight: 700, color: theme.accentStrong, alpha: step(l, 0.6, 0.5) });
      Motion.text(ctx, 'of eligible firms have a statement', px, 542, { size: 24, color: theme.muted, alpha: step(l, 0.6, 0.5) });
    }
    if (tot.located != null) Motion.paragraph(ctx, `${fmt.pct(tot.located)} of ${fmt.int(tot.n)} eligible firms located`, px, 600, 500, { size: 24, color: theme.muted, alpha: step(l, 0.8, 0.5), group: 'years-located' });
    Motion.paragraph(ctx, `${fmt.int(ytShow.supported)} cells with 50 or more located firms`, px, 664, 500, { size: 24, color: theme.muted, alpha: step(l, 0.8, 0.5), group: 'years-cells' });
    MM.legendBar(ctx, px, 780, 440, RAMP6, YEAR_BREAKS.map(b => b + '%'), theme, { alpha: step(l, 1.0, 0.6), title: ['Share with a statement,', 'located firms in the cell'] });
    MM.legendSwatches(ctx, px, 860, [{ color: theme.below, alpha: 0.45, label: 'fewer than 50 located firms' }], theme, { alpha: step(l, 1.0, 0.6) });
  } };

  DEFS.change = { z: 1, draw({ ctx, local: l, cam, stage, theme }) {
    const waves = { 3: 0.3, 4: 0.3, 2: 1.4, 5: 1.4, 1: 2.6, 6: 2.6, below: 0.3 };
    MM.drawTiles(ctx, stage, cam, changeTiles, c => (c === 'below' ? theme.below : CHANGE6[c - 1]), { alphaOf: c => (c === 'below' ? 0.45 : 1) * step(l, waves[c], 0.9, E.outCubic) });
    const px = 1400;
    eyebrow(ctx, 'The change map', px, 140, theme, step(l, 0.2, 0.5));
    locationLine(ctx, theme, 'Russia', '100 km cells', px, 196, step(l, 0.2, 0.5));
    Motion.text(ctx, '2024 against 2021', px, 276, { size: 44, weight: 700, color: theme.ink, alpha: step(l, 0.3, 0.5) });
    Motion.paragraph(ctx, 'Change in the share of located firms with a statement, by 100 km cell', px, 326, 440, { size: 26, color: theme.muted, alpha: step(l, 0.5, 0.5) });
    const labels = ['≤ −5 points', '−5 to −2', '−2 to 0', '0 to +2', '+2 to +5', '> +5 points'];
    const items = [6, 5, 4, 3, 2, 1].map(c => ({ color: CHANGE6[c - 1], label: labels[c - 1], right: fmt.int(changeCounts[c]) + ' cells', rightAlpha: step(l, waves[c] + 0.9, 0.4) }));
    MM.legendSwatches(ctx, px, 420, items, theme, { alpha: step(l, 0.8, 0.6), colWidth: 440, rowGap: 14 });
    MM.legendSwatches(ctx, px, 660, [{ color: theme.below, alpha: 0.45, label: 'fewer than 50 firms in a year', right: '' }], theme, { alpha: step(l, 0.8, 0.6), colWidth: 440 });
    const ct = C100.change_totals;
    Motion.paragraph(ctx, `${fmt.int(C100.change.supported.reduce((s, v) => s + v, 0))} cells with 50 or more located firms in both years`, px, 760, 460, { size: 24, color: theme.ink, alpha: step(l, 4.4, 0.5) });
    Motion.reveal(ctx, `Located share ${fmt.pct(ct.availability_share_percent[0])} to ${fmt.pct(ct.availability_share_percent[1])}`, px, 830, l, 4.8, { size: 24, color: theme.ink });
  } };

  // The flight to Moscow under the start of the section's street zoom (23 s): the Moscow hold with the
  // 1 km density window (counts, then shares) and the top-right panel; the density windows leave by scale.
  function zoomScene() {
    const hold = 6;   // the camera reaches Moscow at k 12 six seconds in
    const loc = [{ start: 0, name: 'Moscow', size: '90 by 90 km, 1 km cells' }];
    const panelEnd = hold + 5.6, eyebrowEnd = hold + 9.5, legendEnd = hold + 6.5;
    const linesM = [[`${fmt.int(msk1.sum_n)} located firms`, null], [`${fmt.int(msk1.sum_a)} with a 2021 statement (${fmt.pct(100 * msk1.sum_a / msk1.sum_n)})`, null]];
    return { z: 1, fadeIn: 0.5, fadeOut: 0.5, draw({ ctx, local: l, cam, stage, theme }) {
      const k = cam.k, ga = gridAlphas(k), shareMix = step(l, hold + 1.6, 1.2, E.inOutSine);
      if (ga.one > 0) { MM.drawDensityCounts(ctx, stage, cam, dens.one, theme.accent, ga.one * (1 - shareMix)); if (shareMix > 0) MM.drawDensityShares(ctx, stage, cam, dens.one, RAMP5, theme.below, ga.one * shareMix); }
      if (ga.fine > 0) MM.drawDensityCounts(ctx, stage, cam, dens.fine, theme.accent, ga.fine);
      // City labels inside the scale window, and only once the camera has nearly arrived (they would otherwise fly in
      // from the screen edge faster than any fade).
      const cityAlpha = step(k, 1.5, 3, E.linear) * (1 - step(k, 12.5, 7.5, E.linear)) * Motion.plateau(l, 5.0, 11.2, 0.6, 0.6);
      if (cityAlpha > 0) for (const c of [msk, spb]) MM.cityLabel(ctx, cam, c, theme, { size: 28, alpha: cityAlpha });
      eyebrow(ctx, 'Firm density, 2021', 80, 120, theme, Motion.plateau(l, 0.3, eyebrowEnd, 0.6, 0.5));
      const pa = Motion.plateau(l, hold - 1.4, panelEnd, 0.6, 0.6);
      if (pa > 0) { MM.infoPanel(ctx, theme, { alpha: pa, loc: MM.locationAt(loc, l), year: { a: '2021' }, w: 520 }); MM.infoLines(ctx, theme, linesM, pa); }
      shareLegend(ctx, 1380, 900, 440, theme, Motion.plateau(l, hold + 1.6, legendEnd, 0.6, 0.5), ['Share with a statement,', 'cells with 50 or more firms']);
    } };
  }

  DEFS.groups = { z: 1, draw({ ctx, local: l, theme }) {
    title(ctx, 'Availability diverged after 2021', l, 0.2, theme);
    subtitle(ctx, 'Share of eligible firms with a statement, 2021 and 2024, by group', l, 0.6, theme);
    const u = step(l, 1.2, 3.0, E.inOutSine);
    const own = [{ label: 'Private', a: F.own.private[0], b: F.own.private[1], color: theme.accent }, { label: 'Foreign or joint', a: F.own.foreign[0], b: F.own.foreign[1], color: theme.muted }, { label: 'State-related', a: F.own.state[0], b: F.own.state[1], color: theme.fall }];
    const leg = [{ label: 'Joint-stock', a: F.legal.joint_stock[0], b: F.legal.joint_stock[1], color: theme.accent }, { label: 'Limited liability', a: F.legal.llc[0], b: F.legal.llc[1], color: theme.muted }, { label: 'Unitary enterprise', a: F.legal.unitary[0], b: F.legal.unitary[1], color: theme.fall }];
    eyebrow(ctx, 'Ownership', 160, 250, theme, step(l, 0.8, 0.5)); eyebrow(ctx, 'Legal form', 1040, 250, theme, step(l, 0.8, 0.5));
    ctx.save(); ctx.globalAlpha *= step(l, 0.8, 0.5);
    CH.slopes(ctx, { x: 120, y: 300, w: 760, h: 520 }, own, { yDomain: [44, 82], progress: u, theme });
    CH.slopes(ctx, { x: 1000, y: 300, w: 760, h: 520 }, leg, { yDomain: [44, 82], progress: u, theme });
    ctx.restore();
    Motion.paragraph(ctx, 'Availability rose among private firms and joint-stock companies and fell among state-related firms and unitary enterprises.', 120, 940, 1660, { size: 27, color: theme.ink, alpha: step(l, 6.0, 0.6) });
  } };

  DEFS.transitions = { z: 1, draw({ ctx, local: l, theme }) {
    title(ctx, 'Absence often precedes removal', l, 0.2, theme);
    subtitle(ctx, 'The following year, by the preceding year’s statement: transitions ending 2020–2024, continuing and removed firms', l, 0.6, theme);
    const u = step(l, 1.2, 2.6, E.outCubic);
    const pa = pooled.available, pb = pooled.absent;
    const parts = (p) => [{ label: 'statement next year', value: p.A, color: theme.accent }, { label: 'no statement, still registered', value: p.N, color: theme.fall }, { label: 'removed from the registry', value: p.X, color: theme.dim, textColor: theme.ink }];
    ctx.save(); ctx.globalAlpha *= step(l, 0.8, 0.5);
    CH.stackedBars(ctx, { x: 120, y: 360, w: 1680, h: 500 }, [
      { label: 'Firms with a statement the year before', sub: `${fmt.int(pa.origin)} firm-years`, total: pa.origin, parts: parts(pa) },
      { label: 'Firms without a statement the year before', sub: `${fmt.int(pb.origin)} firm-years`, total: pb.origin, parts: parts(pb) },
    ], { progress: u, theme, barH: 90, gap: 140, size: 26 });
    ctx.restore();
    Motion.paragraph(ctx, `Of ${fmt.int(pb.origin)} firm-years without a statement, ${fmt.pct(100 * pb.X / pb.origin)} end in a recorded removal and ${fmt.pct(100 * pb.A / pb.origin)} reappear with a statement. Among firm-years with a statement, ${fmt.pct(100 * pa.X / pa.origin)} end in removal.`, 120, 920, 1660, { size: 27, color: theme.ink, alpha: step(l, 5.4, 0.6) });
  } };

  DEFS.size = { z: 1, draw({ ctx, local: l, theme }) {
    title(ctx, 'Larger firms stay visible, and the gap widened in 2022', l, 0.2, theme);
    subtitle(ctx, 'Odds of a following-year statement against the smallest asset quintile (Q1), adjusted, outcomes 2020–2024', l, 0.6, theme);
    const u = step(l, 1.2, 4.0, E.inOutSine);
    const cols = { Q2: '#269C96', Q3: '#50B5AA', Q4: '#79CDBF', Q5: theme.accentStrong };   // the cyan ramp's steps 2 to 4 with Q5 in the accent-strong (round 10; three blues before it)
    const ser = ['Q2', 'Q3', 'Q4', 'Q5'].map(q => ({ label: q + ' vs Q1', color: cols[q], points: sizeRows[q], whiskers: q === 'Q5', dot: q === 'Q5' ? 9 : 7, width: q === 'Q5' ? 4 : 3 }));
    ctx.save(); ctx.globalAlpha *= step(l, 0.8, 0.5);
    CH.yearDots(ctx, { x: 170, y: 250, w: 1000, h: 640 }, ser, { xDomain: [2020, 2024], yDomain: [1, 5], progress: u, theme, highlightX: l > 6.4 ? 2022 : null });
    ctx.restore();
    const px = 1400;
    if (l > 6.6) {
      Motion.reveal(ctx, '2022 against 2021, Q5 vs Q1', px, 300, l, 6.6, { size: 30, weight: 700, color: theme.ink });
      Motion.reveal(ctx, 'ratio of odds ratios', px, 340, l, 7.0, { size: 24, color: theme.muted });
      Motion.reveal(ctx, fmt.dec(F.size_q5_2022_ratio, 3), px, 404, l, 7.0, { size: 60, weight: 700, color: theme.accentStrong });
      Motion.reveal(ctx, `95% interval ${fmt.dec(F.size_q5_2022_low, 3)} to ${fmt.dec(F.size_q5_2022_high, 3)}`, px, 440, l, 7.3, { size: 26, color: theme.muted });
      Motion.paragraph(ctx, `Raw shares in 2022: Q1 ${fmt.pct(F.size_raw_q1_2022)}, Q5 ${fmt.pct(F.size_raw_q5_2022)}.`, px, 510, 440, { size: 26, color: theme.ink, alpha: step(l, 8.2, 0.6) });
      Motion.paragraph(ctx, `Provisional: without wholesale trade the later widening shrinks. Early-era (2014–2018) Q5 ratios: ${fmt.dec(earlyQ5[0], 2)} to ${fmt.dec(earlyQ5[1], 2)}.`, px, 600, 440, { size: 24, color: theme.muted, alpha: step(l, 9.4, 0.6) });
    }
  } };

  DEFS.lists = { z: 1, draw({ ctx, local: l, theme }) {
    title(ctx, 'Firms on the sanctions list: lower odds of a statement by 2024', l, 0.2, theme, 118, 46);
    subtitle(ctx, 'against firms on no list, with 95% intervals', l, 0.6, theme);
    const u = step(l, 1.2, 4.0, E.inOutSine);
    const ser = [{ label: 'Sanctions list only', color: theme.accent, points: listRows('annual-eligible-membership', 'sanctioned_only'), whiskers: true, dot: 8, width: 4 },
                 { label: 'Government strategic list only', color: theme.fall, points: listRows('annual-eligible-membership', 'administrative_only'), whiskers: true, dot: 8, width: 4 }];
    ctx.save(); ctx.globalAlpha *= step(l, 0.8, 0.5);
    CH.yearDots(ctx, { x: 170, y: 250, w: 620, h: 620 }, ser, { xDomain: [2019, 2024], yDomain: [0.015, 3], yTicks: [0.02, 0.05, 0.1, 0.25, 0.5, 1, 2], progress: u, theme });
    ctx.restore();
    // One small table (round 4): the four six-year histories by group, percentages only, the
    // denominators in the column headers (the README keeps the counts).
    const px = 1130, colsX = [1650, 1860];   // round 10: the monospace heads and denominators need the columns 210 px apart and the labels to end before 1,572
    if (l > 6.4) {
      eyebrow(ctx, 'Six-year histories, fixed 2019 cohort', px, 270, theme, step(l, 6.4, 0.5));
      const groups = [['10000', 'Sanctions list only'], ['00000', 'No list']];
      const rows = [['all_available', 'all six years available'], ['available_then_absent', 'available, then absent from 2022'], ['all_absent', 'absent all six years'], ['removed', 'removed from the registry']];
      const ha = step(l, 6.8, 0.5);
      groups.forEach(([g, name], gi) => { const d = bin(g, 'all_available'); Motion.text(ctx, name, colsX[gi], 318, { size: 24, weight: 700, color: theme.ink, align: 'right', alpha: ha, group: 'lists-head-' + g }); Motion.text(ctx, `${fmt.int(d.denominator)} firms`, colsX[gi], 346, { size: 22, color: theme.muted, align: 'right', alpha: ha, group: 'lists-head-' + g }); });
      ctx.save(); ctx.globalAlpha *= ha; ctx.strokeStyle = theme.dim; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(px, 366); ctx.lineTo(1860, 366); ctx.stroke(); ctx.restore();
      rows.forEach(([b, lab], i) => {
        const y = 406 + i * 48, a = step(l, 7.2 + i * 0.3, 0.5);
        Motion.text(ctx, lab, px, y, { size: 22, color: theme.ink, alpha: a });
        groups.forEach(([g], gi) => Motion.text(ctx, fmt.pct(bin(g, b).share), colsX[gi], y, { size: 26, weight: 500, color: theme.ink, align: 'right', alpha: a, group: 'lists-' + g }));
      });
    }
    Motion.paragraph(ctx, 'List memberships are fixed, not dated designations. The odds compare populations, not the same firms.', 170, 960, 1160, { size: 22, color: theme.muted, alpha: step(l, 9.6, 0.6) });
  } };

  DEFS.next = { z: 1, draw({ ctx, local: l, cam, stage, theme }) {
    const mix = step(l, 6.6, 1.2, E.inOutSine);
    MM.drawTiles(ctx, stage, cam, cohortTiles, c => (c === 'below' ? theme.below : RAMP5[c - 1]), { alpha: step(l, 0.6, 1.0) * (1 - mix), alphaOf: c => (c === 'below' ? 0.45 : 1) });
    if (mix > 0) MM.drawTiles(ctx, stage, cam, finTiles, c => CHANGE6[c], { alpha: mix });
    const px = 1400;
    eyebrow(ctx, 'What comes next', px, 140, theme, step(l, 0.2, 0.5));
    if (mix < 0.5) {
      Motion.text(ctx, 'Four fixed 2021 cohorts', px, 230, { size: 32, weight: 700, color: theme.ink, alpha: step(l, 0.4, 0.5) * (1 - 2 * mix) });
      Motion.text(ctx, 'firms per cohort', px, 264, { size: 24, color: theme.muted, alpha: step(l, 0.4, 0.5) * (1 - 2 * mix) });
      const rows = [['revenue_cash', 'Revenue cohort by cash share'], ['revenue_inventory', 'Revenue cohort by inventory share'], ['margin_cash', 'Margin cohort by cash share'], ['margin_inventory', 'Margin cohort by inventory share']];
      ctx.save(); ctx.globalAlpha *= (1 - 2 * mix);
      CH.bars(ctx, { x: px, y: 310, w: 300, h: 300 }, rows.map(([id, lab]) => ({ label: lab, value: flowValue(id), color: id.startsWith('revenue') ? theme.accent : theme.accentStrong })), { max: flowValue('revenue_cash'), progress: step(l, 0.8, 1.8, E.outCubic), theme, barH: 28, gap: 44, size: 23 });
      MM.legendBar(ctx, px, 640, 440, RAMP5, C100.cohort_cutpoints.map(b => Math.round(b) + '%'), theme, { alpha: step(l, 1.4, 0.6), title: ['Inclusion per cell', `(${fmt.int(cohortFirms)} cohort firms)`] });
      ctx.restore();
    } else {
      ctx.save(); ctx.globalAlpha *= (2 * mix - 1);
      Motion.text(ctx, 'Real revenue, 2024 vs 2021', px, 230, { size: 28, weight: 700, color: theme.ink });
      Motion.paragraph(ctx, 'Revenue cohort by cash share: percent change of each cell’s median among the cohort firms observed that year.', px, 280, 440, { size: 24, color: theme.muted });
      const labels = ['≤ −20%', '−20 to −10', '−10 to 0', '0 to +10', '+10 to +20', '> +20%'];
      MM.legendSwatches(ctx, px, 420, [5, 4, 3, 2, 1, 0].map(c => ({ color: CHANGE6[c], label: labels[c], right: fmt.int(finCounts[c] || 0) + ' cells' })), theme, { colWidth: 440, rowGap: 12 });
      ctx.restore();
    }
    Motion.paragraph(ctx, 'Chapter 3 asks whether the cash and inventories firms held in 2021 predicted their revenue and operating margins in 2022–2024: import substitution, or scarring?', px, 870, 500, { size: 24, color: theme.ink, alpha: step(l, 8.8, 0.6) });
  } };

  DEFS.credits = { z: 1, draw({ ctx, local: l, theme }) {
    Motion.reveal(ctx, 'WHO STAYS VISIBLE?', 960, 400, l, 0.3, { size: 40, weight: 700, color: theme.ink, align: 'center', stripe: { gap: 2 } });
    { const u = Motion.step(l, 0.5, 0.5, Motion.ease.outCubic); if (u > 0) { const name = 'ARMEN G. KAPRELIAN · PHD CANDIDATE, CLAREMONT GRADUATE UNIVERSITY', w = Motion.measure(ctx, name, 22, 500, 22 * 0.08); MM.mark(ctx, 960 - w / 2 - 22, 446 - 8 + 10 * (1 - u), 22, theme.muted, u); } }   // the mark before the name line (round 10, the author's items 14 and 16)
    Motion.reveal(ctx, 'ARMEN G. KAPRELIAN · PHD CANDIDATE, CLAREMONT GRADUATE UNIVERSITY', 960, 446, l, 0.5, { size: 22, weight: 500, color: theme.muted, align: 'center', letterSpacing: 22 * 0.08 });
    Motion.revealParagraph(ctx, 'Data: RFSD v3.1.0 (Bondarkov et al. 2025, CC BY 4.0), 63,308,662 annual records, financial years 2011–2025, values deflated and classed by the author', 960, 490, 1760, l, 0.8, { size: 22, color: theme.muted, align: 'center', lineHeight: 1.35, group: 'credits-data' });
    Motion.reveal(ctx, 'Boundaries: geoBoundaries.org gbOpen (CC BY 4.0); OpenStreetMap/Wambacher 2017, ODbL 1.0; © OpenStreetMap contributors', 960, 572, l, 1.1, { size: 22, color: theme.muted, align: 'center' });
    Motion.revealParagraph(ctx, 'Descriptive, not causal. Dated events are context. Absence from the archive is not withdrawal or concealment. Supplied lists are fixed memberships, not dated designations.', 960, 624, 1760, l, 1.4, { size: 22, color: theme.muted, align: 'center', lineHeight: 1.35, group: 'credits-caveat' });
  } };

  // ---- cuts ------------------------------------------------------------------------------------
  // buildCut assembles a full cut from a beat list: the ground, one scene per beat (the zoom scene
  // spans the Moscow beats), the section's scenes when a factory is given, the chapters, the camera.
  function buildCut(list, sectionFor) {
    const { B, total } = beatsOf(list);
    const section = sectionFor(B);
    const sch = schedulesFor(B, section);
    const scenes = [groundScene(sch, total, null)], timeline = {};
    for (const [id] of list) {
      const b = B[id];
      if (id === 'section') { section.scenes.forEach(s => scenes.push(s)); Object.assign(timeline, section.timeline); continue; }
      timeline[id] = { id, start: b.start, end: b.end, title: TITLES[id] };
      const end = id === 'zoom' ? B.section.start + section.SEC.profiles : b.end;   // the zoom scene runs under the street zoom's first 12 s
      const def = id === 'zoom' ? zoomScene() : DEFS[id];
      scenes.push(Object.assign({ id, title: TITLES[id], start: b.start, end }, def));
    }
    return { scenes, keyframes: keyframesFor(B, section), DURATION: total, timeline, B, sch };
  }
  // makeCut re-cuts a full cut: entries [id, title, cutStart, cutEnd, fullStart, fullEnd] play the
  // parent's window [fullStart, fullEnd] between cutStart and cutEnd (speed = window / slot). Every
  // parent scene meeting the window is cloned with the matching start, end, speed and offset, and
  // clipped scenes get a 0.5 s fade; the ground draws from the parent's clock through the same time
  // map; map windows carry the parent's keyframes compressed by the speed, with a hold at each end so
  // the camera moves between map windows only during the crossfade. Chart windows leave the camera
  // where the last map window left it.
  function makeCut(parent, entries, duration, mapWindows) {
    const camFull = Motion.camera(parent.keyframes, 1920, 1080);
    const tl = {}, sc = [], kf = [], maps = [], spans = [];
    for (const [id, title, start, end, fs, fe, camEnd] of entries) {
      if (!(fe > fs) || !(end > start)) throw new Error(`makeCut: the window ${id} is empty or reversed (${fs}-${fe} into ${start}-${end})`);
      const speed = (fe - fs) / (end - start);
      tl[id] = { id, start, end, title }; maps.push({ start, end, fs, speed });
      // Windows that continue each other in both clocks (no gap, the same speed) form one span: its scenes
      // are cloned once and the holds and clipping fades sit only at the span's ends, so a chapter boundary
      // inside a contiguous stretch of the parent leaves no trace.
      const last = spans[spans.length - 1];
      // camEnd (parent time, optional): the camera stops following the parent there and holds, while the scenes play on to fe.
      if (last && Math.abs(last.fe - fs) < 1e-9 && Math.abs(last.end - start) < 1e-9 && Math.abs(last.speed - speed) < 1e-9) { last.fe = fe; last.end = end; last.map = last.map || mapWindows.has(id); last.camEnd = camEnd; }
      else spans.push({ id, start, end, fs, fe, speed, map: mapWindows.has(id), camEnd });
    }
    for (const w of spans) {
      const { start, end, fs, fe, speed } = w;
      for (const s of parent.scenes) {
        if (s.id === 'ground' || s.end <= fs || s.start >= fe) continue;
        const a = Math.max(s.start, fs), b = Math.min(s.end, fe);
        sc.push(Object.assign({}, s, { id: s.id + '@' + w.id, start: start + (a - fs) / speed, end: start + (b - fs) / speed, speed, offset: a - s.start,
                                       fadeIn: s.start < fs ? 0.5 : s.fadeIn, fadeOut: s.end > fe ? 0.5 : s.fadeOut }));
      }
      if (!w.map) continue;
      const ce = w.camEnd == null ? fe : w.camEnd;
      kf.push(Object.assign({}, camFull(fs), { t: start }));
      for (const k of parent.keyframes) if (k.t > fs && k.t < ce) kf.push(Object.assign({}, k, { t: start + (k.t - fs) / speed }));
      kf.push(Object.assign({}, camFull(ce), { t: end - 0.5 }));
    }
    const timeMap = t => { let m = maps[0]; for (const x of maps) if (t >= x.start) m = x; return m.fs + Math.min(Math.max(0, t - m.start), m.end - m.start) * m.speed; };
    sc.push(groundScene(parent.sch, duration, timeMap));
    kf.sort((a, b) => a.t - b.t);
    return { scenes: sc, keyframes: kf, DURATION: duration, timeline: tl };
  }
  // Consecutive windows of a parent played at full speed: [id, title, fs, fe] in order, start times from a running clock.
  // The cuts (one family since round 5; the Moscow standalone and the two maps-and-firms cuts were retired by the
  // author on 24 October 2026): the full cut and a 46 s teaser with a six-second excerpt of the designation.
  // images may be null: the scenes draw without the rasters until TreatedScenes.setImages hands them over.
  function makeCuts(images, opts) {
    const TS = window.TreatedScenes;
    // The national rasters were built at the left framing; refuse to build if the manifest's camera is not this page's.
    const c = TS.NATCAM, L = leftK();
    if (Math.abs(c.k - L.k) > 1e-9 || Math.abs(c.cx - L.cx) > 1e-6 || Math.abs(c.cy - L.cy) > 1e-6 || c.ox !== L.ox || c.oy !== L.oy) throw new Error('the national rasters were built at a different camera than the left framing');
    const fm = buildCut(BEATS, B => TS.journey(images, B.section.start));
    const B = fm.B, S0 = B.section.start, SEC = TS.SEC;
    const spec = [['hook', TITLES.hook, 0, 7.5, 0, B.hook.end], ['years', TITLES.years, 7.5, 17.5, B.years.start, B.years.end], ['zoom', 'Into the street', 17.5, 29, B.zoom.start, S0 + 6],   // the street zoom up to k 120, before the title (the excerpt that follows carries the story)
                  ['designation', 'Designation', 29, 35, S0 + SEC.designation - 2, S0 + SEC.designation + 4], ['groups', TITLES.groups, 35, 43.5, B.groups.start, B.groups.end], ['credits', TITLES.credits, 43.5, 46, B.credits.start, B.credits.end]];
    return { full: fm, teaser: makeCut(fm, spec, 46, new Set(['hook', 'years', 'zoom', 'designation'])) };
  }
  window.ExplainerScenes = { makeCuts, TITLES, frames: { left: leftK(), nat: natK(0.98) } };
})();
