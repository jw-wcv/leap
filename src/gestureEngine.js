// src/gestureEngine.js
const { screen: ElectronScreen } = require('electron');
const { mouse, Button, keyboard, Key, screen, Point } = require('./adapters/io');

const CFG = require('./core/cfg');
const GCR = require('./core/gcr');
const { now, avg, clamp01, lerp, keyChord, OS } = require('./core/utils');
const { Profiles } = require('./input/profiles');
const { createState } = require('./core/state');
const { createBus } = require('./core/bus');
const { compose } = require('./core/pipeline');

const gestureMW = require('./gestures');
const functionMW = require('./functions');

const { createController } = require('./controllers');                 // NEW
const { ensureGestures, attachFlagAPI } = require('./core/featureFlags'); // NEW
const { switchProfile } = require('./input/profileSwitcher');          // NEW

class GestureEngine {
  constructor(opts) {
    this.onHUD = opts.onHUD || (()=>{});
    this.onCalState = opts.onCalState || (()=>{});
    this.onSave = opts.onSave || (()=>{});

    this.helperPath   = opts.helperPath || null;
    this.userDataPath = opts.userDataPath || process.cwd();
    this.profilesPath = opts.profilesPath;
    this.profilesAuto = !!opts.profilesAuto;

    const persisted = opts.persisted || {};
    this.opts = {
      threeFingerDrag: !!persisted.threeFingerDrag,
      zoomWithCmdScrollOnPinch: !!persisted.zoomWithCmdScrollOnPinch,
      windowMoveScale: persisted.windowMoveScale ?? 1.0,
      windowResizeScale: persisted.windowResizeScale ?? 1.0,
    };
    this.persist = {
      calibration: (persisted.calibration && persisted.calibration.rect) || { x0:0,y0:0,x1:1,y1:1 },
      perDisplay: persisted.perDisplay || {},
      clicks: persisted.clicks || { doublePinchMs: 350, enableMiddleTriple: true },
      dwell: persisted.dwell || { enabled: true, ms: 650, radiusPx: 10, cooldownMs: 800 },
      pointerGain: persisted.pointerGain || { enabled: true, gainMin:1.0, gainMax:2.2, velLow:200, velHigh:1000 },
      scrollInertia: persisted.scrollInertia || { enabled: true, decay:0.90, minStep:1, burstScale:0.05 },
      gestures: ensureGestures(persisted.gestures) // NEW
    };
    this._base = JSON.parse(JSON.stringify({ opts: this.opts, persist: this.persist }));

    this.profiles = new Profiles(this.profilesPath, (m)=>this._tutor(m));
    this.profiles.load();
    this.profiles.setAuto(this.profilesAuto);
    this.frontBundleId = '';
    this._lastTwoCenter = null;

    this.store = createState({
      displayId: null,
      displayBounds: { x:0, y:0, w:0, h:0 },
      screen: { w: 0, h: 0 },
      pos: { x: 0, y: 0 }, target: { x: 0, y: 0 }, lastPt: { x: 0, y: 0 },
      isPinching: false, pinchStartTs: 0, dragging: false,
      threeDrag: false, lastSwipeTs: 0, fiveOpenStart: 0, lastFivePinchTs: 0,
      windowMode: 'none', windowRefPt: null, lastWindowTick: 0,
      resizeBaseline: { roll: 0, pitch: 0 },
      cal: { active:false, step:'idle', A:null, B:null, rect: this.persist.calibration },
      gcr: new GCR(),
      tapCount: 0, lastTapTs: 0, tapTimer: null,
      dwellAnchor: null, dwellStartTs: 0, dwellCooldownTs: 0,
      inertia: { vx: 0, vy: 0, active: false },
      lastPalmVel: 0,
      lastSnapTapTs: 0, snapIndex: 0,
      snapOrder: ["left","right","top","bottom","tl","tr","bl","br","third-left","third-center","third-right","center","max"],
      rec: { enabled:false, stream:null, started:0, lastFile:null, replay:null },
      trainer: { enabled:false, capturing:false, label:'', started:0, seg:[], lastSaved:null }
    });

    // shared ctx
    this.ctx = {
      CFG, now, avg, clamp01, lerp,
      mouse, Button, keyboard, Key, screen, Point,
      state: this.store.get(), getState: this.store.get, setState: this.store.set, sel: this.store.sel,
      opts: this.opts, persist: this.persist,
      profiles: this.profiles,
      onSave: this.onSave, onHUD: this.onHUD, onCalState: this.onCalState,
      userDataPath: this.userDataPath, helperPath: this.helperPath,
      bus: createBus(),
      tutor: (m)=>this._tutor(m),
      _hudPatch: (p)=>this._hudPatch(p),
      _onReplayFrame: (f)=>this._onReplayFrame(f),
      _mapToScreen: (nx,ny)=>{ const st = this.store.get(); const r = st.cal.rect, W = st.screen.w, H = st.screen.h;
        const tx = Math.max(0, Math.min(1, (nx - r.x0) / (r.x1 - r.x0)));
        const ty = Math.max(0, Math.min(1, (ny - r.y0) / (r.y1 - r.y0)));
        return { x: tx * W, y: (1 - ty) * H }; }
    };

    // attach flags API into ctx
    attachFlagAPI(this); // isOn / setGesture / listGestures

    this.run = compose([ ...functionMW, ...gestureMW ]);
    this._kaTimer = null;
  }

