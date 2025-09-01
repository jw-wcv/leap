// src/gestures/dwellClick.js
async function tickDwell(ctx) {
  const { persist, state, mouse, tutor, now, CFG } = ctx;
  const P = persist.dwell;
  if (!P?.enabled) return;
  if (state.dragging || state.windowMode !== 'none' || state.isPinching) return;

  // Cancel dwell if palm moving too fast (use lastPalmVel set by engine)
  const cancelVel = CFG?.minPalmVelForDwellCancel ?? 120; // mm/s
  if ((state.lastPalmVel || 0) > cancelVel) {
    state.dwellAnchor = null; state.dwellStartTs = 0;
    return;
  }

  const ts = now();
  if (ts < (state.dwellCooldownTs || 0)) return;

  const anchor = state.dwellAnchor || { x: state.pos.x, y: state.pos.y };
  const distPx = Math.hypot((anchor.x ?? 0) - (state.pos.x ?? 0), (anchor.y ?? 0) - (state.pos.y ?? 0));

  if (!state.dwellAnchor || distPx > (P.radiusPx ?? 10)) {
    state.dwellAnchor = { x: state.pos.x, y: state.pos.y };
    state.dwellStartTs = ts;
    return;
  }
  if (ts - (state.dwellStartTs || 0) >= (P.ms ?? 650)) {
    await mouse.click(ctx.Button.LEFT);
    tutor?.('Dwell click');
    state.dwellCooldownTs = ts + (P.cooldownMs ?? 800);
    state.dwellAnchor = null; state.dwellStartTs = 0;
  }
}
module.exports = { tickDwell };
