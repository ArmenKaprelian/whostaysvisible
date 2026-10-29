# The atlas's cursor crosshair (retired 29 October 2026)

The author asked on 29 October 2026 for the map's fuchsia crosshair to be removed from the atlas, and for it to stay on record for use in another project. This note keeps the code and how it behaved. The last commit that has it in the atlas is `f895dcd` (29 October 2026): `git show f895dcd:motion/js/explorer-app.js`, functions `drawOverlay`, `setCross`, `easeCross`, `crossOff` and the call in `showHoverAt`. It came in with round 9 (25 October 2026, the cursor tile and crosshair).

## What it did

- Two 2 px lines, one vertical and one horizontal, cross at the pointer and run to the map's edges, at 0.9 opacity.
- Colour: the cursor fuchsia (`#FF45C8`) once the pointer has been still for 200 ms, the paler live fuchsia (`#FF8FDF`) while it moves.
- The lines trail the pointer: each move eases them to the new position over 120 ms (ease-out cubic). Under `prefers-reduced-motion`, or on a touch, they jump.
- Lines sit on whole pixels plus 0.5, so a 1 px or 2 px stroke stays sharp.
- They are drawn on the overlay canvas, the top canvas above the map, the marks and the hover ring, and cleared with it.

## The code (from `motion/js/explorer-app.js` at `f895dcd`)

State and the easing loop:

```js
let stillTimer = 0, cursorStill = true;
const cross = { on: false, x: 0, y: 0, tx: 0, ty: 0, x0: 0, y0: 0, t0: 0, raf: 0 };
function crossOff() { cross.on = false; if (cross.raf) { cancelAnimationFrame(cross.raf); cross.raf = 0; } if (stillTimer) { clearTimeout(stillTimer); stillTimer = 0; } cursorStill = true; wrap.classList.remove('cursor-live'); }
function setCross(x, y, snap) {
  cross.tx = x; cross.ty = y;
  if (snap || !cross.on || reduceMotion()) { cross.on = true; cross.x = x; cross.y = y; if (cross.raf) { cancelAnimationFrame(cross.raf); cross.raf = 0; } return; }
  cross.x0 = cross.x; cross.y0 = cross.y; cross.t0 = performance.now(); if (!cross.raf) cross.raf = requestAnimationFrame(easeCross);
}
function easeCross() {
  cross.raf = 0; const u = Math.min(1, (performance.now() - cross.t0) / 120), e = Motion.ease.outCubic(u);   // outCubic: t => 1 - Math.pow(1 - t, 3)
  cross.x = cross.x0 + (cross.tx - cross.x0) * e; cross.y = cross.y0 + (cross.ty - cross.y0) * e;
  drawOverlay(state.hover); if (u < 1) cross.raf = requestAnimationFrame(easeCross);
}
function armStill(touch) {   // the still state: the live colour while moving, the resting colour after 200 ms
  if (stillTimer) clearTimeout(stillTimer);
  if (touch) { cursorStill = true; wrap.classList.remove('cursor-live'); return; }
  cursorStill = false; wrap.classList.add('cursor-live');
  stillTimer = setTimeout(() => { stillTimer = 0; cursorStill = true; wrap.classList.remove('cursor-live'); drawOverlay(state.hover); }, 200);
}
```

The drawing, at the top of the overlay's redraw (`octx` is the overlay canvas's 2D context, `stage` its CSS size and device scale):

```js
function drawOverlay(h) {
  octx.setTransform(stage.scale, 0, 0, stage.scale, 0, 0); octx.clearRect(0, 0, stage.width, stage.height);
  if (cross.on) {
    const cx = Math.round(cross.x) + 0.5, cy = Math.round(cross.y) + 0.5;
    octx.strokeStyle = cursorStill ? theme.cursor : theme.cursorLive; octx.lineWidth = 2; octx.globalAlpha = 0.9;
    octx.beginPath(); octx.moveTo(cx, 0); octx.lineTo(cx, stage.height); octx.moveTo(0, cy); octx.lineTo(stage.width, cy); octx.stroke(); octx.globalAlpha = 1;
  }
  // ... the hover ring and the rest of the overlay
}
```

The hook-up, in the pointer-move handler (`x`, `y` in CSS px within the map): `setCross(x, y, !!opts.touch); drawOverlay(h); armStill(!!opts.touch);`, and `crossOff()` when the pointer leaves the map.

## To reuse it

Put a canvas over the element, size it to the element times `devicePixelRatio`, and call `setCross` from a `pointermove` listener and `crossOff` (then a redraw) from `pointerleave`. The two colours are the only theme values it needs.