  _tutor(label){ this.onHUD({ tutor: label }); }
  _hudPatch(p){ this.onHUD(p); }

  async _updateActiveDisplay() {
    const pt = ElectronScreen.getCursorScreenPoint();
    const nearest = ElectronScreen.getDisplayNearestPoint(pt);
    const id = nearest.id;
    if (this.store.get().displayId !== id) {
      this.store.set({ displayId: id, displayBounds: nearest.bounds, screen: { w: nearest.size.width, h: nearest.size.height } });
      this._hudPatch({ displayId: id, displayW: nearest.size.width, displayH: nearest.size.height });
    }
  }

  _updateFrontAppAndProfile() {
    switchProfile(this); // compacted profile logic
  }

  async start() {
    await this._updateActiveDisplay();
    this._animate();

    this.controller = createController();
    this.controller.on('frame', (frame) => this._onFrame(frame));
    this.controller.on('connect', () => this._tutor(process.env.USE_LEAPC_BRIDGE === '1' ? 'Connected (LeapC middleware)' : 'Connected (LeapJS/WS)'));
    this.controller.on('disconnect', () => this._tutor('Disconnected'));
    this.controller.on('error', (err) => { console.error('Controller error:', err); this._tutor('Controller error'); });

    this._dispTimer = setInterval(() => this._updateActiveDisplay(), 150);
    this._appTimer  = setInterval(() => this._updateFrontAppAndProfile(), 800);

    this._hudPatch({ settings: { gestures: this.persist.gestures } });
    this.onHUD({ trainer: { state: this.store.get().trainer.enabled ? 'enabled' : 'disabled', label: this.store.get().trainer.label }});
    await this.run(this.ctx);
  }

  stop() {
    if (this.controller?.disconnect) this.controller.disconnect();
    if (this._animHandle) clearImmediate(this._animHandle);
    clearInterval(this._dispTimer);
    clearInterval(this._appTimer);
    this.ctx.bus.removeAll();
  }

  // passthroughs used elsewhere
  startRecording() { this.ctx.recorder?.start?.(); }
  stopRecording()  { this.ctx.recorder?.stop?.(); }
  playLastRecording() { this.ctx.recorder?.play?.(); }
  trainerEnable(v){ this.ctx.trainer?.enable?.(v); }
  trainerSetLabel(s){ this.ctx.trainer?.setLabel?.(s); }
  trainerStart(){ this.ctx.trainer?.start?.(); }
  trainerStopAndSave(){ this.ctx.trainer?.stopSave?.(); }
  trainerReplayLast(){ this.ctx.trainer?.replayLast?.(); }
  startCalibration(){ this.ctx.calib?.start?.(); }
  cancelCalibration(){ this.ctx.calib?.cancel?.(); }
  _finishCalibration(){ this.ctx.calib?.finish?.(); }

  _adaptiveGain() {
    const P = this.persist.pointerGain; if (!P.enabled) return 1.0;
    const st = this.store.get();
    const t = Math.max(0, Math.min(1, (st.lastPalmVel - P.velLow) / (P.velHigh - P.velLow)));
    return lerp(P.gainMin, P.gainMax, t);
  }

  async _moveMouseSmooth(target){ this.store.set({ target }); }

