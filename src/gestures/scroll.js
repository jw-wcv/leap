// src/gestures/scroll.js
async function handleTwoFingerScroll(ctx, hand, iBox) {
  const { persist, keyboard, Key, state, tutor } = ctx;
  const fingers = (hand.fingers || []).filter(f => f.extended);
  if (fingers.length < 2) { ctx._lastTwoCenter = null; state.scrollRampTicks = 0; return; }

  const n1 = iBox.normalizePoint(fingers[0].stabilizedTipPosition, true);
  const n2 = iBox.normalizePoint(fingers[1].stabilizedTipPosition, true);
  const c  = { nx: (n1[0] + n2[0]) / 2, ny: (n1[1] + n2[1]) / 2 };
  const p  = ctx._mapToScreen(c.nx, c.ny);

  if (ctx._lastTwoCenter) {
    const dx = (p.x - ctx._lastTwoCenter.x);
    const dy = (p.y - ctx._lastTwoCenter.y);

    // Gentle ramp-in to avoid bursts on first few frames
    state.scrollRampTicks = Math.min(6, (state.scrollRampTicks || 0) + 1);
    const ramp = state.scrollRampTicks / 6;

    const stepX = Math.round(dx * (persist.scrollInertia.burstScale || 0.05) * ramp);
    const stepY = Math.round(-dy * (persist.scrollInertia.burstScale || 0.05) * ramp);

    const pinch = hand.pinchStrength || 0;
    const zoom  = ctx.opts.zoomWithCmdScrollOnPinch && pinch > 0.7;

    if (zoom) await keyboard.pressKey(Key.LeftSuper);
    try {
      if (stepY) (stepY > 0 ? ctx.mouse.scrollUp(stepY) : ctx.mouse.scrollDown(-stepY));
      if (stepX) (stepX > 0 ? ctx.mouse.scrollRight(stepX) : ctx.mouse.scrollLeft(-stepX));
    } finally {
      if (zoom) await keyboard.releaseKey(Key.LeftSuper);
    }

    // Inertia only when not zooming
    if (persist.scrollInertia.enabled && !zoom) {
      state.inertia.vx = stepX;
      state.inertia.vy = stepY;
      state.inertia.active = (Math.abs(stepX) + Math.abs(stepY)) > 0;
    }

    if (Math.abs(stepX) + Math.abs(stepY) > 0) tutor(zoom ? 'Zoom' : 'Scroll');
  } else {
    state.scrollRampTicks = 0;
  }
  ctx._lastTwoCenter = p;
}

module.exports = { handleTwoFingerScroll };
