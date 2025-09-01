// src/gestures/osSwipes.js
async function handleOsSwipes(ctx, hand) {
    const { CFG, keyChord, OS, state, tutor } = ctx;
    const v = hand.palmVelocity || [0,0,0]; const [vx, vy] = v;
    let swipe = null;
    if (Math.abs(vx) > Math.abs(vy)) { if (vx > CFG.swipeMinVel) swipe = 'right'; else if (vx < -CFG.swipeMinVel) swipe = 'left'; }
    else { if (vy > CFG.swipeMinVel) swipe = 'up'; else if (vy < -CFG.swipeMinVel) swipe = 'down'; }
    if (!swipe) return;
  
    if (ctx.now() - state.lastSwipeTs > 900) {
      state.lastSwipeTs = ctx.now();
      if (swipe === 'left')  await keyChord(OS.prevDesktop);
      if (swipe === 'right') await keyChord(OS.nextDesktop);
      if (swipe === 'up')    await keyChord(OS.missionControlUp);
      if (swipe === 'down')  await keyChord(OS.missionControlDown);
      tutor(`OS swipe: ${swipe}`);
    }
  }
  
  module.exports = { handleOsSwipes };
  