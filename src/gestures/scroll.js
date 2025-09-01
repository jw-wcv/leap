// src/gestures/scroll.js
// Two-finger scroll that feels like a mouse wheel flick.
// - Quantized "notches" for wheel feel
// - Velocity-based impulse feeding your engine's inertia
// - NO zoom logic here; zoom is handled by src/gestures/zoom.js

async function handleTwoFingerScroll(ctx, hand, iBox) {
  const { persist, state, tutor, CFG } = ctx;

  // Only extended fingers count
  const extF = (hand.fingers || []).filter(f => f.extended);
  if (extF.length < 2) {
    ctx._lastTwoCenter = null;
    state.scrollRampTicks = 0;
    state._scrollLastTs = undefined;
    return;
  }

  // Use the first two extended tips
  const f1 = extF[0], f2 = extF[1];
  const n1 = iBox.normalizePoint(f1.stabilizedTipPosition, true);
  const n2 = iBox.normalizePoint(f2.stabilizedTipPosition, true);

  // Midpoint in normalized box -> screen
  const c  = { nx: (n1[0] + n2[0]) / 2, ny: (n1[1] + n2[1]) / 2 };
  const p  = ctx._mapToScreen(c.nx, c.ny);

  // Framerate-normalized timing
  const now = ctx.now();
  const lastTs = state._scrollLastTs;
  state._scrollLastTs = now;

  if (ctx._lastTwoCenter) {
    // pixel deltas (invert Y so up is positive)
    const dxPx = (p.x - ctx._lastTwoCenter.x);
    const dyPx = (p.y - ctx._lastTwoCenter.y) * -1;

    // Normalize velocity to ~per-16ms frame so fast flicks boost more
    let vX = 0, vY = 0;
    if (typeof lastTs === 'number') {
      const dtMs = Math.max(1, now - lastTs);
      const norm = 16 / dtMs; // scale deltas to a 60fps-equivalent impulse
      vX = dxPx * norm;
      vY = dyPx * norm;
    }

    // Gentle ramp-in to avoid first-frame burst
    state.scrollRampTicks = Math.min(6, (state.scrollRampTicks || 0) + 1);
    const ramp = state.scrollRampTicks / 6;

    // ---------- Convert to wheel "notches" ----------
    const notchGain      = CFG?.scrollFlickGain      ?? 0.22; // steps per (normalized) pixel
    const notchMin       = CFG?.scrollStepMin        ?? 1;    // minimum per tick
    const notchMax       = CFG?.scrollStepMax        ?? 6;    // clamp per-frame burst
    const expo           = CFG?.scrollExpo           ?? 1.0;  // >1 exaggerates flicks
    const inertiaBoost   = CFG?.scrollInertiaBoost   ?? 1.0;  // feed kinetic tail

    // Base from displacement (slow drags)
    const baseX = Math.sign(dxPx) * Math.pow(Math.abs(dxPx) * notchGain, expo) * ramp;
    const baseY = Math.sign(dyPx) * Math.pow(Math.abs(dyPx) * notchGain, expo) * ramp;

    // Extra from velocity (flicks)
    const velX  = Math.sign(vX) * Math.pow(Math.abs(vX) * notchGain * 0.6, expo);
    const velY  = Math.sign(vY) * Math.pow(Math.abs(vY) * notchGain * 0.6, expo);

    // Combine & quantize to integer wheel steps
    const rawX = baseX + velX;
    const rawY = baseY + velY;

    const stepX = quantizeNotches(rawX, notchMin, notchMax);
    const stepY = quantizeNotches(rawY, notchMin, notchMax);

    // Output (no Cmd modifier here; zoom is handled elsewhere)
    if (stepY) (stepY > 0 ? ctx.mouse.scrollUp(stepY) : ctx.mouse.scrollDown(-stepY));
    if (stepX) (stepX > 0 ? ctx.mouse.scrollRight(stepX) : ctx.mouse.scrollLeft(-stepX));

    // Kinetic tail (engine decays in _animate)
    if (persist.scrollInertia?.enabled) {
      state.inertia.vx = Math.trunc(stepX * inertiaBoost);
      state.inertia.vy = Math.trunc(stepY * inertiaBoost);
      state.inertia.active = (Math.abs(state.inertia.vx) + Math.abs(state.inertia.vy)) > 0;
    }

    if (Math.abs(stepX) + Math.abs(stepY) > 0) tutor('Scroll');
  } else {
    state.scrollRampTicks = 0;
  }

  ctx._lastTwoCenter = p;
}

// Quantize continuous value into wheel-like integer steps with a minimum notch
function quantizeNotches(value, minStep, maxStep) {
  const s = Math.round(value);
  if (s === 0) return 0;
  const abs = Math.max(minStep, Math.min(Math.abs(s), maxStep));
  return s > 0 ? abs : -abs;
}

module.exports = { handleTwoFingerScroll };