  _animate() {
    const st = this.store.get();
    const gain = this._adaptiveGain();
    const pos = { x: avg(st.pos.x, st.target.x, CFG.smoothing), y: avg(st.pos.y, st.target.y, CFG.smoothing) };
    const dx = (pos.x - st.lastPt.x) * gain;
    const dy = (pos.y - st.lastPt.y) * gain;

    if (Math.hypot(dx, dy) > CFG.deadzonePx) {
      const abs = new Point(Math.round(st.displayBounds.x + st.lastPt.x + dx), Math.round(st.displayBounds.y + st.lastPt.y + dy));
      mouse.setPosition(abs);
      this.store.set({ pos, lastPt: { x: st.lastPt.x + dx, y: st.lastPt.y + dy } });
    } else {
      this.store.set({ pos });
    }

    if (this.persist.scrollInertia.enabled && st.inertia.active) {
      const vx = st.inertia.vx * this.persist.scrollInertia.decay;
      const vy = st.inertia.vy * this.persist.scrollInertia.decay;
      const stepX = Math.trunc(vx), stepY = Math.trunc(vy);
      if (stepY) (stepY > 0 ? mouse.scrollUp(stepY) : mouse.scrollDown(-stepY));
      if (stepX) (stepX > 0 ? mouse.scrollRight(stepX) : mouse.scrollLeft(-stepX));
      const still = Math.abs(vx) < this.persist.scrollInertia.minStep && Math.abs(vy) < this.persist.scrollInertia.minStep;
      this.store.set({ inertia: { vx, vy, active: !still } });
    }

    this._animHandle = setImmediate(() => this._animate());
  }

  async _onReplayFrame(f) {
    const st = this.store.get();
    const h = f.hand;
    this.store.set({ lastPalmVel: Math.hypot(h.palmVelocity?.[0]||0,h.palmVelocity?.[1]||0,h.palmVelocity?.[2]||0) });

    const ext = h.ext|0, pinch = h.pinch||0, grab = h.grab||0;
    const pt = this.ctx._mapToScreen(h.indexTip?.nx ?? h.palm?.nx ?? 0.5, h.indexTip?.ny ?? h.palm?.ny ?? 0.5);
    await this._moveMouseSmooth(pt);

    // calibration mimic
    if (st.cal.active) {
      if (st.cal.step === 'A' && pinch > 0.85) { st.cal.A = { nx: h.indexTip.nx, ny: h.indexTip.ny }; st.cal.step = 'B'; this.onCalState({ mode:'progress', step:'B' }); }
      else if (st.cal.step === 'B' && pinch > 0.85) { st.cal.B = { nx: h.indexTip.nx, ny: h.indexTip.ny }; this._finishCalibration(); }
      this._emitHUD(ext, pinch, grab, pt); return;
    }

    if (ext === 4) {
      if (pinch >= 0.8 && st.windowMode !== 'move' && st.gcr.canSwitch(ext)) this.ctx.window.enter('move', { x: pt.x, y: pt.y }, { roll:()=>h.roll, pitch:()=>h.pitch });
      if (pinch <= 0.6 && st.windowMode === 'move') { this.ctx.window.exit(); st.gcr.release(); }
    } else if (ext >= 5) {
      if (pinch >= 0.8 && st.windowMode !== 'resize' && st.gcr.canSwitch(ext)) this.ctx.window.enter('resize', { x: pt.x, y: pt.y }, { roll:()=>h.roll, pitch:()=>h.pitch });
      if (pinch <= 0.6 && st.windowMode === 'resize') { this.ctx.window.exit(); st.gcr.release(); }
    } else if (ext <= 3 && st.windowMode !== 'none') {
      this.ctx.window.exit(); st.gcr.release();
    }

    await this.ctx.window.tick({ x: pt.x, y: pt.y }, { roll:()=>h.roll, pitch:()=>h.pitch });

    if (ext === 4 && st.windowMode === 'none') {
      await this.ctx.os.swipes(h);
    }

    this._emitHUD(ext, pinch, grab, pt);
  }

