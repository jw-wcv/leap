// src/gestures/drag.js
async function maybeStartDrag(ctx) {
  const { state, mouse, tutor, CFG } = ctx;

  // Don't start if we're already dragging or in a window mode
  if (state.dragging || state.windowMode !== 'none') return;

  // Require deliberate grab and a brief "stationary" moment
  const t = ctx.now();
  const stillEnough = (ctx.lastPalmVel || state.lastPalmVel || 0) < 120; // mm/s
  const overGrabOn  = (state.lastGrab || 0) >= CFG.grabOn;

  // Small guard to avoid spamming pressButton if grab flickers
  if (!overGrabOn || !stillEnough) return;

  await mouse.pressButton(ctx.Button.LEFT);
  state.dragging = true;
  tutor('Drag start');
}

async function endThreeDrag(ctx) {
  const { state, mouse, tutor } = ctx;
  if (state.threeDrag) {
    await mouse.releaseButton(ctx.Button.LEFT);
    state.threeDrag = false;
    tutor('3-finger drag end');
  }
}

async function startThreeDrag(ctx) {
  const { state, mouse, tutor } = ctx;
  if (!state.threeDrag) {
    await mouse.pressButton(ctx.Button.LEFT);
    state.threeDrag = true;
    tutor('3-finger drag');
  }
}

module.exports = { maybeStartDrag, startThreeDrag, endThreeDrag };
