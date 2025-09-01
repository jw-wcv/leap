// src/gestures/osSwipes.js
async function handleOsSwipes(ctx, hand) {
  const { CFG, keyChord, OS, state, tutor } = ctx;
  const fingers = hand.fingers || [];
  const extCount = fingers.filter(f => f.extended).length;

  // Require 4+ extended and very low grab to avoid fights with other modes
  if (extCount < 4 || (hand.grabStrength || 0) > 0.2) return;

  const v = hand.palmVelocity || [0,0,0];
  const [vx, vy] = v;
  const ax = Math.abs(vx), ay = Math.abs(vy);

  // Direction dominance: horizontal vs vertical
  let swipe = null;
  if (ax > ay && ax > CFG.swipeMinVel) swipe = (vx > 0 ? 'right' : 'left');
  if (ay > ax && ay > CFG.swipeMinVel) swipe = (vy > 0 ? 'up' : 'down');
  if (!swipe) return;

  const now = ctx.now();
  if ((now - (state.lastSwipeTs || 0)) < 700) return; // cooldown

  state.lastSwipeTs = now;
  if (swipe === 'left')  await keyChord(OS.prevDesktop);
  if (swipe === 'right') await keyChord(OS.nextDesktop);
  if (swipe === 'up')    await keyChord(OS.missionControlUp);
  if (swipe === 'down')  await keyChord(OS.missionControlDown);
  tutor(`OS swipe: ${swipe}`);
}

module.exports = { handleOsSwipes };
