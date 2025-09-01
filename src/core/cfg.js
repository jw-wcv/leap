// src/core/cfg.js
// Centralized tunables

module.exports = {
  // Pointer smoothing: 0 (none) .. 1 (very sluggish)
  smoothing: 0.22,

  // Pinch gesture thresholds (hysteresis)
  // Use pinchOn to start a pinch, pinchOff to release it (lower than pinchOn)
  pinchOn: 0.55,
  pinchOff: 0.35,

  // Pinch zoom thresholds (hysteresis)
  // Use pinchZoomOn to start a pinch zoom, pinchZoomOff to release it (lower than pinchZoomOn)
  pinchZoomOn: 0.75,
  pinchZoomOff: 0.55,
  zoomDistOn: 0.015,
  zoomDistOff: 0.008,
  zoomDistToWheelScale: 300,

  // Max duration (ms) to treat a pinch as a "tap" (click) when released
  pinchTapMs: 220,

  // Scroll scaling for 2F scroll handler (multiplier on delta)
  scrollScale: 1.0,
  scrollFlickGain:    0.28, // higher = bigger steps
  scrollStepMin:      1,
  scrollStepMax:      6,    // 4..6 feels crisp; lower to calm it
  scrollExpo:         1.0,  // 1.1 for a bit more “pop”
  scrollInertiaBoost: 1.2,  // >1 for longer glide


  // Swipe detection (if you use velocity-based swipes)
  swipeMinVel: 900,

  // Hold time for 5F show-desktop (ms)
  fiveHoldMs: 400,

  // Mouse micro-movement deadzone (screen px)
  deadzonePx: 2,

  // Window mode tick cadence (ms)
  windowTickMs: 20,

  // Grab (drag) thresholds (hysteresis)
  grabOn: 0.50,
  grabOff: 0.35,

  // Gains for window resize (tune to your sensor distance)
  resizeRollGain: 800,
  resizePitchGain: 600,

  // Velocity for snapping while in move mode
  moveSnapSwipeVel: 800,

  // Dwell: cancel if palm velocity exceeds this (mm/s)
  minPalmVelForDwellCancel: 120,

  // Adaptive pointer gain curve (used by _adaptiveGain)
  // Gain rises from gainMin -> gainMax as lastPalmVel moves from velLow -> velHigh
  pointerGain: {
    enabled: true,
    gainMin: 0.9,
    gainMax: 2.6,
    velLow: 180,
    velHigh: 1100
  }
};
