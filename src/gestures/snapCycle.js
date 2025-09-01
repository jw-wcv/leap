// src/gestures/snapCycle.js
async function maybeSnapCycle(ctx, pinchTap, ext) {
    const { state } = ctx;
    if (!pinchTap || state.windowMode !== 'move' || ext !== 4) return;
    const t = ctx.now();
    if (t - state.lastSnapTapTs < 400) return;
    state.lastSnapTapTs = t;
    const which = state.snapOrder[state.snapIndex % state.snapOrder.length];
    state.snapIndex++;
    await ctx._axSnap(which);
  }
  
  async function maybeMoveModeSnapSwipes(ctx, hand, dx, dy) {
    const { CFG } = ctx;
    const v = hand.palmVelocity || [0,0,0];
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(v[0]) > CFG.moveSnapSwipeVel) {
      await ctx._axSnap(dx > 0 ? 'right' : 'left');
    } else if (Math.abs(dy) > Math.abs(dx) && Math.abs(v[1]) > CFG.moveSnapSwipeVel) {
      await ctx._axSnap(dy < 0 ? 'top' : 'bottom');
    }
  }
  
  module.exports = { maybeSnapCycle, maybeMoveModeSnapSwipes };
  