const { now } = require('../core/utils');

function pinchClickInit(state) {
  state.isPinching = false;
  state.pinchStartTs = 0;
  state.tapCount = state.tapCount ?? 0;
  state.lastTapTs = state.lastTapTs ?? 0;
  if (state.tapTimer) clearTimeout(state.tapTimer);
  state.tapTimer = null;
}

async function handlePinchClick(ctx, isPinching) {
  const { state, persist, tutor, mouse, CFG } = ctx;
  const dblMs = persist.clicks?.doublePinchMs ?? 350;
  const tapMs = CFG?.pinchTapMs ?? 220;
  const moveCancelPx = 10; // cancel tap if cursor moved too far during tap

  if (isPinching && !state.isPinching) {
    state.isPinching = true;
    state.pinchStartTs = now();
    state.pinchStartPos = { x: state.pos.x, y: state.pos.y };
    return;
  }

  if (!isPinching && state.isPinching) {
    const dur = now() - (state.pinchStartTs || 0);
    state.isPinching = false;

    // movement guard: cancel tap if we moved too much during the pinch
    const dx = (state.pos.x || 0) - (state.pinchStartPos?.x || 0);
    const dy = (state.pos.y || 0) - (state.pinchStartPos?.y || 0);
    const movedTooMuch = Math.hypot(dx, dy) > moveCancelPx;

    const validTap = dur <= tapMs && !movedTooMuch && !state.dragging && state.windowMode === 'none';
    if (!validTap) return;

    const t = now();
    state.tapCount = (t - (state.lastTapTs || 0) <= dblMs) ? (state.tapCount + 1) : 1;
    state.lastTapTs = t;
    if (state.tapTimer) clearTimeout(state.tapTimer);

    state.tapTimer = setTimeout(async () => {
      try {
        if (state.tapCount >= 3 && persist.clicks?.enableMiddleTriple) { await mouse.click(ctx.Button.MIDDLE); tutor?.('Middle click'); }
        else if (state.tapCount === 2)                                 { await mouse.click(ctx.Button.RIGHT);  tutor?.('Right click'); }
        else                                                           { await mouse.click(ctx.Button.LEFT);   tutor?.('Click'); }
      } finally {
        state.tapCount = 0;
      }
    }, dblMs);
  }
}

module.exports = { pinchClickInit, handlePinchClick };
