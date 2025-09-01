// main.js
const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const GestureEngine = require('./src/gestureEngine');
const CFG = require('./src/core/cfg'); // for live threshold updates

const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');

// ---- Defaults (persisted into config.json on first run) ----
const defaults = {
  showHUD: true,
  threeFingerDrag: true,
  zoomWithCmdScrollOnPinch: true,
  windowMoveScale: 1.0,
  windowResizeScale: 1.0,
  calibration: { rect: { x0: 0, y0: 0, x1: 1, y1: 1 } },
  perDisplay: {},
  clicks: { doublePinchMs: 350, enableMiddleTriple: true },
  dwell: { enabled: true, ms: 650, radiusPx: 10, cooldownMs: 800 },
  pointerGain: { enabled: true, gainMin: 1.0, gainMax: 2.2, velLow: 200, velHigh: 1000 },
  scrollInertia: { enabled: true, decay: 0.90, minStep: 1, burstScale: 0.05 },
  profilesAuto: true,
  // thresholds (mirror CFG so UI can manage)
  swipeMinVel: CFG.swipeMinVel ?? 900,
  moveSnapSwipeVel: CFG.moveSnapSwipeVel ?? 800,
  smoothing: CFG.smoothing ?? 0.22,

  // Per-gesture toggles (kept in config and mirrored to engine.persist.gestures)
  gestures: {
    cursor:          true,
    pinchClick:      true,
    drag:            true,
    threeFingerDrag: true,
    scroll:          true,
    osSwipes:        true,
    windowMove:      true,
    windowResize:    true,
    snapCycle:       true,
    showDesktop:     true,
    launchpad:       true,
    dwellClick:      true
  }
};

function loadConfig() {
  try {
    const disk = fs.existsSync(CONFIG_PATH)
      ? JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'))
      : {};
    // ensure gestures map exists if older config didn’t have it
    if (!disk.gestures) disk.gestures = { ...defaults.gestures };
    return { ...defaults, ...disk };
  } catch {
    return { ...defaults };
  }
}
function saveConfig(cfg) {
  try {
    fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8');
  } catch {}
}

// --- Settings window  ---
let settingsWin = null;
function createSettingsWindow() {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.show(); settingsWin.focus(); return settingsWin;
  }
  settingsWin = new BrowserWindow({
    width: 760, height: 720,
    title: 'Settings',
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'src', 'settings', 'preload.js'),
      contextIsolation: true
    }
  });
  settingsWin.loadFile(path.join(__dirname, 'src', 'settings', 'settings.html'));
  settingsWin.on('closed', () => { settingsWin = null; });
  return settingsWin;
}

// Ensure axwin helper
function ensureAxwin() {
  const helperOut = path.join(__dirname, 'axwin');
  const swiftSrc  = path.join(__dirname, 'src', 'axwin.swift');
  try {
    if (!fs.existsSync(helperOut) && fs.existsSync(swiftSrc)) {
      execFileSync('swiftc', ['-O', swiftSrc, '-o', helperOut], { stdio: 'ignore' });
    }
    if (fs.existsSync(helperOut)) { fs.chmodSync(helperOut, 0o755); return helperOut; }
  } catch {}
  return null;
}
const AXWIN_PATH = ensureAxwin();

// Ensure default profiles file
const PROFILES_PATH = path.join(app.getPath('userData'), 'profiles.json');
function ensureProfilesFile() {
  if (fs.existsSync(PROFILES_PATH)) return;
  const sample = {
    auto: true,
    profiles: {
      "default": { "name": "Default", "overrides": {} },
      "com.google.Chrome": {
        "name": "Chrome",
        "overrides": { "threeFingerDrag": false },
        "bindings": {
          "threeSwipe.left":  { "type": "key", "keys": ["LeftControl","LeftShift","Tab"] },
          "threeSwipe.right": { "type": "key", "keys": ["LeftControl","Tab"] },
          "threeSwipe.up":    { "type": "key", "keys": ["LeftSuper","L"] }
        }
      },
      "com.apple.Preview": {
        "name": "Preview",
        "overrides": { "threeFingerDrag": false },
        "bindings": {
          "threeSwipe.left":  { "type": "key", "keys": ["LeftArrow"] },
          "threeSwipe.right": { "type": "key", "keys": ["RightArrow"] },
          "threeSwipe.up":    { "type": "key", "keys": ["PageUp"] },
          "threeSwipe.down":  { "type": "key", "keys": ["PageDown"] }
        }
      }
    }
  };
  fs.mkdirSync(path.dirname(PROFILES_PATH), { recursive: true });
  fs.writeFileSync(PROFILES_PATH, JSON.stringify(sample, null, 2), 'utf8');
}

