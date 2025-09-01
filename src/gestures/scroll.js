// src/gestures/scroll.js
async function handleTwoFingerScroll(ctx, hand, iBox) {
    const { persist, keyboard, Key, state, tutor } = ctx;
    const fingers = hand.fingers.filter(f=>f.extended);
    if (fingers.length < 2) { ctx._lastTwoCenter = null; return; }
  
    const n1 = iBox.normalizePoint(fingers[0].stabilizedTipPosition, true);
    const n2 = iBox.normalizePoint(fingers[1].stabilizedTipPosition, true);
    const c = { nx: (n1[0]+n2[0])/2, ny: (n1[1]+n2[1])/2 };
    const p = ctx._mapToScreen(c.nx, c.ny);
  
    if (ctx._lastTwoCenter) {
      const dx = (p.x - ctx._lastTwoCenter.x);
      const dy = (p.y - ctx._lastTwoCenter.y);
      const stepX = Math.round(dx * persist.scrollInertia.burstScale);
      const stepY = Math.round(-dy * persist.scrollInertia.burstScale);
  
      const pinch = hand.pinchStrength || 0;
      const zoom = ctx.opts.zoomWithCmdScrollOnPinch && pinch > 0.7;
      if (zoom) await keyboard.pressKey(Key.LeftSuper);
      try {
        if (stepY) (stepY > 0 ? ctx.mouse.scrollUp(stepY) : ctx.mouse.scrollDown(-stepY));
        if (stepX) (stepX > 0 ? ctx.mouse.scrollRight(stepX) : ctx.mouse.scrollLeft(-stepX));
      } finally { if (zoom) await keyboard.releaseKey(Key.LeftSuper); }
  
      if (persist.scrollInertia.enabled && !zoom) {
        state.inertia.vx = stepX; state.inertia.vy = stepY; state.inertia.active = true;
      }
      if (Math.abs(stepX)+Math.abs(stepY) > 0) tutor('Scroll');
    }
    ctx._lastTwoCenter = p;
  }
  
  module.exports = { handleTwoFingerScroll };
  