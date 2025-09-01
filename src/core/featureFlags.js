// src/core/featureFlags.js
const DEFAULTS = {
  cursor: true, pinchClick: true, drag: true, threeFingerDrag: true,
  scroll: true, osSwipes: true, windowMove: true, windowResize: true,
  snapCycle: true, showDesktop: true, launchpad: true, dwellClick: true
};

function ensureGestures(persisted) {
  return { ...DEFAULTS, ...(persisted || {}) };
}

function attachFlagAPI(engine) {
  const api = {
    isOn: (name) => !!engine.persist.gestures[name],
    setGesture: (name, value) => {
      if (!(name in engine.persist.gestures)) return;
      engine.persist.gestures[name] = !!value;
      // keep base snapshot aligned so profile resets don't re-enable it
      if (engine._base?.persist?.gestures) engine._base.persist.gestures[name] = !!value;
      engine.onSave?.({ persist: engine.persist });
      engine._hudPatch?.({ settings: { gestures: engine.persist.gestures } });
    },
    listGestures: () => ({ ...engine.persist.gestures })
  };
  // expose on ctx for existing code paths
  engine.ctx.isOn = api.isOn;
  engine.ctx.setGesture = api.setGesture;
  engine.ctx.listGestures = api.listGestures;
}

module.exports = { DEFAULTS, ensureGestures, attachFlagAPI };
