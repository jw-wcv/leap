// src/gestures/zoom.js
// Two-finger spread/pinch zoom controlled by distance change + hysteresis.
// Sends Cmd+Scroll (LeftSuper) so it works across desktop apps.

async function handleTwoFingerZoom(ctx, hand, iBox) {
  const { CFG, keyboard, Key, mouse, state, tutor, opts } = ctx;
  if (!opts.zoomWithCmdScrollOnPinch) return false; // user can disable globally

  const fingers = (hand.fingers || []).filter(f => f.extended);
  if (fingers.length < 2) { state.zoomActive = false; state._zoomLastDist = undefined; return false; }

  // --- Pick the pair ---
  // Prefer pinch pair: thumb + index. If not available, use the two most stable (first two extended).
  let f1, f2;
  const thumb = fingers.find(f => f.type === 0);
  const index = fingers.find(f => f.type === 1);
  if (thumb && index) { f1 = thumb; f2 = index; }
  else { f1 = fingers[0]; f2 = fingers[1]; }

  // Normalized positions in InteractionBox
  const n1 = iBox.normalizePoint(f1.stabilizedTipPosition, true);
  const n2 = iBox.normalizePoint(f2.stabilizedTipPosition, true);
  const dx = (n1[0] - n2[0]);
  const dy = (n1[1] - n2[1]);
  const dist = Math.hypot(dx, dy);   // 0..~1 in normalized box

  // Hysteresis on "zoom intent" using pinch strength (robust) + distance gate
  const pinch = hand.pinchStrength ?? 0;
  const onThresh  = CFG?.pinchZoomOn  ?? 0.75;
  const offThresh = CFG?.pinchZoomOff ?? 0.55;

  // Small distance gates to avoid noise (normalized units)
  const distOn  = CFG?.zoomDistOn  ?? 0.015; // ~1.5% of box
  const distOff = CFG?.zoomDistOff ?? 0.008;

  // Decide if we *allow* zoom right now
  if (!state.zoomActive) {
    if (pinch >= onThresh && dist >= distOn) state.zoomActive = true;
  } else {
    if (pinch <= offThresh || dist <= distOff) state.zoomActive = false;
  }

  // If no zoom, reset dist and exit (so scroll gesture can run)
  if (!state.zoomActive) { state._zoomLastDist = dist; return false; }

  // --- We are zooming: transform delta-distance -> Cmd+Scroll ---
  const last = state._zoomLastDist;
  state._zoomLastDist = dist;
  if (typeof last !== 'number') return true; // consume this frame but no motion yet

  const d = dist - last; // >0 spreading (zoom in), <0 pinching (zoom out)

  // Convert to wheel steps; scale + clamp
  // Feel: small hand motion == subtle zoom, larger == faster.
  const scale = (CFG?.zoomDistToWheelScale ?? 300); // multiplier to convert normalized dist delta to "wheel"
  let stepY = Math.round(d * scale);

  // Debounce tiny noise
  if (Math.abs(stepY) < 1) return true;

  await keyboard.pressKey(Key.LeftSuper);
  try {
    // zoom in = scroll up; zoom out = scroll down
    if (stepY > 0) await mouse.scrollUp(stepY);
    else           await mouse.scrollDown(-stepY);
  } finally {
    await keyboard.releaseKey(Key.LeftSuper);
  }

  tutor?.('Zoom');
  return true; // signal to skip two-finger scroll this frame
}

module.exports = { handleTwoFingerZoom };