let cfg = loadConfig();
ensureProfilesFile();

let tray = null, hudWindow = null, engine = null;
let currentProfileName = 'Default';

function createHUD() {
  hudWindow = new BrowserWindow({
    width: 800, height: 600, transparent: true, frame: false, resizable: false,
    alwaysOnTop: true, fullscreenable: false, skipTaskbar: true, hasShadow: false,
    webPreferences: { preload: path.join(__dirname, 'src', 'preload.js'), nodeIntegration: false, contextIsolation: true }
  });
  hudWindow.setIgnoreMouseEvents(false);
  hudWindow.loadFile(path.join(__dirname, 'src', 'hud', 'hud.html'));
  if (!cfg.showHUD) hudWindow.setOpacity(0);
}

function rebuildTray() {
  const menu = Menu.buildFromTemplate([
    { label: 'Show HUD Overlay', type: 'checkbox', checked: cfg.showHUD, click: (i) => {
      cfg.showHUD = i.checked; saveConfig(cfg);
      if (hudWindow) { hudWindow.webContents.send('hud:toggle', cfg.showHUD); hudWindow.setOpacity(cfg.showHUD ? 1 : 0); }
    }},
    { label: 'Three-Finger Drag', type: 'checkbox', checked: cfg.threeFingerDrag, click: (i) => {
      cfg.threeFingerDrag = i.checked; saveConfig(cfg); engine?.setThreeFingerDrag(cfg.threeFingerDrag);
    }},
    { label: 'Cmd+Scroll Zoom on 2-finger pinch', type: 'checkbox', checked: cfg.zoomWithCmdScrollOnPinch, click: (i) => {
      cfg.zoomWithCmdScrollOnPinch = i.checked; saveConfig(cfg); engine?.setZoomWithCmdScrollOnPinch(cfg.zoomWithCmdScrollOnPinch);
    }},
    { type: 'separator' },
    { label: 'Profiles', submenu: [
      { label: 'Auto (by app)', type: 'checkbox', checked: cfg.profilesAuto, click: (i) => {
        cfg.profilesAuto = i.checked; saveConfig(cfg); engine?.setProfilesAuto(cfg.profilesAuto);
      }},
      { label: 'Reload Profiles', click: () => engine?.reloadProfiles() },
      { label: 'Open profiles.json', click: () => shell.showItemInFolder(PROFILES_PATH) },
      { type: 'separator' },
      { label: `Current: ${currentProfileName}`, enabled: false }
    ]},
    { label: 'Recorder', submenu: [
      { label: 'Start Recording', click: () => engine?.startRecording() },
      { label: 'Stop Recording', click: () => engine?.stopRecording() },
      { type: 'separator' },
      { label: 'Replay Last', click: () => engine?.playLastRecording() },
      { label: 'Open Recordings Folder', click: () => shell.openPath(path.join(app.getPath('userData'), 'recordings')) },
    ]},
    { label: 'Trainer', submenu: [
      { label: 'Enable Trainer Mode', type: 'checkbox', checked: false, click: (i) => engine?.trainerEnable(i.checked) },
      { label: 'Start Segment', click: () => engine?.trainerStart() },
      { label: 'Stop + Save Segment…', click: async () => {
          const { response } = await dialog.showMessageBox({
            type: 'question', buttons: ['Save', 'Cancel'], defaultId: 0,
            title: 'Save Labeled Segment', message: 'Segment will be saved using the current HUD label.\n(You can change it in the HUD Trainer panel.)'
          });
          if (response === 0) engine?.trainerStopAndSave();
      }},
      { type: 'separator' },
      { label: 'Open Gestures Folder', click: () => shell.openPath(path.join(app.getPath('userData'), 'gestures')) },
      { label: 'Replay Last Saved Segment', click: () => engine?.trainerReplayLast() },
    ]},
    { type: 'separator' },
    { label: 'Settings…', click: () => createSettingsWindow() },
    { type: 'separator' },
    { label: 'Start Calibration Wizard', click: () => engine?.startCalibration() },
    { type: 'separator' },
    { label: 'Quit', role: 'quit' }
  ]);
  tray.setContextMenu(menu);
}

