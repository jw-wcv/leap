// src/input/profileSwitcher.js
const { frontBundleId } = require('./profiles');

function switchProfile(engine) {
  if (!engine.profilesAuto) return;
  const bid = frontBundleId(); if (!bid) return;
  if (bid === engine.frontBundleId) return;

  engine.frontBundleId = bid;

  // preserve current gesture toggles before reset
  const keepGestures = { ...(engine.persist?.gestures || {}) };

  // reset to base, then restore toggles
  engine.opts     = JSON.parse(JSON.stringify(engine._base.opts));
  engine.persist  = JSON.parse(JSON.stringify(engine._base.persist));
  engine.persist.gestures = { ...(engine.persist.gestures || {}), ...keepGestures };

  const p = engine.profiles.activate(bid);
  if (p.overrides) {
    if ('threeFingerDrag' in p.overrides) engine.opts.threeFingerDrag = !!p.overrides.threeFingerDrag;
    if ('zoomWithCmdScrollOnPinch' in p.overrides) engine.opts.zoomWithCmdScrollOnPinch = !!p.overrides.zoomWithCmdScrollOnPinch;
    if (p.overrides.pointerGain) Object.assign(engine.persist.pointerGain, p.overrides.pointerGain);
    if (p.overrides.scrollInertia && 'enabled' in p.overrides.scrollInertia) engine.persist.scrollInertia.enabled = !!p.overrides.scrollInertia.enabled;
    // If you want profile-level gesture defaults to apply (but not override user's toggles), merge them first:
    // if (p.overrides.gestures) engine.persist.gestures = { ...p.overrides.gestures, ...engine.persist.gestures };
  }

  engine._tutor(`Profile: ${p.name || bid}`);
  engine._hudPatch({ profile: { id: bid, name: p.name || bid } });
  engine._hudPatch({ settings: { gestures: engine.persist.gestures } });
}

module.exports = { switchProfile };
