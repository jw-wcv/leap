// src/gestures/windowModes.js
async function enterWindowMode(ctx, mode, refPt, hand) {
  const { state, tutor, CFG } = ctx;

  // small enter guard to prevent accidental mode flips
  const now = ctx.now();
  if (now - (state.lastWindowTick || 0) < 120) return;

  state.windowMode = mode;
  state.windowRefPt = refPt;
  if (mode === 'resize') {
    state.resizeBaseline.roll = hand.roll?.() || 0;
    state.resizeBaseline.pitch = hand.pitch?.() || 0;
  }
  state.gcr.acquire(mode === 'move' ? 'windowMove' : 'windowResize', extCount(hand));
  tutor(mode === 'move' ? 'Window: Move mode' : 'Window: Resize mode');
}

function exitWindowMode(ctx) {
  const { state, tutor } = ctx;
  if (state.windowMode !== 'none') tutor('Window mode off');
  state.windowMode = 'none';
  state.windowRefPt = null;
}

async function tickWindowMode(ctx, currPt, hand) {
  const { state, CFG } = ctx;
  if (state.windowMode === 'none') return;

  const t = ctx.now();
  if (t - (state.lastWindowTick || 0) < CFG.windowTickMs) return;
  state.lastWindowTick = t;

  if (state.windowMode === 'move') {
    const dx = (currPt.x - state.windowRefPt.x) * ctx.opts.windowMoveScale;
    const dy = (currPt.y - state.windowRefPt.y) * ctx.opts.windowMoveScale;

    // apply a soft clamp to ignore jitter
    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
      await ctx._axMoveBy(dx, dy);
      state.windowRefPt = currPt;
    }
  } else if (state.windowMode === 'resize') {
    const roll = hand.roll?.() || 0, pitch = hand.pitch?.() || 0;
    const dRoll = roll - state.resizeBaseline.roll;
    const dPitch = pitch - state.resizeBaseline.pitch;

    const dw = dRoll * CFG.resizeRollGain * ctx.opts.windowResizeScale;
    const dh = dPitch * CFG.resizePitchGain * ctx.opts.windowResizeScale * -1;

    if (Math.abs(dw) > 1 || Math.abs(dh) > 1) {
      await ctx._axResizeBy(dw, dh);
      state.resizeBaseline.roll = roll;
      state.resizeBaseline.pitch = pitch;
    }
  }
}

// helper: count extended
function extCount(hand) {
  return Array.isArray(hand?.fingers) ? hand.fingers.filter(f => f.extended).length : 0;
}

module.exports = { enterWindowMode, exitWindowMode, tickWindowMode };