function createTray() {
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.setToolTip('Ultraleap Trackpad');
  rebuildTray();
}

function startEngine() {
  engine = new GestureEngine({
    persisted: cfg,
    helperPath: AXWIN_PATH,
    userDataPath: app.getPath('userData'),
    profilesPath: PROFILES_PATH,
    profilesAuto: cfg.profilesAuto,
    onSave: (patch) => {
      // merge & persist (includes gesture map changes pushed from engine)
      cfg = { ...cfg, ...patch };
      // guard: deep-merge known nested structs if present
      if (patch.persist?.gestures) cfg.gestures = { ...(cfg.gestures||{}), ...patch.persist.gestures };
      saveConfig(cfg);
    },
    onHUD: (payload) => {
      if (hudWindow && cfg.showHUD) hudWindow.webContents.send('hud:update', payload);
      if (payload?.profile?.name && payload.profile.name !== currentProfileName) {
        currentProfileName = payload.profile.name;
        rebuildTray();
      }
    },
    onCalState: (payload) => {
      if (payload.mode === 'done') {
        const { rect, displayId } = payload;
        if (displayId) { cfg.perDisplay = cfg.perDisplay || {}; cfg.perDisplay[String(displayId)] = { rect }; }
        else { cfg.calibration = { rect }; }
        saveConfig(cfg);
      }
      hudWindow && hudWindow.webContents.send('hud:cal', payload);
    },
  });
  engine.start();
}

app.whenReady().then(() => {
  createHUD();
  createTray();
  startEngine();
  app.dock && app.dock.hide();
});

app.on('window-all-closed', (e) => e.preventDefault());
app.on('before-quit', () => engine?.stop());

// ---------- HUD / feature IPC ----------
ipcMain.handle('cal:start',  () => engine?.startCalibration());
ipcMain.handle('cal:cancel', () => engine?.cancelCalibration());

ipcMain.handle('rec:start', () => engine?.startRecording());
ipcMain.handle('rec:stop',  () => engine?.stopRecording());
ipcMain.handle('rec:playLast', () => engine?.playLastRecording());
ipcMain.handle('rec:openFolder', () => shell.openPath(path.join(app.getPath('userData'), 'recordings')));

ipcMain.handle('profiles:reload', () => engine?.reloadProfiles());
ipcMain.handle('profiles:auto', (_e, v) => { cfg.profilesAuto = !!v; saveConfig(cfg); engine?.setProfilesAuto(cfg.profilesAuto); });

// Trainer IPC
ipcMain.handle('trainer:enable', (_e, v) => engine?.trainerEnable(!!v));
ipcMain.handle('trainer:start',  () => engine?.trainerStart());
ipcMain.handle('trainer:stopSave', () => engine?.trainerStopAndSave());
ipcMain.handle('trainer:setLabel', (_e, label) => engine?.trainerSetLabel(label || ''));
ipcMain.handle('trainer:openFolder', () => shell.openPath(path.join(app.getPath('userData'), 'gestures')));
ipcMain.handle('trainer:replayLast', () => engine?.trainerReplayLast());

// ---------- Settings IPC ----------
ipcMain.handle('settings:load', () => loadConfig());