  async _onFrame(frame) {
  const st = this.store.get();
  const hands = Array.isArray(frame.hands) ? frame.hands.length : 0;
  const iBox = frame.interactionBox;

  // velocity for smoothing / dwell cancel
  if (hands > 0) {
    const v = frame.hands[0].palmVelocity || [0,0,0];
    this.store.set({ lastPalmVel: Math.hypot(v[0]||0, v[1]||0, v[2]||0) });
  }

  // ---- No hands: hard reset and exit
  if (hands === 0) {
    try { await this.ctx.bus.emit('gesture:pinch', false); } catch {}
    if (st.dragging) { await mouse.releaseButton(Button.LEFT); this.store.set({ dragging: false }); }
    await this.ctx.drag.end3?.();
    this._lastTwoCenter = null;

    this.ctx.window.exit?.();
    st.gcr.release();

    this.store.set({ dwellAnchor: null, dwellStartTs: 0, dwellCooldownTs: 0 });
    this.ctx.dwell?.stop?.();

    this.store.set({ fiveOpenStart: 0, lastFivePinchTs: 0 });
    try { await this.ctx.window.snapCycle?.(false, 0); } catch {}

    this.onHUD({ hands: 0, profile: this.profiles.current() });
    return;
  }

  // ---- One hand data
  const hand  = frame.hands[0] || {};
  const pinch = hand.pinchStrength || hand.pinch || 0;
  const grab  = hand.grabStrength  || hand.grab  || 0;
  const fingers = Array.isArray(hand.fingers) ? hand.fingers : [];
  const ext   = fingers.filter(f => f.extended).length;

  // Cursor mapping (always compute localPt for HUD; move only when allowed)
  let localPt;
  {
    const tip = (hand.indexFinger && hand.indexFinger.stabilizedTipPosition) || hand.stabilizedPalmPosition || [0.5,0.5,0];
    const n = iBox.normalizePoint(tip, true);
    const nx = Math.max(0, Math.min(1, n[0]));
    const ny = Math.max(0, Math.min(1, n[1]));
    localPt = this.ctx._mapToScreen(nx, ny);
  }

  // Open-palm heuristic (ignore thumb) + deadman grab + clutch (thumb+pinky)
  const thumb = fingers.find(f => f.type === 0);
  const pinky = fingers.find(f => f.type === 4);
  const nonThumbExtended = fingers.filter(f => f.type !== 0 && f.extended).length; // index/middle/ring/pinky
  const palmOpen  = (nonThumbExtended >= 3) && (grab <= 0.2);
  const deadman   = (grab >= 0.7);
  const clutchOn  = !!(thumb?.extended && pinky?.extended); // disable click modes while true

  if (this.ctx.isOn('cursor') && palmOpen && !deadman) {
    await this._moveMouseSmooth(localPt);
  }

  // recorder + trainer capture
  this.ctx.recorder?.capture?.(iBox, hand);
  this.ctx.trainer?.capture?.(iBox, hand);

  // calibration flow
  if (st.cal.active) {
    if (st.cal.step === 'A' && pinch > 0.85) { st.cal.A = { nx: localPt.x, ny: localPt.y }; st.cal.step = 'B'; this.onCalState({ mode:'progress', step:'B' }); }
    else if (st.cal.step === 'B' && pinch > 0.85) { st.cal.B = { nx: localPt.x, ny: localPt.y }; this._finishCalibration(); }
    this._emitHUD(ext, pinch, grab, localPt); return;
  }

  // enter/exit window modes
  if (ext === 4 && this.ctx.isOn('windowMove')) {
    if (pinch >= 0.8 && st.windowMode !== 'move' && st.gcr.canSwitch(ext)) this.ctx.window.enter('move', { x: localPt.x, y: localPt.y }, hand);
    if (pinch <= 0.6 && st.windowMode === 'move') { this.ctx.window.exit(); st.gcr.release(); }
  } else if (ext >= 5 && this.ctx.isOn('windowResize')) {
    if (pinch >= 0.8 && st.windowMode !== 'resize' && st.gcr.canSwitch(ext)) this.ctx.window.enter('resize', { x: localPt.x, y: localPt.y }, hand);
    if (pinch <= 0.6 && st.windowMode === 'resize') { this.ctx.window.exit(); st.gcr.release(); }
  } else if (ext <= 3 && st.windowMode !== 'none') {
    this.ctx.window.exit();
    st.gcr.release();
  }

  await this.ctx.window.tick({ x: localPt.x, y: localPt.y }, hand);

  // profile three-swipe bindings (when 3F-drag disabled)
  if (await this.ctx.threeSwipe?.maybe?.(hand, ext)) {
    this._emitHUD(ext, pinch, grab, localPt);
    return;
  }

  // regular gestures
  if (ext === 1) {
    // Index-only click (thumb ignored), require a bit of grip
    const index = hand.indexFinger || fingers.find(f => f.type === 1) || null;
    const othersExtended = fingers.filter(f => f !== index && f.type !== 0 && f.extended).length;
    const gripEnough = (grab >= 0.35);
    const indexOnly  = !!(index && index.extended && othersExtended === 0 && gripEnough && !clutchOn);

    if (
      this.ctx.isOn('drag') &&
      (grab >= CFG.grabOn || st.dragging) &&
      (st.gcr.current() ? st.gcr.current() === 'drag' : st.gcr.acquire('drag', ext))
    ) {
      await this.ctx.drag.maybeStart?.();
      await this.ctx.bus.emit('gesture:pinch', false);
    } else {
      if (
        this.ctx.isOn('pinchClick') &&
        !st.dragging &&
        (st.gcr.current() ? st.gcr.current() === 'pinch' : st.gcr.acquire('pinch', ext))
      ) {
        await this.ctx.bus.emit('gesture:pinch', indexOnly);
      } else {
        await this.ctx.bus.emit('gesture:pinch', false);
      }

      if (grab <= CFG.grabOff && st.dragging) {
        await mouse.releaseButton(Button.LEFT);
        this.store.set({ dragging: false });
        st.gcr.release();
        this._tutor('Drag end');
      }
    }

    this._lastTwoCenter = null;
    await this.ctx.drag.end3?.();
  }
  else if (ext === 2 && this.ctx.isOn('scroll')) {
    if (st.gcr.canSwitch(ext) && !st.gcr.current()) st.gcr.acquire('scroll', ext);
    if (st.gcr.current() === 'scroll') {
      await this.ctx.bus.emit('gesture:pinch', false);
      await this.ctx.drag.end3?.();
      await this.ctx.scroll.handle(hand, iBox);

      if (st.windowMode === 'move') {
        if (!this._lastTwoCenter) this._lastTwoCenter = localPt;
        const dx = (localPt.x - this._lastTwoCenter.x);
        const dy = (localPt.y - this._lastTwoCenter.y);
        await this.ctx.window.snapSwipes(hand, dx, dy);
      }
    }
    this._lastTwoCenter = localPt;
  }
  else if (ext === 3 && this.opts.threeFingerDrag && this.ctx.isOn('threeFingerDrag')) {
    if (st.gcr.canSwitch(ext) && !st.gcr.current()) st.gcr.acquire('threeDrag', ext);
    if (st.gcr.current() === 'threeDrag') {
      await this.ctx.bus.emit('gesture:pinch', false);
      await this.ctx.drag.start3?.();
      this._lastTwoCenter = null;
    }
  } else if (ext !== 3 && this.opts.threeFingerDrag) {
    await this.ctx.drag.end3?.();
    if (st.gcr.current() === 'threeDrag') st.gcr.release();
  }

  // OS swipes when not in window modes
  if (this.ctx.isOn('osSwipes') && ext === 4 && st.windowMode === 'none' && (!st.gcr.current() || st.gcr.current() === 'windowMove')) {
    await this.ctx.os.swipes(hand);
  }

  // snap cycle tap (4F quick pinch)
  if (this.ctx.isOn('snapCycle')) {
    await this.ctx.window.snapCycle((pinch >= CFG.pinchOn && pinch <= 0.9), ext);
  }

  // 5F utilities (show desktop / launchpad) when not resizing
  if (ext >= 5 && st.windowMode !== 'resize') {
    const extF = fingers.filter(f=>f.extended).length;
    if (extF >= 5) {
      if (!st.fiveOpenStart) this.store.set({ fiveOpenStart: now() });
      if (now() - this.store.get().fiveOpenStart >= CFG.fiveHoldMs) {
        this.store.set({ fiveOpenStart: 0 });
        if (this.ctx.isOn('showDesktop')) { await keyChord(OS.showDesktop); this._tutor('Show Desktop'); }
      }
    } else {
      this.store.set({ fiveOpenStart: 0 });
    }
    if (extF >= 4 && pinch > 0.9 && now() - st.lastFivePinchTs > 1200) {
      this.store.set({ lastFivePinchTs: now() });
      if (this.ctx.isOn('launchpad')) { await keyChord(OS.launchpad); this._tutor('Launchpad'); }
    }
  } else {
    this.store.set({ fiveOpenStart: 0 });
  }

  // Dwell click (only when feature enabled, hands present, and not clutching)
  if (hands > 0 && this.ctx.isOn('dwellClick') && this.persist.dwell?.enabled && !clutchOn) {
    await this.ctx.dwell.tick();
  } else {
    this.ctx.dwell?.stop?.();
  }

  // HUD
  this.onHUD({
    hands, ext, pinch:+(pinch||0).toFixed(2), grab:+(grab||0).toFixed(2),
    x: Math.round(localPt.x), y: Math.round(localPt.y),
    windowMode: st.windowMode, dragging: st.dragging || st.threeDrag,
    calStep: st.cal.step, displayId: st.displayId, gcr: st.gcr.current(),
    profile: this.profiles.current()
  });
}

}

module.exports = GestureEngine;
