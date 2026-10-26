// Visibility atlas: an interactive explorer over the same aggregates as the explainer. State lives
// in the page; the map redraws on every state change; every panel names its source.
(function () {
  'use strict';
  const D = window.MOTION_DATA, S = D.series, C100 = D.cells100, DEN = D.density, BM = D.basemap, CY = D.cellsyears;
  const F = S.facts, fmt = Motion.fmt, MM = MotionMap, CH = MotionCharts;
  MM.listedQuiet = 1; MM.listedCased = 1;   // the atlas's quieter resting listed marks at the national zoom (round 11, item 2) and the cased marks of round 14 (B''); the video keeps round 8's rule
  { const q = new URLSearchParams(location.search); MM.hairlines = q.get('hairlines') === '0' ? 0 : 1; MM.landLevels = q.get('land') === '0' ? 0 : 1; }   // round 14: the borders as 1 device px hairlines on fractional device ratios, and the land by level of detail; ?hairlines=0 and ?land=0 draw as before, for the comparison crops
  const $ = id => document.getElementById(id);
  // Text audit (as the explainer's): ?__audit=1 records every text box per canvas; tools/atlas-audit.py
  // drives the page at several panel widths through window.__atlas and tests overlaps, bounds and sizes.
  if (new URLSearchParams(location.search).get('__audit') === '1') Motion.audit.on = true;
  window.__atlasCanvases = {};
  // Firms view (round 5, 23 October 2026): every registered address per year from M9 (data/firms/*.bin.gz,
  // manifest data/firms.js) and the listed firms from treatednational.js; off when either is absent or the
  // browser cannot inflate gzip. Nothing here names a firm on no list: the address files carry counts and classes only;
  // listed firms carry their list-file names (25 October 2026).
  const FM = D.firms || null, TRN = D.treatednational || null, AN = D.anchors && D.anchors.a && D.anchors.b ? D.anchors : null;   // the anchors: the two firms of the film, shipped since round 5
  if (TRN && typeof TRN.psh === 'string') { TRN.psh = MM.b64Int16(TRN.psh); TRN.rev_m = typeof TRN.rev_m === 'string' ? MM.b64Float32(TRN.rev_m) : null; }   // the listed firms' shares of the revenue at their coordinate pairs (tenths of a percent, -1 none) and their revenue in millions (round 9)
  const INDD = D.industry || null, REG = D.regions || null, IND_T = INDD || (FM && FM.industry) || null;   // the industry layer (round 9): cells, regions, the division and class tables
  const FIRMS_OK = !!(FM && TRN && typeof DecompressionStream === 'function');
  // The console greeting (round 12, part D, item 4): one console.log on load, the project mark in ASCII, the title line, the build the publish set was made from
  // (publish-set.py writes the commit into the build meta; the lab copy says working tree) and the repository; nothing else is logged.
  const BUILD = (document.querySelector('meta[name="build"]') || {}).content || 'the working tree';
  console.log(['+--      --+', '|          |', '      o', '|          |', '+--      --+', 'Visibility Atlas · Armen G. Kaprelian', 'Built from ' + BUILD, 'github.com/ArmenKaprelian/whostaysvisible'].join('\n'));
  const CLASS_LABELS = ['≤ −50%', '−50 to −20%', '−20 to 0%', '0 to +50%', '+50 to +150%', '> +150%'];

  // ---- theme -----------------------------------------------------------------------------------
  const root = document.documentElement;
  function readTheme() {
    const css = getComputedStyle(root), tok = n => css.getPropertyValue('--' + n).trim();
    const scheme = tok('scheme'); const dark = scheme ? scheme !== 'light' : tok('stage').toUpperCase() !== '#FFFFFF';
    // Dark theme (round 10): the single-hue cyan ramp for ordered layers and one amber-to-orange against cyan pair for the signed
    // layers (the Change layer, the revenue layer in both views), the industry nine and the pair read from the page's tokens (the data
    // tables as the fallback); rounds 2 to 9 used ColorBrewer YlGnBu and PRGn. Light theme: the manuscript's navy ramps for ordered
    // layers, the light pair (darker outward) for signed change, the light nine.
    const t = { dark, stage: tok('stage'), land: tok('land'), border: tok('border'), graticule: tok('graticule'), ink: tok('ink'), muted: tok('muted'), dim: tok('dim'), grid: tok('grid'), panel: tok('panel'),
             ind9: (() => { const t = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => tok('ind-' + i)); return t.every(Boolean) ? t : IND_T ? (dark ? IND_T.classes.colour_dark : IND_T.classes.colour_light) : []; })(),   // the tokens first (round 10), the pass's table as the fallback
             cursor: tok('cursor') || '#FF45C8', cursorLive: tok('cursor-live') || '#FF8FDF', context: tok('context') || '#4DFF7F', contextLive: tok('context-live') || '#9AFFB8',   // the two accents (round 9): UI only, never data; the full neon rests, the live variant moves
             accent: tok('accent'), accentStrong: tok('accent-strong'), fall: tok('fall'), rise: tok('rise'), below: tok('below'), highlightBand: tok('highlight'), tick: tok('dim'), axis: tok('dim'), barMuted: tok('border'),
             ramp6: dark ? ['#1C8383', '#269C96', '#50B5AA', '#79CDBF', '#A1E4D3', '#C7F8E7'] : ['#D9E8F5', '#A9C4DE', '#78A3C9', '#4F84B4', '#2F6395', '#16436E'],
             ramp5: dark ? ['#269C96', '#50B5AA', '#79CDBF', '#A1E4D3', '#C7F8E7'] : ['#78A3C9', '#4F84B4', '#2F6395', '#16436E', '#061C38'],
             change6: (() => { const t = [1, 2, 3, 4, 5, 6].map(i => tok('div-' + i)); return t.every(Boolean) ? t : dark ? ['#FFB000', '#F39523', '#EA7719', '#50B5AA', '#79CDBF', '#A1E4D3'] : ['#854505', '#9D5E01', '#B27901', '#1C989E', '#0A7E83', '#196369']; })(),   // classes 1 to 6, the largest decline first; the same six serve the revenue layer (div6)
             density: dark ? '#79CDBF' : '#16436E',
             ghost: tok('ghost') || (dark ? '#1F3350' : '#E4E7E4'),   // one step above the land (round 10): the hand-over outline, the hairline borders
             go: tok('go') || (dark ? '#9CC8FF' : '#22364D'),   // the GO TO card's ice (item 21): the ghost names take it at 30 percent, so the two stay tied (round 12, final)
             neutral: FM ? (dark ? FM.neutral.dark : FM.neutral.light) : '#B5C3D1', zero: tok('zero') || (FM && FM.zero ? (dark ? FM.zero.dark : FM.zero.light) : (dark ? '#6B7482' : '#727C86')), treated: tok('treated') || '#E31A1C', treatedOutline: '#FFD9D9' };
    t.div6 = t.change6;   // the revenue classes of the Firms view and the Cells view's fin layer share the Change layer's pair (round 10; the blue six of rounds 3 to 9 stay in the manifests' class_colours)
    return Object.assign(t, MM.coreRamp(t));   // the bloom's pale-core tables (round 9)
  }
  // The remembered choice is applied before the first read (round 10): until then a viewer who had chosen light saw the canvases drawn dark until a click.
  let explicit = null;
  try { explicit = localStorage.getItem('atlas-theme'); } catch (e) { explicit = null; }
  if (explicit === 'light' || explicit === 'dark') root.setAttribute('data-theme', explicit);
  let theme = readTheme();
  function syncThemeButton() { const light = !readTheme().dark; $('theme').textContent = light ? 'Dark theme' : 'Light theme'; $('theme').setAttribute('aria-pressed', String(light)); }
  $('theme').addEventListener('click', () => { const next = readTheme().dark ? 'light' : 'dark'; root.setAttribute('data-theme', next); try { localStorage.setItem('atlas-theme', next); } catch (e) { /* no storage */ } theme = readTheme(); syncThemeButton(); redrawAll(); });

  // ---- data ------------------------------------------------------------------------------------
  const bmp = MM.buildBasemap(BM);
  const partPaths = BM.lod0.parts.map(p => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const r of p.rings) { let x = r[0] / 10, y = r[1] / 10; const upd = () => { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }; upd(); for (let i = 2; i < r.length; i += 2) { x += r[i] / 10; y += r[i + 1] / 10; upd(); } } return { name: p.name, path: MM.partsToPath([p]), x0, y0, x1, y1 }; });   // each part with its km bounds: the region lookup under the cursor tests the bounds before the path (25 October 2026)
  const nat = MM.decodeDensity(DEN.national);
  const FINE_BREAKS = [55, 62, 68, 74], YEAR_BREAKS = [20, 35, 50, 60, 70], FIN_BREAKS = [-20, -10, 0, 10, 20];
  // The national 5 km grid (36,585 cells) is split into 500 km blocks, so a draw touches only the blocks in view and
  // the pass inside a city window only the blocks under it (24 October 2026; the picture is unchanged).
  const NAT_BLOCK = 500;
  const natBlocks = (() => { const by = new Map(); for (let i = 0; i < nat.count; i++) { const bx = Math.floor(nat.ix[i] * nat.grid / NAT_BLOCK), byy = Math.floor(nat.iy[i] * nat.grid / NAT_BLOCK), key = bx + ',' + byy; let b = by.get(key); if (!b) { b = { x0: bx * NAT_BLOCK, y0: byy * NAT_BLOCK, x1: (bx + 1) * NAT_BLOCK, y1: (byy + 1) * NAT_BLOCK, ix: [], iy: [], n: [], a: [] }; by.set(key, b); } b.ix.push(nat.ix[i]); b.iy.push(nat.iy[i]); b.n.push(nat.n[i]); b.a.push(nat.a[i]); }
    return [...by.values()].map(b => ({ x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1, paths: MM.buildDensityPaths({ grid: nat.grid, origin: nat.origin, ix: b.ix, iy: b.iy, n: b.n, a: b.a, count: b.ix.length }, FINE_BREAKS) })); })();
  // Below k 0.5 (a 5 km cell under 2.5 px) the national counts come from a picture rendered once per theme at 0.35 px per
  // km (a cell is 1.75 px) and drawn scaled, which keeps the country view and the start of every flight at the frame rate;
  // the rasteriser averaged those sub-pixel cells anyway, so the picture is the same. Above it the blocks' rectangles draw.
  const NAT_BMP_K = 0.35; let natBmp = null;
  function natBitmap() {
    if (natBmp && natBmp.colour === theme.density) return natBmp;
    const ext = BM.extents.national, W = Math.ceil((ext.x[1] - ext.x[0]) * NAT_BMP_K) + 4, H = Math.ceil((ext.y[1] - ext.y[0]) * NAT_BMP_K) + 4;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const ctx2 = cv.getContext('2d');
    const st = { width: W, height: H, scale: 1, base() { ctx2.setTransform(1, 0, 0, 1, 0, 0); } };
    const camB = { cx: (ext.x[0] + ext.x[1]) / 2, cy: (ext.y[0] + ext.y[1]) / 2, k: NAT_BMP_K, ox: W / 2, oy: H / 2 };
    for (const b of natBlocks) MM.drawDensityCounts(ctx2, st, camB, b.paths, theme.density, 1);
    natBmp = { cv, cam: camB, W, H, colour: theme.density }; return natBmp;
  }
  // Draws the national grid's blocks that meet the view, or the given km rectangle, as counts or as shares.
  function drawNat(c, alpha, region, shares) {
    if (!shares && c.k < 0.5) {
      const b = natBitmap(), [px, py] = Motion.project(c, b.cam.cx - b.W / 2 / b.cam.k, b.cam.cy + b.H / 2 / b.cam.k), f = c.k / b.cam.k;
      mctx.save(); stage.base(); mctx.globalAlpha *= alpha; mctx.drawImage(b.cv, px, py, b.W * f, b.H * f); mctx.restore(); return;
    }
    const hx = stage.width / 2 / c.k, hy = stage.height / 2 / c.k; let x0 = c.cx - hx, x1 = c.cx + hx, y0 = c.cy - hy, y1 = c.cy + hy;
    if (region) { x0 = Math.max(x0, region.origin[0]); x1 = Math.min(x1, region.origin[0] + region.size); y0 = Math.max(y0, region.origin[1]); y1 = Math.min(y1, region.origin[1] + region.size); }
    for (const b of natBlocks) if (b.x1 > x0 && b.x0 < x1 && b.y1 > y0 && b.y0 < y1) { if (shares) MM.drawDensityShares(mctx, stage, c, b.paths, theme.ramp5, theme.below, alpha); else MM.drawDensityCounts(mctx, stage, c, b.paths, theme.density, alpha); }
  }
  const win1 = {}, win025 = {};
  for (const [label, w] of Object.entries(DEN.windows_1km)) { const d = MM.decodeDensity(w); win1[label] = { d, paths: MM.buildDensityPaths(d, FINE_BREAKS), cx: w.origin[0] + 45, cy: w.origin[1] + 45 }; }
  for (const [label, w] of Object.entries(DEN.windows_250m)) { const d = MM.decodeDensity(w); win025[label] = { d, paths: MM.buildDensityPaths(d, FINE_BREAKS), cx: w.origin[0] + 12, cy: w.origin[1] + 12 }; }
  const cityYear = {};   // label -> year -> {d, paths}
  for (const w of CY.city_1km) { const d = MM.decodeDensity(w); (cityYear[w.label] = cityYear[w.label] || {})[w.year] = { d, paths: MM.buildDensityPaths(d, FINE_BREAKS) }; }
  const years = CY.mapped_years;
  const yearIndex = {}; CY.avail.year.forEach((y, i) => { (yearIndex[y] = yearIndex[y] || []).push(i); });
  const cellKey = (ix, iy) => iy * 65536 + ix;
  const listClass = v => (v == null ? null : v >= 50 ? 3 : v >= 20 ? 2 : v >= 5 ? 1 : 0);
  const yearCells = {};   // year -> Map key -> {n, a, nr, ar, ns}
  for (const y of years) { const m = new Map(); for (const i of yearIndex[y]) m.set(cellKey(CY.avail.ix[i], CY.avail.iy[i]), { n: CY.avail.n[i], a: CY.avail.a[i], nr: CY.avail.nr[i], ar: CY.avail.ar[i], ns: CY.avail.ns[i] }); yearCells[y] = m; }
  const totals = {}; CY.totals.year.forEach((y, i) => totals[y] = { eligible: CY.totals.n[i], located: CY.totals.n_located[i], share: CY.totals.eligible_share[i], located_share: CY.totals.located_share[i] });
  const chg = C100.change, chgMap = new Map(); for (let i = 0; i < chg.ix.length; i++) chgMap.set(cellKey(chg.ix[i], chg.iy[i]), i);
  const coh = C100.cohort, cohIdx = [], cohMap = new Map(); for (let i = 0; i < coh.ix.length; i++) if (coh.outcome[i] === 'revenue' && coh.moderator[i] === 'cash') { cohIdx.push(i); cohMap.set(cellKey(coh.ix[i], coh.iy[i]), i); }
  const lists = C100.lists, listMap = new Map(), listClassCounts = [0, 0, 0, 0]; for (let i = 0; i < lists.ix.length; i++) { listMap.set(cellKey(lists.ix[i], lists.iy[i]), i); const cl = listClass(lists.sanctioned[i]); if (cl != null) listClassCounts[cl]++; }
  const fin = C100.fin, finIdx = [], finMap = new Map(); for (let i = 0; i < fin.ix.length; i++) if (fin.outcome[i] === 'revenue' && fin.moderator[i] === 'cash' && fin.year[i] === 2024) { finIdx.push(i); finMap.set(cellKey(fin.ix[i], fin.iy[i]), i); }
  // 25 km cells by year (M10, 24 October 2026): the step between the 100 km cells and the city windows, so a zoom
  // refines the cells across the country; without the file (older data) the 100 km cells simply stay.
  const C25 = D.cells25 || null, c25 = {}, G25 = C25 ? C25.grid_km : 25;
  const decode25 = (r, cols) => { const d = { count: r.count, ix: MM.b64Int16(r.ix), iy: MM.b64Int16(r.iy), map: new Map() }; for (const [k, src, wide] of cols) d[k] = r[src] == null ? null : (wide ? MM.b64Int32(r[src]) : MM.b64Int16(r[src])); for (let i = 0; i < d.count; i++) d.map.set(cellKey(d.ix[i], d.iy[i]), i); return d; };
  if (C25) for (const [y, r] of Object.entries(C25.by_year)) c25[+y] = decode25(r, [['n', 'n', true], ['a', 'a', true], ['ns', 'ns', true], ['ng', 'ng', true]]);
  const chg25 = C25 && C25.change ? decode25(C25.change, [['n21', 'n21', true], ['a21', 'a21', true], ['n24', 'n24', true], ['a24', 'a24', true], ['cls', 'class', false], ['pp', 'change_pp_x1000', true]]) : null;
  const list25Counts = [0, 0, 0, 0]; if (c25[2021]) { const d = c25[2021]; for (let i = 0; i < d.count; i++) if (d.ns[i] >= 5) list25Counts[listClass(d.ns[i])]++; }
  // ---- the industry layer (round 9, 25 October 2026): the division byte (1 to 99, 0 no OKVED 2 division code, 255 unknown) to its
  // class id (1 to 9; 0 unknown) from the manifests' division table, so the page and the passes share one definition; the cells'
  // leading division, its share, the listed share and the ranked mix per year (M11), and the 1 km city windows for 2019 to 2024.
  const IND_CLASS = new Uint8Array(256), IND_TITLE = new Map(), IND_SHORT = new Map();
  if (IND_T) { IND_T.divisions.code.forEach((c, i) => { IND_CLASS[+c] = IND_T.divisions.class[i]; IND_TITLE.set(+c, IND_T.divisions.title[i]); IND_SHORT.set(+c, IND_T.divisions.short[i]); }); IND_CLASS[0] = 9; IND_CLASS[255] = 0; }
  const divPad = code => String(code).padStart(2, '0');
  const divTitle = code => (code === 0 ? 'no OKVED 2 division code' : IND_TITLE.get(code) || `division ${divPad(code)}`);
  const divShort = code => (code === 0 ? 'no division code' : IND_SHORT.get(code) || `division ${divPad(code)}`);
  const divLabel = code => (code === 0 ? 'No OKVED 2 division code (missing or an earlier revision\'s code)' : `${divTitle(code)} (division ${divPad(code)})`);
  const indClassLabel = code => (IND_T && IND_CLASS[code] ? IND_T.classes.label[IND_CLASS[code] - 1] : '');
  const decodeInd = (r, k) => { const d = { count: r.count, k, ix: MM.b64Int16(r.ix), iy: MM.b64Int16(r.iy), nrev: MM.b64Int32(r.nrev), dom: MM.b64Uint8(r.dom), dsh: MM.b64Uint8(r.dsh), lsh: MM.b64Uint8(r.lsh), rv: r.rv ? MM.b64Int16(r.rv) : null, top: MM.b64Uint8(r.top_code), tsh: MM.b64Uint8(r.top_share), map: new Map() }; for (let i = 0; i < d.count; i++) d.map.set(cellKey(d.ix[i], d.iy[i]), i); return d; };
  const ind100 = {}, ind25 = {};   // year -> cells
  if (INDD) {
    for (const [y, r] of Object.entries(INDD.grid100.by_year)) ind100[+y] = decodeInd(r, INDD.grid100.topk);
    for (const [y, r] of Object.entries(INDD.grid25.by_year)) ind25[+y] = decodeInd(r, INDD.grid25.topk);
  }
  // The hit of a cell on the industry layer: the leading division, its share, the listed share and the ranked mix (the tile's bar reads mix and rest).
  function indHit(d, i) {
    const out = { nrev: d.nrev[i], dom: d.dom[i], share: d.dsh[i], lsh: d.lsh ? d.lsh[i] : null, mix: [], rest: 0 };
    if (d.dom[i] === 255) return out;
    let sum = 0; const k = d.k || 1;
    for (let j = 0; j < k; j++) { const code = d.top ? d.top[i * k + j] : d.dom[i], sh = d.top ? d.tsh[i * k + j] : d.dsh[i]; if (code === 255) break; sum += sh; out.mix.push({ code, share: sh, cls: IND_CLASS[code], title: divTitle(code), short: divShort(code) }); }
    out.rest = Math.max(0, 100 - sum); return out;
  }
  // The 25 km grid fades in from 1.5 to 2.7 times the country view's zoom (round 14, the author's request: the 100 km cells hold at the country view on every screen;
  // it was k 0.45 to 0.8, about 2.7 to 4.8 times the fit on the author's laptop).
  const alpha25 = k => (C25 ? Motion.step(k, 1.5 * kFit(), 1.2 * kFit(), Motion.ease.linear) : 0);
  // The Cells view's 1 km squares (round 14, the author's decision of 25 October 2026): the round-13 squares of the address files, everywhere, on the share, industry and
  // density layers (density in 2021), coming in over k 1.5 to 2.5 once the year's address file and its squares are ready (the 25 km cells stand until then); they
  // replace the 24 city windows' 1 km cells and the 2021 national 5 km shares in the drawing. The 2021 250 m windows stay, from k 24 to 40.
  const MICRO_LAYERS = new Set(['share', 'industry', 'density']);
  const microYear = () => (state.layer === 'density' ? 2021 : state.year);
  const microReady = y => !!(FIRMS_OK && firmYears.has(y) && mosaicCache.has(y + '|1'));
  const microA = (k, y) => (MICRO_LAYERS.has(state.layer) && microReady(y) ? Motion.step(k, 1.5, 1.0, Motion.ease.linear) : 0);
  const fineA = k => ((state.layer === 'density' || (state.layer === 'share' && state.year === 2021)) ? Motion.step(k, 24, 16, Motion.ease.linear) : 0);
  function ensureMicro(y) { if (!FIRMS_OK || firmYears.has(y)) return; ensureYear(y).catch(e => console.error(e)); }   // the address file loads once the camera nears k 1.5; prebuildBins draws the squares when they are ready
  // The year the red count in the Cells view's tile reads (the author's decision of 25 October 2026): each layer's own year, 2021 on the density, lists and cohort layers,
  // 2024 on the change and revenue layers, the slider's year on the share and industry layers; the strip keeps the slider's year.
  const layerYear = () => (state.layer === 'density' || state.layer === 'lists' || state.layer === 'cohort' ? 2021 : state.layer === 'change' || state.layer === 'fin' ? 2024 : state.year);
  function listedInCell(h) {   // the firms on the five lists present in that year at coordinates inside the hovered cell's square, exact, 0 included
    if (!TRN || h.kmx == null) return null; const g = h.grid || 100, o = h.origin || [0, 0], x0 = o[0] + Math.floor((h.kmx - o[0]) / g) * g, y0 = o[1] + Math.floor((h.kmy - o[1]) / g) * g, yi = layerYear() - 2014; let n = 0;
    for (let i = 0; i < TRN.n; i++) { if (TRN.filed[i][yi] === '-') continue; const x = TRN.x[i], y = TRN.y[i]; if (x >= x0 && x < x0 + g && y >= y0 && y < y0 + g) n++; }
    return n;
  }
  const tileCache = new Map();
  function tiles(key, build) { if (!tileCache.has(key)) tileCache.set(key, build()); return tileCache.get(key); }
  const classOfShare = (n, a, breaks) => { if (n < 50) return 'below'; const s = 100 * a / n; let c = 0; while (c < breaks.length && s >= breaks[c]) c++; return c; };

  // ---- state -----------------------------------------------------------------------------------
  const NAT = { cx: (BM.extents.national.x[0] + BM.extents.national.x[1]) / 2, cy: (BM.extents.national.y[0] + BM.extents.national.y[1]) / 2 };
  const state = { layer: 'share', year: 2024, cam: { cx: NAT.cx, cy: NAT.cy, k: 0.2 }, hover: null, mode: 'cells' };
  const hoverUnit = { key: null, tw: 0, th: 0, foot: '' };   // the hovered unit's key and the tile's measured size (round 14): a pointer move inside the same unit moves the tile and writes the footer only   // the landing (round 10): the Cells view, 2024, the leading-industry layer when its data exist (set below), the national zoom
  const LAYERS = [
    { id: 'density', label: 'Firm density, 2021', prov: 'Located eligible firms at registered addresses in 2021, counted per 5 km cell nationally and per 1 km and 250 m cell in city windows (M3 pass over the production point layer). Shares are shown only for cells with 50 or more firms.' },
    { id: 'share', label: 'Statement share by year', prov: 'Share of located eligible firms with an original statement, per 100 km cell, financial years 2014 to 2025 (M5 pass over the foundation registry and payload partitions, production projection and located rule; 2012 and 2013 carry no coordinates). City windows at 1 km for 2019 to 2024.' },
    { id: 'change', label: 'Change, 2024 against 2021', prov: 'Figure 2.7 lower panel: change in the located share with a statement, 2024 against 2021, 100 km cells with 50 or more located firms in both years; six classes at ±2 and ±5 points (presentation-finalization-20261019/data/availability-change-cells.csv).' },
    { id: 'cohort', label: 'Cohort inclusion', prov: 'Figure 2.8: share of a cell’s located eligible firms (2021) in the revenue cohort by cash share, pooled quintile classes of supported cells (candidate-02-cell-source.csv; cutpoints 33.3, 38.3, 43.0, 47.6%).' },
    { id: 'lists', label: 'List members (treated), 2021', prov: 'Located members of the sanctions list and the government strategic list (treated) per 100 km cell in 2021 (geography-review-20261006 cells); cells with fewer than 5 members of a list show no count. The lists are fixed memberships, not dated designations. Treated: a firm on at least one of the five lists (sanctions, decree, resident, government strategic, presidential strategic). The word names the study’s group, not an effect.' },
    { id: 'fin', label: 'Median revenue change (descriptive)', prov: 'Percent change of each cell’s median real revenue among the revenue-by-cash cohort firms observed in 2024, against the cell’s 2021 median; cells with 50 or more observed firms (pass2-reconcile geo-revenue-change-from-2021-source.csv). Descriptive: composition changes with observation; not a Chapter 3 estimate.' },
  ];

  if (INDD && IND_T) state.layer = 'industry';
  if (INDD && IND_T) LAYERS.push({ id: 'industry', label: 'Leading industry by year',
    prov: 'The division (two-digit OKVED 2 code, identical to NACE Rev. 2) with the largest share of nominal revenue among located eligible firms with a statement and a positive revenue value, per 100 km and 25 km cell for 2014 to 2025 and per 1 km city cell for 2019 to 2024 (M11 pass over the foundation registry and payload partitions). Nine classes: ' + IND_T.classes.label.map((l, i) => `${l} (divisions ${IND_T.classes.divisions[i]})`).join('; ') + '. Division names: NACE Rev. 2, Eurostat codelist NACE_R2 version 20.1, which OKVED 2 (OK 029-2014) mirrors at the two-digit level. Shares are within the year. Firms on these lists (treated) are included in the cells and their share of a cell’s revenue is given in the hover. In the Firms view the colour is the division with the largest share of revenue at the coordinate pair among the firms on no list (comparison group); a coordinate pair without a firm with a revenue value is neutral.' });

  // ---- map canvas ------------------------------------------------------------------------------
  // Four layers (24 October 2026): #map (the stage, the basemap and every cells-mode layer), #field (the firms view's
  // address field, WebGL), #marks (the listed marks and, in the firms view, the city labels) and #overlay (the hover).
  // #map no longer reads its pixels back, so it may be hardware-rendered; the field has its own canvas.
  const wrap = $('mapwrap'), mapC = $('map'), fieldC = $('field'), marksC = $('marks'), ovC = $('overlay');
  const mctx = mapC.getContext('2d', { willReadFrequently: new URLSearchParams(location.search).get('canvas') !== 'gpu' }), kctx = marksC.getContext('2d'), octx = ovC.getContext('2d');   // ?canvas=gpu draws the map canvas on the GPU, for the measurement on the author's screens (round 14)
  // The map context keeps willReadFrequently although nothing reads it back any more: the flag also selects the canvas's raster
  // path (CPU with it, GPU without), and without it the cells view's flights ran two to three times slower at device-pixel
  // ratios 2 and 3 in the lab's headless browser on the Intel GPU (measured 24 October 2026); the author may test the other setting.
  let layersOn = true;   // the field and marks canvases are shown in the firms view only, so the cells view composites the two canvases it always had
  const stage = { width: 0, height: 0, scale: 1, base() { mctx.setTransform(stage.scale, 0, 0, stage.scale, 0, 0); } };
  function sizeCanvases() {
    const r = { width: wrap.clientWidth, height: wrap.clientHeight }, dpr = window.devicePixelRatio || 1;   // the content box inside the 1 px border (25 October 2026: the border box was read before, 2 px larger than the canvases' box, so the browser resampled every canvas by 0.17 %)
    stage.width = Math.max(1, Math.round(r.width)); stage.height = Math.max(1, Math.round(r.height)); stage.scale = dpr;
    for (const c of [mapC, fieldC, marksC, ovC].concat(field2d ? [field2d.canvas] : [])) { c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr); c.style.width = stage.width + 'px'; c.style.height = stage.height + 'px'; }   // an explicit CSS size, so a device pixel is a device pixel
    window.__atlasCanvases.marks = { w: stage.width, h: stage.height };
    MM.listedCityK = Math.min(stage.width, stage.height) / 95;   // the city preset's zoom at this stage, where the listed marks' national extra ends (round 11, item 2)
    layersDirty();   // a canvas whose size is assigned is cleared, whatever the size: the field and the marks redraw
  }
  const cam = () => ({ cx: state.cam.cx, cy: state.cam.cy, k: state.cam.k, ox: stage.width / 2, oy: stage.height / 2 });
  // Camera targets (24 October 2026): pure helpers shared by the presets, the click ladder, the zoom buttons, the keys
  // and the audit API. k is CSS px per km; the floor is the fitted country, the ceiling 200 px per km.
  const SPAN_X = BM.extents.national.x[1] - BM.extents.national.x[0], SPAN_Y = BM.extents.national.y[1] - BM.extents.national.y[0], K_MAX = 200;
  const kFit = () => Math.min(stage.width / SPAN_X, stage.height / SPAN_Y) * 0.96;
  const minSide = () => Math.min(stage.width, stage.height);
  // The floor (round 11, the author's item 5): three-quarters of the fitted zoom, so the viewer can pull back a little past the fit; the fit button and the 0 key
  // return exactly to the fit, the one-way re-centring band stays defined from the fit (so between the fit and the floor the centre is the country's), the
  // wheel's settle lands on the floor's own target and the minus button disables there.
  const FLOOR_FRACTION = 0.75, kFloor = () => kFit() * FLOOR_FRACTION;
  const clampK = k => Motion.clamp(k, kFloor(), K_MAX);
  const fitTarget = () => ({ cx: NAT.cx, cy: NAT.cy, k: kFit() });
  const floorTarget = () => ({ cx: NAT.cx, cy: NAT.cy, k: kFloor() });
  const cityTarget = city => ({ cx: city.x, cy: city.y, k: minSide() / 95 });          // the city window: 95 km across the shorter side
  const fineTarget = (cx, cy) => ({ cx, cy, k: minSide() / 20 });                       // the 250 m cells: 20 km across
  const cellTarget = (ix, iy) => ({ cx: (ix + 0.5) * 100, cy: (iy + 0.5) * 100, k: minSide() / 500 });   // a 100 km cell without a preset city: 500 km across
  const atFloor = k => k <= kFloor() * 1.001;   // fully zoomed out: the view re-centres on the country (a safe reset)
  // Earlier re-centring (author's decision, 25 October 2026): on a zoom-out step whose new zoom lies in the band from
  // RECENTRE_FROM x kFit down to kFit, the stepped centre is blended toward the country's centre in proportion (none at
  // the band's top, all at the floor). Within one run of zoom-out steps inside the band an anchor holds the un-pulled
  // centre, so the pull stays proportional and continuous; a zoom-in step, a pan, a flight, a preset or a resize forgets
  // it, and nothing is remembered on the way in: the wheel and the trackpad pinch zoom about the cursor, the touch pinch
  // about the finger midpoint, the + button, the + key and a double-tap about the view's centre, as before. The 300 ms
  // settle at the floor stays.
  const RECENTRE_FROM = 2;
  const pullW = k => Motion.clamp((RECENTRE_FROM * kFit() - k) / ((RECENTRE_FROM - 1) * kFit()), 0, 1);
  let pullFrom = null;
  function zoomStep(f, km) {   // km: the point to hold under its pixel {x, y, px, py}, or null for a centre-anchored step
    const k1 = state.cam.k, k2 = clampK(k1 * f);
    if (atFloor(k2)) { pullFrom = null; return floorTarget(); }
    const c = km ? { cx: km.x - (km.px - stage.width / 2) / k2, cy: km.y + (km.py - stage.height / 2) / k2 } : { cx: state.cam.cx, cy: state.cam.cy };   // the point under the cursor stays put, or the centre does
    const w = pullW(k2);
    if (k2 >= k1 || w <= 0) { pullFrom = null; return { cx: c.cx, cy: c.cy, k: k2 }; }   // zooming in, or above the band: nothing remembered
    const w1 = pullW(k1), dx = c.cx - state.cam.cx, dy = c.cy - state.cam.cy;   // the step's own shift of the centre
    if (!pullFrom) pullFrom = w1 <= 0 ? { cx: state.cam.cx, cy: state.cam.cy } : w1 >= 1 ? { cx: NAT.cx, cy: NAT.cy } : { cx: (state.cam.cx - w1 * NAT.cx) / (1 - w1), cy: (state.cam.cy - w1 * NAT.cy) / (1 - w1) };   // entering the band, or resuming inside it without a jump
    pullFrom = { cx: pullFrom.cx + dx, cy: pullFrom.cy + dy };
    return { cx: Motion.lerp(pullFrom.cx, NAT.cx, w), cy: Motion.lerp(pullFrom.cy, NAT.cy, w), k: k2, pull: true };
  }
  const stepAt = (km, f) => zoomStep(f, km);
  const stepCentre = f => zoomStep(f, null);
  const cityInCell = (ix, iy) => bmp.cities.find(c => Math.floor(c.x / 100) === ix && Math.floor(c.y / 100) === iy) || null;
  function fitNational() { state.cam = fitTarget(); }
  function nearestCity(c) { let best = null, bd = Infinity; for (const city of bmp.cities) { const d = Math.hypot(city.x - c.cx, city.y - c.cy); if (d < bd) { bd = d; best = city; } } return { city: best, dist: bd }; }

  const winRect = (d, size) => ({ origin: d.origin, size });
  // Draws a coarser layer around a finer window: at full alpha outside the window's square and, while the window fades
  // in, at (1 - w) inside it, so a zoom into open country never leaves blank ground (hand-over fix, 24 October 2026).
  let handover = { one: 0, outsideAlpha: 1, outline: false };   // the last draw's hand-over state (round 10, the author's item 19; the audit reads it)
  function drawAround(c, win, w, draw, rec = true) {   // draw(alpha, region, w): region is the window's square on the inside pass, null outside; w the window's strength; rec: this pass is the 1 km hand-over the audit reads (the 250 m passes pass false)
    if (!win || w <= 0) { draw(1, null, 0); if (rec) handover = { one: 0, outsideAlpha: 1, outline: false }; return; }
    if (rec) handover = { one: w, outsideAlpha: 1 - 0.75 * w, outline: w > 0 };
    const [px, py] = Motion.project(c, win.origin[0], win.origin[1] + win.size), s = win.size * c.k;
    mctx.save(); stage.base(); mctx.beginPath(); mctx.rect(0, 0, stage.width, stage.height); mctx.rect(px, py, s, s); mctx.clip('evenodd'); draw(1 - 0.75 * w, null, w); mctx.restore();   // outside the window the coarser layer fades to a quarter as the fine grid comes in (round 10)
    if (w < 1) { mctx.save(); stage.base(); mctx.beginPath(); mctx.rect(px, py, s, s); mctx.clip(); draw(1 - w, win, 0); mctx.restore(); }
    stage.base();
  }

  let drawLog = [];   // the named draw steps of the last drawMap (round 10): the audit asserts the authorship mark right after the basemap and before every data layer
  // The field and the marks redraw only when what they show changed (round 14): a hovered region's fill redraws the map canvas alone, and the field and the marks
  // keep the frame they have. The key holds everything they depend on; layersDirty() forces the next draw (a restored context, an audit hook).
  let lastFieldKey = '', lastMarksKey = '';
  const layersKey = c => [state.mode, state.layer, state.year, theme.dark ? 1 : 0, c.cx, c.cy, c.k, stage.width, stage.height, stage.scale, firmYears.has(state.year) ? 1 : 0, microReady(microYear()) ? 1 : 0, mosaicOff ? 1 : 0, useGL() ? 1 : 0].join('|');
  const layersDirty = () => { lastFieldKey = ''; lastMarksKey = ''; };
  function drawMap(opts) {
    drawLog = [];
    const flight = !!(opts && opts.flight), motion = !!(opts && opts.motion);   // a flight frame skips the two DOM touches: the audit box and the legend; a wheel step (motion) leaves the strip to the settle
    Motion.audit.scene = 'map'; if (!flight) window.__atlasCanvases.map = { w: stage.width, h: stage.height }; if (!flight && !motion) queueMicrotask(updateContext);   // the strip follows every settled draw, never a flight frame or a wheel step   // the canvases' own size (the content box), for the audit
    const c = cam(); stage.base();
    mctx.fillStyle = theme.stage; mctx.fillRect(0, 0, stage.width, stage.height);
    MM.drawBasemap(mctx, stage, c, bmp, theme, { borderPx: c.k > 9 ? 1.2 : 0.8, lod0Colour: theme.ghost, lod0Alpha: ghostAlpha(c.k), lod0Px: 1, afterLand: () => drawRegionFill(c) }); drawLog.push('basemap');   // the regional borders as ghost-tone hairlines at the national zoom, gone by k 3 (round 10, G13b)
    markBox = { x: stage.width / 2 - 48, y: stage.height - (stripOpen() ? (narrow() ? 44 : 26) : 0) - 44 - 96, x1: stage.width / 2 + 48, y1: stage.height - (stripOpen() ? (narrow() ? 44 : 26) : 0) - 44 };   // the mark's box, which the ghost names keep clear of (round 12, final)
    MM.markAGK(mctx, stage.width / 2, stage.height - (stripOpen() ? (narrow() ? 44 : 26) : 0) - 44 - 48, 96, theme.ink, 0.04); drawLog.push('mark');   // the authorship mark (round 10, the author's item 17): fixed in screen space at the lower edge, under every data layer, 4 percent
    const L = state.layer;
    if (state.mode === 'firms') { drawLog.push('firms'); if (!layersOn) { fieldC.hidden = false; marksC.hidden = false; layersOn = true; layersDirty(); }
      const key = layersKey(c), fieldNew = key !== lastFieldKey; drawFirms(c, fieldNew); lastFieldKey = key;
      if (key !== lastMarksKey || pulse || found) { drawMarks(c); lastMarksKey = key; } else drawLog.push('ghost'); }   // the marks canvas keeps its frame (its ghost names included) when nothing it shows changed
    else if (L === 'density') { drawLog.push('density');
      const am = microA(c.k, 2021); if (c.k >= 1.2 && !flight && !motion) ensureMicro(2021);
      if (am < 1) drawNat(c, 1 - am, null, false);   // the national 5 km counts (2021), fading as the 1 km squares come in
      drawCellsSquares2d(c);
    } else if (L === 'share') { drawLog.push('share');
      // 100 km cells, then the 25 km cells, then the 1 km squares from the address files and the 2021 250 m windows (on the field canvas).
      const y = state.year, a25 = c25[y] ? alpha25(c.k) : 0, am = microA(c.k, y); if (c.k >= 1.2 && !flight && !motion) ensureMicro(y);
      const shareColour = cl => (cl === 'below' ? theme.below : theme.ramp6[cl]), shareAlpha = cl => (cl === 'below' ? 0.5 : 1);
      if (a25 < 1) { const paths = tiles('share' + y, () => { const idx = yearIndex[y]; return MM.buildTiles(idx.length, idx.map(i => CY.avail.ix[i]), idx.map(i => CY.avail.iy[i]), j => classOfShare(CY.avail.n[idx[j]], CY.avail.a[idx[j]], YEAR_BREAKS), { gapKm: 15 }); }); MM.drawTiles(mctx, stage, c, paths, shareColour, { alpha: 1 - a25, alphaOf: shareAlpha }); }
      if (c25[y]) { const d = c25[y], paths = tiles('share25-' + y, () => MM.buildTiles(d.count, d.ix, d.iy, i => classOfShare(d.n[i], d.a[i], YEAR_BREAKS), { sizeKm: G25, gapKm: G25 * 0.12 }));   // built now, not mid-flight
        if (a25 * (1 - am) > 0) MM.drawTiles(mctx, stage, c, paths, shareColour, { alpha: a25 * (1 - am), alphaOf: shareAlpha }); }
      drawCellsSquares2d(c);
    } else if (L === 'change') { drawLog.push('change');
      const a25 = chg25 ? alpha25(c.k) : 0, colour = cl => (cl === 'below' ? theme.below : theme.change6[cl - 1]), alphaOf = cl => (cl === 'below' ? 0.5 : 1);
      if (a25 < 1) { const paths = tiles('change', () => MM.buildTiles(chg.ix.length, chg.ix, chg.iy, i => (chg.supported[i] ? chg.class[i] : 'below'), { gapKm: 15 })); MM.drawTiles(mctx, stage, c, paths, colour, { alpha: 1 - a25, alphaOf }); }
      if (chg25) { const paths = tiles('change25', () => MM.buildTiles(chg25.count, chg25.ix, chg25.iy, i => (chg25.cls[i] > 0 ? chg25.cls[i] : 'below'), { sizeKm: G25, gapKm: G25 * 0.12 })); if (a25 > 0) MM.drawTiles(mctx, stage, c, paths, colour, { alpha: a25, alphaOf }); }
    } else if (L === 'cohort') { drawLog.push('cohort');
      const paths = tiles('cohort', () => MM.buildTiles(cohIdx.length, cohIdx.map(i => coh.ix[i]), cohIdx.map(i => coh.iy[i]), j => (coh.supported[cohIdx[j]] ? coh.class[cohIdx[j]] : 'below'), { gapKm: 15 }));
      MM.drawTiles(mctx, stage, c, paths, cl => (cl === 'below' ? theme.below : theme.ramp5[cl - 1]), { alphaOf: cl => (cl === 'below' ? 0.5 : 1) });
    } else if (L === 'lists') { drawLog.push('lists');
      const a25 = c25[2021] ? alpha25(c.k) : 0;
      if (a25 < 1) { const paths = tiles('lists', () => MM.buildTiles(lists.ix.length, lists.ix, lists.iy, i => listClass(lists.sanctioned[i]), { gapKm: 15 })); MM.drawTiles(mctx, stage, c, paths, cl => theme.ramp5[cl + 1], { alpha: 1 - a25 }); }
      if (c25[2021]) { const d = c25[2021], paths = tiles('lists25', () => MM.buildTiles(d.count, d.ix, d.iy, i => (d.ns[i] >= 5 ? listClass(d.ns[i]) : null), { sizeKm: G25, gapKm: G25 * 0.12 })); if (a25 > 0) MM.drawTiles(mctx, stage, c, paths, cl => theme.ramp5[cl + 1], { alpha: a25 }); }
    } else if (L === 'industry' && INDD) { drawLog.push('industry');
      // 100 km cells, then the 25 km cells, then the 1 km squares from the address files (on the field canvas); no 250 m layer.
      const y = state.year, a25 = ind25[y] ? alpha25(c.k) : 0, am = microA(c.k, y); if (c.k >= 1.2 && !flight && !motion) ensureMicro(y);
      const indColour = cl => (cl === 'below' ? theme.below : theme.ind9[cl - 1]), indAlpha = cl => (cl === 'below' ? 0.5 : 1), classOfDom = dom => (dom === 255 ? 'below' : IND_CLASS[dom]);
      if (a25 < 1 && ind100[y]) { const d = ind100[y], paths = tiles('ind' + y, () => MM.buildTiles(d.count, d.ix, d.iy, i => classOfDom(d.dom[i]), { gapKm: 15 })); MM.drawTiles(mctx, stage, c, paths, indColour, { alpha: 1 - a25, alphaOf: indAlpha }); }
      if (ind25[y]) { const d = ind25[y], paths = tiles('ind25-' + y, () => MM.buildTiles(d.count, d.ix, d.iy, i => classOfDom(d.dom[i]), { sizeKm: G25, gapKm: G25 * 0.12 })); if (a25 * (1 - am) > 0) MM.drawTiles(mctx, stage, c, paths, indColour, { alpha: a25 * (1 - am), alphaOf: indAlpha }); }
      drawCellsSquares2d(c);
    } else if (L === 'fin') { drawLog.push('fin');
      const paths = tiles('fin', () => MM.buildTiles(finIdx.length, finIdx.map(i => fin.ix[i]), finIdx.map(i => fin.iy[i]), j => { const v = fin.change_pct[finIdx[j]]; let cl = 0; while (cl < FIN_BREAKS.length && v >= FIN_BREAKS[cl]) cl++; return cl; }, { gapKm: 15 }));
      MM.drawTiles(mctx, stage, c, paths, cl => theme.change6[cl]);
    }
    stage.base();
    if (state.mode !== 'firms') {   // the Cells view (round 14): the 1 km and 250 m squares on the field canvas, the ghost names, the labels and the pulse rings on the marks canvas, both above the cells
      if (!layersOn) { fieldC.hidden = false; marksC.hidden = false; layersOn = true; layersDirty(); }
      const key = layersKey(c); if (key !== lastFieldKey) { drawCellsField(c); lastFieldKey = key; }
      if (key !== lastMarksKey || cellPulse || found) { drawCellsMarks(c); lastMarksKey = key; } else drawLog.push('ghost');
    }
    if (!flight) { drawLegend(); drawScaleBar(); }
  }

  // ---- firms view: loader, renderer, hover ------------------------------------------------------------
  const firmYears = new Map(), firmPending = new Map(); let firmOrder = [], firmStatus = null;
  const lowerBound = (arr, v) => { let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] < v) lo = m + 1; else hi = m; } return lo; };
  // The artifact host serves only listed file types, so a year's gzipped bytes travel as base64 inside a
  // script (data/firms/firms-YYYY.js, the lab's pattern for binary arrays), injected on demand.
  const loadScript = src => new Promise((ok, fail) => { const el = document.createElement('script'); el.src = src; el.onload = () => ok(); el.onerror = () => fail(new Error('could not load ' + src)); document.head.appendChild(el); });
  const twinNotes = {};   // the comment field of each twin's gzip header (round 10, the authorship mark; the bytes inside are unchanged)
  function gzipComment(u8) { const flg = u8[3]; let p = 10; if (flg & 4) p += 2 + (u8[p] | (u8[p + 1] << 8)); if (flg & 8) { while (u8[p]) p++; p++; } if (!(flg & 16)) return ''; let s = ''; while (u8[p]) s += String.fromCharCode(u8[p++]); return s; }
  async function loadYear(y) {
    const store = (D.firmsYear = D.firmsYear || {});
    if (!store[y]) await loadScript('data/' + FM.files[y].replace(/\.bin\.gz$/, '.js'));
    const b64 = store[y]; if (!b64) throw new Error('no data in the script'); delete store[y];
    const bin = atob(b64); let buf = new ArrayBuffer(bin.length); { const u8 = new Uint8Array(buf); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); }
    const head = new Uint8Array(buf, 0, 2);
    if (head[0] === 0x1f && head[1] === 0x8b) { twinNotes[y] = gzipComment(new Uint8Array(buf)); buf = await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer(); }
    const dv = new DataView(buf), magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3));
    const n = dv.getUint32(4, true), year = dv.getUint16(16, true), ver = dv.getUint16(18, true), exp = FM.by_year[y];
    const MK = FM.layout.mix_rows || 8, RB = FM.layout.record_bytes || (17 + 2 * MK);   // version 3 (round 9): x, y, n, a, f, rv, cls, then MK (ind, ish) pairs by share descending
    if (magic !== 'FRM1' || ver !== 3 || year !== +y || n !== exp.addresses || buf.byteLength !== 32 + RB * n) throw new Error(`bad file (${magic} v${ver} ${year}, ${n} records, ${buf.byteLength} bytes)`);
    const x = new Int32Array(buf, 32, n), yv = new Int32Array(buf, 32 + 4 * n, n), nn = new Uint16Array(buf, 32 + 8 * n, n), a = new Uint16Array(buf, 32 + 10 * n, n), f = new Uint16Array(buf, 32 + 12 * n, n), rv = new Uint16Array(buf, 32 + 14 * n, n), cls = new Uint8Array(buf, 32 + 16 * n, n);
    const mixInd = [], mixSh = []; for (let k = 0; k < MK; k++) { mixInd.push(new Uint8Array(buf, 32 + (17 + 2 * k) * n, n)); mixSh.push(new Uint8Array(buf, 32 + (18 + 2 * k) * n, n)); }
    const ind = mixInd[0], ish = mixSh[0], indCls = new Uint8Array(n), byInd = new Uint32Array(10);
    const share = new Uint8Array(n); let sumN = 0;
    for (let i = 0; i < n; i++) { sumN += nn[i]; const sh = 100 * a[i] / nn[i]; let c = 0; while (c < YEAR_BREAKS.length && sh >= YEAR_BREAKS[c]) c++; share[i] = c; const ic = IND_CLASS[ind[i]]; indCls[i] = ic; byInd[ic]++; }
    if (sumN !== exp.firms) throw new Error(`firms ${sumN} differ from the manifest's ${exp.firms}`);
    if (exp.by_ind && exp.by_ind.some((v, i) => v !== byInd[i])) throw new Error(`addresses by industry class differ from the manifest's for ${y}`);
    return { year: +y, n, x, y: yv, nn, a, f, rv, cls, share, ind, ish, indCls, mixInd, mixSh, mk: MK };
  }
  function ensureYear(y) {
    if (firmYears.has(y)) return Promise.resolve(firmYears.get(y));
    if (firmPending.has(y)) return firmPending.get(y);
    const p = loadYear(y).then(d => { firmYears.set(y, d); firmOrder.push(y); prebuildBins(y); while (firmOrder.length > 3) { const yy = firmOrder.shift(); firmYears.delete(yy); glFree(yy); for (const T of MOSAIC_LEVELS) mosaicCache.delete(yy + '|' + T); mosaicBitmaps.clear(); mosaicPathCache.clear(); } firmPending.delete(y); syncMix(); return d; }, e => { firmPending.delete(y); throw e; });
    firmPending.set(y, p); return p;
  }
  // The bins of a loaded year are built in idle time (round 14), not in the first frame that needs them (a 312 ms stall on the first zoom past k 1.5).
  const onIdle = f => (window.requestIdleCallback ? requestIdleCallback(f, { timeout: 3000 }) : setTimeout(f, 250));
  function prebuildBins(y) {   // outside flights, drags, pinches and wheel runs (the build is one long task); the Cells view draws the squares once they exist
    const build = () => { if (!firmYears.has(y)) return; if (flight || settleTimer || press || pinch) { onIdle(build); return; }
      for (const T of MOSAIC_LEVELS) { const had = mosaicCache.has(y + '|' + T); mosaicBins(y, T); if (!had && state.mode !== 'firms' && microYear() === y && MICRO_LAYERS.has(state.layer) && state.cam.k >= 1.5) { drawMap(); refreshHover(); } } };
    onIdle(build);
  }
  // Mark rules by zoom (base, s, cap, floor), the Moscow rasters' three extents: pixel marks with blocks below
  // 20 px per km (the region extent's rule), the city discs to 60, the downtown discs above.
  const MARK = { low: [1, 0.2, 3, 1.5], city: [2, 0.6, 8, 2], downtown: [3, 1.1, 11, 1.5] };
  const markRule = k => (k >= 60 ? MARK.downtown : k >= 20 ? MARK.city : MARK.low);
  const markRadius = (rule, n) => Math.max(rule[3], Math.min(rule[2], rule[0] + rule[1] * Math.sqrt(Math.max(0, n - 1))) / 2);
  const hex2rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const firmClass = (d, i, L) => (L === 'share' ? d.share[i] : L === 'fin' ? d.cls[i] : L === 'industry' ? d.indCls[i] : 0);
  const firmColour = (L, cl) => (L === 'share' ? theme.ramp6[cl] : L === 'fin' ? (cl ? theme.div6[cl - 1] : theme.zero) : L === 'industry' ? (cl ? theme.ind9[cl - 1] : theme.neutral) : theme.neutral);
  const firmPalette = L => (L === 'share' ? theme.ramp6 : L === 'fin' ? [theme.zero].concat(theme.div6) : L === 'industry' ? [theme.neutral].concat(theme.ind9) : [theme.neutral]).map(hex2rgb);
  function clearField() { if (gl && !glLost) { gl.viewport(0, 0, fieldC.width, fieldC.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); } if (field2d) { field2d.ctx.setTransform(1, 0, 0, 1, 0, 0); field2d.ctx.clearRect(0, 0, field2d.canvas.width, field2d.canvas.height); } }
  function clearMarks() { kctx.setTransform(1, 0, 0, 1, 0, 0); kctx.clearRect(0, 0, marksC.width, marksC.height); }
  function drawLabels(ctx, c, scene) {   // a label is drawn only when its text sits wholly inside the canvas (the audit's offcanvas rule; the video's 300 px edge fade is sized for its own frame)
    Motion.audit.scene = scene;
    const la = Motion.clamp((Math.log2(c.k) - Math.log2(1.5)) / (Math.log2(3) - Math.log2(1.5)), 0, 1);   // the small labels begin at k 1.5 and are full at k 3, where the ghost names have gone (round 10)
    if (la > 0) for (const city of bmp.cities) { const [px, py] = Motion.project(c, city.x, city.y); if (px < 0 || px >= stage.width || py < 0 || py >= stage.height) continue; const tw = Motion.measure(ctx, city.label, 13, 400); if (px + 7 + tw > stage.width - 1 || py - 5 - 13 < 0 || py - 5 + 4 > stage.height) continue; MM.cityLabel(ctx, c, city, theme, { size: 13, dot: 3, dx: 7, dy: -5, alpha: la }); }
    Motion.audit.scene = 'map';
  }
  // Ghost names (round 10, the author's item 13a): the 22 preset cities in large tracked capitals one step above the land, under every data layer, sized by
  // the rank of their 2021 located firms in the 90 km window (34 px for the first, 26 for the last), placed once per zoom bucket in rank order; a name that
  // meets a placed one (2 px gutter) tries below, right and left, then smaller sizes down to 26, and is dropped at that bucket if nothing fits; alpha 1 below
  // k 1 and 0 at k 3, linear in log k. Twenty-two fillText calls at most per frame; the layouts are cached per bucket.
  let GHOST_RANK = null;   // computed on first use: citySum's cache is declared later in the script
  // The sizes (round 12, the author's item C of 25 October): a steeper weight on the 2021 located-firm count of each city's window, so the two capitals stand out
  // without the rest looking small. Four anchors on the log of the count, linear between them: the smallest window 24 px, the third largest 30, St Petersburg 38,
  // Moscow 44; so the other twenty lie on a gentle slope from 30 down to 24 by their counts (2021: Moscow 762,760, St Petersburg 262,429, Yekaterinburg 93,659,
  // Murmansk 9,983 at the foot). Round 10 sized by rank alone, 34 down to 26.
  const GHOST_MIN = 24, GHOST_SIZES = [24, 30, 38, 44];   // at the smallest count, the third largest, the second, the largest
  const ghostRank = () => GHOST_RANK || (GHOST_RANK = (() => {
    const rows = bmp.cities.map(city => ({ city, n: ((citySum(city.label, 2021) || {}).n) || 0 })).sort((a, b) => b.n - a.n);
    const L = rows.map(r => Math.log(Math.max(1, r.n))), knots = [[L[L.length - 1], GHOST_SIZES[0]], [L[2], GHOST_SIZES[1]], [L[1], GHOST_SIZES[2]], [L[0], GHOST_SIZES[3]]];
    const sizeOf = ln => { if (ln >= knots[3][0]) return knots[3][1]; for (let k = 3; k >= 1; k--) if (ln >= knots[k - 1][0]) { const [x0, s0] = knots[k - 1], [x1, s1] = knots[k]; return Math.round(x1 > x0 ? s0 + (s1 - s0) * (ln - x0) / (x1 - x0) : s0); } return knots[0][1]; };
    return rows.map((r, i) => ({ city: r.city, n: r.n, size: sizeOf(L[i]) }));
  })());
  const ghostCache = new Map();
  const ghostAlpha = k => Motion.clamp(1 - Math.log2(Math.max(k, 1e-9)) / Math.log2(3), 0, 1);
  function ghostLayout(k) {
    const bucket = Math.floor(Math.log2(k)); if (ghostCache.has(bucket)) return ghostCache.get(bucket);
    const kb = Math.pow(2, bucket);   // the layout is resolved across the bucket's zoom range: a box placed on the far side of another city's dot crosses that city's box as the dots spread, so each candidate is tested at the bucket's floor, its middle and its top
    const placed = [], out = [], gutter = 2, meets = (a, b) => a.x < b.x + b.w + gutter && a.x + a.w + gutter > b.x && a.y < b.y + b.h + gutter && a.y + a.h + gutter > b.y;
    const atR = (p, r) => ({ x: p.px * r + p.dx, y: p.py * r + p.dy, w: p.w, h: p.h }), meetsAny = (cand, others) => [1, 1.5, 2].some(r => { const a = atR(cand, r); return others.some(o => meets(a, atR(o, r))); });   // the boxes at the dots scaled by r over the bucket
    const at = (px, py, w, h, where) => where === 'above' ? { x: px - w / 2, y: py - 10 - h, w, h } : where === 'below' ? { x: px - w / 2, y: py + 10, w, h } : where === 'right' ? { x: px + 10, y: py - h / 2, w, h } : { x: px - 10 - w, y: py - h / 2, w, h };
    for (const g of ghostRank()) {
      const px = g.city.x * kb, py = -g.city.y * kb; let done = null;   // screen offsets from the km origin at the bucket's smallest k: the layout does not depend on the pan
      for (let size = g.size; size >= GHOST_MIN && !done; size -= 2) {
        const w = Motion.measure(mctx, g.city.label.toUpperCase(), size, 500, size * 0.12), h = Math.round(size * Motion.CAP);
        for (const where of ['above', 'below', 'right', 'left']) { const b = at(px, py, w, h, where), cand = { px, py, dx: b.x - px, dy: b.y - py, w, h }; if (!meetsAny(cand, placed)) { done = { city: g.city, size, where, dx: cand.dx, dy: cand.dy, w, h }; break; } }
      }
      if (done) { placed.push({ px, py, dx: done.dx, dy: done.dy, w: done.w, h: done.h }); out.push(done); }
    }
    ghostCache.set(bucket, out); return out;
  }
  let ghostDrawn = 0, markBox = null; const GHOST_ALPHA = 0.30;   // the ghost names' opacity: plainly there when looked for, back in the ground when not (round 12, final)
  // Floating (round 12, part D): each name keeps its pixel size at every zoom, anchored to its city's screen position, with no fade and no scaling, so a zoom into
  // Moscow brings the letters over the city at the size they have at the country view; the collision pass runs per zoom bucket as before; a name is clipped at the
  // map's edge rather than dropped. Drawn above the cells, the dots and the listed marks and below the pulse rings, the hover ring, the crosshair, the tile and the
  // panels: on the map canvas after the cells layers, on the marks canvas after the marks and before the rings in the Firms view; 22 text calls at most, no new canvas.
  function drawGhostNames(ctx, c, scene) {
    ghostDrawn = 0; const lay = ghostLayout(c.k); Motion.audit.scene = scene;
    for (const g of lay) { const [px, py] = Motion.project(c, g.city.x, g.city.y), x = px + g.dx, y = py + g.dy; if (x + g.w < 0 || x > stage.width || y + g.h < 0 || y > stage.height) continue;
      if (markBox && x < markBox.x1 && x + g.w > markBox.x && y < markBox.y1 && y + g.h > markBox.y) continue;   // never over the authorship mark: a 30 percent name would hide the 4 percent mark
      Motion.text(ctx, g.city.label.toUpperCase(), x, y + g.h, { size: g.size, weight: 500, color: theme.go, alpha: GHOST_ALPHA, letterSpacing: g.size * 0.12, kind: 'ghost', group: 'ghost-' + g.city.label }); ghostDrawn++; }   // the GO TO card's ice at 30 percent (round 12)
    Motion.audit.scene = 'map';
  }

  // ---- the Firms view's field: the pixel field and the dots (round 14, the author's decision of 25 October 2026) ---------------------------------------------
  // Below the dots zoom the field is the video's per-pixel rule (js/pixel-field.js): every CSS pixel sums the firms on no list at the coordinate pairs inside it
  // and takes the layer's statistic, with 2 and 3 pixel blocks where 10 and 100 firms share a pixel and a faint backdrop of every firm under the revenue and industry
  // layers. From the dots zoom (k 20, or the phone's fine rung) each coordinate pair is a disc sized by the mark rule, drawn largest first at alpha 0.9 with an
  // antialiased edge, overlaps compounding (the author's choice of 24 October); the two crossfade over a 1.4 x band. Both draw on the field canvas: on WebGL2 with
  // blendable float targets, or, without them, through the CPU engine and the 2D discs on a canvas of their own. Positions travel as metres relative to the Moscow
  // point; each frame the camera's integer metres shift them on the GPU and the fraction comes as a small offset, so the GPU multiplies only small exact integers.
  // Round 11's additive field and tone pass, and round 10's region tint and glow under the field, retired with this round (the video's slide has neither).
  const GL_R = [Math.round(bmp.cities[0].x * 1000), Math.round(bmp.cities[0].y * 1000)];
  const GL_VS = `
attribute vec2 a_pos; attribute float a_n; attribute vec4 a_cls;
uniform vec2 u_shift; uniform vec2 u_off; uniform float u_kk; uniform vec2 u_size; uniform float u_sc; uniform vec4 u_rule; uniform float u_which; uniform vec3 u_pal[16]; uniform float u_w;
varying vec4 v_col; varying float v_r; varying float v_half; varying float v_square;
void main() {
  vec2 rel = a_pos + u_shift;
  float dx = u_off.x + rel.x * u_kk, dy = u_off.y - rel.y * u_kk;
  float cls = u_which < 0.5 ? a_cls.x : (u_which < 1.5 ? a_cls.y : (u_which < 2.5 ? a_cls.z : 0.0));
  vec3 col = u_pal[int(cls + 0.5)];
  float r = max(u_rule.w, min(u_rule.z, u_rule.x + u_rule.y * sqrt(max(0.0, a_n - 1.0))) * 0.5);
  float rd = r * u_sc, size = ceil(rd * 2.0 + 3.0);
  gl_Position = vec4(dx / u_size.x * 2.0 - 1.0, 1.0 - dy / u_size.y * 2.0, 0.0, 1.0);
  gl_PointSize = size;
  v_col = vec4(col * 0.9, 0.9) * u_w; v_r = rd; v_half = size * 0.5; v_square = r < 1.75 ? 1.0 : 0.0;
}`;
  const GL_FS = `
precision mediump float;
varying vec4 v_col; varying float v_r; varying float v_half; varying float v_square;
void main() {
  vec2 d = (gl_PointCoord - 0.5) * (v_half * 2.0);
  float cov = v_square > 0.5 ? clamp(v_r - max(abs(d.x), abs(d.y)) + 0.5, 0.0, 1.0) : clamp(v_r - length(d) + 0.5, 0.0, 1.0);
  gl_FragColor = v_col * cov;
}`;
  let gl = null, glKind = null, glProg = null, glLoc = null, glIdx = null, glLost = false, field2d = null, glError = null, glLoseExt = null, pfGL = null, sqGL = null;
  const glYears = new Map();   // year -> { pos, n, a, f, rv, cls, count }
  const useGL = () => !!gl && !glLost && !!pfGL && !!sqGL;   // the field on the GPU needs the pixel field's float targets and the Cells view's square pass too; without them the field, the dots and the squares take the 2D path
  function glInit() {
    pfGL = null; sqGL = null;
    if (new URLSearchParams(location.search).get('__nogl') === '1') return false;
    const opts = { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' };
    const g = fieldC.getContext('webgl2', opts), kind = 'webgl2';
    if (!g) { glError = 'no WebGL2 context'; return false; }
    glError = null;
    const sh = (type, src) => { const s = g.createShader(type); g.shaderSource(s, src); g.compileShader(s); if (!g.getShaderParameter(s, g.COMPILE_STATUS)) { glError = 'shader: ' + g.getShaderInfoLog(s); console.error(glError); return null; } return s; };
    const vs = sh(g.VERTEX_SHADER, GL_VS), fs = sh(g.FRAGMENT_SHADER, GL_FS); if (!vs || !fs) return false;
    const p = g.createProgram(); g.attachShader(p, vs); g.attachShader(p, fs); g.linkProgram(p);
    if (!g.getProgramParameter(p, g.LINK_STATUS)) { glError = 'link: ' + g.getProgramInfoLog(p); console.error(glError); return false; }
    const pf = PixelField.createGL(g); if (!pf.ok) { glError = 'pixel field: ' + pf.reason; return false; }
    const sq = PixelField.createSquaresGL(g); if (!sq.ok) { glError = 'squares: ' + sq.reason; return false; }
    gl = g; glKind = kind; glProg = p; pfGL = pf; sqGL = sq; glIdx = g.createBuffer(); glLoseExt = glLoseExt || g.getExtension('WEBGL_lose_context');   // kept from a live context: a lost one returns no extensions
    glLoc = { pos: g.getAttribLocation(p, 'a_pos'), n: g.getAttribLocation(p, 'a_n'), cls: g.getAttribLocation(p, 'a_cls') };
    for (const u of ['u_shift', 'u_off', 'u_kk', 'u_size', 'u_sc', 'u_rule', 'u_which', 'u_pal', 'u_w']) glLoc[u] = g.getUniformLocation(p, u);
    g.disable(g.DEPTH_TEST); g.enable(g.BLEND); g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA);
    return true;
  }
  function glUpload(y, d) {
    if (!useGL() || glYears.has(y)) return;
    const n = d.n, pos = new Float32Array(2 * n), cls = new Uint8Array(4 * n);   // four class bytes per vertex: the share class, the revenue class, the industry class, one spare (round 9)
    for (let i = 0; i < n; i++) { pos[2 * i] = d.x[i] - GL_R[0]; pos[2 * i + 1] = d.y[i] - GL_R[1]; cls[4 * i] = d.share[i]; cls[4 * i + 1] = d.cls[i]; cls[4 * i + 2] = d.indCls[i]; }
    const mk = (data) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); return b; };
    glYears.set(y, { pos: mk(pos), n: mk(d.nn), a: mk(d.a), f: mk(d.f), rv: mk(d.rv), cls: mk(cls), count: n });   // a, f and the revenue code feed the pixel field (round 14)
  }
  function glFree(y) { const b = glYears.get(y); if (!b || !gl) return; for (const k of ['pos', 'n', 'a', 'f', 'rv', 'cls']) gl.deleteBuffer(b[k]); glYears.delete(y); }
  function glPalette(L) { const pal = L === 'share' ? theme.ramp6 : L === 'fin' ? [theme.zero].concat(theme.div6) : L === 'industry' ? [theme.neutral].concat(theme.ind9) : [theme.neutral]; const out = new Float32Array(48); for (let i = 0; i < 16; i++) { const c = hex2rgb(pal[Math.min(i, pal.length - 1)]); out[3 * i] = c[0] / 255; out[3 * i + 1] = c[1] / 255; out[3 * i + 2] = c[2] / 255; } return out; }
  // The discs at weight w (the dots' crossfade), from the index of the discs in view, largest first.
  function glDiscs(c, buf, L, idx, w) {
    const W = fieldC.width, Hh = fieldC.height, sc = stage.scale, kk = c.k / 1000 * sc;
    const camx = c.cx * 1000, camy = c.cy * 1000, Cx = Math.round(camx), Cy = Math.round(camy);
    gl.viewport(0, 0, W, Hh); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.useProgram(glProg);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.pos); gl.enableVertexAttribArray(glLoc.pos); gl.vertexAttribPointer(glLoc.pos, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.n); gl.enableVertexAttribArray(glLoc.n); gl.vertexAttribPointer(glLoc.n, 1, gl.UNSIGNED_SHORT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.cls); gl.enableVertexAttribArray(glLoc.cls); gl.vertexAttribPointer(glLoc.cls, 4, gl.UNSIGNED_BYTE, false, 0, 0);
    gl.uniform2f(glLoc.u_shift, GL_R[0] - Cx, GL_R[1] - Cy);   // a_pos + u_shift = (X - R) + (R - C) = X - C, exact integers
    gl.uniform2f(glLoc.u_off, c.ox * sc + (Cx - camx) * kk, c.oy * sc - (Cy - camy) * kk);
    gl.uniform1f(glLoc.u_kk, kk); gl.uniform2f(glLoc.u_size, W, Hh); gl.uniform1f(glLoc.u_sc, sc);
    const rule = markRule(c.k); gl.uniform4f(glLoc.u_rule, rule[0], rule[1], rule[2], rule[3]);
    gl.uniform1f(glLoc.u_which, L === 'share' ? 0 : L === 'fin' ? 1 : L === 'industry' ? 2 : 3); gl.uniform3fv(glLoc.u_pal, glPalette(L)); gl.uniform1f(glLoc.u_w, w);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, glIdx); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.DYNAMIC_DRAW); gl.drawElements(gl.POINTS, idx.length, gl.UNSIGNED_INT, 0);
    gl.disableVertexAttribArray(glLoc.pos); gl.disableVertexAttribArray(glLoc.n); gl.disableVertexAttribArray(glLoc.cls);
  }
  const glEvents = [];
  fieldC.addEventListener('webglcontextlost', e => { e.preventDefault(); glEvents.push('lost'); glLost = true; glYears.clear(); pixPrevKey = ''; ensureField2d(); drawMap(); });
  fieldC.addEventListener('webglcontextrestored', () => { glEvents.push('restored'); if (glInit()) { glLost = false; if (field2d) field2d.canvas.hidden = true; layersDirty(); drawMap(); } else glEvents.push('init failed: ' + glError); });
  glInit();
  // The 2D path: the same field into its own transparent canvas.
  function ensureField2d() {
    if (field2d) { field2d.canvas.hidden = false; return field2d; }
    const cv = document.createElement('canvas'); cv.id = 'field2d'; cv.setAttribute('aria-hidden', 'true'); fieldC.insertAdjacentElement('afterend', cv);
    cv.width = fieldC.width; cv.height = fieldC.height; cv.style.width = stage.width + 'px'; cv.style.height = stage.height + 'px';
    field2d = { canvas: cv, ctx: cv.getContext('2d'), cells: document.createElement('canvas'), prev: document.createElement('canvas') };
    return field2d;
  }
  function discs2d(f, c, d, L, idx, w) {
    const ctx2 = f.ctx, rule = markRule(c.k); ctx2.save(); ctx2.setTransform(stage.scale, 0, 0, stage.scale, 0, 0);
    ctx2.globalAlpha = 0.9 * w;
    for (let j = 0; j < idx.length; j++) { const i = idx[j]; const r = markRadius(rule, d.nn[i]), [px, py] = Motion.project(c, d.x[i] / 1000, d.y[i] / 1000); ctx2.fillStyle = firmColour(L, firmClass(d, i, L)); ctx2.beginPath(); if (r < 1.75) ctx2.rect(px - r, py - r, 2 * r, 2 * r); else ctx2.arc(px, py, r, 0, Math.PI * 2); ctx2.fill(); }
    ctx2.restore();
  }
  // The discs' order: the largest first, by a counting sort on the radius in tenths of a pixel, over the x-band and the y-range.
  function discOrder(c, d, i0, i1) {
    const k = c.k, rule = markRule(k), pad = markRadius(rule, 65535) / k * 1000 + 500;
    const ym0 = (c.cy - (stage.height - c.oy) / k) * 1000 - pad, ym1 = (c.cy + c.oy / k) * 1000 + pad;
    const buckets = []; let count = 0;
    for (let i = i0; i < i1; i++) { const yv = d.y[i]; if (yv < ym0 || yv > ym1) continue; const r10 = Math.round(markRadius(rule, d.nn[i]) * 10); (buckets[r10] || (buckets[r10] = [])).push(i); count++; }
    const idx = new Uint32Array(count); let j = 0; for (let r10 = buckets.length - 1; r10 >= 0; r10--) if (buckets[r10]) for (const i of buckets[r10]) idx[j++] = i;
    return idx;
  }
  // The pixel field's parameters for a camera: the cells (CSS px), the layer code and breaks, the palette with alphas (index = class), the backdrop.
  function pixelPalette(L) {
    const code = PixelField.layerCode(L), pal = new Float32Array(48), al = new Float32Array(16);
    for (let i = 0; i < 16; i++) {
      let hex = theme.neutral, a = 1; const j = Math.max(0, i - 1);
      if (code === 0) hex = theme.ramp6[Math.min(5, j)]; else if (code === 1) hex = theme.div6[Math.min(5, j)]; else if (code === 2) hex = theme.ind9[Math.min(8, j)];
      else { hex = theme.density; a = MM.countAlpha[Math.min(7, j)] / PixelField.LAYER_ALPHA; }   // the cell layers: the density colour at the count alphas (the compose multiplies by the layer's alpha)
      const c = hex2rgb(hex); pal[3 * i] = c[0] / 255; pal[3 * i + 1] = c[1] / 255; pal[3 * i + 2] = c[2] / 255; al[i] = a;
    }
    return { pal, alpha: al };
  }
  function pixelParams(c, L) {
    const kk = c.k / 1000, camx = c.cx * 1000, camy = c.cy * 1000, Cx = Math.round(camx), Cy = Math.round(camy), P = pixelPalette(L);
    return { W: stage.width, H: stage.height, dpr: stage.scale, shift: [GL_R[0] - Cx, GL_R[1] - Cy], off: [c.ox + (Cx - camx) * kk, c.oy - (Cy - camy) * kk], kk, code: PixelField.layerCode(L), breaks: YEAR_BREAKS, pal: P.pal, alpha: P.alpha, back: hex2rgb(theme.neutral).map(v => v / 255) };
  }
  const dotsAlphas = k => { const dk = dotsK(); let t = Motion.step(k, dk, 0.4 * dk, Motion.ease.linear); if (t > 0.999999) t = 1; return { pix: 1 - t, dots: t }; };
  // The year dissolve and the opening sweep (round 14, the author's decisions): the dissolve crossfades the previous year's pixel field into the new one over 0.25 s
  // (kept under reduced motion, a crossfade); the sweep, once per tab on the first opening of the Firms view at the country view, lets every field pixel and every
  // listed mark fade in as an invisible edge passes from west to east over 1.3 s; any input completes it, and it never runs under reduced motion.
  const DISSOLVE_MS = 250, SWEEP_MS = 1300;
  let fieldAnim = { dissolve: null, sweep: null, raf: 0 }, pixPrevKey = '', pixKey = '', pixDrawn = { cells: 0, engine: null, level: null, firms: 0 };
  const sweepX = () => { const s = fieldAnim.sweep; if (!s) return null; const u = Math.min(1, (performance.now() - s.t0) / SWEEP_MS); return { x: Motion.lerp(-s.feather, stage.width + s.feather, Motion.ease.inOutSine(u)), feather: s.feather, done: u >= 1 }; };
  const dissolveT = () => { const s = fieldAnim.dissolve; if (!s) return 1; const t = Math.min(1, (performance.now() - s.t0) / DISSOLVE_MS); return Motion.ease.inOutSine(t); };
  function fieldTick() {
    fieldAnim.raf = 0; const sw = sweepX(); if (sw && sw.done) fieldAnim.sweep = null; if (fieldAnim.dissolve && dissolveT() >= 1) fieldAnim.dissolve = null;
    if (state.mode !== 'firms') { fieldAnim.sweep = null; fieldAnim.dissolve = null; return; }
    drawFieldOnly(cam()); if (fieldAnim.sweep || sw) drawMarks(cam());
    if (fieldAnim.sweep || fieldAnim.dissolve) fieldAnim.raf = requestAnimationFrame(fieldTick);
  }
  function fieldAnimate() { if (!fieldAnim.raf) fieldAnim.raf = requestAnimationFrame(fieldTick); }
  function maybeSweep() {
    fieldAnim.sweepPending = false;
    if (reduceMotion() || state.mode !== 'firms' || state.cam.k > 1.5 * kFit()) return false;
    if (!firmYears.has(state.year)) { fieldAnim.sweepPending = true; return false; }   // the field arrives with the year's data: the sweep starts then
    try { if (sessionStorage.getItem('atlas-sweep')) return false; sessionStorage.setItem('atlas-sweep', '1'); } catch (e) { /* no storage: sweep once per load */ if (fieldAnim.swept) return false; }
    fieldAnim.swept = true; fieldAnim.sweep = { t0: performance.now(), feather: Math.max(60, stage.width * 0.12) }; fieldAnimate(); return true;
  }
  function endSweep() { if (!fieldAnim.sweep) return; fieldAnim.sweep = null; if (state.mode === 'firms') { drawFieldOnly(cam()); drawMarks(cam()); } }
  ['pointerdown', 'wheel', 'keydown', 'touchstart'].forEach(t => window.addEventListener(t, endSweep, { capture: true, passive: true }));
  // The 2D path's pixel field: the CPU engine's image at the cells' resolution, drawn scaled by the device ratio without smoothing.
  function pixel2d(f, c, d, L, i0, i1, keepPrev) {
    const P = pixelParams(c, L), view = { cx: c.cx, cy: c.cy, k: c.k, ox: c.ox, oy: c.oy, W: P.W, H: P.H };
    const S = PixelField.cpuSums(d, view, P.code, i0, i1, POW), C = PixelField.cpuClassify(S, P.code, P.breaks);
    const colourOf = cls => [P.pal[3 * cls] * 255, P.pal[3 * cls + 1] * 255, P.pal[3 * cls + 2] * 255, P.alpha[cls] * PixelField.LAYER_ALPHA];
    const pm = PixelField.cpuCompose(C, P.W, P.H, colourOf, P.back.map(v => v * 255)), img = new ImageData(P.W, P.H), px = img.data;
    for (let o = 0; o < pm.length; o += 4) { const a = pm[o + 3]; if (!a) continue; px[o] = pm[o] * 255 / a; px[o + 1] = pm[o + 1] * 255 / a; px[o + 2] = pm[o + 2] * 255 / a; px[o + 3] = a; }   // straight colour for putImageData
    if (keepPrev) { const t = f.prev; f.prev = f.cells; f.cells = t; }
    f.cells.width = P.W; f.cells.height = P.H; f.cells.getContext('2d').putImageData(img, 0, 0);
    let cells = 0; for (let o = 3; o < pm.length; o += 4) if (pm[o]) cells++; return cells;
  }
  function blit2dCells(f, w) {
    const ctx2 = f.ctx, W = f.canvas.width, H = f.canvas.height, t = dissolveT(), sw = sweepX();
    ctx2.save(); ctx2.setTransform(1, 0, 0, 1, 0, 0); ctx2.imageSmoothingEnabled = false;
    if (t < 1 && f.prev.width) { ctx2.globalAlpha = w * (1 - t); ctx2.drawImage(f.prev, 0, 0, f.prev.width * stage.scale, f.prev.height * stage.scale); ctx2.globalCompositeOperation = 'lighter'; }
    ctx2.globalAlpha = w * t; ctx2.drawImage(f.cells, 0, 0, f.cells.width * stage.scale, f.cells.height * stage.scale);
    ctx2.globalCompositeOperation = 'source-over';
    if (sw) { const g = ctx2.createLinearGradient((sw.x - sw.feather) * stage.scale, 0, sw.x * stage.scale, 0); g.addColorStop(0, '#000'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx2.globalCompositeOperation = 'destination-in'; ctx2.globalAlpha = 1; ctx2.fillStyle = g; ctx2.fillRect(0, 0, W, H); ctx2.globalCompositeOperation = 'source-over'; }
    ctx2.restore();
  }
  // ---- the address files' 1 km squares (round 13, the author's request of 25 October 2026; the Cells view's from round 14) -----------------------------------------
  // A year's addresses binned on a 1 km grid at the km plane's origin. Per square: n firms, p coordinate pairs, a with a statement, f filers with a class, the revenue
  // by industry class (each address's revenue split by its mix shares) and the filers by revenue-change class; each square's addresses are grouped, so its mix and
  // leader read its own addresses only. The population is the address file's: firms on no list at house- and street-level geocodes (the Cells view's other grids
  // count every located eligible firm); the legend says so. Round 13 drew these squares, with a 25 km level, in the Firms view; round 14 moved them to the Cells
  // view, on the GPU, or without WebGL2 on the map canvas: squares of 6 px and more filled per frame inside the view (the bins sorted by column, the x-band found by
  // a binary search), smaller ones rendered once into a bitmap of the view with a margin of its own size, redrawn when the view leaves it or the zoom drifts past
  // 40 percent.
  const MOSAIC_DOTS_K = 20, MOSAIC_LEVELS = [1];
  const dotsK = () => Math.min(MOSAIC_DOTS_K, minSide() / 20 / 1.4);   // the hand-over to the dots starts at k 20 and runs over a 1.4 x band (20 to 28), or lower on a map whose fine rung (the 250 m preset, minSide / 20) lies under 28, so that preset always shows the dots (a 400 px phone: 13.1 to 18.3)
  const binKey = (bx, by) => (bx + 20000) * 40000 + (by + 20000);
  const mosaicCache = new Map(), mosaicBitmaps = new Map(); let mosaicBuilds = 0, mosaicBitmapBuilds = 0, mosaicState = { level: null, mode: null, drawn: 0 }, mosaicOff = false;
  function mosaicBins(y, T) {
    const key = y + '|' + T; if (mosaicCache.has(key)) return mosaicCache.get(key);
    const d = firmYears.get(y); if (!d) return null; const N = d.nn.length, Tm = T * 1000, idx = new Map(), bxA = [], byA = [], binOf = new Uint32Array(N); let count = 0;
    for (let i = 0; i < N; i++) { const bx = Math.floor(d.x[i] / Tm), by = Math.floor(d.y[i] / Tm), kk = binKey(bx, by); let j = idx.get(kk); if (j === undefined) { j = count++; idx.set(kk, j); bxA.push(bx); byA.push(by); } binOf[i] = j; }   // each address's bin kept, so the second pass needs no lookup (round 14)
    const n = new Uint32Array(count), p = new Uint32Array(count), a = new Uint32Array(count), f = new Uint32Array(count), rev = new Float64Array(count), cls9 = new Float32Array(count * 9), fin6 = new Uint32Array(count * 6), MK = d.mixInd.length;
    for (let i = 0; i < N; i++) { const j = binOf[i]; n[j] += d.nn[i]; p[j]++; a[j] += d.a[i]; f[j] += d.f[i];
      if (d.cls[i]) fin6[j * 6 + d.cls[i] - 1] += d.f[i];
      if (d.rv[i]) { const r = Math.pow(10, (d.rv[i] - 1) / 100); rev[j] += r; for (let m = 0; m < MK; m++) { const ind = d.mixInd[m][i]; if (ind === 255) break; cls9[j * 9 + (IND_CLASS[ind] || 9) - 1] += r * d.mixSh[m][i] / 100; } } }
    const bx = Int32Array.from(bxA), by = Int32Array.from(byA), ord = new Uint32Array(count); for (let j = 0; j < count; j++) ord[j] = j; ord.sort((u, v) => bx[u] - bx[v]);
    const bxSorted = new Int32Array(count); for (let q = 0; q < count; q++) bxSorted[q] = bx[ord[q]];
    let sumN = 0; for (let j = 0; j < count; j++) sumN += n[j];
    const start = new Uint32Array(count + 1); for (let j = 0; j < count; j++) start[j + 1] = start[j] + p[j];   // each bin's addresses grouped (a counting sort), so a square's mix and leader read its own addresses only (round 14)
    const members = new Uint32Array(N), fill = start.slice(0, count); for (let i = 0; i < N; i++) members[fill[binOf[i]]++] = i;
    const bins = { T, count, idx, bx, by, n, p, a, f, rev, cls9, fin6, ord, bxSorted, sumN, start, members, stats: new Map() }; mosaicCache.set(key, bins); mosaicBuilds++; return bins;
  }
  function mosaicClass(b, j, L) {   // the square's class on the layer: 'below' and 'zero' as the Cells view uses them, 'count' for the layers without a firm-level statistic
    if (L === 'share') { if (b.T >= 25) return classOfShare(b.n[j], b.a[j], YEAR_BREAKS); if (b.n[j] < 50) return 'below'; const sh = 100 * b.a[j] / b.n[j]; let c = 0; while (c < FINE_BREAKS.length && sh >= FINE_BREAKS[c]) c++; return c; }
    if (L === 'industry') { let best = -1, bv = 0; for (let c = 0; c < 9; c++) { const v = b.cls9[j * 9 + c]; if (v > bv) { bv = v; best = c; } } return best < 0 ? 'below' : best + 1; }
    if (L === 'fin') { let tot = 0; for (let c = 0; c < 6; c++) tot += b.fin6[j * 6 + c]; if (!tot) return 'zero'; let acc = 0; for (let c = 0; c < 6; c++) { acc += b.fin6[j * 6 + c]; if (acc * 2 >= tot) return c + 1; } return 6; }
    return 'count';
  }
  const mosaicColour = (L, cl, T) => (cl === 'below' ? theme.below : cl === 'zero' ? theme.zero : cl === 'count' ? theme.density : L === 'share' ? (T >= 25 ? theme.ramp6[cl] : theme.ramp5[cl]) : L === 'industry' ? theme.ind9[cl - 1] : theme.div6[cl - 1]);
  const mosaicAlphaOf = (cl, n) => (cl === 'below' ? 0.5 : cl === 'zero' ? 0.7 : cl === 'count' ? MM.countAlpha[MM.countClass(n)] : 1);
  function mosaicGroups(b, L, T, x0, x1, y0, y1, gapOn) {   // the squares inside a km rectangle as one path per colour class
    const gap = gapOn ? T * 0.12 : 0, s = T - gap, h = gap / 2, bx0 = Math.floor(x0 / T) - 1, bx1 = Math.floor(x1 / T) + 1, by0 = Math.floor(y0 / T) - 1, by1 = Math.floor(y1 / T) + 1;
    const j0 = lowerBound(b.bxSorted, bx0), j1 = lowerBound(b.bxSorted, bx1 + 1), groups = new Map(); let drawn = 0;
    for (let q = j0; q < j1; q++) { const j = b.ord[q], by = b.by[j]; if (by < by0 || by > by1) continue; const cl = mosaicClass(b, j, L), key = cl === 'count' ? 'c' + MM.countClass(b.n[j]) : cl; let g = groups.get(key); if (!g) { g = { path: new Path2D(), cl, n: b.n[j] }; groups.set(key, g); } g.path.rect(b.bx[j] * T + h, by * T + h, s, s); drawn++; }
    return { groups, drawn };
  }
  function mosaicBitmap(c, b, L, T) {
    const k = c.k, key = [T, state.year, L, theme.dark].join('|'), old = mosaicBitmaps.get(key);
    const vx0 = c.cx - c.ox / k, vx1 = c.cx + (stage.width - c.ox) / k, vy0 = c.cy - (stage.height - c.oy) / k, vy1 = c.cy + c.oy / k;
    if (old && old.k / k > 0.6 && old.k / k < 1.7 && vx0 >= old.x0 && vx1 <= old.x1 && vy0 >= old.y0 && vy1 <= old.y1) return old;
    const mx = vx1 - vx0, my = vy1 - vy0, x0 = vx0 - mx / 2, x1 = vx1 + mx / 2, y0 = vy0 - my / 2, y1 = vy1 + my / 2;   // half a view of margin each side: a 2,000 px map stays under the 4,096 px cap, so the blit is 1:1 (round 13, the cost rule at 2,000 px)
    const sc = Math.min(k * (stage.scale || 1), 4096 / (x1 - x0), 4096 / (y1 - y0)), W = Math.ceil((x1 - x0) * sc), H = Math.ceil((y1 - y0) * sc);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d'), st = { width: W, height: H, scale: 1, base() { g.setTransform(1, 0, 0, 1, 0, 0); } }, camB = { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, k: sc, ox: W / 2, oy: H / 2 };
    const { groups, drawn } = mosaicGroups(b, L, T, x0, x1, y0, y1, T * sc >= 5);
    Motion.camTransform(g, st, camB); for (const gr of groups.values()) { g.fillStyle = mosaicColour(L, gr.cl, T); g.globalAlpha = mosaicAlphaOf(gr.cl, gr.n); g.fill(gr.path); } st.base();
    const out = { cv, cam: camB, W, H, x0, y0, x1, y1, k, drawn }; mosaicBitmaps.set(key, out); mosaicBitmapBuilds++; if (mosaicBitmaps.size > 4) mosaicBitmaps.delete(mosaicBitmaps.keys().next().value); return out;
  }
  const mosaicPathCache = new Map();   // the 25 km level's paths per year, layer and gap state: camera-independent, so built once and filled per frame
  function drawMosaicLevel(c, b, L, T, alpha) {
    const k = c.k, px = T * k;
    if (px >= 6 || b.count <= 20000) {
      const vx0 = c.cx - c.ox / k, vx1 = c.cx + (stage.width - c.ox) / k, vy0 = c.cy - (stage.height - c.oy) / k, vy1 = c.cy + c.oy / k, gapOn = px >= 5;
      let groups, drawn; if (b.count <= 20000) { const key = [state.year, T, L, gapOn ? 1 : 0].join('|'); let g = mosaicPathCache.get(key); if (!g) { g = mosaicGroups(b, L, T, -1e9, 1e9, -1e9, 1e9, gapOn); mosaicPathCache.set(key, g); if (mosaicPathCache.size > 6) mosaicPathCache.delete(mosaicPathCache.keys().next().value); } groups = g.groups; drawn = g.drawn; }
      else ({ groups, drawn } = mosaicGroups(b, L, T, vx0, vx1, vy0, vy1, gapOn));
      Motion.camTransform(mctx, stage, c); for (const g of groups.values()) { mctx.fillStyle = mosaicColour(L, g.cl, T); mctx.globalAlpha = alpha * mosaicAlphaOf(g.cl, g.n); mctx.fill(g.path); } mctx.globalAlpha = 1; stage.base();
      mosaicState = { level: T, mode: 'direct', drawn };
    } else { const bm = mosaicBitmap(c, b, L, T); drawKmBitmapClipped(bm, alpha); mosaicState = { level: T, mode: 'bitmap', drawn: bm.drawn }; }
  }
  function drawKmBitmapClipped(b, alpha) {   // the part of a km bitmap under the view, drawn through the nine-argument drawImage, so a frame costs the view's area and not the bitmap's
    const c = cam(), f = c.k / b.cam.k, vx0 = c.cx - c.ox / c.k, vx1 = c.cx + (stage.width - c.ox) / c.k, vy0 = c.cy - (stage.height - c.oy) / c.k, vy1 = c.cy + c.oy / c.k;
    const sx = Math.max(0, Math.floor((vx0 - (b.cam.cx - b.W / 2 / b.cam.k)) * b.cam.k) - 2), sy = Math.max(0, Math.floor(((b.cam.cy + b.H / 2 / b.cam.k) - vy1) * b.cam.k) - 2);
    const sw = Math.min(b.W - sx, Math.ceil((vx1 - vx0) * b.cam.k) + 4), sh = Math.min(b.H - sy, Math.ceil((vy1 - vy0) * b.cam.k) + 4); if (sw <= 0 || sh <= 0) return;
    const [px, py] = Motion.project(c, b.cam.cx - b.W / 2 / b.cam.k + sx / b.cam.k, b.cam.cy + b.H / 2 / b.cam.k - sy / b.cam.k);
    const dpr = stage.scale || 1, exact = Math.abs(f * dpr - 1) < 1e-6;   // the bitmap at the device's resolution: a copy without filtering, aligned to device pixels (at most half a pixel of shift); a zoom in flight filters
    mctx.save(); stage.base(); mctx.globalAlpha *= alpha; mctx.imageSmoothingEnabled = !exact; mctx.drawImage(b.cv, sx, sy, sw, sh, exact ? Math.round(px * dpr) / dpr : px, exact ? Math.round(py * dpr) / dpr : py, sw * f, sh * f); mctx.restore();
  }
  function binDivisions(b, j, d) {   // the square's revenue by division from its own addresses, computed once per square and kept with the bins (round 14: the hover had rescanned the whole column of addresses on every pointer move)
    let s = b.stats.get(j); if (s) return s;
    const acc = new Map(); let tot = 0;
    for (let q = b.start[j]; q < b.start[j + 1]; q++) { const i = b.members[q]; if (!d.rv[i]) continue; const r = POW[d.rv[i]]; tot += r; for (let m = 0; m < d.mixInd.length; m++) { const ind = d.mixInd[m][i]; if (ind === 255) break; acc.set(ind, (acc.get(ind) || 0) + r * d.mixSh[m][i] / 100); } }
    s = { acc, tot }; b.stats.set(j, s); if (b.stats.size > 512) b.stats.delete(b.stats.keys().next().value); return s;
  }
  function binMix(b, j, d) {   // the square's divisions by revenue share, the top eight and the rest (the mix box)
    const { acc, tot } = binDivisions(b, j, d);
    if (!tot) return { rows: [], other: 0 }; const rows = [...acc].sort((u, v) => v[1] - u[1]).slice(0, 8).map(([code, v]) => ({ code, share: Math.round(100 * v / tot) })); return { rows, other: Math.max(0, 100 - rows.reduce((t, r) => t + r.share, 0)) };
  }
  function binLeader(b, j, d) {   // the division with the largest revenue inside the square and its share, from the addresses inside it (on hover only)
    const { acc, tot } = binDivisions(b, j, d);
    if (!tot) return null; let div = -1, bv = 0; for (const [ind, v] of acc) if (v > bv) { bv = v; div = ind; } return { div, share: Math.round(100 * bv / tot) };
  }
  let fieldCamKey = '';   // the camera the field canvas was last drawn at (a year still loading keeps the old field only while the camera stays)
  function drawFirms(c, fieldNew = true) {   // fieldNew false: the field canvas keeps its frame (round 14)
    const y = state.year, d = firmYears.get(y), camKey = [c.cx, c.cy, c.k, stage.width, stage.height, stage.scale].join('|');
    if (!d) {
      firmStatus = `Loading ${y} addresses…`; if (!(fieldAnim.dissolve && camKey === fieldCamKey)) { clearField(); fieldCamKey = ''; }   // a year change keeps the old year's field until the new one arrives and dissolves into it
      ensureYear(y).then(() => { if (state.mode === 'firms' && state.year === y) { firmStatus = null; if (fieldAnim.sweepPending) maybeSweep(); drawMap(); countFirmsInView(); refreshHover(); prefetchYears(y); } })
        .catch(e => { console.error(e); firmStatus = `Addresses for ${y} could not be loaded (${e.message}).`; if (state.mode === 'firms' && state.year === y) drawLegend(); });
      return;
    }
    firmStatus = null;
    if (!fieldNew) return;
    fieldC.style.opacity = ''; if (field2d) field2d.canvas.style.opacity = '';
    drawFieldOnly(c); fieldCamKey = camKey;
  }
  // The field canvas from the year's addresses: the pixel field at weight 1 - dots, recomposed when the view, the year, the layer or the theme changed, then the
  // discs at weight dots; the dissolve and the sweep only redraw the copy (fieldTick).
  function drawFieldOnly(c) {
    const y = state.year, d = firmYears.get(y), L = state.layer; if (!d) return;
    const k = c.k, A = dotsAlphas(k), key = [y, L, theme.dark, c.cx, c.cy, c.k, stage.width, stage.height, stage.scale, useGL() ? 1 : 0].join('|');
    const m = 2 / k, p0 = lowerBound(d.x, (c.cx - c.ox / k - m) * 1000), p1 = lowerBound(d.x, (c.cx + (stage.width - c.ox) / k + m) * 1000);   // the pixel field's x-band, two cells of margin
    let idx = null; if (A.dots > 0) { const pad = markRadius(markRule(k), 65535) / k * 1000 + 1000; idx = discOrder(c, d, lowerBound(d.x, (c.cx - c.ox / k) * 1000 - pad), lowerBound(d.x, (c.cx + (stage.width - c.ox) / k) * 1000 + pad)); }
    if (fieldAnim.dissolve && fieldAnim.dissolve.t0 == null && !(A.pix > 0)) fieldAnim.dissolve = null;   // nothing to dissolve at the dots zoom
    const fresh = key !== pixKey, keepPrev = fresh && !!fieldAnim.dissolve && fieldAnim.dissolve.t0 == null && pixKey !== '';
    if (fieldAnim.dissolve && fresh && !keepPrev && fieldAnim.dissolve.t0 != null) fieldAnim.dissolve = null;   // a camera move completes the dissolve
    if (useGL()) {
      if (field2d) field2d.canvas.hidden = true;
      glUpload(y, d); const buf = glYears.get(y); if (!buf) return;
      gl.viewport(0, 0, fieldC.width, fieldC.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      if (A.pix > 0) { const P = pixelParams(c, L); if (fresh) { pfGL.compose(buf, p0, p1, P, keepPrev); pixKey = key; } const sw = sweepX(); pfGL.blit(fieldC.width, fieldC.height, P, A.pix, dissolveT(), sw ? sw.x : null, sw ? sw.feather : 1); }
      else if (fresh) pixKey = '';
      if (idx) glDiscs(c, glYears.get(y), L, idx, A.dots);
    } else {
      const f = ensureField2d(); f.ctx.setTransform(1, 0, 0, 1, 0, 0); f.ctx.clearRect(0, 0, f.canvas.width, f.canvas.height);
      if (A.pix > 0) { if (fresh) { pixDrawn.cells = pixel2d(f, c, d, L, p0, p1, keepPrev); pixKey = key; } blit2dCells(f, A.pix); }
      else if (fresh) pixKey = '';
      if (idx) discs2d(f, c, d, L, idx, A.dots);
    }
    if (keepPrev) { fieldAnim.dissolve.t0 = performance.now(); fieldAnimate(); }
    pixDrawn = { cells: pixDrawn.cells, engine: useGL() ? 'webgl2' : '2d', pix: A.pix, dots: A.dots, level: A.dots >= 1 ? 'dots' : A.pix >= 1 ? 'pixel' : 'both' };
  }
  // The neighbouring years load in idle time once a year is shown (the cache holds three), so the slider's next step need not wait for the download.
  function prefetchYears(y) { if (state.mode !== 'firms') return; for (const yy of [y + 1, y - 1]) if (FM && FM.files[yy] && !firmYears.has(yy)) onIdle(() => { if (state.mode === 'firms' && Math.abs(state.year - yy) === 1) ensureYear(yy).catch(() => {}); }); }
  // Listed firms on the marks layer, above the field (25 October 2026): before its listing year a firm keeps its ordinary
  // mark in the layer's colour for its own state and carries a thin red rim (membership visible from the first frame);
  // from its listing year it is red, solid with a statement and a ring without one. Undated members are red from 2014
  // and never rimmed or pulsed. The marks' size, halo, opacity and rim follow MM.listedRule by zoom (25 October 2026):
  // quietest at the national view, as drawn before at the street zoom. On a forward year change the firms newly red bloom
  // once as in the video: over 1.2 s the mark swells by at least 2.5 px and back while two rings expand from it, the red one
  // to r + 2 + Rmax(k) with an eased decay and a pale trailing one at 0.7 of its radius; backward changes and the cells view
  // show nothing. The pulse button beside the year slider replays the bloom for the firms
  // listed in the shown year; under prefers-reduced-motion a pulse is a still highlight held for the same 1.8 s.
  const PULSE_MS = 1800, DECAY_MS = 1600;   // a bloom lasts 1.8 s: each firm's 1.6 s decay plus the largest stagger (round 9; 1.2 s in round 8, 0.9 s before)
  let pulse = null, pulseRaf = 0, pulseTimer = 0;
  const pulseDelay = new Float32Array(TRN.n);   // each firm's start delay in the running pulse (ms), filled once per pulse: the west-to-east stagger (round 9)
  function makePulse(mask) {   // delays 0 to spreadMs from the westernmost to the easternmost pulsing mark inside the view and its margin
    const c = cam(), k = c.k, LR = MM.listedRule(markRule(k), k, kFit()), ox = c.ox - c.cx * k, oy = c.oy + c.cy * k, W = stage.width + MARK_MARGIN, H = stage.height + MARK_MARGIN, yi = state.year - 2014;
    let x0 = Infinity, x1 = -Infinity;
    for (let i = 0; i < TRN.n; i++) { if (!mask[i] || TRN.filed[i][yi] === '-') continue; const px = ox + TRN.x[i] * k, py = oy - TRN.y[i] * k; if (px < -MARK_MARGIN || px > W || py < -MARK_MARGIN || py > H) continue; if (TRN.x[i] < x0) x0 = TRN.x[i]; if (TRN.x[i] > x1) x1 = TRN.x[i]; }
    const span = x1 > x0 ? x1 - x0 : 0;
    for (let i = 0; i < TRN.n; i++) pulseDelay[i] = mask[i] && span ? LR.spreadMs * Motion.clamp((TRN.x[i] - x0) / span, 0, 1) : 0;
  }
  const setLive = on => $('yearrow').classList.toggle('live', !!on);   // the context layer's live marker while a pulse runs (round 9)
  function endPulse() { if (pulseRaf) cancelAnimationFrame(pulseRaf); pulseRaf = 0; if (pulseTimer) clearTimeout(pulseTimer); pulseTimer = 0; pulse = null; setLive(false); }
  function beginPulse(mask, count) {
    endPulse();
    makePulse(mask); pulse = { t0: performance.now(), mask, count, static: reduceMotion(), at: null }; setLive(true);
    if (pulse.static) { if (state.mode === 'firms') drawMarks(cam()); pulseTimer = setTimeout(() => { pulseTimer = 0; pulse = null; setLive(false); if (state.mode === 'firms') drawMarks(cam()); }, PULSE_MS); }
    else pulseRaf = requestAnimationFrame(pulseTick);
  }
  function startPulse(yPrev, yNew) {   // the automatic pulse: the firms newly red on a forward year change
    if (yNew === yPrev) return;
    endPulse();   // any change of year ends a running pulse; a backward one starts none
    if (!TRN || yNew < yPrev) return;
    const mask = new Uint8Array(TRN.n), yi = yNew - 2014; let any = 0;
    for (let i = 0; i < TRN.n; i++) if (TRN.red_from[i] > yPrev && TRN.red_from[i] <= yNew && TRN.filed[i][yi] !== '-') { mask[i] = 1; any++; }
    if (any) beginPulse(mask, any);
  }
  function pulseTick() { pulseRaf = 0; if (!pulse) return; if (performance.now() - pulse.t0 >= PULSE_MS) pulse = null; if (state.mode === 'firms') drawMarks(cam()); if (pulse) pulseRaf = requestAnimationFrame(pulseTick); }
  const manualMasks = new Map();   // per year: the dated firms listed that year and present in it (undated firms never pulse)
  function manualMask(y) {
    if (!manualMasks.has(y)) { const mask = new Uint8Array(TRN ? TRN.n : 0), yi = y - 2014; let count = 0; if (TRN) for (let i = 0; i < TRN.n; i++) if (TRN.red_from[i] === y && !TRN.undated[i] && TRN.filed[i][yi] !== '-') { mask[i] = 1; count++; } manualMasks.set(y, { mask, count }); }
    return manualMasks.get(y);
  }
  function replayPulse() { if (state.mode !== 'firms') return cellsPulse(); if (!FIRMS_OK) return 0; const m = manualMask(state.year); if (!m.count) return 0; beginPulse(m.mask, m.count); return m.count; }
  function syncPulseButton() {
    const b = $('pulse'); if (!b) return;
    const show = state.mode === 'firms' ? FIRMS_OK : !!TRN && CELL_PULSE_LAYERS.has(state.layer), y = state.year, count = show ? manualMask(y).count : 0;   // the Cells view's share and industry layers too (round 14)
    b.hidden = !show; b.disabled = !count;
    const label = !count ? `No firm on these lists was listed in ${y}` : state.mode === 'firms' ? `Replay the bloom of the firms listed in ${y}` : `Pulse the cells holding a firm listed in ${y}`; b.title = label; b.setAttribute('aria-label', label);
  }
  // ---- the Cells view's squares and pulse (round 14, the author's decisions of 25 October 2026) ---------------------------------------------------------------------
  // The 1 km squares from the address files everywhere, and the 2021 250 m windows, on the field canvas above the 100 km and 25 km cells: one instanced quad per square
  // (js/pixel-field.js), coloured as round 13's squares and the windows' cells were (the share classes on the windows' breaks in the five-step ramp, the industry
  // classes, the density colour at the count alphas, the grey under 50 firms on the share layer). While the 250 m cells come in, the 1 km squares fade to a quarter
  // outside the window and out inside it (the hand-over of round 10). Without WebGL2 the same squares draw on the map canvas (drawCellsSquares2d).
  const SQ_BELOW = 15, SQ_BELOW_FINE = 14;   // the palette's grey entries: the squares' 0.5 and the windows' 0.55, as the canvas drew them
  function squaresPalette(L) {
    const pal = new Float32Array(48), al = new Float32Array(16).fill(1), put = (i, hex, a) => { const c = hex2rgb(hex); pal[3 * i] = c[0] / 255; pal[3 * i + 1] = c[1] / 255; pal[3 * i + 2] = c[2] / 255; al[i] = a; };
    if (L === 'share') theme.ramp5.forEach((h, i) => put(i, h, 1)); else if (L === 'industry') theme.ind9.forEach((h, i) => put(i + 1, h, 1)); else MM.countAlpha.forEach((a, i) => put(i, theme.density, a));
    put(SQ_BELOW, theme.below, 0.5); put(SQ_BELOW_FINE, theme.below, 0.55); return { pal, al };
  }
  function microSet(y, L) {   // the year's squares as grid indices and palette indices, uploaded once per year and layer
    const key = 'm|' + y + '|' + L; if (sqGL.sets.has(key)) return sqGL.sets.get(key);
    const b = mosaicCache.get(y + '|1'); if (!b) return null;
    const pos = new Float32Array(2 * b.count), cls = new Uint8Array(b.count);
    for (let j = 0; j < b.count; j++) { pos[2 * j] = b.bx[j]; pos[2 * j + 1] = b.by[j]; const cl = mosaicClass(b, j, L); cls[j] = cl === 'below' ? SQ_BELOW : cl === 'count' ? MM.countClass(b.n[j]) : cl; }
    return sqGL.upload(key, pos, cls);
  }
  function windowSet(label, L) {   // a 2021 250 m window's cells: the share classes as buildDensityPaths draws them (50 firms and a known count), or the count classes
    const key = 'w|' + label + '|' + L; if (sqGL.sets.has(key)) return sqGL.sets.get(key);
    const d = win025[label].d, pos = new Float32Array(2 * d.count), cls = new Uint8Array(d.count);
    for (let i = 0; i < d.count; i++) { pos[2 * i] = d.ix[i]; pos[2 * i + 1] = d.iy[i]; let cl = MM.countClass(d.n[i]); if (L === 'share') { cl = SQ_BELOW_FINE; if (d.a[i] >= 0 && d.n[i] >= 50) { const sh = 100 * d.a[i] / d.n[i]; cl = 0; while (cl < FINE_BREAKS.length && sh >= FINE_BREAKS[cl]) cl++; } } cls[i] = cl; }
    return sqGL.upload(key, pos, cls);
  }
  let cellsDrawn = { engine: null, micro: 0, fine: 0 };   // the last Cells draw's squares (the audit reads it)
  const fineWindow = c => { if (!(fineA(c.k) > 0)) return null; const near = nearestCity(c).city.label; return win025[near] ? { label: near, w: win025[near] } : null; };
  function drawCellsField(c) {
    const L = state.layer, on = MICRO_LAYERS.has(L), y = microYear(), am = on ? microA(c.k, y) : 0, af = on ? fineA(c.k) : 0, fw = af > 0 ? fineWindow(c) : null;
    cellsDrawn = { engine: useGL() ? 'webgl2' : '2d', micro: am, fine: fw ? af : 0 };
    if (field2d) field2d.canvas.hidden = true;
    if (!useGL()) return;   // the 2D path draws the squares on the map canvas
    gl.viewport(0, 0, fieldC.width, fieldC.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    if (!(am > 0) && !fw) return;
    const P = squaresPalette(L), q = { cam: c, dpr: stage.scale, canvas: [fieldC.width, fieldC.height], pal: P.pal, al: P.al };
    if (am > 0) { const sset = microSet(y, L), o = fw ? fw.w.d.origin : null; if (sset) { sqGL.draw(sset, Object.assign({}, q, { origin: [0, 0], T: 1, gap: c.k >= 5 ? 0.12 : 0, w: am, win: o ? [o[0] - c.cx, o[1] - c.cy, o[0] + 24 - c.cx, o[1] + 24 - c.cy] : null, winIn: 1 - af, winOut: 1 - 0.75 * af })); drawLog.push('squares'); } }
    if (fw) { sqGL.draw(windowSet(fw.label, L), Object.assign({}, q, { origin: fw.w.d.origin, T: 0.25, gap: 0.025, w: af })); drawLog.push('fine'); }
  }
  function drawCellsSquares2d(c) {   // the 2D path: round 13's drawing of the squares and the windows' paths, on the map canvas after the cells
    if (useGL() || !MICRO_LAYERS.has(state.layer)) return;
    const L = state.layer, y = microYear(), am = microA(c.k, y), af = fineA(c.k), fw = af > 0 ? fineWindow(c) : null;
    if (am > 0) { const b = mosaicCache.get(y + '|1'); drawAround(c, fw ? winRect(fw.w.d, 24) : null, fw ? af : 0, a => drawMosaicLevel(c, b, L, 1, am * a), false); drawLog.push('squares'); }
    if (fw) { if (L === 'share') MM.drawDensityShares(mctx, stage, c, fw.w.paths, theme.ramp5, theme.below, af); else MM.drawDensityCounts(mctx, stage, c, fw.w.paths, theme.density, af); drawLog.push('fine'); }
  }
  function drawCellsMarks(c) {   // the Cells view's marks canvas: the ghost names and the city labels above the squares, the pulse rings between them (the Firms view's order)
    clearMarks(); kctx.setTransform(stage.scale, 0, 0, stage.scale, 0, 0);
    drawGhostNames(kctx, c, 'marks'); drawLog.push('ghost');
    if (cellPulse) cellPulseRings(c);
    if (found) foundRings(kctx, c);
    drawLabels(kctx, c, 'marks');
  }
  // The Cells view's pulse (round 14): the button pulses every cell at the shown level that holds a firm listed in the shown year (dated and present that year;
  // undated firms never pulse), with the Firms view's two rings at the cell's centre and its west-to-east stagger over the cells in view; under reduced motion
  // the still highlight for the same 1.8 s. The automatic pulse on a forward year change stays in the Firms view.
  const CELL_PULSE_LAYERS = new Set(['share', 'industry']);
  let cellPulse = null, cellPulseRaf = 0, cellPulseTimer = 0;
  function endCellPulse() { if (cellPulseRaf) cancelAnimationFrame(cellPulseRaf); cellPulseRaf = 0; if (cellPulseTimer) clearTimeout(cellPulseTimer); cellPulseTimer = 0; if (cellPulse) { cellPulse = null; setLive(false); } }
  function cellGridAt(x, y, c) {   // the grid the hover reads at a point: a 2021 250 m window, the 1 km squares, the 25 km cells, the 100 km cells
    const fw = fineA(c.k) >= 0.5 ? fineWindow(c) : null;
    if (fw) { const o = fw.w.d.origin; if (x >= o[0] && x < o[0] + 24 && y >= o[1] && y < o[1] + 24) return { g: 0.25, o }; }
    if (microA(c.k, microYear()) >= 0.5) return { g: 1, o: [0, 0] };
    if (alpha25(c.k) >= 0.5 && ((state.layer === 'share' && c25[state.year]) || (state.layer === 'industry' && ind25[state.year]))) return { g: G25, o: [0, 0] };
    return { g: 100, o: [0, 0] };
  }
  function cellsPulse() {
    endCellPulse(); if (!TRN || !CELL_PULSE_LAYERS.has(state.layer)) return 0;
    const m = manualMask(state.year); if (!m.count) return 0;
    const c = cam(), k = c.k, LR = MM.listedRule(markRule(k), k, kFit()), seen = new Map();
    for (let i = 0; i < TRN.n; i++) { if (!m.mask[i]) continue; const x = TRN.x[i], y = TRN.y[i], G = cellGridAt(x, y, c), jx = Math.floor((x - G.o[0]) / G.g), jy = Math.floor((y - G.o[1]) / G.g), key = G.g + ':' + jx + ':' + jy; if (!seen.has(key)) seen.set(key, { x: G.o[0] + (jx + 0.5) * G.g, y: G.o[1] + (jy + 0.5) * G.g, delay: 0 }); }
    const cells = [...seen.values()], ox = c.ox - c.cx * k, oy = c.oy + c.cy * k; let x0 = Infinity, x1 = -Infinity;
    for (const q of cells) { const px = ox + q.x * k, py = oy - q.y * k; if (px < -MARK_MARGIN || px > stage.width + MARK_MARGIN || py < -MARK_MARGIN || py > stage.height + MARK_MARGIN) continue; if (q.x < x0) x0 = q.x; if (q.x > x1) x1 = q.x; }
    const span = x1 > x0 ? x1 - x0 : 0; for (const q of cells) q.delay = span ? LR.spreadMs * Motion.clamp((q.x - x0) / span, 0, 1) : 0;
    cellPulse = { t0: performance.now(), cells, count: cells.length, static: reduceMotion(), at: null }; setLive(true);
    if (cellPulse.static) cellPulseTimer = setTimeout(() => { cellPulseTimer = 0; cellPulse = null; setLive(false); if (state.mode !== 'firms') drawCellsMarks(cam()); }, PULSE_MS);
    else cellPulseRaf = requestAnimationFrame(cellPulseTick);
    drawCellsMarks(c); return cells.length;
  }
  function cellPulseTick() { cellPulseRaf = 0; if (!cellPulse) return; if (performance.now() - cellPulse.t0 >= PULSE_MS) { cellPulse = null; setLive(false); } if (state.mode !== 'firms') drawCellsMarks(cam()); if (cellPulse) cellPulseRaf = requestAnimationFrame(cellPulseTick); }
  function cellPulseRings(c) {
    const P = cellPulse, k = c.k, LR = MM.listedRule(markRule(k), k, kFit()), r = MM.listedRadius(LR, 1), t = P.at != null ? P.at : performance.now() - P.t0, ox = c.ox - c.cx * k, oy = c.oy + c.cy * k;
    for (const q of P.cells) {
      const px = ox + q.x * k, py = oy - q.y * k; if (px < -MARK_MARGIN || px > stage.width + MARK_MARGIN || py < -MARK_MARGIN || py > stage.height + MARK_MARGIN) continue;
      if (P.static) { MM.pulseRing(kctx, px, py, r, LR, 1, theme, true); continue; }
      MM.pulsePhase((t - q.delay) / 1000, PH); if (PH.on && PH.p > 0 && PH.p < 1) MM.pulseRing(kctx, px, py, r, LR, PH.p, theme, false);
    }
  }
  const MARK_MARGIN = 80;   // CSS px beyond the view inside which marks are drawn: the street zoom's flash and ring reach 72.6 px (round 9)
  const PH = { on: false, swell: 0, release: 0, grow: 0, glowA: 0, p: 0 };   // the bloom phase of the mark being drawn, reused (no allocation per frame)
  // The listed marks and the bloom (round 9): while a pulse runs, pass 0 lays the pale glows of the pulsing marks under
  // everything and pass 1 draws the marks and their rings; each pulsing firm runs its own clock, started by its stagger delay.
  function drawMarks(c) {
    clearMarks(); kctx.setTransform(stage.scale, 0, 0, stage.scale, 0, 0);
    const year = state.year, yi = year - 2014, k = c.k, LR = MM.listedRule(markRule(k), k, kFit()), L = state.layer, now = performance.now();
    const st = !!(pulse && pulse.static), tNow = pulse ? (pulse.at != null ? pulse.at : now - pulse.t0) : 0;
    const ox = c.ox - c.cx * k, oy = c.oy + c.cy * k, W = stage.width + MARK_MARGIN, H = stage.height + MARK_MARGIN;
    for (let pass = pulse && !st ? 0 : 1; pass < 2; pass++) for (let i = 0; i < TRN.n; i++) {
      const ch = TRN.filed[i][yi]; if (ch === '-') continue;
      const pulsing = !!(pulse && pulse.mask[i]); if (pass === 0 && !pulsing) continue;
      const px = ox + TRN.x[i] * k, py = oy - TRN.y[i] * k; if (px < -MARK_MARGIN || px > W || py < -MARK_MARGIN || py > H) continue;
      const r = MM.listedRadius(LR, TRN.pile[i]);
      if (pulsing) { if (st) { PH.on = true; PH.swell = 0.6; PH.release = 3 / 7; PH.grow = 1; PH.glowA = 0; PH.p = 1; } else MM.pulsePhase((tNow - pulseDelay[i]) / 1000, PH); }
      if (pass === 0) { if (PH.on && PH.glowA > 0.01) MM.glowDisc(kctx, px, py, 2 * (r + MM.flashPeak(r) * PH.swell), PH.glowA, theme); continue; }
      const fade = pulsing && PH.on ? 1 - PH.grow : 1;   // the ordinary fill and rim fade as the bloom grows; a firm whose stagger has not started is still rimmed
      if (TRN.red_from[i] > year || (pulsing && fade > 0.001)) {
        const sc = TRN.state[i][yi], col = L === 'fin' && sc >= '1' && sc <= '6' ? theme.div6[+sc - 1] : L === 'share' ? theme.ramp6[ch === '1' ? 5 : 0] : theme.neutral;
        MM.rimmedMark(kctx, px, py, r, col, 0.9 * fade, LR.rimA * fade, theme, LR.rimW);
      }
      if (TRN.red_from[i] <= year) {
        if (pulsing) {
          if (!PH.on) continue;   // before its own start the firm shows its rimmed mark only
          const rr = r + MM.flashPeak(r) * PH.swell, core = PH.release < 1 ? MM.coreAt(ch === '1' ? theme.coreRed : theme.coreLand, PH.release) : null;
          const tt = st ? 0 : Motion.clamp((tNow - pulseDelay[i]) / DECAY_MS, 0, 1);
          MM.listedMark(kctx, px, py, rr, ch === '1' ? 1 : 0, PH.grow * (1 - (1 - LR.alpha) * tt), theme, LR.halo, core, LR);
        } else MM.listedMark(kctx, px, py, r, ch === '1' ? 1 : 0, LR.alpha, theme, LR.halo, null, LR);
      }
    }
    { const sw = sweepX(); if (sw) { kctx.save(); kctx.setTransform(stage.scale, 0, 0, stage.scale, 0, 0); const g = kctx.createLinearGradient(sw.x - sw.feather, 0, sw.x, 0); g.addColorStop(0, '#000'); g.addColorStop(1, 'rgba(0,0,0,0)'); kctx.globalCompositeOperation = 'destination-in'; kctx.fillStyle = g; kctx.fillRect(0, 0, stage.width, stage.height); kctx.restore(); } }   // the opening sweep: the listed marks fade in with the field (round 14); the names and labels below are drawn whole
    drawGhostNames(kctx, c, 'marks'); drawLog.push('ghost');   // the floating names above the field and the marks (round 12, part D)
    if (pulse) for (let i = 0; i < TRN.n; i++) {   // the pulse rings above the names: the same geometry as the marks pass, rings only, while a pulse runs
      if (!pulse.mask[i] || TRN.red_from[i] > year) continue; const ch = TRN.filed[i][yi]; if (ch === '-') continue;
      const px = ox + TRN.x[i] * k, py = oy - TRN.y[i] * k; if (px < -MARK_MARGIN || px > W || py < -MARK_MARGIN || py > H) continue;
      const r = MM.listedRadius(LR, TRN.pile[i]); if (st) { PH.on = true; PH.p = 1; } else MM.pulsePhase((tNow - pulseDelay[i]) / 1000, PH); if (!PH.on) continue;
      if (st || (PH.p > 0 && PH.p < 1)) MM.pulseRing(kctx, px, py, r, LR, PH.p, theme, st);
    }
    if (found) foundRings(kctx, c);   // the firm found by name (round 14)
    drawLabels(kctx, c, 'marks');
  }
  // Hover in firms mode: the nearest address within its mark radius plus 2 px, found through the sorted x column, and the
  // listed firms at the cursor (within their mark radius plus 2 px, at least 6 px; a listed mark wins over an address):
  // counts, and for listed firms their list-file names (25 October 2026).
  const LISTED_HIT = 6;   // the listed marks' hit radius floor in CSS px (25 October 2026): a red dot is hovered within 6 px, and it wins over an address mark
  function firmAt(km) {
    const c = cam(), k = c.k, rule = markRule(k), LR = MM.listedRule(rule, k, kFit()), yi = state.year - 2014;
    const out = { kind: 'none', region: regionAt(km.px, km.py), kmx: km.x, kmy: km.y, ix: Math.floor(km.x / 100), iy: Math.floor(km.y / 100), grid: 100 };
    const d = firmYears.get(state.year);
    if (d && k < dotsK()) {   // the pixel drawn under the cursor (round 14): the owner of the block that covers the cursor's cell, by the drawing's own rule
      const px = pixelAt(km, d); if (px) Object.assign(out, px);
    } else if (d) {
      const Rpx = markRadius(rule, 65535) + 2, Rm = Rpx / k * 1000, xm = km.x * 1000, ym = km.y * 1000;
      const i0 = lowerBound(d.x, xm - Rm), i1 = lowerBound(d.x, xm + Rm); let best = -1, bd = Infinity, br = 0;
      for (let i = i0; i < i1; i++) {
        const dy = d.y[i] - ym; if (dy > Rm || dy < -Rm) continue;
        const [px, py] = Motion.project(c, d.x[i] / 1000, d.y[i] / 1000), r = markRadius(rule, d.nn[i]) + 2, dist = Math.hypot(px - km.px, py - km.py);
        if (dist <= r && dist < bd) { bd = dist; best = i; br = r; }
      }
      if (best >= 0) { const [px, py] = Motion.project(c, d.x[best] / 1000, d.y[best] / 1000); Object.assign(out, { kind: 'firm', rec: best, n: d.nn[best], a: d.a[best], f: d.f[best], cls: d.cls[best], ind: d.ind ? d.ind[best] : null, ish: d.ish ? d.ish[best] : 0, px, py, r: br - 2 }); }
    }
    let ln = 0, lred = 0, lring = 0, lrim = 0, rimA = Infinity, rimB = 0, lpx = 0, lpy = 0, lr = 0, ld = Infinity;
    const top = [-1, -1, -1], topKey = [Infinity, Infinity, Infinity];   // the three listed firms shown by name: red first, then by listing year, then by distance
    const ox = c.ox - c.cx * k, oy = c.oy + c.cy * k;
    for (let i = 0; i < TRN.n; i++) {
      const ch = TRN.filed[i][yi]; if (ch === '-') continue;
      const px = ox + TRN.x[i] * k, py = oy - TRN.y[i] * k, r = MM.listedRadius(LR, TRN.pile[i]), hit = Math.max(r + 2, LISTED_HIT), dist = Math.hypot(px - km.px, py - km.py);
      if (dist > hit) continue;
      const red = TRN.red_from[i] <= state.year;
      ln++; if (red) { lred++; if (ch === '0') lring++; } else { lrim++; const yf = TRN.red_from[i]; if (yf < rimA) rimA = yf; if (yf > rimB) rimB = yf; }
      if (dist < ld) { ld = dist; lpx = px; lpy = py; lr = r; }
      const key = (i === findPin ? -1e9 : 0) + (red ? 0 : 1e6) + TRN.red_from[i] * 100 + Math.min(99, dist);   // the firm found by name first (round 14)
      for (let s = 0; s < 3; s++) if (key < topKey[s]) { for (let q = 2; q > s; q--) { top[q] = top[q - 1]; topKey[q] = topKey[q - 1]; } top[s] = i; topKey[s] = key; break; }
    }
    if (ln) {
      out.listed = { n: ln, red: lred, ring: lring, rim: lrim, rim_from: lrim ? rimA : null, rim_to: lrim ? rimB : null, within_km: k < 20 ? Math.max(MM.listedRadius(LR, 1) + 2, LISTED_HIT) / k : 0, top: top.filter(i => i >= 0) };
      if (out.kind === 'firm') out.address = { rec: out.rec, n: out.n, a: out.a, f: out.f, cls: out.cls, ind: out.ind, ish: out.ish, px: out.px, py: out.py, r: out.r };   // the address under the same cursor keeps its line and its panel row
      if (out.kind === 'pixel') out.pixel = { cell: out.cell, camKey: out.camKey, kmPx: out.kmPx, n: out.n, p: out.p, a: out.a, f: out.f, cls: out.cls, lead: out.lead, mix: out.mix, size: out.size };   // the pixel likewise (round 14)
      Object.assign(out, { kind: 'listed', px: lpx, py: lpy, r: lr });   // a listed mark wins the tie
    }
    return out;
  }
  // The pixel at the cursor (round 14): the cells of a 5 by 5 window around the cursor's cell summed and classified by the field's own CPU rule, the winner of the
  // cursor's cell found as the drawing finds it, and that cell's coordinate pairs summed for the tile, the panel and the mix box.
  function pixelAt(km, d) {
    const c = cam(), k = c.k, code = PixelField.layerCode(state.layer);
    const gx0 = Math.floor(c.ox + (km.x - c.cx) * k), gy0 = Math.floor(c.oy - (km.y - c.cy) * k);   // the cursor's cell (CSS px)
    const view = { cx: c.cx, cy: c.cy, k, ox: c.ox - (gx0 - 2), oy: c.oy - (gy0 - 2), W: 5, H: 5 };   // the cursor's cell at (2, 2); the margin reaches one cell further
    const i0 = lowerBound(d.x, (c.cx + (gx0 - 3 - c.ox) / k) * 1000), i1 = lowerBound(d.x, (c.cx + (gx0 + 4 - c.ox) / k) * 1000);
    const S = PixelField.cpuSums(d, view, code, i0, i1, POW), C = PixelField.cpuClassify(S, code, YEAR_BREAKS), w = PixelField.winnerAt(C, 2, 2);
    if (w.j < 0 && !w.back) return null;
    const j = w.j >= 0 ? w.j : 3 * S.W + 3, gx = gx0 - 3 + (j % S.W), gy = gy0 - 3 + Math.floor(j / S.W);   // the owner's cell, or the cursor's own cell where only the backdrop covers it
    const ax = c.ox - c.cx * k, ay = c.oy + c.cy * k, kk = k / 1000, acc = new Map(); let n = 0, a = 0, f = 0, p = 0, tot = 0;
    for (let i = i0; i < i1; i++) { if (Math.floor(ax + d.x[i] * kk) !== gx || Math.floor(ay - d.y[i] * kk) !== gy) continue; n += d.nn[i]; a += d.a[i]; f += d.f[i]; p++;
      if (d.rv[i]) { const r = POW[d.rv[i]]; tot += r; for (let m = 0; m < d.mixInd.length; m++) { const ind = d.mixInd[m][i]; if (ind === 255) break; acc.set(ind, (acc.get(ind) || 0) + r * d.mixSh[m][i] / 100); } } }
    if (!p) return null;
    const rows = tot ? [...acc].sort((u, v) => v[1] - u[1]).slice(0, 8).map(([code2, v]) => ({ code: code2, share: Math.round(100 * v / tot) })) : [];
    const size = w.j >= 0 ? w.size : 1, cxp = size === 2 ? gx + 1 : gx + 0.5, cyp = size === 2 ? gy + 1 : gy + 0.5;   // the block's centre: a 2 by 2 block runs right and down from its cell
    return { kind: 'pixel', cell: [gx, gy], camKey: [c.cx, c.cy, c.k].join(','), kmPx: 1 / k, n, p, a, f, cls: code === 1 && w.j >= 0 ? w.cls : null, lead: rows.length ? { div: rows[0].code, share: rows[0].share } : null,
             mix: { rows, other: rows.length ? Math.max(0, 100 - rows.reduce((t, r) => t + r.share, 0)) : 0 }, size, px: cxp, py: cyp, r: size / 2 };
  }
  const hitAt = km => (state.mode === 'firms' ? firmAt(km) : cellAt(km));
  const breakLabels = (breaks, m) => Array.from({ length: m }, (_, i) => i === 0 ? `< ${breaks[0]}%` : i === m - 1 ? `≥ ${breaks[i - 1]}%` : `${breaks[i - 1]}–${breaks[i]}%`);

  // The legend and the note (24 October 2026): a title row with a toggle and a body, collapsible; collapsed by default
  // on a narrow map (under 600 px) and remembered per viewer; written only when the text changes.
  // The cards' collapse toggles (the author's addition of 25 October): a toggle per card, the state remembered per viewer, a collapsed card's chart not drawn (its canvas has no size) and redrawn on opening.
  const CARDS = ['layer', 'goto', 'cursor', 'national', 'groups', 'odds'], cardUI = {};
  const cardOpen = id => (cardUI[id] ? cardUI[id] === 'open' : true);
  function applyCards() { for (const id of CARDS) { const sec = $('card-' + id), body = $('cb-' + id), t = $('ct-' + id), open = cardOpen(id); body.hidden = !open; sec.classList.toggle('collapsed', !open); t.setAttribute('aria-expanded', String(open)); t.setAttribute('aria-label', (open ? 'Collapse ' : 'Expand ') + $('h2-' + id).textContent.trim().toLowerCase()); } }
  function setCard(id, v) { cardUI[id] = v; applyCards(); if (v === 'open') { drawCellPanel(state.hover); drawNational(); drawGroups(); drawOdds(); } }
  function readPref(key) { try { const v = localStorage.getItem(key); return v === 'open' || v === 'closed' ? v : null; } catch (e) { return null; } }
  function writePref(key, v) { try { localStorage.setItem(key, v); } catch (e) { /* no storage */ } }
  const ui = { legend: readPref('atlas-legend'), note: readPref('atlas-note'), ctx: readPref('atlas-context'), legendRead: readPref('atlas-legend-read') };   // legendRead: 'open' shows the legend's reading side (round 14)
  CARDS.forEach(id => { cardUI[id] = readPref('atlas-card-' + id); $('ct-' + id).addEventListener('click', () => { const v = cardOpen(id) ? 'closed' : 'open'; writePref('atlas-card-' + id, v); setCard(id, v); }); }); applyCards();
  const legendOpen = () => (ui.legend ? ui.legend === 'open' : stage.width >= 600);
  // The note (round 10, the author's correction of 25 October): without a stored choice it starts collapsed at the national and regional zooms while the strip is open (the strip carries the fact)
  // and expanded inside a city window or when the strip is closed; a narrow map keeps it collapsed; the viewer's own toggle is remembered and wins.
  const noteDefault = () => { try { return !stripOpen() || bandUnderCameraOwn()[0] === 'city'; } catch (e) { return true; } };
  const noteOpen = () => (ui.note ? ui.note === 'open' : stage.width >= 600 && noteDefault());
  function syncNoteDefault() { if (ui.note) return; if ($('notebody').hidden === noteOpen()) applyPanels(); }
  function applyPanels() {
    dropObstacles();
    const lo = legendOpen(), no = noteOpen();
    $('legendbody').hidden = !lo; const lt = $('legendtoggle'); lt.setAttribute('aria-expanded', String(lo)); lt.setAttribute('aria-label', lo ? 'Collapse the legend' : 'Expand the legend');
    { const has = lo && lastLegend.read, on = has && ui.legendRead === 'open', b = $('legendinfo'), label = on ? 'Show the legend’s key' : 'Show how to read the legend'; $('legend').classList.toggle('reading', on); b.hidden = !has; b.setAttribute('aria-pressed', String(on)); b.setAttribute('aria-label', label); b.title = label; }   // the legend's two sides (round 14)
    $('notebody').hidden = !no; $('notelabel').hidden = no; const nt = $('notetoggle'); nt.setAttribute('aria-expanded', String(no)); nt.setAttribute('aria-label', no ? 'Collapse the note' : 'Expand the note');
  }
  // On a narrow map (under 600 px) one panel is open at a time: opening the legend closes the note and the reverse.
  const narrow = () => stage.width < 600;
  const tight = () => narrow() || stage.height < 640;   // a map too narrow or too short for the mix box and the legend together (round 9)
  function setLegend(v) { ui.legend = v; if (v === 'open' && narrow()) ui.note = 'closed'; if (v === 'open' && tight() && mixOpen()) { mixUI.open = 'closed'; applyMix(); } applyPanels(); }
  function setNote(v) { ui.note = v; if (v === 'open' && narrow()) ui.legend = 'closed'; applyPanels(); }
  $('legendtoggle').addEventListener('click', () => { const v = legendOpen() ? 'closed' : 'open'; writePref('atlas-legend', v); setLegend(v); });
  $('legendinfo').addEventListener('click', () => { ui.legendRead = ui.legendRead === 'open' ? 'closed' : 'open'; writePref('atlas-legend-read', ui.legendRead); applyPanels(); if (state.hover && !hoverQueued) { hoverQueued = true; queueMicrotask(() => { hoverQueued = false; refreshHover(); }); } });   // the reading side and back (round 14); a showing tile is re-placed against the box's new height
  $('notetoggle').addEventListener('click', () => { const v = noteOpen() ? 'closed' : 'open'; writePref('atlas-note', v); setNote(v); });
  // ---- the revenue mix box (round 9, the author's correction of 25 October 2026) --------------------------------------------
  // A translucent box at the top left of the map on the industry layer: the revenue mix of what the cursor is over (the
  // 100 km, 25 km or 1 km cell in the cells view, the coordinate pair in the firms view), one row per division present by
  // share descending, each with its class colour (fixed per division, never by rank), the division's name and its share of
  // that unit's revenue, at most eight rows then "other divisions"; with the cursor off the map, the mix of the view.
  // Collapsible, remembered per viewer; on a narrow map it opens below the note and is collapsed by default.
  const mixUI = { open: readPref('atlas-mix'), key: '' };
  const mixOpen = () => (mixUI.open ? mixUI.open === 'open' : !tight());
  window.addEventListener('resize', () => requestAnimationFrame(() => { applyStrip(); applyMix(); }));   // after the canvases are re-sized: the narrow forms follow the map's width
  function placeMix() {
    const el = $('mixbox'), note = $('mapnote'); el.style.top = '12px'; if (el.hidden || note.hidden) return;
    const a = el.getBoundingClientRect(), b = note.getBoundingClientRect(), m = wrap.getBoundingClientRect();
    if (a.right + 8 > b.left && a.top < b.bottom) el.style.top = Math.round(b.bottom - m.top + 8) + 'px';
  }
  function applyMix() {
    const el = $('mixbox'), show = state.layer === 'industry' && !!IND_T; el.hidden = !show; wrap.classList.toggle('mix-on', show); dropObstacles(); if (!show) return;   // mix-on: the legend ends below the box's stub (round 10)
    const open = mixOpen(), t = $('mixtoggle'); el.classList.toggle('closed', !open); $('mixbody').hidden = !open;
    t.setAttribute('aria-expanded', String(open)); t.setAttribute('aria-label', open ? 'Collapse the revenue mix' : 'Expand the revenue mix');
    placeMix();
  }
  function openMix(v) { mixUI.open = v; if (v === 'open' && tight() && legendOpen()) { ui.legend = 'closed'; applyPanels(); } applyMix(); mixUI.key = ''; fillMixBox(state.hover); }
  $('mixtoggle').addEventListener('click', () => { const v = mixOpen() ? 'closed' : 'open'; writePref('atlas-mix', v); openMix(v); });
  function mixRowsFor(h) {   // the hovered unit's rows, or null for the view's
    if (!h) return null;
    if (h.micro) { if (h.j == null) return { rows: [], other: 0, unit: '1 km square at the cursor', empty: true }; const b = mosaicCache.get(h.yearShown + '|1'), d = firmYears.get(h.yearShown); if (!b || !d) return null; const mix = binMix(b, h.j, d); return { rows: mix.rows, other: mix.other, unit: '1 km square at the cursor', empty: !mix.rows.length }; }   // the 1 km square (round 14)
    { const pxh = h.kind === 'pixel' ? h : h.pixel; if (pxh) return { rows: pxh.mix.rows, other: pxh.mix.other, unit: 'pixel at the cursor', empty: !pxh.mix.rows.length }; }   // the pixel under the cursor (round 14)
    { const bn = h.kind === 'bin' ? h : h.bin; if (bn) { const d = firmYears.get(state.year), b = mosaicBins(state.year, bn.T); if (!d || !b) return null; const mix = binMix(b, bn.j, d); return { rows: mix.rows, other: mix.other, unit: `${bn.T} km square at the cursor`, empty: !mix.rows.length }; } }   // the square under the cursor (round 13)
    if (h.kind === 'firm' || h.kind === 'listed' || h.kind === 'none') {
      const ad = h.kind === 'firm' ? h : h.address; if (!ad || ad.rec == null) return null; const d = firmYears.get(state.year); if (!d || !d.mixInd) return null;
      const rows = []; let sum = 0; for (let k = 0; k < d.mk; k++) { const code = d.mixInd[k][ad.rec]; if (code === 255) break; const sh = d.mixSh[k][ad.rec]; sum += sh; rows.push({ code, share: sh }); }
      return { rows, other: Math.max(0, 100 - sum), unit: 'coordinate pair at the cursor', empty: !rows.length };
    }
    if (h.mix) return { rows: h.mix.map(m => ({ code: m.code, share: m.share })), other: h.rest, unit: `${h.fine ? '1 km' : h.grid === G25 ? '25 km' : '100 km'} cell at the cursor`, empty: h.dom === 255 || !h.mix.length };
    return null;
  }
  const mixColour = code => theme.ind9[(IND_CLASS[code] || 9) - 1];
  function fillMixBox(h) {
    const el = $('mixbox'); if (el.hidden || !mixOpen()) return;
    let m = mixRowsFor(h); if (!m) { computeViewMix(); m = viewMix.rows ? { rows: viewMix.rows, other: viewMix.other, unit: viewMix.unit, empty: !viewMix.rows.length } : null; }
    const key = `${state.year}|${m ? m.unit + '|' + m.rows.map(r => r.code + ':' + r.share).join(',') + '|' + m.other : 'none'}`;
    if (mixUI.key === key) return; mixUI.key = key;
    $('mixtitle').textContent = `Revenue mix, ${state.year}${state.year === 2025 ? '*' : ''}`; $('mixunit').textContent = m ? m.unit : '';
    $('mixrows').innerHTML = !m ? '<div class="r muted"><span class="nm">no data in view</span></div>' : m.empty ? '<div class="r muted"><span class="nm">no firm with a revenue value here</span></div>'
      : m.rows.map(r => `<div class="r"><span class="sw" style="background:${mixColour(r.code)}"></span><span class="nm" title="${esc(divLabel(r.code))}">${esc(divShort(r.code))}${r.code ? ` (${divPad(r.code)})` : ''}</span><span class="pc num">${r.share ? r.share + '%' : '<1%'}</span></div>`).join('')
        + (m.other > 0 ? `<div class="r muted"><span class="sw" style="background:transparent"></span><span class="nm">other divisions</span><span class="pc num">${m.other}%</span></div>` : '');
  }
  function syncMix() { applyMix(); mixUI.key = ''; fillMixBox(state.hover); }
  // ---- the context strip (round 9, 25 October 2026) ------------------------------------------------------------------------
  // One line along the bottom of the map: a fact about the region under the camera (the country, the registry region or the
  // city window, by zoom band and layer, from the loaded data: regions.json and the page's own totals) or, once in a while, a
  // tip on using the page (each once per session, never while the cursor moves, at least 12 s after the last fact change).
  // At the left the region's simplified outline, stroked on over 0.4 s when the region changes. Nothing external, no fetch.
  let obsCache = null;   // the tile's obstacle boxes (the panels), read once per layout and dropped when a panel is written, toggled or resized
  const dropObstacles = () => { obsCache = null; };
  const regIndex = new Map();   // region -> year -> row index of regions.json
  if (REG) for (let i = 0; i < REG.rows; i++) { let m = regIndex.get(REG.region[i]); if (!m) regIndex.set(REG.region[i], m = new Map()); m.set(REG.year[i], i); }
  const regRow = (name, y) => { const m = regIndex.get(name); return m && m.has(y) ? m.get(y) : null; };
  const citySums = {};   // label -> year -> {n, a} over the 1 km window's cells
  function citySum(label, y) { const d = cityYear[label] && cityYear[label][y] ? cityYear[label][y].d : null; if (!d) return null; citySums[label] = citySums[label] || {}; if (!citySums[label][y]) { let n = 0, a = 0; for (let i = 0; i < d.count; i++) { n += d.n[i]; if (d.a[i] > 0) a += d.a[i]; } citySums[label][y] = { n, a }; } return citySums[label][y]; }
  const stripState = { fact: null, tip: null, lastFactAt: 0, tipTimer: 0, tipEnd: 0, glyphName: null, cur: 'A', seen: new Set(), tickRaf: 0 };
  try { const v = JSON.parse(sessionStorage.getItem('atlas-tips') || '[]'); if (Array.isArray(v)) v.forEach(i => stripState.seen.add(+i)); } catch (e) { /* no storage */ }
  const stripOpen = () => (ui.ctx ? ui.ctx === 'open' : true);
  function applyStrip() { dropObstacles(); const open = stripOpen(), el = $('ctxstrip'), t = $('ctxtoggle'); el.classList.toggle('narrow', narrow()); wrap.classList.toggle('narrow', narrow()); el.classList.toggle('closed', !open); wrap.classList.toggle('strip-open', open); t.setAttribute('aria-expanded', String(open)); t.setAttribute('aria-label', open ? 'Collapse the context line' : 'Expand the context line'); }
  $('ctxtoggle').addEventListener('click', () => { const v = stripOpen() ? 'closed' : 'open'; writePref('atlas-context', v); ui.ctx = v; applyStrip(); syncNoteDefault(); if (v === 'open') updateContext(true); });
  const pts = (n, d) => `${fmt.signed(d)} points`;
  const shareOf = (a, n) => (n ? 100 * a / n : null);
  // The fact under the camera: {band, name, kind, text (HTML with the figures in .num spans), nums (the figures, for the tick)}
  function factFor(band, name, full) {   // full: the wire's lead item takes the full form whatever the map's width (round 10)
    const y = state.year, L = state.layer, ys = y + (y === 2025 ? '*' : ''), N = [], num = (v, f) => { N.push(v); return `<span class="num">${f}</span>`; };
    const nw = !full && narrow();   // the short forms: no change clause, no basis words
    const loc = s => `<span class="loc">${esc(s)}</span>`;   // the place name in tracked capitals (round 10)
    const sp = (f) => `<span class="num">${f}</span>`;   // the short forms (a second tier under the narrow ones): used only when the narrow text overflows the strip, measured once per fact change
    const shareLine = (label, n, a, n21, a21, what) => { const sh = shareOf(a, n), s21 = shareOf(a21, n21), Nf = [], nf = (v, f) => { Nf.push(v); return sp(f); }; let t = `${label}, ${ys}: ${nf(n, fmt.int(n))} ${nw ? 'firms' : what}, ${nf(sh, fmt.pct(sh))} with a statement`; if (!nw && y !== 2021 && s21 != null && sh != null) t += `, ${nf(sh - s21, pts(0, sh - s21))} against 2021`; return { text: t, nums: Nf, short: `${label}, ${ys}: ${sp(fmt.pct(sh))} with a statement`, shortNums: [sh] }; };
    if (band === 'city' && L === 'industry') { band = 'region'; name = regionAt(stage.width / 2, stage.height / 2) || name; }   // no window-level industry aggregate exists: the region's leading division (registered-in basis)
    if (band === 'city') {
      const cs = citySum(name, y), c21 = citySum(name, 2021);
      if (cs && cs.n) return Object.assign({ band, name, kind: 'city-' + L }, shareLine(nw ? loc(name) : `${loc(name)} window`, cs.n, cs.a, c21 ? c21.n : 0, c21 ? c21.a : 0, 'located firms in the 1 km cells'));
      band = 'region';   // no window figures: the region's fact
    }
    if (band === 'region' && !regIndex.has(name)) { band = 'national'; name = 'Russia'; }
    const i = REG ? regRow(name, y) : null, i21 = REG ? regRow(name, 2021) : null, nat = band === 'national';
    const n = i != null ? REG.n[i] : null, a = i != null ? REG.a[i] : null, n21 = i21 != null ? REG.n[i21] : 0, a21 = i21 != null ? REG.a[i21] : 0;
    const what = nat ? 'located firms' : 'firms registered in the region';
    if (state.mode === 'firms' && nat && FM && FM.by_year[y]) { const by = FM.by_year[y]; return { band, name, kind: 'firms', text: nw ? `${loc('Russia')}, ${ys}: ${num(by.firms, fmt.int(by.firms))} firms on no list (comparison group)` : `${loc('Russia')}, ${ys}: ${num(by.firms, fmt.int(by.firms))} firms on no list (comparison group) at ${num(by.addresses, fmt.int(by.addresses))} coordinate pairs; ${num(by.listed, fmt.int(by.listed))} on the lists (treated)`, nums: N, short: `${loc('Russia')}, ${ys}: ${sp(fmt.int(by.firms))} on no list (comparison group)`, shortNums: [by.firms] }; }
    if (i == null) { const t = totals[y]; if (t) return { band, name, kind: 'share-t', text: `${loc('Russia')}, ${ys}: ${num(t.located, fmt.int(t.located))} located firms, ${num(t.share, fmt.pct(t.share))} of eligible firms with a statement`, nums: N }; return { band, name, kind: 'none', text: '', nums: N }; }
    if (L === 'industry' && REG.d1[i] !== 255) { const d = REG.d1[i]; return { band, name, kind: 'industry', text: nw ? `${loc(name)}, ${ys}: ${esc(divShort(d))} (${divPad(d)}), ${num(REG.s1[i], REG.s1[i] + '%')} of revenue` : `${loc(name)}, ${ys}: ${esc(divShort(d))} (${divPad(d)}) leads with ${num(REG.s1[i], REG.s1[i] + '%')} of revenue`, nums: N, short: `${loc(name)}, ${ys}: ${esc(divShort(d))} (${divPad(d)}), ${sp(REG.s1[i] + '%')} of revenue`, shortNums: [REG.s1[i]] }; }   // the short label with its code, never the code alone (the author's rule of 25 October 2026)
    if (L === 'lists') return { band, name, kind: 'lists', text: nw ? `${loc(name)}, ${ys}: ${num(REG.listed[i], fmt.int(REG.listed[i]))} of ${num(n, fmt.int(n))} on the lists (treated)` : `${loc(name)}, ${ys}: ${num(REG.listed[i], fmt.int(REG.listed[i]))} ${nat ? 'located firms' : 'firms registered in the region'} on the five lists (treated) of ${num(n, fmt.int(n))}`, nums: N, short: `${loc(name)}, ${ys}: ${sp(fmt.int(REG.listed[i]))} on the lists (treated)`, shortNums: [REG.listed[i]] };
    if (L === 'change') { const i24 = regRow(name, 2024); if (i24 != null && i21 != null) { const s21 = shareOf(REG.a[i21], REG.n[i21]), s24 = shareOf(REG.a[i24], REG.n[i24]); return { band, name, kind: 'change', text: `${loc(name)}: ${num(s21, fmt.pct(s21))} with a statement in 2021, ${num(s24, fmt.pct(s24))} in 2024, ${num(s24 - s21, pts(0, s24 - s21))}`, nums: N, short: `${loc(name)}: ${sp(fmt.pct(s21))} in 2021, ${sp(fmt.pct(s24))} in 2024`, shortNums: [s21, s24] }; } }
    return Object.assign({ band, name, kind: 'share' }, shareLine(loc(name), n, a, n21, a21, what));
  }
  let hoverRegionName = null;   // the region under the cursor (round 10, G13b): the strip follows it below the city band and the overlay outlines it
  const REGION_FILL = { dark: 0.06, light: 0.04 };   // the hovered region's area in the cursor colour under every data layer (the author's request of 25 October 2026)
  function drawRegionFill(c) {   // right after the land, from the outline's cached path; the map redraws when the hovered region changes, never per pointer move
    if (!hoverRegionName || !regIndex.has(hoverRegionName)) return;
    mctx.save(); Motion.camTransform(mctx, stage, c); mctx.fillStyle = theme.cursor; mctx.globalAlpha = theme.dark ? REGION_FILL.dark : REGION_FILL.light; mctx.fill(regionPath(hoverRegionName), 'evenodd'); mctx.restore();   // the restore alone: drawBasemap strokes the graticule and the borders in km after this hook (a base() here redrew them in pixels on every hover, the glitch of 25 October)
  }
  const regionPaths = new Map();
  const regionPath = name => { if (!regionPaths.has(name)) regionPaths.set(name, MM.partsToPath(BM.lod0.parts.filter(p => p.name === name))); return regionPaths.get(name); };
  function bandUnderCamera() {
    const c = cam();
    if (hoverRegionName && regIndex.has(hoverRegionName) && !(c.k >= 1.5 && bandUnderCameraOwn()[0] === 'city')) return ['region', hoverRegionName];
    return bandUnderCameraOwn();
  }
  let bandOwnMemo = { key: '', v: null };   // the camera's own band, computed once per settled camera, year and layer (the note's default and the strip ask on every hover-driven region change)
  function bandUnderCameraOwn() {
    const c = cam(), key = c.cx + '|' + c.cy + '|' + c.k + '|' + state.year + '|' + state.layer; if (bandOwnMemo.key === key) return bandOwnMemo.v; const v = bandUnderCameraOwnCalc(c); bandOwnMemo = { key, v }; return v;
  }
  function bandUnderCameraOwnCalc(c) {
    if (c.k < 3 * kFit()) return ['national', 'Russia'];
    const near = nearestCity(c).city.label, w = win1[near] ? win1[near].d : null;
    if (c.k >= 1.5 && w && c.cx >= w.origin[0] && c.cx < w.origin[0] + 90 && c.cy >= w.origin[1] && c.cy < w.origin[1] + 90 && cityYear[near] && cityYear[near][state.year]) return ['city', near];
    const rn = regionAt(stage.width / 2, stage.height / 2);
    return rn && regIndex.has(rn) ? ['region', rn] : ['national', 'Russia'];
  }
  function updateContext(force) {
    syncNoteDefault();
    if (!stripOpen()) return;
    const [band, name] = bandUnderCamera(), f = factFor(band, name);
    const same = stripState.fact && stripState.fact.kind === f.kind && stripState.fact.name === f.name && (stripState.fact.full || stripState.fact.text) === f.text;
    if (same && !force) return;
    const prev = stripState.fact; stripState.fact = f; stripState.lastFactAt = performance.now();
    if (stripState.tip) endTip(false);
    const gname = band === 'national' ? 'Russia' : band === 'city' ? regionAt(stage.width / 2, stage.height / 2) || 'Russia' : name;
    f.slot = `<span class="loc">${esc(gname)}</span> · <span class="num">${state.year}${state.year === 2025 ? '*' : ''}</span>`;   // the slot's essentials (the author's request of 25 October 2026): the glyph's region and the slider's year; the full fact rides the wire as the set's first item
    setStripText(f, prev); setGlyph(gname);
    rebuildWire(band, name); scheduleTip();
  }
  function setStripText(f, prev) {   // crossfade the two stacked spans; when the previous fact had the same figures, the numbers count to the new values
    const ina = stripState.cur === 'A' ? $('ctxB') : $('ctxA'), out = stripState.cur === 'A' ? $('ctxA') : $('ctxB'); stripState.cur = stripState.cur === 'A' ? 'B' : 'A';
    const slotMode = wireScrolls() && f.kind !== 'tip' && !!f.slot;   // the scrolling wire's slot shows the essentials; the reduced-motion form shows the facts and tips themselves
    ina.innerHTML = slotMode ? f.slot : f.text; f.full = f.text; ina.classList.toggle('tip', f.kind === 'tip');   // a tip reads in tracked capitals (round 10)
    if (slotMode) sizeSlot(ina); else { $('ctxlead').style.width = ''; if (f.short && (ina.scrollWidth > ina.clientWidth + 1 || ina.scrollHeight > ina.clientHeight + 1)) { ina.innerHTML = f.short; f.text = f.short; f.nums = f.shortNums || []; } }   // one layout read per fact change, never per frame
    ina.classList.add('live'); ina.classList.remove('hid'); out.classList.add('hid'); out.classList.remove('live');
    if (stripState.tickRaf) { cancelAnimationFrame(stripState.tickRaf); stripState.tickRaf = 0; }
    if (!slotMode && prev && prev.kind === f.kind && prev.nums.length === f.nums.length && f.nums.length && !reduceMotion()) {   // the slot's year changes under the crossfade, never ticks (a ticking year would read as a count)
      const spans = ina.querySelectorAll('.num'), finals = [...spans].map(sp => sp.textContent), t0 = performance.now();
      const fmtLike = (final, v) => { const m = final.match(/^([+−-]?)([\d,]+)(\.(\d+))?(.*)$/); if (!m) return final; const dec = m[4] ? m[4].length : 0; const sign = m[1] === '−' || m[1] === '-' ? (v < 0 ? '−' : m[1] === '+' ? '+' : '') : (m[1] === '+' ? (v < 0 ? '−' : '+') : ''); return sign + fmt.int(Math.floor(Math.abs(v))).replace(/\.\d+$/, '') .replace(/^(\d)/, '$1') + (dec ? '.' + Math.abs(v).toFixed(dec).split('.')[1] : '') + m[5]; };
      const step = () => { stripState.tickRaf = 0; const u = Math.min(1, (performance.now() - t0) / 300), e = Motion.ease.outCubic(u); spans.forEach((sp, j) => { sp.textContent = u >= 1 ? finals[j] : fmtLike(finals[j], prev.nums[j] + (f.nums[j] - prev.nums[j]) * e); }); if (u < 1) stripState.tickRaf = requestAnimationFrame(step); };
      stripState.tickRaf = requestAnimationFrame(step);
    }
    setTimeout(() => { if (stripState.fact === f) ina.classList.remove('live'); }, 320);
  }
  // Tips on using the page, each once per session, shown only when the strip is open, nothing is moving, the cursor is still and 12 s have passed since the last fact change.
  const TIPS = [   // each at most 68 characters (round 12, part D: in tracked capitals the reduced-motion slot at 768 px holds 68, and a phone's two-line form holds 68 in sentence case); the two long round-9 tips split in two
    { text: 'A click on a cell flies to it: the city window from the country.', touch: 'Tap a cell for its values, double-tap to zoom, pinch to zoom.' },
    { text: 'From a city, a click flies to the 20 km scale, then steps of 2.5.', mouse: true },
    { text: 'In the Firms view a click climbs the same rungs, then steps of 4.', mouse: true, firms: true },
    { text: 'Shift+click steps the zoom out at the point.', mouse: true },
    { text: 'The pulse button by the year replays the bloom of its listed firms.', firms: true },
    { text: 'The Firms view draws every registered address by year.', firms: true },
    { text: 'Firms on the five lists (treated) turn red from their listing year.', firms: true },
    { text: 'Open the atlas at a city: add its name to the link, as in #Moscow.' },
    { text: 'Type a name under GO TO to fly to a firm on these lists.' },
    { text: 'The link button under GO TO copies a link to this exact view.' },
    { text: 'Map focused: + and − zoom, 0 fits the country, the arrows pan.', mouse: true },
  ];
  const units = h => h.replace(/(\d)\s(km|m)(?![A-Za-z])/g, '$1&nbsp;<span class="u">$2</span>');   // unit symbols keep their case inside tracked capitals (round 10)
  const coarse = () => window.matchMedia('(pointer: coarse)').matches;
  function nextTip() { for (let i = 0; i < TIPS.length; i++) { const t = TIPS[i]; if (stripState.seen.has(i)) continue; if (t.firms && !FIRMS_OK) continue; if (t.mouse && coarse()) continue; return [i, coarse() && t.touch ? t.touch : t.text]; } return null; }
  function scheduleTip() { if (stripState.tipTimer) clearTimeout(stripState.tipTimer); if (wireScrolls()) return; stripState.tipTimer = setTimeout(() => { stripState.tipTimer = 0; maybeTip(); }, 12000); }   // the scrolling wire carries its tips itself
  function maybeTip(force) {
    if (wireScrolls()) return force ? pinTip() : false;   // the wire: a forced tip pins the next tip item at the window's left edge (the audit's tip states)
    if (!stripOpen() || stripState.tip || (!force && (flight || press || pinch || !cursorStill || performance.now() - stripState.lastFactAt < 12000))) return false;
    const nt = nextTip(); if (!nt) return false;
    const [i, text] = nt; stripState.seen.add(i); try { sessionStorage.setItem('atlas-tips', JSON.stringify([...stripState.seen])); } catch (e) { /* no storage */ }
    stripState.tip = { i, text }; setStripText({ kind: 'tip', name: '', text: units(esc(text)), nums: [] }, null);
    stripState.tipEnd = setTimeout(() => endTip(true), 8000); return true;
  }
  function endTip(back) { if (stripState.tipEnd) { clearTimeout(stripState.tipEnd); stripState.tipEnd = 0; } stripState.tip = null; if (wireScrolls()) { unpinTip(); return; } if (back && stripState.fact) { setStripText(stripState.fact, null); scheduleTip(); } }
  // ---- the data wire (round 10, the author's item 14a) and the cat facts (item 15) -------------------------------------------------------------
  // A cycle is 50 items in two halves of 25: each half opens with the lead fact (the band's own fact), carries the data facts below in one order (the
  // second half reversed), five named listed firms that turned red that year at data slots 2, 6, 10, 14 and 18 (the halves taking alternate picks of the
  // ten, chosen at floor(i n / 10) over the names sorted), and a tip at every fifth slot; one slot keyed to the year and the region carries a cat fact
  // from data/offwire.json with the prefix in the muted context colour (never a tip slot, never beside a named firm; the fact advancing by seven each
  // loop). Every string is a template over named fields of the shipped data; tools/wire_check.py re-derives each one for the audit.
  const WIRE_SPEED = 60, WIRE_HALF = 25, WIRE_RM_MS = 8000, OFFWIRE = D.offwire || null;
  // Round 11 (the author's item 6): the track is a queue of cycles scrolled by one linear Web Animations entry at 60 px per second, so the scroll is continuous
  // across context changes. A change of region (hover or camera), layer or view appends the new context's cycle, the lead first, after the last item queued;
  // the old items run off the left edge; a further change before the queued set has entered the view replaces the queued set, never the visible one; the
  // queue tops itself up with the next cycle of the current context (the cat fact advancing by seven places) before it runs out and drops the sets that have
  // passed. Only a year change rebuilds at once, under a 0.3 s crossfade of the whole track. The tips and the cat slot keep their places in every cycle.
  // Round 12, part D: at most two sets exist at any time, the committed set playing on the track and one pending set. A change of region, layer or view replaces
  // the pending set, never the committed one, and the replaced set is dropped; a pending set is committed once the cursor has rested on its region for 600 ms or the
  // camera has settled there, and a later change then queues behind it. Priority: a tip or a cat fact due in the playing cycle plays before a pending set takes over
  // (the committed set keeps its items up to and including the first tip or cat past the visible ones; the rest go). The lead fact of the region under the cursor
  // shows at once in the strip's first slot, a fixed lead zone before the scrolling track, whatever the queue holds. The items of a superseded set that are still
  // crossing the view stay as orphans until they pass; nothing else is kept, so the track never grows and no timer outlives a change.
  const wireState = { cycle: [], key: '', cycleIndex: 0, width: 0, rmTimer: 0, rmIndex: 0, timer: 0, sets: [], orphans: [], x: 0, anim: null, animX0: 0, paused: false, pinned: false, restarts: 0, watchX: null, watchT: null, topTimer: 0, commitTimer: 0, changedAt: 0, vis: 0, builds: 0, resets: 0, commits: 0 };
  let WIRE_CAPS = true;   // the capitals experiment (round 12, part D): every wire item and the lead in tracked capitals, the cat facts and the firm names as they are
  const wireScrolls = () => !reduceMotion();
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const fnv = str => { let h = 2166136261; for (const b of new TextEncoder().encode(str)) { h ^= b; h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };
  const dateOf = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? `${+m[3]} ${MONTHS[+m[2] - 1]} ${m[1]}` : ''; };
  // Anniversaries (round 12, part D, item 6): the viewer's local date at load (window.__today, an ISO day, is the audit's hook); the sentence is built from the shipped dates
  // only: the anchor firm's listing date, the resident list's decree (Government Decree No. 35 of 22 January 2020, the one date typed in), and every other day on which
  // firms of the national list file were listed by a dated, non-inferred designation; null on every other day. tools/wire_check.py re-derives it for the audit.
  const TODAY = (() => { const o = window.__today; if (typeof o === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o)) return o; const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
  function anniversaryLine(iso) {   // { text, html } or null
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); if (!m) return null; const md = m[2] + '-' + m[3], day = `${+m[3]} ${MONTHS[+m[2] - 1]}`;
    const mk = (text, html) => ({ text, html: html || esc(text) });
    if (AN && AN.a.listed && AN.a.listed.date && AN.a.listed.date.slice(5) === md) return mk(`${day}: ${AN.a.label} was listed on this day in ${AN.a.listed.date.slice(0, 4)}.`, `${esc(day)}: <span class="nm">${esc(AN.a.label)}</span> was listed on this day in <span class="num">${esc(AN.a.listed.date.slice(0, 4))}</span>.`);
    if (md === '01-22') return mk(`${day}: the resident list rests on Government Decree No. 35, signed on this day in 2020.`);
    if (!TRN || !TRN.red_date) return null;
    const hits = []; for (let i = 0; i < TRN.n; i++) { const d = TRN.red_date[i]; if (d && d.slice(5) === md && !TRN.inferred[i] && !TRN.undated[i]) hits.push(i); }
    if (!hits.length) return null;
    const years = [...new Set(hits.map(i => TRN.red_date[i].slice(0, 4)))].sort(), yrs = years.length === 1 ? years[0] : years.slice(0, -1).join(', ') + ' and ' + years[years.length - 1];
    if (hits.length === 1 && TRN.name[hits[0]]) return mk(`${day}: ${TRN.name[hits[0]]} was listed on this day in ${yrs}.`, `${esc(day)}: <span class="nm">${esc(TRN.name[hits[0]])}</span> was listed on this day in <span class="num">${esc(yrs)}</span>.`);
    return mk(`${day}: ${fmt.int(hits.length)} firms on the lists (treated) were listed on this day in ${yrs}.`, `${esc(day)}: <span class="num">${fmt.int(hits.length)}</span> firms on the lists (treated) were listed on this day in <span class="num">${esc(yrs)}</span>.`);
  }
  let annivCache;   // the day's sentence, built at the first cycle (after every helper below is defined), never at script load
  const anniv = () => { if (annivCache === undefined) annivCache = anniversaryLine(TODAY); return annivCache; };
  const regRowsOf = y => { const out = []; for (let i = 0; i < REG.region.length; i++) if (REG.year[i] === y && REG.region[i] !== 'Russia' && REG.region[i] !== 'outside the basemap outline' && REG.region[i] !== 'region not recorded') out.push(i); return out; };
  function wireFacts(y, band, name) {
    const ys = y + (y === 2025 ? '*' : ''), out = [], loc = s => `<span class="loc">${esc(s)}</span>`, num = f => `<span class="num">${f}</span>`, add = (src, html) => out.push({ kind: 'data', text: html, src });
    const nat = band === 'national', reg = !nat && regIndex.has(name) ? name : null;
    if (TRN) { let n = 0, nr = 0; const ri = reg ? TRN.regions.indexOf(reg) : -1; for (let i = 0; i < TRN.n; i++) if (TRN.red_from[i] === y && !TRN.undated[i]) { n++; if (ri >= 0 && TRN.reg[i] === ri) nr++; }
      add('treatednational.red_from', `${ys}: ${num(fmt.int(n))} firms listed (treated) nationally`); if (reg) add('treatednational.reg', `${ys}: ${num(fmt.int(nr))} firms listed (treated) in ${loc(reg)}`); }
    { const t = totals[y]; if (t) { const k = CY.totals.year.indexOf(y), na = CY.totals.n_available[k], nla = CY.totals.n_located_available[k];
      add('cellsyears.totals', `${ys}: ${num(fmt.int(t.eligible))} eligible firms, ${num(fmt.int(na))} with a statement (${num(fmt.pct(t.share))})`);
      add('cellsyears.totals', `${ys}: ${num(fmt.int(t.located))} located firms, ${num(fmt.int(nla))} with a statement and ${num(fmt.int(t.located - nla))} without`);
      add('cellsyears.totals', `${ys}: ${num(fmt.int(t.located))} of ${num(fmt.int(t.eligible))} eligible firms located (${num(fmt.pct(t.located_share))})`); } }
    if (REG) { const iN = regRow('Russia', y); if (iN != null && REG.d1[iN] !== 255) { const d = REG.d1[iN], rows = regRowsOf(y), k = rows.filter(i => REG.d1[i] === d).length;
        add('regions.d1', `${ys}: ${esc(divShort(d))} (${divPad(d)}) leads nationally and in ${num(fmt.int(k))} of ${num(fmt.int(rows.length))} regions`);
        if (reg) { const ir = regRow(reg, y); if (ir != null && REG.d1[ir] !== 255 && REG.d1[ir] !== d) add('regions.d1', `${loc(reg)}, ${ys}: ${esc(divShort(REG.d1[ir]))} (${divPad(REG.d1[ir])}) leads with ${num(REG.s1[ir] + '%')} of revenue`); } }
      if (reg) { const ir = regRow(reg, y); if (ir != null) { add('regions.lsh', `${loc(reg)}, ${ys}: firms on the lists (treated) hold ${num(REG.lsh[ir] + '%')} of the region's revenue`); add('regions.listed', `${loc(reg)}, ${ys}: ${num(fmt.int(REG.listed[ir]))} of ${num(fmt.int(REG.n[ir]))} firms registered in the region on the five lists (treated)`); } } }
    if (FM && FM.by_year[y]) { const b = FM.by_year[y];
      add('firms.by_year', `${ys}: ${num(fmt.int(b.firms))} firms on no list (comparison group) at ${num(fmt.int(b.addresses))} coordinate pairs`);
      add('firms.by_year', `${ys}: ${num(fmt.int(b.listed))} located firms on the lists (treated). ${num(fmt.int(b.city_level))} firms with other geocodes`);
      add('firms.by_year', `${ys}: the largest coordinate pair holds ${num(fmt.int(b.max_at_address))} firms on no list. ${num(fmt.int(b.firms_at_100plus))} firms at the ${num(fmt.int(b.addresses_100plus))} pairs shared by 100 or more`);
      const k = FM.median_by_year.year.indexOf(y); if (k >= 0) add('firms.median_by_year', `${ys}: the median real-revenue change of firms on no list (comparison group) ${num(fmt.signed(FM.median_by_year.med[k]) + '%')} against their 2019 to 2021 average`); }
    if (y === 2021) add('series.facts', `2021: ${num(fmt.int(F.largest_location_firms))} firms at the largest coordinate pair. ${num(fmt.int(F.firms_at_100plus_locations))} firms at pairs shared by 100 or more, over every located firm`);
    { const ct = C100.change_totals, sup = C100.change.supported.reduce((a, v) => a + (v ? 1 : 0), 0); add('cells100.change', `2024 against 2021: ${num(fmt.int(sup))} supported 100 km cells. ${num(fmt.pct(ct.availability_share_percent[0]))} of located firms with a statement in 2021, ${num(fmt.pct(ct.availability_share_percent[1]))} in 2024`); }
    { const k = C100.lists.sanctioned.filter(v => v >= 5).length; add('cells100.lists', `2021: ${num(fmt.int(k))} cells with 5 or more sanctions-list members (treated)`); }
    add('series.facts.cohorts', `2021: ${num(fmt.int(F.cohorts.revenue_cash))} located eligible firms in the revenue cohort by cash share`);
    if (TRN) { let red = 0; for (let i = 0; i < TRN.n; i++) if (TRN.red_from[i] <= y) red++; add('treatednational.red_from', `By ${ys}: ${num(fmt.int(red))} of ${num(fmt.int(TRN.n))} listed firms (treated) red`); add('treatednational', `${num(fmt.int(TRN.undated_n))} firms on the undated lists are red from 2014. ${num(fmt.int(TRN.inferred_n))} listing dates are inferred`); }
    return out;
  }
  function wireFirms(y, band, name) {
    if (!TRN) return []; const ri = band !== 'national' && regIndex.has(name) ? TRN.regions.indexOf(name) : -1, ys = y + (y === 2025 ? '*' : '');
    const pick = useReg => { const idx = []; for (let i = 0; i < TRN.n; i++) if (TRN.red_from[i] === y && !TRN.undated[i] && TRN.name[i] && (!useReg || TRN.reg[i] === ri)) idx.push(i); idx.sort((a, b) => (TRN.name[a] < TRN.name[b] ? -1 : TRN.name[a] > TRN.name[b] ? 1 : a - b)); return idx; };
    let idx = ri >= 0 ? pick(true) : []; if (idx.length < 2) idx = pick(false); if (!idx.length) return [];
    const picks = []; for (let i = 0; i < 10; i++) { const j = idx[Math.floor(i * idx.length / 10)]; if (!picks.includes(j)) picks.push(j); }
    return picks.map(j => { const ch = TRN.filed[j][y - 2014], st = ch === '1' ? 'available' : ch === '0' ? 'absent' : 'not in the registry', d = dateOf(TRN.red_date[j]);
      return { kind: 'firm', text: `<span class="nm">${esc(TRN.name[j])}</span> · ${d ? 'listed ' + d : 'listed in ' + y}${TRN.inferred[j] ? ' (date inferred)' : ''} · ${ys} statement ${st}`, src: 'treatednational:' + j }; });
  }
  const wireTipsList = () => { const out = []; TIPS.forEach(t => { if (t.firms && !FIRMS_OK) return; if (t.mouse && coarse()) return; out.push(coarse() && t.touch ? t.touch : t.text); }); return out; };
  function buildCycle(y, band, name, cycleIndex) {
    const lf = factFor(band, name, true), an = anniv(), lead = { kind: 'lead', text: lf.text + (an ? '. ' + an.html : ''), src: 'lead:' + lf.kind + (an ? '+anniversary' : '') } /* on an anniversary the lead item carries the sentence (item 6) */, facts = wireFacts(y, band, name), firms = wireFirms(y, band, name), tipsL = wireTipsList();
    const firmsA = firms.filter((_, i) => i % 2 === 0), firmsB = firms.filter((_, i) => i % 2 === 1), firmSlots = new Set([2, 6, 10, 14, 18]);
    const half = (fo, fh, tipStart) => { const data = []; let fi = 0, di = 0;
      for (let sl = 0; sl < 20; sl++) { if (sl === 0) { data.push(lead); continue; } if (firmSlots.has(sl) && fi < fh.length) { data.push(fh[fi++]); continue; } if (di < fo.length) { data.push(fo[di++]); continue; } if (fi < fh.length) { data.push(fh[fi++]); continue; } data.push(fo.length ? fo[(di++) % fo.length] : lead); }
      const items = []; let ti = tipStart, dj = 0; for (let p = 0; p < WIRE_HALF; p++) { if (p % 5 === 4) { const t = tipsL[ti % tipsL.length]; items.push({ kind: 'tip', text: units(esc(t)), src: 'tips:' + (ti % tipsL.length) }); ti++; } else items.push(data[dj++]); } return items; };
    const cycle = half(facts, firmsA, 0).concat(half(facts.slice().reverse(), firmsB, 5));
    if (OFFWIRE && OFFWIRE.facts && OFFWIRE.facts.length) { const h = fnv(`${y}|${name}`), pool = OFFWIRE.facts, isFirm = i => i >= 0 && i < cycle.length && cycle[i].kind === 'firm'; let slot = 12 + (h % 26), guard = 0;
      while (guard++ < 60 && (cycle[slot].kind === 'tip' || isFirm(slot) || isFirm(slot - 1) || isFirm(slot + 1))) { slot++; if (slot >= cycle.length) slot = 12; }
      const f = pool[(h + 7 * cycleIndex) % pool.length]; cycle[slot] = { kind: 'cat', text: `<span class="pre">${esc(OFFWIRE.prefix)}</span> <span class="cf">${esc(f.text)}</span>`, src: 'offwire:' + f.id }; }
    return cycle;
  }
  const SEP = '<svg class="mk wsep" aria-hidden="true" focusable="false"><use href="#mark-wire"/></svg>';   // the separator: the mark at 14 px with 2 px strokes in the full context green (round 11)
  const wireTrack = () => $('wiretrack'), wireVisW = () => $('ctxwin').clientWidth;
  const wirePos = el => { const tr = wireTrack().getBoundingClientRect(), r = el.getBoundingClientRect(); return [r.left - tr.left, r.right - tr.left]; };   // an item's edges along the track, whatever its transform (the separators are SVG, without offsetLeft)
  function wireX() { const ws = wireState; if (ws.anim && !ws.pinned && ws.anim.currentTime != null) return ws.animX0 + WIRE_SPEED * (ws.anim.currentTime / 1000); return ws.x; }   // the scroll offset now, px
  function wireStop() { const ws = wireState; if (ws.anim) { ws.x = wireX(); ws.anim.cancel(); ws.anim = null; } if (ws.topTimer) { clearTimeout(ws.topTimer); ws.topTimer = 0; } return ws.x; }
  function wireAnimate(fromX) {   // one linear animation from fromX to the track's end at the wire's speed; a top-up is scheduled before the end enters the view
    const ws = wireState, tr = wireTrack(); wireStop(); ws.x = fromX; const last = tr.lastElementChild, end = last ? wirePos(last)[1] : 0, dist = end - fromX;
    tr.style.transform = `translateX(${-fromX}px)`;
    if (dist <= 0 || !tr.animate) return;
    ws.animX0 = fromX; ws.anim = tr.animate([{ transform: `translateX(${-fromX}px)` }, { transform: `translateX(${-end}px)` }], { duration: dist / WIRE_SPEED * 1000, easing: 'linear', fill: 'forwards' });
    if (ws.paused) ws.anim.pause();
    ws.topTimer = setTimeout(wireTopUp, Math.max(0, end - wireVisW() - 300 - fromX) / WIRE_SPEED * 1000);
  }
  const wireItems = cycle => { const tr = wireTrack(), els = []; for (const it of cycle) { const sp = document.createElement('span'); sp.className = 'wi ' + it.kind; sp.innerHTML = it.text; tr.appendChild(sp); els.push(sp); const hold = document.createElement('span'); hold.innerHTML = SEP; const svg = hold.firstChild; tr.appendChild(svg); els.push(svg); } return els; };
  function wireMake(cycle, key, ctx, status) {   // a set's items and separators appended after everything on the track
    const ws = wireState, set = { key, ctx, cycle, cycleIndex: ws.cycleIndex, els: wireItems(cycle), status };
    ws.sets.push(set); ws.cycle = cycle; ws.key = key; ws.width = setEnd(set) - setStart(set); ws.vis = wireVisW(); ws.builds++; return set;
  }
  const setStart = set => (set.els.length ? wirePos(set.els[0])[0] : 0), setEnd = set => (set.els.length ? wirePos(set.els[set.els.length - 1])[1] : 0), setEntered = (set, x) => set.els.length > 0 && setStart(set) < x + wireVisW();
  function wireDrop(set) { for (const el of set.els) el.remove(); set.els = []; }
  function wireCutAfterTip(set, x) {   // the priority rule: the playing set keeps its items up to and including the first tip or cat fact past the visible ones; the rest go
    const vis = x + wireVisW(); let cut = set.els.length;
    for (let i = 0; i < set.els.length; i += 2) { const sp = set.els[i]; if (wirePos(sp)[0] < vis) continue; if (sp.classList.contains('tip') || sp.classList.contains('cat')) { cut = i + 2; break; } }
    for (const el of set.els.splice(cut)) el.remove();
  }
  function wirePrune(x) {   // the items that have passed the left edge leave the track, orphans and the committed set's alike; the offset shifts by the width removed
    const ws = wireState, tr = wireTrack(); let removed = 0;
    while (tr.firstElementChild) { const el = tr.firstElementChild, [l, r] = wirePos(el); if (r + removed >= x - 20) break;   // an element's place in the track's original frame: what has left so far shifted it left by that much (25 October 2026: compared unshifted, the loop emptied the whole track once the first item had passed, and the new set leapt into view on every region change)
      const next = el.nextElementSibling, nl = next ? wirePos(next)[0] : null; el.remove(); removed += next ? nl - wirePos(next)[0] : r - l;   // the exact shift of what follows, margins included
      if (ws.orphans[0] === el) ws.orphans.shift(); else for (const set of ws.sets) if (set.els[0] === el) { set.els.shift(); break; } }
    while (ws.sets.length > 1 && !ws.sets[0].els.length) { ws.sets.shift(); ws.sets[0].status = 'committed'; ws.commits++; if (ws.commitTimer) { clearTimeout(ws.commitTimer); ws.commitTimer = 0; } }   // the committed set has played out: the pending one plays now
    ws.x -= removed;   // the stored offset moves with the track (25 October 2026): a caller that reads it again after pruning and before animating kept the old value, and every item jumped left by the width removed on each region change
    return removed;
  }
  function wireAutoCommit(x) {   // a pending set whose items have entered the view is playing: it is the committed set now, the old one's remaining items orphans
    const ws = wireState; if (ws.sets.length > 1 && setEntered(ws.sets[1], x)) wireCommit('play');
  }
  function wireCommit(why) {   // the pending set becomes the committed set: a committed set that has not entered the view is dropped unseen, one that has plays out to its cut as orphans
    const ws = wireState; if (ws.commitTimer) { clearTimeout(ws.commitTimer); ws.commitTimer = 0; }
    if (ws.sets.length < 2) return false;
    let x = wireStop(); x -= wirePrune(x);
    if (ws.sets.length > 1) { const cur = ws.sets.shift(); if (setEntered(cur, x)) ws.orphans.push(...cur.els); else wireDrop(cur); }
    ws.sets[0].status = 'committed'; ws.commits++; ws.cycle = ws.sets[0].cycle; ws.key = ws.sets[0].key; wireAnimate(x); return true;
  }
  function wireTopUp() {   // the track is about to run out: the committed set continues with its context's next cycle (the cat fact advancing by seven)
    const ws = wireState; ws.topTimer = 0; if (!wireScrolls() || ws.pinned || !ws.sets.length) return;
    let x = wireStop(); x -= wirePrune(x); wireAutoCommit(x); x = wireStop(); const last = ws.sets[ws.sets.length - 1];
    if (last.status === 'committed') { ws.cycleIndex++; last.els.push(...wireItems(buildCycle(last.ctx.y, last.ctx.band, last.ctx.name, ws.cycleIndex))); ws.width = setEnd(last) - setStart(last); }
    wireAnimate(x);
  }
  function wireReset(ctx, key, crossfade) {   // a fresh track from x 0 with one committed set; under crossfade (a year change) a frozen copy of the old track fades out as the new one fades in, 0.3 s
    const ws = wireState, tr = wireTrack(), box = $('ctxwin');
    if (crossfade && tr.childElementCount && !reduceMotion()) {
      const x = wireX(), ghost = tr.cloneNode(true); ghost.removeAttribute('id'); ghost.classList.add('old'); ghost.classList.remove('in', 'pinned'); ghost.style.transform = `translateX(${-x}px)`; box.appendChild(ghost);
      requestAnimationFrame(() => { ghost.classList.add('fade'); setTimeout(() => ghost.remove(), 400); });
      tr.classList.add('in'); requestAnimationFrame(() => requestAnimationFrame(() => tr.classList.remove('in')));
    }
    wireStop(); if (ws.commitTimer) { clearTimeout(ws.commitTimer); ws.commitTimer = 0; } ws.sets = []; ws.orphans = []; tr.innerHTML = ''; ws.x = 0; ws.pinned = false; tr.classList.remove('pinned'); ws.resets++;
    wireMake(buildCycle(ctx.y, ctx.band, ctx.name, ws.cycleIndex), key, ctx, 'committed'); wireAnimate(0);
  }
  function wireContextNow(band, name, how, settled) {   // how: 'append' (a region, layer or view change), 'year' (a rebuild under the crossfade), 'reset' (the first build, or a layout guard)
    const ws = wireState, ctx = { y: state.year, band, name }, key = [state.year, band, name, state.layer, state.mode, wireScrolls() ? 's' : 'r', narrow() ? 'n' : 'w'].join('|');
    if (stripState.tip && !wireScrolls()) endTip(false);
    applyRm2();
    if (!wireScrolls()) { ws.key = key; ws.cycle = buildCycle(state.year, band, name, ws.cycleIndex); $('ctxtext').classList.add('rm'); wireTrack().innerHTML = ''; ws.sets = []; ws.orphans = []; startRM(); return; }
    $('ctxtext').classList.remove('rm');
    const cur = ws.sets[0];
    if (how !== 'append' || !cur || narrow()) { wireReset(ctx, key, how === 'year' || narrow()); return; }   // a phone-width map has no lead slot: every change rebuilds under the crossfade, as a year change does, so the lead shows at once
    let x = wireStop(); x -= wirePrune(x); wireAutoCommit(x); x = wireStop();
    const head = ws.sets[0], pend = ws.sets[1];
    if (!setEntered(head, x) && head.key !== key) {   // a committed set that has not entered the view is replaced unseen, as a pending one is (round 13): nothing visible is touched and the new lead is not kept waiting behind it
      if (pend) wireDrop(pend); wireDrop(head); ws.sets = []; if (ws.commitTimer) { clearTimeout(ws.commitTimer); ws.commitTimer = 0; }
      ws.cycleIndex++; wireMake(buildCycle(state.year, band, name, ws.cycleIndex), key, ctx, 'committed'); ws.commits++; wireAnimate(x); return;
    }
    if (head.key === key) { if (pend) { wireDrop(pend); ws.sets.length = 1; } if (ws.commitTimer) { clearTimeout(ws.commitTimer); ws.commitTimer = 0; } ws.cycle = head.cycle; ws.key = key; wireAnimate(x); return; }   // back on the committed context: the pending set goes
    if (pend && pend.key === key) { if (settled) wireCommit('settle'); else { wireAnimate(x); wireArmCommit(key); } return; }   // already pending; a settled camera commits it now, a hover back onto its region restarts the rest
    if (pend) { wireDrop(pend); ws.sets.length = 1; }
    if (setEntered(head, x)) wireCutAfterTip(head, x);   // the priority rule on the playing set; a set not yet in view keeps every item and the new one queues behind it
    ws.cycleIndex++; wireMake(buildCycle(state.year, band, name, ws.cycleIndex), key, ctx, 'pending'); wireAnimate(x);
    if (settled) { wireCommit('settle'); return; }
    wireArmCommit(key);
  }
  function wireArmCommit(key) {   // the pending set commits once the cursor has rested 600 ms on its region, counted from the region change
    const ws = wireState; if (ws.commitTimer) clearTimeout(ws.commitTimer);
    ws.commitTimer = setTimeout(() => { ws.commitTimer = 0; if (ws.sets[1] && ws.sets[1].key === key) wireCommit('rest'); }, Math.max(0, 600 - (performance.now() - ws.changedAt)));
  }
  function sizeSlot(el) {   // the slot's width follows its text (the width transition carries the wire's window with it), capped at a third of the bar (the author's rule); on a resize the cap is applied again
    const lead = $('ctxlead'); if (!el) el = stripState.cur === 'A' ? $('ctxA') : $('ctxB'); if (!wireScrolls() || narrow()) { lead.style.width = ''; return; }
    const rg = document.createRange(); rg.selectNodeContents(el); const tw = Math.ceil(rg.getBoundingClientRect().width), cap = Math.floor($('ctxstrip').clientWidth / 3), w0 = lead.getBoundingClientRect().width, w1 = Math.max(0, Math.min(tw + 2, cap));
    if (Math.abs(w1 - w0) < 0.5) return; lead.style.width = w1 + 'px';
    const ws = wireState; if (ws.anim && !ws.pinned) wireAnimate(wireStop() + (w1 - w0));   // the window's left edge moved by the change: the offset moves with it, so every item keeps its place on screen and the wire never jumps
  }
  function applyRm2() { const on = narrow() && !wireScrolls(); $('ctxstrip').classList.toggle('rm2', on); wrap.classList.toggle('rm2', on); }   // the two-line reduced-motion form on a phone-width map (round 12, part D): the strip and the lift grow with it
  let wireSettled = false;   // set by afterCameraMove around its context update: a settled camera commits the pending set at once
  function rebuildWire(band, name, how = 'append') {   // a region change from a hover waits 250 ms, so the hover cost stays as it was (the lead slot changes at once); the rest at once
    const ws = wireState, settled = wireSettled; if (ws.timer) { clearTimeout(ws.timer); ws.timer = 0; }
    if (how !== 'append' || !ws.sets.length || settled) { if (how === 'append') ws.changedAt = performance.now(); wireContextNow(band, name, how, settled); return; }
    if (ws.commitTimer) { clearTimeout(ws.commitTimer); ws.commitTimer = 0; }   // the cursor has moved to another region: the pending set's rest ends now, not after the debounce
    ws.changedAt = performance.now(); ws.timer = setTimeout(() => { ws.timer = 0; wireContextNow(band, name, 'append', false); }, 250);
  }
  function applyWireCaps() { $('ctxtext').classList.toggle('caps', WIRE_CAPS); }
  // The wire watchdog (the author's request of 25 October 2026): once a second while the document is visible, and at once on visibilitychange and on window focus, the
  // track's rendered offset is compared with the last check's; a track that should be moving (the scrolling form, an animation started, neither paused under the pointer nor
  // pinned) but has not advanced restarts its animation from its rendered offset, or tops up when it sits at the track's end. The offset at hiding is kept, so a return finds
  // a stalled track at once. Nothing is logged.
  const wireRenderedX = () => { const t = getComputedStyle(wireTrack()).transform; if (!t || t === 'none') return 0; const m = t.match(/matrix\(([^)]+)\)/); return m ? -parseFloat(m[1].split(',')[4]) : 0; };
  function wireWatch() {
    const ws = wireState, x = wireRenderedX(), now = performance.now();
    if (document.visibilityState !== 'visible') { ws.watchX = x; ws.watchT = now; return; }
    const should = wireScrolls() && !!ws.anim && !ws.paused && !ws.pinned;
    if (ws.watchT != null && now - ws.watchT < 500) return;   // a focus event right after a tick is no evidence of a stall
    if (should && ws.watchX != null && Math.abs(x - ws.watchX) < 0.5) { const tr = wireTrack(), last = tr.lastElementChild, end = last ? wirePos(last)[1] : 0; ws.restarts++; ws.watchX = null; ws.watchT = now; if (end - x <= 1) wireTopUp(); else wireAnimate(x); return; }
    ws.watchX = x; ws.watchT = now;
  }
  setInterval(wireWatch, 1000); document.addEventListener('visibilitychange', wireWatch); window.addEventListener('focus', wireWatch);
  { const bar = $('ctxstrip'), setPause = on => { const ws = wireState; ws.paused = on; if (ws.anim) { if (on) ws.anim.pause(); else ws.anim.play(); } };   // paused under the pointer or focus, as the CSS animation was
    bar.addEventListener('mouseenter', () => setPause(true)); bar.addEventListener('mouseleave', () => setPause(false)); bar.addEventListener('focusin', () => setPause(true)); bar.addEventListener('focusout', () => setPause(false)); }
  function startRM() {   // reduced motion: the cycle's items crossfade one at a time, 8 s each, from the lead
    if (wireState.rmTimer) { clearInterval(wireState.rmTimer); wireState.rmTimer = 0; } if (wireScrolls() || !wireState.cycle.length) return; wireState.rmIndex = 0;
    wireState.rmTimer = setInterval(() => { if (!stripOpen() || !stripState.fact) return; wireState.rmIndex = (wireState.rmIndex + 1) % wireState.cycle.length; const it = wireState.cycle[wireState.rmIndex]; stripState.tip = it.kind === 'tip' ? { i: -1, text: plainOf(it) } : null; setStripText({ kind: it.kind === 'lead' ? stripState.fact.kind : it.kind, name: '', text: it.text, nums: [] }, null); }, WIRE_RM_MS);
  }
  const plainOf = it => { const d = document.createElement('span'); d.innerHTML = it.text; return d.textContent.replace(/ /g, ' '); };
  function pinTip() { const ws = wireState, tr = wireTrack(); if (!ws.sets.length) return false; const x = wireX(), tips = [...tr.querySelectorAll('.wi.tip')], el = tips.find(e => wirePos(e)[0] >= x - 1) || tips[0]; if (!el) return false; wireStop(); ws.x = wirePos(el)[0]; ws.pinned = true; tr.classList.add('pinned'); tr.style.transform = `translateX(${-ws.x}px)`; const i = [...tr.children].filter(e => e.classList.contains('wi')).indexOf(el); stripState.tip = { i, text: plainOf({ text: el.innerHTML }) }; return true; }
  function unpinTip() { const ws = wireState, tr = wireTrack(); if (!tr) return; tr.classList.remove('pinned'); if (!ws.pinned) return; ws.pinned = false; if (wireScrolls() && ws.sets.length) wireAnimate(ws.x); }

  // The region glyph: one pre-simplified outline per region from the basemap's parts (the largest ring and any ring with at least a
  // quarter of its area, Douglas-Peucker to about 60 points, fitted into 22 by 22), built once on first use; Russia's outline traced
  // once from the filled parts on an offscreen canvas (the mainland's outer boundary).
  const glyphs = new Map();
  const decodeRing = r => { const p = []; let x = r[0], y = r[1]; p.push([x / 10, y / 10]); for (let i = 2; i < r.length; i += 2) { x += r[i]; y += r[i + 1]; p.push([x / 10, y / 10]); } return p; };
  const ringArea = p => { let a = 0; for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j][0] + p[i][0]) * (p[j][1] - p[i][1]); return Math.abs(a) / 2; };
  function simplify(p, tol) {   // Douglas-Peucker on an open or closed ring
    if (p.length <= 3) return p;
    const keep = new Uint8Array(p.length); keep[0] = keep[p.length - 1] = 1; const stack = [[0, p.length - 1]];
    while (stack.length) { const [a, b] = stack.pop(); let best = -1, bd = 0; const [ax, ay] = p[a], [bx, by] = p[b], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1e-12;
      for (let i = a + 1; i < b; i++) { const t = Math.max(0, Math.min(1, ((p[i][0] - ax) * dx + (p[i][1] - ay) * dy) / L2)), ex = ax + t * dx - p[i][0], ey = ay + t * dy - p[i][1], d = ex * ex + ey * ey; if (d > bd) { bd = d; best = i; } }
      if (best >= 0 && bd > tol * tol) { keep[best] = 1; stack.push([a, best], [best, b]); } }
    return p.filter((_, i) => keep[i]);
  }
  function fitPath(rings) {   // rings in km -> an SVG path in the 22 by 22 box with 1 px padding, y up in km, down on screen
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const r of rings) for (const [x, y] of r) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const sc = 20 / Math.max(x1 - x0, y1 - y0, 1e-9), xc = (x0 + x1) / 2, yc = (y0 + y1) / 2;
    return rings.map(r => 'M' + r.map(([x, y]) => `${(11 + sc * (x - xc)).toFixed(1)} ${(11 - sc * (y - yc)).toFixed(1)}`).join('L') + 'Z').join('');
  }
  function regionGlyph(name) {
    if (glyphs.has(name)) return glyphs.get(name);
    let d = '';
    if (name === 'Russia') d = russiaGlyph();
    else {
      const rings = []; for (const p of BM.lod0.parts) if (p.name === name) for (const r of p.rings) rings.push(decodeRing(r));
      if (rings.length) {
        const areas = rings.map(ringArea), amax = Math.max(...areas); let keep = rings.filter((_, i) => areas[i] >= 0.25 * amax);
        const span = (() => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const r of keep) for (const [x, y] of r) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return Math.max(x1 - x0, y1 - y0); })();
        let tol = span / 200, out = keep; for (let it = 0; it < 12; it++) { out = keep.map(r => simplify(r, tol)); if (out.reduce((n, r) => n + r.length, 0) <= 60) break; tol *= 1.5; }
        d = fitPath(out.filter(r => r.length >= 3));
      }
    }
    glyphs.set(name, d); return d;
  }
  function russiaGlyph() {   // the mainland's outer boundary: fill every part at 0.03 px per km, trace the contour (Moore neighbourhood), simplify
    const S = 0.03; let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;   // the bounds of every part
    for (const p of BM.lod0.parts) for (const r of p.rings) { let x = r[0] / 10, y = r[1] / 10; const upd = () => { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }; upd(); for (let i = 2; i < r.length; i += 2) { x += r[i] / 10; y += r[i + 1] / 10; upd(); } }
    const W = Math.ceil((x1 - x0) * S) + 4, H = Math.ceil((y1 - y0) * S) + 4, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d', { willReadFrequently: true });
    g.setTransform(S, 0, 0, -S, 2 - x0 * S, H - 2 + y0 * S); g.fillStyle = '#fff'; g.fill(MM.partsToPath(BM.lod0.parts), 'evenodd');
    const a = g.getImageData(0, 0, W, H).data, land = (x, y) => x >= 0 && y >= 0 && x < W && y < H && a[4 * (y * W + x) + 3] > 127;
    const cxp = Math.round(2 + (0 - x0) * S), cyp = Math.round(H - 2 - (0 - y0) * S); let sx = cxp, sy = cyp; while (sx > 0 && land(sx - 1, sy)) sx--;   // walk west from the plane's origin to the coast
    if (!land(sx, sy)) { for (let x = 0; x < W; x++) if (land(x, cyp)) { sx = x; break; } }
    const dirs = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]], path = []; let x = sx, y = sy, dir = 6, guard = 0;
    do { path.push([x, y]); let found = false; for (let k = 0; k < 8; k++) { const nd = (dir + 5 + k) % 8, nx = x + dirs[nd][0], ny = y + dirs[nd][1]; if (land(nx, ny)) { x = nx; y = ny; dir = nd; found = true; break; } } if (!found) break; } while ((x !== sx || y !== sy) && ++guard < 200000);
    const km = path.map(([px, py]) => [x0 + (px - 2) / S, y0 + (H - 2 - py) / S]);
    let tol = 20, out = km; for (let it = 0; it < 12; it++) { out = simplify(km, tol); if (out.length <= 80) break; tol *= 1.5; }
    return fitPath([out]);
  }
  function setGlyph(name) {
    if (!name || name === stripState.glyphName) return;
    const first = !stripState.glyphName; stripState.glyphName = name; const d = regionGlyph(name);
    const ina = stripState.glyphCur === 'A' ? $('ctxpathB') : $('ctxpathA'), out = stripState.glyphCur === 'A' ? $('ctxpathA') : $('ctxpathB'); stripState.glyphCur = stripState.glyphCur === 'A' ? 'B' : 'A';
    ina.setAttribute('d', d); out.classList.add('out'); out.classList.remove('live');
    if (first || reduceMotion()) { ina.classList.add('nt'); ina.style.strokeDashoffset = '0'; ina.classList.remove('out'); void ina.getBoundingClientRect(); ina.classList.remove('nt'); return; }
    ina.classList.add('nt'); ina.style.strokeDashoffset = '100'; ina.classList.remove('out'); void ina.getBoundingClientRect(); ina.classList.remove('nt'); ina.classList.add('live'); ina.style.strokeDashoffset = '0';
    setTimeout(() => { if (stripState.glyphName === name) ina.classList.remove('live'); }, 450);
  }
  stripState.glyphCur = 'A'; applyStrip();
  const lastLegend = { title: null, html: null, note: null, read: false };
  // The industry legend's counts for the current view (round 9): the cells of the active grid whose squares meet the camera's km
  // rectangle, or the addresses in the visible x band and y range; recomputed only when the view, year, layer or mode changed.
  // The revenue mix of the view (round 9, the author's correction): the eight largest divisions by their share of the summed
  // revenue of the cells or coordinate pairs in view, from each unit's own rows (its eight largest divisions; the rest joins
  // "other divisions"), weighted by the unit's revenue code. Computed once per camera settle, year, layer or view change.
  const POW = new Float64Array(2048); for (let i = 1; i < 2048; i++) POW[i] = Math.pow(10, (i - 1) / 100);   // rv codes to revenue; 0 stays 0
  const viewMix = { key: '', rows: null, other: 0, unit: '' };
  function computeViewMix() {
    if (state.layer !== 'industry' || !IND_T) { viewMix.key = ''; viewMix.rows = null; return; }
    const c = cam(), micro = state.mode !== 'firms' && microA(c.k, state.year) >= 0.5, key = [state.mode, state.year, c.cx.toFixed(3), c.cy.toFixed(3), c.k.toFixed(5), stage.width, stage.height, micro ? 1 : 0].join('|');
    if (viewMix.key === key) return;
    const acc = new Float64Array(100), hw = stage.width / 2 / c.k, hh = stage.height / 2 / c.k, x0 = c.cx - hw, x1 = c.cx + hw, y0 = c.cy - hh, y1 = c.cy + hh; let other = 0, total = 0;
    if (state.mode === 'firms' || micro) {   // the coordinate pairs in view, which the Cells view's 1 km squares sum too (round 14)
      const d = firmYears.get(state.year); if (!d || !d.mixInd) { viewMix.rows = null; viewMix.key = ''; return; }   // no cache without the year's data
      const i0 = lowerBound(d.x, x0 * 1000), i1 = lowerBound(d.x, x1 * 1000);
      for (let i = i0; i < i1; i++) { const yv = d.y[i] / 1000; if (yv < y0 || yv > y1) continue; const w = POW[d.rv[i]]; if (!w) continue; total += w; let sum = 0; for (let k = 0; k < d.mk; k++) { const code = d.mixInd[k][i]; if (code === 255) break; const sh = d.mixSh[k][i]; sum += sh; acc[code] += w * sh; } other += w * Math.max(0, 100 - sum); }
      viewMix.unit = micro ? '1 km squares in view' : 'coordinate pairs in view';
    } else {
      const y = state.year, grid25 = alpha25(c.k) >= 0.5 && ind25[y];
      const d = grid25 ? ind25[y] : ind100[y]; if (!d || !d.rv) { viewMix.rows = null; viewMix.key = ''; return; }
      const g = grid25 ? G25 : 100, o = [0, 0], k = d.k || 1;
      for (let i = 0; i < d.count; i++) { const cx0 = o[0] + d.ix[i] * g, cy0 = o[1] + d.iy[i] * g; if (cx0 + g < x0 || cx0 > x1 || cy0 + g < y0 || cy0 > y1) continue; const w = POW[d.rv[i]]; if (!w) continue; total += w; let sum = 0; for (let j = 0; j < k; j++) { const code = d.top ? d.top[i * k + j] : d.dom[i]; if (code === 255) break; const sh = d.top ? d.tsh[i * k + j] : d.dsh[i]; sum += sh; acc[code] += w * sh; } other += w * Math.max(0, 100 - sum); }
      viewMix.unit = `${grid25 ? '25 km' : '100 km'} cells in view`;
    }
    const rows = []; for (let code = 0; code < 100; code++) if (acc[code] > 0) rows.push({ code, v: acc[code] }); rows.sort((p, q) => q.v - p.v || p.code - q.code);
    let rest = other; for (const r of rows.slice(8)) rest += r.v; const T = total || 1;
    viewMix.rows = rows.slice(0, 8).map(r => ({ code: r.code, share: Math.round(r.v / T) })); viewMix.other = Math.round(rest / T); viewMix.key = key;
  }

  // The legend (round 14, the author's request of 25 October 2026): two sides in one box. The key side, shown by default, holds the title and the rows with a swatch, so
  // the box is as wide as its longest class label; the green "i" in the title row turns it to the reading side, the sentences that say how to read the colours,
  // wrapped to the key side's width (the key side keeps the box's width while hidden). The choice is remembered per viewer.
  function drawLegend() {
    const L = state.layer, c = cam(); const popRow = extra => `<div class="row p">1 km squares: firms on no list with a house- or street-level geocode${extra || ''}.</div>`;   // the squares' population (round 14)
    const sw = col => `<span class="sw" style="background:${col}"></span>`, bar = col => `<span class="sw bars" style="--c:${col}"></span>`;   // ramp swatches as bars (round 10)
    let title = '', html = '', read = '', note = '';
    if (state.mode === 'firms') {
      const y = state.year, by = FM.by_year[y], ys = y + (y === 2025 ? '*' : '');
      const dot = (bg, border) => `<span class="sw dot" style="background:${bg}${border ? ';border:2px solid ' + border : ''}"></span>`;
      // The pixel field (round 14) below the dots zoom: the layer's statistic per pixel, the blocks, the faint backdrop where some firms carry no value; the dots above.
      const pix = dotsAlphas(c.k).pix >= 0.5, faint = col => sw(hexAlpha(col, PixelField.BACKDROP_ALPHA));
      title = L === 'fin' ? `<b>Firms on no list (comparison group), ${ys}</b>` : `<b>Firms at registered addresses, ${ys}</b>`;
      if (pix && L === 'share') { read = `<div class="row p">Colour: share of the pixel’s firms with a ${ys} statement.</div>`; html = theme.ramp6.map((col, i) => `<div class="row">${bar(col)}${breakLabels(YEAR_BREAKS, 6)[i]}</div>`).join(''); }
      else if (pix && L === 'fin') { read = `<div class="row p">Colour: the median revenue-change class of the pixel’s filers (each firm’s real revenue against its own 2019–2021 average, minus the year’s median).</div>`; html = theme.div6.map((col, i) => `<div class="row">${bar(col)}${CLASS_LABELS[i]}</div>`).join('') + `<div class="row">${faint(theme.neutral)}faint: no usable baseline</div>`; }
      else if (pix && L === 'industry' && IND_T) { read = `<div class="row p">Colour: the class with the largest revenue in the pixel, each coordinate pair counted in its leading class.</div>`; html = IND_T.classes.label.map((lab, i) => `<div class="row">${sw(theme.ind9[i])}${lab}</div>`).join('') + `<div class="row">${faint(theme.neutral)}faint: no revenue value</div>`; }
      else if (pix) { read = `<div class="row p">Brightness: firms on no list in the pixel (this layer is a cell layer).</div>`; html = MM.countClassLabels.map((lab, i) => `<div class="row">${bar(hexAlpha(theme.density, MM.countAlpha[i]))}${lab}</div>`).join(''); }
      else if (L === 'share') { read = `<div class="row p">Colour: share of the firms at the coordinate pair with a ${ys} statement. A single firm shows the first colour (no statement) or the last (statement available).</div>`; html = theme.ramp6.map((col, i) => `<div class="row">${bar(col)}${breakLabels(YEAR_BREAKS, 6)[i]}</div>`).join(''); }
      else if (L === 'fin') { read = `<div class="row p">Colour: real revenue change since the firm’s own 2019–2021 average, minus the year’s median change.</div>`; html = theme.div6.map((col, i) => `<div class="row">${bar(col)}${CLASS_LABELS[i]}</div>`).join('') + `<div class="row">${sw(theme.zero)}no usable baseline</div>`; }
      else if (L === 'industry' && IND_T) { read = `<div class="row p">Colour: the division with the largest share of revenue at the coordinate pair, in nine classes.</div>`; html = IND_T.classes.label.map((lab, i) => `<div class="row">${sw(theme.ind9[i])}${lab}</div>`).join('') + `<div class="row">${sw(theme.neutral)}no revenue value</div>`; }
      else { read = '<div class="row p">This layer is a cell layer: the Firms view draws every coordinate pair in one colour.</div>'; html = `<div class="row">${sw(theme.neutral)}every coordinate pair</div>`; }
      // The listed marks as one group under its header (round 14: the rows had repeated "(treated)" and set the box's width).
      html += `<div class="row h">On one of the five lists (treated)</div><div class="row">${dot(theme.neutral, 'rgba(227,26,28,0.8)')}before its listing year</div><div class="row">${dot(theme.treated)}from its listing year, statement available</div><div class="row">${dot(theme.land, theme.treated)}from its listing year, no statement</div>`;
      read += pix ? `<div class="row p">Blocks of 2 and 3 px: 10 and 100 or more ${L === 'fin' ? 'filers' : 'firms'} in the pixel.</div><div class="row p">Each pixel (about ${pixelSize(1 / c.k)} at this zoom) sums the firms on no list at the addresses inside it. Zoom in past 20 px per km for the dots.</div>`
        : '<div class="row p">Each dot is one coordinate pair. Larger dots hold more firms.</div>';
      note = firmStatus || `${fmt.int(by.firms)} firms on no list (comparison group) at ${fmt.int(by.addresses)} distinct coordinate pairs; ${fmt.int(by.listed)} firms on these lists (treated). ${fmt.int(by.city_level)} firms with other geocodes are not drawn.` + (TRN.name ? ' Hover a listed firm for its name.' : '');
    } else if (L === 'density') {
      const micro = microA(c.k, 2021) >= 0.5, f250 = fineA(c.k) >= 0.5;
      title = '<b>Firms per cell</b> <span class="u">(' + (f250 ? '250 m' : micro ? '1 km' : '5 km') + ')</span>';
      html = MM.countClassLabels.map((lab, i) => `<div class="row">${bar(hexAlpha(theme.density, MM.countAlpha[i]))}${lab}</div>`).join(''); if (micro && !f250) read += popRow();
      note = `${fmt.int(F.located_2021)} located eligible firms at ${fmt.int(F.distinct_locations)} distinct coordinate pairs in 2021 (${fmt.int(F.eligible_firms_2021)} eligible); the most shared coordinate pair holds ${fmt.int(F.largest_location_firms)} firms.`;
    } else if (L === 'share') {
      const y = state.year, micro = microA(c.k, y) >= 0.5, f250 = y === 2021 && fineA(c.k) >= 0.5, grid25 = alpha25(c.k) >= 0.5 && !!c25[y];
      const fine = micro || f250, breaks = fine ? FINE_BREAKS : YEAR_BREAKS, ramp = fine ? theme.ramp5 : theme.ramp6;
      const labels = ramp.map((_, i) => i === 0 ? `< ${breaks[0]}%` : i === ramp.length - 1 ? `≥ ${breaks[i - 1]}%` : `${breaks[i - 1]}–${breaks[i]}%`);
      title = `<b>Share with a statement, ${y}</b> <span class="u">(${f250 ? '250 m' : micro ? '1 km' : grid25 ? '25 km' : '100 km'})</span>`;   // the grid's size alone (round 14: the legend's width); the reading side names the squares' population
      html = ramp.map((col, i) => `<div class="row">${bar(col)}${labels[i]}</div>`).join('') + `<div class="row">${sw(theme.below)}fewer than 50 firms, share not shown</div>`; if (micro && !f250) read += popRow();
      const t = totals[y]; note = t ? `${y}${y === 2025 ? '*' : ''}: ${fmt.pct(t.share)} of ${fmt.int(t.eligible)} eligible firms have a statement; ${fmt.pct(t.located_share)} located. Provider: ${y <= 2018 ? 'Rosstat' : 'FNS'}.` : '';
      if (micro && y !== 2021 && c.k >= 24) note += ' 250 m cells exist for 2021 only.';
    } else if (L === 'change') {
      const labels = ['≤ −5 points', '−5 to −2', '−2 to 0', '0 to +2', '+2 to +5', '> +5 points'];
      const grid25 = chg25 && alpha25(c.k) >= 0.5, counts = grid25 ? C25.change.class_cells : C100.change_classes.cells;
      title = `<b>Change in the share, 2024 against 2021</b> <span class="u">(${grid25 ? '25' : '100'} km)</span>`;
      html = [5, 4, 3, 2, 1, 0].map(i => `<div class="row">${bar(theme.change6[i])}${labels[i]} (${fmt.int(counts[i])} cells)</div>`).join('') + `<div class="row">${sw(theme.below)}fewer than 50 firms in a year</div>`;
      note = `${fmt.int(grid25 ? C25.change.supported : 658)} supported cells; located share ${fmt.pct(C100.change_totals.availability_share_percent[0])} → ${fmt.pct(C100.change_totals.availability_share_percent[1])}. Annual populations at registered addresses, not the same firms.`;
    } else if (L === 'cohort') {
      title = '<b>Revenue cohort by cash share: inclusion per cell</b>';
      html = theme.ramp5.map((col, i) => `<div class="row">${bar(col)}${C100.cohort_class_labels[i]}</div>`).join('') + `<div class="row">${sw(theme.below)}fewer than 50 eligible firms</div>`;
      note = `${fmt.int(F.cohorts.revenue_cash)} cohort firms; located cohort firms over located eligible firms per 2021 cell; pooled quintile classes.` + (c.k >= 1.5 ? ' 100 km cells are this layer’s finest resolution.' : '');
    } else if (L === 'industry' && IND_T) {
      const y = state.year, micro = microA(c.k, y) >= 0.5, grid25 = alpha25(c.k) >= 0.5 && !!ind25[y];
      title = `<b>Leading industry by revenue, ${y}${y === 2025 ? '*' : ''}</b> <span class="u">(${micro ? '1 km' : grid25 ? '25 km' : '100 km'})</span>`;
      html = IND_T.classes.label.map((lab, i) => `<div class="row">${sw(theme.ind9[i])}${lab}</div>`).join('') + `<div class="row">${sw(theme.below)}no firm with a revenue value</div>`; if (micro) read += popRow(', coloured by the class with the largest revenue');
      note = `${y}${y === 2025 ? '*' : ''}: the division with the largest share of nominal revenue among located eligible firms with a statement and a positive revenue value. Division names from NACE Rev. 2 (Eurostat); OKVED 2 uses the same two-digit codes.`;
    } else if (L === 'lists') {
      // Three classes, the ones listClass draws (ramp5[2], [3], [4]), each with its cell count; 1 to 4 members show no count.
      const grid25 = c25[2021] && alpha25(c.k) >= 0.5, counts = grid25 ? list25Counts : listClassCounts;
      title = `<b>Sanctions-list members (treated), 2021</b> <span class="u">(${grid25 ? '25' : '100'} km)</span>`;   // the grid size as a unit phrase (round 10)
      html = ['5–19', '20–49', '≥ 50'].map((lab, i) => `<div class="row">${bar(theme.ramp5[i + 2])}${lab} located members (${fmt.int(counts[i + 1])} cells)</div>`).join('');
      note = 'Memberships are fixed. Cells with 1 to 4 members show no count. The hover gives the government strategic list (treated) separately.';
    } else if (L === 'fin') {
      const labels = ['≤ −20%', '−20 to −10%', '−10 to 0%', '0 to +10%', '+10 to +20%', '> +20%'];
      title = '<b>Median real revenue, 2024 against 2021 (descriptive)</b>';
      html = [5, 4, 3, 2, 1, 0].map(i => `<div class="row">${bar(theme.change6[i])}${labels[i]}</div>`).join('');
      note = 'Revenue cohort by cash share; cells with 50 or more observed firms; composition changes with observation.' + (c.k >= 1.5 ? ' 100 km cells are this layer’s finest resolution.' : '');
    }
    if (state.mode !== 'firms' && TRN) {   // the tile's red count (round 14), in the layer's own year: its key row, and its definition on the reading side
      const ly = layerYear();
      html += `<div class="row"><span class="sw dot" style="background:${theme.treated}"></span><b class="lcn">N</b> listed (treated), ${ly}</div>`;
      read += `<div class="row p">The red number in the tile counts the firms on these lists (treated) present in ${ly} at coordinates inside the hovered cell, at the cell’s own size. A cell without them shows 0.</div>`;
    }
    const body = `<div class="lg-key">${html}</div>` + (read ? `<div class="lg-read">${read}</div>` : '');
    if (title !== lastLegend.title) { $('legendtitle').innerHTML = title; lastLegend.title = title; }
    let rewrote = false;
    if (body !== lastLegend.html) { $('legendbody').innerHTML = body; lastLegend.html = body; lastLegend.read = !!read; dropObstacles(); rewrote = true; }
    if (note !== lastLegend.note) { $('notebody').textContent = note; $('mapnote').hidden = !note; lastLegend.note = note; dropObstacles(); rewrote = true; }   // the note's box changes with its text (round 9)
    if (rewrote && state.hover && !hoverQueued) { hoverQueued = true; queueMicrotask(() => { hoverQueued = false; refreshHover(); }); }   // a showing tile is re-placed against the panels' new boxes (round 9)
    applyPanels();
  }
  function hexAlpha(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }

  // ---- hover ------------------------------------------------------------------------------------
  function kmAt(ev) { const r = wrap.getBoundingClientRect(); const c = cam(); const x = ev.clientX - r.left, y = ev.clientY - r.top; return { x: c.cx + (x - c.ox) / c.k, y: c.cy - (y - c.oy) / c.k, px: x, py: y }; }
  function regionAt(px, py) { const c = cam(), kx = c.cx + (px - c.ox) / c.k, ky = c.cy - (py - c.oy) / c.k; mctx.save(); Motion.camTransform(mctx, stage, c); let name = null; const dx = px * stage.scale, dy = py * stage.scale; for (const p of partPaths) { if (kx < p.x0 || kx > p.x1 || ky < p.y0 || ky > p.y1) continue; if (mctx.isPointInPath(p.path, dx, dy, 'evenodd')) { name = p.name; break; } } mctx.restore(); stage.base(); return name; }
  function cellAt(km) {
    const c = cam(); const L = state.layer; const ix = Math.floor(km.x / 100), iy = Math.floor(km.y / 100), key = cellKey(ix, iy);
    const out = { ix, iy, grid: 100, region: regionAt(km.px, km.py), kmx: km.x, kmy: km.y };
    // Round 14: the 2021 250 m windows where they are drawn at half strength or more (the density layer, the share layer in 2021), then the 1 km squares from the
    // address files once they are, then the national 5 km counts on the density layer; the 25 km and 100 km cells below answer elsewhere.
    if (fineA(c.k) >= 0.5) {
      const near = nearestCity(c).city.label, w = win025[near] ? win025[near].d : null; out.city = near;
      if (w && km.x >= w.origin[0] && km.x < w.origin[0] + 24 && km.y >= w.origin[1] && km.y < w.origin[1] + 24) {
        const jx = Math.floor((km.x - w.origin[0]) / 0.25), jy = Math.floor((km.y - w.origin[1]) / 0.25);
        Object.assign(out, { grid: 0.25, fine: true, origin: w.origin, yearShown: 2021, n: null, a: null });
        for (let i = 0; i < w.count; i++) if (w.ix[i] === jx && w.iy[i] === jy) { out.n = w.n[i]; out.a = w.a[i] >= 0 ? w.a[i] : null; break; }
        return out;
      }
    }
    { const y = microYear(); if (MICRO_LAYERS.has(L) && microA(c.k, y) >= 0.5) {
      const b = mosaicCache.get(y + '|1'), d = firmYears.get(y), bx = Math.floor(km.x), by = Math.floor(km.y), j = b.idx.get(binKey(bx, by));
      Object.assign(out, { grid: 1, origin: [0, 0], micro: true, yearShown: y, n: null });
      if (j !== undefined) { Object.assign(out, { j, n: b.n[j], p: b.p[j], a: b.a[j], f: b.f[j] }); if (L === 'industry') out.lead = binLeader(b, j, d); }
      return out;
    } }
    if (L === 'density') {   // the national 5 km counts (2021)
      const jx = Math.floor(km.x / 5), jy = Math.floor(km.y / 5); Object.assign(out, { grid: 5, fine: true, origin: [0, 0], yearShown: 2021, n: null, a: null });
      for (let i = 0; i < nat.count; i++) if (nat.ix[i] === jx && nat.iy[i] === jy) { out.n = nat.n[i]; out.a = nat.a[i] >= 0 ? nat.a[i] : null; break; }
      return out;
    }
    if (alpha25(c.k) >= 0.5 && (L === 'share' || L === 'change' || L === 'lists' || (L === 'industry' && ind25[state.year]))) {   // the 25 km cells (M10, and M11 for the industry layer)
      const jx = Math.floor(km.x / G25), jy = Math.floor(km.y / G25), k25 = cellKey(jx, jy);
      out.grid = G25; out.ix = jx; out.iy = jy;
      if (L === 'share') { const d = c25[state.year]; if (d) { const i = d.map.get(k25); if (i != null) Object.assign(out, { n: d.n[i], a: d.a[i], ns: d.ns[i] > 0 ? d.ns[i] : null }); } }
      else if (L === 'change') { if (chg25) { const i = chg25.map.get(k25); if (i != null) Object.assign(out, { n21: chg25.n21[i], a21: chg25.a21[i], n24: chg25.n24[i], a24: chg25.a24[i], change: chg25.pp[i] / 1000, supported: chg25.cls[i] > 0 }); } }
      else if (L === 'industry') { const d = ind25[state.year]; const i = d.map.get(k25); if (i != null) Object.assign(out, indHit(d, i)); }
      else { const d = c25[2021]; if (d) { const i = d.map.get(k25); if (i != null) Object.assign(out, { n: d.n[i], sanctioned: d.ns[i] >= 5 ? d.ns[i] : null, gov: d.ng && d.ng[i] >= 5 ? d.ng[i] : null }); } }
      return out;
    }
    if (L === 'share') { const d = yearCells[state.year].get(key); if (d) Object.assign(out, { n: d.n, a: d.a, nr: d.nr, ar: d.ar, ns: d.ns }); }
    else if (L === 'change') { const i = chgMap.get(key); if (i != null) Object.assign(out, { n21: chg.n21[i], a21: chg.a21[i], n24: chg.n24[i], a24: chg.a24[i], change: chg.change_pp[i], supported: chg.supported[i] }); }
    else if (L === 'cohort') { const i = cohMap.get(key); if (i != null) Object.assign(out, { n: coh.n[i], c: coh.c[i], pct: coh.pct[i], supported: coh.supported[i] }); }
    else if (L === 'lists') { const i = listMap.get(key); if (i != null) Object.assign(out, { n: lists.n[i], sanctioned: lists.sanctioned[i], gov: lists.govstrategic[i] }); }
    else if (L === 'fin') { const i = finMap.get(key); if (i != null) Object.assign(out, { n_base: fin.n_base[i], n_obs: fin.n_obs[i], change: fin.change_pct[i] }); }
    else if (L === 'industry') { const d = ind100[state.year]; if (d) { const i = d.map.get(key); if (i != null) Object.assign(out, indHit(d, i)); } }
    return out;
  }
  const band = n => (n < 10 ? 'fewer than 10' : fmt.int(n));
  const pixelSize = km => (km >= 1 ? `${fmt.dec(km, 1)}\u00a0km` : `${Math.round(km * 1000)}\u00a0m`);   // a pixel's side at the current zoom (round 14)
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // One listed firm as a tooltip line: its mark's glyph (solid red with a statement, hollow red without one, a dotted ring before
  // its listing year), its display name from the list file (a shared name marked), and its listing year.
  // The listed glyphs of the tooltip and the panel are the legend's own three dots at 11 px (author's fix, 25 October 2026):
  // red with a statement, the land-filled ring without one that year, the neutral fill with a red rim before the listing year.
  const GLYPH = { red: () => `<span class="gl" style="background:${theme.treated}"></span>`,
                  hollow: () => `<span class="gl" style="background:${theme.land};border:2px solid ${theme.treated}"></span>`,
                  rim: () => `<span class="gl" style="background:${theme.neutral};border:2px solid rgba(227,26,28,0.8)"></span>` };
  function listedGlyph(i, year) { const yi = year - 2014; return TRN.red_from[i] > year ? GLYPH.rim() : TRN.filed[i][yi] === '1' ? GLYPH.red() : GLYPH.hollow(); }
  const listedYear = i => (TRN.undated[i] ? 'undated' : String(TRN.red_from[i]));
  const listedState = (i, year) => `${TRN.filed[i][year - 2014] === '1' ? '' : 'no '}${year} statement`;
  const LIST_WORDS = { s: 'sanctions', d: 'decree', r: 'resident', g: 'government strategic', p: 'presidential strategic' };
  const listedLists = i => (TRN.lists ? Array.from(TRN.lists[i] || '', c => LIST_WORDS[c]).filter(Boolean).join(', ') : '');
  const listedName = i => (TRN.name && TRN.name[i] ? esc(TRN.name[i]) : '<i>unnamed</i>');
  // The tooltip's short line (the glance view): the glyph, the display name and the listing year.
  const num = v => `<span class="num">${v}</span>`;   // the tile's figures in the monospace stack (round 9)
  // The firm's share of the revenue of every firm at its coordinate pair, from its most recent statement with a value up to
  // the slider's year; the year is named when it is not the slider's (the author's correction, 25 October 2026).
  function listedShare(i) {
    if (!TRN.psh) return '';
    for (let y = state.year; y >= 2014; y--) { const v = TRN.psh[i * 12 + (y - 2014)]; if (v >= 0) { const t = v >= 100 ? `${Math.round(v / 10)}%` : v >= 1 ? `${(v / 10).toFixed(1)}%` : '<0.1%'; return ` (${num(t)} of ${y === state.year ? '' : num(y) + ' '}revenue here)`; } }
    return '';
  }
  function listedRevenue(i, year) {   // the most recent statement's revenue up to the year, in millions of nominal rubles (the detail view)
    if (!TRN.rev_m) return '';
    for (let y = year; y >= 2014; y--) { const v = TRN.rev_m[i * 12 + (y - 2014)]; if (v === v) return `revenue ${y}: ${fmt.int(Math.round(v))} mn rubles`; }
    return '';
  }
  function listedLine(i) { return `${listedGlyph(i, state.year)}${listedName(i)} · ${num(listedYear(i))}${listedShare(i)}`; }
  // The Cells view's tile (round 14, the author's decision of 25 October 2026): the legend's solid red dot and a bold red number at the right end of the first line,
  // the firms on these lists (treated) present in the layer's own year at coordinates inside the hovered cell, exact and 0 included; one legend row defines it.
  function tipText(h) {
    const html = tipBody(h); if (state.mode === 'firms') return html;
    const n = listedInCell(h); if (n == null) return html;
    const i = html.indexOf('<br>'), first = i < 0 ? html : html.slice(0, i), rest = i < 0 ? '' : html.slice(i + 4);
    return `<div class="t-l1"><span>${first}</span><span class="lc"><span class="dot"></span>${fmt.int(n)}</span></div>${rest}`;
  }
  function tipBody(h) {
    const L = state.layer; const lines = [];
    if (h.region) lines.push(`<b class="loc">${esc(h.region)}</b>`);   // the region line in tracked capitals (round 10)
    if (h.kind === 'firm' || h.kind === 'listed' || h.kind === 'none' || h.kind === 'bin' || h.kind === 'pixel') {
      const ad = h.kind === 'firm' ? h : h.address, bn = h.kind === 'bin' ? h : h.bin, pxh = h.kind === 'pixel' ? h : h.pixel;
      if (pxh) {   // the pixel under the cursor (round 14): its firms on no list, their statements, the layer's statistic
        lines.push(`Pixel at the cursor, about ${pixelSize(pxh.kmPx)}: ${num(fmt.int(pxh.n))} firm${pxh.n === 1 ? '' : 's'} on no list at ${num(fmt.int(pxh.p))} coordinate pair${pxh.p === 1 ? '' : 's'}, ${num(fmt.int(pxh.a))} with a statement${pxh.n ? ` (${num(fmt.pct(100 * pxh.a / pxh.n))})` : ''}`);
        if (state.layer === 'fin') lines.push(pxh.f && pxh.cls ? `${fmt.int(pxh.f)} with a baseline and a value, median class ${CLASS_LABELS[pxh.cls - 1]}` : 'No firm with a usable baseline and a value');
        if (state.layer === 'industry') lines.push(pxh.lead ? `${esc(divShort(pxh.lead.div))} (${divPad(pxh.lead.div)}), ${pxh.lead.share}% of revenue in the pixel` : 'No firm with a revenue value in the pixel');
      }
      if (bn) {   // the square under the cursor (round 13): its firms on no list, their statements, the layer's statistic
        lines.push(`${bn.T} km square, ${num(state.year)}: ${num(fmt.int(bn.n))} firms on no list at ${num(fmt.int(bn.p))} coordinate pair${bn.p === 1 ? '' : 's'}, ${num(fmt.int(bn.a))} with a statement${bn.n ? ` (${num(fmt.pct(100 * bn.a / bn.n))})` : ''}`);
        if (state.layer === 'fin') lines.push(bn.f ? `${fmt.int(bn.f)} with a baseline and a value, median class ${CLASS_LABELS[bn.cls - 1]}` : 'No firm with a usable baseline and a value');
        if (state.layer === 'industry') lines.push(bn.lead ? `${esc(divShort(bn.lead.div))} (${divPad(bn.lead.div)}), ${bn.lead.share}% of revenue in the square` : 'No firm with a revenue value in the square');   // the short label with the code wherever the tile names a division (the author's rule of 25 October 2026); the full NACE title stays in the panel and the METHOD block
      }
      if (ad) {   // the glance view (author's rule, 25 October 2026): one figures line, one listed line, the named lines in their short form; the detail stays in the panel
        lines.push(ad.n === 1 ? `1 firm, ${ad.a ? '' : 'no '}${num(state.year)} statement` : `${num(fmt.int(ad.n))} firms, ${num(fmt.int(ad.a))} with a ${num(state.year)} statement, ${num(fmt.pct(100 * ad.a / ad.n))}`);
        if (state.layer === 'fin') lines.push(ad.f ? `${fmt.int(ad.f)} with a baseline and a value, median change ${CLASS_LABELS[ad.cls - 1]}` : 'No firm with a usable baseline and a value');
        if (state.layer === 'industry' && ad.ind != null) lines.push(ad.ind === 255 ? 'No firm with a revenue value at this coordinate pair' : `${esc(divShort(ad.ind))} (${divPad(ad.ind)}), ${ad.ish}% of revenue at this coordinate pair`);
      }
      if (h.listed) {
        const Ls = h.listed, parts = [];
        if (Ls.n === 1) parts.push(Ls.ring ? 'hollow' : Ls.red ? 'red' : 'before listing');
        else { if (Ls.red) parts.push(`${fmt.int(Ls.red)} red`); if (Ls.ring) parts.push(`${fmt.int(Ls.ring)} hollow`); if (Ls.rim) parts.push(`${fmt.int(Ls.rim)} before listing`); }
        lines.push(`${num(fmt.int(Ls.n))} on the lists: ${parts.join(', ')}`);
        if (TRN.name && Ls.top && Ls.top.length) {   // red first, then before their listing year; up to three
          const shown = narrow() ? Ls.top.slice(0, 1) : Ls.top;   // a phone-width map shows one name, then the rest as a count (the panel below lists three)
          for (const i of shown) lines.push(listedLine(i));
          if (Ls.n > shown.length) lines.push(`and ${num(fmt.int(Ls.n - shown.length))} more`);
        }
      }
      if (AN && state.mode === 'firms' && h.kind !== 'none' && h.kmx != null && Math.min(Math.hypot(h.kmx - AN.a.x_km, h.kmy - AN.a.y_km), Math.hypot(h.kmx - AN.b.x_km, h.kmy - AN.b.y_km)) * 1000 <= 35) lines.push(`The two firms of the film, ${num(fmt.int(AN.distance_m))} m apart.`);   // round 12, part D, item 5: the cursor within 35 m of either firm of the video's pair; the neighbour stays unnamed
      return lines.join('<br>');
    }
    if (h.micro) {   // a 1 km square from the address files (round 14): their population, firms on no list at house- and street-level geocodes
      if (h.n == null) lines.push(`1 km square, ${num(h.yearShown)}: no firms on no list at house- or street-level geocodes`);
      else {
        const low = L === 'share' && h.n < 50;
        lines.push(`1 km square, ${num(h.yearShown)}: ${num(fmt.int(h.n))} firm${h.n === 1 ? '' : 's'} on no list at ${num(fmt.int(h.p))} coordinate pair${h.p === 1 ? '' : 's'}, ${num(fmt.int(h.a))} with a statement` + (low ? '. Share not shown under 50 firms' : ` (${num(fmt.pct(100 * h.a / h.n))})`));
        if (L === 'industry') lines.push(h.lead ? `${esc(divShort(h.lead.div))} (${divPad(h.lead.div)}), ${h.lead.share}% of revenue in the square` : 'No firm with a revenue value in the square');
      }
      return lines.join('<br>');
    }
    if (L === 'industry') {   // the leading division and the ranked mix of the cell (round 9)
      const cell = h.fine ? '1 km cell' : `${h.grid} km cell`;
      if (h.dom == null || h.dom === 255) lines.push(`No firm with a revenue value in this ${cell}`);
      else {
        lines.push(`${cell}, ${state.year}: ${fmt.int(h.nrev)} firms with a revenue value`);
        lines.push(`Largest share of revenue: ${esc(divShort(h.dom))} (${divPad(h.dom)}), ${h.share}%`);
        if (h.lsh) lines.push(`Firms on these lists (treated) hold ${h.lsh}% of this cell’s revenue`);
      }
      return lines.join('<br>');
    }
    if (h.fine && h.n == null) { lines.push(`No located firms in this ${h.grid < 1 ? '250 m' : h.grid + ' km'} cell`); return lines.join('<br>'); }
    if (h.fine) { lines.push(`${h.grid < 1 ? '250 m' : h.grid + ' km'} cell: ${band(h.n)} located firms` + (h.a != null ? `, ${fmt.int(h.a)} with a ${h.yearShown || 2021} statement (${fmt.pct(100 * h.a / h.n)})` : h.n >= 50 ? '' : '. Share not shown under 50 firms')); return lines.join('<br>'); }
    if (L === 'share') { if (h.n == null) lines.push('No located firms in this 100 km cell'); else { lines.push(`${state.year}: ${fmt.int(h.n)} located eligible firms, ${fmt.int(h.a)} with a statement` + (h.n >= 50 ? ` (<b>${fmt.pct(100 * h.a / h.n)}</b>)` : ' (share not shown under 50 firms)')); if (h.nr) lines.push(`Registered at year-end: ${fmt.int(h.nr)}, ${fmt.int(h.ar)} with a statement (${fmt.pct(100 * h.ar / h.nr)})`); if (h.ns != null && h.ns > 0) lines.push(`Sanctions-list members (treated): ${fmt.int(h.ns)}`); } }
    else if (L === 'change') { if (h.n21 == null) lines.push('No located firms'); else lines.push(`2021: ${fmt.int(h.a21)} of ${fmt.int(h.n21)} (${fmt.pct(100 * h.a21 / h.n21)})<br>2024: ${fmt.int(h.a24)} of ${fmt.int(h.n24)} (${fmt.pct(100 * h.a24 / h.n24)})<br>` + (h.supported ? `Change <b>${fmt.signed(h.change)} points</b>` : 'Fewer than 50 firms in a year: not classed')); }
    else if (L === 'cohort') { if (h.n == null) lines.push('No located firms'); else lines.push(`${fmt.int(h.c)} of ${fmt.int(h.n)} located eligible firms in the revenue cohort by cash share` + (h.supported ? ` (<b>${fmt.pct(h.pct)}</b>)` : ' (fewer than 50 eligible: not classed)')); }
    else if (L === 'lists') { if (h.n == null) lines.push('No list members shown'); else lines.push(`${fmt.int(h.n)} located eligible firms<br>Sanctions list (treated): ${h.sanctioned == null ? 'under 5 or none' : fmt.int(h.sanctioned)}<br>Government strategic list (treated): ${h.gov == null ? 'under 5 or none' : fmt.int(h.gov)}`); }
    else if (L === 'fin') { if (h.n_base == null) lines.push('No supported cohort cell'); else lines.push(`${fmt.int(h.n_obs)} of ${fmt.int(h.n_base)} cohort firms observed in 2024<br>Median real revenue <b>${fmt.signed(h.change)}%</b> against the cell’s 2021 median`); }
    else lines.push(`100 km cell ${h.ix}, ${h.iy}`);
    return lines.join('<br>');
  }
  function drawOverlay(h) {
    octx.setTransform(stage.scale, 0, 0, stage.scale, 0, 0); octx.clearRect(0, 0, stage.width, stage.height);
    if (cross.on) {   // the crosshair at the (eased) cursor, 2 px, in the cursor colour: the full neon when still, the live variant while moving
      const cx = Math.round(cross.x) + 0.5, cy = Math.round(cross.y) + 0.5;
      octx.strokeStyle = cursorStill ? theme.cursor : theme.cursorLive; octx.lineWidth = 2; octx.globalAlpha = 0.9;
      octx.beginPath(); octx.moveTo(cx, 0); octx.lineTo(cx, stage.height); octx.moveTo(0, cy); octx.lineTo(stage.width, cy); octx.stroke(); octx.globalAlpha = 1;
    }
    if (!h) return; const c = cam();
    if (hoverRegionName && state.hover && regIndex.has(hoverRegionName)) {   // the region under the cursor outlined in the cursor colour at every zoom and in both views, inside a city window included (round 10, G13b as corrected 25 October): the cached region path, stroked with the overlay
      octx.save(); Motion.camTransform(octx, stage, c); octx.strokeStyle = theme.cursor; octx.lineWidth = 1 / c.k; octx.lineJoin = 'round'; MM.strokeHair(octx, regionPath(hoverRegionName)); octx.restore(); octx.setTransform(stage.scale, 0, 0, stage.scale, 0, 0);
    }
    // The hover ring and the cell square in the cursor colour, cased in the stage colour so they read on lilac and pale cells too (round 9).
    const cased = draw => { octx.strokeStyle = theme.stage; octx.globalAlpha = 0.6; octx.lineWidth = 4.5; draw(); octx.globalAlpha = 1; octx.strokeStyle = cursorStill ? theme.cursor : theme.cursorLive; octx.lineWidth = 2.5; draw(); };
    if (h.kind === 'firm' || h.kind === 'listed' || h.kind === 'pixel') { cased(() => { octx.beginPath(); octx.arc(h.px, h.py, h.r + 3, 0, Math.PI * 2); octx.stroke(); }); return; }   // a pixel's block takes the ring too (round 14)
    if (h.kind === 'none') return;
    const g = h.grid, o = h.origin || [0, 0];
    const x0 = o[0] + Math.floor((h.kmx - o[0]) / g) * g, y0 = o[1] + Math.floor((h.kmy - o[1]) / g) * g;
    const [px, py] = Motion.project(c, x0, y0 + g); const s = g * c.k;
    cased(() => octx.strokeRect(px, py, s, s));
  }
  // ---- camera flights (24 October 2026) ---------------------------------------------------------------
  // One animation for cell clicks, presets, the zoom buttons and the keys: the explainer's Motion.camera path
  // (cubic position, log-k zoom) run on requestAnimationFrame. The audit API jumps, so it stays deterministic;
  // a viewer who prefers reduced motion jumps too.
  const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let flight = null;
  function cancelFlight() { if (!flight) return; const f = flight; flight = null; cancelAnimationFrame(f.raf); f.resolve({ done: false, frames: f.frames, ms: performance.now() - f.t0 }); }
  // The flight's path: Motion.camera's directed interpolation over one segment, or two for a long pan (the centre moving
  // more than two viewport diagonals at the smaller k), which pulls out and back in through a middle keyframe.
  function flightPath(from, to, ms) {
    const W = stage.width, H = stage.height, dist = Math.hypot(to.cx - from.cx, to.cy - from.cy), dpx = dist * Math.min(from.k, to.k);
    const kf = [Object.assign({ t: 0 }, from), Object.assign({ t: ms }, to)];
    if (dpx > 2 * Math.hypot(W, H)) kf.splice(1, 0, { t: ms / 2, cx: (from.cx + to.cx) / 2, cy: (from.cy + to.cy) / 2, k: Math.max(kFit(), Math.min(from.k, to.k, 0.8 * minSide() / dist)) });
    return Motion.camera(kf, W, H);
  }
  function flyTo(target, { instant = false, duration = null } = {}) {
    cancelFlight(); if (!target.pull) pullFrom = null;   // a flight to a place, and the floor's settle, forget the zoom-out anchor
    const from = { cx: state.cam.cx, cy: state.cam.cy, k: state.cam.k }, to = { cx: target.cx, cy: target.cy, k: clampK(target.k) };
    const dk = Math.abs(Math.log2(to.k / from.k)), dpx = Math.hypot(to.cx - from.cx, to.cy - from.cy) * Math.min(from.k, to.k);
    if (instant || reduceMotion() || (dk < 0.01 && dpx < 0.5)) { hideHover(); state.cam = to; drawMap(); afterCameraMove(); return Promise.resolve({ done: true, frames: 0, ms: 0 }); }
    const ms = duration || Motion.clamp(600 + 250 * dk, 400, 1400);
    const path = flightPath(from, to, ms);
    hideHover();
    return new Promise(resolve => {
      const f = flight = { raf: 0, t0: performance.now(), frames: 0, resolve };
      const step = now => {
        if (flight !== f) return;
        const t = now - f.t0;
        if (t >= ms) { flight = null; state.cam = to; drawMap(); afterCameraMove(); resolve({ done: true, frames: f.frames + 1, ms: t }); return; }
        const p = path(t); state.cam = { cx: p.cx, cy: p.cy, k: p.k }; f.frames++; drawMap({ flight: true });
        f.raf = requestAnimationFrame(step);
      };
      f.raf = requestAnimationFrame(step);
    });
  }
  // Drag and wheel redraws are coalesced into one frame; drawMap itself stays synchronous.
  let drawQueued = false, drawAfter = null, drawMotion = false;
  function requestDraw(after, motion) { if (after) drawAfter = after; drawMotion = !!motion; if (drawQueued) return; drawQueued = true; requestAnimationFrame(() => { drawQueued = false; drawMap(drawMotion ? { motion: true } : undefined); drawMotion = false; const fn = drawAfter; drawAfter = null; if (fn) fn(); }); }
  function syncPresetPressed() {   // the preset the camera sits at reads as pressed (round 10, item 21): the city rung at its city, the fit at Russia
    const c = state.cam; for (const p of PRESETS) { const t = p.target(), on = String(Math.abs(t.cx - c.cx) < 0.01 && Math.abs(t.cy - c.cy) < 0.01 && Math.abs(t.k / c.k - 1) < 1e-6); p.button.setAttribute('aria-pressed', on); if (p.node) p.node.setAttribute('aria-pressed', on); }
  }
  // Motion work and settle work (round 14): a wheel step draws the map, the zoom buttons, the ruler and the tile from the hovered unit's cache; the settle, 150 ms after
  // the last step (or at once after a flight, a drag or a pinch), counts the firms in view, rebuilds the tile and the panels once, updates the strip and the wire, the
  // view's revenue mix and the presets' pressed state. Before, every wheel step ran the whole settle.
  let settleTimer = 0;
  function afterWheelStep() { syncZoomButtons(); refreshHover(); if (settleTimer) clearTimeout(settleTimer); settleTimer = setTimeout(() => { settleTimer = 0; afterCameraMove(); }, 150); }
  function afterCameraMove() { if (settleTimer) { clearTimeout(settleTimer); settleTimer = 0; } findPin = -1; /* a found firm leads the tooltip's names only until the camera moves on */ writeHash(); if (state.mode !== 'firms' && MICRO_LAYERS.has(state.layer) && state.cam.k >= 1.2) ensureMicro(microYear()); syncZoomButtons(); countFirmsInView(); wireSettled = true; try { hoverUnit.key = null; refreshHover(); updateContext(); } finally { wireSettled = false; } /* the hover's own context update counts as settled too (round 12, part D: a pointer left on the map made the rebuild wait for the debounce) */ if (!state.hover) fillMixBox(null); syncPresetPressed(); }

  // The click ladder (24 October 2026, revised the same evening): a click goes to what was clicked. The subject is the
  // city whose window holds the point (from the country, the city in the clicked 100 km cell), else the clicked cell's
  // centre. The rung is the zoom for the grid hit: the city window, a 100 km cell at 500 km across, a 25 km cell at
  // 100 km, a 5 km cell at 100 km as well, a 1 km cell at 20 km. When the rung is deeper than the view the camera flies in and
  // centres on the subject; when it is not, the view pans to the subject at its zoom, or, when the subject already sits
  // near the centre, zooms x2.5 on it. Shift+click steps out at the point. From the country an empty cell does nothing.
  // The Firms view's click ladder (round 10, the author's item): the Cells rungs by zoom alone, every landing centred on the click, and a x4 step where
  // no rung applies; Shift+click returns along the rungs (a quarter above the 20 km rung and never below it, the city rung from between the city window
  // and the 20 km rung, the fit otherwise). The Cells path below is untouched.
  function ladderTargetFirms(km, shift) {
    const k = state.cam.k, side = minSide(), kCity = side / 95, k500 = side / 500, kFine = side / 20, at = kk => ({ cx: km.x, cy: km.y, k: clampK(kk) });
    if (shift) {
      if (k > kFine * 1.02) return { target: at(Math.max(k / 4, kFine)), rung: k / 4 > kFine ? 'out' : 'fine' };
      if (k > kCity * 1.02) return { target: at(kCity), rung: 'city' };
      return { target: fitTarget(), rung: 'fit' };
    }
    if (k >= kFine * 0.98) return { target: at(k * 4), rung: 'zoom' };
    if (k >= kCity * 0.98) return { target: at(kFine), rung: 'fine' };
    const ix = Math.floor(km.x / 100), iy = Math.floor(km.y / 100), cells = yearCells[state.year] || yearCells[2021];
    if (!cells.has(cellKey(ix, iy))) return { target: at(k * 4), rung: 'zoom' };
    if (cityInCell(ix, iy) || k >= k500 * 0.98) return { target: at(kCity), rung: 'city' };
    return { target: at(k500), rung: 'cell' };
  }
  function ladderTarget(h, km, shift) {
    if (state.mode === 'firms') return ladderTargetFirms(km, shift);
    if (shift) return { target: stepAt(km, 1 / 2.5), rung: 'out' };
    const k = state.cam.k, c = cam(), near = Math.hypot(km.px - c.ox, km.py - c.oy) < 0.15 * minSide();
    const zoomOn = (x, y) => ({ target: { cx: x, cy: y, k: clampK(k * 2.5) }, rung: 'zoom' });
    const ix = Math.floor(h.kmx / 100), iy = Math.floor(h.kmy / 100), city = cityInCell(ix, iy);
    let t;
    if (k < 1.5) {
      const has = state.layer === 'density' ? yearCells[2021].has(cellKey(ix, iy)) : (h.n != null || h.n21 != null || h.n_base != null || h.sanctioned != null || h.gov != null || h.c != null || h.dom != null);
      if (!has) return null;
      t = city ? { target: cityTarget(city), rung: 'city' } : { target: cellTarget(ix, iy), rung: 'cell' };
    } else if ((h.fine && h.grid < 5) || h.micro) {
      const g = h.grid, o = h.origin || [0, 0], cx = o[0] + Math.floor((h.kmx - o[0]) / g) * g + g / 2, cy = o[1] + Math.floor((h.kmy - o[1]) / g) * g + g / 2;
      t = g === 1 ? { target: fineTarget(cx, cy), rung: 'fine' } : zoomOn(cx, cy);
    } else {
      const g = h.grid || 100, cx = Math.floor(h.kmx / g) * g + g / 2, cy = Math.floor(h.kmy / g) * g + g / 2;
      if (city && Math.abs(city.x - h.kmx) <= 45 && Math.abs(city.y - h.kmy) <= 45) t = { target: cityTarget(city), rung: 'city' };
      else t = { target: { cx, cy, k: minSide() / (g < 100 ? 100 : 500) }, rung: 'cell' };   // a 25 km or 5 km cell at 100 km across, a 100 km cell at 500
    }
    if (t.target.k > k * 1.02) return t;
    if (!near) return { target: { cx: t.target.cx, cy: t.target.cy, k }, rung: 'pan' };
    return zoomOn(t.target.cx, t.target.cy);
  }
  const kmFromPx = (x, y) => { const c = cam(); return { x: c.cx + (x - c.ox) / c.k, y: c.cy - (y - c.oy) / c.k, px: x, py: y }; };
  function clickAt(x, y, shift) { const km = kmFromPx(x, y); const h = hitAt(km); h.kmx = km.x; h.kmy = km.y; const r = ladderTarget(h, km, shift); if (r) flyTo(r.target); return r; }

  // ---- pointer input: hover, drag, pinch, click and tap --------------------------------------------------
  const PRESS_PX = 5, PRESS_MS = 300, TAP_MS = 450, TAP_PX = 20;
  const WHEEL_RATE = 0.0015, PINCH_RATE = 0.018;   // zoom per pixel of wheel delta: a mouse wheel or two-finger scroll, and a trackpad pinch (author's tuning, 24 October 2026)
  const pointers = new Map(); let press = null, pinch = null, lastPointer = null, lastTap = null;
  const overControl = (ev, sel) => !!(ev.target && ev.target.closest && ev.target.closest(sel));
  function localXY(ev) { const r = wrap.getBoundingClientRect(); return { x: ev.clientX - r.left, y: ev.clientY - r.top }; }
  function hideHover(opts = {}) { /* keepRegion: a wheel tick keeps the hovered region (and its fill) until the settled hover re-reads it, so the strip and the map do not flip twice a tick */ $('tip').style.display = 'none'; undockTile(); state.hover = null; if (hoverRegionName && !opts.keepRegion) { hoverRegionName = null; updateContext(); requestDraw(); } crossOff(); drawOverlay(null); wrap.classList.remove('clickable', 'zoomable'); if (opts.keepRegion) return; hoverUnit.key = null; fillMixBox(null); }   // a wheel step (keepRegion) keeps the hovered unit's cache and leaves the mix box to the settle (round 14: the view's mix cost 13 ms a step in the Firms view)
  function syncCursor(h) {
    const r = h && !press ? ladderTarget(h, kmFromPx(h.px0, h.py0), false) : null;
    wrap.classList.toggle('clickable', !!r && r.rung !== 'zoom'); wrap.classList.toggle('zoomable', !!r && r.rung === 'zoom');
  }
  // ---- the cursor tile, the crosshair and the still state (round 9, 25 October 2026) ------------------------------------
  // The tile is the glance view: the tooltip's lines, a class-mix bar on the industry layer and a footer with the cursor's
  // coordinate (the inverse of the basemap's projection) and the scale (metres per CSS pixel). It is placed clear of the hovered
  // mark and of every panel; the crosshair runs across the map at the cursor in the cursor colour, the live variant while the
  // cursor moves and the resting neon once it has been still for 200 ms, easing toward the cursor over 120 ms (a snap under
  // reduced motion).
  const LAEA = { lam0: BM.projection.longitude_origin * Math.PI / 180, phi0: BM.projection.latitude_origin * Math.PI / 180, R: BM.projection.earth_radius_km };
  function inverseLAEA(x, y) {
    const { lam0, phi0, R } = LAEA, rho = Math.hypot(x, y); if (rho < 1e-9) return [phi0 * 180 / Math.PI, lam0 * 180 / Math.PI];
    const c = 2 * Math.asin(Math.min(1, rho / (2 * R))), sc = Math.sin(c), cc = Math.cos(c);
    const phi = Math.asin(Math.max(-1, Math.min(1, cc * Math.sin(phi0) + y * sc * Math.cos(phi0) / rho)));
    let lam = lam0 + Math.atan2(x * sc, rho * Math.cos(phi0) * cc - y * Math.sin(phi0) * sc);
    lam = ((lam * 180 / Math.PI + 540) % 360) - 180; return [phi * 180 / Math.PI, lam];
  }
  const scaleParts = k => { const m = 1000 / k; return m >= 1000 ? [(m / 1000).toFixed(1), ' km'] : m >= 10 ? [String(Math.round(m)), ' m'] : [m.toFixed(1), ' m']; };
  // Firms in view (round 11, the author's item 3): the firms on no list at the addresses inside the visible range plus the listed firms present in the year, counted
  // once per settle (a camera move's end, a year's data arriving, a view switch), never per frame; the tile's footer shows the count in the Firms view and ticks it
  // with the other figures when the camera moves under a still cursor.
  let viewFirms = null;
  function countFirmsInView() {
    const d = state.mode === 'firms' ? firmYears.get(state.year) : null; if (!d) { viewFirms = null; return null; }
    const c = cam(), k = c.k, x0 = (c.cx - c.ox / k) * 1000, x1 = (c.cx + (stage.width - c.ox) / k) * 1000, y0 = (c.cy - (stage.height - c.oy) / k) * 1000, y1 = (c.cy + c.oy / k) * 1000;
    let n = 0; const i0 = lowerBound(d.x, x0), i1 = lowerBound(d.x, x1), Y = d.y, N = d.nn; for (let i = i0; i < i1; i++) { const yv = Y[i]; if (yv >= y0 && yv <= y1) n += N[i]; }
    if (TRN) { const yi = state.year - 2014; for (let i = 0; i < TRN.n; i++) { if (TRN.filed[i][yi] === '-') continue; const xm = TRN.x[i] * 1000, ym = TRN.y[i] * 1000; if (xm >= x0 && xm <= x1 && ym >= y0 && ym <= y1) n++; } }
    viewFirms = n; return n;
  }
  const foot = { lat: 0, lon: 0, scale: 0, firms: 0, raf: 0 };
  function fillFoot(km, tick) {
    const [lat, lon] = inverseLAEA(km.x, km.y), [sv, su] = scaleParts(cam().k), target = { lat: Math.abs(lat), lon: Math.abs(lon), scale: +sv, firms: viewFirms == null ? 0 : viewFirms };
    $('tlatH').textContent = lat >= 0 ? 'N' : 'S'; $('tlonH').textContent = lon >= 0 ? 'E' : 'W'; $('tunit').textContent = su; $('tfirmsw').hidden = viewFirms == null;
    const write = v => { $('tlat').textContent = v.lat.toFixed(2); $('tlon').textContent = v.lon.toFixed(2); $('tscale').textContent = su === ' km' || +sv % 1 ? v.scale.toFixed(1) : String(Math.round(v.scale)); $('tfirms').textContent = fmt.int(Math.round(v.firms)); };
    if (foot.raf) { cancelAnimationFrame(foot.raf); foot.raf = 0; }
    if (!tick || reduceMotion() || foot.scale === 0) { Object.assign(foot, target); write(foot); return; }
    const from = { lat: foot.lat, lon: foot.lon, scale: foot.scale, firms: foot.firms }, t0 = performance.now();   // a camera moved under a still cursor: the figures count to the new values
    const step = () => { foot.raf = 0; const u = Math.min(1, (performance.now() - t0) / 200), e = Motion.ease.outCubic(u); const v = { lat: from.lat + (target.lat - from.lat) * e, lon: from.lon + (target.lon - from.lon) * e, scale: from.scale + (target.scale - from.scale) * e, firms: from.firms + (target.firms - from.firms) * e }; write(u >= 1 ? target : v); if (u < 1) foot.raf = requestAnimationFrame(step); else Object.assign(foot, target); };
    wrap.classList.add('cursor-live'); foot.raf = requestAnimationFrame(step); setTimeout(() => { if (cursorStill) wrap.classList.remove('cursor-live'); }, 220);
  }
  function tileObstacles() {
    if (obsCache) return obsCache;
    const m = wrap.getBoundingClientRect();
    return obsCache = ['legend', 'mapnote', 'mixbox', 'zoombox', 'scalebar', 'ctxstrip'].map(id => { const el = $(id); if (!el || el.hidden) return null; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 ? { id, x: r.left - m.left, y: r.top - m.top, x1: r.right - m.left, y1: r.bottom - m.top } : null; }).filter(Boolean);
  }
  const meets = (a, b, g = 2) => a.x < b.x1 + g && a.x1 > b.x - g && a.y < b.y1 + g && a.y1 > b.y - g;
  // Eight anchors around the cursor, each keeping d px of clearance on at least one axis so the tile never covers the hovered
  // mark; the first inside the map and clear of every panel wins; a second pass slides the anchors along their free axis.
  function placeTile(x, y, tw, th, obsAll, touch, r) {   // tiers: every panel; then without the note; then without the legend; then without both (the controls, the scale bar and the strip always stay clear)
    const tiers = [[], ['mapnote'], ['legend'], ['mapnote', 'legend'], ['mixbox'], ['mapnote', 'mixbox'], ['legend', 'mixbox'], ['mapnote', 'legend', 'mixbox']];   // the mix box joins the readouts the tile may cover last (round 11: the footer's firms line made the tile 16 px taller, and a 400 px map with the industry mix open had no clear place)
    // a tap's 24 px gives way to the hover's clearance before the last resort (round 14: the search lands the firm at the map's centre, where a 360 px phone had no place for a tall tile at 24 px)
    for (const d of touch ? [24, Math.max(14, r + 9)] : [Math.max(14, r + 9)]) for (const drop of tiers) { const obs = drop.length ? obsAll.filter(o => !drop.includes(o.id)) : obsAll; const b = placeTileAmong(x, y, tw, th, obs, touch, r, d); if (!b.fallback) { if (drop.length) b.relaxed = drop.map(id => id === 'mapnote' ? 'note' : id === 'mixbox' ? 'mix' : id); return b; } }
    return placeTileAmong(x, y, tw, th, obsAll, touch, r);
  }
  // The docked tile (round 14, the author's decision of 25 October 2026): on a map under 600 px wide, where the floating tile has no clear place, the tile spans the map's
  // width less 12 px margins along its top edge, so its lines wrap less and it is shorter. It may cover the note, the mix box and the legend, never the zoom box, the scale
  // bar or the strip, and the point stays below it with the hover's clearance, the crosshair joining the two.
  function dockTile(x, y, obs, r) {
    const tip = $('tip'), d = Math.max(14, r + 9);
    tip.classList.add('docked'); tip.style.width = (stage.width - 24) + 'px';
    const b = { x: 12, y: 12, x1: stage.width - 12, y1: 12 + tip.offsetHeight, anchor: -3, docked: true };
    if (y >= b.y1 + d && !obs.some(o => (o.id === 'zoombox' || o.id === 'scalebar' || o.id === 'ctxstrip') && meets(b, o))) {
      const soft = obs.filter(o => (o.id === 'mapnote' || o.id === 'mixbox' || o.id === 'legend') && meets(b, o)).map(o => (o.id === 'mapnote' ? 'note' : o.id === 'mixbox' ? 'mix' : o.id));
      if (soft.length) b.relaxed = soft;
      return b;
    }
    undockTile(); return null;
  }
  function undockTile() { const tip = $('tip'); tip.classList.remove('docked'); tip.style.width = ''; }
  function placeTileAmong(x, y, tw, th, obs, touch, r, dd) {
    const d = dd != null ? dd : touch ? 24 : Math.max(14, r + 9), W = stage.width, H = stage.height;
    const cands = [[x + d, y + d], [x - d - tw, y + d], [x + d, y - d - th], [x - d - tw, y - d - th], [x - tw / 2, y + d], [x - tw / 2, y - d - th], [x + d, y - th / 2], [x - d - tw, y - th / 2]];
    const order = touch ? [5, 2, 3, 4, 0, 1, 6, 7] : [0, 1, 2, 3, 4, 5, 6, 7];
    const inside = b => b.x >= 0 && b.y >= 0 && b.x1 <= W - 1 && b.y1 <= H - 4, clearOf = b => !obs.some(o => meets(b, o));
    for (const i of order) { const [bx, by] = cands[i], b = { x: bx, y: by, x1: bx + tw, y1: by + th, anchor: i }; if (inside(b) && clearOf(b)) return b; }
    for (const i of order) {   // the slide pass: push the anchor out of whatever it meets along its free axis, away from the obstacle first and then the other way
      const [bx, by] = cands[i], slideX = i === 4 || i === 5;
      for (const dir of [0, 1]) {
        const b = { x: bx, y: by, x1: bx + tw, y1: by + th, anchor: i, slid: true };
        for (let step = 0; step < 6; step++) { const hit = obs.find(o => meets(b, o)); if (!hit) break;
          if (slideX) { const away = (b.x + b.x1) / 2 < (hit.x + hit.x1) / 2, dx = (away !== !!dir) ? hit.x - 2 - b.x1 : hit.x1 + 2 - b.x; b.x += dx; b.x1 += dx; }
          else { const away = (b.y + b.y1) / 2 < (hit.y + hit.y1) / 2, dy = (away !== !!dir) ? hit.y - 2 - b.y1 : hit.y1 + 2 - b.y; b.y += dy; b.y1 += dy; } }
        if (inside(b) && clearOf(b)) return b;
      }
    }
    // The search pass (corners and narrow maps): the nearest position on a 16 px grid that is inside the map, clear of every
    // panel and keeps d px between its box and the cursor on both axes; at most a few thousand cheap tests, only when every
    // anchor failed.
    let best = null, bestD = Infinity;
    for (let by = 0; by <= H - th - 4; by += 16) for (let bx = 0; bx <= W - tw - 1; bx += 16) {
      const ddx = Math.max(bx - d - x, x - (bx + tw + d), 0), ddy = Math.max(by - d - y, y - (by + th + d), 0); if (ddx === 0 && ddy === 0) continue;
      const dist = Math.hypot(ddx, ddy); if (dist >= bestD) continue;
      const b = { x: bx, y: by, x1: bx + tw, y1: by + th }; if (!clearOf(b)) continue;
      bestD = dist; best = b;
    }
    if (best) return { x: best.x, y: best.y, x1: best.x1, y1: best.y1, anchor: -2, searched: true };
    const fx = Math.max(0, Math.min(x + d, W - tw - 1)), fy = Math.max(0, Math.min(y - 10, H - th - 4)); return { x: fx, y: fy, x1: fx + tw, y1: fy + th, anchor: -1, fallback: true };
  }
  let tileState = null, stillTimer = 0, cursorStill = true;
  const cross = { on: false, x: 0, y: 0, tx: 0, ty: 0, x0: 0, y0: 0, t0: 0, raf: 0 };
  function crossOff() { cross.on = false; if (cross.raf) { cancelAnimationFrame(cross.raf); cross.raf = 0; } if (stillTimer) { clearTimeout(stillTimer); stillTimer = 0; } cursorStill = true; wrap.classList.remove('cursor-live'); }
  function setCross(x, y, snap) {
    cross.tx = x; cross.ty = y;
    if (snap || !cross.on || reduceMotion()) { cross.on = true; cross.x = x; cross.y = y; if (cross.raf) { cancelAnimationFrame(cross.raf); cross.raf = 0; } return; }
    cross.x0 = cross.x; cross.y0 = cross.y; cross.t0 = performance.now(); if (!cross.raf) cross.raf = requestAnimationFrame(easeCross);
  }
  function easeCross() {
    cross.raf = 0; const u = Math.min(1, (performance.now() - cross.t0) / 120), e = Motion.ease.outCubic(u);
    cross.x = cross.x0 + (cross.tx - cross.x0) * e; cross.y = cross.y0 + (cross.ty - cross.y0) * e;
    drawOverlay(state.hover); if (u < 1) cross.raf = requestAnimationFrame(easeCross);
  }
  function armStill(touch) {
    if (stillTimer) clearTimeout(stillTimer);
    if (touch) { cursorStill = true; wrap.classList.remove('cursor-live'); return; }
    cursorStill = false; wrap.classList.add('cursor-live');
    stillTimer = setTimeout(() => { stillTimer = 0; cursorStill = true; wrap.classList.remove('cursor-live'); drawOverlay(state.hover); maybeTip(); }, 200);
  }
  function showHoverAt(x, y, opts = {}) {
    const km = kmFromPx(x, y); const h = hitAt(km); h.kmx = km.x; h.kmy = km.y; h.px0 = x; h.py0 = y; state.hover = h;
    if (h.region === undefined) h.region = regionAt(x, y);
    { const rn = h.region && regIndex.has(h.region) ? h.region : null; if (rn !== hoverRegionName) { hoverRegionName = rn; updateContext(); requestDraw(); } }   // the map redraws with the region's fill on a region change only, coalesced with any queued draw   // the strip follows the cursor's region (round 10)
    const tip = $('tip'), key = unitKey(h), fresh = key !== hoverUnit.key;
    if (fresh) $('tipbody').innerHTML = tipText(h);
    fillFoot(km, !!opts.tick); tip.style.display = 'block'; if (tip.classList.contains('docked')) undockTile();   // the floating form is measured and placed first
    const foot = ['tlat', 'tlon', 'tscale', 'tunit', 'tfirms'].map(id => $(id).textContent.length).join(',') + ($('tfirmsw').hidden ? 'h' : '');
    if (fresh || foot !== hoverUnit.foot || !hoverUnit.tw) { hoverUnit.tw = tip.offsetWidth; hoverUnit.th = tip.offsetHeight; hoverUnit.foot = foot; }   // one forced layout per unit or footer width change
    const tw = hoverUnit.tw, th = hoverUnit.th, obs = tileObstacles();   // the panels' boxes are read once per layout
    const mark = h.kind === 'firm' || h.kind === 'listed' || h.kind === 'pixel'; let b = placeTile(x, y, tw, th, obs, !!opts.touch, mark ? h.r : 0);
    if (b.fallback && narrow()) { const dk = dockTile(x, y, obs, mark ? h.r : 0); if (dk) b = dk; }
    tip.style.left = b.x + 'px'; tip.style.top = b.y + 'px';
    tileState = { box: b, cursor: [x, y], mark: mark ? [h.px, h.py] : null, anchor: b.anchor, fallback: !!b.fallback, slid: !!b.slid, searched: !!b.searched, docked: !!b.docked, relaxed: b.relaxed || null };
    setCross(x, y, !!opts.touch); drawOverlay(h); syncCursor(h); armStill(!!opts.touch);
    if (fresh) { drawCellPanel(h); fillMixBox(h); hoverUnit.key = key; }   // the panel, its chart and the mix box once per hovered unit
    return h;
  }
  // The hovered unit (round 14): what the tile, the panel and the mix box describe. Equal keys give equal text, so a move inside the unit rewrites nothing but the footer.
  function unitKey(h) {
    const g = h.grid, o = h.origin || [0, 0], L = h.listed, ad = h.kind === 'firm' ? h : h.address, bn = h.kind === 'bin' ? h : h.bin;
    const cell = g != null && h.kmx != null ? Math.floor((h.kmx - o[0]) / g) + ',' + Math.floor((h.kmy - o[1]) / g) : '';
    const pair = !!(AN && state.mode === 'firms' && h.kind !== 'none' && h.kmx != null && Math.min(Math.hypot(h.kmx - AN.a.x_km, h.kmy - AN.a.y_km), Math.hypot(h.kmx - AN.b.x_km, h.kmy - AN.b.y_km)) * 1000 <= 35);
    const pxh = h.kind === 'pixel' ? h : h.pixel;
    return [state.mode, state.layer, state.year, theme.dark ? 1 : 0, narrow() ? 1 : 0, h.kind || 'cell', h.region || '', g, o.join(','), cell, h.fine ? 1 : 0, h.micro ? 1 : 0, h.city || '', ad ? ad.rec : '', bn ? bn.T + ':' + bn.j : '', pxh ? pxh.cell.join(',') + '@' + pxh.camKey : '', L ? [L.n, L.red, L.ring, L.rim, L.top.join('.'), L.within_km.toFixed(4)].join(':') : '', pair ? 1 : 0].join('|');
  }
  let hoverQueued = false;
  function refreshHover() { if (press || pinch || flight || !lastPointer || !lastPointer.inside) return; showHoverAt(lastPointer.x, lastPointer.y, { tick: true, touch: cursorStill }); }
  function startPinch() { const [p, q] = [...pointers.values()]; return { d: Math.max(1, Math.hypot(p.x - q.x, p.y - q.y)), mid: { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 } }; }
  function movePinch() { const [p, q] = [...pointers.values()]; const d = Math.max(1, Math.hypot(p.x - q.x, p.y - q.y)), mid = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }, c = cam(); const km = { x: c.cx + (pinch.mid.x - c.ox) / c.k, y: c.cy - (pinch.mid.y - c.oy) / c.k, px: mid.x, py: mid.y }; const t = zoomStep(d / pinch.d, km); state.cam = { cx: t.cx, cy: t.cy, k: t.k }; pinch.d = d; pinch.mid = mid; requestDraw(); }   // the point under the previous midpoint stays under the new one (zoom and pan), through zoomStep for the pull
  wrap.addEventListener('pointerdown', ev => {
    if (overControl(ev, '.zoombox, .toggle') || (ev.pointerType === 'mouse' && ev.button !== 0)) return;
    cancelFlight(); try { wrap.setPointerCapture(ev.pointerId); } catch (e) { /* capture is optional */ }
    const p = localXY(ev); pointers.set(ev.pointerId, p);
    if (pointers.size === 1) press = { id: ev.pointerId, x: p.x, y: p.y, t: performance.now(), moved: false, shift: ev.shiftKey, type: ev.pointerType, last: p };
    else if (pointers.size === 2) { press = null; wrap.classList.remove('dragging'); pinch = startPinch(); hideHover(); }
  });
  wrap.addEventListener('pointermove', ev => {
    const p = localXY(ev);
    if (pointers.has(ev.pointerId)) pointers.set(ev.pointerId, p);
    if (pinch) { if (pointers.size === 2) movePinch(); return; }
    if (press && press.id === ev.pointerId) {
      if (!press.moved && Math.hypot(p.x - press.x, p.y - press.y) > PRESS_PX) { press.moved = true; wrap.classList.add('dragging'); hideHover(); }
      if (press.moved) { pullFrom = null; const c = cam(); state.cam.cx -= (p.x - press.last.x) / c.k; state.cam.cy += (p.y - press.last.y) / c.k; press.last = p; requestDraw(); }
      return;
    }
    if (ev.pointerType !== 'touch') { lastPointer = { x: p.x, y: p.y, inside: true }; if (!flight && !overControl(ev, '.zoombox, .toggle')) showHoverAt(p.x, p.y); }
  });
  function endPointer(ev) {
    const p = localXY(ev); pointers.delete(ev.pointerId);
    if (pinch) { if (pointers.size < 2) { pinch = null; if (atFloor(state.cam.k)) flyTo(fitTarget(), { duration: 300 }); else requestDraw(afterCameraMove); } return; }
    if (!press || press.id !== ev.pointerId) return;
    const pr = press; press = null; wrap.classList.remove('dragging');
    if (pr.moved) { requestDraw(afterCameraMove); return; }
    if (ev.type !== 'pointerup' || performance.now() - pr.t > PRESS_MS) return;
    if (pr.type === 'mouse') { clickAt(p.x, p.y, pr.shift); return; }
    // a touch or pen tap selects the cell; a second tap within 350 ms flies the ladder
    const now = performance.now();
    if (lastTap && now - lastTap.t <= TAP_MS && Math.hypot(p.x - lastTap.x, p.y - lastTap.y) <= TAP_PX) { lastTap = null; clickAt(p.x, p.y, false); return; }
    lastTap = { x: p.x, y: p.y, t: now }; lastPointer = { x: p.x, y: p.y, inside: true }; showHoverAt(p.x, p.y, { touch: true });
  }
  wrap.addEventListener('pointerup', endPointer);
  wrap.addEventListener('pointercancel', endPointer);
  wrap.addEventListener('pointerleave', ev => { if (ev.pointerType !== 'touch' && !press && !pinch) { lastPointer = lastPointer ? { x: lastPointer.x, y: lastPointer.y, inside: false } : null; hideHover(); } });
  wrap.addEventListener('wheel', ev => {
    if (overControl(ev, '.zoombox')) return;
    ev.preventDefault(); cancelFlight();
    // A trackpad pinch arrives as a wheel with the Ctrl flag and small deltas (the phone's pinch is a touch gesture,
    // handled apart); it takes PINCH_RATE against the wheel's WHEEL_RATE. Line- and page-based wheels are scaled to pixels.
    const dy = ev.deltaY * (ev.deltaMode === 1 ? 20 : ev.deltaMode === 2 ? 400 : 1);
    const km = kmAt(ev); const f = Math.exp(-dy * (ev.ctrlKey ? PINCH_RATE : WHEEL_RATE)); const t = zoomStep(f, km);
    if (ev.pointerType !== 'touch') lastPointer = { x: km.px, y: km.py, inside: true };
    hideHover({ keepRegion: true });
    if (atFloor(t.k)) { flyTo(t, { duration: 300 }); return; }   // fully zoomed out: settle on the country's centre
    state.cam = { cx: t.cx, cy: t.cy, k: t.k };
    requestDraw(afterWheelStep, true);
  }, { passive: false });
  // Keys, when the map has focus: + and − zoom one step, 0 fits the country, the arrows pan (Shift: a small step).
  wrap.addEventListener('keydown', ev => {
    if (ev.target !== wrap) return;
    const panPx = Math.round(minSide() * (ev.shiftKey ? 0.05 : 0.2));
    const pan = (dx, dy) => flyTo({ cx: state.cam.cx + dx / state.cam.k, cy: state.cam.cy - dy / state.cam.k, k: state.cam.k }, { duration: 250 });
    switch (ev.key) {
      case '+': case '=': flyTo(stepCentre(2)); break;
      case '-': case '_': flyTo(stepCentre(0.5)); break;
      case '0': flyTo(fitTarget()); break;
      case 'ArrowLeft': pan(-panPx, 0); break; case 'ArrowRight': pan(panPx, 0); break;
      case 'ArrowUp': pan(0, -panPx); break; case 'ArrowDown': pan(0, panPx); break;
      default: return;
    }
    ev.preventDefault();
  });
  // The zoom box (bottom right) and the scale bar beside it.
  $('zoom-in').addEventListener('click', () => flyTo(stepCentre(2)));
  $('zoom-out').addEventListener('click', () => flyTo(stepCentre(0.5)));
  $('zoom-fit').addEventListener('click', () => flyTo(fitTarget()));
  function syncZoomButtons() { $('zoom-out').disabled = state.cam.k <= kFloor() * 1.001; $('zoom-in').disabled = state.cam.k >= K_MAX * 0.999; }
  // The ruler (round 12, part D, the author's request of 25 October 2026): a line of fixed length with major ticks at a nice step (1, 2, 5 times a power of ten, in km) that
  // follows the zoom, a minor tick at each half step, the numbers under the major ticks and the unit at the top right; the ruler's line starts 15 px in, so the end labels
  // stay inside the box. The step is the smallest that puts the majors at least 28 px apart on a wide map (14 px on a phone-width map, where only every second major
  // is numbered); every tick sits at i times the step times the zoom, so the ruler is exact at every zoom. Redrawn on every settled draw and wheel step, never on a flight frame.
  const RULER_STEPS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000], RULER_PAD = 15;
  let lastRuler = '', rulerState = null;
  function drawScaleBar() {
    dropObstacles();
    const box = $('scalebar'), svg = $('ruler'), k = state.cam.k, Wc = box.clientWidth - 16; if (!(Wc > 0)) return;
    const L = Wc - 2 * RULER_PAD; let s = RULER_STEPS[RULER_STEPS.length - 1]; for (const v of RULER_STEPS) { if (v * k >= 14) { s = v; break; } }   // majors at least 14 px apart
    const n = Math.max(1, Math.floor(L / (s * k))), unit = s < 1 ? 'm' : 'km', key = [Wc, k.toFixed(6), s].join('|'); if (key === lastRuler) return; lastRuler = key;
    { const f = k / kFit(); $('zoomfactor').textContent = '×' + (f < 1 ? f.toFixed(2) : f < 10 ? f.toFixed(1) : fmt.int(Math.round(f))); }   // the zoom as a factor of the country view, beside the fit button's icon (the author's note of 25 October 2026): ×1.0 at the fit, ×0.75 at the floor
    const labM = i => String(Math.round(s * i * (unit === 'm' ? 1000 : 1))), labW = Motion.measure(mctx, labM(n), 12, 500, 0), every = Math.max(1, Math.ceil((labW + 4) / (s * k)));   // numbers on every major, or every second, third, as the widest number allows
    const unitShown = unit === 'm' && s * every >= 1 && Math.abs(s * every - Math.round(s * every)) < 1e-9 ? 'km' : unit, lab = i => String(Math.round(s * i * (unitShown === 'm' ? 1000 : 1)));   // whole kilometres read as km even on a half-kilometre step; a step and a half stays in metres
    const X = i => +(RULER_PAD + i * s * k).toFixed(2), ticks = []; let d = `M${RULER_PAD} 14.5H${X(n)}`;
    for (let i = 0; i <= n; i++) { d += ` M${X(i)} 14V23`; if (i % every === 0) ticks.push({ i, x: X(i), label: lab(i) }); }
    for (let i = 0; i < n; i++) d += ` M${+(RULER_PAD + (i + 0.5) * s * k).toFixed(2)} 14V18`;
    svg.setAttribute('width', Wc); svg.setAttribute('viewBox', `0 0 ${Wc} 34`);
    svg.innerHTML = `<path d="${d}" class="rl"/>` + ticks.map(t => `<text x="${t.x}" y="33" text-anchor="middle">${t.label}</text>`).join('') + `<text x="${Wc}" y="9" text-anchor="end" class="unit">${unitShown}</text>`;
    rulerState = { k, step: s, unit: unitShown, n, every, ticks, width: Wc, line: L, labW, pad: RULER_PAD };
  }

  // ---- side panels -------------------------------------------------------------------------------
  function chartCtx(id) { const c = $(id); const r = c.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1; c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr); const ctx = c.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, r.width, r.height); Motion.audit.scene = id; window.__atlasCanvases[id] = { w: r.width, h: r.height }; return { ctx, w: r.width, h: r.height }; }
  function drawCellPanel(h) {
    if (!cardOpen('cursor')) return;
    // The panel's rows (the author's correction of 25 October): one short label per row in tracked capitals, the value at the left and wrapping, the leading division as its
    // short name with the code and the share and its class beneath, the ranked mix as swatch rows, each listed firm as a name line with its listing year and one muted line
    // of state, memberships and revenue; the cell-series provenance lives in the method block. The tooltip keeps the glance view; this is the detail view.
    const info = $('cellinfo'); const rows = [], y = state.year, L = state.layer;
    const row = (k, v, t) => rows.push([k, v, t]);
    const pct = (a, n) => fmt.pct(100 * a / n);
    const lead = (code, share) => (code === 0 ? `no OKVED 2 division code&nbsp;·&nbsp;${share}%` : `<span class="ksw" style="background:${mixColour(code)}"></span>${esc(divShort(code))} (${divPad(code)})&nbsp;·&nbsp;${share}%<span class="sub">${esc(indClassLabel(code))}</span>`);
    const mixRows = (list, rest) => '<div class="mix">' + list.map(m => `<div class="r"><span class="ksw" style="background:${mixColour(m.code)}"></span><span class="nm" title="${esc(m.title)} (${divPad(m.code)})">${esc(m.short)} (${divPad(m.code)})</span><span class="pc">${m.share ? m.share + '%' : '<1%'}</span></div>`).join('') + (rest ? `<div class="r"><span class="ksw"></span><span class="nm">other divisions</span><span class="pc">${rest}%</span></div>` : '') + '</div>';
    if (h && h.region) row('Region', esc(h.region), 'loc');
    const cellHit = !!h && !h.micro && h.kind !== 'firm' && h.kind !== 'listed' && h.kind !== 'none' && h.kind !== 'bin' && h.kind !== 'pixel', ad = h && (h.kind === 'firm' ? h : h.address), bn = h && (h.kind === 'bin' ? h : h.bin), pxh = h && (h.kind === 'pixel' ? h : h.pixel);
    if (pxh) {   // the pixel under the cursor (round 14)
      row('Pixel', `about ${pixelSize(pxh.kmPx)}`); row('Firms', `${fmt.int(pxh.n)} on no list at ${fmt.int(pxh.p)} pair${pxh.p === 1 ? '' : 's'}`); row(`${y} statement`, pxh.n ? `${fmt.int(pxh.a)} (${pct(pxh.a, pxh.n)})` : 'none');
      if (L === 'fin') { if (pxh.f && pxh.cls) { row('Baseline', `${fmt.int(pxh.f)} with a value`); row('Median class', CLASS_LABELS[pxh.cls - 1]); } else row('Baseline', 'no usable baseline and value'); }
      if (L === 'industry') row('Leading', pxh.lead ? lead(pxh.lead.div, pxh.lead.share) : 'no firm with a revenue value');
    }
    if (bn) {   // the square under the cursor (round 13)
      row('Square', `${bn.T} km`); row('Firms', `${fmt.int(bn.n)} on no list at ${fmt.int(bn.p)} pair${bn.p === 1 ? '' : 's'}`); row(`${y} statement`, bn.n ? `${fmt.int(bn.a)} (${pct(bn.a, bn.n)})` : 'none');
      if (L === 'fin') { if (bn.f) { row('Baseline', `${fmt.int(bn.f)} with a value`); row('Median class', CLASS_LABELS[bn.cls - 1]); } else row('Baseline', 'no usable baseline and value'); }
      if (L === 'industry') row('Leading', bn.lead ? lead(bn.lead.div, bn.lead.share) : 'no firm with a revenue value');
    }
    if (h && h.micro) {   // a 1 km square from the address files (round 14)
      row('Square', `1 km, ${h.yearShown}`);
      if (h.n == null) row('Firms', 'none on no list at house- or street-level geocodes');
      else { row('Firms', `${fmt.int(h.n)} on no list at ${fmt.int(h.p)} pair${h.p === 1 ? '' : 's'}`); row(`${h.yearShown} statement`, `${fmt.int(h.a)}` + (L === 'share' && h.n < 50 ? ', share not shown under 50 firms' : ` (${pct(h.a, h.n)})`)); if (L === 'industry') row('Leading', h.lead ? lead(h.lead.div, h.lead.share) : 'no firm with a revenue value'); }
    }
    if (cellHit) {
      row('Cell', h.fine ? (h.grid < 1 ? '250 m' : `${h.grid} km`) : `${h.grid} km (${h.ix}, ${h.iy})`);
      if (L === 'industry') {
        if (h.dom == null || h.dom === 255) row('Leading', h.dom === 255 || h.nrev === 0 ? 'no firm with a revenue value' : 'no located firms');
        else { row('With revenue', `${fmt.int(h.nrev)} firms`); row('Leading', lead(h.dom, h.share)); if (h.mix && h.mix.length > 1) { const shown = h.mix.slice(1, 5), rest = (h.rest || 0) + h.mix.slice(5).reduce((t, m) => t + m.share, 0); row('', mixRows(shown, rest), 'full'); }   /* four ranked rows after the leader; the divisions past them fold into the remainder */ if (h.lsh != null) row('Listed (treated)', `${h.lsh}% of revenue`); }
      }
      else if (h.fine) { const ys = h.yearShown || 2021; if (h.n == null) row('Firms', 'none located'); else { row('Firms', `${band(h.n)} located`); row(`${ys} statement`, h.a != null ? `${fmt.int(h.a)} (${pct(h.a, h.n)})` : h.n >= 50 ? 'not available' : 'share not shown under 50 firms'); } }
      else if (L === 'share') { if (h.n == null) row('Firms', 'none located'); else { row('Firms', `${fmt.int(h.n)} located`); row(`${y} statement`, `${fmt.int(h.a)}` + (h.n >= 50 ? ` (${pct(h.a, h.n)})` : ', share not shown under 50 firms')); if (h.ns) row('Sanctions', `${fmt.int(h.ns)} members (treated)`); } }
      else if (L === 'change') { if (h.n21 == null) row('Firms', 'none located'); else { row('2021', `${fmt.int(h.a21)} of ${fmt.int(h.n21)} (${pct(h.a21, h.n21)})`); row('2024', `${fmt.int(h.a24)} of ${fmt.int(h.n24)} (${pct(h.a24, h.n24)})`); row('Change', h.supported ? `${fmt.signed(h.change)} points` : 'not classed, under 50 firms in a year'); } }
      else if (L === 'cohort') { if (h.n == null) row('Firms', 'none located'); else row('Cohort', `${fmt.int(h.c)} of ${fmt.int(h.n)} eligible` + (h.supported ? ` (${fmt.pct(h.pct)})` : ', not classed under 50')); }
      else if (L === 'lists') { if (h.n == null) row('Firms', 'no list members shown'); else { row('Firms', `${fmt.int(h.n)} located`); row('Sanctions', h.sanctioned == null ? 'under 5 or none' : `${fmt.int(h.sanctioned)} members (treated)`); row('Gov strategic', h.gov == null ? 'under 5 or none' : `${fmt.int(h.gov)} members (treated)`); } }
      else if (L === 'fin') { if (h.n_base == null) row('Cohort', 'no supported cell'); else { row('Observed', `${fmt.int(h.n_obs)} of ${fmt.int(h.n_base)} cohort firms in 2024`); row('Median revenue', `${fmt.signed(h.change)}% against the cell’s 2021 median`); } }
      else if (h.n != null) { row('Firms', `${fmt.int(h.n)} located`); if (h.a != null) row(`${y} statement`, `${fmt.int(h.a)} (${pct(h.a, h.n)})`); }
    }
    if (ad) {
      row('Coordinate pair', `${fmt.int(ad.n)} firm${ad.n === 1 ? '' : 's'}`);
      row(`${y} statement`, ad.n === 1 ? (ad.a ? 'available' : 'absent') : `${fmt.int(ad.a)} (${pct(ad.a, ad.n)})`);
      if (L === 'fin') { if (ad.f) { row('Baseline', `${fmt.int(ad.f)} with a value`); row('Median change', CLASS_LABELS[ad.cls - 1]); } else row('Baseline', 'no usable baseline and value'); }
      if (L === 'industry' && ad.ind != null) row('Leading', ad.ind === 255 ? 'no firm with a revenue value' : lead(ad.ind, ad.ish));
    }
    if (h && h.listed && h.listed.top && TRN.name) {   // the detail view (author's rule, 25 October 2026): the display name, the filed name beneath, the listing year, one line of state, memberships and revenue
      const Ls = h.listed, where = Ls.within_km ? `within ${Ls.within_km < 1 ? Math.round(Ls.within_km * 1000) + ' m' : fmt.dec(Ls.within_km, 1) + ' km'}` : 'at this pair';
      row('Listed (treated)', `${fmt.int(Ls.n)} ${where}`);
      const blocks = Ls.top.map(i => {
        const filed = TRN.name_filed ? TRN.name_filed[i] : '', nm = TRN.name[i], cs = TRN.name_case ? TRN.name_case[i] : 0, shared = TRN.name_shared ? TRN.name_shared[i] : 0;
        const tail = [listedState(i, y), listedLists(i), listedRevenue(i, y)].filter(Boolean).join(' · ');
        return `<div class="lf"><div class="lf-h"><b>${listedGlyph(i, y)}${listedName(i)}${cs === 2 ? ' <span class="muted">(transliterated)</span>' : ''}</b><span class="muted yr">${TRN.undated[i] ? 'undated' : 'listed ' + TRN.red_from[i]}</span></div>`
          + (filed && filed !== nm ? `<div class="muted filed">${esc(filed)}</div>` : '') + (shared > 1 ? `<div class="muted filed">one of ${fmt.int(shared)} entries under this name</div>` : '') + `<div class="muted filed">${tail}</div></div>`;
      });
      if (Ls.n > Ls.top.length) blocks.push(`<div class="lf more">and ${fmt.int(Ls.n - Ls.top.length)} more</div>`);
      row('', blocks.join(''), 'block');
    }
    if (h && !cellHit && !h.micro && h.ix != null) row('Cell', `100 km (${h.ix}, ${h.iy})`);   // the chart's cell under the cursor in the Firms view
    info.innerHTML = rows.length ? rows.map(([k, v, t]) => (t === 'block' ? `<div class="listed">${v}</div>` : t === 'full' ? `<div class="full">${v}</div>` : t === 'loc' ? `<span>${k}</span><b class="loc">${v}</b>` : `<span>${k}</span><b>${v}</b>`)).join('') : `<span class="muted">${state.mode === 'firms' ? 'Hover a mark' : 'Hover a cell'}</span><b></b>`;
    const { ctx, w, hgt = 0 } = chartCtx('cellchart'); const hh = $('cellchart').getBoundingClientRect().height;
    if (!h) return;
    const note = t => Motion.paragraph(ctx, t, 8, 24, w - 16, { size: 13, color: theme.muted });
    const chart = (pts, xDomain, xTicks, eras, caption) => {
      CH.lines(ctx, { x: 44, y: 14, w: w - 100, h: hh - 52 }, [{ label: '{y}', color: theme.accent, points: pts, gapAfter: [2018] }], { xDomain, yDomain: [0, 100], theme, yTicks: [0, 50, 100], xTicks, xFmt: v => (v === 2025 ? "25*" : String(v).slice(2)), labelSize: 12, lineWidth: 2, eras, yFmt: v => v + '%', axisSize: 12, axisDy: 20 });
      const cap = Motion.measure(ctx, caption, 11, 400) <= w - 16 ? caption : caption.replace(/, (\d{4} to \d{4}|by year)$/, '');   // a caption wider than the canvas drops its year suffix, which the axis shows (round 10)
      Motion.text(ctx, cap, 8, hh - 2, { size: 11, color: theme.dim });
    };
    if (h.micro) {   // the 25 km cell around the square, by year: an address file carries one year, the 25 km cells carry every year
      const key25 = cellKey(Math.floor(h.kmx / G25), Math.floor(h.kmy / G25)), pts = [];
      if (C25) for (const y of years) { const d = c25[y]; if (!d) continue; const i = d.map.get(key25); if (i != null && d.n[i] >= 50) pts.push({ x: y, y: 100 * d.a[i] / d.n[i] }); }
      if (!pts.length) return note('Fewer than 50 located firms in every year in the 25 km cell around this square');
      return chart(pts, [2013.5, 2025.5], [2014, 2018, 2021, 2025], [{ from: 2018.5, to: 2025.5, color: theme.highlightBand }], 'share with a statement, its 25 km cell, by year');
    }
    if (h.fine) {
      // 1 km city cells carry year series for 2019 to 2024 (cellsyears.city_1km); 250 m cells and the 5 km density cells carry 2021 only.
      if (h.n == null && h.nrev == null) return note(`No located firms in this ${h.grid < 1 ? '250 m' : h.grid + ' km'} cell`);   // the industry layer's 1 km hit carries the revenue count, not n: its series comes from the city grid below (25 October)
      if (h.grid !== 1 || !cityYear[h.city]) return note(h.grid < 1 ? '250 m cells carry 2021 only' : '5 km density cells carry 2021 only');
      const pts = [];
      for (const [y, L1] of Object.entries(cityYear[h.city])) { const d = L1.d, jx = Math.floor((h.kmx - d.origin[0]) / 1), jy = Math.floor((h.kmy - d.origin[1]) / 1); for (let i = 0; i < d.count; i++) if (d.ix[i] === jx && d.iy[i] === jy) { if (d.n[i] >= 50 && d.a[i] >= 0) pts.push({ x: +y, y: 100 * d.a[i] / d.n[i] }); break; } }
      if (!pts.length) return note('Fewer than 50 located firms in every year, 2019 to 2024');
      return chart(pts.sort((a, b) => a.x - b.x), [2018.5, 2024.5], [2019, 2021, 2024], [], 'share with a statement, this 1 km cell, 2019 to 2024');
    }
    const key = cellKey(h.ix, h.iy); const pts = [];
    if (h.grid === G25 && C25) { for (const y of years) { const d = c25[y]; if (!d) continue; const i = d.map.get(key); if (i != null && d.n[i] >= 50) pts.push({ x: y, y: 100 * d.a[i] / d.n[i] }); } }
    else for (const y of years) { const d = yearCells[y].get(key); if (d && d.n >= 50) pts.push({ x: y, y: 100 * d.a / d.n }); }
    if (!pts.length) return note('Fewer than 50 located firms in every year');
    chart(pts, [2013.5, 2025.5], [2014, 2018, 2021, 2025], [{ from: 2018.5, to: 2025.5, color: theme.highlightBand }], `share with a statement, this ${h.grid} km cell, by year`);
  }
  function drawNational() {
    if (!cardOpen('national')) return;
    const { ctx, w } = chartCtx('natchart'); const hh = $('natchart').getBoundingClientRect().height;
    const el = [], reg = []; S.avail.year.forEach((y, i) => { if (S.avail.eligible_share[i] != null) { el.push({ x: y, y: S.avail.eligible_share[i] }); reg.push({ x: y, y: S.avail.registered_share[i] }); } });
    // The right margin fits the longer end label (measured), the axes draw at the panel's 12 px, the two end labels are pushed apart.
    const margin = Motion.measure(ctx, 'registered ' + Motion.fmt.pct(reg[reg.length - 1].y, 1), 12, 500) + 22;
    const r = CH.lines(ctx, { x: 44, y: 14, w: w - 44 - margin, h: hh - 44 }, [{ label: 'registered {y}', color: theme.accentStrong, points: reg, gapAfter: [2018], width: 2 }, { label: 'eligible {y}', color: theme.accent, points: el, gapAfter: [2018], width: 2 }],
      { xDomain: [2011.5, 2025.5], yDomain: [0, 80], theme, yTicks: [0, 40, 80], xTicks: [2012, 2016, 2020, 2024], labelSize: 12, dots: false, eras: [{ from: 2018.5, to: 2025.5, color: theme.highlightBand }], yFmt: v => v + '%', labelFmt: v => Motion.fmt.pct(v, 1), axisSize: 12, axisDy: 20, spreadLabels: true });
    if (state.layer === 'share' || state.layer === 'industry') { const x = r.sx(state.year); ctx.strokeStyle = theme.ink; ctx.lineWidth = 1.5; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(x, 14); ctx.lineTo(x, hh - 30); ctx.stroke(); ctx.setLineDash([]); }
    $('natprov').textContent = 'Table B.1: statements over the annual eligible population and over firms registered at year-end; 2011 has no statements, 2025* is flagged. Source ' + S.sources.avail + '.';
  }
  function drawGroups() {
    if (!cardOpen('groups')) return;
    const { ctx, w } = chartCtx('groupchart'); const hh = $('groupchart').getBoundingClientRect().height;
    const items = [{ label: 'Joint-stock', a: F.legal.joint_stock[0], b: F.legal.joint_stock[1], color: theme.accent }, { label: 'State-related', a: F.own.state[0], b: F.own.state[1], color: theme.fall }, { label: 'Private', a: F.own.private[0], b: F.own.private[1], color: theme.accent }, { label: 'Unitary', a: F.legal.unitary[0], b: F.legal.unitary[1], color: theme.fall }];
    const vm = Motion.measure(ctx, '00.0%', 12, 500), lm = 16 + vm + 14 + Math.max(...items.map(it => Motion.measure(ctx, it.label, 12, 500))) + 6, rm = 16 + vm + 12;   // measured margins (round 10: the monospace widened the labels)
    CH.slopes(ctx, { x: 8, y: 30, w: w - 16, h: hh - 48 }, items, { yDomain: [44, 82], theme, size: 12, leftMargin: lm, rightMargin: rm, spread: true });
    $('groupprov').textContent = 'Share of eligible firms with a statement by ownership and legal form (Figures 2.2 and 2.3 sources); population comparisons by year, not the same firms.';
  }
  function drawOdds() {
    if (!cardOpen('odds')) return;
    const { ctx, w } = chartCtx('oddschart'); const hh = $('oddschart').getBoundingClientRect().height;
    const sz = {}; for (let i = 0; i < S.size.year.length; i++) if (S.size.era[i] === 'recent') (sz[S.size.quintile[i]] = sz[S.size.quintile[i]] || []).push({ x: S.size.year[i], y: S.size.or[i], low: S.size.low[i], high: S.size.high[i] });
    const ls = []; for (let i = 0; i < S.lists.year.length; i++) if (S.lists.model[i] === 'annual-eligible-membership' && S.lists.contrast[i] === 'sanctioned_only' && S.lists.comparison[i] === 'level' && S.lists.year[i] != null) ls.push({ x: S.lists.year[i], y: S.lists.or[i], low: S.lists.low[i], high: S.lists.high[i] });
    // The right margin fits the longest end label (measured, as drawNational does): the plot's inner margin is 14 px here and the label starts 10 px past the last
    // point and ends 8 px inside the canvas (round 10: with the monospace label the chart's default 40 px margins left 59 px for five years on a phone).
    const listLabel = 'sanctions list (treated)', pad = 14, endGap = 10, right = Motion.measure(ctx, listLabel, 12, 500) + 40 - pad + endGap + 8;
    CH.yearDots(ctx, { x: 40, y: 10, w: w - right, h: hh - 44 }, [{ label: 'Q5 vs Q1', color: theme.accentStrong, points: sz.Q5 || [], whiskers: true, dot: 4, width: 2 }, { label: 'Q2 vs Q1', color: theme.accent, points: sz.Q2 || [], dot: 3, width: 1.5 }, { label: listLabel, color: theme.fall, points: ls, whiskers: true, dot: 4, width: 2 }],
      { xDomain: [2019, 2024], yDomain: [0.3, 5], yTicks: [0.5, 1, 2, 4], theme, size: 12, thinTicks: true, spreadLabels: true, pad, endGap });
    $('oddsprov').textContent = `Adjusted odds of a statement: asset quintiles Q5 and Q2 against Q1 (Table B.4; 2022 vs 2021 Q5 ratio ${fmt.dec(F.size_q5_2022_ratio, 3)} [${fmt.dec(F.size_q5_2022_low, 3)}, ${fmt.dec(F.size_q5_2022_high, 3)}], provisional) and firms on the sanctions list only (treated) against firms on no list (comparison group) (Table B.7), two-way 95% intervals.`;
  }
  function redrawAll() { sizeCanvases(); drawMap(); drawCellPanel(state.hover); drawNational(); drawGroups(); drawOdds(); syncZoomButtons(); }

  // ---- controls -------------------------------------------------------------------------------------
  const layersEl = $('layers');
  // Firms view provenance (author's wording standard, 24 October 2026): the geocode categories defined once, the shared-registration text verbatim.
  const FIRMS_PROV = 'Firms view: every located eligible firm on no list (comparison group) with a house- or street-level geocode, drawn at its registered address and grouped by coordinate pair (M9 pass over the foundation registry and payload, one record per coordinate pair and year); firms on at least one of the five lists (treated) from the national pass (M8), red from their listing year. Listed firms are named from the list files (the decree and government strategic workbooks’ name columns, then the sanctions file’s name field): one display name per firm, the core name with its legal form abbreviated after a comma, in Latin script (the sanctions file’s Latin alias that transliterates the filed name, else a BGN/PCGN transliteration marked as such, else the Latin name as filed), cut at 60 characters; the full filed name is shown in the Under the cursor panel. Firms on no list are never named. Other geocodes, coordinates without a verified house or street match, are counted and not drawn. Most located firms have a house- or street-level address match. The remaining geocodes have unverified precision. Registered legal addresses can be shared business centres or addresses rented for registration and correspondence, rather than production premises. Several firms can therefore share one registered address. The Federal Tax Service tracks mass-registration addresses.';
  const syncProv = () => { $('layerprov').textContent = state.mode === 'firms' ? FIRMS_PROV : LAYERS.find(x => x.id === state.layer).prov; };
  LAYERS.forEach(L => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.textContent = L.label; b.dataset.id = L.id; b.setAttribute('aria-pressed', String(L.id === state.layer)); b.addEventListener('click', () => { state.layer = L.id; endCellPulse(); queueMicrotask(writeHash); layersEl.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.id === L.id))); syncYearRow(); syncPulseButton(); syncProv(); drawMap(); drawNational(); syncMix(); updateContext(true); }); layersEl.appendChild(b); });
  function syncYearRow() { $('yearrow').hidden = !(state.mode === 'firms' || state.layer === 'share' || state.layer === 'industry'); }
  $('pulse').addEventListener('click', () => replayPulse());
  // The view switch (round 5): cells as before, or every registered address as a mark.
  const modesEl = $('modes');
  if (FIRMS_OK) {
    const lab = document.createElement('span'); lab.className = 'modelabel'; lab.textContent = 'View'; modesEl.appendChild(lab);
    [['cells', 'Cells'], ['firms', 'Firms']].forEach(([m, label]) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.textContent = label; b.dataset.mode = m; b.setAttribute('aria-pressed', String(m === state.mode)); b.addEventListener('click', () => { if (state.mode === m) return; state.mode = m; endPulse(); endCellPulse(); if (!finding) endFound(); queueMicrotask(writeHash); if (m === 'firms') maybeSweep(); syncProv(); modesEl.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.mode === m))); hideHover(); syncYearRow(); syncPulseButton(); drawMap(); countFirmsInView(); syncMix(); drawCellPanel(null); updateContext(true); }); modesEl.appendChild(b); });
  } else modesEl.hidden = true;
  syncProv(); syncYearRow(); syncYearPos();
  function syncYearPos() { const e = $('year'), p = (+e.value - +e.min) / (+e.max - +e.min); $('yearslider').style.setProperty('--pct', p.toFixed(4)); }   // the slider's fill and the mark's place follow the value (round 10, the author's correction of 25 October)
  $('year').addEventListener('input', () => { syncYearPos(); queueMicrotask(writeHash); const prev = state.year; state.year = +$('year').value; $('yearlabel').textContent = state.year + (state.year === 2025 ? '*' : ''); if (state.mode === 'firms') { startPulse(prev, state.year); if (state.year !== prev) fieldAnim.dissolve = { t0: null }; } else endCellPulse(); syncPulseButton(); drawMap(); countFirmsInView(); drawNational(); syncMix(); updateContext(true); { const [b, n] = bandUnderCamera(); rebuildWire(b, n, 'year'); } });
  const presets = $('presets');
  // Presets hold a target camera: the button flies there, the audit API jumps, a link's anchor opens there.
  const PRESETS = [];
  // One short historical fact per place (round 12, part D, item 3): a native tooltip on each minimap group and the RUSSIA frame (an SVG title) and on the phone's
  // buttons (a title attribute); every fact verified against a reference recorded in motion/README.md, never on screen; at most 200 characters, no semicolons.
  const MM_FACTS = {
    'Russia': 'Russia and the United States lie 3.8 km apart at the Diomede Islands in the Bering Strait. The date line runs between them, so the Russian island is almost a day ahead.',
    'Moscow': 'From 1680 to the late 19th century the Kremlin\'s walls were kept whitewashed with lime. The red brick showed again only after the coats were left to wear away, by the early 1900s.',
    'St Petersburg': 'In April 1942, with the paintings evacuated to the Urals, a Hermitage guide led visiting cadets through the halls and described the pictures by their empty frames.',
    'Novosibirsk': 'Novosibirsk began in 1893 as a camp for the Trans-Siberian bridge over the Ob and passed one million inhabitants in 1962, 69 years after its founding.',
    'Vladivostok': 'Vladivostok lies at 43° north, a little south of Sochi, yet its January mean is about −12 °C against Sochi\'s +6 °C.',
    'Yekaterinburg': 'Yekaterinburg, founded in 1723 as an ironworks on the Iset, is named for Catherine I, the wife of Peter the Great, not for Catherine the Great.',
    'Kazan': 'Nikolai Lobachevsky, a founder of non-Euclidean geometry, was rector of Kazan University for 19 years, from 1827 to 1846.',
    'Nizhny Novgorod': 'A 19th-century saying made St Petersburg Russia\'s head, Moscow its heart and Nizhny Novgorod its purse, after the summer fair that drew traders from Europe and Asia until 1929.',
    'Krasnodar': 'Until December 1920 the city was Yekaterinodar, Catherine\'s gift. Its new name reads two ways: krasny means red, and in older Russian beautiful.',
    'Kaliningrad': 'Immanuel Kant lived his whole life in Königsberg, today\'s Kaliningrad, and is said never to have travelled far from it. His tomb stands by the cathedral on Kant Island, the old Kneiphof.',
    'Rostov-on-Don': 'Until 1928 Rostov had a twin city a wheat field away: Nakhichevan-on-Don, founded in 1779 by Armenians resettled from Crimea, which became one of Rostov\'s districts.',
    'Samara': 'In October 1941 Samara, then Kuybyshev, became the Soviet Union\'s reserve capital: the foreign embassies moved there from Moscow and stayed until 1943.',
    'Chelyabinsk': 'On 15 February 2013 an asteroid of about 17 to 20 m across exploded high above Chelyabinsk with the energy of some 500 kilotons, the largest such event recorded since Tunguska in 1908.',
    'Omsk': 'Fyodor Dostoevsky served four years of hard labour in the Omsk fortress, from January 1850 to early 1854. Notes from a Dead House grew out of them.',
    'Ufa': 'From 1789 Ufa housed the Orenburg Muslim Spiritual Assembly, the Russian Empire\'s central body for its Muslim subjects, created by a decree of Catherine II in 1788.',
    'Perm': 'The Permian period of the geological timescale takes its name from here: Roderick Murchison named it in 1841 after the strata he studied in the Perm region.',
    'Voronezh': 'Russia\'s first regular navy was built at Voronezh: from the winter of 1695 Peter I\'s shipyards on the river sent galleys and warships down to the Don for the capture of Azov in 1696.',
    'Volgograd': 'The Motherland Calls on Mamayev Kurgan, completed in 1967, rises 85 m to the tip of its sword and was then the tallest statue in the world.',
    'Krasnoyarsk': 'Lavr Proskuryakov\'s railway bridge over the Yenisei at Krasnoyarsk, opened in 1899, won a gold medal at the 1900 Paris Exposition for its truss design.',
    'Irkutsk': 'Irkutsk stands on the Angara, the only river that flows out of Lake Baikal. Hundreds of streams flow in, and this one carries the lake\'s water on to the Yenisei.',
    'Khabarovsk': 'Khabarovsk is the city on the 5,000-ruble note: the Muravyov-Amursky monument and the embankment on the front, the bridge over the Amur on the back.',
    'Murmansk': 'Murmansk was founded in October 1916 as Romanov-on-Murman, the last city founded in the Russian Empire, for a port that stays ice-free where Arkhangelsk freezes.',
    'Tyumen': 'From July 1941 to the spring of 1945 Lenin\'s embalmed body was kept in Tyumen, in the building of the agricultural college, after a secret evacuation from Moscow.',
    'Central Moscow (250 m)': 'An eighth Stalin skyscraper was begun in Zaryadye in 1947 and abandoned. The Rossiya hotel rose on its foundations in 1967, and since 2017 the site has been a park.',
  };
  const slugOf = label => label.replace(/\s*\(.*\)$/, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const addPreset = (label, target) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; { const mm = /^(.*?)( \(.*\))?$/.exec(label); b.innerHTML = `${esc(mm[1])}${mm[2] ? `<span class="u">${esc(mm[2])}</span>` : ''}`; } /* the place name in capitals, a unit suffix as it is (round 10) */ b.addEventListener('click', () => flyTo(target())); if (MM_FACTS[label]) b.title = MM_FACTS[label]; presets.appendChild(b); PRESETS.push({ label, slug: slugOf(label), target, button: b }); };
  addPreset('Russia', fitTarget);
  for (const city of bmp.cities) addPreset(city.label, () => cityTarget(city));
  addPreset('Central Moscow (250 m)', () => { const c = bmp.cities[0]; return fineTarget(c.x + 1.5, c.y + 0.5); }); PRESETS[PRESETS.length - 1].button.classList.add('keep');   // the one button that stays under the minimap (round 10)

  // ---- the minimap (round 10, the author's item 12; the GO TO card's ice-blue neutral, item 21) ---------------------------------------------------
  // A 376 by 232 viewBox: the national extent in a 272 by 154 box at the right (0.033397 px per km), a 100 px label column at the left and a 56 px band
  // below. The outline is the basemap's land traced at 0.03 px per km (every component of four pixels or more; the mainland first) and simplified; the
  // graticule is the basemap's own polylines clipped to the box. Each city is a focusable group (dot, leader, label box); the layout table below places
  // the boxes by hand against the rules the audit checks (no box meets another box or a dot within 2 px, no leader crosses another, none passes within
  // 4 px of another city's dot or through another box, every box inside the viewBox). Clicking a city flies to its preset; the frame fits the country.
  const MM_W = 376, MM_H = 232, MM_X0 = 104, MM_Y0 = 10, MM_S = 272 / SPAN_X, MM_BOX_H = 12, MM_PAD = 4, MM_R = 3;
  const mmX = x => MM_X0 + (x - BM.extents.national.x[0]) * MM_S, mmY = y => MM_Y0 + (BM.extents.national.y[1] - y) * MM_S;
  const MM_LAYOUT = {   // ['L', top]: the left column, the box's right edge at x 98; ['X', left, top]: the box's left edge and top; ['R', right, top]: the box's right edge and top
    'St Petersburg': ['L', 0], 'Kaliningrad': ['L', 14], 'Moscow': ['L', 42], 'Kazan': ['L', 56], 'Voronezh': ['L', 70], 'Rostov-on-Don': ['L', 84], 'Krasnodar': ['L', 98], 'Volgograd': ['L', 112], 'Samara': ['L', 126], 'Ufa': ['L', 140],
    'Murmansk': ['X', 190, 25], 'Nizhny Novgorod': ['X', 158, 60], 'Perm': ['X', 161, 74], 'Yekaterinburg': ['X', 196, 80], 'Tyumen': ['X', 196, 97], 'Krasnoyarsk': ['X', 206, 111], 'Omsk': ['X', 178, 127], 'Novosibirsk': ['X', 182, 141], 'Irkutsk': ['X', 272, 137], 'Khabarovsk': ['R', 372, 117],
    'Chelyabinsk': ['X', 100, 182], 'Vladivostok': ['R', 372, 182] };   // the column holds the west and the Volga, the north-east the Urals and Siberia, the band two
  let MMAP = null, mmBuilds = 0;   // the built geometry, for the checker and the audit; the build count (a verify may rebuild once)
  function mooreTrace(land, W, H, sx, sy) {   // the outer contour of the component holding (sx, sy), Moore neighbourhood, as pixel pairs
    const dirs = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]], path = []; let x = sx, y = sy, dir = 6, guard = 0;
    do { path.push([x, y]); let found = false; for (let k = 0; k < 8; k++) { const nd = (dir + 5 + k) % 8, nx = x + dirs[nd][0], ny = y + dirs[nd][1]; if (land(nx, ny)) { x = nx; y = ny; dir = nd; found = true; break; } } if (!found) break; } while ((x !== sx || y !== sy) && ++guard < 200000);
    return path;
  }
  function landRings(S, minPx) {   // every land component at S px per km traced and returned as km rings, largest first
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of BM.lod0.parts) for (const r of p.rings) { let x = r[0] / 10, y = r[1] / 10; const upd = () => { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }; upd(); for (let i = 2; i < r.length; i += 2) { x += r[i] / 10; y += r[i + 1] / 10; upd(); } }
    const W = Math.ceil((x1 - x0) * S) + 4, H = Math.ceil((y1 - y0) * S) + 4, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d', { willReadFrequently: true });
    g.setTransform(S, 0, 0, -S, 2 - x0 * S, H - 2 + y0 * S); g.fillStyle = '#fff'; g.fill(MM.partsToPath(BM.lod0.parts), 'evenodd');
    const a = g.getImageData(0, 0, W, H).data, land = (x, y) => x >= 0 && y >= 0 && x < W && y < H && a[4 * (y * W + x) + 3] > 127;
    const comp = new Int32Array(W * H).fill(-1), sizes = [], starts = []; let n = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (!land(x, y) || comp[y * W + x] >= 0) continue; const st = [[x, y]], rows = new Map(); comp[y * W + x] = n; let size = 0; while (st.length) { const [cx, cy] = st.pop(); size++; const rw = rows.get(cy); if (!rw) rows.set(cy, [1, cx]); else { rw[0]++; if (cx < rw[1]) rw[1] = cx; } for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx, ny = cy + dy; if (land(nx, ny) && comp[ny * W + nx] < 0) { comp[ny * W + nx] = n; st.push([nx, ny]); } } }
      let best = null; for (const [ry, [cnt, minx]] of rows) if (!best || cnt > best[0]) best = [cnt, minx, ry]; sizes.push(size); starts.push([best[1], best[2]]); n++; }   // the start: the leftmost pixel of the component's fullest row
    const order = sizes.map((sz, i) => i).filter(i => sizes[i] >= minPx).sort((i, j) => sizes[j] - sizes[i]);
    return order.map(i => mooreTrace((x, y) => land(x, y) && comp[y * W + x] === i, W, H, starts[i][0], starts[i][1]).map(([px, py]) => [x0 + (px - 2) / S, y0 + (H - 2 - py) / S]));
  }
  function buildMinimap() {
    const svg = $('minimap'); if (!svg || MMAP) return;
    const NS = 'http://www.w3.org/2000/svg', el = (t, at, parent) => { const e = document.createElementNS(NS, t); for (const [k, v] of Object.entries(at || {})) e.setAttribute(k, String(v)); (parent || svg).appendChild(e); return e; };
    MMAP = { cities: [], rings: 0, widths: {}, builds: ++mmBuilds };
    const defs = el('defs'); el('clipPath', { id: 'mmclip' }, defs); el('rect', { x: MM_X0, y: MM_Y0, width: 272, height: 154 }, defs.firstChild);
    const land = el('g', { class: 'landg', 'clip-path': 'url(#mmclip)' });
    const rings = landRings(0.03, 4); MMAP.rings = rings.length;
    let d = ''; for (const ring of rings) { const r = simplify(ring, ring === rings[0] ? 12 : 8); if (r.length < 3) continue; d += 'M' + r.map(([x, y]) => mmX(x).toFixed(1) + ' ' + mmY(y).toFixed(1)).join('L') + 'Z'; }
    el('path', { class: 'land', d, 'fill-rule': 'evenodd' }, land);
    let gd = ''; for (const line of BM.graticule) { const r = MM.decodeRing(line); gd += 'M' + r.xs.map((x, i) => mmX(x).toFixed(1) + ' ' + mmY(r.ys[i]).toFixed(1)).join('L'); }
    el('path', { class: 'grat', d: gd }, land);
    // the Russia frame: the mark's four brackets at the outline box's corners (10 px arms), a focusable group with the label box at the top-right corner
    const fr = el('g', { class: 'frame', id: 'mm-russia', tabindex: 0, role: 'button', 'aria-label': 'Go to Russia', 'aria-pressed': 'false' });
    el('title', {}, fr).textContent = MM_FACTS.Russia;   // the native tooltip (item 3)
    const X1 = MM_X0 + 272, Y1 = MM_Y0 + 154, A = 10;
    el('path', { d: `M${MM_X0} ${MM_Y0 + A}V${MM_Y0}h${A} M${X1 - A} ${MM_Y0}h${A}v${A} M${X1} ${Y1 - A}v${A}h${-A} M${MM_X0 + A} ${Y1}H${MM_X0}v${-A}` }, fr);
    // The label widths come from the canvas, never from the SVG's own layout (the author's report of 25 October: a browser that lays the page out hidden at load
    // answered 0 from getComputedTextLength() on the published page and every box collapsed to its padding, the text spilling over the outline). The canvas measure
    // reproduces the rendered advance within 0.12 px on all 23 labels (the same font stack, the tracking counted after every glyph as the SVG lays it), and
    // verifyMinimap() rebuilds the boxes should the rendered text ever disagree, as after a late font load.
    const measure = txt => { const w = Motion.measure(mctx, txt, 9, 500, 9 * 0.08); MMAP.widths[txt] = w; return w; };
    const labelBox = (g, txt, left, top) => { const w = Math.ceil(measure(txt) + 2 * MM_PAD); el('rect', { class: 'box', x: left, y: top, width: w, height: MM_BOX_H }, g); const t = el('text', { x: left + MM_PAD, y: top + MM_BOX_H / 2 }, g); t.textContent = txt; return { x: left, y: top, x1: left + w, y1: top + MM_BOX_H, w }; };
    MMAP.russia = null;   // the frame carries no label since 25 October 2026 (the author's request): RUSSIA is a kept button under the minimap, above CENTRAL MOSCOW, in the context green; the frame keeps its brackets, its tooltip and its pressed state
    const flyRussia = () => flyTo(fitTarget()); fr.addEventListener('click', flyRussia); fr.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flyRussia(); } });
    PRESETS.find(p => p.label === 'Russia').node = fr;
    { const rb = PRESETS.find(p => p.label === 'Russia').button; rb.classList.add('keep', 'russia'); }
    for (const city of bmp.cities) {
      const lay = MM_LAYOUT[city.label]; if (!lay) continue; const txt = city.label.toUpperCase(), w = Math.ceil(measure(txt) + 2 * MM_PAD);
      const left = lay[0] === 'L' ? 100 - w : lay[0] === 'R' ? lay[1] - w : lay[1], top = lay[0] === 'L' ? lay[1] : lay[2];
      const dx = mmX(city.x), dy = mmY(city.y), box = { x: left, y: top, x1: left + w, y1: top + MM_BOX_H };
      const mids = [[box.x, (box.y + box.y1) / 2], [box.x1, (box.y + box.y1) / 2], [(box.x + box.x1) / 2, box.y], [(box.x + box.x1) / 2, box.y1]];   // the edge midpoints: left, right, top, bottom
      const ccx = (box.x + box.x1) / 2, ccy = (box.y + box.y1) / 2, end = Math.abs(dx - ccx) > Math.abs(dy - ccy) ? (dx < ccx ? mids[0] : mids[1]) : (dy < ccy ? mids[2] : mids[3]);   // the edge facing the dot
      const g = el('g', { class: 'city', id: 'mm-' + slugOf(city.label).toLowerCase(), tabindex: 0, role: 'button', 'aria-label': 'Go to ' + city.label, 'aria-pressed': 'false' });
      if (MM_FACTS[city.label]) el('title', {}, g).textContent = MM_FACTS[city.label];   // the native tooltip (item 3)
      el('line', { class: 'ld', x1: dx.toFixed(1), y1: dy.toFixed(1), x2: end[0].toFixed(1), y2: end[1].toFixed(1), pathLength: 1 }, g);
      el('circle', { class: 'dot', cx: dx.toFixed(1), cy: dy.toFixed(1), r: MM_R }, g);
      labelBox(g, txt, left, top);
      const p = PRESETS.find(p => p.label === city.label); p.node = g; const go = () => flyTo(p.target()); g.addEventListener('click', go); g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
      MMAP.cities.push({ label: city.label, dot: [dx, dy], box, leader: [dx, dy, end[0], end[1]] });
    }
    if (!reduceMotion()) svg.classList.add('drawn');
    syncPresetPressed();
  }
  function verifyMinimap() {   // the rendered labels against the widths the boxes were built from: a rebuild (at most twice) when the text draws wider or narrower than measured
    const svg = $('minimap'); if (!svg || !MMAP || mmBuilds >= 3) return false;
    if (getComputedStyle(svg).display === 'none' || svg.getBoundingClientRect().width === 0) return false;   // hidden: nothing to read, the canvas measure stands
    let off = 0; for (const t of svg.querySelectorAll('text')) { const r = t.getComputedTextLength(), w = MMAP.widths[t.textContent]; if (r > 0 && w != null && Math.abs(r - w) > off) off = Math.abs(r - w); }
    if (off <= 0.75) return false;
    while (svg.firstChild) svg.removeChild(svg.firstChild); svg.classList.remove('drawn'); MMAP = null; buildMinimap(); return true;
  }
  function minimapCheck() {   // the layout rules, as the audit tests them; returns the violations (empty when clean)
    if (!MMAP) return null; const out = [], C = MMAP.cities, clear = 2, near = 2;   // 2 px between a box and anything, 2 px between a leader and another city's dot edge (5 from its centre)
    const inter = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x, b.x)) > -clear && Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y, b.y)) > -clear && Math.min(a.x1, b.x1) - Math.max(a.x, b.x) > -clear && Math.min(a.y1, b.y1) - Math.max(a.y, b.y) > -clear;
    const boxes = C.map(c => Object.assign({ label: c.label }, c.box));   // the 22 city boxes (the Russia label left the frame on 25 October 2026)
    for (const b of boxes) if (b.x < 0 || b.y < 0 || b.x1 > MM_W || b.y1 > MM_H) out.push(['outside', b.label]);
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) if (inter(boxes[i], boxes[j])) out.push(['box-box', boxes[i].label, boxes[j].label]);
    const segDist = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1e-9, t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2)); return Math.hypot(a[0] + t * dx - p[0], a[1] + t * dy - p[1]); };
    const cross = (p1, p2, p3, p4) => { const d = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]); const d1 = d(p3, p4, p1), d2 = d(p3, p4, p2), d3 = d(p1, p2, p3), d4 = d(p1, p2, p4); return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0)); };
    const segBox = (a, b, bx) => { const pts = [[bx.x, bx.y], [bx.x1, bx.y], [bx.x1, bx.y1], [bx.x, bx.y1]]; if (a[0] > bx.x && a[0] < bx.x1 && a[1] > bx.y && a[1] < bx.y1) return true; for (let i = 0; i < 4; i++) if (cross(a, b, pts[i], pts[(i + 1) % 4])) return true; return false; };
    for (const c of C) for (const b of boxes) if (b.label !== c.label) { const dotBox = { x: c.dot[0] - MM_R, y: c.dot[1] - MM_R, x1: c.dot[0] + MM_R, y1: c.dot[1] + MM_R }; if (inter(dotBox, b)) out.push(['box-dot', b.label, c.label]); }
    for (const c of C) { const dotBox = { x: c.dot[0] - MM_R, y: c.dot[1] - MM_R, x1: c.dot[0] + MM_R, y1: c.dot[1] + MM_R }; if (inter(dotBox, c.box)) out.push(['box-own-dot', c.label]); }
    for (let i = 0; i < C.length; i++) { const a = [C[i].leader[0], C[i].leader[1]], b = [C[i].leader[2], C[i].leader[3]];
      for (let j = 0; j < C.length; j++) { if (i === j) continue; const a2 = [C[j].leader[0], C[j].leader[1]], b2 = [C[j].leader[2], C[j].leader[3]];
        if (j > i && cross(a, b, a2, b2)) out.push(['leader-cross', C[i].label, C[j].label]);
        if (segDist(C[j].dot, a, b) < near + MM_R) out.push(['leader-dot', C[i].label, C[j].label, +segDist(C[j].dot, a, b).toFixed(1)]); }
      for (const bx of boxes) if (bx.label !== C[i].label && segBox(a, b, bx)) out.push(['leader-box', C[i].label, bx.label]); }
    return out;
  }
  function presetFromHash() {
    const raw = decodeURIComponent(location.hash.slice(1)).trim(); if (!raw || !/^[A-Za-z0-9_-]+$/.test(raw)) return null;
    let s = raw.toLowerCase(), firms = false; if (s.endsWith('-firms')) { firms = true; s = s.slice(0, -6); }
    const p = PRESETS.find(p => p.slug.toLowerCase() === s || p.slug.toLowerCase().replace(/-/g, '_') === s); return p ? { preset: p, firms } : null;
  }
  window.addEventListener('hashchange', () => { const hp = presetFromHash(); if (hp) { if (hp.firms && FIRMS_OK && state.mode !== 'firms') window.__atlas.mode('firms'); flyTo(hp.preset.target()); return; } const v = viewFromHash(); if (v) applyView(v, false); });   // a preset's anchor, or a view typed or pasted into the address
  // ---- links to the exact view (round 14, the author's request of 25 October 2026) ------------------------------------------------------------------------------------
  // The page's address carries the view, the layer, the year and the camera, as #firms_industry_2024_55.75580_37.61730_20km: the centre in degrees and the span of the
  // map's shorter side in km, so a link opens on the same ground on any screen (the country's fitted view ends in _fit). The address follows every settled view, replaced in
  // place rather than added to the history; a link opened later, or a hash typed by hand, restores the view. The presets' anchors (#Moscow, #Moscow-firms) keep their
  // meaning. On the published page the address bar belongs to the host, so the GO TO card's link button copies the artifact's own address with the view appended. The
  // host passes on only an anchor of letters, digits and . _ ~ - (the first build's #firms/fin/2022/55.75411,37.61358/47.5km never reached the page there; it still parses).
  const ARTIFACT_URL = 'https://claude.ai/artifact/19DNAFozq23ng4qaD18m7n';
  function forwardLAEA(lat, lon) { const { lam0, phi0, R } = LAEA, phi = lat * Math.PI / 180, d = lon * Math.PI / 180 - lam0, kp = Math.sqrt(2 / (1 + Math.sin(phi0) * Math.sin(phi) + Math.cos(phi0) * Math.cos(phi) * Math.cos(d))); return [R * kp * Math.cos(phi) * Math.sin(d), R * kp * (Math.cos(phi0) * Math.sin(phi) - Math.sin(phi0) * Math.cos(phi) * Math.cos(d))]; }
  function viewHash() {
    const c = state.cam, fit = Math.abs(c.k / kFit() - 1) < 1e-6 && Math.abs(c.cx - NAT.cx) < 1e-6 && Math.abs(c.cy - NAT.cy) < 1e-6;
    let tail = 'fit'; if (!fit) { const [lat, lon] = inverseLAEA(c.cx, c.cy); tail = `${lat.toFixed(5)}_${lon.toFixed(5)}_${+(minSide() / c.k).toPrecision(6)}km`; }
    return `${state.mode}_${state.layer}_${state.year}_${tail}`;
  }
  function viewFromHash() {   // tokens split at _ (or / in the first build's form); the first two decimal degrees are the latitude and the longitude
    const raw = decodeURIComponent(location.hash.slice(1)).trim(); if (!/[\/_]/.test(raw)) return null;
    const v = {}, deg = [];
    for (const tok of raw.split(/[\/_]/)) { const t = tok.trim(), tl = t.toLowerCase(); if (!t) continue;
      if (tl === 'cells' || tl === 'firms') v.mode = tl; else if (LAYERS.some(L => L.id === tl)) v.layer = tl; else if (/^\d{4}$/.test(t) && +t >= 2014 && +t <= 2025) v.year = +t; else if (tl === 'fit') v.fit = true;
      else if (/^-?\d+\.\d+$/.test(t)) deg.push(+t);
      else if (/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(t)) deg.push(...t.split(',').map(Number));
      else if (/^\d+(\.\d+)?km$/i.test(t) && parseFloat(t) > 0) v.span = parseFloat(t); }
    if (deg.length >= 2 && Math.abs(deg[0]) <= 90 && Math.abs(deg[1]) <= 180) v.at = [deg[0], deg[1]];
    return Object.keys(v).length ? v : null;
  }
  function viewTarget(v) { if (v.fit) return fitTarget(); if (!v.at) return null; const [x, y] = forwardLAEA(v.at[0], v.at[1]); return { cx: x, cy: y, k: clampK(v.span ? minSide() / v.span : state.cam.k) }; }
  function applyView(v, instant) {   // the camera first at load (so the Firms view's opening sweep reads the view it opens on), the year before the view (no bloom on the way in)
    const A = window.__atlas, t = viewTarget(v);
    if (t && instant) state.cam = { cx: t.cx, cy: t.cy, k: t.k };
    if (v.layer && v.layer !== state.layer) A.layer(v.layer);
    if (v.year && v.year !== state.year) { A.year(v.year); endPulse(); }
    if (v.mode && v.mode !== state.mode && (v.mode === 'cells' || FIRMS_OK)) A.mode(v.mode);
    if (t && !instant) flyTo(t);
  }
  let hashOn = false;   // the address keeps the anchor it opened with until the view first changes
  function writeHash() { if (!hashOn) return; const h = '#' + viewHash(); if (location.hash !== h) { try { history.replaceState(null, '', h); } catch (e) { /* a frame without access to its history */ } } }
  const viewLink = () => (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || location.protocol === 'file:' ? location.href.split('#')[0] : ARTIFACT_URL) + '#' + viewHash();
  $('copylink').addEventListener('click', () => {   // the clipboard where the browser allows it, else the link shown selected in a field beneath
    const link = viewLink(), st = $('linkstatus'), fld = $('linkfield');
    const shown = () => { fld.value = link; fld.hidden = false; fld.focus(); fld.select(); st.textContent = 'Copy it from the field'; };
    const done = () => { fld.hidden = true; st.textContent = 'Link copied'; setTimeout(() => { if (st.textContent === 'Link copied') st.textContent = ''; }, 1600); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(link).then(done, shown); else shown();
  });
  // ---- find a firm on these lists by name (round 14, the author's request of 25 October 2026; review/2026-10-25-listed-names-memo.md) ---------------------------------
  // A field in the GO TO card matches the typed letters against the display names and the filed names of the listed file, without case, accents or punctuation (a name's
  // start first, then a word's start, then anywhere, then every typed word somewhere), and lists the first ten hits, each with its mark's glyph in the shown year, its
  // listing year and its region. A choice, by click, tap or Enter, flies to the firm in the Firms view (from the Cells view too, where listed firms are not drawn), at the
  // 20 km rung or closer, in the shown year or, where the firm has no record that year, the nearest year with one; the tooltip opens at its mark with its name first, and
  // the mark then pulses once with the button's two rings (the still highlight under reduced motion). Only firms on the five lists carry names; firms on no list never appear.
  const FIND_MAX = 10;
  const normName = s => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  let findKeys = null, findPin = -1, found = null, foundRaf = 0, foundTimer = 0;
  const findIndex = () => findKeys || (findKeys = Array.from({ length: TRN.n }, (_, i) => { const a = normName(TRN.name[i]), b = TRN.name_filed ? normName(TRN.name_filed[i]) : ''; return a ? ' ' + a + (b && b !== a ? ' | ' + b : '') + ' ' : ''; }));
  function findMatches(q) {
    const qn = normName(q); if (qn.length < 2 || !TRN || !TRN.name) return [];
    const toks = qn.split(' '), keys = findIndex(), hits = [];
    for (let i = 0; i < TRN.n; i++) { const k = keys[i]; if (!k) continue; const at = k.indexOf(' ' + qn); let score; if (at === 0) score = 0; else if (at > 0) score = 1; else if (k.indexOf(qn) >= 0) score = 2; else if (toks.length > 1 && toks.every(t => k.indexOf(t) >= 0)) score = 3; else continue; hits.push([score, TRN.name[i].length, i]); }
    hits.sort((u, v) => u[0] - v[0] || u[1] - v[1] || TRN.name[u[2]].localeCompare(TRN.name[v[2]]) || u[2] - v[2]);
    return hits.slice(0, FIND_MAX).map(h => h[2]);
  }
  const findInput = $('findinput'), findList = $('findlist'); let findItems = [], findActive = -1;
  let findOpen = false;   // the list shows only while the field is being typed in: a choice, Escape or leaving the field closes it
  function renderFind() {
    const q = findOpen ? normName(findInput.value) : '';
    findList.innerHTML = findOpen && findItems.length ? findItems.map((i, j) => { const rg = TRN.regions && TRN.reg ? TRN.regions[TRN.reg[i]] : ''; return `<button type="button" tabindex="-1" role="option" class="fo${j === findActive ? ' on' : ''}" id="fo-${j}" data-i="${i}" aria-selected="${j === findActive}">${listedGlyph(i, state.year)}${listedName(i)}<span class="fm">${TRN.undated[i] ? 'undated' : 'listed ' + TRN.red_from[i]}${rg ? ' · ' + esc(rg) : ''}</span></button>`; }).join('')
      : q.length >= 2 ? '<div class="none">No list member by that name</div>' : '';
    const open = !!findList.innerHTML; findList.hidden = !open; findInput.setAttribute('aria-expanded', String(open));
    if (open && findActive >= 0) { findInput.setAttribute('aria-activedescendant', 'fo-' + findActive); const el = $('fo-' + findActive); if (el) el.scrollIntoView({ block: 'nearest' }); } else findInput.removeAttribute('aria-activedescendant');
  }
  function closeFind() { findOpen = false; findItems = []; findActive = -1; renderFind(); }
  function chooseFind(i) { findInput.value = TRN.name[i]; closeFind(); findInput.blur(); { const r = wrap.getBoundingClientRect(); if (r.top < 0 || r.bottom > innerHeight + 1) wrap.scrollIntoView({ block: 'start', behavior: reduceMotion() ? 'auto' : 'smooth' }); } return findFirm(i); }   // on the phone layout the card sits below the map: the map comes into view for the flight
  if (!TRN || !TRN.name) $('find').hidden = true;
  else {
    findInput.addEventListener('input', () => { findOpen = true; findItems = findMatches(findInput.value); findActive = findItems.length ? 0 : -1; renderFind(); });
    findInput.addEventListener('keydown', ev => {
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') { if (!findItems.length) return; ev.preventDefault(); findActive = (findActive + (ev.key === 'ArrowDown' ? 1 : findItems.length - 1)) % findItems.length; renderFind(); }
      else if (ev.key === 'Enter') { ev.preventDefault(); if (findActive >= 0 && findItems[findActive] != null) chooseFind(findItems[findActive]); }
      else if (ev.key === 'Escape') { if (!findList.hidden) { ev.preventDefault(); closeFind(); } else if (findInput.value) { ev.preventDefault(); findInput.value = ''; } }   // the list first, then the text
    });
    findList.addEventListener('pointerdown', ev => ev.preventDefault());   // the field keeps the focus, so the list stays until the choice lands
    findList.addEventListener('click', ev => { const b = ev.target.closest('.fo[data-i]'); if (b) chooseFind(+b.dataset.i); });
    findInput.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== findInput) closeFind(); }, 0));
  }
  const redrawMarksNow = () => (state.mode === 'firms' ? drawMarks(cam()) : drawCellsMarks(cam()));
  function endFound() { if (foundRaf) cancelAnimationFrame(foundRaf); foundRaf = 0; if (foundTimer) clearTimeout(foundTimer); foundTimer = 0; if (found) { found = null; redrawMarksNow(); } }
  function foundTick() { foundRaf = 0; if (!found) return; if (performance.now() - found.t0 >= PULSE_MS) found = null; redrawMarksNow(); if (found) foundRaf = requestAnimationFrame(foundTick); }
  function foundRings(ctx, c) {   // the found firm's two rings at its mark, after the pulse's rings on the marks canvas
    const i = found.i, k = c.k, LR = MM.listedRule(markRule(k), k, kFit()), px = c.ox + (TRN.x[i] - c.cx) * k, py = c.oy - (TRN.y[i] - c.cy) * k, r = MM.listedRadius(LR, TRN.pile[i]);
    if (found.static) { MM.pulseRing(ctx, px, py, r, LR, 1, theme, true); return; }
    MM.pulsePhase((found.at != null ? found.at : performance.now() - found.t0) / 1000, PH); if (PH.on && PH.p > 0 && PH.p < 1) MM.pulseRing(ctx, px, py, r, LR, PH.p, theme, false);
  }
  let finding = false;   // set while the search switches the view, so the switch does not end the pulse it is about to start
  function findFirm(i) {
    endFound(); findPin = -1; finding = true;
    let y = state.year;
    if (TRN.filed[i][y - 2014] === '-') { let best = null; for (let d = 1; d <= 11 && best == null; d++) { if (y - d >= 2014 && TRN.filed[i][y - d - 2014] !== '-') best = y - d; else if (y + d <= 2025 && TRN.filed[i][y + d - 2014] !== '-') best = y + d; } if (best != null) y = best; }
    if (y !== state.year) { window.__atlas.year(y); endPulse(); }
    if (FIRMS_OK && state.mode !== 'firms') { window.__atlas.mode('firms'); endSweep(); }
    finding = false;
    const k = clampK(Math.max(state.cam.k, minSide() / 20)), low = narrow() && stage.height < 450 ? 0.62 : 0.5;   // on a phone map under 450 px tall the firm lands at 62 percent of its height, leaving the docked tile room above it (the author's decision of 25 October 2026)
    const t = { cx: TRN.x[i], cy: TRN.y[i] + (low - 0.5) * stage.height / k, k };
    return flyTo(t).then(r => { if (r.done) landFound(i); return r; });
  }
  function landFound(i) {   // the tooltip at the firm's mark with its name first (until the camera next moves), then the pulse
    const c = cam(), px = c.ox + (TRN.x[i] - c.cx) * c.k, py = c.oy - (TRN.y[i] - c.cy) * c.k;
    findPin = i; lastPointer = { x: px, y: py, inside: true }; showHoverAt(px, py, { touch: true });
    found = { i, t0: performance.now(), static: reduceMotion() };
    if (found.static) { redrawMarksNow(); foundTimer = setTimeout(() => { foundTimer = 0; found = null; redrawMarksNow(); }, PULSE_MS); }
    else foundRaf = requestAnimationFrame(foundTick);
  }
  $('methodintro').textContent = `${fmt.int(F.located_2021)} located eligible firms at ${fmt.int(F.distinct_locations)} distinct coordinate pairs in 2021, 100 km cells by year, city windows at 1 km and 250 m. ${F.release} (Bondarkov et al. 2025, CC BY 4.0), ${fmt.int(F.records_total)} annual records, financial years ${F.years}; boundaries geoBoundaries gbOpen (CC BY 4.0), OpenStreetMap/Wambacher 2017 (ODbL 1.0), © OpenStreetMap contributors. Every number is a checked aggregate with a provenance record in the lab (motion/data/*.provenance.json).`;   // the method block's first lines (round 10): the counts from the former description and the records line from the former footer
  $('methodread').textContent = 'Descriptive associations, not causal effects; absence from the archive is not withdrawal or concealment; the lists are fixed memberships, not dated designations. Treated: a firm on at least one of the five lists (sanctions, decree, resident, government strategic, presidential strategic). The word names the study’s group, not an effect. Comparison group: firms on none of the five lists. Open the atlas at a city by adding its name to the link, as in #Moscow or #St-Petersburg (#Moscow-firms for the firms view).';   // the former footer's reading notes
  $('footer').innerHTML = `<div class="lic">Data: ${F.release}, CC BY 4.0 · geoBoundaries gbOpen, CC BY 4.0 · OpenStreetMap, ODbL 1.0 · © 2026 Armen G. Kaprelian</div>`;   // one line (round 10): the author line is inserted before it below, the data licences at the right
  // The footer line (round 10, the author's item 16): the name with the mark, the email as selectable text with a copy button (no mail link), the website as text until an address is given,
  // two square buttons to the author's X profile and an X share intent with a prepared text; then the licence line (item 17).
  const SHARE_HREF = 'https://x.com/intent/post?text=' + encodeURIComponent('Visibility Atlas: where Russian firms file, and where their statements stop appearing.') + '&url=' + encodeURIComponent('https://claude.ai/artifact/19DNAFozq23ng4qaD18m7n') + '&via=ArmenKaprelian';   // the share intent: text, link and handle as separate fields (the round-10 string quoted the call into the address; the author's report of 25 October 2026)
  $('footer').insertAdjacentHTML('afterbegin', `<div class="byfoot"><span><svg class="mk" aria-hidden="true" focusable="false"><use href="#mark"/></svg>Armen G. Kaprelian</span><span>·</span><span><code id="mail">armenkaprelian@gmail.com</code> <button class="btn sq" id="copymail" type="button" aria-label="Copy the email address" title="COPY THE EMAIL ADDRESS"><svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M5 5V3h8v8h-2M3 5h8v8H3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg></button> <span class="copied" id="copied" aria-live="polite"></span></span><span>·</span><span>[personal website]</span><span>·</span><a class="btn sq" href="https://x.com/ArmenKaprelian" target="_blank" rel="noopener" aria-label="Profile on X" title="PROFILE ON X"><svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3 3l10 10M13 3L3 13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></a><a class="btn sq" href="${SHARE_HREF}" target="_blank" rel="noopener" aria-label="Share on X" title="SHARE ON X"><svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3 5l7 7M10 5L3 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M9 3h4v4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></a></div>`);
  // The method block (round 10): the i button opens it, More expands it, both remembered per viewer.
  const methodOpen = () => ui.method === 'open', methodMore = () => ui.methodMore === 'open';   // the More state is stored as open or closed, the values readPref accepts
  ui.method = readPref('atlas-method') || 'closed'; ui.methodMore = readPref('atlas-method-more') || 'closed';
  function applyMethod() { const open = methodOpen(), more = methodMore(); $('method').hidden = !open; $('methodbtn').setAttribute('aria-expanded', String(open)); $('methodbtn').setAttribute('aria-label', open ? 'Hide the method' : 'Show the method'); $('methodtext').classList.toggle('clamped', !more); $('methodmore').textContent = more ? 'Less' : 'More'; $('methodmore').setAttribute('aria-expanded', String(more)); }
  $('methodbtn').addEventListener('click', () => { ui.method = methodOpen() ? 'closed' : 'open'; writePref('atlas-method', ui.method); applyMethod(); });
  $('methodmore').addEventListener('click', () => { ui.methodMore = methodMore() ? 'closed' : 'open'; writePref('atlas-method-more', ui.methodMore); applyMethod(); });
  applyMethod();
  $('copymail').addEventListener('click', () => { const t = $('mail').textContent, done = ok => { $('copied').textContent = ok ? 'Copied' : ''; if (ok) setTimeout(() => { $('copied').textContent = ''; }, 1500); }; const sel = () => { const r = document.createRange(); r.selectNodeContents($('mail')); const sl = getSelection(); sl.removeAllRanges(); sl.addRange(r); done(false); }; if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(() => done(true), sel); else sel(); });
  // A resize keeps the centre and the span across the width (a phone turned sideways keeps its view).
  // Load-time measurements guarded (round 11, the author's item 7): a frame the host holds hidden at load leaves zero-width layouts behind, so every measurement
  // taken at load (the canvases' size and the landing camera, the minimap's label boxes, the wire's track, the strip's short-form test, the tile's obstacles) is
  // verified when the map's box changes (a ResizeObserver on the wrap, so a frame shown without a window resize event counts too) and after a late font load,
  // and rebuilt where it disagrees; a stage that measured 1 px at load lands on the fit (or the link's preset) instead of scaling a degenerate zoom.
  const layoutsVerified = [];
  function verifyLayouts(reason) {
    const fixed = []; if (verifyMinimap()) fixed.push('minimap');
    if (wireScrolls() && stripOpen() && wireState.sets.length) { const first = wireState.sets[0].els[0]; if (wireVisW() !== wireState.vis || !(wireState.width > 0) || !first || first.getBoundingClientRect().width <= 0) { const [b, n] = bandUnderCamera(); rebuildWire(b, n, 'reset'); fixed.push('wire'); } }
    dropObstacles(); layoutsVerified.push({ reason, fixed, t: Math.round(performance.now()) }); if (layoutsVerified.length > 20) layoutsVerified.shift(); return fixed;
  }
  function onResize() { dropObstacles(); pullFrom = null; const w0 = stage.width, h0 = stage.height; sizeCanvases(); if (w0 <= 1 || h0 <= 1) { const hp = presetFromHash(); state.cam = hp ? hp.preset.target() : fitTarget(); } else if (w0 > 0 && stage.width !== w0) state.cam.k *= stage.width / w0; redrawAll(); syncZoomButtons(); refreshHover(); applyStrip(); applyMix(); updateContext(true); applyRm2(); sizeSlot(); verifyLayouts('resize'); }   // the strip's and the mix box's forms follow the shown size here too: a frame shown without a resize event (round 12, part D)
  window.addEventListener('resize', onResize);
  // The overlays' boxes relative to the map, for the audit's DOM check.
  // Interface labels in tracked capitals (round 10): no label may run past its card, panel or strip, and none may overflow its own box.
  function overflowing() {
    const out = [], sels = ['#theme', '#modes .modelabel', '#modes .btn', '#layers .btn', '#presets .btn', '.yearrow .ui', '#yearlabel', '#legendtitle', '#legendbody .row', '#mixtitle', '#cellinfo > span', '#cellinfo b', '#notelabel', '.byline .who', '.byline .what', '.tagline', 'footer .byfoot', 'footer .lic', '.methodrow .ui', '#methodbtn', '#methodmore'];
    for (const sel of sels) for (const el of document.querySelectorAll(sel)) {
      if (!el.offsetParent) continue;
      const host = el.closest('.card, .maplegend, .mixbox, .mapnote, header, footer'); if (!host) continue;
      const r = el.getBoundingClientRect(), hb = host.getBoundingClientRect(), pr = parseFloat(getComputedStyle(host).paddingRight) || 0;
      if (r.right > hb.right - pr + 0.5 || el.scrollWidth > el.clientWidth + 1) out.push({ sel, text: (el.textContent || '').trim().slice(0, 60), right: Math.round(r.right - (hb.right - pr)), over: el.scrollWidth - el.clientWidth });
    }
    return out;
  }
  function domBoxes() {
    const m = wrap.getBoundingClientRect();
    const rel = id => { const el = $(id); const r = el.getBoundingClientRect(); const visible = !el.hidden && getComputedStyle(el).display !== 'none' && r.width > 0 && r.height > 0; return { x: r.left - m.left, y: r.top - m.top, x1: r.right - m.left, y1: r.bottom - m.top, visible }; };
    const pb = $('pulse'), pulse = Object.assign(rel('pulse'), { disabled: pb.disabled, title: pb.title });   // the side panel's year row, for the audit (map-relative boxes like the others)
    return { overflow: overflowing(), header: { box: rel('hdr'), left: rel('hleft'), lockup: rel('lockup'), right: rel('hright') }, map: { x: 0, y: 0, x1: m.width, y1: m.height, visible: true }, legend: rel('legend'), note: rel('mapnote'), zoom: rel('zoombox'), scale: rel('scalebar'), tip: rel('tip'), pulse, yearrow: rel('yearrow'), year: rel('year'), yearlabel: rel('yearlabel'), yearui: rel('yearui'), cards: Object.fromEntries(CARDS.map(id => [id, { card: rel('card-' + id), head: rel('ch-' + id), title: rel('h2-' + id), toggle: rel('ct-' + id), body: rel('cb-' + id), open: cardOpen(id) }])), minimap: rel('minimap'), presets: (() => { const b = PRESETS.find(p => !p.button.classList.contains('keep')).button, r = b.getBoundingClientRect(); return { x: r.left - m.left, y: r.top - m.top, x1: r.right - m.left, y1: r.bottom - m.top, visible: getComputedStyle(b).display !== 'none' && r.width > 0 }; })(), thumb: rel('yearthumb'), yearPct: +(getComputedStyle($('yearslider')).getPropertyValue('--pct') || 0), thumbHit: (() => { let v = null; for (const sh of document.styleSheets) { let rules; try { rules = sh.cssRules; } catch (e) { continue; } for (const r of rules) if (r.selectorText && /::-webkit-slider-thumb/.test(r.selectorText) && r.style.width) v = Math.min(parseFloat(r.style.width), parseFloat(r.style.height)); } return v; })(), strip: rel('ctxstrip'), striptoggle: rel('ctxtoggle'), glyph: rel('ctxglyph'), wire: rel('ctxtext'), stripOpen: stripOpen(), mix: rel('mixbox'), mixtoggle: rel('mixtoggle'), mixOpen: mixOpen(), tipRelaxed: $('tip').style.display !== 'none' && tileState ? tileState.relaxed : null };
  }
  // Driven by tools/atlas-audit.py: switch the layer and the year, redraw, and hand back the text boxes, the overlays'
  // boxes and the camera; the camera moves here are instant.
  window.__atlas = {
    layers: LAYERS.map(L => L.id),
    layer(id) { const b = layersEl.querySelector(`button[data-id="${id}"]`); if (b) b.click(); },
    year(y) { $('year').value = String(y); $('year').dispatchEvent(new Event('input')); },
    redraw() { Motion.audit.boxes = []; Motion.audit.seq = 0; redrawAll(); return { boxes: Motion.audit.boxes, dom: domBoxes() }; },
    tips() {   // every tip measured in the strip's hidden span as it would show (round 10): the audit asserts none is clipped at any width
      const el = stripState.cur === 'A' ? $('ctxB') : $('ctxA'); const keep = el.innerHTML, had = el.classList.contains('tip'), box = $('ctxtext'), hadRm = box.classList.contains('rm'); el.classList.add('tip'); box.classList.add('rm');   // measured in the lead's full width, the reduced-motion form where the tips show there (round 12)
      const out = TIPS.flatMap((t, i) => [t.text, t.touch].filter(Boolean).map(str => { el.innerHTML = units(esc(str)); return { i, text: str, w: el.scrollWidth, slot: el.clientWidth, h: el.scrollHeight, hslot: el.clientHeight, clipped: el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1 }; }));
      el.innerHTML = keep; el.classList.toggle('tip', had); box.classList.toggle('rm', hadRm); return out;
    },
    camera() { return { cx: state.cam.cx, cy: state.cam.cy, k: state.cam.k }; },
    kFit() { return kFit(); },
    preset(label) { const p = PRESETS.find(p => p.label === label); if (!p) return false; flyTo(p.target(), { instant: true }); return true; },
    minimap() { const m = $('minimap'), cs = getComputedStyle(m), r = m.getBoundingClientRect(); return { visible: cs.display !== 'none' && r.width > 0, rings: MMAP && MMAP.rings, labels: MMAP ? MMAP.cities.map(c => c.label) : [], russia: MMAP && MMAP.russia, violations: minimapCheck(), width: r.width, cities: MMAP ? MMAP.cities : [], builds: mmBuilds, widths: MMAP ? MMAP.widths : null, titles: PRESETS.map(p => { const t = p.node ? p.node.querySelector('title') : null; return { label: p.label, button: p.button.title || '', svg: p.node ? (t ? t.textContent : '') : null }; }) }; },   // the minimap's geometry and the layout rules (round 10)
    minimapVerify() { return verifyMinimap(); },   // the rendered labels checked against the built widths (25 October): true when it rebuilt
    ghostSizes() { return ghostRank().map(g => ({ label: g.city.label, n: g.n, size: g.size })); },   // the ghost names' rank table (round 12)
    layouts() { const mm = $('minimap'); return { stage: [stage.width, stage.height], cam: { cx: state.cam.cx, cy: state.cam.cy, k: state.cam.k }, kfit: kFit(), minimap: { builds: mmBuilds, width: mm ? Math.round(mm.getBoundingClientRect().width) : 0, boxes: MMAP ? Math.round(MMAP.cities.reduce((t, c) => t + (c.box.x1 - c.box.x), 0)) : 0 }, wire: { width: wireState.width, vis: wireState.vis, x: Math.round(wireX()), sets: wireState.sets.length, items: $('wiretrack').querySelectorAll('.wi').length, builds: wireState.builds, resets: wireState.resets }, strip: { clipped: this.context().clipped }, obstacles: tileObstacles().length, verified: layoutsVerified.slice(-6) }; },   // every load-time layout, for the hidden-frame check (round 11, item 7)
    verifyLayouts() { return verifyLayouts('api'); },
    minimapClick(label) { const p = PRESETS.find(p => p.label === label); if (!p || !p.node) return null; return flyTo(p.target(), { instant: true }).then(() => cam()); },   // the group's own path, instant
    hoverKm(x, y, opts) { const c = cam(); const px = c.ox + (x - c.cx) * c.k, py = c.oy - (y - c.cy) * c.k; let h; if (opts && opts.show && px >= 0 && px < stage.width && py >= 0 && py < stage.height) { lastPointer = { x: px, y: py, inside: true }; h = showHoverAt(px, py, { touch: !!opts.touch }); } else { const km = { x, y, px, py }; h = hitAt(km); h.kmx = x; h.kmy = y; state.hover = h; } return { kind: h.kind || 'cell', address: !!(h.kind === 'firm' || h.address), grid: h.grid, origin: h.origin || [0, 0], fine: !!h.fine, micro: !!h.micro, n: h.n == null ? null : h.n, listed: h.listed || null }; },
    click(x, y, opts) { const c = cam(); const p = { x, y, px: c.ox + (x - c.cx) * c.k, py: c.oy - (y - c.cy) * c.k }; const h = hitAt(p); h.kmx = x; h.kmy = y; const r = ladderTarget(h, p, !!(opts && opts.shift)); return (r ? flyTo(r.target, { instant: true }) : Promise.resolve()).then(() => Object.assign(this.camera(), { moved: !!r, rung: r ? r.rung : null })); },
    zoom(dir) { return flyTo(dir > 0 ? stepCentre(2) : dir < 0 ? stepCentre(0.5) : fitTarget(), { instant: true }).then(() => this.camera()); },
    zoomBy(f, km) { const c = cam(); const p = km ? { x: km[0], y: km[1], px: c.ox + (km[0] - c.cx) * c.k, py: c.oy - (km[1] - c.cy) * c.k } : null; return flyTo(p ? stepAt(p, f) : stepCentre(f), { instant: true }).then(() => this.camera()); },   // an instant step by a factor, anchored at a km point or the centre (the audit's wheel)
    fly(target) { return flyTo(target); },
    // the real frame cadence of a flight to target: intervals between animation frames while it runs
    profileFlight(target) { const stamps = [], ks = []; const tick = now => { stamps.push(now); ks.push(state.cam.k); if (flight) requestAnimationFrame(tick); }; requestAnimationFrame(tick); return flyTo(target).then(r => { const iv = [], slow = []; for (let i = 1; i < stamps.length; i++) { const d = stamps[i] - stamps[i - 1]; iv.push(d); if (d > 25) slow.push([+ks[i - 1].toFixed(2), Math.round(d)]); } const sorted = iv.slice().sort((a, b) => a - b); const mean = iv.reduce((s, v) => s + v, 0) / Math.max(1, iv.length); return { frames: r.frames, ms: Math.round(r.ms), fps: Math.round(r.frames / Math.max(1, r.ms) * 1000), mean: +mean.toFixed(1), p95: +(sorted[Math.floor(sorted.length * 0.95)] || 0).toFixed(1), max: +(sorted[sorted.length - 1] || 0).toFixed(1), over25: slow.length, slow }; }); },
    hoverCost(n = 30) { const W = stage.width, H = stage.height; const t0 = performance.now(); let mx = 0; for (let i = 0; i < n; i++) { const a = performance.now(); showHoverAt(W * (0.2 + 0.6 * ((i * 7919) % 1000) / 1000), H * (0.2 + 0.6 * ((i * 104729) % 1000) / 1000)); mx = Math.max(mx, performance.now() - a); } hideHover(); return { mean: +((performance.now() - t0) / n).toFixed(2), max: +mx.toFixed(2) }; },
    // the subject's screen distance from the centre along the flight that fly(target) would take, at n + 1 samples
    pathPreview(target, n = 20) { const from = { cx: state.cam.cx, cy: state.cam.cy, k: state.cam.k }, to = { cx: target.cx, cy: target.cy, k: clampK(target.k) }; const ms = 1000, path = flightPath(from, to, ms); const out = []; for (let i = 0; i <= n; i++) { const p = path(ms * i / n); out.push(Math.hypot((to.cx - p.cx) * p.k, (to.cy - p.cy) * p.k)); } return out; },
    legend(open) { setLegend(open == null ? null : open ? 'open' : 'closed'); },   // null: back to the width rule
    note(open) { setNote(open == null ? null : open ? 'open' : 'closed'); },
    frameCost(n = 20) { const t0 = performance.now(); let mx = 0; for (let i = 0; i < n; i++) { const a = performance.now(); layersDirty(); drawMap({ flight: true }); mx = Math.max(mx, performance.now() - a); } const mean = (performance.now() - t0) / n; drawMap(); return { mean, max: mx }; },
    mode(m) { const b = modesEl.querySelector(`button[data-mode="${m}"]`); if (b) b.click(); return state.mode; },
    field() { return useGL() ? glKind : '2d'; },
    fieldRegime() { return Object.assign({ gl: useGL(), error: glError, dotsK: dotsK() }, pixDrawn); },   // the last field draw: the engine and the pixel field's and the dots' weights (round 14)
    // The pixel field against an independent sum (round 14): the CPU engine's cells for the current view, their summed firms and the firms at the coordinate pairs
    // inside the view's cells, which must agree, and on the GPU the share of composed pixels that differ from the CPU's image by more than 2 levels.
    pixelStats() {
      const d = state.mode === 'firms' ? firmYears.get(state.year) : null; if (!d) return null; const c = cam(), k = c.k, L = state.layer, P = pixelParams(c, L), view = { cx: c.cx, cy: c.cy, k, ox: c.ox, oy: c.oy, W: P.W, H: P.H };
      const i0 = lowerBound(d.x, (c.cx - c.ox / k - 2 / k) * 1000), i1 = lowerBound(d.x, (c.cx + (stage.width - c.ox) / k + 2 / k) * 1000);
      const S = PixelField.cpuSums(d, view, P.code, i0, i1, POW), C = PixelField.cpuClassify(S, P.code, P.breaks); let sumN = 0, inView = 0, cells = 0;
      for (let y = 1; y < S.H - 1; y++) for (let x = 1; x < S.W - 1; x++) { const j = y * S.W + x; if (S.n[j] > 0) { sumN += S.n[j]; cells++; } }
      const ax = c.ox - c.cx * k, ay = c.oy + c.cy * k, kk = k / 1000; for (let i = i0; i < i1; i++) { const gx = Math.floor(ax + d.x[i] * kk), gy = Math.floor(ay - d.y[i] * kk); if (gx >= 0 && gy >= 0 && gx < P.W && gy < P.H) inView += d.nn[i]; }
      const colourOf = cls => [P.pal[3 * cls] * 255, P.pal[3 * cls + 1] * 255, P.pal[3 * cls + 2] * 255, P.alpha[cls] * PixelField.LAYER_ALPHA], cpu = PixelField.cpuCompose(C, P.W, P.H, colourOf, P.back.map(v => v * 255));
      let gpuDiff = null; if (useGL() && pixKey) { const g = pfGL.readComposed(P); let bad = 0, lit = 0; for (let o = 0; o < g.length; o += 4) { if (g[o + 3] || cpu[o + 3]) lit++; if (Math.max(Math.abs(g[o] - cpu[o]), Math.abs(g[o + 1] - cpu[o + 1]), Math.abs(g[o + 2] - cpu[o + 2]), Math.abs(g[o + 3] - cpu[o + 3])) > 2) bad++; } gpuDiff = { bad, lit, share: lit ? bad / lit : 0 }; }
      const blocks = [0, 0, 0, 0]; for (let j = 0; j < C.size.length; j++) blocks[C.size[j]]++;
      return { k, cells, sumN, inView, blocks, gpuDiff, engine: useGL() ? 'webgl2' : '2d', layer: L, year: state.year };
    },
    sweep(on) { if (on === false) endSweep(); else if (on) { try { sessionStorage.removeItem('atlas-sweep'); } catch (e) { /* no storage */ } fieldAnim.swept = false; maybeSweep(); } const sw = sweepX(); return { on: !!fieldAnim.sweep, pending: !!fieldAnim.sweepPending, x: sw ? sw.x : null, raf: fieldAnim.raf }; },   // the opening sweep (round 14): start it again, end it, or read it
    dissolve() { return { on: !!fieldAnim.dissolve, t: dissolveT(), started: !!(fieldAnim.dissolve && fieldAnim.dissolve.t0 != null) }; },
    glState() { return { kind: glKind, lost: glLost, isContextLost: gl ? gl.isContextLost() : null, error: glError, events: glEvents.slice() }; },
    loseContext() { if (glLoseExt) glLoseExt.loseContext(); return !!glLoseExt; },
    restoreContext() { if (glLoseExt) glLoseExt.restoreContext(); return !!glLoseExt; },
    pulsing() { return pulse ? pulse.count : 0; },
    pulse() { return replayPulse(); },
    hoverPx(px, py, opts) { return showHoverAt(px, py, opts || {}); },   // round 9: a hover at a map pixel (the tile placement states)
    tapAt(px, py) { return showHoverAt(px, py, { touch: true }); },
    tile() { return Object.assign({ firms: viewFirms }, tileState); },
    firmsInView() { return countFirmsInView(); },   // the footer's count recomputed now (round 11, item 3)
    floor() { return { kfit: kFit(), kfloor: kFloor(), fraction: FLOOR_FRACTION }; },   // the zoom floor (round 11, item 5)
    strip(open) { ui.ctx = open == null ? null : (open ? 'open' : 'closed'); applyStrip(); if (stripOpen()) updateContext(true); return stripOpen(); },
    context() { const el = stripState.cur === 'A' ? $('ctxA') : $('ctxB'); const [band, name] = bandUnderCamera(); return { band, name, locs: el.querySelectorAll('.loc').length, kind: stripState.tip ? 'tip' : (stripState.fact ? stripState.fact.kind : 'none'), text: stripState.tip && wireScrolls() ? stripState.tip.text : el.textContent, glyph: stripState.glyphName, glyphD: $(stripState.glyphCur === 'A' ? 'ctxpathA' : 'ctxpathB').getAttribute('d') || '', open: stripOpen(), clipped: el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1, motion: !reduceMotion() }; },
    wire() { const ws = wireState, x = wireX(), vis = wireVisW(), cur = ws.sets[0], lead = cur && cur.els.length ? cur.els[0] : $('wiretrack').querySelector('.wi.lead'); return { slotW: $('ctxlead').getBoundingClientRect().width, barW: $('ctxstrip').clientWidth, slot: (stripState.cur === 'A' ? $('ctxA') : $('ctxB')).textContent.trim(), rendered: wireRenderedX(), restarts: ws.restarts, key: ws.key, pending: !!ws.timer, items: ws.cycle.map((it, i) => ({ i, kind: it.kind, text: plainOf(it), src: it.src })), cycle: ws.cycleIndex, width: ws.width, locs: lead ? lead.querySelectorAll('.loc').length : 0, scrolls: wireScrolls(), dur: ws.width ? +(ws.width / WIRE_SPEED).toFixed(1) + 's' : '', x, vis, pinned: ws.pinned, paused: ws.paused, builds: ws.builds, resets: ws.resets, commits: ws.commits, caps: WIRE_CAPS, orphans: ws.orphans.length / 2, dom: $('wiretrack').querySelectorAll('.wi').length, timers: { debounce: !!ws.timer, commit: !!ws.commitTimer, top: !!ws.topTimer }, heap: performance.memory ? performance.memory.usedJSHeapSize : null, lead: { text: $(stripState.cur === 'A' ? 'ctxA' : 'ctxB').textContent, width: $('ctxlead').clientWidth }, sets: ws.sets.map(sset => ({ key: sset.key, status: sset.status, x0: setStart(sset), x1: setEnd(sset), entered: setEntered(sset, x), items: sset.els.length / 2, lead: sset.els.length ? plainOf({ text: sset.els[0].innerHTML }).slice(0, 80) : '' })) }; },   // the wire's current cycle, its two-set queue and the lead slot (rounds 10 to 12)
    wireGaps() {   // the separators' clearances (the author's report of 25 October 2026): the smallest gap between a separator mark and the items beside it on the track, the lead separator's two margins, the window's edge fade, and any item box a mark covers
      const tr = wireTrack(), kids = [...tr.children], rs = kids.map(el => { if (el.classList.contains('wsep')) return el.getBoundingClientRect(); const rg = document.createRange(); rg.selectNodeContents(el); return rg.getBoundingClientRect(); }); let min = Infinity, covered = 0;   // an item's text extent, not its padded box
      for (let i = 0; i < kids.length; i++) { if (!kids[i].classList.contains('wsep')) continue; const s = rs[i]; if (i > 0) { const g = s.left - rs[i - 1].right; if (g < min) min = g; if (g < -0.5) covered++; } if (i + 1 < kids.length) { const g = rs[i + 1].left - s.right; if (g < min) min = g; if (g < -0.5) covered++; } }
      const lead = $('ctxlead').getBoundingClientRect(), sep = document.querySelector('.ctxt .lsep'), sr = sep ? sep.getBoundingClientRect() : null, win = $('ctxwin').getBoundingClientRect(), cs = getComputedStyle($('ctxwin')), mask = cs.maskImage || cs.webkitMaskImage || 'none';
      return { min: kids.length ? min : null, covered, lsepLeft: sr && sr.width ? sr.left - lead.right : null, lsepRight: sr && sr.width ? win.left - sr.right : null, fade: mask !== 'none' && mask.includes('gradient'), em: parseFloat(getComputedStyle($('ctxtext')).fontSize), items: kids.length };
    },
    wireStall(on) { const ws = wireState; if (!ws.anim) return false; if (on) ws.anim.pause(); else ws.anim.play(); return true; },   // a stalled animation the page did not ask for (the watchdog's audit state)
    wireCaps(on) { if (on != null) { WIRE_CAPS = !!on; applyWireCaps(); } return WIRE_CAPS; },   // the capitals experiment's switch (round 12, part D)
    wireSeek(x) { wireStop(); wireAnimate(Math.max(0, x)); return wireX(); },   // a frames hook: the track scrolled to x at once (round 12)
    wireItemX(kind, n = 0) { const el = wireTrack().querySelectorAll('.wi.' + kind)[n]; return el ? wirePos(el)[0] : null; },   // a frames hook: the left edge of the n-th item of a kind on the track
    ruler() { const svg = $('ruler'), b = $('scalebar').getBoundingClientRect(), labels = [...svg.querySelectorAll('text')].map(t => { const r = t.getBoundingClientRect(); return { text: t.textContent, unit: t.classList.contains('unit'), x: r.left - b.left, x1: r.right - b.left, y: r.top - b.top, y1: r.bottom - b.top }; }); return Object.assign({ box: { w: b.width, h: b.height }, labels, narrow: narrow() }, rulerState || {}); },   // the ruler's step, ticks and label boxes (round 12, part D)
    mosaic() { const y = microYear(), b = mosaicCache.get(y + '|1'); return { year: y, ready: microReady(y), level: b ? { count: b.count, sumN: b.sumN } : null, builds: mosaicBuilds, drawn: Object.assign({}, cellsDrawn), state: mosaicState, sets: sqGL ? [...sqGL.sets.keys()] : [], log: drawLog.slice() }; },   // the Cells view's 1 km squares (round 14; round 13's binned Firms view before)
    binAt(x, y) { const yr = microYear(), b = mosaicCache.get(yr + '|1'); if (!b) return null; const j = b.idx.get(binKey(Math.floor(x), Math.floor(y))); return j === undefined ? null : { T: 1, year: yr, n: b.n[j], p: b.p[j], a: b.a[j], f: b.f[j], share: mosaicClass(b, j, 'share'), ind: mosaicClass(b, j, 'industry') }; },
    hoverPixel() { const h = state.hover, p = h && (h.kind === 'pixel' ? h : h.pixel); return p ? { cell: p.cell, n: p.n, a: p.a, p: p.p, size: p.size } : null; },   // the hovered pixel (round 14)
    pixelSum(gx, gy) { const d = firmYears.get(state.year); if (!d) return null; const c = cam(); let n = 0, a = 0, p = 0; for (let i = 0; i < d.n; i++) { const sx = c.ox + (d.x[i] / 1000 - c.cx) * c.k, sy = c.oy - (d.y[i] / 1000 - c.cy) * c.k; if (Math.floor(sx) === gx && Math.floor(sy) === gy) { n += d.nn[i]; a += d.a[i]; p++; } } return { n, a, p }; },   // every address of the year tested against one CSS pixel, for the audit's independent sum
    legendSide(v) { if (v != null) { ui.legendRead = v ? 'open' : 'closed'; applyPanels(); } return ui.legendRead === 'open'; },   // the legend's reading side on or off (round 14)
    find(q) { const el = $('findinput'); el.value = q; el.dispatchEvent(new Event('input')); return [...document.querySelectorAll('#findlist .fo[data-i]')].map(b => ({ i: +b.dataset.i, name: TRN.name[+b.dataset.i], text: b.textContent })); },   // the search as typed (round 14)
    findKeys(i) { return findIndex()[i]; },
    foundState() { return { found: found ? { i: found.i, static: found.static } : null, pin: findPin, hash: location.hash, mode: state.mode, year: state.year, cam: { cx: state.cam.cx, cy: state.cam.cy, k: state.cam.k } }; },
    viewHash() { return viewHash(); },
    foundAt(ms) { if (!found) return false; if (foundRaf) cancelAnimationFrame(foundRaf); foundRaf = 0; found.at = ms; redrawMarksNow(); return true; },   // a frozen frame of the found firm's pulse, for the pictures
    viewLink() { return viewLink(); },
    tileCount() { const el = $('tipbody').querySelector('.lc'); if (!el) return null; const cs = getComputedStyle(el); return { text: el.textContent, colour: cs.color, size: parseFloat(cs.fontSize), weight: cs.fontWeight, year: layerYear(), dot: !!el.querySelector('.dot'), first: el.parentElement.classList.contains('t-l1') }; },   // the Cells tile's red count (round 14)
    cellPulseAt(ms) { endCellPulse(); if (ms == null) { drawCellsMarks(cam()); return 0; } const n = cellsPulse(); if (cellPulse) { if (cellPulseRaf) cancelAnimationFrame(cellPulseRaf); cellPulseRaf = 0; if (cellPulseTimer) { clearTimeout(cellPulseTimer); cellPulseTimer = 0; } cellPulse.at = ms; drawCellsMarks(cam()); } return n; },   // a frozen Cells pulse at ms (round 14); cellPulseAt(null) clears it
    cellPulseState() { return cellPulse ? { count: cellPulse.count, static: cellPulse.static, cells: cellPulse.cells.map(q => [q.x, q.y, q.delay]) } : null; },
    mosaicOff(v) { if (v != null) { mosaicOff = !!v; drawMap(); } return mosaicOff; },   // the squares off, for the contrast probe
    anchors() { return AN ? { a: [AN.a.x_km, AN.a.y_km], b: [AN.b.x_km, AN.b.y_km], distance: AN.distance_m, computed: Math.round(Math.hypot(AN.a.x_km - AN.b.x_km, AN.a.y_km - AN.b.y_km) * 1000) } : null; },   // the pair (round 12, part D, item 5)
    anniversary(iso) { const a = anniversaryLine(iso); return a ? a.text : null; },   // the builder for a given ISO day (item 6)
    today() { return TODAY; },
    wireAt(y, region) { const keep = state.year; state.year = y; const c = buildCycle(y, region === 'Russia' ? 'national' : 'region', region, 0); state.year = keep; return c.map((it, i) => ({ i, kind: it.kind, text: plainOf(it), src: it.src })); },
    tipTexts() { return TIPS.flatMap(t => [t.text, t.touch].filter(Boolean)); },
    tip(force) { if (force === 'reset') { stripState.seen.clear(); try { sessionStorage.removeItem('atlas-tips'); } catch (e) { /* no storage */ } return true; } if (force === false) { endTip(true); return false; } return maybeTip(true); },
    glyph(name) { return regionGlyph(name); },
    jump(t) { return flyTo(t, { instant: true }).then(() => cam()); },
    hoverOff() { lastPointer = null; hideHover(); return true; },   // round 9: clear a hover (the frames tool's rest frames); the pointer is forgotten too, so a settle does not revive it (round 13)
    mix() { const el = $('mixbox'); return { visible: !el.hidden, open: mixOpen(), title: $('mixtitle').textContent, unit: $('mixunit').textContent, rows: [...document.querySelectorAll('#mixrows .r')].map(r => ({ name: r.querySelector('.nm').textContent, pct: r.querySelector('.pc') ? r.querySelector('.pc').textContent : null, colour: r.querySelector('.sw') ? r.querySelector('.sw').style.background : null })) }; },
    mixbox(open) { openMix(open == null ? null : (open ? 'open' : 'closed')); return mixOpen(); },
    mixCost(n = 10) { const t0 = performance.now(); let mx = 0; for (let i = 0; i < n; i++) { const a = performance.now(); viewMix.key = ''; computeViewMix(); mx = Math.max(mx, performance.now() - a); } return { mean: +((performance.now() - t0) / n).toFixed(2), max: +mx.toFixed(2), rows: viewMix.rows ? viewMix.rows.length : 0 }; },
    still() { if (stillTimer) { clearTimeout(stillTimer); stillTimer = 0; } cursorStill = true; wrap.classList.remove('cursor-live'); drawOverlay(state.hover); return true; },
    live(on) { if (stillTimer) { clearTimeout(stillTimer); stillTimer = 0; } cursorStill = !on; wrap.classList.toggle('cursor-live', !!on); drawOverlay(state.hover); return !cursorStill; },   // a test hook: hold the moving state for a frame
    overlayCost(n = 30) { const t0 = performance.now(); let mx = 0; for (let i = 0; i < n; i++) { const a = performance.now(); drawOverlay(state.hover); mx = Math.max(mx, performance.now() - a); } return { mean: +((performance.now() - t0) / n).toFixed(3), max: +mx.toFixed(3) }; },
    contextCost(n = 30) { const t0 = performance.now(); let mx = 0; for (let i = 0; i < n; i++) { const a = performance.now(); updateContext(true); mx = Math.max(mx, performance.now() - a); } return { mean: +((performance.now() - t0) / n).toFixed(3), max: +mx.toFixed(3) }; },
    listedRule() { const c = cam(), L = MM.listedRule(markRule(c.k), c.k, kFit()), rMax = MM.listedRadius(L, 65535), rMin = MM.listedRadius(L, 1); return Object.assign({ k: c.k, rMin, rMax, cull: MARK_MARGIN, pulseMs: PULSE_MS, decayMs: DECAY_MS, flashMax: MM.flashPeak(rMax), glowMax: 2 * (rMax + MM.flashPeak(rMax)) }, L); },   // the rule at the current zoom, for the audit
    pulseAt(ms) { if (ms == null) { endPulse(); drawMarks(cam()); return 0; } const m = manualMask(state.year); if (!m.count) return 0; endPulse(); makePulse(m.mask); pulse = { t0: performance.now() - ms, mask: m.mask, count: m.count, static: false, at: ms }; setLive(true); drawMarks(cam()); return m.count; },   // a frozen pulse frame at ms, for the comparison pictures; pulseAt(null) clears it
    ready() { const micro = state.mode !== 'firms' && MICRO_LAYERS.has(state.layer) && FIRMS_OK, y = microYear(); return Promise.all([state.mode === 'firms' ? ensureYear(state.year) : micro ? ensureYear(y).then(() => { if (!mosaicCache.has(y + '|1')) { mosaicBins(y, 1); layersDirty(); drawMap(); } }) : Promise.resolve()]).then(() => {}); },
    cities: Object.fromEntries(bmp.cities.map(c => [c.label, [c.x, c.y]])),
    twinNote(y) { return twinNotes[y] == null ? null : twinNotes[y]; },   // the gzip comment of a loaded twin (round 10)
    drawOrder() { return drawLog.slice(); },   // the last drawMap's steps: basemap, mark, then the layer
    handover() { return Object.assign({}, handover); },
    grain(on) { document.documentElement.classList.toggle('nograin', on === false); return !document.documentElement.classList.contains('nograin'); },   // the surface grain on or off, for the audit's contrast guard (round 10)
    card(id, open, persist) { if (persist) writePref('atlas-card-' + id, open ? 'open' : 'closed'); setCard(id, open == null ? null : open ? 'open' : 'closed'); return cardOpen(id); },   // a card's collapse state (round 10)
    cards() { return Object.fromEntries(CARDS.map(id => [id, cardOpen(id)])); },
    noteState() { return { open: !$('notebody').hidden, pref: ui.note || null, band: bandUnderCameraOwn()[0], strip: stripOpen() }; },   // the note's state and what decides it (round 10)
    ghost() { const c = cam(); return { alpha: GHOST_ALPHA, drawn: ghostDrawn, laid: ghostLayout(c.k).length, bucket: Math.floor(Math.log2(c.k)), colour: theme.go }; },   // the ghost names (round 10; floating at a fixed size and opacity since round 12, part D)
    hoverRegion() { return hoverRegionName; },
    pxOf(x, y) { const c = cam(); return [c.ox + (x - c.cx) * c.k, c.oy - (y - c.cy) * c.k]; },   // a km point on the screen (the region-fill states)
    regionFill() { return { name: hoverRegionName, alpha: theme.dark ? REGION_FILL.dark : REGION_FILL.light }; },
    regionVertex(name, i = 0) { const p = BM.lod0.parts.find(p => p.name === name); if (!p) return null; const r = p.rings[0], n = r.length / 2, j = Math.min(Math.max(0, i | 0), n - 1); let x = r[0] / 10, y = r[1] / 10; for (let k = 1; k <= j; k++) { x += r[2 * k] / 10; y += r[2 * k + 1] / 10; } const [px, py] = Motion.project(cam(), x, y); return { x, y, px, py, i: j }; },   // the i-th vertex of the region's first ring (deltas in 0.1 km), in km and on screen
    pixelsAt(id, px, py) { const cv = $(id), d = window.devicePixelRatio || 1, g = cv.getContext('2d'), out = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) out.push(Array.from(g.getImageData(Math.round((px + dx) * d), Math.round((py + dy) * d), 1, 1).data)); return out; },   // the 3 by 3 pixels of a canvas around a point   // the city-window hand-over (round 10): the window's strength, the outside layer's alpha and whether it is outlined
    method(open) { if (open != null) { ui.method = open ? 'open' : 'closed'; applyMethod(); } return this.methodState(); },
    methodMore(more) { if (more != null) { ui.methodMore = more ? 'open' : 'closed'; applyMethod(); } return this.methodState(); },
    methodState() { const m = $('method'), t = $('methodtext'), r = t.getBoundingClientRect(); return { open: !m.hidden && getComputedStyle(m).display !== 'none', more: methodMore(), height: r.height, lineHeight: parseFloat(getComputedStyle($('methodintro')).lineHeight), moreLabel: $('methodmore').textContent, pressed: $('methodbtn').getAttribute('aria-expanded'), intro: $('methodintro').textContent.slice(0, 60), prov: $('layerprov').textContent.slice(0, 40), read: $('methodread').textContent.slice(0, 40) }; },
    markAt() { const cx = Math.round(stage.width / 2), cy = Math.round(stage.height - (stripOpen() ? (narrow() ? 44 : 26) : 0) - 44 - 48); const px = (x, y) => Array.from($('map').getContext('2d').getImageData(Math.round(x * (window.devicePixelRatio || 1)), Math.round(y * (window.devicePixelRatio || 1)), 1, 1).data); return { cx, cy, on: px(cx - 40, cy - 28), off: px(cx - 52, cy - 28), stage: theme.stage, land: theme.land, ink: theme.ink }; },   // the authorship mark's pixel (on the left bracket's arm) and the stage beside it (round 10)
  };
  Promise.all([document.fonts.ready, document.fonts.load('400 13px "IBM Plex Mono"'), document.fonts.load('500 13px "IBM Plex Mono"'), document.fonts.load('700 13px "IBM Plex Mono"')].map(p => p.catch(() => null))).then(() => { sizeCanvases(); applyStrip(); applyMix(); const hp = presetFromHash(), hv = hp ? null : viewFromHash(); state.cam = hp ? hp.preset.target() : fitTarget(); syncThemeButton(); syncPulseButton(); if (hp && hp.firms && FIRMS_OK) window.__atlas.mode('firms'); if (hv) applyView(hv, true); redrawAll(); hashOn = true; syncZoomButtons(); syncMix(); buildMinimap(); syncPresetPressed(); applyWireCaps(); if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', () => verifyLayouts('fonts')); if (window.ResizeObserver) new ResizeObserver(() => { if (Math.round(wrap.clientWidth) !== stage.width || Math.round(wrap.clientHeight) !== stage.height) onResize(); }).observe(wrap); });
})();