ipcMain.handle('settings:save', (_e, patch) => {
  const merged = { ...loadConfig() };

  // shallow booleans + numbers
  if ('threeFingerDrag' in patch)           merged.threeFingerDrag = !!patch.threeFingerDrag;
  if ('zoomWithCmdScrollOnPinch' in patch)  merged.zoomWithCmdScrollOnPinch = !!patch.zoomWithCmdScrollOnPinch;
  if ('profilesAuto' in patch)              merged.profilesAuto = !!patch.profilesAuto;
  if ('windowMoveScale'   in patch) merged.windowMoveScale   = Number(patch.windowMoveScale);
  if ('windowResizeScale' in patch) merged.windowResizeScale = Number(patch.windowResizeScale);
  if ('swipeMinVel'       in patch) merged.swipeMinVel       = Number(patch.swipeMinVel);
  if ('moveSnapSwipeVel'  in patch) merged.moveSnapSwipeVel  = Number(patch.moveSnapSwipeVel);

  // structured
  merged.pointerGain   = { ...(merged.pointerGain||{}),   ...(patch.pointerGain||{}) };
  merged.scrollInertia = { ...(merged.scrollInertia||{}), ...(patch.scrollInertia||{}) };
  merged.dwell         = { ...(merged.dwell||{}),         ...(patch.dwell||{}) };
  merged.clicks        = { ...(merged.clicks||{}),        ...(patch.clicks||{}) };

  // Gestures 
  if (patch.gestures) {
    merged.gestures = { ...(merged.gestures||{}), ...(patch.gestures||{}) };
  }

  saveConfig(merged);
  cfg = merged;

  // Apply live to engine
  if ('threeFingerDrag' in patch)           engine?.setThreeFingerDrag(!!patch.threeFingerDrag);
  if ('zoomWithCmdScrollOnPinch' in patch)  engine?.setZoomWithCmdScrollOnPinch(!!patch.zoomWithCmdScrollOnPinch);
  if ('profilesAuto' in patch)              engine?.setProfilesAuto(!!patch.profilesAuto);

  if (patch.pointerGain)   Object.assign(engine.persist.pointerGain,   patch.pointerGain);
  if (patch.scrollInertia) Object.assign(engine.persist.scrollInertia, patch.scrollInertia);
  if (patch.dwell)         Object.assign(engine.persist.dwell,         patch.dwell);
  if (patch.clicks)        Object.assign(engine.persist.clicks,        patch.clicks);

  if ('windowMoveScale'   in patch) engine.opts.windowMoveScale    = Number(patch.windowMoveScale);
  if ('windowResizeScale' in patch) engine.opts.windowResizeScale  = Number(patch.windowResizeScale);

  if ('swipeMinVel'      in patch) CFG.swipeMinVel      = Number(patch.swipeMinVel);
  if ('moveSnapSwipeVel' in patch) CFG.moveSnapSwipeVel = Number(patch.moveSnapSwipeVel);

  // Apply gestures live
  if (patch.gestures) {
    Object.entries(patch.gestures).forEach(([k, v]) => engine?.ctx.setGesture(k, v));
  }

  engine?.onHUD({ tutor: 'Settings saved' });
  return { ok: true };
});

ipcMain.handle('settings:openConfigFolder', () => {
  shell.showItemInFolder(CONFIG_PATH);
});

// ---------- Gestures panel IPC for HUD ----------
ipcMain.handle('gestures:get', () => {
  // prefer engine’s current state (source of truth)
  return engine?.ctx.listGestures() ?? (cfg.gestures || { ...defaults.gestures });
});

ipcMain.handle('gestures:set', (_e, { name, value }) => {
  if (!name) return engine?.ctx.listGestures();
  engine?.ctx.setGesture(name, !!value);
  // persist also in config
  cfg.gestures = { ...(cfg.gestures||{}), [name]: !!value };
  saveConfig(cfg);
  return engine?.ctx.listGestures();
});

ipcMain.handle('gestures:setMany', (_e, flags) => {
  Object.entries(flags || {}).forEach(([k, v]) => engine?.ctx.setGesture(k, !!v));
  cfg.gestures = { ...(cfg.gestures||{}), ...(flags||{}) };
  saveConfig(cfg);
  return engine?.ctx.listGestures();
});
