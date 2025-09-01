// src/core/cfg.js
// Centralized tunables

module.exports = {
  // Pointer smoothing: 0 (none) .. 1 (very sluggish)
  smoothing: 0.22,

  // Pinch gesture thresholds (hysteresis)
  // Use pinchOn to start a pinch, pinchOff to release it (lower than pinchOn)
  pinchOn: 0.55,
  pinchOff: 0.35,

  // Max duration (ms) to treat a pinch as a "tap" (click) when released
  pinchTapMs: 220,

  // Scroll scaling for 2F scroll handler (multiplier on delta)
  scrollScale: 1.0,

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
