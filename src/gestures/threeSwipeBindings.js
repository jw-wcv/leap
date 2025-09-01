// src/gestures/threeSwipeBindings.js
async function maybeThreeSwipeBinding(ctx, hand, ext) {
  if (ext !== 3 || ctx.opts.threeFingerDrag) return false;
  if ((hand.grabStrength || 0) > 0.2) return false; // avoid binding while gripping

  const v = hand.palmVelocity || [0,0,0];
  const ax = Math.abs(v[0]), ay = Math.abs(v[1]);
  let dir = null;
  if (ax > ay) {
    if (v[0] >  ctx.CFG.swipeMinVel) dir = 'right';
    else if (v[0] < -ctx.CFG.swipeMinVel) dir = 'left';
  } else {
    if (v[1] >  ctx.CFG.swipeMinVel) dir = 'up';
    else if (v[1] < -ctx.CFG.swipeMinVel) dir = 'down';
  }
  if (!dir) return false;

  const prof = ctx.profiles.getProfileFor(ctx.frontBundleId || 'default');
  const binding = prof.bindings?.[`threeSwipe.${dir}`];
  if (binding) { await ctx.profiles.runBinding(binding); ctx.tutor(`3F swipe: ${dir}`); return true; }
  return false;
}

module.exports = { maybeThreeSwipeBinding };
