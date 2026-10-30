// Visibility atlas: an interactive explorer over the same aggregates as the explainer. State lives
// in the page; the map redraws on every state change; every panel names its source.
(function () {
  'use strict';
  const D = window.MOTION_DATA, S = D.series, C100 = D.cells100, DEN = D.density, BM = D.basemap, CY = D.cellsyears;
  const F = S.facts, fmt = Motion.fmt, MM = MotionMap, CH = MotionCharts;
  MM.listedQuiet = 1; MM.listedCased = 1; MM.pulseModern = 1;   // the atlas's quieter resting listed marks at the national zoom (round 11, item 2) and the cased marks of round 14 (B''); the video keeps round 8's rule
  { const q = new URLSearchParams(location.search); MM.hairlines = q.get('hairlines') === '0' ? 0 : 1; MM.landLevels = q.get('land') === '0' ? 0 : 1; }   // round 14: the borders as 1 device px hairlines on fractional device ratios, and the land by level of detail; ?hairlines=0 and ?land=0 draw as before, for the comparison crops
  const $ = id => document.getElementById(id);
  // Round 16, the author's two items of 27 October 2026, as picked the same day: the coordinate pairs shared by 100 or more firms (a ring sized by the pair's
  // firms in the Firms view, spB, and a layer in the Cells view) and the change in the statement share among state-related firms by region (one layer: the
  // author's revision dropped the unitary-enterprise layer; round 24 found those firms about half of the state-related ones). Their data load on first use.
  let SHD = null, GRP = null, markShared = false; const dataPending = new Set();
  const grpLayer = () => state.layer === 'gs';
  const blinkState = { on: false, timer: 0, base: 0, alt: 0, held: false }, runState = { on: false, timer: 0 }, catKey = { buf: '', next: 0 };   // the extras' state (round 15, item 7)
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
    // layers, the light pair (darker outward) for signed change, the light nine. The light share ramp's palest step is #E0EFFC since 27 October 2026 (#D9E8F5, 0.02 darker in OKLab L,
    // before), so it stays visible on the darker land (a colour difference of 5.5 from #D7DCE0 against 3.6).
    const t = { dark, stage: tok('stage'), land: tok('land'), border: tok('border'), graticule: tok('graticule'), ink: tok('ink'), muted: tok('muted'), dim: tok('dim'), grid: tok('grid'), panel: tok('panel'),
             ind9: (() => { const t = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => tok('ind-' + i)); return t.every(Boolean) ? t : IND_T ? (dark ? IND_T.classes.colour_dark : IND_T.classes.colour_light) : []; })(),   // the tokens first (round 10), the pass's table as the fallback
             cursor: tok('cursor') || '#FF45C8', cursorLive: tok('cursor-live') || '#FF8FDF', context: tok('context') || '#4DFF7F', contextLive: tok('context-live') || '#9AFFB8',   // the two accents (round 9): UI only, never data; the full neon rests, the live variant moves
             accent: tok('accent'), accentStrong: tok('accent-strong'), fall: tok('fall'), rise: tok('rise'), below: tok('below'), highlightBand: tok('highlight'), tick: tok('dim'), axis: tok('dim'), barMuted: tok('border'),
             ramp6: dark ? ['#1C8383', '#269C96', '#50B5AA', '#79CDBF', '#A1E4D3', '#C7F8E7'] : ['#E0EFFC', '#A9C4DE', '#78A3C9', '#4F84B4', '#2F6395', '#16436E'],
             ramp5: dark ? ['#269C96', '#50B5AA', '#79CDBF', '#A1E4D3', '#C7F8E7'] : ['#78A3C9', '#4F84B4', '#2F6395', '#16436E', '#061C38'],
             change6: (() => { const t = [1, 2, 3, 4, 5, 6].map(i => tok('div-' + i)); return t.every(Boolean) ? t : dark ? ['#FFB000', '#F39523', '#EA7719', '#50B5AA', '#79CDBF', '#A1E4D3'] : ['#854505', '#9D5E01', '#B27901', '#1C989E', '#0A7E83', '#196369']; })(),   // classes 1 to 6, the largest decline first; the same six serve the revenue layer (div6)
             density: dark ? '#79CDBF' : '#16436E',
             ghost: tok('ghost') || (dark ? '#1F3350' : '#C3C8CC'),   // one step above the land (round 10): the hand-over outline, the hairline borders
             go: tok('go') || (dark ? '#9CC8FF' : '#22364D'),
             tileInk: tok('tile-ink') || (dark ? '#CFE6FF' : '#22364D'),   // the tile's text, and the ghost names from 8B on (rounds 15 and 16)   // the GO TO card's ice (item 21): the ghost names take it at 30 percent, so the two stay tied (round 12, final)
             neutral: FM ? (dark ? FM.neutral.dark : FM.neutral.light) : '#B5C3D1', zero: tok('zero') || (FM && FM.zero ? (dark ? FM.zero.dark : FM.zero.light) : (dark ? '#6B7482' : '#727C86')), treated: tok('treated') || '#E31A1C', treatedOutline: '#FFD9D9' };
    // The light theme's edges (27 October 2026, the author's request that the light theme's contrast need no worry): a cell whose fill is under 3:1 against the land takes a
    // hairline in the ink at 60 percent (3.4:1 against the land), so its edge reads where its colour does not; a dot takes the same edge, inside its disc, only where its fill
    // is under 1.5:1 (the share ramp's two palest steps), since on a dot of 2 or 3 px a rim outweighs the colour of the mid classes. The colours stay as they are, the grey of
    // cells with too few firms keeps none (it is meant to recede), and the dark theme has none.
    t.edge = dark ? null : (() => { const Lland = relLum(t.land), memo = new Map(), ratio = col => { let v = memo.get(col); if (v === undefined) { const l = relLum(col); v = (Math.max(l, Lland) + 0.05) / (Math.min(l, Lland) + 0.05); memo.set(col, v); } return v; };
      return { colour: t.ink, alpha: 0.6, low: col => !!col && col !== t.below && ratio(col) < 3, faint: col => !!col && col !== t.below && ratio(col) < 1.5 }; })();
    MM.tileEdge = t.edge;   // the cells' tiles read it in MM.drawTiles; the video never sets it
    t.div6 = t.change6;   // the revenue classes of the Firms view and the Cells view's fin layer share the Change layer's pair (round 10; the blue six of rounds 3 to 9 stay in the manifests' class_colours)
    return Object.assign(t, MM.coreRamp(t));   // the bloom's pale-core tables (round 9)
  }
  function relLum(h) { const f = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(parseInt(h.slice(1, 3), 16)) + 0.7152 * f(parseInt(h.slice(3, 5), 16)) + 0.0722 * f(parseInt(h.slice(5, 7), 16)); }   // WCAG relative luminance of #RRGGBB
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
  // MICRO_LAYERS, the layers the squares draw, is read from the layers' facts (LAYER_FACTS, below the layer list; round 18).
  const microYear = () => { const L = layerOf(state.layer); return L && L.micro && L.year != null ? L.year : state.year; };   // the squares' year: a layer's fixed year from its facts, else the slider's (round 18)
  const microReady = y => !!(FIRMS_OK && firmYears.has(y) && mosaicCache.has(y + '|1'));
  const microA = (k, y) => (MICRO_LAYERS.has(state.layer) && microReady(y) ? Motion.step(k, 1.5, 1.0, Motion.ease.linear) : 0);
  const fineA = k => ((state.layer === 'density' || (state.layer === 'share' && state.year === 2021)) ? Motion.step(k, 24, 16, Motion.ease.linear) : 0);
  function ensureMicro(y) { if (!FIRMS_OK || firmYears.has(y)) return; ensureYear(y).catch(e => console.error(e)); }   // the address file loads once the camera nears k 1.5; prebuildBins draws the squares when they are ready
  // The year the red count in the Cells view's tile reads (the author's decision of 25 October 2026): each layer's own year, as its facts give it (LAYER_FACTS,
  // round 18), and the slider's year on the layers that follow it; the strip keeps the slider's year.
  const layerYear = () => { const L = layerOf(state.layer); return L && L.year != null ? L.year : state.year; };   // the layer's own year from its facts (round 18)
  function listedInCell(h) {   // the firms on the five lists present in that year at coordinates inside the hovered cell's square, exact, 0 included
    if (!TRN || h.kmx == null || h.grp) return null; const g = h.grid || 100, o = h.origin || [0, 0], x0 = o[0] + Math.floor((h.kmx - o[0]) / g) * g, y0 = o[1] + Math.floor((h.kmy - o[1]) / g) * g, yi = layerYear() - 2014; let n = 0;
    for (let i = 0; i < TRN.n; i++) { if (TRN.filed[i][yi] === '-') continue; const x = TRN.x[i], y = TRN.y[i]; if (x >= x0 && x < x0 + g && y >= y0 && y < y0 + g) n++; }
    return n;
  }
  const tileCache = new Map();
  function tiles(key, build) { if (!tileCache.has(key)) tileCache.set(key, build()); return tileCache.get(key); }
  const classOfShare = (n, a, breaks) => { if (n < 50) return 'below'; const s = 100 * a / n; let c = 0; while (c < breaks.length && s >= breaks[c]) c++; return c; };

  // ---- state -----------------------------------------------------------------------------------
  const NAT = { cx: (BM.extents.national.x[0] + BM.extents.national.x[1]) / 2, cy: (BM.extents.national.y[0] + BM.extents.national.y[1]) / 2 };
  const state = { layer: 'share', year: 2024, cam: { cx: NAT.cx, cy: NAT.cy, k: 0.2 }, hover: null, mode: 'cells' };
  const hoverUnit = { key: null, tw: 0, th: 0, foot: '', prof: '' };   // the hovered unit's key and the tile's measured size (round 14): a pointer move inside the same unit moves the tile and writes the footer only   // the landing (round 10): the Cells view, 2024, the leading-industry layer when its data exist (set below), the national zoom
  const LAYERS = [
    { id: 'density', label: 'Firm density, 2021', prov: 'Located eligible firms at registered addresses in 2021, counted per 5 km cell nationally and per 250 m cell in 22 city windows (M3 pass over the production point layer), and closer in per 1 km square of the 2021 address file (firms on no list with a house- or street-level geocode, M9). Shares are shown only for cells with 50 or more firms.' },
    { id: 'share', label: 'Statement share by year', prov: 'Share of located eligible firms with an original statement, per 100 km cell and closer in per 25 km cell, financial years 2014 to 2025 (M5 and M10 passes over the foundation registry and payload partitions, production projection and located rule). 2012 and 2013 carry no coordinates. Closer still, 1 km squares from the address files for every year (firms on no list with a house- or street-level geocode, M9), and 250 m cells in 22 city windows for 2021.' },
    { id: 'change', label: 'Change, 2024 against 2021', prov: 'Figure 2.7 lower panel: change in the located share with a statement, 2024 against 2021, 100 km cells with 50 or more located firms in both years, in six classes at ±2 and ±5 points (presentation-finalization-20261019/data/availability-change-cells.csv). Closer in, 25 km cells under the same rule (M10 pass), which the chapter’s figure does not show.' },
    { id: 'cohort', label: 'Cohort inclusion', prov: 'Figure 2.8: share of a cell’s located eligible firms (2021) in the revenue cohort by cash share, pooled quintile classes of supported cells (candidate-02-cell-source.csv, cutpoints 33.3, 38.3, 43.0 and 47.6%).' },
    { id: 'lists', label: 'List members, 2021', prov: 'Located members of the sanctions list and of the government strategic list per 100 km cell in 2021 (geography-review-20261006 cells), and per 25 km cell closer in (M10 pass). Cells with fewer than 5 members of a list show no count. The lists are fixed memberships, not dated designations. Treated: a firm on at least one of the five lists (sanctions, decree, 2020 filing-exemption, government strategic, presidential strategic). The word names the study’s group, not an effect.' },
    { id: 'fin', label: 'Median revenue change (descriptive)', prov: 'Percent change of each cell’s median real revenue among the revenue-by-cash cohort firms observed in 2024, against the cell’s 2021 median, in cells with 50 or more observed firms (pass2-reconcile geo-revenue-change-from-2021-source.csv). Descriptive: the composition changes with observation. Not a Chapter 3 estimate.' },
  ];

  if (INDD && IND_T) state.layer = 'industry';
  if (INDD && IND_T) LAYERS.push({ id: 'industry', label: 'Leading industry by year',
    prov: 'The division (two-digit OKVED 2 code, identical to NACE Rev. 2) with the largest share of nominal revenue among located eligible firms with a statement and a positive revenue value, per 100 km and 25 km cell for 2014 to 2025 (M11 pass over the foundation registry and payload partitions), and per 1 km square of the address files for every year. Nine classes: ' + IND_T.classes.label.map((l, i) => `${l} (divisions ${IND_T.classes.divisions[i]})`).join(' · ') + '. Division names: NACE Rev. 2, Eurostat codelist NACE_R2 version 20.1, which OKVED 2 (OK 029-2014) mirrors at the two-digit level. Shares are within the year. Firms on these lists (treated) are included in the cells and their share of a cell’s revenue is given in the hover. In the Firms view the colour is the division with the largest share of revenue at the coordinate pair, over every firm registered there with a statement and a positive revenue value, firms on the five lists (treated) included. A coordinate pair without a firm with a revenue value is neutral.' });

  // The two layers' reading texts in standard terms (round 16); the method block shows them in place of a provenance line.
  const SHARED_REG = 'Registered legal addresses can be shared business centres or addresses rented for registration and correspondence, rather than production premises. Several firms can therefore share one registered address. The Federal Tax Service tracks mass-registration addresses.';
  LAYERS.push({ id: 'shared', label: 'Pairs shared by 100+', prov: '', read: () => [
    ['What it shows', 'The share of a cell’s firms registered at coordinate pairs shared by 100 or more firms, by financial year, among located eligible firms on no list with a house- or street-level geocode, the population of the Firms view. Firms with other geocodes are left out, since a shared city-centre coordinate is not a shared registration.'],
    ['How to read it', 'A darker cyan means more of the cell’s firms are at such pairs. The tile and Under the cursor give the share with a statement at those pairs and elsewhere in the cell, each with its count of firms, and the card charts both by year.'],
    ['Support', 'A share needs 50 firms, otherwise grey: 100 km cells at the country, 25 km cells closer in, and 1 km squares inside the 22 city windows.'],
    ['Shared registrations', SHARED_REG],
    ['Source', 'Computed in the atlas from the address files. The chapter does not report this comparison. It is descriptive.']] });
  const GL_READ = () => [
    ['What it shows', 'The change in the share of eligible state-related firms with a statement, 2024 against 2021, by region, as the chapter classifies the registry’s ownership codes. Each year compares that year’s state-related firms, not the same firms.'],
    ['How to read it', 'Amber regions lost availability among state-related firms and cyan regions gained it, in classes of 10 percentage points. The tile and Under the cursor give both years’ shares with their counts of firms.'],
    ['Support', 'A region is classed only where 50 or more state-related firms are registered in both years, otherwise grey. Firms are counted in the region where they are registered, located or not.'],
    ['The question', `Availability falls among state-related firms (${fmt.pct(F.own.state[0])} to ${fmt.pct(F.own.state[1])}) from 2021 to 2024, among the chapter’s clearest findings on the sanctions period. The state-run firms are about half of the state-related firms and carry the whole decline (${fmt.pct(D.statesplit.state_unitary.share[0])} to ${fmt.pct(D.statesplit.state_unitary.share[1])}). The other state-related firms rise (${fmt.pct(D.statesplit.state_other.share[0])} to ${fmt.pct(D.statesplit.state_other.share[1])}). The map shows where in the country the declines sit. The ownership codes do not establish operational control or disclosure protection.`]];
  LAYERS.push({ id: 'gs', label: 'Change: state-related', prov: '', read: GL_READ });
  // Each layer's facts in one place (round 18): its group on the LAYER card, the year it shows (a fixed year, or null where it follows the slider and the year row
  // shows), whether the Cells view's red button pulses on it, whether the 1 km squares draw it, and whether the national chart marks the slider's year. The
  // functions that tested layer ids for these read them here, and window.__atlas.layerFacts() gives them to the audit, so a new layer is one entry here beside
  // its branches in drawMap, drawLegend, cellAt, tipBody and drawCellPanel. A layer with no entry has no group and follows the slider.
  const LAYER_FACTS = {
    density: { group: 'Counts', year: 2021, micro: true },
    share: { group: 'Statements', pulse: true, micro: true, mark: true },
    change: { group: 'Statements', year: 2024 },
    cohort: { group: 'Revenue', year: 2021 },
    lists: { group: 'Counts', year: 2021 },
    fin: { group: 'Revenue', year: 2024 },
    industry: { group: 'Revenue', pulse: true, micro: true, mark: true },
    shared: { group: 'Counts' },
    gs: { group: 'Statements', year: 2024 } };
  const GROUP_ORDER = ['Counts', 'Statements', 'Revenue'];
  for (const L of LAYERS) Object.assign(L, { group: null, year: null, pulse: false, micro: false, mark: false }, LAYER_FACTS[L.id] || {});
  const layerOf = id => LAYERS.find(L => L.id === id);
  const MICRO_LAYERS = new Set(LAYERS.filter(L => L.micro).map(L => L.id));

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
  const cityTarget = city => ({ cx: city.x, cy: city.y, k: minSide() / 95 });          // the city window: 95 km across the shorter side (the click's city step)
  const goToTarget = city => ({ cx: city.x, cy: city.y, k: minSide() / 45 });          // a city from GO TO: 45 km across the shorter side (round 15, the author's general point 3: the author's Kazan view spans 44.6 km)
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
  const layersKey = c => [state.mode, state.layer, state.year, markShared ? 1 : 0, theme.dark ? 1 : 0, c.cx, c.cy, c.k, stage.width, stage.height, stage.scale, firmYears.has(state.year) ? 1 : 0, microReady(microYear()) ? 1 : 0, mosaicOff ? 1 : 0, useGL() ? 1 : 0].join('|');
  const layersDirty = () => { lastFieldKey = ''; lastMarksKey = ''; };
  function drawMap(opts) {
    drawLog = [];
    const flight = !!(opts && opts.flight), motion = !!(opts && opts.motion);   // a flight frame skips the two DOM touches: the audit box and the legend; a wheel step (motion) leaves the strip to the settle
    Motion.audit.scene = 'map'; if (!flight) window.__atlasCanvases.map = { w: stage.width, h: stage.height }; if (!flight && !motion) queueMicrotask(updateContext);   // the strip follows every settled draw, never a flight frame or a wheel step   // the canvases' own size (the content box), for the audit
    const c = cam(); stage.base();
    mctx.fillStyle = theme.stage; mctx.fillRect(0, 0, stage.width, stage.height);
    MM.drawBasemap(mctx, stage, c, bmp, theme, { borderPx: c.k > 9 ? 1.2 : 0.8, lod0Colour: theme.ghost, lod0Alpha: ghostAlpha(c.k), lod0Px: 1, afterLand: () => { if (state.mode !== 'firms' && grpLayer()) drawGroupFills(c); } }); drawLog.push('basemap');   // the regional borders as ghost-tone hairlines at the national zoom, gone by k 3 (round 10, G13b)
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
    } else if (L === 'shared') { drawLog.push('shared'); drawShared(c, flight, motion);
    } else if (grpLayer()) { drawLog.push('groups');   // the fills are drawn under the borders (afterLand)
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
  // Data loaded on first use come as script twins injected on demand. A year's addresses come as the gzipped file itself
  // (data/firms/firms-YYYY.bin.gz), fetched and inflated here: the author's pick C of 29 October 2026, since the atlas left the
  // artifact host, which served only listed file types (until then the bytes travelled as base64 in a script twin).
  const loadScript = src => new Promise((ok, fail) => { const el = document.createElement('script'); el.src = src; el.onload = () => { el.remove(); ok(); }; el.onerror = () => { el.remove(); fail(new Error('could not load ' + src)); }; document.head.appendChild(el); });   // round 17: the element goes once it has run (a revisited year loads again under the three-year cache, and each load had left its element and two handlers in the head)
  const twinNotes = {};   // the comment field of each address file's gzip header (round 10, the authorship mark; the bytes inside are unchanged)
  function gzipComment(u8) { const flg = u8[3]; let p = 10; if (flg & 4) p += 2 + (u8[p] | (u8[p + 1] << 8)); if (flg & 8) { while (u8[p]) p++; p++; } if (!(flg & 16)) return ''; let s = ''; while (u8[p]) s += String.fromCharCode(u8[p++]); return s; }
  async function loadYear(y) {
    const res = await fetch('data/' + FM.files[y]); if (!res.ok) throw new Error('could not load data/' + FM.files[y] + ' (' + res.status + ')');
    let buf = await res.arrayBuffer();   // a server that inflates the file on the way hands over the raw bytes, which the header check below lets through
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
  // Ghost names (round 10, the author's item 13a): the 22 preset cities in large tracked capitals one step above the land, under every data layer, at most
  // twenty-two text calls per frame. ghostAlpha (1 below k 1, 0 at k 3, linear in log k) fades the basemap's regional hairlines.
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
  const ghostAlpha = k => Motion.clamp(1 - Math.log2(Math.max(k, 1e-9)) / Math.log2(3), 0, 1);
  let ghostDrawn = 0, markBox = null; const GHOST_ALPHA = 0.30;   // the ghost names' opacity: plainly there when looked for, back in the ground when not (round 12, final)
  // On the ground (round 16, the author's item 8, picked as 8Gb on 27 October 2026; round 12's floating names until then): the layout is fixed once at the fit
  // and every name grows exactly with the land, s = k / kFit, its size, tracking and offset alike, so it keeps its place and the names never meet as the camera
  // zooms. A name fades by its width against the map's (full until a third, gone at three widths), so none lies over the dots at city zoom; beyond three times
  // its size it is drawn from a bitmap made once. Below the fit the names shrink with the land. Only 17 of the 22 names fit at the fit at 1,600 px, and a
  // collision at the fit is a collision at every zoom, so a hidden name enters at the first zoom where it fits, once the names that blocked it have left the
  // view or faded. In the tile's ice at 30 percent, drawn as light on the dark theme (8C) and plainly on the light theme, never over the authorship mark.
  // Drawn above the cells, the dots and the listed marks and below the Cells view's pulse dots, the hover ring, the tile and the panels: on the map canvas
  // after the cells layers, on the marks canvas after the marks in the Firms view; 22 text calls at most, no new canvas.
  const cloudBitmaps = new Map();   // label -> the name drawn once at twice its resting size, per colour
  function cloudBitmap(txt, size, colour) {
    const key = txt + '|' + size + '|' + colour; if (cloudBitmaps.has(key)) return cloudBitmaps.get(key);
    const z = 2 * (window.devicePixelRatio || 1), fs = size * z, cv = document.createElement('canvas'), c2 = cv.getContext('2d'); c2.font = Motion.font(fs, 500); if ('letterSpacing' in c2) c2.letterSpacing = (fs * 0.12) + 'px';
    const m = c2.measureText(txt), w = Math.ceil(m.width) + 4, h = Math.ceil(fs * 1.1) + 4; cv.width = w; cv.height = h;
    c2.font = Motion.font(fs, 500); if ('letterSpacing' in c2) c2.letterSpacing = (fs * 0.12) + 'px'; c2.fillStyle = colour; c2.textBaseline = 'alphabetic'; c2.fillText(txt, 2, 2 + Math.round(fs * Motion.CAP));
    const b = { cv, w: w / z, h: h / z, capTop: 2 / z }; cloudBitmaps.set(key, b); return b;
  }
  const GHOST_FULL_W = 560, ghostScale = () => Math.min(1, stage.width / GHOST_FULL_W);   // round 29 (the author's report of 30 October 2026): a map narrower than 560 px (a phone; the narrowest desktop map, at a 1,024 px window, is 578) scales the names with its width, so on a phone they keep their share of the map and their opacity; at 560 px and wider nothing changes
  let groundCache = null;   // the layout at the fit: { kf, placed: [{ city, size, dx, dy, w, h }], hidden: [...] } in screen px at kFit, offsets from the city
  function groundLayout(kf) {
    const m = ghostScale(); if (groundCache && Math.abs(groundCache.kf - kf) < 1e-9 && groundCache.m === m) return groundCache;
    const placed = [], hidden = [], gutter = 2, meets = (a, b) => a.x < b.x + b.w + gutter && a.x + a.w + gutter > b.x && a.y < b.y + b.h + gutter && a.y + a.h + gutter > b.y;
    const at = (px, py, w, h, where) => where === 'above' ? { x: px - w / 2, y: py - 10 - h, w, h } : where === 'below' ? { x: px - w / 2, y: py + 10, w, h } : where === 'right' ? { x: px + 10, y: py - h / 2, w, h } : { x: px - 10 - w, y: py - h / 2, w, h };
    for (const g of ghostRank()) {
      const px = g.city.x * kf, py = -g.city.y * kf; let done = null;
      for (let size = Math.round(g.size * m); size >= GHOST_MIN * m && !done; size -= 2) {
        const w = Motion.measure(mctx, g.city.label.toUpperCase(), size, 500, size * 0.12), h = Math.round(size * Motion.CAP);
        for (const where of ['above', 'below', 'right', 'left']) { const bx = at(px, py, w, h, where); if (!placed.some(o => meets(bx, { x: o.px + o.dx, y: o.py + o.dy, w: o.w, h: o.h }))) { done = { city: g.city, size, dx: bx.x - px, dy: bx.y - py, w, h, px, py }; break; } }
      }
      if (done) placed.push(done);
      else { const sz = Math.round(g.size * m), w = Motion.measure(mctx, g.city.label.toUpperCase(), sz, 500, sz * 0.12), h = Math.round(sz * Motion.CAP), bx = at(px, py, w, h, 'above'); hidden.push({ city: g.city, size: sz, dx: bx.x - px, dy: bx.y - py, w, h, px, py }); }
    }
    groundCache = { kf, m, placed, hidden }; return groundCache;
  }
  const groundFade = r => GHOST_ALPHA * (r <= 1 / 3 ? 1 : Math.pow(1 / (3 * r), 2)) * Motion.clamp(3 - r, 0, 1);   // the fade by the name's width against the map's (round 15's)
  function drawGroundName(ctx, g, s, x, y, a, ink) {   // one name on the ground at scale s: text up to three times its size, a scaled bitmap beyond
    const txt = g.city.label.toUpperCase(), w = g.w * s, h = g.h * s;
    if (s <= 3) Motion.text(ctx, txt, x, y + h, { size: g.size * s, weight: 500, color: ink, alpha: a, letterSpacing: g.size * s * 0.12, kind: 'cloud', group: 'ghost-' + g.city.label });
    else { const b = cloudBitmap(txt, g.size, ink); ctx.save(); ctx.globalAlpha *= a; ctx.drawImage(b.cv, x - b.capTop * s, y - b.capTop * s, b.w * s, b.h * s); ctx.font = Motion.font(g.size * s, 500); if ('letterSpacing' in ctx) ctx.letterSpacing = (g.size * s * 0.12) + 'px'; Motion.recordText(ctx, txt, x, y + h, g.size * s, 500, 'ghost-' + g.city.label, 'cloud'); ctx.restore(); }
  }
  function drawGhostNames(ctx, c, scene) {
    ghostDrawn = 0; Motion.audit.scene = scene;
    const kf = kFit(), W = stage.width, H = stage.height, s = c.k / kf, L = groundLayout(kf), shown = [], ink = theme.tileInk;
    ctx.save();
    if (theme.dark) ctx.globalCompositeOperation = 'lighter';
    if (markBox && s > 1.001) { ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.rect(markBox.x, markBox.y, markBox.x1 - markBox.x, markBox.y1 - markBox.y); ctx.clip('evenodd'); }   // the names pass around the authorship mark
    const place = g => { const [px, py] = Motion.project(c, g.city.x, g.city.y); return { g, x: px + g.dx * s, y: py + g.dy * s, w: g.w * s, h: g.h * s }; };
    const inView = b => !(b.x + b.w < 0 || b.x > W || b.y + b.h < 0 || b.y > H);
    for (const g of L.placed) { const b = place(g), a = groundFade(b.w / W); if (a < 0.004 || !inView(b)) continue; drawGroundName(ctx, g, s, b.x, b.y, a, ink); shown.push(b); ghostDrawn++; }
    for (const g of L.hidden) {   // a hidden name enters where no shown name meets it
      const b = place(g), a = groundFade(b.w / W); if (a < 0.004 || !inView(b)) continue;
      if (shown.some(o => b.x < o.x + o.w + 2 * s && b.x + b.w + 2 * s > o.x && b.y < o.y + o.h + 2 * s && b.y + b.h + 2 * s > o.y)) continue;
      drawGroundName(ctx, g, s, b.x, b.y, a, ink); shown.push(b); ghostDrawn++;
    }
    ctx.restore(); Motion.audit.scene = 'map';
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
uniform vec2 u_shift; uniform vec2 u_off; uniform float u_kk; uniform vec2 u_size; uniform float u_sc; uniform vec4 u_rule; uniform float u_which; uniform vec3 u_pal[16]; uniform float u_edge[16]; uniform float u_w;
varying vec4 v_col; varying float v_r; varying float v_half; varying float v_square; varying float v_rimw;
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
  v_rimw = (u_edge[int(cls + 0.5)] > 0.5 && r >= 2.0) ? min(1.0, 0.35 * r) * u_sc : 0.0;   // the light theme's edge, inside the disc, from 2 px radius
}`;
  const GL_FS = `
precision mediump float;
varying vec4 v_col; varying float v_r; varying float v_half; varying float v_square; varying float v_rimw;
uniform vec4 u_rim;
void main() {
  vec2 d = (gl_PointCoord - 0.5) * (v_half * 2.0);
  float e = v_square > 0.5 ? v_r - max(abs(d.x), abs(d.y)) : v_r - length(d);
  float cov = clamp(e + 0.5, 0.0, 1.0);
  vec4 c = v_col;
  if (v_rimw > 0.0) { float t = clamp(e - v_rimw + 0.5, 0.0, 1.0); c.rgb = mix(u_rim.rgb * c.a, c.rgb, mix(1.0 - u_rim.a, 1.0, t)); }
  gl_FragColor = c * cov;
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
    for (const u of ['u_shift', 'u_off', 'u_kk', 'u_size', 'u_sc', 'u_rule', 'u_which', 'u_pal', 'u_edge', 'u_rim', 'u_w']) glLoc[u] = g.getUniformLocation(p, u);
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
  const glPal = L => (L === 'share' ? theme.ramp6 : L === 'fin' ? [theme.zero].concat(theme.div6) : L === 'industry' ? [theme.neutral].concat(theme.ind9) : [theme.neutral]);
  function glEdges(L) { const pal = glPal(L), out = new Float32Array(16); for (let i = 0; i < 16; i++) out[i] = theme.edge && theme.edge.faint(pal[Math.min(i, pal.length - 1)]) ? 1 : 0; return out; }   // the light theme's edge on the faintest dots, per palette entry
  function glPalette(L) { const pal = glPal(L); const out = new Float32Array(48); for (let i = 0; i < 16; i++) { const c = hex2rgb(pal[Math.min(i, pal.length - 1)]); out[3 * i] = c[0] / 255; out[3 * i + 1] = c[1] / 255; out[3 * i + 2] = c[2] / 255; } return out; }
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
    gl.uniform1f(glLoc.u_which, L === 'share' ? 0 : L === 'fin' ? 1 : L === 'industry' ? 2 : 3); gl.uniform3fv(glLoc.u_pal, glPalette(L)); gl.uniform1fv(glLoc.u_edge, glEdges(L)); { const rc = hex2rgb(theme.edge ? theme.edge.colour : '#000000'); gl.uniform4f(glLoc.u_rim, rc[0] / 255, rc[1] / 255, rc[2] / 255, theme.edge ? theme.edge.alpha : 0); } gl.uniform1f(glLoc.u_w, w);
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
    for (let j = 0; j < idx.length; j++) { const i = idx[j]; const r = markRadius(rule, d.nn[i]), [px, py] = Motion.project(c, d.x[i] / 1000, d.y[i] / 1000); ctx2.fillStyle = firmColour(L, firmClass(d, i, L)); ctx2.beginPath(); if (r < 1.75) ctx2.rect(px - r, py - r, 2 * r, 2 * r); else ctx2.arc(px, py, r, 0, Math.PI * 2); ctx2.fill();
      if (theme.edge && r >= 2 && theme.edge.faint(ctx2.fillStyle.toUpperCase())) { const rw = Math.min(1, 0.35 * r); ctx2.save(); ctx2.globalAlpha = 0.9 * w * theme.edge.alpha; ctx2.strokeStyle = theme.edge.colour; ctx2.lineWidth = rw; ctx2.beginPath(); ctx2.arc(px, py, r - rw / 2, 0, Math.PI * 2); ctx2.stroke(); ctx2.restore(); } }   // the light theme's edge, as on the GPU
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
  // quietest at the national view, as drawn before at the street zoom. On a forward year change the firms newly red pulse
  // once (round 24, the author's pick E of 29 October 2026): a sweep crosses the view west to east by longitude in 1.5 s, each
  // firm swells (MM.swellPeak) as it passes. The minimum spanning tree that traced behind the sweep (round 24) was removed on the
  // author's request of 30 October 2026 (round 30). Backward changes show nothing, and the Cells view keeps its dot. The pulse
  // button beside the year slider replays the pulse for the firms added to a list in the shown year; under prefers-reduced-motion
  // a pulse is a still highlight (the swell held at 0.6) for the same 2.4 s.
  const PASS_MS = 1500, PULSE_MS = PASS_MS + 900, BLOOM_MS = 1800, DECAY_MS = 1600;   // the last firm passed at 1.5 s swells for 0.9 s; BLOOM_MS: the Cells view's dot and the found firm's ring keep 1.8 s
  let pulse = null, pulseRaf = 0, pulseTimer = 0;
  const pulseDelay = new Float32Array(TRN.n);   // each firm's start delay in the running pulse (ms), filled once per pulse: the west-to-east sweep
  // The sweep goes by longitude. The km plane is spherical LAEA about 60 N, 100 E (map-layers.js), so a firm's longitude is the inverse projection, computed once.
  let LON = null;
  const lonOf = () => {
    if (!LON) { LON = new Float32Array(TRN.n); const R = 6371, sp = Math.sin(Math.PI / 3), cp = Math.cos(Math.PI / 3);
      for (let i = 0; i < TRN.n; i++) { const x = TRN.x[i], y = TRN.y[i], rho = Math.hypot(x, y), cc = 2 * Math.asin(Math.min(1, rho / (2 * R))); LON[i] = rho < 1e-9 ? 100 : 100 + Math.atan2(x * Math.sin(cc), rho * cp * Math.cos(cc) - y * sp * Math.sin(cc)) * 180 / Math.PI; } }
    return LON;
  };
  function makePulse(mask) {   // delays 0 to PASS_MS by longitude, from the westernmost to the easternmost pulsing mark inside the view and its margin
    const c = cam(), k = c.k, ox = c.ox - c.cx * k, oy = c.oy + c.cy * k, W = stage.width + MARK_MARGIN, H = stage.height + MARK_MARGIN, yi = state.year - 2014, L = lonOf();
    let l0 = Infinity, l1 = -Infinity;
    for (let i = 0; i < TRN.n; i++) { if (!mask[i] || TRN.filed[i][yi] === '-') continue; const px = ox + TRN.x[i] * k, py = oy - TRN.y[i] * k; if (px < -MARK_MARGIN || px > W || py < -MARK_MARGIN || py > H) continue; if (L[i] < l0) l0 = L[i]; if (L[i] > l1) l1 = L[i]; }
    const span = l1 > l0 ? l1 - l0 : 0;
    for (let i = 0; i < TRN.n; i++) pulseDelay[i] = mask[i] && span ? PASS_MS * Motion.clamp((L[i] - l0) / span, 0, 1) : 0;
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
    if (any) beginPulse(yNew - yPrev === 1 && yNew > 2014 ? manualMask(yNew).mask : mask, any);   // a one-year step is the year's own set (undated firms date from 2014): its cached mask
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
    const label = !count ? `No firm was added to these lists in ${y}` : state.mode === 'firms' ? `Replay sweep of firms added to a list in ${y}` : `Pulse the cells holding a firm added to a list in ${y}`; b.title = label; b.setAttribute('aria-label', label);
    // 4B (round 15, the author's item 4): the label says what the pulse shows, the year and the number of firms listed in it (the pulse's own mask: dated listings, firms present that year)
    const pl = $('pulselabel'); if (pl) { const on = show; pl.hidden = !on; if (on) pl.innerHTML = `<b class="num">${fmt.int(count)}</b> ${count === 1 ? 'firm' : 'firms'} added to a list in ${y}`; pl.classList.toggle('zero', on && !count); }   // at zero the counter and its sentence dim with the disabled button (the author liked it, 27 October 2026)
    syncYearLine2();
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
  function drawCellsMarks(c) {   // the Cells view's marks canvas: the ghost names and the city labels above the squares, the pulse dots between them
    clearMarks(); kctx.setTransform(stage.scale, 0, 0, stage.scale, 0, 0);
    drawGhostNames(kctx, c, 'marks'); drawLog.push('ghost');
    if (cellPulse) cellPulseDots(c);
    if (found) foundRings(kctx, c);
    drawLabels(kctx, c, 'marks');
  }
  // The Cells view's pulse (round 14): the button pulses every cell at the shown level that holds a firm listed in the shown year (dated and present that year;
  // undated firms never pulse), a red dot at the cell's centre swelling and gone in 0.9 s (round 22; the Firms view's ring before), with the west-to-east
  // stagger over the cells in view; under reduced motion the dot held for the same 1.8 s. The automatic pulse on a forward year change stays in the Firms view.
  const CELL_PULSE_LAYERS = new Set(LAYERS.filter(L => L.pulse).map(L => L.id));   // from the layers' facts (round 18)
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
    if (cellPulse.static) cellPulseTimer = setTimeout(() => { cellPulseTimer = 0; cellPulse = null; setLive(false); if (state.mode !== 'firms') drawCellsMarks(cam()); }, BLOOM_MS);
    else cellPulseRaf = requestAnimationFrame(cellPulseTick);
    drawCellsMarks(c); return cells.length;
  }
  function cellPulseTick() { cellPulseRaf = 0; if (!cellPulse) return; if (performance.now() - cellPulse.t0 >= BLOOM_MS) { cellPulse = null; setLive(false); } if (state.mode !== 'firms') drawCellsMarks(cam()); if (cellPulse) cellPulseRaf = requestAnimationFrame(cellPulseTick); }
  function cellPulseDots(c) {
    const P = cellPulse, k = c.k, LR = MM.listedRule(markRule(k), k, kFit()), r = MM.listedRadius(LR, 1), t = P.at != null ? P.at : performance.now() - P.t0, ox = c.ox - c.cx * k, oy = c.oy + c.cy * k;
    for (const q of P.cells) {
      const px = ox + q.x * k, py = oy - q.y * k; if (px < -MARK_MARGIN || px > stage.width + MARK_MARGIN || py < -MARK_MARGIN || py > stage.height + MARK_MARGIN) continue;
      if (P.static) { MM.swellDot(kctx, px, py, r, 1, theme, true); continue; }
      MM.swellPhase((t - q.delay) / 1000, PH); if (PH.on && PH.p > 0 && PH.p < 1) MM.swellDot(kctx, px, py, r, PH.p, theme, false);
    }
  }
  const MARK_MARGIN = 80;   // CSS px beyond the view inside which marks are drawn: the street zoom's flash and ring reach 72.6 px (round 9)
  const PH = { on: false, swell: 0, release: 0, grow: 0, glowA: 0, p: 0 };   // the bloom phase of the mark being drawn, reused (no allocation per frame)
  // The listed marks and the pulse: each pulsing firm runs its own clock, started by its stagger delay, and its red mark swells and settles back
  // (MM.swellPhase, round 22, the author's pick A of 29 October 2026); rounds 9 to 21 added a glow pass under the marks and a ring pass above the names.
  function drawMarks(c) {
    clearMarks(); kctx.setTransform(stage.scale, 0, 0, stage.scale, 0, 0);
    const year = state.year, yi = year - 2014, k = c.k, LR = MM.listedRule(markRule(k), k, kFit()), L = state.layer, now = performance.now();
    const st = !!(pulse && pulse.static), tNow = pulse ? (pulse.at != null ? pulse.at : now - pulse.t0) : 0;
    const ox = c.ox - c.cx * k, oy = c.oy + c.cy * k, W = stage.width + MARK_MARGIN, H = stage.height + MARK_MARGIN;
    if (markShared) sharedRings(c);   // round 16: the shared pairs, under the listed marks
    for (let i = 0; i < TRN.n; i++) {
      const ch = TRN.filed[i][yi]; if (ch === '-') continue;
      const pulsing = !!(pulse && pulse.mask[i]);
      const px = ox + TRN.x[i] * k, py = oy - TRN.y[i] * k; if (px < -MARK_MARGIN || px > W || py < -MARK_MARGIN || py > H) continue;
      const r = MM.listedRadius(LR, TRN.pile[i]);
      if (pulsing) { if (st) { PH.on = true; PH.swell = 0.6; PH.release = 1; PH.grow = 1; PH.glowA = 0; PH.p = 1; } else MM.swellPhase((tNow - pulseDelay[i]) / 1000, PH); }   // still: held at 0.6 of the swell
      const fade = pulsing && PH.on ? 1 - PH.grow : 1;   // the ordinary fill and rim fade as the bloom grows; a firm whose stagger has not started is still rimmed
      if (TRN.red_from[i] > year || (pulsing && fade > 0.001)) {
        const sc = TRN.state[i][yi], col = L === 'fin' && sc >= '1' && sc <= '6' ? theme.div6[+sc - 1] : L === 'share' ? theme.ramp6[ch === '1' ? 5 : 0] : theme.neutral;
        MM.rimmedMark(kctx, px, py, r, col, 0.9 * fade, LR.rimA * fade, theme, LR.rimW);
      }
      if (TRN.red_from[i] <= year) {
        if (pulsing) {
          if (!PH.on) continue;   // before its own start the firm shows its rimmed mark only
          const rr = r + MM.swellPeak(r) * PH.swell, tt = st ? 0 : Motion.clamp((tNow - pulseDelay[i]) / DECAY_MS, 0, 1);
          MM.listedMark(kctx, px, py, rr, ch === '1' ? 1 : 0, PH.grow * (1 - (1 - LR.alpha) * tt), theme, LR.halo, null, LR);
        } else MM.listedMark(kctx, px, py, r, ch === '1' ? 1 : 0, LR.alpha, theme, LR.halo, null, LR);
      }
    }
    { const sw = sweepX(); if (sw) { kctx.save(); kctx.setTransform(stage.scale, 0, 0, stage.scale, 0, 0); const g = kctx.createLinearGradient(sw.x - sw.feather, 0, sw.x, 0); g.addColorStop(0, '#000'); g.addColorStop(1, 'rgba(0,0,0,0)'); kctx.globalCompositeOperation = 'destination-in'; kctx.fillStyle = g; kctx.fillRect(0, 0, stage.width, stage.height); kctx.restore(); } }   // the opening sweep: the listed marks fade in with the field (round 14); the names and labels below are drawn whole
    drawGhostNames(kctx, c, 'marks'); drawLog.push('ghost');   // the floating names above the field and the marks (round 12, part D)
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
  // The nearest mark within reach (round 15, the author's item 9): at the dots zoom a cursor that misses every mark takes the nearest address or listed mark whose
  // edge lies within 16 px (a listed mark counted 4 px nearer), and keeps the mark it holds until another is 3 px nearer, so a firm is held without aiming to the
  // pixel; a cursor on a mark behaves as before. The hit is then read at the mark's own centre, so the tile, the panel and the ring describe that mark.
  const SNAP_PX = 16, SNAP_HYST = 3, SNAP_LISTED = 4; let snapHeld = null;
  function nearestMark(km) {
    const c = cam(), k = c.k, rule = markRule(k), LR = MM.listedRule(rule, k, kFit()), yi = state.year - 2014, d = firmYears.get(state.year); let best = null;
    const consider = (kx, ky, r, listed) => { const [px, py] = Motion.project(c, kx, ky), edge = Math.hypot(px - km.px, py - km.py) - r - (listed ? SNAP_LISTED : 0); if (edge <= SNAP_PX && (!best || edge < best.edge)) best = { x: kx, y: ky, px, py, edge }; };
    if (d) { const Rm = (markRadius(rule, 65535) + SNAP_PX) / k * 1000, xm = km.x * 1000, ym = km.y * 1000, i0 = lowerBound(d.x, xm - Rm), i1 = lowerBound(d.x, xm + Rm);
      for (let i = i0; i < i1; i++) { const dy = d.y[i] - ym; if (dy > Rm || dy < -Rm) continue; consider(d.x[i] / 1000, d.y[i] / 1000, markRadius(rule, d.nn[i]), false); } }
    if (TRN) for (let i = 0; i < TRN.n; i++) { if (TRN.filed[i][yi] === '-') continue; const dx = (TRN.x[i] - km.x) * k, dy = (TRN.y[i] - km.y) * k; if (dx > 60 || dx < -60 || dy > 60 || dy < -60) continue; consider(TRN.x[i], TRN.y[i], MM.listedRadius(LR, TRN.pile[i]), true); }
    if (best && snapHeld) { const [hx, hy] = Motion.project(c, snapHeld.x, snapHeld.y), held = Math.hypot(hx - km.px, hy - km.py) - snapHeld.r; if (held <= SNAP_PX + SNAP_HYST && best.edge > held - SNAP_HYST) return { x: snapHeld.x, y: snapHeld.y, px: hx, py: hy, edge: held }; }
    return best;
  }
  function firmAtSnapped(km) {
    const out = firmAt(km);
    if (out.kind === 'firm' || out.kind === 'listed') { const m = kmFromPx(out.px, out.py); snapHeld = { x: m.x, y: m.y, r: out.r || 0 }; return out; }
    if (cam().k < dotsK()) { snapHeld = null; return out; }
    const t = nearestMark(km); if (!t) { snapHeld = null; return out; }
    const hit = firmAt({ x: t.x, y: t.y, px: t.px, py: t.py }); if (hit.kind !== 'firm' && hit.kind !== 'listed') { snapHeld = null; return out; }
    hit.snapped = true; snapHeld = { x: t.x, y: t.y, r: hit.r || 0 }; return hit;
  }
  const hitAt = km => (state.mode === 'firms' ? firmAtSnapped(km) : cellAt(km));
  const breakLabels = (breaks, m) => Array.from({ length: m }, (_, i) => i === 0 ? `< ${breaks[0]}%` : i === m - 1 ? `≥ ${breaks[i - 1]}%` : `${breaks[i - 1]}–${breaks[i]}%`);

  // The legend and the note (24 October 2026): a title row with a toggle and a body, collapsible; collapsed by default
  // on a narrow map (under 600 px) and remembered per viewer; written only when the text changes.
  // The cards' collapse toggles (the author's addition of 25 October): a toggle per card, the state remembered per viewer, a collapsed card's chart not drawn (its canvas has no size) and redrawn on opening.
  // The side column's cards in one list (round 18): each card's id, whether it has a reading block (its i and cr-ID), its chart's canvas, whether the chart pops
  // out over the map, and its redraw (the Under the cursor chart is drawn by drawCellPanel). CARDS, READS, POP_CHART, POP_DRAW and the redraws in setCard,
  // redrawAll and the reading blocks' handler come from it, and window.__atlas.cardFacts() gives it to the audit, so a new card is one entry here, its HTML in
  // explorer.html, its reading text in fillReads and its draw function.
  const CARD_LIST = [
    { id: 'layer' },
    { id: 'goto', read: true },
    { id: 'cursor', read: true, chart: 'cellchart', pop: t => drawCursorChart(pop.cursor, t) },
    { id: 'national', read: true, chart: 'natchart', pop: t => drawNational(t), redraw: () => drawNational() },
    { id: 'groups', read: true, chart: 'groupchart', pop: t => drawGroups(t), redraw: () => drawGroups() },
    { id: 'odds', read: true, chart: 'oddschart', pop: t => drawOdds(t), redraw: () => drawOdds() }];
  const CARDS = CARD_LIST.map(c => c.id), cardUI = {};
  const redrawCharts = () => { for (const c of CARD_LIST) if (c.redraw) c.redraw(); };   // the column's charts in the list's order (round 18)
  const cardOpen = id => (cardUI[id] ? cardUI[id] === 'open' : true);
  function applyCards() { for (const id of CARDS) { const sec = $('card-' + id), body = $('cb-' + id), t = $('ct-' + id), open = cardOpen(id); body.hidden = !open; sec.classList.toggle('collapsed', !open); t.setAttribute('aria-expanded', String(open)); t.setAttribute('aria-label', (open ? 'Collapse ' : 'Expand ') + $('h2-' + id).textContent.trim().toLowerCase()); } }
  function setCard(id, v) { cardUI[id] = v; applyCards(); if (v !== 'open' && pop.id === id) closePop(); if (v === 'open') { drawCellPanel(state.hover); redrawCharts(); } if (pop.id) placePopout(); }
  function readPref(key) { try { const v = localStorage.getItem(key); return v === 'open' || v === 'closed' ? v : null; } catch (e) { return null; } }
  function writePref(key, v) { try { localStorage.setItem(key, v); } catch (e) { /* no storage */ } }
  const ui = { legend: readPref('atlas-legend'), note: readPref('atlas-note'), ctx: readPref('atlas-context'), legendRead: readPref('atlas-legend-read') };   // legendRead: 'open' shows the legend's reading side (round 14)
  CARDS.forEach(id => { cardUI[id] = readPref('atlas-card-' + id); $('ct-' + id).addEventListener('click', () => { const v = cardOpen(id) ? 'closed' : 'open'; writePref('atlas-card-' + id, v); setCard(id, v); }); }); applyCards();
  const legendOpen = () => (ui.legend ? ui.legend === 'open' : stage.width >= 600);
  // The note (round 15, the author's general point 5 of 26 October 2026): without a stored choice it starts expanded, like the legend and the cards, on a map 600 px
  // wide or more, and collapsed on a narrow map; the viewer's own toggle is remembered and wins.
  const noteOpen = () => (ui.note ? ui.note === 'open' : stage.width >= 600);
  function syncNoteDefault() { if (ui.note) return; if ($('notebody').hidden === noteOpen()) applyPanels(); }
  function applyPanels() {
    dropObstacles();
    const lo = legendOpen(), no = noteOpen();
    $('legendbody').hidden = !lo; const lt = $('legendtoggle'); lt.setAttribute('aria-expanded', String(lo)); lt.setAttribute('aria-label', lo ? 'Collapse the legend' : 'Expand the legend');
    { const has = lo && lastLegend.read, on = has && ui.legendRead === 'open', b = $('legendinfo'), label = on ? 'Show the legend’s key' : 'Show how to read the legend'; $('legend').classList.toggle('reading', on); b.hidden = !has; b.setAttribute('aria-pressed', String(on)); b.setAttribute('aria-label', label); b.title = label; }   // the legend's two sides (round 14)
    $('notebody').hidden = !no; $('notelabel').hidden = false; const nt = $('notetoggle'); nt.setAttribute('aria-expanded', String(no)); nt.setAttribute('aria-label', no ? 'Collapse the note' : 'Expand the note');
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
    const open = mixOpen(), t = $('mixtoggle'); el.classList.toggle('closed', !open); $('mixbody').hidden = !open; $('mixinfo').hidden = !open;   // the i only beside an open box (round 15)
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
  function citySum(label, y) { const d = cityYear[label] && cityYear[label][y] ? cityYear[label][y].d : null; if (!d) return null; citySums[label] = citySums[label] || {}; if (!citySums[label][y]) citySums[label][y] = { n: d.sum_n, a: d.sum_a }; return citySums[label][y]; }   // the window's own totals (round 15: the sum over the cells had counted the firms of the cells whose statements are withheld, under 10 firms, and not their statements, so every window's share read 2 to 8 points low)
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
    if (state.mode === 'firms' && nat && FM && FM.by_year[y]) { const by = FM.by_year[y]; return { band, name, kind: 'firms', text: nw ? `${loc('Russia')}, ${ys}: ${num(by.firms, fmt.int(by.firms))} firms on no list (comparison group)` : `${loc('Russia')}, ${ys}: ${num(by.firms, fmt.int(by.firms))} firms on no list (comparison group) at ${num(by.addresses, fmt.int(by.addresses))} coordinate pairs, and ${num(by.listed, fmt.int(by.listed))} on the lists (treated)`, nums: N, short: `${loc('Russia')}, ${ys}: ${sp(fmt.int(by.firms))} on no list (comparison group)`, shortNums: [by.firms] }; }
    if (i == null) { const t = totals[y]; if (t) return { band, name, kind: 'share-t', text: `${loc('Russia')}, ${ys}: ${num(t.located, fmt.int(t.located))} located firms, ${num(t.share, fmt.pct(t.share))} of eligible firms with a statement`, nums: N }; return { band, name, kind: 'none', text: '', nums: N }; }
    if (L === 'industry' && REG.d1[i] !== 255) { const d = REG.d1[i]; return { band, name, kind: 'industry', text: nw ? `${loc(name)}, ${ys}: ${esc(divShort(d))} (${divPad(d)}), ${num(REG.s1[i], REG.s1[i] + '%')} of revenue` : `${loc(name)}, ${ys}: ${esc(divShort(d))} (${divPad(d)}) leads with ${num(REG.s1[i], REG.s1[i] + '%')} of revenue`, nums: N, short: `${loc(name)}, ${ys}: ${esc(divShort(d))} (${divPad(d)}), ${sp(REG.s1[i] + '%')} of revenue`, shortNums: [REG.s1[i]] }; }   // the short label with its code, never the code alone (the author's rule of 25 October 2026)
    if (L === 'lists') return { band, name, kind: 'lists', text: nw ? `${loc(name)}, ${ys}: ${num(REG.listed[i], fmt.int(REG.listed[i]))} of ${num(n, fmt.int(n))} on the lists (treated)` : `${loc(name)}, ${ys}: ${num(REG.listed[i], fmt.int(REG.listed[i]))} of ${num(n, fmt.int(n))} ${nat ? 'located firms' : 'firms registered in the region'} are on the five lists (treated)`, nums: N, short: `${loc(name)}, ${ys}: ${sp(fmt.int(REG.listed[i]))} on the lists (treated)`, shortNums: [REG.listed[i]] };
    if (L === 'change') { const i24 = regRow(name, 2024); if (i24 != null && i21 != null) { const s21 = shareOf(REG.a[i21], REG.n[i21]), s24 = shareOf(REG.a[i24], REG.n[i24]); return { band, name, kind: 'change', text: `${loc(name)}: ${num(s21, fmt.pct(s21))} with a statement in 2021, ${num(s24, fmt.pct(s24))} in 2024, ${num(s24 - s21, pts(0, s24 - s21))}`, nums: N, short: `${loc(name)}: ${sp(fmt.pct(s21))} in 2021, ${sp(fmt.pct(s24))} in 2024`, shortNums: [s21, s24] }; } }
    return Object.assign({ band, name, kind: 'share' }, shareLine(loc(name), n, a, n21, a21, what));
  }
  let hoverRegionName = null;   // the region under the cursor (round 10, G13b): the strip follows it below the city band and the overlay outlines it (its fill on the map went in round 30)
  // Round 16: the two layers' data, loaded on first use, and their drawing.
  function ensureData(id) {   // 'shared' (data/shared.js and shared-city.js) or 'groups' (data/groups.js)
    if ((id === 'shared' ? SHD : GRP) || dataPending.has(id)) return; dataPending.add(id);
    const files = id === 'shared' ? ['data/shared.js', 'data/shared-city.js'] : ['data/groups.js'];
    Promise.all(files.map(loadScript)).then(() => { if (id === 'shared') decodeShared(); else decodeGroups(); dataPending.delete(id); layersDirty(); drawMap(); drawCellPanel(state.hover); refreshHover(); }, () => { dataPending.delete(id); });
  }
  function decodeShared() {
    const S1 = D.shared, SC = D['shared-city'];
    const dec = (r, origin) => { const d = { count: r.count, ix: MM.b64Int16(r.ix), iy: MM.b64Int16(r.iy), n: MM.b64Int32(r.n), a: MM.b64Int32(r.a), n100: new Int32Array(r.count), a100: new Int32Array(r.count), p100: new Int32Array(r.count), map: new Map(), origin };
      if (r.shared) { const k = MM.b64Int32(r.k), n1 = MM.b64Int32(r.n100), a1 = MM.b64Int32(r.a100), p1 = MM.b64Int32(r.p100); for (let j = 0; j < k.length; j++) { d.n100[k[j]] = n1[j]; d.a100[k[j]] = a1[j]; d.p100[k[j]] = p1[j]; } }
      for (let i = 0; i < d.count; i++) d.map.set(cellKey(d.ix[i], d.iy[i]), i); return d; };
    const out = { years: S1.years, nat: S1.national, c100: {}, c25: {}, win: {} };
    for (const [y, r] of Object.entries(S1.cells100)) out.c100[+y] = dec(r);
    for (const [y, r] of Object.entries(S1.cells25)) out.c25[+y] = dec(r);
    if (SC) for (const [y, ws] of Object.entries(SC.city_1km)) { out.win[+y] = {}; for (const [label, r] of Object.entries(ws)) if (DEN.windows_1km[label]) out.win[+y][label] = dec(r, DEN.windows_1km[label].origin); }
    SHD = out;
  }
  function decodeGroups() {   // the state-related firms' rows (ownership); the file's unitary-enterprise rows are not read (the author's revision of 27 October 2026)
    const R = D.groups.regions, by = new Map(), tot = { n21: 0, a21: 0, n24: 0, a24: 0 };
    for (let i = 0; i < R.region.length; i++) { if (R.group[i] !== 'state' || R.dimension[i] !== 'ownership') continue;
      const nm = R.region[i], yy = R.year[i] === 2021 ? '21' : '24'; if (!by.has(nm)) by.set(nm, { n21: 0, a21: 0, n24: 0, a24: 0 });
      by.get(nm)['n' + yy] = R.n[i]; by.get(nm)['a' + yy] = R.a[i]; tot['n' + yy] += R.n[i]; tot['a' + yy] += R.a[i]; }
    GRP = { byRegion: by, totals: tot };
  }
  const SH_BREAKS = [2.5, 5, 10, 20], SH_LABELS = ['none', 'under 2.5%', '2.5–5%', '5–10%', '10–20%', '20% or more'];
  const sharedClass = (d, i) => { if (d.n[i] < 50) return 'below'; const s = 100 * d.n100[i] / d.n[i]; if (s === 0) return 0; let cl = 1; while (cl <= SH_BREAKS.length && s >= SH_BREAKS[cl - 1]) cl++; return cl; };
  const sharedCityA = k => (SHD ? Motion.step(k, 1.5, 1.0, Motion.ease.linear) : 0);   // the 1 km squares inside the city windows, faded in as the share layer's squares are
  const GL_BREAKS = [-20, -10, 0, 10, 20], GL_LABELS = ['≤ −20 points', '−20 to −10', '−10 to 0', '0 to +10', '+10 to +20', '> +20 points'], GRP_NAME = 'state-related firms';   // the breaks symmetric about zero, as the CHANGE layer's three amber and three cyan steps are
  const groupChange = s => (s && s.n21 >= 50 && s.n24 >= 50 ? 100 * s.a24 / s.n24 - 100 * s.a21 / s.n21 : null);
  const groupClass = s => { const ch = groupChange(s); if (ch == null) return 'below'; let cl = 0; while (cl < GL_BREAKS.length && ch > GL_BREAKS[cl]) cl++; return cl; };
  const BM_NAMES = new Set(BM.lod0.parts.map(p => p.name));   // the regions the basemap draws (regions.json also holds Russia and the firms outside the basemap's outline)
  function drawGroupFills(c) {   // each region in its class of the change among state-related firms, on the land and under the borders
    if (!GRP) { ensureData('groups'); return; }
    mctx.save(); Motion.camTransform(mctx, stage, c);
    for (const [name, v] of GRP.byRegion) { if (!BM_NAMES.has(name)) continue; const cl = groupClass(v); mctx.fillStyle = cl === 'below' ? theme.below : theme.change6[cl]; mctx.globalAlpha = cl === 'below' ? 0.5 : 1; mctx.fill(regionPath(name), 'evenodd'); }
    mctx.restore();
  }
  function drawShared(c, flight, motion) {   // 100 km cells, 25 km cells closer in, and the 1 km squares inside the city windows, the 25 km cells cut out under them
    if (!SHD) { ensureData('shared'); return; }
    const y = state.year, a25 = SHD.c25[y] ? alpha25(c.k) : 0, a1 = SHD.win[y] ? sharedCityA(c.k) : 0;
    const colour = cl => (cl === 'below' ? theme.below : theme.ramp6[cl]), alphaOf = cl => (cl === 'below' ? 0.5 : 1);
    const wins = []; if (a1 > 0) for (const [label, d] of Object.entries(SHD.win[y])) { const o = d.origin, [x0, y0] = Motion.project(c, o[0], o[1] + 90), s = 90 * c.k; if (x0 < stage.width && y0 < stage.height && x0 + s > 0 && y0 + s > 0) wins.push({ label, d, x0, y0, s }); }
    const clipped = (inside, draw) => { mctx.save(); stage.base(); mctx.beginPath(); if (!inside) mctx.rect(0, 0, stage.width, stage.height); for (const w of wins) mctx.rect(w.x0, w.y0, w.s, w.s); mctx.clip('evenodd'); draw(); mctx.restore(); };
    if (a25 < 1 && SHD.c100[y]) { const d = SHD.c100[y], paths = tiles('sh100-' + y, () => MM.buildTiles(d.count, d.ix, d.iy, i => sharedClass(d, i), { gapKm: 15 })); MM.drawTiles(mctx, stage, c, paths, colour, { alpha: 1 - a25, alphaOf }); }
    if (a25 > 0) { const d = SHD.c25[y], paths = tiles('sh25-' + y, () => MM.buildTiles(d.count, d.ix, d.iy, i => sharedClass(d, i), { sizeKm: G25, gapKm: G25 * 0.12 }));
      if (!wins.length) MM.drawTiles(mctx, stage, c, paths, colour, { alpha: a25, alphaOf });
      else { clipped(false, () => MM.drawTiles(mctx, stage, c, paths, colour, { alpha: a25, alphaOf })); if (a1 < 1) clipped(true, () => MM.drawTiles(mctx, stage, c, paths, colour, { alpha: a25 * (1 - a1), alphaOf })); } }
    for (const w of wins) { const paths = tiles('sh1-' + y + '-' + w.label, () => MM.buildTiles(w.d.count, w.d.ix, w.d.iy, i => sharedClass(w.d, i), { sizeKm: 1, gapKm: 0.12, origin: w.d.origin })); MM.drawTiles(mctx, stage, c, paths, colour, { alpha: a1, alphaOf }); }
  }
  function sharedRings(c) {   // the Firms view's marks (spB, the author's pick: the radius 4 px at 100 firms and 16 at 10,000, by the log of the pair's firms), from the loaded address file's counts: 100 or more firms on no list
    const d = firmYears.get(state.year); if (!d) return;
    const k = c.k / 1000, ox = c.ox - c.cx * c.k, oy = c.oy + c.cy * c.k, W = stage.width + 24, H = stage.height + 24;
    kctx.save(); kctx.strokeStyle = theme.ink; kctx.globalAlpha = theme.dark ? 0.6 : 0.7; kctx.lineWidth = 1.5; kctx.beginPath();
    for (let i = 0; i < d.n; i++) { const n = d.nn[i]; if (n < 100) continue; const px = ox + d.x[i] * k, py = oy - d.y[i] * k; if (px < -24 || px > W || py < -24 || py > H) continue;
      const r = 4 + 6 * Math.log10(n / 100); kctx.moveTo(px + r, py); kctx.arc(px, py, r, 0, 2 * Math.PI); }
    kctx.stroke(); kctx.restore();
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
  let wireHold = false;
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
    setStripText(f, prev); setGlyph(gname);   // the first slot shows the hovered region at once (round 16: the author's pick of 27 October 2026, wsA)
    if (wireHold) return;   // the blink and the year run (round 15): the slot follows the year shown, the track waits for the end
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
  const TIPS = [   // each at most 68 characters (round 12, part D: in tracked capitals the reduced-motion slot at 768 px holds 68, and a phone's two-line form holds 68 in sentence case); round 15 (the author's item 13): plain sentences in place of the compressed notes ("THE CITY WINDOW FROM THE COUNTRY")
    { text: 'Click a cell to fly to it, or to its city if the cell holds one.', touch: 'Tap a cell for its values, double-tap to zoom, pinch to zoom.' },
    { text: 'From a city, a click goes to the 20 km scale, then 2.5 times closer.', mouse: true },
    { text: 'In the Firms view, clicks past the 20 km scale zoom 4 times closer.', mouse: true, firms: true },
    { text: 'Shift+click zooms back out from the point.', mouse: true },
    { text: 'The red button shows the firms added to a list in the year shown.', firms: true },
    { text: 'The Firms view draws registered addresses, year by year.', firms: true },
    { text: 'Firms on the five lists (treated) turn red from the year added.', firms: true },
    { text: 'Add a city to the link, as in #Moscow, to open the atlas there.' },
    { text: 'Type a name under GO TO to find a firm on the five lists.' },
    { text: 'The link button under GO TO copies a link to the current view.' },
    { text: 'Map focused: + and − zoom, 0 fits the country, the arrows pan.', mouse: true },
    { text: 'Hold B to blink the map between 2021 and the year shown.', mouse: true },
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
  // second half reversed), two named firms on the lists that turned red that year at data slots 6 and 14 (the halves taking alternate picks of the
  // four, chosen at floor(i n / 4) over the names sorted), each followed by its region's statement share unless that is the region shown (round 25), and a tip at every fifth slot; one slot keyed to the year and the region carries a cat fact
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
  const wireState = { pad: 0, h: 0, cycle: [], key: '', cycleIndex: 0, width: 0, rmTimer: 0, rmIndex: 0, timer: 0, sets: [], orphans: [], x: 0, anim: null, animX0: 0, paused: false, pinned: false, restarts: 0, watchX: null, watchT: null, topTimer: 0, commitTimer: 0, changedAt: 0, vis: 0, builds: 0, resets: 0, commits: 0 };
  let WIRE_CAPS = true;   // the wire's capitals (round 12, part D; round 15): every wire item and the lead in tracked capitals, firm names included; the cat facts as they are
  const wireScrolls = () => !reduceMotion();
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const fnv = str => { let h = 2166136261; for (const b of new TextEncoder().encode(str)) { h ^= b; h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };
  const dateOf = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? `${+m[3]} ${MONTHS[+m[2] - 1]} ${m[1]}` : ''; };
  // Anniversaries (round 12, part D, item 6): the viewer's local date at load (window.__today, an ISO day, is the audit's hook); the sentence is built from the shipped dates
  // only: the anchor firm's listing date, the 2020 filing-exemption list's decree (Government Decree No. 35 of 22 January 2020, the one date typed in), and every other day on which
  // firms of the national list file were listed by a dated, non-inferred designation; null on every other day. tools/wire_check.py re-derives it for the audit.
  const TODAY = (() => { const o = window.__today; if (typeof o === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o)) return o; const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
  function anniversaryLine(iso) {   // { text, html } or null
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); if (!m) return null; const md = m[2] + '-' + m[3], day = `${+m[3]} ${MONTHS[+m[2] - 1]}`;
    const mk = (text, html) => ({ text, html: html || esc(text) });
    if (AN && AN.a.listed && AN.a.listed.date && AN.a.listed.date.slice(5) === md) return mk(`${day}: ${AN.a.label} was added to a list on this day in ${AN.a.listed.date.slice(0, 4)}.`, `${esc(day)}: <span class="nm">${esc(AN.a.label)}</span> was added to a list on this day in <span class="num">${esc(AN.a.listed.date.slice(0, 4))}</span>.`);
    if (md === '01-22') return mk(`${day}: the 2020 filing-exemption list rests on Government Decree No. 35, signed on this day in 2020.`);
    if (!TRN || !TRN.red_date) return null;
    const hits = []; for (let i = 0; i < TRN.n; i++) { const d = TRN.red_date[i]; if (d && d.slice(5) === md && !TRN.inferred[i] && !TRN.undated[i]) hits.push(i); }
    if (!hits.length) return null;
    const years = [...new Set(hits.map(i => TRN.red_date[i].slice(0, 4)))].sort(), yrs = years.length === 1 ? years[0] : years.slice(0, -1).join(', ') + ' and ' + years[years.length - 1];
    if (hits.length === 1 && TRN.name[hits[0]]) return mk(`${day}: ${TRN.name[hits[0]]} was added to a list on this day in ${yrs}.`, `${esc(day)}: <span class="nm">${esc(TRN.name[hits[0]])}</span> was added to a list on this day in <span class="num">${esc(yrs)}</span>.`);
    return mk(`${day}: ${fmt.int(hits.length)} firms were added to a list (treated) on this day in ${yrs}.`, `${esc(day)}: <span class="num">${fmt.int(hits.length)}</span> firms were added to a list (treated) on this day in <span class="num">${esc(yrs)}</span>.`);
  }
  let annivCache;   // the day's sentence, built at the first cycle (after every helper below is defined), never at script load
  const anniv = () => { if (annivCache === undefined) annivCache = anniversaryLine(TODAY); return annivCache; };
  const regRowsOf = y => { const out = []; for (let i = 0; i < REG.region.length; i++) if (REG.year[i] === y && REG.region[i] !== 'Russia' && REG.region[i] !== 'outside the basemap outline' && REG.region[i] !== 'region not recorded') out.push(i); return out; };
  // Round 25 (the author's request of 29 October 2026): about a quarter of a cycle's content on the lists, half on how the body of firms responds and a quarter other.
  // The facts run in that mix (the second half plays them reversed); the transitions, the ownership groups and the 2019 histories are series.json's.
  function wireFacts(y, band, name) {
    const ys = y + (y === 2025 ? '*' : ''), out = [], loc = s => `<span class="loc">${esc(s)}</span>`, num = f => `<span class="num">${f}</span>`, add = (src, html) => out.push({ kind: 'data', text: html, src });
    const nat = band === 'national', reg = !nat && regIndex.has(name) ? name : null, t = totals[y], t21 = totals[2021], b = FM ? FM.by_year[y] : null;
    const TS = S.transitions, trRow = prior => TS.year.findIndex((v, i) => v === y && TS.prior[i] === prior), ia = trRow('available'), ib = trRow('absent'), pctOf = (a, n) => num(fmt.pct(100 * a / n));
    const G = S.groups, own = (g, yy) => G.year.findIndex((v, i) => v === yy && G.dimension[i] === 'ownership' && G.group[i] === g);
    if (TRN) { let n = 0, nr = 0; const ri = reg ? TRN.regions.indexOf(reg) : -1; for (let i = 0; i < TRN.n; i++) if (TRN.red_from[i] === y && !TRN.undated[i]) { n++; if (ri >= 0 && TRN.reg[i] === ri) nr++; }
      add('treatednational.red_from', `${ys}: ${num(fmt.int(n))} firms added to a list (treated) nationally` + (reg ? `, ${num(fmt.int(nr))} in ${loc(reg)}` : '')); }
    if (t) add('cellsyears.totals', `${ys}: ${num(fmt.int(CY.totals.n_available[CY.totals.year.indexOf(y)]))} of ${num(fmt.int(t.eligible))} eligible firms with a statement (${num(fmt.pct(t.share))})` + (y !== 2021 && t21 ? `, against ${num(fmt.pct(t21.share))} in 2021` : ''));
    if (ia >= 0) add('series.transitions', `${ys}: ${num(fmt.int(TS.N[ia]))} of the ${num(fmt.int(TS.origin[ia]))} firms with a statement in ${y - 1} had none (${pctOf(TS.N[ia], TS.origin[ia])})`);
    if (t) add('cellsyears.totals', `${ys}: ${num(fmt.int(t.located))} of ${num(fmt.int(t.eligible))} eligible firms located (${num(fmt.pct(t.located_share))})`);
    { const s = own('state', y), p = own('private', y), s21 = own('state', 2021), p21 = own('private', 2021);
      if (s >= 0 && p >= 0) add('series.groups', y === 2021 || s21 < 0 || p21 < 0 ? `${ys}: ${num(fmt.pct(G.share[s]))} of the ${num(fmt.int(G.n[s]))} state-related firms had a statement, against ${num(fmt.pct(G.share[p]))} of the ${num(fmt.int(G.n[p]))} private firms`
        : `${ys}: ${num(fmt.pct(G.share[s]))} of the ${num(fmt.int(G.n[s]))} state-related firms had a statement, against ${num(fmt.pct(G.share[s21]))} in 2021. Private firms: ${num(fmt.pct(G.share[p]))} of ${num(fmt.int(G.n[p]))}, against ${num(fmt.pct(G.share[p21]))}`); }
    if (TRN) { let red = 0; for (let i = 0; i < TRN.n; i++) if (TRN.red_from[i] <= y) red++; add('treatednational.red_from', `By ${ys}: ${num(fmt.int(red))} of the ${num(fmt.int(TRN.n))} firms on the lists (treated) are shown red. The ${num(fmt.int(TRN.undated_n))} on undated lists are red from 2014, and ${num(fmt.int(TRN.inferred_n))} dates of addition to a list are inferred`); }
    if (ib >= 0) add('series.transitions', `${ys}: ${num(fmt.int(TS.A[ib]))} of the ${num(fmt.int(TS.origin[ib]))} firms without a statement in ${y - 1} had one (${pctOf(TS.A[ib], TS.origin[ib])})`);
    if (REG) { const iN = regRow('Russia', y); if (iN != null && REG.d1[iN] !== 255) { const d = REG.d1[iN], rows = regRowsOf(y), k = rows.filter(i => REG.d1[i] === d).length;
        add('regions.d1', `${ys}: ${esc(divShort(d))} (${divPad(d)}) leads nationally and in ${num(fmt.int(k))} of ${num(fmt.int(rows.length))} regions`);
        if (reg) { const ir = regRow(reg, y); if (ir != null && REG.d1[ir] !== 255 && REG.d1[ir] !== d) add('regions.d1', `${loc(reg)}, ${ys}: ${esc(divShort(REG.d1[ir]))} (${divPad(REG.d1[ir])}) leads with ${num(REG.s1[ir] + '%')} of revenue`); } }
      if (reg) { const ir = regRow(reg, y); if (ir != null) add('regions.listed', `${loc(reg)}, ${ys}: ${num(fmt.int(REG.listed[ir]))} of ${num(fmt.int(REG.n[ir]))} firms registered in the region are on the five lists (treated) and hold ${num(REG.lsh[ir] + '%')} of its revenue`); } }
    if (ia >= 0 && ib >= 0) add('series.transitions', `${ys}: ${num(fmt.int(TS.X[ib]))} of the firms without a statement in ${y - 1} were removed from the registry (${pctOf(TS.X[ib], TS.origin[ib])}), against ${num(fmt.int(TS.X[ia]))} of those with one (${pctOf(TS.X[ia], TS.origin[ia])})`);
    if (b) add('firms.by_year', `${ys}: ${num(fmt.int(b.firms))} firms on no list (comparison group) at ${num(fmt.int(b.addresses))} coordinate pairs`);
    if (b) { const k = FM.median_by_year.year.indexOf(y); if (k >= 0) add('firms.median_by_year', `${ys}: the median real-revenue change of firms on no list (comparison group) is ${num(fmt.signed(FM.median_by_year.med[k]) + '%')} against their own 2019 to 2021 average`); }
    if (b) add('firms.by_year', `${ys}: ${num(fmt.int(b.listed))} located firms on the lists (treated). ${num(fmt.int(b.city_level))} firms have other geocodes`);
    if (b) add('firms.by_year', `${ys}: the largest coordinate pair holds ${num(fmt.int(b.max_at_address))} firms on no list. ${num(fmt.int(b.firms_at_100plus))} firms sit at the ${num(fmt.int(b.addresses_100plus))} pairs shared by 100 or more`);
    if (y === 2021) add('series.facts', `2021: ${num(fmt.int(F.largest_location_firms))} firms share the largest coordinate pair. Across all located firms, ${num(fmt.int(F.firms_at_100plus_locations))} sit at pairs shared by 100 or more`);
    { const ct = C100.change_totals, sup = C100.change.supported.reduce((a, v) => a + (v ? 1 : 0), 0); add('cells100.change', `2024 against 2021: ${num(fmt.int(sup))} 100 km cells have 50 or more located firms in both years. ${num(fmt.pct(ct.availability_share_percent[0]))} of located firms had a statement in 2021 and ${num(fmt.pct(ct.availability_share_percent[1]))} in 2024`); }
    add('series.facts.histories', `2019 to 2024: ${num(fmt.int(F.hist_all_available))} of the ${num(fmt.int(F.fixed_2019_cohort))} firms followed from 2019 had a statement in every year (${pctOf(F.hist_all_available, F.fixed_2019_cohort)})`);
    return out;
  }
  function wireFirms(y, band, name) {   // each firm carries its follow-up, the share line of the region it is registered in (round 25), or null where that region is the one shown (the lead gives its line) or has no row
    if (!TRN) return []; const here = band !== 'national' && regIndex.has(name) ? name : null, ri = here ? TRN.regions.indexOf(name) : -1, ys = y + (y === 2025 ? '*' : '');
    const pick = useReg => { const idx = []; for (let i = 0; i < TRN.n; i++) if (TRN.red_from[i] === y && !TRN.undated[i] && TRN.name[i] && (!useReg || TRN.reg[i] === ri)) idx.push(i); idx.sort((a, b) => (TRN.name[a] < TRN.name[b] ? -1 : TRN.name[a] > TRN.name[b] ? 1 : a - b)); return idx; };
    let idx = ri >= 0 ? pick(true) : []; if (idx.length < 2) idx = pick(false); if (!idx.length) return [];
    const picks = []; for (let i = 0; i < 4; i++) { const j = idx[Math.floor(i * idx.length / 4)]; if (!picks.includes(j)) picks.push(j); }
    const follow = r => { if (!REG || r === here || r === 'outside the basemap outline' || r === 'region not recorded') return null; const i = regRow(r, y), i21 = regRow(r, 2021); if (i == null || !REG.n[i]) return null;
      const sh = shareOf(REG.a[i], REG.n[i]), s21 = i21 != null ? shareOf(REG.a[i21], REG.n[i21]) : null;
      return { kind: 'data', text: `<span class="loc">${esc(r)}</span>, ${ys}: <span class="num">${fmt.int(REG.n[i])}</span> firms registered in the region, <span class="num">${fmt.pct(sh)}</span> with a statement` + (y !== 2021 && s21 != null ? `, <span class="num">${pts(0, sh - s21)}</span> against 2021` : ''), src: 'regions.follow' }; };
    return picks.map(j => { const ch = TRN.filed[j][y - 2014], st = ch === '1' ? 'available' : ch === '0' ? 'absent' : 'not in the registry', d = dateOf(TRN.red_date[j]);
      return { kind: 'firm', text: `<span class="nm">${esc(TRN.name[j])}</span> · ${d ? 'on a list from ' + d : 'on a list from ' + y}${TRN.inferred[j] ? ' (date inferred)' : ''} · ${ys} statement ${st}`, src: 'treatednational:' + j, follow: follow(TRN.regions[TRN.reg[j]]) }; });
  }
  const wireTipsList = () => { const out = []; TIPS.forEach(t => { if (t.firms && !FIRMS_OK) return; if (t.mouse && coarse()) return; out.push(coarse() && t.touch ? t.touch : t.text); }); return out; };
  function buildCycle(y, band, name, cycleIndex) {
    const lf = factFor(band, name, true), an = anniv(), lead = { kind: 'lead', text: lf.text + (an ? '. ' + an.html : ''), src: 'lead:' + lf.kind + (an ? '+anniversary' : '') } /* on an anniversary the lead item carries the sentence (item 6) */, facts = wireFacts(y, band, name), firms = wireFirms(y, band, name), tipsL = wireTipsList();
    const firmsA = firms.filter((_, i) => i % 2 === 0), firmsB = firms.filter((_, i) => i % 2 === 1), firmSlots = new Set([6, 14]);
    const half = (fo, fh, tipStart) => { const data = [lead]; let fi = 0, di = 0;   // a firm at its slot, or wherever the facts have run out, with its follow-up right after it
      while (data.length < 20) { if ((firmSlots.has(data.length) || di >= fo.length) && fi < fh.length) { const f = fh[fi++]; data.push(f); if (f.follow && data.length < 20) data.push(f.follow); continue; } data.push(fo.length ? fo[(di++) % fo.length] : lead); }
      const items = []; let ti = tipStart, dj = 0; for (let p = 0; p < WIRE_HALF; p++) { if (p % 5 === 4) { const t = tipsL[ti % tipsL.length]; items.push({ kind: 'tip', text: units(esc(t)), src: 'tips:' + (ti % tipsL.length) }); ti++; } else items.push(data[dj++]); } return items; };
    const cycle = half(facts, firmsA, 0).concat(half(facts.slice().reverse(), firmsB, 5));
    if (OFFWIRE && OFFWIRE.facts && OFFWIRE.facts.length) { const h = fnv(`${y}|${name}`), pool = OFFWIRE.facts, isFirm = i => i >= 0 && i < cycle.length && cycle[i].kind === 'firm'; let slot = 12 + (h % 26), guard = 0;
      while (guard++ < 60 && (cycle[slot].kind === 'tip' || isFirm(slot) || isFirm(slot - 1) || isFirm(slot + 1))) { slot++; if (slot >= cycle.length) slot = 12; }
      const f = pool[(h + 7 * cycleIndex) % pool.length]; cycle[slot] = { kind: 'cat', text: `<span class="cf">${esc(f.text)}</span>`, src: 'offwire:' + f.id }; }
    return cycle;
  }
  const SEP = '<svg class="mk wsep" aria-hidden="true" focusable="false"><use href="#mark-wire"/></svg>';   // the separator: the mark at 14 px with 2 px strokes in the full context green (round 11)
  const catSep = sep => { if (sep && sep.classList && sep.classList.contains('wsep')) { sep.classList.add('catsep'); sep.innerHTML = '<use href="#mark-cat"/>'; } };   // the mark before a cat fact becomes a cat's head (round 15, the author's item 7C)
  const wireTrack = () => $('wiretrack'), wireVisW = () => $('ctxwin').clientWidth;
  const wirePos = el => { const tr = wireTrack().getBoundingClientRect(), r = el.getBoundingClientRect(); return [r.left - tr.left, r.right - tr.left]; };   // an item's edges along the track, whatever its transform (the separators are SVG, without offsetLeft)
  // Round 16 (the author's item of 27 October 2026: the wire stuttered while the cursor crossed regions; the record showed every region change
  // cancelling and restarting the scroll, at once for the first slot's width and again 250 ms later for the queued set). A region change no longer
  // touches the running scroll: one linear animation runs far past the content (WIRE_FAR), so an append only re-arms the top-up timer; items that
  // leave at the left go into a spacer of the same width at the track's start (ws.pad, its padding), so no item moves; the first slot's width change
  // is taken up by the track's own margin (ws.h), not by the scroll. The offset x is the track coordinate at the window's left edge, the animation's
  // own offset plus ws.h. Only a year change, a reset, a pinned tip and the watchdog start a new animation.
  const WIRE_FAR = 1e6;
  function wireX() { const ws = wireState; if (ws.anim && !ws.pinned && ws.anim.currentTime != null) return ws.animX0 + WIRE_SPEED * (ws.anim.currentTime / 1000) + ws.h; return ws.x; }   // the scroll offset now, px
  function wireStop() { const ws = wireState; if (ws.anim) { ws.x = wireX(); ws.anim.cancel(); ws.anim = null; } if (ws.topTimer) { clearTimeout(ws.topTimer); ws.topTimer = 0; } return ws.x; }
  function wireAnimate(fromX) {   // one linear animation from fromX far past the track's end at the wire's speed; a top-up is scheduled before the content's end enters the view
    const ws = wireState, tr = wireTrack(); wireStop(); ws.x = fromX; const s = fromX - ws.h;
    tr.style.transform = `translateX(${-s}px)`;
    if (!tr.animate) return;
    ws.animX0 = s; ws.anim = tr.animate([{ transform: `translateX(${-s}px)` }, { transform: `translateX(${-(s + WIRE_FAR)}px)` }], { duration: WIRE_FAR / WIRE_SPEED * 1000, easing: 'linear', fill: 'forwards' });
    if (ws.paused) ws.anim.pause();
    wireArm(fromX);
  }
  function wireArm(x = wireX()) {   // the top-up timer from the content's end, re-armed after every append without touching the scroll
    const ws = wireState, tr = wireTrack(); if (ws.topTimer) { clearTimeout(ws.topTimer); ws.topTimer = 0; }
    const last = tr.lastElementChild, end = last ? wirePos(last)[1] : 0, vis = wireVisW(); if (!(vis > 0)) return;   // a hidden frame has no widths: a timer from them fires at once and advances the cycle, and the rebuild once the frame shows would draw the next cat fact; the watchdog tops up once it is shown (a shown, emptied track still gets its timer at once)
    ws.topTimer = setTimeout(wireTopUp, Math.max(0, end - vis - 300 - x) / WIRE_SPEED * 1000);
  }
  function wireRun(x) { const ws = wireState; if (ws.anim && !ws.pinned) wireArm(x); else wireAnimate(x); }   // the running scroll is kept; one starts only where none runs
  const wireItems = cycle => { const tr = wireTrack(), els = []; for (const it of cycle) { if (it.kind === 'cat') catSep(tr.lastElementChild); const sp = document.createElement('span'); sp.className = 'wi ' + it.kind; sp.innerHTML = it.text; tr.appendChild(sp); els.push(sp); const hold = document.createElement('span'); hold.innerHTML = SEP; const svg = hold.firstChild; tr.appendChild(svg); els.push(svg); } return els; };
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
  function wirePrune(x) {   // the items that have passed the left edge leave the track, orphans and the committed set's alike; the spacer at the track's start takes their width (round 16), so nothing moves and the offset stays
    const ws = wireState, tr = wireTrack(); let removed = 0;
    while (tr.firstElementChild) { const el = tr.firstElementChild, [l, r] = wirePos(el); if (r + removed >= x - 20) break;   // an element's place in the track's original frame: what has left so far shifted it left by that much (25 October 2026: compared unshifted, the loop emptied the whole track once the first item had passed, and the new set leapt into view on every region change)
      const next = el.nextElementSibling, nl = next ? wirePos(next)[0] : null; el.remove(); removed += next ? nl - wirePos(next)[0] : r - l;   // the exact shift of what follows, margins included
      if (ws.orphans[0] === el) ws.orphans.shift(); else for (const set of ws.sets) if (set.els[0] === el) { set.els.shift(); break; } }
    while (ws.sets.length > 1 && !ws.sets[0].els.length) { ws.sets.shift(); ws.sets[0].status = 'committed'; ws.commits++; if (ws.commitTimer) { clearTimeout(ws.commitTimer); ws.commitTimer = 0; } }   // the committed set has played out: the pending one plays now
    if (removed) { ws.pad += removed; tr.style.paddingLeft = ws.pad + 'px'; }   // the spacer in place of what left (round 16): until 27 October the offset moved by the width removed and the scroll restarted from it
    return removed;
  }
  function wireAutoCommit(x) {   // a pending set whose items have entered the view is playing: it is the committed set now, the old one's remaining items orphans
    const ws = wireState; if (ws.sets.length > 1 && setEntered(ws.sets[1], x)) wireCommit('play');
  }
  function wireCommit(why) {   // the pending set becomes the committed set: a committed set that has not entered the view is dropped unseen, one that has plays out to its cut as orphans
    const ws = wireState; if (ws.commitTimer) { clearTimeout(ws.commitTimer); ws.commitTimer = 0; }
    if (ws.sets.length < 2) return false;
    let x = wireX(); wirePrune(x);
    if (ws.sets.length > 1) { const cur = ws.sets.shift(); if (setEntered(cur, x)) ws.orphans.push(...cur.els); else wireDrop(cur); }
    ws.sets[0].status = 'committed'; ws.commits++; ws.cycle = ws.sets[0].cycle; ws.key = ws.sets[0].key; wireRun(x); return true;
  }
  function wireTopUp() {   // the track is about to run out: the committed set continues with its context's next cycle (the cat fact advancing by seven)
    const ws = wireState; ws.topTimer = 0; if (!wireScrolls() || ws.pinned || !ws.sets.length) return;
    let x = wireX(); wirePrune(x); wireAutoCommit(x); x = wireX(); const last = ws.sets[ws.sets.length - 1];
    if (last.status === 'committed') { ws.cycleIndex++; last.els.push(...wireItems(buildCycle(last.ctx.y, last.ctx.band, last.ctx.name, ws.cycleIndex))); ws.width = setEnd(last) - setStart(last); }
    wireRun(x);
  }
  function wireReset(ctx, key, crossfade) {   // a fresh track from x 0 with one committed set; under crossfade (a year change) a frozen copy of the old track fades out as the new one fades in, 0.3 s
    const ws = wireState, tr = wireTrack(), box = $('ctxwin');
    if (crossfade && tr.childElementCount && !reduceMotion()) {
      const x = wireX(), ghost = tr.cloneNode(true); ghost.removeAttribute('id'); ghost.classList.add('old'); ghost.classList.remove('in', 'pinned'); ghost.style.transform = `translateX(${-(x - ws.h)}px)`; box.appendChild(ghost);   // the copy keeps the track's spacer and margin
      requestAnimationFrame(() => { ghost.classList.add('fade'); setTimeout(() => ghost.remove(), 400); });
      tr.classList.add('in'); requestAnimationFrame(() => requestAnimationFrame(() => tr.classList.remove('in')));
    }
    wireStop(); if (ws.commitTimer) { clearTimeout(ws.commitTimer); ws.commitTimer = 0; } ws.sets = []; ws.orphans = []; tr.innerHTML = ''; ws.x = 0; ws.pinned = false; tr.classList.remove('pinned'); ws.resets++;
    ws.pad = 0; ws.h = 0; tr.style.paddingLeft = ''; tr.style.marginLeft = '';   // a fresh track has nothing to hold in place
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
    let x = wireX(); wirePrune(x); wireAutoCommit(x); x = wireX();   // round 16: no stop, so no restart
    const head = ws.sets[0], pend = ws.sets[1];
    if (!setEntered(head, x) && head.key !== key) {   // a committed set that has not entered the view is replaced unseen, as a pending one is (round 13): nothing visible is touched and the new lead is not kept waiting behind it
      if (pend) wireDrop(pend); wireDrop(head); ws.sets = []; if (ws.commitTimer) { clearTimeout(ws.commitTimer); ws.commitTimer = 0; }
      ws.cycleIndex++; wireMake(buildCycle(state.year, band, name, ws.cycleIndex), key, ctx, 'committed'); ws.commits++; wireRun(x); return;
    }
    if (head.key === key) { if (pend) { wireDrop(pend); ws.sets.length = 1; } if (ws.commitTimer) { clearTimeout(ws.commitTimer); ws.commitTimer = 0; } ws.cycle = head.cycle; ws.key = key; wireRun(x); return; }   // back on the committed context: the pending set goes
    if (pend && pend.key === key) { if (settled) wireCommit('settle'); else { wireRun(x); wireArmCommit(key); } return; }   // already pending; a settled camera commits it now, a hover back onto its region restarts the rest
    if (pend) { wireDrop(pend); ws.sets.length = 1; }
    if (setEntered(head, x)) wireCutAfterTip(head, x);   // the priority rule on the playing set; a set not yet in view keeps every item and the new one queues behind it
    ws.cycleIndex++; wireMake(buildCycle(state.year, band, name, ws.cycleIndex), key, ctx, 'pending'); wireRun(x);
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
    const ws = wireState, d = lead.getBoundingClientRect().width - w0; if (!ws.sets.length || Math.abs(d) < 0.01) return;   // the width as drawn: the stylesheet's cap can hold it under w1 (round 16: a long name at the cap was over-compensated by 24 px)   // the window's left edge moved by the change: the track's margin takes it (round 16), so every item keeps its place on screen and the scroll runs on unbroken
    ws.h += d; ws.x += d; wireTrack().style.marginLeft = (-ws.h) + 'px';
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
  // The wire's scanlines (round 15, the author's final choice of 26 October 2026): a 2 px bar and a 1 px gap with a 1 px offset, each rounded to whole device pixels so
  // the lines stay even at fractional device ratios (browser zoom, display scaling); recomputed when the ratio changes (zoom, or the window moved to another screen).
  function wireStripes(phase = 1) {   // phase in CSS px
    const d = window.devicePixelRatio || 1, bar = Math.round(2 * d), gap = Math.max(1, Math.round(d)), s = document.documentElement.style;
    s.setProperty('--wbar', bar / d + 'px'); s.setProperty('--wpitch', (bar + gap) / d + 'px'); s.setProperty('--wphase', Math.round(phase * d) / d + 'px');
    matchMedia(`(resolution: ${d}dppx)`).addEventListener('change', () => wireStripes(phase), { once: true });
  }
  wireStripes(1);
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
    if (should && ws.watchX != null && Math.abs(x - ws.watchX) < 0.5) { const tr = wireTrack(), last = tr.lastElementChild, end = last ? wirePos(last)[1] : 0, xe = x + ws.h; ws.restarts++; ws.watchX = null; ws.watchT = now; if (end - xe <= 1) wireTopUp(); else wireAnimate(xe); return; }
    if (should) { const vis = wireVisW(), last = wireTrack().lastElementChild, end = last ? wirePos(last)[1] : 0; if (vis > 0 && end - (x + ws.h) < vis) wireTopUp(); }   // the scroll runs past the content (round 16): a missed top-up shows here as content ending inside the window, an emptied track included; a hidden frame has no widths and is left alone
    ws.watchX = x; ws.watchT = now;
  }
  setInterval(wireWatch, 1000); document.addEventListener('visibilitychange', wireWatch); window.addEventListener('focus', wireWatch);
  { const bar = $('ctxstrip'), setPause = on => { const ws = wireState; ws.paused = on; if (ws.anim) { if (on) ws.anim.pause(); else ws.anim.play(); } };   // paused under the pointer or focus, as the CSS animation was
    bar.addEventListener('mouseenter', () => setPause(true)); bar.addEventListener('mouseleave', () => setPause(false)); bar.addEventListener('focusin', () => setPause(true)); bar.addEventListener('focusout', () => setPause(false)); }
  function startRM() {   // reduced motion: the cycle's items crossfade one at a time, 8 s each, from the lead
    if (wireState.rmTimer) { clearInterval(wireState.rmTimer); wireState.rmTimer = 0; } if (wireScrolls() || !wireState.cycle.length) return; wireState.rmIndex = 0;
    wireState.rmTimer = setInterval(() => { if (!stripOpen() || !stripState.fact) return; wireState.rmIndex = (wireState.rmIndex + 1) % wireState.cycle.length; const it = wireState.cycle[wireState.rmIndex]; stripState.tip = it.kind === 'tip' ? { i: -1, text: plainOf(it) } : null; setStripText({ kind: it.kind === 'lead' ? stripState.fact.kind : it.kind, name: '', text: it.kind === 'cat' ? '<svg class="catin" aria-hidden="true" focusable="false"><use href="#mark-cat"/></svg>' + it.text : it.text, nums: [] }, null); }, WIRE_RM_MS);
  }
  const plainOf = it => { const d = document.createElement('span'); d.innerHTML = it.text; return d.textContent.replace(/ /g, ' '); };
  function pinTip() { const ws = wireState, tr = wireTrack(); if (!ws.sets.length) return false; const x = wireX(), tips = [...tr.querySelectorAll('.wi.tip')], el = tips.find(e => wirePos(e)[0] >= x - 1) || tips[0]; if (!el) return false; wireStop(); ws.x = wirePos(el)[0]; ws.pinned = true; tr.classList.add('pinned'); tr.style.transform = `translateX(${-(ws.x - ws.h)}px)`; const i = [...tr.children].filter(e => e.classList.contains('wi')).indexOf(el); stripState.tip = { i, text: plainOf({ text: el.innerHTML }) }; return true; }
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
      if (markShared) html += `<div class="row"><span class="sw" style="background:transparent;border:1.5px solid ${theme.ink};border-radius:50%"></span>a coordinate pair shared by 100 or more firms</div>`;   // round 16
      html += `<div class="row h">On one of the five lists (treated)</div><div class="row">${dot(theme.neutral, 'rgba(227,26,28,0.8)')}before the year it was added</div><div class="row">${dot(theme.treated)}from that year, statement available</div><div class="row">${dot(theme.land, theme.treated)}from that year, no statement</div>`;
      read += pix ? `<div class="row p">Blocks of 2 and 3 px: 10 and 100 or more ${L === 'fin' ? 'filers' : 'firms'} in the pixel.</div><div class="row p">Each pixel (about ${pixelSize(1 / c.k)} at this zoom) sums the firms on no list at the addresses inside it. Zoom in past 20 px per km for the dots.</div>`
        : '<div class="row p">Each dot is one coordinate pair. Larger dots hold more firms.</div>';
      note = firmStatus || `${ys}: ${fmt.int(by.firms)} firms on no list (comparison group) at ${fmt.int(by.addresses)} coordinate pairs and ${fmt.int(by.listed)} firms on the five lists (treated). ${fmt.int(by.city_level)} firms with other geocodes, without a verified house or street match, are counted but not drawn.` + (TRN.name ? ' Hover a red mark for the firm’s name.' : '');
    } else if (L === 'density') {
      const micro = microA(c.k, 2021) >= 0.5, f250 = fineA(c.k) >= 0.5;
      title = '<b>Firms per cell</b> <span class="u">(' + (f250 ? '250 m' : micro ? '1 km' : '5 km') + ')</span>';
      html = MM.countClassLabels.map((lab, i) => `<div class="row">${bar(hexAlpha(theme.density, MM.countAlpha[i]))}${lab}</div>`).join(''); if (micro && !f250) read += popRow();
      note = `2021: ${fmt.int(F.located_2021)} of the ${fmt.int(F.eligible_firms_2021)} eligible firms are located, at ${fmt.int(F.distinct_locations)} coordinate pairs. The most shared pair holds ${fmt.int(F.largest_location_firms)} firms.`;
    } else if (L === 'share') {
      const y = state.year, micro = microA(c.k, y) >= 0.5, f250 = y === 2021 && fineA(c.k) >= 0.5, grid25 = alpha25(c.k) >= 0.5 && !!c25[y];
      const fine = micro || f250, breaks = fine ? FINE_BREAKS : YEAR_BREAKS, ramp = fine ? theme.ramp5 : theme.ramp6;
      const labels = ramp.map((_, i) => i === 0 ? `< ${breaks[0]}%` : i === ramp.length - 1 ? `≥ ${breaks[i - 1]}%` : `${breaks[i - 1]}–${breaks[i]}%`);
      title = `<b>Share with a statement, ${y}</b> <span class="u">(${f250 ? '250 m' : micro ? '1 km' : grid25 ? '25 km' : '100 km'})</span>`;   // the grid's size alone (round 14: the legend's width); the reading side names the squares' population
      html = ramp.map((col, i) => `<div class="row">${bar(col)}${labels[i]}</div>`).join('') + `<div class="row">${sw(theme.below)}fewer than 50 firms, share not shown</div>`; if (micro && !f250) read += popRow();
      const t = totals[y]; note = t ? `${y}${y === 2025 ? '*' : ''}: ${fmt.pct(t.share)} of the ${fmt.int(t.eligible)} eligible firms have a statement, and ${fmt.pct(t.located_share)} are located. The statements for ${y} come from ${y <= 2018 ? 'Rosstat' : 'the FNS'}.` : '';
      if (micro && y !== 2021 && c.k >= 24) note += ' 250 m cells exist for 2021 only.';
    } else if (L === 'change') {
      const labels = ['≤ −5 points', '−5 to −2', '−2 to 0', '0 to +2', '+2 to +5', '> +5 points'];
      const grid25 = chg25 && alpha25(c.k) >= 0.5, counts = grid25 ? C25.change.class_cells : C100.change_classes.cells;
      title = `<b>Change in the share, 2024 against 2021</b> <span class="u">(${grid25 ? '25' : '100'} km)</span>`;
      html = [5, 4, 3, 2, 1, 0].map(i => `<div class="row">${bar(theme.change6[i])}${labels[i]} (${fmt.int(counts[i])} cells)</div>`).join('') + `<div class="row">${sw(theme.below)}fewer than 50 firms in a year</div>`;
      note = `${fmt.int(grid25 ? C25.change.supported : C100.change.supported.reduce((t, v) => t + (v ? 1 : 0), 0))} cells have 50 or more located firms in both years. The located share with a statement moves from ${fmt.pct(C100.change_totals.availability_share_percent[0])} in 2021 to ${fmt.pct(C100.change_totals.availability_share_percent[1])} in 2024. Each year counts the firms registered then, not the same firms.`;   // the 100 km count read from the data (round 15; 658 had been typed in)
    } else if (L === 'shared') {   // round 16
      const y = state.year, win = SHD && sharedCityA(c.k) >= 0.5, grid25 = SHD && alpha25(c.k) >= 0.5;
      title = `<b>Firms at pairs shared by 100+, ${y}</b> <span class="u">(${win ? '1 km in the windows' : grid25 ? '25 km' : '100 km'})</span>`;
      html = theme.ramp6.map((col, i) => `<div class="row">${bar(col)}${SH_LABELS[i]}</div>`).join('') + `<div class="row">${sw(theme.below)}fewer than 50 firms, share not shown</div>`;
      read = '<div class="row p">Firms on no list with a house- or street-level geocode, as in the Firms view.</div>';
      if (SHD) { const N = SHD.nat, i = N.year.indexOf(y); if (i >= 0) { const f = N.firms[i], s = N.statements[i], f1 = N.firms_100[i], s1 = N.statements_100[i]; note = `${y}${y === 2025 ? '*' : ''}: ${fmt.int(f1)} of ${fmt.int(f)} such firms (${fmt.pct(100 * f1 / f)}) are at ${fmt.int(N.pairs_100[i])} coordinate pairs shared by 100 or more firms. ${fmt.pct(100 * s1 / f1)} of them have a statement, against ${fmt.pct(100 * (s - s1) / (f - f1))} of the firms elsewhere.`; } }
    } else if (grpLayer()) {   // round 16
      const name = GRP_NAME, counts = [0, 0, 0, 0, 0, 0]; let below = 0;
      if (GRP) for (const [nm, v] of GRP.byRegion) { if (!BM_NAMES.has(nm)) continue; const cl = groupClass(v); if (cl === 'below') below++; else counts[cl]++; }
      title = `<b>Change within ${name}, 2024 against 2021</b> <span class="u">(regions)</span>`;
      html = [5, 4, 3, 2, 1, 0].map(i => `<div class="row">${bar(theme.change6[i])}${GL_LABELS[i]} (${fmt.int(counts[i])} region${counts[i] === 1 ? '' : 's'})</div>`).join('') + `<div class="row">${sw(theme.below)}fewer than 50 state-related firms in a year (${fmt.int(below)} region${below === 1 ? '' : 's'})</div>`;
      if (GRP) { const t = GRP.totals; note = `Across Russia, ${fmt.pct(100 * t.a21 / t.n21)} of ${fmt.int(t.n21)} ${name} had a statement for 2021 and ${fmt.pct(100 * t.a24 / t.n24)} of ${fmt.int(t.n24)} for 2024. Each year counts the firms registered then.`; }
    } else if (L === 'cohort') {
      title = '<b>Revenue cohort by cash share: inclusion per cell</b>';
      html = theme.ramp5.map((col, i) => `<div class="row">${bar(col)}${C100.cohort_class_labels[i]}</div>`).join('') + `<div class="row">${sw(theme.below)}fewer than 50 eligible firms</div>`;
      note = `${fmt.int(F.cohorts.revenue_cash)} firms in the revenue cohort by cash share. Each cell shows its located cohort firms as a share of its located eligible firms in 2021, in five classes pooled over the supported cells.` + (c.k >= 1.5 ? ' 100 km cells are this layer’s finest resolution.' : '');
    } else if (L === 'industry' && IND_T) {
      const y = state.year, micro = microA(c.k, y) >= 0.5, grid25 = alpha25(c.k) >= 0.5 && !!ind25[y];
      title = `<b>Leading industry by revenue, ${y}${y === 2025 ? '*' : ''}</b> <span class="u">(${micro ? '1 km' : grid25 ? '25 km' : '100 km'})</span>`;
      html = IND_T.classes.label.map((lab, i) => `<div class="row">${sw(theme.ind9[i])}${lab}</div>`).join('') + `<div class="row">${sw(theme.below)}no firm with a revenue value</div>`; if (micro) read += popRow(', coloured by the class with the largest revenue at their coordinate pairs, firms on the five lists there included');
      note = `${y}${y === 2025 ? '*' : ''}: each cell takes the division with the largest share of nominal revenue among its located firms with a statement and a positive revenue value. The names are NACE Rev. 2’s, whose two-digit codes OKVED 2 shares.`;
    } else if (L === 'lists') {
      // Three classes, the ones listClass draws (ramp5[2], [3], [4]), each with its cell count; 1 to 4 members show no count.
      const grid25 = c25[2021] && alpha25(c.k) >= 0.5, counts = grid25 ? list25Counts : listClassCounts;
      title = `<b>Sanctions-list members, 2021</b> <span class="u">(${grid25 ? '25' : '100'} km)</span>`;   // the grid size as a unit phrase (round 10)
      html = ['5–19', '20–49', '≥ 50'].map((lab, i) => `<div class="row">${bar(theme.ramp5[i + 2])}${lab} located members (${fmt.int(counts[i + 1])} cells)</div>`).join('');
      note = 'Members of the sanctions list per cell in 2021. The lists are fixed memberships. Cells with 1 to 4 members show no count, and the hover also gives the government strategic list.';
    } else if (L === 'fin') {
      const labels = ['≤ −20%', '−20 to −10%', '−10 to 0%', '0 to +10%', '+10 to +20%', '> +20%'];
      title = '<b>Median real revenue, 2024 against 2021 (descriptive)</b>';
      html = [5, 4, 3, 2, 1, 0].map(i => `<div class="row">${bar(theme.change6[i])}${labels[i]}</div>`).join('');
      note = 'Firms of the revenue cohort by cash share, in cells with 50 or more observed firms. Descriptive: the firms observed change from year to year.' + (c.k >= 1.5 ? ' 100 km cells are this layer’s finest resolution.' : '');
    }
    if (state.mode !== 'firms' && TRN && !grpLayer()) {   // the tile's red count (round 14), in the layer's own year: its key row, and its definition on the reading side; none on the state-related layer, whose tile has no red count (round 18)
      const ly = layerYear();
      html += `<div class="row"><span class="sw dot" style="background:${theme.treated}"></span><b class="lcn">N</b> on the five lists (treated), ${ly}</div>`;
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
    if (L === 'shared') {   // round 16: the 1 km square inside a city window, the 25 km or the 100 km cell
      if (!SHD) return out; const y = state.year, hit = (d, i) => { if (i != null) Object.assign(out, { n: d.n[i], a: d.a[i], n100: d.n100[i], a100: d.a100[i], p100: d.p100[i] }); return out; };
      Object.assign(out, { shared: true, n: null });
      if (SHD.win[y] && sharedCityA(c.k) >= 0.5) for (const [label, d] of Object.entries(SHD.win[y])) { const o = d.origin; if (km.x < o[0] || km.x >= o[0] + 90 || km.y < o[1] || km.y >= o[1] + 90) continue;
        const jx = Math.floor(km.x - o[0]), jy = Math.floor(km.y - o[1]); Object.assign(out, { grid: 1, ix: jx, iy: jy, win: label, origin: o }); return hit(d, d.map.get(cellKey(jx, jy))); }   // the window's own grid, for the listed count and the outline
      const g = alpha25(c.k) >= 0.5 && SHD.c25[y] ? G25 : 100, d = g === 100 ? SHD.c100[y] : SHD.c25[y], jx = Math.floor(km.x / g), jy = Math.floor(km.y / g);
      Object.assign(out, { grid: g, ix: jx, iy: jy }); return d ? hit(d, d.map.get(cellKey(jx, jy))) : out;
    }
    if (grpLayer()) { Object.assign(out, { grp: true, gv: out.region && GRP ? GRP.byRegion.get(out.region) || null : null }); return out; }   // round 16: the state-related firms' two years in the region
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
  const LIST_WORDS = { s: 'sanctions', d: 'decree', r: '2020 filing-exemption', g: 'government strategic', p: 'presidential strategic' };
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
  // ---- the profiles (round 15, the author's item 9; the author's text rule of 26 October 2026) ------------------------------------------------------
  // A region or a city window under the cursor gets a profile: one researched, sourced sentence of geoeconomic insight (data/insights.js, written from the
  // sources the references list and audited by the author), then M12's median revenue and total assets in 2024 against Russia's (profiles.json). The author's
  // rule: a profile never restates what the atlas already shows through any view or layer, so the shares, the counts, the revenue mix and the median change stay
  // with their own layers. Without an insight a unit has no profile, and a firm on the five lists has none (its tile carries its facts). The tile's box holds
  // the insight's short form and the UNDER THE CURSOR card the whole profile; a narrow map's tile has no box. motion/tools/profile_check.py re-derives the size
  // sentence and checks the insights' form.
  const PROF = D.profiles || null, INS = D.insights || null;
  const profCache = new Map();
  const rubM = m => { const k = Math.round(m * 1000); return k >= 1000 ? `${fmt.dec(m, 1)} million` : `${fmt.int(k)} thousand`; };   // millions of 2021 rubles, under one million in thousands
  function sizeSentence(rows, key, name) {   // M12's medians in 2024 beside Russia's; who is in each median is said in the card's i
    if (!PROF) return null; const R = PROF[rows], N = PROF.regions;
    const at = (T, k, v) => { for (let i = 0; i < T[k].length; i++) if (T[k][i] === v && T.year[i] === 2024) return i; return -1; };
    const i = at(R, key, name), n = at(N, 'region', 'Russia');
    if (i < 0 || n < 0 || R.med_rev_m[i] == null || R.med_assets_m[i] == null) return null;
    return `In constant 2021 rubles, median revenue was ${rubM(R.med_rev_m[i])} and median total assets ${rubM(R.med_assets_m[i])} in 2024 (Russia ${rubM(N.med_rev_m[n])} and ${rubM(N.med_assets_m[n])}).`;
  }
  function profileUnit(kind, name, head) {
    const id = (kind === 'region' ? 'r:' : 'w:') + name; if (profCache.has(id)) return profCache.get(id);
    const ins = INS && INS[kind === 'region' ? 'regions' : 'cities'] ? INS[kind === 'region' ? 'regions' : 'cities'][name] : null; let p = null;
    if (ins && ins.full && ins.short) { const sz = kind === 'region' ? sizeSentence('regions', 'region', name) : sizeSentence('windows', 'label', name); p = { id, kind, head, full: sz ? [ins.full, sz] : [ins.full], tile: ins.short }; }
    profCache.set(id, p); return p;
  }
  const profileRegion = name => profileUnit('region', name, name);
  const profileWindow = label => profileUnit('window', label, label + ' window, 90 by 90 km');
  const windowAtKm = km => { for (const [label, w] of Object.entries(win1)) if (Math.abs(km.x - w.cx) <= 45 && Math.abs(km.y - w.cy) <= 45) return label; return null; };
  function profileFor(h) {
    if (!h || !REG || !INS || h.kind === 'listed') return null;
    const w = cam().k >= 1.5 && h.kmx != null ? windowAtKm({ x: h.kmx, y: h.kmy }) : null; if (w) { const p = profileWindow(w); if (p) return p; }
    const rn = h.region && regIndex.has(h.region) ? h.region : null; return rn ? profileRegion(rn) : null;
  }
  function fillTileBio(p) {
    const box = $('tipbio'); box.hidden = !p; if (!p) return;
    $('tipbioh').textContent = p.head; $('tipbiot').textContent = p.tile;
  }
  function fillPanelProfile(h) {
    const el = $('cellprofile'); if (!el) return; const p = profileFor(h); el.hidden = !p; if (!p) return;
    el.innerHTML = `<div class="ph">Profile · ${esc(p.head)}</div><p>${esc(p.full.join(' '))}</p>`;
  }
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
        if (markShared && ad.n >= 100) lines.push('A coordinate pair shared by 100 or more firms on no list');   // round 16
        lines.push(ad.n === 1 ? `1 firm, ${ad.a ? '' : 'no '}${num(state.year)} statement` : `${num(fmt.int(ad.n))} firms, ${num(fmt.int(ad.a))} with a ${num(state.year)} statement, ${num(fmt.pct(100 * ad.a / ad.n))}`);
        if (state.layer === 'fin') lines.push(ad.f ? `${fmt.int(ad.f)} with a baseline and a value, median change ${CLASS_LABELS[ad.cls - 1]}` : 'No firm with a usable baseline and a value');
        if (state.layer === 'industry' && ad.ind != null) lines.push(ad.ind === 255 ? 'No firm with a revenue value at this coordinate pair' : `${esc(divShort(ad.ind))} (${divPad(ad.ind)}), ${ad.ish}% of revenue at this coordinate pair`);
      }
      if (h.listed) {
        const Ls = h.listed, parts = [];
        if (Ls.n === 1) parts.push(Ls.ring ? 'hollow' : Ls.red ? 'red' : 'added later');
        else { if (Ls.red - Ls.ring) parts.push(`${fmt.int(Ls.red - Ls.ring)} red`); if (Ls.ring) parts.push(`${fmt.int(Ls.ring)} hollow`); if (Ls.rim) parts.push(`${fmt.int(Ls.rim)} added later`); }
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
    if (h.shared) {   // round 16: the firms at coordinate pairs shared by 100 or more, and the shares with a statement there and elsewhere, each with its count
      const unit = h.win ? '1 km square' : `${h.grid} km cell`;
      if (h.n == null) { lines.push(`No firms on no list at house- or street-level geocodes in this ${unit}`); return lines.join('<br>'); }
      lines.push(`${unit}, ${num(state.year)}: ${num(fmt.int(h.n))} firms on no list at house- or street-level geocodes`);
      if (h.n < 50) { lines.push('Shares not shown under 50 firms'); return lines.join('<br>'); }
      lines.push(h.n100 ? `${num(fmt.int(h.n100))} (<b>${fmt.pct(100 * h.n100 / h.n)}</b>) at ${num(fmt.int(h.p100))} coordinate pair${h.p100 === 1 ? '' : 's'} shared by 100 or more` : 'None at coordinate pairs shared by 100 or more');
      const rn = h.n - h.n100; if (h.n100) lines.push(`With a statement: ${h.n100 >= 50 ? fmt.pct(100 * h.a100 / h.n100) : 'not shown'} there, ${rn >= 50 ? fmt.pct(100 * (h.a - h.a100) / rn) : 'not shown'} elsewhere`);
      return lines.join('<br>');
    }
    if (h.grp) {   // round 16: the state-related firms' share with a statement in the region, 2021 and 2024
      const v = h.gv, name = GRP_NAME, s = (n, a) => (n >= 50 ? fmt.pct(100 * a / n) : 'share not shown');
      if (!h.region) { lines.push('Outside the regions'); return lines.join('<br>'); }
      if (!v || !(v.n21 || v.n24)) { lines.push(`No ${name} registered here`); return lines.join('<br>'); }
      lines.push(`${name[0].toUpperCase() + name.slice(1)}, 2021: ${num(fmt.int(v.n21))} firms, ${s(v.n21, v.a21)} with a statement`);
      lines.push(`2024: ${num(fmt.int(v.n24))} firms, ${s(v.n24, v.a24)}`);
      const ch = groupChange(v); lines.push(ch == null ? 'Fewer than 50 state-related firms in a year: not classed' : `Change <b>${fmt.signed(ch)} points</b>`);
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
    if (L === 'share') { if (h.n == null) lines.push('No located firms in this 100 km cell'); else { lines.push(`${state.year}: ${fmt.int(h.n)} located eligible firms, ${fmt.int(h.a)} with a statement` + (h.n >= 50 ? ` (<b>${fmt.pct(100 * h.a / h.n)}</b>)` : ' (share not shown under 50 firms)')); if (h.nr) lines.push(`Registered at year-end: ${fmt.int(h.nr)}, ${fmt.int(h.ar)} with a statement (${fmt.pct(100 * h.ar / h.nr)})`); if (h.ns != null && h.ns > 0) lines.push(`Sanctions-list members: ${fmt.int(h.ns)}`); } }
    else if (L === 'change') { if (h.n21 == null) lines.push('No located firms'); else lines.push(`2021: ${fmt.int(h.a21)} of ${fmt.int(h.n21)} (${fmt.pct(100 * h.a21 / h.n21)})<br>2024: ${fmt.int(h.a24)} of ${fmt.int(h.n24)} (${fmt.pct(100 * h.a24 / h.n24)})<br>` + (h.supported ? `Change <b>${fmt.signed(h.change)} points</b>` : 'Fewer than 50 firms in a year: not classed')); }
    else if (L === 'cohort') { if (h.n == null) lines.push('No located firms'); else lines.push(`${fmt.int(h.c)} of ${fmt.int(h.n)} located eligible firms in the revenue cohort by cash share` + (h.supported ? ` (<b>${fmt.pct(h.pct)}</b>)` : ' (fewer than 50 eligible: not classed)')); }
    else if (L === 'lists') { if (h.n == null) lines.push('No list members shown'); else lines.push(`${fmt.int(h.n)} located eligible firms<br>Sanctions list: ${h.sanctioned == null ? 'under 5 or none' : fmt.int(h.sanctioned)}<br>Government strategic list: ${h.gov == null ? 'under 5 or none' : fmt.int(h.gov)}`); }
    else if (L === 'fin') { if (h.n_base == null) lines.push('No supported cohort cell'); else lines.push(`${fmt.int(h.n_obs)} of ${fmt.int(h.n_base)} cohort firms observed in 2024<br>Median real revenue <b>${fmt.signed(h.change)}%</b> against the cell’s 2021 median`); }
    else lines.push(`100 km cell ${h.ix}, ${h.iy}`);
    return lines.join('<br>');
  }
  function drawOverlay(h) {
    octx.setTransform(stage.scale, 0, 0, stage.scale, 0, 0); octx.clearRect(0, 0, stage.width, stage.height);
    if (!h) return; const c = cam();
    if (hoverRegionName && state.hover && regIndex.has(hoverRegionName)) {   // the region under the cursor outlined in the cursor colour at every zoom and in both views, inside a city window included (round 10, G13b as corrected 25 October): the cached region path, stroked with the overlay
      octx.save(); Motion.camTransform(octx, stage, c); octx.strokeStyle = theme.cursor; octx.lineWidth = 1 / c.k; octx.lineJoin = 'round'; MM.strokeHair(octx, regionPath(hoverRegionName)); octx.restore(); octx.setTransform(stage.scale, 0, 0, stage.scale, 0, 0);
    }
    // The hover ring and the cell square in the cursor colour, cased in the stage colour so they read on lilac and pale cells too (round 9).
    const cased = draw => { octx.strokeStyle = theme.stage; octx.globalAlpha = 0.6; octx.lineWidth = 4.5; draw(); octx.globalAlpha = 1; octx.strokeStyle = cursorStill ? theme.cursor : theme.cursorLive; octx.lineWidth = 2.5; draw(); };
    if (h.kind === 'firm' || h.kind === 'listed' || h.kind === 'pixel') { cased(() => { octx.beginPath(); octx.arc(h.px, h.py, h.r + 3, 0, Math.PI * 2); octx.stroke(); }); return; }   // a pixel's block takes the ring too (round 14)
    if (h.kind === 'none' || h.grp) return;   // the group layer's unit is the region, outlined above (round 16)
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
  const MAP_UI = '.zoombox, .toggle, button, input, .maplegend, .mixbox, .mapnote, .ctx, .popout';   // the map's overlays and controls (round 15, the author's item 1): a press on any of them is theirs, never a click on the map under them (a press on the legend's "i" had flown the map to the cell beneath)
  function localXY(ev) { const r = wrap.getBoundingClientRect(); return { x: ev.clientX - r.left, y: ev.clientY - r.top }; }
  function hideHover(opts = {}) { /* keepRegion: a wheel tick keeps the hovered region until the settled hover re-reads it, so the strip does not flip twice a tick */ $('tip').style.display = 'none'; undockTile(); state.hover = null; if (hoverRegionName && !opts.keepRegion) { hoverRegionName = null; updateContext(); } stillOff(); drawOverlay(null); wrap.classList.remove('clickable', 'zoomable'); if (opts.keepRegion) return; hoverUnit.key = null; fillMixBox(null); }   // a wheel step (keepRegion) keeps the hovered unit's cache and leaves the mix box to the settle (round 14: the view's mix cost 13 ms a step in the Firms view)
  function syncCursor(h) {
    const r = h && !press ? ladderTarget(h, kmFromPx(h.px0, h.py0), false) : null;
    wrap.classList.toggle('clickable', !!r && r.rung !== 'zoom'); wrap.classList.toggle('zoomable', !!r && r.rung === 'zoom');
  }
  // ---- the cursor tile and the still state (round 9, 25 October 2026) -----------------------------------------------------
  // The tile is the glance view: the tooltip's lines, a class-mix bar on the industry layer and a footer with the cursor's
  // coordinate (the inverse of the basemap's projection) and the scale (metres per CSS pixel). It is placed clear of the hovered
  // mark and of every panel; the hover ring takes the live variant of the cursor colour while the cursor moves and the resting
  // neon once it has been still for 200 ms. The crosshair that followed the cursor (rounds 9 to 21) was retired in round 22, the
  // author's request of 29 October 2026; its code is kept in motion/review/2026-10-29-crosshair-retired.md.
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
    return obsCache = ['legend', 'mapnote', 'mixbox', 'zoombox', 'scalebar', 'ctxstrip', 'popout'].map(id => { const el = $(id); if (!el || el.hidden) return null; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 ? { id, x: r.left - m.left, y: r.top - m.top, x1: r.right - m.left, y1: r.bottom - m.top } : null; }).filter(Boolean);
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
  // bar or the strip, and the point stays below it with the hover's clearance.
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
  function stillOff() { if (stillTimer) { clearTimeout(stillTimer); stillTimer = 0; } cursorStill = true; wrap.classList.remove('cursor-live'); }
  function armStill(touch) {
    if (stillTimer) clearTimeout(stillTimer);
    if (touch) { cursorStill = true; wrap.classList.remove('cursor-live'); return; }
    cursorStill = false; wrap.classList.add('cursor-live');
    stillTimer = setTimeout(() => { stillTimer = 0; cursorStill = true; wrap.classList.remove('cursor-live'); drawOverlay(state.hover); maybeTip(); }, 200);
  }
  function showHoverAt(x, y, opts = {}) {
    const km = kmFromPx(x, y); const h = hitAt(km); h.kmx = km.x; h.kmy = km.y; h.px0 = x; h.py0 = y; state.hover = h;
    if (h.region === undefined) h.region = regionAt(x, y);
    { const rn = h.region && regIndex.has(h.region) ? h.region : null; if (rn !== hoverRegionName) { hoverRegionName = rn; updateContext(); } }   // the strip follows the cursor's region (round 10); the overlay outlines it
    const tip = $('tip'), key = unitKey(h), fresh0 = key !== hoverUnit.key, prof = profileFor(h), pkey = prof ? prof.id : '', fresh = fresh0 || pkey !== hoverUnit.prof;
    if (fresh0) $('tipbody').innerHTML = tipText(h);
    if (pkey !== hoverUnit.prof) { fillTileBio(prof); hoverUnit.prof = pkey; }   // the profile box (round 15, item 9): a fixed height, so the tile changes size only when the box appears or goes
    fillFoot(km, !!opts.tick); tip.style.display = 'block'; if (tip.classList.contains('docked')) undockTile();   // the floating form is measured and placed first
    const foot = ['tlat', 'tlon', 'tscale', 'tunit', 'tfirms'].map(id => $(id).textContent.length).join(',') + ($('tfirmsw').hidden ? 'h' : '');
    if (fresh || foot !== hoverUnit.foot || !hoverUnit.tw) { hoverUnit.tw = tip.offsetWidth; hoverUnit.th = tip.offsetHeight; hoverUnit.foot = foot; }   // one forced layout per unit or footer width change
    const tw = hoverUnit.tw, th = hoverUnit.th, obs = tileObstacles();   // the panels' boxes are read once per layout
    const mark = h.kind === 'firm' || h.kind === 'listed' || h.kind === 'pixel'; let b = placeTile(x, y, tw, th, obs, !!opts.touch, mark ? h.r : 0);
    if (b.fallback && narrow()) { const dk = dockTile(x, y, obs, mark ? h.r : 0); if (dk) b = dk; }
    tip.style.left = b.x + 'px'; tip.style.top = b.y + 'px';
    tileState = { box: b, cursor: [x, y], mark: mark ? [h.px, h.py] : null, anchor: b.anchor, fallback: !!b.fallback, slid: !!b.slid, searched: !!b.searched, docked: !!b.docked, relaxed: b.relaxed || null };
    drawOverlay(h); syncCursor(h); armStill(!!opts.touch);
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
    if (overControl(ev, MAP_UI) || (ev.pointerType === 'mouse' && ev.button !== 0)) return;
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
    if (ev.pointerType !== 'touch') { lastPointer = { x: p.x, y: p.y, inside: true }; if (!flight && !overControl(ev, '.zoombox, .toggle, button, input, .popout')) showHoverAt(p.x, p.y); }
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
  let gestureOn = false, gestureScale = 1;   // Safari's own pinch events (round 19, below)
  wrap.addEventListener('wheel', ev => {
    if (overControl(ev, '.zoombox')) return;
    if (gestureOn && ev.ctrlKey) { ev.preventDefault(); return; }   // a pinch Safari also reports as a wheel is zoomed once, by the gesture
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
  // Safari's trackpad pinch (round 19, WebKit): Safari on a Mac sends a pinch as gesturestart, gesturechange and gestureend with a running scale, not as the
  // Ctrl-flagged wheel the other browsers send, and zooms the whole page unless they are cancelled. The map zooms by each change in scale about the pointer,
  // as the wheel's pinch does. On a touch screen the same events come with the fingers' pointers, which the pinch above already follows: there they are only
  // cancelled. Other browsers send none of these events.
  wrap.addEventListener('gesturestart', ev => { ev.preventDefault(); gestureOn = true; gestureScale = 1; }, { passive: false });
  wrap.addEventListener('gesturechange', ev => {
    ev.preventDefault();
    const f = ev.scale / gestureScale; gestureScale = ev.scale;
    if (pointers.size || !(f > 0) || f === 1 || overControl(ev, '.zoombox')) return;
    cancelFlight();
    const km = Number.isFinite(ev.clientX) ? kmAt(ev) : null, t = zoomStep(f, km);
    if (km) lastPointer = { x: km.px, y: km.py, inside: true };
    hideHover({ keepRegion: true });
    if (atFloor(t.k)) { flyTo(t, { duration: 300 }); return; }
    state.cam = { cx: t.cx, cy: t.cy, k: t.k };
    requestDraw(afterWheelStep, true);
  }, { passive: false });
  wrap.addEventListener('gestureend', ev => { ev.preventDefault(); gestureOn = false; }, { passive: false });
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
    if (cellHit && h.shared) {   // round 16
      row('Cell', h.win ? `1 km, the ${esc(h.win)} window` : `${h.grid} km (${h.ix}, ${h.iy})`);
      if (h.n == null) row('Firms', 'none on no list at house- or street-level geocodes');
      else { row('Firms', `${fmt.int(h.n)} on no list`); const rn = h.n - h.n100;
        if (h.n < 50) row('Shares', 'not shown under 50 firms');
        else { row('At shared pairs', h.n100 ? `${fmt.int(h.n100)} (${pct(h.n100, h.n)}) at ${fmt.int(h.p100)} pair${h.p100 === 1 ? '' : 's'}` : 'none'); if (h.n100) row(`${y} statement there`, h.n100 >= 50 ? `${fmt.int(h.a100)} of ${fmt.int(h.n100)} (${pct(h.a100, h.n100)})` : 'not shown under 50 firms'); row(`${y} statement elsewhere`, rn >= 50 ? `${fmt.int(h.a - h.a100)} of ${fmt.int(rn)} (${pct(h.a - h.a100, rn)})` : 'not shown under 50 firms'); } }
    }
    else if (cellHit && h.grp) {   // round 16
      const v = h.gv; row('Group', GRP_NAME);
      if (!v || !(v.n21 || v.n24)) row('Firms', 'none registered here');
      else { row('2021', `${fmt.int(v.a21)} of ${fmt.int(v.n21)}` + (v.n21 >= 50 ? ` (${pct(v.a21, v.n21)})` : ', share not shown')); row('2024', `${fmt.int(v.a24)} of ${fmt.int(v.n24)}` + (v.n24 >= 50 ? ` (${pct(v.a24, v.n24)})` : ', share not shown')); const ch = groupChange(v); row('Change', ch == null ? 'not classed, under 50 firms in a year' : `${fmt.signed(ch)} points`); }
    }
    else if (cellHit) {
      row('Cell', h.fine ? (h.grid < 1 ? '250 m' : `${h.grid} km`) : `${h.grid} km (${h.ix}, ${h.iy})`);
      if (L === 'industry') {
        if (h.dom == null || h.dom === 255) row('Leading', h.dom === 255 || h.nrev === 0 ? 'no firm with a revenue value' : 'no located firms');
        else { row('With revenue', `${fmt.int(h.nrev)} firms`); row('Leading', lead(h.dom, h.share)); if (h.mix && h.mix.length > 1) { const shown = h.mix.slice(1, 5), rest = (h.rest || 0) + h.mix.slice(5).reduce((t, m) => t + m.share, 0); row('', mixRows(shown, rest), 'full'); }   /* four ranked rows after the leader; the divisions past them fold into the remainder */ if (h.lsh != null) row('Listed (treated)', `${h.lsh}% of revenue`); }
      }
      else if (h.fine) { const ys = h.yearShown || 2021; if (h.n == null) row('Firms', 'none located'); else { row('Firms', `${band(h.n)} located`); row(`${ys} statement`, h.a != null ? `${fmt.int(h.a)} (${pct(h.a, h.n)})` : h.n >= 50 ? 'not available' : 'share not shown under 50 firms'); } }
      else if (L === 'share') { if (h.n == null) row('Firms', 'none located'); else { row('Firms', `${fmt.int(h.n)} located`); row(`${y} statement`, `${fmt.int(h.a)}` + (h.n >= 50 ? ` (${pct(h.a, h.n)})` : ', share not shown under 50 firms')); if (h.ns) row('Sanctions', `${fmt.int(h.ns)} members`); } }
      else if (L === 'change') { if (h.n21 == null) row('Firms', 'none located'); else { row('2021', `${fmt.int(h.a21)} of ${fmt.int(h.n21)} (${pct(h.a21, h.n21)})`); row('2024', `${fmt.int(h.a24)} of ${fmt.int(h.n24)} (${pct(h.a24, h.n24)})`); row('Change', h.supported ? `${fmt.signed(h.change)} points` : 'not classed, under 50 firms in a year'); } }
      else if (L === 'cohort') { if (h.n == null) row('Firms', 'none located'); else row('Cohort', `${fmt.int(h.c)} of ${fmt.int(h.n)} eligible` + (h.supported ? ` (${fmt.pct(h.pct)})` : ', not classed under 50')); }
      else if (L === 'lists') { if (h.n == null) row('Firms', 'no list members shown'); else { row('Firms', `${fmt.int(h.n)} located`); row('Sanctions', h.sanctioned == null ? 'under 5 or none' : `${fmt.int(h.sanctioned)} members`); row('Gov strategic', h.gov == null ? 'under 5 or none' : `${fmt.int(h.gov)} members`); } }
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
      row('On the five lists (treated)', `${fmt.int(Ls.n)} ${where}`);
      const blocks = Ls.top.map(i => {
        const filed = TRN.name_filed ? TRN.name_filed[i] : '', nm = TRN.name[i], cs = TRN.name_case ? TRN.name_case[i] : 0, shared = TRN.name_shared ? TRN.name_shared[i] : 0;
        const tail = [listedState(i, y), listedLists(i), listedRevenue(i, y)].filter(Boolean).join(' · ');
        return `<div class="lf"><div class="lf-h"><b>${listedGlyph(i, y)}${listedName(i)}${cs === 2 ? ' <span class="muted">(transliterated)</span>' : ''}</b><span class="muted yr">${TRN.undated[i] ? 'undated' : 'on a list from ' + TRN.red_from[i]}</span></div>`
          + (filed && filed !== nm ? `<div class="muted filed">${esc(filed)}</div>` : '') + (shared > 1 ? `<div class="muted filed">one of ${fmt.int(shared)} entries under this name</div>` : '') + `<div class="muted filed">${tail}</div></div>`;
      });
      if (Ls.n > Ls.top.length) blocks.push(`<div class="lf more">and ${fmt.int(Ls.n - Ls.top.length)} more</div>`);
      row('', blocks.join(''), 'block');
    }
    if (h && !cellHit && !h.micro && h.ix != null) row('Cell', `100 km (${h.ix}, ${h.iy})`);   // the chart's cell under the cursor in the Firms view
    info.innerHTML = rows.length ? rows.map(([k, v, t]) => (t === 'block' ? `<div class="listed">${v}</div>` : t === 'full' ? `<div class="full">${v}</div>` : t === 'loc' ? `<span>${k}</span><b class="loc">${v}</b>` : `<span>${k}</span><b>${v}</b>`)).join('') : `<span class="muted">${state.mode === 'firms' ? 'Hover a mark' : 'Hover a cell'}</span><b></b>`;
    fillPanelProfile(h);   // the profile under the rows (round 15, item 9C)
    drawCursorChart(h); if (h) pop.cursor = h;
    if (pop.id === 'cursor') drawCursorChart(pop.cursor, 'pochart');   // round 17: the pop-out follows the hover and keeps the last unit when the panel clears
  }
  // The Under the cursor chart (round 17, the author's request of 27 October 2026): drawn in its card or, enlarged, in the pop-out with 14 px text like the column's
  // three charts. Opened, the pop-out follows the hover unit by unit; when the panel clears (a redraw with nothing under the cursor) it keeps the last unit, and its
  // title names that unit's region.
  function drawCursorChart(h, target) {
    const id = target || 'cellchart', big = !!target, sz = big ? 14 : 12, L = big ? 56 : 44;
    if (big) { const t = $('h2-cursor').textContent + (h && h.region ? ' · ' + h.region : ''); $('potitle').textContent = t; $('popout').setAttribute('aria-label', t); placePopout(); }
    const { ctx, w, hgt = 0 } = chartCtx(id); const hh = $(id).getBoundingClientRect().height;
    if (!h) { if (big) Motion.paragraph(ctx, state.mode === 'firms' ? 'Hover a mark' : 'Hover a cell', 8, 24, w - 16, { size: 14, color: theme.muted }); return; }
    const note = t => Motion.paragraph(ctx, t, 8, 24, w - 16, { size: big ? 14 : 13, color: theme.muted });
    const chart = (pts, xDomain, xTicks, eras, caption) => {
      CH.lines(ctx, { x: L, y: 14, w: w - L - (big ? 64 : 56), h: hh - 52 }, [{ label: '{y}', color: theme.accent, points: pts, gapAfter: [2018] }], { xDomain, yDomain: [0, 100], theme, yTicks: [0, 50, 100], xTicks, xFmt: v => (v === 2025 ? "25*" : String(v).slice(2)), labelSize: sz, lineWidth: big ? 2.5 : 2, eras, yFmt: v => v + '%', axisSize: sz, axisDy: 20 });
      const cap = Motion.measure(ctx, caption, big ? 12 : 11, 400) <= w - 16 ? caption : caption.replace(/, (\d{4} to \d{4}|by year)$/, '');   // a caption wider than the canvas drops its year suffix, which the axis shows (round 10)
      Motion.text(ctx, cap, 8, hh - 2, { size: big ? 12 : 11, color: theme.dim });
    };
    if (h.shared) {   // round 16: the share with a statement at shared pairs and elsewhere in this cell or square, by year
      if (h.n == null || !SHD) return note('No firms on no list at house- or street-level geocodes');
      const there = [], rest = [];
      for (const yy of SHD.years) { const d = h.win ? (SHD.win[yy] || {})[h.win] : h.grid === 100 ? SHD.c100[yy] : SHD.c25[yy]; if (!d) continue; const i = d.map.get(cellKey(h.ix, h.iy)); if (i == null) continue;
        if (d.n100[i] >= 50) there.push({ x: yy, y: 100 * d.a100[i] / d.n100[i] }); const rn = d.n[i] - d.n100[i]; if (rn >= 50) rest.push({ x: yy, y: 100 * (d.a[i] - d.a100[i]) / rn }); }
      if (!there.length) return note('Fewer than 50 firms at shared pairs in every year');
      const margin = Math.max(...[['shared', there], ['elsewhere', rest]].filter(([, p]) => p.length).map(([t, p]) => Motion.measure(ctx, t + ' ' + Motion.fmt.pct(p[p.length - 1].y, 1), sz, 500))) + 22;   // the longer end label fits, as the national chart's
      CH.lines(ctx, { x: L, y: 14, w: w - L - margin, h: hh - 52 }, [{ label: 'shared {y}', color: theme.accentStrong, points: there, gapAfter: [2018] }, { label: 'elsewhere {y}', color: theme.accent, points: rest, gapAfter: [2018] }],
        { xDomain: [2013.5, 2025.5], yDomain: [0, 100], theme, yTicks: [0, 50, 100], xTicks: [2014, 2018, 2021, 2025], xFmt: v => (v === 2025 ? "25*" : String(v).slice(2)), labelSize: sz, lineWidth: big ? 2.5 : 2, eras: [{ from: 2018.5, to: 2025.5, color: theme.highlightBand }], yFmt: v => v + '%', labelFmt: v => Motion.fmt.pct(v, 1), axisSize: sz, axisDy: 20, spreadLabels: true });
      Motion.text(ctx, 'share with a statement, at shared pairs and elsewhere', 8, hh - 2, { size: big ? 12 : 11, color: theme.dim }); return;
    }
    if (h.grp) return note('The group layer compares 2021 and 2024: the rows give both years');
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
  // The three column charts draw into their card or, enlarged, into the pop-out (round 15, the author's item 5.4): target 'pochart' draws the same chart at the
  // pop-out's size with 14 px text; a card's chart that is out in the pop-out is drawn in the card as well.
  function drawNational(target) {
    const id = target || 'natchart', big = !!target; if (!big && !cardOpen('national')) return;
    const { ctx, w } = chartCtx(id); const hh = $(id).getBoundingClientRect().height, sz = big ? 14 : 12, L = big ? 56 : 44;
    const el = [], reg = []; S.avail.year.forEach((y, i) => { if (S.avail.eligible_share[i] != null) { el.push({ x: y, y: S.avail.eligible_share[i] }); reg.push({ x: y, y: S.avail.registered_share[i] }); } });
    // The right margin fits the longer end label (measured), the axes draw at the panel's 12 px, the two end labels are pushed apart.
    const margin = Motion.measure(ctx, 'registered ' + Motion.fmt.pct(reg[reg.length - 1].y, 1), sz, 500) + 22;
    const r = CH.lines(ctx, { x: L, y: 14, w: w - L - margin, h: hh - (big ? 52 : 44) }, [{ label: 'registered {y}', color: theme.accentStrong, points: reg, gapAfter: [2018], width: big ? 2.5 : 2 }, { label: 'eligible {y}', color: theme.accent, points: el, gapAfter: [2018], width: big ? 2.5 : 2 }],
      { xDomain: [2011.5, 2025.5], yDomain: [0, 80], theme, yTicks: big ? [0, 20, 40, 60, 80] : [0, 40, 80], xTicks: big ? [2012, 2014, 2016, 2018, 2020, 2022, 2024] : [2012, 2016, 2020, 2024], labelSize: sz, dots: big, eras: [{ from: 2018.5, to: 2025.5, color: theme.highlightBand }], yFmt: v => v + '%', labelFmt: v => Motion.fmt.pct(v, 1), axisSize: sz, axisDy: big ? 24 : 20, spreadLabels: true });
    if (layerOf(state.layer).mark) { const x = r.sx(state.year); ctx.strokeStyle = theme.ink; ctx.lineWidth = 1.5; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(x, 14); ctx.lineTo(x, hh - (big ? 36 : 30)); ctx.stroke(); ctx.setLineDash([]); }
    if (!big && pop.id === 'national') drawNational('pochart');
  }
  function drawGroups(target) {
    const id = target || 'groupchart', big = !!target; if (!big && !cardOpen('groups')) return;
    const { ctx, w } = chartCtx(id); const hh = $(id).getBoundingClientRect().height, sz = big ? 14 : 12;
    // One row per group, the largest rise first, state-run under state-related as a part of it (round 24): the slope chart's labels slid off their dots,
    // and State-related and Unitary began at one dot. State-run is the state-related unitary enterprises (data/statesplit.json), not the legal-form row;
    // the names in lower case, as the column's other series labels (the author's sanity check of 29 October 2026).
    const SU = D.statesplit.state_unitary, col = it => Object.assign(it, { color: it.b >= it.a ? theme.accent : theme.fall });
    const top = [{ label: 'joint-stock', a: F.legal.joint_stock[0], b: F.legal.joint_stock[1] }, { label: 'state-related', a: F.own.state[0], b: F.own.state[1] }, { label: 'private', a: F.own.private[0], b: F.own.private[1] }]
      .map(col).sort((p, q) => (q.b - q.a) - (p.b - p.a));
    const items = top.flatMap(it => it.label === 'state-related' ? [it, col({ label: 'state-run', a: SU.share[0], b: SU.share[1] })] : [it]);
    CH.changes(ctx, { x: 8, y: big ? 34 : 26, w: w - 16, h: hh - (big ? 44 : 32) }, items, { theme, size: sz, bar: big ? 8 : 6 });
    if (!big && pop.id === 'groups') drawGroups('pochart');
  }
  function drawOdds(target) {
    const id = target || 'oddschart', big = !!target; if (!big && !cardOpen('odds')) return;
    const { ctx, w } = chartCtx(id); const hh = $(id).getBoundingClientRect().height, sz = big ? 14 : 12;
    const sz5 = {}; for (let i = 0; i < S.size.year.length; i++) if (S.size.era[i] === 'recent') (sz5[S.size.quintile[i]] = sz5[S.size.quintile[i]] || []).push({ x: S.size.year[i], y: S.size.or[i], low: S.size.low[i], high: S.size.high[i] });
    const ls = []; for (let i = 0; i < S.lists.year.length; i++) if (S.lists.model[i] === 'annual-eligible-membership' && S.lists.contrast[i] === 'sanctioned_only' && S.lists.comparison[i] === 'level' && S.lists.year[i] != null) ls.push({ x: S.lists.year[i], y: S.lists.or[i], low: S.lists.low[i], high: S.lists.high[i] });
    // The right margin fits the longest end label (measured, as drawNational does): the plot's inner margin is 14 px here and the label starts 10 px past the last
    // point and ends 8 px inside the canvas (round 10: with the monospace label the chart's default 40 px margins left 59 px for five years on a phone).
    const listLabel = 'sanctioned-only firms', pad = big ? 22 : 14, endGap = big ? 14 : 10, right = Motion.measure(ctx, listLabel, sz, 500) + 40 - pad + endGap + 8, d = big ? 1.5 : 1;
    CH.yearDots(ctx, { x: big ? 52 : 40, y: 10, w: w - right - (big ? 12 : 0), h: hh - (big ? 50 : 44) }, [{ label: 'Q5 vs Q1', color: theme.accentStrong, points: sz5.Q5 || [], whiskers: true, dot: 4 * d, width: 2 * d }, { label: 'Q2 vs Q1', color: theme.accent, points: sz5.Q2 || [], dot: 3 * d, width: 1.5 * d }, { label: listLabel, color: theme.fall, points: ls, whiskers: true, dot: 4 * d, width: 2 * d }],
      { xDomain: [2019, 2024], yDomain: [0.3, 5], yTicks: [0.5, 1, 2, 4], theme, size: sz, thinTicks: true, spreadLabels: true, pad, endGap });
    if (!big && pop.id === 'odds') drawOdds('pochart');
  }
  // ---- the pop-out (round 15, the author's item 5.4 and its revision of 26 October 2026) -------------------------------------------------------------------
  // A click on one of the column's three charts enlarges it over the map, always at the map's lower right, 12 px above the scale bar and the zoom box so the
  // controls stay in reach; its border rests in a dark green and lights to the card's green under the pointer, its title green throughout. A click on the
  // enlarged chart, a second click on the card's chart or Escape puts it back; opening another chart replaces it. Not on the phone layout, where the cards stack
  // under the map and the chart already spans the screen. No dragging, no connector.
  const pop = { id: null, cursor: null };   // cursor: the last unit the Under the cursor chart drew, which its pop-out keeps (round 17)
  const POP_CHART = Object.fromEntries(CARD_LIST.filter(c => c.pop).map(c => [c.id, c.chart])), POP_DRAW = Object.fromEntries(CARD_LIST.filter(c => c.pop).map(c => [c.id, c.pop]));   // from the card list (round 18; the Under the cursor chart since round 17, while LAYER and GO TO have none)
  const popAllowed = () => window.matchMedia('(min-width: 901px)').matches;
  function placePopout() {
    const el = $('popout'); if (!pop.id) { el.hidden = true; dropObstacles(); return; }
    const m = wrap.getBoundingClientRect(), W = Math.round(Math.min(640, Math.max(360, 0.6 * m.width)));
    const canvasH = Math.round(Math.min(360, Math.max(200, 0.5 * m.height))); el.style.width = W + 'px'; $('pochart').style.height = canvasH + 'px';
    el.hidden = false; const H = el.getBoundingClientRect().height;
    const ctrl = ['zoombox', 'scalebar'].map(id => $(id)).filter(e => e && getComputedStyle(e).display !== 'none').map(e => e.getBoundingClientRect().top - m.top);
    const floor = (ctrl.length ? Math.min(...ctrl) : m.height - 12 - (stripOpen() ? 34 : 0)) - 12;
    el.style.top = Math.round(Math.max(12, floor - H)) + 'px'; dropObstacles();   // round 17: the tile keeps clear of an open pop-out, which the Under the cursor chart invites the reader to hover past
  }
  function openPop(id) {
    if (pop.id === id || !id || !popAllowed()) { closePop(); return; }
    const prev = pop.id; pop.id = id; if (prev) $(POP_CHART[prev]).classList.remove('out'); $(POP_CHART[id]).classList.add('out');
    $('potitle').textContent = $('h2-' + id).textContent; $('popout').setAttribute('aria-label', $('h2-' + id).textContent);
    const el = $('popout'); if (!prev && !reduceMotion()) { el.classList.add('in'); requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('in'))); }
    placePopout(); POP_DRAW[id]('pochart');
  }
  function closePop() { if (!pop.id) return; $(POP_CHART[pop.id]).classList.remove('out'); pop.id = null; placePopout(); }
  for (const [id, cid] of Object.entries(POP_CHART)) { const c = $(cid); c.tabIndex = 0; c.setAttribute('role', 'button'); c.addEventListener('click', () => openPop(id)); c.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPop(id); } }); }
  $('popout').addEventListener('click', closePop);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && pop.id && !refsIsOpen() && !(e.target && e.target.closest && e.target.closest('input'))) closePop(); });
  document.querySelector('.side').addEventListener('scroll', () => { if (pop.id) placePopout(); }, { passive: true });
  window.addEventListener('scroll', () => { if (pop.id) placePopout(); }, { passive: true });
  function redrawAll() { sizeCanvases(); drawMap(); drawCellPanel(state.hover); if (pop.id && (!popAllowed() || !cardOpen(pop.id))) closePop(); redrawCharts(); if (pop.id) placePopout(); syncZoomButtons(); }

  // ---- controls -------------------------------------------------------------------------------------
  const layersEl = $('layers');
  // Firms view provenance (author's wording standard, 24 October 2026): the geocode categories defined once, the shared-registration text verbatim.
  const FIRMS_PROV = 'Firms view: every located eligible firm on no list (comparison group) with a house- or street-level geocode, drawn at its registered address and grouped by coordinate pair (M9 pass over the foundation registry and payload, one record per coordinate pair and year). Firms on at least one of the five lists (treated) come from the national pass (M8), red from the year they were added to a list. Firms on the five lists are named from the list files (the decree and government strategic workbooks’ name columns, then the sanctions file’s name field): one display name per firm, the core name with its legal form abbreviated after a comma, in Latin script (the sanctions file’s Latin alias that transliterates the filed name, else a BGN/PCGN transliteration marked as such, else the Latin name as filed), cut at 60 characters. The full filed name is shown in the Under the cursor panel. Firms on no list are never named. Other geocodes, coordinates without a verified house or street match, are counted and not drawn. Most located firms have a house- or street-level address match. The remaining geocodes have unverified precision. Registered legal addresses can be shared business centres or addresses rented for registration and correspondence, rather than production premises. Several firms can therefore share one registered address. The Federal Tax Service tracks mass-registration addresses.';
  const syncProv = () => { const Lx = LAYERS.find(x => x.id === state.layer), el = $('layerprov');   // round 16: a layer with a reading text shows it in standard terms
    if (state.mode !== 'firms' && Lx.read) el.innerHTML = Lx.read().map(([t, x]) => `<span class="rb"><span class="h">${esc(t)}</span> ${esc(x)}</span>`).join(''); else el.textContent = state.mode === 'firms' ? FIRMS_PROV : Lx.prov;
    for (const e of layersEl.querySelectorAll('.fmark')) e.style.display = state.mode === 'firms' ? '' : 'none'; };
  LAYERS.forEach(L => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.textContent = L.label; b.dataset.id = L.id; b.setAttribute('aria-pressed', String(L.id === state.layer)); b.addEventListener('click', () => { if (blinkState.on) blinkStop(); if (runState.on) runEnd(); state.layer = L.id; endCellPulse(); queueMicrotask(writeHash); layersEl.querySelectorAll('button[data-id]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.id === L.id))); syncYearRow(); syncPulseButton(); syncProv(); drawMap(); drawNational(); syncMix(); updateContext(true); }); layersEl.appendChild(b); });
  // The LAYER card's groups (round 15, the author's choice of 27 October 2026: C, revised): each name at the left of its buttons, as VIEW is
  { const GROUPS = GROUP_ORDER.map(g => [g, LAYERS.filter(L => L.group === g).map(L => L.id)]), by = id => layersEl.querySelector('.btn[data-id="' + id + '"]'), loose = [...layersEl.querySelectorAll('.btn')];
    for (const [name, ids] of GROUPS) { const bs = ids.map(by).filter(Boolean); if (!bs.length) continue; const lab = document.createElement('span'); lab.className = 'glabel'; lab.textContent = name; lab.style.gridRow = 'span ' + bs.length; layersEl.appendChild(lab); bs.forEach(b => layersEl.appendChild(b)); }
    loose.filter(b => !GROUPS.some(g => g[1].includes(b.dataset.id))).forEach(b => layersEl.appendChild(b)); }   // a layer in no group keeps the buttons' column, after the groups
  { const lab = document.createElement('span'), b = document.createElement('button'); lab.className = 'glabel fmark'; lab.textContent = 'Marks';   // the Firms view's toggle (round 16)
    b.type = 'button'; b.className = 'btn fmark'; b.id = 'markshared'; b.textContent = 'Pairs shared by 100+'; b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => { markShared = !markShared; b.setAttribute('aria-pressed', String(markShared)); layersDirty(); drawMap(); refreshHover(); });
    layersEl.appendChild(lab); layersEl.appendChild(b); }
  function syncYearRow() { $('yearrow').hidden = !(state.mode === 'firms' || layerOf(state.layer).year == null); }   // the slider's layers, from their facts (round 18)
  $('pulse').addEventListener('click', () => replayPulse());
  // The view switch (round 5): cells as before, or every registered address as a mark.
  const modesEl = $('modes');
  if (FIRMS_OK) {
    const lab = document.createElement('span'); lab.className = 'modelabel'; lab.textContent = 'View'; modesEl.appendChild(lab);
    [['cells', 'Cells'], ['firms', 'Firms']].forEach(([m, label]) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.textContent = label; b.dataset.mode = m; b.setAttribute('aria-pressed', String(m === state.mode)); b.addEventListener('click', () => { if (state.mode === m) return; if (blinkState.on) blinkStop(); if (runState.on) runEnd(); state.mode = m; endPulse(); endCellPulse(); if (!finding) endFound(); queueMicrotask(writeHash); if (m === 'firms') maybeSweep(); syncProv(); modesEl.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.mode === m))); hideHover(); syncYearRow(); syncPulseButton(); drawMap(); countFirmsInView(); syncMix(); drawCellPanel(null); updateContext(true); }); modesEl.appendChild(b); });
  } else modesEl.hidden = true;
  syncProv(); syncYearRow(); syncYearPos();
  function syncYearPos() { const e = $('year'), p = (+e.value - +e.min) / (+e.max - +e.min); $('yearslider').style.setProperty('--pct', p.toFixed(4)); }   // the slider's fill and the mark's place follow the value (round 10, the author's correction of 25 October)
  $('year').addEventListener('input', () => { syncYearPos(); queueMicrotask(writeHash); const prev = state.year; state.year = +$('year').value; $('yearlabel').textContent = state.year + (state.year === 2025 ? '*' : ''); if (state.mode === 'firms') { startPulse(prev, state.year); if (state.year !== prev) fieldAnim.dissolve = { t0: null }; } else endCellPulse(); syncPulseButton(); drawMap(); countFirmsInView(); if (blinkState.on) blinkStop(true); drawNational(); syncMix(); updateContext(true); if (!wireHold) { const [b, n] = bandUnderCamera(); rebuildWire(b, n, 'year'); } });
  // ---- the author's three extras (round 15, item 7; each labelled optional in the review) ----------------------------------------
  // 7A, the blink comparator: hold B, or press BLINK, and the map alternates once a second between 2021, the chapter's base year, and the year shown (2024 when 2021 is
  // shown), so the places where statements stopped appearing flicker; the year value, the legend, the tile and the slot name the year on screen at every swap, while
  // the slider, the wire and the charts hold until it stops. Under reduced motion the other year holds while B or the button is down, with no blinking. The button's
  // tooltip is the quotation the author chose on 26 October 2026, without a citation; its accessible label says what the button does.
  const blinkOther = y => (y === 2021 ? 2024 : 2021);
  function showYear(y) {   // the map in year y without moving the slider
    if (state.year === y) return; state.year = y; $('yearlabel').textContent = y + (y === 2025 ? '*' : '');
    if (state.mode === 'firms') { endPulse(); fieldAnim.dissolve = { t0: null }; } else endCellPulse();
    drawMap(); refreshHover(); updateContext(true);
  }
  function blinkStart(held) {
    if (blinkState.on || $('yearrow').hidden) return; if (runState.on) runEnd();   // only where the year row shows: the other layers have a fixed year
    blinkState.on = true; blinkState.held = !!held; blinkState.base = state.year; blinkState.alt = blinkOther(state.year); wireHold = true; syncYearLine2();
    const go = () => { if (!blinkState.on) return; if (reduceMotion()) { showYear(blinkState.alt); return; }
      const tick = () => { if (!blinkState.on) return; showYear(state.year === blinkState.base ? blinkState.alt : blinkState.base); blinkState.timer = setTimeout(tick, 1000); }; tick(); };
    if (FIRMS_OK) Promise.race([ensureYear(blinkState.alt).catch(() => null), new Promise(r => setTimeout(r, 3000))]).then(go); else go();   // the other year's addresses loaded first, so the first swap never shows an empty field
  }
  function blinkStop(keepYear) {
    if (!blinkState.on) return; blinkState.on = false; clearTimeout(blinkState.timer); blinkState.timer = 0;
    if (!keepYear) showYear(blinkState.base); wireHold = false; syncYearLine2();
  }
  // 7B, the year run: a play button by YEAR runs the years from 2014 (or from the year shown, after a pause) to 2025, one a second, through the slider, so every year
  // change is the ordinary one (the Firms view's pulse for each forward year, the dissolve, the charts' year line); the wire holds and rebuilds once, at the end or the pause.
  function setYear(y) { const yEl = $('year'); yEl.value = String(y); yEl.dispatchEvent(new Event('input')); }
  function runStart() {
    if (runState.on) return; blinkStop();
    runState.on = true; wireHold = true; syncYearLine2();
    if (+$('year').value >= 2025) setYear(2014);
    runState.timer = setTimeout(runStep, 1000);
  }
  function runStep() {
    runState.timer = 0; if (!runState.on) return; const y = +$('year').value; if (y >= 2025) { runEnd(); return; }
    const next = y + 1, go = () => { if (!runState.on) return; setYear(next); runState.timer = setTimeout(runStep, 1000); };
    if (FIRMS_OK && state.mode === 'firms') ensureYear(next).then(go, go); else go();
  }
  function runEnd() {
    if (!runState.on) return; runState.on = false; if (runState.timer) clearTimeout(runState.timer); runState.timer = 0;
    wireHold = false; syncYearLine2(); { const [b, n] = bandUnderCamera(); rebuildWire(b, n, 'year'); }
  }
  function syncYearLine2() {
    const run = $('yearrun'), bl = $('blink'); run.hidden = false; bl.hidden = false;
    run.setAttribute('aria-pressed', String(runState.on)); { const t = runState.on ? 'Pause the run of the years' : 'Run the years from 2014 to 2025, one a second'; run.setAttribute('aria-label', t); run.title = t.toUpperCase(); }
    bl.setAttribute('aria-pressed', String(blinkState.on)); bl.querySelector('.by').textContent = String(blinkOther(blinkState.on ? blinkState.base : state.year));
    bl.setAttribute('aria-label', `Blink the map between ${blinkOther(blinkState.on ? blinkState.base : state.year)} and the year shown (hold B)`); bl.title = 'We’re eyeball to eyeball, and I think the other fellow just blinked';
    $('yline2').hidden = ![...$('yline2').children].some(el => !el.hidden);
  }
  $('yearrun').addEventListener('click', () => { if (runState.on) runEnd(); else runStart(); });
  $('blink').addEventListener('click', () => { if (blinkState.on) blinkStop(); else blinkStart(false); });
  document.addEventListener('keydown', e => {
    const t = e.target; if (e.ctrlKey || e.metaKey || e.altKey || refsIsOpen() || (t && t.closest && t.closest('input, textarea, select, [contenteditable]'))) return;   // the REFERENCES panel holds the page's keys (round 16)
    const k = (e.key || '').toLowerCase();
    if (k === 'b' && !e.repeat && !blinkState.on) { blinkStart(true); return; }
    // 7C, the cat key: c-a-t typed anywhere outside a field puts the next cat fact on the wire just past the items in view (folklore; the wire checker knows these items by their source tag)
    if (k.length === 1 && !e.repeat) { catKey.buf = (catKey.buf + k).slice(-3); if (catKey.buf === 'cat') { catKey.buf = ''; wireCatNow(); } }
  });
  document.addEventListener('keyup', e => { if ((e.key || '').toLowerCase() === 'b' && blinkState.on && blinkState.held) blinkStop(); });
  window.addEventListener('blur', () => { if (blinkState.on && blinkState.held) blinkStop(); });
  function wireCatNow() {
    if (!OFFWIRE || !OFFWIRE.facts || !OFFWIRE.facts.length || !wireScrolls() || !stripOpen() || !wireState.sets.length) return false;
    const ws = wireState, tr = wireTrack(), x = wireX(), right = x + wireVisW(); let target = null, owner = null, idx = -1;
    for (const set of ws.sets) { for (let i = 0; i < set.els.length; i += 2) { if (wirePos(set.els[i])[0] > right) { target = set.els[i]; owner = set; idx = i; break; } } if (target) break; }
    const f = OFFWIRE.facts[catKey.next++ % OFFWIRE.facts.length];
    const sp = document.createElement('span'); sp.className = 'wi cat keyed'; sp.dataset.src = 'offwire-key:' + f.id; sp.innerHTML = `<span class="cf">${esc(f.text)}</span>`;
    const hold = document.createElement('span'); hold.innerHTML = SEP; const sep = hold.firstChild;
    const cur = wireX();   // the fact goes in past the visible items, so the scroll runs on (round 16)
    if (target) { catSep(target.previousElementSibling); tr.insertBefore(sp, target); tr.insertBefore(sep, target); owner.els.splice(idx, 0, sp, sep); }
    else { const last = ws.sets[ws.sets.length - 1]; catSep(tr.lastElementChild); tr.appendChild(sp); tr.appendChild(sep); last.els.push(sp, sep); }
    wireRun(cur); return true;
  }

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
  for (const city of bmp.cities) addPreset(city.label, () => goToTarget(city));
  addPreset('Central Moscow (250 m)', () => { const c = bmp.cities[0]; return fineTarget(c.x + 1.5, c.y + 0.5); }); PRESETS[PRESETS.length - 1].button.classList.add('keep');   // the one button that stays under the minimap (round 10)

  // ---- the minimap (round 10, the author's item 12; the GO TO card's ice-blue neutral, item 21) ---------------------------------------------------
  // A 376 by 232 viewBox: the national extent in a 272 by 154 box at the right (0.033397 px per km), a 100 px label column at the left and a 56 px band
  // below. The outline is the basemap's land traced at 0.03 px per km (every component of four pixels or more; the mainland first) and simplified; the
  // graticule is the basemap's own polylines clipped to the box. Each city is a focusable group (dot, leader, label box); the layout table below places
  // the boxes by hand against the rules the audit checks (no box meets another box or a dot within 2 px, no leader crosses another, none passes within
  // 4 px of another city's dot or through another box, every box inside the viewBox). Clicking a city flies to its preset; the frame fits the country.
  const MM_W = 376, MM_H = 196, MM_X0 = 104, MM_Y0 = 10, MM_S = 272 / SPAN_X, MM_BOX_H = 12, MM_PAD = 4, MM_R = 3;
  const mmX = x => MM_X0 + (x - BM.extents.national.x[0]) * MM_S, mmY = y => MM_Y0 + (BM.extents.national.y[1] - y) * MM_S;
  // Round 16 (the author's item of 27 October 2026, picked as 1.1 times the same day): the viewBox is cropped to its right 376/1.1 units (the author's
  // method), so the drawing keeps its units and scales about its top-right corner: the labels and their boxes, the dots, the leaders and the corner marks grow
  // with the map by the same factor, and the card grows taller by it. The labels the cropped column no longer holds are placed by hand (MM_LAYOUT_F), and
  // minimapCheck() tests the layout against the left edge that still shows (MM_VX0); the card's graticule follows the crop. 1.12 leaves Rostov-on-Don no room
  // (its box would meet Voronezh's leader), and 1.25 would need the Siberian labels moved or a label row added.
  const MM_F = 1.1, MM_VX0 = MM_W * (1 - 1 / MM_F);
  const MM_LAYOUT_F = { 'Kaliningrad': ['X', 116, 0], 'St Petersburg': ['X', 202, 0], 'Moscow': ['L', 22], 'Kazan': ['L', 50], 'Voronezh': ['L', 64], 'Rostov-on-Don': ['L', 87.5], 'Krasnodar': ['L', 102], 'Volgograd': ['L', 116], 'Samara': ['L', 130], 'Ufa': ['L', 144], 'Khabarovsk': ['X', 302.5, 94] };   // the hand placements (27 October 2026): the two northern labels over the Baltic and the Barents, three raised; every other label keeps MM_LAYOUT's entry. Round 29 (30 October 2026): Rostov-on-Don back in the column under a short label, since its full name's box had covered Crimea and no placement of it clears both the land and the layout rules, and Khabarovsk above its dot, off Sakhalin; then (the author's pick A) ROSTOV lowered and the four labels below it 4 units down, so Rostov-on-Don's leader passes south of Crimea instead of across it
  const MM_SHORT = { 'Rostov-on-Don': 'Rostov' };   // round 29: the minimap's label where the full name has no room (the group's title and the button keep the full name)
  let mmTry = null;   // a trial layout from the audit hook (minimapTry), over MM_LAYOUT_F's
  const MM_TRACE = [0.06, 16]; let mmTrace = null;   // the land's trace: px per km and the smallest component kept, in px (a trial from minimapTry's second argument). Round 29 (the author's pick A, 30 October 2026): 0.06, twice round 10's 0.03, so a small shape such as Crimea keeps about four-fifths of its area and the coasts step half as far; 16 px keeps round 10's smallest component, 4,444 km2
  const MM_LAYOUT = {   // ['L', top]: the left column, the box's right edge at x 98; ['X', left, top]: the box's left edge and top; ['R', right, top]: the box's right edge and top
    'St Petersburg': ['L', 0], 'Kaliningrad': ['L', 14], 'Moscow': ['L', 42], 'Kazan': ['L', 56], 'Voronezh': ['L', 70], 'Rostov-on-Don': ['L', 84], 'Krasnodar': ['L', 98], 'Volgograd': ['L', 112], 'Samara': ['L', 126], 'Ufa': ['L', 140],
    'Murmansk': ['X', 190, 25], 'Nizhny Novgorod': ['X', 158, 60], 'Perm': ['X', 161, 74], 'Yekaterinburg': ['X', 196, 80], 'Tyumen': ['X', 196, 97], 'Krasnoyarsk': ['X', 206, 111], 'Omsk': ['X', 178, 127], 'Novosibirsk': ['X', 182, 141], 'Irkutsk': ['X', 272, 137], 'Khabarovsk': ['R', 372, 117],
    'Chelyabinsk': ['X', 100, 182], 'Vladivostok': ['R', 372, 182] };   // the column holds the west and the Volga, the north-east the Urals and Siberia, the band two
  // The graticule in the basemap's projection (spherical Lambert azimuthal equal-area at 60 N, 100 E, as data/basemap.json and the M passes), at the basemap's
  // spacing: meridians every 20 degrees, parallels every 10, from 50 S (the lines stop short of the antipode) to the pole. Polylines in km, made once.
  const GRAT_KM = (() => {
    const R = 6371, f0 = Math.PI / 3, rad = Math.PI / 180, lines = [];
    const pr = (lon, lat) => { const ph = lat * rad, dl = (((lon - 100) % 360 + 540) % 360 - 180) * rad, den = 1 + Math.sin(f0) * Math.sin(ph) + Math.cos(f0) * Math.cos(ph) * Math.cos(dl); if (den < 0.05) return null; const k = Math.sqrt(2 / den); return [R * k * Math.cos(ph) * Math.sin(dl), R * k * (Math.cos(f0) * Math.sin(ph) - Math.sin(f0) * Math.cos(ph) * Math.cos(dl))]; };
    const add = pts => { let cur = []; for (const q of pts) { if (q) cur.push(q); else if (cur.length) { if (cur.length > 1) lines.push(cur); cur = []; } } if (cur.length > 1) lines.push(cur); };
    for (let lon = 0; lon < 360; lon += 20) { const pts = []; for (let lat = -50; lat <= 90; lat += 1) pts.push(pr(lon, lat)); add(pts); }
    for (let lat = -50; lat <= 80; lat += 10) { const pts = []; for (let lon = 0; lon <= 360; lon += 2) pts.push(pr(lon, lat)); add(pts); }
    return lines;
  })();
  // Across the GO TO card (round 15, item 14A revised): the lines behind every control, placed from the minimap's own scale and offset so they meet the minimap's
  // Russia exactly; redrawn when the card or the minimap changes size; nothing where the minimap is not shown (900 px and under).
  function drawCardGraticule() {
    const g = $('gotograt'), mm = $('minimap'), card = $('card-goto'); if (!g || !mm || !card) return;
    const cr = card.getBoundingClientRect(), r = mm.getBoundingClientRect();
    if (getComputedStyle(mm).display === 'none' || r.width < 10 || cr.width < 10) { g.innerHTML = ''; return; }
    const sc = r.width / (MM_W - MM_VX0), ox = r.left - cr.left - card.clientLeft - MM_VX0 * sc, oy = r.top - cr.top - card.clientTop + 2 * sc, W = card.clientWidth, H = card.clientHeight;   // round 16: the cropped viewBox's width and left edge   // the card's inner box, where the absolutely placed lines start (round 16: the outer width ran the lines 3 px past the border, and the side column scrolled sideways)
    g.setAttribute('viewBox', `0 0 ${W} ${H}`); g.setAttribute('width', W); g.setAttribute('height', H);
    let d = ''; for (const l of GRAT_KM) { let seg = ''; for (const [x, y] of l) { const px = ox + mmX(x) * sc, py = oy + mmY(y) * sc; seg += (seg ? 'L' : 'M') + px.toFixed(1) + ' ' + py.toFixed(1); } d += seg; }
    g.innerHTML = `<path d="${d}"/>`;
  }
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
    svg.setAttribute('viewBox', `${+MM_VX0.toFixed(3)} -2 ${+(MM_W - MM_VX0).toFixed(3)} ${MM_H + 2}`);   // round 15 (the author's item 5.3): the empty band under the lowest labels trimmed, the drawing centred with 2 units above and below; round 16: cropped to the size's right 376/f units
    const NS = 'http://www.w3.org/2000/svg', el = (t, at, parent) => { const e = document.createElementNS(NS, t); for (const [k, v] of Object.entries(at || {})) e.setAttribute(k, String(v)); (parent || svg).appendChild(e); return e; };
    MMAP = { cities: [], rings: 0, widths: {}, builds: ++mmBuilds };
    const defs = el('defs'); el('clipPath', { id: 'mmclip' }, defs); el('rect', { x: MM_X0, y: MM_Y0, width: 272, height: 154 }, defs.firstChild);
    const land = el('g', { class: 'landg', 'clip-path': 'url(#mmclip)' });
    const rings = landRings(...(mmTrace || MM_TRACE)); MMAP.rings = rings.length;
    let d = ''; MMAP.isles = []; for (const ring of rings) { const r = simplify(ring, ring === rings[0] ? 12 : 8); if (r.length < 3) continue; const pts = r.map(([x, y]) => [mmX(x), mmY(y)]); d += 'M' + pts.map(([x, y]) => x.toFixed(1) + ' ' + y.toFixed(1)).join('L') + 'Z';
      if (ring !== rings[0]) MMAP.isles.push({ x: Math.min(...pts.map(q => q[0])), y: Math.min(...pts.map(q => q[1])), x1: Math.max(...pts.map(q => q[0])), y1: Math.max(...pts.map(q => q[1])) }); }   // round 29: every land ring but the mainland, for minimapCheck's box-land rule
    el('path', { class: 'land', d, 'fill-rule': 'evenodd' }, land);
    // The graticule (round 15, the author's item 14A, revised): the basemap's own projection extended across the whole GO TO card (drawCardGraticule), and here
    // the same lines once more over the land, clipped to it, since the land is opaque. Round 10's minimap graticule had never drawn (Float64Array.prototype.map
    // turned every coordinate string into NaN); these lines are generated, not decoded.
    { const clip = el('clipPath', { id: 'mmlandclip' }, defs); el('path', { d, 'clip-rule': 'evenodd' }, clip);
      el('path', { class: 'grat', d: GRAT_KM.map(l => 'M' + l.map(([x, y]) => mmX(x).toFixed(1) + ' ' + mmY(y).toFixed(1)).join('L')).join(''), 'clip-path': 'url(#mmlandclip)' }, land); }
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
      const lay = (mmTry && mmTry[city.label]) || MM_LAYOUT_F[city.label] || MM_LAYOUT[city.label]; if (!lay) continue; const txt = (MM_SHORT[city.label] || city.label).toUpperCase(), w = Math.ceil(measure(txt) + 2 * MM_PAD);
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
    while (svg.firstChild) svg.removeChild(svg.firstChild); svg.classList.remove('drawn'); MMAP = null; buildMinimap(); drawCardGraticule(); return true;
  }
  function minimapCheck() {   // the layout rules, as the audit tests them; returns the violations (empty when clean)
    if (!MMAP) return null; const out = [], C = MMAP.cities, clear = 2, near = 2;   // 2 px between a box and anything, 2 px between a leader and another city's dot edge (5 from its centre)
    const inter = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x, b.x)) > -clear && Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y, b.y)) > -clear && Math.min(a.x1, b.x1) - Math.max(a.x, b.x) > -clear && Math.min(a.y1, b.y1) - Math.max(a.y, b.y) > -clear;
    const boxes = C.map(c => Object.assign({ label: c.label }, c.box));   // the 22 city boxes (the Russia label left the frame on 25 October 2026)
    for (const b of boxes) if (b.x < MM_VX0 || b.y < 0 || b.x1 > MM_W || b.y1 > MM_H) out.push(['outside', b.label]);   // round 16: the left edge that shows at the size
    { const X1 = MM_X0 + 272, Y1 = MM_Y0 + 154, A = 10, arms = [[MM_X0, MM_Y0, MM_X0 + A, MM_Y0 + A], [X1 - A, MM_Y0, X1, MM_Y0 + A], [X1 - A, Y1 - A, X1, Y1], [MM_X0, Y1 - A, MM_X0 + A, Y1]];   // round 16: no box on a corner mark
      for (const b of boxes) for (const [x0, y0, x1, y1] of arms) if (inter(b, { x: x0, y: y0, x1, y1 })) out.push(['box-frame', b.label]); }
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
    for (const b of boxes) for (const s of MMAP.isles || []) if (inter(b, s)) out.push(['box-land', b.label]);   // round 29: no box over land apart from the mainland (Crimea had lain under Rostov-on-Don's box, part of Sakhalin under Khabarovsk's)
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
  // meaning. Off the lab's machine the GO TO card's link button copies the atlas's address on the author's site with the view appended (28 October 2026; the claude.ai
  // artifact's address before), so a link copied on the artifact or on the site opens the site. Hosts pass on only an anchor of letters, digits and . _ ~ - (the first
  // build's #firms/fin/2022/55.75411,37.61358/47.5km never reached the page on claude.ai; it still parses).
  const SITE_URL = 'https://armenkaprelian.github.io/', ATLAS_URL = SITE_URL + 'atlas/';   // the author's site and the atlas on it: every link the page hands out names them
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
  const viewLink = () => (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || location.protocol === 'file:' ? location.href.split('#')[0] : ATLAS_URL) + '#' + viewHash();
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
    findList.innerHTML = findOpen && findItems.length ? findItems.map((i, j) => { const rg = TRN.regions && TRN.reg ? TRN.regions[TRN.reg[i]] : ''; return `<button type="button" tabindex="-1" role="option" class="fo${j === findActive ? ' on' : ''}" id="fo-${j}" data-i="${i}" aria-selected="${j === findActive}">${listedGlyph(i, state.year)}${listedName(i)}<span class="fm">${TRN.undated[i] ? 'undated' : 'on a list from ' + TRN.red_from[i]}${rg ? ' · ' + esc(rg) : ''}</span></button>`; }).join('')
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
  function foundTick() { foundRaf = 0; if (!found) return; if (performance.now() - found.t0 >= BLOOM_MS) found = null; redrawMarksNow(); if (found) foundRaf = requestAnimationFrame(foundTick); }
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
    if (found.static) { redrawMarksNow(); foundTimer = setTimeout(() => { foundTimer = 0; found = null; redrawMarksNow(); }, BLOOM_MS); }
    else foundRaf = requestAnimationFrame(foundTick);
  }
  $('methodintro').textContent = `${fmt.int(F.located_2021)} located eligible firms at ${fmt.int(F.distinct_locations)} distinct coordinate pairs in 2021, 100 km and 25 km cells by year, 1 km squares from the address files by year, and 250 m cells in 22 city windows for 2021. Data: ${F.release} (Bondarkov et al. 2025, CC BY 4.0), ${fmt.int(F.records_total)} annual records for the financial years ${F.years}. Boundaries: geoBoundaries gbOpen (CC BY 4.0) and OpenStreetMap/Wambacher 2017 (ODbL 1.0), © OpenStreetMap contributors. Every figure from the data is a checked aggregate with a provenance record in the lab (motion/data/*.provenance.json). The insights cite their sources under References.`;   // the method block's first lines (round 10): the counts from the former description and the records line from the former footer
  $('methodread').textContent = 'Descriptive associations, not causal effects. Absence from the archive is not withdrawal or concealment. The lists are fixed memberships, not dated designations. Treated: a firm on at least one of the five lists (sanctions, decree, 2020 filing-exemption, government strategic, presidential strategic). The word names the study’s group, not an effect. Comparison group: firms on none of the five lists. Open the atlas at a city by adding its name to the link, as in #Moscow or #St-Petersburg (#Moscow-firms for the Firms view).';   // the former footer's reading notes
  $('footer').innerHTML = `<div class="lic">Data: ${F.release}, CC BY 4.0 · geoBoundaries gbOpen, CC BY 4.0 · OpenStreetMap, ODbL 1.0 · © 2026 Armen G. Kaprelian</div>`;   // one line (round 10): the author line is inserted before it below, the data licences at the right
  // The footer line (round 10, the author's item 16): the name with the mark, the email as selectable text with a copy button (no mail link), the link to the author's site (28 October 2026),
  // two square buttons to the author's X profile and an X share intent with a prepared text; then the licence line (item 17).
  const SHARE_HREF = 'https://x.com/intent/post?text=' + encodeURIComponent('Visibility Atlas: where Russian firms file, and where their statements stop appearing.') + '&url=' + encodeURIComponent(ATLAS_URL) + '&via=ArmenKaprelian';   // the share intent: text, link and handle as separate fields (the round-10 string quoted the call into the address; the author's report of 25 October 2026)
  $('footer').insertAdjacentHTML('afterbegin', `<div class="byfoot"><span><svg class="mk" aria-hidden="true" focusable="false"><use href="#mark"/></svg>Armen G. Kaprelian</span><span>·</span><span><code id="mail">armenkaprelian@gmail.com</code> <button class="btn sq" id="copymail" type="button" aria-label="Copy the email address" title="COPY THE EMAIL ADDRESS"><svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M5 5V3h8v8h-2M3 5h8v8H3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg></button> <button class="btn" id="teachagent" type="button" aria-label="Copy a guide to this atlas for your AI agent" title="COPY A GUIDE TO THIS ATLAS FOR YOUR AI AGENT">Teach your agent</button> <span class="copied" id="copied" aria-live="polite"></span></span><span>·</span><span><a class="site" id="sitelink" href="${SITE_URL}" target="_blank" rel="noopener">armenkaprelian.github.io</a></span><span>·</span><a class="btn sq" href="https://x.com/ArmenKaprelian" target="_blank" rel="noopener" aria-label="Profile on X" title="PROFILE ON X"><svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3 3l10 10M13 3L3 13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></a><a class="btn sq" href="${SHARE_HREF}" target="_blank" rel="noopener" aria-label="Share on X" title="SHARE ON X"><svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3 5l7 7M10 5L3 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M9 3h4v4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></a></div>`);
  // The way home (28 October 2026): the header's lock-up and the footer's site link open the author's site in a new tab, and in this one where the atlas is served from
  // the site's atlas/ folder, whose home is one level up.
  if (/\/atlas\/(index\.html)?$/.test(location.pathname)) for (const a of [$('lockup'), $('sitelink')]) { a.href = '../'; a.removeAttribute('target'); }
  // ---- the REFERENCES panel (round 16, the author's General 7 of 26 October 2026; the picks of 27 October: refA, rxA, raC, rlA, riA, rtA, rfA, rsA, rdB revised) ----
  // A fuchsia button beside LIGHT THEME opens a modal dialog placed over the centred 80 percent of the map's area, the stage made translucent at 98 percent (94 until round 22, 97 in round 22, the author's picks of 29 October 2026; the sea
  // at the same alpha on the light theme), with short entries under prompt-line heads in one scrolling body and a row of shortcuts. DEFINITIONS is the atlas's
  // glossary (data/glossary.js, built by tools/glossary_build.py; the sources of every definition are in its provenance, not on screen). The icon, a Pan Am-style
  // globe whose central meridian is the i's stem, carries the wire's scanlines and glow; the Armenian line takes DejaVu Sans Mono. The dialog is modal, so the
  // page behind is inert. Escape, the close toggle or a press outside close it, focus returns to the button, and the page's own keys stand down while it is open.
  // It opens in 180 ms from its centre line and closes in 140 ms, and under reduced motion it appears and goes at once. Every entry is the atlas's own provenance;
  // the blink's quotation is uncited by the author's choice.
  const REFS_ALPHA = 98, GLOSS = D.glossary || null;
  const refsIsOpen = () => { const d = $('refs'); return !!(d && d.open); };
  const lnk = (url, text) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(text || url)}</a>`;
  const longDate = d => { const m = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(d || ''); if (!m) return d || ''; return [m[3] ? String(+m[3]) : '', m[2] ? MONTHS[+m[2] - 1] : '', m[1]].filter(Boolean).join(' '); };   // 2024-06-12 as 12 June 2024
  function globeIcon() {   // the green i meshed with a wire globe, 40 by 40
    const knock = 'stroke:var(--bar)', ink = 'currentColor';
    const arc = (y, bow) => { const hw = Math.sqrt(17 * 17 - (y - 20) * (y - 20)); return `M${(20 - hw).toFixed(2)} ${y}Q20 ${(y + bow).toFixed(2)} ${(20 + hw).toFixed(2)} ${y}`; };
    const par = [arc(8, -3.6), arc(13.5, -4), 'M3 20H37', arc(26.5, 4), arc(32, 3.6)].join('');
    return `<svg viewBox="0 0 40 40" aria-hidden="true" focusable="false"><g fill="none" stroke="${ink}"><circle cx="20" cy="20" r="17" stroke-width="2"/><path d="${par}" stroke-width="1.5"/></g>`
      + `<path d="M20 16.5V32" style="${knock};stroke-width:7.4"/><circle cx="20" cy="10.8" r="4.3" style="fill:var(--bar)"/>`
      + `<path d="M20 16.5V32" stroke="${ink}" stroke-width="3.6"/><circle cx="20" cy="10.8" r="2.4" fill="${ink}"/></svg>`;
  }
  function refsSections() {   // [id, name, items (HTML)]; every entry from the atlas's own records and the chapter
    const S = [];
    S.push(['data', 'Data', [
      `<b>Russian Financial Statements Database (RFSD)</b>, ${esc(F.release)}, 2 September 2026. Bondarkov, Ledenev and Skougarevskiy (2025), Scientific Data 12, 995, ${lnk('https://doi.org/10.1038/s41597-025-05150-1', 'doi:10.1038/s41597-025-05150-1')}. Dataset: ${lnk('https://doi.org/10.5281/zenodo.22257046', 'doi:10.5281/zenodo.22257046')}. CC BY 4.0.`,
      `<b>The five lists</b>: the sanctions list, the decree list, the 2020 filing-exemption list (Government Decree No. 35 of 22 January 2020), the government strategic list and the presidential strategic list, provided on request by the RFSD's authors, as in the chapter.`,
      `<b>Region boundaries</b>: geoBoundaries gbOpen, Russia ADM1 and Ukraine ADM1 (two regions), cut to the coast with Natural Earth 1:10m land (public domain). Runfola et al. (2020), PLOS ONE 15(4), e0231866, ${lnk('https://doi.org/10.1371/journal.pone.0231866', 'doi:10.1371/journal.pone.0231866')}. CC BY 4.0. From OpenStreetMap through Wambacher (2017), © OpenStreetMap contributors (${lnk('https://www.openstreetmap.org/copyright', 'openstreetmap.org/copyright')}), ${lnk('https://opendatacommons.org/licenses/odbl/1-0/', 'ODbL 1.0')}.`,
      `<b>GDP deflator</b>: World Bank, NY.GDP.DEFL.ZS.AD (GDP deflator: linked series), Russian Federation, rebased to 2021, ${lnk('https://data.worldbank.org/indicator/NY.GDP.DEFL.ZS.AD', 'data.worldbank.org')}. CC BY 4.0.`,
      `<b>Industry classes</b>: OKVED 2, identical to NACE Rev. 2 at two digits (Eurostat's codelist, reuse under Commission Decision 2011/833/EU). <b>Ownership and legal form</b>: OKFS and OKOPF, grouped as the chapter groups them.`]]);
    if (GLOSS && GLOSS.terms) S.push(['definitions', 'Definitions', GLOSS.terms.map(t => `<b>${esc(t.term)}</b>: ${esc(t.text)}`)]);   // the glossary (the author's pick of 27 October 2026)
    S.push(['methods', 'Methods', [
      `<b>The chapter</b>: Armen G. Kaprelian, Opacity and Adaptation under Sanctions: Geoeconomics in the Universe of Russian Firms, PhD dissertation, Claremont Graduate University, chapter 2.`,
      `<b>Its tables and figures behind the panels</b>: Table B.1 (availability), Figures 2.2 and 2.3 (groups), Figure 2.5 and Tables B.4 and B.5 (adjusted odds ratios), Table B.7 (the lists), Figure 2.7 (the eligible map) and Figure 2.8 (cohort inclusion).`,
      `<b>Models</b>: binary logits with industry, region, legal-form and ownership fixed effects, standard errors two-way clustered by industry and region. Descriptive and conditional associations, not effects.`]]);
    if (INS) {   // the profiles' sources (round 16): publisher, document type and date with the link, never a title
      const items = []; for (const [kind, set] of [['region', INS.regions || {}], ['window', INS.cities || {}]]) for (const [u, v] of Object.entries(set)) {
        const src = (v.sources || []).map(x => { const t = [x.publisher, x.type, longDate(x.date)].filter(Boolean).join(', '); return x.url ? lnk(x.url, t) : esc(t); }).join(' · ');   // the citation is the link's text
        if (src) items.push(`<b>${esc(u.toUpperCase())}</b>${kind === 'window' ? ' window' : ''}: ${src}`); }
      if (items.length) S.push(['insights', 'Insights', items]);
    }
    S.push(['type', 'Type and software', [
      `<b>IBM Plex Mono</b> (IBM) and <b>Tomorrow</b>, SIL Open Font License 1.1, from Google Fonts.`,
      `<b>DejaVu Sans Mono</b>, Bitstream Vera licence with DejaVu's changes in the public domain, for the Armenian letters.`,
      `<b>The data passes</b>: R 4.5.2 and DuckDB 1.5.6, with Python 3 for the shared pairs, the insights and the definitions. The page draws with the browser's canvas and WebGL and loads no outside library.`]]);
    S.push(['links', 'Links', [
      `<b>EMAIL</b> armenkaprelian@gmail.com <button class="btn sq" type="button" id="refscopy" aria-label="Copy the email address" title="COPY THE EMAIL ADDRESS"><svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M5 5V3h8v8h-2M3 5h8v8H3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg></button><span class="copied" id="refscopied" hidden>&gt;text copied</span>`,
      `<b>WEBSITE</b> ${lnk(SITE_URL, 'armenkaprelian.github.io')}`,
      `<b>X</b> ${lnk('https://x.com/ArmenKaprelian', 'x.com/ArmenKaprelian')}`,
      `<b>SHARE ON X</b> ${lnk(SHARE_HREF, 'x.com/intent/post')}`,
      `<b>VIDEO</b> James K. Galbraith, ${lnk('https://www.youtube.com/watch?v=y4T5gmAndFk', '“Sanctions: To Russia with Love”')}, Institute for New Economic Thinking, 2024`]]);
    return S;
  }
  function refsFill() {
    const body = $('refsbody'), nav = $('refsnav'), su = $('refs-superuser');
    for (const el of [...body.querySelectorAll('section[data-gen]')]) el.remove();
    const S = refsSections();
    for (const [id, name, items] of S) { const sec = document.createElement('section'); sec.id = 'refs-' + id; sec.dataset.gen = '1'; sec.dataset.name = name; sec.innerHTML = `<h3>${esc(name)}</h3><ul>${items.map(t => `<li>${t}</li>`).join('')}</ul>`; body.insertBefore(sec, su); }
    nav.innerHTML = '';
    for (const sec of body.querySelectorAll('section')) { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.textContent = sec.dataset.name; b.dataset.target = sec.id;
      b.addEventListener('click', () => refsShow(sec.id)); nav.appendChild(b); }
    const cp = $('refscopy'); if (cp) cp.addEventListener('click', async () => { try { await navigator.clipboard.writeText('armenkaprelian@gmail.com'); const t = $('refscopied'); t.hidden = false; setTimeout(() => { t.hidden = true; }, 1600); } catch (e) {} });
  }
  function refsShow(id) {   // a shortcut scrolls its section to the top of the body
    const body = $('refsbody'); if (id) { const sec = $(id); body.scrollTop = sec.offsetTop - body.offsetTop - 2; }
  }
  function refsPlace() {   // the centred 80 percent of the map's area (each side about 89 percent); the viewport less 16 px on a phone
    const d = $('refs'); if (!d.open) return;
    let x, y, w, h;
    if (innerWidth <= 900) { x = 16; y = 16; w = innerWidth - 32; h = innerHeight - 32; }
    else {
      const r = wrap.getBoundingClientRect(), k = Math.sqrt(0.8); w = r.width * k; h = r.height * k; x = r.left + (r.width - w) / 2; y = r.top + (r.height - h) / 2;
    }
    Object.assign(d.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
  }
  function refsOpen() {
    const d = $('refs'); if (!d || d.open) return;
    refsFill(); d.showModal(); refsPlace(); $('refsbtn').classList.add('on'); $('refsbtn').setAttribute('aria-expanded', 'true');   // the button shows the pressed state while the panel is open (the author's request of 27 October 2026)
    if (!reduceMotion()) { d.classList.add('anim', 'shut'); requestAnimationFrame(() => requestAnimationFrame(() => d.classList.remove('shut'))); }
    $('refstitle').focus({ preventScroll: true });
  }
  function refsClose() {
    const d = $('refs'); if (!d || !d.open || d.classList.contains('closing')) return;
    const done = () => { d.classList.remove('closing', 'shut'); if (d.open) d.close(); const b = $('refsbtn'); if (b) b.focus({ preventScroll: true }); };
    if (reduceMotion()) { done(); return; }
    d.classList.add('closing', 'shut'); setTimeout(done, 150);
  }
  { const d = $('refs'), b = $('refsbtn');
    if (d && b) {
      d.style.setProperty('--refs-alpha', REFS_ALPHA + '%');   // both themes: on the light theme 88 percent had let the links fall to 4.2 to 1 over the darkest marks behind
      $('refsicon').innerHTML = globeIcon();
      { const n = $('superusernote'); if (n) n.textContent = n.textContent.replace(/^\s*\n/, '').replace(/\n\s*$/, ''); }   // the author's note as written, blank edge lines aside
      b.addEventListener('click', refsOpen); $('refsclose').addEventListener('click', refsClose);
      d.addEventListener('cancel', e => { e.preventDefault(); refsClose(); });   // Escape
      d.addEventListener('close', () => { b.classList.remove('on'); b.setAttribute('aria-expanded', 'false'); });   // however the panel closes, the button returns to its resting state
      d.addEventListener('click', e => { if (e.target !== d) return; const r = d.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) refsClose(); });   // a press on the backdrop
      window.addEventListener('resize', refsPlace);
    } }
  // The method block (round 10): the i button opens it, More expands it, both remembered per viewer.
  const methodOpen = () => ui.method === 'open', methodMore = () => ui.methodMore === 'open';   // the More state is stored as open or closed, the values readPref accepts
  ui.method = readPref('atlas-method') || 'closed'; ui.methodMore = readPref('atlas-method-more') || 'closed';
  function applyMethod() { const open = methodOpen(), more = methodMore(); $('method').hidden = !open; $('methodbtn').setAttribute('aria-expanded', String(open)); $('methodbtn').setAttribute('aria-label', open ? 'Hide the method' : 'Show the method'); $('methodtext').classList.toggle('clamped', !more); $('methodmore').textContent = more ? 'Less' : 'More'; $('methodmore').setAttribute('aria-expanded', String(more)); }
  $('methodbtn').addEventListener('click', () => { ui.method = methodOpen() ? 'closed' : 'open'; writePref('atlas-method', ui.method); if (ui.method === 'open' && !cardOpen('layer')) { writePref('atlas-card-layer', 'open'); setCard('layer', 'open'); } applyMethod(); });   // the i in the title row since round 15; on a collapsed card it opens the card too
  $('methodmore').addEventListener('click', () => { ui.methodMore = methodMore() ? 'closed' : 'open'; writePref('atlas-method-more', ui.methodMore); applyMethod(); });
  applyMethod();
  // The cards' reading blocks (round 15, the author's rule of 26 October 2026): an i just left of each card's toggle opens a block under the title row with what the card
  // shows, how to read it and what the chapter finds there, written from the chapter's own sentences (chapters/02-opacity/01-introduction.tex and 04-empirical-design.tex);
  // closed by default and remembered per viewer; a press on a collapsed card's i opens the card too. Every figure comes from the shipped data.
  const READS = CARD_LIST.filter(c => c.read).map(c => c.id), readUI = {};   // the cards with a reading block, from the card list (round 18)
  READS.forEach(id => { readUI[id] = readPref('atlas-read-' + id) || 'closed'; });
  function applyReads() { for (const id of READS) { const on = readUI[id] === 'open', b = $('ci-' + id); $('cr-' + id).hidden = !on; b.setAttribute('aria-expanded', String(on)); } }
  READS.forEach(id => $('ci-' + id).addEventListener('click', () => {
    readUI[id] = readUI[id] === 'open' ? 'closed' : 'open'; writePref('atlas-read-' + id, readUI[id]);
    if (readUI[id] === 'open' && !cardOpen(id)) { writePref('atlas-card-' + id, 'open'); setCard(id, 'open'); }
    applyReads(); if (id === 'cursor') drawCellPanel(state.hover); else if (CARD_LIST.find(c => c.id === id).chart) redrawCharts();   // the block moves the chart down: redraw at its new place
  }));
  const P = (...xs) => xs.filter(Boolean).map(x => `<p>${x}</p>`).join(''), H = t => `<span class="h">${esc(t)}</span> `;
  const pct1 = v => fmt.pct(v), ci = (lo, hi) => `95% confidence interval ${fmt.dec(lo, 3)} to ${fmt.dec(hi, 3)}`;
  function fillReads() {
    $('cr-goto').innerHTML = P(H('Mouse') + 'Scroll, or the + and − buttons, to zoom. Drag to pan. A click on a cell flies to it, and Shift+click steps back out.',
      H('Keys, map focused') + '+ and − zoom, 0 fits the country, the arrows pan. Hold B to blink the map between 2021 and the year shown.',
      H('Touch') + 'Drag with one finger, pinch to zoom, tap a cell for its values, double-tap to zoom.',
      'FIND searches the firms on the five lists by name, in Latin or Cyrillic letters. LINK TO CURRENT VIEW copies a link that opens the atlas on the same view.',
      'Region geometry: geoBoundaries gbOpen (CC BY 4.0) and OpenStreetMap/Wambacher 2017 (ODbL).');
    $('cr-cursor').innerHTML = P('The rows describe what lies under the cursor in the view and year shown: a cell, a square, a pixel, a coordinate pair or, on the state-related layer, a region. Every share comes with its count of firms.',
      'The chart: the share of located eligible firms with an original statement in that cell, by financial year (the M5 pass over the registry and the statements). Years with fewer than 50 firms are left out. On the shared-pairs layer it compares the firms at shared pairs with those elsewhere, and the state-related layer has no chart.',
      'Disclosure: in the Cells view a share needs 50 firms, list counts under 5 in a cell are not shown, and counts under 10 in the 250 m city cells and the 5 km density cells are banded. The Firms view and the 1 km squares show exact counts, and the Firms view shows each coordinate pair’s own share.',
      'A firm on the five lists shows its name, the name as filed, the year it was added to a list and its lists. Firms on no list are never named.',
      INS ? 'The profile: one sourced sentence on the region’s or the city’s economy, then the medians of the firms registered in the region, or located in the city’s window, with a statement and a positive value in 2024, in constant 2021 rubles (the GDP deflator), where 50 or more firms.' : '');
    const e21 = S.avail.eligible_share[S.avail.year.indexOf(2021)], e24 = S.avail.eligible_share[S.avail.year.indexOf(2024)];
    // The model outputs' reading blocks (round 15, the author's item 5): what the chart shows, how to read it, what the chapter finds there and how it bears on the
    // chapter's question, in the chapter's own sentences and standard terms.
    $('cr-national').innerHTML = P(H('What it shows') + 'The share of firms with a statement in the RFSD, by financial year, over two populations: the year’s eligible firms and those of them registered at the end of the year (Table B.1).',
      H('Findings') + `${pct1(e21)} of eligible firms have a statement for 2021 and ${pct1(e24)} for 2024. The shaded years are the FNS era, from 2019, and the years before it Rosstat’s. 2011 has no statements, and 2025* is the flagged latest-year extension.`,
      H('The question') + 'The chapter asks whether sanctions increase the value of withholding financial information, and it measures withholding through statement availability. This series is the national level against which the group, size and list comparisons are read. A missing statement is absent from the RFSD release, which does not recover the public archive as it stood in each year.',
      'Source: ' + esc(S.sources.avail) + '.');
    const SS = D.statesplit;   // the state-run row's figures (round 24, M14)
    $('cr-groups').innerHTML = P(H('What it shows') + 'The share of eligible firms with a statement in 2021 and in 2024, by ownership and by legal form. Each year’s population is compared, not the same firms.'
      + ` State-run: state and municipal unitary enterprises, which a federal, regional or municipal body owns outright and which issue no shares. In 2024, ${Math.round(SS.municipal_share[1])} percent of them were municipal.`,
      H('Findings') + `Availability falls among state-related firms (${pct1(F.own.state[0])} to ${pct1(F.own.state[1])}) and rises among private firms and joint-stock companies. The state-run firms are about half of the state-related firms and carry the whole decline (${pct1(SS.state_unitary.share[0])} to ${pct1(SS.state_unitary.share[1])}). The other state-related firms rise (${pct1(SS.state_other.share[0])} to ${pct1(SS.state_other.share[1])}). The declines are concentrated in 2024.`,
      H('The question') + 'These population comparisons carry the chapter’s clearest findings on the sanctions period. Its opacity model organizes them without predicting them, and the ownership codes do not establish operational control or disclosure protection.',
      'Source: the data behind Figures 2.2 and 2.3.');
    const later = (() => { const sc = S.size_changes; for (let i = 0; i < sc.id.length; i++) if (sc.quintile[i] === 'Q5' && /^2023/.test(sc.window[i])) return { r: sc.ratio[i], lo: sc.low[i], hi: sc.high[i] }; return null; })();
    const r22 = `the ratio of odds ratios is ${fmt.dec(F.size_q5_2022_ratio, 3)} (${ci(F.size_q5_2022_low, F.size_q5_2022_high)})`;
    const sizeLine = `The Q5 vs Q1 odds ratio rises in 2022 against 2021: ${r22}.` + (later ? ` The 2023–2024 increase, a ratio of odds ratios of ${fmt.dec(later.r, 3)} (${ci(later.lo, later.hi)}), is smaller when wholesale trade is excluded.` : '');   // P-C, the author's pick (26 October 2026)
    $('cr-odds').innerHTML = P(H('What it shows') + 'Odds ratios from the chapter’s binary logit models with industry, region, legal-form and ownership fixed effects and year effects. A ratio above 1 means higher odds of an available statement than the reference group.',
      H('The lines') + 'Q5 vs Q1 and Q2 vs Q1: the largest and the second asset quintile against the smallest, for a statement in the following year among continuing firms with a statement for the year before (Table B.4). Sanctioned-only firms: firms on the sanctions list and on no other list, against firms on no list (comparison group), for a statement in the year among eligible firms (Table B.7).',
      H('Inference') + 'Whiskers show 95% confidence intervals. Standard errors are two-way clustered by industry and region.',
      H('Findings') + 'Larger asset quintiles have greater conditional availability in both provider eras. ' + sizeLine + ' Sanctioned-only firms have lower availability than firms on no list by 2024.',
      H('The question') + 'The list comparison tests the chapter’s opacity prediction most directly: under its assumptions, firms exposed to sanctions value withholding more. Sanctioned-only firms are less visible than firms on no list by 2024. The size comparison describes financial selection: the largest firms stay visible, and their advantage rises modestly after 2021. These are descriptive and conditional associations.');
    $('mixread').innerHTML = P('The revenue mix of what lies under the cursor, or of the whole view when the cursor is off the map: each division’s share of nominal revenue among firms with a statement and a positive revenue value, eight divisions and then the rest.',
      'The colours are the industry layer’s nine classes. Revenue is counted where firms are registered.');
  }
  // The mix box's two sides (round 15): the i turns it to the sentences on how to read it, as the legend's i does; remembered per viewer.
  const mixRead = { on: readPref('atlas-mix-read') === 'open' };
  function applyMixRead() { const b = $('mixinfo'), label = mixRead.on ? 'Show the revenue mix' : 'Show how to read the revenue mix'; $('mixread').hidden = !mixRead.on; $('mixkey').hidden = mixRead.on; b.setAttribute('aria-pressed', String(mixRead.on)); b.setAttribute('aria-label', label); b.title = label.toUpperCase(); }
  $('mixinfo').addEventListener('click', () => { mixRead.on = !mixRead.on; writePref('atlas-mix-read', mixRead.on ? 'open' : 'closed'); applyMixRead(); });
  fillReads(); applyReads(); applyMixRead();
  // TEACH YOUR AGENT (round 15, the author's item 19 as revised on 26 October 2026): the guide built into the page (js/agent-guide.js) to the clipboard by the
  // email copy's path, then a short notice, ">text copied", in a semi-transparent box above the button; where the clipboard is refused, the guide in a read-only
  // field at the same place, selected. No download, no new window, no request, no data: or blob: URL; Escape or a click elsewhere closes the field.
  { const btn = $('teachagent'), toast = $('agenttoast'), box = $('agentbox'), field = $('agenttext'), url = window.AGENT_GUIDE_URL || ''; let tt = 0;
    if (url) { toast.textContent = '>link copied'; btn.title = 'COPY A LINK TO A GUIDE TO THIS ATLAS FOR YOUR AI AGENT'; btn.setAttribute('aria-label', 'Copy a link to a guide to this atlas for your AI agent'); box.classList.add('url'); field.setAttribute('aria-label', 'A link to the guide to this atlas for your AI agent, selected to copy'); }   // round 17 (the author's request of 27 October 2026): with a link set by tools/agent_guide.py the button copies it, for the reader to paste to their agent; without one, the text as before
    const above = (el, w, h) => { const r = btn.getBoundingClientRect(); el.style.left = Math.round(Math.max(12, Math.min(innerWidth - w - 12, r.left))) + 'px'; el.style.top = Math.round(Math.max(12, r.top - h - 8)) + 'px'; };
    const notice = () => { clearTimeout(tt); toast.classList.remove('out'); toast.hidden = false; above(toast, toast.offsetWidth, toast.offsetHeight); tt = setTimeout(() => { toast.classList.add('out'); tt = setTimeout(() => { toast.hidden = true; toast.classList.remove('out'); }, reduceMotion() ? 0 : 220); }, 1600); };
    const showField = () => { field.value = url || window.AGENT_GUIDE || ''; box.hidden = false; above(box, box.offsetWidth, box.offsetHeight); field.focus(); field.select(); field.scrollTop = 0; };
    const closeField = () => { box.hidden = true; };
    btn.addEventListener('click', e => { e.stopPropagation(); const t = url || window.AGENT_GUIDE || ''; if (!t) return; if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(notice, showField); else showField(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !box.hidden) closeField(); });
    document.addEventListener('pointerdown', e => { if (!box.hidden && !box.contains(e.target) && e.target !== btn) closeField(); }); }
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
    const out = [], sels = ['#theme', '#modes .modelabel', '#modes .btn', '#layers .btn', '#presets .btn', '.yearrow .ui', '#yearlabel', '#legendtitle', '#legendbody .row', '#mixtitle', '#cellinfo > span', '#cellinfo b', '#notelabel', '.byline .who', '.byline .what', '.tagline', 'footer .byfoot', 'footer .lic', '#methodbtn', '#methodmore'];
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
    return { overflow: overflowing(), header: { box: rel('hdr'), left: rel('hleft'), lockup: rel('lockup'), right: rel('hright') }, map: { x: 0, y: 0, x1: m.width, y1: m.height, visible: true }, legend: rel('legend'), note: rel('mapnote'), zoom: rel('zoombox'), scale: rel('scalebar'), tip: rel('tip'), pulse, yearrow: rel('yearrow'), year: rel('year'), yearlabel: rel('yearlabel'), yearui: rel('yearui'), cards: Object.fromEntries(CARDS.map(id => [id, { card: rel('card-' + id), head: rel('ch-' + id), title: rel('h2-' + id), toggle: rel('ct-' + id), info: rel(id === 'layer' ? 'methodbtn' : 'ci-' + id), body: rel('cb-' + id), open: cardOpen(id) }])), popout: rel('popout'), popId: pop.id, notetoggle: rel('notetoggle'), notelabel: rel('notelabel'), yline2: rel('yline2'), yearrun: rel('yearrun'), blink: rel('blink'), pulselabel: rel('pulselabel'), tipbio: rel('tipbio'), mixinfo: rel('mixinfo'), minimap: rel('minimap'), presets: (() => { const b = PRESETS.find(p => !p.button.classList.contains('keep')).button, r = b.getBoundingClientRect(); return { x: r.left - m.left, y: r.top - m.top, x1: r.right - m.left, y1: r.bottom - m.top, visible: getComputedStyle(b).display !== 'none' && r.width > 0 }; })(), thumb: rel('yearthumb'), yearPct: +(getComputedStyle($('yearslider')).getPropertyValue('--pct') || 0), thumbHit: (() => { let v = null; for (const sh of document.styleSheets) { let rules; try { rules = sh.cssRules; } catch (e) { continue; } for (const r of rules) if (r.selectorText && /::-webkit-slider-thumb/.test(r.selectorText) && r.style.width) v = Math.min(parseFloat(r.style.width), parseFloat(r.style.height)); } return v; })(), strip: rel('ctxstrip'), striptoggle: rel('ctxtoggle'), glyph: rel('ctxglyph'), wire: rel('ctxtext'), stripOpen: stripOpen(), mix: rel('mixbox'), mixtoggle: rel('mixtoggle'), mixOpen: mixOpen(), tipRelaxed: $('tip').style.display !== 'none' && tileState ? tileState.relaxed : null };
  }
  // Driven by tools/atlas-audit.py: switch the layer and the year, redraw, and hand back the text boxes, the overlays'
  // boxes and the camera; the camera moves here are instant.
  window.__atlas = {
    layers: LAYERS.map(L => L.id),
    layerFacts() { return LAYERS.map(L => ({ id: L.id, group: L.group, year: L.year, pulse: L.pulse, micro: L.micro, mark: L.mark })); },   // each layer's facts (round 18), for the audit
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
    minimapTry(over, trace) { mmTry = over || null; mmTrace = trace || null; const svg = $('minimap'); while (svg.firstChild) svg.removeChild(svg.firstChild); svg.classList.remove('drawn'); MMAP = null; buildMinimap(); drawCardGraticule(); return { f: MM_F, vx0: MM_VX0, violations: minimapCheck() }; },   // round 16: a trial layout for the hand placement (the audit and the frames)
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
    refs(on) { if (on === true) refsOpen(); else if (on === false) refsClose(); const d = $('refs'), r = d.getBoundingClientRect(), m = wrap.getBoundingClientRect(), n = $('superusernote');   // the REFERENCES panel (round 16)
      return { open: d.open, rect: [r.left, r.top, r.width, r.height], map: [m.left, m.top, m.width, m.height], sections: [...d.querySelectorAll('section')].map(x => x.dataset.name), links: [...d.querySelectorAll('a')].map(a => a.href), note: n ? n.textContent : null, alpha: REFS_ALPHA, focus: document.activeElement && document.activeElement.id }; },
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
    cardFacts() { return CARD_LIST.map(c => ({ id: c.id, read: !!c.read, chart: c.chart || null, pop: !!c.pop })); },   // the card list (round 18), for the audit
    noteState() { return { open: !$('notebody').hidden, pref: ui.note || null, band: bandUnderCameraOwn()[0], strip: stripOpen() }; },   // the note's state and what decides it (round 10)
    ghost() { const c = cam(), gl = groundLayout(kFit()); return { alpha: GHOST_ALPHA, drawn: ghostDrawn, laid: gl.placed.length, hidden: gl.hidden.map(g => g.city.label), sizes: gl.placed.map(g => [g.city.label, g.size]), colour: theme.tileInk, scale: c.k / kFit() }; },   // the ghost names (round 10; on the ground since round 16)
    hoverRegion() { return hoverRegionName; },
    regionVertex(name, i = 0) { const p = BM.lod0.parts.find(p => p.name === name); if (!p) return null; const r = p.rings[0], n = r.length / 2, j = Math.min(Math.max(0, i | 0), n - 1); let x = r[0] / 10, y = r[1] / 10; for (let k = 1; k <= j; k++) { x += r[2 * k] / 10; y += r[2 * k + 1] / 10; } const [px, py] = Motion.project(cam(), x, y); return { x, y, px, py, i: j }; },   // the i-th vertex of the region's first ring (deltas in 0.1 km), in km and on screen
    pixelsAt(id, px, py) { const cv = $(id), d = window.devicePixelRatio || 1, g = cv.getContext('2d'), out = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) out.push(Array.from(g.getImageData(Math.round((px + dx) * d), Math.round((py + dy) * d), 1, 1).data)); return out; },   // the 3 by 3 pixels of a canvas around a point   // the city-window hand-over (round 10): the window's strength, the outside layer's alpha and whether it is outlined
    method(open) { if (open != null) { ui.method = open ? 'open' : 'closed'; applyMethod(); } return this.methodState(); },
    methodMore(more) { if (more != null) { ui.methodMore = more ? 'open' : 'closed'; applyMethod(); } return this.methodState(); },
    popout(id) { if (id === null) closePop(); else if (id) openPop(id); return pop.id; },   // the pop-out (round 15, item 5.4)
    extras() { return { on: true, blink: blinkState.on, run: runState.on, wireHold, catNext: catKey.next, keyed: $('wiretrack').querySelectorAll('.wi.keyed').length }; },   // the three extras (round 15, item 7)
    blink(on) { if (on) blinkStart(false); else blinkStop(); return blinkState.on; },
    catNow() { return wireCatNow(); },
    profiles() {   // every region's and city window's profile (round 15, item 9): what profile_check.py re-derives
      const out = { regions: {}, windows: {}, medians: !!PROF, insights: !!INS };
      if (REG) for (const name of regIndex.keys()) { if (name === 'Russia') continue; const p = profileRegion(name); if (p) out.regions[name] = { head: p.head, full: p.full, tile: p.tile }; }
      for (const label of Object.keys(win1)) { const p = profileWindow(label); if (p) out.windows[label] = { head: p.head, full: p.full, tile: p.tile }; }
      return out;
    },
    profileFit() {   // each profile's short form in the tile's box at the tile's width: the texts that would not fit the box (the box's own clip); a narrow map's tile has no box
      if (narrow()) return { checked: 0, overflow: [], narrow: true, shown: getComputedStyle($('tipbio')).display !== 'none' };
      const box = $('tipbio'), t = $('tipbiot'), tip = $('tip'), was = { disp: tip.style.display, hidden: box.hidden, txt: t.textContent }, bad = [];
      tip.style.display = 'block'; box.hidden = false; tip.style.width = tip.style.maxWidth = '';
      const all = []; if (REG) for (const name of regIndex.keys()) { const p = name !== 'Russia' && profileRegion(name); if (p) all.push(p); } for (const label of Object.keys(win1)) { const p = profileWindow(label); if (p) all.push(p); }
      for (const p of all) { t.textContent = p.tile; tip.style.width = getComputedStyle(tip).maxWidth; if (t.scrollHeight > t.clientHeight + 1) bad.push(p.id); tip.style.width = ''; }
      t.textContent = was.txt; box.hidden = was.hidden; tip.style.display = was.disp; return { checked: all.length, overflow: bad };
    },
    methodState() { const m = $('method'), t = $('methodtext'), r = t.getBoundingClientRect(); return { open: !m.hidden && getComputedStyle(m).display !== 'none', more: methodMore(), height: r.height, lineHeight: parseFloat(getComputedStyle($('methodintro')).lineHeight), moreLabel: $('methodmore').textContent, pressed: $('methodbtn').getAttribute('aria-expanded'), intro: $('methodintro').textContent.slice(0, 60), prov: $('layerprov').textContent.slice(0, 40), read: $('methodread').textContent.slice(0, 40) }; },
    markAt() { const cx = Math.round(stage.width / 2), cy = Math.round(stage.height - (stripOpen() ? (narrow() ? 44 : 26) : 0) - 44 - 48); const px = (x, y) => Array.from($('map').getContext('2d').getImageData(Math.round(x * (window.devicePixelRatio || 1)), Math.round(y * (window.devicePixelRatio || 1)), 1, 1).data); return { cx, cy, on: px(cx - 40, cy - 28), off: px(cx - 52, cy - 28), stage: theme.stage, land: theme.land, ink: theme.ink }; },   // the authorship mark's pixel (on the left bracket's arm) and the stage beside it (round 10)
  };
  Promise.all([document.fonts.ready, document.fonts.load('400 13px "IBM Plex Mono"'), document.fonts.load('500 13px "IBM Plex Mono"'), document.fonts.load('700 13px "IBM Plex Mono"'), document.fonts.load('400 13.5px "Tomorrow"'), document.fonts.load('500 13.5px "Tomorrow"')].map(p => p.catch(() => null))).then(() => { sizeCanvases(); applyStrip(); applyMix(); const hp = presetFromHash(), hv = hp ? null : viewFromHash(); state.cam = hp ? hp.preset.target() : fitTarget(); syncThemeButton(); syncPulseButton(); if (hp && hp.firms && FIRMS_OK) window.__atlas.mode('firms'); if (hv) applyView(hv, true); redrawAll(); hashOn = true; syncZoomButtons(); syncMix(); buildMinimap(); drawCardGraticule(); syncPresetPressed(); applyWireCaps(); if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', () => verifyLayouts('fonts')); if (window.ResizeObserver) new ResizeObserver(() => { if (Math.round(wrap.clientWidth) !== stage.width || Math.round(wrap.clientHeight) !== stage.height) onResize(); }).observe(wrap); if (window.ResizeObserver) { let gk = ''; new ResizeObserver(() => { const c = $('card-goto'), m = $('minimap'), k = [c.clientWidth, c.clientHeight, m.clientWidth, m.clientHeight].join(','); if (k !== gk) { gk = k; drawCardGraticule(); } }).observe($('card-goto')); } });
})();
