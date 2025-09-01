const CFG = require('../../src/core/cfg');

function makeMockCtx(overrides = {}) {
  const tutorEvents = [];
  const hudEvents = [];

  const ctx = {
    CFG: { ...CFG },
    now: () => Date.now(),
    avg: (a,b,t)=>a+(b-a)*t,
    clamp01: v=>Math.max(0,Math.min(1,v)),
    lerp: (a,b,t)=>a+(b-a)*t,

    // mock IO
    mouse: {
      click: jest.fn(),
      pressButton: jest.fn(),
      releaseButton: jest.fn(),
      scrollUp: jest.fn(),
      scrollDown: jest.fn(),
      scrollLeft: jest.fn(),
      scrollRight: jest.fn(),
      setPosition: jest.fn()
    },
    keyboard: { pressKey: jest.fn(), releaseKey: jest.fn() },
    Button: { LEFT: 1, RIGHT: 2, MIDDLE: 3 }, // minimal enum
    Key: {},

    // engine state & options
    state: {
      windowMode: 'none',
      gcr: { current: ()=>null, acquire: jest.fn(()=>true), release: jest.fn(), canSwitch: ()=>true },
      // add as tests need
    },
    opts: { threeFingerDrag: true, zoomWithCmdScrollOnPinch: true, windowMoveScale: 1.0, windowResizeScale: 1.0 },
    persist: {
      clicks: { doublePinchMs: 350, enableMiddleTriple: true },
      dwell: { enabled: true, ms: 650, radiusPx: 10, cooldownMs: 800 },
      pointerGain: { enabled: true, gainMin: 1.0, gainMax: 2.2, velLow: 200, velHigh: 1000 },
      scrollInertia: { enabled: true, decay: 0.9, minStep: 1, burstScale: 0.05 }
    },

    // stubs used by modules
    tutor: (m)=>tutorEvents.push(m),
    _hudPatch: (p)=>hudEvents.push(p),
    onSave: jest.fn(),
    onCalState: jest.fn(),
    profiles: { getProfileFor: ()=>({}), runBinding: jest.fn() },

    // mapping used by scroll & tests
    _mapToScreen: (nx,ny)=>({ x: nx*1000, y: (1-ny)*1000 }),

    // convenience for assertions
    _events: { tutorEvents, hudEvents },

    // window adapters (snap/move/resize) mocked
    _axMoveBy: jest.fn(),
    _axResizeBy: jest.fn(),
    _axSnap: jest.fn(),
  };

  return Object.assign(ctx, overrides);
}

module.exports = { makeMockCtx };
