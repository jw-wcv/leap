const { clamp01 } = require('../core/utils');

function mapToScreen(ctx, nx, ny) {
  const r = ctx.state.cal.rect, W = ctx.state.screen.w, H = ctx.state.screen.h;
  const tx = clamp01((nx - r.x0) / (r.x1 - r.x0));
  const ty = clamp01((ny - r.y0) / (r.y1 - r.y0));
  return { x: tx * W, y: (1 - ty) * H };
}

function startCalibration(ctx) {
  ctx.state.cal = { active:true, step:'A', A:null, B:null, rect: ctx.state.cal.rect };
  ctx.onCalState({ mode:'start', step:'A' });
}
function cancelCalibration(ctx) {
  ctx.state.cal.active = false; ctx.state.cal.step = 'idle';
  ctx.onCalState({ mode:'cancel' });
}
function finishCalibration(ctx) {
  const { A, B } = ctx.state.cal; if (!A || !B) return;
  const x0 = Math.min(A.nx, B.nx), x1 = Math.max(A.nx, B.nx);
  const y0 = Math.min(A.ny, B.ny), y1 = Math.max(A.ny, B.ny);
  const eps = 0.05;
  const rect = { x0: Math.max(0, Math.min(1, x0)), x1: Math.max(eps, Math.min(1, x1)), y0: Math.max(0, Math.min(1, y0)), y1: Math.max(eps, Math.min(1, y1)) };
  const did = ctx.state.displayId ? String(ctx.state.displayId) : null;
  if (did) {
    ctx.persist.perDisplay = ctx.persist.perDisplay || {};
    ctx.persist.perDisplay[did] = { rect };
    ctx.onSave({ calibration:{rect}, perDisplay: ctx.persist.perDisplay });
    ctx.onCalState({ mode:'done', rect, displayId: ctx.state.displayId });
  } else { ctx.onSave({ calibration:{rect} }); ctx.onCalState({ mode:'done', rect }); }
  ctx.state.cal.active = false; ctx.state.cal.step = 'done';
}

module.exports = { startCalibration, cancelCalibration, finishCalibration, mapToScreen };
