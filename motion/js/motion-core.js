// Motion core: a deterministic stage. Every frame is a pure function of time t (seconds) and the
// loaded data: no wall clock, no retained animation state, no Math.random in draw code. The stage
// draws into one canvas in a fixed design space (1920 x 1080) that is scaled to the canvas box, so
// the same code renders the live page, the scaled artifact and the 1:1 capture frames.
(function () {
  'use strict';
  const Motion = {};

  Motion.ease = {
    linear: t => t,
    inOutCubic: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    outCubic: t => 1 - Math.pow(1 - t, 3),
    inCubic: t => t * t * t,
    outQuint: t => 1 - Math.pow(1 - t, 5),
    inOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,
    outExpo: t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  };
  Motion.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  Motion.lerp = (a, b, t) => a + (b - a) * t;
  // Eased progress (0..1) of a step that starts at local time t0 and lasts d seconds.
  Motion.step = (t, t0, d, easing) => (easing || Motion.ease.inOutCubic)(Motion.clamp((t - t0) / (d || 1e-9), 0, 1));
  // Plateau: 0 before a, ramps up over fin, holds 1, ramps down over fout before b, 0 after b.
  Motion.plateau = (t, a, b, fin, fout) => {
    if (t <= a || t >= b) return 0;
    const up = fin > 0 ? Motion.clamp((t - a) / fin, 0, 1) : 1;
    const down = fout > 0 ? Motion.clamp((b - t) / fout, 0, 1) : 1;
    return Math.min(Motion.ease.inOutSine(up), Motion.ease.inOutSine(down));
  };

  const intFmt = new Intl.NumberFormat('en-US');
  Motion.fmt = {
    int: v => intFmt.format(Math.round(v)),
    pct: (v, d = 1) => (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d) + '%',
    dec: (v, d = 2) => v.toFixed(d),
    signed: (v, d = 1) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(d),
  };

  // Seeded pseudo-random numbers (mulberry32) for deterministic reveal orders.
  Motion.mulberry32 = function (seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  Motion.hash = function (str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };

  // Camera: keyframes [{t, cx, cy, k, ox, oy}] in km (cx, cy), px per km (k) and the design-space
  // point the camera centre maps to (ox, oy; default the frame centre). Position eases in cubic,
  // zoom eases in log k; the camera holds before the first and after the last keyframe.
  // An optional scalar channel v (a year, say) is lerped with the segment's easing when both
  // keyframes carry it, so a value shown with the camera moves on the camera's own clock.
  Motion.camera = function (keyframes, W, H) {
    const ks = keyframes.slice().sort((a, b) => a.t - b.t);
    const norm = k => ({ t: k.t, cx: k.cx, cy: k.cy, k: k.k, ox: k.ox == null ? W / 2 : k.ox, oy: k.oy == null ? H / 2 : k.oy, v: k.v == null ? null : k.v, easing: k.easing || Motion.ease.inOutCubic });
    const kf = ks.map(norm);
    return function (t) {
      if (t <= kf[0].t) return kf[0];
      if (t >= kf[kf.length - 1].t) return kf[kf.length - 1];
      let i = 0; while (i < kf.length - 1 && t > kf[i + 1].t) i++;
      const a = kf[i], b = kf[i + 1];
      const u = b.easing((t - a.t) / (b.t - a.t));
      return { t, cx: Motion.lerp(a.cx, b.cx, u), cy: Motion.lerp(a.cy, b.cy, u), k: Math.exp(Motion.lerp(Math.log(a.k), Math.log(b.k), u)),
               ox: Motion.lerp(a.ox, b.ox, u), oy: Motion.lerp(a.oy, b.oy, u), v: a.v == null || b.v == null ? (b.v == null ? a.v : b.v) : Motion.lerp(a.v, b.v, u) };
    };
  };

  // Applies the camera on top of the stage's design transform: km -> design px (y up in km).
  Motion.camTransform = function (ctx, stage, cam) {
    ctx.setTransform(stage.scale, 0, 0, stage.scale, 0, 0);
    ctx.transform(cam.k, 0, 0, -cam.k, cam.ox - cam.cx * cam.k, cam.oy + cam.cy * cam.k);
  };
  // km -> design px for labels drawn after the transform is reset.
  Motion.project = (cam, x, y) => [cam.ox + (x - cam.cx) * cam.k, cam.oy - (y - cam.cy) * cam.k];

  Motion.createStage = function ({ width, height, fps, duration, canvas, theme, data, seed }) {
    const scenes = [];
    let cameraFn = null;
    const ctx = canvas.getContext('2d', { alpha: false });
    const stage = { width, height, fps, duration, canvas, ctx, theme, data, scenes, t: 0, scale: 1, seed: seed || 1 };
    stage.addScene = function (s) { scenes.push(s); scenes.sort((a, b) => (a.z || 0) - (b.z || 0)); return s; };
    stage.setCamera = function (fn) { cameraFn = fn; };
    stage.resize = function () {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(1, Math.round(rect.width * dpr)), h = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      stage.scale = w / width;
    };
    stage.base = function () { ctx.setTransform(stage.scale, 0, 0, stage.scale, 0, 0); };
    stage.render = function (t) {
      t = Motion.clamp(t, 0, duration); stage.t = t;
      stage.resize(); stage.base();
      ctx.fillStyle = theme.stage; ctx.fillRect(0, 0, width, height);
      const cam = cameraFn ? cameraFn(t) : null; stage.cam = cam;
      const A = Motion.audit; A.boxes = []; A.panels = []; A.marks = []; A.seq = 0; A.scale = stage.scale; A.t = t; A.scene = null;
      for (const s of scenes) {
        // A scene fades in over the fadeIn seconds before its start, so consecutive scenes crossfade
        // instead of dipping to the stage colour; its own clock starts at s.start.
        const fin = s.fadeIn == null ? 0.5 : s.fadeIn, fout = s.fadeOut == null ? 0.5 : s.fadeOut;
        if (t < s.start - fin || t >= s.end) continue;
        // speed > 1 plays a scene's content faster than real time (a teaser cut); fades stay in real time.
        // offset starts the scene's own clock later than zero (an excerpt in a cut).
        const speed = s.speed || 1;
        const local = Math.max(0, t - s.start) * speed + (s.offset || 0), dur = (s.end - s.start) * speed + (s.offset || 0);
        const alpha = Motion.plateau(t, s.start - fin - 1e-6, s.end, fin, fout);
        ctx.save(); ctx.globalAlpha = alpha; stage.base(); A.scene = s.id;
        s.draw({ t, local, dur, u: local / dur, ctx, cam, stage, theme, data, alpha, W: width, H: height });
        ctx.restore();
      }
      A.scene = null;
      stage.base();
    };
    stage.meta = () => ({ width, height, fps, duration, frames: Math.round(duration * fps), scenes: scenes.map(s => ({ id: s.id, title: s.title || s.id, start: s.start, end: s.end })) });
    return stage;
  };

  // Text helpers in design space. Fonts are a local-first stack; Arimo is metric-compatible with the
  // Liberation/Arial family so the published copy keeps the same line breaks.
  Motion.font = (px, weight) => `${weight || 400} ${px}px "Nimbus Sans", Arimo, "Liberation Sans", Arial, Helvetica, sans-serif`;

  // Text audit (page opened with ?__audit=1): every drawn string records its design-space box, its
  // effective alpha and its group (a paragraph's lines, or an explicit group for blocks that
  // crossfade in place), so capture.py --audit and audit.py can test overlaps, bounds, sizes and
  // transitions frame by frame. Off by default; the record is a pure function of the frame.
  Motion.audit = { on: false, boxes: [], panels: [], marks: [], scene: null, para: null, seq: 0, paraSeq: 0, scale: 1, t: 0 };
  Motion.recordText = function (ctx, str, x, y, size, weight, group, kind) {
    const A = Motion.audit; if (!A.on) return;
    const m = ctx.measureText(str), tr = ctx.getTransform(), s = A.scale || 1;
    const x0 = x - m.actualBoundingBoxLeft, x1 = x + m.actualBoundingBoxRight, y0 = y - m.actualBoundingBoxAscent, y1 = y + m.actualBoundingBoxDescent;
    const P = (px, py) => [(tr.a * px + tr.c * py + tr.e) / s, (tr.b * px + tr.d * py + tr.f) / s];
    const c = [P(x0, y0), P(x1, y0), P(x0, y1), P(x1, y1)], xs = c.map(p => p[0]), ys = c.map(p => p[1]), anchor = P(x, y);
    A.boxes.push({ scene: A.scene, str, size, weight, para: group || A.para, kind: kind || 'text', seq: A.seq++, eff: Math.round(ctx.globalAlpha * 1000) / 1000,
                   x: Math.min(...xs), y: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys), ax: anchor[0], ay: anchor[1] });
  };
  Motion.text = function (ctx, str, x, y, { size = 28, weight = 400, color = '#fff', align = 'left', baseline = 'alphabetic', alpha = 1, letterSpacing = 0, group = null, kind = null } = {}) {
    if (alpha <= 0) return;
    ctx.save(); ctx.globalAlpha *= alpha; ctx.font = Motion.font(size, weight); ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = baseline;
    if (letterSpacing && 'letterSpacing' in ctx) ctx.letterSpacing = letterSpacing + 'px';
    Motion.recordText(ctx, str, x, y, size, weight, group, kind);
    ctx.fillText(str, x, y); ctx.restore();
  };
  // A translucent panel in the stage colour behind a block of text; in audit mode its rectangle is
  // recorded so audit.py can test that the text drawn after it stays inside it (panel-clip).
  Motion.panel = function (ctx, x, y, w, h, theme, alpha = 0.92, kind = 'panel') {
    if (alpha <= 0) return;
    ctx.save(); ctx.globalAlpha *= alpha; ctx.fillStyle = theme.stage; ctx.fillRect(x, y, w, h);
    const A = Motion.audit; if (A.on) A.panels.push({ scene: A.scene, kind, x, y, x1: x + w, y1: y + h, eff: Math.round(ctx.globalAlpha * 1000) / 1000, seq: A.seq++ });
    ctx.restore();
  };
  // Split-flap text: from one string to another over u in 0..1. Each glyph has its own window
  // (staggered by `stagger` of the whole), passes through `steps` intermediate characters chosen by a
  // hash of the two strings, the glyph index and the stage (never wall time), and slides from its
  // position in `from` to its position in `to`. One audit box is recorded per call, so the audit sees
  // one block that changes its text, not a cut.
  Motion.flipText = function (ctx, from, to, u, { x, y, size = 24, weight = 600, color = '#fff', align = 'right', letterSpacing = 2, steps = 3, stagger = 0.06, group = 'location', alpha = 1 } = {}) {
    const plain = { size, weight, color, align, letterSpacing, group, alpha };
    if (alpha <= 0) return;
    if (from === to || u <= 0) return Motion.text(ctx, from, x, y, plain);
    if (u >= 1) return Motion.text(ctx, to, x, y, plain);
    const n = Math.max(from.length, to.length);
    const pad = s => (align === 'right' ? s.padStart(n, ' ') : align === 'center' ? s.padStart(s.length + Math.floor((n - s.length) / 2), ' ').padEnd(n, ' ') : s.padEnd(n, ' '));
    const f = pad(from), g = pad(to);
    ctx.save(); ctx.globalAlpha *= alpha; ctx.font = Motion.font(size, weight); ctx.fillStyle = color; ctx.textBaseline = 'alphabetic';
    ctx.textAlign = align; if ('letterSpacing' in ctx) ctx.letterSpacing = letterSpacing + 'px';
    Motion.recordText(ctx, u < 0.5 ? from : to, x, y, size, weight, group);
    ctx.textAlign = 'left'; if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    const adv = s => Array.from(s).map(ch => ctx.measureText(ch).width + letterSpacing);
    const positions = a => { const total = a.reduce((s, w) => s + w, 0); let cx = align === 'right' ? x - total : align === 'center' ? x - total / 2 : x; return a.map(w => { const p = cx; cx += w; return p; }); };
    const xf = positions(adv(f)), xg = positions(adv(g));
    const d = 1 / (1 + (n - 1) * stagger), h = Motion.hash(from + '|' + to);
    const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', LOWER = 'abcdefghijklmnopqrstuvwxyz', DIGITS = '0123456789';
    for (let i = 0; i < n; i++) {
      const ui = Motion.clamp((u - i * stagger * d) / d, 0, 1);
      const a = f[i], b = g[i];
      let ch, fade = 1;
      if (ui >= 1) ch = b;
      else if (ui <= 0) ch = a;
      else {
        const j = Math.floor(ui * (steps + 1));
        if (j === 0) ch = a;
        else {
          const target = b === ' ' ? a : b, k = h + 31 * i + 17 * j;
          ch = DIGITS.includes(target) ? DIGITS[k % 10] : target === target.toUpperCase() && UPPER.includes(target) ? UPPER[k % 26] : LOWER.includes(target.toLowerCase()) ? LOWER[k % 26] : target;
        }
        if (a === ' ' && b !== ' ') fade = ui; else if (a !== ' ' && b === ' ') fade = 1 - ui;
      }
      if (ch === ' ') continue;
      ctx.save(); ctx.globalAlpha *= fade; ctx.fillText(ch, Motion.lerp(xf[i], xg[i], ui), y); ctx.restore();
    }
    ctx.restore();
  };
  // A schedule of values by time: [{start, value}] sorted by start; the value blends from the previous
  // entry over `blend` seconds (inOutSine). A value may be a number or a function of t.
  Motion.schedule = function (entries, blend = 0.6) {
    const es = entries.slice().sort((a, b) => a.start - b.start);
    const val = (e, t) => (typeof e.value === 'function' ? e.value(t) : e.value);
    return function (t) {
      if (!es.length) return 0;
      let i = 0; while (i < es.length - 1 && t >= es[i + 1].start) i++;
      const cur = val(es[i], t);
      const bl = es[i].blend == null ? blend : es[i].blend;   // an entry may carry its own blend length
      if (i === 0 || bl <= 0) return cur;
      const u = Motion.clamp((t - es[i].start) / bl, 0, 1);
      return u >= 1 ? cur : Motion.lerp(val(es[i - 1], t), cur, Motion.ease.inOutSine(u));
    };
  };
  Motion.measure = function (ctx, str, size, weight) { ctx.save(); ctx.font = Motion.font(size, weight); const w = ctx.measureText(str).width; ctx.restore(); return w; };
  // Word-wrapped paragraph; returns the y after the last line.
  Motion.paragraph = function (ctx, str, x, y, maxWidth, { size = 26, weight = 400, color = '#fff', lineHeight = 1.35, alpha = 1, align = 'left', group = null } = {}) {
    if (alpha <= 0) return y;
    const A = Motion.audit; A.para = group || ('p' + (++A.paraSeq));
    ctx.save(); ctx.globalAlpha *= alpha; ctx.font = Motion.font(size, weight); ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
    const words = str.split(' '); let line = ''; let yy = y;
    const put = (s, yline) => { Motion.recordText(ctx, s, x, yline, size, weight, null); ctx.fillText(s, x, yline); };
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxWidth && line) { put(line, yy); yy += size * lineHeight; line = w; } else line = test;
    }
    if (line) { put(line, yy); yy += size * lineHeight; }
    ctx.restore(); A.para = null; return yy;
  };
  // Typewriter-free reveal: text fades and rises 10 px over 0.5 s from t0; with opts.until it
  // fades out over the 0.4 s before that local time, so a replaced block never cuts.
  Motion.reveal = function (ctx, str, x, y, t, t0, opts) {
    const u = Motion.step(t, t0, 0.5, Motion.ease.outCubic);
    if (u <= 0) return;
    const until = opts && opts.until != null ? opts.until : null;
    const down = until == null ? 1 : 1 - Motion.step(t, until - 0.4, 0.4, Motion.ease.inOutSine);
    if (down <= 0) return;
    Motion.text(ctx, str, x, y + 10 * (1 - u), Object.assign({}, opts, { alpha: (opts && opts.alpha != null ? opts.alpha : 1) * u * down }));
  };
  // Counter: a number that counts up from 0 to v between t0 and t0 + d, formatted.
  Motion.counter = (t, t0, d, v) => Math.round(v * Motion.step(t, t0, d, Motion.ease.outExpo));

  window.Motion = Motion;
})();
