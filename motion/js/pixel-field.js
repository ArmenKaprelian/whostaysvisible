// The Firms view's pixel field (round 14, the author's decision of 25 October 2026): the video's national raster rule computed live at every zoom.
// Each cell is one CSS pixel. The coordinate pairs inside a cell are summed (firms n, firms with a statement a, filers f, revenue, and the layer's class
// weights); the cell takes the layer's statistic over them; a cell holding 10 or more firms is drawn as a 2 by 2 block to the right and down, 100 or more
// as a 3 by 3 block centred on it (the video's draw_region in R/motion/M6-common.R); where blocks overlap, the larger block wins, then the larger count.
// The layer is drawn at 0.9 over a neutral backdrop of every firm at 0.25 (the revenue and industry layers, where some firms carry no value), as the video's
// LAYER_ALPHA and BACKDROP_ALPHA. One rule, two engines: WebGL2 with float render targets, and the CPU for browsers without them; the CPU rule also answers
// the hover, so the tile describes the block drawn under the cursor.
(function () {
  'use strict';
  const PF = {};
  PF.LAYER_ALPHA = 0.9; PF.BACKDROP_ALPHA = 0.25;
  PF.blockSize = w => (w >= 100 ? 3 : w >= 10 ? 2 : w > 0 ? 1 : 0);
  // The layer codes: 0 statement share, 1 revenue change, 2 industry, 3 a cell layer (the count alone).
  PF.layerCode = L => (L === 'share' ? 0 : L === 'fin' ? 1 : L === 'industry' ? 2 : 3);
  const countClass = n => (n <= 2 ? 0 : n <= 5 ? 1 : n <= 10 ? 2 : n <= 25 ? 3 : n <= 60 ? 4 : n <= 150 ? 5 : n <= 400 ? 6 : 7);
  PF.countAlpha = [0.22, 0.32, 0.44, 0.56, 0.68, 0.8, 0.9, 1.0];   // MM.countAlpha

  // A cell's statistic from its sums: { cls (0 none: the backdrop only), size, bsize (the backdrop's block), prio, w }.
  // s: { n, a, f, rev, cw: class weights 1..9 (index 0 unused) }; breaks: the share layer's year breaks.
  PF.classify = function (s, code, breaks) {
    const out = { cls: 0, size: 0, bsize: 0, w: 0 };
    if (!(s.n > 0)) return out;
    if (code === 0) { let c = 0; while (c < breaks.length && 100 * s.a >= breaks[c] * s.n) c++; out.cls = c + 1; out.w = s.n; }   // 100 a >= b n, not a division: a share exactly on a break (7 of 10 at 70) falls the same side in both engines
    else if (code === 1) { let tot = 0; for (let c = 1; c <= 6; c++) tot += s.cw[c]; if (tot > 0) { let acc = 0, c = 1; for (; c <= 6; c++) { acc += s.cw[c]; if (acc * 2 >= tot) break; } out.cls = Math.min(c, 6); } out.w = s.f; out.bsize = PF.blockSize(s.n); }
    else if (code === 2) { let best = 0, bv = 0; for (let c = 1; c <= 9; c++) if (s.cw[c] > bv) { bv = s.cw[c]; best = c; } out.cls = best; out.w = s.n; out.bsize = PF.blockSize(s.n); }
    else { out.cls = countClass(s.n) + 1; out.w = s.n; }
    out.size = out.cls ? PF.blockSize(out.w) : 0;
    return out;
  };
  // Does a block of this size at cell q cover cell p? (screen axes, y down)
  PF.covers = (size, dx, dy) => (size === 3 ? Math.abs(dx) <= 1 && Math.abs(dy) <= 1 : size === 2 ? (dx === 0 || dx === 1) && (dy === 0 || dy === 1) : size === 1 ? dx === 0 && dy === 0 : false);   // dx, dy: p minus q

  // ---- the CPU engine ---------------------------------------------------------------------------------------------------------------
  // view: { cx, cy, k, ox, oy, W, H } in km and CSS px; d: the year's address arrays (x, y in metres, nn, a, f, rv, cls, indCls); i0, i1: the x-band.
  // Returns the cells' sums for the view with a one-cell margin (so blocks just outside reach in), as typed arrays of (W + 2) by (H + 2).
  PF.cpuSums = function (d, view, code, i0, i1, POW) {
    const W = view.W + 2, H = view.H + 2, N = W * H, n = new Float32Array(N), a = new Float32Array(N), f = new Float32Array(N), rev = new Float32Array(N);
    const nc = code === 1 ? 6 : code === 2 ? 9 : 0, cw = nc ? new Float32Array(N * nc) : null;
    const k = view.k / 1000, ax = view.ox - view.cx * view.k, ay = view.oy + view.cy * view.k;
    for (let i = i0; i < i1; i++) {
      const cx = Math.floor(ax + d.x[i] * k) + 1, cy = Math.floor(ay - d.y[i] * k) + 1; if (cx < 0 || cy < 0 || cx >= W || cy >= H) continue;
      const j = cy * W + cx, nn = d.nn[i]; n[j] += nn; a[j] += d.a[i]; f[j] += d.f[i]; const r = d.rv[i] ? POW[d.rv[i]] : 0; rev[j] += r;
      if (code === 1 && d.cls[i]) cw[j * 6 + d.cls[i] - 1] += d.f[i];
      else if (code === 2 && d.indCls[i] && r > 0) cw[j * 9 + d.indCls[i] - 1] += r;
    }
    return { W, H, n, a, f, rev, cw, nc };
  };
  // One cell's sums as an object, for classify.
  PF.cellSums = function (S, j) { const o = { n: S.n[j], a: S.a[j], f: S.f[j], rev: S.rev[j], cw: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] }; for (let c = 0; c < S.nc; c++) o.cw[c + 1] = S.cw[j * S.nc + c]; return o; };
  // The classified cells (cls, size, bsize, prio) for the whole view with its margin.
  PF.cpuClassify = function (S, code, breaks) {
    const N = S.W * S.H, cls = new Uint8Array(N), size = new Uint8Array(N), bsize = new Uint8Array(N), w = new Float32Array(N);
    for (let j = 0; j < N; j++) { if (!(S.n[j] > 0)) continue; const r = PF.classify(PF.cellSums(S, j), code, breaks); cls[j] = r.cls; size[j] = r.size; bsize[j] = r.bsize; w[j] = r.w; }
    return { W: S.W, H: S.H, cls, size, bsize, w };
  };
  // The winner covering a cell (view coordinates, 0 based, without the margin): { j (the owner cell's index with the margin), cls, size } or null; and
  // whether a backdrop block covers it. The order: the larger block, then the larger count, then the nearer cell (the centre first), the same in both engines.
  PF.winnerAt = function (C, x, y) {
    let best = -1, bs = 0, bw = -1, back = false; const W = C.W;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const qx = x + 1 + dx, qy = y + 1 + dy; if (qx < 0 || qy < 0 || qx >= W || qy >= C.H) continue; const q = qy * W + qx;
      if (!back && C.bsize[q] && PF.covers(C.bsize[q], -dx, -dy)) back = true;
      const s = C.size[q]; if (!s || !PF.covers(s, -dx, -dy)) continue;
      if (s > bs || (s === bs && C.w[q] > bw)) { best = q; bs = s; bw = C.w[q]; }
    }
    return { j: best, cls: best >= 0 ? C.cls[best] : 0, size: bs, back };
  };
  // The composed image at cell resolution (premultiplied RGBA bytes): palette(cls) -> [r, g, b, alpha] in 0..255 and 0..1.
  PF.cpuCompose = function (C, W, H, colourOf, backRGB) {
    const img = new Uint8ClampedArray(W * H * 4), la = PF.LAYER_ALPHA, ba = PF.BACKDROP_ALPHA;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const r = PF.winnerAt(C, x, y); if (r.j < 0 && !r.back) continue;
      let R = 0, G = 0, B = 0, A = 0;
      if (r.back) { R = backRGB[0] * ba; G = backRGB[1] * ba; B = backRGB[2] * ba; A = ba; }
      if (r.j >= 0) { const c = colourOf(r.cls), al = c[3]; R = c[0] * al + R * (1 - al); G = c[1] * al + G * (1 - al); B = c[2] * al + B * (1 - al); A = al + A * (1 - al); }
      const o = 4 * (y * W + x); img[o] = R; img[o + 1] = G; img[o + 2] = B; img[o + 3] = A * 255;
    }
    return img;
  };

  // ---- the WebGL2 engine --------------------------------------------------------------------------------------------------------------
  const VS_ACC = `#version 300 es
in vec2 a_pos; in float a_n; in float a_a; in float a_f; in float a_rv; in vec4 a_cls;
uniform vec2 u_shift; uniform vec2 u_off; uniform float u_kk; uniform vec2 u_cells; uniform int u_code;
out vec4 v0; out vec4 v1; out vec4 v2; out vec4 v3;
void main() {
  vec2 rel = a_pos + u_shift;
  vec2 c = floor(vec2(u_off.x + rel.x * u_kk, u_off.y - rel.y * u_kk)) + 1.0;
  if (c.x < 0.0 || c.y < 0.0 || c.x >= u_cells.x || c.y >= u_cells.y) { gl_Position = vec4(2.0, 2.0, 0.0, 1.0); gl_PointSize = 1.0; return; }
  gl_Position = vec4((c.x + 0.5) / u_cells.x * 2.0 - 1.0, 1.0 - (c.y + 0.5) / u_cells.y * 2.0, 0.0, 1.0); gl_PointSize = 1.0;
  float r = a_rv > 0.5 ? pow(10.0, (a_rv - 1.0) / 100.0) : 0.0;
  v0 = vec4(a_n, a_a, a_f, r);
  float k = u_code == 1 ? a_cls.y : (u_code == 2 ? a_cls.z : 0.0), w = u_code == 1 ? a_f : (u_code == 2 && r > 0.0 ? r : 0.0);
  if (k < 0.5) w = 0.0;
  v1 = vec4(k > 0.5 && k < 1.5 ? w : 0.0, k > 1.5 && k < 2.5 ? w : 0.0, k > 2.5 && k < 3.5 ? w : 0.0, k > 3.5 && k < 4.5 ? w : 0.0);
  v2 = vec4(k > 4.5 && k < 5.5 ? w : 0.0, k > 5.5 && k < 6.5 ? w : 0.0, k > 6.5 && k < 7.5 ? w : 0.0, k > 7.5 && k < 8.5 ? w : 0.0);
  v3 = vec4(k > 8.5 && k < 9.5 ? w : 0.0, 0.0, 0.0, 0.0);
}`;
  const FS_ACC = `#version 300 es
precision highp float;
in vec4 v0; in vec4 v1; in vec4 v2; in vec4 v3;
layout(location = 0) out vec4 o0; layout(location = 1) out vec4 o1; layout(location = 2) out vec4 o2; layout(location = 3) out vec4 o3;
void main() { o0 = v0; o1 = v1; o2 = v2; o3 = v3; }`;
  const VS_QUAD = `#version 300 es
in vec2 a_q; void main() { gl_Position = vec4(a_q, 0.0, 1.0); }`;
  // Classify: one texel per cell (with the margin) holding the class, the block size, the backdrop's block size and the count w (as a float in a second target).
  const FS_CLS = `#version 300 es
precision highp float;
uniform sampler2D t0; uniform sampler2D t1; uniform sampler2D t2; uniform sampler2D t3; uniform int u_code; uniform float u_br[5];
layout(location = 0) out vec4 oc; layout(location = 1) out vec4 ow;
float bsz(float w) { return w >= 100.0 ? 3.0 : (w >= 10.0 ? 2.0 : (w > 0.0 ? 1.0 : 0.0)); }
float cnt(float n) { return n <= 2.0 ? 0.0 : (n <= 5.0 ? 1.0 : (n <= 10.0 ? 2.0 : (n <= 25.0 ? 3.0 : (n <= 60.0 ? 4.0 : (n <= 150.0 ? 5.0 : (n <= 400.0 ? 6.0 : 7.0)))))); }
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy); vec4 s0 = texelFetch(t0, p, 0); float n = s0.x;
  if (!(n > 0.0)) { oc = vec4(0.0); ow = vec4(0.0); return; }
  float cls = 0.0, w = 0.0, bs = 0.0;
  if (u_code == 0) { float c = 0.0; for (int i = 0; i < 5; i++) if (100.0 * s0.y >= u_br[i] * n) c += 1.0; cls = c + 1.0; w = n; }
  else if (u_code == 1) {
    vec4 a = texelFetch(t1, p, 0), b = texelFetch(t2, p, 0); float cw[6]; cw[0] = a.x; cw[1] = a.y; cw[2] = a.z; cw[3] = a.w; cw[4] = b.x; cw[5] = b.y;
    float tot = 0.0; for (int i = 0; i < 6; i++) tot += cw[i];
    if (tot > 0.0) { float acc = 0.0; cls = 6.0; for (int i = 0; i < 6; i++) { acc += cw[i]; if (acc * 2.0 >= tot) { cls = float(i) + 1.0; break; } } }
    w = s0.z; bs = bsz(n);
  } else if (u_code == 2) {
    vec4 a = texelFetch(t1, p, 0), b = texelFetch(t2, p, 0), c3 = texelFetch(t3, p, 0); float cw[9]; cw[0] = a.x; cw[1] = a.y; cw[2] = a.z; cw[3] = a.w; cw[4] = b.x; cw[5] = b.y; cw[6] = b.z; cw[7] = b.w; cw[8] = c3.x;
    float bv = 0.0; for (int i = 0; i < 9; i++) if (cw[i] > bv) { bv = cw[i]; cls = float(i) + 1.0; }
    w = n; bs = bsz(n);
  } else { cls = cnt(n) + 1.0; w = n; }
  float sz = cls > 0.0 ? bsz(w) : 0.0;
  oc = vec4(cls / 255.0, sz / 255.0, bs / 255.0, 1.0); ow = vec4(w, 0.0, 0.0, 0.0);
}`;
  // Dilate and compose: each output cell takes the covering block of its 3 by 3 neighbourhood (the larger block, then the larger count, then the nearer cell), the
  // layer at its alpha over the backdrop where a backdrop block covers it; premultiplied, at the cell's resolution.
  const FS_COMP = `#version 300 es
precision highp float;
uniform sampler2D tc; uniform sampler2D tw; uniform vec3 u_pal[16]; uniform float u_alpha[16]; uniform vec3 u_back; uniform float u_la; uniform float u_ba; uniform vec2 u_vcells;
out vec4 o;
bool covers(float s, int dx, int dy) { if (s > 2.5) return abs(dx) <= 1 && abs(dy) <= 1; if (s > 1.5) return (dx == 0 || dx == 1) && (dy == 0 || dy == 1); if (s > 0.5) return dx == 0 && dy == 0; return false; }
void main() {
  ivec2 v = ivec2(gl_FragCoord.xy); int x = v.x, y = int(u_vcells.y) - 1 - v.y;   // the output's rows run up; the cells' rows run down from the top of the view
  float bs = 0.0, bw = -1.0, bc = 0.0; bool back = false; int order = 99;
  for (int dy = -1; dy <= 1; dy++) for (int dx = -1; dx <= 1; dx++) {
    ivec2 q = ivec2(x + 1 + dx, y + 1 + dy); vec4 c = texelFetch(tc, ivec2(q.x, int(u_vcells.y) + 1 - q.y), 0);
    float cls = floor(c.x * 255.0 + 0.5), s = floor(c.y * 255.0 + 0.5), b = floor(c.z * 255.0 + 0.5);
    if (!back && b > 0.5 && covers(b, -dx, -dy)) back = true;
    if (s < 0.5 || !covers(s, -dx, -dy)) continue;
    float w = texelFetch(tw, ivec2(q.x, int(u_vcells.y) + 1 - q.y), 0).x; int ord = (dy + 1) * 3 + (dx + 1);
    if (s > bs || (s == bs && w > bw)) { bs = s; bw = w; bc = cls; }
  }
  vec4 col = vec4(0.0);
  if (back) col = vec4(u_back * u_ba, u_ba);
  if (bs > 0.5) { int ci = int(bc); float al = u_alpha[ci] * u_la; col = vec4(u_pal[ci] * al, al) + col * (1.0 - al); }
  o = col;
}`;
  // The copy to the canvas: nearest sampling of the composed cells, at weight u (the dots' crossfade), faded by the sweep's edge and mixed with the previous year's
  // image during the dissolve.
  const FS_BLIT = `#version 300 es
precision highp float;
uniform sampler2D tcur; uniform sampler2D tprev; uniform vec2 u_canvas; uniform vec2 u_vcells; uniform float u_u; uniform float u_t; uniform float u_sweep; uniform float u_feather; uniform float u_dpr;
out vec4 o;
void main() {
  vec2 dev = vec2(gl_FragCoord.x, u_canvas.y - gl_FragCoord.y);   // device px from the top left
  vec2 cell = floor(dev / u_dpr); if (cell.x >= u_vcells.x || cell.y >= u_vcells.y) { o = vec4(0.0); return; }
  ivec2 t = ivec2(int(cell.x), int(u_vcells.y - 1.0 - cell.y));
  vec4 c = texelFetch(tcur, t, 0); if (u_t < 1.0) c = mix(texelFetch(tprev, t, 0), c, u_t);
  float m = u_sweep < 1e8 ? clamp((u_sweep - cell.x) / u_feather, 0.0, 1.0) : 1.0;
  o = c * u_u * m;
}`;

  PF.createGL = function (gl) {
    if (!gl || typeof WebGL2RenderingContext === 'undefined' || !(gl instanceof WebGL2RenderingContext)) return { ok: false, reason: 'no WebGL2' };
    if (!gl.getExtension('EXT_color_buffer_float') || !gl.getExtension('EXT_float_blend')) return { ok: false, reason: 'no blendable float targets' };
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(s)); return s; };
    const prog = (vs, fs) => { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(p)); return p; };
    let P;
    try { P = { acc: prog(VS_ACC, FS_ACC), cls: prog(VS_QUAD, FS_CLS), comp: prog(VS_QUAD, FS_COMP), blit: prog(VS_QUAD, FS_BLIT) }; } catch (e) { return { ok: false, reason: e.message }; }
    const loc = {}; for (const [name, p] of Object.entries(P)) { loc[name] = { p }; const nu = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for (let i = 0; i < nu; i++) { const u = gl.getActiveUniform(p, i), nm = u.name.replace(/\[0\]$/, ''); loc[name][nm] = gl.getUniformLocation(p, nm); } const na = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES); for (let i = 0; i < na; i++) { const a = gl.getActiveAttrib(p, i); loc[name][a.name] = gl.getAttribLocation(p, a.name); } }
    const quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const T = { size: null, acc: null, cls: null, comp: null, prev: null };
    const tex = (w, h, internal, fmt, type) => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, fmt, type, null); return t; };
    const fbo = (texs) => { const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); texs.forEach((t, i) => gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, t, 0)); gl.drawBuffers(texs.map((_, i) => gl.COLOR_ATTACHMENT0 + i)); const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE; gl.bindFramebuffer(gl.FRAMEBUFFER, null); if (!ok) throw new Error('framebuffer incomplete'); return f; };
    function free() { for (const k of ['acc', 'cls', 'comp', 'prev']) { const o = T[k]; if (!o) continue; for (const t of o.tex) gl.deleteTexture(t); gl.deleteFramebuffer(o.fbo); T[k] = null; } T.size = null; }
    // The targets for a view of W by H cells (the accumulation and the classes carry a one-cell margin); the accumulation's attachments follow the layer's need.
    function targets(W, H, nAtt) {
      const key = W + 'x' + H + 'x' + nAtt; if (T.size === key) return;
      free();
      const at = []; for (let i = 0; i < nAtt; i++) at.push(tex(W + 2, H + 2, gl.RGBA32F, gl.RGBA, gl.FLOAT));
      T.acc = { tex: at, fbo: fbo(at) };
      const tc = tex(W + 2, H + 2, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE), tw = tex(W + 2, H + 2, gl.R32F, gl.RED, gl.FLOAT);
      T.cls = { tex: [tc, tw], fbo: fbo([tc, tw]) };
      const t1 = tex(W, H, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE), t2 = tex(W, H, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE);
      T.comp = { tex: [t1], fbo: fbo([t1]) }; T.prev = { tex: [t2], fbo: fbo([t2]) };
      T.size = key;
    }
    const quadDraw = (L) => { gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.enableVertexAttribArray(L.a_q); gl.vertexAttribPointer(L.a_q, 2, gl.FLOAT, false, 0, 0); gl.drawArrays(gl.TRIANGLES, 0, 6); gl.disableVertexAttribArray(L.a_q); };
    // Compose the field for a view into the current image (keeping the last one as the previous image when keepPrev): buf holds the year's vertex buffers
    // (pos, n, a, f, rv, cls), [i0, i1) the x-band; p: { W, H (cells), shift, off, kk, code, breaks, pal (16 rgb triples 0..1), alpha (16), back (rgb 0..1) }.
    function compose(buf, i0, i1, p, keepPrev) {
      const nAtt = p.code === 2 ? 4 : p.code === 1 ? 3 : 1; targets(p.W, p.H, 4);   // four attachments always: the shader writes four outputs (the unused ones stay zero), so a layer change keeps the targets
      if (keepPrev) { const t = T.prev; T.prev = T.comp; T.comp = t; }
      gl.disable(gl.DEPTH_TEST);
      // accumulate
      gl.bindFramebuffer(gl.FRAMEBUFFER, T.acc.fbo); gl.viewport(0, 0, p.W + 2, p.H + 2); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      const A = loc.acc; gl.useProgram(A.p);
      const attr = (name, b, size, type) => { const l = A[name]; if (l == null || l < 0) return; gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, size, type, false, 0, 0); };
      attr('a_pos', buf.pos, 2, gl.FLOAT); attr('a_n', buf.n, 1, gl.UNSIGNED_SHORT); attr('a_a', buf.a, 1, gl.UNSIGNED_SHORT); attr('a_f', buf.f, 1, gl.UNSIGNED_SHORT); attr('a_rv', buf.rv, 1, gl.UNSIGNED_SHORT); attr('a_cls', buf.cls, 4, gl.UNSIGNED_BYTE);
      gl.uniform2f(A.u_shift, p.shift[0], p.shift[1]); gl.uniform2f(A.u_off, p.off[0], p.off[1]); gl.uniform1f(A.u_kk, p.kk); gl.uniform2f(A.u_cells, p.W + 2, p.H + 2); gl.uniform1i(A.u_code, p.code);
      if (i1 > i0) gl.drawArrays(gl.POINTS, i0, i1 - i0);
      for (const name of ['a_pos', 'a_n', 'a_a', 'a_f', 'a_rv', 'a_cls']) if (A[name] != null && A[name] >= 0) gl.disableVertexAttribArray(A[name]);
      gl.disable(gl.BLEND);
      // classify
      gl.bindFramebuffer(gl.FRAMEBUFFER, T.cls.fbo); gl.viewport(0, 0, p.W + 2, p.H + 2);
      const C = loc.cls; gl.useProgram(C.p);
      T.acc.tex.forEach((t, i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(C['t' + i], i); });
      gl.uniform1i(C.u_code, p.code); gl.uniform1fv(C.u_br, new Float32Array(p.breaks.concat([1e9, 1e9, 1e9, 1e9, 1e9]).slice(0, 5)));
      quadDraw(C);
      // compose
      gl.bindFramebuffer(gl.FRAMEBUFFER, T.comp.fbo); gl.viewport(0, 0, p.W, p.H);
      const Q = loc.comp; gl.useProgram(Q.p);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, T.cls.tex[0]); gl.uniform1i(Q.tc, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, T.cls.tex[1]); gl.uniform1i(Q.tw, 1);
      gl.uniform3fv(Q.u_pal, p.pal); gl.uniform1fv(Q.u_alpha, p.alpha); gl.uniform3f(Q.u_back, p.back[0], p.back[1], p.back[2]); gl.uniform1f(Q.u_la, PF.LAYER_ALPHA); gl.uniform1f(Q.u_ba, p.code === 1 || p.code === 2 ? PF.BACKDROP_ALPHA : 0); gl.uniform2f(Q.u_vcells, p.W, p.H);
      quadDraw(Q);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      for (let i = 0; i < 4; i++) { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, null); }
      gl.activeTexture(gl.TEXTURE0);
    }
    // Draw the composed image onto the canvas (already cleared by the caller), premultiplied "over".
    function blit(canvasW, canvasH, p, u, t, sweep, feather) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, canvasW, canvasH);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      const B = loc.blit; gl.useProgram(B.p);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, T.comp.tex[0]); gl.uniform1i(B.tcur, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, T.prev.tex[0]); gl.uniform1i(B.tprev, 1);
      gl.uniform2f(B.u_canvas, canvasW, canvasH); gl.uniform2f(B.u_vcells, p.W, p.H); gl.uniform1f(B.u_u, u); gl.uniform1f(B.u_t, t); gl.uniform1f(B.u_sweep, sweep == null ? 1e9 : sweep); gl.uniform1f(B.u_feather, feather || 1); gl.uniform1f(B.u_dpr, p.dpr);
      quadDraw(B);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, null); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, null);
    }
    // The composed image read back (the audit's comparison with the CPU engine): premultiplied RGBA bytes, rows from the top.
    function readComposed(p) { gl.bindFramebuffer(gl.FRAMEBUFFER, T.comp.fbo); const px = new Uint8Array(p.W * p.H * 4); gl.readPixels(0, 0, p.W, p.H, gl.RGBA, gl.UNSIGNED_BYTE, px); gl.bindFramebuffer(gl.FRAMEBUFFER, null); const out = new Uint8Array(px.length), row = p.W * 4; for (let y = 0; y < p.H; y++) out.set(px.subarray((p.H - 1 - y) * row, (p.H - y) * row), y * row); return out; }
    return { ok: true, compose, blit, readComposed, free, targetsKey: () => T.size };
  };
  // ---- the Cells view's squares on the GPU (round 14, the author's decision of 25 October 2026) ---------------------------------------------------------------
  // One instanced quad per square of a grid (the 1 km squares from the address files, the 2021 250 m windows), coloured from a palette by a class index, with the
  // gap of round 13 (12 percent from 5 px, 10 percent at 250 m) and the edge covered exactly per device pixel, as the canvas filled the squares before. Positions
  // travel as grid indices; the camera's nearest grid index is subtracted on the GPU, so only small exact integers are multiplied. A window rectangle (km, relative
  // to the camera) can carry its own alpha factor, for the hand-over to a finer window inside it.
  const VS_SQ = `#version 300 es
in vec2 a_q; in vec2 a_b; in float a_c;
uniform vec2 u_rel; uniform vec2 u_ishift; uniform float u_T; uniform float u_gap; uniform float u_k; uniform float u_dpr; uniform vec2 u_o; uniform vec2 u_canvas;
uniform vec4 u_win; uniform float u_winIn; uniform float u_winOut;
out vec4 v_box; out float v_c; out float v_f;
void main() {
  vec2 km0 = u_rel + (a_b - u_ishift) * u_T + vec2(u_gap * 0.5), km1 = km0 + vec2(u_T - u_gap);
  float x0 = (u_o.x + km0.x * u_k) * u_dpr, x1 = (u_o.x + km1.x * u_k) * u_dpr, y0 = (u_o.y - km1.y * u_k) * u_dpr, y1 = (u_o.y - km0.y * u_k) * u_dpr;
  v_box = vec4(x0, y0, x1, y1); v_c = a_c;
  vec2 m = (km0 + km1) * 0.5; v_f = (m.x >= u_win.x && m.x < u_win.z && m.y >= u_win.y && m.y < u_win.w) ? u_winIn : u_winOut;
  vec2 p = mix(vec2(floor(x0) - 1.0, floor(y0) - 1.0), vec2(ceil(x1) + 1.0, ceil(y1) + 1.0), a_q);
  gl_Position = vec4(p.x / u_canvas.x * 2.0 - 1.0, 1.0 - p.y / u_canvas.y * 2.0, 0.0, 1.0);
}`;
  const FS_SQ = `#version 300 es
precision highp float;
in vec4 v_box; in float v_c; in float v_f; uniform vec3 u_pal[16]; uniform float u_al[16]; uniform float u_w; uniform vec2 u_canvas; out vec4 o;
void main() {
  vec2 px = vec2(gl_FragCoord.x, u_canvas.y - gl_FragCoord.y);
  float cx = clamp(min(px.x + 0.5, v_box.z) - max(px.x - 0.5, v_box.x), 0.0, 1.0), cy = clamp(min(px.y + 0.5, v_box.w) - max(px.y - 0.5, v_box.y), 0.0, 1.0);
  float cov = cx * cy; if (cov <= 0.0) discard;
  int ci = int(v_c + 0.5); float a = u_al[ci] * u_w * v_f * cov; o = vec4(u_pal[ci] * a, a);
}`;
  PF.createSquaresGL = function (gl) {
    if (!gl || typeof WebGL2RenderingContext === 'undefined' || !(gl instanceof WebGL2RenderingContext)) return { ok: false, reason: 'no WebGL2' };
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('squares shader: ' + gl.getShaderInfoLog(s)); return s; };
    let p; try { p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VS_SQ)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS_SQ)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('squares link: ' + gl.getProgramInfoLog(p)); } catch (e) { return { ok: false, reason: e.message }; }
    const L = { p }; for (const a of ['a_q', 'a_b', 'a_c']) L[a] = gl.getAttribLocation(p, a);
    for (const u of ['u_rel', 'u_ishift', 'u_T', 'u_gap', 'u_k', 'u_dpr', 'u_o', 'u_canvas', 'u_win', 'u_winIn', 'u_winOut', 'u_pal', 'u_al', 'u_w']) L[u] = gl.getUniformLocation(p, u);
    const quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]), gl.STATIC_DRAW);
    const sets = new Map();
    // A set of squares: grid indices (pairs) and class indices; kept by key (a year and a layer, or a window and a layer), the oldest dropped past eight.
    function upload(key, b, c) {
      if (sets.has(key)) return sets.get(key);
      const mk = data => { const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); return buf; };
      const s = { b: mk(b), c: mk(c), n: c.length }; sets.set(key, s);
      if (sets.size > 8) { const [k0, s0] = sets.entries().next().value; gl.deleteBuffer(s0.b); gl.deleteBuffer(s0.c); sets.delete(k0); }
      return s;
    }
    // Draw a set onto the bound canvas: q = { origin (km), T (km), gap (km), cam: { cx, cy, k, ox, oy }, dpr, canvas: [W, H], pal (48 floats), al (16), w, win: [x0, y0, x1, y1] km relative to the camera, winIn, winOut }.
    function draw(s, q) {
      gl.useProgram(p); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.viewport(0, 0, q.canvas[0], q.canvas[1]);
      const Bx = Math.floor((q.cam.cx - q.origin[0]) / q.T), By = Math.floor((q.cam.cy - q.origin[1]) / q.T);
      gl.uniform2f(L.u_rel, q.origin[0] + Bx * q.T - q.cam.cx, q.origin[1] + By * q.T - q.cam.cy); gl.uniform2f(L.u_ishift, Bx, By);
      gl.uniform1f(L.u_T, q.T); gl.uniform1f(L.u_gap, q.gap); gl.uniform1f(L.u_k, q.cam.k); gl.uniform1f(L.u_dpr, q.dpr); gl.uniform2f(L.u_o, q.cam.ox, q.cam.oy); gl.uniform2f(L.u_canvas, q.canvas[0], q.canvas[1]);
      const win = q.win || [1e9, 1e9, -1e9, -1e9]; gl.uniform4f(L.u_win, win[0], win[1], win[2], win[3]); gl.uniform1f(L.u_winIn, q.winIn == null ? 1 : q.winIn); gl.uniform1f(L.u_winOut, q.winOut == null ? 1 : q.winOut);
      gl.uniform3fv(L.u_pal, q.pal); gl.uniform1fv(L.u_al, q.al); gl.uniform1f(L.u_w, q.w);
      gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.enableVertexAttribArray(L.a_q); gl.vertexAttribPointer(L.a_q, 2, gl.FLOAT, false, 0, 0); gl.vertexAttribDivisor(L.a_q, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, s.b); gl.enableVertexAttribArray(L.a_b); gl.vertexAttribPointer(L.a_b, 2, gl.FLOAT, false, 0, 0); gl.vertexAttribDivisor(L.a_b, 1);
      gl.bindBuffer(gl.ARRAY_BUFFER, s.c); gl.enableVertexAttribArray(L.a_c); gl.vertexAttribPointer(L.a_c, 1, gl.UNSIGNED_BYTE, false, 0, 0); gl.vertexAttribDivisor(L.a_c, 1);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, s.n);
      gl.vertexAttribDivisor(L.a_b, 0); gl.vertexAttribDivisor(L.a_c, 0); gl.disableVertexAttribArray(L.a_q); gl.disableVertexAttribArray(L.a_b); gl.disableVertexAttribArray(L.a_c);
    }
    function free() { for (const s of sets.values()) { gl.deleteBuffer(s.b); gl.deleteBuffer(s.c); } sets.clear(); }
    return { ok: true, upload, draw, free, sets };
  };
  window.PixelField = PF;
})();
