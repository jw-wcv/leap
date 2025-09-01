// src/gestures/pinchClick.js
const { now } = require('../core/utils');

function pinchClickInit(state, persist, tutor) {
  state.isPinching = false;
  state.pinchStartTs = 0;
  state.tapCount = state.tapCount ?? 0;
  state.lastTapTs = state.lastTapTs ?? 0;
  state.tapTimer && clearTimeout(state.tapTimer);
  state.tapTimer = null;
}

async function handlePinchClick(ctx, isPinching) {
  const { state, persist, tutor, mouse } = ctx;
  const dblMs = persist.clicks?.doublePinchMs ?? 350;
  const tapMs = ctx.CFG?.pinchTapMs ?? 200;      // <-- fallback so taps register

  if (isPinching && !state.isPinching) {
    state.isPinching = true;
    state.pinchStartTs = now();
    return;
  }
  if (!isPinching && state.isPinching) {
    const dur = now() - (state.pinchStartTs || 0);
    state.isPinching = false;

    const validTap = dur <= tapMs && !state.dragging && state.windowMode === 'none';
    if (!validTap) return;

    const t = now();
    state.tapCount = (t - (state.lastTapTs || 0) <= dblMs) ? (state.tapCount + 1) : 1;
    state.lastTapTs = t;
    state.tapTimer && clearTimeout(state.tapTimer);

    state.tapTimer = setTimeout(async () => {
      try {
        if (state.tapCount >= 3 && (persist.clicks?.enableMiddleTriple)) {
          await mouse.click(ctx.Button.MIDDLE); tutor?.('Middle click');
        } else if (state.tapCount === 2) {
          await mouse.click(ctx.Button.RIGHT);  tutor?.('Right click');
        } else {
          await mouse.click(ctx.Button.LEFT);   tutor?.('Click');
        }
      } finally {
        state.tapCount = 0;
      }
    }, dblMs);
  }
}

module.exports = { pinchClickInit, handlePinchClick };
