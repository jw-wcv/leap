async function tickDwell(ctx) {
    const { persist, state, mouse, tutor, now } = ctx;
    const P = persist.dwell;
    if (!P.enabled || state.dragging || state.windowMode !== 'none') return;
    const ts = now();
    if (ts < state.dwellCooldownTs) return;
    const anchor = state.dwellAnchor || { x: state.pos.x, y: state.pos.y };
    const distPx = Math.hypot(anchor.x - state.pos.x, anchor.y - state.pos.y);
    if (!state.dwellAnchor || distPx > P.radiusPx) {
      state.dwellAnchor = { x: state.pos.x, y: state.pos.y };
      state.dwellStartTs = ts;
      return;
    }
    if (ts - state.dwellStartTs >= P.ms) {
      await mouse.click(ctx.Button.LEFT);
      tutor('Dwell click');
      state.dwellCooldownTs = ts + P.cooldownMs;
      state.dwellAnchor = null; state.dwellStartTs = 0;
    }
  }
  
  module.exports = { tickDwell };
  